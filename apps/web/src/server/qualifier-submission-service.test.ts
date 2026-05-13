import { describe, expect, it, vi } from 'vitest';
import { createQualifierSubmission } from './qualifier-submission-service';

const baseMatch = {
  id: 'match-1',
  seasonId: 'season-2026',
  category: 'freestyle',
  region: 'SP',
  roundNumber: 1,
  participantIds: ['user-1', 'opponent-1'],
  registrationIds: ['registration-1', 'registration-2'],
  status: 'submissions_open',
  submissionIds: {},
  submissionDeadline: new Date('2026-06-01T18:00:00.000Z'),
};

function createDb({
  match = baseMatch,
  matchExists = true,
  registration = { userId: 'user-1', status: 'confirmed' },
  user = { displayName: 'User Local' },
  userExists = true,
} = {}) {
  const matchRef = { id: 'match-1' };
  const submissionRef = { id: 'submission-1' };
  const registrationRef = { id: 'registration-1' };
  const registrationRef2 = { id: 'registration-2' };
  const userRef = { id: 'user-1' };

  const tx = {
    get: vi.fn(async (target: unknown) => {
      if (target === matchRef) return { exists: matchExists, data: () => match };
      if (target === registrationRef) {
        return {
          exists: true,
          id: 'registration-1',
          ref: registrationRef,
          data: () => registration,
        };
      }
      if (target === registrationRef2) {
        return {
          exists: true,
          id: 'registration-2',
          ref: registrationRef2,
          data: () => ({ userId: 'opponent-1', status: 'confirmed' }),
        };
      }
      if (target === userRef) return { exists: userExists, data: () => user };
      throw new Error('Unexpected get target');
    }),
    set: vi.fn(),
    update: vi.fn(),
  };

  const db = {
    collection: vi.fn((name: string) => {
      if (name === 'qualifierMatches') return { doc: vi.fn(() => matchRef) };
      if (name === 'qualifierRegistrations') {
        return {
          doc: vi.fn((id: string) =>
            id === 'registration-1' ? registrationRef : registrationRef2,
          ),
        };
      }
      if (name === 'qualifierSubmissions') return { doc: vi.fn(() => submissionRef) };
      if (name === 'users') return { doc: vi.fn(() => userRef) };
      throw new Error(`Unexpected collection ${name}`);
    }),
    runTransaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, tx, matchRef, registrationRef, submissionRef };
}

const validInput = {
  matchId: 'match-1',
  userId: 'user-1',
  audioURL: 'https://storage.example/qualifier.webm',
  audioPath: 'qualifier-submissions/match-1/user-1.webm',
  contentType: 'audio/webm',
  sizeBytes: 1234,
  originalAudioURL: 'https://storage.example/qualifier-original.webm',
  originalAudioPath: 'qualifier-submissions/match-1/user-1-original.webm',
  originalContentType: 'audio/webm',
  originalSizeBytes: 2345,
  durationSeconds: 42,
  now: new Date('2026-06-01T17:00:00.000Z'),
};

describe('createQualifierSubmission', () => {
  it('creates a qualifier submission and attaches it to the match', async () => {
    const { db, tx, matchRef, registrationRef, submissionRef } = createDb();

    await expect(createQualifierSubmission(db as never, validInput)).resolves.toEqual({
      qualifierSubmissionId: 'submission-1',
      matchId: 'match-1',
    });

    expect(tx.set).toHaveBeenCalledWith(
      submissionRef,
      expect.objectContaining({
        matchId: 'match-1',
        registrationId: 'registration-1',
        userId: 'user-1',
        userDisplayName: 'User Local',
        mediaType: 'audio',
        mediaURL: 'https://storage.example/qualifier.webm',
        mediaOriginalURL: 'https://storage.example/qualifier-original.webm',
        mediaOriginalPath: 'qualifier-submissions/match-1/user-1-original.webm',
        mediaOriginalContentType: 'audio/webm',
        mediaOriginalSizeBytes: 2345,
        mediaDurationSeconds: 42,
        status: 'submitted',
      }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      matchRef,
      expect.objectContaining({ 'submissionIds.user-1': 'submission-1' }),
    );
    expect(tx.update).toHaveBeenCalledWith(
      registrationRef,
      expect.objectContaining({ bracketStatus: 'active', currentMatchId: 'match-1' }),
    );
  });

  it('rejects non-participants, duplicate submissions, and closed matches', async () => {
    await expect(
      createQualifierSubmission(
        createDb({
          match: { ...baseMatch, participantIds: ['other-1', 'opponent-1'] },
        }).db as never,
        validInput,
      ),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      createQualifierSubmission(
        createDb({
          match: {
            id: 'match-1',
            seasonId: 'season-2026',
            category: 'freestyle',
            region: 'SP',
            roundNumber: 1,
            participantIds: ['user-1', 'opponent-1'],
            registrationIds: ['registration-1', 'registration-2'],
            status: 'submissions_open',
            submissionIds: { 'user-1': 'submission-existing' },
            submissionDeadline: new Date('2026-06-01T18:00:00.000Z'),
          },
        }).db as never,
        validInput,
      ),
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      createQualifierSubmission(
        createDb({
          match: {
            id: 'match-1',
            seasonId: 'season-2026',
            category: 'freestyle',
            region: 'SP',
            roundNumber: 1,
            participantIds: ['user-1', 'opponent-1'],
            registrationIds: ['registration-1', 'registration-2'],
            status: 'voting',
            submissionIds: {},
            submissionDeadline: new Date('2026-06-01T18:00:00.000Z'),
          },
        }).db as never,
        validInput,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects late and oversized audio submissions', async () => {
    await expect(
      createQualifierSubmission(createDb().db as never, {
        ...validInput,
        now: new Date('2026-06-01T19:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 400, message: 'Prazo de envio encerrado' });

    await expect(
      createQualifierSubmission(createDb().db as never, {
        ...validInput,
        durationSeconds: 121,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
