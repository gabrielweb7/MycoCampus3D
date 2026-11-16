/**
 * Termometro Laser Infravermelho (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export function makeInfraredThermometer(ctx, id, px, py, pz) {
  const thermoTex = ctx.ensureThermoTex ? ctx.ensureThermoTex() : null;
  const tg = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.15 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

  const head = makeBox(0.062, 0.084, 0.145, yellowMat);
  head.position.set(0, 0.155, 0);
  const topCap = makeBox(0.054, 0.012, 0.11, darkMat);
  topCap.position.set(0, 0.202, -0.01);
  const snout = makeBox(0.054, 0.076, 0.024, darkMat);
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

  const backBezel = makeBox(0.058, 0.078, 0.016, darkMat);
  backBezel.position.set(0, 0.155, 0.076);
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.048, 0.046),
    new THREE.MeshBasicMaterial({ map: thermoTex })
  );
  screenMesh.position.set(0, 0.163, 0.0865);

  [-0.015, 0, 0.015].forEach(function (bx) {
    const btn = makeBox(0.009, 0.009, 0.004, yellowMat);
    btn.position.set(bx, 0.128, 0.086);
    tg.add(btn);
  });

  const handle = new THREE.Group();
  handle.position.set(0, 0.085, 0.015);
  handle.rotation.x = -0.16;
  const gripCore = makeBox(0.046, 0.135, 0.052, yellowMat);
  const gripRubberF = makeBox(0.048, 0.125, 0.016, darkMat);
  gripRubberF.position.set(0, 0, -0.022);
  const gripRubberB = makeBox(0.048, 0.125, 0.016, darkMat);
  gripRubberB.position.set(0, 0, 0.022);
  handle.add(gripCore, gripRubberF, gripRubberB);

  const trigger = makeBox(0.014, 0.032, 0.018, redMat);
  trigger.position.set(0, 0.105, -0.022);
  const sticker = makeBox(0.065, 0.026, 0.055, new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  sticker.position.set(0, 0.165, 0);

  tg.add(head, topCap, snout, lens, laserDiode, backBezel, screenMesh, handle, trigger, sticker);
  tg.userData.isThermometer = true;
  return registerPickable(ctx, id, 'Termômetro Laser Infravermelho', tg, px, py, pz, 0, 0.18, 0.22);
}
