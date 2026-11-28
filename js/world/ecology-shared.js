/**
 * Utilitários compartilhados entre Pastagem, Vaquinhas, Flores Silvestres e Ecologia de Abelhas.
 * Reúne constantes espaciais, detecção de bloqueio no solo, helpers de recursos compartilhados e serialização.
 */

import { disposeObjectResources } from '../items/item-registry.js';
import { isNaturalSoilSpot } from './nature-plaza.js';

const THREE = window.THREE;

export const COW_POOP_INTERVAL_SEC = 30;
export const POOP_CUBENSIS_GROW_SEC = 30;
export const POOP_TOTAL_LIFETIME_SEC = 120; // 30s crescendo + 90s disponível antes de desaparecer
export const MAX_ACTIVE_POOPS = 18;

export const PASTURE_BOUNDS = { minX: -84, maxX: 84, minZ: -78, maxZ: 78 };
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

export const CAMPUS_HIVE_CANDIDATES = [
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

export function hash01(a, b) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function isInsideTownOrRoad(x, z) {
  // Mantém vaquinhas, cocôs e Cubensis longe da cidade, prédios, quadras, estradas e concreto
  if (Math.abs(x) < 38 && Math.abs(z) < 32) return true;
  if (!isNaturalSoilSpot(x, z, 1.2)) return true;
  return false;
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

export const isBlockedAt = isCowBlockedAt;

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

export function markAllShared(obj) {
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

export function markSubtreeDynamic(root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse((o) => {
    if (o && o.userData) {
      o.userData.isDynamic = true;
      o.userData.noMerge = true;
    }
  });
}

export function removeDeployedEcologyPickable(ctx, item, dynamicKind) {
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

export function refreshHiveFlowers(ctx, hive, maxRadius = 18.0) {
  if (!ctx || !hive) return [];
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

export function refreshAllHiveFlowers(ctx) {
  if (!ctx || !ctx.beehives) return;
  for (let i = 0; i < ctx.beehives.length; i++) {
    const h = ctx.beehives[i];
    if (h && !h.abandoned && !h.collected) refreshHiveFlowers(ctx, h);
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
      m: h.mountType === 'eaves' || h.mountType === 'trunk' ? h.mountType : 'tree',
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
