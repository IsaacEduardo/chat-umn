const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const winston = require("winston");
require("dotenv").config();

// Importar middlewares de segurança
const {
  sanitizationMiddleware,
  additionalSecurityHeaders,
  criticalRouteValidator,
} = require("./middleware/securityMiddleware");

// Importar rotas e serviços
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const SocketManager = require("./services/socketManager");

// Configurar logger PRIMEIRO
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware de logging ANTES de tudo
app.use((req, res, next) => {
  const start = Date.now();
  console.log(
    `${req.method} ${req.path}`,
    req.headers.authorization ? "Authenticated" : "No Auth"
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("HTTP Request", {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });
  });

  next();
});

// Middlewares de Segurança (ordem importante)
app.use(additionalSecurityHeaders);

// Configuração CSP baseada no ambiente
const cspConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        ...(process.env.NODE_ENV === "development" ? ["'unsafe-inline'"] : []),
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: [
        "'self'",
        // Configuração específica para desenvolvimento
        ...(process.env.NODE_ENV === "development"
          ? [
              "http://localhost:*",
              "https://localhost:*",
              "ws://localhost:*",
              "wss://localhost:*",
            ]
          : [
              // Em produção, usar apenas HTTPS e WSS
              process.env.API_URL || "https://your-domain.com",
              "wss://your-domain.com",
            ]),
        process.env.CLIENT_URL || "http://localhost:3000",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    reportOnly: false,
  },
  crossOriginEmbedderPolicy: false,
  hsts:
    process.env.NODE_ENV === "production"
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
};

app.use(helmet(cspConfig));
app.use(compression());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Aplicar middlewares de sanitização (SUBSTITUIR a linha existente)
app.use(sanitizationMiddleware);

// Adicionar validação para rotas críticas
app.use(criticalRouteValidator);

app.use(express.json({ limit: "10mb" }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
});
app.use(limiter);

// Conexão MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/secure-chat"
);

// Event listeners para conexão MongoDB
mongoose.connection.on("connected", () => {
  console.log("✅ Conectado ao MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Erro na conexão MongoDB:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ Desconectado do MongoDB");
});

// Endpoint para relatórios de violação CSP
app.post(
  "/api/csp-report",
  express.json({ type: "application/csp-report" }),
  (req, res) => {
    console.warn("CSP Violation Report:", req.body);
    logger.warn("CSP Violation", {
      report: req.body,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });
    res.status(204).end();
  }
);

// Configurar rotas
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Rota de teste
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Servidor funcionando",
    timestamp: new Date().toISOString(),
  });
});

// Inicializar Socket Manager
const socketManager = new SocketManager(io);

// Middleware para rotas não encontradas
app.use((req, res, next) => {
  res.status(404).json({
    message: "Rota não encontrada",
    path: req.originalUrl,
  });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error("❌ Erro no servidor:", error);
  logger.error("Server Error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });
  res.status(500).json({
    message: "Erro interno do servidor",
    ...(process.env.NODE_ENV === "development" && { error: error.message }),
  });
});

// ✅ MIDDLEWARE: Log detalhado de requisições
app.use("/api/auth/register", (req, res, next) => {
  console.log("🔍 REGISTRO - Dados recebidos:", {
    body: req.body,
    headers: req.headers,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  next();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Socket.IO configurado`);
  console.log(`🔗 API disponível em http://localhost:${PORT}/api`);
});
