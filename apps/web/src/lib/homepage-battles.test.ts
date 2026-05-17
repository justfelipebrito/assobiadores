import { describe, expect, it } from 'vitest';
import type { Battle } from '@batalha/types';
import {
  getHomepageBattleCards,
  getHomepageOfficialBattleHeroItems,
  getOfficialBattleHeroActionLabel,
} from './homepage-battles';

function battle(input: Partial<Battle> & Pick<Battle, 'id' | 'title' | 'type' | 'status'>): Battle {
  const now = new Date('2026-05-16T12:00:00.000Z');
  return {
    ...input,
    id: input.id,
    title: input.title,
    description: '',
    type: input.type,
    format: 'group',
    category: 'freestyle',
    status: input.status,
    entryFee: 0,
    prizePool: 0,
    prizeDistribution: null,
    votingType: 'public',
    visibility: 'public',
    maxParticipants: 64,
    currentParticipants: 0,
    registrationStart: input.registrationStart ?? now,
    registrationEnd: input.registrationEnd ?? new Date('2026-05-20T12:00:00.000Z'),
    submissionDeadline: input.submissionDeadline ?? new Date('2026-05-21T12:00:00.000Z'),
    votingStart: input.votingStart ?? new Date('2026-05-21T13:00:00.000Z'),
    votingEnd: input.votingEnd ?? new Date('2026-05-22T12:00:00.000Z'),
    rules: [],
    judges: [],
    winners: [],
    createdBy: 'admin',
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

describe('homepage battle helpers', () => {
  it('orders active homepage battle cards with official battles first', () => {
    const communityNewest = battle({
      id: 'community-new',
      title: 'Community New',
      type: 'community',
      status: 'registration',
    });
    const officialOlder = battle({
      id: 'official-old',
      title: 'Official Old',
      type: 'official',
      status: 'registration',
    });
    const finishedOfficial = battle({
      id: 'finished',
      title: 'Finished',
      type: 'official',
      status: 'finished',
    });

    expect(getHomepageBattleCards([communityNewest, officialOlder, finishedOfficial])).toEqual([
      officialOlder,
      communityNewest,
    ]);
  });

  it('selects official hero battles by the closest registration or voting deadline', () => {
    const votingSoon = battle({
      id: 'voting-soon',
      title: 'Voting Soon',
      type: 'official',
      status: 'voting',
      votingEnd: new Date('2026-05-16T14:00:00.000Z'),
    });
    const registrationLater = battle({
      id: 'registration-later',
      title: 'Registration Later',
      type: 'official',
      status: 'registration',
      registrationEnd: new Date('2026-05-17T12:00:00.000Z'),
    });
    const communitySoon = battle({
      id: 'community-soon',
      title: 'Community Soon',
      type: 'community',
      status: 'voting',
      votingEnd: new Date('2026-05-16T13:00:00.000Z'),
    });
    const activeOfficial = battle({
      id: 'active-official',
      title: 'Active Official',
      type: 'official',
      status: 'active',
    });

    expect(
      getHomepageOfficialBattleHeroItems({
        battles: [registrationLater, communitySoon, activeOfficial, votingSoon],
        now: new Date('2026-05-16T12:00:00.000Z'),
      }).map((item) => item.id),
    ).toEqual(['voting-soon', 'registration-later']);
  });

  it('uses a voting CTA while official hero battles are in voting', () => {
    expect(getOfficialBattleHeroActionLabel(battle({
      id: 'vote',
      title: 'Vote',
      type: 'official',
      status: 'voting',
    }))).toBe('Votar');
    expect(getOfficialBattleHeroActionLabel(battle({
      id: 'join',
      title: 'Join',
      type: 'official',
      status: 'registration',
    }))).toBe('Participar');
  });
});
