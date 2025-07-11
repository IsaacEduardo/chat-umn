import { io } from "socket.io-client";
import { useChatStore } from "@store/chatStore";
import { useAuthStore } from "@store/authStore";
import { cryptoService } from "@utils/cryptoService";
import { notificationService } from "@services/notificationService";

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isReconnecting = false;
    this.pendingMessages = new Map(); // ✅ Gerenciar mensagens pendentes
    this.messageTimeouts = new Map(); // ✅ Gerenciar timeouts
  }

  connect(token) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(
      import.meta.env.VITE_SERVER_URL || "http://localhost:5000",
      {
        auth: { token },
        transports: ["websocket", "polling"],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 20000,
        forceNew: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      }
    );

    this.setupEventListeners();
  }

  setupEventListeners() {
    // ✅ Limpar listeners existentes antes de adicionar novos
    if (this.socket) {
      this.socket.removeAllListeners();
    }

    const chatStore = useChatStore.getState();

    this.socket.on("connect", () => {
      console.log("✅ Conectado ao servidor");
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      useChatStore.getState().setConnectionStatus(true);

      // ✅ Reenviar mensagens pendentes após reconexão
      this.retryPendingMessages();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("❌ Desconectado:", reason);
      useChatStore.getState().setConnectionStatus(false);

      if (reason === "io server disconnect") {
        this.handleReconnection();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Erro de conexão:", error.message || error);
      this.handleReconnection();
    });

    // ✅ Melhorar handler de novas mensagens
    this.socket.on("newMessage", (messageData) => {
      console.log("📨 Nova mensagem recebida:", messageData);
      this.handleNewMessage(messageData);
    });

    this.socket.on("messageSent", (data) => {
      console.log("✅ Mensagem enviada confirmada:", data);
      this.handleMessageSent(data);
    });

    // ✅ Melhorar handler de erros
    this.socket.on("error", (error) => {
      const errorMessage = error?.message || error || "Erro desconhecido";
      console.error("❌ Erro do servidor:", errorMessage);

      // ✅ Notificar usuário sobre erro específico
      if (errorMessage.includes("Rate limit")) {
        notificationService.showError(
          "Muitas mensagens enviadas. Aguarde um momento."
        );
      } else if (errorMessage.includes("Destinatário não está online")) {
        notificationService.showError("Destinatário não está online.");
      }
    });

    // Adicionar listeners para typing
    this.socket.on("userTyping", (data) => {
      console.log("⌨️ Usuário digitando:", data);
      useChatStore.getState().setTyping(data.userId, data.username);
    });

    this.socket.on("userStoppedTyping", (data) => {
      console.log("⏹️ Usuário parou de digitar:", data);
      useChatStore.getState().removeTyping(data.userId);
    });

    // Adicionar listeners para usuários online
    this.socket.on("onlineUsers", (users) => {
      console.log("👥 Usuários online:", users);
      useChatStore.getState().setOnlineUsers(users);
    });

    this.socket.on("userOnline", (user) => {
      console.log("🟢 Usuário ficou online:", user);
      useChatStore.getState().addOnlineUser(user);
    });

    this.socket.on("userOffline", (data) => {
      console.log("🔴 Usuário ficou offline:", data);
      useChatStore.getState().removeOnlineUser(data.userId);
    });

    // Listener para erros
    this.socket.on("error", (error) => {
      console.error("❌ Erro do servidor:", error);
    });
  }

  handleReconnection() {
    if (
      this.isReconnecting ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );

    setTimeout(() => {
      if (!this.socket?.connected) {
        console.log(
          `🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
        );
        this.socket?.connect();
      }
      this.isReconnecting = false;
    }, delay);
  }

  // ✅ Novo método para gerenciar mensagens enviadas
  handleMessageSent(data) {
    const { tempId, messageId, receiverId, timestamp } = data;

    // Limpar timeout da mensagem
    if (this.messageTimeouts.has(tempId)) {
      clearTimeout(this.messageTimeouts.get(tempId));
      this.messageTimeouts.delete(tempId);
    }

    // Remover da lista de pendentes
    this.pendingMessages.delete(tempId);

    // Atualizar mensagem no store
    const conversationId = this.getConversationId(receiverId);
    if (conversationId) {
      useChatStore.getState().updateMessage(conversationId, tempId, {
        id: messageId,
        type: "sent",
        timestamp: timestamp,
        status: "delivered",
      });
    }
  }

  handleNewMessage(messageData) {
    const chatStore = useChatStore.getState();

    // ✅ Verificação de integridade melhorada
    const isValid = cryptoService.verifyMessageIntegrity(
      messageData.content,
      messageData.messageHash,
      messageData.signature,
      messageData.senderPublicKey
    );

    if (!isValid) {
      console.error("❌ Mensagem com integridade comprometida");
      return;
    }

    const conversationId = this.getConversationId(messageData.senderId);
    if (!conversationId) {
      console.error("❌ Não foi possível gerar conversationId");
      return;
    }

    const message = {
      id: messageData.messageId,
      senderId: messageData.senderId,
      senderUsername: messageData.senderUsername,
      content: messageData.content,
      timestamp: messageData.timestamp,
      type: "received",
      verified: true,
      status: "delivered",
    };

    // ✅ Adicionar mensagem e forçar atualização da UI
    chatStore.addMessage(conversationId, message);

    // ✅ Atualizar contador de não lidas apenas se necessário
    const currentSelectedUser = chatStore.selectedUser;
    if (
      !currentSelectedUser ||
      currentSelectedUser.id !== messageData.senderId
    ) {
      chatStore.incrementUnreadCount(messageData.senderId);
    }

    // ✅ Forçar atualização da lista de conversas
    chatStore.loadConversations();

    // Mostrar notificação
    notificationService.showMessageNotification(
      messageData.senderUsername,
      messageData.content
    );
    notificationService.playNotificationSound();
  }

  // ✅ Sistema de envio de mensagens melhorado
  async sendMessage(receiverId, content) {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 segundos entre tentativas

    try {
      const conversationId = this.getConversationId(receiverId);
      if (!conversationId) {
        throw new Error("Não foi possível gerar ID da conversa");
      }

      // ✅ Adicionar mensagem como "enviando"
      const tempMessage = {
        tempId,
        content,
        senderId: useAuthStore.getState().user.id,
        timestamp: new Date().toISOString(),
        type: "sending",
        status: "pending",
      };

      useChatStore.getState().addMessage(conversationId, tempMessage);

      // ✅ Armazenar mensagem pendente
      this.pendingMessages.set(tempId, {
        receiverId,
        content,
        tempId,
        conversationId,
        retryCount: 0,
        maxRetries,
      });

      return this.attemptSendMessage(tempId);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      throw error;
    }
  }

  // ✅ Método para tentar enviar mensagem com retry
  async attemptSendMessage(tempId) {
    const messageData = this.pendingMessages.get(tempId);
    if (!messageData) {
      throw new Error("Mensagem não encontrada");
    }

    const { receiverId, content, conversationId, retryCount, maxRetries } =
      messageData;

    return new Promise((resolve, reject) => {
      // ✅ Configurar timeout para esta tentativa
      const timeout = setTimeout(() => {
        if (retryCount < maxRetries) {
          console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} para mensagem`);

          // ✅ Incrementar contador de retry
          messageData.retryCount = retryCount + 1;
          this.pendingMessages.set(tempId, messageData);

          // ✅ Tentar novamente após delay
          setTimeout(
            () => {
              this.attemptSendMessage(tempId).then(resolve).catch(reject);
            },
            2000 * (retryCount + 1)
          ); // Delay progressivo
        } else {
          // ✅ Falha definitiva
          this.pendingMessages.delete(tempId);
          this.messageTimeouts.delete(tempId);

          useChatStore.getState().updateMessage(conversationId, tempId, {
            type: "failed",
            status: "failed",
            error: "Falha ao enviar mensagem",
          });

          reject(
            new Error("Falha ao enviar mensagem após múltiplas tentativas")
          );
        }
      }, 5000); // 5 segundos de timeout por tentativa

      this.messageTimeouts.set(tempId, timeout);

      // ✅ Verificar conexão antes de enviar
      if (!this.socket?.connected) {
        clearTimeout(timeout);
        reject(new Error("Socket não conectado"));
        return;
      }

      // ✅ Enviar mensagem
      this.socket.emit("sendMessage", {
        receiverId,
        content,
        tempId,
      });

      // ✅ Listener único para esta mensagem
      const handleMessageSent = (data) => {
        if (data.tempId === tempId) {
          clearTimeout(timeout);
          this.messageTimeouts.delete(tempId);
          this.socket.off("messageSent", handleMessageSent);
          resolve(data);
        }
      };

      this.socket.on("messageSent", handleMessageSent);
    });
  }

  // ✅ Reenviar mensagens pendentes após reconexão
  retryPendingMessages() {
    for (const [tempId, messageData] of this.pendingMessages) {
      if (messageData.retryCount < messageData.maxRetries) {
        console.log(`🔄 Reenviando mensagem pendente: ${tempId}`);
        this.attemptSendMessage(tempId).catch((error) => {
          console.error(`Erro ao reenviar mensagem ${tempId}:`, error);
        });
      }
    }
  }

  startTyping(receiverId) {
    if (this.socket?.connected) {
      this.socket.emit("typing", { receiverId });
    }
  }

  stopTyping(receiverId) {
    if (this.socket?.connected) {
      this.socket.emit("stopTyping", { receiverId });
    }
  }

  getConversationId(userId) {
    const currentUser = useAuthStore.getState().user;
    const currentUserId = currentUser?.id;

    // Validação mais rigorosa
    if (!currentUserId || !userId) {
      console.error("Invalid user IDs for conversation:", {
        currentUserId: typeof currentUserId,
        userId: typeof userId,
        currentUserIdValue: currentUserId,
        userIdValue: userId,
      });
      return null;
    }

    // Garantir que ambos são strings
    const currentUserIdStr = String(currentUserId);
    const userIdStr = String(userId);

    if (
      !currentUserIdStr ||
      !userIdStr ||
      currentUserIdStr === "undefined" ||
      userIdStr === "undefined"
    ) {
      console.error("Invalid user ID strings:", {
        currentUserIdStr,
        userIdStr,
      });
      return null;
    }

    const conversationId = [currentUserIdStr, userIdStr].sort().join("_");
    console.log("Generated conversation ID:", conversationId);
    return conversationId;
  }

  disconnect() {
    // ✅ Limpar timeouts e mensagens pendentes
    this.messageTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.messageTimeouts.clear();
    this.pendingMessages.clear();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      useChatStore.getState().setConnectionStatus(false);
    }
  }
}

export const socketService = new SocketService();
