/**
 * Fisica do Jogador, Veiculos (Snowboard/Paraglider), Camera e Avatar Local (MycoCampus3D)
 */

import { GAME_CONFIG } from '../core/config.js';
import {
  terrainHeight,
  getGroundHeight,
  getSurfaceTypeAt,
  clampPosAgainstWalls
} from '../engine/physics.js';
import { animateAvatarAura } from '../entities/avatars.js';
import { getHeldBoardToolColor } from './chalkboard.js';

const THREE = window.THREE;
const P = GAME_CONFIG.player;
const V = GAME_CONFIG.vehicles;
const A = GAME_CONFIG.atmosphere;
const thermalDummy = new THREE.Object3D();

function getHorizontalWorldBound(altitude) {
  const spaceBlend = Math.max(0, Math.min(1,
    (altitude - A.spaceTransitionAltitude) / (A.spaceAltitude - A.spaceTransitionAltitude)
  ));
  return P.worldBound + (P.spaceBound - P.worldBound) * spaceBlend;
}

function altitudeLayer(altitude) {
  if (altitude >= A.spaceAltitude) return 'Espaço';
  if (altitude >= A.thermosphere) return 'Termosfera';
  if (altitude >= A.mesosphere) return 'Mesosfera';
  if (altitude >= A.stratosphere) return 'Estratosfera';
  return 'Troposfera';
}

function updateFlightHud(ctx, altitude, inThermal, now) {
  if (!ctx.flightHud) return;
  const isFlying = ctx.inFps && ctx.paragliderActive;
  ctx.flightHud.classList.toggle('hidden', !isFlying);
  if (!isFlying || now - ctx.lastFlightHudUpdate < 140) return;
  ctx.lastFlightHudUpdate = now;

  if (ctx.flightHudAltitude) {
    ctx.flightHudAltitude.textContent = altitude >= 1000
      ? (altitude / 1000).toFixed(2) + ' km'
      : Math.round(altitude) + ' m';
  }
  if (ctx.flightHudLayer) ctx.flightHudLayer.textContent = altitudeLayer(altitude);
  if (ctx.flightHudWind) {
    if (altitude >= A.spaceAltitude && Math.abs(ctx.playerVelY) < 1) {
      ctx.flightHudWind.textContent = 'Flutuando';
    } else {
      const windSpeed = altitude >= A.spaceAltitude
        ? Math.abs(ctx.playerVelY)
        : (inThermal
          ? (altitude < 1500 ? 24 : (altitude < A.stratosphere ? 65 : (altitude < A.mesosphere ? 350 : 1000)))
          : 2.2);
      ctx.flightHudWind.textContent = Math.round(windSpeed) + ' m/s' + (inThermal ? ' • ascendente' : '');
    }
  }
  if (ctx.flightHudSpaceHint) {
    ctx.flightHudSpaceHint.classList.toggle('hidden', altitude < A.spaceAltitude);
  }
}

