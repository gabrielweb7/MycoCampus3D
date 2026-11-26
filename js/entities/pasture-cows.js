/**
 * Vaquinhas Inteligentes, Cocôs com Mosquinhas e Cubensis Dourados (MycoCampus3D)
 * - Nasce apenas em área livre (checando solidColliders e wallSegments).
 * - Desvia de prédios, árvores, cercas e outras vaquinhas.
 * - IA viva: pasta, fica curiosa olhando para jogadores próximos, às vezes corre assustada,
 *   possui Saúde/Humor exibidos no crachá 3D e aceita carinho.
 * - Sincronização determinística via server_ts para todos verem igual sem pesar no MySQL/FPS.
 * - A cada 30s solta cocô com mosquinhas; após 30s nascem 1 grande, 2 médios ou 3 cubensis dourados.
 */

import { terrainHeight } from '../engine/physics.js';
import { disposeObjectResources, getCachedCanvasTexture, registerPickable } from '../items/item-registry.js';
import { spawnCampusFxBurst } from '../engine/fx-burst.js';
import { isNaturalSoilSpot } from '../world/nature-plaza.js';
import { VILLAGE_LOTS, VILLAGE_HOUSE } from '../core/village-layout.js';
import { triggerCozyHeartBurst } from '../world/cozy-details.js';
import { firstUnoccludedRayHit, isRayOccludedByStructure } from '../systems/ray-occlusion.js';
import { updateCultureLiquidLabel } from '../items/liquid-culture.js';
import { updateLcNutrientLabel } from '../items/pda-bottle.js';

const THREE = window.THREE;

export const COW_POOP_INTERVAL_SEC = 30;
export const POOP_CUBENSIS_GROW_SEC = 30;
export const POOP_TOTAL_LIFETIME_SEC = 120; // 30s crescendo + 90s disponível antes de desaparecer
export const MAX_ACTIVE_POOPS = 18;

const PASTURE_BOUNDS = { minX: -84, maxX: 84, minZ: -78, maxZ: 78 };
export const PASTURE_TROUGH_POS = Object.freeze({ x: 74, z: 2 });
export const HERD_MIGRATION_LEG_SEC = 40;
export const HERD_MIGRATION_ROUTE = Object.freeze([
  { x: 75, z: 22, name: 'Pasto Sudeste' },
  { x: 71, z: 2, name: 'Cocho de Feno' },
  { x: 72, z: -28, name: 'Pasto Nordeste' },
  { x: 46, z: -56, name: 'Prado Norte-Leste' },
  { x: 0, z: -58, name: 'Prado da Reitoria' },
  { x: -46, z: -58, name: 'Prado Noroeste' },
  { x: -74, z: -54, name: 'Bosque Noroeste' },
  { x: -75, z: -18, name: 'Pasto Oeste' },
  { x: -75, z: 18, name: 'Clareira Oeste' }
]);
const COW_NAMES = ['Mimosa', 'Estrela', 'Pipoca', 'Bela', 'Malhada', 'Flor'];
const COW_STEER_OFFSETS = [0.45, 0.9, 1.4, 2.05, -0.45, -0.9, -1.4, -2.05, Math.PI];
const COW_UNSTICK_RINGS = [1.5, 3.0, 5.0, 8.0];

function isInsideTownOrRoad(x, z) {
  // Mantém vaquinhas, cocôs e Cubensis longe da cidade, prédios, quadras, estradas e concreto
  if (Math.abs(x) < 38 && Math.abs(z) < 32) return true;
  if (!isNaturalSoilSpot(x, z, 1.2)) return true;
  return false;
}

function hash01(a, b) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function isCowBlockedAt(ctx, x, z, radius = 0.9) {
  const r = radius || 0.9;
  const cols = ctx && ctx.solidColliders;
  if (cols) {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (!c) continue;
      if (typeof c.minY === 'number' && c.minY > 1.8) continue;
      if (c.radiusXZ > 0) {
        const dx = x - c.centerX;
        const dz = z - c.centerZ;
        const limit = c.radiusXZ + r;
        if (dx * dx + dz * dz < limit * limit) return true;
      } else if (x >= c.minX - r && x <= c.maxX + r && z >= c.minZ - r && z <= c.maxZ + r) {
        return true;
      }
    }
  }
  const walls = ctx && ctx.wallSegments;
  if (walls) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!w) continue;
      if (typeof w.minY === 'number' && w.minY > 1.8) continue;
      const vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((x - w.x1) * vx + (z - w.z1) * vz) / lenSq));
      const px = w.x1 + t * vx, pz = w.z1 + t * vz;
      const distSq = (x - px) * (x - px) + (z - pz) * (z - pz);
      const minR = r + (w.halfThick || (w.thickness || 0.25) * 0.5);
      if (distSq < minR * minR) return true;
    }
  }
  return false;
}

const isBlockedAt = isCowBlockedAt;

export function isCowPositionWalkable(ctx, x, z, radius = 0.95) {
  if (x < PASTURE_BOUNDS.minX || x > PASTURE_BOUNDS.maxX ||
      z < PASTURE_BOUNDS.minZ || z > 34.0) {
    return false;
  }
  if (isInsideTownOrRoad(x, z)) return false;
  if (isCowBlockedAt(ctx, x, z, radius)) return false;
  return true;
}

export function getHerdRouteIndex(syncClock) {
  const n = HERD_MIGRATION_ROUTE.length;
  if (n <= 1) return 0;
  const span = (n - 1) * 2;
  const step = Math.floor(Math.max(0, syncClock) / HERD_MIGRATION_LEG_SEC) % span;
  return step < n ? step : span - step;
}

export function findSafePasturePoint(ctx, seedIdx, anchor = PASTURE_TROUGH_POS) {
  const base = anchor || PASTURE_TROUGH_POS;
  const cows = ctx && ctx.pastureCows;
  for (let attempt = 0; attempt < 36; attempt++) {
    const ring = 2.8 + (attempt % 4) * 2.8;
    const ang = hash01(seedIdx + 1, attempt + 1) * Math.PI * 2;
    const x = base.x + Math.cos(ang) * ring;
    const z = base.z + Math.sin(ang) * ring;
    if (!isCowPositionWalkable(ctx, x, z, 1.1)) continue;
    let tooClose = false;
    if (attempt < 24 && cows && cows.length) {
      for (let j = 0; j < cows.length; j++) {
        const other = cows[j];
        if (!other || !other.mesh || !other.mesh.position) continue;
        const dx = x - other.mesh.position.x;
        const dz = z - other.mesh.position.z;
        if (dx * dx + dz * dz < 2.2 * 2.2) { tooClose = true; break; }
      }
    }
    if (!tooClose) return { x, z };
  }
  for (let r = 0; r < HERD_MIGRATION_ROUTE.length; r++) {
    const wp = HERD_MIGRATION_ROUTE[(seedIdx + r) % HERD_MIGRATION_ROUTE.length];
    if (isCowPositionWalkable(ctx, wp.x, wp.z, 1.1)) return { x: wp.x, z: wp.z };
  }
  return { x: PASTURE_TROUGH_POS.x, z: PASTURE_TROUGH_POS.z };
}

let cowSharedAssets = null;
let poopSharedAssets = null;

function markAllShared(obj) {
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (Array.isArray(v)) {
      v.forEach((it) => { if (it && it.userData) it.userData.shared = true; });
    } else if (v && v.userData) {
      v.userData.shared = true;
    }
  });
  return obj;
}

function getCowSharedAssets() {
  if (cowSharedAssets) return cowSharedAssets;
  cowSharedAssets = markAllShared({
    whiteMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 }),
    spotMats: [
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.78 })
    ],
    snoutMat: new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 }),
    hornMat: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 }),
    hoofMat: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 }),
    eyeMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    bodyGeo: new THREE.BoxGeometry(0.76, 0.56, 1.02),
    spot1Geo: new THREE.BoxGeometry(0.78, 0.28, 0.36),
    spot2Geo: new THREE.BoxGeometry(0.42, 0.24, 0.34),
    skullGeo: new THREE.BoxGeometry(0.54, 0.48, 0.48),
    eyePatchGeo: new THREE.BoxGeometry(0.20, 0.18, 0.04),
    snoutGeo: new THREE.BoxGeometry(0.44, 0.24, 0.20),
    eyeGeo: new THREE.SphereGeometry(0.055, 8, 8),
    hornGeo: new THREE.ConeGeometry(0.045, 0.15, 7),
    earGeo: new THREE.BoxGeometry(0.15, 0.08, 0.06),
    legGeo: new THREE.CylinderGeometry(0.08, 0.075, 0.24, 8),
    hoofGeo: new THREE.CylinderGeometry(0.085, 0.09, 0.08, 8),
    tailGeo: new THREE.CylinderGeometry(0.025, 0.02, 0.34, 6)
  });
  return cowSharedAssets;
}

function getPoopSharedAssets() {
  if (poopSharedAssets) return poopSharedAssets;
  const capProfile = [
    new THREE.Vector2(0.084, -0.004),
    new THREE.Vector2(0.090, 0.000),
    new THREE.Vector2(0.078, 0.016),
    new THREE.Vector2(0.050, 0.038),
    new THREE.Vector2(0.022, 0.052),
    new THREE.Vector2(0.000, 0.056)
  ];
  poopSharedAssets = markAllShared({
    poopMat: new THREE.MeshStandardMaterial({ color: 0x6b3e1b, roughness: 0.92 }),
    flyBodyMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    wingMat: new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.75 }),
    mycMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }),
    stemMat: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 }),
    veilMat: new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.85, side: THREE.DoubleSide }),
    capMat: new THREE.MeshStandardMaterial({ color: 0xa1551c, roughness: 0.42, side: THREE.DoubleSide }),
    gillsMat: new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.88, side: THREE.DoubleSide }),
    poopBaseGeo: new THREE.CylinderGeometry(0.24, 0.28, 0.08, 10),
    poopMidGeo: new THREE.CylinderGeometry(0.16, 0.21, 0.07, 10),
    poopTopGeo: new THREE.ConeGeometry(0.11, 0.09, 8),
    flyBodyGeo: new THREE.SphereGeometry(0.018, 6, 6),
    wingGeo: new THREE.BoxGeometry(0.032, 0.004, 0.016),
    mycUnitGeo: new THREE.CylinderGeometry(1.0, 1.15, 0.014, 8),
    capGeo: new THREE.LatheGeometry(capProfile, 16),
    stemGeo: new THREE.CylinderGeometry(0.016, 0.024, 0.21, 10),
    veilGeo: new THREE.CylinderGeometry(0.017, 0.030, 0.022, 10, 1, true),
    gillsGeo: new THREE.CircleGeometry(0.083, 16)
  });
  return poopSharedAssets;
}

function createCuteCowMesh(variant) {
  const g = new THREE.Group();
  const a = getCowSharedAssets();
  const spotMat = a.spotMats[variant % a.spotMats.length];

  const body = new THREE.Mesh(a.bodyGeo, a.whiteMat);
  body.position.set(0, 0.56, 0);
  g.add(body);

  const spot1 = new THREE.Mesh(a.spot1Geo, spotMat);
  spot1.position.set(0, 0.64, -0.14);
  const spot2 = new THREE.Mesh(a.spot2Geo, spotMat);
  spot2.position.set(0.18, 0.54, 0.28);
  g.add(spot1, spot2);

  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.62);
  const skull = new THREE.Mesh(a.skullGeo, a.whiteMat);
  const eyePatch = new THREE.Mesh(a.eyePatchGeo, spotMat);
  eyePatch.position.set(-0.14, 0.06, 0.23);
  const snout = new THREE.Mesh(a.snoutGeo, a.snoutMat);
  snout.position.set(0, -0.10, 0.26);

  [-0.14, 0.14].forEach((ex) => {
    const eye = new THREE.Mesh(a.eyeGeo, a.eyeMat);
    eye.position.set(ex, 0.06, 0.25);
    const horn = new THREE.Mesh(a.hornGeo, a.hornMat);
    horn.position.set(ex * 1.2, 0.29, 0);
    horn.rotation.z = ex < 0 ? 0.3 : -0.3;
    const ear = new THREE.Mesh(a.earGeo, a.whiteMat);
    ear.position.set(ex * 1.9, 0.18, -0.04);
    head.add(eye, horn, ear);
  });
  head.add(skull, eyePatch, snout);
  g.add(head);

  const legs = [];
  [[-0.24, 0.34], [0.24, 0.34], [-0.24, -0.34], [0.24, -0.34]].forEach((lp) => {
    const leg = new THREE.Group();
    leg.position.set(lp[0], 0.32, lp[1]);
    const upper = new THREE.Mesh(a.legGeo, a.whiteMat);
    upper.position.y = -0.12;
    const hoof = new THREE.Mesh(a.hoofGeo, a.hoofMat);
    hoof.position.y = -0.26;
    leg.add(upper, hoof);
    g.add(leg);
    legs.push(leg);
  });

  const tail = new THREE.Mesh(a.tailGeo, spotMat);
  tail.position.set(0, 0.58, -0.56);
  tail.rotation.x = 0.35;
  g.add(tail);

  return { group: g, body, head, legs, tail };
}

function createPoopWithFliesAndCubensis(x, y, z, poopId, variantSeed) {
  const a = getPoopSharedAssets();
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const base = new THREE.Mesh(a.poopBaseGeo, a.poopMat);
  base.position.y = 0.04;
  const mid = new THREE.Mesh(a.poopMidGeo, a.poopMat);
  mid.position.y = 0.10;
  const top = new THREE.Mesh(a.poopTopGeo, a.poopMat);
  top.position.y = 0.17;
  g.add(base, mid, top);

  const flies = [];
  for (let fi = 0; fi < 3; fi++) {
    const fg = new THREE.Group();
    const fBody = new THREE.Mesh(a.flyBodyGeo, a.flyBodyMat);
    const wingL = new THREE.Mesh(a.wingGeo, a.wingMat);
    wingL.position.set(-0.018, 0.01, 0);
    const wingR = new THREE.Mesh(a.wingGeo, a.wingMat);
    wingR.position.set(0.018, 0.01, 0);
    fg.add(fBody, wingL, wingR);
    fg.position.set(0, 0.28 + fi * 0.05, 0);
    g.add(fg);
    flies.push({ group: fg, phase: fi * 2.1, radius: 0.14 + fi * 0.04 });
  }

  // Micélio branco colonizando o topo do cocô (estágio 0s-10s)
  const myceliumGroup = new THREE.Group();
  const mycCoords = [
    [0, 0.20, 0, 0.14], [-0.07, 0.18, 0.05, 0.09], [0.08, 0.18, -0.04, 0.08], [0.02, 0.19, 0.08, 0.07]
  ];
  for (let mi = 0; mi < mycCoords.length; mi++) {
    const m = mycCoords[mi];
    const patch = new THREE.Mesh(a.mycUnitGeo, a.mycMat);
    patch.scale.set(m[3], 1, m[3]);
    patch.position.set(m[0], m[1], m[2]);
    myceliumGroup.add(patch);
  }
  myceliumGroup.visible = false;
  g.add(myceliumGroup);

  // Cubensis reais com LatheGeometry compartilhada (zero alocação GPU ao defecar!)
  const cubensisGroup = new THREE.Group();
  cubensisGroup.visible = false;

  const caps = [];
  const mushParts = [];
  const patternType = Math.floor(hash01(variantSeed, 99) * 3);
  const offsets = patternType === 0
    ? [[0, 0, 1.45]]
    : (patternType === 1
      ? [[-0.06, 0.03, 1.05], [0.07, -0.04, 0.92]]
      : [[0, 0, 1.0], [-0.08, 0.06, 0.78], [0.09, -0.05, 0.85]]);

  offsets.forEach((off) => {
    const mg = new THREE.Group();
    mg.position.set(off[0], 0.14, off[1]);
    mg.scale.setScalar(off[2]);

    const stemPivot = new THREE.Group();
    const st = new THREE.Mesh(a.stemGeo, a.stemMat);
    st.position.y = 0.105;
    const veilRing = new THREE.Mesh(a.veilGeo, a.veilMat);
    veilRing.position.y = 0.135;
    veilRing.rotation.z = 0.15;
    stemPivot.add(st, veilRing);
    mg.add(stemPivot);

    const capGroup = new THREE.Group();
    capGroup.position.y = 0.205;
    const dome = new THREE.Mesh(a.capGeo, a.capMat);
    const gills = new THREE.Mesh(a.gillsGeo, a.gillsMat);
    gills.rotation.x = Math.PI / 2;
    gills.position.y = -0.002;
    dome.userData.wildMushId = poopId;
    dome.userData.speciesName = patternType === 0
      ? 'Cubensis Dourado Gigante (Psilocybe cubensis)'
      : 'Cubensis Dourado do Pasto (Psilocybe cubensis)';
    capGroup.add(dome, gills);
    mg.add(capGroup);

    cubensisGroup.add(mg);
    caps.push(dome);
    mushParts.push({ mg, stemPivot, veilRing, capGroup, targetScale: off[2] });
  });
  g.add(cubensisGroup);

  return { group: g, flies, myceliumGroup, cubensisGroup, caps, mushParts };
}

const _unstickTarget = { x: 0, z: 0 };
const _steerResult = { yaw: 0, side: 1, scale: 1 };

function wrapAngle(a) {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function hasCowCollisionAt(ctx, cowIdx, cx, cz, tx, tz, minRadius = 1.15) {
  const cows = ctx.pastureCows;
  if (!cows) return false;
  const minRSq = minRadius * minRadius;
  for (let j = 0; j < cows.length; j++) {
    if (j === cowIdx) continue;
    const other = cows[j];
    if (!other || other.abducted || !other.mesh || !other.mesh.position) continue;
    const ox = other.mesh.position.x;
    const oz = other.mesh.position.z;
    const newDistSq = (tx - ox) * (tx - ox) + (tz - oz) * (tz - oz);
    if (newDistSq >= minRSq) continue;
    const curDistSq = (cx - ox) * (cx - ox) + (cz - oz) * (cz - oz);
    if (newDistSq < curDistSq - 1e-4) return true;
  }
  return false;
}

function isHeadingClearForCow(ctx, cowIdx, cx, cz, yaw, probeDist) {
  const sx = Math.sin(yaw);
  const sz = Math.cos(yaw);
  const midDist = probeDist * 0.5;
  if (!isCowPositionWalkable(ctx, cx + sx * midDist, cz + sz * midDist, 0.95)) return false;
  if (!isCowPositionWalkable(ctx, cx + sx * probeDist, cz + sz * probeDist, 0.95)) return false;
  const stepProbe = Math.min(0.45, probeDist);
  if (hasCowCollisionAt(ctx, cowIdx, cx, cz, cx + sx * stepProbe, cz + sz * stepProbe, 1.15)) {
    return false;
  }
  return true;
}

function findNearestWalkableSpot(ctx, cx, cz) {
  for (let ri = 0; ri < COW_UNSTICK_RINGS.length; ri++) {
    const r = COW_UNSTICK_RINGS[ri];
    for (let ai = 0; ai < 12; ai++) {
      const ang = (ai / 12) * Math.PI * 2;
      const tx = cx + Math.sin(ang) * r;
      const tz = cz + Math.cos(ang) * r;
      if (isCowPositionWalkable(ctx, tx, tz, 0.9)) {
        _unstickTarget.x = tx;
        _unstickTarget.z = tz;
        return true;
      }
    }
  }
  return false;
}

function chooseCowSteerHeading(ctx, cowIdx, cx, cz, baseYaw, avoidSide) {
  const pref = avoidSide >= 0 ? 1 : -1;
  for (let k = 0; k < COW_STEER_OFFSETS.length; k++) {
    const baseOff = COW_STEER_OFFSETS[k];
    const off = baseOff * pref;
    const tryYaw = baseYaw + off;
    if (isHeadingClearForCow(ctx, cowIdx, cx, cz, tryYaw, 1.4)) {
      _steerResult.yaw = tryYaw;
      _steerResult.side = baseOff === Math.PI ? -pref : (off >= 0 ? 1 : -1);
      _steerResult.scale = 1.0;
      return true;
    }
  }
  for (let k = 0; k < COW_STEER_OFFSETS.length; k++) {
    const baseOff = COW_STEER_OFFSETS[k];
    const off = baseOff * pref;
    const tryYaw = baseYaw + off;
    if (isHeadingClearForCow(ctx, cowIdx, cx, cz, tryYaw, 0.55)) {
      _steerResult.yaw = tryYaw;
      _steerResult.side = baseOff === Math.PI ? -pref : (off >= 0 ? 1 : -1);
      _steerResult.scale = 0.6;
      return true;
    }
  }
  return false;
}

function findClosestRouteIndex(ctx, x, z) {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let r = 0; r < HERD_MIGRATION_ROUTE.length; r++) {
    const wp = HERD_MIGRATION_ROUTE[r];
    if (!isCowPositionWalkable(ctx, wp.x, wp.z, 0.95)) continue;
    const dx = wp.x - x;
    const dz = wp.z - z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = r;
    }
  }
  return bestIdx;
}

