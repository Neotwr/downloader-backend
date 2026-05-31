// ------------------------------------------------------------------
// WebSocket Handler — gerencia conexões e notificações em tempo real
// ------------------------------------------------------------------

module.exports = (wss, timeouts) => {
  const pendingRuns = new Map();

  // Envia mensagem ao cliente via WebSocket
  function notifyClient(runId, payload) {
    const ws = pendingRuns.get(String(runId));

    if (timeouts.has(String(runId))) {
      clearTimeout(timeouts.get(String(runId)));
      timeouts.delete(String(runId));
    }

    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  // Aguarda conexão do cliente
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

    console.log(`🔌 Cliente conectado aguardando run ${runId}`);
    pendingRuns.set(runId, ws);

    const timeout = setTimeout(() => {
      console.log(`⏱️ Timeout na conexão ${runId} — webhook não chegou`);
      notifyClient(runId, {
        type: "error",
        message: "Timeout: workflow demorou muito.",
      });
      ws.close();
      pendingRuns.delete(runId);
      timeouts.delete(runId);
    }, 300000);

    timeouts.set(runId, timeout);

    // Envia "ping" a cada 30 segundos
    const heartbeat = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      }
    }, 30000);

    ws.on("close", () => {
      clearTimeout(timeouts.get(runId));
      timeouts.delete(runId);
      pendingRuns.delete(runId);
      console.log(`🔌 Cliente desconectado (run ${runId})`);
    });
  });
  return { pendingRuns, notifyClient };
};
