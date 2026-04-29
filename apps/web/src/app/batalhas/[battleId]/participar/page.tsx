'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Swords, Users, Trophy, Sparkles, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { useAuth, useDocument, getClientFirestore, doc, writeBatch, serverTimestamp, collection } from '@batalha/firebase';
import { Button, Card, CardContent, Badge, Skeleton, EmptyState } from '@batalha/ui';
import { formatCurrency } from '@batalha/utils';
import { toast } from 'sonner';
import type { Battle, BattleEntry } from '@batalha/types';

export default function BattleEntryPage({ params }: { params: { battleId: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: battle, loading: battleLoading } = useDocument<Battle>('battles', params.battleId);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  const loading = authLoading || battleLoading;

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-96 w-full" />
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

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link href={`/batalhas/${params.battleId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-surface-500" />
            <h2 className="mt-4 text-lg font-bold text-white">Faca login para participar</h2>
            <p className="mt-2 text-sm text-surface-400">
              Voce precisa estar logado para entrar em uma batalha.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/entrar">
                <Button size="md">Entrar</Button>
              </Link>
              <Link href="/cadastro">
                <Button variant="ghost" size="md">Criar conta</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = battle.entryFee > 0;
  const isFull = battle.maxParticipants > 0 && battle.currentParticipants >= battle.maxParticipants;
  const isOpen = battle.status === 'registration';

  const handleJoin = async () => {
    if (!user || !battle) return;

    if (isPaid) {
      // Paid battles go through payment flow
      router.push(`/batalhas/${params.battleId}/pagamento`);
      return;
    }

    setSubmitting(true);
    try {
      const db = getClientFirestore();
      const batch = writeBatch(db);

      // Create battle entry
      const entryRef = doc(collection(db, 'battleEntries'));
      const entry: Omit<BattleEntry, 'id'> = {
        battleId: params.battleId,
        userId: user.uid,
        paymentId: null,
        status: 'confirmed',
        createdAt: serverTimestamp(),
      };
      batch.set(entryRef, entry);

      // Increment participant count
      const battleRef = doc(db, 'battles', params.battleId);
      const { increment } = await import('firebase/firestore');
      batch.update(battleRef, {
        currentParticipants: increment(1),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setJoined(true);
      toast.success('Voce esta na batalha!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao participar';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (joined) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10">
              <CheckCircle2 className="h-8 w-8 text-brand-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Inscricao confirmada!</h2>
            <p className="mt-2 text-surface-400">
              Voce esta participando de <span className="font-semibold text-white">{battle.title}</span>.
              Aguarde a fase de submissao para enviar seu assobio.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={`/batalhas/${params.battleId}`}>
                <Button size="md">Ver detalhes da batalha</Button>
              </Link>
              <Link href="/batalhas">
                <Button variant="ghost" size="md">Explorar mais batalhas</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href={`/batalhas/${params.battleId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a batalha
      </Link>

      <Card>
        <CardContent className="space-y-6">
          {/* Battle summary */}
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Inscricoes abertas</Badge>
              {battle.type === 'official' && (
                <Badge variant="gold">
                  <Trophy className="mr-1 h-3 w-3" />
                  Oficial
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-xl font-bold text-white">{battle.title}</h1>
            <p className="mt-1 text-sm text-surface-400">{battle.description}</p>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
              <Users className="mx-auto h-5 w-5 text-surface-400" />
              <p className="mt-2 text-lg font-bold text-white">
                {battle.currentParticipants}
                {battle.maxParticipants > 0 && <span className="text-surface-500">/{battle.maxParticipants}</span>}
              </p>
              <p className="text-xs text-surface-500">Participantes</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
              {isPaid ? (
                <>
                  <Sparkles className="mx-auto h-5 w-5 text-brand-400" />
                  <p className="mt-2 text-lg font-bold text-brand-400">{formatCurrency(battle.entryFee)}</p>
                  <p className="text-xs text-surface-500">Inscricao</p>
                </>
              ) : (
                <>
                  <Sparkles className="mx-auto h-5 w-5 text-brand-400" />
                  <p className="mt-2 text-lg font-bold text-brand-400">Gratis</p>
                  <p className="text-xs text-surface-500">Inscricao</p>
                </>
              )}
            </div>
          </div>

          {battle.prizePool > 0 && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
              <Trophy className="mx-auto h-5 w-5 text-yellow-400" />
              <p className="mt-1 text-lg font-bold text-yellow-400">{formatCurrency(battle.prizePool)}</p>
              <p className="text-xs text-surface-400">em premios</p>
            </div>
          )}

          {/* Rules */}
          {battle.rules.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white">Regras</h3>
              <ul className="mt-2 space-y-2">
                {battle.rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action */}
          {!isOpen ? (
            <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 text-center">
              <p className="text-sm text-surface-400">Inscricoes encerradas para esta batalha.</p>
            </div>
          ) : isFull ? (
            <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-4 text-center">
              <p className="text-sm text-surface-400">Esta batalha ja atingiu o numero maximo de participantes.</p>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={handleJoin}
              loading={submitting}
            >
              <Swords className="mr-2 h-5 w-5" />
              {isPaid ? `Pagar e participar — ${formatCurrency(battle.entryFee)}` : 'Confirmar participacao'}
            </Button>
          )}

          <p className="text-center text-xs text-surface-600">
            Ao participar, voce concorda com as regras da batalha.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
