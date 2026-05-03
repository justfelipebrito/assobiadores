'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@batalha/firebase';
import { Button, Input } from '@batalha/ui';
import { VideoPreview } from '@/components/video/video-preview';

interface SubmitDailyHighlightModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function SubmitDailyHighlightModal({
  open,
  onClose,
  onSubmitted,
}: SubmitDailyHighlightModalProps) {
  const { user } = useAuth();
  const [videoURL, setVideoURL] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    if (!user) {
      setError('Entre para enviar seu destaque diario.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/daily-highlights/submit', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ videoURL }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao enviar destaque.');
      }

      setSuccess(`Destaque enviado. Voce ganhou ${body.pointsAwarded ?? 10} pontos casuais.`);
      setVideoURL('');
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar destaque.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-surface-950 shadow-elevated">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="font-bold text-white">Submit yours</h2>
            <p className="mt-1 text-xs text-surface-500">Envie um YouTube e ganhe 10 pontos.</p>
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
          <Input
            label="URL do video"
            placeholder="https://youtube.com/watch?v=..."
            value={videoURL}
            onChange={(event) => setVideoURL(event.target.value)}
          />

          {videoURL && <VideoPreview url={videoURL} />}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
              {success}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={submit} loading={submitting}>
              Enviar destaque
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
