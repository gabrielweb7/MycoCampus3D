/**
 * Pia Inox de Laboratorio com Torneira Pescoço de Ganso (MycoCampus3D)
 * Permite encher recipientes, garrafoes e panelas de pressao com agua animada.
 */

import { makeBox } from '../engine/textures.js';

const THREE = window.THREE;

export function buildLabSink(ctx, sx, sy, sz) {
  const sg = new THREE.Group();
  sg.position.set(sx, sy, sz);

  const steelMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.88, roughness: 0.20 });
  const basinDarkMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.82, roughness: 0.28 });
  const faucetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.55, roughness: 0.25 });
  const valveMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });

  // Borda inox da cuba sobre a bancada
  const rim = makeBox(0.68, 0.018, 0.52, steelMat);
  rim.position.set(0, 0.009, 0);
  const basin = makeBox(0.56, 0.012, 0.40, basinDarkMat);
  basin.position.set(0, 0.004, 0.02);
  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.006, 16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 })
  );
  drain.position.set(0, 0.012, 0.02);

  // Torneira pescoço de ganso (estilo laboratorio da foto)
  const baseCol = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.05, 14), faucetMat);
  baseCol.position.set(-0.22, 0.04, 0);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.28, 12), faucetMat);
  riser.position.set(-0.22, 0.19, 0);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 10, 18, Math.PI), faucetMat);
  arch.position.set(-0.135, 0.33, 0);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.05, 12), faucetMat);
  nozzle.position.set(-0.05, 0.305, 0);
  const handle = makeBox(0.014, 0.065, 0.018, valveMat, { noShadow: true });
  handle.position.set(-0.22, 0.08, 0.035);
  handle.rotation.x = 0.45;

  // Jato de agua animado (visivel ao encher)
  const waterStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.012, 0.27, 10),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72, roughness: 0.1 })
  );
  waterStream.position.set(-0.05, 0.15, 0);
  waterStream.visible = false;

  // Hitbox invisivel para facilitar clique/raycast
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.48, 0.62),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitBox.position.set(0, 0.22, 0);

  sg.add(rim, basin, drain, baseCol, riser, arch, nozzle, handle, waterStream, hitBox);
  ctx.scene.add(sg);

  const sinkObj = {
    x: sx,
    y: sy,
    z: sz,
    waterStream,
    handle,
    activeUntil: 0,
    nozzleWorld: new THREE.Vector3(sx - 0.05, sy + 0.03, sz)
  };
  hitBox.userData.labSink = sinkObj;
  if (!ctx.labSinkMeshes) ctx.labSinkMeshes = [];
  if (!ctx.labSinks) ctx.labSinks = [];
  ctx.labSinkMeshes.push(hitBox);
  ctx.labSinks.push(sinkObj);
  return sinkObj;
}

export function triggerSinkStream(sinkObj, durationMs) {
  if (!sinkObj) return;
  sinkObj.activeUntil = performance.now() + (durationMs || 900);
  if (sinkObj.waterStream) sinkObj.waterStream.visible = true;
}

export function stepLabSinks(ctx) {
  if (!ctx.labSinks || !ctx.labSinks.length) return;
  const now = performance.now();
  for (let i = 0; i < ctx.labSinks.length; i++) {
    const s = ctx.labSinks[i];
    const active = now < s.activeUntil;
    if (s.waterStream) {
      s.waterStream.visible = active;
      if (active) {
        const pulse = 0.88 + Math.sin(now * 0.03) * 0.14;
        s.waterStream.scale.set(pulse, 1, pulse);
      }
    }
    if (s.handle) {
      s.handle.rotation.x = active ? 0.95 : 0.45;
    }
  }
}
