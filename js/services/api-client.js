/**
 * MycoCampus3D — Cliente HTTP Unificado para APIs PHP
 * Centraliza headers, envio de token, parse de JSON e tratamento de sessão expirada (401).
 */
import { appState } from '../core/state.js';
import { events } from '../core/events.js';

function buildHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (appState.authToken) {
    headers['Authorization'] = `Bearer ${appState.authToken}`;
  }
  return headers;
}

async function handleResponse(res) {
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = { ok: false, error: `Resposta inválida do servidor (${res.status})` };
  }

  if (res.status === 401 && data && data.session_expired) {
    events.emit('auth:expired', data.error || 'Sessão expirada');
  }
  return { status: res.status, ok: res.ok && data && data.ok !== false, data };
}

export async function apiGet(url) {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: appState.authToken ? { 'Authorization': `Bearer ${appState.authToken}` } : {}
  });
  return handleResponse(res);
}

export async function apiPost(url, body = {}) {
  const payload = appState.authToken && !body.auth_token
    ? { ...body, auth_token: appState.authToken }
    : body;

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: buildHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}
