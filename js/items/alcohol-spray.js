/**
 * Borrifador Alcool 70% e Particulas de Spray (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const ALCOHOL_SPRAY_META = {
  category: 'sanitization',
  purpose: 'Higienizar superfícies, fluxo laminar e hidratar a estufa',
  weightGrams: 380,
  baseTempC: 20.2,
  compatibilities: {
    canEnterCooker: false,
    canSanitizeHood: true,
    canSanitizeItems: true,
    canHydrateGreenhouse: true
  },
  connections: ['laminar_hood', 'greenhouse_slot', 'table', 'petri']
};

export function makeAlcoholSprayBottle(ctx, id, px, py, pz) {
  const ag = new THREE.Group();
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.062, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, roughness: 0.25 })
  );
  bottle.position.y = 0.09;
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.036, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  neck.position.y = 0.205;
  const nozzle = makeBox(0.028, 0.028, 0.08, 0xf8fafc, { noShadow: true });
  nozzle.position.set(0, 0.235, 0.025);
  const trig = makeBox(0.012, 0.045, 0.018, 0x0284c7, { noShadow: true });
  trig.position.set(0, 0.212, 0.042);
  ag.add(bottle, neck, nozzle, trig);
  ag.userData.isAlcoholSpray = true;
  return registerPickable(ctx, id, 'Borrifador Álcool 70%', ag, px, py, pz, Math.PI / 2, 0.12, 0.26, ALCOHOL_SPRAY_META);
}

export function stepSprayBursts(ctx, dt) {
  if (!ctx.sprayBursts.length) return;
  for (let sbi = ctx.sprayBursts.length - 1; sbi >= 0; sbi--) {
    const sb = ctx.sprayBursts[sbi];
    sb.age += dt;
    const sArr = sb.attr.array;
    for (let k = 0; k < sArr.length; k += 3) {
      sArr[k] += sb.dir.x * dt * 2.2;
      sArr[k + 1] += sb.dir.y * dt * 2.2;
      sArr[k + 2] += sb.dir.z * dt * 2.2;
    }
    sb.attr.needsUpdate = true;
    sb.mat.opacity = Math.max(0, 0.85 * (1 - sb.age / 0.45));
    if (sb.age >= 0.45) {
      ctx.scene.remove(sb.pts);
      if (sb.pts.geometry && sb.pts.geometry.dispose) sb.pts.geometry.dispose();
      if (sb.mat && sb.mat.dispose) sb.mat.dispose();
      ctx.sprayBursts.splice(sbi, 1);
    }
  }
}