export function createPastureAndCows(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  ctx.pastureCows = ctx.pastureCows || [];
  ctx.pastureCows.length = 0;
  ctx.cowPoops = ctx.cowPoops || [];
  ctx.cowPoops.length = 0;
  ctx.cowHitMeshes = ctx.cowHitMeshes || [];

  // Cocho de Feno e Bebedouro no pasto (sem cercas, permitindo migração livre pelo campus)
  const fenceGroup = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, transparent: true, opacity: 0.85 });

  const tx = PASTURE_TROUGH_POS.x;
  const tz = PASTURE_TROUGH_POS.z;
  const ty = terrainHeight(tx, tz);
  const trough = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.9), woodMat);
  trough.position.set(tx, ty + 0.21, tz);
  const hayPile = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.26, 0.72), hayMat);
  hayPile.position.set(tx - 0.55, ty + 0.36, tz);
  const troughWater = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.72), waterMat);
  troughWater.position.set(tx + 0.55, ty + 0.32, tz);
  fenceGroup.add(trough, hayPile, troughWater);
  ctx.scene.add(fenceGroup);
  if (ctx.solidColliders) {
    ctx.solidColliders.push({
      minX: tx - 1.3,
      maxX: tx + 1.3,
      minZ: tz - 0.55,
      maxZ: tz + 0.55,
      minY: ty,
      maxY: ty + 0.7
    });
  }

  const initSyncClock = (ctx.serverTimeSec && ctx.serverTimeSec > 0)
    ? ctx.serverTimeSec + ((performance.now() - (ctx.serverTimeSyncAt || 0)) / 1000)
    : (Date.now() / 1000);
  const initRouteIdx = getHerdRouteIndex(initSyncClock);
  const initAnchor = HERD_MIGRATION_ROUTE[initRouteIdx] || PASTURE_TROUGH_POS;

  for (let i = 0; i < 6; i++) {
    const pos = findSafePasturePoint(ctx, i, initAnchor);
    const cy = terrainHeight(pos.x, pos.z);
    const cowVis = createCuteCowMesh(i);
    cowVis.group.position.set(pos.x, cy, pos.z);
    const initYaw = hash01(i, 7) * Math.PI * 2;
    cowVis.group.rotation.y = initYaw;
    ctx.scene.add(cowVis.group);

    const cowObj = {
      id: 'cow_' + i,
      name: COW_NAMES[i % COW_NAMES.length],
      mesh: cowVis.group,
      group: cowVis.group,
      head: cowVis.head,
      legs: cowVis.legs,
      tail: cowVis.tail,
      yaw: initYaw,
      targetYaw: initYaw,
      baseSpeed: 1.08 + (i % 3) * 0.16,
      speed: 1.08,
      health: 100,
      mood: 'Pastando 🌿',
      state: 'wander', // 'wander' | 'graze' | 'curious' | 'flee'
      routeIdx: initRouteIdx,
      avoidSide: i % 2 === 0 ? 1 : -1,
      avoidTimer: 0,
      avoidYaw: initYaw,
      curiousTimer: 0,
      curiousCooldown: 0,
      stuckTimer: 0,
      lastProgressX: pos.x,
      lastProgressZ: pos.z,
      grazeTimer: 0,
      fleeTimer: 0,
      happyTimer: 0,
      lastBucket: -1,
      lastPoopBucket: -1,
      walkPhase: i * 1.3
    };
    cowVis.body.userData.cowObj = cowObj;
    ctx.cowHitMeshes.push(cowVis.body);
    ctx.pastureCows.push(cowObj);
  }
  createPastureBees(ctx);
}

export function petCow(cowObj) {
  if (!cowObj) return '';
  cowObj.health = Math.min(100, (cowObj.health || 100) + 5);
  cowObj.mood = 'Feliz 💚 (Muuu!)';
  cowObj.state = 'curious';
  cowObj.happyTimer = 3.0;
  cowObj.fleeTimer = 0;
  cowObj.curiousTimer = 3.0;
  if (cowObj.mesh && cowObj.mesh.position) {
    triggerCozyHeartBurst(cowObj.mesh.position.x, cowObj.mesh.position.y + 1.35, cowObj.mesh.position.z, 0xf472b6);
  }
  return `🐄 ${cowObj.name}: Muuu! 💚 (Saúde ${cowObj.health}%)`;
}

export function stepPastureCows(ctx, dt) {
  stepPastureBees(ctx, dt);
  if (!ctx || !ctx.pastureCows) return;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;

  // Relógio sincronizado com o servidor para todas as telas verem igual
  const syncClock = (ctx.serverTimeSec && ctx.serverTimeSec > 0)
    ? ctx.serverTimeSec + ((performance.now() - (ctx.serverTimeSyncAt || 0)) / 1000)
    : (typeof ctx.simClockSec === 'number' ? ctx.simClockSec : (Date.now() / 1000));
  const steerBucket = Math.floor(syncClock / 4);
  const herdRouteIdx = getHerdRouteIndex(syncClock);

  for (let i = 0; i < ctx.pastureCows.length; i++) {
    const cow = ctx.pastureCows[i];
    if (!cow || cow.abducted || !cow.mesh || !cow.mesh.position) continue;
    const cx = cow.mesh.position.x;
    const cz = cow.mesh.position.z;
    const distToPlayer = Math.hypot(px - cx, pz - cz);
    cow.mesh.visible = distToPlayer <= 78;

    if (typeof cow.yaw !== 'number') cow.yaw = 0;
    if (typeof cow.targetYaw !== 'number') cow.targetYaw = cow.yaw;
    if (!cow.baseSpeed) cow.baseSpeed = 1.08 + (i % 3) * 0.16;
    if (!cow.avoidSide) cow.avoidSide = i % 2 === 0 ? 1 : -1;
    if (typeof cow.routeIdx !== 'number' || cow.routeIdx < 0 || cow.routeIdx >= HERD_MIGRATION_ROUTE.length) {
      cow.routeIdx = findClosestRouteIndex(ctx, cx, cz);
    }

    let wp = HERD_MIGRATION_ROUTE[cow.routeIdx] || PASTURE_TROUGH_POS;
    const distToWp = Math.hypot(wp.x - cx, wp.z - cz);
    if (distToWp <= 6.5 && cow.routeIdx !== herdRouteIdx) {
      cow.routeIdx += cow.routeIdx < herdRouteIdx ? 1 : -1;
      wp = HERD_MIGRATION_ROUTE[cow.routeIdx] || wp;
    }

    const spotAng = i * 1.0471975 + steerBucket * 0.12;
    const spotRad = 2.6 + (i % 3) * 1.35;
    let goalX = wp.x + Math.cos(spotAng) * spotRad;
    let goalZ = wp.z + Math.sin(spotAng) * spotRad;
    if (!isCowPositionWalkable(ctx, goalX, goalZ, 1.0)) {
      goalX = wp.x;
      goalZ = wp.z;
    }
    const distToGoal = Math.hypot(goalX - cx, goalZ - cz);

    if (cow.happyTimer > 0) {
      cow.happyTimer = Math.max(0, cow.happyTimer - dt);
      if (cow.happyTimer <= 0) cow.lastBucket = -1;
    }
    if (cow.fleeTimer > 0) {
      cow.fleeTimer = Math.max(0, cow.fleeTimer - dt);
      if (cow.fleeTimer <= 0) cow.lastBucket = -1;
    }
    if (cow.curiousCooldown > 0) cow.curiousCooldown = Math.max(0, cow.curiousCooldown - dt);
    if (cow.avoidTimer > 0) cow.avoidTimer = Math.max(0, cow.avoidTimer - dt);
    if (cow.grazeTimer > 0) {
      cow.grazeTimer = Math.max(0, cow.grazeTimer - dt);
      if (cow.grazeTimer <= 0) cow.lastBucket = -1;
    }

    let desiredYaw = cow.yaw;
    let herdPullApplied = false;

    // 1. Máquina de estados viva (sem travar nem girar no lugar)
    if (cow.happyTimer > 0) {
      cow.state = 'curious';
      cow.speed = 0;
      cow.mood = 'Feliz 💚 (Muuu!)';
      desiredYaw = Math.atan2(px - cx, pz - cz);
      cow.targetYaw = desiredYaw;
    } else if (cow.fleeTimer > 0) {
      cow.state = 'flee';
      cow.speed = cow.baseSpeed * 2.15;
      cow.mood = 'Correndo 💨';
      desiredYaw = Math.atan2(cx - px, cz - pz);
    } else if (distToPlayer < 1.35) {
      cow.fleeTimer = 2.4;
      cow.curiousTimer = 0;
      cow.grazeTimer = 0;
      cow.state = 'flee';
      cow.speed = cow.baseSpeed * 2.15;
      cow.mood = 'Assustada 💨';
      desiredYaw = Math.atan2(cx - px, cz - pz);
    } else if (distToPlayer < 5.2 && cow.curiousCooldown <= 0) {
      if (cow.curiousTimer <= 0) {
        cow.curiousTimer = 2.4;
        cow.grazeTimer = 0;
        cow.lastBucket = -1;
      }
      cow.curiousTimer = Math.max(0, cow.curiousTimer - dt);
      cow.state = 'curious';
      cow.speed = 0;
      cow.mood = 'Curiosa 👀';
      desiredYaw = Math.atan2(px - cx, pz - cz);
      cow.targetYaw = desiredYaw;
      if (cow.curiousTimer <= 0) {
        cow.curiousCooldown = 11.0;
        cow.lastBucket = -1;
      }
    } else {
      if (cow.curiousTimer > 0) {
        cow.curiousTimer = 0;
        cow.lastBucket = -1;
      }
      if (cow.grazeTimer <= 0 && (steerBucket !== cow.lastBucket || cow.state === 'curious' || cow.state === 'flee')) {
        cow.lastBucket = steerBucket;
        const rAct = hash01(i + 3, steerBucket);
        const grazeChance = distToGoal > 8 ? 0.12 : 0.42;
        if (rAct < grazeChance) {
          cow.grazeTimer = distToGoal > 8
            ? 2.5 + hash01(i + 5, steerBucket) * 2.0
            : 4.0 + hash01(i + 5, steerBucket) * 3.0;
          cow.state = 'graze';
          cow.speed = 0;
        } else {
          cow.state = 'wander';
        }
      }

      if (cow.grazeTimer > 0) {
        cow.state = 'graze';
        cow.speed = 0;
        const nearTrough = Math.hypot(cx - PASTURE_TROUGH_POS.x, cz - PASTURE_TROUGH_POS.z) < 5.5;
        cow.mood = nearTrough
          ? (hash01(i + 7, steerBucket) < 0.5 ? 'Bebendo água 💧' : 'Comendo feno 🌾')
          : 'Pastando 🌿';
      } else {
        cow.state = 'wander';
        cow.speed = distToGoal > 9 ? cow.baseSpeed * 1.15 : cow.baseSpeed;

        let sepX = 0;
        let sepZ = 0;
        let herdPullX = 0;
        let herdPullZ = 0;
        let herdPullCount = 0;
        for (let j = 0; j < ctx.pastureCows.length; j++) {
          if (i === j) continue;
          const other = ctx.pastureCows[j];
          if (!other || other.abducted || !other.mesh || !other.mesh.position) continue;
          const dx = other.mesh.position.x - cx;
          const dz = other.mesh.position.z - cz;
          const dSq = dx * dx + dz * dz;
          if (dSq > 1e-5 && dSq < 2.5 * 2.5) {
            const d = Math.sqrt(dSq);
            const w = (2.5 - d) / 2.5;
            sepX -= (dx / d) * w;
            sepZ -= (dz / d) * w;
          } else if (dSq >= 25 && dSq <= 324) {
            herdPullX += dx;
            herdPullZ += dz;
            herdPullCount++;
          }
        }

        let dirX = 0;
        let dirZ = 0;
        if (distToGoal > 0.35) {
          dirX = (goalX - cx) / distToGoal;
          dirZ = (goalZ - cz) / distToGoal;
        } else {
          const idleAng = (steerBucket * 0.8 + i * 1.9) % (Math.PI * 2);
          dirX = Math.sin(idleAng);
          dirZ = Math.cos(idleAng);
        }

        if (distToGoal <= 12) {
          if (herdPullCount > 0) {
            const hpLen = Math.hypot(herdPullX, herdPullZ);
            if (hpLen > 0.5) {
              dirX += (herdPullX / hpLen) * 0.28;
              dirZ += (herdPullZ / hpLen) * 0.28;
              herdPullApplied = true;
            }
          }
          const sway = Math.sin(syncClock * 0.28 + i * 2.1) * 0.24;
          dirX += -dirZ * sway;
          dirZ += dirX * sway;
        }

        dirX += sepX * 1.35;
        dirZ += sepZ * 1.35;
        desiredYaw = Math.hypot(dirX, dirZ) > 1e-4 ? Math.atan2(dirX, dirZ) : cow.yaw;

        if (cow.routeIdx !== herdRouteIdx || distToGoal > 12) {
          cow.mood = 'Migrando 🌿';
        } else if (herdPullApplied) {
          cow.mood = 'Seguindo o rebanho 🐄';
        } else {
          cow.mood = 'Passeando 🌤️';
        }
      }
    }

    // 2. Movimento seguro com destravamento e lookahead (sem girar em círculo)
    let movedDist = 0;
    let nx = cx;
    let nz = cz;
    const currentlyWalkable = isCowPositionWalkable(ctx, cx, cz, 0.85);

    if (!currentlyWalkable) {
      cow.grazeTimer = 0;
      cow.avoidTimer = 0;
      if (findNearestWalkableSpot(ctx, cx, cz)) {
        const ux = _unstickTarget.x - cx;
        const uz = _unstickTarget.z - cz;
        const uLen = Math.hypot(ux, uz);
        if (uLen > 1e-4) {
          const escapeYaw = Math.atan2(ux, uz);
          cow.targetYaw = escapeYaw;
          const stepDist = Math.min(uLen, Math.max(cow.speed, cow.baseSpeed) * dt);
          nx = cx + (ux / uLen) * stepDist;
          nz = cz + (uz / uLen) * stepDist;
          movedDist = Math.hypot(nx - cx, nz - cz);
          cow.mesh.position.set(nx, terrainHeight(nx, nz), nz);
          cow.routeIdx = findClosestRouteIndex(ctx, nx, nz);
        }
      }
    } else if (cow.speed > 0.01) {
      let steerYaw = desiredYaw;
      if (cow.avoidTimer > 0) {
        if (isHeadingClearForCow(ctx, i, cx, cz, desiredYaw, 2.4)) {
          cow.avoidTimer = 0;
        } else {
          steerYaw = cow.avoidYaw;
        }
      }

      let chosenYaw = steerYaw;
      let moveScale = 1.0;
      const tryStep = cow.speed * dt;
      const directNx = cx + Math.sin(steerYaw) * tryStep;
      const directNz = cz + Math.cos(steerYaw) * tryStep;
      const directClear = isCowPositionWalkable(ctx, directNx, directNz, 0.95) &&
        isHeadingClearForCow(ctx, i, cx, cz, steerYaw, 1.4);

      if (!directClear) {
        if (chooseCowSteerHeading(ctx, i, cx, cz, desiredYaw, cow.avoidSide)) {
          chosenYaw = _steerResult.yaw;
          cow.avoidSide = _steerResult.side;
          cow.avoidYaw = chosenYaw;
          cow.avoidTimer = 0.75;
          moveScale = _steerResult.scale;
        } else {
          moveScale = 0;
        }
      }

      cow.targetYaw = chosenYaw;
      if (moveScale > 0) {
        const stepDist = cow.speed * dt * moveScale;
        const candX = cx + Math.sin(chosenYaw) * stepDist;
        const candZ = cz + Math.cos(chosenYaw) * stepDist;
        if (isCowPositionWalkable(ctx, candX, candZ, 0.95) &&
            !hasCowCollisionAt(ctx, i, cx, cz, candX, candZ, 1.15)) {
          nx = candX;
          nz = candZ;
          movedDist = Math.hypot(nx - cx, nz - cz);
          cow.mesh.position.set(nx, terrainHeight(nx, nz), nz);
        }
      }

      cow.stuckTimer = (cow.stuckTimer || 0) + dt;
      if (cow.stuckTimer >= 1.5) {
        const progress = Math.hypot(nx - (cow.lastProgressX ?? cx), nz - (cow.lastProgressZ ?? cz));
        cow.stuckTimer = 0;
        cow.lastProgressX = nx;
        cow.lastProgressZ = nz;
        if (progress < 0.35) {
          cow.avoidSide = -(cow.avoidSide || 1);
          cow.avoidTimer = 0;
          cow.routeIdx = findClosestRouteIndex(ctx, nx, nz);
        }
      }
    } else {
      cow.stuckTimer = 0;
      cow.lastProgressX = cx;
      cow.lastProgressZ = cz;
    }

    const yawDiff = wrapAngle(cow.targetYaw - cow.yaw);
    const maxTurn = dt * ((cow.state === 'flee' || cow.avoidTimer > 0) ? 5.5 : 3.2);
    cow.yaw = wrapAngle(cow.yaw + Math.max(-maxTurn, Math.min(maxTurn, yawDiff)));
    cow.mesh.rotation.y = cow.yaw;

    // 3. Animação honesta baseada no deslocamento real (só quando visível para manter FPS alto)
    const groundY = terrainHeight(cow.mesh.position.x, cow.mesh.position.z);
    const actualSpeed = dt > 1e-4 ? movedDist / dt : 0;
    if (cow.mesh.visible) {
      if (cow.happyTimer > 0) {
        const bounce = Math.abs(Math.sin(syncClock * 10.0 + i)) * 0.14;
        cow.mesh.position.y = groundY + bounce;
        if (cow.tail && cow.tail.rotation) cow.tail.rotation.z = Math.sin(syncClock * 18.0) * 0.65;
        if (cow.head && cow.head.rotation) cow.head.rotation.x = -0.12 + Math.sin(syncClock * 8.0) * 0.14;
      } else if (actualSpeed > 0.08) {
        cow.mesh.position.y = groundY;
        cow.walkPhase = (cow.walkPhase || 0) + dt * actualSpeed * 5.2;
        const swing = Math.sin(cow.walkPhase) * 0.44;
        if (cow.legs && cow.legs.length >= 4) {
          cow.legs[0].rotation.x = swing;
          cow.legs[3].rotation.x = swing;
          cow.legs[1].rotation.x = -swing;
          cow.legs[2].rotation.x = -swing;
        }
        if (cow.head && cow.head.rotation) cow.head.rotation.x = 0.12 + Math.sin(cow.walkPhase * 0.4) * 0.08;
        if (cow.tail && cow.tail.rotation) cow.tail.rotation.z = Math.sin(cow.walkPhase * 1.5) * 0.25;
      } else {
        cow.mesh.position.y = groundY;
        if (cow.legs) {
          for (let li = 0; li < cow.legs.length; li++) cow.legs[li].rotation.x *= 0.85;
        }
        if (cow.head && cow.head.rotation) {
          cow.head.rotation.x = cow.state === 'graze'
            ? 0.48 + Math.sin(syncClock * 3.0 + i) * 0.10
            : 0.05 + Math.sin(syncClock * 1.5 + i) * 0.04;
        }
        if (cow.tail && cow.tail.rotation) cow.tail.rotation.z = Math.sin(syncClock * 2.2 + i) * 0.18;
      }
    }

    // 4. Rastro de cocô sincronizado a cada 30s
    const poopBucket = Math.floor((syncClock + i * 5) / COW_POOP_INTERVAL_SEC);
    if (cow.lastPoopBucket === -1) {
      cow.lastPoopBucket = poopBucket;
    } else if (poopBucket > cow.lastPoopBucket) {
      cow.lastPoopBucket = poopBucket;
      if (THREE && THREE.Group && ctx.scene && ctx.cowPoops) {
        if (ctx.cowPoops.length >= MAX_ACTIVE_POOPS) {
          const oldest = ctx.cowPoops.shift();
          if (oldest && oldest.group) {
            if (oldest.group.parent) oldest.group.parent.remove(oldest.group);
            disposeObjectResources(oldest.group);
          }
        }
        const pxPos = cow.mesh.position.x - Math.sin(cow.yaw) * 0.55;
        const pzPos = cow.mesh.position.z - Math.cos(cow.yaw) * 0.55;
        const pyPos = terrainHeight(pxPos, pzPos);
        const poopId = `wild_poop_${i}_${poopBucket}`;
        const poopVis = createPoopWithFliesAndCubensis(pxPos, pyPos, pzPos, poopId, poopBucket + i * 13);
        ctx.scene.add(poopVis.group);
        ctx.cowPoops.push({
          id: poopId,
          group: poopVis.group,
          flies: poopVis.flies,
          myceliumGroup: poopVis.myceliumGroup,
          cubensisGroup: poopVis.cubensisGroup,
          mushParts: poopVis.mushParts,
          ageSec: 0,
          grown: false,
          wildEntry: {
            id: poopId,
            group: poopVis.cubensisGroup,
            worldX: pxPos,
            worldZ: pzPos,
            capMesh: poopVis.caps[0],
            active: false,
            respawnAt: 0
          }
        });
      }
    }
  }

  // 5. Atualiza mosquinhas + crescimento animado (micélio -> pins -> haste -> chapéu) + desaparecimento após 120s
  if (!ctx.cowPoops) return;
  for (let pi = ctx.cowPoops.length - 1; pi >= 0; pi--) {
    const p = ctx.cowPoops[pi];
    p.ageSec += dt;

    if (p.ageSec >= POOP_TOTAL_LIFETIME_SEC) {
      if (p.group) {
        if (p.group.parent) p.group.parent.remove(p.group);
        disposeObjectResources(p.group);
      }
      p.wildEntry.active = false;
      if (ctx.wildMushrooms) {
        const wIdx = ctx.wildMushrooms.indexOf(p.wildEntry);
        if (wIdx !== -1) ctx.wildMushrooms.splice(wIdx, 1);
      }
      ctx.cowPoops.splice(pi, 1);
      continue;
    }

    const pDistSq = (p.group.position.x - px) ** 2 + (p.group.position.z - pz) ** 2;
    p.group.visible = pDistSq <= 45 * 45;

    if (p.group.visible) {
      for (let fi = 0; fi < p.flies.length; fi++) {
        const fl = p.flies[fi];
        fl.phase += dt * 5.8;
        fl.group.position.x = Math.cos(fl.phase) * fl.radius;
        fl.group.position.z = Math.sin(fl.phase * 1.3) * fl.radius;
        fl.group.position.y = 0.26 + Math.sin(fl.phase * 2.4) * 0.05;
        fl.group.rotation.y = -fl.phase;
      }

      // Fade/encolhimento suave nos últimos 5s antes de sumir
      if (p.ageSec > POOP_TOTAL_LIFETIME_SEC - 5) {
        const fade = Math.max(0.05, (POOP_TOTAL_LIFETIME_SEC - p.ageSec) / 5);
        p.group.scale.setScalar(fade);
      }
    }

    // Estágios de crescimento (0-10s micélio, 10-20s pins, 20-30s haste + véu + abertura do chapéu)
    if (p.myceliumGroup) {
      const mycFrac = Math.min(1, Math.max(0.08, p.ageSec / 10));
      p.myceliumGroup.scale.set(mycFrac, 1, mycFrac);
    }

    if (p.ageSec >= 10 && p.mushParts && (!p.grown || p.wildEntry.active)) {
      p.cubensisGroup.visible = true;
      const pinFrac = Math.min(1, (p.ageSec - 10) / 10); // 10s..20s
      const growFrac = Math.min(1, Math.max(0, (p.ageSec - 20) / 10)); // 20s..30s
      for (let mi = 0; mi < p.mushParts.length; mi++) {
        const mp = p.mushParts[mi];
        const stemH = 0.18 + pinFrac * 0.22 + growFrac * 0.60;
        const capOpen = 0.28 + pinFrac * 0.20 + growFrac * 0.52;
        mp.stemPivot.scale.set(0.45 + 0.55 * growFrac, stemH, 0.45 + 0.55 * growFrac);
        mp.veilRing.visible = growFrac > 0.35;
        mp.capGroup.position.y = 0.195 * stemH;
        mp.capGroup.scale.set(capOpen, 0.45 + 0.55 * growFrac, capOpen);
      }
    }

    if (!p.grown && p.ageSec >= POOP_CUBENSIS_GROW_SEC) {
      p.grown = true;
      p.wildEntry.active = true;
      if (ctx.wildMushrooms && ctx.wildMushrooms.indexOf(p.wildEntry) === -1) {
        ctx.wildMushrooms.push(p.wildEntry);
      }
    }
  }
}

