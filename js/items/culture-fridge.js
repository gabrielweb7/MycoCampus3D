import { registerPickable, updateItemBounds, isSurfaceOccupied, attachSurfaceOwner } from './item-registry.js';
import { PETRI_DISH_RADIUS } from './petri-dish.js';
import { updateCultureLiquidLabel } from './liquid-culture.js';
import { stepCultureShelfLife, stepCultureTemperature } from './culture-lifecycle.js';

const THREE = window.THREE;
const FRIDGE_WIDTH = 0.88;
const FRIDGE_HEIGHT = 1.55;
const FRIDGE_DEPTH = 0.72;
const DOOR_OPEN_ANGLE = -1.35;

export const CULTURE_FRIDGE_META = {
  category: 'storage_equipment',
  purpose: 'Geladeira a 4°C para conservar placas, spawn sólido e culturas líquidas colonizadas',
  weightGrams: 32000,
  getTempC: () => 4,
  compatibilities: { canEnterCooker: false, storesCultureContainers: true },
  connections: ['petri_dish', 'liquid_culture', 'spawn_jar', 'pp5_cup']
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
    const midZ = (minZ + maxZ) * 0.5;
    surface.centerX = pos.x + midZ * sin;
    surface.centerZ = pos.z + midZ * cos;
    surface.halfW = (maxX - minX) * 0.5;
    surface.halfD = (maxZ - minZ) * 0.5;
    surface.ry = fridge.mesh.rotation.y || 0;
  }
}

function getCultureStorageInfo(item) {
  if (!item || !item.mesh) return null;
  const meshData = item.mesh.userData || {};
  const petri = meshData.petriCtrl;
  const culture = item.cultureCtrl || meshData.cultureCtrl;
  const spawn = item.spawnCtrl || meshData.spawnCtrl;
  if (!petri && !culture && !spawn) return null;
  const info = meshData.cultureStorageInfo || (meshData.cultureStorageInfo = {});
  if (petri) {
    info.kind = 'petri';
    info.ctrl = petri;
    info.ready = true;
    info.lidOpen = !!petri.lidOpen;
    info.radius = PETRI_DISH_RADIUS;
    info.height = item.height || PETRI_DISH_RADIUS;
    info.displayLabel = 'placa';
    return info;
  }
  if (culture) {
    info.kind = 'vessel';
    info.ctrl = culture;
    info.ready = true;
    info.lidOpen = false;
    info.radius = 0.09;
    info.height = item.height || 0.30;
    info.displayLabel = 'cultura líquida';
    return info;
  }
  if (spawn) {
    info.kind = spawn.isPP5 ? 'petri' : 'vessel';
    info.ctrl = spawn;
    info.ready = true;
    info.lidOpen = false;
    info.radius = spawn.isPP5 ? 0.06 : (spawn.isBag ? 0.12 : 0.11);
    info.height = item.height || 0.30;
    info.displayLabel = spawn.isPP5 ? 'potinho PP5' : (spawn.isBag ? 'bag de spawn' : 'frasco de spawn');
    return info;
  }
  return null;
}

function getGenericFridgeItemInfo(item) {
  if (!item || !item.mesh) return null;
  const ud = item.mesh.userData || {};
  if (ud.twoHanded || ud.isTable || ud.isHood || ud.isBurner || ud.isTrash || item.fridgeCtrl || item.potItem) return null;
  const h = item.height || 0.20;
  if (h > 0.38) return null;
  return {
    kind: (item.radius || 0.1) <= 0.08 ? 'petri' : 'vessel',
    height: h,
    radius: item.radius || 0.10,
    ready: true,
    lidOpen: false,
    displayLabel: item.label || 'Item',
    ctrl: null
  };
}

function findOccupiedSlot(ctx, position, excludeItem, slotKind) {
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const item = ctx.pickableItems[i];
    if (!item || item === excludeItem || ctx.isHeldByRemote(item.id)) continue;
    const info = getCultureStorageInfo(item) || getGenericFridgeItemInfo(item);
    if (!info) continue;
    const p = item.mesh.position;
    if (Math.hypot(p.x - position.x, p.z - position.z) < info.radius + (slotKind === 'vessel' ? 0.11 : PETRI_DISH_RADIUS) &&
        Math.abs(p.y - position.y) < 0.06) return true;
  }
  return false;
}

