import { getItemGroundHeight } from '../engine/physics.js';
import { appState } from '../core/state.js';
import { canPlaceVillageItem } from '../core/village-layout.js';
import { t } from '../core/i18n.js';
import { CRATE_HEIGHT, cratePackMask, positionCrateCargo } from '../systems/crate-cargo.js';
import { isRayOccludedByStructure } from '../systems/ray-occlusion.js';
import { isPointInBoundsXZ, getItemSupportTopOffset, getItemSupportHalfExtents } from '../items/item-registry.js';
import { COOKER_SLOT_OFFSETS, COOKER_SLOT_Y } from '../items/pressure-cooker.js';
import {
  PETRI_DISH_HEIGHT,
  PETRI_STACK_SPACING,
  PETRI_STACK_ALIGNMENT_RADIUS,
  PETRI_STACK_AIM_DISTANCE_SQ
} from '../items/petri-dish.js';
import {
  PP5_STACK_SPACING,
  PP5_STACK_ALIGNMENT_RADIUS,
  PP5_STACK_AIM_DISTANCE_SQ
} from '../items/pp5-cup.js';

const STACK_CFG_PETRI = Object.freeze({
  kind: 'petri',
  spacing: PETRI_STACK_SPACING,
  alignRadius: PETRI_STACK_ALIGNMENT_RADIUS,
  aimDistSq: PETRI_STACK_AIM_DISTANCE_SQ,
  halfHeight: PETRI_DISH_HEIGHT * 0.5,
  maxStack: 7
});

const STACK_CFG_PP5 = Object.freeze({
  kind: 'pp5',
  spacing: PP5_STACK_SPACING,
  alignRadius: PP5_STACK_ALIGNMENT_RADIUS,
  aimDistSq: PP5_STACK_AIM_DISTANCE_SQ,
  halfHeight: PP5_STACK_SPACING * 0.5,
  maxStack: 6
});

const STACK_CFG_CRATE = Object.freeze({
  kind: 'crate',
  spacing: CRATE_HEIGHT,
  alignRadius: 0.11,
  aimDistSq: 0.071,
  halfHeight: CRATE_HEIGHT * 0.5,
  maxStack: 4
});

const STACK_OCCLUSION = { checkWalls: true };

function stackSpacing(item, config) {
  return config.kind === 'crate' ? config.spacing * Math.abs(item.mesh.scale.y) : config.spacing;
}

export function getStackConfig(item) {
  if (!item || !item.mesh) return null;
  if (item.deliveryCrateCtrl) return STACK_CFG_CRATE;
  if (item.mesh.userData && item.mesh.userData.isPetri) return STACK_CFG_PETRI;
  if (item.spawnCtrl && item.spawnCtrl.isPP5) return STACK_CFG_PP5;
  return null;
}

var placementGhost = null;
var placementRing = null;
var placementDot = null;
var placementPin = null;
var placementHoloWrap = null;
var placementHoloMats = [];
var placementGhostItemId = null;
var placementGhostHasLid = false;
var placementGhostCrateMask = 0;
var placementGhostCargo = [];
var placementGhostLastValid = null;

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;

var _cGhostGreenTint = (THREE && THREE.Color) ? new THREE.Color(0x22c55e) : null;
var _cGhostGreenEmi  = (THREE && THREE.Color) ? new THREE.Color(0x10b981) : null;
var _cGhostRedTint   = (THREE && THREE.Color) ? new THREE.Color(0xef4444) : null;
var _cGhostRedEmi    = (THREE && THREE.Color) ? new THREE.Color(0xdc2626) : null;

var _tmpPlacePt = (THREE && THREE.Vector3) ? new THREE.Vector3() : null;
var _tmpBestPt = (THREE && THREE.Vector3) ? new THREE.Vector3() : null;
var _tmpPlaceCenter = (THREE && THREE.Vector3) ? new THREE.Vector3() : null;
var _vZero2 = (THREE && THREE.Vector2) ? new THREE.Vector2(0, 0) : null;

var placementBlockedReason = '';
var lastGravityCheckAt = 0;
var hasFallingItems = true;

export function markItemsFalling() {
  hasFallingItems = true;
}

export function getPlacementGhost() {
  return placementGhost;
}

export function getPlacementBlockedReason() {
  return placementBlockedReason;
}

/**
 * Indica se o item segurado deve ser ocultado da mão durante o modo posicionamento [G],
 * evitando que equipamentos e itens bloqueiem o campo de visão e o fantasma.
 */
export function shouldHideHeldInPlacementMode(ctx) {
  return !!(ctx?.placementMode && ctx.heldItem && ctx.placementGhost?.visible);
}

export function createPlacementGhost(scene) {
  placementGhost = new THREE.Group();
  placementGhost.name = 'PlacementGhost';
  placementGhostItemId = null;
  placementGhostHasLid = false;
  placementGhostCrateMask = 0;
  placementGhostCargo.length = 0;
  placementGhostLastValid = null;
  placementHoloMats = [];
  placementRing = new THREE.Mesh(
    new THREE.RingGeometry(0.128, 0.154, 32),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  placementRing.rotation.x = -Math.PI / 2;
  placementRing.position.y = 0.045;
  placementGhost.add(placementRing);

  placementDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.014, 24),
    new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
  );
  placementDot.rotation.x = -Math.PI / 2;
  placementDot.position.y = 0.046;
  placementGhost.add(placementDot);

  placementPin = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), placementRing.material);
  placementPin.position.y = 0.19;
  placementGhost.add(placementPin);

  placementHoloWrap = new THREE.Group();
  placementHoloWrap.position.y = 0.036;
  placementGhost.add(placementHoloWrap);

  placementGhost.visible = false;
  scene.add(placementGhost);
  return placementGhost;
}

function isInvisibleGhostMaterial(mat) {
  if (!mat) return true;
  if (Array.isArray(mat)) {
    return mat.length === 0 || mat.every(isInvisibleGhostMaterial);
  }
  return mat.visible === false || mat.colorWrite === false || (!!mat.transparent && (mat.opacity || 0) <= 0.02);
}

function cloneGhostMaterial(origM, matList) {
  if (origM.visible === false || origM.colorWrite === false || (origM.transparent && (origM.opacity || 0) <= 0.02)) {
    var hiddenM = origM.clone();
    hiddenM.visible = false;
    hiddenM.opacity = 0;
    hiddenM.colorWrite = false;
    hiddenM.depthWrite = false;
    matList.push(hiddenM);
    return hiddenM;
  }
  var m = origM.clone();
  m.userData._baseColor = m.color ? m.color.clone() : new THREE.Color(0xffffff);
  m.transparent = true;
  var origOp = origM.transparent ? origM.opacity : 1.0;
  m.opacity = origM.transparent ? Math.max(0.38, origOp * 0.90) : 0.76;
  m.depthWrite = false;
  matList.push(m);
  return m;
}

