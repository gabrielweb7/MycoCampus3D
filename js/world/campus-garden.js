/**
 * Horta Orgânica do Campus + Caixa de Substrato & Compostagem Micelial (MycoCampus3D)
 *
 * Localizada ao sul da Estufa (Ala Leste, x: 15..23, z: 16..20):
 * - Caixa de Substrato da Horta: recebe bolos secos esgotados (após os 4 flushs da Estufa ou do Monotub 24L),
 *   transformando o substrato exaurido rico em micélio em húmus fértil que turbina a horta!
 * - Canteiro de Alfaces Orgânicas (8 pés de alface que crescem e podem ser colhidos).
 * - Canteiro de Tomateiros (6 pés de tomate com estacas e frutos que ficam vermelhos ao amadurecer).
 */

import { makeBox } from '../engine/textures.js';
import { getCachedCanvasTexture, disposeObjectResources, registerPickable } from '../items/item-registry.js';
import { resetMonotubToCleanEmpty } from '../items/monotub.js';
import { createBanner } from './nature-plaza.js';
import { triggerCozyHeartBurst } from './cozy-details.js';

const THREE = window.THREE;

export const gardenHitMeshes = [];
export const gardenPlants = [];
export const gardenDynamicObjects = [];

const gardenButterflies = [];
const gardenBurstMeshes = [];
let gardenAnimTime = 0;

export const gardenState = {
  compostCakes: 1,
  soilRichness: 45, // 0..100%
  totalHarvested: 0,
  readyBaskets: 0,
  compostFillMesh: null,
  basketItems: [],
  currentCompostFrac: 0.37,
  targetCompostFrac: 0.37
};

function makeOrganicGardenBasket(ctx, px, py, pz) {
  const g = new THREE.Group();
  const woodM = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 });
  const tomM = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.32 });
  const letM = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });
  const crateBase = makeBox(0.32, 0.14, 0.24, woodM);
  crateBase.position.y = 0.07;
  g.add(crateBase);
  for (let i = 0; i < 2; i++) {
    const tom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), tomM);
    tom.position.set(-0.06 + i * 0.11, 0.17, -0.03);
    const letHead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), letM);
    letHead.position.set(-0.05 + i * 0.11, 0.165, 0.05);
    g.add(tom, letHead);
  }
  const id = 'organic_basket_' + Date.now().toString(36);
  const item = registerPickable(
    ctx,
    id,
    '🧺 Cesta Orgânica da Horta (Tomates & Alface • Entregue no Empório +🪙 240!)',
    g,
    px, py, pz, 0, 0.18, 0.22,
    {
      category: 'produce',
      purpose: 'Cesta fresca da horta adubada com micélio — venda no Empório Drive-Thru por MycoCoins',
      weightGrams: 1800
    }
  );
  item.organicBasketCtrl = { packsValue: 2 };
  return item;
}

function updateHarvestBasketVisual() {
  if (!gardenState.basketItems || !gardenState.basketItems.length) return;
  const shown = Math.min(gardenState.basketItems.length, Math.max(1, gardenState.totalHarvested));
  for (let i = 0; i < gardenState.basketItems.length; i++) {
    gardenState.basketItems[i].visible = i < shown;
  }
}

export function isHoldingSpentCakeForCompost(held) {
  if (!held) return false;
  if (held.spentCakeCtrl) return true;
  if (held.monotubCtrl && (held.monotubCtrl.spent || held.monotubCtrl.contaminated)) return true;
  if (held.spawnCtrl && held.spawnCtrl.filled && (held.spawnCtrl.contaminated || held.spawnCtrl.expired)) return true;
  return false;
}

function updatePlantVisual(plant) {
  if (!plant || !plant.group) return;
  const gFrac = Math.max(0, Math.min(1, (plant.growth || 0) / 100));
  const s = plant.stage === 0
    ? (0.38 + gFrac * 0.30)
    : (plant.stage === 1 ? (0.68 + gFrac * 0.34) : 1.06);
  if (plant.foliageGroup && plant.foliageGroup.scale && plant.foliageGroup.scale.set) {
    plant.foliageGroup.scale.set(s, s, s);
  }
  if (plant.kind === 'tomato' && plant.fruits) {
    for (let i = 0; i < plant.fruits.length; i++) {
      const fr = plant.fruits[i];
      fr.visible = plant.stage >= 1;
      if (fr.material) {
        fr.material.color.setHex(plant.stage === 2 ? 0xef4444 : 0x65a30d);
      }
    }
  }
}

