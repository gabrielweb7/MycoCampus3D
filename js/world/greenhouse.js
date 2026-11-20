/**
 * MycoCampus3D — Estufa Climatizada Inteligente (2 Estantes x 3 Andares = 24 Bolos)
 *
 * Recursos:
 * - 24 espaços de frutificação (Estante Central + Estante Leste, 3 andares cada)
 * - Climatizador evaporador de 3 ventoinhas no teto + Exaustor lateral com dutos PVC
 * - Umidificador ultrassônico com tanque azul, tubulação de névoa e partículas leves
 * - Painel Controlador Digital 3D (LCD ao vivo + LEDs de status + Modal interativo)
 * - Modo Automático (padrão) ou Manual para Umidade, CO2 (FAE), Temperatura e LED Grow
 * - Aceita qualquer Spawn Bag, Vidro ou Potinho PP5 colonizado da bancada + múltiplos flushes
 */
import { makeBox, makeTextSprite, updateTextSprite } from '../engine/textures.js';
import { disposeObjectResources } from '../items/item-registry.js';
import { updateSpawnVisual } from '../items/spawn-containers.js';
import { makeSpentCakeItem } from '../items/monotub.js';
import { spawnPersistedWildMushroom } from '../systems/world-interactions.js';

const SPECIES_PRESETS = [
  { name: 'Shimeji Dourado', sci: 'Pleurotus citrinopileatus', color: 0xfacc15, kind: 'shimeji' },
  { name: 'Shiitake', sci: 'Lentinula edodes', color: 0x78350f, kind: 'shiitake' },
  { name: 'Juba de Leão', sci: 'Hericium erinaceus', color: 0xf8fafc, kind: 'lion' },
  { name: 'Golden Teacher', sci: 'Psilocybe cubensis', color: 0xd97706, kind: 'gt' },
  { name: 'Shimeji Branco', sci: 'Pleurotus ostreatus', color: 0xf1f5f9, kind: 'shimeji' },
  { name: 'Shimeji Salmão', sci: 'Pleurotus djamor', color: 0xfb7185, kind: 'shimeji' },
  { name: 'Portobello', sci: 'Agaricus bisporus', color: 0x92400e, kind: 'shiitake' },
  { name: 'Reishi Vermelho', sci: 'Ganoderma lucidum', color: 0xb91c1c, kind: 'shiitake' }
];

export function inferKindFromSpecies(speciesName) {
  const s = String(speciesName || '').toLowerCase();
  if (s.includes('juba') || s.includes('hericium') || s.includes('lion')) return 'lion';
  if (s.includes('shimeji') || s.includes('pleurotus') || s.includes('ostra') || s.includes('reishi') || s.includes('cauda de peru')) return 'shimeji';
  if (s.includes('cubensis') || s.includes('golden') || s.includes('psilocybe') || s.includes('penis envy') || s.includes('jack frost') || s.includes('avery') || s.includes('blue meanie')) return 'gt';
  return 'shiitake';
}

export function inferColorFromSpecies(speciesName) {
  const s = String(speciesName || '').toLowerCase();
  if (s.includes('jack frost')) return 0xe0f2fe;
  if (s.includes('avery')) return 0xf8fafc;
  if (s.includes('penis envy')) return 0xe7c697;
  if (s.includes('blue meanie')) return 0xcbd5e1;
  if (s.includes('cordyceps')) return 0xf97316;
  if (s.includes('neon') || s.includes('chlorophos')) return 0x4ade80;
  if (s.includes('azul') || s.includes('indigo')) return 0x2563eb;
  if (s.includes('coral roxo') || s.includes('clavaria')) return 0x9333ea;
  if (s.includes('carmim') || s.includes('cookeina')) return 0xf43f5e;
  if (s.includes('cauda de peru')) return 0x0ea5e9;
  if (s.includes('dourad') || s.includes('chanterelle')) return 0xfacc15;
  if (s.includes('salm') || s.includes('rosa') || s.includes('djamor')) return 0xfb7185;
  if (s.includes('branc') || s.includes('juba') || s.includes('hericium') || s.includes('enoki')) return 0xf8fafc;
  if (s.includes('reishi') || s.includes('ganoderma') || s.includes('amanita')) return 0xdc2626;
  if (s.includes('cubensis') || s.includes('golden') || s.includes('azurescens') || s.includes('morel')) return 0xd97706;
  return 0x854d0e;
}

const RACK_DEFS = [
  { id: 'central', label: 'Estante Central', x: 18.80, faceSign: 1 },
  { id: 'leste', label: 'Estante Leste', x: 22.30, faceSign: -1 }
];
const TIER_Y = [0.64, 1.36, 2.08];
const SLOT_Z = [5.0, 7.0, 9.0, 11.0];

function buildInitialSlots() {
  const slots = [];
  const initialOccupied = [
    { preset: 0, stage: 1, hum: 86, growth: 30 },
    { preset: 1, stage: 2, hum: 84, growth: 55 },
    { preset: 2, stage: 0, hum: 89, growth: 15 },
    { preset: 3, stage: 3, hum: 92, growth: 100 },
    { preset: 4, stage: 3, hum: 90, growth: 100 },
    { preset: 5, stage: 2, hum: 87, growth: 60 },
    { preset: 6, stage: 1, hum: 85, growth: 25 },
    { preset: 7, stage: 2, hum: 88, growth: 70 },
    { preset: 0, stage: 3, hum: 91, growth: 100 },
    { preset: 5, stage: 3, hum: 93, growth: 100 },
    { preset: 1, stage: 1, hum: 83, growth: 40 },
    { preset: 2, stage: 2, hum: 89, growth: 65 },
    { preset: 4, stage: 2, hum: 88, growth: 50 },
    { preset: 3, stage: 1, hum: 90, growth: 35 },
    { preset: 7, stage: 3, hum: 91, growth: 100 },
    { preset: 6, stage: 0, hum: 84, growth: 20 }
  ];

  let idx = 0;
  for (let r = 0; r < RACK_DEFS.length; r++) {
    const rack = RACK_DEFS[r];
    for (let t = 0; t < TIER_Y.length; t++) {
      for (let zIdx = 0; zIdx < SLOT_Z.length; zIdx++) {
        const init = initialOccupied[idx];
        const preset = init ? SPECIES_PRESETS[init.preset] : SPECIES_PRESETS[idx % SPECIES_PRESETS.length];
        const isEmpty = !init;
        slots.push({
          id: idx,
          rackId: rack.id,
          rackName: rack.label,
          tier: t + 1,
          faceSign: rack.faceSign,
          name: isEmpty ? 'Espaço Livre #' + (idx + 1) : preset.name,
          sci: isEmpty ? 'Aguardando Spawn' : preset.sci,
          speciesName: isEmpty ? '' : preset.name,
          kind: preset.kind,
          x: rack.x,
          y: TIER_Y[t],
          z: SLOT_Z[zIdx],
          empty: isEmpty,
          stage: isEmpty ? -1 : init.stage,
          flush: 1,
          humidity: isEmpty ? 85 : init.hum,
          growth: isEmpty ? 0 : init.growth,
          health: 100,
          stressType: 'none',
          stressReason: '',
          stressReasons: [],
          color: preset.color,
          group: null,
          blockMesh: null,
          ledMesh: null,
          mushGroup: null,
          badgeSprite: null,
          lastBadgeKey: ''
        });
        idx++;
      }
    }
  }
  return slots;
}

export var greenhouseSlots = buildInitialSlots();
export var greenhouseHitMeshes = [];
export var greenhouseControlMeshes = [];
export var greenhouseDynamicObjects = [];

export var greenhouseEnv = {
  autoMode: true,
  humidity: 88.0,
  targetHumidity: 90,
  co2Ppm: 620,
  targetCo2: 650,
  tempC: 23.0,
  targetTempC: 23.0,
  outsideTempC: 25.5,
  outsideHumidity: 48,
  weatherMode: 'clear',
  doorOpen: false,
  doorOpenSec: 0,
  doorAlarmActive: false,
  lightOn: true,
  humidifierPower: 1, // 0=OFF, 1=Baixo, 2=Médio, 3=Turbo
  exhaustPower: 1,    // 0=OFF, 1=Baixo, 2=Forte
  coolerActive: true,
  climateScore: 100,
  avgHealth: 100,
  primaryStress: 'none',
  stressAdvice: '',
  statusLevel: 'optimal', // optimal | adjusting | alert
  statusLabel: 'Ideal (Auto)'
};

const DOOR_OPEN_ALARM_DELAY = 10.0;
const DOOR_ALARM_BEEP_INTERVAL = 3.5;
var doorAlarmBeepAccum = 0;

var MAX_GH_PARTICLES = 36;
var MAX_MIST_PARTICLES = 48;
var sporeParticles = [];
var waterSprayParticles = [];
var mistParticles = [];
var sporePoints = null;
var waterPoints = null;
var mistPoints = null;
var sporePosAttr = null;
var waterPosAttr = null;
var mistPosAttr = null;
var ghShared = null;

var coolerFans = [];
var exhaustFan = null;
var estufaMainLight = null;
var growBarMeshes = [];
var growBarMats = [];
var panelLcdCanvas = null;
var panelLcdCtx = null;
var panelLcdTex = null;
var panelLedMesh = null;
var humidifierLedMesh = null;
var exhaustLedMesh = null;
var coolerLedMesh = null;
var panelRefreshAccum = 0;
var envSyncAccum = 0;