// ============================================================================
// ABELHAS INTELIGENTES, RAINHA COM COROA, FLORES, MEL E MIGRAÇÃO DE ENXAME
// ============================================================================
const FLOWER_COLORS = [0xf472b6, 0xa855f7, 0xef4444, 0x38bdf8, 0xfb923c, 0xf8fafc];
const FLOWER_COLOR_NAMES = ['Rosa', 'Lavanda', 'Vermelha', 'Azul', 'Laranja', 'Branca'];
export const FLOWER_POLLEN_PER_VISIT = 0.10;
export const MAX_CAMPUS_FLOWERS = 110;
let flowerIdSeq = 0;
const _flowerPlantHit = {
  point: THREE && THREE.Vector3 ? new THREE.Vector3() : { x: 0, y: 0, z: 0 },
  distance: 0
};

const CAMPUS_HIVE_CANDIDATES = [
  { x: 24.8, z: 26.5 },
  { x: 68.5, z: -16.0 },
  { x: -69.5, z: 12.0 },
  { x: 38.0, z: 24.0 },
  { x: 54.0, z: -28.0 },
  { x: -72.0, z: -22.0 },
  { x: -30.5, z: 28.5 },
  { x: 46.0, z: -46.0 },
  { x: 66.0, z: 28.0 }
];

function createBeveledBoxGeo(w, h, d, bevel = 0.022) {
  if (!THREE || !THREE.Shape || !THREE.ExtrudeGeometry) {
    return THREE && THREE.BoxGeometry ? new THREE.BoxGeometry(w, h, d) : {};
  }
  const iw = Math.max(0.012, w - bevel * 2);
  const ih = Math.max(0.012, h - bevel * 2);
  const id = Math.max(0.012, d - bevel * 2);
  const r = Math.min(bevel * 0.75, iw * 0.25, ih * 0.25);
  const hw = iw * 0.5;
  const hh = ih * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 3
  });
  geo.center();
  return geo;
}

function createFacetedWingGeo() {
  if (!THREE || !THREE.Shape || !THREE.ExtrudeGeometry) {
    return THREE && THREE.BoxGeometry ? new THREE.BoxGeometry(0.16, 0.008, 0.11) : {};
  }
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-0.055, 0.048);
  shape.lineTo(-0.145, 0.078);
  shape.lineTo(-0.185, 0.032);
  shape.lineTo(-0.165, -0.038);
  shape.lineTo(-0.072, -0.046);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: false,
    curveSegments: 2
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

let beeSharedAssets = null;
function getBeeSharedAssets() {
  if (beeSharedAssets) return beeSharedAssets;
  const spriteTex = getCachedCanvasTexture('bee_swarm_migrating_lbl', 320, 64, (sctx) => {
    sctx.clearRect(0, 0, 320, 64);
    sctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    sctx.beginPath();
    if (sctx.roundRect) sctx.roundRect(6, 6, 308, 52, 14);
    else sctx.rect(6, 6, 308, 52);
    sctx.fill();
    sctx.strokeStyle = '#facc15';
    sctx.lineWidth = 3;
    sctx.stroke();
    sctx.fillStyle = '#fef08a';
    sctx.font = 'bold 22px system-ui, sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('🐝 Enxame migrando!', 160, 33);
  });

  const loadCuteTex = (file) => {
    if (typeof document === 'undefined' || !THREE.TextureLoader) return null;
    try {
      const tex = new THREE.TextureLoader().load('assets/textures/' + file);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.userData.shared = true;
      return tex;
    } catch (e) {
      return null;
    }
  };
  const hiveTex = loadCuteTex('beehive-cute.jpg');

  beeSharedAssets = markAllShared({
    yellowMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.42, emissive: 0xeab308, emissiveIntensity: 0.22, flatShading: true }),
    queenYellowMat: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.34, emissive: 0xf59e0b, emissiveIntensity: 0.28, flatShading: true }),
    ruffMat: new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.65, emissive: 0xfef3c7, emissiveIntensity: 0.14, flatShading: true }),
    blushMat: new THREE.MeshBasicMaterial({ color: 0xfb7185 }),
    crownMat: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.24, metalness: 0.65, emissive: 0xd97706, emissiveIntensity: 0.30, flatShading: true }),
    darkMat: new THREE.MeshStandardMaterial({ color: 0x26140a, roughness: 0.62, flatShading: true }),
    eyeWhiteMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    wingMat: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.78,
      roughness: 0.16,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      flatShading: true
    }),
    wingVeinMat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }),
    pollenMat: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.50, emissive: 0xb45309, emissiveIntensity: 0.24, flatShading: true }),
    hiveWoodMat: new THREE.MeshStandardMaterial({ color: hiveTex ? 0xffe4b5 : 0xf59e0b, map: hiveTex, roughness: 0.62, emissive: 0xb45309, emissiveIntensity: 0.12 }),
    hiveDarkMat: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.68, emissive: 0x92400e, emissiveIntensity: 0.14, flatShading: true }),
    hiveGlowMat: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.95, roughness: 0.3 }),
    hiveLeafMat: new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.55, emissive: 0x4d7c0f, emissiveIntensity: 0.18, flatShading: true }),
    hiveAbandonedMat: new THREE.MeshStandardMaterial({ color: 0x94a3b8, map: hiveTex, roughness: 0.94 }),
    hiveAbandonedBandMat: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.96, flatShading: true }),
    honeyMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.18, metalness: 0.08, emissive: 0xd97706, emissiveIntensity: 0.34, flatShading: true }),
    jewelMat: new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.65, roughness: 0.18, flatShading: true }),
    holeMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    trunkMat: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 }),
    leafMat: new THREE.MeshStandardMaterial({ color: 0x36b45e, roughness: 0.82 }),
    leafLightMat: new THREE.MeshStandardMaterial({ color: 0x74cf65, roughness: 0.8 }),
    stemMat: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 }),
    flowerCenterMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }),
    flowerCenterEmptyMat: new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 }),
    petalMats: FLOWER_COLORS.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65 })),
    birchCrownGeo: new THREE.DodecahedronGeometry(1, 1),
    trunkGeo: new THREE.CylinderGeometry(0.24, 0.30, 3.6, 8),
    hiveBaseGeo: new THREE.CylinderGeometry(0.24, 0.14, 0.10, 8),
    hiveBandBotGeo: new THREE.CylinderGeometry(0.30, 0.25, 0.13, 8),
    hiveRibBotGeo: new THREE.CylinderGeometry(0.325, 0.32, 0.055, 8),
    hiveBandMidGeo: new THREE.CylinderGeometry(0.325, 0.325, 0.16, 8),
    hiveRibTopGeo: new THREE.CylinderGeometry(0.315, 0.325, 0.055, 8),
    hiveBandTopGeo: new THREE.CylinderGeometry(0.255, 0.30, 0.12, 8),
    hiveCapGeo: new THREE.CylinderGeometry(0.14, 0.265, 0.10, 8),
    hiveHangerBarGeo: createBeveledBoxGeo(0.56, 0.065, 0.095, 0.012),
    hiveHangerPostGeo: createBeveledBoxGeo(0.075, 0.10, 0.085, 0.010),
    hiveLeafGeo: new THREE.SphereGeometry(0.075, 6, 5),
    hiveArchPillarGeo: createBeveledBoxGeo(0.048, 0.15, 0.065, 0.010),
    hiveArchTopGeo: createBeveledBoxGeo(0.115, 0.048, 0.068, 0.010),
    hiveGlowGeo: createBeveledBoxGeo(0.105, 0.14, 0.045, 0.014),
    hivePorchGeo: createBeveledBoxGeo(0.21, 0.036, 0.095, 0.010),
    hiveHitGeo: new THREE.CylinderGeometry(0.36, 0.36, 0.72, 8),
    honeyDropGeo: new THREE.SphereGeometry(0.036, 7, 6),
    jewelGeo: new THREE.OctahedronGeometry(0.019, 0),
    beeBodyGeo: createBeveledBoxGeo(0.19, 0.175, 0.25, 0.022),
    beeStripeGeo: createBeveledBoxGeo(0.198, 0.181, 0.044, 0.014),
    beeButtGeo: createBeveledBoxGeo(0.15, 0.135, 0.036, 0.014),
    beeStingerGeo: new THREE.ConeGeometry(0.018, 0.052, 6),
    beeEyeGeo: new THREE.SphereGeometry(0.026, 8, 6),
    beeGlintGeo: new THREE.SphereGeometry(0.011, 6, 5),
    beeSmileGeo: THREE.TorusGeometry ? new THREE.TorusGeometry(0.016, 0.0045, 6, 10, Math.PI) : new THREE.BoxGeometry(0.03, 0.008, 0.008),
    beeBlushGeo: new THREE.SphereGeometry(0.018, 6, 5),
    beeAntStemGeo: new THREE.CylinderGeometry(0.007, 0.008, 0.038, 6),
    beeAntTipGeo: new THREE.SphereGeometry(0.012, 6, 5),
    beeLegGeo: new THREE.CylinderGeometry(0.011, 0.009, 0.040, 6),
    beePollenGeo: new THREE.SphereGeometry(0.045, 7, 6),
    beeWingGeo: createFacetedWingGeo(),
    beeWingVeinGeo: new THREE.BoxGeometry(0.105, 0.009, 0.008),
    queenRuffGeo: new THREE.SphereGeometry(0.034, 7, 6),
    crownBaseGeo: new THREE.CylinderGeometry(0.062, 0.054, 0.030, 8),
    crownSpikeGeo: new THREE.ConeGeometry(0.017, 0.044, 5),
    crownOrbGeo: new THREE.SphereGeometry(0.011, 6, 5),
    stemGeo: new THREE.CylinderGeometry(0.018, 0.022, 0.26, 6),
    centerGeo: new THREE.SphereGeometry(0.045, 7, 6),
    petalGeo: new THREE.SphereGeometry(0.042, 6, 5),
    flowerHitGeo: new THREE.CylinderGeometry(0.22, 0.22, 0.42, 6),
    flowerHitMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    flowerSeedPodGeo: new THREE.SphereGeometry(0.055, 7, 6),
    flowerSeedPodMat: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.42, roughness: 0.35 }),
    seedPackBodyGeo: new THREE.BoxGeometry(0.11, 0.145, 0.028),
    seedPackBodyMat: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 }),
    seedPackTrimGeo: new THREE.BoxGeometry(0.114, 0.028, 0.032),
    seedPackTrimMat: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.58 }),
    spriteMat: spriteTex ? new THREE.SpriteMaterial({ map: spriteTex, transparent: true, depthTest: true, depthWrite: false }) : null
  });
  return beeSharedAssets;
}

function markSubtreeDynamic(root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse((o) => {
    if (o && o.userData) {
      o.userData.isDynamic = true;
      o.userData.noMerge = true;
    }
  });
}

function createCuteBeeMesh(isQueen) {
  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial) {
    return {
      group: {
        position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        rotation: { x: 0, y: 0, z: 0 },
        visible: true,
        parent: null
      },
      wingL: { rotation: { x: 0, y: 0, z: 0 } },
      wingR: { rotation: { x: 0, y: 0, z: 0 } },
      pollenMesh: { visible: false },
      migrationSprite: isQueen ? { visible: false } : null,
      legs: []
    };
  }
  const a = getBeeSharedAssets();
  const g = new THREE.Group();

  // Corpinho low-poly chanfrado e fofinho
  const body = new THREE.Mesh(a.beeBodyGeo, isQueen ? a.queenYellowMat : a.yellowMat);
  g.add(body);

  // 2 listras no abdômen + acabamento traseiro + ferrão
  const stripe1 = new THREE.Mesh(a.beeStripeGeo, a.darkMat);
  stripe1.position.z = -0.005;
  const stripe2 = new THREE.Mesh(a.beeStripeGeo, a.darkMat);
  stripe2.position.z = -0.075;
  const buttCap = new THREE.Mesh(a.beeButtGeo, a.darkMat);
  buttCap.position.z = -0.116;
  const stinger = new THREE.Mesh(a.beeStingerGeo, a.darkMat);
  stinger.rotation.x = -Math.PI / 2;
  stinger.position.set(0, -0.01, -0.15);
  g.add(stripe1, stripe2, buttCap, stinger);

  // Olhinhos brilhantes, bochechas rosadas, sorriso fofo e anteninhas curvadas
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(a.beeEyeGeo, a.darkMat);
    eye.scale.set(0.85, 1.32, 0.52);
    eye.position.set(side * 0.052, 0.006, 0.124);
    const glint = new THREE.Mesh(a.beeGlintGeo, a.eyeWhiteMat);
    glint.position.set(side * 0.044, 0.020, 0.134);
    const blush = new THREE.Mesh(a.beeBlushGeo, a.blushMat);
    blush.scale.set(1.25, 0.72, 0.45);
    blush.position.set(side * 0.068, -0.026, 0.122);

    const antPivot = new THREE.Group();
    antPivot.position.set(side * 0.046, 0.088, 0.092);
    antPivot.rotation.set(0.45, 0, -side * 0.25);
    const antStem = new THREE.Mesh(a.beeAntStemGeo, a.darkMat);
    antStem.position.y = 0.018;
    const antTip = new THREE.Mesh(a.beeAntTipGeo, a.darkMat);
    antTip.position.set(0, 0.038, 0.010);
    antPivot.add(antStem, antTip);

    g.add(eye, glint, blush, antPivot);
  });

  const smile = new THREE.Mesh(a.beeSmileGeo, a.darkMat);
  smile.position.set(0, -0.006, 0.130);
  smile.rotation.z = Math.PI;
  g.add(smile);

  // 6 patinhas arredondadas embaixo
  const legs = [];
  for (let p = 0; p < 3; p++) {
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(a.beeLegGeo, a.darkMat);
      leg.position.set(side * 0.052, -0.10, 0.052 - p * 0.055);
      g.add(leg);
      legs.push(leg);
    });
  }

  // Bolinha de pólen amarela visível durante a volta para a colmeia
  const pollenMesh = new THREE.Mesh(a.beePollenGeo, a.pollenMat);
  pollenMesh.position.set(0, -0.115, -0.02);
  pollenMesh.visible = false;
  g.add(pollenMesh);

  // Asinhas facetadas translúcidas com nervuras (esq/dir)
  const wingL = new THREE.Group();
  wingL.position.set(-0.040, 0.092, -0.01);
  const wMeshL = new THREE.Mesh(a.beeWingGeo, a.wingMat);
  const wVeinL1 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinL1.position.set(-0.08, 0.003, -0.012);
  wVeinL1.rotation.y = 0.16;
  const wVeinL2 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinL2.scale.set(0.68, 1, 0.9);
  wVeinL2.position.set(-0.075, 0.003, 0.016);
  wVeinL2.rotation.y = -0.26;
  wingL.add(wMeshL, wVeinL1, wVeinL2);

  const wingR = new THREE.Group();
  wingR.position.set(0.040, 0.092, -0.01);
  const wMeshR = new THREE.Mesh(a.beeWingGeo, a.wingMat);
  wMeshR.scale.x = -1;
  const wVeinR1 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinR1.position.set(0.08, 0.003, -0.012);
  wVeinR1.rotation.y = -0.16;
  const wVeinR2 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinR2.scale.set(0.68, 1, 0.9);
  wVeinR2.position.set(0.075, 0.003, 0.016);
  wVeinR2.rotation.y = 0.26;
  wingR.add(wMeshR, wVeinR1, wVeinR2);

  g.add(wingL, wingR);

  let migrationSprite = null;
  if (isQueen) {
    // Gola fofinha branca real no peito da Abelha Rainha
    [-0.068, -0.036, 0, 0.036, 0.068].forEach((rx, rIdx) => {
      const puff = new THREE.Mesh(a.queenRuffGeo, a.ruffMat);
      const midBoost = 1 - Math.abs(rIdx - 2) * 0.12;
      puff.scale.set(0.95 * midBoost, 0.85 * midBoost, 0.95 * midBoost);
      puff.position.set(rx, -0.062 - (1 - midBoost) * 0.008, 0.105 - Math.abs(rx) * 0.28);
      g.add(puff);
    });

    // Coroa dourada esculpida com pontas, esferas e rubi lapidado
    const crownBase = new THREE.Mesh(a.crownBaseGeo, a.crownMat);
    crownBase.position.set(0, 0.106, 0.045);
    g.add(crownBase);
    [[-0.038, 0.048], [0, 0.056], [0.038, 0.048]].forEach(([cx, cz]) => {
      const spike = new THREE.Mesh(a.crownSpikeGeo, a.crownMat);
      spike.position.set(cx, 0.138, cz);
      const orb = new THREE.Mesh(a.crownOrbGeo, a.crownMat);
      orb.position.set(cx, 0.162, cz);
      g.add(spike, orb);
    });
    const jewel = new THREE.Mesh(a.jewelGeo, a.jewelMat);
    jewel.position.set(0, 0.130, 0.072);
    g.add(jewel);
    g.scale.setScalar(1.06);

    if (a.spriteMat) {
      migrationSprite = new THREE.Sprite(a.spriteMat);
      migrationSprite.position.set(0, 0.34, 0);
      migrationSprite.scale.set(1.45, 0.29, 1);
      migrationSprite.visible = false;
      g.add(migrationSprite);
    }
  } else {
    g.scale.setScalar(0.76);
  }

  markSubtreeDynamic(g);
  return { group: g, wingL, wingR, pollenMesh, migrationSprite, legs };
}

