import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ApiError } from './api-errors';
import { normalizeUsername } from './profile-service';

const adminUserProfileUpdateSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  firstName: z.string().max(80).optional(),
  surname: z.string().max(120).optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(280).optional(),
});

function isReservationOwnedBy(data: Record<string, unknown> | undefined, userId: string) {
  return data?.userId === userId || data?.uid === userId;
}

export async function updateUserProfileAsAdmin(
  db: Firestore,
  {
    adminUserId,
    targetUserId,
    body,
  }: {
    adminUserId: string;
    targetUserId: string;
    body: unknown;
  },
) {
  if (!adminUserId) throw new ApiError(401, 'Nao autorizado');
  if (!targetUserId) throw new ApiError(400, 'Usuario alvo obrigatorio');

  const parsed = adminUserProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    throw new ApiError(400, first?.message ?? 'Dados invalidos');
  }

  const input = parsed.data;
  const normalizedUsername =
    typeof input.username === 'string' ? normalizeUsername(input.username) : undefined;
  if (input.username && (!normalizedUsername || normalizedUsername.length < 3)) {
    throw new ApiError(400, 'Username precisa ter pelo menos 3 caracteres');
  }

  if (typeof input.firstName === 'string' && !input.firstName.trim()) {
    throw new ApiError(400, 'Nome e obrigatorio');
  }
  if (typeof input.surname === 'string' && !input.surname.trim()) {
    throw new ApiError(400, 'Sobrenome e obrigatorio');
  }
  if (typeof input.displayName === 'string' && !input.displayName.trim()) {
    throw new ApiError(400, 'Nome de exibicao e obrigatorio');
  }

  await db.runTransaction(async (transaction) => {
    const adminRef = db.collection('users').doc(adminUserId);
    const targetRef = db.collection('users').doc(targetUserId);
    const adminDoc = await transaction.get(adminRef);
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      throw new ApiError(403, 'Apenas administradores podem editar usuarios');
    }

    const targetDoc = await transaction.get(targetRef);
    if (!targetDoc.exists) throw new ApiError(404, 'Usuario nao encontrado');
    const targetData = targetDoc.data() ?? {};
    const currentUsername = targetData.usernameLower as string | undefined;

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      profileCorrectedBy: adminUserId,
      profileCorrectedAt: FieldValue.serverTimestamp(),
    };

    if (normalizedUsername && normalizedUsername !== currentUsername) {
      const usernameRef = db.collection('usernames').doc(normalizedUsername);
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists && !isReservationOwnedBy(usernameDoc.data(), targetUserId)) {
        throw new ApiError(409, 'Username indisponivel');
      }

      transaction.set(usernameRef, {
        userId: targetUserId,
        uid: targetUserId,
        username: normalizedUsername,
        usernameLower: normalizedUsername,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (currentUsername) transaction.delete(db.collection('usernames').doc(currentUsername));
      update.username = normalizedUsername;
      update.usernameLower = normalizedUsername;
      update.usernameChangeAvailableAt = null;
    }

    if (typeof input.firstName === 'string') update.firstName = input.firstName.trim();
    if (typeof input.surname === 'string') update.surname = input.surname.trim();
    if (typeof input.displayName === 'string') update.displayName = input.displayName.trim();
    if (typeof input.bio === 'string') update.bio = input.bio.trim();

    transaction.set(targetRef, update, { merge: true });
  });

  return { ok: true, userId: targetUserId, username: normalizedUsername };
}
