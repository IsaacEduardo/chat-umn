const rateLimit = require("express-rate-limit");
const MongoStore = require("rate-limit-mongo");

// Rate limiting específico para login
const loginLimiter = rateLimit({
  store: new MongoStore({
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/secure-chat",
    collectionName: "loginAttempts",
    expireTimeMs: 15 * 60 * 1000, // 15 minutos
  }),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas por IP
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Rate limiting mais restritivo para tentativas consecutivas falhadas
const strictLoginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 tentativas por hora após bloqueio
  message: {
    error: "Conta temporariamente bloqueada. Tente novamente em 1 hora.",
  },
});

module.exports = {
  loginLimiter,
  strictLoginLimiter,
};
