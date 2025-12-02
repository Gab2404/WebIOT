// ==========================
// Utilitaires de base
// ==========================
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

const discoverBtn = document.getElementById("demo-btn");
if (discoverBtn) {
  discoverBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });
}

// ==========================
// Gestion de la session (header)
// ==========================
async function checkUserStatus() {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    const user = json.user;

    const loginBtn = document.querySelector('a[href="login.html"]');
    const registerBtn = document.querySelector('a[href="register.html"]');

    if (user) {
      if (loginBtn) loginBtn.style.display = "none";
      if (registerBtn) registerBtn.style.display = "none";

      const nav = document.querySelector("nav");
      if (!nav) return;

      if (!document.querySelector("#profile-btn")) {
        const profile = document.createElement("a");
        profile.textContent = "Profil";
        profile.href = "profile.html";
        profile.id = "profile-btn";
        profile.classList.add("login-btn-header");
        nav.appendChild(profile);
      }

      if (!document.querySelector("#logout-btn")) {
        const logout = document.createElement("a");
        logout.textContent = "Déconnexion";
        logout.href = "#";
        logout.id = "logout-btn";
        logout.classList.add("login-btn-header");
        logout.addEventListener("click", async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "index.html";
        });
        nav.appendChild(logout);
      }
    } else {
      if (loginBtn) loginBtn.style.display = "";
      if (registerBtn) registerBtn.style.display = "";
      document.querySelector("#logout-btn")?.remove();
      document.querySelector("#profile-btn")?.remove();
    }
  } catch (e) {
    console.error("Erreur statut utilisateur:", e);
  }
}
checkUserStatus();

// ==========================
// Formulaire contact
// ==========================
const contactForm = document.getElementById("contact-form");
const contactStatus = document.getElementById("form-status");

if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(contactForm).entries());
    console.log("Message contact :", data);
    contactStatus.textContent = "Message envoyé (simulé) ✅";
    contactStatus.style.color = "#8ef58e";
    contactForm.reset();
  });
}

// ==========================
// Connexion
// ==========================
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm).entries());
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || json.detail || json.error) {
        throw new Error(json.detail || json.error || "Erreur inconnue.");
      }
      loginStatus.textContent = `Bienvenue, ${json.user.username} 👋`;
      loginStatus.style.color = "#8ef58e";
      loginForm.reset();
      setTimeout(() => (window.location.href = "index.html"), 1000);
    } catch (err) {
      loginStatus.textContent = "❌ " + err.message;
      loginStatus.style.color = "#ff7b7b";
    }
  });

  document.getElementById("signup-btn")?.addEventListener("click", () => {
    window.location.href = "register.html";
  });
}

// ==========================
// Inscription
// ==========================
const registerForm = document.getElementById("register-form");
const registerStatus = document.getElementById("register-status");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(registerForm);
    const data = Object.fromEntries(form.entries());

    if (data.password !== data.confirm) {
      registerStatus.textContent = "❌ Les mots de passe ne correspondent pas.";
      registerStatus.style.color = "#ff7b7b";
      return;
    }

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
        throw new Error(json.detail || json.error || "Erreur inconnue.");
      }
      registerStatus.textContent = `✅ Compte créé pour ${json.user.username}!`;
      registerStatus.style.color = "#8ef58e";
      registerForm.reset();
      setTimeout(() => (window.location.href = "index.html"), 1000);
    } catch (err) {
      registerStatus.textContent = "❌ " + err.message;
      registerStatus.style.color = "#ff7b7b";
    }
  });

  document.getElementById("login-btn")?.addEventListener("click", () => {
    window.location.href = "login.html";
  });
}

// ==========================
// Profil
// ==========================
async function loadProfile() {
  const profileContainer = document.getElementById("profile-info");
  if (!profileContainer) return;

  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    if (!json.user) {
      profileContainer.innerHTML =
        "<p>⚠️ Vous devez être connecté pour voir cette page.</p>";
      setTimeout(() => (window.location.href = "login.html"), 1500);
      return;
    }

    const user = json.user;
    profileContainer.innerHTML = `
      <h2>👤 Profil de ${user.username}</h2>
      <p><strong>Email :</strong> ${user.email || "non renseigné"}</p>
      <p><strong>Rôle :</strong> ${user.role}</p>
      <button id="logout-from-profile" class="submit-btn" style="margin-top:16px;">
        Déconnexion
      </button>
    `;

    document
      .getElementById("logout-from-profile")
      .addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "index.html";
      });
  } catch (e) {
    profileContainer.innerHTML =
      "<p>Erreur lors du chargement du profil.</p>";
  }
}
loadProfile();

// ==========================
// Stub IoT
// ==========================
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
      mqttOutput.textContent = "❌ Impossible de récupérer les données IoT";
    }
  });
}