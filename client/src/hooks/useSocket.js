import { useEffect } from "react";
import { useAuthStore } from "@store/authStore";
import { useChatStore } from "@store/chatStore";
import { socketService } from "@services/socketService";

export const useSocket = () => {
  const { token, isAuthenticated } = useAuthStore();
  const { isConnected } = useChatStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.connect(token);
    }

    return () => {
      if (!isAuthenticated) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated, token]);

  return {
    isConnected,
    sendMessage: socketService.sendMessage.bind(socketService),
    startTyping: socketService.startTyping.bind(socketService),
    stopTyping: socketService.stopTyping.bind(socketService),
  };
};