export function createCampusFlower(ctx, x, z, colorIdx, opts = {}) {
  const gy = terrainHeight(x, z);
  const cIdx = (((colorIdx || 0) % FLOWER_COLORS.length) + FLOWER_COLORS.length) % FLOWER_COLORS.length;
  const baseScale = typeof opts.baseScale === 'number' ? opts.baseScale : (0.88 + Math.random() * 0.28);
  const stage = opts.stage || 'blooming';
  const pollen = stage === 'blooming' ? (typeof opts.pollen === 'number' ? opts.pollen : 1.0) : 0;
  const sproutDuration = typeof opts.sproutDuration === 'number' ? opts.sproutDuration : (12 + Math.random() * 20);
  const seedHoldDuration = typeof opts.seedHoldDuration === 'number' ? opts.seedHoldDuration : (18 + Math.random() * 22);
  const wiltDuration = typeof opts.wiltDuration === 'number' ? opts.wiltDuration : (3.2 + Math.random() * 3.0);
  const stageTimer = typeof opts.stageTimer === 'number' ? opts.stageTimer : 0;
  const id = 'fl_' + (++flowerIdSeq);

  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial || !ctx || !ctx.scene) {
    const mockFlower = {
      id,
      group: {
        position: { x, y: gy, z },
        scale: { x: baseScale, y: baseScale, z: baseScale, setScalar(s) { this.x = s; this.y = s; this.z = s; } },
        rotation: { x: 0, y: 0, z: 0 },
        visible: true,
        parent: null
      },
      centerMesh: {
        material: null,
        scale: { setScalar() {} }
      },
      petalGroup: { scale: { setScalar() {}, set() {} } },
      seedPodMesh: { visible: stage === 'seeding', position: { y: 0.32 }, scale: { setScalar() {} } },
      hitMesh: null,
      x,
      y: gy + 0.28 * baseScale,
      z,
      colorIdx: cIdx,
      baseScale,
      stage,
      pollen,
      stageTimer,
      sproutDuration,
      seedHoldDuration,
      wiltDuration,
      seedHarvested: false,
      removed: false
    };
    return mockFlower;
  }

  const a = getBeeSharedAssets();
  const fg = new THREE.Group();
  fg.position.set(x, gy, z);

  const stem = new THREE.Mesh(a.stemGeo, a.stemMat);
  stem.position.y = 0.13;
  const center = new THREE.Mesh(a.centerGeo, stage === 'blooming' ? a.flowerCenterMat : a.flowerCenterEmptyMat);
  center.position.y = 0.27;
  center.scale.setScalar(0.72 + pollen * 0.28);
  fg.add(stem, center);

  const petalGroup = new THREE.Group();
  const petalMat = a.petalMats[cIdx];
  for (let p = 0; p < 5; p++) {
    const ang = (p / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(a.petalGeo, petalMat);
    petal.position.set(Math.cos(ang) * 0.062, 0.265, Math.sin(ang) * 0.062);
    petal.scale.set(1.15, 0.65, 1.15);
    petalGroup.add(petal);
  }
  if (stage === 'sprouting') {
    const t = Math.max(0, Math.min(1, stageTimer / sproutDuration));
    fg.scale.setScalar(baseScale * (0.24 + 0.76 * t));
    petalGroup.scale.setScalar(0.15 + 0.85 * t);
  } else {
    fg.scale.setScalar(baseScale);
  }
  fg.add(petalGroup);

  const seedPodMesh = new THREE.Mesh(a.flowerSeedPodGeo, a.flowerSeedPodMat);
  seedPodMesh.position.set(0, 0.32, 0);
  seedPodMesh.visible = stage === 'seeding';
  fg.add(seedPodMesh);

  const hitMesh = new THREE.Mesh(a.flowerHitGeo, a.flowerHitMat);
  hitMesh.position.y = 0.21;
  fg.add(hitMesh);

  markSubtreeDynamic(fg);
  ctx.scene.add(fg);

  const fl = {
    id,
    group: fg,
    centerMesh: center,
    petalGroup,
    seedPodMesh,
    hitMesh,
    x,
    y: gy + 0.28 * baseScale,
    z,
    colorIdx: cIdx,
    baseScale,
    stage,
    pollen,
    stageTimer,
    sproutDuration,
    seedHoldDuration,
    wiltDuration,
    seedHarvested: false,
    removed: false
  };
  hitMesh.userData.flowerObj = fl;
  if (!Array.isArray(ctx.flowerHitMeshes)) ctx.flowerHitMeshes = [];
  ctx.flowerHitMeshes.push(hitMesh);
  return fl;
}

function getStaticCampusEavesSpots() {
  return [
    { x: 17.5, y: 3.15, z: 35.15, mountType: 'eaves', label: 'Beiral do Empório' },
    { x: 50.0, y: 3.35, z: 33.35, mountType: 'eaves', label: 'Beiral da Estação Ecológica' },
    { x: 58.0, y: 3.35, z: 17.35, mountType: 'eaves', label: 'Beiral do Dormitório' },
    { x: 48.0, y: 3.45, z: -3.65, mountType: 'eaves', label: 'Beiral do Cinema' }
  ];
}

export function findNearestHiveMountSpot(ctx, fromX = 0, fromZ = 0) {
  const candidates = [];
  for (let i = 0; i < VILLAGE_LOTS.length; i++) {
    const lot = VILLAGE_LOTS[i];
    candidates.push(
      { x: lot.x + lot.front * 2.1, y: 2.86, z: lot.doorZ + lot.front * 0.45, mountType: 'eaves', label: `Beiral Casa #${lot.id}` },
      { x: lot.x - (VILLAGE_HOUSE.width / 2 + 0.36), y: 2.86, z: lot.houseZ, mountType: 'eaves', label: `Beiral Casa #${lot.id}` },
      { x: lot.x + (VILLAGE_HOUSE.width / 2 + 0.36), y: 2.86, z: lot.houseZ, mountType: 'eaves', label: `Beiral Casa #${lot.id}` }
    );
  }
  const zones = ctx && Array.isArray(ctx.roofZones) ? ctx.roofZones : null;
  if (zones && zones.length) {
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (!z || typeof z.minX !== 'number') continue;
      // Casas da vila já adicionadas acima (roofY ~ 3.02)
      if (Math.abs((z.roofY || 0) - 3.02) < 0.15) continue;
      const midX = (z.minX + z.maxX) * 0.5;
      const midZ = (z.minZ + z.maxZ) * 0.5;
      const ey = Math.max(2.65, Math.min(3.55, (z.roofY || 3.4) - 0.55));
      candidates.push(
        { x: midX, y: ey, z: z.maxZ + 0.25, mountType: 'eaves', label: 'Beiral do Prédio' },
        { x: midX, y: ey, z: z.minZ - 0.25, mountType: 'eaves', label: 'Beiral do Prédio' },
        { x: z.minX - 0.25, y: ey, z: midZ, mountType: 'eaves', label: 'Beiral do Prédio' },
        { x: z.maxX + 0.25, y: ey, z: midZ, mountType: 'eaves', label: 'Beiral do Prédio' }
      );
    }
  } else {
    const statics = getStaticCampusEavesSpots();
    for (let i = 0; i < statics.length; i++) candidates.push(statics[i]);
  }
  for (let i = 0; i < CAMPUS_HIVE_CANDIDATES.length; i++) {
    const c = CAMPUS_HIVE_CANDIDATES[i];
    candidates.push({
      x: c.x,
      y: terrainHeight(c.x, c.z) + 2.55,
      z: c.z,
      mountType: 'tree',
      label: 'Árvore Próxima'
    });
  }

  const existing = (ctx && Array.isArray(ctx.beehives)) ? ctx.beehives : [];
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const checkX = cand.mountType === 'tree' ? cand.x + 0.48 : cand.x;
    const occupied = existing.some((h) => h && !h.abandoned && !h.collected && Math.hypot(h.x - checkX, h.z - cand.z) < 3.5);
    if (occupied) continue;
    const d = Math.hypot(checkX - fromX, cand.z - fromZ);
    if (d < bestDist) {
      bestDist = d;
      best = cand;
    }
  }
  return best;
}

function spawnTreeWithHiveSlot(ctx, x, z) {
  const gy = terrainHeight(x, z);
  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial || !ctx || !ctx.scene) {
    return { tree: null, gy, posX: x, posZ: z };
  }
  const a = getBeeSharedAssets();
  const tree = new THREE.Group();
  tree.position.set(x, gy, z);
  const trunk = new THREE.Mesh(a.trunkGeo, a.trunkMat);
  trunk.position.y = 1.8;
  const crownPuffs = [
    [-0.62, 3.9, 0.08, 1.05, 0], [0.62, 3.95, -0.12, 1.08, 1],
    [0.05, 4.18, 0.64, 0.96, 1], [-0.08, 4.25, -0.62, 0.92, 0],
    [0, 4.88, 0, 1.02, 1]
  ];
  const crownMeshes = [];
  for (let ci = 0; ci < crownPuffs.length; ci++) {
    const cp = crownPuffs[ci];
    const crown = new THREE.Mesh(a.birchCrownGeo, cp[4] ? a.leafLightMat : a.leafMat);
    crown.position.set(cp[0], cp[1], cp[2]);
    crown.scale.set(cp[3], cp[3] * 0.8, cp[3]);
    crown.rotation.set(ci * 0.11, ci * 0.72, ci * 0.08);
    crown.castShadow = true;
    crownMeshes.push(crown);
  }
  tree.add(trunk, ...crownMeshes);
  ctx.scene.add(tree);
  return { tree, gy, posX: x, posZ: z };
}

function buildHiveVisualGroup() {
  const a = getBeeSharedAssets();
  const hiveGroup = new THREE.Group();

  const baseBowl = new THREE.Mesh(a.hiveBaseGeo, a.hiveDarkMat);
  baseBowl.position.y = -0.27;
  const bandBot = new THREE.Mesh(a.hiveBandBotGeo, a.hiveWoodMat);
  bandBot.position.y = -0.16;
  const ribBot = new THREE.Mesh(a.hiveRibBotGeo, a.hiveDarkMat);
  ribBot.position.y = -0.085;
  const bandMid = new THREE.Mesh(a.hiveBandMidGeo, a.hiveWoodMat);
  bandMid.position.y = 0.02;
  const ribTop = new THREE.Mesh(a.hiveRibTopGeo, a.hiveDarkMat);
  ribTop.position.y = 0.125;
  const bandTop = new THREE.Mesh(a.hiveBandTopGeo, a.hiveWoodMat);
  bandTop.position.y = 0.21;
  const capDome = new THREE.Mesh(a.hiveCapGeo, a.hiveDarkMat);
  capDome.position.y = 0.315;

  const hangerBar = new THREE.Mesh(a.hiveHangerBarGeo, a.hiveDarkMat);
  hangerBar.position.set(-0.08, 0.42, 0);
  const hangerPostL = new THREE.Mesh(a.hiveHangerPostGeo, a.hiveDarkMat);
  hangerPostL.position.set(-0.28, 0.36, 0);
  const hangerPostR = new THREE.Mesh(a.hiveHangerPostGeo, a.hiveDarkMat);
  hangerPostR.position.set(0.14, 0.36, 0);
  const hiveLeaf = new THREE.Mesh(a.hiveLeafGeo, a.hiveLeafMat);
  hiveLeaf.scale.set(1.1, 0.72, 0.42);
  hiveLeaf.position.set(0.04, 0.485, 0);
  hiveLeaf.rotation.set(0.18, 0.35, 0.48);

  const archL = new THREE.Mesh(a.hiveArchPillarGeo, a.hiveDarkMat);
  archL.position.set(-0.078, -0.11, 0.302);
  const archR = new THREE.Mesh(a.hiveArchPillarGeo, a.hiveDarkMat);
  archR.position.set(0.078, -0.11, 0.302);
  const archTop = new THREE.Mesh(a.hiveArchTopGeo, a.hiveDarkMat);
  archTop.position.set(0, -0.032, 0.302);
  const hiveGlow = new THREE.Mesh(a.hiveGlowGeo, a.hiveGlowMat);
  hiveGlow.position.set(0, -0.108, 0.282);
  const hivePorch = new THREE.Mesh(a.hivePorchGeo, a.hiveDarkMat);
  hivePorch.position.set(0, -0.195, 0.318);

  const honeyDropGroup = new THREE.Group();
  const dropSpecs = [
    [-0.14, 0.08, 0.318, 1.05, 1.55, 0.65],
    [-0.18, 0.095, 0.305, 0.75, 1.15, 0.60],
    [0.19, 0.165, 0.255, 0.85, 1.40, 0.65],
    [0.24, 0.045, 0.225, 0.70, 1.15, 0.60]
  ];
  for (let di = 0; di < dropSpecs.length; di++) {
    const ds = dropSpecs[di];
    const dm = new THREE.Mesh(a.honeyDropGeo, a.honeyMat);
    dm.position.set(ds[0], ds[1], ds[2]);
    dm.scale.set(ds[3], ds[4], ds[5]);
    honeyDropGroup.add(dm);
  }

  const hitMesh = new THREE.Mesh(a.hiveHitGeo, a.flowerHitMat);
  hitMesh.position.y = 0.04;

  hiveGroup.add(
    baseBowl, bandBot, ribBot, bandMid, ribTop, bandTop, capDome,
    hangerBar, hangerPostL, hangerPostR, hiveLeaf,
    archL, archR, archTop, hiveGlow, hivePorch, honeyDropGroup, hitMesh
  );
  markSubtreeDynamic(hiveGroup);
  return {
    hiveGroup,
    bandBot,
    bandMid,
    bandTop,
    ribBot,
    baseBowl,
    ribTop,
    capDome,
    hangerBar,
    hangerPostL,
    hangerPostR,
    archL,
    archR,
    archTop,
    hiveGlow,
    hiveLeaf,
    hivePorch,
    honeyDropGroup,
    hitMesh
  };
}

function createHiveOnTree(ctx, id, treeInfo, opts = {}) {
  const isEaves = opts.mountType === 'eaves' || !treeInfo;
  const worldX = isEaves
    ? (opts.x ?? 0)
    : ((treeInfo.tree ? treeInfo.tree.position.x : (treeInfo.posX ?? 0)) + 0.48);
  const worldY = isEaves
    ? (opts.y ?? 2.86)
    : ((treeInfo.gy ?? 0) + 2.55);
  const worldZ = isEaves
    ? (opts.z ?? 0)
    : (treeInfo.tree ? treeInfo.tree.position.z : (treeInfo.posZ ?? 0));

  if (!Array.isArray(ctx.beehives)) ctx.beehives = [];
  if (!Array.isArray(ctx.beehiveHitMeshes)) ctx.beehiveHitMeshes = [];

  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial || !ctx.scene) {
    const mockHive = {
      id,
      mountType: isEaves ? 'eaves' : 'tree',
      group: {
        position: { x: worldX, y: worldY, z: worldZ, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        scale: { setScalar() {} },
        visible: !opts.migrating,
        parent: null
      },
      treeGroup: treeInfo ? treeInfo.tree : null,
      boxMesh: null,
      bandMesh: null,
      honeycombMeshes: [],
      trimMeshes: [],
      glowMesh: null,
      leafMesh: { visible: true },
      honeyDropMesh: { visible: false, scale: { set() {} } },
      hitMesh: { userData: {} },
      treePos: isEaves ? null : { x: worldX - 0.48, z: worldZ },
      x: worldX,
      y: worldY,
      z: worldZ,
      honeyLevel: typeof opts.honeyLevel === 'number' ? opts.honeyLevel : 45,
      abandoned: !!opts.abandoned,
      migrating: !!opts.migrating,
      buildProgress: typeof opts.buildProgress === 'number' ? opts.buildProgress : 1.0,
      canCollectAbandoned: !!opts.abandoned,
      collected: !!opts.collected,
      extinct: !!opts.extinct,
      failedMigrations: opts.failedMigrations || 0,
      groundResting: false,
      groundRestPos: null,
      exhaustionTimer: 0,
      flowersNearby: [],
      queen: null,
      bees: [],
      noPollenTimer: 0
    };
    ctx.beehives.push(mockHive);
    return mockHive;
  }

  const vis = buildHiveVisualGroup();
  const hiveGroup = vis.hiveGroup;
  if (isEaves) {
    hiveGroup.position.set(worldX, worldY, worldZ);
    ctx.scene.add(hiveGroup);
  } else {
    hiveGroup.position.set(0.48, 2.55, 0);
    treeInfo.tree.add(hiveGroup);
  }

  const hiveObj = {
    id,
    mountType: isEaves ? 'eaves' : 'tree',
    group: hiveGroup,
    treeGroup: isEaves ? null : treeInfo.tree,
    boxMesh: vis.bandMid,
    bandMesh: vis.ribBot,
    honeycombMeshes: [vis.bandBot, vis.bandMid, vis.bandTop],
    trimMeshes: [
      vis.baseBowl, vis.ribBot, vis.ribTop, vis.capDome,
      vis.hangerBar, vis.hangerPostL, vis.hangerPostR,
      vis.archL, vis.archR, vis.archTop, vis.hivePorch
    ],
    glowMesh: vis.hiveGlow,
    leafMesh: vis.hiveLeaf,
    honeyDropMesh: vis.honeyDropGroup,
    hitMesh: vis.hitMesh,
    treePos: isEaves ? null : { x: treeInfo.tree.position.x, z: treeInfo.tree.position.z },
    x: worldX,
    y: worldY,
    z: worldZ,
    honeyLevel: typeof opts.honeyLevel === 'number' ? opts.honeyLevel : 45,
    abandoned: !!opts.abandoned,
    migrating: !!opts.migrating,
    buildProgress: typeof opts.buildProgress === 'number' ? opts.buildProgress : 1.0,
    canCollectAbandoned: !!opts.abandoned,
    collected: !!opts.collected,
    extinct: !!opts.extinct,
    failedMigrations: opts.failedMigrations || 0,
    groundResting: false,
    groundRestPos: null,
    exhaustionTimer: 0,
    flowersNearby: [],
    queen: null,
    bees: [],
    noPollenTimer: 0
  };

  vis.hitMesh.userData.hiveObj = hiveObj;
  ctx.beehiveHitMeshes.push(vis.hitMesh);
  ctx.beehives.push(hiveObj);
  if (hiveObj.migrating || hiveObj.collected) {
    hiveGroup.visible = false;
  } else {
    hiveGroup.scale.setScalar(Math.max(0.2, hiveObj.buildProgress));
  }
  return hiveObj;
}

export function createHiveAtSpot(ctx, id, spot, opts = {}) {
  if (spot && spot.mountType === 'eaves') {
    return createHiveOnTree(ctx, id, null, { ...opts, mountType: 'eaves', x: spot.x, y: spot.y, z: spot.z });
  }
  const tx = spot ? spot.x : 0;
  const tz = spot ? spot.z : 0;
  const treeInfo = spawnTreeWithHiveSlot(ctx, tx, tz);
  return createHiveOnTree(ctx, id, treeInfo, { ...opts, mountType: 'tree' });
}

