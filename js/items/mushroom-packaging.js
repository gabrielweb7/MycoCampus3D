/**
 * Sacos Mylar / Bandejas Seladas e Caixotes de Entrega Comercial (MycoCampus3D).
 */

import { makeBox } from '../engine/textures.js';
import { getCachedCanvasTexture, registerPickable, disposeObjectResources, getItemWeightGrams } from './item-registry.js';
import { CRATE_WIDTH, CRATE_HEIGHT, CRATE_DEPTH, cratePackMask, freeCrateSlot } from '../systems/crate-cargo.js';
import { t } from '../core/i18n.js';
import {
  MYCOCOIN_PRICE_PER_PACK,
  DELIVERY_CRATE_MAX_PACKS,
  playEconomyAudio
} from '../core/myco-coins.js';

const THREE = window.THREE;

export function createMushroomPackVisual(filled, sealed) {
  const wrap = new THREE.Group();
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42 });
  const filmMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.42,
    roughness: 0.12,
    depthWrite: false
  });
  const labelTex = getCachedCanvasTexture('myco_pack_label_v2', 256, 256, (lctx) => {
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(0, 0, 256, 256);
    lctx.strokeStyle = '#16a34a';
    lctx.lineWidth = 6;
    lctx.strokeRect(6, 6, 244, 244);

    lctx.fillStyle = '#dc2626';
    lctx.beginPath();
    lctx.arc(128, 56, 26, Math.PI, 0);
    lctx.fill();
    lctx.fillStyle = '#fef3c7';
    lctx.fillRect(118, 56, 20, 18);

    lctx.fillStyle = '#16a34a';
    lctx.fillRect(12, 86, 232, 86);
    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 28px system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.fillText('MycoCampus', 128, 122);
    lctx.fillStyle = '#fef08a';
    lctx.font = 'bold 21px system-ui, sans-serif';
    lctx.fillText('COGUMELOS SECOS', 128, 156);

    lctx.fillStyle = '#0f172a';
    for (let bx = 42; bx < 214; bx += 8) {
      lctx.fillRect(bx, 190, (bx % 16 === 0) ? 4 : 2, 42);
    }
  });
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.35 });

  const tray = makeBox(0.145, 0.016, 0.175, trayMat);
  tray.position.y = 0.008;
  wrap.add(tray);

  const contentsGroup = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.48 });
  const sGeo = new THREE.CylinderGeometry(0.007, 0.009, 0.036, 6);
  const cGeo = new THREE.SphereGeometry(0.018, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ox = (col === 0 ? -1 : 1) * 0.030;
    const oz = (row - 1) * 0.042;
    const st = new THREE.Mesh(sGeo, stemMat);
    st.rotation.x = Math.PI / 2;
    st.rotation.z = (i - 2.5) * 0.22;
    st.position.set(ox, 0.022, oz + 0.008);
    const cp = new THREE.Mesh(cGeo, capMat);
    cp.position.set(ox, 0.026, oz - 0.012);
    contentsGroup.add(st, cp);
  }
  contentsGroup.visible = Boolean(filled);
  wrap.add(contentsGroup);

  const film = makeBox(0.142, 0.026, 0.172, filmMat, { noShadow: true });
  film.position.y = 0.025;
  wrap.add(film);

  const labelSticker = makeBox(0.075, 0.003, 0.085, labelMat, { noShadow: true });
  labelSticker.position.set(0, 0.039, 0);
  labelSticker.visible = Boolean(sealed);
  wrap.add(labelSticker);

  const openCollarMesh = makeBox(0.140, 0.022, 0.012, filmMat, { noShadow: true });
  openCollarMesh.position.set(0, 0.044, -0.078);
  openCollarMesh.rotation.x = -0.35;
  openCollarMesh.visible = !sealed;
  wrap.add(openCollarMesh);

  const sealStripMesh = makeBox(0.144, 0.008, 0.015, new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    emissive: 0x059669,
    emissiveIntensity: 0.35,
    roughness: 0.25
  }));
  sealStripMesh.position.set(0, 0.036, -0.076);
  sealStripMesh.visible = Boolean(sealed);
  wrap.add(sealStripMesh);

  return { wrap, contentsGroup, sealStripMesh, labelSticker, openCollarMesh };
}

