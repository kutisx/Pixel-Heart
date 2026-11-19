/* =========================================================================
   themepicker.js — мини-переключатели темы.
   Два режима:
   · preview — меняет только тему предпросмотра (mascot-card, макеты,
     редактор маскота), не трогая основной вид сайта и карусель;
   · commit — фиксирует тему для итогового брендбука и печати
     (paletteLocked), после чего карусель перестаёт менять цвета.
   Разметка одна, поэтому кнопки выглядят и ведут себя одинаково везде.
   ========================================================================= */

import { PALETTES, getPalette } from './data.js';
import { getState, setState, subscribeTo } from './state.js';
import { t } from './i18n.js';
import { escapeHtml } from './utils.js';

const mounted = new Set();
let initialized = false;

function paletteName(palette) {
  return palette.shortLabel || palette.label;
}

function dotsMarkup(palette) {
  return [palette.bg, palette.text, palette.accent, palette.accent2]
    .map((color) => `<span class="theme-picker__dot" style="--dot:${color}"></span>`)
    .join('');
}

function paletteButtonMarkup(palette) {
  return `
    <button
      class="theme-picker__btn"
      type="button"
      data-palette="${palette.id}"
      aria-pressed="false"
    >
      <span class="theme-picker__swatches" aria-hidden="true">${dotsMarkup(palette)}</span>
      <span class="theme-picker__name">${escapeHtml(paletteName(palette))}</span>
    </button>`;
}

function autoButtonMarkup() {
  return `
    <button class="theme-picker__btn theme-picker__btn--auto" type="button" data-auto>
      <span class="theme-picker__auto-dot" aria-hidden="true"></span>
      <span class="theme-picker__name">Авто</span>
    </button>`;
}

function mount(container, mode) {
  container.classList.add('theme-picker');
  container.classList.add(`theme-picker--${mode}`);
  container.dataset.mode = mode;
  container.setAttribute('role', 'group');
  container.innerHTML =
    PALETTES.map((palette) => paletteButtonMarkup(palette)).join('') +
    autoButtonMarkup();

  container.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!button || !container.contains(button)) return;

    if (button.hasAttribute('data-auto')) {
      if (mode === 'commit') {
        setState({ paletteLocked: false, previewPaletteId: null });
      } else {
        setState({ previewPaletteId: null });
      }
      return;
    }

    const paletteId = button.getAttribute('data-palette');
    if (!paletteId) return;

    if (mode === 'commit') {
      setState({
        paletteId,
        previewPaletteId: paletteId,
        paletteLocked: true
      });
    } else {
      setState({ previewPaletteId: paletteId });
    }
  });

  const entry = { container, mode };
  mounted.add(entry);
  return entry;
}

function syncEntry(entry, state) {
  const { container, mode } = entry;

  /* В режиме фиксации подсвечиваем палитру только когда тема действительно
     зафиксирована. Иначе «Авто» и текущая палитра выглядели бы выбранными
     одновременно и путали пользователя. */
  const selected =
    mode === 'commit'
      ? state.paletteLocked
        ? state.paletteId
        : null
      : state.previewPaletteId || state.paletteId;

  container.setAttribute(
    'aria-label',
    t(mode === 'commit' ? 'theme.pickerAriaCommit' : 'theme.pickerAriaPreview')
  );

  container.querySelectorAll('[data-palette]').forEach((button) => {
    const palette = getPalette(button.getAttribute('data-palette'));
    const isSelected = palette.id === selected;
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    button.title = t(
      mode === 'commit' ? 'theme.chooseCommit' : 'theme.choosePreview',
      { palette: palette.label }
    );
  });

  const auto = container.querySelector('[data-auto]');
  if (auto) {
    auto.title = t(mode === 'commit' ? 'theme.autoTitleCommit' : 'theme.autoTitlePreview');
    const label = auto.querySelector('.theme-picker__name');
    if (label) label.textContent = t('theme.auto');
  }
}

/**
 * Находит все [data-theme-picker] в документе и оживляет их.
 * Атрибут data-theme-picker="preview" | "commit" задаёт режим.
 */
export function initThemePickers() {
  if (initialized) return;

  document.querySelectorAll('[data-theme-picker]').forEach((container) => {
    const mode = container.getAttribute('data-theme-picker') === 'commit' ? 'commit' : 'preview';
    mount(container, mode);
  });

  const syncAll = (state = getState()) => {
    mounted.forEach((entry) => syncEntry(entry, state));
  };

  syncAll();
  subscribeTo(['paletteId', 'previewPaletteId', 'paletteLocked', 'lang'], syncAll);

  initialized = true;
}