function updateCompostVisual(immediate = false) {
  const frac = Math.max(0.25, Math.min(1.0, 0.25 + gardenState.compostCakes * 0.12));
  gardenState.targetCompostFrac = frac;
  if (immediate) gardenState.currentCompostFrac = frac;
  if (!gardenState.compostFillMesh) return;
  const f = gardenState.currentCompostFrac;
  gardenState.compostFillMesh.scale.y = f;
  gardenState.compostFillMesh.position.y = 0.08 + 0.22 * f;
}

function triggerGardenBurst(x, y, z, colorHex = 0x34d399) {
  if (!gardenBurstMeshes.length) return;
  for (let i = 0; i < gardenBurstMeshes.length; i++) {
    const p = gardenBurstMeshes[i];
    const ang = (i / gardenBurstMeshes.length) * Math.PI * 2 + (i % 3) * 0.2;
    const spd = 0.7 + (i % 4) * 0.25;
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
    if (p.mesh.material && p.mesh.material.color) {
      p.mesh.material.color.setHex(i % 3 === 0 ? 0xf8fafc : colorHex);
    }
    p.vx = Math.cos(ang) * spd;
    p.vy = 1.1 + (i % 3) * 0.35;
    p.vz = Math.sin(ang) * spd;
    p.life = 0.85;
  }
}

