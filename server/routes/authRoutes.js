const express = require("express");
const { body } = require("express-validator");
const AuthController = require("../controllers/authController");
const { loginLimiter } = require("../middleware/bruteForceMiddleware");

const router = express.Router();

// ✅ VALIDAÇÕES MELHORADAS: Mais específicas e claras
const registerValidation = [
  body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Nome de usuário deve ter entre 3 e 30 caracteres")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(
      "Nome de usuário deve conter apenas letras, números e underscore"
    )
    .custom((value) => {
      // ✅ VALIDAÇÃO: Não permitir apenas números
      if (/^\d+$/.test(value)) {
        throw new Error("Nome de usuário não pode conter apenas números");
      }
      return true;
    })
    .trim()
    .escape(),
  body("email")
    .isEmail()
    .withMessage("Email inválido")
    .isLength({ max: 100 })
    .withMessage("Email muito longo")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    })
    .escape(),
  /*
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Senha deve ter entre 8 e 128 caracteres")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).*$/)
    .withMessage(
      "Senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial (@$!%*?&)"
    )
    .custom((value) => {
      // ✅ VALIDAÇÃO: Verificar caracteres proibidos
      if (/[<>"'&]/.test(value)) {
        throw new Error("Senha contém caracteres não permitidos");
      }
      return true;
    }),
    */
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Senha deve ter entre 8 e 128 caracteres")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.:]).*$/)
    .withMessage(
      "Senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial (@$!%*?&.:)"
    )
    .custom((value) => {
      // ✅ VALIDAÇÃO: Verificar caracteres proibidos
      if (/[<>"']/.test(value)) {
        throw new Error("Senha contém caracteres não permitidos");
      }
      return true;
    }),
];

// ✅ VALIDAÇÕES: Login mantidas
const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Email inválido")
    .normalizeEmail()
    .escape(),
  body("password").notEmpty().withMessage("Senha é obrigatória").escape(),
];

// ✅ ROTAS: Com middleware de validação melhorado
router.post("/register", registerValidation, AuthController.register);
router.post("/login", loginLimiter, loginValidation, AuthController.login);

module.exports = router;
