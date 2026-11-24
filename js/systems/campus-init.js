/**
 * Inicializacao do Campus 3D (MycoCampus3D)
 * Cria a cena Three.js, iluminacao, construtores de mundo, entidades e inicia o game loop.
 */

import { GAME_CONFIG } from '../core/config.js';
import { logger } from '../core/logger.js';
import { CAMPUS_EXPOSURE, getInitialQualityTier, getSavedQualityMode, qualityState } from '../core/quality.js';
import { syncViewportCssVars } from '../ui/dom-helpers.js';
import { createProceduralTextures } from '../engine/textures.js';
import { createRainbowMesh } from '../engine/rainbow.js';
import { createCelestialSkyDome } from '../engine/sky-constellations.js';
import { createSkyGradientDome } from '../engine/sky-gradient.js';
import { createRainPuddles } from '../engine/rain-puddles.js';
import { createBlobShadows } from '../engine/blob-shadows.js';
import { buildNatureWorld, buildPlaza, nightLampGlows } from '../world/nature-plaza.js';
import { createCozyDetails } from '../world/cozy-details.js';
import { buildPlazaTelescope } from '../world/plaza-telescope.js';
import { buildSportsScoreboard } from '../world/sports-scoreboard.js';
import { buildExpandedForestAndMushrooms } from '../world/mushroom-species.js';
import { createPastureAndCows } from '../entities/pasture-cows.js';
import { buildStaircaseAndBridge, buildClockTowerAndAuditorium } from '../world/staircase-clock.js';
import { registerPickable } from '../items/item-registry.js';
import { buildCampusWingsAndEquipment } from '../world/lab-tools.js';
import {
  initGreenhouseParticlePools,
  interactGreenhouseSlot,
  greenhouseEnv,
  applyGreenhouseAutomationSettings,
  restoreGreenhouseOptimal,
  triggerGreenhouseMistPulse,
  triggerGreenhouseVentPulse
} from '../world/greenhouse.js';
import { buildOuterCampus } from '../world/outer-campus.js';
import { ensureCoreAdminPrefabs } from './admin-editor.js';
import { initConfettiSystem } from '../entities/confetti.js';
import { buildFirstPersonArm } from '../entities/first-person-arm.js';
import { initThermoDisplay, createThermoLaserFx } from '../entities/thermo-laser.js';
import { createPlacementGhost } from '../entities/placement-ghost.js';
import { createHover3dBadge } from '../entities/hover-3d-badge.js';
import { buildCuteAvatar } from '../entities/avatars.js';
import { dropHeldItem, handlePrimaryAction, pickHoveredItemForMove, updateHoverRay } from './interaction-system.js';
import {
  cancelHeldItemPlacement,
  toggleHeldItemPlacement
} from './held-item-placement.js';
import { bindControls } from './input-controller.js';
import { freezeStaticWorld } from '../engine/scene-optimizer.js';
import { applyQualityTier, getCinemaHitTarget, startAnimationLoop } from './game-loop.js';
import { registerCampusPublicApi as bindPublicApi } from './campus-api.js';
import { restoreLocalWorldObjects } from './world-objects-sync.js';

const THREE = window.THREE;

