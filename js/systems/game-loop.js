/**
 * Loop Principal de Simulacao e Renderizacao (MycoCampus3D)
 * Orquestra subsistemas modulares com ZERO alocacao por frame e depuracao centralizada.
 */

import { logger } from '../core/logger.js';
import * as qualityMod from '../core/quality.js';
import {
  getCinemaHitTarget as cinemaHitTarget,
  drawCinemaVideoFrame as cinemaDrawFrame
} from '../engine/cinema.js';
import { updateDynamicEnvironment as envUpdate } from '../engine/environment.js';
import {
  getVirtualDayFrac,
  updateClockTexture
} from '../world/staircase-clock.js';
import { stepConfetti } from '../entities/confetti.js';
import { dropUnsupportedItems } from '../entities/placement-ghost.js';
import { stepMultiplayerAvatars } from '../entities/avatars.js';
import { getHeldBoardToolColor, drawBoardSegment } from './chalkboard.js';
import { stepLobbyTour } from './lobby-tour.js';
import { updateHoverRay } from './interaction-system.js';
import { stepPlayerMovement } from './player-movement.js';
import { stepHeldItemAndSyringe } from './held-item-loop.js';
import { stepSportBalls } from './sports-physics.js';
import { stepLaminarHood } from '../items/laminar-hood.js';
import { stepMagneticStirrers } from '../items/magnetic-stirrer.js';
import { stepPrecisionScales } from '../items/precision-scale.js';
import { stepPressureCookers } from '../items/pressure-cooker.js';
import { stepSpawnColonization } from '../items/spawn-containers.js';
import { stepSprayBursts } from '../items/alcohol-spray.js';
import { stepGreenhouse } from '../world/greenhouse.js';

let lastMobileHoverAt = 0;
let animationStarted = false;
let frameErrorLogged = false;

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

function stepArchitectureProps(ctx, dt, now) {
  for (let wmIdx = 0; wmIdx < ctx.wildMushrooms.length; wmIdx++) {
    const wm = ctx.wildMushrooms[wmIdx];
    if (!wm.active && now >= wm.respawnAt) {
      wm.active = true; wm.group.visible = true;
    } else if (wm.active) {
      wm.capMesh.rotation.y += dt * 0.5;
    }
  }

  for (let di = 0; di < ctx.campusDoors.length; di++) {
    const d = ctx.campusDoors[di];
    const targetAngle = d.open ? -d.dir * Math.PI * 0.48 : 0;
    d.angle += (targetAngle - d.angle) * Math.min(1, dt * 8);
    d.pivot.rotation.y = d.angle;
  }

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
}

function stepHoverAndChalkboard(ctx, now) {
  if (ctx.lobbyTourActive) return;

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

export function startAnimationLoop(ctx) {
  if (animationStarted) return;
  animationStarted = true;

  function tick() {
    requestAnimationFrame(tick);
    try {
      const dt = Math.min(0.05, ctx.clock.getDelta());
      const now = performance.now();
      stepAutoQuality(ctx, now);
      updateClockTexture();
      stepArchitectureProps(ctx, dt, now);

      if (ctx.lobbyTourActive) {
        ctx.tourTime = stepLobbyTour(ctx.camera, ctx.controls, ctx.tourTime, dt);
      } else if (ctx.inFps) {
        stepPlayerMovement(ctx, dt, now);
        stepHeldItemAndSyringe(ctx, dt, now);
        stepSportBalls(ctx, dt);
      } else {
        if (ctx.fpsArmGroup) ctx.fpsArmGroup.visible = false;
        if (ctx.fpsLeftArmGroup) ctx.fpsLeftArmGroup.visible = false;
        if (ctx.localAvatar) ctx.localAvatar.group.visible = false;
        ctx.isWalking = false;
        ctx.controls.update();
      }

      stepHoverAndChalkboard(ctx, now);
      stepLaminarHood(ctx, dt);
      stepMagneticStirrers(ctx, dt);
      stepPrecisionScales(ctx, now);
      stepPressureCookers(ctx, dt);
      stepSpawnColonization(ctx, dt);
      stepSprayBursts(ctx, dt);
      stepGreenhouse(ctx, dt);
      drawCinemaVideoFrame(ctx, dt);
      updateDynamicEnvironment(ctx, dt);
      dropUnsupportedItems(ctx.entityCtx);
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
      frameErrorLogged = false;
    } catch (err) {
      if (!frameErrorLogged) {
        frameErrorLogged = true;
        logger.error('game-loop', 'Erro no loop de renderizacao', err);
      }
    }
  }

  tick();
}
