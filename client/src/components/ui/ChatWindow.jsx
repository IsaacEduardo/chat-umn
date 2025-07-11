import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  List,
  ListItem,
  Chip,
  InputAdornment,
} from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";
import { useChatStore } from "@store/chatStore";
import { useAuthStore } from "@store/authStore";
import { socketService } from "@services/socketService";
import { useCallback } from "react";
import { debounce } from "lodash";
import { CircularProgress, Skeleton } from "@mui/material";

const ChatWindow = ({ selectedUser }) => {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { user } = useAuthStore();
  const {
    messages,
    typingUsers,
    getConversationMessages,
    isLoadingMessages,
    isConnected,
  } = useChatStore();

  // Corrigir a geração do conversationId para usar apenas 'id'
  const conversationId =
    selectedUser && user?.id
      ? [user.id, selectedUser.id].sort().join("_")
      : null;

  const conversationMessages = conversationId
    ? getConversationMessages(conversationId)
    : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (selectedUser && selectedUser.id) {
      const { clearUnreadCount } = useChatStore.getState();
      // ✅ CORREÇÃO: Usar selectedUser.id em vez de conversationId
      clearUnreadCount(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;

    try {
      socketService.sendMessage(selectedUser.id, message.trim());
      setMessage("");
      handleStopTyping();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  // Otimizar typing com debounce
  const debouncedTyping = useCallback(
    debounce(() => {
      if (selectedUser) {
        socketService.startTyping(selectedUser.id);
      }
    }, 300),
    [selectedUser]
  );

  const handleTyping = () => {
    if (!isTyping && selectedUser) {
      setIsTyping(true);
      debouncedTyping();
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1500); // Reduzido de 2000ms para 1500ms
  };

  const handleStopTyping = () => {
    if (isTyping && selectedUser) {
      setIsTyping(false);
      socketService.stopTyping(selectedUser.id);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const isUserTyping = Array.from(typingUsers).some(
    (entry) => entry.userId === selectedUser?.id
  );

  if (!selectedUser) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          💬 Bem-vindo ao Chat UMN
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Selecione um usuário online para começar a conversar
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Chat Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6">
          💬 Conversando com {selectedUser.username}
        </Typography>
        {isUserTyping && (
          <Chip
            label="digitando..."
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isLoadingMessages ? (
          <Box sx={{ p: 2 }}>
            {[...Array(5)].map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                height={60}
                sx={{ mb: 1, borderRadius: 2 }}
              />
            ))}
          </Box>
        ) : conversationMessages.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Nenhuma mensagem ainda. Seja o primeiro a enviar uma mensagem!
            </Typography>
          </Box>
        ) : (
          <List sx={{ flex: 1 }}>
            {conversationMessages.map((msg, index) => {
              const isOwnMessage =
                msg.senderId === user?.id || msg.type === "sent";
              return (
                <ListItem
                  key={msg.id || index}
                  sx={{
                    display: "flex",
                    justifyContent: isOwnMessage ? "flex-end" : "flex-start",
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 1.5,
                      maxWidth: "70%",
                      backgroundColor: isOwnMessage
                        ? "primary.main"
                        : "grey.100",
                      color: isOwnMessage
                        ? "primary.contrastText"
                        : "text.primary",
                      borderRadius: 2,
                      position: "relative",
                    }}
                  >
                    <Typography variant="body2">{msg.content}</Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        mt: 0.5,
                        opacity: 0.7,
                        fontSize: "0.7rem",
                      }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isOwnMessage && (
                        <span style={{ marginLeft: 4 }}>
                          {msg.sent ? "✓✓" : "⏳"}
                        </span>
                      )}
                    </Typography>
                  </Paper>
                </ListItem>
              );
            })}
          </List>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box
        component="form"
        onSubmit={handleSendMessage}
        sx={{ p: 2, borderTop: 1, borderColor: "divider" }}
      >
        <TextField
          fullWidth
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Digite sua mensagem..."
          disabled={!selectedUser || !isConnected}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="submit"
                  disabled={!message.trim() || !selectedUser || !isConnected}
                  color="primary"
                >
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {!isConnected && (
          <Typography
            variant="caption"
            color="error"
            sx={{ mt: 1, display: "block" }}
          >
            ⚠️ Desconectado - tentando reconectar...
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ChatWindow;
