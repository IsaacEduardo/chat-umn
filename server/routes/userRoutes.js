const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// Buscar chave pública de um usuário
router.get("/:userId/publickey", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("publicKey username");
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.json({
      publicKey: user.publicKey,
      username: user.username,
    });
  } catch (error) {
    console.error("Erro ao buscar chave pública:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;
