import type { Express, Request, Response, RequestHandler } from "express";
import type { Octokit } from "@octokit/rest";
type Env = typeof import("../config/env.js").default;

// ------------------------------------------------------------------
// GET /artifact/:runId — pegar o link de download direto
// ------------------------------------------------------------------
export default (
  app: Express,
  octokit: Octokit,
  env: Env,
  downloadLimiter: RequestHandler,
  verificarCORS: RequestHandler,
) => {
  app.get(
    "/artifact/:runId",
    verificarCORS,
    downloadLimiter,
    async (req: Request, res: Response) => {

      const reqParams = req.params;

      if (!reqParams || !reqParams.runId || typeof reqParams.runId !== "string" || reqParams.runId.trim() === '') {
        res.status(400).send('O parâmetro "runId" é obrigatório e deve ser uma string não vazia.');
        return;
      }

      if (!/^\d+$/.test(reqParams.runId)) {
        res.status(400).send('O parâmetro "runId" deve ser um número.');
        return;
      }

      const runIdNumber = parseInt(reqParams.runId, 10);

      if (isNaN(runIdNumber)) {
        res.status(400).send('O parâmetro "runId" deve ser um número válido.');
        return;
      }

      console.log("🔔 Recebido request para download..");

      try {
        const {
          data: { artifacts },
        } = await octokit.actions.listWorkflowRunArtifacts({
          owner: env.OWNER,
          repo: env.REPO,
          run_id: runIdNumber,
        });

        if (artifacts.length === 0 || !artifacts[0]) {
          res.status(404).send("Nenhum artefato encontrado.");
          return;
        }

        const artifact = artifacts[0];
        const artifactId = artifact.id;
        const artifactDownloadUrl = artifact.archive_download_url;

        if (!artifactId || !artifactDownloadUrl || typeof artifactId !== "number" || typeof artifactDownloadUrl !== "string") {
          res.status(404).send("Artefato inválido.");
          return;
        }

        console.log(`📦 Artefato encontrado: ${artifactId}`);

        // Obtém apenas a URL pré-assinada do artefato, sem seguir o redirect
        // (downloadArtifact baixava o arquivo inteiro em memória).
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let downloadRes;
        try {
          downloadRes = await fetch(artifactDownloadUrl, {
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
