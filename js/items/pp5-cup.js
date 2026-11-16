/**
 * Potinho PP5 145ml (Autoclavavel) para Cultura Solida com Flocao de Milho (MycoCampus3D)
 * Esterilizacao minima: 1h20m (80 min).
 */

import { registerPickable } from './item-registry.js';
import { updateSpawnVisual } from './spawn-containers.js';

const THREE = window.THREE;

export function getPP5Meta() {
  return {
    category: 'solid_culture',
    purpose: 'Potinho PP5 145ml para cultura sólida com flocão de milho úmido (esterilizar 1h20m)',
    minSterilizeMin: 80,
    getWeightGrams: (item) => {
      const sc = item && item.spawnCtrl;
      if (!sc) return 12;
      return 12 + (sc.fillGrams || 0) + (sc.waterMl || 0);
    },
    getTempC: (item) => (item && item.spawnCtrl && item.spawnCtrl.inoculated) ? 26.1 : 23.5,
    compatibilities: {
      canEnterCooker: true,
      receivesSyringe: true,
      receivesFlocao: true,
      receivesWater: true,
      receivesMyceliumCut: true
    },
    connections: ['flocao_500g', 'lab_sink', 'pressure_cooker', 'scalpel', 'syringe', 'laminar_hood']
  };
}

export function makePP5Cup145ml(ctx, id, filled, px, py, pz) {
  const cg = new THREE.Group();
  const ppMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc, transparent: true, opacity: 0.36, roughness: 0.22, depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.036, 0.056, 18, 1, true), ppMat);
  body.position.y = 0.028;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 18), ppMat);
  bottom.position.y = 0.002;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.046, 0.008, 18), ppMat);
  lid.position.y = 0.058;

  // Textura flocao de milho
  const fc = document.createElement('canvas'); fc.width = 128; fc.height = 128;
  const fctx = fc.getContext('2d');
  fctx.fillStyle = '#f59e0b'; fctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) {
    fctx.fillStyle = i % 3 === 0 ? '#d97706' : '#fde047';
    fctx.fillRect(Math.random() * 124, Math.random() * 124, 3, 3);
  }
  const flocaoMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.040, 0.033, 0.032, 16),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(fc), roughness: 0.85 })
  );
  flocaoMesh.position.y = 0.018;
  flocaoMesh.visible = !!filled;

  const mycOverlay = new THREE.Mesh(
    new THREE.CylinderGeometry(0.041, 0.034, 0.034, 16),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 })
  );
  mycOverlay.position.y = 0.019;
  mycOverlay.visible = false;

  cg.add(flocaoMesh, mycOverlay, body, bottom, lid);

  const item = registerPickable(ctx, id, 'Potinho PP5 145ml (Vazio)', cg, px, py, pz, 0, 0.06, 0.065, getPP5Meta());
  item.spawnCtrl = {
    isPP5: true,
    filled: !!filled,
    fillGrams: filled ? 45 : 0,
    waterMl: filled ? 35 : 0,
    fillMesh: flocaoMesh,
    minSterilizeMin: 80, // 1h20m
    sterilizeProgress: filled ? 100 : 0,
    baseLabel: filled ? 'Potinho PP5 145ml (Flocão)' : 'Potinho PP5 145ml Vazio',
    sterilized: false,
    inoculated: false,
    colonized: false,
    colonization: 0,
    contaminated: false,
    mycOverlay,
    updateVisual: function () {
      updateSpawnVisual(item);
      if (item.spawnCtrl.fillGrams > 0 && item.spawnCtrl.waterMl === 0 && !item.spawnCtrl.inoculated) {
        item.label = 'Potinho PP5 145ml (Flocão seco • Adicione água)';
      }
    }
  };
  item.mesh.userData.spawnCtrl = item.spawnCtrl;
  item.spawnCtrl.updateVisual();
  ctx.spawnGrowItems.push(item);
  return item;
}
