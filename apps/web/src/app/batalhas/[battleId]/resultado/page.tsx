'use client';

import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useCollection, useDocument, where, orderBy } from '@batalha/firebase';
import { Card, CardContent, EmptyState, Skeleton, Badge } from '@batalha/ui';
import type { Battle, Submission } from '@batalha/types';
import { MediaPreview } from '../../../../components/media/media-preview';
import {
  getBattleSubmissionResultBreakdown,
  sortBattleSubmissionsForResult,
} from '../../../../lib/battle-detail-view';
import {
  getBattleWinnerBadgeLabel,
  getBattleWinnerForSubmission,
} from '../../../../lib/battle-vote-view';

export default function ResultPage({ params }: { params: { battleId: string } }) {
  const { data: battle, loading: battleLoading } = useDocument<Battle>('battles', params.battleId);
  const { data: submissions, loading: submissionsLoading } = useCollection<Submission>(
    'submissions',
    [
      where('battleId', '==', params.battleId),
      where('status', '==', 'approved'),
      orderBy('voteCount', 'desc'),
    ],
  );

  const loading = battleLoading || submissionsLoading;
  const displaySubmissions = battle
    ? sortBattleSubmissionsForResult({ battle, submissions })
    : submissions;

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/batalhas/${params.battleId}`} className="mb-6 inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar para a batalha
      </Link>

      <div>
        <div className="flex items-center gap-2 text-yellow-400">
          <Trophy className="h-5 w-5" />
          Resultado
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">{battle.title}</h1>
        <p className="mt-1 text-surface-400">Resultado pelos votos da comunidade.</p>
      </div>

      <div className="mt-6 space-y-4">
        {submissions.length === 0 ? (
          <EmptyState title="Sem resultados ainda" description="Os resultados aparecerao quando houver assobios enviados." />
        ) : (
          displaySubmissions.map((submission) => {
            const winner = getBattleWinnerForSubmission({ battle, submission });
            const resultBreakdown = getBattleSubmissionResultBreakdown(submission);

            return (
              <Card key={submission.id}>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <MediaPreview
                      mediaType={submission.mediaType}
                      mediaURL={submission.mediaURL}
                      videoURL={submission.videoURL}
                      username={submission.userDisplayName ?? submission.userId}
                      category={submission.category}
                      durationSeconds={submission.mediaDurationSeconds}
                      voteCount={resultBreakdown.publicVoteCount}
                      size="compact"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {winner && (
                          <Badge variant="gold">
                            <Trophy className="mr-1 h-3 w-3" />
                            {getBattleWinnerBadgeLabel()}
                          </Badge>
                        )}
                        <Badge variant="purple">
                          {resultBreakdown.publicVoteCount}{' '}
                          {resultBreakdown.publicVoteCount === 1 ? 'voto' : 'votos'}
                        </Badge>
                        {resultBreakdown.hasCreatorVote && (
                          <Badge variant="default">Voto do Criador</Badge>
                        )}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-white">{submission.title}</h2>
                      {submission.description && (
                        <p className="mt-1 text-sm text-surface-400">{submission.description}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
