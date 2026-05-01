const numberEl = document.getElementById("the-number");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const tachometerBar = document.getElementById("tachometer-bar");

let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
});

let currentNum = 1;
let energy = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let lastTime = performance.now();

let posX = w / 2;
let posY = h / 2;
let velX = 0;
let velY = 0;

// Stats & Game Data
let timeSpawned = performance.now();
let reactionTimes = [];
let floatingTexts = [];
let particles = [];
let isExploding = false;

// Audio context
let audioCtx, oscillator, gainNode;
let engineOsc, engineGain;
let isAudioInit = false;
const waveforms = ["sine", "square", "sawtooth", "triangle"];

function initAudio() {
  if (isAudioInit) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Melody Synth
  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();
  oscillator.type = waveforms[currentNum % 4];
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.frequency.value = 100;
  gainNode.gain.value = 0;
  oscillator.start();

  // Engine Synth (Heartbeat / Motor)
  engineOsc = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  engineOsc.type = 'sawtooth';
  engineOsc.connect(engineGain);
  engineGain.connect(audioCtx.destination);
  engineOsc.frequency.value = 30; // low sub frequency
  engineGain.gain.value = 0;
  engineOsc.start();

  isAudioInit = true;
}

function playMiss() {
  if (!isAudioInit) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.connect(g);
  g.connect(audioCtx.destination);
  
  // Som grave e descendente de erro
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
  
  g.gain.setValueAtTime(0.5, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

function playAlarm() {
  if (!isAudioInit) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.connect(g);
  g.connect(audioCtx.destination);
  
  // Som agudo de acerto
  osc.frequency.setValueAtTime(1500 + (currentNum * 150), audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.2);
  
  g.gain.setValueAtTime(0.6, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

document.addEventListener("mousemove", (e) => {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  const now = performance.now();
  const dt = Math.max(1, now - lastTime);
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  const speed = Math.sqrt(dx * dx + dy * dy) / dt;

  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  lastTime = now;

  if (speed > 0.5 && !isExploding) {
    energy += speed * 2.0; 
    if (energy > 100) energy = 100;
  }

  if (isAudioInit) {
    const freq = 100 + currentNum * 50 + (e.clientX / w) * 600 + energy * 5;
    oscillator.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
    const vol = Math.min((speed * 0.1) + (energy * 0.002), 0.5);
    gainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.05);

    // Update engine (ronco do motor / batimento)
    const engineFreq = 30 + (energy * 1.2);
    engineOsc.frequency.setTargetAtTime(engineFreq, audioCtx.currentTime, 0.1);
    const engineVol = energy * 0.004; // Aumenta o volume com a energia
    engineGain.gain.setTargetAtTime(engineVol, audioCtx.currentTime, 0.1);
  }
});

// Punição de Clique Errado (MISS)
document.addEventListener("mousedown", (e) => {
  initAudio();
  if (isExploding) return;
  
  // Se clicou no corpo (e não no número)
  if (e.target !== numberEl && e.target.id !== "tachometer-bar") {
    energy = 0; // Zera energia
    playMiss(); // Toca som de erro
    
    // Efeito visual de flash vermelho
    document.body.classList.remove('miss-flash');
    void document.body.offsetWidth;
    document.body.classList.add('miss-flash');
    
    // Texto flutuante de MISS
    floatingTexts.push({
      x: e.clientX,
      y: e.clientY,
      text: "MISS!",
      color: "#ff3333",
      life: 1.0,
      vy: -2
    });
  }
});

numberEl.addEventListener("mousedown", (e) => {
  e.stopPropagation(); 
  explode();
});
numberEl.addEventListener("touchstart", (e) => {
  e.stopPropagation();
  explode();
});

function spawnParticles(x, y, hue) {
  const count = 150 + Math.floor(energy * 3);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 25 + 5 + (energy * 0.4);
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.01 + Math.random() * 0.02,
      size: Math.random() * 8 + 2,
      color: `hsl(${hue}, 100%, 60%)`
    });
  }
}

