const hpp = require("hpp");

// Middleware de sanitização manual (100% compatível com Express 5)
const noSQLSanitizer = (req, res, next) => {
  try {
    // Sanitizar body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, 'body');
    }
    
    // Sanitizar params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, 'params');
    }
    
    // Sanitizar query (sem modificar a propriedade original)
    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery = sanitizeObject(req.query, 'query');
      // Criar nova propriedade sanitizada sem modificar a original
      req.sanitizedQuery = sanitizedQuery;
    }
    
    next();
  } catch (error) {
    console.error('Erro na sanitização:', error);
    next(error);
  }
};

// Função de sanitização robusta
function sanitizeObject(obj, source = 'unknown') {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj !== 'object') {
    // Sanitizar strings
    if (typeof obj === 'string') {
      return sanitizeString(obj, source);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item, index) => 
      sanitizeObject(item, `${source}[${index}]`)
    );
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Detectar tentativas de NoSQL injection
    if (isNoSQLInjectionAttempt(key)) {
      console.warn(`🚨 NoSQL Injection detectada em ${source}.${key}:`, {
        key,
        value,
        source,
        timestamp: new Date().toISOString()
      });
      continue; // Pular chave perigosa
    }
    
    // Sanitizar chave
    const sanitizedKey = sanitizeString(key, `${source}.key`);
    
    // Sanitizar valor recursivamente
    sanitized[sanitizedKey] = sanitizeObject(value, `${source}.${key}`);
  }
  
  return sanitized;
}

// Detectar tentativas de NoSQL injection
function isNoSQLInjectionAttempt(key) {
  if (typeof key !== 'string') return false;
  
  // Padrões perigosos
  const dangerousPatterns = [
    /^\$/,           // Começa com $
    /\./,            // Contém ponto
    /\$where/i,      // $where
    /\$regex/i,      // $regex
    /\$ne/i,         // $ne
    /\$gt/i,         // $gt
    /\$lt/i,         // $lt
    /\$in/i,         // $in
    /\$nin/i,        // $nin
    /\$exists/i,     // $exists
    /\$or/i,         // $or
    /\$and/i,        // $and
    /\$nor/i,        // $nor
    /\$not/i,        // $not
    /\$expr/i,       // $expr
    /\$jsonSchema/i, // $jsonSchema
    /\$mod/i,        // $mod
    /\$all/i,        // $all
    /\$size/i,       // $size
    /\$type/i,       // $type
    /\$elemMatch/i,  // $elemMatch
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(key));
}

// Sanitizar strings
function sanitizeString(str, source = 'unknown') {
  if (typeof str !== 'string') return str;
  
  // Remover caracteres perigosos
  let sanitized = str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Caracteres de controle
    .replace(/javascript:/gi, '')                      // javascript: protocol
    .replace(/vbscript:/gi, '')                       // vbscript: protocol
    .replace(/data:/gi, '')                           // data: protocol (em alguns contextos)
    .trim();
  
  // Log se houve sanitização
  if (sanitized !== str) {
    console.warn(`🧹 String sanitizada em ${source}:`, {
      original: str,
      sanitized,
      source,
      timestamp: new Date().toISOString()
    });
  }
  
  return sanitized;
}

// Middleware para headers de segurança
const additionalSecurityHeaders = (req, res, next) => {
  // Prevenir MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Proteção XSS adicional
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Prevenir clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Controle de referrer
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Política de permissões
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
  );

  // Cache control para dados sensíveis
  if (req.path.includes("/api/")) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
};

// Middleware de sanitização combinado
const sanitizationMiddleware = [
  // Sanitização NoSQL personalizada
  noSQLSanitizer,
  
  // Proteção contra HTTP Parameter Pollution
  hpp({
    whitelist: ["tags", "categories", "sort", "fields"], // Parâmetros permitidos como arrays
  }),
];

// Middleware de validação adicional para rotas críticas
const criticalRouteValidator = (req, res, next) => {
  const criticalPaths = ['/api/auth/', '/api/admin/', '/api/user/'];
  
  if (criticalPaths.some(path => req.path.includes(path))) {
    // Validação extra para rotas críticas
    if (req.body) {
      const bodyStr = JSON.stringify(req.body);
      
      // Detectar payloads suspeitos
      const suspiciousPatterns = [
        /eval\s*\(/i,
        /function\s*\(/i,
        /setTimeout\s*\(/i,
        /setInterval\s*\(/i,
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload\s*=/i,
        /onerror\s*=/i,
      ];
      
      if (suspiciousPatterns.some(pattern => pattern.test(bodyStr))) {
        console.error(`🚨 Payload suspeito detectado em ${req.path}:`, {
          body: req.body,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        return res.status(400).json({
          message: 'Payload inválido detectado',
          code: 'SUSPICIOUS_PAYLOAD'
        });
      }
    }
  }
  
  next();
};

module.exports = {
  sanitizationMiddleware,
  additionalSecurityHeaders,
  noSQLSanitizer,
  criticalRouteValidator,
};
