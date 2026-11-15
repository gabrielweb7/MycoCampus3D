/**
 * MycoCampus 3D — Core State, Constants & Shared Helpers
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.scene = null; E.camera = null; E.renderer = null; E.controls = null; E.clock = null;
  E.raycaster = new THREE.Raycaster();
  E.pointerNdc = new THREE.Vector2(0, 0);

  // Colisoes, pisos e objetos
  E.solidColliders = [];   // { minX, maxX, minZ, maxZ, minY, maxY }
  E.wallSegments = [];     // { x1, z1, x2, z2, halfThick, minY, maxY }
  E.walkableFloors = [];   // { minX, maxX, minZ, maxZ, topY }
  E.stairsList = [];       // { minX, maxX, zStart, zEnd, yStart, yEnd }
  E.supportSurfaces = [];  // { minX, maxX, minZ, maxZ, topY }
  E.supportMeshes = [];    // meshes de tampos/prateleiras para raycast direto em estantes multinivel
  E.pickableItems = [];    // { id, label, mesh, homePos, homeRy, radius, height, isMoved }
  E.wildMushrooms = [];    // { id, group, capMesh, active, respawnAt }

  // Portas, persianas, telao e relogio
  E.campusDoors = [];      // { pivot, open, angle, frontX, minZ, maxZ, dir, label }
  E.doorHitMeshes = [];
  E.hoveredDoorObj = null;
  E.windowBlinds = [];     // { slats, bottomRail, tapes, cordKnob, open, progress, dropH, dir }
  E.blindHitMeshes = [];
  E.hoveredBlindObj = null;
  E.auditoriumScreenMeshes = [];
  E.screenActionMeshes = []; // botoes 3D [◀, ▶, 📚] presos aos teloes
  E.auditoriumCanvas = null;
  E.auditoriumCtx = null;
  E.auditoriumTex = null;
  E.clockCanvas = null;
  E.clockCtx = null;
  E.clockTex = null;
  E.lastClockMin = -1;

  // Estado do jogador
  E.lobbyTourActive = true;
  E.tourTime = 0;
  E.inFps = false;
  E.playerPos = new THREE.Vector3(0, 0, 14.5);
  E.playerVelX = 0;
  E.playerVelZ = 0;
  E.playerVelY = 0;
  E.walkBobPhase = 0;
  E.playerYaw = 0;
  E.playerPitch = 0;
  E.onGround = true;
  E.lastGroundedAt = 0;
  E.jumpBufferUntil = 0;
  E.jumpHeld = false;
  E.mobileSprint = false;
  E.isWalking = false;
  E.keys = {};
  E.joyX = 0, E.joyY = 0;
  E.PLAYER_EYE = 1.62;
  E.PLAYER_RADIUS = 0.38;

  // Item segurado e fantasma
  E.heldItem = null;
  E.heldRotY = 0;
  E.hoveredPickable = null;
  E.hoveredMushroom = null;
  E.hoveredScreen = false;
  E.hoveredScreenBtn = null; // { action: 'prev'|'next'|'lessons', mesh }
  E.nearScreenState = false;
  E.placementGhost = null;
  E.placementValid = false;
  E.pendingMovedItems = {};
  E.recentlyDropped = {};

  // Termômetro Infravermelho Laser & Animação Seringa
  E.thermoLaserLine = null;
  E.thermoLaserDot = null;
  E.thermoCanvas = null;
  E.thermoCtx = null;
  E.thermoTex = null;
  E.thermoCurrentTemp = 24.0;
  E.thermoTargetTemp = 24.0;
  E.thermoTargetLabel = '';
  E.syringePumping = null; // { target, fromVol, toVol, duration, elapsed, startJarVol }
  E.syringePunctureProgress = 0;

  // Braco 1a pessoa, Corpo local & Lousas Interativas
  E.fpsArmGroup = null;
  E.fpsLeftArmGroup = null;
  E.fpsSleeveMat = null;
  E.snapClosePot = null;
  E.snapPetriStack = false;
  E.localAvatar = null;
  E.armSwingPhase = 0;
  E.armReach = 0;
  E.chalkboards = [];       // { id, mesh, canvas, ctx, tex }
  E.chalkboardMeshes = [];  // para raycast
  E.hoveredBoardHit = null;
  E.hoveredBoardIndex = 0;
  E.isPrimaryDown = false;
  E.lastDrawPt = null;
  E.currentStroke = null;
  E.pendingBoardStrokes = [];
  E.touchDrawingBoard = false;

  // Painel 3D do Ranking na Torre do Relogio
  E.rankingCanvas = null;
  E.rankingCtx = null;
  E.rankingTex = null;
  E.rankingList = [];
  E.rankingScroll = 0;
  E.rankingBtnMeshes = [];
  E.hoveredRankBtn = null;

  // Cinema / Projetor do Student Center
  E.cinemaScreenMesh = null;
  E.cinemaCanvas = null;
  E.cinemaCtx = null;
  E.cinemaTex = null;
  E.cinemaBeam = null;
  E.cinemaPlaying = true;
  E.cinemaPower = true;
  E.cinemaLessonIdx = -1; // -1 = menu principal com todos os modulos/aulas
  E.cinemaLessons = [];
  E.cinemaDirty = true;
  E.cinemaTime = 0;
  E.hoveredCinema = false;
  E.hoveredCinemaUv = null;
  E.seatMeshes = [];
  E.hoveredSeat = null;
  E.seatedSeat = null;
  E.lightSwitchMeshes = [];
  E.campusLightSwitches = [];
  E.hoveredSwitch = null;
  E.hoodSwitchMeshes = [];
  E.hoveredHoodSwitch = null;
  E.hoodAirData = null;
  E.stirSwitchMeshes = [];
  E.hoveredStirSwitch = null;
  E.stirrerDevices = [];
  E.hoveredSyringeTarget = null;
  E.scaleTareMeshes = [];
  E.hoveredScaleTare = null;
  E.scaleDevices = [];
  E.burnerSwitchMeshes = [];
  E.hoveredBurnerSwitch = null;
  E.burnerDevices = [];
  E.cookerPots = [];
  E.spawnGrowItems = [];
  E.sprayBursts = [];
  E.hoveredPotInsert = null;
  E.hoveredSprayTarget = null;
  E.hoodSanitizedUntil = 0;
  E.pendingStateChanges = {};
  E.recentlyChangedState = {};
  E.fountainDropsAttr = null;
  E.fountainRipples = [];
  E.terrainSnowMat = null;
  E.roofZones = []; // { minX, maxX, minZ, maxZ, roofY } para impedir chuva/neve dentro dos predios

  // Cosméticos e Emotes do Jogador Local
  E.localHat = 'default';
  E.localEmote = '';
  E.localEmoteTimer = 0;

  // Ambiente dinamico (Dia / Por do Sol / Noite + Chuva / Neve)
  E.envSun = null;
  E.envHemi = null;
  E.envClouds = [];
  E.envCloudMat = null;
  E.sunDisc = null;
  E.sunHalo = null;
  E.moonDisc = null;
  E.starPoints = null;
  E.envTime = 14;
  E.weatherPoints = null;
  E.weatherPosAttr = null;
  E.weatherMode = 'clear'; // 'clear' | 'partly' | 'overcast' | 'rain' | 'snow'
  E.lastWeatherMode = null;
  E.rainbowMesh = null;
  E.rainbowActive = false;
  E.rainbowTimer = 0;
  E.rainbowDuration = 68;
  E.snowMix = 0;
  E.snowableEntries = []; // { mat, baseColor }
  E.registerSnowable = function (mat) {
    if (mat && mat.color && !mat._snowRegistered) {
      mat._snowRegistered = true;
      E.snowableEntries.push({ mat: mat, base: mat.color.clone() });
    }
    return mat;
  }
  // Multiplayer
  E.remoteAvatars = {};

  // Texturas procedurais compartilhadas
  E.texBrick = null; E.texPaving = null; E.texWood = null; E.texWater = null;

  E.callbacks = {
    onHarvestMushroom: null,
    onOpenLessons: null,
    onScreenNav: null,
    onNearScreen: null,
    onHoldChange: null,
    onFpsChange: null,
    onHoverPrompt: null,
    onWorldAction: null
  };

  E.notifyWorldAction = function () {
    if (E.callbacks.onWorldAction) E.callbacks.onWorldAction();
  }

  E.queueWorldStateChange = function (key, val) {
    E.pendingStateChanges[key] = String(val);
    E.recentlyChangedState[key] = performance.now() + 1600;
    E.notifyWorldAction();
  }

  E.isTouchDevice = function () {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var minDim = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    var hasTouch = (navigator.maxTouchPoints || 0) > 0 && (window.innerWidth <= 1380 || minDim <= 1080);
    return coarse || hasTouch;
  }

  // ---------------- Texturas Procedurais ----------------

  E.roundRectPath = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  E.normalizeAngle = function (a) {
    a = a % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
  E._tmpHandLocal = new THREE.Vector3();
  E._tmpHandPos = new THREE.Vector3();
  E._tmpAvatarYAxis = new THREE.Vector3(0, 1, 0);
  E._tmpAvatarHandOffset = new THREE.Vector3();

  E._cSkyDay = new THREE.Color(0x60a5fa);
  E._cSkySunset = new THREE.Color(0xf97316);
  E._cSkyNight = new THREE.Color(0x0b132b);
  E._cSkyWork = new THREE.Color();
  E._cPartly = new THREE.Color(0x93c5fd);
  E._cOvercast = new THREE.Color(0x94a3b8);
  E._cRain = new THREE.Color(0x475569);
  E._cSnow = new THREE.Color(0xcbd5e1);
  E._cSunDay = new THREE.Color(0xfffbeb);
  E._cSunSet = new THREE.Color(0xfb923c);
  E._cSunNight = new THREE.Color(0x93c5fd);
  E._cCloudRain = new THREE.Color(0x64748b);
  E._cCloudOvercast = new THREE.Color(0xcbd5e1);
  E._cCloudWhite = new THREE.Color(0xffffff);
  E._cSunSunsetGlow = new THREE.Color(0xfdba74);
  E._cSnowWhite = new THREE.Color(0xf1f5f9);

  E.lastMobileHoverAt = 0;
})();