function spawnHiveSwarm(ctx, hive, originPos = null, seedOffset = 0) {
  if (!ctx || !hive) return;
  if (!Array.isArray(ctx.pastureBees)) ctx.pastureBees = [];

  const qPhase = seedOffset * 1.7;
  let qx = originPos ? originPos.x : (hive.x + 0.55 + Math.cos(qPhase) * 1.15);
  let qy = originPos ? (originPos.y + 0.35) : (hive.y + 0.42);
  let qz = originPos ? originPos.z : (hive.z + 0.45 + Math.sin(qPhase) * 1.15);
  if (!originPos && isBeeBlockedAt3D(ctx, qx, qy, qz, 0.15, hive)) {
    qx = hive.x + 0.95;
    qy = hive.y + 0.85;
    qz = hive.z + 0.85;
  }
  const qVis = createCuteBeeMesh(true);
  qVis.group.position.set(qx, qy, qz);
  if (ctx.scene && qVis.group && typeof ctx.scene.add === 'function' && qVis.group.isObject3D !== false) {
    try { ctx.scene.add(qVis.group); } catch (_) {}
  }
  const queenObj = {
    isQueen: true,
    hive,
    group: qVis.group,
    wingL: qVis.wingL,
    wingR: qVis.wingR,
    legs: qVis.legs,
    pollenMesh: qVis.pollenMesh,
    migrationSprite: qVis.migrationSprite,
    phase: qPhase,
    radius: 1.15,
    speed: 1.15,
    state: hive.migrating ? 'migrate' : 'orbit',
    avoidSide: seedOffset % 2 === 0 ? 1 : -1,
    hasPollen: false
  };
  hive.queen = queenObj;
  ctx.pastureBees.push(queenObj);

  for (let b = 0; b < 3; b++) {
    const beeVis = createCuteBeeMesh(false);
    const bPhase = (seedOffset * 3 + b) * 2.1;
    let bx = originPos ? (originPos.x + (b - 1) * 0.35) : (hive.x + 0.55 + Math.cos(bPhase) * (0.95 + b * 0.25));
    let by = originPos ? (originPos.y + 0.25 + b * 0.08) : (hive.y + 0.05 + b * 0.14);
    let bz = originPos ? (originPos.z + (b % 2 === 0 ? 0.28 : -0.28)) : (hive.z + 0.55 + Math.sin(bPhase) * (0.95 + b * 0.25));
    if (!originPos && isBeeBlockedAt3D(ctx, bx, by, bz, 0.15, hive)) {
      bx = hive.x + 0.65 + (b - 1) * 0.45;
      by = hive.y + 0.35 + b * 0.14;
      bz = hive.z + 0.85;
    }
    beeVis.group.position.set(bx, by, bz);
    if (ctx.scene && beeVis.group && typeof ctx.scene.add === 'function' && beeVis.group.isObject3D !== false) {
      try { ctx.scene.add(beeVis.group); } catch (_) {}
    }
    const beeObj = {
      isQueen: false,
      hive,
      group: beeVis.group,
      wingL: beeVis.wingL,
      wingR: beeVis.wingR,
      legs: beeVis.legs,
      pollenMesh: beeVis.pollenMesh,
      phase: bPhase,
      radius: 1.2 + b * 0.45,
      speed: 1.8 + b * 0.2,
      state: hive.migrating ? 'migrate' : 'to_flower',
      targetFlower: null,
      stateTimer: 0.4 + b * 0.7,
      avoidSide: b % 2 === 0 ? 1 : -1,
      hasPollen: false
    };
    hive.bees.push(beeObj);
    ctx.pastureBees.push(beeObj);
  }
}

export function serializeBeehives(ctx) {
  const list = (ctx && Array.isArray(ctx.beehives)) ? ctx.beehives : [];
  const compact = [];
  for (let i = 0; i < list.length && compact.length < 24; i++) {
    const h = list[i];
    if (!h) continue;
    compact.push({
      id: String(h.id || ('hive_' + i)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || ('hive_' + i),
      x: Math.round((Number(h.x) || 0) * 100) / 100,
      y: Math.round((Number(h.y) || 2.55) * 100) / 100,
      z: Math.round((Number(h.z) || 0) * 100) / 100,
      m: h.mountType === 'eaves' ? 'eaves' : 'tree',
      h: Math.max(0, Math.min(100, Math.round(Number(h.honeyLevel) || 0))),
      bp: Math.round(Math.max(0, Math.min(1, Number(h.buildProgress ?? 1))) * 100) / 100,
      ab: h.abandoned ? 1 : 0,
      co: h.collected ? 1 : 0,
      ex: h.extinct ? 1 : 0,
      fm: Math.max(0, Math.min(20, Math.round(Number(h.failedMigrations) || 0)))
    });
  }
  return JSON.stringify(compact);
}

export function serializeCampusFlowers(ctx) {
  const list = (ctx && Array.isArray(ctx.campusFlowers)) ? ctx.campusFlowers : [];
  const compact = [];
  for (let i = 0; i < list.length; i++) {
    const fl = list[i];
    if (!fl || fl.removed) continue;
    compact.push({
      x: Math.round((Number(fl.x) || 0) * 100) / 100,
      z: Math.round((Number(fl.z) || 0) * 100) / 100,
      c: Math.max(0, Math.min(15, Math.round(Number(fl.colorIdx) || 0))),
      st: ['sprouting', 'blooming', 'seeding', 'wilting'].includes(fl.stage) ? fl.stage : 'blooming',
      p: Math.round(Math.max(0, Math.min(1, Number(fl.pollen ?? 1))) * 100) / 100,
      sh: fl.seedHarvested ? 1 : 0
    });
    if (compact.length >= 65) break;
  }
  return JSON.stringify(compact);
}

export function queueBeeEcologySync(ctx, force = false) {
  if (!ctx || typeof ctx.queueWorldStateChange !== 'function') return false;
  let queued = false;
  const hJson = serializeBeehives(ctx);
  if (hJson.length <= 6000 && (force || hJson !== ctx._lastSentBeehives)) {
    if (hJson !== ctx._lastSentBeehives || force) {
      ctx._lastSentBeehives = hJson;
      ctx.queueWorldStateChange('campus_beehives', hJson);
      queued = true;
    }
  }
  const fJson = serializeCampusFlowers(ctx);
  if (fJson.length <= 6000 && (force || fJson !== ctx._lastSentFlowers)) {
    if (fJson !== ctx._lastSentFlowers || force) {
      ctx._lastSentFlowers = fJson;
      ctx.queueWorldStateChange('campus_flowers', fJson);
      queued = true;
    }
  }
  return queued;
}

export function applyBeeEcologyWorldState(ctx, stateMap) {
  if (!ctx || !stateMap) return false;
  let appliedAny = false;

  if (typeof stateMap.campus_flowers === 'string' &&
      stateMap.campus_flowers !== ctx._lastAppliedFlowers &&
      stateMap.campus_flowers !== ctx._lastSentFlowers) {
    try {
      const parsed = JSON.parse(stateMap.campus_flowers);
      if (Array.isArray(parsed)) {
        const oldFlowers = Array.isArray(ctx.campusFlowers) ? ctx.campusFlowers.slice() : [];
        for (let i = 0; i < oldFlowers.length; i++) removeCampusFlower(ctx, oldFlowers[i]);
        if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = [];
        for (let i = 0; i < parsed.length && i < 65; i++) {
          const item = parsed[i];
          if (!item || typeof item.x !== 'number' || typeof item.z !== 'number') continue;
          const stage = ['sprouting', 'blooming', 'seeding', 'wilting'].includes(item.st) ? item.st : 'blooming';
          const fl = createCampusFlower(ctx, item.x, item.z, item.c || 0, {
            stage,
            pollen: stage === 'blooming' ? (typeof item.p === 'number' ? item.p : 1) : 0
          });
          if (item.sh) {
            fl.seedHarvested = true;
            if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
          }
          ctx.campusFlowers.push(fl);
        }
        ctx._lastAppliedFlowers = stateMap.campus_flowers;
        ctx._lastSentFlowers = stateMap.campus_flowers;
        appliedAny = true;
      }
    } catch (_) {}
  }

  if (typeof stateMap.campus_beehives === 'string' &&
      stateMap.campus_beehives !== ctx._lastAppliedBeehives &&
      stateMap.campus_beehives !== ctx._lastSentBeehives) {
    try {
      const parsed = JSON.parse(stateMap.campus_beehives);
      if (Array.isArray(parsed)) {
        if (Array.isArray(ctx.pastureBees)) {
          for (let i = 0; i < ctx.pastureBees.length; i++) {
            const b = ctx.pastureBees[i];
            if (b && b.group && b.group.parent) b.group.parent.remove(b.group);
          }
          ctx.pastureBees.length = 0;
        }
        if (Array.isArray(ctx.beehives)) {
          for (let i = 0; i < ctx.beehives.length; i++) {
            const h = ctx.beehives[i];
            if (!h) continue;
            if (h.group && h.group.parent) h.group.parent.remove(h.group);
            if (h.treeGroup && h.treeGroup.parent) h.treeGroup.parent.remove(h.treeGroup);
          }
          ctx.beehives.length = 0;
        }
        if (Array.isArray(ctx.beehiveHitMeshes)) ctx.beehiveHitMeshes.length = 0;

        for (let i = 0; i < parsed.length && i < 24; i++) {
          const item = parsed[i];
          if (!item || typeof item.x !== 'number' || typeof item.z !== 'number') continue;
          const isEaves = item.m === 'eaves';
          const spot = isEaves
            ? { x: item.x, y: typeof item.y === 'number' ? item.y : 2.86, z: item.z, mountType: 'eaves' }
            : { x: item.x - 0.48, y: typeof item.y === 'number' ? item.y : 2.55, z: item.z, mountType: 'tree' };
          const hive = createHiveAtSpot(ctx, item.id || ('hive_' + i), spot, {
            honeyLevel: typeof item.h === 'number' ? item.h : 45,
            buildProgress: typeof item.bp === 'number' ? item.bp : 1.0,
            abandoned: !!item.ab,
            collected: !!item.co,
            extinct: !!item.ex,
            failedMigrations: item.fm || 0
          });
          if (hive.abandoned || hive.extinct || hive.collected) {
            markHiveAbandoned(hive);
            hive.extinct = !!item.ex;
            hive.collected = !!item.co;
            if (hive.group) hive.group.visible = !hive.collected;
            if (hive.hitMesh && hive.hitMesh.userData) hive.hitMesh.userData.ignoreRay = !!hive.collected;
          } else {
            spawnHiveSwarm(ctx, hive, null, i);
          }
        }
        ctx._lastAppliedBeehives = stateMap.campus_beehives;
        ctx._lastSentBeehives = stateMap.campus_beehives;
        appliedAny = true;
      }
    } catch (_) {}
  }

  if (appliedAny) refreshAllHiveFlowers(ctx);
  return appliedAny;
}

export function extinguishHiveColony(ctx, hive) {
  if (!ctx || !hive || hive.extinct) return false;
  hive.extinct = true;
  hive.groundResting = false;
  hive.exhaustionTimer = 0;

  if (Array.isArray(ctx.pastureBees)) {
    for (let i = ctx.pastureBees.length - 1; i >= 0; i--) {
      const b = ctx.pastureBees[i];
      if (b && b.hive === hive) {
        if (b.group && b.group.parent) b.group.parent.remove(b.group);
        ctx.pastureBees.splice(i, 1);
      }
    }
  }

  markHiveAbandoned(hive);

  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  if (onToast && Math.hypot(px - hive.x, pz - hive.z) <= 65) {
    const activeLeft = (ctx.beehives || []).filter((h) => h && !h.abandoned && !h.extinct && !h.collected).length;
    if (activeLeft === 0) {
      onToast('🕯️ Extinção! O último reinado de abelhas não resistiu. Compre uma Colmeia ou Isca na Loja!');
    } else {
      onToast('🥀 Uma colônia de abelhas entrou em extinção por falta de flores!');
    }
  }
  queueBeeEcologySync(ctx, true);
  return true;
}

export function getBeeEcologySummary(ctx) {
  const hives = (ctx && Array.isArray(ctx.beehives)) ? ctx.beehives : [];
  const bees = (ctx && Array.isArray(ctx.pastureBees)) ? ctx.pastureBees : [];
  const flowers = (ctx && Array.isArray(ctx.campusFlowers)) ? ctx.campusFlowers : [];

  let activeHives = 0;
  let abandonedHives = 0;
  let extinctHives = 0;
  let restingOnGroundHives = 0;
  let honeySum = 0;
  for (let i = 0; i < hives.length; i++) {
    const h = hives[i];
    if (!h || h.collected) continue;
    if (h.abandoned) {
      abandonedHives++;
      if (h.extinct) extinctHives++;
    } else {
      activeHives++;
      honeySum += Number(h.honeyLevel) || 0;
      if (h.groundResting) restingOnGroundHives++;
    }
  }

  let queens = 0;
  let workers = 0;
  for (let i = 0; i < bees.length; i++) {
    const b = bees[i];
    if (!b || !b.hive || b.hive.abandoned || b.hive.extinct) continue;
    if (b.isQueen) queens++;
    else workers++;
  }

  let bloomingFlowers = 0;
  let sproutingFlowers = 0;
  let seedingFlowers = 0;
  let pollenSum = 0;
  for (let i = 0; i < flowers.length; i++) {
    const fl = flowers[i];
    if (!fl || fl.removed) continue;
    if (fl.stage === 'blooming') {
      bloomingFlowers++;
      pollenSum += Number(fl.pollen) || 0;
    } else if (fl.stage === 'sprouting') {
      sproutingFlowers++;
    } else if (fl.stage === 'seeding') {
      seedingFlowers++;
    }
  }

  return {
    activeHives,
    abandonedHives,
    extinctHives,
    restingOnGroundHives,
    totalBees: queens + workers,
    queens,
    workers,
    totalFlowers: bloomingFlowers + sproutingFlowers + seedingFlowers,
    bloomingFlowers,
    sproutingFlowers,
    seedingFlowers,
    avgPollenPct: bloomingFlowers > 0 ? Math.round((pollenSum / bloomingFlowers) * 100) : 0,
    avgHoneyPct: activeHives > 0 ? Math.round(honeySum / activeHives) : 0
  };
}

function refreshHiveFlowers(ctx, hive, maxRadius = 18.0) {
  if (!ctx.campusFlowers) {
    hive.flowersNearby = [];
    return hive.flowersNearby;
  }
  const list = [];
  for (let i = 0; i < ctx.campusFlowers.length; i++) {
    const fl = ctx.campusFlowers[i];
    if (fl && !fl.removed && Math.hypot(fl.x - hive.x, fl.z - hive.z) <= maxRadius) {
      list.push(fl);
    }
  }
  hive.flowersNearby = list;
  return list;
}

function refreshAllHiveFlowers(ctx) {
  if (!ctx || !ctx.beehives) return;
  for (let i = 0; i < ctx.beehives.length; i++) {
    const h = ctx.beehives[i];
    if (h && !h.abandoned && !h.collected) refreshHiveFlowers(ctx, h);
  }
}

function transitionFlowerToSeeding(fl, a) {
  fl.pollen = 0;
  fl.stage = 'seeding';
  fl.stageTimer = 0;
  fl.seedHarvested = false;
  if (fl.centerMesh) {
    if (a) fl.centerMesh.material = a.flowerCenterEmptyMat;
    if (fl.centerMesh.scale?.setScalar) fl.centerMesh.scale.setScalar(0.72);
  }
  if (fl.petalGroup?.scale?.set) fl.petalGroup.scale.set(0.86, 0.72, 0.86);
  if (fl.seedPodMesh) fl.seedPodMesh.visible = true;
}

function removeCampusFlower(ctx, fl) {
  if (!fl || fl.removed) return;
  fl.removed = true;
  if (fl.group) {
    if (fl.group.parent) fl.group.parent.remove(fl.group);
    if (THREE && THREE.Object3D && typeof disposeObjectResources === 'function') {
      try { disposeObjectResources(fl.group); } catch (_) {}
    }
  }
  if (fl.hitMesh && ctx && Array.isArray(ctx.flowerHitMeshes)) {
    const hIdx = ctx.flowerHitMeshes.indexOf(fl.hitMesh);
    if (hIdx !== -1) ctx.flowerHitMeshes.splice(hIdx, 1);
  }
  if (ctx && Array.isArray(ctx.campusFlowers)) {
    const fIdx = ctx.campusFlowers.indexOf(fl);
    if (fIdx !== -1) ctx.campusFlowers.splice(fIdx, 1);
  }
  if (ctx && Array.isArray(ctx.pastureBees)) {
    for (let i = 0; i < ctx.pastureBees.length; i++) {
      if (ctx.pastureBees[i] && ctx.pastureBees[i].targetFlower === fl) {
        ctx.pastureBees[i].targetFlower = null;
      }
    }
  }
  if (ctx && ctx.hoveredFlower === fl) ctx.hoveredFlower = null;
  refreshAllHiveFlowers(ctx);
}

export function disperseFlowerSeed(ctx, motherFl) {
  if (!ctx || !motherFl) return null;
  if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = [];
  if (ctx.campusFlowers.length >= MAX_CAMPUS_FLOWERS) return null;

  let sx = 0, sz = 0, found = false;
  for (let attempt = 0; attempt < 22; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 1.8 + Math.random() * 3.8;
    const cx = motherFl.x + Math.cos(ang) * dist;
    const cz = motherFl.z + Math.sin(ang) * dist;
    if (!isNaturalSoilSpot(cx, cz, 0.65) || isBlockedAt(ctx, cx, cz, 0.45)) continue;
    let tooClose = false;
    for (let i = 0; i < ctx.campusFlowers.length; i++) {
      const other = ctx.campusFlowers[i];
      if (other && !other.removed && Math.hypot(other.x - cx, other.z - cz) < 0.75) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      sx = cx;
      sz = cz;
      found = true;
      break;
    }
  }
  if (!found) return null;

  const nextColor = Math.random() < 0.75
    ? motherFl.colorIdx
    : Math.floor(Math.random() * FLOWER_COLORS.length);
  const child = createCampusFlower(ctx, sx, sz, nextColor, {
    stage: 'sprouting',
    sproutDuration: 12 + Math.random() * 20
  });
  ctx.campusFlowers.push(child);
  if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: motherFl.x, y: motherFl.y, z: motherFl.z }, 0xfde047, 5);
  refreshAllHiveFlowers(ctx);
  queueBeeEcologySync(ctx, true);
  return child;
}

export function stepCampusFlowers(ctx, dt, nowSec = 0) {
  if (!ctx || !Array.isArray(ctx.campusFlowers) || !ctx.campusFlowers.length) return;
  const a = (THREE && THREE.MeshStandardMaterial) ? getBeeSharedAssets() : null;

  for (let fi = ctx.campusFlowers.length - 1; fi >= 0; fi--) {
    const fl = ctx.campusFlowers[fi];
    if (!fl || fl.removed) {
      ctx.campusFlowers.splice(fi, 1);
      continue;
    }

    if (fl.stage === 'sprouting') {
      fl.stageTimer += dt;
      const p = Math.max(0, Math.min(1, fl.stageTimer / (fl.sproutDuration || 18)));
      if (fl.group?.scale?.setScalar) fl.group.scale.setScalar((fl.baseScale || 1) * (0.24 + 0.76 * p));
      if (fl.petalGroup?.scale?.setScalar) fl.petalGroup.scale.setScalar(0.15 + 0.85 * p);
      if (fl.stageTimer >= (fl.sproutDuration || 18)) {
        fl.stage = 'blooming';
        fl.pollen = 1.0;
        fl.stageTimer = 0;
        if (fl.centerMesh) {
          if (a) fl.centerMesh.material = a.flowerCenterMat;
          if (fl.centerMesh.scale?.setScalar) fl.centerMesh.scale.setScalar(1.0);
        }
        if (fl.petalGroup?.scale?.setScalar) fl.petalGroup.scale.setScalar(1.0);
        if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
        if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: fl.x, y: fl.y, z: fl.z }, 0xfacc15, 4);
        refreshAllHiveFlowers(ctx);
        queueBeeEcologySync(ctx, true);
      }
    } else if (fl.stage === 'blooming') {
      if (fl.centerMesh?.scale?.setScalar) fl.centerMesh.scale.setScalar(0.72 + Math.max(0, fl.pollen) * 0.28);
      if (fl.pollen <= 0.001) {
        transitionFlowerToSeeding(fl, a);
      }
    } else if (fl.stage === 'seeding') {
      fl.stageTimer += dt;
      if (fl.seedPodMesh) {
        fl.seedPodMesh.visible = true;
        if (fl.seedPodMesh.position) fl.seedPodMesh.position.y = 0.32 + Math.sin(nowSec * 5 + fi) * 0.02;
        if (fl.seedPodMesh.scale?.setScalar) fl.seedPodMesh.scale.setScalar(0.95 + Math.sin(nowSec * 6 + fi) * 0.14);
      }
      if (fl.stageTimer >= (fl.seedHoldDuration || 25)) {
        if (!fl.seedHarvested) disperseFlowerSeed(ctx, fl);
        if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
        fl.stage = 'wilting';
        fl.stageTimer = 0;
      }
    } else if (fl.stage === 'wilting') {
      fl.stageTimer += dt;
      const wp = Math.max(0, Math.min(1, fl.stageTimer / (fl.wiltDuration || 4)));
      if (fl.group?.scale?.setScalar) fl.group.scale.setScalar((fl.baseScale || 1) * (1 - 0.95 * wp));
      if (fl.group?.rotation) fl.group.rotation.z = wp * 0.35;
      if (fl.stageTimer >= (fl.wiltDuration || 4)) {
        removeCampusFlower(ctx, fl);
        queueBeeEcologySync(ctx, true);
      }
    }
  }
}

