const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const DEFAULT_PROJECT_ID = 'assobiadores-3f0f6';
const SEASON_ID = 'season-2026';
const SEASON_YEAR = 2026;

const CATEGORIES = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'melodia', label: 'Melodia' },
  { value: 'passaros', label: 'Passaros' },
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

const DEFAULT_SCHEDULE = {
  registrationDeadline: '2026-06-01T02:59:59.000Z',
  bracketStart: '2026-06-01T03:00:00.000Z',
  bracketEnd: '2026-07-13T02:59:59.000Z',
};

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getArgValue(name, fallback) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function parseDate(name, value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid ISO date. Received: ${value}`);
  }
  return date;
}

function getSchedule() {
  const registrationDeadline = parseDate(
    'registrationDeadline',
    getArgValue('--registrationDeadline', process.env.QUALIFIER_REGISTRATION_DEADLINE || DEFAULT_SCHEDULE.registrationDeadline),
  );
  const bracketStart = parseDate(
    'bracketStart',
    getArgValue('--bracketStart', process.env.QUALIFIER_BRACKET_START || DEFAULT_SCHEDULE.bracketStart),
  );
  const bracketEnd = parseDate(
    'bracketEnd',
    getArgValue('--bracketEnd', process.env.QUALIFIER_BRACKET_END || DEFAULT_SCHEDULE.bracketEnd),
  );

  if (registrationDeadline > bracketStart) {
    throw new Error('registrationDeadline must be before or equal to bracketStart.');
  }
  if (bracketEnd < bracketStart) {
    throw new Error('bracketEnd must be after or equal to bracketStart.');
  }

  return { registrationDeadline, bracketStart, bracketEnd };
}

function initialize(projectId) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Refusing to run production qualifier seed with FIRESTORE_EMULATOR_HOST set.');
  }

  if (getApps().length > 0) return;

  initializeApp({
    projectId,
    credential: applicationDefault(),
  });
}

function getQualifierTrackId(region, category) {
  return `qualifier-${region.toLowerCase()}-${SEASON_YEAR}-${category}`;
}

function buildTrackPatch({ region, category, schedule, now, exists }) {
  const base = {
    id: getQualifierTrackId(region, category.value),
    slug: `${region.toLowerCase()}-${category.value}-${SEASON_YEAR}`,
    seasonId: SEASON_ID,
    seasonYear: SEASON_YEAR,
    category: category.value,
    region,
    entryFeeCents: 400,
    registrationDeadline: Timestamp.fromDate(schedule.registrationDeadline),
    bracketStart: Timestamp.fromDate(schedule.bracketStart),
    bracketEnd: Timestamp.fromDate(schedule.bracketEnd),
    maxQualified: 64,
    updatedAt: now,
  };

  if (exists) return base;

  return {
    ...base,
    status: 'registration_open',
    dailyMatchLimit: 5,
    plannedMatchDays: 0,
    plannedMatchCount: 0,
    currentRound: 0,
    registeredCount: 0,
    confirmedCount: 0,
    pendingPaymentCount: 0,
    createdAt: now,
  };
}

async function main() {
  const projectId =
    getArgValue('--project', process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) ||
    DEFAULT_PROJECT_ID;
  const confirmed = hasFlag('--confirm');
  const dryRun = !confirmed || hasFlag('--dry-run');
  const schedule = getSchedule();

  initialize(projectId);

  const db = getFirestore();
  const now = Timestamp.now();
  const refs = STATES.flatMap((region) =>
    CATEGORIES.map((category) => ({
      region,
      category,
      ref: db.collection('qualifierTracks').doc(getQualifierTrackId(region, category.value)),
    })),
  );
  const snapshots = await db.getAll(...refs.map((item) => item.ref));
  const missingRefs = refs.filter((_, index) => !snapshots[index].exists);
  const existingCount = refs.length - missingRefs.length;
  const missingCount = missingRefs.length;

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Preparing ${refs.length} qualifier tracks in project ${projectId}.`,
  );
  console.log(
    `Schedule: registrationDeadline=${schedule.registrationDeadline.toISOString()}, bracketStart=${schedule.bracketStart.toISOString()}, bracketEnd=${schedule.bracketEnd.toISOString()}`,
  );
  console.log(`Existing tracks: ${existingCount}. Missing tracks to create: ${missingCount}.`);

  if (dryRun) {
    console.log('No production writes were made. Re-run with --confirm to create missing tracks only.');
    return;
  }

  const batch = db.batch();
  missingRefs.forEach((item) => {
    batch.set(
      item.ref,
      buildTrackPatch({
        region: item.region,
        category: item.category,
        schedule,
        now,
        exists: false,
      }),
      { merge: true },
    );
  });
  await batch.commit();

  console.log(
    `Seeded missing qualifier tracks in project ${projectId}. Created ${missingCount}, left ${existingCount} existing tracks untouched.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
