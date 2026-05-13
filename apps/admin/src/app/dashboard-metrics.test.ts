import { describe, expect, it } from 'vitest';
import type { Payment, User } from '@batalha/types';
import { getAdminDashboardMetrics } from './dashboard-metrics';

describe('admin dashboard metrics', () => {
  it('counts users, approved paid entries, and users created this week', () => {
    const now = new Date('2026-05-13T12:00:00.000Z');
    const users = [
      { id: 'user-1', createdAt: new Date('2026-05-13T10:00:00.000Z') },
      { id: 'user-2', createdAt: new Date('2026-05-08T10:00:00.000Z') },
      { id: 'user-3', createdAt: new Date('2026-05-01T10:00:00.000Z') },
      { id: 'user-4', createdAt: null },
    ] as User[];
    const payments = [
      { id: 'payment-1', status: 'approved', amount: 400 },
      { id: 'payment-2', status: 'pending', amount: 400 },
      { id: 'payment-3', status: 'approved', amount: 500 },
      { id: 'payment-4', status: 'rejected', amount: 400 },
    ] as Payment[];

    expect(getAdminDashboardMetrics(users, payments, now)).toEqual({
      totalUsers: 4,
      paidEntries: 2,
      newUsers: 2,
      totalRevenue: 900,
    });
  });
});
