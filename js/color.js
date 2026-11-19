/* =========================================================================
   color.js — карточки палитр, выбор палитры и мини-пример.
   Контрасты считаются в theme.js и показываются цифрами, чтобы читаемость
   была проверяемой, а не обещанной.
   ========================================================================= */

import { PALETTES, getPalette } from './data.js';
import { getState, setState, subscribeTo } from './state.js';
import { t, pick } from './i18n.js';
import { buildTheme } from './theme.js';
import { escapeHtml } from './utils.js';

let grid = null;
let preview = null;
let initialized = false;

function ratio(value) {
  return `${value.toFixed(1)}:1`;
}

function contrastBadge(label, value) {
  const ok = value >= 4.5;
  return `<span class="contrast-badge" data-ok="${ok}">${escapeHtml(label)} ${ratio(value)}</span>`;
}

function swatchMarkup(label, color) {
  return `
    <span class="swatch">
      <span class="swatch__chip" style="--swatch:${color}"></span>
      <span class="swatch__label">${escapeHtml(label)}</span>
      <span class="swatch__hex mono">${escapeHtml(color.toUpperCase())}</span>
    </span>`;
}

function cardMarkup(palette, selected) {
  const theme = buildTheme(palette);
  const style = [
    `--card-bg:${palette.bg}`,
    `--card-text:${palette.text}`,
    `--card-muted:${theme.muted}`,
    `--card-accent:${palette.accent}`,
    `--card-accent-2:${palette.accent2}`,
    `--card-glow:${palette.glow}`,
    `--card-line:${theme.line}`
  ].join(';');

  return `
    <label class="choice palette-card" style="${style}">
      <input
        type="radio"
        name="palette"
        value="${palette.id}"
        aria-checked="${selected ? 'true' : 'false'}"
        ${selected ? 'checked' : ''}
      />
      <span class="choice__face">
        <span class="palette-card__head">
          <span class="palette-card__name">${escapeHtml(palette.label)}</span>
          <span class="palette-card__state" data-state>${escapeHtml(t(selected ? 'color.selected' : 'color.select'))}</span>
        </span>
        <span class="palette-card__mood">${escapeHtml(pick(palette.mood))}</span>
        <span class="palette-card__swatches">
          ${swatchMarkup(t('color.bg'), palette.bg)}
          ${swatchMarkup(t('color.text'), palette.text)}
          ${swatchMarkup(t('color.button'), palette.accent)}
          ${swatchMarkup(t('color.accent2'), palette.accent2)}
        </span>
        <span class="palette-card__contrast">
          ${contrastBadge(t('color.contrastText'), theme.metrics.textOnBg)}
          ${contrastBadge(t('color.contrastButton'), theme.metrics.onAccent)}
        </span>
      </span>
    </label>`;
}

function renderGrid() {
  if (!grid) return;
  const { paletteId } = getState();
  grid.innerHTML = PALETTES.map((palette) => cardMarkup(palette, palette.id === paletteId)).join('');
}

function syncSelected() {
  if (!grid) return;
  const { paletteId } = getState();
  grid.querySelectorAll('input[name="palette"]').forEach((input) => {
    const selected = input.value === paletteId;
    input.checked = selected;
    input.setAttribute('aria-checked', selected ? 'true' : 'false');
    const state = input.parentElement.querySelector('[data-state]');
    if (state) state.textContent = t(selected ? 'color.selected' : 'color.select');
  });
}

function renderPreview() {
  if (!preview) return;
  const palette = getPalette(getState().paletteId);
  const theme = buildTheme(palette);

  const style = [
    `--sample-bg:${palette.bg}`,
    `--sample-text:${palette.text}`,
    `--sample-accent:${palette.accent}`,
    `--sample-on-accent:${theme.onAccent}`,
    `--sample-accent-2:${palette.accent2}`,
    `--sample-muted:${theme.muted}`,
    `--sample-line:${theme.line}`,
    `--sample-glow:${palette.glow}`
  ].join(';');

  preview.innerHTML = `
    <div class="palette-preview__sample" style="${style}">
      <p class="palette-preview__label">${escapeHtml(palette.label)} · ${escapeHtml(t('color.selectedPalette'))}</p>
      <h3 class="palette-preview__title">${escapeHtml(t('color.previewTitle'))}</h3>
      <p class="palette-preview__body">${escapeHtml(t('color.previewBody'))}</p>
      <div class="palette-preview__row">
        <button type="button" class="sample-button" disabled aria-hidden="true" tabindex="-1">${escapeHtml(t('color.previewButton'))}</button>
        <span class="sample-chip">
          <span class="sample-chip__dot" aria-hidden="true"></span>
          ${escapeHtml(t('color.accent2'))} · ${escapeHtml(palette.accent2.toUpperCase())}
        </span>
      </div>
    </div>
    <aside class="palette-preview__aside" aria-label="${escapeHtml(t('color.selectedPalette'))}">
      <p class="kicker">${escapeHtml(t('color.selectedPalette'))}</p>
      <p class="palette-preview__name">${escapeHtml(palette.label)}</p>
      <p class="palette-preview__mood">${escapeHtml(pick(palette.mood))}</p>
      <dl class="palette-preview__metrics">
        <div class="metric">
          <dt class="metric__label">${escapeHtml(t('color.text'))} / ${escapeHtml(t('color.bg'))}</dt>
          <dd class="metric__value">${ratio(theme.metrics.textOnBg)}</dd>
        </div>
        <div class="metric">
          <dt class="metric__label">${escapeHtml(t('color.button'))}</dt>
          <dd class="metric__value">${ratio(theme.metrics.onAccent)}</dd>
        </div>
        <div class="metric">
          <dt class="metric__label">${escapeHtml(t('color.accent'))}</dt>
          <dd class="metric__value">${ratio(theme.metrics.accentText)}</dd>
        </div>
      </dl>
      <p class="palette-preview__note">${escapeHtml(
        `${t('color.bg')} ${palette.bg.toUpperCase()} · ${t('color.text')} ${palette.text.toUpperCase()}`
      )}</p>
    </aside>`;
}

function handleChange(event) {
  const input = event.target;
  if (!input || input.name !== 'palette') return;
  setState({ paletteId: input.value });
}

export function initColor() {
  if (initialized) return;
  grid = document.getElementById('palette-grid');
  preview = document.getElementById('palette-preview');
  if (!grid || !preview) return;

  grid.addEventListener('change', handleChange);

  renderGrid();
  renderPreview();

  subscribeTo(['paletteId', 'lang'], (state, meta) => {
    if (meta.changed.includes('lang')) {
      renderGrid();
      renderPreview();
      return;
    }
    syncSelected();
    renderPreview();
  });

  initialized = true;
}
