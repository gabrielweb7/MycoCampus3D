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
import { disposeObjectResources } from '../items/item-registry.js';
import { triggerCozyHeartBurst } from '../world/cozy-details.js';
import {
  COW_POOP_INTERVAL_SEC,
  POOP_CUBENSIS_GROW_SEC,
  POOP_TOTAL_LIFETIME_SEC,
  MAX_ACTIVE_POOPS,
  PASTURE_BOUNDS,
  PASTURE_TROUGH_POS,
  HERD_MIGRATION_LEG_SEC,
  HERD_MIGRATION_ROUTE,
  hash01,
  isInsideTownOrRoad,
  isCowBlockedAt,
  isCowPositionWalkable,
  getHerdRouteIndex,
  findSafePasturePoint,
  serializeBeehives,
  serializeCampusFlowers,
  queueBeeEcologySync
} from '../world/ecology-shared.js';
import { createCuteCowMesh, createPoopWithFliesAndCubensis } from './cow-models.js';
import { registerShotTarget } from '../systems/shot-targets.js';
import {
  FLOWER_COLORS,
  FLOWER_COLOR_NAMES,
  FLOWER_POLLEN_PER_VISIT,
  MAX_CAMPUS_FLOWERS,
  createCampusFlower,
  disperseFlowerSeed,
  stepCampusFlowers,
  updateFlowerSeedLabel,
  makeFlowerSeedPacket,
  findHoveredFlower,
  getFlowerHoverPrompt,
  getFlowerInspectInfo,
  interactFlower,
  findFlowerPlantSpot,
  getFlowerPlantHoverPrompt,
  plantFlowerSeedAtSpot
} from '../world/campus-flowers.js';
import { isBeeBlockedAt3D, moveBeeSafely } from './bee-navigation.js';
import {
  findNearestHiveMountSpot,
  createHiveAtSpot,
  applyBeeEcologyWorldState,
  extinguishHiveColony,
  getBeeEcologySummary,
  createPastureBees,
  startHiveMigration,
  stepPastureBees,
  findHoveredBeehive,
  getBeehiveHoverPrompt,
  getBeehiveInspectInfo,
  interactBeehive,
  makeStarterBeehiveItem,
  makeBeeBaitItem
} from './bee-ecology.js';

const THREE = window.THREE;

const COW_NAMES = ['Mimosa', 'Estrela', 'Pipoca', 'Bela', 'Malhada', 'Flor'];
const COW_STEER_OFFSETS = [0.45, 0.9, 1.4, 2.05, -0.45, -0.9, -1.4, -2.05, Math.PI];
const COW_UNSTICK_RINGS = [1.5, 3.0, 5.0, 8.0];

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
      state: 'wander',
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
    registerShotTarget(ctx, cowVis.group, {
      radius: 0.62, depth: 1.18, halfHeight: 0.69, centerY: 0.79,
      active: () => !cowObj.abducted,
      onHit: (_sim, source) => {
        cowObj.shotFleeFrom = { x: source.x, z: source.z };
        cowObj.happyTimer = cowObj.curiousTimer = cowObj.grazeTimer = 0;
        cowObj.fleeTimer = 5;
      }
    });
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
  cowObj.shotFleeFrom = null;
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
      if (cow.fleeTimer <= 0) {
        cow.lastBucket = -1;
        cow.shotFleeFrom = null;
      }
    }
    if (cow.curiousCooldown > 0) cow.curiousCooldown = Math.max(0, cow.curiousCooldown - dt);
    if (cow.avoidTimer > 0) cow.avoidTimer = Math.max(0, cow.avoidTimer - dt);
    if (cow.grazeTimer > 0) {
      cow.grazeTimer = Math.max(0, cow.grazeTimer - dt);
      if (cow.grazeTimer <= 0) cow.lastBucket = -1;
    }

    let desiredYaw = cow.yaw;
    let herdPullApplied = false;

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
      desiredYaw = Math.atan2(cx - (cow.shotFleeFrom?.x ?? px), cz - (cow.shotFleeFrom?.z ?? pz));
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

      if (p.ageSec > POOP_TOTAL_LIFETIME_SEC - 5) {
        const fade = Math.max(0.05, (POOP_TOTAL_LIFETIME_SEC - p.ageSec) / 5);
        p.group.scale.setScalar(fade);
      }
    }

    if (p.myceliumGroup) {
      const mycFrac = Math.min(1, Math.max(0.08, p.ageSec / 10));
      p.myceliumGroup.scale.set(mycFrac, 1, mycFrac);
    }

    if (p.ageSec >= 10 && p.mushParts && (!p.grown || p.wildEntry.active)) {
      p.cubensisGroup.visible = true;
      const pinFrac = Math.min(1, (p.ageSec - 10) / 10);
      const growFrac = Math.min(1, Math.max(0, (p.ageSec - 20) / 10));
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

// Re-exportações para compatibilidade com importadores existentes
export {
  COW_POOP_INTERVAL_SEC,
  POOP_CUBENSIS_GROW_SEC,
  POOP_TOTAL_LIFETIME_SEC,
  MAX_ACTIVE_POOPS,
  PASTURE_BOUNDS,
  PASTURE_TROUGH_POS,
  HERD_MIGRATION_LEG_SEC,
  HERD_MIGRATION_ROUTE,
  isInsideTownOrRoad,
  isCowBlockedAt,
  isCowPositionWalkable,
  getHerdRouteIndex,
  findSafePasturePoint,
  FLOWER_COLORS,
  FLOWER_COLOR_NAMES,
  FLOWER_POLLEN_PER_VISIT,
  MAX_CAMPUS_FLOWERS,
  createCampusFlower,
  disperseFlowerSeed,
  stepCampusFlowers,
  updateFlowerSeedLabel,
  makeFlowerSeedPacket,
  findHoveredFlower,
  getFlowerHoverPrompt,
  getFlowerInspectInfo,
  interactFlower,
  findFlowerPlantSpot,
  getFlowerPlantHoverPrompt,
  plantFlowerSeedAtSpot,
  findNearestHiveMountSpot,
  createHiveAtSpot,
  serializeBeehives,
  serializeCampusFlowers,
  queueBeeEcologySync,
  applyBeeEcologyWorldState,
  extinguishHiveColony,
  getBeeEcologySummary,
  startHiveMigration,
  isBeeBlockedAt3D,
  moveBeeSafely,
  stepPastureBees,
  findHoveredBeehive,
  getBeehiveHoverPrompt,
  getBeehiveInspectInfo,
  interactBeehive,
  makeStarterBeehiveItem,
  makeBeeBaitItem
};