/**
 * Clona apenas a hierarquia visual do item para o fantasma de posicionamento sem
 * serializar `userData` via JSON (evita crash em referências circulares como `ownerItem`).
 */
function cloneVisualGroupForGhost(src, matList, isRoot) {
  if (!src) return null;
  if (!isRoot && (src.userData.hideInPlacement || (!src.visible && !src.userData.visibleInPlacement) || src.isPoints || src.isLine || src.isSprite || src.isLight)) {
    return null;
  }

  var dst = null;
  if (src.isMesh && src.material) {
    if (isInvisibleGhostMaterial(src.material)) return null;
    var clonedMat = Array.isArray(src.material)
      ? src.material.map(function (m) { return cloneGhostMaterial(m, matList); })
      : cloneGhostMaterial(src.material, matList);
    if (src.isInstancedMesh) {
      dst = new THREE.InstancedMesh(src.geometry, clonedMat, src.count);
      dst.instanceMatrix.copy(src.instanceMatrix);
      if (src.instanceColor) dst.instanceColor = src.instanceColor.clone();
    } else {
      dst = new THREE.Mesh(src.geometry, clonedMat);
    }
    dst.castShadow = false;
    dst.receiveShadow = false;
  } else {
    dst = new THREE.Group();
  }

  if (src.position && dst.position) dst.position.copy(src.position);
  if (src.quaternion && dst.quaternion && typeof dst.quaternion.copy === 'function') {
    dst.quaternion.copy(src.quaternion);
  } else if (src.rotation && dst.rotation && typeof dst.rotation.copy === 'function') {
    dst.rotation.copy(src.rotation);
  }
  if (src.scale && dst.scale && typeof dst.scale.copy === 'function') {
    dst.scale.copy(src.scale);
  }
  dst.visible = true;
  dst.matrixAutoUpdate = true;
  dst.frustumCulled = false;
  dst.userData = { ignoreRay: true };

  if (src.children && src.children.length) {
    for (var i = 0; i < src.children.length; i++) {
      var childClone = cloneVisualGroupForGhost(src.children[i], matList, false);
      if (childClone) dst.add(childClone);
    }
  }
  return dst;
}

export function updatePlacementGhostVisual(item, isValid, rotY, elapsedTime) {
  if (!placementGhost || !item) return;
  placementGhost.matrixAutoUpdate = true;
  if (placementRing) placementRing.matrixAutoUpdate = true;
  if (placementDot) placementDot.matrixAutoUpdate = true;
  if (placementHoloWrap) placementHoloWrap.matrixAutoUpdate = true;
  var hasLid = !!(item.lidItem && item.lidItem.isAttached);
  const cargo = item.deliveryCrateCtrl ? item.trayContents : null;
  const crateMask = item.deliveryCrateCtrl ? cratePackMask(item) : 0;
  const cargoCount = cargo?.length || 0;
  let cargoChanged = placementGhostCargo.length !== cargoCount || crateMask !== placementGhostCrateMask;
  for (let i = 0; !cargoChanged && i < cargoCount; i++) {
    const previous = placementGhostCargo[i];
    cargoChanged = previous.item !== cargo[i].item || previous.slot !== cargo[i].item.crateCargo?.slot;
  }
  if (placementGhostItemId !== item.id || placementGhostHasLid !== hasLid || cargoChanged) {
    while (placementHoloWrap.children.length > 0) {
      placementHoloWrap.remove(placementHoloWrap.children[0]);
    }
    for (var mi = 0; mi < placementHoloMats.length; mi++) {
      if (placementHoloMats[mi] && placementHoloMats[mi].dispose) {
        placementHoloMats[mi].dispose();
      }
    }
    placementHoloMats = [];
    var clone = cloneVisualGroupForGhost(item.mesh, placementHoloMats, true);
    if (clone) {
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      if (item.wildMushroomCtrl && clone.children && clone.children[0]) {
        clone.children[0].rotation.z = Math.PI / 2;
        clone.children[0].position.y = item.wildMushroomCtrl.sideRestY ?? 0.05;
      }
      clone.visible = true;
      placementHoloWrap.add(clone);
    }

    placementGhostCargo.length = 0;
    for (let i = 0; i < cargoCount; i++) {
      const { item: content, localOffset } = cargo[i];
      placementGhostCargo.push({ item: content, slot: content.crateCargo?.slot });
      const cargoClone = cloneVisualGroupForGhost(content.mesh, placementHoloMats, true);
      if (!cargoClone) continue;
      // Cargo is a separate world object. Scale its offset with the crate,
      // while preserving the scale of its own mesh.
      cargoClone.position.copy(localOffset).multiply(item.mesh.scale);
      cargoClone.rotation.set(0, 0, 0);
      placementHoloWrap.add(cargoClone);
    }

    if (hasLid && item.lidItem && item.lidItem.mesh) {
      var lidClone = cloneVisualGroupForGhost(item.lidItem.mesh, placementHoloMats, true);
      if (lidClone) {
        lidClone.position.set(0, 0.36, 0);
        lidClone.rotation.set(0, 0, 0);
        lidClone.visible = true;
        placementHoloWrap.add(lidClone);
      }
    }

    placementGhostItemId = item.id;
    placementGhostHasLid = hasLid;
    placementGhostCrateMask = crateMask;
    placementGhostLastValid = null;
  }
  var col = isValid ? 0x10b981 : 0xef4444;
  placementRing.material.color.setHex(col);
  placementDot.material.color.setHex(col);

  var tintCol = isValid ? _cGhostGreenTint : _cGhostRedTint;
  var emiCol = isValid ? _cGhostGreenEmi : _cGhostRedEmi;
  var tintRatio = isValid ? 0.74 : 0.82;
  var pulse = 0.52 + Math.sin(elapsedTime * 6.0) * 0.16;

  if (placementGhostLastValid !== isValid) {
    placementGhostLastValid = isValid;
    for (var i = 0; i < placementHoloMats.length; i++) {
      var m = placementHoloMats[i];
      if (m.color && m.userData._baseColor) {
        m.color.copy(m.userData._baseColor).lerp(tintCol, tintRatio);
      }
      if (m.emissive) {
        m.emissive.copy(emiCol);
      }
    }
  }

  for (var j = 0; j < placementHoloMats.length; j++) {
    if (placementHoloMats[j].emissive) {
      placementHoloMats[j].emissiveIntensity = pulse;
    }
  }

  placementHoloWrap.rotation.y = rotY;
  var ringPulse = Math.max(1, Math.min(4.5, (item.radius || 0) / 0.154)) * (1 + Math.sin(elapsedTime * 5.0) * 0.025);
  placementRing.scale.set(ringPulse, ringPulse, 1);
  placementPin.position.y = Math.max(0.19, (item.height || 0) + 0.08);
}

