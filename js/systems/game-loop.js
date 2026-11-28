/**
 * Loop Principal de Simulacao e Renderizacao (MycoCampus3D)
 * Orquestra subsistemas modulares com ZERO alocacao por frame e depuracao centralizada.
 */

import { renderQuickInventory } from '../ui/inventory-bar.js';
import { logger } from '../core/logger.js';
import * as qualityMod from '../core/quality.js';
import { perfBegin, perfEnd } from '../core/perf-overlay.js';
import {
  getCinemaHitTarget as cinemaHitTarget,
  drawCinemaVideoFrame as cinemaDrawFrame
} from '../engine/cinema.js';
import { updateDynamicEnvironment as envUpdate } from '../engine/environment.js';
import { stepBlobShadows } from '../engine/blob-shadows.js';
import { stepFxBursts } from '../engine/fx-burst.js';
import {
  getVirtualDayFrac,
  updateClockTexture
} from '../world/staircase-clock.js';
import { stepConfetti } from '../entities/confetti.js';
import { stepTripGnomes } from '../world/trip-gnomes.js';
import { stepEcologyMonitoringStation } from '../world/ecology-station.js';
import { stepUfoAbduction } from '../world/ufo-abduction.js';
import { dropUnsupportedItems } from '../entities/placement-ghost.js';
import { stepMultiplayerAvatars } from '../entities/avatars.js';
import { stepThermalGuides } from '../entities/vehicles/paraglider.js';
import { getHeldBoardToolColor, drawBoardSegment } from './chalkboard.js';
import { stepLobbyTour } from './lobby-tour.js';
import { updateHoverRay } from './interaction-system.js';
import { syncFloatingActions } from '../ui/radial-menu.js';
import { stepPlayerMovement } from './player-movement.js';
import { stepHeldItemAndSyringe } from './held-item-loop.js';
import { stepSportBalls } from './sports-physics.js';
import { stepLaminarHood } from '../items/laminar-hood.js';
import { stepMagneticStirrers } from '../items/magnetic-stirrer.js';
import { stepPrecisionScales } from '../items/precision-scale.js';
import { stepPressureCookers } from '../items/pressure-cooker.js';
import { stepSpawnColonization } from '../items/spawn-containers.js';
import { stepSprayBursts, spawnSprayParticles } from '../items/alcohol-spray.js';
import { stepLabSinks } from '../items/lab-sink.js';
import { stepCultureFridges } from '../items/culture-fridge.js';
import { stepLabCabinets } from '../items/lab-cabinets.js';
import { stepPetriCultures } from '../items/petri-dish.js';
import { stepFalconCultures } from '../items/falcon-tubes.js';
import { stepPortableGrows } from '../items/portable-grow.js';
import { stepGreenhouse } from '../world/greenhouse.js';
import { stepForestDistanceCulling } from '../world/mushroom-species.js';
import { stepPastureCows } from '../entities/pasture-cows.js';
import { stepPets } from '../entities/pets.js';
import { stepVillageTraffic } from '../world/village-traffic.js';
import { stepDehydrators } from '../items/dehydrator.js';
import { stepMonotubs } from '../items/monotub.js';
import { stepCampusGarden } from '../world/campus-garden.js';
import { stepAlcoholLamps } from '../items/lab-advanced-tools.js';
import { stepRoadsideMushroomSales } from '../world/roadside-npc-actor.js';
import { stepAmpouleCases } from '../items/ampoule-case.js';
import { syncHudMiniTimers } from '../ui/hud-timers.js';
let lastMiniTimersAt = 0;

let lastMobileHoverAt = 0;
let lastDesktopHoverAt = 0;
let animationStarted = false;
let frameErrorLogged = false;

const _qualityArg = {
  renderer: null,
  camera: null,
  scene: null,
  envSun: null,
  weatherPoints: null,
  isTouchDevice: false,
  autoActive: false,
  onQualityChange: null
};

const _cinemaHitArg = {
  power: false,
  lessonIdx: 0,
  lessons: null
};

const _cinemaFrameArg = {
  ctx: null,
  tex: null,
  camera: null,
  power: false,
  lessonIdx: 0,
  lessons: null,
  playing: false,
  dirty: false,
  time: 0,
  hovered: false,
  hoveredUv: null
};

const _envRainbow = { active: false, timer: 0, duration: 0 };

