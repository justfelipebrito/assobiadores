'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Send, Square, X } from 'lucide-react';
import { useAuth } from '@batalha/firebase';
import { Button } from '@batalha/ui';
import {
  COMPETITION_CATEGORY_LABELS,
  DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS,
  type CompetitionCategory,
} from '@batalha/types';
import { AudioHighlightPlayer } from '@/components/media/audio-highlight-player';

interface SubmitBattleAudioModalProps {
  open: boolean;
  battleId: string;
  battleTitle: string;
  category: CompetitionCategory;
  onClose: () => void;
  onSubmitted?: () => void;
}

function getRecorderMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = String(safe % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

export function SubmitBattleAudioModal({
  open,
  battleId,
  battleTitle,
  category,
  onClose,
  onSubmitted,
}: SubmitBattleAudioModalProps) {
  const { user } = useAuth();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const stopTimerRef = useRef<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (audioBlob ? URL.createObjectURL(audioBlob) : null),
    [audioBlob],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!recording) return undefined;
    const interval = window.setInterval(() => {
      setRecordingSeconds(
        Math.min(
          DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS,
          Math.floor((Date.now() - startedAtRef.current) / 1000),
        ),
      );
    }, 250);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (!open) {
      cleanupStream();
      setError(null);
      setSuccess(null);
      setAudioBlob(null);
      setDurationSeconds(0);
      setRecordingSeconds(0);
      setRecording(false);
    }
  }, [open]);

  if (!open) return null;

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }

  async function startRecording() {
    setError(null);
    setSuccess(null);
    setAudioBlob(null);
    setRecordingSeconds(0);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Gravação de áudio não suportada neste navegador.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setDurationSeconds(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
        setRecordingSeconds(0);
        setRecording(false);
        cleanupStream();
      };

      recorder.start();
      setRecording(true);
      stopTimerRef.current = window.setTimeout(
        stopRecording,
        DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS * 1000,
      );
    } catch (err) {
      cleanupStream();
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar a gravação.');
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }

  async function submit() {
    if (!user) {
      setError('Entre para enviar seu assobio.');
      return;
    }
    if (!audioBlob) {
      setError('Grave seu assobio antes de enviar.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('battleId', battleId);
      formData.append('audio', audioBlob, 'assobio.webm');
      formData.append('category', category);
      formData.append('durationSeconds', String(durationSeconds));

      const response = await fetch('/api/submissions/create', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || 'Erro ao enviar assobio.');
      }

      setSuccess('Assobio enviado para esta batalha.');
      setAudioBlob(null);
      setDurationSeconds(0);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar assobio.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-surface-950 shadow-elevated">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="font-bold text-white">Enviar assobio</h2>
            <p className="mt-1 text-xs text-surface-500">
              {battleTitle} · {COMPETITION_CATEGORY_LABELS[category]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-surface-400 hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {previewUrl ? (
            <AudioHighlightPlayer
              src={previewUrl}
              username={user?.displayName || 'Assobiador'}
              category={category}
              durationSeconds={durationSeconds}
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-white/10 bg-surface-900 p-5 text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full ${
                  recording ? 'bg-red-500/15 text-red-300' : 'bg-brand-500/10 text-brand-400'
                }`}
              >
                <Mic className="h-7 w-7" />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">
                {recording ? 'Gravando...' : 'Grave seu assobio'}
              </p>
              <p className="mt-1 text-xs tabular-nums text-surface-500">
                {formatTime(recordingSeconds)} / {formatTime(DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS)}
              </p>
              <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-400 transition-all"
                  style={{
                    width: `${Math.min(100, (recordingSeconds / DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-4 flex h-10 w-full max-w-xs items-center gap-1 px-2">
                {Array.from({ length: 28 }).map((_, index) => (
                  <div
                    key={index}
                    className={`w-full rounded-full ${recording ? 'bg-brand-400' : 'bg-white/15'}`}
                    style={{
                      height: `${recording ? 20 + ((recordingSeconds + index * 7) % 45) : 16}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

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
            {recording ? (
              <Button variant="secondary" onClick={stopRecording}>
                <Square className="mr-2 h-4 w-4" />
                Parar gravação
              </Button>
            ) : (
              <Button variant="secondary" onClick={startRecording} disabled={submitting}>
                <Mic className="mr-2 h-4 w-4" />
                {audioBlob ? 'Gravar novamente' : 'Gravar'}
              </Button>
            )}
            <Button onClick={submit} loading={submitting} disabled={!audioBlob || recording}>
              <Send className="mr-2 h-4 w-4" />
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
