import { getItemKindId } from '../items/item-registry.js';
import { t } from '../core/i18n.js';
import { cancelHeldItemPlacement } from './held-item-placement.js';
import { markItemsFalling } from '../entities/placement-ghost.js';

export function createQuickInventory() {
  return { ready: false, active: 0, slots: [null, null, null], reserved: new Set(), hidden: new Set(), ackHolding: '', pending: null };
}

export function getStorageBlock(item) {
  if (!item || item.growCtrl || item.growModule) return '';
  const data = item.mesh?.userData;
  if (!data || data.twoHanded || item.monotubCtrl || item.bowlCtrl || item.cookerRef || item.potItem || item.caseCtrl) return 'large';
  if (data.petriCtrl?.lidOpen || (item.spawnCtrl?.isPP5 && item.spawnCtrl.lidOpen) ||
      (item.spawnCtrl?.isBag && item.spawnCtrl.filled && !item.spawnCtrl.sealed) ||
      (item.mushroomBagCtrl?.filled && !item.mushroomBagCtrl.sealed)) return 'open';
  const key = getItemKindId(item);
  if (key === 'ak47') return '';
  if (key.startsWith('falcon_rack')) return 'large';
  if (!/^(?:petri|pp5|syringe|scalpel|spawn_jar|spawn_bag|liquid_culture|falcon|alcohol_spray|water_spray|h2o2_spray|paper_towel|gloves|infrared_thermometer|lab_spoon|parafilm|micropore|foil_roll|wild_picked_|harvest_tub_|harvest_gh_|dried_batch_|mushroom_pack_bag_|dyn_vial3ml_|vial_?3ml)/.test(key)) return 'large';
  return '';
}

function isUsingItem(ctx) {
  return !!(ctx.placementMode || ctx.syringePumping || ctx.pourHold || ctx.sinkFilling || ctx.stirHold || ctx.bladeAttachHold || ctx.isPrimaryDown);
}

export function selectQuickSlot(ctx, slot) {
  const inv = ctx.inventory;
  if (!inv?.ready || !ctx.inFps || ctx.adminEditMode || !Number.isInteger(slot) || slot < 0 || slot > 2) return false;
  if (inv.pending) {
    if (inv.pending.createdAt && (performance.now() - inv.pending.createdAt > 2500)) {
      inv.pending = null;
    } else {
      return false;
    }
  }
  if (slot === inv.active) return false;
  const block = isUsingItem(ctx) ? 'using' : getStorageBlock(ctx.heldItem);
  if (block) {
    ctx.callbacks?.onToast?.(t('inventory.' + block));
    return false;
  }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  inv.pending = { id, slot, held: ctx.heldItem?.id || '', createdAt: performance.now() };
  ctx.notifyWorldAction?.();
  return true;
}

export function getQuickInventoryOperation(ctx, getItemState) {
  const inv = ctx.inventory;
  if (!inv?.pending || (inv.ackHolding !== inv.pending.held && !inv.pending.sent)) return null;
  if (!inv.pending.sent) {
    if ((ctx.heldItem?.id || '') !== inv.pending.held) {
      inv.pending = null;
      return null;
    }
    inv.pending.state = ctx.heldItem ? getItemState(ctx.heldItem) : null;
    inv.pending.sent = true;
  }
  const { id, slot, held, state } = inv.pending;
  return { id, slot, held, state };
}

function changeHand(ctx, item) {
  if (ctx.heldItem === item) return;
  cancelHeldItemPlacement(ctx);
  ctx.heldItem = item;
  ctx.thermoLaserOn = false;
  if (ctx.thermoLaserLine) ctx.thermoLaserLine.visible = false;
  if (ctx.thermoLaserDot) ctx.thermoLaserDot.visible = false;
  if (item) {
    item.mesh.visible = true;
    if (ctx.playerPos) item.mesh.position.copy(ctx.playerPos);
    ctx.removeFromCookerContents?.(item);
    ctx.lastPickupAt = performance.now();
    ctx.heldRotY = item.mesh.rotation.y;
  }
  ctx.callbacks?.onHoldChange?.(item?.label || null);
}

export function applyQuickInventory(ctx, snapshot, players, sentHolding, initial = false) {
  if (!snapshot || !Array.isArray(snapshot.slots) || snapshot.slots.length !== 3) return;
  const inv = ctx.inventory;
  inv.ready = snapshot.ready;
  inv.active = snapshot.active;
  inv.slots = snapshot.slots;
  inv.ackHolding = snapshot.holding || '';

  const confirmed = inv.pending && snapshot.op === inv.pending.id;
  if (confirmed) {
    inv.pending = null;
    if (snapshot.result === 'ok') changeHand(ctx, ctx.findPickable(inv.ackHolding) || null);
    else ctx.callbacks?.onToast?.(t('inventory.' + (['busy', 'open', 'large', 'full', 'session'].includes(snapshot.result) ? snapshot.result : 'busy')));
  } else if (!inv.ready && inv.pending) {
    inv.pending = null;
    ctx.callbacks?.onToast?.(t('inventory.session'));
  } else if (!initial && inv.pending && sentHolding === inv.pending.held && sentHolding !== inv.ackHolding) {
    inv.pending = null;
    if (!snapshot.conflict) ctx.callbacks?.onToast?.(t('inventory.large'));
  }
  if (inv.pending?.createdAt && (performance.now() - inv.pending.createdAt > 3000)) {
    inv.pending = null;
  }
  if (snapshot.conflict && sentHolding && ctx.heldItem?.id === sentHolding) {
    changeHand(ctx, null);
    ctx.callbacks?.onToast?.(t('inventory.busy'));
  }
  if (initial && inv.ready && inv.ackHolding && !ctx.heldItem) changeHand(ctx, ctx.findPickable(inv.ackHolding) || null);

  const previousHidden = inv.hidden;
  inv.reserved = new Set(snapshot.reserved || []);
  const hands = new Set(players.map(player => player.holding).filter(Boolean));
  if (ctx.heldItem) hands.add(ctx.heldItem.id);
  inv.hidden = new Set();
  for (const id of inv.reserved) {
    if (!hands.has(id)) inv.hidden.add(id);
  }
  let visibilityChanged = false;
  for (const id of previousHidden) {
    if (inv.hidden.has(id)) continue;
    visibilityChanged = true;
    const item = ctx.findPickable(id);
    if (item) {
      item._inventoryHidden = false;
      item.mesh.visible = true;
    }
  }
  for (const id of inv.hidden) {
    visibilityChanged ||= !previousHidden.has(id);
    const item = ctx.findPickable(id);
    if (item) {
      item._inventoryHidden = true;
      item.mesh.visible = false;
    }
  }
  if (visibilityChanged) markItemsFalling();
}

export function resetQuickInventory(ctx) {
  const inv = ctx.inventory;
  if (!inv) return;
  // Keep the last public reservations hidden until the next account's first sync.
  const fresh = createQuickInventory();
  fresh.reserved = inv.reserved;
  fresh.hidden = inv.hidden;
  ctx.inventory = fresh;
}
