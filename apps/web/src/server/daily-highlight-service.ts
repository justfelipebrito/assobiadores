import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { CompetitionCategory } from '@batalha/types';
import {
  DAILY_HIGHLIGHT_MAX_AUDIO_BYTES,
  DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS,
  DAILY_HIGHLIGHT_SUBMISSION_POINTS,
} from '@batalha/types';
import { calculateRank, detectVideoPlatform, isValidVideoURL } from '@batalha/utils';
import { ApiError } from './api-errors';

export interface CreateDailyHighlightInput {
  userId: string;
  videoURL: string;
  now?: Date;
}

export interface CreateDailyHighlightAudioInput {
  userId: string;
  audioURL: string;
  audioPath: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number;
  category: CompetitionCategory;
  now?: Date;
}

export interface LikeDailyHighlightInput {
  dailyHighlightId: string;
  userId: string;
}

export function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getSeasonId(date = new Date()) {
  return String(date.getUTCFullYear());
}

function getNestedSeasonPoints(user: Record<string, any>, seasonId: string, category: string) {
  return {
    seasonPoints: user.seasonPoints?.[seasonId]?.points ?? 0,
    seasonCategoryPoints: user.seasonCategoryPoints?.[seasonId]?.[category]?.points ?? 0,
  };
}

function buildSeasonScoreUpdate({
  user,
  seasonId,
  category,
  points,
}: {
  user: Record<string, any>;
  seasonId: string;
  category: string;
  points: number;
}) {
  const currentPoints = typeof user.points === 'number' ? user.points : 0;
  const nested = getNestedSeasonPoints(user, seasonId, category);
  const allTimeRank = calculateRank(currentPoints + points);
  const seasonRank = calculateRank(nested.seasonPoints + points);
  const categoryRank = calculateRank(nested.seasonCategoryPoints + points);

  return {
    points: FieldValue.increment(points),
    xp: FieldValue.increment(points),
    rank: allTimeRank,
    [`seasonPoints.${seasonId}.points`]: FieldValue.increment(points),
    [`seasonPoints.${seasonId}.xp`]: FieldValue.increment(points),
    [`seasonPoints.${seasonId}.rank`]: seasonRank,
    [`seasonPoints.${seasonId}.updatedAt`]: FieldValue.serverTimestamp(),
    [`seasonCategoryPoints.${seasonId}.${category}.points`]: FieldValue.increment(points),
    [`seasonCategoryPoints.${seasonId}.${category}.xp`]: FieldValue.increment(points),
    [`seasonCategoryPoints.${seasonId}.${category}.rank`]: categoryRank,
    [`seasonCategoryPoints.${seasonId}.${category}.updatedAt`]: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
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
    const category = 'freestyle';
    const seasonId = getSeasonId(now);
    const dailyHighlightRef = db.collection('dailyHighlights').doc();
    const dailyHighlight = {
      id: dailyHighlightRef.id,
      dayKey,
      userId,
      userDisplayName:
        typeof user.displayName === 'string' && user.displayName.trim()
          ? user.displayName
          : 'Assobiador',
      userBirthState:
        typeof user.birthState === 'string'
          ? user.birthState
          : typeof user.state === 'string'
            ? user.state
            : null,
      category,
      mediaType: 'video',
      mediaURL: videoURL,
      mediaPath: null,
      mediaContentType: null,
      mediaDurationSeconds: null,
      mediaSizeBytes: null,
      videoURL,
      videoPlatform: detectVideoPlatform(videoURL),
      status: 'active',
      voteCount: 0,
      pointsAwarded: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(dailyHighlightRef, dailyHighlight);
    transaction.update(
      userRef,
      buildSeasonScoreUpdate({
        user,
        seasonId,
        category,
        points: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      }),
    );

    return {
      dailyHighlightId: dailyHighlightRef.id,
      pointsAwarded: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
    };
  });
}

export async function createDailyHighlightFromAudio(
  db: Firestore,
  {
    userId,
    audioURL,
    audioPath,
    contentType,
    sizeBytes,
    durationSeconds,
    category,
    now = new Date(),
  }: CreateDailyHighlightAudioInput,
) {
  if (!userId) throw new ApiError(401, 'Nao autorizado');
  if (!audioURL || !audioPath) throw new ApiError(400, 'Audio invalido');
  if (!contentType.startsWith('audio/')) throw new ApiError(400, 'Envie um audio valido');
  if (sizeBytes > DAILY_HIGHLIGHT_MAX_AUDIO_BYTES) {
    throw new ApiError(400, 'Audio muito grande. Grave ate 2 minutos');
  }
  if (durationSeconds <= 0 || durationSeconds > DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS) {
    throw new ApiError(400, 'O audio precisa ter ate 2 minutos');
  }

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
    const seasonId = getSeasonId(now);
    const dailyHighlightRef = db.collection('dailyHighlights').doc();
    transaction.set(dailyHighlightRef, {
      id: dailyHighlightRef.id,
      dayKey,
      userId,
      userDisplayName:
        typeof user.displayName === 'string' && user.displayName.trim()
          ? user.displayName
          : 'Assobiador',
      userBirthState:
        typeof user.birthState === 'string'
          ? user.birthState
          : typeof user.state === 'string'
            ? user.state
            : null,
      category,
      mediaType: 'audio',
      mediaURL: audioURL,
      mediaPath: audioPath,
      mediaContentType: contentType,
      mediaDurationSeconds: Math.round(durationSeconds),
      mediaSizeBytes: sizeBytes,
      videoURL: audioURL,
      videoPlatform: 'other',
      status: 'active',
      voteCount: 0,
      pointsAwarded: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(
      userRef,
      buildSeasonScoreUpdate({
        user,
        seasonId,
        category,
        points: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      }),
    );

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
    const dayKey = typeof dailyHighlight.dayKey === 'string' ? dailyHighlight.dayKey : getDayKey();
    if (dailyHighlight.status !== 'active') {
      throw new ApiError(400, 'Destaque indisponivel para curtidas');
    }
    if (dailyHighlight.userId === userId) {
      throw new ApiError(400, 'Voce nao pode curtir o proprio destaque');
    }

    const likeRef = db.collection('dailyHighlightLikes').doc(`${dayKey}_${userId}`);
    const existingLike = await transaction.get(likeRef);
    if (existingLike.exists) {
      throw new ApiError(409, 'Voce ja votou em um destaque hoje');
    }

    transaction.set(likeRef, {
      id: likeRef.id,
      dayKey,
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
