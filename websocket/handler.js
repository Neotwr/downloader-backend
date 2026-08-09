// ------------------------------------------------------------------
// WebSocket Handler — gerencia conexões e notificações em tempo real
// ------------------------------------------------------------------

module.exports = (wss) => {
  const pendingRuns = new Map();

  // Envia mensagem ao cliente via WebSocket
  function notifyClient(runId, payload) {
    const ws = pendingRuns.get(String(runId));

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

    // Envia "ping" a cada 30 segundos
    const heartbeat = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      }
    }, 30000);

    ws.on("error", () => {
      clearInterval(heartbeat);
      pendingRuns.delete(runId);
      console.log(`⚠️ Erro na conexão (run ${runId})`);
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      pendingRuns.delete(runId);
      console.log(`🔌 Cliente desconectado (run ${runId})`);
    });
  });
  return { pendingRuns, notifyClient };
};