function isSurfaceOwnerHeld(ctx, surf) {
  if (!surf || !surf.ownerItem) return false;
  if (ctx.heldItem && surf.ownerItem === ctx.heldItem) return true;
  if (ctx.isHeldByRemote && ctx.isHeldByRemote(surf.ownerItem.id)) return true;
  return false;
}

function isClosedFridgeShelf(surf) {
  return !!(surf && surf.isCultureFridgeShelf && surf.ownerItem && surf.ownerItem.fridgeCtrl && !surf.ownerItem.fridgeCtrl.doorOpen);
}

export function clampPointToSurfaceXZ(x, z, surf, topY, outPt) {
  if (typeof surf.halfW === 'number' && typeof surf.halfD === 'number' &&
      typeof surf.centerX === 'number' && typeof surf.centerZ === 'number' && surf.ry) {
    var dx = x - surf.centerX;
    var dz = z - surf.centerZ;
    var cosR = Math.cos(surf.ry);
    var sinR = Math.sin(surf.ry);
    var lx = dx * cosR - dz * sinR;
    var lz = dx * sinR + dz * cosR;
    var maxW = Math.max(0.01, surf.halfW - 0.02);
    var maxD = Math.max(0.01, surf.halfD - 0.02);
    lx = Math.max(-maxW, Math.min(maxW, lx));
    lz = Math.max(-maxD, Math.min(maxD, lz));
    var wx = surf.centerX + lx * cosR + lz * sinR;
    var wz = surf.centerZ - lx * sinR + lz * cosR;
    return outPt.set(wx, topY, wz);
  }
  var cx = Math.max(surf.minX + 0.02, Math.min(surf.maxX - 0.02, x));
  var cz = Math.max(surf.minZ + 0.02, Math.min(surf.maxZ - 0.02, z));
  return outPt.set(cx, topY, cz);
}

var _tmpItemSurf = {
  minX: 0, maxX: 0, minZ: 0, maxZ: 0,
  topY: 0, centerX: 0, centerZ: 0, halfW: 0, halfD: 0, ry: 0
};
var _sortedGravityIndices = [];
var _cookerContentSet = new Set();
const gravityFridges = [];
const gravitySupports = [];
const gravityStacks = { petri: [], pp5: [], crate: [] };

function buildItemTopSurface(item, outSurf) {
  var topOff = getItemSupportTopOffset(item);
  if (topOff <= 0) return null;
  var ext = getItemSupportHalfExtents(item);
  var p = item.mesh.position;
  var hwW = Math.max(0.02, ext.w * 0.5);
  var hdD = Math.max(0.02, ext.d * 0.5);
  outSurf.centerX = p.x;
  outSurf.centerZ = p.z;
  outSurf.halfW = hwW;
  outSurf.halfD = hdD;
  outSurf.ry = (item.mesh.rotation && item.mesh.rotation.y) || 0;
  outSurf.minX = p.x - ext.hw;
  outSurf.maxX = p.x + ext.hw;
  outSurf.minZ = p.z - ext.hd;
  outSurf.maxZ = p.z + ext.hd;
  outSurf.topY = p.y + topOff;
  return outSurf;
}

function isPlacementExcludedItem(ctx, heldItem, cand) {
  if (!cand || !cand.mesh || cand.mesh.visible === false) return true;
  if (cand === heldItem) return true;
  if (heldItem) {
    if (heldItem.lidItem && cand === heldItem.lidItem) return true;
    if (heldItem.potItem && cand === heldItem.potItem) return true;
    if (heldItem.trayContents && heldItem.trayContents.some(function (tc) { return tc.item === cand; })) return true;
  }
  if (cand.isAttached && cand.potItem) return true;
  if (ctx.isHeldByRemote && ctx.isHeldByRemote(cand.id)) return true;
  return false;
}

function findClosestItemSupportHit(ctx, raycaster, heldItem, maxDist, origin) {
  var items = ctx.pickableItems;
  if (!items || !items.length) return null;
  var bestHit = null;
  var bestItem = null;
  var bestDist = maxDist;

  for (var i = 0; i < items.length; i++) {
    var cand = items[i];
    if (isPlacementExcludedItem(ctx, heldItem, cand)) continue;
    var topOff = getItemSupportTopOffset(cand);
    if (topOff <= 0) continue;
    if (heldItem && heldItem.mesh && (heldItem.mesh.userData.isTable || heldItem.mesh.userData.isHood || heldItem.mesh.userData.isCultureFridge)) continue;
    if (origin.distanceToSquared(cand.mesh.position) > 36) continue;
    if (raycaster.ray.distanceSqToPoint(cand.mesh.position) > 1.2) continue;

    if (cand.mesh.updateWorldMatrix) cand.mesh.updateWorldMatrix(true, true);
    var hits = raycaster.intersectObject(cand.mesh, true);
    for (var hi = 0; hi < hits.length; hi++) {
      var h = hits[hi];
      if (!h || h.distance < 0.02 || h.distance >= bestDist) continue;
      if (h.object && h.object.userData && (h.object.userData.ignoreRay || isInvisibleGhostMaterial(h.object.material))) continue;
      bestDist = h.distance;
      bestHit = h;
      bestItem = cand;
      break;
    }
  }
  if (!bestHit || !bestItem) return null;
  return { hit: bestHit, item: bestItem, dist: bestDist };
}

function snapToFalconSlot(ctx, surface, point, out) {
  const rack = surface.ownerItem?.mesh;
  if (!rack || !surface.falconSlots || !ctx.heldItem?.mesh.userData.isFalconTube) return false;
  let nearestSq = Infinity;
  for (const slot of surface.falconSlots) {
    rack.localToWorld(_tmpPlaceCenter.copy(slot));
    const dx = _tmpPlaceCenter.x - point.x;
    const dz = _tmpPlaceCenter.z - point.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestSq) {
      nearestSq = distanceSq;
      out.copy(_tmpPlaceCenter);
    }
  }
  return Number.isFinite(nearestSq);
}

