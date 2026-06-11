import { describe, expect, it, vi } from 'vitest';
import { createBattleWinnerEmailDraft } from './admin-battle-winner-email-service';

function createDb({
  adminRole = 'admin',
  battleExists = true,
  winners = [{ userId: 'winner-1', place: 1, points: 20, prize: 1000 }],
  winnerEmail = 'winner@example.com',
}: {
  adminRole?: string;
  battleExists?: boolean;
  winners?: unknown[];
  winnerEmail?: string;
} = {}) {
  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) => ({
        get: vi.fn(async () => {
          if (name === 'users' && id === 'admin-1') {
            return { exists: true, data: () => ({ role: adminRole }) };
          }
          if (name === 'users') {
            return {
              exists: true,
              data: () => ({ displayName: 'Ana Winner', email: winnerEmail }),
            };
          }
          if (name === 'battles') {
            return {
              exists: battleExists,
              data: () => ({ title: 'Batalha Final', winners }),
            };
          }
          return { exists: false, data: () => ({}) };
        }),
      })),
    })),
  };

  return db;
}

describe('admin battle winner email service', () => {
  it('creates a prefilled winner email draft after validating admin and winner', async () => {
    const result = await createBattleWinnerEmailDraft(createDb() as never, {
      adminUserId: 'admin-1',
      battleId: 'battle-1',
      body: { winnerUserId: 'winner-1' },
    });

    expect(result).toMatchObject({
      winnerUserId: 'winner-1',
      email: 'winner@example.com',
      subject: 'Premiacao da batalha Batalha Final',
    });
    expect(result.message).toContain('Parabens por vencer a batalha "Batalha Final"');
    expect(result.mailtoHref).toContain('mailto:winner%40example.com?subject=');
  });

  it('blocks non-admin users', async () => {
    await expect(
      createBattleWinnerEmailDraft(createDb({ adminRole: 'user' }) as never, {
        adminUserId: 'user-1',
        battleId: 'battle-1',
        body: { winnerUserId: 'winner-1' },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects users who are not registered winners of the battle', async () => {
    await expect(
      createBattleWinnerEmailDraft(createDb() as never, {
        adminUserId: 'admin-1',
        battleId: 'battle-1',
        body: { winnerUserId: 'other-user' },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects winners without an account email', async () => {
    await expect(
      createBattleWinnerEmailDraft(createDb({ winnerEmail: '' }) as never, {
        adminUserId: 'admin-1',
        battleId: 'battle-1',
        body: { winnerUserId: 'winner-1' },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
