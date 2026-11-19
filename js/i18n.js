/* =========================================================================
   i18n.js — доступ к словарю и перевод статической разметки.
   Пользовательский ввод никогда не переводится: меняются только подписи.
   ========================================================================= */

import { DATE_LOCALES, I18N } from './data.js';
import { getState } from './state.js';
import { interpolate } from './utils.js';

export function currentLang() {
  return getState().lang === 'en' ? 'en' : 'ru';
}

/** Перевод по ключу с подстановкой {переменных}. */
export function t(key, vars) {
  const lang = currentLang();
  const dictionary = I18N[lang] || I18N.ru;
  const fallback = I18N.ru;
  const value = dictionary[key] != null ? dictionary[key] : fallback[key] != null ? fallback[key] : key;
  return interpolate(value, vars);
}

/** Локализованное значение из объекта вида { ru, en }. */
export function pick(localized, lang = currentLang()) {
  if (localized == null) return '';
  if (typeof localized === 'string') return localized;
  return localized[lang] != null ? localized[lang] : localized.ru || '';
}

export function locale() {
  return DATE_LOCALES[currentLang()] || 'ru-RU';
}

/**
 * Переводит статическую разметку: data-i18n (textContent),
 * data-i18n-aria-label, data-i18n-placeholder, data-i18n-title.
 */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) element.textContent = t(key);
  });

  [
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-title', 'title']
  ].forEach(([dataAttribute, attribute]) => {
    root.querySelectorAll(`[${dataAttribute}]`).forEach((element) => {
      const key = element.getAttribute(dataAttribute);
      if (key) element.setAttribute(attribute, t(key));
    });
  });

  const lang = currentLang();
  document.documentElement.lang = lang;
  document.title = t('meta.title');

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', t('meta.description'));

  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.setAttribute('content', lang === 'en' ? 'en_US' : 'ru_RU');
}
