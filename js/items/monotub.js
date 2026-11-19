/**
 * Monotub em Caixa Organizadora Transparente de 24L + Estante Exclusiva com LED Direcional (MycoCampus3D)
 *
 * Fluxo completo realista:
 * 1. Abrir a tampa articulada/removível da Caixa 24L.
 * 2. Passar Álcool 70% (3 borrifadas) e secar com Papel Toalha para desinfectar (evita Trichoderma).
 * 3. Adicionar Spawn Colonizado (grãos colonizados de Bag, Vidro ou PP5).
 * 4. Adicionar Substrato Pasteurizado (Vermiculita + Pó de Coco + Água pasteurizados).
 * 5. Misturar o spawn com o substrato dentro da caixa.
 * 6. Nivelar o bolo (SÓ pode nivelar depois de misturar!).
 * 7. Fechar a tampa e aguardar colonizar até 100%.
 * 8. Levar para a Estante Exclusiva de Monotubes com Luz LED embaixo de cada prateleira para orientar os pins.
 * 9. Frutificar e colher até 4 Flushs (se não contaminar por Trichoderma).
 * 10. Após o 4º Flush, o bolo fica com aparência seca/esgotada para ser levado à Caixa de Substrato da Horta!
 */

import { makeBox } from '../engine/textures.js';
import { getCachedCanvasTexture, registerPickable, updateItemBounds } from './item-registry.js';
import { getSanitizationStatus } from './alcohol-spray.js';

const THREE = window.THREE;

export const MONOTUB_MAX_FLUSHES = 4;
export const monotubRackSlots = [];
export const monotubRackHitMeshes = [];

function playAudio(method) {
  if (typeof window !== 'undefined' && window.MycoAudio && typeof window.MycoAudio[method] === 'function') {
    window.MycoAudio[method]();
  }
}

let sharedMonotubAssets = null;

function getSharedMonotubAssets() {
  if (sharedMonotubAssets) return sharedMonotubAssets;
  const cocoTex = getCachedCanvasTexture('monotub_coco_verm_tex', 128, 128, (c) => {
    c.fillStyle = '#3b2314';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = i % 5 === 0 ? '#d6b370' : (i % 2 === 0 ? '#4a2c18' : '#29170b');
      c.fillRect(Math.random() * 124, Math.random() * 124, 3, 3);
    }
  });
  const spentTex = getCachedCanvasTexture('monotub_spent_dry_tex', 128, 128, (c) => {
    c.fillStyle = '#574c41';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#29221c';
    c.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      c.beginPath();
      const x = Math.random() * 120;
      const y = Math.random() * 120;
      c.moveTo(x, y);
      c.lineTo(x + (Math.random() - 0.5) * 38, y + (Math.random() - 0.5) * 38);
      c.stroke();
    }
  });

  sharedMonotubAssets = {
    clearPlasticMat: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.34,
      roughness: 0.14,
      metalness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide
    }),
    lidPlasticMat: new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.44,
      roughness: 0.18,
      depthWrite: false
    }),
    blackLinerMat: new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.72,
      metalness: 0.08
    }),
    latchMat: new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.45,
      metalness: 0.25
    }),
    polyfillMat: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95
    }),
    cocoSubMat: new THREE.MeshStandardMaterial({
      map: cocoTex,
      roughness: 0.92
    }),
    spentDryMat: new THREE.MeshStandardMaterial({
      map: spentTex,
      roughness: 0.98
    }),
    grainDotMat: new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.75
    }),
    stemMat: new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.65
    }),
    capMat: new THREE.MeshStandardMaterial({
      color: 0xc27838,
      roughness: 0.42
    }),
    pinMat: new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.55
    }),
    polyfillGeo: new THREE.SphereGeometry(0.021, 10, 8),
    moundGeo: new THREE.SphereGeometry(0.042, 10, 8),
    grainGeo: new THREE.SphereGeometry(0.014, 8, 6),
    stemGeo: new THREE.CylinderGeometry(0.008, 0.012, 0.075, 8),
    capGeo: new THREE.SphereGeometry(0.024, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    pinGeo: new THREE.SphereGeometry(0.009, 8, 6)
  };
  Object.keys(sharedMonotubAssets).forEach((k) => {
    const v = sharedMonotubAssets[k];
    if (v && v.userData) v.userData.shared = true;
  });
  return sharedMonotubAssets;
}

export function getMonotubMeta() {
  return {
    category: 'fruiting_chamber',
    purpose: 'Caixa Monotub 24L transparente com furos de lã acrílica (polyfill), liner preto e tampa para cultivo bulk até 4 flushs',
    getWeightGrams: (item) => {
      const mc = item && item.monotubCtrl;
      if (!mc) return 680;
      let w = 680;
      if (mc.hasSpawn) w += 750;
      if (mc.hasBulk) w += 1600;
      if (mc.spent) w -= 900;
      return w;
    },
    getTempC: (item) => {
      const mc = item && item.monotubCtrl;
      if (!mc) return 23.5;
      return mc.contaminated ? 27.2 : (mc.onLedRack ? 23.2 : 24.4);
    },
    compatibilities: {
      canEnterCooker: false,
      isMonotub24L: true
    },
    connections: ['alcohol_spray', 'paper_towel', 'spawn_bag_1500', 'spawn_jar_800', 'monotub_led_rack', 'campus_garden_compost']
  };
}