export function updateMushroomBagVisual(item) {
  if (!item || !item.mushroomBagCtrl) return;
  const bc = item.mushroomBagCtrl;
  if (bc.contentsMesh) bc.contentsMesh.visible = bc.filled;
  if (bc.labelSticker) bc.labelSticker.visible = bc.sealed;
  if (bc.openCollarMesh) bc.openCollarMesh.visible = !bc.sealed;
  if (bc.sealStripMesh) {
    bc.sealStripMesh.visible = bc.sealed;
    if (bc.sealStripMesh.material && bc.sealStripMesh.material.color) {
      bc.sealStripMesh.material.color.setHex(bc.sealed ? 0x16a34a : 0x64748b);
    }
  }
  const spTag = bc.speciesName ? ` • ${bc.speciesName}` : '';
  if (bc.sealed) {
    item.label = `📦 Pacote Selado de Cogumelos (${bc.grams}g Crocantes${spTag} • Pronto p/ Caixote!)`;
  } else if (bc.filled) {
    item.label = `🛍️ Saco com Cogumelos Secos (${bc.grams}g${spTag} • Segure e aponte na Seladora Térmica!)`;
  } else {
    item.label = '🛍️ Saco Mylar vazio • coloque um lote seco';
  }
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function makeMushroomBag(ctx, id, px, py, pz, opts = {}) {
  const vis = createMushroomPackVisual(opts.filled, opts.sealed);
  const g = vis.wrap;
  g.userData.isMushroomBag = true;

  const item = registerPickable(
    ctx,
    id,
    '🛍️ Saco/Bandeja Vazia p/ Cogumelos Secos',
    g,
    px,
    py,
    pz,
    opts.ry || 0,
    0.13,
    0.06,
    {
      category: 'packaging',
      purpose: 'Embalagem com visor para um lote de cogumelos secos. Feche na seladora térmica.',
      getWeightGrams: (it) => 8 + ((it && it.mushroomBagCtrl && it.mushroomBagCtrl.filled) ? (it.mushroomBagCtrl.grams || 10) : 0),
      compatibilities: {
        canEnterCooker: false,
        isMushroomPackBag: true
      },
      serializeState: (it) => {
        const bc = it && it.mushroomBagCtrl;
        if (!bc) return null;
        return {
          filled: !!bc.filled,
          sealed: !!bc.sealed,
          grams: bc.filled ? Math.max(1, Math.min(200, Math.round(Number(bc.grams) || 10))) : 0,
          speciesName: bc.speciesName ? String(bc.speciesName).slice(0, 60) : '',
          removed: !!it._removedForSync
        };
      },
      applyState: (it, custom) => {
        const bc = it && it.mushroomBagCtrl;
        if (!bc || !custom) return;
        bc.filled = !!custom.filled;
        bc.sealed = !!custom.sealed;
        bc.grams = bc.filled ? Math.max(1, Math.min(200, Math.round(Number(custom.grams) || 10))) : 0;
        bc.speciesName = typeof custom.speciesName === 'string' ? custom.speciesName : '';
        updateMushroomBagVisual(it);
      }
    }
  );

  item.mushroomBagCtrl = {
    filled: Boolean(opts.filled),
    sealed: Boolean(opts.sealed),
    grams: opts.filled ? (opts.grams || 10) : 0,
    speciesName: opts.speciesName || '',
    contentsMesh: vis.contentsGroup,
    sealStripMesh: vis.sealStripMesh,
    labelSticker: vis.labelSticker,
    openCollarMesh: vis.openCollarMesh,
    updateVisual: () => updateMushroomBagVisual(item)
  };
  updateMushroomBagVisual(item);
  return item;
}

export function packDriedMushroomsIntoBag(ctx, bagItem, driedBatchItem) {
  if (!bagItem || !bagItem.mushroomBagCtrl || !driedBatchItem || !driedBatchItem.driedMushroomCtrl) return false;
  const bc = bagItem.mushroomBagCtrl;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;
  if (bc.filled) {
    if (onToast) onToast(t('items.dehydrationPackaging.m1'));
    return true;
  }
  const dc = driedBatchItem.driedMushroomCtrl;
  bc.filled = true;
  bc.sealed = false;
  bc.grams = dc.grams || 10;
  bc.speciesName = dc.speciesName || 'Golden Teacher';
  updateMushroomBagVisual(bagItem);
  if (ctx && ctx.markItemMoved) ctx.markItemMoved(bagItem);
  driedBatchItem._removedForSync = true;
  if (ctx && ctx.pendingMovedItems && driedBatchItem.id) {
    ctx.pendingMovedItems[driedBatchItem.id] = {
      id: driedBatchItem.id,
      state: { custom: { dynamicKind: 'dried_batch', removed: true } }
    };
  }

  if (driedBatchItem.mesh && driedBatchItem.mesh.parent) {
    driedBatchItem.mesh.parent.remove(driedBatchItem.mesh);
  }
  disposeObjectResources(driedBatchItem.mesh);
  if (ctx && Array.isArray(ctx.pickableItems)) {
    const idx = ctx.pickableItems.indexOf(driedBatchItem);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  }
  if (ctx && ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(driedBatchItem.id);
  }
  if (ctx && ctx.heldItem === driedBatchItem) {
    ctx.heldItem = bagItem;
    ctx.lastPickupAt = performance.now();
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(bagItem.label);
  } else if (ctx && ctx.heldItem === bagItem && ctx.callbacks && ctx.callbacks.onHoldChange) {
    ctx.callbacks.onHoldChange(bagItem.label);
  }

  playEconomyAudio('playClick');
  if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('medium');
  if (onToast) {
    onToast(t('items.dehydrationPackaging.m2', { grams: bc.grams, speciesName: bc.speciesName }));
  }
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

export function sealMushroomBag(ctx, bagItem) {
  if (!bagItem || !bagItem.mushroomBagCtrl) return false;
  const bc = bagItem.mushroomBagCtrl;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;
  if (!bc.filled) {
    if (onToast) onToast(t('items.dehydrationPackaging.m3'));
    return true;
  }
  if (bc.sealed) {
    if (onToast) onToast(t('items.dehydrationPackaging.m4'));
    return true;
  }
  bc.sealed = true;
  updateMushroomBagVisual(bagItem);
  if (ctx && ctx.hoveredHeatSealerObj && ctx.hoveredHeatSealerObj.sealerCtrl) {
    ctx.hoveredHeatSealerObj.sealerCtrl.triggerSealAnimation();
  } else if (ctx && ctx.pickableItems && bagItem.mesh) {
    let bestSealer = null;
    let bestD = Infinity;
    const bp = bagItem.mesh.position;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      if (!it || !it.sealerCtrl || !it.mesh) continue;
      const d = it.mesh.position.distanceToSquared(bp);
      if (d < bestD) { bestD = d; bestSealer = it; }
    }
    if (bestSealer) bestSealer.sealerCtrl.triggerSealAnimation();
  }
  playEconomyAudio('playClick');
  if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_seal');
  if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
  if (ctx && ctx.heldItem === bagItem && ctx.callbacks && ctx.callbacks.onHoldChange) {
    ctx.callbacks.onHoldChange(bagItem.label);
  }
  if (onToast) {
    onToast(t('items.dehydrationPackaging.m5', { grams: bc.grams, speciesName: bc.speciesName }));
  }
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

function getDeliveryCrateWeight(crate) {
  let weight = 240;
  for (let i = 0; i < (crate?.packsCount || 0); i++) {
    weight += 8 + (Number(crate.gramsList?.[i]) || 25);
  }
  return weight;
}

export function updateDeliveryCrateVisual(item) {
  if (!item || !item.deliveryCrateCtrl) return;
  const cc = item.deliveryCrateCtrl;
  if (cc.packMeshes) {
    const mask = cratePackMask(item);
    for (let i = 0; i < cc.packMeshes.length; i++) {
      const pack = cc.packMeshes[i];
      const visible = !!(mask & (1 << i));
      pack.visible = visible;
      pack.traverse(part => { part.userData.hiddenCratePack = !visible; });
    }
  }
  const cargo = item.trayContents || [];
  const fresh = cargo.filter(({ item: content }) => content.wildMushroomCtrl).length;
  const details = [];
  if (cc.packsCount) details.push(t('crate.packs', { count: cc.packsCount }));
  if (fresh) details.push(t('crate.fresh', { count: fresh }));
  if (cargo.length > fresh) details.push(t('crate.items', { count: cargo.length - fresh }));
  item.label = `📦 ${t('crate.name')} • ${details.join(' · ') || t('crate.empty')}`;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function makeDeliveryCrate(ctx, id, px, py, pz, opts = {}) {
  const g = new THREE.Group();
  const pineWoodTex = getCachedCanvasTexture('pine_fruit_crate_wood', 128, 128, (wctx) => {
    wctx.fillStyle = '#ead7b0';
    wctx.fillRect(0, 0, 128, 128);
    wctx.strokeStyle = '#d1b382';
    wctx.lineWidth = 1.5;
    for (let y = 6; y < 128; y += 11) {
      wctx.beginPath();
      wctx.moveTo(0, y);
      wctx.bezierCurveTo(40, y + (y % 2 === 0 ? 4 : -4), 88, y - 3, 128, y);
      wctx.stroke();
    }
  });
  const pineMat = new THREE.MeshStandardMaterial({ map: pineWoodTex, roughness: 0.78 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0xc8a46e, roughness: 0.85 });

  const W = CRATE_WIDTH;
  const H = CRATE_HEIGHT;
  const D = CRATE_DEPTH;

  for (let b = 0; b < 3; b++) {
    const botSlat = makeBox(W - 0.01, 0.012, 0.095, pineMat);
    botSlat.position.set(0, 0.008, -0.115 + b * 0.115);
    g.add(botSlat);
  }
  [[-W * 0.5 + 0.02, -D * 0.5 + 0.02], [W * 0.5 - 0.02, -D * 0.5 + 0.02], [-W * 0.5 + 0.02, D * 0.5 - 0.02], [W * 0.5 - 0.02, D * 0.5 - 0.02]].forEach((cp) => {
    const post = makeBox(0.024, H, 0.024, postMat);
    post.position.set(cp[0], H * 0.5, cp[1]);
    g.add(post);
  });
  const slatYs = [0.032, 0.084, 0.136];
  for (let si = 0; si < slatYs.length; si++) {
    const sy = slatYs[si];
    const fSlat = makeBox(W, 0.034, 0.012, pineMat);
    fSlat.position.set(0, sy, D * 0.5 - 0.006);
    const bSlat = makeBox(W, 0.034, 0.012, pineMat);
    bSlat.position.set(0, sy, -D * 0.5 + 0.006);
    const lSlat = makeBox(0.012, 0.034, D, pineMat);
    lSlat.position.set(-W * 0.5 + 0.006, sy, 0);
    const rSlat = makeBox(0.012, 0.034, D, pineMat);
    rSlat.position.set(W * 0.5 - 0.006, sy, 0);
    g.add(fSlat, bSlat, lSlat, rSlat);
  }

  const packMeshes = [];
  for (let i = 0; i < DELIVERY_CRATE_MAX_PACKS; i++) {
    const pv = createMushroomPackVisual(true, true);
    const col = i % 2;
    const row = Math.floor(i / 2);
    pv.wrap.position.set(-0.092 + col * 0.184, 0.022, -0.088 + row * 0.176);
    pv.wrap.visible = i < (opts.packsCount || 0);
    g.add(pv.wrap);
    packMeshes.push(pv.wrap);
  }

  g.userData.isDeliveryCrate = true;

  const item = registerPickable(
    ctx,
    id,
    '📤 Caixa de Entrega Comercial',
    g,
    px,
    py,
    pz,
    opts.ry || 0,
    0.24,
    0.18,
    {
      category: 'packaging',
      purpose: t('crate.purpose'),
      getWeightGrams: (it) => getDeliveryCrateWeight(it?.deliveryCrateCtrl) +
        (it?.trayContents || []).reduce((weight, cargo) => weight + getItemWeightGrams(cargo.item), 0),
      compatibilities: {
        canEnterCooker: false,
        isDeliveryCrate: true
      },
      serializeState: (it) => {
        const cc = it && it.deliveryCrateCtrl;
        if (!cc) return null;
        return {
          packsCount: Math.max(0, Math.min(DELIVERY_CRATE_MAX_PACKS, Math.round(Number(cc.packsCount) || 0))),
          speciesList: Array.isArray(cc.speciesList) ? cc.speciesList.slice(0, DELIVERY_CRATE_MAX_PACKS) : [],
          gramsList: Array.isArray(cc.gramsList) ? cc.gramsList.slice(0, DELIVERY_CRATE_MAX_PACKS) : []
        };
      },
      applyState: (it, custom) => {
        const cc = it && it.deliveryCrateCtrl;
        if (!cc || !custom || !Object.hasOwn(custom, 'packsCount')) return;
        cc.packsCount = Math.max(0, Math.min(DELIVERY_CRATE_MAX_PACKS, Math.round(Number(custom.packsCount) || 0)));
        cc.speciesList = Array.isArray(custom.speciesList) ? custom.speciesList.slice(0, cc.packsCount) : [];
        cc.gramsList = Array.isArray(custom.gramsList) ? custom.gramsList.slice(0, cc.packsCount) : [];
        updateDeliveryCrateVisual(it);
      }
    }
  );

  item.deliveryCrateCtrl = {
    packsCount: opts.packsCount || 0,
    speciesList: Array.isArray(opts.speciesList) ? opts.speciesList.slice() : [],
    gramsList: Array.isArray(opts.gramsList) ? opts.gramsList.slice() : [],
    packMeshes,
    updateVisual: () => updateDeliveryCrateVisual(item)
  };
  updateDeliveryCrateVisual(item);
  return item;
}

export function addSealedBagToDeliveryCrate(ctx, crateItem, bagItem) {
  if (!crateItem || !crateItem.deliveryCrateCtrl || !bagItem || !bagItem.mushroomBagCtrl) return false;
  const cc = crateItem.deliveryCrateCtrl;
  const bc = bagItem.mushroomBagCtrl;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;

  if (!bc.filled) {
    if (onToast) onToast(t('items.dehydrationPackaging.m6'));
    return true;
  }
  if (!bc.sealed) {
    if (onToast) onToast(t('items.dehydrationPackaging.m7'));
    return true;
  }
  if (freeCrateSlot(crateItem) < 0) {
    if (onToast) onToast(t('crate.full'));
    return true;
  }

  cc.speciesList = Array.isArray(cc.speciesList) ? cc.speciesList : [];
  cc.gramsList = Array.isArray(cc.gramsList) ? cc.gramsList : [];
  cc.speciesList[cc.packsCount] = bc.speciesName || '';
  cc.gramsList[cc.packsCount] = Math.max(1, Math.round(Number(bc.grams) || 10));
  cc.packsCount++;
  updateDeliveryCrateVisual(crateItem);
  ctx?.queueItemStateSync?.(crateItem);
  bagItem._removedForSync = true;
  if (ctx && ctx.pendingMovedItems && bagItem.id) {
    ctx.pendingMovedItems[bagItem.id] = {
      id: bagItem.id,
      state: { custom: { dynamicKind: 'mushroom_bag', removed: true } }
    };
  }

  if (bagItem.mesh && bagItem.mesh.parent) {
    bagItem.mesh.parent.remove(bagItem.mesh);
  }
  disposeObjectResources(bagItem.mesh);
  if (ctx && Array.isArray(ctx.pickableItems)) {
    const idx = ctx.pickableItems.indexOf(bagItem);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  }
  if (ctx && ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(bagItem.id);
  }
  if (ctx && ctx.heldItem === bagItem) {
    ctx.heldItem = null;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  }

  playEconomyAudio('playClick');
  if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('medium');
  if (onToast) {
    const val = cc.packsCount * MYCOCOIN_PRICE_PER_PACK;
    onToast(t('items.dehydrationPackaging.m8', { packsCount: cc.packsCount, DELIVERY_CRATE_MAX_PACKS, val }));
  }
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}
