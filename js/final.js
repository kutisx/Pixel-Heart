/* =========================================================================
   final.js — итоговый брендбук: бриф, цвета, типографика, макеты, подпись.
   Здесь же показывается статус зафиксированной для PDF темы.
   Собирается из состояния и обновляется на каждое изменение.
   ========================================================================= */

import { getFont, getLayout, getNovel, getPalette } from './data.js';
import { getState, subscribeTo } from './state.js';
import { locale, t, pick } from './i18n.js';
import { buildTheme } from './theme.js';
import { escapeHtml, formatDate } from './utils.js';
import { createMockup } from './layouts.js';

let container = null;
let themeStatus = null;
let initialized = false;

function valueOrEmpty(raw, escape = true) {
  const value = String(raw || '').trim();
  if (!value) {
    return `<dd data-empty="true">${escapeHtml(t('final.empty'))}</dd>`;
  }
  return `<dd>${escape ? escapeHtml(value) : value}</dd>`;
}

function swatch(label, color) {
  return `
    <div class="brandbook-swatch">
      <span class="brandbook-swatch__chip" style="--chip:${color}"></span>
      <span class="brandbook-swatch__label">${escapeHtml(label)}</span>
      <span class="brandbook-swatch__hex">${escapeHtml(color.toUpperCase())}</span>
    </div>`;
}

function heartMark() {
  return `
    <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" focusable="false">
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

/** Показывает, зафиксирована ли тема для PDF или следует за каруселью. */
function renderThemeStatus(state = getState()) {
  if (!themeStatus) return;
  const palette = getPalette(state.paletteId);
  themeStatus.textContent = state.paletteLocked
    ? t('theme.fixedStatus', { palette: palette.label })
    : t('theme.autoStatus');

  const panel = themeStatus.closest('[data-theme-panel]');
  if (panel) panel.setAttribute('data-locked', state.paletteLocked ? 'true' : 'false');
}

function render() {
  if (!container) return;

  const state = getState();
  const palette = getPalette(state.paletteId);
  const font = getFont(state.fontId);
  const layout = getLayout(state.layoutId);
  /* Когда тема зафиксирована для PDF, «активная новелла» в документе должна
     совпадать с зафиксированной палитрой, а не с текущим слайдом карусели. */
  const novel = getNovel(state.paletteLocked ? palette.novelId : state.activeNovelId);
  const theme = buildTheme(palette);
  const date = formatDate(locale());

  const name = state.name.trim();
  const slogan = state.slogan.trim();
  const preview = state.previewText.trim() || t('typography.previewPlaceholder');

  const swatches = [
    swatch(t('color.bg'), palette.bg),
    swatch(t('color.text'), palette.text),
    swatch(t('color.button'), palette.accent),
    swatch(t('color.accent2'), palette.accent2)
  ].join('');

  container.innerHTML = `
    <article class="brandbook__doc">
      <header class="brandbook__head">
        <span class="brandbook__mark">${heartMark()}</span>
        <div>
          <p class="brandbook__kicker">Pixel Heart · ${escapeHtml(t('brand.sub'))}</p>
          <h3 class="brandbook__title">${escapeHtml(name || t('final.empty'))}</h3>
          <p class="brandbook__slogan">${escapeHtml(slogan || t('final.empty'))}</p>
        </div>
        <p class="brandbook__date">${escapeHtml(t('final.date', { date }))}</p>
      </header>

      <div class="brandbook__grid">
        <section class="brandbook__block" aria-labelledby="bb-brief">
          <h4 id="bb-brief">${escapeHtml(t('final.brief'))}</h4>
          <dl class="brandbook__dl">
            <div><dt>${escapeHtml(t('final.name'))}</dt>${valueOrEmpty(state.name)}</div>
            <div><dt>${escapeHtml(t('final.slogan'))}</dt>${valueOrEmpty(state.slogan)}</div>
            <div><dt>${escapeHtml(t('final.audience'))}</dt>${valueOrEmpty(state.audience)}</div>
            <div><dt>${escapeHtml(t('final.goal'))}</dt>${valueOrEmpty(state.goal)}</div>
            <div><dt>${escapeHtml(t('final.character'))}</dt>${valueOrEmpty(state.character)}</div>
          </dl>
        </section>

        <section class="brandbook__block" aria-labelledby="bb-colors">
          <h4 id="bb-colors">${escapeHtml(t('final.colors'))}</h4>
          <div class="brandbook__swatches">${swatches}</div>
          <p class="brandbook__meta">
            ${escapeHtml(t('final.paletteLabel'))}: ${escapeHtml(palette.label)}<br />
            ${escapeHtml(t('final.novelLabel'))}: ${escapeHtml(novel.name)}<br />
            ${escapeHtml(t('final.mood'))}: ${escapeHtml(pick(palette.mood))}<br />
            ${escapeHtml(t('color.contrastText'))}: ${theme.metrics.textOnBg.toFixed(1)}:1 ·
            ${escapeHtml(t('color.contrastButton'))}: ${theme.metrics.onAccent.toFixed(1)}:1
          </p>
        </section>

        <section class="brandbook__block" aria-labelledby="bb-type">
          <h4 id="bb-type">${escapeHtml(t('final.type'))}</h4>
          <p class="brandbook__specimen" style="--bb-specimen-font:${font.stack};--bb-specimen-weight:${state.fontWeight}">${escapeHtml(preview)}</p>
          <div class="brandbook__type-list">
            <div class="type-row">
              <span class="type-row__label">${escapeHtml(t('final.fontLabel'))}</span>
              <span class="type-row__value">${escapeHtml(font.label)}</span>
            </div>
            <div class="type-row">
              <span class="type-row__label">${escapeHtml(t('final.sizeLabel'))}</span>
              <span class="type-row__value">${state.fontSize} px</span>
            </div>
            <div class="type-row">
              <span class="type-row__label">${escapeHtml(t('final.weightLabel'))}</span>
              <span class="type-row__value">${state.fontWeight}</span>
            </div>
          </div>
          <p class="brandbook__meta">${escapeHtml(t('typography.monoNote'))}</p>
        </section>
      </div>

      <section class="brandbook__block brandbook__block--wide" aria-labelledby="bb-mockups">
        <h4 id="bb-mockups">${escapeHtml(t('final.mockups'))}</h4>
        <div class="brandbook__mockups" data-final-mockups></div>
        <p class="brandbook__caption">
          ${escapeHtml(t('final.composition'))}: ${escapeHtml(pick(layout.label))} — ${escapeHtml(pick(layout.note))}
        </p>
      </section>

      <footer class="brandbook__sign">
        <p class="brandbook__signature">${escapeHtml(t('final.signature'))} · ${escapeHtml(date)}</p>
        <p class="brandbook__print-note">${escapeHtml(t('final.printNote'))}</p>
      </footer>
    </article>`;

  const mockups = container.querySelector('[data-final-mockups]');
  if (mockups) {
    mockups.append(createMockup(state, 'poster'), createMockup(state, 'social'));
  }

  renderThemeStatus(state);
}

export function initFinal() {
  if (initialized) return;
  container = document.getElementById('brandbook');
  themeStatus = document.getElementById('final-theme-status');
  if (!container) return;

  render();

  subscribeTo(
    [
      'name',
      'slogan',
      'audience',
      'goal',
      'character',
      'activeNovelId',
      'paletteId',
      'paletteLocked',
      'fontId',
      'fontSize',
      'fontWeight',
      'layoutId',
      'previewText',
      'lang'
    ],
    () => {
      render();
    }
  );

  initialized = true;
}
