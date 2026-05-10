'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@batalha/firebase';
import { Button } from '@batalha/ui';
import { type DailyHighlight } from '@batalha/types';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';

interface LikeDailyHighlightModalProps {
  dailyHighlight: DailyHighlight | null;
  onClose: () => void;
}

export function LikeDailyHighlightModal({ dailyHighlight, onClose }: LikeDailyHighlightModalProps) {
  useBodyScrollLock(Boolean(dailyHighlight));
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!dailyHighlight) return null;

  async function confirmLike() {
    const target = dailyHighlight;
    if (!target) return;

    if (!user) {
      setError('Entre para curtir este destaque.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/daily-highlights/${target.id}/like`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao curtir destaque.');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao curtir destaque.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-black/70 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-surface-950 shadow-elevated">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="font-bold text-white">Votar</h2>
            <p className="mt-1 text-xs text-surface-500">Confirmar voto no destaque diário</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-surface-400 hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-sm text-surface-300">
              Você está votando em{' '}
              <span className="font-semibold text-white">{dailyHighlight.userDisplayName}</span>.
              Cada pessoa pode votar em apenas um destaque por dia, e essa ação não pode ser
              desfeita.
            </p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={confirmLike} loading={submitting}>
              Confirmar voto
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
