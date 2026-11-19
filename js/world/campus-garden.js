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
import { getCachedCanvasTexture, disposeObjectResources } from '../items/item-registry.js';
import { resetMonotubToCleanEmpty } from '../items/monotub.js';
import { createBanner } from './nature-plaza.js';

const THREE = window.THREE;

export const gardenHitMeshes = [];
export const gardenPlants = [];

export const gardenState = {
  compostCakes: 1,
  soilRichness: 45, // 0..100%
  totalHarvested: 0,
  compostFillMesh: null
};

export function isHoldingSpentCakeForCompost(held) {
  if (!held) return false;
  if (held.spentCakeCtrl) return true;
  if (held.monotubCtrl && (held.monotubCtrl.spent || held.monotubCtrl.contaminated)) return true;
  if (held.spawnCtrl && held.spawnCtrl.filled && (held.spawnCtrl.contaminated || held.spawnCtrl.expired)) return true;
  return false;
}

function updatePlantVisual(plant) {
  if (!plant || !plant.group) return;
  const s = plant.stage === 0 ? 0.42 : (plant.stage === 1 ? 0.72 : 1.05);
  plant.foliageGroup.scale.set(s, s, s);
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

function updateCompostVisual() {
  if (!gardenState.compostFillMesh) return;
  const frac = Math.max(0.25, Math.min(1.0, 0.25 + gardenState.compostCakes * 0.12));
  gardenState.compostFillMesh.scale.y = frac;
  gardenState.compostFillMesh.position.y = 0.08 + 0.22 * frac;
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

  // Placa / Banner da Horta Orgânica ao sul da Estufa
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
      updateCompostVisual();

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

  if (target.type === 'plant' && target.plant) {
    const pl = target.plant;
    if (pl.stage === 2) {
      pl.stage = 0;
      pl.growth = 0;
      gardenState.totalHarvested++;
      updatePlantVisual(pl);
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
  const boost = 0.75 + (gardenState.soilRichness / 100) * 1.75;
  for (let i = 0; i < gardenPlants.length; i++) {
    const pl = gardenPlants[i];
    if (pl.stage >= 2) continue;
    pl.growth += dt * 1.8 * boost;
    if (pl.growth >= 100) {
      pl.growth = 0;
      pl.stage = Math.min(2, pl.stage + 1);
      updatePlantVisual(pl);
    }
  }
}
