require('dotenv').config();

const requiredEnvVars = ['OWNER', 'REPO', 'TOKEN', 'FRONTEND_URL', 'SECRET', 'PORT'];

// Função que valida cada variavel da .env de forma explícita
function validateEnvVars() {
  if (!process.env.OWNER || process.env.OWNER.trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: OWNER');
    process.exit(1);
  }
  if (!process.env.REPO || process.env.REPO.trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: REPO');
    process.exit(1);
  }
  if (!process.env.TOKEN || process.env.TOKEN.trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: TOKEN');
    process.exit(1);
  }
  if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: FRONTEND_URL');
    process.exit(1);
  }
  if (!process.env.SECRET || process.env.SECRET.trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: SECRET');
    process.exit(1);
  }
  if (!process.env.PORT || String(process.env.PORT).trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: PORT');
    process.exit(1);
  }
  if (!process.env.WORKFLOW_URLDOWNLOAD || process.env.WORKFLOW_URLDOWNLOAD.trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: WORKFLOW_URLDOWNLOAD');
    process.exit(1);
  }
  if (!process.env.WORKFLOW_PYDOWNLOAD || process.env.WORKFLOW_PYDOWNLOAD.trim() === '') {
    console.error('Variável de ambiente vazia ou faltando: WORKFLOW_PYDOWNLOAD');
    process.exit(1);
  }
}

validateEnvVars();

module.exports = {
  OWNER: process.env.OWNER,
  REPO: process.env.REPO,
  TOKEN: process.env.TOKEN,
  SECRET: process.env.SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  PORT: process.env.PORT,
  WORKFLOW_URLDOWNLOAD: process.env.WORKFLOW_URLDOWNLOAD,
  WORKFLOW_PYDOWNLOAD: process.env.WORKFLOW_PYDOWNLOAD,
};