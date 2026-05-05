'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Mic, Send, Square } from 'lucide-react';
import { useAuth, useDocument } from '@batalha/firebase';
import { Button, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import {
  COMPETITION_CATEGORY_LABELS,
  DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS,
  type Battle,
} from '@batalha/types';
import { toast } from 'sonner';
import { AudioHighlightPlayer } from '../../../../components/media/audio-highlight-player';

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

export default function SubmitBattleAudioPage({ params }: { params: { battleId: string } }) {
  const { user, loading: authLoading } = useAuth();
  const { data: battle, loading: battleLoading } = useDocument<Battle>('battles', params.battleId);
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
  const [submitted, setSubmitted] = useState(false);

  const loading = authLoading || battleLoading;
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

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }

  async function startRecording() {
    setAudioBlob(null);
    setRecordingSeconds(0);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Gravacao de audio nao suportada neste navegador.');
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
    } catch (error) {
      cleanupStream();
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel iniciar a gravacao.');
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }

  async function handleSubmit() {
    if (!user) {
      toast.error('Faca login para enviar.');
      return;
    }
    if (!audioBlob) {
      toast.error('Grave seu assobio antes de enviar.');
      return;
    }
    if (!battle) {
      toast.error('Batalha nao encontrada.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('battleId', params.battleId);
      formData.append('audio', audioBlob, 'assobio.webm');
      formData.append('category', battle.category);
      formData.append('durationSeconds', String(durationSeconds));

      const res = await fetch('/api/submissions/create', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar assobio');
      }

      setSubmitted(true);
      toast.success('Assobio enviado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar assobio');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="py-20">
        <EmptyState title="Batalha nao encontrada" description="Esta batalha nao existe ou foi removida." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-surface-500" />
            <h1 className="mt-4 text-lg font-bold text-white">Faca login para enviar</h1>
            <p className="mt-2 text-sm text-surface-400">
              Voce precisa estar logado e inscrito na batalha.
            </p>
            <Link href="/entrar" className="mt-6 inline-block">
              <Button>Entrar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (battle.status !== 'active') {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link
          href={`/batalhas/${params.battleId}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-surface-500" />
            <h1 className="mt-4 text-lg font-bold text-white">Envios fechados</h1>
            <p className="mt-2 text-sm text-surface-400">
              Esta batalha nao esta na fase de envio de assobios.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand-400" />
            <h1 className="mt-4 text-xl font-bold text-white">Assobio enviado</h1>
            <p className="mt-2 text-sm text-surface-400">
              Envio registrado para esta batalha.
            </p>
            <Link href={`/batalhas/${params.battleId}`} className="mt-6 inline-block">
              <Button>Ver batalha</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/batalhas/${params.battleId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para a batalha
      </Link>

      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-white">Enviar assobio</h1>
          <p className="mt-1 text-sm text-surface-400">
            {battle.title} · {COMPETITION_CATEGORY_LABELS[battle.category]}
          </p>

          <div className="mt-6 space-y-5">
            {previewUrl ? (
              <AudioHighlightPlayer
                src={previewUrl}
                username={user.displayName || 'Assobiador'}
                category={battle.category}
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

            <div className="grid gap-3 sm:grid-cols-2">
              {recording ? (
                <Button variant="secondary" onClick={stopRecording}>
                  <Square className="mr-2 h-4 w-4" />
                  Parar gravacao
                </Button>
              ) : (
                <Button variant="secondary" onClick={startRecording} disabled={submitting}>
                  <Mic className="mr-2 h-4 w-4" />
                  {audioBlob ? 'Gravar novamente' : 'Gravar'}
                </Button>
              )}
              <Button onClick={handleSubmit} loading={submitting} disabled={!audioBlob || recording}>
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
