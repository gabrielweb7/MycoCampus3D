/**
 * Empório MycoCampus na Estrada Sul: Construção, Estantes e Balcão de Venda (MycoCampus3D).
 */

import { makeBox, brickMat, woodMat } from '../engine/textures.js';
import { getCachedCanvasTexture, disposeObjectResources } from '../items/item-registry.js';
import { t } from '../core/i18n.js';
import { addWallLabBench } from '../items/laminar-hood.js';
import { addMovableStainlessTable } from '../items/stainless-table.js';
import {
  MYCOCOIN_PRICE_PER_PACK,
  playEconomyAudio,
  addLocalMycoCoins
} from '../core/myco-coins.js';
import {
  createMushroomPackVisual,
  updateDeliveryCrateVisual
} from '../items/mushroom-packaging.js';
import {
  roadSaleStandMeshes,
  roadSaleDynamicObjects,
  roadStandState,
  getActiveVipOrders,
  matchVipOrder,
  drawRoadStandSign,
  createOrganicVeggieStandVisual,
  syncRoadStandVisual
} from './roadside-stand-state.js';
import { buildNpcCarActor, stepRoadsideMushroomSales } from './roadside-npc-actor.js';

const THREE = window.THREE;

export {
  roadSaleStandMeshes,
  roadSaleDynamicObjects,
  roadStandState,
  getActiveVipOrders,
  matchVipOrder,
  stepRoadsideMushroomSales
};

