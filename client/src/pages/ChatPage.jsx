import React, { useState, useEffect } from "react";
import {
  Container,
  Box,
  Paper,
  Typography,
  Button,
  Badge,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  IconButton,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Logout as LogoutIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@store/authStore";
import { useChatStore } from "@store/chatStore";
import ChatWindow from "@components/ui/ChatWindow";
import UserSearch from "@components/ui/UserSearch";
import { notificationService } from "@services/notificationService";

const ChatPage = () => {
  const { user, logout } = useAuthStore();
  const {
    isConnected,
    onlineUsers,
    selectedUser,
    setSelectedUser,
    conversations,
    loadConversations,
    unreadCounts,
  } = useChatStore();

  const [showUserSearch, setShowUserSearch] = useState(false);
  const [conversationFilter, setConversationFilter] = useState("");

  useEffect(() => {
    // Carregar conversas ao montar o componente
    loadConversations();
  }, [loadConversations]);

  /*
  const handleUserSelect = (selectedUser) => {
    // Não permitir selecionar o próprio usuário
    if (selectedUser.id === user?.id || selectedUser._id === user?.id) return;

    const userToSelect = {
      id: selectedUser._id || selectedUser.id,
      username: selectedUser.username,
      publicKey: selectedUser.publicKey,
    };

    setSelectedUser(userToSelect);
  };
  */

  const handleUserSelect = (selectedUser) => {
    // Não permitir selecionar o próprio usuário
    if (selectedUser.id === user?.id || selectedUser._id === user?.id) return;

    // ✅ CORREÇÃO: Normalização robusta de IDs
    const userToSelect = {
      id: selectedUser._id || selectedUser.id,
      username: selectedUser.username,
      publicKey: selectedUser.publicKey,
    };

    // ✅ VALIDAÇÃO: Garantir que o ID não é undefined
    if (!userToSelect.id || userToSelect.id === "undefined") {
      console.error("❌ Erro: ID do usuário selecionado é inválido:", {
        selectedUser,
        userToSelect,
        currentUser: user,
      });
      return;
    }

    console.log("✅ Usuário selecionado com sucesso:", userToSelect);
    setSelectedUser(userToSelect);
  };

  const handleLogout = () => {
    logout();
  };

  // Filtrar usuários online (excluir o próprio usuário)
  const availableUsers = onlineUsers.filter((u) => u.id !== user?.id);

  // Filtrar conversas
  const filteredConversations = conversations.filter((conv) =>
    conv.participantUsername
      .toLowerCase()
      .includes(conversationFilter.toLowerCase())
  );

  return (
    <Container maxWidth="xl" sx={{ height: "100vh", py: 2 }}>
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h5" component="h1" sx={{ fontWeight: "bold" }}>
              🚀 Chat UMN
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Badge
                color={isConnected ? "success" : "error"}
                variant="dot"
                sx={{ mr: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {isConnected ? "Conectado" : "Desconectado"}
                </Typography>
              </Badge>

              <Typography variant="body2" sx={{ fontWeight: "medium" }}>
                Olá, {user?.username}!
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                color="error"
              >
                Sair
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Main Chat Area */}
        <Box sx={{ flex: 1, display: "flex", gap: 2, minHeight: 0 }}>
          {/* Sidebar - Conversas e Usuários */}
          <Paper
            elevation={1}
            sx={{ width: 320, display: "flex", flexDirection: "column" }}
          >
            {/* Header da Sidebar */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">💬 Conversas</Typography>
                <IconButton
                  size="small"
                  onClick={() => setShowUserSearch(true)}
                  color="primary"
                >
                  <AddIcon />
                </IconButton>
              </Box>

              <TextField
                size="small"
                fullWidth
                placeholder="Buscar conversas..."
                value={conversationFilter}
                onChange={(e) => setConversationFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Lista de Conversas */}
            <Box sx={{ flex: 1, overflow: "auto" }}>
              {filteredConversations.length === 0 ? (
                <Box sx={{ p: 3, textAlign: "center" }}>
                  <PersonIcon
                    sx={{ fontSize: 48, color: "text.disabled", mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma conversa encontrada
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Clique no + para iniciar uma nova conversa
                  </Typography>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {filteredConversations.map((conversation, index) => {
                    const isOnline = availableUsers.some(
                      (u) => u.id === conversation.participantId
                    );
                    // ✅ CORREÇÃO: Usar participantId consistentemente
                    const unreadCount =
                      unreadCounts.get(conversation.participantId) || 0;

                    return (
                      <React.Fragment key={conversation.participantId}>
                        <ListItem disablePadding>
                          <ListItemButton
                            selected={
                              selectedUser?.id === conversation.participantId
                            }
                            onClick={() =>
                              handleUserSelect({
                                _id: conversation.participantId,
                                username: conversation.participantUsername,
                                publicKey: conversation.participantPublicKey,
                              })
                            }
                            sx={{
                              py: 1.5,
                              "&.Mui-selected": {
                                backgroundColor: "primary.light",
                                "&:hover": {
                                  backgroundColor: "primary.light",
                                },
                              },
                            }}
                          >
                            <ListItemAvatar>
                              <Badge
                                color={isOnline ? "success" : "default"}
                                variant="dot"
                                overlap="circular"
                                anchorOrigin={{
                                  vertical: "bottom",
                                  horizontal: "right",
                                }}
                              >
                                <Avatar sx={{ bgcolor: "primary.main" }}>
                                  {conversation.participantUsername
                                    .charAt(0)
                                    .toUpperCase()}
                                </Avatar>
                              </Badge>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box
                                  sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <Typography
                                    variant="body1"
                                    sx={{ fontWeight: "medium" }}
                                  >
                                    {conversation.participantUsername}
                                  </Typography>
                                  {unreadCount > 0 && (
                                    <Badge
                                      badgeContent={unreadCount}
                                      color="error"
                                    />
                                  )}
                                </Box>
                              }
                              secondary={
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  noWrap
                                >
                                  {conversation.lastMessage?.content ||
                                    "Sem mensagens"}
                                </Typography>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                        {index < filteredConversations.length - 1 && (
                          <Divider />
                        )}
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Box>

            {/* Usuários Online */}
            {availableUsers.length > 0 && (
              <>
                <Divider />
                <Box sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    👥 Online Agora ({availableUsers.length})
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {availableUsers.slice(0, 6).map((onlineUser) => (
                      <Badge
                        key={`online-user-${onlineUser.id}`} // Adicionar key única
                        color="success"
                        variant="dot"
                        overlap="circular"
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: "0.875rem",
                            cursor: "pointer",
                          }}
                          onClick={() => handleUserSelect(onlineUser)}
                        >
                          {onlineUser.username.charAt(0).toUpperCase()}
                        </Avatar>
                      </Badge>
                    ))}
                  </Box>
                </Box>
              </>
            )}
          </Paper>

          {/* Chat Messages Area */}
          <Paper
            elevation={1}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <ChatWindow selectedUser={selectedUser} />
          </Paper>
        </Box>
      </Box>

      {/* Dialog de Busca de Usuários */}
      <UserSearch
        open={showUserSearch}
        onClose={() => setShowUserSearch(false)}
        onUserSelect={handleUserSelect}
      />
    </Container>
  );
};

export default ChatPage;
