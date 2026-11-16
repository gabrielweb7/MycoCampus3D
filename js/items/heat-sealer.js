/**
 * Seladora Termica de Bags (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export function createHeatSealer(ctx, id, px, py, pz) {
  const sealerGroup = new THREE.Group();
  const sealerBase = makeBox(0.46, 0.08, 0.18, 0x1d4ed8, { roughness: 0.4, metalness: 0.35 });
  sealerBase.position.y = 0.04;
  const sealerArm = makeBox(0.44, 0.04, 0.05, 0x94a3b8, { metalness: 0.7, roughness: 0.25 });
  sealerArm.position.set(0, 0.11, -0.02);
  sealerArm.rotation.x = 0.18;
  const sealerLed = makeBox(0.02, 0.02, 0.02, 0xef4444, { noShadow: true });
  sealerLed.position.set(0.18, 0.085, 0.06);
  sealerGroup.add(sealerBase, sealerArm, sealerLed);
  return registerPickable(ctx, id, 'Seladora Térmica de Bags', sealerGroup, px, py, pz, Math.PI / 2, 0.28, 0.16);
}
