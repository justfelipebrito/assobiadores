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
    registrationStart: Timestamp.fromDate(new Date('2026-05-04T00:00:00-03:00')),
    registrationEnd: Timestamp.fromDate(new Date('2026-05-31T23:59:59-03:00')),
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
  const existingTracks = await db.collection('qualifierTracks').get();
  await Promise.all(existingTracks.docs.map((doc) => doc.ref.delete()));

  const countByTrack = {
    'SP-freestyle': { registeredCount: 4, confirmedCount: 3, pendingPaymentCount: 1 },
    'SP-melodia': { registeredCount: 4, confirmedCount: 3, pendingPaymentCount: 1 },
    'SP-passaros': { registeredCount: 4, confirmedCount: 3, pendingPaymentCount: 1 },
    'RJ-freestyle': { registeredCount: 4, confirmedCount: 3, pendingPaymentCount: 1 },
    'RJ-melodia': { registeredCount: 4, confirmedCount: 3, pendingPaymentCount: 1 },
    'RJ-passaros': { registeredCount: 4, confirmedCount: 3, pendingPaymentCount: 1 },
  };

  const tracks = ['SP', 'RJ'].flatMap((state) =>
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
  const existingParticipants = await db.collection('qualifierParticipants').get();
  await Promise.all(existingParticipants.docs.map((doc) => doc.ref.delete()));

  const participants = [
    { userId: 'admin-local', displayName: 'Admin Local' },
    { userId: 'voter-local', displayName: 'Voter Local' },
    { userId: 'user-local', displayName: 'User Local' },
  ];

  await Promise.all(
    ['SP', 'RJ'].flatMap((state) =>
      COMPETITION_CATEGORIES.flatMap((category) =>
        participants.map((participant, index) => {
          const confirmedAt = Timestamp.fromDate(new Date(Date.UTC(2026, 4, 4, 12, index * 10, 0)));

          return db
            .collection('qualifierParticipants')
            .doc(`qualifier-${state.toLowerCase()}-2026-${category.value}-${participant.userId}`)
            .set({
              userId: participant.userId,
              seasonId: 'season-2026',
              seasonYear: 2026,
              category: category.value,
              region: state,
              displayName: participant.displayName,
              rank: index === 0 ? 'Aprendiz' : 'Iniciante',
              points: Math.max(0, 80 - index * 20),
              confirmedAt,
              updatedAt: confirmedAt,
            });
        }),
      ),
    ),
  );
}

async function seedBattles() {
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
    maxParticipants: 16,
    currentParticipants: 0,
    registrationStart: openStart,
    registrationEnd: openEnd,
    submissionDeadline: submitEnd,
    votingStart,
    votingEnd,
    rules: ['Envie um video curto', 'Sem edicao de audio', 'Respeite os participantes'],
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
      entryFee: 500,
      prizePool: 5000,
      prizeDistribution: { first: 3500, second: 1000, third: 500 },
    });

  await db
    .collection('battles')
    .doc('battle-active-submit')
    .set({
      ...base,
      id: 'battle-active-submit',
      title: 'Batalha Local Envio',
      description: 'Batalha ativa para testar envio e moderacao de videos.',
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
      currentParticipants: 3,
      registrationStart: Timestamp.fromDate(new Date(now - 96 * 60 * 60 * 1000)),
      registrationEnd: Timestamp.fromDate(new Date(now - 72 * 60 * 60 * 1000)),
      submissionDeadline: Timestamp.fromDate(new Date(now - 24 * 60 * 60 * 1000)),
      votingStart: Timestamp.fromDate(new Date(now - 60 * 60 * 1000)),
      votingEnd,
      entryFee: 0,
      prizePool: 0,
      prizeDistribution: null,
    });
}

async function seedBattleEntries() {
  const entries = [
    { id: 'entry-active-user', battleId: 'battle-active-submit', userId: 'user-local' },
    { id: 'entry-active-voter', battleId: 'battle-active-submit', userId: 'voter-local' },
    { id: 'entry-voting-user', battleId: 'battle-voting-open', userId: 'user-local' },
    { id: 'entry-voting-voter', battleId: 'battle-voting-open', userId: 'voter-local' },
    { id: 'entry-voting-admin', battleId: 'battle-voting-open', userId: 'admin-local' },
  ];

  await Promise.all(
    entries.map((entry) =>
      db
        .collection('battleEntries')
        .doc(entry.id)
        .set({
          ...entry,
          paymentId: null,
          status: 'confirmed',
          createdAt: Timestamp.now(),
        }),
    ),
  );
}

