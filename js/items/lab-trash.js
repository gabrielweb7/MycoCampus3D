/**
 * Lixeira Asséptica do Laboratório (MycoCampus3D)
 * Item movível com a palavra LIXO. Esvazia recipientes reutilizáveis (vidros, PP5, petri, béquer, pote)
 * ou descarta bags descartáveis repondo um novo bag limpo no estoque.
 */

import { registerPickable, updateItemBounds } from './item-registry.js';
import { updateContainerVolume } from './liquid-culture.js';
import { updateSpawnVisual } from './spawn-containers.js';
import { updatePetriVisual } from './petri-dish.js';
import { updateMixingBowlLabel } from './mixing-bowl.js';
import { updatePdaMediumVisual } from './pda-mix.js';
import { updateScalpelLabel } from './scalpel.js';

const THREE = window.THREE;

export const LAB_TRASH_META = {
  category: 'furniture',
  purpose: 'Descartar conteúdo de recipientes e bags do laboratório',
  weightGrams: 3200,
  baseTempC: 22.0,
  compatibilities: { canEnterCooker: false, acceptsDisposal: true },
  connections: ['spawn_bag', 'spawn_jar', 'petri', 'beaker']
};

function makeTrashLabelTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b91c1c';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#fecaca';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#ffffff';
  g.font = 'bold 66px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('LIXO', 128, 56);
  g.font = 'bold 17px sans-serif';
  g.fillStyle = '#fee2e2';
  g.fillText('RESÍDUOS DO LABORATÓRIO', 128, 106);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function buildLabTrashBin(ctx, px, py, pz) {
  const tg = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.28 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.55 });
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.8, side: THREE.DoubleSide });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.22 });
  const labelTex = makeTrashLabelTexture();
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex });

  // Corpo inox levemente cônico
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.155, 0.54, 28), bodyMat);
  body.position.y = 0.30;
  body.castShadow = true;
  body.receiveShadow = true;

  // Base escura e cintas de reforço
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.035, 24), darkMat);
  base.position.y = 0.0175;
  const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.006, 8, 28), darkMat);
  band1.rotation.x = Math.PI / 2;
  band1.position.y = 0.16;
  const band2 = new THREE.Mesh(new THREE.TorusGeometry(0.179, 0.006, 8, 28), darkMat);
  band2.rotation.x = Math.PI / 2;
  band2.position.y = 0.46;

  // Borda superior e saco preto visível
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.188, 0.016, 10, 28), lidMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.57;
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.150, 0.50, 24, 1, true), bagMat);
  liner.position.y = 0.31;
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ color: 0x020617 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.52;

  // Tampa articulada atrás, entreaberta
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.575, -0.185);
  lidPivot.rotation.x = -1.05;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.196, 0.196, 0.014, 28), lidMat);
  lid.position.set(0, 0, 0.185);
  const lidKnob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), darkMat);
  lidKnob.position.set(0, 0.016, 0.185);
  lidPivot.add(lid, lidKnob);

  // Placas "LIXO" na frente e atrás
  [1, -1].forEach(function (side) {
    const backing = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.105, 0.016), darkMat);
    backing.position.set(0, 0.31, side * 0.172);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.178, 0.093), labelMat);
    plate.position.set(0, 0.31, side * 0.1812);
    if (side < 0) plate.rotation.y = Math.PI;
    plate.userData.ignoreRay = true;
    tg.add(backing, plate);
  });

  // Hitbox invisível maior para facilitar o descarte
  const hitMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.22, 0.66, 14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = 0.33;
  hitMesh.userData.isLabTrash = true;

  tg.add(body, base, band1, band2, rim, liner, inner, lidPivot, hitMesh);
  tg.userData.isTrash = true;
  tg.userData.tableDims = { w: 0.40, h: 0.58, d: 0.40, surfOffset: 0 };
  tg.userData.updateBounds = updateItemBounds;

  const item = registerPickable(ctx, 'lab_trash_01', 'Lixo (Lixeira do Laboratório)', tg, px, py, pz, 0, 0.22, 0.58, LAB_TRASH_META);

  if (ctx.labTrashMeshes) ctx.labTrashMeshes.push(hitMesh);
  if (ctx.solidColliders) {
    const col = { minX: px - 0.2, maxX: px + 0.2, minZ: pz - 0.2, maxZ: pz + 0.2, minY: py, maxY: py + 0.58, surfaceTopY: py + 0.58 };
    ctx.solidColliders.push(col);
    tg.userData.dynamicCollider = col;
  }
  return item;
}

