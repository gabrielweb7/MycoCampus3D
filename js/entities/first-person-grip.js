const THREE = window.THREE;

const gripBounds = new WeakMap();
let inverseRoot;
let childToItem;
let meshBounds;
const viewPoint = new THREE.Vector3();
const cameraInverse = new THREE.Quaternion();
const palmOffset = new THREE.Vector3();
const sleeveAxis = new THREE.Vector3(0, 0, 1);
const elbow = new THREE.Vector3();
const armAxis = new THREE.Vector3();
const adjustedSleeves = new WeakMap();

function getGripBounds(mesh) {
  let bounds = gripBounds.get(mesh);
  if (bounds) return bounds;

  bounds = new THREE.Box3();
  inverseRoot ||= new THREE.Matrix4();
  childToItem ||= new THREE.Matrix4();
  meshBounds ||= new THREE.Box3();
  mesh.updateWorldMatrix(true, true);
  inverseRoot.copy(mesh.matrixWorld).invert();
  function includeMesh(child) {
    if (!child.isMesh || child.material?.visible === false || child.material?.colorWrite === false || child.material?.opacity === 0) return;
    const source = child.isInstancedMesh ? child : child.geometry;
    if (!source.boundingBox) source.computeBoundingBox();
    childToItem.multiplyMatrices(inverseRoot, child.matrixWorld);
    bounds.union(meshBounds.copy(source.boundingBox).applyMatrix4(childToItem));
  }
  includeMesh(mesh);
  for (const child of mesh.children) child.traverseVisible(includeMesh);
  if (bounds.isEmpty()) {
    bounds.min.set(0, 0, 0);
    bounds.max.set(0, 0, 0);
  }
  gripBounds.set(mesh, bounds);
  return bounds;
}

export function fitHandHorizontally(camera, x) {
  return x * Math.min(1, camera.aspect / 1.32);
}

export function frameHeldItem(camera, mesh, offset) {
  offset.x = fitHandHorizontally(camera, offset.x);
  if (camera.aspect >= 1) return;
  const { min, max } = getGripBounds(mesh);
  const hood = mesh.userData.isHood;
  const width = hood ? max.z - min.z : max.x - min.x;
  if (width < 0.15) return;

  const slope = Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2) * camera.aspect;
  offset.x *= 0.58;
  const depth = hood ? max.x - min.x : max.z - min.z;
  const distance = (width * 0.52 + Math.abs(offset.x)) / slope + depth * 0.35;
  offset.z = Math.min(offset.z, -distance);
}

function alignPalm(camera, arm, mesh, x, y, z) {
  if (!arm?.visible) return;
  viewPoint.set(x, y, z).multiply(mesh.scale).applyQuaternion(mesh.quaternion).add(mesh.position)
    .sub(camera.position).applyQuaternion(cameraInverse);
  if (viewPoint.z >= -0.1) return;

  // Keep reaching hands in the same screen position without drawing an arm across the whole room.
  viewPoint.multiplyScalar(Math.min(1, 0.78 / -viewPoint.z));
  const halfHeight = -viewPoint.z * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2);
  viewPoint.x = THREE.MathUtils.clamp(viewPoint.x, -halfHeight * camera.aspect * 0.85, halfHeight * camera.aspect * 0.85);
  viewPoint.y = THREE.MathUtils.clamp(viewPoint.y, -halfHeight * 0.85, halfHeight * 0.18);
  palmOffset.set(0, 0, -0.05).applyQuaternion(arm.quaternion);
  arm.position.copy(viewPoint).sub(palmOffset);
}

export function resetHeldSleeve(arm) {
  const sleeve = adjustedSleeves.get(arm);
  if (!sleeve) return;
  sleeve.position.z = 0.15;
  sleeve.scale.setScalar(1);
  adjustedSleeves.delete(arm);
}

function alignRifleHand(camera, arm, mesh, grip, side) {
  if (!arm?.visible) return;
  viewPoint.set(grip.x, grip.y, grip.z).multiply(mesh.scale).applyQuaternion(mesh.quaternion)
    .add(mesh.position).sub(camera.position).applyQuaternion(cameraInverse);
  elbow.set(fitHandHorizontally(camera, side * (side < 0 ? 0.29 : 0.37)), -0.51, -0.28);
  armAxis.subVectors(elbow, viewPoint).normalize();
  arm.quaternion.setFromUnitVectors(sleeveAxis, armAxis);
  arm.rotateZ(side < 0 ? -0.5 : 0.22);
  arm.position.copy(viewPoint).addScaledVector(armAxis, 0.05);
  const sleeve = adjustedSleeves.get(arm) || arm.getObjectByName('fps-sleeve');
  if (sleeve) {
    const length = arm.position.distanceTo(elbow);
    sleeve.position.z = length / 2;
    sleeve.scale.set(0.76, length / 0.30, 0.76);
    adjustedSleeves.set(arm, sleeve);
  }
}

export function alignHeldHands(ctx, item) {
  if (!ctx.fpsArmGroup?.visible || !item.mesh.visible || ctx.snowboardActive || (ctx.paragliderActive && !ctx.onGround)) return;
  const mesh = item.mesh;
  const data = mesh.userData;
  const camera = ctx.camera;
  cameraInverse.copy(camera.quaternion).invert();
  if (data.firstPersonSupportGrip && data.firstPersonGrip) {
    alignRifleHand(camera, ctx.fpsArmGroup, mesh, data.firstPersonGrip, 1);
    alignRifleHand(camera, ctx.fpsLeftArmGroup, mesh, data.firstPersonSupportGrip, -1);
    return;
  }
  const { min, max } = getGripBounds(mesh);
  const centerX = (min.x + max.x) / 2;
  const width = max.x - min.x;
  const y = min.y + Math.min(0.12, (max.y - min.y) * 0.28);
  const front = max.z + 0.025;
  if (data.isHood) {
    alignPalm(camera, ctx.fpsArmGroup, mesh, max.x + 0.025, 0.035, -0.42);
    alignPalm(camera, ctx.fpsLeftArmGroup, mesh, max.x + 0.025, 0.035, 0.42);
  } else if (data.twoHanded || data.firstPersonSideGrip) {
    const spread = Math.min(0.34, (max.x - min.x) * 0.43);
    const grip = data.firstPersonSideGrip;
    alignPalm(camera, ctx.fpsArmGroup, mesh, grip?.x ?? centerX + spread, grip?.y ?? y, grip?.z ?? front);
    alignPalm(camera, ctx.fpsLeftArmGroup, mesh, grip ? -grip.x : centerX - spread, grip?.y ?? y, grip?.z ?? front);
  } else if (data.isAlcoholSpray || data.isWaterSpray || data.isH2O2Spray) {
    alignPalm(camera, ctx.fpsArmGroup, mesh, 0, 0.105, -0.068);
  } else if (data.firstPersonGrip) {
    const { x, y: gripY, z } = data.firstPersonGrip;
    alignPalm(camera, ctx.fpsArmGroup, mesh, x, gripY, z);
  } else if (data.isSyringe) {
    alignPalm(camera, ctx.fpsArmGroup, mesh, -0.037, -0.022, 0.020);
  } else if (data.isScalpel || data.isLabSpoon) {
    alignPalm(camera, ctx.fpsArmGroup, mesh, 0, min.y - 0.018, max.z - 0.032);
  } else if (width > 0.24 && max.y - min.y < width * 0.65) {
    alignPalm(camera, ctx.fpsArmGroup, mesh, centerX + width * 0.26, min.y - 0.015, front);
  } else {
    alignPalm(camera, ctx.fpsArmGroup, mesh, centerX, y, front);
  }
}
