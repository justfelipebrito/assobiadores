import { describe, expect, it, vi } from 'vitest';
import { createSubmission, removeSubmission, reportSubmission } from './submission-service';

function createQuerySnapshot(docs: Array<{ id: string; data?: Record<string, unknown> }> = []) {
  return {
    empty: docs.length === 0,
    docs: docs.map((item) => ({ id: item.id, data: () => item.data ?? {} })),
  };
}

function createQuery(snapshot: unknown) {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => snapshot),
  };
  return query;
}

function createDb({
  battle,
  battleExists = true,
  entryDocs = [{ id: 'entry-1' }],
  existingSubmission = false,
  adminRole = 'admin',
  userDisplayName = 'User One',
  submissionExists = true,
  submissionData = { battleId: 'battle-1', userId: 'user-2', status: 'approved' },
  existingReport = false,
}: {
  battle?: Record<string, unknown>;
  battleExists?: boolean;
  entryDocs?: Array<{ id: string }>;
  existingSubmission?: boolean;
  adminRole?: string;
  userDisplayName?: string;
  submissionExists?: boolean;
  submissionData?: Record<string, unknown>;
  existingReport?: boolean;
}) {
  const entryQuery = createQuery(createQuerySnapshot(entryDocs));
  const existingSubmissionQuery = createQuery(
    createQuerySnapshot(existingSubmission ? [{ id: 'submission-existing' }] : []),
  );
  const submissionRef = {
    id: 'submission-1',
    set: vi.fn(),
    get: vi.fn(async () => ({ exists: submissionExists, data: () => submissionData })),
    update: vi.fn(),
  };
  const reportRef = {
    id: 'report-1',
    set: vi.fn(),
  };
  const existingReportQuery = createQuery(
    createQuerySnapshot(existingReport ? [{ id: 'report-existing' }] : []),
  );

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'battles') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({
              exists: battleExists,
              data: () => battle,
            })),
          })),
        };
      }
      if (name === 'battleEntries') {
        return { where: entryQuery.where };
      }
      if (name === 'submissions') {
        return {
          where: existingSubmissionQuery.where,
          doc: vi.fn(() => submissionRef),
        };
      }
      if (name === 'users') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({
              exists: true,
              data: () => ({ role: adminRole, displayName: userDisplayName }),
            })),
          })),
        };
      }
      if (name === 'submissionReports') {
        return {
          where: existingReportQuery.where,
          doc: vi.fn(() => reportRef),
        };
      }
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, submissionRef, reportRef };
}

const activeBattle = { status: 'active', submissionDeadline: new Date('2026-05-07T12:00:00.000Z') };

describe('createSubmission', () => {
  const audioInput = {
    audioURL: 'https://storage.example/battle.webm',
    audioPath: 'battle-submissions/battle-1/user-1.webm',
    contentType: 'audio/webm',
    sizeBytes: 2048,
    durationSeconds: 5,
    category: 'freestyle' as const,
  };

  it('creates an active audio submission for a confirmed battle participant', async () => {
    const { db, submissionRef } = createDb({ battle: activeBattle });

    await expect(
      createSubmission(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        ...audioInput,
        now: new Date('2026-05-07T11:00:00.000Z'),
      }),
    ).resolves.toEqual({ submissionId: 'submission-1', status: 'approved' });

    expect(submissionRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        battleId: 'battle-1',
        userId: 'user-1',
        userDisplayName: 'User One',
        entryId: 'entry-1',
        mediaType: 'audio',
        mediaURL: 'https://storage.example/battle.webm',
        mediaPath: 'battle-submissions/battle-1/user-1.webm',
        mediaContentType: 'audio/webm',
        mediaDurationSeconds: 5,
        videoPlatform: 'other',
        status: 'approved',
        voteCount: 0,
        reportCount: 0,
        removedAt: null,
        removedBy: null,
      }),
    );
  });

  it('rejects invalid audio metadata', async () => {
    const { db } = createDb({ battle: activeBattle });

    await expect(
      createSubmission(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        ...audioInput,
        contentType: 'video/mp4',
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Envie um audio valido' });
  });

  it('allows submissions during registration after the participant has joined', async () => {
    const { db } = createDb({
      battle: { status: 'registration', submissionDeadline: new Date('2026-05-07T12:00:00.000Z') },
    });

    await expect(
      createSubmission(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        ...audioInput,
        now: new Date('2026-05-07T11:00:00.000Z'),
      }),
    ).resolves.toEqual({ submissionId: 'submission-1', status: 'approved' });
  });

  it('requires open submission status, deadline, and confirmed entry', async () => {
    await expect(
      createSubmission(createDb({ battle: { status: 'voting' } }).db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        ...audioInput,
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      createSubmission(createDb({ battle: activeBattle }).db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        ...audioInput,
        now: new Date('2026-05-07T12:01:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Prazo de envio encerrado' });

    await expect(
      createSubmission(createDb({ battle: activeBattle, entryDocs: [] }).db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        ...audioInput,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects duplicate submissions for the same battle', async () => {
    const { db } = createDb({ battle: activeBattle, existingSubmission: true });

    await expect(
      createSubmission(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        ...audioInput,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('removeSubmission', () => {
  it('allows admins to remove submissions', async () => {
    const { db, submissionRef } = createDb({ battle: activeBattle });

    await expect(
      removeSubmission(db as never, {
        submissionId: 'submission-1',
        moderatorId: 'admin-1',
      }),
    ).resolves.toEqual({ submissionId: 'submission-1', status: 'removed' });
    expect(submissionRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'removed', removedBy: 'admin-1' }),
    );
  });

  it('rejects non-admin removal', async () => {
    const { db } = createDb({ battle: activeBattle, adminRole: 'user' });

    await expect(
      removeSubmission(db as never, {
        submissionId: 'submission-1',
        moderatorId: 'user-1',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('reportSubmission', () => {
  it('creates a report and increments the submission report count', async () => {
    const { db, submissionRef, reportRef } = createDb({ battle: activeBattle });

    await expect(
      reportSubmission(db as never, {
        submissionId: 'submission-1',
        reporterId: 'user-1',
        reason: 'platform_rules',
        description: 'Conteudo fora das regras',
      }),
    ).resolves.toEqual({ reportId: 'report-1', status: 'open' });

    expect(reportRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: 'submission-1',
        reporterId: 'user-1',
        reportedUserId: 'user-2',
        reason: 'platform_rules',
        status: 'open',
      }),
    );
    expect(submissionRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.anything() }),
    );
  });

  it('blocks self reports and duplicate reports', async () => {
    await expect(
      reportSubmission(
        createDb({
          battle: activeBattle,
          submissionData: { battleId: 'battle-1', userId: 'user-1', status: 'approved' },
        }).db as never,
        {
          submissionId: 'submission-1',
          reporterId: 'user-1',
          reason: 'platform_rules',
        },
      ),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      reportSubmission(createDb({ battle: activeBattle, existingReport: true }).db as never, {
        submissionId: 'submission-1',
        reporterId: 'user-1',
        reason: 'platform_rules',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