function markHiveAbandoned(hive) {
  if (!hive) return;
  const a = (THREE && THREE.MeshStandardMaterial) ? getBeeSharedAssets() : null;
  hive.abandoned = true;
  hive.migrating = false;
  hive.groundResting = false;
  hive.honeyLevel = 0;
  hive.canCollectAbandoned = true;
  if (a) {
    if (hive.honeycombMeshes && hive.honeycombMeshes.length) {
      for (let i = 0; i < hive.honeycombMeshes.length; i++) {
        if (hive.honeycombMeshes[i]) hive.honeycombMeshes[i].material = a.hiveAbandonedMat;
      }
    } else if (hive.boxMesh) {
      hive.boxMesh.material = a.hiveAbandonedMat;
    }
    if (hive.trimMeshes && hive.trimMeshes.length) {
      for (let i = 0; i < hive.trimMeshes.length; i++) {
        if (hive.trimMeshes[i]) hive.trimMeshes[i].material = a.hiveAbandonedBandMat;
      }
    } else if (hive.bandMesh) {
      hive.bandMesh.material = a.hiveAbandonedBandMat;
    }
    if (hive.glowMesh) hive.glowMesh.material = a.holeMat;
  }
  if (hive.leafMesh) hive.leafMesh.visible = false;
  if (hive.honeyDropMesh) hive.honeyDropMesh.visible = false;
  hive.bees = [];
  hive.queen = null;
}

function createPastureBees(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  if (!Array.isArray(ctx.pastureBees)) ctx.pastureBees = []; else ctx.pastureBees.length = 0;
  if (!Array.isArray(ctx.beehives)) ctx.beehives = []; else ctx.beehives.length = 0;
  if (!Array.isArray(ctx.beehiveHitMeshes)) ctx.beehiveHitMeshes = []; else ctx.beehiveHitMeshes.length = 0;
  if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = []; else ctx.campusFlowers.length = 0;
  if (!Array.isArray(ctx.flowerHitMeshes)) ctx.flowerHitMeshes = []; else ctx.flowerHitMeshes.length = 0;

  let flowerSeed = 0;
  CAMPUS_HIVE_CANDIDATES.forEach((spot, sIdx) => {
    const count = sIdx < 3 ? 6 : 7;
    for (let f = 0; f < count; f++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const ang = (f / count) * Math.PI * 2 + hash01(sIdx + 1, f + attempt * 7 + 3) * 1.1;
        const dist = 2.0 + hash01(f + attempt * 13 + 7, sIdx + 11) * 5.2;
        const fx = spot.x + Math.cos(ang) * dist;
        const fz = spot.z + Math.sin(ang) * dist;
        if (isNaturalSoilSpot(fx, fz, 0.7) && !isBlockedAt(ctx, fx, fz, 0.5)) {
          const isStaggeredSprout = sIdx >= 3 && (flowerSeed % 6 === 0);
          const sDur = 12 + hash01(f + 5, sIdx + 19) * 20;
          ctx.campusFlowers.push(createCampusFlower(ctx, fx, fz, flowerSeed++, {
            stage: isStaggeredSprout ? 'sprouting' : 'blooming',
            pollen: 1.0,
            sproutDuration: sDur,
            stageTimer: isStaggeredSprout ? sDur * hash01(sIdx + 2, f + 9) * 0.7 : 0
          }));
          break;
        }
      }
    }
  });

  // 3 Colmeias iniciais com Rainha + 3 abelhas operárias cada
  for (let hIdx = 0; hIdx < 3; hIdx++) {
    const hs = CAMPUS_HIVE_CANDIDATES[hIdx];
    const hive = createHiveAtSpot(ctx, 'hive_' + hIdx, { x: hs.x, z: hs.z, mountType: 'tree' }, {
      honeyLevel: 45 + hIdx * 10,
      buildProgress: 1.0
    });
    refreshHiveFlowers(ctx, hive);
    spawnHiveSwarm(ctx, hive, null, hIdx);
  }
}

function enterGroundRestMode(ctx, hive) {
  if (!ctx || !hive || hive.abandoned || hive.extinct) return;
  hive.groundResting = true;
  hive.migrating = false;
  hive.exhaustionTimer = hive.exhaustionTimer || 0;
  let rx = hive.x + 0.85;
  let rz = hive.z + 0.85;
  if (!isNaturalSoilSpot(rx, rz, 0.5) || isBlockedAt(ctx, rx, rz, 0.45)) {
    rx = hive.x + 0.6;
    rz = hive.z + 0.6;
  }
  const ry = terrainHeight(rx, rz) + 0.14;
  hive.groundRestPos = { x: rx, y: ry, z: rz };

  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  if (onToast && Math.hypot(px - hive.x, pz - hive.z) <= 45) {
    onToast('🐝 Enxame exausto sem flores! As abelhas estão descansando no chão...');
  }
  queueBeeEcologySync(ctx, true);
}

export function startHiveMigration(ctx, oldHive, isNight = false) {
  if (!ctx || !oldHive || oldHive.abandoned || oldHive.collected || oldHive.extinct) return false;
  const nightNow = !!isNight || (typeof window !== 'undefined' && !!window.campusIsNight) ||
    (typeof ctx.sunElevation === 'number' && ctx.sunElevation < -0.05);

  let bestSpot = null;
  let bestScore = -1;
  const hives = Array.isArray(ctx.beehives) ? ctx.beehives : [];
  for (let i = 0; i < CAMPUS_HIVE_CANDIDATES.length; i++) {
    const cand = CAMPUS_HIVE_CANDIDATES[i];
    const occupied = hives.some((h) => h && !h.abandoned && !h.collected && Math.hypot(h.x - cand.x, h.z - cand.z) < 6.0);
    if (occupied) continue;
    let score = 0;
    if (ctx.campusFlowers) {
      for (let f = 0; f < ctx.campusFlowers.length; f++) {
        const fl = ctx.campusFlowers[f];
        if (fl && !fl.removed && fl.stage === 'blooming' && fl.pollen > 0.001 && Math.hypot(fl.x - cand.x, fl.z - cand.z) <= 11.5) {
          score++;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSpot = cand;
    }
  }

  if (!bestSpot || bestScore <= 0) {
    oldHive.failedMigrations = (oldHive.failedMigrations || 0) + 1;
    // Se tentou migrar demais sem flores (ou falhou à noite), desce para descansar no chão antes de possível extinção
    if (!bestSpot || oldHive.failedMigrations >= 3 || (nightNow && oldHive.failedMigrations >= 2)) {
      enterGroundRestMode(ctx, oldHive);
      return false;
    }
  } else {
    oldHive.failedMigrations = 0;
  }

  const queen = oldHive.queen;
  const bees = Array.isArray(oldHive.bees) ? oldHive.bees.slice() : [];
  const nextFailedCount = oldHive.failedMigrations || 0;
  markHiveAbandoned(oldHive);

  const newHive = createHiveAtSpot(ctx, 'hive_mig_' + hives.length, { x: bestSpot.x, z: bestSpot.z, mountType: 'tree' }, {
    honeyLevel: 12,
    migrating: true,
    buildProgress: 0.2,
    failedMigrations: nextFailedCount
  });
  newHive.queen = queen;
  newHive.bees = bees;
  if (queen) {
    queen.hive = newHive;
    queen.state = 'migrate';
    if (queen.migrationSprite) queen.migrationSprite.visible = false;
  }
  for (let i = 0; i < bees.length; i++) {
    bees[i].hive = newHive;
    bees[i].state = 'migrate';
    bees[i].hasPollen = false;
    if (bees[i].pollenMesh) bees[i].pollenMesh.visible = false;
  }
  queueBeeEcologySync(ctx, true);
  return true;
}

const BEE_STEER_MAGS = [0.95, -0.95, 1.55, -1.55];

/** Verifica colisão 3D contra terreno, prédios, paredes, troncos e caixas de colmeia. */
export function isBeeBlockedAt3D(ctx, x, y, z, radius = 0.22, ignoreHiveBox = null) {
  const r = radius || 0.22;
  if (y < terrainHeight(x, z) + 0.14) return true;
  const cols = ctx && ctx.solidColliders;
  if (cols) {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (!c) continue;
      const minY = (typeof c.minY === 'number' ? c.minY : -1) - r;
      const maxY = (typeof c.maxY === 'number' ? c.maxY : 6.0) + r;
      if (y >= minY && y <= maxY &&
        x >= c.minX - r && x <= c.maxX + r &&
        z >= c.minZ - r && z <= c.maxZ + r) {
        return true;
      }
    }
  }
  const walls = ctx && ctx.wallSegments;
  if (walls) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!w) continue;
      const minY = (typeof w.minY === 'number' ? w.minY : -1) - r;
      const maxY = (typeof w.maxY === 'number' ? w.maxY : 5.5) + r;
      if (y < minY || y > maxY) continue;
      const vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((x - w.x1) * vx + (z - w.z1) * vz) / lenSq));
      const px = w.x1 + t * vx, pz = w.z1 + t * vz;
      const minR = r + (w.halfThick || (w.thickness || 0.25) * 0.5);
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < minR * minR) return true;
    }
  }
  const hives = ctx && ctx.beehives;
  if (hives) {
    for (let i = 0; i < hives.length; i++) {
      const h = hives[i];
      if (!h || h.collected || h.migrating) continue;
      if (h.treePos && y < h.y + 1.15) {
        const tdx = x - h.treePos.x, tdz = z - h.treePos.z;
        const tr = 0.26 + r;
        if (tdx * tdx + tdz * tdz < tr * tr) return true;
      }
      if (ignoreHiveBox === h && (z > h.z + 0.10 || Math.hypot(x - h.x, z - h.z) < 0.72)) continue;
      if (Math.abs(x - h.x) < 0.26 + r &&
        Math.abs(y - h.y) < 0.26 + r &&
        Math.abs(z - h.z) < 0.26 + r) {
        return true;
      }
    }
  }
  return false;
}

/** Move a abelha rumo ao alvo desviando lateralmente ou subindo sobre obstáculos 3D. */
export function moveBeeSafely(ctx, bee, tx, ty, tz, speed, dt, bobY = 0, ignoreHiveBox = null) {
  const r = 0.15;
  const pos = bee.group.position;
  const dx = tx - pos.x;
  const dy = ty - pos.y;
  const dz = tz - pos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-4) return 0;

  const stepDist = Math.min(d, speed * dt);
  const dirX = dx / d;
  const dirY = dy / d;
  const dirZ = dz / d;

  let nx = pos.x + dirX * stepDist;
  let ny = pos.y + dirY * stepDist + bobY;
  let nz = pos.z + dirZ * stepDist;
  const minGroundY = terrainHeight(nx, nz) + 0.16;
  if (ny < minGroundY) ny = minGroundY;

  const lookDist = Math.min(d, 0.75);
  const lx = pos.x + dirX * lookDist;
  const lz = pos.z + dirZ * lookDist;
  const ly = Math.max(terrainHeight(lx, lz) + 0.16, pos.y + dirY * lookDist);

  if (!isBeeBlockedAt3D(ctx, nx, ny, nz, r, ignoreHiveBox) &&
    !isBeeBlockedAt3D(ctx, lx, ly, lz, r, ignoreHiveBox)) {
    pos.set(nx, ny, nz);
    if (dx * dx + dz * dz > 1e-6) bee.group.rotation.y = Math.atan2(dx, dz);
    return d;
  }

  // Se a abelha iniciou dentro/sobreposta a um obstáculo ou colmeia, permite sair imediatamente para ponto livre mais próximo
  if (isBeeBlockedAt3D(ctx, pos.x, pos.y, pos.z, r, ignoreHiveBox) &&
    !isBeeBlockedAt3D(ctx, nx, ny, nz, r * 0.45, ignoreHiveBox)) {
    pos.set(nx, ny, nz);
    if (dx * dx + dz * dz > 1e-6) bee.group.rotation.y = Math.atan2(dx, dz);
    return d;
  }

  const horizLen = Math.hypot(dx, dz);
  const hDirX = horizLen > 1e-4 ? dx / horizLen : 1;
  const hDirZ = horizLen > 1e-4 ? dz / horizLen : 0;
  const baseAngle = Math.atan2(hDirX, hDirZ);
  const sidePref = bee.avoidSide || 1;
  const steerStep = Math.max(stepDist, Math.min(d, speed * dt));

  for (let aIdx = 0; aIdx < BEE_STEER_MAGS.length; aIdx++) {
    const deltaAng = sidePref * BEE_STEER_MAGS[aIdx];
    const ang = baseAngle + deltaAng;
    const sx = Math.sin(ang);
    const sz = Math.cos(ang);
    const cx = pos.x + sx * steerStep;
    const cz = pos.z + sz * steerStep;
    const cy = Math.max(terrainHeight(cx, cz) + 0.16, pos.y + dirY * steerStep * 0.5 + bobY);
    const alx = pos.x + sx * 0.65;
    const alz = pos.z + sz * 0.65;
    const aly = Math.max(terrainHeight(alx, alz) + 0.16, pos.y + dirY * 0.35);
    if (!isBeeBlockedAt3D(ctx, cx, cy, cz, r, ignoreHiveBox) &&
      !isBeeBlockedAt3D(ctx, alx, aly, alz, r, ignoreHiveBox)) {
      pos.set(cx, cy, cz);
      bee.avoidSide = deltaAng >= 0 ? 1 : -1;
      bee.group.rotation.y = Math.atan2(sx, sz);
      return d;
    }
  }

  // Todos os desvios horizontais bloqueados -> sobe suavemente por cima do obstáculo
  const climbStep = speed * 0.85 * dt;
  let climbY = pos.y + climbStep;
  let cx = pos.x + hDirX * stepDist * 0.35;
  let cz = pos.z + hDirZ * stepDist * 0.35;
  if (isBeeBlockedAt3D(ctx, cx, climbY, cz, r, ignoreHiveBox)) {
    cx = pos.x;
    cz = pos.z;
    if (isBeeBlockedAt3D(ctx, cx, climbY, cz, r, ignoreHiveBox)) {
      climbY = pos.y + climbStep * 1.25;
    }
  }
  const minGroundClimb = terrainHeight(cx, cz) + 0.16;
  if (climbY < minGroundClimb) climbY = minGroundClimb;
  pos.set(cx, climbY, cz);
  if (horizLen > 1e-4) bee.group.rotation.y = Math.atan2(dx, dz);
  return d;
}

function removeDeployedEcologyPickable(ctx, item, dynamicKind) {
  if (!ctx || !item) return;
  item._removedForSync = true;
  if (ctx.pendingMovedItems && item.id) {
    ctx.pendingMovedItems[item.id] = {
      id: item.id,
      state: { custom: { dynamicKind, removed: true } }
    };
  }
  if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
  if (THREE && THREE.Object3D && typeof disposeObjectResources === 'function') {
    try { disposeObjectResources(item.mesh); } catch (_) {}
  }
  if (Array.isArray(ctx.pickableItems)) {
    const idx = ctx.pickableItems.indexOf(item);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  }
  if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(item.id);
  }
}

function deployStarterBeehiveItem(ctx, item) {
  if (!ctx || !item || !item.starterBeehiveCtrl || item.starterBeehiveCtrl.deployed) return false;
  const pos = (item.mesh && item.mesh.position) ? item.mesh.position : { x: 0, y: 0, z: 0 };
  const spot = findNearestHiveMountSpot(ctx, pos.x, pos.z);
  if (!spot) {
    if (!item.starterBeehiveCtrl.warnedFull) {
      item.starterBeehiveCtrl.warnedFull = true;
      ctx.callbacks?.onToast?.('🐝 Todas as árvores e beirais próximos já possuem colmeias!');
    }
    return false;
  }
  item.starterBeehiveCtrl.deployed = true;
  const hiveId = 'hive_buy_' + Date.now().toString(36) + '_' + ((ctx.beehives && ctx.beehives.length) || 0);
  const newHive = createHiveAtSpot(ctx, hiveId, spot, {
    honeyLevel: 15,
    migrating: true,
    buildProgress: 0.25
  });
  spawnHiveSwarm(ctx, newHive, { x: pos.x, y: pos.y, z: pos.z }, ((ctx.beehives && ctx.beehives.length) || 1));
  if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: pos.x, y: pos.y + 0.25, z: pos.z }, 0xfacc15, 8);
  removeDeployedEcologyPickable(ctx, item, 'beehive_starter');
  ctx.notifyWorldAction?.();
  ctx.callbacks?.onToast?.(`🐝 Enxame liberado! A Rainha e as abelhas estão migrando para ${spot.label}!`);
  queueBeeEcologySync(ctx, true);
  return true;
}

function triggerBeeBaitItem(ctx, item) {
  if (!ctx || !item || !item.beeBaitCtrl || item.beeBaitCtrl.triggered) return false;
  const pos = (item.mesh && item.mesh.position) ? item.mesh.position : { x: 0, y: 0, z: 0 };
  const spot = findNearestHiveMountSpot(ctx, pos.x, pos.z);
  if (!spot) {
    if (!item.beeBaitCtrl.warnedFull) {
      item.beeBaitCtrl.warnedFull = true;
      ctx.callbacks?.onToast?.('🍯 Não há mais árvores ou beirais livres para atrair novo enxame!');
    }
    return false;
  }
  item.beeBaitCtrl.triggered = true;
  const hiveId = 'hive_bait_' + Date.now().toString(36) + '_' + ((ctx.beehives && ctx.beehives.length) || 0);
  const newHive = createHiveAtSpot(ctx, hiveId, spot, {
    honeyLevel: 12,
    migrating: true,
    buildProgress: 0.25
  });
  const arrivalX = spot.x + (spot.x >= 0 ? 10 : -10);
  const arrivalZ = spot.z + 8;
  spawnHiveSwarm(ctx, newHive, { x: arrivalX, y: terrainHeight(arrivalX, arrivalZ) + 4.5, z: arrivalZ }, ((ctx.beehives && ctx.beehives.length) || 2));
  if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: pos.x, y: pos.y + 0.2, z: pos.z }, 0xfbbf24, 10);
  removeDeployedEcologyPickable(ctx, item, 'bee_bait');
  ctx.notifyWorldAction?.();
  ctx.callbacks?.onToast?.(`🐝🍯 A Isca atraiu um novo enxame para ${spot.label}!`);
  queueBeeEcologySync(ctx, true);
  return true;
}

function isInsideBuildingRoof(ctx, x, y, z) {
  const zones = ctx && Array.isArray(ctx.roofZones) ? ctx.roofZones : null;
  if (!zones || !zones.length) return false;
  for (let i = 0; i < zones.length; i++) {
    const rz = zones[i];
    if (!rz) continue;
    const margin = 0.6;
    if (x >= rz.minX + margin && x <= rz.maxX - margin &&
        z >= rz.minZ + margin && z <= rz.maxZ - margin &&
        y < (rz.roofY || 4.0) - 0.35) {
      return true;
    }
  }
  return false;
}

function stepDeployableBeeItems(ctx, dt) {
  const items = ctx && Array.isArray(ctx.pickableItems) ? ctx.pickableItems : null;
  if (!items || !items.length) return;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!it || it._removedForSync || ctx.heldItem === it || it.crateParent) continue;
    const pos = (it.mesh && it.mesh.position) ? it.mesh.position : { x: 0, y: 0, z: 0 };
    if (isInsideBuildingRoof(ctx, pos.x, pos.y, pos.z)) continue;
    if (it.starterBeehiveCtrl && !it.starterBeehiveCtrl.deployed) {
      it.starterBeehiveCtrl.placedTimer = (it.starterBeehiveCtrl.placedTimer || 0) + dt;
      if (it.starterBeehiveCtrl.placedTimer >= 2.2) {
        deployStarterBeehiveItem(ctx, it);
      }
    } else if (it.beeBaitCtrl && !it.beeBaitCtrl.triggered) {
      let hasFlowersNear = false;
      if (Array.isArray(ctx.campusFlowers)) {
        for (let fi = 0; fi < ctx.campusFlowers.length; fi++) {
          const fl = ctx.campusFlowers[fi];
          if (fl && !fl.removed && fl.stage === 'blooming' && Math.hypot(fl.x - pos.x, fl.z - pos.z) <= 14) {
            hasFlowersNear = true;
            break;
          }
        }
      }
      const rate = hasFlowersNear ? 1.5 : 1.0;
      it.beeBaitCtrl.lureTimer = (it.beeBaitCtrl.lureTimer || 0) + dt * rate;
      if (it.beeBaitCtrl.lureTimer >= 15.0) {
        triggerBeeBaitItem(ctx, it);
      }
    }
  }
}

