import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossiers/fichiers
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PUBLIC_DIR = path.join(__dirname, 'site');

// Prépare le stockage
fs.ensureDirSync(DATA_DIR);
if (!fs.pathExistsSync(USERS_FILE)) {
  fs.writeJsonSync(USERS_FILE, []);
}
function readUsers() { return fs.readJsonSync(USERS_FILE); }
function writeUsers(users) { fs.writeJsonSync(USERS_FILE, users, { spaces: 2 }); }

// App
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 jour
}));

// --------- Middleware simple d'auth ----------
function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Non autorisé' });
}

// ===== API AUTH =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Champs requis manquants.' });
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères).' });

    const users = readUsers();
    if (users.some(u => u.username.toLowerCase() === String(username).toLowerCase())) {
      return res.status(409).json({ error: 'Nom d’utilisateur déjà pris.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      username,
      email: email || null,
      passwordHash,
      role: 'user'
    };
    users.push(user);
    writeUsers(users);

    // Inclure l'email dans la session
    req.session.user = { id: user.id, username: user.username, role: user.role, email: user.email };
    res.json({ success: true, user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Champs requis manquants.' });

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
    if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides.' });

    req.session.user = { id: user.id, username: user.username, role: user.role, email: user.email || null };
    res.json({ success: true, user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Impossible de se déconnecter.' });
    res.json({ success: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

// ===== MQTT =====
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MQTT_SUB_TOPIC = process.env.MQTT_SUB_TOPIC || 'iot/demo'; // adapte le topic
const MQTT_PUB_TOPIC = process.env.MQTT_PUB_TOPIC || 'iot/commands';

let mqttClient = null;
let mqttConnected = false;
let lastMessage = null; // { topic, payload, raw, timestamp }

function startMqtt() {
  mqttClient = mqtt.connect(MQTT_URL, {
    // options selon besoin: username, password, clientId...
  });

  mqttClient.on('connect', () => {
    mqttConnected = true;
    console.log('[mqtt] Connected to', MQTT_URL);
    mqttClient.subscribe(MQTT_SUB_TOPIC, (err) => {
      if (err) console.error('[mqtt] subscribe error:', err.message);
      else console.log('[mqtt] Subscribed to', MQTT_SUB_TOPIC);
    });
  });

  mqttClient.on('reconnect', () => console.log('[mqtt] reconnecting...'));
  mqttClient.on('close', () => { mqttConnected = false; console.log('[mqtt] connection closed'); });
  mqttClient.on('error', (err) => console.error('[mqtt] error:', err.message));

  mqttClient.on('message', (topic, message) => {
    const raw = message.toString();
    let payload = raw;
    try { payload = JSON.parse(raw); } catch { /* pas JSON, on garde raw */ }
    lastMessage = { topic, payload, raw, timestamp: new Date().toISOString() };
    // Tu peux aussi garder un historique si besoin
  });
}
startMqtt();

// GET dernière donnée reçue (protégé)
app.get('/api/iot/latest', requireAuth, (req, res) => {
  res.json({
    connected: mqttConnected,
    subTopic: MQTT_SUB_TOPIC,
    last: lastMessage
  });
});

// (Optionnel) publier une commande
app.post('/api/iot/publish', requireAuth, (req, res) => {
  const { topic, message } = req.body || {};
  const t = topic || MQTT_PUB_TOPIC;
  if (!mqttClient || !mqttConnected) return res.status(503).json({ error: 'MQTT non connecté' });
  const payload = typeof message === 'string' ? message : JSON.stringify(message || {});
  mqttClient.publish(t, payload, { qos: 0 }, (err) => {
    if (err) return res.status(500).json({ error: 'Publication échouée' });
    res.json({ success: true, topic: t, published: payload });
  });
});

// ===== Statique : sert /site et index.html à la racine =====
app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});
app.get('/login.html', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'register.html')));
app.get('/profile.html', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'profile.html')));

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] serving static from: ${PUBLIC_DIR}`);
  console.log(`[mqtt] URL=${MQTT_URL} | SUB=${MQTT_SUB_TOPIC} | PUB=${MQTT_PUB_TOPIC}`);
});
