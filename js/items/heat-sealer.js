/**
 * Seladora Termica de Bags (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const HEAT_SEALER_META = {
  category: 'equipment',
  purpose: 'Selar termicamente sacos/bags de spawn e substrato',
  weightGrams: 1850,
  getTempC: (item, ctx) => 165.0 + Math.sin(((ctx && ctx.clock && ctx.clock.elapsedTime) || 0) * 2.5) * 1.2,
  compatibilities: { canEnterCooker: false, sealsBags: true },
  connections: ['spawn_bag']
};

export function createHeatSealer(ctx, id, px, py, pz) {
  const sealerGroup = new THREE.Group();
  const sealerBase = makeBox(0.46, 0.08, 0.18, 0x1d4ed8, { roughness: 0.4, metalness: 0.35 });
  sealerBase.position.y = 0.04;
  const heatStrip = makeBox(0.42, 0.008, 0.014, new THREE.MeshStandardMaterial({ color: 0x92400e, emissive: 0x000000, roughness: 0.3 }));
  heatStrip.position.set(0, 0.082, 0.02);
  const sealerArm = makeBox(0.44, 0.04, 0.05, 0x94a3b8, { metalness: 0.7, roughness: 0.25 });
  sealerArm.position.set(0, 0.11, -0.02);
  sealerArm.rotation.x = 0.18;
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.3, roughness: 0.3 });
  const sealerLed = makeBox(0.022, 0.022, 0.022, ledMat, { noShadow: true });
  sealerLed.position.set(0.18, 0.085, 0.06);
  sealerGroup.add(sealerBase, heatStrip, sealerArm, sealerLed);
  const item = registerPickable(ctx, id, 'Seladora Térmica de Bags', sealerGroup, px, py, pz, Math.PI / 2, 0.28, 0.16, HEAT_SEALER_META);
  let sealTimer = null;
  item.sealerCtrl = {
    triggerSealAnimation: () => {
      sealerArm.rotation.x = 0.0;
      sealerArm.position.y = 0.092;
      sealerArm.position.z = 0.015;
      ledMat.emissive.setHex(0xef4444);
      ledMat.emissiveIntensity = 2.4;
      heatStrip.material.emissive.setHex(0xf97316);
      heatStrip.material.emissiveIntensity = 1.8;
      if (sealTimer) clearTimeout(sealTimer);
      sealTimer = setTimeout(() => {
        sealerArm.rotation.x = 0.18;
        sealerArm.position.y = 0.11;
        sealerArm.position.z = -0.02;
        ledMat.emissive.setHex(0x7f1d1d);
        ledMat.emissiveIntensity = 0.3;
        heatStrip.material.emissive.setHex(0x000000);
        heatStrip.material.emissiveIntensity = 0;
        sealTimer = null;
      }, 550);
    }
  };
  return item;
}
