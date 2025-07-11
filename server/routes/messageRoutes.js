const express = require("express");
const MessageController = require("../controllers/messageController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Rotas protegidas por autenticação
router.get(
  "/conversations",
  authMiddleware,
  MessageController.getConversations
);
router.get(
  "/conversations/:conversationId",
  authMiddleware,
  MessageController.getMessages
);
router.get("/search", authMiddleware, MessageController.searchMessages);
router.get("/users/search", authMiddleware, MessageController.searchUsers);
router.patch("/delivered", authMiddleware, MessageController.markAsDelivered);

// Rota POST removida - envio de mensagens é feito via WebSocket

module.exports = router;
