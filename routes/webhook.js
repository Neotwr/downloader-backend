// ------------------------------------------------------------------
// POST /webhook — recebe notificação do GitHub quando o run termina
// ------------------------------------------------------------------

module.exports = (
  app,
  env,
  verifySignature,
  hasPendingRun,
  cacheRunResult,
  processCompletedRun,
) => {
  app.post("/webhook", async (req, res) => {
    if (!verifySignature(req)) {
      console.error("❌ Assinatura inválida! Requisição bloqueada.");
      return res.status(401).send("Invalid signature");
    }

    // Responde 200 imediatamente para o GitHub não reenviar
    res.status(200).send("OK");

    const data = req.body;

    // Triagem: só processa eventos "completed" de runs do nosso repositório
    if (
      data.action !== "completed" ||
      !data.workflow_run ||
      data.workflow_run.repository?.full_name !== `${env.OWNER}/${env.REPO}`
    ) {
      console.log(
        "📥 Webhook descartado (action/repositório não correspondem).",
      );
      return;
    }

    const rawRunId = data.workflow_run.id;
    if (!rawRunId || !/^\d+$/.test(String(rawRunId))) {
      console.log("📥 Webhook descartado (run id inválido).");
      return;
    }

    const runId = String(rawRunId);
    const conclusion = data.workflow_run.conclusion;

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
