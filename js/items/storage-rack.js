/**
 * Estantes Porta-Pallet e Insumos do Deposito (Sacos 5kg, Luvas, Fitas, Aluminio)
 */

import { makeChamferedBox, makePouch } from './lab-prop-shapes.js';
import { makeBox } from '../engine/textures.js';
import { getCachedCanvasTexture, registerPickable } from './item-registry.js';

const THREE = window.THREE;

function makeTapeGeometry(innerRadius, outerRadius, height) {
  const bottom = -height / 2;
  const top = height / 2;
  const profile = [[innerRadius, bottom], [outerRadius, bottom], [outerRadius, top], [innerRadius, top], [innerRadius, bottom]];
  return new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), 16);
}

let sharedRackAssets = null;
function getRackSharedAssets() {
  if (sharedRackAssets) return sharedRackAssets;
  sharedRackAssets = {
    lblGeo: new THREE.PlaneGeometry(0.24, 0.12),
    microOuterGeo: makeTapeGeometry(0.034, 0.055, 0.032),
    microCoreGeo: makeTapeGeometry(0.029, 0.037, 0.034),
    paraOuterGeo: makeTapeGeometry(0.034, 0.055, 0.055),
    paraCoreGeo: makeTapeGeometry(0.029, 0.037, 0.057),
    microOuterMat: new THREE.MeshStandardMaterial({ color: 0xe8d8bb, roughness: 0.73 }),
    microCoreMat: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 }),
    paraOuterMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 }),
    paraCoreMat: new THREE.MeshStandardMaterial({ color: 0xa490b8, roughness: 0.66 })
  };
  Object.keys(sharedRackAssets).forEach((k) => { sharedRackAssets[k].userData.shared = true; });
  return sharedRackAssets;
}

export function addStoragePortaPalletRack(ctx, rx, rz, totalLen, depth, rotY) {
  const floorY = 0.12;
  const rackH = 2.34;
  const rg = new THREE.Group();
  rg.position.set(rx, floorY, rz);
  rg.rotation.y = rotY || 0;

  const blueMat = new THREE.MeshStandardMaterial({ color: 0x526d69, roughness: 0.58, metalness: 0.24 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xbc806c, roughness: 0.59, metalness: 0.19 });
  const darkFootMat = new THREE.MeshStandardMaterial({ color: 0x414e49, roughness: 0.63, metalness: 0.16 });

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
  const A = getRackSharedAssets();
  const sg = new THREE.Group();
  const isWheat = kind === 'wheat';
  const isSorghum = kind === 'sorghum';
  const isVerm = kind === 'vermiculite';
  const isSawdust = kind === 'sawdust';
  const isCoco = kind === 'coco';
  const isGrain = kind === 'grain' || kind === 'corn' || isWheat || isSorghum;
  const bagColor = isWheat ? 0xd3b76d : (isSorghum ? 0xb37071 : (isGrain ? 0xc8975d : (isVerm ? 0xbd8264 : (isSawdust ? 0xc4a077 : 0x8f6b55))));
  const bag = makePouch(0.30, 0.42, 0.22,
    new THREE.MeshStandardMaterial({ color: bagColor, roughness: 0.88, flatShading: true }));
  bag.position.y = 0.21;
  const variantKey = isWheat ? 'wheat' : (isSorghum ? 'sorghum' : (isGrain ? 'grain' : (isVerm ? 'vermiculite' : (isSawdust ? 'sawdust' : 'coco'))));
  const lblTex = getCachedCanvasTexture(`substrate_bag_lbl_${variantKey}`, 256, 128, (sctx) => {
    sctx.fillStyle = '#f8fafc'; sctx.fillRect(0, 0, 256, 128);
    sctx.fillStyle = isWheat ? '#ca8a04' : (isSorghum ? '#991b1b' : (isGrain ? '#b45309' : (isVerm ? '#d97706' : (isSawdust ? '#a16207' : '#4a2c18'))));
    sctx.fillRect(0, 0, 256, 36);
    sctx.fillStyle = '#ffffff'; sctx.font = 'bold 20px system-ui, sans-serif';
    sctx.textAlign = 'center';
    const titleTxt = isWheat ? 'GRÃOS • TRIGO 5KG' : (isSorghum ? 'GRÃOS • SORGO 5KG' : (isGrain ? 'GRÃOS • MILHO 5KG' : (isVerm ? 'VERMICULITA 5KG' : (isSawdust ? 'SERRAGEM • MADEIRA 5KG' : 'PÓ DE COCO 5KG'))));
    sctx.fillText(titleTxt, 128, 25);
    sctx.fillStyle = '#1e293b'; sctx.font = 'bold 17px system-ui, sans-serif';
    sctx.fillText(isGrain ? 'Preparo de Spawn' : (isVerm ? 'Misture c/ Pó de Coco' : (isSawdust ? 'Blocos Gourmet Madeira' : 'Misture c/ Vermiculita')), 128, 72);
    sctx.fillStyle = '#64748b'; sctx.font = '15px system-ui, sans-serif';
    sctx.fillText(isGrain ? 'Uso Laboratorial • Estoque' : 'Substrato • Uso c/ Água', 128, 102);
  });
  const lbl = new THREE.Mesh(
    A.lblGeo,
    new THREE.MeshBasicMaterial({ map: lblTex })
  );
  lbl.position.set(0, 0.18, 0.112);
  const seam = makeChamferedBox(0.286, 0.025, 0.071, 0.007, 0xc5ac7b);
  seam.position.y = 0.404;
  sg.add(bag, lbl, seam);
  sg.userData.firstPersonGrip = { x: 0.075, y: 0.132, z: 0.116 };
  const label = isWheat
    ? 'Saco de Trigo em Grão 5kg'
    : (isSorghum
      ? 'Saco de Sorgo Vermelho 5kg'
      : (isGrain
        ? 'Saco de Milho de Pipoca 5kg'
        : (isVerm ? 'Saco de Vermiculita 5kg' : (isSawdust ? 'Saco de Serragem de Eucalipto 5kg' : 'Saco de Pó de Coco 5kg'))));
  const purpose = isWheat
    ? 'Grãos de trigo para preparo de spawn/semente'
    : (isSorghum
      ? 'Grãos de sorgo vermelho para preparo de spawn/semente'
      : (isGrain
        ? 'Milho de pipoca para preparo de spawn/semente ou cozimento na panela'
        : (isVerm
          ? 'Vermiculita expandida: misture com Pó de Coco + Água no Pote, mexa c/ Colher, leve à Bag e Pasteurize'
          : (isSawdust
            ? 'Serragem de madeira nobre para blocos gourmet (Juba de Leão, Shimeji, Reishi, Shiitake)'
            : 'Pó de Coco seco: misture com Vermiculita + Água no Pote, mexa c/ Colher, leve à Bag e Pasteurize'))));
  return registerPickable(ctx, id, label, sg, px, py, pz, 0, 0.26, 0.42, {
    category: 'substrate',
    purpose,
    weightGrams: 5000,
    baseTempC: 22.6,
    compatibilities: { canEnterCooker: false },
    connections: isGrain
      ? ['precision_scale', 'spawn_bag', 'spawn_jar', 'pressure_cooker']
      : ['mixing_bowl', 'precision_scale', 'spawn_bag', 'monotub_24l']
  });
}