export function findPlacementTarget(ctx, customNdc) {
  var heldItem = ctx.heldItem;
  var cookerPots = ctx.cookerPots;
  var pickableItems = ctx.pickableItems;
  var supportMeshes = ctx.supportMeshes;
  var supportSurfaces = ctx.supportSurfaces;
  var raycaster = ctx.raycaster;
  var camera = ctx.camera;
  var playerPos = ctx.playerPos;
  var physCtx = ctx.physCtx;

  ctx.setSnapClosePot(null);
  ctx.setSnapPetriStack(false);
  ctx.setSnapCrateStack?.(0);

  var rayNdc = customNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc);
  raycaster.setFromCamera(rayNdc, camera);
  var dir = raycaster.ray.direction;
  var origin = raycaster.ray.origin;
  var bestPt = null;
  var bestT = Infinity;

  // 0. Tampa de Panela -> Panela aberta
  if (heldItem && heldItem.potItem) {
    for (var cpi = 0; cpi < cookerPots.length; cpi++) {
      var cp = cookerPots[cpi];
      var targetPot = cp.potItem;
      if (targetPot.lidItem && targetPot.lidItem.isAttached && targetPot.lidItem !== heldItem) continue;
      _tmpPlaceCenter.set(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.24, targetPot.mesh.position.z);
      var camDist = origin.distanceTo(_tmpPlaceCenter);
      var potHits = raycaster.intersectObject(targetPot.mesh, true).filter(function (h) {
        return !h.object.userData || !h.object.userData.ignoreRay;
      });
      if (potHits.length > 0 && potHits[0].distance < 4.5) {
        ctx.setSnapClosePot(targetPot);
        ctx.setHeldRotY(targetPot.mesh.rotation.y);
        return _tmpPlacePt.set(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.36, targetPot.mesh.position.z);
      }
    }
  }

  // 0b. Pilhas de placas, potes PP5 e caixas de transporte.
  var stackCfg = getStackConfig(heldItem);
  if (stackCfg) {
    var stackBest = null;
    var stackDist = 4.2;
    for (var pi = 0; pi < pickableItems.length; pi++) {
      var cand = pickableItems[pi];
      if (isPlacementExcludedItem(ctx, heldItem, cand) || cand.crateParent) continue;
      var candCfg = getStackConfig(cand);
      if (!candCfg || candCfg.kind !== stackCfg.kind) continue;
      if (ctx.isHeldByRemote(cand.id)) continue;
      var cpos = cand.mesh.position;
      _tmpPlaceCenter.set(cpos.x, cpos.y + stackCfg.halfHeight, cpos.z);
      var dCam = origin.distanceTo(_tmpPlaceCenter);
      if (dCam < stackDist && raycaster.ray.distanceSqToPoint(_tmpPlaceCenter) < stackCfg.aimDistSq) {
        if (stackCfg.kind === 'crate' && isRayOccludedByStructure(ctx, dCam, STACK_OCCLUSION)) continue;
        stackDist = dCam;
        stackBest = cand;
      }
    }
    if (stackBest) {
      var bx = stackBest.mesh.position.x;
      var bz = stackBest.mesh.position.z;
      var stackCount = 0;
      var maxY = stackBest.mesh.position.y;
      var stackTop = stackBest;
      for (var pj = 0; pj < pickableItems.length; pj++) {
        var pOther = pickableItems[pj];
        if (isPlacementExcludedItem(ctx, heldItem, pOther) || pOther.crateParent) continue;
        var pOtherCfg = getStackConfig(pOther);
        if (!pOtherCfg || pOtherCfg.kind !== stackCfg.kind) continue;
        if (stackCfg.kind === 'crate' && Math.abs(pOther.mesh.position.y - stackBest.mesh.position.y) > stackCfg.spacing * stackCfg.maxStack + 0.04) continue;
        if (Math.hypot(pOther.mesh.position.x - bx, pOther.mesh.position.z - bz) < stackCfg.alignRadius) {
          stackCount++;
          if (pOther.mesh.position.y > maxY) {
            maxY = pOther.mesh.position.y;
            stackTop = pOther;
          }
        }
      }
      if (stackCfg.kind === 'crate') {
        ctx.setSnapCrateStack?.(stackCount + 1);
        ctx.setSnapPetriStack(true);
        ctx.setHeldRotY(stackTop.mesh.rotation.y);
        return _tmpPlacePt.set(stackTop.mesh.position.x, maxY + stackSpacing(stackTop, stackCfg), stackTop.mesh.position.z);
      }
      if (stackCount < stackCfg.maxStack) {
        ctx.setSnapPetriStack(true);
        return _tmpPlacePt.set(bx, maxY + stackCfg.spacing, bz);
      }
    }
  }

  // 1. Raycast mais próximo nos suportes oficiais (mesas, bancadas, prateleiras, bandeja, fogareiro, balança, agitador)
  var bestSupportHit = null;
  var bestSupportSurf = null;
  var bestSupportDist = 5.8;
  if (supportMeshes.length) {
    for (var sm = 0; sm < supportMeshes.length; sm++) {
      if (supportMeshes[sm] && supportMeshes[sm].updateWorldMatrix) supportMeshes[sm].updateWorldMatrix(true, false);
    }
    var sHits = raycaster.intersectObjects(supportMeshes, false);
    for (var si = 0; si < sHits.length; si++) {
      var sh = sHits[si];
      if (sh.distance < 0.02 || sh.distance >= bestSupportDist) continue;
      if (sh.object.userData.ignoreRay) continue;
      var sSurf = sh.object.userData.supportSurface;
      if (!sSurf || isSurfaceOwnerHeld(ctx, sSurf)) continue;
      if (sSurf.isCabinetShelf && sSurf.requiresOpenPart && !sSurf.requiresOpenPart.open) continue;
      if (isClosedFridgeShelf(sSurf)) continue;
      if (heldItem && heldItem.mesh) {
        if (heldItem.mesh.userData.dynamicSurface === sSurf) continue;
        if (Array.isArray(heldItem.mesh.userData.dynamicSurfaces) && heldItem.mesh.userData.dynamicSurfaces.indexOf(sSurf) !== -1) continue;
        if (heldItem.mesh === sh.object || heldItem.mesh.getObjectById(sh.object.id)) continue;
      }
      bestSupportDist = sh.distance;
      bestSupportHit = sh;
      bestSupportSurf = sSurf;
      break;
    }
  }

  if (bestSupportHit && bestSupportSurf) {
    if (snapToFalconSlot(ctx, bestSupportSurf, bestSupportHit.point, _tmpPlacePt)) return _tmpPlacePt;
    return clampPointToSurfaceXZ(bestSupportHit.point.x, bestSupportHit.point.z, bestSupportSurf, bestSupportSurf.topY, _tmpPlacePt);
  }

  // 1b. Interseção matemática com plano e volume de suportes (inclusive bordas/saias frontais de mesas e cômodas)
  var bestFallbackSurface = null;
  for (var i = 0; i < supportSurfaces.length; i++) {
    var s = supportSurfaces[i];
    if (isSurfaceOwnerHeld(ctx, s)) continue;
    if (heldItem && heldItem.mesh) {
      if (heldItem.mesh.userData.dynamicSurface === s) continue;
      if (Array.isArray(heldItem.mesh.userData.dynamicSurfaces) && heldItem.mesh.userData.dynamicSurfaces.indexOf(s) !== -1) continue;
    }
    if (s.isCabinetShelf && s.requiresOpenPart && !s.requiresOpenPart.open) continue;
    if (isClosedFridgeShelf(s)) continue;

    var dy = s.topY - origin.y;
    if (Math.abs(dir.y) > 0.001) {
      var tPlane = dy / dir.y;
      if (tPlane >= 0.05 && tPlane <= 5.8 && tPlane < bestT) {
        var hx = origin.x + dir.x * tPlane;
        var hz = origin.z + dir.z * tPlane;
        if (isPointInBoundsXZ(hx, hz, s, 0.14)) {
          bestT = tPlane;
          bestFallbackSurface = s;
          bestPt = clampPointToSurfaceXZ(hx, hz, s, s.topY, _tmpBestPt);
        }
      }
    }

    var isInternalCompartment = !!(s.isCabinetShelf || s.isCultureFridgeShelf);
    var bMinX = s.minX - 0.10, bMaxX = s.maxX + 0.10;
    var bMinZ = s.minZ - 0.10, bMaxZ = s.maxZ + 0.10;
    var bMinY = isInternalCompartment ? (s.topY - 0.14) : Math.max(0.0, s.topY - 0.96);
    var bMaxY = s.topY + 0.10;
    var invDx = 1 / (Math.abs(dir.x) > 1e-6 ? dir.x : 1e-6);
    var invDy = 1 / (Math.abs(dir.y) > 1e-6 ? dir.y : 1e-6);
    var invDz = 1 / (Math.abs(dir.z) > 1e-6 ? dir.z : 1e-6);
    var t1 = (bMinX - origin.x) * invDx, t2 = (bMaxX - origin.x) * invDx;
    var t3 = (bMinY - origin.y) * invDy, t4 = (bMaxY - origin.y) * invDy;
    var t5 = (bMinZ - origin.z) * invDz, t6 = (bMaxZ - origin.z) * invDz;
    var tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    var tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
    if (tmax >= tmin && tmax >= 0.05 && tmin <= 5.5 && tmin < bestT) {
      var boxHitX = origin.x + dir.x * Math.max(0.05, tmin);
      var boxHitZ = origin.z + dir.z * Math.max(0.05, tmin);
      if (isPointInBoundsXZ(boxHitX, boxHitZ, s, 0.14)) {
        bestT = tmin;
        bestFallbackSurface = s;
        bestPt = clampPointToSurfaceXZ(boxHitX, boxHitZ, s, s.topY, _tmpBestPt);
      }
    }
  }
  if (bestPt) {
    if (snapToFalconSlot(ctx, bestFallbackSurface, bestPt, _tmpPlacePt)) return _tmpPlacePt;
    return _tmpPlacePt.copy(bestPt);
  }

  // 2. Piso / terreno
  for (var t = 0.45; t <= 5.0; t += 0.08) {
    var px = origin.x + dir.x * t;
    var py = origin.y + dir.y * t;
    var pz = origin.z + dir.z * t;
    var gh = getItemGroundHeight(physCtx, px, pz, py);
    if (py <= gh + 0.04) {
      return _tmpPlacePt.set(px, gh, pz);
    }
  }

  // 3. Fallback suave
  var hLen = Math.hypot(dir.x, dir.z) || 1;
  var fx = playerPos.x + (dir.x / hLen) * 3.2;
  var fz = playerPos.z + (dir.z / hLen) * 3.2;
  return _tmpPlacePt.set(fx, getItemGroundHeight(physCtx, fx, fz, playerPos.y), fz);
}

