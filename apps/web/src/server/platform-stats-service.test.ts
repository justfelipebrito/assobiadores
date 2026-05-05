import { describe, expect, it, vi } from 'vitest';
import { getPlatformStats } from './platform-stats-service';

function collection(count: number) {
  return {
    count: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        data: () => ({ count }),
      }),
    })),
  };
}

describe('getPlatformStats', () => {
  it('uses aggregate counts instead of capped list lengths', async () => {
    const usersCollection = collection(203);
    const battlesCollection = collection(4);
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'users') return usersCollection;
        if (name === 'battles') return battlesCollection;
        throw new Error(`Unexpected collection ${name}`);
      }),
    };

    await expect(getPlatformStats(db as never)).resolves.toEqual({
      users: 203,
      battles: 4,
    });
    expect(db.collection).toHaveBeenCalledWith('users');
    expect(db.collection).toHaveBeenCalledWith('battles');
    expect(usersCollection.count).toHaveBeenCalledTimes(1);
    expect(battlesCollection.count).toHaveBeenCalledTimes(1);
  });
});
