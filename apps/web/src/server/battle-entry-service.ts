import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { checkBattleEntryEligibility } from '@batalha/utils';
import { ApiError } from './api-errors';

interface CreateFreeBattleEntryInput {
  battleId: string;
  userId: string;
}

export async function createFreeBattleEntry(
  db: Firestore,
  { battleId, userId }: CreateFreeBattleEntryInput,
) {
  if (!battleId) {
    throw new ApiError(400, 'battleId e obrigatorio');
  }

  return db.runTransaction(async (transaction) => {
    const battleRef = db.collection('battles').doc(battleId);
    const battleDoc = await transaction.get(battleRef);

    if (!battleDoc.exists) {
      throw new ApiError(404, 'Batalha nao encontrada');
    }

    const battle = battleDoc.data()!;
    if (battle.createdBy === userId) {
      throw new ApiError(403, 'Criadores nao podem participar da propria batalha');
    }
    if (battle.visibility === 'invite_only') {
      throw new ApiError(403, 'Esta batalha aceita apenas participantes convidados');
    }

    const existingEntries = await transaction.get(
      db
        .collection('battleEntries')
        .where('battleId', '==', battleId)
        .where('userId', '==', userId)
        .where('status', 'in', ['pending_payment', 'confirmed'])
        .limit(1),
    );

    const eligibility = checkBattleEntryEligibility({
      status: battle.status,
      entryFee: battle.entryFee ?? 0,
      maxParticipants: battle.maxParticipants ?? 0,
      currentParticipants: battle.currentParticipants ?? 0,
      hasExistingEntry: !existingEntries.empty,
      mode: 'free',
    });

    if (!eligibility.allowed) {
      const status =
        eligibility.code === 'already_joined'
          ? 409
          : eligibility.code === 'battle_full'
            ? 409
            : 400;

      throw new ApiError(status, eligibility.message ?? 'Nao foi possivel participar');
    }

    const userDoc = await transaction.get(db.collection('users').doc(userId));
    const user = userDoc.exists ? userDoc.data() : null;
    const userDisplayName =
      typeof user?.displayName === 'string' && user.displayName.trim()
        ? user.displayName.trim()
        : typeof user?.username === 'string' && user.username.trim()
          ? user.username.trim()
          : undefined;

    const entryRef = db.collection('battleEntries').doc();
    transaction.set(entryRef, {
      id: entryRef.id,
      battleId,
      userId,
      ...(userDisplayName ? { userDisplayName } : {}),
      paymentId: null,
      status: 'confirmed',
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(battleRef, {
      currentParticipants: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { entryId: entryRef.id };
  });
}
