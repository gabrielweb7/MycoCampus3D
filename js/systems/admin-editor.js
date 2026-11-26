/**
 * Modo Admin Editor (MycoCampus3D)
 * Permite adicionar prefabs, remover itens, editar rótulo/escala,
 * mover bancadas com tudo em cima em grupo e salvar o layout padrão no MySQL.
 */

import { getItemPrefab, registerItemPrefab, listItemPrefabs, spawnItemFromPrefab } from '../items/item-prefabs.js';
import { disposeObjectResources, registerPickable, updateItemBounds } from '../items/item-registry.js';
import { markItemsFalling } from '../entities/placement-ghost.js';
import { addMovableStainlessTable } from '../items/stainless-table.js';
import { makeLabTray } from '../items/lab-tray.js';
import { makeAlcoholSprayBottle, makeH2O2SprayBottle, makeWaterSprayBottle } from '../items/alcohol-spray.js';
import { makeLcNutrientBottle } from '../items/pda-bottle.js';
import { getPetriMeta, makePetriDish } from '../items/petri-dish.js';
import { makeBeaker1L, makeLiquidJar800 } from '../items/liquid-culture.js';
import { makePdaMediaBottle1L } from '../items/pda-mix.js';
import { makePP5Cup145ml } from '../items/pp5-cup.js';
import { makeMixingBowl } from '../items/mixing-bowl.js';
import { makeMagneticStirrer } from '../items/magnetic-stirrer.js';
import { makeInfraredThermometer } from '../items/thermometer.js';
import { makeDehydrator } from '../items/dehydrator.js';
import { GROW_PREFABS, makeGrowShopItem } from '../items/portable-grow.js';
import { makeMonotub24L } from '../items/monotub.js';
import { makeSilicaStorageJar } from '../items/lab-advanced-tools.js';
import { makeSpawnJar800, makeSpawnBag1500 } from '../items/spawn-containers.js';
import { makeMushroomBag, makeDeliveryCrate } from '../items/mushroom-packaging.js';
import { rebuildCrateCargo, removeCrateCargo } from './crate-cargo.js';
import { makeSyringe10ml } from '../items/syringe.js';
import { makeFlocao500g } from '../items/flocao-corn.js';
import { makeAmpouleCase, makeVial3ml } from '../items/ampoule-case.js';
import { makeFlowerSeedPacket } from '../world/campus-flowers.js';
import { makeStarterBeehiveItem, makeBeeBaitItem } from '../entities/bee-ecology.js';
import { saveLocalMovedObject } from './world-objects-sync.js';
import { moveItemWithSupported, dropSupportedItemsToGround } from './surface-group-move.js';
import { getItemGroundHeight } from '../engine/physics.js';
import { apiPost } from '../services/api-client.js';
import { events } from '../core/events.js';

let corePrefabsRegistered = false;

