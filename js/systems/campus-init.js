/**
 * Inicializacao do Campus 3D (MycoCampus3D)
 * Cria a cena Three.js, iluminacao, construtores de mundo, entidades e inicia o game loop.
 */

import { GAME_CONFIG } from '../core/config.js';
import { logger } from '../core/logger.js';
import { createProceduralTextures } from '../engine/textures.js';
import { createRainbowMesh } from '../engine/rainbow.js';
import { buildNatureWorld, buildPlaza } from '../world/nature-plaza.js';
import { buildStaircaseAndBridge, buildClockTowerAndAuditorium } from '../world/staircase-clock.js';
import { registerPickable } from '../items/item-registry.js';
import { buildCampusWingsAndEquipment } from '../world/lab-tools.js';
import { initGreenhouseParticlePools, interactGreenhouseSlot } from '../world/greenhouse.js';
import { buildOuterCampus } from '../world/outer-campus.js';
import { initConfettiSystem } from '../entities/confetti.js';
import { buildFirstPersonArm } from '../entities/first-person-arm.js';
import { initThermoDisplay, createThermoLaserFx } from '../entities/thermo-laser.js';
import { createPlacementGhost } from '../entities/placement-ghost.js';
import { buildCuteAvatar } from '../entities/avatars.js';
import { dropHeldItem, handlePrimaryAction, updateHoverRay } from './interaction-system.js';
import { bindControls } from './input-controller.js';
import { applyQualityTier, getCinemaHitTarget, startAnimationLoop } from './game-loop.js';
import { registerCampusPublicApi as bindPublicApi } from './campus-api.js';

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
  hoveredPickable: null,
  hoveredMushroom: null,
  hoveredScreen: false,
  hoveredScreenBtn: null,
  hoveredGreenhouseSlot: null,
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
  hoveredSink: null,
  hoveredPourTarget: null,
  hoveredFillPot: null,
  hoveredGrainTarget: null,
  hoveredFlocaoTarget: null,
  hoveredScalpelTarget: null,
  hoveredBowlTarget: null,
  sportBalls: [],
  cookerPots: [],
  spawnGrowItems: [],
  sprayBursts: [],
  hoveredPotInsert: null,
  hoveredSprayTarget: null,
  hoodSanitizedUntil: 0,
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
  envTime: 14,
  weatherPoints: null,
  weatherPosAttr: null,
  weatherMode: 'clear',
  lastWeatherMode: null,
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

  isTouchDevice: function () {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const minDim = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    const hasTouch = (navigator.maxTouchPoints || 0) > 0 && (window.innerWidth <= 1380 || minDim <= 1080);
    return coarse || hasTouch;
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
    for (let i = 0; i < sim.pickableItems.length; i++) {
      if (sim.pickableItems[i].id === itemId) return sim.pickableItems[i];
    }
    return null;
  },

  isHeldByRemote: function (itemId) {
    const ids = Object.keys(sim.remoteAvatars);
    for (let i = 0; i < ids.length; i++) {
      const hId = sim.remoteAvatars[ids[i]].holding;
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
    return interactGreenhouseSlot(slot, {
      heldItem: sim.heldItem,
      callbacks: sim.callbacks,
      queueWorldStateChange: sim.queueWorldStateChange
    });
  },

  getCinemaHitTarget: function (uv) { return getCinemaHitTarget(sim, uv); },
  dropHeldItem: function () { return dropHeldItem(sim); },
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
  get solidColliders() { return sim.solidColliders; }
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
    hoodSwitchMeshes: sim.hoodSwitchMeshes,
    cookerPots: sim.cookerPots,
    burnerDevices: sim.burnerDevices,
    burnerSwitchMeshes: sim.burnerSwitchMeshes,
    labSinks: sim.labSinks,
    labSinkMeshes: sim.labSinkMeshes,
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

    const starCount = 320;
    const starPos = new Float32Array(starCount * 3);
    for (let st = 0; st < starCount; st++) {
      const sTheta = Math.random() * Math.PI * 2;
      const sPhi = Math.random() * Math.PI * 0.44;
      starPos[st * 3] = Math.cos(sTheta) * Math.cos(sPhi) * 210;
      starPos[st * 3 + 1] = Math.sin(sPhi) * 210 + 18;
      starPos[st * 3 + 2] = Math.sin(sTheta) * Math.cos(sPhi) * 210;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    sim.starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf8fafc, size: 1.4, transparent: true, opacity: 0, fog: false }));
    sim.scene.add(sim.starPoints);

    sim.envCloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, emissive: 0xe0f2fe, emissiveIntensity: 0.22 });
    for (let cl = 0; cl < 24; cl++) {
      const cg = new THREE.Group();
      const ca = (cl / 24) * Math.PI * 2;
      cg.position.set(Math.cos(ca) * (55 + (cl % 4) * 24), 30 + (cl % 5) * 4.5, Math.sin(ca) * (55 + (cl % 4) * 24));
      for (let cp = 0; cp < 3; cp++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + (cp % 2) * 2.5, 10, 8), sim.envCloudMat);
        puff.position.set((cp - 1) * 5.2, (cp % 2) * 1.4, 0);
        puff.scale.set(1.3, 0.65, 1.0);
        cg.add(puff);
      }
      sim.scene.add(cg);
      sim.envClouds.push(cg);
    }

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

    const touch = sim.isTouchDevice();
    const camCfg = GAME_CONFIG.camera;
    sim.camera = new THREE.PerspectiveCamera(
      camCfg.fov,
      window.innerWidth / window.innerHeight,
      camCfg.near,
      touch ? camCfg.farTouch : camCfg.farDesktop
    );
    sim.camera.position.set(-14, 16, 26);

    sim.renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
    sim.renderer.setSize(window.innerWidth, window.innerHeight);
    sim.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.0 : 1.5));
    sim.renderer.shadowMap.enabled = !touch;
    sim.renderer.shadowMap.type = touch ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) {
      sim.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      sim.renderer.toneMappingExposure = touch ? 1.08 : 1.02;
    }
    container.innerHTML = '';
    container.appendChild(sim.renderer.domElement);

    sim.controls = new THREE.OrbitControls(sim.camera, sim.renderer.domElement);
    sim.controls.enableDamping = true;
    sim.controls.maxPolarAngle = Math.PI * 0.47;
    sim.controls.minDistance = 4;
    sim.controls.maxDistance = 65;
    sim.controls.target.set(0, 4.5, -14);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x475569, touch ? 0.68 : 0.56);
    sim.scene.add(hemi);
    sim.envHemi = hemi;
    const sun = new THREE.DirectionalLight(0xfffbeb, touch ? 1.05 : 0.95);
    sun.position.set(45, 65, 38);
    sun.castShadow = !touch;
    const shSize = touch ? camCfg.touchShadowSize : camCfg.desktopShadowSize;
    sun.shadow.mapSize.set(shSize, shSize);
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.far = 220;
    sim.scene.add(sun);
    sim.envSun = sun;

    sim.clock = new THREE.Clock();
    createProceduralTextures();

    const wbCtx = getWorldBuilderCtx();
    buildNatureWorld(wbCtx);
    buildPlaza(wbCtx);
    buildStaircaseAndBridge(wbCtx);
    buildClockTowerAndAuditorium(wbCtx);
    buildCampusWingsAndEquipment(wbCtx);
    buildOuterCampus(wbCtx);
    buildFirstPersonArm(sim.entityCtx);

    sim.localAvatar = buildCuteAvatar(sim.scene, { isLocal: true, hat_color: '#d9534f', body_color: '#4f46e5' });
    sim.localAvatar.group.visible = false;
    sim.placementGhost = createPlacementGhost(sim.scene);
    createThermoLaserFx(sim.entityCtx);
    initConfettiSystem(sim.scene);
    initGreenhouseParticlePools(sim.scene);
    bindControls(sim);
    applyQualityTier(sim, touch ? 'medium' : 'high');
    startAnimationLoop(sim);
    logger.info('campus-init', 'Campus 3D inicializado com sucesso');
  });
}

export function registerCampusPublicApi() {
  bindPublicApi(sim, initCampus3D, triggerCampusRainbow);
}
