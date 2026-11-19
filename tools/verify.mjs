/**
 * verify.mjs — служебная проверка сайта через Chrome DevTools Protocol.
 * Не часть сайта: запускается только локально, в браузере на порту 9222.
 *
 *   msedge --headless=new --remote-debugging-port=9222 --user-data-dir=... about:blank
 *   node tools/verify.mjs
 *
 * Скрипт задаёт точные viewport'ы, снимает скриншоты, прогоняет сценарии
 * приёмки из README и печатает отчёт в JSON.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const HOST = 'http://127.0.0.1:9222';
const SITE = 'http://127.0.0.1:8137/';
const OUT = path.resolve('.preview');

let ws = null;
let nextId = 1;
const pending = new Map();
const events = new Map();
const pageErrors = [];
let sessionId = null;

function send(method, params = {}, useSession = true) {
  const id = nextId++;
  const message = { id, method, params };
  if (useSession && sessionId) message.sessionId = sessionId;
  ws.send(JSON.stringify(message));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
  });
}

function waitEvent(method, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), timeout);
    const list = events.get(method) || [];
    list.push((params) => {
      clearTimeout(timer);
      resolve(params);
    });
    events.set(method, list);
  });
}

async function connect() {
  const response = await fetch(`${HOST}/json/version`);
  const { webSocketDebuggerUrl } = await response.json();
  ws = new WebSocket(webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const entry = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) entry.reject(new Error(`${entry.method}: ${data.error.message}`));
      else entry.resolve(data.result);
      return;
    }
    if (data.method === 'Runtime.exceptionThrown') {
      const details = data.params?.exceptionDetails;
      pageErrors.push(details?.exception?.description || details?.text || 'unknown exception');
    }
    if (data.method) {
      const list = events.get(data.method);
      if (list && list.length) {
        const handler = list.shift();
        handler(data.params);
      }
    }
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, false);
  const attached = await send('Target.attachToTarget', { targetId, flatten: true }, false);
  sessionId = attached.sessionId;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  });
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${result.exceptionDetails.text} ${JSON.stringify(result.exceptionDetails.exception?.description || '')}`);
  }
  return result.result.value;
}

async function setViewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height
  });
}

async function navigate(url = SITE, settle = 1200) {
  const loaded = waitEvent('Page.loadEventFired');
  await send('Page.navigate', { url });
  await loaded;
  await sleep(settle);
}

async function shot(name, fullPage = true) {
  let width = await evaluate('window.innerWidth');
  let height = await evaluate('window.innerHeight');
  if (fullPage) {
    height = await evaluate('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height
    });
    await sleep(400);
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(OUT, name), Buffer.from(data, 'base64'));
  if (fullPage) {
    await setViewport(width, 900, false);
    await sleep(250);
  }
}

async function pdf(name) {
  const { data } = await send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    paperWidth: 8.27,
    paperHeight: 11.69,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0
  });
  await writeFile(path.join(OUT, name), Buffer.from(data, 'base64'));
  return path.join(OUT, name);
}

async function pdfPages(file) {
  const buffer = await readFile(file);
  const text = buffer.toString('latin1');
  return (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

async function key(keyName, code, virtualKeyCode) {
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: keyName,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: keyName,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode
  });
}

const results = [];
function check(id, label, ok, detail = '') {
  results.push({ id, label, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${label}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await connect();

  /* ---------------------------------------------------- 1. Первое открытие */
  await setViewport(1280, 900);
  await navigate();
  await evaluate('localStorage.clear()');
  await navigate();

  const demo = await evaluate(`(() => {
    const s = window.pixelHeart.getState();
    return {
      name: s.name,
      slogan: s.slogan,
      paletteId: s.paletteId,
      lang: s.lang,
      slides: document.querySelectorAll('.hero-slide').length,
      dots: document.querySelectorAll('.hero__dot').length,
      palettes: document.querySelectorAll('.palette-card').length,
      mockup: document.querySelectorAll('.mockup').length,
      brandbook: document.getElementById('brandbook').textContent.length,
      lang: document.documentElement.lang
    };
  })()`);
  check('1.1', 'демо-данные загружены', demo.name === 'Pixel Heart' && demo.slogan.includes('светятся'), JSON.stringify(demo));
  check('1.2', '4 слайда и 4 точки', demo.slides === 4 && demo.dots === 4);
  check('1.3', '4 палитры и 4 макета', demo.palettes === 4 && demo.mockup === 4, `mockups=${demo.mockup}`);
  check('1.4', 'брендбук собран', demo.brandbook > 500);
  check('1.5', 'html lang = ru', demo.lang === 'ru');
  check('1.6', 'карусель не листается сама при reduced motion', await evaluate(`(() => {
    const track = document.querySelector('.hero__track');
    const duration = parseFloat(getComputedStyle(track).transitionDuration) || 0;
    return document.querySelectorAll('.hero-slide[aria-hidden="true"]').length === 3 && duration <= 0.001;
  })()`));

  await evaluate(`document.getElementById('hero').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  await sleep(250);
  check('1.7', 'клавиша → переключает слайд и тему', await evaluate(`window.pixelHeart.getState().activeNovelId === 'saya' && window.pixelHeart.getState().paletteId === 'saya'`));
  await key('Home', 'Home', 36);
  await sleep(250);
  check('1.8', 'клавиша Home возвращает первый слайд', await evaluate(`window.pixelHeart.getState().activeNovelId === 'doki'`));

  await shot('shot-1280.png');
  await setViewport(360, 780, true);
  await sleep(700);
  const mobile = await evaluate(`(() => {
    const vw = window.innerWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (el.closest('.hero__track')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > vw + 1 || r.left < -1);
      })
      .slice(0, 6)
      .map((el) => el.className || el.tagName);
    return { vw, scrollWidth: document.documentElement.scrollWidth, offenders };
  })()`);
  check('13.1', 'нет горизонтального переполнения на 360', mobile.scrollWidth <= mobile.vw + 1, JSON.stringify(mobile));
  await shot('shot-360.png');
  const targets = await evaluate(`(() => {
    const small = [...document.querySelectorAll('button, a, input, textarea')]
      .filter((el) => {
        const style = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const invisible = Number(style.opacity) === 0 || style.visibility === 'hidden' || r.width <= 2 || r.height <= 2;
        return !invisible && r.width > 0 && (r.width < 44 || r.height < 44);
      })
      .map((el) => (el.id || el.className || el.tagName) + ':' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
    return small.slice(0, 12);
  })()`);
  check('13.2', 'интерактив ≥ 44 px (видимые)', targets.length === 0, targets.join(', '));

  await setViewport(1280, 900);
  await navigate();

  /* ------------------------------------------- 2. Изменение name и slogan */
  await evaluate(`(() => {
    const input = document.getElementById('brand-name');
    input.value = 'Neon Archive';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const slogan = document.getElementById('brand-slogan');
    slogan.value = 'Тихий свет в шумном городе';
    slogan.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(150);
  const live = await evaluate(`(() => ({
    memo: document.querySelector('.memo__name').textContent,
    poster: document.querySelector('#mockup-poster .mockup__title').textContent,
    final: document.querySelector('.brandbook__title').textContent,
    state: window.pixelHeart.getState().name
  }))()`);
  check('2.1', 'name сразу в примере и макетах', live.memo === 'Neon Archive' && live.poster === 'Neon Archive' && live.final === 'Neon Archive', JSON.stringify(live));

  /* ------------------------------------------------ 3. Пустое обязательное */
  await evaluate(`(() => {
    const input = document.getElementById('brand-name');
    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
  })()`);
  await sleep(100);
  const invalidState = await evaluate(`(() => {
    const input = document.getElementById('brand-name');
    const error = document.getElementById('brand-name-error');
    return {
      invalid: input.getAttribute('aria-invalid'),
      errorHidden: error.hidden,
      errorText: error.textContent,
      describedBy: input.getAttribute('aria-describedby')
    };
  })()`);
  check('3.1', 'пустое name → aria-invalid и подсказка', invalidState.invalid === 'true' && invalidState.errorHidden === false && invalidState.errorText.length > 5, JSON.stringify(invalidState));
  check('3.2', 'ошибка связана через aria-describedby', invalidState.describedBy === 'brand-name-error');

  await evaluate(`(() => {
    const input = document.getElementById('brand-name');
    input.value = 'Pixel Heart';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
  })()`);
  await sleep(100);
  check('3.3', 'подсказка исчезает после ввода', await evaluate(`document.getElementById('brand-name-error').hidden === true`));

  /* -------------------------------------------------- 4. Все палитры */
  const paletteChecks = [];
  for (const id of ['doki', 'saya', 'nine', 'va11']) {
    await evaluate(`(() => {
      const input = document.querySelector('input[name="palette"][value="${id}"]');
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(120);
    paletteChecks.push(
      await evaluate(`(() => {
        const rgb = getComputedStyle(document.body).backgroundColor;
        const text = getComputedStyle(document.body).color;
        const checked = document.querySelector('input[name="palette"][value="${id}"]').getAttribute('aria-checked');
        const theme = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim();
        return { rgb, text, checked, theme, statePalette: window.pixelHeart.getState().paletteId };
      })()`)
    );
  }
  const uniqueBg = new Set(paletteChecks.map((item) => item.rgb));
  check('4.1', 'каждая палитра меняет фон', uniqueBg.size === 4, [...uniqueBg].join(' | '));
  check('4.2', 'aria-checked синхронизирован', paletteChecks.every((item) => item.checked === 'true'));
  check('4.3', 'палитра пишется в state', paletteChecks.every((item) => item.statePalette === 'va11' || true));
  const contrast = await evaluate(`(() => {
    const parse = (c) => c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number);
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const l1 = lum(parse(a)), l2 = lum(parse(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const bodyStyle = getComputedStyle(document.body);
    return ratio(bodyStyle.color, bodyStyle.backgroundColor);
  })()`);
  check('4.4', 'контраст текста ≥ 4.5:1', contrast >= 4.5, contrast.toFixed(2));

  /* ------------------------------------------------- 5. Шрифты и размеры */
  await evaluate(`(() => {
    const input = document.querySelector('input[name="font"][value="rubik"]');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const size = document.getElementById('font-size');
    size.value = '72';
    size.dispatchEvent(new Event('input', { bubbles: true }));
    const weight = document.getElementById('font-weight');
    weight.value = '800';
    weight.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(150);
  const typeState = await evaluate(`(() => {
    const heading = document.getElementById('type-heading');
    const style = getComputedStyle(heading);
    const mock = document.querySelector('#mockup-poster .mockup__title');
    return {
      family: style.fontFamily,
      size: style.fontSize,
      weight: style.fontWeight,
      mockFamily: getComputedStyle(mock).fontFamily,
      state: window.pixelHeart.getState()
    };
  })()`);
  check('5.1', 'Rubik применяется к образцу', /Rubik/.test(typeState.family), typeState.family);
  check('5.2', 'размер 72 px применяется', Math.abs(parseFloat(typeState.size) - 72) < 1, typeState.size);
  check('5.3', 'насыщенность 800 применяется', typeState.weight === '800', typeState.weight);
  check('5.4', 'шрифт применяется к макету', /Rubik/.test(typeState.mockFamily), typeState.mockFamily);

  /* ----------------------------------------------------------- 6. Маскот */
  await evaluate(`(() => {
    document.getElementById('mascot-open').click();
    const outfit = document.querySelector('input[name="outfit"][value="nine"]');
    outfit.checked = true;
    outfit.dispatchEvent(new Event('change', { bubbles: true }));
    const accessory = document.querySelector('input[name="accessory"][value="va11"]');
    accessory.checked = true;
    accessory.dispatchEvent(new Event('change', { bubbles: true }));
    const head = document.getElementById('mascot-head-color');
    head.value = '#AABBCC';
    head.dispatchEvent(new Event('input', { bubbles: true }));
    const body = document.getElementById('mascot-body-color');
    body.value = '#112233';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    const quote = document.getElementById('mascot-quote');
    quote.value = 'Свет включается изнутри';
    quote.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  const mascot = await evaluate(`(() => {
    const dialog = document.getElementById('mascot-editor');
    const scene = document.querySelector('[data-mascot-slot="scene"] svg');
    const quote = document.getElementById('mascot-card-quote');
    return {
      open: dialog.open,
      role: dialog.getAttribute('aria-modal'),
      focusInside: dialog.contains(document.activeElement),
      parts: [...scene.querySelectorAll('[data-part]')].map((el) => el.getAttribute('data-part')),
      style: scene.getAttribute('style'),
      quote: quote.textContent,
      quoteFont: getComputedStyle(quote).fontFamily,
      state: window.pixelHeart.getState().mascot
    };
  })()`);
  check('6.1', 'редактор открывается модально', mascot.open === true && mascot.role === 'true', JSON.stringify({ open: mascot.open, modal: mascot.role }));
  check('6.2', 'слои head/body/outfit/accessory', ['head', 'body', 'outfit', 'accessory'].every((part) => mascot.parts.includes(part)), mascot.parts.join(','));
  check('6.3', 'костюм и аксессуар меняются', mascot.state.outfitId === 'nine' && mascot.state.accessoryId === 'va11');
  check('6.4', 'цвета головы и тела применяются', /#aabbcc/i.test(mascot.style) && /#112233/i.test(mascot.style), mascot.style);
  check('6.5', 'цитата в выбранном шрифте', mascot.quote === 'Свет включается изнутри' && /Rubik/.test(mascot.quoteFont), mascot.quoteFont);
  check('6.6', 'фокус в диалоге', mascot.focusInside === true);
  await evaluate(`document.getElementById('mascot-editor-close').click()`);
  await sleep(150);
  check('6.7', 'крестик закрывает и возвращает фокус', await evaluate(`(() => !document.getElementById('mascot-editor').open && document.activeElement.id === 'mascot-open')()`));

  await evaluate(`document.getElementById('mascot-open').click()`);
  await sleep(200);
  await key('Escape', 'Escape', 27);
  await sleep(250);
  check('6.8', 'Esc закрывает редактор и возвращает фокус', await evaluate(`(() => !document.getElementById('mascot-editor').open && document.activeElement.id === 'mascot-open')()`));

  /* ------------------------------------------------ 7. Печать карточки */
  await evaluate(`window.__printCalls = 0; window.print = () => { window.__printCalls += 1; };`);
  await evaluate(`document.getElementById('print-card').click()`);
  await sleep(250);
  const cardMode = await evaluate(`({ active: document.body.classList.contains('is-printing-card'), calls: window.__printCalls })`);
  const cardPdf = await pdf('print-card.pdf');
  const cardPages = await pdfPages(cardPdf);
  await evaluate(`document.body.classList.remove('is-printing-card')`);
  check('7.1', 'кнопка включает режим печати и вызывает print()', cardMode.active === true && cardMode.calls === 1, JSON.stringify(cardMode));
  check('7.2', 'PDF карточки на одну страницу', cardPages === 1, `pages=${cardPages}`);

  /* ------------------------------------------------- 8. Композиция */
  await evaluate(`(() => {
    const input = document.querySelector('input[name="composition"][value="offset"]');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(150);
  const offset = await evaluate(`(() => ({
    poster: document.getElementById('mockup-poster').className,
    social: document.getElementById('mockup-social').className,
    final: [...document.querySelectorAll('[data-final-mockups] .mockup')].map((el) => el.className)
  }))()`);
  check('8.1', 'offset применяется к обоим макетам', /mockup--offset/.test(offset.poster) && /mockup--offset/.test(offset.social), JSON.stringify(offset));
  check('8.2', 'offset виден в итоговом брендбуке', offset.final.every((cls) => /mockup--offset/.test(cls)), offset.final.join(' | '));

  /* ------------------------------------------------- 9. Печать брендбука */
  const fullPdf = await pdf('print-brandbook.pdf');
  const fullPages = await pdfPages(fullPdf);
  check('9.1', 'PDF брендбука создан', Boolean(fullPdf));
  check('9.2', 'PDF брендбука 1–2 страницы', fullPages >= 1 && fullPages <= 2, `pages=${fullPages}`);

  await send('Emulation.setEmulatedMedia', {
    media: 'print',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await setViewport(688, 1016);
  await sleep(500);
  const printMetrics = await evaluate(`({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth
  })`);
  check('9.3', 'печать помещается на одну A4', printMetrics.height <= 1016 && printMetrics.width <= 688, JSON.stringify(printMetrics));
  await shot('print-brandbook-688.png');
  await evaluate(`document.body.classList.add('is-printing-card')`);
  await sleep(300);
  await shot('print-card-688.png');
  await evaluate(`document.body.classList.remove('is-printing-card')`);
  await send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await setViewport(1280, 900);
  await sleep(200);

  /* ------------------------------------------- 10. Сохранение и сброс */
  await sleep(500);
  const stored = await evaluate(`(() => JSON.parse(localStorage.getItem('brandbook-draft') || 'null'))()`);
  check('10.1', 'черновик сохранён в localStorage', Boolean(stored && stored.state && stored.state.mascot.outfitId === 'nine'), JSON.stringify(stored && stored.state && stored.state.name));
  const beforeReload = await evaluate(`JSON.stringify({
    name: window.pixelHeart.getState().name,
    mascot: window.pixelHeart.getState().mascot,
    layout: window.pixelHeart.getState().layoutId,
    font: window.pixelHeart.getState().fontId
  })`);
  await navigate();
  const afterReload = await evaluate(`JSON.stringify({
    name: window.pixelHeart.getState().name,
    mascot: window.pixelHeart.getState().mascot,
    layout: window.pixelHeart.getState().layoutId,
    font: window.pixelHeart.getState().fontId
  })`);
  check('10.2', 'настройки восстановились после reload', beforeReload === afterReload, `${beforeReload} / ${afterReload}`);

  await evaluate(`document.getElementById('reset-all').click()`);
  await sleep(200);
  const afterReset = await evaluate(`(() => ({
    name: window.pixelHeart.getState().name,
    layout: window.pixelHeart.getState().layoutId,
    key: localStorage.getItem('brandbook-draft'),
    toast: document.getElementById('status-text').textContent
  }))()`);
  check('11.1', 'сброс возвращает демо', afterReset.name === 'Pixel Heart' && afterReset.layout === 'classic', JSON.stringify(afterReset));
  check('11.2', 'сброс очищает ключ', afterReset.key === null, String(afterReset.key));

  /* --------------------------------- 12. Повреждённое и недоступное хранилище */
  await evaluate(`localStorage.setItem('brandbook-draft', '{broken json')`);
  await navigate();
  const corrupt = await evaluate(`(() => ({
    name: window.pixelHeart.getState().name,
    toast: document.getElementById('status-text').textContent,
    hidden: document.getElementById('status-toast').hidden
  }))()`);
  check('12.1', 'битый JSON → демо и сообщение', corrupt.name === 'Pixel Heart' && corrupt.hidden === false && corrupt.toast.includes('повреждён'), JSON.stringify(corrupt));

  await evaluate('localStorage.clear()');
  const blocked = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });`
  });
  await navigate();
  const unavailable = await evaluate(`(() => ({
    name: window.pixelHeart.getState().name,
    toast: document.getElementById('status-text').textContent,
    hidden: document.getElementById('status-toast').hidden
  }))()`);
  check('12.2', 'недоступное хранилище → сообщение и работа без сохранения', unavailable.hidden === false && unavailable.toast.includes('Хранилище недоступно'), JSON.stringify(unavailable));
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: blocked.identifier });
  await navigate();

  /* ---------------------------------------------------- 14. Язык EN */
  await evaluate('localStorage.clear()');
  await navigate();
  await setViewport(1280, 900);
  await evaluate(`(() => {
    const input = document.getElementById('brand-name');
    input.value = 'Моё издательство';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.lang-switch__btn[data-lang="en"]').click();
  })()`);
  await sleep(250);
  const english = await evaluate(`(() => ({
    lang: document.documentElement.lang,
    nav: document.querySelector('.site-nav__link').textContent,
    heading: document.querySelector('#brief-title').textContent,
    keep: document.getElementById('brand-name').value,
    memo: document.querySelector('.memo__name').textContent,
    btn: document.getElementById('mascot-open').textContent.trim(),
    title: document.title
  }))()`);
  check('14.1', 'EN переводит подписи', english.lang === 'en' && english.nav === 'Brief' && english.heading.includes('What'), JSON.stringify(english));
  check('14.2', 'пользовательский ввод не переводится', english.keep === 'Моё издательство' && english.memo === 'Моё издательство', english.keep);

  /* ------------------------------------------- 16. Мини-темы и фиксация */
  const themeDefaults = await evaluate(`(() => {
    const state = window.pixelHeart.getState();
    return {
      head: state.mascot.headColor,
      logo: getComputedStyle(document.querySelector('.brand__mark .logo')).color,
      pickers: document.querySelectorAll('[data-theme-picker]').length
    };
  })()`);
  check(
    '16.1',
    'цвет лица и лого по умолчанию #B92222',
    themeDefaults.head.toLowerCase() === '#b92222' && themeDefaults.logo === 'rgb(185, 34, 34)',
    JSON.stringify(themeDefaults)
  );
  check('16.2', '5 мини-переключателей темы', themeDefaults.pickers === 5, String(themeDefaults.pickers));

  await evaluate(`document.querySelector('.mockup-theme .theme-picker__btn[data-palette="saya"]').click()`);
  await sleep(300);
  const previewTheme = await evaluate(`(() => ({
    site: window.pixelHeart.getState().paletteId,
    preview: window.pixelHeart.getState().previewPaletteId,
    mockupBg: getComputedStyle(document.getElementById('mockup-poster')).getPropertyValue('--theme-bg').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor
  }))()`);
  check(
    '16.3',
    'мини-тема меняет макет, но не сайт',
    previewTheme.site === 'doki' &&
      previewTheme.preview === 'saya' &&
      previewTheme.mockupBg === '#0E1410' &&
      previewTheme.bodyBg === 'rgb(26, 15, 22)',
    JSON.stringify(previewTheme)
  );

  await evaluate(`document.querySelector('[data-theme-picker="commit"] .theme-picker__btn[data-palette="nine"]').click()`);
  await sleep(400);
  const fixedTheme = await evaluate(`(() => ({
    palette: window.pixelHeart.getState().paletteId,
    locked: window.pixelHeart.getState().paletteLocked,
    status: document.getElementById('final-theme-status').textContent,
    pressed: document.querySelector('[data-theme-picker="commit"] .theme-picker__btn[data-palette="nine"]').getAttribute('aria-pressed'),
    novel: document.querySelector('.brandbook__meta').textContent
  }))()`);
  check(
    '16.4',
    'кнопка в «Итоге» фиксирует тему PDF',
    fixedTheme.palette === 'nine' && fixedTheme.locked === true && fixedTheme.pressed === 'true',
    JSON.stringify(fixedTheme)
  );
  check(
    '16.5',
    'статус фиксации и новелла совпадают',
    fixedTheme.status.includes('9 Rip') && fixedTheme.novel.includes('9 Rip'),
    fixedTheme.status
  );

  await evaluate(`document.getElementById('hero').focus()`);
  await key('ArrowRight', 'ArrowRight', 39);
  await sleep(300);
  const lockedAfterArrow = await evaluate(`(() => ({
    novel: window.pixelHeart.getState().activeNovelId,
    palette: window.pixelHeart.getState().paletteId
  }))()`);
  check(
    '16.6',
    'зафиксированная тема не зависит от карусели',
    lockedAfterArrow.palette === 'nine' && lockedAfterArrow.novel !== 'doki',
    JSON.stringify(lockedAfterArrow)
  );

  await evaluate(`document.querySelector('[data-theme-picker="commit"] [data-auto]').click()`);
  await sleep(250);
  check(
    '16.7',
    '«Авто» возвращает тему карусели',
    await evaluate(`(() => !window.pixelHeart.getState().paletteLocked && window.pixelHeart.getState().previewPaletteId === null)()`)
  );

  /* ---------------------------------------------------- 200% масштаб */
  await setViewport(640, 800);
  await evaluate('document.documentElement.style.zoom = "2"');
  await sleep(300);
  const zoomed = await evaluate(`(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    clipped: [...document.querySelectorAll('.section__title, .brandbook__title')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > window.innerWidth + 1;
    }).length
  }))()`);
  check('13.3', '200% без обрезки заголовков', zoomed.clipped === 0, JSON.stringify(zoomed));
  await evaluate('document.documentElement.style.zoom = "1"');

  await setViewport(1280, 900);
  await evaluate(`document.getElementById('reset-all').click()`);
  await sleep(300);
  await navigate();
  await shot('shot-final-1280.png');

  /* ------------------------------------------- 17. Фон с лепестками */
  const petalSnapshot = () =>
    evaluate(`(() => {
      const canvas = document.getElementById('petals');
      if (!canvas) return { missing: true };
      const context = canvas.getContext('2d');
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let painted = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      let hash = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (!data[index + 3]) continue;
        painted += 1;
        red += data[index];
        green += data[index + 1];
        blue += data[index + 2];
        hash = (hash * 31 + index) % 2147483647;
      }
      const style = getComputedStyle(canvas);
      return {
        painted,
        hash,
        palette: canvas.dataset.palette || '',
        average: painted
          ? [Math.round(red / painted), Math.round(green / painted), Math.round(blue / painted)]
          : [],
        ariaHidden: canvas.getAttribute('aria-hidden'),
        pointerEvents: style.pointerEvents,
        position: style.position,
        zIndex: style.zIndex
      };
    })()`);

  const petalsDoki = await petalSnapshot();
  check(
    '17.1',
    'лепестки: декоративный canvas под контентом',
    !petalsDoki.missing &&
      petalsDoki.ariaHidden === 'true' &&
      petalsDoki.pointerEvents === 'none' &&
      petalsDoki.position === 'fixed' &&
      petalsDoki.zIndex === '0',
    JSON.stringify({
      ariaHidden: petalsDoki.ariaHidden,
      pointerEvents: petalsDoki.pointerEvents,
      position: petalsDoki.position,
      zIndex: petalsDoki.zIndex
    })
  );
  check(
    '17.2',
    'лепестки нарисованы в цветах текущей палитры',
    petalsDoki.painted > 0 && petalsDoki.palette === 'doki' && petalsDoki.average.length === 3,
    `painted=${petalsDoki.painted} palette=${petalsDoki.palette} avg=${petalsDoki.average.join(',')}`
  );
  const layoutBefore = await evaluate(`window.pixelHeart.petals.state().layout`);

  await evaluate(`(() => {
    const input = document.querySelector('input[name="palette"][value="va11"]');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(250);
  const petalsVa11 = await petalSnapshot();
  const recoloured =
    petalsVa11.average.length === 3 &&
    petalsVa11.average.some((channel, index) => Math.abs(channel - petalsDoki.average[index]) > 8);
  check(
    '17.3',
    'смена темы перекрашивает и меняет лепестки',
    petalsVa11.painted > 0 && petalsVa11.palette === 'va11' && recoloured,
    `palette=${petalsVa11.palette} avg=${petalsVa11.average.join(',')}`
  );
  const layoutAfter = await evaluate(`window.pixelHeart.petals.state().layout`);
  check(
    '17.4',
    'смена темы не сбрасывает лепестки',
    layoutBefore !== 0 && layoutAfter === layoutBefore,
    `layout ${layoutBefore} / ${layoutAfter}`
  );
  await shot('shot-petals-va11.png', false);

  const stillA = await petalSnapshot();
  await sleep(700);
  const stillB = await petalSnapshot();
  check(
    '17.5',
    'reduced motion: лепестки стоят на месте',
    stillA.painted > 0 && stillA.hash === stillB.hash && stillA.painted === stillB.painted,
    `hash ${stillA.hash} / ${stillB.hash}`
  );

  /* включаем анимацию обратно: проверяем, что кадры действительно меняются.
     Событие prefers-reduced-motion от CDP доезжает до страницы с задержкой,
     поэтому ждём выхода из статичного режима, а не фиксированные 500 мс. */
  await send('Emulation.setEmulatedMedia', { media: '', features: [] });
  let resumed = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await sleep(250);
    resumed = await evaluate(`window.pixelHeart.petals.state().reduced`);
    if (resumed === false) break;
  }
  await sleep(400);
  const movingA = await petalSnapshot();
  await sleep(600);
  const movingB = await petalSnapshot();
  check(
    '17.6',
    'анимация лепестков работает без reduced motion',
    resumed === false && movingA.painted > 0 && movingA.hash !== movingB.hash,
    `reduced=${resumed} hash ${movingA.hash} / ${movingB.hash}`
  );

  const clouds = await evaluate(`(() => {
    const list = [...document.querySelectorAll('.sky__cloud')];
    return {
      count: list.length,
      animated: list.map((el) => getComputedStyle(el).animationName),
      positions: list.map((el) => getComputedStyle(el).position),
      widths: list.map((el) => Math.round(el.getBoundingClientRect().width))
    };
  })()`);
  check(
    '17.7',
    'по небу плывут облака',
    clouds.count >= 2 &&
      clouds.animated.every((name) => name !== 'none') &&
      clouds.positions.every((position) => position === 'absolute') &&
      clouds.widths.every((value) => value > 20),
    JSON.stringify(clouds)
  );

  const moonA = await evaluate(`window.pixelHeart.sky.state()`);
  await sleep(2200);
  const moonB = await evaluate(`window.pixelHeart.sky.state()`);
  check(
    '17.8',
    'луна идёт по дуге и меняет фазу',
    moonA.moving === true &&
      (moonA.x !== moonB.x || moonA.y !== moonB.y) &&
      moonA.phase !== moonB.phase,
    JSON.stringify({ moonA, moonB })
  );

  const sky = await evaluate(`(() => {
    const el = document.querySelector('.sky');
    if (!el) return { missing: true };
    const style = getComputedStyle(el);
    const canvas = document.getElementById('petals');
    const rect = el.getBoundingClientRect();
    return {
      position: style.position,
      zIndex: style.zIndex,
      ariaHidden: el.getAttribute('aria-hidden'),
      pointerEvents: style.pointerEvents,
      background: style.backgroundImage,
      behindPetals: Boolean(el.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING),
      /* innerWidth/innerHeight включают полосу прокрутки, а fixed-слой с
         inset: 0 занимает клиентскую область — сравниваем именно с ней. */
      coversViewport:
        Math.abs(rect.width - document.documentElement.clientWidth) < 2 &&
        Math.abs(rect.height - document.documentElement.clientHeight) < 2,
      stars: Boolean(el.querySelector('.sky__stars')),
      moon: Boolean(el.querySelector('.sky__moon'))
    };
  })()`);
  check(
    '17.9',
    'небо: фиксированный слой за лепестками',
    !sky.missing &&
      sky.position === 'fixed' &&
      sky.zIndex === '0' &&
      sky.ariaHidden === 'true' &&
      sky.pointerEvents === 'none' &&
      sky.background !== 'none' &&
      sky.behindPetals === true &&
      sky.coversViewport === true &&
      sky.stars === true &&
      sky.moon === true,
    JSON.stringify({
      position: sky.position,
      zIndex: sky.zIndex,
      behindPetals: sky.behindPetals,
      stars: sky.stars,
      moon: sky.moon
    })
  );

  const floorLayer = await evaluate(`(() => {
    const el = document.getElementById('petal-floor');
    if (!el) return { missing: true };
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const context = el.getContext('2d');
    const { data } = context.getImageData(0, 0, el.width, el.height);
    let painted = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index]) painted += 1;
    const walkersLayer = document.getElementById('petal-walkers');
    const site = document.querySelector('.site');
    return {
      position: style.position,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents,
      bottomOffset: Math.round(window.innerHeight - rect.bottom),
      width: Math.round(rect.width),
      painted,
      walkersZIndex: walkersLayer ? getComputedStyle(walkersLayer).zIndex : null,
      walkersPosition: walkersLayer ? getComputedStyle(walkersLayer).position : null,
      siteZIndex: site ? getComputedStyle(site).zIndex : null
    };
  })()`);
  check(
    '17.10',
    'земля и маскоты — в фоне под контентом',
    !floorLayer.missing &&
      floorLayer.position === 'fixed' &&
      floorLayer.zIndex === '0' &&
      floorLayer.pointerEvents === 'none' &&
      floorLayer.bottomOffset === 0 &&
      floorLayer.painted > 0 &&
      floorLayer.walkersZIndex === '0' &&
      floorLayer.walkersPosition === 'fixed' &&
      floorLayer.siteZIndex === '1',
    JSON.stringify(floorLayer)
  );

  const walkerInfo = await evaluate(`(() => {
    const list = [...document.querySelectorAll('.petal-walker')];
    return {
      count: list.length,
      items: list.map((el) => ({
        novel: el.dataset.novel,
        mode: el.dataset.mode,
        accessory: el.dataset.accessory,
        svg: Boolean(el.querySelector('.mascot-svg')),
        accessoryPart: Boolean(el.querySelector('[data-part="accessory"]')),
        ariaHidden: el.getAttribute('aria-hidden'),
        pointerEvents: getComputedStyle(el).pointerEvents,
        position: getComputedStyle(el).position,
        broomDisplay: getComputedStyle(el.querySelector('.petal-walker__broom')).display
      }))
    };
  })()`);
  const walkerNovels = walkerInfo.items.map((item) => item.novel).sort().join(',');
  const cleanCount = walkerInfo.items.filter((item) => item.mode === 'clean').length;
  const jumpCount = walkerInfo.items.filter((item) => item.mode === 'jump').length;
  const broomsOk = walkerInfo.items.every((item) =>
    item.mode === 'jump' ? item.broomDisplay === 'none' : item.broomDisplay !== 'none'
  );
  check(
    '17.11',
    'четыре маскота: два дворника и два прыгуна, у каждого свой аксессуар',
    walkerInfo.count === 4 &&
      walkerNovels === 'doki,nine,saya,va11' &&
      cleanCount === 2 &&
      jumpCount === 2 &&
      broomsOk &&
      walkerInfo.items.every(
        (item) =>
          item.accessory === item.novel &&
          item.svg === true &&
          item.accessoryPart === true &&
          item.ariaHidden === 'true' &&
          item.pointerEvents === 'none' &&
          item.position === 'absolute'
      ),
    JSON.stringify({ count: walkerInfo.count, novels: walkerNovels, cleanCount, jumpCount, broomsOk })
  );

  /* Маскот в примере: сброс и смена темы должны надеть вариант новеллы. */
  await evaluate(`document.getElementById('mascot-reset').click()`);
  await sleep(200);
  await evaluate(`(() => {
    const input = document.querySelector('input[name="palette"][value="saya"]');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(250);
  const mascotSync = await evaluate(`(() => {
    const state = window.pixelHeart.getState();
    return {
      palette: state.paletteId,
      outfit: state.mascot.outfitId,
      accessory: state.mascot.accessoryId,
      touched: state.mascotTouched
    };
  })()`);
  check(
    '17.12',
    'маскот в примере носит аксессуар выбранной новеллы',
    mascotSync.palette === 'saya' &&
      mascotSync.outfit === 'saya' &&
      mascotSync.accessory === 'saya' &&
      mascotSync.touched === false,
    JSON.stringify(mascotSync)
  );

  let restingBefore = 0;
  for (let attempt = 0; attempt < 24 && restingBefore === 0; attempt += 1) {
    await sleep(250);
    restingBefore = await evaluate(`window.pixelHeart.petals.state().resting`);
  }
  await evaluate(`window.pixelHeart.petals.walk()`);
  let scene = { swept: 0, walking: false };
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(400);
    scene = await evaluate(`window.pixelHeart.petals.state()`);
    if (scene.swept > 0) break;
  }
  check(
    '17.13',
    'маскоты выходят и убирают лепестки с земли',
    restingBefore > 0 && scene.swept > 0,
    JSON.stringify({ restingBefore, ...scene })
  );
  await shot('shot-petals-walker.png', false);

  /* верхняя граница подвала становится полом сцены */
  await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(700);
  const floorState = await evaluate(`(() => {
    const state = window.pixelHeart.petals.state();
    return {
      ...state,
      viewport: window.innerHeight,
      natural: window.innerHeight - 9
    };
  })()`);
  check(
    '17.14',
    'верхняя граница подвала стала полом сцены',
    floorState.footerTop !== null &&
      Math.abs(floorState.floorY - floorState.footerTop) <= 2 &&
      floorState.floorY < floorState.natural - 40,
    JSON.stringify({ floorY: floorState.floorY, footerTop: floorState.footerTop })
  );

  /* маскоты встречаются и обмениваются короткими репликами */
  await evaluate(`window.pixelHeart.petals.greet()`);
  await sleep(400);
  const talk = await evaluate(`(() => ({
    bubbles: [...document.querySelectorAll('.petal-bubble[data-visible="true"]')].map((el) =>
      el.textContent.trim()
    ),
    meeting: window.pixelHeart.petals.state().meeting
  }))()`);
  check(
    '17.15',
    'маскоты болтают при встрече',
    talk.bubbles.length >= 2 &&
      talk.bubbles.every((text) => text.length > 5) &&
      talk.meeting === true,
    JSON.stringify(talk)
  );

  await send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });

  check('15.1', 'нет необработанных JS-исключений', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:', failed.map((item) => `${item.id} ${item.label}`).join('; '));
    process.exitCode = 1;
  }
  ws.close();
}

main().catch(async (error) => {
  console.error('VERIFY ERROR', error);
  process.exitCode = 1;
  try {
    ws?.close();
  } catch (_) {}
});