export function isPlacementBlocked(ctx, pt) {
  placementBlockedReason = '';
  var heldItem = ctx.heldItem;
  if (!heldItem || !heldItem.mesh) return false;
  if (!canPlaceVillageItem(pt.x, pt.z, heldItem, appState.villageLease)) {
    placementBlockedReason = t('village.placement_locked');
    return true;
  }
  if (ctx.snapCrateStack > STACK_CFG_CRATE.maxStack) {
    placementBlockedReason = t('crate.stack_full');
    return true;
  }
  if (ctx.snapClosePot || (ctx.snapPetriStack && !ctx.snapCrateStack)) return false;

  var heldH = heldItem.height || (heldItem.mesh.userData.tableDims ? heldItem.mesh.userData.tableDims.h : 0.32);
  var heldMinY = pt.y;
  var heldMaxY = pt.y + heldH;

  if (ctx.supportSurfaces) {
    for (var csi = 0; csi < ctx.supportSurfaces.length; csi++) {
      var cs = ctx.supportSurfaces[csi];
      if (!cs.isCabinetShelf && !cs.isCultureFridgeShelf) continue;
      if (pt.x >= cs.minX - 0.05 && pt.x <= cs.maxX + 0.05 &&
          pt.z >= cs.minZ - 0.05 && pt.z <= cs.maxZ + 0.05 &&
          Math.abs(pt.y - cs.topY) < 0.12) {
        var hUdCab = heldItem.mesh.userData;
        if (cs.isCultureFridgeShelf) {
          if (cs.ownerItem && cs.ownerItem.fridgeCtrl && !cs.ownerItem.fridgeCtrl.doorOpen) {
            placementBlockedReason = '🚫 Abra a porta da geladeira para guardar itens dentro';
            return true;
          }
          var isCultureItem = !!(heldItem.cultureCtrl || heldItem.spawnCtrl || heldItem.pdaMediumCtrl ||
            (hUdCab && (hUdCab.isPetri || hUdCab.cultureCtrl || hUdCab.isSyringe || hUdCab.vial3mlCtrl)));
          if (!isCultureItem) {
            placementBlockedReason = '🚫 Apenas culturas podem ser guardadas na geladeira!';
            return true;
          }
          break;
        }
        if (cs.requiresOpenPart && !cs.requiresOpenPart.open) {
          placementBlockedReason = '🚫 Abra a porta do armário para guardar itens dentro';
          return true;
        }
        if (hUdCab.isTable || hUdCab.isHood || hUdCab.isCultureFridge || hUdCab.twoHanded || heldH > 0.35) {
          placementBlockedReason = '🚫 Objeto grande demais para guardar dentro do armário';
          return true;
        }
        break;
      }
    }
  }

  var heldIsBox = !!(heldItem.mesh.userData.tableDims);
  var heldHw = 0, heldHd = 0, heldRad = 0;
  if (heldIsBox) {
    var dims = heldItem.mesh.userData.tableDims;
    var cRot = Math.abs(Math.cos(ctx.heldRotY)), sRot = Math.abs(Math.sin(ctx.heldRotY));
    heldHw = (dims.w * cRot + dims.d * sRot) * 0.5;
    heldHd = (dims.w * sRot + dims.d * cRot) * 0.5;
    heldRad = Math.max(heldHw, heldHd);
  } else {
    heldRad = heldItem.radius || 0.16;
    heldHw = heldRad;
    heldHd = heldRad;
  }

  var pickableItems = ctx.pickableItems;
  for (var k = 0; k < pickableItems.length; k++) {
    var other = pickableItems[k];
    if (!other || !other.mesh) continue;
    if (other === heldItem || other.crateParent) continue;
    if (heldItem.lidItem && other === heldItem.lidItem) continue;
    if (heldItem.potItem && other === heldItem.potItem) continue;
    if (other.isAttached && other.potItem) continue;
    if (heldItem.trayContents && heldItem.trayContents.some(function (tc) { return tc.item === other; })) continue;
    if (ctx.isHeldByRemote(other.id)) continue;

    var oPos = other.mesh.position;
    var otherH = other.height || (other.mesh.userData.tableDims ? other.mesh.userData.tableDims.h : 0.32);
    var otherMinY = oPos.y;
    var otherMaxY = oPos.y + otherH;

    if (other.mesh.userData.dynamicSurface) {
      var dynSurf = other.mesh.userData.dynamicSurface;
      var onDynSurfXZ = isPointInBoundsXZ(pt.x, pt.z, dynSurf, 0.08);
      if (onDynSurfXZ && pt.y >= dynSurf.topY - 0.06 && pt.y <= dynSurf.topY + 0.14) {
        if (other.mesh.userData.isTable && heldItem.mesh.userData.isTable) {
          placementBlockedReason = '🚫 Não é permitido sobrepor mesas';
          return true;
        }
        if (other.mesh.userData.isHood && heldItem.mesh.userData.isTable) {
          placementBlockedReason = '🚫 Não cabe aqui';
          return true;
        }
        if (other.mesh.userData.isScale || other.mesh.userData.isStirrer || other.mesh.userData.isBurner) {
          var hUd = heldItem.mesh.userData;
          if (hUd.isTable || hUd.isHood || hUd.isScale || hUd.isStirrer || hUd.isBurner) {
            placementBlockedReason = '🚫 Equipamento incompatível com esta superfície';
            return true;
          }
          if ((other.mesh.userData.isScale || other.mesh.userData.isStirrer) && hUd.twoHanded) {
            placementBlockedReason = '🚫 Objeto grande demais para este aparelho';
            return true;
          }
        }
        continue;
      }
    }

    if (other.fridgeCtrl) {
      var fShelves = other.fridgeCtrl.shelfSurfaces;
      var onFridgeShelf = false;
      if (fShelves) {
        for (var sfi = 0; sfi < fShelves.length; sfi++) {
          var fs = fShelves[sfi];
          if (pt.x >= fs.minX - 0.05 && pt.x <= fs.maxX + 0.05 &&
              pt.z >= fs.minZ - 0.05 && pt.z <= fs.maxZ + 0.05 &&
              Math.abs(pt.y - fs.topY) < 0.10) {
            onFridgeShelf = true;
            break;
          }
        }
      }
      if (onFridgeShelf) {
        if (!other.fridgeCtrl.doorOpen) {
          placementBlockedReason = '🚫 Abra a porta da geladeira para colocar itens dentro';
          return true;
        }
        var hUdFridge = heldItem.mesh.userData;
        if (hUdFridge.isTable || hUdFridge.isHood || hUdFridge.isCultureFridge || (heldItem.height && heldItem.height > 0.40)) {
          placementBlockedReason = '🚫 Objeto grande demais para a prateleira da geladeira';
          return true;
        }
        continue;
      }
    }

    if (heldMinY >= otherMaxY - 0.025 || heldMaxY <= otherMinY + 0.02) {
      continue;
    }

    if (!heldIsBox && !other.mesh.userData.tableDims) {
      var oRad = other.radius || 0.16;
      var minDist = Math.max(0.08, (heldRad + oRad) * 0.68);
      var dx = pt.x - oPos.x;
      var dz = pt.z - oPos.z;
      if (dx * dx + dz * dz < minDist * minDist) {
        placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
        return true;
      }
    } else {
      var oHw, oHd;
      if (other.mesh.userData.tableDims) {
        var od = other.mesh.userData.tableDims;
        var oc = Math.abs(Math.cos(other.mesh.rotation.y)), os = Math.abs(Math.sin(other.mesh.rotation.y));
        oHw = (od.w * oc + od.d * os) * 0.5;
        oHd = (od.w * os + od.d * oc) * 0.5;
      } else {
        var oR = other.radius || 0.16;
        oHw = oR * 0.90;
        oHd = oR * 0.90;
      }
      var cW = (heldHw + oHw) * 0.93;
      var cD = (heldHd + oHd) * 0.93;
      if (Math.abs(pt.x - oPos.x) < cW && Math.abs(pt.z - oPos.z) < cD) {
        placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
        return true;
      }
    }
  }

  if (pt.y > 3.2) return false;
  // Itens/equipamentos apoiados em bancadas/estantes/aparadores já encostados na parede (exceto mesas/capelas grandes) não são bloqueados pela parede atrás
  var onSupportedBench = false;
  var isLargeFurniture = !!(heldItem.mesh.userData.isTable || heldItem.mesh.userData.isHood || heldItem.mesh.userData.isCultureFridge);
  if (ctx.supportSurfaces && !isLargeFurniture) {
    for (var sbi = 0; sbi < ctx.supportSurfaces.length; sbi++) {
      var ssB = ctx.supportSurfaces[sbi];
      if (isSurfaceOwnerHeld(ctx, ssB)) continue;
      if (ssB.topY > 0.20 && isPointInBoundsXZ(pt.x, pt.z, ssB, 0.06) && pt.y >= ssB.topY - 0.08 && pt.y <= ssB.topY + 1.2) {
        onSupportedBench = true;
        break;
      }
    }
  }
  if (onSupportedBench) return false;

  var wallSegments = ctx.wallSegments;
  for (var wIdx = 0; wIdx < wallSegments.length; wIdx++) {
    var w = wallSegments[wIdx];
    if (typeof w.minY === 'number' && typeof w.maxY === 'number' && (heldMaxY <= w.minY || heldMinY >= w.maxY)) continue;
    var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
    var len2 = vx * vx + vz * vz;
    if (len2 < 1e-6) continue;
    var wallFraction = Math.max(0, Math.min(1, ((pt.x - w.x1) * vx + (pt.z - w.z1) * vz) / len2));
    var dist = Math.hypot(pt.x - (w.x1 + wallFraction * vx), pt.z - (w.z1 + wallFraction * vz));
    var effectiveHalf = heldIsBox ? Math.min(heldHw, heldHd) : heldRad;
    var minWallDist = Math.max(0.16, effectiveHalf * 0.78 + 0.08);
    if (dist < minWallDist) {
      placementBlockedReason = '🚫 Muito próximo da parede';
      return true;
    }
  }

  return false;
}

