/* =========================================================================
   mascot.js — пиксельный маскот, сцена, карточка и модальный редактор.
   Маскот — inline SVG из четырёх слоёв: body, outfit, head, accessory.

   Разрешение низкое, «спрайтовое»: сетка 20 × 21, viewBox — 20 × 21,
   поэтому клетка на экране крупная. Голова — ровное пиксельное сердце,
   лицо — только два вертикальных глаза (без рта), тело — чиби в A-позе:
   руки разведены от плеч вниз, ноги на ширине корпуса.
   Силуэт каждого слоя задан строками [y, x0, x1), а контур в один пиксель
   считается автоматически: это клетки вокруг силуэта, залитые тёмным оттенком
   цвета слоя. Цвета головы и тела независимы, одежда и аксессуары — из темы.
   ========================================================================= */

import {
  ACCESSORIES,
  NOVEL_IDS,
  OUTFITS,
  getAccessory,
  getFont,
  getNovel,
  getOutfit,
  getPalette
} from './data.js';
import { demoState, getState, setState, subscribeTo } from './state.js';
import { applyThemeVars, mix } from './theme.js';
import { t, pick } from './i18n.js';
import { escapeHtml, focusSilently, focusableWithin } from './utils.js';

/* --------------------------------------------------------------- сетка */

const INK = '#0B0B10';

/** Полосы строк: y от y0 до y1 (не включая), x от x0 до x1 (не включая). */
function rows(y0, y1, x0, x1) {
  const out = [];
  for (let y = y0; y < y1; y += 1) out.push([y, x0, x1]);
  return out;
}

function cellsOf(spans) {
  const cells = new Set();
  spans.forEach(([y, x0, x1]) => {
    for (let x = x0; x < x1; x += 1) cells.add(`${x}:${y}`);
  });
  return cells;
}

function rect(x, y, width, fill) {
  return `<rect x="${x}" y="${y}" width="${width}" height="1" fill="${fill}" />`;
}

/** Склеивает соседние клетки строки в один <rect>. */
function rectRows(cells, fill) {
  const byRow = new Map();
  cells.forEach((cell) => {
    const [x, y] = cell.split(':').map(Number);
    if (!byRow.has(y)) byRow.set(y, []);
    byRow.get(y).push(x);
  });
  const parts = [];
  Array.from(byRow.keys())
    .sort((a, b) => a - b)
    .forEach((y) => {
      const xs = byRow.get(y).sort((a, b) => a - b);
      let start = xs[0];
      let prev = xs[0];
      for (let i = 1; i < xs.length; i += 1) {
        if (xs[i] !== prev + 1) {
          parts.push(rect(start, y, prev - start + 1, fill));
          start = xs[i];
        }
        prev = xs[i];
      }
      parts.push(rect(start, y, prev - start + 1, fill));
    });
  return parts.join('');
}

/** Контур: клетки, соседние с силуэтом, но не входящие в него. */
function edgeOf(cells) {
  const edge = new Set();
  cells.forEach((cell) => {
    const [x, y] = cell.split(':').map(Number);
    [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].forEach(([nx, ny]) => {
      const key = `${nx}:${ny}`;
      if (!cells.has(key)) edge.add(key);
    });
  });
  return edge;
}

/** Группа слоя: контур + заливки + детали. */
function layer(part, groups, line, details = '') {
  const all = new Set();
  groups.forEach(({ spans }) => {
    cellsOf(spans).forEach((cell) => all.add(cell));
  });
  const outline = line ? rectRows(edgeOf(all), line) : '';
  const fills = groups.map(({ spans, fill }) => rectRows(cellsOf(spans), fill)).join('');
  return `<g data-part="${part}" class="mascot-part mascot-part--${part}">${outline}${fills}${details}</g>`;
}

/* --------------------------------------------------------------- голова */

/** Сердце: 12 строк (1–12), 14 клеток в ширину, выемка в две строки. */
const HEART = [
  [1, 5, 8], [1, 12, 15],
  [2, 4, 9], [2, 11, 16],
  [3, 3, 17],
  [4, 3, 17],
  [5, 3, 17],
  [6, 3, 17],
  [7, 4, 16],
  [8, 5, 15],
  [9, 6, 14],
  [10, 7, 13],
  [11, 8, 12],
  [12, 9, 11]
];

