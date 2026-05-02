import { describe, expect, it } from 'vitest';
import { createDefaultUserData, getDefaultUsername, normalizeUsername } from './user-defaults';

describe('user defaults', () => {
  it('normalizes usernames for invite/search indexing', () => {
    expect(normalizeUsername('João Assobiador!')).toBe('joaoassobiador');
    expect(normalizeUsername('User_123')).toBe('user_123');
  });

  it('derives username from display name, email, or uid fallback', () => {
    expect(
      getDefaultUsername({
        uid: 'abcdef123456',
        displayName: 'Joao Local',
        email: 'other@example.com',
      }),
    ).toBe('joaolocal');
    expect(getDefaultUsername({ uid: 'abcdef123456', email: 'emailuser@example.com' })).toBe(
      'emailuser',
    );
    expect(getDefaultUsername({ uid: 'abcdef123456' })).toBe('user_abcdef12');
  });

  it('creates server-owned metadata defaults for new users', () => {
    expect(
      createDefaultUserData({
        uid: 'user-1',
        displayName: 'User One',
        email: 'user@example.com',
        photoURL: null,
      }),
    ).toMatchObject({
      id: 'user-1',
      schemaVersion: 1,
      username: 'userone',
      usernameLower: 'userone',
      displayName: 'User One',
      email: 'user@example.com',
      role: 'user',
      accountType: 'free',
      plan: 'free',
      state: null,
      city: null,
      country: 'BR',
      officialProfile: {
        eligible: false,
        verified: false,
        state: null,
        region: null,
      },
      points: 0,
      xp: 0,
      rank: 'Iniciante',
      seasonPoints: {},
    });
  });
});