const sim = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  clock: null,
  raycaster: new THREE.Raycaster(),
  pointerNdc: new THREE.Vector2(0, 0),

  // Colisoes, pisos e objetos
  solidColliders: [],
  wallSegments: [],
  walkableFloors: [],
  stairsList: [],
  supportSurfaces: [],
  supportMeshes: [],
  pickableItems: [],
  pickableMap: new Map(),
  remoteHeldIds: new Set(),
  _stackPhysicsDirty: true,
  wildMushrooms: [],

  // Portas, persianas, telao e relogio
  campusDoors: [],
  doorHitMeshes: [],
  hoveredDoorObj: null,
  windowBlinds: [],
  blindHitMeshes: [],
  hoveredBlindObj: null,
  lastCinemaHoverType: '',
  lastCinemaHoverIdx: -1,

  // Estado do jogador
  lobbyTourActive: true,
  tourTime: 0,
  inFps: false,
  playerPos: new THREE.Vector3(0, 0, 14.5),
  playerVelX: 0,
  playerVelZ: 0,
  playerVelY: 0,
  walkBobPhase: 0,
  playerYaw: 0,
  playerPitch: 0,
  onGround: true,
  lastGroundedAt: 0,
  jumpBufferUntil: 0,
  jumpHeld: false,
  mobileSprint: false,
  isWalking: false,
  keys: {},
  joyX: 0,
  joyY: 0,
  PLAYER_EYE: GAME_CONFIG.player.eyeHeight,
  PLAYER_RADIUS: GAME_CONFIG.player.radius,

  // Item segurado e fantasma
  heldItem: null,
  heldRotY: 0,
  lastPickupAt: 0,
  placementMode: false,
  hoveredPickable: null,
  hoveredFridgeTarget: null,
  hoveredMushroom: null,
  hoveredScreen: false,
  hoveredScreenBtn: null,
  hoveredGreenhouseSlot: null,
  hoveredGreenhouseDevice: null,
  placementGhost: null,
  placementValid: false,
  pendingMovedItems: {},
  recentlyDropped: {},

  // Termometro Laser & Seringa
  thermoLaserLine: null,
  thermoLaserDot: null,
  thermoTex: null,
  thermoCurrentTemp: 24.0,
  thermoTargetTemp: 24.0,
  thermoTargetLabel: '',
  thermoLaserOn: false,
  syringePumping: null,
  sinkFilling: null,
  pourHold: null,
  syringePunctureProgress: 0,
  hoveredSyringeTarget: null,
  lastSyringeTargetItem: null,

  // Braco 1a pessoa, Veiculos & Lousas
  fpsArmGroup: null,
  fpsLeftArmGroup: null,
  fpsSleeveMat: null,
  snowboardActive: false,
  snowboardGroup: null,
  snowboardRoll: 0,
  snowboardPitch: 0,
  paragliderActive: false,
  paragliderGroup: null,
  roundParachuteActive: false,
  roundParachuteGroup: null,
  paragliderRoll: 0,
  thermalColumns: [],
  snapClosePot: null,
  snapPetriStack: false,
  localAvatar: null,
  armSwingPhase: 0,
  armReach: 0,
  chalkboards: [],
  chalkboardMeshes: [],
  hoveredBoardHit: null,
  hoveredBoardIndex: 0,
  isPrimaryDown: false,
  lastDrawPt: null,
  currentStroke: null,
  pendingBoardStrokes: [],
  touchDrawingBoard: false,

  // Ranking 3D & Cinema
  rankingBtnMeshes: [],
  hoveredRankBtn: null,
  cinemaScreenMesh: null,
  cinemaCanvas: null,
  cinemaCtx: null,
  cinemaTex: null,
  cinemaBeam: null,
  cinemaPlaying: true,
  cinemaPower: true,
  cinemaLessonIdx: -1,
  cinemaLessons: [],
  cinemaDirty: true,
  cinemaTime: 0,
  hoveredCinema: false,
  hoveredCinemaUv: null,

  // Assentos & Equipamentos
  seatMeshes: [],
  hoveredSeat: null,
  seatedSeat: null,
  lightSwitchMeshes: [],
  campusLightSwitches: [],
  hoveredSwitch: null,
  hoodSwitchMeshes: [],
  hoveredHoodSwitch: null,
  hoodAirData: null,
  stirSwitchMeshes: [],
  hoveredStirSwitch: null,
  stirrerDevices: [],
  scaleTareMeshes: [],
  hoveredScaleTare: null,
  scaleDevices: [],
  burnerSwitchMeshes: [],
  hoveredBurnerSwitch: null,
  burnerDevices: [],
  labSinks: [],
  labSinkMeshes: [],
  labTrashMeshes: [],
  labCabinets: [],
  cabinetHitMeshes: [],
  hoveredCabinetPart: null,
  cowHitMeshes: [],
  hoveredCow: null,
  pastureCows: [],
  cowPoops: [],
  dehydrators: [],
  serverTimeSec: 0,
  serverTimeSyncAt: 0,
  hoveredSink: null,
  hoveredTrash: false,
  hoveredWipeTarget: null,
  hoveredPourTarget: null,
  hoveredFillPot: null,
  hoveredHeatSealerTarget: null,
  hoveredGrainTarget: null,
  hoveredFlocaoTarget: null,
  hoveredScalpelTarget: null,
  hoveredBowlTarget: null,
  sportBalls: [],
  basketballHoops: [],
  heldSportBall: null,
  hoveredSportBall: null,
  cookerPots: [],
  spawnGrowItems: [],
  sprayBursts: [],
  hoveredPotInsert: null,
  hoveredSprayTarget: null,
  hoodSanitizedUntil: 0,
  hoodAlcoholWet: false,
  hoodSanitizeHits: 0,
  pendingStateChanges: {},
  recentlyChangedState: {},
  fountainDropsAttr: null,
  fountainRipples: [],
  terrainSnowMat: null,
  roofZones: [],

  // Cosmeticos & Emotes locais
  localHat: 'default',
  localEmote: '',
  localEmoteTimer: 0,

  // Ambiente & Qualidade
  envSun: null,
  envHemi: null,
  envClouds: [],
  envCloudMat: null,
  sunDisc: null,
  sunHalo: null,
  moonDisc: null,
  starPoints: null,
  celestialDome: null,
  skyGradient: null,
  rainPuddles: null,
  blobShadows: null,
  cozyDetails: null,
  hoveredTelescope: false,
  telescopeZoomActive: false,
  nightLampGlows,
  envTime: 14,
  weatherPoints: null,
  weatherPosAttr: null,
  weatherMode: 'clear',
  lastWeatherMode: null,
  outsideTempC: 25.5,
  outsideHumidity: 48,
  rainbowMesh: null,
  rainbowActive: false,
  rainbowTimer: 0,
  rainbowDuration: 68,
  snowMix: 0,
  qualityMode: 'auto',
  qualityTier: 'high',
  auraEnabled: true,

  // Multiplayer
  remoteAvatars: {},

  callbacks: {
    onHarvestMushroom: null,
    onOpenLessons: null,
    onScreenNav: null,
    onNearScreen: null,
    onHoldChange: null,
    onFpsChange: null,
    onHoverPrompt: null,
    onWorldAction: null
  },

  _cachedIsTouch: null,

  refreshTouchCache: function () {
    const coarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const w = typeof window !== 'undefined' ? (window.innerWidth || 0) : 1280;
    const h = typeof window !== 'undefined' ? (window.innerHeight || 0) : 720;
    const minDim = Math.min(w, h);
    const tPts = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints || 0) : 0;
    const hasTouch = tPts > 0 && (w <= 1380 || minDim <= 1080);
    sim._cachedIsTouch = !!(coarse || hasTouch);
    return sim._cachedIsTouch;
  },

  isTouchDevice: function () {
    if (sim._cachedIsTouch === null) return sim.refreshTouchCache();
    return sim._cachedIsTouch;
  },

  notifyWorldAction: function () {
    if (sim.callbacks.onWorldAction) sim.callbacks.onWorldAction();
  },

  queueWorldStateChange: function (key, val) {
    sim.pendingStateChanges[key] = String(val);
    sim.recentlyChangedState[key] = performance.now() + 1600;
    sim.notifyWorldAction();
  },

  findPickable: function (itemId) {
    if (!itemId) return null;
    if (sim.pickableMap) {
      const hit = sim.pickableMap.get(itemId);
      if (hit) return hit;
      if (sim.pickableMap.size === sim.pickableItems.length) return null;
    }
    for (let i = 0; i < sim.pickableItems.length; i++) {
      if (sim.pickableItems[i].id === itemId) return sim.pickableItems[i];
    }
    return null;
  },

  isHeldByRemote: function (itemId) {
    if (!itemId) return false;
    if (sim.remoteHeldIds && sim.remoteHeldIds.has(itemId)) return true;
    if (sim._remoteHeldSynced) return false;
    for (const k in sim.remoteAvatars) {
      if (!Object.prototype.hasOwnProperty.call(sim.remoteAvatars, k)) continue;
      const hId = sim.remoteAvatars[k].holding;
      if (hId === itemId) return true;
      if (hId) {
        const item = sim.findPickable(itemId);
        if (item && item.potItem && item.isAttached && item.potItem.id === hId) return true;
      }
    }
    return false;
  },

  removeFromCookerContents: function (item) {
    if (!item) return;
    for (let i = 0; i < sim.cookerPots.length; i++) {
      const idx = sim.cookerPots[i].contents.indexOf(item);
      if (idx !== -1) sim.cookerPots[i].contents.splice(idx, 1);
    }
  },

  isItemInsideClosedCooker: function (item) {
    if (!item) return null;
    for (let i = 0; i < sim.cookerPots.length; i++) {
      const cp = sim.cookerPots[i];
      if (cp.contents.indexOf(item) !== -1 && cp.lidItem && cp.lidItem.isAttached) return cp;
    }
    return null;
  },

  flushCurrentStroke: function () {
    if (sim.currentStroke && sim.currentStroke.pts.length > 0) {
      sim.pendingBoardStrokes.push(sim.currentStroke);
    }
    sim.currentStroke = null;
    sim.lastDrawPt = null;
  },

  interactGreenhouseSlot: function (slot) {
    return interactGreenhouseSlot(slot, sim);
  },
  applyGreenhouseAutomationSettings: function (partial) {
    return applyGreenhouseAutomationSettings(partial, sim);
  },
  restoreGreenhouseOptimal: function () {
    return restoreGreenhouseOptimal(sim);
  },
  triggerGreenhouseMistPulse: function () {
    return triggerGreenhouseMistPulse(sim);
  },
  triggerGreenhouseVentPulse: function () {
    return triggerGreenhouseVentPulse(sim);
  },
  getGreenhouseEnv: function () {
    return greenhouseEnv;
  },

  getCinemaHitTarget: function (uv) { return getCinemaHitTarget(sim, uv); },
  dropHeldItem: function () { return dropHeldItem(sim); },
  pickHoveredItemForMove: function (explicitItem) { return pickHoveredItemForMove(sim, explicitItem); },
  toggleHeldItemPlacement: function () { return toggleHeldItemPlacement(sim); },
  cancelHeldItemPlacement: function () { return cancelHeldItemPlacement(sim); },
  handlePrimaryAction: function () { return handlePrimaryAction(sim); },
  updateHoverRay: function (customNdc) { return updateHoverRay(sim, customNdc); }
};