export function getCultureFridgeStorageTarget(ctx) {
  const heldInfo = getCultureStorageInfo(ctx.heldItem) || getGenericFridgeItemInfo(ctx.heldItem);
  if (!heldInfo) return null;
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
      const slot = ctrl.slots[si];
      if (slot.kind !== heldInfo.kind || heldInfo.height > slot.maxCultureHeight ||
          findOccupiedSlot(ctx, slot.worldPosition, ctx.heldItem, slot.kind)) continue;
      slotPosition = slot.worldPosition;
      break;
    }
  }
  return {
    fridge,
    slotPosition,
    ready: heldInfo.ready,
    lidOpen: heldInfo.lidOpen,
    cultureKind: heldInfo.kind,
    displayLabel: heldInfo.displayLabel
  };
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

/** Verdadeiro se o objeto ou seus nós ascendentes pertencem à porta da geladeira */
export function isPartOfFridgeDoor(obj, fridge) {
  if (!obj || !fridge || !fridge.fridgeCtrl || !fridge.fridgeCtrl.doorPivot) return false;
  let cur = obj;
  while (cur) {
    if (cur === fridge.fridgeCtrl.doorPivot) return true;
    cur = cur.parent;
  }
  return false;
}

/** Verdadeiro se houver qualquer item guardado nas prateleiras (impede mover a geladeira). */
export function isCultureFridgeOccupied(ctx, fridge) {
  const ctrl = fridge && fridge.fridgeCtrl;
  if (!ctrl || !ctrl.shelfSurfaces) return false;
  for (let i = 0; i < ctrl.shelfSurfaces.length; i++) {
    if (isSurfaceOccupied(ctx, ctrl.shelfSurfaces[i], fridge)) return true;
  }
  return false;
}

export function isCultureAccessibleFromFridge(ctx, item) {
  const info = getCultureStorageInfo(item);
  const culture = info && info.ctrl;
  if (!culture || !culture.inFridge || !culture.fridgeId) return true;
  let fridge = null;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    if (ctx.pickableItems[i].id === culture.fridgeId) {
      fridge = ctx.pickableItems[i];
      break;
    }
  }
  return !fridge || !fridge.fridgeCtrl || fridge.fridgeCtrl.doorOpen;
}

function getAnyRefrigeratableCtrl(item) {
  if (!item || !item.mesh) return null;
  if (item.mesh.userData && item.mesh.userData.petriCtrl) return item.mesh.userData.petriCtrl;
  if (item.cultureCtrl) return item.cultureCtrl;
  if (item.spawnCtrl) return item.spawnCtrl;
  if (item.syringeCtrl) return item.syringeCtrl;
  if (item.pdaMediumCtrl) return item.pdaMediumCtrl;
  if (item.cultureCtrl) return item.cultureCtrl;
  return null;
}

const _tmpFridgeLocal = new THREE.Vector3();
let fridgeSimAccumDt = 0;

