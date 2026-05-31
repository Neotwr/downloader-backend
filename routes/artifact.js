// ------------------------------------------------------------------
// GET /artifact/:runId — pegar o link de download direto
// ------------------------------------------------------------------
module.exports = (
  app,
  octokit,
  env,
  downloadLimiter,
  verificarCORS,
) => {
  app.get(
    "/artifact/:runId",
    verificarCORS,
    downloadLimiter,
    async (req, res) => {
      const runId = req.params.runId;
      if (!runId) {
        res.status(400).send('O parâmetro "runId" é obrigatório.');
        return;
      }
      if (!runId || !/^\d+$/.test(runId)) {
        res.status(400).send('O parâmetro "runId" deve ser um número.');
        return;
      }

      console.log("🔔 Recebido request para download..");

      try {
        const {
          data: { artifacts },
        } = await octokit.actions.listWorkflowRunArtifacts({
          owner: env.OWNER,
          repo: env.REPO,
          run_id: runId,
        });

        if (artifacts.length === 0) {
          res.status(404).send("Nenhum artefato encontrado.");
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

        console.log(`🔗 Link gerado, enviando para o frontend..`);
        res.status(200).json({ url });
      } catch (err) {
        console.error("⚠️ Erro ao buscar artefato:", err);
        res.status(500).send("Erro ao buscar o artefato.");
      }
    },
  );
};
