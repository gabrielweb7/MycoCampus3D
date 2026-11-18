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
let tripStartTimer = null;
let tripFadeTimer = null;
let tripDecayTimer = null;

function clearTripClasses() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('myco-trip-1', 'myco-trip-2', 'myco-trip-3', 'myco-trip-4');
}

function clearTripTimers() {
  if (tripStartTimer) { clearTimeout(tripStartTimer); tripStartTimer = null; }
  if (tripFadeTimer) { clearTimeout(tripFadeTimer); tripFadeTimer = null; }
  if (tripDecayTimer) { clearTimeout(tripDecayTimer); tripDecayTimer = null; }
}

export function triggerMagicCubensisEffect(onSkyFall) {
  if (typeof document === 'undefined') return;
  clearTripTimers();
  tripLevel = Math.min(4, tripLevel + 1);
  clearTripClasses();

  let overlay = document.getElementById('myco-magic-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'myco-magic-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:24;opacity:0;mix-blend-mode:screen;' +
      'background:conic-gradient(from 45deg at 50% 50%, rgba(236,72,153,0.28), rgba(168,85,247,0.34), rgba(56,189,248,0.28), rgba(250,204,21,0.28), rgba(236,72,153,0.28));' +
      'transition:opacity 1.2s ease;';
    document.body.appendChild(overlay);
  }

  // 1ª trip: demora ~1 min pra bater de leve, fica ~2 min bem colorida/tranquila e vai se esvaindo devagar
  if (tripLevel === 1) {
    overlay.style.transition = 'opacity 45s ease-in';
    overlay.style.opacity = '0.12';
    tripStartTimer = setTimeout(() => {
      document.body.classList.add('myco-trip-1');
      overlay.style.transition = 'opacity 25s ease-in-out';
      overlay.style.opacity = '0.32';

      // Platô tranquilo (~2 min) e depois saída suave (~30s)
      tripFadeTimer = setTimeout(() => {
        overlay.style.transition = 'opacity 28s ease-out';
        overlay.style.opacity = '0';
        tripDecayTimer = setTimeout(() => {
          clearTripClasses();
          tripLevel = 0;
        }, 28000);
      }, 95000);
    }, 55000);
    return;
  }

  document.body.classList.add('myco-trip-' + tripLevel);
  overlay.style.transition = 'opacity 1.2s ease';
  overlay.style.opacity = String(Math.min(1, 0.42 + tripLevel * 0.18));

  if (tripLevel >= 4) {
    let whiteScreen = document.getElementById('myco-white-ascend');
    if (!whiteScreen) {
      whiteScreen = document.createElement('div');
      whiteScreen.id = 'myco-white-ascend';
      whiteScreen.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:60;opacity:0;background:#ffffff;' +
        'display:flex;align-items:center;justify-content:center;transition:opacity 1.6s ease;';
      whiteScreen.innerHTML =
        '<div style="color:#475569;font-size:clamp(22px,4vw,38px);font-weight:300;letter-spacing:0.08em;text-align:center;padding:24px;opacity:0;transition:opacity 1.4s ease;">O micélio te devolve à terra... Ainda há muito para cultivar.</div>';
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

  const durationMs = tripLevel === 2 ? 90000 : 60000;
  tripDecayTimer = setTimeout(() => {
    overlay.style.transition = 'opacity 14s ease-out';
    overlay.style.opacity = '0';
    tripFadeTimer = setTimeout(() => {
      clearTripClasses();
      tripLevel = 0;
    }, 14000);
  }, durationMs);
}
