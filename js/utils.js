/* =========================================================================
   utils.js — маленькие общие помощники без зависимостей.
   ========================================================================= */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** Экранирует пользовательский текст перед вставкой в HTML-шаблон. */
export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function debounce(fn, delay = 200) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
  debounced.flush = (...args) => {
    if (timer) clearTimeout(timer);
    timer = null;
    fn(...args);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function onReducedMotionChange(callback) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (event) => callback(event.matches);
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }
  query.addListener(handler);
  return () => query.removeListener(handler);
}

export function formatDate(locale) {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat(locale || 'ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(now);
  } catch (error) {
    return now.toISOString().slice(0, 10);
  }
}

export function formatTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    return date.toTimeString().slice(0, 5);
  }
}

/**
 * Подставляет значения в строку словаря: t('hero.dot', { n: 2, name: 'X' }).
 * Неизвестные плейсхолдеры остаются как есть, чтобы ошибка была заметной.
 */
export function interpolate(template, vars) {
  if (!vars) return template;
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Переносит фокус без прокрутки страницы. */
export function focusSilently(element) {
  if (!element || typeof element.focus !== 'function') return;
  try {
    element.focus({ preventScroll: true });
  } catch (error) {
    element.focus();
  }
}

/** Список элементов, доступных с клавиатуры внутри контейнера. */
export function focusableWithin(container) {
  if (!container) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  return qsa(selector, container).filter(
    (element) =>
      !element.hasAttribute('inert') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.offsetParent !== null
  );
}