function getSharedGreenhouseAssets() {
  if (ghShared) return ghShared;
  const THREE = window.THREE;
  ghShared = {
    blockGeo: new THREE.BoxGeometry(0.36, 0.16, 0.28),
    trayGeo: new THREE.BoxGeometry(0.40, 0.03, 0.32),
    ledGeo: new THREE.BoxGeometry(0.30, 0.022, 0.022),
    fuzzGeo: new THREE.SphereGeometry(0.038, 6, 6),
    pinStemGeo: new THREE.CylinderGeometry(0.011, 0.015, 0.05, 6),
    pinCapGeo: new THREE.SphereGeometry(0.022, 6, 6),
    medStemGeo: new THREE.CylinderGeometry(0.022, 0.030, 0.11, 8),
    medCapGeo: new THREE.SphereGeometry(0.052, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
    shimejiStemGeo: new THREE.CylinderGeometry(0.015, 0.024, 0.19, 7),
    shimejiCapGeo: new THREE.SphereGeometry(0.062, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
    shiitakeStemGeo: new THREE.CylinderGeometry(0.028, 0.038, 0.16, 7),
    shiitakeCapGeo: new THREE.CylinderGeometry(0.088, 0.078, 0.038, 10),
    lionStemGeo: new THREE.CylinderGeometry(0.038, 0.048, 0.11, 7),
    lionBallGeo: new THREE.SphereGeometry(0.11, 10, 8),
    gtStemGeo: new THREE.CylinderGeometry(0.020, 0.030, 0.23, 7),
    gtVeilGeo: new THREE.RingGeometry(0.020, 0.042, 8),
    gtCapGeo: new THREE.ConeGeometry(0.076, 0.085, 10),
    blockMat: new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.92 }),
    colonizedBlockMat: new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.88 }),
    emptyTrayMat: new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.35 }),
    fuzzMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 }),
    pinStemMat: new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.8 }),
    medStemMat: new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 }),
    matureStemMat: new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.65 }),
    lionMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    gtVeilMat: new THREE.MeshBasicMaterial({ color: 0x1e1b4b, side: THREE.DoubleSide }),
    ledGreenMat: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
    ledCyanMat: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    ledAmberMat: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    ledRedMat: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    ledSlateMat: new THREE.MeshBasicMaterial({ color: 0x64748b }),
    capMatsByKey: new Map()
  };
  Object.keys(ghShared).forEach((k) => {
    const val = ghShared[k];
    if (val && val.userData) val.userData.shared = true;
  });
  return ghShared;
}

function getGreenhouseCapMat(col, roughness, emissiveHex, emissiveInt) {
  const assets = getSharedGreenhouseAssets();
  const key = `${col}|${roughness}|${emissiveHex || 0}|${emissiveInt || 0}`;
  let m = assets.capMatsByKey.get(key);
  if (!m) {
    m = new window.THREE.MeshStandardMaterial({
      color: col,
      roughness: roughness,
      emissive: emissiveHex || 0x000000,
      emissiveIntensity: emissiveInt || 0
    });
    m.userData.shared = true;
    assets.capMatsByKey.set(key, m);
  }
  return m;
}

function getSlotLedMaterial(slot) {
  const assets = getSharedGreenhouseAssets();
  if (slot.empty || slot.stage < 0) return assets.ledSlateMat;
  if ((slot.health !== undefined && slot.health < 60) || (slot.stressType && slot.stressType !== 'none' && slot.health < 80)) {
    return assets.ledRedMat;
  }
  if (slot.stressType && slot.stressType !== 'none') return assets.ledAmberMat;
  if (slot.stage === 3) return assets.ledGreenMat;
  if (slot.humidity < 60) return assets.ledRedMat;
  if (slot.humidity < 75) return assets.ledAmberMat;
  return assets.ledCyanMat;
}

export function initGreenhouseParticlePools(scene) {
  const THREE = window.THREE;
  sporeParticles.length = 0;
  waterSprayParticles.length = 0;
  mistParticles.length = 0;

  const sArr = new Float32Array(MAX_GH_PARTICLES * 3);
  const sGeo = new THREE.BufferGeometry();
  sporePosAttr = new THREE.BufferAttribute(sArr, 3);
  sGeo.setAttribute('position', sporePosAttr);
  sporePoints = new THREE.Points(sGeo, new THREE.PointsMaterial({
    color: 0xfef08a,
    size: 0.06,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  }));
  sporePoints.visible = false;
  sporePoints.frustumCulled = false;
  sporePoints.userData.isDynamic = true;
  scene.add(sporePoints);

  const wArr = new Float32Array(MAX_GH_PARTICLES * 3);
  const wGeo = new THREE.BufferGeometry();
  waterPosAttr = new THREE.BufferAttribute(wArr, 3);
  wGeo.setAttribute('position', waterPosAttr);
  waterPoints = new THREE.Points(wGeo, new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.05,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  }));
  waterPoints.visible = false;
  waterPoints.frustumCulled = false;
  waterPoints.userData.isDynamic = true;
  scene.add(waterPoints);

  const mArr = new Float32Array(MAX_MIST_PARTICLES * 3);
  const mGeo = new THREE.BufferGeometry();
  mistPosAttr = new THREE.BufferAttribute(mArr, 3);
  mGeo.setAttribute('position', mistPosAttr);
  mistPoints = new THREE.Points(mGeo, new THREE.PointsMaterial({
    color: 0xe0f2fe,
    size: 0.14,
    transparent: true,
    opacity: 0.34,
    depthWrite: false
  }));
  mistPoints.visible = true;
  mistPoints.frustumCulled = false;
  mistPoints.userData.isDynamic = true;
  scene.add(mistPoints);

  for (let i = 0; i < MAX_GH_PARTICLES; i++) {
    sArr[i * 3 + 1] = -999;
    wArr[i * 3 + 1] = -999;
    sporeParticles.push({ active: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 2.0 });
    waterSprayParticles.push({ active: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1.2 });
  }

  for (let m = 0; m < MAX_MIST_PARTICLES; m++) {
    const isEast = m % 2 === 0;
    const ox = isEast ? 20.55 : 18.85;
    const oz = 4.4 + ((m * 1.37) % 7.4);
    const oy = 2.65 - Math.random() * 1.4;
    mArr[m * 3] = ox;
    mArr[m * 3 + 1] = oy;
    mArr[m * 3 + 2] = oz;
    mistParticles.push({
      ox,
      oz,
      x: ox + (Math.random() - 0.5) * 0.6,
      y: oy,
      z: oz + (Math.random() - 0.5) * 0.6,
      vy: -(0.18 + Math.random() * 0.22),
      vx: (Math.random() - 0.5) * 0.12,
      life: Math.random() * 3.0,
      maxLife: 2.5 + Math.random() * 1.5
    });
  }
}

export function triggerSporeBurst(ox, oy, oz, col) {
  if (!sporePoints || !sporePosAttr) return;
  if (col && sporePoints.material && sporePoints.material.color) {
    sporePoints.material.color.setHex(col);
  }
  const arr = sporePosAttr.array;
  for (let i = 0; i < sporeParticles.length; i++) {
    const sp = sporeParticles[i];
    sp.x = ox + (Math.random() - 0.5) * 0.25;
    sp.y = oy;
    sp.z = oz + (Math.random() - 0.5) * 0.25;
    sp.vx = (Math.random() - 0.5) * 1.5;
    sp.vy = Math.random() * 1.8 + 0.5;
    sp.vz = (Math.random() - 0.5) * 1.5;
    sp.life = 0;
    sp.maxLife = 1.5 + Math.random() * 0.8;
    sp.active = true;
    arr[i * 3] = sp.x;
    arr[i * 3 + 1] = sp.y;
    arr[i * 3 + 2] = sp.z;
  }
  sporePosAttr.needsUpdate = true;
  sporePoints.visible = true;
}

export function triggerWaterSprayFx(ox, oy, oz) {
  if (!waterPoints || !waterPosAttr) return;
  const arr = waterPosAttr.array;
  for (let i = 0; i < waterSprayParticles.length; i++) {
    const wp = waterSprayParticles[i];
    wp.x = ox + (Math.random() - 0.5) * 0.35;
    wp.y = oy + 0.55;
    wp.z = oz + (Math.random() - 0.5) * 0.35;
    wp.vx = (Math.random() - 0.5) * 0.4;
    wp.vy = -(Math.random() * 1.5 + 1.2);
    wp.vz = (Math.random() - 0.5) * 0.4;
    wp.life = 0;
    wp.maxLife = 0.8 + Math.random() * 0.4;
    wp.active = true;
    arr[i * 3] = wp.x;
    arr[i * 3 + 1] = wp.y;
    arr[i * 3 + 2] = wp.z;
  }
  waterPosAttr.needsUpdate = true;
  waterPoints.visible = true;
}

