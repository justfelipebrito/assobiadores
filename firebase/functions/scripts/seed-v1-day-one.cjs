const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ||= 'demo-batalha';

if (getApps().length === 0) {
  initializeApp({ projectId: 'demo-batalha' });
}

const auth = getAuth();
const db = getFirestore();

const SAMPLE_AUDIO_URL = '/sample-audio/assobio.wav';
const SAMPLE_AUDIO_PATH = 'public/sample-audio/assobio.wav';
const SEASON_ID = '2026';
const QUALIFIER_SEASON_ID = 'season-2026';

const CATEGORIES = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'melodia', label: 'Melodia' },
  { value: 'passaros', label: 'Pássaros' },
];

const STATES = ['SP', 'RJ', 'MG', 'BA', 'RS'];
const ALL_STATES = [
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

function normalizeUsername(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

function rankFor(points) {
  if (points >= 25000) return 'Lenda do Assobio';
  if (points >= 10000) return 'Mestre';
  if (points >= 1000) return 'Profissional';
  if (points >= 50) return 'Aprendiz';
  return 'Iniciante';
}

function getBrazilDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function userProfile(userId) {
  if (userId === 'admin-local') return { displayName: 'Admin Local', state: 'SP' };
  if (userId === 'user-local') return { displayName: 'User Local', state: 'SP' };
  if (userId === 'voter-local') return { displayName: 'Voter Local', state: 'RJ' };
  const number = Number(userId.replace('qa-rank-', ''));
  const state = ALL_STATES[(number - 1) % ALL_STATES.length] ?? 'SP';
  return {
    displayName: `Assobiador ${String(number).padStart(3, '0')}`,
    state,
  };
}

function rankingPoints(index) {
  const rankSeed = Math.max(1, 501 - index);
  return {
    freestyle: 1000 + rankSeed * 17,
    melodia: 700 + rankSeed * 11,
    passaros: 400 + rankSeed * 7,
  };
}

function buildSeasonCategoryPoints(pointsByCategory) {
  const total =
    pointsByCategory.freestyle + pointsByCategory.melodia + pointsByCategory.passaros;
  return {
    seasonPoints: {
      [SEASON_ID]: {
        points: total,
        xp: total,
        rank: rankFor(total),
        updatedAt: Timestamp.now(),
      },
    },
    seasonCategoryPoints: {
      [SEASON_ID]: {
        freestyle: {
          points: pointsByCategory.freestyle,
          xp: pointsByCategory.freestyle,
          rank: rankFor(pointsByCategory.freestyle),
          updatedAt: Timestamp.now(),
        },
        melodia: {
          points: pointsByCategory.melodia,
          xp: pointsByCategory.melodia,
          rank: rankFor(pointsByCategory.melodia),
          updatedAt: Timestamp.now(),
        },
        passaros: {
          points: pointsByCategory.passaros,
          xp: pointsByCategory.passaros,
          rank: rankFor(pointsByCategory.passaros),
          updatedAt: Timestamp.now(),
        },
      },
    },
  };
}

async function clearCollection(name) {
  const snapshot = await db.collection(name).get();
  while (!snapshot.empty) {
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    const next = await db.collection(name).get();
    if (next.size === snapshot.size) break;
    return clearCollection(name);
  }
}

async function clearSeasonRankings() {
  await clearCollection(`seasonRankings/${SEASON_ID}/users`);
  await clearCollection('seasonRankings');
}

async function resetCollections() {
  const collections = [
    'battleEntries',
    'battleInvites',
    'battles',
    'championships',
    'dailyHighlightLikes',
    'dailyHighlights',
    'payments',
    'qualifierMatches',
    'qualifierParticipants',
    'qualifierRegistrations',
    'qualifierSubmissions',
    'qualifierTracks',
    'qualifierVotes',
    'seasons',
    'submissionReports',
    'submissions',
    'userPrivate',
    'usernames',
    'users',
    'votes',
  ];

  for (const collectionName of collections) {
    await clearCollection(collectionName);
  }

  await clearSeasonRankings();
}

async function upsertAuthUser({ uid, email, password, displayName }) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password, displayName });
  } catch {
    await auth.createUser({ uid, email, password, displayName });
  }
}

