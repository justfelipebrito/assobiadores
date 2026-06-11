'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  orderBy,
  useCollectionOnce,
  getClientAuth,
} from '@batalha/firebase';
import { Badge, Button, EmptyState, Skeleton } from '@batalha/ui';
import { formatCurrency, formatRelativeTime, toDate } from '@batalha/utils';
import { toast } from 'sonner';
import type { Battle, BattleEntry, Submission, Vote } from '@batalha/types';
import { SortableTableHeader } from '../../components/sortable-table-header';
import { getNextSortState, sortRows, type SortState } from '../../components/sortable-table';
import { getWebApiBaseUrl } from '../../lib/web-api';
import { getAdminBattleTieBreakOptions } from './admin-battle-tiebreak';
import { AdminBattleConfigModal } from './admin-battle-config-modal';

type BattleSortKey = 'battle' | 'status' | 'participants' | 'entryFee';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'default' },
  registration: { label: 'Inscricoes', color: 'success' },
  active: { label: 'Em andamento', color: 'info' },
  voting: { label: 'Em votacao', color: 'purple' },
  finished: { label: 'Finalizada', color: 'default' },
};

const BATTLE_SORT_SELECTORS = {
  battle: (battle: Battle) => battle.title,
  status: (battle: Battle) => STATUS_MAP[battle.status]?.label ?? battle.status,
  participants: (battle: Battle) => battle.currentParticipants ?? 0,
  entryFee: (battle: Battle) => battle.entryFee ?? 0,
};

export default function AdminBattlesPage() {
  const router = useRouter();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tieBreakingKey, setTieBreakingKey] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState<BattleSortKey>>({
    key: 'battle',
    direction: 'asc',
  });
  const { data: battles, loading, refresh: refreshBattles } = useCollectionOnce<Battle>(
    'battles',
    [orderBy('createdAt', 'desc')],
  );
  const { data: entries, refresh: refreshEntries } = useCollectionOnce<BattleEntry>('battleEntries');
  const { data: submissions, refresh: refreshSubmissions } =
    useCollectionOnce<Submission>('submissions');
  const { data: votes, refresh: refreshVotes } = useCollectionOnce<Vote>('votes');
  const sortedBattles = useMemo(
    () => sortRows(battles, sort, BATTLE_SORT_SELECTORS),
    [battles, sort],
  );
  const tieBreakOptionsByBattle = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getAdminBattleTieBreakOptions>>();
    battles.forEach((battle) => {
      map.set(
        battle.id,
        getAdminBattleTieBreakOptions({
          battle,
          entries,
          submissions,
          votes,
        }),
      );
    });
    return map;
  }, [battles, entries, submissions, votes]);

  const openCreateForm = () => {
    setCreateModalOpen(true);
  };

  const resolveTieBreak = async (battleId: string, submissionId: string) => {
    const key = `${battleId}:${submissionId}`;
    if (!confirm('Registrar este desempate?')) return;

    setTieBreakingKey(key);
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) throw new Error('Sessao expirada. Entre novamente.');
      const response = await fetch(`${getWebApiBaseUrl()}/api/battles/${battleId}/tiebreak`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ submissionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao desempatar batalha');
      toast.success('Desempate registrado.');
      refreshBattles();
      refreshVotes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desempatar batalha');
    } finally {
      setTieBreakingKey(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Batalhas</h1>
          <p className="mt-1 text-surface-400">
            Acompanhe batalhas criadas na plataforma. Finalizacao fica com o criador.
          </p>
        </div>
        <Button onClick={openCreateForm}>Nova batalha</Button>
      </div>

      {createModalOpen && (
        <AdminBattleConfigModal
          battle={null}
          onClose={() => setCreateModalOpen(false)}
          onSaved={() => {
            setCreateModalOpen(false);
            refreshBattles();
            refreshEntries();
            refreshSubmissions();
            refreshVotes();
          }}
        />
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-500">
          Todas as batalhas
        </h2>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : battles.length === 0 ? (
          <EmptyState
            title="Nenhuma batalha ainda"
            description="As batalhas criadas aparecerao aqui."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <SortableTableHeader
                    label="Batalha"
                    active={sort.key === 'battle'}
                    direction={sort.direction}
                    onClick={() => setSort((current) => getNextSortState(current, 'battle'))}
                  />
                  <SortableTableHeader
                    label="Status"
                    active={sort.key === 'status'}
                    direction={sort.direction}
                    onClick={() => setSort((current) => getNextSortState(current, 'status'))}
                  />
                  <SortableTableHeader
                    label="Participantes"
                    active={sort.key === 'participants'}
                    direction={sort.direction}
                    align="right"
                    onClick={() =>
                      setSort((current) => getNextSortState(current, 'participants'))
                    }
                  />
                  <SortableTableHeader
                    label="Inscricao"
                    active={sort.key === 'entryFee'}
                    direction={sort.direction}
                    align="right"
                    onClick={() => setSort((current) => getNextSortState(current, 'entryFee'))}
                  />
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-500">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedBattles.map((battle) => {
                  const status = STATUS_MAP[battle.status] || STATUS_MAP.draft!;
                  const regEnd = toDate(battle.registrationEnd);
                  const tieBreakOptions = tieBreakOptionsByBattle.get(battle.id) ?? [];

                  return (
                    <tr
                      key={battle.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/batalhas/${battle.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/batalhas/${battle.id}`);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04] focus:bg-white/[0.04] focus:outline-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{battle.title}</p>
                        <p className="text-xs capitalize text-surface-500">
                          {battle.category} ·{' '}
                          {battle.type === 'official' ? 'oficial' : 'comunidade'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.color as 'default' | 'success' | 'info' | 'purple'}>
                          {status.label}
                        </Badge>
                        {regEnd && battle.status === 'registration' && (
                          <p className="mt-1 text-xs text-surface-500">
                            {formatRelativeTime(regEnd)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-surface-300">
                        {battle.currentParticipants}
                        {battle.maxParticipants > 0 && (
                          <span className="text-surface-600">/{battle.maxParticipants}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {battle.entryFee > 0 ? (
                          <span className="font-medium text-brand-400">
                            {formatCurrency(battle.entryFee)}
                          </span>
                        ) : (
                          <span className="text-surface-500">Gratis</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {tieBreakOptions.map((option) => {
                            const key = `${battle.id}:${option.id}`;
                            return (
                              <Button
                                key={option.id}
                                size="sm"
                                variant="secondary"
                                loading={tieBreakingKey === key}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  resolveTieBreak(battle.id, option.id);
                                }}
                              >
                                Desempatar {option.userDisplayName ?? option.userId}
                              </Button>
                            );
                          })}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/batalhas/${battle.id}`);
                            }}
                          >
                            Abrir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
