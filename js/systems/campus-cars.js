import { appState } from '../core/state.js';
import { t } from '../core/i18n.js';
import { clampPosAgainstWalls, getGroundHeight } from '../engine/physics.js';
import { PICKUP_DOOR_X, PICKUP_DOOR_Z } from '../items/campus-pickup.js';
import { saveLocalMovedObject } from './local-world-objects.js';
import { isRayOccludedByStructure } from './ray-occlusion.js';

const THREE = window.THREE;
const worldPoint = new THREE.Vector3();
const fromDoor = new THREE.Vector3();
const endCamera = new THREE.Vector3();
const probe = new THREE.Vector3();
const hits = [];
const SEATS = ['driver', 'passenger'];
const ENTER_MS = 850;
const EXIT_MS = 760;
const EXIT_X = PICKUP_DOOR_X + 0.26;
const FRONT_PROBES = [-1.37, 0, 1.37];

function allCars(ctx) { return ctx.scene?.userData?.campusCars || []; }
function seatSide(seat) { return seat === 'driver' ? -1 : 1; }
function angleDelta(target, current) { return Math.atan2(Math.sin(target - current), Math.cos(target - current)); }
function seated(ctx) { return ctx.campusRide?.phase === 'seated'; }

export function getAimedCarSeat(ctx) {
  if (!ctx.inFps || ctx.heldItem || ctx.adminEditMode || ctx.placementMode || ctx.campusRide || ctx.campusCarRequest) return null;
  if (ctx.snowboardActive || ctx.skateboardActive || (ctx.paragliderActive && !ctx.onGround)) return null;
  let best = null;
  let distance = 3.1;
  for (const item of allCars(ctx)) {
    if (!item.mesh.visible || item._removedForSync || item._adminRemoved ||
        item.mesh.position.distanceToSquared(ctx.playerPos) > 22) continue;
    item.mesh.updateMatrixWorld(true);
    for (const seat of SEATS) {
      const side = seatSide(seat);
      worldPoint.copy(ctx.playerPos);
      item.mesh.worldToLocal(worldPoint);
      if (worldPoint.x * side < 0.73) continue;
      hits.length = 0;
      ctx.raycaster.intersectObject(item.campusCar.doors[seat], true, hits);
      const hit = hits[0];
      if (hit && hit.distance < distance && !isRayOccludedByStructure(ctx, hit.distance, {
        checkWalls: true, ignoreCollider: item.campusCar.collider
      })) {
        best = { item, seat };
        distance = hit.distance;
      }
    }
  }
  return best;
}

function beginRide(ctx, item, seat, now) {
  ctx.seatedSeat = null;
  ctx.campusRide = {
    item, seat, phase: 'enter', at: now, from: ctx.camera.position.clone(),
    outside: ctx.playerPos.clone(), radio: false, entryYaw: ctx.playerYaw
  };
  if (seat === 'driver') item.campusCar.speed = 0;
  window.MycoAudio?.playDoor?.(true);
}

export function enterCampusCar(ctx, aim = ctx.hoveredCarSeat) {
  if (!aim || !ctx.inFps || ctx.campusRide || ctx.campusCarRequest || ctx.heldItem) return false;
  const { item, seat } = aim;
  const car = item.campusCar;
  if (seat === 'driver' && !car.owned) {
    ctx.callbacks?.onToast?.(t('ui.car.owner'));
    return true;
  }
  if (car[seat] || Math.abs(car.speed) > 1.4) {
    ctx.callbacks?.onToast?.(t('ui.car.busy'));
    return true;
  }
  const now = performance.now();
  if (appState.currentUser?.id != null) {
    ctx.campusCarRequest = { id: item.id, seat, op: 'enter', at: now };
    ctx.notifyWorldAction?.();
  } else {
    beginRide(ctx, item, seat, now);
  }
  return true;
}

export function getCampusCarActions(ctx) {
  if (!ctx.campusRide && !ctx.hoveredCarSeat) return null;
  if (!ctx.campusRide) {
    const aim = ctx.hoveredCarSeat;
    return [{ id: 'car_enter', key: 'F', label: t(aim.seat === 'driver' ? 'ui.car.enter_driver' : 'ui.car.enter_passenger'),
      primary: true, run: () => enterCampusCar(ctx, aim) }];
  }
  if (!seated(ctx)) return [];
  const ride = ctx.campusRide;
  const actions = [{
    id: 'car_exit', key: 'F', label: t('ui.car.exit'), primary: true,
    run: () => leaveCampusCar(ctx)
  }];
  if (ride.seat === 'driver') actions.push({
    id: 'car_lights', key: 'V', label: t('ui.car.lights'),
    run: () => { if (seated(ctx)) ride.item.campusCar.lights = !ride.item.campusCar.lights; }
  });
  actions.push({
    id: 'car_radio', key: 'Z', label: t('ui.car.radio'),
    run: () => { if (seated(ctx)) ride.radio = !ride.radio; }
  });
  return actions;
}

