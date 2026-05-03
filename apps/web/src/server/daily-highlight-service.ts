import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { DAILY_HIGHLIGHT_SUBMISSION_POINTS } from '@batalha/types';
import { detectVideoPlatform, isValidVideoURL } from '@batalha/utils';
import { ApiError } from './api-errors';

export interface CreateDailyHighlightInput {
  userId: string;
  videoURL: string;
  now?: Date;
}

export interface LikeDailyHighlightInput {
  dailyHighlightId: string;
  userId: string;
}

function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function createDailyHighlight(
  db: Firestore,
  { userId, videoURL, now = new Date() }: CreateDailyHighlightInput,
) {
  if (!userId) throw new ApiError(401, 'Nao autorizado');
  if (!isValidVideoURL(videoURL)) throw new ApiError(400, 'URL de video invalida');

  const dayKey = getDayKey(now);

  return db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new ApiError(404, 'Usuario nao encontrado');

    const existingSubmission = await transaction.get(
      db
        .collection('dailyHighlights')
        .where('dayKey', '==', dayKey)
        .where('userId', '==', userId)
        .limit(1),
    );
    if (!existingSubmission.empty) {
      throw new ApiError(409, 'Voce ja enviou seu destaque de hoje');
    }

    const user = userDoc.data()!;
    const dailyHighlightRef = db.collection('dailyHighlights').doc();
    const dailyHighlight = {
      id: dailyHighlightRef.id,
      dayKey,
      userId,
      userDisplayName:
        typeof user.displayName === 'string' && user.displayName.trim()
          ? user.displayName
          : 'Assobiador',
      videoURL,
      videoPlatform: detectVideoPlatform(videoURL),
      status: 'active',
      voteCount: 0,
      pointsAwarded: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(dailyHighlightRef, dailyHighlight);
    transaction.update(userRef, {
      casualPoints: FieldValue.increment(DAILY_HIGHLIGHT_SUBMISSION_POINTS),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      dailyHighlightId: dailyHighlightRef.id,
      pointsAwarded: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
    };
  });
}

export async function likeDailyHighlight(
  db: Firestore,
  { dailyHighlightId, userId }: LikeDailyHighlightInput,
) {
  if (!dailyHighlightId) throw new ApiError(400, 'dailyHighlightId e obrigatorio');
  if (!userId) throw new ApiError(401, 'Nao autorizado');

  return db.runTransaction(async (transaction) => {
    const dailyHighlightRef = db.collection('dailyHighlights').doc(dailyHighlightId);
    const dailyHighlightDoc = await transaction.get(dailyHighlightRef);
    if (!dailyHighlightDoc.exists) throw new ApiError(404, 'Destaque nao encontrado');

    const dailyHighlight = dailyHighlightDoc.data()!;
    if (dailyHighlight.status !== 'active') {
      throw new ApiError(400, 'Destaque indisponivel para curtidas');
    }
    if (dailyHighlight.userId === userId) {
      throw new ApiError(400, 'Voce nao pode curtir o proprio destaque');
    }

    const existingLike = await transaction.get(
      db
        .collection('dailyHighlightLikes')
        .where('dailyHighlightId', '==', dailyHighlightId)
        .where('userId', '==', userId)
        .limit(1),
    );
    if (!existingLike.empty) {
      throw new ApiError(409, 'Voce ja curtiu este destaque');
    }

    const likeRef = db.collection('dailyHighlightLikes').doc();
    transaction.set(likeRef, {
      id: likeRef.id,
      dailyHighlightId,
      userId,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(dailyHighlightRef, {
      voteCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { likeId: likeRef.id };
  });
}
