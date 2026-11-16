import { registerPickable } from './item-registry.js';
import { PETRI_DISH_RADIUS } from './petri-dish.js';

const THREE = window.THREE;
const FRIDGE_WIDTH = 0.88;
const FRIDGE_HEIGHT = 1.55;
const FRIDGE_DEPTH = 0.72;
const DOOR_OPEN_ANGLE = -1.35;

export const CULTURE_FRIDGE_META = {
  category: 'storage_equipment',
  purpose: 'Geladeira de culturas a 4°C para conservar placas colonizadas',
  weightGrams: 32000,
  getTempC: () => 4,
  compatibilities: { canEnterCooker: false, storesPetriCultures: true },
  connections: ['petri_dish']
};

function addBox(parent, width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function updateShelfSurfaces(fridge) {
  const ctrl = fridge.fridgeCtrl;
  const pos = fridge.mesh.position;
  const cos = Math.cos(fridge.mesh.rotation.y);
  const sin = Math.sin(fridge.mesh.rotation.y);
  const collider = ctrl.solidCollider;
  const bodyX = FRIDGE_WIDTH * 0.5;
  const bodyZ = FRIDGE_DEPTH * 0.5;
  const edgeX = Math.abs(bodyX * cos) + Math.abs(bodyZ * sin);
  const edgeZ = Math.abs(bodyX * sin) + Math.abs(bodyZ * cos);
  collider.minX = pos.x - edgeX;
  collider.maxX = pos.x + edgeX;
  collider.minZ = pos.z - edgeZ;
  collider.maxZ = pos.z + edgeZ;
  collider.minY = pos.y;
  collider.maxY = pos.y + FRIDGE_HEIGHT;
  collider.surfaceTopY = pos.y + FRIDGE_HEIGHT;
  for (let i = 0; i < ctrl.slots.length; i++) {
    const slot = ctrl.slots[i];
    slot.worldPosition.set(
      pos.x + slot.localX * cos + slot.localZ * sin,
      pos.y + slot.localY,
      pos.z - slot.localX * sin + slot.localZ * cos
    );
  }
  for (let i = 0; i < ctrl.shelfSurfaces.length; i++) {
    const surface = ctrl.shelfSurfaces[i];
    const minX = surface.localMinX, maxX = surface.localMaxX;
    const minZ = surface.localMinZ, maxZ = surface.localMaxZ;
    const x0 = pos.x + minX * cos + minZ * sin;
    const x1 = pos.x + minX * cos + maxZ * sin;
    const x2 = pos.x + maxX * cos + minZ * sin;
    const x3 = pos.x + maxX * cos + maxZ * sin;
    const z0 = pos.z - minX * sin + minZ * cos;
    const z1 = pos.z - minX * sin + maxZ * cos;
    const z2 = pos.z - maxX * sin + minZ * cos;
    const z3 = pos.z - maxX * sin + maxZ * cos;
    surface.minX = Math.min(x0, x1, x2, x3);
    surface.maxX = Math.max(x0, x1, x2, x3);
    surface.minZ = Math.min(z0, z1, z2, z3);
    surface.maxZ = Math.max(z0, z1, z2, z3);
    surface.topY = pos.y + surface.localTopY;
  }
}

function findOccupiedSlot(ctx, position, excludeItem) {
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const item = ctx.pickableItems[i];
    if (!item || item === excludeItem || !item.mesh || !item.mesh.userData.petriCtrl || ctx.isHeldByRemote(item.id)) continue;
    const p = item.mesh.position;
    if (Math.hypot(p.x - position.x, p.z - position.z) < PETRI_DISH_RADIUS * 1.5 &&
        Math.abs(p.y - position.y) < 0.06) return true;
  }
  return false;
}

export function getCultureFridgeStorageTarget(ctx) {
  let closestFridge = null;
  let closestDistance = Infinity;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const fridge = ctx.pickableItems[i];
    if (!fridge || !fridge.fridgeCtrl || ctx.isHeldByRemote(fridge.id)) continue;
    const hits = ctx.raycaster.intersectObject(fridge.mesh, true);
    for (let hi = 0; hi < hits.length; hi++) {
      if (!hits[hi].object.userData.ignoreRay) {
        if (hits[hi].distance < 3.5 && hits[hi].distance < closestDistance) {
          closestFridge = fridge;
          closestDistance = hits[hi].distance;
        }
        break;
      }
    }
  }
  if (!closestFridge) return null;

  const fridge = closestFridge;
  const ctrl = fridge.fridgeCtrl;
  let slotPosition = null;
  if (ctrl.doorOpen) {
    for (let si = 0; si < ctrl.slots.length; si++) {
      const position = ctrl.slots[si].worldPosition;
      if (!findOccupiedSlot(ctx, position, ctx.heldItem)) {
        slotPosition = position;
        break;
      }
    }
  }
  return { fridge, slotPosition };
}

