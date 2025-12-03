// ==========================
// Messagerie MQTT IoT
// ==========================

const chatSection = document.getElementById("mqtt-chat-section");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const mqttStatus = document.getElementById("mqtt-status");

let isAuthenticated = false;
let pollingInterval = null;

// Vérifier si l'utilisateur est connecté
async function checkAuthAndShowChat() {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    
    if (json.user) {
      isAuthenticated = true;
      chatSection.style.display = "block";
      loadMessages();
      startPolling();
    } else {
      isAuthenticated = false;
      chatSection.style.display = "none";
      stopPolling();
    }
  } catch (e) {
    console.error("Erreur vérification auth:", e);
    isAuthenticated = false;
    chatSection.style.display = "none";
  }
}

// Filtrer les messages de commande MODE
function isCommandMessage(message) {
  if (typeof message === 'string') {
    return message.startsWith('MODE:');
  }
  if (typeof message === 'object' && message !== null) {
    const msg = message.msg || message.message || message.payload || '';
    return String(msg).startsWith('MODE:');
  }
  return false;
}

// Charger les messages depuis le backend
async function loadMessages() {
  if (!isAuthenticated) return;
  
  try {
    const res = await fetch("/api/chat/messages");
    if (!res.ok) throw new Error("Erreur réseau");
    
    const json = await res.json();
    
    // Mettre à jour le statut MQTT
    if (json.connected) {
      mqttStatus.innerHTML = '<span style="color: #8ef58e;">🟢 Connecté</span>';
    } else {
      mqttStatus.innerHTML = '<span style="color: #ff7b7b;">🔴 Déconnecté</span>';
    }
    
    // Filtrer les messages pour retirer les commandes MODE
    if (json.messages && json.messages.length > 0) {
      const filteredMessages = json.messages.filter(msg => {
        // Vérifier si c'est un message de commande MODE
        if (msg.raw && msg.raw.startsWith('MODE:')) {
          return false;
        }
        if (msg.payload) {
          if (typeof msg.payload === 'string' && msg.payload.startsWith('MODE:')) {
            return false;
          }
          if (typeof msg.payload === 'object' && msg.payload.msg) {
            if (String(msg.payload.msg).startsWith('MODE:')) {
              return false;
            }
          }
        }
        return true;
      });
      
      displayMessages(filteredMessages);
    } else {
      chatMessages.innerHTML = '<p style="opacity: 0.6; text-align: center;">Aucun message pour le moment</p>';
    }
  } catch (e) {
    console.error("Erreur chargement messages:", e);
    mqttStatus.innerHTML = '<span style="color: #ff7b7b;">⚠️ Erreur de connexion</span>';
  }
}

// Afficher les messages dans le chat
function displayMessages(messages) {
  chatMessages.innerHTML = "";
  
  messages.forEach(msg => {
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message";
    
    let content = "";
    let username = "Système";
    let timestamp = msg.timestamp || "";
    
    // Parser le payload
    if (typeof msg.payload === "object" && msg.payload !== null) {
      // Message venant du web (envoyé par un utilisateur du site)
      if (msg.payload.from === "web") {
        username = msg.payload.user || "Utilisateur";
        content = msg.payload.msg || JSON.stringify(msg.payload);
        messageDiv.classList.add("chat-message-web");
      } 
      // Message venant d'un device avec champ "from"
      else if (msg.payload.from) {
        username = msg.payload.from;
        content = msg.payload.msg || msg.payload.message || JSON.stringify(msg.payload);
        messageDiv.classList.add("chat-message-device");
      }
      // Message JSON sans champ "from" (ex: capteur)
      else {
        username = "ESP32";
        content = JSON.stringify(msg.payload);
        messageDiv.classList.add("chat-message-device");
      }
    } 
    // Message texte brut (MQTTX ou autre)
    else {
      content = msg.raw || String(msg.payload);
      username = "MQTTX";
      messageDiv.classList.add("chat-message-device");
    }
    
    messageDiv.innerHTML = `
      <div class="chat-message-header">
        <strong>${escapeHtml(username)}</strong>
        <span class="chat-message-time">${timestamp}</span>
      </div>
      <div class="chat-message-content">${escapeHtml(content)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
  });
  
  // Scroll automatique vers le bas
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Échapper le HTML pour éviter les injections
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Envoyer un message
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.detail || "Erreur d'envoi");
      }
      
      chatInput.value = "";
      
      // Recharger les messages après un court délai
      setTimeout(loadMessages, 500);
    } catch (err) {
      alert("❌ " + err.message);
    }
  });
}

// Polling pour mettre à jour les messages automatiquement
function startPolling() {
  if (pollingInterval) return;
  
  // Rafraîchir toutes les 2 secondes
  pollingInterval = setInterval(() => {
    loadMessages();
  }, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Initialiser au chargement de la page
checkAuthAndShowChat();

// Nettoyer à la fermeture
window.addEventListener("beforeunload", () => {
  stopPolling();
});