export function updateMonotubVisual(item) {
  if (!item || !item.monotubCtrl) return;
  const mc = item.monotubCtrl;
  const A = getSharedMonotubAssets();

  if (mc.lidPivot) {
    mc.lidPivot.rotation.x = mc.lidOpen ? -1.32 : 0;
  }

  const hasAnyContent = mc.hasSpawn || mc.hasBulk;
  if (mc.cakeMesh) {
    mc.cakeMesh.visible = hasAnyContent;
    if (hasAnyContent) {
      mc.cakeMesh.material = mc.spent ? A.spentDryMat : A.cocoSubMat;
      if (mc.spent) {
        mc.cakeMesh.scale.set(0.88, 0.68, 0.88);
        mc.cakeMesh.position.y = 0.042;
      } else {
        const fillH = (mc.hasSpawn && mc.hasBulk) ? 1.0 : 0.58;
        mc.cakeMesh.scale.set(1.0, fillH, 1.0);
        mc.cakeMesh.position.y = 0.055 * fillH;
      }
    }
  }

  if (mc.grainPreviewGroup) {
    mc.grainPreviewGroup.visible = mc.hasSpawn && !mc.mixed && !mc.spent;
  }

  if (mc.roughMoundsGroup) {
    mc.roughMoundsGroup.visible = hasAnyContent && !mc.leveled && !mc.spent;
  }

  if (mc.myceliumMesh) {
    const showMyc = (mc.colonization > 0 || mc.contaminated) && !mc.spent;
    mc.myceliumMesh.visible = showMyc;
    if (showMyc) {
      const f = Math.max(0.08, Math.min(1, mc.colonization / 100));
      mc.myceliumMesh.material.color.setHex(mc.contaminated ? 0x15803d : 0xf8fafc);
      mc.myceliumMesh.material.opacity = mc.contaminated ? 0.86 : (0.18 + f * 0.76);
      mc.myceliumMesh.scale.set(0.95 + 0.05 * f, 1, 0.95 + 0.05 * f);
    }
  }

  if (mc.pinsGroup) {
    mc.pinsGroup.visible = !mc.spent && !mc.contaminated && mc.fruitingStage === 1;
  }

  if (mc.mushCanopyGroup) {
    const showCanopy = !mc.spent && !mc.contaminated && (mc.fruitingStage === 2 || mc.fruitingStage === 3);
    mc.mushCanopyGroup.visible = showCanopy;
    if (showCanopy) {
      const s = mc.fruitingStage === 2 ? 0.55 : 1.0;
      mc.mushCanopyGroup.scale.set(1, s, 1);
    }
  }

  // Atualiza label detalhado de cada etapa
  const spTag = mc.speciesName ? ` • ${mc.speciesName}` : '';
  if (mc.contaminated) {
    item.label = `Caixa Monotub 24L (🦠 Contaminado por ${mc.contamReason || 'Trichoderma'}! Descarte)`;
  } else if (mc.spent) {
    item.label = `Caixa Monotub 24L (🍂 Bolo Seco Esgotado • 4/4 Flushs — Leve à Horta!)`;
  } else if (mc.fruitingStage === 3) {
    item.label = `Caixa Monotub 24L (🍄 MADURO p/ Colheita! Flush ${mc.flush}/${MONOTUB_MAX_FLUSHES}${spTag})`;
  } else if (mc.fruitingStage === 2) {
    item.label = `Caixa Monotub 24L (🌱 Cogumelos Crescendo ${Math.floor(mc.growth)}% • Flush ${mc.flush}/${MONOTUB_MAX_FLUSHES}${spTag})`;
  } else if (mc.fruitingStage === 1) {
    item.label = `Caixa Monotub 24L (✨ Primórdios/Pins ${Math.floor(mc.growth)}% • Flush ${mc.flush}/${MONOTUB_MAX_FLUSHES}${spTag})`;
  } else if (mc.colonization >= 100) {
    item.label = mc.onLedRack
      ? `Caixa Monotub 24L (💡 Sob Luz LED • Iniciando Flush ${mc.flush}/${MONOTUB_MAX_FLUSHES}${spTag})`
      : `Caixa Monotub 24L (✅ 100% Colonizado! Leve para a Estante LED de Monotubes${spTag})`;
  } else if (mc.leveled) {
    item.label = mc.lidOpen
      ? `Caixa Monotub 24L (Bolo Nivelado • Feche a tampa para colonizar${spTag})`
      : `Caixa Monotub 24L (Colonizando ${Math.floor(mc.colonization)}%${spTag})`;
  } else if (mc.mixed) {
    item.label = `Caixa Monotub 24L (Misturado • Clique para NIVELAR o bolo${spTag})`;
  } else if (mc.hasSpawn && mc.hasBulk) {
    item.label = `Caixa Monotub 24L (Spawn + Substrato • Clique para MISTURAR${spTag})`;
  } else if (mc.hasSpawn && !mc.hasBulk) {
    item.label = `Caixa Monotub 24L (Com Spawn${spTag} • Adicione Substrato Pasteurizado)`;
  } else if (!mc.hasSpawn && mc.hasBulk) {
    item.label = `Caixa Monotub 24L (Com Substrato • Adicione Spawn Colonizado)`;
  } else if (mc.lidOpen) {
    item.label = mc.boxSanitized
      ? 'Caixa Monotub 24L (Aberta & Higienizada ✨ • Adicione Spawn e Substrato Pasteurizado)'
      : 'Caixa Monotub 24L (Aberta • Passe Álcool 70% e seque com Papel Toalha)';
  } else {
    item.label = 'Caixa Monotub 24L Transparente (Fechada • Clique para abrir a tampa)';
  }
}