export function leaveCampusCar(ctx) {
  const ride = ctx.campusRide;
  if (ride?.phase !== 'seated') return false;
  if (Math.abs(ride.item.campusCar.speed) > 0.85) {
    ctx.callbacks?.onToast?.(t('ui.car.stop'));
    return true;
  }
  ride.phase = 'exit';
  ride.at = performance.now();
  ride.from.copy(ctx.camera.position);
  window.MycoAudio?.playDoor?.(true);
  return true;
}

export function getCampusCarSync(ctx) {
  const request = ctx.campusCarRequest;
  if (request) return { id: request.id, seat: request.seat, op: request.op };
  const ride = ctx.campusRide;
  if (!ride) return null;
  const { item, seat } = ride;
  const car = item.campusCar;
  const { x, y, z } = item.mesh.position;
  return { id: item.id, seat, op: 'ride', pose: seat === 'driver' ? {
    x, y, z, yaw: item.mesh.rotation.y, speed: car.speed, steer: car.steer, lights: car.lights
  } : null };
}

export function applyCampusCars(ctx, snapshots, seatResult, now = performance.now()) {
  const activeRemoteSeats = new Set();
  for (const item of allCars(ctx)) {
    const data = snapshots?.[item.id];
    if (!data) continue;
    const car = item.campusCar;
    if (car.updated) {
      for (const seat of SEATS) {
        if (car[seat] !== data[seat]) car.doorUntil[seat] = now + ENTER_MS;
      }
    } else {
      item.mesh.position.set(data.x, data.y, data.z);
      item.mesh.rotation.y = data.yaw;
    }
    car.updated = car.hosted = true;
    car.driver = data.driver;
    car.passenger = data.passenger;
    car.owned = data.owned;
    car.origin.set(data.x, data.y, data.z);
    car.targetYaw = data.yaw;
    for (const seat of SEATS) {
      const avatar = ctx.remoteAvatars?.[data[seat]];
      if (avatar) {
        activeRemoteSeats.add(avatar);
        if (avatar.campusVehicle?.item !== item || avatar.campusVehicle.seat !== seat) {
          avatar.campusVehicle = { item, seat, at: now, from: avatar.group.position.clone() };
        }
      }
    }
    if (ctx.campusRide?.item !== item || ctx.campusRide.seat !== 'driver') {
      car.speed = data.speed;
      car.steer = data.steer;
      car.lights = data.lights;
    } else if (item.mesh.position.distanceToSquared(car.origin) > 28) {
      item.mesh.position.copy(car.origin);
      item.mesh.rotation.y = data.yaw;
      car.speed = data.speed;
    }
  }
  for (const avatar of Object.values(ctx.remoteAvatars || {})) {
    if (!activeRemoteSeats.has(avatar)) avatar.campusVehicle = null;
  }
  if (!seatResult) return;
  const request = ctx.campusCarRequest;
  if (request?.id === seatResult.id) {
    ctx.campusCarRequest = null;
    if (request.op === 'enter' && seatResult.seat) {
      const item = allCars(ctx).find(candidate => candidate.id === seatResult.id && candidate.mesh.visible);
      if (item) beginRide(ctx, item, seatResult.seat, now);
    } else if (seatResult.error) {
      ctx.callbacks?.onToast?.(t('ui.car.' + seatResult.error));
    }
  } else if (ctx.campusRide?.item.id === seatResult.id && !seatResult.seat) {
    finishExit(ctx);
  }
}

