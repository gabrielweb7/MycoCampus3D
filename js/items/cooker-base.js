/**
 * Base / Espacador Perfurado da Panela de Pressao (MycoCampus3D)
 * Disco de aluminio ~4cm de altura para manter vidros e bags acima da agua na autoclave.
 */

import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const COOKER_BASE_META = {
  category: 'sterilization_accessory',
  purpose: 'Base perfurada de 4cm para apoiar vidros e bags acima do nível da água na panela',
  weightGrams: 340,
  baseTempC: 24.0,
  compatibilities: {
    canEnterCooker: true,
    isCookerBase: true
  },
  connections: ['pressure_cooker', 'spawn_jar', 'spawn_bag', 'liquid_culture']
};

export function makeCookerBase(ctx, id, px, py, pz) {
  const bg = new THREE.Group();
  const aluMat = new THREE.MeshStandardMaterial({
    color: 0xb5b2a5, metalness: 0.44, roughness: 0.43
  });

  // Aro lateral ~4cm de altura (0.042m) e diametro menor que a panela (r = 0.195m)
  const sideRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.195, 0.195, 0.042, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xb5b2a5, metalness: 0.44, roughness: 0.43, side: THREE.DoubleSide })
  );
  sideRing.position.y = 0.021;

  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, 0.195, 0, Math.PI * 2, false);
  const holes = [[0, 0], [0, 0.08], [0, -0.08], [0.08, 0], [-0.08, 0],
    [0.058, 0.058], [-0.058, 0.058], [0.058, -0.058], [-0.058, -0.058],
    [0, 0.14], [0, -0.14], [0.14, 0], [-0.14, 0]];
  for (const [x, z] of holes) {
    const hole = new THREE.Path();
    hole.absarc(x, z, 0.014, 0, Math.PI * 2, true);
    plateShape.holes.push(hole);
  }
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.008, bevelEnabled: false, curveSegments: 5 });
  plateGeo.rotateX(-Math.PI / 2);
  const topDisc = new THREE.Mesh(plateGeo, aluMat);
  topDisc.position.y = 0.034;
  bg.add(sideRing, topDisc);
  bg.userData.firstPersonGrip = { x: 0.07, y: 0.015, z: 0.197 };
  bg.userData.isCookerBase = true;
  return registerPickable(ctx, id, 'Base Perfurada da Panela (4cm)', bg, px, py, pz, 0, 0.21, 0.05, COOKER_BASE_META);
}
