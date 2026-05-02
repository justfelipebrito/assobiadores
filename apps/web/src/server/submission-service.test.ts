import { describe, expect, it, vi } from 'vitest';
import { createSubmission, moderateSubmission } from './submission-service';

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
}: {
  battle?: Record<string, unknown>;
  battleExists?: boolean;
  entryDocs?: Array<{ id: string }>;
  existingSubmission?: boolean;
  adminRole?: string;
  userDisplayName?: string;
  submissionExists?: boolean;
}) {
  const entryQuery = createQuery(createQuerySnapshot(entryDocs));
  const existingSubmissionQuery = createQuery(
    createQuerySnapshot(existingSubmission ? [{ id: 'submission-existing' }] : []),
  );
  const submissionRef = {
    id: 'submission-1',
    set: vi.fn(),
    get: vi.fn(async () => ({ exists: submissionExists })),
    update: vi.fn(),
  };

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
      throw new Error(`Unexpected collection ${name}`);
    }),
  };

  return { db, submissionRef };
}

const activeBattle = { status: 'active' };

describe('createSubmission', () => {
  it('creates a submitted video for a confirmed battle participant', async () => {
    const { db, submissionRef } = createDb({ battle: activeBattle });

    await expect(
      createSubmission(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        videoURL: 'https://youtu.be/abc123',
        title: 'Meu assobio',
      }),
    ).resolves.toEqual({ submissionId: 'submission-1', status: 'submitted' });

    expect(submissionRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        battleId: 'battle-1',
        userId: 'user-1',
        userDisplayName: 'User One',
        entryId: 'entry-1',
        videoPlatform: 'youtube',
        status: 'submitted',
        voteCount: 0,
      }),
    );
  });

  it('rejects invalid video URLs', async () => {
    const { db } = createDb({ battle: activeBattle });

    await expect(
      createSubmission(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        videoURL: 'not-a-url',
        title: 'Video',
      }),
    ).rejects.toMatchObject({ status: 400, message: 'URL de video invalida' });
  });

  it('requires active battle status and confirmed entry', async () => {
    await expect(
      createSubmission(createDb({ battle: { status: 'registration' } }).db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        videoURL: 'https://youtu.be/abc123',
        title: 'Video',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      createSubmission(createDb({ battle: activeBattle, entryDocs: [] }).db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        videoURL: 'https://youtu.be/abc123',
        title: 'Video',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects duplicate submissions for the same battle', async () => {
    const { db } = createDb({ battle: activeBattle, existingSubmission: true });

    await expect(
      createSubmission(db as never, {
        battleId: 'battle-1',
        userId: 'user-1',
        videoURL: 'https://youtu.be/abc123',
        title: 'Video',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('moderateSubmission', () => {
  it('allows admins to approve submissions', async () => {
    const { db, submissionRef } = createDb({ battle: activeBattle });

    await expect(
      moderateSubmission(db as never, {
        submissionId: 'submission-1',
        moderatorId: 'admin-1',
        status: 'approved',
      }),
    ).resolves.toEqual({ submissionId: 'submission-1', status: 'approved' });
    expect(submissionRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
    );
  });

  it('rejects non-admin moderation', async () => {
    const { db } = createDb({ battle: activeBattle, adminRole: 'user' });

    await expect(
      moderateSubmission(db as never, {
        submissionId: 'submission-1',
        moderatorId: 'user-1',
        status: 'approved',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
