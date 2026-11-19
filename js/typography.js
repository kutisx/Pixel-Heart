/* =========================================================================
   typography.js — выбор шрифта, размер, насыщенность и живой образец.
   Образец показывает выбранный шрифт в заголовке и в абзаце.
   ========================================================================= */

import { FONTS, getFont } from './data.js';
import { getState, setState, subscribeTo } from './state.js';
import { t, pick } from './i18n.js';
import { escapeHtml } from './utils.js';

let previewPanel = null;
let heading = null;
let body = null;
let textarea = null;
let sizeInput = null;
let weightInput = null;
let sizeOutput = null;
let weightOutput = null;
let fontContainer = null;
let initialized = false;

function fontCard(font, selected) {
  return `
    <label class="choice">
      <input
        type="radio"
        name="font"
        value="${font.id}"
        aria-checked="${selected ? 'true' : 'false'}"
        ${selected ? 'checked' : ''}
      />
      <span class="choice__face">
        <span class="font-option__sample" style="font-family:${font.stack}">Aa</span>
        <span class="choice__title">${escapeHtml(font.label)}</span>
        <span class="font-option__note">${escapeHtml(pick(font.note))}</span>
        <span class="choice__state">${escapeHtml(t(selected ? 'color.selected' : 'color.select'))}</span>
      </span>
    </label>`;
}

function renderFontChoices() {
  if (!fontContainer) return;
  const { fontId } = getState();
  fontContainer.innerHTML = FONTS.map((font) => fontCard(font, font.id === fontId)).join('');
}

function syncFontSelection() {
  if (!fontContainer) return;
  const { fontId } = getState();
  fontContainer.querySelectorAll('input[name="font"]').forEach((input) => {
    const selected = input.value === fontId;
    input.checked = selected;
    input.setAttribute('aria-checked', selected ? 'true' : 'false');
    const state = input.parentElement.querySelector('.choice__state');
    if (state) state.textContent = t(selected ? 'color.selected' : 'color.select');
  });
}

function renderPreview() {
  const state = getState();
  const font = getFont(state.fontId);

  if (previewPanel) {
    previewPanel.style.setProperty('--preview-font', font.stack);
    previewPanel.style.setProperty('--preview-size', String(state.fontSize));
    previewPanel.style.setProperty('--preview-weight', String(state.fontWeight));
  }

  const text = state.previewText.trim();
  if (heading) {
    heading.textContent = text || t('typography.previewPlaceholder');
    heading.dataset.empty = text ? 'false' : 'true';
  }
  if (body) {
    body.textContent = t('typography.bodyText');
  }
}

function updateRange(input, value) {
  if (!input) return;
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const ratio = ((Number(value) - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', `${Math.min(100, Math.max(0, ratio))}%`);
}

function renderControls() {
  const state = getState();

  if (textarea && document.activeElement !== textarea && textarea.value !== state.previewText) {
    textarea.value = state.previewText;
  }
  if (sizeInput) {
    if (Number(sizeInput.value) !== state.fontSize) sizeInput.value = String(state.fontSize);
    sizeInput.setAttribute('aria-valuetext', `${state.fontSize} px`);
    updateRange(sizeInput, state.fontSize);
  }
  if (weightInput) {
    if (Number(weightInput.value) !== state.fontWeight) weightInput.value = String(state.fontWeight);
    updateRange(weightInput, state.fontWeight);
  }
  if (sizeOutput) sizeOutput.textContent = `${state.fontSize} px`;
  if (weightOutput) weightOutput.textContent = String(state.fontWeight);
}

function bindControls() {
  if (textarea) {
    textarea.addEventListener('input', () => {
      setState({ previewText: textarea.value });
    });
  }

  if (sizeInput) {
    sizeInput.addEventListener('input', () => {
      const value = Number(sizeInput.value);
      setState({ fontSize: value });
      updateRange(sizeInput, value);
      if (sizeOutput) sizeOutput.textContent = `${value} px`;
    });
  }

  if (weightInput) {
    weightInput.addEventListener('input', () => {
      const value = Number(weightInput.value);
      setState({ fontWeight: value });
      updateRange(weightInput, value);
      if (weightOutput) weightOutput.textContent = String(value);
    });
  }

  if (fontContainer) {
    fontContainer.addEventListener('change', (event) => {
      const input = event.target;
      if (!input || input.name !== 'font') return;
      setState({ fontId: input.value });
    });
  }
}

export function initTypography() {
  if (initialized) return;

  previewPanel = document.querySelector('.type-preview');
  heading = document.getElementById('type-heading');
  body = document.getElementById('type-body');
  textarea = document.getElementById('preview-text');
  sizeInput = document.getElementById('font-size');
  weightInput = document.getElementById('font-weight');
  sizeOutput = document.getElementById('font-size-value');
  weightOutput = document.getElementById('font-weight-value');
  fontContainer = document.getElementById('font-choices');

  if (!previewPanel || !heading || !fontContainer) return;

  renderFontChoices();
  bindControls();
  renderControls();
  renderPreview();

  subscribeTo(['fontId', 'fontSize', 'fontWeight', 'previewText', 'lang'], (state, meta) => {
    if (meta.changed.includes('lang')) {
      renderFontChoices();
    } else if (meta.changed.includes('fontId')) {
      syncFontSelection();
    }
    renderControls();
    renderPreview();
  });

  initialized = true;
}
