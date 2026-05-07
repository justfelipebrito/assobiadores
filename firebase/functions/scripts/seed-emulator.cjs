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

const COMPETITION_CATEGORIES = [
  { value: 'freestyle', label: 'Freestyle' },
  { value: 'melodia', label: 'Melodia' },
  { value: 'passaros', label: 'Pássaros' },
];

const SAMPLE_AUDIO_URL = '/sample-audio/assobio.wav';
const SAMPLE_AUDIO_PATH = 'public/sample-audio/assobio.wav';

const QA_USERS = [
  { uid: 'qa-sp-1', email: 'qa1@example.test', displayName: 'Ana Paulista', state: 'SP', city: 'Sao Paulo', points: 92 },
  { uid: 'qa-sp-2', email: 'qa2@example.test', displayName: 'Bruno Santos', state: 'SP', city: 'Campinas', points: 74 },
  { uid: 'qa-sp-3', email: 'qa3@example.test', displayName: 'Carla Lima', state: 'SP', city: 'Santos', points: 58 },
  { uid: 'qa-rj-1', email: 'qa4@example.test', displayName: 'Diego Carioca', state: 'RJ', city: 'Rio de Janeiro', points: 88 },
  { uid: 'qa-rj-2', email: 'qa5@example.test', displayName: 'Elisa Niteroi', state: 'RJ', city: 'Niteroi', points: 47 },
  { uid: 'qa-mg-1', email: 'qa6@example.test', displayName: 'Felipe Mineiro', state: 'MG', city: 'Belo Horizonte', points: 66 },
  { uid: 'qa-ba-1', email: 'qa7@example.test', displayName: 'Gabi Bahia', state: 'BA', city: 'Salvador', points: 39 },
  { uid: 'qa-rs-1', email: 'qa8@example.test', displayName: 'Hugo Gaucho', state: 'RS', city: 'Porto Alegre', points: 55 },
  { uid: 'qa-sp-4', email: 'qa9@example.test', displayName: 'Iara Freitas', state: 'SP', city: 'Ribeirao Preto', points: 31 },
  { uid: 'qa-rj-3', email: 'qa10@example.test', displayName: 'Joao Lapa', state: 'RJ', city: 'Rio de Janeiro', points: 27 },
  { uid: 'qa-sp-5', email: 'qa11@example.test', displayName: 'Kelly Melodia', state: 'SP', city: 'Sao Bernardo', points: 44 },
  { uid: 'qa-mg-2', email: 'qa12@example.test', displayName: 'Leo Passaros', state: 'MG', city: 'Uberlandia', points: 36 },
];

function getUserSeedProfile(userId) {
  if (userId === 'admin-local') {
    return { displayName: 'Admin Local', state: 'SP', points: 150 };
  }
  if (userId === 'user-local') {
    return { displayName: 'User Local', state: 'SP', points: 20 };
  }
  if (userId === 'voter-local') {
    return { displayName: 'Voter Local', state: 'RJ', points: 35 };
  }

  const qaUser = QA_USERS.find((user) => user.uid === userId);
  return {
    displayName: qaUser?.displayName ?? userId,
    state: qaUser?.state ?? 'SP',
    points: qaUser?.points ?? 10,
  };
}

function buildSeasonPoints(points) {
  const rank = points >= 50 ? 'Aprendiz' : 'Iniciante';
  return {
    2026: {
      points,
      xp: points,
      rank,
      updatedAt: Timestamp.now(),
    },
  };
}

