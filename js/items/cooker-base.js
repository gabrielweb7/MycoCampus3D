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

  // Raised runners leave space for steam beneath the plate.
  const footGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.035, 8);
  for (let index = 0; index < 4; index++) {
    const angle = (index + 0.5) * Math.PI / 2;
    const foot = new THREE.Mesh(footGeo, aluMat);
    foot.position.set(Math.cos(angle) * 0.16, 0.0175, Math.sin(angle) * 0.16);
    bg.add(foot);
  }

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
  bg.add(topDisc);
  bg.userData.firstPersonGrip = { x: 0.07, y: 0.033, z: 0.18 };
  bg.userData.isCookerBase = true;
  return registerPickable(ctx, id, 'Base Perfurada da Panela (4cm)', bg, px, py, pz, 0, 0.21, 0.05, COOKER_BASE_META);
}
