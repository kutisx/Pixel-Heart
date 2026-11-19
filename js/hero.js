/* =========================================================================
   hero.js — карусель новелл: лента, авто-переключение, клавиатура, точки.
   Смена слайда синхронизирует activeNovelId и paletteId в state.js, пока
   итоговая тема не зафиксирована для печати (paletteLocked).
   ========================================================================= */

import { getState, setState, subscribeTo } from './state.js';
import { NOVELS } from './data.js';
import { pick, t } from './i18n.js';
import { escapeHtml, onReducedMotionChange, prefersReducedMotion } from './utils.js';

const AUTOPLAY_MS = 7000;

let refs = null;
let slides = [];
let dots = [];
let index = 0;
let timer = null;
let pausedByPointer = false;
let pausedByFocus = false;
let reducedMotion = false;
let internalUpdate = false;
let initialized = false;

function heartArt() {
  return `
    <svg class="hero-slide__placeholder-art" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <rect x="8" y="6" width="6" height="3" />
        <rect x="18" y="6" width="6" height="3" />
        <rect x="6" y="9" width="20" height="4" />
        <rect x="8" y="13" width="16" height="3" />
        <rect x="10" y="16" width="12" height="3" />
        <rect x="13" y="19" width="6" height="3" />
        <rect x="15" y="22" width="2" height="2" />
      </g>
    </svg>`;
}

function placeholderMarkup(novel) {
  return `
    <div class="hero-slide__placeholder" role="img" aria-label="${escapeHtml(pick(novel.imageAlt))}">
      ${heartArt()}
      <p class="hero-slide__placeholder-title">${escapeHtml(novel.name)}</p>
      <p class="hero-slide__placeholder-note">${escapeHtml(t('hero.placeholder'))}</p>
      <p class="hero-slide__placeholder-path">${escapeHtml(t('hero.placeholderPath', { path: novel.image }))}</p>
    </div>`;
}

function slideMarkup(novel, position, total) {
  return `
    <div class="hero-slide__media" data-media></div>
    <div class="hero-slide__body">
      <p class="hero-slide__index">${String(position + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')} · ${escapeHtml(novel.name)}</p>
      <h2 class="hero-slide__title">${escapeHtml(novel.name)}</h2>
      <p class="hero-slide__tag">${escapeHtml(pick(novel.tag))}</p>
      <p class="hero-slide__blurb">${escapeHtml(pick(novel.blurb))}</p>
      <div class="hero-slide__actions">
        <button class="btn btn--primary" type="button" data-choose>
          <span>${escapeHtml(t('hero.choose'))}</span>
        </button>
      </div>
    </div>`;
}

function createSlide(novel, position) {
  const slide = document.createElement('article');
  slide.className = 'hero-slide';
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'slide');
  slide.setAttribute('aria-label', t('hero.dot', { n: position + 1, name: novel.name }));
  slide.innerHTML = slideMarkup(novel, position, NOVELS.length);

  const media = slide.querySelector('[data-media]');
  const image = document.createElement('img');
  image.className = 'hero-slide__image';
  image.alt = '';
  image.decoding = 'async';
  image.width = 1200;
  image.height = 800;
  image.loading = position === 0 ? 'eager' : 'lazy';
  image.addEventListener(
    'error',
    () => {
      if (!media) return;
      media.innerHTML = placeholderMarkup(novel);
    },
    { once: true }
  );
  image.src = novel.image;
  if (media) media.appendChild(image);

  const choose = slide.querySelector('[data-choose]');
  if (choose) {
    choose.addEventListener('click', () => {
      chooseTheme(novel);
    });
  }

  return slide;
}

function buildSlides() {
  if (!refs) return;
  refs.track.innerHTML = '';
  slides = NOVELS.map((novel, position) => {
    const slide = createSlide(novel, position);
    refs.track.appendChild(slide);
    return slide;
  });
}

function buildDots() {
  if (!refs) return;
  refs.dots.innerHTML = '';
  dots = NOVELS.map((novel, position) => {
    const dot = document.createElement('button');
    dot.className = 'hero__dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', t('hero.dot', { n: position + 1, name: novel.name }));
    dot.addEventListener('click', () => {
      goTo(position, { source: 'dot' });
    });
    refs.dots.appendChild(dot);
    return dot;
  });
}

function applySlide(nextIndex, { animate = true, announce = true } = {}) {
  if (!refs || !slides.length) return;
  index = nextIndex;

  refs.track.style.transition = animate && !reducedMotion ? '' : 'none';
  refs.track.style.transform = `translateX(-${index * 100}%)`;

  slides.forEach((slide, position) => {
    const active = position === index;
    slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    if (active) {
      slide.removeAttribute('inert');
    } else {
      slide.setAttribute('inert', '');
    }
  });

  dots.forEach((dot, position) => {
    if (position === index) {
      dot.setAttribute('aria-current', 'true');
    } else {
      dot.removeAttribute('aria-current');
    }
  });

  if (announce && refs.live) {
    refs.live.textContent = t('hero.live', {
      n: index + 1,
      total: NOVELS.length,
      name: NOVELS[index].name
    });
  }
}

