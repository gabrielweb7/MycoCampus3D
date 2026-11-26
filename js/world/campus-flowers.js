/**
 * Flores Silvestres, Ciclo de Pólen, Sementes e Plantio no Campus (MycoCampus3D).
 */

import { terrainHeight } from '../engine/physics.js';
import { disposeObjectResources, registerPickable } from '../items/item-registry.js';
import { spawnCampusFxBurst } from '../engine/fx-burst.js';
import { isNaturalSoilSpot } from './nature-plaza.js';
import { firstUnoccludedRayHit, isRayOccludedByStructure } from '../systems/ray-occlusion.js';
import {
  isBlockedAt,
  markAllShared,
  markSubtreeDynamic,
  removeDeployedEcologyPickable,
  refreshAllHiveFlowers,
  queueBeeEcologySync
} from './ecology-shared.js';

const THREE = window.THREE;

export const FLOWER_COLORS = [0xf472b6, 0xa855f7, 0xef4444, 0x38bdf8, 0xfb923c, 0xf8fafc];
export const FLOWER_COLOR_NAMES = ['Rosa', 'Lavanda', 'Vermelha', 'Azul', 'Laranja', 'Branca'];
export const FLOWER_POLLEN_PER_VISIT = 0.10;
export const MAX_CAMPUS_FLOWERS = 110;

let flowerIdSeq = 0;
let flowerSharedAssets = null;

const _flowerPlantHit = {
  point: THREE && THREE.Vector3 ? new THREE.Vector3() : { x: 0, y: 0, z: 0 },
  distance: 0
};

export function getFlowerSharedAssets() {
  if (flowerSharedAssets) return flowerSharedAssets;
  flowerSharedAssets = markAllShared({
    stemMat: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 }),
    flowerCenterMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }),
    flowerCenterEmptyMat: new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 }),
    petalMats: FLOWER_COLORS.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65 })),
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
    seedPackTrimMat: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.58 })
  });
  return flowerSharedAssets;
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
    return {
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
  }

  const a = getFlowerSharedAssets();
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

export function transitionFlowerToSeeding(fl, sharedAssets = null) {
  const a = sharedAssets || ((THREE && THREE.MeshStandardMaterial) ? getFlowerSharedAssets() : null);
  fl.pollen = 0;
  fl.stage = 'seeding';
  fl.stageTimer = 0;
  fl.seedHarvested = false;
  if (fl.centerMesh) {
    if (a && a.flowerCenterEmptyMat) fl.centerMesh.material = a.flowerCenterEmptyMat;
    if (fl.centerMesh.scale?.setScalar) fl.centerMesh.scale.setScalar(0.72);
  }
  if (fl.petalGroup?.scale?.set) fl.petalGroup.scale.set(0.86, 0.72, 0.86);
  if (fl.seedPodMesh) fl.seedPodMesh.visible = true;
}

export function removeCampusFlower(ctx, fl) {
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
  const a = (THREE && THREE.MeshStandardMaterial) ? getFlowerSharedAssets() : null;

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
        if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
        fl.stage = 'wilting';
        fl.stageTimer = 0;
        const sprout = fl.seedHarvested ? null : disperseFlowerSeed(ctx, fl);
        if (!sprout) queueBeeEcologySync(ctx, true);
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

export function applyCampusFlowersState(ctx, flowersJson) {
  if (!ctx || typeof flowersJson !== 'string' ||
      flowersJson === ctx._lastAppliedFlowers ||
      flowersJson === ctx._lastSentFlowers) {
    return false;
  }
  try {
    const parsed = JSON.parse(flowersJson);
    if (!Array.isArray(parsed)) return false;
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
    ctx._lastAppliedFlowers = flowersJson;
    ctx._lastSentFlowers = flowersJson;
    return true;
  } catch (_) {
    return false;
  }
}

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

  const a = getFlowerSharedAssets();
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

const flowerRayOptions = {
  checkWalls: true,
  acceptHit(hit) {
    const flower = hit.object?.userData?.flowerObj;
    return !!flower && !flower.removed && flower.stage !== 'wilting';
  }
};

export function findHoveredFlower(raycaster, ctx) {
  if (!raycaster || !ctx || !ctx.flowerHitMeshes || !ctx.flowerHitMeshes.length) return null;
  const hits = raycaster.intersectObjects(ctx.flowerHitMeshes, false);
  const hit = firstUnoccludedRayHit(ctx, hits, 4.2, flowerRayOptions);
  if (!hit) return null;
  ctx.hoverHit = hit;
  return hit.object.userData.flowerObj;
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
