/* =========================================================================
   brief.js — поля брифа и живая миниатюра.
   Валидация мягкая: подсказка появляется на blur/отправке, а не на каждом
   нажатии. Ввод пишется в state.js и сразу расходится по всем модулям.
   ========================================================================= */

import { getPalette } from './data.js';
import { getState, setState, subscribeTo } from './state.js';
import { t } from './i18n.js';
import { escapeHtml } from './utils.js';

const FIELDS = [
  { key: 'name', id: 'brand-name', required: true, errorKey: 'brief.nameError' },
  { key: 'slogan', id: 'brand-slogan', required: true, errorKey: 'brief.sloganError' },
  { key: 'audience', id: 'brand-audience', required: false },
  { key: 'goal', id: 'brand-goal', required: false },
  { key: 'character', id: 'brand-character', required: false }
];

const invalid = new Set();
let form = null;
let memo = null;
let fields = [];

function memoMarkup(state) {
  const palette = getPalette(state.paletteId);
  const name = state.name.trim();
  const slogan = state.slogan.trim();
  const character = state.character.trim();

  const dots = [palette.bg, palette.text, palette.accent, palette.accent2]
    .map((color) => `<span class="memo__dot" style="background:${color}"></span>`)
    .join('');

  return `
    <div class="memo__top">
      <span class="memo__logo" aria-hidden="true">
        <svg viewBox="0 0 32 32" focusable="false">
          <g fill="currentColor">
            <rect x="8" y="6" width="6" height="3" />
            <rect x="18" y="6" width="6" height="3" />
            <rect x="6" y="9" width="20" height="4" />
            <rect x="8" y="13" width="16" height="3" />
            <rect x="10" y="16" width="12" height="3" />
            <rect x="13" y="19" width="6" height="3" />
            <rect x="15" y="22" width="2" height="2" />
          </g>
        </svg>
      </span>
      <span class="memo__brand">Pixel Heart · ${escapeHtml(t('brief.memoBrand'))}</span>
    </div>
    <p class="memo__name"${name ? '' : ' data-empty="true"'}>${escapeHtml(name || t('final.empty'))}</p>
    <p class="memo__slogan"${slogan ? '' : ' data-empty="true"'}>${escapeHtml(slogan || t('brief.sloganPlaceholder'))}</p>
    <div class="memo__foot">
      <span class="memo__character">${escapeHtml(character || t('brief.characterEmpty'))}</span>
      <span class="memo__dots" aria-hidden="true">${dots}</span>
    </div>`;
}

function renderMemo() {
  if (!memo) return;
  memo.innerHTML = memoMarkup(getState());
}

function renderField(field) {
  const state = getState();
  const input = document.getElementById(field.id);
  if (!input) return;

  const value = state[field.key];
  if (document.activeElement !== input && input.value !== value) {
    input.value = value;
  }

  const errorElement = document.getElementById(`${field.id}-error`);
  const hasError = invalid.has(field.key);

  if (hasError) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }

  if (errorElement) {
    if (hasError) {
      errorElement.textContent = t(field.errorKey);
      errorElement.hidden = false;
    } else {
      errorElement.hidden = true;
      errorElement.textContent = '';
    }
  }
}

function validateField(field, { focus = false } = {}) {
  const state = getState();
  const value = String(state[field.key] || '').trim();

  if (field.required && !value) {
    invalid.add(field.key);
    renderField(field);
    if (focus) {
      const input = document.getElementById(field.id);
      if (input) input.focus();
    }
    return false;
  }

  invalid.delete(field.key);
  renderField(field);
  return true;
}

function validateAll() {
  let firstInvalid = null;
  FIELDS.filter((field) => field.required).forEach((field) => {
    const ok = validateField(field);
    if (!ok && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) {
    const input = document.getElementById(firstInvalid.id);
    if (input) input.focus();
    return false;
  }
  return true;
}

function handleInput(field, value) {
  setState({ [field.key]: value });
  if (field.required && invalid.has(field.key) && value.trim()) {
    invalid.delete(field.key);
    renderField(field);
  }
}

function bindField(field) {
  const input = document.getElementById(field.id);
  if (!input) return;

  input.addEventListener('input', () => handleInput(field, input.value));
  input.addEventListener('blur', () => {
    if (field.required) validateField(field);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && field.key !== 'audience' && field.key !== 'goal') {
      event.preventDefault();
      input.blur();
    }
  });

  fields.push({ field, input });
}

export function initBrief() {
  form = document.getElementById('brief-form');
  memo = document.getElementById('brief-memo');

  FIELDS.forEach(bindField);

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      validateAll();
    });
  }

  FIELDS.forEach(renderField);
  renderMemo();

  subscribeTo(
    ['name', 'slogan', 'audience', 'goal', 'character', 'paletteId', 'lang'],
    (state, meta) => {
      const dataKeys = ['name', 'slogan', 'audience', 'goal', 'character'];
      if (meta.changed.some((key) => dataKeys.includes(key))) {
        dataKeys.forEach((key) => {
          const field = FIELDS.find((item) => item.key === key);
          if (field) renderField(field);
        });
      }
      if (meta.changed.includes('lang')) {
        FIELDS.forEach(renderField);
      }
      renderMemo();
    }
  );
}

/** Экспорт для проверок и внешних сценариев. */
export function validateBrief() {
  return validateAll();
}
