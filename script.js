const numberEl = document.getElementById("the-number");
const particlesContainer = document.getElementById("particles-container");

let currentNum = 1;
let energy = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let lastTime = performance.now();

// Number position and velocity
let posX = window.innerWidth / 2;
let posY = window.innerHeight / 2;
let velX = 0;
let velY = 0;

// Web Audio API
let audioCtx, oscillator, gainNode;
let isAudioInit = false;
const waveforms = ["sine", "square", "sawtooth", "triangle"];

function initAudio() {
  if (isAudioInit) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();

  oscillator.type = waveforms[currentNum % 4];
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.frequency.value = 100;
  gainNode.gain.value = 0;
  oscillator.start();
  isAudioInit = true;
}

document.addEventListener("mousemove", (e) => {
  initAudio();
  const now = performance.now();
  const dt = Math.max(1, now - lastTime);

  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  const speed = Math.sqrt(dx * dx + dy * dy) / dt;

  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  lastTime = now;

  // Increase energy based on mouse speed
  if (speed > 0.5) {
    energy += speed * 1.5; // Crescimento mais gradual e natural
    if (energy > 100) energy = 100;
  }

  // Update synth
  if (isAudioInit) {
    const freq = 100 + currentNum * 50 + (e.clientX / window.innerWidth) * 600 + energy * 5;
    oscillator.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);

    const vol = Math.min((speed * 0.1) + (energy * 0.002), 0.5);
    gainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.05);
  }
});

// Click logic for the reflex test
numberEl.addEventListener("mousedown", (e) => {
  e.stopPropagation(); // prevent document click if we had one
  explode();
});

// For touch devices support
numberEl.addEventListener("touchstart", (e) => {
  e.stopPropagation();
  explode();
});

function createParticles(x, y, color) {
  const particleCount = 80 + Math.floor(energy * 1.5);
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    
    // Random size (Partículas maiores)
    const size = Math.random() * 15 + 8;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.backgroundColor = color;
    p.style.boxShadow = `0 0 ${size*3}px ${color}`;

    // Start pos
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;

    particlesContainer.appendChild(p);

    // Random velocity (Fireworks explosion)
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 20 + 10 + (energy * 0.3);
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;

    let px = x;
    let py = y;
    let opacity = 1;
    let life = 1.0;
    const gravity = 0.5;

    function animateParticle() {
      vy += gravity; // Gravity effect
      px += vx;
      py += vy;
      
      vx *= 0.96; // Friction
      vy *= 0.96;
      
      life -= 0.015 + Math.random() * 0.01;
      opacity = Math.max(0, life);
      
      p.style.transform = `translate(${px - x}px, ${py - y}px) scale(${opacity})`;
      p.style.opacity = opacity;

      if (life > 0) {
        requestAnimationFrame(animateParticle);
      } else {
        p.remove();
      }
    }
    requestAnimationFrame(animateParticle);
  }
}

let isExploding = false;

function playAlarm() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const alarmOsc = audioCtx.createOscillator();
  const alarmGain = audioCtx.createGain();
  
  alarmOsc.type = 'square'; // Som de alarme bem marcado
  alarmOsc.connect(alarmGain);
  alarmGain.connect(audioCtx.destination);
  
  // Frequência alta com queda rápida para imitar alarme ou "hit" de jogo
  alarmOsc.frequency.setValueAtTime(1500 + (currentNum * 150), audioCtx.currentTime);
  alarmOsc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.2);
  
  alarmGain.gain.setValueAtTime(0.6, audioCtx.currentTime);
  alarmGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  
  alarmOsc.start();
  alarmOsc.stop(audioCtx.currentTime + 0.3);
}

function explode() {
  if (isExploding) return;
  isExploding = true;
  initAudio();
  playAlarm(); // Dispara o som de alarme quando acerta
  
  // Play background explosion sound fade
  if (isAudioInit) {
    oscillator.frequency.setTargetAtTime(800 + currentNum * 200, audioCtx.currentTime, 0.01);
    gainNode.gain.setTargetAtTime(0.8, audioCtx.currentTime, 0.01);
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime + 0.1, 0.2);
  }

  const currentColor = numberEl.style.color || "#ffffff";
  createParticles(posX, posY, currentColor);

  numberEl.classList.add("explode");

  setTimeout(() => {
    if (currentNum >= 10) {
      // Show Google I/O Logo
      const logo = document.getElementById('io-logo');
      logo.style.display = 'flex';
      logo.classList.remove('show-logo');
      void logo.offsetWidth; // Trigger reflow
      logo.classList.add('show-logo');
      
      setTimeout(() => { logo.style.display = 'none'; }, 1000);
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

    // Reset position fully randomized within screen bounds
    posX = Math.random() * (window.innerWidth - 200) + 100;
    posY = Math.random() * (window.innerHeight - 200) + 100;
    velX = 0;
    velY = 0;

    isExploding = false;
  }, 400);
}

function updatePhysics() {
  if (!isExploding) {
    // Energy decay
    energy = Math.max(0, energy - 0.5);

    // Number styling based on energy
    const scale = 0.5 + (energy * 0.012); // Cresce gradualmente (antes era 0.03)
    const hue = (currentNum * 36 + energy * 2) % 360;
    const lightness = 50 + (energy * 0.2);
    const color = `hsl(${hue}, 100%, ${lightness}%)`;
    
    numberEl.style.color = color;
    numberEl.style.textShadow = `0 0 ${10 + energy}px ${color}`;

    // Movement speed based on energy
    const maxSpeed = 2 + (energy * 0.4); // Faster speed for F1 pilots
    
    // Add random steering to velocity
    velX += (Math.random() - 0.5) * (1 + energy * 0.1);
    velY += (Math.random() - 0.5) * (1 + energy * 0.1);

    // Limit speed
    const currentSpeed = Math.sqrt(velX * velX + velY * velY);
    if (currentSpeed > maxSpeed) {
      velX = (velX / currentSpeed) * maxSpeed;
      velY = (velY / currentSpeed) * maxSpeed;
    }

    posX += velX;
    posY += velY;

    // Bounce off walls
    const rectSize = 75 * scale; // Approx half size
    if (posX < rectSize) { posX = rectSize; velX *= -1; }
    if (posX > window.innerWidth - rectSize) { posX = window.innerWidth - rectSize; velX *= -1; }
    if (posY < rectSize) { posY = rectSize; velY *= -1; }
    if (posY > window.innerHeight - rectSize) { posY = window.innerHeight - rectSize; velY *= -1; }

    numberEl.style.transform = `translate(${posX - 75}px, ${posY - 75}px) scale(${scale})`;
  }

  requestAnimationFrame(updatePhysics);
}

requestAnimationFrame(updatePhysics);
