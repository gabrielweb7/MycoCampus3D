/**
 * Mesa Inox Movel (MycoCampus3D)
 */

import { makeChamferedBox } from './lab-prop-shapes.js';
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
  const inoxMat = new THREE.MeshStandardMaterial({ color: 0xbec2b6, metalness: 0.37, roughness: 0.44 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x72836c, metalness: 0.10, roughness: 0.65 });
  const footMat = new THREE.MeshStandardMaterial({ color: 0xddc6a4, roughness: 0.72 });
  const tg = new THREE.Group();
  const top = makeChamferedBox(tw - 0.037, 0.018, td - 0.037, 0.005, inoxMat);
  const edge = makeChamferedBox(tw, 0.055, td, 0.016, footMat);
  edge.position.y = th - 0.032;
  top.position.y = th - 0.009; top.castShadow = true; top.receiveShadow = true;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(tw - 0.08, 0.035, td - 0.08), inoxMat);
  shelf.position.y = th * 0.28; shelf.receiveShadow = true;
  tg.add(top, edge, shelf);

  const lx = tw / 2 - 0.07, lz = td / 2 - 0.07;
  [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (lp) {
    const leg = makeChamferedBox(0.059, th - 0.04, 0.059, 0.009, legMat);
    leg.position.set(lp[0], (th - 0.04) / 2 + 0.02, lp[1]);
    const foot = makeChamferedBox(0.068, 0.03, 0.068, 0.007, footMat);
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