sim.physCtx = {
  get playerPos() { return sim.playerPos; },
  get stairsList() { return sim.stairsList; },
  get walkableFloors() { return sim.walkableFloors; },
  get supportSurfaces() { return sim.supportSurfaces; },
  get heldItem() { return sim.heldItem; },
  get wallSegments() { return sim.wallSegments; },
  get campusDoors() { return sim.campusDoors; },
  get solidColliders() { return sim.solidColliders; },
  isHeldByRemote: function (id) { return sim.isHeldByRemote(id); }
};

sim.entityCtx = {
  get scene() { return sim.scene; },
  get camera() { return sim.camera; },
  get raycaster() { return sim.raycaster; },
  get playerPos() { return sim.playerPos; },
  get inFps() { return sim.inFps; },
  get pointerNdc() { return sim.pointerNdc; },
  get heldItem() { return sim.heldItem; },
  get heldRotY() { return sim.heldRotY; },
  get snapClosePot() { return sim.snapClosePot; },
  get snapPetriStack() { return sim.snapPetriStack; },
  get cookerPots() { return sim.cookerPots; },
  get pickableItems() { return sim.pickableItems; },
  get supportMeshes() { return sim.supportMeshes; },
  get supportSurfaces() { return sim.supportSurfaces; },
  get wallSegments() { return sim.wallSegments; },
  get thermalColumns() { return sim.thermalColumns; },
  get recentlyDropped() { return sim.recentlyDropped; },
  get pendingMovedItems() { return sim.pendingMovedItems; },
  get physCtx() { return sim.physCtx; },
  get _stackPhysicsDirty() { return sim._stackPhysicsDirty; },
  set _stackPhysicsDirty(v) { sim._stackPhysicsDirty = !!v; },
  isHeldByRemote: sim.isHeldByRemote,
  removeFromCookerContents: sim.removeFromCookerContents,
  setSnapClosePot: function (v) { sim.snapClosePot = v; },
  setSnapPetriStack: function (v) { sim.snapPetriStack = v; },
  setHeldRotY: function (v) { sim.heldRotY = v; },
  getSnowboardGroup: function () { return sim.snowboardGroup; },
  setSnowboardGroup: function (v) { sim.snowboardGroup = v; },
  getParagliderGroup: function () { return sim.paragliderGroup; },
  setParagliderGroup: function (v) { sim.paragliderGroup = v; },
  setFpsArmRefs: function (r) {
    sim.fpsArmGroup = r.fpsArmGroup;
    sim.fpsLeftArmGroup = r.fpsLeftArmGroup;
    sim.fpsSleeveMat = r.fpsSleeveMat;
  },
  setThermoLaserRefs: function (r) {
    sim.thermoLaserLine = r.thermoLaserLine;
    sim.thermoLaserDot = r.thermoLaserDot;
    if (r.thermoTex) sim.thermoTex = r.thermoTex;
  }
};

