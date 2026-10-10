// ------------------------------------------------------------------
// GET /artifact/:runId — pegar o link de download direto
// ------------------------------------------------------------------
export default (
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

        if (!artifact?.id || !artifact.archive_download_url) {
          res.status(404).send("Artefato inválido.");
          return;
        }

        // Obtém apenas a URL pré-assinada do artefato, sem seguir o redirect
        // (downloadArtifact baixava o arquivo inteiro em memória).
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let downloadRes;
        try {
          downloadRes = await fetch(artifact.archive_download_url, {
            headers: {
              Authorization: `token ${env.TOKEN}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            redirect: "manual",
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (downloadRes.status !== 302) {
          res.status(502).send("Falha ao obter o link do artefato.");
          return;
        }

        const url = downloadRes.headers.get("location");
        if (!url) {
          res.status(502).send("Falha ao obter o link do artefato.");
          return;
        }

        console.log(`🔗 Link gerado, enviando para o frontend..`);
        res.status(200).json({ url });
      } catch (err) {
        console.error("⚠️ Erro ao buscar artefato:", err);
        res.status(500).send("Erro ao buscar o artefato.");
      }
    },
  );
};
