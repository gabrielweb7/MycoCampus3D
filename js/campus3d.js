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
  var pickableItems = [];    // { id, label, mesh, homePos, homeRy, radius, height, isMoved }
  var wildMushrooms = [];    // { id, group, capMesh, active, respawnAt }

  // Portas, telao e relogio
  var labDoorPivot = null;
  var labDoorOpen = false;
  var labDoorAngle = 0;
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
  var hoveredDoor = false;
  var hoveredScreen = false;
  var hoveredScreenBtn = null; // { action: 'prev'|'next'|'lessons', mesh }
  var nearScreenState = false;
  var placementGhost = null;
  var placementValid = false;
  var pendingMovedItems = {};
  var recentlyDropped = {};

  // Braco 1a pessoa, Corpo local & Lousas Interativas
  var fpsArmGroup = null;
  var fpsSleeveMat = null;
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
  var cinemaTime = 0;
  var hoveredCinema = false;
  var seatMeshes = [];
  var hoveredSeat = null;
  var seatedSeat = null;
  var lightSwitchMeshes = [];
  var hoveredSwitch = null;
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
  var texBrick, texPaving, texWood;

  var callbacks = {
    onHarvestMushroom: null,
    onOpenLessons: null,
    onScreenNav: null,
    onNearScreen: null,
    onHoldChange: null,
    onFpsChange: null,
    onHoverPrompt: null
  };

  function isTouchDevice() {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var hasTouch = (navigator.maxTouchPoints || 0) > 0 && window.innerWidth <= 1180;
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
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    var seat = makeBox(1.8, 0.08, 0.5, 0x92400e, { roughness: 0.7 });
    seat.position.y = 0.45;
    var back = makeBox(1.8, 0.42, 0.08, 0x92400e, { roughness: 0.7 });
    back.position.set(0, 0.72, -0.22);
    back.rotation.x = -0.15;
    var legL = makeBox(0.1, 0.45, 0.45, 0x1e293b);
    legL.position.set(-0.75, 0.225, 0);
    var legR = makeBox(0.1, 0.45, 0.45, 0x1e293b);
    legR.position.set(0.75, 0.225, 0);
    g.add(seat, back, legL, legR);
    scene.add(g);
    solidColliders.push({ minX: x - 0.85, maxX: x + 0.85, minZ: z - 0.5, maxZ: z + 0.5, minY: 0, maxY: 1.0 });
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

    // Fonte Central em (0, 0, 2) com Cogumelo no Topo!
    var fx = 0, fz = 2;
    var outerRim = new THREE.Mesh(
      new THREE.CylinderGeometry(2.85, 3.05, 0.48, 28),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.72 })
    );
    outerRim.position.set(fx, 0.24, fz);
    outerRim.castShadow = true; outerRim.receiveShadow = true;
    scene.add(outerRim);

    var waterRing = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 2.45, 0.42, 28),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.85 })
    );
    waterRing.position.set(fx, 0.27, fz);
    scene.add(waterRing);

    // Pedestal de pedra em 2 niveis
    var ped1 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 }));
    ped1.position.set(fx, 0.65, fz); ped1.castShadow = true;
    var bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.75, 0.32, 20), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 }));
    bowl.position.set(fx, 1.2, fz); bowl.castShadow = true;
    scene.add(ped1, bowl);

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

    createUmbrellaTable(-9.5, 2.5);
    createUmbrellaTable(9.5, 2.5);
    createUmbrellaTable(-8.5, -8.2);
    createUmbrellaTable(8.5, -8.2);

    // Luminarias
    createCampusLamp(-10.5, -10.5);
    createCampusLamp(10.5, -10.5);
    createCampusLamp(-10.5, 12.0);
    createCampusLamp(10.5, 12.0);
  }

  // ---------------- Modulo Geometrico de Predio Universitario (2 Andares) ----------------

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

    // Fachada de vidro do 2o andar (sempre solida para nao cair pela janela!)
    addSolidWall(frontX, zN, frontX, zS, yFloor2, h2 - 0.1, 0.14, glassMat);
    for (var m = -2; m <= 2; m++) {
      var mullion = makeBox(0.18, h2 - 0.4, 0.1, 0x0f172a);
      mullion.position.set(frontX, yFloor2 + h2 / 2, cz + m * (d / 5));
      scene.add(mullion);
    }

    // Iluminacao realista de sala de aula: 4 luminarias fluorescentes + PointLight + Interruptor clicavel na porta!
    var tubeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfffbeb, emissiveIntensity: 1.25, roughness: 0.25 });
    var fixMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.4 });
    [-2.0, 2.0].forEach(function (lx) {
      [-2.8, 2.8].forEach(function (lz) {
        var trayL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 1.65), fixMat);
        trayL.position.set(cx + lx, yFloor2 + h2 - 0.04, cz + lz);
        scene.add(trayL);
        [-0.1, 0.1].forEach(function (tx) {
          var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.5, 8), tubeMat);
          tube.rotation.x = Math.PI / 2;
          tube.position.set(cx + lx + tx, yFloor2 + h2 - 0.08, cz + lz);
          scene.add(tube);
        });
      });
    });
    var roomLight = new THREE.PointLight(0xfffbeb, 1.05, 19, 1.5);
    roomLight.position.set(cx, yFloor2 + h2 - 0.35, cz);
    scene.add(roomLight);
    var groundLight = new THREE.PointLight(0xfef3c7, 0.7, 16, 1.6);
    groundLight.position.set(cx, yFloor1 + h1 - 0.4, cz);
    scene.add(groundLight);

    // Interruptor 3D ao lado da porta do 2o andar
    var swGroup = new THREE.Group();
    swGroup.position.set(cx - dir * 1.45, yFloor2 + 1.32, zN + 0.17);
    var swPlate = makeBox(0.18, 0.28, 0.03, 0xf8fafc, { roughness: 0.3 });
    var swRocker = makeBox(0.08, 0.12, 0.04, 0xe2e8f0, { roughness: 0.4 });
    swRocker.position.z = 0.02;
    swRocker.rotation.x = -0.22;
    var swLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    var swLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.02), swLedMat);
    swLed.position.set(0, 0.09, 0.025);
    swGroup.add(swPlate, swRocker, swLed);
    var swData = { on: true, light: roomLight, gLight: groundLight, tubeMat: tubeMat, ledMat: swLedMat, rocker: swRocker };
    swPlate.userData.lightSwitch = swData;
    swRocker.userData.lightSwitch = swData;
    lightSwitchMeshes.push(swPlate, swRocker);
    scene.add(swGroup);
    for (var dtRow = -1; dtRow <= 1; dtRow++) {
      var deskZ = cz + dtRow * 3.0;
      var desk = makeBox(1.1, 0.72, 2.0, 0xd97706, { roughness: 0.65 });
      desk.position.set(cx + dir * 1.1, yFloor2 + 0.36, deskZ);
      scene.add(desk);
      solidColliders.push({
        minX: cx + dir * 1.1 - 0.6, maxX: cx + dir * 1.1 + 0.6,
        minZ: deskZ - 1.05, maxZ: deskZ + 1.05,
        minY: yFloor2, maxY: yFloor2 + 0.9
      });

      // 2 Cadeiras ergonomicas clicaveis atras de cada mesa (voltadas para a lousa)
      [-0.5, 0.5].forEach(function (chDz) {
        var chairX = cx + dir * 2.1;
        var chairZ = deskZ + chDz;
        var cg = new THREE.Group();
        cg.position.set(chairX, yFloor2, chairZ);
        var legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.35 });
        var padMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 });
        [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (lp) {
          var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 8), legMat);
          leg.position.set(lp[0], 0.22, lp[1]);
          cg.add(leg);
        });
        var seatPad = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.46), padMat);
        seatPad.position.set(0, 0.45, 0);
        seatPad.castShadow = true;
        var backPad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.44), padMat);
        backPad.position.set(dir * 0.21, 0.72, 0);
        backPad.castShadow = true;
        cg.add(seatPad, backPad);
        var sitYaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        seatPad.userData.seatInfo = { x: chairX, y: yFloor2 + 0.08, z: chairZ, yaw: sitYaw };
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
      minX: trayX - 0.22, maxX: trayX + 0.22,
      minZ: cz - 1.65, maxZ: cz + 1.65,
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

    // Fachada do 1o andar (terreo)
    if (opts.hasDoor) {
      addSolidWall(frontX, zN, frontX, cz - 0.95, yFloor1, h1, 0.16, glassMat);
      addSolidWall(frontX, cz + 0.95, frontX, zS, yFloor1, h1, 0.16, glassMat);
      labDoorPivot = new THREE.Group();
      labDoorPivot.position.set(frontX, yFloor1, cz - 0.95);
      var doorGlass = makeBox(0.1, 2.75, 1.85, 0x0f766e, { transparent: true, opacity: 0.65, roughness: 0.2 });
      doorGlass.position.set(0, 1.38, 0.92);
      var doorHandle = makeBox(0.18, 0.22, 0.08, 0xfbbf24, { metalness: 0.75 });
      doorHandle.position.set(dir * 0.08, 1.1, 1.6);
      labDoorPivot.add(doorGlass, doorHandle);
      scene.add(labDoorPivot);
    } else if (!opts.openFront) {
      // Salas com entrada central aberta de 2.4m no terreo para o jogador entrar!
      addSolidWall(frontX, zN, frontX, cz - 1.2, yFloor1, h1, 0.16, glassMat);
      addSolidWall(frontX, cz + 1.2, frontX, zS, yFloor1, h1, 0.16, glassMat);
    }
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
      stringer.rotation.x = -slopeAng;
      stringer.castShadow = true;
      var glassPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.88, slopeLen), stairGlassMat);
      glassPanel.position.set(rx, yTop / 2 + 0.52, -15.0);
      glassPanel.rotation.x = -slopeAng;
      var handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, slopeLen + 0.2, 12), railMetalMat);
      handrail.position.set(rx, yTop / 2 + 1.0, -15.0);
      handrail.rotation.x = Math.PI / 2 - slopeAng;
      scene.add(stringer, glassPanel, handrail);

      for (var pIdx = 0; pIdx <= 3; pIdx++) {
        var frac = pIdx / 3;
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.02, 0.08), steelMat);
        post.position.set(rx, frac * yTop + 0.51, -11.5 - frac * 7.0);
        scene.add(post);
      }
      solidColliders.push({ minX: rx - 0.22, maxX: rx + 0.22, minZ: -18.55, maxZ: -11.45, minY: 0, maxY: 5.0 });
    });

    // Passarela / Ponte Elevada no nivel exato y=3.80 dividida em Esquerda e Direita (sem sobrepor o ultimo degrau!)
    addWalkableSlab(-12.6, yTop, -15.65, 16.8, 0.34, 5.7, 0x475569, { roughness: 0.6 });
    addWalkableSlab(12.6, yTop, -15.65, 16.8, 0.34, 5.7, 0x475569, { roughness: 0.6 });
    // Patamar superior alinhado exatamente atras de z=-18.5 (zero z-fighting!)
    addWalkableSlab(0, yTop, -19.05, 8.6, 0.34, 1.1, 0x475569, { roughness: 0.6 });

    // Pilares estruturais sustentando a passarela
    [-12.5, -6.5, 6.5, 12.5].forEach(function (px) {
      [-13.2, -18.0].forEach(function (pz) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, yTop - 0.34, 14), steelMat);
        col.position.set(px, (yTop - 0.34) / 2, pz);
        col.castShadow = true; col.receiveShadow = true;
        scene.add(col);
      });
    });

    // Guarda-corpo de vidro + corrimao metalico na borda sul da passarela
    [-1, 1].forEach(function (side) {
      addSolidWall(side * 4.2, -12.85, side * 14.0, -12.85, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
      var rail1 = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.06, 0.1), railMetalMat);
      rail1.position.set(side * 9.1, yTop + 1.03, -12.85);
      scene.add(rail1);
      addSolidWall(side * 20.6, -12.85, side * 24.0, -12.85, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    });

    // Pontes ligando Bloco Norte <-> Bloco Sul no 2o andar (x = +-19, z = -1.2 .. 2.2, y = 3.80)
    [-19, 19].forEach(function (ax) {
      addWalkableSlab(ax, yTop, 0.5, 4.4, 0.28, 3.6, 0x475569, { roughness: 0.6 });
      addSolidWall(ax - 2.1, -1.2, ax - 2.1, 2.2, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
      addSolidWall(ax + 2.1, -1.2, ax + 2.1, 2.2, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Terraco Norte (y = 3.80, x: -24..24, z: -29.5 .. -42.0) — separado da passarela por um Lago Norte organico
    addWalkableSlab(0, yTop, -35.75, 48.0, 3.80, 12.5, 0x94a3b8, { roughness: 0.8 });

    // Ponte Norte sobre o lago ligando a Passarela (-18.5) ate o Terraco da Torre do Relogio (-29.5)
    addWalkableSlab(0, yTop, -24.0, 5.6, 0.36, 11.2, 0x64748b, { roughness: 0.65 });
    [-2.75, 2.75].forEach(function (bx) {
      addSolidWall(bx, -29.5, bx, -18.5, yTop, 1.05, 0.12, 0xbae6fd, { transparent: true, opacity: 0.45 });
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
      var rLight = new THREE.PointLight(0xfffbeb, 0.85, 14, 1.5);
      rLight.position.set(ax, baseY + 5.4, -37.0);
      var rDesk = makeBox(2.6, 0.78, 1.1, 0x92400e, { roughness: 0.65 });
      rDesk.position.set(ax, baseY + 0.39, -38.2);
      scene.add(doorHeader, rLight, rDesk);
      solidColliders.push({ minX: ax - 1.35, maxX: ax + 1.35, minZ: -38.8, maxZ: -37.6, minY: baseY, maxY: baseY + 1.0 });
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

    // Telao Externo na parede do Bloco Oeste (como na foto de referencia!)
    auditoriumCanvas = document.createElement('canvas');
    auditoriumCanvas.width = 1024;
    auditoriumCanvas.height = 576;
    auditoriumCtx = auditoriumCanvas.getContext('2d');
    auditoriumTex = new THREE.CanvasTexture(auditoriumCanvas);

    var frameWest = makeBox(0.24, 2.6, 4.2, 0x0f172a, { roughness: 0.4 });
    frameWest.position.set(-13.75, 4.8, 0.5);
    scene.add(frameWest);
    var screenWest = new THREE.Mesh(
      new THREE.PlaneGeometry(3.9, 2.25),
      new THREE.MeshBasicMaterial({ map: auditoriumTex })
    );
    screenWest.position.set(-13.6, 4.8, 0.5);
    screenWest.rotation.y = Math.PI / 2;
    scene.add(screenWest);
    auditoriumScreenMeshes.push(screenWest);

    // Botoes 3D diegeticos saindo abaixo de cada telao (◀, 📚 Aulas, ▶)
    function addScreenButtons3D(cx, cy, cz, rotY) {
      var group = new THREE.Group();
      group.position.set(cx, cy, cz);
      group.rotation.y = rotY;
      var defs = [
        { x: -1.35, label: '◀', action: 'prev', color: '#0f172a', accent: '#fbbf24' },
        { x: 0.0,   label: '📚 AULAS', action: 'lessons', color: '#064e3b', accent: '#34d399' },
        { x: 1.35,  label: '▶', action: 'next', color: '#0f172a', accent: '#fbbf24' }
      ];
      defs.forEach(function (d) {
        var c = document.createElement('canvas');
        c.width = 256; c.height = 96;
        var ctx = c.getContext('2d');
        ctx.fillStyle = d.color;
        roundRectPath(ctx, 6, 6, 244, 84, 20);
        ctx.fill();
        ctx.strokeStyle = d.accent;
        ctx.lineWidth = 6;
        roundRectPath(ctx, 6, 6, 244, 84, 20);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 38px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.label, 128, 48);

        var tex = new THREE.CanvasTexture(c);
        var btn = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 0.44, 0.08),
          new THREE.MeshBasicMaterial({ map: tex })
        );
        btn.position.set(d.x, 0, 0);
        btn.userData.screenAction = d.action;
        group.add(btn);
        screenActionMeshes.push(btn);
      });
      scene.add(group);
    }

    addScreenButtons3D(-13.52, 3.25, 0.5, Math.PI / 2);

    updateCampusAuditoriumSlide(
      0,
      'Fluxo Laminar & Técnica Asséptica',
      'Módulo 1 • Universidade MycoCampus3D',
      ['1. Fluxo laminar unidirecional (HEPA 0.3 µm)', '2. Álcool 70% nas mãos e bancada', '3. Flambagem de bisturi fora do fluxo'],
      'Sistema'
    );
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
    scene.add(mesh);
    pickableItems.push({
      id: id, label: label, mesh: mesh,
      homePos: new THREE.Vector3(x, y, z), homeRy: ry || 0,
      radius: radius || 0.25, height: height || 0.4, isMoved: false, movedAt: 0
    });
  }

  function buildCampusWingsAndEquipment() {
    // ALA OESTE (Esquerda) — 2 blocos de 2 andares (x: -24..-14)
    // Bloco Oeste-Norte (z: -12.8..-1.2): LABORATORIO DE FLUXO LAMINAR & AUTOCLAVE + 2o andar acessivel
    buildCampusBuildingWing({ cx: -19, cz: -7, width: 10, depth: 11.6, faceDir: 1, hasDoor: true, style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 0 });
    // Bloco Oeste-Sul (z: 2.2..13.8): Salas de Aula (1o e 2o andares acessiveis)
    buildCampusBuildingWing({ cx: -19, cz: 8, width: 10, depth: 11.6, faceDir: 1, hasDoor: false, style: 'brick', connectNorth2F: true, boardIndex: 1 });

    createBanner(-13.85, 5.1, -11.6, Math.PI / 2, '#6d28d9', '🔬');
    createBanner(-13.85, 5.1, -2.4, Math.PI / 2, '#1d4ed8', '🧬');
    createBanner(-13.85, 5.1, 12.6, Math.PI / 2, '#991b1b', '📚');

    // Equipamentos do Lab dentro do Bloco Oeste-Norte (x: -24..-14, z: -12.8..-1.2)
    var hoodBase = makeBox(1.5, 0.9, 2.4, 0xf1f5f9, { roughness: 0.4 });
    hoodBase.position.set(-22.2, 0.14 + 0.45, -9.8);
    scene.add(hoodBase);
    var hoodTop = makeBox(1.4, 1.15, 2.3, 0x94a3b8, { transparent: true, opacity: 0.35 });
    hoodTop.position.set(-22.2, 0.14 + 1.48, -9.8);
    scene.add(hoodTop);
    var hepa = makeBox(0.15, 0.95, 2.1, 0xecfeff, { emissive: 0x38bdf8, emissiveIntensity: 0.5 });
    hepa.position.set(-22.85, 0.14 + 1.42, -9.8);
    scene.add(hepa);
    solidColliders.push({ minX: -23.0, maxX: -21.4, minZ: -11.1, maxZ: -8.5, minY: 0.14, maxY: 2.3 });
    supportSurfaces.push({ minX: -22.9, maxX: -21.5, minZ: -10.9, maxZ: -8.7, topY: 1.04 });

    var autoBench = makeBox(1.5, 0.85, 2.2, 0x475569, { roughness: 0.5 });
    autoBench.position.set(-22.2, 0.14 + 0.425, -4.4);
    scene.add(autoBench);
    var autoclave = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.95, 16),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.78, roughness: 0.25 })
    );
    autoclave.position.set(-22.3, 0.14 + 0.85 + 0.47, -4.1);
    autoclave.castShadow = true;
    scene.add(autoclave);
    solidColliders.push({ minX: -23.0, maxX: -21.4, minZ: -5.6, maxZ: -3.2, minY: 0.14, maxY: 2.1 });
    supportSurfaces.push({ minX: -22.9, maxX: -21.5, minZ: -5.4, maxZ: -4.5, topY: 0.99 });

    var shelfLow = makeBox(2.2, 0.08, 1.0, 0x92400e);
    shelfLow.position.set(-16.8, 0.14 + 0.75, -4.2);
    scene.add(shelfLow);
    supportSurfaces.push({ minX: -17.85, maxX: -15.75, minZ: -4.68, maxZ: -3.72, topY: 0.93 });
    solidColliders.push({ minX: -17.9, maxX: -15.7, minZ: -4.7, maxZ: -3.7, minY: 0.14, maxY: 1.8 });

    // Itens pegaveis do Lab
    var petri1 = new THREE.Group();
    var pDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.2 }));
    pDisk.position.y = 0.03; petri1.add(pDisk);
    registerPickable('petri_clean', 'Placa de Petri (Micélio Saudável)', petri1, -22.0, 1.04, -10.2, 0, 0.22, 0.1);

    var petri2 = new THREE.Group();
    var pContam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.35 }));
    pContam.position.y = 0.03; petri2.add(pContam);
    registerPickable('petri_contam', 'Placa Contaminada (Tricoderma)', petri2, -22.0, 1.04, -9.2, 0, 0.22, 0.1);

    var spawnJar = new THREE.Group();
    var jGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 14), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.3 }));
    jGlass.position.y = 0.17;
    var jLid = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
    jLid.position.y = 0.36;
    spawnJar.add(jGlass, jLid);
    registerPickable('spawn_jar', 'Pote de Spawn de Grãos', spawnJar, -22.0, 0.99, -4.95, 0, 0.22, 0.4);

    var lcFlask = new THREE.Group();
    var lcBody = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 14), new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 }));
    lcBody.position.y = 0.16; lcFlask.add(lcBody);
    registerPickable('liquid_culture', 'Cultura Líquida (CL)', lcFlask, -16.8, 0.93, -4.2, 0, 0.2, 0.35);

    // ALA LESTE (Direita) — 2 blocos de 2 andares (x: 14..24)
    // Bloco Leste-Norte (z: -12.8..-1.2): SUBSTRATOS & PASTEURIZACAO + 2o andar acessivel
    buildCampusBuildingWing({ cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, openFront: true, style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 2 });
    // Bloco Leste-Sul (z: 2.2..13.8): ESTUFA DE FRUTIFICACAO + 2o andar acessivel
    buildCampusBuildingWing({ cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, openFront: true, style: 'wood', connectNorth2F: true, boardIndex: 3 });

    createBanner(13.85, 5.1, -11.6, -Math.PI / 2, '#0284c7', '🧪');
    createBanner(13.85, 5.1, 3.6, -Math.PI / 2, '#15803d', '🍄');

    // Equipamentos de Substratos (Leste-Norte)
    var drum = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.35, 18), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.5, roughness: 0.35 }));
    drum.position.set(21.5, 0.14 + 0.675, -10.0); drum.castShadow = true;
    scene.add(drum);
    solidColliders.push({ minX: 20.7, maxX: 22.3, minZ: -10.8, maxZ: -9.2, minY: 0.14, maxY: 1.6 });

    var benchSub = makeBox(1.5, 0.82, 3.2, 0x92400e, { roughness: 0.75 });
    benchSub.position.set(21.2, 0.14 + 0.41, -5.2);
    scene.add(benchSub);
    solidColliders.push({ minX: 20.4, maxX: 22.0, minZ: -6.85, maxZ: -3.55, minY: 0.14, maxY: 1.1 });
    supportSurfaces.push({ minX: 20.5, maxX: 21.9, minZ: -6.75, maxZ: -3.65, topY: 0.96 });

    var subBag = new THREE.Group();
    var bagMesh = makeBox(0.38, 0.44, 0.28, 0xd6d3d1, { roughness: 0.85 });
    bagMesh.position.y = 0.22; subBag.add(bagMesh);
    registerPickable('substrate_bag', 'Saco de Substrato Pasteurizado', subBag, 21.2, 0.96, -5.2, 0, 0.28, 0.46);

    // Equipamentos da Estufa (Leste-Sul)
    var rack = makeBox(1.6, 0.72, 4.0, 0x1e293b);
    rack.position.set(21.0, 0.14 + 0.36, 8.0);
    scene.add(rack);
    var ledBar = makeBox(0.28, 0.08, 3.6, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.9 });
    ledBar.position.set(21.0, 2.55, 8.0);
    scene.add(ledBar);
    solidColliders.push({ minX: 20.15, maxX: 21.85, minZ: 5.95, maxZ: 10.05, minY: 0.14, maxY: 1.0 });
    supportSurfaces.push({ minX: 20.25, maxX: 21.75, minZ: 6.05, maxZ: 9.95, topY: 0.86 });

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

    // Calcada em bloquetes ligando a Praca Central ao Lago em 8 e ao Setor Leste
    var walkS = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
    walkS.rotation.x = -Math.PI / 2; walkS.position.set(0, 0.022, 26); walkS.receiveShadow = true;
    var walkE = new THREE.Mesh(new THREE.PlaneGeometry(36, 10), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
    walkE.rotation.x = -Math.PI / 2; walkE.position.set(38, 0.022, 12); walkE.receiveShadow = true;
    scene.add(walkS, walkE);

    // 2. Lago Duplo (formato de 8) no Sul + Ponte de Madeira caminhavel
    var lakeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.86 });
    [-6.5, 6.5].forEach(function (lx) {
      var lobe = new THREE.Mesh(new THREE.CircleGeometry(7.6, 28), lakeMat);
      lobe.rotation.x = -Math.PI / 2;
      lobe.position.set(lx, 0.04, 28.0);
      scene.add(lobe);
      var rim = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.2, 28), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 }));
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(lx, 0.03, 28.0);
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
    cinemaCanvas.width = 512; cinemaCanvas.height = 256;
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

    // 3 fileiras de poltronas do Auditorio
    [-14.5, -12.2, -9.9].forEach(function (rz, rIdx) {
      var rowBench = makeBox(11.0, 0.45, 0.85, 0x991b1b, { roughness: 0.7 });
      rowBench.position.set(48, 0.38 + rIdx * 0.18, rz);
      var rowBack = makeBox(11.0, 0.55, 0.16, 0x7f1d1d, { roughness: 0.7 });
      rowBack.position.set(48, 0.78 + rIdx * 0.18, rz + 0.36);
      scene.add(rowBench, rowBack);
      solidColliders.push({ minX: 42.4, maxX: 53.6, minZ: rz - 0.45, maxZ: rz + 0.45, minY: 0, maxY: 1.4 });
    });

    createUmbrellaTable(41, -1.5);
    createUmbrellaTable(48, 0.5);
    createUmbrellaTable(55, -1.5);

    // 4b. 2a Praca Circular Leste com Fonte (x: 42, z: 12)
    var plazaE = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.04, 28), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
    plazaE.position.set(42, 0.02, 12);
    var rimE = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.42, 24), new THREE.MeshStandardMaterial({ color: 0xcbd5e1 }));
    rimE.position.set(42, 0.21, 12);
    var waterE = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.44, 24), lakeMat);
    waterE.position.set(42, 0.23, 12);
    scene.add(plazaE, rimE, waterE);
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
    if (!labDoorOpen && pos.y < 3.4 && pos.z > -8.0 && pos.z < -6.0 && Math.abs(pos.x - (-14.0)) < radius + 0.18) {
      pos.x = pos.x >= -14.0 ? -14.0 + radius + 0.18 : -14.0 - radius - 0.18;
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
  var placementHoloMat = null;
  var placementGhostItemId = null;

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

    placementHoloMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.44, depthWrite: false });
    placementHoloWrap = new THREE.Group();
    placementGhost.add(placementHoloWrap);

    placementGhost.visible = false;
    scene.add(placementGhost);
  }

  function updatePlacementGhostVisual(item, isValid, rotY) {
    if (!placementGhost || !item) return;
    if (placementGhostItemId !== item.id) {
      while (placementHoloWrap.children.length > 0) {
        placementHoloWrap.remove(placementHoloWrap.children[0]);
      }
      var clone = item.mesh.clone(true);
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.visible = true;
      clone.traverse(function (ch) {
        if (ch.isMesh) {
          ch.material = placementHoloMat;
          ch.castShadow = false;
          ch.receiveShadow = false;
        }
      });
      placementHoloWrap.add(clone);
      placementGhostItemId = item.id;
    }
    var col = isValid ? 0x10b981 : 0xef4444;
    placementRing.material.color.setHex(col);
    placementDot.material.color.setHex(col);
    placementHoloMat.color.setHex(col);
    placementHoloWrap.rotation.y = rotY;
    var pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.04;
    placementRing.scale.set(pulse, pulse, 1);
  }

  function findPlacementTarget() {
    raycaster.setFromCamera(inFps ? new THREE.Vector2(0, 0) : pointerNdc, camera);
    var dir = raycaster.ray.direction;
    var origin = raycaster.ray.origin;
    var bestPt = null;
    var bestT = Infinity;

    // 1. Intersecao exata Raio x Plano para mesas, bancadas e bandejas de lousa
    if (dir.y < -0.02) {
      for (var i = 0; i < supportSurfaces.length; i++) {
        var s = supportSurfaces[i];
        var tPlane = (s.topY - origin.y) / dir.y;
        if (tPlane >= 0.35 && tPlane <= 5.0 && tPlane < bestT) {
          var hx = origin.x + dir.x * tPlane;
          var hz = origin.z + dir.z * tPlane;
          if (hx >= s.minX && hx <= s.maxX && hz >= s.minZ && hz <= s.maxZ) {
            bestT = tPlane;
            bestPt = new THREE.Vector3(hx, s.topY, hz);
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

  function dropUnsupportedItems() {
    var now = performance.now();
    pickableItems.forEach(function (item) {
      if (heldItem === item || isHeldByRemote(item.id)) {
        item.movedAt = now;
        return;
      }
      var distHome = item.mesh.position.distanceTo(item.homePos);
      if (distHome > 0.35) {
        if (!item.movedAt) item.movedAt = now;
        if (now - item.movedAt > 45000 || item.mesh.position.y < -5) {
          item.mesh.position.copy(item.homePos);
          item.mesh.rotation.y = item.homeRy;
          item.isMoved = false;
          item.movedAt = 0;
          pendingMovedItems[item.id] = {
            id: item.id, x: item.homePos.x, y: item.homePos.y, z: item.homePos.z, ry: item.homeRy
          };
          return;
        }
      } else {
        item.movedAt = 0;
      }
      var supportedY = getGroundHeight(item.mesh.position.x, item.mesh.position.z, item.mesh.position.y);
      for (var i = 0; i < supportSurfaces.length; i++) {
        var s = supportSurfaces[i];
        if (item.mesh.position.x >= s.minX && item.mesh.position.x <= s.maxX &&
            item.mesh.position.z >= s.minZ && item.mesh.position.z <= s.maxZ &&
            item.mesh.position.y >= s.topY - 0.15) {
          supportedY = Math.max(supportedY, s.topY);
        }
      }
      if (item.mesh.position.y > supportedY + 0.02) {
        item.mesh.position.y = Math.max(supportedY, item.mesh.position.y - 0.18);
      }
    });
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
      if (remoteAvatars[ids[i]].holding === itemId) return true;
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
    var bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
    var hatMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(data.hat_color || '#d9534f'), roughness: 0.45 });

    var leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), bodyMat);
    leftLeg.position.set(-0.1, 0.19, 0); leftLeg.castShadow = true;
    var rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), bodyMat);
    rightLeg.position.set(0.1, 0.19, 0); rightLeg.castShadow = true;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26), bodyMat);
    torso.position.set(0, 0.64, 0); torso.castShadow = true;
    var leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), bodyMat);
    leftArm.position.set(-0.29, 0.66, 0); leftArm.castShadow = true;
    var rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.44, 0.13), bodyMat);
    rightArm.position.set(0.29, 0.66, 0); rightArm.castShadow = true;
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
    if (isProf) {
      var crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.035, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.45, metalness: 0.8 })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.set(0, 0.59, 0);
      headGroup.add(crown);
    }
    g.add(headGroup);

    var labelSprite = data.isLocal ? null : makeTextSprite((isProf ? '👨‍🏫 ' : '') + (data.name || 'Aluno'), isProf ? '#fbbf24' : '#ffffff');
    if (labelSprite) {
      labelSprite.position.set(0, 1.9, 0);
      g.add(labelSprite);
    }
    var chatSprite = data.isLocal ? null : makeTextSprite('', '#34d399');
    if (chatSprite) {
      chatSprite.position.set(0, 2.3, 0);
      chatSprite.visible = false;
      g.add(chatSprite);
    }

    scene.add(g);
    return {
      group: g, leftLeg: leftLeg, rightLeg: rightLeg, leftArm: leftArm, rightArm: rightArm, headGroup: headGroup,
      bodyMat: bodyMat, hatMat: hatMat,
      faceCtx: faceCtx, faceTex: faceTex, lastMood: 'happy', lastBlink: false, blinkTimer: 2 + Math.random() * 3,
      labelSprite: labelSprite, chatSprite: chatSprite, lastChat: '',
      targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      targetYaw: normalizeAngle(data.yaw || 0),
      targetPitch: data.pitch || 0,
      holding: '', walking: false, walkPhase: 0
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
      av.holding = p.holding || '';
      if (heldItem && av.holding === heldItem.id) {
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

  function stepMultiplayerAvatars(dt) {
    Object.keys(remoteAvatars).forEach(function (id) {
      var av = remoteAvatars[id];
      av.group.position.lerp(av.targetPos, Math.min(1, dt * 10));
      var dYaw = normalizeAngle(av.targetYaw - av.group.rotation.y);
      av.group.rotation.y = normalizeAngle(av.group.rotation.y + dYaw * Math.min(1, dt * 12));
      av.headGroup.rotation.x += (av.targetPitch - av.headGroup.rotation.x) * Math.min(1, dt * 12);
      if (av.holding) {
        var held = findPickable(av.holding);
        if (held && held !== heldItem) {
          var hand = new THREE.Vector3(0.28, 0.62, -0.32).applyAxisAngle(new THREE.Vector3(0, 1, 0), av.group.rotation.y);
          held.mesh.position.copy(av.group.position).add(hand);
          held.mesh.rotation.y = av.group.rotation.y;
        }
      }
      if (av.walking) {
        av.walkPhase += dt * 10;
        av.leftLeg.rotation.x = Math.sin(av.walkPhase) * 0.55;
        av.rightLeg.rotation.x = -Math.sin(av.walkPhase) * 0.55;
        av.leftArm.rotation.x = -Math.sin(av.walkPhase) * 0.45;
        av.rightArm.rotation.x = av.holding ? -0.9 : Math.sin(av.walkPhase) * 0.45;
      } else {
        av.leftLeg.rotation.x *= 0.8;
        av.rightLeg.rotation.x *= 0.8;
        av.leftArm.rotation.x *= 0.8;
        av.rightArm.rotation.x = av.holding ? -0.85 : av.rightArm.rotation.x * 0.8;
      }
      animateAvatarExpression(av, dt, av.holding, av.lastChat);
    });
  }

  // ---------------- Interacoes & Tour ----------------

  function handlePrimaryAction() {
    if (heldItem) {
      // Se estiver perto da lousa com giz ou apagador, o clique desenha/apaga em vez de soltar
      if (hoveredBoardHit && getHeldBoardToolColor()) {
        return;
      }
      if (placementValid && placementGhost) {
        heldItem.mesh.position.copy(placementGhost.position);
        heldItem.mesh.rotation.set(0, heldRotY, 0);
        heldItem.isMoved = true;
        pendingMovedItems[heldItem.id] = {
          id: heldItem.id,
          x: heldItem.mesh.position.x,
          y: heldItem.mesh.position.y,
          z: heldItem.mesh.position.z,
          ry: heldRotY
        };
        recentlyDropped[heldItem.id] = performance.now() + 1500;
        heldItem = null;
        placementGhost.visible = false;
        if (callbacks.onHoldChange) callbacks.onHoldChange(null);
      }
      return;
    }
    if (hoveredMushroom && hoveredMushroom.active) {
      hoveredMushroom.active = false;
      hoveredMushroom.group.visible = false;
      hoveredMushroom.respawnAt = performance.now() + 20000;
      if (callbacks.onHarvestMushroom) callbacks.onHarvestMushroom(hoveredMushroom.id);
      return;
    }
    if (hoveredDoor) {
      labDoorOpen = !labDoorOpen;
      return;
    }
    if (hoveredCinema) {
      cinemaPlaying = !cinemaPlaying;
      if (cinemaBeam) cinemaBeam.visible = cinemaPlaying;
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
      seatedSeat = hoveredSeat;
      playerPos.set(seatedSeat.x, seatedSeat.y, seatedSeat.z);
      playerYaw = seatedSeat.yaw;
      playerVelX = 0; playerVelZ = 0; playerVelY = 0;
      return;
    }
    if (hoveredSwitch) {
      hoveredSwitch.on = !hoveredSwitch.on;
      hoveredSwitch.light.intensity = hoveredSwitch.on ? 1.05 : 0;
      hoveredSwitch.gLight.intensity = hoveredSwitch.on ? 0.7 : 0;
      hoveredSwitch.tubeMat.emissiveIntensity = hoveredSwitch.on ? 1.25 : 0.04;
      hoveredSwitch.ledMat.color.setHex(hoveredSwitch.on ? 0x22c55e : 0xef4444);
      hoveredSwitch.rocker.rotation.x = hoveredSwitch.on ? -0.22 : 0.22;
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
    if (hoveredPickable) {
      heldItem = hoveredPickable;
      heldRotY = heldItem.mesh.rotation.y;
      if (callbacks.onHoldChange) callbacks.onHoldChange(heldItem.label);
    }
  }

  function updateHoverRay() {
    hoveredPickable = null;
    hoveredMushroom = null;
    hoveredDoor = false;
    hoveredScreen = false;
    hoveredScreenBtn = null;
    hoveredBoardHit = null;
    hoveredCinema = false;
    hoveredRankBtn = null;
    hoveredSeat = null;
    hoveredSwitch = null;
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

    raycaster.setFromCamera(inFps ? new THREE.Vector2(0, 0) : pointerNdc, camera);

    if (heldItem) {
      var toolCol = getHeldBoardToolColor();
      if (toolCol && chalkboardMeshes.length) {
        var bHits = raycaster.intersectObjects(chalkboardMeshes, false);
        if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
          hoveredBoardHit = bHits[0];
          hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
          if (placementGhost) placementGhost.visible = false;
          prompt = toolCol === 'erase' ? '🧽 Segure o clique para apagar a lousa' : '✏️ Segure o clique para escrever na lousa';
          if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
          return;
        }
      }
      var pt = findPlacementTarget();
      placementValid = !isPlacementBlocked(pt);
      placementGhost.position.copy(pt);
      updatePlacementGhostVisual(heldItem, placementValid, heldRotY);
      placementGhost.visible = true;
      prompt = placementValid ? 'Soltar: ' + heldItem.label : 'Local bloqueado';
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
        prompt = cinemaPlaying ? '⏸️ Clique na tela para pausar o vídeo' : '▶️ Clique na tela para reproduzir o vídeo';
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
        hoveredSeat = stHits[0].object.userData.seatInfo;
        prompt = '🪑 Clique para sentar';
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
    if (!prompt && labDoorPivot) {
      var doorHits = raycaster.intersectObject(labDoorPivot, true);
      if (doorHits.length > 0 && doorHits[0].distance < 4.5) {
        hoveredDoor = true;
        prompt = labDoorOpen ? '🚪 Fechar Porta do Lab' : '🚪 Abrir Porta do Lab';
      }
    }
    if (!prompt) {
      for (var m = 0; m < wildMushrooms.length; m++) {
        var wm = wildMushrooms[m];
        if (!wm.active) continue;
        var mHits = raycaster.intersectObject(wm.group, true);
        if (mHits.length > 0 && mHits[0].distance < 4.5) {
          hoveredMushroom = wm;
          prompt = '🍄 Colher Cogumelo (+25 XP)';
          break;
        }
      }
    }
    if (!prompt) {
      for (var i = 0; i < pickableItems.length; i++) {
        var item = pickableItems[i];
        if (isHeldByRemote(item.id)) continue;
        var hits = raycaster.intersectObject(item.mesh, true);
        if (hits.length > 0 && hits[0].distance < 4.5) {
          hoveredPickable = item;
          prompt = '✋ Pegar ' + item.label;
          break;
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
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      keys[e.code] = true;
      if (e.code === 'Space' && inFps && onGround) {
        playerVelY = 6.2;
        onGround = false;
      }
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

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

    renderer.domElement.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || lobbyTourActive) return;
      if (inFps && !isTouchDevice() && document.pointerLockElement !== renderer.domElement) {
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
    renderer.domElement.addEventListener('touchstart', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (touchLookId === null && t.clientX > window.innerWidth * 0.35) {
          touchLookId = t.identifier;
          lastTX = t.clientX; lastTY = t.clientY;
          touchMoved = false;
        }
      }
    }, { passive: true });

    renderer.domElement.addEventListener('touchmove', function (e) {
      if (!inFps) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          var dx = t.clientX - lastTX, dy = t.clientY - lastTY;
          if (Math.hypot(dx, dy) > 4) touchMoved = true;
          playerYaw -= dx * 0.0045;
          playerPitch = Math.max(-1.35, Math.min(1.35, playerPitch - dy * 0.0045));
          lastTX = t.clientX; lastTY = t.clientY;
        }
      }
    }, { passive: true });

    renderer.domElement.addEventListener('touchend', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          if (!touchMoved && !lobbyTourActive) {
            var rect = renderer.domElement.getBoundingClientRect();
            pointerNdc.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
            pointerNdc.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
            updateHoverRay();
            handlePrimaryAction();
          }
          touchLookId = null;
        }
      }
    }, { passive: true });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

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

    if (labDoorPivot) {
      var targetAngle = labDoorOpen ? -Math.PI * 0.48 : 0;
      labDoorAngle += (targetAngle - labDoorAngle) * Math.min(1, dt * 8);
      labDoorPivot.rotation.y = labDoorAngle;
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
        if (mag > 1) { moveX /= mag; moveZ /= mag; }
        var maxSpeed = keys['ShiftLeft'] ? 7.5 : 4.6;
        var fwdX = -Math.sin(playerYaw), fwdZ = -Math.cos(playerYaw);
        var rightX = Math.cos(playerYaw), rightZ = -Math.sin(playerYaw);
        targetVX = (fwdX * moveZ + rightX * moveX) * maxSpeed;
        targetVZ = (fwdZ * moveZ + rightZ * moveX) * maxSpeed;
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
      }
      var bobY = 0;
      if (onGround && speedNow > 0.25) {
        walkBobPhase += dt * (4.5 + speedNow * 1.4);
        bobY = Math.sin(walkBobPhase) * 0.028 * Math.min(1, speedNow / 3.8);
      }
      var eyeH = seatedSeat ? 1.18 : PLAYER_EYE;
      if (seatedSeat) {
        playerPos.set(seatedSeat.x, seatedSeat.y, seatedSeat.z);
        playerVelY = 0;
      }
      camera.position.set(playerPos.x, playerPos.y + eyeH + bobY, playerPos.z);
      camera.up.set(0, 1, 0);
      camera.up.set(0, 1, 0);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = playerYaw;
      camera.rotation.x = playerPitch;
      camera.rotation.z = 0;

      // Braço direito em 1a pessoa + item segurado na mao
      if (fpsArmGroup) {
        fpsArmGroup.visible = true;
        var drawingNow = !!(isPrimaryDown && hoveredBoardHit && getHeldBoardToolColor());
        armReach += ((drawingNow ? 1 : 0) - armReach) * Math.min(1, dt * 14);
        if (speedNow > 0.2) armSwingPhase += dt * 7;
        fpsArmGroup.position.set(
          0.32 - armReach * 0.08,
          -0.28 + Math.sin(armSwingPhase) * 0.014 + armReach * 0.06,
          -0.42 - armReach * 0.16
        );
        fpsArmGroup.rotation.set(0.18 + armReach * 0.35, -0.14 + armReach * 0.1, 0.05);
      }

      if (heldItem) {
        var reachZ = fpsArmGroup ? armReach * 0.16 : 0;
        var reachY = fpsArmGroup ? armReach * 0.06 : 0;
        var handPos = new THREE.Vector3(0.30, -0.22 + reachY, -0.58 - reachZ).applyEuler(camera.rotation).add(camera.position);
        heldItem.mesh.position.copy(handPos);
        if (heldItem.id.indexOf('chalk_') === 0) {
          heldItem.mesh.rotation.order = 'YXZ';
          heldItem.mesh.rotation.set(playerPitch - 0.18, playerYaw, 0);
        } else if (heldItem.id.indexOf('board_eraser') === 0) {
          heldItem.mesh.rotation.order = 'YXZ';
          heldItem.mesh.rotation.set(playerPitch - Math.PI / 2, playerYaw, 0);
        } else {
          heldItem.mesh.rotation.set(0, heldRotY, 0);
        }
      }
      if (localAvatar) {
        localAvatar.group.visible = true;
        // Desloca 0.14m para tras para enxergar as proprias pernas ao olhar para baixo e projetar sombra inteira!
        localAvatar.group.position.set(
          playerPos.x + Math.sin(playerYaw) * 0.14,
          playerPos.y,
          playerPos.z + Math.cos(playerYaw) * 0.14
        );
        localAvatar.group.rotation.y = playerYaw;
        if (isWalking) {
          localAvatar.walkPhase += dt * 10;
          localAvatar.leftLeg.rotation.x = Math.sin(localAvatar.walkPhase) * 0.55;
          localAvatar.rightLeg.rotation.x = -Math.sin(localAvatar.walkPhase) * 0.55;
        } else {
          localAvatar.leftLeg.rotation.x *= 0.8;
          localAvatar.rightLeg.rotation.x *= 0.8;
        }
        localAvatar.rightArm.visible = false; // usa o braco 1a pessoa detalhado
      }
    } else {
      if (fpsArmGroup) fpsArmGroup.visible = false;
      if (localAvatar) localAvatar.group.visible = false;
      isWalking = false;
      controls.update();
    }

    if (!lobbyTourActive) {
      updateHoverRay();
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
    drawCinemaVideoFrame(dt);
    updateDynamicEnvironment(dt);
    dropUnsupportedItems();
    stepMultiplayerAvatars(dt);
    renderer.render(scene, camera);
  }

  function drawCinemaVideoFrame(dt) {
    if (!cinemaCtx || !cinemaTex) return;
    if (cinemaPlaying) cinemaTime += dt;
    var ctx = cinemaCtx;
    var t = cinemaTime;
    // Fundo cinema escuro com gradiente suave
    var g = ctx.createLinearGradient(0, 0, 512, 256);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);

    // Rede micelial animada crescendo na tela
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 9; i++) {
      var ang = (i / 9) * Math.PI * 2 + t * 0.25;
      var r = 30 + ((Math.sin(t * 1.1 + i) + 1) * 0.5) * 65;
      ctx.beginPath();
      ctx.moveTo(256, 132);
      ctx.quadraticCurveTo(256 + Math.cos(ang + 0.4) * r * 0.6, 132 + Math.sin(ang + 0.4) * r * 0.6, 256 + Math.cos(ang) * r, 132 + Math.sin(ang) * r);
      ctx.stroke();
    }
    // Cogumelo crescendo em time-lapse no centro
    var grow = 0.6 + 0.4 * Math.sin(t * 0.9);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(247, 135 - 32 * grow, 18, 36 * grow);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(256, 135 - 32 * grow, 28 * grow, Math.PI, 0);
    ctx.fill();

    // Titulo & Barra de progresso do video
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 512, 34);
    ctx.fillRect(0, 224, 512, 32);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('🎬 DOCUMENTÁRIO: Ciclo do Micélio & Frutificação', 16, 22);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(cinemaPlaying ? '⏸️ Clique para pausar' : '▶️ PAUSADO (clique para continuar)', 16, 245);
    var prog = (t % 20) / 20;
    ctx.fillStyle = '#334155';
    ctx.fillRect(280, 237, 212, 6);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(280, 237, 212 * prog, 6);
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

    // Acumulo de neve no terreno e telhados
    if (terrainSnowMat) {
      terrainSnowMat.emissive.setHex(0xe2e8f0);
      terrainSnowMat.emissiveIntensity = snowMix * 0.42;
    }
    var snowWhite = new THREE.Color(0xf1f5f9);
    for (var si = 0; si < snowableEntries.length; si++) {
      snowableEntries[si].mat.color.copy(snowableEntries[si].base).lerp(snowWhite, snowMix * 0.85);
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

    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 440);
    camera.position.set(-14, 16, 26);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    sun.shadow.mapSize.set(2048, 2048);
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
    if (inFps && onGround) {
      playerVelY = 6.2;
      onGround = false;
    }
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
      walking: isWalking, in_fps: inFps
    };
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
    pickableItems.forEach(function (item) {
      if (heldItem === item || isHeldByRemote(item.id)) return;
      if (pendingMovedItems[item.id] || recentlyDropped[item.id] > performance.now()) return;
      var saved = objectsMap[item.id];
      if (saved) {
        item.mesh.position.set(saved.x, saved.y, saved.z);
        item.mesh.rotation.y = saved.ry || 0;
      } else if (item.isMoved) {
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        item.isMoved = false;
      }
    });
  };

  window.resetCampusWorldObjects = function () {
    heldItem = null;
    pendingMovedItems = {};
    pickableItems.forEach(function (item) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      item.isMoved = false;
    });
    if (callbacks.onHoldChange) callbacks.onHoldChange(null);
  };

  window.consumeCampusBoardStrokes = function () {
    var out = pendingBoardStrokes.slice();
    pendingBoardStrokes = [];
    return out;
  };

  window.applyCampusBoardStrokes = function (strokes) {
    (strokes || []).forEach(applyStrokeToBoard);
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

  window.updateCampusRanking = function (list) {
    rankingList = Array.isArray(list) ? list : [];
    drawRankingBoard();
  };

  window.updateCampusAuditoriumSlide = updateCampusAuditoriumSlide;
  window.updateCampusPlayers = updateCampusPlayers;
})();
