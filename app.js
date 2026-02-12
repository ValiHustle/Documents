const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');
const startButton = document.getElementById('startButton');
const applySettingsButton = document.getElementById('applySettings');

const countInput = document.getElementById('particleCount');
const sizeInput = document.getElementById('particleSize');
const colorInput = document.getElementById('particleColor');
const speedInput = document.getElementById('particleSpeed');

const state = {
  pinch: null,
  pinchDistance: Infinity,
  stream: null,
  isRunning: false,
  hands: null,
  isProcessingFrame: false,
  isStarting: false,
  particles: [],
  settings: {
    count: 140,
    size: 6,
    color: '#35e6c4',
    speed: 1.4
  }
};

const PINCH_PUSH_THRESHOLD = 0.06;
const PUSH_RADIUS_FACTOR = 18;
const PUSH_STRENGTH = 3.1;
const MAX_SPEED = 7;
const FRICTION = 0.992;

function setStatus(text) {
  statusElement.textContent = text;
}

function toCanvas(point) {
  return {
    x: point.x * canvasElement.width,
    y: point.y * canvasElement.height
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createParticle(radius, color, speed) {
  const angle = Math.random() * Math.PI * 2;
  const velocity = (0.35 + Math.random() * 0.65) * speed;

  return {
    x: Math.random() * canvasElement.width,
    y: Math.random() * canvasElement.height,
    vx: Math.cos(angle) * velocity,
    vy: Math.sin(angle) * velocity,
    radius,
    color
  };
}

function rebuildParticles() {
  state.settings = {
    count: clamp(Number(countInput.value) || 140, 20, 500),
    size: clamp(Number(sizeInput.value) || 6, 2, 24),
    color: colorInput.value || '#35e6c4',
    speed: clamp(Number(speedInput.value) || 1.4, 0.3, 4)
  };

  countInput.value = String(state.settings.count);
  sizeInput.value = String(state.settings.size);
  speedInput.value = String(state.settings.speed);

  state.particles = Array.from({ length: state.settings.count }, () =>
    createParticle(state.settings.size, state.settings.color, state.settings.speed)
  );

  setStatus('Настройки применены. Сведите пальцы рядом с частицами, чтобы оттолкнуть их.');
}

function drawParticles() {
  for (const particle of state.particles) {
    canvasCtx.beginPath();
    canvasCtx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    canvasCtx.fillStyle = particle.color;
    canvasCtx.fill();
  }
}

function advanceParticles() {
  for (const particle of state.particles) {
    particle.vx *= FRICTION;
    particle.vy *= FRICTION;

    particle.vx += (Math.random() - 0.5) * 0.08 * state.settings.speed;
    particle.vy += (Math.random() - 0.5) * 0.08 * state.settings.speed;

    particle.vx = clamp(particle.vx, -MAX_SPEED, MAX_SPEED);
    particle.vy = clamp(particle.vy, -MAX_SPEED, MAX_SPEED);

    particle.x += particle.vx;
    particle.y += particle.vy;

    if (particle.x < particle.radius) {
      particle.x = particle.radius;
      particle.vx = Math.abs(particle.vx);
    } else if (particle.x > canvasElement.width - particle.radius) {
      particle.x = canvasElement.width - particle.radius;
      particle.vx = -Math.abs(particle.vx);
    }

    if (particle.y < particle.radius) {
      particle.y = particle.radius;
      particle.vy = Math.abs(particle.vy);
    } else if (particle.y > canvasElement.height - particle.radius) {
      particle.y = canvasElement.height - particle.radius;
      particle.vy = -Math.abs(particle.vy);
    }
  }
}

function pushParticles() {
  if (!state.pinch || state.pinchDistance > PINCH_PUSH_THRESHOLD) return;

  const pinchCanvas = toCanvas(state.pinch);
  const pushRadius = state.settings.size * PUSH_RADIUS_FACTOR;

  for (const particle of state.particles) {
    const d = distance(pinchCanvas, particle);
    if (d > pushRadius) continue;

    const strength = (1 - d / pushRadius) * PUSH_STRENGTH * state.settings.speed;
    const nx = (particle.x - pinchCanvas.x) / (d || 1);
    const ny = (particle.y - pinchCanvas.y) / (d || 1);

    particle.vx += nx * strength;
    particle.vy += ny * strength;
  }

  setStatus('Пинч активен: частицы отталкиваются от руки.');
}

function drawPinchCursor() {
  if (!state.pinch) return;

  const { x, y } = toCanvas(state.pinch);
  const isPinched = state.pinchDistance < PINCH_PUSH_THRESHOLD;

  canvasCtx.beginPath();
  canvasCtx.arc(x, y, isPinched ? 15 : 10, 0, Math.PI * 2);
  canvasCtx.fillStyle = isPinched ? '#ffd166' : '#ff9f43';
  canvasCtx.fill();
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#fff';
  canvasCtx.stroke();
}

function renderFrame(results) {
  if (!videoElement.videoWidth || !videoElement.videoHeight) return;

  if (canvasElement.width !== videoElement.videoWidth || canvasElement.height !== videoElement.videoHeight) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    if (state.particles.length === 0) {
      rebuildParticles();
    }
  }

  if (results.multiHandLandmarks?.length) {
    const hand = results.multiHandLandmarks[0];

    const thumbTip = hand[4];
    const indexTip = hand[8];
    state.pinch = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2
    };
    state.pinchDistance = distance(thumbTip, indexTip);

    if (state.pinchDistance > PINCH_PUSH_THRESHOLD) {
      setStatus('Сведите большой и указательный пальцы, чтобы толкать частицы.');
    }
  } else {
    state.pinch = null;
    setStatus('Рука не найдена — покажите ладонь в кадре');
  }

  pushParticles();
  advanceParticles();

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  drawParticles();

  if (results.multiHandLandmarks?.length) {
    const hand = results.multiHandLandmarks[0];
    drawConnectors(canvasCtx, hand, HAND_CONNECTIONS, { color: '#7ac8ff', lineWidth: 3 });
    drawLandmarks(canvasCtx, hand, { color: '#d0eeff', lineWidth: 1, radius: 2.5 });
  }

  drawPinchCursor();
}

