/**
 * Garrafao 5 Litros de Agua Destilada (MycoCampus3D)
 * Mostra nivel de agua visivel, pesa conforme volume (1ml = 1g) e despeja em frascos/panela.
 */

import { registerPickable } from './item-registry.js';
import { updateContainerVolume } from './liquid-culture.js';

const THREE = window.THREE;

export const DISTILLED_JUG_META = {
  category: 'water_source',
  purpose: 'Armazenar e despejar até 5000ml (5L) de água destilada em frascos e na panela',
  maxVolumeMl: 5000,
  baseTempC: 21.5,
  getWeightGrams: (item) => 180 + ((item && item.mesh && item.mesh.userData.liquidCtrl) ? item.mesh.userData.liquidCtrl.volMl : 0),
  compatibilities: {
    canEnterCooker: false,
    fillsFromSink: true,
    poursWater: true,
    receivesWater: true
  },
  connections: ['lab_sink', 'liquid_culture', 'beaker_1l', 'pressure_cooker', 'falcon_tube']
};

export function makeDistilledJug5L(ctx, id, px, py, pz, initMl) {
  const jg = new THREE.Group();
  const jugMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe, transparent: true, opacity: 0.34, roughness: 0.12, metalness: 0.08, depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.28, 22, 1, true), jugMat);
  body.position.y = 0.14;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.012, 22), jugMat);
  bottom.position.y = 0.006;
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.118, 0.055, 22), jugMat);
  shoulder.position.y = 0.307;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.032, 16),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
  );
  cap.position.y = 0.35;

  const liqMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.112, 0.26, 20),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.56, roughness: 0.12 })
  );

  // Rotulo frontal
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const lctx = c.getContext('2d');
  lctx.fillStyle = '#ffffff'; lctx.fillRect(0, 0, 256, 128);
  lctx.fillStyle = '#0284c7'; lctx.fillRect(0, 0, 256, 38);
  lctx.fillStyle = '#ffffff'; lctx.font = 'bold 20px system-ui, sans-serif';
  lctx.textAlign = 'center'; lctx.fillText('ÁGUA DESTILADA', 128, 26);
  lctx.fillStyle = '#0f172a'; lctx.font = 'bold 28px system-ui, sans-serif';
  lctx.fillText('5 LITROS', 128, 76);
  lctx.fillStyle = '#0369a1'; lctx.font = 'bold 16px system-ui, sans-serif';
  lctx.fillText('Deionizada • Lab Estéril', 128, 108);
  const labelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.120, 0.120, 0.12, 20, 1, true, -0.7, 1.4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true })
  );
  labelMesh.position.y = 0.15;

  jg.add(liqMesh, body, bottom, shoulder, cap, labelMesh);
  jg.userData.liquidCtrl = {
    volMl: initMl,
    maxMl: 5000,
    baseY: 0.012,
    maxH: 0.26,
    liqMesh,
    mycCloud: null,
    stirBar: null,
    baseLabel: 'Garrafão Água Destilada 5L'
  };

  const item = registerPickable(ctx, id, 'Garrafão Água Destilada 5L', jg, px, py, pz, 0, 0.16, 0.37, DISTILLED_JUG_META);
  item.setVolume = function (v) { updateContainerVolume(item, v); };
  updateContainerVolume(item, initMl);
  return item;
}
