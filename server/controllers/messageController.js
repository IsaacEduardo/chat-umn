const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");

class MessageController {
  // Buscar conversas do usuário
  static async getConversations(req, res) {
    try {
      const userId = req.user._id;
      console.log("Getting conversations for user:", userId);

      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [{ sender: userId }, { receiver: userId }],
          },
        },
        {
          $sort: { timestamp: -1 },
        },
        {
          $group: {
            _id: {
              $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
            },
            lastMessage: { $first: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$receiver", userId] },
                      { $eq: ["$isRead", false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "participant",
          },
        },
        {
          $unwind: "$participant",
        },
        {
          $project: {
            participantId: "$_id",
            participantUsername: "$participant.username",
            participantPublicKey: "$participant.publicKey",
            lastMessage: {
              content: "$lastMessage.content",
              timestamp: "$lastMessage.timestamp",
              isRead: "$lastMessage.isRead",
            },
            unreadCount: 1,
          },
        },
        {
          $sort: { "lastMessage.timestamp": -1 },
        },
      ]);

      console.log("Found conversations:", conversations.length);
      res.json({ conversations });
    } catch (error) {
      console.error("Erro ao buscar conversas:", error);
      res
        .status(500)
        .json({ message: "Erro interno do servidor", error: error.message });
    }
  }

  // Buscar mensagens de uma conversa com paginação
  static async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user._id;

      // Validação aprimorada
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Máximo 100 mensagens

      // Validar formato do conversationId
      if (!/^[a-f\d]{24}_[a-f\d]{24}$/.test(conversationId)) {
        return res.status(400).json({ 
          message: "Formato de conversationId inválido" 
        });
      }

      console.log("Getting messages for conversationId:", conversationId);

      // Extrair IDs dos participantes do conversationId
      const participantIdStrings = conversationId.split("_");

      // Validar se temos exatamente 2 IDs
      if (participantIdStrings.length !== 2) {
        console.error("Invalid conversationId format:", conversationId);
        return res
          .status(400)
          .json({ message: "Formato de conversationId inválido" });
      }

      // Validar que nenhum ID está vazio
      if (participantIdStrings.some((id) => !id || id.trim() === "")) {
        console.error(
          "Empty participant ID in conversationId:",
          conversationId
        );
        return res
          .status(400)
          .json({ message: "ID de usuário vazio no conversationId" });
      }

      // Validar e converter para ObjectId
      const participantIds = [];
      for (const idString of participantIdStrings) {
        if (!mongoose.Types.ObjectId.isValid(idString)) {
          return res
            .status(400)
            .json({ message: "ID de usuário inválido no conversationId" });
        }
        participantIds.push(new mongoose.Types.ObjectId(idString));
      }

      // Verificar se o usuário atual faz parte da conversa
      const userIdObj = new mongoose.Types.ObjectId(userId);
      if (!participantIds.some((id) => id.equals(userIdObj))) {
        return res
          .status(403)
          .json({ message: "Acesso negado a esta conversa" });
      }

      const messages = await Message.find({
        $or: [
          { sender: participantIds[0], receiver: participantIds[1] },
          { sender: participantIds[1], receiver: participantIds[0] },
        ],
      })
        .populate("sender", "username publicKey")
        .populate("receiver", "username publicKey")
        .sort({ timestamp: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .exec();

      // Marcar mensagens como lidas
      await Message.updateMany(
        {
          receiver: userIdObj,
          sender: { $in: participantIds.filter((id) => !id.equals(userIdObj)) },
          isRead: false,
        },
        { isRead: true }
      );

      const formattedMessages = messages.reverse().map((msg) => ({
        id: msg._id,
        senderId: msg.sender._id,
        senderUsername: msg.sender.username,
        senderPublicKey: msg.sender.publicKey,
        content: msg.content,
        timestamp: msg.timestamp,
        isDelivered: msg.isDelivered,
        isRead: msg.isRead,
        messageHash: msg.messageHash,
        signature: msg.signature,
      }));

      res.json({
        messages: formattedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      res.status(500).json({ 
        message: "Erro interno do servidor",
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }

  // Buscar usuários para iniciar conversa
  static async searchUsers(req, res) {
    try {
      const { query } = req.query;
      const userId = req.user._id;

      console.log("Searching users with query:", query, "for user:", userId);

      if (!query || query.length < 2) {
        return res
          .status(400)
          .json({ message: "Query deve ter pelo menos 2 caracteres" });
      }

      const users = await User.find({
        _id: { $ne: userId },
        $or: [
          { username: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      })
        .select("username email publicKey isOnline lastSeen")
        .limit(10);

      const usersWithOnlineStatus = users.map((user) => ({
        ...user.toObject(),
        isOnline: user.isOnline || false,
      }));

      console.log("Found users:", usersWithOnlineStatus.length);
      res.json({ users: usersWithOnlineStatus });
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res
        .status(500)
        .json({ message: "Erro interno do servidor", error: error.message });
    }
  }

  // Buscar dentro das mensagens
  static async searchMessages(req, res) {
    try {
      const { query, conversationId } = req.query;
      const userId = req.user._id;

      if (!query || query.length < 2) {
        return res
          .status(400)
          .json({ message: "Query deve ter pelo menos 2 caracteres" });
      }

      let searchFilter = {
        $or: [{ sender: userId }, { receiver: userId }],
        content: { $regex: query, $options: "i" },
      };

      if (conversationId) {
        const participantIdStrings = conversationId.split("_");

        // Validar formato do conversationId
        if (participantIdStrings.length !== 2) {
          return res
            .status(400)
            .json({ message: "Formato de conversationId inválido" });
        }

        // Validar e converter para ObjectId
        const participantIds = [];
        for (const idString of participantIdStrings) {
          if (!mongoose.Types.ObjectId.isValid(idString)) {
            return res
              .status(400)
              .json({ message: "ID de usuário inválido no conversationId" });
          }
          participantIds.push(new mongoose.Types.ObjectId(idString));
        }

        searchFilter = {
          ...searchFilter,
          $or: [
            { sender: participantIds[0], receiver: participantIds[1] },
            { sender: participantIds[1], receiver: participantIds[0] },
          ],
        };
      }

      const messages = await Message.find(searchFilter)
        .populate("sender", "username")
        .populate("receiver", "username")
        .sort({ timestamp: -1 })
        .limit(20);

      res.json({ messages });
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  }

  // Marcar mensagens como entregues
  static async markAsDelivered(req, res) {
    try {
      const { messageIds } = req.body;
      const userId = req.user._id;

      await Message.updateMany(
        {
          _id: { $in: messageIds },
          receiver: userId,
        },
        { isDelivered: true }
      );

      res.json({ message: "Mensagens marcadas como entregues" });
    } catch (error) {
      console.error("Erro ao marcar mensagens:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  }
}

module.exports = MessageController;
