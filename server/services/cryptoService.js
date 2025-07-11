const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const CryptoJS = require('crypto-js');

class CryptoService {
  // Gerar par de chaves RSA
  static generateKeyPair() {
    const key = new NodeRSA({ b: 2048 });
    return {
      publicKey: key.exportKey('public'),
      privateKey: key.exportKey('private')
    };
  }

  // Criptografar mensagem com AES
  static encryptMessage(message, secretKey) {
    return CryptoJS.AES.encrypt(message, secretKey).toString();
  }

  // Descriptografar mensagem com AES
  static decryptMessage(encryptedMessage, secretKey) {
    const bytes = CryptoJS.AES.decrypt(encryptedMessage, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // Assinar mensagem com RSA
  static signMessage(message, privateKey) {
    const key = new NodeRSA(privateKey);
    return key.sign(message, 'base64');
  }

  // Verificar assinatura
  static verifySignature(message, signature, publicKey) {
    try {
      const key = new NodeRSA(publicKey);
      return key.verify(message, signature, 'utf8', 'base64');
    } catch (error) {
      return false;
    }
  }

  // Gerar hash da mensagem
  static generateMessageHash(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
  }

  // Gerar chave secreta para sessão
  static generateSessionKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = CryptoService;