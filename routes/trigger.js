// limite máximo de caracteres dos inputs do workflow
const MAX_LENGTH = 250;

// ------------------------------------------------------------------
// POST /trigger — dispara o workflow e retorna o runId
// ------------------------------------------------------------------
module.exports = (
  app,
  octokit,
  env,
  triggerLimiter,
  verificarCORS,
) => {
  app.post("/trigger", verificarCORS, triggerLimiter, async (req, res) => {
    const { id, inputs } = req.body;

    // validações básicas
    let workflowId;
    if (id === 'urldownload') {
      workflowId = env.WORKFLOW_URLDOWNLOAD;
    } else if (id === 'pydownload') {
      workflowId = env.WORKFLOW_PYDOWNLOAD;
    } else {
      return res.status(400).json({ message: "Workflow não encontrado." });
    }

    if (!inputs || typeof inputs !== "object") {
      return res
        .status(400)
        .json({ message: 'O campo "inputs" deve ser um objeto.' });
    }

    const inputEntries = Object.entries(inputs);
    for (const [key, value] of inputEntries) {
      if (typeof value !== "string" || value.trim() === "") {
        return res
          .status(400)
          .json({ message: `O campo "${key}" deve ser uma string não-vazia.` });
      }

      // Validar tamanho máximo
      if (value.length > MAX_LENGTH) {
        return res.status(400).json({
          message: `O campo "${key}" não pode exceder ${MAX_LENGTH} caracteres.`,
        });
      }
    }

    try {
      // Dispara o workflow
      await octokit.actions.createWorkflowDispatch({
        owner: env.OWNER,
        repo: env.REPO,
        workflow_id: workflowId,
        ref: "main",
        inputs: inputs,
      });

      // Aguarda um segundo e busca o run mais recente para pegar o runId
      await new Promise((r) => setTimeout(r, 1500));

      const {
        data: { workflow_runs },
      } = await octokit.actions.listWorkflowRuns({
        owner: env.OWNER,
        repo: env.REPO,
        workflow_id: workflowId,
        per_page: 1,
      });

      const runId = workflow_runs[0]?.id;

      if (!runId) {
        return res
          .status(500)
          .json({ message: "Não foi possível obter o runId." });
      }

      console.log(`🚀 Workflow disparado! Run ID: ${runId}`);
      res.json({ runId: String(runId) });
    } catch (error) {
      console.error("Erro ao disparar workflow: ", error);
      res.status(500).json({ message: "Erro ao processar requisição" });
    }
  });
};
