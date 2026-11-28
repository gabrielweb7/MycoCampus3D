import {
  clampPointToSurfaceXZ,
  findPlacementTarget,
  getPlacementBlockedReason,
  isPlacementBlocked,
  markItemsFalling,
  updatePlacementGhostVisual
} from '../entities/placement-ghost.js';
import { hideHover3dBadge } from '../entities/hover-3d-badge.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { COOKER_SLOT_OFFSETS, COOKER_SLOT_Y } from '../items/pressure-cooker.js';
import { isPointInBoundsXZ } from '../items/item-registry.js';
import { updateScalpelLabel } from '../items/scalpel.js';
import { saveLocalMovedObject } from './local-world-objects.js';
import { appState } from '../core/state.js';
import { t } from '../core/i18n.js';
import { canPlaceVillageItem } from '../core/village-layout.js';
import { cratePlacementError, crateSlotPosition, findAimedCrate, freeCrateSlot, loadCrateCargo } from './crate-cargo.js';
import { addSealedBagToDeliveryCrate } from '../items/mushroom-packaging.js';
import { apiPost } from '../services/api-client.js';

const _tmpCommitVec = new window.THREE.Vector3();
const _vPlaceZero2 = new window.THREE.Vector2(0, 0);
const _projectedGhost = new window.THREE.Vector3();

const RING_OFFSETS = [0.12, 0.22, 0.34, 0.48, 0.64];
const RING_ANGLES = 12;

function findSupportSurfaceAtPoint(ctx, pt) {
  if (!ctx || !pt) return null;
  let best = null;
  if (ctx.supportSurfaces) {
    for (let i = 0; i < ctx.supportSurfaces.length; i++) {
      const ss = ctx.supportSurfaces[i];
      if (!ss || ss._disabled || (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.dynamicSurface === ss)) continue;
      if (ss.ownerItem && ss.ownerItem === ctx.heldItem) continue;
      if (Math.abs(pt.y - ss.topY) <= 0.08 && isPointInBoundsXZ(pt.x, pt.z, ss, 0.14)) {
        if (!best || ss.topY > best.topY) best = ss;
      }
    }
  }
  return best;
}

function findFreeSpotOnSurface(ctx, surf, anchorPt, outPt) {
  if (!surf || !outPt) return false;
  clampPointToSurfaceXZ(anchorPt.x, anchorPt.z, surf, surf.topY, outPt);
  if (!isPlacementBlocked(ctx.entityCtx, outPt)) return true;

  for (let ri = 0; ri < RING_OFFSETS.length; ri++) {
    const rad = RING_OFFSETS[ri];
    for (let ai = 0; ai < RING_ANGLES; ai++) {
      const a = (ai / RING_ANGLES) * Math.PI * 2;
      clampPointToSurfaceXZ(anchorPt.x + Math.cos(a) * rad, anchorPt.z + Math.sin(a) * rad, surf, surf.topY, outPt);
      if (!isPlacementBlocked(ctx.entityCtx, outPt)) return true;
    }
  }
  return false;
}

const _aimedSurfacePoint = new window.THREE.Vector3();
const _aimedPlacement = { point: _aimedSurfacePoint, snapped: false };

export function findAimedHeldPlacement(ctx, aimNdc) {
  if (!ctx.heldItem || !aimNdc) return null;
  const aimPt = findPlacementTarget(ctx.entityCtx, aimNdc);
  const distance = Math.hypot(aimPt.x - ctx.playerPos.x, aimPt.z - ctx.playerPos.z);
  if (distance > 4.4 || Math.abs(aimPt.y - ctx.playerPos.y) > 2.6) return null;

  if ((ctx.snapClosePot || ctx.snapPetriStack) && !isPlacementBlocked(ctx.entityCtx, aimPt)) {
    _aimedPlacement.point = aimPt;
    _aimedPlacement.snapped = true;
    return _aimedPlacement;
  }

  const surface = findSupportSurfaceAtPoint(ctx, aimPt);
  if (!surface || surface.topY <= ctx.playerPos.y + 0.04) return null;
  if (surface.falconSlots && ctx.heldItem.mesh.userData.isFalconTube) {
    if (isPlacementBlocked(ctx.entityCtx, aimPt)) return null;
    _aimedPlacement.point = aimPt;
  } else {
    if (!findFreeSpotOnSurface(ctx, surface, aimPt, _aimedSurfacePoint)) return null;
    _aimedPlacement.point = _aimedSurfacePoint;
  }
  _aimedPlacement.snapped = false;
  return _aimedPlacement;
}

