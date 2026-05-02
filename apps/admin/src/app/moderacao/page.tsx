'use client';

import { useMemo, useState } from 'react';
import { useAuth, useCollection, where, orderBy } from '@batalha/firebase';
import { Button, Card, CardContent, EmptyState, Skeleton, Badge } from '@batalha/ui';
import { toast } from 'sonner';
import type { Submission } from '@batalha/types';

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

function getWebApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_WEB_APP_URL) {
    return process.env.NEXT_PUBLIC_WEB_APP_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.port === '3001') {
    return 'http://localhost:3000';
  }

  return '';
}

export default function ModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: pendingSubmissions, loading: pendingLoading } = useCollection<Submission>(
    'submissions',
    [where('status', '==', 'submitted'), orderBy('createdAt', 'desc')],
  );
  const { data: reviewedSubmissions, loading: reviewedLoading } = useCollection<Submission>(
    'submissions',
    [where('status', 'in', ['approved', 'rejected']), orderBy('updatedAt', 'desc')],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const loading = authLoading || pendingLoading || reviewedLoading;
  const recentReviewed = useMemo(() => reviewedSubmissions.slice(0, 8), [reviewedSubmissions]);

  const moderate = async (submissionId: string, status: 'approved' | 'rejected') => {
    if (!user) {
      toast.error('Faca login como admin.');
      return;
    }

    setActiveId(`${submissionId}:${status}`);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${getWebApiBaseUrl()}/api/submissions/${submissionId}/moderate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao moderar submissao');
      }

      toast.success(status === 'approved' ? 'Submissao aprovada.' : 'Submissao rejeitada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao moderar submissao');
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
          description="Entre com uma conta administradora para moderar submissoes."
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
            Revise videos enviados antes de liberar a votacao.
          </p>
        </div>
        <div className="text-sm text-surface-500">
          {pendingSubmissions.length} pendente{pendingSubmissions.length === 1 ? '' : 's'}
        </div>
      </div>

      <section className="mt-8">
        {pendingSubmissions.length === 0 ? (
          <EmptyState
            title="Nenhuma submissao pendente"
            description="Todas as submissoes foram revisadas."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingSubmissions.map((submission) => (
              <Card key={submission.id}>
                <CardContent>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Badge variant="warning">Pendente</Badge>
                      <h2 className="mt-3 font-semibold text-white">{submission.title}</h2>
                      <p className="mt-1 text-sm text-surface-400">
                        Batalha: <span className="font-mono">{submission.battleId}</span>
                      </p>
                      <p className="text-sm text-surface-400">
                        Usuario: <span className="font-mono">{submission.userId}</span>
                      </p>
                    </div>
                    <Badge variant="default">{submission.videoPlatform}</Badge>
                  </div>

                  {submission.description && (
                    <p className="mt-4 text-sm text-surface-300">{submission.description}</p>
                  )}

                  <a
                    href={submission.videoURL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block break-all text-sm font-medium text-brand-400 hover:text-brand-300"
                  >
                    {submission.videoURL}
                  </a>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => moderate(submission.id, 'approved')}
                      loading={activeId === `${submission.id}:approved`}
                    >
                      Aprovar
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => moderate(submission.id, 'rejected')}
                      loading={activeId === `${submission.id}:rejected`}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Revisadas recentemente</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
          {recentReviewed.length === 0 ? (
            <p className="px-4 py-6 text-sm text-surface-500">Nenhuma submissao revisada ainda.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {recentReviewed.map((submission) => (
                <div key={submission.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{submission.title}</p>
                    <p className="text-xs text-surface-500">{submission.battleId}</p>
                  </div>
                  <span className={submission.status === 'approved' ? 'text-sm font-medium text-green-700' : 'text-sm font-medium text-red-700'}>
                    {STATUS_LABEL[submission.status] || submission.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