const _envArg = {
  envTime: 0,
  getVirtualDayFrac,
  lastWeatherMode: '',
  weatherMode: '',
  outsideTempC: 25.5,
  outsideHumidity: 48,
  snowMix: 0,
  rainbow: _envRainbow,
  scene: null,
  sunDisc: null,
  sunHalo: null,
  moonDisc: null,
  starPoints: null,
  celestialDome: null,
  skyGradient: null,
  rainPuddles: null,
  cozyDetails: null,
  nightLampGlows: null,
  envSun: null,
  envHemi: null,
  isTouch: false,
  envCloudMat: null,
  envClouds: null,
  envCloudsInst: null,
  terrainSnowMat: null,
  weatherPoints: null,
  weatherPosAttr: null,
  qualityTier: '',
  inFps: false,
  playerPos: null,
  camera: null,
  roofZones: null,
  rainbowMesh: null,
  fountainRipples: null,
  fountainDropsAttr: null
};

const THREE = window.THREE;

const _mpAvatarsArg = {
  remoteAvatars: null,
  clock: null,
  auraEnabled: false,
  findPickable: null,
  heldItem: null,
  camera: null,
  onRemoteActionFx: null
};
let _fxLoopCtx = null;
const _fxOriginVec = new THREE.Vector3();
const _fxDirVec = new THREE.Vector3();

function triggerRemoteAvatarFxInWorld(fxKind, av, heldObj) {
  const ctx = _fxLoopCtx;
  if (!ctx || !av || !av.group) return;
  const ap = av.group.position;
  const yaw = av.group.rotation.y || 0;
  if (fxKind === 'fx_spray' || fxKind === 'fx_wipe') {
    _fxOriginVec.set(-Math.sin(yaw) * 0.55, 1.05, -Math.cos(yaw) * 0.55).add(ap);
    _fxDirVec.set(-Math.sin(yaw), -0.15, -Math.cos(yaw)).normalize();
    spawnSprayParticles(ctx, fxKind === 'fx_spray' ? 0xe0f2fe : 0xf8fafc, 16, _fxOriginVec, _fxDirVec, 0.85, 2.0, 0.03, 0.42);
  } else if (fxKind === 'fx_harvest' || fxKind === 'fx_flame') {
    _fxOriginVec.set(-Math.sin(yaw) * 0.5, 1.05, -Math.cos(yaw) * 0.5).add(ap);
    _fxDirVec.set(0, 1, 0);
    spawnSprayParticles(ctx, fxKind === 'fx_flame' ? 0xf97316 : 0x34d399, 14, _fxOriginVec, _fxDirVec, 1.1, 1.4, 0.032, 0.5);
  } else if (fxKind === 'fx_seal' && ctx.pickableItems) {
    let bestSealer = null;
    let bestD = 9.0;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      if (!it || !it.sealerCtrl || !it.mesh) continue;
      const d = it.mesh.position.distanceToSquared(ap);
      if (d < bestD) { bestD = d; bestSealer = it; }
    }
    if (bestSealer && bestSealer.sealerCtrl.triggerSealAnimation) {
      bestSealer.sealerCtrl.triggerSealAnimation();
    }
  } else if (fxKind === 'fx_jar' && ctx.pickableItems) {
    let bestJar = null;
    let bestD = 9.0;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      if (!it || !it.silicaJarCtrl || !it.mesh) continue;
      const d = it.mesh.position.distanceToSquared(ap);
      if (d < bestD) { bestD = d; bestJar = it; }
    }
    if (bestJar && bestJar.silicaJarCtrl.pulseLid) {
      bestJar.silicaJarCtrl.pulseLid();
    }
  } else if (fxKind === 'fx_shake' && heldObj && heldObj.spawnCtrl) {
    heldObj.spawnCtrl.shakeAnimTimer = 0.75;
  }
}

function syncQualityArg(ctx) {
  _qualityArg.renderer = ctx.renderer;
  _qualityArg.camera = ctx.camera;
  _qualityArg.envSun = ctx.envSun;
  _qualityArg.weatherPoints = ctx.weatherPoints;
  _qualityArg.isTouchDevice = ctx.isTouchDevice();
  _qualityArg.autoActive = ctx.inFps;
  _qualityArg.onQualityChange = ctx.callbacks.onQualityChange;
  _qualityArg.scene = ctx.scene;
}

export function applyQualityTier(ctx, tier) {
  qualityMod.qualityState.mode = ctx.qualityMode === 'auto' ? 'auto' : 'manual';
  syncQualityArg(ctx);
  qualityMod.applyQualityTier(tier, _qualityArg);
  ctx.qualityTier = qualityMod.qualityState.tier;
  ctx.auraEnabled = qualityMod.qualityState.auraEnabled;
}

const _blindDummy = new THREE.Object3D();