export function buildCampusVegetableGarden(ctx) {
  const scene = ctx.scene;
  gardenHitMeshes.length = 0;
  gardenPlants.length = 0;

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const darkSoilMat = new THREE.MeshStandardMaterial({ color: 0x29180d, roughness: 0.96 });
  const compostSoilMat = new THREE.MeshStandardMaterial({ color: 0x3b2313, roughness: 0.94 });
  const lettuceMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });
  const lettuceInnerMat = new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.62 });
  const tomatoLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 });
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.82 });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

  // Placa / Banner da Horta Orgânica com mastro de aço fixado no chão (sem flutuar!)
  const bannerPostMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 });
  const bannerPole = makeBox(0.10, 3.05, 0.10, bannerPostMat);
  bannerPole.position.set(19.35, 1.525, 20.2);
  const bannerArm = makeBox(0.88, 0.08, 0.08, bannerPostMat);
  bannerArm.position.set(18.95, 2.98, 20.2);
  const bannerBase = makeBox(0.32, 0.08, 0.32, bannerPostMat);
  bannerBase.position.set(19.35, 0.04, 20.2);
  scene.add(bannerPole, bannerArm, bannerBase);
  createBanner(scene, 18.6, 2.35, 20.2, Math.PI, '#16a34a', '🥬');

  // 1. CAIXA DE SUBSTRATO & COMPOSTAGEM DA HORTA (x: 15.6, z: 17.6)
  const cx = 15.6;
  const cz = 17.6;
  const compostGroup = new THREE.Group();
  const binW = 1.35;
  const binD = 1.15;
  const binH = 0.68;

  const wallF = makeBox(binW, binH, 0.08, woodMat);
  wallF.position.set(cx, binH * 0.5, cz + binD * 0.5);
  const wallB = makeBox(binW, binH, 0.08, woodMat);
  wallB.position.set(cx, binH * 0.5, cz - binD * 0.5);
  const wallL = makeBox(0.08, binH, binD, woodMat);
  wallL.position.set(cx - binW * 0.5, binH * 0.5, cz);
  const wallR = makeBox(0.08, binH, binD, woodMat);
  wallR.position.set(cx + binW * 0.5, binH * 0.5, cz);
  compostGroup.add(wallF, wallB, wallL, wallR);

  const compostFill = makeBox(binW - 0.14, 0.44, binD - 0.14, compostSoilMat);
  compostFill.position.set(cx, 0.22, cz);
  compostGroup.add(compostFill);
  gardenState.compostFillMesh = compostFill;
  updateCompostVisual();

  // Placa frontal na Caixa de Substrato
  const signTex = getCachedCanvasTexture('garden_compost_sign', 256, 96, (sctx) => {
    sctx.fillStyle = '#064e3b';
    sctx.fillRect(0, 0, 256, 96);
    sctx.strokeStyle = '#34d399';
    sctx.lineWidth = 4;
    sctx.strokeRect(3, 3, 250, 90);
    sctx.fillStyle = '#a7f3d0';
    sctx.font = 'bold 19px system-ui, sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText('🌱 CAIXA DE SUBSTRATO', 128, 34);
    sctx.fillStyle = '#ffffff';
    sctx.font = 'bold 14px system-ui, sans-serif';
    sctx.fillText('Jogue Bolos Esgotados (4 Flushs)', 128, 60);
    sctx.fillStyle = '#fde68a';
    sctx.font = '13px system-ui, sans-serif';
    sctx.fillText('Adubo Micelial p/ Alfaces & Tomates', 128, 82);
  });
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.36),
    new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
  );
  signMesh.position.set(cx, 0.42, cz - binD * 0.5 - 0.048);
  signMesh.rotation.y = Math.PI;
  compostGroup.add(signMesh);

  const compostHit = new THREE.Mesh(new THREE.BoxGeometry(binW + 0.2, binH + 0.35, binD + 0.2), hitMat);
  compostHit.position.set(cx, binH * 0.5 + 0.1, cz);
  compostHit.userData.gardenTarget = {
    type: 'compost_box',
    label: 'Caixa de Substrato & Compostagem da Horta'
  };
  compostGroup.add(compostHit);
  gardenHitMeshes.push(compostHit);

  scene.add(compostGroup);
  ctx.solidColliders.push({
    minX: cx - binW * 0.5,
    maxX: cx + binW * 0.5,
    minZ: cz - binD * 0.5,
    maxZ: cz + binD * 0.5,
    minY: 0,
    maxY: binH
  });

  // 2. CANTEIRO DE ALFACES ORGÂNICAS (x: 18.4, z: 17.6)
  const lx = 18.4;
  const lz = 17.6;
  const bedW = 2.4;
  const bedD = 1.3;
  const bedH = 0.28;
  const lettuceBed = makeBox(bedW, bedH, bedD, woodMat);
  lettuceBed.position.set(lx, bedH * 0.5, lz);
  const lettuceSoil = makeBox(bedW - 0.14, 0.06, bedD - 0.14, darkSoilMat);
  lettuceSoil.position.set(lx, bedH + 0.01, lz);
  scene.add(lettuceBed, lettuceSoil);
  ctx.solidColliders.push({
    minX: lx - bedW * 0.5,
    maxX: lx + bedW * 0.5,
    minZ: lz - bedD * 0.5,
    maxZ: lz + bedD * 0.5,
    minY: 0,
    maxY: bedH
  });

  const leafOuterGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const leafInnerGeo = new THREE.SphereGeometry(0.085, 8, 6);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const px = lx - 0.78 + c * 0.52;
      const pz = lz - 0.30 + r * 0.60;
      const pGroup = new THREE.Group();
      pGroup.position.set(px, bedH + 0.03, pz);

      const foliageGroup = new THREE.Group();
      for (let lf = 0; lf < 5; lf++) {
        const ang = (lf / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(leafOuterGeo, lettuceMat);
        leaf.scale.set(1.1, 0.55, 0.85);
        leaf.position.set(Math.cos(ang) * 0.06, 0.05, Math.sin(ang) * 0.06);
        foliageGroup.add(leaf);
      }
      const core = new THREE.Mesh(leafInnerGeo, lettuceInnerMat);
      core.position.y = 0.07;
      foliageGroup.add(core);
      pGroup.add(foliageGroup);

      const pHit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), hitMat);
      pHit.position.y = 0.14;
      const plantObj = {
        id: `lettuce_${r * 4 + c + 1}`,
        kind: 'lettuce',
        name: 'Pé de Alface Crespa Orgânica',
        stage: (c + r) % 2 === 0 ? 2 : 1, // 0=muda, 1=crescendo, 2=madura
        growth: 45,
        group: pGroup,
        foliageGroup,
        fruits: null
      };
      pHit.userData.gardenTarget = {
        type: 'plant',
        plant: plantObj
      };
      pGroup.add(pHit);
      gardenHitMeshes.push(pHit);
      gardenPlants.push(plantObj);
      updatePlantVisual(plantObj);
      scene.add(pGroup);
    }
  }

  // 3. CANTEIRO DE TOMATEIROS ORGÂNICOS (x: 21.4, z: 17.6)
  const tx = 21.4;
  const tz = 17.6;
  const tomatoBed = makeBox(bedW, bedH, bedD, woodMat);
  tomatoBed.position.set(tx, bedH * 0.5, tz);
  const tomatoSoil = makeBox(bedW - 0.14, 0.06, bedD - 0.14, darkSoilMat);
  tomatoSoil.position.set(tx, bedH + 0.01, tz);
  scene.add(tomatoBed, tomatoSoil);
  ctx.solidColliders.push({
    minX: tx - bedW * 0.5,
    maxX: tx + bedW * 0.5,
    minZ: tz - bedD * 0.5,
    maxZ: tz + bedD * 0.5,
    minY: 0,
    maxY: bedH
  });

  const stakeGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.85, 8);
  const bushGeo = new THREE.DodecahedronGeometry(0.16, 1);
  const fruitGeo = new THREE.SphereGeometry(0.032, 10, 8);

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const px = tx - 0.72 + c * 0.72;
      const pz = tz - 0.30 + r * 0.60;
      const pGroup = new THREE.Group();
      pGroup.position.set(px, bedH + 0.03, pz);

      const stake = new THREE.Mesh(stakeGeo, stakeMat);
      stake.position.y = 0.42;
      pGroup.add(stake);

      const foliageGroup = new THREE.Group();
      const b1 = new THREE.Mesh(bushGeo, tomatoLeafMat);
      b1.position.y = 0.28;
      const b2 = new THREE.Mesh(bushGeo, tomatoLeafMat);
      b2.scale.setScalar(0.82);
      b2.position.y = 0.54;
      foliageGroup.add(b1, b2);

      const fruits = [];
      const fruitCoords = [
        [0.12, 0.26, 0.08],
        [-0.11, 0.32, 0.09],
        [0.09, 0.48, -0.09],
        [-0.08, 0.52, -0.08]
      ];
      for (let fi = 0; fi < fruitCoords.length; fi++) {
        const fc = fruitCoords[fi];
        const fMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 });
        const fr = new THREE.Mesh(fruitGeo, fMat);
        fr.position.set(fc[0], fc[1], fc[2]);
        foliageGroup.add(fr);
        fruits.push(fr);
      }
      pGroup.add(foliageGroup);

      const pHit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.90, 0.46), hitMat);
      pHit.position.y = 0.45;
      const plantObj = {
        id: `tomato_${r * 3 + c + 1}`,
        kind: 'tomato',
        name: 'Tomateiro Orgânico',
        stage: (c + r) % 2 === 0 ? 2 : 1,
        growth: 55,
        group: pGroup,
        foliageGroup,
        fruits
      };
      pHit.userData.gardenTarget = {
        type: 'plant',
        plant: plantObj
      };
      pGroup.add(pHit);
      gardenHitMeshes.push(pHit);
      gardenPlants.push(plantObj);
      updatePlantVisual(plantObj);
      scene.add(pGroup);
    }
  }

  // 3b. CESTA DE COLHEITA ORGÂNICA DA HORTA (x: 19.9, z: 18.7)
  const bx = 19.9;
  const bz = 18.7;
  const basketGroup = new THREE.Group();
  const basketRim = makeBox(0.66, 0.24, 0.46, stakeMat);
  basketRim.position.set(bx, 0.12, bz);
  basketGroup.add(basketRim);
  gardenState.basketItems = [];
  for (let bi = 0; bi < 6; bi++) {
    const isTom = bi % 2 === 1;
    const itemMesh = new THREE.Mesh(
      isTom ? fruitGeo : leafInnerGeo,
      isTom ? new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.28 }) : lettuceMat
    );
    itemMesh.position.set(bx - 0.18 + (bi % 3) * 0.18, 0.26, bz - 0.08 + Math.floor(bi / 3) * 0.16);
    itemMesh.visible = bi === 0;
    basketGroup.add(itemMesh);
    gardenState.basketItems.push(itemMesh);
  }
  const basketHit = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.45, 0.55), hitMat);
  basketHit.position.set(bx, 0.22, bz);
  basketHit.userData.gardenTarget = {
    type: 'harvest_basket',
    label: '🧺 Cesta de Colheita Orgânica da Horta'
  };
  basketGroup.add(basketHit);
  gardenHitMeshes.push(basketHit);
  scene.add(basketGroup);

  // 4. Borboletas 3D voando sobre a Horta + Pool de Partículas de Adubo/Colheita
  gardenButterflies.length = 0;
  gardenBurstMeshes.length = 0;
  gardenDynamicObjects.length = 0;

  const wingGeo = new THREE.PlaneGeometry(0.055, 0.045);
  const bfColors = [0xfbbf24, 0x38bdf8, 0xf472b6];
  const bfCenters = [
    { cx: 18.4, cz: 17.6, y: 0.78 },
    { cx: 21.4, cz: 17.6, y: 0.96 },
    { cx: 16.5, cz: 17.6, y: 0.85 }
  ];
  for (let bi = 0; bi < 3; bi++) {
    const bfGroup = new THREE.Group();
    const wMat = new THREE.MeshBasicMaterial({ color: bfColors[bi], side: THREE.DoubleSide });
    const wingL = new THREE.Mesh(wingGeo, wMat);
    wingL.position.x = -0.025;
    const wingR = new THREE.Mesh(wingGeo, wMat);
    wingR.position.x = 0.025;
    bfGroup.add(wingL, wingR);
    bfGroup.position.set(bfCenters[bi].cx, bfCenters[bi].y, bfCenters[bi].cz);
    scene.add(bfGroup);
    gardenDynamicObjects.push(bfGroup);
    gardenButterflies.push({
      group: bfGroup,
      wingL,
      wingR,
      cx: bfCenters[bi].cx,
      cz: bfCenters[bi].cz,
      baseY: bfCenters[bi].y,
      phase: bi * 2.1
    });
  }

  const pGeo = new THREE.BoxGeometry(0.032, 0.032, 0.032);
  for (let pi = 0; pi < 16; pi++) {
    const pMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const pMesh = new THREE.Mesh(pGeo, pMat);
    pMesh.visible = false;
    scene.add(pMesh);
    gardenDynamicObjects.push(pMesh);
    gardenBurstMeshes.push({ mesh: pMesh, vx: 0, vy: 0, vz: 0, life: 0 });
  }
}

