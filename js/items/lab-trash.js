/**
 * Lixeira Asséptica do Laboratório (MycoCampus3D)
 * Esvazia recipientes reutilizaveis (vidros, PP5, petri, bequer, pote)
 * ou descarta bags descartaveis repondo um novo bag limpo no estoque.
 */

import { updateContainerVolume } from './liquid-culture.js';
import { updateSpawnVisual } from './spawn-containers.js';
import { updatePetriVisual } from './petri-dish.js';
import { updateMixingBowlLabel } from './mixing-bowl.js';
import { updatePdaMediumVisual } from './pda-mix.js';

const THREE = window.THREE;

export function buildLabTrashBin(ctx, px, py, pz) {
  const tg = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.45, roughness: 0.45 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.3, roughness: 0.6 });
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.56, 20), bodyMat);
  body.position.y = 0.28;
  body.castShadow = true;
  body.receiveShadow = true;

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.018, 10, 22), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.56;

  const innerBag = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.14, 0.53, 18), bagMat);
  innerBag.position.y = 0.29;

  const bioBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.01),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  bioBadge.position.set(0, 0.36, 0.175);

  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.62, 14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = 0.31;
  hitMesh.userData.isLabTrash = true;

  tg.add(body, rim, innerBag, bioBadge, hitMesh);
  tg.position.set(px, py, pz);
  ctx.scene.add(tg);
  if (ctx.labTrashMeshes) ctx.labTrashMeshes.push(hitMesh);
  if (ctx.solidColliders) {
    ctx.solidColliders.push({ minX: px - 0.22, maxX: px + 0.22, minZ: pz - 0.22, maxZ: pz + 0.22, maxY: py + 0.6 });
  }
  return tg;
}

export function canDisposeItemInTrash(item) {
  if (!item || !item.mesh) return false;
  if (item.spawnCtrl) return !!item.spawnCtrl.filled || !!item.spawnCtrl.burned || !!item.spawnCtrl.contaminated || !!item.spawnCtrl.expired;
  if (item.mesh.userData.isPetri) {
    const p = item.mesh.userData.petriCtrl;
    return !!(p && p.mode !== 'bare');
  }
  if (item.bowlCtrl) {
    const ing = item.bowlCtrl.ingredients || {};
    return !!(item.bowlCtrl.mixed || (ing.flocao || 0) + (ing.water || 0) + (ing.corn || 0) + (ing.sawdust || 0) > 0);
  }
  if (item.mesh.userData.liquidCtrl && item.id.indexOf('distilled_jug') !== 0) {
    return item.mesh.userData.liquidCtrl.volMl > 0 || !!(item.pdaMediumCtrl && item.pdaMediumCtrl.powderGrams > 0);
  }
  return false;
}

export function handleTrashDisposal(ctx, item) {
  if (!item || !item.mesh) return false;

  if (item.spawnCtrl && item.spawnCtrl.isBag) {
    const sp = item.spawnCtrl;
    sp.filled = false;
    sp.fillGrams = 0;
    sp.waterMl = 0;
    sp.substrateKind = '';
    sp.sterilized = false;
    sp.sterilizeProgress = 0;
    sp.sealed = false;
    sp.inoculated = false;
    sp.colonized = false;
    sp.colonization = 0;
    sp.contaminated = false;
    sp.burned = false;
    sp.expired = false;
    sp.ageGameDays = 0;
    updateSpawnVisual(item);
    item.mesh.position.copy(item.homePos);
    item.mesh.rotation.set(0, item.homeRy || 0, 0);
    item.isMoved = false;
    if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
    ctx.pendingMovedItems[item.id] = {
      id: item.id, x: item.homePos.x, y: item.homePos.y, z: item.homePos.z, ry: item.homeRy || 0
    };
    ctx.heldItem = null;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🗑️ Bag descartado no lixo! Novo bag limpo reposto no estoque.');
    ctx.notifyWorldAction();
    return true;
  }

  let cleaned = false;
  if (item.spawnCtrl) {
    const sp = item.spawnCtrl;
    sp.filled = false;
    sp.fillGrams = 0;
    sp.waterMl = 0;
    sp.substrateKind = '';
    sp.sterilized = false;
    sp.sterilizeProgress = 0;
    sp.sealed = false;
    sp.inoculated = false;
    sp.colonized = false;
    sp.colonization = 0;
    sp.contaminated = false;
    sp.burned = false;
    sp.expired = false;
    sp.ageGameDays = 0;
    updateSpawnVisual(item);
    cleaned = true;
  }
  if (item.mesh.userData.isPetri && item.mesh.userData.petriCtrl) {
    const p = item.mesh.userData.petriCtrl;
    p.mode = 'bare';
    p.sterilized = false;
    p.inoculated = false;
    p.inoculationMethod = '';
    p.colonization = 0;
    p.expired = false;
    p.ageGameDays = 0;
    p.lidOpen = false;
    updatePetriVisual(item);
    cleaned = true;
  }
  if (item.bowlCtrl) {
    item.bowlCtrl.ingredients = { flocao: 0, water: 0, corn: 0, sawdust: 0 };
    item.bowlCtrl.mixed = false;
    item.bowlCtrl.stirCount = 0;
    updateMixingBowlLabel(item);
    cleaned = true;
  }
  if (item.pdaMediumCtrl) {
    item.pdaMediumCtrl.powderGrams = 0;
    item.pdaMediumCtrl.mixed = false;
    item.pdaMediumCtrl.stirProgress = 0;
    item.pdaMediumCtrl.sterilized = false;
    item.pdaMediumCtrl.burned = false;
    updatePdaMediumVisual(item);
    cleaned = true;
  }
  if (item.mesh.userData.liquidCtrl && item.id.indexOf('distilled_jug') !== 0) {
    updateContainerVolume(item, 0);
    cleaned = true;
  }

  if (cleaned) {
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(item.label);
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🗑️ Conteúdo descartado na lixeira! Recipiente limpo na mão.');
    ctx.notifyWorldAction();
  }
  return cleaned;
}
