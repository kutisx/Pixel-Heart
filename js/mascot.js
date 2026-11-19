/* =========================================================================
   mascot.js — пиксельный маскот, сцена, карточка и модальный редактор.
   Маскот — inline SVG из четырёх слоёв: body, outfit, head, accessory.
   Цвета головы и тела приходят из CSS-переменных --mascot-head/--mascot-body.
   ========================================================================= */

import { ACCESSORIES, OUTFITS, getAccessory, getFont, getNovel, getOutfit } from './data.js';
import { demoState, getState, setState, subscribeTo } from './state.js';
import { t, pick } from './i18n.js';
import { escapeHtml, focusSilently, focusableWithin } from './utils.js';

/* ------------------------------------------------------------ слои маскота */

const HEAD = `
  <g data-part="head" class="mascot-part mascot-part--head">
    <rect x="7" y="3" width="4" height="6" fill="var(--mascot-head)" />
    <rect x="21" y="3" width="4" height="6" fill="var(--mascot-head)" />
    <rect x="8" y="2" width="3" height="2" fill="var(--mascot-head)" />
    <rect x="21" y="2" width="3" height="2" fill="var(--mascot-head)" />
    <rect x="10" y="5" width="12" height="12" fill="var(--mascot-head)" />
    <rect x="9" y="7" width="14" height="9" fill="var(--mascot-head)" />
    <rect x="10" y="15" width="12" height="2" fill="#0B0B10" opacity=".14" />
    <rect x="12" y="9" width="2" height="3" fill="#12101A" />
    <rect x="18" y="9" width="2" height="3" fill="#12101A" />
    <rect x="12" y="9" width="1" height="1" fill="#FFFFFF" opacity=".85" />
    <rect x="18" y="9" width="1" height="1" fill="#FFFFFF" opacity=".85" />
    <rect x="15" y="13" width="2" height="1" fill="#12101A" />
    <rect x="11" y="12" width="2" height="1" fill="var(--theme-accent)" opacity=".5" />
    <rect x="19" y="12" width="2" height="1" fill="var(--theme-accent)" opacity=".5" />
  </g>`;

const BODY = `
  <g data-part="body" class="mascot-part mascot-part--body">
    <rect x="9" y="18" width="2" height="7" fill="var(--mascot-body)" />
    <rect x="21" y="18" width="2" height="7" fill="var(--mascot-body)" />
    <rect x="12" y="27" width="3" height="4" fill="var(--mascot-body)" />
    <rect x="17" y="27" width="3" height="4" fill="var(--mascot-body)" />
    <rect x="11" y="31" width="4" height="2" fill="#12101A" />
    <rect x="17" y="31" width="4" height="2" fill="#12101A" />
    <rect x="11" y="17" width="10" height="10" fill="var(--mascot-body)" />
    <rect x="13" y="20" width="6" height="1" fill="#FFFFFF" opacity=".1" />
  </g>`;

