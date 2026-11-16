/**
 * Flocao de Milho 500g para Culturas Solidas em Potinhos PP5 (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const FLOCAO_META = {
  category: 'substrate',
  purpose: 'Flocão de milho 500g para preparo de cultura sólida úmida em potinhos PP5 145ml',
  weightGrams: 500,
  baseTempC: 23.0,
  compatibilities: { canEnterCooker: false, fillsPP5WithFlocao: true },
  connections: ['pp5_cup', 'precision_scale', 'lab_sink']
};

export function makeFlocao500g(ctx, id, px, py, pz) {
  const fg = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx2 = c.getContext('2d');
  ctx2.fillStyle = '#eab308'; ctx2.fillRect(0, 0, 256, 256);
  ctx2.fillStyle = '#15803d'; ctx2.fillRect(0, 0, 256, 54);
  ctx2.fillStyle = '#ffffff'; ctx2.font = 'bold 26px sans-serif';
  ctx2.textAlign = 'center'; ctx2.fillText('FLOCÃO DE MILHO', 128, 36);
  ctx2.fillStyle = '#78350f'; ctx2.font = 'bold 34px sans-serif';
  ctx2.fillText('500g', 128, 128);
  ctx2.fillStyle = '#1e293b'; ctx2.font = 'bold 18px sans-serif';
  ctx2.fillText('Cultura Sólida • PP5', 128, 178);

  const pack = makeBox(0.14, 0.21, 0.085, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.55 }));
  pack.position.y = 0.105;
  fg.add(pack);
  fg.userData.isFlocao = true;
  return registerPickable(ctx, id, 'Flocão de Milho 500g', fg, px, py, pz, 0, 0.12, 0.22, FLOCAO_META);
}
