/**
 * MycoCampus3D — HUD do Jogador, Lobby, Sessão e Controles de Vista/FPS
 */
import { HAT_COLORS, BODY_COLORS, SYNC_INTERVAL_MS } from '../core/constants.js';
import { LESSONS } from '../core/lessons-data.js';
import { appState } from '../core/state.js';
import { events } from '../core/events.js';
import { apiGet, apiPost } from '../services/api-client.js';
import { $, isTouch, requestCampusFullscreen } from './dom-helpers.js';
import { loadLabQuestProgress } from './quest-map.js';
import { getLocalMycoCoins, setLocalMycoCoins } from '../items/dehydration-packaging.js';

export function renderSwatches() {
  const hatWrap = $('hat-swatches');
  const bodyWrap = $('body-swatches');
  if (!hatWrap || !bodyWrap) return;
  hatWrap.innerHTML = '';
  bodyWrap.innerHTML = '';

  HAT_COLORS.forEach((hex) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch-btn' + (hex === appState.selectedHat ? ' active' : '');
    b.style.backgroundColor = hex;
    b.onclick = () => { appState.selectedHat = hex; renderSwatches(); };
    hatWrap.appendChild(b);
  });

  BODY_COLORS.forEach((hex) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch-btn' + (hex === appState.selectedBody ? ' active' : '');
    b.style.backgroundColor = hex;
    b.onclick = () => { appState.selectedBody = hex; renderSwatches(); };
    bodyWrap.appendChild(b);
  });
}

export function updateUserHud() {
  const user = appState.currentUser;
  if (!user) return;
  if ($('hud-name')) $('hud-name').textContent = user.display_name;
  if ($('hud-xp')) $('hud-xp').textContent = String(user.xp || 0);
  if ($('hud-mushrooms')) $('hud-mushrooms').textContent = String(user.mushrooms_harvested || 0);
  if ($('hud-coins')) $('hud-coins').textContent = String(getLocalMycoCoins());
  if ($('hud-modules')) $('hud-modules').textContent = String((user.completed_modules || []).length);
  if ($('shop-user-xp')) $('shop-user-xp').textContent = String(user.xp || 0);
  if ($('shop-user-mushrooms')) $('shop-user-mushrooms').textContent = String(user.mushrooms_harvested || 0);
  if ($('shop-user-coins')) $('shop-user-coins').textContent = String(getLocalMycoCoins());
  if (window.setLocalAvatarHat) {
    window.setLocalAvatarHat(user.current_hat || 'default');
  }

  const isMaster = (user.role === 'admin') || (user.username === 'gabrieldaluz');
  const isMod = (user.role === 'moderator');

  const badge = $('hud-role-badge');
  if (badge) {
    if (isMaster) {
      badge.textContent = '👑 Master Admin';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-amber-500/30 text-amber-300 border border-amber-400/50 shadow-sm';
    } else if (user.role === 'professor') {
      badge.textContent = '👨‍🏫 Professor';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-amber-500/25 text-amber-300 border border-amber-400/40';
    } else if (isMod) {
      badge.textContent = '🛡️ Moderador';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-sky-500/25 text-sky-300 border border-sky-400/40';
    } else {
      badge.textContent = '🎓 Aluno';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
    }
  }

  const rLab = $('btn-reset-lab');
  if (rLab) rLab.classList.add('hidden');
  const pBar = $('prof-toolbar');
  if (pBar) pBar.classList.add('hidden');
  const btnAdmin = $('btn-open-admin');
  if (btnAdmin) btnAdmin.classList.toggle('hidden', !isMaster);
}

export function enterCampus(user, token) {
  appState.currentUser = user;
  if (token) appState.authToken = token;
  if (user && typeof user.myco_coins === 'number' && Number.isFinite(user.myco_coins)) {
    setLocalMycoCoins(user.myco_coins);
  }
  appState.isInitialSync = true;
  requestCampusFullscreen();
  if (window.setCampusPlayerColors) window.setCampusPlayerColors(user.hat_color, user.body_color);
  if ($('input-pin')) $('input-pin').value = '';
  updateUserHud();
  loadLabQuestProgress();
  if ($('campus-lobby')) $('campus-lobby').classList.add('hidden');
  if ($('campus-hud')) $('campus-hud').classList.remove('hidden');
  window._pendingEnterFps = true;
  if (window.setCampusFpsMode) {
    window._pendingEnterFps = false;
    window.setCampusFpsMode(true);
  }
  setTimeout(() => {
    const hint = $('fps-hint');
    if (hint) hint.classList.add('faded');
  }, 4000);
  if (appState.syncTimer) clearInterval(appState.syncTimer);
  events.emit('sync:now');
  appState.syncTimer = setInterval(() => events.emit('sync:now'), SYNC_INTERVAL_MS);
}

