const { Octokit } = require("@octokit/rest");
const { WebSocketServer } = require('ws');
const express = require('express');
const http = require('http');
const helmet = require('helmet');

const { triggerLimiter, downloadLimiter } = require('./middleware/rateLimiter');
const verificarCORS = require('./middleware/cors');
const verifySignature = require('./middleware/webhook');
const env = require('./config/env');

const app = express();
app.use(helmet());

// Informa ao Express que ele está atrás de um proxy.
// Necessário para o express-rate-limit identificar o IP real do usuário e não o IP do proxy.
app.set('trust proxy', 1);

// Intercepta globalmente todas as requisições de preflight (OPTIONS) e passa pelo validador de CORS
app.options(/.*/, verificarCORS);

const octokit = new Octokit({
  auth: env.TOKEN,
  headers: {
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const timeouts = new Map();

const { pendingRuns, notifyClient } = require('./websocket/handler')(wss, timeouts);

app.use(express.json({
  limit: '200kb',
  verify: (req, res, buf) => {
    if (buf && buf.length) req.rawBody = buf;
  }
}));

require('./routes/trigger')(app, octokit, env, triggerLimiter, verificarCORS);
require('./routes/webhook')(app, octokit, env, notifyClient, pendingRuns, verifySignature);
require('./routes/artifact')(app, octokit, env, verificarCORS, downloadLimiter);

server.listen(env.PORT, () => console.log(`🌍 Backend rodando na porta ${env.PORT}`));