export function stepGreenhouseParticles(dt) {
  if (sporePoints && sporePoints.visible && sporePosAttr) {
    const sArr = sporePosAttr.array;
    let anySpore = false;
    let avgOp = 0;
    let activeCount = 0;
    for (let i = 0; i < sporeParticles.length; i++) {
      const sp = sporeParticles[i];
      if (!sp.active) {
        sArr[i * 3 + 1] = -999;
        continue;
      }
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        sArr[i * 3 + 1] = -999;
        continue;
      }
      anySpore = true;
      activeCount++;
      avgOp += Math.max(0, 1 - sp.life / sp.maxLife);
      sp.vy -= 0.6 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.z += sp.vz * dt;
      sArr[i * 3] = sp.x;
      sArr[i * 3 + 1] = sp.y;
      sArr[i * 3 + 2] = sp.z;
    }
    sporePosAttr.needsUpdate = true;
    sporePoints.material.opacity = activeCount > 0 ? (avgOp / activeCount) * 0.85 : 0;
    if (!anySpore) sporePoints.visible = false;
  }

  if (waterPoints && waterPoints.visible && waterPosAttr) {
    const wArr = waterPosAttr.array;
    let anyWater = false;
    for (let j = 0; j < waterSprayParticles.length; j++) {
      const wp = waterSprayParticles[j];
      if (!wp.active) {
        wArr[j * 3 + 1] = -999;
        continue;
      }
      wp.life += dt;
      if (wp.life >= wp.maxLife) {
        wp.active = false;
        wArr[j * 3 + 1] = -999;
        continue;
      }
      anyWater = true;
      wp.x += wp.vx * dt;
      wp.y += wp.vy * dt;
      wp.z += wp.vz * dt;
      wArr[j * 3] = wp.x;
      wArr[j * 3 + 1] = wp.y;
      wArr[j * 3 + 2] = wp.z;
    }
    waterPosAttr.needsUpdate = true;
    if (!anyWater) waterPoints.visible = false;
  }

  if (mistPoints && mistPosAttr) {
    const mistActive = greenhouseEnv.humidifierPower > 0;
    mistPoints.visible = mistActive;
    if (mistActive) {
      const speedMult = 0.65 + greenhouseEnv.humidifierPower * 0.35;
      const mArr = mistPosAttr.array;
      for (let m = 0; m < mistParticles.length; m++) {
        const mp = mistParticles[m];
        mp.life += dt * speedMult;
        if (mp.life >= mp.maxLife || mp.y < 0.55) {
          mp.life = 0;
          mp.x = mp.ox + (Math.random() - 0.5) * 0.45;
          mp.y = 2.68;
          mp.z = mp.oz + (Math.random() - 0.5) * 0.45;
        } else {
          mp.x += mp.vx * dt * speedMult;
          mp.y += mp.vy * dt * speedMult;
        }
        mArr[m * 3] = mp.x;
        mArr[m * 3 + 1] = mp.y;
        mArr[m * 3 + 2] = mp.z;
      }
      mistPosAttr.needsUpdate = true;
      mistPoints.material.opacity = Math.min(0.45, 0.16 + greenhouseEnv.humidifierPower * 0.09);
    }
  }
}

export function updateGreenhouseSlotMesh(slot) {
  if (!slot.mushGroup) return;
  disposeObjectResources(slot.mushGroup);
  while (slot.mushGroup.children.length > 0) {
    slot.mushGroup.remove(slot.mushGroup.children[0]);
  }

  const THREE = window.THREE;
  const assets = getSharedGreenhouseAssets();

  if (slot.blockMesh) {
    if (slot.empty || slot.stage < 0) {
      slot.blockMesh.material = assets.emptyTrayMat;
      slot.blockMesh.scale.set(1.0, 0.22, 1.0);
      slot.blockMesh.position.y = 0.02;
    } else if (slot.spent) {
      slot.blockMesh.material = assets.blockMat;
      slot.blockMesh.scale.set(0.84, 0.68, 0.84);
      slot.blockMesh.position.y = 0.055;
    } else {
      slot.blockMesh.material = slot.stage >= 1 ? assets.colonizedBlockMat : assets.blockMat;
      slot.blockMesh.scale.set(1.0, 1.0, 1.0);
      slot.blockMesh.position.y = 0.08;
    }
  }

  if (slot.ledMesh) {
    slot.ledMesh.material = getSlotLedMaterial(slot);
  }
  if (slot.mushGroup) {
    const hScale = slot.health !== undefined ? (0.72 + (Math.max(10, slot.health) / 100) * 0.28) : 1.0;
    slot.mushGroup.scale.set(hScale, hScale, hScale);
  }

  const stage = slot.stage;
  const col = slot.color;
  const kind = slot.kind || inferKindFromSpecies(slot.name);

  if (!slot.empty && stage === 0) {
    for (let fz = -2; fz <= 2; fz++) {
      const dot = new THREE.Mesh(assets.fuzzGeo, assets.fuzzMat);
      dot.scale.set(1.35, 0.35, 1.15);
      dot.position.set(fz * 0.05, 0.165, (fz % 2) * 0.04);
      slot.mushGroup.add(dot);
    }
  } else if (!slot.empty && stage === 1) {
    const pinMat = getGreenhouseCapMat(col, 0.5, 0, 0);
    for (let p = -2; p <= 2; p++) {
      const pStem = new THREE.Mesh(assets.pinStemGeo, assets.pinStemMat);
      pStem.position.set(p * 0.05, 0.175, ((p * 3) % 4) * 0.024);
      const pCap = new THREE.Mesh(assets.pinCapGeo, pinMat);
      pCap.position.set(p * 0.05, 0.205, ((p * 3) % 4) * 0.024);
      slot.mushGroup.add(pStem, pCap);
    }
  } else if (!slot.empty && stage === 2) {
    const medMat = getGreenhouseCapMat(col, 0.45, 0, 0);
    for (let m = -1; m <= 1; m++) {
      const mStem = new THREE.Mesh(assets.medStemGeo, assets.medStemMat);
      mStem.position.set(m * 0.08, 0.205, (m % 2) * 0.03);
      const mCap = new THREE.Mesh(assets.medCapGeo, medMat);
      mCap.position.set(m * 0.08, 0.265, (m % 2) * 0.03);
      slot.mushGroup.add(mStem, mCap);
    }
  } else if (!slot.empty && !slot.spent && stage >= 3) {
    const isGolden = col === 0xd97706 || kind === 'gt';
    const matureMat = getGreenhouseCapMat(col, 0.38, isGolden ? 0xf59e0b : 0x000000, isGolden ? 0.30 : 0);

    if (kind === 'shimeji') {
      for (let sb = -2; sb <= 2; sb++) {
        const sStem = new THREE.Mesh(assets.shimejiStemGeo, assets.matureStemMat);
        sStem.position.set(sb * 0.055, 0.24, ((sb * 2) % 3) * 0.035);
        sStem.rotation.z = sb * 0.14;
        const sCap = new THREE.Mesh(assets.shimejiCapGeo, matureMat);
        sCap.position.set(sb * 0.072, 0.33, ((sb * 2) % 3) * 0.035);
        slot.mushGroup.add(sStem, sCap);
      }
    } else if (kind === 'lion') {
      const jStem = new THREE.Mesh(assets.lionStemGeo, assets.matureStemMat);
      jStem.position.set(0, 0.20, 0);
      const lionBall = new THREE.Mesh(assets.lionBallGeo, assets.lionMat);
      lionBall.position.set(0, 0.29, 0);
      lionBall.scale.set(1.2, 0.9, 1.1);
      slot.mushGroup.add(jStem, lionBall);
    } else if (kind === 'gt') {
      for (let gt = -1; gt <= 1; gt++) {
        const gtStem = new THREE.Mesh(assets.gtStemGeo, assets.matureStemMat);
        gtStem.position.set(gt * 0.085, 0.26, gt * 0.03);
        const gtVeil = new THREE.Mesh(assets.gtVeilGeo, assets.gtVeilMat);
        gtVeil.rotation.x = Math.PI / 2;
        gtVeil.position.set(gt * 0.085, 0.31, gt * 0.03);
        const gtCap = new THREE.Mesh(assets.gtCapGeo, matureMat);
        gtCap.position.set(gt * 0.085, 0.39, gt * 0.03);
        slot.mushGroup.add(gtStem, gtVeil, gtCap);
      }
    } else {
      for (let sh = -1; sh <= 1; sh++) {
        const shStem = new THREE.Mesh(assets.shiitakeStemGeo, assets.matureStemMat);
        shStem.position.set(sh * 0.10, 0.23, 0);
        const shCap = new THREE.Mesh(assets.shiitakeCapGeo, matureMat);
        shCap.position.set(sh * 0.10, 0.31, 0);
        slot.mushGroup.add(shStem, shCap);
      }
    }
  }

  if (slot.badgeSprite) {
    const showBadge = !slot.empty && (slot.spent || slot.contaminated || slot.stage === 3 || slot.id < 4 || (slot.stressType && slot.stressType !== 'none'));
    slot.badgeSprite.visible = showBadge;
    if (showBadge) {
      const sNames = ['Micélio', 'Primórdios', 'Crescendo', '✨ MADURO!', '🍂 BOLO SECO'];
      const sColors = ['#94a3b8', '#38bdf8', '#fbbf24', '#34d399', '#d97706'];
      const slotHealth = typeof slot.health === 'number' ? Math.round(slot.health) : 100;
      const isStressed = slot.stressType && slot.stressType !== 'none';
      const badgeColor = slot.contaminated ? '#22c55e' : (slot.spent ? '#d97706' : (isStressed ? '#f87171' : (sColors[slot.stage] || '#94a3b8')));
      const statusTag = slot.contaminated
        ? '🦠 Contaminado (Trichoderma) • Clique p/ descartar'
        : (slot.spent
          ? '🍂 Bolo Seco Esgotado (4/4 Flushs) • Leve à Horta!'
          : (isStressed
            ? `⚠️ Estressado (${slotHealth}%): ${slot.stressReason}`
            : `${sNames[slot.stage] || 'Em cultivo'} • Flush ${slot.flush || 1}/4 • ❤️ ${slotHealth}%`));
      const badgeKey = `${slot.name}|${slot.stage}|${slot.flush}|${slot.spent ? 1 : 0}|${slot.contaminated ? 1 : 0}|${Math.round(slot.humidity / 5)}|${Math.round(slotHealth / 10)}|${slot.stressReason || ''}`;
      if (badgeKey !== slot.lastBadgeKey) {
        slot.lastBadgeKey = badgeKey;
        const infoText = `${slot.name}\n${statusTag}`;
        updateTextSprite(slot.badgeSprite, infoText, badgeColor);
      }
    }
  }
}

