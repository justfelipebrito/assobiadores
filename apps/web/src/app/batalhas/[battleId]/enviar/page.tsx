'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Send, AlertCircle } from 'lucide-react';
import { useAuth, useDocument } from '@batalha/firebase';
import { Button, Card, CardContent, EmptyState, Input, Skeleton, Textarea } from '@batalha/ui';
import { toast } from 'sonner';
import type { Battle } from '@batalha/types';
import { VideoPreview } from '../../../../components/video/video-preview';

export default function SubmitVideoPage({ params }: { params: { battleId: string } }) {
  const { user, loading: authLoading } = useAuth();
  const { data: battle, loading: battleLoading } = useDocument<Battle>('battles', params.battleId);
  const [title, setTitle] = useState('');
  const [videoURL, setVideoURL] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loading = authLoading || battleLoading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/submissions/create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          battleId: params.battleId,
          title,
          videoURL,
          description,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar video');
      }

      setSubmitted(true);
      toast.success('Video enviado para moderacao.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar video');
    } finally {
      setSubmitting(false);
    }
  };

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
        <Link href={`/batalhas/${params.battleId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-surface-500" />
            <h1 className="mt-4 text-lg font-bold text-white">Submissoes fechadas</h1>
            <p className="mt-2 text-sm text-surface-400">
              Esta batalha nao esta na fase de envio de videos.
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
            <h1 className="mt-4 text-xl font-bold text-white">Video enviado</h1>
            <p className="mt-2 text-sm text-surface-400">
              Sua submissao foi enviada para moderacao.
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
      <Link href={`/batalhas/${params.battleId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a batalha
      </Link>

      <Card>
        <CardContent>
          <h1 className="text-xl font-bold text-white">Enviar video</h1>
          <p className="mt-1 text-sm text-surface-400">{battle.title}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <Input
              label="Titulo"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
            <Input
              label="URL do video"
              type="url"
              value={videoURL}
              onChange={(event) => setVideoURL(event.target.value)}
              placeholder="YouTube, TikTok ou Instagram"
              required
            />
            <VideoPreview url={videoURL} />
            <Textarea
              label="Descricao"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              helperText={`${description.length}/1000 caracteres`}
            />
            <Button type="submit" className="w-full" loading={submitting}>
              <Send className="mr-2 h-4 w-4" />
              Enviar para moderacao
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