export function makeGlovesBox(ctx, id, px, py, pz) {
  const gg = new THREE.Group();
  const box = makeChamferedBox(0.24, 0.12, 0.13, 0.013, 0xa38bb0);
  box.position.y = 0.06;
  const rim = makeChamferedBox(0.139, 0.011, 0.054, 0.004, 0x71816a);
  rim.position.y = 0.122;
  const slot = makeChamferedBox(0.114, 0.008, 0.037, 0.003, 0x544962);
  slot.position.y = 0.126;
  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.030, 8, 5),
    new THREE.MeshStandardMaterial({ color: 0xb69ad3, roughness: 0.72, flatShading: true }));
  glove.position.set(0.020, 0.131, 0.012);
  glove.scale.set(1, 0.28, 0.68);
  gg.add(box, rim, slot, glove);
  gg.userData.firstPersonGrip = { x: 0.067, y: 0.031, z: 0.074 };
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
  const A = getRackSharedAssets();
  const tg = new THREE.Group();
  const isMicro = kind === 'micropore';
  const outer = new THREE.Mesh(
    isMicro ? A.microOuterGeo : A.paraOuterGeo,
    isMicro ? A.microOuterMat : A.paraOuterMat
  );
  outer.position.y = isMicro ? 0.016 : 0.0275;
  const core = new THREE.Mesh(
    isMicro ? A.microCoreGeo : A.paraCoreGeo,
    isMicro ? A.microCoreMat : A.paraCoreMat
  );
  core.position.y = outer.position.y;
  const looseEnd = makeChamferedBox(0.028, 0.003, 0.029, 0.0008, outer.material);
  looseEnd.position.set(0.035, outer.position.y * 1.45, 0.045);
  looseEnd.rotation.set(-0.44, 0.42, 0);
  tg.add(outer, core, looseEnd);
  tg.userData.firstPersonGrip = { x: 0.012, y: outer.position.y, z: 0.060 };
  tg.userData.isMicropore = isMicro;
  tg.userData.isParafilm = !isMicro;
  const lbl = isMicro ? 'Rolo de Fita Micropore (Troca Gasosa)' : 'Rolo de Parafilm M (Vedação Petri)';
  return registerPickable(ctx, id, lbl, tg, px, py, pz, 0, 0.08, 0.06, {
    category: 'consumable',
    purpose: isMicro ? 'Permitir troca gasosa estéril em frascos, PP5 e Monotubs' : 'Vedar placas de Petri contra contaminação',
    weightGrams: 65,
    baseTempC: 22.5,
    compatibilities: { canEnterCooker: false },
    connections: [isMicro ? 'spawn_jar' : 'petri_dish']
  });
}

export function makeFoilRoll(ctx, id, px, py, pz) {
  const fg = new THREE.Group();
  const box = makeChamferedBox(0.32, 0.065, 0.065, 0.008, 0xa882a1);
  box.position.y = 0.0325;
  const band = makeChamferedBox(0.314, 0.025, 0.066, 0.005, 0xd9c2a5);
  band.position.y = 0.04;
  const foil = makeChamferedBox(0.28, 0.003, 0.048, 0.001,
    new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.37, metalness: 0.45 }));
  foil.position.set(0, 0.055, -0.035);
  foil.rotation.x = -0.43;
  fg.add(box, band, foil);
  fg.userData.firstPersonGrip = { x: 0.072, y: 0.019, z: 0.045 };
  fg.userData.isFoilRoll = true;
  return registerPickable(ctx, id, 'Papel Alumínio (Autoclave)', fg, px, py, pz, 0, 0.18, 0.08, {
    category: 'consumable',
    purpose: 'Proteger tampas e gargalos contra umidade na autoclave',
    weightGrams: 260,
    baseTempC: 22.5,
    compatibilities: { canEnterCooker: false },
    connections: ['pressure_cooker', 'spawn_jar', 'liquid_culture']
  });
}