export function updateGreenhousePanelDisplay() {
  if (!panelLcdCtx || !panelLcdTex) return;
  const c = panelLcdCtx;
  const w = panelLcdCanvas.width;
  const h = panelLcdCanvas.height;

  c.fillStyle = '#07101f';
  c.fillRect(0, 0, w, h);

  c.strokeStyle = greenhouseEnv.statusLevel === 'alert'
    ? '#ef4444'
    : (greenhouseEnv.statusLevel === 'adjusting' ? '#f59e0b' : '#10b981');
  c.lineWidth = 6;
  c.strokeRect(4, 4, w - 8, h - 8);

  c.fillStyle = greenhouseEnv.statusLevel === 'alert' ? '#f87171' : '#10b981';
  c.font = 'bold 22px system-ui, sans-serif';
  c.fillText('ESTUFA • ' + (greenhouseEnv.autoMode ? 'AUTO' : 'MANUAL') + ' • ' + greenhouseEnv.statusLabel, 20, 36);

  c.fillStyle = greenhouseEnv.doorAlarmActive ? '#fb7185' : (greenhouseEnv.doorOpen ? '#fbbf24' : '#94a3b8');
  let activeBlocks = 0;
  let matureBlocks = 0;
  for (let i = 0; i < greenhouseSlots.length; i++) {
    if (!greenhouseSlots[i].empty && greenhouseSlots[i].stage >= 0) activeBlocks++;
    if (!greenhouseSlots[i].empty && greenhouseSlots[i].stage === 3) matureBlocks++;
  }
  const doorLcd = greenhouseEnv.doorOpen ? `PORTA ABERTA ${Math.floor(greenhouseEnv.doorOpenSec)}s` : 'PORTA OK';
  c.font = '15px system-ui, sans-serif';
  c.fillText(`Bolos: ${activeBlocks}/${greenhouseSlots.length} • Ext: ${greenhouseEnv.outsideTempC.toFixed(1)}C • ${doorLcd}`, 20, 64);

  c.fillStyle = '#0f172a';
  c.fillRect(16, 80, w - 32, 188);

  c.font = 'bold 18px monospace';
  c.fillStyle = greenhouseEnv.humidity > 95 || greenhouseEnv.humidity < 75 ? '#f87171' : '#38bdf8';
  c.fillText(`UR: ${Math.round(greenhouseEnv.humidity)}% (Alvo ${greenhouseEnv.targetHumidity}%)`, 26, 114);
  c.fillStyle = greenhouseEnv.humidifierPower > 0 ? '#34d399' : '#64748b';
  c.fillText(`UMID: ${greenhouseEnv.humidifierPower > 0 ? 'N' + greenhouseEnv.humidifierPower : 'OFF'}`, 356, 114);

  c.fillStyle = greenhouseEnv.co2Ppm > 1100 ? '#f87171' : '#a7f3d0';
  c.fillText(`CO2: ${Math.round(greenhouseEnv.co2Ppm)}ppm (${greenhouseEnv.targetCo2})`, 26, 152);
  c.fillStyle = greenhouseEnv.exhaustPower > 0 ? '#34d399' : '#64748b';
  c.fillText(`EXAU: ${greenhouseEnv.exhaustPower > 0 ? 'N' + greenhouseEnv.exhaustPower : 'OFF'}`, 356, 152);

  c.fillStyle = (greenhouseEnv.tempC > 27 || greenhouseEnv.tempC < 17.5) ? '#f87171' : '#fde68a';
  c.fillText(`TEMP: ${greenhouseEnv.tempC.toFixed(1)}C (Alvo ${greenhouseEnv.targetTempC.toFixed(1)}C)`, 26, 190);
  c.fillStyle = greenhouseEnv.coolerActive ? '#38bdf8' : '#64748b';
  c.fillText(`3FAN: ${greenhouseEnv.coolerActive ? 'ON' : 'OFF'}`, 356, 190);

  c.fillStyle = greenhouseEnv.primaryStress !== 'none' ? '#fb7185' : (greenhouseEnv.lightOn ? '#fef08a' : '#94a3b8');
  const bottomLine = greenhouseEnv.primaryStress !== 'none'
    ? `ALERTA: ${greenhouseEnv.stressAdvice}`.slice(0, 42)
    : `LED GROW: ${greenhouseEnv.lightOn ? 'LIGADO' : 'OFF'}  •  CLIQUE P/ CONFIG`;
  c.fillText(bottomLine, 26, 238);

  panelLcdTex.needsUpdate = true;

  const assets = getSharedGreenhouseAssets();
  if (panelLedMesh) {
    panelLedMesh.material = greenhouseEnv.statusLevel === 'alert'
      ? assets.ledRedMat
      : (greenhouseEnv.statusLevel === 'adjusting' ? assets.ledAmberMat : assets.ledGreenMat);
  }
  if (humidifierLedMesh) {
    humidifierLedMesh.material = greenhouseEnv.humidifierPower > 0 ? assets.ledCyanMat : assets.ledSlateMat;
  }
  if (exhaustLedMesh) {
    exhaustLedMesh.material = greenhouseEnv.exhaustPower > 0 ? assets.ledGreenMat : assets.ledSlateMat;
  }
  if (coolerLedMesh) {
    coolerLedMesh.material = greenhouseEnv.coolerActive ? assets.ledCyanMat : assets.ledSlateMat;
  }
  for (let i = 0; i < growBarMats.length; i++) {
    growBarMats[i].emissiveIntensity = greenhouseEnv.lightOn ? 1.15 : 0.05;
    growBarMats[i].color.setHex(greenhouseEnv.lightOn ? 0xf5f3ff : 0x334155);
  }
  if (estufaMainLight) {
    estufaMainLight.intensity = greenhouseEnv.lightOn ? 1.35 : 0.25;
  }
}

function buildCommercialRack(scene, rackDef, colliders, ctx) {
  const THREE = window.THREE;
  const rackGroup = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.72, roughness: 0.28 });
  const shelfGridMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.45, roughness: 0.45 });
  steelMat.userData.shared = true;
  shelfGridMat.userData.shared = true;

  const rackW = 0.88;
  const rackL = 7.60;
  const zCenter = 8.0;
  const postGeo = new THREE.BoxGeometry(0.055, 2.52, 0.055);
  const shelfGeo = new THREE.BoxGeometry(rackW, 0.04, rackL);
  const railZGeo = new THREE.BoxGeometry(0.035, 0.045, rackL);
  postGeo.userData.shared = true;
  shelfGeo.userData.shared = true;
  railZGeo.userData.shared = true;

  const postZOffsets = [-3.76, -1.25, 1.25, 3.76];
  const postXOffsets = [-rackW * 0.46, rackW * 0.46];
  for (let px = 0; px < postXOffsets.length; px++) {
    for (let pz = 0; pz < postZOffsets.length; pz++) {
      const post = new THREE.Mesh(postGeo, steelMat);
      post.position.set(rackDef.x + postXOffsets[px], 0.14 + 1.26, zCenter + postZOffsets[pz]);
      rackGroup.add(post);
    }
  }

  for (let t = 0; t < TIER_Y.length; t++) {
    const sy = TIER_Y[t];
    const shelf = new THREE.Mesh(shelfGeo, shelfGridMat);
    shelf.position.set(rackDef.x, sy - 0.02, zCenter);
    rackGroup.add(shelf);
    if (ctx && ctx.supportSurfaces && ctx.supportMeshes) {
      const ghSurf = {
        minX: rackDef.x - rackW * 0.5 + 0.02,
        maxX: rackDef.x + rackW * 0.5 - 0.02,
        minZ: zCenter - rackL * 0.5 + 0.02,
        maxZ: zCenter + rackL * 0.5 - 0.02,
        topY: sy
      };
      ctx.supportSurfaces.push(ghSurf);
      shelf.userData.supportSurface = ghSurf;
      ctx.supportMeshes.push(shelf);
    }

    for (let px = 0; px < postXOffsets.length; px++) {
      const rail = new THREE.Mesh(railZGeo, steelMat);
      rail.position.set(rackDef.x + postXOffsets[px], sy - 0.02, zCenter);
      rackGroup.add(rail);
    }
  }

  scene.add(rackGroup);

  if (colliders) {
    colliders.push({
      minX: rackDef.x - 0.50,
      maxX: rackDef.x + 0.50,
      minZ: zCenter - 3.85,
      maxZ: zCenter + 3.85,
      minY: 0.14,
      maxY: 2.66,
      surfaceTopY: 2.66
    });
  }
}

