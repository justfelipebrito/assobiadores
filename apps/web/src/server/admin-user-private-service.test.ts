import { describe, expect, it, vi } from 'vitest';
import { listAdminUserPrivateSummaries } from './admin-user-private-service';

function createDb({ adminRole = 'admin' }: { adminRole?: string } = {}) {
  const userPrivateDocs = [
    {
      id: 'user-1',
      data: () => ({ pixKey: ' ana@example.com ', cpf: '52998224725', phone: '' }),
    },
    {
      id: 'user-2',
      data: () => ({ pixKey: '', cpf: '', phone: '11999999999' }),
    },
  ];
  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({ exists: true, data: () => ({ role: adminRole }) })),
          })),
        };
      }

      return {
        get: vi.fn(async () => ({ docs: userPrivateDocs })),
      };
    }),
  };

  return db;
}

describe('admin user private service', () => {
  it('lists minimal private payout/profile readiness summaries for admins', async () => {
    await expect(
      listAdminUserPrivateSummaries(createDb() as never, { adminUserId: 'admin-1' }),
    ).resolves.toEqual({
      profiles: [
        { userId: 'user-1', pixKey: 'ana@example.com', hasCpf: true, hasPhone: false },
        { userId: 'user-2', pixKey: '', hasCpf: false, hasPhone: true },
      ],
    });
  });

  it('blocks non-admin users from private payout data', async () => {
    await expect(
      listAdminUserPrivateSummaries(createDb({ adminRole: 'user' }) as never, {
        adminUserId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
