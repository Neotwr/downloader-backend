// ------------------------------------------------------------------
// WebSocket Handler — gerencia conexões, heartbeats e notificações
// ------------------------------------------------------------------

// Protocolo de heartbeat (cliente -> servidor)
const HEARTBEAT_SWEEP_INTERVAL = 10_000; // varredura global a cada 10s
const CONNECTION_STALE_TIMEOUT = 30_000; // sem heartbeat por 30s -> encerra
const RESULT_CACHE_TTL = 5 * 60 * 1000; // resultado guardado por 5 min

module.exports = (wss, octokit, env) => {
  const pendingRuns = new Map(); // runId -> ws (cliente aguardando)
  const runResults = new Map(); // runId -> { payload, createdAt }

  // ------------------------------------------------------------------
  // Cache de resultado — resolve a corrida entre /trigger e /runs/:id
  // ------------------------------------------------------------------
  function cacheRunResult(runId, payload) {
    runResults.set(String(runId), { payload, createdAt: Date.now() });
  }

  function getRunResult(runId) {
    const key = String(runId);
    const entry = runResults.get(key);
    if (!entry) return undefined;

    runResults.delete(key);

    if (Date.now() - entry.createdAt > RESULT_CACHE_TTL) return undefined;
    return entry.payload;
  }

  // ------------------------------------------------------------------
  // Notificação ao cliente
  // ------------------------------------------------------------------
  function notifyClient(runId, payload) {
    const key = String(runId);
    const ws = pendingRuns.get(key);

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }

    // Resultados terminais ficam disponíveis no cache (ex.: reconexão)
    if (payload.type === "done" || payload.type === "error") {
      cacheRunResult(runId, payload);
      pendingRuns.delete(key);
    }
  }

  // Indica se há cliente conectado e aguardando por esse run
  function hasPendingRun(runId) {
    const ws = pendingRuns.get(String(runId));
    return Boolean(ws && ws.readyState === 1);
  }

  // ------------------------------------------------------------------
  // Processa um run concluído: notifica o cliente e busca o artefato
  // ------------------------------------------------------------------
  async function processCompletedRun(runId, conclusion) {
    console.log(`🔔 Webhook recebido — Run ${runId} — ${conclusion}`);

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
      return;
    }

    try {
      console.log(`[Run] Buscando artefatos — Run ID: ${runId}`);
      const {
        data: { artifacts },
      } = await octokit.actions.listWorkflowRunArtifacts({
        owner: env.OWNER,
        repo: env.REPO,
        run_id: runId,
      });

      console.log(
        `[Run] Resposta de artefatos recebida — Run ID: ${runId} — quantidade: ${artifacts?.length ?? 0}`,
      );

      if (!Array.isArray(artifacts) || artifacts.length === 0) {
        notifyClient(runId, {
          type: "error",
          message: "Nenhum artefato encontrado.",
        });
        return;
      }

      const artifact = artifacts[0];

      if (!artifact?.id) {
        console.error(`[Run] Artefato inválido — Run ID: ${runId}`);
        notifyClient(runId, {
          type: "error",
          message: "Artefato inválido recebido.",
        });
        return;
      }

      console.log(
        `[Run] Artefato selecionado — Run ID: ${runId} — ID: ${artifact.id} — nome: ${artifact.name}`,
      );

      console.log(`[Run] Solicitando download — Run ID: ${runId}`);
      const { url } = await octokit.actions.downloadArtifact({
        owner: env.OWNER,
        repo: env.REPO,
        artifact_id: artifact.id,
        archive_format: "zip",
      });

      if (!url) {
        throw new Error("A API não retornou a URL do artefato");
      }

      console.log(
        `🔗 Link gerado - Run ID: ${runId} — URL retornada: ${url.slice(0, 120)}...`,
      );

      notifyClient(runId, {
        type: "done",
        downloadUrl: url,
        filename: artifact.name,
      });
    } catch (err) {
      console.error(`[Run] Erro ao buscar artefato — Run ID: ${runId}`, {
        name: err?.name,
        message: err?.message,
        status: err?.status,
        stack: err?.stack,
      });
      notifyClient(runId, {
        type: "error",
        message: "Erro ao buscar o artefato.",
      });
    }
  }

  // ------------------------------------------------------------------
  // Conexão de novos clientes
  // ------------------------------------------------------------------
  wss.on("connection", (ws, req) => {
    const runId = req.url?.replace("/runs/", "");

    // Validar se runId existe e é só números
    if (!runId || !/^\d+$/.test(runId)) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: 'O parâmetro "runId" deve ser um número válido.',
        }),
      );
      return ws.close();
    }

    ws.lastSeen = Date.now();
    pendingRuns.set(runId, ws);
    console.log(`🔌 Cliente conectado aguardando run ${runId}`);

    // Se o webhook chegou antes do cliente conectar, entrega do cache
    const cached = getRunResult(runId);
    if (cached) {
      if (cached.type === "run-completed") {
        processCompletedRun(runId, cached.conclusion).catch((err) =>
          console.error(`❌ Erro ao processar run ${runId}:`, err),
        );
      } else {
        notifyClient(runId, cached);
      }
    }

    // Heartbeat do cliente: { type: "ping" } -> { type: "pong" }
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") {
          ws.lastSeen = Date.now();
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        }
      } catch {
        // ignora mensagens que não são JSON válido
      }
    });

    ws.on("error", () => {
      pendingRuns.delete(runId);
      console.log(`⚠️ Erro na conexão (run ${runId})`);
    });

    ws.on("close", () => {
      pendingRuns.delete(runId);
      console.log(`🔌 Cliente desconectado (run ${runId})`);
    });
  });

  // ------------------------------------------------------------------
  // Sweep global: encerra conexões sem heartbeat e limpa cache expirado
  // ------------------------------------------------------------------
  setInterval(() => {
    const now = Date.now();

    for (const [runId, ws] of pendingRuns) {
      if (now - ws.lastSeen > CONNECTION_STALE_TIMEOUT) {
        console.log(`⏱️ Conexão sem heartbeat encerrada (run ${runId})`);
        ws.terminate();
        pendingRuns.delete(runId);
      }
    }

    for (const [runId, entry] of runResults) {
      if (now - entry.createdAt > RESULT_CACHE_TTL) {
        runResults.delete(runId);
      }
    }
  }, HEARTBEAT_SWEEP_INTERVAL);

  return {
    pendingRuns,
    notifyClient,
    hasPendingRun,
    cacheRunResult,
    getRunResult,
    processCompletedRun,
  };
};
