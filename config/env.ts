import dotenv from 'dotenv';

dotenv.config();

function getRequiredEnv(envVar: string): string {
  const value = process.env[envVar];
  if (!value || value.trim() === '') {
    console.error(`Variável de ambiente vazia ou em falta: ${envVar}`);
    process.exit(1);
  }
  return value;
}

export default {
  OWNER: getRequiredEnv('OWNER'),
  REPO: getRequiredEnv('REPO'),
  TOKEN: getRequiredEnv('TOKEN'),
  SECRET: getRequiredEnv('SECRET'),
  FRONTEND_URL: getRequiredEnv('FRONTEND_URL'),
  PORT: getRequiredEnv('PORT'),
  WORKFLOW_URLDOWNLOAD: getRequiredEnv('WORKFLOW_URLDOWNLOAD'),
  WORKFLOW_PYDOWNLOAD: getRequiredEnv('WORKFLOW_PYDOWNLOAD')
};
