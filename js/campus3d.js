/**
 * MycoCampus3D — Motor 3D Arquitetônico (Three.js r128)
 * Universidade Geométrica: Praça em Bloquetes, Fonte do Cogumelo, Prédios de 2 Andares (Tijolo + Vidro),
 * Escadaria Monumental, Passarela Elevada, Torre do Relógio, Lab, Substratos, Estufa e Floresta.
 */
(function () {
  'use strict';

  var scene, camera, renderer, controls, clock;
  var raycaster = new THREE.Raycaster();
  var pointerNdc = new THREE.Vector2(0, 0);

  // Colisoes, pisos e objetos
  var solidColliders = [];   // { minX, maxX, minZ, maxZ, minY, maxY }
  var wallSegments = [];     // { x1, z1, x2, z2, halfThick, minY, maxY }
  var walkableFloors = [];   // { minX, maxX, minZ, maxZ, topY }
  var stairsList = [];       // { minX, maxX, zStart, zEnd, yStart, yEnd }
  var supportSurfaces = [];  // { minX, maxX, minZ, maxZ, topY }
  var supportMeshes = [];    // meshes de tampos/prateleiras para raycast direto em estantes multinivel
  var pickableItems = [];    // { id, label, mesh, homePos, homeRy, radius, height, isMoved }
  var wildMushrooms = [];    // { id, group, capMesh, active, respawnAt }

  // Portas, persianas, telao e relogio
  var campusDoors = [];      // { pivot, open, angle, frontX, minZ, maxZ, dir, label }
  var doorHitMeshes = [];
  var hoveredDoorObj = null;
  var windowBlinds = [];     // { slats, bottomRail, tapes, cordKnob, open, progress, dropH, dir }
  var blindHitMeshes = [];
  var hoveredBlindObj = null;
  var lastCinemaHoverType = '';
  var lastCinemaHoverIdx = -1;
  var clockCanvas = null;
  var clockCtx = null;
  var clockTex = null;
  var lastClockMin = -1;

  // Estado do jogador
  var lobbyTourActive = true;
  var tourTime = 0;
  var inFps = false;
  var playerPos = new THREE.Vector3(0, 0, 14.5);
  var playerVelX = 0;
  var playerVelZ = 0;
  var playerVelY = 0;
  var walkBobPhase = 0;
  var playerYaw = 0;
  var playerPitch = 0;
  var onGround = true;
  var lastGroundedAt = 0;
  var jumpBufferUntil = 0;
  var jumpHeld = false;
  var mobileSprint = false;
  var isWalking = false;
  var keys = {};
  var joyX = 0, joyY = 0;
  var PLAYER_EYE = 1.62;
  var PLAYER_RADIUS = 0.38;

  // Item segurado e fantasma
  var heldItem = null;
  var heldRotY = 0;
  var hoveredPickable = null;
  var hoveredMushroom = null;
  var hoveredScreen = false;
  var hoveredScreenBtn = null; // { action: 'prev'|'next'|'lessons', mesh }
  var nearScreenState = false;
  var placementGhost = null;
  var placementValid = false;
  var pendingMovedItems = {};
  var recentlyDropped = {};

  // Termômetro Infravermelho Laser & Animação Seringa
  var thermoLaserLine = null;
  var thermoLaserDot = null;
  var thermoCanvas = null;
  var thermoCtx = null;
  var thermoTex = null;
  var thermoCurrentTemp = 24.0;
  var thermoTargetTemp = 24.0;
  var thermoTargetLabel = '';
  var thermoLaserOn = false;
  var syringePumping = null; // { target, fromVol, toVol, duration, elapsed, startJarVol }
  var syringePunctureProgress = 0;

  // Braco 1a pessoa, Corpo local & Lousas Interativas
  var fpsArmGroup = null;
  var fpsLeftArmGroup = null;
  var fpsSleeveMat = null;
  var snowboardActive = false;
  var snowboardGroup = null;
  var snowboardRoll = 0;
  var snowboardPitch = 0;
  var paragliderActive = false;
  var paragliderGroup = null;
  var paragliderRoll = 0;
  var thermalColumns = [];
  var snapClosePot = null;
  var snapPetriStack = false;
  var localAvatar = null;
  var armSwingPhase = 0;
  var armReach = 0;
  var chalkboards = [];       // { id, mesh, canvas, ctx, tex }
  var chalkboardMeshes = [];  // para raycast
  var hoveredBoardHit = null;
  var hoveredBoardIndex = 0;
  var isPrimaryDown = false;
  var lastDrawPt = null;
  var currentStroke = null;
  var pendingBoardStrokes = [];
  var touchDrawingBoard = false;
  window.touchDrawingBoard = false;

  // Painel 3D do Ranking na Torre do Relogio
  var rankingCanvas = null;
  var rankingCtx = null;
  var rankingTex = null;
  var rankingList = [];
  var rankingScroll = 0;
  var rankingBtnMeshes = [];
  var hoveredRankBtn = null;

  // Cinema / Projetor do Student Center
  var cinemaScreenMesh = null;
  var cinemaCanvas = null;
  var cinemaCtx = null;
  var cinemaTex = null;
  var cinemaBeam = null;
  var cinemaPlaying = true;
  var cinemaPower = true;
  var cinemaLessonIdx = -1; // -1 = menu principal com todos os modulos/aulas
  var cinemaLessons = [];
  var cinemaDirty = true;
  var cinemaTime = 0;
  var hoveredCinema = false;
  var hoveredCinemaUv = null;
  var seatMeshes = [];
  var hoveredSeat = null;
  var seatedSeat = null;
  var lightSwitchMeshes = [];
  var campusLightSwitches = [];
  var hoveredSwitch = null;
  var hoodSwitchMeshes = [];
  var hoveredHoodSwitch = null;
  var hoodAirData = null;
  var stirSwitchMeshes = [];
  var hoveredStirSwitch = null;
  var stirrerDevices = [];
  var hoveredSyringeTarget = null;
  var lastSyringeTargetItem = null;
  var _tmpSyrPort = new THREE.Vector3();
  var _tmpSyrHand = new THREE.Vector3();
  var _tmpSyrOff = new THREE.Vector3();
  var scaleTareMeshes = [];
  var hoveredScaleTare = null;
  var scaleDevices = [];
  var burnerSwitchMeshes = [];
  var hoveredBurnerSwitch = null;
  var burnerDevices = [];
  var sportBalls = [];
  var cookerPots = [];
  var spawnGrowItems = [];
  var sprayBursts = [];
  var hoveredPotInsert = null;
  var hoveredSprayTarget = null;
  var hoodSanitizedUntil = 0;
  var pendingStateChanges = {};
  var recentlyChangedState = {};
  var fountainDropsAttr = null;
  var fountainRipples = [];
  var terrainSnowMat = null;
  var roofZones = []; // { minX, maxX, minZ, maxZ, roofY } para impedir chuva/neve dentro dos predios

  // Cosméticos e Emotes do Jogador Local
  var localHat = 'default';
  var localEmote = '';
  var localEmoteTimer = 0;

  // Ambiente dinamico (Dia / Por do Sol / Noite + Chuva / Neve)
  var envSun = null;
  var envHemi = null;
  var envClouds = [];
  var envCloudMat = null;
  var sunDisc = null;
  var sunHalo = null;
  var moonDisc = null;
  var starPoints = null;
  var envTime = 14;
  var weatherPoints = null;
  var weatherPosAttr = null;
  var weatherMode = 'clear'; // 'clear' | 'partly' | 'overcast' | 'rain' | 'snow'
  var lastWeatherMode = null;
  var rainbowMesh = null;
  var rainbowActive = false;
  var rainbowTimer = 0;
  var rainbowDuration = 68;
  var snowMix = 0;
  var snowableEntries = (window.__MYCO_MODULES__ && window.__MYCO_MODULES__.textures.snowableEntries) || [];
  function registerSnowable(mat) {
    return window.__MYCO_MODULES__.textures.registerSnowable(mat);
  }

  // Áudio centralizado em window.MycoAudio (js/campus-audio.js)

  // Multiplayer
  var remoteAvatars = {};

  // Texturas procedurais compartilhadas
  var texBrick, texPaving, texWood, texWater;

  var callbacks = {
    onHarvestMushroom: null,
    onOpenLessons: null,
    onScreenNav: null,
    onNearScreen: null,
    onHoldChange: null,
    onFpsChange: null,
    onHoverPrompt: null,
    onWorldAction: null
  };

  function notifyWorldAction() {
    if (callbacks.onWorldAction) callbacks.onWorldAction();
  }

  function queueWorldStateChange(key, val) {
    pendingStateChanges[key] = String(val);
    recentlyChangedState[key] = performance.now() + 1600;
    notifyWorldAction();
  }

  function isTouchDevice() {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var minDim = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    var hasTouch = (navigator.maxTouchPoints || 0) > 0 && (window.innerWidth <= 1380 || minDim <= 1080);
    return coarse || hasTouch;
  }

  // ---------------- Texturas Procedurais & Física (delegado para js/engine/) ----------------

  function createProceduralTextures() {
    var T = window.__MYCO_MODULES__.textures;
    snowableEntries = T.snowableEntries;
    var res = T.createProceduralTextures();
    texBrick = res.texBrick;
    texPaving = res.texPaving;
    texWood = res.texWood;
    texWater = res.texWater;
  }

  function brickMat(repX, repY) { return window.__MYCO_MODULES__.textures.brickMat(repX, repY); }
  function woodMat(repX, repY) { return window.__MYCO_MODULES__.textures.woodMat(repX, repY); }
  function makeBox(w, h, d, colorOrMat, opts) { return window.__MYCO_MODULES__.textures.makeBox(w, h, d, colorOrMat, opts); }

  function getPhysCtx() {
    return {
      playerPos: playerPos,
      stairsList: stairsList,
      walkableFloors: walkableFloors,
      supportSurfaces: supportSurfaces,
      heldItem: heldItem,
      wallSegments: wallSegments,
      campusDoors: campusDoors,
      solidColliders: solidColliders
    };
  }

  function terrainHeight(x, z) { return window.__MYCO_MODULES__.physics.terrainHeight(x, z); }
  function getGroundHeight(x, z, refY, ignoreSurf) { return window.__MYCO_MODULES__.physics.getGroundHeight(getPhysCtx(), x, z, refY, ignoreSurf); }
  function getSupportSurfaceAt(x, z, margin, ignoreSurf, maxTopY) { return window.__MYCO_MODULES__.physics.getSupportSurfaceAt(getPhysCtx(), x, z, margin, ignoreSurf, maxTopY); }
  function getItemGroundHeight(x, z, refY, ignoreSurf, maxTopY) { return window.__MYCO_MODULES__.physics.getItemGroundHeight(getPhysCtx(), x, z, refY, ignoreSurf, maxTopY); }
  function getSurfaceTypeAt(x, y, z) { return window.__MYCO_MODULES__.physics.getSurfaceTypeAt(x, y, z); }
  function addWalkableSlab(cx, topY, cz, w, thickness, d, colorOrMat, opts) { return window.__MYCO_MODULES__.physics.addWalkableSlab(scene, walkableFloors, cx, topY, cz, w, thickness, d, colorOrMat, opts); }
  function addSolidWall(x1, z1, x2, z2, minY, height, thickness, colorOrMat, opts) { return window.__MYCO_MODULES__.physics.addSolidWall(scene, wallSegments, x1, z1, x2, z2, minY, height, thickness, colorOrMat, opts); }

  // ---------------- Construtores do Mundo (delegado para js/world/) ----------------

  function getWorldBuilderCtx() {
    return {
      scene: scene,
      solidColliders: solidColliders,
      wallSegments: wallSegments,
      walkableFloors: walkableFloors,
      stairsList: stairsList,
      supportSurfaces: supportSurfaces,
      supportMeshes: supportMeshes,
      pickableItems: pickableItems,
      wildMushrooms: wildMushrooms,
      campusDoors: campusDoors,
      doorHitMeshes: doorHitMeshes,
      windowBlinds: windowBlinds,
      blindHitMeshes: blindHitMeshes,
      seatMeshes: seatMeshes,
      chalkboards: chalkboards,
      chalkboardMeshes: chalkboardMeshes,
      lightSwitchMeshes: lightSwitchMeshes,
      campusLightSwitches: campusLightSwitches,
      roofZones: roofZones,
      fountainRipples: fountainRipples,
      rankingBtnMeshes: rankingBtnMeshes,
      sportBalls: sportBalls,
      hoodSwitchMeshes: hoodSwitchMeshes,
      cookerPots: cookerPots,
      burnerDevices: burnerDevices,
      burnerSwitchMeshes: burnerSwitchMeshes,
      spawnGrowItems: spawnGrowItems,
      scaleTareMeshes: scaleTareMeshes,
      scaleDevices: scaleDevices,
      stirSwitchMeshes: stirSwitchMeshes,
      stirrerDevices: stirrerDevices,
      isTouchDevice: isTouchDevice,
      getHeldItem: function () { return heldItem; },
      isHeldByRemote: isHeldByRemote,
      registerPickable: registerPickable,
      setHoodAirData: function (h) { hoodAirData = h; },
      ensureThermoTex: function () { if (!thermoTex) initThermoDisplay(); return thermoTex; },
      setTerrainSnowMat: function (m) { terrainSnowMat = m; },
      setFountainDropsAttr: function (a) { fountainDropsAttr = a; },
      setCinemaRefs: function (refs) {
        cinemaCanvas = refs.cinemaCanvas;
        cinemaCtx = refs.cinemaCtx;
        cinemaTex = refs.cinemaTex;
        cinemaScreenMesh = refs.cinemaScreenMesh;
        cinemaBeam = refs.cinemaBeam;
      }
    };
  }

  function buildNatureWorld() { return window.__MYCO_MODULES__.naturePlaza.buildNatureWorld(getWorldBuilderCtx()); }
  function createBanner(x, y, z, rotY, colorHex, emblem) { return window.__MYCO_MODULES__.naturePlaza.createBanner(scene, x, y, z, rotY, colorHex, emblem); }
  function buildPlaza() { return window.__MYCO_MODULES__.naturePlaza.buildPlaza(getWorldBuilderCtx()); }
  function buildCampusBuildingWing(opts) { return window.__MYCO_MODULES__.buildings.buildCampusBuildingWing(getWorldBuilderCtx(), opts); }

  // ---------------- Escadaria, Passarela Elevada & Torre do Relogio (delegado para js/world/staircase-clock.js) ----------------

  function getVirtualDayFrac() { return window.__MYCO_MODULES__.staircaseClock.getVirtualDayFrac(); }
  function updateClockTexture() { return window.__MYCO_MODULES__.staircaseClock.updateClockTexture(); }
  function buildStaircaseAndBridge() { return window.__MYCO_MODULES__.staircaseClock.buildStaircaseAndBridge(getWorldBuilderCtx()); }
  function buildClockTowerAndAuditorium() { return window.__MYCO_MODULES__.staircaseClock.buildClockTowerAndAuditorium(getWorldBuilderCtx()); }
  function updateCampusAuditoriumSlide(slideIndex, title, subtitle, bullets, presenter) {
    return window.__MYCO_MODULES__.staircaseClock.updateCampusAuditoriumSlide(slideIndex, title, subtitle, bullets, presenter);
  }

  // ---------------- Itens Pegaveis & Equipamentos das Alas (delegado para js/world/lab-tools.js) ----------------

  function registerPickable(id, label, mesh, x, y, z, ry, radius, height) {
    return window.__MYCO_MODULES__.labTools.registerPickable(getWorldBuilderCtx(), id, label, mesh, x, y, z, ry, radius, height);
  }
  function updateContainerVolume(item, newVol) {
    return window.__MYCO_MODULES__.labTools.updateContainerVolume(item, newVol);
  }
  function updateSyringeVolume(item, newVol) {
    return window.__MYCO_MODULES__.labTools.updateSyringeVolume(item, newVol);
  }
  function buildCampusWingsAndEquipment() {
    return window.__MYCO_MODULES__.labTools.buildCampusWingsAndEquipment(getWorldBuilderCtx());
  }

  // ---------------- Bancada de Cultivo Interativo da Estufa & Confetes & Mega Campus (delegado) ----------------

  var hoveredGreenhouseSlot = null;
  function getGreenhouseSlots() { return window.__MYCO_MODULES__.greenhouse.greenhouseSlots; }
  function getGreenhouseHitMeshes() { return window.__MYCO_MODULES__.greenhouse.greenhouseHitMeshes; }

  function initConfettiSystem() { return window.__MYCO_MODULES__.confetti.initConfettiSystem(scene); }
  function triggerConfettiBurst(x, y, z) { return window.__MYCO_MODULES__.confetti.triggerConfettiBurst(x, y, z); }
  function stepConfetti(dt) { return window.__MYCO_MODULES__.confetti.stepConfetti(dt); }

  function initGreenhouseParticlePools() { return window.__MYCO_MODULES__.greenhouse.initGreenhouseParticlePools(scene); }
  function triggerSporeBurst(ox, oy, oz, col) { return window.__MYCO_MODULES__.greenhouse.triggerSporeBurst(ox, oy, oz, col); }
  function triggerWaterSprayFx(ox, oy, oz) { return window.__MYCO_MODULES__.greenhouse.triggerWaterSprayFx(ox, oy, oz); }
  function stepGreenhouseParticles(dt) { return window.__MYCO_MODULES__.greenhouse.stepGreenhouseParticles(dt); }
  function updateGreenhouseSlotMesh(slot) { return window.__MYCO_MODULES__.greenhouse.updateGreenhouseSlotMesh(slot); }
  function buildGreenhouseBench() { return window.__MYCO_MODULES__.greenhouse.buildGreenhouseBench(scene); }
  function interactGreenhouseSlot(slot) {
    return window.__MYCO_MODULES__.greenhouse.interactGreenhouseSlot(slot, {
      heldItem: heldItem,
      callbacks: callbacks,
      queueWorldStateChange: queueWorldStateChange
    });
  }

  function buildOuterCampus() { return window.__MYCO_MODULES__.outerCampus.buildOuterCampus(getWorldBuilderCtx()); }

  // ---------------- Colisao & Posicionamento de Itens ----------------

  function clampPosAgainstWalls(pos, radius) {
    return window.__MYCO_MODULES__.physics.clampPosAgainstWalls(getPhysCtx(), pos, radius);
  }

  // ---------------- Entidades, Veiculos, Termometro & Ghost (delegado para js/entities/ & js/systems/chalkboard.js) ----------------

  function getEntityCtx() {
    return {
      scene: scene,
      camera: camera,
      raycaster: raycaster,
      playerPos: playerPos,
      inFps: inFps,
      pointerNdc: pointerNdc,
      heldItem: heldItem,
      heldRotY: heldRotY,
      snapClosePot: snapClosePot,
      snapPetriStack: snapPetriStack,
      cookerPots: cookerPots,
      pickableItems: pickableItems,
      supportMeshes: supportMeshes,
      supportSurfaces: supportSurfaces,
      wallSegments: wallSegments,
      thermalColumns: thermalColumns,
      recentlyDropped: recentlyDropped,
      pendingMovedItems: pendingMovedItems,
      physCtx: getPhysCtx(),
      isHeldByRemote: isHeldByRemote,
      removeFromCookerContents: removeFromCookerContents,
      setSnapClosePot: function (v) { snapClosePot = v; },
      setSnapPetriStack: function (v) { snapPetriStack = v; },
      setHeldRotY: function (v) { heldRotY = v; },
      getSnowboardGroup: function () { return snowboardGroup; },
      setSnowboardGroup: function (v) { snowboardGroup = v; },
      getParagliderGroup: function () { return paragliderGroup; },
      setParagliderGroup: function (v) { paragliderGroup = v; },
      setFpsArmRefs: function (r) {
        fpsArmGroup = r.fpsArmGroup;
        fpsLeftArmGroup = r.fpsLeftArmGroup;
        fpsSleeveMat = r.fpsSleeveMat;
      },
      setThermoLaserRefs: function (r) {
        thermoLaserLine = r.thermoLaserLine;
        thermoLaserDot = r.thermoLaserDot;
        if (r.thermoTex) thermoTex = r.thermoTex;
      }
    };
  }

  function buildFirstPersonArm() { return window.__MYCO_MODULES__.firstPersonArm.buildFirstPersonArm(getEntityCtx()); }
  function buildSnowboardRig() { return window.__MYCO_MODULES__.snowboard.buildSnowboardRig(getEntityCtx()); }
  function createParagliderWingMesh(scale) { return window.__MYCO_MODULES__.paraglider.createParagliderWingMesh(scale); }
  function buildParagliderRig() { return window.__MYCO_MODULES__.paraglider.buildParagliderRig(getEntityCtx()); }
  function buildThermalColumns() { return window.__MYCO_MODULES__.paraglider.buildThermalColumns(getEntityCtx()); }

  function drawBoardSegment(ctx, color, p0, p1) { return window.__MYCO_MODULES__.chalkboard.drawBoardSegment(ctx, color, p0, p1); }
  function applyStrokeToBoard(st) { return window.__MYCO_MODULES__.chalkboard.applyStrokeToBoard(chalkboards, st); }
  function getHeldBoardToolColor() { return window.__MYCO_MODULES__.chalkboard.getHeldBoardToolColor(heldItem); }
  function flushCurrentStroke() {
    if (currentStroke && currentStroke.pts.length > 0) {
      pendingBoardStrokes.push(currentStroke);
    }
    currentStroke = null;
    lastDrawPt = null;
  }

  function createPlacementGhost() {
    placementGhost = window.__MYCO_MODULES__.placementGhost.createPlacementGhost(scene);
  }
  function initThermoDisplay() {
    thermoTex = window.__MYCO_MODULES__.thermoLaser.initThermoDisplay();
    return thermoTex;
  }
  function drawThermoScreen(tempVal, modeStr, force) {
    return window.__MYCO_MODULES__.thermoLaser.drawThermoScreen(tempVal, modeStr, force);
  }
  function createThermoLaserFx() {
    return window.__MYCO_MODULES__.thermoLaser.createThermoLaserFx(getEntityCtx());
  }
  function updatePlacementGhostVisual(item, isValid, rotY) {
    return window.__MYCO_MODULES__.placementGhost.updatePlacementGhostVisual(item, isValid, rotY, clock.elapsedTime);
  }
  function findPlacementTarget(customNdc) {
    return window.__MYCO_MODULES__.placementGhost.findPlacementTarget(getEntityCtx(), customNdc);
  }
  var placementBlockedReason = '';
  function isPlacementBlocked(pt) {
    var blocked = window.__MYCO_MODULES__.placementGhost.isPlacementBlocked(getEntityCtx(), pt);
    placementBlockedReason = window.__MYCO_MODULES__.placementGhost.getPlacementBlockedReason();
    return blocked;
  }
  function dropUnsupportedItems() {
    return window.__MYCO_MODULES__.placementGhost.dropUnsupportedItems(getEntityCtx());
  }

  // ---------------- Avatares Multiplayer (delegado a js/entities/avatars.js) ----------------

  function normalizeAngle(a) { return M().avatars.normalizeAngle(a); }
  function disposeObject3D(root, skipMat) { return M().avatars.disposeObject3D(root, skipMat); }
  function buildAvatarHat(hatId, hatMat, hatGroup) { return M().avatars.buildAvatarHat(hatId, hatMat, hatGroup); }
  function buildCuteAvatar(data) { return M().avatars.buildCuteAvatar(scene, data); }

  function isHeldByRemote(itemId) {
    var ids = Object.keys(remoteAvatars);
    for (var i = 0; i < ids.length; i++) {
      var hId = remoteAvatars[ids[i]].holding;
      if (hId === itemId) return true;
      if (hId) {
        var item = findPickable(itemId);
        if (item && item.potItem && item.isAttached && item.potItem.id === hId) {
          return true;
        }
      }
    }
    return false;
  }

  function findPickable(itemId) {
    for (var i = 0; i < pickableItems.length; i++) {
      if (pickableItems[i].id === itemId) return pickableItems[i];
    }
    return null;
  }

  function removeFromCookerContents(item) {
    if (!item) return;
    for (var i = 0; i < cookerPots.length; i++) {
      var idx = cookerPots[i].contents.indexOf(item);
      if (idx !== -1) cookerPots[i].contents.splice(idx, 1);
    }
  }

  function isItemInsideClosedCooker(item) {
    if (!item) return null;
    for (var i = 0; i < cookerPots.length; i++) {
      var cp = cookerPots[i];
      if (cp.contents.indexOf(item) !== -1 && cp.lidItem && cp.lidItem.isAttached) {
        return cp;
      }
    }
    return null;
  }

  function updateCampusPlayers(players) {
    return M().avatars.updateCampusPlayers({
      scene: scene,
      remoteAvatars: remoteAvatars,
      heldItem: heldItem,
      onDropStolenHeld: function () {
        setHeldTwoHandedGhost(heldItem, false);
        heldItem = null;
        if (placementGhost) placementGhost.visible = false;
        if (callbacks.onHoldChange) callbacks.onHoldChange(null);
      }
    }, players);
  }

  function stepMultiplayerAvatars(dt) {
    return M().avatars.stepMultiplayerAvatars({
      remoteAvatars: remoteAvatars,
      clock: clock,
      auraEnabled: auraEnabled,
      findPickable: findPickable,
      heldItem: heldItem
    }, dt);
  }

  // ---------------- Interacoes & Tour (delegado a js/systems/interaction-system.js e lobby-tour.js) ----------------

  function setMeshGhostOpacity(root, active) { return M().interactionSystem.setMeshGhostOpacity(root, active); }
  function setHeldTwoHandedGhost(item, active) { return M().interactionSystem.setHeldTwoHandedGhost(item, active); }
  function isSeatOccupied(seat) { return M().interactionSystem.isSeatOccupied(remoteAvatars, seat); }
  function firstValidRayHit(hits) { return M().interactionSystem.firstValidRayHit(hits); }

  var _interactionCtx = null;
  function getInteractionCtx() {
    if (_interactionCtx) return _interactionCtx;
    _interactionCtx = {
      get entityCtx() { return getEntityCtx(); },
      get heldItem() { return heldItem; },
      set heldItem(v) { heldItem = v; },
      get heldRotY() { return heldRotY; },
      set heldRotY(v) { heldRotY = v; },
      get syringePumping() { return syringePumping; },
      set syringePumping(v) { syringePumping = v; },
      get syringePunctureProgress() { return syringePunctureProgress; },
      set syringePunctureProgress(v) { syringePunctureProgress = v; },
      get lastSyringeTargetItem() { return lastSyringeTargetItem; },
      set lastSyringeTargetItem(v) { lastSyringeTargetItem = v; },
      get inFps() { return inFps; },
      get pointerNdc() { return pointerNdc; },
      get callbacks() { return callbacks; },
      get pendingMovedItems() { return pendingMovedItems; },
      get recentlyDropped() { return recentlyDropped; },
      get cookerPots() { return cookerPots; },
      get thermoLaserOn() { return thermoLaserOn; },
      set thermoLaserOn(v) { thermoLaserOn = v; },
      get thermoCurrentTemp() { return thermoCurrentTemp; },
      get thermoTargetLabel() { return thermoTargetLabel; },
      get placementGhost() { return placementGhost; },
      get thermoLaserLine() { return thermoLaserLine; },
      get thermoLaserDot() { return thermoLaserDot; },
      notifyWorldAction: notifyWorldAction,
      get lastPickupAt() { return lastPickupAt; },
      set lastPickupAt(v) { lastPickupAt = v; },
      get hoveredBoardHit() { return hoveredBoardHit; },
      set hoveredBoardHit(v) { hoveredBoardHit = v; },
      get hoveredBoardIndex() { return hoveredBoardIndex; },
      set hoveredBoardIndex(v) { hoveredBoardIndex = v; },
      get chalkboards() { return chalkboards; },
      get chalkboardMeshes() { return chalkboardMeshes; },
      get pendingBoardStrokes() { return pendingBoardStrokes; },
      get hoveredPotInsert() { return hoveredPotInsert; },
      set hoveredPotInsert(v) { hoveredPotInsert = v; },
      get hoveredSprayTarget() { return hoveredSprayTarget; },
      set hoveredSprayTarget(v) { hoveredSprayTarget = v; },
      get hoodSanitizedUntil() { return hoodSanitizedUntil; },
      set hoodSanitizedUntil(v) { hoodSanitizedUntil = v; },
      get camera() { return camera; },
      get scene() { return scene; },
      get sprayBursts() { return sprayBursts; },
      get hoveredSyringeTarget() { return hoveredSyringeTarget; },
      set hoveredSyringeTarget(v) { hoveredSyringeTarget = v; },
      get placementValid() { return placementValid; },
      set placementValid(v) { placementValid = v; },
      get clock() { return clock; },
      get snapClosePot() { return snapClosePot; },
      set snapClosePot(v) { snapClosePot = v; },
      get hoveredGreenhouseSlot() { return hoveredGreenhouseSlot; },
      set hoveredGreenhouseSlot(v) { hoveredGreenhouseSlot = v; },
      interactGreenhouseSlot: interactGreenhouseSlot,
      get hoveredMushroom() { return hoveredMushroom; },
      set hoveredMushroom(v) { hoveredMushroom = v; },
      queueWorldStateChange: queueWorldStateChange,
      get hoveredDoorObj() { return hoveredDoorObj; },
      set hoveredDoorObj(v) { hoveredDoorObj = v; },
      get hoveredBlindObj() { return hoveredBlindObj; },
      set hoveredBlindObj(v) { hoveredBlindObj = v; },
      get hoveredCinema() { return hoveredCinema; },
      set hoveredCinema(v) { hoveredCinema = v; },
      get hoveredCinemaUv() { return hoveredCinemaUv; },
      set hoveredCinemaUv(v) { hoveredCinemaUv = v; },
      getCinemaHitTarget: getCinemaHitTarget,
      get cinemaPower() { return cinemaPower; },
      set cinemaPower(v) { cinemaPower = v; },
      get cinemaDirty() { return cinemaDirty; },
      set cinemaDirty(v) { cinemaDirty = v; },
      get cinemaBeam() { return cinemaBeam; },
      get cinemaLessonIdx() { return cinemaLessonIdx; },
      set cinemaLessonIdx(v) { cinemaLessonIdx = v; },
      get cinemaPlaying() { return cinemaPlaying; },
      set cinemaPlaying(v) { cinemaPlaying = v; },
      get cinemaTime() { return cinemaTime; },
      set cinemaTime(v) { cinemaTime = v; },
      get cinemaLessons() { return cinemaLessons; },
      get cinemaScreenMesh() { return cinemaScreenMesh; },
      get lastCinemaHoverType() { return lastCinemaHoverType; },
      set lastCinemaHoverType(v) { lastCinemaHoverType = v; },
      get lastCinemaHoverIdx() { return lastCinemaHoverIdx; },
      set lastCinemaHoverIdx(v) { lastCinemaHoverIdx = v; },
      get hoveredRankBtn() { return hoveredRankBtn; },
      set hoveredRankBtn(v) { hoveredRankBtn = v; },
      get rankingBtnMeshes() { return rankingBtnMeshes; },
      get hoveredSeat() { return hoveredSeat; },
      set hoveredSeat(v) { hoveredSeat = v; },
      get remoteAvatars() { return remoteAvatars; },
      get seatedSeat() { return seatedSeat; },
      set seatedSeat(v) { seatedSeat = v; },
      get playerPos() { return playerPos; },
      get playerYaw() { return playerYaw; },
      set playerYaw(v) { playerYaw = v; },
      get playerPitch() { return playerPitch; },
      set playerPitch(v) { playerPitch = v; },
      get playerVelX() { return playerVelX; },
      set playerVelX(v) { playerVelX = v; },
      get playerVelZ() { return playerVelZ; },
      set playerVelZ(v) { playerVelZ = v; },
      get playerVelY() { return playerVelY; },
      set playerVelY(v) { playerVelY = v; },
      get hoveredSwitch() { return hoveredSwitch; },
      set hoveredSwitch(v) { hoveredSwitch = v; },
      get hoveredHoodSwitch() { return hoveredHoodSwitch; },
      set hoveredHoodSwitch(v) { hoveredHoodSwitch = v; },
      get hoveredStirSwitch() { return hoveredStirSwitch; },
      set hoveredStirSwitch(v) { hoveredStirSwitch = v; },
      get hoveredScaleTare() { return hoveredScaleTare; },
      set hoveredScaleTare(v) { hoveredScaleTare = v; },
      get hoveredBurnerSwitch() { return hoveredBurnerSwitch; },
      set hoveredBurnerSwitch(v) { hoveredBurnerSwitch = v; },
      get hoveredPickable() { return hoveredPickable; },
      set hoveredPickable(v) { hoveredPickable = v; },
      get pickableItems() { return pickableItems; },
      isHeldByRemote: isHeldByRemote,
      isItemInsideClosedCooker: isItemInsideClosedCooker,
      isTouchDevice: isTouchDevice,
      get raycaster() { return raycaster; },
      get scaleTareMeshes() { return scaleTareMeshes; },
      get burnerSwitchMeshes() { return burnerSwitchMeshes; },
      get burnerDevices() { return burnerDevices; },
      get stirSwitchMeshes() { return stirSwitchMeshes; },
      get hoodSwitchMeshes() { return hoodSwitchMeshes; },
      get lightSwitchMeshes() { return lightSwitchMeshes; },
      get seatMeshes() { return seatMeshes; },
      get doorHitMeshes() { return doorHitMeshes; },
      get wildMushrooms() { return wildMushrooms; },
      get blindHitMeshes() { return blindHitMeshes; }
    };
    return _interactionCtx;
  }

  function dropHeldItem() { return M().interactionSystem.dropHeldItem(getInteractionCtx()); }
  var lastPickupAt = 0;
  function handlePrimaryAction() { return M().interactionSystem.handlePrimaryAction(getInteractionCtx()); }
  function updateHoverRay(customNdc) { return M().interactionSystem.updateHoverRay(getInteractionCtx(), customNdc); }
  function stepLobbyTour(dt) { tourTime = M().lobbyTour.stepLobbyTour(camera, controls, tourTime, dt); }

  function bindControls() {
    window.addEventListener('keydown', function (e) {
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        window.triggerCampusJump();
      }
      if (e.code === 'KeyG' || e.code === 'KeyQ') {
        if (heldItem) {
          dropHeldItem();
        }
      }
      if (e.code === 'KeyB' && window.toggleCampusSnowboard) {
        window.toggleCampusSnowboard();
      }
      if (e.code === 'KeyP' && window.toggleCampusParaglider) {
        window.toggleCampusParaglider();
      }
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

    function clearAllInputKeys() {
      Object.keys(keys).forEach(function (k) { keys[k] = false; });
      isPrimaryDown = false;
      jumpHeld = false;
      flushCurrentStroke();
    }
    window.addEventListener('blur', clearAllInputKeys);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearAllInputKeys();
    });
    document.addEventListener('pointerlockchange', function () {
      if (document.pointerLockElement !== renderer.domElement) {
        clearAllInputKeys();
      }
    });

    renderer.domElement.addEventListener('mousemove', function (e) {
      if (inFps && document.pointerLockElement === renderer.domElement) {
        playerYaw -= e.movementX * 0.0022;
        playerPitch = Math.max(-1.35, Math.min(1.35, playerPitch - e.movementY * 0.0022));
      } else {
        var rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      }
    });

    var lastTouchEndAt = 0;
    var lastTouchActionAt = 0;

    renderer.domElement.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || lobbyTourActive) return;
      if ((e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) || (performance.now() - lastTouchEndAt < 700)) {
        return;
      }
      if (inFps && document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
        return;
      }
      isPrimaryDown = true;
      handlePrimaryAction();
    });

    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) {
        isPrimaryDown = false;
        flushCurrentStroke();
      }
    });

    renderer.domElement.addEventListener('wheel', function (e) {
      if (heldItem) {
        e.preventDefault();
        heldRotY += e.deltaY > 0 ? 0.35 : -0.35;
      }
    }, { passive: false });

    var touchLookId = null, lastTX = 0, lastTY = 0, touchMoved = false;
    touchDrawingBoard = false;
    function setNdcFromTouch(t) {
      var rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function isUiTouch(el) {
      if (!el || !el.closest) return false;
      return !!(
        el.closest('#mobile-joystick-zone') ||
        el.closest('#mobile-actions') ||
        el.closest('.touch-btn') ||
        el.closest('button') ||
        el.closest('input') ||
        el.closest('textarea') ||
        el.closest('form') ||
        el.closest('#lesson-modal') ||
        el.closest('#ranking-modal') ||
        el.closest('#admin-modal') ||
        el.closest('#campus-lobby')
      );
    }

    window.addEventListener('touchstart', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (isUiTouch(t.target)) continue;
        if (touchLookId === null) {
          touchLookId = t.identifier;
          lastTX = t.clientX; lastTY = t.clientY;
          touchMoved = false;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          var dx = t.clientX - lastTX, dy = t.clientY - lastTY;
          if (Math.hypot(dx, dy) > 4) touchMoved = true;
          if (inFps) {
            // Sensibilidade ágil e fluida para o dedão da mão direita (0.0080)
            playerYaw -= dx * 0.0080;
            playerPitch = Math.max(-1.35, Math.min(1.35, playerPitch - dy * 0.0080));
          }
          lastTX = t.clientX; lastTY = t.clientY;
        }
      }
    }, { passive: true });

    function resetTouchLook(e) {
      lastTouchEndAt = performance.now();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          if (!touchMoved && !lobbyTourActive) {
            var nowT = performance.now();
            if (nowT - lastTouchActionAt > 180) {
              lastTouchActionAt = nowT;
              setNdcFromTouch(t);
              updateHoverRay(pointerNdc);
              // Se tocou no vazio, tenta tambem na mira central (crosshair) para facilitar no celular
              var isHolding = !!heldItem;
              var hasTarget = isHolding || hoveredPickable || hoveredMushroom || hoveredDoorObj || hoveredBlindObj ||
                hoveredSeat || hoveredSwitch || hoveredHoodSwitch || hoveredStirSwitch ||
                hoveredSyringeTarget || hoveredScaleTare || hoveredBurnerSwitch || hoveredPotInsert ||
                hoveredSprayTarget || hoveredRankBtn || hoveredCinema || hoveredScreen || hoveredScreenBtn ||
                (hoveredBoardHit && getHeldBoardToolColor());
              if (!hasTarget) {
                pointerNdc.set(0, 0);
                updateHoverRay(pointerNdc);
              }
              handlePrimaryAction();
            }
          }
          touchLookId = null;
        }
      }
    }
    window.addEventListener('touchend', resetTouchLook, { passive: true });
    window.addEventListener('touchcancel', resetTouchLook, { passive: true });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Vetores e Cores pré-alocados para ZERO Garbage Collection no loop de renderizacao
  var _tmpHandLocal = new THREE.Vector3();
  var _tmpHandPos = new THREE.Vector3();
  var _tmpMuzzlePos = new THREE.Vector3();
  var _vZero2 = new THREE.Vector2(0, 0);
  var _tmpAvatarYAxis = new THREE.Vector3(0, 1, 0);
  var _tmpAvatarHandOffset = new THREE.Vector3();

  var qualityMode = 'auto'; // 'auto' | 'high' | 'medium' | 'low' | 'min'
  var qualityTier = 'high';
  var qualityTiersOrder = ['high', 'medium', 'low', 'min'];
  var auraEnabled = true;

  function applyQualityTier(tier) {
    var Q = window.__MYCO_MODULES__.quality;
    Q.qualityState.mode = qualityMode;
    Q.applyQualityTier(tier, {
      renderer: renderer,
      camera: camera,
      envSun: envSun,
      weatherPoints: weatherPoints,
      onQualityChange: callbacks.onQualityChange
    });
    qualityTier = Q.qualityState.tier;
    auraEnabled = Q.qualityState.auraEnabled;
  }

  function stepAutoQuality(now) {
    var Q = window.__MYCO_MODULES__.quality;
    Q.qualityState.mode = qualityMode;
    Q.stepAutoQuality(now, isTouchDevice(), {
      renderer: renderer,
      camera: camera,
      envSun: envSun,
      weatherPoints: weatherPoints,
      onQualityChange: callbacks.onQualityChange
    });
    qualityTier = Q.qualityState.tier;
    auraEnabled = Q.qualityState.auraEnabled;
  }

  var lastMobileHoverAt = 0;
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(0.05, clock.getDelta());
    var now = performance.now();
    stepAutoQuality(now);

    updateClockTexture();

    for (var wmIdx = 0; wmIdx < wildMushrooms.length; wmIdx++) {
      var wm = wildMushrooms[wmIdx];
      if (!wm.active && now >= wm.respawnAt) {
        wm.active = true; wm.group.visible = true;
      } else if (wm.active) {
        wm.capMesh.rotation.y += dt * 0.5;
      }
    }

    for (var di = 0; di < campusDoors.length; di++) {
      var d = campusDoors[di];
      var targetAngle = d.open ? -d.dir * Math.PI * 0.48 : 0;
      d.angle += (targetAngle - d.angle) * Math.min(1, dt * 8);
      d.pivot.rotation.y = d.angle;
    }

    for (var bi = 0; bi < windowBlinds.length; bi++) {
      var b = windowBlinds[bi];
      var targetProg = b.open ? 0.0 : 1.0; // 1.0 = persiana abaixada cobrindo o vidro, 0.0 = recolhida no topo
      if (Math.abs(b.progress - targetProg) > 0.001) {
        b.progress += (targetProg - b.progress) * Math.min(1, dt * 7.5);
        var p = b.progress;
        var count = b.slats.length;
        var activeSpan = (b.dropH - 0.14) * p;
        for (var si = 0; si < count; si++) {
          var frac = (si + 0.5) / count;
          var stackedY = -0.05 - si * 0.007;
          var fullY = -0.07 - frac * (b.dropH - 0.12);
          b.slats[si].position.y = stackedY + (fullY - stackedY) * p;
          // Lâminas inclinam enquanto abrem/fecham, simulando o giro da vareta da persiana
          b.slats[si].rotation.z = b.dir * (0.28 * p + (1 - p) * 1.15);
        }
        var bottomY = -0.09 - count * 0.007 - activeSpan;
        b.bottomRail.position.y = bottomY;
        var tapeLen = Math.max(0.08, -bottomY);
        for (var ti = 0; ti < b.tapes.length; ti++) {
          b.tapes[ti].scale.y = tapeLen / b.dropH;
          b.tapes[ti].position.y = -tapeLen / 2;
        }
        if (b.cordKnob) {
          b.cordKnob.position.y = -b.dropH * 0.42 - (1 - p) * (b.dropH * 0.35);
        }
      }
    }

    if (lobbyTourActive) {
      stepLobbyTour(dt);
    } else if (inFps) {
      var moveZ = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - joyY;
      var moveX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) + joyX;
      var mag = Math.hypot(moveX, moveZ);

      var groundY = getGroundHeight(playerPos.x, playerPos.z, playerPos.y);
      var onGround = (playerPos.y <= groundY + 0.06 && playerVelY <= 0.05);

      if (snowboardActive) {
        if (seatedSeat) seatedSeat = null;
        var fwdX = -Math.sin(playerYaw), fwdZ = -Math.cos(playerYaw);
        var rightX = Math.cos(playerYaw), rightZ = -Math.sin(playerYaw);

        // Gradiente do terreno para aceleração real na descida da montanha
        var hL = terrainHeight(playerPos.x - 0.6, playerPos.z);
        var hR = terrainHeight(playerPos.x + 0.6, playerPos.z);
        var hD = terrainHeight(playerPos.x, playerPos.z - 0.6);
        var hU = terrainHeight(playerPos.x, playerPos.z + 0.6);
        var gradX = (hR - hL) / 1.2;
        var gradZ = (hU - hD) / 1.2;

        if (onGround) {
          // Gravidade puxando morro abaixo
          playerVelX += (-gradX) * 20.0 * dt;
          playerVelZ += (-gradZ) * 20.0 * dt;

          // Impulso manual (remar no plano / embalar) e freio (S)
          if (moveZ > 0.1) {
            playerVelX += fwdX * moveZ * 10.5 * dt;
            playerVelZ += fwdZ * moveZ * 10.5 * dt;
          } else if (moveZ < -0.1) {
            // Freio de borda (carving brake)
            var brakeDamp = Math.exp(-5.5 * dt);
            playerVelX *= brakeDamp;
            playerVelZ *= brakeDamp;
          }

          // Carving lateral: transfere parte da velocidade para a direção que a prancha aponta
          var curSpd = Math.hypot(playerVelX, playerVelZ);
          if (curSpd > 0.4) {
            var carveSteer = (moveX * 0.45);
            var targetDirX = fwdX + rightX * carveSteer;
            var targetDirZ = fwdZ + rightZ * carveSteer;
            var tdLen = Math.hypot(targetDirX, targetDirZ) || 1;
            targetDirX /= tdLen; targetDirZ /= tdLen;
            var align = (playerVelX * targetDirX + playerVelZ * targetDirZ) >= 0 ? 1 : -1;
            var desiredVX = targetDirX * curSpd * align;
            var desiredVZ = targetDirZ * curSpd * align;
            var carveBlend = 1 - Math.exp(-3.4 * dt);
            playerVelX += (desiredVX - playerVelX) * carveBlend;
            playerVelZ += (desiredVZ - playerVelZ) * carveBlend;
          } else if (Math.abs(moveX) > 0.1) {
            playerVelX += rightX * moveX * 6.0 * dt;
            playerVelZ += rightZ * moveX * 6.0 * dt;
          }

          // Atrito suave da neve/grama
          var snowFriction = Math.exp(-0.48 * dt);
          playerVelX *= snowFriction;
          playerVelZ *= snowFriction;
        }

        // Limite de velocidade realista (até 26 m/s em descida forte)
        var sbSpeed = Math.hypot(playerVelX, playerVelZ);
        if (sbSpeed > 26.0) {
          playerVelX = (playerVelX / sbSpeed) * 26.0;
          playerVelZ = (playerVelZ / sbSpeed) * 26.0;
          sbSpeed = 26.0;
        }

        if (sbSpeed > 0.01) {
          playerPos.x += playerVelX * dt;
          playerPos.z += playerVelZ * dt;
          playerPos.x = Math.max(-210, Math.min(210, playerPos.x));
          playerPos.z = Math.max(-210, Math.min(210, playerPos.z));
          clampPosAgainstWalls(playerPos, PLAYER_RADIUS);
        }

        var targetPitch = Math.atan2(-(gradX * fwdX + gradZ * fwdZ), 1);
        var targetRoll = -moveX * 0.24 - Math.max(-0.22, Math.min(0.22, (playerVelX * rightX + playerVelZ * rightZ) * 0.025));
        snowboardPitch += (targetPitch - snowboardPitch) * Math.min(1, dt * 8);
        snowboardRoll += (targetRoll - snowboardRoll) * Math.min(1, dt * 8);
      } else if (paragliderActive && !onGround) {
        if (seatedSeat) seatedSeat = null;
        var fwdX = -Math.sin(playerYaw), fwdZ = -Math.cos(playerYaw);
        var rightX = Math.cos(playerYaw), rightZ = -Math.sin(playerYaw);
        var glideSpeed = moveZ > 0.1 ? 15.0 : (moveZ < -0.1 ? 4.2 : 11.2);
        var targetVX = (fwdX * glideSpeed) + (rightX * moveX * 3.8);
        var targetVZ = (fwdZ * glideSpeed) + (rightZ * moveX * 3.8);
        var airBlend = 1 - Math.exp(-3.2 * dt);
        playerVelX += (targetVX - playerVelX) * airBlend;
        playerVelZ += (targetVZ - playerVelZ) * airBlend;
        playerPos.x = Math.max(-210, Math.min(210, playerPos.x + playerVelX * dt));
        playerPos.z = Math.max(-210, Math.min(210, playerPos.z + playerVelZ * dt));
        clampPosAgainstWalls(playerPos, PLAYER_RADIUS);

        var targetPgRoll = -moveX * 0.28;
        paragliderRoll += (targetPgRoll - paragliderRoll) * Math.min(1, dt * 6);
      } else {
        var targetVX = 0, targetVZ = 0;
        if (mag > 0.08) {
          if (seatedSeat) seatedSeat = null; // levanta automaticamente ao andar!
          var isSprinting = !!(keys['ShiftLeft'] || keys['ShiftRight'] || mobileSprint);
          var maxSpeed = isSprinting ? 7.5 : 4.6;
          var throttle = Math.min(1, mag);
          moveX /= mag; moveZ /= mag;
          var fwdX = -Math.sin(playerYaw), fwdZ = -Math.cos(playerYaw);
          var rightX = Math.cos(playerYaw), rightZ = -Math.sin(playerYaw);
          targetVX = (fwdX * moveZ + rightX * moveX) * maxSpeed * throttle;
          targetVZ = (fwdZ * moveZ + rightZ * moveX) * maxSpeed * throttle;
        }
        // Aceleracao e desaceleracao suaves (inercia natural ao andar e parar)
        var accelFactor = 1 - Math.exp(-(mag > 0.08 ? 9.5 : 7.5) * dt);
        playerVelX += (targetVX - playerVelX) * accelFactor;
        playerVelZ += (targetVZ - playerVelZ) * accelFactor;

        var speedNowWalk = Math.hypot(playerVelX, playerVelZ);
        isWalking = speedNowWalk > 0.2;
        if (speedNowWalk > 0.01) {
          playerPos.x += playerVelX * dt;
          playerPos.z += playerVelZ * dt;
          playerPos.x = Math.max(-210, Math.min(210, playerPos.x));
          playerPos.z = Math.max(-210, Math.min(210, playerPos.z));
          clampPosAgainstWalls(playerPos, PLAYER_RADIUS);
        }
      }

      var speedNow = Math.hypot(playerVelX, playerVelZ);
      isWalking = !snowboardActive && !(paragliderActive && !onGround) && speedNow > 0.2;
      groundY = getGroundHeight(playerPos.x, playerPos.z, playerPos.y);

      // Correntes de ar termicas (animacao + sustentacao para Paraglider)
      var inThermal = false;
      for (var tci = 0; tci < thermalColumns.length; tci++) {
        var tc = thermalColumns[tci];
        for (var tri = 0; tri < tc.rings.length; tri++) {
          var tr = tc.rings[tri];
          var relH = ((clock.elapsedTime * 7.5 + tr.offset) % 84);
          tr.mesh.position.y = tc.baseY + 2 + relH;
          tr.mesh.rotation.z = clock.elapsedTime * 1.2 + tri;
        }
        if (paragliderActive && !onGround && playerPos.y < tc.maxH) {
          if (Math.hypot(playerPos.x - tc.x, playerPos.z - tc.z) < tc.radius) {
            inThermal = true;
          }
        }
      }

      if (paragliderActive && !onGround) {
        if (inThermal) {
          playerVelY += (8.5 - playerVelY) * Math.min(1, dt * 3.5);
        } else {
          var sinkRate = moveZ < -0.1 ? -5.2 : (moveZ > 0.1 ? -2.15 : -1.55);
          playerVelY += (sinkRate - playerVelY) * Math.min(1, dt * 4.5);
        }
      } else {
        playerVelY -= 16.5 * dt;
      }
      playerPos.y += playerVelY * dt;
      if (playerPos.y <= groundY) {
        playerPos.y = groundY;
        playerVelY = 0;
        onGround = true;
        lastGroundedAt = now;
      } else {
        onGround = false;
      }
      if (inFps && isWalking && onGround && window.MycoAudio) {
        var sType = getSurfaceTypeAt(playerPos.x, playerPos.y, playerPos.z);
        window.MycoAudio.playFootstep(sType);
      }
      // Pulo responsivo: Coyote Time (150ms), Jump Buffer (150ms) e segurar Espaco/Pulo
      var wantsJump = (now <= jumpBufferUntil) || keys['Space'] || jumpHeld;
      if (wantsJump && (onGround || (now - lastGroundedAt < 150 && playerVelY <= 0))) {
        if (seatedSeat) seatedSeat = null;
        playerVelY = paragliderActive ? 9.2 : (snowboardActive ? 7.2 : 6.2);
        onGround = false;
        lastGroundedAt = 0;
        jumpBufferUntil = 0;
      }
      var bobY = 0;
      if (!snowboardActive && !(paragliderActive && !onGround) && onGround && speedNow > 0.25) {
        walkBobPhase += dt * (4.5 + speedNow * 1.4);
        bobY = Math.sin(walkBobPhase) * 0.028 * Math.min(1, speedNow / 3.8);
      }
      var eyeH = seatedSeat ? 1.50 : (snowboardActive ? 1.42 : PLAYER_EYE);
      if (seatedSeat) {
        playerPos.set(seatedSeat.x, seatedSeat.y, seatedSeat.z);
        playerVelY = 0;
      }
      if (snowboardGroup) {
        snowboardGroup.visible = snowboardActive && inFps;
        if (snowboardGroup.visible) {
          snowboardGroup.position.set(playerPos.x, playerPos.y + 0.03, playerPos.z);
          snowboardGroup.rotation.order = 'YXZ';
          snowboardGroup.rotation.y = playerYaw - 0.35;
          snowboardGroup.rotation.x = snowboardPitch;
          snowboardGroup.rotation.z = snowboardRoll;
        }
      }
      if (paragliderGroup) {
        paragliderGroup.visible = paragliderActive && !onGround && inFps;
        if (paragliderGroup.visible) {
          paragliderGroup.position.set(playerPos.x, playerPos.y + 0.45, playerPos.z);
          paragliderGroup.rotation.order = 'YXZ';
          paragliderGroup.rotation.y = playerYaw;
          paragliderGroup.rotation.z = paragliderRoll;
        }
      }
      camera.position.set(playerPos.x, playerPos.y + eyeH + bobY, playerPos.z);
      camera.up.set(0, 1, 0);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = playerYaw;
      camera.rotation.x = playerPitch;
      camera.rotation.z = snowboardActive ? snowboardRoll * 0.35 : ((paragliderActive && !onGround) ? paragliderRoll * 0.45 : 0);

      // Braço(s) em 1a pessoa + item segurado na(s) mao(s)
      var isTwoHanded = !!(heldItem && heldItem.mesh.userData.twoHanded);
      if (fpsArmGroup) {
        fpsArmGroup.visible = true;
        if (paragliderActive && !onGround) {
          fpsArmGroup.position.set(0.32, 0.06, -0.34);
          fpsArmGroup.rotation.set(0.85, -0.10, -0.15);
        } else if (snowboardActive) {
          fpsArmGroup.position.set(0.42, -0.22, -0.34);
          fpsArmGroup.rotation.set(0.10, -0.45, -0.25);
        } else {
          var drawingNow = !!(isPrimaryDown && hoveredBoardHit && getHeldBoardToolColor());
          armReach += ((drawingNow ? 1 : 0) - armReach) * Math.min(1, dt * 14);
          if (speedNow > 0.2) armSwingPhase += dt * 7;
          fpsArmGroup.position.set(
            (isTwoHanded ? 0.27 : 0.32) - armReach * 0.08,
            (isTwoHanded ? -0.34 : -0.28) + Math.sin(armSwingPhase) * 0.014 + armReach * 0.06,
            (isTwoHanded ? -0.56 : -0.42) - armReach * 0.16
          );
          fpsArmGroup.rotation.set(0.18 + armReach * 0.35, (isTwoHanded ? 0.12 : -0.14) + armReach * 0.1, 0.05);
        }
      }
      if (fpsLeftArmGroup) {
        fpsLeftArmGroup.visible = isTwoHanded || (paragliderActive && !onGround) || snowboardActive;
        if (paragliderActive && !onGround) {
          fpsLeftArmGroup.position.set(-0.32, 0.06, -0.34);
          fpsLeftArmGroup.rotation.set(0.85, 0.10, 0.15);
        } else if (snowboardActive) {
          fpsLeftArmGroup.position.set(-0.42, -0.22, -0.34);
          fpsLeftArmGroup.rotation.set(0.10, 0.45, 0.25);
        } else if (isTwoHanded) {
          fpsLeftArmGroup.position.set(-0.27, -0.34 + Math.sin(armSwingPhase) * 0.014, -0.56);
          fpsLeftArmGroup.rotation.set(0.18, -0.12, -0.05);
        }
      }

      if (heldItem) {
        var reachZ = fpsArmGroup ? armReach * 0.16 : 0;
        var reachY = fpsArmGroup ? armReach * 0.06 : 0;
        if (isTwoHanded) {
          _tmpHandLocal.set(0, -0.48, -0.78);
        } else {
          _tmpHandLocal.set(0.30, -0.22 + reachY, -0.58 - reachZ);
        }
        _tmpHandPos.copy(_tmpHandLocal).applyEuler(camera.rotation).add(camera.position);
        heldItem.mesh.position.copy(_tmpHandPos);
        if (heldItem.id.indexOf('chalk_') === 0) {
          heldItem.mesh.rotation.order = 'YXZ';
          heldItem.mesh.rotation.set(playerPitch + 0.35, playerYaw, 0);
        } else if (heldItem.id.indexOf('board_eraser') === 0) {
          heldItem.mesh.rotation.order = 'YXZ';
          heldItem.mesh.rotation.set(playerPitch + Math.PI / 2, playerYaw, 0);
        } else if (heldItem.mesh.userData.isThermometer) {
          _tmpHandLocal.set(0.24, -0.22 + reachY, -0.46 - reachZ);
          _tmpHandPos.copy(_tmpHandLocal).applyEuler(camera.rotation).add(camera.position);
          heldItem.mesh.position.copy(_tmpHandPos);
          heldItem.mesh.rotation.order = 'YXZ';
          heldItem.mesh.rotation.set(playerPitch, playerYaw, 0);

          // Feixe laser e leitura de temperatura em tempo real (somente quando o laser estiver ligado!)
          if (!thermoLaserOn) {
            thermoLaserLine.visible = false;
            thermoLaserDot.visible = false;
            drawThermoScreen(thermoCurrentTemp, 'HOLD');
          } else {
            _tmpMuzzlePos.set(0, 0.155, -0.09).applyEuler(heldItem.mesh.rotation).add(heldItem.mesh.position);
            raycaster.setFromCamera(inFps ? _vZero2 : pointerNdc, camera);

            if (!window._cachedLaserTargets || (now - (window._lastLaserCacheAt || 0) > 800)) {
              window._lastLaserCacheAt = now;
              var lTargets = [];
              for (var pki = 0; pki < pickableItems.length; pki++) {
                var pItem = pickableItems[pki];
                if (pItem && pItem.mesh && pItem !== heldItem) lTargets.push(pItem.mesh);
              }
              for (var smi = 0; smi < supportMeshes.length; smi++) {
                var sMesh = supportMeshes[smi];
                if (sMesh && (!heldItem || sMesh !== heldItem.mesh)) lTargets.push(sMesh);
              }
              for (var dmi = 0; dmi < doorHitMeshes.length; dmi++) {
                if (doorHitMeshes[dmi]) lTargets.push(doorHitMeshes[dmi]);
              }
              var ghSlotsLaser = getGreenhouseSlots();
              for (var gsi = 0; gsi < ghSlotsLaser.length; gsi++) {
                if (ghSlotsLaser[gsi] && ghSlotsLaser[gsi].group) lTargets.push(ghSlotsLaser[gsi].group);
              }
              Object.keys(remoteAvatars).forEach(function (rId) {
                var rAv = remoteAvatars[rId];
                if (rAv && rAv.group) lTargets.push(rAv.group);
              });
              window._cachedLaserTargets = lTargets;
            }

            var rawHits = raycaster.intersectObjects(window._cachedLaserTargets, true);
            var lHit = null;
            for (var rhi = 0; rhi < rawHits.length; rhi++) {
              var candH = rawHits[rhi];
              if (!candH.object.userData.ignoreRay &&
                  candH.object !== heldItem.mesh &&
                  candH.object !== thermoLaserLine &&
                  candH.object !== thermoLaserDot) {
                lHit = candH;
                break;
              }
            }

            if (lHit && lHit.distance < 35.0) {
              var lArr = thermoLaserLine.geometry.attributes.position.array;
              lArr[0] = _tmpMuzzlePos.x; lArr[1] = _tmpMuzzlePos.y; lArr[2] = _tmpMuzzlePos.z;
              lArr[3] = lHit.point.x; lArr[4] = lHit.point.y; lArr[5] = lHit.point.z;
              thermoLaserLine.geometry.attributes.position.needsUpdate = true;
              thermoLaserLine.visible = true;

              var lNorm = lHit.face ? lHit.face.normal.clone().transformDirection(lHit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
              thermoLaserDot.position.copy(lHit.point).addScaledVector(lNorm, 0.005);
              thermoLaserDot.lookAt(lHit.point.clone().add(lNorm));
              thermoLaserDot.visible = true;

              // Simulação física de temperatura para cada objeto / material
              var sTemp = 23.4;
              var sLbl = '';
              var hObj = lHit.object;

              for (var bi = 0; bi < burnerDevices.length; bi++) {
                var bd = burnerDevices[bi];
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
                for (var cpi = 0; cpi < cookerPots.length; cpi++) {
                  var cp = cookerPots[cpi];
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
                  sTemp = (stirrerDevices[0] && stirrerDevices[0].on) ? 34.5 : 23.8;
                  sLbl = 'Agitador Magnético';
                } else if (hObj.userData.remotePlayer || (hObj.parent && hObj.parent.userData.remotePlayer)) {
                  sTemp = 36.7 + Math.sin(clock.elapsedTime * 1.3) * 0.2;
                  sLbl = 'Jogador (Corporal)';
                } else if (hObj.userData.doorObj) {
                  sTemp = 22.8;
                  sLbl = hObj.userData.doorObj.label || 'Porta';
                } else {
                  var pWalk = hObj;
                  var pNode = null;
                  while (pWalk) {
                    if (pWalk.userData && pWalk.userData.pickableId) { pNode = pWalk; break; }
                    pWalk = pWalk.parent;
                  }
                  if (pNode) {
                    var pid = pNode.userData.pickableId;
                    sLbl = pNode.userData.pickableLabel || pid;
                    if (pid.indexOf('heat_sealer') === 0) sTemp = 165.0 + Math.sin(clock.elapsedTime * 2.5) * 1.2;
                    else if (pid.indexOf('laminar_hood') === 0) sTemp = (hoodAirData && hoodAirData.on) ? 21.2 : 23.5;
                    else if (pid.indexOf('precision_scale') === 0) sTemp = 24.1;
                    else if (pid.indexOf('alcohol_spray') === 0) sTemp = 20.2;
                    else if (pid.indexOf('liquid_culture') === 0) sTemp = 24.5 + Math.sin(clock.elapsedTime * 2.0) * 0.2;
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
                    sTemp = 20.5 + Math.cos(clock.elapsedTime * 1.5) * 0.3;
                    sLbl = 'Estufa de Frutificação';
                  } else {
                    sTemp = 23.2 + Math.sin(lHit.point.x * 0.5 + lHit.point.z * 0.3) * 0.4;
                    sLbl = lHit.point.y > 0.6 ? 'Bancada / Estrutura' : 'Piso';
                  }
                }
              }
              thermoTargetTemp = sTemp;
              thermoTargetLabel = sLbl;
            } else {
              // Raycast matemático contra o terreno / lago / céu quando não acerta móveis/itens
              var rOrig = raycaster.ray.origin;
              var rDir = raycaster.ray.direction;
              var gHitPt = null;
              for (var stepD = 1.0; stepD <= 32.0; stepD += 1.0) {
                var sx = rOrig.x + rDir.x * stepD;
                var sy = rOrig.y + rDir.y * stepD;
                var sz = rOrig.z + rDir.z * stepD;
                var gy = getGroundHeight(sx, sz, sy + 1.0);
                if (sy <= gy) {
                  gHitPt = new THREE.Vector3(sx, gy, sz);
                  break;
                }
              }
              if (gHitPt) {
                var lArrG = thermoLaserLine.geometry.attributes.position.array;
                lArrG[0] = _tmpMuzzlePos.x; lArrG[1] = _tmpMuzzlePos.y; lArrG[2] = _tmpMuzzlePos.z;
                lArrG[3] = gHitPt.x; lArrG[4] = gHitPt.y; lArrG[5] = gHitPt.z;
                thermoLaserLine.geometry.attributes.position.needsUpdate = true;
                thermoLaserLine.visible = true;
                thermoLaserDot.position.set(gHitPt.x, gHitPt.y + 0.008, gHitPt.z);
                thermoLaserDot.lookAt(gHitPt.x, gHitPt.y + 1, gHitPt.z);
                thermoLaserDot.visible = true;

                var isLake = (Math.hypot(gHitPt.x, gHitPt.z - 48) < 17) || gHitPt.y < 0.05;
                if (isLake) {
                  thermoTargetTemp = 19.2;
                  thermoTargetLabel = 'Água do Lago';
                } else if (weatherMode === 'snow') {
                  thermoTargetTemp = 1.5;
                  thermoTargetLabel = 'Solo com Neve';
                } else if (weatherMode === 'rain') {
                  thermoTargetTemp = 17.4;
                  thermoTargetLabel = 'Solo Molhado';
                } else {
                  var sunBoost = Math.max(0, Math.sin((getVirtualDayFrac() - 0.25) * Math.PI * 2)) * 8.5;
                  thermoTargetTemp = 18.8 + sunBoost + Math.sin(gHitPt.x * 0.2 + gHitPt.z * 0.2) * 0.4;
                  thermoTargetLabel = (Math.abs(gHitPt.x) < 13 && Math.abs(gHitPt.z) < 13) ? 'Piso da Praça' : 'Grama / Terreno';
                }
              } else {
                var skyEnd = rOrig.clone().addScaledVector(rDir, 22.0);
                var lArrS = thermoLaserLine.geometry.attributes.position.array;
                lArrS[0] = _tmpMuzzlePos.x; lArrS[1] = _tmpMuzzlePos.y; lArrS[2] = _tmpMuzzlePos.z;
                lArrS[3] = skyEnd.x; lArrS[4] = skyEnd.y; lArrS[5] = skyEnd.z;
                thermoLaserLine.geometry.attributes.position.needsUpdate = true;
                thermoLaserLine.visible = true;
                thermoLaserDot.visible = false;
                thermoTargetTemp = weatherMode === 'snow' ? -6.5 : 4.2;
                thermoTargetLabel = 'Céu Aberto';
              }
            }
            thermoCurrentTemp += (thermoTargetTemp - thermoCurrentTemp) * Math.min(1, dt * 14);
            drawThermoScreen(thermoCurrentTemp, 'SCAN');
          }
        } else {
          heldItem.mesh.rotation.set(0, heldRotY, 0);
        }

        if (heldItem.trayContents && heldItem.trayContents.length) {
          var hRy = heldItem.mesh.rotation.y;
          var ch = Math.cos(hRy), sh = Math.sin(hRy);
          var hp = heldItem.mesh.position;
          for (var tci = 0; tci < heldItem.trayContents.length; tci++) {
            var tc = heldItem.trayContents[tci];
            if (!tc.item || !tc.item.mesh) continue;
            tc.item.mesh.position.set(
              hp.x + tc.lx * ch + tc.lz * sh,
              hp.y + tc.ly,
              hp.z - tc.lx * sh + tc.lz * ch
            );
            tc.item.mesh.rotation.set(0, hRy + tc.lry, 0);
          }
        }

        // Animação da Seringa furando o septo de borracha vermelha (agulha apontada para baixo)
        if (heldItem.mesh.userData.isSyringe) {
          var activeSyrItem = (hoveredSyringeTarget && hoveredSyringeTarget.item && hoveredSyringeTarget.item.mesh.userData.liquidCtrl)
            ? hoveredSyringeTarget.item
            : ((syringePumping && syringePumping.target && syringePumping.target.item && syringePumping.target.item.mesh.userData.liquidCtrl) ? syringePumping.target.item : null);
          var isPuncturing = !!activeSyrItem;
          if (activeSyrItem) lastSyringeTargetItem = activeSyrItem;
          syringePunctureProgress += ((isPuncturing ? 1 : 0) - syringePunctureProgress) * Math.min(1, dt * 10);
          if (syringePunctureProgress > 0.01 && lastSyringeTargetItem) {
            var sTgt = lastSyringeTargetItem;
            // Septo vermelho na tampa do frasco
            _tmpSyrPort.set(0.036, 0.290, 0).applyEuler(sTgt.mesh.rotation).add(sTgt.mesh.position);
            // Gira em Z (-1.48 rad) para que a agulha fique apontada para baixo dentro do septo
            var tgtRotX = 0.08 * syringePunctureProgress;
            var tgtRotY = playerYaw * (1 - syringePunctureProgress) + (sTgt.mesh.rotation.y + Math.PI * 0.5) * syringePunctureProgress;
            var tgtRotZ = -1.48 * syringePunctureProgress;
            heldItem.mesh.rotation.set(tgtRotX, tgtRotY, tgtRotZ);

            // Calcula a posição exata para a ponta da agulha (local 0.12, 0.022, 0) encaixar no septo
            _tmpSyrOff.set(0.12, 0.022, 0).applyEuler(heldItem.mesh.rotation);
            _tmpSyrHand.copy(_tmpSyrPort).sub(_tmpSyrOff);
            _tmpSyrHand.y -= 0.018 * syringePunctureProgress; // agulha penetra levemente no septo
            _tmpHandPos.lerp(_tmpSyrHand, syringePunctureProgress);
            heldItem.mesh.position.copy(_tmpHandPos);

            if (fpsArmGroup) {
              // Mantém o braço próximo do corpo do jogador (sem tampar o frasco) enquanto a seringa vai ao septo
              fpsArmGroup.position.set(
                0.32 - 0.04 * syringePunctureProgress,
                -0.28 - 0.04 * syringePunctureProgress,
                -0.42 - 0.04 * syringePunctureProgress
              );
              fpsArmGroup.rotation.set(
                0.18 + 0.14 * syringePunctureProgress,
                -0.14 + 0.04 * syringePunctureProgress,
                0.05
              );
            }
          } else if (syringePunctureProgress <= 0.01) {
            syringePunctureProgress = 0;
            lastSyringeTargetItem = null;
          }
        }

        if (heldItem.lidItem && heldItem.lidItem.isAttached) {
          var lidObj = heldItem.lidItem.mesh;
          lidObj.position.set(_tmpHandPos.x, _tmpHandPos.y + 0.36, _tmpHandPos.z);
          lidObj.rotation.copy(heldItem.mesh.rotation);
        }
      } else {
        if (thermoLaserLine && thermoLaserLine.visible) thermoLaserLine.visible = false;
        if (thermoLaserDot && thermoLaserDot.visible) thermoLaserDot.visible = false;
      }

      // Processo de bombeamento contínuo da seringa de 2 segundos (0% a 100%)
      if (syringePumping) {
        if (!heldItem || !heldItem.mesh.userData.isSyringe) {
          syringePumping = null;
        } else if (syringePumping.target.item && syringePumping.target.item.mesh.position.distanceTo(playerPos) > 4.5) {
          syringePumping = null;
          if (callbacks.onToast) callbacks.onToast('💉 Bombeamento cancelado: você se afastou do recipiente.');
        }
      }
      if (syringePumping && heldItem && heldItem.mesh.userData.isSyringe) {
        syringePumping.elapsed += dt;
        var pRatio = Math.min(1, syringePumping.elapsed / syringePumping.duration);
        var pSmooth = pRatio * pRatio * (3 - 2 * pRatio); // ease-in-out suave
        var curVol = THREE.MathUtils.lerp(syringePumping.fromVol, syringePumping.toVol, pSmooth);
        updateSyringeVolume(heldItem, curVol);
        if (syringePumping.target.item && syringePumping.target.item.mesh.userData.liquidCtrl) {
          var dHeld = curVol - syringePumping.fromVol;
          var newJVol = Math.max(0, syringePumping.startJarVol - dHeld);
          updateContainerVolume(syringePumping.target.item, newJVol);
        }
        if (pRatio >= 1.0) {
          updateSyringeVolume(heldItem, syringePumping.toVol);
          if (syringePumping.target.item && syringePumping.target.item.mesh.userData.liquidCtrl) {
            var finalD = syringePumping.toVol - syringePumping.fromVol;
            updateContainerVolume(syringePumping.target.item, Math.max(0, syringePumping.startJarVol - finalD));
          } else if (syringePumping.target.item && syringePumping.target.item.spawnCtrl) {
            var spTarget = syringePumping.target.item;
            var spCtrl = spTarget.spawnCtrl;
            var isAseptic = !!(hoodAirData && hoodAirData.on && performance.now() < hoodSanitizedUntil);
            spCtrl.inoculated = true;
            if (!isAseptic && Math.random() < 0.45) {
              spCtrl.contaminated = true;
              if (callbacks.onToast) callbacks.onToast('🦠 Contaminação! Lembre de ligar e higienizar o Fluxo Laminar com Álcool 70% antes de inocular!');
            } else {
              if (callbacks.onToast) callbacks.onToast('💉 ' + spCtrl.baseLabel + ' inoculado com sucesso! Micélio em colonização.');
            }
            spCtrl.updateVisual();
          } else if (syringePumping.target.item && syringePumping.target.item.mesh.userData.isPetri) {
            if (callbacks.onToast) callbacks.onToast('🧫 Placa de Petri inoculada com Cultura Líquida!');
          }
          if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
          if (callbacks.onLabStep) callbacks.onLabStep('syringe_use');
          notifyWorldAction();
          syringePumping = null;
        }
      }
      if (sportBalls.length) {
        for (var sbi = 0; sbi < sportBalls.length; sbi++) {
          var sb = sportBalls[sbi];
          var bPos = sb.mesh.position;
          if (sb.goalCooldown > 0) {
            sb.goalCooldown -= dt;
            if (sb.goalCooldown <= 0) {
              bPos.set(sb.homeX, sb.groundY + sb.r, sb.homeZ);
              sb.vx = 0; sb.vy = 0; sb.vz = 0;
            }
          }
          var bdx = bPos.x - playerPos.x;
          var bdz = bPos.z - playerPos.z;
          var bDistSq = bdx * bdx + bdz * bdz;
          var touchR = 0.42 + sb.r;
          if (bDistSq < touchR * touchR && Math.abs(playerPos.y - bPos.y) < 1.25) {
            var bDist = Math.sqrt(bDistSq) || 0.01;
            var nx = bdx / bDist;
            var nz = bdz / bDist;
            var pSpeed = Math.hypot(playerVelX, playerVelZ);
            var kickPow = Math.max(4.5, pSpeed * 1.65);
            sb.vx = nx * kickPow;
            sb.vz = nz * kickPow;
            sb.vy = Math.max(sb.vy, sb.bounceUp * (pSpeed > 1 ? 1.0 : 0.6));
            bPos.x = playerPos.x + nx * (touchR + 0.03);
            bPos.z = playerPos.z + nz * (touchR + 0.03);
            if (window.MycoAudio) window.MycoAudio.playClick();
          }
          sb.vy -= 14.0 * dt;
          bPos.x += sb.vx * dt;
          bPos.y += sb.vy * dt;
          bPos.z += sb.vz * dt;
          var floorY = sb.groundY + sb.r;
          if (bPos.y <= floorY) {
            bPos.y = floorY;
            if (Math.abs(sb.vy) > 0.8) {
              sb.vy = -sb.vy * 0.62;
            } else {
              sb.vy = 0;
            }
            var fric = Math.pow(0.18, dt);
            sb.vx *= fric;
            sb.vz *= fric;
          } else {
            var airFric = Math.pow(0.75, dt);
            sb.vx *= airFric;
            sb.vz *= airFric;
          }
          if (sb.kind === 'soccer' && sb.goalCooldown <= 0 && (bPos.x < -61.2 || bPos.x > -38.8) && Math.abs(bPos.z - (-15)) < 2.1 && bPos.y < 2.1) {
            sb.goalCooldown = 1.6;
            triggerConfettiBurst(bPos.x, bPos.y + 0.6, bPos.z);
            if (window.MycoAudio) window.MycoAudio.playHarvest();
            if (callbacks.onToast) callbacks.onToast('⚽ GOOOOL! 🎉');
          }
          if (bPos.x < sb.minX) { bPos.x = sb.minX; sb.vx = Math.abs(sb.vx) * 0.7; }
          if (bPos.x > sb.maxX) { bPos.x = sb.maxX; sb.vx = -Math.abs(sb.vx) * 0.7; }
          if (bPos.z < sb.minZ) { bPos.z = sb.minZ; sb.vz = Math.abs(sb.vz) * 0.7; }
          if (bPos.z > sb.maxZ) { bPos.z = sb.maxZ; sb.vz = -Math.abs(sb.vz) * 0.7; }
          sb.mesh.rotation.z -= (sb.vx * dt) / sb.r;
          sb.mesh.rotation.x += (sb.vz * dt) / sb.r;
        }
      }
      if (localAvatar) {
        localAvatar.group.visible = true;
        if (auraEnabled) animateAvatarAura(localAvatar, clock.elapsedTime);
        // Desloca 0.14m para tras para enxergar as proprias pernas ao olhar para baixo e projetar sombra inteira!
        var backOff = seatedSeat ? 0.02 : 0.14;
        localAvatar.group.position.set(
          playerPos.x + Math.sin(playerYaw) * backOff,
          playerPos.y,
          playerPos.z + Math.cos(playerYaw) * backOff
        );
        localAvatar.group.rotation.y = playerYaw;
        if (seatedSeat) {
          if (localAvatar.torso) {
            localAvatar.torso.visible = false;
            localAvatar.torso.position.set(0, 0.60, 0);
          }
          localAvatar.leftLeg.position.set(-0.11, 0.41, 0);
          localAvatar.rightLeg.position.set(0.11, 0.41, 0);
          localAvatar.leftLeg.rotation.x = Math.PI / 2;
          localAvatar.rightLeg.rotation.x = Math.PI / 2;
        } else {
          if (localAvatar.torso) {
            localAvatar.torso.visible = true;
            localAvatar.torso.position.set(0, 0.64, 0);
          }
          localAvatar.leftLeg.position.set(-0.10, 0.38, 0);
          localAvatar.rightLeg.position.set(0.10, 0.38, 0);
          if (isWalking) {
            localAvatar.walkPhase += dt * 10;
            localAvatar.leftLeg.rotation.x = Math.sin(localAvatar.walkPhase) * 0.55;
            localAvatar.rightLeg.rotation.x = -Math.sin(localAvatar.walkPhase) * 0.55;
          } else {
            localAvatar.leftLeg.rotation.x *= 0.8;
            localAvatar.rightLeg.rotation.x *= 0.8;
          }
        }
        localAvatar.headGroup.visible = false; // nunca tampa a visao em 1a pessoa ao olhar para baixo
        localAvatar.leftArm.visible = false;
        localAvatar.rightArm.visible = false; // usa os bracos 1a pessoa detalhados
      }
    } else {
      if (fpsArmGroup) fpsArmGroup.visible = false;
      if (fpsLeftArmGroup) fpsLeftArmGroup.visible = false;
      if (localAvatar) localAvatar.group.visible = false;
      isWalking = false;
      controls.update();
    }

    if (!lobbyTourActive) {
      var isDrawingBoard = (typeof touchDrawingBoard !== 'undefined') ? touchDrawingBoard : false;
      if (!isDrawingBoard && (!isTouchDevice() || isPrimaryDown || (heldItem && now - lastMobileHoverAt > 45) || (now - lastMobileHoverAt > 260))) {
        lastMobileHoverAt = now;
        updateHoverRay();
      }
      // Desenho ou apagamento continuo na lousa enquanto segura o clique perto dela
      var toolColor = getHeldBoardToolColor();
      var activeBoard = chalkboards[hoveredBoardIndex];
      if (isPrimaryDown && hoveredBoardHit && toolColor && activeBoard) {
        var px = Math.round(hoveredBoardHit.uv.x * 512 * 10) / 10;
        var py = Math.round((1 - hoveredBoardHit.uv.y) * 256 * 10) / 10;
        var curPt = [px, py];
        if (!currentStroke || currentStroke.c !== toolColor || currentStroke.b !== hoveredBoardIndex) {
          flushCurrentStroke();
          currentStroke = { b: hoveredBoardIndex, c: toolColor, pts: [curPt] };
          drawBoardSegment(activeBoard.ctx, toolColor, curPt, curPt);
          activeBoard.tex.needsUpdate = true;
          lastDrawPt = curPt;
        } else if (!lastDrawPt || Math.hypot(curPt[0] - lastDrawPt[0], curPt[1] - lastDrawPt[1]) >= 2.5) {
          drawBoardSegment(activeBoard.ctx, toolColor, lastDrawPt || curPt, curPt);
          activeBoard.tex.needsUpdate = true;
          currentStroke.pts.push(curPt);
          lastDrawPt = curPt;
          if (currentStroke.pts.length >= 60) {
            flushCurrentStroke();
            currentStroke = { b: hoveredBoardIndex, c: toolColor, pts: [curPt] };
            lastDrawPt = curPt;
          }
        }
      } else if (currentStroke) {
        flushCurrentStroke();
      }
    }
    if (hoodAirData && hoodAirData.on && hoodAirData.attr) {
      var aArr = hoodAirData.attr.array;
      for (var ai = 0; ai < aArr.length; ai += 3) {
        aArr[ai] += dt * 1.45;
        if (aArr[ai] > 0.78) {
          aArr[ai] = -0.36;
          aArr[ai + 1] = 0.10 + Math.random() * 0.85;
          aArr[ai + 2] = (Math.random() - 0.5) * 2.0;
        }
      }
      hoodAirData.attr.needsUpdate = true;
    }
    if (stirrerDevices.length) {
      for (var si = 0; si < pickableItems.length; si++) {
        var liqIt = pickableItems[si];
        var lcCtrl = liqIt.mesh && liqIt.mesh.userData.liquidCtrl;
        if (!lcCtrl || !lcCtrl.stirBar) continue;
        var lx = liqIt.mesh.position.x, ly = liqIt.mesh.position.y, lz = liqIt.mesh.position.z;
        for (var sj = 0; sj < stirrerDevices.length; sj++) {
          var st = stirrerDevices[sj];
          if (st.on && lx >= st.surface.minX && lx <= st.surface.maxX && lz >= st.surface.minZ && lz <= st.surface.maxZ && Math.abs(ly - st.surface.topY) < 0.08) {
            lcCtrl.stirBar.rotation.y += dt * 18;
            if (lcCtrl.mycCloud) lcCtrl.mycCloud.rotation.y += dt * 4.5;
            break;
          }
        }
      }
    }
    if (scaleDevices.length && (!animate._lastScaleAt || now - animate._lastScaleAt > 150)) {
      animate._lastScaleAt = now;
      for (var sci = 0; sci < scaleDevices.length; sci++) {
        var scObj = scaleDevices[sci];
        var gross = 0;
        for (var pi = 0; pi < pickableItems.length; pi++) {
          var pIt = pickableItems[pi];
          if (heldItem === pIt || pIt.mesh.userData.tableDims || pIt.potItem) continue;
          var px0 = pIt.mesh.position.x, py0 = pIt.mesh.position.y, pz0 = pIt.mesh.position.z;
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
    if (cookerPots.length) {
      var anyPotSteaming = false;
      for (var bni = 0; bni < burnerDevices.length; bni++) {
        var bnd = burnerDevices[bni];
        bnd.heat = bnd.on ? Math.min(1, (bnd.heat || 0) + dt * 0.55) : Math.max(0, (bnd.heat || 0) - dt * 0.25);
        var h = bnd.heat;
        var pulse = h > 0.2 ? Math.sin(clock.elapsedTime * 5.0) * 0.08 * h : 0;
        bnd.coilMat.emissiveIntensity = h * 2.2 + pulse;
        bnd.coilMat.color.setRGB(0.39 + h * 0.55, 0.45 - h * 0.30, 0.55 - h * 0.48);
        if (bnd.reflectorMat) bnd.reflectorMat.emissiveIntensity = h * 0.28;
      }
      var nearestSteamDist = Infinity;
      var bestSteamFactor = 0;
      for (var cpi = 0; cpi < cookerPots.length; cpi++) {
        var cp = cookerPots[cpi];
        var potP = cp.potItem.mesh.position;
        var onActiveBurner = false;
        for (var bi = 0; bi < burnerDevices.length; bi++) {
          var bn = burnerDevices[bi];
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

        // Pinos de trava vermelhos sincronizados com a pressão (travados >= 1.5 PSI)
        var isLocked = cp.lidItem.isAttached && cp.psi >= 1.5;
        if (cp.safetyPins) {
          var targetPinY = isLocked ? 0.128 : 0.110;
          for (var pni = 0; pni < cp.safetyPins.length; pni++) {
            cp.safetyPins[pni].position.y += (targetPinY - cp.safetyPins[pni].position.y) * Math.min(1, dt * 10);
          }
        }

        // Animação sincronizada do pino central + vapor + áudio (10..15 PSI)
        var steamFactor = (cp.lidItem.isAttached && cp.psi >= 10.0) ? Math.min(1, (cp.psi - 10.0) / 5.0) : 0;
        if (steamFactor > 0.02) {
          anyPotSteaming = true;
          var sDist = Math.hypot(potP.x - playerPos.x, potP.z - playerPos.z);
          if (sDist < nearestSteamDist) {
            nearestSteamDist = sDist;
            bestSteamFactor = steamFactor;
          }
          cp.steamPoints.visible = true;
          var sa = cp.steamAttr.array;
          var riseSpd = 0.35 + steamFactor * 0.45;
          for (var si = 0; si < sa.length; si += 3) {
            sa[si + 1] += dt * riseSpd;
            if (sa[si + 1] > 0.60) {
              sa[si] = (Math.random() - 0.5) * 0.04;
              sa[si + 1] = 0.17;
              sa[si + 2] = (Math.random() - 0.5) * 0.04;
            }
          }
          cp.steamAttr.needsUpdate = true;
          var wobble = Math.sin(clock.elapsedTime * (20 + steamFactor * 20));
          var lift = Math.abs(wobble) * (0.008 * steamFactor);
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
              for (var ci = 0; ci < cp.contents.length; ci++) {
                var cIt = cp.contents[ci];
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
              for (var bi2 = 0; bi2 < cp.contents.length; bi2++) {
                var bIt = cp.contents[bi2];
                if (bIt.spawnCtrl) {
                  bIt.spawnCtrl.burned = true;
                  bIt.spawnCtrl.sterilized = false;
                  bIt.spawnCtrl.updateVisual();
                }
              }
              if (callbacks.onToast) {
                callbacks.onToast('🔥 Você esqueceu o fogo ligado! Tudo na panela queimou :( Jogue fora!');
              }
            }
          }
        }

        // Indicador 3D acima da panela: mostra UMA etapa clara por vez
        if (cp.statusSprite) {
          var pDist = Math.hypot(potP.x - playerPos.x, potP.z - playerPos.z);
          var showHud = pDist < 10.5 && (cp.burned || cp.temp > 26 || cp.psi > 0.1 || cp.progress > 0);
          cp.statusSprite.visible = showHud;
          if (showHud) {
            var stageTitle = '';
            var stageSub = '';
            var barPct = 0;
            var barCol = '#38bdf8';
            var borderCol = '#38bdf8';

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
                var secLeft = Math.max(0, Math.ceil(16 - cp.overheatTimer));
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

            var hudKey = stageTitle + '|' + stageSub + '|' + barPct + '|' + barCol;
            if (cp.lastHudKey !== hudKey) {
              cp.lastHudKey = hudKey;
              var ctxHud = cp.statusCtx;
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
        var lobbyEl = document.getElementById('campus-lobby');
        var inLobby = lobbyEl && !lobbyEl.classList.contains('hidden');
        var steamVol = (!inLobby && anyPotSteaming && nearestSteamDist < 12)
          ? Math.max(0, Math.min(1, 1 - (nearestSteamDist - 2) / 10)) * (0.45 + 0.55 * bestSteamFactor)
          : 0;
        window.MycoAudio.setSteam(steamVol > 0.01, steamVol);
      }
    }
    if (spawnGrowItems.length) {
      for (var sgi = 0; sgi < spawnGrowItems.length; sgi++) {
        var sgIt = spawnGrowItems[sgi];
        var sc = sgIt.spawnCtrl;
        if (sc && sc.inoculated && sc.colonization < 100) {
          sc.colonization = Math.min(100, sc.colonization + dt * 4.2);
          sc.updateVisual();
        }
      }
    }
    if (sprayBursts.length) {
      for (var sbi = sprayBursts.length - 1; sbi >= 0; sbi--) {
        var sb = sprayBursts[sbi];
        sb.age += dt;
        var sArr = sb.attr.array;
        for (var k = 0; k < sArr.length; k += 3) {
          sArr[k] += sb.dir.x * dt * 2.2;
          sArr[k + 1] += sb.dir.y * dt * 2.2;
          sArr[k + 2] += sb.dir.z * dt * 2.2;
        }
        sb.attr.needsUpdate = true;
        sb.mat.opacity = Math.max(0, 0.85 * (1 - sb.age / 0.45));
        if (sb.age >= 0.45) {
          scene.remove(sb.pts);
          if (sb.pts.geometry && sb.pts.geometry.dispose) sb.pts.geometry.dispose();
          if (sb.mat && sb.mat.dispose) sb.mat.dispose();
          sprayBursts.splice(sbi, 1);
        }
      }
    }
    drawCinemaVideoFrame(dt);
    updateDynamicEnvironment(dt);
    dropUnsupportedItems();

    // Ciclo de cultivo e umidade da Estufa
    var ghSlotsLoop = getGreenhouseSlots();
    for (var gi = 0; gi < ghSlotsLoop.length; gi++) {
      var gSlot = ghSlotsLoop[gi];
      gSlot.humidity = Math.max(20, gSlot.humidity - dt * 0.12);
      if (gSlot.humidity >= 60 && gSlot.stage < 3) {
        gSlot.growth += dt * (gSlot.humidity / 100) * 1.6;
        if (gSlot.growth >= 100) {
          gSlot.stage++;
          gSlot.growth = 0;
          updateGreenhouseSlotMesh(gSlot);
          queueWorldStateChange('greenhouse_slot_' + gSlot.id + '_stage', gSlot.stage);
        }
      }
    }
    stepGreenhouseParticles(dt);
    stepConfetti(dt);

    if (localEmoteTimer > 0) {
      localEmoteTimer -= dt;
      if (isWalking || localEmoteTimer <= 0) {
        localEmote = '';
        localEmoteTimer = 0;
      }
    }

    stepMultiplayerAvatars(dt);
    renderer.render(scene, camera);
  }

  function getCinemaHitTarget(uv) {
    return window.__MYCO_MODULES__.cinema.getCinemaHitTarget(uv, {
      power: cinemaPower,
      lessonIdx: cinemaLessonIdx,
      lessons: cinemaLessons
    });
  }

  function drawCinemaVideoFrame(dt) {
    var st = {
      ctx: cinemaCtx,
      tex: cinemaTex,
      camera: camera,
      power: cinemaPower,
      lessonIdx: cinemaLessonIdx,
      lessons: cinemaLessons,
      playing: cinemaPlaying,
      dirty: cinemaDirty,
      time: cinemaTime,
      hovered: hoveredCinema,
      hoveredUv: hoveredCinemaUv
    };
    window.__MYCO_MODULES__.cinema.drawCinemaVideoFrame(dt, st);
    cinemaTime = st.time;
    cinemaDirty = st.dirty;
  }

  function updateDynamicEnvironment(dt) {
    var env = {
      envTime: envTime,
      getVirtualDayFrac: getVirtualDayFrac,
      lastWeatherMode: lastWeatherMode,
      weatherMode: weatherMode,
      snowMix: snowMix,
      rainbow: { active: rainbowActive, timer: rainbowTimer, duration: rainbowDuration },
      scene: scene,
      sunDisc: sunDisc,
      sunHalo: sunHalo,
      moonDisc: moonDisc,
      starPoints: starPoints,
      envSun: envSun,
      envHemi: envHemi,
      isTouch: isTouchDevice(),
      envCloudMat: envCloudMat,
      envClouds: envClouds,
      terrainSnowMat: terrainSnowMat,
      weatherPoints: weatherPoints,
      weatherPosAttr: weatherPosAttr,
      qualityTier: qualityTier,
      inFps: inFps,
      playerPos: playerPos,
      camera: camera,
      roofZones: roofZones,
      rainbowMesh: rainbowMesh,
      fountainRipples: fountainRipples,
      fountainDropsAttr: fountainDropsAttr
    };
    window.__MYCO_MODULES__.environment.updateDynamicEnvironment(dt, env);
    envTime = env.envTime;
    lastWeatherMode = env.lastWeatherMode;
    weatherMode = env.weatherMode;
    snowMix = env.snowMix;
    rainbowActive = env.rainbow.active;
    rainbowTimer = env.rainbow.timer;
    rainbowDuration = env.rainbow.duration;
  }

  // ---------------- Arco-iris 3D sobre a Montanha ----------------

  function createRainbowMesh() {
    return window.__MYCO_MODULES__.rainbow.createRainbowMesh();
  }

  function triggerCampusRainbow(dur) {
    rainbowActive = true;
    rainbowTimer = 0;
    rainbowDuration = (typeof dur === 'number' && dur > 0) ? dur : 68;
    return 'Arco-íris ativado por ' + rainbowDuration + 's sobre a montanha!';
  }

  // ---------------- Inicializacao & API Publica ----------------

  window.initCampus3D = function (containerId, cbs) {
    callbacks = Object.assign(callbacks, cbs || {});
    var container = document.getElementById(containerId);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x60a5fa);
    scene.fog = new THREE.FogExp2(0xbfdbfe, 0.0022);

    // Arco-iris sobre as montanhas (aparece ao cessar da chuva)
    rainbowMesh = createRainbowMesh();
    scene.add(rainbowMesh);

    // Sol 3D + Halo, Lua 3D, Estrelas e 24 Nuvens dinamicas no ceu
    sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
    );
    sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(14.5, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(5.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false })
    );
    scene.add(sunDisc, sunHalo, moonDisc);

    var starCount = 320;
    var starPos = new Float32Array(starCount * 3);
    for (var st = 0; st < starCount; st++) {
      var sTheta = Math.random() * Math.PI * 2;
      var sPhi = Math.random() * Math.PI * 0.44;
      starPos[st * 3] = Math.cos(sTheta) * Math.cos(sPhi) * 210;
      starPos[st * 3 + 1] = Math.sin(sPhi) * 210 + 18;
      starPos[st * 3 + 2] = Math.sin(sTheta) * Math.cos(sPhi) * 210;
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf8fafc, size: 1.4, transparent: true, opacity: 0, fog: false }));
    scene.add(starPoints);

    envCloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, emissive: 0xe0f2fe, emissiveIntensity: 0.22 });
    for (var cl = 0; cl < 24; cl++) {
      var cg = new THREE.Group();
      var ca = (cl / 24) * Math.PI * 2;
      cg.position.set(Math.cos(ca) * (55 + (cl % 4) * 24), 30 + (cl % 5) * 4.5, Math.sin(ca) * (55 + (cl % 4) * 24));
      for (var cp = 0; cp < 3; cp++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(5 + (cp % 2) * 2.5, 10, 8), envCloudMat);
        puff.position.set((cp - 1) * 5.2, (cp % 2) * 1.4, 0);
        puff.scale.set(1.3, 0.65, 1.0);
        cg.add(puff);
      }
      scene.add(cg);
      envClouds.push(cg);
    }

    // Particulas dinamicas de Chuva / Neve
    var wCount = 800;
    var wPositions = new Float32Array(wCount * 3);
    for (var wi = 0; wi < wCount; wi++) {
      wPositions[wi * 3] = (Math.random() - 0.5) * 60;
      wPositions[wi * 3 + 1] = Math.random() * 28;
      wPositions[wi * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    var wGeo = new THREE.BufferGeometry();
    weatherPosAttr = new THREE.BufferAttribute(wPositions, 3);
    wGeo.setAttribute('position', weatherPosAttr);
    weatherPoints = new THREE.Points(wGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.78 }));
    weatherPoints.visible = false;
    weatherPoints.frustumCulled = false;
    scene.add(weatherPoints);

    var touch = isTouchDevice();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, touch ? 210 : 440);
    camera.position.set(-14, 16, 26);

    renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.0 : 1.5));
    renderer.shadowMap.enabled = !touch;
    renderer.shadowMap.type = touch ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Exposição equilibrada: mantém paredes com contraste e bancadas nítidas
      renderer.toneMappingExposure = touch ? 1.08 : 1.02;
    }
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 4;
    controls.maxDistance = 65;
    controls.target.set(0, 4.5, -14);

    // Luz ambiente moderada para preservar contraste das paredes e destacar a luz das bancadas
    var hemi = new THREE.HemisphereLight(0xe0f2fe, 0x475569, touch ? 0.68 : 0.56);
    scene.add(hemi);
    envHemi = hemi;
    var sun = new THREE.DirectionalLight(0xfffbeb, touch ? 1.05 : 0.95);
    sun.position.set(45, 65, 38);
    sun.castShadow = !touch;
    var shSize = touch ? 768 : 1536;
    sun.shadow.mapSize.set(shSize, shSize);
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.far = 220;
    scene.add(sun);
    envSun = sun;

    clock = new THREE.Clock();
    createProceduralTextures();
    buildNatureWorld();
    buildPlaza();
    buildStaircaseAndBridge();
    buildClockTowerAndAuditorium();
    buildCampusWingsAndEquipment();
    buildOuterCampus();
    buildFirstPersonArm();
    localAvatar = buildCuteAvatar({ isLocal: true, hat_color: '#d9534f', body_color: '#4f46e5' });
    localAvatar.group.visible = false;
    createPlacementGhost();
    createThermoLaserFx();
    initConfettiSystem();
    initGreenhouseParticlePools();
    bindControls();
    applyQualityTier(touch ? 'medium' : 'high');
    animate();
  };

  window.setCampusFpsMode = function (enable) {
    lobbyTourActive = false;
    inFps = !!enable;
    controls.enabled = !inFps;
    if (!inFps && document.pointerLockElement) document.exitPointerLock();
    if (inFps) {
      camera.up.set(0, 1, 0);
      camera.rotation.order = 'YXZ';
      camera.rotation.z = 0;
      playerPos.y = getGroundHeight(playerPos.x, playerPos.z, playerPos.y);
    } else if (fpsArmGroup) {
      fpsArmGroup.visible = false;
    }
    if (callbacks.onFpsChange) callbacks.onFpsChange(inFps);
  };

  window.triggerCampusJump = function () {
    if (!inFps) return;
    if (seatedSeat) {
      seatedSeat = null;
      playerVelY = 6.2;
      onGround = false;
      return;
    }
    var now = performance.now();
    jumpBufferUntil = now + 150;
    if (onGround || (now - lastGroundedAt < 150 && playerVelY <= 0)) {
      playerVelY = 6.2;
      onGround = false;
      lastGroundedAt = 0;
      jumpBufferUntil = 0;
    }
  };

  window.setCampusJumpHeld = function (held) {
    jumpHeld = !!held;
    if (jumpHeld) window.triggerCampusJump();
  };

  window.setCampusSprint = function (active) {
    mobileSprint = !!active;
  };

  window.clearCampusKeys = function () {
    Object.keys(keys).forEach(function (k) { keys[k] = false; });
    isPrimaryDown = false;
    jumpHeld = false;
    flushCurrentStroke();
  };

  window.rotateCampusHeldItem = function (deltaRad) {
    if (heldItem) heldRotY += (typeof deltaRad === 'number' ? deltaRad : Math.PI / 4);
  };

  window.setCampusJoystick = function (dx, dy) {
    joyX = dx; joyY = dy;
  };

  window.getCampusPlayerPose = function () {
    var gY = getGroundHeight(playerPos.x, playerPos.z, playerPos.y);
    var inAir = playerPos.y > gY + 0.18;
    return {
      x: playerPos.x, y: playerPos.y, z: playerPos.z,
      vx: Math.round(playerVelX * 100) / 100,
      vz: Math.round(playerVelZ * 100) / 100,
      yaw: playerYaw, pitch: playerPitch,
      holding_item: heldItem ? heldItem.id : '',
      walking: isWalking, seated: !!seatedSeat, in_fps: inFps,
      toy_mode: (paragliderActive && inAir) ? 'paraglider' : (snowboardActive ? 'snowboard' : ''),
      current_hat: localHat,
      emote: localEmote
    };
  };

  window.setCampusQualityMode = function (mode) {
    if (mode === 'auto' || qualityTiersOrder.indexOf(mode) !== -1) {
      qualityMode = mode;
      lowFpsStreak = 0;
      highFpsStreak = 0;
      if (mode === 'auto') {
        applyQualityTier(isTouchDevice() ? 'medium' : 'high');
      } else {
        applyQualityTier(mode);
      }
    }
  };

  window.getCampusQualityState = function () {
    var q = window.__MYCO_MODULES__.quality.qualityState;
    return { mode: qualityMode, tier: qualityTier, fps: q.currentFps };
  };

  window.playCampusEmote = function (name) {
    localEmote = name || '';
    localEmoteTimer = 4.5;
    if (window.MycoAudio) window.MycoAudio.playEmote(name);
    if (name === 'cheer') {
      triggerConfettiBurst(playerPos.x, playerPos.y, playerPos.z);
    }
  };

  window.setCampusSnowboard = function (active) {
    snowboardActive = !!active;
    if (!snowboardActive && snowboardGroup) snowboardGroup.visible = false;
  };

  window.isCampusSnowboardActive = function () {
    return snowboardActive;
  };

  window.setCampusParaglider = function (active) {
    paragliderActive = !!active;
    if (!paragliderActive && paragliderGroup) paragliderGroup.visible = false;
  };

  window.isCampusParagliderActive = function () {
    return paragliderActive;
  };

  window.setLocalAvatarHat = function (hatId) {
    localHat = hatId || 'default';
    if (localAvatar && localAvatar.hatGroup) {
      buildAvatarHat(localHat, localAvatar.hatMat, localAvatar.hatGroup);
      localAvatar.current_hat = localHat;
    }
  };

  window.consumeCampusMovedItems = function () {
    var list = Object.values(pendingMovedItems);
    pendingMovedItems = {};
    return list;
  };

  window.requeueCampusMovedItems = function (list) {
    (list || []).forEach(function (it) {
      if (it && it.id && !pendingMovedItems[it.id]) pendingMovedItems[it.id] = it;
    });
  };

  window.applyCampusWorldObjects = function (objectsMap) {
    if (!objectsMap) return;
    var now = performance.now();
    // 1o passo: atualiza mesas e fluxo laminar primeiro para que suas superficies de suporte estejam na posicao exata!
    pickableItems.forEach(function (item) {
      if (!item.mesh.userData.updateBounds) return;
      if (heldItem === item || isHeldByRemote(item.id)) return;
      if (pendingMovedItems[item.id]) return;
      if (recentlyDropped[item.id] > now) {
        var svCheck = objectsMap[item.id];
        if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
          delete recentlyDropped[item.id];
        } else if (recentlyDropped[item.id] - now < 13500) {
          // Servidor ainda esta com posicao antiga: reenvia posicao local para nao voltar pro chao!
          pendingMovedItems[item.id] = {
            id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
          };
        }
        return;
      }
      var saved = objectsMap[item.id];
      if (saved) {
        var finalY = saved.y;
        if (!item.mesh.userData.isTable && !item.mesh.userData.isHood) {
          var suppY = getItemGroundHeight(saved.x, saved.z, saved.y, item.mesh.userData.dynamicSurface, saved.y + 0.18);
          for (var si = 0; si < supportSurfaces.length; si++) {
            var s = supportSurfaces[si];
            if (s === item.mesh.userData.dynamicSurface) continue;
            if (saved.x >= s.minX - 0.09 && saved.x <= s.maxX + 0.09 && saved.z >= s.minZ - 0.09 && saved.z <= s.maxZ + 0.09 && saved.y >= s.topY - 0.18) {
              suppY = Math.max(suppY, s.topY);
            }
          }
          if (Math.abs(saved.y - suppY) > 0.04) {
            finalY = suppY;
            pendingMovedItems[item.id] = {
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
    // 2o passo: atualiza os demais itens e tampas de panela sem jamais causar salto/queda em loop ou desacoplar tampa em movimento
    pickableItems.forEach(function (item) {
      if (item.mesh.userData.updateBounds) return;
      if (heldItem === item || isHeldByRemote(item.id)) return;
      if (pendingMovedItems[item.id]) return;
      if (recentlyDropped[item.id] > now) {
        var svCheck = objectsMap[item.id];
        if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
          delete recentlyDropped[item.id];
        } else if (recentlyDropped[item.id] - now < 13500) {
          // Servidor ainda esta com posicao antiga: reenvia posicao local para nao voltar pro chao!
          pendingMovedItems[item.id] = {
            id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
          };
        }
        return;
      }
      if (item.potItem && item.isAttached) {
        var pRef = item.potItem;
        if (heldItem === pRef || isHeldByRemote(pRef.id) || pendingMovedItems[pRef.id] || recentlyDropped[pRef.id] > now) {
          return;
        }
      }
      var saved = objectsMap[item.id];
      if (saved) {
        if (item.potItem) {
          var pot = item.potItem;
          var potSaved = objectsMap[pot.id];
          var refX = potSaved ? potSaved.x : pot.mesh.position.x;
          var refY = potSaved ? potSaved.y : pot.mesh.position.y;
          var refZ = potSaved ? potSaved.z : pot.mesh.position.z;
          var attached = Math.hypot(saved.x - refX, saved.z - refZ) < 0.28 &&
            Math.abs(saved.y - (refY + 0.36)) < 0.28;
          item.isAttached = attached;
          if (attached) {
            item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
            item.mesh.rotation.copy(pot.mesh.rotation);
            item.isMoved = true;
            return;
          }
        }
        var suppY = getItemGroundHeight(saved.x, saved.z, saved.y, item.mesh.userData.dynamicSurface, saved.y + 0.18);
        for (var i = 0; i < supportSurfaces.length; i++) {
          var s = supportSurfaces[i];
          if (saved.x >= s.minX - 0.09 && saved.x <= s.maxX + 0.09 && saved.z >= s.minZ - 0.09 && saved.z <= s.maxZ + 0.09 && saved.y >= s.topY - 0.18) {
            suppY = Math.max(suppY, s.topY);
          }
        }
        var finalY = saved.y;
        if (saved.y < suppY - 0.04 || (!item.mesh.userData.isPetri && saved.y > suppY + 0.08) || Math.abs(saved.y - suppY) < 0.06) {
          finalY = suppY;
          if (Math.abs(saved.y - suppY) > 0.04) {
            pendingMovedItems[item.id] = {
              id: item.id, x: saved.x, y: finalY, z: saved.z, ry: saved.ry || 0
            };
          }
        }
        item.mesh.position.set(saved.x, finalY, saved.z);
        item.mesh.rotation.y = saved.ry || 0;
        item.isMoved = true;
      } else if (item.isMoved) {
        removeFromCookerContents(item);
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        if (item.potItem) item.isAttached = true;
        item.isMoved = false;
      }
    });
  };

  window.resetCampusWorldObjects = function () {
    setHeldTwoHandedGhost(heldItem, false);
    heldItem = null;
    pendingMovedItems = {};
    recentlyDropped = {};
    for (var cpi = 0; cpi < cookerPots.length; cpi++) {
      var cp = cookerPots[cpi];
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
        for (var pni = 0; pni < cp.safetyPins.length; pni++) cp.safetyPins[pni].position.y = 0.110;
      }
    }
    pickableItems.forEach(function (item) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.potItem) item.isAttached = true;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      item.isMoved = false;
    });
    if (callbacks.onHoldChange) callbacks.onHoldChange(null);
  };

  window.resetCampusLocalSession = function () {
    syringePumping = null;
    syringePunctureProgress = 0;
    setHeldTwoHandedGhost(heldItem, false);
    heldItem = null;
    thermoLaserOn = false;
    seatedSeat = null;
    pendingMovedItems = {};
    pendingBoardStrokes = [];
    pendingStateChanges = {};
    recentlyDropped = {};
    if (placementGhost) placementGhost.visible = false;
    if (thermoLaserLine) thermoLaserLine.visible = false;
    if (thermoLaserDot) thermoLaserDot.visible = false;
    playerVelX = 0;
    playerVelY = 0;
    playerVelZ = 0;
    playerPos.set(0, 0, 10.5);
    playerYaw = 0;
    playerPitch = 0;
    if (window.clearCampusKeys) window.clearCampusKeys();
    if (window.MycoAudio) window.MycoAudio.setSteam(false, 0);
    if (callbacks.onHoldChange) callbacks.onHoldChange(null);
  };

  window.consumeCampusBoardStrokes = function () {
    // Transmite os tracos da lousa em tempo real enquanto o jogador desenha (sem precisar esperar soltar o mouse!)
    if (currentStroke && currentStroke.pts.length >= 2) {
      var lastPt = currentStroke.pts[currentStroke.pts.length - 1];
      pendingBoardStrokes.push({
        b: currentStroke.b,
        c: currentStroke.c,
        pts: currentStroke.pts.slice()
      });
      currentStroke.pts = [lastPt];
    }
    var out = pendingBoardStrokes.slice();
    pendingBoardStrokes = [];
    return out;
  };

  window.requeueCampusBoardStrokes = function (strokes) {
    if (!Array.isArray(strokes) || !strokes.length) return;
    pendingBoardStrokes = strokes.concat(pendingBoardStrokes);
  };

  window.applyCampusBoardStrokes = function (strokes) {
    (strokes || []).forEach(applyStrokeToBoard);
  };

  window.consumeCampusStateChanges = function () {
    var out = Object.assign({}, pendingStateChanges);
    pendingStateChanges = {};
    return out;
  };

  window.requeueCampusStateChanges = function (changes) {
    if (!changes || typeof changes !== 'object') return;
    Object.keys(changes).forEach(function (k) {
      if (pendingStateChanges[k] === undefined) {
        pendingStateChanges[k] = changes[k];
      }
    });
  };

  window.applyCampusWorldState = function (stateMap, isInitial) {
    if (!stateMap || typeof stateMap !== 'object') return;
    var now = performance.now();

    // 1. Portas das salas (door_0..door_3)
    for (var di = 0; di < campusDoors.length; di++) {
      var d = campusDoors[di];
      if (!d.id || stateMap[d.id] === undefined) continue;
      if (pendingStateChanges[d.id] !== undefined || recentlyChangedState[d.id] > now) continue;
      var wantOpen = Number(stateMap[d.id]) === 1;
      if (d.open !== wantOpen) {
        d.open = wantOpen;
        if (isInitial) {
          d.angle = d.open ? -d.dir * Math.PI * 0.48 : 0;
          d.pivot.rotation.y = d.angle;
        }
      }
    }

    // 2. Persianas horizontais de todos os vidros (blind_0..blind_15)
    for (var bi = 0; bi < windowBlinds.length; bi++) {
      var b = windowBlinds[bi];
      if (!b.id || stateMap[b.id] === undefined) continue;
      if (pendingStateChanges[b.id] !== undefined || recentlyChangedState[b.id] > now) continue;
      var wantBlindOpen = Number(stateMap[b.id]) === 1;
      if (b.open !== wantBlindOpen) {
        b.open = wantBlindOpen;
      }
    }

    // 3. Interruptores de luz de todas as salas (light_0..light_7)
    for (var li = 0; li < campusLightSwitches.length; li++) {
      var sw = campusLightSwitches[li];
      if (!sw.id || stateMap[sw.id] === undefined) continue;
      if (pendingStateChanges[sw.id] !== undefined || recentlyChangedState[sw.id] > now) continue;
      var wantLightOn = Number(stateMap[sw.id]) !== 0;
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

    // 4. Capela de Fluxo Laminar (hood_lab), Agitador Magnetico (stir_lab) e Fogareiro (burner_lab)
    if (hoodAirData && stateMap.hood_lab !== undefined) {
      if (pendingStateChanges.hood_lab === undefined && !(recentlyChangedState.hood_lab > now)) {
        var wantHoodOn = Number(stateMap.hood_lab) !== 0;
        if (hoodAirData.on !== wantHoodOn) {
          hoodAirData.on = wantHoodOn;
          hoodAirData.points.visible = hoodAirData.on;
          hoodAirData.hepaMat.emissiveIntensity = hoodAirData.on ? 0.45 : 0.04;
          hoodAirData.ledMat.color.setHex(hoodAirData.on ? 0x22c55e : 0xef4444);
          if (hoodAirData.workLight) {
            hoodAirData.workLight.visible = hoodAirData.on;
            hoodAirData.workLight.intensity = hoodAirData.on ? 0.95 : 0;
          }
        }
      }
    }
    if (stirrerDevices.length && stateMap.stir_lab !== undefined) {
      if (pendingStateChanges.stir_lab === undefined && !(recentlyChangedState.stir_lab > now)) {
        var wantStirOn = Number(stateMap.stir_lab) === 1;
        var st0 = stirrerDevices[0];
        if (st0.on !== wantStirOn) {
          st0.on = wantStirOn;
          st0.ledMat.color.setHex(st0.on ? 0x22c55e : 0xef4444);
        }
      }
    }
    if (burnerDevices.length && stateMap.burner_lab !== undefined) {
      if (pendingStateChanges.burner_lab === undefined && !(recentlyChangedState.burner_lab > now)) {
        var wantBurnerOn = Number(stateMap.burner_lab) === 1;
        var bn0 = burnerDevices[0];
        if (bn0.on !== wantBurnerOn) {
          bn0.on = wantBurnerOn;
          bn0.ledMat.color.setHex(bn0.on ? 0x22c55e : 0xef4444);
          if (bn0.knobGroup) bn0.knobGroup.rotation.z = bn0.on ? -1.45 : 0;
        }
      }
    }

    // 5. Tela de Cinema / Aulas do Student Center (cinema_power, cinema_lesson, cinema_playing)
    var cinemaChanged = false;
    if (stateMap.cinema_power !== undefined && pendingStateChanges.cinema_power === undefined && !(recentlyChangedState.cinema_power > now)) {
      var wantPower = Number(stateMap.cinema_power) === 1;
      if (cinemaPower !== wantPower) {
        cinemaPower = wantPower;
        cinemaChanged = true;
      }
    }
    if (stateMap.cinema_lesson !== undefined && pendingStateChanges.cinema_lesson === undefined && !(recentlyChangedState.cinema_lesson > now)) {
      var wantLes = parseInt(stateMap.cinema_lesson, 10);
      if (!isNaN(wantLes) && cinemaLessonIdx !== wantLes) {
        cinemaLessonIdx = wantLes;
        cinemaTime = 0;
        cinemaChanged = true;
      }
    }
    if (stateMap.cinema_playing !== undefined && pendingStateChanges.cinema_playing === undefined && !(recentlyChangedState.cinema_playing > now)) {
      var wantPlay = Number(stateMap.cinema_playing) === 1;
      if (cinemaPlaying !== wantPlay) {
        cinemaPlaying = wantPlay;
        cinemaChanged = true;
      }
    }
    if (cinemaChanged) {
      cinemaDirty = true;
      if (cinemaBeam) cinemaBeam.visible = cinemaPower && (cinemaLessonIdx === -1 || cinemaPlaying);
    }

    // 6. Cogumelos silvestres colhidos (wild_0..wild_31)
    // No servidor: '1' = ativo/disponível no mapa (pronto para colher); '0' = colhido (em cooldown)
    for (var mi = 0; mi < wildMushrooms.length; mi++) {
      var wm = wildMushrooms[mi];
      if (!wm.id || stateMap[wm.id] === undefined) continue;
      if (pendingStateChanges[wm.id] !== undefined || recentlyChangedState[wm.id] > now) continue;
      var isAvailable = Number(stateMap[wm.id]) === 1;
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

    // 7. Bancada de Cultivo da Estufa (greenhouse_slot_0..3)
    var ghSlotsSync = getGreenhouseSlots();
    for (var gi = 0; gi < ghSlotsSync.length; gi++) {
      var slot = ghSlotsSync[gi];
      var kStage = 'greenhouse_slot_' + slot.id + '_stage';
      var kHum = 'greenhouse_slot_' + slot.id + '_humidity';
      if (stateMap[kStage] !== undefined && pendingStateChanges[kStage] === undefined && !(recentlyChangedState[kStage] > now)) {
        var newStage = parseInt(stateMap[kStage], 10);
        if (slot.stage !== newStage) {
          slot.stage = newStage;
          updateGreenhouseSlotMesh(slot);
        }
      }
      if (stateMap[kHum] !== undefined && pendingStateChanges[kHum] === undefined && !(recentlyChangedState[kHum] > now)) {
        var newHum = parseFloat(stateMap[kHum]);
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
      playerPos.set(pose.x, typeof pose.y === 'number' ? pose.y : 0, pose.z);
    }
    if (typeof pose.yaw === 'number') playerYaw = pose.yaw;
    if (typeof pose.pitch === 'number') playerPitch = pose.pitch;
    if (pose.seated) {
      var bestSeat = null, bestD = 1.6;
      for (var i = 0; i < seatMeshes.length; i++) {
        var si = seatMeshes[i].userData.seatInfo;
        if (!si) continue;
        var d = Math.hypot(si.x - playerPos.x, si.z - playerPos.z);
        if (d < bestD && Math.abs(si.y - playerPos.y) < 1.0) {
          bestD = d;
          bestSeat = si;
        }
      }
      if (bestSeat) {
        seatedSeat = bestSeat;
        playerPos.set(bestSeat.x, bestSeat.y, bestSeat.z);
      }
    }
    if (pose.holding && !heldItem) {
      var item = findPickable(pose.holding);
      if (item && !isHeldByRemote(item.id)) {
        removeFromCookerContents(item);
        if (item.potItem && item.isAttached) {
          item.isAttached = false;
        }
        heldItem = item;
        heldRotY = item.mesh.rotation.y;
        setHeldTwoHandedGhost(heldItem, true);
        if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
      }
    }
  };

  window.teleportCampusPlayer = function (x, y, z, yaw) {
    syringePumping = null;
    seatedSeat = null;
    playerVelX = 0;
    playerVelZ = 0;
    playerVelY = 0;
    playerPos.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
    if (typeof yaw === 'number') playerYaw = yaw;
    playerPitch = 0;
    clampPosAgainstWalls(playerPos, 0.35);
    if (window.MycoAudio) window.MycoAudio.playDoor(true);
  };

  window.setCampusPlayerColors = function (hatHex, bodyHex) {
    if (fpsSleeveMat && bodyHex) {
      fpsSleeveMat.color.set(bodyHex);
    }
    if (localAvatar) {
      if (hatHex && localAvatar.hatMat) localAvatar.hatMat.color.set(hatHex);
      if (bodyHex && localAvatar.bodyMat) localAvatar.bodyMat.color.set(bodyHex);
    }
  };

  function drawRankingBoard() {
    return window.__MYCO_MODULES__.staircaseClock.drawRankingBoard();
  }


  window.rotateCampusCamera = function (dx, dy) {
    if (lobbyTourActive) return;
    if (inFps) {
      playerYaw -= dx * 0.0080;
      playerPitch = Math.max(-1.35, Math.min(1.35, playerPitch - dy * 0.0080));
    }
  };

  window.setCampusMobilePrimary = function (down) {
    if (lobbyTourActive) return;
    isPrimaryDown = !!down;
    if (down) {
      if (!heldItem) {
        pointerNdc.set(0, 0);
      }
      updateHoverRay();
      handlePrimaryAction();
    } else {
      flushCurrentStroke();
    }
  };

  window.updateCampusRanking = function (list) {
    window.__MYCO_MODULES__.staircaseClock.setRankingList(list);
  };

  window.setCampusCinemaLessons = function (list) {
    cinemaLessons = Array.isArray(list) ? list : [];
    cinemaDirty = true;
  };

  window.teleportCampusPlayer = function (x, y, z, yaw) {
    if (typeof x !== 'number' || typeof z !== 'number') return;
    if (seatedSeat) seatedSeat = null;
    playerVelY = 0;
    var targetY = (typeof y === 'number' && !isNaN(y)) ? y : getGroundHeight(x, z, playerPos.y);
    playerPos.set(x, targetY, z);
    if (typeof yaw === 'number' && !isNaN(yaw)) {
      playerYaw = yaw;
      if (controls && controls.target) controls.target.set(x, targetY + 1.2, z);
    }
    if (window.MycoAudio) window.MycoAudio.playSwitch();
  };

  window.getCampusPlayerPos = function () {
    return { x: playerPos.x, y: playerPos.y, z: playerPos.z, yaw: playerYaw };
  };

  window.updateCampusAuditoriumSlide = updateCampusAuditoriumSlide;
  window.updateCampusPlayers = updateCampusPlayers;
  window.triggerCampusRainbow = triggerCampusRainbow;
  window.dropCampusHeldItem = dropHeldItem;

  // Namespace unificado MycoCampus para arquitetura limpa e escalabilidade
  window.MycoCampus = window.MycoCampus || {};
  window.MycoCampus.teleportPlayer = window.teleportCampusPlayer;
  window.MycoCampus.getPlayerPos = window.getCampusPlayerPos;
  window.MycoCampus.updateRanking = window.updateCampusRanking;
  window.MycoCampus.updateSlide = updateCampusAuditoriumSlide;
  window.MycoCampus.updatePlayers = updateCampusPlayers;
  window.MycoCampus.setColors = window.setCampusPlayerColors;
  window.MycoCampus.setFpsMode = window.setCampusFpsMode;
  window.MycoCampus.triggerRainbow = triggerCampusRainbow;
  window.MycoCampus.dropHeldItem = dropHeldItem;
})();
