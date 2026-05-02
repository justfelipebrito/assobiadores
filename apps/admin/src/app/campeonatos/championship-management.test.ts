import { describe, expect, it } from 'vitest';
import {
  buildMatchPayload,
  buildStagePayload,
  canFinalizeChampionship,
  canFinalizeMatch,
  createDefaultMatchFormValues,
  createDefaultStageFormValues,
  getMatchStatusLabel,
  getMatchTitle,
  getStageProgress,
  parseParticipantIds,
} from './championship-management';

describe('championship management helpers', () => {
  it('parses participant ids from comma or newline separated text', () => {
    expect(parseParticipantIds('user-a, user-b\nuser-c\n\n')).toEqual([
      'user-a',
      'user-b',
      'user-c',
    ]);
  });

  it('builds stage payloads with numeric order and participants', () => {
    expect(
      buildStagePayload({
        ...createDefaultStageFormValues(2),
        participantIdsText: 'user-a,user-b',
      }),
    ).toEqual({
      name: 'Fase de Grupos',
      type: 'group',
      status: 'pending',
      order: 2,
      participantIds: ['user-a', 'user-b'],
    });
  });

  it('rejects invalid stage order', () => {
    expect(() =>
      buildStagePayload({
        ...createDefaultStageFormValues(1),
        order: '-1',
      }),
    ).toThrow('Ordem da fase');
  });

  it('builds match payloads with schedule and optional battle link', () => {
    const payload = buildMatchPayload({
      ...createDefaultMatchFormValues(new Date('2026-01-01T12:00:00Z')),
      scheduledAt: '2026-01-02T14:30',
      participantIdsText: 'user-a\nuser-b',
      battleId: ' battle-1 ',
    });

    expect(payload).toMatchObject({
      participantIds: ['user-a', 'user-b'],
      battleId: 'battle-1',
      status: 'scheduled',
      winnerId: null,
      scores: {},
    });
    expect(payload.scheduledAt).toBeInstanceOf(Date);
  });

  it('requires at least two match participants', () => {
    expect(() =>
      buildMatchPayload({
        ...createDefaultMatchFormValues(),
        participantIdsText: 'user-a',
      }),
    ).toThrow('pelo menos dois competidores');
  });

  it('summarizes stage progress from match statuses', () => {
    expect(
      getStageProgress([
        { status: 'finished' },
        { status: 'active' },
        { status: 'scheduled' },
        { status: 'voting' },
      ]),
    ).toEqual({ total: 4, finished: 1, active: 2, percent: 25 });
    expect(getStageProgress([])).toEqual({ total: 0, finished: 0, active: 0, percent: 0 });
  });

  it('formats match display labels', () => {
    expect(getMatchTitle({ participantIds: ['user-a', 'user-b'] })).toBe('user-a vs user-b');
    expect(getMatchTitle({ participantIds: [] })).toBe('Partida sem competidores');
    expect(getMatchStatusLabel('voting')).toBe('Em votacao');
  });

  it('allows finalization only for voting matches', () => {
    expect(canFinalizeMatch({ status: 'voting' })).toBe(true);
    expect(canFinalizeMatch({ status: 'active' })).toBe(false);
    expect(canFinalizeMatch({ status: 'finished' })).toBe(false);
  });

  it('allows championship finalization only when every stage is finished', () => {
    expect(canFinalizeChampionship({ status: 'active' }, [{ status: 'finished' }])).toBe(true);
    expect(canFinalizeChampionship({ status: 'active' }, [{ status: 'active' }])).toBe(false);
    expect(canFinalizeChampionship({ status: 'finished' }, [{ status: 'finished' }])).toBe(false);
    expect(canFinalizeChampionship({ status: 'active' }, [])).toBe(false);
  });
});