export function dropUnsupportedItems(ctx) {
  var now = performance.now();
  var isDirty = hasFallingItems || !!(ctx && ctx._stackPhysicsDirty);
  if (!isDirty && now - lastGravityCheckAt < 750) return;
  lastGravityCheckAt = now;
  var anyFalling = false;
  var pickableItems = ctx.pickableItems;
  var cookerPots = ctx.cookerPots;
  var supportSurfaces = ctx.supportSurfaces;
  var recentlyDropped = ctx.recentlyDropped;
  var pendingMovedItems = ctx.pendingMovedItems;
  var heldItem = ctx.heldItem;
  var physCtx = ctx.physCtx;

  // Ordena indices por altura crescente para resolver pilhas (mesa -> caixa -> item) em passada única
  _sortedGravityIndices.length = pickableItems.length;
  for (var si = 0; si < pickableItems.length; si++) _sortedGravityIndices[si] = si;
  _sortedGravityIndices.sort(function (a, b) {
    var ya = pickableItems[a] && pickableItems[a].mesh ? pickableItems[a].mesh.position.y : 0;
    var yb = pickableItems[b] && pickableItems[b].mesh ? pickableItems[b].mesh.position.y : 0;
    return ya - yb;
  });

  // Itens dentro de uma panela (base 4cm, potes) seguem a panela e NUNCA podem servir de apoio para ela
  _cookerContentSet.clear();
  for (var ccp = 0; ccp < cookerPots.length; ccp++) {
    var ccContents = cookerPots[ccp] && cookerPots[ccp].contents;
    if (!ccContents) continue;
    for (var ccc = 0; ccc < ccContents.length; ccc++) {
      if (ccContents[ccc]) _cookerContentSet.add(ccContents[ccc]);
    }
  }

  // Classify support candidates once. Most loose items cannot support another item.
  gravityFridges.length = 0;
  gravitySupports.length = 0;
  gravityStacks.petri.length = 0;
  gravityStacks.pp5.length = 0;
  gravityStacks.crate.length = 0;
  for (let i = 0; i < pickableItems.length; i++) {
    const base = pickableItems[i];
    if (!base?.mesh || base === heldItem || ctx.isHeldByRemote(base.id)) continue;
    if (base.fridgeCtrl?.shelfSurfaces?.length) gravityFridges.push(base);
    if (!base.mesh.visible || base.crateParent) continue;
    const stack = getStackConfig(base);
    if (stack) gravityStacks[stack.kind].push(i);
    if (_cookerContentSet.has(base) || (base.isAttached && base.potItem)) continue;
    const height = getItemSupportTopOffset(base);
    if (height <= 0) continue;
    gravitySupports.push({
      item: base, height, extents: getItemSupportHalfExtents(base), yaw: base.mesh.rotation.y
    });
  }

  for (var sIdx = 0; sIdx < _sortedGravityIndices.length; sIdx++) {
    var idx = _sortedGravityIndices[sIdx];
    var item = pickableItems[idx];
    if (!item || !item.mesh || item.isReadOnly || item.crateParent) continue;
    if (item.potItem && item.isAttached) {
      var pot = item.potItem;
      item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
      item.mesh.rotation.copy(pot.mesh.rotation);
      continue;
    }
    var isInHeldTray = !!(heldItem && heldItem.trayContents && heldItem.trayContents.some(function (tc) { return tc && tc.item === item; }));
    var isInHeldPot = !!(heldItem && heldItem.cookerRef && heldItem.cookerRef.contents && heldItem.cookerRef.contents.indexOf(item) !== -1);
    if (heldItem === item || isInHeldTray || isInHeldPot || ctx.isHeldByRemote(item.id)) {
      item.movedAt = now;
      if (heldItem === item) ctx.removeFromCookerContents(item);
      continue;
    }
    var insideCooker = false;
    for (var cpi = 0; cpi < cookerPots.length; cpi++) {
      var cpRef = cookerPots[cpi];
      var slotIdx = cpRef.contents.indexOf(item);
      if (slotIdx !== -1) {
        var potP = cpRef.potItem.mesh.position;
        if (item.mesh && item.mesh.userData.isCookerBase) {
          item.mesh.position.set(potP.x, potP.y + 0.036, potP.z);
        } else {
          var nonBaseIdx = 0;
          for (var ci = 0; ci < slotIdx; ci++) {
            var prev = cpRef.contents[ci];
            if (prev && (!prev.mesh || !prev.mesh.userData.isCookerBase)) nonBaseIdx++;
          }
          var slot = COOKER_SLOT_OFFSETS[nonBaseIdx % COOKER_SLOT_OFFSETS.length];
          item.mesh.position.set(potP.x + slot[0], potP.y + COOKER_SLOT_Y, potP.z + slot[1]);
        }
        insideCooker = true;
        break;
      }
    }
    if (insideCooker) continue;

    if (item.mesh.position.y < -5) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      recentlyDropped[item.id] = Math.max(recentlyDropped[item.id] || 0, now + 15000);
      pendingMovedItems[item.id] = {
        id: item.id, x: item.homePos.x, y: item.homePos.y, z: item.homePos.z, ry: item.homeRy
      };
      continue;
    }
    var ignoreTargetSurf = item.fridgeCtrl ? 'fridge' : item.mesh.userData.dynamicSurface;
    var supportedY = getItemGroundHeight(physCtx, item.mesh.position.x, item.mesh.position.z, item.mesh.position.y, ignoreTargetSurf, item.mesh.position.y + 0.04);
    if (!item.mesh.userData.isTable) {
      var ownSurfs = Array.isArray(item.mesh.userData.dynamicSurfaces) ? item.mesh.userData.dynamicSurfaces : null;
      for (var i = 0; i < supportSurfaces.length; i++) {
        var s = supportSurfaces[i];
        if (s.topY <= supportedY || item.mesh.position.y < s.topY - (s.isCultureFridgeShelf ? 0.15 : 0.08)) continue;
        if (!isPointInBoundsXZ(item.mesh.position.x, item.mesh.position.z, s, 0.12)) continue;
        if (s === item.mesh.userData.dynamicSurface) continue;
        if (ownSurfs && ownSurfs.indexOf(s) !== -1) continue;
        if (isSurfaceOwnerHeld(ctx, s)) continue;
        if (item.fridgeCtrl && s.isCultureFridgeShelf) continue;
        if (item.mesh.userData.isHood && s.isHood) continue;
        supportedY = s.topY;
      }
      // Salvaguarda adicional: item dentro de uma geladeira nunca afunda para o piso abaixo da prateleira inferior
      if (!item.fridgeCtrl && !item.mesh.userData.twoHanded) {
        for (const fr of gravityFridges) {
          const s0 = fr.fridgeCtrl.shelfSurfaces[0];
          if (isPointInBoundsXZ(item.mesh.position.x, item.mesh.position.z, s0, 0.10) &&
              item.mesh.position.y >= fr.mesh.position.y - 0.05 &&
              item.mesh.position.y < s0.topY) {
            supportedY = Math.max(supportedY, s0.topY);
          }
        }
      }
      // Suporte por outros itens (ex: itens colocados em cima de caixas, monotubs, bandejas, etc.)
      for (const support of gravitySupports) {
        const sBase = support.item;
        if (sBase === item) continue;
        const sTopY = sBase.mesh.position.y + support.height;
        if (item.mesh.position.y < sTopY - 0.04) continue;
        if (support.yaw !== sBase.mesh.rotation.y) {
          support.yaw = sBase.mesh.rotation.y;
          support.extents = getItemSupportHalfExtents(sBase);
        }
        const sExt = support.extents;
        var sHalfW = Math.max(0.05, sExt.w * 0.5) + 0.08;
        var sHalfD = Math.max(0.05, sExt.d * 0.5) + 0.08;
        if (Math.abs(item.mesh.position.x - sBase.mesh.position.x) <= sHalfW &&
            Math.abs(item.mesh.position.z - sBase.mesh.position.z) <= sHalfD) {
          supportedY = Math.max(supportedY, sTopY);
        }
      }
      var itemStackCfg = getStackConfig(item);
      if (itemStackCfg) {
        var alignR = itemStackCfg.alignRadius;
        for (const pj of gravityStacks[itemStackCfg.kind]) {
          if (pj === idx) continue;
          const pBase = pickableItems[pj];
          var dxS = pBase.mesh.position.x - item.mesh.position.x;
          var dzS = pBase.mesh.position.z - item.mesh.position.z;
          if (dxS * dxS + dzS * dzS < alignR * alignR) {
            var dyStack = item.mesh.position.y - pBase.mesh.position.y;
            const spacing = stackSpacing(pBase, itemStackCfg);
            if (itemStackCfg.kind === 'crate' && dyStack > spacing + 0.085) continue;
            if (dyStack > 0.008 || (Math.abs(dyStack) <= 0.008 && idx > pj)) {
              supportedY = Math.max(supportedY, pBase.mesh.position.y + spacing);
            }
          }
        }
      }
    }
    if (item.mesh.position.y < supportedY - 0.005 && !item.mesh.userData.isTable && !item.mesh.userData.isHood) {
      item.mesh.position.y = supportedY;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      if (item.deliveryCrateCtrl) {
        item.isMoved = true;
        recentlyDropped[item.id] = Math.max(recentlyDropped[item.id] || 0, now + 15000);
        pendingMovedItems[item.id] = {
          ...pendingMovedItems[item.id], id: item.id, x: item.mesh.position.x, y: supportedY,
          z: item.mesh.position.z, ry: item.mesh.rotation.y
        };
      }
    } else if (item.mesh.position.y > supportedY + 0.015) {
      anyFalling = true;
      recentlyDropped[item.id] = Math.max(recentlyDropped[item.id] || 0, now + 15000);
      item.mesh.position.y = Math.max(supportedY, item.mesh.position.y - 0.18);
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      if (item.lidItem && item.lidItem.isAttached) {
        var attLid = item.lidItem;
        attLid.mesh.position.set(item.mesh.position.x, item.mesh.position.y + 0.36, item.mesh.position.z);
        recentlyDropped[attLid.id] = Math.max(recentlyDropped[attLid.id] || 0, now + 15000);
      }
      if (Math.abs(item.mesh.position.y - supportedY) < 0.005) {
        item.mesh.position.y = supportedY;
        item.isMoved = true;
        pendingMovedItems[item.id] = {
          id: item.id,
          x: item.mesh.position.x,
          y: item.mesh.position.y,
          z: item.mesh.position.z,
          ry: item.mesh.rotation.y
        };
        if (item.lidItem && item.lidItem.isAttached) {
          var lid = item.lidItem;
          pendingMovedItems[lid.id] = {
            id: lid.id,
            x: lid.mesh.position.x,
            y: lid.mesh.position.y,
            z: lid.mesh.position.z,
            ry: lid.mesh.rotation.y
          };
        }
      }
    }
  }
  for (const item of pickableItems) {
    if (item.deliveryCrateCtrl && item.trayContents?.length && item !== heldItem && !ctx.isHeldByRemote(item.id)) {
      positionCrateCargo(item);
    }
  }
  hasFallingItems = anyFalling;
  if (ctx) ctx._stackPhysicsDirty = anyFalling;
}
