import { describe, expect, it, vi } from 'vitest';
import { migrateQualifierEntriesToMiniKnockout } from './qualifier-mini-migration-service';

function docSnap(id: string, data: Record<string, unknown>, exists = true) {
  return {
    id,
    exists,
    ref: { id },
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
      seasonId: 'season-2026',
      category: 'freestyle',
      region: index % 2 === 0 ? 'SP' : 'RJ',
      status: 'confirmed',
      paymentId: `payment-${index + 1}`,
      entryFeeCents: 400,
      createdAt: { seconds: index + 1 },
    }),
  );
}

function createDb({
  adminRole = 'admin',
  registrationDocs = registrations(10),
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
          doc: vi.fn((id: string) => ({
            id,
            get: vi.fn(async () =>
              docSnap(id, {
                role: id === 'admin-1' ? adminRole : 'user',
                displayName: `User ${id}`,
                seasonCategoryPoints: {
                  2026: {
                    freestyle: { points: 10, rank: 'Iniciante' },
                  },
                },
              }),
            ),
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
      if (
        [
          'qualifierTracks',
          'qualifierTickets',
          'qualifierParticipants',
        ].includes(name)
      ) {
        return {
          doc: vi.fn((id: string) => ({ id })),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, batch, registrationsQuery, matchesQuery };
}

describe('migrateQualifierEntriesToMiniKnockout', () => {
  it('migrates paid state qualifier entries into a one-winner mini knockout', async () => {
    const { db, batch, registrationsQuery, matchesQuery } = createDb();

    await expect(
      migrateQualifierEntriesToMiniKnockout(db as never, {
        adminUserId: 'admin-1',
        category: 'freestyle',
      }),
    ).resolves.toMatchObject({
      eventId: 'mini-qualifier-2026-freestyle',
      trackId: 'qualifier-mini-2026-freestyle',
      participantCount: 10,
      ticketCount: 10,
      postponedTrackCount: 2,
      matchCount: 2,
      byeCount: 6,
      prizePoolCents: 3200,
      platformFeeCents: 800,
      status: 'active',
    });

    expect(matchesQuery.where).toHaveBeenCalledWith('eventId', '==', 'mini-qualifier-2026-freestyle');
    expect(registrationsQuery.where).toHaveBeenCalledWith('status', '==', 'confirmed');
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^match-/) }),
      expect.objectContaining({
        format: 'mini_knockout',
        eventId: 'mini-qualifier-2026-freestyle',
        roundNumber: 1,
        status: 'scheduled',
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qualifier-mini-2026-freestyle' }),
      expect.objectContaining({
        format: 'mini_knockout',
        maxQualified: 1,
        confirmedCount: 10,
        prizePoolCents: 3200,
      }),
      { merge: true },
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'registration-1' }),
      expect.objectContaining({
        status: 'migrated_to_mini',
        migratedToEventId: 'mini-qualifier-2026-freestyle',
      }),
    );
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ticket-registration-1' }),
      expect.objectContaining({
        userId: 'user-1',
        kind: 'state_qualifier_entry',
        status: 'available',
        issuedReason: 'state_qualifier_postponed',
      }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('rejects non-admin users and duplicate mini generation', async () => {
    await expect(
      migrateQualifierEntriesToMiniKnockout(createDb({ adminRole: 'user' }).db as never, {
        adminUserId: 'user-1',
        category: 'freestyle',
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      migrateQualifierEntriesToMiniKnockout(
        createDb({ existingMatches: [docSnap('match-1', {})] }).db as never,
        {
          adminUserId: 'admin-1',
          category: 'freestyle',
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejects non-freestyle mini qualifiers', async () => {
    await expect(
      migrateQualifierEntriesToMiniKnockout(createDb().db as never, {
        adminUserId: 'admin-1',
        category: 'melodia',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Mini Classificatoria esta disponivel apenas para Freestyle.',
    });
  });
});