/** Лицо: только два вертикальных глаза — без рта, бликов и румянца. */
const FACE = `
      <rect x="7" y="6" width="1" height="3" fill="#12101A" />
      <rect x="12" y="6" width="1" height="3" fill="#12101A" />`;

/* ---------------------------------------------------------------- тело */

/** Руки в A-позе — общий силуэт для тела и рукавов одежды. */
const ARM_SPANS = [
  [12, 6, 7], [12, 13, 14],
  [13, 5, 7], [13, 13, 15],
  [14, 4, 6], [14, 14, 16],
  [15, 4, 6], [15, 14, 16]
];

const SHORT_SLEEVE = ARM_SPANS.filter(([y]) => y < 15);

/** Чиби в A-позе: короткий корпус, руки разведены от плеч, ноги на ширине. */
const BODY_GROUPS = [
  {
    spans: [
      ...rows(12, 16, 7, 13),
      ...ARM_SPANS,
      ...rows(16, 19, 7, 9),
      ...rows(16, 19, 11, 13)
    ],
    fill: 'var(--mascot-body)'
  },
  {
    spans: [...rows(19, 20, 6, 9), ...rows(19, 20, 11, 14)],
    fill: '#12101A'
  }
];

/* -------------------------------------------------------------- одежда */

const OUTFIT_PARTS = {
  /* Свитер: ворот, сердце на груди, манжеты и резинка с рёбрами. */
  doki: {
    base: [
      {
        spans: [...rows(12, 16, 6, 14), ...SHORT_SLEEVE],
        fill: 'var(--theme-accent)'
      }
    ],
    details: `
      <rect x="8" y="12" width="4" height="1" fill="var(--theme-accent-2)" />
      <rect x="6" y="12" width="1" height="1" fill="#0B0B10" opacity=".22" />
      <rect x="13" y="12" width="1" height="1" fill="#0B0B10" opacity=".22" />
      <rect x="5" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="13" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="9" y="13" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="11" y="13" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="9" y="14" width="3" height="1" fill="var(--theme-accent-2)" />
      <rect x="6" y="15" width="8" height="1" fill="#0B0B10" opacity=".24" />
      <rect x="7" y="15" width="1" height="1" fill="var(--theme-accent)" />
      <rect x="10" y="15" width="1" height="1" fill="var(--theme-accent)" />
      <rect x="12" y="15" width="1" height="1" fill="var(--theme-accent)" />
    `
  },
  /* Плащ: лацканы, двубортные пуговицы, пояс с пряжкой, карманы и подол. */
  saya: {
    base: [
      {
        spans: [
          ...rows(11, 13, 5, 9),
          ...rows(11, 13, 11, 15),
          [12, 5, 15],
          ...rows(13, 20, 4, 16)
        ],
        fill: 'var(--theme-accent)'
      }
    ],
    details: `
      <rect x="5" y="11" width="4" height="1" fill="#0B0B10" opacity=".28" />
      <rect x="11" y="11" width="4" height="1" fill="#0B0B10" opacity=".28" />
      <rect x="6" y="12" width="2" height="1" fill="#0B0B10" opacity=".26" />
      <rect x="12" y="12" width="2" height="1" fill="#0B0B10" opacity=".26" />
      <rect x="9" y="12" width="2" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="4" y="13" width="2" height="7" fill="#0B0B10" opacity=".2" />
      <rect x="14" y="13" width="2" height="7" fill="#0B0B10" opacity=".2" />
      <rect x="9" y="13" width="2" height="7" fill="#0B0B10" opacity=".26" />
      <rect x="8" y="13" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="11" y="14" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="8" y="16" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="11" y="17" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="4" y="15" width="12" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="9" y="15" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="5" y="17" width="3" height="1" fill="#0B0B10" opacity=".24" />
      <rect x="12" y="17" width="3" height="1" fill="#0B0B10" opacity=".24" />
      <rect x="4" y="19" width="12" height="1" fill="#0B0B10" opacity=".3" />
    `
  },
  /* Форма: матросский воротник, галстук, манжеты и юбка в складку. */
  nine: {
    base: [
      {
        spans: [...rows(12, 16, 6, 14), ...SHORT_SLEEVE, ...rows(16, 19, 5, 15), ...rows(19, 20, 4, 16)],
        fill: 'var(--theme-accent)'
      }
    ],
    details: `
      <rect x="6" y="12" width="3" height="1" fill="#FFFFFF" opacity=".85" />
      <rect x="11" y="12" width="3" height="1" fill="#FFFFFF" opacity=".85" />
      <rect x="6" y="13" width="3" height="1" fill="#FFFFFF" opacity=".5" />
      <rect x="11" y="13" width="3" height="1" fill="#FFFFFF" opacity=".5" />
      <rect x="9" y="12" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="9" y="13" width="2" height="3" fill="var(--theme-accent-2)" />
      <rect x="9" y="15" width="2" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="5" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="13" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="5" y="15" width="10" height="1" fill="#0B0B10" opacity=".32" />
      <rect x="7" y="16" width="1" height="3" fill="#0B0B10" opacity=".22" />
      <rect x="10" y="16" width="1" height="3" fill="#0B0B10" opacity=".22" />
      <rect x="13" y="16" width="1" height="3" fill="#0B0B10" opacity=".22" />
      <rect x="4" y="19" width="12" height="1" fill="#0B0B10" opacity=".28" />
    `
  },
  /* Фартук: бретели с пряжками, ворот рубашки, карман с перегородкой, бейдж. */
  va11: {
    base: [
      { spans: rows(12, 14, 6, 14), fill: 'var(--theme-accent-2)' },
      { spans: rows(14, 20, 7, 13), fill: 'var(--theme-accent)' }
    ],
    details: `
      <rect x="9" y="12" width="2" height="1" fill="#FFFFFF" opacity=".5" />
      <rect x="8" y="12" width="1" height="2" fill="var(--theme-accent)" />
      <rect x="11" y="12" width="1" height="2" fill="var(--theme-accent)" />
      <rect x="8" y="13" width="1" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="11" y="13" width="1" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="7" y="14" width="6" height="1" fill="#0B0B10" opacity=".22" />
      <rect x="7" y="15" width="1" height="4" fill="#0B0B10" opacity=".16" />
      <rect x="12" y="15" width="1" height="4" fill="#0B0B10" opacity=".16" />
      <rect x="7" y="16" width="6" height="1" fill="#0B0B10" opacity=".26" />
      <rect x="10" y="17" width="1" height="2" fill="#0B0B10" opacity=".3" />
      <rect x="10" y="15" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="7" y="19" width="6" height="1" fill="#0B0B10" opacity=".24" />
    `
  },
  /* Худи: капюшон с подкладом, шнурки с наконечниками, карман-кенгуру, резинки. */
  hoodie: {
    base: [
      {
        spans: [
          ...rows(11, 13, 6, 10),
          ...rows(11, 13, 10, 14),
          ...rows(12, 16, 6, 14),
          ...SHORT_SLEEVE
        ],
        fill: 'var(--theme-accent)'
      }
    ],
    details: `
      <rect x="6" y="11" width="4" height="1" fill="#0B0B10" opacity=".28" />
      <rect x="10" y="11" width="4" height="1" fill="#0B0B10" opacity=".28" />
      <rect x="8" y="11" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="8" y="12" width="1" height="2" fill="var(--theme-accent-2)" />
      <rect x="11" y="12" width="1" height="2" fill="var(--theme-accent-2)" />
      <rect x="8" y="14" width="1" height="1" fill="#0B0B10" opacity=".45" />
      <rect x="11" y="14" width="1" height="1" fill="#0B0B10" opacity=".45" />
      <rect x="7" y="14" width="6" height="1" fill="#0B0B10" opacity=".14" />
      <rect x="7" y="14" width="2" height="1" fill="#0B0B10" opacity=".26" />
      <rect x="11" y="14" width="2" height="1" fill="#0B0B10" opacity=".26" />
      <rect x="5" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="13" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="6" y="15" width="8" height="1" fill="#0B0B10" opacity=".24" />
    `
  },
  /* Платье: ворот, швы лифа, бант на поясе, складки и рюш по подолу. */
  dress: {
    base: [
      {
        spans: [...rows(12, 16, 7, 13), ...SHORT_SLEEVE, ...rows(16, 19, 5, 15), ...rows(19, 20, 4, 16)],
        fill: 'var(--theme-accent)'
      }
    ],
    details: `
      <rect x="8" y="12" width="4" height="1" fill="#FFFFFF" opacity=".5" />
      <rect x="8" y="13" width="1" height="2" fill="#0B0B10" opacity=".18" />
      <rect x="11" y="13" width="1" height="2" fill="#0B0B10" opacity=".18" />
      <rect x="5" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="13" y="13" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="9" y="14" width="2" height="1" fill="var(--theme-accent-2)" />
      <rect x="7" y="15" width="6" height="1" fill="var(--theme-accent-2)" />
      <rect x="7" y="16" width="1" height="3" fill="#0B0B10" opacity=".16" />
      <rect x="10" y="16" width="1" height="3" fill="#0B0B10" opacity=".16" />
      <rect x="12" y="16" width="1" height="3" fill="#0B0B10" opacity=".16" />
      <rect x="4" y="19" width="12" height="1" fill="var(--theme-accent-2)" opacity=".85" />
    `
  }
};

