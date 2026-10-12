import type { Express, Request, Response, RequestHandler } from "express";
import type { Octokit } from "@octokit/rest";
import envs from '../config/env.js';
// limite máximo de caracteres dos inputs do workflow
const MAX_LENGTH = 250;

// validação e normalização do workflowId
const workflowIds = {
  URLDownload: envs.WORKFLOW_URLDOWNLOAD,
  PyDownload: envs.WORKFLOW_PYDOWNLOAD,
} as const;

type ValidatedWorkflowIdResult =
  | { isValid: false; message: string }
  | { isValid: true; data: string };

type WorkflowName = keyof typeof workflowIds;

function getWorkflowId(name: string): ValidatedWorkflowIdResult {
  if (!(name in workflowIds)) {
    return { isValid: false, message: `Workflow inválido ${name}.` };
  }

  const workflowId = workflowIds[name as WorkflowName];

  if (!workflowId) {
    return { isValid: false, message: `ID não configurado para o workflow: ${name}` };
  }

  return { isValid: true, data: workflowId };
}

// validações do body da requisição
interface BodyInputs {
  id: string;
  inputs: Record<string, string>;
}

type ValidatedBodyResult =
  | { isValid: false; message: string }
  | { isValid: true; data: BodyInputs };

// função para validar o body da requisição
function isRecord(data: unknown): data is Record<string, unknown> {
  return data !== null && typeof data === "object" && !Array.isArray(data);
}

function validateBody(data: unknown): ValidatedBodyResult {
  if (!isRecord(data)) {
    return { isValid: false, message: "O corpo da requisição deve ser um objeto JSON." };
  }

  if (!data.id || typeof data.id !== "string") {
    return { isValid: false, message: 'O campo "id" é obrigatório e deve ser uma string.' };
  }

  if (!isRecord(data.inputs)) {
    return { isValid: false, message: 'O campo "inputs" é obrigatório e deve ser um objeto.' };
  }

  const inputs = data.inputs;
  const validatedInputs: Record<string, string> = {};
  for (const [field, value] of Object.entries(inputs)) {
    if (typeof value !== "string" || value.trim() === "") {
      return { isValid: false, message: `O campo "${field}" é obrigatório e deve ser uma string não vazia.` };
    }

    if (value.length > MAX_LENGTH) {
      return { isValid: false, message: `O campo "${field}" não pode exceder ${MAX_LENGTH} caracteres.` };
    }

    validatedInputs[field] = value;
  }

  return { isValid: true, data: { id: data.id, inputs: validatedInputs } };
}

// ------------------------------------------------------------------
// POST /trigger — dispara o workflow e retorna o runId
// ------------------------------------------------------------------
export default (
  app: Express,
  octokit: Octokit,
  env: typeof envs,
  triggerLimiter: RequestHandler,
  verificarCORS: RequestHandler,
) => {
  app.post("/trigger", verificarCORS, triggerLimiter, async (req: Request, res: Response) => {
    const body = req.body;

    const validationResult = validateBody(body);

    if (!validationResult.isValid) {
      return res.status(400).json({ message: validationResult.message });
    }

    const workflowName = validationResult.data.id;
    const workflowIdResult = getWorkflowId(workflowName);

    if (!workflowIdResult.isValid) {
      return res.status(400).json({ message: workflowIdResult.message });
    }

    const workflowId = workflowIdResult.data;

    const inputs = validationResult.data.inputs;

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
