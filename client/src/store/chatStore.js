import { create } from "zustand";
import { socketService } from "@services/socketService";
import { messageService } from "@services/messageService";
import { useAuthStore } from "@store/authStore";

// Adicionar ao chatStore
// Adicionar cache com TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const useChatStore = create((set, get) => ({
  messages: new Map(),
  conversations: [],
  onlineUsers: [],
  selectedUser: null,
  typingUsers: new Set(),
  isConnected: false,
  unreadCounts: new Map(),
  searchResults: [],
  isLoadingMessages: false,
  isLoadingConversations: false,
  messageStatus: new Map(),
  cache: new Map(),

  setSelectedUser: (user) => {
    set({ selectedUser: user });
    if (user && user.id) {
      // Gerar conversationId correto no formato id1_id2
      const currentUser = useAuthStore.getState().user;
      if (currentUser && currentUser.id) {
        const conversationId = [currentUser.id, user.id].sort().join("_");
        get().loadMessages(conversationId);
      }
    }
  },

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  addOnlineUser: (user) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.find((u) => u.id === user.id)
        ? state.onlineUsers
        : [...state.onlineUsers, user],
    })),

  removeOnlineUser: (userId) =>
    set((state) => ({
      onlineUsers: state.onlineUsers.filter((u) => u.id !== userId),
    })),

  setConnectionStatus: (isConnected) => set({ isConnected }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const conversationMessages = newMessages.get(conversationId) || [];

      // ✅ Verificar se mensagem já existe
      const existingIndex = conversationMessages.findIndex(
        (m) =>
          (m.id && m.id === message.id) ||
          (m.tempId && m.tempId === message.tempId)
      );

      if (existingIndex >= 0) {
        // ✅ Atualizar mensagem existente
        conversationMessages[existingIndex] = {
          ...conversationMessages[existingIndex],
          ...message,
        };
      } else {
        // ✅ Adicionar nova mensagem
        conversationMessages.push(message);
      }

      // ✅ Ordenar mensagens por timestamp
      conversationMessages.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      newMessages.set(conversationId, conversationMessages);
      console.log(
        `✅ Mensagem adicionada à conversa ${conversationId}:`,
        message
      );

      // ✅ Forçar re-render dos componentes
      return {
        messages: newMessages,
        lastUpdate: Date.now(), // Trigger para re-render
      };
    }),

  // ✅ Método para forçar atualização da UI
  forceUpdate: () =>
    set((state) => ({
      ...state,
      lastUpdate: Date.now(),
    })),

  updateMessage: (conversationId, tempId, updates) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const conversationMessages = newMessages.get(conversationId) || [];

      const messageIndex = conversationMessages.findIndex(
        (m) => m.tempId === tempId
      );
      if (messageIndex >= 0) {
        conversationMessages[messageIndex] = {
          ...conversationMessages[messageIndex],
          ...updates,
        };
        newMessages.set(conversationId, conversationMessages);
      }

      return { messages: newMessages };
    }),

  getConversationMessages: (conversationId) => {
    const state = get();
    return state.messages.get(conversationId) || [];
  },

  setTyping: (userId, username) =>
    set((state) => {
      const newTypingUsers = new Set(state.typingUsers);
      state.typingUsers.forEach((user) => {
        if (user.userId === userId) {
          newTypingUsers.delete(user);
        }
      });
      newTypingUsers.add({ userId, username });
      return { typingUsers: newTypingUsers };
    }),

  removeTyping: (userId) =>
    set((state) => {
      const newTypingUsers = new Set();
      state.typingUsers.forEach((user) => {
        if (user.userId !== userId) {
          newTypingUsers.add(user);
        }
      });
      return { typingUsers: newTypingUsers };
    }),

  // Carregar conversas com cache
  loadConversations: async () => {
    // Verificar cache primeiro
    const cached = get().getCachedData("conversations");
    if (cached) {
      set({ conversations: cached, isLoadingConversations: false });
      return;
    }

    set({ isLoadingConversations: true });
    try {
      console.log("Loading conversations...");
      const data = await messageService.getConversations();
      console.log("Conversations response:", data);

      if (data && data.conversations && Array.isArray(data.conversations)) {
        set({
          conversations: data.conversations,
          isLoadingConversations: false,
        });
        get().setCachedData("conversations", data.conversations);
      } else {
        console.error("Invalid conversations response format:", data);
        set({
          conversations: [],
          isLoadingConversations: false,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
      if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized")
      ) {
        useAuthStore.getState().logout();
      }
      set({
        conversations: [],
        isLoadingConversations: false,
      });
    }
  },

  // Buscar usuários
  searchUsers: async (query) => {
    try {
      console.log("Searching users with query:", query);
      const data = await messageService.searchUsers(query);
      console.log("Search users response:", data);

      if (data && data.users && Array.isArray(data.users)) {
        const users = data.users;
        set({ searchResults: users });
        return users;
      } else {
        console.error("Invalid search users response format:", data);
        set({ searchResults: [] });
        return [];
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      if (
        error.message.includes("401") ||
        error.message.includes("Unauthorized")
      ) {
        useAuthStore.getState().logout();
      }
      set({ searchResults: [] });
      return [];
    }
  },

  // Buscar mensagens
  searchMessages: async (query, conversationId = null) => {
    try {
      const data = await messageService.searchMessages(query, conversationId);
      return data && data.messages ? data.messages : [];
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      return [];
    }
  },

  // Paginação otimizada
  loadMessages: async (conversationId, page = 1, limit = 50) => {
    set({ isLoadingMessages: true });
    try {
      const data = await messageService.getMessages(
        conversationId,
        page,
        limit
      );

      set((state) => {
        const newMessages = new Map(state.messages);
        const existingMessages = newMessages.get(conversationId) || [];

        const mergedMessages =
          page === 1 ? data.messages : [...data.messages, ...existingMessages];

        newMessages.set(conversationId, mergedMessages);
        return {
          messages: newMessages,
          isLoadingMessages: false,
        };
      });

      return data;
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      set({ isLoadingMessages: false });
    }
  },

  // Incrementar contador de não lidas
  incrementUnreadCount: (userId) =>
    set((state) => {
      const newUnreadCounts = new Map(state.unreadCounts);
      const current = newUnreadCounts.get(userId) || 0;
      newUnreadCounts.set(userId, current + 1);
      console.log(
        `Incrementing unread count for user ${userId}: ${current + 1}`
      );
      return { unreadCounts: newUnreadCounts };
    }),

  // Limpar contador de não lidas
  clearUnreadCount: (userId) =>
    set((state) => {
      const newUnreadCounts = new Map(state.unreadCounts);
      newUnreadCounts.delete(userId);
      console.log(`Clearing unread count for user ${userId}`);
      return { unreadCounts: newUnreadCounts };
    }),

  // Status de mensagens
  updateMessageStatus: (messageId, status) =>
    set((state) => {
      const newStatus = new Map(state.messageStatus);
      newStatus.set(messageId, { status, timestamp: Date.now() });
      return { messageStatus: newStatus };
    }),

  // Cache functions
  getCachedData: (key) => {
    const cached = get().cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  },

  setCachedData: (key, data) => {
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.set(key, {
        data,
        timestamp: Date.now(),
      });
      return { cache: newCache };
    });
  },
}));

// EXPORTAÇÃO NECESSÁRIA
export { useChatStore };
