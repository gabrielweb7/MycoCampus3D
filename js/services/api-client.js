/**
 * MycoCampus3D — Cliente HTTP Unificado para APIs PHP
 * Preserva o contrato exato de autenticação (user_id + token no payload JSON) e aplica timeout de rede.
 */
import { appState } from '../core/state.js';
import { t } from '../core/i18n.js';
import { events } from '../core/events.js';

const DEFAULT_API_TIMEOUT_MS = 12000;

function createTimeoutController(timeoutMs) {
  const ms = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : DEFAULT_API_TIMEOUT_MS;
  if (typeof AbortController === 'undefined') return { signal: undefined, clear: () => {} };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return {
    signal: ctrl.signal,
    clear: () => clearTimeout(timer)
  };
}

export async function apiGet(url, opts = {}) {
  const timeout = createTimeoutController(opts.timeoutMs);
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: timeout.signal
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { ok: false, error: `Erro de resposta do servidor (${res.status})` };
    }
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, timeout: true, error: t('misc.api.timeout') };
    }
    throw err;
  } finally {
    timeout.clear();
  }
}

export async function apiPost(url, payload = {}, withAuth = false, opts = {}) {
  const data = { ...payload };
  const userId = withAuth ? appState.currentUser?.id : null;
  const sessionId = appState.sessionId;
  if (userId != null) {
    data.user_id = userId;
    if (appState.authToken) data.token = appState.authToken;
  }

  const timeout = createTimeoutController(opts.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin',
      signal: timeout.signal
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { ok: false, error: `Erro de resposta do servidor (${res.status})` };
    }

    if (res.status === 401 && json?.auth === false && userId != null &&
        appState.currentUser?.id === userId && appState.sessionId === sessionId) {
      events.emit('auth:expired', json.error);
    }
    return json || { ok: false, error: t('misc.api.invalid') };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, timeout: true, error: t('misc.api.timeout') };
    }
    throw err;
  } finally {
    timeout.clear();
  }
}
