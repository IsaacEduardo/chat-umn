const User = require("../models/User");
const jwt = require("jsonwebtoken");
const CryptoService = require("../services/cryptoService");
const { validationResult } = require("express-validator");
const winston = require("winston");

class AuthController {
  static async register(req, res) {
    try {
      // ✅ VALIDAÇÃO: Verificar erros de validação primeiro
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        winston.warn("Erro de validação no registro", {
          errors: errors.array(),
          body: req.body,
          ip: req.ip,
        });
        return res.status(400).json({ 
          message: "Dados inválidos",
          errors: errors.array() 
        });
      }

      const { username, email, password } = req.body;

      // ✅ VALIDAÇÃO: Verificar se usuário já existe
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() }, 
          { username: username.toLowerCase() }
        ],
      }).select("_id email username");

      if (existingUser) {
        winston.warn("Tentativa de registro com email/username existente", {
          email: email.toLowerCase(),
          username,
          existingUser: {
            id: existingUser._id,
            email: existingUser.email,
            username: existingUser.username
          },
          ip: req.ip,
        });
        return res.status(400).json({
          message: "Email ou nome de usuário já está em uso",
        });
      }

      // ✅ GERAÇÃO: Gerar par de chaves com tratamento de erro
      let publicKey, privateKey;
      try {
        const keyPair = CryptoService.generateKeyPair();
        publicKey = keyPair.publicKey;
        privateKey = keyPair.privateKey;
      } catch (keyError) {
        winston.error("Erro ao gerar chaves criptográficas", {
          error: keyError.message,
          ip: req.ip,
        });
        return res.status(500).json({
          message: "Erro interno ao processar registro",
        });
      }

      // ✅ CRIAÇÃO: Criar usuário com tratamento específico de erros
      const user = new User({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password,
        publicKey,
        privateKey,
      });

      // ✅ SALVAMENTO: Salvar com tratamento específico de erros MongoDB
      let savedUser;
      try {
        savedUser = await user.save();
      } catch (saveError) {
        winston.error("Erro ao salvar usuário no banco", {
          error: saveError.message,
          code: saveError.code,
          keyPattern: saveError.keyPattern,
          username,
          email: email.toLowerCase(),
          ip: req.ip,
        });

        // ✅ TRATAMENTO: Erros específicos do MongoDB
        if (saveError.code === 11000) {
          const field = Object.keys(saveError.keyPattern)[0];
          return res.status(400).json({
            message: `${field === 'email' ? 'Email' : 'Nome de usuário'} já está em uso`,
          });
        }

        return res.status(500).json({
          message: "Erro interno ao criar conta",
        });
      }

      // ✅ TOKEN: Gerar token JWT
      let token;
      try {
        token = jwt.sign(
          { userId: savedUser._id },
          process.env.JWT_SECRET || "secret",
          { expiresIn: "24h" }
        );
      } catch (tokenError) {
        winston.error("Erro ao gerar token JWT", {
          error: tokenError.message,
          userId: savedUser._id,
          ip: req.ip,
        });
        return res.status(500).json({
          message: "Erro interno ao processar autenticação",
        });
      }

      // ✅ LOG: Log de sucesso ANTES da resposta
      winston.info("Novo usuário registrado com sucesso", {
        userId: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        ip: req.ip,
      });

      // ✅ RESPOSTA: Enviar resposta de sucesso
      return res.status(201).json({
        message: "Usuário criado com sucesso",
        token,
        user: {
          id: savedUser._id,
          username: savedUser.username,
          email: savedUser.email,
          publicKey: savedUser.publicKey,
        },
      });

    } catch (error) {
      // ✅ ERRO GERAL: Captura de erros não tratados
      winston.error("Erro geral no registro", { 
        error: error.message, 
        stack: error.stack,
        body: req.body,
        ip: req.ip 
      });
      
      // ✅ VERIFICAÇÃO: Evitar resposta duplicada
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: "Erro interno do servidor" 
        });
      }
    }
  }

  static async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Buscar usuário com consulta segura
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Log da tentativa de login com email inexistente
        winston.warn("Tentativa de login com email inexistente", {
          email: email.toLowerCase(),
          ip: req.ip,
        });
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      // Verificar senha
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        // Log da tentativa de login com senha incorreta
        winston.warn("Tentativa de login com senha incorreta", {
          userId: user._id,
          email: email.toLowerCase(),
          ip: req.ip,
        });
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      // Atualizar status online
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();

      // Gerar token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "24h" }
      );

      res.json({
        message: "Login realizado com sucesso",
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          publicKey: user.publicKey,
        },
      });
      // Log do login bem-sucedido
      winston.info("Login realizado com sucesso", {
        userId: user._id,
        ip: req.ip,
      });
    } catch (error) {
      winston.error("Erro no login", { error: error.message, ip: req.ip });
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  }
}

module.exports = AuthController;
