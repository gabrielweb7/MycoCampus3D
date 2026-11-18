/**
 * MycoCampus3D — Utilitários DOM, Perfil de Dispositivo, Toast & Fullscreen
 */
export const $ = (id) => document.getElementById(id);

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getDeviceProfile() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const minDim = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 && (window.innerWidth <= 1380 || minDim <= 1080);
  if (!coarse && !hasTouch) return 'desktop';
  return minDim >= 720 ? 'tablet' : 'phone';
}

export function isTouch() {
  return getDeviceProfile() !== 'desktop';
}

export function applyDeviceUi() {
  const profile = getDeviceProfile();
  document.body.classList.remove('device-desktop', 'device-tablet', 'device-phone', 'device-touch');
  document.body.classList.add(`device-${profile}`);
  if (profile !== 'desktop') document.body.classList.add('device-touch');

  const hint = $('fps-hint');
  const chatInp = $('chat-input');
  if (profile === 'desktop') {
    if (hint) hint.textContent = 'WASD anda • Shift corre • Espaço pula • R gira item • Clique interage • E ou T abre o Chat';
    if (chatInp) chatInp.placeholder = '💬 Aperte E ou T para digitar (Enter envia)...';
  } else if (profile === 'tablet') {
    if (hint) hint.textContent = 'Joystick anda • Arraste para olhar • Toque para interagir • 🔄 gira item';
    if (chatInp) chatInp.placeholder = '💬 Toque para digitar no chat...';
  } else {
    if (hint) hint.textContent = 'Joystick anda • Arraste para olhar • Toque para interagir';
    if (chatInp) chatInp.placeholder = '💬 Escreva no chat...';
  }
}

let toastUntil = 0;

export function getToastUntil() {
  return toastUntil;
}

export function showFloatingToast(msg, durationMs = 3200) {
  const pill = $('interact-pill');
  if (!pill) return;
  toastUntil = Date.now() + durationMs;
  pill.textContent = msg;
  pill.classList.remove('hidden');
  setTimeout(() => {
    if (Date.now() >= toastUntil && pill.textContent === msg) {
      pill.classList.add('hidden');
    }
  }, durationMs);
}

export function releaseInputForModal() {
  if (window.clearCampusKeys) window.clearCampusKeys();
  if (document.pointerLockElement && document.exitPointerLock) {
    try { document.exitPointerLock(); } catch (e) { /* silent */ }
  }
}

export function isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

export function requestCampusFullscreen() {
  try {
    if (isFullscreenActive()) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      const p = req.call(el, { navigationUI: 'hide' });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    if (isTouch() && screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) { /* browser policy */ }
}

export function toggleCampusFullscreen() {
  try {
    if (isFullscreenActive()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) exit.call(document);
    } else {
      requestCampusFullscreen();
    }
  } catch (e) { /* ignore */ }
}