export function resetMonotubToCleanEmpty(item) {
  if (!item || !item.monotubCtrl) return false;
  const mc = item.monotubCtrl;
  mc.hasSpawn = false;
  mc.hasBulk = false;
  mc.mixed = false;
  mc.leveled = false;
  mc.colonization = 0;
  mc.fruitingStage = 0;
  mc.growth = 0;
  mc.flush = 1;
  mc.contaminated = false;
  mc.contamReason = '';
  mc.spent = false;
  mc.speciesName = '';
  mc.boxSanitized = false;
  updateMonotubVisual(item);
  return true;
}

export function makeMonotub24L(ctx, id, px, py, pz, opts = {}) {
  const A = getSharedMonotubAssets();
  const group = new THREE.Group();

  const W = 0.44;
  const H = 0.25;
  const D = 0.30;

  // 1. Liner preto na parte inferior (como na Foto 1)
  const linerH = 0.095;
  const linerBox = makeBox(W + 0.004, linerH, D + 0.004, A.blackLinerMat);
  linerBox.position.y = linerH * 0.5;
  group.add(linerBox);

  // 2. Corpo transparente de 24L (paredes translúcidas)
  const bodyWallF = makeBox(W, H, 0.006, A.clearPlasticMat, { noShadow: true });
  bodyWallF.position.set(0, H * 0.5, D * 0.5);
  const bodyWallB = makeBox(W, H, 0.006, A.clearPlasticMat, { noShadow: true });
  bodyWallB.position.set(0, H * 0.5, -D * 0.5);
  const bodyWallL = makeBox(0.006, H, D, A.clearPlasticMat, { noShadow: true });
  bodyWallL.position.set(-W * 0.5, H * 0.5, 0);
  const bodyWallR = makeBox(0.006, H, D, A.clearPlasticMat, { noShadow: true });
  bodyWallR.position.set(W * 0.5, H * 0.5, 0);
  group.add(bodyWallF, bodyWallB, bodyWallL, bodyWallR);

  // 3. Presilhas pretas nas alças laterais (esquerda e direita)
  [-1, 1].forEach((side) => {
    const latch = makeBox(0.024, 0.055, 0.11, A.latchMat, { noShadow: true });
    latch.position.set(side * (W * 0.5 + 0.012), H - 0.025, 0);
    group.add(latch);
  });

  // 4. Furos de FAE com tufos brancos de lã acrílica (polyfill plugs) nas laterais
  const plugCoords = [
    [-0.13, 0.16, D * 0.5 + 0.008],
    [0.0, 0.17, D * 0.5 + 0.008],
    [0.13, 0.16, D * 0.5 + 0.008],
    [-0.13, 0.16, -D * 0.5 - 0.008],
    [0.0, 0.17, -D * 0.5 - 0.008],
    [0.13, 0.16, -D * 0.5 - 0.008],
    [-W * 0.5 - 0.008, 0.18, 0],
    [W * 0.5 + 0.008, 0.18, 0]
  ];
  for (let pi = 0; pi < plugCoords.length; pi++) {
    const pc = plugCoords[pi];
    const plug = new THREE.Mesh(A.polyfillGeo, A.polyfillMat);
    plug.position.set(pc[0], pc[1], pc[2]);
    group.add(plug);
  }

  // 5. Tampa transparente articulada
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D * 0.5);
  const lidPlate = makeBox(W + 0.018, 0.016, D + 0.018, A.lidPlasticMat, { noShadow: true });
  lidPlate.position.set(0, 0.008, D * 0.5);
  lidPivot.add(lidPlate);
  group.add(lidPivot);

  // 6. Bolo interno de substrato (Vermiculita + Pó de Coco + Spawn)
  const cakeMesh = makeBox(W - 0.024, 0.09, D - 0.024, A.cocoSubMat);
  cakeMesh.position.y = 0.055;
  cakeMesh.visible = false;
  group.add(cakeMesh);

  // Grãos visíveis antes de misturar
  const grainPreviewGroup = new THREE.Group();
  for (let gi = 0; gi < 18; gi++) {
    const gDot = new THREE.Mesh(A.grainGeo, A.grainDotMat);
    gDot.position.set(( (gi % 6) - 2.5 ) * 0.055, 0.095, (Math.floor(gi / 6) - 1) * 0.065);
    grainPreviewGroup.add(gDot);
  }
  grainPreviewGroup.visible = false;
  group.add(grainPreviewGroup);

  // Montinhos irregulares antes de NIVELAR o bolo
  const roughMoundsGroup = new THREE.Group();
  for (let mi = 0; mi < 12; mi++) {
    const mound = new THREE.Mesh(A.moundGeo, A.cocoSubMat);
    mound.scale.set(1.2, 0.55, 1.1);
    mound.position.set(((mi % 4) - 1.5) * 0.085, 0.095 + (mi % 2) * 0.012, (Math.floor(mi / 4) - 1) * 0.075);
    roughMoundsGroup.add(mound);
  }
  roughMoundsGroup.visible = false;
  group.add(roughMoundsGroup);

  // Camada de micélio branco cobrindo o bolo nivelado
  const mycMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.0,
    roughness: 0.85
  });
  const myceliumMesh = makeBox(W - 0.022, 0.012, D - 0.022, mycMat);
  myceliumMesh.position.y = 0.102;
  myceliumMesh.visible = false;
  group.add(myceliumMesh);

  // Primórdios (pins)
  const pinsGroup = new THREE.Group();
  for (let p = 0; p < 20; p++) {
    const pin = new THREE.Mesh(A.pinGeo, A.pinMat);
    pin.position.set(((p % 5) - 2) * 0.068, 0.11, (Math.floor(p / 5) - 1.5) * 0.058);
    pinsGroup.add(pin);
  }
  pinsGroup.visible = false;
  group.add(pinsGroup);

  // Dossel denso de cogumelos (Canopy igual à Foto 2!)
  const mushCanopyGroup = new THREE.Group();
  for (let mx = -3; mx <= 3; mx++) {
    for (let mz = -2; mz <= 2; mz++) {
      const jitX = ((mx * 7 + mz * 13) % 5) * 0.004;
      const jitZ = ((mx * 11 - mz * 5) % 5) * 0.004;
      const stem = new THREE.Mesh(A.stemGeo, A.stemMat);
      stem.position.set(mx * 0.052 + jitX, 0.138, mz * 0.050 + jitZ);
      const cap = new THREE.Mesh(A.capGeo, A.capMat);
      cap.position.set(mx * 0.052 + jitX, 0.176, mz * 0.050 + jitZ);
      mushCanopyGroup.add(stem, cap);
    }
  }
  mushCanopyGroup.visible = false;
  group.add(mushCanopyGroup);

  group.userData.isMonotub = true;

  const item = registerPickable(
    ctx,
    id,
    'Caixa Monotub 24L Transparente (Fechada • Clique para abrir a tampa)',
    group,
    px,
    py,
    pz,
    opts.ry || 0,
    0.26,
    0.26,
    getMonotubMeta()
  );

  item.monotubCtrl = {
    lidOpen: Boolean(opts.lidOpen),
    boxSanitized: Boolean(opts.boxSanitized),
    hasSpawn: Boolean(opts.hasSpawn),
    hasBulk: Boolean(opts.hasBulk),
    mixed: Boolean(opts.mixed),
    leveled: Boolean(opts.leveled),
    colonization: opts.colonization || 0,
    onLedRack: Boolean(opts.onLedRack),
    rackSlotId: opts.rackSlotId !== undefined ? opts.rackSlotId : -1,
    fruitingStage: opts.fruitingStage || 0, // 0=colonizado, 1=pins, 2=crescendo, 3=maduro
    growth: opts.growth || 0,
    flush: opts.flush || 1,
    contaminated: Boolean(opts.contaminated),
    contamReason: opts.contamReason || '',
    spent: Boolean(opts.spent),
    speciesName: opts.speciesName || '',
    asepticScore: opts.asepticScore !== undefined ? opts.asepticScore : 1,
    lidPivot,
    cakeMesh,
    grainPreviewGroup,
    roughMoundsGroup,
    myceliumMesh,
    pinsGroup,
    mushCanopyGroup,
    updateVisual: () => updateMonotubVisual(item)
  };

  updateMonotubVisual(item);
  return item;
}

