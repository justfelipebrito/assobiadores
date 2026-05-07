const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const SEASON_ID = '2026';

const CATEGORIES = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'melodia', label: 'Melodia' },
  { value: 'passaros', label: 'Pássaros' },
];

const STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

function initialize() {
  if (getApps().length > 0) return;

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: PROJECT_ID || 'demo-batalha' });
    return;
  }

  if (!PROJECT_ID) {
    throw new Error('Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT before seeding production.');
  }

  initializeApp({
    projectId: PROJECT_ID,
    credential: applicationDefault(),
  });
}

function buildChampionshipIds() {
  return [
    ...CATEGORIES.map((category) => `championship-national-2026-${category.value}`),
    ...STATES.flatMap((state) =>
      CATEGORIES.map((category) => `championship-${state.toLowerCase()}-2026-${category.value}`),
    ),
  ];
}

function buildChampionships(now) {
  const regionalSchedule = {
    registrationStart: Timestamp.fromDate(new Date('2026-06-01T00:00:00-03:00')),
    registrationEnd: Timestamp.fromDate(new Date('2026-07-19T23:59:59-03:00')),
    start: Timestamp.fromDate(new Date('2026-07-20T00:00:00-03:00')),
    end: Timestamp.fromDate(new Date('2026-09-27T23:59:59-03:00')),
  };
  const nationalSchedule = {
    registrationStart: Timestamp.fromDate(new Date('2026-10-01T00:00:00-03:00')),
    registrationEnd: Timestamp.fromDate(new Date('2026-10-01T00:00:00-03:00')),
    start: Timestamp.fromDate(new Date('2026-10-01T00:00:00-03:00')),
    end: Timestamp.fromDate(new Date('2026-12-31T23:59:59-03:00')),
  };

  const base = {
    seasonId: SEASON_ID,
    status: 'upcoming',
    maxParticipants: 64,
    currentParticipants: 0,
    participantIds: [],
    qualifierBattleIds: [],
    prizePool: 0,
    prizeDistribution: { first: 50, second: 30, third: 20 },
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  };

  return [
    ...CATEGORIES.map((category) => ({
      ...base,
      id: `championship-national-2026-${category.value}`,
      title: `Campeonato Nacional ${category.label} 2026`,
      description: `Temporada nacional oficial de ${category.label} com vagas pelos Regionais.`,
      category: category.value,
      scope: 'national',
      region: null,
      dateStatus: 'to_be_defined',
      schedule: nationalSchedule,
    })),
    ...STATES.flatMap((state) =>
      CATEGORIES.map((category) => ({
        ...base,
        id: `championship-${state.toLowerCase()}-2026-${category.value}`,
        title: `Campeonato Regional ${state} ${category.label} 2026`,
        description: `Liga regional ${state} em ${category.label} para a temporada oficial.`,
        category: category.value,
        scope: 'regional',
        region: state,
        dateStatus: 'scheduled',
        schedule: regionalSchedule,
      })),
    ),
  ];
}

async function main() {
  initialize();
  const db = getFirestore();
  const now = Timestamp.now();
  const championshipIds = buildChampionshipIds();

  await db.collection('seasons').doc(SEASON_ID).set(
    {
      id: SEASON_ID,
      name: 'Temporada 2026',
      slug: '2026',
      scope: 'national',
      region: null,
      status: 'active',
      start: Timestamp.fromDate(new Date('2026-05-01T00:00:00-03:00')),
      end: Timestamp.fromDate(new Date('2026-12-31T23:59:59-03:00')),
      championshipIds,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const championships = buildChampionships(now);
  const batch = db.batch();
  for (const championship of championships) {
    batch.set(db.collection('championships').doc(championship.id), championship, { merge: true });
  }
  await batch.commit();

  console.log(
    `Seeded official 2026 catalog: ${championships.length} championships in project ${
      PROJECT_ID || 'demo-batalha'
    }.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
