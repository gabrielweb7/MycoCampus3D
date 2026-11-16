/**
 * Inicializacao do Campus 3D & API Publica (MycoCampus3D)
 * Orquestra cena Three.js, iluminacao, construtores de mundo, entidades, sistemas e API window.*.
 */

import { qualityState } from '../core/quality.js';
import { createProceduralTextures } from '../engine/textures.js';
import {
  getGroundHeight,
  getItemGroundHeight,
  clampPosAgainstWalls
} from '../engine/physics.js';
import { createRainbowMesh } from '../engine/rainbow.js';
import {
  buildNatureWorld,
  buildPlaza
} from '../world/nature-plaza.js';
import {
  buildStaircaseAndBridge,
  buildClockTowerAndAuditorium,
  updateCampusAuditoriumSlide,
  setRankingList
} from '../world/staircase-clock.js';
import {
  registerPickable,
  buildCampusWingsAndEquipment
} from '../world/lab-tools.js';
import {
  greenhouseSlots,
  initGreenhouseParticlePools,
  updateGreenhouseSlotMesh,
  interactGreenhouseSlot
} from '../world/greenhouse.js';
import { buildOuterCampus } from '../world/outer-campus.js';
import {
  initConfettiSystem,
  triggerConfettiBurst
} from '../entities/confetti.js';
import { buildFirstPersonArm } from '../entities/first-person-arm.js';
import {
  initThermoDisplay,
  createThermoLaserFx
} from '../entities/thermo-laser.js';
import { createPlacementGhost } from '../entities/placement-ghost.js';
import {
  buildAvatarHat,
  buildCuteAvatar,
  updateCampusPlayers
} from '../entities/avatars.js';
import {
  applyStrokeToBoard,
  getHeldBoardToolColor
} from './chalkboard.js';
import {
  setHeldTwoHandedGhost,
  dropHeldItem,
  handlePrimaryAction,
  updateHoverRay
} from './interaction-system.js';
import { bindControls } from './input-controller.js';
import {
  applyQualityTier,
  getCinemaHitTarget,
  startAnimationLoop
} from './game-loop.js';

const THREE = window.THREE;

const qualityTiersOrder = ['high', 'medium', 'low', 'min'];

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
  PLAYER_EYE: 1.62,
  PLAYER_RADIUS: 0.38,

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

  // Ranking 3D
  rankingBtnMeshes: [],
  hoveredRankBtn: null,

  // Cinema
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
        if (item && item.potItem && item.isAttached && item.potItem.id === hId) {
          return true;
        }
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
      if (cp.contents.indexOf(item) !== -1 && cp.lidItem && cp.lidItem.isAttached) {
        return cp;
      }
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

  getCinemaHitTarget: function (uv) {
    return getCinemaHitTarget(sim, uv);
  },

  dropHeldItem: function () {
    return dropHeldItem(sim);
  },

  handlePrimaryAction: function () {
    return handlePrimaryAction(sim);
  },

  updateHoverRay: function (customNdc) {
    return updateHoverRay(sim, customNdc);
  }
};

// Contextos pré-alocados (zero GC) compartilhados entre módulos
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
  sim.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, touch ? 210 : 440);
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
  const shSize = touch ? 768 : 1536;
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
}