/**
 * Cria um item pegável representando um Bolo Seco Esgotado (após 4 flushs na Estufa ou Monotub)
 * para o jogador levar até a Caixa de Substrato da Horta lá fora!
 */
export function makeSpentCakeItem(ctx, id, speciesName, px, py, pz) {
  const A = getSharedMonotubAssets();
  const g = new THREE.Group();
  const block = makeBox(0.30, 0.11, 0.22, A.spentDryMat);
  block.position.y = 0.055;
  g.add(block);
  g.userData.isSpentCake = true;

  const sp = speciesName || 'Cogumelo';
  const item = registerPickable(
    ctx,
    id,
    `🍂 Bolo Seco Esgotado (${sp} • 4/4 Flushs — Leve à Caixa de Substrato da Horta)`,
    g,
    px,
    py,
    pz,
    0,
    0.20,
    0.14,
    {
      category: 'spent_substrate',
      purpose: 'Substrato micelial exaurido após 4 flushs; excelente adubo orgânico na Caixa de Substrato da Horta ou descarte na lixeira',
      weightGrams: 550,
      compatibilities: { canEnterCooker: false, isSpentMushroomCake: true }
    }
  );
  item.spentCakeCtrl = { speciesName: sp };
  return item;
}

/**
 * Verifica se o recipiente segurado contém Substrato Pasteurizado (Vermiculita + Pó de Coco)
 */
