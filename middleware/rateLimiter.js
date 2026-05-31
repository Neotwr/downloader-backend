const rateLimit = require("express-rate-limit");

function handleRateLimitViolation(req, res) {
  console.warn(
    `⚠️ Rate limit violado - IP: ${req.ip}, Endpoint: ${req.path}, Horário: ${new Date().toISOString()}`,
  );
  res
    .status(429)
    .json({ message: "Muitas requisições. Tente novamente em 1 hora." });
}

// Configuração do rate limiter
function createLimiter(
  max = 6,
  message = "Muitas requisições. Tente novamente em 1 hora.",
  windowMs = 60 * 60 * 1000,
) {
  return rateLimit({
    windowMs,
    max,
    message,
    statusCode: 429,
    handler: handleRateLimitViolation,
  });
}

const triggerLimiter = createLimiter();
const downloadLimiter = createLimiter({ max: 15 }); // Mais permissivo para downloads (15 em 1 hora)

module.exports = {
  triggerLimiter,
  downloadLimiter,
};