export function stepCultureFridges(ctx, dt) {
  const items = ctx.pickableItems;
  if (!items || !items.length) return;

  // 1. Passo Rápido (60Hz): apenas animação suave de porta quando está abrindo/fechando
  for (let fi = 0; fi < items.length; fi++) {
    const fridge = items[fi];
    if (!fridge || !fridge.fridgeCtrl) continue;
    const ctrl = fridge.fridgeCtrl;
    if (ctrl.doorAnimationElapsed < ctrl.doorAnimationDuration) {
      ctrl.doorAnimationElapsed = Math.min(ctrl.doorAnimationDuration, ctrl.doorAnimationElapsed + dt);
      const t = ctrl.doorAnimationElapsed / ctrl.doorAnimationDuration;
      const eased = t * t * (3 - 2 * t);
      ctrl.doorProgress = ctrl.doorAnimationFrom + (ctrl.doorAnimationTo - ctrl.doorAnimationFrom) * eased;
      ctrl.doorPivot.rotation.y = DOOR_OPEN_ANGLE * ctrl.doorProgress;
    }
  }

  // 2. Passo Lento (~4Hz / 250ms): detecção de slots, temperatura, colonização e validade
  fridgeSimAccumDt += dt;
  if (fridgeSimAccumDt < 0.25) return;
  const slowDt = fridgeSimAccumDt;
  fridgeSimAccumDt = 0;

  const doorOpenByFridgeId = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.fridgeCtrl) doorOpenByFridgeId[item.id] = !!item.fridgeCtrl.doorOpen;
    const anyCtrl = getAnyRefrigeratableCtrl(item);
    if (anyCtrl) {
      anyCtrl.inFridge = false;
      anyCtrl.fridgeId = '';
    }
    const info = getCultureStorageInfo(item);
    if (info && info.ctrl) {
      info.ctrl.inFridge = false;
      info.ctrl.fridgeId = '';
    }
  }

  for (let fi = 0; fi < items.length; fi++) {
    const fridge = items[fi];
    if (!fridge || !fridge.fridgeCtrl) continue;
    const ctrl = fridge.fridgeCtrl;
    const fPos = fridge.mesh.position;
    const fRy = fridge.mesh.rotation.y;
    if (ctrl._lastX !== fPos.x || ctrl._lastY !== fPos.y || ctrl._lastZ !== fPos.z || ctrl._lastRy !== fRy) {
      ctrl._lastX = fPos.x;
      ctrl._lastY = fPos.y;
      ctrl._lastZ = fPos.z;
      ctrl._lastRy = fRy;
      fridge.mesh.updateWorldMatrix(true, false);
      updateShelfSurfaces(fridge);
    }

    for (let si = 0; si < ctrl.slots.length; si++) {
      const slot = ctrl.slots[si];
      const position = slot.worldPosition;
      for (let pi = 0; pi < items.length; pi++) {
        const item = items[pi];
        const info = getCultureStorageInfo(item);
        if (!info || info.kind !== slot.kind || info.height > slot.maxCultureHeight) continue;
        const itemPos = item.mesh.position;
        const maxR = info.radius + (slot.kind === 'vessel' ? 0.11 : PETRI_DISH_RADIUS);
        const dxs = itemPos.x - position.x;
        const dzs = itemPos.z - position.z;
        if ((dxs * dxs + dzs * dzs) >= (maxR * maxR) || Math.abs(itemPos.y - position.y) >= 0.06) continue;
        info.ctrl.inFridge = true;
        info.ctrl.fridgeId = fridge.id;
      }
    }

    // Pré-filtro espacial rápido (1.5m^2 = 2.25) antes de multiplicar matriz 4x4 inversa (worldToLocal)
    for (let pi = 0; pi < items.length; pi++) {
      const item = items[pi];
      if (!item || item === ctx.heldItem || item === fridge || item.fridgeCtrl) continue;
      const ip = item.mesh.position;
      const dxF = ip.x - fPos.x;
      const dzF = ip.z - fPos.z;
      if (dxF * dxF + dzF * dzF > 2.25) continue;
      const anyCtrl = getAnyRefrigeratableCtrl(item);
      if (!anyCtrl) continue;
      _tmpFridgeLocal.copy(ip);
      fridge.mesh.worldToLocal(_tmpFridgeLocal);
      if (Math.abs(_tmpFridgeLocal.x) <= 0.36 && _tmpFridgeLocal.y >= 0.14 && _tmpFridgeLocal.y <= 1.65 && Math.abs(_tmpFridgeLocal.z) <= 0.36) {
        anyCtrl.inFridge = true;
        anyCtrl.fridgeId = fridge.id;
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const anyCtrl = getAnyRefrigeratableCtrl(item);
    if (anyCtrl) {
      stepCultureTemperature(anyCtrl, slowDt, !!anyCtrl.inFridge, !!doorOpenByFridgeId[anyCtrl.fridgeId]);
    }
    const info = getCultureStorageInfo(item);
    if (!info || info.kind !== 'vessel' || !(item.cultureCtrl || (item.mesh.userData && item.mesh.userData.cultureCtrl))) continue;
    const culture = info.ctrl;
    const tempChanged = anyCtrl === culture ? false : stepCultureTemperature(culture, slowDt, !!culture.inFridge, !!doorOpenByFridgeId[culture.fridgeId]);
    const changed = culture.refrigerated !== culture.lastRenderedRefrigerated;
    if (!item.mesh.userData.liquidCtrl || item.mesh.userData.liquidCtrl.volMl <= 0) continue;
    const lifeStep = stepCultureShelfLife(culture, slowDt);
    let lcProgressed = false;
    const lcRate = culture.refrigerated
      ? (0.8 * 0.2)
      : (typeof culture.tempC === 'number' && culture.tempC >= 20 && culture.tempC <= 30 ? 0.8 : 0);
    if (culture.inoculated && !culture.colonized && !culture.contaminated && !culture.expired && lcRate > 0) {
      const prevPct = Math.floor(culture.colonization || 0);
      culture.colonization = Math.min(100, (culture.colonization || 0) + slowDt * lcRate);
      if (culture.colonization >= 100) {
        culture.colonization = 100;
        culture.colonized = true;
        lcProgressed = true;
        if (item.setVolume) item.setVolume(item.mesh.userData.liquidCtrl.volMl);
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🍄 Cultura Líquida atingiu 100% de colonização! Guarde na geladeira para durar até 90 dias.');
        }
      } else if (Math.floor(culture.colonization) !== prevPct) {
        lcProgressed = true;
        if (item.setVolume) item.setVolume(item.mesh.userData.liquidCtrl.volMl);
      }
    }
    if (changed || tempChanged || lifeStep > 0 || lcProgressed) updateCultureLiquidLabel(item);
    if (lifeStep === 2 && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🕒 A cultura líquida venceu; prepare uma nova cultura.');
    }
    culture.lastRenderedRefrigerated = culture.refrigerated;
    culture.lastRenderedAgeDay = Math.floor(culture.ageGameDays || 0);
  }
}

