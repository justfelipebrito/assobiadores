'use client';

import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';
import { PixPayment } from './pix-payment';

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  amount: number;
  paymentId: string;
  pixQrCode: string;
  pixCopiaECola: string;
  expiresAt: string;
  getAuthToken: () => Promise<string>;
  approvedTitle?: string;
  approvedDescription?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  allowTestApproval?: boolean;
  onApproved?: () => void;
}

export function PixPaymentModal({
  open,
  onClose,
  title,
  amount,
  paymentId,
  pixQrCode,
  pixCopiaECola,
  expiresAt,
  getAuthToken,
  approvedTitle,
  approvedDescription,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  allowTestApproval,
  onApproved,
}: PixPaymentModalProps) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-black/70 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div className="relative max-h-full w-full max-w-md overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-surface-900/90 text-surface-400 transition-colors hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <PixPayment
          title={title}
          amount={amount}
          paymentId={paymentId}
          pixQrCode={pixQrCode}
          pixCopiaECola={pixCopiaECola}
          expiresAt={expiresAt}
          getAuthToken={getAuthToken}
          approvedTitle={approvedTitle}
          approvedDescription={approvedDescription}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          secondaryHref={secondaryHref}
          secondaryLabel={secondaryLabel}
          allowTestApproval={allowTestApproval}
          onApproved={onApproved}
        />
      </div>
    </div>
  );
}