sim.interactionCtx = sim;

function getWorldBuilderCtx() {
  const wbCtx = {
    scene: sim.scene,
    solidColliders: sim.solidColliders,
    wallSegments: sim.wallSegments,
    walkableFloors: sim.walkableFloors,
    stairsList: sim.stairsList,
    supportSurfaces: sim.supportSurfaces,
    supportMeshes: sim.supportMeshes,
    pickableItems: sim.pickableItems,
    pickableMap: sim.pickableMap,
    remoteHeldIds: sim.remoteHeldIds,
    wildMushrooms: sim.wildMushrooms,
    campusDoors: sim.campusDoors,
    doorHitMeshes: sim.doorHitMeshes,
    windowBlinds: sim.windowBlinds,
    blindHitMeshes: sim.blindHitMeshes,
    seatMeshes: sim.seatMeshes,
    chalkboards: sim.chalkboards,
    chalkboardMeshes: sim.chalkboardMeshes,
    lightSwitchMeshes: sim.lightSwitchMeshes,
    campusLightSwitches: sim.campusLightSwitches,
    roofZones: sim.roofZones,
    fountainRipples: sim.fountainRipples,
    rankingBtnMeshes: sim.rankingBtnMeshes,
    sportBalls: sim.sportBalls,
    basketballHoops: sim.basketballHoops,
    hoodSwitchMeshes: sim.hoodSwitchMeshes,
    cookerPots: sim.cookerPots,
    burnerDevices: sim.burnerDevices,
    burnerSwitchMeshes: sim.burnerSwitchMeshes,
    labSinks: sim.labSinks,
    labSinkMeshes: sim.labSinkMeshes,
    labTrashMeshes: sim.labTrashMeshes,
    labCabinets: sim.labCabinets,
    cabinetHitMeshes: sim.cabinetHitMeshes,
    cowHitMeshes: sim.cowHitMeshes,
    pastureCows: sim.pastureCows,
    cowPoops: sim.cowPoops,
    dehydrators: sim.dehydrators,
    spawnGrowItems: sim.spawnGrowItems,
    scaleTareMeshes: sim.scaleTareMeshes,
    scaleDevices: sim.scaleDevices,
    stirSwitchMeshes: sim.stirSwitchMeshes,
    stirrerDevices: sim.stirrerDevices,
    isTouchDevice: sim.isTouchDevice,
    getHeldItem: function () { return sim.heldItem; },
    isHeldByRemote: sim.isHeldByRemote,
    registerPickable: function (id, label, mesh, x, y, z, ry, radius, height) {
      return registerPickable(wbCtx, id, label, mesh, x, y, z, ry, radius, height);
    },
    setHoodAirData: function (h) { sim.hoodAirData = h; },
    ensureThermoTex: function () {
      if (!sim.thermoTex) sim.thermoTex = initThermoDisplay();
      return sim.thermoTex;
    },
    setTerrainSnowMat: function (m) { sim.terrainSnowMat = m; },
    setFountainDropsAttr: function (a) { sim.fountainDropsAttr = a; },
    setCinemaRefs: function (refs) {
      sim.cinemaCanvas = refs.cinemaCanvas;
      sim.cinemaCtx = refs.cinemaCtx;
      sim.cinemaTex = refs.cinemaTex;
      sim.cinemaScreenMesh = refs.cinemaScreenMesh;
      sim.cinemaBeam = refs.cinemaBeam;
    }
  };
  return wbCtx;
}