const OUTFIT_PARTS = {
  doki: `
    <g data-part="outfit" class="mascot-part mascot-part--outfit">
      <rect x="10" y="16" width="12" height="9" fill="var(--theme-accent)" />
      <rect x="10" y="16" width="12" height="2" fill="#0B0B10" opacity=".16" />
      <rect x="14" y="16" width="4" height="2" fill="var(--mascot-head)" />
      <rect x="9" y="22" width="2" height="3" fill="var(--theme-accent)" />
      <rect x="21" y="22" width="2" height="3" fill="var(--theme-accent)" />
      <rect x="14" y="20" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="17" y="20" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="14" y="21" width="4" height="1" fill="var(--theme-accent-2)" />
      <rect x="15" y="22" width="2" height="1" fill="var(--theme-accent-2)" />
    </g>`,
  saya: `
    <g data-part="outfit" class="mascot-part mascot-part--outfit">
      <rect x="9" y="16" width="14" height="15" fill="var(--theme-accent)" opacity=".94" />
      <rect x="9" y="16" width="3" height="15" fill="#0B0B10" opacity=".28" />
      <rect x="20" y="16" width="3" height="15" fill="#0B0B10" opacity=".28" />
      <rect x="15" y="18" width="2" height="13" fill="#0B0B10" opacity=".32" />
      <rect x="10" y="16" width="12" height="2" fill="var(--mascot-body)" />
      <rect x="12" y="19" width="2" height="2" fill="var(--theme-accent-2)" />
      <rect x="18" y="19" width="2" height="2" fill="var(--theme-accent-2)" />
    </g>`,
  nine: `
    <g data-part="outfit" class="mascot-part mascot-part--outfit">
      <rect x="10" y="16" width="12" height="10" fill="var(--theme-accent)" opacity=".92" />
      <rect x="14" y="16" width="4" height="2" fill="var(--mascot-body)" />
      <rect x="15" y="18" width="2" height="5" fill="var(--theme-accent-2)" />
      <rect x="11" y="18" width="2" height="1" fill="#FFFFFF" opacity=".28" />
      <rect x="19" y="18" width="2" height="1" fill="#FFFFFF" opacity=".28" />
      <rect x="10" y="24" width="12" height="1" fill="#0B0B10" opacity=".32" />
      <rect x="10" y="26" width="12" height="1" fill="#0B0B10" opacity=".22" />
    </g>`,
  va11: `
    <g data-part="outfit" class="mascot-part mascot-part--outfit">
      <rect x="11" y="17" width="10" height="2" fill="var(--theme-accent-2)" />
      <rect x="12" y="19" width="8" height="10" fill="var(--theme-accent)" opacity=".92" />
      <rect x="12" y="24" width="8" height="1" fill="#0B0B10" opacity=".35" />
      <rect x="12" y="25" width="3" height="2" fill="var(--theme-accent-2)" opacity=".8" />
      <rect x="17" y="25" width="3" height="2" fill="#0B0B10" opacity=".3" />
    </g>`
};

const ACCESSORY_PARTS = {
  none: '',
  doki: `
    <g data-part="accessory" class="mascot-part mascot-part--accessory">
      <rect x="12" y="0" width="3" height="3" fill="var(--theme-accent-2)" />
      <rect x="17" y="0" width="3" height="3" fill="var(--theme-accent-2)" />
      <rect x="15" y="1" width="2" height="2" fill="var(--theme-accent)" />
      <rect x="12" y="0" width="1" height="1" fill="#FFFFFF" opacity=".6" />
    </g>`,
  saya: `
    <g data-part="accessory" class="mascot-part mascot-part--accessory">
      <rect x="9" y="8" width="14" height="5" fill="#0B0B10" opacity=".5" />
      <rect x="9" y="8" width="14" height="1" fill="var(--theme-accent-2)" />
      <rect x="12" y="9" width="3" height="3" fill="var(--theme-accent-2)" opacity=".9" />
      <rect x="17" y="9" width="3" height="3" fill="var(--theme-accent-2)" opacity=".9" />
      <rect x="9" y="8" width="1" height="5" fill="var(--theme-accent-2)" />
      <rect x="22" y="8" width="1" height="5" fill="var(--theme-accent-2)" />
    </g>`,
  nine: `
    <g data-part="accessory" class="mascot-part mascot-part--accessory">
      <rect x="20" y="4" width="2" height="2" fill="var(--theme-accent-2)" />
      <rect x="19" y="5" width="4" height="1" fill="var(--theme-accent-2)" />
      <rect x="20" y="6" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="21" y="3" width="1" height="1" fill="#FFFFFF" opacity=".85" />
    </g>`,
  va11: `
    <g data-part="accessory" class="mascot-part mascot-part--accessory">
      <rect x="7" y="4" width="18" height="1" fill="var(--theme-accent-2)" />
      <rect x="7" y="5" width="1" height="6" fill="var(--theme-accent-2)" />
      <rect x="24" y="5" width="1" height="6" fill="var(--theme-accent-2)" />
      <rect x="5" y="9" width="3" height="4" fill="var(--theme-accent-2)" />
      <rect x="24" y="9" width="3" height="4" fill="var(--theme-accent-2)" />
      <rect x="24" y="12" width="4" height="1" fill="var(--theme-accent-2)" />
      <rect x="27" y="12" width="1" height="4" fill="var(--theme-accent-2)" />
      <rect x="27" y="15" width="2" height="1" fill="var(--theme-accent-2)" />
    </g>`
};

