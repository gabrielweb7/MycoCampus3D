/**
 * MycoCampus3D — Motor de Física, Terreno, Superfícies & Colisões
 */
import { makeBox } from './textures.js';

export function terrainHeight(x, z) {
  const distCenter = Math.max(Math.abs(x) - 76, Math.abs(z - 1) - 50);
  if (distCenter <= 0) return 0;
  const blend = Math.min(1, distCenter / 24);

  const r = Math.hypot(x, z);
  let mtn = 0;
  if (r > 120) {
    const mt = Math.min(1, (r - 120) / 55);
    const ridge = Math.abs(Math.sin(x * 0.032 + z * 0.021) * Math.cos(z * 0.028 - x * 0.017));
    mtn = mt * mt * (14 + ridge * 26);
  }

  const hills = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.4 + Math.sin(x * 0.11 + z * 0.09) * 0.7;
  return blend * hills + mtn;
}

export function getGroundHeight(ctx, x, z, refY, ignoreSurf) {
  let h = terrainHeight(x, z);
  const curY = refY !== undefined ? refY : ctx.playerPos.y;

  const { stairsList, walkableFloors, supportSurfaces, heldItem } = ctx;

  for (let s = 0; s < stairsList.length; s++) {
    const st = stairsList[s];
    if (x >= st.minX && x <= st.maxX && z <= Math.max(st.zStart, st.zEnd) && z >= Math.min(st.zStart, st.zEnd)) {
      let t = (z - st.zStart) / (st.zEnd - st.zStart);
      t = Math.max(0, Math.min(1, t));
      const sy = st.yStart + t * (st.yEnd - st.yStart);
      if (curY >= sy - 1.2) h = Math.max(h, sy);
    }
  }

  for (let f = 0; f < walkableFloors.length; f++) {
    const fl = walkableFloors[f];
    if (x >= fl.minX && x <= fl.maxX && z >= fl.minZ && z <= fl.maxZ) {
      if (curY >= fl.topY - 1.1) h = Math.max(h, fl.topY);
    }
  }

  for (let u = 0; u < supportSurfaces.length; u++) {
    const ss = supportSurfaces[u];
    if (ignoreSurf && ss === ignoreSurf) continue;
    if (heldItem && heldItem.mesh && heldItem.mesh.userData.dynamicSurface === ss) continue;
    const sW = ss.maxX - ss.minX;
    const sD = ss.maxZ - ss.minZ;
    if (sW < 0.35 || sD < 0.35) continue;
    if (x >= ss.minX - 0.08 && x <= ss.maxX + 0.08 && z >= ss.minZ - 0.08 && z <= ss.maxZ + 0.08) {
      if (curY >= ss.topY - 0.40) h = Math.max(h, ss.topY);
    }
  }

  return h;
}

export function getSupportSurfaceAt(ctx, x, z, margin, ignoreSurf, maxTopY) {
  const m = (typeof margin === 'number') ? margin : 0.08;
  let best = null;
  const { supportSurfaces, heldItem } = ctx;
  for (let u = 0; u < supportSurfaces.length; u++) {
    const ss = supportSurfaces[u];
    if (ignoreSurf && ss === ignoreSurf) continue;
    if (typeof maxTopY === 'number' && ss.topY > maxTopY) continue;
    if (heldItem && heldItem.mesh && heldItem.mesh.userData.dynamicSurface === ss) continue;
    if (x >= ss.minX - m && x <= ss.maxX + m && z >= ss.minZ - m && z <= ss.maxZ + m) {
      if (!best || ss.topY > best.topY) best = ss;
    }
  }
  return best;
}

export function getItemGroundHeight(ctx, x, z, refY, ignoreSurf, maxTopY) {
  const gh = getGroundHeight(ctx, x, z, refY !== undefined ? refY : 3.0, ignoreSurf);
  const ss = getSupportSurfaceAt(ctx, x, z, 0.08, ignoreSurf, maxTopY);
  if (ss && ss.topY > gh) return ss.topY;
  return gh;
}

