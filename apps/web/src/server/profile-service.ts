import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { updateProfileSchema, type BrazilState, type UserAddress } from '@batalha/types';
import {
  hasProfileValidationErrors,
  isValidCpf,
  normalizeCpf,
  normalizePhone,
  validateOfficialProfileFields,
} from '../lib/profile-validation';
import { ApiError } from './api-errors';

export { isValidCpf };

const PROFILE_CHANGE_COOLDOWN_DAYS = 14;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function addCooldown(now: Date) {
  return Timestamp.fromDate(
    new Date(now.getTime() + PROFILE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000),
  );
}

function normalizeAddress(address?: Partial<UserAddress>) {
  if (!address) return {};
  return {
    postalCode: typeof address.postalCode === 'string' ? address.postalCode.trim() : '',
    street: typeof address.street === 'string' ? address.street.trim() : '',
    number: typeof address.number === 'string' ? address.number.trim() : '',
    city: typeof address.city === 'string' ? address.city.trim() : '',
  };
}

function hasAnyAddressValue(address: Partial<UserAddress> | undefined) {
  if (!address) return false;
  return Object.values(normalizeAddress(address)).some(Boolean);
}

function hasAddressChanged(
  currentAddress: Partial<UserAddress> | undefined,
  nextAddress: Partial<UserAddress> | undefined,
) {
  if (!nextAddress) return false;
  const current = normalizeAddress(currentAddress);
  const next = normalizeAddress(nextAddress);
  return Object.entries(next).some(
    ([key, value]) => current[key as keyof typeof current] !== value,
  );
}

export function normalizeUsername(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

export async function checkUsernameAvailability(
  db: Firestore,
  username: string,
  currentUserId?: string,
) {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3) {
    throw new ApiError(400, 'Username precisa ter pelo menos 3 caracteres');
  }

  const reservation = await db.collection('usernames').doc(normalized).get();
  if (reservation.exists) {
    const ownerId = reservation.data()?.userId;
    return { username: normalized, available: !ownerId || ownerId === currentUserId };
  }

  const existingUsers = await db
    .collection('users')
    .where('usernameLower', '==', normalized)
    .limit(1)
    .get();
  const existingUser = existingUsers.docs[0];

  return {
    username: normalized,
    available: !existingUser || existingUser.id === currentUserId,
  };
}

export async function updateUserProfile(db: Firestore, userId: string, body: unknown) {
  const parsed = updateProfileSchema.safeParse(body);
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

  const cpf = typeof input.cpf === 'string' ? normalizeCpf(input.cpf) : undefined;
  const validationErrors = validateOfficialProfileFields({
    cpf: input.cpf,
    phone: input.phone,
    address: input.address,
  });
  if (hasProfileValidationErrors(validationErrors)) {
    throw new ApiError(400, Object.values(validationErrors).find(Boolean) ?? 'Dados invalidos');
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
    const userRef = db.collection('users').doc(userId);
    const privateRef = db.collection('userPrivate').doc(userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new ApiError(404, 'Usuario nao encontrado');
    const privateDoc = await transaction.get(privateRef);

    const userData = userDoc.data() ?? {};
    const privateData = privateDoc.exists ? (privateDoc.data() ?? {}) : {};
    const currentUsername = userData.usernameLower as string | undefined;
    const now = new Date();
    const publicUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (normalizedUsername && normalizedUsername !== currentUsername) {
      const usernameCooldownUntil = toDate(userData.usernameChangeAvailableAt);
      if (usernameCooldownUntil && usernameCooldownUntil > now) {
        throw new ApiError(429, 'Username so pode ser alterado novamente em 14 dias');
      }

      const usernameRef = db.collection('usernames').doc(normalizedUsername);
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists && usernameDoc.data()?.userId !== userId) {
        throw new ApiError(409, 'Username indisponivel');
      }

      transaction.set(usernameRef, {
        userId,
        username: normalizedUsername,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (currentUsername) {
        transaction.delete(db.collection('usernames').doc(currentUsername));
      }
      publicUpdate.username = normalizedUsername;
      publicUpdate.usernameLower = normalizedUsername;
      publicUpdate.usernameChangeAvailableAt = addCooldown(now);
    }

    if (typeof input.firstName === 'string') publicUpdate.firstName = input.firstName.trim();
    if (typeof input.surname === 'string') publicUpdate.surname = input.surname.trim();
    if (typeof input.displayName === 'string') publicUpdate.displayName = input.displayName.trim();
    if (typeof input.bio === 'string') publicUpdate.bio = input.bio.trim();
    if ('birthState' in input) {
      const currentBirthState = userData.birthState as BrazilState | null | undefined;
      const nextBirthState = input.birthState as BrazilState | null;
      if (currentBirthState && nextBirthState && nextBirthState !== currentBirthState) {
        throw new ApiError(409, 'Naturalidade nao pode ser alterada depois de definida');
      }
      if (!currentBirthState) publicUpdate.birthState = nextBirthState;
    }

    const privateUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (cpf !== undefined) {
      const currentCpf = typeof privateData.cpf === 'string' ? normalizeCpf(privateData.cpf) : '';
      if (currentCpf && cpf && cpf !== currentCpf) {
        throw new ApiError(409, 'CPF nao pode ser alterado depois de definido');
      }
      if (!currentCpf) privateUpdate.cpf = cpf;
    }
    if (typeof input.phone === 'string') privateUpdate.phone = normalizePhone(input.phone);
    if (input.address) {
      const address = input.address as Partial<UserAddress>;
      const currentAddress = privateData.address as Partial<UserAddress> | undefined;
      const addressChanged = hasAddressChanged(currentAddress, address);
      if (addressChanged && hasAnyAddressValue(currentAddress)) {
        const addressCooldownUntil = toDate(userData.addressChangeAvailableAt);
        if (addressCooldownUntil && addressCooldownUntil > now) {
          throw new ApiError(429, 'Endereco so pode ser alterado novamente em 14 dias');
        }
      }
      if (addressChanged) {
        publicUpdate.addressChangeAvailableAt = addCooldown(now);
      }
      Object.entries(address).forEach(([key, value]) => {
        privateUpdate[`address.${key}`] = typeof value === 'string' ? value.trim() : value;
      });
    }

    transaction.set(userRef, publicUpdate, { merge: true });
    if (privateDoc.exists) {
      transaction.update(privateRef, privateUpdate);
    } else {
      transaction.set(
        privateRef,
        {
          id: userId,
          createdAt: FieldValue.serverTimestamp(),
          ...privateUpdate,
        },
        { merge: true },
      );
    }
  });

  return { ok: true, username: normalizedUsername };
}
