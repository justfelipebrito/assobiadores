import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { CompetitionCategory } from '@batalha/types';
import {
  DAILY_HIGHLIGHT_MAX_AUDIO_BYTES,
  DAILY_HIGHLIGHT_MAX_AUDIO_SECONDS,
  DAILY_HIGHLIGHT_SUBMISSION_POINTS,
} from '@batalha/types';
import { calculateRank } from '@batalha/utils';
import { ApiError } from './api-errors';
import { buildPointActivity } from './point-activity-service';
import { buildSeasonRankingIncrement, getSeasonRankingPath } from './season-ranking-service';

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
  originalAudioURL?: string;
  originalAudioPath?: string;
  originalContentType?: string;
  originalSizeBytes?: number;
  durationSeconds: number;
  category: CompetitionCategory;
  now?: Date;
}

export interface LikeDailyHighlightInput {
  dailyHighlightId: string;
  userId: string;
  now?: Date;
}

export function getDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
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

function getBrazilHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(date);

  return Number(hour);
}

export async function createDailyHighlight(
  db: Firestore,
  { userId, videoURL, now = new Date() }: CreateDailyHighlightInput,
) {
  void db;
  void userId;
  void videoURL;
  void now;
  throw new ApiError(400, 'Destaques Diarios aceitam apenas audio gravado na plataforma');
}

export async function createDailyHighlightFromAudio(
  db: Firestore,
  {
    userId,
    audioURL,
    audioPath,
    contentType,
    sizeBytes,
    originalAudioURL,
    originalAudioPath,
    originalContentType,
    originalSizeBytes,
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
      mediaOriginalURL: originalAudioURL ?? audioURL,
      mediaOriginalPath: originalAudioPath ?? audioPath,
      mediaOriginalContentType: originalContentType ?? contentType,
      mediaOriginalSizeBytes: originalSizeBytes ?? sizeBytes,
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
    const pointActivity = buildPointActivity({
      userId,
      points: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      reason: 'daily_highlight_submission',
      label: 'Envio em Destaques Diarios',
      sourceType: 'daily_highlight',
      sourceId: dailyHighlightRef.id,
      sourceTitle: 'Destaques Diarios',
      category,
      seasonId,
    });
    transaction.set(db.collection('pointActivities').doc(pointActivity.id), pointActivity);
    transaction.update(
      userRef,
      buildSeasonScoreUpdate({
        user,
        seasonId,
        category,
        points: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      }),
    );
    transaction.set(
      db.doc(getSeasonRankingPath(seasonId, userId)),
      buildSeasonRankingIncrement({
        user,
        seasonId,
        category,
        points: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
      }),
      { merge: true },
    );

    return {
      dailyHighlightId: dailyHighlightRef.id,
      pointsAwarded: DAILY_HIGHLIGHT_SUBMISSION_POINTS,
    };
  });
}

export async function likeDailyHighlight(
  db: Firestore,
  { dailyHighlightId, userId, now = new Date() }: LikeDailyHighlightInput,
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
      throw new ApiError(400, 'Votacao encerrada para este destaque');
    }
    if (getBrazilHour(now) >= 22) {
      throw new ApiError(400, 'A votacao dos destaques diarios encerra as 22:00');
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