export function buildRoadsideMushroomStand(ctx) {
  const scene = ctx.scene;
  roadSaleStandMeshes.length = 0;
  roadSaleDynamicObjects.length = 0;
  roadStandState.standPacksMeshes.length = 0;
  roadStandState.standVeggieMeshes.length = 0;

  addLocalMycoCoins(0);

  const hx = 17.5;
  const hz = 32.5;
  const houseW = 5.8;
  const houseD = 4.6;
  const wallH = 3.40;
  const floorY = 0.12;
  const standGroup = new THREE.Group();

  const wallMat = brickMat(2, 2);
  const woodShelfMat = woodMat(1, 1);
  const steelFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0xead7b0, roughness: 0.78 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

  const floorSlab = makeBox(houseW + 0.4, floorY, houseD + 0.4, 0x94a3b8, { roughness: 0.85 });
  floorSlab.position.set(hx, floorY * 0.5, hz);
  const frontWalk = makeBox(houseW + 0.4, 0.04, 3.6, 0xcbd5e1, { roughness: 0.88, noShadow: true });
  frontWalk.position.set(hx, 0.02, hz + houseD * 0.5 + 1.8);
  standGroup.add(floorSlab, frontWalk);
  if (ctx.walkableFloors) {
    ctx.walkableFloors.push({
      minX: hx - (houseW + 0.4) * 0.5,
      maxX: hx + (houseW + 0.4) * 0.5,
      minZ: hz - (houseD + 0.4) * 0.5,
      maxZ: hz + (houseD + 0.4) * 0.5,
      topY: floorY
    }, {
      minX: hx - (houseW + 0.4) * 0.5,
      maxX: hx + (houseW + 0.4) * 0.5,
      minZ: hz + houseD * 0.5,
      maxZ: hz + houseD * 0.5 + 3.6,
      topY: 0.04
    });
  }

  const wBack = makeBox(houseW, wallH, 0.22, wallMat);
  wBack.position.set(hx, floorY + wallH * 0.5, hz - houseD * 0.5);
  const wLeft = makeBox(0.22, wallH, houseD, wallMat);
  wLeft.position.set(hx - houseW * 0.5, floorY + wallH * 0.5, hz);
  const wRight = makeBox(0.22, wallH, houseD, wallMat);
  wRight.position.set(hx + houseW * 0.5, floorY + wallH * 0.5, hz);
  const frontZ = hz + houseD * 0.5;
  const wFrontTop = makeBox(1.8, 0.95, 0.22, steelFrameMat);
  wFrontTop.position.set(hx, floorY + wallH - 0.475, frontZ);
  standGroup.add(wBack, wLeft, wRight, wFrontTop);

  const blindSlatMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 });
  const winGlassRealMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.24,
    roughness: 0.08,
    metalness: 0.2,
    depthWrite: false
  });
  [-1.90, 1.90].forEach((ox) => {
    const cx = hx + ox;
    const sillWall = makeBox(2.0, 1.05, 0.22, wallMat);
    sillWall.position.set(cx, floorY + 0.525, frontZ);
    const lintelWall = makeBox(2.0, 1.05, 0.22, wallMat);
    lintelWall.position.set(cx, floorY + 2.875, frontZ);
    const postOuter = makeBox(0.42, 1.30, 0.22, wallMat);
    postOuter.position.set(cx + (ox < 0 ? -0.79 : 0.79), floorY + 1.70, frontZ);
    const postInner = makeBox(0.42, 1.30, 0.22, wallMat);
    postInner.position.set(cx + (ox < 0 ? 0.79 : -0.79), floorY + 1.70, frontZ);
    standGroup.add(sillWall, lintelWall, postOuter, postInner);

    const fTop = makeBox(1.22, 0.07, 0.26, steelFrameMat);
    fTop.position.set(cx, floorY + 2.35, frontZ);
    const fBot = makeBox(1.22, 0.07, 0.26, steelFrameMat);
    fBot.position.set(cx, floorY + 1.05, frontZ);
    const fL = makeBox(0.07, 1.30, 0.26, steelFrameMat);
    fL.position.set(cx - 0.575, floorY + 1.70, frontZ);
    const fR = makeBox(0.07, 1.30, 0.26, steelFrameMat);
    fR.position.set(cx + 0.575, floorY + 1.70, frontZ);
    const winGlass = makeBox(1.10, 1.24, 0.04, winGlassRealMat, { noShadow: true });
    winGlass.position.set(cx, floorY + 1.70, frontZ);
    standGroup.add(fTop, fBot, fL, fR, winGlass);

    const blindHead = makeBox(1.08, 0.05, 0.07, steelFrameMat, { noShadow: true });
    blindHead.position.set(cx, floorY + 2.28, frontZ - 0.06);
    standGroup.add(blindHead);
    for (let sl = 0; sl < 6; sl++) {
      const slat = makeBox(1.06, 0.012, 0.045, blindSlatMat, { noShadow: true });
      slat.position.set(cx, floorY + 2.20 - sl * 0.065, frontZ - 0.06);
      slat.rotation.x = 0.35;
      standGroup.add(slat);
    }
  });

  [[-houseW * 0.5, -houseD * 0.5], [houseW * 0.5, -houseD * 0.5], [-houseW * 0.5, houseD * 0.5], [houseW * 0.5, houseD * 0.5]].forEach((cp) => {
    const col = makeBox(0.28, wallH + 0.12, 0.28, steelFrameMat);
    col.position.set(hx + cp[0], floorY + wallH * 0.5, hz + cp[1]);
    standGroup.add(col);
  });

  ctx.solidColliders.push(
    { minX: hx - houseW * 0.5 - 0.12, maxX: hx + houseW * 0.5 + 0.12, minZ: hz - houseD * 0.5 - 0.12, maxZ: hz - houseD * 0.5 + 0.12, minY: 0, maxY: 4.0 },
    { minX: hx - houseW * 0.5 - 0.12, maxX: hx - houseW * 0.5 + 0.12, minZ: hz - houseD * 0.5, maxZ: frontZ, minY: 0, maxY: 4.0 },
    { minX: hx + houseW * 0.5 - 0.12, maxX: hx + houseW * 0.5 + 0.12, minZ: hz - houseD * 0.5, maxZ: frontZ, minY: 0, maxY: 4.0 },
    { minX: hx - houseW * 0.5, maxX: hx - 0.9, minZ: frontZ - 0.12, maxZ: frontZ + 0.12, minY: 0, maxY: 4.0 },
    { minX: hx + 0.9, maxX: hx + houseW * 0.5, minZ: frontZ - 0.12, maxZ: frontZ + 0.12, minY: 0, maxY: 4.0 }
  );

  const roofSlab = makeBox(houseW + 0.5, 0.26, houseD + 0.5, roofMat);
  roofSlab.position.set(hx, floorY + wallH + 0.13, hz);
  const roofTrim = makeBox(houseW + 0.62, 0.18, houseD + 0.62, steelFrameMat);
  roofTrim.position.set(hx, floorY + wallH + 0.30, hz);
  standGroup.add(roofSlab, roofTrim);

  const roofStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 0.85, 14),
    trimMat
  );
  roofStem.position.set(hx, floorY + wallH + 0.78, hz);
  const roofCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, emissive: 0x7f1d1d, emissiveIntensity: 0.2 })
  );
  roofCap.position.set(hx, floorY + wallH + 1.15, hz);
  standGroup.add(roofStem, roofCap);
  for (let sp = 0; sp < 6; sp++) {
    const a = (sp / 6) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), whiteMat);
    dot.position.set(hx + Math.cos(a) * 0.68, floorY + wallH + 1.59, hz + Math.sin(a) * 0.68);
    standGroup.add(dot);
  }

  const houseLight = new THREE.PointLight(0xfef3c7, 0.85, 7.5, 1.5);
  houseLight.position.set(hx, floorY + 2.85, hz);
  standGroup.add(houseLight);

  [-1.90, 1.90].forEach((ox) => {
    for (let st = 0; st < 7; st++) {
      const stripe = makeBox(0.27, 0.08, 1.15, st % 2 === 0 ? orangeMat : whiteMat);
      stripe.position.set(hx + ox - 0.81 + st * 0.27, floorY + 2.38, frontZ + 0.58);
      stripe.rotation.x = 0.28;
      standGroup.add(stripe);
    }
  });

  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    roadStandState.signCanvas = c;
    roadStandState.signCtx = c.getContext('2d');
    roadStandState.signTex = new THREE.CanvasTexture(c);
    drawRoadStandSign();
    const signBacking = makeBox(2.74, 0.88, 0.08, steelFrameMat, { noShadow: true });
    signBacking.position.set(hx, floorY + 2.86, frontZ + 0.14);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.62, 0.80),
      new THREE.MeshBasicMaterial({ map: roadStandState.signTex, side: THREE.DoubleSide })
    );
    signMesh.position.set(hx, floorY + 2.86, frontZ + 0.19);
    standGroup.add(signBacking, signMesh);
  }

  addWallLabBench(ctx, hx - 0.6, hz - 1.65, 3.2, 1.0, {
    hole: { cx: hx - 1.4, cz: hz - 1.65, w: 0.60, d: 0.50 },
    sinkPos: { x: hx - 1.4, z: hz - 1.65 }
  });
  addMovableStainlessTable(ctx, 'table_emporio_east', 'Bancada Inox (Empório Estrada)', hx + 2.0, floorY, hz - 0.2, 1.1, 0.82, 2.2);

  const shelfXList = [hx - 1.90, hx + 1.90];
  const shelfZ = frontZ + 0.85;
  for (let si = 0; si < shelfXList.length; si++) {
    const sx = shelfXList[si];
    const shelfBase = makeBox(1.75, 0.82, 0.85, woodShelfMat);
    shelfBase.position.set(sx, 0.41, shelfZ);
    const shelfTop = makeBox(1.84, 0.06, 0.94, pineMat);
    shelfTop.position.set(sx, 0.85, shelfZ);
    standGroup.add(shelfBase, shelfTop);

    const pricePost = makeBox(0.04, 0.26, 0.04, steelFrameMat, { noShadow: true });
    pricePost.position.set(sx - 0.72, 1.00, shelfZ + 0.36);
    const priceTex = getCachedCanvasTexture('emporio_price_tag_120', 128, 64, (pctx) => {
      pctx.fillStyle = '#064e3b';
      pctx.fillRect(0, 0, 128, 64);
      pctx.strokeStyle = '#34d399';
      pctx.lineWidth = 4;
      pctx.strokeRect(3, 3, 122, 58);
      pctx.fillStyle = '#fde047';
      pctx.font = 'bold 28px system-ui, sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText('$ 120', 64, 42);
    });
    const priceCard = makeBox(0.32, 0.18, 0.04, new THREE.MeshStandardMaterial({ map: priceTex, roughness: 0.55 }), { noShadow: true });
    priceCard.position.set(sx - 0.72, 1.14, shelfZ + 0.36);
    standGroup.add(pricePost, priceCard);

    if (ctx.supportSurfaces && ctx.supportMeshes) {
      const sSurf = {
        minX: sx - 0.88,
        maxX: sx + 0.88,
        minZ: shelfZ - 0.44,
        maxZ: shelfZ + 0.44,
        topY: 0.88
      };
      ctx.supportSurfaces.push(sSurf);
      shelfTop.userData.supportSurface = sSurf;
      ctx.supportMeshes.push(shelfTop);
    }

    ctx.solidColliders.push({
      minX: sx - 0.90,
      maxX: sx + 0.90,
      minZ: shelfZ - 0.45,
      maxZ: shelfZ + 0.45,
      minY: 0,
      maxY: 0.95
    });

    const standHit = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.88, 0.90), hitMat);
    standHit.position.set(sx, 0.44, shelfZ);
    standHit.userData.isRoadSaleStand = true;
    standGroup.add(standHit);
    roadSaleStandMeshes.push(standHit);
  }

  for (let i = 0; i < 12; i++) {
    const pv = createMushroomPackVisual(true, true);
    const pm = pv.wrap;
    const isRight = i >= 6;
    const localIdx = i % 6;
    const col = localIdx % 3;
    const row = Math.floor(localIdx / 3);
    const baseShelfX = isRight ? (hx + 1.90) : (hx - 1.90);
    pm.position.set(baseShelfX - 0.42 + col * 0.42, 0.885 + row * 0.052, shelfZ - 0.19);
    pm.scale.set(1.25, 1.25, 1.25);
    pm.visible = false;
    standGroup.add(pm);
    roadStandState.standPacksMeshes.push(pm);
    roadSaleDynamicObjects.push(pm);

    const vm = createOrganicVeggieStandVisual();
    vm.position.set(baseShelfX - 0.42 + col * 0.42, 0.885 + row * 0.052, shelfZ + 0.19);
    vm.scale.set(1.18, 1.18, 1.18);
    vm.visible = false;
    standGroup.add(vm);
    roadStandState.standVeggieMeshes.push(vm);
    roadSaleDynamicObjects.push(vm);
  }

  scene.add(standGroup);
  buildNpcCarActor(scene);
}