export function setCultureFridgeDoorOpen(fridge, open, immediate) {
  const ctrl = fridge && fridge.fridgeCtrl;
  if (!ctrl || ctrl.doorOpen === !!open) return false;
  ctrl.doorOpen = !!open;
  ctrl.doorAnimationFrom = ctrl.doorProgress;
  ctrl.doorAnimationTo = ctrl.doorOpen ? 1 : 0;
  ctrl.doorAnimationElapsed = 0;
  if (immediate) {
    ctrl.doorProgress = ctrl.doorAnimationTo;
    ctrl.doorPivot.rotation.y = DOOR_OPEN_ANGLE * ctrl.doorProgress;
    ctrl.doorAnimationElapsed = ctrl.doorAnimationDuration;
  }
  return true;
}

export function toggleCultureFridgeDoor(fridge) {
  return setCultureFridgeDoorOpen(fridge, !fridge.fridgeCtrl.doorOpen, false);
}

export function isPetriAccessibleFromFridge(ctx, item) {
  const petri = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!petri || !petri.inFridge || !petri.fridgeId) return true;
  let fridge = null;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    if (ctx.pickableItems[i].id === petri.fridgeId) {
      fridge = ctx.pickableItems[i];
      break;
    }
  }
  return !fridge || !fridge.fridgeCtrl || fridge.fridgeCtrl.doorOpen;
}

export function stepCultureFridges(ctx, dt) {
  const items = ctx.pickableItems;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || !item.mesh || !item.mesh.userData.petriCtrl) continue;
    const ctrl = item.mesh.userData.petriCtrl;
    ctrl.inFridge = false;
    ctrl.refrigerated = false;
    ctrl.fridgeId = '';
  }

  for (let fi = 0; fi < items.length; fi++) {
    const fridge = items[fi];
    if (!fridge || !fridge.fridgeCtrl) continue;
    const ctrl = fridge.fridgeCtrl;
    fridge.mesh.updateWorldMatrix(true, false);
    updateShelfSurfaces(fridge);
    if (ctrl.doorAnimationElapsed < ctrl.doorAnimationDuration) {
      ctrl.doorAnimationElapsed = Math.min(ctrl.doorAnimationDuration, ctrl.doorAnimationElapsed + dt);
      const t = ctrl.doorAnimationElapsed / ctrl.doorAnimationDuration;
      const eased = t * t * (3 - 2 * t);
      ctrl.doorProgress = ctrl.doorAnimationFrom + (ctrl.doorAnimationTo - ctrl.doorAnimationFrom) * eased;
      ctrl.doorPivot.rotation.y = DOOR_OPEN_ANGLE * ctrl.doorProgress;
    }

    for (let si = 0; si < ctrl.slots.length; si++) {
      const slot = ctrl.slots[si];
      const position = slot.worldPosition;
      for (let pi = 0; pi < items.length; pi++) {
        const item = items[pi];
        if (!item || !item.mesh || !item.mesh.userData.petriCtrl) continue;
        const petri = item.mesh.userData.petriCtrl;
        const itemPos = item.mesh.position;
        if (Math.hypot(itemPos.x - position.x, itemPos.z - position.z) >= PETRI_DISH_RADIUS * 1.5 ||
            Math.abs(itemPos.y - position.y) >= 0.06) continue;
        petri.inFridge = true;
        petri.refrigerated = !ctrl.doorOpen;
        petri.fridgeId = fridge.id;
      }
    }
  }
}

