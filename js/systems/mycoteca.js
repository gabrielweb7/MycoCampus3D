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

let tripShroomCount = 0;
let tripActive = false;
let tripEndsAt = 0;
let tripStartTimer = null;
let tripDecayTimer = null;

function clearTripTimers() {
  if (tripStartTimer) { clearTimeout(tripStartTimer); tripStartTimer = null; }
  if (tripDecayTimer) { clearTimeout(tripDecayTimer); tripDecayTimer = null; }
}

function clearTripVisuals() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('myco-trip-active', 'myco-trip-freakout');
  document.documentElement.style.removeProperty('--trip-sat');
  document.documentElement.style.removeProperty('--trip-con');
  document.documentElement.style.removeProperty('--trip-bri');
  const overlay = document.getElementById('myco-magic-overlay');
  if (overlay) overlay.style.opacity = '0';
  const mandala = document.getElementById('myco-mandala-overlay');
  if (mandala) mandala.style.opacity = '0';
  const darkLayer = document.getElementById('myco-freakout-dark');
  if (darkLayer) darkLayer.style.opacity = '0';
}

export function isTripRainbowActive() {
  return tripActive && tripShroomCount >= 1 && tripShroomCount < 20;
}

export function getTripSpeedMultiplier() {
  if (!tripActive || tripShroomCount <= 0 || tripShroomCount >= 20) return 1;
  return 1 + Math.min(0.45, tripShroomCount * 0.03);
}

if (typeof window !== 'undefined') {
  window.isTripRainbowActive = isTripRainbowActive;
  window.getTripSpeedMultiplier = getTripSpeedMultiplier;
}

function applyProgressiveColorVars(count) {
  const root = document.documentElement.style;
  const sat = 1.35 + count * 0.09;
  const con = 1.04 + count * 0.012;
  const bri = 1.02 + Math.min(0.14, count * 0.008);
  root.setProperty('--trip-sat', sat.toFixed(2));
  root.setProperty('--trip-con', con.toFixed(2));
  root.setProperty('--trip-bri', bri.toFixed(2));
}

function ensureMandalaOverlay() {
  let mandala = document.getElementById('myco-mandala-overlay');
  if (!mandala) {
    mandala = document.createElement('div');
    mandala.id = 'myco-mandala-overlay';
    mandala.style.cssText =
      'position:fixed;inset:-18%;pointer-events:none;z-index:23;opacity:0;mix-blend-mode:soft-light;' +
      'display:flex;align-items:center;justify-content:center;transition:opacity 3s ease;';
    mandala.innerHTML =
      '<svg viewBox="0 0 400 400" style="width:120vmax;height:120vmax;opacity:0.65;">' +
      '<g fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.1">' +
      '<circle cx="200" cy="200" r="46"/><circle cx="200" cy="200" r="92"/><circle cx="200" cy="200" r="142"/><circle cx="200" cy="200" r="188"/>' +
      '<polygon points="200,20 356,290 44,290" stroke="rgba(244,114,182,0.45)"/>' +
      '<polygon points="200,380 44,110 356,110" stroke="rgba(56,189,248,0.45)"/>' +
      '<circle cx="200" cy="108" r="46" stroke="rgba(250,204,21,0.38)"/><circle cx="200" cy="292" r="46" stroke="rgba(52,211,153,0.38)"/>' +
      '<circle cx="120" cy="154" r="46" stroke="rgba(167,139,250,0.38)"/><circle cx="280" cy="154" r="46" stroke="rgba(244,114,182,0.38)"/>' +
      '<circle cx="120" cy="246" r="46" stroke="rgba(56,189,248,0.38)"/><circle cx="280" cy="246" r="46" stroke="rgba(251,146,60,0.38)"/>' +
      '</g></svg>';
    document.body.appendChild(mandala);
  }
  return mandala;
}

function scheduleTripEnd(overlay) {
  if (tripDecayTimer) clearTimeout(tripDecayTimer);
  const remaining = Math.max(2000, tripEndsAt - Date.now());
  const mandala = document.getElementById('myco-mandala-overlay');
  tripDecayTimer = setTimeout(() => {
    overlay.style.transition = 'opacity 25s ease-out';
    overlay.style.opacity = '0';
    if (mandala) {
      mandala.style.transition = 'opacity 25s ease-out';
      mandala.style.opacity = '0';
    }
    tripDecayTimer = setTimeout(() => {
      tripActive = false;
      tripShroomCount = 0;
      tripEndsAt = 0;
      clearTripVisuals();
    }, 25000);
  }, remaining);
}

