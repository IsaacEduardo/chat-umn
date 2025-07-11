import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
  CircularProgress,
  Badge,
} from "@mui/material";
import {
  Search as SearchIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { useChatStore } from "@store/chatStore";
import { useAuthStore } from "@store/authStore";

const UserSearch = ({ open, onClose, onUserSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { searchUsers } = useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchUsers(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error("Erro na busca:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, searchUsers]);

  const handleUserSelect = (selectedUser) => {
    onUserSelect(selectedUser);
    onClose();
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SearchIcon />
          <Typography variant="h6">Buscar Usuários</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="Digite o nome ou email do usuário..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
            ),
          }}
        />

        {isSearching && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {searchResults.length > 0 && (
          <List>
            {searchResults.map((searchUser) => (
              <ListItem key={searchUser._id} disablePadding>
                <ListItemButton onClick={() => handleUserSelect(searchUser)}>
                  <ListItemAvatar>
                    <Badge
                      color={searchUser.isOnline ? "success" : "default"}
                      variant="dot"
                      overlap="circular"
                    >
                      <Avatar>
                        {searchUser.username.charAt(0).toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>
                  <ListItemText
                    primary={searchUser.username}
                    secondary={searchUser.email}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {searchQuery.length >= 2 &&
          !isSearching &&
          searchResults.length === 0 && (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <PersonIcon
                sx={{ fontSize: 48, color: "text.disabled", mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Nenhum usuário encontrado
              </Typography>
            </Box>
          )}
      </DialogContent>
    </Dialog>
  );
};

export default UserSearch;
