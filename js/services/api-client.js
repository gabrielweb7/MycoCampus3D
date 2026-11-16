/**
 * MycoCampus3D — Cliente HTTP Unificado para APIs PHP
 * Preserva o contrato exato de autenticação (user_id + token no payload JSON).
 */
import { appState } from '../core/state.js';
import { events } from '../core/events.js';

export async function apiGet(url) {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Erro de resposta do servidor (${res.status})` };
  }
}

export async function apiPost(url, payload = {}, withAuth = false) {
  const data = { ...payload };
  if (withAuth && appState.currentUser) {
    data.user_id = appState.currentUser.id;
    if (appState.authToken) data.token = appState.authToken;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'same-origin'
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { ok: false, error: `Erro de resposta do servidor (${res.status})` };
  }

  if (res.status === 401 && json && json.auth === false && appState.currentUser) {
    events.emit('auth:expired', json.error);
  }
  return json || { ok: false, error: 'Resposta inválida do servidor.' };
}
