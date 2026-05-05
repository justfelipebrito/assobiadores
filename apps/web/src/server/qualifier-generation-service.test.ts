import { describe, expect, it, vi } from 'vitest';
import { generateQualifierBracket } from './qualifier-generation-service';

function docSnap(id: string, data: Record<string, unknown>, exists = true) {
  return {
    id,
    exists,
    data: () => data,
  };
}

function querySnapshot(docs: Array<ReturnType<typeof docSnap>> = []) {
  return {
    empty: docs.length === 0,
    docs,
  };
}

function query(snapshot: unknown) {
  const q = {
    where: vi.fn(() => q),
    limit: vi.fn(() => q),
    get: vi.fn(async () => snapshot),
  };
  return q;
}

function registrations(count: number) {
  return Array.from({ length: count }, (_, index) =>
    docSnap(`registration-${index + 1}`, {
      userId: `user-${index + 1}`,
      status: 'confirmed',
      createdAt: { seconds: index + 1 },
    }),
  );
}

function createDb({
  adminRole = 'admin',
  registrationDocs = registrations(100),
  existingMatches = [],
}: {
  adminRole?: string;
  registrationDocs?: Array<ReturnType<typeof docSnap>>;
  existingMatches?: Array<ReturnType<typeof docSnap>>;
} = {}) {
  let matchCounter = 0;
  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(),
  };
  const registrationsQuery = query(querySnapshot(registrationDocs));
  const matchesQuery = query(querySnapshot(existingMatches));

  const db = {
    batch: vi.fn(() => batch),
    collection: vi.fn((name: string) => {
      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => docSnap('admin-1', { role: adminRole })),
          })),
        };
      }
      if (name === 'qualifierRegistrations') {
        return {
          where: registrationsQuery.where,
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      if (name === 'qualifierMatches') {
        return {
          where: matchesQuery.where,
          doc: vi.fn(() => {
            matchCounter += 1;
            return { id: `match-${matchCounter}` };
          }),
        };
      }
      if (name === 'qualifierTracks') {
        return {
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, batch, registrationsQuery, matchesQuery };
}

describe('generateQualifierBracket', () => {
  it('creates first-round matches from confirmed registrations and assigns byes', async () => {
    const { db, batch, registrationsQuery, matchesQuery } = createDb();

    await expect(
      generateQualifierBracket(db as never, {
        adminUserId: 'admin-1',
        region: 'SP',
        category: 'freestyle',
      }),
    ).resolves.toEqual({
      participantCount: 100,
      matchCount: 36,
      byeCount: 28,
      dailyMatchLimit: 5,
      plannedMatchDays: 8,
      status: 'active',
    });

    expect(matchesQuery.where).toHaveBeenCalledWith('seasonId', '==', 'season-2026');
    expect(registrationsQuery.where).toHaveBeenCalledWith('status', '==', 'confirmed');
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^match-/) }),
      expect.objectContaining({
        seasonId: 'season-2026',
        region: 'SP',
        category: 'freestyle',
        roundNumber: 1,
        matchDayIndex: expect.any(Number),
        sequenceInDay: expect.any(Number),
        participantIds: expect.arrayContaining([expect.stringMatching(/^user-/)]),
        registrationIds: expect.arrayContaining([expect.stringMatching(/^registration-/)]),
        status: 'scheduled',
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-sp-2026-freestyle' }),
      expect.objectContaining({
        status: 'active',
        dailyMatchLimit: 5,
        plannedMatchDays: 8,
        plannedMatchCount: 36,
        currentRound: 1,
      }),
      { merge: true },
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^registration-/) }),
      expect.objectContaining({
        bracketStatus: expect.stringMatching(/active|waiting_draw/),
        currentRound: 1,
      }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('qualifies everyone immediately when the field is already at or below 64', async () => {
    const { db, batch } = createDb({ registrationDocs: registrations(50) });

    await expect(
      generateQualifierBracket(db as never, {
        adminUserId: 'admin-1',
        region: 'RJ',
        category: 'melodia',
      }),
    ).resolves.toEqual({
      participantCount: 50,
      matchCount: 0,
      byeCount: 50,
      dailyMatchLimit: 5,
      plannedMatchDays: 0,
      status: 'finished',
    });

    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-rj-2026-melodia' }),
      expect.objectContaining({
        status: 'finished',
        plannedMatchDays: 0,
        plannedMatchCount: 0,
      }),
      { merge: true },
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'registration-1' }),
      expect.objectContaining({ bracketStatus: 'qualified' }),
    );
  });

  it('rejects non-admin users and duplicate generation', async () => {
    await expect(
      generateQualifierBracket(createDb({ adminRole: 'user' }).db as never, {
        adminUserId: 'user-1',
        region: 'SP',
        category: 'freestyle',
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      generateQualifierBracket(
        createDb({ existingMatches: [docSnap('match-1', {})] }).db as never,
        {
          adminUserId: 'admin-1',
          region: 'SP',
          category: 'freestyle',
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