export function interactGardenTarget(ctx, target) {
  if (!target) return false;
  const held = ctx.heldItem;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;

  if (target.type === 'compost_box') {
    if (held && isHoldingSpentCakeForCompost(held)) {
      let cakeName = 'Bolo de Micélio';
      if (held.monotubCtrl) {
        cakeName = held.monotubCtrl.speciesName || 'Monotub 24L';
        resetMonotubToCleanEmpty(held);
        if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
      } else if (held.spentCakeCtrl) {
        cakeName = held.spentCakeCtrl.speciesName || 'Bolo Esgotado';
        if (held.mesh && held.mesh.parent) held.mesh.parent.remove(held.mesh);
        disposeObjectResources(held.mesh);
        const idx = ctx.pickableItems.indexOf(held);
        if (idx !== -1) ctx.pickableItems.splice(idx, 1);
        if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
          ctx.pickableMap.delete(held.id);
        }
        ctx.heldItem = null;
        if (ctx.placementGhost) ctx.placementGhost.visible = false;
        if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
      } else if (held.spawnCtrl) {
        cakeName = held.spawnCtrl.speciesName || held.spawnCtrl.baseLabel || 'Substrato';
        const sc = held.spawnCtrl;
        sc.filled = false;
        sc.fillGrams = 0;
        sc.waterMl = 0;
        sc.substrateKind = '';
        sc.sterilized = false;
        sc.pasteurized = false;
        sc.inoculated = false;
        sc.colonized = false;
        sc.colonization = 0;
        sc.contaminated = false;
        sc.expired = false;
        if (sc.fillMesh) sc.fillMesh.visible = false;
        if (sc.mycOverlay) sc.mycOverlay.visible = false;
        sc.updateVisual();
        if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
      }

      gardenState.compostCakes++;
      gardenState.soilRichness = Math.min(100, gardenState.soilRichness + 25);
      updateCompostVisual(false);
      triggerGardenBurst(15.6, 0.55, 17.6, 0xa3e635);
      if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');

      // Impulsiona o crescimento imediato das alfaces e tomates!
      for (let i = 0; i < gardenPlants.length; i++) {
        const pl = gardenPlants[i];
        if (pl.stage < 2) {
          pl.growth += 45;
          if (pl.growth >= 100) {
            pl.growth = 0;
            pl.stage = Math.min(2, pl.stage + 1);
            updatePlantVisual(pl);
          }
        }
      }

      if (window.MycoAudio && window.MycoAudio.playHarvest) window.MycoAudio.playHarvest();
      if (onToast) {
        onToast(`🌱 Bolo esgotado de ${cakeName} despejado na Caixa de Substrato da Horta! Fertilidade do solo: ${gardenState.soilRichness}% (Alfaces e Tomates acelerados!)`);
      }
      if (ctx.notifyWorldAction) ctx.notifyWorldAction();
      return true;
    }

    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    if (onToast) {
      onToast(`🌱 Caixa de Substrato da Horta • ${gardenState.compostCakes} bolo(s) compostado(s) • Fertilidade: ${Math.round(gardenState.soilRichness)}%. Traga bolos secos após 4 flushs para adubar!`);
    }
    return true;
  }

  if (target.type === 'harvest_basket') {
    if (gardenState.readyBaskets > 0 && !ctx.heldItem) {
      gardenState.readyBaskets--;
      const px = ctx.playerPos ? ctx.playerPos.x : 16;
      const py = ctx.playerPos ? ctx.playerPos.y : 0.2;
      const pz = ctx.playerPos ? ctx.playerPos.z : 17;
      const basketItem = makeOrganicGardenBasket(ctx, px, py, pz);
      ctx.heldItem = basketItem;
      ctx.lastPickupAt = performance.now();
      if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(basketItem.label);
      if (window.MycoAudio && window.MycoAudio.playHarvest) window.MycoAudio.playHarvest();
      if (onToast) {
        onToast('🧺 Cesta Orgânica na mão! Leve ao Empório Drive-Thru na Estrada Sul para vender (+2 lotes = 🪙 240 MycoCoins)!');
      }
      return true;
    }
    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    if (onToast) {
      const need = 3 - (gardenState.totalHarvested % 3);
      onToast(gardenState.readyBaskets > 0
        ? `🧺 ${gardenState.readyBaskets} Cesta(s) pronta(s)! Esvazie as mãos para pegar e vender no Empório!`
        : `🧺 Cesta Orgânica (${gardenState.totalHarvested} colheitas • faltam ${need} para montar 1 Cesta vendável no Empório)!`);
    }
    return true;
  }

  if (target.type === 'plant' && target.plant) {
    const pl = target.plant;
    if (pl.stage === 2) {
      pl.stage = 0;
      pl.growth = 0;
      gardenState.totalHarvested++;
      if (gardenState.totalHarvested % 3 === 0) {
        gardenState.readyBaskets++;
      }
      updatePlantVisual(pl);
      updateHarvestBasketVisual();
      if (ctx.callbacks && ctx.callbacks.onHarvestMushroom) {
        ctx.callbacks.onHarvestMushroom('garden_' + pl.id);
      }
      if (pl.group && pl.group.position) {
        triggerGardenBurst(pl.group.position.x, 0.45, pl.group.position.z, pl.kind === 'tomato' ? 0xef4444 : 0x22c55e);
        triggerCozyHeartBurst(pl.group.position.x, 0.72, pl.group.position.z, 0xfbbf24);
      }
      if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('medium');
      if (window.MycoAudio && window.MycoAudio.playHarvest) window.MycoAudio.playHarvest();
      if (onToast) {
        const icon = pl.kind === 'tomato' ? '🍅' : '🥬';
        const harvestLabel = pl.kind === 'tomato' ? 'Tomates Vermelhos Orgânicos colhidos' : 'Alface Crespa Orgânica colhida';
        onToast(`${icon} ${harvestLabel} (cultivados no substrato de cogumelos)! Total colhido na Horta: ${gardenState.totalHarvested}`);
      }
      if (ctx.notifyWorldAction) ctx.notifyWorldAction();
      return true;
    }

    if (window.MycoAudio && window.MycoAudio.playClick) window.MycoAudio.playClick();
    if (onToast) {
      const stLbl = pl.stage === 0 ? 'Muda crescendo' : (pl.kind === 'tomato' ? 'Tomates verdes amadurecendo' : 'Folhas crescendo');
      onToast(`🌿 ${pl.name} — ${stLbl} (${Math.floor(pl.growth)}%) • Fertilidade do Substrato: ${Math.round(gardenState.soilRichness)}%`);
    }
    return true;
  }

  return false;
}

