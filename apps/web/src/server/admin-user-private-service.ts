import type { Firestore } from 'firebase-admin/firestore';
import { ApiError } from './api-errors';

export interface AdminUserPrivateSummary {
  userId: string;
  pixKey: string;
  hasCpf: boolean;
  hasPhone: boolean;
}

async function assertAdmin(db: Firestore, adminUserId: string) {
  if (!adminUserId) throw new ApiError(401, 'Nao autorizado');

  const adminDoc = await db.collection('users').doc(adminUserId).get();
  if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
    throw new ApiError(403, 'Apenas administradores podem ver dados privados de usuarios');
  }
}

function hasValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function listAdminUserPrivateSummaries(
  db: Firestore,
  { adminUserId }: { adminUserId: string },
) {
  await assertAdmin(db, adminUserId);

  const snapshot = await db.collection('userPrivate').get();
  const profiles: AdminUserPrivateSummary[] = snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};

    return {
      userId: doc.id,
      pixKey: hasValue(data.pixKey) ? String(data.pixKey).trim() : '',
      hasCpf: hasValue(data.cpf),
      hasPhone: hasValue(data.phone),
    };
  });

  return { profiles };
}
