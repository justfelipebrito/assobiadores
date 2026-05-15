import {
  BRAZIL_STATE_LABELS,
  COMPETITION_CATEGORIES,
  COMPETITION_CATEGORY_LABELS,
  type BrazilState,
  type CompetitionCategory,
  type QualifierTrack,
} from '@batalha/types';

export const QUALIFIER_SEASON_ID = 'season-2026';
export const QUALIFIER_SEASON_YEAR = 2026;
export const QUALIFIER_ENTRY_FEE_CENTS = 400;
export const QUALIFIER_REGISTRATION_DEADLINE_LABEL = '31/05/2026';
export const QUALIFIER_BRACKET_START_LABEL = '01/06/2026';
export const QUALIFIER_BRACKET_END_LABEL = '12/07/2026';
export const QUALIFIER_SUBMISSION_DEADLINE_LABEL = '14:59 BRT';
export const QUALIFIER_VOTING_WINDOW_LABEL = '15:00 - 21:59 BRT';
export const QUALIFIER_FINALIZATION_LABEL = '22:00 BRT';

export const DEFAULT_PUBLIC_QUALIFIER_STATES: BrazilState[] = ['SP', 'RJ'];
export const MAJOR_QUALIFIER_STATES: BrazilState[] = ['SP', 'RJ', 'MG', 'BA', 'RS'];
export const ALL_QUALIFIER_STATES = Object.keys(BRAZIL_STATE_LABELS) as BrazilState[];

export function getQualifierTrackId(region: BrazilState, category: CompetitionCategory) {
  return `qualifier-${region.toLowerCase()}-${QUALIFIER_SEASON_YEAR}-${category}`;
}

export function getQualifierTrackSlug(region: BrazilState, category: CompetitionCategory) {
  return `${region.toLowerCase()}-${category}-${QUALIFIER_SEASON_YEAR}`;
}

export function parseQualifierTrackSlug(slug: string): {
  region: BrazilState;
  category: CompetitionCategory;
  seasonYear: number;
} | null {
  const match = slug.match(/^([a-z]{2})-(freestyle|melodia|passaros)-(\d{4})$/i);
  if (!match) return null;

  const region = match[1]?.toUpperCase() as BrazilState;
  const category = match[2] as CompetitionCategory;
  const seasonYear = Number(match[3]);

  if (!(region in BRAZIL_STATE_LABELS)) return null;
  if (!COMPETITION_CATEGORIES.some((item) => item.value === category)) return null;
  if (seasonYear !== QUALIFIER_SEASON_YEAR) return null;

  return { region, category, seasonYear };
}

export function getQualifierTrackTitle(region: BrazilState, category: CompetitionCategory) {
  return `Classificatória ${BRAZIL_STATE_LABELS[region]} ${COMPETITION_CATEGORY_LABELS[category]} ${QUALIFIER_SEASON_YEAR}`;
}

export function buildQualifierTrackFallback(region: BrazilState, category: CompetitionCategory) {
  return {
    id: getQualifierTrackId(region, category),
    slug: getQualifierTrackSlug(region, category),
    seasonId: QUALIFIER_SEASON_ID,
    seasonYear: QUALIFIER_SEASON_YEAR,
    category,
    region,
    status: 'registration_open',
    entryFeeCents: QUALIFIER_ENTRY_FEE_CENTS,
    registrationDeadline: null,
    bracketStart: null,
    bracketEnd: null,
    maxQualified: 64,
    dailyMatchLimit: 5,
    plannedMatchDays: 0,
    plannedMatchCount: 0,
    currentRound: 0,
    registeredCount: 0,
    confirmedCount: 0,
    pendingPaymentCount: 0,
  } as unknown as QualifierTrack;
}

export function getQualifierTracksForStates({
  tracks,
  states,
}: {
  tracks: QualifierTrack[];
  states: BrazilState[];
}) {
  const byId = new Map(tracks.map((track) => [track.id, track]));

  return states.flatMap((state) =>
    COMPETITION_CATEGORIES.map((category) => {
      const id = getQualifierTrackId(state, category.value);
      return byId.get(id) ?? buildQualifierTrackFallback(state, category.value);
    }),
  );
}

function getQualifierEntryCount(track: Pick<QualifierTrack, 'confirmedCount' | 'pendingPaymentCount' | 'registeredCount'>) {
  return track.confirmedCount + track.pendingPaymentCount || track.registeredCount;
}

function sortQualifierTracksByInterest(a: QualifierTrack, b: QualifierTrack) {
  const entryDiff = getQualifierEntryCount(b) - getQualifierEntryCount(a);
  if (entryDiff !== 0) return entryDiff;
  if (a.region !== b.region) return a.region.localeCompare(b.region);
  return a.category.localeCompare(b.category);
}

export function getHomepageHeroQualifierTracks({
  tracks,
  userBirthState,
  limit = 3,
}: {
  tracks: QualifierTrack[];
  userBirthState?: BrazilState | null;
  limit?: number;
}) {
  if (userBirthState) {
    return getQualifierTracksForStates({ tracks, states: [userBirthState] })
      .sort(sortQualifierTracksByInterest)
      .slice(0, limit);
  }

  const sourceTracks =
    tracks.length > 0
      ? tracks
      : getQualifierTracksForStates({ tracks, states: DEFAULT_PUBLIC_QUALIFIER_STATES });

  return [...sourceTracks].sort(sortQualifierTracksByInterest).slice(0, limit);
}

export function getHomepageSectionQualifierTracks({
  tracks,
  userBirthState,
  limit = 6,
}: {
  tracks: QualifierTrack[];
  userBirthState?: BrazilState | null;
  limit?: number;
}) {
  const states = userBirthState
    ? [
        userBirthState,
        ...DEFAULT_PUBLIC_QUALIFIER_STATES.filter((state) => state !== userBirthState),
      ]
    : DEFAULT_PUBLIC_QUALIFIER_STATES;

  return getQualifierTracksForStates({ tracks, states }).slice(0, limit);
}

export function getAllQualifierTracks(tracks: QualifierTrack[]) {
  return getQualifierTracksForStates({ tracks, states: ALL_QUALIFIER_STATES });
}

export function sortQualifierTracksForDiscovery(
  tracks: QualifierTrack[],
  priorityStates: BrazilState[] = MAJOR_QUALIFIER_STATES,
) {
  const stateRank = new Map(priorityStates.map((state, index) => [state, index]));

  return [...tracks].sort((a, b) => {
    const stateRankA = stateRank.get(a.region) ?? priorityStates.length;
    const stateRankB = stateRank.get(b.region) ?? priorityStates.length;
    if (stateRankA !== stateRankB) return stateRankA - stateRankB;
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    return a.category.localeCompare(b.category);
  });
}

export function getQualifierTrackStatusCopy(track: Pick<QualifierTrack, 'status'>) {
  switch (track.status) {
    case 'registration_open':
      return 'Inscrições abertas';
    case 'draw_pending':
      return 'Sorteio em breve';
    case 'active':
      return 'Confrontos em andamento';
    case 'finished':
      return 'Finalizada';
    default:
      return 'Inscrições abertas';
  }
}
