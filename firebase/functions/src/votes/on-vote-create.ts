import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

export const onVoteCreate = onDocumentCreated(
  {
    document: 'votes/{voteId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const voteData = snapshot.data();
    const { submissionId, battleId, voterId, weight = 1 } = voteData;

    const db = getFirestore();

    // Check for duplicate vote (one vote per user per battle)
    const existingVotes = await db
      .collection('votes')
      .where('battleId', '==', battleId)
      .where('voterId', '==', voterId)
      .get();

    // If there's more than one vote (including this one), delete the duplicate
    if (existingVotes.size > 1) {
      logger.warn(`Duplicate vote detected for voter ${voterId} in battle ${battleId}`);
      await snapshot.ref.delete();
      return;
    }

    // Increment vote count on the submission
    const submissionRef = db.collection('submissions').doc(submissionId);
    await submissionRef.update({
      voteCount: FieldValue.increment(weight),
    });

    logger.info(`Vote recorded: submission ${submissionId}, weight ${weight}`);
  },
);
