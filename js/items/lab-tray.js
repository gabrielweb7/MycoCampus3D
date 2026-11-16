/**
 * Bandeja Inox Cirurgica (MycoCampus3D)
 */

import { registerPickable, updateItemBounds, makeRoundedRectShape } from './item-registry.js';

const THREE = window.THREE;

export function makeLabTray(ctx, id, label, px, py, pz) {
  const tg = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9, metalness: 0.90, roughness: 0.14,
    emissive: 0x334155, emissiveIntensity: 0.12
  });
  const innerSteelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, metalness: 0.85, roughness: 0.22,
    emissive: 0x1e293b, emissiveIntensity: 0.08
  });

  const baseShape = makeRoundedRectShape(0.38, 0.26, 0.032);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
  baseGeo.rotateX(-Math.PI / 2);
  const floorPlate = new THREE.Mesh(baseGeo, innerSteelMat);
  floorPlate.position.y = 0.002;
  floorPlate.castShadow = true;
  floorPlate.receiveShadow = true;

  const outerWall = makeRoundedRectShape(0.40, 0.28, 0.036);
  const innerHole = makeRoundedRectShape(0.36, 0.24, 0.026);
  outerWall.holes.push(innerHole);
  const wallGeo = new THREE.ExtrudeGeometry(outerWall, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
  wallGeo.rotateX(-Math.PI / 2);
  const wallMesh = new THREE.Mesh(wallGeo, steelMat);
  wallMesh.position.y = 0.006;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;

  const lipShape = makeRoundedRectShape(0.43, 0.31, 0.040);
  const lipHole = makeRoundedRectShape(0.37, 0.25, 0.028);
  lipShape.holes.push(lipHole);
  const lipGeo = new THREE.ExtrudeGeometry(lipShape, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 });
  lipGeo.rotateX(-Math.PI / 2);
  const lipMesh = new THREE.Mesh(lipGeo, steelMat);
  lipMesh.position.y = 0.024;
  lipMesh.castShadow = true;

  tg.add(floorPlate, wallMesh, lipMesh);

  const traySurf = { minX: px - 0.175, maxX: px + 0.175, minZ: pz - 0.115, maxZ: pz + 0.115, topY: py + 0.009 };
  ctx.supportSurfaces.push(traySurf);
  floorPlate.userData.supportSurface = traySurf;
  ctx.supportMeshes.push(floorPlate);

  tg.userData.isTray = true;
  tg.userData.tableDims = { w: 0.36, h: 0.009, d: 0.24, surfOffset: 0 };
  tg.userData.dynamicSurface = traySurf;
  tg.userData.updateBounds = updateItemBounds;
export const LAB_TRAY_META = {
  category: 'carrier',
  purpose: 'Transportar múltiplos frascos, seringas e placas juntos com organização',
  weightGrams: 420,
  baseTempC: 21.8,
  compatibilities: { canEnterCooker: false, carriesItemsOnSurface: true },
  connections: ['syringe', 'petri_dish', 'liquid_culture', 'table']
};

  return registerPickable(ctx, id, label, tg, px, py, pz, 0, 0.22, 0.03, LAB_TRAY_META);
}
