import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { finalizeDueQualifierMatches } from './finalize-handler';

export const finalizeDueQualifiers = onSchedule(
  {
    schedule: '*/5 * * * *',
    region: 'southamerica-east1',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    await finalizeDueQualifierMatches(getFirestore());
  },
);
