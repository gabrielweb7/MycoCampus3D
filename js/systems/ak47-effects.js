import { AK47_EJECTION_PORT, AK47_MUZZLE } from '../items/ak47.js';
import { getItemGroundHeight } from '../engine/physics.js';
import { getBlockingCampusModal } from '../ui/dom-helpers.js';
import { getStructureHitDistance } from './ray-occlusion.js';
import { getShotTargetHit } from './shot-targets.js';

const THREE = window.THREE;
const SHOT_INTERVAL = 114;
const CASING_LIFETIME = 5200;
const TRACER_SPEED = 390;
const TRACER_RANGE = 42;
const TRACER_DROP_START = 12;
const TRACER_DROP = 0.0012;
const CASING_COUNT = 48;
const IMPACT_LIFETIME = 60000;
const IMPACT_COUNT = 560;
const RECENT_SHOT_WINDOW = 850;
const RECENT_SHOT_COUNT = 8;
const SHOT_HEARING_RANGE = 170;
const REMOTE_VISUAL_RANGE = 68;
const forward = new THREE.Vector3(0, 0, -1);
const planeNormal = new THREE.Vector3(0, 0, 1);
const nearShot = new THREE.Vector3();
const listenerRight = new THREE.Vector3();
const aimCenter = new THREE.Vector2();
const handOffset = new THREE.Vector3();
const muzzle = new THREE.Vector3();
const shotDirection = new THREE.Vector3();
const samplePoint = new THREE.Vector3();
const aimOffset = new THREE.Vector3();
const segmentStart = new THREE.Vector3();
const segmentEnd = new THREE.Vector3();
const segmentDirection = new THREE.Vector3();
const impactPoint = new THREE.Vector3();
const impactNormal = new THREE.Vector3();
const flightHit = { target: null };

function makeImpactTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 48;
  const brush = canvas.getContext('2d');
  if (!brush) return null;
  const gradient = brush.createRadialGradient(24, 24, 3, 24, 24, 22);
  gradient.addColorStop(0, '#150e0af5');
  gradient.addColorStop(0.30, '#211610f0');
  gradient.addColorStop(0.49, '#4b392bc2');
  gradient.addColorStop(0.64, '#82644878');
  gradient.addColorStop(1, '#35241c00');
  brush.fillStyle = gradient;
  brush.fillRect(0, 0, 48, 48);
  brush.strokeStyle = '#291d12b5';
  for (const angle of [0.2, 1.6, 3.4, 4.6, 5.4]) {
    brush.beginPath();
    brush.moveTo(24 + Math.cos(angle) * 6, 24 + Math.sin(angle) * 6);
    brush.lineTo(24 + Math.cos(angle) * 12, 24 + Math.sin(angle) * 12);
    brush.lineTo(24 + Math.cos(angle + 0.16) * 17, 24 + Math.sin(angle + 0.16) * 17);
    brush.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

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
  const remoteLight = new THREE.PointLight(0xff9b4d, 0, 4.5, 2);
  group.add(light, remoteLight);
  const flashes = Array.from({ length: 8 }, () => ({
    core: glow(flash.geometry, 0xfff3b2),
    flare: glow(flare.geometry, 0xff852b, 0.63),
    firedAt: -Infinity
  }));
  const streakGeo = new THREE.CylinderGeometry(0.008, 0.003, 1, 6);
  streakGeo.rotateX(-Math.PI / 2);
  const tracers = Array.from({ length: 16 }, () => ({
    mesh: glow(streakGeo, 0xffb95b, 0.86), start: new THREE.Vector3(), direction: new THREE.Vector3(),
    firedAt: -Infinity, distance: 0, target: null
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
  const impactMaterial = new THREE.MeshBasicMaterial({
    map: makeImpactTexture(), color: 0xffffff, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
  const impactMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), impactMaterial, IMPACT_COUNT);
  impactMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  impactMesh.frustumCulled = false;
  impactMesh.count = 0;
  group.add(impactMesh);
  const impacts = Array.from({ length: IMPACT_COUNT }, () => ({
    position: new THREE.Vector3(), rotation: new THREE.Quaternion(), at: -Infinity, size: 0
  }));
  return {
    group, flash, flare, light, remoteLight, flashes, brassMesh, tracers, cases, impactMesh, impacts,
    impactPose: new THREE.Object3D(),
    traceIndex: 0, flashIndex: 0, caseIndex: 0, impactIndex: 0, nextImpactUpdate: Infinity,
    recentShots: [], remoteSequences: new Map(), shotSequence: Date.now(),
    raycaster: new THREE.Raycaster(), aim: new THREE.Vector2(),
    firedAt: -Infinity, nextShotAt: 0, spread: 0, triggerItem: null, poseItem: null, queued: false, bolt: null
  };
}

export function prepareAk47Effects(ctx) {
  ctx.ak47Effects ||= makeEffects(ctx.scene);
}

export function compileAk47Effects(ctx) {
  const fx = ctx.ak47Effects;
  for (const mesh of fx.group.children) if (mesh.isMesh) mesh.visible = true;
  try {
    ctx.renderer.compile(ctx.scene, ctx.camera);
  } finally {
    fx.flash.visible = fx.flare.visible = false;
    for (const { mesh } of fx.tracers) mesh.visible = false;
    for (const flash of fx.flashes) flash.core.visible = flash.flare.visible = false;
  }
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

function getGroundHitDistance(ctx, origin, direction, limit, drop = 0) {
  if (!ctx.physCtx || direction.y > drop * limit) return limit;
  const ceiling = origin.y + 0.08;
  let previous = 0;
  for (let distance = Math.min(0.16, limit); distance <= limit;) {
    tracerPoint(samplePoint, origin, direction, distance, drop);
    if (samplePoint.y <= getItemGroundHeight(ctx.physCtx, samplePoint.x, samplePoint.z, ceiling, null, ceiling)) {
      let end = distance;
      for (let i = 0; i < 6; i++) {
        const middle = (previous + end) * 0.5;
        tracerPoint(samplePoint, origin, direction, middle, drop);
        if (samplePoint.y > getItemGroundHeight(ctx.physCtx, samplePoint.x, samplePoint.z, ceiling, null, ceiling)) {
          previous = middle;
        } else {
          end = middle;
        }
      }
      return end;
    }
    if (distance >= limit) break;
    previous = distance;
    distance = Math.min(limit, distance + 0.24 + distance * 0.04);
  }
  return limit;
}

function tracerPoint(out, origin, direction, distance, drop = TRACER_DROP) {
  out.copy(origin).addScaledVector(direction, distance);
  const dropDistance = Math.max(0, distance - TRACER_DROP_START);
  out.y -= drop * dropDistance * dropDistance;
  return out;
}

function getFlightDistance(ctx, origin, direction) {
  const limit = getGroundHitDistance(ctx, origin, direction, TRACER_RANGE, TRACER_DROP);
  impactNormal.set(0, 0, 0);
  flightHit.target = null;
  for (let boundary = 0; boundary < limit; boundary += 4) {
    // Overlap the chords to catch surfaces just past a segment boundary.
    const from = Math.max(0, boundary - 0.06);
    const to = Math.min(boundary + 4, limit);
    tracerPoint(segmentStart, origin, direction, from);
    tracerPoint(segmentEnd, origin, direction, to);
    segmentDirection.subVectors(segmentEnd, segmentStart);
    const length = segmentDirection.length();
    segmentDirection.divideScalar(length);
    const structure = getStructureHitDistance(ctx, segmentStart, segmentDirection, length, impactNormal);
    const hit = getShotTargetHit(ctx, segmentStart, segmentDirection, structure, flightHit);
    if (flightHit.target) impactNormal.set(0, 0, 0);
    if (hit < length) return from + (to - from) * hit / length;
  }
  if (limit < TRACER_RANGE) {
    tracerPoint(impactPoint, origin, direction, limit);
    const { x, z } = impactPoint;
    const top = origin.y + 0.08;
    const dx = getItemGroundHeight(ctx.physCtx, x - 0.04, z, top, null, top) -
      getItemGroundHeight(ctx.physCtx, x + 0.04, z, top, null, top);
    const dz = getItemGroundHeight(ctx.physCtx, x, z - 0.04, top, null, top) -
      getItemGroundHeight(ctx.physCtx, x, z + 0.04, top, null, top);
    impactNormal.set(dx, 0.08, dz).normalize();
  }
  return limit;
}

function spatialPan(ctx, point, width) {
  listenerRight.set(1, 0, 0).applyQuaternion(ctx.camera.quaternion);
  return THREE.MathUtils.clamp(samplePoint.subVectors(point, ctx.camera.position).dot(listenerRight) / width, -1, 1);
}

function startTracer(ctx, fx, origin, direction, now, maxDistance = TRACER_RANGE, delay = 0) {
  const tracer = fx.tracers[fx.traceIndex++ % fx.tracers.length];
  tracer.start.copy(origin);
  tracer.direction.copy(direction);
  const flightDistance = getFlightDistance(ctx, origin, direction);
  tracer.distance = Math.min(maxDistance, flightDistance);
  tracer.firedAt = now;
  tracer.target = flightDistance <= maxDistance + 0.22 ? flightHit.target : null;
  if (impactNormal.lengthSq() && flightDistance <= maxDistance + 0.22) {
    const impact = fx.impacts[fx.impactIndex++ % fx.impacts.length];
    tracerPoint(impact.position, origin, direction, flightDistance).addScaledVector(impactNormal, 0.017);
    impact.rotation.setFromUnitVectors(planeNormal, impactNormal);
    fx.impactPose.quaternion.copy(impact.rotation);
    fx.impactPose.rotateZ(Math.random() * Math.PI * 2);
    impact.rotation.copy(fx.impactPose.quaternion);
    impact.size = 0.087 + Math.random() * 0.025;
    impact.at = now + flightDistance / TRACER_SPEED * 1000;
    fx.nextImpactUpdate = Math.min(fx.nextImpactUpdate, impact.at);
    const earDistance = ctx.camera.position.distanceTo(impact.position);
    if (earDistance < 18) {
      window.MycoAudio?.playAk47Impact?.(0.63 * (1 - earDistance / 18),
        spatialPan(ctx, impact.position, 5), delay + flightDistance / TRACER_SPEED, impactNormal.y < 0.5);
    }
  }
  return tracer.distance;
}

function placeFlash(core, flare, origin, direction) {
  core.position.copy(origin).addScaledVector(direction, 0.063);
  core.quaternion.setFromUnitVectors(forward, direction);
  core.rotateZ(Math.random() * Math.PI);
  flare.position.copy(core.position).addScaledVector(direction, 0.044);
  flare.quaternion.copy(core.quaternion);
}

function sizeFlash(core, flare, firedAt, now) {
  const power = now < firedAt ? 0 : Math.max(0, 1 - (now - firedAt) / 52);
  core.visible = flare.visible = power > 0;
  if (power > 0) {
    core.scale.set(0.055 * power, 0.051 * power, 0.117 * power);
    flare.scale.set(0.086 * power, 0.072 * power, 0.188 * power);
  }
  return power;
}

function shoot(ctx, fx, item, now) {
  const burstStarted = now - fx.firedAt > 280;
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
  // Keep the first shot close to the crosshair, with greater drift during a burst.
  const structureDistance = getStructureHitDistance(ctx, ray.origin, ray.direction, TRACER_RANGE);
  const aimDistance = getGroundHitDistance(ctx, ray.origin, ray.direction, structureDistance);
  ray.at(aimDistance, shotDirection).sub(muzzle);
  shotDirection.normalize();
  const spread = 0.002 + fx.spread * 0.018;
  aimOffset.set((Math.random() * 2 - 1) * spread, (Math.random() * 2 - 1) * spread + fx.spread * 0.007, 0)
    .applyQuaternion(ctx.camera.quaternion);
  shotDirection.add(aimOffset).normalize();
  fx.spread = Math.min(1, fx.spread + 0.23);

  placeFlash(fx.flash, fx.flare, muzzle, shotDirection);
  fx.light.position.copy(muzzle).addScaledVector(shotDirection, 0.09);

  const distance = startTracer(ctx, fx, muzzle, shotDirection, now);
  fx.recentShots.push([++fx.shotSequence, now, ...muzzle.toArray(), ...shotDirection.toArray(), distance]);
  if (fx.recentShots.length > RECENT_SHOT_COUNT) fx.recentShots.shift();
  if (burstStarted) ctx.notifyWorldAction?.();

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

export function getRecentAk47Shots(ctx, now = performance.now()) {
  return ctx.ak47Effects?.recentShots.flatMap(([id, time, ...shot]) =>
    now - time <= RECENT_SHOT_WINDOW
      ? [[id, Math.max(0, Math.round(now - time)), ...shot.map(value => Math.round(value * 10000) / 10000)]]
      : []) || [];
}

export function hasRecentAk47Shots(ctx, now = performance.now()) {
  return now - (ctx.ak47Effects?.firedAt ?? -Infinity) < RECENT_SHOT_WINDOW;
}

export function applyRemoteAk47Shots(ctx, players, now = performance.now()) {
  if (!ctx.inFps || !ctx.camera || !ctx.scene) return;
  const listener = ctx.camera.position;
  let heard = 0;
  for (const player of players) {
    if (!player.shots?.length) continue;
    const fx = ctx.ak47Effects ||= makeEffects(ctx.scene);
    let added = 0;
    for (const [id, x, y, z, dx, dy, dz, distance] of player.shots) {
      if (id <= (fx.remoteSequences.get(player.id) || 0)) continue;
      fx.remoteSequences.set(player.id, id);
      muzzle.set(x, y, z);
      const sourceDistance = listener.distanceTo(muzzle);
      if (sourceDistance > SHOT_HEARING_RANGE || heard >= 20) continue;
      const delay = added++ * 34;
      heard++;
      const gain = 0.53 / (1 + (sourceDistance / 19) ** 1.35) * (1 - sourceDistance / SHOT_HEARING_RANGE);
      window.MycoAudio?.playAk47Shot?.(gain, spatialPan(ctx, muzzle, 8),
        (delay + Math.min(115, sourceDistance * 0.8)) / 1000);
      if (sourceDistance > REMOTE_VISUAL_RANGE) continue;
      shotDirection.set(dx, dy, dz).normalize();
      const flash = fx.flashes[fx.flashIndex++ % fx.flashes.length];
      placeFlash(flash.core, flash.flare, muzzle, shotDirection);
      flash.firedAt = now + delay;
      const length = startTracer(ctx, fx, muzzle, shotDirection, now + delay, distance, delay / 1000);
      const along = samplePoint.subVectors(listener, muzzle).dot(shotDirection);
      if (along < 1.6 || along > length + 0.18) continue;
      tracerPoint(nearShot, muzzle, shotDirection, Math.min(length, along));
      const missDistance = nearShot.distanceTo(listener);
      if (missDistance < 4) {
        const pan = spatialPan(ctx, nearShot, 2.2);
        const sweep = shotDirection.dot(listenerRight) * 0.56;
        window.MycoAudio?.playAk47Pass?.(1 - missDistance / 4, THREE.MathUtils.clamp(pan - sweep, -1, 1),
          delay / 1000 + along / TRACER_SPEED, THREE.MathUtils.clamp(pan + sweep, -1, 1));
      }
    }
    if (fx.remoteSequences.size > 128) fx.remoteSequences.delete(fx.remoteSequences.keys().next().value);
  }
}

export function resetAk47Session(ctx) {
  const fx = ctx.ak47Effects;
  if (!fx) return;
  fx.recentShots.length = 0;
  fx.remoteSequences.clear();
  fx.triggerItem = null;
  fx.queued = false;
}

function stepRemoteFlashes(ctx, fx, now) {
  let nearest = Infinity;
  fx.remoteLight.intensity = 0;
  for (const { core, flare, firedAt } of fx.flashes) {
    const power = sizeFlash(core, flare, firedAt, now);
    if (!power) continue;
    const distance = ctx.camera.position.distanceToSquared(core.position);
    if (distance < nearest) {
      nearest = distance;
      fx.remoteLight.intensity = 8 * power * power;
      fx.remoteLight.position.copy(core.position);
    }
  }
}

function stepImpacts(fx, now) {
  if (now < fx.nextImpactUpdate) return;
  const mesh = fx.impactMesh;
  const pose = fx.impactPose;
  let count = 0;
  fx.nextImpactUpdate = Infinity;
  for (const impact of fx.impacts) {
    const age = now - impact.at;
    if (age < 0) {
      fx.nextImpactUpdate = Math.min(fx.nextImpactUpdate, impact.at);
      continue;
    }
    if (age >= IMPACT_LIFETIME) continue;
    const remaining = IMPACT_LIFETIME - age;
    pose.position.copy(impact.position);
    pose.quaternion.copy(impact.rotation);
    pose.scale.setScalar(impact.size * Math.min(1, remaining / 2200));
    pose.updateMatrix();
    mesh.setMatrixAt(count++, pose.matrix);
    const refresh = remaining > 2200 ? remaining - 2200 : Math.min(remaining, 65);
    fx.nextImpactUpdate = Math.min(fx.nextImpactUpdate, now + refresh);
  }
  mesh.count = count;
  if (count) mesh.instanceMatrix.needsUpdate = true;
}

export function stepAk47Effects(ctx, dt, now) {
  const fx = ctx.ak47Effects;
  if (!fx) return;
  if (!ctx.isPrimaryDown || now - fx.firedAt > SHOT_INTERVAL + 60) {
    fx.spread = Math.max(0, fx.spread - dt * 2.8);
  }
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

  const flashPower = sizeFlash(fx.flash, fx.flare, fx.firedAt, now);
  fx.light.intensity = 9 * flashPower * flashPower;
  stepRemoteFlashes(ctx, fx, now);
  for (const tracer of fx.tracers) {
    if (tracer.target && now >= tracer.firedAt + tracer.distance / TRACER_SPEED * 1000) {
      tracerPoint(impactPoint, tracer.start, tracer.direction, tracer.distance);
      if (tracer.target.active()) tracer.target.onHit(ctx, tracer.start, impactPoint, tracer.direction);
      tracer.target = null;
    }
    const travel = 0.7 + (now - tracer.firedAt) / 1000 * TRACER_SPEED;
    const head = Math.min(travel, tracer.distance);
    const tail = Math.max(0, travel - 3.4);
    tracer.mesh.visible = now >= tracer.firedAt && head > tail;
    if (!tracer.mesh.visible) continue;
    tracerPoint(segmentStart, tracer.start, tracer.direction, tail);
    tracerPoint(segmentEnd, tracer.start, tracer.direction, head);
    segmentDirection.subVectors(segmentEnd, segmentStart);
    const length = segmentDirection.length();
    tracer.mesh.position.copy(segmentStart).lerp(segmentEnd, 0.5);
    tracer.mesh.quaternion.setFromUnitVectors(forward, segmentDirection.divideScalar(length));
    tracer.mesh.scale.z = length;
  }
  stepImpacts(fx, now);

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