export function stepPlayerMovement(ctx, dt, now) {
  let moveZ = (ctx.keys['KeyW'] || ctx.keys['ArrowUp'] ? 1 : 0) - (ctx.keys['KeyS'] || ctx.keys['ArrowDown'] ? 1 : 0) - ctx.joyY;
  let moveX = (ctx.keys['KeyD'] || ctx.keys['ArrowRight'] ? 1 : 0) - (ctx.keys['KeyA'] || ctx.keys['ArrowLeft'] ? 1 : 0) + ctx.joyX;
  const mag = Math.hypot(moveX, moveZ);

  let groundY = getGroundHeight(ctx.physCtx, ctx.playerPos.x, ctx.playerPos.z, ctx.playerPos.y);
  ctx.onGround = (ctx.playerPos.y <= groundY + 0.06 && ctx.playerVelY <= 0.05);

  if (ctx.snowboardActive) {
    if (ctx.seatedSeat) ctx.seatedSeat = null;
    const fwdX = -Math.sin(ctx.playerYaw), fwdZ = -Math.cos(ctx.playerYaw);
    const rightX = Math.cos(ctx.playerYaw), rightZ = -Math.sin(ctx.playerYaw);

    const hL = terrainHeight(ctx.playerPos.x - 0.6, ctx.playerPos.z);
    const hR = terrainHeight(ctx.playerPos.x + 0.6, ctx.playerPos.z);
    const hD = terrainHeight(ctx.playerPos.x, ctx.playerPos.z - 0.6);
    const hU = terrainHeight(ctx.playerPos.x, ctx.playerPos.z + 0.6);
    const gradX = (hR - hL) / 1.2;
    const gradZ = (hU - hD) / 1.2;

    if (ctx.onGround) {
      ctx.playerVelX += (-gradX) * 20.0 * dt;
      ctx.playerVelZ += (-gradZ) * 20.0 * dt;

      if (moveZ > 0.1) {
        ctx.playerVelX += fwdX * moveZ * 10.5 * dt;
        ctx.playerVelZ += fwdZ * moveZ * 10.5 * dt;
      } else if (moveZ < -0.1) {
        const brakeDamp = Math.exp(-5.5 * dt);
        ctx.playerVelX *= brakeDamp;
        ctx.playerVelZ *= brakeDamp;
      }

      const curSpd = Math.hypot(ctx.playerVelX, ctx.playerVelZ);
      if (curSpd > 0.4) {
        const carveSteer = moveX * 0.45;
        let targetDirX = fwdX + rightX * carveSteer;
        let targetDirZ = fwdZ + rightZ * carveSteer;
        const tdLen = Math.hypot(targetDirX, targetDirZ) || 1;
        targetDirX /= tdLen; targetDirZ /= tdLen;
        const align = (ctx.playerVelX * targetDirX + ctx.playerVelZ * targetDirZ) >= 0 ? 1 : -1;
        const desiredVX = targetDirX * curSpd * align;
        const desiredVZ = targetDirZ * curSpd * align;
        const carveBlend = 1 - Math.exp(-3.4 * dt);
        ctx.playerVelX += (desiredVX - ctx.playerVelX) * carveBlend;
        ctx.playerVelZ += (desiredVZ - ctx.playerVelZ) * carveBlend;
      } else if (Math.abs(moveX) > 0.1) {
        ctx.playerVelX += rightX * moveX * 6.0 * dt;
        ctx.playerVelZ += rightZ * moveX * 6.0 * dt;
      }

      const snowFriction = Math.exp(-0.48 * dt);
      ctx.playerVelX *= snowFriction;
      ctx.playerVelZ *= snowFriction;
    }

    let sbSpeed = Math.hypot(ctx.playerVelX, ctx.playerVelZ);
    if (sbSpeed > V.snowboardMaxSpeed) {
      ctx.playerVelX = (ctx.playerVelX / sbSpeed) * V.snowboardMaxSpeed;
      ctx.playerVelZ = (ctx.playerVelZ / sbSpeed) * V.snowboardMaxSpeed;
      sbSpeed = V.snowboardMaxSpeed;
    }

    if (sbSpeed > 0.01) {
      ctx.playerPos.x = Math.max(-P.worldBound, Math.min(P.worldBound, ctx.playerPos.x + ctx.playerVelX * dt));
      ctx.playerPos.z = Math.max(-P.worldBound, Math.min(P.worldBound, ctx.playerPos.z + ctx.playerVelZ * dt));
      clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, P.radius);
    }

    const targetPitch = Math.atan2(-(gradX * fwdX + gradZ * fwdZ), 1);
    const targetRoll = -moveX * 0.24 - Math.max(-0.22, Math.min(0.22, (ctx.playerVelX * rightX + ctx.playerVelZ * rightZ) * 0.025));
    ctx.snowboardPitch += (targetPitch - ctx.snowboardPitch) * Math.min(1, dt * 8);
    ctx.snowboardRoll += (targetRoll - ctx.snowboardRoll) * Math.min(1, dt * 8);
  } else if (ctx.paragliderActive && !ctx.onGround) {
    if (ctx.seatedSeat) ctx.seatedSeat = null;
    const fwdX = -Math.sin(ctx.playerYaw), fwdZ = -Math.cos(ctx.playerYaw);
    const rightX = Math.cos(ctx.playerYaw), rightZ = -Math.sin(ctx.playerYaw);
    const inSpace = ctx.playerPos.y >= A.spaceAltitude;
    const descendWithJoystick = inSpace && ctx.isTouchDevice() && moveZ < -0.75;
    const horizontalMoveZ = descendWithJoystick ? 0 : moveZ;
    const glideSpeed = inSpace
      ? ((ctx.keys['ShiftLeft'] || ctx.keys['ShiftRight'] || ctx.mobileSprint) ? V.spaceBoostSpeed : V.spaceCruiseSpeed)
      : (moveZ > 0.1 ? V.paragliderFastSpeed : (moveZ < -0.1 ? V.paragliderBrakeSpeed : V.paragliderCruiseSpeed));
    const targetVX = inSpace
      ? (fwdX * horizontalMoveZ * glideSpeed) + (rightX * moveX * V.spaceCruiseSpeed * 0.72)
      : (fwdX * glideSpeed) + (rightX * moveX * 3.8);
    const targetVZ = inSpace
      ? (fwdZ * horizontalMoveZ * glideSpeed) + (rightZ * moveX * V.spaceCruiseSpeed * 0.72)
      : (fwdZ * glideSpeed) + (rightZ * moveX * 3.8);
    const airBlend = 1 - Math.exp(-3.2 * dt);
    ctx.playerVelX += (targetVX - ctx.playerVelX) * airBlend;
    ctx.playerVelZ += (targetVZ - ctx.playerVelZ) * airBlend;
    const horizontalBound = getHorizontalWorldBound(ctx.playerPos.y);
    ctx.playerPos.x = Math.max(-horizontalBound, Math.min(horizontalBound, ctx.playerPos.x + ctx.playerVelX * dt));
    ctx.playerPos.z = Math.max(-horizontalBound, Math.min(horizontalBound, ctx.playerPos.z + ctx.playerVelZ * dt));
    clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, P.radius);

    const targetPgRoll = -moveX * 0.28;
    ctx.paragliderRoll += (targetPgRoll - ctx.paragliderRoll) * Math.min(1, dt * 6);
  } else {
    let targetVX = 0, targetVZ = 0;
    if (mag > 0.08) {
      if (ctx.seatedSeat) ctx.seatedSeat = null;
      const isSprinting = !!(ctx.keys['ShiftLeft'] || ctx.keys['ShiftRight'] || ctx.mobileSprint);
      const maxSpeed = isSprinting ? P.sprintSpeed : P.walkSpeed;
      const throttle = Math.min(1, mag);
      moveX /= mag; moveZ /= mag;
      const fwdX = -Math.sin(ctx.playerYaw), fwdZ = -Math.cos(ctx.playerYaw);
      const rightX = Math.cos(ctx.playerYaw), rightZ = -Math.sin(ctx.playerYaw);
      targetVX = (fwdX * moveZ + rightX * moveX) * maxSpeed * throttle;
      targetVZ = (fwdZ * moveZ + rightZ * moveX) * maxSpeed * throttle;
    }
    const accelFactor = 1 - Math.exp(-(mag > 0.08 ? 9.5 : 7.5) * dt);
    ctx.playerVelX += (targetVX - ctx.playerVelX) * accelFactor;
    ctx.playerVelZ += (targetVZ - ctx.playerVelZ) * accelFactor;

    const speedNowWalk = Math.hypot(ctx.playerVelX, ctx.playerVelZ);
    ctx.isWalking = speedNowWalk > 0.2;
    if (speedNowWalk > 0.01) {
      ctx.playerPos.x = Math.max(-P.worldBound, Math.min(P.worldBound, ctx.playerPos.x + ctx.playerVelX * dt));
      ctx.playerPos.z = Math.max(-P.worldBound, Math.min(P.worldBound, ctx.playerPos.z + ctx.playerVelZ * dt));
      clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, P.radius);
    }
  }

  const speedNow = Math.hypot(ctx.playerVelX, ctx.playerVelZ);
  ctx.isWalking = !ctx.snowboardActive && !(ctx.paragliderActive && !ctx.onGround) && speedNow > 0.2;
  groundY = getGroundHeight(ctx.physCtx, ctx.playerPos.x, ctx.playerPos.z, ctx.playerPos.y);

  // Correntes termicas
  let inThermal = false;
  for (let tci = 0; tci < ctx.thermalColumns.length; tci++) {
    const tc = ctx.thermalColumns[tci];
    for (let tri = 0; tri < tc.ringOffsets.length; tri++) {
      const offset = tc.ringOffsets[tri];
      thermalDummy.position.set(
        tc.x,
        tc.baseY + offset + Math.sin(ctx.clock.elapsedTime * 1.2 + tri) * Math.min(18, 3 + offset * 0.00015),
        tc.z
      );
      thermalDummy.rotation.set(-Math.PI / 2, 0, ctx.clock.elapsedTime * 0.35 + tri);
      thermalDummy.scale.setScalar(1 + tri * 0.04);
      thermalDummy.updateMatrix();
      tc.ringMesh.setMatrixAt(tri, thermalDummy.matrix);
    }
    tc.ringMesh.instanceMatrix.needsUpdate = true;
    if (ctx.paragliderActive && !ctx.onGround
      && ctx.playerPos.y < Math.min(tc.maxH, A.spaceAltitude)) {
      if (Math.hypot(ctx.playerPos.x - tc.x, ctx.playerPos.z - tc.z) < tc.radius) {
        inThermal = true;
      }
    }
  }

  if (ctx.paragliderActive && !ctx.onGround) {
    if (ctx.playerPos.y >= A.spaceAltitude) {
      const ascend = (ctx.keys['Space'] || ctx.jumpHeld) ? 1 : 0;
      const descend = (ctx.keys['ControlLeft'] || ctx.keys['ControlRight']
        || (ctx.isTouchDevice() && moveZ < -0.75)) ? 1 : 0;
      const targetVerticalSpeed = (ascend - descend) * V.spaceVerticalSpeed;
      ctx.playerVelY += (targetVerticalSpeed - ctx.playerVelY) * Math.min(1, dt * 3.5);
    } else if (inThermal) {
      const altitude = ctx.playerPos.y;
      const liftSpeed = altitude < 1500
        ? Math.max(V.thermalLiftVelocity, 24)
        : (altitude < A.stratosphere ? 65 : (altitude < A.mesosphere ? 350 : 1000));
      ctx.playerVelY += (liftSpeed - ctx.playerVelY) * Math.min(1, dt * 3.5);
    } else {
      const sinkRate = moveZ < -0.1 ? -5.2 : (moveZ > 0.1 ? -2.15 : -1.55);
      ctx.playerVelY += (sinkRate - ctx.playerVelY) * Math.min(1, dt * 4.5);
    }
  } else {
    if (ctx.playerPos.y < A.spaceAltitude) ctx.playerVelY -= P.gravity * dt;
  }
  ctx.playerPos.y += ctx.playerVelY * dt;
  if (ctx.playerPos.y > A.spaceAltitudeLimit) {
    ctx.playerPos.y = A.spaceAltitudeLimit;
    ctx.playerVelY = Math.min(0, ctx.playerVelY);
  }
  if (ctx.playerPos.y <= groundY) {
    ctx.playerPos.y = groundY;
    ctx.playerVelY = 0;
    ctx.onGround = true;
    ctx.lastGroundedAt = now;
  } else {
    ctx.onGround = false;
  }
  if (ctx.inFps && ctx.isWalking && ctx.onGround && window.MycoAudio) {
    const sType = getSurfaceTypeAt(ctx.playerPos.x, ctx.playerPos.y, ctx.playerPos.z);
    window.MycoAudio.playFootstep(sType);
  }

  const wantsJump = (now <= ctx.jumpBufferUntil) || ctx.keys['Space'] || ctx.jumpHeld;
  if (wantsJump && (ctx.onGround || (now - ctx.lastGroundedAt < P.coyoteTimeMs && ctx.playerVelY <= 0))) {
    if (ctx.seatedSeat) ctx.seatedSeat = null;
    ctx.playerVelY = ctx.paragliderActive ? P.paragliderJumpVelocity : (ctx.snowboardActive ? P.snowboardJumpVelocity : P.jumpVelocity);
    ctx.onGround = false;
    ctx.lastGroundedAt = 0;
    ctx.jumpBufferUntil = 0;
  }

  let bobY = 0;
  if (!ctx.snowboardActive && !(ctx.paragliderActive && !ctx.onGround) && ctx.onGround && speedNow > 0.25) {
    ctx.walkBobPhase += dt * (4.5 + speedNow * 1.4);
    bobY = Math.sin(ctx.walkBobPhase) * 0.028 * Math.min(1, speedNow / 3.8);
  }
  const eyeH = ctx.seatedSeat ? P.seatedEyeHeight : (ctx.snowboardActive ? P.snowboardEyeHeight : P.eyeHeight);
  if (ctx.seatedSeat) {
    ctx.playerPos.set(ctx.seatedSeat.x, ctx.seatedSeat.y, ctx.seatedSeat.z);
    ctx.playerVelY = 0;
  }
  if (ctx.snowboardGroup) {
    ctx.snowboardGroup.visible = ctx.snowboardActive && ctx.inFps;
    if (ctx.snowboardGroup.visible) {
      ctx.snowboardGroup.position.set(ctx.playerPos.x, ctx.playerPos.y + 0.03, ctx.playerPos.z);
      ctx.snowboardGroup.rotation.order = 'YXZ';
      ctx.snowboardGroup.rotation.y = ctx.playerYaw - 0.35;
      ctx.snowboardGroup.rotation.x = ctx.snowboardPitch;
      ctx.snowboardGroup.rotation.z = ctx.snowboardRoll;
    }
  }
  if (ctx.paragliderGroup) {
    ctx.paragliderGroup.visible = ctx.paragliderActive && !ctx.onGround
      && ctx.inFps && ctx.playerPos.y < A.spaceAltitude;
    if (ctx.paragliderGroup.visible) {
      ctx.paragliderGroup.position.set(ctx.playerPos.x, ctx.playerPos.y + 0.45, ctx.playerPos.z);
      ctx.paragliderGroup.rotation.order = 'YXZ';
      ctx.paragliderGroup.rotation.y = ctx.playerYaw;
      ctx.paragliderGroup.rotation.z = ctx.paragliderRoll;
    }
  }
  ctx.camera.position.set(ctx.playerPos.x, ctx.playerPos.y + eyeH + bobY, ctx.playerPos.z);
  const altitude = Math.max(0, ctx.playerPos.y);
  const targetCameraFar = altitude >= A.spaceTransitionAltitude
    ? 32000
    : (altitude >= A.mesosphere
      ? 22000
      : (altitude >= A.stratosphere
        ? 10000
        : (altitude >= 2000 ? 3500 : (ctx.isTouchDevice() ? 1100 : 1800))));
  if (Math.abs(ctx.camera.far - targetCameraFar) > 1) {
    ctx.camera.far = targetCameraFar;
    ctx.camera.updateProjectionMatrix();
  }
  updateFlightHud(ctx, altitude, inThermal, now);
  ctx.camera.up.set(0, 1, 0);
  ctx.camera.rotation.order = 'YXZ';
  ctx.camera.rotation.y = ctx.playerYaw;
  ctx.camera.rotation.x = ctx.playerPitch;
  ctx.camera.rotation.z = ctx.snowboardActive ? ctx.snowboardRoll * 0.35 : ((ctx.paragliderActive && !ctx.onGround) ? ctx.paragliderRoll * 0.45 : 0);

  // Bracos em 1a pessoa
  const isTwoHanded = !!(ctx.heldItem && ctx.heldItem.mesh.userData.twoHanded);
  if (ctx.fpsArmGroup) {
    ctx.fpsArmGroup.visible = true;
    if (ctx.paragliderActive && !ctx.onGround) {
      ctx.fpsArmGroup.position.set(0.32, 0.06, -0.34);
      ctx.fpsArmGroup.rotation.set(0.85, -0.10, -0.15);
    } else if (ctx.snowboardActive) {
      ctx.fpsArmGroup.position.set(0.42, -0.22, -0.34);
      ctx.fpsArmGroup.rotation.set(0.10, -0.45, -0.25);
    } else {
      const drawingNow = !!(ctx.isPrimaryDown && ctx.hoveredBoardHit && getHeldBoardToolColor(ctx.heldItem));
      ctx.armReach += ((drawingNow ? 1 : 0) - ctx.armReach) * Math.min(1, dt * 14);
      if (speedNow > 0.2) ctx.armSwingPhase += dt * 7;
      ctx.fpsArmGroup.position.set(
        (isTwoHanded ? 0.27 : 0.32) - ctx.armReach * 0.08,
        (isTwoHanded ? -0.34 : -0.28) + Math.sin(ctx.armSwingPhase) * 0.014 + ctx.armReach * 0.06,
        (isTwoHanded ? -0.56 : -0.42) - ctx.armReach * 0.16
      );
      ctx.fpsArmGroup.rotation.set(0.18 + ctx.armReach * 0.35, (isTwoHanded ? 0.12 : -0.14) + ctx.armReach * 0.1, 0.05);
    }
  }
  if (ctx.fpsLeftArmGroup) {
    ctx.fpsLeftArmGroup.visible = isTwoHanded || (ctx.paragliderActive && !ctx.onGround) || ctx.snowboardActive;
    if (ctx.paragliderActive && !ctx.onGround) {
      ctx.fpsLeftArmGroup.position.set(-0.32, 0.06, -0.34);
      ctx.fpsLeftArmGroup.rotation.set(0.85, 0.10, 0.15);
    } else if (ctx.snowboardActive) {
      ctx.fpsLeftArmGroup.position.set(-0.42, -0.22, -0.34);
      ctx.fpsLeftArmGroup.rotation.set(0.10, 0.45, 0.25);
    } else if (isTwoHanded) {
      ctx.fpsLeftArmGroup.position.set(-0.27, -0.34 + Math.sin(ctx.armSwingPhase) * 0.014, -0.56);
      ctx.fpsLeftArmGroup.rotation.set(0.18, -0.12, -0.05);
    }
  }

  // Avatar local
  if (ctx.localAvatar) {
    ctx.localAvatar.group.visible = true;
    if (ctx.auraEnabled) animateAvatarAura(ctx.localAvatar, ctx.clock.elapsedTime);
    const backOff = ctx.seatedSeat ? 0.02 : 0.14;
    ctx.localAvatar.group.position.set(
      ctx.playerPos.x + Math.sin(ctx.playerYaw) * backOff,
      ctx.playerPos.y,
      ctx.playerPos.z + Math.cos(ctx.playerYaw) * backOff
    );
    ctx.localAvatar.group.rotation.y = ctx.playerYaw;
    if (ctx.seatedSeat) {
      if (ctx.localAvatar.torso) {
        ctx.localAvatar.torso.visible = false;
        ctx.localAvatar.torso.position.set(0, 0.60, 0);
      }
      ctx.localAvatar.leftLeg.position.set(-0.11, 0.41, 0);
      ctx.localAvatar.rightLeg.position.set(0.11, 0.41, 0);
      ctx.localAvatar.leftLeg.rotation.x = Math.PI / 2;
      ctx.localAvatar.rightLeg.rotation.x = Math.PI / 2;
    } else {
      if (ctx.localAvatar.torso) {
        ctx.localAvatar.torso.visible = true;
        ctx.localAvatar.torso.position.set(0, 0.64, 0);
      }
      ctx.localAvatar.leftLeg.position.set(-0.10, 0.38, 0);
      ctx.localAvatar.rightLeg.position.set(0.10, 0.38, 0);
      if (ctx.isWalking) {
        ctx.localAvatar.walkPhase += dt * 10;
        ctx.localAvatar.leftLeg.rotation.x = Math.sin(ctx.localAvatar.walkPhase) * 0.55;
        ctx.localAvatar.rightLeg.rotation.x = -Math.sin(ctx.localAvatar.walkPhase) * 0.55;
      } else {
        ctx.localAvatar.leftLeg.rotation.x *= 0.8;
        ctx.localAvatar.rightLeg.rotation.x *= 0.8;
      }
    }
    ctx.localAvatar.headGroup.visible = false;
    ctx.localAvatar.leftArm.visible = false;
    ctx.localAvatar.rightArm.visible = false;
  }
}
