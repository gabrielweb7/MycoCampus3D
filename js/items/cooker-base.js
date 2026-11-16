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
    color: 0xcbd5e1, metalness: 0.85, roughness: 0.32
  });

  // Aro lateral ~4cm de altura (0.042m) e diametro menor que a panela (r = 0.195m)
  const sideRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.195, 0.195, 0.042, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide })
  );
  sideRing.position.y = 0.021;

  // Textura com furos de vapor no topo
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx2 = c.getContext('2d');
  ctx2.fillStyle = '#cbd5e1'; ctx2.fillRect(0, 0, 256, 256);
  ctx2.fillStyle = '#1e293b';
  const holes = [
    [128, 128], [128, 72], [128, 184], [72, 128], [184, 128],
    [88, 88], [168, 88], [88, 168], [168, 168],
    [128, 36], [128, 220], [36, 128], [220, 128]
  ];
  holes.forEach(function (h) {
    ctx2.beginPath(); ctx2.arc(h[0], h[1], 10, 0, Math.PI * 2); ctx2.fill();
  });
  const topTex = new THREE.CanvasTexture(c);
  const topDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.195, 24),
    new THREE.MeshStandardMaterial({ map: topTex, metalness: 0.78, roughness: 0.35 })
  );
  topDisc.rotation.x = -Math.PI / 2;
  topDisc.position.y = 0.042;

  bg.add(sideRing, topDisc);
  bg.userData.isCookerBase = true;
  return registerPickable(ctx, id, 'Base Perfurada da Panela (4cm)', bg, px, py, pz, 0, 0.21, 0.05, COOKER_BASE_META);
}
