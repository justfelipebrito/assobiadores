import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';

export const AVATAR_REPLACEMENT_COOLDOWN_DAYS = 14;
export const MAX_AVATAR_UPLOAD_BYTES = 250 * 1024;

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/webp']);

type AvatarBucket = {
  name: string;
  file: (path: string) => {
    save: (buffer: Buffer, options?: any) => Promise<unknown>;
    delete: () => Promise<unknown>;
  };
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function getDownloadUrl(bucket: AvatarBucket, path: string, token: string) {
  const encodedPath = encodeURIComponent(path);
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const host = emulatorHost ? `http://${emulatorHost}` : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

function getAvatarExtension(contentType: string) {
  return contentType === 'image/webp' ? 'webp' : 'jpg';
}

export async function uploadUserAvatar({
  db,
  bucket,
  userId,
  buffer,
  contentType,
}: {
  db: Firestore;
  bucket: AvatarBucket;
  userId: string;
  buffer: Buffer;
  contentType: string;
}) {
  if (!ALLOWED_AVATAR_TYPES.has(contentType)) {
    throw new ApiError(400, 'Envie uma imagem JPG ou WebP');
  }
  if (buffer.length > MAX_AVATAR_UPLOAD_BYTES) {
    throw new ApiError(400, 'Imagem muito grande. Envie uma foto com ate 250 KB');
  }

  const now = new Date();
  const availableAt = new Date(
    now.getTime() + AVATAR_REPLACEMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );
  const token = randomUUID();
  const extension = getAvatarExtension(contentType);
  const photoPath = `users/${userId}/profile/avatar-${randomUUID()}.${extension}`;
  const photoURL = getDownloadUrl(bucket, photoPath, token);
  const file = bucket.file(photoPath);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  try {
    let result:
      | {
          photoURL: string;
          photoPath: string;
          photoVersion: number;
          photoChangeAvailableAt: Date;
        }
      | undefined;

    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new ApiError(404, 'Usuario nao encontrado');
      }

      const user = userDoc.data() ?? {};
      const currentPhotoPath = typeof user.photoPath === 'string' ? user.photoPath : null;
      const cooldownUntil = currentPhotoPath ? toDate(user.photoChangeAvailableAt) : null;
      if (cooldownUntil && cooldownUntil > now) {
        throw new ApiError(429, 'Voce podera trocar a foto novamente em 14 dias');
      }

      const photoVersion = Number(user.photoVersion ?? 0) + 1;
      transaction.update(userRef, {
        photoURL,
        photoPath,
        photoVersion,
        photoUpdatedAt: FieldValue.serverTimestamp(),
        photoChangeAvailableAt: Timestamp.fromDate(availableAt),
        updatedAt: FieldValue.serverTimestamp(),
      });

      result = { photoURL, photoPath, photoVersion, photoChangeAvailableAt: availableAt };
    });

    if (!result) {
      throw new ApiError(500, 'Erro ao atualizar foto');
    }

    return result;
  } catch (error) {
    await file.delete().catch(() => undefined);
    throw error;
  }
}