export function isHoldingPasteurizedBulkSubstrate(held) {
  if (!held) return false;
  if (held.spawnCtrl) {
    const sc = held.spawnCtrl;
    const isBulkKind = sc.substrateKind === 'coco_verm' || sc.substrateKind === 'sawdust' || sc.substrateKind === 'coco' || sc.substrateKind === 'vermiculite';
    return !!(sc.filled && isBulkKind && (sc.pasteurized || sc.sterilized) && !sc.inoculated && !sc.contaminated && !sc.burned);
  }
  if (held.bowlCtrl) {
    const bc = held.bowlCtrl;
    const hasCocoOrVerm = (bc.ingredients.coco || 0) > 0 || (bc.ingredients.vermiculite || 0) > 0 || (bc.ingredients.sawdust || 0) > 0;
    return !!(bc.mixed && hasCocoOrVerm && (bc.ingredients.water || 0) >= 50);
  }
  return false;
}

/**
 * Verifica se o recipiente segurado é um Spawn de Grãos 100% Colonizado
 */
export function isHoldingColonizedGrainSpawn(held) {
  if (!held || !held.spawnCtrl) return false;
  const sc = held.spawnCtrl;
  return !!(sc.filled && sc.colonized && !sc.contaminated && !sc.burned && !sc.expired);
}

/**
 * Interação contextual com uma Caixa Monotub 24L
 */
