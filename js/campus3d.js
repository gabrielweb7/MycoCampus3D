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

  function buildFirstPersonArm() {
    fpsArmGroup = new THREE.Group();
    fpsSleeveMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.6 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
    var sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.36), fpsSleeveMat);
    sleeve.position.set(0, 0, 0.18);
    var hand = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.13), skinMat);
    hand.position.set(0, 0.01, -0.04);
    fpsArmGroup.add(sleeve, hand);
    fpsArmGroup.position.set(0.32, -0.28, -0.42);
    fpsArmGroup.rotation.set(0.18, -0.14, 0.05);
    fpsArmGroup.visible = false;
    camera.add(fpsArmGroup);

    fpsLeftArmGroup = new THREE.Group();
    var sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.36), fpsSleeveMat);
    sleeveL.position.set(0, 0, 0.18);
    var handL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.13), skinMat);
    handL.position.set(0, 0.01, -0.04);
    fpsLeftArmGroup.add(sleeveL, handL);
    fpsLeftArmGroup.position.set(-0.32, -0.28, -0.42);
    fpsLeftArmGroup.rotation.set(0.18, 0.14, -0.05);
    fpsLeftArmGroup.visible = false;
    camera.add(fpsLeftArmGroup);
    scene.add(camera);
    buildSnowboardRig();
  }

  function buildSnowboardRig() {
    if (snowboardGroup) return;
    snowboardGroup = new THREE.Group();

    // Textura estilizada de snowboard gradiente (ciano -> roxo -> rosa)
    var sbCanvas = document.createElement('canvas');
    sbCanvas.width = 256; sbCanvas.height = 64;
    var sbx = sbCanvas.getContext('2d');
    var grd = sbx.createLinearGradient(0, 0, 256, 64);
    grd.addColorStop(0, '#06b6d4');
    grd.addColorStop(0.5, '#6366f1');
    grd.addColorStop(1, '#ec4899');
    sbx.fillStyle = grd;
    sbx.fillRect(0, 0, 256, 64);
    sbx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    sbx.fillRect(42, 6, 172, 10);
    sbx.fillRect(42, 48, 172, 10);
    sbx.font = 'bold 20px sans-serif';
    sbx.fillStyle = '#ffffff';
    sbx.textAlign = 'center';
    sbx.fillText('MYCORIDE PRO', 128, 39);
    var sbTex = new THREE.CanvasTexture(sbCanvas);

    var deckMat = new THREE.MeshStandardMaterial({ map: sbTex, roughness: 0.25, metalness: 0.2 });
    var darkBootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
    var pantMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

    // Prancha principal (comprimento ao longo de -Z/+Z quando rotacionada em stance lateral)
    var deck = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.028, 1.38), deckMat);
    deck.position.y = 0.02;
    deck.castShadow = true;

    // Bicos levantados (rocker frontal e traseiro)
    var nose = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 0.24), deckMat);
    nose.position.set(0, 0.055, -0.76);
    nose.rotation.x = 0.34;
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 0.24), deckMat);
    tail.position.set(0, 0.055, 0.76);
    tail.rotation.x = -0.34;

    // Fixações e botas em posição lateral de snowboarder (stance diagonal)
    [-0.28, 0.28].forEach(function (fz, idx) {
      var binding = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.16), darkBootMat);
      binding.position.set(0, 0.048, fz);
      binding.rotation.y = idx === 0 ? 0.48 : 0.25;

      var boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.24), darkBootMat);
      boot.position.set(0.02, 0.12, fz);
      boot.rotation.y = idx === 0 ? 0.48 : 0.25;

      var shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.14), pantMat);
      shin.position.set(0.03, 0.34, fz * 0.92);
      shin.rotation.x = idx === 0 ? 0.16 : -0.16;

      snowboardGroup.add(binding, boot, shin);
    });

    snowboardGroup.add(deck, nose, tail);
    snowboardGroup.visible = false;
    scene.add(snowboardGroup);
    buildParagliderRig();
    buildThermalColumns();
  }

  function createParagliderWingMesh(scale) {
    var wg = new THREE.Group();
    var s = scale || 1;
    var panelColors = [0xec4899, 0x8b5cf6, 0x3b82f6, 0x06b6d4, 0xfacc15, 0xf97316, 0xef4444];
    var spanCount = panelColors.length;
    var segW = 0.56 * s;
    for (var i = 0; i < spanCount; i++) {
      var offset = i - (spanCount - 1) / 2;
      var arcX = offset * segW * 0.92;
      var arcY = -Math.pow(Math.abs(offset) / 3.2, 2) * 0.55 * s;
      var tiltZ = -offset * 0.16;
      var cellMat = new THREE.MeshStandardMaterial({
        color: panelColors[i], roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide
      });
      var cell = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.08 * s, 1.35 * s), cellMat);
      cell.position.set(arcX, 2.55 * s + arcY, 0);
      cell.rotation.z = tiltZ;
      wg.add(cell);
    }
    // Tirantes / linhas descendo da asa para as mãos
    var lineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.72 });
    var linePts = [];
    [-1.45 * s, -0.75 * s, 0.75 * s, 1.45 * s].forEach(function (lx) {
      var handX = lx < 0 ? -0.34 * s : 0.34 * s;
      var topY = 2.52 * s - Math.pow(Math.abs(lx) / (1.8 * s), 2) * 0.45 * s;
      linePts.push(lx, topY, -0.38 * s, handX, 0.95 * s, -0.18 * s);
      linePts.push(lx, topY, 0.38 * s, handX, 0.95 * s, -0.18 * s);
    });
    var lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
    wg.add(new THREE.LineSegments(lGeo, lineMat));
    // Batoques (manoplas) esquerdo e direito
    var handleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
    [-0.34 * s, 0.34 * s].forEach(function (hx) {
      var hdl = new THREE.Mesh(new THREE.TorusGeometry(0.055 * s, 0.015 * s, 6, 12), handleMat);
      hdl.position.set(hx, 0.93 * s, -0.18 * s);
      wg.add(hdl);
    });
    return wg;
  }

  function buildParagliderRig() {
    if (paragliderGroup) return;
    paragliderGroup = createParagliderWingMesh(1.0);
    paragliderGroup.visible = false;
    scene.add(paragliderGroup);
  }

  function buildThermalColumns() {
    if (thermalColumns.length) return;
    var spots = [
      { x: 0, z: -135 },
      { x: -70, z: -125 },
      { x: 70, z: -125 },
      { x: 0, z: -72 },
      { x: -105, z: 12 },
      { x: 105, z: 12 }
    ];
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false
    });
    spots.forEach(function (sp) {
      var baseY = terrainHeight(sp.x, sp.z);
      var rings = [];
      for (var r = 0; r < 6; r++) {
        var radius = 4.5 + r * 0.9;
        var rm = new THREE.Mesh(new THREE.RingGeometry(radius - 0.35, radius, 28), ringMat);
        rm.rotation.x = -Math.PI / 2;
        rm.position.set(sp.x, baseY + 3 + r * 14, sp.z);
        rm.userData.ignoreRay = true;
        scene.add(rm);
        rings.push({ mesh: rm, offset: r * 14 });
      }
      thermalColumns.push({ x: sp.x, z: sp.z, baseY: baseY, maxH: 118, radius: 13, rings: rings });
    });
  }

  function drawBoardSegment(ctx, color, p0, p1) {
    if (!ctx) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (color === 'erase') {
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 38;
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4.5;
    }
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
    ctx.restore();
  }

  function applyStrokeToBoard(st) {
    var b = chalkboards[st && st.b ? st.b : 0] || chalkboards[0];
    if (!b || !st || !st.pts || !st.pts.length) return;
    var pts = st.pts;
    for (var i = 0; i < pts.length; i++) {
      var p0 = i === 0 ? pts[0] : pts[i - 1];
      drawBoardSegment(b.ctx, st.c, p0, pts[i]);
    }
    b.tex.needsUpdate = true;
  }

  function getHeldBoardToolColor() {
    if (!heldItem) return null;
    if (heldItem.id.indexOf('chalk_white') === 0) return '#f8fafc';
    if (heldItem.id.indexOf('chalk_green') === 0) return '#4ade80';
    if (heldItem.id.indexOf('chalk_yellow') === 0) return '#facc15';
    if (heldItem.id.indexOf('board_eraser') === 0) return 'erase';
    return null;
  }

  function flushCurrentStroke() {
    if (currentStroke && currentStroke.pts.length > 0) {
      pendingBoardStrokes.push(currentStroke);
    }
    currentStroke = null;
    lastDrawPt = null;
  }

  var placementRing = null;
  var placementDot = null;
  var placementHoloWrap = null;
  var placementHoloMats = [];
  var placementGhostItemId = null;
  var placementGhostHasLid = false;
  var placementGhostLastValid = null;

  var _cGhostGreenTint = new THREE.Color(0x22c55e); // Verde vivo esmeralda
  var _cGhostGreenEmi  = new THREE.Color(0x10b981); // Brilho verde neon
  var _cGhostRedTint   = new THREE.Color(0xef4444); // Vermelho vibrante
  var _cGhostRedEmi    = new THREE.Color(0xdc2626); // Brilho vermelho neon

  function createPlacementGhost() {
    placementGhost = new THREE.Group();
    placementRing = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.142, 48),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
    );
    placementRing.rotation.x = -Math.PI / 2;
    placementRing.position.y = 0.008;
    placementGhost.add(placementRing);

    placementDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.024, 24),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    placementDot.rotation.x = -Math.PI / 2;
    placementDot.position.y = 0.009;
    placementGhost.add(placementDot);

    placementHoloWrap = new THREE.Group();
    placementGhost.add(placementHoloWrap);

    placementGhost.visible = false;
    scene.add(placementGhost);
  }

  function initThermoDisplay() {
    thermoCanvas = document.createElement('canvas');
    thermoCanvas.width = 128;
    thermoCanvas.height = 128;
    thermoCtx = thermoCanvas.getContext('2d');
    thermoTex = new THREE.CanvasTexture(thermoCanvas);
    drawThermoScreen(24.0, 'HOLD');
  }

  var lastDrawnTempStr = '';
  var lastDrawnMode = '';
  function drawThermoScreen(tempVal, modeStr, force) {
    if (!thermoCtx || !thermoTex) return;
    var tStr = (typeof tempVal === 'number' ? tempVal.toFixed(1) : '24.0') + '°C';
    var mStr = modeStr || 'SCAN';
    if (!force && tStr === lastDrawnTempStr && mStr === lastDrawnMode) return;
    lastDrawnTempStr = tStr;
    lastDrawnMode = mStr;
    var ctx = thermoCtx;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(mStr, 10, 22);

    ctx.textAlign = 'right';
    ctx.fillText('⚡ 🔋', 118, 22);

    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tStr, 64, 68);

    ctx.font = 'bold 11px monospace';
    ctx.fillText('ε=0.95  MAX 380°', 64, 98);
    ctx.font = '9px monospace';
    ctx.fillText('INFRARED TEMP', 64, 114);

    thermoTex.needsUpdate = true;
  }

  function createThermoLaserFx() {
    var lineGeo = new THREE.BufferGeometry();
    var linePos = new Float32Array(6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    thermoLaserLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.88, linewidth: 2, depthWrite: false })
    );
    thermoLaserLine.visible = false;
    scene.add(thermoLaserLine);

    var dotGeo = new THREE.CircleGeometry(0.016, 16);
    var dotMat = new THREE.MeshBasicMaterial({
      color: 0xff1133,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    thermoLaserDot = new THREE.Mesh(dotGeo, dotMat);
    thermoLaserDot.visible = false;
    scene.add(thermoLaserDot);
  }

  function prepareGhostCloneMesh(rootGroup, matList) {
    rootGroup.traverse(function (ch) {
      ch.userData.ignoreRay = true;
      ch.userData.supportSurface = null;
      ch.userData.dynamicSurface = null;
      ch.userData.burnerSwitchIdx = null;
      ch.userData.stirSwitch = null;
      ch.userData.hoodSwitch = null;
      ch.userData.scaleObj = null;
      ch.userData.isTable = false;
      ch.userData.isHood = false;
      ch.userData.isBurner = false;
      ch.userData.isStirrer = false;
      if (ch.isPoints) {
        ch.visible = false;
        return;
      }
      if (ch.isMesh && ch.material) {
        ch.castShadow = false;
        ch.receiveShadow = false;
        var cloneOneMat = function (origM) {
          var m = origM.clone();
          m.userData._baseColor = m.color ? m.color.clone() : new THREE.Color(0xffffff);
          m.transparent = true;
          var origOp = origM.transparent ? origM.opacity : 1.0;
          m.opacity = origM.transparent ? Math.max(0.38, origOp * 0.90) : 0.76;
          m.depthWrite = false;
          matList.push(m);
          return m;
        };
        if (Array.isArray(ch.material)) {
          ch.material = ch.material.map(cloneOneMat);
        } else {
          ch.material = cloneOneMat(ch.material);
        }
      }
    });
  }

  function updatePlacementGhostVisual(item, isValid, rotY) {
    if (!placementGhost || !item) return;
    var hasLid = !!(item.lidItem && item.lidItem.isAttached);
    if (placementGhostItemId !== item.id || placementGhostHasLid !== hasLid) {
      while (placementHoloWrap.children.length > 0) {
        placementHoloWrap.remove(placementHoloWrap.children[0]);
      }
      placementHoloMats = [];
      var clone = item.mesh.clone(true);
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.visible = true;
      prepareGhostCloneMesh(clone, placementHoloMats);
      placementHoloWrap.add(clone);

      if (hasLid && item.lidItem && item.lidItem.mesh) {
        var lidClone = item.lidItem.mesh.clone(true);
        lidClone.position.set(0, 0.36, 0);
        lidClone.rotation.set(0, 0, 0);
        lidClone.visible = true;
        prepareGhostCloneMesh(lidClone, placementHoloMats);
        placementHoloWrap.add(lidClone);
      }

      placementGhostItemId = item.id;
      placementGhostHasLid = hasLid;
      placementGhostLastValid = null;
    }
    var col = isValid ? 0x10b981 : 0xef4444;
    placementRing.material.color.setHex(col);
    placementDot.material.color.setHex(col);

    var tintCol = isValid ? _cGhostGreenTint : _cGhostRedTint;
    var emiCol = isValid ? _cGhostGreenEmi : _cGhostRedEmi;
    var tintRatio = isValid ? 0.74 : 0.82; // Efeito verde/vermelho bem evidente e vivo
    var pulse = 0.52 + Math.sin(clock.elapsedTime * 6.0) * 0.16;

    if (placementGhostLastValid !== isValid) {
      placementGhostLastValid = isValid;
      for (var i = 0; i < placementHoloMats.length; i++) {
        var m = placementHoloMats[i];
        if (m.color && m.userData._baseColor) {
          m.color.copy(m.userData._baseColor).lerp(tintCol, tintRatio);
        }
        if (m.emissive) {
          m.emissive.copy(emiCol);
        }
      }
    }

    // Pulso holográfico suave e contínuo no brilho
    for (var j = 0; j < placementHoloMats.length; j++) {
      if (placementHoloMats[j].emissive) {
        placementHoloMats[j].emissiveIntensity = pulse;
      }
    }

    placementHoloWrap.rotation.y = rotY;
    var ringPulse = 1 + Math.sin(clock.elapsedTime * 6.0) * 0.06;
    placementRing.scale.set(ringPulse, ringPulse, 1);
  }

  var _tmpPlacePt = new THREE.Vector3();
  var _tmpPlaceCenter = new THREE.Vector3();
  function findPlacementTarget(customNdc) {
    snapClosePot = null;
    snapPetriStack = false;
    var rayNdc = customNdc || (inFps ? _vZero2 : pointerNdc);
    raycaster.setFromCamera(rayNdc, camera);
    var dir = raycaster.ray.direction;
    var origin = raycaster.ray.origin;
    var bestPt = null;
    var bestT = Infinity;

    // 0. Se estiver segurando uma Tampa de Panela e mirar na Panela aberta (ou na boca dela), encaixa para fechar!
    if (heldItem && heldItem.potItem) {
      for (var cpi = 0; cpi < cookerPots.length; cpi++) {
        var cp = cookerPots[cpi];
        var targetPot = cp.potItem;
        if (targetPot.lidItem && targetPot.lidItem.isAttached && targetPot.lidItem !== heldItem) continue;
        _tmpPlaceCenter.set(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.24, targetPot.mesh.position.z);
        var camDist = origin.distanceTo(_tmpPlaceCenter);
        var potHits = raycaster.intersectObject(targetPot.mesh, true);
        if ((potHits.length > 0 && potHits[0].distance < 4.5) || (camDist < 4.5 && raycaster.ray.distanceSqToPoint(_tmpPlaceCenter) < 0.25)) {
          snapClosePot = targetPot;
          heldRotY = targetPot.mesh.rotation.y;
          return _tmpPlacePt.set(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.36, targetPot.mesh.position.z);
        }
      }
    }

    // 0b. Se estiver segurando uma Placa de Petri e mirar em outra Placa de Petri (pilha max 7 placas!)
    if (heldItem && heldItem.mesh && heldItem.mesh.userData.isPetri) {
      var petriBest = null;
      var petriDist = 4.2;
      for (var pi = 0; pi < pickableItems.length; pi++) {
        var cand = pickableItems[pi];
        if (!cand || cand === heldItem || !cand.mesh || !cand.mesh.userData.isPetri) continue;
        if (isHeldByRemote(cand.id)) continue;
        var cp = cand.mesh.position;
        _tmpPlaceCenter.set(cp.x, cp.y + 0.03, cp.z);
        var dCam = origin.distanceTo(_tmpPlaceCenter);
        if (dCam < petriDist && raycaster.ray.distanceSqToPoint(_tmpPlaceCenter) < 0.045) {
          petriDist = dCam;
          petriBest = cand;
        }
      }
      if (petriBest) {
        var bx = petriBest.mesh.position.x;
        var bz = petriBest.mesh.position.z;
        var stackCount = 0;
        var maxY = petriBest.mesh.position.y;
        for (var pj = 0; pj < pickableItems.length; pj++) {
          var pOther = pickableItems[pj];
          if (!pOther || pOther === heldItem || !pOther.mesh || !pOther.mesh.userData.isPetri) continue;
          if (Math.hypot(pOther.mesh.position.x - bx, pOther.mesh.position.z - bz) < 0.14) {
            stackCount++;
            if (pOther.mesh.position.y > maxY) maxY = pOther.mesh.position.y;
          }
        }
        if (stackCount < 7) {
          snapPetriStack = true;
          return _tmpPlacePt.set(bx, maxY + 0.055, bz);
        }
      }
    }

    // 1. Raycast direto nas meshes de prateleiras, bancadas e mesas (evita atravessar prateleiras de cima!)
    if (supportMeshes.length) {
      for (var sm = 0; sm < supportMeshes.length; sm++) {
        if (supportMeshes[sm]) supportMeshes[sm].updateWorldMatrix(true, false);
      }
      var sHits = raycaster.intersectObjects(supportMeshes, false);
      for (var si = 0; si < sHits.length; si++) {
        var sh = sHits[si];
        if (sh.distance < 0.02 || sh.distance > 5.8) continue;
        if (sh.object.userData.ignoreRay) continue;
        var sSurf = sh.object.userData.supportSurface;
        if (!sSurf) continue;
        if (heldItem && heldItem.mesh) {
          if (heldItem.mesh.userData.dynamicSurface === sSurf) continue;
          if (heldItem.mesh === sh.object || heldItem.mesh.getObjectById(sh.object.id)) continue;
        }
        var cx = Math.max(sSurf.minX + 0.02, Math.min(sSurf.maxX - 0.02, sh.point.x));
        var cz = Math.max(sSurf.minZ + 0.02, Math.min(sSurf.maxZ - 0.02, sh.point.z));
        return new THREE.Vector3(cx, sSurf.topY, cz);
      }
    }

    // 1b. Interseção matemática exata de raio com o plano e volume de cada mesa/bancada/estufa
    for (var i = 0; i < supportSurfaces.length; i++) {
      var s = supportSurfaces[i];
      if (heldItem && heldItem.mesh && heldItem.mesh.userData.dynamicSurface === s) continue;

      // Teste de plano horizontal no topo (s.topY)
      var dy = s.topY - origin.y;
      if (Math.abs(dir.y) > 0.001) {
        var tPlane = dy / dir.y;
        if (tPlane >= 0.05 && tPlane <= 5.8 && tPlane < bestT) {
          var hx = origin.x + dir.x * tPlane;
          var hz = origin.z + dir.z * tPlane;
          if (hx >= s.minX - 0.12 && hx <= s.maxX + 0.12 && hz >= s.minZ - 0.12 && hz <= s.maxZ + 0.12) {
            var cx = Math.max(s.minX + 0.02, Math.min(s.maxX - 0.02, hx));
            var cz = Math.max(s.minZ + 0.02, Math.min(s.maxZ - 0.02, hz));
            bestT = tPlane;
            bestPt = new THREE.Vector3(cx, s.topY, cz);
          }
        }
      }

      // Teste de volume 3D (AABB) da mesa (caso o jogador mire na borda frontal, pernas ou laterais)
      var bMinX = s.minX - 0.05, bMaxX = s.maxX + 0.05;
      var bMinZ = s.minZ - 0.05, bMaxZ = s.maxZ + 0.05;
      var bMinY = Math.max(0.12, s.topY - 0.95), bMaxY = s.topY + 0.08;
      var invDx = 1 / (Math.abs(dir.x) > 1e-6 ? dir.x : 1e-6);
      var invDy = 1 / (Math.abs(dir.y) > 1e-6 ? dir.y : 1e-6);
      var invDz = 1 / (Math.abs(dir.z) > 1e-6 ? dir.z : 1e-6);
      var t1 = (bMinX - origin.x) * invDx, t2 = (bMaxX - origin.x) * invDx;
      var t3 = (bMinY - origin.y) * invDy, t4 = (bMaxY - origin.y) * invDy;
      var t5 = (bMinZ - origin.z) * invDz, t6 = (bMaxZ - origin.z) * invDz;
      var tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
      var tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
      if (tmax >= tmin && tmax >= 0.05 && tmin <= 5.5 && tmin < bestT) {
        var boxHitX = origin.x + dir.x * Math.max(0.05, tmin);
        var boxHitZ = origin.z + dir.z * Math.max(0.05, tmin);
        var bcx = Math.max(s.minX + 0.02, Math.min(s.maxX - 0.02, boxHitX));
        var bcz = Math.max(s.minZ + 0.02, Math.min(s.maxZ - 0.02, boxHitZ));
        bestT = tmin;
        bestPt = new THREE.Vector3(bcx, s.topY, bcz);
      }
    }
    if (bestPt) return bestPt;

    // 2. Intersecao fina com piso / terreno / tampos de mesa ao longo da mira
    for (var t = 0.45; t <= 5.0; t += 0.08) {
      var px = origin.x + dir.x * t;
      var py = origin.y + dir.y * t;
      var pz = origin.z + dir.z * t;
      var gh = getItemGroundHeight(px, pz, py);
      if (py <= gh + 0.04) {
        return new THREE.Vector3(px, gh, pz);
      }
    }

    // 3. Fallback suave seguindo a direcao exata do mouse/mira (mesmo olhando para parede/canto)
    var hLen = Math.hypot(dir.x, dir.z) || 1;
    var fx = playerPos.x + (dir.x / hLen) * 1.8;
    var fz = playerPos.z + (dir.z / hLen) * 1.8;
    return new THREE.Vector3(fx, getItemGroundHeight(fx, fz, playerPos.y), fz);
  }

  var placementBlockedReason = '';
  function isPlacementBlocked(pt) {
    placementBlockedReason = '';
    if (!heldItem || !heldItem.mesh) return false;
    if (snapClosePot || snapPetriStack) return false;

    // Altura e limites verticais do item sendo segurado
    var heldH = heldItem.height || (heldItem.mesh.userData.tableDims ? heldItem.mesh.userData.tableDims.h : 0.32);
    var heldMinY = pt.y;
    var heldMaxY = pt.y + heldH;

    // Dimensões horizontais do item segurado
    var heldIsBox = !!(heldItem.mesh.userData.tableDims);
    var heldHw = 0, heldHd = 0, heldRad = 0;
    if (heldIsBox) {
      var dims = heldItem.mesh.userData.tableDims;
      var cRot = Math.abs(Math.cos(heldRotY)), sRot = Math.abs(Math.sin(heldRotY));
      heldHw = (dims.w * cRot + dims.d * sRot) * 0.5;
      heldHd = (dims.w * sRot + dims.d * cRot) * 0.5;
      heldRad = Math.max(heldHw, heldHd);
    } else {
      heldRad = heldItem.radius || 0.16;
      heldHw = heldRad;
      heldHd = heldRad;
    }

    // 1. CHECAGEM DE COLISÃO COM TODOS OS ITENS EXISTENTES NO MUNDO
    // Impede colocar qualquer item por dentro de outro item!
    for (var k = 0; k < pickableItems.length; k++) {
      var other = pickableItems[k];
      if (!other || !other.mesh) continue;
      if (other === heldItem) continue;
      if (heldItem.lidItem && other === heldItem.lidItem) continue;
      if (heldItem.potItem && other === heldItem.potItem) continue;
      if (other.isAttached && other.potItem) continue; // Tampa acoplada na panela é coberta pelo corpo da panela
      if (heldItem.trayContents && heldItem.trayContents.some(function (tc) { return tc.item === other; })) continue;
      if (isHeldByRemote(other.id)) continue; // Item sendo carregado no ar por outro jogador

      var oPos = other.mesh.position;
      var otherH = other.height || (other.mesh.userData.tableDims ? other.mesh.userData.tableDims.h : 0.32);
      var otherMinY = oPos.y;
      var otherMaxY = oPos.y + otherH;

      // Se o 'other' for um suporte/mesa/equipamento com superfície dinâmica no topo
      if (other.mesh.userData.dynamicSurface) {
        var dynSurf = other.mesh.userData.dynamicSurface;
        // O jogador está colocando o item EM CIMA da superfície deste equipamento/mesa?
        var onDynSurfXZ = (
          pt.x >= dynSurf.minX - 0.02 && pt.x <= dynSurf.maxX + 0.02 &&
          pt.z >= dynSurf.minZ - 0.02 && pt.z <= dynSurf.maxZ + 0.02
        );
        if (onDynSurfXZ && pt.y >= dynSurf.topY - 0.04 && pt.y <= dynSurf.topY + 0.12) {
          // Impedir colocar uma mesa em cima de outra mesa ou capela (mas permitir colocar a capela em cima de mesas/bancadas!)
          if (other.mesh.userData.isTable && heldItem.mesh.userData.isTable) {
            placementBlockedReason = '🚫 Não é permitido sobrepor mesas';
            return true;
          }
          if (other.mesh.userData.isHood && heldItem.mesh.userData.isTable) {
            placementBlockedReason = '🚫 Não cabe aqui';
            return true;
          }
          if (other.mesh.userData.isScale || other.mesh.userData.isStirrer || other.mesh.userData.isBurner) {
            var hUd = heldItem.mesh.userData;
            if (hUd.isTable || hUd.isHood || hUd.isScale || hUd.isStirrer || hUd.isBurner) {
              placementBlockedReason = '🚫 Equipamento incompatível com esta superfície';
              return true;
            }
            if ((other.mesh.userData.isScale || other.mesh.userData.isStirrer) && hUd.twoHanded) {
              placementBlockedReason = '🚫 Objeto grande demais para este aparelho';
              return true;
            }
          }
          // Está apoiado sobre a superfície: o suporte em si não bloqueia
          // (mas qualquer outro objeto já em cima desse suporte será checado nas próximas iterações!)
          continue;
        }
      }

      // Verificação de sobreposição vertical:
      // Se não há interseção na faixa de altura (ex: prateleira superior vs inferior, ou chão vs mesa alta)
      if (heldMinY >= otherMaxY - 0.02 || heldMaxY <= otherMinY + 0.02) {
        continue;
      }

      // Verificação de sobreposição horizontal (X e Z):
      if (!heldIsBox && !other.mesh.userData.tableDims) {
        // Dois objetos radiais/cilíndricos (vidros, potes, béqueres, bags, seringas, etc.)
        var oRad = other.radius || 0.16;
        var minDist = (heldRad + oRad) * 0.94; // Permite toque encostado mas bloqueia penetração
        var dx = pt.x - oPos.x;
        var dz = pt.z - oPos.z;
        if (dx * dx + dz * dz < minDist * minDist) {
          placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
          return true; // BLOQUEADO: Tentando colocar item por dentro de outro item!
        }
      } else {
        // Pelo menos um dos objetos é retangular/caixa (mesas, fogareiro, balança, capela)
        var oHw, oHd;
        if (other.mesh.userData.tableDims) {
          var od = other.mesh.userData.tableDims;
          var oc = Math.abs(Math.cos(other.mesh.rotation.y)), os = Math.abs(Math.sin(other.mesh.rotation.y));
          oHw = (od.w * oc + od.d * os) * 0.5;
          oHd = (od.w * os + od.d * oc) * 0.5;
        } else {
          var oR = other.radius || 0.16;
          oHw = oR * 0.90;
          oHd = oR * 0.90;
        }
        var cW = (heldHw + oHw) * 0.93;
        var cD = (heldHd + oHd) * 0.93;
        if (Math.abs(pt.x - oPos.x) < cW && Math.abs(pt.z - oPos.z) < cD) {
          placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
          return true; // BLOQUEADO: Colisão de caixa com objeto!
        }
      }
    }

    // 2. CHECAGEM DE COLISÃO COM PAREDES
    if (pt.y > 3.2) return false;
    for (var wIdx = 0; wIdx < wallSegments.length; wIdx++) {
      var w = wallSegments[wIdx];
      var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      var len2 = vx * vx + vz * vz;
      var t = Math.max(0, Math.min(1, ((pt.x - w.x1) * vx + (pt.z - w.z1) * vz) / len2));
      var dist = Math.hypot(pt.x - (w.x1 + t * vx), pt.z - (w.z1 + t * vz));
      var effectiveHalf = heldIsBox ? Math.min(heldHw, heldHd) : heldRad;
      var minWallDist = Math.max(0.16, effectiveHalf * 0.78 + 0.08);
      if (dist < minWallDist) {
        placementBlockedReason = '🚫 Muito próximo da parede';
        return true;
      }
    }

    return false;
  }

  var lastGravityCheckAt = 0;
  var hasFallingItems = true;
  function dropUnsupportedItems() {
    var now = performance.now();
    if (!hasFallingItems && now - lastGravityCheckAt < 180) return;
    lastGravityCheckAt = now;
    var anyFalling = false;
    pickableItems.forEach(function (item) {
      if (item.potItem && item.isAttached) {
        var pot = item.potItem;
        item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
        item.mesh.rotation.copy(pot.mesh.rotation);
        return;
      }
      if (heldItem === item || isHeldByRemote(item.id)) {
        item.movedAt = now;
        removeFromCookerContents(item);
        return;
      }
      for (var cpi = 0; cpi < cookerPots.length; cpi++) {
        var cpRef = cookerPots[cpi];
        var slotIdx = cpRef.contents.indexOf(item);
        if (slotIdx !== -1) {
          var potP = cpRef.potItem.mesh.position;
          var ox = (slotIdx % 2 === 0 ? -0.06 : 0.06);
          var oz = (slotIdx < 2 ? -0.05 : 0.05);
          item.mesh.position.set(potP.x + ox, potP.y + 0.045, potP.z + oz);
          return;
        }
      }
      if (item.mesh.position.y < -5) {
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
        recentlyDropped[item.id] = now + 1500;
        pendingMovedItems[item.id] = {
          id: item.id, x: item.homePos.x, y: item.homePos.y, z: item.homePos.z, ry: item.homeRy
        };
        return;
      }
      var supportedY = getItemGroundHeight(item.mesh.position.x, item.mesh.position.z, item.mesh.position.y, item.mesh.userData.dynamicSurface, item.mesh.position.y + 0.18);
      if (!item.mesh.userData.isTable) {
        for (var i = 0; i < supportSurfaces.length; i++) {
          var s = supportSurfaces[i];
          if (s === item.mesh.userData.dynamicSurface) continue;
          if (item.mesh.userData.isHood && s.isHood) continue;
          if (item.mesh.position.x >= s.minX - 0.09 && item.mesh.position.x <= s.maxX + 0.09 &&
            item.mesh.position.z >= s.minZ - 0.09 && item.mesh.position.z <= s.maxZ + 0.09 &&
            item.mesh.position.y >= s.topY - 0.28) {
            supportedY = Math.max(supportedY, s.topY);
          }
        }
        if (item.mesh.userData.isPetri) {
          var myIdx = pickableItems.indexOf(item);
          for (var pj = 0; pj < pickableItems.length; pj++) {
            var pBase = pickableItems[pj];
            if (!pBase || pBase === item || pBase === heldItem || isHeldByRemote(pBase.id)) continue;
            if (!pBase.mesh || !pBase.mesh.userData.isPetri) continue;
            if (Math.hypot(pBase.mesh.position.x - item.mesh.position.x, pBase.mesh.position.z - item.mesh.position.z) < 0.15) {
              var dyPetri = item.mesh.position.y - pBase.mesh.position.y;
              if (dyPetri > 0.008 || (Math.abs(dyPetri) <= 0.008 && myIdx > pj)) {
                supportedY = Math.max(supportedY, pBase.mesh.position.y + 0.055);
              }
            }
          }
        }
      }
      if (item.mesh.position.y < supportedY - 0.005 && !item.mesh.userData.isTable && !item.mesh.userData.isHood) {
        item.mesh.position.y = supportedY;
        if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      } else if (item.mesh.position.y > supportedY + 0.015) {
        anyFalling = true;
        recentlyDropped[item.id] = now + 1500;
        item.mesh.position.y = Math.max(supportedY, item.mesh.position.y - 0.18);
        if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
        if (item.lidItem && item.lidItem.isAttached) {
          var attLid = item.lidItem;
          attLid.mesh.position.set(item.mesh.position.x, item.mesh.position.y + 0.36, item.mesh.position.z);
          recentlyDropped[attLid.id] = now + 1500;
        }
        if (Math.abs(item.mesh.position.y - supportedY) < 0.005) {
          item.mesh.position.y = supportedY;
          item.isMoved = true;
          pendingMovedItems[item.id] = {
            id: item.id,
            x: item.mesh.position.x,
            y: item.mesh.position.y,
            z: item.mesh.position.z,
            ry: item.mesh.rotation.y
          };
          if (item.lidItem && item.lidItem.isAttached) {
            var lid = item.lidItem;
            pendingMovedItems[lid.id] = {
              id: lid.id,
              x: lid.mesh.position.x,
              y: lid.mesh.position.y,
              z: lid.mesh.position.z,
              ry: lid.mesh.rotation.y
            };
          }
        }
      }
    });
    hasFallingItems = anyFalling;
  }

  // ---------------- Avatares Multiplayer ----------------

  function roundRectPath(ctx, x, y, w, h, r) {
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

  function normalizeAngle(a) {
    a = a % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

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

  function makeTextSprite(text, colorHex) {
    var canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 96;
    var tex = new THREE.CanvasTexture(canvas);
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sp = new THREE.Sprite(mat);
    sp.scale.set(2.2, 0.42, 1);
    updateTextSprite(sp, text, colorHex);
    return sp;
  }

  function updateTextSprite(sp, text, colorHex) {
    var tex = sp.material.map;
    var canvas = tex.image;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text) { tex.needsUpdate = true; return; }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    roundRectPath(ctx, 16, 12, 480, 72, 24);
    ctx.fill();
    ctx.fillStyle = colorHex || '#ffffff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 30), 256, 48);
    tex.needsUpdate = true;
  }

  function drawAvatarFace(ctx, mood, blink) {
    ctx.clearRect(0, 0, 128, 128);
    // Bochechas rosadas
    ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
    ctx.beginPath(); ctx.ellipse(28, 76, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(100, 76, 12, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Olhos
    if (blink) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(40, 56, 10, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(88, 56, 10, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      [40, 88].forEach(function (ex) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.ellipse(ex, 56, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex - 3, 51, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + 3, 60, 1.8, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Sobrancelhas & Boca conforme o humor
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    if (mood === 'focused') {
      ctx.beginPath(); ctx.moveTo(28, 38); ctx.lineTo(50, 42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(100, 38); ctx.lineTo(78, 42); ctx.stroke();
      ctx.beginPath(); ctx.arc(64, 86, 5, 0, Math.PI * 2); ctx.stroke();
    } else if (mood === 'chat') {
      ctx.fillStyle = '#be123c';
      ctx.beginPath(); ctx.ellipse(64, 85, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(64, 78, 12, 0.25, Math.PI - 0.25); ctx.stroke();
    }
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

  function disposeObject3D(root, skipMat) {
    if (!root) return;
    root.traverse(function (obj) {
      if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
      var mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i];
        if (!m || m === skipMat) continue;
        if (m.map && m.map.dispose) m.map.dispose();
        if (m.dispose) m.dispose();
      }
    });
  }

  function buildAvatarHat(hatId, hatMat, hatGroup) {
    while (hatGroup.children.length > 0) {
      var oldHat = hatGroup.children[0];
      hatGroup.remove(oldHat);
      disposeObject3D(oldHat, hatMat);
    }
    var id = hatId || 'default';
    if (id === 'none') {
      return;
    }

    if (id === 'golden_shroom') {
      var goldMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15, metalness: 0.88, roughness: 0.18,
        emissive: 0xb45309, emissiveIntensity: 0.35
      });
      var gHat = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), goldMat);
      gHat.position.set(0, 0.24, 0); gHat.castShadow = true;
      var pearlMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, metalness: 0.1, roughness: 0.15,
        emissive: 0xfef08a, emissiveIntensity: 0.6
      });
      [[0, 0.58, 0.08], [-0.20, 0.46, -0.16], [0.20, 0.46, -0.16], [-0.18, 0.45, 0.17], [0.18, 0.45, 0.17], [0, 0.62, 0]].forEach(function (sp) {
        var p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pearlMat);
        p.position.set(sp[0], sp[1], sp[2]);
        hatGroup.add(p);
      });
      hatGroup.add(gHat);
    } else if (id === 'wizard_hood') {
      var wizMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.55 });
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.035, 20), wizMat);
      brim.position.set(0, 0.22, 0);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.68, 20), wizMat);
      cone.position.set(0, 0.52, -0.05);
      cone.rotation.x = -0.18;
      var belt = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.38, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 }));
      belt.position.set(0, 0.25, -0.02);
      belt.rotation.x = -0.15;
      hatGroup.add(brim, cone, belt);
    } else if (id === 'grad_cap') {
      var capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
      var skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
      skull.position.set(0, 0.22, 0);
      var board = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.56), capMat);
      board.position.set(0, 0.35, 0);
      board.rotation.y = Math.PI / 4;
      var button = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7 }));
      button.position.set(0, 0.37, 0);
      var tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.035, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 }));
      tassel.position.set(0.24, 0.24, 0.12);
      tassel.rotation.z = -0.3;
      hatGroup.add(skull, board, button, tassel);
    } else if (id === 'flower_crown') {
      var vineMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
      var vine = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 24), vineMat);
      vine.rotation.x = Math.PI / 2;
      vine.position.set(0, 0.24, 0);
      hatGroup.add(vine);
      var flowerCols = [0xf43f5e, 0xfacc15, 0x38bdf8, 0xa855f7, 0xffedd5, 0xf97316];
      for (var fi = 0; fi < 6; fi++) {
        var ang = (fi / 6) * Math.PI * 2;
        var fMat = new THREE.MeshStandardMaterial({ color: flowerCols[fi], roughness: 0.35 });
        var fMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), fMat);
        fMesh.position.set(Math.cos(ang) * 0.24, 0.25, Math.sin(ang) * 0.24);
        hatGroup.add(fMesh);
      }
    } else if (id === 'beret') {
      var beretMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.8 });
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.25, 0.10, 18), beretMat);
      disc.position.set(0.05, 0.28, -0.02);
      disc.rotation.z = -0.22;
      disc.rotation.x = 0.08;
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), beretMat);
      stem.position.set(0.06, 0.35, -0.02);
      hatGroup.add(disc, stem);
    } else {
      // Padrão: cogumelo vermelho com pintas brancas
      var defHat = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hatMat);
      defHat.position.set(0, 0.24, 0); defHat.castShadow = true;
      var spotMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
      [[0, 0.56, 0.08], [-0.18, 0.45, -0.15], [0.18, 0.45, -0.15], [-0.16, 0.44, 0.16], [0.16, 0.44, 0.16]].forEach(function (sp) {
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), spotMat);
        dot.scale.set(1, 0.45, 1);
        dot.position.set(sp[0], sp[1], sp[2]);
        hatGroup.add(dot);
      });
      hatGroup.add(defHat);
    }
  }

  function buildCuteAvatar(data) {
    var g = new THREE.Group();
    var bodyMat = data.isLocal
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
    var hatMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(data.hat_color || '#d9534f'), roughness: 0.45 });

    var legGeo = new THREE.BoxGeometry(0.14, 0.38, 0.14);
    legGeo.translate(0, -0.19, 0); // Pivo na articulacao do quadril (topo da perna)
    var leftLeg = new THREE.Mesh(legGeo, bodyMat);
    leftLeg.position.set(-0.10, 0.38, 0); leftLeg.castShadow = true;
    var rightLeg = new THREE.Mesh(legGeo, bodyMat);
    rightLeg.position.set(0.10, 0.38, 0); rightLeg.castShadow = true;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26), bodyMat);
    torso.position.set(0, 0.64, 0); torso.castShadow = true;
    var armGeo = new THREE.BoxGeometry(0.13, 0.44, 0.13);
    armGeo.translate(0, -0.16, 0); // Pivo na articulacao do ombro (topo do braco)
    var leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.28, 0.82, 0); leftArm.castShadow = true;
    var rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.28, 0.82, 0); rightArm.castShadow = true;
    g.add(leftLeg, rightLeg, torso, leftArm, rightArm);

    var headGroup = new THREE.Group();
    headGroup.position.set(0, 1.05, 0);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.34), skinMat);
    head.position.set(0, 0.1, 0); head.castShadow = true;

    // Rosto expressivo (CanvasTexture na frente -Z)
    var faceCanvas = document.createElement('canvas');
    faceCanvas.width = 128; faceCanvas.height = 128;
    var faceCtx = faceCanvas.getContext('2d');
    drawAvatarFace(faceCtx, 'happy', false);
    var faceTex = new THREE.CanvasTexture(faceCanvas);
    var facePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.30),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
    );
    facePlane.position.set(0, 0.1, -0.173);
    facePlane.rotation.y = Math.PI;
    headGroup.add(facePlane);

    // Chapeu com suporte a cosmeticos especiais
    var hatGroup = new THREE.Group();
    buildAvatarHat(data.current_hat || 'default', hatMat, hatGroup);
    headGroup.add(head, hatGroup);

    var isProf = data.role === 'professor' || data.role === 'admin';
    var isMaster = data.role === 'admin';
    var isMod = data.role === 'moderator';
    var auraGroup = null;
    var auraOrbs = [];
    if (isProf) {
      auraGroup = new THREE.Group();
      var ringColor = isMaster ? 0xf59e0b : 0x34d399;
      var innerColor = isMaster ? 0xec4899 : 0xfbbf24;
      var outerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 0.56, 36),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.025;
      var innerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.38, 36),
        new THREE.MeshBasicMaterial({ color: innerColor, transparent: true, opacity: 0.50, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      innerRing.rotation.x = -Math.PI / 2;
      innerRing.position.y = 0.032;
      auraGroup.add(outerRing, innerRing);
      var orbGeo = new THREE.SphereGeometry(0.026, 8, 8);
      for (var oi = 0; oi < 8; oi++) {
        var oMat = new THREE.MeshBasicMaterial({
          color: oi % 2 === 0 ? ringColor : innerColor,
          transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
        });
        var orb = new THREE.Mesh(orbGeo, oMat);
        auraGroup.add(orb);
        auraOrbs.push({ mesh: orb, angle: (oi / 8) * Math.PI * 2, phase: oi * 0.75 });
      }
      g.add(auraGroup);
    }
    g.add(headGroup);
    g.scale.set(1.38, 1.38, 1.38);

    var rolePrefix = '';
    var labelColor = '#ffffff';
    if (isMaster) {
      rolePrefix = '👑 ';
      labelColor = '#fbbf24';
    } else if (data.role === 'professor') {
      rolePrefix = '👨‍🏫 ';
      labelColor = '#fcd34d';
    } else if (isMod) {
      rolePrefix = '🛡️ ';
      labelColor = '#93c5fd';
    }
    var labelSprite = data.isLocal ? null : makeTextSprite(rolePrefix + (data.name || 'Aluno'), labelColor);
    if (labelSprite) {
      labelSprite.position.set(0, 1.92, 0);
      labelSprite.scale.set(1.45, 0.36, 1);
      g.add(labelSprite);
    }
    var chatSprite = data.isLocal ? null : makeTextSprite('', '#34d399');
    if (chatSprite) {
      chatSprite.position.set(0, 2.28, 0);
      chatSprite.scale.set(1.45, 0.36, 1);
      chatSprite.visible = false;
      g.add(chatSprite);
    }

    // Brinquedos visiveis para outros jogadores (Snowboard e Paraglider)
    var remoteSb = new THREE.Group();
    var rDeckMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.25, metalness: 0.15 });
    var rTipMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35 });
    var rBindMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 });
    var rDeck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.024, 0.92), rDeckMat);
    rDeck.position.y = 0.025;
    remoteSb.add(rDeck);
    var rNose = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.16), rTipMat);
    rNose.position.set(0, 0.048, -0.51);
    rNose.rotation.x = 0.36;
    remoteSb.add(rNose);
    var rTail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.022, 0.16), rTipMat);
    rTail.position.set(0, 0.048, 0.51);
    rTail.rotation.x = -0.36;
    remoteSb.add(rTail);
    var rBindF = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.12), rBindMat);
    rBindF.position.set(0, 0.048, -0.20);
    remoteSb.add(rBindF);
    var rBindB = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.12), rBindMat);
    rBindB.position.set(0, 0.048, 0.20);
    remoteSb.add(rBindB);
    remoteSb.rotation.y = -0.28;
    remoteSb.visible = false;
    g.add(remoteSb);

    var remotePg = createParagliderWingMesh(0.75);
    remotePg.visible = false;
    g.add(remotePg);

    scene.add(g);
    return {
      group: g, torso: torso, leftLeg: leftLeg, rightLeg: rightLeg, leftArm: leftArm, rightArm: rightArm, headGroup: headGroup,
      auraGroup: auraGroup, auraOrbs: auraOrbs,
      snowboardMesh: remoteSb, paragliderMesh: remotePg, toyMode: '',
      bodyMat: bodyMat, hatMat: hatMat, hatGroup: hatGroup, current_hat: data.current_hat || 'default', emote: data.emote || '',
      faceCtx: faceCtx, faceTex: faceTex, lastMood: 'happy', lastBlink: false, blinkTimer: 2 + Math.random() * 3,
      labelSprite: labelSprite, chatSprite: chatSprite, lastChat: '', role: data.role || 'student',
      targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      targetYaw: normalizeAngle(data.yaw || 0),
      targetPitch: data.pitch || 0,
      targetVelX: 0, targetVelZ: 0,
      avgIntervalMs: 140, interpDelay: 185, lastSnapAt: 0,
      snapshots: [],
      holding: '', walking: false, seated: false, walkPhase: 0
    };
  }

  function updateCampusPlayers(players) {
    var seen = {};
    var nowMs = performance.now();
    (players || []).forEach(function (p) {
      seen[p.id] = true;
      var nyaw = normalizeAngle(p.yaw || 0);
      var npitch = p.pitch || 0;
      var av = remoteAvatars[p.id];
      if (!av) {
        av = buildCuteAvatar(p);
        av.group.position.set(p.x, p.y, p.z);
        av.group.rotation.y = nyaw;
        av.lastSnapAt = nowMs;
        av.snapshots.push({ t: nowMs, x: p.x, y: p.y, z: p.z, yaw: nyaw, pitch: npitch, vx: Number(p.vx) || 0, vz: Number(p.vz) || 0 });
        remoteAvatars[p.id] = av;
      } else {
        var snaps = av.snapshots;
        var prev = snaps.length ? snaps[snaps.length - 1] : null;
        if (av.lastSnapAt > 0) {
          var gap = nowMs - av.lastSnapAt;
          if (gap > 30 && gap < 1200) {
            av.avgIntervalMs = av.avgIntervalMs * 0.8 + gap * 0.2;
            av.interpDelay = Math.max(150, Math.min(320, av.avgIntervalMs * 1.45));
          }
        }
        av.lastSnapAt = nowMs;
        var vx = Number(p.vx) || 0;
        var vz = Number(p.vz) || 0;
        if (prev && vx === 0 && vz === 0) {
          var dtSec = (nowMs - prev.t) / 1000;
          if (dtSec > 0.03 && dtSec < 1.2) {
            vx = (p.x - prev.x) / dtSec;
            vz = (p.z - prev.z) / dtSec;
          }
        }
        snaps.push({ t: nowMs, x: p.x, y: p.y, z: p.z, yaw: nyaw, pitch: npitch, vx: vx, vz: vz });
        if (snaps.length > 8) snaps.shift();
      }
      av.targetPos.set(p.x, p.y, p.z);
      av.targetYaw = nyaw;
      av.targetPitch = npitch;
      av.targetVelX = Number(p.vx) || 0;
      av.targetVelZ = Number(p.vz) || 0;
      av.walking = !!p.walking;
      av.toyMode = p.toy_mode || ((p.walking === 4) ? 'paraglider' : (p.walking === 3 ? 'snowboard' : ''));
      av.seated = !!p.seated;
      av.holding = p.holding || '';
      if (av.current_hat !== (p.current_hat || 'default')) {
        av.current_hat = p.current_hat || 'default';
        buildAvatarHat(av.current_hat, av.hatMat, av.hatGroup);
      }
      av.emote = p.emote || '';
      if (av.role !== p.role) {
        av.role = p.role;
        var rPfx = p.role === 'admin' ? '👑 ' : (p.role === 'professor' ? '👨‍🏫 ' : (p.role === 'moderator' ? '🛡️ ' : ''));
        var rCol = p.role === 'admin' ? '#fbbf24' : (p.role === 'professor' ? '#fcd34d' : (p.role === 'moderator' ? '#93c5fd' : '#ffffff'));
        if (av.labelSprite) {
          updateTextSprite(av.labelSprite, rPfx + (p.name || 'Aluno'), rCol);
        }
      }
      if (heldItem && av.holding === heldItem.id) {
        setHeldTwoHandedGhost(heldItem, false);
        heldItem = null;
        if (placementGhost) placementGhost.visible = false;
        if (callbacks.onHoldChange) callbacks.onHoldChange(null);
      }
      if ((p.chat || '') !== av.lastChat) {
        av.lastChat = p.chat || '';
        if (av.lastChat) {
          updateTextSprite(av.chatSprite, '💬 ' + av.lastChat, '#a7f3d0');
          av.chatSprite.visible = true;
        } else {
          av.chatSprite.visible = false;
        }
      }
    });
    Object.keys(remoteAvatars).forEach(function (id) {
      if (!seen[id]) {
        disposeObject3D(remoteAvatars[id].group);
        scene.remove(remoteAvatars[id].group);
        delete remoteAvatars[id];
      }
    });
  }

  function animateAvatarExpression(av, dt, holding, chatMsg) {
    if (!av || !av.faceCtx) return;
    av.blinkTimer -= dt;
    var blinkNow = av.blinkTimer <= 0;
    if (av.blinkTimer <= -0.14) av.blinkTimer = 2.4 + Math.random() * 3.5;
    var mood = chatMsg ? 'chat' : (holding ? 'focused' : 'happy');
    if (mood !== av.lastMood || blinkNow !== av.lastBlink) {
      av.lastMood = mood;
      av.lastBlink = blinkNow;
      drawAvatarFace(av.faceCtx, mood, blinkNow);
      av.faceTex.needsUpdate = true;
    }
  }

  function animateAvatarAura(av, tNow) {
    if (!av || !av.auraGroup) return;
    av.auraGroup.rotation.y = tNow * 0.7;
    var pScale = 1 + Math.sin(tNow * 2.6) * 0.06;
    av.auraGroup.children[0].scale.set(pScale, pScale, 1);
    for (var oi = 0; oi < av.auraOrbs.length; oi++) {
      var o = av.auraOrbs[oi];
      var a = o.angle + tNow * 1.1;
      var h = ((tNow * 0.45 + o.phase) % 1.45) + 0.08;
      var rad = 0.44 + Math.sin(tNow * 2 + o.phase) * 0.05;
      o.mesh.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
      o.mesh.material.opacity = Math.sin((h - 0.08) / 1.45 * Math.PI) * 0.78;
    }
  }

  var _tmpInterpPos = new THREE.Vector3();

  function stepMultiplayerAvatars(dt) {
    var tNow = clock.elapsedTime;
    var nowMs = performance.now();
    var blend = 1 - Math.exp(-12 * dt);

    Object.keys(remoteAvatars).forEach(function (id) {
      var av = remoteAvatars[id];
      if (auraEnabled) animateAvatarAura(av, tNow);

      var prevX = av.group.position.x;
      var prevZ = av.group.position.z;
      var snaps = av.snapshots;
      var renderTime = nowMs - (av.interpDelay || 185);
      var desiredYaw = av.targetYaw;
      var desiredPitch = av.targetPitch;
      _tmpInterpPos.copy(av.targetPos);

      if (snaps && snaps.length >= 2) {
        // Encontra o par de snapshots que envolve renderTime e aplica spline Hermite cúbica
        var s0 = snaps[0], s1 = snaps[snaps.length - 1];
        if (renderTime <= s0.t) {
          _tmpInterpPos.set(s0.x, s0.y, s0.z);
          desiredYaw = s0.yaw;
          desiredPitch = s0.pitch;
        } else if (renderTime >= s1.t) {
          // Dead-reckoning suave limitado a 260ms se um pacote atrasar
          var extrap = Math.min(0.26, (renderTime - s1.t) / 1000);
          var damp = Math.max(0.15, 1 - extrap * 1.8);
          _tmpInterpPos.set(s1.x + s1.vx * extrap * damp, s1.y, s1.z + s1.vz * extrap * damp);
          desiredYaw = s1.yaw;
          desiredPitch = s1.pitch;
        } else {
          for (var si = 0; si < snaps.length - 1; si++) {
            if (renderTime >= snaps[si].t && renderTime <= snaps[si + 1].t) {
              var a = snaps[si], b = snaps[si + 1];
              var spanMs = Math.max(1, b.t - a.t);
              var u = (renderTime - a.t) / spanMs;
              var spanSec = spanMs / 1000;
              var u2 = u * u, u3 = u2 * u;
              var h00 = 2 * u3 - 3 * u2 + 1;
              var h10 = u3 - 2 * u2 + u;
              var h01 = -2 * u3 + 3 * u2;
              var h11 = u3 - u2;
              _tmpInterpPos.set(
                h00 * a.x + h10 * spanSec * a.vx + h01 * b.x + h11 * spanSec * b.vx,
                a.y + (b.y - a.y) * u,
                h00 * a.z + h10 * spanSec * a.vz + h01 * b.z + h11 * spanSec * b.vz
              );
              desiredYaw = normalizeAngle(a.yaw + normalizeAngle(b.yaw - a.yaw) * u);
              desiredPitch = a.pitch + (b.pitch - a.pitch) * u;
              break;
            }
          }
        }
      }

      if (av.group.position.distanceToSquared(_tmpInterpPos) > 100) {
        av.group.position.copy(_tmpInterpPos);
      } else {
        av.group.position.lerp(_tmpInterpPos, blend);
      }
      var dYaw = normalizeAngle(desiredYaw - av.group.rotation.y);
      av.group.rotation.y = normalizeAngle(av.group.rotation.y + dYaw * Math.min(1, dt * 12));
      av.headGroup.rotation.x += (desiredPitch - av.headGroup.rotation.x) * Math.min(1, dt * 12);

      var moveSpeed = Math.hypot(av.group.position.x - prevX, av.group.position.z - prevZ) / Math.max(dt, 0.001);
      var heldObj = null;
      if (av.holding) {
        heldObj = findPickable(av.holding);
        if (heldObj && heldObj !== heldItem) {
          var isTwo = !!heldObj.mesh.userData.twoHanded;
          if (isTwo) {
            _tmpAvatarHandOffset.set(0, 0.72, -0.62);
          } else {
            _tmpAvatarHandOffset.set(0.36, 0.88, -0.38);
          }
          _tmpAvatarHandOffset.applyAxisAngle(_tmpAvatarYAxis, av.group.rotation.y);
          heldObj.mesh.position.copy(av.group.position).add(_tmpAvatarHandOffset);
          heldObj.mesh.rotation.y = av.group.rotation.y;
          if (heldObj.mesh.userData.updateBounds) heldObj.mesh.userData.updateBounds(heldObj);
          if (heldObj.lidItem && heldObj.lidItem.isAttached) {
            var lidObj = heldObj.lidItem.mesh;
            lidObj.position.set(heldObj.mesh.position.x, heldObj.mesh.position.y + 0.36, heldObj.mesh.position.z);
            lidObj.rotation.copy(heldObj.mesh.rotation);
          }
        }
      }
      var twoH = !!(heldObj && heldObj.mesh.userData.twoHanded);
      if (av.snowboardMesh) av.snowboardMesh.visible = (av.toyMode === 'snowboard');
      if (av.paragliderMesh) av.paragliderMesh.visible = (av.toyMode === 'paraglider');
      if (av.toyMode === 'paraglider') {
        av.leftLeg.rotation.x = 0.7;
        av.rightLeg.rotation.x = 0.7;
        av.leftArm.rotation.x = -2.4;
        av.rightArm.rotation.x = -2.4;
        av.leftArm.rotation.z = 0;
        av.rightArm.rotation.z = 0;
        av.group.rotation.z *= Math.exp(-8 * dt);
      } else if (av.toyMode === 'snowboard') {
        var sbGlide = Math.min(1, moveSpeed / 6.0);
        if (av.torso) {
          av.torso.position.set(0, 0.67, 0);
          av.torso.rotation.x = 0.08 * sbGlide;
          av.torso.rotation.z = Math.sin(av.walkPhase * 0.5) * 0.06 * sbGlide;
        }
        av.headGroup.position.set(0, 1.08, 0);
        av.leftLeg.position.set(-0.10, 0.42, -0.06);
        av.rightLeg.position.set(0.10, 0.42, 0.06);
        av.leftLeg.rotation.x = 0.22;
        av.rightLeg.rotation.x = -0.22;
        av.leftArm.position.set(-0.28, 0.84, 0);
        av.rightArm.position.set(0.28, 0.84, 0);
        av.leftArm.rotation.x = twoH ? 1.05 : -0.15;
        av.rightArm.rotation.x = av.holding ? 1.05 : 0.15;
        av.leftArm.rotation.z = -0.58;
        av.rightArm.rotation.z = 0.58;
        if (sbGlide > 0.08) av.walkPhase += dt * 4.5;
        av.group.rotation.z = Math.sin(av.walkPhase * 0.5) * 0.07 * sbGlide;
      } else if (av.seated) {
        av.leftArm.rotation.z *= Math.exp(-10 * dt);
        av.rightArm.rotation.z *= Math.exp(-10 * dt);
        av.group.rotation.z *= Math.exp(-10 * dt);
        if (av.torso) av.torso.position.set(0, 0.60, 0);
        av.headGroup.position.set(0, 1.01, 0);
        av.leftLeg.position.set(-0.11, 0.41, 0);
        av.rightLeg.position.set(0.11, 0.41, 0);
        av.leftLeg.rotation.x = Math.PI / 2;
        av.rightLeg.rotation.x = Math.PI / 2;
        av.leftArm.position.set(-0.28, 0.78, 0);
        av.rightArm.position.set(0.28, 0.78, 0);
        av.leftArm.rotation.x = twoH ? 1.05 : 0.42;
        av.rightArm.rotation.x = av.holding ? 1.05 : 0.42;
        if (av.labelSprite) av.labelSprite.position.y = 1.84;
        if (av.chatSprite) av.chatSprite.position.y = 2.20;
      } else {
        var resetDecay = Math.exp(-10 * dt);
        av.leftArm.rotation.z *= resetDecay;
        av.rightArm.rotation.z *= resetDecay;
        av.group.rotation.z *= resetDecay;
        if (av.torso) av.torso.position.set(0, 0.64, 0);
        av.headGroup.position.set(0, 1.05, 0);
        av.leftLeg.position.set(-0.10, 0.38, 0);
        av.rightLeg.position.set(0.10, 0.38, 0);
        av.leftArm.position.set(-0.28, 0.82, 0);
        av.rightArm.position.set(0.28, 0.82, 0);
        if (av.labelSprite) av.labelSprite.position.y = 1.92;
        if (av.chatSprite) av.chatSprite.position.y = 2.28;
        var isMoving = moveSpeed > 0.28;
        if (isMoving) {
          var walkIntensity = Math.min(1, moveSpeed / 4.2);
          var stepRate = Math.max(5.5, Math.min(14, moveSpeed * 2.15));
          av.walkPhase += dt * stepRate;
          var swing = Math.sin(av.walkPhase);
          var stepBob = Math.abs(swing) * 0.045 * walkIntensity;
          if (av.torso) {
            av.torso.position.y = 0.64 + stepBob;
            av.torso.rotation.x = 0.06 * walkIntensity;
            av.torso.rotation.z = swing * 0.035 * walkIntensity;
          }
          av.headGroup.position.y = 1.05 + stepBob;
          av.leftLeg.rotation.x = swing * 0.58 * walkIntensity;
          av.rightLeg.rotation.x = -swing * 0.58 * walkIntensity;
          av.leftArm.rotation.x = twoH ? 1.05 : -swing * 0.46 * walkIntensity;
          av.rightArm.rotation.x = av.holding ? 1.05 : swing * 0.46 * walkIntensity;
        } else {
          var stopDecay = Math.exp(-12 * dt);
          if (av.torso) {
            av.torso.rotation.x *= stopDecay;
            av.torso.rotation.z *= stopDecay;
          }
          av.leftLeg.rotation.x *= stopDecay;
          av.rightLeg.rotation.x *= stopDecay;
          av.leftArm.rotation.x = twoH ? 1.0 : av.leftArm.rotation.x * stopDecay;
          av.rightArm.rotation.x = av.holding ? 1.0 : av.rightArm.rotation.x * stopDecay;
        }
        if (av.emote && !av.walking && !av.seated) {
          if (av.emote === 'wave') {
            av.rightArm.rotation.x = -Math.PI * 0.82;
            av.rightArm.rotation.z = Math.sin(tNow * 10) * 0.35 + 0.32;
            av.headGroup.rotation.z = Math.sin(tNow * 4) * 0.08;
          } else if (av.emote === 'dance') {
            av.group.rotation.y += Math.sin(tNow * 6) * 0.08;
            if (av.torso) av.torso.position.y = 0.64 + Math.abs(Math.sin(tNow * 8)) * 0.10;
            av.leftArm.rotation.z = Math.sin(tNow * 8) * 0.5 - 0.25;
            av.rightArm.rotation.z = -Math.sin(tNow * 8) * 0.5 + 0.25;
            av.leftLeg.rotation.x = Math.sin(tNow * 8) * 0.30;
            av.rightLeg.rotation.x = -Math.sin(tNow * 8) * 0.30;
          } else if (av.emote === 'cheer') {
            av.leftArm.rotation.x = -Math.PI * 0.88;
            av.rightArm.rotation.x = -Math.PI * 0.88;
            av.leftArm.rotation.z = -0.38;
            av.rightArm.rotation.z = 0.38;
            av.group.position.y += Math.abs(Math.sin(tNow * 9)) * 0.16;
          } else if (av.emote === 'meditate') {
            av.leftLeg.rotation.x = Math.PI / 2;
            av.rightLeg.rotation.x = Math.PI / 2;
            av.leftLeg.rotation.z = -0.3;
            av.rightLeg.rotation.z = 0.3;
            av.leftArm.rotation.x = 0.4; av.leftArm.rotation.z = -0.28;
            av.rightArm.rotation.x = 0.4; av.rightArm.rotation.z = 0.28;
            av.group.position.y += 0.30 + Math.sin(tNow * 2.5) * 0.06;
          }
        }
      }
      animateAvatarExpression(av, dt, av.holding, av.lastChat);
    });
  }

  // ---------------- Interacoes & Tour ----------------

  function setMeshGhostOpacity(root, active) {
    if (!root) return;
    root.traverse(function (ch) {
      if (!ch.isMesh || !ch.material) return;
      var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      mats.forEach(function (m) {
        if (active) {
          if (!m.userData._origHeld) {
            m.userData._origHeld = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
          }
          m.transparent = true;
          m.opacity = 0.14;
          m.depthWrite = false;
        } else if (m.userData._origHeld) {
          m.transparent = m.userData._origHeld.transparent;
          m.opacity = m.userData._origHeld.opacity;
          m.depthWrite = m.userData._origHeld.depthWrite;
        }
      });
    });
  }

  function setHeldTwoHandedGhost(item, active) {
    if (!item || !item.mesh || !item.mesh.userData.twoHanded) return;
    // Objetos grandes (2 maos: Fluxo Laminar, Mesas Inox, Panelas de Pressao) ficam 100% invisiveis nas maos,
    // mostrando apenas o fantasma texturizado verde/vermelho no local onde sera solto!
    item.mesh.visible = !active;
    if (item.lidItem) {
      if (active && item.lidItem.isAttached) {
        item.lidItem.mesh.visible = false;
      } else if (!active) {
        item.lidItem.mesh.visible = true;
      }
    }
  }

  function dropHeldItem() {
    if (!heldItem) return;
    syringePumping = null;
    syringePunctureProgress = 0;
    lastSyringeTargetItem = null;
    var rayNdc = inFps ? new THREE.Vector2(0, 0) : pointerNdc;
    var pt = findPlacementTarget(rayNdc);
    if (isPlacementBlocked(pt)) {
      if (callbacks.onToast) callbacks.onToast(placementBlockedReason || '🚫 Sem espaço livre aqui para soltar o item!');
      return;
    }
    var dropTs = performance.now() + 15000;
    heldItem.mesh.position.copy(pt);
    heldItem.mesh.rotation.set(0, heldRotY, 0);
    heldItem.isMoved = true;
    if (heldItem.mesh.userData.updateBounds) heldItem.mesh.userData.updateBounds(heldItem);
    pendingMovedItems[heldItem.id] = {
      id: heldItem.id, x: heldItem.mesh.position.x, y: heldItem.mesh.position.y, z: heldItem.mesh.position.z, ry: heldItem.mesh.rotation.y
    };
    recentlyDropped[heldItem.id] = dropTs;
    if (heldItem.lidItem && heldItem.lidItem.isAttached) {
      var lid = heldItem.lidItem;
      lid.mesh.position.set(pt.x, pt.y + 0.36, pt.z);
      lid.mesh.rotation.copy(heldItem.mesh.rotation);
      lid.isMoved = true;
      pendingMovedItems[lid.id] = {
        id: lid.id, x: lid.mesh.position.x, y: lid.mesh.position.y, z: lid.mesh.position.z, ry: lid.mesh.rotation.y
      };
      recentlyDropped[lid.id] = dropTs;
    }
    for (var cpi = 0; cpi < cookerPots.length; cpi++) {
      if (cookerPots[cpi].potItem === heldItem) {
        cookerPots[cpi].contents.forEach(function (cItem, cIdx) {
          var ox = (cIdx % 2 === 0 ? -0.06 : 0.06);
          var oz = (cIdx < 2 ? -0.05 : 0.05);
          cItem.mesh.position.set(pt.x + ox, pt.y + 0.045, pt.z + oz);
          cItem.isMoved = true;
          pendingMovedItems[cItem.id] = {
            id: cItem.id, x: cItem.mesh.position.x, y: cItem.mesh.position.y, z: cItem.mesh.position.z, ry: cItem.mesh.rotation.y
          };
          recentlyDropped[cItem.id] = dropTs;
        });
        break;
      }
    }
    if (heldItem.trayContents && heldItem.trayContents.length) {
      var cRy = Math.cos(heldRotY), sRy = Math.sin(heldRotY);
      heldItem.trayContents.forEach(function (tc) {
        var ci = tc.item;
        if (!ci || !ci.mesh) return;
        var wx = pt.x + tc.lx * cRy + tc.lz * sRy;
        var wz = pt.z - tc.lx * sRy + tc.lz * cRy;
        var wy = pt.y + tc.ly;
        ci.mesh.position.set(wx, wy, wz);
        ci.mesh.rotation.set(0, heldRotY + tc.lry, 0);
        ci.isMoved = true;
        if (ci.mesh.userData.updateBounds) ci.mesh.userData.updateBounds(ci);
        pendingMovedItems[ci.id] = {
          id: ci.id, x: ci.mesh.position.x, y: ci.mesh.position.y, z: ci.mesh.position.z, ry: ci.mesh.rotation.y
        };
        recentlyDropped[ci.id] = dropTs;
      });
      heldItem.trayContents = null;
    }
    setHeldTwoHandedGhost(heldItem, false);
    heldItem = null;
    thermoLaserOn = false;
    if (placementGhost) placementGhost.visible = false;
    if (thermoLaserLine) thermoLaserLine.visible = false;
    if (thermoLaserDot) thermoLaserDot.visible = false;
    if (callbacks.onHoldChange) callbacks.onHoldChange(null);
    notifyWorldAction();
  }

  var lastPickupAt = 0;
  function handlePrimaryAction() {
    if (heldItem) {
      if (performance.now() - lastPickupAt < 140) return;
      // Se estiver segurando o termômetro laser:
      // O clique aciona o gatilho da pistola de medição com bipe sonoro (não solta no chão)
      if (heldItem.mesh && heldItem.mesh.userData.isThermometer) {
        thermoLaserOn = !thermoLaserOn;
        if (window.MycoAudio && window.MycoAudio.playLaserBeep) {
          window.MycoAudio.playLaserBeep();
        }
        drawThermoScreen(thermoCurrentTemp, thermoLaserOn ? 'SCAN' : 'HOLD', true);
        return;
      }
      // Se estiver perto da lousa com giz ou apagador, o clique desenha/apaga no ponto em vez de soltar
      if (hoveredBoardHit && getHeldBoardToolColor()) {
        var boardToolCol = getHeldBoardToolColor();
        var brd = chalkboards[hoveredBoardIndex];
        if (boardToolCol && brd && hoveredBoardHit.uv) {
          var tapPx = Math.round(hoveredBoardHit.uv.x * 512 * 10) / 10;
          var tapPy = Math.round((1 - hoveredBoardHit.uv.y) * 256 * 10) / 10;
          var tapPt = [tapPx, tapPy];
          drawBoardSegment(brd.ctx, boardToolCol, tapPt, tapPt);
          brd.tex.needsUpdate = true;
          pendingBoardStrokes.push({
            b: hoveredBoardIndex,
            c: boardToolCol,
            pts: [tapPt, [tapPt[0] + 0.1, tapPt[1]]]
          });
        }
        return;
      }
      if (hoveredPotInsert && heldItem && !heldItem.mesh.userData.twoHanded) {
        var potP = hoveredPotInsert.potItem.mesh.position;
        var slotIdx = hoveredPotInsert.contents.length;
        var ox = (slotIdx % 2 === 0 ? -0.06 : 0.06);
        var oz = (slotIdx < 2 ? -0.05 : 0.05);
        heldItem.mesh.position.set(potP.x + ox, potP.y + 0.045, potP.z + oz);
        heldItem.mesh.rotation.set(0, heldRotY, 0);
        heldItem.isMoved = true;
        if (hoveredPotInsert.contents.indexOf(heldItem) === -1) hoveredPotInsert.contents.push(heldItem);
        pendingMovedItems[heldItem.id] = {
          id: heldItem.id, x: heldItem.mesh.position.x, y: heldItem.mesh.position.y, z: heldItem.mesh.position.z, ry: heldItem.mesh.rotation.y
        };
        recentlyDropped[heldItem.id] = performance.now() + 15000;
        if (heldItem.lidItem && heldItem.lidItem.isAttached) {
          recentlyDropped[heldItem.lidItem.id] = performance.now() + 15000;
        }
        heldItem = null;
        placementGhost.visible = false;
        if (callbacks.onHoldChange) callbacks.onHoldChange(null);
        if (callbacks.onLabStep) callbacks.onLabStep('cooker_heat');
        notifyWorldAction();
        return;
      }
      if (hoveredSprayTarget && heldItem.mesh.userData.isAlcoholSpray) {
        if (window.MycoAudio) window.MycoAudio.playSpray();
        var nowMs = performance.now();
        if (hoveredSprayTarget === 'hood') {
          hoodSanitizedUntil = nowMs + 90000;
          if (callbacks.onLabStep) callbacks.onLabStep('sanitize_hood');
        } else {
          hoveredSprayTarget.sanitizedUntil = nowMs + 90000;
        }
        var spCount = 24;
        var spArr = new Float32Array(spCount * 3);
        var spOrigin = new THREE.Vector3(0.24, -0.14, -0.52).applyEuler(camera.rotation).add(camera.position);
        var spDir = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
        for (var si = 0; si < spCount; si++) {
          spArr[si * 3] = spOrigin.x + (Math.random() - 0.5) * 0.14;
          spArr[si * 3 + 1] = spOrigin.y + (Math.random() - 0.5) * 0.14;
          spArr[si * 3 + 2] = spOrigin.z + (Math.random() - 0.5) * 0.14;
        }
        var spGeo = new THREE.BufferGeometry();
        var spAttr = new THREE.BufferAttribute(spArr, 3);
        spGeo.setAttribute('position', spAttr);
        var spMat = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.035, transparent: true, opacity: 0.85 });
        var spPts = new THREE.Points(spGeo, spMat);
        scene.add(spPts);
        sprayBursts.push({ pts: spPts, mat: spMat, attr: spAttr, dir: spDir, age: 0 });
        return;
      }
      if (hoveredSyringeTarget && heldItem.mesh.userData.isSyringe) {
        var syrCtrl = heldItem.mesh.userData.syrCtrl;
        var tgt = hoveredSyringeTarget;
        if (syringePumping) {
          return; // Já está bombeando (aguarda concluir os 2s)
        }
        var fromVol = syrCtrl.volMl;
        var toVol;
        if (tgt.mode === 'draw') {
          toVol = 10;
        } else {
          toVol = 0;
        }
        if (fromVol >= 9.9) toVol = 0;
        else if (fromVol <= 0.1) toVol = 10;
        else toVol = (fromVol >= 5 ? 0 : 10);

        syringePumping = {
          target: tgt,
          fromVol: fromVol,
          toVol: toVol,
          duration: 2.0,
          elapsed: 0,
          startJarVol: (tgt.item && tgt.item.mesh && tgt.item.mesh.userData.liquidCtrl) ? tgt.item.mesh.userData.liquidCtrl.volMl : 0
        };
        return;
      }
      if (placementValid && placementGhost) {
        if (isPlacementBlocked(placementGhost.position)) {
          placementValid = false;
          updatePlacementGhostVisual(heldItem, false, heldRotY);
          return;
        }
        heldItem.mesh.position.copy(placementGhost.position);
        heldItem.mesh.rotation.set(0, heldRotY, 0);
        heldItem.isMoved = true;
        if (heldItem.potItem && snapClosePot) {
          heldItem.isAttached = true;
          heldItem.potItem = snapClosePot;
          snapClosePot.lidItem = heldItem;
          heldItem.mesh.position.set(snapClosePot.mesh.position.x, snapClosePot.mesh.position.y + 0.36, snapClosePot.mesh.position.z);
          heldItem.mesh.rotation.copy(snapClosePot.mesh.rotation);
          snapClosePot = null;
        }
        pendingMovedItems[heldItem.id] = {
          id: heldItem.id,
          x: heldItem.mesh.position.x,
          y: heldItem.mesh.position.y,
          z: heldItem.mesh.position.z,
          ry: heldItem.mesh.rotation.y
        };
        if (heldItem.lidItem && heldItem.lidItem.isAttached) {
          var attLid = heldItem.lidItem;
          attLid.mesh.position.set(heldItem.mesh.position.x, heldItem.mesh.position.y + 0.36, heldItem.mesh.position.z);
          attLid.mesh.rotation.copy(heldItem.mesh.rotation);
          attLid.isMoved = true;
          pendingMovedItems[attLid.id] = {
            id: attLid.id, x: attLid.mesh.position.x, y: attLid.mesh.position.y, z: attLid.mesh.position.z, ry: attLid.mesh.rotation.y
          };
          recentlyDropped[attLid.id] = performance.now() + 15000;
        }
        // Move os itens guardados dentro da panela junto com ela
        for (var cpiDrop = 0; cpiDrop < cookerPots.length; cpiDrop++) {
          var cpDrop = cookerPots[cpiDrop];
          if (cpDrop.potItem === heldItem && cpDrop.contents.length > 0) {
            for (var ciDrop = 0; ciDrop < cpDrop.contents.length; ciDrop++) {
              var cItem = cpDrop.contents[ciDrop];
              if (!cItem || !cItem.mesh) continue;
              var cox = (ciDrop % 2 === 0 ? -0.06 : 0.06);
              var coz = (ciDrop < 2 ? -0.05 : 0.05);
              cItem.mesh.position.set(heldItem.mesh.position.x + cox, heldItem.mesh.position.y + 0.045, heldItem.mesh.position.z + coz);
              cItem.isMoved = true;
              pendingMovedItems[cItem.id] = {
                id: cItem.id, x: cItem.mesh.position.x, y: cItem.mesh.position.y, z: cItem.mesh.position.z, ry: cItem.mesh.rotation.y
              };
              recentlyDropped[cItem.id] = performance.now() + 15000;
            }
          }
        }
        recentlyDropped[heldItem.id] = performance.now() + 15000;
    setHeldTwoHandedGhost(heldItem, false);
        heldItem = null;
        placementGhost.visible = false;
        if (callbacks.onHoldChange) callbacks.onHoldChange(null);
        notifyWorldAction();
      }
      return;
    }
    if (hoveredGreenhouseSlot) {
      interactGreenhouseSlot(hoveredGreenhouseSlot);
      return;
    }
    if (hoveredMushroom && hoveredMushroom.active) {
      hoveredMushroom.active = false;
      hoveredMushroom.group.visible = false;
      hoveredMushroom.respawnAt = performance.now() + 20000;
      queueWorldStateChange(hoveredMushroom.id, 0);
      if (window.MycoAudio) window.MycoAudio.playHarvest();
      if (callbacks.onHarvestMushroom) callbacks.onHarvestMushroom(hoveredMushroom.id);
      return;
    }
    if (hoveredDoorObj) {
      hoveredDoorObj.open = !hoveredDoorObj.open;
      queueWorldStateChange(hoveredDoorObj.id, hoveredDoorObj.open ? 1 : 0);
      if (window.MycoAudio) window.MycoAudio.playDoor(hoveredDoorObj.open);
      return;
    }
    if (hoveredBlindObj) {
      hoveredBlindObj.open = !hoveredBlindObj.open;
      if (window.MycoAudio) window.MycoAudio.playSwitch();
      queueWorldStateChange(hoveredBlindObj.id, hoveredBlindObj.open ? 1 : 0);
      return;
    }
    if (hoveredCinema) {
      var hit = getCinemaHitTarget(hoveredCinemaUv);
      if (hit.type === 'power_on') {
        cinemaPower = true;
        cinemaDirty = true;
        if (cinemaBeam) cinemaBeam.visible = (cinemaLessonIdx === -1 || cinemaPlaying);
        queueWorldStateChange('cinema_power', 1);
      } else if (hit.type === 'power_off') {
        cinemaPower = false;
        cinemaDirty = true;
        if (cinemaBeam) cinemaBeam.visible = false;
        queueWorldStateChange('cinema_power', 0);
      } else if (hit.type === 'menu') {
        cinemaLessonIdx = -1;
        cinemaDirty = true;
        if (cinemaBeam) cinemaBeam.visible = true;
        queueWorldStateChange('cinema_lesson', -1);
      } else if (hit.type === 'lesson') {
        cinemaLessonIdx = hit.idx;
        cinemaPlaying = true;
        cinemaTime = 0;
        cinemaDirty = true;
        if (cinemaBeam) cinemaBeam.visible = true;
        queueWorldStateChange('cinema_lesson', cinemaLessonIdx);
        queueWorldStateChange('cinema_playing', 1);
      } else if (hit.type === 'toggle_play') {
        cinemaPlaying = !cinemaPlaying;
        cinemaDirty = true;
        if (cinemaBeam) cinemaBeam.visible = cinemaPlaying;
        queueWorldStateChange('cinema_playing', cinemaPlaying ? 1 : 0);
      }
      return;
    }
    if (hoveredRankBtn) {
      window.__MYCO_MODULES__.staircaseClock.scrollRanking(hoveredRankBtn);
      return;
    }
    if (hoveredSeat) {
      if (isSeatOccupied(hoveredSeat)) return;
      seatedSeat = hoveredSeat;
      playerPos.set(seatedSeat.x, seatedSeat.y, seatedSeat.z);
      playerYaw = seatedSeat.yaw;
      if (playerPitch < -0.06) playerPitch = -0.02;
      playerVelX = 0; playerVelZ = 0; playerVelY = 0;
      notifyWorldAction();
      return;
    }
    if (hoveredSwitch) {
      hoveredSwitch.on = !hoveredSwitch.on;
      if (hoveredSwitch.light) {
        hoveredSwitch.light.visible = hoveredSwitch.on;
        hoveredSwitch.light.intensity = hoveredSwitch.on ? 1.35 : 0;
      }
      if (hoveredSwitch.gLight) {
        hoveredSwitch.gLight.visible = hoveredSwitch.on;
        hoveredSwitch.gLight.intensity = hoveredSwitch.on ? 0.65 : 0;
      }
      if (hoveredSwitch.tubeMat) {
        hoveredSwitch.tubeMat.emissive.setHex(hoveredSwitch.on ? 0xfffbeb : 0x1e293b);
        hoveredSwitch.tubeMat.emissiveIntensity = hoveredSwitch.on ? 0.85 : 0.02;
      }
      if (hoveredSwitch.ledMat) {
        hoveredSwitch.ledMat.color.setHex(hoveredSwitch.on ? 0x22c55e : 0xef4444);
      }
      if (hoveredSwitch.rocker) {
        hoveredSwitch.rocker.rotation.x = hoveredSwitch.on ? -0.22 : 0.22;
      }
      if (window.MycoAudio) window.MycoAudio.playSwitch();
      queueWorldStateChange(hoveredSwitch.id, hoveredSwitch.on ? 1 : 0);
      return;
    }
    if (hoveredHoodSwitch) {
      hoveredHoodSwitch.on = !hoveredHoodSwitch.on;
      hoveredHoodSwitch.points.visible = hoveredHoodSwitch.on;
      hoveredHoodSwitch.hepaMat.emissiveIntensity = hoveredHoodSwitch.on ? 0.45 : 0.04;
      hoveredHoodSwitch.ledMat.color.setHex(hoveredHoodSwitch.on ? 0x22c55e : 0xef4444);
      if (hoveredHoodSwitch.workLight) {
        hoveredHoodSwitch.workLight.visible = hoveredHoodSwitch.on;
        hoveredHoodSwitch.workLight.intensity = hoveredHoodSwitch.on ? 0.95 : 0;
      }
      if (window.MycoAudio) window.MycoAudio.playSwitch();
      queueWorldStateChange('hood_lab', hoveredHoodSwitch.on ? 1 : 0);
      if (hoveredHoodSwitch.on && callbacks.onLabStep) callbacks.onLabStep('hood_on');
      return;
    }
    if (hoveredStirSwitch) {
      hoveredStirSwitch.on = !hoveredStirSwitch.on;
      hoveredStirSwitch.ledMat.color.setHex(hoveredStirSwitch.on ? 0x22c55e : 0xef4444);
      queueWorldStateChange('stir_lab', hoveredStirSwitch.on ? 1 : 0);
      return;
    }
    if (hoveredScaleTare) {
      hoveredScaleTare.tare = hoveredScaleTare.lastGross || 0;
      hoveredScaleTare.draw(0);
      return;
    }
    if (hoveredBurnerSwitch) {
      hoveredBurnerSwitch.on = !hoveredBurnerSwitch.on;
      hoveredBurnerSwitch.ledMat.color.setHex(hoveredBurnerSwitch.on ? 0x22c55e : 0xef4444);
      if (hoveredBurnerSwitch.knobGroup) {
        hoveredBurnerSwitch.knobGroup.rotation.z = hoveredBurnerSwitch.on ? -1.45 : 0;
      }
      queueWorldStateChange('burner_lab', hoveredBurnerSwitch.on ? 1 : 0);
      if (hoveredBurnerSwitch.on && callbacks.onLabStep) callbacks.onLabStep('cooker_heat');
      return;
    }
    if (hoveredPickable) {
      if (hoveredPickable.mesh.userData.isBlockedPickup && hoveredPickable.mesh.userData.isBlockedPickup(hoveredPickable)) {
        return;
      }
      if (hoveredPickable.potItem && hoveredPickable.isAttached) {
        for (var cpLockIdx = 0; cpLockIdx < cookerPots.length; cpLockIdx++) {
          var cpLock = cookerPots[cpLockIdx];
          if (cpLock.lidItem === hoveredPickable && cpLock.psi >= 1.5) {
            if (window.MycoAudio) window.MycoAudio.playClick();
            if (callbacks.onToast) {
              callbacks.onToast('🔒 Tampa travada pela pressão (' + cpLock.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar (< 1.5 PSI).');
            }
            return;
          }
        }
        var lidIt = hoveredPickable;
        lidIt.isAttached = false;
        heldItem = lidIt;
        lastPickupAt = performance.now();
    setHeldTwoHandedGhost(heldItem, false);
        if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
        notifyWorldAction();
        return;
      }
      if (hoveredPickable.lidItem) {
        for (var cpPotIdx = 0; cpPotIdx < cookerPots.length; cpPotIdx++) {
          var cpPot = cookerPots[cpPotIdx];
          if (cpPot.potItem === hoveredPickable && cpPot.psi >= 1.5) {
            if (window.MycoAudio) window.MycoAudio.playClick();
            if (callbacks.onToast) {
              callbacks.onToast('🔒 Panela pressurizada (' + cpPot.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar.');
            }
            return;
          }
        }
      }
      for (var cpIdx = 0; cpIdx < cookerPots.length; cpIdx++) {
        var idxInPot = cookerPots[cpIdx].contents.indexOf(hoveredPickable);
        if (idxInPot !== -1) cookerPots[cpIdx].contents.splice(idxInPot, 1);
      }
      // Se pegar uma bandeja inox, carrega junto todos os itens que estiverem dentro dela!
      hoveredPickable.trayContents = null;
      if (hoveredPickable.mesh && hoveredPickable.mesh.userData.isTray && hoveredPickable.mesh.userData.dynamicSurface) {
        var tSurf = hoveredPickable.mesh.userData.dynamicSurface;
        var tPos = hoveredPickable.mesh.position;
        var tRy = hoveredPickable.mesh.rotation.y;
        var cT = Math.cos(-tRy), sT = Math.sin(-tRy);
        var carried = [];
        for (var ti = 0; ti < pickableItems.length; ti++) {
          var cand = pickableItems[ti];
          if (!cand || cand === hoveredPickable || !cand.mesh || isHeldByRemote(cand.id)) continue;
          if (cand.mesh.userData.isTable || cand.mesh.userData.isHood || cand.mesh.userData.isTray) continue;
          var cp = cand.mesh.position;
          if (cp.x >= tSurf.minX - 0.04 && cp.x <= tSurf.maxX + 0.04 &&
            cp.z >= tSurf.minZ - 0.04 && cp.z <= tSurf.maxZ + 0.04 &&
            cp.y >= tSurf.topY - 0.04 && cp.y <= tSurf.topY + 0.35) {
            var dx = cp.x - tPos.x, dz = cp.z - tPos.z;
            carried.push({
              item: cand,
              lx: dx * cT + dz * sT,
              ly: cp.y - tPos.y,
              lz: -dx * sT + dz * cT,
              lry: cand.mesh.rotation.y - tRy
            });
          }
        }
        if (carried.length) hoveredPickable.trayContents = carried;
      }
      heldItem = hoveredPickable;
      lastPickupAt = performance.now();
      heldRotY = heldItem.mesh.rotation.y;
      setHeldTwoHandedGhost(heldItem, true);
      if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
      notifyWorldAction();
    }
  }

  function isSeatOccupied(seat) {
    if (!seat) return false;
    for (var avId in remoteAvatars) {
      if (!Object.prototype.hasOwnProperty.call(remoteAvatars, avId)) continue;
      var av = remoteAvatars[avId];
      if (!av || !av.targetPos) continue;
      if (av.seated && Math.hypot(av.targetPos.x - seat.x, av.targetPos.z - seat.z) < 0.48 && Math.abs(av.targetPos.y - seat.y) < 0.85) {
        return true;
      }
    }
    return false;
  }

  function firstValidRayHit(hits) {
    for (var hi = 0; hi < hits.length; hi++) {
      if (!hits[hi].object.userData.ignoreRay) return hits[hi];
    }
    return null;
  }

  function updateHoverRay(customNdc) {
    hoveredPickable = null;
    hoveredMushroom = null;
    hoveredDoorObj = null;
    hoveredBlindObj = null;
    hoveredBoardHit = null;
    hoveredCinema = false;
    hoveredCinemaUv = null;
    hoveredRankBtn = null;
    hoveredSeat = null;
    hoveredSwitch = null;
    hoveredHoodSwitch = null;
    hoveredStirSwitch = null;
    hoveredSyringeTarget = null;
    hoveredScaleTare = null;
    hoveredBurnerSwitch = null;
    hoveredPotInsert = null;
    hoveredSprayTarget = null;
    var prompt = '';

    var rayNdc = customNdc || (inFps ? _vZero2 : pointerNdc);
    raycaster.setFromCamera(rayNdc, camera);

    if (heldItem) {
      var toolCol = getHeldBoardToolColor();
      if (toolCol && chalkboardMeshes.length) {
        var bHits = raycaster.intersectObjects(chalkboardMeshes, false);
        if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
          hoveredBoardHit = bHits[0];
          hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
          if (placementGhost) placementGhost.visible = false;
          var touchUi = isTouchDevice();
          prompt = toolCol === 'erase'
            ? (touchUi ? '🧽 Arraste na lousa para apagar' : '🧽 Segure o clique para apagar a lousa')
            : (touchUi ? '✏️ Arraste na lousa para escrever' : '✏️ Segure o clique para escrever na lousa');
          if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
          return;
        }
      }
      if (heldItem.mesh.userData.isAlcoholSpray) {
        var spRefX = inFps ? playerPos.x : camera.position.x;
        var spRefZ = inFps ? playerPos.z : camera.position.z;
        for (var ai = 0; ai < pickableItems.length; ai++) {
          var aCand = pickableItems[ai];
          if (aCand === heldItem || isHeldByRemote(aCand.id)) continue;
          var adx = aCand.mesh.position.x - spRefX, adz = aCand.mesh.position.z - spRefZ;
          if (adx * adx + adz * adz > 100) continue;
          var aHit = firstValidRayHit(raycaster.intersectObject(aCand.mesh, true));
          if (aHit && aHit.distance < 3.5) {
            hoveredSprayTarget = aCand.mesh.userData.isHood ? 'hood' : aCand;
            placementGhost.visible = false;
            if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('🧴 Borrifar Álcool 70% (' + aCand.label + ')');
            return;
          }
        }
      }
      if (!heldItem.mesh.userData.twoHanded && !heldItem.mesh.userData.isSyringe && !heldItem.mesh.userData.isAlcoholSpray) {
        for (var ci = 0; ci < cookerPots.length; ci++) {
          var cp = cookerPots[ci];
          if (cp.lidItem.isAttached || cp.contents.length >= 4) continue;
          var cpHits = raycaster.intersectObject(cp.potItem.mesh, true);
          if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
            hoveredPotInsert = cp;
            placementGhost.visible = false;
            if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('🍲 Colocar ' + heldItem.label + ' dentro da Panela');
            return;
          }
        }
      }
      if (heldItem.mesh.userData.isSyringe) {
        var sc = heldItem.mesh.userData.syrCtrl;
        var syRefX = inFps ? playerPos.x : camera.position.x;
        var syRefZ = inFps ? playerPos.z : camera.position.z;
        for (var si = 0; si < pickableItems.length; si++) {
          var cand = pickableItems[si];
          if (cand === heldItem || isHeldByRemote(cand.id)) continue;
          var sydx = cand.mesh.position.x - syRefX, sydz = cand.mesh.position.z - syRefZ;
          if (sydx * sydx + sydz * sydz > 100) continue;
          var sHit = firstValidRayHit(raycaster.intersectObject(cand.mesh, true));
          if (sHit && sHit.distance < 4.2) {
            if (cand.mesh.userData.liquidCtrl) {
              var lc = cand.mesh.userData.liquidCtrl;
              if (syringePumping) {
                hoveredSyringeTarget = { item: cand, mode: syringePumping.toVol > syringePumping.fromVol ? 'draw' : 'inject' };
                placementGhost.visible = false;
                var pPct = Math.round((syringePumping.elapsed / syringePumping.duration) * 100);
                if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('⏳ ' + (syringePumping.toVol > syringePumping.fromVol ? 'Aspirando Micélio' : 'Injetando de volta') + ' (' + pPct + '%)...');
                return;
              }
              if (sc.volMl < 9.9 && lc.volMl > 0) {
                hoveredSyringeTarget = { item: cand, mode: 'draw' };
                placementGhost.visible = false;
                if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('💉 Furando Septo • Clique para aspirar cultura líquida (2s)');
                return;
              } else if (sc.volMl > 0.1) {
                hoveredSyringeTarget = { item: cand, mode: 'inject' };
                placementGhost.visible = false;
                if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('💉 Seringa cheia (' + Math.round(sc.volMl) + 'ml) • Clique para esvaziar de volta (2s)');
                return;
              }
            } else if (sc.volMl > 0 && (cand.id.indexOf('spawn_') === 0 || (cand.id.indexOf('petri_') === 0 && cand.id.indexOf('petri_bare_') !== 0))) {
              hoveredSyringeTarget = { item: cand, mode: 'inject' };
              placementGhost.visible = false;
              if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('💉 Inocular ' + Math.round(sc.volMl) + 'ml em ' + cand.label + ' (2s)');
              return;
            }
          }
        }
      }
      if (heldItem.mesh.userData.isThermometer) {
        if (placementGhost) placementGhost.visible = false;
        if (thermoLaserOn) {
          prompt = '🔴 [SCAN] ' + (thermoTargetLabel || 'Ambiente') + ': ' + thermoCurrentTemp.toFixed(1) + '°C (Clique: Desligar Laser • Tecla G ou clique dir.: Soltar)';
        } else {
          prompt = '🔫 Laser DESLIGADO • Última: ' + thermoCurrentTemp.toFixed(1) + '°C [HOLD] (Clique: Ligar Laser • Tecla G ou clique dir.: Soltar)';
        }
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
      var pt = findPlacementTarget(rayNdc);
      placementValid = !isPlacementBlocked(pt);
      placementGhost.position.copy(pt);
      updatePlacementGhostVisual(heldItem, placementValid, heldRotY);
      placementGhost.visible = true;
      if (snapClosePot) {
        prompt = '🍲 Fechar tampa na Panela de Pressão';
      } else {
        prompt = placementValid ? 'Soltar: ' + heldItem.label : (placementBlockedReason || '🚫 Local bloqueado (espaço ocupado)');
      }
      if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
      return;
    }
    if (placementGhost) placementGhost.visible = false;

    if (rankingBtnMeshes.length) {
      var rHits = raycaster.intersectObjects(rankingBtnMeshes, false);
      if (rHits.length > 0 && rHits[0].distance < 18) {
        hoveredRankBtn = rHits[0].object.userData.rankAction;
        prompt = hoveredRankBtn === 'up' ? '▲ Subir Ranking' : '▼ Descer Ranking';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (cinemaScreenMesh) {
      var cHits = raycaster.intersectObject(cinemaScreenMesh, false);
      if (cHits.length > 0 && cHits[0].distance < 22) {
        hoveredCinema = true;
        hoveredCinemaUv = cHits[0].uv ? { x: cHits[0].uv.x, y: 1 - cHits[0].uv.y } : { x: 0.5, y: 0.5 };
        var cTarget = getCinemaHitTarget(hoveredCinemaUv);
        if (cTarget.type !== lastCinemaHoverType || (cTarget.idx || -1) !== lastCinemaHoverIdx) {
          lastCinemaHoverType = cTarget.type;
          lastCinemaHoverIdx = cTarget.idx !== undefined ? cTarget.idx : -1;
          cinemaDirty = true;
        }
        if (cTarget.type === 'power_on') prompt = '⏻ Clique na tela para ligar o Auditório';
        else if (cTarget.type === 'power_off') prompt = '⏻ Desligar tela do Auditório';
        else if (cTarget.type === 'menu') prompt = '📋 Voltar ao menu de módulos';
        else if (cTarget.type === 'lesson') prompt = '▶️ Assistir: ' + ((cinemaLessons[cTarget.idx] && cinemaLessons[cTarget.idx].title) || 'Aula');
        else if (cTarget.type === 'toggle_play') prompt = cinemaPlaying ? '⏸️ Clique na aula para pausar' : '▶️ Clique na aula para continuar';
        else prompt = '🎬 Escolha um módulo na tela para assistir';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (scaleTareMeshes.length) {
      var tHits = raycaster.intersectObjects(scaleTareMeshes, false);
      if (tHits.length > 0 && tHits[0].distance < 3.5) {
        hoveredScaleTare = tHits[0].object.userData.scaleObj;
        prompt = '⚖️ Zerar Balança (TARE)';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (burnerSwitchMeshes.length && (!heldItem || !heldItem.mesh.userData.isBurner)) {
      var bHits = raycaster.intersectObjects(burnerSwitchMeshes, false);
      if (bHits.length > 0 && bHits[0].distance < 4.0) {
        hoveredBurnerSwitch = burnerDevices[bHits[0].object.userData.burnerSwitchIdx];
        prompt = hoveredBurnerSwitch.on ? '🔥 Desligar Fogareiro' : '🔥 Ligar Fogareiro';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (stirSwitchMeshes.length && (!heldItem || !heldItem.mesh.userData.isStirrer)) {
      var stSwHits = raycaster.intersectObjects(stirSwitchMeshes, false);
      if (stSwHits.length > 0 && stSwHits[0].distance < 4.0) {
        hoveredStirSwitch = stSwHits[0].object.userData.stirSwitch;
        prompt = hoveredStirSwitch.on ? '🌀 Desligar Agitador Magnético' : '🌀 Ligar Agitador Magnético';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (hoodSwitchMeshes.length) {
      var hsHits = raycaster.intersectObjects(hoodSwitchMeshes, false);
      if (hsHits.length > 0 && hsHits[0].distance < 4.0) {
        hoveredHoodSwitch = hsHits[0].object.userData.hoodSwitch;
        prompt = hoveredHoodSwitch.on ? '💨 Desligar Fluxo Laminar' : '💨 Ligar Fluxo Laminar';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (lightSwitchMeshes.length) {
      var swHits = raycaster.intersectObjects(lightSwitchMeshes, false);
      if (swHits.length > 0 && swHits[0].distance < 4.0) {
        hoveredSwitch = swHits[0].object.userData.lightSwitch;
        prompt = hoveredSwitch.on ? '💡 Clique para desligar a luz' : '💡 Clique para ligar a luz';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (seatMeshes.length) {
      var stHits = raycaster.intersectObjects(seatMeshes, false);
      if (stHits.length > 0 && stHits[0].distance < 4.2) {
        var candSeat = stHits[0].object.userData.seatInfo;
        if (isSeatOccupied(candSeat)) {
          prompt = '🚫 Assento ocupado (sente ao lado!)';
        } else {
          hoveredSeat = candSeat;
          prompt = '🪑 Clique para sentar';
        }
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (!prompt && doorHitMeshes.length) {
      var doorHits = raycaster.intersectObjects(doorHitMeshes, false);
      if (doorHits.length > 0 && doorHits[0].distance < 5.0) {
        hoveredDoorObj = doorHits[0].object.userData.doorObj;
        prompt = '🚪 ' + (hoveredDoorObj.open ? 'Fechar ' : 'Abrir ') + hoveredDoorObj.label;
      }
    }
    var refX = inFps ? playerPos.x : camera.position.x;
    var refZ = inFps ? playerPos.z : camera.position.z;
    var maxMushSq = inFps ? 24 : 225;
    var maxPickSq = inFps ? 26 : 225;
    if (!prompt) {
      for (var m = 0; m < wildMushrooms.length; m++) {
        var wm = wildMushrooms[m];
        if (!wm.active) continue;
        var mdx = wm.group.position.x - refX, mdz = wm.group.position.z - refZ;
        if (mdx * mdx + mdz * mdz > maxMushSq) continue;
        var mHits = raycaster.intersectObject(wm.group, true);
        if (mHits.length > 0 && mHits[0].distance < 4.5) {
          hoveredMushroom = wm;
          prompt = '🍄 Colher Cogumelo (+25 XP)';
          break;
        }
      }
    }
    if (!prompt) {
      var bestSmall = null, bestSmallDist = Infinity;
      var bestLarge = null, bestLargeDist = Infinity;
      var bestBlocked = null, bestBlockedDist = Infinity;
      for (var i = 0; i < pickableItems.length; i++) {
        var item = pickableItems[i];
        if (item === heldItem || (heldItem && item === heldItem.lidItem)) continue;
        if (isHeldByRemote(item.id)) continue;
        var idx = item.mesh.position.x - refX, idz = item.mesh.position.z - refZ;
        if (idx * idx + idz * idz > maxPickSq) continue;
        var hit0 = firstValidRayHit(raycaster.intersectObject(item.mesh, true));
        if (hit0 && hit0.distance < 4.5) {
          var dHit = hit0.distance;
          // Se mirar na parte superior da panela de pressão com tampa acoplada, prioriza a tampa!
          if (item.lidItem && item.lidItem.isAttached && hit0.point.y >= item.mesh.position.y + 0.26) {
            item = item.lidItem;
          }
          if (isItemInsideClosedCooker(item)) continue;
          if (item.mesh.userData.isBlockedPickup && item.mesh.userData.isBlockedPickup(item)) {
            if (dHit < bestBlockedDist) {
              bestBlockedDist = dHit;
              bestBlocked = item;
            }
            continue;
          }
          if (item.mesh.userData.isTable || item.mesh.userData.isHood) {
            if (dHit < bestLargeDist) {
              bestLargeDist = dHit; bestLarge = item;
            }
          } else if (dHit < bestSmallDist) {
            bestSmallDist = dHit; bestSmall = item;
          }
        }
      }
      hoveredPickable = bestSmall || bestLarge;
      if (!hoveredPickable && bestBlocked && bestBlockedDist < 3.8) {
        if (bestBlocked.mesh.userData.isBurner) {
          prompt = '🚫 Retire a panela de cima antes de mover o Fogareiro';
        } else {
          prompt = '🚫 Retire os objetos de cima antes de mover ' + bestBlocked.label;
        }
      } else if (hoveredPickable) {
        var potStatus = null;
        for (var cpi = 0; cpi < cookerPots.length; cpi++) {
          if (cookerPots[cpi].potItem === hoveredPickable || cookerPots[cpi].lidItem === hoveredPickable) {
            potStatus = cookerPots[cpi]; break;
          }
        }
        if (hoveredPickable.potItem && hoveredPickable.isAttached) {
          if (potStatus && potStatus.psi >= 1.5) {
            var pctP = Math.min(100, Math.round((potStatus.psi / 15) * 100));
            if (potStatus.progress >= 100) {
              prompt = '🔒 Tampa Travada (' + potStatus.psi.toFixed(1) + ' PSI • ✅ 100%) — Desligue o fogo e aguarde';
            } else if (potStatus.psi >= 14) {
              prompt = '🔒 Esterilizando: ' + potStatus.psi.toFixed(1) + '/15 PSI (' + pctP + '%) • ' + Math.floor(potStatus.progress) + '%';
            } else {
              prompt = '🔒 Pressurizada: ' + potStatus.psi.toFixed(1) + '/15 PSI (' + pctP + '%) — Aguarde < 1.5 PSI';
            }
          } else if (potStatus && potStatus.progress >= 100) {
            prompt = '🍲 Retirar Tampa (🔓 Despressurizada • ✅ Esterilizado 100%)';
          } else if (potStatus && potStatus.temp > 32) {
            prompt = '🍲 Retirar Tampa (🔥 Aquecendo: ' + Math.round(potStatus.temp) + '°C)';
          } else {
            prompt = '🍲 Retirar Tampa da Panela de Pressão';
          }
        } else if (hoveredPickable.mesh.userData.twoHanded) {
          prompt = '🙌 Pegar ' + hoveredPickable.label + ' (2 mãos)';
        } else {
          prompt = '✋ Pegar ' + hoveredPickable.label;
        }
      }
    }
    if (!prompt && blindHitMeshes.length) {
      var blHits = raycaster.intersectObjects(blindHitMeshes, false);
      if (blHits.length > 0 && blHits[0].distance < 5.5) {
        hoveredBlindObj = blHits[0].object.userData.blindObj;
        prompt = hoveredBlindObj.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana';
      }
    }
    hoveredGreenhouseSlot = null;
    var ghHitsMeshes = getGreenhouseHitMeshes();
    if (!prompt && ghHitsMeshes.length > 0) {
      var ghHits = raycaster.intersectObjects(ghHitsMeshes, true);
      if (ghHits.length > 0 && ghHits[0].distance < 4.8) {
        var hSlot = ghHits[0].object.userData.greenhouseSlot;
        if (hSlot) {
          hoveredGreenhouseSlot = hSlot;
          var isHoldingSpray = heldItem && (heldItem.id.indexOf('alcohol_spray') !== -1 || heldItem.id.indexOf('spray') !== -1);
          if (hSlot.stage === 3) {
            prompt = '🍄 Colher ' + hSlot.name + ' (+50 XP e +2 Cogumelos)';
          } else if (isHoldingSpray) {
            prompt = '💦 Borrifar e Hidratar ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR)';
          } else {
            prompt = '🌱 ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR • ' + (hSlot.stage === 0 ? 'Micélio' : (hSlot.stage === 1 ? 'Primórdios' : 'Crescendo')) + ')';
          }
        }
      }
    }
    if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
  }

  function stepLobbyTour(dt) {
    tourTime += dt;
    var cycle = tourTime % 36;
    var camPos = new THREE.Vector3();
    var lookAt = new THREE.Vector3();

    if (cycle < 12) {
      // Vista panoramica da praca, fonte do cogumelo e ponte da Torre do Relogio
      var t0 = cycle / 12;
      camPos.set(-14 + t0 * 28, 16.0 - Math.sin(t0 * Math.PI) * 3.0, 26 - t0 * 4);
      lookAt.set(0, 3.5, -12);
    } else if (cycle < 24) {
      // Sobrevoo pelo Lago em 8 e Complexo Esportivo
      var t1 = (cycle - 12) / 12;
      camPos.set(16 - t1 * 48, 22.0, 36 - t1 * 28);
      lookAt.set(-22, 1.5, 4);
    } else {
      // Retorno pelo Student Center, Praca Leste e Montanhas
      var t2 = (cycle - 24) / 12;
      camPos.set(52 - t2 * 64, 24.0, 28 - Math.sin(t2 * Math.PI) * 18);
      lookAt.set(8, 2.5, -6);
    }

    camera.position.lerp(camPos, Math.min(1, dt * 1.4));
    controls.target.lerp(lookAt, Math.min(1, dt * 1.8));
    controls.update();
  }

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
