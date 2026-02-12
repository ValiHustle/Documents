const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');
const startButton = document.getElementById('startButton');

const state = {
  pinch: null,
  pinchDistance: Infinity,
  activeObjectId: null,
  stream: null,
  isRunning: false,
  hands: null,
  isProcessingFrame: false,
  isStarting: false,
  lastFrameTime: performance.now(),
  trail: [],
  objects: [
    { id: 1, type: 'circle', x: 0.2, y: 0.28, size: 22, color: '#35e6c4', vx: 0.06, vy: 0.03 },
    { id: 2, type: 'square', x: 0.47, y: 0.62, size: 20, color: '#8e9eff', vx: -0.05, vy: 0.04 },
    { id: 3, type: 'triangle', x: 0.7, y: 0.35, size: 24, color: '#f3a0ff', vx: 0.04, vy: -0.06 },
    { id: 4, type: 'diamond', x: 0.84, y: 0.58, size: 18, color: '#ffd166', vx: -0.03, vy: -0.05 },
    { id: 5, type: 'star', x: 0.58, y: 0.18, size: 16, color: '#7aff9a', vx: 0.05, vy: 0.02 }
  ]
};

const PINCH_GRAB_THRESHOLD = 0.055;
const PINCH_RELEASE_THRESHOLD = 0.085;

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

function drawPolygon(sides, cx, cy, radius, rotation = 0) {
  canvasCtx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2 + rotation;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) {
      canvasCtx.moveTo(px, py);
    } else {
      canvasCtx.lineTo(px, py);
    }
  }
  canvasCtx.closePath();
}

function drawStar(cx, cy, outerRadius, innerRadius, points = 5, rotation = 0) {
  canvasCtx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const isOuter = i % 2 === 0;
    const radius = isOuter ? outerRadius : innerRadius;
    const angle = (i / (points * 2)) * Math.PI * 2 + rotation;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) {
      canvasCtx.moveTo(px, py);
    } else {
      canvasCtx.lineTo(px, py);
    }
  }
  canvasCtx.closePath();
}

function drawObject(obj, timeMs) {
  const x = obj.x * canvasElement.width;
  const y = obj.y * canvasElement.height;
  const rotation = timeMs * 0.0014 + obj.id;

  canvasCtx.save();
  canvasCtx.shadowColor = obj.color;
  canvasCtx.shadowBlur = state.activeObjectId === obj.id ? 20 : 12;
  canvasCtx.fillStyle = obj.color;

  if (obj.type === 'circle') {
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, obj.size, 0, Math.PI * 2);
    canvasCtx.fill();
  } else if (obj.type === 'square') {
    canvasCtx.translate(x, y);
    canvasCtx.rotate(rotation);
    canvasCtx.fillRect(-obj.size, -obj.size, obj.size * 2, obj.size * 2);
  } else if (obj.type === 'triangle') {
    drawPolygon(3, x, y, obj.size * 1.15, rotation);
    canvasCtx.fill();
  } else if (obj.type === 'diamond') {
    canvasCtx.translate(x, y);
    canvasCtx.rotate(rotation);
    drawPolygon(4, 0, 0, obj.size, Math.PI / 4);
    canvasCtx.fill();
  } else {
    drawStar(x, y, obj.size * 1.1, obj.size * 0.52, 5, rotation);
    canvasCtx.fill();
  }

  canvasCtx.restore();

  if (state.activeObjectId === obj.id) {
    const pulseRadius = obj.size * 1.7 + 5 * Math.sin(timeMs / 140);
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    canvasCtx.strokeStyle = 'rgba(255, 246, 183, 0.8)';
    canvasCtx.lineWidth = 3;
    canvasCtx.stroke();
  }
}

function updateFloatingObjects(deltaTime) {
  for (const obj of state.objects) {
    if (state.activeObjectId === obj.id) continue;

    obj.x += obj.vx * deltaTime;
    obj.y += obj.vy * deltaTime;

    const marginX = Math.max(0.04, obj.size / canvasElement.width + 0.02);
    const marginY = Math.max(0.04, obj.size / canvasElement.height + 0.02);

    if (obj.x <= marginX || obj.x >= 1 - marginX) {
      obj.vx *= -1;
      obj.x = Math.min(1 - marginX, Math.max(marginX, obj.x));
    }

    if (obj.y <= marginY || obj.y >= 1 - marginY) {
      obj.vy *= -1;
      obj.y = Math.min(1 - marginY, Math.max(marginY, obj.y));
    }
  }
}

