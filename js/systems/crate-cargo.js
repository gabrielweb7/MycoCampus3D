import { t } from '../core/i18n.js';
import { appState } from '../core/state.js';
import { canPlaceVillageItem } from '../core/village-layout.js';
import { isRayOccludedByStructure } from './ray-occlusion.js';

const THREE = window.THREE;
export const CRATE_WIDTH = 0.42;
export const CRATE_HEIGHT = 0.165;
export const CRATE_DEPTH = 0.36;

// Four floor compartments. Longer objects can occupy a row or a column.
const slots = [
  [-0.092, -0.088, 1], [0.092, -0.088, 2],
  [-0.092, 0.088, 4], [0.092, 0.088, 8],
  [0, -0.088, 3], [0, 0.088, 12],
  [-0.092, 0, 5], [0.092, 0, 10], [0, 0, 15]
];
const aim = new THREE.Vector3();
const size = new THREE.Vector3();
let localRay;
let inverse;
let openingPoint;
let bounds;
let savedRotation;
const wallOcclusion = { checkWalls: true };
let measuredItem;
let measuredWidth = 0;
let measuredDepth = 0;

function cargoMask(crate) {
  let mask = 0;
  const contents = crate.trayContents;
  for (let i = 0; i < (contents?.length || 0); i++) mask |= slots[contents[i].item.crateCargo.slot][2];
  return mask;
}

export function cratePackMask(crate) {
  const occupied = cargoMask(crate);
  let mask = 0;
  let remaining = crate.deliveryCrateCtrl.packsCount;
  for (let i = 0; i < 4 && remaining > 0; i++) {
    const bit = 1 << i;
    if (occupied & bit) continue;
    mask |= bit;
    remaining--;
  }
  return mask;
}

export function freeCrateSlot(crate, item) {
  if (!crate || crate.isReadOnly) return -1;
  const occupied = cargoMask(crate) | cratePackMask(crate);
  if (occupied === 15) return -1;
  if (!item || item.wildMushroomCtrl) {
    for (let i = 0; i < 4; i++) if (!(occupied & (1 << i))) return i;
    return -1;
  }

  const mesh = item.mesh;
  const data = mesh.userData;
  if (item.deliveryCrateCtrl || item.lidItem || item.potItem || item.trayContents?.length ||
      data.twoHanded || data.dynamicSurface || data.dynamicSurfaces || data.dynamicCollider) return -1;
  if (item !== measuredItem) {
    bounds ||= new THREE.Box3();
    savedRotation ||= new THREE.Quaternion();
    savedRotation.copy(mesh.quaternion);
    mesh.quaternion.identity();
    bounds.setFromObject(mesh, true).getSize(size);
    mesh.quaternion.copy(savedRotation);
    mesh.updateMatrixWorld(true);
    measuredItem = item;
    measuredWidth = size.x;
    measuredDepth = size.z;
  }
  const scale = Math.abs(crate.mesh.scale.x);
  let closest = Infinity;
  let selected = -1;
  for (let i = 0; i < slots.length; i++) {
    const [x, z, mask] = slots[i];
    const width = x === 0 ? 0.38 : 0.18;
    const depth = z === 0 ? 0.32 : 0.17;
    if ((occupied & mask) || measuredWidth > width * scale || measuredDepth > depth * scale) continue;
    const distance = (aim.x - x) ** 2 + (aim.z - z) ** 2;
    // Prefer one compartment, then a pair, before using the entire floor.
    const score = Math.floor(i / 4) + distance;
    if (score >= closest) continue;
    closest = score;
    selected = i;
  }
  return selected;
}

