'use client';

import Link from 'next/link';
import {
  ArrowLeft, Users, Clock, Trophy, Calendar, Swords,
  CheckCircle2, Music, Vote, Sparkles,
} from 'lucide-react';
import { useDocument } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, Skeleton, EmptyState } from '@batalha/ui';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@batalha/utils';
import type { Battle } from '@batalha/types';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'purple'; description: string }> = {
  draft: { label: 'Rascunho', variant: 'default', description: 'Esta batalha ainda nao foi publicada.' },
  registration: { label: 'Inscricoes abertas', variant: 'success', description: 'Inscricoes abertas! Entre agora.' },
  active: { label: 'Em andamento', variant: 'info', description: 'Envie sua submissao antes do prazo.' },
  voting: { label: 'Em votacao', variant: 'purple', description: 'Vote nas melhores submissoes!' },
  finished: { label: 'Finalizada', variant: 'default', description: 'Esta batalha ja foi encerrada.' },
};

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return null;
}

export default function BattleDetailPage({ params }: { params: { battleId: string } }) {
  const { data: battle, loading } = useDocument<Battle>('battles', params.battleId);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="py-20">
        <EmptyState
          title="Batalha nao encontrada"
          description="Esta batalha nao existe ou foi removida."
          action={
            <Link href="/batalhas">
              <Button variant="secondary">Ver batalhas</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const status = STATUS_CONFIG[battle.status] || STATUS_CONFIG.finished!;
  const isPaid = battle.entryFee > 0;
  const regEnd = toDate(battle.registrationEnd);
  const subDeadline = toDate(battle.submissionDeadline);
  const voteEnd = toDate(battle.votingEnd);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back */}
      <Link href="/batalhas" className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Todas as batalhas
      </Link>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-accent-500/5" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            {battle.type === 'official' && (
              <Badge variant="gold">
                <Trophy className="mr-1 h-3 w-3" />
                Oficial
              </Badge>
            )}
            <Badge variant="default">{battle.category}</Badge>
          </div>

          <h1 className="mt-4 text-3xl font-bold text-white">{battle.title}</h1>
          <p className="mt-2 text-surface-400 leading-relaxed">{battle.description}</p>

          {/* Quick stats */}
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-surface-300">
              <Users className="h-4 w-4 text-brand-400" />
              {battle.currentParticipants}
              {battle.maxParticipants > 0 && ` / ${battle.maxParticipants}`} participantes
            </div>
            {isPaid && (
              <div className="flex items-center gap-2 text-surface-300">
                <Sparkles className="h-4 w-4 text-brand-400" />
                Inscricao: <span className="font-semibold text-brand-400">{formatCurrency(battle.entryFee)}</span>
              </div>
            )}
            {battle.prizePool > 0 && (
              <div className="flex items-center gap-2 text-surface-300">
                <Trophy className="h-4 w-4 text-yellow-400" />
                Premio: <span className="font-semibold text-yellow-400">{formatCurrency(battle.prizePool)}</span>
              </div>
            )}
          </div>

          {/* CTA */}
          {battle.status === 'registration' && (
            <div className="mt-8">
              <Link href={`/batalhas/${battle.id}/participar`}>
                <Button size="lg">
                  <Swords className="mr-2 h-5 w-5" />
                  Participar desta batalha
                </Button>
              </Link>
            </div>
          )}
          {battle.status === 'voting' && (
            <div className="mt-8">
              <Link href={`/batalhas/${battle.id}/votar`}>
                <Button size="lg" variant="accent">
                  <Vote className="mr-2 h-5 w-5" />
                  Votar
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Timeline + details */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <Card className="lg:col-span-2">
          <CardContent>
            <h2 className="mb-4 text-lg font-semibold text-white">Cronograma</h2>
            <div className="space-y-4">
              {[
                { icon: <Calendar className="h-4 w-4" />, label: 'Inscricoes', date: regEnd },
                { icon: <Music className="h-4 w-4" />, label: 'Submissoes', date: subDeadline },
                { icon: <Vote className="h-4 w-4" />, label: 'Votacao encerra', date: voteEnd },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-surface-400">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-sm text-surface-500">
                      {item.date ? formatDateTime(item.date) : 'A definir'}
                    </p>
                  </div>
                  {item.date && (
                    <span className="text-xs text-surface-500">
                      {formatRelativeTime(item.date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardContent>
            <h2 className="mb-4 text-lg font-semibold text-white">Regras</h2>
            {battle.rules.length > 0 ? (
              <ul className="space-y-3">
                {battle.rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                    {rule}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-surface-500">Sem regras especificas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
