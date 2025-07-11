const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Nome de usuário é obrigatório"],
      unique: true,
      trim: true,
      minlength: [3, "Nome de usuário deve ter pelo menos 3 caracteres"],
      maxlength: [30, "Nome de usuário deve ter no máximo 30 caracteres"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Nome de usuário deve conter apenas letras, números e underscore",
      ],
      // ✅ VALIDAÇÃO: Converter para lowercase para evitar duplicatas
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "Email é obrigatório"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [100, "Email muito longo"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email inválido"],
    },
    password: {
      type: String,
      required: [true, "Senha é obrigatória"],
      minlength: [8, "Senha deve ter pelo menos 8 caracteres"],
      maxlength: [128, "Senha muito longa"],
    },
    publicKey: {
      type: String,
      required: [true, "Chave pública é obrigatória"],
    },
    privateKey: {
      type: String,
      required: [true, "Chave privada é obrigatória"],
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ ÍNDICES: Melhorar performance e garantir unicidade
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

// ✅ MIDDLEWARE: Hash da senha com tratamento de erro
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// ✅ MÉTODO: Comparação de senha com tratamento de erro
userSchema.methods.comparePassword = async function (password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    throw new Error("Erro ao verificar senha");
  }
};

module.exports = mongoose.model("User", userSchema);