export function stepPastureBees(ctx, dt) {
  if (!ctx) return;
  const nowSec = performance.now() * 0.001;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;
  const isNight = typeof ctx.sunElevation === 'number'
    ? (ctx.sunElevation < -0.05)
    : (typeof window !== 'undefined' && !!window.campusIsNight);
  const isDeepNight = typeof ctx.sunElevation === 'number'
    ? (ctx.sunElevation < -0.28)
    : (typeof window !== 'undefined' && !!window.campusIsNight);

  // Ciclo de vida das flores silvestres + itens compráveis no chão (colmeia nova / isca de abelhas)
  stepCampusFlowers(ctx, dt, nowSec);
  stepDeployableBeeItems(ctx, dt);

  // Atualiza colmeias (construção, brilho de mel, descanso no chão, extinção, migração)
  if (ctx.beehives) {
    for (let hi = 0; hi < ctx.beehives.length; hi++) {
      const hive = ctx.beehives[hi];
      if (hive.collected || hive.abandoned || hive.extinct) continue;

      if (!hive.migrating && hive.buildProgress < 1.0) {
        hive.buildProgress = Math.min(1.0, hive.buildProgress + dt * 0.12);
        if (hive.group) {
          hive.group.visible = true;
          if (hive.group.scale?.setScalar) hive.group.scale.setScalar(Math.max(0.2, hive.buildProgress));
        }
      }

      if (hive.honeyDropMesh) {
        hive.honeyDropMesh.visible = hive.buildProgress >= 0.8 && hive.honeyLevel >= 35;
        if (hive.honeyDropMesh.visible && hive.honeyDropMesh.scale?.set) {
          const dropScale = 0.7 + (hive.honeyLevel / 100) * 0.6;
          hive.honeyDropMesh.scale.set(1, dropScale, 1);
        }
      }

      if (hive.groundResting) {
        let recoveredFlowers = 0;
        refreshHiveFlowers(ctx, hive, 14.0);
        for (let fi = 0; fi < hive.flowersNearby.length; fi++) {
          const fl = hive.flowersNearby[fi];
          if (fl && !fl.removed && fl.stage === 'blooming' && fl.pollen > 0.001) recoveredFlowers++;
        }
        if (recoveredFlowers > 0 && !isNight) {
          hive.groundResting = false;
          hive.exhaustionTimer = 0;
          hive.failedMigrations = 0;
        } else {
          hive.exhaustionTimer = (hive.exhaustionTimer || 0) + dt;
          if (hive.exhaustionTimer >= 30.0) {
            extinguishHiveColony(ctx, hive);
          }
        }
        continue;
      }

      // Verifica se ainda existem flores em floração ou brotando perto da colmeia
      if (!hive.migrating && hive.buildProgress >= 1.0) {
        let availableFlowers = 0;
        let upcomingSprouts = 0;
        for (let fi = 0; fi < hive.flowersNearby.length; fi++) {
          const fl = hive.flowersNearby[fi];
          if (!fl || fl.removed) continue;
          if (fl.stage === 'blooming' && fl.pollen > 0.001) availableFlowers++;
          else if (fl.stage === 'sprouting' || (fl.stage === 'seeding' && !fl.seedHarvested)) upcomingSprouts++;
        }
        if (availableFlowers === 0 && upcomingSprouts === 0) {
          hive.noPollenTimer += dt;
          if (hive.noPollenTimer > 5.0) {
            hive.noPollenTimer = 0;
            startHiveMigration(ctx, hive, isNight);
          }
        } else {
          hive.noPollenTimer = 0;
        }
      }
    }
  }

  ctx._beeSyncAccum = (ctx._beeSyncAccum || 0) + dt;
  if (ctx._beeSyncAccum >= 12.0) {
    ctx._beeSyncAccum = 0;
    queueBeeEcologySync(ctx, false);
  }

  if (!ctx.pastureBees || !ctx.pastureBees.length) return;
  const a = (THREE && THREE.MeshStandardMaterial) ? getBeeSharedAssets() : null;

  for (let i = ctx.pastureBees.length - 1; i >= 0; i--) {
    const bee = ctx.pastureBees[i];
    const hive = bee.hive;
    if (!hive || hive.abandoned || hive.extinct || hive.collected) {
      if (bee && bee.group && bee.group.parent) bee.group.parent.remove(bee.group);
      ctx.pastureBees.splice(i, 1);
      continue;
    }

    const dist = Math.hypot(px - bee.group.position.x, pz - bee.group.position.z);
    bee.group.visible = dist <= 65;
    if (!bee.group.visible) continue;

    bee.phase += dt * (bee.speed || 1.4);
    const flapSpeed = (hive.groundResting || isNight) ? 14 : 42;
    const flapAmp = (hive.groundResting || isNight) ? 0.28 : 0.75;
    const flap = Math.sin(nowSec * flapSpeed + i * 1.7) * flapAmp;
    if (bee.wingL?.rotation) bee.wingL.rotation.z = flap;
    if (bee.wingR?.rotation) bee.wingR.rotation.z = -flap;
    if (bee.legs && bee.legs.length) {
      for (let li = 0; li < bee.legs.length; li++) {
        bee.legs[li].rotation.x = Math.sin(nowSec * 18 + i + li * 0.6) * 0.25;
      }
    }

    // 0. Enxame exausto descansando no chão durante a noite / falta severa de flores
    if (hive.groundResting && hive.groundRestPos) {
      if (bee.migrationSprite) bee.migrationSprite.visible = false;
      if (bee.pollenMesh) bee.pollenMesh.visible = false;
      const gp = hive.groundRestPos;
      const ox = bee.isQueen ? 0 : Math.cos(i * 2.1 + bee.phase * 0.25) * 0.48;
      const oz = bee.isQueen ? 0 : Math.sin(i * 2.1 + bee.phase * 0.25) * 0.48;
      const gx = gp.x + ox;
      const gz = gp.z + oz;
      const gy = terrainHeight(gx, gz) + 0.14 + Math.sin(nowSec * 2.6 + i) * 0.03;
      moveBeeSafely(ctx, bee, gx, gy, gz, 1.8, dt, 0, null);
      if (bee.group.rotation) bee.group.rotation.x = 0.04;
      continue;
    }

    // 1. Voo de migração em enxame com a Rainha
    if (hive.migrating) {
      if (bee.isQueen) {
        if (bee.migrationSprite) bee.migrationSprite.visible = dist <= 18;
        const tx = hive.x;
        const ty = hive.y + 0.55;
        const tz = hive.z;
        const arrivalDist = Math.hypot(
          tx - bee.group.position.x,
          ty - bee.group.position.y,
          tz - bee.group.position.z
        );
        if (arrivalDist < 0.65) {
          hive.migrating = false;
          if (hive.group) {
            hive.group.visible = true;
            if (hive.group.scale?.setScalar) hive.group.scale.setScalar(hive.buildProgress);
          }
          if (bee.migrationSprite) bee.migrationSprite.visible = false;
          bee.state = 'orbit';
          refreshHiveFlowers(ctx, hive);
          for (let bi = 0; bi < hive.bees.length; bi++) {
            hive.bees[bi].state = 'to_flower';
            hive.bees[bi].stateTimer = 0.5 + bi * 0.6;
          }
          queueBeeEcologySync(ctx, true);
        } else {
          const targetY = arrivalDist > 4.5
            ? Math.max(ty, terrainHeight(bee.group.position.x, bee.group.position.z) + 6.5)
            : ty;
          moveBeeSafely(ctx, bee, tx, targetY, tz, 4.2, dt, Math.sin(nowSec * 5) * 0.01, null);
          bee.group.rotation.x = 0.14;
        }
      } else {
        const q = hive.queen;
        const qx = q ? q.group.position.x : hive.x;
        const qy = q ? q.group.position.y : hive.y + 0.5;
        const qz = q ? q.group.position.z : hive.z;
        const ox = Math.cos(bee.phase * 1.6 + i) * 0.85;
        const oy = Math.sin(bee.phase * 2.2 + i) * 0.35 - 0.15;
        const oz = Math.sin(bee.phase * 1.4 + i) * 0.85;
        moveBeeSafely(ctx, bee, qx + ox, qy + oy, qz + oz, 5.2, dt, 0, null);
        bee.group.rotation.x = 0.14;
      }
      continue;
    }

    // 2. Rainha orbita suavemente ao redor da colmeia (fora do tronco e da caixa)
    if (bee.isQueen) {
      if (bee.migrationSprite) bee.migrationSprite.visible = false;
      const t = bee.phase * (isDeepNight ? 0.45 : 1.0);
      const rad = isDeepNight ? 0.92 : 1.18;
      const qx = hive.x + 0.42 + Math.cos(t) * rad;
      const qz = hive.z + 0.35 + Math.sin(t) * rad;
      const qy = hive.y + (isDeepNight ? 0.22 : 0.48) + Math.sin(t * 2.5) * 0.16;
      moveBeeSafely(ctx, bee, qx, qy, qz, isDeepNight ? 1.5 : 2.4, dt, 0, hive);
      bee.group.rotation.x = Math.sin(t * 2.5) * 0.10;
      continue;
    }

    // 3. Noite profunda: operárias descansam ao redor da colmeia sem se amontoar no tronco
    if (isDeepNight) {
      if (bee.pollenMesh) bee.pollenMesh.visible = false;
      const t = bee.phase * 0.48 + i * 2.09;
      const restRad = 1.15 + (i % 3) * 0.24;
      const rx = hive.x + 0.42 + Math.cos(t) * restRad;
      const rz = hive.z + 0.38 + Math.sin(t) * restRad;
      const ry = hive.y + 0.06 + (i % 2) * 0.18 + Math.sin(nowSec * 2 + i) * 0.06;
      moveBeeSafely(ctx, bee, rx, ry, rz, 1.8, dt, 0, hive);
      bee.group.rotation.x = 0;
      continue;
    }

    // 4. Operárias: forrageio entre colmeia e flores próximas
    if (bee.pollenMesh) bee.pollenMesh.visible = !!bee.hasPollen;

    if (hive.buildProgress < 1.0) {
      // Orbitando e construindo a nova colmeia sem atravessar obstáculos
      const t = bee.phase + i * 1.9;
      const nx = hive.x + 0.42 + Math.cos(t) * (1.05 + (i % 3) * 0.22);
      const nz = hive.z + 0.36 + Math.sin(t) * (1.05 + (i % 3) * 0.22);
      const ny = hive.y + Math.sin(t * 3.0) * 0.28;
      moveBeeSafely(ctx, bee, nx, ny, nz, 2.6, dt, 0, hive);
      bee.group.rotation.x = 0;
      continue;
    }

    if (bee.state === 'to_flower') {
      if (!bee.targetFlower || bee.targetFlower.removed || bee.targetFlower.stage !== 'blooming' || bee.targetFlower.pollen <= 0.001) {
        let candidates = hive.flowersNearby.filter((fl) => fl && !fl.removed && fl.stage === 'blooming' && fl.pollen > 0.001);
        if (!candidates.length) {
          refreshHiveFlowers(ctx, hive, 18.0);
          candidates = hive.flowersNearby.filter((fl) => fl && !fl.removed && fl.stage === 'blooming' && fl.pollen > 0.001);
        }
        bee.targetFlower = candidates.length
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : null;
      }
      if (!bee.targetFlower) {
        // Sem flores disponíveis -> orbita livremente fora da colmeia aguardando brotos ou migração
        const t = bee.phase + i * 2.05;
        const nx = hive.x + 0.45 + Math.cos(t) * bee.radius;
        const nz = hive.z + 0.40 + Math.sin(t) * bee.radius;
        const ny = hive.y + Math.sin(t * 2.8) * 0.26;
        moveBeeSafely(ctx, bee, nx, ny, nz, 2.6, dt, 0, hive);
        bee.group.rotation.x = 0;
      } else {
        const fl = bee.targetFlower;
        const flDist = Math.hypot(
          fl.x - bee.group.position.x,
          (fl.y + 0.14) - bee.group.position.y,
          fl.z - bee.group.position.z
        );
        if (flDist < 0.32) {
          bee.state = 'collect';
          bee.stateTimer = 1.1;
          bee.group.rotation.x = 0;
        } else {
          const nearHome = Math.hypot(bee.group.position.x - hive.x, bee.group.position.z - hive.z) < 1.25;
          moveBeeSafely(ctx, bee, fl.x, fl.y + 0.14, fl.z, 3.0, dt, Math.sin(nowSec * 9 + i) * 0.008, nearHome ? hive : null);
          bee.group.rotation.x = 0.16;
        }
      }
    } else if (bee.state === 'collect') {
      bee.group.rotation.x = 0;
      bee.stateTimer -= dt;
      if (bee.targetFlower && !bee.targetFlower.removed && bee.targetFlower.stage === 'blooming') {
        bee.group.position.y = bee.targetFlower.y + 0.14 + Math.sin(nowSec * 14) * 0.04;
        bee.group.rotation.y += dt * 4.2;
      } else {
        bee.targetFlower = null;
        bee.state = 'to_flower';
        continue;
      }
      if (bee.stateTimer <= 0) {
        if (bee.targetFlower && !bee.targetFlower.removed) {
          const nextPollen = Math.max(0, Math.round((bee.targetFlower.pollen - FLOWER_POLLEN_PER_VISIT) * 100) / 100);
          bee.targetFlower.pollen = nextPollen;
          if (nextPollen <= 0.001) {
            transitionFlowerToSeeding(bee.targetFlower, a);
          }
        }
        bee.hasPollen = true;
        bee.state = 'to_hive';
      }
    } else if (bee.state === 'to_hive') {
      const tx = hive.x;
      const ty = hive.y - 0.08;
      const tz = hive.z + 0.44;
      const d = Math.hypot(
        tx - bee.group.position.x,
        ty - bee.group.position.y,
        tz - bee.group.position.z
      );
      if (d < 0.44) {
        bee.hasPollen = false;
        hive.honeyLevel = Math.min(100, (hive.honeyLevel || 0) + 12);
        if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: hive.x, y: hive.y, z: hive.z }, 0xfacc15, 5);
        bee.targetFlower = null;
        bee.state = 'to_flower';
        bee.group.rotation.x = 0;
      } else {
        moveBeeSafely(ctx, bee, tx, ty, tz, 2.8, dt, Math.sin(nowSec * 8 + i) * 0.008, hive);
        bee.group.rotation.x = 0.16;
      }
    }
  }

  // Separação suave entre abelhas para nunca formarem aglomerado sólido em um único ponto
  for (let i = 0; i < ctx.pastureBees.length; i++) {
    const aBee = ctx.pastureBees[i];
    if (!aBee || !aBee.group || !aBee.group.visible) continue;
    const pa = aBee.group.position;
    for (let j = i + 1; j < ctx.pastureBees.length; j++) {
      const bBee = ctx.pastureBees[j];
      if (!bBee || !bBee.group || !bBee.group.visible || aBee.hive !== bBee.hive) continue;
      const pb = bBee.group.position;
      const sdx = pa.x - pb.x;
      const sdy = pa.y - pb.y;
      const sdz = pa.z - pb.z;
      const dSq = sdx * sdx + sdy * sdy + sdz * sdz;
      if (dSq < 0.21) {
        const d = Math.sqrt(dSq);
        const ux = d > 1e-4 ? (sdx / d) : (i % 2 === 0 ? 1 : -1);
        const uz = d > 1e-4 ? (sdz / d) : (j % 2 === 0 ? 1 : -1);
        const push = (0.46 - d) * 0.35;
        pa.x += ux * push;
        pa.z += uz * push;
        pb.x -= ux * push;
        pb.z -= uz * push;
      }
    }
  }
}

// ============================================================================
// INTERAÇÃO E COLHEITA DE MEL / COLMEIA ABANDONADA
// ============================================================================
function isHoneyContainer(held) {
  if (!held) return false;
  if (held.lcNutrientCtrl) return true;
  if (held.mesh && held.mesh.userData && held.mesh.userData.liquidCtrl && !held.spawnCtrl) return true;
  if (held.spawnCtrl && !held.spawnCtrl.filled && !held.spawnCtrl.isBag) return true;
  return false;
}

export function findHoveredBeehive(raycaster, ctx) {
  if (!raycaster || !ctx || !ctx.beehiveHitMeshes || !ctx.beehiveHitMeshes.length) return null;
  const hits = raycaster.intersectObjects(ctx.beehiveHitMeshes, false);
  const hit = firstUnoccludedRayHit(ctx, hits, 5.5, { checkWalls: true });
  if (hit && hit.object && hit.object.userData && hit.object.userData.hiveObj) {
    const hive = hit.object.userData.hiveObj;
    if (hive.collected) return null;
    ctx.hoverHit = hit;
    return hive;
  }
  return null;
}

export function getBeehiveHoverPrompt(hive, held) {
  if (!hive || hive.collected) return '';
  if (hive.abandoned && hive.canCollectAbandoned) {
    return held
      ? (hive.extinct ? '🥀 Colmeia Extinta — Esvazie a mão para recolher' : '🪹 Colmeia Abandonada — Esvazie a mão para recolher')
      : (hive.extinct ? '🥀 Colmeia Extinta — Levar p/ Compostagem' : '🪹 Colmeia Abandonada — Levar p/ Compostagem');
  }
  if (hive.groundResting) return '🌙🐝 Enxame descansando no chão (Sem flores!)';
  if (hive.migrating) return '🐝 Enxame migrando!';
  if (hive.buildProgress < 1.0) {
    return `🐝 Colmeia em construção (${Math.round(hive.buildProgress * 100)}%)`;
  }
  const honeyPct = Math.round(hive.honeyLevel || 0);
  if (honeyPct >= 35 && isHoneyContainer(held)) {
    return `🍯 Colher Mel Natural (Colmeia: ${honeyPct}%)`;
  }
  return `🐝 Colmeia (Mel: ${honeyPct}%)`;
}

function createAbandonedHiveCompostItem(ctx, hive) {
  const a = getBeeSharedAssets();
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), a.hiveAbandonedMat);
  box.position.y = 0.14;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.295, 0.06, 0.295), a.hiveAbandonedBandMat);
  band.position.y = 0.09;
  g.add(box, band);

  const itemId = 'compost_hive_' + (hive.id || '0') + '_' + Math.floor(performance.now());
  const item = registerPickable(
    ctx,
    itemId,
    '🪹 Colmeia Seca (Leve à Caixa de Substrato da Horta)',
    g,
    hive.x,
    hive.y,
    hive.z,
    0,
    0.18,
    0.28,
    {
      category: 'spent_substrate',
      purpose: 'Colmeia seca abandonada; excelente material orgânico para a Caixa de Substrato da Horta',
      weightGrams: 420,
      compatibilities: { canEnterCooker: false, isSpentMushroomCake: true }
    }
  );
  item.spentCakeCtrl = { speciesName: 'Colmeia Seca' };
  item.compostHiveCtrl = { hiveId: hive.id };
  return item;
}

export function getBeehiveInspectInfo(hive) {
  if (!hive) return null;
  const flowers = Array.isArray(hive.flowersNearby) ? hive.flowersNearby.filter((fl) => fl && !fl.removed) : [];
  const totalFlowers = flowers.length;
  let activeFlowers = 0;
  for (let i = 0; i < totalFlowers; i++) {
    if (flowers[i].stage === 'blooming' && flowers[i].pollen > 0.001) activeFlowers++;
  }
  const honeyPct = Math.round(hive.honeyLevel || 0);
  const buildPct = Math.round((hive.buildProgress || 0) * 100);
  let status = 'healthy';
  if (hive.abandoned) status = 'abandoned';
  else if (hive.migrating) status = 'migrating';
  else if (hive.buildProgress < 1.0) status = 'building';
  else if (activeFlowers === 0) status = 'starving';
  else if (activeFlowers < 3) status = 'surviving';
  return { honeyPct, activeFlowers, totalFlowers, status, buildPct };
}

