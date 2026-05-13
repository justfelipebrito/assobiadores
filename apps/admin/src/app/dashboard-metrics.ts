import type { Payment, User } from '@batalha/types';
import { toDate } from '@batalha/utils';

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

export function getAdminDashboardMetrics(users: User[], payments: Payment[], now = new Date()) {
  const weekStart = now.getTime() - WEEK_IN_MS;
  const paidEntries = payments.filter((payment) => payment.status === 'approved').length;
  const newUsers = users.filter((user) => {
    const createdAt = toDate(user.createdAt);
    return createdAt ? createdAt.getTime() >= weekStart : false;
  }).length;
  const totalRevenue = payments
    .filter((payment) => payment.status === 'approved')
    .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    totalUsers: users.length,
    paidEntries,
    newUsers,
    totalRevenue,
  };
}