function buildSeasonCategoryPoints(points) {
  const freestyle = Math.max(0, points);
  const melodia = Math.max(0, Math.floor(points * 0.65));
  const passaros = Math.max(0, Math.floor(points * 0.35));
  const rankFor = (value) => (value >= 50 ? 'Aprendiz' : 'Iniciante');

  return {
    2026: {
      freestyle: { points: freestyle, xp: freestyle, rank: rankFor(freestyle), updatedAt: Timestamp.now() },
      melodia: { points: melodia, xp: melodia, rank: rankFor(melodia), updatedAt: Timestamp.now() },
      passaros: { points: passaros, xp: passaros, rank: rankFor(passaros), updatedAt: Timestamp.now() },
    },
  };
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

async function clearCollection(name) {
  const snapshot = await db.collection(name).get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}

const BRAZIL_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapa' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceara' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espirito Santo' },
  { value: 'GO', label: 'Goias' },
  { value: 'MA', label: 'Maranhao' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Para' },
  { value: 'PB', label: 'Paraiba' },
  { value: 'PR', label: 'Parana' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piaui' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondonia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'Sao Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

function normalizeUsername(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

async function upsertUser({
  uid,
  email,
  password,
  displayName,
  role = 'user',
  accountType = 'free',
  plan = 'free',
  state = null,
  city = null,
  points = 0,
  casualPoints = 0,
  seasonPoints = {},
  seasonCategoryPoints = {},
}) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password, displayName });
  } catch {
    await auth.createUser({ uid, email, password, displayName });
  }

  const username = normalizeUsername(displayName);
  const [firstName = '', ...surnameParts] = displayName.split(' ');
  const surname = surnameParts.join(' ');

  await db
    .collection('users')
    .doc(uid)
    .set(
      {
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
        accountType,
        plan,
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
        points,
        xp: points,
        casualPoints,
        rank: points >= 50 ? 'Aprendiz' : 'Iniciante',
        seasonPoints,
        seasonCategoryPoints,
        stats: {
          battlesEntered: 0,
          battlesWon: 0,
          totalVotesReceived: 0,
          topThreeFinishes: 0,
        },
        badges: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: false },
    );

  await db.collection('usernames').doc(username).set({
    userId: uid,
    username,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await db
    .collection('userPrivate')
    .doc(uid)
    .set({
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
        city: city || '',
        state,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
}

async function seedSeasons() {
  const now = Date.now();
  const existingSeasons = await db.collection('seasons').get();
  await Promise.all(existingSeasons.docs.map((doc) => doc.ref.delete()));

  await db
    .collection('seasons')
    .doc('2026')
    .set({
      id: '2026',
      name: 'Temporada 2026',
      slug: '2026',
      scope: 'national',
      region: null,
      status: 'active',
      start: Timestamp.fromDate(new Date(now - 7 * 24 * 60 * 60 * 1000)),
      end: Timestamp.fromDate(new Date(now + 90 * 24 * 60 * 60 * 1000)),
      championshipIds: [
        ...COMPETITION_CATEGORIES.map((category) => `championship-national-2026-${category.value}`),
        ...BRAZIL_STATES.flatMap((state) =>
          COMPETITION_CATEGORIES.map(
            (category) => `championship-${state.value.toLowerCase()}-2026-${category.value}`,
          ),
        ),
      ],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
}

async function seedChampionships() {
  const qualifierSchedule = {
    registrationStart: Timestamp.fromDate(new Date('2026-06-01T00:00:00-03:00')),
    registrationEnd: Timestamp.fromDate(new Date('2026-07-19T23:59:59-03:00')),
  };
  const regionalSchedule = {
    ...qualifierSchedule,
    start: Timestamp.fromDate(new Date('2026-07-20T00:00:00-03:00')),
    end: Timestamp.fromDate(new Date('2026-09-27T23:59:59-03:00')),
  };
  const nationalSchedule = {
    ...qualifierSchedule,
    start: Timestamp.fromDate(new Date('2026-10-05T00:00:00-03:00')),
    end: Timestamp.fromDate(new Date('2026-12-13T23:59:59-03:00')),
  };

  const base = {
    seasonId: '2026',
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
  };

  const existingChampionships = await db.collection('championships').get();
  await Promise.all(existingChampionships.docs.map((doc) => doc.ref.delete()));

  const championships = [
    ...COMPETITION_CATEGORIES.map((category) => ({
      id: `championship-national-2026-${category.value}`,
      title: `Campeonato Nacional ${category.label} 2026`,
      description: `Temporada nacional oficial de ${category.label} com vagas por classificatorias.`,
      category: category.value,
      scope: 'national',
      region: null,
      dateStatus: 'to_be_defined',
      schedule: nationalSchedule,
    })),
    ...BRAZIL_STATES.flatMap((state) =>
      COMPETITION_CATEGORIES.map((category) => ({
        id: `championship-${state.value.toLowerCase()}-2026-${category.value}`,
        title: `Campeonato Regional ${state.value} ${category.label} 2026`,
        description: `Liga regional de ${state.label} em ${category.label} para a temporada oficial.`,
        category: category.value,
        scope: 'regional',
        region: state.value,
        dateStatus: 'scheduled',
        schedule: regionalSchedule,
      })),
    ),
  ];

  await Promise.all(
    championships.map((championship) =>
      db
        .collection('championships')
        .doc(championship.id)
        .set({
          ...base,
          ...championship,
        }),
    ),
  );
}

async function seedQualifierTracks() {
  await clearCollection('qualifierTracks');

  const countByTrack = {
    'SP-freestyle': { registeredCount: 9, confirmedCount: 8, pendingPaymentCount: 1 },
    'SP-melodia': { registeredCount: 7, confirmedCount: 6, pendingPaymentCount: 1 },
    'SP-passaros': { registeredCount: 6, confirmedCount: 5, pendingPaymentCount: 1 },
    'RJ-freestyle': { registeredCount: 6, confirmedCount: 5, pendingPaymentCount: 1 },
    'RJ-melodia': { registeredCount: 5, confirmedCount: 4, pendingPaymentCount: 1 },
    'RJ-passaros': { registeredCount: 4, confirmedCount: 3, pendingPaymentCount: 1 },
    'MG-freestyle': { registeredCount: 4, confirmedCount: 4, pendingPaymentCount: 0 },
    'BA-freestyle': { registeredCount: 3, confirmedCount: 3, pendingPaymentCount: 0 },
    'RS-freestyle': { registeredCount: 3, confirmedCount: 3, pendingPaymentCount: 0 },
  };

  const tracks = ['SP', 'RJ', 'MG', 'BA', 'RS'].flatMap((state) =>
    COMPETITION_CATEGORIES.map((category) => {
      const id = `qualifier-${state.toLowerCase()}-2026-${category.value}`;
      const count = countByTrack[`${state}-${category.value}`] ?? {
        registeredCount: 0,
        confirmedCount: 0,
        pendingPaymentCount: 0,
      };

      return {
        id,
        slug: `${state.toLowerCase()}-${category.value}-2026`,
        seasonId: 'season-2026',
        seasonYear: 2026,
        category: category.value,
        region: state,
        status: 'registration_open',
        entryFeeCents: 400,
        registrationDeadline: Timestamp.fromDate(new Date('2026-05-31T23:59:59-03:00')),
        bracketStart: Timestamp.fromDate(new Date('2026-06-01T00:00:00-03:00')),
        bracketEnd: Timestamp.fromDate(new Date('2026-07-12T23:59:59-03:00')),
        maxQualified: 64,
        dailyMatchLimit: 5,
        plannedMatchDays:
          count.confirmedCount > 64 ? Math.ceil((count.confirmedCount - 64) / 5) : 0,
        plannedMatchCount: Math.max(0, count.confirmedCount - 64),
        currentRound: 0,
        ...count,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    }),
  );

  await Promise.all(
    tracks.map((track) => db.collection('qualifierTracks').doc(track.id).set(track)),
  );
}

async function seedQualifierParticipants() {
  await clearCollection('qualifierParticipants');

  const trackParticipants = [
    {
      state: 'SP',
      category: 'freestyle',
      userIds: ['admin-local', 'user-local', 'qa-sp-1', 'qa-sp-2', 'qa-sp-3', 'qa-sp-4', 'qa-sp-5', 'qa-mg-1'],
    },
    {
      state: 'SP',
      category: 'melodia',
      userIds: ['user-local', 'qa-sp-1', 'qa-sp-2', 'qa-sp-3', 'qa-sp-5', 'qa-rs-1'],
    },
    {
      state: 'SP',
      category: 'passaros',
      userIds: ['user-local', 'admin-local', 'qa-sp-2', 'qa-sp-5', 'qa-mg-2'],
    },
    {
      state: 'RJ',
      category: 'freestyle',
      userIds: ['voter-local', 'qa-rj-1', 'qa-rj-2', 'qa-rj-3', 'qa-ba-1'],
    },
    {
      state: 'RJ',
      category: 'melodia',
      userIds: ['voter-local', 'qa-rj-1', 'qa-rj-2', 'qa-rj-3'],
    },
    {
      state: 'RJ',
      category: 'passaros',
      userIds: ['voter-local', 'qa-rj-1', 'qa-rj-2'],
    },
    { state: 'MG', category: 'freestyle', userIds: ['qa-mg-1', 'qa-mg-2', 'qa-sp-3', 'qa-rs-1'] },
    { state: 'BA', category: 'freestyle', userIds: ['qa-ba-1', 'qa-rj-2', 'qa-sp-4'] },
    { state: 'RS', category: 'freestyle', userIds: ['qa-rs-1', 'qa-sp-5', 'qa-mg-2'] },
  ];

  await Promise.all(
    trackParticipants.flatMap((track) =>
      track.userIds.map((userId, index) => {
        const profile = getUserSeedProfile(userId);
        const confirmedAt = Timestamp.fromDate(new Date(Date.UTC(2026, 4, 4, 12, index * 10, 0)));

        return db
          .collection('qualifierParticipants')
          .doc(`qualifier-${track.state.toLowerCase()}-2026-${track.category}-${userId}`)
          .set({
            userId,
            seasonId: 'season-2026',
            seasonYear: 2026,
            category: track.category,
            region: track.state,
            displayName: profile.displayName,
            rank: profile.points >= 50 ? 'Aprendiz' : 'Iniciante',
            points: profile.points,
            confirmedAt,
            updatedAt: confirmedAt,
          });
      }),
    ),
  );
}

async function seedQualifierRegistrations() {
  await clearCollection('qualifierRegistrations');

  const registrations = [
    ...[
      ['SP', 'freestyle', ['admin-local', 'user-local', 'qa-sp-1', 'qa-sp-2', 'qa-sp-3', 'qa-sp-4', 'qa-sp-5', 'qa-mg-1']],
      ['SP', 'melodia', ['user-local', 'qa-sp-1', 'qa-sp-2', 'qa-sp-3', 'qa-sp-5', 'qa-rs-1']],
      ['SP', 'passaros', ['user-local', 'admin-local', 'qa-sp-2', 'qa-sp-5', 'qa-mg-2']],
      ['RJ', 'freestyle', ['voter-local', 'qa-rj-1', 'qa-rj-2', 'qa-rj-3', 'qa-ba-1']],
      ['RJ', 'melodia', ['voter-local', 'qa-rj-1', 'qa-rj-2', 'qa-rj-3']],
      ['RJ', 'passaros', ['voter-local', 'qa-rj-1', 'qa-rj-2']],
      ['MG', 'freestyle', ['qa-mg-1', 'qa-mg-2', 'qa-sp-3', 'qa-rs-1']],
      ['BA', 'freestyle', ['qa-ba-1', 'qa-rj-2', 'qa-sp-4']],
      ['RS', 'freestyle', ['qa-rs-1', 'qa-sp-5', 'qa-mg-2']],
    ].flatMap(([state, category, userIds]) =>
      userIds.map((userId) => ({ state, category, userId, status: 'confirmed' })),
    ),
    { state: 'SP', category: 'freestyle', userId: 'qa-rj-1', status: 'pending_payment' },
    { state: 'SP', category: 'melodia', userId: 'qa-rj-2', status: 'pending_payment' },
    { state: 'SP', category: 'passaros', userId: 'qa-rj-3', status: 'pending_payment' },
    { state: 'RJ', category: 'freestyle', userId: 'qa-sp-1', status: 'pending_payment' },
    { state: 'RJ', category: 'melodia', userId: 'qa-sp-2', status: 'pending_payment' },
    { state: 'RJ', category: 'passaros', userId: 'qa-sp-3', status: 'pending_payment' },
  ];

  await Promise.all(
    registrations.map((registration, index) => {
      const id = `qualifier-${registration.state.toLowerCase()}-2026-${registration.category}-${registration.userId}`;
      const createdAt = Timestamp.fromDate(new Date(Date.UTC(2026, 4, 4, 12, index % 60, 0)));
      const confirmed = registration.status === 'confirmed';

      return db.collection('qualifierRegistrations').doc(id).set({
        id,
        userId: registration.userId,
        seasonId: 'season-2026',
        category: registration.category,
        region: registration.state,
        status: registration.status,
        bracketStatus: confirmed ? 'waiting_draw' : 'payment_pending',
        currentRound: 0,
        currentMatchId: null,
        matchIds: [],
        qualifiedChampionshipId: null,
        entryFeeCents: 400,
        platformFeePercent: 20,
        prizePoolPercent: 80,
        paymentId: `payment-${id}`,
        createdAt,
        updatedAt: createdAt,
      });
    }),
  );
}

async function seedQualifierMatches() {
  const existingMatches = await db.collection('qualifierMatches').get();
  await Promise.all(existingMatches.docs.map((doc) => doc.ref.delete()));

  const baseDate = new Date('2026-06-01T00:00:00-03:00');
  const submissionDeadline = new Date('2026-06-01T14:59:00-03:00');
  const votingStart = new Date('2026-06-01T15:00:00-03:00');
  const votingEnd = new Date('2026-06-01T21:59:00-03:00');

  const matches = [
    {
      id: 'qualifier-sp-2026-freestyle-r1-m1',
      participantIds: ['admin-local', 'qa-sp-1'],
      registrationIds: [
        'qualifier-sp-2026-freestyle-admin-local',
        'qualifier-sp-2026-freestyle-qa-sp-1',
      ],
      status: 'voting',
    },
    {
      id: 'qualifier-sp-2026-freestyle-r1-m2',
      participantIds: ['user-local', 'qa-sp-2'],
      registrationIds: [
        'qualifier-sp-2026-freestyle-user-local',
        'qualifier-sp-2026-freestyle-qa-sp-2',
      ],
      status: 'submissions_open',
    },
  ];

  await Promise.all(
    matches.map((match, index) =>
      db
        .collection('qualifierMatches')
        .doc(match.id)
        .set({
          id: match.id,
          seasonId: 'season-2026',
          category: 'freestyle',
          region: 'SP',
          roundNumber: 1,
          roundLabel: 'Rodada 1',
          matchDayIndex: 1,
          sequenceInDay: index + 1,
          participantIds: match.participantIds,
          registrationIds: match.registrationIds,
          status: match.status,
          scheduledFor: Timestamp.fromDate(baseDate),
          submissionDeadline: Timestamp.fromDate(submissionDeadline),
          votingStart: Timestamp.fromDate(votingStart),
          votingEnd: Timestamp.fromDate(votingEnd),
          submissionIds: {},
          publicVoteCounts: {},
          winnerId: null,
          walkoverWinnerId: null,
          disqualifiedUserIds: [],
          nextMatchId: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
    ),
  );
}

async function seedQualifierSubmissions() {
  const existingSubmissions = await db.collection('qualifierSubmissions').get();
  await Promise.all(existingSubmissions.docs.map((doc) => doc.ref.delete()));
  const existingVotes = await db.collection('qualifierVotes').get();
  await Promise.all(existingVotes.docs.map((doc) => doc.ref.delete()));

  const submissions = [
    {
      id: 'qualifier-submission-admin-local',
      userId: 'admin-local',
      displayName: 'Admin Local',
      voteCount: 1,
    },
    {
      id: 'qualifier-submission-qa-sp-1',
      userId: 'qa-sp-1',
      displayName: 'Ana Paulista',
      voteCount: 0,
    },
  ];

  await Promise.all(
    submissions.map((submission) =>
      db
        .collection('qualifierSubmissions')
        .doc(submission.id)
        .set({
          id: submission.id,
          matchId: 'qualifier-sp-2026-freestyle-r1-m1',
          registrationId: `qualifier-sp-2026-freestyle-${submission.userId}`,
          seasonId: 'season-2026',
          category: 'freestyle',
          region: 'SP',
          roundNumber: 1,
          userId: submission.userId,
          userDisplayName: submission.displayName,
          mediaType: 'audio',
          mediaURL: SAMPLE_AUDIO_URL,
          mediaPath: SAMPLE_AUDIO_PATH,
          mediaContentType: 'audio/wav',
          mediaDurationSeconds: 5,
          mediaSizeBytes: 2048,
          status: 'submitted',
          publicVoteCount: submission.voteCount,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
    ),
  );

  await db
    .collection('qualifierMatches')
    .doc('qualifier-sp-2026-freestyle-r1-m1')
    .set(
      {
        submissionIds: {
          'admin-local': 'qualifier-submission-admin-local',
          'qa-sp-1': 'qualifier-submission-qa-sp-1',
        },
        publicVoteCounts: {
          'admin-local': 1,
          'qa-sp-1': 0,
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

  await db.collection('qualifierVotes').doc('qualifier-vote-local-1').set({
    id: 'qualifier-vote-local-1',
    matchId: 'qualifier-sp-2026-freestyle-r1-m1',
    submissionId: 'qualifier-submission-admin-local',
    votedUserId: 'admin-local',
    voterId: 'voter-local',
    voterType: 'public',
    weight: 1,
    createdAt: Timestamp.now(),
  });
}

async function seedPayments() {
  await clearCollection('payments');

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));
  const registrations = await db.collection('qualifierRegistrations').get();
  const payments = registrations.docs.map((doc) => {
    const registration = doc.data();
    const approved = registration.status === 'confirmed';
    const id = `payment-${doc.id}`;

    return {
      id,
      provider: 'mercado_pago_orders',
      externalId: `order-${doc.id}`,
      externalPaymentId: approved ? `mp-${doc.id}` : null,
      userId: registration.userId,
      targetType: 'qualifier_registration',
      targetId: doc.id,
      battleId: null,
      entryId: null,
      qualifierRegistrationId: doc.id,
      amount: 400,
      status: approved ? 'approved' : 'pending',
      pixQrCode: approved ? 'seeded-approved-pix-qr-code' : 'seeded-pending-pix-qr-code',
      pixCopiaECola: `000201.seeded.${doc.id}`,
      idempotencyKey: `seeded-${doc.id}`,
      webhookReceivedAt: approved ? now : null,
      expiresAt,
      createdAt: registration.createdAt ?? now,
      updatedAt: now,
    };
  });

  payments.push(
    {
      id: 'payment-battle-paid-user',
      provider: 'mercado_pago_orders',
      externalId: 'order-battle-paid-user',
      externalPaymentId: 'mp-battle-paid-user',
      userId: 'user-local',
      targetType: 'battle_entry',
      targetId: 'entry-paid-user',
      battleId: 'battle-paid-open',
      entryId: 'entry-paid-user',
      qualifierRegistrationId: null,
      amount: 500,
      status: 'approved',
      pixQrCode: 'seeded-battle-approved-pix-qr-code',
      pixCopiaECola: '000201.seeded.battle.paid.user',
      idempotencyKey: 'seeded-battle-paid-user',
      webhookReceivedAt: now,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'payment-battle-paid-qa-sp-2',
      provider: 'mercado_pago_orders',
      externalId: 'order-battle-paid-qa-sp-2',
      externalPaymentId: null,
      userId: 'qa-sp-2',
      targetType: 'battle_entry',
      targetId: 'entry-paid-qa-sp-2',
      battleId: 'battle-paid-open',
      entryId: 'entry-paid-qa-sp-2',
      qualifierRegistrationId: null,
      amount: 500,
      status: 'pending',
      pixQrCode: 'seeded-battle-pending-pix-qr-code',
      pixCopiaECola: '000201.seeded.battle.paid.qa.sp.2',
      idempotencyKey: 'seeded-battle-paid-qa-sp-2',
      webhookReceivedAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
  );

  await Promise.all(
    payments.map((payment) => db.collection('payments').doc(payment.id).set(payment)),
  );
}

async function seedBattles() {
  await clearCollection('battles');
  const now = Date.now();
  const openStart = Timestamp.fromDate(new Date(now - 60 * 60 * 1000));
  const openEnd = Timestamp.fromDate(new Date(now + 24 * 60 * 60 * 1000));
  const submitEnd = Timestamp.fromDate(new Date(now + 48 * 60 * 60 * 1000));
  const votingStart = Timestamp.fromDate(new Date(now + 48 * 60 * 60 * 1000));
  const votingEnd = Timestamp.fromDate(new Date(now + 72 * 60 * 60 * 1000));

  const base = {
    type: 'official',
    category: 'freestyle',
    status: 'registration',
    votingType: 'public',
    visibility: 'public',
    maxParticipants: 16,
    currentParticipants: 0,
    registrationStart: openStart,
    registrationEnd: openEnd,
    submissionDeadline: submitEnd,
    votingStart,
    votingEnd,
    rules: ['Grave audio de ate 2 minutos', 'Sem edicao de audio', 'Respeite os participantes'],
    judges: [],
    winners: [],
    createdBy: 'admin-local',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await db
    .collection('battles')
    .doc('battle-free-open')
    .set({
      ...base,
      id: 'battle-free-open',
      title: 'Batalha Local Gratis',
      description: 'Batalha gratuita para testar inscricao local.',
      currentParticipants: 3,
      entryFee: 0,
      prizePool: 0,
      prizeDistribution: null,
    });

  await db
    .collection('battles')
    .doc('battle-paid-open')
    .set({
      ...base,
      id: 'battle-paid-open',
      title: 'Batalha Local Paga',
      description: 'Batalha paga para testar Pix local com credenciais sandbox.',
      currentParticipants: 1,
      entryFee: 500,
      prizePool: 400,
      prizeDistribution: { first: 200, second: 120, third: 80 },
      platformFeeTotal: 100,
    });

  await db
    .collection('battles')
    .doc('battle-active-submit')
    .set({
      ...base,
      id: 'battle-active-submit',
      title: 'Batalha Local Envio',
      description: 'Batalha ativa para testar envio e moderacao de audios.',
      status: 'active',
      currentParticipants: 2,
      registrationStart: Timestamp.fromDate(new Date(now - 72 * 60 * 60 * 1000)),
      registrationEnd: Timestamp.fromDate(new Date(now - 24 * 60 * 60 * 1000)),
      submissionDeadline: submitEnd,
      votingStart,
      votingEnd,
      entryFee: 0,
      prizePool: 0,
      prizeDistribution: null,
    });

  await db
    .collection('battles')
    .doc('battle-voting-open')
    .set({
      ...base,
      id: 'battle-voting-open',
      title: 'Batalha Local Votacao',
      description: 'Batalha em votacao para testar votos e resultados.',
      status: 'voting',
      currentParticipants: 8,
      registrationStart: Timestamp.fromDate(new Date(now - 96 * 60 * 60 * 1000)),
      registrationEnd: Timestamp.fromDate(new Date(now - 72 * 60 * 60 * 1000)),
      submissionDeadline: Timestamp.fromDate(new Date(now - 24 * 60 * 60 * 1000)),
      votingStart: Timestamp.fromDate(new Date(now - 60 * 60 * 1000)),
      votingEnd,
      entryFee: 0,
      prizePool: 0,
      prizeDistribution: null,
    });

  await db
    .collection('battles')
    .doc('battle-community-group-open')
    .set({
      ...base,
      id: 'battle-community-group-open',
      title: 'Grupo Comunidade QA',
      description: 'Batalha comunitaria em grupo para testar minimo de 5 participantes.',
      type: 'community',
      category: 'melodia',
      votingType: 'participants',
      maxParticipants: 12,
      currentParticipants: 5,
      entryFee: 0,
      prizePool: 0,
      prizeDistribution: null,
    });

  await db
    .collection('battles')
    .doc('battle-finished-results')
    .set({
      ...base,
      id: 'battle-finished-results',
      title: 'Batalha Finalizada QA',
      description: 'Batalha finalizada para testar tela de resultados e vencedores.',
      status: 'finished',
      currentParticipants: 5,
      registrationStart: Timestamp.fromDate(new Date(now - 9 * 24 * 60 * 60 * 1000)),
      registrationEnd: Timestamp.fromDate(new Date(now - 7 * 24 * 60 * 60 * 1000)),
      submissionDeadline: Timestamp.fromDate(new Date(now - 5 * 24 * 60 * 60 * 1000)),
      votingStart: Timestamp.fromDate(new Date(now - 4 * 24 * 60 * 60 * 1000)),
      votingEnd: Timestamp.fromDate(new Date(now - 3 * 24 * 60 * 60 * 1000)),
      winners: ['qa-sp-1', 'qa-rj-1', 'qa-mg-1'],
      entryFee: 0,
      prizePool: 0,
      prizeDistribution: null,
    });
}

async function seedBattleEntries() {
  await clearCollection('battleEntries');
  const entries = [
    { id: 'entry-free-user', battleId: 'battle-free-open', userId: 'user-local' },
    { id: 'entry-free-qa-sp-1', battleId: 'battle-free-open', userId: 'qa-sp-1' },
    { id: 'entry-free-qa-rj-1', battleId: 'battle-free-open', userId: 'qa-rj-1' },
    { id: 'entry-paid-user', battleId: 'battle-paid-open', userId: 'user-local', paymentId: 'payment-battle-paid-user', status: 'confirmed' },
    { id: 'entry-paid-qa-sp-2', battleId: 'battle-paid-open', userId: 'qa-sp-2', paymentId: 'payment-battle-paid-qa-sp-2', status: 'pending_payment' },
    { id: 'entry-active-user', battleId: 'battle-active-submit', userId: 'user-local' },
    { id: 'entry-active-voter', battleId: 'battle-active-submit', userId: 'voter-local' },
    { id: 'entry-voting-user', battleId: 'battle-voting-open', userId: 'user-local' },
    { id: 'entry-voting-voter', battleId: 'battle-voting-open', userId: 'voter-local' },
    { id: 'entry-voting-admin', battleId: 'battle-voting-open', userId: 'admin-local' },
    { id: 'entry-voting-qa-sp-1', battleId: 'battle-voting-open', userId: 'qa-sp-1' },
    { id: 'entry-voting-qa-rj-1', battleId: 'battle-voting-open', userId: 'qa-rj-1' },
    { id: 'entry-voting-qa-mg-1', battleId: 'battle-voting-open', userId: 'qa-mg-1' },
    { id: 'entry-voting-qa-ba-1', battleId: 'battle-voting-open', userId: 'qa-ba-1' },
    { id: 'entry-voting-qa-rs-1', battleId: 'battle-voting-open', userId: 'qa-rs-1' },
    { id: 'entry-group-user', battleId: 'battle-community-group-open', userId: 'user-local' },
    { id: 'entry-group-qa-sp-1', battleId: 'battle-community-group-open', userId: 'qa-sp-1' },
    { id: 'entry-group-qa-sp-2', battleId: 'battle-community-group-open', userId: 'qa-sp-2' },
    { id: 'entry-group-qa-rj-1', battleId: 'battle-community-group-open', userId: 'qa-rj-1' },
    { id: 'entry-group-qa-mg-1', battleId: 'battle-community-group-open', userId: 'qa-mg-1' },
    { id: 'entry-finished-qa-sp-1', battleId: 'battle-finished-results', userId: 'qa-sp-1' },
    { id: 'entry-finished-qa-rj-1', battleId: 'battle-finished-results', userId: 'qa-rj-1' },
    { id: 'entry-finished-qa-mg-1', battleId: 'battle-finished-results', userId: 'qa-mg-1' },
    { id: 'entry-finished-qa-ba-1', battleId: 'battle-finished-results', userId: 'qa-ba-1' },
    { id: 'entry-finished-qa-rs-1', battleId: 'battle-finished-results', userId: 'qa-rs-1' },
  ];

  await Promise.all(
    entries.map((entry) =>
      db
        .collection('battleEntries')
        .doc(entry.id)
        .set({
          ...entry,
          userDisplayName: getUserSeedProfile(entry.userId).displayName,
          paymentId: entry.paymentId ?? null,
          status: entry.status ?? 'confirmed',
          createdAt: Timestamp.now(),
        }),
    ),
  );
}

async function seedSubmissionsAndVotes() {
  await clearCollection('submissions');
  await clearCollection('votes');
  await clearCollection('submissionReports');
  const now = Timestamp.now();
  const submissions = [
    {
      id: 'submission-active-reported',
      battleId: 'battle-active-submit',
      userId: 'voter-local',
      userDisplayName: 'Voter Local',
      entryId: 'entry-active-voter',
      category: 'freestyle',
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      title: 'Envio denunciado local',
      description: 'Fixture para testar denuncias na moderacao.',
      status: 'approved',
      moderationNote: null,
      voteCount: 0,
      reportCount: 1,
      removedAt: null,
      removedBy: null,
    },
    {
      id: 'submission-voting-user',
      battleId: 'battle-voting-open',
      userId: 'user-local',
      userDisplayName: 'User Local',
      entryId: 'entry-voting-user',
      category: 'melodia',
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      title: 'Assobio freestyle local',
      description: 'Fixture aprovada para testar votacao.',
      status: 'approved',
      moderationNote: null,
      voteCount: 2,
      reportCount: 0,
      removedAt: null,
      removedBy: null,
    },
    {
      id: 'submission-voting-voter',
      battleId: 'battle-voting-open',
      userId: 'voter-local',
      userDisplayName: 'Voter Local',
      entryId: 'entry-voting-voter',
      category: 'freestyle',
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      title: 'Assobio livre local',
      description: 'Segunda fixture aprovada para testar ranking.',
      status: 'approved',
      moderationNote: null,
      voteCount: 1,
      reportCount: 0,
      removedAt: null,
      removedBy: null,
    },
    {
      id: 'submission-voting-admin',
      battleId: 'battle-voting-open',
      userId: 'admin-local',
      userDisplayName: 'Admin Local',
      entryId: 'entry-voting-admin',
      category: 'passaros',
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      title: 'Assobio tecnico local',
      description: 'Terceira fixture aprovada para preencher os destaques.',
      status: 'approved',
      moderationNote: null,
      voteCount: 0,
      reportCount: 0,
      removedAt: null,
      removedBy: null,
    },
    {
      id: 'submission-removed-local',
      battleId: 'battle-voting-open',
      userId: 'admin-local',
      userDisplayName: 'Admin Local',
      entryId: 'entry-voting-admin',
      category: 'freestyle',
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      title: 'Envio removido local',
      description: 'Fixture removida para testar filtros da moderacao.',
      status: 'removed',
      moderationNote: 'Exemplo de remocao local.',
      voteCount: 0,
      reportCount: 1,
      removedAt: now,
      removedBy: 'admin-local',
    },
    ...[
      ['qa-sp-1', 'Ana Paulista', 'entry-voting-qa-sp-1', 'freestyle', 7],
      ['qa-rj-1', 'Diego Carioca', 'entry-voting-qa-rj-1', 'melodia', 4],
      ['qa-mg-1', 'Felipe Mineiro', 'entry-voting-qa-mg-1', 'passaros', 3],
      ['qa-ba-1', 'Gabi Bahia', 'entry-voting-qa-ba-1', 'freestyle', 1],
      ['qa-rs-1', 'Hugo Gaucho', 'entry-voting-qa-rs-1', 'melodia', 0],
    ].map(([userId, displayName, entryId, category, voteCount]) => ({
      id: `submission-voting-${userId}`,
      battleId: 'battle-voting-open',
      userId,
      userDisplayName: displayName,
      entryId,
      category,
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      title: `Assobio QA ${displayName}`,
      description: 'Fixture de audio para testar votacao com lista maior.',
      status: 'approved',
      moderationNote: null,
      voteCount,
      reportCount: userId === 'qa-ba-1' ? 1 : 0,
      removedAt: null,
      removedBy: null,
    })),
    ...[
      ['qa-sp-1', 'Ana Paulista', 'entry-finished-qa-sp-1', 'freestyle', 12],
      ['qa-rj-1', 'Diego Carioca', 'entry-finished-qa-rj-1', 'melodia', 8],
      ['qa-mg-1', 'Felipe Mineiro', 'entry-finished-qa-mg-1', 'passaros', 5],
      ['qa-ba-1', 'Gabi Bahia', 'entry-finished-qa-ba-1', 'freestyle', 2],
      ['qa-rs-1', 'Hugo Gaucho', 'entry-finished-qa-rs-1', 'melodia', 1],
    ].map(([userId, displayName, entryId, category, voteCount]) => ({
      id: `submission-finished-${userId}`,
      battleId: 'battle-finished-results',
      userId,
      userDisplayName: displayName,
      entryId,
      category,
      mediaType: 'audio',
      mediaURL: SAMPLE_AUDIO_URL,
      mediaPath: SAMPLE_AUDIO_PATH,
      mediaContentType: 'audio/wav',
      mediaDurationSeconds: 5,
      mediaSizeBytes: 2048,
      videoURL: SAMPLE_AUDIO_URL,
      title: `Resultado QA ${displayName}`,
      description: 'Fixture de resultado finalizado.',
      status: 'approved',
      moderationNote: null,
      voteCount,
      reportCount: 0,
      removedAt: null,
      removedBy: null,
    })),
  ];

  await Promise.all(
    submissions.map((submission) =>
      db
        .collection('submissions')
        .doc(submission.id)
        .set({
          ...submission,
          videoPlatform: 'other',
          createdAt: now,
          updatedAt: now,
        }),
    ),
  );

  await Promise.all([
    db.collection('submissionReports').doc('report-local-1').set({
      id: 'report-local-1',
      submissionId: 'submission-active-reported',
      battleId: 'battle-active-submit',
      reporterId: 'user-local',
      reportedUserId: 'voter-local',
      reason: 'platform_rules',
      description: 'Exemplo local de denuncia para QA.',
      status: 'open',
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      reviewedBy: null,
    }),
    db.collection('submissionReports').doc('report-local-reviewed').set({
      id: 'report-local-reviewed',
      submissionId: 'submission-removed-local',
      battleId: 'battle-voting-open',
      reporterId: 'voter-local',
      reportedUserId: 'admin-local',
      reason: 'invalid_media',
      description: 'Exemplo local ja removido.',
      status: 'reviewed',
      createdAt: now,
      updatedAt: now,
      reviewedAt: now,
      reviewedBy: 'admin-local',
    }),
    db.collection('submissionReports').doc('report-local-qa-ba-1').set({
      id: 'report-local-qa-ba-1',
      submissionId: 'submission-voting-qa-ba-1',
      battleId: 'battle-voting-open',
      reporterId: 'qa-sp-2',
      reportedUserId: 'qa-ba-1',
      reason: 'platform_rules',
      description: 'Outro exemplo de denuncia aberta para testar volume.',
      status: 'open',
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      reviewedBy: null,
    }),
  ]);

  const votes = [
    {
      id: 'vote-local-1',
      battleId: 'battle-voting-open',
      submissionId: 'submission-voting-user',
      voterId: 'admin-local',
    },
    {
      id: 'vote-local-2',
      battleId: 'battle-voting-open',
      submissionId: 'submission-voting-user',
      voterId: 'voter-local',
    },
    {
      id: 'vote-local-3',
      battleId: 'battle-voting-open',
      submissionId: 'submission-voting-voter',
      voterId: 'admin-local',
    },
    ...[
      ['submission-voting-qa-sp-1', ['admin-local', 'user-local', 'voter-local', 'qa-sp-2', 'qa-rj-1', 'qa-mg-1', 'qa-ba-1']],
      ['submission-voting-qa-rj-1', ['admin-local', 'user-local', 'qa-sp-1', 'qa-sp-2']],
      ['submission-voting-qa-mg-1', ['user-local', 'voter-local', 'qa-sp-1']],
      ['submission-voting-qa-ba-1', ['admin-local']],
      ['submission-finished-qa-sp-1', ['admin-local', 'user-local', 'voter-local', 'qa-sp-2', 'qa-rj-1', 'qa-mg-1', 'qa-ba-1', 'qa-rs-1', 'qa-sp-3', 'qa-sp-4', 'qa-sp-5', 'qa-rj-2']],
      ['submission-finished-qa-rj-1', ['admin-local', 'user-local', 'voter-local', 'qa-sp-2', 'qa-mg-1', 'qa-ba-1', 'qa-rs-1', 'qa-sp-3']],
      ['submission-finished-qa-mg-1', ['admin-local', 'user-local', 'voter-local', 'qa-sp-2', 'qa-rj-1']],
      ['submission-finished-qa-ba-1', ['admin-local', 'user-local']],
      ['submission-finished-qa-rs-1', ['voter-local']],
    ].flatMap(([submissionId, voterIds]) =>
      voterIds.map((voterId, index) => ({
        id: `vote-${submissionId}-${voterId}`,
        battleId: submissionId.includes('finished') ? 'battle-finished-results' : 'battle-voting-open',
        submissionId,
        voterId,
      })),
    ),
  ];

  await Promise.all(
    votes.map((vote) =>
      db
        .collection('votes')
        .doc(vote.id)
        .set({
          ...vote,
          voterType: 'public',
          weight: 1,
          createdAt: now,
        }),
    ),
  );
}

async function seedDailyHighlights() {
  await clearCollection('dailyHighlights');
  await clearCollection('dailyHighlightLikes');
  const seedDate = new Date();
  const dayKey = getBrazilDayKey(seedDate);
  const highlights = [
    {
      id: 'daily-highlight-user',
      userId: 'qa-sp-1',
      userDisplayName: 'Ana Paulista',
      userBirthState: 'SP',
      voteCount: 9,
      category: 'freestyle',
    },
    {
      id: 'daily-highlight-voter',
      userId: 'qa-rj-1',
      userDisplayName: 'Diego Carioca',
      userBirthState: 'RJ',
      voteCount: 6,
      category: 'melodia',
    },
    {
      id: 'daily-highlight-admin',
      userId: 'qa-mg-1',
      userDisplayName: 'Felipe Mineiro',
      userBirthState: 'MG',
      voteCount: 4,
      category: 'passaros',
    },
    { id: 'daily-highlight-4', userId: 'qa-sp-2', userDisplayName: 'Bruno Santos', userBirthState: 'SP', voteCount: 2, category: 'freestyle' },
    { id: 'daily-highlight-5', userId: 'qa-rj-2', userDisplayName: 'Elisa Niteroi', userBirthState: 'RJ', voteCount: 2, category: 'melodia' },
    { id: 'daily-highlight-6', userId: 'qa-ba-1', userDisplayName: 'Gabi Bahia', userBirthState: 'BA', voteCount: 1, category: 'passaros' },
    { id: 'daily-highlight-7', userId: 'qa-rs-1', userDisplayName: 'Hugo Gaucho', userBirthState: 'RS', voteCount: 0, category: 'freestyle' },
    { id: 'daily-highlight-8', userId: 'qa-sp-3', userDisplayName: 'Carla Lima', userBirthState: 'SP', voteCount: 0, category: 'melodia' },
    { id: 'daily-highlight-9', userId: 'qa-sp-4', userDisplayName: 'Iara Freitas', userBirthState: 'SP', voteCount: 0, category: 'passaros' },
    { id: 'daily-highlight-10', userId: 'qa-rj-3', userDisplayName: 'Joao Lapa', userBirthState: 'RJ', voteCount: 0, category: 'freestyle' },
  ];

  await Promise.all(
    highlights.map((highlight, index) => {
      const createdAt = new Date(seedDate.getTime() + index * 60 * 60 * 1000);
      const timestamp = Timestamp.fromDate(createdAt);

      return db
        .collection('dailyHighlights')
        .doc(highlight.id)
        .set({
          ...highlight,
          dayKey,
          mediaType: 'audio',
          mediaURL: SAMPLE_AUDIO_URL,
          mediaPath: SAMPLE_AUDIO_PATH,
          mediaContentType: 'audio/wav',
          mediaDurationSeconds: 6,
          mediaSizeBytes: 94964,
          videoURL: SAMPLE_AUDIO_URL,
          videoPlatform: 'other',
          status: 'active',
          pointsAwarded: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    }),
  );

  const likeFixtures = [
    ['daily-highlight-user', ['admin-local', 'user-local', 'voter-local', 'qa-sp-2', 'qa-rj-1', 'qa-mg-1', 'qa-ba-1', 'qa-rs-1', 'qa-sp-3']],
    ['daily-highlight-voter', ['admin-local', 'user-local', 'qa-sp-1', 'qa-sp-2', 'qa-mg-1', 'qa-ba-1']],
    ['daily-highlight-admin', ['admin-local', 'user-local', 'voter-local', 'qa-sp-1']],
    ['daily-highlight-4', ['voter-local', 'qa-rj-1']],
    ['daily-highlight-5', ['user-local', 'qa-sp-1']],
    ['daily-highlight-6', ['qa-sp-2']],
  ];

  await Promise.all(
    likeFixtures.flatMap(([highlightId, userIds]) =>
      userIds.map((userId) =>
        db.collection('dailyHighlightLikes').doc(`${highlightId}-${userId}`).set({
          id: `${highlightId}-${userId}`,
          dailyHighlightId: highlightId,
          userId,
          dayKey,
          createdAt: Timestamp.now(),
        }),
      ),
    ),
  );
}

async function main() {
  await upsertUser({
    uid: 'admin-local',
    email: 'admin@example.test',
    password: 'password123',
    displayName: 'Admin Local',
    role: 'admin',
    accountType: 'admin',
    plan: 'organization',
    state: 'SP',
    city: 'Sao Paulo',
    points: 150,
    seasonPoints: {
      2026: {
        points: 80,
        xp: 80,
        rank: 'Aprendiz',
        updatedAt: Timestamp.now(),
      },
    },
    seasonCategoryPoints: {
      2026: {
        freestyle: { points: 80, xp: 80, rank: 'Aprendiz', updatedAt: Timestamp.now() },
        melodia: { points: 35, xp: 35, rank: 'Iniciante', updatedAt: Timestamp.now() },
        passaros: { points: 15, xp: 15, rank: 'Iniciante', updatedAt: Timestamp.now() },
      },
    },
  });

  await upsertUser({
    uid: 'user-local',
    email: 'user@example.test',
    password: 'password123',
    displayName: 'User Local',
    state: 'SP',
    city: 'Sao Paulo',
    seasonPoints: {
      2026: {
        points: 20,
        xp: 20,
        rank: 'Iniciante',
        updatedAt: Timestamp.now(),
      },
    },
    seasonCategoryPoints: {
      2026: {
        freestyle: { points: 20, xp: 20, rank: 'Iniciante', updatedAt: Timestamp.now() },
        melodia: { points: 10, xp: 10, rank: 'Iniciante', updatedAt: Timestamp.now() },
        passaros: { points: 25, xp: 25, rank: 'Iniciante', updatedAt: Timestamp.now() },
      },
    },
  });

  await upsertUser({
    uid: 'voter-local',
    email: 'voter@example.test',
    password: 'password123',
    displayName: 'Voter Local',
    state: 'RJ',
    city: 'Rio de Janeiro',
    points: 35,
    seasonPoints: {
      2026: {
        points: 35,
        xp: 35,
        rank: 'Iniciante',
        updatedAt: Timestamp.now(),
      },
    },
    seasonCategoryPoints: {
      2026: {
        freestyle: { points: 35, xp: 35, rank: 'Iniciante', updatedAt: Timestamp.now() },
        melodia: { points: 50, xp: 50, rank: 'Aprendiz', updatedAt: Timestamp.now() },
        passaros: { points: 5, xp: 5, rank: 'Iniciante', updatedAt: Timestamp.now() },
      },
    },
  });

  await Promise.all(
    QA_USERS.map((user) =>
      upsertUser({
        uid: user.uid,
        email: user.email,
        password: 'password123',
        displayName: user.displayName,
        state: user.state,
        city: user.city,
        points: user.points,
        seasonPoints: buildSeasonPoints(user.points),
        seasonCategoryPoints: buildSeasonCategoryPoints(user.points),
      }),
    ),
  );

  await seedSeasons();
  await seedChampionships();
  await seedQualifierTracks();
  await seedQualifierParticipants();
  await seedQualifierRegistrations();
  await seedQualifierMatches();
  await seedQualifierSubmissions();
  await seedPayments();
  await seedBattles();
  await seedBattleEntries();
  await seedSubmissionsAndVotes();
  await seedDailyHighlights();

  console.log('Seeded Firebase emulators.');
  console.log('User: user@example.test / password123');
  console.log('Voter: voter@example.test / password123');
  console.log('Admin: admin@example.test / password123');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
