import { markItemsFalling } from '../entities/placement-ghost.js';
import { rebuildCrateCargo } from './crate-cargo.js';
import { flushLocalMovedObjects, saveLocalMovedObject } from './local-world-objects.js';

const POSE_EPSILON = 0.002;
const RECENT_MOVEMENT_MS = 25000;
const RETRY_AFTER_MS = 1500;

function positionDiffers(position, x, y, z) {
  return Math.abs(position.x - x) > POSE_EPSILON ||
    Math.abs(position.y - y) > POSE_EPSILON ||
    Math.abs(position.z - z) > POSE_EPSILON;
}

function protectRecentPlacement(sim, item, saved, now) {
  const expiresAt = sim.recentlyDropped[item.id];
  if (!(expiresAt > now)) return false;

  const { x, y, z } = item.mesh.position;
  const ry = item.mesh.rotation.y || 0;
  if (saved && Math.abs(saved.x - x) < POSE_EPSILON && Math.abs(saved.y - y) < POSE_EPSILON &&
      Math.abs(saved.z - z) < POSE_EPSILON && Math.abs((saved.ry || 0) - ry) < POSE_EPSILON) {
    delete sim.recentlyDropped[item.id];
  } else if (expiresAt - now < RECENT_MOVEMENT_MS - RETRY_AFTER_MS) {
    sim.pendingMovedItems[item.id] = { id: item.id, x, y, z, ry };
  }
  return true;
}

function canApplyPose(sim, item, saved, now) {
  if (saved?.lot_locked) {
    delete sim.pendingMovedItems[item.id];
    delete sim.recentlyDropped[item.id];
    return true;
  }
  const held = sim.heldItem;
  if (held === item || held?.lidItem === item || held?.cookerRef?.contents?.includes(item) ||
      held?.trayContents?.some(content => content?.item === item) ||
      sim.isHeldByRemote(item.id) || sim.pendingMovedItems[item.id]) return false;
  return !protectRecentPlacement(sim, item, saved, now);
}

function applySavedPose(item, saved) {
  const { mesh } = item;
  const ry = saved.ry || 0;
  if (item.isMoved && !positionDiffers(mesh.position, saved.x, saved.y, saved.z) &&
      Math.abs((mesh.rotation.y || 0) - ry) <= POSE_EPSILON) return false;
  mesh.position.set(saved.x, saved.y, saved.z);
  mesh.rotation.y = ry;
  item.isMoved = true;
  mesh.userData.updateBounds?.(item);
  saveLocalMovedObject(item, undefined, true);
  return true;
}

function applyCookerLidPose(item, saved, objectsMap) {
  const pot = item.potItem;
  const reference = objectsMap[pot.id] || pot.mesh.position;
  item.isAttached = Math.hypot(saved.x - reference.x, saved.z - reference.z) < 0.28 &&
    Math.abs(saved.y - (reference.y + 0.36)) < 0.28;
  if (!item.isAttached) return applySavedPose(item, saved);

  const { x, y, z } = pot.mesh.position;
  const targetY = y + 0.36;
  if (item.isMoved && !positionDiffers(item.mesh.position, x, targetY, z)) return false;
  item.mesh.position.set(x, targetY, z);
  item.mesh.rotation.copy(pot.mesh.rotation);
  item.isMoved = true;
  saveLocalMovedObject(item, undefined, true);
  return true;
}

function applyItemPose(sim, item, objectsMap, hasBounds, now) {
  const saved = objectsMap[item.id];
  if (!canApplyPose(sim, item, saved, now)) return false;

  const pot = hasBounds ? null : item.potItem;
  if (pot && item.isAttached && (sim.heldItem === pot || sim.isHeldByRemote(pot.id) ||
      sim.pendingMovedItems[pot.id] || sim.recentlyDropped[pot.id] > now)) return false;

  if (saved) return pot ? applyCookerLidPose(item, saved, objectsMap) : applySavedPose(item, saved);
  if (!item.isMoved || (item.movedAt && now - item.movedAt < RECENT_MOVEMENT_MS)) return false;

  if (!hasBounds) sim.removeFromCookerContents(item);
  item.mesh.position.copy(item.homePos);
  item.mesh.rotation.y = item.homeRy;
  if (pot) item.isAttached = true;
  item.mesh.userData.updateBounds?.(item);
  item.isMoved = false;
  return true;
}

export function applyCampusWorldObjects(sim, objectsMap) {
  if (!objectsMap) return;
  sim._lastWorldObjectsMap = objectsMap;
  const now = performance.now();
  let anyPositionChanged = false;

  // Aplica bancadas e outros suportes antes dos itens soltos e tampas.
  for (const item of sim.pickableItems) {
    const saved = objectsMap[item.id];
    item.villageEditLot = saved?.edit_lot || null;
    if (!item.isPersonal) item.isReadOnly = !!item._layoutReadOnly || !!saved?.lot_locked;
    if (item.mesh.userData.updateBounds && !item._removedForSync) {
      if (applyItemPose(sim, item, objectsMap, true, now)) anyPositionChanged = true;
    }
  }
  for (const item of sim.pickableItems) {
    if (!item.mesh.userData.updateBounds && !item._removedForSync) {
      if (applyItemPose(sim, item, objectsMap, false, now)) anyPositionChanged = true;
    }
  }
  rebuildCrateCargo(sim);
  flushLocalMovedObjects();
  if (anyPositionChanged) {
    sim._stackPhysicsDirty = true;
    markItemsFalling();
  }
}