function driveCar(ctx, ride, dt) {
  const { item } = ride;
  const mesh = item.mesh;
  const car = item.campusCar;
  const throttle = THREE.MathUtils.clamp(
    Number(!!(ctx.keys.KeyW || ctx.keys.ArrowUp)) - Number(!!(ctx.keys.KeyS || ctx.keys.ArrowDown)) - ctx.joyY, -1, 1);
  const turn = THREE.MathUtils.clamp(
    Number(!!(ctx.keys.KeyD || ctx.keys.ArrowRight)) - Number(!!(ctx.keys.KeyA || ctx.keys.ArrowLeft)) + ctx.joyX, -1, 1);
  const braking = !!ctx.keys.Space;
  const targetSpeed = braking ? 0 : throttle * (throttle < 0 ? 4.2 : 12.5);
  car.speed = THREE.MathUtils.lerp(car.speed, targetSpeed, 1 - Math.exp(-(braking ? 7 : throttle ? 2.1 : 1.45) * dt));
  if (Math.abs(car.speed) < 0.03) car.speed = 0;
  car.steer = THREE.MathUtils.lerp(car.steer, turn, 1 - Math.exp(-9 * dt));
  const previousYaw = mesh.rotation.y;
  const steerYaw = -car.steer * car.speed * dt * 0.19;
  const yaw = previousYaw + steerYaw;
  const { x, y, z } = mesh.position;
  const nx = x - Math.sin(yaw) * car.speed * dt;
  const nz = z - Math.cos(yaw) * car.speed * dt;
  const floor = getGroundHeight(ctx.physCtx, nx, nz, y, null, y + 0.42);
  let blocked = Math.abs(floor - y) > 0.5;
  for (const distance of FRONT_PROBES) {
    if (blocked) break;
    probe.set(nx + Math.sin(yaw) * distance, floor + 0.22, nz + Math.cos(yaw) * distance);
    probe.ignoreCollider = car.collider;
    const probeX = probe.x;
    const probeZ = probe.z;
    clampPosAgainstWalls(ctx.physCtx, probe, 0.96);
    blocked = Math.hypot(probe.x - probeX, probe.z - probeZ) > 0.055;
  }
  if (blocked) {
    car.speed = 0;
    return;
  }
  mesh.position.set(nx, THREE.MathUtils.lerp(y, floor, 1 - Math.exp(-10 * dt)), nz);
  mesh.rotation.y = angleDelta(yaw, 0);
  ctx.playerYaw += angleDelta(mesh.rotation.y, previousYaw);
  car.origin.copy(mesh.position);
  car.targetYaw = mesh.rotation.y;
}

function finishExit(ctx) {
  const ride = ctx.campusRide;
  if (!ride) return;
  const { item, seat } = ride;
  item.mesh.localToWorld(fromDoor.set(seatSide(seat) * EXIT_X, 0, PICKUP_DOOR_Z));
  const y = getGroundHeight(ctx.physCtx, fromDoor.x, fromDoor.z, item.mesh.position.y);
  ctx.playerPos.set(fromDoor.x, y, fromDoor.z);
  clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, 0.32);
  window.MycoAudio?.setCampusCarAudio?.();
  window.MycoAudio?.playDoor?.(false);
  if (appState.currentUser?.id != null) {
    ctx.campusCarRequest = { id: item.id, seat, op: 'leave', at: performance.now() };
    ctx.notifyWorldAction?.();
  } else {
    saveLocalMovedObject(item);
  }
  ctx.campusRide = null;
}

export function resetCampusCarRide(ctx, leave = false) {
  if (leave && ctx.campusRide) {
    finishExit(ctx);
    return;
  }
  ctx.campusRide = null;
  ctx.campusCarRequest = null;
  window.MycoAudio?.setCampusCarAudio?.();
}

