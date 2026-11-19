/* =========================================================================
   app.js — точка входа: загрузка черновика, тема, язык, печать, сброс.
   Модули ниже импортируются здесь; сами они общаются только через state.js.
   ========================================================================= */

import { DEMO_COPY, getPalette } from './data.js';
import { getState, resetState, setState, subscribe, subscribeTo } from './state.js';
import { clear, flushSave, load, onStorageStatus, save } from './storage.js';
import { t, translateDom } from './i18n.js';
import { applyTheme } from './theme.js';
import { escapeHtml } from './utils.js';

import { initHero } from './hero.js';
import { initBrief } from './brief.js';
import { initColor } from './color.js';
import { initTypography } from './typography.js';
import { initMascot } from './mascot.js';
import { initLayouts } from './layouts.js';
import { initFinal } from './final.js';
import { initThemePickers } from './themepicker.js';

let toastElement = null;
let toastText = null;
let toastKey = null;
let toastError = false;
let toastTimer = null;
let suspendSave = false;
let booted = false;

const STATUS_MESSAGES = {
  restored: { key: 'status.restored', error: false },
  corrupt: { key: 'status.corrupt', error: true },
  unavailable: { key: 'status.unavailable', error: true },
  quota: { key: 'status.quota', error: true },
  cleared: { key: 'status.reset', error: false }
};

function hideToast() {
  if (!toastElement) return;
  toastElement.hidden = true;
  toastElement.classList.remove('status-toast--error');
  toastKey = null;
}

function showToast(key, { error = false, autoHide = true } = {}) {
  if (!toastElement || !toastText) return;
  toastKey = key;
  toastError = error;
  toastText.textContent = t(key);
  toastElement.hidden = false;
  toastElement.classList.toggle('status-toast--error', error);

  if (toastTimer) clearTimeout(toastTimer);
  if (autoHide && !error) {
    toastTimer = setTimeout(hideToast, 7000);
  }
}

function refreshToastLanguage() {
  if (!toastElement || toastElement.hidden || !toastKey) return;
  toastText.textContent = t(toastKey);
}

function handleStorageStatus(status) {
  const entry = STATUS_MESSAGES[status];
  if (!entry) return;
  showToast(entry.key, { error: entry.error });
}

function safeInit(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`[app] init ${name} failed`, error);
  }
}

function bindLanguage() {
  const buttons = Array.from(document.querySelectorAll('.lang-switch__btn'));

  const sync = () => {
    const lang = getState().lang;
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.lang === lang ? 'true' : 'false');
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const state = getState();
      const nextLang = button.dataset.lang;
      if (nextLang === state.lang) return;

      const patch = { lang: nextLang };
      const previousCopy = DEMO_COPY[state.lang] || DEMO_COPY.ru;
      const nextCopy = DEMO_COPY[nextLang] || DEMO_COPY.ru;

      /* Меняем только нетронутые демо-тексты: любой ввод пользователя остаётся. */
      ['name', 'slogan'].forEach((key) => {
        if (state[key] === previousCopy[key]) patch[key] = nextCopy[key];
      });

      setState(patch);
    });
  });

  sync();
  subscribeTo(['lang'], sync);
}

function bindPrint() {
  const closeEditor = () => {
    const dialog = document.getElementById('mascot-editor');
    if (dialog && dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    }
  };

  const print = () => {
    closeEditor();
    window.print();
  };

  ['print-page', 'print-page-final'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', print);
  });

  window.addEventListener('beforeprint', closeEditor);
}

function bindReset() {
  const reset = () => {
    suspendSave = true;
    clear();
    resetState();
    translateDom();
    document.documentElement.lang = getState().lang;
    setTimeout(() => {
      suspendSave = false;
    }, 0);
  };

  ['reset-all', 'reset-footer'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', reset);
  });
}

function bindToast() {
  toastElement = document.getElementById('status-toast');
  toastText = document.getElementById('status-text');
  const close = document.getElementById('status-close');

  if (close) {
    close.addEventListener('click', hideToast);
  }
}

function boot() {
  if (booted) return;
  booted = true;

  bindToast();
  onStorageStatus(handleStorageStatus);

  const loaded = load();
  if (loaded.ok && loaded.state) {
    setState(loaded.state);
  }

  applyTheme(getPalette(getState().paletteId));
  translateDom();
  bindLanguage();
  bindPrint();
  bindReset();

  safeInit('hero', initHero);
  safeInit('brief', initBrief);
  safeInit('color', initColor);
  safeInit('typography', initTypography);
  safeInit('mascot', initMascot);
  safeInit('layouts', initLayouts);
  safeInit('final', initFinal);
  safeInit('themePickers', initThemePickers);

  /* Тема и сохранение — после того как модули построили интерфейс. */
  subscribeTo(['paletteId'], (state) => {
    applyTheme(getPalette(state.paletteId));
  });

  subscribe((state) => {
    if (suspendSave) return;
    save(state);
  });

  subscribeTo(['lang'], () => {
    translateDom();
    refreshToastLanguage();
  });

  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushSave();
  });

  /* Служебная точка для ручной проверки сценариев в консоли. */
  try {
    Object.defineProperty(window, 'pixelHeart', {
      value: Object.freeze({
        getState,
        setState,
        resetState,
        esc: escapeHtml,
        version: '1.0.0'
      }),
      configurable: true
    });
  } catch (error) {
    /* не критично */
  }

  console.info(
    '%cPixel Heart%c учебный брендбук готов. Состояние: window.pixelHeart.getState()',
    'font-family:monospace;background:#1A0F16;color:#FF6FAE;padding:2px 6px;border-radius:4px',
    'color:#A7A3B8'
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
