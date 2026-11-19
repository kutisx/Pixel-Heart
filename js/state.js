/* =========================================================================
   state.js — единственное место, где живёт состояние брендбука.
   Любой модуль читает getState(), пишет setState(patch) и подписывается
   на изменения через subscribe(). Никаких прямых мутаций объекта.
   ========================================================================= */

import {
  ACCESSORY_IDS,
  FONT_IDS,
  LANG_IDS,
  LAYOUT_IDS,
  NOVEL_IDS,
  OUTFIT_IDS,
  PALETTE_IDS
} from './data.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/* Старое демо-значение головы маскота: черновики пользователей нужно мягко
   перевести на новый брендовый цвет, иначе «по умолчанию» останется розовым. */
const LEGACY_HEAD_COLOR = '#FFD1E6';
const DEFAULT_HEAD_COLOR = '#B92222';

const LIMITS = {
  name: 120,
  slogan: 200,
  audience: 600,
  goal: 600,
  character: 80,
  previewText: 400,
  quoteText: 300,
  fontSize: [16, 96],
  fontWeight: [300, 800]
};

export const demoState = {
  name: 'Pixel Heart',
  slogan: 'Истории, которые светятся в темноте',
  audience: 'Фанаты визуальных новелл и инди-разработчики',
  goal: 'Показать, что бренд адаптируется под разные жанры и вовлекает в сотворчество',
  character: 'Тёмный, техно, отомэ',
  activeNovelId: 'doki',
  paletteId: 'doki',
  /* Тема предпросмотра: если задана, макеты и карточка маскота показывают её,
     а основной вид сайта продолжает жить на paletteId. */
  previewPaletteId: null,
  /* true — финальная тема зафиксирована для PDF: карусель больше не меняет
     paletteId, пока пользователь сам не выберет другую тему. */
  paletteLocked: false,
  fontId: 'pixelify',
  fontSize: 48,
  fontWeight: 600,
  layoutId: 'classic',
  previewText: 'Даже в темноте история найдёт свет.',
  quoteText: 'Даже в темноте история найдёт свет.',
  lang: 'ru',
  mascot: {
    headColor: DEFAULT_HEAD_COLOR,
    bodyColor: '#2A1A2E',
    outfitId: 'doki',
    accessoryId: 'doki'
  },
  /* Расширение к ТЗ: флаг нужен, чтобы карусель меняла вариант маскота,
     но не затирала ручную настройку пользователя. */
  mascotTouched: false
};

