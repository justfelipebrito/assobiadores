import type { Firestore } from 'firebase-admin/firestore';

export type PlatformStats = {
  users: number;
  battles: number;
};

export async function getPlatformStats(db: Firestore): Promise<PlatformStats> {
  const [usersSnapshot, battlesSnapshot] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('battles').count().get(),
  ]);

  return {
    users: usersSnapshot.data().count,
    battles: battlesSnapshot.data().count,
  };
}
