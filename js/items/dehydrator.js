/**
 * Desidratadora de Cogumelos (MycoCampus3D)
 * Seca cogumelos frescos a 55°C até 0% de umidade (crocante),
 * sincronizando estado no MySQL/multiplayer via meta.serializeState / applyState.
 */

import { disposeObjectResources, registerPickable } from './item-registry.js';
import { makeDriedMushroomBatch } from './lab-advanced-tools.js';
import { t } from '../core/i18n.js';

const THREE = window.THREE;

export const DEHYDRATOR_DRY_SECONDS = 15;

function queueDehydratorState(ctx, item) {
  if (ctx.queueItemStateSync) ctx.queueItemStateSync(item);
  else ctx.markItemMoved?.(item);
}

function createBatchId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'dried_batch_' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const DEHYDRATOR_META = {
  category: 'equipment',
  purpose: 'Desidratar cogumelos colhidos até 0% de umidade (crocante)',
  weightGrams: 4200,
  getTempC: (item) => (item && item.dehydratorCtrl && item.dehydratorCtrl.on ? 55 : 23.0),
  compatibilities: { canEnterCooker: false },
  serializeState: (item) => {
    const dc = item && item.dehydratorCtrl;
    if (!dc) return null;
    const rawProg = Math.max(0, Math.min(100, Number(dc.progress) || 0));
    const payload = {
      on: !!dc.on,
      hasMushroom: !!dc.hasMushroom,
      progress: dc.crisp ? 100 : dc.on ? Math.floor(rawProg / 25) * 25 : Math.round(rawProg),
      crisp: !!dc.crisp,
      speciesName: dc.speciesName ? String(dc.speciesName).slice(0, 60) : ''
    };
    if (dc.grams && dc.grams !== 10) {
      payload.grams = Math.max(1, Math.min(200, Math.round(Number(dc.grams) || 10)));
    }
    if (dc.hasMushroom && dc.batchId) payload.batchId = dc.batchId;
    return payload;
  },
  applyState: (item, custom) => {
    const dc = item && item.dehydratorCtrl;
    if (!dc || !custom) return;
    const nextOn = !!custom.on;
    const nextHas = !!custom.hasMushroom;
    const nextBatchId = nextHas && /^dried_batch_[a-z0-9_]{2,40}$/.test(custom.batchId) ? custom.batchId : '';
    const sameBatch = dc.hasMushroom && nextHas && (dc.batchId || '') === nextBatchId &&
      (nextBatchId || dc.speciesName === custom.speciesName);
    const nextProg = nextHas ? Math.max(0, Math.min(100, Number(custom.progress) || 0)) : 0;
    dc.progress = sameBatch && dc.on && nextOn ? Math.max(Number(dc.progress) || 0, nextProg) : nextProg;
    dc.on = nextOn;
    dc.hasMushroom = nextHas;
    dc.crisp = nextHas && (!!custom.crisp || dc.progress >= 100 || (sameBatch && dc.crisp));
    if (dc.crisp) dc.progress = 100;
    dc.batchId = nextBatchId;
    dc.speciesName = nextHas && typeof custom.speciesName === 'string' ? custom.speciesName : '';
    dc.grams = Math.max(1, Math.min(200, Math.round(Number(custom.grams) || 10)));
    dc._lastVisStep = Math.floor((Number(dc.progress) || 0) / 10);
    updateDehydratorVisual(item);
  }
};

