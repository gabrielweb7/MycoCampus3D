/**
 * Modo Foto / Cartão Postal (MycoCampus3D)
 * Esconde temporariamente barras, joysticks e retícula para tirar prints lindas no PC e Mobile.
 */

const HUD_TOGGLE_IDS = [
  'hud-top-bar',
  'chat-container',
  'mobile-actions',
  'mobile-joystick-zone',
  'held-item-bar',
  'crosshair',
  'floating-interact-btn',
  'interact-pill',
  'myco-floating-actions'
];

let photoModeActive = false;

export function isPhotoModeActive() {
  return photoModeActive;
}

function ensurePhotoExitPill() {
  if (typeof document === 'undefined') return null;
  let pill = document.getElementById('myco-photo-exit-pill');
  if (pill) return pill;
  pill = document.createElement('button');
  pill.id = 'myco-photo-exit-pill';
  pill.type = 'button';
  pill.style.touchAction = 'manipulation';
  pill.className = 'hidden fixed top-3 right-3 z-[85] px-3 py-1.5 rounded-full bg-slate-950/75 hover:bg-slate-900 border border-emerald-400/50 text-emerald-200 text-xs font-bold shadow-lg backdrop-blur-sm cursor-pointer pointer-events-auto transition';
  pill.textContent = '📷 Sair do Modo Foto';
  pill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoMode(false);
  });
  document.body.appendChild(pill);
  return pill;
}

export function setPhotoMode(active) {
  if (typeof document === 'undefined') return false;
  photoModeActive = !!active;
  for (let i = 0; i < HUD_TOGGLE_IDS.length; i++) {
    const el = document.getElementById(HUD_TOGGLE_IDS[i]);
    if (!el) continue;
    if (photoModeActive) {
      el.dataset.photoPrevHidden = el.classList.contains('hidden') ? '1' : '0';
      el.classList.add('hidden');
    } else {
      if (el.dataset.photoPrevHidden === '0') {
        el.classList.remove('hidden');
      }
      delete el.dataset.photoPrevHidden;
    }
  }
  const exitPill = ensurePhotoExitPill();
  if (exitPill) {
    exitPill.classList.toggle('hidden', !photoModeActive);
  }
  return photoModeActive;
}

export function togglePhotoMode() {
  return setPhotoMode(!photoModeActive);
}
