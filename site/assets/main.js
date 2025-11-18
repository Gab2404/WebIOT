// Petit util pour l'année dans le footer
const yearSpan = document.getElementById("year");
if (yearSpan) yearSpan.textContent = new Date().getFullYear().toString();

function escapeHtml(str) {
  if (typeof str !== "string") str = String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================
// GESTION SESSION / HEADER
// ==========================

let currentUser = null;

async function refreshUser() {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    currentUser = json.user || null;

    const loginLink = document.querySelector('a[href="login.html"]');
    const registerLink = document.querySelector('a[href="register.html"]');

    if (currentUser) {
      if (loginLink) loginLink.style.display = "none";
      if (registerLink) registerLink.style.display = "none";

      const nav = document.querySelector("header nav");
      if (nav) {
        if (!document.getElementById("profile-btn")) {
          const p = document.createElement("a");
          p.id = "profile-btn";
          p.href = "profile.html";
          p.textContent = "Profil";
          p.classList.add("login-btn-header");
          nav.appendChild(p);
        }
        if (!document.getElementById("logout-btn")) {
          const l = document.createElement("a");
          l.id = "logout-btn";
          l.href = "#";
          l.textContent = "Déconnexion";
          l.classList.add("login-btn-header");
          l.addEventListener("click", async (e) => {
            e.preventDefault();
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "index.html";
          });
          nav.appendChild(l);
        }
      }

      // si on est sur index.html : afficher la messagerie
      const chatSection = document.getElementById("chat-section");
      const publicSections = document.querySelectorAll(".public-section");
      if (chatSection && publicSections.length) {
        publicSections.forEach((s) => (s.style.display = "none"));
        chatSection.style.display = "block";
        loadChatMessages();
      }
    } else {
      document.getElementById("profile-btn")?.remove();
      document.getElementById("logout-btn")?.remove();
    }
  } catch (e) {
    console.error("Erreur /api/auth/me:", e);
  }
}

refreshUser();

// ==========================
// ACCUEIL : bouton "Découvrir"
// ==========================
const demoBtn = document.getElementById("demo-btn");
if (demoBtn) {
  demoBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });
}

// ==========================
// FORMULAIRE CONTACT
// ==========================
const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");

if (contactForm && formStatus) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(contactForm).entries());
    console.log("Message de contact (simulation):", data);
    formStatus.textContent = "Message envoyé (simulation) ✅";
    formStatus.classList.add("ok");
    contactForm.reset();
  });
}

// ==========================
// LOGIN
// ==========================
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

if (loginForm && loginStatus) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm).entries());
    loginStatus.textContent = "Connexion...";
    loginStatus.className = "form-status";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || json.detail || json.error) {
        throw new Error(json.detail || json.error || "Erreur inconnue");
      }
      loginStatus.textContent = `Bienvenue, ${json.user.username} 👋`;
      loginStatus.classList.add("ok");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);
    } catch (err) {
      loginStatus.textContent = "❌ " + err.message;
      loginStatus.classList.add("error");
    }
  });
}

// ==========================
// REGISTER
// ==========================
const registerForm = document.getElementById("register-form");
const registerStatus = document.getElementById("register-status");

if (registerForm && registerStatus) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(registerForm);
    const data = Object.fromEntries(f.entries());

    if (data.password !== data.confirm) {
      registerStatus.textContent = "❌ Les mots de passe ne correspondent pas.";
      registerStatus.classList.add("error");
      return;
    }

    registerStatus.textContent = "Création du compte...";
    registerStatus.className = "form-status";

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          email: data.email || null,
          password: data.password,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.detail || json.error) {
        throw new Error(json.detail || json.error || "Erreur inconnue");
      }
      registerStatus.textContent = `✅ Compte créé pour ${json.user.username} !`;
      registerStatus.classList.add("ok");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 800);
    } catch (err) {
      registerStatus.textContent = "❌ " + err.message;
      registerStatus.classList.add("error");
    }
  });
}

// ==========================
// PROFIL
// ==========================
async function loadProfile() {
  const profileInfo = document.getElementById("profile-info");
  if (!profileInfo) return;
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    if (!json.user) {
      profileInfo.innerHTML = "<p>Vous devez être connecté.</p>";
      setTimeout(() => (window.location.href = "login.html"), 1200);
      return;
    }
    const u = json.user;
    profileInfo.innerHTML = `
      <h2>Profil de ${escapeHtml(u.username)}</h2>
      <p><strong>Email :</strong> ${escapeHtml(u.email || "non renseigné")}</p>
      <p><strong>Rôle :</strong> ${escapeHtml(u.role)}</p>
      <button id="logout-profile" class="btn-secondary" style="margin-top:12px;">
        Déconnexion
      </button>
    `;
    document.getElementById("logout-profile").addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "index.html";
    });
  } catch (e) {
    profileInfo.textContent = "Erreur lors du chargement du profil.";
  }
}
loadProfile();

// IoT simple sur la page profil
const btnFetchMqtt = document.getElementById("btn-fetch-mqtt");
const mqttOutput = document.getElementById("mqtt-output");

if (btnFetchMqtt && mqttOutput) {
  btnFetchMqtt.addEventListener("click", async () => {
    mqttOutput.textContent = "Chargement...";
    try {
      const res = await fetch("/api/iot/latest");
      const json = await res.json();
      mqttOutput.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      mqttOutput.textContent = "❌ Erreur lors de la récupération des données IoT.";
    }
  });
}

// ==========================
// CHAT INDEX
// ==========================
const chatBox = document.getElementById("chat-messages");
const chatStatus = document.getElementById("chat-status");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

async function loadChatMessages() {
  if (!chatBox) return;
  try {
    const res = await fetch("/api/chat/messages");
    const json = await res.json();
    const messages = json.messages || [];
    const connected = json.connected;

    if (chatStatus) {
      chatStatus.textContent = connected ? "MQTT : connecté" : "MQTT : hors ligne";
      chatStatus.classList.toggle("ok", connected);
      chatStatus.classList.toggle("error", !connected);
    }

    if (!messages.length) {
      chatBox.innerHTML =
        '<p class="chat-empty">Aucun message pour l’instant. Envoie un premier message.</p>';
      return;
    }

    chatBox.innerHTML = messages
      .map((m) => {
        const from = m.from === "user" ? "Vous" : "Objet";
        const whoClass = m.from === "user" ? "from-user" : "from-device";
        const payload =
          typeof m.payload === "string"
            ? escapeHtml(m.payload)
            : escapeHtml(JSON.stringify(m.payload));
        const ts = escapeHtml(m.timestamp || "");
        return `
          <div class="chat-line ${whoClass}">
            <div class="chat-meta">${from} · ${ts}</div>
            <div class="chat-bubble">${payload}</div>
          </div>
        `;
      })
      .join("");
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (e) {
    console.error("Erreur chat:", e);
  }
}

if (chatForm && chatInput) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (!msg) return;
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const json = await res.json();
      if (!res.ok || json.detail || json.error) {
        throw new Error(json.detail || json.error || "Erreur inconnue");
      }
      chatInput.value = "";
      loadChatMessages();
    } catch (err) {
      console.error("Erreur envoi chat:", err);
    }
  });

  setInterval(() => {
    if (chatBox && chatBox.offsetParent !== null) {
      loadChatMessages();
    }
  }, 5000);
}