export function stepCampusGarden(dt) {
  gardenAnimTime += dt;
  const boost = 0.75 + (gardenState.soilRichness / 100) * 1.75;

  // 1. Animação suave de subida do nível da Caixa de Substrato
  if (Math.abs(gardenState.targetCompostFrac - gardenState.currentCompostFrac) > 0.002) {
    gardenState.currentCompostFrac += (gardenState.targetCompostFrac - gardenState.currentCompostFrac) * Math.min(1, dt * 4.5);
    if (gardenState.compostFillMesh) {
      const f = gardenState.currentCompostFrac;
      gardenState.compostFillMesh.scale.y = f;
      gardenState.compostFillMesh.position.y = 0.08 + 0.22 * f;
    }
  }

  // 2. Crescimento contínuo e balanço suave ao vento das Alfaces e Tomateiros
  for (let i = 0; i < gardenPlants.length; i++) {
    const pl = gardenPlants[i];
    if (pl.foliageGroup && pl.foliageGroup.rotation) {
      pl.foliageGroup.rotation.z = Math.sin(gardenAnimTime * 2.1 + i * 0.9) * 0.035;
    }
    if (pl.stage >= 2) continue;
    pl.growth += dt * 1.8 * boost;
    if (pl.growth >= 100) {
      pl.growth = 0;
      pl.stage = Math.min(2, pl.stage + 1);
    }
    updatePlantVisual(pl);
  }

  // 3. Voo em "8" e bater de asas das Borboletas 3D sobre a Horta
  for (let bi = 0; bi < gardenButterflies.length; bi++) {
    const bf = gardenButterflies[bi];
    const t = gardenAnimTime * 1.35 + bf.phase;
    const nx = bf.cx + Math.sin(t) * 0.85;
    const nz = bf.cz + Math.sin(t * 2) * 0.38;
    const ny = bf.baseY + Math.sin(t * 3.2) * 0.12;
    const dx = nx - bf.group.position.x;
    const dz = nz - bf.group.position.z;
    bf.group.position.set(nx, ny, nz);
    if (Math.abs(dx) + Math.abs(dz) > 0.0001) {
      bf.group.rotation.y = Math.atan2(dx, dz);
    }
    const flap = Math.sin(gardenAnimTime * 18 + bf.phase) * 0.85;
    bf.wingL.rotation.z = flap;
    bf.wingR.rotation.z = -flap;
  }

  // 4. Animação de Partículas de Adubo / Colheita
  for (let pi = 0; pi < gardenBurstMeshes.length; pi++) {
    const p = gardenBurstMeshes[pi];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.mesh.visible = false;
      continue;
    }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 2.8 * dt;
    p.mesh.rotation.x += dt * 5;
    p.mesh.rotation.y += dt * 6;
  }
}
