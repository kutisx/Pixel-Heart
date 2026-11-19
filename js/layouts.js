/* =========================================================================
   layouts.js — постер и карточка соцсетей + переключатель композиции.
   Макеты строятся из состояния и перерисовываются на любое изменение.
   ========================================================================= */

import { LAYOUTS, getFont, getLayout, getPalette } from './data.js';
import { getState, setState, subscribeTo } from './state.js';
import { t, pick } from './i18n.js';
import { escapeHtml } from './utils.js';

let compositionContainer = null;
let initialized = false;

function paletteDots(palette) {
  return [palette.bg, palette.text, palette.accent, palette.accent2]
    .map((color) => `<span class="mockup__dot" style="background:${color}"></span>`)
    .join('');
}

function artMarkup() {
  return `
    <div class="mockup__art" aria-hidden="true">
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
    </div>`;
}

/** Заполняет существующий узел макетом нужного типа. */
export function renderMockupInto(node, state, kind) {
  const font = getFont(state.fontId);
  const palette = getPalette(state.paletteId);
  const layout = getLayout(state.layoutId);

  const name = state.name.trim() || t('final.empty');
  const slogan = state.slogan.trim() || t('final.empty');
  const character = state.character.trim() || t('brief.characterEmpty');
  const kindLabel = t(kind === 'poster' ? 'layouts.poster' : 'layouts.social');

  node.className = `mockup mockup--${kind} mockup--${layout.id}`;
  node.dataset.kind = kind;
  node.setAttribute('role', 'img');
  node.setAttribute(
    'aria-label',
    t('layouts.mockupAria', {
      kind: kindLabel,
      name,
      slogan,
      palette: palette.label,
      font: font.label,
      layout: pick(layout.label)
    })
  );
  node.style.setProperty('--mock-font', font.stack);
  node.style.setProperty('--mock-weight', String(state.fontWeight));
  node.style.setProperty('--mock-size', String(state.fontSize));

  node.innerHTML = `
    <div class="mockup__inner">
      <div class="mockup__top">
        <span class="mockup__mark" aria-hidden="true">PH</span>
        <span class="mockup__brand">Pixel Heart</span>
      </div>
      ${artMarkup()}
      <div class="mockup__text">
        <p class="mockup__title">${escapeHtml(name)}</p>
        <p class="mockup__slogan">${escapeHtml(slogan)}</p>
      </div>
      <div class="mockup__foot">
        <div class="mockup__rule" aria-hidden="true"></div>
        <p class="mockup__meta">
          <span>${escapeHtml(character)}</span>
          <span class="mockup__dots" aria-hidden="true">${paletteDots(palette)}</span>
        </p>
        <p class="mockup__meta">${escapeHtml(palette.label)} · ${escapeHtml(font.label)}</p>
      </div>
    </div>`;
}

/** Создаёт новый узел макета (используется итоговым брендбуком). */
export function createMockup(state, kind) {
  const node = document.createElement('div');
  renderMockupInto(node, state, kind);
  return node;
}

function renderComposition() {
  if (!compositionContainer) return;
  const { layoutId } = getState();

  compositionContainer.innerHTML = LAYOUTS.map((layout) => {
    const selected = layout.id === layoutId;
    return `
      <label class="choice">
        <input
          type="radio"
          name="composition"
          value="${layout.id}"
          aria-checked="${selected ? 'true' : 'false'}"
          ${selected ? 'checked' : ''}
        />
        <span class="choice__face">
          <span class="choice__title">${escapeHtml(pick(layout.label))}</span>
          <span class="choice__meta">${escapeHtml(pick(layout.note))}</span>
          <span class="choice__state">${escapeHtml(t(selected ? 'color.selected' : 'color.select'))}</span>
        </span>
      </label>`;
  }).join('');
}

function syncComposition() {
  if (!compositionContainer) return;
  const { layoutId } = getState();
  compositionContainer.querySelectorAll('input[name="composition"]').forEach((input) => {
    const selected = input.value === layoutId;
    input.checked = selected;
    input.setAttribute('aria-checked', selected ? 'true' : 'false');
    const state = input.parentElement.querySelector('.choice__state');
    if (state) state.textContent = t(selected ? 'color.selected' : 'color.select');
  });
}

function renderMockups() {
  const state = getState();
  const poster = document.getElementById('mockup-poster');
  const social = document.getElementById('mockup-social');
  if (poster) renderMockupInto(poster, state, 'poster');
  if (social) renderMockupInto(social, state, 'social');
}

export function initLayouts() {
  if (initialized) return;

  compositionContainer = document.getElementById('composition-choices');
  if (!compositionContainer) return;

  renderComposition();
  renderMockups();

  compositionContainer.addEventListener('change', (event) => {
    const input = event.target;
    if (!input || input.name !== 'composition') return;
    setState({ layoutId: input.value });
  });

  subscribeTo(
    ['name', 'slogan', 'character', 'paletteId', 'fontId', 'fontSize', 'fontWeight', 'layoutId', 'lang'],
    (state, meta) => {
      if (meta.changed.includes('lang')) {
        renderComposition();
      } else if (meta.changed.includes('layoutId')) {
        syncComposition();
      }
      renderMockups();
    }
  );

  initialized = true;
}
