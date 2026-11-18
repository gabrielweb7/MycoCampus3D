/**
 * Movimentação em Grupo por Superfície (MycoCampus3D)
 * Permite mover uma bancada/prateleira/bandeja levando junto todos os itens apoiados sobre ela
 * (incluindo pilhas recursivas) e marcando todos para persistência/sync multiplayer.
 */

import { updateItemBounds } from '../items/item-registry.js';

function getItemSurfaces(item) {
  if (!item || !item.mesh || !item.mesh.userData) return [];
  const ud = item.mesh.userData;
  const list = [];
  if (ud.dynamicSurface) list.push(ud.dynamicSurface);
  if (Array.isArray(ud.dynamicSurfaces)) {
    for (let i = 0; i < ud.dynamicSurfaces.length; i++) {
      if (ud.dynamicSurfaces[i]) list.push(ud.dynamicSurfaces[i]);
    }
  }
  return list;
}

function isPointOnSurface(p, surf) {
  return p.x >= surf.minX - 0.08 && p.x <= surf.maxX + 0.08 &&
    p.z >= surf.minZ - 0.08 && p.z <= surf.maxZ + 0.08 &&
    p.y >= surf.topY - 0.12 && p.y <= surf.topY + 0.55;
}

/**
 * Coleta todos os pickableItems apoiados sobre `parentItem` (recursivamente, sem duplicatas).
 * @param {object} ctx
 * @param {object} parentItem
 * @returns {Array<object>}
 */
export function getItemsSupportedBy(ctx, parentItem) {
  if (!ctx || !Array.isArray(ctx.pickableItems) || !parentItem || !parentItem.mesh) return [];
  const heldItem = ctx.getHeldItem ? ctx.getHeldItem() : ctx.heldItem;
  const visited = new Set([parentItem]);
  const queue = [parentItem];
  const result = [];

  while (queue.length > 0) {
    const current = queue.shift();
    const surfaces = getItemSurfaces(current);
    if (!surfaces.length) continue;

    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const cand = ctx.pickableItems[i];
      if (!cand || !cand.mesh || visited.has(cand)) continue;
      if (cand === heldItem || (ctx.isHeldByRemote && ctx.isHeldByRemote(cand.id))) continue;
      const p = cand.mesh.position;
      let onAny = false;
      for (let si = 0; si < surfaces.length; si++) {
        if (isPointOnSurface(p, surfaces[si])) {
          onAny = true;
          break;
        }
      }
      if (onAny) {
        visited.add(cand);
        queue.push(cand);
        result.push(cand);
      }
    }
  }
  return result;
}

/**
 * Move `parentItem` para `(newPos, newRy)` levando todos os itens apoiados em cima,
 * rotacionando-os em torno do pivô e marcando tudo para sync multiplayer/MySQL.
 * @param {object} ctx
 * @param {object} parentItem
 * @param {{ x: number, y: number, z: number }} newPos
 * @param {number} [newRy]
 * @returns {{ movedCount: number, children: Array<object> }}
 */
export function moveItemWithSupported(ctx, parentItem, newPos, newRy) {
  if (!parentItem || !parentItem.mesh || !newPos) return { movedCount: 0, children: [] };

  const oldX = parentItem.mesh.position.x;
  const oldY = parentItem.mesh.position.y;
  const oldZ = parentItem.mesh.position.z;
  const oldRy = parentItem.mesh.rotation.y || 0;
  const targetRy = typeof newRy === 'number' ? newRy : oldRy;

  const dx = newPos.x - oldX;
  const dy = newPos.y - oldY;
  const dz = newPos.z - oldZ;
  const dRy = targetRy - oldRy;

  // Coleta antes de atualizar os bounds do pai
  const children = getItemsSupportedBy(ctx, parentItem);

  parentItem.mesh.position.set(newPos.x, newPos.y, newPos.z);
  parentItem.mesh.rotation.y = targetRy;
  updateItemBounds(parentItem);
  if (ctx && ctx.markItemMoved) ctx.markItemMoved(parentItem);

  const cosR = Math.cos(dRy);
  const sinR = Math.sin(dRy);

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const relX = child.mesh.position.x - oldX;
    const relZ = child.mesh.position.z - oldZ;
    // Rotação Y em Three.js: x' = x*cos(a) + z*sin(a), z' = -x*sin(a) + z*cos(a)
    const rotX = dRy !== 0 ? (relX * cosR + relZ * sinR) : relX;
    const rotZ = dRy !== 0 ? (-relX * sinR + relZ * cosR) : relZ;

    child.mesh.position.set(newPos.x + rotX, child.mesh.position.y + dy, newPos.z + rotZ);
    child.mesh.rotation.y = (child.mesh.rotation.y || 0) + dRy;
    updateItemBounds(child);
    if (ctx && ctx.markItemMoved) ctx.markItemMoved(child);
  }

  return { movedCount: 1 + children.length, children };
}

/**
 * Faz todos os itens apoiados sobre `parentItem` (ou dentro, se for panela)
 * caírem para o chão/superfície abaixo antes de `parentItem` ser removido.
 * @param {object} ctx
 * @param {object} parentItem
 * @param {function(number, number, number): number} [getGroundY]
 * @returns {Array<object>}
 */
export function dropSupportedItemsToGround(ctx, parentItem, getGroundY) {
  if (!ctx || !parentItem || !parentItem.mesh) return [];
  const toDrop = new Set(getItemsSupportedBy(ctx, parentItem));

  if (Array.isArray(ctx.cookerPots)) {
    for (let i = 0; i < ctx.cookerPots.length; i++) {
      const cp = ctx.cookerPots[i];
      if (cp.potItem === parentItem && Array.isArray(cp.contents)) {
        cp.contents.forEach((c) => { if (c) toDrop.add(c); });
        cp.contents = [];
        cp.hasBase = false;
      }
    }
  }

  const dropped = [];
  const ignoreSurf = parentItem.mesh.userData ? parentItem.mesh.userData.dynamicSurface : null;
  toDrop.forEach((child) => {
    if (!child || !child.mesh || child === parentItem) return;
    const p = child.mesh.position;
    const gy = typeof getGroundY === 'function' ? getGroundY(p.x, p.z, p.y, ignoreSurf) : 0;
    child.mesh.position.set(p.x, gy, p.z);
    child.isMoved = true;
    updateItemBounds(child);
    if (ctx.markItemMoved) ctx.markItemMoved(child);
    dropped.push(child);
  });
  return dropped;
}