function syncHeldAttachedVisibility(item, visible) {
  if (!item || !item.mesh) return;
  item.mesh.visible = visible;
  if (item.lidItem && item.lidItem.isAttached && item.lidItem.mesh) {
    item.lidItem.mesh.visible = visible;
  }
  if (item.cookerRef && Array.isArray(item.cookerRef.contents)) {
    item.cookerRef.contents.forEach(function (cItem) {
      if (cItem && cItem.mesh) cItem.mesh.visible = visible;
    });
  }
  if (item.trayContents && item.trayContents.length) {
    for (let i = 0; i < item.trayContents.length; i++) {
      const tc = item.trayContents[i];
      if (tc && tc.item && tc.item.mesh) tc.item.mesh.visible = visible;
    }
  }
}

export function setHeldTwoHandedGhost(item, active) {
  syncHeldAttachedVisibility(item, true);
}

function setPlacementMode(ctx, active) {
  ctx.placementMode = active;
  if (!active) {
    ctx.placementValid = false;
    ctx.snapCrateStack = 0;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
  }
  if (ctx.callbacks.onPlacementModeChange) {
    ctx.callbacks.onPlacementModeChange(active);
  }
}

export function beginHeldItemPlacement(ctx) {
  if (ctx.inventory?.pending) return false;
  if (!ctx.heldItem) return false;
  if (ctx.placementMode) return true;

  ctx.syringePumping = null;
  ctx.syringePunctureProgress = 0;
  ctx.lastSyringeTargetItem = null;
  ctx.thermoLaserOn = false;
  if (ctx.thermoLaserLine) ctx.thermoLaserLine.visible = false;
  if (ctx.thermoLaserDot) ctx.thermoLaserDot.visible = false;
  ctx.heldRotY = ctx.playerYaw || 0;
  setPlacementMode(ctx, true);
  if (ctx.placementGhost && ctx.camera) {
    const initNdc = ctx.inFps ? _vPlaceZero2 : ctx.pointerNdc;
    if (ctx.raycaster && initNdc) {
      ctx.raycaster.far = 24;
      ctx.raycaster.setFromCamera(initNdc, ctx.camera);
    }
    updateHeldItemPlacementPreview(ctx, initNdc);
  }
  if (ctx.callbacks.onToast) {
    ctx.callbacks.onToast(t(ctx.isTouchDevice?.() ? 'placement.start_touch' : 'placement.start_mouse'));
  }
  return true;
}

export function beginVillageItemMove(ctx, item) {
  if (ctx.heldItem || ctx.villageMovePending || !item.villageEditLot || ctx.isHeldByRemote(item.id) ||
      item.crateParent || item.trayContents?.length || item.lidItem?.isAttached ||
      item.isAttached || item.mesh.userData.isBlockedPickup?.(item)) return false;
  ctx.heldItem = item;
  ctx.villageMove = item.villageEditLot;
  if (beginHeldItemPlacement(ctx)) return true;
  ctx.heldItem = null;
  ctx.villageMove = null;
  return false;
}

export function cancelHeldItemPlacement(ctx) {
  if (!ctx.placementMode) return false;
  syncHeldAttachedVisibility(ctx.heldItem, true);
  if (ctx.villageMove) {
    ctx.villageMove = null;
    ctx.heldItem = null;
    ctx.callbacks.onHoldChange?.(null);
  }
  setPlacementMode(ctx, false);
  return true;
}

export function toggleHeldItemPlacement(ctx) {
  return ctx.placementMode
    ? cancelHeldItemPlacement(ctx)
    : beginHeldItemPlacement(ctx);
}

