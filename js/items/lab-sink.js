/**
 * Pia Inox de Laboratorio com Cuba Funda e Torneira Pescoço de Ganso (MycoCampus3D)
 * A cuba é recortada no tampo da bancada (ver laminar-hood.js): 0.60 x 0.50 m com 0.22 m de profundidade.
 * Permite encher recipientes, garrafoes e panelas de pressao com agua animada.
 */

import { makeBox } from '../engine/textures.js';

const THREE = window.THREE;

const BASIN_W = 0.60;
const BASIN_D = 0.50;
const BASIN_DEPTH = 0.22;

export function buildLabSink(ctx, sx, sy, sz) {
  const sg = new THREE.Group();
  sg.position.set(sx, sy, sz);

  const steelMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.9, roughness: 0.2 });
  const basinWallMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.92, roughness: 0.22, side: THREE.DoubleSide });
  const basinFloorMat = new THREE.MeshStandardMaterial({ color: 0xb6c2d1, metalness: 0.9, roughness: 0.3 });
  const faucetMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.7, roughness: 0.2 });
  const valveMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });

  const hw = BASIN_W / 2;
  const hd = BASIN_D / 2;

  // Aro (lábio) inox ao redor da cuba, sobre o tampo
  const lip = 0.03;
  const lipZ = makeBox(BASIN_W + lip * 2, 0.012, lip, steelMat);
  lipZ.position.set(0, 0.006, hd + lip / 2);
  const lipZ2 = makeBox(BASIN_W + lip * 2, 0.012, lip, steelMat);
  lipZ2.position.set(0, 0.006, -hd - lip / 2);
  const lipX = makeBox(lip, 0.012, BASIN_D, steelMat);
  lipX.position.set(hw + lip / 2, 0.006, 0);
  const lipX2 = makeBox(lip, 0.012, BASIN_D, steelMat);
  lipX2.position.set(-hw - lip / 2, 0.006, 0);

  // Paredes e fundo da cuba (profundidade real)
  const wallT = 0.012;
  const wallY = -BASIN_DEPTH / 2;
  const wBack = makeBox(BASIN_W, BASIN_DEPTH, wallT, basinWallMat);
  wBack.position.set(0, wallY, -hd + wallT / 2);
  const wFront = makeBox(BASIN_W, BASIN_DEPTH, wallT, basinWallMat);
  wFront.position.set(0, wallY, hd - wallT / 2);
  const wLeft = makeBox(wallT, BASIN_DEPTH, BASIN_D, basinWallMat);
  wLeft.position.set(-hw + wallT / 2, wallY, 0);
  const wRight = makeBox(wallT, BASIN_DEPTH, BASIN_D, basinWallMat);
  wRight.position.set(hw - wallT / 2, wallY, 0);
  const floor = makeBox(BASIN_W, 0.014, BASIN_D, basinFloorMat);
  floor.position.set(0, -BASIN_DEPTH + 0.007, 0);

  // Ralo com grade
  const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.006, 18), darkMat);
  drain.position.set(0.05, -BASIN_DEPTH + 0.017, 0);
  const grate = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.003, 6, 18), steelMat);
  grate.rotation.x = Math.PI / 2;
  grate.position.set(0.05, -BASIN_DEPTH + 0.02, 0);

  // Torneira pescoço de ganso apoiada no tampo, atrás da cuba (lado da parede)
  const fx = -hw - 0.07;
  const baseCol = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.030, 0.05, 14), faucetMat);
  baseCol.position.set(fx, 0.025, 0);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.28, 12), faucetMat);
  riser.position.set(fx, 0.19, 0);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.012, 10, 18, Math.PI), faucetMat);
  arch.position.set(fx + 0.095, 0.33, 0);
  const nozzleX = fx + 0.19;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.05, 12), faucetMat);
  nozzle.position.set(nozzleX, 0.305, 0);
  const handle = makeBox(0.014, 0.065, 0.018, valveMat, { noShadow: true });
  handle.position.set(fx, 0.08, 0.04);
  handle.rotation.x = 0.45;

  // Jato de agua animado (do bico ate o fundo da cuba)
  const streamH = 0.28 + BASIN_DEPTH;
  const waterStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.012, streamH, 10),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72, roughness: 0.1 })
  );
  waterStream.position.set(nozzleX, 0.28 - streamH / 2, 0);
  waterStream.visible = false;
  waterStream.userData.ignoreRay = true;

  // Hitbox invisivel cobrindo cuba e torneira
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.56 + BASIN_DEPTH, 0.66),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitBox.position.set(-0.06, 0.28 - (0.56 + BASIN_DEPTH) / 2 + 0.28, 0);

  sg.add(lipZ, lipZ2, lipX, lipX2, wBack, wFront, wLeft, wRight, floor, drain, grate,
    baseCol, riser, arch, nozzle, handle, waterStream, hitBox);
  ctx.scene.add(sg);

  // Fundo da cuba como superfície de apoio: itens colocados na pia ficam dentro dela
  const basinSurf = {
    minX: sx - hw + 0.03, maxX: sx + hw - 0.03,
    minZ: sz - hd + 0.03, maxZ: sz + hd - 0.03,
    topY: sy - BASIN_DEPTH + 0.014
  };
  if (ctx.supportSurfaces) ctx.supportSurfaces.push(basinSurf);
  floor.userData.supportSurface = basinSurf;
  if (ctx.supportMeshes) ctx.supportMeshes.push(floor);

  const sinkObj = {
    x: sx,
    y: sy,
    z: sz,
    waterStream,
    handle,
    activeUntil: 0,
    nozzleWorld: new THREE.Vector3(sx + nozzleX, sy + 0.03, sz)
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