function nextFrame() {
  if (!state.isRunning) return;

  requestAnimationFrame(nextFrame);

  if (state.isProcessingFrame || videoElement.readyState < 2 || !state.hands) {
    return;
  }

  state.isProcessingFrame = true;
  state.hands
    .send({ image: videoElement })
    .catch((error) => {
      console.error(error);
      setStatus('Ошибка обработки видеопотока. Обновите страницу.');
    })
    .finally(() => {
      state.isProcessingFrame = false;
    });
}

async function initHands() {
  if (state.hands) return;

  setStatus('Загрузка модели распознавания руки…');

  state.hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  state.hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6
  });

  state.hands.onResults(renderFrame);
}

function explainCameraError(error) {
  if (!window.isSecureContext) {
    return 'Камера работает только в HTTPS или на localhost. Откройте страницу как http://localhost:4173.';
  }

  if (error?.name === 'NotAllowedError') {
    return 'Доступ к камере запрещён. Разрешите камеру в браузере и нажмите кнопку снова.';
  }

  if (error?.name === 'NotFoundError') {
    return 'Камера не найдена. Подключите устройство камеры и повторите попытку.';
  }

  return 'Не удалось получить доступ к камере. Проверьте разрешения браузера и обновите страницу.';
}

async function startExperience() {
  if (state.isStarting || state.isRunning) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Ваш браузер не поддерживает getUserMedia. Нужен современный Chrome/Edge/Firefox/Safari.');
    return;
  }

  state.isStarting = true;
  startButton.textContent = 'Запуск…';
  setStatus('Запрашиваем доступ к камере…');

  try {
    await initHands();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    state.stream = stream;
    videoElement.srcObject = stream;
    await videoElement.play();

    state.isRunning = true;
    state.isStarting = false;
    startButton.disabled = false;
    startButton.textContent = 'Камера включена';
    setStatus('Камера запущена. Толкайте частицы пинч-жестом.');
    nextFrame();
  } catch (error) {
    console.error(error);
    state.isStarting = false;
    setStatus(explainCameraError(error));
    startButton.textContent = 'Включить камеру';
  }
}

startButton.addEventListener('click', () => {
  if (!state.isRunning) {
    startExperience();
  }
});

applySettingsButton.addEventListener('click', rebuildParticles);
rebuildParticles();
