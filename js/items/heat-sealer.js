/**
 * Seladora Termica de Bags (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { makeChamferedBox } from './lab-prop-shapes.js';
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
  const sealerBase = makeChamferedBox(0.46, 0.08, 0.18, 0.015, 0x8e7397);
  sealerBase.position.y = 0.04;
  const bed = makeChamferedBox(0.43, 0.014, 0.066, 0.004, 0xe5cca4);
  bed.position.set(0, 0.074, 0.02);
  const heatStrip = makeBox(0.42, 0.008, 0.014, new THREE.MeshStandardMaterial({ color: 0x423b38, emissive: 0x000000, roughness: 0.3 }));
  heatStrip.position.set(0, 0.082, 0.02);
  const sealerArm = makeChamferedBox(0.44, 0.026, 0.049, 0.007, 0x9b7ea4);
  const hinge = new THREE.Group();
  hinge.position.set(-0.202, 0.095, 0.02);
  hinge.rotation.z = 0.14;
  sealerArm.position.x = 0.202;
  hinge.add(sealerArm);
  const mount = makeChamferedBox(0.05, 0.04, 0.059, 0.006, 0x705979);
  mount.position.set(-0.202, 0.085, 0.02);
  const grip = makeChamferedBox(0.11, 0.018, 0.054, 0.006, 0xea9d60);
  grip.position.set(0.151, 0.018, 0);
  sealerArm.add(grip);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.3, roughness: 0.3 });
  const sealerLed = makeBox(0.022, 0.022, 0.022, ledMat, { noShadow: true });
  sealerLed.position.set(0.18, 0.085, 0.06);
  sealerGroup.add(sealerBase, bed, heatStrip, mount, hinge, sealerLed);
  const item = registerPickable(ctx, id, 'Seladora Térmica de Bags', sealerGroup, px, py, pz, Math.PI / 2, 0.28, 0.18, HEAT_SEALER_META);
  let sealTimer = null;
  item.sealerCtrl = {
    triggerSealAnimation: () => {
      hinge.rotation.z = 0;
      ledMat.emissive.setHex(0xef4444);
      ledMat.emissiveIntensity = 2.4;
      heatStrip.material.emissive.setHex(0xf97316);
      heatStrip.material.emissiveIntensity = 1.8;
      if (sealTimer) clearTimeout(sealTimer);
      sealTimer = setTimeout(() => {
        hinge.rotation.z = 0.14;
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