export function isHoldingPackOrCrateForStand(held) {
  if (!held) return false;
  if (held.deliveryCrateCtrl && held.deliveryCrateCtrl.packsCount > 0) return true;
  if (held.mushroomBagCtrl && held.mushroomBagCtrl.filled && held.mushroomBagCtrl.sealed) return true;
  if (held.organicBasketCtrl && held.organicBasketCtrl.packsValue > 0) return true;
  return false;
}

export function applyRoadStandWorldState(stateMap) {
  if (!stateMap) return;
  let dirty = false;
  if (stateMap.stand_packs !== undefined) {
    const p = Math.max(0, Math.min(200, parseInt(stateMap.stand_packs, 10) || 0));
    if (p !== roadStandState.availablePacks) {
      roadStandState.availablePacks = p;
      dirty = true;
    }
  }
  if (stateMap.stand_sold !== undefined) {
    const s = Math.max(0, parseInt(stateMap.stand_sold, 10) || 0);
    if (s !== roadStandState.totalSoldPacks) {
      roadStandState.totalSoldPacks = s;
      dirty = true;
    }
  }
  if (dirty) syncRoadStandVisual();
}

function consumeHeldStandItem(ctx, held, packsVal) {
  roadStandState.availablePacks += packsVal;
  const isVeggie = Boolean(held && held.organicBasketCtrl);
  const spName = (held && held.mushroomBagCtrl && held.mushroomBagCtrl.speciesName) ||
    (held && held.wildMushroomCtrl && held.wildMushroomCtrl.speciesName) || '';
  const packGrams = Math.max(1, Math.round(Number(
    (held && held.mushroomBagCtrl && held.mushroomBagCtrl.grams) ||
    (held && held.wildMushroomCtrl && held.wildMushroomCtrl.grams) || 10
  )));
  for (let i = 0; i < packsVal; i++) {
    roadStandState.speciesList.push(spName);
    roadStandState.gramsList.push(packGrams);
    roadStandState.itemKinds.push(isVeggie ? 'veggie' : 'mushroom');
  }
  roadStandState.npcSpawnCooldown = Math.min(roadStandState.npcSpawnCooldown, 1.2);
  if (ctx && ctx.queueWorldStateChange) {
    ctx.queueWorldStateChange('stand_packs', roadStandState.availablePacks);
  }
  if (held && held.id) {
    held._removedForSync = true;
    if (ctx && ctx.pendingMovedItems) {
      ctx.pendingMovedItems[held.id] = {
        id: held.id,
        state: {
          custom: {
            dynamicKind: held.organicBasketCtrl ? 'organic_basket' : 'mushroom_bag',
            removed: true
          }
        }
      };
    }
  }
  if (held.mesh && held.mesh.parent) held.mesh.parent.remove(held.mesh);
  disposeObjectResources(held.mesh);
  if (Array.isArray(ctx.pickableItems)) {
    const idx = ctx.pickableItems.indexOf(held);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  }
  if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(held.id);
  }
  ctx.heldItem = null;
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  syncRoadStandVisual();
  playEconomyAudio('playClick');
}