export function stepAutoQuality(ctx, now) {
  qualityMod.qualityState.mode = ctx.qualityMode === 'auto' ? 'auto' : 'manual';
  syncQualityArg(ctx);
  qualityMod.stepAutoQuality(now, _qualityArg);
  const lightRefPos = ctx.inFps ? ctx.playerPos : ((ctx.camera && ctx.camera.position) || ctx.playerPos);
  qualityMod.stepPointLightBudget(ctx.scene, lightRefPos);
  ctx.qualityTier = qualityMod.qualityState.tier;
  ctx.auraEnabled = qualityMod.qualityState.auraEnabled;
}

export function getCinemaHitTarget(ctx, uv) {
  _cinemaHitArg.power = ctx.cinemaPower;
  _cinemaHitArg.lessonIdx = ctx.cinemaLessonIdx;
  _cinemaHitArg.lessons = ctx.cinemaLessons;
  return cinemaHitTarget(uv, _cinemaHitArg);
}

export function drawCinemaVideoFrame(ctx, dt) {
  _cinemaFrameArg.ctx = ctx.cinemaCtx;
  _cinemaFrameArg.tex = ctx.cinemaTex;
  _cinemaFrameArg.camera = ctx.camera;
  _cinemaFrameArg.power = ctx.cinemaPower;
  _cinemaFrameArg.lessonIdx = ctx.cinemaLessonIdx;
  _cinemaFrameArg.lessons = ctx.cinemaLessons;
  _cinemaFrameArg.playing = ctx.cinemaPlaying;
  _cinemaFrameArg.dirty = ctx.cinemaDirty;
  _cinemaFrameArg.time = ctx.cinemaTime;
  _cinemaFrameArg.hovered = ctx.hoveredCinema;
  _cinemaFrameArg.hoveredUv = ctx.hoveredCinemaUv;
  cinemaDrawFrame(dt, _cinemaFrameArg);
  ctx.cinemaTime = _cinemaFrameArg.time;
  ctx.cinemaDirty = _cinemaFrameArg.dirty;
}

export function updateDynamicEnvironment(ctx, dt, precipitationDt = dt) {
  _envRainbow.active = ctx.rainbowActive;
  _envRainbow.timer = ctx.rainbowTimer;
  _envRainbow.duration = ctx.rainbowDuration;

  _envArg.envTime = ctx.envTime;
  _envArg.lastWeatherMode = ctx.lastWeatherMode;
  _envArg.weatherMode = ctx.weatherMode;
  _envArg.outsideTempC = ctx.outsideTempC;
  _envArg.outsideHumidity = ctx.outsideHumidity;
  _envArg.snowMix = ctx.snowMix;
  _envArg.scene = ctx.scene;
  _envArg.sunDisc = ctx.sunDisc;
  _envArg.sunHalo = ctx.sunHalo;
  _envArg.moonDisc = ctx.moonDisc;
  _envArg.starPoints = ctx.starPoints;
  _envArg.celestialDome = ctx.celestialDome;
  _envArg.skyGradient = ctx.skyGradient;
  _envArg.rainPuddles = ctx.rainPuddles;
  _envArg.cozyDetails = ctx.cozyDetails;
  _envArg.nightLampGlows = ctx.nightLampGlows;
  _envArg.envSun = ctx.envSun;
  _envArg.envHemi = ctx.envHemi;
  _envArg.isTouch = ctx.isTouchDevice();
  _envArg.envCloudMat = ctx.envCloudMat;
  _envArg.envClouds = ctx.envClouds;
  _envArg.envCloudsInst = ctx.envCloudsInst;
  _envArg.terrainSnowMat = ctx.terrainSnowMat;
  _envArg.weatherPoints = ctx.weatherPoints;
  _envArg.weatherPosAttr = ctx.weatherPosAttr;
  _envArg.qualityTier = ctx.qualityTier;
  _envArg.inFps = ctx.inFps;
  _envArg.playerPos = ctx.playerPos;
  _envArg.camera = ctx.camera;
  _envArg.roofZones = ctx.roofZones;
  _envArg.rainbowMesh = ctx.rainbowMesh;
  _envArg.fountainRipples = ctx.fountainRipples;
  _envArg.fountainDropsAttr = ctx.fountainDropsAttr;

  envUpdate(dt, _envArg, precipitationDt);
  qualityMod.stepSunShadow(ctx.renderer, ctx.envSun, ctx.playerPos);
  if (ctx.blobShadows) stepBlobShadows(ctx.blobShadows, ctx, qualityMod.qualityState.shadowsActive);
  ctx.envTime = _envArg.envTime;
  ctx.lastWeatherMode = _envArg.lastWeatherMode;
  ctx.weatherMode = _envArg.weatherMode;
  ctx.outsideTempC = _envArg.outsideTempC;
  ctx.outsideHumidity = _envArg.outsideHumidity;
  ctx.snowMix = _envArg.snowMix;
  ctx.rainbowActive = _envRainbow.active;
  ctx.rainbowTimer = _envRainbow.timer;
  ctx.rainbowDuration = _envRainbow.duration;
  ctx.sunElevation = Math.sin((getVirtualDayFrac() - 0.25) * Math.PI * 2);
}

