'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clipboard, Clock, QrCode, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent } from '@batalha/ui';
import { formatCurrency } from '@batalha/utils';
import { toast } from 'sonner';

type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

interface PixPaymentProps {
  title: string;
  amount: number;
  paymentId: string;
  pixQrCode: string;
  pixCopiaECola: string;
  expiresAt: string;
  getAuthToken: () => Promise<string>;
  approvedTitle?: string;
  approvedDescription?: string;
  rejectedDescription?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  allowTestApproval?: boolean;
  onApproved?: () => void;
}

function formatRemainingTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function PixPayment({
  title,
  amount,
  paymentId,
  pixQrCode,
  pixCopiaECola,
  expiresAt,
  getAuthToken,
  approvedTitle = 'Inscricao confirmada!',
  approvedDescription,
  rejectedDescription = 'Este Pix expirou ou nao foi aprovado. Gere um novo pagamento para continuar.',
  primaryHref = '/',
  primaryLabel = 'Continuar',
  secondaryHref,
  secondaryLabel,
  allowTestApproval = false,
  onApproved,
}: PixPaymentProps) {
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [checking, setChecking] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());

  const expired = remainingMs <= 0 && status === 'pending';
  const qrCodeSrc = useMemo(() => {
    if (!pixQrCode) return '';
    return pixQrCode.startsWith('data:') ? pixQrCode : `data:image/png;base64,${pixQrCode}`;
  }, [pixQrCode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const checkStatus = async (silent = false) => {
    if (status !== 'pending') return;

    setChecking(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/payments/${paymentId}/status`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao consultar pagamento');
      }

      setStatus(data.status);
      if (data.status === 'approved') {
        toast.success('Pagamento aprovado! Inscricao confirmada.');
        onApproved?.();
      } else if (data.status === 'rejected' || data.status === 'refunded') {
        toast.error('Pagamento nao aprovado.');
      } else if (!silent) {
        toast.info('Pagamento ainda pendente.');
      }
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : 'Erro ao consultar pagamento');
      }
    } finally {
      setChecking(false);
    }
  };

  const simulateApproval = async () => {
    if (status !== 'pending') return;

    setChecking(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/payments/${paymentId}/simulate-approval`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao simular pagamento');
      }

      setStatus(data.status);
      toast.success('Pagamento aprovado no ambiente de teste.');
      onApproved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao simular pagamento');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (status !== 'pending' || expired) return undefined;

    const interval = window.setInterval(() => {
      void checkStatus(true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [expired, paymentId, status]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixCopiaECola);
      toast.success('Codigo Pix copiado.');
    } catch {
      toast.error('Nao foi possivel copiar o codigo Pix.');
    }
  };

  if (status === 'approved') {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10">
            <CheckCircle2 className="h-8 w-8 text-brand-400" />
          </div>
          <h1 className="text-xl font-bold text-white">{approvedTitle}</h1>
          <p className="mt-2 text-surface-400">
            {approvedDescription ?? (
              <>
                Seu pagamento foi aprovado para{' '}
                <span className="font-semibold text-white">{title}</span>.
              </>
            )}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={primaryHref}>
              <Button size="md">{primaryLabel}</Button>
            </Link>
            {secondaryHref && secondaryLabel && (
              <Link href={secondaryHref}>
                <Button variant="ghost" size="md">
                  {secondaryLabel}
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'rejected' || status === 'refunded' || expired) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Pagamento nao concluido</h1>
          <p className="mt-2 text-surface-400">{rejectedDescription}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="md" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar novo Pix
            </Button>
            {secondaryHref && secondaryLabel && (
              <Link href={secondaryHref}>
                <Button variant="ghost" size="md">
                  {secondaryLabel}
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-brand-400">
            <QrCode className="h-4 w-4" />
            Pagamento Pix
          </div>
          <h1 className="mt-2 text-xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-surface-400">
            Pague {formatCurrency(amount)} para confirmar sua inscricao.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-surface-300">
            <Clock className="h-4 w-4 text-brand-400" />
            Expira em
          </div>
          <span className="font-mono text-lg font-bold text-white">
            {formatRemainingTime(remainingMs)}
          </span>
        </div>

        {qrCodeSrc ? (
          <div className="rounded-xl border border-white/10 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeSrc} alt="QR Code Pix" className="mx-auto h-56 w-56" />
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-surface-500">
            QR Code indisponivel
          </div>
        )}

        <div>
          <label htmlFor="pix-code" className="text-sm font-semibold text-white">
            Pix copia e cola
          </label>
          <textarea
            id="pix-code"
            readOnly
            value={pixCopiaECola}
            className="mt-2 min-h-28 w-full resize-none rounded-xl border border-white/10 bg-surface-900 px-3 py-3 text-xs text-surface-300 outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button onClick={handleCopy} disabled={!pixCopiaECola}>
            <Clipboard className="mr-2 h-4 w-4" />
            Copiar codigo
          </Button>
          <Button variant="secondary" onClick={() => checkStatus(false)} loading={checking}>
            {!checking && <RefreshCw className="mr-2 h-4 w-4" />}
            Verificar pagamento
          </Button>
        </div>

        {allowTestApproval && (
          <Button variant="ghost" className="w-full" onClick={simulateApproval} disabled={checking}>
            Aprovar no teste
          </Button>
        )}

        <p className="text-center text-xs text-surface-600">
          A confirmacao acontece somente depois que o Pix for aprovado pelo Mercado Pago.
        </p>
      </CardContent>
    </Card>
  );
}
