import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  DAILY_HIGHLIGHT_MAX_AUDIO_BYTES,
  DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS,
  type CompetitionCategory,
} from '@batalha/types';
import { ApiError } from './api-errors';
import type { SubmissionReportReason } from '@batalha/types';

export interface CreateSubmissionInput {
  battleId: string;
  userId: string;
  audioURL: string;
  audioPath: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number;
  category?: CompetitionCategory;
  title?: string;
  description?: string;
  now?: Date;
}

export interface ModerateSubmissionInput {
  submissionId: string;
  moderatorId: string;
  moderationNote?: string | null;
}

export interface ReportSubmissionInput {
  submissionId: string;
  reporterId: string;
  reason: SubmissionReportReason;
  description?: string;
}

const REPORT_REASONS = new Set<SubmissionReportReason>([
  'spam',
  'offensive',
  'copyright',
  'invalid_media',
  'platform_rules',
  'other',
]);

async function requireAdmin(db: Firestore, userId: string) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem moderar submissoes');
  }
}

export async function createSubmission(
  db: Firestore,
  {
    battleId,
    userId,
    audioURL,
    audioPath,
    contentType,
    sizeBytes,
    durationSeconds,
    category = 'freestyle',
    title = 'Assobio enviado',
    description = '',
    now = new Date(),
  }: CreateSubmissionInput,
) {
  if (!battleId) throw new ApiError(400, 'battleId e obrigatorio');
  if (title.length > 200) throw new ApiError(400, 'Titulo muito longo');
  if (description.length > 1000) throw new ApiError(400, 'Descricao muito longa');
  if (!audioURL || !audioPath) throw new ApiError(400, 'Audio invalido');
  if (!contentType.startsWith('audio/')) throw new ApiError(400, 'Envie um audio valido');
  if (sizeBytes > DAILY_HIGHLIGHT_MAX_AUDIO_BYTES) {
    throw new ApiError(400, 'Audio muito grande. Grave ate 2 minutos');
  }
  if (durationSeconds <= 0 || durationSeconds > DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS) {
    throw new ApiError(400, 'O audio precisa ter ate 2 minutos');
  }

  const battleDoc = await db.collection('battles').doc(battleId).get();
  if (!battleDoc.exists) throw new ApiError(404, 'Batalha nao encontrada');

  const battle = battleDoc.data()!;
  if (!['registration', 'active'].includes(battle.status)) {
    throw new ApiError(400, 'Submissoes nao estao abertas para esta batalha');
  }
  const submissionDeadline =
    typeof battle.submissionDeadline?.toDate === 'function'
      ? battle.submissionDeadline.toDate()
      : battle.submissionDeadline instanceof Date
        ? battle.submissionDeadline
        : null;
  if (submissionDeadline && now.getTime() > submissionDeadline.getTime()) {
    throw new ApiError(400, 'Prazo de envio encerrado');
  }

  const entryQuery = await db
    .collection('battleEntries')
    .where('battleId', '==', battleId)
    .where('userId', '==', userId)
    .where('status', '==', 'confirmed')
    .limit(1)
    .get();

  if (entryQuery.empty) {
    throw new ApiError(403, 'Voce precisa estar inscrito nesta batalha para enviar assobio');
  }

  const existingSubmission = await db
    .collection('submissions')
    .where('battleId', '==', battleId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!existingSubmission.empty) {
    throw new ApiError(409, 'Voce ja enviou um audio para esta batalha');
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
    category,
    mediaType: 'audio',
    mediaURL: audioURL,
    mediaPath: audioPath,
    mediaContentType: contentType,
    mediaDurationSeconds: Math.round(durationSeconds),
    mediaSizeBytes: sizeBytes,
    videoURL: audioURL,
    videoPlatform: 'other',
    title: title.trim(),
    description: description.trim(),
    status: 'approved',
    moderationNote: null,
    voteCount: 0,
    reportCount: 0,
    removedAt: null,
    removedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await submissionRef.set(submission);
  return { submissionId: submissionRef.id, status: submission.status };
}

export async function removeSubmission(
  db: Firestore,
  { submissionId, moderatorId, moderationNote = null }: ModerateSubmissionInput,
) {
  if (!submissionId) throw new ApiError(400, 'submissionId e obrigatorio');
  await requireAdmin(db, moderatorId);

  const submissionRef = db.collection('submissions').doc(submissionId);
  const submissionDoc = await submissionRef.get();
  if (!submissionDoc.exists) throw new ApiError(404, 'Submissao nao encontrada');

  await submissionRef.update({
    status: 'removed',
    moderationNote: moderationNote || null,
    removedAt: FieldValue.serverTimestamp(),
    removedBy: moderatorId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { submissionId, status: 'removed' };
}

export async function reportSubmission(
  db: Firestore,
  { submissionId, reporterId, reason, description = '' }: ReportSubmissionInput,
) {
  if (!submissionId) throw new ApiError(400, 'submissionId e obrigatorio');
  if (!reporterId) throw new ApiError(401, 'Faca login para denunciar');
  if (!REPORT_REASONS.has(reason)) throw new ApiError(400, 'Motivo invalido');
  if (description.length > 500) throw new ApiError(400, 'Descricao muito longa');

  const submissionRef = db.collection('submissions').doc(submissionId);
  const submissionDoc = await submissionRef.get();
  if (!submissionDoc.exists) throw new ApiError(404, 'Submissao nao encontrada');

  const submission = submissionDoc.data()!;
  if (submission.status === 'removed') {
    throw new ApiError(400, 'Este envio ja foi removido');
  }
  if (submission.userId === reporterId) {
    throw new ApiError(400, 'Voce nao pode denunciar seu proprio envio');
  }

  const existingReport = await db
    .collection('submissionReports')
    .where('submissionId', '==', submissionId)
    .where('reporterId', '==', reporterId)
    .limit(1)
    .get();

  if (!existingReport.empty) {
    throw new ApiError(409, 'Voce ja denunciou este envio');
  }

  const reportRef = db.collection('submissionReports').doc();
  await reportRef.set({
    id: reportRef.id,
    submissionId,
    battleId: submission.battleId,
    reporterId,
    reportedUserId: submission.userId,
    reason,
    description: description.trim(),
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
  });

  await submissionRef.update({
    reportCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { reportId: reportRef.id, status: 'open' };
}