function stepArchitectureProps(ctx, dt, now) {
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;
  for (let wmIdx = 0; wmIdx < ctx.wildMushrooms.length; wmIdx++) {
    const wm = ctx.wildMushrooms[wmIdx];
    if (!wm.active && now >= wm.respawnAt) {
      wm.active = true; wm.group.visible = true;
    } else if (wm.active && wm.group.visible && wm.capMesh && wm.capMesh.matrixAutoUpdate !== false) {
      const gx = wm.group.position.x - px;
      const gz = wm.group.position.z - pz;
      if (gx * gx + gz * gz < 484) {
        wm.capMesh.rotation.y += dt * 0.5;
      }
    }
  }

  for (let di = 0; di < ctx.campusDoors.length; di++) {
    const d = ctx.campusDoors[di];
    const targetAngle = d.open ? -d.dir * Math.PI * 0.48 : 0;
    if (Math.abs(targetAngle - d.angle) > 0.0005) {
      d.angle += (targetAngle - d.angle) * Math.min(1, dt * 8);
      if (d.leftPivot && d.rightPivot) {
        d.leftPivot.rotation.y = d.angle;
        d.rightPivot.rotation.y = -d.angle;
      } else if (d.pivot) {
        d.pivot.rotation.y = d.angle;
      }
    }
    if (d.doorCollider) {
      if (d.installed === false) {
        d.doorCollider.maxY = d.uninstalledMaxY !== undefined ? d.uninstalledMaxY : -1;
      } else {
        d.doorCollider.maxY = d.open ? -1 : (d.eavesY || 4.70);
      }
    }
  }

  for (let bi = 0; bi < ctx.windowBlinds.length; bi++) {
    const b = ctx.windowBlinds[bi];
    const targetProg = b.open ? 0.0 : 1.0;
    if (Math.abs(b.progress - targetProg) > 0.001) {
      b.progress += (targetProg - b.progress) * Math.min(1, dt * 7.5);
      const p = b.progress;
      const count = b.slatInst ? b.slatCount : b.slats.length;
      const activeSpan = (b.dropH - 0.14) * p;
      const rotZ = b.dir * (0.28 * p + (1 - p) * 1.15);
      if (b.slatInst) {
        _blindDummy.rotation.set(0, 0, rotZ);
        _blindDummy.scale.set(1, 1, 1);
        for (let si = 0; si < count; si++) {
          const frac = (si + 0.5) / count;
          const stackedY = -0.05 - si * 0.007;
          const fullY = -0.07 - frac * (b.dropH - 0.12);
          _blindDummy.position.set(0, stackedY + (fullY - stackedY) * p, 0);
          _blindDummy.updateMatrix();
          b.slatInst.setMatrixAt(si, _blindDummy.matrix);
        }
        b.slatInst.instanceMatrix.needsUpdate = true;
      } else {
        for (let si = 0; si < count; si++) {
          const frac = (si + 0.5) / count;
          const stackedY = -0.05 - si * 0.007;
          const fullY = -0.07 - frac * (b.dropH - 0.12);
          b.slats[si].position.y = stackedY + (fullY - stackedY) * p;
          b.slats[si].rotation.z = rotZ;
        }
      }
      const bottomY = -0.09 - count * 0.007 - activeSpan;
      b.bottomRail.position.y = bottomY;
      const tapeLen = Math.max(0.08, -bottomY);
      if (b.tapesMesh) {
        b.tapesMesh.scale.y = tapeLen / b.dropH;
      } else if (b.tapes) {
        for (let ti = 0; ti < b.tapes.length; ti++) {
          b.tapes[ti].scale.y = tapeLen / b.dropH;
          b.tapes[ti].position.y = -tapeLen / 2;
        }
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
  const isTouch = ctx.isTouchDevice();
  const shouldUpdateHover = isTouch
    ? (ctx.isPrimaryDown || (ctx.heldItem && now - lastMobileHoverAt > 45) || (now - lastMobileHoverAt > 70))
    : (ctx.isPrimaryDown || now - lastDesktopHoverAt >= 33);
  if (!isDrawingBoard && shouldUpdateHover) {
    lastMobileHoverAt = now;
    if (!isTouch) lastDesktopHoverAt = now;
    updateHoverRay(ctx.interactionCtx);
    syncFloatingActions(ctx.interactionCtx);
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

  let simSlowAccumDt = 0;
  let lastSlowStepAt = 0;

  function tick() {
    requestAnimationFrame(tick);
    if ((typeof document !== 'undefined' && document.hidden) || ctx._contextLost) {
      if (ctx.clock) ctx.clock.getDelta();
      return;
    }
    try {
      perfBegin();
      const elapsed = ctx.clock.getDelta();
      const dt = Math.min(0.05, elapsed);
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
      stepAlcoholLamps(ctx, dt);
      stepRoadsideMushroomSales(ctx, dt);
      stepCultureFridges(ctx, dt);
      stepAmpouleCases(ctx, dt);
      stepLabCabinets(ctx, dt);
      stepMagneticStirrers(ctx, dt);
      if (now - lastMiniTimersAt >= 500) {
        lastMiniTimersAt = now;
        syncHudMiniTimers(ctx);
      }
      stepPressureCookers(ctx, dt);
      stepSprayBursts(ctx, dt);
      stepPastureCows(ctx, dt);
      stepPets(ctx, dt);
      stepVillageTraffic(ctx, now);
      stepTripGnomes(ctx, dt);
      stepEcologyMonitoringStation(ctx, dt);
      stepUfoAbduction(ctx, dt);

      simSlowAccumDt += dt;
      if (now - lastSlowStepAt >= 95) {
        const slowDt = simSlowAccumDt;
        simSlowAccumDt = 0;
        lastSlowStepAt = now;
        stepPetriCultures(ctx, slowDt);
        stepFalconCultures(ctx, slowDt);
        stepPrecisionScales(ctx, now);
        stepSpawnColonization(ctx, slowDt);
        stepLabSinks(ctx);
        stepGreenhouse(ctx, slowDt);
        stepPortableGrows(ctx, slowDt);
        stepDehydrators(ctx, slowDt);
        stepMonotubs(ctx, slowDt);
        stepCampusGarden(slowDt, ctx);
        dropUnsupportedItems(ctx.entityCtx);
      }

      stepForestDistanceCulling(ctx);
      stepThermalGuides(ctx);
      qualityMod.stepMobileItemCulling(ctx, now);
      drawCinemaVideoFrame(ctx, dt);
      updateDynamicEnvironment(ctx, dt, Math.min(0.2, elapsed));
      stepConfetti(dt);
      stepFxBursts(dt);
      if (typeof window !== 'undefined' && ctx.playerPos) {
        const sunYNow = typeof ctx.sunElevation === 'number' ? ctx.sunElevation : Math.sin((getVirtualDayFrac() - 0.25) * Math.PI * 2);
        window.campusIsNight = sunYNow < -0.05;
        if (window.MycoAudio && window.MycoAudio.stepAmbience) {
          const insideWing = Math.abs(ctx.playerPos.x) > 13 && Math.abs(ctx.playerPos.x) < 25 && Math.abs(ctx.playerPos.z) < 16;
          window.MycoAudio.stepAmbience(sunYNow, !insideWing, window.campusIsNight, dt, ctx.weatherMode);
        }
      }

      if (ctx.localEmoteTimer > 0) {
        ctx.localEmoteTimer -= dt;
        if (ctx.isWalking || ctx.localEmoteTimer <= 0) {
          ctx.localEmote = '';
          ctx.localEmoteTimer = 0;
        }
      }

      _fxLoopCtx = ctx;
      _mpAvatarsArg.remoteAvatars = ctx.remoteAvatars;
      _mpAvatarsArg.clock = ctx.clock;
      _mpAvatarsArg.auraEnabled = ctx.auraEnabled;
      _mpAvatarsArg.findPickable = ctx.findPickable;
      _mpAvatarsArg.heldItem = ctx.heldItem;
      _mpAvatarsArg.camera = ctx.camera;
      _mpAvatarsArg.onRemoteActionFx = triggerRemoteAvatarFxInWorld;
      stepMultiplayerAvatars(_mpAvatarsArg, dt);

      renderQuickInventory(ctx);
      ctx.renderer.render(ctx.scene, ctx.camera);
      if (typeof window !== 'undefined' && window.dismissAppPreload) {
        window.dismissAppPreload();
      }
      perfEnd(ctx.renderer, qualityMod.qualityState);
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