export function interactBeehive(ctx, hive) {
  if (!ctx || !hive || hive.collected) return false;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  const held = ctx.heldItem;

  // 1. Recolher colmeia abandonada para compostagem na Horta
  if (hive.abandoned && hive.canCollectAbandoned) {
    if (held) {
      onToast?.('👐 Esvazie a mão para recolher a colmeia seca!');
      return true;
    }
    const item = createAbandonedHiveCompostItem(ctx, hive);
    hive.collected = true;
    hive.canCollectAbandoned = false;
    hive.group.visible = false;
    if (hive.hitMesh && hive.hitMesh.userData) hive.hitMesh.userData.ignoreRay = true;

    ctx.heldItem = item;
    ctx.lastPickupAt = performance.now();
    ctx.callbacks?.onHoldChange?.(item.label);
    onToast?.('🪹 Colmeia seca recolhida! Leve à Caixa de Substrato da Horta.');
    queueBeeEcologySync(ctx, true);
    return true;
  }

  if (hive.migrating || hive.buildProgress < 1.0) {
    onToast?.('🐝 As abelhas ainda estão construindo esta colmeia!');
    return true;
  }

  // 2. Colheita de Mel Natural
  if ((hive.honeyLevel || 0) < 35) {
    onToast?.(`🐝 Colmeia com pouco mel (${Math.round(hive.honeyLevel || 0)}%). Aguarde as abelhas coletarem pólen!`);
    return true;
  }

  if (!isHoneyContainer(held)) {
    onToast?.('🍯 Segure um frasco de Cultura Líquida, Béquer, Nutriente CL ou Pote vazio para colher Mel!');
    return true;
  }

  if (held.lcNutrientCtrl) {
    const maxG = held.lcNutrientCtrl.maxGrams || 250;
    held.lcNutrientCtrl.remainingGrams = Math.min(maxG, (held.lcNutrientCtrl.remainingGrams || 0) + 50);
    updateLcNutrientLabel(held);
    ctx.callbacks?.onHoldChange?.(held.label);
    onToast?.('🍯 Mel Natural adicionado ao frasco de Nutriente CL! (+50g)');
  } else if (held.mesh && held.mesh.userData && held.mesh.userData.liquidCtrl && !held.spawnCtrl) {
    const lc = held.mesh.userData.liquidCtrl;
    const nextMl = Math.min(lc.maxMl || 800, (lc.volMl || 0) + 100);
    if (held.setVolume) held.setVolume(nextMl);
    else lc.volMl = nextMl;
    if (held.cultureCtrl) {
      held.cultureCtrl.hasNutrient = true;
      if (!held.cultureCtrl.contaminated && !held.cultureCtrl.colonized && lc.liqMesh?.material?.color) {
        lc.liqMesh.material.color.setHex(0xf59e0b);
      }
      updateCultureLiquidLabel(held);
    } else {
      held.label = `${lc.baseLabel || 'Recipiente'} (${Math.round(lc.volMl)}ml • 🍯 Mel Natural)`;
    }
    ctx.callbacks?.onHoldChange?.(held.label);
    onToast?.('🍯 Mel Natural colhido! (+100ml de nutriente pronto para Cultura Líquida)');
  } else if (held.spawnCtrl && !held.spawnCtrl.filled && !held.spawnCtrl.isBag) {
    held.lcNutrientCtrl = { remainingGrams: 120, maxGrams: 250, isNaturalHoney: true };
    held.label = '🍯 Pote com Mel Natural (120g • Nutriente CL 4%)';
    if (held.mesh && held.mesh.userData) {
      held.mesh.userData.isLcNutrientBottle = true;
      held.mesh.userData.pickableLabel = held.label;
    }
    ctx.callbacks?.onHoldChange?.(held.label);
    onToast?.('🍯 Pote de vidro preenchido com Mel Natural! (Nutriente CL 4%)');
  }

  hive.honeyLevel = Math.max(0, (hive.honeyLevel || 0) - 35);
  triggerCozyHeartBurst(hive.x, hive.y + 0.35, hive.z, 0xfacc15);
  queueBeeEcologySync(ctx, true);
  return true;
}

// ============================================================================
// FLORES SILVESTRES, INSPEÇÃO DE PÓLEN, SEMENTES E PLANTIO
// ============================================================================
export function updateFlowerSeedLabel(item) {
  if (!item || !item.flowerSeedCtrl) return;
  const count = Math.max(0, Math.round(item.flowerSeedCtrl.count || 0));
  item.label = `🌱 Sementes de Flor (${count} un.)`;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function makeFlowerSeedPacket(ctx, id, x, y, z, opts = {}) {
  const count = Math.max(1, Math.min(20, opts.count ?? 5));
  const meta = {
    category: 'gardening',
    purpose: 'Pacote de sementes de flores silvestres; mire na grama natural para plantar e alimentar abelhas.',
    compatibilities: { canEnterCooker: false },
    serializeState: (it) => ({
      flowerSeeds: it && it.flowerSeedCtrl ? Math.max(0, Math.round(it.flowerSeedCtrl.count || 0)) : 0
    }),
    applyState: (it, custom) => {
      if (!it || !custom || typeof custom.flowerSeeds !== 'number') return;
      it.flowerSeedCtrl = it.flowerSeedCtrl || { count: 5, maxCount: 20 };
      it.flowerSeedCtrl.count = Math.max(1, Math.min(20, Math.round(custom.flowerSeeds)));
      updateFlowerSeedLabel(it);
    }
  };

  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial) {
    const mockItem = {
      id,
      label: `🌱 Sementes de Flor (${count} un.)`,
      flowerSeedCtrl: { count, maxCount: 20 },
      mesh: {
        position: { x, y, z, set() {} },
        userData: { isFlowerSeedPacket: true }
      },
      meta
    };
    if (ctx && Array.isArray(ctx.pickableItems)) ctx.pickableItems.push(mockItem);
    return mockItem;
  }

  const a = getBeeSharedAssets();
  const g = new THREE.Group();

  const body = new THREE.Mesh(a.seedPackBodyGeo, a.seedPackBodyMat);
  body.position.y = 0.075;
  const trim = new THREE.Mesh(a.seedPackTrimGeo, a.seedPackTrimMat);
  trim.position.y = 0.132;

  const emblemCenter = new THREE.Mesh(a.centerGeo, a.flowerCenterMat);
  emblemCenter.scale.setScalar(0.32);
  emblemCenter.position.set(0, 0.068, 0.015);
  const emblemMat = a.petalMats[(opts.colorIdx || 0) % a.petalMats.length];
  for (let p = 0; p < 5; p++) {
    const ang = (p / 5) * Math.PI * 2;
    const ep = new THREE.Mesh(a.petalGeo, emblemMat);
    ep.scale.set(0.32, 0.32, 0.18);
    ep.position.set(Math.cos(ang) * 0.019, 0.068 + Math.sin(ang) * 0.019, 0.014);
    g.add(ep);
  }

  g.add(body, trim, emblemCenter);
  g.userData.isFlowerSeedPacket = true;
  markSubtreeDynamic(g);

  const label = `🌱 Sementes de Flor (${count} un.)`;
  const item = registerPickable(ctx, id, label, g, x, y, z, opts.ry || 0, 0.08, 0.15, meta);
  item.flowerSeedCtrl = { count, maxCount: 20 };
  updateFlowerSeedLabel(item);
  return item;
}

export function findHoveredFlower(raycaster, ctx) {
  if (!raycaster || !ctx || !ctx.flowerHitMeshes || !ctx.flowerHitMeshes.length) return null;
  const hits = raycaster.intersectObjects(ctx.flowerHitMeshes, false);
  const hit = firstUnoccludedRayHit(ctx, hits, 4.2, { checkWalls: true });
  if (hit && hit.object && hit.object.userData && hit.object.userData.flowerObj) {
    const fl = hit.object.userData.flowerObj;
    if (fl.removed || fl.stage === 'wilting') return null;
    ctx.hoverHit = hit;
    return fl;
  }
  return null;
}

export function getFlowerHoverPrompt(fl, held) {
  if (!fl || fl.removed) return '';
  if (fl.stage === 'seeding' && !fl.seedHarvested) {
    if (!held || held.flowerSeedCtrl) {
      return '🌾 Flor (Semente Pronta!) — Colher Semente';
    }
    return '🌾 Flor (Semente Pronta!) — Esvazie a mão para colher';
  }
  if (fl.stage === 'sprouting') {
    const pct = Math.max(0, Math.min(100, Math.round((fl.stageTimer / (fl.sproutDuration || 18)) * 100)));
    return `🌱 Broto de Flor (${pct}%)`;
  }
  const pollenPct = Math.max(0, Math.min(100, Math.round((fl.pollen || 0) * 100)));
  return `🌸 Flor Silvestre (Pólen: ${pollenPct}%)`;
}

export function getFlowerInspectInfo(fl) {
  if (!fl || fl.removed) return null;
  const pollenPct = Math.max(0, Math.min(100, Math.round((fl.pollen || 0) * 100)));
  const growthPct = fl.stage === 'sprouting'
    ? Math.max(0, Math.min(100, Math.round((fl.stageTimer / (fl.sproutDuration || 18)) * 100)))
    : 100;
  const seedTimeLeftSec = fl.stage === 'seeding'
    ? Math.max(0, Math.ceil((fl.seedHoldDuration || 25) - (fl.stageTimer || 0)))
    : 0;
  const colorName = FLOWER_COLOR_NAMES[fl.colorIdx] || 'Silvestre';
  return {
    stage: fl.stage,
    pollenPct,
    growthPct,
    seedTimeLeftSec,
    colorName,
    seedHarvested: !!fl.seedHarvested
  };
}

export function interactFlower(ctx, fl) {
  if (!ctx || !fl || fl.removed) return false;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  const held = ctx.heldItem;
  const win = typeof window !== 'undefined' ? window : null;

  if (fl.stage === 'seeding' && !fl.seedHarvested) {
    if (held && !held.flowerSeedCtrl) {
      onToast?.('👐 Esvazie a mão ou segure Sementes de Flor para colher esta semente!');
      return true;
    }

    if (held && held.flowerSeedCtrl) {
      const maxC = held.flowerSeedCtrl.maxCount || 20;
      if ((held.flowerSeedCtrl.count || 0) >= maxC) {
        onToast?.('🎒 Seu pacote de sementes já está cheio (20 un.)!');
        return true;
      }
      held.flowerSeedCtrl.count = Math.min(maxC, (held.flowerSeedCtrl.count || 0) + 1);
      updateFlowerSeedLabel(held);
      ctx.callbacks?.onHoldChange?.(held.label);
      ctx.markItemMoved?.(held);
      ctx.notifyWorldAction?.();
    } else {
      const id = 'dyn_flower_seeds_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 999);
      const item = makeFlowerSeedPacket(ctx, id, fl.x, fl.y, fl.z, { count: 1, colorIdx: fl.colorIdx });
      item.isMoved = true;
      ctx.heldItem = item;
      ctx.lastPickupAt = performance.now();
      ctx.callbacks?.onHoldChange?.(item.label);
      ctx.markItemMoved?.(item);
      ctx.notifyWorldAction?.();
    }

    fl.seedHarvested = true;
    if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
    fl.stage = 'wilting';
    fl.stageTimer = 0;
    if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: fl.x, y: fl.y, z: fl.z }, 0x4ade80, 6);
    if (win && win.MycoAudio) win.MycoAudio.playClick();
    onToast?.('🌾 Semente colhida! Esta flor não vai se espalhar e vai murchar.');
    queueBeeEcologySync(ctx, true);
    return true;
  }

  if (fl.stage === 'sprouting') {
    const pct = Math.max(0, Math.min(100, Math.round((fl.stageTimer / (fl.sproutDuration || 18)) * 100)));
    onToast?.(`🌱 Broto de Flor crescendo (${pct}%). Em breve atrairá as abelhas!`);
    return true;
  }

  if (fl.stage === 'blooming') {
    const pollenPct = Math.max(0, Math.min(100, Math.round((fl.pollen || 0) * 100)));
    onToast?.(`🌸 Flor Silvestre (${pollenPct}% de pólen • pressione F para inspecionar).`);
    return true;
  }

  return true;
}

export function findFlowerPlantSpot(raycaster, ctx) {
  if (!raycaster || !raycaster.ray) return null;
  const ro = raycaster.ray.origin;
  const rd = raycaster.ray.direction;
  if (!ro || !rd || rd.y >= -0.05) return null;

  let t = (terrainHeight(ro.x, ro.z) - ro.y) / rd.y;
  if (!Number.isFinite(t) || t < 0.45 || t > 5.2) return null;

  let x = ro.x + rd.x * t;
  let z = ro.z + rd.z * t;
  const gy = terrainHeight(x, z);
  const t2 = (gy - ro.y) / rd.y;
  if (Number.isFinite(t2) && t2 >= 0.45 && t2 <= 5.2) {
    t = t2;
    x = ro.x + rd.x * t;
    z = ro.z + rd.z * t;
  }
  const finalY = terrainHeight(x, z);

  if (ctx && isRayOccludedByStructure(ctx, t, { checkWalls: true })) return null;
  if (!isNaturalSoilSpot(x, z, 0.55) || isBlockedAt(ctx || {}, x, z, 0.45)) return null;
  if (ctx && ctx.campusFlowers) {
    for (let i = 0; i < ctx.campusFlowers.length; i++) {
      const fl = ctx.campusFlowers[i];
      if (fl && !fl.removed && Math.hypot(fl.x - x, fl.z - z) < 0.45) return null;
    }
  }

  if (_flowerPlantHit.point.set) _flowerPlantHit.point.set(x, finalY, z);
  else {
    _flowerPlantHit.point.x = x;
    _flowerPlantHit.point.y = finalY;
    _flowerPlantHit.point.z = z;
  }
  _flowerPlantHit.distance = t;
  if (ctx) ctx.hoverHit = _flowerPlantHit;
  return { x, y: finalY, z, distance: t };
}

export function getFlowerPlantHoverPrompt(held) {
  const count = held && held.flowerSeedCtrl ? Math.max(0, Math.round(held.flowerSeedCtrl.count || 0)) : 0;
  return `🌱 Plantar Semente de Flor aqui (${count} un.)`;
}

export function plantFlowerSeedAtSpot(ctx, spot) {
  if (!ctx || !spot || !ctx.heldItem || !ctx.heldItem.flowerSeedCtrl) return false;
  const held = ctx.heldItem;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  const win = typeof window !== 'undefined' ? window : null;

  if ((held.flowerSeedCtrl.count || 0) <= 0) return false;
  if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = [];
  if (ctx.campusFlowers.length >= MAX_CAMPUS_FLOWERS) {
    onToast?.('🌸 O campus já está cheio de flores! Aguarde algumas murcharem.');
    return true;
  }

  const colorIdx = Math.floor(Math.random() * FLOWER_COLORS.length);
  const sprout = createCampusFlower(ctx, spot.x, spot.z, colorIdx, {
    stage: 'sprouting',
    sproutDuration: 10 + Math.random() * 14
  });
  ctx.campusFlowers.push(sprout);
  refreshAllHiveFlowers(ctx);
  queueBeeEcologySync(ctx, true);
  if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: spot.x, y: spot.y + 0.15, z: spot.z }, 0x4ade80, 6);
  if (win && win.MycoAudio) win.MycoAudio.playClick();

  held.flowerSeedCtrl.count = Math.max(0, (held.flowerSeedCtrl.count || 0) - 1);
  if (held.flowerSeedCtrl.count <= 0) {
    removeDeployedEcologyPickable(ctx, held, 'flower_seeds');
    ctx.heldItem = null;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    ctx.callbacks?.onHoldChange?.(null);
    ctx.notifyWorldAction?.();
    onToast?.('🌸 Última semente plantada! A flor vai brotar em breve.');
  } else {
    updateFlowerSeedLabel(held);
    ctx.callbacks?.onHoldChange?.(held.label);
    ctx.markItemMoved?.(held);
    ctx.notifyWorldAction?.();
    onToast?.(`🌱 Semente de flor plantada! (${held.flowerSeedCtrl.count} restantes)`);
  }
  return true;
}

// ============================================================================
// ITENS COMPRÁVEIS: COLMEIA INICIAL NO CHÃO & ISCA DE ABELHAS
// ============================================================================
export function makeStarterBeehiveItem(ctx, id, x, y, z, opts = {}) {
  const meta = {
    category: 'gardening',
    purpose: 'Coloque no chão perto de uma árvore ou beiral de casa: a Rainha e as abelhas migram rapidamente para o alto!',
    compatibilities: { canEnterCooker: false },
    serializeState: (it) => ({
      dynamicKind: 'beehive_starter',
      deployed: !!(it && it.starterBeehiveCtrl && it.starterBeehiveCtrl.deployed),
      removed: !!(it && (it._removedForSync || (it.starterBeehiveCtrl && it.starterBeehiveCtrl.deployed)))
    }),
    applyState: (it, custom) => {
      if (!it || !custom) return;
      if (custom.deployed && it.starterBeehiveCtrl) it.starterBeehiveCtrl.deployed = true;
    }
  };

  const label = '🐝 Colmeia Nova (Coloque no chão)';
  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial) {
    const mockItem = {
      id,
      label,
      starterBeehiveCtrl: { placedTimer: 0, deployed: false },
      mesh: {
        position: { x, y, z, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } },
        userData: { isStarterBeehive: true }
      },
      meta
    };
    if (ctx && Array.isArray(ctx.pickableItems)) ctx.pickableItems.push(mockItem);
    return mockItem;
  }

  const a = getBeeSharedAssets();
  const vis = buildHiveVisualGroup();
  const g = vis.hiveGroup;
  g.scale.setScalar(0.56);
  // Desloca visual interno para que a base da caixinha repouse no chão (y = 0)
  for (let i = 0; i < g.children.length; i++) {
    g.children[i].position.y += 0.34;
  }
  const crateBase = new THREE.Mesh(a.hivePorchGeo, a.hiveDarkMat);
  crateBase.scale.set(1.9, 1.4, 3.6);
  crateBase.position.y = 0.028;
  g.add(crateBase);
  g.userData.isStarterBeehive = true;
  markSubtreeDynamic(g);

  const item = registerPickable(ctx, id, label, g, x, y, z, opts.ry || 0, 0.22, 0.36, meta);
  item.starterBeehiveCtrl = { placedTimer: 0, deployed: false };
  return item;
}

export function makeBeeBaitItem(ctx, id, x, y, z, opts = {}) {
  const meta = {
    category: 'gardening',
    purpose: 'Isca aromática com mel e néctar: coloque no solo perto de flores para atrair um novo enxame selvagem.',
    compatibilities: { canEnterCooker: false },
    serializeState: (it) => ({
      dynamicKind: 'bee_bait',
      triggered: !!(it && it.beeBaitCtrl && it.beeBaitCtrl.triggered),
      removed: !!(it && (it._removedForSync || (it.beeBaitCtrl && it.beeBaitCtrl.triggered)))
    }),
    applyState: (it, custom) => {
      if (!it || !custom) return;
      if (custom.triggered && it.beeBaitCtrl) it.beeBaitCtrl.triggered = true;
    }
  };

  const label = '🍯 Isca de Abelhas (Coloque ao ar livre)';
  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial) {
    const mockItem = {
      id,
      label,
      beeBaitCtrl: { lureTimer: 0, triggered: false },
      mesh: {
        position: { x, y, z, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } },
        userData: { isBeeBait: true }
      },
      meta
    };
    if (ctx && Array.isArray(ctx.pickableItems)) ctx.pickableItems.push(mockItem);
    return mockItem;
  }

  const a = getBeeSharedAssets();
  const g = new THREE.Group();
  const saucer = new THREE.Mesh(a.crownBaseGeo, a.hiveDarkMat);
  saucer.scale.set(2.1, 1.2, 2.1);
  saucer.position.y = 0.02;
  const honeyPool = new THREE.Mesh(a.hiveBandMidGeo, a.honeyMat);
  honeyPool.scale.set(0.32, 0.38, 0.32);
  honeyPool.position.y = 0.065;
  const flowerDot = new THREE.Mesh(a.centerGeo, a.petalMats[0]);
  flowerDot.scale.setScalar(0.75);
  flowerDot.position.set(0, 0.11, 0);
  const twig = new THREE.Mesh(a.hiveLeafGeo, a.hiveLeafMat);
  twig.scale.set(0.9, 0.55, 0.4);
  twig.position.set(0.06, 0.12, 0.03);
  g.add(saucer, honeyPool, flowerDot, twig);
  g.userData.isBeeBait = true;
  markSubtreeDynamic(g);

  const item = registerPickable(ctx, id, label, g, x, y, z, opts.ry || 0, 0.15, 0.18, meta);
  item.beeBaitCtrl = { lureTimer: 0, triggered: false };
  return item;
}
