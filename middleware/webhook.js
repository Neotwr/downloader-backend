const crypto = require("crypto");
const env = require("../config/env");

// ------------------------------------------------------------------
// Verifica assinatura do webhook do GitHub
// ------------------------------------------------------------------
function verifySignature(req) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !req.rawBody) {
    console.error("⚠️ Assinatura ou RawBody ausentes.");
    return false;
  }
  const hmac = crypto.createHmac("sha256", env.SECRET);
  const digest = Buffer.from(
    "sha256=" + hmac.update(req.rawBody).digest("hex"),
    "utf8",
  );
  const checksum = Buffer.from(signature, "utf8");

  // timingSafeEqual lança RangeError se os buffers tiverem tamanhos diferentes
  if (digest.length !== checksum.length) return false;

  return crypto.timingSafeEqual(digest, checksum);
}

module.exports = verifySignature;
