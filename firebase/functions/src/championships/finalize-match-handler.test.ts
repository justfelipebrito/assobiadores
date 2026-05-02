import { beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeMatchHandler } from './finalize-match-handler';

const serverTimestamp = Symbol('serverTimestamp');
const fieldValue = {
  serverTimestamp: vi.fn(() => serverTimestamp),
  increment: vi.fn((n: number) => ({ _increment: n })),
};

const logger = { info: vi.fn() };

function makeMatchDoc(id: string, data: Record<string, unknown>) {
  return { id, exists: true, data: () => data };
}

function makeSubmissionDoc(userId: string, voteCount: number) {
  return { data: () => ({ userId, voteCount, status: 'approved' }) };
}

function buildDb({
  matchData,
  otherMatchStatuses = [],
  submissionDocs = [],
}: {
  matchData: Record<string, unknown>;
  otherMatchStatuses?: string[];
  submissionDocs?: ReturnType<typeof makeSubmissionDoc>[];
}) {
  const batch = { update: vi.fn(), commit: vi.fn() };

  const allMatchDocs = [
    makeMatchDoc('match-1', matchData),
    ...otherMatchStatuses.map((status, i) =>
      makeMatchDoc(`match-other-${i}`, { status }),
    ),
  ];

  const subQuery = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    get: vi.fn(async () => ({
      empty: submissionDocs.length === 0,
      docs: submissionDocs,
    })),
  };

  const matchesCollection = {
    doc: vi.fn((id: string) => ({
      get: vi.fn(async () =>
        id === 'match-1'
          ? makeMatchDoc('match-1', matchData)
          : { exists: false, data: () => undefined },
      ),
    })),
    get: vi.fn(async () => ({ docs: allMatchDocs })),
  };

  const stageRef = {
    collection: vi.fn(() => matchesCollection),
    update: vi.fn(),
  };

  const stagesCollection = {
    doc: vi.fn(() => stageRef),
  };

  const champRef = {
    collection: vi.fn(() => stagesCollection),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'championships') return { doc: vi.fn(() => champRef) };
      if (name === 'submissions') return subQuery;
      throw new Error(`Unexpected collection: ${name}`);
    }),
    batch: vi.fn(() => batch),
  } as unknown;

  return { db, batch, stageRef };
}

describe('finalizeMatchHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects if match does not exist', async () => {
    const batch = { update: vi.fn(), commit: vi.fn() };
    const matchesCollection = {
      doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false })) })),
      get: vi.fn(async () => ({ docs: [] })),
    };
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              collection: vi.fn(() => matchesCollection),
            })),
          })),
        })),
      })),
      batch: vi.fn(() => batch),
    } as unknown;

    await expect(
      finalizeMatchHandler(
        { championshipId: 'c1', stageId: 's1', matchId: 'match-1' },
        { db: db as never, fieldValue: fieldValue as never, logger },
      ),
    ).rejects.toThrow('not found');
  });

  it('rejects if match is not in voting status', async () => {
    const { db } = buildDb({ matchData: { status: 'active', battleId: null, participantIds: [] } });

    await expect(
      finalizeMatchHandler(
        { championshipId: 'c1', stageId: 's1', matchId: 'match-1' },
        { db: db as never, fieldValue: fieldValue as never, logger },
      ),
    ).rejects.toThrow('voting');
  });

  it('sets winner from top-voted submission when battleId is set', async () => {
    const { db, batch } = buildDb({
      matchData: { status: 'voting', battleId: 'b1', participantIds: ['user-a', 'user-b'] },
      submissionDocs: [
        makeSubmissionDoc('user-a', 10),
        makeSubmissionDoc('user-b', 5),
      ],
    });

    const result = await finalizeMatchHandler(
      { championshipId: 'c1', stageId: 's1', matchId: 'match-1' },
      { db: db as never, fieldValue: fieldValue as never, logger },
    );

    expect(result.winnerId).toBe('user-a');
    expect(batch.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'finished', winnerId: 'user-a' }),
    );
  });

  it('sets winnerId null when no submissions exist', async () => {
    const { db, batch } = buildDb({
      matchData: { status: 'voting', battleId: 'b1', participantIds: ['user-a', 'user-b'] },
      submissionDocs: [],
    });

    const result = await finalizeMatchHandler(
      { championshipId: 'c1', stageId: 's1', matchId: 'match-1' },
      { db: db as never, fieldValue: fieldValue as never, logger },
    );

    expect(result.winnerId).toBeNull();
  });

  it('marks stage finished when this is the last match', async () => {
    const { db, batch } = buildDb({
      matchData: { status: 'voting', battleId: null, participantIds: [] },
      otherMatchStatuses: ['finished', 'finished'],
    });

    const result = await finalizeMatchHandler(
      { championshipId: 'c1', stageId: 's1', matchId: 'match-1' },
      { db: db as never, fieldValue: fieldValue as never, logger },
    );

    expect(result.stageFinished).toBe(true);
    // batch.update called twice: once for match, once for stage
    expect(batch.update).toHaveBeenCalledTimes(2);
  });

  it('does not mark stage finished when other matches are still active', async () => {
    const { db, batch } = buildDb({
      matchData: { status: 'voting', battleId: null, participantIds: [] },
      otherMatchStatuses: ['active'],
    });

    const result = await finalizeMatchHandler(
      { championshipId: 'c1', stageId: 's1', matchId: 'match-1' },
      { db: db as never, fieldValue: fieldValue as never, logger },
    );

    expect(result.stageFinished).toBe(false);
    expect(batch.update).toHaveBeenCalledTimes(1);
  });
});