// Registro de API publica global (compatibilidade com UI/HTML/Console)
export function registerCampusPublicApi() {
  window.initCampus3D = initCampus3D;

  window.setCampusFpsMode = function (enable) {
    sim.lobbyTourActive = false;
    sim.inFps = !!enable;
    sim.controls.enabled = !sim.inFps;
    if (!sim.inFps && document.pointerLockElement) document.exitPointerLock();
    if (sim.inFps) {
      sim.camera.up.set(0, 1, 0);
      sim.camera.rotation.order = 'YXZ';
      sim.camera.rotation.z = 0;
      sim.playerPos.y = getGroundHeight(sim.physCtx, sim.playerPos.x, sim.playerPos.z, sim.playerPos.y);
    } else if (sim.fpsArmGroup) {
      sim.fpsArmGroup.visible = false;
    }
    if (sim.callbacks.onFpsChange) sim.callbacks.onFpsChange(sim.inFps);
  };

  window.triggerCampusJump = function () {
    if (!sim.inFps) return;
    if (sim.seatedSeat) {
      sim.seatedSeat = null;
      sim.playerVelY = 6.2;
      sim.onGround = false;
      return;
    }
    const now = performance.now();
    sim.jumpBufferUntil = now + 150;
    if (sim.onGround || (now - sim.lastGroundedAt < 150 && sim.playerVelY <= 0)) {
      sim.playerVelY = 6.2;
      sim.onGround = false;
      sim.lastGroundedAt = 0;
      sim.jumpBufferUntil = 0;
    }
  };

  window.setCampusJumpHeld = function (held) {
    sim.jumpHeld = !!held;
    if (sim.jumpHeld) window.triggerCampusJump();
  };

  window.setCampusSprint = function (active) {
    sim.mobileSprint = !!active;
  };

  window.clearCampusKeys = function () {
    Object.keys(sim.keys).forEach(function (k) { sim.keys[k] = false; });
    sim.isPrimaryDown = false;
    sim.jumpHeld = false;
    sim.flushCurrentStroke();
  };

  window.rotateCampusHeldItem = function (deltaRad) {
    if (sim.heldItem) sim.heldRotY += (typeof deltaRad === 'number' ? deltaRad : Math.PI / 4);
  };

  window.setCampusJoystick = function (dx, dy) {
    sim.joyX = dx;
    sim.joyY = dy;
  };

  window.getCampusPlayerPose = function () {
    const gY = getGroundHeight(sim.physCtx, sim.playerPos.x, sim.playerPos.z, sim.playerPos.y);
    const inAir = sim.playerPos.y > gY + 0.18;
    return {
      x: sim.playerPos.x, y: sim.playerPos.y, z: sim.playerPos.z,
      vx: Math.round(sim.playerVelX * 100) / 100,
      vz: Math.round(sim.playerVelZ * 100) / 100,
      yaw: sim.playerYaw, pitch: sim.playerPitch,
      holding_item: sim.heldItem ? sim.heldItem.id : '',
      walking: sim.isWalking, seated: !!sim.seatedSeat, in_fps: sim.inFps,
      toy_mode: (sim.paragliderActive && inAir) ? 'paraglider' : (sim.snowboardActive ? 'snowboard' : ''),
      current_hat: sim.localHat,
      emote: sim.localEmote
    };
  };

  window.setCampusQualityMode = function (mode) {
    if (mode === 'auto' || qualityTiersOrder.indexOf(mode) !== -1) {
      sim.qualityMode = mode;
      if (mode === 'auto') {
        applyQualityTier(sim, sim.isTouchDevice() ? 'medium' : 'high');
      } else {
        applyQualityTier(sim, mode);
      }
    }
  };

  window.getCampusQualityState = function () {
    return { mode: sim.qualityMode, tier: sim.qualityTier, fps: qualityState.currentFps };
  };

  window.playCampusEmote = function (name) {
    sim.localEmote = name || '';
    sim.localEmoteTimer = 4.5;
    if (window.MycoAudio) window.MycoAudio.playEmote(name);
    if (name === 'cheer') {
      triggerConfettiBurst(sim.playerPos.x, sim.playerPos.y, sim.playerPos.z);
    }
  };

  window.setCampusSnowboard = function (active) {
    sim.snowboardActive = !!active;
    if (!sim.snowboardActive && sim.snowboardGroup) sim.snowboardGroup.visible = false;
  };

  window.isCampusSnowboardActive = function () {
    return sim.snowboardActive;
  };

  window.setCampusParaglider = function (active) {
    sim.paragliderActive = !!active;
    if (!sim.paragliderActive && sim.paragliderGroup) sim.paragliderGroup.visible = false;
  };

  window.isCampusParagliderActive = function () {
    return sim.paragliderActive;
  };

  window.setLocalAvatarHat = function (hatId) {
    sim.localHat = hatId || 'default';
    if (sim.localAvatar && sim.localAvatar.hatGroup) {
      buildAvatarHat(sim.localHat, sim.localAvatar.hatMat, sim.localAvatar.hatGroup);
      sim.localAvatar.current_hat = sim.localHat;
    }
  };

  window.consumeCampusMovedItems = function () {
    const list = Object.values(sim.pendingMovedItems);
    sim.pendingMovedItems = {};
    return list;
  };

  window.requeueCampusMovedItems = function (list) {
    (list || []).forEach(function (it) {
      if (it && it.id && !sim.pendingMovedItems[it.id]) sim.pendingMovedItems[it.id] = it;
    });
  };

  window.applyCampusWorldObjects = function (objectsMap) {
    if (!objectsMap) return;
    const now = performance.now();
    sim.pickableItems.forEach(function (item) {
      if (!item.mesh.userData.updateBounds) return;
      if (sim.heldItem === item || sim.isHeldByRemote(item.id)) return;
      if (sim.pendingMovedItems[item.id]) return;
      if (sim.recentlyDropped[item.id] > now) {
        const svCheck = objectsMap[item.id];
        if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
          delete sim.recentlyDropped[item.id];
        } else if (sim.recentlyDropped[item.id] - now < 13500) {
          sim.pendingMovedItems[item.id] = {
            id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
          };
        }
        return;
      }
      const saved = objectsMap[item.id];
      if (saved) {
        let finalY = saved.y;
        if (!item.mesh.userData.isTable && !item.mesh.userData.isHood) {
          let suppY = getItemGroundHeight(sim.physCtx, saved.x, saved.z, saved.y, item.mesh.userData.dynamicSurface, saved.y + 0.18);
          for (let si = 0; si < sim.supportSurfaces.length; si++) {
            const s = sim.supportSurfaces[si];
            if (s === item.mesh.userData.dynamicSurface) continue;
            if (saved.x >= s.minX - 0.09 && saved.x <= s.maxX + 0.09 && saved.z >= s.minZ - 0.09 && saved.z <= s.maxZ + 0.09 && saved.y >= s.topY - 0.18) {
              suppY = Math.max(suppY, s.topY);
            }
          }
          if (Math.abs(saved.y - suppY) > 0.04) {
            finalY = suppY;
            sim.pendingMovedItems[item.id] = {
              id: item.id, x: saved.x, y: finalY, z: saved.z, ry: saved.ry || 0
            };
          } else {
            finalY = suppY;
          }
        }
        item.mesh.position.set(saved.x, finalY, saved.z);
        item.mesh.rotation.y = saved.ry || 0;
        item.isMoved = true;
        item.mesh.userData.updateBounds(item);
      } else if (item.isMoved) {
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        item.mesh.userData.updateBounds(item);
        item.isMoved = false;
      }
    });

    sim.pickableItems.forEach(function (item) {
      if (item.mesh.userData.updateBounds) return;
      if (sim.heldItem === item || sim.isHeldByRemote(item.id)) return;
      if (sim.pendingMovedItems[item.id]) return;
      if (sim.recentlyDropped[item.id] > now) {
        const svCheck = objectsMap[item.id];
        if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
          delete sim.recentlyDropped[item.id];
        } else if (sim.recentlyDropped[item.id] - now < 13500) {
          sim.pendingMovedItems[item.id] = {
            id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
          };
        }
        return;
      }
      if (item.potItem && item.isAttached) {
        const pRef = item.potItem;
        if (sim.heldItem === pRef || sim.isHeldByRemote(pRef.id) || sim.pendingMovedItems[pRef.id] || sim.recentlyDropped[pRef.id] > now) {
          return;
        }
      }
      const saved = objectsMap[item.id];
      if (saved) {
        if (item.potItem) {
          const pot = item.potItem;
          const potSaved = objectsMap[pot.id];
          const refX = potSaved ? potSaved.x : pot.mesh.position.x;
          const refY = potSaved ? potSaved.y : pot.mesh.position.y;
          const refZ = potSaved ? potSaved.z : pot.mesh.position.z;
          const attached = Math.hypot(saved.x - refX, saved.z - refZ) < 0.28 &&
            Math.abs(saved.y - (refY + 0.36)) < 0.28;
          item.isAttached = attached;
          if (attached) {
            item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
            item.mesh.rotation.copy(pot.mesh.rotation);
            item.isMoved = true;
            return;
          }
        }
        let suppY = getItemGroundHeight(sim.physCtx, saved.x, saved.z, saved.y, item.mesh.userData.dynamicSurface, saved.y + 0.18);
        for (let i = 0; i < sim.supportSurfaces.length; i++) {
          const s = sim.supportSurfaces[i];
          if (saved.x >= s.minX - 0.09 && saved.x <= s.maxX + 0.09 && saved.z >= s.minZ - 0.09 && saved.z <= s.maxZ + 0.09 && saved.y >= s.topY - 0.18) {
            suppY = Math.max(suppY, s.topY);
          }
        }
        let finalY = saved.y;
        if (saved.y < suppY - 0.04 || (!item.mesh.userData.isPetri && saved.y > suppY + 0.08) || Math.abs(saved.y - suppY) < 0.06) {
          finalY = suppY;
          if (Math.abs(saved.y - suppY) > 0.04) {
            sim.pendingMovedItems[item.id] = {
              id: item.id, x: saved.x, y: finalY, z: saved.z, ry: saved.ry || 0
            };
          }
        }
        item.mesh.position.set(saved.x, finalY, saved.z);
        item.mesh.rotation.y = saved.ry || 0;
        item.isMoved = true;
      } else if (item.isMoved) {
        sim.removeFromCookerContents(item);
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        if (item.potItem) item.isAttached = true;
        item.isMoved = false;
      }
    });
  };

  window.resetCampusWorldObjects = function () {
    setHeldTwoHandedGhost(sim.heldItem, false);
    sim.heldItem = null;
    sim.pendingMovedItems = {};
    sim.recentlyDropped = {};
    for (let cpi = 0; cpi < sim.cookerPots.length; cpi++) {
      const cp = sim.cookerPots[cpi];
      cp.contents = [];
      cp.psi = 0;
      cp.temp = 25;
      cp.progress = 0;
      cp.sterilized = false;
      cp.overheatTimer = 0;
      cp.burned = false;
      if (cp.steamPoints) cp.steamPoints.visible = false;
      if (cp.statusSprite) cp.statusSprite.visible = false;
      cp.lastHudKey = '';
      if (cp.weight) { cp.weight.position.y = 0.13; cp.weight.rotation.set(0, 0, 0); }
      if (cp.weightTop) { cp.weightTop.position.y = 0.16; cp.weightTop.rotation.set(0, 0, 0); }
      if (cp.safetyPins) {
        for (let pni = 0; pni < cp.safetyPins.length; pni++) cp.safetyPins[pni].position.y = 0.110;
      }
    }
    sim.pickableItems.forEach(function (item) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.potItem) item.isAttached = true;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      item.isMoved = false;
    });
    if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
  };

  window.resetCampusLocalSession = function () {
    sim.syringePumping = null;
    sim.syringePunctureProgress = 0;
    setHeldTwoHandedGhost(sim.heldItem, false);
    sim.heldItem = null;
    sim.thermoLaserOn = false;
    sim.seatedSeat = null;
    sim.pendingMovedItems = {};
    sim.pendingBoardStrokes = [];
    sim.pendingStateChanges = {};
    sim.recentlyDropped = {};
    if (sim.placementGhost) sim.placementGhost.visible = false;
    if (sim.thermoLaserLine) sim.thermoLaserLine.visible = false;
    if (sim.thermoLaserDot) sim.thermoLaserDot.visible = false;
    sim.playerVelX = 0;
    sim.playerVelY = 0;
    sim.playerVelZ = 0;
    sim.playerPos.set(0, 0, 10.5);
    sim.playerYaw = 0;
    sim.playerPitch = 0;
    if (window.clearCampusKeys) window.clearCampusKeys();
    if (window.MycoAudio) window.MycoAudio.setSteam(false, 0);
    if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
  };

  window.consumeCampusBoardStrokes = function () {
    if (sim.currentStroke && sim.currentStroke.pts.length >= 2) {
      const lastPt = sim.currentStroke.pts[sim.currentStroke.pts.length - 1];
      sim.pendingBoardStrokes.push({
        b: sim.currentStroke.b,
        c: sim.currentStroke.c,
        pts: sim.currentStroke.pts.slice()
      });
      sim.currentStroke.pts = [lastPt];
    }
    const out = sim.pendingBoardStrokes.slice();
    sim.pendingBoardStrokes = [];
    return out;
  };

  window.requeueCampusBoardStrokes = function (strokes) {
    if (!Array.isArray(strokes) || !strokes.length) return;
    sim.pendingBoardStrokes = strokes.concat(sim.pendingBoardStrokes);
  };

  window.applyCampusBoardStrokes = function (strokes) {
    (strokes || []).forEach(function (st) {
      applyStrokeToBoard(sim.chalkboards, st);
    });
  };

  window.consumeCampusStateChanges = function () {
    const out = Object.assign({}, sim.pendingStateChanges);
    sim.pendingStateChanges = {};
    return out;
  };

  window.requeueCampusStateChanges = function (changes) {
    if (!changes || typeof changes !== 'object') return;
    Object.keys(changes).forEach(function (k) {
      if (sim.pendingStateChanges[k] === undefined) {
        sim.pendingStateChanges[k] = changes[k];
      }
    });
  };

  window.applyCampusWorldState = function (stateMap, isInitial) {
    if (!stateMap || typeof stateMap !== 'object') return;
    const now = performance.now();

    for (let di = 0; di < sim.campusDoors.length; di++) {
      const d = sim.campusDoors[di];
      if (!d.id || stateMap[d.id] === undefined) continue;
      if (sim.pendingStateChanges[d.id] !== undefined || sim.recentlyChangedState[d.id] > now) continue;
      const wantOpen = Number(stateMap[d.id]) === 1;
      if (d.open !== wantOpen) {
        d.open = wantOpen;
        if (isInitial) {
          d.angle = d.open ? -d.dir * Math.PI * 0.48 : 0;
          d.pivot.rotation.y = d.angle;
        }
      }
    }

    for (let bi = 0; bi < sim.windowBlinds.length; bi++) {
      const b = sim.windowBlinds[bi];
      if (!b.id || stateMap[b.id] === undefined) continue;
      if (sim.pendingStateChanges[b.id] !== undefined || sim.recentlyChangedState[b.id] > now) continue;
      const wantBlindOpen = Number(stateMap[b.id]) === 1;
      if (b.open !== wantBlindOpen) {
        b.open = wantBlindOpen;
      }
    }

    for (let li = 0; li < sim.campusLightSwitches.length; li++) {
      const sw = sim.campusLightSwitches[li];
      if (!sw.id || stateMap[sw.id] === undefined) continue;
      if (sim.pendingStateChanges[sw.id] !== undefined || sim.recentlyChangedState[sw.id] > now) continue;
      const wantLightOn = Number(stateMap[sw.id]) !== 0;
      if (sw.on !== wantLightOn) {
        sw.on = wantLightOn;
        if (sw.light) {
          sw.light.visible = sw.on;
          sw.light.intensity = sw.on ? 1.35 : 0;
        }
        if (sw.gLight) {
          sw.gLight.visible = sw.on;
          sw.gLight.intensity = sw.on ? 0.65 : 0;
        }
        if (sw.tubeMat) {
          sw.tubeMat.emissive.setHex(sw.on ? 0xfffbeb : 0x1e293b);
          sw.tubeMat.emissiveIntensity = sw.on ? 0.85 : 0.02;
        }
        if (sw.ledMat) {
          sw.ledMat.color.setHex(sw.on ? 0x22c55e : 0xef4444);
        }
        if (sw.rocker) {
          sw.rocker.rotation.x = sw.on ? -0.22 : 0.22;
        }
      }
    }

    if (sim.hoodAirData && stateMap.hood_lab !== undefined) {
      if (sim.pendingStateChanges.hood_lab === undefined && !(sim.recentlyChangedState.hood_lab > now)) {
        const wantHoodOn = Number(stateMap.hood_lab) !== 0;
        if (sim.hoodAirData.on !== wantHoodOn) {
          sim.hoodAirData.on = wantHoodOn;
          sim.hoodAirData.points.visible = sim.hoodAirData.on;
          sim.hoodAirData.hepaMat.emissiveIntensity = sim.hoodAirData.on ? 0.45 : 0.04;
          sim.hoodAirData.ledMat.color.setHex(sim.hoodAirData.on ? 0x22c55e : 0xef4444);
          if (sim.hoodAirData.workLight) {
            sim.hoodAirData.workLight.visible = sim.hoodAirData.on;
            sim.hoodAirData.workLight.intensity = sim.hoodAirData.on ? 0.95 : 0;
          }
        }
      }
    }

    if (sim.stirrerDevices.length && stateMap.stir_lab !== undefined) {
      if (sim.pendingStateChanges.stir_lab === undefined && !(sim.recentlyChangedState.stir_lab > now)) {
        const wantStirOn = Number(stateMap.stir_lab) === 1;
        const st0 = sim.stirrerDevices[0];
        if (st0.on !== wantStirOn) {
          st0.on = wantStirOn;
          st0.ledMat.color.setHex(st0.on ? 0x22c55e : 0xef4444);
        }
      }
    }

    if (sim.burnerDevices.length && stateMap.burner_lab !== undefined) {
      if (sim.pendingStateChanges.burner_lab === undefined && !(sim.recentlyChangedState.burner_lab > now)) {
        const wantBurnerOn = Number(stateMap.burner_lab) === 1;
        const bn0 = sim.burnerDevices[0];
        if (bn0.on !== wantBurnerOn) {
          bn0.on = wantBurnerOn;
          bn0.ledMat.color.setHex(bn0.on ? 0x22c55e : 0xef4444);
          if (bn0.knobGroup) bn0.knobGroup.rotation.z = bn0.on ? -1.45 : 0;
        }
      }
    }

    let cinemaChanged = false;
    if (stateMap.cinema_power !== undefined && sim.pendingStateChanges.cinema_power === undefined && !(sim.recentlyChangedState.cinema_power > now)) {
      const wantPower = Number(stateMap.cinema_power) === 1;
      if (sim.cinemaPower !== wantPower) {
        sim.cinemaPower = wantPower;
        cinemaChanged = true;
      }
    }
    if (stateMap.cinema_lesson !== undefined && sim.pendingStateChanges.cinema_lesson === undefined && !(sim.recentlyChangedState.cinema_lesson > now)) {
      const wantLes = parseInt(stateMap.cinema_lesson, 10);
      if (!isNaN(wantLes) && sim.cinemaLessonIdx !== wantLes) {
        sim.cinemaLessonIdx = wantLes;
        sim.cinemaTime = 0;
        cinemaChanged = true;
      }
    }
    if (stateMap.cinema_playing !== undefined && sim.pendingStateChanges.cinema_playing === undefined && !(sim.recentlyChangedState.cinema_playing > now)) {
      const wantPlay = Number(stateMap.cinema_playing) === 1;
      if (sim.cinemaPlaying !== wantPlay) {
        sim.cinemaPlaying = wantPlay;
        cinemaChanged = true;
      }
    }
    if (cinemaChanged) {
      sim.cinemaDirty = true;
      if (sim.cinemaBeam) sim.cinemaBeam.visible = sim.cinemaPower && (sim.cinemaLessonIdx === -1 || sim.cinemaPlaying);
    }

    for (let mi = 0; mi < sim.wildMushrooms.length; mi++) {
      const wm = sim.wildMushrooms[mi];
      if (!wm.id || stateMap[wm.id] === undefined) continue;
      if (sim.pendingStateChanges[wm.id] !== undefined || sim.recentlyChangedState[wm.id] > now) continue;
      const isAvailable = Number(stateMap[wm.id]) === 1;
      if (isAvailable && !wm.active) {
        wm.active = true;
        wm.group.visible = true;
        wm.respawnAt = 0;
      } else if (!isAvailable && wm.active) {
        wm.active = false;
        wm.group.visible = false;
        wm.respawnAt = now + 20000;
      }
    }

    for (let gi = 0; gi < greenhouseSlots.length; gi++) {
      const slot = greenhouseSlots[gi];
      const kStage = 'greenhouse_slot_' + slot.id + '_stage';
      const kHum = 'greenhouse_slot_' + slot.id + '_humidity';
      if (stateMap[kStage] !== undefined && sim.pendingStateChanges[kStage] === undefined && !(sim.recentlyChangedState[kStage] > now)) {
        const newStage = parseInt(stateMap[kStage], 10);
        if (slot.stage !== newStage) {
          slot.stage = newStage;
          updateGreenhouseSlotMesh(slot);
        }
      }
      if (stateMap[kHum] !== undefined && sim.pendingStateChanges[kHum] === undefined && !(sim.recentlyChangedState[kHum] > now)) {
        const newHum = parseFloat(stateMap[kHum]);
        if (Math.abs(slot.humidity - newHum) > 5) {
          slot.humidity = newHum;
          updateGreenhouseSlotMesh(slot);
        }
      }
    }
  };

  window.applyCampusSavedPose = function (pose) {
    if (!pose || typeof pose !== 'object') return;
    if (typeof pose.x === 'number' && typeof pose.z === 'number') {
      sim.playerPos.set(pose.x, typeof pose.y === 'number' ? pose.y : 0, pose.z);
    }
    if (typeof pose.yaw === 'number') sim.playerYaw = pose.yaw;
    if (typeof pose.pitch === 'number') sim.playerPitch = pose.pitch;
    if (pose.seated) {
      let bestSeat = null, bestD = 1.6;
      for (let i = 0; i < sim.seatMeshes.length; i++) {
        const si = sim.seatMeshes[i].userData.seatInfo;
        if (!si) continue;
        const d = Math.hypot(si.x - sim.playerPos.x, si.z - sim.playerPos.z);
        if (d < bestD && Math.abs(si.y - sim.playerPos.y) < 1.0) {
          bestD = d;
          bestSeat = si;
        }
      }
      if (bestSeat) {
        sim.seatedSeat = bestSeat;
        sim.playerPos.set(bestSeat.x, bestSeat.y, bestSeat.z);
      }
    }
    if (pose.holding && !sim.heldItem) {
      const item = sim.findPickable(pose.holding);
      if (item && !sim.isHeldByRemote(item.id)) {
        sim.removeFromCookerContents(item);
        if (item.potItem && item.isAttached) {
          item.isAttached = false;
        }
        sim.heldItem = item;
        sim.heldRotY = item.mesh.rotation.y;
        setHeldTwoHandedGhost(sim.heldItem, true);
        if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(sim.heldItem.label);
      }
    }
  };

  window.setCampusPlayerColors = function (hatHex, bodyHex) {
    if (sim.fpsSleeveMat && bodyHex) {
      sim.fpsSleeveMat.color.set(bodyHex);
    }
    if (sim.localAvatar) {
      if (hatHex && sim.localAvatar.hatMat) sim.localAvatar.hatMat.color.set(hatHex);
      if (bodyHex && sim.localAvatar.bodyMat) sim.localAvatar.bodyMat.color.set(bodyHex);
    }
  };

  window.rotateCampusCamera = function (dx, dy) {
    if (sim.lobbyTourActive) return;
    if (sim.inFps) {
      sim.playerYaw -= dx * 0.0080;
      sim.playerPitch = Math.max(-1.35, Math.min(1.35, sim.playerPitch - dy * 0.0080));
    }
  };

  window.setCampusMobilePrimary = function (down) {
    if (sim.lobbyTourActive) return;
    sim.isPrimaryDown = !!down;
    if (down) {
      if (!sim.heldItem) {
        sim.pointerNdc.set(0, 0);
      }
      sim.updateHoverRay();
      sim.handlePrimaryAction();
    } else {
      sim.flushCurrentStroke();
    }
  };

  window.updateCampusRanking = function (list) {
    setRankingList(list);
  };

  window.setCampusCinemaLessons = function (list) {
    sim.cinemaLessons = Array.isArray(list) ? list : [];
    sim.cinemaDirty = true;
  };

  window.teleportCampusPlayer = function (x, y, z, yaw) {
    if (typeof x !== 'number' || typeof z !== 'number') return;
    if (sim.seatedSeat) sim.seatedSeat = null;
    sim.syringePumping = null;
    sim.playerVelY = 0;
    const targetY = (typeof y === 'number' && !isNaN(y)) ? y : getGroundHeight(sim.physCtx, x, z, sim.playerPos.y);
    sim.playerPos.set(x, targetY, z);
    if (typeof yaw === 'number' && !isNaN(yaw)) {
      sim.playerYaw = yaw;
      if (sim.controls && sim.controls.target) sim.controls.target.set(x, targetY + 1.2, z);
    }
    clampPosAgainstWalls(sim.physCtx, sim.playerPos, 0.35);
    if (window.MycoAudio) window.MycoAudio.playSwitch();
  };

  window.getCampusPlayerPos = function () {
    return { x: sim.playerPos.x, y: sim.playerPos.y, z: sim.playerPos.z, yaw: sim.playerYaw };
  };

  window.updateCampusPlayers = function (players) {
    return updateCampusPlayers({
      scene: sim.scene,
      remoteAvatars: sim.remoteAvatars,
      heldItem: sim.heldItem,
      onDropStolenHeld: function () {
        setHeldTwoHandedGhost(sim.heldItem, false);
        sim.heldItem = null;
        if (sim.placementGhost) sim.placementGhost.visible = false;
        if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
      }
    }, players);
  };

  window.updateCampusAuditoriumSlide = updateCampusAuditoriumSlide;
  window.triggerCampusRainbow = triggerCampusRainbow;
  window.dropCampusHeldItem = sim.dropHeldItem;

  // Namespace unificado MycoCampus para arquitetura limpa e escalabilidade
  window.MycoCampus = window.MycoCampus || {};
  window.MycoCampus.teleportPlayer = window.teleportCampusPlayer;
  window.MycoCampus.getPlayerPos = window.getCampusPlayerPos;
  window.MycoCampus.updateRanking = window.updateCampusRanking;
  window.MycoCampus.updateSlide = updateCampusAuditoriumSlide;
  window.MycoCampus.updatePlayers = window.updateCampusPlayers;
  window.MycoCampus.setColors = window.setCampusPlayerColors;
  window.MycoCampus.setFpsMode = window.setCampusFpsMode;
  window.MycoCampus.triggerRainbow = triggerCampusRainbow;
  window.MycoCampus.dropHeldItem = sim.dropHeldItem;
}
