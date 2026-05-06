import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';

export interface CreateVoteInput {
  battleId: string;
  submissionId: string;
  voterId: string;
}

export async function createVote(
  db: Firestore,
  { battleId, submissionId, voterId }: CreateVoteInput,
) {
  if (!battleId) throw new ApiError(400, 'battleId e obrigatorio');
  if (!submissionId) throw new ApiError(400, 'submissionId e obrigatorio');

  return db.runTransaction(async (transaction) => {
    const battleRef = db.collection('battles').doc(battleId);
    const submissionRef = db.collection('submissions').doc(submissionId);

    const [battleDoc, submissionDoc] = await Promise.all([
      transaction.get(battleRef),
      transaction.get(submissionRef),
    ]);

    if (!battleDoc.exists) throw new ApiError(404, 'Batalha nao encontrada');
    if (!submissionDoc.exists) throw new ApiError(404, 'Submissao nao encontrada');

    const battle = battleDoc.data()!;
    const submission = submissionDoc.data()!;

    if (battle.status !== 'voting') {
      throw new ApiError(400, 'Votacao nao esta aberta para esta batalha');
    }

    if (submission.battleId !== battleId || submission.status !== 'approved') {
      throw new ApiError(400, 'Submissao indisponivel para votacao');
    }

    if (submission.userId === voterId) {
      throw new ApiError(400, 'Voce nao pode votar no proprio assobio');
    }

    const participantEntries = await transaction.get(
      db
        .collection('battleEntries')
        .where('battleId', '==', battleId)
        .where('userId', '==', voterId)
        .where('status', '==', 'confirmed')
        .limit(1),
    );

    if (!participantEntries.empty) {
      throw new ApiError(403, 'Participantes nao podem votar na propria batalha');
    }

    const voterType = battle.createdBy === voterId ? 'judge' : 'public';

    const existingVotes = await transaction.get(
      db
        .collection('votes')
        .where('battleId', '==', battleId)
        .where('voterId', '==', voterId)
        .limit(1),
    );

    if (!existingVotes.empty) {
      throw new ApiError(409, 'Voce ja votou nesta batalha');
    }

    const voteRef = db.collection('votes').doc();
    transaction.set(voteRef, {
      id: voteRef.id,
      battleId,
      submissionId,
      voterId,
      voterType,
      weight: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(submissionRef, {
      ...(voterType === 'judge'
        ? { judgeVoteCount: FieldValue.increment(1) }
        : {
            voteCount: FieldValue.increment(1),
            publicVoteCount: FieldValue.increment(1),
          }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { voteId: voteRef.id };
  });
}