function buildClimateHardware(scene, colliders) {
  const THREE = window.THREE;
  const assets = getSharedGreenhouseAssets();
  greenhouseControlMeshes.length = 0;
  greenhouseDynamicObjects.length = 0;
  coolerFans.length = 0;
  growBarMeshes.length = 0;
  growBarMats.length = 0;
  exhaustFan = null;

  const inoxMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.78, roughness: 0.25 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.55, roughness: 0.42 });
  const pvcMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
  const fanBladeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.25 });
  const tankBlueMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.52, roughness: 0.15 });
  inoxMat.userData.shared = true;
  darkMetalMat.userData.shared = true;
  pvcMat.userData.shared = true;
  fanBladeMat.userData.shared = true;
  tankBlueMat.userData.shared = true;

  // 1. Climatizador / Evaporador com 3 Ventoinhas no Teto (inspirado na Foto 4)
  const coolerGroup = new THREE.Group();
  coolerGroup.position.set(23.38, 2.86, 8.0);
  const coolerBody = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 2.40), inoxMat);
  coolerBody.userData.greenhouseDevice = 'cooler';
  coolerGroup.add(coolerBody);
  greenhouseControlMeshes.push(coolerBody);

  const shroudGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16);
  const hubGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10);
  const bladeGeo = new THREE.BoxGeometry(0.02, 0.16, 0.055);
  [-0.72, 0, 0.72].forEach((fz) => {
    const shroud = new THREE.Mesh(shroudGeo, darkMetalMat);
    shroud.rotation.z = Math.PI / 2;
    shroud.position.set(-0.27, 0.02, fz);
    coolerGroup.add(shroud);

    const fanRotor = new THREE.Group();
    fanRotor.position.set(-0.29, 0.02, fz);
    const hub = new THREE.Mesh(hubGeo, darkMetalMat);
    hub.rotation.z = Math.PI / 2;
    fanRotor.add(hub);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(bladeGeo, fanBladeMat);
      const ang = (b * Math.PI) / 2;
      blade.position.set(0, Math.cos(ang) * 0.11, Math.sin(ang) * 0.11);
      blade.rotation.x = ang;
      fanRotor.add(blade);
    }
    coolerGroup.add(fanRotor);
    coolerFans.push(fanRotor);
  });

  // Tubos PVC do evaporador
  const drainPipeV = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 2.65, 8), pvcMat);
  drainPipeV.position.set(0.18, -1.32, -1.05);
  const drainPipeH = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.4, 8), pvcMat);
  drainPipeH.rotation.x = Math.PI / 2;
  drainPipeH.position.set(0.18, -0.34, -0.35);
  coolerLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.10), assets.ledCyanMat);
  coolerLedMesh.position.set(-0.28, -0.22, -1.05);
  coolerGroup.add(drainPipeV, drainPipeH, coolerLedMesh);
  scene.add(coolerGroup);
  greenhouseDynamicObjects.push(coolerGroup);

  // 2. Exaustor Industrial Lateral + Duto PVC (Parede Sul)
  const exhaustGroup = new THREE.Group();
  exhaustGroup.position.set(20.55, 2.74, 13.52);
  const exhaustBox = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.74, 0.34), inoxMat);
  exhaustBox.userData.greenhouseDevice = 'exhaust';
  const exhaustHole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.36, 16), darkMetalMat);
  exhaustHole.rotation.x = Math.PI / 2;
  const exRotor = new THREE.Group();
  exRotor.position.set(0, 0, -0.16);
  const exHub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), darkMetalMat);
  exHub.rotation.x = Math.PI / 2;
  exRotor.add(exHub);
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.02), fanBladeMat);
    const ang = (b * Math.PI) / 2;
    blade.position.set(Math.cos(ang) * 0.13, Math.sin(ang) * 0.13, 0);
    blade.rotation.z = ang;
    exRotor.add(blade);
  }
  exhaustFan = exRotor;
  exhaustLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.04), assets.ledGreenMat);
  exhaustLedMesh.position.set(0.26, -0.28, -0.18);
  const exDuct = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 10), pvcMat);
  exDuct.position.set(0, 0.56, 0.04);
  exhaustGroup.add(exhaustBox, exhaustHole, exRotor, exhaustLedMesh, exDuct);
  scene.add(exhaustGroup);
  greenhouseControlMeshes.push(exhaustBox);
  greenhouseDynamicObjects.push(exhaustGroup);

  // 3. Umidificador Ultrassônico com Reservatório Azul e Tubulação de Névoa
  const humGroup = new THREE.Group();
  humGroup.position.set(17.30, 0.19, 3.15);
  const humBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 0.56), darkMetalMat);
  humBase.position.y = 0.17;
  humBase.userData.greenhouseDevice = 'humidifier';
  const humTank = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.50), tankBlueMat);
  humTank.position.y = 0.65;
  humTank.userData.greenhouseDevice = 'humidifier';
  const humCap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.54), inoxMat);
  humCap.position.y = 0.99;
  humidifierLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), assets.ledCyanMat);
  humidifierLedMesh.position.set(0, 0.24, 0.29);

  // Tubo PVC de névoa subindo até os bicos difusores sobre os corredores
  const mistPipeUp = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.85, 8), pvcMat);
  mistPipeUp.position.set(0, 1.92, 0);
  const mistHeaderX = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 3.8, 8), pvcMat);
  mistHeaderX.rotation.z = Math.PI / 2;
  mistHeaderX.position.set(1.65, 2.82, 0);
  const mistRun1 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 7.6, 8), pvcMat);
  mistRun1.rotation.x = Math.PI / 2;
  mistRun1.position.set(1.55, 2.82, 4.9);
  const mistRun2 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 7.6, 8), pvcMat);
  mistRun2.rotation.x = Math.PI / 2;
  mistRun2.position.set(3.25, 2.82, 4.9);

  humGroup.add(humBase, humTank, humCap, humidifierLedMesh, mistPipeUp, mistHeaderX, mistRun1, mistRun2);
  scene.add(humGroup);
  greenhouseControlMeshes.push(humBase, humTank);
  greenhouseDynamicObjects.push(humGroup);
  if (colliders) {
    colliders.push({
      minX: 16.92, maxX: 17.68, minZ: 2.82, maxZ: 3.48, minY: 0.14, maxY: 1.25, surfaceTopY: 1.25
    });
  }

  // 4. Barras de LED Grow no Teto (Estante Central + Estante Leste)
  [18.80, 22.30].forEach((rx) => {
    [-2.0, 2.0].forEach((dz) => {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 3.2), darkMetalMat);
      fixture.position.set(rx, 3.38, 8.0 + dz);
      const barMat = new THREE.MeshStandardMaterial({
        color: 0xf5f3ff,
        emissive: 0xd8b4fe,
        emissiveIntensity: 1.15,
        roughness: 0.3
      });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 3.05), barMat);
      bar.position.set(rx, 3.34, 8.0 + dz);
      scene.add(fixture, bar);
      growBarMeshes.push(bar);
      growBarMats.push(barMat);
      greenhouseDynamicObjects.push(bar);
    });
  });

  if (!estufaMainLight) {
    estufaMainLight = new THREE.PointLight(0xfef9c3, 1.35, 16, 1.35);
    estufaMainLight.position.set(20.5, 2.85, 8.0);
    scene.add(estufaMainLight);
    greenhouseDynamicObjects.push(estufaMainLight);
  }

  // 5. Painel Controlador Digital na Parede de Entrada (x=14.30, y=1.56, z=6.25)
  const panelGroup = new THREE.Group();
  panelGroup.position.set(14.30, 1.56, 6.25);
  panelGroup.rotation.y = Math.PI / 2;

  const panelCase = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.74, 0.12), darkMetalMat);
  panelCase.userData.greenhouseDevice = 'panel';

  panelLcdCanvas = document.createElement('canvas');
  panelLcdCanvas.width = 512;
  panelLcdCanvas.height = 288;
  panelLcdCtx = panelLcdCanvas.getContext('2d');
  panelLcdTex = new THREE.CanvasTexture(panelLcdCanvas);
  const lcdScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.04, 0.56),
    new THREE.MeshBasicMaterial({ map: panelLcdTex })
  );
  lcdScreen.position.set(0, 0.04, 0.065);
  lcdScreen.userData.greenhouseDevice = 'panel';

  panelLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), assets.ledGreenMat);
  panelLedMesh.position.set(-0.42, -0.30, 0.065);

  const btnColors = [0x10b981, 0x38bdf8, 0xf59e0b, 0xa855f7];
  for (let b = 0; b < btnColors.length; b++) {
    const btnMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.045, 0.03),
      new THREE.MeshBasicMaterial({ color: btnColors[b] })
    );
    btnMesh.position.set(-0.15 + b * 0.18, -0.30, 0.065);
    btnMesh.userData.greenhouseDevice = 'panel';
    panelGroup.add(btnMesh);
  }

  panelGroup.add(panelCase, lcdScreen, panelLedMesh);
  scene.add(panelGroup);
  greenhouseControlMeshes.push(panelCase, lcdScreen);
  greenhouseDynamicObjects.push(panelGroup);

  updateGreenhousePanelDisplay();
}

export function buildGreenhouseBench(scene, ctx) {
  greenhouseHitMeshes.length = 0;
  const assets = getSharedGreenhouseAssets();
  const colliders = ctx && ctx.solidColliders ? ctx.solidColliders : null;

  for (let r = 0; r < RACK_DEFS.length; r++) {
    buildCommercialRack(scene, RACK_DEFS[r], colliders, ctx);
  }
  buildClimateHardware(scene, colliders);

  greenhouseSlots.forEach(function (slot) {
    const g = new THREE.Group();
    g.position.set(slot.x, slot.y, slot.z);

    const blockMesh = new THREE.Mesh(assets.blockGeo, assets.blockMat);
    blockMesh.position.y = 0.08;
    blockMesh.userData.greenhouseSlot = slot;
    g.add(blockMesh);
    greenhouseHitMeshes.push(blockMesh);
    slot.blockMesh = blockMesh;

    const ledStrip = new THREE.Mesh(assets.ledGeo, getSlotLedMaterial(slot));
    ledStrip.position.set(slot.faceSign * 0.19, 0.015, 0);
    ledStrip.rotation.y = Math.PI / 2;
    g.add(ledStrip);
    slot.ledMesh = ledStrip;

    const mg = new THREE.Group();
    g.add(mg);
    slot.group = g;
    slot.mushGroup = mg;

    const badge = makeTextSprite(slot.name, '#34d399');
    badge.position.set(0, 0.46, 0);
    badge.scale.set(0.95, 0.24, 1);
    badge.visible = false;
    g.add(badge);
    slot.badgeSprite = badge;

    updateGreenhouseSlotMesh(slot);
    scene.add(g);
    greenhouseDynamicObjects.push(g);
  });
}