/** Собирает inline SVG маскота. Все части — отдельные группы с data-part. */
export function buildMascotSVG(state, { decorative = false } = {}) {
  const outfit = getOutfit(state.mascot.outfitId);
  const accessory = getAccessory(state.mascot.accessoryId);
  const label = `${t('mascot.caption')}: ${pick(outfit.label)}, ${pick(accessory.label)}`;

  const headColor = state.mascot.headColor;
  const bodyColor = state.mascot.bodyColor;
  const style = `--mascot-head:${headColor};--mascot-body:${bodyColor}`;

  const a11y = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${escapeHtml(label)}"`;

  return `<svg class="mascot-svg" viewBox="0 0 32 34" ${a11y} style="${style}">
    ${decorative ? '' : `<title>${escapeHtml(label)}</title>`}
    <g class="mascot">
      ${BODY}
      ${OUTFIT_PARTS[state.mascot.outfitId] || OUTFIT_PARTS.doki}
      ${HEAD}
      ${ACCESSORY_PARTS[state.mascot.accessoryId] || ''}
    </g>
  </svg>`;
}

/* ---------------------------------------------------------------- элементы */

let dialog = null;
let card = null;
let quoteElement = null;
let outfitContainer = null;
let accessoryContainer = null;
let headColorInput = null;
let bodyColorInput = null;
let quoteInput = null;
let sceneNovel = null;
let cardNovel = null;
let lastTrigger = null;
let initialized = false;

function renderSlots() {
  const state = getState();
  document.querySelectorAll('[data-mascot-slot]').forEach((slot) => {
    const kind = slot.getAttribute('data-mascot-slot');
    slot.innerHTML = buildMascotSVG(state, { decorative: kind === 'editor' });
  });
}

function renderCard() {
  const state = getState();
  if (!card || !quoteElement) return;

  const font = getFont(state.fontId);
  const novel = getNovel(state.activeNovelId);
  const quote = state.quoteText.trim();

  card.style.setProperty('--quote-font', font.stack);
  card.style.setProperty('--quote-weight', String(state.fontWeight));
  card.style.setProperty('--quote-size', String(state.fontSize));

  quoteElement.textContent = quote || t('mascot.noQuote');
  quoteElement.dataset.empty = quote ? 'false' : 'true';

  if (sceneNovel) sceneNovel.textContent = t('mascot.sceneNote', { novel: novel.name });
  if (cardNovel) cardNovel.textContent = novel.name;
}

function choiceMarkup(name, item, selected) {
  return `
    <label class="choice">
      <input
        type="radio"
        name="${name}"
        value="${item.id}"
        aria-checked="${selected ? 'true' : 'false'}"
        ${selected ? 'checked' : ''}
      />
      <span class="choice__face">
        <span class="choice__title">${escapeHtml(pick(item.label))}</span>
        <span class="choice__state">${escapeHtml(t(selected ? 'color.selected' : 'color.select'))}</span>
      </span>
    </label>`;
}

function renderChoices() {
  if (!outfitContainer || !accessoryContainer) return;
  const { mascot } = getState();

  outfitContainer.innerHTML = OUTFITS.map((item) =>
    choiceMarkup('outfit', item, item.id === mascot.outfitId)
  ).join('');

  accessoryContainer.innerHTML = ACCESSORIES.map((item) =>
    choiceMarkup('accessory', item, item.id === mascot.accessoryId)
  ).join('');
}

function syncChoices() {
  const { mascot } = getState();
  const sync = (container, name, value) => {
    if (!container) return;
    container.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      const selected = input.value === value;
      input.checked = selected;
      input.setAttribute('aria-checked', selected ? 'true' : 'false');
      const label = input.parentElement.querySelector('.choice__state');
      if (label) label.textContent = t(selected ? 'color.selected' : 'color.select');
    });
  };
  sync(outfitContainer, 'outfit', mascot.outfitId);
  sync(accessoryContainer, 'accessory', mascot.accessoryId);
}

function syncControls() {
  const state = getState();
  const { mascot } = state;

  if (headColorInput && headColorInput.value.toLowerCase() !== mascot.headColor.toLowerCase()) {
    headColorInput.value = mascot.headColor;
  }
  if (bodyColorInput && bodyColorInput.value.toLowerCase() !== mascot.bodyColor.toLowerCase()) {
    bodyColorInput.value = mascot.bodyColor;
  }
  if (quoteInput && document.activeElement !== quoteInput && quoteInput.value !== state.quoteText) {
    quoteInput.value = state.quoteText;
  }

  syncChoices();
}

