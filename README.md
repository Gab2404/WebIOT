# 🌐 WebIOT — Plateforme IoT en Temps Réel

Projet Web & IoT — Année 2024-2025

WebIOT est une plateforme web permettant de gérer des comptes utilisateurs et de communiquer en temps réel avec des objets connectés via MQTT.

## ✨ Fonctionnalités

- **Authentification** : Inscription, connexion, profil utilisateur
- **Messagerie MQTT** : Communication bidirectionnelle en temps réel
- **Visualisation audio** : Spectre FFT depuis un microphone ESP32
- **Sessions sécurisées** : Gestion des utilisateurs avec sessions

## 🛠️ Technologies

- **Backend** : FastAPI (Python)
- **Frontend** : HTML5, CSS3, JavaScript
- **Base de données** : JSON (users.json)
- **Communication** : MQTT (paho-mqtt)

---

## 🚀 Installation

### Prérequis

- Python 3.8+
- pip

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd WebIOT
```

### 2. Créer un environnement virtuel

**Windows :**
```bash
python -m venv .venv
.venv\Scripts\activate
```

**macOS/Linux :**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

---

## ▶️ Lancer le projet

### Démarrer le serveur

```bash
uvicorn main:app --reload --port 3000
```

Le site sera accessible sur : **http://127.0.0.1:3000**

### Arrêter le serveur

Appuyez sur `Ctrl + C` dans le terminal.

---

## 📁 Structure du projet

```
WebIOT/
├── main.py                 # Serveur FastAPI principal
├── requirements.txt        # Dépendances Python
├── data/
│   └── users.json         # Base de données utilisateurs
└── site/
    ├── index.html         # Page d'accueil
    ├── login.html         # Connexion
    ├── register.html      # Inscription
    ├── profile.html       # Profil utilisateur
    ├── audio-spectrum.html # Visualisation audio
    └── assets/
        ├── main.js        # JavaScript principal
        ├── mqtt-chat.js   # Gestion du chat MQTT
        └── css/           # Styles CSS
```

---

## 🔧 Configuration MQTT

Par défaut, le projet utilise le broker public `test.mosquitto.org` sur le topic `iot/demo`.

### Variables d'environnement (optionnel)

```bash
# Windows
set MQTT_HOST=test.mosquitto.org
set MQTT_PORT=1883
set MQTT_SUB_TOPIC=iot/demo
set MQTT_PUB_TOPIC=iot/demo

# macOS/Linux
export MQTT_HOST=test.mosquitto.org
export MQTT_PORT=1883
export MQTT_SUB_TOPIC=iot/demo
export MQTT_PUB_TOPIC=iot/demo
```

---

## 👥 Utilisation

### 1. Créer un compte

1. Accédez à http://127.0.0.1:3000
2. Cliquez sur "S'inscrire"
3. Remplissez le formulaire

### 2. Se connecter

1. Utilisez vos identifiants
2. Vous serez redirigé vers la page d'accueil

### 3. Envoyer des messages MQTT

Une fois connecté, la section "Messagerie IoT" apparaît automatiquement sur la page d'accueil.

### 4. Visualiser le spectre audio

Accédez à la page "Spectre Audio" dans la navigation pour voir les données en temps réel depuis l'ESP32.

---

## 🧪 Test avec MQTTX

Pour tester la messagerie, utilisez [MQTTX](https://mqttx.app/) :

1. Connectez-vous au broker : `test.mosquitto.org:1883`
2. Abonnez-vous au topic : `iot/demo`
3. Envoyez des messages texte bruts
4. Ils apparaîtront dans le chat web

---

## 📝 Compte de test

Un compte existe déjà pour les tests :

- **Username** : `Inoco`
- **Password** : Voir le hash dans `data/users.json`
 