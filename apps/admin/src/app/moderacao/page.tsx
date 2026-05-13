'use client';

import { useMemo, useState } from 'react';
import { useAuth, useCollection, where, orderBy } from '@batalha/firebase';
import { Button, Card, CardContent, EmptyState, Skeleton, Badge } from '@batalha/ui';
import { toast } from 'sonner';
import type { Submission, SubmissionReport } from '@batalha/types';
import { getWebApiBaseUrl } from '../../lib/web-api';

const REPORT_REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  offensive: 'Ofensivo',
  copyright: 'Direitos autorais',
  invalid_media: 'Midia invalida',
  platform_rules: 'Regras da plataforma',
  other: 'Outro',
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Ativo',
  submitted: 'Ativo',
  draft: 'Rascunho',
  rejected: 'Legado rejeitado',
  removed: 'Removido',
};

function formatDate(value: unknown) {
  if (!value) return 'Sem data';
  const date =
    typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
      ? value.toDate()
      : new Date(value as string);

  if (Number.isNaN(date.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function SubmissionSummary({ submission }: { submission: Submission }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="truncate font-semibold text-white">{submission.title}</h3>
        <Badge variant={submission.status === 'removed' ? 'danger' : 'success'}>
          {STATUS_LABEL[submission.status] ?? submission.status}
        </Badge>
        {submission.reportCount > 0 && (
          <Badge variant="warning">
            {submission.reportCount} denuncia{submission.reportCount === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-surface-400">
        {submission.userDisplayName ?? submission.userId} · Batalha{' '}
        <span className="font-mono">{submission.battleId}</span>
      </p>
      <p className="mt-1 text-xs text-surface-500">
        Enviado em {formatDate(submission.createdAt)} · audio
      </p>
    </div>
  );
}

export default function ModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: reports, loading: reportsLoading } = useCollection<SubmissionReport>(
    'submissionReports',
    [where('status', '==', 'open'), orderBy('createdAt', 'desc')],
  );
  const { data: submissions, loading: submissionsLoading } = useCollection<Submission>(
    'submissions',
    [orderBy('createdAt', 'desc')],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const loading = authLoading || reportsLoading || submissionsLoading;
  const activeSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status !== 'removed'),
    [submissions],
  );
  const submissionsById = useMemo(
    () => new Map(submissions.map((submission) => [submission.id, submission])),
    [submissions],
  );

  const removeSubmission = async (submission: Submission) => {
    if (!user) {
      toast.error('Faca login como admin.');
      return;
    }

    const confirmed = window.confirm(
      `Remover o envio "${submission.title}"? Esta acao tira o conteudo da votacao.`,
    );
    if (!confirmed) return;

    setActiveId(submission.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${getWebApiBaseUrl()}/api/submissions/${submission.id}/moderate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'remove',
          moderationNote: 'Removido pela moderacao por violar regras da plataforma.',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao remover envio');
      }

      toast.success('Envio removido.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover envio');
    } finally {
      setActiveId(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-8 h-96 w-full" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <EmptyState
          title="Login necessario"
          description="Entre com uma conta administradora para acessar a moderacao."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Moderacao</h1>
          <p className="mt-1 text-surface-400">
            Acompanhe denuncias da comunidade e remova envios fora das regras.
          </p>
        </div>
        <div className="text-sm text-surface-500">
          {reports.length} denuncia{reports.length === 1 ? '' : 's'} aberta
          {reports.length === 1 ? '' : 's'}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-white">Denuncias abertas</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
          {reports.length === 0 ? (
            <p className="px-4 py-6 text-sm text-surface-500">
              Nenhuma denuncia aberta no momento.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {reports.map((report) => {
                const submission = submissionsById.get(report.submissionId);

                return (
                  <div
                    key={report.id}
                    className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning">
                          {REPORT_REASON_LABEL[report.reason] ?? report.reason}
                        </Badge>
                        <span className="text-xs text-surface-500">
                          {formatDate(report.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white">
                        {submission?.title ?? 'Envio nao encontrado'}
                      </p>
                      <p className="mt-1 text-xs text-surface-500">
                        Denunciado por <span className="font-mono">{report.reporterId}</span>
                      </p>
                      {report.description && (
                        <p className="mt-2 text-sm text-surface-400">{report.description}</p>
                      )}
                    </div>
                    {submission && (
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={submission.mediaURL ?? submission.videoURL ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10"
                        >
                          Abrir midia
                        </a>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeSubmission(submission)}
                          loading={activeId === submission.id}
                        >
                          Remover
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Envios da plataforma</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {activeSubmissions.length === 0 ? (
            <div className="lg:col-span-2">
              <EmptyState
                title="Nenhum envio ativo"
                description="Os envios de batalhas aparecerao aqui quando forem enviados."
              />
            </div>
          ) : (
            activeSubmissions.map((submission) => (
              <Card key={submission.id}>
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <SubmissionSummary submission={submission} />
                    <div className="flex flex-shrink-0 flex-wrap gap-2">
                      <a
                        href={submission.mediaURL ?? submission.videoURL ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10"
                      >
                        Abrir midia
                      </a>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeSubmission(submission)}
                        loading={activeId === submission.id}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
