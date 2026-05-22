import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';

export interface ResolveBattleTieBreakInput {
  battleId: string;
  submissionId: string;
  actorUserId: string;
  now?: Date;
}

function getTimestampMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function getPublicVoteCount(submission: Record<string, any>) {
  if (typeof submission.publicVoteCount === 'number') return submission.publicVoteCount;
  const voteCount = typeof submission.voteCount === 'number' ? submission.voteCount : 0;
  const judgeVoteCount =
    typeof submission.judgeVoteCount === 'number' ? submission.judgeVoteCount : 0;
  return Math.max(0, voteCount - judgeVoteCount);
}

function getTopTiedSubmissionIds({
  submissions,
  confirmedUserIds,
}: {
  submissions: Array<Record<string, any>>;
  confirmedUserIds: Set<unknown>;
}) {
  const eligible = submissions
    .filter((submission) => confirmedUserIds.has(submission.userId))
    .map((submission) => ({
      id: String(submission.id ?? ''),
      publicVotes: getPublicVoteCount(submission),
    }))
    .filter((submission) => submission.id);

  if (eligible.length < 2) return [];
  const topVotes = Math.max(...eligible.map((submission) => submission.publicVotes));
  return eligible
    .filter((submission) => submission.publicVotes === topVotes)
    .map((submission) => submission.id);
}

export async function resolveBattleTieBreak(
  db: Firestore,
  { battleId, submissionId, actorUserId, now = new Date() }: ResolveBattleTieBreakInput,
) {
  if (!battleId) throw new ApiError(400, 'Batalha invalida');
  if (!submissionId) throw new ApiError(400, 'Submissao invalida');
  if (!actorUserId) throw new ApiError(401, 'Nao autorizado');

  return db.runTransaction(async (transaction) => {
    const battleRef = db.collection('battles').doc(battleId);
    const submissionRef = db.collection('submissions').doc(submissionId);
    const actorRef = db.collection('users').doc(actorUserId);

    const [battleDoc, submissionDoc, actorDoc] = await Promise.all([
      transaction.get(battleRef),
      transaction.get(submissionRef),
      transaction.get(actorRef),
    ]);

    if (!battleDoc.exists) throw new ApiError(404, 'Batalha nao encontrada');
    if (!submissionDoc.exists) throw new ApiError(404, 'Submissao nao encontrada');

    const battle = battleDoc.data()!;
    const submission = submissionDoc.data()!;
    const actor = actorDoc.exists ? actorDoc.data() : null;
    const isAdmin = actor?.role === 'admin';
    const isCreator = battle.createdBy === actorUserId;
    if (!isAdmin && !isCreator) {
      throw new ApiError(403, 'Apenas o criador ou admin pode desempatar esta batalha');
    }

    if (battle.status !== 'voting') {
      throw new ApiError(400, 'Batalha precisa estar em votacao para desempatar');
    }

    const votingEndMillis = getTimestampMillis(battle.votingEnd);
    if (!votingEndMillis) {
      throw new ApiError(400, 'Data de encerramento da votacao invalida');
    }
    if (now.getTime() < votingEndMillis) {
      throw new ApiError(400, 'Desempate liberado somente apos o fim da votacao');
    }

    if (submission.battleId !== battleId || submission.status !== 'approved') {
      throw new ApiError(400, 'Submissao indisponivel para desempate');
    }

    const existingTieBreak = await transaction.get(
      db
        .collection('votes')
        .where('battleId', '==', battleId)
        .where('voterType', '==', 'judge')
        .limit(1),
    );
    if (!existingTieBreak.empty) {
      throw new ApiError(409, 'Esta batalha ja possui desempate registrado');
    }

    const [submissionsSnapshot, entriesSnapshot] = await Promise.all([
      transaction.get(
        db
          .collection('submissions')
          .where('battleId', '==', battleId)
          .where('status', '==', 'approved'),
      ),
      transaction.get(
        db
          .collection('battleEntries')
          .where('battleId', '==', battleId)
          .where('status', '==', 'confirmed'),
      ),
    ]);

    const submissions = submissionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const entries = entriesSnapshot.docs.map((doc) => doc.data());
    const confirmedUserIds = new Set(entries.map((entry) => entry.userId).filter(Boolean));
    const topTiedSubmissionIds = getTopTiedSubmissionIds({ submissions, confirmedUserIds });
    if (topTiedSubmissionIds.length < 2) {
      throw new ApiError(400, 'Nao ha empate no topo para desempatar');
    }
    if (!topTiedSubmissionIds.includes(submissionId)) {
      throw new ApiError(400, 'Desempate deve escolher uma submissao empatada no topo');
    }

    const voteRef = db.collection('votes').doc();
    transaction.set(voteRef, {
      id: voteRef.id,
      battleId,
      submissionId,
      voterId: actorUserId,
      voterType: 'judge',
      weight: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(submissionRef, {
      judgeVoteCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { tieBreakVoteId: voteRef.id };
  });
}
