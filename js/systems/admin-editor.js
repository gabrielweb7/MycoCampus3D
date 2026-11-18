/**
 * Modo Admin Editor (MycoCampus3D)
 * Permite adicionar prefabs, remover itens, editar rótulo/escala,
 * mover bancadas com tudo em cima em grupo e salvar o layout padrão no MySQL.
 */

import { registerItemPrefab, listItemPrefabs, spawnItemFromPrefab } from '../items/item-prefabs.js';
import { registerPickable, updateItemBounds } from '../items/item-registry.js';
import { addMovableStainlessTable } from '../items/stainless-table.js';
import { makeLabTray } from '../items/lab-tray.js';
import { makeAlcoholSprayBottle } from '../items/alcohol-spray.js';
import { getPetriMeta, makePetriDish } from '../items/petri-dish.js';
import { moveItemWithSupported, dropSupportedItemsToGround } from './surface-group-move.js';
import { getItemGroundHeight } from '../engine/physics.js';
import { apiPost } from '../services/api-client.js';
import { events } from '../core/events.js';

let corePrefabsRegistered = false;

export function ensureCoreAdminPrefabs() {
  if (corePrefabsRegistered) return;
  corePrefabsRegistered = true;

  registerItemPrefab('table_stainless', {
    label: 'Bancada Inox (1.6m)',
    category: 'furniture',
    factory: (ctx, opts) => {
      const id = opts.id || ('dyn_table_stainless_' + Date.now().toString(36));
      return addMovableStainlessTable(ctx, id, opts.label || 'Bancada Inox', opts.x, opts.y, opts.z, 1.6, 0.90, 0.90);
    }
  });

  registerItemPrefab('lab_tray', {
    label: 'Bandeja Inox',
    category: 'tools',
    factory: (ctx, opts) => {
      const id = opts.id || ('dyn_lab_tray_' + Date.now().toString(36));
      return makeLabTray(ctx, id, opts.label || 'Bandeja Inox', opts.x, opts.y, opts.z);
    }
  });

  registerItemPrefab('alcohol_spray', {
    label: 'Borrifador Álcool 70%',
    category: 'tools',
    factory: (ctx, opts) => {
      const id = opts.id || ('dyn_alcohol_spray_' + Date.now().toString(36));
      return makeAlcoholSprayBottle(ctx, id, opts.x, opts.y, opts.z);
    }
  });

  registerItemPrefab('petri_empty', {
    label: 'Placa de Petri Estéril (PDA)',
    category: 'glassware',
    factory: (ctx, opts) => {
      const id = opts.id || ('dyn_petri_empty_' + Date.now().toString(36));
      return registerPickable(
        ctx,
        id,
        opts.label || 'Placa de Petri Estéril (PDA)',
        makePetriDish('empty'),
        opts.x, opts.y, opts.z, opts.ry || 0, 0.14, 0.08,
        getPetriMeta('empty')
      );
    }
  });
}

function removeFromArray(arr, val) {
  if (!Array.isArray(arr) || !val) return;
  const idx = arr.indexOf(val);
  if (idx !== -1) arr.splice(idx, 1);
}

function removeItemLocally(sim, item) {
  if (!item || item._adminRemoved) return;
  item._adminRemoved = true;
  if (sim.heldItem === item) sim.heldItem = null;
  if (item.mesh) {
    item.mesh.visible = false;
    if (sim.scene && item.mesh.parent) item.mesh.parent.remove(item.mesh);
    if (item.mesh.userData) {
      removeFromArray(sim.supportSurfaces, item.mesh.userData.dynamicSurface);
      if (Array.isArray(item.mesh.userData.dynamicSurfaces)) {
        item.mesh.userData.dynamicSurfaces.forEach((s) => removeFromArray(sim.supportSurfaces, s));
      }
      removeFromArray(sim.solidColliders, item.mesh.userData.dynamicCollider);
    }
  }
  removeFromArray(sim.pickableItems, item);
  sim.removedItemIds = sim.removedItemIds || new Set();
  sim.removedItemIds.add(item.id);
}

/**
 * Aplica adições, remoções, rótulos e escalas sincronizados do servidor.
 */
