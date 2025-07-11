const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const CryptoService = require("./cryptoService");

class SocketManager {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
    this.messageRateLimit = new Map(); // Rate limiting para mensagens
    this.setupSocketHandlers();
  }

  checkRateLimit(userId, action = "message") {
    const now = Date.now();
    const key = `${userId}_${action}`;
    const limit = action === "message" ? 10 : 30; // 10 msgs/min ou 30 ações/min
    const window = 60000; // 1 minuto

    if (!this.messageRateLimit.has(key)) {
      this.messageRateLimit.set(key, { count: 1, resetTime: now + window });
      return true;
    }

    const rateData = this.messageRateLimit.get(key);

    if (now > rateData.resetTime) {
      rateData.count = 1;
      rateData.resetTime = now + window;
      return true;
    }

    if (rateData.count >= limit) {
      return false;
    }

    rateData.count++;
    return true;
  }

  async handleMessage(socket, data) {
    try {
      const { receiverId, content, tempId } = data;
      const senderId = socket.userId;

      // ✅ Validação melhorada
      if (!receiverId || !content || !tempId) {
        socket.emit("error", {
          message: "Dados obrigatórios ausentes",
          tempId,
        });
        return;
      }

      if (content.trim().length === 0) {
        socket.emit("error", {
          message: "Conteúdo da mensagem não pode estar vazio",
          tempId,
        });
        return;
      }

      if (content.length > 1000) {
        socket.emit("error", {
          message: "Mensagem muito longa (máximo 1000 caracteres)",
          tempId,
        });
        return;
      }

      // Rate limiting
      if (!this.checkRateLimit(senderId, "message")) {
        socket.emit("error", {
          message: "Muitas mensagens enviadas. Aguarde um momento.",
          tempId,
        });
        return;
      }

      const sender = this.connectedUsers.get(socket.userId);
      if (!sender) {
        socket.emit("error", {
          message: "Usuário remetente não encontrado",
          tempId,
        });
        return;
      }

      // ✅ Verificar se destinatário existe no banco (não apenas online)
      const receiverUser = await User.findById(receiverId);
      if (!receiverUser) {
        socket.emit("error", {
          message: "Destinatário não encontrado",
          tempId,
        });
        return;
      }

      // ✅ Criptografar mensagem
      const encryptedContent = CryptoService.encryptMessage(
        content,
        sender.sessionKey
      );

      // ✅ Gerar hash e assinatura
      const messageHash = CryptoService.generateMessageHash(content);
      const signature = CryptoService.signMessage(
        content,
        socket.user.privateKey
      );

      // ✅ Salvar mensagem no banco de dados
      const message = new Message({
        sender: socket.userId,
        receiver: receiverId,
        content: content,
        encryptedContent: encryptedContent,
        messageHash: messageHash,
        signature: signature,
        timestamp: new Date(),
      });

      await message.save();

      // ✅ Confirmar envio para o remetente PRIMEIRO
      socket.emit("messageSent", {
        messageId: message._id,
        receiverId,
        tempId,
        timestamp: message.timestamp,
      });

      // ✅ Enviar para o destinatário (se online)
      const receiver = this.connectedUsers.get(receiverId);
      if (receiver) {
        this.io.to(receiver.socketId).emit("newMessage", {
          messageId: message._id,
          senderId: socket.userId,
          senderUsername: socket.user.username,
          senderPublicKey: socket.user.publicKey,
          content,
          encryptedContent,
          signature,
          messageHash,
          timestamp: message.timestamp,
        });
      }

      console.log(`✅ Mensagem processada: ${senderId} -> ${receiverId}`);
    } catch (error) {
      console.error("❌ Erro ao processar mensagem:", error);
      socket.emit("error", {
        message: "Erro interno do servidor",
        tempId: data?.tempId,
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
        const user = await User.findById(decoded.userId);

        if (!user) {
          return next(new Error("Usuário não encontrado"));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error("Token inválido"));
      }
    });

    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    console.log(`Usuário conectado: ${socket.user.username}`);

    // Atualizar status online no banco de dados
    User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date(),
    }).exec();

    // Adicionar usuário à lista de conectados
    this.connectedUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      sessionKey: CryptoService.generateSessionKey(),
    });

    // Notificar outros usuários
    socket.broadcast.emit("userOnline", {
      userId: socket.userId,
      username: socket.user.username,
    });

    // Enviar lista de usuários online
    socket.emit("onlineUsers", this.getOnlineUsers());

    // Handlers de eventos
    socket.on("sendMessage", (data) => this.handleMessage(socket, data)); // Corrigido de handleSendMessage para handleMessage
    socket.on("typing", (data) => this.handleTyping(socket, data));
    socket.on("stopTyping", (data) => this.handleStopTyping(socket, data));
    socket.on("disconnect", () => this.handleDisconnect(socket));
  }

  handleTyping(socket, data) {
    const { receiverId } = data;
    const receiver = this.connectedUsers.get(receiverId);

    if (receiver) {
      this.io.to(receiver.socketId).emit("userTyping", {
        userId: socket.userId,
        username: socket.user.username,
      });
    }
  }

  handleStopTyping(socket, data) {
    const { receiverId } = data;
    const receiver = this.connectedUsers.get(receiverId);

    if (receiver) {
      this.io.to(receiver.socketId).emit("userStoppedTyping", {
        userId: socket.userId,
      });
    }
  }

  handleDisconnect(socket) {
    console.log(`Usuário desconectado: ${socket.user.username}`);

    // Remover da lista de conectados
    this.connectedUsers.delete(socket.userId);

    // Atualizar status no banco
    User.findByIdAndUpdate(socket.userId, {
      isOnline: false,
      lastSeen: new Date(),
    }).exec();

    // Notificar outros usuários
    socket.broadcast.emit("userOffline", {
      userId: socket.userId,
    });
  }

  getOnlineUsers() {
    return Array.from(this.connectedUsers.values()).map(({ user }) => ({
      id: user._id,
      username: user.username,
      publicKey: user.publicKey,
    }));
  }
}

module.exports = SocketManager;
