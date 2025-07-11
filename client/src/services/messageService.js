import { apiClient } from "./apiClient";

class MessageService {
  // Buscar conversas
  async getConversations() {
    try {
      const response = await apiClient.get("/api/messages/conversations");
      return response; // Removido .data pois apiClient.get já retorna response.data
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Erro ao buscar conversas"
      );
    }
  }

  // Buscar mensagens de uma conversa
  async getMessages(conversationId, page = 1, limit = 50) {
    try {
      const response = await apiClient.get(
        `/api/messages/conversations/${conversationId}`,
        {
          params: { page, limit },
        }
      );
      return response; // Removido .data
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Erro ao buscar mensagens"
      );
    }
  }

  // Buscar usuários
  async searchUsers(query) {
    try {
      const response = await apiClient.get("/api/messages/users/search", {
        params: { query },
      });
      return response; // Removido .data
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Erro ao buscar usuários"
      );
    }
  }

  // Buscar mensagens
  async searchMessages(query, conversationId = null) {
    try {
      const response = await apiClient.get("/api/messages/search", {
        params: { query, conversationId },
      });
      return response; // Removido .data
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Erro ao buscar mensagens"
      );
    }
  }

  // Marcar como entregue
  async markAsDelivered(messageIds) {
    try {
      const response = await apiClient.patch("/api/messages/delivered", {
        messageIds,
      });
      return response; // Removido .data
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Erro ao marcar mensagens"
      );
    }
  }
}

export const messageService = new MessageService();
