import CryptoJS from "crypto-js";

class CryptoService {
  // Gerar hash de mensagem
  generateMessageHash(message) {
    return CryptoJS.SHA256(message).toString();
  }

  // ✅ Verificação de integridade melhorada
  verifyMessageIntegrity(message, hash, signature, publicKey) {
    try {
      // Verificar hash
      const calculatedHash = this.generateMessageHash(message);
      if (calculatedHash !== hash) {
        console.error("❌ Hash da mensagem não confere");
        return false;
      }

      // ✅ Verificação básica de assinatura (implementar RSA completo se necessário)
      if (!signature || !publicKey) {
        console.warn("⚠️ Assinatura ou chave pública ausente");
        return false;
      }

      // ✅ Por enquanto, aceitar se hash está correto
      // TODO: Implementar verificação RSA completa
      return true;
    } catch (error) {
      console.error("Erro na verificação de integridade:", error);
      return false;
    }
  }

  // ✅ Validar formato de dados
  validateMessageData(messageData) {
    const required = [
      "messageId",
      "senderId",
      "content",
      "timestamp",
      "messageHash",
      "signature",
    ];
    return required.every(
      (field) =>
        messageData.hasOwnProperty(field) && messageData[field] !== null
    );
  }

  // Criptografar dados localmente
  encryptLocal(data, key) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
  }

  // Descriptografar dados localmente
  decryptLocal(encryptedData, key) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, key);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      console.error("Erro na descriptografia:", error);
      return null;
    }
  }
}

export const cryptoService = new CryptoService();