export function findAimedCrate(ctx, ndc) {
  if (!ndc || !ctx.raycaster || !ctx.camera) return null;
  ctx.raycaster.setFromCamera(ndc, ctx.camera);
  const ray = ctx.raycaster.ray;
  let distance = 3.8;
  let target = null;
  for (const crate of ctx.pickableItems) {
    if (!crate.deliveryCrateCtrl || crate === ctx.heldItem || crate.isReadOnly ||
        ctx.isHeldByRemote(crate.id) || !crate.mesh.visible) continue;
    const mesh = crate.mesh;
    if (ray.distanceSqToPoint(mesh.position) > 0.35) continue;
    localRay ||= new THREE.Ray();
    inverse ||= new THREE.Matrix4();
    openingPoint ||= new THREE.Vector3();
    mesh.updateWorldMatrix(true, false);
    localRay.copy(ray).applyMatrix4(inverse.copy(mesh.matrixWorld).invert());
    if (localRay.direction.y >= -0.02) continue;
    const at = (CRATE_HEIGHT - localRay.origin.y) / localRay.direction.y;
    if (at <= 0) continue;
    localRay.at(at, openingPoint);
    if (Math.abs(openingPoint.x) > CRATE_WIDTH / 2 - 0.012 ||
        Math.abs(openingPoint.z) > CRATE_DEPTH / 2 - 0.012) continue;
    const hitDistance = mesh.localToWorld(openingPoint).distanceTo(ray.origin);
    if (hitDistance >= distance || isRayOccludedByStructure(ctx, hitDistance, wallOcclusion)) continue;
    distance = hitDistance;
    target = crate;
    localRay.at(at, aim);
  }
  return target;
}

export function cratePlacementError(crate, item, slot) {
  if (!canPlaceVillageItem(crate.mesh.position.x, crate.mesh.position.z, item, appState.villageLease)) return t('crate.blocked');
  if (freeCrateSlot(crate) < 0) return t('crate.full');
  if (slot < 0) return t('crate.fit');
  return '';
}

export function crateSlotPosition(crate, slot, point) {
  const [x, z] = slots[slot];
  return crate.mesh.localToWorld(point.set(x, 0.015, z));
}

export function positionCrateCargo(crate) {
  for (const cargo of crate.trayContents || []) {
    const item = cargo.item;
    item.mesh.position.copy(cargo.localOffset);
    crate.mesh.localToWorld(item.mesh.position);
    item.mesh.rotation.set(0, crate.mesh.rotation.y, 0);
    item.mesh.userData.updateBounds?.(item);
  }
}

function linkCargo(crate, item, slot) {
  const [x, z] = slots[slot];
  (crate.trayContents ||= []).push({ item, localOffset: new THREE.Vector3(x, 0.015, z) });
  item.crateParent = crate;
}

export function removeCrateCargo(ctx, item, sync = false) {
  const crate = item.crateParent;
  if (crate) {
    const index = crate.trayContents.findIndex(cargo => cargo.item === item);
    if (index >= 0) crate.trayContents.splice(index, 1);
    crate.deliveryCrateCtrl.updateVisual();
  }
  if (!item.crateCargo) return;
  item.crateParent = null;
  item.crateCargo = null;
  if (sync) ctx.queueItemStateSync?.(item);
}

export function loadCrateCargo(ctx, crate, item, slot) {
  item.crateCargo = { id: crate.id, slot };
  linkCargo(crate, item, slot);
  if (item.wildMushroomCtrl?.bodyGroup) {
    const mushroom = item.wildMushroomCtrl;
    mushroom.bodyGroup.rotation.z = Math.PI / 2;
    mushroom.bodyGroup.position.y = mushroom.sideRestY;
  }
  positionCrateCargo(crate);
  crate.deliveryCrateCtrl.updateVisual();
  item.mesh.visible = true;
  item.isMoved = true;
  item.movedAt = performance.now();
  ctx.queueItemStateSync?.(item);
  ctx._stackPhysicsDirty = true;
}

export function rebuildCrateCargo(ctx) {
  for (const item of ctx.pickableItems) {
    item.crateParent = null;
    if (item.deliveryCrateCtrl) item.trayContents = null;
  }
  for (const item of ctx.pickableItems) {
    const ref = item.crateCargo;
    if (!ref || item.deliveryCrateCtrl || item === ctx.heldItem || item._inventoryHidden ||
        item.wildMushroomCtrl?.removed || !slots[ref.slot]) continue;
    const crate = ctx.findPickable(ref.id);
    if (!crate?.deliveryCrateCtrl) continue;
    // In a concurrent edit, keep conflicting cargo at its saved world position.
    if (slots[ref.slot][2] & cargoMask(crate)) continue;
    const occupied = cargoMask(crate) | slots[ref.slot][2];
    let empty = 0;
    for (let bit = 1; bit <= 8; bit <<= 1) if (!(occupied & bit)) empty++;
    if (crate.deliveryCrateCtrl.packsCount > empty) continue;
    linkCargo(crate, item, ref.slot);
  }
  for (const item of ctx.pickableItems) {
    if (!item.deliveryCrateCtrl) continue;
    positionCrateCargo(item);
    item.deliveryCrateCtrl.updateVisual();
  }
}
