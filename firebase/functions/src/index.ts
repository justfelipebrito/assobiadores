import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { onUserCreate } from './auth/on-user-create';
export { onPaymentWebhook } from './payments/webhook';
export { finalizeBattle } from './battles/finalize';
export { scheduledBattleStatusUpdater } from './battles/status-updater';
export { expirePayments } from './payments/expire';
export { finalizeMatch } from './championships/finalize-match';
export { finalizeChampionship } from './championships/finalize-championship';