async function seedUser({
  uid,
  email,
  displayName,
  role = 'user',
  state = 'SP',
  city = 'Sao Paulo',
  pointsByCategory = { freestyle: 0, melodia: 0, passaros: 0 },
}) {
  await upsertAuthUser({ uid, email, password: 'password123', displayName });

  const username = normalizeUsername(displayName || uid);
  const [firstName = '', ...surnameParts] = displayName.split(' ');
  const surname = surnameParts.join(' ');
  const ranking = buildSeasonCategoryPoints(pointsByCategory);
  const total = Object.values(pointsByCategory).reduce((sum, points) => sum + points, 0);

  await db.collection('users').doc(uid).set({
    id: uid,
    schemaVersion: 1,
    username,
    usernameLower: username,
    usernameChangeAvailableAt: null,
    firstName,
    surname,
    email,
    displayName,
    photoURL: null,
    photoPath: null,
    photoVersion: 0,
    photoUpdatedAt: null,
    photoChangeAvailableAt: null,
    bio: '',
    role,
    accountType: role === 'admin' ? 'admin' : 'free',
    plan: role === 'admin' ? 'organization' : 'free',
    state,
    birthState: state,
    addressChangeAvailableAt: null,
    city,
    country: 'BR',
    officialProfile: {
      eligible: role === 'admin',
      verified: role === 'admin',
      state,
      region: state === 'SP' ? 'Sudeste' : null,
    },
    points: total,
    xp: total,
    casualPoints: 0,
    rank: rankFor(total),
    ...ranking,
    stats: {
      battlesEntered: 0,
      battlesWon: 0,
      totalVotesReceived: 0,
      topThreeFinishes: 0,
    },
    badges: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await db.doc(`seasonRankings/${SEASON_ID}/users/${uid}`).set({
    id: uid,
    userId: uid,
    seasonId: SEASON_ID,
    displayName,
    username,
    state,
    birthState: state,
    totalPoints: total,
    xp: total,
    rank: rankFor(total),
    byCategory: {
      freestyle: pointsByCategory.freestyle,
      melodia: pointsByCategory.melodia,
      passaros: pointsByCategory.passaros,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await db.collection('usernames').doc(username).set({
    userId: uid,
    username,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await db.collection('userPrivate').doc(uid).set({
    id: uid,
    cpf: '',
    phone: '',
    pixKey: email,
    address: {
      postalCode: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city,
      state,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

async function seedUsers() {
  await seedUser({
    uid: 'admin-local',
    email: 'admin@example.test',
    displayName: 'Admin Local',
    role: 'admin',
    state: 'SP',
    city: 'Sao Paulo',
  });
  await seedUser({
    uid: 'user-local',
    email: 'user@example.test',
    displayName: 'User Local',
    state: 'SP',
    city: 'Sao Paulo',
  });
  await seedUser({
    uid: 'voter-local',
    email: 'voter@example.test',
    displayName: 'Voter Local',
    state: 'RJ',
    city: 'Rio de Janeiro',
  });

  for (let index = 1; index <= 500; index += 1) {
    const uid = `qa-rank-${String(index).padStart(3, '0')}`;
    const profile = userProfile(uid);
    await seedUser({
      uid,
      email: `qa-rank-${String(index).padStart(3, '0')}@example.test`,
      displayName: profile.displayName,
      state: profile.state,
      city: profile.state === 'SP' ? 'Sao Paulo' : profile.state,
      pointsByCategory: rankingPoints(index),
    });
  }
}

async function seedSeasonsAndChampionships() {
  await db.collection('seasons').doc(SEASON_ID).set({
    id: SEASON_ID,
    name: 'Temporada 2026',
    slug: '2026',
    scope: 'national',
    region: null,
    status: 'active',
    start: Timestamp.fromDate(new Date('2026-05-01T00:00:00-03:00')),
    end: Timestamp.fromDate(new Date('2026-12-31T23:59:59-03:00')),
    championshipIds: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const regionalSchedule = {
    registrationStart: Timestamp.fromDate(new Date('2026-06-01T00:00:00-03:00')),
    registrationEnd: Timestamp.fromDate(new Date('2026-07-19T23:59:59-03:00')),
    start: Timestamp.fromDate(new Date('2026-07-20T00:00:00-03:00')),
    end: Timestamp.fromDate(new Date('2026-09-27T23:59:59-03:00')),
  };

  const nationalSchedule = {
    ...regionalSchedule,
    start: Timestamp.fromDate(new Date('2026-10-05T00:00:00-03:00')),
    end: Timestamp.fromDate(new Date('2026-12-13T23:59:59-03:00')),
  };

  const championships = [
    ...CATEGORIES.map((category) => ({
      id: `championship-national-2026-${category.value}`,
      title: `Campeonato Nacional ${category.label} 2026`,
      description: `Temporada nacional oficial de ${category.label} com vagas por classificatórias.`,
      category: category.value,
      scope: 'national',
      region: null,
      dateStatus: 'to_be_defined',
      schedule: nationalSchedule,
    })),
    ...STATES.flatMap((state) =>
      CATEGORIES.map((category) => ({
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

  await Promise.all(
    championships.map((championship) =>
      db.collection('championships').doc(championship.id).set({
        ...championship,
        seasonId: SEASON_ID,
        status: 'upcoming',
        maxParticipants: 64,
        currentParticipants: 0,
        participantIds: [],
        qualifierBattleIds: [],
        prizePool: 0,
        prizeDistribution: { first: 50, second: 30, third: 20 },
        createdBy: 'admin-local',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }),
    ),
  );
}

async function seedDailyHighlights() {
  const seedDate = new Date();
  const dayKey = getBrazilDayKey(seedDate);

  const docs = Array.from({ length: 50 }).map((_, index) => {
    const userNumber = 101 + index;
    const uid = `qa-rank-${String(userNumber).padStart(3, '0')}`;
    const profile = userProfile(uid);
    const category = CATEGORIES[index % CATEGORIES.length].value;
    const createdAt = Timestamp.fromDate(new Date(seedDate.getTime() + index * 5 * 60 * 1000));
    return {
      id: `daily-v1-${String(index + 1).padStart(2, '0')}`,
      userId: uid,
      userDisplayName: profile.displayName,
      userBirthState: profile.state,
      dayKey,
      category,
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      videoPlatform: 'other',
      status: 'active',
      voteCount: Math.max(0, 50 - index),
      pointsAwarded: 1,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await Promise.all(docs.map((doc) => db.collection('dailyHighlights').doc(doc.id).set(doc)));
}

function battleBase() {
  const now = Date.now();
  return {
    type: 'community',
    format: 'group',
    category: 'freestyle',
    votingType: 'public',
    visibility: 'public',
    registrationStart: Timestamp.fromDate(new Date(now - 60 * 60 * 1000)),
    registrationEnd: Timestamp.fromDate(new Date(now + 24 * 60 * 60 * 1000)),
    submissionDeadline: Timestamp.fromDate(new Date(now + 48 * 60 * 60 * 1000)),
    votingStart: Timestamp.fromDate(new Date(now + 48 * 60 * 60 * 1000)),
    votingEnd: Timestamp.fromDate(new Date(now + 72 * 60 * 60 * 1000)),
    rules: ['Grave áudio de até 2 minutos', 'Sem edição de áudio', 'Respeite os participantes'],
    judges: [],
    winners: [],
    createdBy: 'admin-local',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function prizeDistribution(prizePool) {
  return {
    first: Math.floor(prizePool * 0.5),
    second: Math.floor(prizePool * 0.3),
    third: prizePool - Math.floor(prizePool * 0.5) - Math.floor(prizePool * 0.3),
  };
}

async function seedBattle({ id, overrides, participantIds, paid = false, includeSubmissions = false }) {
  const entryFee = overrides.entryFee ?? 0;
  const confirmedPaidCount = paid ? participantIds.length : 0;
  const prizePool = paid ? Math.floor(confirmedPaidCount * entryFee * 0.8) : 0;
  const platformFeeTotal = paid ? confirmedPaidCount * entryFee - prizePool : 0;

  await db.collection('battles').doc(id).set({
    ...battleBase(),
    id,
    title: overrides.title,
    description: overrides.description,
    status: overrides.status ?? 'registration',
    type: overrides.type ?? 'community',
    format: overrides.format ?? 'group',
    category: overrides.category ?? 'freestyle',
    createdBy: overrides.createdBy ?? 'admin-local',
    maxParticipants: overrides.maxParticipants,
    currentParticipants: participantIds.length,
    entryFee,
    prizePool,
    prizeDistribution: paid ? prizeDistribution(prizePool) : null,
    platformFeeTotal,
    ...(overrides.status === 'active'
      ? {
          registrationStart: Timestamp.fromDate(new Date(Date.now() - 72 * 60 * 60 * 1000)),
          registrationEnd: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
        }
      : {}),
    ...(overrides.status === 'voting'
      ? {
          registrationStart: Timestamp.fromDate(new Date(Date.now() - 96 * 60 * 60 * 1000)),
          registrationEnd: Timestamp.fromDate(new Date(Date.now() - 72 * 60 * 60 * 1000)),
          submissionDeadline: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)),
          votingStart: Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000)),
        }
      : {}),
  });

  await Promise.all(
    participantIds.map(async (userId, index) => {
      const entryId = `entry-${id}-${userId}`;
      const paymentId = paid ? `payment-${id}-${userId}` : null;
      const profile = userProfile(userId);

      await db.collection('battleEntries').doc(entryId).set({
        id: entryId,
        battleId: id,
        userId,
        userDisplayName: profile.displayName,
        paymentId,
        status: 'confirmed',
        createdAt: Timestamp.fromDate(new Date(Date.now() - index * 60 * 1000)),
      });

      if (paid) {
        await db.collection('payments').doc(paymentId).set({
          id: paymentId,
          provider: 'mercado_pago_orders',
          externalId: `order-${id}-${userId}`,
          externalPaymentId: `mp-${id}-${userId}`,
          userId,
          targetType: 'battle_entry',
          targetId: entryId,
          battleId: id,
          entryId,
          qualifierRegistrationId: null,
          amount: entryFee,
          status: 'approved',
          pixQrCode: 'seeded-approved-pix-qr-code',
          pixCopiaECola: `000201.seeded.${id}.${userId}`,
          idempotencyKey: `seeded-${id}-${userId}`,
          webhookReceivedAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }

      if (includeSubmissions) {
        const submissionId = `submission-${id}-${userId}`;
        await db.collection('submissions').doc(submissionId).set({
          id: submissionId,
          battleId: id,
          userId,
          userDisplayName: profile.displayName,
          entryId,
          category: overrides.category ?? 'freestyle',
          mediaType: 'audio',
          mediaURL: SAMPLE_AUDIO_URL,
          mediaPath: SAMPLE_AUDIO_PATH,
          mediaContentType: 'audio/wav',
          mediaDurationSeconds: 5,
          mediaSizeBytes: 2048,
          videoURL: SAMPLE_AUDIO_URL,
          videoPlatform: 'other',
          title: `Assobio ${profile.displayName}`,
          description: '',
          status: 'approved',
          moderationNote: null,
          voteCount: 0,
          reportCount: 0,
          removedAt: null,
          removedBy: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
    }),
  );
}

async function seedBattles() {
  await seedBattle({
    id: 'v1-public-entry-10',
    overrides: {
      title: 'QA Publica Entrada Livre',
      description: 'Batalha pública para testar entrada gratuita no dia um.',
      maxParticipants: 50,
    },
    participantIds: Array.from({ length: 10 }).map((_, i) => `qa-rank-${String(i + 1).padStart(3, '0')}`),
  });

  await seedBattle({
    id: 'v1-paid-entry-20',
    overrides: {
      title: 'QA Paga Entrada Aberta',
      description: 'Batalha paga sem a conta principal, para testar Pix de entrada.',
      maxParticipants: 50,
      entryFee: 400,
    },
    paid: true,
    participantIds: Array.from({ length: 20 }).map((_, i) => `qa-rank-${String(i + 11).padStart(3, '0')}`),
  });

  await seedBattle({
    id: 'v1-paid-main-50',
    overrides: {
      title: 'QA Paga Com Usuario Local',
      description: 'Batalha paga ativa com a conta principal ja confirmada.',
      maxParticipants: 50,
      entryFee: 400,
      status: 'active',
    },
    paid: true,
    participantIds: [
      'user-local',
      ...Array.from({ length: 49 }).map((_, i) => `qa-rank-${String(i + 31).padStart(3, '0')}`),
    ],
  });

  await seedBattle({
    id: 'v1-duel-owner-voting',
    overrides: {
      title: 'QA 1vs1 Owner Votacao',
      description: '1vs1 sem a conta principal como participante, mas criada por ela.',
      maxParticipants: 2,
      format: 'duel',
      createdBy: 'user-local',
      status: 'voting',
    },
    participantIds: ['qa-rank-080', 'qa-rank-081'],
    includeSubmissions: true,
  });
}

async function seedQualifierDayOne() {
  const baseTrack = {
    seasonId: QUALIFIER_SEASON_ID,
    seasonYear: 2026,
    entryFeeCents: 400,
    registrationDeadline: Timestamp.fromDate(new Date('2026-05-31T23:59:59-03:00')),
    bracketStart: Timestamp.fromDate(new Date('2026-06-01T00:00:00-03:00')),
    bracketEnd: Timestamp.fromDate(new Date('2026-07-12T23:59:59-03:00')),
    maxQualified: 64,
    dailyMatchLimit: 5,
    plannedMatchDays: 0,
    plannedMatchCount: 0,
    currentRound: 0,
    registeredCount: 0,
    confirmedCount: 0,
    pendingPaymentCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await Promise.all(
    STATES.flatMap((state) =>
      CATEGORIES.map((category) => {
        const isMainTrack = state === 'SP' && category.value === 'freestyle';
        return db
          .collection('qualifierTracks')
          .doc(`qualifier-${state.toLowerCase()}-2026-${category.value}`)
          .set({
            ...baseTrack,
            id: `qualifier-${state.toLowerCase()}-2026-${category.value}`,
            slug: `${state.toLowerCase()}-${category.value}-2026`,
            region: state,
            category: category.value,
            status: isMainTrack ? 'active' : 'registration_open',
            registeredCount: isMainTrack ? 500 : 0,
            confirmedCount: isMainTrack ? 500 : 0,
            dailyMatchLimit: isMainTrack ? 12 : baseTrack.dailyMatchLimit,
            plannedMatchDays: isMainTrack ? 38 : 0,
            plannedMatchCount: isMainTrack ? 436 : 0,
            currentRound: isMainTrack ? 3 : 0,
          });
      }),
    ),
  );

  const qualifierUsers = [
    'user-local',
    ...Array.from({ length: 499 }).map((_, i) => `qa-rank-${String(i + 1).padStart(3, '0')}`),
  ];
  const activeQualifierUsers = qualifierUsers.slice(0, 128);
  const missingSubmissionUsers = new Set(
    Array.from({ length: 6 }, (_, index) => activeQualifierUsers[index * 20 + 1]).filter(Boolean),
  );
  const walkoverWinnerUsers = new Set(
    Array.from({ length: 6 }, (_, index) => activeQualifierUsers[index * 20]).filter(Boolean),
  );
  const votingNow = new Date();
  const baseDate = new Date(votingNow.getTime() - 3 * 60 * 60 * 1000);
  const submissionDeadline = new Date(votingNow.getTime() - 2 * 60 * 60 * 1000);
  const votingStart = new Date(votingNow.getTime() - 90 * 60 * 1000);
  const votingEnd = new Date(votingNow.getTime() + 6 * 60 * 60 * 1000);

  async function seedHistoricalQualifierMatch({
    roundNumber,
    index,
    first,
    second,
    winner,
    matchDayStart,
  }) {
    const matchId = `qualifier-sp-2026-freestyle-r${roundNumber}-m${index + 1}`;
    const matchDayIndex = matchDayStart + Math.floor(index / 12);
    const matchDateOffset = (matchDayIndex - 1) * 24 * 60 * 60 * 1000;
    const matchScheduledFor = new Date(baseDate.getTime() + matchDateOffset);
    const submissionIds = {};
    const publicVoteCounts = {};

    for (const userId of [first, second]) {
      const submissionId = `qualifier-submission-${matchId}-${userId}`;
      const profile = userProfile(userId);
      submissionIds[userId] = submissionId;
      publicVoteCounts[userId] = userId === winner ? 2 : 1;
      await db.collection('qualifierSubmissions').doc(submissionId).set({
        id: submissionId,
        matchId,
        registrationId: `qualifier-sp-2026-freestyle-${userId}`,
        seasonId: QUALIFIER_SEASON_ID,
        category: 'freestyle',
        region: 'SP',
        roundNumber,
        userId,
        userDisplayName: profile.displayName,
        mediaType: 'audio',
        mediaURL: SAMPLE_AUDIO_URL,
        mediaPath: SAMPLE_AUDIO_PATH,
        mediaContentType: 'audio/wav',
        mediaDurationSeconds: 5,
        mediaSizeBytes: 2048,
        status: 'submitted',
        publicVoteCount: publicVoteCounts[userId],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    await db.collection('qualifierMatches').doc(matchId).set({
      id: matchId,
      seasonId: QUALIFIER_SEASON_ID,
      category: 'freestyle',
      region: 'SP',
      roundNumber,
      roundLabel: `Rodada ${roundNumber}`,
      matchDayIndex,
      sequenceInDay: (index % 12) + 1,
      participantIds: [first, second],
      registrationIds: [
        `qualifier-sp-2026-freestyle-${first}`,
        `qualifier-sp-2026-freestyle-${second}`,
      ],
      status: 'finished',
      scheduledFor: Timestamp.fromDate(matchScheduledFor),
      submissionDeadline: Timestamp.fromDate(submissionDeadline),
      votingStart: Timestamp.fromDate(votingStart),
      votingEnd: Timestamp.fromDate(votingEnd),
      submissionIds,
      publicVoteCounts,
      winnerId: winner,
      walkoverWinnerId: null,
      disqualifiedUserIds: [],
      nextMatchId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  await Promise.all(
    qualifierUsers.map(async (userId, index) => {
      const profile = userProfile(userId);
      const id = `qualifier-sp-2026-freestyle-${userId}`;
      const createdAt = Timestamp.fromDate(new Date(Date.UTC(2026, 4, 4, 10, index, 0)));
      const matchIndex = activeQualifierUsers.indexOf(userId);
      const matchId =
        matchIndex >= 0
          ? `qualifier-sp-2026-freestyle-r3-m${Math.floor(matchIndex / 2) + 1}`
          : null;
      const isWalkoverWinner = walkoverWinnerUsers.has(userId);
      const isWalkoverLoser = missingSubmissionUsers.has(userId);
      const isActiveFinalist = matchIndex >= 0 && !isWalkoverWinner && !isWalkoverLoser;

      await db.collection('qualifierRegistrations').doc(id).set({
        id,
        userId,
        seasonId: QUALIFIER_SEASON_ID,
        category: 'freestyle',
        region: 'SP',
        status: 'confirmed',
        bracketStatus: isWalkoverWinner
          ? 'waiting_draw'
          : isActiveFinalist
            ? 'active'
            : 'eliminated',
        currentRound: matchIndex >= 0 ? (isWalkoverWinner ? 4 : 3) : 2,
        currentMatchId: isWalkoverWinner ? null : matchId,
        matchIds: matchId ? [matchId] : [],
        qualifiedChampionshipId: null,
        entryFeeCents: 400,
        platformFeePercent: 20,
        prizePoolPercent: 80,
        paymentId: `payment-${id}`,
        createdAt,
        updatedAt: createdAt,
      });

      await db.collection('qualifierParticipants').doc(id).set({
        id,
        userId,
        seasonId: QUALIFIER_SEASON_ID,
        seasonYear: 2026,
        category: 'freestyle',
        region: 'SP',
        displayName: profile.displayName,
        rank: rankFor(
          userId.startsWith('qa-rank-') ? rankingPoints(Number(userId.slice(-3))).freestyle : 0,
        ),
        points: userId.startsWith('qa-rank-')
          ? rankingPoints(Number(userId.slice(-3))).freestyle
          : 0,
        confirmedAt: createdAt,
        updatedAt: createdAt,
      });

      await db.collection('payments').doc(`payment-${id}`).set({
        id: `payment-${id}`,
        provider: 'mercado_pago_orders',
        externalId: `order-${id}`,
        externalPaymentId: `mp-${id}`,
        userId,
        targetType: 'qualifier_registration',
        targetId: id,
        battleId: null,
        entryId: null,
        qualifierRegistrationId: id,
        amount: 400,
        status: 'approved',
        pixQrCode: 'seeded-approved-pix-qr-code',
        pixCopiaECola: `000201.seeded.${id}`,
        idempotencyKey: `seeded-${id}`,
        webhookReceivedAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)),
        createdAt,
        updatedAt: Timestamp.now(),
      });
    }),
  );

  const matchPairs = Array.from({ length: 64 }, (_, index) => [
    activeQualifierUsers[index * 2],
    activeQualifierUsers[index * 2 + 1],
  ]);

  const roundOnePairs = Array.from({ length: 244 }, (_, index) => [
    qualifierUsers[index],
    qualifierUsers[index + 256],
  ]);
  const roundTwoPairs = Array.from({ length: 128 }, (_, index) => [
    qualifierUsers[index],
    qualifierUsers[index + 128],
  ]);

  await Promise.all([
    ...roundOnePairs.map(([first, second], index) =>
      seedHistoricalQualifierMatch({
        roundNumber: 1,
        index,
        first,
        second,
        winner: first,
        matchDayStart: 1,
      }),
    ),
    ...roundTwoPairs.map(([first, second], index) =>
      seedHistoricalQualifierMatch({
        roundNumber: 2,
        index,
        first,
        second,
        winner: first,
        matchDayStart: 22,
      }),
    ),
  ]);

  await Promise.all(
    matchPairs.map(async ([first, second], index) => {
      const matchId = `qualifier-sp-2026-freestyle-r3-m${index + 1}`;
      const submissionIds = {};
      const publicVoteCounts = {};
      const usersInMatch = [first, second];
      const missingUsersInMatch = usersInMatch.filter((userId) => missingSubmissionUsers.has(userId));
      const walkoverWinnerId =
        missingUsersInMatch.length === 1
          ? usersInMatch.find((userId) => !missingSubmissionUsers.has(userId))
          : null;
      const matchDayIndex = 33 + Math.floor(index / 12);
      const matchDateOffset = (matchDayIndex - 1) * 24 * 60 * 60 * 1000;
      const matchScheduledFor = new Date(baseDate.getTime() + matchDateOffset);

      for (const userId of usersInMatch) {
        if (!missingSubmissionUsers.has(userId)) {
          const submissionId = `qualifier-submission-${matchId}-${userId}`;
          const profile = userProfile(userId);
          submissionIds[userId] = submissionId;
          publicVoteCounts[userId] = (index + (userId === first ? 2 : 0)) % 9;
          await db.collection('qualifierSubmissions').doc(submissionId).set({
            id: submissionId,
            matchId,
            registrationId: `qualifier-sp-2026-freestyle-${userId}`,
            seasonId: QUALIFIER_SEASON_ID,
            category: 'freestyle',
            region: 'SP',
            roundNumber: 3,
            userId,
            userDisplayName: profile.displayName,
            mediaType: 'audio',
            mediaURL: SAMPLE_AUDIO_URL,
            mediaPath: SAMPLE_AUDIO_PATH,
            mediaContentType: 'audio/wav',
            mediaDurationSeconds: 5,
            mediaSizeBytes: 2048,
            status: 'submitted',
            publicVoteCount: publicVoteCounts[userId],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
      }

      await db.collection('qualifierMatches').doc(matchId).set({
        id: matchId,
        seasonId: QUALIFIER_SEASON_ID,
        category: 'freestyle',
        region: 'SP',
        roundNumber: 3,
        roundLabel: 'Rodada 3',
        matchDayIndex,
        sequenceInDay: (index % 12) + 1,
        participantIds: [first, second],
        registrationIds: [
          `qualifier-sp-2026-freestyle-${first}`,
          `qualifier-sp-2026-freestyle-${second}`,
        ],
        status: walkoverWinnerId ? 'walkover' : 'voting',
        scheduledFor: Timestamp.fromDate(matchScheduledFor),
        submissionDeadline: Timestamp.fromDate(submissionDeadline),
        votingStart: Timestamp.fromDate(votingStart),
        votingEnd: Timestamp.fromDate(votingEnd),
        submissionIds,
        publicVoteCounts,
        winnerId: walkoverWinnerId,
        walkoverWinnerId,
        disqualifiedUserIds: missingUsersInMatch,
        nextMatchId: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }),
  );
}

async function main() {
  console.log('Resetting emulator data for V1 day-one QA...');
  await resetCollections();
  await seedUsers();
  await seedSeasonsAndChampionships();
  await seedDailyHighlights();
  await seedBattles();
  await seedQualifierDayOne();

  console.log('Seeded V1 day-one QA scenario.');
  console.log('Main: user@example.test / password123');
  console.log('Voter: voter@example.test / password123');
  console.log('Admin: admin@example.test / password123');
  console.log('Classificatória contestant track: /classificatorias/sp-freestyle-2026');
  console.log('Public-entry battle: /batalhas/v1-public-entry-10');
  console.log('Paid-entry battle: /batalhas/v1-paid-entry-20');
  console.log('Paid active battle with main account: /batalhas/v1-paid-main-50');
  console.log('Owner-voting 1v1 battle: /batalhas/v1-duel-owner-voting');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
