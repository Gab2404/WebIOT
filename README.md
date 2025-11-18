# 🌐 WebIOT — Plateforme de Gestion & Messagerie IoT  
Projet Web & IoT — Année 2025

WebIOT est une plateforme permettant :  
- la **gestion d’utilisateurs** (inscription, connexion, profil)  
- la **communication en temps réel** avec un objet connecté via **MQTT**  
- une **messagerie moderne** entre le site et l’objet  
- un affichage propre de l’historique (sans afficher les messages envoyés par le site)

Développé en **FastAPI**, **JavaScript**, **HTML/CSS**, et **MQTT (paho-mqtt)**.

---

## ✨ Fonctionnalités

### ✔️ Authentification
- Inscription / Connexion / Déconnexion  
- Sessions sécurisées  
- Storage dans `users.json`

### ✔️ MQTT (temps réel)
- Le site **envoie** sur : `iot/web`  
- L’objet / MQTTX **envoie** sur : `iot/device`  
- Le site **n’affiche que les messages du device**  
- Les messages envoyés par le site sont tagués :

```json
{
  "from": "web",
  "user": "gabriel",
  "msg": "Hello !",
  "timestamp": "2025-11-18 14:12:00"
}