export function makeCultureFridge(ctx, id, x, y, z) {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.48, metalness: 0.08 });
  const insideMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.36, metalness: 0.48 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0.1, depthWrite: false
  });

  addBox(group, 0.07, FRIDGE_HEIGHT, FRIDGE_DEPTH, shellMat, -0.405, FRIDGE_HEIGHT * 0.5, 0);
  addBox(group, 0.07, FRIDGE_HEIGHT, FRIDGE_DEPTH, shellMat, 0.405, FRIDGE_HEIGHT * 0.5, 0);
  addBox(group, 0.82, 0.08, FRIDGE_DEPTH, shellMat, 0, 0.04, 0);
  addBox(group, 0.82, 0.08, FRIDGE_DEPTH, shellMat, 0, FRIDGE_HEIGHT - 0.04, 0);
  addBox(group, 0.82, FRIDGE_HEIGHT - 0.16, 0.07, insideMat, 0, FRIDGE_HEIGHT * 0.5, -0.325);

  const slots = [];
  const shelfSurfaces = [];
  [0.24, 0.49, 0.74, 0.99, 1.24].forEach(function (shelfTop) {
    const shelf = addBox(group, 0.68, 0.018, 0.56, shelfMat, 0, shelfTop - 0.009, -0.005);
    const surface = {
      minX: x - 0.34, maxX: x + 0.34,
      minZ: z - 0.285, maxZ: z + 0.275,
      topY: y + shelfTop,
      localMinX: -0.34, localMaxX: 0.34,
      localMinZ: -0.285, localMaxZ: 0.275,
      localTopY: shelfTop,
      isCultureFridgeShelf: true
    };
    shelfSurfaces.push(surface);
    shelf.userData.supportSurface = surface;
    ctx.supportMeshes.push(shelf);
    ctx.supportSurfaces.push(surface);
    [-0.21, 0, 0.21].forEach(function (slotX) {
      slots.push({
        localX: slotX,
        localY: shelfTop,
        localZ: 0.06,
        worldPosition: new THREE.Vector3(x + slotX, y + shelfTop, z + 0.06)
      });
    });
  });

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-FRIDGE_WIDTH * 0.5, FRIDGE_HEIGHT - 0.09, FRIDGE_DEPTH * 0.5);
  group.add(doorPivot);
  const doorHeight = FRIDGE_HEIGHT - 0.16;
  const doorWidth = FRIDGE_WIDTH - 0.08;
  const doorPanel = addBox(doorPivot, doorWidth, doorHeight, 0.055, shellMat, doorWidth * 0.5, -doorHeight * 0.5, 0.035);
  const doorGlass = addBox(doorPivot, doorWidth - 0.16, doorHeight - 0.22, 0.012, glassMat, doorWidth * 0.5, -doorHeight * 0.5, 0.071);
  const doorHandle = addBox(doorPivot, 0.025, 0.34, 0.04, shelfMat, doorWidth - 0.055, -doorHeight * 0.5, 0.09);
  doorPanel.userData.ignoreRay = true;
  doorGlass.userData.ignoreRay = true;
  doorHandle.userData.ignoreRay = true;

  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 256;
  screenCanvas.height = 96;
  const screenCtx = screenCanvas.getContext('2d');
  screenCtx.fillStyle = '#0f172a';
  screenCtx.fillRect(0, 0, 256, 96);
  screenCtx.fillStyle = '#38bdf8';
  screenCtx.font = 'bold 42px sans-serif';
  screenCtx.textAlign = 'center';
  screenCtx.fillText('4°C', 128, 58);
  screenCtx.fillStyle = '#cbd5e1';
  screenCtx.font = 'bold 15px sans-serif';
  screenCtx.fillText('CULTURE FRIDGE', 128, 84);
  const screenMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(screenCanvas) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.105), screenMat);
  screen.position.set(0, FRIDGE_HEIGHT - 0.09, FRIDGE_DEPTH * 0.5 + 0.09);
  screen.userData.ignoreRay = true;
  group.add(screen);

  const fridgeCtrl = {
    slots,
    shelfSurfaces,
    doorPivot,
    doorOpen: false,
    doorProgress: 0,
    doorAnimationFrom: 0,
    doorAnimationTo: 0,
    doorAnimationElapsed: 0,
    doorAnimationDuration: 0.45,
    temperatureC: 4
  };
  group.userData.isCultureFridge = true;
  group.userData.fridgeCtrl = fridgeCtrl;
  const item = registerPickable(ctx, id, 'Geladeira de Culturas (4°C)', group, x, y, z, 0, 0.50, FRIDGE_HEIGHT, CULTURE_FRIDGE_META);
  const solidCollider = {
    minX: x - FRIDGE_WIDTH * 0.5,
    maxX: x + FRIDGE_WIDTH * 0.5,
    minZ: z - FRIDGE_DEPTH * 0.5,
    maxZ: z + FRIDGE_DEPTH * 0.5,
    minY: y,
    maxY: y + FRIDGE_HEIGHT,
    surfaceTopY: y + FRIDGE_HEIGHT
  };
  ctx.solidColliders.push(solidCollider);
  item.fridgeCtrl = fridgeCtrl;
  fridgeCtrl.solidCollider = solidCollider;
  fridgeCtrl.item = item;
  return item;
}
