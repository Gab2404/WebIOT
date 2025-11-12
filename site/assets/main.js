// ==========================
// Particules animées (si présent)
// ==========================
const particlesContainer = document.getElementById("particles");
if (particlesContainer) {
  for (let i = 0; i < 50; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    p.style.left = Math.random() * 100 + "%";
    p.style.top = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 5 + "s";
    p.style.animationDuration = 10 + Math.random() * 10 + "s";
    particlesContainer.appendChild(p);
  }
}

// ==========================
// Bouton “Découvrir” (→ login)
// ==========================
const discoverBtn = document.getElementById("demo-btn");
if (discoverBtn) {
  discoverBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });
}

// ==========================
// Footer: année auto
// ==========================
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// ==========================
// Effet header au scroll
// ==========================
const header = document.querySelector(".site-header");
if (header) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  });
}

// ==========================
// Vérifie si l'utilisateur est connecté + boutons header dynamiques
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

      // Bouton profil
      if (!document.querySelector("#profile-btn")) {
        const profile = document.createElement("a");
        profile.textContent = "Profil";
        profile.href = "profile.html";
        profile.id = "profile-btn";
        profile.classList.add("login-btn-header");
        nav.appendChild(profile);
      }

      // Bouton déconnexion
      if (!document.querySelector("#logout-btn")) {
        const logout = document.createElement("a");
        logout.textContent = "Déconnexion";
        logout.href = "#";
        logout.id = "logout-btn";
        logout.classList.add("login-btn-header");
        logout.addEventListener("click", async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.reload();
        });
        nav.appendChild(logout);
      }
    } else {
      if (loginBtn) loginBtn.style.display = "";
      if (registerBtn) registerBtn.style.display = "";
      document.querySelector("#logout-btn")?.remove();
      document.querySelector("#profile-btn")?.remove();
    }
  } catch (err) {
    console.error("Erreur statut utilisateur:", err);
  }
}
checkUserStatus();

// ==========================
// Formulaire de contact (index)
// ==========================
const contactForm = document.getElementById("contact-form");
const contactStatus = document.getElementById("form-status");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(contactForm).entries());
    console.log("Message envoyé :", data);
    contactStatus.textContent = "Message envoyé avec succès ✅";
    contactStatus.classList.add("show");
    contactForm.reset();
    setTimeout(() => {
      contactStatus.classList.remove("show");
      contactStatus.textContent = "";
    }, 3000);
  });
}

// ==========================
// Connexion (login.html)
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
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Erreur inconnue");

      loginStatus.textContent = `Bienvenue, ${json.user.username} 👋`;
      loginStatus.classList.add("show");
      loginForm.reset();
      setTimeout(() => (window.location.href = "index.html"), 1200);
    } catch (err) {
      loginStatus.textContent = "❌ " + err.message;
      loginStatus.classList.add("show");
    }
  });

  document.getElementById("signup-btn")?.addEventListener("click", () => (window.location.href = "register.html"));
}

// ==========================
// Inscription (register.html)
// ==========================
const registerForm = document.getElementById("register-form");
const registerStatus = document.getElementById("register-status");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(registerForm).entries());
    if (data.password !== data.confirm) {
      registerStatus.textContent = "❌ Les mots de passe ne correspondent pas.";
      registerStatus.classList.add("show");
      return;
    }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Erreur inconnue");
      registerStatus.textContent = `✅ Compte créé pour ${json.user.username} !`;
      registerStatus.classList.add("show");
      registerForm.reset();
      setTimeout(() => (window.location.href = "index.html"), 1200);
    } catch (err) {
      registerStatus.textContent = "❌ " + err.message;
      registerStatus.classList.add("show");
    }
  });

  document.getElementById("login-btn")?.addEventListener("click", () => (window.location.href = "login.html"));
}

// ==========================
// Page profil : affichage infos + bouton MQTT
// ==========================
async function loadProfile() {
  const profileContainer = document.getElementById("profile-info");
  if (!profileContainer) return;

  const res = await fetch("/api/auth/me");
  const json = await res.json();
  if (!json.user) {
    profileContainer.innerHTML = `<p>⚠️ Vous devez être connecté pour voir cette page.</p>`;
    setTimeout(() => (window.location.href = "login.html"), 1500);
    return;
  }

  const user = json.user;
  profileContainer.innerHTML = `
    <h2>👤 Profil de ${user.username}</h2>
    <p><strong>Email :</strong> ${user.email || "non renseigné"}</p>
    <p><strong>Rôle :</strong> ${user.role}</p>
    <button id="logout-from-profile" class="submit-btn" style="margin-top:20px;">Déconnexion</button>
  `;

  document.getElementById("logout-from-profile").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "index.html";
  });
}
loadProfile();

// Bouton pour récupérer la dernière donnée MQTT
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
