'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (con hueco)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEMES = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#d8d8e4', highlight: 'rgba(0,0,0,0.10)' },
};

const NEON_COLORS = [
  null,
  '#00e5ff', // I
  '#fff200', // O
  '#e040fb', // T
  '#39ff14', // S
  '#ff1744', // Z
  '#2979ff', // J
  '#ff9100', // L
  '#b0bec5', // N
];

const PASTEL_COLORS = [
  null,
  '#a8e6f0', // I
  '#fff3b0', // O
  '#e0bbf0', // T
  '#c1f0c1', // S
  '#f5b8b8', // Z
  '#b8d4f5', // J
  '#f5d3a8', // L
  '#d9d9d9', // N
];

const SKIN_PALETTES = {
  retro: COLORS,
  neon: NEON_COLORS,
  pastel: PASTEL_COLORS,
  pixel: COLORS,
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayBox = document.getElementById('overlay-box');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');
const leaderboardList = document.getElementById('leaderboard-list');
const resetScoresBtn = document.getElementById('reset-scores-btn');

const HIGHSCORES_KEY = 'tetris-highscores';
const MAX_HIGHSCORES = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo, maxLines;
let theme = localStorage.getItem('tetris-theme') === 'light' ? 'light' : 'dark';
let currentSkin = localStorage.getItem('tetris-skin') || 'retro';

function applyTheme(t) {
  theme = t;
  document.body.classList.toggle('light', t === 'light');
  themeToggle.checked = t === 'light';
  localStorage.setItem('tetris-theme', t);
}

function applySkin(s) {
  currentSkin = s;
  document.body.classList.toggle('skin-neon', s === 'neon');
  skinSelect.value = s;
  localStorage.setItem('tetris-skin', s);
  if (typeof board !== 'undefined' && board) {
    draw();
    drawNext();
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    if (lines > maxLines) maxLines = lines;
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKIN_PALETTES[currentSkin][colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  const h = size - 2;
  context.globalAlpha = alpha ?? 1;

  if (currentSkin === 'neon') {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 12;
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    context.restore();
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(px, py, w, 4);
  } else if (currentSkin === 'pastel') {
    const r = Math.min(6, w / 4, h / 4);
    context.fillStyle = color;
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(px, py, w, h, r);
    } else {
      context.rect(px, py, w, h);
    }
    context.fill();
    context.fillStyle = THEMES[theme].highlight;
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(px, py, w, 4, [r, r, 0, 0]);
    } else {
      context.rect(px, py, w, 4);
    }
    context.fill();
  } else if (currentSkin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    // pixel/checker texture
    const dot = Math.max(2, Math.floor(size / 6));
    context.fillStyle = 'rgba(0,0,0,0.18)';
    for (let ty = 0; ty < h; ty += dot * 2) {
      for (let tx = 0; tx < w; tx += dot * 2) {
        context.fillRect(px + tx, py + ty, dot, dot);
        context.fillRect(px + tx + dot, py + ty + dot, dot, dot);
      }
    }
    context.fillStyle = THEMES[theme].highlight;
    context.fillRect(px, py, w, 4);
  } else {
    // retro
    context.fillStyle = color;
    context.fillRect(px, py, w, h);
    context.fillStyle = THEMES[theme].highlight;
    context.fillRect(px, py, w, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEMES[theme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function getHighScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHighScores(list) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function qualifiesForHighScore(s) {
  const list = getHighScores();
  return list.length < MAX_HIGHSCORES || s > list[list.length - 1].score;
}

function addHighScore(name) {
  const list = getHighScores();
  const entry = { name: (name || 'AAA').slice(0, 12), score, lines, level, combo: maxCombo };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_HIGHSCORES);
  saveHighScores(trimmed);
  return { list: trimmed, index: trimmed.indexOf(entry) };
}

function renderLeaderboardInto(container, list, highlightIndex) {
  container.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = 'Sin registros aún';
    container.appendChild(li);
    return;
  }
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === highlightIndex) li.classList.add('current');
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.name;
    const s = document.createElement('span');
    s.className = 'lb-score';
    s.textContent = entry.score.toLocaleString();
    li.appendChild(name);
    li.appendChild(s);
    container.appendChild(li);
  });
}

function renderLeaderboard(highlightIndex) {
  renderLeaderboardInto(leaderboardList, getHighScores(), highlightIndex ?? -1);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  overlayBox.innerHTML = '';

  const title = document.createElement('p');
  title.id = 'overlay-title';
  title.textContent = 'GAME OVER';
  overlayBox.appendChild(title);

  const stats = document.createElement('div');
  stats.className = 'overlay-stats';
  stats.innerHTML = `
    <span>Puntuación: ${score.toLocaleString()}</span>
    <span>Líneas: ${lines}</span>
    <span>Nivel: ${level}</span>
    <span>Mejor combo: ${maxCombo}</span>
  `;
  overlayBox.appendChild(stats);

  const qualifies = qualifiesForHighScore(score);
  let overlayLeaderboardList;

  if (qualifies) {
    const form = document.createElement('div');
    form.className = 'overlay-stats';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.placeholder = 'Tu nombre';
    input.className = 'menu-field';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'menu-btn';
    saveBtn.textContent = 'Guardar';
    form.appendChild(input);
    form.appendChild(saveBtn);
    overlayBox.appendChild(form);
    input.focus();

    saveBtn.addEventListener('click', () => {
      const { list, index } = addHighScore(input.value.trim());
      form.remove();
      renderLeaderboardInto(overlayLeaderboardList, list, index);
      renderLeaderboard(index);
    });
  }

  const lbWrap = document.createElement('div');
  lbWrap.className = 'overlay-leaderboard';
  const lbLabel = document.createElement('span');
  lbLabel.className = 'label';
  lbLabel.textContent = 'TOP 5';
  const lbList = document.createElement('ol');
  lbList.className = 'leaderboard-list';
  lbWrap.appendChild(lbLabel);
  lbWrap.appendChild(lbList);
  overlayBox.appendChild(lbWrap);
  overlayLeaderboardList = lbList;
  renderLeaderboardInto(lbList, getHighScores(), -1);

  const restartBtn = document.createElement('button');
  restartBtn.className = 'menu-btn';
  restartBtn.textContent = 'Reiniciar';
  restartBtn.addEventListener('click', init);
  overlayBox.appendChild(restartBtn);

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayBox.innerHTML = `
      <p id="overlay-title">PAUSA</p>
      <p id="overlay-score"></p>
    `;
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  maxCombo = 0;
  maxLines = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'light' : 'dark'));
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));
resetScoresBtn.addEventListener('click', () => {
  localStorage.removeItem(HIGHSCORES_KEY);
  renderLeaderboard();
});

applyTheme(theme);
renderLeaderboard();
init();
applySkin(currentSkin);
