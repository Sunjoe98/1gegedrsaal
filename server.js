const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const BASE_PAYOUT_PER_ELIMINATION = 100;
const QUESTION_DURATION_MS = 20000;

const questions = [
  {
    id: 'q1',
    topic: 'Allgemeinwissen',
    text: 'Welche Stadt ist die Hauptstadt der Schweiz?',
    options: {
      A: 'Zürich',
      B: 'Bern',
      C: 'Genf'
    },
    correct: 'B'
  },
  {
    id: 'q2',
    topic: 'Sport',
    text: 'Wie viele Spieler stehen im Fussball pro Team gleichzeitig auf dem Platz?',
    options: {
      A: '9',
      B: '10',
      C: '11'
    },
    correct: 'C'
  },
  {
    id: 'q3',
    topic: 'Geschichte',
    text: 'In welchem Jahr fiel die Berliner Mauer?',
    options: {
      A: '1989',
      B: '1991',
      C: '1993'
    },
    correct: 'A'
  }
];

const gameState = {
  players: {}, // id -> {id,nickname,role:'mob'|'candidate',eliminated:false}
  candidateId: null,
  pot: 0,
  mobRemaining: 0,
  questionIndex: -1,
  phase: 'lobby',
  currentQuestion: null,
  currentDeadline: null,
  answers: {},
  reveal: null,
  timerHandle: null
};

const streams = new Map();

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const safePath = path.normalize(urlPath).replace(/^\/+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);
  if (urlPath === '/' || !safePath) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        resolve({});
      }
    });
  });
}

function publicState() {
  return {
    phase: gameState.phase,
    pot: gameState.pot,
    mobRemaining: gameState.mobRemaining,
    candidateId: gameState.candidateId,
    questionIndex: gameState.questionIndex,
    question: gameState.currentQuestion
      ? {
          id: gameState.currentQuestion.id,
          topic: gameState.currentQuestion.topic,
          text: gameState.currentQuestion.text,
          options: gameState.currentQuestion.options,
          correct: gameState.phase === 'reveal' || gameState.phase === 'finished' ? gameState.currentQuestion.correct : null
        }
      : null,
    deadline: gameState.currentDeadline,
    players: Object.values(gameState.players).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      role: p.role,
      eliminated: p.eliminated
    })),
    reveal: gameState.reveal
  };
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of streams.values()) {
    res.write(payload);
  }
}

function updateState() {
  broadcast('state', publicState());
}

function resetTimer() {
  if (gameState.timerHandle) {
    clearTimeout(gameState.timerHandle);
  }
  gameState.currentDeadline = null;
  gameState.timerHandle = null;
}

function startQuestion() {
  if (!gameState.candidateId || !gameState.players[gameState.candidateId]) {
    return;
  }
  gameState.questionIndex = (gameState.questionIndex + 1) % questions.length;
  gameState.currentQuestion = questions[gameState.questionIndex];
  gameState.phase = 'question';
  gameState.answers = {};
  gameState.reveal = null;
  const deadline = Date.now() + QUESTION_DURATION_MS;
  gameState.currentDeadline = deadline;
  resetTimer();
  gameState.timerHandle = setTimeout(resolveQuestion, QUESTION_DURATION_MS);
  updateState();
}

function resolveQuestion() {
  resetTimer();
  if (!gameState.currentQuestion) return;
  const correct = gameState.currentQuestion.correct;
  let eliminatedThisRound = 0;
  for (const player of Object.values(gameState.players)) {
    if (player.eliminated) continue;
    const answer = gameState.answers[player.id];
    if (player.role === 'mob') {
      if (answer !== correct) {
        player.eliminated = true;
        eliminatedThisRound += 1;
      }
    } else if (player.role === 'candidate') {
      if (answer !== correct) {
        player.eliminated = true;
      }
    }
  }
  gameState.mobRemaining = Object.values(gameState.players).filter((p) => p.role === 'mob' && !p.eliminated).length;
  gameState.pot += eliminatedThisRound * BASE_PAYOUT_PER_ELIMINATION;
  gameState.phase = 'reveal';
  gameState.reveal = { correct, eliminatedThisRound };

  if (!gameState.players[gameState.candidateId] || gameState.players[gameState.candidateId].eliminated) {
    gameState.phase = 'finished';
    gameState.reveal.outcome = 'candidate_out';
  } else if (gameState.mobRemaining === 0) {
    gameState.phase = 'finished';
    gameState.reveal.outcome = 'candidate_won';
  }
  updateState();
}

async function handleJoin(req, res) {
  const body = await parseBody(req);
  const nickname = body.nickname || 'Gast';
  const role = body.role === 'candidate' ? 'candidate' : 'mob';
  const id = randomUUID();
  gameState.players[id] = { id, nickname, role, eliminated: false };
  if (role === 'candidate') {
    gameState.candidateId = id;
  }
  gameState.mobRemaining = Object.values(gameState.players).filter((p) => p.role === 'mob' && !p.eliminated).length;
  updateState();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ playerId: id }));
}

async function handleSetCandidate(req, res) {
  const body = await parseBody(req);
  const playerId = body.playerId;
  if (playerId && gameState.players[playerId]) {
    for (const p of Object.values(gameState.players)) {
      if (p.role === 'candidate') p.role = 'mob';
    }
    gameState.players[playerId].role = 'candidate';
    gameState.candidateId = playerId;
  }
  updateState();
  res.writeHead(204);
  res.end();
}

async function handleAnswer(req, res) {
  const body = await parseBody(req);
  const playerId = body.playerId;
  const option = body.option;
  if (!playerId || !option || gameState.phase !== 'question') {
    res.writeHead(400);
    res.end();
    return;
  }
  const player = gameState.players[playerId];
  if (!player || player.eliminated) {
    res.writeHead(403);
    res.end();
    return;
  }
  gameState.answers[playerId] = option;
  res.writeHead(204);
  res.end();
}

async function handleStart(req, res) {
  resetTimer();
  gameState.questionIndex = -1;
  gameState.pot = 0;
  for (const player of Object.values(gameState.players)) {
    player.eliminated = false;
  }
  gameState.mobRemaining = Object.values(gameState.players).filter((p) => p.role === 'mob').length;
  startQuestion();
  res.writeHead(204);
  res.end();
}

async function handleNext(req, res) {
  if (gameState.phase === 'question') {
    resolveQuestion();
  } else {
    startQuestion();
  }
  res.writeHead(204);
  res.end();
}

function handleStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');
  const id = randomUUID();
  streams.set(id, res);
  res.on('close', () => {
    streams.delete(id);
  });
  updateState();
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/join') && req.method === 'POST') {
    return handleJoin(req, res);
  }
  if (req.url.startsWith('/api/set-candidate') && req.method === 'POST') {
    return handleSetCandidate(req, res);
  }
  if (req.url.startsWith('/api/answer') && req.method === 'POST') {
    return handleAnswer(req, res);
  }
  if (req.url.startsWith('/api/host/start') && req.method === 'POST') {
    return handleStart(req, res);
  }
  if (req.url.startsWith('/api/host/next') && req.method === 'POST') {
    return handleNext(req, res);
  }
  if (req.url.startsWith('/api/stream') && req.method === 'GET') {
    return handleStream(req, res);
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
