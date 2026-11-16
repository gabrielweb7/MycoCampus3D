/**
 * Mesa Inox Movel (MycoCampus3D)
 */

import { registerPickable, updateItemBounds, isSurfaceOccupied } from './item-registry.js';

const THREE = window.THREE;

export const STAINLESS_TABLE_META = {
  category: 'furniture',
  purpose: 'Bancada móvel em aço inox para equipamentos e manipulação',
  weightGrams: 18000,
  baseTempC: 21.8,
  compatibilities: { canEnterCooker: false, supportsItemsOnSurface: true },
  connections: ['pressure_cooker', 'burner', 'laminar_hood', 'magnetic_stirrer', 'lab_tray']
};

export function addMovableStainlessTable(ctx, id, label, tx, floorY, tz, tw, th, td) {
  const inoxMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.22 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.15 });
  const footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const tg = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.055, td), inoxMat);
  top.position.y = th - 0.0275; top.castShadow = true; top.receiveShadow = true;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(tw - 0.08, 0.035, td - 0.08), inoxMat);
  shelf.position.y = th * 0.28; shelf.receiveShadow = true;
  tg.add(top, shelf);

  const lx = tw / 2 - 0.07, lz = td / 2 - 0.07;
  [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (lp) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, th - 0.04, 10), legMat);
    leg.position.set(lp[0], (th - 0.04) / 2 + 0.02, lp[1]);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), footMat);
    foot.position.set(lp[0], 0.015, lp[1]);
    tg.add(leg, foot);
  });

  const surf = { minX: tx - tw / 2 + 0.02, maxX: tx + tw / 2 - 0.02, minZ: tz - td / 2 + 0.02, maxZ: tz + td / 2 - 0.02, topY: floorY + th };
  const col = { minX: tx - tw / 2 - 0.05, maxX: tx + tw / 2 + 0.05, minZ: tz - td / 2 - 0.05, maxZ: tz + td / 2 + 0.05, minY: floorY, maxY: floorY + th, surfaceTopY: floorY + th };
  ctx.supportSurfaces.push(surf);
  top.userData.supportSurface = surf;
  ctx.supportMeshes.push(top);
  ctx.solidColliders.push(col);

  tg.userData.twoHanded = true;
  tg.userData.isTable = true;
  tg.userData.tableDims = { w: tw, h: th, d: td, surfOffset: 0 };
  tg.userData.dynamicSurface = surf;
  tg.userData.dynamicCollider = col;
  tg.userData.updateBounds = updateItemBounds;
  tg.userData.isBlockedPickup = function (item) { return isSurfaceOccupied(ctx, surf, item); };
  return registerPickable(ctx, id, label, tg, tx, floorY, tz, 0, Math.max(tw, td) * 0.5, th, STAINLESS_TABLE_META);
}
