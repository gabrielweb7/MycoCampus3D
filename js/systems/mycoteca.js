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
let tripFreakoutActive = false;
let tripEndsAt = 0;
let tripStartTimer = null;
let tripDecayTimer = null;
let freakoutTimers = [];

function clearTripTimers() {
  if (tripStartTimer) { clearTimeout(tripStartTimer); tripStartTimer = null; }
  if (tripDecayTimer) { clearTimeout(tripDecayTimer); tripDecayTimer = null; }
  while (freakoutTimers.length) {
    clearTimeout(freakoutTimers.pop());
  }
}

function clearTripVisuals() {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('myco-trip-active', 'myco-trip-freakout', 'myco-trip-faint');
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
  return tripActive && !tripFreakoutActive && tripShroomCount >= 1 && tripShroomCount < 20;
}

export function isTripFreakoutActive() {
  return tripFreakoutActive;
}

export function getTripSpeedMultiplier() {
  if (tripFreakoutActive) return 0.92;
  if (!tripActive || tripShroomCount <= 0 || tripShroomCount >= 20) return 1;
  return 1 + Math.min(0.45, tripShroomCount * 0.03);
}

export function getTripTextureFlowStrength() {
  if (tripFreakoutActive) return 0.55;
  if (!tripActive || tripShroomCount < 3 || tripShroomCount >= 20) return 0;
  return Math.min(1, (tripShroomCount - 2) * 0.09);
}

if (typeof window !== 'undefined') {
  window.isTripRainbowActive = isTripRainbowActive;
  window.isTripFreakoutActive = isTripFreakoutActive;
  window.getTripSpeedMultiplier = getTripSpeedMultiplier;
  window.getTripTextureFlowStrength = getTripTextureFlowStrength;
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

  // 20º cogumelo: UMBRAL -> noite sombria nítida (~27s), gnomos pretos com olhos brilhantes e cara de medo correndo e sumindo ao olhar, depois desmaia pro branco
  if (tripShroomCount >= 20) {
    tripActive = false;
    tripFreakoutActive = true;
    document.body.classList.remove('myco-trip-active');
    document.body.classList.add('myco-trip-freakout');
    overlay.style.transition = 'opacity 1.5s ease';
    overlay.style.opacity = '0';
    const mandalaEl = document.getElementById('myco-mandala-overlay');
    if (mandalaEl) {
      mandalaEl.style.transition = 'opacity 2.5s ease';
      mandalaEl.style.opacity = '0.16';
    }

    let darkLayer = document.getElementById('myco-freakout-dark');
    if (!darkLayer) {
      darkLayer = document.createElement('div');
      darkLayer.id = 'myco-freakout-dark';
      darkLayer.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:25;opacity:0;' +
        'background:radial-gradient(circle at 50% 50%, transparent 26%, rgba(3,1,10,0.88) 92%);' +
        'box-shadow:inset 0 0 110px rgba(127,29,29,0.52);' +
        'transition:opacity 2.4s ease;';
      document.body.appendChild(darkLayer);
    }
    requestAnimationFrame(() => { darkLayer.style.opacity = '1'; });
    if (window.MycoAudio && window.MycoAudio.playUmbralWhisper) window.MycoAudio.playUmbralWhisper();

    let whiteScreen = document.getElementById('myco-white-ascend');
    if (!whiteScreen) {
      whiteScreen = document.createElement('div');
      whiteScreen.id = 'myco-white-ascend';
      whiteScreen.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:60;opacity:0;background:#ffffff;' +
        'display:flex;align-items:center;justify-content:center;transition:opacity 2.2s ease;';
      whiteScreen.innerHTML =
        '<div style="color:#334155;font-size:clamp(20px,3.6vw,34px);font-weight:300;line-height:1.5;letter-spacing:0.05em;text-align:center;padding:24px;opacity:0;transition:opacity 1.4s ease;">' +
        'Às vezes é bom não exagerar,<br>pequeno gafanhoto!...<br>Ainda não é sua hora.. volte e termine seu trabalho!</div>';
      document.body.appendChild(whiteScreen);
    }
    const msgEl = whiteScreen.firstElementChild;
    freakoutTimers.push(setTimeout(() => {
      document.body.classList.remove('myco-trip-freakout');
      document.body.classList.add('myco-trip-faint');
      whiteScreen.style.opacity = '1';
      if (msgEl) freakoutTimers.push(setTimeout(() => { msgEl.style.opacity = '1'; }, 900));
    }, 27000));

    freakoutTimers.push(setTimeout(() => {
      tripFreakoutActive = false;
      if (typeof onSkyFall === 'function') onSkyFall();
      clearTripVisuals();
      if (msgEl) msgEl.style.opacity = '0';
      whiteScreen.style.opacity = '0';
      tripShroomCount = 0;
      tripEndsAt = 0;
    }, 33000));
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