function cloneDemo() {
  return {
    ...demoState,
    mascot: { ...demoState.mascot }
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function pickString(value, fallback, maxLength) {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLength);
}

function pickHex(value, fallback) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Приводит любой внешний объект (localStorage, старый черновик) к валидной
 * форме состояния. Не бросает исключений — просто подставляет демо-значения.
 */
export function normalizeState(raw) {
  const base = cloneDemo();
  if (!isPlainObject(raw)) return base;

  const mascot = isPlainObject(raw.mascot) ? raw.mascot : {};
  const headColor = pickHex(mascot.headColor, base.mascot.headColor);

  return {
    name: pickString(raw.name, base.name, LIMITS.name),
    slogan: pickString(raw.slogan, base.slogan, LIMITS.slogan),
    audience: pickString(raw.audience, base.audience, LIMITS.audience),
    goal: pickString(raw.goal, base.goal, LIMITS.goal),
    character: pickString(raw.character, base.character, LIMITS.character),
    activeNovelId: pickEnum(raw.activeNovelId, NOVEL_IDS, base.activeNovelId),
    paletteId: pickEnum(raw.paletteId, PALETTE_IDS, base.paletteId),
    previewPaletteId:
      raw.previewPaletteId == null
        ? null
        : pickEnum(raw.previewPaletteId, PALETTE_IDS, null),
    paletteLocked: Boolean(raw.paletteLocked),
    fontId: pickEnum(raw.fontId, FONT_IDS, base.fontId),
    fontSize: clampNumber(raw.fontSize, LIMITS.fontSize[0], LIMITS.fontSize[1], base.fontSize),
    fontWeight: clampNumber(raw.fontWeight, LIMITS.fontWeight[0], LIMITS.fontWeight[1], base.fontWeight),
    layoutId: pickEnum(raw.layoutId, LAYOUT_IDS, base.layoutId),
    previewText: pickString(raw.previewText, base.previewText, LIMITS.previewText),
    quoteText: pickString(raw.quoteText, base.quoteText, LIMITS.quoteText),
    lang: pickEnum(raw.lang, LANG_IDS, base.lang),
    mascot: {
      headColor:
        headColor.toUpperCase() === LEGACY_HEAD_COLOR
          ? base.mascot.headColor
          : headColor,
      bodyColor: pickHex(mascot.bodyColor, base.mascot.bodyColor),
      outfitId: pickEnum(mascot.outfitId, OUTFIT_IDS, base.mascot.outfitId),
      accessoryId: pickEnum(mascot.accessoryId, ACCESSORY_IDS, base.mascot.accessoryId)
    },
    mascotTouched: Boolean(raw.mascotTouched)
  };
}

let state = cloneDemo();
const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Подписка только на перечисленные ключи состояния.
 * Удобно модулям: каждый реагирует лишь на свои данные.
 */
export function subscribeTo(keys, listener) {
  const list = Array.isArray(keys) ? keys : [keys];
  return subscribe((next, meta) => {
    if (!list.length || meta.changed.some((key) => list.includes(key))) {
      listener(next, meta);
    }
  });
}

function notify(prev, changed) {
  listeners.forEach((listener) => {
    try {
      listener(state, { prev, changed, state });
    } catch (error) {
      console.error('[state] listener failed', error);
    }
  });
}

function shallowEqual(a, b) {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/**
 * Частичное обновление. Вложенный mascot мержится, числа зажимаются в диапазон.
 * Возвращает актуальное состояние.
 */
export function setState(patch = {}) {
  if (!isPlainObject(patch)) return state;

  const prev = state;
  const next = { ...state };
  const changed = [];

  Object.keys(patch).forEach((key) => {
    if (!(key in demoState)) return;
    if (key === 'mascot') return;
    let value = patch[key];

    if (key === 'fontSize') {
      value = clampNumber(value, LIMITS.fontSize[0], LIMITS.fontSize[1], state.fontSize);
    } else if (key === 'fontWeight') {
      value = clampNumber(value, LIMITS.fontWeight[0], LIMITS.fontWeight[1], state.fontWeight);
    } else if (key === 'mascotTouched' || key === 'paletteLocked') {
      value = Boolean(value);
    } else if (key === 'previewPaletteId') {
      value =
        value == null || value === ''
          ? null
          : pickEnum(value, PALETTE_IDS, state.previewPaletteId || null);
    } else if (typeof state[key] === 'string') {
      value = typeof value === 'string' ? value : state[key];
    }

    if (!shallowEqual(value, state[key])) {
      next[key] = value;
      changed.push(key);
    }
  });

  if (isPlainObject(patch.mascot)) {
    const mascot = { ...state.mascot };
    let mascotChanged = false;

    Object.keys(patch.mascot).forEach((key) => {
      if (!(key in demoState.mascot)) return;
      const value = patch.mascot[key];
      const safe =
        key === 'headColor' || key === 'bodyColor'
          ? pickHex(value, state.mascot[key])
          : pickEnum(value, key === 'outfitId' ? OUTFIT_IDS : ACCESSORY_IDS, state.mascot[key]);
      if (safe !== state.mascot[key]) {
        mascot[key] = safe;
        mascotChanged = true;
      }
    });

    if (mascotChanged) {
      next.mascot = mascot;
      changed.push('mascot');
    }
  }

  if (!changed.length) return state;

  state = next;
  notify(prev, changed);
  return state;
}

/** Полный сброс к демо-данным. Уведомляет подписчиков обо всех ключах. */
export function resetState() {
  const prev = state;
  state = cloneDemo();
  notify(prev, ['*', ...Object.keys(demoState)]);
  return state;
}
