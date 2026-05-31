// middleware
const env = require('../config/env');

function verificarCORS(req, res, next) {
  const origin = req.get('origin');
  const frontendUrl = env.FRONTEND_URL;
  const normalizedFrontendUrl = frontendUrl ? frontendUrl.replace(/\/$/, '') : '';

  if (!origin || origin !== normalizedFrontendUrl) {
    return res.status(401).send('Acesso negado.');
  }

  // Seta os headers CORS para a origem validada
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

module.exports = verificarCORS;