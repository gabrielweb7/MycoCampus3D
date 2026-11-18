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

export function triggerMagicCubensisEffect() {
  if (typeof document === 'undefined') return;
  document.body.classList.add('myco-trip-active');
  let overlay = document.getElementById('myco-magic-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'myco-magic-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:24;opacity:0;mix-blend-mode:screen;' +
      'background:conic-gradient(from 45deg at 50% 50%, rgba(236,72,153,0.28), rgba(168,85,247,0.32), rgba(56,189,248,0.28), rgba(250,204,21,0.28), rgba(236,72,153,0.28));' +
      'transition:opacity 0.7s ease;';
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = '1';
  if (overlay._hideTimer) clearTimeout(overlay._hideTimer);
  overlay._hideTimer = setTimeout(() => {
    overlay.style.opacity = '0';
    document.body.classList.remove('myco-trip-active');
  }, 7000);
}
