import { AK47_EJECTION_PORT, AK47_MUZZLE } from '../items/ak47.js';
import { getItemGroundHeight } from '../engine/physics.js';
import { getBlockingCampusModal } from '../ui/dom-helpers.js';
import { getStructureHitDistance } from './ray-occlusion.js';

const THREE = window.THREE;
const SHOT_INTERVAL = 114;
const CASING_LIFETIME = 5200;
const TRACER_SPEED = 390;
const TRACER_RANGE = 42;
const CASING_COUNT = 48;
const forward = new THREE.Vector3(0, 0, -1);
const aimCenter = new THREE.Vector2();
const handOffset = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const shotDirection = new THREE.Vector3();
const samplePoint = new THREE.Vector3();

function makeEffects(scene) {
  const group = new THREE.Group();
  group.name = 'ak47-effects';
  group.userData.keepDynamic = true;
  scene.add(group);

  function glow(geometry, color, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({
      color, opacity, transparent: opacity < 1, depthWrite: opacity === 1, toneMapped: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  }
  const flash = glow(new THREE.IcosahedronGeometry(1, 0), 0xfff3b2);
  const flare = glow(new THREE.IcosahedronGeometry(1, 0), 0xff852b, 0.63);
  const light = new THREE.PointLight(0xff9b4d, 0, 4.5, 2);
  group.add(light);
  const streakGeo = new THREE.CylinderGeometry(0.008, 0.003, 1, 6);
  streakGeo.rotateX(-Math.PI / 2);
  const tracers = Array.from({ length: 4 }, () => ({
    mesh: glow(streakGeo, 0xffb95b, 0.86), start: new THREE.Vector3(), direction: new THREE.Vector3(),
    firedAt: -Infinity, distance: 0
  }));

  const profile = [
    [0, -0.021], [0.007, -0.021], [0.007, -0.018], [0.0058, -0.017], [0.0069, -0.015],
    [0.0063, 0.011], [0.0046, 0.015], [0.0045, 0.021], [0.0032, 0.021], [0.0032, 0.015], [0, 0.014]
  ];
  const caseGeo = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 10);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb78942, metalness: 0.61, roughness: 0.33 });
  const brassMesh = new THREE.InstancedMesh(caseGeo, brass, CASING_COUNT);
  brassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  brassMesh.frustumCulled = false;
  brassMesh.count = 0;
  group.add(brassMesh);
  const cases = Array.from({ length: CASING_COUNT }, () => ({
    pose: new THREE.Object3D(), velocity: new THREE.Vector3(), firedAt: -Infinity, settled: true, floorCeiling: 0
  }));
  return {
    flash, flare, light, brassMesh, tracers, cases, traceIndex: 0, caseIndex: 0,
    raycaster: new THREE.Raycaster(), aim: new THREE.Vector2(),
    firedAt: -Infinity, nextShotAt: 0, triggerItem: null, poseItem: null, queued: false, bolt: null
  };
}

export function isAk47Aiming(ctx) {
  return !!(ctx.inFps && ctx.heldItem?.mesh?.userData.isAk47 && !ctx.placementMode &&
    !ctx.adminEditMode && !ctx.villageMove && !ctx.lobbyTourActive);
}

function isModalOpen() {
  return typeof document !== 'undefined' && !!getBlockingCampusModal();
}

export function pressAk47Trigger(ctx, aimNdc) {
  if (!isAk47Aiming(ctx) || ctx.inventory?.pending || isModalOpen() ||
      performance.now() - ctx.lastPickupAt < 140) return false;
  const fx = ctx.ak47Effects ||= makeEffects(ctx.scene);
  fx.triggerItem = ctx.heldItem;
  fx.aim.copy(aimNdc || aimCenter);
  fx.queued = true;
  return true;
}

export function poseAk47(ctx, item, now, horizontalOffset) {
  const fx = ctx.ak47Effects;
  const active = isAk47Aiming(ctx) && fx?.poseItem === item;
  const shotAge = active ? Math.max(0, now - fx.firedAt) : Infinity;
  const kick = Math.exp(-shotAge / 45);
  const camera = ctx.camera;
  const mesh = item.mesh;
  camera.rotation.x += 0.021 * kick;
  camera.rotation.z += 0.006 * kick;
  handOffset.set(horizontalOffset, -0.38 + 0.009 * kick, -0.67 + 0.047 * kick);
  if (camera.aspect < 0.8) handOffset.z -= 0.14 * (1 - camera.aspect);
  mesh.position.copy(handOffset).applyQuaternion(camera.quaternion).add(camera.position);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(camera.rotation.x + 0.074 + 0.067 * kick, camera.rotation.y + 0.095, camera.rotation.z - 0.075);
  if (fx?.poseItem === item && fx.bolt) fx.bolt.position.z = -0.049 + 0.032 * Math.exp(-shotAge / 19);
}

function getTracerDistance(ctx, origin, direction) {
  const limit = getStructureHitDistance(ctx, origin, direction, TRACER_RANGE);
  if (!ctx.physCtx || direction.y > 0) return limit;
  const ceiling = origin.y + 0.08;
  for (let distance = 0.16; distance < limit; distance += 0.24 + distance * 0.04) {
    samplePoint.copy(origin).addScaledVector(direction, distance);
    if (samplePoint.y <= getItemGroundHeight(ctx.physCtx, samplePoint.x, samplePoint.z, ceiling, null, ceiling)) {
      return distance;
    }
  }
  return limit;
}

