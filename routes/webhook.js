// ------------------------------------------------------------------
// POST /webhook — recebe notificação do GitHub quando o run termina
// ------------------------------------------------------------------

module.exports = (
  app,
  octokit,
  env,
  notifyClient,
  pendingRuns,
  verifySignature,
) => {
  app.post("/webhook", async (req, res) => {
    if (!verifySignature(req)) {
      console.error("❌ Assinatura inválida! Requisição bloqueada.");
      return res.status(401).send("Invalid signature");
    }

    // Responde 200 imediatamente para o GitHub não reenviar
    res.status(200).send("OK");

    const data = req.body;

    if (data.action !== "completed" || !data.workflow_run) return;

    const runId = String(data.workflow_run.id);
    const conclusion = data.workflow_run.conclusion;

    console.log(`🔔 Webhook recebido — Run ${runId} — ${conclusion}`);

    // Notifica o cliente sobre o status
    notifyClient(runId, {
      type: "status",
      message:
        conclusion === "success"
          ? "Buscando artefato..."
          : "Workflow finalizado com erro.",
    });

    if (conclusion !== "success") {
      notifyClient(runId, {
        type: "error",
        message: `O workflow falhou com status: ${conclusion}`,
      });
      pendingRuns.delete(runId);
      return;
    }

    try {
      const {
        data: { artifacts },
      } = await octokit.actions.listWorkflowRunArtifacts({
        owner: env.OWNER,
        repo: env.REPO,
        run_id: runId,
      });

      if (artifacts.length === 0) {
        notifyClient(runId, {
          type: "error",
          message: "Nenhum artefato encontrado.",
        });
        pendingRuns.delete(runId);
        return;
      }

      const artifact = artifacts[0];

      // downloadArtifact retorna um redirect — pegamos a URL final
      const { url } = await octokit.actions.downloadArtifact({
        owner: env.OWNER,
        repo: env.REPO,
        artifact_id: artifact.id,
        archive_format: "zip",
      });

      console.log(`🔗 Link gerado - Run ID: ${runId}`);

      notifyClient(runId, {
        type: "done",
        downloadUrl: url,
        filename: artifact.name,
      });

      pendingRuns.delete(runId);
    } catch (err) {
      console.error("Erro ao buscar artefato: ", err);
      notifyClient(runId, {
        type: "error",
        message: "Erro ao buscar o artefato.",
      });
      pendingRuns.delete(runId);
    }
  });
};
