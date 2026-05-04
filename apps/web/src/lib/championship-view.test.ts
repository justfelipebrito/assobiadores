import { describe, expect, it } from 'vitest';
import type { Championship } from '@batalha/types';
import {
  getChampionshipDateCopy,
  getChampionshipEmptyParticipantsCopy,
  getChampionshipParticipantCount,
  getChampionshipStatusCopy,
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

  it('uses real participant ids as the visible participant count floor', () => {
    expect(
      getChampionshipParticipantCount(
        championship({
          id: 'with-participants',
          scope: 'regional',
          category: 'freestyle',
          currentParticipants: 0,
          participantIds: ['user-1', 'user-2'],
        }),
      ),
    ).toBe(2);
  });

  it('uses scope-aware empty participant copy', () => {
    expect(
      getChampionshipEmptyParticipantsCopy(
        championship({ id: 'national', scope: 'national', category: 'freestyle' }),
      ),
    ).toBe(
      'Ainda não há participantes classificados, os top 10 das regionais serão automaticamente classificados.',
    );

    expect(
      getChampionshipEmptyParticipantsCopy(
        championship({ id: 'regional', scope: 'regional', category: 'freestyle' }),
      ),
    ).toBe(
      'Ainda não há participantes classificados, até 64 participantes serão classificados através das Classificatórias.',
    );
  });

  it('formats championship date copy by scope', () => {
    expect(
      getChampionshipDateCopy(
        championship({
          id: 'regional',
          scope: 'regional',
          category: 'freestyle',
          schedule: {
            registrationStart: new Date('2026-05-04T03:00:00.000Z'),
            registrationEnd: new Date('2026-06-01T02:59:59.000Z'),
            start: new Date('2026-07-20T03:00:00.000Z'),
            end: new Date('2026-09-28T02:59:59.000Z'),
          },
        }),
      ),
    ).toBe('20/07/2026 - 27/09/2026');

    expect(
      getChampionshipDateCopy(
        championship({
          id: 'national',
          scope: 'national',
          category: 'freestyle',
          schedule: {
            registrationStart: new Date('2026-05-04T03:00:00.000Z'),
            registrationEnd: new Date('2026-06-01T02:59:59.000Z'),
            start: new Date('2026-10-05T03:00:00.000Z'),
            end: new Date('2026-12-14T02:59:59.000Z'),
          },
        }),
      ),
    ).toBe('Início em 05/10/2026');
  });

  it('uses product status copy instead of raw championship status', () => {
    const item = championship({
      id: 'regional',
      scope: 'regional',
      category: 'freestyle',
      schedule: {
        registrationStart: new Date('2026-05-04T03:00:00.000Z'),
        registrationEnd: new Date('2026-06-01T02:59:59.000Z'),
        start: new Date('2026-07-20T03:00:00.000Z'),
        end: new Date('2026-09-28T02:59:59.000Z'),
      },
    });

    expect(getChampionshipStatusCopy(item, new Date('2026-05-03T12:00:00.000Z'))).toBe(
      'Status: Classificatórias abrem em 04/05/2026',
    );
    expect(getChampionshipStatusCopy(item, new Date('2026-06-15T12:00:00.000Z'))).toBe(
      'Status: Classificatórias em andamento',
    );
    expect(getChampionshipStatusCopy(item, new Date('2026-08-01T12:00:00.000Z'))).toBe(
      'Status: Regional em andamento',
    );

    expect(
      getChampionshipStatusCopy(
        championship({
          id: 'national',
          scope: 'national',
          category: 'freestyle',
          schedule: {
            registrationStart: new Date('2026-05-04T03:00:00.000Z'),
            registrationEnd: new Date('2026-06-01T02:59:59.000Z'),
            start: new Date('2026-10-05T03:00:00.000Z'),
            end: new Date('2026-12-14T02:59:59.000Z'),
          },
        }),
        new Date('2026-06-15T12:00:00.000Z'),
      ),
    ).toBe('Status: Classificados do Regional');
  });
});
