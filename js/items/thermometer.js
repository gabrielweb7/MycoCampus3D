/**
 * Termometro Laser Infravermelho (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { makeChamferedBox, makeSideProfile } from './lab-prop-shapes.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const THERMOMETER_META = {
  category: 'instrument',
  purpose: 'Medir temperatura superficial por laser infravermelho sem contato',
  weightGrams: 190,
  baseTempC: 23.5,
  compatibilities: { canEnterCooker: false, scansTemperature: true },
  connections: ['burner', 'pressure_cooker', 'laminar_hood', 'greenhouse_slot', 'liquid_culture']
};

export function makeInfraredThermometer(ctx, id, px, py, pz) {
  const thermoTex = ctx.ensureThermoTex ? ctx.ensureThermoTex() : null;
  const tg = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xe7cca1, roughness: 0.35, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x536b59, roughness: 0.55, metalness: 0.15 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xbd6244, roughness: 0.4 });

  const head = makeChamferedBox(0.072, 0.092, 0.145, 0.013, yellowMat);
  head.position.set(0, 0.155, 0);
  const topCap = makeBox(0.054, 0.012, 0.11, darkMat);
  topCap.position.set(0, 0.202, -0.01);
  const snout = makeChamferedBox(0.063, 0.077, 0.029, 0.009, darkMat);
  snout.position.set(0, 0.155, -0.082);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.006, 14),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.145, -0.096);
  const laserDiode = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.008, 10), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
  laserDiode.rotation.x = Math.PI / 2;
  laserDiode.position.set(0, 0.178, -0.096);

  const backBezel = makeChamferedBox(0.068, 0.080, 0.020, 0.006, darkMat);
  backBezel.position.set(0, 0.155, 0.076);
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.048, 0.046),
    new THREE.MeshBasicMaterial({ map: thermoTex, color: thermoTex ? 0xffffff : 0x273b36 })
  );
  screenMesh.position.set(0, 0.163, 0.088);

  [-0.015, 0, 0.015].forEach(function (bx) {
    const btn = makeBox(0.009, 0.009, 0.004, yellowMat);
    btn.position.set(bx, 0.128, 0.086);
    tg.add(btn);
  });

  const handle = new THREE.Group();
  handle.position.set(0, 0.085, 0.015);
  handle.rotation.x = -0.16;
  const gripCore = makeSideProfile([
    [-0.026, -0.061], [0.023, -0.061], [0.028, -0.046],
    [0.023, 0.047], [0.015, 0.064], [-0.023, 0.061]
  ], 0.049, 0.006, yellowMat);
  const gripRubberF = makeBox(0.048, 0.125, 0.016, darkMat);
  gripRubberF.position.set(0, 0, -0.022);
  const gripRubberB = makeBox(0.048, 0.125, 0.016, darkMat);
  gripRubberB.position.set(0, 0, 0.022);
  handle.add(gripCore, gripRubberF, gripRubberB);

  const trigger = makeChamferedBox(0.021, 0.034, 0.027, 0.005, redMat);
  trigger.position.set(0, 0.105, -0.022);

  tg.add(head, topCap, snout, lens, laserDiode, backBezel, screenMesh, handle, trigger);
  tg.userData.isThermometer = true;
  tg.userData.firstPersonGrip = { x: 0, y: 0.073, z: 0.052 };
  return registerPickable(ctx, id, 'Termômetro Laser Infravermelho', tg, px, py, pz, 0, 0.18, 0.22, THERMOMETER_META);
}