export async function tryResumeSession() {
  const params = new URLSearchParams(window.location.search);
  const urlName = (params.get('campus_name') || '').trim();
  const urlPin = params.get('campus_pin') || '';
  if (urlName || urlPin || params.has('_v')) {
    try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
  }
  try {
    const data = await apiGet('api/auth.php?action=me');
    if (data.ok && data.user) {
      enterCampus(data.user, '');
      return;
    }
  } catch (e) {}
  if (urlName.length >= 2 && urlPin.length >= 4) {
    try {
      const loginData = await apiPost('api/auth.php?action=login', {
        display_name: urlName,
        pin: urlPin,
        hat_color: appState.selectedHat,
        body_color: appState.selectedBody
      });
      if (loginData.ok && loginData.user) {
        enterCampus(loginData.user, loginData.token || '');
      }
    } catch (e) {}
  }
}

export async function logoutCampus() {
  if (appState.syncTimer) clearInterval(appState.syncTimer);
  appState.syncTimer = null;
  const lastName = appState.currentUser ? appState.currentUser.display_name : '';
  try {
    await apiPost('api/multiplayer.php?action=leave', { session_id: appState.sessionId }, true);
    await apiPost('api/auth.php?action=logout', {}, true);
  } catch (e) {}
  appState.currentUser = null;
  appState.authToken = '';
  appState.pendingChatMsg = '';
  appState.sessionId = 'mc_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  if (window.resetCampusLocalSession) window.resetCampusLocalSession();
  if (window.setCampusSnowboard) window.setCampusSnowboard(false);
  if (window.setCampusParaglider) window.setCampusParaglider(false);
  if (window.updateCampusPlayers) window.updateCampusPlayers([]);
  if (window.setCampusFpsMode) window.setCampusFpsMode(false);
  ['campus-hud', 'lesson-modal', 'ranking-modal', 'admin-modal', 'map-modal', 'quest-modal', 'shop-modal', 'emote-bar'].forEach((id) => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
  if ($('campus-lobby')) $('campus-lobby').classList.remove('hidden');
  if (lastName && $('input-name')) $('input-name').value = lastName;
  const btn = $('btn-enter-campus');
  if (btn) {
    btn.disabled = false;
    btn.textContent = '🚀 Entrar no Campus 3D';
  }
}

export function handleSessionExpired(msg) {
  if (appState.syncTimer) clearInterval(appState.syncTimer);
  appState.syncTimer = null;
  appState.currentUser = null;
  appState.authToken = '';
  if (window.updateCampusPlayers) window.updateCampusPlayers([]);
  if (window.setCampusFpsMode) window.setCampusFpsMode(false);
  ['campus-hud', 'lesson-modal', 'ranking-modal', 'admin-modal'].forEach((id) => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
  if ($('campus-lobby')) $('campus-lobby').classList.remove('hidden');
  const btn = $('btn-enter-campus');
  if (btn) {
    btn.disabled = false;
    btn.textContent = '🚀 Entrar no Campus 3D';
  }
  const errBox = $('lobby-error');
  if (errBox) {
    errBox.textContent = msg || 'Sessão expirada. Entre novamente.';
    errBox.classList.remove('hidden');
  }
}

export async function loadLobbyStats() {
  try {
    const data = await apiGet('api/auth.php?action=leaderboard');
    const statsEl = $('lobby-stats');
    if (statsEl) {
      if (data.ok && data.stats) {
        statsEl.textContent =
          `🟢 Online • ${data.stats.total_users} estudantes • ${data.stats.total_xp} XP acumulados • ${data.stats.total_harvests} cogus colhidos`;
      } else {
        statsEl.textContent = data.error || 'Aguardando configuração do MySQL.';
      }
    }
    if (data.ok && Array.isArray(data.leaders) && window.updateCampusRanking) {
      window.updateCampusRanking(data.leaders);
    }
  } catch (err) {
    if ($('lobby-stats')) $('lobby-stats').textContent = 'Servidor offline no momento. Tente novamente em instantes.';
  }
}

export function applySlideTo3D(idx, presenter) {
  const s = LESSONS[idx] || LESSONS[0];
  appState.currentSlideIdx = idx;
  appState.currentPresenter = presenter || '';
  if (window.updateCampusAuditoriumSlide) {
    window.updateCampusAuditoriumSlide(idx, s.title, s.subtitle, s.bullets, presenter);
  }
}

export function updateFpsUi(fps) {
  appState.inFps = fps;
  const btnFps = $('btn-toggle-fps');
  if (btnFps) btnFps.textContent = fps ? '🌍 Vista Aérea' : '🎥 1ª Pessoa';
  const crosshair = $('crosshair');
  if (crosshair) crosshair.style.display = fps ? 'block' : 'none';
  const joyZone = $('mobile-joystick-zone');
  const mobActs = $('mobile-actions');
  if (fps && isTouch()) {
    if (joyZone) joyZone.style.display = 'block';
    if (mobActs) mobActs.style.display = 'block';
  } else {
    if (joyZone) joyZone.style.display = 'none';
    if (mobActs) mobActs.style.display = 'none';
  }
}

events.on('auth:expired', handleSessionExpired);