export function applyCampusLayoutEdits(sim, layoutEdits) {
  if (!sim || !layoutEdits || typeof layoutEdits !== 'object') return;
  ensureCoreAdminPrefabs();

  const itemsById = new Map(sim.pickableItems.map((it) => [it.id, it]));
  Object.keys(layoutEdits).forEach((itemId) => {
    const edit = layoutEdits[itemId];
    if (!edit || typeof edit !== 'object') return;
    let item = itemsById.get(itemId);

    if (edit.removed) {
      if (item) removeItemLocally(sim, item);
      return;
    }

    if (!item && edit.prefab_id && !(sim.removedItemIds && sim.removedItemIds.has(itemId))) {
      item = spawnItemFromPrefab(sim, edit.prefab_id, {
        id: itemId,
        label: edit.label || undefined,
        x: 0,
        y: 0,
        z: 0,
        ry: 0
      });
      if (item) {
        itemsById.set(itemId, item);
      }
    }

    if (item) {
      if (edit.label) {
        item.label = edit.label;
        if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = edit.label;
      }
      if (typeof edit.scale === 'number' && Number.isFinite(edit.scale) && edit.scale > 0.2 && item.mesh) {
        item.mesh.scale.setScalar(edit.scale);
        updateItemBounds(item);
      }
    }
  });
}

export async function adminAddPrefabAtPlayer(sim, prefabId) {
  ensureCoreAdminPrefabs();
  const yaw = sim.playerYaw || 0;
  const x = sim.playerPos.x - Math.sin(yaw) * 1.8;
  const z = sim.playerPos.z - Math.cos(yaw) * 1.8;
  const y = sim.playerPos.y || 0;
  const itemId = 'dyn_' + prefabId + '_' + Date.now().toString(36);
  const item = spawnItemFromPrefab(sim, prefabId, { id: itemId, x, y, z, ry: yaw });
  if (!item) return null;

  sim.markItemMoved(item);
  await apiPost('api/multiplayer.php?action=admin_layout_edit', {
    item_id: itemId,
    prefab_id: prefabId,
    label: item.label,
    scale: 1,
    x, y, z, ry: yaw,
    removed: 0
  }, true);
  events.emit('sync:now');
  return item;
}

export async function adminRemoveTargetItem(sim, item) {
  if (!item) return false;
  dropSupportedItemsToGround(sim, item, (x, z, refY, ignoreSurf) =>
    getItemGroundHeight(sim.physCtx || sim, x, z, refY, ignoreSurf)
  );
  removeItemLocally(sim, item);
  await apiPost('api/multiplayer.php?action=admin_layout_edit', {
    item_id: item.id,
    removed: 1
  }, true);
  events.emit('sync:now');
  return true;
}

export function setAdminEditMode(sim, active) {
  if (!sim) return false;
  sim.adminEditMode = !!active;
  if (sim.callbacks && sim.callbacks.onAdminEditModeChange) {
    sim.callbacks.onAdminEditModeChange(sim.adminEditMode);
  }
  return sim.adminEditMode;
}

export async function adminEditTargetItem(sim, item, opts) {
  if (!item) return false;
  const label = (opts && opts.label) ? String(opts.label).trim() : item.label;
  const scale = (opts && typeof opts.scale === 'number' && opts.scale >= 0.25 && opts.scale <= 4)
    ? opts.scale
    : (item.mesh ? item.mesh.scale.x : 1);
  item.label = label;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = label;
  if (item.mesh) {
    item.mesh.scale.setScalar(scale);
    updateItemBounds(item);
  }
  await apiPost('api/multiplayer.php?action=admin_layout_edit', {
    item_id: item.id,
    prefab_id: (item.meta && item.meta.prefabId) || '',
    label,
    scale,
    removed: 0
  }, true);
  events.emit('sync:now');
  return true;
}

export function adminMoveTargetWithSupported(sim, item, dx, dy, dz, dRy) {
  if (!item || !item.mesh) return null;
  const p = item.mesh.position;
  const res = moveItemWithSupported(sim, item, { x: p.x + dx, y: p.y + dy, z: p.z + dz }, (item.mesh.rotation.y || 0) + (dRy || 0));
  events.emit('sync:now');
  return res;
}

export async function adminSaveWorldDefault(sim) {
  const snapshot = sim.pickableItems.map((it) => ({
    id: it.id,
    prefab_id: (it.meta && it.meta.prefabId) || (it.mesh && it.mesh.userData && it.mesh.userData.prefabId) || '',
    label: it.label || '',
    scale: it.mesh ? it.mesh.scale.x : 1,
    x: it.mesh ? it.mesh.position.x : 0,
    y: it.mesh ? it.mesh.position.y : 0,
    z: it.mesh ? it.mesh.position.z : 0,
    ry: it.mesh ? (it.mesh.rotation.y || 0) : 0,
    removed: 0
  }));
  if (sim.removedItemIds) {
    sim.removedItemIds.forEach((remId) => {
      snapshot.push({ id: remId, removed: 1 });
    });
  }
  return apiPost('api/multiplayer.php?action=save_world_default', { items: snapshot }, true);
}

export function getAdminPrefabOptions() {
  ensureCoreAdminPrefabs();
  return listItemPrefabs();
}
