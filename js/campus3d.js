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
  var auditoriumScreenMeshes = [];
  var screenActionMeshes = []; // botoes 3D [◀, ▶, 📚] presos aos teloes
  var auditoriumCanvas = null;
  var auditoriumCtx = null;
  var auditoriumTex = null;
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

  // Braco 1a pessoa, Corpo local & Lousas Interativas
  var fpsArmGroup = null;
  var fpsLeftArmGroup = null;
  var fpsSleeveMat = null;
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
  var scaleTareMeshes = [];
  var hoveredScaleTare = null;
  var scaleDevices = [];
  var burnerSwitchMeshes = [];
  var hoveredBurnerSwitch = null;
  var burnerDevices = [];
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
  var snowMix = 0;
  var snowableEntries = []; // { mat, baseColor }
  function registerSnowable(mat) {
    if (mat && mat.color && !mat._snowRegistered) {
      mat._snowRegistered = true;
      snowableEntries.push({ mat: mat, base: mat.color.clone() });
    }
    return mat;
  }

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

  // ---------------- Texturas Procedurais ----------------

  function createProceduralTextures() {
    // 1. Tijolinho a vista
    var bc = document.createElement('canvas');
    bc.width = 256; bc.height = 256;
    var bctx = bc.getContext('2d');
    bctx.fillStyle = '#9e9589'; // argamassa
    bctx.fillRect(0, 0, 256, 256);
    var brickPalette = ['#8c4632', '#7a3b29', '#994e38', '#6f3424', '#85422f'];
    var rows = 8, cols = 4, bh = 256 / rows, bw = 256 / cols;
    for (var r = 0; r < rows; r++) {
      var off = (r % 2) * (bw / 2);
      for (var c = -1; c <= cols; c++) {
        bctx.fillStyle = brickPalette[(r * 5 + c + 10) % brickPalette.length];
        bctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    texBrick = new THREE.CanvasTexture(bc);
    texBrick.wrapS = THREE.RepeatWrapping;
    texBrick.wrapT = THREE.RepeatWrapping;

    // 2. Bloquete da praca
    var pc = document.createElement('canvas');
    pc.width = 256; pc.height = 256;
    var pctx = pc.getContext('2d');
    pctx.fillStyle = '#8b8175';
    pctx.fillRect(0, 0, 256, 256);
    var pavePalette = ['#bfb1a0', '#b2a392', '#c8bba9', '#a89a8a'];
    for (var pr = 0; pr < 16; pr++) {
      var poff = (pr % 2) * 16;
      for (var pcCol = -1; pcCol < 9; pcCol++) {
        pctx.fillStyle = pavePalette[(pr * 3 + pcCol + 20) % pavePalette.length];
        pctx.fillRect(pcCol * 32 + poff + 1.5, pr * 16 + 1.5, 29, 13);
      }
    }
    texPaving = new THREE.CanvasTexture(pc);
    texPaving.wrapS = THREE.RepeatWrapping;
    texPaving.wrapT = THREE.RepeatWrapping;
    texPaving.repeat.set(16, 18);

    // 3. Madeira ripada
    var wc = document.createElement('canvas');
    wc.width = 128; wc.height = 128;
    var wctx = wc.getContext('2d');
    wctx.fillStyle = '#6b4226';
    wctx.fillRect(0, 0, 128, 128);
    var woodCols = ['#8b5a2b', '#7a4b22', '#966332', '#6f421d'];
    for (var i = 0; i < 8; i++) {
      wctx.fillStyle = woodCols[i % woodCols.length];
      wctx.fillRect(i * 16 + 1, 0, 14, 128);
    }
    texWood = new THREE.CanvasTexture(wc);
    texWood.wrapS = THREE.RepeatWrapping;
    texWood.wrapT = THREE.RepeatWrapping;

    // 4. Agua cristalina com caustics / ondulacoes suaves
    var watC = document.createElement('canvas');
    watC.width = 256; watC.height = 256;
    var watCtx = watC.getContext('2d');
    var wg = watCtx.createLinearGradient(0, 0, 256, 256);
    wg.addColorStop(0, '#0284c7');
    wg.addColorStop(0.5, '#0ea5e9');
    wg.addColorStop(1, '#0369a1');
    watCtx.fillStyle = wg;
    watCtx.fillRect(0, 0, 256, 256);
    for (var wi = 0; wi < 42; wi++) {
      var wx = (wi * 53) % 256;
      var wy = (wi * 79) % 256;
      var wr = 18 + (wi % 5) * 9;
      watCtx.strokeStyle = wi % 2 === 0 ? 'rgba(186, 230, 253, 0.34)' : 'rgba(56, 189, 248, 0.38)';
      watCtx.lineWidth = 2.2;
      watCtx.beginPath();
      watCtx.ellipse(wx, wy, wr * 1.35, wr * 0.65, (wi % 4) * 0.4, 0, Math.PI * 2);
      watCtx.stroke();
    }
    for (var wj = 0; wj < 28; wj++) {
      watCtx.fillStyle = 'rgba(224, 242, 254, 0.25)';
      watCtx.beginPath();
      watCtx.arc((wj * 67) % 256, (wj * 43) % 256, 4 + (wj % 3) * 3, 0, Math.PI * 2);
      watCtx.fill();
    }
    texWater = new THREE.CanvasTexture(watC);
    texWater.wrapS = THREE.RepeatWrapping;
    texWater.wrapT = THREE.RepeatWrapping;
    texWater.repeat.set(3, 3);
  }

  function brickMat(repX, repY) {
    var t = texBrick.clone();
    t.needsUpdate = true;
    t.repeat.set(repX || 2, repY || 2);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.86, metalness: 0.04 });
  }

  function woodMat(repX, repY) {
    var t = texWood.clone();
    t.needsUpdate = true;
    t.repeat.set(repX || 2, repY || 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0.05 });
  }

  function makeBox(w, h, d, colorOrMat, opts) {
    opts = opts || {};
    var geo = new THREE.BoxGeometry(w, h, d);
    var mat = (colorOrMat && colorOrMat.isMaterial) ? colorOrMat : new THREE.MeshStandardMaterial({
      color: colorOrMat,
      roughness: opts.roughness !== undefined ? opts.roughness : 0.7,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.1,
      transparent: !!opts.transparent,
      opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 0
    });
    var m = new THREE.Mesh(geo, mat);
    m.castShadow = !opts.noShadow;
    m.receiveShadow = true;
    return m;
  }

  // ---------------- Altura do Terreno & Pisos Elevados ----------------

  function terrainHeight(x, z) {
    // Plato plano amplo para todo o mega-campus (-78..78, -50..52)
    var distCenter = Math.max(Math.abs(x) - 76, Math.abs(z - 1) - 50);
    if (distCenter <= 0) return 0;
    var blend = Math.min(1, distCenter / 24);

    // Anel de montanhas distantes ao redor do horizonte (r > 125m)
    var r = Math.hypot(x, z);
    var mtn = 0;
    if (r > 120) {
      var mt = Math.min(1, (r - 120) / 55);
      var ridge = Math.abs(Math.sin(x * 0.032 + z * 0.021) * Math.cos(z * 0.028 - x * 0.017));
      mtn = mt * mt * (14 + ridge * 26);
    }

    var hills = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.4 + Math.sin(x * 0.11 + z * 0.09) * 0.7;
    return blend * hills + mtn;
  }

  function getGroundHeight(x, z, refY) {
    var h = terrainHeight(x, z);
    var curY = refY !== undefined ? refY : playerPos.y;

    // Escadas automaticas
    for (var s = 0; s < stairsList.length; s++) {
      var st = stairsList[s];
      if (x >= st.minX && x <= st.maxX && z <= Math.max(st.zStart, st.zEnd) && z >= Math.min(st.zStart, st.zEnd)) {
        var t = (z - st.zStart) / (st.zEnd - st.zStart);
        t = Math.max(0, Math.min(1, t));
        var sy = st.yStart + t * (st.yEnd - st.yStart);
        if (curY >= sy - 1.2) h = Math.max(h, sy);
      }
    }

    // Lajes caminhaveis automaticas (2o andar, passarela, terraco, terreo)
    for (var f = 0; f < walkableFloors.length; f++) {
      var fl = walkableFloors[f];
      if (x >= fl.minX && x <= fl.maxX && z >= fl.minZ && z <= fl.maxZ) {
        if (curY >= fl.topY - 1.1) {
          h = Math.max(h, fl.topY);
        }
      }
    }

    return h;
  }

  function addWalkableSlab(cx, topY, cz, w, thickness, d, colorOrMat, opts) {
    var mesh = makeBox(w, thickness, d, colorOrMat, opts);
    mesh.position.set(cx, topY - thickness / 2, cz);
    scene.add(mesh);
    walkableFloors.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
      topY: topY
    });
    return mesh;
  }

  function addSolidWall(x1, z1, x2, z2, minY, height, thickness, colorOrMat, opts) {
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    var mesh = makeBox(len, height, thickness, colorOrMat, opts);
    mesh.position.set((x1 + x2) / 2, minY + height / 2, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    scene.add(mesh);
    wallSegments.push({
      x1: x1, z1: z1, x2: x2, z2: z2,
      halfThick: thickness / 2 + 0.06,
      minY: minY, maxY: minY + height
    });
    return mesh;
  }

  // ---------------- Mundo Natural & Lago ----------------

  function buildNatureWorld() {
    var size = 480;
    var segs = 140;
    var geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = [];
    var cGrass = new THREE.Color(0x2f7038);
    var cGrassAlt = new THREE.Color(0x3c8444);
    var cMtn = new THREE.Color(0x1e462a);
    var cRock = new THREE.Color(0x475569);

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var y = terrainHeight(x, z);
      pos.setY(i, y);
      var col = ((Math.sin(x * 0.14) + Math.cos(z * 0.14)) > 0 ? cGrass : cGrassAlt).clone();
      if (y > 6) col.lerp(cMtn, Math.min(1, (y - 6) / 14));
      if (y > 22) col.lerp(cRock, Math.min(0.65, (y - 22) / 16));
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    terrainSnowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 });
    var terrain = new THREE.Mesh(geo, terrainSnowMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Floresta densa com InstancedMesh (~360 arvores em apenas 3 draw calls!)
    var treePositions = [];
    for (var idx = 0; idx < 420; idx++) {
      var ang = idx * 2.39996; // espiral de Fibonacci
      var rad = 64 + Math.sqrt(idx / 420) * 95;
      var tx = Math.cos(ang) * rad;
      var tz = Math.sin(ang) * rad * 0.85;
      // Mantem livre o miolo do campus (inclui quadras, student center, dormitorios e avenida)
      if (tx > -70 && tx < 74 && tz > -48 && tz < 46) continue;
      // Mantem livre a avenida de entrada Sudoeste
      if (tz > 34 && tz < 46 && tx > -80 && tx < 20) continue;
      treePositions.push({ x: tx, y: terrainHeight(tx, tz), z: tz, s: 0.85 + (idx % 5) * 0.18 });
    }
    // Arvores decorativas entre as alas e perto dos lagos
    var extraTrees = [
      [-29, 18], [-29, -2], [-29, -20], [29, 18], [29, -18],
      [-14, 24], [14, 24], [-18, 34], [18, 34], [28, 32],
      [-32, 34], [64, -12], [68, 22], [32, -28], [-32, -32]
    ];
    extraTrees.forEach(function (et, k) {
      treePositions.push({ x: et[0], y: 0, z: et[1], s: 0.95 + (k % 3) * 0.15 });
    });

    var count = treePositions.length;
    var trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 3.2, 7);
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    var cone1Geo = new THREE.ConeGeometry(2.1, 3.2, 8);
    var cone1Mat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 });
    var cone2Geo = new THREE.ConeGeometry(1.5, 2.6, 8);
    var cone2Mat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });

    var trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    var cone1Inst = new THREE.InstancedMesh(cone1Geo, cone1Mat, count);
    var cone2Inst = new THREE.InstancedMesh(cone2Geo, cone2Mat, count);
    trunkInst.castShadow = true;
    cone1Inst.castShadow = true;
    cone2Inst.castShadow = true;

    var dummy = new THREE.Object3D();
    treePositions.forEach(function (tp, i) {
      dummy.scale.setScalar(tp.s);
      dummy.position.set(tp.x, tp.y + 1.6 * tp.s, tp.z);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tp.x, tp.y + 3.6 * tp.s, tp.z);
      dummy.updateMatrix();
      cone1Inst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tp.x, tp.y + 5.2 * tp.s, tp.z);
      dummy.updateMatrix();
      cone2Inst.setMatrixAt(i, dummy.matrix);

      if (Math.abs(tp.x) < 90 && Math.abs(tp.z) < 70) {
        solidColliders.push({ minX: tp.x - 0.5, maxX: tp.x + 0.5, minZ: tp.z - 0.5, maxZ: tp.z + 0.5, minY: tp.y, maxY: tp.y + 5 });
      }
    });
    scene.add(trunkInst, cone1Inst, cone2Inst);

    // 32 Cogumelos Silvestres colhiveis (+25 XP) espalhados por todo o campus e bosques
    var mushCoords = [
      [-11.5, 15.5], [11.5, 15.5], [-26, 8], [-27, -6], [26, 8], [27, -6],
      [-26, 18], [26, 18], [-16, 22], [16, 22], [-10, 32], [10, 32],
      [-24, 34], [24, 34], [-34, 4], [-34, -24], [32, -24], [34, 24],
      [48, -24], [58, -16], [62, 2], [58, 34], [36, 36], [-48, 28],
      [-64, 16], [-68, -12], [-58, -42], [-24, -42], [24, -42], [44, -40],
      [-74, 2], [74, 10]
    ];
    var capColors = [0xef4444, 0xf59e0b, 0xa855f7, 0xec4899, 0x10b981];
    mushCoords.forEach(function (mc, idx) {
      var mx = mc[0], mz = mc[1];
      var my = terrainHeight(mx, mz);
      var g = new THREE.Group();
      g.position.set(mx, my, mz);
      var stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.14, 0.38, 8),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
      );
      stem.position.y = 0.19;
      g.add(stem);
      var capColor = capColors[idx % capColors.length];
      var cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.42, emissive: capColor, emissiveIntensity: 0.22 })
      );
      cap.position.y = 0.36; cap.castShadow = true;
      g.add(cap);
      scene.add(g);
      wildMushrooms.push({ id: 'wild_' + idx, group: g, capMesh: cap, active: true, respawnAt: 0 });
    });
  }

  // ---------------- Praca Central, Canteiros, Bancos & Fonte com Cogumelo ----------------

  function createFlowerBed(cx, cz, rx, rz, rotY) {
    var g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = rotY || 0;

    // Meio-fio de pedra clara
    var curbGeo = new THREE.CylinderGeometry(1, 1, 0.22, 24);
    var curbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 });
    var curb = new THREE.Mesh(curbGeo, curbMat);
    curb.scale.set(rx + 0.22, 1, rz + 0.22);
    curb.position.y = 0.11;
    curb.receiveShadow = true;
    g.add(curb);

    // Grama elevada
    var grassGeo = new THREE.CylinderGeometry(1, 1, 0.24, 24);
    var grassMat = new THREE.MeshStandardMaterial({ color: 0x3b8c3b, roughness: 0.9 });
    var grass = new THREE.Mesh(grassGeo, grassMat);
    grass.scale.set(rx, 1, rz);
    grass.position.y = 0.12;
    grass.receiveShadow = true;
    g.add(grass);

    // Arbustos e flores coloridas
    var flowerCols = [0xfacc15, 0xf43f5e, 0xa855f7, 0xf97316, 0x38bdf8];
    for (var i = 0; i < 16; i++) {
      var a = (i / 16) * Math.PI * 2;
      var rr = 0.35 + (i % 3) * 0.24;
      var fx = Math.cos(a) * rx * rr;
      var fz = Math.sin(a) * rz * rr;
      var bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.28 + (i % 2) * 0.12, 0),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x15803d : 0x16a34a, roughness: 0.85 })
      );
      bush.position.set(fx, 0.32, fz);
      bush.castShadow = true;
      g.add(bush);

      var fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 6, 6),
        new THREE.MeshStandardMaterial({ color: flowerCols[i % flowerCols.length], emissive: flowerCols[i % flowerCols.length], emissiveIntensity: 0.12 })
      );
      fl.position.set(fx, 0.54, fz);
      g.add(fl);
    }
    scene.add(g);
  }

  function createBench(x, z, rotY) {
    if (!createBench._woodMat) {
      var wc = document.createElement('canvas');
      wc.width = 512; wc.height = 128;
      var wctx = wc.getContext('2d');
      var grad = wctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#9a5b25');
      grad.addColorStop(0.5, '#b06d32');
      grad.addColorStop(1, '#854d1e');
      wctx.fillStyle = grad;
      wctx.fillRect(0, 0, 512, 128);
      for (var i = 0; i < 42; i++) {
        wctx.strokeStyle = i % 3 === 0 ? 'rgba(69, 26, 3, 0.28)' : 'rgba(120, 53, 15, 0.20)';
        wctx.lineWidth = 1 + (i % 3);
        wctx.beginPath();
        var baseY = (i / 42) * 128;
        wctx.moveTo(0, baseY);
        for (var wx = 32; wx <= 512; wx += 32) {
          wctx.lineTo(wx, baseY + Math.sin(wx * 0.025 + i * 0.7) * 5);
        }
        wctx.stroke();
      }
      var wTex = new THREE.CanvasTexture(wc);
      wTex.wrapS = wTex.wrapT = THREE.RepeatWrapping;
      createBench._woodMat = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.38, metalness: 0.06 });
      createBench._frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.30, metalness: 0.78 });
    }

    var woodM = createBench._woodMat;
    var frameM = createBench._frameMat;
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    // Estrutura tubular preta nas duas extremidades (fiel a foto de referencia!)
    [-0.88, 0.88].forEach(function (sx) {
      // Perna dianteira e traseira em tubo quadrado preto + sapatas
      var frontLeg = makeBox(0.046, 0.43, 0.046, frameM);
      frontLeg.position.set(sx, 0.215, 0.235);
      var rearLeg = makeBox(0.046, 0.43, 0.046, frameM);
      rearLeg.position.set(sx, 0.215, -0.225);
      var footF = makeBox(0.054, 0.014, 0.054, frameM, { noShadow: true });
      footF.position.set(sx, 0.007, 0.235);
      var footR = makeBox(0.054, 0.014, 0.054, frameM, { noShadow: true });
      footR.position.set(sx, 0.007, -0.225);
      // Travessa lateral horizontal do assento
      var sideBar = makeBox(0.046, 0.046, 0.506, frameM);
      sideBar.position.set(sx, 0.422, 0.005);
      // Coluna inclinada do encosto
      var backPost = makeBox(0.046, 0.51, 0.046, frameM);
      backPost.position.set(sx, 0.655, -0.268);
      backPost.rotation.x = -0.20;
      g.add(frontLeg, rearLeg, footF, footR, sideBar, backPost);
    });

    // Longarinas horizontais pretas sob o assento + travessa central
    var frontRail = makeBox(1.806, 0.040, 0.042, frameM);
    frontRail.position.set(0, 0.422, 0.235);
    var rearRail = makeBox(1.806, 0.040, 0.042, frameM);
    rearRail.position.set(0, 0.422, -0.225);
    var midBrace = makeBox(0.040, 0.036, 0.48, frameM, { noShadow: true });
    midBrace.position.set(0, 0.418, 0.005);
    g.add(frontRail, rearRail, midBrace);

    // 2 ripas largas de madeira envernizada no assento (com fresta central)
    var seatPlankF = makeBox(1.714, 0.034, 0.195, woodM);
    seatPlankF.position.set(0, 0.442, 0.115);
    var seatPlankR = makeBox(1.714, 0.034, 0.195, woodM);
    seatPlankR.position.set(0, 0.442, -0.105);

    // 2 ripas largas de madeira envernizada no encosto inclinado
    var backPlankLow = makeBox(1.714, 0.156, 0.032, woodM);
    backPlankLow.position.set(0, 0.585, -0.248);
    backPlankLow.rotation.x = -0.20;
    var backPlankHigh = makeBox(1.714, 0.156, 0.032, woodM);
    backPlankHigh.position.set(0, 0.782, -0.288);
    backPlankHigh.rotation.x = -0.20;

    g.add(seatPlankF, seatPlankR, backPlankLow, backPlankHigh);

    // Permite sentar no banco da praca (2 lugares lado a lado: esquerda e direita)
    var sitYaw = rotY + Math.PI;
    [-0.44, 0.44].forEach(function (offsetX) {
      var worldX = x + Math.cos(rotY) * offsetX + Math.sin(rotY) * 0.05;
      var worldZ = z - Math.sin(rotY) * offsetX + Math.cos(rotY) * 0.05;
      var seatHit = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.55, 0.56),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      seatHit.position.set(offsetX, 0.56, -0.02);
      seatHit.userData.seatInfo = { x: worldX, y: 0.02, z: worldZ, yaw: sitYaw };
      g.add(seatHit);
      seatMeshes.push(seatHit);
    });

    scene.add(g);
  }

  function createUmbrellaTable(x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.35, 8), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    pole.position.y = 1.18; pole.castShadow = true;
    var table = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 }));
    table.position.y = 0.76; table.castShadow = true;
    var canopy = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.52, 8), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 }));
    canopy.position.y = 2.35; canopy.castShadow = true;
    g.add(pole, table, canopy);
    scene.add(g);
    solidColliders.push({ minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.65, maxZ: z + 0.65, minY: 0, maxY: 2.5 });
  }

  function createCampusLamp(x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65 }));
    pole.position.y = 1.7; pole.castShadow = true;
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.85 }));
    bulb.position.y = 3.45;
    g.add(pole, bulb);
    scene.add(g);
  }

  function createBanner(x, y, z, rotY, colorHex, emblem) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 320;
    var ctx = c.getContext('2d');
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(128, 0); ctx.lineTo(128, 280); ctx.lineTo(64, 320); ctx.lineTo(0, 280);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 108, 252);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(emblem || '🍄', 64, 120);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('MYCO', 64, 185);
    ctx.fillText('CAMPUS', 64, 212);

    var tex = new THREE.CanvasTexture(c);
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 2.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    scene.add(mesh);
  }

  function buildPlaza() {
    // Piso da praca em bloquetes (x: -28..28, z: -20..22)
    var plazaFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 42),
      new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88, metalness: 0.02 })
    );
    plazaFloor.rotation.x = -Math.PI / 2;
    plazaFloor.position.set(0, 0.02, 1);
    plazaFloor.receiveShadow = true;
    scene.add(plazaFloor);

    // Fonte Central Realista em (0, 0, 2) com Bacia Vazada (Zero Z-Fighting), Agua Cristalina Animada, Cascatas e Cogumelo no Topo!
    var fx = 0, fz = 2;
    var basinStoneMat = new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.58, metalness: 0.08 });
    var basinInnerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.68, side: THREE.DoubleSide });
    var tilePoolMat = new THREE.MeshStandardMaterial({ color: 0x075985, roughness: 0.35, metalness: 0.15 });
    var waterSurfMat = new THREE.MeshStandardMaterial({
      map: texWater,
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
      roughness: 0.06,
      metalness: 0.22,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });

    // Fundo azulejado azul-profundo da bacia (y = 0.08, bem abaixo da agua em y = 0.44!)
    var poolFloor = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.12, 36), tilePoolMat);
    poolFloor.position.set(fx, 0.06, fz);
    poolFloor.receiveShadow = true;
    scene.add(poolFloor);

    // Parede cilindrica externa e interna da bacia (abertas no centro, sem tampar a agua!)
    var outerWall = new THREE.Mesh(new THREE.CylinderGeometry(2.98, 3.10, 0.50, 36, 1, true), basinStoneMat);
    outerWall.position.set(fx, 0.25, fz);
    outerWall.castShadow = true; outerWall.receiveShadow = true;
    var innerWall = new THREE.Mesh(new THREE.CylinderGeometry(2.58, 2.58, 0.48, 36, 1, true), basinInnerMat);
    innerWall.position.set(fx, 0.24, fz);
    var rimTop = new THREE.Mesh(new THREE.TorusGeometry(2.78, 0.23, 14, 40), basinStoneMat);
    rimTop.rotation.x = Math.PI / 2;
    rimTop.scale.set(1, 1, 0.45);
    rimTop.position.set(fx, 0.50, fz);
    rimTop.castShadow = true; rimTop.receiveShadow = true;
    scene.add(outerWall, innerWall, rimTop);

    // Superficie da agua cristalina inferior (y = 0.43, livre de qualquer sobreposicao!)
    var waterDisc = new THREE.Mesh(new THREE.CircleGeometry(2.57, 36), waterSurfMat);
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.set(fx, 0.43, fz);
    scene.add(waterDisc);

    // Pedestal de pedra esculpida em 2 niveis + Taca superior com agua
    var pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 0.26, 24), basinStoneMat);
    pedBase.position.set(fx, 0.22, fz);
    var ped1 = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.86, 0.88, 24), basinStoneMat);
    ped1.position.set(fx, 0.72, fz); ped1.castShadow = true;
    var bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 0.68, 0.30, 28), basinStoneMat);
    bowl.position.set(fx, 1.22, fz); bowl.castShadow = true;
    var bowlRim = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.08, 10, 32), basinStoneMat);
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.position.set(fx, 1.37, fz);
    var upperWater = new THREE.Mesh(new THREE.CircleGeometry(1.23, 28), waterSurfMat);
    upperWater.rotation.x = -Math.PI / 2;
    upperWater.position.set(fx, 1.38, fz);
    scene.add(pedBase, ped1, bowl, bowlRim, upperWater);

    // 8 jatos / veus de agua cristalina caindo da taca superior para a bacia + aneis de espuma animados
    var streamMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide });
    var rippleMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    for (var j = 0; j < 8; j++) {
      var jAng = (j / 8) * Math.PI * 2;
      var jx = fx + Math.cos(jAng) * 1.42;
      var jz = fz + Math.sin(jAng) * 1.42;
      var stream = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.055, 0.96, 8, 1, true), streamMat);
      stream.position.set(fx + Math.cos(jAng) * 1.34, 0.89, fz + Math.sin(jAng) * 1.34);
      stream.rotation.z = -Math.cos(jAng) * 0.16;
      stream.rotation.x = Math.sin(jAng) * 0.16;
      scene.add(stream);

      var rip = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.15, 18), rippleMat);
      rip.rotation.x = -Math.PI / 2;
      rip.position.set(jx, 0.44, jz);
      scene.add(rip);
      fountainRipples.push({ mesh: rip, phase: j * 0.78 });
    }

    // Particulas de goticulas de agua saltando na fonte
    var dropCount = 84;
    var dropArr = new Float32Array(dropCount * 3);
    for (var di = 0; di < dropCount; di++) {
      var dAng = (di / dropCount) * Math.PI * 2 * 4;
      var dRad = 1.15 + (di % 7) * 0.12;
      dropArr[di * 3] = fx + Math.cos(dAng) * dRad;
      dropArr[di * 3 + 1] = 0.44 + (di / dropCount) * 0.95;
      dropArr[di * 3 + 2] = fz + Math.sin(dAng) * dRad;
    }
    var dropGeo = new THREE.BufferGeometry();
    fountainDropsAttr = new THREE.BufferAttribute(dropArr, 3);
    dropGeo.setAttribute('position', fountainDropsAttr);
    var dropPoints = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.075, transparent: true, opacity: 0.82, depthWrite: false }));
    scene.add(dropPoints);

    // Cogumelo no topo da fonte!
    var mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.35, 16), new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.55 }));
    mStem.position.set(fx, 1.98, fz); mStem.castShadow = true;
    var mCap = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, emissive: 0x7f1d1d, emissiveIntensity: 0.22 })
    );
    mCap.position.set(fx, 2.58, fz); mCap.castShadow = true;
    scene.add(mStem, mCap);
    for (var s = 0; s < 8; s++) {
      var ang = (s / 8) * Math.PI * 2;
      var rSpot = s % 2 === 0 ? 0.96 : 0.68;
      var ySpot = s % 2 === 0 ? 3.12 : 3.48;
      var spot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
      spot.position.set(fx + Math.cos(ang) * rSpot, ySpot, fz + Math.sin(ang) * rSpot);
      scene.add(spot);
    }
    solidColliders.push({ minX: fx - 2.9, maxX: fx + 2.9, minZ: fz - 2.9, maxZ: fz + 2.9, minY: 0, maxY: 4.0 });

    // Canteiros organicos exatamente ao redor da praca
    createFlowerBed(-5.8, -4.5, 3.0, 1.8, -0.35);
    createFlowerBed(5.8, -4.5, 3.0, 1.8, 0.35);
    createFlowerBed(-6.2, 8.2, 3.2, 1.9, 0.42);
    createFlowerBed(6.2, 8.2, 3.2, 1.9, -0.42);

    // Bancos e mesas com guarda-sol
    createBench(-3.2, -1.8, 0.8);
    createBench(3.2, -1.8, -0.8);
    createBench(-5.5, 2.2, Math.PI / 2);
    createBench(5.5, 2.2, -Math.PI / 2);
    createBench(-3.5, 13.5, 0);
    createBench(3.5, 13.5, 0);

    // Luminarias
    createCampusLamp(-10.5, -10.5);
    createCampusLamp(10.5, -10.5);
    createCampusLamp(-10.5, 12.0);
    createCampusLamp(10.5, 12.0);
  }

  // ---------------- Modulo Geometrico de Predio Universitario (2 Andares) ----------------

  function createVenetianBlind(xPos, topY, zCenter, blindW, dropH, dir, roomCenterZ) {
    var root = new THREE.Group();
    root.position.set(xPos, topY, zCenter);

    var headMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.72, roughness: 0.26 });
    var slatMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.54, roughness: 0.30, side: THREE.DoubleSide });
    var tapeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65 });

    // Trilho superior metalico (headrail)
    var headrail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, blindW), headMat);
    headrail.position.set(0, -0.05, 0);
    root.add(headrail);

    // 22 laminas horizontais de aluminio cobrindo todo o vidro
    var numSlats = 22;
    var slatGeo = new THREE.BoxGeometry(0.165, 0.012, blindW - 0.04);
    var slats = [];
    for (var s = 0; s < numSlats; s++) {
      var slat = new THREE.Mesh(slatGeo, slatMat);
      slat.position.set(0, -0.11 - ((s + 0.5) / numSlats) * (dropH - 0.14), 0);
      slat.rotation.z = dir * 1.15;
      root.add(slat);
      slats.push(slat);
    }

    // Fitas/cordoes verticais (3 colunas ao longo da largura)
    var tapes = [];
    var tapeGeo = new THREE.BoxGeometry(0.012, dropH, 0.022);
    [-blindW * 0.34, 0, blindW * 0.34].forEach(function (tz) {
      [-0.048, 0.048].forEach(function (tx) {
        var tp = new THREE.Mesh(tapeGeo, tapeMat);
        tp.position.set(tx, -0.08 - dropH * 0.48, tz);
        root.add(tp);
        tapes.push(tp);
      });
    });

    // Barra inferior (bottom rail)
    var bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, blindW - 0.02), headMat);
    bottomRail.position.set(0, -dropH, 0);
    root.add(bottomRail);

    // Varao acrilico giratorio + cordao lateral com pendulo branco (fiel a foto!)
    var sideSign = zCenter < roomCenterZ ? 1 : -1;
    var ctrlZ = sideSign * (blindW * 0.41);
    var wand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, dropH * 0.66, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.72, roughness: 0.15 })
    );
    wand.position.set(-dir * 0.068, -dropH * 0.36, ctrlZ - sideSign * 0.14);
    var cordLine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, dropH * 0.52, 6),
      new THREE.MeshBasicMaterial({ color: 0xf1f5f9 })
    );
    cordLine.position.set(-dir * 0.068, -dropH * 0.28, ctrlZ);
    var cordKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.024, 0.075, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    cordKnob.position.set(-dir * 0.068, -dropH * 0.54, ctrlZ);
    root.add(wand, cordLine, cordKnob);

    var blindObj = {
      id: 'blind_' + windowBlinds.length,
      slats: slats,
      bottomRail: bottomRail,
      tapes: tapes,
      cordKnob: cordKnob,
      open: false,
      progress: 1.0,
      dropH: dropH,
      dir: dir
    };

    // Hitbox clicavel cobrindo toda a area da persiana/vidro
    var hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, dropH, blindW),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitMesh.position.set(0, -dropH / 2, 0);
    hitMesh.userData.blindObj = blindObj;
    root.add(hitMesh);
    blindHitMeshes.push(hitMesh);
    windowBlinds.push(blindObj);
    scene.add(root);
  }

  function buildCampusBuildingWing(opts) {
    // opts: { cx, cz, width, depth, faceDir (+1=-X->+X, -1=+X->-X), hasDoor, style ('brick'|'wood'), connectNorth2F, connectSouth2F }
    var w = opts.width || 10.0;
    var d = opts.depth || 11.6;
    var h1 = 3.56; // 1o andar termina abaixo da laje do 2o andar (y=3.80) para nao vazar tijolo na soleira!
    var h2 = 3.5;  // 2o andar
    var yFloor1 = 0.12;
    var yFloor2 = 3.80;
    var totalH = h1 + h2;
    var cx = opts.cx, cz = opts.cz;
    var dir = opts.faceDir;
    var frontX = cx + dir * (w / 2);
    var backX = cx - dir * (w / 2);
    var zN = cz - d / 2;
    var zS = cz + d / 2;

    // Laje do terreo e laje do 2o andar (ambas caminhaveis!)
    addWalkableSlab(cx, yFloor1, cz, w + 0.4, 0.14, d + 0.4, 0x475569, { roughness: 0.7 });
    addWalkableSlab(cx, yFloor2, cz, w + 0.35, 0.24, d + 0.35, 0x334155, { roughness: 0.55 });

    // Teto e platibanda cinza
    var roofSlab = makeBox(w + 0.6, 0.32, d + 0.6, 0x94a3b8, { roughness: 0.5 });
    roofSlab.position.set(cx, yFloor2 + h2 + 0.16, cz);
    registerSnowable(roofSlab.material);
    roofZones.push({ minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5, minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5, roofY: yFloor2 + h2 + 0.32 });
    scene.add(roofSlab);
    var parapet = makeBox(w + 0.72, 0.42, d + 0.72, 0x64748b, { roughness: 0.5 });
    parapet.position.set(cx, yFloor2 + h2 + 0.43, cz);
    scene.add(parapet);

    // Pilares de concreto escuro apenas nos cantos (deixa a porta central 100% livre!)
    [[frontX, zN], [frontX, zS], [backX, zN], [backX, zS]].forEach(function (pp) {
      var col = makeBox(0.45, totalH + 0.35, 0.45, 0x1e293b, { roughness: 0.5 });
      col.position.set(pp[0], yFloor1 + totalH / 2, pp[1]);
      scene.add(col);
    });

    var wallMat = opts.style === 'wood' ? woodMat(3, 2) : brickMat(3, 2);
    var glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.25 });

    // Parede dos fundos (1o e 2o andares)
    addSolidWall(backX, zN, backX, zS, yFloor1, totalH, 0.28, wallMat);

    // Parede Norte: 1o andar fechado, 2o andar com vao de porta se connectNorth2F
    addSolidWall(backX, zN, frontX, zN, yFloor1, h1, 0.28, brickMat(2.5, 1.2));
    if (opts.connectNorth2F) {
      // Vao central de 3.2m na parede norte do 2o andar (x: cx - 1.6 .. cx + 1.6)
      addSolidWall(backX, zN, cx - 1.6, zN, yFloor2, h2, 0.28, brickMat(1, 1));
      addSolidWall(cx + 1.6, zN, frontX, zN, yFloor2, h2, 0.28, brickMat(1, 1));
      var headerN = makeBox(3.2, 0.7, 0.28, 0x334155);
      headerN.position.set(cx, yFloor2 + h2 - 0.35, zN);
      scene.add(headerN);
    } else {
      addSolidWall(backX, zN, frontX, zN, yFloor2, h2, 0.28, brickMat(2.5, 1.2));
    }

    // Parede Sul: 1o andar fechado, 2o andar com vao se connectSouth2F
    addSolidWall(backX, zS, frontX, zS, yFloor1, h1, 0.28, brickMat(2.5, 1.2));
    if (opts.connectSouth2F) {
      addSolidWall(backX, zS, cx - 1.6, zS, yFloor2, h2, 0.28, brickMat(1, 1));
      addSolidWall(cx + 1.6, zS, frontX, zS, yFloor2, h2, 0.28, brickMat(1, 1));
      var headerS = makeBox(3.2, 0.7, 0.28, 0x334155);
      headerS.position.set(cx, yFloor2 + h2 - 0.35, zS);
      scene.add(headerS);
    } else {
      addSolidWall(backX, zS, frontX, zS, yFloor2, h2, 0.28, brickMat(2.5, 1.2));
    }

    // Fachada de vidro do 2o andar (sempre solida para nao cair pela janela, sem projetar sombra preta!)
    addSolidWall(frontX, zN, frontX, zS, yFloor2, h2 - 0.1, 0.14, glassMat, { noShadow: true });
    for (var m = -2; m <= 2; m++) {
      var mullion = makeBox(0.18, h2 - 0.1, 0.12, 0x0f172a);
      mullion.position.set(frontX, yFloor2 + (h2 - 0.1) / 2, cz + m * (d / 5));
      scene.add(mullion);
    }
    // Persianas horizontais clicaveis nos 2 lados de vidro do 2o andar
    createVenetianBlind(frontX - dir * 0.11, yFloor2 + h2 - 0.14, cz - d * 0.24, d * 0.45, h2 - 0.26, dir, cz);
    createVenetianBlind(frontX - dir * 0.11, yFloor2 + h2 - 0.14, cz + d * 0.24, d * 0.45, h2 - 0.26, dir, cz);

    // Forro claro no teto do 1o andar (abaixo da laje do 2o andar em y = 3.555)
    var ceilPlaster1 = makeBox(w - 0.1, 0.02, d - 0.1, 0xe2e8f0, { roughness: 0.7, noShadow: true });
    ceilPlaster1.position.set(cx, 3.55, cz);
    scene.add(ceilPlaster1);

    // Iluminacao realista em TODAS as salas (1o e 2o andares): 4 luminarias + PointLight + Interruptor por sala!
    var fixMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.4 });
    function createFloorLighting(floorY, floorH, swX, swY, swZ, swRotY) {
      var fTubeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfffbeb, emissiveIntensity: 1.25, roughness: 0.25 });
      var ceilY = floorY < 1.0 ? 3.51 : (floorY + floorH - 0.04);
      [-2.0, 2.0].forEach(function (lx) {
        [-2.8, 2.8].forEach(function (lz) {
          var trayL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 1.65), fixMat);
          trayL.position.set(cx + lx, ceilY, cz + lz);
          scene.add(trayL);
          [-0.1, 0.1].forEach(function (tx) {
            var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.5, 8), fTubeMat);
            tube.rotation.x = Math.PI / 2;
            tube.position.set(cx + lx + tx, ceilY - 0.04, cz + lz);
            scene.add(tube);
          });
        });
      });
      var fLight;
      if (isTouchDevice()) {
        fLight = { intensity: 1.05 };
      } else {
        fLight = new THREE.PointLight(0xfffbeb, 1.1, 22, 1.45);
        fLight.position.set(cx, ceilY - 0.30, cz);
        scene.add(fLight);
      }

      var swGroup = new THREE.Group();
      swGroup.position.set(swX, swY, swZ);
      swGroup.rotation.y = swRotY || 0;
      var swPlate = makeBox(0.18, 0.28, 0.03, 0xf8fafc, { roughness: 0.3 });
      var swRocker = makeBox(0.08, 0.12, 0.04, 0xe2e8f0, { roughness: 0.4 });
      swRocker.position.z = 0.02;
      swRocker.rotation.x = -0.22;
      var swLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      var swLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.02), swLedMat);
      swLed.position.set(0, 0.09, 0.025);
      swGroup.add(swPlate, swRocker, swLed);
      var swData = {
        id: 'light_' + campusLightSwitches.length,
        on: true,
        light: fLight,
        gLight: null,
        tubeMat: fTubeMat,
        ledMat: swLedMat,
        rocker: swRocker
      };
      swPlate.userData.lightSwitch = swData;
      swRocker.userData.lightSwitch = swData;
      lightSwitchMeshes.push(swPlate, swRocker);
      campusLightSwitches.push(swData);
      scene.add(swGroup);
    }
    // 1o andar: interruptor na parede Sul logo ao entrar pela porta principal
    createFloorLighting(yFloor1, h1, frontX - dir * 1.15, yFloor1 + 1.32, zS - 0.155, Math.PI);
    // 2o andar: interruptor na parede Norte ao lado da porta do 2o andar
    createFloorLighting(yFloor2, h2, cx - dir * 2.15, yFloor2 + 1.32, zN + 0.155, 0);
    for (var dtRow = -1; dtRow <= 1; dtRow++) {
      var deskZ = cz + dtRow * 3.0;
      var deskX = cx + dir * 1.1;
      var deskGrp = new THREE.Group();
      deskGrp.position.set(deskX, yFloor2, deskZ);
      var fndeBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42 });
      var fndeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.3 });
      var fndeDark = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 });
      var deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.045, 1.96), fndeBlue);
      deskTop.position.set(0, 0.72, 0); deskTop.castShadow = true;
      var underTray = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 1.66), fndeDark);
      underTray.position.set(0, 0.61, 0);
      [-0.82, 0.82].forEach(function (lz) {
        var legPost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.70, 10), fndeWhite);
        legPost.position.set(0, 0.36, lz);
        var footBar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.88, 10), fndeWhite);
        footBar.rotation.z = Math.PI / 2;
        footBar.position.set(0, 0.032, lz);
        [-0.42, 0.42].forEach(function (fx) {
          var cap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.07), fndeDark);
          cap.position.set(fx, 0.028, lz);
          deskGrp.add(cap);
        });
        deskGrp.add(legPost, footBar);
      });
      deskGrp.add(deskTop, underTray);
      scene.add(deskGrp);
      solidColliders.push({
        minX: deskX - 0.56, maxX: deskX + 0.56,
        minZ: deskZ - 1.02, maxZ: deskZ + 1.02,
        minY: yFloor2, maxY: yFloor2 + 0.9
      });
      supportSurfaces.push({
        minX: deskX - 0.50, maxX: deskX + 0.50,
        minZ: deskZ - 0.94, maxZ: deskZ + 0.94,
        topY: yFloor2 + 0.745
      });

      // 2 Cadeiras escolares ergonomicas azuis & brancas clicaveis atras de cada mesa
      [-0.5, 0.5].forEach(function (chDz) {
        var chairX = cx + dir * 2.1;
        var chairZ = deskZ + chDz;
        var cg = new THREE.Group();
        cg.position.set(chairX, yFloor2, chairZ);
        var legMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.45, roughness: 0.28 });
        var padMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42 });
        [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (lp) {
          var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), legMat);
          leg.position.set(lp[0], 0.22, lp[1]);
          cg.add(leg);
        });
        [-0.15, 0.15].forEach(function (bz) {
          var backBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8), legMat);
          backBar.position.set(dir * 0.21, 0.60, bz);
          cg.add(backBar);
        });
        var seatPad = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.045, 0.45), padMat);
        seatPad.position.set(0, 0.445, 0);
        seatPad.castShadow = true;
        var backPad = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.44), padMat);
        backPad.position.set(dir * 0.21, 0.72, 0);
        backPad.castShadow = true;
        cg.add(seatPad, backPad);
        var sitYaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        seatPad.userData.seatInfo = { x: chairX, y: yFloor2, z: chairZ, yaw: sitYaw };
        backPad.userData.seatInfo = seatPad.userData.seatInfo;
        seatMeshes.push(seatPad, backPad);
        scene.add(cg);
      });
    }
    var board = makeBox(0.1, 2.35, 8.0, 0x78350f, { roughness: 0.6 });
    board.position.set(backX + dir * 0.22, yFloor2 + 2.02, cz);
    scene.add(board);

    // Toda sala do 2o andar tem lousa interativa + kit de giz completo + apagador!
    var bIdx = opts.boardIndex || 0;
    var bSuffix = bIdx === 0 ? '' : '_' + bIdx;
    var bCanvas = document.createElement('canvas');
    bCanvas.width = 512;
    bCanvas.height = 256;
    var bCtx = bCanvas.getContext('2d');
    bCtx.fillStyle = '#14532d';
    bCtx.fillRect(0, 0, 512, 256);
    bCtx.fillStyle = 'rgba(255,255,255,0.28)';
    bCtx.font = 'bold 16px system-ui, sans-serif';
    bCtx.fillText('Lousa Interativa • Pegue um giz ou apagador abaixo', 16, 26);
    var bTex = new THREE.CanvasTexture(bCanvas);

    var bMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 2.15),
      new THREE.MeshBasicMaterial({ map: bTex })
    );
    bMesh.position.set(backX + dir * 0.28, yFloor2 + 2.02, cz);
    bMesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    bMesh.userData.boardIndex = bIdx;
    scene.add(bMesh);
    chalkboards[bIdx] = { id: bIdx, mesh: bMesh, canvas: bCanvas, ctx: bCtx, tex: bTex };
    chalkboardMeshes.push(bMesh);

    // Bandeja de giz & apagador
    var trayX = backX + dir * 0.42;
    var trayY = yFloor2 + 0.84;
    var tray = makeBox(0.38, 0.08, 6.8, 0x78350f, { roughness: 0.7 });
    tray.position.set(trayX, trayY, cz);
    scene.add(tray);
    supportSurfaces.push({
      minX: trayX - 0.28, maxX: trayX + 0.28,
      minZ: cz - 3.42, maxZ: cz + 3.42,
      topY: trayY + 0.04
    });

    var chalkDefs = [
      { id: 'chalk_white' + bSuffix, label: 'Giz Branco', color: 0xf8fafc, dz: -0.9 },
      { id: 'chalk_green' + bSuffix, label: 'Giz Verde', color: 0x4ade80, dz: -0.3 },
      { id: 'chalk_yellow' + bSuffix, label: 'Giz Amarelo', color: 0xfacc15, dz: 0.3 }
    ];
    chalkDefs.forEach(function (cd) {
      var cg = new THREE.Group();
      var stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.18, 10),
        new THREE.MeshStandardMaterial({ color: cd.color, roughness: 0.9 })
      );
      stick.rotation.x = Math.PI / 2;
      stick.position.y = 0.03;
      cg.add(stick);
      registerPickable(cd.id, cd.label, cg, trayX, trayY + 0.04, cz + cd.dz, 0, 0.15, 0.12);
    });

    // Apagador largo de madeira + feltro (sem sobreposicao / z-fighting)
    var eraser = new THREE.Group();
    var eWood = makeBox(0.12, 0.06, 0.28, 0x92400e, { roughness: 0.75 });
    eWood.position.y = 0.06;
    var eFelt = makeBox(0.12, 0.03, 0.28, 0x1e293b, { roughness: 0.95 });
    eFelt.position.y = 0.015;
    eraser.add(eWood, eFelt);
    registerPickable('board_eraser' + bSuffix, 'Apagador da Lousa', eraser, trayX, trayY + 0.04, cz + 0.95, 0, 0.2, 0.14);

    // Fachada do 1o andar (terreo): totalmente fechadinha com Vidro + Esquadrias + Persianas + Porta Central Articulada com Batente e Bandeira Superior!
    var doorHalfW = 0.96;
    var doorH = 2.75;
    addSolidWall(frontX, zN, frontX, cz - doorHalfW, yFloor1, h1, 0.14, glassMat, { noShadow: true });
    addSolidWall(frontX, cz + doorHalfW, frontX, zS, yFloor1, h1, 0.14, glassMat, { noShadow: true });

    // Bandeira de vidro acima da porta (fecha o vao entre yFloor1 + doorH e o teto yFloor1 + h1!)
    var transomH = h1 - doorH;
    var transomGlass = makeBox(0.12, transomH, doorHalfW * 2, glassMat, { noShadow: true });
    transomGlass.position.set(frontX, yFloor1 + doorH + transomH / 2, cz);
    scene.add(transomGlass);

    // Batentes verticais da porta, travessa superior e esquadrias das janelas
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.35 });
    [-doorHalfW, doorHalfW].forEach(function (dz) {
      var jamb = new THREE.Mesh(new THREE.BoxGeometry(0.20, h1, 0.14), frameMat);
      jamb.position.set(frontX, yFloor1 + h1 / 2, cz + dz);
      scene.add(jamb);
    });
    var transomBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, doorHalfW * 2 + 0.14), frameMat);
    transomBar.position.set(frontX, yFloor1 + doorH, cz);
    var topFacadeBar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, d - 0.3), frameMat);
    topFacadeBar.position.set(frontX, yFloor1 + h1 - 0.05, cz);
    scene.add(transomBar, topFacadeBar);

    if (opts.doorSign) {
      var sCan = document.createElement('canvas');
      sCan.width = 512; sCan.height = 160;
      var sCtx = sCan.getContext('2d');
      sCtx.fillStyle = '#0f172a';
      sCtx.fillRect(0, 0, 512, 160);
      sCtx.strokeStyle = '#34d399';
      sCtx.lineWidth = 8;
      sCtx.strokeRect(8, 8, 496, 144);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = 'bold 58px system-ui, Segoe UI, sans-serif';
      sCtx.textAlign = 'center';
      sCtx.textBaseline = 'middle';
      sCtx.fillText(opts.doorSign, 256, 82);
      var sTex = new THREE.CanvasTexture(sCan);
      var signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.44, 1.55),
        new THREE.MeshStandardMaterial({ map: sTex, emissive: 0x064e3b, emissiveIntensity: 0.35, roughness: 0.3 })
      );
      signMesh.position.set(frontX + dir * 0.06, yFloor1 + doorH + transomH * 0.5, cz);
      if (dir < 0) signMesh.rotation.y = Math.PI;
      scene.add(signMesh);
    }

    // Persianas horizontais clicaveis cobrindo todo o vidro de cada lado da porta (Esquerda e Direita)
    var sideWinW = (d / 2) - doorHalfW - 0.26;
    var sideCenterOffset = doorHalfW + 0.04 + sideWinW / 2;
    createVenetianBlind(frontX - dir * 0.11, yFloor1 + h1 - 0.08, cz - sideCenterOffset, sideWinW, h1 - 0.16, dir, cz);
    createVenetianBlind(frontX - dir * 0.11, yFloor1 + h1 - 0.08, cz + sideCenterOffset, sideWinW, h1 - 0.16, dir, cz);

    // Folha da porta articulada com moldura metalica e macaneta dupla
    var doorPivot = new THREE.Group();
    doorPivot.position.set(frontX, yFloor1, cz - doorHalfW + 0.04);
    var leafW = (doorHalfW - 0.04) * 2;
    var doorGlass = makeBox(0.036, doorH - 0.17, leafW - 0.15, 0x0f766e, { transparent: true, opacity: 0.58, roughness: 0.15, noShadow: true });
    doorGlass.position.set(0, doorH / 2 - 0.01, leafW / 2);
    var stL = new THREE.Mesh(new THREE.BoxGeometry(0.11, doorH, 0.08), frameMat);
    stL.position.set(0, doorH / 2, 0.04);
    var stR = new THREE.Mesh(new THREE.BoxGeometry(0.11, doorH, 0.08), frameMat);
    stR.position.set(0, doorH / 2, leafW - 0.04);
    var rlT = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.08, leafW - 0.16), frameMat);
    rlT.position.set(0, doorH - 0.04, leafW / 2);
    var rlB = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.10, leafW - 0.16), frameMat);
    rlB.position.set(0, 0.05, leafW / 2);
    var doorHandle = makeBox(0.18, 0.42, 0.035, 0xe2e8f0, { metalness: 0.85, roughness: 0.2, noShadow: true });
    doorHandle.position.set(0, 1.12, leafW - 0.18);
    doorPivot.add(doorGlass, stL, stR, rlT, rlB, doorHandle);
    scene.add(doorPivot);

    var doorObj = {
      id: 'door_' + campusDoors.length,
      pivot: doorPivot,
      open: false,
      angle: 0,
      frontX: frontX,
      minZ: cz - doorHalfW,
      maxZ: cz + doorHalfW,
      dir: dir,
      label: opts.doorLabel || 'Porta da Sala'
    };
    doorGlass.userData.doorObj = doorObj;
    stL.userData.doorObj = doorObj;
    stR.userData.doorObj = doorObj;
    doorHandle.userData.doorObj = doorObj;
    doorHitMeshes.push(doorGlass, stL, stR, doorHandle);
    campusDoors.push(doorObj);
  }

  // ---------------- Escadaria, Passarela Elevada & Torre do Relogio ----------------

  // Ciclo completo de 40 minutos reais (20 min dia + 20 min noite) sincronizado para todos via UTC
  function getVirtualDayFrac() {
    return ((Date.now() / 1000) % 2400) / 2400; // 0.0=00h, 0.25=06h, 0.50=12h, 0.75=18h
  }

  function updateClockTexture() {
    if (!clockCtx || !clockTex) return;
    var totalMin = Math.floor(getVirtualDayFrac() * 1440);
    var m = totalMin % 60;
    if (m === lastClockMin) return;
    lastClockMin = m;
    var h = Math.floor(totalMin / 60) % 12;

    var ctx = clockCtx;
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 10; ctx.stroke();

    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
      ctx.lineTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106);
      ctx.lineWidth = i % 3 === 0 ? 6 : 3;
      ctx.stroke();
    }

    var hAng = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    var mAng = (m / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#0f172a';
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(hAng) * 58, 128 + Math.sin(hAng) * 58); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(mAng) * 86, 128 + Math.sin(mAng) * 86); ctx.stroke();

    clockTex.needsUpdate = true;
  }

  function buildStaircaseAndBridge() {
    var yTop = 3.80;
    // 14 degraus arquitetonicos de z=-11.5 ate z=-18.5 (subindo de y=0 ate y=3.80)
    var steps = 14;
    var stepD = 7.0 / steps;
    var stepH = yTop / steps;
    var riserMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
    var treadMat = new THREE.MeshStandardMaterial({ map: texPaving, color: 0xe2e8f0, roughness: 0.65 });
    var noseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.25 });
    for (var i = 0; i < steps; i++) {
      var sy = (i + 1) * stepH;
      var sz = -11.5 - (i + 0.5) * stepD;
      var riserH = Math.max(0.05, sy - 0.06);
      var riser = new THREE.Mesh(new THREE.BoxGeometry(8.2, riserH, stepD), riserMat);
      riser.position.set(0, riserH / 2, sz);
      riser.castShadow = true; riser.receiveShadow = true;
      var tread = new THREE.Mesh(new THREE.BoxGeometry(8.36, 0.06, stepD + 0.03), treadMat);
      tread.position.set(0, sy - 0.03, sz + 0.015);
      tread.castShadow = true; tread.receiveShadow = true;
      var nose = new THREE.Mesh(new THREE.BoxGeometry(8.36, 0.025, 0.04), noseMat);
      nose.position.set(0, sy - 0.012, sz + stepD / 2 + 0.015);
      scene.add(riser, tread, nose);
    }
    stairsList.push({ minX: -4.15, maxX: 4.15, zStart: -11.5, zEnd: -18.5, yStart: 0, yEnd: yTop });

    // Guarda-corpo inclinado profissional com viga lateral, vidro temperado, postes e corrimao metalico
    var slopeLen = Math.hypot(7.0, yTop);
    var slopeAng = Math.atan2(yTop, 7.0);
    var steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 });
    var railMetalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.8 });
    var stairGlassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.2 });
    [-4.25, 4.25].forEach(function (rx) {
      var stringer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, slopeLen + 0.3), steelMat);
      stringer.position.set(rx, yTop / 2 - 0.08, -15.0);
      stringer.rotation.x = slopeAng;
      stringer.castShadow = true;
      var glassPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.88, slopeLen), stairGlassMat);
      glassPanel.position.set(rx, yTop / 2 + 0.52, -15.0);
      glassPanel.rotation.x = slopeAng;
      var handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, slopeLen + 0.2, 12), railMetalMat);
      handrail.position.set(rx, yTop / 2 + 1.0, -15.0);
      handrail.rotation.x = Math.PI / 2 + slopeAng;
      scene.add(stringer, glassPanel, handrail);

      for (var pIdx = 0; pIdx <= 3; pIdx++) {
        var frac = pIdx / 3;
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.02, 0.08), steelMat);
        post.position.set(rx, frac * yTop + 0.51, -11.5 - frac * 7.0);
        scene.add(post);
      }
      solidColliders.push({ minX: rx - 0.22, maxX: rx + 0.22, minZ: -18.55, maxZ: -11.45, minY: 0, maxY: 5.0 });
    });

    // Patamar Superior atras do topo da escada (z = -22.5 .. -18.5, livre dos degraus e conectado ao Relogio e as duas alas!)
    addWalkableSlab(0, yTop, -20.5, 5.6, 0.34, 4.0, 0x475569, { roughness: 0.6 });
    addWalkableSlab(-12.0, yTop, -20.5, 18.4, 0.34, 4.0, 0x475569, { roughness: 0.6 });
    addWalkableSlab(12.0, yTop, -20.5, 18.4, 0.34, 4.0, 0x475569, { roughness: 0.6 });

    // Pontes laterais ligando o Patamar (-18.5) direto as portas do 2o andar (-12.975) dos dois lados (x = +-19)
    [-19, 19].forEach(function (ax) {
      addWalkableSlab(ax, yTop, -15.7375, 4.4, 0.34, 5.525, 0x475569, { roughness: 0.6 });
      addSolidWall(ax - 2.12, -18.5, ax - 2.12, -12.975, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
      addSolidWall(ax + 2.12, -18.5, ax + 2.12, -12.975, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    });

    // Pilares estruturais sustentando o patamar superior e as pontes laterais
    [-19, -11, 11, 19].forEach(function (px) {
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, yTop - 0.34, 14), steelMat);
      col.position.set(px, (yTop - 0.34) / 2, -20.5);
      col.castShadow = true; col.receiveShadow = true;
      scene.add(col);
    });
    [-19, 19].forEach(function (px) {
      var colS = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, yTop - 0.34, 14), steelMat);
      colS.position.set(px, (yTop - 0.34) / 2, -15.5);
      colS.castShadow = true; colS.receiveShadow = true;
      scene.add(colS);
    });

    // Guarda-corpo de vidro + corrimao metalico no patamar superior (sem bloquear a saida da escada nem a Ponte Norte)
    [-1, 1].forEach(function (side) {
      addSolidWall(side * 4.25, -18.55, side * 16.85, -18.55, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
      var railS = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.06, 0.1), railMetalMat);
      railS.position.set(side * 10.55, yTop + 1.03, -18.55);
      scene.add(railS);

      addSolidWall(side * 2.8, -22.45, side * 21.15, -22.45, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
      var railN = new THREE.Mesh(new THREE.BoxGeometry(18.35, 0.06, 0.1), railMetalMat);
      railN.position.set(side * 11.975, yTop + 1.03, -22.45);
      scene.add(railN);

      addSolidWall(side * 21.15, -22.45, side * 21.15, -18.55, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    });

    // Pontes ligando Bloco Norte <-> Bloco Sul no 2o andar (x = +-19, z = -1.025 .. 2.025, y = 3.80, encontro exato sem z-fighting)
    [-19, 19].forEach(function (ax) {
      addWalkableSlab(ax, yTop, 0.5, 4.4, 0.28, 3.05, 0x475569, { roughness: 0.6 });
      addSolidWall(ax - 2.1, -1.025, ax - 2.1, 2.025, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
      addSolidWall(ax + 2.1, -1.025, ax + 2.1, 2.025, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Terraco Norte (y = 3.80, x: -24..24, z: -29.5 .. -42.0) — separado da passarela por um Lago Norte organico
    addWalkableSlab(0, yTop, -35.75, 48.0, 3.80, 12.5, 0x94a3b8, { roughness: 0.8 });

    // Ponte Norte sobre o lago ligando o Patamar (-22.5) ate o Terraco da Torre do Relogio (-29.5)
    addWalkableSlab(0, yTop, -26.0, 5.6, 0.34, 7.0, 0x64748b, { roughness: 0.65 });
    [-2.75, 2.75].forEach(function (bx) {
      addSolidWall(bx, -29.5, bx, -22.5, yTop, 1.05, 0.12, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Lago Norte organico com borda de pedras dos dois lados da Ponte Norte
    var nLakeMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.88 });
    var nRimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    [-7.2, 7.2].forEach(function (lx) {
      var pond = new THREE.Mesh(new THREE.CircleGeometry(4.6, 26), nLakeMat);
      pond.rotation.x = -Math.PI / 2;
      pond.scale.set(1.2, 0.9, 1);
      pond.position.set(lx, 0.06, -24.0);
      scene.add(pond);
      var rim = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.05, 26), nRimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(1.2, 0.9, 1);
      rim.position.set(lx, 0.055, -24.0);
      scene.add(rim);
    });
  }

  function buildClockTowerAndAuditorium() {
    var baseY = 3.80;

    // Alas laterais simetricas da Reitoria caminhaveis com porta aberta (z = -40.2..-33.8)
    [-9.5, 9.5].forEach(function (ax) {
      addWalkableSlab(ax, baseY, -37.0, 11.0, 0.2, 6.4, 0x334155);
      var rRoof = makeBox(11.4, 0.45, 6.8, 0x64748b);
      rRoof.position.set(ax, baseY + 6.3, -37.0);
      registerSnowable(rRoof.material);
      roofZones.push({ minX: ax - 5.7, maxX: ax + 5.7, minZ: -40.4, maxZ: -33.6, roofY: baseY + 6.5 });
      scene.add(rRoof);

      addSolidWall(ax - 5.5, -40.2, ax + 5.5, -40.2, baseY, 6.1, 0.28, brickMat(3, 2)); // Fundo
      addSolidWall(ax - 5.5, -40.2, ax - 5.5, -33.8, baseY, 6.1, 0.28, brickMat(2, 2)); // Esq
      addSolidWall(ax + 5.5, -40.2, ax + 5.5, -33.8, baseY, 6.1, 0.28, brickMat(2, 2)); // Dir
      // Fachada frontal (z = -33.8) com porta aberta de 2.4m no centro e janelas laterais
      addSolidWall(ax - 5.5, -33.8, ax - 1.2, -33.8, baseY, 6.1, 0.26, brickMat(1.2, 2));
      addSolidWall(ax + 1.2, -33.8, ax + 5.5, -33.8, baseY, 6.1, 0.26, brickMat(1.2, 2));
      var doorHeader = makeBox(2.5, 3.1, 0.28, brickMat(1, 1));
      doorHeader.position.set(ax, baseY + 4.55, -33.8);
      var rDesk = makeBox(2.6, 0.78, 1.1, 0x92400e, { roughness: 0.65 });
      rDesk.position.set(ax, baseY + 0.39, -38.2);
      scene.add(doorHeader, rDesk);
      solidColliders.push({ minX: ax - 1.35, maxX: ax + 1.35, minZ: -38.8, maxZ: -37.6, minY: baseY, maxY: baseY + 1.0 });
      supportSurfaces.push({ minX: ax - 1.25, maxX: ax + 1.25, minZ: -38.7, maxZ: -37.7, topY: baseY + 0.78 });
    });

    // Torre Central do Relogio
    var tower = makeBox(5.6, 12.6, 6.8, 0x64748b, { roughness: 0.55 });
    tower.position.set(0, baseY + 6.3, -37.0);
    scene.add(tower);
    var towerFrame = makeBox(3.6, 7.6, 0.16, 0x0f172a);
    towerFrame.position.set(0, baseY + 4.3, -33.52);
    scene.add(towerFrame);

    // Painel 3D Interativo de Ranking logo abaixo do Relogio
    rankingCanvas = document.createElement('canvas');
    rankingCanvas.width = 512; rankingCanvas.height = 1024;
    rankingCtx = rankingCanvas.getContext('2d');
    rankingTex = new THREE.CanvasTexture(rankingCanvas);
    var rankBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 6.6),
      new THREE.MeshBasicMaterial({ map: rankingTex })
    );
    rankBoard.position.set(0, baseY + 4.5, -33.42);
    scene.add(rankBoard);

    // Botoes 3D de rolagem (▲ Subir / ▼ Descer) no rodape do painel
    [['▲', -0.75, 'up'], ['▼', 0.75, 'down']].forEach(function (rb) {
      var bc = document.createElement('canvas');
      bc.width = 128; bc.height = 96;
      var bctx = bc.getContext('2d');
      bctx.fillStyle = '#1e293b'; bctx.fillRect(0, 0, 128, 96);
      bctx.strokeStyle = '#38bdf8'; bctx.lineWidth = 6; bctx.strokeRect(4, 4, 120, 88);
      bctx.fillStyle = '#f8fafc'; bctx.font = 'bold 48px system-ui, sans-serif';
      bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
      bctx.fillText(rb[0], 64, 48);
      var btn = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.62, 0.1),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) })
      );
      btn.position.set(rb[1], baseY + 0.85, -33.36);
      btn.userData.rankAction = rb[2];
      scene.add(btn);
      rankingBtnMeshes.push(btn);
    });
    drawRankingBoard();
    solidColliders.push({ minX: -2.9, maxX: 2.9, minZ: -40.5, maxZ: -33.5, minY: baseY, maxY: baseY + 13 });

    // Relogio funcional no topo da torre
    clockCanvas = document.createElement('canvas');
    clockCanvas.width = 256; clockCanvas.height = 256;
    clockCtx = clockCanvas.getContext('2d');
    clockTex = new THREE.CanvasTexture(clockCanvas);
    updateClockTexture();
    var clockMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 28),
      new THREE.MeshBasicMaterial({ map: clockTex })
    );
    clockMesh.position.set(0, baseY + 10.4, -33.5);
    scene.add(clockMesh);

    // Banners da Reitoria
    createBanner(-4.6, baseY + 4.0, -33.6, 0, '#1d4ed8', '🎓');
    createBanner(4.6, baseY + 4.0, -33.6, 0, '#4338ca', '🍄');
  }

  function updateCampusAuditoriumSlide(slideIndex, title, subtitle, bullets, presenter) {
    if (!auditoriumCtx || !auditoriumTex) return;
    var ctx = auditoriumCtx;
    var grad = ctx.createLinearGradient(0, 0, 1024, 576);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#064e3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 576);

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, 988, 540);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('🎓 MYCOCAMPUS 3D  •  SLIDE ' + (slideIndex + 1), 48, 72);

    if (presenter) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('👨‍🏫 Ao vivo: ' + presenter, 660, 72);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText(title || '', 48, 150);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(subtitle || '', 48, 198);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '29px system-ui, sans-serif';
    (bullets || []).forEach(function (line, i) {
      ctx.fillText(line, 60, 275 + i * 68);
    });

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('💡 Clique no telão ou abra "Aulas" para praticar e ganhar XP!', 48, 520);

    auditoriumTex.needsUpdate = true;
  }

  // ---------------- Itens Pegaveis & Equipamentos das Alas ----------------

  function registerPickable(id, label, mesh, x, y, z, ry, radius, height) {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry || 0;
    if (isTouchDevice() && !mesh.userData.twoHanded) {
      mesh.traverse(function (ch) { if (ch.isMesh) ch.castShadow = false; });
    }
    scene.add(mesh);
    var entry = {
      id: id, label: label, mesh: mesh,
      homePos: new THREE.Vector3(x, y, z), homeRy: ry || 0,
      radius: radius || 0.25, height: height || 0.4, isMoved: false, movedAt: 0
    };
    pickableItems.push(entry);
    return entry;
  }

  function buildCampusWingsAndEquipment() {
    // ALA OESTE (Esquerda) — 2 blocos de 2 andares (x: -24..-14)
    // Bloco Oeste-Norte (z: -12.8..-1.2): LABORATORIO DE FLUXO LAMINAR & AUTOCLAVE + 2o andar acessivel
    buildCampusBuildingWing({ cx: -19, cz: -7, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Laboratório', doorSign: '🔬 LAB', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 0 });
    // Bloco Oeste-Sul (z: 2.2..13.8): DEPOSITO DE INSUMOS & EQUIPAMENTOS (1o andar) + Sala de Aula (2o andar)
    buildCampusBuildingWing({ cx: -19, cz: 8, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Depósito', doorSign: '📦 DEPÓSITO', style: 'brick', connectNorth2F: true, boardIndex: 1 });

    createBanner(-13.85, 5.1, -11.6, Math.PI / 2, '#6d28d9', '🔬');
    createBanner(-13.85, 5.1, -2.4, Math.PI / 2, '#1d4ed8', '🧬');
    createBanner(-13.85, 5.1, 12.6, Math.PI / 2, '#d97706', '📦');

    // Equipamentos do Lab dentro do Bloco Oeste-Norte (x: -24..-14, z: -12.8..-1.2)
    function updateItemBounds(item) {
      if (!item || !item.mesh) return;
      var px = item.mesh.position.x, py = item.mesh.position.y, pz = item.mesh.position.z;
      var surf = item.mesh.userData.dynamicSurface;
      var col = item.mesh.userData.dynamicCollider;
      var dims = item.mesh.userData.tableDims;
      if (dims) {
        var rotSwap = Math.abs(Math.sin(item.mesh.rotation.y)) > 0.707;
        var hw = (rotSwap ? dims.d : dims.w) / 2;
        var hd = (rotSwap ? dims.w : dims.d) / 2;
        if (surf) {
          surf.minX = px - hw + 0.02; surf.maxX = px + hw - 0.02;
          surf.minZ = pz - hd + 0.02; surf.maxZ = pz + hd - 0.02;
          surf.topY = py + dims.h + (dims.surfOffset || 0);
        }
        if (col) {
          col.minX = px - hw - 0.05; col.maxX = px + hw + 0.05;
          col.minZ = pz - hd - 0.05; col.maxZ = pz + hd + 0.05;
          col.minY = py; col.maxY = py + dims.h + 0.4;
        }
      }
    }

    function isSurfaceOccupied(surf, ignoreItem) {
      if (!surf) return false;
      for (var i = 0; i < pickableItems.length; i++) {
        var o = pickableItems[i];
        if (o === ignoreItem) continue;
        var p = o.mesh.position;
        if (p.x >= surf.minX - 0.08 && p.x <= surf.maxX + 0.08 &&
            p.z >= surf.minZ - 0.08 && p.z <= surf.maxZ + 0.08 &&
            p.y >= surf.topY - 0.12 && p.y <= surf.topY + 0.55) {
          return true;
        }
      }
      return false;
    }

    function addMovableStainlessTable(id, label, tx, floorY, tz, tw, th, td) {
      var inoxMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.22 });
      var legMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.15 });
      var footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
      var tg = new THREE.Group();
      var top = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.055, td), inoxMat);
      top.position.y = th - 0.0275; top.castShadow = true; top.receiveShadow = true;
      var shelf = new THREE.Mesh(new THREE.BoxGeometry(tw - 0.08, 0.035, td - 0.08), inoxMat);
      shelf.position.y = th * 0.28; shelf.receiveShadow = true;
      tg.add(top, shelf);
      var lx = tw / 2 - 0.07, lz = td / 2 - 0.07;
      [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(function (lp) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, th - 0.04, 10), legMat);
        leg.position.set(lp[0], (th - 0.04) / 2 + 0.02, lp[1]);
        var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), footMat);
        foot.position.set(lp[0], 0.015, lp[1]);
        tg.add(leg, foot);
      });
      var surf = { minX: tx - tw / 2 + 0.02, maxX: tx + tw / 2 - 0.02, minZ: tz - td / 2 + 0.02, maxZ: tz + td / 2 - 0.02, topY: floorY + th };
      var col = { minX: tx - tw / 2 - 0.05, maxX: tx + tw / 2 + 0.05, minZ: tz - td / 2 - 0.05, maxZ: tz + td / 2 + 0.05, minY: floorY, maxY: floorY + th + 0.4 };
      supportSurfaces.push(surf);
      top.userData.supportSurface = surf;
      supportMeshes.push(top);
      solidColliders.push(col);
      tg.userData.twoHanded = true;
      tg.userData.isTable = true;
      tg.userData.tableDims = { w: tw, h: th, d: td, surfOffset: 0 };
      tg.userData.dynamicSurface = surf;
      tg.userData.dynamicCollider = col;
      tg.userData.updateBounds = updateItemBounds;
      tg.userData.isBlockedPickup = function (item) { return isSurfaceOccupied(surf, item); };
      registerPickable(id, label, tg, tx, floorY, tz, 0, Math.max(tw, td) * 0.5, th);
    }

    // Bancadas fixas nas paredes do Laboratorio (Oeste e Norte) + Estante de Culturas Solidas (Sul)
    function addWallLabBench(bx, bz, bw, bd) {
      var cab = makeBox(bw, 0.82, bd, 0xe2e8f0, { roughness: 0.55 });
      cab.position.set(bx, 0.14 + 0.41, bz);
      var trim = makeBox(bw + 0.02, 0.72, bd + 0.02, 0x0284c7, { roughness: 0.5 });
      trim.position.set(bx, 0.14 + 0.36, bz);
      var top = makeBox(bw + 0.04, 0.06, bd + 0.04, 0x94a3b8, { roughness: 0.35, metalness: 0.25 });
      top.position.set(bx, 0.14 + 0.85, bz);
      scene.add(trim, cab, top);
      solidColliders.push({ minX: bx - bw / 2 - 0.05, maxX: bx + bw / 2 + 0.05, minZ: bz - bd / 2 - 0.05, maxZ: bz + bd / 2 + 0.05, minY: 0.14, maxY: 1.3 });
      var benchSurf = { minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, topY: 1.02 };
      supportSurfaces.push(benchSurf);
      top.userData.supportSurface = benchSurf;
      supportMeshes.push(top);
    }
    addWallLabBench(-23.15, -7.0, 1.2, 10.6); // Parede Oeste inteira
    addWallLabBench(-18.5, -12.0, 8.1, 1.1);  // Parede Norte inteira

    // Estante 3 niveis para Culturas Solidas (Parede Sul do Lab)
    var rackX = -19.2, rackZ = -1.85;
    var rackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.65, roughness: 0.3 });
    [0.62, 1.18, 1.74].forEach(function (sy) {
      var sh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 0.68), rackMat);
      sh.position.set(rackX, 0.14 + sy, rackZ);
      scene.add(sh);
      var shSurf = { minX: rackX - 1.55, maxX: rackX + 1.55, minZ: rackZ - 0.3, maxZ: rackZ + 0.3, topY: 0.14 + sy + 0.02 };
      supportSurfaces.push(shSurf);
      sh.userData.supportSurface = shSurf;
      supportMeshes.push(sh);
    });
    [-1.56, 1.56].forEach(function (pxOff) {
      [-0.31, 0.31].forEach(function (pzOff) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8), rackMat);
        post.position.set(rackX + pxOff, 0.14 + 0.95, rackZ + pzOff);
        scene.add(post);
      });
    });
    solidColliders.push({ minX: rackX - 1.65, maxX: rackX + 1.65, minZ: rackZ - 0.38, maxZ: rackZ + 0.38, minY: 0.14, maxY: 2.1 });

    // Ilha central em Inox com Fluxo Laminar Horizontal (movivel se vazio + botao Power/LED + ar esteril!)
    addMovableStainlessTable('table_hood_lab', 'Mesa Inox (Fluxo Laminar)', -18.5, 0.12, -8.2, 1.5, 0.90, 2.4);

    var hoodGroup = new THREE.Group();
    var hoodBackBox = makeBox(0.32, 1.08, 2.34, 0x0f172a, { roughness: 0.45, metalness: 0.4 });
    hoodBackBox.position.set(-0.58, 0.54, 0);
    var hepaCanvas = document.createElement('canvas');
    hepaCanvas.width = 256; hepaCanvas.height = 128;
    var hctx = hepaCanvas.getContext('2d');
    hctx.fillStyle = '#f8fafc';
    hctx.fillRect(0, 0, 256, 128);
    hctx.strokeStyle = '#cbd5e1';
    hctx.lineWidth = 1.5;
    for (var hx = -128; hx < 384; hx += 8) {
      hctx.beginPath(); hctx.moveTo(hx, 0); hctx.lineTo(hx + 128, 128); hctx.stroke();
      hctx.beginPath(); hctx.moveTo(hx + 128, 0); hctx.lineTo(hx, 128); hctx.stroke();
    }
    var hepaTex = new THREE.CanvasTexture(hepaCanvas);
    hepaTex.wrapS = hepaTex.wrapT = THREE.RepeatWrapping;
    hepaTex.repeat.set(3, 2);
    var hepaMat = new THREE.MeshStandardMaterial({ map: hepaTex, emissive: 0xe0f2fe, emissiveIntensity: 0.35, roughness: 0.6 });
    var hepa = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.94, 2.16), hepaMat);
    hepa.position.set(-0.41, 0.54, 0);
    var hoodTop = makeBox(1.10, 0.06, 2.34, 0x0f172a, { roughness: 0.4 });
    hoodTop.position.set(0.10, 1.08, 0);
    var hoodGlassL = makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
    hoodGlassL.position.set(0.115, 0.545, -1.15);
    hoodGlassL.userData.ignoreRay = true;
    var hoodGlassR = makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
    hoodGlassR.position.set(0.115, 0.545, 1.15);
    hoodGlassR.userData.ignoreRay = true;
    // Base fechada em aco inox sem frestas no chao (encaixa perfeitamente em bancadas e mesas)
    var hoodBase = makeBox(1.39, 0.04, 2.34, 0xcbd5e1, { metalness: 0.72, roughness: 0.28 });
    hoodBase.position.set(-0.045, 0.02, 0);
    var hoodWorkMat = makeBox(1.03, 0.008, 2.24, 0x334155, { metalness: 0.55, roughness: 0.35 });
    hoodWorkMat.position.set(0.115, 0.042, 0);
    var hoodFrontLip = makeBox(0.03, 0.045, 2.34, 0x0f172a, { metalness: 0.5, roughness: 0.4 });
    hoodFrontLip.position.set(0.64, 0.0225, 0);

    // Botao Power + LED no canto superior direito do Fluxo Laminar
    var hoodSwitchBox = makeBox(0.06, 0.14, 0.10, 0x1e293b, { noShadow: true });
    hoodSwitchBox.position.set(0.62, 1.05, 1.13);
    var hoodBtnMesh = makeBox(0.03, 0.06, 0.06, 0x38bdf8, { noShadow: true });
    hoodBtnMesh.position.set(0.65, 1.03, 1.13);
    var hoodLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    var hoodLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), hoodLedMat);
    hoodLed.position.set(0.65, 1.09, 1.13);

    // Corrente de ar esteril horizontal (particulas saindo do filtro HEPA)
    var airCount = 56;
    var airPos = new Float32Array(airCount * 3);
    for (var ai = 0; ai < airCount; ai++) {
      airPos[ai * 3] = -0.36 + Math.random() * 1.15;
      airPos[ai * 3 + 1] = 0.10 + Math.random() * 0.85;
      airPos[ai * 3 + 2] = (Math.random() - 0.5) * 2.0;
    }
    var airGeo = new THREE.BufferGeometry();
    var airAttr = new THREE.BufferAttribute(airPos, 3);
    airGeo.setAttribute('position', airAttr);
    var airPoints = new THREE.Points(airGeo, new THREE.PointsMaterial({ color: 0xbae6fd, size: 0.045, transparent: true, opacity: 0.72 }));
    airPoints.userData.ignoreRay = true;
    hoodGroup.add(hoodBackBox, hepa, hoodTop, hoodGlassL, hoodGlassR, hoodBase, hoodWorkMat, hoodFrontLip, hoodSwitchBox, hoodBtnMesh, hoodLed, airPoints);

    hoodAirData = { on: true, points: airPoints, attr: airAttr, hepaMat: hepaMat, ledMat: hoodLedMat };
    hoodBtnMesh.userData.hoodSwitch = hoodAirData;
    hoodSwitchBox.userData.hoodSwitch = hoodAirData;
    hoodSwitchMeshes.push(hoodBtnMesh, hoodSwitchBox);

    var hoodSurf = { minX: -19.08, maxX: -17.85, minZ: -9.32, maxZ: -7.08, topY: 1.065 };
    supportSurfaces.push(hoodSurf);
    hoodBase.userData.supportSurface = hoodSurf;
    hoodWorkMat.userData.supportSurface = hoodSurf;
    supportMeshes.push(hoodBase, hoodWorkMat);
    hoodGroup.userData.twoHanded = true;
    hoodGroup.userData.isHood = true;
    hoodGroup.userData.tableDims = { w: 1.39, h: 0.045, d: 2.34, surfOffset: 0 };
    hoodGroup.userData.dynamicSurface = hoodSurf;
    hoodGroup.userData.updateBounds = updateItemBounds;
    hoodGroup.userData.isBlockedPickup = function (item) { return isSurfaceOccupied(hoodSurf, item); };
    registerPickable('laminar_hood_lab', 'Capela de Fluxo Laminar', hoodGroup, -18.5, 1.02, -8.2, 0, 0.85, 1.1);

    function createPressureCookerPair(potId, lidId, labelSuffix, px, py, pz) {
      var steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.20 });
      var darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.2 });
      var redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });

      var potGroup = new THREE.Group();
      var potWallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.20, side: THREE.DoubleSide });
      var potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.23, 0.36, 22, 1, true), potWallMat);
      potBody.position.y = 0.18; potBody.castShadow = true;
      var potBase = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.03, 22), darkMat);
      potBase.position.y = 0.015;
      var potBottomIn = new THREE.Mesh(new THREE.CircleGeometry(0.22, 22), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 }));
      potBottomIn.rotation.x = -Math.PI / 2; potBottomIn.position.y = 0.034;
      var potRim = new THREE.Mesh(new THREE.TorusGeometry(0.242, 0.018, 10, 24), steelMat);
      potRim.rotation.x = Math.PI / 2; potRim.position.y = 0.36;
      [-1, 1].forEach(function (side) {
        var hdl = makeBox(0.09, 0.065, 0.11, darkMat, { noShadow: true });
        hdl.position.set(side * 0.275, 0.29, 0);
        potGroup.add(hdl);
      });
      potGroup.add(potBody, potBase, potBottomIn, potRim);
      potGroup.userData.twoHanded = true;
      var potItem = registerPickable(potId, 'Panela de Pressão 20L (' + labelSuffix + ')', potGroup, px, py, pz, 0, 0.30, 0.42);

      var lidGroup = new THREE.Group();
      var lidRim = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.256, 0.045, 22), steelMat);
      lidRim.position.y = 0.022;
      var lidDome = new THREE.Mesh(new THREE.SphereGeometry(0.242, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), steelMat);
      lidDome.scale.set(1, 0.36, 1); lidDome.position.y = 0.025;
      var weight = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.055, 12), darkMat);
      weight.position.y = 0.13;
      var weightTop = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 12), redMat);
      weightTop.position.y = 0.16;
      [-0.12, 0.12].forEach(function (vz) {
        var vRing = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.015, 10), darkMat);
        vRing.position.set(0, 0.105, vz);
        var vPin = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.022, 10), redMat);
        vPin.position.set(0, 0.112, vz);
        lidGroup.add(vRing, vPin);
      });
      [-1, 1].forEach(function (side) {
        var clasp = makeBox(0.085, 0.045, 0.10, darkMat, { noShadow: true });
        clasp.position.set(side * 0.27, 0.025, 0);
        lidGroup.add(clasp);
      });
      lidGroup.add(lidRim, lidDome, weight, weightTop);
      var sCount = 24;
      var sPos = new Float32Array(sCount * 3);
      for (var si = 0; si < sCount; si++) {
        sPos[si * 3] = (Math.random() - 0.5) * 0.04;
        sPos[si * 3 + 1] = 0.17 + Math.random() * 0.35;
        sPos[si * 3 + 2] = (Math.random() - 0.5) * 0.04;
      }
      var sGeo = new THREE.BufferGeometry();
      var sAttr = new THREE.BufferAttribute(sPos, 3);
      sGeo.setAttribute('position', sAttr);
      var steamPoints = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.06, transparent: true, opacity: 0.65 }));
      steamPoints.visible = false;
      steamPoints.userData.ignoreRay = true;
      lidGroup.add(steamPoints);

      var lidItem = registerPickable(lidId, 'Tampa da Panela (' + labelSuffix + ')', lidGroup, px, py + 0.36, pz, 0, 0.26, 0.16);
      lidItem.potItem = potItem;
      lidItem.isAttached = true;
      potItem.lidItem = lidItem;
      cookerPots.push({
        potItem: potItem, lidItem: lidItem, weight: weight, weightTop: weightTop,
        steamPoints: steamPoints, steamAttr: sAttr, contents: [],
        psi: 0, temp: 25, progress: 0, sterilized: false
      });
    }

    function makeElectricBurner(id, px, py, pz) {
      var bg = new THREE.Group();
      var body = makeBox(0.54, 0.075, 0.58, 0x1e293b, { metalness: 0.45, roughness: 0.4 });
      body.position.y = 0.0375;
      var coilMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0xef4444, emissiveIntensity: 0.04, roughness: 0.4 });
      var coil = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.014, 22), coilMat);
      coil.position.set(0, 0.082, -0.02);
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.024, 14), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }));
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-0.14, 0.038, 0.295);
      var ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      var led = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), ledMat);
      led.position.set(0.14, 0.042, 0.295);
      bg.add(body, coil, knob, led);

      var bSurf = { minX: px - 0.26, maxX: px + 0.26, minZ: pz - 0.28, maxZ: pz + 0.24, topY: py + 0.088 };
      supportSurfaces.push(bSurf);
      body.userData.supportSurface = bSurf;
      coil.userData.supportSurface = bSurf;
      supportMeshes.push(body, coil);
      bg.userData.isBurner = true;
      bg.userData.tableDims = { w: 0.54, h: 0.088, d: 0.58, surfOffset: 0 };
      bg.userData.dynamicSurface = bSurf;
      bg.userData.updateBounds = updateItemBounds;
      bg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(bSurf, it); };
      bg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(bSurf, it); };

      var bState = { on: false, coilMat: coilMat, ledMat: ledMat, surface: bSurf };
      knob.userData.burnerSwitch = bState;
      body.userData.burnerSwitch = bState;
      burnerSwitchMeshes.push(knob);
      burnerDevices.push(bState);
      return registerPickable(id, 'Fogareiro Elétrico (Autoclave)', bg, px, py, pz, 0, 0.32, 0.12);
    }

    addMovableStainlessTable('table_cooker_lab', 'Mesa Inox (Autoclave/Spawn)', -18.5, 0.12, -5.0, 1.5, 0.85, 2.4);
    makeElectricBurner('burner_lab', -18.5, 0.97, -4.6);
    createPressureCookerPair('pressure_cooker_lab', 'pressure_lid_lab', 'Lab', -18.5, 1.058, -4.6);

    addMovableStainlessTable('table_lc_lab', 'Mesa Inox (Cultura Líquida)', -20.5, 0.12, -10.6, 2.0, 0.79, 1.0);

    // Texturas procedurais realistas para Placas de Petri (PDA, Micelio Rizomorfico, Contaminacao) e Spawn
    function makePetriDish(mode) {
      var pg = new THREE.Group();
      var glassMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.15 });
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.048, 22, 1, true), glassMat);
      rim.position.y = 0.024;
      var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.012, 22), glassMat);
      lid.position.y = 0.048;

      var c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      var ctx = c.getContext('2d');
      ctx.fillStyle = mode === 'contam' ? '#d9b36c' : '#efe7d2';
      ctx.fillRect(0, 0, 256, 256);
      if (mode === 'clean') {
        ctx.strokeStyle = 'rgba(255,255,255,0.88)';
        ctx.lineWidth = 1.6;
        for (var a = 0; a < 110; a++) {
          var ang = (a / 110) * Math.PI * 2;
          var rEnd = 88 + Math.sin(a * 7) * 14;
          ctx.beginPath();
          ctx.moveTo(128, 128);
          ctx.quadraticCurveTo(128 + Math.cos(ang + 0.12) * rEnd * 0.55, 128 + Math.sin(ang + 0.12) * rEnd * 0.55, 128 + Math.cos(ang) * rEnd, 128 + Math.sin(ang) * rEnd);
          ctx.stroke();
        }
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath(); ctx.moveTo(120, 120); ctx.lineTo(138, 122); ctx.lineTo(128, 138); ctx.closePath(); ctx.fill();
      } else if (mode === 'contam') {
        ctx.fillStyle = '#4a3f28';
        ctx.beginPath(); ctx.arc(88, 132, 62, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c1917';
        ctx.beginPath(); ctx.arc(86, 134, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e7dcc8';
        ctx.beginPath(); ctx.arc(174, 118, 44, 0, Math.PI * 2); ctx.fill();
      }
      if (mode !== 'bare') {
        var agarTex = new THREE.CanvasTexture(c);
        var agar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.156, 0.156, 0.022, 22),
          new THREE.MeshStandardMaterial({ map: agarTex, roughness: 0.35 })
        );
        agar.position.y = 0.015;
        pg.add(agar);
      }
      pg.add(rim, lid);
      pg.userData.isPetri = true;
      return pg;
    }

    registerPickable('petri_clean', 'Placa de Petri (Micélio Rizomórfico)', makePetriDish('clean'), -18.3, 1.065, -8.6, 0, 0.20, 0.08);
    registerPickable('petri_contam', 'Placa Contaminada (Mofo/Bactéria)', makePetriDish('contam'), -18.3, 1.065, -7.8, 0, 0.20, 0.08);
    registerPickable('petri_empty', 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -19.2, 1.34, -1.85, 0, 0.20, 0.08);

    // Frasco reagente profissional de Potato Dextrose Agar (PDA / BDA 500g) com rotulo de alta definicao 100% legivel de frente!
    var pdaGroup = new THREE.Group();
    var hdpeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.05 });
    var pdaBody = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.21, 28), hdpeMat);
    pdaBody.position.y = 0.105;
    pdaBody.castShadow = true;
    var pdaShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.102, 0.038, 28), hdpeMat);
    pdaShoulder.position.y = 0.228;
    var pdaNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.024, 24), hdpeMat);
    pdaNeck.position.y = 0.255;

    var pdaC = document.createElement('canvas');
    pdaC.width = 512; pdaC.height = 256;
    var pdaCtx = pdaC.getContext('2d');
    pdaCtx.fillStyle = '#ffffff';
    pdaCtx.fillRect(0, 0, 512, 256);
    // Desenha 2 rotulos completos (frente e verso do cilindro) para ficar 100% legivel de qualquer angulo!
    [0, 256].forEach(function (ox) {
      pdaCtx.fillStyle = '#f8fafc';
      pdaCtx.fillRect(ox + 10, 8, 236, 240);
      pdaCtx.strokeStyle = '#cbd5e1';
      pdaCtx.lineWidth = 3;
      pdaCtx.strokeRect(ox + 10, 8, 236, 240);

      // Faixa superior azul laboratorio
      pdaCtx.fillStyle = '#0284c7';
      pdaCtx.fillRect(ox + 12, 10, 232, 38);
      pdaCtx.fillStyle = '#ffffff';
      pdaCtx.font = 'bold 17px system-ui, sans-serif';
      pdaCtx.textAlign = 'center';
      pdaCtx.fillText('🧪 MYCOLAB • REAGENTE', ox + 128, 35);

      // Nome principal grande e centralizado (nao corta nas bordas!)
      pdaCtx.fillStyle = '#0f172a';
      pdaCtx.font = '900 32px system-ui, sans-serif';
      pdaCtx.fillText('BDA / PDA', ox + 128, 86);

      pdaCtx.fillStyle = '#0369a1';
      pdaCtx.font = 'bold 20px system-ui, sans-serif';
      pdaCtx.fillText('POTATO DEXTROSE', ox + 128, 118);
      pdaCtx.fillText('AGAR • MEIO SÓLIDO', ox + 128, 144);

      // Badge verde de especificacao + peso 500g
      pdaCtx.fillStyle = '#059669';
      pdaCtx.fillRect(ox + 28, 162, 200, 32);
      pdaCtx.fillStyle = '#ffffff';
      pdaCtx.font = 'bold 17px system-ui, sans-serif';
      pdaCtx.fillText('CULTIVO DE COGUMELOS', ox + 128, 184);

      pdaCtx.fillStyle = '#334155';
      pdaCtx.font = 'bold 21px system-ui, sans-serif';
      pdaCtx.fillText('PESO LÍQ. 500g  •  pH 5.6', ox + 128, 222);

      pdaCtx.fillStyle = '#ea580c';
      pdaCtx.fillRect(ox + 12, 236, 232, 10);
    });
    var pdaLabelTex = new THREE.CanvasTexture(pdaC);
    pdaLabelTex.anisotropy = 4;
    var pdaLabel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1035, 0.1035, 0.175, 32, 1, true),
      new THREE.MeshStandardMaterial({ map: pdaLabelTex, roughness: 0.32 })
    );
    pdaLabel.position.y = 0.105;

    var capMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32 });
    var pdaCap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.080, 0.056, 24), capMat);
    pdaCap.position.y = 0.285;
    var pdaSealRing = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.010, 24), new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.4 }));
    pdaSealRing.position.y = 0.254;
    pdaGroup.add(pdaBody, pdaShoulder, pdaNeck, pdaLabel, pdaCap, pdaSealRing);
    registerPickable('pda_bottle', 'Frasco PDA 500g (Ágar Batata Dextrose)', pdaGroup, -19.6, 1.02, -12.0, 0, 0.15, 0.34);

    // Vidros 800ml de Spawn (Vazio e Colonizado com Milho) com crescimento real de micelio
    function updateSpawnVisual(item) {
      if (!item || !item.spawnCtrl) return;
      var sc = item.spawnCtrl;
      if (sc.mycOverlay) {
        sc.mycOverlay.visible = sc.colonization > 0;
        var f = Math.min(1, sc.colonization / 100);
        sc.mycOverlay.material.opacity = sc.contaminated ? 0.72 : (0.15 + f * 0.78);
        sc.mycOverlay.material.color.setHex(sc.contaminated ? 0x15803d : 0xf8fafc);
        sc.mycOverlay.scale.set(1, Math.max(0.15, f), 1);
      }
      if (sc.contaminated) {
        item.label = sc.baseLabel + ' (Contaminado ⚠️)';
      } else if (sc.colonization >= 100) {
        item.label = sc.baseLabel + ' (100% Colonizado ✅)';
      } else if (sc.inoculated) {
        item.label = sc.baseLabel + ' (Colonizando ' + Math.floor(sc.colonization) + '%)';
      } else if (sc.sterilized) {
        item.label = sc.baseLabel + ' (Estéril • Pronto)';
      } else {
        item.label = sc.baseLabel + ' (Não Esterilizado)';
      }
    }

    function makeSpawnJar800(id, filled, px, py, pz) {
      var jg = new THREE.Group();
      var glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.24, 16),
        new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.1, depthWrite: false })
      );
      glass.position.y = 0.12;
      var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.035, 16), new THREE.MeshStandardMaterial({ color: filled ? 0xdc2626 : 0xf8fafc, roughness: 0.4 }));
      lid.position.y = 0.255;
      jg.add(glass, lid);
      var jc = document.createElement('canvas'); jc.width = 128; jc.height = 128;
      var jctx = jc.getContext('2d');
      jctx.fillStyle = filled ? '#eab308' : '#d97706'; jctx.fillRect(0, 0, 128, 128);
      for (var k = 0; k < 140; k++) {
        jctx.fillStyle = k % 3 === 0 ? '#ca8a04' : '#fde047';
        jctx.beginPath(); jctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 3, 0, Math.PI * 2); jctx.fill();
      }
      var corn = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.195, 16), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(jc), roughness: 0.75 }));
      corn.position.y = 0.108;
      var mycOverlay = new THREE.Mesh(
        new THREE.CylinderGeometry(0.099, 0.099, 0.198, 16),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 })
      );
      mycOverlay.position.y = 0.108;
      if (filled) jg.add(corn, mycOverlay);
      var item = registerPickable(id, 'Vidro 800ml', jg, px, py, pz, 0, 0.16, 0.28);
      item.spawnCtrl = {
        baseLabel: filled ? 'Vidro 800ml (Milho)' : 'Vidro 800ml Vazio',
        sterilized: filled, inoculated: filled, colonized: filled,
        colonization: filled ? 100 : 0, contaminated: false,
        mycOverlay: filled ? mycOverlay : null,
        updateVisual: function () { updateSpawnVisual(item); }
      };
      updateSpawnVisual(item);
      spawnGrowItems.push(item);
      return item;
    }
    makeSpawnJar800('spawn_jar', true, -23.1, 1.02, -4.5);
    makeSpawnJar800('spawn_jar_empty', false, -23.1, 1.02, -3.7);

    // Bags de Semente 1.5kg (Vazio e Colonizado com Filtro Microporoso + Porta de Injecao)
    function makeSpawnBag1500(id, filled, px, py, pz) {
      var bg = new THREE.Group();
      var filmMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: filled ? 0.34 : 0.28, roughness: 0.2, depthWrite: false });
      var outer = makeBox(0.24, 0.36, 0.18, filmMat, { noShadow: true });
      outer.position.y = 0.18;
      var filterPatch = makeBox(0.09, 0.09, 0.012, 0xffffff, { noShadow: true });
      filterPatch.position.set(0, 0.30, 0.092);
      var injPort = makeBox(0.036, 0.036, 0.016, 0x64748b, { noShadow: true });
      injPort.position.set(0, 0.11, 0.094);
      bg.add(outer, filterPatch, injPort);
      var bc = document.createElement('canvas'); bc.width = 128; bc.height = 128;
      var bctx = bc.getContext('2d');
      bctx.fillStyle = '#eab308'; bctx.fillRect(0, 0, 128, 128);
      for (var g = 0; g < 180; g++) {
        bctx.fillStyle = g % 4 === 0 ? '#78350f' : '#fde047';
        bctx.fillRect(Math.random() * 124, Math.random() * 124, 3, 4);
      }
      var block = makeBox(0.215, 0.215, 0.155, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(bc), roughness: 0.85 }));
      block.position.y = 0.115;
      var mycOverlay = makeBox(0.222, 0.22, 0.162, new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 }));
      mycOverlay.position.y = 0.115;
      if (filled) bg.add(block, mycOverlay);
      var item = registerPickable(id, 'Bag 1,5kg', bg, px, py, pz, 0, 0.22, 0.38);
      item.spawnCtrl = {
        baseLabel: filled ? 'Bag 1,5kg Spawn' : 'Bag 1,5kg Vazio',
        sterilized: filled, inoculated: filled, colonized: filled,
        colonization: filled ? 100 : 0, contaminated: false,
        mycOverlay: filled ? mycOverlay : null,
        updateVisual: function () { updateSpawnVisual(item); }
      };
      updateSpawnVisual(item);
      spawnGrowItems.push(item);
      return item;
    }
    makeSpawnBag1500('spawn_bag_colonized', true, -23.1, 1.02, -8.5);
    makeSpawnBag1500('spawn_bag_empty', false, -23.1, 1.02, -7.8);

    // Balanca Digital de Precisao (com prato inox, visor LCD em gramas e botao TARE)
    (function () {
      var sg = new THREE.Group();
      var body = makeBox(0.32, 0.065, 0.38, 0x1e293b, { roughness: 0.45 });
      body.position.y = 0.0325;
      var pan = makeBox(0.28, 0.016, 0.26, 0xe2e8f0, { metalness: 0.82, roughness: 0.22 });
      pan.position.set(0, 0.073, -0.04);
      var lcdC = document.createElement('canvas'); lcdC.width = 256; lcdC.height = 96;
      var lcdCtx = lcdC.getContext('2d');
      var lcdTex = new THREE.CanvasTexture(lcdC);
      var lcdScreen = makeBox(0.18, 0.045, 0.01, new THREE.MeshBasicMaterial({ map: lcdTex }), { noShadow: true });
      lcdScreen.position.set(-0.04, 0.045, 0.192);
      lcdScreen.rotation.x = -0.35;
      var tareBtn = makeBox(0.065, 0.028, 0.016, 0x22c55e, { noShadow: true });
      tareBtn.position.set(0.095, 0.042, 0.194);
      tareBtn.rotation.x = -0.35;
      sg.add(body, pan, lcdScreen, tareBtn);

      var sx = -23.1, sy = 1.02, sz = -9.6;
      var scSurf = { minX: sx - 0.15, maxX: sx + 0.15, minZ: sz - 0.18, maxZ: sz + 0.10, topY: sy + 0.082 };
      supportSurfaces.push(scSurf);
      pan.userData.supportSurface = scSurf;
      supportMeshes.push(pan);
      sg.userData.isScale = true;
      sg.userData.tableDims = { w: 0.32, h: 0.082, d: 0.38, surfOffset: 0 };
      sg.userData.dynamicSurface = scSurf;
      sg.userData.updateBounds = updateItemBounds;
      sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(scSurf, it); };
      sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(scSurf, it); };

      var scaleObj = {
        tare: 0, lastText: '', lastGross: 0, surface: scSurf,
        lcdCtx: lcdCtx, lcdTex: lcdTex,
        draw: function (grams) {
          var txt = (grams).toFixed(1) + ' g';
          if (txt === this.lastText) return;
          this.lastText = txt;
          lcdCtx.fillStyle = '#064e3b'; lcdCtx.fillRect(0, 0, 256, 96);
          lcdCtx.fillStyle = '#34d399'; lcdCtx.font = 'bold 46px monospace';
          lcdCtx.textAlign = 'right'; lcdCtx.textBaseline = 'middle';
          lcdCtx.fillText(txt, 240, 50);
          lcdTex.needsUpdate = true;
        }
      };
      scaleObj.draw(0);
      tareBtn.userData.scaleObj = scaleObj;
      scaleTareMeshes.push(tareBtn);
      scaleDevices.push(scaleObj);
      registerPickable('precision_scale', 'Balança de Precisão Digital', sg, sx, sy, sz, Math.PI / 2, 0.24, 0.12);
    })();

    // Borrifador de Alcool 70%
    function makeAlcoholSprayBottle(id, px, py, pz) {
      var ag = new THREE.Group();
      var bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.062, 0.18, 16),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, roughness: 0.25 })
      );
      bottle.position.y = 0.09;
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }));
      neck.position.y = 0.205;
      var nozzle = makeBox(0.028, 0.028, 0.08, 0xf8fafc, { noShadow: true });
      nozzle.position.set(0, 0.235, 0.025);
      var trig = makeBox(0.012, 0.045, 0.018, 0x0284c7, { noShadow: true });
      trig.position.set(0, 0.212, 0.042);
      ag.add(bottle, neck, nozzle, trig);
      ag.userData.isAlcoholSpray = true;
      return registerPickable(id, 'Borrifador Álcool 70%', ag, px, py, pz, Math.PI / 2, 0.12, 0.26);
    }
    makeAlcoholSprayBottle('alcohol_spray', -23.1, 1.02, -7.1);

    // Seladora Termica de Bancada
    var sealerGroup = new THREE.Group();
    var sealerBase = makeBox(0.46, 0.08, 0.18, 0x1d4ed8, { roughness: 0.4, metalness: 0.35 });
    sealerBase.position.y = 0.04;
    var sealerArm = makeBox(0.44, 0.04, 0.05, 0x94a3b8, { metalness: 0.7, roughness: 0.25 });
    sealerArm.position.set(0, 0.11, -0.02);
    sealerArm.rotation.x = 0.18;
    var sealerLed = makeBox(0.02, 0.02, 0.02, 0xef4444, { noShadow: true });
    sealerLed.position.set(0.18, 0.085, 0.06);
    sealerGroup.add(sealerBase, sealerArm, sealerLed);
    registerPickable('heat_sealer', 'Seladora Térmica de Bags', sealerGroup, -23.1, 1.02, -6.2, Math.PI / 2, 0.28, 0.16);

    // ---------------- Agitador Magnetico, Cultura Liquida 800ml (350ml), Bequeres 1L e Seringas 10ml ----------------
    function makeScaleTex(maxVal, stepVal, brandTitle) {
      var sc = document.createElement('canvas');
      sc.width = 256; sc.height = 256;
      var sx = sc.getContext('2d');
      sx.clearRect(0, 0, 256, 256);
      sx.strokeStyle = 'rgba(248, 250, 252, 0.88)';
      sx.fillStyle = 'rgba(248, 250, 252, 0.92)';
      sx.lineWidth = 2;
      sx.font = 'bold 20px sans-serif';
      sx.fillText(brandTitle, 18, 46);
      sx.font = 'bold 16px monospace';
      sx.fillText('Boro 3.3', 24, 72);
      sx.beginPath(); sx.moveTo(138, 36); sx.lineTo(138, 232); sx.stroke();
      for (var v = stepVal; v <= maxVal; v += stepVal) {
        var frac = v / maxVal;
        var yy = 232 - frac * 186;
        sx.beginPath(); sx.moveTo(138, yy); sx.lineTo(174, yy); sx.stroke();
        sx.fillText(String(v), 180, yy + 5);
      }
      var tex = new THREE.CanvasTexture(sc);
      return tex;
    }

    function updateContainerVolume(item, newVol) {
      if (!item || !item.mesh || !item.mesh.userData.liquidCtrl) return;
      var ctrl = item.mesh.userData.liquidCtrl;
      var clamped = Math.max(0, Math.min(ctrl.maxMl, Math.round(newVol)));
      ctrl.volMl = clamped;
      var frac = clamped / ctrl.maxMl;
      if (clamped <= 0) {
        ctrl.liqMesh.visible = false;
        if (ctrl.mycCloud) ctrl.mycCloud.visible = false;
      } else {
        ctrl.liqMesh.visible = true;
        ctrl.liqMesh.scale.y = Math.max(0.02, frac);
        ctrl.liqMesh.position.y = ctrl.baseY + (ctrl.maxH * frac) * 0.5;
        if (ctrl.mycCloud) {
          ctrl.mycCloud.visible = true;
          ctrl.mycCloud.position.y = ctrl.baseY + Math.min(ctrl.maxH * frac * 0.45, 0.048);
        }
      }
      item.label = ctrl.baseLabel + ' (' + clamped + 'ml/' + ctrl.maxMl + 'ml)';
    }

    function makeLiquidJar800(id, px, py, pz, initMl) {
      var jg = new THREE.Group();
      var glassMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.12, depthWrite: false });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.21, 22, 1, true), glassMat);
      body.position.y = 0.11;
      var bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.01, 22), glassMat);
      bottom.position.y = 0.005;
      var shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.088, 0.035, 22), glassMat);
      shoulder.position.y = 0.232;
      var scaleCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.089, 0.089, 0.19, 20, 1, true),
        new THREE.MeshBasicMaterial({ map: makeScaleTex(800, 200, '800ml'), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
      );
      scaleCyl.position.y = 0.11;
      var liqMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xca8a04, emissiveIntensity: 0.14, transparent: true, opacity: 0.58, roughness: 0.15 });
      var liqMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.19, 20), liqMat);
      var mycCloud = new THREE.Mesh(
        new THREE.SphereGeometry(0.048, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf8fafc, emissiveIntensity: 0.25, transparent: true, opacity: 0.72, roughness: 0.85 })
      );
      mycCloud.scale.set(1.25, 0.55, 1.15);
      // Peixinho agitador magnetico PTFE branco no fundo do vidro
      var stirBar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.052, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
      stirBar.rotation.z = Math.PI / 2;
      stirBar.position.set(0, 0.018, 0);
      // Tampa branca com porta de injecao vermelha e filtro microporoso branco
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.034, 20), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }));
      cap.position.y = 0.266;
      var injPort = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 12), new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }));
      injPort.position.set(0.036, 0.290, 0);
      var filterPort = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.022, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.9 }));
      filterPort.position.set(-0.036, 0.292, 0);

      jg.add(liqMesh, mycCloud, stirBar, body, bottom, shoulder, scaleCyl, cap, injPort, filterPort);
      jg.userData.liquidCtrl = {
        volMl: initMl, maxMl: 800, baseY: 0.012, maxH: 0.19,
        liqMesh: liqMesh, mycCloud: mycCloud, stirBar: stirBar,
        baseLabel: 'Cultura Líquida 800ml'
      };
      var item = registerPickable(id, 'Cultura Líquida 800ml', jg, px, py, pz, 0, 0.14, 0.30);
      item.setVolume = function (v) { updateContainerVolume(item, v); };
      updateContainerVolume(item, initMl);
      return item;
    }

    function makeBeaker1L(id, px, py, pz, initMl) {
      var bg = new THREE.Group();
      var glassMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0.12, depthWrite: false });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.23, 22, 1, true), glassMat);
      body.position.y = 0.12;
      var bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 22), glassMat);
      bottom.position.y = 0.005;
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.097, 0.006, 8, 22), glassMat);
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.235;
      var scaleCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.096, 0.096, 0.21, 20, 1, true),
        new THREE.MeshBasicMaterial({ map: makeScaleTex(1000, 200, '1000ml'), transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide })
      );
      scaleCyl.position.y = 0.12;
      var liqMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x0284c7, emissiveIntensity: 0.10, transparent: true, opacity: 0.52, roughness: 0.15 });
      var liqMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.089, 0.089, 0.20, 20), liqMat);
      var stirBar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.052, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
      stirBar.rotation.z = Math.PI / 2;
      stirBar.position.set(0, 0.018, 0);
      bg.add(liqMesh, stirBar, body, bottom, rim, scaleCyl);
      bg.userData.liquidCtrl = {
        volMl: initMl, maxMl: 1000, baseY: 0.012, maxH: 0.20,
        liqMesh: liqMesh, mycCloud: null, stirBar: stirBar,
        baseLabel: 'Béquer 1L'
      };
      var item = registerPickable(id, 'Béquer 1L', bg, px, py, pz, 0, 0.14, 0.24);
      item.setVolume = function (v) { updateContainerVolume(item, v); };
      updateContainerVolume(item, initMl);
      return item;
    }

    function makeMagneticStirrer(id, px, py, pz) {
      var sg = new THREE.Group();
      var baseMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.12 });
      var plateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.18 });
      var body = makeBox(0.30, 0.078, 0.28, baseMat, { roughness: 0.35 });
      body.position.set(0, 0.039, -0.04);
      var plate = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.118, 0.018, 24), plateMat);
      plate.position.set(0, 0.088, -0.04);
      var plateRim = new THREE.Mesh(new THREE.TorusGeometry(0.116, 0.006, 8, 24), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
      plateRim.rotation.x = Math.PI / 2; plateRim.position.set(0, 0.082, -0.04);

      // Painel frontal inclinado azul estilo IKA / HYCC SH-2 com marca e legendas nitidas
      var pCan = document.createElement('canvas'); pCan.width = 256; pCan.height = 96;
      var pCtx = pCan.getContext('2d');
      pCtx.fillStyle = '#1d4ed8'; pCtx.fillRect(0, 0, 256, 96);
      pCtx.fillStyle = '#ffffff'; pCtx.font = 'bold 18px system-ui, sans-serif';
      pCtx.textAlign = 'center'; pCtx.fillText('IKA • MYCO-MAG SH-2', 128, 22);
      pCtx.font = 'bold 12px system-ui, sans-serif';
      pCtx.fillStyle = '#bfdbfe';
      pCtx.fillText('STIRRING', 56, 84);
      pCtx.fillText('POWER', 128, 84);
      pCtx.fillText('HEATING', 200, 84);
      var panelMat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(pCan), roughness: 0.3 });
      var frontPanel = makeBox(0.28, 0.068, 0.075, panelMat, { noShadow: true });
      frontPanel.position.set(0, 0.036, 0.12);
      frontPanel.rotation.x = 0.42;

      function makeRotaryKnob(kx) {
        var kg = new THREE.Group();
        var kBase = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.016, 16), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
        var kCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }));
        kCap.position.y = 0.010;
        kg.add(kBase, kCap);
        kg.rotation.x = Math.PI / 2 - 1.15;
        kg.position.set(kx, 0.056, 0.135);
        return kg;
      }
      var knob1 = makeRotaryKnob(-0.075);
      var knob2 = makeRotaryKnob(0.075);
      var ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      var powerLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), ledMat);
      powerLed.position.set(0, 0.056, 0.132);
      sg.add(body, plate, plateRim, frontPanel, knob1, knob2, powerLed);

      var stirSurf = { minX: px - 0.13, maxX: px + 0.13, minZ: pz - 0.16, maxZ: pz + 0.08, topY: py + 0.098 };
      supportSurfaces.push(stirSurf);
      plate.userData.supportSurface = stirSurf;
      supportMeshes.push(plate);
      sg.userData.isStirrer = true;
      sg.userData.tableDims = { w: 0.30, h: 0.098, d: 0.34, surfOffset: 0 };
      sg.userData.dynamicSurface = stirSurf;
      sg.userData.updateBounds = updateItemBounds;
      sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(stirSurf, it); };

      var stirState = { on: false, ledMat: ledMat, surface: stirSurf };
      frontPanel.userData.stirSwitch = stirState;
      knob1.children.forEach(function (c) { c.userData.stirSwitch = stirState; stirSwitchMeshes.push(c); });
      knob2.children.forEach(function (c) { c.userData.stirSwitch = stirState; stirSwitchMeshes.push(c); });
      stirSwitchMeshes.push(frontPanel);
      stirrerDevices.push(stirState);
      return registerPickable(id, 'Agitador Magnético (MYCO-MAG)', sg, px, py, pz, 0, 0.24, 0.14);
    }

    function updateSyringeVolume(item, newVol) {
      if (!item || !item.mesh || !item.mesh.userData.syrCtrl) return;
      var sc = item.mesh.userData.syrCtrl;
      var clamped = Math.max(0, Math.min(10, Math.round(newVol)));
      sc.volMl = clamped;
      var frac = clamped / 10;
      if (clamped <= 0) {
        sc.liqMesh.visible = false;
      } else {
        sc.liqMesh.visible = true;
        sc.liqMesh.scale.y = frac;
        sc.liqMesh.position.y = 0.085 + (0.09 * frac) * 0.5;
      }
      sc.plunger.position.y = 0.095 + 0.09 * frac;
      item.label = clamped > 0 ? 'Seringa 10ml (' + clamped + 'ml CL)' : 'Seringa 10ml (Vazia)';
    }

    function makeSyringe10ml(id, px, py, pz) {
      var sg = new THREE.Group();
      var barrelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.36, roughness: 0.12, depthWrite: false });
      var barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 14, 1, true), barrelMat);
      barrel.position.y = 0.135;
      var flange = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.005, 14), barrelMat);
      flange.position.y = 0.195;
      var liqMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.78 })
      );
      liqMesh.visible = false;
      var plunger = new THREE.Group();
      var stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.014, 12), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      stopper.position.y = 0;
      var rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
      rod.position.y = 0.06;
      var thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.005, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
      thumb.position.y = 0.115;
      plunger.add(stopper, rod, thumb);
      plunger.position.y = 0.095;
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.018, 10), new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 }));
      hub.position.y = 0.068;
      var needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.001, 0.058, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 }));
      needle.position.y = 0.030;
      var layWrap = new THREE.Group();
      layWrap.add(liqMesh, plunger, barrel, flange, hub, needle);
      layWrap.rotation.z = Math.PI / 2;
      layWrap.position.set(0.12, 0.022, 0);
      sg.add(layWrap);
      sg.userData.isSyringe = true;
      sg.userData.syrCtrl = { volMl: 0, liqMesh: liqMesh, plunger: plunger };
      var item = registerPickable(id, 'Seringa 10ml (Vazia)', sg, px, py, pz, 0, 0.14, 0.06);
      item.setVolume = function (v) { updateSyringeVolume(item, v); };
      updateSyringeVolume(item, 0);
      return item;
    }

    makeMagneticStirrer('magnetic_stirrer', -20.95, 0.91, -10.55);
    makeLiquidJar800('liquid_culture', -20.95, 1.015, -10.59, 350);
    makeBeaker1L('beaker_1l_a', -20.42, 0.91, -10.55, 0);
    makeBeaker1L('beaker_1l_b', -20.08, 0.91, -10.55, 500);
    makeSyringe10ml('syringe_10ml_a', -19.72, 0.91, -10.42);
    makeSyringe10ml('syringe_10ml_b', -19.72, 0.91, -10.72);

    // Estantes Industriais Porta-Pallet (Azul Royal + Laranja) fixas no DEPOSITO (Bloco Oeste-Sul: x: -24..-14, z: 2.2..13.8)
    function addStoragePortaPalletRack(rx, rz, totalLen, depth, rotY) {
      var floorY = 0.12;
      var rackH = 2.34;
      var rg = new THREE.Group();
      rg.position.set(rx, floorY, rz);
      rg.rotation.y = rotY || 0;

      var blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.34, metalness: 0.48 });
      var orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32, metalness: 0.42 });
      var darkFootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.4 });

      var halfL = totalLen / 2;
      var halfD = depth / 2;
      var colPositions = [-halfL + 0.04, 0, halfL - 0.04];

      // 3 Montantes verticais azuis (esquerda, centro, direita) com trelica horizontal e diagonal Z (fiel a foto!)
      colPositions.forEach(function (cx) {
        [-halfD + 0.04, halfD - 0.04].forEach(function (cz) {
          var post = makeBox(0.065, rackH, 0.065, blueMat);
          post.position.set(cx, rackH / 2, cz);
          var foot = makeBox(0.11, 0.018, 0.11, darkFootMat, { noShadow: true });
          foot.position.set(cx, 0.009, cz);
          rg.add(post, foot);
        });
        // Travessas horizontais azuis conectando frente e fundo do montante
        [0.18, 0.88, 1.58, 2.26].forEach(function (by) {
          var hBrace = makeBox(0.036, 0.036, depth - 0.08, blueMat, { noShadow: true });
          hBrace.position.set(cx, by, 0);
          rg.add(hBrace);
        });
        // Trelicas diagonais azuis em zig-zag entre as colunas frontal e traseira
        var diagSpanZ = depth - 0.12;
        var diagSpanY = 0.66;
        var diagLen = Math.hypot(diagSpanZ, diagSpanY);
        var diagAng = Math.atan2(diagSpanY, diagSpanZ);
        [[0.53, 1], [1.23, -1], [1.92, 1]].forEach(function (dg) {
          var dBar = makeBox(0.030, 0.030, diagLen, blueMat, { noShadow: true });
          dBar.position.set(cx, dg[0], 0);
          dBar.rotation.x = dg[1] * diagAng;
          rg.add(dBar);
        });
      });

      var rotSwap = Math.abs(Math.sin(rotY || 0)) > 0.707;
      var worldHalfX = rotSwap ? halfD : halfL;
      var worldHalfZ = rotSwap ? halfL : halfD;
      var shelfLevels = [0.28, 0.96, 1.64];
      shelfLevels.forEach(function (sy) {
        var rSurf = {
          minX: rx - worldHalfX + 0.04, maxX: rx + worldHalfX - 0.04,
          minZ: rz - worldHalfZ + 0.04, maxZ: rz + worldHalfZ - 0.04,
          topY: floorY + sy + 0.038
        };
        supportSurfaces.push(rSurf);
        [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
          var beam = makeBox(totalLen - 0.04, 0.072, 0.042, orangeMat);
          beam.position.set(0, sy, bz);
          beam.userData.supportSurface = rSurf;
          supportMeshes.push(beam);
          rg.add(beam);
          colPositions.forEach(function (cx) {
            var bracket = makeBox(0.082, 0.12, 0.082, orangeMat, { noShadow: true });
            bracket.position.set(cx, sy, bz);
            rg.add(bracket);
          });
        });
        var tray = makeBox(totalLen - 0.10, 0.032, depth - 0.08, orangeMat);
        tray.position.set(0, sy + 0.022, 0);
        tray.userData.supportSurface = rSurf;
        supportMeshes.push(tray);
        rg.add(tray);
      });

      // Longarinas superiores laranjas de travamento no topo (como na foto!)
      [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
        var topBeam = makeBox(totalLen - 0.04, 0.068, 0.042, orangeMat);
        topBeam.position.set(0, 2.24, bz);
        rg.add(topBeam);
        colPositions.forEach(function (cx) {
          var topBracket = makeBox(0.082, 0.11, 0.082, orangeMat, { noShadow: true });
          topBracket.position.set(cx, 2.24, bz);
          rg.add(topBracket);
        });
      });

      scene.add(rg);

      solidColliders.push({
        minX: rx - worldHalfX, maxX: rx + worldHalfX,
        minZ: rz - worldHalfZ, maxZ: rz + worldHalfZ,
        minY: floorY, maxY: floorY + rackH
      });
    }

    // 3 Estantes Porta-Pallet no Deposito (parede Oeste ao fundo, parede Norte e parede Sul)
    addStoragePortaPalletRack(-23.05, 8.0, 7.6, 0.86, Math.PI / 2);
    addStoragePortaPalletRack(-19.2, 3.05, 5.4, 0.86, 0);
    addStoragePortaPalletRack(-19.8, 12.95, 4.8, 0.86, Math.PI);

    // Helpers de Insumos Extras do Deposito
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function makeSubstrateBag5kg(id, kind, px, py, pz) {
      var sg = new THREE.Group();
      var isGrain = kind === 'grain';
      var bagColor = isGrain ? 0xd97706 : 0x78350f;
      var bag = makeBox(0.30, 0.42, 0.22, bagColor, { roughness: 0.85 });
      bag.position.y = 0.21;
      var c = document.createElement('canvas'); c.width = 256; c.height = 128;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = isGrain ? '#b45309' : '#065f46';
      ctx.fillRect(0, 0, 256, 36);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isGrain ? 'GRÃOS • MILHO 5KG' : 'SUBSTRATO BULK 5KG', 128, 25);
      ctx.fillStyle = '#1e293b'; ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(isGrain ? 'Spawn / Semente' : 'Serragem + Fibra Coco', 128, 72);
      ctx.fillStyle = '#64748b'; ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('Uso Laboratorial • Estoque', 128, 102);
      var lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.12),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })
      );
      lbl.position.set(0, 0.24, 0.112);
      sg.add(bag, lbl);
      var label = isGrain ? 'Saco de Grãos/Milho 5kg' : 'Saco de Substrato (Serragem/Coco) 5kg';
      return registerPickable(id, label, sg, px, py, pz, 0, 0.26, 0.42);
    }

    function makeGlovesBox(id, px, py, pz) {
      var gg = new THREE.Group();
      var box = makeBox(0.24, 0.12, 0.13, 0x0284c7, { roughness: 0.45 });
      box.position.y = 0.06;
      var slot = makeBox(0.12, 0.008, 0.05, 0xe0f2fe, { noShadow: true });
      slot.position.set(0, 0.122, 0);
      var strip = makeBox(0.242, 0.04, 0.132, 0xf8fafc, { noShadow: true });
      strip.position.y = 0.085;
      gg.add(box, slot, strip);
      return registerPickable(id, 'Caixa de Luvas Nitrílicas Estéreis', gg, px, py, pz, 0, 0.18, 0.14);
    }

    function makeTapeRoll(id, kind, px, py, pz) {
      var tg = new THREE.Group();
      var isMicro = kind === 'micropore';
      var outer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, isMicro ? 0.032 : 0.055, 18),
        new THREE.MeshStandardMaterial({ color: isMicro ? 0xf8fafc : 0xe2e8f0, roughness: 0.6 })
      );
      outer.position.y = isMicro ? 0.016 : 0.0275;
      var core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, isMicro ? 0.034 : 0.057, 14),
        new THREE.MeshStandardMaterial({ color: isMicro ? 0x0284c7 : 0x7c3aed, roughness: 0.5 })
      );
      core.position.y = outer.position.y;
      tg.add(outer, core);
      var lbl = isMicro ? 'Rolo de Fita Micropore (Troca Gasosa)' : 'Rolo de Parafilm M (Vedação Petri)';
      return registerPickable(id, lbl, tg, px, py, pz, 0, 0.08, 0.06);
    }

    function makeFoilRoll(id, px, py, pz) {
      var fg = new THREE.Group();
      var box = makeBox(0.32, 0.065, 0.065, 0xdc2626, { roughness: 0.45 });
      box.position.y = 0.0325;
      var band = makeBox(0.322, 0.025, 0.067, 0xfef08a, { noShadow: true });
      band.position.y = 0.04;
      fg.add(box, band);
      return registerPickable(id, 'Papel Alumínio (Autoclave)', fg, px, py, pz, 0, 0.18, 0.08);
    }

    // Popular Estoque do Deposito (Niveis: 0.438 | 1.118 | 1.798)
    // 1. ESTANTE NORTE (x: -21.7..-16.7, z = 3.05)
    // Nivel 2 (y = 1.118): 15 Bags 1,5kg Vazias
    for (var bi = 0; bi < 15; bi++) {
      var bRow = Math.floor(bi / 8);
      var bCol = bi % 8;
      makeSpawnBag1500('spawn_bag_empty_' + pad2(bi + 1), false, -21.4 + bCol * 0.62, 1.118, 2.86 + bRow * 0.36);
    }
    // Nivel 1 (y = 0.438): 4 Sacos de Graos/Milho 5kg + 4 Sacos de Substrato Bulk 5kg
    for (var si = 0; si < 4; si++) {
      makeSubstrateBag5kg('substrate_grain_' + pad2(si + 1), 'grain', -21.35 + si * 0.58, 0.438, 3.05);
      makeSubstrateBag5kg('substrate_sawdust_' + pad2(si + 1), 'sawdust', -18.85 + si * 0.58, 0.438, 3.05);
    }
    // Nivel 3 (y = 1.798): 40 Placas de Petri Vazias (5 pilhas de 7 + 1 pilha de 5 = 40!) + 2 Frascos PDA extras
    for (var pIdx = 0; pIdx < 40; pIdx++) {
      var stackIdx = Math.floor(pIdx / 7);
      var stackLvl = pIdx % 7;
      registerPickable(
        'petri_bare_' + pad2(pIdx + 1),
        'Placa de Petri Vazia',
        makePetriDish('bare'),
        -21.3 + stackIdx * 0.56,
        1.798 + stackLvl * 0.055,
        3.05,
        0, 0.20, 0.08
      );
    }
    registerPickable('pda_bottle_02', 'Ágar PDA / BDA (500g)', pdaGroup.clone(), -17.55, 1.798, 3.05, 0, 0.14, 0.31);
    registerPickable('pda_bottle_03', 'Ágar PDA / BDA (500g)', pdaGroup.clone(), -17.15, 1.798, 3.05, 0, 0.14, 0.31);

    // 2. ESTANTE OESTE / FUNDO (x = -23.05, z: 4.4..11.6)
    // Nivel 2 (y = 1.118): 15 Vidros 800ml Vazios
    for (var ji = 0; ji < 15; ji++) {
      var jRow = Math.floor(ji / 8);
      var jCol = ji % 8;
      makeSpawnJar800('spawn_jar_empty_' + pad2(ji + 1), false, -23.22 + jRow * 0.34, 1.118, 4.75 + jCol * 0.85);
    }
    // Nivel 1 (y = 0.438): 3 Caixas de Luvas Nitrilicas + 3 Rolos Papel Aluminio + 2 Borrifadores Alcool 70%
    for (var gi = 0; gi < 3; gi++) {
      makeGlovesBox('gloves_box_' + pad2(gi + 1), -23.05, 0.438, 4.9 + gi * 0.65);
      makeFoilRoll('foil_roll_' + pad2(gi + 1), -23.05, 0.438, 7.2 + gi * 0.65);
    }
    makeAlcoholSprayBottle('alcohol_spray_02', -23.05, 0.438, 9.8);
    makeAlcoholSprayBottle('alcohol_spray_03', -23.05, 0.438, 10.4);
    // Nivel 3 (y = 1.798): 4 Rolos Fita Micropore + 3 Rolos Parafilm M + 2 Bequeres 1L extras
    for (var mi = 0; mi < 4; mi++) {
      makeTapeRoll('micropore_' + pad2(mi + 1), 'micropore', -23.05, 1.798, 4.8 + mi * 0.45);
    }
    for (var pfi = 0; pfi < 3; pfi++) {
      makeTapeRoll('parafilm_' + pad2(pfi + 1), 'parafilm', -23.05, 1.798, 7.1 + pfi * 0.45);
    }
    makeBeaker1L('beaker_1l_03', -23.05, 1.798, 9.2, 0);
    makeBeaker1L('beaker_1l_04', -23.05, 1.798, 9.9, 0);

    // 3. ESTANTE SUL (x: -22.0..-17.6, z = 12.95)
    // Nivel 2 (y = 1.118): 20 Seringas 10ml Estereis
    for (var syi = 0; syi < 20; syi++) {
      var sRow = Math.floor(syi / 10);
      var sCol = syi % 10;
      makeSyringe10ml('syringe_10ml_' + pad2(syi + 1), -21.75 + sCol * 0.43, 1.118, 12.78 + sRow * 0.34);
    }

    // ALA LESTE (Direita) — 2 blocos de 2 andares (x: 14..24)
    // Bloco Leste-Norte (z: -12.8..-1.2): SUBSTRATOS & PASTEURIZACAO + 2o andar acessivel
    buildCampusBuildingWing({ cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta de Substratos', doorSign: '🧪 SUBSTRATOS', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 2 });
    // Bloco Leste-Sul (z: 2.2..13.8): ESTUFA DE FRUTIFICACAO + 2o andar acessivel
    buildCampusBuildingWing({ cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta da Estufa', doorSign: '🍄 ESTUFA', style: 'wood', connectNorth2F: true, boardIndex: 3 });

    createBanner(13.85, 5.1, -11.6, -Math.PI / 2, '#0284c7', '🧪');
    createBanner(13.85, 5.1, 3.6, -Math.PI / 2, '#15803d', '🍄');

    // Equipamentos de Substratos (Leste-Norte)
    addMovableStainlessTable('table_sub_east', 'Mesa Inox (Substratos)', 21.2, 0.12, -5.2, 1.5, 0.82, 3.2);
    createPressureCookerPair('pressure_cooker_sub', 'pressure_lid_sub', 'Substrato', 21.2, 0.94, -4.3);

    // Equipamentos da Estufa (Leste-Sul)
    var rack = makeBox(1.6, 0.72, 4.0, 0x1e293b);
    rack.position.set(21.0, 0.14 + 0.36, 8.0);
    scene.add(rack);
    var ledBar = makeBox(0.28, 0.08, 3.6, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.9 });
    ledBar.position.set(21.0, 2.55, 8.0);
    scene.add(ledBar);
    solidColliders.push({ minX: 20.15, maxX: 21.85, minZ: 5.95, maxZ: 10.05, minY: 0.14, maxY: 1.0 });
    var estufaSurf = { minX: 20.25, maxX: 21.75, minZ: 6.05, maxZ: 9.95, topY: 0.86 };
    supportSurfaces.push(estufaSurf);
    rack.userData.supportSurface = estufaSurf;
    supportMeshes.push(rack);

    var mushBlock = new THREE.Group();
    var subBlock = makeBox(0.38, 0.28, 0.28, 0xf5f5f4);
    subBlock.position.y = 0.14; mushBlock.add(subBlock);
    for (var mb = -1; mb <= 1; mb++) {
      var ms = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xfef3c7 }));
      ms.position.set(mb * 0.11, 0.35, 0);
      var mc = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0xd97706 }));
      mc.position.set(mb * 0.11, 0.43, 0);
      mushBlock.add(ms, mc);
    }
    registerPickable('fruiting_block', 'Bloco em Frutificação (Ostra/Juba)', mushBlock, 21.0, 0.86, 8.0, 0, 0.26, 0.48);
  }

  // ---------------- Mega Campus: Lago em 8, Esportes, Student Center, Dormitorios & Avenidas ----------------

  function buildOuterCampus() {
    // 1. Avenidas asfaltadas com faixas de pedestres
    var roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 });
    var roadSouth = makeBox(140, 0.03, 7.0, roadMat, { noShadow: true });
    roadSouth.position.set(0, 0.015, 39.5);
    var roadEast = makeBox(7.0, 0.03, 62, roadMat, { noShadow: true });
    roadEast.position.set(30.5, 0.015, 8.5);
    scene.add(roadSouth, roadEast);

    // Faixas de pedestres
    for (var s = -2; s <= 2; s++) {
      var st1 = makeBox(0.65, 0.04, 4.8, 0xf8fafc, { noShadow: true });
      st1.position.set(-42 + s * 1.3, 0.02, 39.5);
      var st2 = makeBox(4.8, 0.04, 0.65, 0xf8fafc, { noShadow: true });
      st2.position.set(30.5, 0.02, 12 + s * 1.3);
      scene.add(st1, st2);
    }

    // Calcada em bloquetes ligando a Praca Central ate a beira da ponte do Lago em 8 (sem passar por baixo da agua!)
    var walkS = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
    walkS.rotation.x = -Math.PI / 2; walkS.position.set(0, 0.022, 19.2); walkS.receiveShadow = true;
    var walkE = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
    walkE.rotation.x = -Math.PI / 2; walkE.position.set(27, 0.022, 12); walkE.receiveShadow = true;
    scene.add(walkS, walkE);

    // 2. Lago Duplo (formato de 8) no Sul + Ponte de Madeira caminhavel (com fundo azul profundo e textura de agua animada!)
    var lakeMat = new THREE.MeshStandardMaterial({
      map: texWater,
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.18,
      roughness: 0.08,
      metalness: 0.22,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });
    var lakeBedMat = new THREE.MeshStandardMaterial({ color: 0x082f49, roughness: 0.9 });
    [-6.5, 6.5].forEach(function (lx) {
      var bed = new THREE.Mesh(new THREE.CircleGeometry(7.55, 32), lakeBedMat);
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(lx, 0.02, 28.0);
      scene.add(bed);
      var lobe = new THREE.Mesh(new THREE.CircleGeometry(7.55, 32), lakeMat);
      lobe.rotation.x = -Math.PI / 2;
      lobe.position.set(lx, 0.06, 28.0);
      scene.add(lobe);
      var rim = new THREE.Mesh(new THREE.RingGeometry(7.45, 8.25, 32), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.82 }));
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(lx, 0.045, 28.0);
      scene.add(rim);
    });
    // Ponte de madeira atravessando o meio do Lago em 8 (x: -2.2..2.2, z: 21..35)
    addWalkableSlab(0, 0.48, 28.0, 3.6, 0.24, 13.5, 0x92400e, { roughness: 0.8 });
    [-1.7, 1.7].forEach(function (px) {
      addSolidWall(px, 21.5, px, 34.5, 0.48, 0.85, 0.1, 0x78350f);
    });

    // 3. Complexo Esportivo Oeste
    // 3a. Campo de Futebol + Pista de Atletismo vermelha (x: -54, z: -15)
    var track = makeBox(30, 0.04, 19, 0xb91c1c, { roughness: 0.85, noShadow: true });
    track.position.set(-50, 0.02, -15);
    var field = makeBox(24, 0.05, 14, 0x16a34a, { roughness: 0.9, noShadow: true });
    field.position.set(-50, 0.025, -15);
    scene.add(track, field);
    var midLine = makeBox(0.14, 0.06, 13.8, 0xffffff, { noShadow: true });
    midLine.position.set(-50, 0.03, -15);
    scene.add(midLine);
    [-61.5, -38.5].forEach(function (gx) {
      var goal = makeBox(0.3, 2.0, 4.2, 0xf8fafc, { transparent: true, opacity: 0.75 });
      goal.position.set(gx, 1.0, -15);
      scene.add(goal);
    });
    // Arquibancada
    for (var b = 0; b < 3; b++) {
      var bleacher = makeBox(18, 0.45, 1.1, 0x94a3b8);
      bleacher.position.set(-50, 0.22 + b * 0.45, -26 - b * 1.1);
      scene.add(bleacher);
    }

    // 3b. Quadra de Basquete (x: -48, z: 6)
    var bball = makeBox(18, 0.04, 12, 0x0f766e, { roughness: 0.8, noShadow: true });
    bball.position.set(-48, 0.02, 6);
    var bballIn = makeBox(15, 0.05, 9.5, 0x15803d, { roughness: 0.8, noShadow: true });
    bballIn.position.set(-48, 0.025, 6);
    scene.add(bball, bballIn);
    [-55.5, -40.5].forEach(function (hx) {
      var post = makeBox(0.16, 3.0, 0.16, 0x1e293b);
      post.position.set(hx, 1.5, 6);
      var boardB = makeBox(0.12, 1.0, 1.6, 0xf8fafc);
      boardB.position.set(hx + (hx < -48 ? 0.35 : -0.35), 2.8, 6);
      scene.add(post, boardB);
    });

    // 3c. Quadras de Tenis azuis (x: -48, z: -36)
    [-54, -42].forEach(function (tx) {
      var tCourt = makeBox(10, 0.04, 15, 0x1d4ed8, { roughness: 0.8, noShadow: true });
      tCourt.position.set(tx, 0.02, -36);
      var tNet = makeBox(9.2, 0.9, 0.1, 0xf8fafc, { transparent: true, opacity: 0.85 });
      tNet.position.set(tx, 0.45, -36);
      scene.add(tCourt, tNet);
    });

    // 3d. Estacionamento Sudoeste com carros
    var lot = makeBox(24, 0.03, 18, roadMat, { noShadow: true });
    lot.position.set(-48, 0.015, 24);
    scene.add(lot);
    var carCols = [0xef4444, 0x3b82f6, 0xfacc15, 0xf8fafc, 0x10b981, 0x64748b];
    for (var c = 0; c < 6; c++) {
      var car = makeBox(2.0, 1.1, 3.6, carCols[c], { roughness: 0.35, metalness: 0.3 });
      car.position.set(-55 + (c % 3) * 6.5, 0.55, 19 + Math.floor(c / 3) * 9.5);
      scene.add(car);
      solidColliders.push({
        minX: car.position.x - 1.1, maxX: car.position.x + 1.1,
        minZ: car.position.z - 1.9, maxZ: car.position.z + 1.9, minY: 0, maxY: 1.4
      });
    }

    // 4. Setor Leste: Student Center + 2a Praca Circular + Dormitorios
    // 4a. Student Center (x: 48, z: -12) com terraco aberto no 2o andar
    // 4a. Student Center -> GRANDE AUDITORIO / CINEMA CAMINHÁVEL (x: 48, z: -12)
    addWalkableSlab(48, 0.14, -12, 22, 0.14, 16, 0x334155);
    var scRoof = makeBox(22.6, 0.4, 16.6, 0x64748b);
    scRoof.position.set(48, 6.7, -12);
    registerSnowable(scRoof.material);
    roofZones.push({ minX: 36.5, maxX: 59.5, minZ: -20.5, maxZ: -3.5, roofY: 6.9 });
    scene.add(scRoof);
    // Paredes do Auditorio com entrada ampla no Sul (x: 46..50 aberta!)
    addSolidWall(37, -20, 59, -20, 0.14, 6.4, 0.35, brickMat(5, 2)); // Norte (fundo da tela)
    addSolidWall(37, -20, 37, -4, 0.14, 6.4, 0.35, brickMat(4, 2));  // Oeste
    addSolidWall(59, -20, 59, -4, 0.14, 6.4, 0.35, brickMat(4, 2));  // Leste
    addSolidWall(37, -4, 46, -4, 0.14, 6.4, 0.35, brickMat(2.2, 2)); // Sul esq
    addSolidWall(50, -4, 59, -4, 0.14, 6.4, 0.35, brickMat(2.2, 2)); // Sul dir
    var scHeader = makeBox(4.2, 2.8, 0.35, brickMat(1.2, 0.8));
    scHeader.position.set(48, 5.1, -4);
    scene.add(scHeader);

    // Letreiro 3D Student Center / Auditorio
    var scSignC = document.createElement('canvas');
    scSignC.width = 512; scSignC.height = 96;
    var scCtx = scSignC.getContext('2d');
    scCtx.fillStyle = '#0f172a'; scCtx.fillRect(0, 0, 512, 96);
    scCtx.fillStyle = '#38bdf8'; scCtx.font = 'bold 34px system-ui, sans-serif';
    scCtx.textAlign = 'center'; scCtx.textBaseline = 'middle';
    scCtx.fillText('STUDENT CENTER • AUDITÓRIO', 256, 48);
    var scSign = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(scSignC) }));
    scSign.position.set(48, 5.2, -3.78);
    scene.add(scSign);

    // Tela gigante do Projetor na parede Norte (z = -19.65)
    cinemaCanvas = document.createElement('canvas');
    cinemaCanvas.width = 768; cinemaCanvas.height = 384;
    cinemaCtx = cinemaCanvas.getContext('2d');
    cinemaTex = new THREE.CanvasTexture(cinemaCanvas);
    var cinemaFrame = makeBox(11.6, 5.4, 0.18, 0x0f172a);
    cinemaFrame.position.set(48, 3.6, -19.72);
    scene.add(cinemaFrame);
    cinemaScreenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11.0, 5.0),
      new THREE.MeshBasicMaterial({ map: cinemaTex })
    );
    cinemaScreenMesh.position.set(48, 3.6, -19.6);
    scene.add(cinemaScreenMesh);

    // Projetor no teto + Feixe de luz volumetrico
    var projBody = makeBox(0.85, 0.38, 1.0, 0x1e293b, { metalness: 0.6 });
    projBody.position.set(48, 5.7, -8.5);
    var projLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x38bdf8, emissiveIntensity: 1.4 })
    );
    projLens.rotation.x = Math.PI / 2;
    projLens.position.set(48, 5.65, -9.05);
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd, transparent: true, opacity: 0.11,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    cinemaBeam = new THREE.Mesh(new THREE.ConeGeometry(4.2, 10.6, 24, 1, true), beamMat);
    cinemaBeam.position.set(48, 4.65, -14.3);
    cinemaBeam.rotation.x = Math.PI / 2 - 0.19;
    scene.add(projBody, projLens, cinemaBeam);

    // 3 fileiras de poltronas do Auditorio (clicaveis para sentar e assistir!)
    [-14.5, -12.2, -9.9].forEach(function (rz, rIdx) {
      var rowBench = makeBox(11.0, 0.45, 0.85, 0x991b1b, { roughness: 0.7 });
      rowBench.position.set(48, 0.38 + rIdx * 0.18, rz);
      var rowBack = makeBox(11.0, 0.55, 0.16, 0x7f1d1d, { roughness: 0.7 });
      rowBack.position.set(48, 0.78 + rIdx * 0.18, rz + 0.36);
      scene.add(rowBench, rowBack);
      solidColliders.push({ minX: 42.4, maxX: 53.6, minZ: rz - 0.45, maxZ: rz + 0.45, minY: 0, maxY: 1.4 });
      [-4.4, -2.2, 0, 2.2, 4.4].forEach(function (sx) {
        var audSeatHit = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 0.65, 0.85),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        audSeatHit.position.set(48 + sx, 0.52 + rIdx * 0.18, rz);
        audSeatHit.userData.seatInfo = { x: 48 + sx, y: 0.14 + rIdx * 0.18, z: rz - 0.04, yaw: 0 };
        scene.add(audSeatHit);
        seatMeshes.push(audSeatHit);
      });
    });

    // Quadra poliesportiva livre (sem guarda-sois)

    // 4b. 2a Praca Circular Leste com Fonte (x: 42, z: 12, sem z-fighting!)
    var plazaE = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.04, 28), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
    plazaE.position.set(42, 0.025, 12);
    var bedE = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.10, 28), lakeBedMat);
    bedE.position.set(42, 0.08, 12);
    var wallE = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.58, 0.44, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, side: THREE.DoubleSide }));
    wallE.position.set(42, 0.24, 12);
    var rimTorusE = new THREE.Mesh(new THREE.TorusGeometry(2.32, 0.18, 12, 32), new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.6 }));
    rimTorusE.rotation.x = Math.PI / 2;
    rimTorusE.scale.set(1, 1, 0.45);
    rimTorusE.position.set(42, 0.45, 12);
    var waterE = new THREE.Mesh(new THREE.CircleGeometry(2.18, 28), lakeMat);
    waterE.rotation.x = -Math.PI / 2;
    waterE.position.set(42, 0.39, 12);
    scene.add(plazaE, bedE, wallE, rimTorusE, waterE);
    solidColliders.push({ minX: 39.5, maxX: 44.5, minZ: 9.5, maxZ: 14.5, minY: 0, maxY: 1.2 });

    // 4c. 2 Dormitorios Caminhaveis no Sudeste (com porta aberta, piso, cama e mesa!)
    [[58, 12, 0xfacc15], [50, 28, 0x38bdf8]].forEach(function (dm) {
      var dx = dm[0], dz = dm[1];
      addWalkableSlab(dx, 0.14, dz, 14, 0.14, 10, 0x475569);
      var dRoof = makeBox(14.6, 0.4, 10.6, 0x64748b);
      dRoof.position.set(dx, 5.4, dz);
      registerSnowable(dRoof.material);
      roofZones.push({ minX: dx - 7.5, maxX: dx + 7.5, minZ: dz - 5.5, maxZ: dz + 5.5, roofY: 5.6 });
      scene.add(dRoof);
      addSolidWall(dx - 7, dz - 5, dx + 7, dz - 5, 0.14, 5.1, 0.3, brickMat(3, 2)); // Fundo
      addSolidWall(dx - 7, dz - 5, dx - 7, dz + 5, 0.14, 5.1, 0.3, brickMat(2, 2)); // Esq
      addSolidWall(dx + 7, dz - 5, dx + 7, dz + 5, 0.14, 5.1, 0.3, brickMat(2, 2)); // Dir
      // Frente (dz + 5) com porta aberta em dx - 4.0 (largura 2.4m)
      addSolidWall(dx - 7, dz + 5, dx - 5.2, dz + 5, 0.14, 5.1, 0.3, brickMat(1, 2));
      addSolidWall(dx - 2.8, dz + 5, dx + 7, dz + 5, 0.14, 5.1, 0.3, brickMat(2, 2));
      var dHeader = makeBox(2.5, 2.3, 0.3, brickMat(1, 1));
      dHeader.position.set(dx - 4.0, 4.1, dz + 5);
      var awning = makeBox(2.8, 0.25, 1.3, dm[2]);
      awning.position.set(dx - 4.0, 2.95, dz + 5.65);
      // Cama & escrivaninha interna
      var bed = makeBox(2.2, 0.55, 1.3, 0x3b82f6, { roughness: 0.7 });
      bed.position.set(dx + 3.5, 0.42, dz - 2.5);
      var dDesk = makeBox(1.8, 0.75, 0.9, 0xd97706, { roughness: 0.65 });
      dDesk.position.set(dx + 3.5, 0.52, dz + 2.5);
      scene.add(dHeader, awning, bed, dDesk);
      solidColliders.push({ minX: dx + 2.3, maxX: dx + 4.7, minZ: dz - 3.2, maxZ: dz - 1.8, minY: 0, maxY: 1.0 });
      solidColliders.push({ minX: dx + 2.5, maxX: dx + 4.5, minZ: dz + 2.0, maxZ: dz + 3.0, minY: 0, maxY: 1.0 });
    });
  }

  // ---------------- Colisao & Posicionamento de Itens ----------------

  function clampPosAgainstWalls(pos, radius) {
    for (var i = 0; i < wallSegments.length; i++) {
      var w = wallSegments[i];
      if (w.minY !== undefined && (pos.y + 1.4 < w.minY || pos.y > w.maxY - 0.15)) continue;
      var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      var len2 = vx * vx + vz * vz;
      if (len2 === 0) continue;
      var t = Math.max(0, Math.min(1, ((pos.x - w.x1) * vx + (pos.z - w.z1) * vz) / len2));
      var cx = w.x1 + t * vx, cz = w.z1 + t * vz;
      var dx = pos.x - cx, dz = pos.z - cz;
      var dist = Math.hypot(dx, dz);
      var minD = radius + w.halfThick;
      if (dist < minD) {
        if (dist < 0.0001) { dx = 1; dz = 0; dist = 1; }
        pos.x = cx + (dx / dist) * minD;
        pos.z = cz + (dz / dist) * minD;
      }
    }
    for (var dIdx = 0; dIdx < campusDoors.length; dIdx++) {
      var dr = campusDoors[dIdx];
      if (!dr.open && pos.y < 3.4 && pos.z > dr.minZ - 0.1 && pos.z < dr.maxZ + 0.1 && Math.abs(pos.x - dr.frontX) < radius + 0.18) {
        pos.x = pos.x >= dr.frontX ? dr.frontX + radius + 0.18 : dr.frontX - radius - 0.18;
      }
    }
    for (var j = 0; j < solidColliders.length; j++) {
      var c = solidColliders[j];
      if (pos.y > c.maxY - 0.15 || pos.y + 1.5 < c.minY) continue;
      var nearX = Math.max(c.minX, Math.min(pos.x, c.maxX));
      var nearZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      var cdx = pos.x - nearX, cdz = pos.z - nearZ;
      var cdist = Math.hypot(cdx, cdz);
      if (cdist < radius) {
        if (cdist < 0.0001) { pos.x = c.minX - radius; }
        else {
          pos.x = nearX + (cdx / cdist) * radius;
          pos.z = nearZ + (cdz / cdist) * radius;
        }
      }
    }
    pos.x = Math.max(-200, Math.min(200, pos.x));
    pos.z = Math.max(-200, Math.min(200, pos.z));
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

  function prepareGhostCloneMesh(rootGroup, matList) {
    rootGroup.traverse(function (ch) {
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
          m.opacity = origM.transparent ? Math.max(0.24, origOp * 0.82) : 0.68;
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
    if (placementGhostLastValid !== isValid) {
      placementGhostLastValid = isValid;
      var tintCol = new THREE.Color(isValid ? 0x34d399 : 0xf87171);
      var emiCol = new THREE.Color(isValid ? 0x059669 : 0xdc2626);
      for (var i = 0; i < placementHoloMats.length; i++) {
        var m = placementHoloMats[i];
        if (m.color && m.userData._baseColor) {
          m.color.copy(m.userData._baseColor).lerp(tintCol, 0.28);
        }
        if (m.emissive) {
          m.emissive.copy(emiCol);
          m.emissiveIntensity = 0.26;
        }
      }
    }
    placementHoloWrap.rotation.y = rotY;
    var pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.04;
    placementRing.scale.set(pulse, pulse, 1);
  }

  function findPlacementTarget(customNdc) {
    snapClosePot = null;
    snapPetriStack = false;
    var rayNdc = customNdc || (inFps ? new THREE.Vector2(0, 0) : pointerNdc);
    raycaster.setFromCamera(rayNdc, camera);
    var dir = raycaster.ray.direction;
    var origin = raycaster.ray.origin;
    var bestPt = null;
    var bestT = Infinity;

    // 0. Se estiver segurando uma Tampa de Panela e mirar na Panela aberta (ou na boca dela), encaixa para fechar!
    if (heldItem && heldItem.potItem) {
      var targetPot = heldItem.potItem;
      var potCenter = new THREE.Vector3(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.24, targetPot.mesh.position.z);
      var camDist = origin.distanceTo(potCenter);
      var potHits = raycaster.intersectObject(targetPot.mesh, true);
      if ((potHits.length > 0 && potHits[0].distance < 4.5) || (camDist < 4.5 && raycaster.ray.distanceSqToPoint(potCenter) < 0.18)) {
        snapClosePot = targetPot;
        heldRotY = targetPot.mesh.rotation.y;
        return new THREE.Vector3(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.36, targetPot.mesh.position.z);
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
        var cTop = new THREE.Vector3(cp.x, cp.y + 0.03, cp.z);
        var dCam = origin.distanceTo(cTop);
        if (dCam < petriDist && raycaster.ray.distanceSqToPoint(cTop) < 0.036) {
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
          if (Math.hypot(pOther.mesh.position.x - bx, pOther.mesh.position.z - bz) < 0.10) {
            stackCount++;
            if (pOther.mesh.position.y > maxY) maxY = pOther.mesh.position.y;
          }
        }
        if (stackCount < 7) {
          snapPetriStack = true;
          return new THREE.Vector3(bx, maxY + 0.055, bz);
        }
      }
    }

    // 1. Raycast direto nas meshes de prateleiras, bancadas e mesas (evita atravessar prateleiras de cima!)
    if (supportMeshes.length) {
      var sHits = raycaster.intersectObjects(supportMeshes, false);
      for (var si = 0; si < sHits.length; si++) {
        var sh = sHits[si];
        if (sh.distance < 0.02 || sh.distance > 5.5) continue;
        var sSurf = sh.object.userData.supportSurface;
        if (!sSurf) continue;
        if (heldItem && heldItem.mesh && heldItem.mesh.userData.dynamicSurface === sSurf) continue;
        var cx = Math.max(sSurf.minX + 0.02, Math.min(sSurf.maxX - 0.02, sh.point.x));
        var cz = Math.max(sSurf.minZ + 0.02, Math.min(sSurf.maxZ - 0.02, sh.point.z));
        return new THREE.Vector3(cx, sSurf.topY, cz);
      }
    }

    // 1b. Fallback plano matematico para superficies sem mesh associada
    if (dir.y < -0.005) {
      for (var i = 0; i < supportSurfaces.length; i++) {
        var s = supportSurfaces[i];
        var tPlane = (s.topY - origin.y) / dir.y;
        if (tPlane >= 0.08 && tPlane <= 5.5 && tPlane < bestT) {
          var hx = origin.x + dir.x * tPlane;
          var hz = origin.z + dir.z * tPlane;
          if (hx >= s.minX - 0.05 && hx <= s.maxX + 0.05 && hz >= s.minZ - 0.05 && hz <= s.maxZ + 0.05) {
            var cx = Math.max(s.minX + 0.02, Math.min(s.maxX - 0.02, hx));
            var cz = Math.max(s.minZ + 0.02, Math.min(s.maxZ - 0.02, hz));
            bestT = tPlane;
            bestPt = new THREE.Vector3(cx, s.topY, cz);
          }
        }
      }
    }
    if (bestPt) return bestPt;

    // 2. Intersecao fina com piso / terreno / escadas ao longo da mira
    for (var t = 0.45; t <= 5.0; t += 0.08) {
      var px = origin.x + dir.x * t;
      var py = origin.y + dir.y * t;
      var pz = origin.z + dir.z * t;
      var gh = getGroundHeight(px, pz, playerPos.y);
      if (py <= gh + 0.04) {
        return new THREE.Vector3(px, gh, pz);
      }
    }

    // 3. Fallback suave seguindo a direcao exata do mouse/mira (mesmo olhando para parede/canto)
    var hLen = Math.hypot(dir.x, dir.z) || 1;
    var fx = playerPos.x + (dir.x / hLen) * 1.8;
    var fz = playerPos.z + (dir.z / hLen) * 1.8;
    return new THREE.Vector3(fx, getGroundHeight(fx, fz, playerPos.y), fz);
  }

  function isPlacementBlocked(pt) {
    if (snapClosePot || snapPetriStack) return false;
    // Impede colocar objetos grandes (Fluxo Laminar, Mesas, Agitador) em cima de outros itens ja existentes!
    if (heldItem && heldItem.mesh && heldItem.mesh.userData.tableDims) {
      var dims = heldItem.mesh.userData.tableDims;
      var c = Math.abs(Math.cos(heldRotY)), s = Math.abs(Math.sin(heldRotY));
      var hw = (dims.w * c + dims.d * s) * 0.5;
      var hd = (dims.w * s + dims.d * c) * 0.5;
      var hTop = heldItem.mesh.userData.isHood ? 1.1 : (dims.h || 0.85);
      for (var k = 0; k < pickableItems.length; k++) {
        var other = pickableItems[k];
        if (other === heldItem || other === heldItem.lidItem) continue;
        if (other.mesh.userData.isTable && heldItem.mesh.userData.isHood) continue;
        if (other.mesh.userData.isTable && heldItem.mesh.userData.isStirrer) continue;
        if (other.mesh.position.y >= pt.y - 0.12 && other.mesh.position.y <= pt.y + hTop) {
          var rad = (other.radius || 0.18) * 0.45;
          if (Math.abs(other.mesh.position.x - pt.x) < hw + rad && Math.abs(other.mesh.position.z - pt.z) < hd + rad) {
            return true;
          }
        }
      }
    }
    for (var i = 0; i < supportSurfaces.length; i++) {
      var s = supportSurfaces[i];
      if (pt.x >= s.minX && pt.x <= s.maxX && pt.z >= s.minZ && pt.z <= s.maxZ && Math.abs(pt.y - s.topY) < 0.08) {
        return false; // superficies de apoio (mesas, bandejas) sempre permitem soltar
      }
    }
    if (pt.y > 3.2) return false;
    for (var wIdx = 0; wIdx < wallSegments.length; wIdx++) {
      var w = wallSegments[wIdx];
      var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      var len2 = vx * vx + vz * vz;
      var t = Math.max(0, Math.min(1, ((pt.x - w.x1) * vx + (pt.z - w.z1) * vz) / len2));
      var dist = Math.hypot(pt.x - (w.x1 + t * vx), pt.z - (w.z1 + t * vz));
      if (dist < 0.25) return true;
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
      var supportedY = getGroundHeight(item.mesh.position.x, item.mesh.position.z, item.mesh.position.y);
      if (!item.mesh.userData.isTable) {
        for (var i = 0; i < supportSurfaces.length; i++) {
          var s = supportSurfaces[i];
          if (s === item.mesh.userData.dynamicSurface) continue;
          if (item.mesh.userData.isHood && s.isHood) continue;
          if (item.mesh.position.x >= s.minX && item.mesh.position.x <= s.maxX &&
              item.mesh.position.z >= s.minZ && item.mesh.position.z <= s.maxZ &&
              item.mesh.position.y >= s.topY - 0.15) {
            supportedY = Math.max(supportedY, s.topY);
          }
        }
        if (item.mesh.userData.isPetri) {
          for (var pj = 0; pj < pickableItems.length; pj++) {
            var pBase = pickableItems[pj];
            if (!pBase || pBase === item || pBase === heldItem || isHeldByRemote(pBase.id)) continue;
            if (!pBase.mesh || !pBase.mesh.userData.isPetri) continue;
            if (Math.hypot(pBase.mesh.position.x - item.mesh.position.x, pBase.mesh.position.z - item.mesh.position.z) < 0.12 &&
                item.mesh.position.y >= pBase.mesh.position.y + 0.025 &&
                item.mesh.position.y <= pBase.mesh.position.y + 0.14) {
              supportedY = Math.max(supportedY, pBase.mesh.position.y + 0.055);
            }
          }
        }
      }
      if (item.mesh.position.y > supportedY + 0.015) {
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

    // Chapeu de cogumelo com pintinhas brancas
    var hat = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hatMat);
    hat.position.set(0, 0.24, 0); hat.castShadow = true;
    var spotMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
    [[0, 0.56, 0.08], [-0.18, 0.45, -0.15], [0.18, 0.45, -0.15], [-0.16, 0.44, 0.16], [0.16, 0.44, 0.16]].forEach(function (sp) {
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), spotMat);
      dot.scale.set(1, 0.45, 1);
      dot.position.set(sp[0], sp[1], sp[2]);
      headGroup.add(dot);
    });
    headGroup.add(head, hat);

    var isProf = data.role === 'professor' || data.role === 'admin';
    var auraGroup = null;
    var auraOrbs = [];
    if (isProf) {
      auraGroup = new THREE.Group();
      var outerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 0.56, 36),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.025;
      var innerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.38, 36),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.50, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      innerRing.rotation.x = -Math.PI / 2;
      innerRing.position.y = 0.032;
      auraGroup.add(outerRing, innerRing);
      var orbGeo = new THREE.SphereGeometry(0.026, 8, 8);
      for (var oi = 0; oi < 8; oi++) {
        var oMat = new THREE.MeshBasicMaterial({
          color: oi % 2 === 0 ? 0x34d399 : 0xfbbf24,
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

    var labelSprite = data.isLocal ? null : makeTextSprite((isProf ? '👨‍🏫 ' : '') + (data.name || 'Aluno'), isProf ? '#fbbf24' : '#ffffff');
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

    scene.add(g);
    return {
      group: g, torso: torso, leftLeg: leftLeg, rightLeg: rightLeg, leftArm: leftArm, rightArm: rightArm, headGroup: headGroup,
      auraGroup: auraGroup, auraOrbs: auraOrbs,
      bodyMat: bodyMat, hatMat: hatMat,
      faceCtx: faceCtx, faceTex: faceTex, lastMood: 'happy', lastBlink: false, blinkTimer: 2 + Math.random() * 3,
      labelSprite: labelSprite, chatSprite: chatSprite, lastChat: '',
      targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      targetYaw: normalizeAngle(data.yaw || 0),
      targetPitch: data.pitch || 0,
      holding: '', walking: false, seated: false, walkPhase: 0
    };
  }

  function updateCampusPlayers(players) {
    var seen = {};
    (players || []).forEach(function (p) {
      seen[p.id] = true;
      var av = remoteAvatars[p.id];
      if (!av) {
        av = buildCuteAvatar(p);
        av.group.position.set(p.x, p.y, p.z);
        remoteAvatars[p.id] = av;
      }
      av.targetPos.set(p.x, p.y, p.z);
      av.targetYaw = normalizeAngle(p.yaw || 0);
      av.targetPitch = p.pitch || 0;
      av.walking = !!p.walking;
      av.seated = !!p.seated;
      av.holding = p.holding || '';
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

  function stepMultiplayerAvatars(dt) {
    var tNow = clock.elapsedTime;
    Object.keys(remoteAvatars).forEach(function (id) {
      var av = remoteAvatars[id];
      animateAvatarAura(av, tNow);
      av.group.position.lerp(av.targetPos, Math.min(1, dt * 10));
      var dYaw = normalizeAngle(av.targetYaw - av.group.rotation.y);
      av.group.rotation.y = normalizeAngle(av.group.rotation.y + dYaw * Math.min(1, dt * 12));
      av.headGroup.rotation.x += (av.targetPitch - av.headGroup.rotation.x) * Math.min(1, dt * 12);
      var heldObj = null;
      if (av.holding) {
        heldObj = findPickable(av.holding);
        if (heldObj && heldObj !== heldItem) {
          var isTwo = !!heldObj.mesh.userData.twoHanded;
          var handOffset = isTwo
            ? new THREE.Vector3(0, 0.72, -0.62)
            : new THREE.Vector3(0.36, 0.88, -0.38);
          handOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), av.group.rotation.y);
          heldObj.mesh.position.copy(av.group.position).add(handOffset);
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
      if (av.seated) {
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
        if (av.torso) av.torso.position.set(0, 0.64, 0);
        av.headGroup.position.set(0, 1.05, 0);
        av.leftLeg.position.set(-0.10, 0.38, 0);
        av.rightLeg.position.set(0.10, 0.38, 0);
        av.leftArm.position.set(-0.28, 0.82, 0);
        av.rightArm.position.set(0.28, 0.82, 0);
        if (av.labelSprite) av.labelSprite.position.y = 1.92;
        if (av.chatSprite) av.chatSprite.position.y = 2.28;
        if (av.walking) {
          av.walkPhase += dt * 10;
          av.leftLeg.rotation.x = Math.sin(av.walkPhase) * 0.55;
          av.rightLeg.rotation.x = -Math.sin(av.walkPhase) * 0.55;
          av.leftArm.rotation.x = twoH ? 1.05 : -Math.sin(av.walkPhase) * 0.45;
          av.rightArm.rotation.x = av.holding ? 1.05 : Math.sin(av.walkPhase) * 0.45;
        } else {
          av.leftLeg.rotation.x *= 0.8;
          av.rightLeg.rotation.x *= 0.8;
          av.leftArm.rotation.x = twoH ? 1.0 : av.leftArm.rotation.x * 0.8;
          av.rightArm.rotation.x = av.holding ? 1.0 : av.rightArm.rotation.x * 0.8;
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

  var lastPickupAt = 0;
  function handlePrimaryAction() {
    if (heldItem) {
      if (performance.now() - lastPickupAt < 140) return;
      // Se estiver perto da lousa com giz ou apagador, o clique desenha/apaga em vez de soltar
      if (hoveredBoardHit && getHeldBoardToolColor()) {
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
        recentlyDropped[heldItem.id] = performance.now() + 5000;
        if (heldItem.lidItem && heldItem.lidItem.isAttached) {
          recentlyDropped[heldItem.lidItem.id] = performance.now() + 5000;
        }
        heldItem = null;
        placementGhost.visible = false;
        if (callbacks.onHoldChange) callbacks.onHoldChange(null);
        notifyWorldAction();
        return;
      }
      if (hoveredSprayTarget && heldItem.mesh.userData.isAlcoholSpray) {
        var nowMs = performance.now();
        if (hoveredSprayTarget === 'hood') {
          hoodSanitizedUntil = nowMs + 90000;
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
        if (tgt.mode === 'draw' && tgt.item.mesh.userData.liquidCtrl) {
          var lq = tgt.item.mesh.userData.liquidCtrl;
          var take = Math.min(10 - syrCtrl.volMl, lq.volMl);
          if (take > 0) {
            if (tgt.item.setVolume) tgt.item.setVolume(lq.volMl - take);
            if (heldItem.setVolume) heldItem.setVolume(syrCtrl.volMl + take);
            if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
          }
        } else if (tgt.mode === 'inject' && syrCtrl.volMl > 0) {
          if (tgt.item.mesh.userData.liquidCtrl) {
            var lq2 = tgt.item.mesh.userData.liquidCtrl;
            var give = Math.min(syrCtrl.volMl, lq2.maxMl - lq2.volMl);
            if (give > 0) {
              if (tgt.item.setVolume) tgt.item.setVolume(lq2.volMl + give);
              if (heldItem.setVolume) heldItem.setVolume(syrCtrl.volMl - give);
              if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
            }
          } else {
            if (tgt.item.spawnCtrl) {
              var scItem = tgt.item.spawnCtrl;
              scItem.inoculated = true;
              var nowT = performance.now();
              var cleanEnv = (hoodAirData && hoodAirData.on) && (nowT < hoodSanitizedUntil || (tgt.item.sanitizedUntil && nowT < tgt.item.sanitizedUntil));
              if (!cleanEnv && Math.random() < 0.25) scItem.contaminated = true;
              scItem.updateVisual();
            }
            if (heldItem.setVolume) heldItem.setVolume(0);
            if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
          }
        }
        return;
      }
      if (placementValid && placementGhost) {
        heldItem.mesh.position.copy(placementGhost.position);
        heldItem.mesh.rotation.set(0, heldRotY, 0);
        heldItem.isMoved = true;
        if (heldItem.potItem && snapClosePot === heldItem.potItem) {
          heldItem.isAttached = true;
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
          recentlyDropped[attLid.id] = performance.now() + 1500;
        }
        recentlyDropped[heldItem.id] = performance.now() + 5000;
        if (heldItem.lidItem && heldItem.lidItem.isAttached) {
          recentlyDropped[heldItem.lidItem.id] = performance.now() + 5000;
        }
        if (heldItem.mesh.userData.updateBounds) heldItem.mesh.userData.updateBounds(heldItem);
        setHeldTwoHandedGhost(heldItem, false);
        heldItem = null;
        placementGhost.visible = false;
        if (callbacks.onHoldChange) callbacks.onHoldChange(null);
        notifyWorldAction();
      }
      return;
    }
    if (hoveredMushroom && hoveredMushroom.active) {
      hoveredMushroom.active = false;
      hoveredMushroom.group.visible = false;
      hoveredMushroom.respawnAt = performance.now() + 20000;
      queueWorldStateChange(hoveredMushroom.id, 0);
      if (callbacks.onHarvestMushroom) callbacks.onHarvestMushroom(hoveredMushroom.id);
      return;
    }
    if (hoveredDoorObj) {
      hoveredDoorObj.open = !hoveredDoorObj.open;
      queueWorldStateChange(hoveredDoorObj.id, hoveredDoorObj.open ? 1 : 0);
      return;
    }
    if (hoveredBlindObj) {
      hoveredBlindObj.open = !hoveredBlindObj.open;
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
      var maxStart = Math.max(0, rankingList.length - 8);
      if (hoveredRankBtn === 'up') rankingScroll = Math.max(0, rankingScroll - 1);
      else rankingScroll = Math.min(maxStart, rankingScroll + 1);
      drawRankingBoard();
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
      hoveredSwitch.light.intensity = hoveredSwitch.on ? 1.05 : 0;
      if (hoveredSwitch.gLight) hoveredSwitch.gLight.intensity = hoveredSwitch.on ? 0.7 : 0;
      hoveredSwitch.tubeMat.emissiveIntensity = hoveredSwitch.on ? 1.25 : 0.04;
      hoveredSwitch.ledMat.color.setHex(hoveredSwitch.on ? 0x22c55e : 0xef4444);
      hoveredSwitch.rocker.rotation.x = hoveredSwitch.on ? -0.22 : 0.22;
      queueWorldStateChange(hoveredSwitch.id, hoveredSwitch.on ? 1 : 0);
      return;
    }
    if (hoveredScreenBtn) {
      if (hoveredScreenBtn.action === 'prev' && callbacks.onScreenNav) callbacks.onScreenNav(-1);
      else if (hoveredScreenBtn.action === 'next' && callbacks.onScreenNav) callbacks.onScreenNav(1);
      else if (hoveredScreenBtn.action === 'lessons') {
        if (document.pointerLockElement) document.exitPointerLock();
        if (callbacks.onOpenLessons) callbacks.onOpenLessons();
      }
      return;
    }
    if (hoveredScreen) {
      if (document.pointerLockElement) document.exitPointerLock();
      if (callbacks.onOpenLessons) callbacks.onOpenLessons();
      return;
    }
    if (hoveredHoodSwitch) {
      hoveredHoodSwitch.on = !hoveredHoodSwitch.on;
      hoveredHoodSwitch.points.visible = hoveredHoodSwitch.on;
      hoveredHoodSwitch.hepaMat.emissiveIntensity = hoveredHoodSwitch.on ? 0.35 : 0.04;
      hoveredHoodSwitch.ledMat.color.setHex(hoveredHoodSwitch.on ? 0x22c55e : 0xef4444);
      queueWorldStateChange('hood_lab', hoveredHoodSwitch.on ? 1 : 0);
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
      hoveredBurnerSwitch.coilMat.emissiveIntensity = hoveredBurnerSwitch.on ? 1.15 : 0.04;
      queueWorldStateChange('burner_lab', hoveredBurnerSwitch.on ? 1 : 0);
      return;
    }
    if (hoveredPickable) {
      if (hoveredPickable.mesh.userData.isBlockedPickup && hoveredPickable.mesh.userData.isBlockedPickup(hoveredPickable)) {
        return;
      }
      if (hoveredPickable.potItem && hoveredPickable.isAttached) {
        hoveredPickable.isAttached = false;
      }
      for (var cpIdx = 0; cpIdx < cookerPots.length; cpIdx++) {
        var idxInPot = cookerPots[cpIdx].contents.indexOf(hoveredPickable);
        if (idxInPot !== -1) cookerPots[cpIdx].contents.splice(idxInPot, 1);
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
    var ids = Object.keys(remoteAvatars);
    for (var i = 0; i < ids.length; i++) {
      var av = remoteAvatars[ids[i]];
      if (!av || !av.targetPos) continue;
      if (Math.hypot(av.targetPos.x - seat.x, av.targetPos.z - seat.z) < 0.48 && Math.abs(av.targetPos.y - seat.y) < 0.85) {
        return true;
      }
    }
    return false;
  }

  function updateHoverRay(customNdc) {
    hoveredPickable = null;
    hoveredMushroom = null;
    hoveredDoorObj = null;
    hoveredBlindObj = null;
    hoveredScreen = false;
    hoveredScreenBtn = null;
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

    // Verifica proximidade dos teloes para exibir opcoes contextuais
    var nearScr = false;
    for (var s = 0; s < auditoriumScreenMeshes.length; s++) {
      if (playerPos.distanceTo(auditoriumScreenMeshes[s].position) < 18) {
        nearScr = true;
        break;
      }
    }
    if (nearScr !== nearScreenState) {
      nearScreenState = nearScr;
      if (callbacks.onNearScreen) callbacks.onNearScreen(nearScreenState);
    }

    var rayNdc = customNdc || (inFps ? new THREE.Vector2(0, 0) : pointerNdc);
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
        for (var ai = 0; ai < pickableItems.length; ai++) {
          var aCand = pickableItems[ai];
          if (aCand === heldItem || isHeldByRemote(aCand.id)) continue;
          var aHits = raycaster.intersectObject(aCand.mesh, true).filter(function (h) { return !h.object.userData.ignoreRay; });
          if (aHits.length > 0 && aHits[0].distance < 3.5) {
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
          if (cp.lidItem.isAttached) continue;
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
        for (var si = 0; si < pickableItems.length; si++) {
          var cand = pickableItems[si];
          if (cand === heldItem || isHeldByRemote(cand.id)) continue;
          var sHits = raycaster.intersectObject(cand.mesh, true).filter(function (h) { return !h.object.userData.ignoreRay; });
          if (sHits.length > 0 && sHits[0].distance < 3.5) {
            if (cand.mesh.userData.liquidCtrl) {
              var lc = cand.mesh.userData.liquidCtrl;
              if (sc.volMl < 10 && lc.volMl > 0) {
                hoveredSyringeTarget = { item: cand, mode: 'draw' };
                placementGhost.visible = false;
                if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('💉 Aspirar ' + Math.min(10 - sc.volMl, lc.volMl) + 'ml de ' + cand.label);
                return;
              } else if (sc.volMl > 0 && lc.volMl < lc.maxMl) {
                hoveredSyringeTarget = { item: cand, mode: 'inject' };
                placementGhost.visible = false;
                if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('💉 Despejar ' + sc.volMl + 'ml em ' + cand.label);
                return;
              }
            } else if (sc.volMl > 0 && (cand.id.indexOf('spawn_') === 0 || cand.id.indexOf('petri_') === 0)) {
              hoveredSyringeTarget = { item: cand, mode: 'inject' };
              placementGhost.visible = false;
              if (callbacks.onHoverPrompt) callbacks.onHoverPrompt('💉 Inocular ' + sc.volMl + 'ml em ' + cand.label);
              return;
            }
          }
        }
      }
      var pt = findPlacementTarget(rayNdc);
      placementValid = !isPlacementBlocked(pt);
      placementGhost.position.copy(pt);
      updatePlacementGhostVisual(heldItem, placementValid, heldRotY);
      placementGhost.visible = true;
      if (snapClosePot) {
        prompt = '🍲 Fechar tampa na Panela de Pressão';
      } else {
        prompt = placementValid ? 'Soltar: ' + heldItem.label : 'Local bloqueado';
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
        cinemaDirty = true;
        var cTarget = getCinemaHitTarget(hoveredCinemaUv);
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

    if (burnerSwitchMeshes.length) {
      var bHits = raycaster.intersectObjects(burnerSwitchMeshes, false);
      if (bHits.length > 0 && bHits[0].distance < 4.0) {
        hoveredBurnerSwitch = bHits[0].object.userData.burnerSwitch;
        prompt = hoveredBurnerSwitch.on ? '🔥 Desligar Fogareiro' : '🔥 Ligar Fogareiro';
        if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (stirSwitchMeshes.length) {
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

    if (screenActionMeshes.length) {
      var btnHits = raycaster.intersectObjects(screenActionMeshes, false);
      if (btnHits.length > 0 && btnHits[0].distance < 18) {
        var act = btnHits[0].object.userData.screenAction;
        hoveredScreenBtn = { action: act, mesh: btnHits[0].object };
        prompt = act === 'prev' ? '◀ Slide Anterior' : (act === 'next' ? '▶ Próximo Slide' : '📚 Abrir Módulos');
      }
    }

    if (!prompt && auditoriumScreenMeshes.length) {
      var scrHits = raycaster.intersectObjects(auditoriumScreenMeshes, false);
      if (scrHits.length > 0 && scrHits[0].distance < 22) {
        hoveredScreen = true;
        prompt = '📺 Abrir Módulos da Universidade';
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
    if (!prompt) {
      for (var m = 0; m < wildMushrooms.length; m++) {
        var wm = wildMushrooms[m];
        if (!wm.active) continue;
        var mdx = wm.group.position.x - refX, mdz = wm.group.position.z - refZ;
        if (inFps && (mdx * mdx + mdz * mdz > 24)) continue;
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
      for (var i = 0; i < pickableItems.length; i++) {
        var item = pickableItems[i];
        if (isHeldByRemote(item.id)) continue;
        var idx = item.mesh.position.x - refX, idz = item.mesh.position.z - refZ;
        if (inFps && (idx * idx + idz * idz > 26)) continue;
        var hits = raycaster.intersectObject(item.mesh, true).filter(function (h) { return !h.object.userData.ignoreRay; });
        if (hits.length > 0 && hits[0].distance < 4.5) {
          var dHit = hits[0].distance;
          if (item.mesh.userData.tableDims) {
            if (!(item.mesh.userData.isBlockedPickup && item.mesh.userData.isBlockedPickup(item)) && dHit < bestLargeDist) {
              bestLargeDist = dHit; bestLarge = item;
            }
          } else if (dHit < bestSmallDist) {
            bestSmallDist = dHit; bestSmall = item;
          }
        }
      }
      hoveredPickable = bestSmall || bestLarge;
      if (hoveredPickable) {
        var potStatus = null;
        for (var cpi = 0; cpi < cookerPots.length; cpi++) {
          if (cookerPots[cpi].potItem === hoveredPickable || cookerPots[cpi].lidItem === hoveredPickable) {
            potStatus = cookerPots[cpi]; break;
          }
        }
        if (hoveredPickable.potItem && hoveredPickable.isAttached) {
          if (potStatus && potStatus.progress >= 100) prompt = '🍲 Abrir tampa (✅ Esterilizado 100%)';
          else if (potStatus && potStatus.psi >= 14) prompt = '🔥 Esterilizando: ' + Math.round(potStatus.temp) + '°C • ' + Math.round(potStatus.psi) + ' PSI (' + Math.floor(potStatus.progress) + '%)';
          else if (potStatus && potStatus.temp > 32) prompt = '🔥 Aquecendo: ' + Math.round(potStatus.temp) + '°C • ' + potStatus.psi.toFixed(1) + ' PSI';
          else prompt = '🍲 Abrir tampa da Panela de Pressão';
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
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        window.triggerCampusJump();
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
      if (isTouchDevice() || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) || (performance.now() - lastTouchEndAt < 700)) {
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

    var touchLookId = null, lastTX = 0, lastTY = 0, touchMoved = false, touchDrawingBoard = false;
    function setNdcFromTouch(t) {
      var rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
    }

    renderer.domElement.addEventListener('touchstart', function (e) {
      if (e.target !== renderer.domElement) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (touchLookId === null) {
          touchLookId = t.identifier;
          lastTX = t.clientX; lastTY = t.clientY;
          touchMoved = false;
          touchDrawingBoard = false;
          if (inFps && !lobbyTourActive && heldItem && getHeldBoardToolColor() && chalkboardMeshes.length) {
            setNdcFromTouch(t);
            raycaster.setFromCamera(pointerNdc, camera);
            var bHits = raycaster.intersectObjects(chalkboardMeshes, false);
            if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
              touchDrawingBoard = true;
              isPrimaryDown = true;
              hoveredBoardHit = bHits[0];
              hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
            }
          }
        }
      }
    }, { passive: true });

    renderer.domElement.addEventListener('touchmove', function (e) {
      if (!inFps) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          var dx = t.clientX - lastTX, dy = t.clientY - lastTY;
          if (Math.hypot(dx, dy) > 6) touchMoved = true;
          if (touchDrawingBoard) {
            setNdcFromTouch(t);
            raycaster.setFromCamera(pointerNdc, camera);
            var bHits = raycaster.intersectObjects(chalkboardMeshes, false);
            if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
              hoveredBoardHit = bHits[0];
              hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
            }
          } else {
            playerYaw -= dx * 0.0045;
            playerPitch = Math.max(-1.35, Math.min(1.35, playerPitch - dy * 0.0045));
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
          if (touchDrawingBoard) {
            isPrimaryDown = false;
            flushCurrentStroke();
            touchDrawingBoard = false;
          } else if (!touchMoved && !lobbyTourActive) {
            var nowT = performance.now();
            if (nowT - lastTouchActionAt > 180) {
              lastTouchActionAt = nowT;
              setNdcFromTouch(t);
              updateHoverRay(pointerNdc);
              // Se tocou no vazio, tenta tambem na mira central (crosshair) para facilitar no celular
              var hasTarget = hoveredPickable || hoveredMushroom || hoveredDoorObj || hoveredBlindObj ||
                hoveredSeat || hoveredSwitch || hoveredHoodSwitch || hoveredStirSwitch ||
                hoveredSyringeTarget || hoveredScaleTare || hoveredBurnerSwitch || hoveredPotInsert ||
                hoveredSprayTarget || hoveredRankBtn || hoveredCinema || hoveredScreen || hoveredScreenBtn;
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
    renderer.domElement.addEventListener('touchend', resetTouchLook, { passive: true });
    renderer.domElement.addEventListener('touchcancel', resetTouchLook, { passive: true });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  var lastMobileHoverAt = 0;
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(0.05, clock.getDelta());
    var now = performance.now();

    updateClockTexture();

    wildMushrooms.forEach(function (wm) {
      if (!wm.active && now >= wm.respawnAt) {
        wm.active = true; wm.group.visible = true;
      } else if (wm.active) {
        wm.capMesh.rotation.y += dt * 0.5;
      }
    });

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

      var speedNow = Math.hypot(playerVelX, playerVelZ);
      isWalking = speedNow > 0.2;
      if (speedNow > 0.01) {
        playerPos.x += playerVelX * dt;
        playerPos.z += playerVelZ * dt;
        clampPosAgainstWalls(playerPos, PLAYER_RADIUS);
      }
      var groundY = getGroundHeight(playerPos.x, playerPos.z, playerPos.y);
      playerVelY -= 16.5 * dt;
      playerPos.y += playerVelY * dt;
      if (playerPos.y <= groundY) {
        playerPos.y = groundY;
        playerVelY = 0;
        onGround = true;
        lastGroundedAt = now;
      } else {
        onGround = false;
      }
      // Pulo responsivo: Coyote Time (150ms), Jump Buffer (150ms) e segurar Espaco/Pulo
      var wantsJump = (now <= jumpBufferUntil) || keys['Space'] || jumpHeld;
      if (wantsJump && (onGround || (now - lastGroundedAt < 150 && playerVelY <= 0))) {
        if (seatedSeat) seatedSeat = null;
        playerVelY = 6.2;
        onGround = false;
        lastGroundedAt = 0;
        jumpBufferUntil = 0;
      }
      var bobY = 0;
      if (onGround && speedNow > 0.25) {
        walkBobPhase += dt * (4.5 + speedNow * 1.4);
        bobY = Math.sin(walkBobPhase) * 0.028 * Math.min(1, speedNow / 3.8);
      }
      var eyeH = seatedSeat ? 1.50 : PLAYER_EYE;
      if (seatedSeat) {
        playerPos.set(seatedSeat.x, seatedSeat.y, seatedSeat.z);
        playerVelY = 0;
      }
      camera.position.set(playerPos.x, playerPos.y + eyeH + bobY, playerPos.z);
      camera.up.set(0, 1, 0);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = playerYaw;
      camera.rotation.x = playerPitch;
      camera.rotation.z = 0;

      // Braço(s) em 1a pessoa + item segurado na(s) mao(s)
      var isTwoHanded = !!(heldItem && heldItem.mesh.userData.twoHanded);
      if (fpsArmGroup) {
        fpsArmGroup.visible = true;
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
      if (fpsLeftArmGroup) {
        fpsLeftArmGroup.visible = isTwoHanded;
        if (isTwoHanded) {
          fpsLeftArmGroup.position.set(-0.27, -0.34 + Math.sin(armSwingPhase) * 0.014, -0.56);
          fpsLeftArmGroup.rotation.set(0.18, -0.12, -0.05);
        }
      }

      if (heldItem) {
        var reachZ = fpsArmGroup ? armReach * 0.16 : 0;
        var reachY = fpsArmGroup ? armReach * 0.06 : 0;
        var handLocal = isTwoHanded
          ? new THREE.Vector3(0, -0.48, -0.78)
          : new THREE.Vector3(0.30, -0.22 + reachY, -0.58 - reachZ);
        var handPos = handLocal.applyEuler(camera.rotation).add(camera.position);
        heldItem.mesh.position.copy(handPos);
        if (heldItem.id.indexOf('chalk_') === 0) {
          heldItem.mesh.rotation.order = 'YXZ';
          heldItem.mesh.rotation.set(playerPitch + 0.35, playerYaw, 0);
        } else if (heldItem.id.indexOf('board_eraser') === 0) {
          heldItem.mesh.rotation.order = 'YXZ';
          heldItem.mesh.rotation.set(playerPitch + Math.PI / 2, playerYaw, 0);
        } else {
          heldItem.mesh.rotation.set(0, heldRotY, 0);
        }
        if (heldItem.lidItem && heldItem.lidItem.isAttached) {
          var lidObj = heldItem.lidItem.mesh;
          lidObj.position.set(handPos.x, handPos.y + 0.36, handPos.z);
          lidObj.rotation.copy(heldItem.mesh.rotation);
        }
      }
      if (localAvatar) {
        localAvatar.group.visible = true;
        animateAvatarAura(localAvatar, clock.elapsedTime);
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
      if (!isTouchDevice() || isPrimaryDown || (heldItem && now - lastMobileHoverAt > 45) || (now - lastMobileHoverAt > 260)) {
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
          if (px0 >= scObj.surface.minX && px0 <= scObj.surface.maxX && pz0 >= scObj.surface.minZ && pz0 <= scObj.surface.maxZ && Math.abs(py0 - scObj.surface.topY) < 0.08) {
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
          cp.temp = Math.min(121, cp.temp + dt * 16);
          cp.psi = Math.max(0, ((cp.temp - 100) / 21) * 15);
          if (cp.psi >= 14.2) {
            cp.steamPoints.visible = true;
            var sa = cp.steamAttr.array;
            for (var si = 0; si < sa.length; si += 3) {
              sa[si + 1] += dt * 0.65;
              if (sa[si + 1] > 0.60) {
                sa[si] = (Math.random() - 0.5) * 0.04;
                sa[si + 1] = 0.17;
                sa[si + 2] = (Math.random() - 0.5) * 0.04;
              }
            }
            cp.steamAttr.needsUpdate = true;
            cp.weight.position.y = 0.13 + Math.sin(clock.elapsedTime * 35) * 0.004;
            cp.weightTop.position.y = 0.16 + Math.sin(clock.elapsedTime * 35) * 0.004;
            if (cp.progress < 100) {
              cp.progress = Math.min(100, cp.progress + dt * 8.5);
              if (cp.progress >= 100) {
                cp.sterilized = true;
                for (var ci = 0; ci < cp.contents.length; ci++) {
                  var cIt = cp.contents[ci];
                  if (cIt.spawnCtrl) {
                    cIt.spawnCtrl.sterilized = true;
                    cIt.spawnCtrl.updateVisual();
                  }
                }
              }
            }
          } else {
            cp.steamPoints.visible = false;
          }
        } else {
          cp.temp = Math.max(25, cp.temp - dt * 12);
          cp.psi = Math.max(0, cp.psi - dt * 6);
          cp.steamPoints.visible = false;
          cp.weight.position.y = 0.13;
          cp.weightTop.position.y = 0.16;
          if (!cp.lidItem.isAttached) cp.progress = 0;
        }
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
          sprayBursts.splice(sbi, 1);
        }
      }
    }
    drawCinemaVideoFrame(dt);
    updateDynamicEnvironment(dt);
    dropUnsupportedItems();
    stepMultiplayerAvatars(dt);
    renderer.render(scene, camera);
  }

  function getCinemaHitTarget(uv) {
    if (!cinemaPower) return { type: 'power_on' };
    var px = (uv ? uv.x : 0.5) * 768;
    var py = (uv ? uv.y : 0.5) * 384;
    if (px >= 624 && px <= 752 && py >= 10 && py <= 46) return { type: 'power_off' };
    if (cinemaLessonIdx === -1) {
      var count = cinemaLessons.length || 6;
      for (var i = 0; i < count; i++) {
        var col = i % 2;
        var row = Math.floor(i / 2);
        var x0 = col === 0 ? 20 : 394;
        var y0 = 70 + row * 100;
        if (px >= x0 && px <= x0 + 354 && py >= y0 && py <= y0 + 88) {
          return { type: 'lesson', idx: i };
        }
      }
      return { type: 'idle' };
    }
    if (px >= 16 && px <= 130 && py >= 10 && py <= 46) return { type: 'menu' };
    return { type: 'toggle_play' };
  }

  var cinemaFrameAccum = 0, cinemaDrawnOnce = false;
  function drawCinemaVideoFrame(dt) {
    if (!cinemaCtx || !cinemaTex) return;
    if (cinemaPower && cinemaLessonIdx >= 0 && cinemaPlaying) cinemaTime += dt;
    cinemaFrameAccum += dt;
    if (!cinemaDirty) {
      if (!cinemaPower || cinemaLessonIdx === -1 || !cinemaPlaying) return;
      if (cinemaFrameAccum < 0.09) return;
      if (camera && Math.hypot(camera.position.x - 48, camera.position.z + 12) > 65) return;
    }
    cinemaFrameAccum = 0;
    cinemaDirty = false;
    cinemaDrawnOnce = true;
    var ctx = cinemaCtx;
    var W = 768, H = 384;

    // 1) TELA DESLIGADA (preto / cinza escuro com LED standby)
    if (!cinemaPower) {
      ctx.fillStyle = '#090d14';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(W - 24, H - 20, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏻ TELA DESLIGADA — Clique para ligar', W / 2, H / 2 + 4);
      ctx.textAlign = 'left';
      cinemaTex.needsUpdate = true;
      return;
    }

    // Fundo ligado
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var hoverTarget = hoveredCinema ? getCinemaHitTarget(hoveredCinemaUv) : { type: 'none' };

    // Barra superior
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.fillRect(0, 0, W, 56);
    // Botao Desligar (sempre visivel no topo direito)
    ctx.fillStyle = hoverTarget.type === 'power_off' ? '#ef4444' : '#991b1b';
    ctx.fillRect(624, 10, 128, 36);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(624, 10, 128, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏻ DESLIGAR', 688, 33);
    ctx.textAlign = 'left';

    // 2) MENU DE MODULOS & AULAS
    if (cinemaLessonIdx === -1) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText('🎬 AUDITÓRIO MYCOCAMPUS — MÓDULOS & AULAS', 22, 35);

      var list = cinemaLessons.length ? cinemaLessons : [
        { title: '1. Fluxo Laminar & Técnica Asséptica', subtitle: 'Controle de contaminação no laboratório' }
      ];
      for (var i = 0; i < Math.min(list.length, 6); i++) {
        var mod = list[i];
        var col = i % 2;
        var row = Math.floor(i / 2);
        var bx = col === 0 ? 20 : 394;
        var by = 70 + row * 100;
        var isHov = hoverTarget.type === 'lesson' && hoverTarget.idx === i;
        ctx.fillStyle = isHov ? 'rgba(14, 116, 144, 0.72)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(bx, by, 354, 88);
        ctx.strokeStyle = isHov ? '#38bdf8' : '#334155';
        ctx.lineWidth = isHov ? 2.5 : 1.5;
        ctx.strokeRect(bx, by, 354, 88);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText('MÓDULO ' + (i + 1) + '  •  ▶ ASSISTIR', bx + 14, by + 22);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 15px system-ui, sans-serif';
        var tTxt = mod.title || ('Módulo ' + (i + 1));
        if (tTxt.length > 36) tTxt = tTxt.slice(0, 35) + '…';
        ctx.fillText(tTxt, bx + 14, by + 46);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px system-ui, sans-serif';
        var sTxt = mod.subtitle || '';
        if (sTxt.length > 46) sTxt = sTxt.slice(0, 45) + '…';
        ctx.fillText(sTxt, bx + 14, by + 68);
      }
      cinemaTex.needsUpdate = true;
      return;
    }

    // 3) REPRODUZINDO AULA SELECIONADA
    var lesson = cinemaLessons[cinemaLessonIdx] || { title: 'Aula', subtitle: '', bullets: [] };
    ctx.fillStyle = hoverTarget.type === 'menu' ? '#0284c7' : '#1e293b';
    ctx.fillRect(16, 10, 114, 36);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 10, 114, 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⬅️ MENU', 73, 33);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 17px system-ui, sans-serif';
    var headTitle = lesson.title || ('Módulo ' + (cinemaLessonIdx + 1));
    if (headTitle.length > 44) headTitle = headTitle.slice(0, 43) + '…';
    ctx.fillText(headTitle, 146, 35);

    // Conteudo da aula (esquerda)
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(lesson.subtitle || '', 26, 86);
    var bullets = lesson.bullets || [];
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '15px system-ui, sans-serif';
    for (var bIdx = 0; bIdx < Math.min(bullets.length, 4); bIdx++) {
      ctx.fillText('• ' + bullets[bIdx], 26, 128 + bIdx * 42);
    }

    // Animacao micelial / cogumelo (direita)
    var t = cinemaTime;
    var cxA = 615, cyA = 195;
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 2.5;
    for (var k = 0; k < 9; k++) {
      var ang = (k / 9) * Math.PI * 2 + t * 0.25;
      var r = 34 + ((Math.sin(t * 1.1 + k) + 1) * 0.5) * 68;
      ctx.beginPath();
      ctx.moveTo(cxA, cyA);
      ctx.quadraticCurveTo(cxA + Math.cos(ang + 0.4) * r * 0.6, cyA + Math.sin(ang + 0.4) * r * 0.6, cxA + Math.cos(ang) * r, cyA + Math.sin(ang) * r);
      ctx.stroke();
    }
    var grow = 0.6 + 0.4 * Math.sin(t * 0.9);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(cxA - 10, cyA - 36 * grow, 20, 40 * grow);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(cxA, cyA - 36 * grow, 30 * grow, Math.PI, 0);
    ctx.fill();

    // Barra inferior
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.fillRect(0, H - 44, W, 44);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(cinemaPlaying ? '⏸️ Clique na aula para pausar' : '▶️ PAUSADO (clique para continuar)', 22, H - 17);
    var prog = (t % 20) / 20;
    ctx.fillStyle = '#334155';
    ctx.fillRect(420, H - 25, 320, 8);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(420, H - 25, 320 * prog, 8);
    cinemaTex.needsUpdate = true;
  }

  function updateDynamicEnvironment(dt) {
    envTime += dt;
    // Ciclo completo de 40 min reais (20 min dia + 20 min noite), sincronizado com o Relogio da Torre
    var dayFrac = getVirtualDayFrac();
    var sunAngle = (dayFrac - 0.25) * Math.PI * 2;
    var sunY = Math.sin(sunAngle); // >0 dia (06h..18h), ~0 nascer/por do sol, <0 noite (18h..06h)
    var sunX = Math.cos(sunAngle);

    // 5 condicoes climaticas sincronizadas (ciclo de 7.5 min):
    // 0..110 Ensolarado, 110..200 Parcialmente nublado, 200..270 Nublado, 270..360 Chuva, 360..450 Neve
    var wCycle = (Date.now() / 1000) % 450;
    if (wCycle < 110) weatherMode = 'clear';
    else if (wCycle < 200) weatherMode = 'partly';
    else if (wCycle < 270) weatherMode = 'overcast';
    else if (wCycle < 360) weatherMode = 'rain';
    else weatherMode = 'snow';

    var targetSnow = weatherMode === 'snow' ? 1 : 0;
    snowMix += (targetSnow - snowMix) * Math.min(1, dt * 0.25);

    // Cores do ceu conforme Nascer do Sol, Dia, Por do Sol, Noite e Clima
    var skyDay = new THREE.Color(0x60a5fa);
    var skySunset = new THREE.Color(0xf97316);
    var skyNight = new THREE.Color(0x0b132b);
    var skyCol = skyDay.clone();
    if (sunY < 0.24 && sunY > -0.18) {
      var sT = 1 - Math.abs(sunY - 0.03) / 0.21;
      skyCol.lerp(skySunset, Math.max(0, Math.min(1, sT)));
    } else if (sunY <= -0.18) {
      skyCol.lerp(skyNight, Math.min(1, (-sunY - 0.18) / 0.25));
    }
    if (weatherMode === 'partly') skyCol.lerp(new THREE.Color(0x93c5fd), 0.2);
    if (weatherMode === 'overcast') skyCol.lerp(new THREE.Color(0x94a3b8), 0.45);
    if (weatherMode === 'rain') skyCol.lerp(new THREE.Color(0x475569), 0.65);
    if (weatherMode === 'snow') skyCol.lerp(new THREE.Color(0xcbd5e1), 0.5);
    scene.background.copy(skyCol);
    if (scene.fog) scene.fog.color.copy(skyCol);

    // Sol 3D, Halo, Lua 3D e Estrelas
    if (sunDisc && sunHalo) {
      sunDisc.position.set(sunX * 165, sunY * 145, -45);
      sunHalo.position.copy(sunDisc.position);
      var sunVis = sunY > -0.08 && weatherMode !== 'rain';
      sunDisc.visible = sunVis;
      sunHalo.visible = sunVis;
      var sunOrbCol = sunY < 0.22 ? 0xfb923c : 0xfef08a;
      sunDisc.material.color.setHex(sunOrbCol);
      sunHalo.material.color.setHex(sunOrbCol);
      sunHalo.material.opacity = weatherMode === 'overcast' ? 0.16 : 0.36;
    }
    if (moonDisc) {
      moonDisc.position.set(-sunX * 165, -sunY * 145, -45);
      moonDisc.visible = sunY < 0.08;
    }
    if (starPoints) {
      var starOp = Math.max(0, Math.min(0.9, (-sunY - 0.02) * 2.4)) * (weatherMode === 'rain' || weatherMode === 'overcast' ? 0.2 : 1);
      starPoints.visible = starOp > 0.02;
      starPoints.material.opacity = starOp;
    }

    if (envSun) {
      envSun.position.set(sunX * 75, Math.max(8, sunY * 75 + 12), 38);
      var sunDay = new THREE.Color(0xfffbeb);
      var sunSet = new THREE.Color(0xfb923c);
      var sunNight = new THREE.Color(0x93c5fd);
      if (sunY > 0.22) envSun.color.copy(sunDay);
      else if (sunY > -0.15) envSun.color.copy(sunSet);
      else envSun.color.copy(sunNight);
      var cloudDim = weatherMode === 'rain' ? 0.52 : (weatherMode === 'overcast' ? 0.72 : (weatherMode === 'partly' ? 0.88 : 1));
      envSun.intensity = Math.max(0.28, sunY * 0.95 + 0.48) * cloudDim;
    }
    if (envHemi) {
      envHemi.intensity = Math.max(0.35, sunY * 0.45 + 0.55);
    }

    // Nuvens dinamicas: quantidade, cor e velocidade conforme o clima
    var targetClouds = weatherMode === 'clear' ? 8 : (weatherMode === 'partly' ? 15 : (weatherMode === 'snow' ? 20 : 24));
    var cloudSpeed = weatherMode === 'rain' ? 2.6 : (weatherMode === 'overcast' ? 1.8 : 1.0);
    if (envCloudMat) {
      var cCol = weatherMode === 'rain' ? new THREE.Color(0x64748b) : (weatherMode === 'overcast' ? new THREE.Color(0xcbd5e1) : new THREE.Color(0xffffff));
      if (sunY < 0.22 && sunY > -0.15 && weatherMode !== 'rain') cCol.lerp(new THREE.Color(0xfdba74), 0.35);
      envCloudMat.color.copy(cCol);
    }
    for (var ci = 0; ci < envClouds.length; ci++) {
      envClouds[ci].visible = ci < targetClouds;
      envClouds[ci].position.x += dt * cloudSpeed * (0.8 + (ci % 3) * 0.25);
      if (envClouds[ci].position.x > 155) envClouds[ci].position.x = -155;
    }

    // Acumulo de neve no terreno e telhados (so atualiza quando snowMix muda)
    if (terrainSnowMat) {
      terrainSnowMat.emissive.setHex(0xe2e8f0);
      terrainSnowMat.emissiveIntensity = snowMix * 0.42;
    }
    if (Math.abs(snowMix - (updateDynamicEnvironment._lastSnowMix || -1)) > 0.005) {
      updateDynamicEnvironment._lastSnowMix = snowMix;
      var snowWhite = new THREE.Color(0xf1f5f9);
      for (var si = 0; si < snowableEntries.length; si++) {
        snowableEntries[si].mat.color.copy(snowableEntries[si].base).lerp(snowWhite, snowMix * 0.85);
      }
    }

    // Particulas de Chuva / Neve ao redor do jogador (bloqueadas por roofZones)
    if (weatherPoints && weatherPosAttr) {
      weatherPoints.visible = weatherMode === 'rain' || weatherMode === 'snow';
      if (weatherPoints.visible) {
        weatherPoints.material.color.setHex(weatherMode === 'rain' ? 0x93c5fd : 0xffffff);
        weatherPoints.material.size = weatherMode === 'rain' ? 0.16 : 0.24;
        var arr = weatherPosAttr.array;
        var fallSpeed = weatherMode === 'rain' ? 24 : 3.2;
        var drift = weatherMode === 'rain' ? 2.5 : Math.sin(envTime * 1.5) * 1.2;
        var cx = inFps ? playerPos.x : camera.position.x;
        var cz = inFps ? playerPos.z : camera.position.z;
        for (var p = 0; p < arr.length; p += 3) {
          arr[p] += drift * dt;
          arr[p + 1] -= fallSpeed * dt;
          var hitRoof = false;
          for (var rz = 0; rz < roofZones.length; rz++) {
            var zBox = roofZones[rz];
            if (arr[p] >= zBox.minX && arr[p] <= zBox.maxX && arr[p + 2] >= zBox.minZ && arr[p + 2] <= zBox.maxZ && arr[p + 1] <= zBox.roofY + 0.25) {
              hitRoof = true;
              break;
            }
          }
          if (hitRoof || arr[p + 1] < 0) {
            arr[p] = cx + (Math.random() - 0.5) * 55;
            arr[p + 1] = 24 + Math.random() * 8;
            arr[p + 2] = cz + (Math.random() - 0.5) * 55;
          }
        }
        weatherPosAttr.needsUpdate = true;
      }
    }

    // Animacao continua da agua da Fonte Central e Lagos (caustics + ondas de espuma + gotas de agua)
    if (texWater) {
      texWater.offset.x = (envTime * 0.045) % 1;
      texWater.offset.y = (Math.sin(envTime * 0.4) * 0.04) % 1;
    }
    var camFX = inFps ? playerPos.x : camera.position.x;
    var camFZ = (inFps ? playerPos.z : camera.position.z) - 2.0;
    if (camFX * camFX + camFZ * camFZ < 1225) {
      for (var ri = 0; ri < fountainRipples.length; ri++) {
        var rp = fountainRipples[ri];
        var rPhase = (envTime * 0.55 + rp.phase) % 1;
        var rScale = 0.28 + rPhase * 0.85;
        rp.mesh.scale.set(rScale, rScale, 1);
        rp.mesh.material.opacity = (1 - rPhase) * 0.52;
      }
      if (fountainDropsAttr) {
        var dArr = fountainDropsAttr.array;
        for (var di = 0; di < dArr.length; di += 3) {
          dArr[di + 1] -= dt * 1.65;
          var dxF = dArr[di];
          var dzF = dArr[di + 2] - 2.0;
          var rDist = Math.hypot(dxF, dzF) || 0.01;
          dArr[di] += (dxF / rDist) * dt * 0.52;
          dArr[di + 2] += (dzF / rDist) * dt * 0.52;
          if (dArr[di + 1] < 0.44) {
            var nAng = Math.random() * Math.PI * 2;
            var isTop = (di % 6 === 0);
            var startR = isTop ? (0.35 + Math.random() * 0.25) : (1.28 + Math.random() * 0.22);
            dArr[di] = Math.cos(nAng) * startR;
            dArr[di + 1] = isTop ? (1.85 + Math.random() * 0.35) : (1.15 + Math.random() * 0.28);
            dArr[di + 2] = 2.0 + Math.sin(nAng) * startR;
          }
        }
        fountainDropsAttr.needsUpdate = true;
      }
    }
  }

  // ---------------- Inicializacao & API Publica ----------------

  window.initCampus3D = function (containerId, cbs) {
    callbacks = Object.assign(callbacks, cbs || {});
    var container = document.getElementById(containerId);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x60a5fa);
    scene.fog = new THREE.FogExp2(0xbfdbfe, 0.0022);

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
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, touch ? 240 : 440);
    camera.position.set(-14, 16, 26);

    renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 0.9 : 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = touch ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 4;
    controls.maxDistance = 65;
    controls.target.set(0, 4.5, -14);

    var hemi = new THREE.HemisphereLight(0xe0f2fe, 0x3f6212, 0.85);
    scene.add(hemi);
    envHemi = hemi;
    var sun = new THREE.DirectionalLight(0xfffbeb, 1.15);
    sun.position.set(45, 65, 38);
    sun.castShadow = true;
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
    bindControls();
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
    if (heldItem) heldRotY += deltaRad;
  };

  window.setCampusJoystick = function (dx, dy) {
    joyX = dx; joyY = dy;
  };

  window.getCampusPlayerPose = function () {
    return {
      x: playerPos.x, y: playerPos.y, z: playerPos.z,
      yaw: playerYaw, pitch: playerPitch,
      holding_item: heldItem ? heldItem.id : '',
      walking: isWalking, seated: !!seatedSeat, in_fps: inFps
    };
  };

  window.consumeCampusMovedItems = function () {
    if (heldItem) {
      pendingMovedItems[heldItem.id] = {
        id: heldItem.id,
        x: heldItem.mesh.position.x,
        y: heldItem.mesh.position.y,
        z: heldItem.mesh.position.z,
        ry: heldRotY
      };
      if (heldItem.lidItem && heldItem.lidItem.isAttached) {
        var attLid = heldItem.lidItem;
        pendingMovedItems[attLid.id] = {
          id: attLid.id,
          x: heldItem.mesh.position.x,
          y: heldItem.mesh.position.y + 0.36,
          z: heldItem.mesh.position.z,
          ry: heldRotY
        };
      }
    }
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
        } else if (recentlyDropped[item.id] - now < 3200) {
          // Servidor ainda esta com posicao antiga: reenvia posicao local para nao voltar pro chao!
          pendingMovedItems[item.id] = {
            id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
          };
        }
        return;
      }
      var saved = objectsMap[item.id];
      if (saved) {
        item.mesh.position.set(saved.x, saved.y, saved.z);
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
        } else if (recentlyDropped[item.id] - now < 3200) {
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
        var suppY = getGroundHeight(saved.x, saved.z, saved.y);
        for (var i = 0; i < supportSurfaces.length; i++) {
          var s = supportSurfaces[i];
          if (saved.x >= s.minX && saved.x <= s.maxX && saved.z >= s.minZ && saved.z <= s.maxZ && saved.y >= s.topY - 0.15) {
            suppY = Math.max(suppY, s.topY);
          }
        }
        var finalY = Math.abs(saved.y - suppY) < 0.06 ? suppY : saved.y;
        item.mesh.position.set(saved.x, finalY, saved.z);
        item.mesh.rotation.y = saved.ry || 0;
        item.isMoved = true;
      } else if (item.isMoved) {
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
    pickableItems.forEach(function (item) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.potItem) item.isAttached = true;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      item.isMoved = false;
    });
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
        sw.light.intensity = sw.on ? 1.05 : 0;
        if (sw.gLight) sw.gLight.intensity = sw.on ? 0.7 : 0;
        sw.tubeMat.emissiveIntensity = sw.on ? 1.25 : 0.04;
        sw.ledMat.color.setHex(sw.on ? 0x22c55e : 0xef4444);
        sw.rocker.rotation.x = sw.on ? -0.22 : 0.22;
      }
    }

    // 4. Capela de Fluxo Laminar (hood_lab), Agitador Magnetico (stir_lab) e Fogareiro (burner_lab)
    if (hoodAirData && stateMap.hood_lab !== undefined) {
      if (pendingStateChanges.hood_lab === undefined && !(recentlyChangedState.hood_lab > now)) {
        var wantHoodOn = Number(stateMap.hood_lab) !== 0;
        if (hoodAirData.on !== wantHoodOn) {
          hoodAirData.on = wantHoodOn;
          hoodAirData.points.visible = hoodAirData.on;
          hoodAirData.hepaMat.emissiveIntensity = hoodAirData.on ? 0.35 : 0.04;
          hoodAirData.ledMat.color.setHex(hoodAirData.on ? 0x22c55e : 0xef4444);
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
          bn0.coilMat.emissiveIntensity = bn0.on ? 1.15 : 0.04;
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
    for (var mi = 0; mi < wildMushrooms.length; mi++) {
      var wm = wildMushrooms[mi];
      if (!wm.id || stateMap[wm.id] === undefined) continue;
      if (pendingStateChanges[wm.id] !== undefined || recentlyChangedState[wm.id] > now) continue;
      var remSec = parseInt(stateMap[wm.id], 10);
      if (remSec > 0 && wm.active) {
        wm.active = false;
        wm.group.visible = false;
        wm.respawnAt = now + remSec * 1000;
      } else if (remSec === 0 && !wm.active) {
        wm.active = true;
        wm.group.visible = true;
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
    if (!rankingCtx || !rankingTex) return;
    var ctx = rankingCtx;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 1024);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 14, 484, 90);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 RANKING DO CAMPUS', 256, 70);

    var perPage = 8;
    var maxStart = Math.max(0, rankingList.length - perPage);
    if (rankingScroll > maxStart) rankingScroll = maxStart;

    if (!rankingList.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText('Carregando ranking...', 256, 260);
    } else {
      for (var i = 0; i < perPage; i++) {
        var idx = rankingScroll + i;
        if (idx >= rankingList.length) break;
        var row = rankingList[idx];
        var y = 128 + i * 102;
        var isProf = row.role === 'professor' || row.role === 'admin';
        ctx.fillStyle = idx === 0 ? 'rgba(251, 191, 36, 0.18)' : 'rgba(30, 41, 59, 0.9)';
        ctx.fillRect(20, y, 472, 88);

        // Posicao (#1, #2, #3...)
        ctx.textAlign = 'left';
        ctx.fillStyle = idx === 0 ? '#fbbf24' : (idx === 1 ? '#e2e8f0' : (idx === 2 ? '#fb923c' : '#94a3b8'));
        ctx.font = 'bold 30px system-ui, sans-serif';
        var medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1)));
        ctx.fillText(medal, 32, y + 54);

        // Cargo + Nome
        ctx.fillStyle = isProf ? '#fbbf24' : '#34d399';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(isProf ? 'PROF.' : 'ALUNO', 105, y + 32);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px system-ui, sans-serif';
        var nm = String(row.display_name || row.name || 'Explorador').slice(0, 16);
        ctx.fillText(nm, 105, y + 66);

        // XP
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.fillText((row.xp || 0) + ' XP', 476, y + 54);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText((rankingScroll + 1) + '–' + Math.min(rankingList.length, rankingScroll + perPage) + ' de ' + rankingList.length, 256, 985);
    }
    rankingTex.needsUpdate = true;
  }

  window.rotateCampusHeldItem = function () {
    if (heldItem) heldRotY += Math.PI / 4;
  };

  window.setCampusMobilePrimary = function (down) {
    if (lobbyTourActive) return;
    isPrimaryDown = !!down;
    if (down) {
      pointerNdc.set(0, 0);
      updateHoverRay();
      handlePrimaryAction();
    } else {
      flushCurrentStroke();
    }
  };

  window.updateCampusRanking = function (list) {
    rankingList = Array.isArray(list) ? list : [];
    drawRankingBoard();
  };

  window.setCampusCinemaLessons = function (list) {
    cinemaLessons = Array.isArray(list) ? list : [];
    cinemaDirty = true;
  };

  window.updateCampusAuditoriumSlide = updateCampusAuditoriumSlide;
  window.updateCampusPlayers = updateCampusPlayers;
})();
