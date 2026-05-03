import { describe, expect, it } from 'vitest';
import type { Championship } from '@batalha/types';
import {
  getChampionshipParticipantIds,
  getVisibleHomepageChampionships,
  sortChampionshipsForDisplay,
} from './championship-view';

function championship(
  overrides: Partial<Championship> & Pick<Championship, 'id' | 'scope' | 'category'>,
): Championship {
  return {
    title: overrides.id,
    description: '',
    seasonId: '2026',
    region: null,
    status: 'registration',
    schedule: {
      registrationStart: new Date(),
      registrationEnd: new Date(),
      start: new Date(),
      end: new Date(),
    },
    maxParticipants: 64,
    currentParticipants: 0,
    participantIds: [],
    qualifierBattleIds: [],
    prizePool: 0,
    prizeDistribution: null,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('championship view helpers', () => {
  it('sorts national championships before regional championships', () => {
    const sorted = sortChampionshipsForDisplay([
      championship({ id: 'sp', scope: 'regional', region: 'SP', category: 'freestyle' }),
      championship({ id: 'national', scope: 'national', category: 'melodia' }),
      championship({ id: 'rj', scope: 'regional', region: 'RJ', category: 'passaros' }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['national', 'rj', 'sp']);
  });

  it('caps homepage championships and excludes finished ones', () => {
    const items = Array.from({ length: 25 }).map((_, index) =>
      championship({
        id: `champ-${index}`,
        scope: 'regional',
        region: 'SP',
        category: 'freestyle',
        status: index === 0 ? 'finished' : 'registration',
      }),
    );

    expect(getVisibleHomepageChampionships(items, 20)).toHaveLength(20);
    expect(
      getVisibleHomepageChampionships(items, 20).some((item) => item.status === 'finished'),
    ).toBe(false);
  });

  it('prioritizes homepage championships by participants within default regions', () => {
    const items = [
      championship({
        id: 'ce-big',
        scope: 'regional',
        region: 'CE',
        category: 'freestyle',
        currentParticipants: 100,
      }),
      championship({
        id: 'sp-small',
        scope: 'regional',
        region: 'SP',
        category: 'freestyle',
        currentParticipants: 5,
      }),
      championship({
        id: 'rj-big',
        scope: 'regional',
        region: 'RJ',
        category: 'freestyle',
        currentParticipants: 20,
      }),
      championship({
        id: 'national-medium',
        scope: 'national',
        category: 'freestyle',
        currentParticipants: 10,
      }),
    ];

    expect(getVisibleHomepageChampionships(items, 20).map((item) => item.id)).toEqual([
      'rj-big',
      'national-medium',
      'sp-small',
    ]);
  });

  it('returns participant ids from a championship', () => {
    expect(
      getChampionshipParticipantIds(
        championship({
          id: 'with-participants',
          scope: 'national',
          category: 'freestyle',
          participantIds: ['user-1', 'user-2'],
        }),
      ),
    ).toEqual(['user-1', 'user-2']);
  });
});
