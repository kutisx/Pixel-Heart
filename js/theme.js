/* =========================================================================
   theme.js — цветовая математика и применение темы палитры к сайту.
   Здесь же считаются контрасты, поэтому секция «Цвет» показывает реальные
   цифры, а кнопки всегда получают читаемый цвет подписи.
   ========================================================================= */

const HEX_SHORT = /^#?([0-9a-f]{3})$/i;
const HEX_LONG = /^#?([0-9a-f]{6})$/i;

export function parseHex(value) {
  if (typeof value !== 'string') return null;
  let match = HEX_LONG.exec(value.trim());
  if (match) {
    const hex = match[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }
  match = HEX_SHORT.exec(value.trim());
  if (match) {
    const [r, g, b] = match[1].split('');
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16)
    };
  }
  return null;
}

export function toHex({ r, g, b }) {
  const part = (channel) =>
    Math.round(Math.min(255, Math.max(0, channel)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Смешивает цвета: amount = 0 → a, amount = 1 → b. */
export function mix(a, b, amount) {
  const from = typeof a === 'string' ? parseHex(a) : a;
  const to = typeof b === 'string' ? parseHex(b) : b;
  if (!from || !to) return typeof a === 'string' ? a : '#000000';
  const t = Math.min(1, Math.max(0, amount));
  return toHex({
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t
  });
}

export function withAlpha(value, alpha) {
  const rgb = parseHex(value);
  if (!rgb) return value;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function channelLuminance(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function luminance(value) {
  const rgb = typeof value === 'string' ? parseHex(value) : value;
  if (!rgb) return 0;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Поднимает контраст цвета текста относительно фона до target.
 * Светлый фон — затемняем, тёмный — осветляем. Шаг 1.5%, максимум 60 итераций.
 */
export function ensureContrast(foreground, background, target = 4.5) {
  if (contrastRatio(foreground, background) >= target) return foreground;
  const towardLight = luminance(background) < 0.5;
  let result = foreground;
  for (let step = 1; step <= 60; step += 1) {
    result = mix(foreground, towardLight ? '#FFFFFF' : '#000000', (step * 1.5) / 100);
    if (contrastRatio(result, background) >= target) return result;
  }
  return result;
}

const DARK_INK = '#0B0B10';
const LIGHT_INK = '#F7F4FA';

function pickInk(surface) {
  const dark = contrastRatio(DARK_INK, surface);
  const light = contrastRatio(LIGHT_INK, surface);
  return dark >= light ? { color: DARK_INK, ratio: dark } : { color: LIGHT_INK, ratio: light };
}

/** Собирает все производные токены палитры и метрики контраста. */
export function buildTheme(palette) {
  const bg = palette.bg;
  const text = palette.text;
  const accent = palette.accent;
  const accent2 = palette.accent2;

  const ink = pickInk(accent);
  const ink2 = pickInk(accent2);

  return {
    paletteId: palette.id,
    bg,
    text,
    accent,
    accent2,
    glow: palette.glow,
    surface: mix(bg, '#FFFFFF', 0.05),
    surface2: mix(bg, '#FFFFFF', 0.1),
    line: withAlpha(text, 0.14),
    muted: ensureContrast(mix(text, bg, 0.34), bg, 4.6),
    onAccent: ink.color,
    onAccent2: ink2.color,
    accentText: ensureContrast(accent, bg, 4.5),
    accent2Text: ensureContrast(accent2, bg, 4.5),
    accentSoft: withAlpha(accent, 0.16),
    accent2Soft: withAlpha(accent2, 0.14),
    metrics: {
      textOnBg: contrastRatio(text, bg),
      onAccent: ink.ratio,
      onAccent2: ink2.ratio,
      accentText: contrastRatio(ensureContrast(accent, bg, 4.5), bg),
      accent2Text: contrastRatio(ensureContrast(accent2, bg, 4.5), bg)
    }
  };
}

const THEME_PROPERTIES = {
  bg: '--theme-bg',
  text: '--theme-text',
  accent: '--theme-accent',
  accent2: '--theme-accent-2',
  glow: '--theme-glow',
  surface: '--theme-surface',
  surface2: '--theme-surface-2',
  line: '--theme-line',
  muted: '--theme-muted',
  onAccent: '--theme-on-accent',
  onAccent2: '--theme-on-accent-2',
  accentText: '--theme-accent-text',
  accent2Text: '--theme-accent-2-text',
  accentSoft: '--theme-accent-soft',
  accent2Soft: '--theme-accent-2-soft'
};

/**
 * Записывает токены палитры в указанный корень. Так можно локально
 * перекрасить карточку маскота, макет или предпросмотр редактора, не трогая
 * тему всего сайта. Возвращает собранную тему.
 */
export function applyThemeVars(root, palette) {
  const theme = buildTheme(palette);

  Object.keys(THEME_PROPERTIES).forEach((key) => {
    root.style.setProperty(THEME_PROPERTIES[key], theme[key]);
  });
  root.setAttribute('data-theme', theme.paletteId);

  return theme;
}

/**
 * Применяет палитру к документу: тёмный фон, светлый текст, акценты,
 * свечение и производные поверхности. Возвращает метрики для интерфейса.
 */
export function applyTheme(palette, root = document.documentElement) {
  const theme = applyThemeVars(root, palette);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.bg);

  return theme;
}