export function canDisposeItemInTrash(item) {
  if (!item || !item.mesh) return false;
  if (item.mesh.userData.isTrash) return false;
  if (item.spawnCtrl) return !!item.spawnCtrl.filled || !!item.spawnCtrl.burned || !!item.spawnCtrl.contaminated || !!item.spawnCtrl.expired;
  if (item.mesh.userData.isPetri) {
    return true;
  }
  if (item.bowlCtrl) {
    const ing = item.bowlCtrl.ingredients || {};
    return !!(item.bowlCtrl.mixed || (ing.flocao || 0) + (ing.water || 0) + (ing.corn || 0) + (ing.sawdust || 0) > 0);
  }
  if (item.scalpelCtrl) {
    return !!(item.scalpelCtrl.hasBlade && !item.scalpelCtrl.sterile);
  }
  if (item.bladePackCtrl) {
    return !!item.bladePackCtrl.empty;
  }
  if (item.mesh.userData.liquidCtrl && item.id.indexOf('distilled_jug') !== 0) {
    const hasPda = !!(item.pdaMediumCtrl && (item.pdaMediumCtrl.powderGrams > 0 || item.pdaMediumCtrl.mixed || item.pdaMediumCtrl.burned));
    const hasCulture = !!(item.cultureCtrl && (item.cultureCtrl.colonized || item.cultureCtrl.contaminated || item.cultureCtrl.expired));
    // Água pura sempre é descartada na pia, nunca no lixo
    return hasPda || hasCulture;
  }
  return false;
}

export function isContaminatedOrBurned(item) {
  if (!item || !item.mesh) return false;
  if (item.spawnCtrl) return !!(item.spawnCtrl.contaminated || item.spawnCtrl.burned || item.spawnCtrl.expired);
  if (item.mesh.userData.isPetri && item.mesh.userData.petriCtrl) {
    const p = item.mesh.userData.petriCtrl;
    return !!(p.contaminated || p.expired || p.mode === 'contam');
  }
  if (item.pdaMediumCtrl && item.pdaMediumCtrl.burned) return true;
  if (item.cultureCtrl && (item.cultureCtrl.contaminated || item.cultureCtrl.expired)) return true;
  return false;
}

export function resetDisposableContainer(item) {
  if (!item || !item.mesh) return false;
  let cleaned = false;
  if (item.spawnCtrl && !item.spawnCtrl.isBag) {
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
    sp.shelfLifeAgeDays = 0;
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
    p.contaminated = false;
    p.parafilmSealed = false;
    p.expired = false;
    p.ageGameDays = 0;
    p.shelfLifeAgeDays = 0;
    p.lidOpen = false;
    updatePetriVisual(item);
    cleaned = true;
  }
  if (item.scalpelCtrl && item.scalpelCtrl.hasBlade) {
    item.scalpelCtrl.hasBlade = false;
    item.scalpelCtrl.sterile = false;
    item.scalpelCtrl.bladeExpired = false;
    item.scalpelCtrl.bladeContaminated = false;
    item.scalpelCtrl.cutContaminated = false;
    item.scalpelCtrl.bladeAttachedAt = 0;
    item.scalpelCtrl.hasMycelium = false;
    if (item.scalpelCtrl.bladeMesh) item.scalpelCtrl.bladeMesh.visible = false;
    updateScalpelLabel(item);
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
  if (item.cultureCtrl) {
    item.cultureCtrl.colonized = false;
    item.cultureCtrl.contaminated = false;
    item.cultureCtrl.expired = false;
    item.cultureCtrl.ageGameDays = 0;
    item.cultureCtrl.shelfLifeAgeDays = 0;
  }
  if (item.mesh.userData.liquidCtrl && item.id.indexOf('distilled_jug') !== 0) {
    updateContainerVolume(item, 0);
    cleaned = true;
  }
  return cleaned;
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

  if (item.bladePackCtrl && item.bladePackCtrl.empty) {
    if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
    const pIdx = ctx.pickableItems.indexOf(item);
    if (pIdx !== -1) ctx.pickableItems.splice(pIdx, 1);
    if (ctx.heldItem === item) ctx.heldItem = null;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🗑️ Embalagem vazia da lâmina descartada no lixo!');
    ctx.notifyWorldAction();
    return true;
  }

  const cleaned = resetDisposableContainer(item);

  if (cleaned) {
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(item.label);
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🗑️ Conteúdo descartado na lixeira! Recipiente limpo na mão.');
    ctx.notifyWorldAction();
  }
  return cleaned;
}
