import {
  findPlacementTarget,
  getPlacementBlockedReason,
  isPlacementBlocked,
  updatePlacementGhostVisual
} from '../entities/placement-ghost.js';
import { hideHover3dBadge } from '../entities/hover-3d-badge.js';

const _tmpCommitVec = new window.THREE.Vector3();

export function setHeldTwoHandedGhost(item, active) {
  if (!item || !item.mesh) return;
  item.mesh.visible = true;
  if (item.lidItem) {
    item.lidItem.mesh.visible = true;
  }
  if (item.cookerRef && Array.isArray(item.cookerRef.contents)) {
    item.cookerRef.contents.forEach(function (cItem) {
      if (cItem && cItem.mesh) cItem.mesh.visible = true;
    });
  }
}

function setPlacementMode(ctx, active) {
  ctx.placementMode = active;
  if (!active) {
    ctx.placementValid = false;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
  }
  if (ctx.callbacks.onPlacementModeChange) {
    ctx.callbacks.onPlacementModeChange(active);
  }
}

export function beginHeldItemPlacement(ctx) {
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
  if (ctx.callbacks.onToast) {
    ctx.callbacks.onToast('📦 Mire o local e clique para posicionar. Pressione Esc para cancelar.');
  }
  return true;
}

export function cancelHeldItemPlacement(ctx) {
  if (!ctx.placementMode) return false;
  setPlacementMode(ctx, false);
  return true;
}

export function toggleHeldItemPlacement(ctx) {
  return ctx.placementMode
    ? cancelHeldItemPlacement(ctx)
    : beginHeldItemPlacement(ctx);
}

export function updateHeldItemPlacementPreview(ctx, rayNdc) {
  if (!ctx.heldItem || !ctx.placementMode || !ctx.placementGhost) {
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    return false;
  }

  const point = findPlacementTarget(ctx.entityCtx, rayNdc);
  ctx.placementValid = !isPlacementBlocked(ctx.entityCtx, point);
  ctx.placementGhost.position.copy(point);
  updatePlacementGhostVisual(ctx.heldItem, ctx.placementValid, ctx.heldRotY, ctx.clock.elapsedTime);
  ctx.placementGhost.visible = true;

  const prompt = ctx.snapClosePot
    ? '🍲 Fechar tampa na Panela de Pressão'
    : (ctx.placementValid
      ? '📦 Clique para posicionar: ' + ctx.heldItem.label
      : (getPlacementBlockedReason() || '🚫 Local bloqueado (espaço ocupado)'));
  if (ctx.hover3dBadge) hideHover3dBadge(ctx.hover3dBadge);
  if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
  return true;
}

export function commitHeldItemPlacement(ctx, point, snapCloseLid) {
  const held = ctx.heldItem;
  if (!held) return false;

  held.mesh.position.copy(point);
  held.mesh.rotation.set(0, ctx.heldRotY, 0);
  held.isMoved = true;

  if (snapCloseLid && held.potItem && ctx.snapClosePot) {
    held.isAttached = true;
    held.potItem = ctx.snapClosePot;
    ctx.snapClosePot.lidItem = held;
    held.mesh.position.set(ctx.snapClosePot.mesh.position.x, ctx.snapClosePot.mesh.position.y + 0.36, ctx.snapClosePot.mesh.position.z);
    held.mesh.rotation.copy(ctx.snapClosePot.mesh.rotation);
    ctx.snapClosePot = null;
  }
  if (held.mesh.userData.updateBounds) held.mesh.userData.updateBounds(held);

  const dropTs = performance.now() + 15000;
  ctx.pendingMovedItems[held.id] = {
    id: held.id, x: held.mesh.position.x, y: held.mesh.position.y, z: held.mesh.position.z, ry: held.mesh.rotation.y
  };
  ctx.recentlyDropped[held.id] = dropTs;

  if (held.lidItem && held.lidItem.isAttached) {
    const lid = held.lidItem;
    lid.mesh.position.set(held.mesh.position.x, held.mesh.position.y + 0.36, held.mesh.position.z);
    lid.mesh.rotation.copy(held.mesh.rotation);
    lid.isMoved = true;
    ctx.pendingMovedItems[lid.id] = {
      id: lid.id, x: lid.mesh.position.x, y: lid.mesh.position.y, z: lid.mesh.position.z, ry: lid.mesh.rotation.y
    };
    ctx.recentlyDropped[lid.id] = dropTs;
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
        const ox = nonBaseIdx % 2 === 0 ? -0.065 : 0.065;
        const oz = nonBaseIdx < 2 ? -0.055 : 0.055;
        item.mesh.position.set(held.mesh.position.x + ox, held.mesh.position.y + 0.080, held.mesh.position.z + oz);
        nonBaseIdx++;
      }
      item.isMoved = true;
      ctx.pendingMovedItems[item.id] = {
        id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
      };
      ctx.recentlyDropped[item.id] = dropTs;
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
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      ctx.pendingMovedItems[item.id] = {
        id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
      };
      ctx.recentlyDropped[item.id] = dropTs;
    });
    held.trayContents = null;
  }

  setHeldTwoHandedGhost(held, false);
  cancelHeldItemPlacement(ctx);
  ctx.heldItem = null;
  ctx.thermoLaserOn = false;
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.thermoLaserLine) ctx.thermoLaserLine.visible = false;
  if (ctx.thermoLaserDot) ctx.thermoLaserDot.visible = false;
  if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  ctx.notifyWorldAction();
  return true;
}
