import { Octokit } from "@octokit/rest";
import { WebSocketServer } from "ws";
import express from "express";
import http from "node:http";
import helmet from "helmet";

import { triggerLimiter, downloadLimiter } from "./middleware/rateLimiter.js";
import verificarCORS from "./middleware/cors.js";
import verifySignature from "./middleware/webhook.js";
import env from "./config/env.js";
import initializeWebSocket from "./websocket/handler.js";
import registerTriggerRoutes from "./routes/trigger.js";
import registerWebhookRoutes from "./routes/webhook.js";
import registerArtifactRoutes from "./routes/artifact.js";

const app = express();
app.use(helmet());

// Informa ao Express que ele está atrás de um proxy.
// Necessário para o express-rate-limit identificar o IP real do usuário e não o IP do proxy.
app.set("trust proxy", 1);

// Intercepta globalmente todas as requisições de preflight (OPTIONS) e passa pelo validador de CORS
app.options(/.*/, verificarCORS);

const octokit = new Octokit({
  auth: env.TOKEN,
  headers: {
    "X-GitHub-Api-Version": "2022-11-28",
  },
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const { hasPendingRun, cacheRunResult, processCompletedRun } =
  initializeWebSocket(wss, octokit, env);

app.use(
  express.json({
    limit: "200kb",
    verify: (req, res, buf) => {
      if (buf && buf.length) req.rawBody = buf;
    },
  }),
);

registerTriggerRoutes(app, octokit, env, triggerLimiter, verificarCORS);
registerWebhookRoutes(
  app,
  env,
  verifySignature,
  hasPendingRun,
  cacheRunResult,
  processCompletedRun,
);
registerArtifactRoutes(app, octokit, env, downloadLimiter, verificarCORS);

server.listen(env.PORT, () =>
  console.log(`🌍 Backend rodando na porta ${env.PORT}`),
);
