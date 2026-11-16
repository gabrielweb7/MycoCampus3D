/**
 * Loop Principal de Simulacao e Renderizacao (MycoCampus3D)
 * Executa fisica do jogador, veiculos, termometro laser, seringa, panelas de pressao,
 * balanca, estufa, esportes, clima dinamico, avatar local/remoto e renderizacao Three.js.
 */

import * as qualityMod from '../core/quality.js';
import {
  terrainHeight,
  getGroundHeight,
  getSurfaceTypeAt,
  clampPosAgainstWalls
} from '../engine/physics.js';
import {
  getCinemaHitTarget as cinemaHitTarget,
  drawCinemaVideoFrame as cinemaDrawFrame
} from '../engine/cinema.js';
import { updateDynamicEnvironment as envUpdate } from '../engine/environment.js';
import {
  getVirtualDayFrac,
  updateClockTexture
} from '../world/staircase-clock.js';
import {
  updateContainerVolume,
  updateSyringeVolume
} from '../world/lab-tools.js';
import {
  greenhouseSlots,
  updateGreenhouseSlotMesh,
  stepGreenhouseParticles
} from '../world/greenhouse.js';
import {
  triggerConfettiBurst,
  stepConfetti
} from '../entities/confetti.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';
import { dropUnsupportedItems } from '../entities/placement-ghost.js';
import {
  animateAvatarAura,
  stepMultiplayerAvatars
} from '../entities/avatars.js';
import {
  getHeldBoardToolColor,
  drawBoardSegment
} from './chalkboard.js';
import { stepLobbyTour } from './lobby-tour.js';
import { updateHoverRay } from './interaction-system.js';

const THREE = window.THREE;

// Vetores pré-alocados para ZERO Garbage Collection no loop de renderizacao
const _tmpHandLocal = new THREE.Vector3();
const _tmpHandPos = new THREE.Vector3();
const _tmpMuzzlePos = new THREE.Vector3();
const _vZero2 = new THREE.Vector2(0, 0);
const _tmpSyrPort = new THREE.Vector3();
const _tmpSyrHand = new THREE.Vector3();
const _tmpSyrOff = new THREE.Vector3();
const _tmpNormal = new THREE.Vector3();
const _tmpLookPt = new THREE.Vector3();
const _tmpSkyEnd = new THREE.Vector3();

let lastMobileHoverAt = 0;
let lastScaleAt = 0;
let animationStarted = false;

export function applyQualityTier(ctx, tier) {
  qualityMod.qualityState.mode = ctx.qualityMode;
  qualityMod.applyQualityTier(tier, {
    renderer: ctx.renderer,
    camera: ctx.camera,
    envSun: ctx.envSun,
    weatherPoints: ctx.weatherPoints,
    onQualityChange: ctx.callbacks.onQualityChange
  });
  ctx.qualityTier = qualityMod.qualityState.tier;
  ctx.auraEnabled = qualityMod.qualityState.auraEnabled;
}

export function stepAutoQuality(ctx, now) {
  qualityMod.qualityState.mode = ctx.qualityMode;
  qualityMod.stepAutoQuality(now, ctx.isTouchDevice(), {
    renderer: ctx.renderer,
    camera: ctx.camera,
    envSun: ctx.envSun,
    weatherPoints: ctx.weatherPoints,
    onQualityChange: ctx.callbacks.onQualityChange
  });
  ctx.qualityTier = qualityMod.qualityState.tier;
  ctx.auraEnabled = qualityMod.qualityState.auraEnabled;
}

export function getCinemaHitTarget(ctx, uv) {
  return cinemaHitTarget(uv, {
    power: ctx.cinemaPower,
    lessonIdx: ctx.cinemaLessonIdx,
    lessons: ctx.cinemaLessons
  });
}

export function drawCinemaVideoFrame(ctx, dt) {
  const st = {
    ctx: ctx.cinemaCtx,
    tex: ctx.cinemaTex,
    camera: ctx.camera,
    power: ctx.cinemaPower,
    lessonIdx: ctx.cinemaLessonIdx,
    lessons: ctx.cinemaLessons,
    playing: ctx.cinemaPlaying,
    dirty: ctx.cinemaDirty,
    time: ctx.cinemaTime,
    hovered: ctx.hoveredCinema,
    hoveredUv: ctx.hoveredCinemaUv
  };
  cinemaDrawFrame(dt, st);
  ctx.cinemaTime = st.time;
  ctx.cinemaDirty = st.dirty;
}

export function updateDynamicEnvironment(ctx, dt) {
  const env = {
    envTime: ctx.envTime,
    getVirtualDayFrac,
    lastWeatherMode: ctx.lastWeatherMode,
    weatherMode: ctx.weatherMode,
    snowMix: ctx.snowMix,
    rainbow: { active: ctx.rainbowActive, timer: ctx.rainbowTimer, duration: ctx.rainbowDuration },
    scene: ctx.scene,
    sunDisc: ctx.sunDisc,
    sunHalo: ctx.sunHalo,
    moonDisc: ctx.moonDisc,
    starPoints: ctx.starPoints,
    envSun: ctx.envSun,
    envHemi: ctx.envHemi,
    isTouch: ctx.isTouchDevice(),
    envCloudMat: ctx.envCloudMat,
    envClouds: ctx.envClouds,
    terrainSnowMat: ctx.terrainSnowMat,
    weatherPoints: ctx.weatherPoints,
    weatherPosAttr: ctx.weatherPosAttr,
    qualityTier: ctx.qualityTier,
    inFps: ctx.inFps,
    playerPos: ctx.playerPos,
    camera: ctx.camera,
    roofZones: ctx.roofZones,
    rainbowMesh: ctx.rainbowMesh,
    fountainRipples: ctx.fountainRipples,
    fountainDropsAttr: ctx.fountainDropsAttr
  };
  envUpdate(dt, env);
  ctx.envTime = env.envTime;
  ctx.lastWeatherMode = env.lastWeatherMode;
  ctx.weatherMode = env.weatherMode;
  ctx.snowMix = env.snowMix;
  ctx.rainbowActive = env.rainbow.active;
  ctx.rainbowTimer = env.rainbow.timer;
  ctx.rainbowDuration = env.rainbow.duration;
}

