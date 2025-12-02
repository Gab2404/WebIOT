// ==========================
// Visualisation du spectre audio ESP32
// ==========================

const canvas = document.getElementById("spectrum-canvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const btnStart = document.getElementById("btn-start-spectrum");
const btnStop = document.getElementById("btn-stop-spectrum");
const statusDiv = document.getElementById("connection-status");
const topicSpan = document.getElementById("mqtt-topic");
const lastUpdateSpan = document.getElementById("last-update");
const dominantFreqSpan = document.getElementById("dominant-freq");
const avgLevelSpan = document.getElementById("avg-level");

let animationId = null;
let isRunning = false;
let spectrumData = [];
let lastTimestamp = null;

// Configuration du canvas
if (canvas && ctx) {
  canvas.width = 800;
  canvas.height = 400;
}

// Fonction pour récupérer les données MQTT
async function fetchAudioData() {
  try {
    const res = await fetch("/api/iot/latest");
    if (!res.ok) throw new Error("Erreur réseau");
    
    const json = await res.json();
    
    // Mise à jour du statut de connexion
    if (json.connected) {
      statusDiv.innerHTML = '<span style="color: #8ef58e;">🟢 Connecté</span>';
      topicSpan.textContent = json.subTopic || "-";
    } else {
      statusDiv.innerHTML = '<span style="color: #ff7b7b;">🔴 Déconnecté</span>';
    }
    
    // Si on a des données audio
    if (json.last && json.last.payload) {
      const payload = json.last.payload;
      
      // Mise à jour de l'horodatage
      lastTimestamp = json.last.timestamp;
      lastUpdateSpan.textContent = new Date(lastTimestamp).toLocaleString('fr-FR');
      
      // Extraction des données de spectre
      // Format attendu: { spectrum: [val1, val2, ...], frequency: [...], ... }
      // ou simplement un tableau de valeurs
      if (Array.isArray(payload.spectrum)) {
        spectrumData = payload.spectrum;
      } else if (Array.isArray(payload)) {
        spectrumData = payload;
      } else if (typeof payload === 'object' && payload.data) {
        spectrumData = Array.isArray(payload.data) ? payload.data : [];
      }
      
      // Calcul de statistiques
      if (spectrumData.length > 0) {
        const maxVal = Math.max(...spectrumData);
        const maxIdx = spectrumData.indexOf(maxVal);
        const avgVal = spectrumData.reduce((a, b) => a + b, 0) / spectrumData.length;
        
        // Fréquence dominante (estimation simple)
        const freqPerBin = 22050 / spectrumData.length; // Nyquist pour 44.1kHz
        dominantFreqSpan.textContent = `${Math.round(maxIdx * freqPerBin)} Hz`;
        avgLevelSpan.textContent = avgVal.toFixed(2);
      }
    }
    
    return spectrumData;
  } catch (err) {
    console.error("Erreur lors de la récupération des données:", err);
    statusDiv.innerHTML = '<span style="color: #ff7b7b;">⚠️ Erreur de connexion</span>';
    return [];
  }
}

// Fonction de dessin du spectre
function drawSpectrum(data) {
  if (!ctx || !canvas) return;
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Effacer le canvas
  ctx.fillStyle = "rgba(10, 20, 40, 1)";
  ctx.fillRect(0, 0, width, height);
  
  if (!data || data.length === 0) {
    // Message si pas de données
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("En attente de données audio...", width / 2, height / 2);
    return;
  }
  
  // Dessiner le spectre
  const barWidth = width / data.length;
  const maxValue = Math.max(...data, 1); // Éviter division par 0
  
  data.forEach((value, i) => {
    const barHeight = (value / maxValue) * height * 0.9;
    const x = i * barWidth;
    const y = height - barHeight;
    
    // Gradient de couleur basé sur la fréquence
    const hue = (i / data.length) * 280; // 0 (rouge) à 280 (bleu/violet)
    const saturation = 70 + (value / maxValue) * 30;
    const lightness = 40 + (value / maxValue) * 30;
    
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fillRect(x, y, barWidth - 1, barHeight);
    
    // Effet de lueur pour les barres hautes
    if (value / maxValue > 0.7) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
      ctx.shadowBlur = 0;
    }
  });
  
  // Grille de fond
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  // Axes et labels
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = "12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("0 Hz", 5, height - 5);
  ctx.textAlign = "right";
  ctx.fillText("~22 kHz", width - 5, height - 5);
}

// Boucle d'animation
async function animate() {
  if (!isRunning) return;
  
  const data = await fetchAudioData();
  drawSpectrum(data);
  
  // Rafraîchir toutes les 100ms (10 fps)
  setTimeout(() => {
    animationId = requestAnimationFrame(animate);
  }, 100);
}

// Démarrer la visualisation
if (btnStart) {
  btnStart.addEventListener("click", () => {
    if (!isRunning) {
      isRunning = true;
      btnStart.disabled = true;
      btnStop.disabled = false;
      animate();
    }
  });
}

// Arrêter la visualisation
if (btnStop) {
  btnStop.addEventListener("click", () => {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    btnStart.disabled = false;
    btnStop.disabled = true;
  });
}

// Nettoyage à la fermeture de la page
window.addEventListener("beforeunload", () => {
  isRunning = false;
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});