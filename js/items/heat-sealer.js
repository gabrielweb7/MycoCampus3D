/**
 * Seladora Termica de Bags (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { makeChamferedBox } from './lab-prop-shapes.js';
import { makeRoundedRectShape, registerPickable } from './item-registry.js';

const THREE = window.THREE;
const LEVER_OPEN_ANGLE = 0.34;

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
  const sealerArm = makeChamferedBox(0.44, 0.029, 0.059, 0.008, 0x9b7ea4);
  const hinge = new THREE.Group();
  hinge.position.set(-0.202, 0.095, 0.02);
  hinge.rotation.z = LEVER_OPEN_ANGLE;
  sealerArm.position.x = 0.202;
  hinge.add(sealerArm);
  const mount = makeChamferedBox(0.063, 0.056, 0.078, 0.011, 0x705979);
  mount.position.set(-0.195, 0.091, 0.02);
  const pivotCap = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.084, 10),
    new THREE.MeshStandardMaterial({ color: 0xe5cca4, roughness: 0.68 }));
  pivotCap.rotation.x = Math.PI / 2;
  pivotCap.position.copy(hinge.position);
  const outline = new THREE.Shape();
  outline.moveTo(-0.153, -0.027);
  outline.lineTo(0.148, -0.027);
  outline.lineTo(0.137, 0.009);
  outline.lineTo(0.098, 0.035);
  outline.lineTo(-0.095, 0.035);
  outline.lineTo(-0.145, 0.005);
  outline.closePath();
  outline.holes.push(makeRoundedRectShape(0.176, 0.030, 0.010));
  const handleGeo = new THREE.ExtrudeGeometry(outline, {
    depth: 0.045, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 3
  });
  handleGeo.translate(0, 0, -0.0225);
  const grip = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ color: 0xb49ab9, roughness: 0.74 }));
  grip.position.set(0.055, 0.038, 0);
  sealerArm.add(grip);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x81c0ab, emissive: 0x27635c, emissiveIntensity: 0.3, roughness: 0.3 });
  const sealerLed = makeBox(0.022, 0.022, 0.022, ledMat, { noShadow: true });
  sealerLed.position.set(0.18, 0.085, 0.06);
  sealerGroup.add(sealerBase, bed, heatStrip, mount, pivotCap, hinge, sealerLed);
  sealerGroup.userData.firstPersonSideGrip = { x: 0.194, y: 0.031, z: 0.068 };
  const item = registerPickable(ctx, id, 'Seladora Térmica de Bags', sealerGroup, px, py, pz, Math.PI / 2, 0.28, 0.28, HEAT_SEALER_META);
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
        hinge.rotation.z = LEVER_OPEN_ANGLE;
        ledMat.emissive.setHex(0x27635c);
        ledMat.emissiveIntensity = 0.3;
        heatStrip.material.emissive.setHex(0x000000);
        heatStrip.material.emissiveIntensity = 0;
        sealTimer = null;
      }, 550);
    }
  };
  return item;
}
