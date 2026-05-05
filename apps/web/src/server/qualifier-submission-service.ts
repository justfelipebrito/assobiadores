import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  DAILY_HIGHLIGHT_MAX_AUDIO_BYTES,
  DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS,
  type CompetitionCategory,
} from '@batalha/types';
import { ApiError } from './api-errors';

export interface CreateQualifierSubmissionInput {
  matchId: string;
  userId: string;
  audioURL: string;
  audioPath: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number;
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

function getUserDisplayName(user: Record<string, unknown>) {
  const displayName = user.displayName;
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  const username = user.username;
  if (typeof username === 'string' && username.trim()) return username.trim();
  return 'Assobiador';
}

export async function createQualifierSubmission(
  db: Firestore,
  {
    matchId,
    userId,
    audioURL,
    audioPath,
    contentType,
    sizeBytes,
    durationSeconds,
    now = new Date(),
  }: CreateQualifierSubmissionInput,
) {
  if (!matchId) throw new ApiError(400, 'Confronto invalido');
  if (!userId) throw new ApiError(401, 'Nao autorizado');
  if (!audioURL || !audioPath) throw new ApiError(400, 'Audio invalido');
  if (!contentType.startsWith('audio/')) throw new ApiError(400, 'Envie um audio valido');
  if (sizeBytes > DAILY_HIGHLIGHT_MAX_AUDIO_BYTES) {
    throw new ApiError(400, 'Audio muito grande. Grave ate 2 minutos');
  }
  if (durationSeconds <= 0 || durationSeconds > DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS) {
    throw new ApiError(400, 'O audio precisa ter ate 2 minutos');
  }

  return db.runTransaction(async (transaction) => {
    const matchRef = db.collection('qualifierMatches').doc(matchId);
    const matchDoc = await transaction.get(matchRef);
    if (!matchDoc.exists) throw new ApiError(404, 'Confronto nao encontrado');

    const match = matchDoc.data()!;
    if (match.status !== 'submissions_open') {
      throw new ApiError(400, 'Envio indisponivel para este confronto');
    }

    const deadlineMillis = getTimestampMillis(match.submissionDeadline);
    if (deadlineMillis > 0 && now.getTime() > deadlineMillis) {
      throw new ApiError(400, 'Prazo de envio encerrado');
    }

    const participantIds = Array.isArray(match.participantIds) ? match.participantIds : [];
    if (!participantIds.includes(userId)) {
      throw new ApiError(403, 'Voce nao participa deste confronto');
    }

    const existingSubmissionIds =
      typeof match.submissionIds === 'object' && match.submissionIds !== null
        ? (match.submissionIds as Record<string, string>)
        : {};
    if (existingSubmissionIds[userId]) {
      throw new ApiError(409, 'Voce ja enviou seu assobio para este confronto');
    }

    const registrationIds = Array.isArray(match.registrationIds) ? match.registrationIds : [];
    const registrationRefs = registrationIds.map((registrationId: string) =>
      db.collection('qualifierRegistrations').doc(registrationId),
    );
    const registrationDocs = await Promise.all(registrationRefs.map((ref) => transaction.get(ref)));
    const registrationDoc = registrationDocs.find((doc) => {
      const data = doc.exists ? doc.data() : null;
      return data?.userId === userId && data?.status === 'confirmed';
    });
    if (!registrationDoc) {
      throw new ApiError(403, 'Inscricao confirmada nao encontrada para este confronto');
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new ApiError(404, 'Usuario nao encontrado');

    const submissionRef = db.collection('qualifierSubmissions').doc();
    const submission = {
      id: submissionRef.id,
      matchId,
      registrationId: registrationDoc.id,
      seasonId: String(match.seasonId),
      category: match.category as CompetitionCategory,
      region: String(match.region),
      roundNumber: Number(match.roundNumber ?? 1),
      userId,
      userDisplayName: getUserDisplayName(userDoc.data() ?? {}),
      mediaType: 'audio',
      mediaURL: audioURL,
      mediaPath: audioPath,
      mediaContentType: contentType,
      mediaDurationSeconds: Math.round(durationSeconds),
      mediaSizeBytes: sizeBytes,
      status: 'submitted',
      publicVoteCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(submissionRef, submission);
    transaction.update(matchRef, {
      [`submissionIds.${userId}`]: submissionRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(registrationDoc.ref, {
      bracketStatus: 'active',
      currentMatchId: matchId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      qualifierSubmissionId: submissionRef.id,
      matchId,
    };
  });
}