export function applyGreenhouseAutomationSettings(partial, ctx) {
  if (!partial || typeof partial !== 'object') return;
  if (typeof partial.autoMode === 'boolean') greenhouseEnv.autoMode = partial.autoMode;
  if (typeof partial.targetHumidity === 'number') greenhouseEnv.targetHumidity = Math.max(55, Math.min(98, Math.round(partial.targetHumidity)));
  if (typeof partial.targetCo2 === 'number') greenhouseEnv.targetCo2 = Math.max(420, Math.min(2000, Math.round(partial.targetCo2)));
  if (typeof partial.targetTempC === 'number') greenhouseEnv.targetTempC = Math.max(14, Math.min(32, Math.round(partial.targetTempC * 2) / 2));
  if (typeof partial.lightOn === 'boolean') greenhouseEnv.lightOn = partial.lightOn;
  if (typeof partial.humidifierPower === 'number') greenhouseEnv.humidifierPower = Math.max(0, Math.min(3, Math.round(partial.humidifierPower)));
  if (typeof partial.exhaustPower === 'number') greenhouseEnv.exhaustPower = Math.max(0, Math.min(2, Math.round(partial.exhaustPower)));
  if (typeof partial.coolerActive === 'boolean') greenhouseEnv.coolerActive = partial.coolerActive;

  updateGreenhousePanelDisplay();
  if (ctx && ctx.queueWorldStateChange) {
    ctx.queueWorldStateChange('greenhouse_auto', greenhouseEnv.autoMode ? 1 : 0);
    ctx.queueWorldStateChange('greenhouse_target_hum', greenhouseEnv.targetHumidity);
    ctx.queueWorldStateChange('greenhouse_target_co2', greenhouseEnv.targetCo2);
    ctx.queueWorldStateChange('greenhouse_target_temp', Math.round(greenhouseEnv.targetTempC * 10));
    ctx.queueWorldStateChange('greenhouse_humidifier', greenhouseEnv.humidifierPower);
    ctx.queueWorldStateChange('greenhouse_exhaust', greenhouseEnv.exhaustPower);
    ctx.queueWorldStateChange('greenhouse_cooler', greenhouseEnv.coolerActive ? 1 : 0);
    ctx.queueWorldStateChange('greenhouse_light', greenhouseEnv.lightOn ? 1 : 0);
  }
}

export function restoreGreenhouseOptimal(ctx) {
  return applyGreenhouseAutomationSettings({
    autoMode: true,
    targetHumidity: 90,
    targetCo2: 650,
    targetTempC: 23.0,
    lightOn: true
  }, ctx);
}

export function triggerGreenhouseMistPulse(ctx) {
  greenhouseEnv.humidity = Math.min(98, greenhouseEnv.humidity + 6);
  for (let i = 0; i < greenhouseSlots.length; i++) {
    if (!greenhouseSlots[i].empty) {
      greenhouseSlots[i].humidity = Math.min(99, greenhouseSlots[i].humidity + 10);
      updateGreenhouseSlotMesh(greenhouseSlots[i]);
    }
  }
  triggerWaterSprayFx(19.0, 2.2, 7.5);
  if (window.MycoAudio) window.MycoAudio.playSpray();
  updateGreenhousePanelDisplay();
  if (ctx && ctx.queueWorldStateChange) {
    ctx.queueWorldStateChange('greenhouse_hum', Math.round(greenhouseEnv.humidity));
  }
}

export function triggerGreenhouseVentPulse(ctx) {
  greenhouseEnv.co2Ppm = Math.max(430, greenhouseEnv.co2Ppm - 180);
  if (window.MycoAudio) window.MycoAudio.playClick();
  updateGreenhousePanelDisplay();
  if (ctx && ctx.queueWorldStateChange) {
    ctx.queueWorldStateChange('greenhouse_co2', Math.round(greenhouseEnv.co2Ppm));
  }
}

export function isHoldingColonizedSpawn(heldItem) {
  return !!(heldItem && heldItem.spawnCtrl && heldItem.spawnCtrl.colonized && !heldItem.spawnCtrl.contaminated);
}

