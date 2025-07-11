import { apiClient } from "./apiClient";

class AuthService {
  async login(credentials) {
    try {
      const response = await apiClient.post("/api/auth/login", credentials);
      return response;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Erro ao fazer login");
    }
  }

  async register(userData) {
    try {
      const response = await apiClient.post("/api/auth/register", userData);
      return response;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || "Erro ao registrar usuário"
      );
    }
  }

  async logout() {
    try {
      await apiClient.post("/api/auth/logout");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  }

  async refreshToken() {
    try {
      const response = await apiClient.post("/api/auth/refresh");
      return response;
    } catch (error) {
      throw new Error("Erro ao renovar token");
    }
  }
}

export const authService = new AuthService();