export function updateDehydratorVisual(item) {
  if (!item || !item.dehydratorCtrl) return;
  const dc = item.dehydratorCtrl;
  if (dc.mushGroup) dc.mushGroup.visible = !!dc.hasMushroom;
  const p = Math.max(0, Math.min(1, (Number(dc.progress) || 0) / 100));
  if (dc.mushMat && dc.mushGroup) {
    if (dc.crisp) {
      dc.mushMat.color.setHex(0x92400e);
      dc.mushGroup.scale.setScalar(0.74);
    } else {
      // Transição progressiva de fresco dourado claro -> seco crocante ambar/marrom
      dc.mushMat.color.setRGB(0.98 - p * 0.40, 0.75 - p * 0.48, 0.14 - p * 0.08);
      dc.mushGroup.scale.setScalar(1.0 - p * 0.26);
    }
  }
  if (dc.heatGlowMat) {
    dc.heatGlowMat.emissiveIntensity = dc.on ? 1.15 : 0.0;
    dc.heatGlowMat.opacity = dc.on ? 0.85 : 0.25;
  }
  if (dc.ledMat) {
    dc.ledMat.color.setHex(dc.on ? (dc.crisp ? 0x22c55e : 0xf59e0b) : 0xef4444);
  }
  const stTxt = !dc.hasMushroom
    ? (dc.on ? '55°C • Vazia' : 'Desligada')
    : (dc.crisp
      ? `✅ Lote crocante • ${dc.grams} g • retire com a mão livre`
      : (dc.on ? '♨️ Secando ' + Math.round(dc.progress) + '%' : '⏸️ Pausada (' + Math.round(dc.progress) + '%)'));
  item.label = 'Desidratadora de Cogumelos • ' + stTxt;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function interactDehydrator(ctx, item, explicitMushroomItem = null) {
  if (!ctx || !item?.dehydratorCtrl || item.isReadOnly || item._removedForSync ||
      ctx.isHeldByRemote?.(item.id)) return false;
  const dc = item.dehydratorCtrl;
  if (!dc.hasMushroom) {
    const heldMush = explicitMushroomItem || (ctx && ctx.heldItem && ctx.heldItem.wildMushroomCtrl ? ctx.heldItem : null);
    if (!heldMush || !heldMush.wildMushroomCtrl) {
      dc.on = !dc.on;
      updateDehydratorVisual(item);
      queueDehydratorState(ctx, item);
      if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast(dc.on
          ? '🌡️ Desidratadora pré-aquecida (55°C)! Segure um cogumelo fresco colhido e clique nela para desidratar.'
          : '⚠️ Desidratadora vazia desligada! Colha um cogumelo fresco na Estufa, Monotub ou Bosque antes de secar.');
      }
      ctx.notifyWorldAction?.();
      return true;
    }
    const wm = heldMush.wildMushroomCtrl;
    if (wm.removed || heldMush._removedForSync || heldMush.isReadOnly || ctx.isHeldByRemote?.(heldMush.id)) return false;
    dc.batchId = createBatchId();
    dc.speciesName = wm.speciesName || 'Golden Teacher (Psilocybe cubensis)';
    dc.grams = Math.max(1, Math.min(200, Math.round(Number(wm.grams) || 10)));
    dc.hasMushroom = true;
    dc.on = true;
    dc.progress = 0;
    dc.crisp = false;
    dc._lastVisStep = 0;
    updateDehydratorVisual(item);
    queueDehydratorState(ctx, item);
    wm.removed = true;
    if (ctx.markItemRemoved) ctx.markItemRemoved(heldMush);
    else if (ctx.pendingMovedItems && heldMush.id) {
      ctx.pendingMovedItems[heldMush.id] = {
        id: heldMush.id,
        state: { custom: { removed: true } }
      };
    }
    heldMush._removedForSync = true;
    if (heldMush.mesh && heldMush.mesh.parent) heldMush.mesh.parent.remove(heldMush.mesh);
    if (heldMush.mesh) disposeObjectResources(heldMush.mesh);
    if (ctx && Array.isArray(ctx.pickableItems)) {
      const idx = ctx.pickableItems.indexOf(heldMush);
      if (idx !== -1) ctx.pickableItems.splice(idx, 1);
    }
    if (ctx && ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
      ctx.pickableMap.delete(heldMush.id);
    }
    if (ctx && ctx.heldItem === heldMush) {
      ctx.heldItem = null;
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
    }
    if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('items.dehydrator.m1', { speciesName: dc.speciesName, grams: dc.grams }));
    }
    ctx.notifyWorldAction?.();
    return true;
  }
  if (ctx.heldItem) {
    if (ctx.callbacks?.onToast) ctx.callbacks.onToast(dc.crisp
      ? '🍄 Lote pronto. Libere a mão para retirá-lo.'
      : '♨️ A desidratadora já tem um lote. Espere terminar para carregar outro.');
    return true;
  }
  if (dc.crisp) {
    if (!ctx.scene) return false;
    const spName = dc.speciesName || 'Golden Teacher (Psilocybe cubensis)';
    const batchGrams = Math.max(1, Math.min(200, Math.round(Number(dc.grams) || 10)));
    const batchId = dc.batchId || createBatchId();
    if (ctx.isHeldByRemote?.(batchId)) return false;
    const { x, y, z } = item.mesh.position;
    const driedBatch = ctx.findPickable?.(batchId) || makeDriedMushroomBatch(ctx, batchId, spName, x, y + 0.30, z, batchGrams);
    driedBatch.isMoved = true;
    driedBatch.movedAt = performance.now();
    queueDehydratorState(ctx, driedBatch);
    dc.hasMushroom = false;
    dc.progress = 0;
    dc.crisp = false;
    dc.on = false;
    dc.speciesName = '';
    dc.batchId = '';
    dc.grams = 10;
    updateDehydratorVisual(item);
    queueDehydratorState(ctx, item);
    ctx.heldItem = driedBatch;
    ctx.lastPickupAt = performance.now();
    ctx.callbacks?.onHoldChange?.(driedBatch.label);
    if (ctx && ctx.callbacks && ctx.callbacks.onDehydrateReward) ctx.callbacks.onDehydrateReward();
    if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('items.dehydrator.m2', { batchGrams, spName }));
    }
    ctx.notifyWorldAction?.();
    return true;
  }
  dc.on = !dc.on;
  updateDehydratorVisual(item);
  queueDehydratorState(ctx, item);
  ctx.notifyWorldAction?.();
  return true;
}

export function getDehydratorActionLabel(item) {
  const dc = item.dehydratorCtrl;
  if (dc.crisp) return `Retirar ${dc.grams} g`;
  if (!dc.hasMushroom) return dc.on ? 'Desligar' : 'Pré-aquecer';
  return dc.on ? 'Pausar secagem' : 'Retomar secagem';
}

