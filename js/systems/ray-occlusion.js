function rayIntersectsAabb(origin, dir, c, useEntry = false) {
  const cMinY = typeof c.minY === 'number' ? c.minY : 0;
  const cMaxY = typeof c.maxY === 'number' ? c.maxY : 2.5;
  if (cMaxY - cMinY < 0.38) return -1;

  const invDx = 1 / (Math.abs(dir.x) > 1e-6 ? dir.x : 1e-6);
  const invDy = 1 / (Math.abs(dir.y) > 1e-6 ? dir.y : 1e-6);
  const invDz = 1 / (Math.abs(dir.z) > 1e-6 ? dir.z : 1e-6);

  const tx1 = (c.minX - origin.x) * invDx;
  const tx2 = (c.maxX - origin.x) * invDx;
  const ty1 = (cMinY - origin.y) * invDy;
  const ty2 = (cMaxY - origin.y) * invDy;
  const tz1 = (c.minZ - origin.z) * invDz;
  const tz2 = (c.maxZ - origin.z) * invDz;

  const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
  const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
  if (tmax < tmin || tmax <= 0.05) return -1;
  return useEntry && tmin > 0.05 ? tmin : tmax;
}

function nearestWallDistance(origin, dir, walls, maxDist, stopAtFirst = false) {
  if (!walls?.length) return maxDist;
  let closest = maxDist;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (!w) continue;
    const sx = w.x2 - w.x1;
    const sz = w.z2 - w.z1;
    const denom = dir.x * sz - dir.z * sx;
    if (Math.abs(denom) < 1e-6) continue;
    const qx = w.x1 - origin.x;
    const qz = w.z1 - origin.z;
    const t = (qx * sz - qz * sx) / denom;
    if (t <= 0.05 || t >= closest - (stopAtFirst ? 0.05 : 0)) continue;
    const u = (qx * dir.z - qz * dir.x) / denom;
    if (u < -0.005 || u > 1.005) continue;
    const hitY = origin.y + dir.y * t;
    const minY = typeof w.minY === 'number' ? w.minY : 0;
    const maxY = typeof w.maxY === 'number' ? w.maxY : 3.6;
    if (hitY >= minY && hitY <= maxY) {
      if (stopAtFirst) return t;
      closest = t;
    }
  }
  return closest;
}

export function getStructureHitDistance(ctx, origin, direction, range) {
  let distance = nearestWallDistance(origin, direction, ctx.wallSegments, range);
  for (const collider of ctx.solidColliders || []) {
    if (!collider || collider._disabled) continue;
    const hit = rayIntersectsAabb(origin, direction, collider, true);
    if (hit > 0 && hit < distance) distance = hit;
  }
  return distance;
}

/**
 * Verifica se o raio atravessou completamente uma estante/bancada/móvel ou parede
 * antes de atingir um alvo mais distante (ex.: persianas, portas ou itens atrás da estante).
 */
export function isRayOccludedByStructure(ctx, targetDist, opts) {
  if (!ctx || !ctx.raycaster || !ctx.raycaster.ray || !isFinite(targetDist)) return false;
  const ray = ctx.raycaster.ray;
  const origin = ray.origin;
  const dir = ray.direction;
  const ignoreCollider = opts && opts.ignoreCollider;

  const colliders = ctx.solidColliders;
  if (colliders && colliders.length) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (!c || c === ignoreCollider) continue;
      const tExit = rayIntersectsAabb(origin, dir, c);
      if (tExit > 0.05 && tExit < targetDist - 0.04) {
        return true;
      }
    }
  }

  if (opts && opts.checkWalls && nearestWallDistance(origin, dir, ctx.wallSegments, targetDist, true) < targetDist) {
    return true;
  }
  return false;
}

export function firstUnoccludedRayHit(ctx, hits, maxDist, opts) {
  if (!hits || !hits.length) return null;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (!h || h.distance >= maxDist) continue;
    if (h.object && h.object.userData && h.object.userData.ignoreRay) continue;
    let cur = h.object;
    while (cur) {
      if (cur.visible === false) break;
      if (cur === ctx.scene) { cur = null; break; }
      cur = cur.parent;
    }
    if (cur) continue;
    if (opts?.acceptHit && !opts.acceptHit(h)) continue;
    if (!isRayOccludedByStructure(ctx, h.distance, opts)) return h;
  }
  return null;
}
