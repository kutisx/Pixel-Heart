/* =========================================================================
   petals.js — сцена за контентом: небо живёт в CSS (css/sky.css), а на
   <canvas id="petals"> падают пиксельные лепестки и лежит нижняя «земля».

   Лепестки опускаются на землю и копятся небольшим сугробом, а маскот сайта
   периодически выходит вдоль нижней кромки и убирает их метлой. Форма,
   плотность, скорость и цвета лепестков берутся из палитры темы, поэтому при
   смене палитры сцена перестраивается: doki → сердца, saya → длинные лепестки,
   nine → ромбы, va11 → неон-плюсы.

   prefers-reduced-motion оставляет статичный кадр без движения и без маскота.
   ========================================================================= */

import { getPalette } from './data.js';
import { t } from './i18n.js';
import { buildMascotSVG } from './mascot.js';
import { getState, subscribeTo } from './state.js';
import { buildTheme, mix } from './theme.js';
import { clamp, debounce, onReducedMotionChange, prefersReducedMotion } from './utils.js';

/* Пиксельные спрайты: '#' — закрашенная клетка, '.' — прозрачная.
   Размер сетки маленький намеренно: на экране лепесток остаётся пиксельным. */
const SHAPES = {
  heart: [
    '.##.##.',
    '#######',
    '#######',
    '.#####.',
    '..###..',
    '...#...'
  ],
  'mini-heart': [
    '.#.#.',
    '#####',
    '#####',
    '.###.',
    '..#..'
  ],
  petal: [
    '..#..',
    '.###.',
    '#####',
    '.###.',
    '..#..',
    '..#..',
    '...#.'
  ],
  drop: [
    '..#..',
    '.###.',
    '#####',
    '#####',
    '.###.',
    '..#..',
    '...#.'
  ],
  diamond: [
    '...#...',
    '..###..',
    '.#####.',
    '#######',
    '.#####.',
    '..###..',
    '...#...'
  ],
  sparkle: [
    '...#...',
    '...#...',
    '..###..',
    '#######',
    '..###..',
    '...#...',
    '...#...'
  ],
  plus: [
    '..###..',
    '..###..',
    '#######',
    '#######',
    '#######',
    '..###..',
    '..###..'
  ],
  square: [
    '.###.',
    '#####',
    '#####',
    '#####',
    '.###.'
  ]
};

/*
 * Характер сцены у каждой палитры свой: у Doki Doki лёгкие сердца и быстрый
 * ветер, у Saya no Uta — редкие тяжёлые лепестки, у 9 Rip — ромбы, которые
 * широко качает, у VA-11 HALL-A — частые неоновые плюсы.
 */
const PETAL_THEMES = {
  doki: {
    shapes: ['heart', 'mini-heart'],
    density: 1,
    fall: [16, 36],
    sway: [10, 24],
    swaySpeed: [0.7, 1.5],
    spin: [-1.1, 1.1],
    scale: [3, 4],
    drift: [-8, 8]
  },
  saya: {
    shapes: ['petal', 'drop'],
    density: 0.8,
    fall: [10, 24],
    sway: [6, 16],
    swaySpeed: [0.5, 1.1],
    spin: [-0.5, 0.5],
    scale: [3, 4],
    drift: [-4, 4]
  },
  nine: {
    shapes: ['diamond', 'sparkle'],
    density: 1.1,
    fall: [18, 42],
    sway: [18, 38],
    swaySpeed: [1, 2],
    spin: [-1.7, 1.7],
    scale: [3, 4],
    drift: [-12, 12]
  },
  va11: {
    shapes: ['plus', 'square'],
    density: 1.2,
    fall: [24, 52],
    sway: [8, 20],
    swaySpeed: [0.8, 1.8],
    spin: [-2, 2],
    scale: [3, 4],
    drift: [-6, 6]
  }
};

const FALLBACK_CONFIG = PETAL_THEMES.doki;
const AREA_PER_PETAL = 38000;
const MIN_PETALS = 10;
const MAX_PETALS = 64;
const MAX_DPR = 2;
const STILL_DENSITY = 0.6;
const RESIZE_DELAY = 150;

/* Земля и маскот-дворник. FLOOR_OFFSET совпадает с bottom в css/petals.css. */
const FLOOR_OFFSET = 9;
const FLOOR_MIN = 96;
const REST_LIMIT_RATIO = 40;
const REST_LIMIT_MIN = 6;
const REST_LIMIT_MAX = 32;

