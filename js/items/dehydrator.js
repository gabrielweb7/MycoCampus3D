/**
 * Desidratadora de Cogumelos (MycoCampus3D)
 * Seca cogumelos frescos a 55°C até 0% de umidade (crocante),
 * sincronizando estado no MySQL/multiplayer via meta.serializeState / applyState.
 */

import { registerPickable } from './item-registry.js';
import { makeDriedMushroomBatch } from './lab-advanced-tools.js';

const THREE = window.THREE;

export const DEHYDRATOR_DRY_SECONDS = 15;

export const DEHYDRATOR_META = {
  category: 'equipment',
  purpose: 'Desidratar cogumelos colhidos até 0% de umidade (crocante)',
  weightGrams: 4200,
  getTempC: (item) => (item && item.dehydratorCtrl && item.dehydratorCtrl.on ? 55 : 23.0),
  compatibilities: { canEnterCooker: false },
  serializeState: (item) => {
    const dc = item && item.dehydratorCtrl;
    if (!dc) return null;
    return {
      on: !!dc.on,
      hasMushroom: !!dc.hasMushroom,
      progress: Math.round(dc.progress || 0),
      crisp: !!dc.crisp
    };
  },
  applyState: (item, custom) => {
    const dc = item && item.dehydratorCtrl;
    if (!dc || !custom) return;
    dc.on = !!custom.on;
    dc.hasMushroom = !!custom.hasMushroom;
    dc.progress = Number(custom.progress) || 0;
    dc.crisp = !!custom.crisp;
    updateDehydratorVisual(item);
  }
};

export function updateDehydratorVisual(item) {
  if (!item || !item.dehydratorCtrl) return;
  const dc = item.dehydratorCtrl;
  if (dc.mushGroup) dc.mushGroup.visible = !!dc.hasMushroom;
  if (dc.mushMat) {
    dc.mushMat.color.setHex(dc.crisp ? 0xd97706 : 0xfbbf24);
    dc.mushGroup.scale.setScalar(dc.crisp ? 0.78 : 1.0);
  }
  if (dc.ledMat) {
    dc.ledMat.color.setHex(dc.on ? (dc.crisp ? 0x22c55e : 0xf59e0b) : 0xef4444);
  }
  const stTxt = !dc.hasMushroom
    ? (dc.on ? '55°C • Vazia' : 'Desligada')
    : (dc.crisp
      ? '✅ Crocante (0% umidade)'
      : (dc.on ? '♨️ Secando ' + Math.round(dc.progress) + '%' : '⏸️ Pausada (' + Math.round(dc.progress) + '%)'));
  item.label = 'Desidratadora de Cogumelos • ' + stTxt;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function interactDehydrator(ctx, item) {
  if (!item || !item.dehydratorCtrl) return false;
  const dc = item.dehydratorCtrl;
  if (!dc.hasMushroom) {
    dc.hasMushroom = true;
    dc.on = true;
    dc.progress = 0;
    dc.crisp = false;
    updateDehydratorVisual(item);
    if (ctx.markItemMoved) ctx.markItemMoved(item);
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🍄 Desidratadora ligada (55°C)! Secando cogumelo...');
    }
    return true;
  }
  if (dc.crisp) {
    const spName = dc.speciesName || 'Golden Teacher (Psilocybe cubensis)';
    dc.hasMushroom = false;
    dc.progress = 0;
    dc.crisp = false;
    dc.on = false;
    updateDehydratorVisual(item);
    if (ctx.markItemMoved) ctx.markItemMoved(item);
    if (ctx.callbacks && ctx.callbacks.onDehydrateReward) ctx.callbacks.onDehydrateReward();
    if (ctx && ctx.scene && !ctx.heldItem) {
      const px = item.mesh ? item.mesh.position.x : -18.5;
      const py = item.mesh ? (item.mesh.position.y + 0.30) : 1.1;
      const pz = item.mesh ? item.mesh.position.z : -10.5;
      const driedBatch = makeDriedMushroomBatch(ctx, 'dried_batch_' + Date.now().toString(36), spName, px, py, pz);
      ctx.heldItem = driedBatch;
      ctx.lastPickupAt = performance.now();
      if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(driedBatch.label);
    }
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('✨ Lote de 25g de Cogumelos Desidratados Crocantes (0% umidade) na mão! Pese na Balança ou guarde no Pote Hermético com Sílica Gel! (+15 XP)');
    }
    return true;
  }
  dc.on = !dc.on;
  updateDehydratorVisual(item);
  if (ctx.markItemMoved) ctx.markItemMoved(item);
  return true;
}

export function makeDehydrator(ctx, id, px, py, pz) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.19, 0.07, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 })
  );
  base.position.y = 0.035;
  const chamber = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.165, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.38, roughness: 0.15, depthWrite: false })
  );
  chamber.position.y = 0.16;
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.175, 0.175, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35 })
  );
  lid.position.y = 0.265;
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), ledMat);
  led.position.set(0, 0.04, 0.186);

  const mushGroup = new THREE.Group();
  mushGroup.position.set(0, 0.11, 0);
  mushGroup.visible = false;
  const mushMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.65 });
  const mCap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mushMat);
  mCap.position.y = 0.04;
  const mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xfef3c7 }));
  mStem.position.y = 0.025;
  mushGroup.add(mStem, mCap);

  g.add(base, chamber, lid, led, mushGroup);

  const item = registerPickable(ctx, id, 'Desidratadora de Cogumelos • Desligada', g, px, py, pz, 0, 0.20, 0.28, DEHYDRATOR_META);
  item.dehydratorCtrl = {
    on: false,
    hasMushroom: false,
    progress: 0,
    crisp: false,
    mushGroup,
    mushMat,
    ledMat
  };
  ctx.dehydrators = ctx.dehydrators || [];
  ctx.dehydrators.push(item);
  return item;
}

export function stepDehydrators(ctx, dt) {
  const list = ctx && ctx.dehydrators;
  if (!list || !list.length) return;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const dc = item && item.dehydratorCtrl;
    if (!dc || !dc.on || !dc.hasMushroom || dc.crisp) continue;
    dc.progress = Math.min(100, dc.progress + (dt / DEHYDRATOR_DRY_SECONDS) * 100);
    if (dc.progress >= 100) {
      dc.crisp = true;
      updateDehydratorVisual(item);
      if (ctx.markItemMoved) ctx.markItemMoved(item);
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast('✅ Desidratadora: Cogumelo Crocante (0% umidade) pronto!');
      }
    } else if (Math.floor(dc.progress) % 10 === 0) {
      updateDehydratorVisual(item);
    }
  }
}
