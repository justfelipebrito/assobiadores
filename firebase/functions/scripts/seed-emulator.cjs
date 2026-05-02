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
  seasonPoints = {},
}) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password, displayName });
  } catch {
    await auth.createUser({ uid, email, password, displayName });
  }

  const username = normalizeUsername(displayName);

  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        id: uid,
        schemaVersion: 1,
        username,
        usernameLower: username,
        email,
        displayName,
        photoURL: null,
        bio: '',
        role,
        accountType,
        plan,
        state,
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
        rank: points >= 50 ? 'Aprendiz' : 'Iniciante',
        seasonPoints,
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
      { merge: true },
    );
}

async function seedSeasons() {
  const now = Date.now();
  await db
    .collection('seasons')
    .doc('2026-s1')
    .set({
      id: '2026-s1',
      name: 'Temporada 1 - 2026',
      slug: '2026-s1',
      scope: 'national',
      region: null,
      status: 'active',
      start: Timestamp.fromDate(new Date(now - 7 * 24 * 60 * 60 * 1000)),
      end: Timestamp.fromDate(new Date(now + 90 * 24 * 60 * 60 * 1000)),
      championshipIds: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
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
    category: 'classico',
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
      title: 'Assobio classico local',
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
      '2026-s1': {
        points: 80,
        xp: 80,
        rank: 'Aprendiz',
        updatedAt: Timestamp.now(),
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
      '2026-s1': {
        points: 20,
        xp: 20,
        rank: 'Iniciante',
        updatedAt: Timestamp.now(),
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
      '2026-s1': {
        points: 35,
        xp: 35,
        rank: 'Iniciante',
        updatedAt: Timestamp.now(),
      },
    },
  });

  await seedSeasons();
  await seedBattles();
  await seedBattleEntries();
  await seedSubmissionsAndVotes();

  console.log('Seeded Firebase emulators.');
  console.log('User: user@example.test / password123');
  console.log('Voter: voter@example.test / password123');
  console.log('Admin: admin@example.test / password123');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