export function interactRoadsideStand(ctx) {
  const held = ctx.heldItem;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;

  if (held && held.deliveryCrateCtrl && held.deliveryCrateCtrl.packsCount > 0) {
    const count = held.deliveryCrateCtrl.packsCount;
    const crateSpecies = Array.isArray(held.deliveryCrateCtrl.speciesList) ? held.deliveryCrateCtrl.speciesList.slice() : [];
    const crateGrams = Array.isArray(held.deliveryCrateCtrl.gramsList) ? held.deliveryCrateCtrl.gramsList.slice() : [];
    roadStandState.availablePacks += count;
    for (let ci = 0; ci < count; ci++) {
      roadStandState.speciesList.push(crateSpecies[ci] || '');
      roadStandState.gramsList.push(Math.max(1, Math.round(Number(crateGrams[ci]) || 10)));
      roadStandState.itemKinds.push('mushroom');
    }
    held.deliveryCrateCtrl.speciesList = [];
    held.deliveryCrateCtrl.gramsList = [];
    roadStandState.npcSpawnCooldown = Math.min(roadStandState.npcSpawnCooldown, 1.2);
    held.deliveryCrateCtrl.packsCount = 0;
    updateDeliveryCrateVisual(held);
    syncRoadStandVisual();
    ctx?.queueItemStateSync?.(held);
    if (ctx && ctx.queueWorldStateChange) {
      ctx.queueWorldStateChange('stand_packs', roadStandState.availablePacks);
    }
    playEconomyAudio('playClick');
    if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
    if (onToast) {
      onToast(t('items.dehydrationPackaging.m9', { count }));
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  if (held && held.organicBasketCtrl && held.organicBasketCtrl.packsValue > 0) {
    const packsVal = held.organicBasketCtrl.packsValue;
    consumeHeldStandItem(ctx, held, packsVal);
    if (onToast) {
      onToast(t('items.dehydrationPackaging.m10', { packsVal }));
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  if (held && held.mushroomBagCtrl && held.mushroomBagCtrl.filled && held.mushroomBagCtrl.sealed) {
    consumeHeldStandItem(ctx, held, 1);
    if (onToast) {
      onToast(t('items.dehydrationPackaging.m11'));
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  playEconomyAudio('playClick');
  if (onToast) {
    if (roadStandState.availablePacks > 0) {
      onToast(t('items.dehydrationPackaging.m12', { availablePacks: roadStandState.availablePacks, MYCOCOIN_PRICE_PER_PACK }));
    } else {
      onToast(t('items.dehydrationPackaging.m13'));
    }
  }
  return true;
}
