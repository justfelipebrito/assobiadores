'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth, useDocument } from '@batalha/firebase';
import { Badge, Button, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { formatCurrency } from '@batalha/utils';
import type { Battle } from '@batalha/types';
import { PixPayment } from '../../../../components/payments/pix-payment';

interface PaymentResponse {
  paymentId: string;
  entryId: string;
  pixQrCode: string;
  pixCopiaECola: string;
  expiresAt: string;
}

export default function BattlePaymentPage({ params }: { params: { battleId: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: battle, loading: battleLoading } = useDocument<Battle>('battles', params.battleId);
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const createStartedRef = useRef(false);

  useEffect(() => {
    if (authLoading || battleLoading || createStartedRef.current) return;
    if (!user || !battle) return;
    if (battle.entryFee <= 0 || battle.status !== 'registration') return;

    const currentUser = user;
    createStartedRef.current = true;
    setCreatingPayment(true);
    setError(null);

    async function createPayment() {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/payments/create', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ battleId: params.battleId }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao criar pagamento');
        }

        setPayment(data);
      } catch (err) {
        createStartedRef.current = false;
        setError(err instanceof Error ? err.message : 'Erro ao criar pagamento');
      } finally {
        setCreatingPayment(false);
      }
    }

    void createPayment();
  }, [authLoading, battleLoading, battle, params.battleId, retryNonce, user]);

  useEffect(() => {
    if (!authLoading && !battleLoading && battle && battle.entryFee <= 0) {
      router.replace(`/batalhas/${params.battleId}/participar`);
    }
  }, [authLoading, battleLoading, battle, params.battleId, router]);

  const loading = authLoading || battleLoading;

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Skeleton className="mb-6 h-8 w-32" />
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
            <h1 className="mt-4 text-lg font-bold text-white">Faca login para pagar</h1>
            <p className="mt-2 text-sm text-surface-400">
              Voce precisa estar logado para gerar o Pix desta inscricao.
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

  if (battle.entryFee <= 0) {
    return null;
  }

  const isFull = battle.maxParticipants > 0 && battle.currentParticipants >= battle.maxParticipants;
  if (battle.status !== 'registration' || isFull) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link href={`/batalhas/${params.battleId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Voltar para a batalha
        </Link>
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-surface-500" />
            <h1 className="mt-4 text-lg font-bold text-white">
              {isFull ? 'Batalha lotada' : 'Inscricoes encerradas'}
            </h1>
            <p className="mt-2 text-sm text-surface-400">
              Nao e possivel gerar pagamento para esta batalha no momento.
            </p>
            <Link href={`/batalhas/${params.battleId}`} className="mt-6 inline-block">
              <Button variant="secondary" size="md">Ver detalhes</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href={`/batalhas/${params.battleId}/participar`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 transition-colors hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      {creatingPayment && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-400" />
            <h1 className="mt-4 text-lg font-bold text-white">Gerando Pix</h1>
            <p className="mt-2 text-sm text-surface-400">
              Estamos preparando o pagamento de {formatCurrency(battle.entryFee)}.
            </p>
          </CardContent>
        </Card>
      )}

      {error && !creatingPayment && (
        <Card>
          <CardContent className="space-y-6 py-8">
            <div>
              <Badge variant="gold">Inscricao paga</Badge>
              <h1 className="mt-3 text-xl font-bold text-white">{battle.title}</h1>
              <p className="mt-1 text-sm text-surface-400">
                Valor: <span className="font-semibold text-brand-400">{formatCurrency(battle.entryFee)}</span>
              </p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-200">
              {error}
            </div>
            <Button
              className="w-full"
              onClick={() => {
                createStartedRef.current = false;
                setError(null);
                setRetryNonce((value) => value + 1);
              }}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {payment && !creatingPayment && (
        <PixPayment
          title={battle.title}
          amount={battle.entryFee}
          paymentId={payment.paymentId}
          pixQrCode={payment.pixQrCode}
          pixCopiaECola={payment.pixCopiaECola}
          expiresAt={payment.expiresAt}
          getAuthToken={() => user.getIdToken()}
          approvedDescription={`Seu pagamento foi aprovado e voce ja esta em ${battle.title}.`}
          primaryHref={`/batalhas/${params.battleId}`}
          primaryLabel="Ver batalha"
          secondaryHref="/batalhas"
          secondaryLabel="Explorar batalhas"
        />
      )}
    </div>
  );
}
