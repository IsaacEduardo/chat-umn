import { useRef, useCallback } from "react";
import { useSocket } from "./useSocket";

export const useTyping = (receiverId) => {
  const { startTyping, stopTyping } = useSocket();
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleStartTyping = useCallback(() => {
    if (!isTypingRef.current && receiverId) {
      isTypingRef.current = true;
      startTyping(receiverId);
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  }, [receiverId, startTyping]);

  const handleStopTyping = useCallback(() => {
    if (isTypingRef.current && receiverId) {
      isTypingRef.current = false;
      stopTyping(receiverId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [receiverId, stopTyping]);

  return {
    handleStartTyping,
    handleStopTyping,
  };
};
