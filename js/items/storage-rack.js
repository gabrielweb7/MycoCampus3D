/**
 * Estantes Porta-Pallet e Insumos do Deposito (Sacos 5kg, Luvas, Fitas, Aluminio)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export function addStoragePortaPalletRack(ctx, rx, rz, totalLen, depth, rotY) {
  const floorY = 0.12;
  const rackH = 2.34;
  const rg = new THREE.Group();
  rg.position.set(rx, floorY, rz);
  rg.rotation.y = rotY || 0;

  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.34, metalness: 0.48 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32, metalness: 0.42 });
  const darkFootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 });

  const halfL = totalLen / 2;
  const halfD = depth / 2;
  const colPositions = [-halfL + 0.04, 0, halfL - 0.04];

  colPositions.forEach(function (cx) {
    [-halfD + 0.04, halfD - 0.04].forEach(function (cz) {
      const post = makeBox(0.065, rackH, 0.065, blueMat);
      post.position.set(cx, rackH / 2, cz);
      const foot = makeBox(0.11, 0.018, 0.11, darkFootMat, { noShadow: true });
      foot.position.set(cx, 0.009, cz);
      rg.add(post, foot);
    });
    [0.18, 0.88, 1.58, 2.26].forEach(function (by) {
      const hBrace = makeBox(0.036, 0.036, depth - 0.08, blueMat, { noShadow: true });
      hBrace.position.set(cx, by, 0);
      rg.add(hBrace);
    });
    const diagSpanZ = depth - 0.12;
    const diagSpanY = 0.66;
    const diagLen = Math.hypot(diagSpanZ, diagSpanY);
    const diagAng = Math.atan2(diagSpanY, diagSpanZ);
    [[0.53, 1], [1.23, -1], [1.92, 1]].forEach(function (dg) {
      const dBar = makeBox(0.030, 0.030, diagLen, blueMat, { noShadow: true });
      dBar.position.set(cx, dg[0], 0);
      dBar.rotation.x = dg[1] * diagAng;
      rg.add(dBar);
    });
  });

  const rotSwap = Math.abs(Math.sin(rotY || 0)) > 0.707;
  const worldHalfX = rotSwap ? halfD : halfL;
  const worldHalfZ = rotSwap ? halfL : halfD;
  const shelfLevels = [0.28, 0.96, 1.64];
  shelfLevels.forEach(function (sy) {
    const rSurf = {
      minX: rx - worldHalfX + 0.04, maxX: rx + worldHalfX - 0.04,
      minZ: rz - worldHalfZ + 0.04, maxZ: rz + worldHalfZ - 0.04,
      topY: floorY + sy + 0.038
    };
    ctx.supportSurfaces.push(rSurf);
    [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
      const beam = makeBox(totalLen - 0.04, 0.072, 0.042, orangeMat);
      beam.position.set(0, sy, bz);
      beam.userData.supportSurface = rSurf;
      ctx.supportMeshes.push(beam);
      rg.add(beam);
      colPositions.forEach(function (cx) {
        const bracket = makeBox(0.082, 0.12, 0.082, orangeMat, { noShadow: true });
        bracket.position.set(cx, sy, bz);
        rg.add(bracket);
      });
    });
    const tray = makeBox(totalLen - 0.10, 0.032, depth - 0.08, orangeMat);
    tray.position.set(0, sy + 0.022, 0);
    tray.userData.supportSurface = rSurf;
    ctx.supportMeshes.push(tray);
    rg.add(tray);
  });

  [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
    const topBeam = makeBox(totalLen - 0.04, 0.068, 0.042, orangeMat);
    topBeam.position.set(0, 2.24, bz);
    rg.add(topBeam);
    colPositions.forEach(function (cx) {
      const topBracket = makeBox(0.082, 0.11, 0.082, orangeMat, { noShadow: true });
      topBracket.position.set(cx, 2.24, bz);
      rg.add(topBracket);
    });
  });

  ctx.scene.add(rg);
  ctx.solidColliders.push({
    minX: rx - worldHalfX, maxX: rx + worldHalfX,
    minZ: rz - worldHalfZ, maxZ: rz + worldHalfZ,
    minY: floorY, maxY: floorY + rackH
  });
}

export function makeSubstrateBag5kg(ctx, id, kind, px, py, pz) {
  const sg = new THREE.Group();
  const isGrain = kind === 'grain';
  const bagColor = isGrain ? 0xd97706 : 0x78350f;
  const bag = makeBox(0.30, 0.42, 0.22, bagColor, { roughness: 0.85 });
  bag.position.y = 0.21;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const sctx = c.getContext('2d');
  sctx.fillStyle = '#f8fafc'; sctx.fillRect(0, 0, 256, 128);
  sctx.fillStyle = isGrain ? '#b45309' : '#065f46';
  sctx.fillRect(0, 0, 256, 36);
  sctx.fillStyle = '#ffffff'; sctx.font = 'bold 20px system-ui, sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText(isGrain ? 'GRÃOS • MILHO 5KG' : 'SUBSTRATO BULK 5KG', 128, 25);
  sctx.fillStyle = '#1e293b'; sctx.font = 'bold 18px system-ui, sans-serif';
  sctx.fillText(isGrain ? 'Spawn / Semente' : 'Serragem + Fibra Coco', 128, 72);
  sctx.fillStyle = '#64748b'; sctx.font = '15px system-ui, sans-serif';
  sctx.fillText('Uso Laboratorial • Estoque', 128, 102);
  const lbl = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.12),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })
  );
  lbl.position.set(0, 0.24, 0.112);
  sg.add(bag, lbl);
  const label = isGrain ? 'Saco de Grãos/Milho 5kg' : 'Saco de Substrato (Serragem/Coco) 5kg';
  return registerPickable(ctx, id, label, sg, px, py, pz, 0, 0.26, 0.42, {
    category: 'substrate',
    purpose: isGrain ? 'Grãos de milho para preparo de spawn/semente' : 'Substrato bulk (serragem + fibra de coco) para frutificação',
    weightGrams: 5000,
    baseTempC: 22.6,
    compatibilities: { canEnterCooker: true },
    connections: ['precision_scale', 'spawn_bag', 'pressure_cooker']
  });
}

export function makeGlovesBox(ctx, id, px, py, pz) {
  const gg = new THREE.Group();
  const box = makeBox(0.24, 0.12, 0.13, 0x0284c7, { roughness: 0.45 });
  box.position.y = 0.06;
  const slot = makeBox(0.12, 0.008, 0.05, 0xe0f2fe, { noShadow: true });
  slot.position.set(0, 0.122, 0);
  const strip = makeBox(0.242, 0.04, 0.132, 0xf8fafc, { noShadow: true });
  strip.position.y = 0.085;
  gg.add(box, slot, strip);
  return registerPickable(ctx, id, 'Caixa de Luvas Nitrílicas Estéreis', gg, px, py, pz, 0, 0.18, 0.14, {
    category: 'ppe',
    purpose: 'Equipamento de proteção individual para manipulação asséptica',
    weightGrams: 420,
    baseTempC: 22.5,
    compatibilities: { canEnterCooker: false },
    connections: ['laminar_hood']
  });
}

export function makeTapeRoll(ctx, id, kind, px, py, pz) {
  const tg = new THREE.Group();
  const isMicro = kind === 'micropore';
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, isMicro ? 0.032 : 0.055, 18),
    new THREE.MeshStandardMaterial({ color: isMicro ? 0xf8fafc : 0xe2e8f0, roughness: 0.6 })
  );
  outer.position.y = isMicro ? 0.016 : 0.0275;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, isMicro ? 0.034 : 0.057, 14),
    new THREE.MeshStandardMaterial({ color: isMicro ? 0x0284c7 : 0x7c3aed, roughness: 0.5 })
  );
  core.position.y = outer.position.y;
  tg.add(outer, core);
  const lbl = isMicro ? 'Rolo de Fita Micropore (Troca Gasosa)' : 'Rolo de Parafilm M (Vedação Petri)';
  return registerPickable(ctx, id, lbl, tg, px, py, pz, 0, 0.08, 0.06, {
    category: 'consumable',
    purpose: isMicro ? 'Permitir troca gasosa estéril em frascos e bags' : 'Vedar placas de Petri contra contaminação',
    weightGrams: 65,
    baseTempC: 22.5,
    compatibilities: { canEnterCooker: false },
    connections: [isMicro ? 'spawn_jar' : 'petri_dish']
  });
}

export function makeFoilRoll(ctx, id, px, py, pz) {
  const fg = new THREE.Group();
  const box = makeBox(0.32, 0.065, 0.065, 0xdc2626, { roughness: 0.45 });
  box.position.y = 0.0325;
  const band = makeBox(0.322, 0.025, 0.067, 0xfef08a, { noShadow: true });
  band.position.y = 0.04;
  fg.add(box, band);
  return registerPickable(ctx, id, 'Papel Alumínio (Autoclave)', fg, px, py, pz, 0, 0.18, 0.08, {
    category: 'consumable',
    purpose: 'Proteger tampas e gargalos contra umidade na autoclave',
    weightGrams: 260,
    baseTempC: 22.5,
    compatibilities: { canEnterCooker: false },
    connections: ['pressure_cooker', 'spawn_jar', 'liquid_culture']
  });
}
