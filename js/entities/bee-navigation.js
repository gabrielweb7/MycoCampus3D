/**
 * Navegação 3D, Colisão por Obstáculo, Voo de Forrageio e Separação das Abelhas (MycoCampus3D).
 */

import { terrainHeight } from '../engine/physics.js';
import { spawnCampusFxBurst } from '../engine/fx-burst.js';
import { FLOWER_POLLEN_PER_VISIT, transitionFlowerToSeeding } from '../world/campus-flowers.js';
import { refreshHiveFlowers, queueBeeEcologySync } from '../world/ecology-shared.js';

const BEE_STEER_MAGS = [0.95, -0.95, 1.55, -1.55];
const BEE_COLLISION_RADIUS = 0.15;

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
  const r = BEE_COLLISION_RADIUS;
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
  let cx = pos.x + hDirX * stepDist * 0.35;
  let cz = pos.z + hDirZ * stepDist * 0.35;
  let climbY = Math.max(terrainHeight(cx, cz) + 0.16, pos.y + climbStep);
  if (isBeeBlockedAt3D(ctx, cx, climbY, cz, r, ignoreHiveBox)) {
    cx = pos.x;
    cz = pos.z;
    climbY = Math.max(terrainHeight(cx, cz) + 0.16, pos.y + climbStep);
    if (isBeeBlockedAt3D(ctx, cx, climbY, cz, r, ignoreHiveBox)) return d;
  }
  pos.set(cx, climbY, cz);
  if (horizLen > 1e-4) bee.group.rotation.y = Math.atan2(dx, dz);
  return d;
}

export function isInsideBuildingRoof(ctx, x, y, z) {
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

export function stepSingleBeeFlight(ctx, bee, i, dt, nowSec, px, pz, isNight, isDeepNight) {
  const hive = bee.hive;
  const dist = Math.hypot(px - bee.group.position.x, pz - bee.group.position.z);

  // Sono: de noite profunda cada abelha entra na colmeia, uma por uma, e some. De dia sai e volta ao trabalho.
  if (isDeepNight && !hive.migrating && !hive.groundResting) {
    bee.nightTimer = (bee.nightTimer || 0) + dt;
    if (bee.sleepDelay === undefined) bee.sleepDelay = bee.isQueen ? 16 + Math.random() * 4 : 1 + Math.random() * 14;
    if (bee.nightTimer > bee.sleepDelay) {
      if (!bee.sleeping) {
        const entering = Math.hypot(hive.x - bee.group.position.x, hive.y - bee.group.position.y, hive.z - bee.group.position.z);
        if (entering < 0.5 || dist > 65 || bee.nightTimer > bee.sleepDelay + 8) {
          bee.sleeping = true;
          if (bee.pollenMesh) bee.pollenMesh.visible = false;
          if (bee.migrationSprite) bee.migrationSprite.visible = false;
          bee.group.position.set(hive.x, hive.y, hive.z);
        } else {
          bee.phase += dt * (bee.speed || 1.4);
          moveBeeSafely(ctx, bee, hive.x, hive.y, hive.z, 3.2, dt, 0, hive);
          return;
        }
      }
      bee.group.visible = false;
      return;
    }
  } else if (bee.sleeping || bee.nightTimer) {
    bee.sleeping = false;
    bee.nightTimer = 0;
    bee.sleepDelay = undefined;
    bee.state = 'to_flower';
    bee.stateTimer = Math.random() * 3;
  }

  bee.group.visible = dist <= 65;
  if (!bee.group.visible && !hive.migrating) return;

  bee.phase += dt * (bee.speed || 1.4);
  if (bee.group.visible) {
    const resting = hive.groundResting || isNight;
    const flap = Math.sin(nowSec * (resting ? 14 : 42) + i * 1.7) * (resting ? 0.28 : 0.75);
    if (bee.wingL?.rotation) bee.wingL.rotation.z = flap;
    if (bee.wingR?.rotation) bee.wingR.rotation.z = -flap;
    if (bee.legs && bee.legs.length) {
      for (let li = 0; li < bee.legs.length; li++) {
        bee.legs[li].rotation.x = Math.sin(nowSec * 18 + i + li * 0.6) * 0.25;
      }
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
    return;
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
    return;
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
    return;
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
    return;
  }

  // 4. Operárias: forrageio entre colmeia e flores próximas
  if (bee.pollenMesh) bee.pollenMesh.visible = !!bee.hasPollen;

  if (hive.buildProgress < 1.0) {
    const t = bee.phase + i * 1.9;
    const nx = hive.x + 0.42 + Math.cos(t) * (1.05 + (i % 3) * 0.22);
    const nz = hive.z + 0.36 + Math.sin(t) * (1.05 + (i % 3) * 0.22);
    const ny = hive.y + Math.sin(t * 3.0) * 0.28;
    moveBeeSafely(ctx, bee, nx, ny, nz, 2.6, dt, 0, hive);
    bee.group.rotation.x = 0;
    return;
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
      return;
    }
    if (bee.stateTimer <= 0) {
      if (bee.targetFlower && !bee.targetFlower.removed) {
        const nextPollen = Math.max(0, Math.round((bee.targetFlower.pollen - FLOWER_POLLEN_PER_VISIT) * 100) / 100);
        bee.targetFlower.pollen = nextPollen;
        if (nextPollen <= 0.001) {
          transitionFlowerToSeeding(bee.targetFlower);
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

export function separateHiveBees(ctx) {
  const { pastureBees } = ctx;
  for (let i = 0; i < pastureBees.length; i++) {
    const aBee = pastureBees[i];
    if (!aBee || !aBee.group || !aBee.group.visible) continue;
    const pa = aBee.group.position;
    for (let j = i + 1; j < pastureBees.length; j++) {
      const bBee = pastureBees[j];
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
        const ax = pa.x + ux * push;
        const az = pa.z + uz * push;
        const bx = pb.x - ux * push;
        const bz = pb.z - uz * push;
        if (!isBeeBlockedAt3D(ctx, ax, pa.y, az, BEE_COLLISION_RADIUS)) pa.set(ax, pa.y, az);
        if (!isBeeBlockedAt3D(ctx, bx, pb.y, bz, BEE_COLLISION_RADIUS)) pb.set(bx, pb.y, bz);
      }
    }
  }
}