const WALKER_NOVELS = ['doki', 'saya', 'nine', 'va11'];
const WALKER_MODES = { doki: 'clean', saya: 'clean', nine: 'jump', va11: 'jump' };
const WALKER_WIDTH = 60;
const WALKER_MARGIN = 64;
const WALKER_RISE_TIME = 0.6;
const WALKER_LOOK_TIME = 0.6;
const WALKER_PEEK_OFFSET = 84;
const WALKER_MAX_ACTIVE = 2;
const WALKER_PAUSE = [8, 16];
const WALKER_SPEEDS = [52, 92];
const WALKER_BROOM_REACH = 42;
const WALKER_FIRST_DELAY = 4;
const WALKER_STAGGER = 3;
const WALKER_JUMP_TIME = [4, 7];
const WALKER_HOP_HEIGHT = 12;
const WALKER_HOP_RATE = 1.4;
const TALK_DISTANCE = 96;
const TALK_TIME = 4.2;
const TALK_COOLDOWN = 16;
const SWEEP_TIME = 0.5;

/* Короткие реплики для встреч маскотов: пары «вопрос — ответ». */
const TALKS = [
  ['scene.talk1a', 'scene.talk1b'],
  ['scene.talk2a', 'scene.talk2b'],
  ['scene.talk3a', 'scene.talk3b'],
  ['scene.talk4a', 'scene.talk4b'],
  ['scene.talk5a', 'scene.talk5b'],
  ['scene.talk6a', 'scene.talk6b']
];

let canvas = null;
let ctx = null;
let floorCanvas = null;
let floorCtx = null;
let walkersLayer = null;
let footer = null;
let walkers = [];

let sprites = [];
let flakes = [];
const resting = [];
let config = FALLBACK_CONFIG;
let theme = null;

let width = 0;
let height = 0;
let dpr = 1;
let floorY = 0;
let restLimit = REST_LIMIT_MIN;
let scrollRaf = 0;

let rafId = 0;
let lastTime = 0;
let sceneTime = 0;
let staticMode = false;
let initialized = false;
let sweptTotal = 0;
let meeting = null;
let meetCooldown = 0;

