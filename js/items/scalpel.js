/**
 * Bisturi Cirurgico Inox + Saches de Lamina Descartavel Esteril (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const SCALPEL_META = {
  category: 'inoculation',
  purpose: 'Cortar e transferir micélio em ágar ou grãos com lâmina estéril descartável',
  weightGrams: 28,
  baseTempC: 23.0,
  compatibilities: { canEnterCooker: false, transfersMycelium: true },
  connections: ['scalpel_blade_pack', 'petri_dish', 'pp5_cup', 'laminar_hood']
};

export const BLADE_PACK_META = {
  category: 'consumable',
  purpose: 'Lâmina cirúrgica nº 24 descartável e estéril para troca no bisturi',
  weightGrams: 4,
  baseTempC: 23.0,
  compatibilities: { canEnterCooker: false, isScalpelBladePack: true },
  connections: ['scalpel']
};

export const SCALPEL_BLADE_EXPIRE_MS = 160000;

export function updateScalpelLabel(item) {
  if (!item || !item.scalpelCtrl) return;
  const sc = item.scalpelCtrl;
  if (!sc.hasBlade) {
    item.label = 'Bisturi Inox (Sem lâmina)';
  } else if (sc.bladeExpired) {
    item.label = 'Bisturi Inox (Lâmina Contaminada ⚠️ Descarte no lixo)';
  } else if (sc.hasMycelium) {
    item.label = 'Bisturi Inox (Com fragmento de Micélio)';
  } else if (sc.sterile) {
    item.label = 'Bisturi Inox (Lâmina #24 Estéril ✅)';
  } else {
    item.label = 'Bisturi Inox (Lâmina usada ⚠️ Descarte no lixo)';
  }
}

export function stepScalpels(ctx, now) {
  if (!ctx || !ctx.pickableItems) return;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const it = ctx.pickableItems[i];
    const sc = it && it.scalpelCtrl;
    if (!sc || !sc.hasBlade || !sc.sterile || !sc.bladeAttachedAt) continue;
    if (now - sc.bladeAttachedAt >= SCALPEL_BLADE_EXPIRE_MS) {
      sc.sterile = false;
      sc.bladeExpired = true;
      updateScalpelLabel(it);
      if (ctx.heldItem === it && ctx.callbacks && ctx.callbacks.onHoldChange) {
        ctx.callbacks.onHoldChange(it.label);
      }
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast('⚠️ Lâmina do bisturi contaminou após 160s! Descarte no lixo e encaixe uma nova.');
      }
    }
  }
}

export function makeScalpel(ctx, id, px, py, pz) {
  const sg = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.90, roughness: 0.18 });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x475569,
    emissiveIntensity: 0.35,
    metalness: 0.72,
    roughness: 0.12
  });

  const handle = makeBox(0.012, 0.004, 0.125, steelMat);
  handle.position.set(0, 0.006, 0.02);
  const neck = makeBox(0.007, 0.003, 0.026, steelMat);
  neck.position.set(0, 0.006, -0.052);
  const blade = makeBox(0.011, 0.003, 0.044, bladeMat);
  blade.position.set(0, 0.006, -0.084);
  const pickHitbox = makeBox(
    0.055,
    0.036,
    0.21,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  pickHitbox.position.set(0, 0.016, -0.02);

  sg.add(handle, neck, blade, pickHitbox);
  sg.userData.isScalpel = true;
  const item = registerPickable(ctx, id, 'Bisturi Inox (Lâmina #24 Estéril ✅)', sg, px, py, pz, 0, 0.09, 0.02, SCALPEL_META);
  item.scalpelCtrl = {
    hasBlade: true,
    sterile: true,
    bladeExpired: false,
    bladeAttachedAt: performance.now(),
    hasMycelium: false,
    bladeMesh: blade
  };
  updateScalpelLabel(item);
  return item;
}

export function makeScalpelBladePack(ctx, id, px, py, pz) {
  const pg = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const pctx = c.getContext('2d');
  pctx.fillStyle = '#db2777'; pctx.fillRect(0, 0, 128, 64);
  pctx.fillStyle = '#1e3a8a'; pctx.fillRect(88, 0, 40, 64);
  pctx.fillStyle = '#ffffff'; pctx.font = 'bold 14px sans-serif';
  pctx.fillText('LÂMINA #24', 8, 28);
  pctx.font = 'bold 11px sans-serif';
  pctx.fillText('ESTÉRIL', 14, 48);

  const pack = makeBox(0.028, 0.004, 0.085, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.35 }));
  pack.position.y = 0.004;
  const packHitbox = makeBox(
    0.052,
    0.028,
    0.11,
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  packHitbox.position.y = 0.014;
  pg.add(pack, packHitbox);
  pg.userData.isScalpelBladePack = true;
  return registerPickable(ctx, id, 'Sachê Lâmina Bisturi #24 (Estéril)', pg, px, py, pz, 0, 0.06, 0.02, BLADE_PACK_META);
}
