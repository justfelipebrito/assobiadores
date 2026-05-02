import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { detectVideoPlatform, isValidVideoURL } from '@batalha/utils';
import { ApiError } from './api-errors';

export interface CreateSubmissionInput {
  battleId: string;
  userId: string;
  videoURL: string;
  title: string;
  description?: string;
}

export interface ModerateSubmissionInput {
  submissionId: string;
  moderatorId: string;
  status: 'approved' | 'rejected';
  moderationNote?: string | null;
}

async function requireAdmin(db: Firestore, userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem moderar submissoes');
  }
}

export async function createSubmission(
  db: Firestore,
  { battleId, userId, videoURL, title, description = '' }: CreateSubmissionInput,
) {
  if (!battleId) throw new ApiError(400, 'battleId e obrigatorio');
  if (!title.trim()) throw new ApiError(400, 'Titulo e obrigatorio');
  if (title.length > 200) throw new ApiError(400, 'Titulo muito longo');
  if (description.length > 1000) throw new ApiError(400, 'Descricao muito longa');
  if (!isValidVideoURL(videoURL)) throw new ApiError(400, 'URL de video invalida');

  const battleDoc = await db.collection('battles').doc(battleId).get();
  if (!battleDoc.exists) throw new ApiError(404, 'Batalha nao encontrada');

  const battle = battleDoc.data()!;
  if (battle.status !== 'active') {
    throw new ApiError(400, 'Submissoes nao estao abertas para esta batalha');
  }

  const entryQuery = await db
    .collection('battleEntries')
    .where('battleId', '==', battleId)
    .where('userId', '==', userId)
    .where('status', '==', 'confirmed')
    .limit(1)
    .get();

  if (entryQuery.empty) {
    throw new ApiError(403, 'Voce precisa estar inscrito nesta batalha para enviar video');
  }

  const existingSubmission = await db
    .collection('submissions')
    .where('battleId', '==', battleId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!existingSubmission.empty) {
    throw new ApiError(409, 'Voce ja enviou um video para esta batalha');
  }

  const userDoc = await db.collection('users').doc(userId).get();
  const userDisplayName =
    userDoc.exists && typeof userDoc.data()?.displayName === 'string'
      ? (userDoc.data()!.displayName as string)
      : userId;

  const submissionRef = db.collection('submissions').doc();
  const submission = {
    id: submissionRef.id,
    battleId,
    userId,
    userDisplayName,
    entryId: entryQuery.docs[0]!.id,
    videoURL,
    videoPlatform: detectVideoPlatform(videoURL),
    title: title.trim(),
    description: description.trim(),
    status: 'submitted',
    moderationNote: null,
    voteCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await submissionRef.set(submission);
  return { submissionId: submissionRef.id, status: submission.status };
}

export async function moderateSubmission(
  db: Firestore,
  { submissionId, moderatorId, status, moderationNote = null }: ModerateSubmissionInput,
) {
  if (!submissionId) throw new ApiError(400, 'submissionId e obrigatorio');
  await requireAdmin(db, moderatorId);

  const submissionRef = db.collection('submissions').doc(submissionId);
  const submissionDoc = await submissionRef.get();
  if (!submissionDoc.exists) throw new ApiError(404, 'Submissao nao encontrada');

  await submissionRef.update({
    status,
    moderationNote: moderationNote || null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { submissionId, status };
}