export function interactGreenhouseSlot(slot, ctx) {
  const heldItem = ctx.heldItem;
  const callbacks = ctx.callbacks || {};
  const queueWorldStateChange = ctx.queueWorldStateChange;
  const isHoldingSpray = !!(heldItem && (heldItem.id.indexOf('alcohol_spray') !== -1 || heldItem.id.indexOf('spray') !== -1));
  const hasColonizedSpawn = isHoldingColonizedSpawn(heldItem);

  if (hasColonizedSpawn) {
    if (slot.empty || slot.stage <= 0) {
      const sp = heldItem.spawnCtrl;
      const customSpecies = sp.speciesName || '';
      sp.filled = false;
      sp.fillGrams = 0;
      sp.waterMl = 0;
      sp.substrateKind = '';
      sp.sterilized = false;
      sp.sterilizeProgress = 0;
      sp.sealed = false;
      sp.inoculated = false;
      sp.colonized = false;
      sp.colonization = 0;
      sp.contaminated = false;
      sp.burned = false;
      sp.expired = false;
      sp.ageGameDays = 0;
      sp.speciesName = '';
      updateSpawnVisual(heldItem);

      heldItem.mesh.position.copy(heldItem.homePos);
      heldItem.mesh.rotation.set(0, heldItem.homeRy || 0, 0);
      heldItem.isMoved = false;
      if (heldItem.mesh.userData.updateBounds) heldItem.mesh.userData.updateBounds(heldItem);
      if (ctx.pendingMovedItems) {
        ctx.pendingMovedItems[heldItem.id] = {
          id: heldItem.id, x: heldItem.homePos.x, y: heldItem.homePos.y, z: heldItem.homePos.z, ry: heldItem.homeRy || 0
        };
      }
      ctx.heldItem = null;
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (callbacks.onHoldChange) callbacks.onHoldChange(null);

      slot.empty = false;
      slot.stage = 1;
      slot.growth = 25;
      slot.flush = 1;
      if (customSpecies) {
        slot.speciesName = customSpecies;
        slot.name = customSpecies;
        slot.sci = 'Cultivo do Laboratório';
        slot.kind = inferKindFromSpecies(customSpecies);
        slot.color = inferColorFromSpecies(customSpecies);
      } else if (slot.name.indexOf('Espaço Livre') === 0) {
        const preset = SPECIES_PRESETS[slot.id % SPECIES_PRESETS.length];
        slot.name = preset.name;
        slot.sci = preset.sci;
        slot.speciesName = preset.name;
        slot.kind = preset.kind;
        slot.color = preset.color;
      }
      slot.humidity = Math.max(88, greenhouseEnv.humidity);

      if (window.MycoAudio) window.MycoAudio.playHarvest();
      triggerSporeBurst(slot.x, slot.y + 0.25, slot.z, slot.color);
      updateGreenhouseSlotMesh(slot);
      updateGreenhousePanelDisplay();
      if (queueWorldStateChange) {
        queueWorldStateChange('greenhouse_slot_' + slot.id + '_stage', 1);
        queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', Math.round(slot.humidity));
        queueWorldStateChange('greenhouse_slot_' + slot.id + '_empty', 0);
        if (slot.speciesName) queueWorldStateChange('greenhouse_slot_' + slot.id + '_species', slot.speciesName);
      }
      if (callbacks.onLabStep) callbacks.onLabStep('greenhouse_care');
      if (callbacks.onToast) {
        callbacks.onToast(`🍄 Bolo de ${slot.name} posicionado na ${slot.rackName} (Andar ${slot.tier})! Primórdios iniciados!`);
      }
      if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    } else {
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (callbacks.onToast) {
        callbacks.onToast(`🌱 ${slot.name} (${slot.rackName} • Andar ${slot.tier}) já está frutificando! Use um espaço livre.`);
      }
    }
    return;
  }

  if (slot.empty || slot.stage < 0) {
    slot.empty = false;
    slot.stage = 0;
    slot.growth = 10;
    slot.flush = 1;
    const preset = SPECIES_PRESETS[slot.id % SPECIES_PRESETS.length];
    slot.name = preset.name;
    slot.sci = preset.sci;
    slot.speciesName = preset.name;
    slot.kind = preset.kind;
    slot.color = preset.color;
    slot.humidity = Math.max(82, greenhouseEnv.humidity);
    if (window.MycoAudio) window.MycoAudio.playClick();
    updateGreenhouseSlotMesh(slot);
    updateGreenhousePanelDisplay();
    if (queueWorldStateChange) {
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_empty', 0);
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_stage', 0);
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', Math.round(slot.humidity));
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_species', slot.speciesName);
    }
    if (callbacks.onToast) {
      callbacks.onToast(`🧱 Novo bloco de ${slot.name} iniciado na ${slot.rackName} (Andar ${slot.tier})! (Dica: você também pode trazer Spawn colonizado do Lab!)`);
    }
    return;
  }

  // Se o bolo já completou os 4 flushs (spent) ou contaminou, clicar nele com a mão livre retira o Bolo Seco Esgotado para levar à Horta!
  if (!slot.empty && (slot.spent || slot.contaminated)) {
    if (heldItem) {
      if (callbacks.onToast) {
        callbacks.onToast('⚠️ Esvazie as mãos para retirar o bolo seco esgotado e levá-lo à Caixa de Substrato da Horta!');
      }
      return;
    }
    const oldSpecies = slot.speciesName || slot.name || 'Cogumelo';
    slot.empty = true;
    slot.spent = false;
    slot.contaminated = false;
    slot.stage = -1;
    slot.growth = 0;
    slot.flush = 1;
    slot.health = 100;
    slot.stressType = 'none';
    slot.stressReason = '';
    slot.stressReasons = [];
    slot.name = 'Espaço Livre #' + (slot.id + 1);
    slot.sci = 'Aguardando Spawn';
    slot.speciesName = '';
    updateGreenhouseSlotMesh(slot);
    updateGreenhousePanelDisplay();
    if (queueWorldStateChange) {
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_empty', 1);
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_stage', 0);
    }

    const spentItem = makeSpentCakeItem(ctx, 'spent_cake_' + Date.now().toString(36), oldSpecies, slot.x, slot.y, slot.z);
    ctx.heldItem = spentItem;
    ctx.lastPickupAt = performance.now();
    if (callbacks.onHoldChange) callbacks.onHoldChange(spentItem.label);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (callbacks.onToast) {
      callbacks.onToast(`🍂 Você retirou o Bolo Seco Esgotado de ${oldSpecies} (4/4 Flushs)! Leve-o para a Caixa de Substrato na Horta ao sul da Estufa!`);
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return;
  }

  if (slot.stage === 3) {
    if (window.MycoAudio) window.MycoAudio.playHarvest();
    triggerSporeBurst(slot.x, slot.y + 0.35, slot.z, slot.color);
    if (callbacks.onHarvestGreenhouse) {
      callbacks.onHarvestGreenhouse(slot);
    }
    if (ctx && ctx.scene && !ctx.heldItem) {
      const spName = slot.speciesName || slot.name || 'Golden Teacher';
      const isMagic = spName.indexOf('Psilocybe') !== -1 || spName.indexOf('Cubensis') !== -1 || spName.indexOf('Golden') !== -1 || slot.kind === 'gt';
      const freshMush = spawnPersistedWildMushroom(ctx, 'harvest_gh_' + Date.now().toString(36), {
        speciesName: spName,
        isMagic
      });
      ctx.heldItem = freshMush;
      ctx.lastPickupAt = performance.now();
      if (callbacks.onHoldChange) callbacks.onHoldChange(freshMush.label);
    }
    slot.flush = (slot.flush || 1) + 1;
    if (slot.flush > 4) {
      slot.spent = true;
      slot.stage = 4;
      slot.growth = 0;
      slot.flush = 4;
      if (callbacks.onToast) {
        callbacks.onToast(`🍂 4º e último Flush de ${slot.name} colhido! O bolo ficou seco/esgotado — clique nele para retirar e levar à Caixa de Substrato da Horta!`);
      }
    } else {
      slot.stage = 0;
      slot.growth = 0;
      slot.humidity = Math.max(76, greenhouseEnv.humidity - 6);
      if (queueWorldStateChange) {
        queueWorldStateChange('greenhouse_slot_' + slot.id + '_stage', 0);
        queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', Math.round(slot.humidity));
      }
    }
    updateGreenhouseSlotMesh(slot);
    updateGreenhousePanelDisplay();
    if (callbacks.onLabStep) callbacks.onLabStep('greenhouse_care');
    return;
  }

  if (isHoldingSpray) {
    slot.humidity = Math.min(100, slot.humidity + 25);
    if (window.MycoAudio) window.MycoAudio.playSpray();
    triggerWaterSprayFx(slot.x, slot.y + 0.30, slot.z);
    updateGreenhouseSlotMesh(slot);
    if (queueWorldStateChange) {
      queueWorldStateChange('greenhouse_slot_' + slot.id + '_humidity', Math.round(slot.humidity));
    }
    if (callbacks.onLabStep) callbacks.onLabStep('greenhouse_care');
    return;
  }

  if (window.MycoAudio) window.MycoAudio.playClick();
  if (callbacks.onToast) {
    const stageNames = ['Micélio colonizando', 'Primórdios (Pins)', 'Crescimento médio', 'Maduro para colheita'];
    const stLabel = stageNames[slot.stage] || 'Em cultivo';
    const hum = Math.round(slot.humidity);
    const slotHealth = typeof slot.health === 'number' ? Math.round(slot.health) : 100;
    const diagText = (slot.stressReasons && slot.stressReasons.length > 0)
      ? `⚠️ Estressado (${slotHealth}%) • Diagnóstico: ${slot.stressReasons.join(' + ')}`
      : `❤️ Saudável (${slotHealth}%)`;
    callbacks.onToast(`🍄 ${slot.name} (${slot.rackName} • A${slot.tier} • Flush ${slot.flush}/4) — ${stLabel} (${hum}% UR) • ${diagText}`);
  }
}

function evaluateClimateStress() {
  const types = [];
  const reasons = [];
  const advices = [];
  let severity = 0;

  if (greenhouseEnv.tempC > 27.0) {
    types.push('heat_stress');
    reasons.push('Muito calor');
    advices.push(`Muito calor (${greenhouseEnv.tempC.toFixed(1)}°C)`);
    severity += Math.min(2.5, (greenhouseEnv.tempC - 27.0) * 0.8 + 0.5);
  }
  if (greenhouseEnv.tempC < 17.5) {
    types.push('cold_stress');
    reasons.push('Muito frio');
    advices.push(`Muito frio (${greenhouseEnv.tempC.toFixed(1)}°C)`);
    severity += Math.min(2.5, (17.5 - greenhouseEnv.tempC) * 0.8 + 0.5);
  }
  if (greenhouseEnv.humidity > 95.5) {
    types.push('excess_humidity');
    reasons.push('Excesso de umidade');
    advices.push(`Excesso de umidade (${Math.round(greenhouseEnv.humidity)}% UR)`);
    severity += Math.min(2.5, (greenhouseEnv.humidity - 95.0) * 0.7 + 0.6);
  }
  if (greenhouseEnv.humidity < 74.0) {
    types.push('low_humidity');
    reasons.push('Baixa umidade (seco)');
    advices.push(`Ar seco (${Math.round(greenhouseEnv.humidity)}% UR)`);
    severity += Math.min(2.5, (74.0 - greenhouseEnv.humidity) * 0.15 + 0.5);
  }
  if (greenhouseEnv.exhaustPower === 2 && greenhouseEnv.co2Ppm < 470 && greenhouseEnv.humidity < 86) {
    types.push('excess_fae');
    reasons.push('Excesso de FAE (vento)');
    advices.push(`Excesso de FAE (${Math.round(greenhouseEnv.co2Ppm)} ppm + vento forte)`);
    severity += 1.0;
  }
  if (greenhouseEnv.co2Ppm > 1100) {
    types.push('high_co2');
    reasons.push('CO₂ alto (pouco FAE)');
    advices.push(`CO₂ alto (${Math.round(greenhouseEnv.co2Ppm)} ppm)`);
    severity += Math.min(2.5, (greenhouseEnv.co2Ppm - 1100) / 350 + 0.5);
  }
  if (greenhouseEnv.doorAlarmActive) {
    types.push('door_open');
    reasons.push('Porta aberta');
    advices.push(`Porta da Estufa aberta há ${Math.floor(greenhouseEnv.doorOpenSec)}s! Feche a porta`);
    severity += 1.1;
  }
  if (!greenhouseEnv.lightOn) {
    types.push('no_light');
    reasons.push('Sem luz LED Grow');
    advices.push('LED Grow desligado');
    severity += 0.45;
  }

  return {
    type: types[0] || 'none',
    types,
    reasons,
    reason: reasons.join(' + '),
    advice: advices.join(' • '),
    severity: Math.min(5.0, severity)
  };
}

export function stepGreenhouse(ctx, dt) {
  let activeCount = 0;
  for (let i = 0; i < greenhouseSlots.length; i++) {
    if (!greenhouseSlots[i].empty && greenhouseSlots[i].stage >= 0) activeCount++;
  }

  // 0. Leitura do clima externo e sensor da Porta da Estufa
  if (ctx) {
    if (typeof ctx.outsideTempC === 'number') greenhouseEnv.outsideTempC = ctx.outsideTempC;
    if (typeof ctx.outsideHumidity === 'number') greenhouseEnv.outsideHumidity = ctx.outsideHumidity;
    if (ctx.weatherMode) greenhouseEnv.weatherMode = ctx.weatherMode;
  }

  let isDoorOpen = greenhouseEnv.doorOpen;
  if (ctx && Array.isArray(ctx.campusDoors)) {
    for (let dIdx = 0; dIdx < ctx.campusDoors.length; dIdx++) {
      const dr = ctx.campusDoors[dIdx];
      if (dr && dr.label === 'Porta da Estufa') {
        isDoorOpen = !!dr.open;
        break;
      }
    }
  }

  const wasDoorAlarm = greenhouseEnv.doorAlarmActive;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;
  greenhouseEnv.doorOpen = isDoorOpen;
  if (isDoorOpen) {
    greenhouseEnv.doorOpenSec += dt;
    if (greenhouseEnv.doorOpenSec >= DOOR_OPEN_ALARM_DELAY) {
      if (!greenhouseEnv.doorAlarmActive) {
        greenhouseEnv.doorAlarmActive = true;
        doorAlarmBeepAccum = DOOR_ALARM_BEEP_INTERVAL;
        if (onToast) {
          onToast('🚨 ALARME ESTUFA: Porta aberta há muito tempo! Umidade caindo — feche a porta.');
        }
      }
      doorAlarmBeepAccum += dt;
      if (doorAlarmBeepAccum >= DOOR_ALARM_BEEP_INTERVAL) {
        doorAlarmBeepAccum = 0;
        const pPos = ctx && ctx.playerPos;
        const nearEstufa = !pPos || Math.hypot(pPos.x - 19, pPos.z - 8) < 28;
        if (nearEstufa && typeof window !== 'undefined' && window.MycoAudio && typeof window.MycoAudio.playGreenhouseDoorBeep === 'function') {
          window.MycoAudio.playGreenhouseDoorBeep();
        }
      }
    }
  } else {
    if (wasDoorAlarm && onToast) {
      onToast('✅ Porta da Estufa fechada! Alarme silenciado e microclima normalizando.');
    }
    greenhouseEnv.doorOpenSec = 0;
    greenhouseEnv.doorAlarmActive = false;
    doorAlarmBeepAccum = 0;
  }

  // 1. Controle Automático vs Manual do Microclima
  if (greenhouseEnv.autoMode) {
    const humDiff = greenhouseEnv.targetHumidity - greenhouseEnv.humidity;
    if (humDiff > 6) greenhouseEnv.humidifierPower = 3;
    else if (humDiff > 2) greenhouseEnv.humidifierPower = 2;
    else if (humDiff > -1.5) greenhouseEnv.humidifierPower = 1;
    else greenhouseEnv.humidifierPower = 0;

    const co2Diff = greenhouseEnv.co2Ppm - greenhouseEnv.targetCo2;
    if (co2Diff > 180) greenhouseEnv.exhaustPower = 2;
    else if (co2Diff > -40) greenhouseEnv.exhaustPower = 1;
    else greenhouseEnv.exhaustPower = 0;

    greenhouseEnv.coolerActive = Math.abs(greenhouseEnv.tempC - greenhouseEnv.targetTempC) > 0.20 || activeCount > 0;
  }

  // 2. Dinâmica física de Umidade, CO2 e Temperatura da Câmara (influenciada pela porta + clima externo)
  const mistGain = greenhouseEnv.humidifierPower * 0.95;
  const exhaustDryLoss = greenhouseEnv.exhaustPower * 0.42;
  const ambientLoss = 0.22;
  const doorHumMix = isDoorOpen ? ((greenhouseEnv.outsideHumidity - greenhouseEnv.humidity) * 0.14 - 0.85) : 0;
  greenhouseEnv.humidity = Math.max(25, Math.min(99, greenhouseEnv.humidity + (mistGain - exhaustDryLoss - ambientLoss + doorHumMix) * dt));

  const co2Produced = activeCount * 2.2 + 4.0;
  const co2Removed = greenhouseEnv.exhaustPower * 40.0;
  const doorCo2Mix = isDoorOpen ? (430 - greenhouseEnv.co2Ppm) * 0.18 : 0;
  greenhouseEnv.co2Ppm = Math.max(410, Math.min(2500, greenhouseEnv.co2Ppm + (co2Produced - co2Removed + doorCo2Mix) * dt));

  const closedAmbientTemp = 23.0 + (greenhouseEnv.outsideTempC - 21.0) * 0.45 + 1.5;
  if (isDoorOpen) {
    const doorTempExchange = (greenhouseEnv.outsideTempC - greenhouseEnv.tempC) * 0.22;
    let coolerEffect = 0;
    if (greenhouseEnv.coolerActive) {
      const diffT = greenhouseEnv.targetTempC - greenhouseEnv.tempC;
      coolerEffect = Math.sign(diffT) * Math.min(Math.abs(diffT), 0.18);
    }
    greenhouseEnv.tempC += (doorTempExchange + coolerEffect) * dt;
  } else {
    const tempRate = greenhouseEnv.coolerActive ? 0.55 : 0.16;
    const tempGoal = greenhouseEnv.coolerActive ? greenhouseEnv.targetTempC : closedAmbientTemp;
    if (greenhouseEnv.tempC < tempGoal) {
      greenhouseEnv.tempC = Math.min(tempGoal, greenhouseEnv.tempC + tempRate * dt);
    } else if (greenhouseEnv.tempC > tempGoal) {
      greenhouseEnv.tempC = Math.max(tempGoal, greenhouseEnv.tempC - tempRate * dt);
    }
  }

  // 3. Avaliação de estresse biológico e Score do microclima
  const stress = evaluateClimateStress();
  greenhouseEnv.primaryStress = stress.type;
  greenhouseEnv.stressAdvice = stress.advice;

  const humErr = greenhouseEnv.humidity > 95
    ? (greenhouseEnv.humidity - 95) * 6.5
    : Math.max(0, 82 - greenhouseEnv.humidity) * 2.2;
  const co2Err = Math.max(0, (greenhouseEnv.co2Ppm - 950) / 28);
  const faeErr = stress.type === 'excess_fae' ? 22 : 0;
  const tempErr = Math.max(0, Math.abs(greenhouseEnv.tempC - 22.5) - 3.5) * 6;
  const lightPenalty = greenhouseEnv.lightOn ? 0 : 12;
  greenhouseEnv.climateScore = Math.max(10, Math.min(100, 100 - humErr - co2Err - faeErr - tempErr - lightPenalty));

  // 4. Animação das ventoinhas (Climatizador 3 fans + Exaustor)
  if (greenhouseEnv.coolerActive && coolerFans.length > 0) {
    for (let f = 0; f < coolerFans.length; f++) {
      coolerFans[f].rotation.x += dt * 11.5;
    }
  }
  if (exhaustFan && greenhouseEnv.exhaustPower > 0) {
    exhaustFan.rotation.z += dt * (greenhouseEnv.exhaustPower === 2 ? 15.0 : 8.5);
  }

  // 5. Saúde e Crescimento de todos os 24 bolos baseado no microclima real
  let healthSum = 0;
  let healthCount = 0;
  const climateMultiplier = (0.25 + (greenhouseEnv.climateScore / 100) * 1.15) * (greenhouseEnv.lightOn ? 1.0 : 0.70);
  for (let gi = 0; gi < greenhouseSlots.length; gi++) {
    const gSlot = greenhouseSlots[gi];
    if (gSlot.empty || gSlot.stage < 0) continue;

    // A umidade de cada bolo converge suavemente para a umidade ambiente da estufa
    gSlot.humidity += (greenhouseEnv.humidity - gSlot.humidity) * Math.min(1, dt * 0.16);
    gSlot.humidity = Math.max(20, Math.min(99, gSlot.humidity));

    const prevHealth = typeof gSlot.health === 'number' ? gSlot.health : 100;
    const prevStress = gSlot.stressType || 'none';
    const prevReason = gSlot.stressReason || '';
    const slotReasons = stress.reasons ? stress.reasons.slice() : [];

    if (gSlot.humidity > 96 && slotReasons.indexOf('Excesso de umidade') === -1) {
      slotReasons.push('Bolo encharcado');
    } else if (gSlot.humidity < 72 && slotReasons.indexOf('Baixa umidade (seco)') === -1) {
      slotReasons.push('Bolo seco');
    }

    if (slotReasons.length > 0) {
      const localPenalty = (stress.type === 'none') ? 2.2 : stress.severity * 2.8;
      gSlot.health = Math.max(10, prevHealth - localPenalty * dt);
      gSlot.stressType = stress.type !== 'none' ? stress.type : (gSlot.humidity > 96 ? 'excess_humidity' : 'low_humidity');
      gSlot.stressReasons = slotReasons;
      gSlot.stressReason = slotReasons.join(' + ');
    } else {
      gSlot.health = Math.min(100, prevHealth + 4.0 * dt);
      gSlot.stressType = 'none';
      gSlot.stressReasons = [];
      gSlot.stressReason = '';
    }

    healthSum += gSlot.health;
    healthCount++;

    const crossedLedThreshold =
      (prevStress !== gSlot.stressType) ||
      (prevReason !== gSlot.stressReason) ||
      (prevHealth >= 60 && gSlot.health < 60) ||
      (prevHealth < 60 && gSlot.health >= 60) ||
      (prevHealth >= 80 && gSlot.health < 80) ||
      (prevHealth < 80 && gSlot.health >= 80);

    if (gSlot.humidity >= 60 && gSlot.health >= 30 && greenhouseEnv.tempC >= 15.5 && greenhouseEnv.tempC <= 30.5 && gSlot.stage < 3) {
      const healthFactor = 0.45 + (gSlot.health / 100) * 0.55;
      gSlot.growth += dt * (gSlot.humidity / 100) * 1.75 * climateMultiplier * healthFactor;
      if (gSlot.growth >= 100) {
        gSlot.stage++;
        gSlot.growth = 0;
        updateGreenhouseSlotMesh(gSlot);
        if (ctx && ctx.queueWorldStateChange) {
          ctx.queueWorldStateChange('greenhouse_slot_' + gSlot.id + '_stage', gSlot.stage);
        }
      } else if (crossedLedThreshold) {
        updateGreenhouseSlotMesh(gSlot);
      }
    } else if (crossedLedThreshold) {
      updateGreenhouseSlotMesh(gSlot);
    }
  }

  greenhouseEnv.avgHealth = healthCount > 0 ? (healthSum / healthCount) : 100;
  greenhouseEnv.statusLevel = (greenhouseEnv.climateScore < 60 || greenhouseEnv.avgHealth < 65 || stress.severity >= 1.0)
    ? 'alert'
    : ((greenhouseEnv.climateScore < 85 || stress.type !== 'none') ? 'adjusting' : 'optimal');
  greenhouseEnv.statusLabel = greenhouseEnv.statusLevel === 'optimal'
    ? (greenhouseEnv.autoMode ? 'Ideal (Auto)' : 'Ideal (Manual)')
    : (greenhouseEnv.statusLevel === 'adjusting' ? 'Atenção' : 'Estresse!');

  panelRefreshAccum += dt;
  if (panelRefreshAccum >= 1.0) {
    panelRefreshAccum = 0;
    updateGreenhousePanelDisplay();
  }

  envSyncAccum += dt;
  if (envSyncAccum >= 6.0 && ctx && ctx.queueWorldStateChange) {
    envSyncAccum = 0;
    ctx.queueWorldStateChange('greenhouse_hum', Math.round(greenhouseEnv.humidity));
    ctx.queueWorldStateChange('greenhouse_co2', Math.round(greenhouseEnv.co2Ppm));
    ctx.queueWorldStateChange('greenhouse_temp', Math.round(greenhouseEnv.tempC * 10));
  }

  stepGreenhouseParticles(dt);
}
