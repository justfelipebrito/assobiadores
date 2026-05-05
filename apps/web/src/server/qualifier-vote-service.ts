import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';

export interface CreateQualifierVoteInput {
  matchId: string;
  submissionId: string;
  voterId: string;
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

export async function createQualifierVote(
  db: Firestore,
  { matchId, submissionId, voterId, now = new Date() }: CreateQualifierVoteInput,
) {
  if (!matchId) throw new ApiError(400, 'Confronto invalido');
  if (!submissionId) throw new ApiError(400, 'Envio invalido');
  if (!voterId) throw new ApiError(401, 'Nao autorizado');

  return db.runTransaction(async (transaction) => {
    const matchRef = db.collection('qualifierMatches').doc(matchId);
    const submissionRef = db.collection('qualifierSubmissions').doc(submissionId);
    const [matchDoc, submissionDoc] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(submissionRef),
    ]);

    if (!matchDoc.exists) throw new ApiError(404, 'Confronto nao encontrado');
    if (!submissionDoc.exists) throw new ApiError(404, 'Envio nao encontrado');

    const match = matchDoc.data()!;
    const submission = submissionDoc.data()!;

    if (match.status !== 'voting') {
      throw new ApiError(400, 'Votacao nao esta aberta para este confronto');
    }
    const votingStartMillis = getTimestampMillis(match.votingStart);
    const votingEndMillis = getTimestampMillis(match.votingEnd);
    if (votingStartMillis > 0 && now.getTime() < votingStartMillis) {
      throw new ApiError(400, 'Votacao ainda nao comecou');
    }
    if (votingEndMillis > 0 && now.getTime() > votingEndMillis) {
      throw new ApiError(400, 'Votacao encerrada');
    }
    if (submission.matchId !== matchId || submission.status !== 'submitted') {
      throw new ApiError(400, 'Envio indisponivel para votacao');
    }

    const participantIds = Array.isArray(match.participantIds) ? match.participantIds : [];
    if (participantIds.includes(voterId)) {
      throw new ApiError(403, 'Participantes nao podem votar em Classificatorias');
    }

    const votedUserId = String(submission.userId);
    const existingVotes = await transaction.get(
      db
        .collection('qualifierVotes')
        .where('matchId', '==', matchId)
        .where('voterId', '==', voterId)
        .limit(1),
    );
    if (!existingVotes.empty) {
      throw new ApiError(409, 'Voce ja votou neste confronto');
    }

    const voteRef = db.collection('qualifierVotes').doc();
    transaction.set(voteRef, {
      id: voteRef.id,
      matchId,
      submissionId,
      votedUserId,
      voterId,
      voterType: 'public',
      weight: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(submissionRef, {
      publicVoteCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(matchRef, {
      [`publicVoteCounts.${votedUserId}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { qualifierVoteId: voteRef.id };
  });
}