function drawTrail() {
  if (state.trail.length < 2) return;

  for (let i = 1; i < state.trail.length; i += 1) {
    const prev = state.trail[i - 1];
    const curr = state.trail[i];
    const alpha = i / state.trail.length;

    canvasCtx.beginPath();
    canvasCtx.moveTo(prev.x, prev.y);
    canvasCtx.lineTo(curr.x, curr.y);
    canvasCtx.lineWidth = 1 + alpha * 4;
    canvasCtx.strokeStyle = `rgba(255, 215, 120, ${alpha * 0.7})`;
    canvasCtx.stroke();
  }
}

function updateInteraction() {
  if (!state.pinch) {
    state.activeObjectId = null;
    return;
  }

  const pinchCanvas = toCanvas(state.pinch);

  if (state.activeObjectId === null && state.pinchDistance < PINCH_GRAB_THRESHOLD) {
    let candidate = null;
    let minDistance = Infinity;

    for (const obj of state.objects) {
      const objPos = { x: obj.x * canvasElement.width, y: obj.y * canvasElement.height };
      const d = distance(pinchCanvas, objPos);
      if (d < obj.size * 1.9 && d < minDistance) {
        candidate = obj;
        minDistance = d;
      }
    }

    if (candidate) {
      state.activeObjectId = candidate.id;
      setStatus('Захват: фигура двигается за рукой');
    }
  }

  if (state.activeObjectId !== null && state.pinchDistance > PINCH_RELEASE_THRESHOLD) {
    state.activeObjectId = null;
    setStatus('Отпущено: сведите пальцы снова для захвата');
  }

  if (state.activeObjectId !== null) {
    const obj = state.objects.find((item) => item.id === state.activeObjectId);
    if (obj) {
      obj.x = Math.min(0.97, Math.max(0.03, state.pinch.x));
      obj.y = Math.min(0.97, Math.max(0.03, state.pinch.y));
    }
  }
}

function drawPinchCursor() {
  if (!state.pinch) return;

  const { x, y } = toCanvas(state.pinch);
  const isPinched = state.pinchDistance < PINCH_GRAB_THRESHOLD;

  canvasCtx.beginPath();
  canvasCtx.arc(x, y, isPinched ? 15 : 11, 0, Math.PI * 2);
  canvasCtx.fillStyle = isPinched ? '#ffd166' : '#ff9f43';
  canvasCtx.fill();
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#fff';
  canvasCtx.stroke();
}

function renderFrame(results) {
  if (!videoElement.videoWidth || !videoElement.videoHeight) return;

  const now = performance.now();
  const deltaTime = Math.min(0.03, (now - state.lastFrameTime) / 1000);
  state.lastFrameTime = now;

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  updateFloatingObjects(deltaTime);
  for (const obj of state.objects) {
    drawObject(obj, now);
  }

  if (results.multiHandLandmarks?.length) {
    const hand = results.multiHandLandmarks[0];
    drawConnectors(canvasCtx, hand, HAND_CONNECTIONS, { color: '#7ac8ff', lineWidth: 3 });
    drawLandmarks(canvasCtx, hand, { color: '#d0eeff', lineWidth: 1, radius: 2.5 });

    const thumbTip = hand[4];
    const indexTip = hand[8];
    state.pinch = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2
    };
    state.pinchDistance = distance(thumbTip, indexTip);
    updateInteraction();

    const pinchPoint = toCanvas(state.pinch);
    state.trail.push(pinchPoint);
    if (state.trail.length > 18) {
      state.trail.shift();
    }
  } else {
    state.pinch = null;
    state.activeObjectId = null;
    state.trail = [];
    setStatus('Рука не найдена — покажите ладонь в кадре');
  }

  drawTrail();
  drawPinchCursor();

  if (state.pinch && state.activeObjectId === null) {
    setStatus('Сведите большой и указательный пальцы рядом с фигурой');
  }
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
    setStatus('Камера запущена. Двигайте рукой для взаимодействия.');
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