export function updateHeldItemPlacementPreview(ctx, rayNdc) {
  ctx.cratePlacementTarget = null;
  if (!ctx.heldItem || !ctx.placementMode || !ctx.placementGhost || !ctx.camera) {
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    return false;
  }

  const crate = (ctx.villageMove || ctx.heldItem.deliveryCrateCtrl) ? null : findAimedCrate(ctx, rayNdc);
  if (crate) {
    const slot = freeCrateSlot(crate, ctx.heldItem.mushroomBagCtrl?.sealed ? null : ctx.heldItem);
    const error = cratePlacementError(crate, ctx.heldItem, slot);
    ctx.cratePlacementTarget = crate;
    ctx.placementValid = !error;
    ctx.placementGhost.visible = !error;
    if (!error) {
      crateSlotPosition(crate, slot, ctx.placementGhost.position);
      updatePlacementGhostVisual(ctx.heldItem, true, crate.mesh.rotation.y, ctx.clock.elapsedTime);
    }
    syncHeldAttachedVisibility(ctx.heldItem, !!error);
    if (ctx.hover3dBadge) hideHover3dBadge(ctx.hover3dBadge);
    ctx.callbacks.onHoverPrompt?.(error || t('crate.place'), !error);
    return true;
  }

  const point = findPlacementTarget(ctx.entityCtx, rayNdc);
  _projectedGhost.copy(point);
  _projectedGhost.y += 0.14;
  _projectedGhost.project(ctx.camera);
  const onScreen = Math.abs(_projectedGhost.x) <= 1 && Math.abs(_projectedGhost.y) <= 1 && Math.abs(_projectedGhost.z) <= 1;
  if (!onScreen) {
    ctx.placementValid = false;
    ctx.placementGhost.visible = false;
    syncHeldAttachedVisibility(ctx.heldItem, true);
    ctx.callbacks.onHoverPrompt?.(t('placement.aim_lower'));
    return false;
  }
  ctx.placementValid = !isPlacementBlocked(ctx.entityCtx, point);
  ctx.placementGhost.position.copy(point);
  updatePlacementGhostVisual(ctx.heldItem, ctx.placementValid, ctx.heldRotY, ctx.clock.elapsedTime);
  ctx.placementGhost.visible = true;
  syncHeldAttachedVisibility(ctx.heldItem, false);

  const isTouch = !!(ctx.isTouchDevice && ctx.isTouchDevice());
  const prompt = ctx.snapClosePot
    ? '🍲 Fechar tampa na Panela de Pressão'
    : (ctx.placementValid
      ? (ctx.snapCrateStack ? t('crate.stack_place', { count: ctx.snapCrateStack }) : (isTouch ? '📦 Toque para posicionar: ' : '📦 Clique para posicionar: ') + ctx.heldItem.label)
      : (getPlacementBlockedReason() || '🚫 Local bloqueado (espaço ocupado)'));
  if (ctx.hover3dBadge) hideHover3dBadge(ctx.hover3dBadge);
  if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt, ctx.placementValid);
  return true;
}

export function placeHeldInCrate(ctx, crate) {
  const item = ctx.heldItem;
  if (!item || crate === item || ctx.isHeldByRemote(crate.id)) return false;
  const slot = freeCrateSlot(crate, item.mushroomBagCtrl?.sealed ? null : item);
  const error = cratePlacementError(crate, item, slot);
  if (error) {
    ctx.callbacks.onToast?.(error);
    return true;
  }
  cancelHeldItemPlacement(ctx);
  if (item.mushroomBagCtrl?.sealed) return addSealedBagToDeliveryCrate(ctx, crate, item);
  ctx.heldItem = null;
  loadCrateCargo(ctx, crate, item, slot);
  ctx.callbacks.onHoldChange?.(null);
  ctx.callbacks.onToast?.(t('crate.stored'));
  window.MycoAudio?.playClick?.();
  ctx.notifyWorldAction();
  return true;
}

