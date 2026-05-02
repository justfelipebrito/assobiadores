'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Vote } from 'lucide-react';
import { useAuth, useCollection, useDocument, where, orderBy } from '@batalha/firebase';
import { Button, Card, CardContent, EmptyState, Skeleton } from '@batalha/ui';
import { toast } from 'sonner';
import type { Battle, Submission } from '@batalha/types';
import { VideoPreview } from '../../../../components/video/video-preview';

export default function VotePage({ params }: { params: { battleId: string } }) {
  const { user, loading: authLoading } = useAuth();
  const { data: battle, loading: battleLoading } = useDocument<Battle>('battles', params.battleId);
  const { data: submissions, loading: submissionsLoading } = useCollection<Submission>(
    'submissions',
    [
      where('battleId', '==', params.battleId),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
    ],
  );
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  const loading = authLoading || battleLoading || submissionsLoading;

  const handleVote = async (submissionId: string) => {
    if (!user) {
      toast.error('Faca login para votar.');
      return;
    }

    setVotingId(submissionId);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/votes/create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ battleId: params.battleId, submissionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao votar');
      }
      setVoted(true);
      toast.success('Voto registrado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao votar');
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!battle) {
    return <EmptyState title="Batalha nao encontrada" description="Esta batalha nao existe." />;
  }

  if (battle.status !== 'voting') {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <Vote className="mx-auto h-12 w-12 text-surface-500" />
            <h1 className="mt-4 text-lg font-bold text-white">Votacao fechada</h1>
            <p className="mt-2 text-sm text-surface-400">Esta batalha nao esta em fase de votacao.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/batalhas/${params.battleId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a batalha
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Votar</h1>
        <p className="mt-1 text-surface-400">{battle.title}</p>
      </div>

      {voted && (
        <div className="mt-6 rounded-xl border border-brand-500/20 bg-brand-500/10 p-4 text-sm text-brand-200">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          Seu voto foi registrado nesta batalha.
        </div>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {submissions.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState title="Nenhuma submissao aprovada" description="A votacao aparecera quando houver videos aprovados." />
          </div>
        ) : (
          submissions.map((submission) => (
            <Card key={submission.id}>
              <CardContent className="space-y-4">
                <VideoPreview url={submission.videoURL} />
                <div>
                  <h2 className="font-semibold text-white">{submission.title}</h2>
                  {submission.description && (
                    <p className="mt-1 text-sm text-surface-400">{submission.description}</p>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleVote(submission.id)}
                  loading={votingId === submission.id}
                  disabled={voted}
                >
                  <Vote className="mr-2 h-4 w-4" />
                  Votar neste video
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
