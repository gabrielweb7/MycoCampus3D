/**
 * Ecologia de Colmeias, Enxames, Migração, Extinção, Mel e Itens Compráveis (MycoCampus3D).
 */

import { terrainHeight } from '../engine/physics.js';
import { registerPickable } from '../items/item-registry.js';
import { spawnCampusFxBurst } from '../engine/fx-burst.js';
import { isNaturalSoilSpot } from '../world/nature-plaza.js';
import { VILLAGE_LOTS, VILLAGE_HOUSE } from '../core/village-layout.js';
import { triggerCozyHeartBurst } from '../world/cozy-details.js';
import { firstUnoccludedRayHit } from '../systems/ray-occlusion.js';
import { updateCultureLiquidLabel } from '../items/liquid-culture.js';
import { updateLcNutrientLabel } from '../items/pda-bottle.js';
import {
  CAMPUS_HIVE_CANDIDATES,
  hash01,
  isBlockedAt,
  markSubtreeDynamic,
  removeDeployedEcologyPickable,
  refreshHiveFlowers,
  refreshAllHiveFlowers,
  serializeBeehives,
  serializeCampusFlowers,
  queueBeeEcologySync
} from '../world/ecology-shared.js';
import {
  createCampusFlower,
  stepCampusFlowers,
  applyCampusFlowersState
} from '../world/campus-flowers.js';
import {
  getBeeSharedAssets,
  createCuteBeeMesh,
  spawnTreeWithHiveSlot,
  buildHiveVisualGroup
} from './bee-models.js';
import {
  isBeeBlockedAt3D,
  moveBeeSafely,
  isInsideBuildingRoof,
  stepSingleBeeFlight,
  separateHiveBees
} from './bee-navigation.js';

const THREE = window.THREE;

export {
  serializeBeehives,
  serializeCampusFlowers,
  queueBeeEcologySync,
  isBeeBlockedAt3D,
  moveBeeSafely
};

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

export function applyBeeEcologyWorldState(ctx, stateMap) {
  if (!ctx || !stateMap) return false;
  let appliedAny = applyCampusFlowersState(ctx, stateMap.campus_flowers);

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

export function createPastureBees(ctx) {
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

  stepCampusFlowers(ctx, dt, nowSec);
  stepDeployableBeeItems(ctx, dt);

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
  for (let i = ctx.pastureBees.length - 1; i >= 0; i--) {
    const bee = ctx.pastureBees[i];
    const hive = bee.hive;
    if (!hive || hive.abandoned || hive.extinct || hive.collected) {
      if (bee && bee.group && bee.group.parent) bee.group.parent.remove(bee.group);
      ctx.pastureBees.splice(i, 1);
      continue;
    }
    stepSingleBeeFlight(ctx, bee, i, dt, nowSec, px, pz, isNight, isDeepNight);
  }
  separateHiveBees(ctx);
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

function getHoneyContainerSpace(held) {
  const nutrient = held.lcNutrientCtrl;
  if (nutrient) return (nutrient.maxGrams || 250) - (nutrient.remainingGrams || 0);
  const liquid = held.mesh?.userData?.liquidCtrl;
  if (liquid && !held.spawnCtrl) return (liquid.maxMl || 800) - (liquid.volMl || 0);
  return Infinity;
}

const hiveRayOptions = {
  checkWalls: true,
  acceptHit(hit) {
    const hive = hit.object?.userData?.hiveObj;
    return !!hive && !hive.collected && hive.group?.visible !== false;
  }
};

export function findHoveredBeehive(raycaster, ctx) {
  if (!raycaster || !ctx || !ctx.beehiveHitMeshes || !ctx.beehiveHitMeshes.length) return null;
  const hits = raycaster.intersectObjects(ctx.beehiveHitMeshes, false);
  const hit = firstUnoccludedRayHit(ctx, hits, 5.5, hiveRayOptions);
  if (!hit) return null;
  ctx.hoverHit = hit;
  return hit.object.userData.hiveObj;
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
    if (getHoneyContainerSpace(held) <= 0) return '🍯 Recipiente cheio';
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

  if ((hive.honeyLevel || 0) < 35) {
    onToast?.(`🐝 Colmeia com pouco mel (${Math.round(hive.honeyLevel || 0)}%). Aguarde as abelhas coletarem pólen!`);
    return true;
  }

  if (!isHoneyContainer(held)) {
    onToast?.('🍯 Segure um frasco de Cultura Líquida, Béquer, Nutriente CL ou Pote vazio para colher Mel!');
    return true;
  }
  const space = getHoneyContainerSpace(held);
  if (space <= 0) {
    onToast?.('🍯 O recipiente está cheio.');
    return true;
  }

  if (held.lcNutrientCtrl) {
    const added = Math.min(50, space);
    held.lcNutrientCtrl.remainingGrams = (held.lcNutrientCtrl.remainingGrams || 0) + added;
    updateLcNutrientLabel(held);
    ctx.callbacks?.onHoldChange?.(held.label);
    onToast?.(`🍯 Mel Natural adicionado ao frasco (+${added}g).`);
  } else if (held.mesh && held.mesh.userData && held.mesh.userData.liquidCtrl && !held.spawnCtrl) {
    const lc = held.mesh.userData.liquidCtrl;
    const previousMl = lc.volMl || 0;
    const nextMl = previousMl + Math.min(100, space);
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
    const added = Math.round((lc.volMl - previousMl) * 10) / 10;
    onToast?.(`🍯 Mel Natural colhido (+${added}ml).`);
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
  ctx.queueItemStateSync?.(held);
  triggerCozyHeartBurst(hive.x, hive.y + 0.35, hive.z, 0xfacc15);
  queueBeeEcologySync(ctx, true);
  return true;
}

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