export function startAnimationLoop(ctx) {
  if (animationStarted) return;
  animationStarted = true;

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, ctx.clock.getDelta());
    const now = performance.now();
    stepAutoQuality(ctx, now);
    updateClockTexture();

    // Cogumelos silvestres
    for (let wmIdx = 0; wmIdx < ctx.wildMushrooms.length; wmIdx++) {
      const wm = ctx.wildMushrooms[wmIdx];
      if (!wm.active && now >= wm.respawnAt) {
        wm.active = true; wm.group.visible = true;
      } else if (wm.active) {
        wm.capMesh.rotation.y += dt * 0.5;
      }
    }

    // Portas
    for (let di = 0; di < ctx.campusDoors.length; di++) {
      const d = ctx.campusDoors[di];
      const targetAngle = d.open ? -d.dir * Math.PI * 0.48 : 0;
      d.angle += (targetAngle - d.angle) * Math.min(1, dt * 8);
      d.pivot.rotation.y = d.angle;
    }

    // Persianas
    for (let bi = 0; bi < ctx.windowBlinds.length; bi++) {
      const b = ctx.windowBlinds[bi];
      const targetProg = b.open ? 0.0 : 1.0;
      if (Math.abs(b.progress - targetProg) > 0.001) {
        b.progress += (targetProg - b.progress) * Math.min(1, dt * 7.5);
        const p = b.progress;
        const count = b.slats.length;
        const activeSpan = (b.dropH - 0.14) * p;
        for (let si = 0; si < count; si++) {
          const frac = (si + 0.5) / count;
          const stackedY = -0.05 - si * 0.007;
          const fullY = -0.07 - frac * (b.dropH - 0.12);
          b.slats[si].position.y = stackedY + (fullY - stackedY) * p;
          b.slats[si].rotation.z = b.dir * (0.28 * p + (1 - p) * 1.15);
        }
        const bottomY = -0.09 - count * 0.007 - activeSpan;
        b.bottomRail.position.y = bottomY;
        const tapeLen = Math.max(0.08, -bottomY);
        for (let ti = 0; ti < b.tapes.length; ti++) {
          b.tapes[ti].scale.y = tapeLen / b.dropH;
          b.tapes[ti].position.y = -tapeLen / 2;
        }
        if (b.cordKnob) {
          b.cordKnob.position.y = -b.dropH * 0.42 - (1 - p) * (b.dropH * 0.35);
        }
      }
    }

    if (ctx.lobbyTourActive) {
      ctx.tourTime = stepLobbyTour(ctx.camera, ctx.controls, ctx.tourTime, dt);
    } else if (ctx.inFps) {
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
            const carveSteer = (moveX * 0.45);
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
        if (sbSpeed > 26.0) {
          ctx.playerVelX = (ctx.playerVelX / sbSpeed) * 26.0;
          ctx.playerVelZ = (ctx.playerVelZ / sbSpeed) * 26.0;
          sbSpeed = 26.0;
        }

        if (sbSpeed > 0.01) {
          ctx.playerPos.x += ctx.playerVelX * dt;
          ctx.playerPos.z += ctx.playerVelZ * dt;
          ctx.playerPos.x = Math.max(-210, Math.min(210, ctx.playerPos.x));
          ctx.playerPos.z = Math.max(-210, Math.min(210, ctx.playerPos.z));
          clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, ctx.PLAYER_RADIUS);
        }

        const targetPitch = Math.atan2(-(gradX * fwdX + gradZ * fwdZ), 1);
        const targetRoll = -moveX * 0.24 - Math.max(-0.22, Math.min(0.22, (ctx.playerVelX * rightX + ctx.playerVelZ * rightZ) * 0.025));
        ctx.snowboardPitch += (targetPitch - ctx.snowboardPitch) * Math.min(1, dt * 8);
        ctx.snowboardRoll += (targetRoll - ctx.snowboardRoll) * Math.min(1, dt * 8);
      } else if (ctx.paragliderActive && !ctx.onGround) {
        if (ctx.seatedSeat) ctx.seatedSeat = null;
        const fwdX = -Math.sin(ctx.playerYaw), fwdZ = -Math.cos(ctx.playerYaw);
        const rightX = Math.cos(ctx.playerYaw), rightZ = -Math.sin(ctx.playerYaw);
        const glideSpeed = moveZ > 0.1 ? 15.0 : (moveZ < -0.1 ? 4.2 : 11.2);
        const targetVX = (fwdX * glideSpeed) + (rightX * moveX * 3.8);
        const targetVZ = (fwdZ * glideSpeed) + (rightZ * moveX * 3.8);
        const airBlend = 1 - Math.exp(-3.2 * dt);
        ctx.playerVelX += (targetVX - ctx.playerVelX) * airBlend;
        ctx.playerVelZ += (targetVZ - ctx.playerVelZ) * airBlend;
        ctx.playerPos.x = Math.max(-210, Math.min(210, ctx.playerPos.x + ctx.playerVelX * dt));
        ctx.playerPos.z = Math.max(-210, Math.min(210, ctx.playerPos.z + ctx.playerVelZ * dt));
        clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, ctx.PLAYER_RADIUS);

        const targetPgRoll = -moveX * 0.28;
        ctx.paragliderRoll += (targetPgRoll - ctx.paragliderRoll) * Math.min(1, dt * 6);
      } else {
        let targetVX = 0, targetVZ = 0;
        if (mag > 0.08) {
          if (ctx.seatedSeat) ctx.seatedSeat = null;
          const isSprinting = !!(ctx.keys['ShiftLeft'] || ctx.keys['ShiftRight'] || ctx.mobileSprint);
          const maxSpeed = isSprinting ? 7.5 : 4.6;
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
          ctx.playerPos.x += ctx.playerVelX * dt;
          ctx.playerPos.z += ctx.playerVelZ * dt;
          ctx.playerPos.x = Math.max(-210, Math.min(210, ctx.playerPos.x));
          ctx.playerPos.z = Math.max(-210, Math.min(210, ctx.playerPos.z));
          clampPosAgainstWalls(ctx.physCtx, ctx.playerPos, ctx.PLAYER_RADIUS);
        }
      }

      const speedNow = Math.hypot(ctx.playerVelX, ctx.playerVelZ);
      ctx.isWalking = !ctx.snowboardActive && !(ctx.paragliderActive && !ctx.onGround) && speedNow > 0.2;
      groundY = getGroundHeight(ctx.physCtx, ctx.playerPos.x, ctx.playerPos.z, ctx.playerPos.y);

      // Correntes termicas
      let inThermal = false;
      for (let tci = 0; tci < ctx.thermalColumns.length; tci++) {
        const tc = ctx.thermalColumns[tci];
        for (let tri = 0; tri < tc.rings.length; tri++) {
          const tr = tc.rings[tri];
          const relH = ((ctx.clock.elapsedTime * 7.5 + tr.offset) % 84);
          tr.mesh.position.y = tc.baseY + 2 + relH;
          tr.mesh.rotation.z = ctx.clock.elapsedTime * 1.2 + tri;
        }
        if (ctx.paragliderActive && !ctx.onGround && ctx.playerPos.y < tc.maxH) {
          if (Math.hypot(ctx.playerPos.x - tc.x, ctx.playerPos.z - tc.z) < tc.radius) {
            inThermal = true;
          }
        }
      }

      if (ctx.paragliderActive && !ctx.onGround) {
        if (inThermal) {
          ctx.playerVelY += (8.5 - ctx.playerVelY) * Math.min(1, dt * 3.5);
        } else {
          const sinkRate = moveZ < -0.1 ? -5.2 : (moveZ > 0.1 ? -2.15 : -1.55);
          ctx.playerVelY += (sinkRate - ctx.playerVelY) * Math.min(1, dt * 4.5);
        }
      } else {
        ctx.playerVelY -= 16.5 * dt;
      }
      ctx.playerPos.y += ctx.playerVelY * dt;
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
      if (wantsJump && (ctx.onGround || (now - ctx.lastGroundedAt < 150 && ctx.playerVelY <= 0))) {
        if (ctx.seatedSeat) ctx.seatedSeat = null;
        ctx.playerVelY = ctx.paragliderActive ? 9.2 : (ctx.snowboardActive ? 7.2 : 6.2);
        ctx.onGround = false;
        ctx.lastGroundedAt = 0;
        ctx.jumpBufferUntil = 0;
      }

      let bobY = 0;
      if (!ctx.snowboardActive && !(ctx.paragliderActive && !ctx.onGround) && ctx.onGround && speedNow > 0.25) {
        ctx.walkBobPhase += dt * (4.5 + speedNow * 1.4);
        bobY = Math.sin(ctx.walkBobPhase) * 0.028 * Math.min(1, speedNow / 3.8);
      }
      const eyeH = ctx.seatedSeat ? 1.50 : (ctx.snowboardActive ? 1.42 : ctx.PLAYER_EYE);
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

      if (ctx.heldItem) {
        const reachZ = ctx.fpsArmGroup ? ctx.armReach * 0.16 : 0;
        const reachY = ctx.fpsArmGroup ? ctx.armReach * 0.06 : 0;
        if (isTwoHanded) {
          _tmpHandLocal.set(0, -0.48, -0.78);
        } else {
          _tmpHandLocal.set(0.30, -0.22 + reachY, -0.58 - reachZ);
        }
        _tmpHandPos.copy(_tmpHandLocal).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
        ctx.heldItem.mesh.position.copy(_tmpHandPos);
        if (ctx.heldItem.id.indexOf('chalk_') === 0) {
          ctx.heldItem.mesh.rotation.order = 'YXZ';
          ctx.heldItem.mesh.rotation.set(ctx.playerPitch + 0.35, ctx.playerYaw, 0);
        } else if (ctx.heldItem.id.indexOf('board_eraser') === 0) {
          ctx.heldItem.mesh.rotation.order = 'YXZ';
          ctx.heldItem.mesh.rotation.set(ctx.playerPitch + Math.PI / 2, ctx.playerYaw, 0);
        } else if (ctx.heldItem.mesh.userData.isThermometer) {
          _tmpHandLocal.set(0.24, -0.22 + reachY, -0.46 - reachZ);
          _tmpHandPos.copy(_tmpHandLocal).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
          ctx.heldItem.mesh.position.copy(_tmpHandPos);
          ctx.heldItem.mesh.rotation.order = 'YXZ';
          ctx.heldItem.mesh.rotation.set(ctx.playerPitch, ctx.playerYaw, 0);

          if (!ctx.thermoLaserOn) {
            ctx.thermoLaserLine.visible = false;
            ctx.thermoLaserDot.visible = false;
            drawThermoScreen(ctx.thermoCurrentTemp, 'HOLD');
          } else {
            _tmpMuzzlePos.set(0, 0.155, -0.09).applyEuler(ctx.heldItem.mesh.rotation).add(ctx.heldItem.mesh.position);
            ctx.raycaster.setFromCamera(ctx.inFps ? _vZero2 : ctx.pointerNdc, ctx.camera);

            if (!window._cachedLaserTargets || (now - (window._lastLaserCacheAt || 0) > 800)) {
              window._lastLaserCacheAt = now;
              const lTargets = [];
              for (let pki = 0; pki < ctx.pickableItems.length; pki++) {
                const pItem = ctx.pickableItems[pki];
                if (pItem && pItem.mesh && pItem !== ctx.heldItem) lTargets.push(pItem.mesh);
              }
              for (let smi = 0; smi < ctx.supportMeshes.length; smi++) {
                const sMesh = ctx.supportMeshes[smi];
                if (sMesh && (!ctx.heldItem || sMesh !== ctx.heldItem.mesh)) lTargets.push(sMesh);
              }
              for (let dmi = 0; dmi < ctx.doorHitMeshes.length; dmi++) {
                if (ctx.doorHitMeshes[dmi]) lTargets.push(ctx.doorHitMeshes[dmi]);
              }
              for (let gsi = 0; gsi < greenhouseSlots.length; gsi++) {
                if (greenhouseSlots[gsi] && greenhouseSlots[gsi].group) lTargets.push(greenhouseSlots[gsi].group);
              }
              Object.keys(ctx.remoteAvatars).forEach(function (rId) {
                const rAv = ctx.remoteAvatars[rId];
                if (rAv && rAv.group) lTargets.push(rAv.group);
              });
              window._cachedLaserTargets = lTargets;
            }

            const rawHits = ctx.raycaster.intersectObjects(window._cachedLaserTargets, true);
            let lHit = null;
            for (let rhi = 0; rhi < rawHits.length; rhi++) {
              const candH = rawHits[rhi];
              if (!candH.object.userData.ignoreRay &&
                  candH.object !== ctx.heldItem.mesh &&
                  candH.object !== ctx.thermoLaserLine &&
                  candH.object !== ctx.thermoLaserDot) {
                lHit = candH;
                break;
              }
            }

            if (lHit && lHit.distance < 35.0) {
              const lArr = ctx.thermoLaserLine.geometry.attributes.position.array;
              lArr[0] = _tmpMuzzlePos.x; lArr[1] = _tmpMuzzlePos.y; lArr[2] = _tmpMuzzlePos.z;
              lArr[3] = lHit.point.x; lArr[4] = lHit.point.y; lArr[5] = lHit.point.z;
              ctx.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
              ctx.thermoLaserLine.visible = true;

              if (lHit.face) {
                _tmpNormal.copy(lHit.face.normal).transformDirection(lHit.object.matrixWorld);
              } else {
                _tmpNormal.set(0, 1, 0);
              }
              ctx.thermoLaserDot.position.copy(lHit.point).addScaledVector(_tmpNormal, 0.005);
              _tmpLookPt.copy(lHit.point).add(_tmpNormal);
              ctx.thermoLaserDot.lookAt(_tmpLookPt);
              ctx.thermoLaserDot.visible = true;

              let sTemp = 23.4;
              let sLbl = '';
              const hObj = lHit.object;

              for (let bi = 0; bi < ctx.burnerDevices.length; bi++) {
                const bd = ctx.burnerDevices[bi];
                if (hObj.userData.burnerSwitchIdx !== undefined || hObj.userData.supportSurface === bd.surface ||
                    (lHit.point.x >= bd.surface.minX && lHit.point.x <= bd.surface.maxX &&
                     lHit.point.z >= bd.surface.minZ && lHit.point.z <= bd.surface.maxZ &&
                     Math.abs(lHit.point.y - bd.surface.topY) < 0.15)) {
                  sTemp = 24.0 + (bd.heat || 0) * 215.0;
                  sLbl = (bd.heat > 0.15) ? 'Fogareiro Incandescente' : 'Fogareiro Elétrico';
                  break;
                }
              }
              if (!sLbl) {
                for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
                  const cp = ctx.cookerPots[cpi];
                  if (hObj === cp.potItem.mesh || hObj === cp.lidItem.mesh ||
                      hObj.parent === cp.potItem.mesh || hObj.parent === cp.lidItem.mesh ||
                      cp.contents.some(function (it) { return it.mesh === hObj || it.mesh.children.includes(hObj); })) {
                    sTemp = cp.temp || 24.5;
                    sLbl = cp.psi >= 14 ? 'Panela Esterilizando (' + Math.round(cp.psi) + ' PSI)' : (cp.temp > 35 ? 'Panela Aquecendo' : 'Panela de Pressão');
                    break;
                  }
                }
              }
              if (!sLbl) {
                if (hObj.userData.stirSwitch || (hObj.parent && hObj.parent.userData.stirSwitch)) {
                  sTemp = (ctx.stirrerDevices[0] && ctx.stirrerDevices[0].on) ? 34.5 : 23.8;
                  sLbl = 'Agitador Magnético';
                } else if (hObj.userData.remotePlayer || (hObj.parent && hObj.parent.userData.remotePlayer)) {
                  sTemp = 36.7 + Math.sin(ctx.clock.elapsedTime * 1.3) * 0.2;
                  sLbl = 'Jogador (Corporal)';
                } else if (hObj.userData.doorObj) {
                  sTemp = 22.8;
                  sLbl = hObj.userData.doorObj.label || 'Porta';
                } else {
                  let pWalk = hObj;
                  let pNode = null;
                  while (pWalk) {
                    if (pWalk.userData && pWalk.userData.pickableId) { pNode = pWalk; break; }
                    pWalk = pWalk.parent;
                  }
                  if (pNode) {
                    const pid = pNode.userData.pickableId;
                    sLbl = pNode.userData.pickableLabel || pid;
                    if (pid.indexOf('heat_sealer') === 0) sTemp = 165.0 + Math.sin(ctx.clock.elapsedTime * 2.5) * 1.2;
                    else if (pid.indexOf('laminar_hood') === 0) sTemp = (ctx.hoodAirData && ctx.hoodAirData.on) ? 21.2 : 23.5;
                    else if (pid.indexOf('precision_scale') === 0) sTemp = 24.1;
                    else if (pid.indexOf('alcohol_spray') === 0) sTemp = 20.2;
                    else if (pid.indexOf('liquid_culture') === 0) sTemp = 24.5 + Math.sin(ctx.clock.elapsedTime * 2.0) * 0.2;
                    else if (pid === 'petri_contam') sTemp = 26.8;
                    else if (pid.indexOf('petri_') === 0) sTemp = 25.0;
                    else if (pid === 'spawn_bag_colonized' || (pNode.userData.spawnCtrl && pNode.userData.spawnCtrl.inoculated)) sTemp = 26.4;
                    else if (pid.indexOf('spawn_') === 0) sTemp = 23.8;
                    else if (pid.indexOf('fruiting_block') === 0) sTemp = 21.4;
                    else if (pid.indexOf('substrate_') === 0) sTemp = 22.6;
                    else if (pid.indexOf('pda_bottle') === 0) sTemp = 24.0;
                    else if (pid.indexOf('syringe_') === 0) sTemp = 23.6;
                    else if (pid.indexOf('beaker_') === 0) sTemp = 23.5;
                    else if (pid.indexOf('table_') === 0) sTemp = 21.8;
                    else sTemp = 23.3;
                  } else if (lHit.point.x > 18 && lHit.point.z > 5 && lHit.point.z < 11) {
                    sTemp = 20.5 + Math.cos(ctx.clock.elapsedTime * 1.5) * 0.3;
                    sLbl = 'Estufa de Frutificação';
                  } else {
                    sTemp = 23.2 + Math.sin(lHit.point.x * 0.5 + lHit.point.z * 0.3) * 0.4;
                    sLbl = lHit.point.y > 0.6 ? 'Bancada / Estrutura' : 'Piso';
                  }
                }
              }
              ctx.thermoTargetTemp = sTemp;
              ctx.thermoTargetLabel = sLbl;
            } else {
              const rOrig = ctx.raycaster.ray.origin;
              const rDir = ctx.raycaster.ray.direction;
              let gHitPt = null;
              for (let stepD = 1.0; stepD <= 32.0; stepD += 1.0) {
                const sx = rOrig.x + rDir.x * stepD;
                const sy = rOrig.y + rDir.y * stepD;
                const sz = rOrig.z + rDir.z * stepD;
                const gy = getGroundHeight(ctx.physCtx, sx, sz, sy + 1.0);
                if (sy <= gy) {
                  _tmpLookPt.set(sx, gy, sz);
                  gHitPt = _tmpLookPt;
                  break;
                }
              }
              if (gHitPt) {
                const lArrG = ctx.thermoLaserLine.geometry.attributes.position.array;
                lArrG[0] = _tmpMuzzlePos.x; lArrG[1] = _tmpMuzzlePos.y; lArrG[2] = _tmpMuzzlePos.z;
                lArrG[3] = gHitPt.x; lArrG[4] = gHitPt.y; lArrG[5] = gHitPt.z;
                ctx.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
                ctx.thermoLaserLine.visible = true;
                ctx.thermoLaserDot.position.set(gHitPt.x, gHitPt.y + 0.008, gHitPt.z);
                ctx.thermoLaserDot.lookAt(gHitPt.x, gHitPt.y + 1, gHitPt.z);
                ctx.thermoLaserDot.visible = true;

                const isLake = (Math.hypot(gHitPt.x, gHitPt.z - 48) < 17) || gHitPt.y < 0.05;
                if (isLake) {
                  ctx.thermoTargetTemp = 19.2;
                  ctx.thermoTargetLabel = 'Água do Lago';
                } else if (ctx.weatherMode === 'snow') {
                  ctx.thermoTargetTemp = 1.5;
                  ctx.thermoTargetLabel = 'Solo com Neve';
                } else if (ctx.weatherMode === 'rain') {
                  ctx.thermoTargetTemp = 17.4;
                  ctx.thermoTargetLabel = 'Solo Molhado';
                } else {
                  const sunBoost = Math.max(0, Math.sin((getVirtualDayFrac() - 0.25) * Math.PI * 2)) * 8.5;
                  ctx.thermoTargetTemp = 18.8 + sunBoost + Math.sin(gHitPt.x * 0.2 + gHitPt.z * 0.2) * 0.4;
                  ctx.thermoTargetLabel = (Math.abs(gHitPt.x) < 13 && Math.abs(gHitPt.z) < 13) ? 'Piso da Praça' : 'Grama / Terreno';
                }
              } else {
                _tmpSkyEnd.copy(rOrig).addScaledVector(rDir, 22.0);
                const lArrS = ctx.thermoLaserLine.geometry.attributes.position.array;
                lArrS[0] = _tmpMuzzlePos.x; lArrS[1] = _tmpMuzzlePos.y; lArrS[2] = _tmpMuzzlePos.z;
                lArrS[3] = _tmpSkyEnd.x; lArrS[4] = _tmpSkyEnd.y; lArrS[5] = _tmpSkyEnd.z;
                ctx.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
                ctx.thermoLaserLine.visible = true;
                ctx.thermoLaserDot.visible = false;
                ctx.thermoTargetTemp = ctx.weatherMode === 'snow' ? -6.5 : 4.2;
                ctx.thermoTargetLabel = 'Céu Aberto';
              }
            }
            ctx.thermoCurrentTemp += (ctx.thermoTargetTemp - ctx.thermoCurrentTemp) * Math.min(1, dt * 14);
            drawThermoScreen(ctx.thermoCurrentTemp, 'SCAN');
          }
        } else {
          ctx.heldItem.mesh.rotation.set(0, ctx.heldRotY, 0);
        }

        if (ctx.heldItem.trayContents && ctx.heldItem.trayContents.length) {
          const hRy = ctx.heldItem.mesh.rotation.y;
          const ch = Math.cos(hRy), sh = Math.sin(hRy);
          const hp = ctx.heldItem.mesh.position;
          for (let tci = 0; tci < ctx.heldItem.trayContents.length; tci++) {
            const tc = ctx.heldItem.trayContents[tci];
            if (!tc.item || !tc.item.mesh) continue;
            tc.item.mesh.position.set(
              hp.x + tc.lx * ch + tc.lz * sh,
              hp.y + tc.ly,
              hp.z - tc.lx * sh + tc.lz * ch
            );
            tc.item.mesh.rotation.set(0, hRy + tc.lry, 0);
          }
        }

        if (ctx.heldItem.mesh.userData.isSyringe) {
          const activeSyrItem = (ctx.hoveredSyringeTarget && ctx.hoveredSyringeTarget.item && ctx.hoveredSyringeTarget.item.mesh.userData.liquidCtrl)
            ? ctx.hoveredSyringeTarget.item
            : ((ctx.syringePumping && ctx.syringePumping.target && ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.liquidCtrl) ? ctx.syringePumping.target.item : null);
          const isPuncturing = !!activeSyrItem;
          if (activeSyrItem) ctx.lastSyringeTargetItem = activeSyrItem;
          ctx.syringePunctureProgress += ((isPuncturing ? 1 : 0) - ctx.syringePunctureProgress) * Math.min(1, dt * 10);
          if (ctx.syringePunctureProgress > 0.01 && ctx.lastSyringeTargetItem) {
            const sTgt = ctx.lastSyringeTargetItem;
            _tmpSyrPort.set(0.036, 0.290, 0).applyEuler(sTgt.mesh.rotation).add(sTgt.mesh.position);
            const tgtRotX = 0.08 * ctx.syringePunctureProgress;
            const tgtRotY = ctx.playerYaw * (1 - ctx.syringePunctureProgress) + (sTgt.mesh.rotation.y + Math.PI * 0.5) * ctx.syringePunctureProgress;
            const tgtRotZ = -1.48 * ctx.syringePunctureProgress;
            ctx.heldItem.mesh.rotation.set(tgtRotX, tgtRotY, tgtRotZ);

            _tmpSyrOff.set(0.12, 0.022, 0).applyEuler(ctx.heldItem.mesh.rotation);
            _tmpSyrHand.copy(_tmpSyrPort).sub(_tmpSyrOff);
            _tmpSyrHand.y -= 0.018 * ctx.syringePunctureProgress;
            _tmpHandPos.lerp(_tmpSyrHand, ctx.syringePunctureProgress);
            ctx.heldItem.mesh.position.copy(_tmpHandPos);

            if (ctx.fpsArmGroup) {
              ctx.fpsArmGroup.position.set(
                0.32 - 0.04 * ctx.syringePunctureProgress,
                -0.28 - 0.04 * ctx.syringePunctureProgress,
                -0.42 - 0.04 * ctx.syringePunctureProgress
              );
              ctx.fpsArmGroup.rotation.set(
                0.18 + 0.14 * ctx.syringePunctureProgress,
                -0.14 + 0.04 * ctx.syringePunctureProgress,
                0.05
              );
            }
          } else if (ctx.syringePunctureProgress <= 0.01) {
            ctx.syringePunctureProgress = 0;
            ctx.lastSyringeTargetItem = null;
          }
        }

        if (ctx.heldItem.lidItem && ctx.heldItem.lidItem.isAttached) {
          const lidObj = ctx.heldItem.lidItem.mesh;
          lidObj.position.set(_tmpHandPos.x, _tmpHandPos.y + 0.36, _tmpHandPos.z);
          lidObj.rotation.copy(ctx.heldItem.mesh.rotation);
        }
      } else {
        if (ctx.thermoLaserLine && ctx.thermoLaserLine.visible) ctx.thermoLaserLine.visible = false;
        if (ctx.thermoLaserDot && ctx.thermoLaserDot.visible) ctx.thermoLaserDot.visible = false;
      }

      if (ctx.syringePumping) {
        if (!ctx.heldItem || !ctx.heldItem.mesh.userData.isSyringe) {
          ctx.syringePumping = null;
        } else if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.position.distanceTo(ctx.playerPos) > 4.5) {
          ctx.syringePumping = null;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 Bombeamento cancelado: você se afastou do recipiente.');
        }
      }
      if (ctx.syringePumping && ctx.heldItem && ctx.heldItem.mesh.userData.isSyringe) {
        ctx.syringePumping.elapsed += dt;
        const pRatio = Math.min(1, ctx.syringePumping.elapsed / ctx.syringePumping.duration);
        const pSmooth = pRatio * pRatio * (3 - 2 * pRatio);
        const curVol = THREE.MathUtils.lerp(ctx.syringePumping.fromVol, ctx.syringePumping.toVol, pSmooth);
        updateSyringeVolume(ctx.heldItem, curVol);
        if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.liquidCtrl) {
          const dHeld = curVol - ctx.syringePumping.fromVol;
          const newJVol = Math.max(0, ctx.syringePumping.startJarVol - dHeld);
          updateContainerVolume(ctx.syringePumping.target.item, newJVol);
        }
        if (pRatio >= 1.0) {
          updateSyringeVolume(ctx.heldItem, ctx.syringePumping.toVol);
          if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.liquidCtrl) {
            const finalD = ctx.syringePumping.toVol - ctx.syringePumping.fromVol;
            updateContainerVolume(ctx.syringePumping.target.item, Math.max(0, ctx.syringePumping.startJarVol - finalD));
          } else if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.spawnCtrl) {
            const spTarget = ctx.syringePumping.target.item;
            const spCtrl = spTarget.spawnCtrl;
            const isAseptic = !!(ctx.hoodAirData && ctx.hoodAirData.on && performance.now() < ctx.hoodSanitizedUntil);
            spCtrl.inoculated = true;
            if (!isAseptic && Math.random() < 0.45) {
              spCtrl.contaminated = true;
              if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Contaminação! Lembre de ligar e higienizar o Fluxo Laminar com Álcool 70% antes de inocular!');
            } else {
              if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 ' + spCtrl.baseLabel + ' inoculado com sucesso! Micélio em colonização.');
            }
            spCtrl.updateVisual();
          } else if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.isPetri) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧫 Placa de Petri inoculada com Cultura Líquida!');
          }
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
          if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('syringe_use');
          ctx.notifyWorldAction();
          ctx.syringePumping = null;
        }
      }

      // Bolas esportivas
      if (ctx.sportBalls.length) {
        for (let sbi = 0; sbi < ctx.sportBalls.length; sbi++) {
          const sb = ctx.sportBalls[sbi];
          const bPos = sb.mesh.position;
          if (sb.goalCooldown > 0) {
            sb.goalCooldown -= dt;
            if (sb.goalCooldown <= 0) {
              bPos.set(sb.homeX, sb.groundY + sb.r, sb.homeZ);
              sb.vx = 0; sb.vy = 0; sb.vz = 0;
            }
          }
          const bdx = bPos.x - ctx.playerPos.x;
          const bdz = bPos.z - ctx.playerPos.z;
          const bDistSq = bdx * bdx + bdz * bdz;
          const touchR = 0.42 + sb.r;
          if (bDistSq < touchR * touchR && Math.abs(ctx.playerPos.y - bPos.y) < 1.25) {
            const bDist = Math.sqrt(bDistSq) || 0.01;
            const nx = bdx / bDist;
            const nz = bdz / bDist;
            const pSpeed = Math.hypot(ctx.playerVelX, ctx.playerVelZ);
            const kickPow = Math.max(4.5, pSpeed * 1.65);
            sb.vx = nx * kickPow;
            sb.vz = nz * kickPow;
            sb.vy = Math.max(sb.vy, sb.bounceUp * (pSpeed > 1 ? 1.0 : 0.6));
            bPos.x = ctx.playerPos.x + nx * (touchR + 0.03);
            bPos.z = ctx.playerPos.z + nz * (touchR + 0.03);
            if (window.MycoAudio) window.MycoAudio.playClick();
          }
          sb.vy -= 14.0 * dt;
          bPos.x += sb.vx * dt;
          bPos.y += sb.vy * dt;
          bPos.z += sb.vz * dt;
          const floorY = sb.groundY + sb.r;
          if (bPos.y <= floorY) {
            bPos.y = floorY;
            if (Math.abs(sb.vy) > 0.8) {
              sb.vy = -sb.vy * 0.62;
            } else {
              sb.vy = 0;
            }
            const fric = Math.pow(0.18, dt);
            sb.vx *= fric;
            sb.vz *= fric;
          } else {
            const airFric = Math.pow(0.75, dt);
            sb.vx *= airFric;
            sb.vz *= airFric;
          }
          if (sb.kind === 'soccer' && sb.goalCooldown <= 0 && (bPos.x < -61.2 || bPos.x > -38.8) && Math.abs(bPos.z - (-15)) < 2.1 && bPos.y < 2.1) {
            sb.goalCooldown = 1.6;
            triggerConfettiBurst(bPos.x, bPos.y + 0.6, bPos.z);
            if (window.MycoAudio) window.MycoAudio.playHarvest();
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚽ GOOOOL! 🎉');
          }
          if (bPos.x < sb.minX) { bPos.x = sb.minX; sb.vx = Math.abs(sb.vx) * 0.7; }
          if (bPos.x > sb.maxX) { bPos.x = sb.maxX; sb.vx = -Math.abs(sb.vx) * 0.7; }
          if (bPos.z < sb.minZ) { bPos.z = sb.minZ; sb.vz = Math.abs(sb.vz) * 0.7; }
          if (bPos.z > sb.maxZ) { bPos.z = sb.maxZ; sb.vz = -Math.abs(sb.vz) * 0.7; }
          sb.mesh.rotation.z -= (sb.vx * dt) / sb.r;
          sb.mesh.rotation.x += (sb.vz * dt) / sb.r;
        }
      }

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
    } else {
      if (ctx.fpsArmGroup) ctx.fpsArmGroup.visible = false;
      if (ctx.fpsLeftArmGroup) ctx.fpsLeftArmGroup.visible = false;
      if (ctx.localAvatar) ctx.localAvatar.group.visible = false;
      ctx.isWalking = false;
      ctx.controls.update();
    }

    if (!ctx.lobbyTourActive) {
      const isDrawingBoard = !!ctx.touchDrawingBoard || !!window.touchDrawingBoard;
      if (!isDrawingBoard && (!ctx.isTouchDevice() || ctx.isPrimaryDown || (ctx.heldItem && now - lastMobileHoverAt > 45) || (now - lastMobileHoverAt > 260))) {
        lastMobileHoverAt = now;
        updateHoverRay(ctx.interactionCtx);
      }
      const toolColor = getHeldBoardToolColor(ctx.heldItem);
      const activeBoard = ctx.chalkboards[ctx.hoveredBoardIndex];
      if (ctx.isPrimaryDown && ctx.hoveredBoardHit && toolColor && activeBoard) {
        const px = Math.round(ctx.hoveredBoardHit.uv.x * 512 * 10) / 10;
        const py = Math.round((1 - ctx.hoveredBoardHit.uv.y) * 256 * 10) / 10;
        const curPt = [px, py];
        if (!ctx.currentStroke || ctx.currentStroke.c !== toolColor || ctx.currentStroke.b !== ctx.hoveredBoardIndex) {
          ctx.flushCurrentStroke();
          ctx.currentStroke = { b: ctx.hoveredBoardIndex, c: toolColor, pts: [curPt] };
          drawBoardSegment(activeBoard.ctx, toolColor, curPt, curPt);
          activeBoard.tex.needsUpdate = true;
          ctx.lastDrawPt = curPt;
        } else if (!ctx.lastDrawPt || Math.hypot(curPt[0] - ctx.lastDrawPt[0], curPt[1] - ctx.lastDrawPt[1]) >= 2.5) {
          drawBoardSegment(activeBoard.ctx, toolColor, ctx.lastDrawPt || curPt, curPt);
          activeBoard.tex.needsUpdate = true;
          ctx.currentStroke.pts.push(curPt);
          ctx.lastDrawPt = curPt;
          if (ctx.currentStroke.pts.length >= 60) {
            ctx.flushCurrentStroke();
            ctx.currentStroke = { b: ctx.hoveredBoardIndex, c: toolColor, pts: [curPt] };
            ctx.lastDrawPt = curPt;
          }
        }
      } else if (ctx.currentStroke) {
        ctx.flushCurrentStroke();
      }
    }

    // Fluxo laminar
    if (ctx.hoodAirData && ctx.hoodAirData.on && ctx.hoodAirData.attr) {
      const aArr = ctx.hoodAirData.attr.array;
      for (let ai = 0; ai < aArr.length; ai += 3) {
        aArr[ai] += dt * 1.45;
        if (aArr[ai] > 0.78) {
          aArr[ai] = -0.36;
          aArr[ai + 1] = 0.10 + Math.random() * 0.85;
          aArr[ai + 2] = (Math.random() - 0.5) * 2.0;
        }
      }
      ctx.hoodAirData.attr.needsUpdate = true;
    }

    // Agitador magnetico
    if (ctx.stirrerDevices.length) {
      for (let si = 0; si < ctx.pickableItems.length; si++) {
        const liqIt = ctx.pickableItems[si];
        const lcCtrl = liqIt.mesh && liqIt.mesh.userData.liquidCtrl;
        if (!lcCtrl || !lcCtrl.stirBar) continue;
        const lx = liqIt.mesh.position.x, ly = liqIt.mesh.position.y, lz = liqIt.mesh.position.z;
        for (let sj = 0; sj < ctx.stirrerDevices.length; sj++) {
          const st = ctx.stirrerDevices[sj];
          if (st.on && lx >= st.surface.minX && lx <= st.surface.maxX && lz >= st.surface.minZ && lz <= st.surface.maxZ && Math.abs(ly - st.surface.topY) < 0.08) {
            lcCtrl.stirBar.rotation.y += dt * 18;
            if (lcCtrl.mycCloud) lcCtrl.mycCloud.rotation.y += dt * 4.5;
            break;
          }
        }
      }
    }

    // Balanca de precisao
    if (ctx.scaleDevices.length && (!lastScaleAt || now - lastScaleAt > 150)) {
      lastScaleAt = now;
      for (let sci = 0; sci < ctx.scaleDevices.length; sci++) {
        const scObj = ctx.scaleDevices[sci];
        let gross = 0;
        for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
          const pIt = ctx.pickableItems[pi];
          if (ctx.heldItem === pIt || pIt.mesh.userData.tableDims || pIt.potItem) continue;
          const px0 = pIt.mesh.position.x, py0 = pIt.mesh.position.y, pz0 = pIt.mesh.position.z;
          if (px0 >= scObj.surface.minX && px0 <= scObj.surface.maxX && pz0 >= scObj.surface.minZ && pz0 <= scObj.surface.maxZ && py0 >= scObj.surface.topY - 0.04 && py0 <= scObj.surface.topY + 0.45) {
            if (pIt.mesh.userData.liquidCtrl) gross += 260 + pIt.mesh.userData.liquidCtrl.volMl;
            else if (pIt.id.indexOf('spawn_jar_empty') === 0) gross += 320;
            else if (pIt.id.indexOf('spawn_jar') === 0) gross += 780;
            else if (pIt.id.indexOf('spawn_bag_empty') === 0) gross += 25;
            else if (pIt.id.indexOf('spawn_bag') === 0) gross += 1525;
            else if (pIt.id.indexOf('pda_bottle') === 0) gross += 540;
            else if (pIt.id.indexOf('petri_bare_') === 0) gross += 18;
            else if (pIt.id.indexOf('petri_') === 0) gross += 38;
            else if (pIt.mesh.userData.isSyringe) gross += 12 + pIt.mesh.userData.syrCtrl.volMl;
            else if (pIt.mesh.userData.isAlcoholSpray) gross += 380;
            else if (pIt.id.indexOf('substrate_') === 0) gross += 5000;
            else if (pIt.id.indexOf('gloves_box_') === 0) gross += 420;
            else if (pIt.id.indexOf('foil_roll_') === 0) gross += 260;
            else if (pIt.id.indexOf('micropore_') === 0 || pIt.id.indexOf('parafilm_') === 0) gross += 65;
            else gross += 150;
          }
        }
        scObj.lastGross = gross;
        scObj.draw(gross - scObj.tare);
      }
    }

    // Panelas de pressao e fogareiros
    if (ctx.cookerPots.length) {
      let anyPotSteaming = false;
      for (let bni = 0; bni < ctx.burnerDevices.length; bni++) {
        const bnd = ctx.burnerDevices[bni];
        bnd.heat = bnd.on ? Math.min(1, (bnd.heat || 0) + dt * 0.55) : Math.max(0, (bnd.heat || 0) - dt * 0.25);
        const h = bnd.heat;
        const pulse = h > 0.2 ? Math.sin(ctx.clock.elapsedTime * 5.0) * 0.08 * h : 0;
        bnd.coilMat.emissiveIntensity = h * 2.2 + pulse;
        bnd.coilMat.color.setRGB(0.39 + h * 0.55, 0.45 - h * 0.30, 0.55 - h * 0.48);
        if (bnd.reflectorMat) bnd.reflectorMat.emissiveIntensity = h * 0.28;
      }
      let nearestSteamDist = Infinity;
      let bestSteamFactor = 0;
      for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
        const cp = ctx.cookerPots[cpi];
        const potP = cp.potItem.mesh.position;
        let onActiveBurner = false;
        for (let bi = 0; bi < ctx.burnerDevices.length; bi++) {
          const bn = ctx.burnerDevices[bi];
          if (bn.on && potP.x >= bn.surface.minX && potP.x <= bn.surface.maxX && potP.z >= bn.surface.minZ && potP.z <= bn.surface.maxZ && Math.abs(potP.y - bn.surface.topY) < 0.08) {
            onActiveBurner = true; break;
          }
        }
        if (onActiveBurner && cp.lidItem.isAttached) {
          if (cp.temp < 121) {
            cp.temp = Math.min(121, cp.temp + dt * 6.5);
          } else if (cp.psi < 15.0 && cp.progress < 100) {
            cp.psi = Math.min(15.0, cp.psi + dt * 3.0);
          }
        } else {
          if (cp.psi > 0) {
            cp.psi = Math.max(0, cp.psi - dt * 2.2);
          } else {
            cp.temp = Math.max(25, cp.temp - dt * 9.5);
          }
          if (!cp.lidItem.isAttached) {
            cp.psi = 0;
            cp.overheatTimer = 0;
            if (cp.contents.length === 0) cp.burned = false;
            if (!cp.burned) cp.progress = 0;
          }
        }

        const isLocked = cp.lidItem.isAttached && cp.psi >= 1.5;
        if (cp.safetyPins) {
          const targetPinY = isLocked ? 0.128 : 0.110;
          for (let pni = 0; pni < cp.safetyPins.length; pni++) {
            cp.safetyPins[pni].position.y += (targetPinY - cp.safetyPins[pni].position.y) * Math.min(1, dt * 10);
          }
        }

        const steamFactor = (cp.lidItem.isAttached && cp.psi >= 10.0) ? Math.min(1, (cp.psi - 10.0) / 5.0) : 0;
        if (steamFactor > 0.02) {
          anyPotSteaming = true;
          const sDist = Math.hypot(potP.x - ctx.playerPos.x, potP.z - ctx.playerPos.z);
          if (sDist < nearestSteamDist) {
            nearestSteamDist = sDist;
            bestSteamFactor = steamFactor;
          }
          cp.steamPoints.visible = true;
          const sa = cp.steamAttr.array;
          const riseSpd = 0.35 + steamFactor * 0.45;
          for (let si = 0; si < sa.length; si += 3) {
            sa[si + 1] += dt * riseSpd;
            if (sa[si + 1] > 0.60) {
              sa[si] = (Math.random() - 0.5) * 0.04;
              sa[si + 1] = 0.17;
              sa[si + 2] = (Math.random() - 0.5) * 0.04;
            }
          }
          cp.steamAttr.needsUpdate = true;
          const wobble = Math.sin(ctx.clock.elapsedTime * (20 + steamFactor * 20));
          const lift = Math.abs(wobble) * (0.008 * steamFactor);
          cp.weight.position.y = 0.13 + lift;
          cp.weightTop.position.y = 0.16 + lift;
          cp.weight.rotation.z = wobble * 0.10 * steamFactor;
          cp.weightTop.rotation.z = wobble * 0.10 * steamFactor;
        } else {
          cp.steamPoints.visible = false;
          cp.weight.position.y = 0.13;
          cp.weightTop.position.y = 0.16;
          cp.weight.rotation.z = 0;
          cp.weightTop.rotation.z = 0;
        }

        if (onActiveBurner && cp.lidItem.isAttached && cp.psi >= 14.9 && !cp.burned) {
          if (cp.progress < 100) {
            cp.progress = Math.min(100, cp.progress + dt * 8.5);
            if (cp.progress >= 100) {
              cp.sterilized = true;
              cp.overheatTimer = 0;
              for (let ci = 0; ci < cp.contents.length; ci++) {
                const cIt = cp.contents[ci];
                if (cIt.spawnCtrl) {
                  cIt.spawnCtrl.sterilized = true;
                  cIt.spawnCtrl.updateVisual();
                }
              }
            }
          } else {
            cp.overheatTimer += dt;
            if (cp.overheatTimer >= 16.0) {
              cp.burned = true;
              cp.sterilized = false;
              for (let bi2 = 0; bi2 < cp.contents.length; bi2++) {
                const bIt = cp.contents[bi2];
                if (bIt.spawnCtrl) {
                  bIt.spawnCtrl.burned = true;
                  bIt.spawnCtrl.sterilized = false;
                  bIt.spawnCtrl.updateVisual();
                }
              }
              if (ctx.callbacks.onToast) {
                ctx.callbacks.onToast('🔥 Você esqueceu o fogo ligado! Tudo na panela queimou :( Jogue fora!');
              }
            }
          }
        }

        if (cp.statusSprite) {
          const pDist = Math.hypot(potP.x - ctx.playerPos.x, potP.z - ctx.playerPos.z);
          const showHud = pDist < 10.5 && (cp.burned || cp.temp > 26 || cp.psi > 0.1 || cp.progress > 0);
          cp.statusSprite.visible = showHud;
          if (showHud) {
            let stageTitle = '';
            let stageSub = '';
            let barPct = 0;
            let barCol = '#38bdf8';
            let borderCol = '#38bdf8';

            if (cp.burned) {
              stageTitle = '🔥 Tudo queimado :(';
              stageSub = 'Jogue fora o conteúdo!';
              barPct = 100;
              barCol = '#ef4444';
              borderCol = '#ef4444';
            } else if (onActiveBurner && cp.lidItem.isAttached) {
              if (cp.temp < 121) {
                barPct = Math.min(100, Math.round(((cp.temp - 25) / 96) * 100));
                stageTitle = '🔥 Aquecendo...';
                stageSub = Math.round(cp.temp) + '°C / 121°C (' + barPct + '%)';
                barCol = '#f97316';
                borderCol = '#f97316';
              } else if (cp.psi < 15.0 && cp.progress < 100) {
                barPct = Math.min(100, Math.round((cp.psi / 15) * 100));
                stageTitle = '🔒 PSI aumentando...';
                stageSub = cp.psi.toFixed(1) + ' / 15 PSI (' + barPct + '%)';
                barCol = '#f59e0b';
                borderCol = '#f59e0b';
              } else if (cp.progress < 100) {
                barPct = Math.floor(cp.progress);
                stageTitle = '♨️ Esterilizando...';
                stageSub = barPct + '% concluído (15 PSI)';
                barCol = '#22c55e';
                borderCol = '#22c55e';
              } else {
                const secLeft = Math.max(0, Math.ceil(16 - cp.overheatTimer));
                barPct = Math.round((secLeft / 16) * 100);
                stageTitle = '✅ 100% Esterilizado!';
                stageSub = 'Desligue o fogo! (' + secLeft + 's)';
                barCol = secLeft <= 5 ? '#ef4444' : '#eab308';
                borderCol = barCol;
              }
            } else {
              if (cp.psi >= 1.5) {
                barPct = Math.min(100, Math.round((cp.psi / 15) * 100));
                stageTitle = '🔒 Perdendo pressão...';
                stageSub = cp.psi.toFixed(1) + ' / 15 PSI (aguarde < 1.5)';
                barCol = '#fb923c';
                borderCol = '#f59e0b';
              } else if (cp.temp > 30) {
                barPct = Math.max(0, Math.min(100, Math.round(((cp.temp - 25) / 96) * 100)));
                stageTitle = '❄️ Temperatura caindo...';
                stageSub = Math.round(cp.temp) + '°C → ambiente (🔓 Destravada)';
                barCol = '#38bdf8';
                borderCol = '#38bdf8';
              } else if (cp.progress >= 100) {
                barPct = 100;
                stageTitle = '✅ 100% Esterilizado';
                stageSub = 'Pronto para uso! :)';
                barCol = '#22c55e';
                borderCol = '#22c55e';
              } else {
                barPct = 0;
                stageTitle = '🔓 Tampa destravada';
                stageSub = Math.round(cp.temp) + '°C';
                barCol = '#94a3b8';
                borderCol = '#64748b';
              }
            }

            const hudKey = stageTitle + '|' + stageSub + '|' + barPct + '|' + barCol;
            if (cp.lastHudKey !== hudKey) {
              cp.lastHudKey = hudKey;
              const ctxHud = cp.statusCtx;
              ctxHud.clearRect(0, 0, 320, 112);
              ctxHud.fillStyle = 'rgba(15, 23, 42, 0.90)';
              ctxHud.beginPath();
              ctxHud.roundRect(4, 4, 312, 104, 16);
              ctxHud.fill();
              ctxHud.lineWidth = 2.5;
              ctxHud.strokeStyle = borderCol;
              ctxHud.stroke();

              ctxHud.font = 'bold 21px sans-serif';
              ctxHud.fillStyle = '#f8fafc';
              ctxHud.textAlign = 'left';
              ctxHud.fillText(stageTitle, 16, 35);

              ctxHud.fillStyle = '#1e293b';
              ctxHud.fillRect(16, 48, 288, 16);
              ctxHud.fillStyle = barCol;
              ctxHud.fillRect(16, 48, Math.round(2.88 * barPct), 16);

              ctxHud.font = 'bold 17px sans-serif';
              ctxHud.fillStyle = cp.burned ? '#fca5a5' : '#e2e8f0';
              ctxHud.fillText(stageSub, 16, 90);
              cp.statusTex.needsUpdate = true;
            }
          }
        }
      }
      if (window.MycoAudio) {
        const lobbyEl = document.getElementById('campus-lobby');
        const inLobby = lobbyEl && !lobbyEl.classList.contains('hidden');
        const steamVol = (!inLobby && anyPotSteaming && nearestSteamDist < 12)
          ? Math.max(0, Math.min(1, 1 - (nearestSteamDist - 2) / 10)) * (0.45 + 0.55 * bestSteamFactor)
          : 0;
        window.MycoAudio.setSteam(steamVol > 0.01, steamVol);
      }
    }

    // Colonizacao de spawn
    if (ctx.spawnGrowItems.length) {
      for (let sgi = 0; sgi < ctx.spawnGrowItems.length; sgi++) {
        const sgIt = ctx.spawnGrowItems[sgi];
        const sc = sgIt.spawnCtrl;
        if (sc && sc.inoculated && sc.colonization < 100) {
          sc.colonization = Math.min(100, sc.colonization + dt * 4.2);
          sc.updateVisual();
        }
      }
    }

    // Borrifador de alcool
    if (ctx.sprayBursts.length) {
      for (let sbi = ctx.sprayBursts.length - 1; sbi >= 0; sbi--) {
        const sb = ctx.sprayBursts[sbi];
        sb.age += dt;
        const sArr = sb.attr.array;
        for (let k = 0; k < sArr.length; k += 3) {
          sArr[k] += sb.dir.x * dt * 2.2;
          sArr[k + 1] += sb.dir.y * dt * 2.2;
          sArr[k + 2] += sb.dir.z * dt * 2.2;
        }
        sb.attr.needsUpdate = true;
        sb.mat.opacity = Math.max(0, 0.85 * (1 - sb.age / 0.45));
        if (sb.age >= 0.45) {
          ctx.scene.remove(sb.pts);
          if (sb.pts.geometry && sb.pts.geometry.dispose) sb.pts.geometry.dispose();
          if (sb.mat && sb.mat.dispose) sb.mat.dispose();
          ctx.sprayBursts.splice(sbi, 1);
        }
      }
    }

    drawCinemaVideoFrame(ctx, dt);
    updateDynamicEnvironment(ctx, dt);
    dropUnsupportedItems(ctx.entityCtx);

    // Ciclo da estufa
    for (let gi = 0; gi < greenhouseSlots.length; gi++) {
      const gSlot = greenhouseSlots[gi];
      gSlot.humidity = Math.max(20, gSlot.humidity - dt * 0.12);
      if (gSlot.humidity >= 60 && gSlot.stage < 3) {
        gSlot.growth += dt * (gSlot.humidity / 100) * 1.6;
        if (gSlot.growth >= 100) {
          gSlot.stage++;
          gSlot.growth = 0;
          updateGreenhouseSlotMesh(gSlot);
          ctx.queueWorldStateChange('greenhouse_slot_' + gSlot.id + '_stage', gSlot.stage);
        }
      }
    }
    stepGreenhouseParticles(dt);
    stepConfetti(dt);

    if (ctx.localEmoteTimer > 0) {
      ctx.localEmoteTimer -= dt;
      if (ctx.isWalking || ctx.localEmoteTimer <= 0) {
        ctx.localEmote = '';
        ctx.localEmoteTimer = 0;
      }
    }

    stepMultiplayerAvatars({
      remoteAvatars: ctx.remoteAvatars,
      clock: ctx.clock,
      auraEnabled: ctx.auraEnabled,
      findPickable: ctx.findPickable,
      heldItem: ctx.heldItem
    }, dt);

    ctx.renderer.render(ctx.scene, ctx.camera);
  }

  tick();
}
