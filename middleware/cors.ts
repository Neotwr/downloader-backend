// middleware
import type { Request, Response, NextFunction } from 'express';
import env from '../config/env.js';

function verificarCORS(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  const frontendUrl = env.FRONTEND_URL;
  const normalizedFrontendUrl = frontendUrl.replace(/\/$/, '');

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

export default verificarCORS;