function syncState(nextIndex) {
  const novel = NOVELS[nextIndex];
  const state = getState();
  const patch = { activeNovelId: novel.id };

  /* Пока итоговая тема не зафиксирована, карусель ведёт себя как раньше и
     меняет палитру вместе со слайдом. После фиксации в блоке «Итог» цвета
     остаются выбранными, а слайды продолжают листаться. */
  if (!state.paletteLocked) {
    patch.paletteId = novel.paletteId;
  }

  /* Пользователь уже собрал своего маскота — не затираем его настройки,
     но тему сайта всё равно меняем. */
  if (!state.mascotTouched) {
    patch.mascot = { outfitId: novel.id, accessoryId: novel.id };
  }

  internalUpdate = true;
  setState(patch);
  internalUpdate = false;
}

function chooseTheme(novel) {
  internalUpdate = true;
  const state = getState();
  /* Это осознанный выбор темы, поэтому он обновляет и предпросмотры.
     Если тема была зафиксирована для PDF, она остаётся зафиксированной. */
  const patch = {
    activeNovelId: novel.id,
    paletteId: novel.paletteId,
    previewPaletteId: novel.paletteId
  };
  if (!state.mascotTouched) {
    patch.mascot = { outfitId: novel.id, accessoryId: novel.id };
  }
  setState(patch);
  internalUpdate = false;

  const target = document.getElementById('brief');
  if (target) {
    target.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }
}

function goTo(nextIndex, { source = 'manual' } = {}) {
  const total = NOVELS.length;
  const wrapped = ((nextIndex % total) + total) % total;
  applySlide(wrapped, { animate: true, announce: true });
  syncState(wrapped);
  if (source !== 'auto') restartAutoplay();
}

function stopAutoplay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startAutoplay() {
  stopAutoplay();
  if (reducedMotion || pausedByPointer || pausedByFocus || document.hidden) return;
  timer = setInterval(() => {
    goTo(index + 1, { source: 'auto' });
  }, AUTOPLAY_MS);
}

function restartAutoplay() {
  startAutoplay();
}

function bindEvents() {
  const { hero, prev, next } = refs;

  prev.addEventListener('click', () => goTo(index - 1));
  next.addEventListener('click', () => goTo(index + 1));

  hero.addEventListener('pointerenter', () => {
    pausedByPointer = true;
    stopAutoplay();
  });

  hero.addEventListener('pointerleave', () => {
    pausedByPointer = false;
    startAutoplay();
  });

  hero.addEventListener('focusin', () => {
    pausedByFocus = true;
    stopAutoplay();
  });

  hero.addEventListener('focusout', (event) => {
    if (!hero.contains(event.relatedTarget)) {
      pausedByFocus = false;
      startAutoplay();
    }
  });

  hero.addEventListener('keydown', (event) => {
    const key = event.key;
    if (key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    } else if (key === 'Home') {
      event.preventDefault();
      goTo(0);
    } else if (key === 'End') {
      event.preventDefault();
      goTo(NOVELS.length - 1);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });

  onReducedMotionChange((matches) => {
    reducedMotion = matches;
    if (reducedMotion) {
      stopAutoplay();
      if (refs) refs.track.style.transition = 'none';
    } else {
      startAutoplay();
      if (refs) refs.track.style.transition = '';
    }
  });
}

function rebuild() {
  buildSlides();
  buildDots();
  applySlide(index, { animate: false, announce: false });
}

export function initHero() {
  if (initialized) return;
  const hero = document.getElementById('hero');
  if (!hero) return;

  refs = {
    hero,
    track: document.getElementById('hero-track'),
    dots: document.getElementById('hero-dots'),
    prev: document.getElementById('hero-prev'),
    next: document.getElementById('hero-next'),
    live: document.getElementById('hero-live')
  };

  if (!refs.track || !refs.dots || !refs.prev || !refs.next) return;

  reducedMotion = prefersReducedMotion();

  const state = getState();
  const found = NOVELS.findIndex((novel) => novel.id === state.activeNovelId);
  index = found >= 0 ? found : 0;

  buildSlides();
  buildDots();
  bindEvents();
  applySlide(index, { animate: false, announce: false });
  startAutoplay();

  subscribeTo(['activeNovelId', 'lang'], (next, meta) => {
    if (meta.changed.includes('lang')) {
      rebuild();
    } else if (!internalUpdate) {
      const target = NOVELS.findIndex((novel) => novel.id === next.activeNovelId);
      if (target >= 0 && target !== index) {
        applySlide(target, { animate: false, announce: false });
      }
    }
    if (!internalUpdate) {
      restartAutoplay();
    }
  });

  initialized = true;
}