export function makeCultureFridge(ctx, id, x, y, z) {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.48, metalness: 0.08 });
  const insideMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72 });
  const shelfMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, roughness: 0.36, metalness: 0.48,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0.1, depthWrite: false
  });

  addBox(group, 0.07, FRIDGE_HEIGHT, FRIDGE_DEPTH, shellMat, -0.405, FRIDGE_HEIGHT * 0.5, 0);
  addBox(group, 0.07, FRIDGE_HEIGHT, FRIDGE_DEPTH, shellMat, 0.405, FRIDGE_HEIGHT * 0.5, 0);
  addBox(group, 0.82, 0.08, FRIDGE_DEPTH, shellMat, 0, 0.04, 0);
  const roofBox = addBox(group, 0.82, 0.08, FRIDGE_DEPTH, shellMat, 0, FRIDGE_HEIGHT - 0.04, 0);
  addBox(group, 0.82, FRIDGE_HEIGHT - 0.16, 0.07, insideMat, 0, FRIDGE_HEIGHT * 0.5, -0.325);
  const roofSurface = {
    minX: x - FRIDGE_WIDTH * 0.5 + 0.03,
    maxX: x + FRIDGE_WIDTH * 0.5 - 0.03,
    minZ: z - FRIDGE_DEPTH * 0.5 + 0.03,
    maxZ: z + FRIDGE_DEPTH * 0.5 - 0.03,
    topY: y + FRIDGE_HEIGHT,
    centerX: x,
    centerZ: z,
    halfW: FRIDGE_WIDTH * 0.5 - 0.03,
    halfD: FRIDGE_DEPTH * 0.5 - 0.03,
    ry: 0,
    isFridgeRoof: true
  };
  roofBox.userData.supportSurface = roofSurface;
  ctx.supportSurfaces.push(roofSurface);
  ctx.supportMeshes.push(roofBox);

  const slots = [];
  const shelfSurfaces = [];
  [0.20, 0.61, 1.02, 1.35].forEach(function (shelfTop, shelfIndex) {
    const shelf = addBox(group, 0.68, 0.018, 0.56, shelfMat, 0, shelfTop - 0.009, -0.005);
    const surface = {
      minX: x - 0.34, maxX: x + 0.34,
      minZ: z - 0.285, maxZ: z + 0.275,
      topY: y + shelfTop,
      centerX: x,
      centerZ: z - 0.005,
      halfW: 0.34,
      halfD: 0.28,
      ry: 0,
      localMinX: -0.34, localMaxX: 0.34,
      localMinZ: -0.285, localMaxZ: 0.275,
      localTopY: shelfTop,
      isCultureFridgeShelf: true
    };
    shelfSurfaces.push(surface);
    shelf.userData.supportSurface = surface;
    ctx.supportMeshes.push(shelf);
    ctx.supportSurfaces.push(surface);
    [-0.22, -0.11, 0, 0.11, 0.22].forEach(function (slotX) {
      [-0.10, 0.10].forEach(function (slotZ) {
        slots.push({
          kind: 'petri',
          maxCultureHeight: PETRI_DISH_RADIUS * 1.5,
          localX: slotX,
          localY: shelfTop,
          localZ: slotZ,
          worldPosition: new THREE.Vector3(x + slotX, y + shelfTop, z + slotZ)
        });
      });
    });
    if (shelfIndex < 3) {
      [-0.20, 0, 0.20].forEach(function (slotX) {
        slots.push({
          kind: 'vessel',
          maxCultureHeight: shelfIndex < 2 ? 0.38 : 0.30,
          localX: slotX,
          localY: shelfTop,
          localZ: 0.04,
          worldPosition: new THREE.Vector3(x + slotX, y + shelfTop, z + 0.04)
        });
      });
    }
  });

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-FRIDGE_WIDTH * 0.5, FRIDGE_HEIGHT - 0.09, FRIDGE_DEPTH * 0.5);
  doorPivot.userData.isFridgeDoor = true;
  group.add(doorPivot);
  const doorHeight = FRIDGE_HEIGHT - 0.16;
  const doorWidth = FRIDGE_WIDTH - 0.08;
  const frameB = 0.08;
  const frameTop = 0.11;
  const doorGlassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  addBox(doorPivot, doorWidth, frameTop, 0.055, shellMat, doorWidth * 0.5, -frameTop * 0.5, 0.035);
  addBox(doorPivot, doorWidth, frameB, 0.055, shellMat, doorWidth * 0.5, -doorHeight + frameB * 0.5, 0.035);
  addBox(doorPivot, frameB, doorHeight - frameTop - frameB, 0.055, shellMat, frameB * 0.5, -frameTop - (doorHeight - frameTop - frameB) * 0.5, 0.035);
  addBox(doorPivot, frameB, doorHeight - frameTop - frameB, 0.055, shellMat, doorWidth - frameB * 0.5, -frameTop - (doorHeight - frameTop - frameB) * 0.5, 0.035);
  const glassW = doorWidth - frameB * 2;
  const glassH = doorHeight - frameTop - frameB;
  const doorGlass = addBox(doorPivot, glassW, glassH, 0.014, doorGlassMat, doorWidth * 0.5, -frameTop - glassH * 0.5, 0.038);
  doorGlass.renderOrder = 3;
  const doorHandle = addBox(doorPivot, 0.025, 0.34, 0.04, shelfMat, doorWidth - 0.045, -doorHeight * 0.5, 0.082);
  doorGlass.userData.ignoreRay = true;

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
    roofSurface,
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
  group.userData.twoHanded = true;
  group.userData.fridgeCtrl = fridgeCtrl;
  group.userData.tableDims = { w: FRIDGE_WIDTH, h: FRIDGE_HEIGHT, d: FRIDGE_DEPTH, surfOffset: 0 };
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
  group.userData.dynamicCollider = solidCollider;
  group.userData.dynamicSurfaces = [roofSurface];
  group.userData.updateBounds = updateItemBounds;
  item.fridgeCtrl = fridgeCtrl;
  fridgeCtrl.solidCollider = solidCollider;
  fridgeCtrl.item = item;
  for (let sfi = 0; sfi < shelfSurfaces.length; sfi++) {
    attachSurfaceOwner(shelfSurfaces[sfi], item);
  }
  updateShelfSurfaces(item);
  return item;
}