function renderAll() {
  renderSlots();
  renderCard();
  syncControls();
}

/* ------------------------------------------------------------------ печать */

function printCard() {
  closeEditor({ restoreFocus: false });
  document.body.classList.add('is-printing-card');

  const cleanup = () => {
    document.body.classList.remove('is-printing-card');
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  window.addEventListener('focus', cleanup, { once: true });
  setTimeout(cleanup, 10000);

  window.print();
}

/* ------------------------------------------------------------------ диалог */

export function openMascotEditor(trigger) {
  if (!dialog) return;
  lastTrigger = trigger || document.activeElement;
  syncControls();

  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  const first = dialog.querySelector('input[name="outfit"]:checked') || dialog.querySelector('.editor__close');
  focusSilently(first);
}

export function closeEditor({ restoreFocus = true } = {}) {
  if (!dialog) return;
  if (dialog.open && typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
  if (restoreFocus) {
    focusSilently(lastTrigger || document.getElementById('mascot-open'));
  }
}

function bindDialog() {
  if (!dialog) return;

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeEditor();
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('editor-open');
    if (lastTrigger) focusSilently(lastTrigger);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeEditor();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const items = focusableWithin(dialog);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const closeButton = document.getElementById('mascot-editor-close');
  if (closeButton) closeButton.addEventListener('click', () => closeEditor());

  const doneButton = document.getElementById('editor-done');
  if (doneButton) doneButton.addEventListener('click', () => closeEditor());

  const openButton = document.getElementById('mascot-open');
  if (openButton) {
    openButton.addEventListener('click', () => {
      openMascotEditor(openButton);
      document.body.classList.add('editor-open');
    });
  }
}

function bindControls() {
  if (outfitContainer) {
    outfitContainer.addEventListener('change', (event) => {
      const input = event.target;
      if (!input || input.name !== 'outfit') return;
      setState({ mascot: { outfitId: input.value }, mascotTouched: true });
    });
  }

  if (accessoryContainer) {
    accessoryContainer.addEventListener('change', (event) => {
      const input = event.target;
      if (!input || input.name !== 'accessory') return;
      setState({ mascot: { accessoryId: input.value }, mascotTouched: true });
    });
  }

  if (headColorInput) {
    headColorInput.addEventListener('input', () => {
      setState({ mascot: { headColor: headColorInput.value }, mascotTouched: true });
    });
  }

  if (bodyColorInput) {
    bodyColorInput.addEventListener('input', () => {
      setState({ mascot: { bodyColor: bodyColorInput.value }, mascotTouched: true });
    });
  }

  if (quoteInput) {
    quoteInput.addEventListener('input', () => {
      setState({ quoteText: quoteInput.value });
    });
  }

  const resetMascot = () => {
    setState({ mascot: { ...demoState.mascot }, mascotTouched: false });
  };

  ['mascot-reset', 'editor-reset'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', resetMascot);
  });

  ['print-card', 'editor-print-card'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', printCard);
  });
}

export function initMascot() {
  if (initialized) return;

  dialog = document.getElementById('mascot-editor');
  card = document.getElementById('mascot-card');
  quoteElement = document.getElementById('mascot-card-quote');
  outfitContainer = document.getElementById('outfit-choices');
  accessoryContainer = document.getElementById('accessory-choices');
  headColorInput = document.getElementById('mascot-head-color');
  bodyColorInput = document.getElementById('mascot-body-color');
  quoteInput = document.getElementById('mascot-quote');
  sceneNovel = document.getElementById('mascot-scene-novel');
  cardNovel = document.getElementById('mascot-card-novel');

  if (!dialog || !card || !quoteElement) return;

  renderChoices();
  renderAll();
  bindControls();
  bindDialog();

  subscribeTo(
    ['mascot', 'mascotTouched', 'quoteText', 'fontId', 'fontSize', 'fontWeight', 'paletteId', 'activeNovelId', 'lang'],
    (state, meta) => {
      if (meta.changed.includes('lang')) {
        renderChoices();
      }
      renderAll();
    }
  );

  initialized = true;
}