export function getSurfaceTypeAt(x, y, z) {
  if ((x >= 8 && x <= 14 && z >= 30 && z <= 55) || (z >= 34 && z <= 52 && Math.abs(x) < 18)) return 'wood';
  if ((x >= -24 && x <= 26 && z >= -24 && z <= 24 && y >= 0.12) || (x >= 40 && x <= 65 && z >= -20 && z <= 30)) return 'lab';
  if ((Math.abs(x) < 24 && Math.abs(z) < 24) || Math.abs(x) > 60 || Math.abs(z) > 60) return 'stone';
  return 'grass';
}

export function addWalkableSlab(scene, walkableFloors, cx, topY, cz, w, thickness, d, colorOrMat, opts) {
  const mesh = makeBox(w, thickness, d, colorOrMat, opts);
  mesh.position.set(cx, topY - thickness / 2, cz);
  scene.add(mesh);
  walkableFloors.push({
    minX: cx - w / 2, maxX: cx + w / 2,
    minZ: cz - d / 2, maxZ: cz + d / 2,
    topY
  });
  return mesh;
}

export function addSolidWall(scene, wallSegments, x1, z1, x2, z2, minY, height, thickness, colorOrMat, opts) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return null;
  const mesh = makeBox(len, height, thickness, colorOrMat, opts);
  mesh.position.set((x1 + x2) / 2, minY + height / 2, (z1 + z2) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  scene.add(mesh);
  wallSegments.push({
    x1, z1, x2, z2,
    halfThick: thickness / 2 + 0.06,
    minY, maxY: minY + height
  });
  return mesh;
}

export function clampPosAgainstWalls(ctx, pos, radius) {
  const { wallSegments, campusDoors, solidColliders } = ctx;

  for (let i = 0; i < wallSegments.length; i++) {
    const w = wallSegments[i];
    if (w.minY !== undefined && (pos.y + 1.4 < w.minY || pos.y > w.maxY - 0.15)) continue;
    const vx = w.x2 - w.x1, vz = w.z2 - w.z1;
    const len2 = vx * vx + vz * vz;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((pos.x - w.x1) * vx + (pos.z - w.z1) * vz) / len2));
    const cx = w.x1 + t * vx, cz = w.z1 + t * vz;
    let dx = pos.x - cx, dz = pos.z - cz;
    let dist = Math.hypot(dx, dz);
    const minD = radius + w.halfThick;
    if (dist < minD) {
      if (dist < 0.0001) { dx = 1; dz = 0; dist = 1; }
      pos.x = cx + (dx / dist) * minD;
      pos.z = cz + (dz / dist) * minD;
    }
  }

  for (let dIdx = 0; dIdx < campusDoors.length; dIdx++) {
    const dr = campusDoors[dIdx];
    if (!dr.open && pos.y < 3.4 && pos.z > dr.minZ - 0.1 && pos.z < dr.maxZ + 0.1 && Math.abs(pos.x - dr.frontX) < radius + 0.18) {
      pos.x = pos.x >= dr.frontX ? dr.frontX + radius + 0.18 : dr.frontX - radius - 0.18;
    }
  }

  for (let j = 0; j < solidColliders.length; j++) {
    const c = solidColliders[j];
    const surfY = (c.surfaceTopY !== undefined) ? c.surfaceTopY : c.maxY;
    if (pos.y >= surfY - 0.08 || pos.y + 1.5 < c.minY) continue;
    const nearX = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nearZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const cdx = pos.x - nearX, cdz = pos.z - nearZ;
    const cdist = Math.hypot(cdx, cdz);
    if (cdist < radius) {
      if (cdist < 0.0001) { pos.x = c.minX - radius; }
      else {
        pos.x = nearX + (cdx / cdist) * radius;
        pos.z = nearZ + (cdz / cdist) * radius;
      }
    }
  }

  pos.x = Math.max(-200, Math.min(200, pos.x));
  pos.z = Math.max(-200, Math.min(200, pos.z));
}