export function stepCampusCarRide(ctx, dt, now) {
  const ride = ctx.campusRide;
  if (!ride) return false;
  const { item, seat } = ride;
  const car = item.campusCar;
  if (!item.mesh.visible || item._removedForSync || item._adminRemoved) {
    finishExit(ctx);
    return false;
  }
  if (ride.phase === 'seated' && seat === 'driver') driveCar(ctx, ride, dt);
  const elapsed = now - ride.at;
  if (ride.phase === 'enter' && elapsed >= ENTER_MS) {
    ride.phase = 'seated';
    window.MycoAudio?.playDoor?.(false);
  } else if (ride.phase === 'exit' && elapsed >= EXIT_MS) {
    finishExit(ctx);
    return false;
  }
  item.mesh.localToWorld(worldPoint.set(seatSide(seat) * 0.48, 0.78, 0.05));
  if (ride.phase === 'enter') ctx.playerPos.copy(ride.outside).lerp(worldPoint, Math.min(1, elapsed / ENTER_MS));
  else ctx.playerPos.copy(worldPoint);
  ctx.playerVelX = ctx.playerVelY = ctx.playerVelZ = 0;
  ctx.isWalking = false;
  item.mesh.localToWorld(endCamera.set(seatSide(seat) * 0.48, 1.65, 0.075));
  if (ride.phase === 'exit') {
    item.mesh.localToWorld(endCamera.set(seatSide(seat) * EXIT_X, 1.67, PICKUP_DOOR_Z));
    ctx.playerPos.lerp(worldPoint.copy(endCamera).add(probe.set(0, -1.65, 0)), Math.min(1, elapsed / EXIT_MS));
  }
  const progress = ride.phase === 'seated' ? 1 : Math.max(0, Math.min(1, elapsed / (ride.phase === 'enter' ? ENTER_MS : EXIT_MS)));
  ctx.camera.position.copy(ride.from).lerp(endCamera, progress * progress * (3 - 2 * progress));
  const yaw = item.mesh.rotation.y;
  ctx.playerYaw = yaw + THREE.MathUtils.clamp(angleDelta(ctx.playerYaw, yaw), -1.5, 1.5);
  const viewYaw = ride.phase === 'enter' ? yaw + angleDelta(ride.entryYaw, yaw) * (1 - progress) : ctx.playerYaw;
  ctx.camera.rotation.set(THREE.MathUtils.clamp(ctx.playerPitch, -0.8, 0.66), viewYaw, 0, 'YXZ');
  if (ctx.fpsArmGroup) ctx.fpsArmGroup.visible = false;
  if (ctx.fpsLeftArmGroup) ctx.fpsLeftArmGroup.visible = false;
  if (ctx.localAvatar) ctx.localAvatar.group.visible = false;
  car.screen.emissiveIntensity = ride.radio ? 0.85 : 0.2;
  window.MycoAudio?.setCampusCarAudio?.(Math.abs(car.speed) / 12.5, ride.radio);
  return true;
}

export function stepCampusCars(ctx, dt, now) {
  if (ctx.campusCarRequest && now - ctx.campusCarRequest.at > 3500) ctx.campusCarRequest = null;
  const ride = ctx.campusRide;
  for (const item of allCars(ctx)) {
    const { mesh, campusCar: car } = item;
    if (item._adminRemoved || item._removedForSync || !mesh.visible) {
      if (car.collider) car.collider._disabled = true;
      continue;
    }
    if (car.hosted && (ride?.item !== item || ride.seat !== 'driver')) {
      const blend = 1 - Math.exp(-10 * dt);
      mesh.position.lerp(car.origin, blend);
      mesh.rotation.y += angleDelta(car.targetYaw, mesh.rotation.y) * blend;
    }
    for (const seat of SEATS) {
      const local = ride?.item === item && ride.seat === seat;
      let amount = 0;
      if (local && ride.phase !== 'seated') {
        const duration = ride.phase === 'enter' ? ENTER_MS : EXIT_MS;
        amount = Math.sin(Math.PI * THREE.MathUtils.clamp((now - ride.at) / duration, 0, 1));
      } else if (!local && car.doorUntil[seat] > now) {
        amount = Math.sin(Math.PI * (car.doorUntil[seat] - now) / ENTER_MS);
      }
      car.doors[seat].rotation.y = seatSide(seat) * amount * 1.02;
    }
    car.wheelSpin = (car.wheelSpin + car.speed * dt / 0.45) % (Math.PI * 2);
    for (const wheel of car.wheels) {
      wheel.roll.rotation.x = -car.wheelSpin;
      wheel.steerPivot.rotation.y = wheel.front ? -car.steer * 0.38 : 0;
    }
    car.steering.rotation.z = -car.steer * 1.05;
    car.headlamp.emissiveIntensity = car.lights ? 2.8 : 0.22;
    car.headlightGlow.intensity = car.lights ? 26 : 0;
    if (ctx.solidColliders) {
      if (!car.collider) {
        car.collider = { _isCampusCar: true };
        ctx.solidColliders.push(car.collider);
      }
      const sine = Math.abs(Math.sin(mesh.rotation.y));
      const cosine = Math.abs(Math.cos(mesh.rotation.y));
      const xSize = 0.93 * cosine + 2.04 * sine;
      const zSize = 2.04 * cosine + 0.93 * sine;
      Object.assign(car.collider, {
        _disabled: false, minX: mesh.position.x - xSize, maxX: mesh.position.x + xSize,
        minZ: mesh.position.z - zSize, maxZ: mesh.position.z + zSize,
        minY: mesh.position.y, maxY: mesh.position.y + 1.38
      });
    }
  }
}