export function triggerCampusRainbow(dur) {
  sim.rainbowActive = true;
  sim.rainbowTimer = 0;
  sim.rainbowDuration = (typeof dur === 'number' && dur > 0) ? dur : 68;
  return 'Arco-íris ativado por ' + sim.rainbowDuration + 's sobre a montanha!';
}

export function initCampus3D(containerId, cbs) {
  return logger.tryCall('campus-init', function () {
    sim.callbacks = Object.assign(sim.callbacks, cbs || {});
    const container = document.getElementById(containerId);
    sim.scene = new THREE.Scene();
    sim.scene.background = new THREE.Color(0x60a5fa);
    sim.scene.fog = new THREE.FogExp2(0xbfdbfe, 0.0022);
    const touch = sim.isTouchDevice();

    sim.rainbowMesh = createRainbowMesh();
    sim.scene.add(sim.rainbowMesh);

    sim.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
    );
    sim.sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(14.5, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    sim.moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(5.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false })
    );
    sim.scene.add(sim.sunDisc, sim.sunHalo, sim.moonDisc);

    sim.celestialDome = createCelestialSkyDome(sim.scene);
    sim.skyGradient = createSkyGradientDome(sim.scene);
    sim.starPoints = sim.celestialDome ? sim.celestialDome.bgStars : null;

    sim.envCloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, emissive: 0xe0f2fe, emissiveIntensity: 0.22 });
    sim.envCloudMat.userData.keepPbr = true;
    sim.envCloudMat.userData.shared = true;
    const cloudCount = touch ? 14 : 24;
    const puffSegW = touch ? 8 : 10;
    const puffSegH = touch ? 6 : 8;
    const puffGeo = new THREE.SphereGeometry(1, puffSegW, puffSegH);
    puffGeo.userData.shared = true;
    const cloudInst = new THREE.InstancedMesh(puffGeo, sim.envCloudMat, cloudCount * 3);
    cloudInst.frustumCulled = false;
    cloudInst.userData.isDynamic = true;
    const cloudDummy = new THREE.Object3D();
    for (let cl = 0; cl < cloudCount; cl++) {
      const ca = (cl / cloudCount) * Math.PI * 2;
      const cx = Math.cos(ca) * (55 + (cl % 4) * 24);
      const cy = 30 + (cl % 5) * 4.5;
      const cz = Math.sin(ca) * (55 + (cl % 4) * 24);
      sim.envClouds.push({ x: cx, y: cy, z: cz });
      for (let cp = 0; cp < 3; cp++) {
        const r = 5 + (cp % 2) * 2.5;
        cloudDummy.position.set(cx + (cp - 1) * 5.2, cy + (cp % 2) * 1.4, cz);
        cloudDummy.scale.set(r * 1.3, r * 0.65, r);
        cloudDummy.updateMatrix();
        cloudInst.setMatrixAt(cl * 3 + cp, cloudDummy.matrix);
      }
    }
    cloudInst.instanceMatrix.needsUpdate = true;
    sim.envCloudsInst = cloudInst;
    sim.scene.add(cloudInst);

    const wCount = 800;
    const wPositions = new Float32Array(wCount * 3);
    for (let wi = 0; wi < wCount; wi++) {
      wPositions[wi * 3] = (Math.random() - 0.5) * 60;
      wPositions[wi * 3 + 1] = Math.random() * 28;
      wPositions[wi * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const wGeo = new THREE.BufferGeometry();
    sim.weatherPosAttr = new THREE.BufferAttribute(wPositions, 3);
    wGeo.setAttribute('position', sim.weatherPosAttr);
    sim.weatherPoints = new THREE.Points(wGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.78 }));
    sim.weatherPoints.visible = false;
    sim.weatherPoints.frustumCulled = false;
    sim.scene.add(sim.weatherPoints);

    const camCfg = GAME_CONFIG.camera;
    const initVp = syncViewportCssVars(true);
    sim.camera = new THREE.PerspectiveCamera(
      camCfg.fov,
      initVp.width / initVp.height,
      camCfg.near,
      touch ? camCfg.farTouch : camCfg.farDesktop
    );
    sim.camera.position.set(-14, 16, 26);

    sim.renderer = new THREE.WebGLRenderer({
      antialias: !touch,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance'
    });
    sim.renderer.setSize(initVp.width, initVp.height, false);
    sim.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 1.75));
    sim.renderer.shadowMap.enabled = true;
    sim.renderer.shadowMap.autoUpdate = false;
    sim.renderer.shadowMap.type = THREE.PCFShadowMap;
    sim.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) {
      sim.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      sim.renderer.toneMappingExposure = CAMPUS_EXPOSURE;
    }
    container.innerHTML = '';
    container.appendChild(sim.renderer.domElement);

    sim.controls = new THREE.OrbitControls(sim.camera, sim.renderer.domElement);
    sim.controls.enableDamping = true;
    sim.controls.maxPolarAngle = Math.PI * 0.47;
    sim.controls.minDistance = 4;
    sim.controls.maxDistance = 65;
    sim.controls.target.set(0, 4.5, -14);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x3f624d, 0.51);
    sim.scene.add(hemi);
    sim.envHemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff3df, 0.88);
    sun.position.set(45, 65, 38);
    sun.castShadow = true;
    const shSize = touch ? 768 : camCfg.desktopShadowSize;
    sun.shadow.mapSize.set(shSize, shSize);
    sun.shadow.bias = -0.0005;
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.far = 220;
    sim.scene.add(sun);
    sim.scene.add(sun.target);
    sim.envSun = sun;

    const frameTimer = THREE.Timer ? new THREE.Timer() : null;
    const bootPerf = performance.now();
    sim.clock = frameTimer
      ? {
          getDelta() {
            frameTimer.update();
            return frameTimer.getDelta();
          },
          get elapsedTime() {
            return frameTimer.getElapsed();
          }
        }
      : {
          _last: bootPerf,
          getDelta() {
            const now = performance.now();
            const dt = Math.max(0, (now - this._last) * 0.001);
            this._last = now;
            return dt;
          },
          get elapsedTime() {
            return (performance.now() - bootPerf) * 0.001;
          }
        };
    createProceduralTextures();

    const wbCtx = getWorldBuilderCtx();
    buildNatureWorld(wbCtx);
    buildExpandedForestAndMushrooms(wbCtx);
    buildPlaza(wbCtx);
    buildStaircaseAndBridge(wbCtx);
    buildClockTowerAndAuditorium(wbCtx);
    buildCampusWingsAndEquipment(wbCtx);
    buildOuterCampus(wbCtx);
    buildPlazaTelescope(wbCtx);
    buildSportsScoreboard(sim.scene);
    sim.rainPuddles = createRainPuddles(sim.scene);
    sim.blobShadows = createBlobShadows(sim.scene);
    sim.cozyDetails = createCozyDetails(sim.scene, nightLampGlows);
    ensureCoreAdminPrefabs();
    restoreLocalWorldObjects(sim);
    createPastureAndCows(wbCtx);
    buildFirstPersonArm(sim.entityCtx);

    sim.localAvatar = buildCuteAvatar(sim.scene, { isLocal: true, hat_color: '#d9534f', body_color: '#4f46e5' });
    sim.localAvatar.group.visible = false;
    sim.placementGhost = createPlacementGhost(sim.scene);
    sim.hover3dBadge = createHover3dBadge(sim.scene);
    createThermoLaserFx(sim.entityCtx);
    sim.confettiMesh = initConfettiSystem(sim.scene);
    initGreenhouseParticlePools(sim.scene);
    const frozenCount = freezeStaticWorld(sim);
    logger.info('campus-init', `Cenário estático otimizado: ${frozenCount} congelados, ${sim._mergedStaticCount || 0} mesclados, ${sim._virtualLightCount || 0} luzes no pool`);
    bindControls(sim);
    const savedMode = getSavedQualityMode();
    const initialMode = savedMode || 'auto';
    const initialTier = initialMode === 'auto'
      ? getInitialQualityTier(touch, sim.renderer)
      : initialMode;
    sim.qualityMode = initialMode;
    qualityState.mode = initialMode === 'auto' ? 'auto' : 'manual';
    applyQualityTier(sim, initialTier);
    startAnimationLoop(sim);
    const lobbyEl = document.getElementById('campus-lobby');
    if ((window._pendingEnterFps || (lobbyEl && lobbyEl.classList.contains('hidden'))) && window.setCampusFpsMode) {
      window._pendingEnterFps = false;
      window.setCampusFpsMode(true);
    }
    logger.info('campus-init', 'Campus 3D inicializado com sucesso');
  });
}

export function registerCampusPublicApi() {
  bindPublicApi(sim, initCampus3D, triggerCampusRainbow);
}
