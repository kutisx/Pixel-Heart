/* =========================================================================
   sky.js — луна идёт по полукругу и меняет фазы.
   Само небо, звёзды и облака живут в CSS (css/sky.css); здесь только SVG-луна:
   её положение считается по времени вдоль дуги, а форма пересобирается по фазе
   от тонкого серпа к полнолунию и обратно.
   prefers-reduced-motion оставляет луну неподвижной на запасном месте.
   ========================================================================= */

import { debounce, onReducedMotionChange, prefersReducedMotion } from './utils.js';

const CYCLE = 80000; // мс на полный проход по дуге
const STEPS = 48; // сколько раз за проход меняется форма луны
const GRID = 13; // сетка пиксельной луны
const DISC_RADIUS = 6.15;
const PHASE_START = 0.03; // на краю дуги — тонкий серп, а не пустота
const PHASE_SPAN = 0.94;
const START_T = 0.18; // начинаем с видимого серпа, а не с новолуния
const CRATERS = [
  [4, 4],
  [8, 6],
  [5, 9],
  [9, 3]
];

let moon = null;
let rafId = 0;
let epoch = 0;
let width = 0;
let height = 0;
let cx = 0;
let cy = 0;
let radius = 0;
let moonSize = 64;
let lastX = 0;
let lastY = 0;
let lastStep = -1;
let initialized = false;

/** Склеивает клетки в горизонтальные полоски-прямоугольники. */
function rowsToRects(rows) {
  const rects = [];

  rows.forEach((xs, y) => {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let prev = xs[0];

    for (let index = 1; index < xs.length; index += 1) {
      if (xs[index] !== prev + 1) {
        rects.push(`<rect x="${start}" y="${y}" width="${prev - start + 1}" height="1" />`);
        start = xs[index];
      }
      prev = xs[index];
    }
    rects.push(`<rect x="${start}" y="${y}" width="${prev - start + 1}" height="1" />`);
  });

  return rects.join('');
}

function addCell(rows, x, y) {
  if (!rows.has(y)) rows.set(y, []);
  rows.get(y).push(x);
}

/** Пиксельная форма луны для фазы 0..1 (0 — новолуние, 0.5 — полнолуние). */
function moonShape(phase) {
  const angle = phase * Math.PI * 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const side = sin >= 0 ? 1 : -1;
  const half = GRID / 2;
  const disc = new Map();
  const lit = new Map();
  const litCells = new Set();

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const u = (x + 0.5 - half) / DISC_RADIUS;
      const v = (y + 0.5 - half) / DISC_RADIUS;
      if (u * u + v * v > 1) continue;

      addCell(disc, x, y);

      /* терминатор: освещена сторона, куда падает свет, и только до дуги */
      const terminator = cos * Math.sqrt(Math.max(0, 1 - v * v));
      if (u * side <= terminator) continue;

      addCell(lit, x, y);
      litCells.add(`${x}:${y}`);
    }
  }

  const craters = CRATERS.filter(([x, y]) => litCells.has(`${x}:${y}`)).map(
    ([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1" />`
  );

  /* тёмная сторона едва видна — так серп читается как луна, а не как полоска */
  return `<g fill="currentColor" opacity=".07">${rowsToRects(disc)}</g><g fill="currentColor">${rowsToRects(
    lit
  )}</g>${craters.length ? `<g fill="#04060c" opacity=".2">${craters.join('')}</g>` : ''}`;
}

function layout() {
  width = window.innerWidth;
  height = window.innerHeight;
  moonSize = moon.offsetWidth || 64;

  /* на широких экранах — большая дуга, на узких — дуга в полосе неба */
  const compact = width < 900;
  radius = compact
    ? Math.min(width * 0.42, height * 0.22)
    : Math.min(width * 0.36, height * 0.36);
  cx = width / 2;
  cy = compact ? Math.min(height * 0.38, 360) : height * 0.52;
}

/** Ставит луну на дугу и пересобирает форму, когда меняется фаза. */
function place(t) {
  const angle = Math.PI * t;
  const x = cx + Math.cos(angle) * radius - moonSize / 2;
  const y = cy - Math.sin(angle) * radius - moonSize / 2;

  lastX = x;
  lastY = y;
  moon.style.left = `${x.toFixed(1)}px`;
  moon.style.top = `${y.toFixed(1)}px`;

  const phase = PHASE_START + PHASE_SPAN * t;
  const step = Math.min(STEPS - 1, Math.floor(phase * STEPS));

  if (step !== lastStep) {
    lastStep = step;
    moon.setAttribute('viewBox', `0 0 ${GRID} ${GRID}`);
    moon.innerHTML = moonShape(phase);
    moon.dataset.phase = String(step);
  }
}

/** Неподвижная луна для prefers-reduced-motion: место задаёт CSS. */
function renderStill() {
  lastStep = -1;
  moon.setAttribute('viewBox', `0 0 ${GRID} ${GRID}`);
  moon.innerHTML = moonShape(0.38);
  moon.dataset.phase = 'still';
  moon.style.left = '';
  moon.style.top = '';
  lastX = 0;
  lastY = 0;
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const t = (START_T + (now - epoch) / CYCLE) % 1;
  place(t);
}

function stop() {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
}

function start() {
  if (rafId || prefersReducedMotion()) return;
  rafId = requestAnimationFrame(frame);
}

const handleResize = debounce(() => {
  layout();
  if (prefersReducedMotion()) return;
  const t = (START_T + (performance.now() - epoch) / CYCLE) % 1;
  place(t);
}, 150);

export function initSky() {
  if (initialized) return;

  moon = document.getElementById('sky-moon');
  if (!moon) return;

  initialized = true;
  layout();
  epoch = performance.now();

  if (prefersReducedMotion()) {
    renderStill();
  } else {
    place(START_T);
    start();
  }

  window.addEventListener('resize', handleResize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
  window.addEventListener('beforeprint', stop);
  window.addEventListener('afterprint', start);

  onReducedMotionChange((matches) => {
    stop();
    layout();
    if (matches) {
      renderStill();
    } else {
      epoch = performance.now();
      place(START_T);
      start();
    }
  });
}

/* Служебная точка для проверки сценария в консоли и в tools/verify.mjs. */
export const skyDebug = Object.freeze({
  state() {
    return {
      x: Math.round(lastX),
      y: Math.round(lastY),
      phase: lastStep,
      moving: Boolean(rafId)
    };
  }
});
