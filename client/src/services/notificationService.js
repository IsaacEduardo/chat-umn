class NotificationService {
  constructor() {
    this.permission = "default";
    this.init();
  }

  async init() {
    if ("Notification" in window) {
      this.permission = await Notification.requestPermission();
    }
  }

  showNotification(title, options = {}) {
    if (this.permission === "granted" && document.hidden) {
      const notification = new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
  }

  showMessageNotification(senderName, message) {
    return this.showNotification(`Nova mensagem de ${senderName}`, {
      body: message,
      tag: "new-message",
    });
  }

  playNotificationSound() {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.3;
      audio.play().catch((e) => console.log("Erro ao reproduzir som:", e));
    } catch (error) {
      console.log("Som de notificação não disponível");
    }
  }
}

export const notificationService = new NotificationService();
