/**
 * Micoteca (Álbum das 100 Espécies) & Efeito Mágico do Cubensis (MycoCampus3D)
 */

const STORAGE_KEY = 'myco_discovered_species_v1';

export function getDiscoveredSpecies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

export function registerDiscoveredSpecies(speciesName) {
  if (!speciesName) return { list: getDiscoveredSpecies(), isNew: false };
  const clean = String(speciesName).trim();
  const list = getDiscoveredSpecies();
  if (list.indexOf(clean) !== -1) return { list, isNew: false };
  list.push(clean);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
  return { list, isNew: true };
}

let tripLevel = 0;
let tripDecayTimer = null;

function clearTripClasses() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('myco-trip-1', 'myco-trip-2', 'myco-trip-3', 'myco-trip-4');
}

export function triggerMagicCubensisEffect(onSkyFall) {
  if (typeof document === 'undefined') return;
  tripLevel = Math.min(4, tripLevel + 1);
  clearTripClasses();
  document.body.classList.add('myco-trip-' + tripLevel);

  let overlay = document.getElementById('myco-magic-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'myco-magic-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:24;opacity:0;mix-blend-mode:screen;' +
      'background:conic-gradient(from 45deg at 50% 50%, rgba(236,72,153,0.32), rgba(168,85,247,0.38), rgba(56,189,248,0.32), rgba(250,204,21,0.32), rgba(236,72,153,0.32));' +
      'transition:opacity 0.7s ease;';
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = String(Math.min(1, 0.45 + tripLevel * 0.18));

  if (tripDecayTimer) clearTimeout(tripDecayTimer);

  if (tripLevel >= 4) {
    let whiteScreen = document.getElementById('myco-white-ascend');
    if (!whiteScreen) {
      whiteScreen = document.createElement('div');
      whiteScreen.id = 'myco-white-ascend';
      whiteScreen.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:60;opacity:0;background:#ffffff;' +
        'display:flex;align-items:center;justify-content:center;transition:opacity 1.6s ease;';
      whiteScreen.innerHTML =
        '<div style="color:#475569;font-size:clamp(22px,4vw,38px);font-weight:300;letter-spacing:0.08em;text-align:center;padding:24px;opacity:0;transition:opacity 1.4s ease;">Ainda não chegou a sua hora...</div>';
      document.body.appendChild(whiteScreen);
    }
    const msgEl = whiteScreen.firstElementChild;
    setTimeout(() => {
      whiteScreen.style.opacity = '1';
      if (msgEl) setTimeout(() => { msgEl.style.opacity = '1'; }, 700);
    }, 1800);

    setTimeout(() => {
      if (typeof onSkyFall === 'function') onSkyFall();
      clearTripClasses();
      overlay.style.opacity = '0';
      if (msgEl) msgEl.style.opacity = '0';
      whiteScreen.style.opacity = '0';
      tripLevel = 0;
    }, 5600);
    return;
  }

  tripDecayTimer = setTimeout(() => {
    overlay.style.opacity = '0';
    clearTripClasses();
    tripLevel = 0;
  }, 8000);
}
