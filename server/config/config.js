const config = {
  development: {
    csp: {
      scriptSrc: ["'self'", "'unsafe-inline'"],
      reportOnly: true,
    },
    logging: {
      level: "debug",
    },
  },
  production: {
    csp: {
      scriptSrc: ["'self'"],
      reportOnly: false,
    },
    logging: {
      level: "warn",
    },
    security: {
      enforceHttps: true,
      hsts: true,
    },
  },
};

module.exports = config[process.env.NODE_ENV || "development"];
