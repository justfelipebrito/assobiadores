import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { runBattleLifecycleWatcher } from './status-updater';

type BattleDoc = Record<string, any> & { id: string };

function isDue(value: unknown, now: Timestamp) {
  if (!value) return false;
  if (value instanceof Timestamp) return value.toMillis() <= now.toMillis();
  if (value instanceof Date) return value.getTime() <= now.toMillis();
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    return (value as { toMillis: () => number }).toMillis() <= now.toMillis();
  }
  return false;
}

function makeSnapshot<T extends { id: string }>(docs: T[]) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((doc) => ({
      id: doc.id,
      ref: { id: doc.id, collection: 'battles' },
      data: () => doc,
    })),
  };
}

function createQuery<T extends { id: string }>(docs: T[]) {
  const filters: Array<{ field: string; operator: string; value: unknown }> = [];
  const query = {
    where(field: string, operator: string, value: unknown) {
      filters.push({ field, operator, value });
      return query;
    },
    orderBy() {
      return query;
    },
    limit() {
      return query;
    },
    async get() {
      return makeSnapshot(
        docs.filter((doc) =>
          filters.every(({ field, operator, value }) => {
            if (operator === '==') return doc[field] === value;
            if (operator === '<=') return isDue(doc[field], value as Timestamp);
            return true;
          }),
        ),
      );
    },
  };
  return query;
}

function createDb({
  battles,
  submissions = [],
  entries = [],
}: {
  battles: BattleDoc[];
  submissions?: Array<Record<string, any> & { id: string }>;
  entries?: Array<Record<string, any> & { id: string }>;
}) {
  const updates: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
  const sets: Array<{ ref: unknown; data: Record<string, unknown> }> = [];
  const userDocs = new Map<string, Record<string, any>>();

  const updateBattle = (battleId: string, data: Record<string, unknown>) => {
    const battle = battles.find((candidate) => candidate.id === battleId);
    if (battle) Object.assign(battle, data);
  };

  const makeBatch = () => ({
    set: (ref: unknown, data: Record<string, unknown>) => sets.push({ ref, data }),
    update: (ref: unknown, data: Record<string, unknown>) => {
      updates.push({ ref, data });
      const id = (ref as { id?: string }).id;
      if (id && battles.some((battle) => battle.id === id)) updateBattle(id, data);
    },
    commit: async () => undefined,
  });

  const db = {
    doc: (path: string) => ({ id: path.split('/').at(-1) ?? path, path }),
    batch: makeBatch,
    collection: (name: string) => {
      if (name === 'battles') {
        return {
          ...createQuery(battles),
          doc: (id: string) => ({
            id,
            get: async () => {
              const battle = battles.find((candidate) => candidate.id === id);
              return { exists: Boolean(battle), data: () => battle };
            },
          }),
        };
      }
      if (name === 'submissions') return createQuery(submissions);
      if (name === 'battleEntries') return createQuery(entries);
      if (name === 'users') {
        return {
          doc: (id: string) => ({
            id,
            get: async () => ({ exists: true, data: () => userDocs.get(id) ?? { points: 0 } }),
          }),
        };
      }
      if (name === 'pointActivities') return { doc: (id: string) => ({ id }) };
      throw new Error(`Unexpected collection ${name}`);
    },
  };

  return { db, updates, sets, battles };
}

describe('runBattleLifecycleWatcher', () => {
  it('uses votingStart, not submissionDeadline, to open voting', async () => {
    const now = Timestamp.fromDate(new Date('2026-06-03T15:00:00.000Z'));
    const { db, battles, updates } = createDb({
      battles: [
        {
          id: 'early-vote',
          status: 'active',
          submissionDeadline: Timestamp.fromDate(new Date('2026-06-03T14:00:00.000Z')),
          votingStart: Timestamp.fromDate(new Date('2026-06-03T16:00:00.000Z')),
          votingEnd: Timestamp.fromDate(new Date('2026-06-03T18:00:00.000Z')),
        },
        {
          id: 'due-vote',
          status: 'active',
          submissionDeadline: Timestamp.fromDate(new Date('2026-06-03T14:00:00.000Z')),
          votingStart: Timestamp.fromDate(new Date('2026-06-03T15:00:00.000Z')),
          votingEnd: Timestamp.fromDate(new Date('2026-06-03T18:00:00.000Z')),
        },
      ],
    });

    const result = await runBattleLifecycleWatcher(db as never, { now });

    expect(result.transitionedCount).toBe(1);
    expect(battles.find((battle) => battle.id === 'early-vote')?.status).toBe('active');
    expect(battles.find((battle) => battle.id === 'due-vote')?.status).toBe('voting');
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'due-vote' }),
          data: expect.objectContaining({ status: 'voting' }),
        }),
      ]),
    );
  });

  it('transitions registration to active when registrationEnd passes', async () => {
    const now = Timestamp.fromDate(new Date('2026-06-03T15:00:00.000Z'));
    const { db, battles } = createDb({
      battles: [
        {
          id: 'battle-1',
          status: 'registration',
          registrationEnd: Timestamp.fromDate(new Date('2026-06-03T14:59:00.000Z')),
          votingEnd: Timestamp.fromDate(new Date('2026-06-03T18:00:00.000Z')),
        },
      ],
    });

    await expect(runBattleLifecycleWatcher(db as never, { now })).resolves.toMatchObject({
      transitionedCount: 1,
    });
    expect(battles[0]?.status).toBe('active');
  });

  it('finalizes ended voting battles through the trusted finalizer', async () => {
    const now = Timestamp.fromDate(new Date('2026-06-03T15:00:00.000Z'));
    const { db, battles, updates, sets } = createDb({
      battles: [
        {
          id: 'battle-1',
          status: 'voting',
          format: 'duel',
          category: 'freestyle',
          seasonId: '2026',
          votingEnd: Timestamp.fromDate(new Date('2026-06-03T14:59:00.000Z')),
          prizeDistribution: { first: 1000 },
        },
      ],
      submissions: [
        { id: 'sub-1', battleId: 'battle-1', status: 'approved', userId: 'winner', voteCount: 3 },
        { id: 'sub-2', battleId: 'battle-1', status: 'approved', userId: 'loser', voteCount: 1 },
      ],
      entries: [
        { id: 'entry-1', battleId: 'battle-1', status: 'confirmed', userId: 'winner' },
        { id: 'entry-2', battleId: 'battle-1', status: 'confirmed', userId: 'loser' },
      ],
    });

    const result = await runBattleLifecycleWatcher(db as never, { now });

    expect(result).toMatchObject({ checkedCount: 1, finalizedCount: 1, failedCount: 0 });
    expect(battles[0]?.status).toBe('finished');
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'battle-1' }),
          data: expect.objectContaining({
            status: 'finished',
            winners: [{ userId: 'winner', place: 1, points: 10, prize: 1000 }],
          }),
        }),
      ]),
    );
    expect(sets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'battle__battle-1__battle_win__winner' }),
        }),
      ]),
    );
  });
});