/* ----------------------------------------------------------- аксессуары */

const ACCESSORY_PARTS = {
  none: { line: false, base: [], details: '' },
  /* Лента: крылья с тенью, узел со складкой и два хвостика. */
  doki: {
    line: false,
    base: [
      {
        spans: [
          [1, 7, 9], [1, 11, 13],
          [2, 6, 9], [2, 11, 14],
          [3, 7, 9], [3, 11, 13]
        ],
        fill: 'var(--theme-accent-2)'
      },
      { spans: rows(1, 4, 9, 11), fill: 'var(--theme-accent)' }
    ],
    details: `
      <rect x="6" y="2" width="1" height="1" fill="#0B0B10" opacity=".2" />
      <rect x="13" y="2" width="1" height="1" fill="#0B0B10" opacity=".2" />
      <rect x="9" y="2" width="2" height="1" fill="var(--theme-accent-2)" opacity=".8" />
      <rect x="7" y="1" width="1" height="1" fill="#FFFFFF" opacity=".45" />
      <rect x="9" y="4" width="1" height="1" fill="var(--theme-accent-2)" />
      <rect x="10" y="4" width="1" height="1" fill="var(--theme-accent-2)" />
    `
  },
  /* Визор: ремешок, линзы с бликами и верхняя кромка. */
  saya: {
    line: false,
    base: [{ spans: rows(6, 9, 6, 14), fill: 'var(--theme-accent-2)' }],
    details: `
      <rect x="7" y="6" width="1" height="2" fill="#0B0B10" opacity=".5" />
      <rect x="12" y="6" width="1" height="2" fill="#0B0B10" opacity=".5" />
      <rect x="7" y="6" width="1" height="1" fill="#FFFFFF" opacity=".55" />
      <rect x="12" y="6" width="1" height="1" fill="#FFFFFF" opacity=".3" />
      <rect x="6" y="6" width="4" height="1" fill="#FFFFFF" opacity=".14" />
      <rect x="10" y="7" width="2" height="1" fill="#0B0B10" opacity=".3" />
    `
  },
  /* Заколка: звезда с бликом и штифтом. */
  nine: {
    line: false,
    base: [
      {
        spans: [
          [2, 15, 16],
          [3, 13, 15],
          [4, 12, 16],
          [5, 13, 15],
          [6, 15, 16]
        ],
        fill: 'var(--theme-accent-2)'
      }
    ],
    details: `
      <rect x="12" y="4" width="1" height="1" fill="#FFFFFF" opacity=".7" />
      <rect x="13" y="6" width="1" height="1" fill="#0B0B10" opacity=".35" />
    `
  },
  /* Наушники: дуга с подушечкой, дужки, чашки с амбушюрами и микрофон. */
  va11: {
    line: false,
    base: [
      {
        spans: [
          ...rows(1, 2, 6, 14),
          ...rows(2, 5, 4, 5),
          ...rows(2, 5, 15, 16),
          ...rows(5, 8, 3, 6),
          ...rows(5, 8, 14, 17)
        ],
        fill: 'var(--theme-accent-2)'
      }
    ],
    details: `
      <rect x="7" y="1" width="6" height="1" fill="#FFFFFF" opacity=".14" />
      <rect x="4" y="6" width="1" height="1" fill="#0B0B10" opacity=".35" />
      <rect x="15" y="6" width="1" height="1" fill="#0B0B10" opacity=".35" />
      <rect x="5" y="7" width="1" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="14" y="7" width="1" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="4" y="5" width="1" height="1" fill="#FFFFFF" opacity=".2" />
      <rect x="13" y="7" width="1" height="1" fill="var(--theme-accent)" />
      <rect x="13" y="8" width="1" height="1" fill="var(--theme-accent)" opacity=".8" />
    `
  },
  /* Корона: обод, зубцы, камни и блики. */
  crown: {
    line: false,
    base: [
      {
        spans: [...rows(3, 5, 7, 13), [1, 7, 8], [1, 9, 11], [1, 12, 13]],
        fill: 'var(--theme-accent-2)'
      }
    ],
    details: `
      <rect x="7" y="3" width="6" height="1" fill="#0B0B10" opacity=".18" />
      <rect x="8" y="4" width="1" height="1" fill="var(--theme-accent)" />
      <rect x="10" y="4" width="2" height="1" fill="var(--theme-accent)" />
      <rect x="12" y="4" width="1" height="1" fill="var(--theme-accent)" />
      <rect x="7" y="1" width="1" height="1" fill="#FFFFFF" opacity=".5" />
      <rect x="12" y="2" width="1" height="1" fill="#FFFFFF" opacity=".3" />
    `
  },
  /* Очки: рамки, мост, дужки и блики на стёклах. */
  glasses: {
    line: false,
    base: [
      {
        spans: [
          ...rows(5, 6, 6, 9),
          ...rows(5, 6, 11, 14),
          ...rows(9, 10, 6, 9),
          ...rows(9, 10, 11, 14),
          ...rows(6, 9, 6, 7),
          ...rows(6, 9, 8, 9),
          ...rows(6, 9, 11, 12),
          ...rows(6, 9, 13, 14),
          ...rows(5, 6, 9, 11),
          ...rows(6, 8, 5, 6),
          ...rows(6, 8, 14, 15)
        ],
        fill: 'var(--theme-accent-2)'
      }
    ],
    details: `
      <rect x="6" y="5" width="1" height="1" fill="#FFFFFF" opacity=".45" />
      <rect x="11" y="5" width="1" height="1" fill="#FFFFFF" opacity=".3" />
      <rect x="5" y="8" width="1" height="1" fill="#0B0B10" opacity=".3" />
      <rect x="14" y="8" width="1" height="1" fill="#0B0B10" opacity=".3" />
    `
  }
};

