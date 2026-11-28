export function registerShotTarget(ctx, mesh, { radius, depth = radius, halfHeight, centerY, onHit, active }) {
  ctx.scene.userData ||= {};
  const targets = ctx.scene.userData.shotTargets ||= [];
  targets.push({ mesh, radius, depth, halfHeight, centerY, onHit, active });
}

export function getShotTargetHit(ctx, origin, direction, limit, result) {
  let distance = limit;
  result.target = null;
  for (const target of ctx.scene?.userData?.shotTargets || []) {
    const mesh = target.mesh;
    if (!mesh.visible || !target.active()) continue;
    const r = target.radius * mesh.scale.x;
    const d = target.depth * mesh.scale.z;
    const h = target.halfHeight * mesh.scale.y;
    if (r < 0.05 || d < 0.05 || h < 0.05) continue;
    const offsetX = origin.x - mesh.position.x;
    const offsetZ = origin.z - mesh.position.z;
    const cosine = Math.cos(mesh.rotation.y);
    const sine = Math.sin(mesh.rotation.y);
    const x = (offsetX * cosine - offsetZ * sine) / r;
    const y = (origin.y - mesh.position.y - target.centerY * mesh.scale.y) / h;
    const z = (offsetZ * cosine + offsetX * sine) / d;
    const dx = (direction.x * cosine - direction.z * sine) / r;
    const dy = direction.y / h;
    const dz = (direction.z * cosine + direction.x * sine) / d;
    const a = dx * dx + dy * dy + dz * dz;
    const b = x * dx + y * dy + z * dz;
    const c = x * x + y * y + z * z - 1;
    const discriminant = b * b - a * c;
    if (discriminant < 0 || (b >= 0 && c > 0)) continue;
    const hit = Math.max(0.001, (-b - Math.sqrt(discriminant)) / a);
    if (hit >= distance) continue;
    result.target = target;
    distance = hit;
  }
  return distance;
}
