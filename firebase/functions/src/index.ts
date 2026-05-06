import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { onPaymentWebhook } from './payments/webhook';
export { finalizeBattle } from './battles/finalize';
export { scheduledBattleStatusUpdater } from './battles/status-updater';
export { expirePayments } from './payments/expire';
export { finalizeDailyHighlights } from './daily-highlights/finalize';
export { finalizeDueQualifiers } from './qualifiers/finalize';
export { finalizeMatch } from './championships/finalize-match';
export { finalizeChampionship } from './championships/finalize-championship';
