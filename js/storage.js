/* =========================================================================
   storage.js — безопасный черновик в localStorage.
   Все операции обёрнуты в try/catch: сайт обязан работать и без хранилища.
   Наружу отдаются коды статусов, а не тексты — тексты берёт i18n.
   ========================================================================= */

import { normalizeState } from './state.js';
import { debounce } from './utils.js';

export const STORAGE_KEY = 'brandbook-draft';
const SCHEMA_VERSION = 1;

let pendingState = null;
let lastStatus = 'idle';
let statusListener = () => {};

/**
 * Подписка на события хранилища.
 * status: 'restored' | 'empty' | 'corrupt' | 'unavailable' | 'quota' | 'ok' | 'cleared'
 */
export function onStorageStatus(listener) {
  statusListener = typeof listener === 'function' ? listener : () => {};
}

function emit(status, error) {
  if (status === lastStatus) return;
  lastStatus = status;
  try {
    statusListener(status, error || null);
  } catch (listenerError) {
    console.error('[storage] status listener failed', listenerError);
  }
}

function getStorage() {
  try {
    const storage = window.localStorage;
    const probe = '__pixel-heart-probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch (error) {
    return null;
  }
}

export function isStorageAvailable() {
  return Boolean(getStorage());
}

/**
 * Читает черновик. Возвращает { ok, status, state }.
 * Битый JSON не роняет приложение: статус 'corrupt', state = null.
 */
export function load() {
  const storage = getStorage();
  if (!storage) {
    emit('unavailable');
    return { ok: false, status: 'unavailable', state: null };
  }

  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    emit('unavailable', error);
    return { ok: false, status: 'unavailable', state: null };
  }

  if (!raw) {
    emit('empty');
    return { ok: true, status: 'empty', state: null };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    emit('corrupt', error);
    return { ok: false, status: 'corrupt', state: null };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    emit('corrupt');
    return { ok: false, status: 'corrupt', state: null };
  }

  const version = Number(parsed.version);
  if (Number.isFinite(version) && version > SCHEMA_VERSION) {
    emit('corrupt');
    return { ok: false, status: 'corrupt', state: null };
  }

  const candidate = parsed.state && typeof parsed.state === 'object' ? parsed.state : parsed;
  let state = null;
  try {
    state = normalizeState(candidate);
  } catch (error) {
    emit('corrupt', error);
    return { ok: false, status: 'corrupt', state: null };
  }

  emit('restored');
  return { ok: true, status: 'restored', state };
}

function persist() {
  if (!pendingState) return false;
  const storage = getStorage();
  if (!storage) {
    emit('unavailable');
    return false;
  }

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        state: pendingState
      })
    );
    emit('ok');
    return true;
  } catch (error) {
    const quotaExceeded =
      error &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22 ||
        error.code === 1014);
    emit(quotaExceeded ? 'quota' : 'unavailable', error);
    return false;
  }
}

const debouncedPersist = debounce(persist, 200);

/** Сохраняет снимок состояния с debounce 200 мс. */
export function save(state) {
  pendingState = state;
  debouncedPersist();
}

/** Немедленная запись — используется на pagehide/beforeunload и при сбросе. */
export function flushSave() {
  if (!pendingState) return false;
  debouncedPersist.cancel();
  return persist();
}

/** Удаляет ключ из localStorage. */
export function clear() {
  debouncedPersist.cancel();
  pendingState = null;
  const storage = getStorage();
  if (!storage) {
    emit('unavailable');
    return false;
  }
  try {
    storage.removeItem(STORAGE_KEY);
    emit('cleared');
    return true;
  } catch (error) {
    emit('unavailable', error);
    return false;
  }
}

export function getLastStatus() {
  return lastStatus;
}
