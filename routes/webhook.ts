import type { Express} from "express";
import type initializeWebSocket from "../websocket/handler.js";
type VerifySignature = typeof import("../middleware/webhook.js").default;
type Env = typeof import("../config/env.js").default;

type WebSocketHandlers = ReturnType<typeof initializeWebSocket>;
type HasPendingRun = WebSocketHandlers["hasPendingRun"];
type CacheRunResult = WebSocketHandlers["cacheRunResult"];
type ProcessCompletedRun = WebSocketHandlers["processCompletedRun"];

function isRecord(data: unknown): data is Record<string, unknown> {
  return data !== null && typeof data === "object" && !Array.isArray(data);
}

// ------------------------------------------------------------------
// POST /webhook — recebe notificação do GitHub quando o run termina
// ------------------------------------------------------------------

export default (
  app: Express,
  env: Env,
  verifySignature: VerifySignature,
  hasPendingRun: HasPendingRun,
  cacheRunResult: CacheRunResult,
  processCompletedRun: ProcessCompletedRun,
) => {
  app.post("/webhook", async (req, res) => {
    if (!verifySignature(req)) {
      console.error("❌ Assinatura inválida! Requisição bloqueada.");
      return res.status(401).send("Invalid signature");
    }

    // Responde 200 imediatamente para o GitHub não reenviar
    res.status(200).send("OK");

    const data: unknown = req.body;

    if (!isRecord(data)) {
      console.log("📥 Webhook descartado (payload inválido).");
      return;
    }

    if (data.action !== "completed") {
      console.log("📥 Webhook descartado (action ausente, inválida ou não é 'completed').");
      return;
    }

    if (!isRecord(data.workflow_run) || !isRecord(data.workflow_run.repository)) {
      console.log("📥 Webhook descartado (workflow_run/repository ausente ou inválido).");
      return;
    }

    if (!data.workflow_run.repository.full_name || typeof data.workflow_run.repository.full_name !== "string") {
      console.log(
        "📥 Webhook descartado (workflow_run.repository.full_name ausente ou inválido).",
      );
      return;
    }

    // Triagem: só processa eventos "completed" de runs do nosso repositório
    if (data.workflow_run.repository.full_name !== `${env.OWNER}/${env.REPO}`) {
      console.log("📥 Webhook descartado (repositório não correspondem).");
      return;
    }

    const rawRunId = data.workflow_run.id;
    if (!rawRunId || !/^\d+$/.test(String(rawRunId))) {
      console.log("📥 Webhook descartado (run id inválido).");
      return;
    }

    const runId = String(rawRunId);
    const conclusion = data.workflow_run.conclusion;

    if (!conclusion || typeof conclusion !== "string") {
      console.log("📥 Webhook descartado (conclusion inválida).");
      return;
    }

    // Triagem por runId: só busca artefato se houver cliente aguardando;
    // senão, guarda o marcador para um cliente que conectar depois.
    if (hasPendingRun(runId)) {
      processCompletedRun(runId, conclusion).catch((err) =>
        console.error(`❌ Erro ao processar run ${runId}:`, err),
      );
    } else {
      console.log(
        `📥 Webhook para run ${runId} sem cliente aguardando — armazenado no cache.`,
      );
      cacheRunResult(runId, { type: "run-completed", conclusion });
    }
  });
};
