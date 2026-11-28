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
import { fitHandHorizontally, resetHeldSleeve } from '../entities/first-person-grip.js';
import { getHeldBoardToolColor } from './chalkboard.js';

const P = GAME_CONFIG.player;
const V = GAME_CONFIG.vehicles;

export function stepPlayerMovement(ctx, dt, now) {
  let moveZ = (ctx.keys['KeyW'] || ctx.keys['ArrowUp'] ? 1 : 0) - (ctx.keys['KeyS'] || ctx.keys['ArrowDown'] ? 1 : 0) - ctx.joyY;
  let moveX = (ctx.keys['KeyD'] || ctx.keys['ArrowRight'] ? 1 : 0) - (ctx.keys['KeyA'] || ctx.keys['ArrowLeft'] ? 1 : 0) + ctx.joyX;
  const mag = Math.hypot(moveX, moveZ);

  let groundY = getGroundHeight(ctx.physCtx, ctx.playerPos.x, ctx.playerPos.z, ctx.playerPos.y);
  ctx.onGround = (ctx.playerPos.y <= groundY + 0.06 && ctx.playerVelY <= 0.05);

  if (ctx.snowboardActive || ctx.skateboardActive) {
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

    // Positivo em X levanta a frente (-Z) na subida, evitando a ponta entrar na terra
    const targetPitch = Math.atan2(gradX * fwdX + gradZ * fwdZ, 1);
    const targetRoll = -moveX * 0.30 - Math.max(-0.26, Math.min(0.26, (ctx.playerVelX * rightX + ctx.playerVelZ * rightZ) * 0.03));
    ctx.snowboardPitch += (targetPitch - ctx.snowboardPitch) * Math.min(1, dt * 8);
    ctx.snowboardRoll += (targetRoll - ctx.snowboardRoll) * Math.min(1, dt * 8);
  } else if (ctx.paragliderActive && !ctx.onGround) {
    if (ctx.seatedSeat) ctx.seatedSeat = null;
    const fwdX = -Math.sin(ctx.playerYaw), fwdZ = -Math.cos(ctx.playerYaw);
    const rightX = Math.cos(ctx.playerYaw), rightZ = -Math.sin(ctx.playerYaw);
    const glideSpeed = moveZ > 0.1 ? V.paragliderFastSpeed : (moveZ < -0.1 ? V.paragliderBrakeSpeed : V.paragliderCruiseSpeed);
    const targetVX = (fwdX * glideSpeed) + (rightX * moveX * 3.8);
    const targetVZ = (fwdZ * glideSpeed) + (rightZ * moveX * 3.8);
    const airBlend = 1 - Math.exp(-3.2 * dt);
    ctx.playerVelX += (targetVX - ctx.playerVelX) * airBlend;
    ctx.playerVelZ += (targetVZ - ctx.playerVelZ) * airBlend;
    ctx.playerPos.x = Math.max(-P.worldBound, Math.min(P.worldBound, ctx.playerPos.x + ctx.playerVelX * dt));
    ctx.playerPos.z = Math.max(-P.worldBound, Math.min(P.worldBound, ctx.playerPos.z + ctx.playerVelZ * dt));
    clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, P.radius);

    const targetPgRoll = -moveX * 0.28;
    ctx.paragliderRoll += (targetPgRoll - ctx.paragliderRoll) * Math.min(1, dt * 6);
  } else {
    let targetVX = 0, targetVZ = 0;
    if (mag > 0.08) {
      if (ctx.seatedSeat) ctx.seatedSeat = null;
      const isSprinting = !!(ctx.keys['ShiftLeft'] || ctx.keys['ShiftRight'] || ctx.mobileSprint);
      const isCrouching = !ctx.seatedSeat && !ctx.paragliderActive && !(ctx.snowboardActive || ctx.skateboardActive) &&
        !!(ctx.keys['ControlLeft'] || ctx.keys['ControlRight'] || ctx.keys['KeyC'] || ctx.mobileCrouch);
      let maxSpeed = (isSprinting ? P.sprintSpeed : P.walkSpeed) * (window.getTripSpeedMultiplier ? window.getTripSpeedMultiplier() : 1);
      if (isCrouching) maxSpeed *= 0.55;
      const throttle = Math.min(1, mag);
      moveX /= mag; moveZ /= mag;
      const fwdX = -Math.sin(ctx.playerYaw), fwdZ = -Math.cos(ctx.playerYaw);
      const rightX = Math.cos(ctx.playerYaw), rightZ = -Math.sin(ctx.playerYaw);
      targetVX = (fwdX * moveZ + rightX * moveX) * maxSpeed * throttle;
      targetVZ = (fwdZ * moveZ + rightZ * moveX) * maxSpeed * throttle;
    }
    const accelFactor = 1 - Math.exp(-(mag > 0.08 ? 9.5 : 7.5) * dt);
    if (typeof window !== 'undefined' && window.isTripFreakoutActive && window.isTripFreakoutActive()) {
      const tStagger = (ctx.clock ? ctx.clock.elapsedTime : now * 0.001);
      targetVX += Math.sin(tStagger * 2.3) * 1.55 + Math.cos(tStagger * 4.1) * 0.65;
      targetVZ += Math.cos(tStagger * 1.8) * 1.45 + Math.sin(tStagger * 3.7) * 0.65;
    }
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
  ctx.isWalking = !(ctx.snowboardActive || ctx.skateboardActive) && !(ctx.paragliderActive && !ctx.onGround) && speedNow > 0.2;
  groundY = getGroundHeight(ctx.physCtx, ctx.playerPos.x, ctx.playerPos.z, ctx.playerPos.y);

  // Correntes termicas
  let inThermal = false;
  if (ctx.paragliderActive && !ctx.onGround) {
    for (const tc of ctx.thermalColumns) {
      if (ctx.playerPos.y < tc.maxH && Math.hypot(ctx.playerPos.x - tc.x, ctx.playerPos.z - tc.z) < tc.radius) {
        inThermal = true;
        break;
      }
    }
  }

  if ((ctx.paragliderActive || ctx.roundParachuteActive) && !ctx.onGround) {
    if (inThermal && ctx.paragliderActive) {
      ctx.playerVelY += (V.thermalLiftVelocity - ctx.playerVelY) * Math.min(1, dt * 3.5);
    } else {
      const sinkRate = ctx.roundParachuteActive ? -2.35 : (moveZ < -0.1 ? -5.2 : (moveZ > 0.1 ? -2.15 : -1.55));
      ctx.playerVelY += (sinkRate - ctx.playerVelY) * Math.min(1, dt * 4.5);
    }
  } else {
    ctx.playerVelY -= P.gravity * dt;
  }
  ctx.playerPos.y += ctx.playerVelY * dt;
  if (ctx.playerPos.y <= groundY) {
    ctx.playerPos.y = groundY;
    ctx.playerVelY = 0;
    ctx.onGround = true;
    ctx.lastGroundedAt = now;
    if (ctx.roundParachuteActive) {
      ctx.roundParachuteActive = false;
      if (ctx.roundParachuteGroup) ctx.roundParachuteGroup.visible = false;
    }
  } else {
    ctx.onGround = false;
  }
  if (ctx.inFps && ctx.isWalking && ctx.onGround && window.MycoAudio) {
    const sType = getSurfaceTypeAt(ctx.playerPos.x, ctx.playerPos.y, ctx.playerPos.z);
    window.MycoAudio.playFootstep(sType);
  }

  const isCrawlingUmbral = typeof window !== 'undefined' && window.isTripCrawlingActive && window.isTripCrawlingActive();
  const wantsJump = !isCrawlingUmbral && ((now <= ctx.jumpBufferUntil) || ctx.keys['Space'] || ctx.jumpHeld);
  if (wantsJump && (ctx.onGround || (now - ctx.lastGroundedAt < P.coyoteTimeMs && ctx.playerVelY <= 0))) {
    if (ctx.seatedSeat) ctx.seatedSeat = null;
    ctx.playerVelY = ctx.paragliderActive ? P.paragliderJumpVelocity : ((ctx.snowboardActive || ctx.skateboardActive) ? P.snowboardJumpVelocity : P.jumpVelocity);
    ctx.onGround = false;
    ctx.lastGroundedAt = 0;
    ctx.jumpBufferUntil = 0;
  }

  let bobY = 0;
  if (!(ctx.snowboardActive || ctx.skateboardActive) && !(ctx.paragliderActive && !ctx.onGround) && ctx.onGround && speedNow > 0.25) {
    ctx.walkBobPhase += dt * (4.5 + speedNow * 1.4);
    bobY = Math.sin(ctx.walkBobPhase) * 0.028 * Math.min(1, speedNow / 3.8);
  }
  // Agachamento suave em primeira pessoa (Ctrl ou KeyC)
  if (ctx.crouchProgress === undefined) ctx.crouchProgress = 0;
  const isCrouchingNow = !ctx.seatedSeat && !ctx.paragliderActive && !(ctx.snowboardActive || ctx.skateboardActive) &&
    !!(ctx.keys['ControlLeft'] || ctx.keys['ControlRight'] || ctx.keys['KeyC'] || ctx.mobileCrouch);
  const targetCrouch = isCrouchingNow ? 1 : 0;
  ctx.crouchProgress += (targetCrouch - ctx.crouchProgress) * Math.min(1, dt * 9.5);
  const crouchDrop = ctx.crouchProgress * 0.76;

  const baseEyeH = ctx.seatedSeat ? P.seatedEyeHeight : ((ctx.snowboardActive || ctx.skateboardActive) ? P.snowboardEyeHeight : P.eyeHeight);
  const eyeH = isCrawlingUmbral ? 0.34 : (baseEyeH - crouchDrop);
  if (ctx.seatedSeat) {
    ctx.playerPos.set(ctx.seatedSeat.x, ctx.seatedSeat.y, ctx.seatedSeat.z);
    ctx.playerVelY = 0;
  }
  const pitchLift = Math.abs(Math.sin(ctx.snowboardPitch || 0)) * 0.16;
  if (ctx.snowboardGroup) {
    ctx.snowboardGroup.visible = ctx.snowboardActive && ctx.inFps;
    if (ctx.snowboardGroup.visible) {
      ctx.snowboardGroup.position.set(ctx.playerPos.x, ctx.playerPos.y + 0.03 + pitchLift, ctx.playerPos.z);
      ctx.snowboardGroup.rotation.order = 'YXZ';
      ctx.snowboardGroup.rotation.y = ctx.playerYaw;
      ctx.snowboardGroup.rotation.x = ctx.snowboardPitch;
      ctx.snowboardGroup.rotation.z = ctx.snowboardRoll;
    }
  }
  if (ctx.skateboardGroup) {
    ctx.skateboardGroup.visible = ctx.skateboardActive && ctx.inFps;
    if (ctx.skateboardGroup.visible) {
      ctx.skateboardGroup.position.set(ctx.playerPos.x, ctx.playerPos.y + 0.02 + pitchLift, ctx.playerPos.z);
      ctx.skateboardGroup.rotation.order = 'YXZ';
      ctx.skateboardGroup.rotation.y = ctx.playerYaw;
      ctx.skateboardGroup.rotation.x = ctx.snowboardPitch;
      ctx.skateboardGroup.rotation.z = ctx.snowboardRoll;
    }
  }
  if (ctx.roundParachuteGroup) {
    ctx.roundParachuteGroup.visible = ctx.roundParachuteActive && !ctx.onGround && ctx.inFps;
    if (ctx.roundParachuteGroup.visible) {
      ctx.roundParachuteGroup.position.set(ctx.playerPos.x, ctx.playerPos.y + 0.15, ctx.playerPos.z);
      ctx.roundParachuteGroup.rotation.y = ctx.playerYaw;
      ctx.roundParachuteGroup.rotation.z = Math.sin((ctx.clock ? ctx.clock.elapsedTime : now * 0.001) * 1.8) * 0.06;
    }
  }
  if (ctx.paragliderGroup) {
    ctx.paragliderGroup.visible = ctx.paragliderActive && !ctx.onGround && ctx.inFps;
    if (ctx.paragliderGroup.visible) {
      ctx.paragliderGroup.position.set(ctx.playerPos.x, ctx.playerPos.y + 0.45, ctx.playerPos.z);
      ctx.paragliderGroup.rotation.order = 'YXZ';
      ctx.paragliderGroup.rotation.y = ctx.playerYaw;
      ctx.paragliderGroup.rotation.z = ctx.paragliderRoll;
    }
  }
  ctx.camera.position.set(ctx.playerPos.x, ctx.playerPos.y + eyeH + bobY, ctx.playerPos.z);
  ctx.camera.up.set(0, 1, 0);
  ctx.camera.rotation.order = 'YXZ';
  ctx.camera.rotation.y = ctx.playerYaw;
  const sbSlopePitch = (ctx.snowboardActive || ctx.skateboardActive) ? Math.max(-0.38, Math.min(0.28, ctx.snowboardPitch * 0.55)) : 0;
  ctx.camera.rotation.x = ctx.playerPitch + sbSlopePitch;
  const tCam = ctx.clock ? ctx.clock.elapsedTime : now * 0.001;
  const umbralSway = isCrawlingUmbral
    ? (1.12 + Math.sin(tCam * 1.8) * 0.06)
    : ((typeof window !== 'undefined' && window.isTripFreakoutActive && window.isTripFreakoutActive())
      ? Math.sin(tCam * 2.2) * 0.085
      : 0);
  ctx.camera.rotation.z = umbralSway + ((ctx.snowboardActive || ctx.skateboardActive) ? ctx.snowboardRoll * 0.65 : ((ctx.paragliderActive && !ctx.onGround) ? ctx.paragliderRoll * 0.45 : 0));

  // Bracos em 1a pessoa
  const heldData = ctx.heldItem?.mesh.userData;
  const isTwoHanded = !!(heldData?.twoHanded || heldData?.firstPersonSideGrip || heldData?.firstPersonSupportGrip);
  if (!heldData?.firstPersonSupportGrip || ctx.placementMode || ctx.villageMove || ctx.snowboardActive ||
      (ctx.paragliderActive && !ctx.onGround)) {
    resetHeldSleeve(ctx.fpsArmGroup);
    resetHeldSleeve(ctx.fpsLeftArmGroup);
  }
  if (ctx.fpsArmGroup) {
    ctx.fpsArmGroup.visible = true;
    if (ctx.paragliderActive && !ctx.onGround) {
      ctx.fpsArmGroup.position.set(0.32, 0.06, -0.34);
      ctx.fpsArmGroup.rotation.set(0.85, -0.10, -0.15);
    } else if ((ctx.snowboardActive || ctx.skateboardActive)) {
      ctx.fpsArmGroup.position.set(0.42, -0.22, -0.34);
      ctx.fpsArmGroup.rotation.set(0.10, -0.45, -0.25);
    } else {
      const drawingNow = !!(ctx.isPrimaryDown && ctx.hoveredBoardHit && getHeldBoardToolColor(ctx.heldItem));
      ctx.armReach += ((drawingNow ? 1 : 0) - ctx.armReach) * Math.min(1, dt * 14);
      if (speedNow > 0.2) ctx.armSwingPhase += dt * 7;
      const emptyHands = !ctx.heldItem;
      ctx.fpsArmGroup.position.set(
        fitHandHorizontally(ctx.camera, (isTwoHanded ? 0.25 : 0.27) - ctx.armReach * 0.08),
        (isTwoHanded ? -0.285 : -0.23) + Math.sin(ctx.armSwingPhase) * 0.014 + ctx.armReach * 0.06,
        (isTwoHanded ? -0.56 : -0.47) - (emptyHands ? 0.03 : 0) - ctx.armReach * 0.16
      );
      ctx.fpsArmGroup.rotation.set(0.18 + ctx.armReach * 0.35, (isTwoHanded ? 0.12 : -0.14) + ctx.armReach * 0.1, 0.05);
    }
  }
  if (ctx.fpsLeftArmGroup) {
    ctx.fpsLeftArmGroup.visible = isTwoHanded || (ctx.paragliderActive && !ctx.onGround) || (ctx.snowboardActive || ctx.skateboardActive);
    if (ctx.paragliderActive && !ctx.onGround) {
      ctx.fpsLeftArmGroup.position.set(-0.32, 0.06, -0.34);
      ctx.fpsLeftArmGroup.rotation.set(0.85, 0.10, 0.15);
    } else if ((ctx.snowboardActive || ctx.skateboardActive)) {
      ctx.fpsLeftArmGroup.position.set(-0.42, -0.22, -0.34);
      ctx.fpsLeftArmGroup.rotation.set(0.10, 0.45, 0.25);
    } else if (isTwoHanded) {
      ctx.fpsLeftArmGroup.position.set(fitHandHorizontally(ctx.camera, -0.25), -0.285 + Math.sin(ctx.armSwingPhase) * 0.014, -0.56);
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