export function commitHeldItemPlacement(ctx, point, snapCloseLid) {
  const held = ctx.heldItem;
  if (!held || !canPlaceVillageItem(point.x, point.z, held, appState.villageLease, !!ctx.villageMove)) return false;
  if (ctx.villageMove) {
    const payload = { lot_id: ctx.villageMove, item_id: held.id,
      pose: { x: point.x, y: point.y, z: point.z, ry: ctx.heldRotY } };
    const session = appState.sessionId;
    cancelHeldItemPlacement(ctx);
    ctx.villageMovePending = true;
    apiPost('api/village.php?action=move_as_editor', payload, true).then(result => {
      if (appState.sessionId !== session) return;
      ctx.callbacks.onToast?.(t(result?.ok ? 'village.editor_moved' : 'village.editor_failed'));
      ctx.notifyWorldAction();
    }).catch(() => {
      if (appState.sessionId === session) ctx.callbacks.onToast?.(t('village.editor_failed'));
    }).finally(() => { ctx.villageMovePending = false; });
    return true;
  }

  held.mesh.visible = true;
  if (held.growCtrl) {
    held.growCtrl.view.carry.visible = false;
    held.growCtrl.view.deployed.visible = true;
  }
  held.mesh.position.copy(point);
  held.mesh.rotation.set(0, ctx.heldRotY, 0);
  if (held.wildMushroomCtrl && held.wildMushroomCtrl.bodyGroup) {
    held.wildMushroomCtrl.bodyGroup.rotation.z = Math.PI / 2;
    held.wildMushroomCtrl.bodyGroup.position.y = held.wildMushroomCtrl.sideRestY ?? 0.05;
  }
  if (held.scalpelCtrl && held.scalpelCtrl.hasBlade && held.scalpelCtrl.sterile) {
    const nowPerf = performance.now();
    const onSanitizedHood = isAsepticWorkArea(ctx, held);
    const onSanitizedSurface = !!(ctx.pickableItems && ctx.pickableItems.some(function (cand) {
      if (!cand || cand === held || !cand.mesh) return false;
      if (!cand.mesh.userData.isTray && !cand.mesh.userData.isTable) return false;
      if ((cand.sanitizedUntil || 0) <= nowPerf) return false;
      const rad = (cand.radius || 0.35) + 0.12;
      return Math.abs(point.x - cand.mesh.position.x) <= rad &&
        Math.abs(point.z - cand.mesh.position.z) <= rad &&
        Math.abs(point.y - cand.mesh.position.y) <= 0.16;
    }));
    if (!onSanitizedHood && !onSanitizedSurface) {
      held.scalpelCtrl.sterile = false;
      held.scalpelCtrl.bladeExpired = true;
      held.scalpelCtrl.bladeContaminated = true;
      updateScalpelLabel(held);
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast('🦠 Lâmina do bisturi contaminou ao encostar em superfície não desinfectada!');
      }
    }
  }
  held.isMoved = true;

  if (snapCloseLid && held.potItem && ctx.snapClosePot) {
    if (Array.isArray(ctx.cookerPots)) {
      for (let i = 0; i < ctx.cookerPots.length; i++) {
        const cp = ctx.cookerPots[i];
        if (cp.lidItem === held && cp.potItem !== ctx.snapClosePot) {
          cp.lidItem = null;
          if (cp.potItem && cp.potItem.lidItem === held) cp.potItem.lidItem = null;
        }
        if (cp.potItem === ctx.snapClosePot) {
          cp.lidItem = held;
        }
      }
    }
    held.isAttached = true;
    held.potItem = ctx.snapClosePot;
    ctx.snapClosePot.lidItem = held;
    held.mesh.position.set(ctx.snapClosePot.mesh.position.x, ctx.snapClosePot.mesh.position.y + 0.36, ctx.snapClosePot.mesh.position.z);
    held.mesh.rotation.copy(ctx.snapClosePot.mesh.rotation);
    ctx.snapClosePot = null;
  }
  if (held.mesh.userData.updateBounds) held.mesh.userData.updateBounds(held);
  held.movedAt = performance.now();

  const dropTs = performance.now() + 25000;
  ctx.pendingMovedItems[held.id] = {
    ...ctx.pendingMovedItems[held.id],
    id: held.id, x: held.mesh.position.x, y: held.mesh.position.y, z: held.mesh.position.z, ry: held.mesh.rotation.y
  };
  ctx.recentlyDropped[held.id] = dropTs;
  saveLocalMovedObject(held);

  if (held.lidItem && held.lidItem.isAttached) {
    const lid = held.lidItem;
    lid.mesh.position.set(held.mesh.position.x, held.mesh.position.y + 0.36, held.mesh.position.z);
    lid.mesh.rotation.copy(held.mesh.rotation);
    lid.isMoved = true;
    lid.movedAt = performance.now();
    ctx.pendingMovedItems[lid.id] = {
      id: lid.id, x: lid.mesh.position.x, y: lid.mesh.position.y, z: lid.mesh.position.z, ry: lid.mesh.rotation.y
    };
    ctx.recentlyDropped[lid.id] = dropTs;
    saveLocalMovedObject(lid);
  }

  for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
    const cooker = ctx.cookerPots[cpi];
    if (cooker.potItem !== held) continue;
    let nonBaseIdx = 0;
    cooker.contents.forEach(function (item) {
      if (!item || !item.mesh) return;
      if (item.mesh.userData && item.mesh.userData.isCookerBase) {
        item.mesh.position.set(held.mesh.position.x, held.mesh.position.y + 0.036, held.mesh.position.z);
        item.mesh.rotation.set(0, held.mesh.rotation.y, 0);
      } else {
        const slot = COOKER_SLOT_OFFSETS[nonBaseIdx % COOKER_SLOT_OFFSETS.length];
        item.mesh.position.set(held.mesh.position.x + slot[0], held.mesh.position.y + COOKER_SLOT_Y, held.mesh.position.z + slot[1]);
        nonBaseIdx++;
      }
      item.isMoved = true;
      item.movedAt = performance.now();
      ctx.pendingMovedItems[item.id] = {
        id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
      };
      ctx.recentlyDropped[item.id] = dropTs;
      saveLocalMovedObject(item);
    });
    break;
  }

  if (held.trayContents && held.trayContents.length) {
    held.mesh.updateMatrixWorld(true);
    held.trayContents.forEach(function (content) {
      const item = content.item;
      if (!item || !item.mesh) return;
      if (content.localOffset) {
        _tmpCommitVec.copy(content.localOffset);
        held.mesh.localToWorld(_tmpCommitVec);
        item.mesh.position.copy(_tmpCommitVec);
      } else {
        const cosY = Math.cos(ctx.heldRotY);
        const sinY = Math.sin(ctx.heldRotY);
        item.mesh.position.set(
          held.mesh.position.x + content.lx * cosY + content.lz * sinY,
          held.mesh.position.y + content.ly,
          held.mesh.position.z - content.lx * sinY + content.lz * cosY
        );
      }
      const rotY = content.localRotY !== undefined ? (ctx.heldRotY + content.localRotY) : (ctx.heldRotY + (content.lry || 0));
      item.mesh.rotation.set(0, rotY, 0);
      item.isMoved = true;
      item.movedAt = performance.now();
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      ctx.pendingMovedItems[item.id] = {
        ...ctx.pendingMovedItems[item.id],
        id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
      };
      ctx.recentlyDropped[item.id] = dropTs;
      saveLocalMovedObject(item);
    });
    if (!held.deliveryCrateCtrl) held.trayContents = null;
  }

  setHeldTwoHandedGhost(held, false);
  cancelHeldItemPlacement(ctx);
  markItemsFalling();
  ctx._stackPhysicsDirty = true;
  ctx.heldItem = null;
  ctx.aimActionPrompt = '';
  ctx.thermoLaserOn = false;
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.thermoLaserLine) ctx.thermoLaserLine.visible = false;
  if (ctx.thermoLaserDot) ctx.thermoLaserDot.visible = false;
  if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  ctx.notifyWorldAction();
  return true;
}