function explode() {
  if (isExploding) return;
  isExploding = true;
  initAudio();
  playAlarm();

  // Calcular Tempo de Reação em ms
  const rxTime = Math.floor(performance.now() - timeSpawned);
  reactionTimes.push(rxTime);
  
  // Texto flutuante da pontuação
  let textColor = "#00ffcc";
  if (rxTime > 350) textColor = "#ffff00";
  if (rxTime > 600) textColor = "#ff9900";
  
  floatingTexts.push({
    x: posX,
    y: posY,
    text: `${rxTime}ms`,
    color: textColor,
    life: 1.5, // Fica mais tempo na tela
    vy: -3
  });

  const currentHue = (currentNum * 36 + energy * 2) % 360;
  spawnParticles(posX, posY, currentHue);

  numberEl.classList.add("explode");

  setTimeout(() => {
    if (currentNum >= 10) {
      const logo = document.getElementById('io-logo');
      const statsEl = document.getElementById('final-stats');
      
      const avg = Math.floor(reactionTimes.reduce((a,b)=>a+b, 0) / reactionTimes.length);
      statsEl.textContent = `Média: ${avg}ms`;
      
      logo.style.display = 'flex';
      logo.classList.remove('show-logo');
      void logo.offsetWidth;
      logo.classList.add('show-logo');
      
      setTimeout(() => { 
        logo.style.display = 'none'; 
        reactionTimes = []; 
      }, 3000); 
      
      currentNum = 1;
    } else {
      currentNum++;
    }
    
    numberEl.textContent = currentNum;
    numberEl.classList.remove("explode");
    energy = 0;
    
    if (isAudioInit) {
      oscillator.type = waveforms[currentNum % 4];
    }

    // Renascer em nova posição e resetar o timer
    posX = Math.random() * (w - 200) + 100;
    posY = Math.random() * (h - 200) + 100;
    velX = 0;
    velY = 0;

    isExploding = false;
    timeSpawned = performance.now(); // Inicia contagem do tempo pro próximo número
  }, 400);
}

function updatePhysics() {
  // Clear canvas com efeito de rastro (Motion Blur)
  ctx.fillStyle = "rgba(5, 5, 5, 0.25)";
  ctx.fillRect(0, 0, w, h);

  if (!isExploding) {
    energy = Math.max(0, energy - 0.5);

    // Atualiza Barra de Tacômetro
    tachometerBar.style.width = `${energy}%`;
    if (energy < 50) {
      tachometerBar.style.backgroundColor = "#34A853";
      tachometerBar.style.boxShadow = "0 0 10px #34A853";
    } else if (energy < 85) {
      tachometerBar.style.backgroundColor = "#FBBC05";
      tachometerBar.style.boxShadow = "0 0 15px #FBBC05";
    } else {
      tachometerBar.style.backgroundColor = "#EA4335";
      tachometerBar.style.boxShadow = "0 0 25px #EA4335";
    }

    // DIFICULDADE INVERTIDA: Quanto mais energia, MENOR e MAIS RÁPIDO ele fica
    const scale = Math.max(0.4, 1.3 - (energy * 0.009)); 
    const hue = (currentNum * 36 + energy * 2) % 360;
    const lightness = 50 + (energy * 0.3);
    const color = `hsl(${hue}, 100%, ${lightness}%)`;
    
    numberEl.style.color = color;
    numberEl.style.textShadow = `0 0 ${10 + energy}px ${color}`;

    // Velocidade muito maior
    const maxSpeed = 3 + (energy * 0.7); 
    
    velX += (Math.random() - 0.5) * (1 + energy * 0.25);
    velY += (Math.random() - 0.5) * (1 + energy * 0.25);

    const currentSpeed = Math.sqrt(velX * velX + velY * velY);
    if (currentSpeed > maxSpeed) {
      velX = (velX / currentSpeed) * maxSpeed;
      velY = (velY / currentSpeed) * maxSpeed;
    }

    posX += velX;
    posY += velY;

    const rectSize = 75 * scale;
    if (posX < rectSize) { posX = rectSize; velX *= -1; }
    if (posX > w - rectSize) { posX = w - rectSize; velX *= -1; }
    if (posY < rectSize) { posY = rectSize; velY *= -1; }
    if (posY > h - rectSize) { posY = h - rectSize; velY *= -1; }

    numberEl.style.transform = `translate(${posX - 75}px, ${posY - 75}px) scale(${scale})`;
  } else {
    tachometerBar.style.width = `0%`;
  }

  // Renderizar Partículas (Canvas)
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.vy += 0.5; // Gravidade
    p.vx *= 0.96; // Atrito
    p.vy *= 0.96;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      particles.splice(i, 1);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }

  // Renderizar Textos Flutuantes (Canvas)
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life -= 0.02;

    if (ft.life <= 0) {
      floatingTexts.splice(i, 1);
    } else {
      ctx.font = "900 35px Inter";
      ctx.textAlign = "center";
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.life;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1.0;
    }
  }

  requestAnimationFrame(updatePhysics);
}

requestAnimationFrame(updatePhysics);
