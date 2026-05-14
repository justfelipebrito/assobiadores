import { describe, expect, it } from 'vitest';
import { getHeaderTickerItems, getUpcomingEventItems } from './header-ticker';
import type { Battle, Championship, QualifierTrack } from '@batalha/types';

const now = new Date('2026-05-08T12:00:00Z');

function battle(overrides: Partial<Battle>): Battle {
  return {
    id: 'battle-1',
    title: 'Batalha',
    description: '',
    type: 'community',
    format: 'group',
    category: 'freestyle',
    status: 'registration',
    entryFee: 0,
    prizePool: 0,
    prizeDistribution: null,
    votingType: 'public',
    visibility: 'public',
    maxParticipants: 50,
    currentParticipants: 0,
    registrationStart: new Date('2026-05-08T11:00:00Z'),
    registrationEnd: new Date('2026-05-08T13:00:00Z'),
    submissionDeadline: new Date('2026-05-10T12:00:00Z'),
    votingStart: new Date('2026-05-11T12:00:00Z'),
    votingEnd: new Date('2026-05-12T12:00:00Z'),
    rules: [],
    judges: [],
    winners: [],
    createdBy: 'user-1',
    createdAt: new Date('2026-05-08T11:00:00Z'),
    updatedAt: new Date('2026-05-08T11:00:00Z'),
    ...overrides,
  } as Battle;
}

function qualifier(overrides: Partial<QualifierTrack>): QualifierTrack {
  return {
    id: 'qualifier-sp-2026-freestyle',
    slug: 'sp-freestyle-2026',
    seasonId: 'season-2026',
    seasonYear: 2026,
    category: 'freestyle',
    region: 'SP',
    status: 'registration_open',
    entryFeeCents: 400,
    registrationDeadline: new Date('2026-05-09T12:00:00Z'),
    bracketStart: new Date('2026-06-01T12:00:00Z'),
    bracketEnd: new Date('2026-07-12T12:00:00Z'),
    maxQualified: 64,
    dailyMatchLimit: 5,
    plannedMatchDays: 0,
    plannedMatchCount: 0,
    currentRound: 0,
    registeredCount: 0,
    confirmedCount: 0,
    pendingPaymentCount: 0,
    createdAt: new Date('2026-05-08T11:00:00Z'),
    updatedAt: new Date('2026-05-08T11:00:00Z'),
    ...overrides,
  } as QualifierTrack;
}

function championship(overrides: Partial<Championship>): Championship {
  return {
    id: 'championship-sp-2026-freestyle',
    title: 'Campeonato Regional SP Freestyle 2026',
    description: '',
    seasonId: '2026',
    category: 'freestyle',
    scope: 'regional',
    region: 'SP',
    status: 'upcoming',
    dateStatus: 'scheduled',
    schedule: {
      registrationStart: new Date('2026-06-01T12:00:00Z'),
      registrationEnd: new Date('2026-07-19T12:00:00Z'),
      start: new Date('2026-07-20T12:00:00Z'),
      end: new Date('2026-09-27T12:00:00Z'),
    },
    maxParticipants: 64,
    currentParticipants: 0,
    participantIds: [],
    qualifierBattleIds: [],
    prizePool: 0,
    prizeDistribution: null,
    createdBy: 'admin-local',
    createdAt: new Date('2026-05-08T11:00:00Z'),
    updatedAt: new Date('2026-05-08T11:00:00Z'),
    ...overrides,
  } as Championship;
}

describe('getHeaderTickerItems', () => {
  it('sorts battles, qualifiers, and championships by the next closest datetime', () => {
    const items = getHeaderTickerItems({
      now,
      battles: [battle({ id: 'battle-later', title: 'Batalha Depois' })],
      qualifierTracks: [qualifier({ id: 'qualifier-next', slug: 'sp-freestyle-2026' })],
      championships: [championship({ id: 'championship-last' })],
    });

    expect(items.map((item) => item.id)).toEqual([
      'qualifier:qualifier-next',
      'battle:battle-later',
      'championship:championship-last',
    ]);
  });

  it('uses the submission deadline as the next battle date while registration is open', () => {
    const items = getHeaderTickerItems({
      now,
      battles: [
        battle({
          registrationEnd: new Date('2026-05-08T12:05:00Z'),
          submissionDeadline: new Date('2026-05-10T12:00:00Z'),
        }),
      ],
      qualifierTracks: [],
      championships: [],
    });

    expect(items[0]?.statusLabel).toBe('Envios');
    expect(items[0]?.nextAt.toISOString()).toBe('2026-05-10T12:00:00.000Z');
  });

  it('puts the logged user birth-state qualifiers first, then sorts same-date items by participants', () => {
    const items = getHeaderTickerItems({
      now,
      preferredRegion: 'RJ',
      battles: [],
      qualifierTracks: [
        qualifier({
          id: 'qualifier-sp-small',
          slug: 'sp-freestyle-2026',
          region: 'SP',
          confirmedCount: 2,
          pendingPaymentCount: 1,
        }),
        qualifier({
          id: 'qualifier-rj-user-state',
          slug: 'rj-freestyle-2026',
          region: 'RJ',
          confirmedCount: 1,
        }),
        qualifier({
          id: 'qualifier-mg-large',
          slug: 'mg-freestyle-2026',
          region: 'MG',
          confirmedCount: 9,
        }),
      ],
      championships: [],
    });

    expect(items.map((item) => item.id)).toEqual([
      'qualifier:qualifier-rj-user-state',
      'qualifier:qualifier-mg-large',
      'qualifier:qualifier-sp-small',
    ]);
  });

  it('skips undated national championships until they have a real schedule', () => {
    const items = getHeaderTickerItems({
      now,
      battles: [],
      qualifierTracks: [],
      championships: [
        championship({
          id: 'national-undated',
          scope: 'national',
          region: null,
          dateStatus: 'to_be_defined',
        }),
      ],
    });

    expect(items).toEqual([]);
  });
});

describe('getUpcomingEventItems', () => {
  it('returns all upcoming events without the header limit', () => {
    const items = getUpcomingEventItems({
      now,
      battles: Array.from({ length: 9 }, (_, index) =>
        battle({
          id: `battle-${index + 1}`,
          title: `Batalha ${index + 1}`,
          submissionDeadline: new Date(`2026-05-${String(10 + index).padStart(2, '0')}T12:00:00Z`),
        }),
      ),
      qualifierTracks: [qualifier({ id: 'qualifier-next' })],
      championships: [championship({ id: 'championship-later' })],
    });

    expect(items).toHaveLength(11);
    expect(items[0]?.id).toBe('qualifier:qualifier-next');
  });
});
