const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const scoreElement = document.getElementById('score');

const state = {
  pinch: null,
  pinchDistance: Infinity,
  activeBallId: null,
  stream: null,
  isRunning: false,
  hands: null,
  isProcessingFrame: false,
  isStarting: false,
  score: 0,
  zones: [
    { id: 'left', x: 0.14, y: 0.82, width: 0.2, height: 0.22, color: 'rgba(53,230,196,0.24)', border: '#35e6c4' },
    { id: 'right', x: 0.86, y: 0.82, width: 0.2, height: 0.22, color: 'rgba(243,160,255,0.24)', border: '#f3a0ff' }
  ],
  balls: [
    { id: 1, x: 0.25, y: 0.3, radius: 26, color: '#35e6c4', homeX: 0.25, homeY: 0.3 },
    { id: 2, x: 0.48, y: 0.65, radius: 20, color: '#75f28f', homeX: 0.48, homeY: 0.65 },
    { id: 3, x: 0.72, y: 0.4, radius: 24, color: '#f3a0ff', homeX: 0.72, homeY: 0.4 }
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


function updateScore() {
  scoreElement.textContent = `Очки: ${state.score}`;
}

function resetScene() {
  state.activeBallId = null;
  state.score = 0;
  for (const ball of state.balls) {
    ball.x = ball.homeX;
    ball.y = ball.homeY;
  }
  updateScore();
  if (state.isRunning) {
    setStatus('Сцена сброшена: снова захватывайте шары и переносите в зоны');
  } else {
    setStatus('Нажмите «Включить камеру»');
  }
}

function drawZones() {
  for (const zone of state.zones) {
    const width = zone.width * canvasElement.width;
    const height = zone.height * canvasElement.height;
    const x = zone.x * canvasElement.width - width / 2;
    const y = zone.y * canvasElement.height - height / 2;

    canvasCtx.fillStyle = zone.color;
    canvasCtx.fillRect(x, y, width, height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = zone.border;
    canvasCtx.strokeRect(x, y, width, height);
  }
}

function tryScoreBall(ball) {
  const ballX = ball.x * canvasElement.width;
  const ballY = ball.y * canvasElement.height;

  for (const zone of state.zones) {
    const width = zone.width * canvasElement.width;
    const height = zone.height * canvasElement.height;
    const x = zone.x * canvasElement.width - width / 2;
    const y = zone.y * canvasElement.height - height / 2;

    if (ballX > x && ballX < x + width && ballY > y && ballY < y + height) {
      state.score += 1;
      updateScore();
      ball.x = ball.homeX;
      ball.y = ball.homeY;
      setStatus('Попадание! +1 очко. Захватите следующий шар.');
      return true;
    }
  }

  return false;
}

function drawBalls() {
  for (const ball of state.balls) {
    const x = ball.x * canvasElement.width;
    const y = ball.y * canvasElement.height;

    canvasCtx.beginPath();
    canvasCtx.arc(x, y, ball.radius, 0, Math.PI * 2);
    canvasCtx.fillStyle = ball.color;
    canvasCtx.fill();
    canvasCtx.lineWidth = state.activeBallId === ball.id ? 4 : 2;
    canvasCtx.strokeStyle = state.activeBallId === ball.id ? '#fff6b7' : 'rgba(255,255,255,0.4)';
    canvasCtx.stroke();
  }
}

function updateInteraction() {
  if (!state.pinch) {
    state.activeBallId = null;
    return;
  }

  const pinchCanvas = toCanvas(state.pinch);

  if (state.activeBallId === null && state.pinchDistance < PINCH_GRAB_THRESHOLD) {
    let candidate = null;
    let minDistance = Infinity;

    for (const ball of state.balls) {
      const ballPos = { x: ball.x * canvasElement.width, y: ball.y * canvasElement.height };
      const d = distance(pinchCanvas, ballPos);
      if (d < ball.radius * 1.7 && d < minDistance) {
        candidate = ball;
        minDistance = d;
      }
    }

    if (candidate) {
      state.activeBallId = candidate.id;
      setStatus('Захват: шар двигается за рукой');
    }
  }

  if (state.activeBallId !== null && state.pinchDistance > PINCH_RELEASE_THRESHOLD) {
    const releasedBall = state.balls.find((item) => item.id === state.activeBallId);
    state.activeBallId = null;
    if (!releasedBall || !tryScoreBall(releasedBall)) {
      setStatus('Отпущено: сведите пальцы снова для захвата');
    }
  }

  if (state.activeBallId !== null) {
    const ball = state.balls.find((item) => item.id === state.activeBallId);
    if (ball) {
      ball.x = Math.min(0.97, Math.max(0.03, state.pinch.x));
      ball.y = Math.min(0.97, Math.max(0.03, state.pinch.y));
    }
  }
}

function drawPinchCursor() {
  if (!state.pinch) return;

  const { x, y } = toCanvas(state.pinch);
  const isPinched = state.pinchDistance < PINCH_GRAB_THRESHOLD;

  canvasCtx.beginPath();
  canvasCtx.arc(x, y, isPinched ? 14 : 10, 0, Math.PI * 2);
  canvasCtx.fillStyle = isPinched ? '#ffd166' : '#ff9f43';
  canvasCtx.fill();
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#fff';
  canvasCtx.stroke();
}

function renderFrame(results) {
  if (!videoElement.videoWidth || !videoElement.videoHeight) return;

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  drawZones();
  drawBalls();

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
  } else {
    state.pinch = null;
    state.activeBallId = null;
    setStatus('Рука не найдена — покажите ладонь в кадре');
  }

  drawPinchCursor();

  if (state.pinch && state.activeBallId === null) {
    setStatus('Сведите большой и указательный пальцы рядом с шаром');
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

resetButton.addEventListener('click', resetScene);
updateScore();