function randomRange(range) {
  return range[0] + Math.random() * (range[1] - range[0]);
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Рисует один спрайт в его собственный холст: 1 клетка = 1 пиксель. */
function createSprite(shape, color) {
  const rows = SHAPES[shape];
  if (!rows) return null;

  const spriteWidth = rows[0].length;
  const spriteHeight = rows.length;
  const sprite = document.createElement('canvas');
  sprite.width = spriteWidth;
  sprite.height = spriteHeight;

  const spriteCtx = sprite.getContext('2d');
  if (!spriteCtx) return null;

  const glint = mix(color, '#FFFFFF', 0.45);
  let glinted = false;

  for (let y = 0; y < spriteHeight; y += 1) {
    for (let x = 0; x < spriteWidth; x += 1) {
      if (rows[y][x] !== '#') continue;
      /* один блик у верхней кромки: лепесток ловит свет */
      const useGlint = !glinted && y > 0;
      spriteCtx.fillStyle = useGlint ? glint : color;
      spriteCtx.fillRect(x, y, 1, 1);
      if (useGlint) glinted = true;
    }
  }

  return sprite;
}

/** Набор спрайтов темы: две формы в четырёх оттенках палитры. */
function buildSprites(themeColors, themeConfig) {
  const colors = [
    themeColors.accentText,
    themeColors.accent2Text,
    mix(themeColors.accentText, themeColors.accent2Text, 0.5),
    mix(themeColors.accentText, '#FFFFFF', 0.32)
  ];
  const result = [];

  themeConfig.shapes.forEach((shape) => {
    colors.forEach((color) => {
      const sprite = createSprite(shape, color);
      if (sprite) result.push(sprite);
    });
  });

  return result;
}

/* --------------------------------------------------------------- геометрия */

function measure() {
  width = Math.max(1, window.innerWidth);
  height = Math.max(1, window.innerHeight);
  dpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  /* после смены размера состояние контекста сбрасывается — задаём заново */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  /* земля рисуется на холсте во весь экран: линия может уйти к подвалу */
  if (floorCanvas && floorCtx) {
    floorCanvas.width = Math.round(width * dpr);
    floorCanvas.height = Math.round(height * dpr);
    floorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    floorCtx.imageSmoothingEnabled = false;
  }

  restLimit = clamp(Math.round(width / REST_LIMIT_RATIO), REST_LIMIT_MIN, REST_LIMIT_MAX);
}

/**
 * Верхняя граница подвала — финальный пол сцены. Пока подвал ниже экрана,
 * пол стоит у нижней кромки; когда он поднимается, пол едет за ним.
 */
function updateFloor() {
  const natural = height - FLOOR_OFFSET;
  const footerTop = footer ? footer.getBoundingClientRect().top : height;
  floorY = Math.max(FLOOR_MIN, Math.min(natural, footerTop));

  const lift = natural - floorY;
  if (walkersLayer) walkersLayer.style.setProperty('--floor-lift', `${lift.toFixed(1)}px`);

  resting.forEach((flake) => {
    flake.y = floorY - flake.h / 2;
  });
}

/* --------------------------------------------------------------- лепестки */

function createFlake(startY) {
  const flake = {
    sprite: null,
    w: 0,
    h: 0,
    x: 0,
    y: 0,
    vy: 0,
    sway: 0,
    swaySpeed: 0,
    swayPhase: 0,
    spin: 0,
    drift: 0,
    rotation: 0,
    alpha: 1,
    time: 0,
    phase: 'fall',
    sweepTime: 0,
    sweepVy: 0,
    sweepVx: 0
  };

  resetFlake(flake, startY);
  return flake;
}

function resetFlake(flake, startY) {
  const sprite = pickOne(sprites);
  const scale = pickOne(config.scale);
  const flakeWidth = sprite.width * scale;
  const flakeHeight = sprite.height * scale;

  flake.sprite = sprite;
  flake.w = flakeWidth;
  flake.h = flakeHeight;
  flake.x = Math.random() * (width + 96) - 48;
  flake.y =
    typeof startY === 'number'
      ? Math.min(startY, floorY - flakeHeight / 2)
      : -flakeHeight - Math.random() * Math.max(80, height * 0.6);

  flake.vy = randomRange(config.fall);
  flake.sway = randomRange(config.sway);
  flake.swaySpeed = randomRange(config.swaySpeed);
  flake.swayPhase = Math.random() * Math.PI * 2;
  flake.spin = randomRange(config.spin);
  flake.drift = randomRange(config.drift);
  flake.rotation = Math.random() * Math.PI * 2;
  flake.alpha = 0.36 + Math.random() * 0.34;
  flake.time = Math.random() * 4;
  flake.phase = 'fall';
  flake.sweepTime = 0;
  flake.sweepVy = 0;
  flake.sweepVx = 0;
}

function buildFlakes(multiplier) {
  const total = clamp(
    Math.round(((width * height) / AREA_PER_PETAL) * config.density * multiplier),
    MIN_PETALS,
    MAX_PETALS
  );
  const result = [];

  for (let index = 0; index < total; index += 1) {
    /* первые лепестки рассыпаны по экрану, а не висят над верхней кромкой */
    result.push(createFlake(-40 + Math.random() * (height + 40)));
  }

  return result;
}

function landFlake(flake) {
  flake.phase = 'rest';
  flake.y = floorY - flake.h / 2;
  flake.rotation = clamp(flake.rotation, -0.45, 0.45);
  flake.alpha = Math.min(flake.alpha, 0.88);
  resting.push(flake);

  /* сугроб не растёт бесконечно: самый старый лепесток снова уходит наверх */
  while (resting.length > restLimit) {
    resetFlake(resting.shift());
  }
}

function updateFlake(flake, dt) {
  if (flake.phase === 'rest') return;

  if (flake.phase === 'swept') {
    flake.sweepTime += dt;
    flake.y += flake.sweepVy * dt;
    flake.x += flake.sweepVx * dt;
    flake.rotation += 7 * dt;
    if (flake.sweepTime >= SWEEP_TIME) resetFlake(flake);
    return;
  }

  flake.time += dt;
  flake.y += flake.vy * dt;
  flake.x +=
    (Math.cos(flake.swayPhase + flake.time * flake.swaySpeed) *
      flake.sway *
      flake.swaySpeed +
      flake.drift) *
    dt;
  flake.rotation += flake.spin * dt;

  if (flake.x < -96) flake.x = width + 48;
  else if (flake.x > width + 96) flake.x = -48;

  if (flake.y + flake.h / 2 >= floorY) landFlake(flake);
}

function paintFlake(context, flake) {
  let alpha = flake.alpha;
  if (flake.phase === 'swept') alpha *= Math.max(0, 1 - flake.sweepTime / SWEEP_TIME);
  if (alpha <= 0.01) return;

  context.save();
  context.globalAlpha = alpha;
  context.translate(flake.x, flake.y);
  context.rotate(flake.rotation);
  context.drawImage(flake.sprite, -flake.w / 2, -flake.h / 2, flake.w, flake.h);
  context.restore();
}

/** Отпечаток положения лепестков: по нему видно, что смена темы их не сбрасывает. */
function layoutHash() {
  let hash = 7;
  flakes.forEach((flake) => {
    hash = (hash * 31 + Math.round(flake.x) + Math.round(flake.y) * 17) % 2147483647;
  });
  return hash;
}

/* ------------------------------------------------- маскоты-дворники */

/** Собирает четырёх маскотов — по одному на новеллу, с её одеждой и аксессуаром. */
function buildWalkers() {
  const container = document.getElementById('petal-walkers');
  if (!container) return;

  walkers = WALKER_NOVELS.map((novelId, index) => {
    const mode = WALKER_MODES[novelId] || 'clean';
    const element = document.createElement('div');
    element.className = 'petal-walker';
    if (mode === 'jump') element.classList.add('petal-walker--jump');
    element.dataset.novel = novelId;
    element.dataset.mode = mode;
    element.dataset.state = 'away';
    element.dataset.direction = 'right';
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML =
      '<span class="petal-walker__art"></span><span class="petal-walker__broom" aria-hidden="true"></span>';

    const bubble = document.createElement('div');
    bubble.className = 'petal-bubble';
    bubble.dataset.visible = 'false';
    bubble.setAttribute('aria-hidden', 'true');

    const walker = {
      novelId,
      mode,
      element,
      art: element.querySelector('.petal-walker__art'),
      broom: element.querySelector('.petal-walker__broom'),
      bubble,
      x: 0,
      width: WALKER_WIDTH,
      direction: 1,
      speed: WALKER_SPEEDS[0],
      peek: 0,
      hop: 0,
      hopTime: 0,
      jumpLeft: 0,
      turns: 0,
      blockedFor: 0,
      turnPoint: 40,
      nextTalk: 0,
      savedPhase: 'walking',
      phase: 'away',
      wait: 0,
      nextAt: WALKER_FIRST_DELAY + index * WALKER_STAGGER
    };

    container.append(element);
    container.append(bubble);
    renderWalkerArt(walker);
    return walker;
  });
}

/** Одежда и аксессуар — варианта своей новеллы, цвета — из её палитры. */
function renderWalkerArt(walker) {
  const state = getState();
  const palette = getPalette(walker.novelId);
  const themeColors = buildTheme(palette);

  walker.art.innerHTML = buildMascotSVG(
    {
      ...state,
      paletteId: walker.novelId,
      mascot: { ...state.mascot, outfitId: walker.novelId, accessoryId: walker.novelId }
    },
    { decorative: true }
  );

  walker.element.style.setProperty('--theme-accent', palette.accent);
  walker.element.style.setProperty('--theme-accent-2', palette.accent2);
  walker.element.style.setProperty('--theme-accent-2-text', themeColors.accent2Text);
  walker.element.style.setProperty('--theme-bg', palette.bg);
  walker.element.dataset.accessory = walker.novelId;
}

/** Ручная настройка цвета головы и тела маскота видна и дворникам. */
function syncWalkerColors() {
  const state = getState();

  walkers.forEach((walker) => {
    const svg = walker.art ? walker.art.querySelector('svg') : null;
    if (!svg) return;
    svg.style.setProperty('--mascot-head', state.mascot.headColor);
    svg.style.setProperty('--mascot-body', state.mascot.bodyColor);
  });
}

/** Маскот выходит туда, где ближе лепестки, но не с той стороны, где уже дворник. */
function chooseWalkDirection() {
  const active = walkers.filter((walker) => walker.phase !== 'away');
  const leftBusy = active.some((walker) => walker.x < width * 0.3);
  const rightBusy = active.some((walker) => walker.x > width * 0.7);

  if (leftBusy !== rightBusy) return leftBusy ? -1 : 1;

  let direction = Math.random() < 0.5 ? 1 : -1;
  let shortest = Infinity;

  resting.forEach((flake) => {
    const distance = Math.min(flake.x, width - flake.x);
    if (distance < shortest) {
      shortest = distance;
      direction = flake.x > width / 2 ? -1 : 1;
    }
  });

  return direction;
}

/** Ширина спрайта зависит от экрана: на мобильном маскоты мельче. */
function measureWalker(walker) {
  walker.width = walker.element.offsetWidth || WALKER_WIDTH;
}

function paintWalker(walker) {
  const offsetX = walker.x - walker.width / 2;
  const offsetY = (1 - walker.peek) * WALKER_PEEK_OFFSET - walker.hop;
  walker.element.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0) scaleX(${walker.direction})`;
}

/** Маскот выглядывает из-за нижней кромки: уборщик идёт, прыгун скачет на месте. */
function startWalker(walker) {
  measureWalker(walker);

  walker.phase = 'rising';
  walker.peek = 0;
  walker.wait = 0;
  walker.hop = 0;
  walker.hopTime = 0;
  walker.direction = chooseWalkDirection();
  walker.speed = randomRange(WALKER_SPEEDS);
  walker.x = walker.direction > 0 ? 30 : width - 30;
  walker.turns =
    walker.mode === 'clean' && Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 2) : 0;
  walker.turnPoint = 40 + Math.random() * 44;
  walker.blockedFor = 0;
  walker.nextTalk = sceneTime + 5;

  if (walker.mode === 'jump') {
    /* прыгун появляется в произвольном месте, но подальше от соседей */
    const others = walkers.filter((other) => other !== walker && other.phase !== 'away');
    let bestX = 90 + Math.random() * Math.max(0, width - 180);
    let bestDistance = -1;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const candidate = 90 + Math.random() * Math.max(0, width - 180);
      const distance = others.reduce(
        (min, other) => Math.min(min, Math.abs(other.x - candidate)),
        width
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        bestX = candidate;
      }
    }

    walker.x = bestX;
    walker.direction = Math.random() < 0.5 ? 1 : -1;
    walker.jumpLeft = randomRange(WALKER_JUMP_TIME);
  }

  walker.element.dataset.state = 'walking';
  walker.element.dataset.direction = walker.direction > 0 ? 'right' : 'left';

  if (walker.mode === 'clean') {
    /* медленный дворник шагает неторопливо: и шаг, и метла — плавные */
    const step = clamp(0.95 - walker.speed / 400, 0.55, 0.85);
    if (walker.art) walker.art.style.animationDuration = `${step.toFixed(2)}s`;
    if (walker.broom) walker.broom.style.animationDuration = `${(step * 2.6).toFixed(2)}s`;
  }

  paintWalker(walker);
}

function finishWalker(walker) {
  walker.phase = 'away';
  walker.peek = 0;
  walker.hop = 0;
  walker.nextAt = sceneTime + randomRange(WALKER_PAUSE);
  walker.element.dataset.state = 'away';
  paintWalker(walker);
}

/** Метла задевает лепестки впереди маскота: они вспархивают и гаснут. */
function sweepPetals(x) {
  for (let index = resting.length - 1; index >= 0; index -= 1) {
    const flake = resting[index];
    if (Math.abs(flake.x - x) > WALKER_BROOM_REACH) continue;

    resting.splice(index, 1);
    flake.phase = 'swept';
    flake.sweepTime = 0;
    flake.sweepVy = -46 - Math.random() * 26;
    flake.sweepVx = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 24);
    sweptTotal += 1;
  }
}

/** Двое маскотов рядом — можно обменяться короткой репликой. */
function findMeetingPair() {
  const active = walkers.filter(
    (walker) => walker.phase === 'walking' || walker.phase === 'jumping'
  );

  for (let first = 0; first < active.length; first += 1) {
    for (let second = first + 1; second < active.length; second += 1) {
      const a = active[first];
      const b = active[second];
      if (Math.abs(a.x - b.x) > TALK_DISTANCE) continue;
      if (sceneTime < a.nextTalk || sceneTime < b.nextTalk) continue;
      return [a, b];
    }
  }

  return null;
}

function positionBubble(walker, side) {
  if (!walker.bubble) return;

  /* реплики разводим в стороны: левый маскот говорит слева, правый — справа */
  const bubbleWidth = walker.bubble.offsetWidth || 120;
  const gap = walker.width / 2 + 6;
  const edge = side === 'left' ? walker.x - gap : walker.x + gap;
  const left =
    side === 'left'
      ? clamp(edge, bubbleWidth + 8, width - 8)
      : clamp(edge, 8, width - bubbleWidth - 8);

  walker.bubble.style.left = `${left.toFixed(1)}px`;
}

function showBubble(walker, text, side) {
  if (!walker.bubble) return;

  walker.bubble.textContent = text;
  walker.bubble.dataset.side = side;
  walker.bubble.dataset.visible = 'true';
  positionBubble(walker, side);
}

/** Если пара стоит у края, сдвигаем её внутрь, чтобы обе реплики поместились. */
function fitTalk(left, right) {
  if (!left.bubble || !right.bubble) return;

  const leftNeed = (left.bubble.offsetWidth || 120) + 8 + left.width / 2 + 6;
  const rightNeed = (right.bubble.offsetWidth || 120) + 8 + right.width / 2 + 6;
  const leftSpace = left.x - leftNeed;
  const rightSpace = width - rightNeed - right.x;

  let shift = 0;
  if (leftSpace < 0 && rightSpace < 0) {
    shift = width / 2 - (left.x + right.x) / 2;
  } else if (leftSpace < 0) {
    shift = -leftSpace;
  } else if (rightSpace < 0) {
    shift = rightSpace;
  }

  if (!shift) return;

  left.x = clamp(left.x + shift, left.width / 2 + 8, width - left.width / 2 - 8);
  right.x = clamp(right.x + shift, right.width / 2 + 8, width - right.width / 2 - 8);
  paintWalker(left);
  paintWalker(right);
  positionBubble(left, 'left');
  positionBubble(right, 'right');
}

function hideBubble(walker) {
  if (walker.bubble) walker.bubble.dataset.visible = 'false';
}

function startMeeting(a, b) {
  if (meeting) return;

  const left = a.x <= b.x ? a : b;
  const right = left === a ? b : a;
  meeting = { a: left, b: right, until: sceneTime + TALK_TIME };

  [left, right].forEach((walker) => {
    walker.savedPhase = walker.phase === 'jumping' ? 'jumping' : 'walking';
    walker.phase = 'meeting';
  });

  /* маскоты поворачиваются друг к другу */
  left.direction = 1;
  right.direction = -1;
  paintWalker(left);
  paintWalker(right);

  const talk = TALKS[Math.floor(Math.random() * TALKS.length)];
  showBubble(left, t(talk[0]), 'left');
  showBubble(right, t(talk[1]), 'right');
  fitTalk(left, right);
}

function updateMeeting() {
  if (!meeting || sceneTime < meeting.until) return;

  const left = meeting.a;
  const right = meeting.b;

  [left, right].forEach((walker, index) => {
    hideBubble(walker);
    walker.phase = walker.savedPhase;
    /* после разговора маскоты расходятся в разные стороны */
    walker.direction = index === 0 ? -1 : 1;
    walker.element.dataset.direction = walker.direction > 0 ? 'right' : 'left';
    walker.nextTalk = sceneTime + TALK_COOLDOWN;
    paintWalker(walker);
  });

  meeting = null;
  meetCooldown = sceneTime + 8;
}

function resetMeeting() {
  if (!meeting) return;
  hideBubble(meeting.a);
  hideBubble(meeting.b);
  meeting = null;
}

function updateWalker(walker, dt) {
  if (walker.phase === 'away' || walker.phase === 'meeting') return;

  if (walker.phase === 'rising') {
    walker.peek = Math.min(1, walker.peek + dt / WALKER_RISE_TIME);
    if (walker.peek >= 1) {
      if (walker.mode === 'jump') {
        walker.phase = 'jumping';
        walker.hopTime = 0;
      } else {
        walker.phase = 'looking';
        walker.wait = WALKER_LOOK_TIME;
      }
    }
    paintWalker(walker);
    return;
  }

  if (walker.phase === 'looking') {
    walker.wait -= dt;
    if (walker.wait <= 0) walker.phase = 'walking';
    paintWalker(walker);
    return;
  }

  if (walker.phase === 'jumping') {
    walker.hopTime += dt;
    walker.hop =
      Math.abs(Math.sin(walker.hopTime * Math.PI * WALKER_HOP_RATE)) * WALKER_HOP_HEIGHT;
    walker.jumpLeft -= dt;
    paintWalker(walker);
    if (walker.jumpLeft <= 0) finishWalker(walker);
    return;
  }

  /* не наступаем на соседа: ждём, а если застряли — разворачиваемся */
  const crowded = walkers.some((other) => {
    if (other === walker || other.phase === 'away') return false;
    return Math.abs(other.x - walker.x) < 56;
  });

  if (crowded) {
    walker.blockedFor += dt;
    if (walker.blockedFor > 2.5) {
      walker.blockedFor = 0;
      walker.direction *= -1;
      walker.element.dataset.direction = walker.direction > 0 ? 'right' : 'left';
      walker.turns = Math.max(walker.turns, 1);
    }
    paintWalker(walker);
    return;
  }

  walker.blockedFor = 0;
  walker.x += walker.direction * walker.speed * dt;

  /* дворник может дойти до края и повернуть обратно — «туда-сюда» */
  if (walker.mode === 'clean' && walker.turns > 0) {
    const atEdge =
      walker.direction > 0
        ? walker.x > width - walker.turnPoint
        : walker.x < walker.turnPoint;
    if (atEdge) {
      walker.turns -= 1;
      walker.direction *= -1;
      walker.x = clamp(walker.x, walker.turnPoint, width - walker.turnPoint);
      walker.element.dataset.direction = walker.direction > 0 ? 'right' : 'left';
    }
  }

  sweepPetals(walker.x + walker.direction * 28);
  paintWalker(walker);

  const outOfField =
    walker.direction > 0 ? walker.x > width + WALKER_MARGIN : walker.x < -WALKER_MARGIN;
  if (outOfField) finishWalker(walker);
}

function updateWalkers(dt) {
  if (!walkers.length) return;

  if (!meeting && sceneTime >= meetCooldown) {
    const pair = findMeetingPair();
    if (pair) startMeeting(pair[0], pair[1]);
  }
  updateMeeting();

  let freeSlots = Math.max(
    0,
    WALKER_MAX_ACTIVE - walkers.filter((walker) => walker.phase !== 'away').length
  );

  walkers.forEach((walker) => {
    if (walker.phase === 'away') {
      if (sceneTime >= walker.nextAt && freeSlots > 0) {
        startWalker(walker);
        freeSlots -= 1;
      }
      return;
    }

    updateWalker(walker, dt);
  });
}

/* -------------------------------------------------------------- отрисовка */

/** Задний слой: только падающие лепестки, уходят за контент. */
function paintFallingLayer() {
  ctx.clearRect(0, 0, width, height);

  flakes.forEach((flake) => {
    if (flake.phase === 'fall') paintFlake(ctx, flake);
  });
}

/** Передний нижний слой: линия горизонта и убранные на землю лепестки. */
function paintFloorLayer() {
  if (!floorCtx) return;
  floorCtx.clearRect(0, 0, width, height);

  floorCtx.fillStyle = theme ? theme.line : 'rgba(255, 255, 255, 0.12)';
  floorCtx.fillRect(0, Math.round(floorY), width, 1);

  flakes.forEach((flake) => {
    if (flake.phase !== 'fall') paintFlake(floorCtx, flake);
  });
}

/** dt = 0 рисует кадр без движения — так работает статичный режим. */
function render(dt) {
  if (!ctx) return;

  if (dt > 0) flakes.forEach((flake) => updateFlake(flake, dt));

  paintFallingLayer();
  paintFloorLayer();
}

function stop() {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
}

function tick(now) {
  rafId = requestAnimationFrame(tick);
  if (!lastTime) {
    lastTime = now;
    return;
  }

  /* кадр не длиннее 50 мс: после «сна» вкладки лепестки не прыгают */
  const dt = clamp((now - lastTime) / 1000, 0.001, 0.05);
  lastTime = now;
  sceneTime += dt;

  updateWalkers(dt);
  render(dt);
}

function start() {
  if (staticMode || rafId) return;
  lastTime = 0;
  rafId = requestAnimationFrame(tick);
}

/* ------------------------------------------------------------- пересборка */

/** Собирает сцену с нуля: новые лепестки, земля, маскоты. */
function rebuild() {
  const palette = getPalette(getState().paletteId);
  theme = buildTheme(palette);
  config = PETAL_THEMES[palette.id] || FALLBACK_CONFIG;
  sprites = buildSprites(theme, config);

  resting.length = 0;
  flakes = buildFlakes(staticMode ? STILL_DENSITY : 1);

  if (canvas) canvas.dataset.palette = palette.id;
  walkers.forEach((walker) => renderWalkerArt(walker));
  render(0);
}

/**
 * Меняет тему, не пересоздавая лепестки: те же точки на экране получают
 * спрайты и оттенки новой палитры, поэтому со сменой цвета ничего не пропадает.
 */
function recolor() {
  const palette = getPalette(getState().paletteId);
  const nextTheme = buildTheme(palette);
  const nextConfig = PETAL_THEMES[palette.id] || FALLBACK_CONFIG;

  theme = nextTheme;
  config = nextConfig;
  sprites = buildSprites(nextTheme, nextConfig);

  flakes.forEach((flake) => {
    const sprite = pickOne(sprites);
    const scale = pickOne(nextConfig.scale);
    flake.sprite = sprite;
    flake.w = sprite.width * scale;
    flake.h = sprite.height * scale;
  });

  resting.forEach((flake) => {
    flake.y = floorY - flake.h / 2;
  });

  if (canvas) canvas.dataset.palette = palette.id;
  render(0);
}

function refreshLayout() {
  stop();
  measure();
  updateFloor();

  if (staticMode) {
    resetMeeting();
    walkers.forEach((walker) => {
      walker.phase = 'away';
      walker.peek = 0;
      walker.element.dataset.state = 'away';
    });
  }

  rebuild();
  if (!staticMode) start();
  if (canvas) canvas.classList.add('petals--visible');
  if (floorCanvas) floorCanvas.classList.add('petal-floor--visible');
}

function handleResize() {
  const previousWidth = width;
  const previousHeight = height;
  const previousArea = previousWidth * previousHeight;

  measure();
  updateFloor();

  const scale = previousArea > 0 ? (width * height) / previousArea : 1;

  if (scale > 1.4 || scale < 0.7) {
    /* сильно другой экран — пересобираем плотность */
    resting.length = 0;
    flakes = buildFlakes(staticMode ? STILL_DENSITY : 1);
  } else {
    /* лёгкое изменение (адресная строка на мобильном) — только переносим */
    const ratioX = width / previousWidth;
    const ratioY = height / previousHeight;
    flakes.forEach((flake) => {
      flake.x *= ratioX;
      flake.y *= ratioY;
    });
    resting.forEach((flake) => {
      flake.y = floorY - flake.h / 2;
    });
  }

  /* на узком экране маскоты мельче: пересчитываем их ширину и позицию */
  walkers.forEach((walker) => {
    measureWalker(walker);
    if (walker.phase !== 'away') paintWalker(walker);
  });

  render(0);
}

/* ---------------------------------------------------------------- запуск */

export function initPetals() {
  if (initialized) return;

  canvas = document.getElementById('petals');
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  if (!ctx) {
    /* без 2D-контекста сцена просто не рисуется — сайт работает как раньше */
    canvas.hidden = true;
    return;
  }

  floorCanvas = document.getElementById('petal-floor');
  if (floorCanvas) {
    floorCtx = floorCanvas.getContext('2d');
    if (!floorCtx) floorCanvas.hidden = true;
  }

  walkersLayer = document.getElementById('petal-walkers');
  footer = document.getElementById('site-footer');

  buildWalkers();

  initialized = true;
  staticMode = prefersReducedMotion();
  refreshLayout();

  const debouncedResize = debounce(handleResize, RESIZE_DELAY);
  window.addEventListener('resize', debouncedResize, { passive: true });
  window.addEventListener('orientationchange', debouncedResize, { passive: true });

  /* при прокрутке пол переезжает к верхней границе подвала */
  window.addEventListener(
    'scroll',
    () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        updateFloor();
        render(0);
      });
    },
    { passive: true }
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener('beforeprint', stop);
  window.addEventListener('afterprint', start);

  subscribeTo(['paletteId'], () => {
    recolor();
  });

  subscribeTo(['mascot'], () => {
    syncWalkerColors();
  });

  onReducedMotionChange((matches) => {
    staticMode = matches;
    refreshLayout();
  });
}

/* Служебная точка для проверки сценария в консоли и в tools/verify.mjs. */
export const petalsDebug = Object.freeze({
  state() {
    return {
      palette: canvas ? canvas.dataset.palette || '' : '',
      flakes: flakes.length,
      resting: resting.length,
      swept: sweptTotal,
      layout: layoutHash(),
      floorY: Math.round(floorY),
      footerTop: footer ? Math.round(footer.getBoundingClientRect().top) : null,
      bubbles: walkers.filter(
        (walker) => walker.bubble && walker.bubble.dataset.visible === 'true'
      ).length,
      meeting: Boolean(meeting),
      walking: walkers.some((walker) => walker.phase !== 'away'),
      walkers: walkers.map((walker) => ({
        novel: walker.novelId,
        mode: walker.mode,
        phase: walker.phase,
        x: Math.round(walker.x)
      })),
      reduced: staticMode
    };
  },
  walk(mode) {
    if (staticMode) return;
    /* по умолчанию выпускаем дворника: прыгуны лепестки не трогают */
    const preferred =
      walkers.find((walker) => walker.phase === 'away' && walker.mode === (mode || 'clean')) ||
      walkers.find((walker) => walker.phase === 'away');
    if (preferred) startWalker(preferred);
  },
  /** Служебное: свести двух маскотов для проверки диалога. */
  greet() {
    if (staticMode || meeting) return;

    let active = walkers.filter(
      (walker) => walker.phase === 'walking' || walker.phase === 'jumping'
    );

    if (active.length < 2) {
      walkers
        .filter((walker) => walker.phase === 'away')
        .slice(0, 2 - active.length)
        .forEach((walker) => {
          startWalker(walker);
          walker.phase = 'walking';
          walker.peek = 1;
          paintWalker(walker);
        });
      active = walkers.filter(
        (walker) => walker.phase === 'walking' || walker.phase === 'jumping'
      );
    }

    if (active.length < 2) return;
    active[1].x = active[0].x + 70;
    paintWalker(active[1]);
    startMeeting(active[0], active[1]);
  }
});
