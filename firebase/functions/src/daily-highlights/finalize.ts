import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { finalizeDailyHighlightsForDay } from './finalize-handler';

export const finalizeDailyHighlights = onSchedule(
  {
    schedule: '5 22 * * *',
    region: 'southamerica-east1',
    timeZone: 'America/Sao_Paulo',
  },
  async () => {
    await finalizeDailyHighlightsForDay(getFirestore());
  },
);