async function seedSubmissionsAndVotes() {
  const now = Timestamp.now();
  const submissions = [
    {
      id: 'submission-pending-review',
      battleId: 'battle-active-submit',
      userId: 'voter-local',
      userDisplayName: 'Voter Local',
      entryId: 'entry-active-voter',
      videoURL: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
      title: 'Envio pendente local',
      description: 'Fixture para testar a fila de moderacao.',
      status: 'submitted',
      moderationNote: null,
      voteCount: 0,
    },
    {
      id: 'submission-voting-user',
      battleId: 'battle-voting-open',
      userId: 'user-local',
      userDisplayName: 'User Local',
      entryId: 'entry-voting-user',
      videoURL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Assobio freestyle local',
      description: 'Fixture aprovada para testar votacao.',
      status: 'approved',
      moderationNote: 'Aprovado no seed local.',
      voteCount: 2,
    },
    {
      id: 'submission-voting-voter',
      battleId: 'battle-voting-open',
      userId: 'voter-local',
      userDisplayName: 'Voter Local',
      entryId: 'entry-voting-voter',
      videoURL: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      title: 'Assobio livre local',
      description: 'Segunda fixture aprovada para testar ranking.',
      status: 'approved',
      moderationNote: 'Aprovado no seed local.',
      voteCount: 1,
    },
    {
      id: 'submission-voting-admin',
      battleId: 'battle-voting-open',
      userId: 'admin-local',
      userDisplayName: 'Admin Local',
      entryId: 'entry-voting-admin',
      videoURL: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
      title: 'Assobio tecnico local',
      description: 'Terceira fixture aprovada para preencher os destaques.',
      status: 'approved',
      moderationNote: 'Aprovado no seed local.',
      voteCount: 0,
    },
    {
      id: 'submission-reviewed-rejected',
      battleId: 'battle-voting-open',
      userId: 'admin-local',
      userDisplayName: 'Admin Local',
      entryId: 'entry-voting-admin',
      videoURL: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
      title: 'Envio revisado local',
      description: 'Fixture rejeitada para testar historico de moderacao.',
      status: 'rejected',
      moderationNote: 'Exemplo de rejeicao local.',
      voteCount: 0,
    },
  ];

  await Promise.all(
    submissions.map((submission) =>
      db
        .collection('submissions')
        .doc(submission.id)
        .set({
          ...submission,
          videoPlatform: 'youtube',
          createdAt: now,
          updatedAt: now,
        }),
    ),
  );

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
  const seedDate = new Date();
  seedDate.setHours(9, 0, 0, 0);
  const dayKey = seedDate.toISOString().slice(0, 10);
  const sampleAudioURL =
    'http://127.0.0.1:9199/v0/b/demo-batalha.appspot.com/o/daily-highlights%2Fuser-local%2F1777799597771-freestyle.webm?alt=media&token=bd04dec7-c397-4bff-9d3d-2424765b5380';
  const sampleAudioPath = 'daily-highlights/user-local/1777799597771-freestyle.webm';
  const highlights = [
    {
      id: 'daily-highlight-user',
      userId: 'daily-seed-1',
      userDisplayName: 'User Local',
      userBirthState: 'SP',
      voteCount: 0,
      category: 'freestyle',
    },
    {
      id: 'daily-highlight-voter',
      userId: 'daily-seed-2',
      userDisplayName: 'Voter Local',
      userBirthState: 'RJ',
      voteCount: 0,
      category: 'melodia',
    },
    {
      id: 'daily-highlight-admin',
      userId: 'daily-seed-3',
      userDisplayName: 'Admin Local',
      userBirthState: 'SP',
      voteCount: 0,
      category: 'passaros',
    },
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
          mediaURL: sampleAudioURL,
          mediaPath: sampleAudioPath,
          mediaContentType: 'audio/webm;codecs=opus',
          mediaDurationSeconds: 6,
          mediaSizeBytes: 94964,
          videoURL: sampleAudioURL,
          videoPlatform: 'other',
          status: 'active',
          pointsAwarded: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    }),
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

  await seedSeasons();
  await seedChampionships();
  await seedQualifierTracks();
  await seedQualifierParticipants();
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
