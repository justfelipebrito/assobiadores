import { describe, expect, it } from 'vitest';
import { BRAZIL_STATE_LABELS } from '@batalha/types';
import {
  buildQualifierTrackFallback,
  MAJOR_QUALIFIER_STATES,
  getAllQualifierTracks,
  getHomepageHeroQualifierTracks,
  getHomepageSectionQualifierTracks,
  getQualifierTrackId,
  getQualifierTrackSlug,
  getQualifierTracksForStates,
  parseQualifierTrackSlug,
  sortQualifierTracksForDiscovery,
} from './qualifier-tracks';

describe('qualifier track helpers', () => {
  it('builds stable public ids and slugs', () => {
    expect(getQualifierTrackId('SP', 'freestyle')).toBe('qualifier-sp-2026-freestyle');
    expect(getQualifierTrackSlug('RJ', 'melodia')).toBe('rj-melodia-2026');
  });

  it('parses only supported qualifier track slugs', () => {
    expect(parseQualifierTrackSlug('sp-freestyle-2026')).toEqual({
      region: 'SP',
      category: 'freestyle',
      seasonYear: 2026,
    });
    expect(parseQualifierTrackSlug('xx-freestyle-2026')).toBeNull();
    expect(parseQualifierTrackSlug('sp-freestyle-2027')).toBeNull();
    expect(parseQualifierTrackSlug('freestyle-2026')).toBeNull();
  });

  it('returns fallback tracks for missing state/category tracks', () => {
    const existing = buildQualifierTrackFallback('SP', 'freestyle');
    existing.confirmedCount = 12;

    const tracks = getQualifierTracksForStates({ tracks: [existing], states: ['SP'] });

    expect(tracks).toHaveLength(3);
    expect(tracks[0]?.confirmedCount).toBe(12);
    expect(tracks[1]?.id).toBe('qualifier-sp-2026-melodia');
    expect(tracks[2]?.id).toBe('qualifier-sp-2026-passaros');
  });

  it('returns every state/category track for public browsing', () => {
    const existing = buildQualifierTrackFallback('RJ', 'melodia');
    existing.confirmedCount = 7;

    const tracks = getAllQualifierTracks([existing]);

    expect(tracks).toHaveLength(Object.keys(BRAZIL_STATE_LABELS).length * 3);
    expect(tracks.find((track) => track.id === existing.id)?.confirmedCount).toBe(7);
    expect(tracks.some((track) => track.id === 'qualifier-ac-2026-freestyle')).toBe(true);
    expect(tracks.some((track) => track.id === 'qualifier-sp-2026-passaros')).toBe(true);
  });

  it('keeps the public discovery states aligned with the homepage priority', () => {
    expect(MAJOR_QUALIFIER_STATES).toEqual(['SP', 'RJ', 'MG', 'BA', 'RS']);
  });

  it('sorts discovery tracks by priority states before the remaining states', () => {
    const tracks = [
      buildQualifierTrackFallback('AC', 'freestyle'),
      buildQualifierTrackFallback('RS', 'melodia'),
      buildQualifierTrackFallback('SP', 'passaros'),
      buildQualifierTrackFallback('BA', 'freestyle'),
    ];

    expect(sortQualifierTracksForDiscovery(tracks).map((track) => track.region)).toEqual([
      'SP',
      'BA',
      'RS',
      'AC',
    ]);
  });

  it('uses the logged user state for the homepage hero qualifier tracks', () => {
    const spFreestyle = buildQualifierTrackFallback('SP', 'freestyle');
    spFreestyle.confirmedCount = 99;
    const rjFreestyle = buildQualifierTrackFallback('RJ', 'freestyle');
    rjFreestyle.confirmedCount = 1;
    const rjMelodia = buildQualifierTrackFallback('RJ', 'melodia');
    rjMelodia.confirmedCount = 4;

    const tracks = getHomepageHeroQualifierTracks({
      tracks: [spFreestyle, rjFreestyle, rjMelodia],
      userBirthState: 'RJ',
    });

    expect(tracks).toHaveLength(3);
    expect(tracks.every((track) => track.region === 'RJ')).toBe(true);
    expect(tracks.map((track) => track.category)).toEqual(['melodia', 'freestyle', 'passaros']);
  });

  it('uses the most active qualifier tracks for anonymous homepage visitors', () => {
    const spFreestyle = buildQualifierTrackFallback('SP', 'freestyle');
    spFreestyle.confirmedCount = 4;
    const rjMelodia = buildQualifierTrackFallback('RJ', 'melodia');
    rjMelodia.confirmedCount = 12;
    const mgPassaros = buildQualifierTrackFallback('MG', 'passaros');
    mgPassaros.pendingPaymentCount = 6;
    const baFreestyle = buildQualifierTrackFallback('BA', 'freestyle');
    baFreestyle.registeredCount = 2;

    const tracks = getHomepageHeroQualifierTracks({
      tracks: [spFreestyle, rjMelodia, mgPassaros, baFreestyle],
    });

    expect(tracks.map((track) => track.id)).toEqual([
      rjMelodia.id,
      mgPassaros.id,
      spFreestyle.id,
    ]);
  });

  it('fills the homepage qualifier section with six tracks while prioritizing the logged user state', () => {
    const baFreestyle = buildQualifierTrackFallback('BA', 'freestyle');
    baFreestyle.confirmedCount = 3;
    const spMelodia = buildQualifierTrackFallback('SP', 'melodia');
    spMelodia.confirmedCount = 10;

    const tracks = getHomepageSectionQualifierTracks({
      tracks: [baFreestyle, spMelodia],
      userBirthState: 'BA',
    });

    expect(tracks).toHaveLength(6);
    expect(tracks.slice(0, 3).map((track) => track.region)).toEqual(['BA', 'BA', 'BA']);
    expect(tracks.slice(3).map((track) => track.region)).toEqual(['SP', 'SP', 'SP']);
    expect(tracks.find((track) => track.id === baFreestyle.id)?.confirmedCount).toBe(3);
    expect(tracks.find((track) => track.id === spMelodia.id)?.confirmedCount).toBe(10);
  });
});
