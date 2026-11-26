/**
 * Bisturi Cirurgico Inox + Saches de Lamina Descartavel Esteril (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { getCachedCanvasTexture, registerPickable } from './item-registry.js';
import { t } from '../core/i18n.js';

const THREE = window.THREE;

let sharedScalpelAssets = null;
function getScalpelSharedAssets() {
  if (sharedScalpelAssets) return sharedScalpelAssets;
  const bladeTex = getCachedCanvasTexture('scalpel_blade_pack_24', 128, 64, (pctx) => {
    pctx.fillStyle = '#db2777'; pctx.fillRect(0, 0, 128, 64);
    pctx.fillStyle = '#1e3a8a'; pctx.fillRect(88, 0, 40, 64);
    pctx.fillStyle = '#ffffff'; pctx.font = 'bold 14px sans-serif';
    pctx.fillText('LÂMINA #24', 8, 28);
    pctx.font = 'bold 11px sans-serif';
    pctx.fillText('ESTÉRIL', 14, 48);
  });
  sharedScalpelAssets = {
    steelMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.90, roughness: 0.18 }),
    bladeMat: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x475569,
      emissiveIntensity: 0.35,
      metalness: 0.72,
      roughness: 0.12
    }),
    hitMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    bladeTex,
    handleGeo: new THREE.BoxGeometry(0.012, 0.004, 0.125),
    neckGeo: new THREE.BoxGeometry(0.007, 0.003, 0.026),
    bladeGeo: new THREE.BoxGeometry(0.011, 0.003, 0.044),
    chunkGeo: new THREE.BoxGeometry(0.0085, 0.0045, 0.011),
    pickHitGeo: new THREE.BoxGeometry(0.055, 0.036, 0.21),
    packGeo: new THREE.BoxGeometry(0.028, 0.004, 0.085),
    packHitGeo: new THREE.BoxGeometry(0.052, 0.028, 0.11)
  };
  Object.keys(sharedScalpelAssets).forEach((k) => {
    const v = sharedScalpelAssets[k];
    if (v && v.userData) v.userData.shared = true;
  });
  return sharedScalpelAssets;
}

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
  if (sc.myceliumChunkMesh) {
    sc.myceliumChunkMesh.visible = !!sc.hasMycelium;
    if (sc.myceliumChunkMesh.material) {
      const dirty = !sc.sterile || !!sc.cutContaminated || !!sc.bladeContaminated || !!sc.bladeExpired;
      sc.myceliumChunkMesh.material.color.setHex(dirty ? 0x16a34a : 0xf8fafc);
      sc.myceliumChunkMesh.material.emissive.setHex(dirty ? 0x14532d : 0xe2e8f0);
    }
  }
  if (!sc.hasBlade) {
    item.label = 'Bisturi Inox (Sem lâmina)';
  } else if (sc.bladeExpired) {
    item.label = 'Bisturi Inox (Lâmina Contaminada ⚠️ Descarte no lixo)';
  } else if (sc.hasMycelium) {
    const spSuffix = sc.biopsySpecies ? ` • ${sc.biopsySpecies}` : '';
    item.label = sc.isSporeSample
      ? `Bisturi Inox (Com monoesporo${spSuffix})`
      : `Bisturi Inox (${sc.origin === 'tissue_clone' ? 'Amostra para clonagem' : 'Com fragmento de micélio'}${spSuffix})`;
  } else if (sc.sterile) {
    item.label = 'Bisturi Inox (Lâmina #24 Estéril ✅)';
  } else {
    item.label = 'Bisturi Inox (Lâmina usada ⚠️ Descarte no lixo)';
  }
}

export function stepScalpels(ctx, now) {
  if (!ctx) return;
  if (ctx.wearingGloves && !ctx.glovesExpired && ctx.glovesUntil && now >= ctx.glovesUntil) {
    ctx.glovesExpired = true;
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('items.scalpel.m1'));
    }
  }
  if (!ctx.pickableItems) return;
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
        ctx.callbacks.onToast(t('items.scalpel.m2'));
      }
    }
  }
}

export function makeScalpel(ctx, id, px, py, pz) {
  const A = getScalpelSharedAssets();
  const sg = new THREE.Group();

  const handle = new THREE.Mesh(A.handleGeo, A.steelMat);
  handle.position.set(0, 0.006, 0.02);
  const neck = new THREE.Mesh(A.neckGeo, A.steelMat);
  neck.position.set(0, 0.006, -0.052);
  const blade = new THREE.Mesh(A.bladeGeo, A.bladeMat);
  blade.position.set(0, 0.006, -0.084);
  const myceliumChunk = new THREE.Mesh(
    A.chunkGeo,
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xe2e8f0, emissiveIntensity: 0.25, roughness: 0.85 })
  );
  myceliumChunk.position.set(0, 0.0085, -0.103);
  myceliumChunk.visible = false;
  const pickHitbox = new THREE.Mesh(A.pickHitGeo, A.hitMat);
  pickHitbox.visible = false;
  pickHitbox.position.set(0, 0.016, -0.02);

  sg.add(handle, neck, blade, myceliumChunk, pickHitbox);
  sg.userData.isScalpel = true;
  const item = registerPickable(ctx, id, 'Bisturi Inox (Lâmina #24 Estéril ✅)', sg, px, py, pz, 0, 0.09, 0.02, SCALPEL_META);
  item.scalpelCtrl = {
    hasBlade: true,
    sterile: true,
    bladeExpired: false,
    bladeAttachedAt: performance.now(),
    hasMycelium: false,
    bladeMesh: blade,
    myceliumChunkMesh: myceliumChunk
  };
  updateScalpelLabel(item);
  return item;
}

export function markBladePackEmpty(item) {
  if (!item || !item.bladePackCtrl) return;
  item.bladePackCtrl.empty = true;
  item.label = 'Embalagem Lâmina #24 (Vazia ⚠️ Jogue no lixo)';
  const pm = item.bladePackCtrl.packMesh;
  if (pm && pm.material) {
    pm.material.color.setHex(0x94a3b8);
    pm.material.transparent = true;
    pm.material.opacity = 0.72;
    pm.material.needsUpdate = true;
  }
}

export function makeScalpelBladePack(ctx, id, px, py, pz) {
  const A = getScalpelSharedAssets();
  const pg = new THREE.Group();
  const pack = new THREE.Mesh(A.packGeo, new THREE.MeshStandardMaterial({ map: A.bladeTex, roughness: 0.35 }));
  pack.position.y = 0.004;
  const packHitbox = new THREE.Mesh(A.packHitGeo, A.hitMat);
  packHitbox.visible = false;
  packHitbox.position.y = 0.014;
  pg.add(pack, packHitbox);
  pg.userData.isScalpelBladePack = true;
  const item = registerPickable(ctx, id, 'Sachê Lâmina Bisturi #24 (Estéril)', pg, px, py, pz, 0, 0.06, 0.02, BLADE_PACK_META);
  item.bladePackCtrl = { empty: false, packMesh: pack };
  return item;
}