export function triggerMagicCubensisEffect(onSkyFall) {
  if (typeof document === 'undefined') return;
  clearTripTimers();
  tripShroomCount = Math.min(20, tripShroomCount + 1);

  let overlay = document.getElementById('myco-magic-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'myco-magic-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:24;opacity:0;mix-blend-mode:screen;' +
      'background:conic-gradient(from 45deg at 50% 50%, rgba(236,72,153,0.28), rgba(168,85,247,0.34), rgba(56,189,248,0.28), rgba(250,204,21,0.28), rgba(236,72,153,0.28));' +
      'transition:opacity 1.5s ease;';
    document.body.appendChild(overlay);
  }

  // 20º cogumelo: SURTO CABULOSO -> vira tela, tudo preto/medonho, seres estranhos, desmaia no branco e cai do céu
  if (tripShroomCount >= 20) {
    tripActive = false;
    document.body.classList.remove('myco-trip-active');
    document.body.classList.add('myco-trip-freakout');
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity = '0';

    let darkLayer = document.getElementById('myco-freakout-dark');
    if (!darkLayer) {
      darkLayer = document.createElement('div');
      darkLayer.id = 'myco-freakout-dark';
      darkLayer.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:55;opacity:0;' +
        'background:radial-gradient(circle at 50% 50%, rgba(5,5,10,0.65) 15%, rgba(0,0,0,0.97) 75%);' +
        'transition:opacity 1.4s ease;overflow:hidden;';
      darkLayer.innerHTML =
        '<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;opacity:0.9;">' +
        '<g style="animation:mycoCreatureLurk 1.3s ease-in-out infinite;">' +
        '<path d="M70,480 Q95,290 150,275 Q180,265 205,330 Q220,400 230,480 Z" fill="#030306"/>' +
        '<circle cx="136" cy="318" r="6" fill="#ef4444"/><circle cx="164" cy="316" r="6" fill="#ef4444"/>' +
        '<path d="M132,344 Q150,362 168,342" stroke="#dc2626" stroke-width="3" fill="none"/>' +
        '</g>' +
        '<g style="animation:mycoCreatureLurk 1.05s ease-in-out infinite 0.35s;">' +
        '<path d="M585,490 Q610,250 670,235 Q725,245 750,490 Z" fill="#020205"/>' +
        '<ellipse cx="648" cy="292" rx="8" ry="4" fill="#facc15"/><ellipse cx="688" cy="294" rx="8" ry="4" fill="#facc15"/>' +
        '<path d="M640,326 L655,318 L668,328 L682,318 L695,327" stroke="#eab308" stroke-width="2.5" fill="none"/>' +
        '</g>' +
        '<g style="animation:mycoCreatureLurk 0.9s ease-in-out infinite 0.6s;">' +
        '<path d="M340,30 Q395,125 450,30 Z" fill="#020204"/>' +
        '<circle cx="382" cy="64" r="4.5" fill="#f87171"/><circle cx="408" cy="64" r="4.5" fill="#f87171"/>' +
        '</g></svg>';
      document.body.appendChild(darkLayer);
    }
    requestAnimationFrame(() => { darkLayer.style.opacity = '1'; });

    let whiteScreen = document.getElementById('myco-white-ascend');
    if (!whiteScreen) {
      whiteScreen = document.createElement('div');
      whiteScreen.id = 'myco-white-ascend';
      whiteScreen.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:60;opacity:0;background:#ffffff;' +
        'display:flex;align-items:center;justify-content:center;transition:opacity 1.8s ease;';
      whiteScreen.innerHTML =
        '<div style="color:#334155;font-size:clamp(20px,3.6vw,34px);font-weight:300;line-height:1.5;letter-spacing:0.05em;text-align:center;padding:24px;opacity:0;transition:opacity 1.4s ease;">' +
        'Às vezes é bom não exagerar,<br>pequeno gafanhoto!...<br>Ainda não é sua hora.. volte e termine seu trabalho!</div>';
      document.body.appendChild(whiteScreen);
    }
    const msgEl = whiteScreen.firstElementChild;
    setTimeout(() => {
      whiteScreen.style.opacity = '1';
      if (msgEl) setTimeout(() => { msgEl.style.opacity = '1'; }, 800);
    }, 3600);

    setTimeout(() => {
      if (typeof onSkyFall === 'function') onSkyFall();
      clearTripVisuals();
      if (msgEl) msgEl.style.opacity = '0';
      whiteScreen.style.opacity = '0';
      tripShroomCount = 0;
      tripEndsAt = 0;
    }, 8800);
    return;
  }

  const mandala = ensureMandalaOverlay();

  // 1º cogumelo: demora ~55s pra bater de leve, depois ~2 min colorido e tranquilo
  if (tripShroomCount === 1 && !tripActive) {
    applyProgressiveColorVars(1);
    tripEndsAt = Date.now() + 55000 + 120000;
    overlay.style.transition = 'opacity 45s ease-in';
    overlay.style.opacity = '0.08';
    tripStartTimer = setTimeout(() => {
      tripActive = true;
      document.body.classList.add('myco-trip-active');
      overlay.style.transition = 'opacity 22s ease-in-out';
      overlay.style.opacity = '0.18';
      mandala.style.transition = 'opacity 22s ease-in-out';
      mandala.style.opacity = '0.28';
      scheduleTripEnd(overlay);
    }, 55000);
    return;
  }

  // Cogumelos 2..19: entra/mantém brisa feliz, +1 min na duração, mais colorido, mandalas, rápido, gnomos e aura arco-íris
  tripActive = true;
  document.body.classList.add('myco-trip-active');
  applyProgressiveColorVars(tripShroomCount);
  const baseMinEnd = Date.now() + 120000;
  tripEndsAt = Math.max(baseMinEnd, (tripEndsAt || Date.now()) + 60000);
  overlay.style.transition = 'opacity 2.5s ease';
  overlay.style.opacity = String(Math.min(0.65, 0.12 + tripShroomCount * 0.028));
  mandala.style.transition = 'opacity 2.5s ease';
  mandala.style.opacity = String(Math.min(0.75, 0.24 + tripShroomCount * 0.032));
  scheduleTripEnd(overlay);
}