/* --------------------------------------------------------------- сборка */

/**
 * Собирает inline SVG маскота. Все части — отдельные группы с data-part.
 * paletteId позволяет отрисовать маскота в теме предпросмотра, не меняя
 * палитру всего сайта.
 */
export function buildMascotSVG(state, { decorative = false, paletteId = state.paletteId } = {}) {
  const outfit = getOutfit(state.mascot.outfitId);
  const accessory = getAccessory(state.mascot.accessoryId);
  const palette = getPalette(paletteId || 'doki');

  const headColor = state.mascot.headColor;
  const bodyColor = state.mascot.bodyColor;
  const style = `--mascot-head:${headColor};--mascot-body:${bodyColor}`;

  /* Обводка — тёмный оттенок цвета слоя: живёт вместе с палитрой и ползунками. */
  const lines = {
    head: mix(headColor, INK, 0.94),
    body: mix(bodyColor, INK, 0.94),
    outfit: mix(palette.accent, INK, 0.94),
    accessory: mix(palette.accent2, INK, 0.94)
  };

  const label = `${t('mascot.caption')}: ${pick(outfit.label)}, ${pick(accessory.label)}`;
  const a11y = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${escapeHtml(label)}"`;

  const outfitPart = OUTFIT_PARTS[state.mascot.outfitId] || OUTFIT_PARTS.doki;
  const accessoryPart = ACCESSORY_PARTS[state.mascot.accessoryId] || ACCESSORY_PARTS.none;

  const bodySvg = layer('body', BODY_GROUPS, lines.body);
  const outfitSvg = layer('outfit', outfitPart.base, lines.outfit, outfitPart.details);
  const headSvg = layer('head', [{ spans: HEART, fill: 'var(--mascot-head)' }], lines.head, FACE);
  const accessorySvg = accessoryPart.base.length
    ? layer('accessory', accessoryPart.base, accessoryPart.line ? lines.accessory : null, accessoryPart.details)
    : '';

  return `<svg class="mascot-svg" viewBox="0 0 20 21" ${a11y} style="${style}">
    ${decorative ? '' : `<title>${escapeHtml(label)}</title>`}
    <g class="mascot">
      ${bodySvg}
      ${outfitSvg}
      ${headSvg}
      ${accessorySvg}
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
  const sitePalette = getPalette(state.paletteId);
  const previewPalette = getPalette(state.previewPaletteId || state.paletteId);

  document.querySelectorAll('[data-mascot-slot]').forEach((slot) => {
    const kind = slot.getAttribute('data-mascot-slot');
    /* Сцена живёт в теме сайта, а карточка и редактор — в теме предпросмотра. */
    const palette = kind === 'scene' ? sitePalette : previewPalette;
    if (kind !== 'scene') applyThemeVars(slot, palette);
    slot.innerHTML = buildMascotSVG(state, {
      decorative: kind === 'editor',
      paletteId: palette.id
    });
  });
}

function renderCard() {
  const state = getState();
  if (!card || !quoteElement) return;

  const font = getFont(state.fontId);
  const novel = getNovel(state.activeNovelId);
  const palette = getPalette(state.previewPaletteId || state.paletteId);
  const quote = state.quoteText.trim();
  const outfit = getOutfit(state.mascot.outfitId);
  const accessory = getAccessory(state.mascot.accessoryId);

  /* Одежда и аксессуары бывают «новелльные» и свободные: подпись под сценой
     честно говорит, что перед нами — вариант истории или собранный образ. */
  const novelVariant =
    NOVEL_IDS.includes(state.mascot.outfitId) && NOVEL_IDS.includes(state.mascot.accessoryId);

  /* Карточка — самостоятельный носитель: её можно посмотреть в другой теме,
     не перекрашивая весь сайт. */
  applyThemeVars(card, palette);
  card.style.setProperty('--quote-font', font.stack);
  card.style.setProperty('--quote-weight', String(state.fontWeight));
  card.style.setProperty('--quote-size', String(state.fontSize));

  quoteElement.textContent = quote || t('mascot.noQuote');
  quoteElement.dataset.empty = quote ? 'false' : 'true';

  if (sceneNovel) {
    sceneNovel.textContent = novelVariant
      ? t('mascot.sceneNote', { novel: novel.name })
      : t('mascot.sceneFree', { outfit: pick(outfit.label), accessory: pick(accessory.label) });
  }
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
    /* образ по умолчанию — вариант новеллы, чья тема сейчас выбрана */
    const novelId = getPalette(getState().paletteId).novelId;
    setState({
      mascot: { ...demoState.mascot, outfitId: novelId, accessoryId: novelId },
      mascotTouched: false
    });
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

/** Пока маскота не настраивали вручную, он носит вариант выбранной новеллы. */
function syncMascotWithPalette() {
  const state = getState();
  if (state.mascotTouched) return;

  const novelId = getPalette(state.paletteId).novelId;
  if (state.mascot.outfitId === novelId && state.mascot.accessoryId === novelId) return;

  setState({ mascot: { outfitId: novelId, accessoryId: novelId } });
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

  syncMascotWithPalette();
  renderChoices();
  renderAll();
  bindControls();
  bindDialog();

  subscribeTo(
    [
      'mascot',
      'mascotTouched',
      'quoteText',
      'fontId',
      'fontSize',
      'fontWeight',
      'paletteId',
      'previewPaletteId',
      'activeNovelId',
      'lang'
    ],
    (state, meta) => {
      if (meta.changed.includes('lang')) {
        renderChoices();
      }
      renderAll();
    }
  );

  initialized = true;
}