export function interactMonotub(ctx, tubItem) {
  if (!tubItem || !tubItem.monotubCtrl) return false;
  const mc = tubItem.monotubCtrl;
  const held = ctx.heldItem;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;

  // Se o jogador acabou de higienizar a caixa aberta com Álcool 70% + Papel Toalha, marca boxSanitized
  const san = getSanitizationStatus(tubItem, ctx);
  if (san && san.isSanitized) {
    mc.boxSanitized = true;
  }

  // 1. Se o bolo está MADURO (fruitingStage === 3): colher o flush!
  if (!mc.spent && !mc.contaminated && mc.fruitingStage === 3) {
    if (window.MycoAudio && window.MycoAudio.playHarvest) window.MycoAudio.playHarvest();
    if (ctx.callbacks && ctx.callbacks.onHarvestGreenhouse) {
      ctx.callbacks.onHarvestGreenhouse({
        id: 'monotub_' + tubItem.id,
        name: mc.speciesName || 'Cubensis (Monotub 24L)',
        rackName: 'Estante LED Monotub',
        tier: 1,
        flush: mc.flush
      });
    }
    if (mc.flush >= MONOTUB_MAX_FLUSHES) {
      mc.spent = true;
      mc.fruitingStage = 0;
      mc.growth = 0;
      updateMonotubVisual(tubItem);
      if (onToast) {
        onToast(`🍂 4º Flush colhido! O bolo do Monotub 24L secou e esgotou os nutrientes. Leve-o para a Caixa de Substrato na Horta lá fora!`);
      }
    } else {
      const doneFlush = mc.flush;
      mc.flush++;
      mc.fruitingStage = 1;
      mc.growth = 0;
      updateMonotubVisual(tubItem);
      if (onToast) {
        onToast(`🍄 Flush ${doneFlush}/${MONOTUB_MAX_FLUSHES} colhido do Monotub 24L! Iniciando Flush ${mc.flush}/${MONOTUB_MAX_FLUSHES} sob a luz LED!`);
      }
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 2. Se a tampa está fechada, o clique abre a tampa (exceto se já estiver nivelado/colonizando, onde alterna)
  if (!mc.lidOpen && !mc.hasSpawn && !mc.hasBulk) {
    mc.lidOpen = true;
    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    updateMonotubVisual(tubItem);
    if (onToast) {
      onToast('📦 Tampa do Monotub 24L aberta! Passe Álcool 70% e seque com Papel Toalha antes de montar.');
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 3. Se está segurando Spawn Colonizado -> despejar no Monotub aberto
  if (held && isHoldingColonizedGrainSpawn(held)) {
    if (!mc.lidOpen) {
      mc.lidOpen = true;
      updateMonotubVisual(tubItem);
      if (onToast) onToast('📦 Tampa aberta! Clique novamente para despejar o Spawn Colonizado.');
      return true;
    }
    if (mc.hasSpawn) {
      if (onToast) onToast('⚠️ Este Monotub 24L já recebeu o Spawn Colonizado! Agora adicione o Substrato Pasteurizado.');
      return true;
    }
    const sc = held.spawnCtrl;
    mc.hasSpawn = true;
    mc.speciesName = sc.speciesName || 'Psilocybe cubensis';
    if (!mc.boxSanitized && !(san && san.isSanitized)) {
      mc.asepticScore = 0.35; // Risco maior de Trichoderma por não ter passado álcool + papel toalha na caixa!
    } else {
      mc.asepticScore = (ctx.wearingGloves && !ctx.glovesExpired) ? 1.0 : 0.7;
    }
    // Esvazia o recipiente de spawn para reutilização
    sc.filled = false;
    sc.fillGrams = 0;
    sc.waterMl = 0;
    sc.substrateKind = '';
    sc.sterilized = false;
    sc.pasteurized = false;
    sc.sterilizeProgress = 0;
    sc.sealed = false;
    sc.inoculated = false;
    sc.colonized = false;
    sc.colonization = 0;
    if (sc.fillMesh) sc.fillMesh.visible = false;
    if (sc.mycOverlay) sc.mycOverlay.visible = false;
    if (held.meta && held.meta.compatibilities) {
      held.meta.compatibilities.receivesSubstrate = true;
      held.meta.compatibilities.receivesSyringe = false;
    }
    sc.updateVisual();
    updateMonotubVisual(tubItem);
    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
    if (onToast) {
      onToast(mc.hasBulk
        ? `🌾 Spawn de ${mc.speciesName} adicionado ao Monotub 24L! Agora clique na caixa para MISTURAR o spawn com o substrato.`
        : `🌾 Spawn de ${mc.speciesName} adicionado ao Monotub 24L! Agora adicione o Substrato Pasteurizado (Vermiculita + Pó de Coco).`);
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 4. Se está segurando Substrato Pasteurizado (Bag/Vidro pasteurizado ou Pote de Mistura com Coco + Vermiculita)
  if (held && isHoldingPasteurizedBulkSubstrate(held)) {
    if (!mc.lidOpen) {
      mc.lidOpen = true;
      updateMonotubVisual(tubItem);
      if (onToast) onToast('📦 Tampa aberta! Clique novamente para adicionar o Substrato Pasteurizado.');
      return true;
    }
    if (mc.hasBulk) {
      if (onToast) onToast('⚠️ Este Monotub 24L já recebeu o Substrato Pasteurizado!');
      return true;
    }
    mc.hasBulk = true;
    if (held.spawnCtrl) {
      const sc = held.spawnCtrl;
      sc.filled = false;
      sc.fillGrams = 0;
      sc.waterMl = 0;
      sc.substrateKind = '';
      sc.sterilized = false;
      sc.pasteurized = false;
      sc.sterilizeProgress = 0;
      sc.sealed = false;
      if (sc.fillMesh) sc.fillMesh.visible = false;
      if (held.meta && held.meta.compatibilities) {
        held.meta.compatibilities.receivesSubstrate = true;
      }
      sc.updateVisual();
    } else if (held.bowlCtrl) {
      held.bowlCtrl.ingredients = {};
      held.bowlCtrl.mixed = false;
      held.bowlCtrl.stirProgress = 0;
      if (held.bowlCtrl.mixMesh) held.bowlCtrl.mixMesh.visible = false;
      held.label = 'Pote de Mistura (Vazio)';
    }
    updateMonotubVisual(tubItem);
    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
    if (onToast) {
      onToast(mc.hasSpawn
        ? '🥥 Substrato Pasteurizado adicionado! Agora clique no Monotub para MISTURAR o spawn e o substrato!'
        : '🥥 Substrato Pasteurizado (Coco + Vermiculita) adicionado ao Monotub 24L! Agora adicione o Spawn Colonizado.');
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 5. Misturar Spawn + Substrato dentro da caixa (só quando tem os dois!)
  if (mc.lidOpen && mc.hasSpawn && mc.hasBulk && !mc.mixed) {
    mc.mixed = true;
    updateMonotubVisual(tubItem);
    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    if (onToast) {
      onToast('🤲 Spawn e Substrato Pasteurizado misturados homogeneamente! Agora clique novamente para NIVELAR o bolo dentro da caixa.');
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 6. Nivelar o bolo (SÓ pode nivelar depois de misturar!)
  if (mc.lidOpen && (mc.hasSpawn || mc.hasBulk) && !mc.mixed) {
    if (onToast) {
      onToast('⚠️ Só é possível nivelar o bolo depois de adicionar o Spawn + Substrato Pasteurizado e MISTURAR tudo!');
    }
    return true;
  }

  if (mc.lidOpen && mc.mixed && !mc.leveled) {
    mc.leveled = true;
    updateMonotubVisual(tubItem);
    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    if (onToast) {
      onToast('📏 Bolo perfeitamente NIVELADO e compactado dentro do Monotub 24L! Clique mais uma vez para fechar a tampa e iniciar a colonização.');
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 7. Alternar tampa (fechar para colonizar ou abrir para inspecionar)
  mc.lidOpen = !mc.lidOpen;
  if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
  updateMonotubVisual(tubItem);
  if (onToast) {
    if (!mc.lidOpen && mc.leveled && mc.colonization < 100) {
      onToast('🔒 Tampa fechada com travas e furos de polyfill! O Monotub 24L está colonizando (aguarde 100%).');
    } else {
      onToast(mc.lidOpen ? '📦 Tampa do Monotub 24L aberta.' : '📦 Tampa do Monotub 24L fechada.');
    }
  }
  if (ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

/**
 * Constrói a Estante Exclusiva para Monotubes 24L com Barras de Luz LED Direcional
 * embaixo de cada prateleira (na Ala Leste - Sala de Substratos/Frutificação).
 */
export function buildMonotubLedRack(ctx, rx = 15.3, rz = -5.2) {
  const scene = ctx.scene;
  monotubRackSlots.length = 0;
  monotubRackHitMeshes.length = 0;

  const rackGroup = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.32 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.45, roughness: 0.42 });
  const ledStripMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.45,
    roughness: 0.15
  });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

  const rackW = 0.72;
  const rackL = 2.50;
  const rackH = 2.25;
  const floorY = 0.14;
  const tierYs = [0.32, 0.98, 1.64];
  const slotZOffsets = [-0.88, -0.29, 0.29, 0.88];

  // 4 colunas verticais + teto com LED para o 3º andar
  [[-rackW * 0.46, -rackL * 0.48], [rackW * 0.46, -rackL * 0.48], [-rackW * 0.46, rackL * 0.48], [rackW * 0.46, rackL * 0.48]].forEach((p) => {
    const post = makeBox(0.05, rackH, 0.05, frameMat);
    post.position.set(rx + p[0], floorY + rackH * 0.5, rz + p[1]);
    rackGroup.add(post);
  });

  // Topo da estante (suporta o LED direcional do 3º andar)
  const topCap = makeBox(rackW, 0.04, rackL, shelfMat);
  topCap.position.set(rx, floorY + 2.22, rz);
  rackGroup.add(topCap);

  const ledCeilings = [floorY + 0.94, floorY + 1.60, floorY + 2.19];

  for (let t = 0; t < tierYs.length; t++) {
    const sy = floorY + tierYs[t];
    const shelf = makeBox(rackW, 0.04, rackL, shelfMat);
    shelf.position.set(rx, sy, rz);
    rackGroup.add(shelf);

    // Barra de Luz LED instalada EMBAIXO da prateleira superior iluminando as caixas deste andar!
    const ledBar = makeBox(0.10, 0.022, rackL - 0.16, ledStripMat, { noShadow: true });
    ledBar.position.set(rx, ledCeilings[t], rz);
    rackGroup.add(ledBar);

    const surf = {
      minX: rx - rackW * 0.5 + 0.03,
      maxX: rx + rackW * 0.5 - 0.03,
      minZ: rz - rackL * 0.5 + 0.03,
      maxZ: rz + rackL * 0.5 - 0.03,
      topY: sy + 0.02,
      isMonotubLedShelf: true
    };
    ctx.supportSurfaces.push(surf);
    shelf.userData.supportSurface = surf;
    ctx.supportMeshes.push(shelf);

    for (let s = 0; s < slotZOffsets.length; s++) {
      const slotId = t * slotZOffsets.length + s;
      const sz = rz + slotZOffsets[s];
      const hitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.34, 0.52), hitMat);
      hitMesh.position.set(rx, sy + 0.18, sz);
      const slotObj = {
        id: slotId,
        tier: t + 1,
        x: rx,
        y: sy + 0.02,
        z: sz,
        tubItem: null,
        hitMesh
      };
      hitMesh.userData.monotubRackSlot = slotObj;
      rackGroup.add(hitMesh);
      monotubRackSlots.push(slotObj);
      monotubRackHitMeshes.push(hitMesh);
    }
  }

  const rackLight = new THREE.PointLight(0xbae6fd, 0.95, 5.5, 1.6);
  rackLight.position.set(rx + 0.35, floorY + 1.35, rz);
  rackGroup.add(rackLight);

  scene.add(rackGroup);
  ctx.solidColliders.push({
    minX: rx - rackW * 0.5,
    maxX: rx + rackW * 0.5,
    minZ: rz - rackL * 0.5,
    maxZ: rz + rackL * 0.5,
    minY: floorY,
    maxY: floorY + rackH
  });
}

/**
 * Posiciona um Monotub 24L segurado em um slot da Estante Exclusiva com Luz LED
 */
export function placeMonotubInLedRackSlot(ctx, slot) {
  const held = ctx.heldItem;
  if (!held || !held.monotubCtrl || !slot) return false;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  if (slot.tubItem && slot.tubItem !== held && slot.tubItem.mesh.position.distanceTo( new THREE.Vector3(slot.x, slot.y, slot.z) ) < 0.32) {
    if (onToast) onToast('⚠️ Este espaço da Estante LED de Monotubes já está ocupado!');
    return true;
  }

  held.mesh.position.set(slot.x, slot.y, slot.z);
  held.mesh.rotation.set(0, Math.PI / 2, 0);
  held.isMoved = true;
  if (held.mesh.userData.updateBounds) updateItemBounds(held);

  const mc = held.monotubCtrl;
  mc.onLedRack = true;
  mc.rackSlotId = slot.id;
  mc.lidOpen = false;
  slot.tubItem = held;
  updateMonotubVisual(held);

  if (ctx.pendingMovedItems) {
    ctx.pendingMovedItems[held.id] = {
      id: held.id,
      x: slot.x,
      y: slot.y,
      z: slot.z,
      ry: Math.PI / 2
    };
  }
  ctx.heldItem = null;
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
  if (onToast) {
    onToast(mc.colonization >= 100
      ? `💡 Monotub 24L encaixado no Andar ${slot.tier} sob a Luz LED Direcional! Os cogumelos vão se orientar pela luz e frutificar!`
      : `📦 Monotub 24L colocado na Estante LED (Andar ${slot.tier}). Assim que atingir 100% de colonização, a luz LED guiará a frutificação!`);
  }
  if (ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

/**
 * Passo de simulação em tempo real de todas as Caixas Monotub 24L
 */
export function stepMonotubs(ctx, dt) {
  if (!ctx || !ctx.pickableItems) return;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const item = ctx.pickableItems[i];
    const mc = item && item.monotubCtrl;
    if (!mc || mc.spent || mc.contaminated) continue;

    // Detecta se está posicionado dentro dos limites da Estante LED de Monotubes (mesmo via placementMode 'G')
    const p = item.mesh.position;
    const inLedRackBounds = (p.x >= 14.8 && p.x <= 15.8 && p.z >= -6.6 && p.z <= -3.8 && p.y >= 0.35);
    if (inLedRackBounds !== mc.onLedRack && item !== ctx.heldItem) {
      mc.onLedRack = inLedRackBounds;
      updateMonotubVisual(item);
    }

    // 1. Fase de Colonização (requer mixed && leveled && tampa fechada)
    if (mc.mixed && mc.leveled && !mc.lidOpen && mc.colonization < 100) {
      const prevCol = Math.floor(mc.colonization);
      mc.colonization = Math.min(100, mc.colonization + dt * 3.8);

      // Verificação de contaminação por Trichoderma se montou sem higienizar a caixa com Álcool 70%
      if (mc.asepticScore < 0.5 && mc.colonization >= 45 && mc.colonization - dt * 3.8 < 45) {
        mc.contaminated = true;
        mc.contamReason = 'Trichoderma (caixa montada sem Álcool 70%)';
        updateMonotubVisual(item);
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🦠 O Monotub 24L contaminou com Trichoderma (mofo verde)! Sempre passe Álcool 70% e Papel Toalha na caixa antes de montar.');
        }
        continue;
      }

      if (Math.floor(mc.colonization) !== prevCol) {
        updateMonotubVisual(item);
        if (mc.colonization >= 100 && ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast(`✅ ${item.label}`);
        }
      }
    }

    // 2. Fase de Frutificação (requer 100% colonizado + na Estante com Luz LED embaixo da prateleira)
    if (mc.colonization >= 100 && mc.onLedRack && mc.fruitingStage < 3) {
      if (mc.fruitingStage === 0) {
        mc.fruitingStage = 1;
        mc.growth = 0;
        updateMonotubVisual(item);
      } else {
        const prevG = Math.floor(mc.growth);
        mc.growth += dt * 4.5;
        if (mc.growth >= 100) {
          mc.growth = 0;
          mc.fruitingStage++;
          updateMonotubVisual(item);
          if (mc.fruitingStage === 3 && ctx.callbacks && ctx.callbacks.onToast) {
            ctx.callbacks.onToast(`🍄 Monotub 24L (${mc.speciesName || 'Cubensis'}) atingiu maturação no Flush ${mc.flush}/${MONOTUB_MAX_FLUSHES}! Clique para colher!`);
          }
        } else if (Math.floor(mc.growth / 10) !== Math.floor(prevG / 10)) {
          updateMonotubVisual(item);
        }
      }
    }
  }
}