function shoot(ctx, fx, item, now) {
  const mesh = item.mesh;
  if (fx.poseItem !== item) {
    if (fx.bolt) fx.bolt.position.z = -0.049;
    fx.poseItem = item;
    fx.bolt = mesh.getObjectByName('ak47-bolt');
  }
  fx.firedAt = now;
  fx.nextShotAt = now + SHOT_INTERVAL;
  fx.queued = false;

  mesh.localToWorld(muzzle.set(...AK47_MUZZLE));
  ctx.camera.updateMatrixWorld();
  fx.raycaster.setFromCamera(fx.aim, ctx.camera);
  const ray = fx.raycaster.ray;
  // Converge from the muzzle toward the crosshair and stop at nearby scenery.
  const aimDistance = getTracerDistance(ctx, ray.origin, ray.direction);
  ray.at(aimDistance, shotDirection).sub(muzzle);
  const muzzleToAim = shotDirection.length();
  shotDirection.normalize();

  fx.flash.position.copy(muzzle).addScaledVector(shotDirection, 0.063);
  fx.flash.quaternion.setFromUnitVectors(forward, shotDirection);
  fx.flash.rotateZ(Math.random() * Math.PI);
  fx.flare.position.copy(fx.flash.position).addScaledVector(shotDirection, 0.044);
  fx.flare.quaternion.copy(fx.flash.quaternion);
  fx.light.position.copy(muzzle).addScaledVector(shotDirection, 0.09);

  const tracer = fx.tracers[fx.traceIndex++ % fx.tracers.length];
  tracer.start.copy(muzzle);
  tracer.direction.copy(shotDirection);
  tracer.distance = Math.min(muzzleToAim, getTracerDistance(ctx, muzzle, shotDirection));
  tracer.mesh.quaternion.setFromUnitVectors(forward, shotDirection);
  tracer.firedAt = now;

  const casing = fx.cases[fx.caseIndex++ % fx.cases.length];
  mesh.localToWorld(casing.pose.position.set(...AK47_EJECTION_PORT));
  casing.pose.rotation.set(mesh.rotation.x + 1, mesh.rotation.y, -0.65);
  casing.velocity.set(1.25 + Math.random() * 0.75, 0.98 + Math.random() * 0.65, 0.46)
    .applyQuaternion(mesh.quaternion);
  casing.floorCeiling = casing.pose.position.y + 0.14;
  casing.firedAt = now;
  casing.settled = false;
  window.MycoAudio?.playAk47Shot?.();
}

export function stepAk47Effects(ctx, dt, now) {
  const fx = ctx.ak47Effects;
  if (!fx) return;
  if (fx.poseItem && (fx.poseItem !== ctx.heldItem || !isAk47Aiming(ctx))) {
    if (fx.bolt) fx.bolt.position.z = -0.049;
    fx.bolt = null;
    fx.poseItem = null;
  }
  if (fx.triggerItem) {
    const readyToShoot = (fx.queued || ctx.isPrimaryDown) && now >= fx.nextShotAt;
    if (fx.triggerItem !== ctx.heldItem || !isAk47Aiming(ctx) || ctx.inventory?.pending ||
        (readyToShoot && isModalOpen())) {
      fx.triggerItem = null;
      fx.queued = false;
    } else if (readyToShoot) {
      shoot(ctx, fx, fx.triggerItem, now);
    }
    if (!fx.queued && !ctx.isPrimaryDown) fx.triggerItem = null;
  }

  const flashPower = Math.max(0, 1 - (now - fx.firedAt) / 44);
  fx.flash.visible = fx.flare.visible = flashPower > 0;
  if (flashPower > 0) {
    fx.flash.scale.set(0.055 * flashPower, 0.051 * flashPower, 0.117 * flashPower);
    fx.flare.scale.set(0.086 * flashPower, 0.072 * flashPower, 0.188 * flashPower);
  }
  fx.light.intensity = 9 * flashPower * flashPower;
  for (const tracer of fx.tracers) {
    const travel = 0.7 + (now - tracer.firedAt) / 1000 * TRACER_SPEED;
    const head = Math.min(travel, tracer.distance);
    const tail = Math.max(0, travel - 3.4);
    tracer.mesh.visible = head > tail;
    if (!tracer.mesh.visible) continue;
    tracer.mesh.position.copy(tracer.start).addScaledVector(tracer.direction, (head + tail) * 0.5);
    tracer.mesh.scale.z = head - tail;
  }

  let visibleCases = 0;
  for (const casing of fx.cases) {
    const remaining = CASING_LIFETIME - (now - casing.firedAt);
    if (remaining <= 0) continue;
    const { pose, velocity } = casing;
    if (!casing.settled) {
      velocity.y -= 9.8 * dt;
      pose.position.addScaledVector(velocity, dt);
      pose.rotation.x += dt * 13;
      pose.rotation.z += dt * 9;
      const floor = ctx.physCtx
        ? getItemGroundHeight(ctx.physCtx, pose.position.x, pose.position.z, casing.floorCeiling, null, casing.floorCeiling)
        : ctx.playerPos.y;
      if (pose.position.y <= floor + 0.009) {
        pose.position.y = floor + 0.009;
        if (velocity.y < -1.05) {
          velocity.y *= -0.29;
          velocity.x *= 0.57;
          velocity.z *= 0.57;
        } else {
          casing.settled = true;
          pose.rotation.set(Math.PI / 2, 0, pose.rotation.z);
        }
      }
    }
    pose.scale.setScalar(Math.min(1, remaining / 350));
    pose.updateMatrix();
    fx.brassMesh.setMatrixAt(visibleCases++, pose.matrix);
  }
  fx.brassMesh.count = visibleCases;
  if (visibleCases) fx.brassMesh.instanceMatrix.needsUpdate = true;
}