export function ensureCoreAdminPrefabs() {
  if (corePrefabsRegistered) return;
  corePrefabsRegistered = true;
  for (const [kind, label] of Object.entries(GROW_PREFABS)) {
    registerItemPrefab(kind, { label, category: 'equipment', factory: (ctx, opts) => makeGrowShopItem(ctx, opts, kind) });
  }

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

  registerItemPrefab('beaker_1l', {
    label: 'Béquer Vidro 1L',
    category: 'glassware',
    factory: (ctx, opts) => makeBeaker1L(ctx, opts.id || ('dyn_beaker_1l_' + Date.now().toString(36)), opts.x, opts.y, opts.z, 0)
  });

  registerItemPrefab('liquid_culture', {
    label: 'Frasco Cultura Líquida 800ml',
    category: 'glassware',
    factory: (ctx, opts) => makeLiquidJar800(ctx, opts.id || ('dyn_liquid_culture_' + Date.now().toString(36)), opts.x, opts.y, opts.z, 0)
  });

  registerItemPrefab('pda_media_bottle', {
    label: 'Frasco de Vidro 1 L com Tampa',
    category: 'glassware',
    factory: (ctx, opts) => makePdaMediaBottle1L(ctx, opts.id || ('dyn_pda_media_bottle_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('pp5_cup', {
    label: 'Copo PP5 145ml',
    category: 'glassware',
    factory: (ctx, opts) => makePP5Cup145ml(ctx, opts.id || ('dyn_pp5_cup_' + Date.now().toString(36)), false, opts.x, opts.y, opts.z)
  });

  registerItemPrefab('mixing_bowl', {
    label: 'Pote de Mistura',
    category: 'tools',
    factory: (ctx, opts) => makeMixingBowl(ctx, opts.id || ('dyn_mixing_bowl_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('magnetic_stirrer', {
    label: 'Agitador Magnético',
    category: 'equipment',
    factory: (ctx, opts) => makeMagneticStirrer(ctx, opts.id || ('dyn_magnetic_stirrer_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('infrared_thermometer', {
    label: 'Termômetro Laser',
    category: 'equipment',
    factory: (ctx, opts) => makeInfraredThermometer(ctx, opts.id || ('dyn_thermometer_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('dehydrator', {
    label: 'Desidratadora de Cogumelos',
    category: 'equipment',
    factory: (ctx, opts) => makeDehydrator(ctx, opts.id || ('dyn_dehydrator_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('monotub_24l', {
    label: 'Caixa Monotub 24L',
    category: 'equipment',
    factory: (ctx, opts) => makeMonotub24L(ctx, opts.id || ('dyn_monotub_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('silica_jar', {
    label: 'Pote com Sílica Gel',
    category: 'equipment',
    factory: (ctx, opts) => makeSilicaStorageJar(ctx, opts.id || ('dyn_silica_' + Date.now().toString(36)), opts.x, opts.y, opts.z, 0)
  });

  registerItemPrefab('spawn_jar', {
    label: 'Vidro 800ml Vazio',
    category: 'glassware',
    factory: (ctx, opts) => makeSpawnJar800(ctx, opts.id || ('dyn_spawn_jar_' + Date.now().toString(36)), false, opts.x, opts.y, opts.z)
  });

  registerItemPrefab('spawn_bag', {
    label: 'Bag 1,5kg Vazia',
    category: 'glassware',
    factory: (ctx, opts) => makeSpawnBag1500(ctx, opts.id || ('dyn_spawn_bag_' + Date.now().toString(36)), false, opts.x, opts.y, opts.z)
  });

  registerItemPrefab('mylar_bag', {
    label: 'Saco Mylar (Embalagem)',
    category: 'tools',
    factory: (ctx, opts) => makeMushroomBag(ctx, opts.id || ('dyn_mylar_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('delivery_crate', {
    label: 'Caixa de Entrega',
    category: 'equipment',
    factory: (ctx, opts) => makeDeliveryCrate(ctx, opts.id || ('dyn_crate_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('syringe_10ml', {
    label: 'Seringa Estéril 10ml',
    category: 'tools',
    factory: (ctx, opts) => makeSyringe10ml(ctx, opts.id || ('dyn_syringe_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('flocao_500g', {
    label: 'Flocão de Milho 500g',
    category: 'tools',
    factory: (ctx, opts) => makeFlocao500g(ctx, opts.id || ('dyn_flocao_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('ampoule_case', {
    label: 'Maleta Porta-Ampolas 5ML (50 Vagas)',
    category: 'equipment',
    factory: (ctx, opts) => makeAmpouleCase(ctx, opts.id || ('dyn_ampoule_case_' + Date.now().toString(36)), opts.x, opts.y, opts.z, opts)
  });

  registerItemPrefab('vial_3ml', {
    label: 'Ampola 5ML',
    category: 'glassware',
    factory: (ctx, opts) => makeVial3ml(ctx, opts.id || ('dyn_vial3ml_' + Date.now().toString(36)), opts.x, opts.y, opts.z, opts)
  });

  registerItemPrefab('h2o2_spray', {
    label: 'Borrifador Água Oxigenada 3% (H₂O₂)',
    category: 'sanitization',
    factory: (ctx, opts) => makeH2O2SprayBottle(ctx, opts.id || ('dyn_h2o2_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('water_spray', {
    label: 'Borrifador Água Destilada (Névoa)',
    category: 'hydration',
    factory: (ctx, opts) => makeWaterSprayBottle(ctx, opts.id || ('dyn_water_spray_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('lc_nutrient_bottle', {
    label: 'Extrato de Malte / Mel 250g',
    category: 'reagent',
    factory: (ctx, opts) => makeLcNutrientBottle(ctx, opts.id || ('dyn_lc_nutrient_' + Date.now().toString(36)), opts.x, opts.y, opts.z)
  });

  registerItemPrefab('flower_seeds', {
    label: 'Sementes de Flor (5 un.)',
    category: 'gardening',
    factory: (ctx, opts) => makeFlowerSeedPacket(ctx, opts.id || ('dyn_flower_seeds_' + Date.now().toString(36)), opts.x, opts.y, opts.z, { count: 5 })
  });

  registerItemPrefab('bee_bait', {
    label: 'Isca de Abelhas',
    category: 'gardening',
    factory: (ctx, opts) => makeBeeBaitItem(ctx, opts.id || ('dyn_bee_bait_' + Date.now().toString(36)), opts.x, opts.y, opts.z, opts)
  });

  registerItemPrefab('beehive_starter', {
    label: 'Colmeia Inicial (Com Rainha)',
    category: 'gardening',
    factory: (ctx, opts) => makeStarterBeehiveItem(ctx, opts.id || ('dyn_beehive_' + Date.now().toString(36)), opts.x, opts.y, opts.z, opts)
  });
}

export function getShopDeliveryPose(sim, prefabId, { requireReady = true } = {}) {
  if (!sim || (requireReady && (!sim.scene || !sim.renderer || !sim.controls))) return null;
  ensureCoreAdminPrefabs();
  if (!getItemPrefab(prefabId)) return null;
  const px = sim.playerPos ? sim.playerPos.x : 0;
  const pz = sim.playerPos ? sim.playerPos.z : 10;
  const yaw = sim.playerYaw || 0;
  const tx = px - Math.sin(yaw) * 1.15;
  const tz = pz - Math.cos(yaw) * 1.15;
  const baseY = sim.playerPos ? sim.playerPos.y : 0;
  const ty = getItemGroundHeight(sim.physCtx, tx, tz, baseY + 1.2);
  return { x: tx, y: ty, z: tz, ry: yaw };
}

export function spawnShopItemNearPlayer(sim, prefabId) {
  const pose = getShopDeliveryPose(sim, prefabId, { requireReady: false });
  if (!pose) return null;
  const { x: tx, y: ty, z: tz, ry: yaw } = pose;
  const item = spawnItemFromPrefab(sim, prefabId, { x: tx, y: ty, z: tz, ry: yaw });
  if (!item) return null;
  if (item.mesh && item.mesh.userData && item.mesh.userData.updateBounds) {
    item.mesh.userData.updateBounds(item);
  }
  item.isMoved = true;
  item.movedAt = performance.now();
  sim.pendingMovedItems = sim.pendingMovedItems || {};
  sim.pendingMovedItems[item.id] = {
    id: item.id,
    x: tx,
    y: ty,
    z: tz,
    ry: yaw,
    prefabId: prefabId,
    label: item.label || prefabId
  };
  saveLocalMovedObject(item);
  sim._stackPhysicsDirty = true;
  markItemsFalling(sim);
  if (sim.notifyWorldAction) sim.notifyWorldAction();
  return item;
}

function removeFromArray(arr, val) {
  if (!Array.isArray(arr) || !val) return;
  const idx = arr.indexOf(val);
  if (idx !== -1) arr.splice(idx, 1);
}

function removeItemLocally(sim, item) {
  if (!item || item._adminRemoved) return;
  removeCrateCargo(sim, item);
  for (const cargo of item.deliveryCrateCtrl ? [...(item.trayContents || [])] : []) {
    removeCrateCargo(sim, cargo.item);
  }
  item._adminRemoved = true;
  if (sim.heldItem === item) sim.heldItem = null;
  if (item.mesh) {
    item.mesh.visible = false;
    if (sim.scene && item.mesh.parent) item.mesh.parent.remove(item.mesh);
    disposeObjectResources(item.mesh);
    if (item.mesh.userData) {
      removeFromArray(sim.supportSurfaces, item.mesh.userData.dynamicSurface);
      if (Array.isArray(item.mesh.userData.dynamicSurfaces)) {
        item.mesh.userData.dynamicSurfaces.forEach((s) => removeFromArray(sim.supportSurfaces, s));
      }
      removeFromArray(sim.solidColliders, item.mesh.userData.dynamicCollider);
    }
  }
  removeFromArray(sim.pickableItems, item);
  if (sim.pickableMap && typeof sim.pickableMap.delete === 'function') {
    sim.pickableMap.delete(item.id);
  }
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

    if (edit.stored || edit.removed) {
      if (item) removeItemLocally(sim, item);
      if (edit.stored) {
        sim.removedItemIds?.delete(itemId);
        if (sim.pendingMovedItems) delete sim.pendingMovedItems[itemId];
      }
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
      item.isPersonal = !!edit.personal;
      item._layoutReadOnly = !!edit.read_only;
      item.isReadOnly = item._layoutReadOnly || !!sim._lastWorldObjectsMap?.[itemId]?.lot_locked;
      const hasDynamicLabel = !!(
        item.spawnCtrl ||
        item.deliveryCrateCtrl ||
        item.dehydratorCtrl ||
        item.monotubCtrl ||
        item.bowlCtrl ||
        (item.mesh && item.mesh.userData && (
          item.mesh.userData.petriCtrl ||
          item.mesh.userData.liquidCtrl ||
          item.mesh.userData.syrCtrl
        ))
      );
      if (edit.label && !hasDynamicLabel) {
        item.label = edit.label;
        if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = edit.label;
      }
      if (typeof edit.scale === 'number' && Number.isFinite(edit.scale) && edit.scale > 0.2 && item.mesh) {
        item.mesh.scale.setScalar(edit.scale);
        updateItemBounds(item);
      }
    }
  });
  rebuildCrateCargo(sim);
  sim._stackPhysicsDirty = true;
  markItemsFalling(sim);
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
  sim._stackPhysicsDirty = true;
  markItemsFalling(sim);
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
  if (!item || item.isPersonal) return false;
  dropSupportedItemsToGround(sim, item, (x, z, refY, ignoreSurf) =>
    getItemGroundHeight(sim.physCtx || sim, x, z, refY, ignoreSurf)
  );
  removeItemLocally(sim, item);
  sim._stackPhysicsDirty = true;
  markItemsFalling(sim);
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
  sim._stackPhysicsDirty = true;
  markItemsFalling(sim);
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