export function makeDehydrator(ctx, id, px, py, pz) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.178, 0), new THREE.Vector2(0.19, 0.012),
      new THREE.Vector2(0.19, 0.058), new THREE.Vector2(0.177, 0.07), new THREE.Vector2(0, 0.07)
    ], 16),
    new THREE.MeshStandardMaterial({ color: 0xbb6d50, roughness: 0.78, flatShading: true })
  );
  const chamber = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.165, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0x9cb6bf, transparent: true, opacity: 0.23, roughness: 0.3, depthWrite: false })
  );
  chamber.position.y = 0.16;
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.142, 0.175, 0.026, 16),
    new THREE.MeshStandardMaterial({ color: 0x8b9ea7, roughness: 0.67, flatShading: true })
  );
  lid.position.y = 0.263;
  const sage = new THREE.MeshStandardMaterial({ color: 0x71826a, roughness: 0.8, flatShading: true });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.048, 0.015, 10), sage);
  handle.position.y = 0.283;
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.010, 10), sage);
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, 0.037, 0.19);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), ledMat);
  led.position.set(0, 0.037, 0.198);
  led.scale.setScalar(0.64);

  const heatGlowMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.0,
    transparent: true,
    opacity: 0.25,
    roughness: 0.4
  });
  const heatRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 20), heatGlowMat);
  heatRing.rotation.x = Math.PI / 2;
  heatRing.position.y = 0.075;

  // 2 bandejas perfuradas internas + ventoinha giratória no topo
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xc3cbd0, roughness: 0.72, flatShading: true });
  const rack1 = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.006, 16), trayMat);
  rack1.position.y = 0.105;
  const rack2 = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.006, 16), trayMat);
  rack2.position.y = 0.175;
  const rackRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.162, 0.005, 4, 16),
    new THREE.MeshStandardMaterial({ color: 0x8399a3, roughness: 0.68 })
  );
  rackRim.rotation.x = Math.PI / 2;
  rackRim.position.y = rack1.position.y;
  const upperRim = rackRim.clone();
  upperRim.position.y = rack2.position.y;
  const fanGroup = new THREE.Group();
  fanGroup.position.y = 0.242;
  const fanMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 });
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.025), fanMat);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.006, 0.16), fanMat);
  fanGroup.add(blade1, blade2);

  // 3 cogumelos nas bandejas (10g crocante ao concluir!)
  const mushGroup = new THREE.Group();
  mushGroup.position.set(0, 0.108, 0);
  mushGroup.visible = false;
  const mushMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.65 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.75 });
  [
    [-0.06, 0, -0.02, 0.08],
    [0.055, 0, -0.03, -0.10],
    [0.005, 0.070, 0.04, 0.05]
  ].forEach((mp) => {
    const sub = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.013, 0.042, 8), stemMat);
    st.position.y = 0.021;
    const cp = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56), mushMat);
    cp.position.y = 0.038;
    sub.add(st, cp);
    sub.position.set(mp[0], mp[1], mp[2]);
    sub.rotation.z = mp[3];
    mushGroup.add(sub);
  });

  const cover = new THREE.Group();
  cover.position.y = lid.position.y;
  for (const part of [lid, handle, fanGroup]) {
    part.position.y -= cover.position.y;
    cover.add(part);
  }
  g.add(base, heatRing, rack1, rack2, rackRim, upperRim, chamber, cover, bezel, led, mushGroup);

  const item = registerPickable(ctx, id, 'Desidratadora de Cogumelos • Desligada', g, px, py, pz, 0, 0.20, 0.28, DEHYDRATOR_META);
  item.dehydratorCtrl = {
    on: false,
    hasMushroom: false,
    progress: 0,
    crisp: false,
    batchId: '',
    speciesName: '',
    grams: 10,
    mushGroup,
    mushMat,
    ledMat,
    heatGlowMat,
    cover,
    fanGroup
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
    if (!dc || item._removedForSync || item._adminRemoved || !dc.on) continue;
    if (dc.fanGroup) dc.fanGroup.rotation.y += dt * 11.5;
    if (!dc.hasMushroom || dc.crisp) continue;
    dc.progress = Math.min(100, dc.progress + (dt / DEHYDRATOR_DRY_SECONDS) * 100);
    if (dc.progress >= 100) {
      dc.crisp = true;
      updateDehydratorVisual(item);
      if (typeof window !== 'undefined' && window.MycoAudio && window.MycoAudio.playTimerDone) {
        window.MycoAudio.playTimerDone();
      }
      if (item.isReadOnly) continue;
      queueDehydratorState(ctx, item);
      ctx.notifyWorldAction?.();
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t('items.dehydrator.m3', { grams: dc.grams }));
      }
      if (ctx.callbacks && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('dry_pack');
    } else {
      const visStep = Math.floor(dc.progress / 10);
      if (dc._lastVisStep !== visStep) {
        dc._lastVisStep = visStep;
        updateDehydratorVisual(item);
      }
    }
  }
}
