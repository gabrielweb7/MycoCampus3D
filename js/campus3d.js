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

  // Braco 1a pessoa & Lousa Interativa
  var fpsArmGroup = null;
  var fpsSleeveMat = null;
  var armSwingPhase = 0;
  var armReach = 0;
  var chalkboardMesh = null;
  var chalkboardCanvas = null;
  var chalkboardCtx = null;
  var chalkboardTex = null;
  var hoveredBoardHit = null;
  var isPrimaryDown = false;
  var lastDrawPt = null;
  var currentStroke = null;
  var pendingBoardStrokes = [];

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
    var terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 }));
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
    var h1 = 3.68; // 1o andar (piso 2o andar fica em y = 3.80 exato)
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
    scene.add(roofSlab);
    var parapet = makeBox(w + 0.72, 0.42, d + 0.72, 0x64748b, { roughness: 0.5 });
    parapet.position.set(cx, yFloor2 + h2 + 0.43, cz);
    scene.add(parapet);

    // Pilares de concreto escuro
    [[frontX, zN], [frontX, zS], [backX, zN], [backX, zS], [frontX, cz]].forEach(function (pp) {
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

    // Mobiliario iluminado do 2o andar
    var roomGlow = makeBox(w - 2.2, 0.08, d - 2.4, 0xfef9c3, { emissive: 0xfde68a, emissiveIntensity: 0.5, noShadow: true });
    roomGlow.position.set(cx, yFloor2 + h2 - 0.15, cz);
    scene.add(roomGlow);
    for (var dtRow = -1; dtRow <= 1; dtRow++) {
      var desk = makeBox(1.1, 0.72, 2.0, 0xd97706, { roughness: 0.65 });
      desk.position.set(cx + dir * 1.1, yFloor2 + 0.36, cz + dtRow * 3.0);
      scene.add(desk);
      solidColliders.push({
        minX: cx + dir * 1.1 - 0.6, maxX: cx + dir * 1.1 + 0.6,
        minZ: cz + dtRow * 3.0 - 1.05, maxZ: cz + dtRow * 3.0 + 1.05,
        minY: yFloor2, maxY: yFloor2 + 0.9
      });
    }
    var board = makeBox(0.1, 1.3, 3.6, 0x14532d, { roughness: 0.6 });
    board.position.set(backX + dir * 0.22, yFloor2 + 1.75, cz);
    scene.add(board);

    if (opts.interactiveBoard) {
      // Lousa interativa desenhavel no 2o andar (Bloco Oeste-Norte)
      chalkboardCanvas = document.createElement('canvas');
      chalkboardCanvas.width = 512;
      chalkboardCanvas.height = 256;
      chalkboardCtx = chalkboardCanvas.getContext('2d');
      chalkboardCtx.fillStyle = '#14532d';
      chalkboardCtx.fillRect(0, 0, 512, 256);
      chalkboardCtx.fillStyle = 'rgba(255,255,255,0.28)';
      chalkboardCtx.font = 'bold 16px system-ui, sans-serif';
      chalkboardCtx.fillText('Lousa Interativa • Pegue um giz ou apagador abaixo', 16, 26);
      chalkboardTex = new THREE.CanvasTexture(chalkboardCanvas);

      chalkboardMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 1.2),
        new THREE.MeshBasicMaterial({ map: chalkboardTex })
      );
      chalkboardMesh.position.set(backX + dir * 0.28, yFloor2 + 1.75, cz);
      chalkboardMesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(chalkboardMesh);

      // Bandeja de giz & apagador
      var trayX = backX + dir * 0.42;
      var trayY = yFloor2 + 0.98;
      var tray = makeBox(0.38, 0.08, 3.2, 0x78350f, { roughness: 0.7 });
      tray.position.set(trayX, trayY, cz);
      scene.add(tray);
      supportSurfaces.push({
        minX: trayX - 0.22, maxX: trayX + 0.22,
        minZ: cz - 1.65, maxZ: cz + 1.65,
        topY: trayY + 0.04
      });

      var chalkDefs = [
        { id: 'chalk_white', label: 'Giz Branco', color: 0xf8fafc, dz: -0.9 },
        { id: 'chalk_green', label: 'Giz Verde', color: 0x4ade80, dz: -0.3 },
        { id: 'chalk_yellow', label: 'Giz Amarelo', color: 0xfacc15, dz: 0.3 }
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

      // Apagador largo de madeira + feltro
      var eraser = new THREE.Group();
      var eWood = makeBox(0.12, 0.06, 0.28, 0x92400e, { roughness: 0.75 });
      eWood.position.y = 0.05;
      var eFelt = makeBox(0.12, 0.03, 0.28, 0x1e293b, { roughness: 0.95 });
      eFelt.position.y = 0.015;
      eraser.add(eWood, eFelt);
      registerPickable('board_eraser', 'Apagador da Lousa', eraser, trayX, trayY + 0.04, cz + 0.95, 0, 0.2, 0.14);
    }

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

  function updateClockTexture() {
    if (!clockCtx || !clockTex) return;
    var now = new Date();
    var m = now.getMinutes();
    if (m === lastClockMin) return;
    lastClockMin = m;
    var h = now.getHours() % 12;

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
    // 14 degraus largos de z=-11.5 ate z=-18.5 (subindo de y=0 ate y=3.80)
    var steps = 14;
    var stepD = 7.0 / steps;
    var stepH = yTop / steps;
    for (var i = 0; i < steps; i++) {
      var sy = (i + 1) * stepH;
      var sz = -11.5 - (i + 0.5) * stepD;
      var step = makeBox(8.4, sy, stepD + 0.04, 0xcbd5e1, { roughness: 0.72 });
      step.position.set(0, sy / 2, sz);
      scene.add(step);
    }
    stairsList.push({ minX: -4.2, maxX: 4.2, zStart: -11.5, zEnd: -18.5, yStart: 0, yEnd: yTop });

    // Muretas laterais da escadaria
    [-4.35, 4.35].forEach(function (rx) {
      var railWall = makeBox(0.35, 2.6, 7.2, 0x64748b, { roughness: 0.6 });
      railWall.position.set(rx, 1.3, -15.0);
      scene.add(railWall);
      solidColliders.push({ minX: rx - 0.25, maxX: rx + 0.25, minZ: -18.6, maxZ: -11.4, minY: 0, maxY: 4.9 });
    });

    // Passarela / Ponte Elevada no nivel exato y=3.80 ligando x=-24..+24 ate os predios!
    // Parte principal dianteira (z: -18.5 .. -12.8) conectando as entradas norte dos 2os andares
    addWalkableSlab(0, yTop, -15.65, 42.0, 0.34, 5.7, 0x475569, { roughness: 0.6 });

    // Guarda-corpo de vidro na borda sul da passarela (com abertura central na escadaria -4.2..4.2)
    [-1, 1].forEach(function (side) {
      addSolidWall(side * 4.2, -12.85, side * 14.0, -12.85, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
      addSolidWall(side * 20.6, -12.85, side * 24.0, -12.85, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Pontes ligando Bloco Norte <-> Bloco Sul no 2o andar (x = +-19, z = -1.2 .. 2.2, y = 3.80)
    [-19, 19].forEach(function (ax) {
      addWalkableSlab(ax, yTop, 0.5, 4.4, 0.28, 3.6, 0x475569, { roughness: 0.6 });
      addSolidWall(ax - 2.1, -1.2, ax - 2.1, 2.2, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
      addSolidWall(ax + 2.1, -1.2, ax + 2.1, 2.2, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Terraco Norte (y = 3.80, x: -24..24, z: -29.5 .. -42.0) — separado da passarela por um Lago Norte com ponte!
    addWalkableSlab(0, yTop, -35.75, 48.0, 3.80, 12.5, 0x94a3b8, { roughness: 0.8 });

    // Ponte Norte sobre o lago ligando a Passarela (-18.5) ate o Terraco da Torre do Relogio (-29.5)
    addWalkableSlab(0, yTop, -24.0, 5.6, 0.36, 11.2, 0x64748b, { roughness: 0.65 });
    [-2.75, 2.75].forEach(function (bx) {
      addSolidWall(bx, -29.5, bx, -18.5, yTop, 1.05, 0.12, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Lago Norte sob a ponte (x: -24..24, z: -29.5 .. -18.5)
    var northWater = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 11.5),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.84 })
    );
    northWater.rotation.x = -Math.PI / 2;
    northWater.position.set(0, 0.08, -24.0);
    scene.add(northWater);
  }

  function buildClockTowerAndAuditorium() {
    var baseY = 3.80;

    // Alas laterais simetricas da Reitoria (recuadas para z = -37)
    [-9.5, 9.5].forEach(function (ax) {
      var wing = makeBox(11.0, 6.2, 6.4, brickMat(3, 2));
      wing.position.set(ax, baseY + 3.1, -37.0);
      scene.add(wing);
      var trim = makeBox(11.4, 0.45, 6.8, 0x64748b);
      trim.position.set(ax, baseY + 6.3, -37.0);
      scene.add(trim);
      var winFrame = makeBox(8.7, 4.8, 0.14, 0x0f172a);
      winFrame.position.set(ax, baseY + 3.1, -33.72);
      scene.add(winFrame);
      var win = makeBox(8.3, 4.4, 0.16, 0x7dd3fc, { transparent: true, opacity: 0.55, roughness: 0.15 });
      win.position.set(ax, baseY + 3.1, -33.68);
      scene.add(win);
      solidColliders.push({ minX: ax - 5.6, maxX: ax + 5.6, minZ: -40.3, maxZ: -33.7, minY: baseY, maxY: baseY + 7 });
    });

    // Torre Central do Relogio
    var tower = makeBox(5.6, 12.6, 6.8, 0x64748b, { roughness: 0.55 });
    tower.position.set(0, baseY + 6.3, -37.0);
    scene.add(tower);
    var towerFrame = makeBox(3.6, 7.6, 0.16, 0x0f172a);
    towerFrame.position.set(0, baseY + 4.3, -33.52);
    scene.add(towerFrame);
    var towerGlass = makeBox(3.2, 7.2, 0.18, 0x7dd3fc, { transparent: true, opacity: 0.6, roughness: 0.15 });
    towerGlass.position.set(0, baseY + 4.3, -33.46);
    scene.add(towerGlass);
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

    // Telao Principal no Terraco (ao lado esquerdo da entrada da Torre do Relogio)
    auditoriumCanvas = document.createElement('canvas');
    auditoriumCanvas.width = 1024;
    auditoriumCanvas.height = 576;
    auditoriumCtx = auditoriumCanvas.getContext('2d');
    auditoriumTex = new THREE.CanvasTexture(auditoriumCanvas);

    var frameMain = makeBox(6.6, 3.8, 0.25, 0x0f172a, { roughness: 0.4 });
    frameMain.position.set(-9.5, baseY + 2.4, -33.3);
    scene.add(frameMain);

    var screenMain = new THREE.Mesh(
      new THREE.PlaneGeometry(6.1, 3.4),
      new THREE.MeshBasicMaterial({ map: auditoriumTex })
    );
    screenMain.position.set(-9.5, baseY + 2.4, -33.14);
    scene.add(screenMain);
    auditoriumScreenMeshes.push(screenMain);

    // Segundo Telao Externo na parede do Bloco Oeste (como na foto de referencia!)
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

    addScreenButtons3D(-9.5, baseY + 0.25, -33.08, 0);
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
      radius: radius || 0.25, height: height || 0.4, isMoved: false
    });
  }

  function buildCampusWingsAndEquipment() {
    // ALA OESTE (Esquerda) — 2 blocos de 2 andares (x: -24..-14)
    // Bloco Oeste-Norte (z: -12.8..-1.2): LABORATORIO DE FLUXO LAMINAR & AUTOCLAVE + 2o andar acessivel
    buildCampusBuildingWing({ cx: -19, cz: -7, width: 10, depth: 11.6, faceDir: 1, hasDoor: true, style: 'brick', connectNorth2F: true, connectSouth2F: true, interactiveBoard: true });
    // Bloco Oeste-Sul (z: 2.2..13.8): Salas de Aula (1o e 2o andares acessiveis)
    buildCampusBuildingWing({ cx: -19, cz: 8, width: 10, depth: 11.6, faceDir: 1, hasDoor: false, style: 'brick', connectNorth2F: true });

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
    buildCampusBuildingWing({ cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, openFront: true, style: 'brick', connectNorth2F: true, connectSouth2F: true });
    // Bloco Leste-Sul (z: 2.2..13.8): ESTUFA DE FRUTIFICACAO + 2o andar acessivel
    buildCampusBuildingWing({ cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, openFront: true, style: 'wood', connectNorth2F: true });

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
    addWalkableSlab(48, 0.14, -12, 18, 0.14, 14, 0x475569);
    addWalkableSlab(48, 3.6, -12, 18, 0.24, 14, 0x334155);
    var scBody = makeBox(17.4, 3.4, 13.4, brickMat(4, 1.5));
    scBody.position.set(48, 1.84, -12);
    var scTop = makeBox(14, 2.8, 9, brickMat(3, 1.2));
    scTop.position.set(48, 5.0, -14);
    var scRoof = makeBox(14.8, 0.35, 9.8, 0x64748b);
    scRoof.position.set(48, 6.55, -14);
    scene.add(scBody, scTop, scRoof);
    solidColliders.push({ minX: 39.2, maxX: 56.8, minZ: -18.8, maxZ: -5.2, minY: 0, maxY: 3.5 });
    // Letreiro 3D Student Center
    var scSignC = document.createElement('canvas');
    scSignC.width = 512; scSignC.height = 96;
    var scCtx = scSignC.getContext('2d');
    scCtx.fillStyle = '#0f172a'; scCtx.fillRect(0, 0, 512, 96);
    scCtx.fillStyle = '#38bdf8'; scCtx.font = 'bold 42px system-ui, sans-serif';
    scCtx.textAlign = 'center'; scCtx.textBaseline = 'middle';
    scCtx.fillText('STUDENT CENTER', 256, 48);
    var scSign = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(scSignC) }));
    scSign.position.set(48, 5.4, -9.45);
    scene.add(scSign);
    createUmbrellaTable(43, -2.5);
    createUmbrellaTable(48, -2.5);
    createUmbrellaTable(53, -2.5);

    // 4b. 2a Praca Circular Leste com Fonte (x: 42, z: 12)
    var plazaE = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.04, 28), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
    plazaE.position.set(42, 0.02, 12);
    var rimE = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.42, 24), new THREE.MeshStandardMaterial({ color: 0xcbd5e1 }));
    rimE.position.set(42, 0.21, 12);
    var waterE = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.44, 24), lakeMat);
    waterE.position.set(42, 0.23, 12);
    scene.add(plazaE, rimE, waterE);
    solidColliders.push({ minX: 39.5, maxX: 44.5, minZ: 9.5, maxZ: 14.5, minY: 0, maxY: 1.2 });

    // 4c. 2 Dormitorios no Sudeste (tijolinho + madeira + toldos coloridos)
    [[58, 12, 0xfacc15], [50, 28, 0x38bdf8]].forEach(function (dm) {
      var dBody = makeBox(14, 6.2, 10, brickMat(3, 2));
      dBody.position.set(dm[0], 3.1, dm[1]);
      var dRoof = makeBox(14.6, 0.4, 10.6, 0x64748b);
      dRoof.position.set(dm[0], 6.4, dm[1]);
      var awning = makeBox(2.4, 0.25, 1.2, dm[2]);
      awning.position.set(dm[0] - 4.0, 2.3, dm[1] + 5.4);
      scene.add(dBody, dRoof, awning);
      solidColliders.push({
        minX: dm[0] - 7.1, maxX: dm[0] + 7.1,
        minZ: dm[1] - 5.1, maxZ: dm[1] + 5.1, minY: 0, maxY: 6.8
      });
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
    if (!chalkboardCtx || !chalkboardTex || !st || !st.pts || !st.pts.length) return;
    var pts = st.pts;
    for (var i = 0; i < pts.length; i++) {
      var p0 = i === 0 ? pts[0] : pts[i - 1];
      drawBoardSegment(chalkboardCtx, st.c, p0, pts[i]);
    }
    chalkboardTex.needsUpdate = true;
  }

  function getHeldBoardToolColor() {
    if (!heldItem) return null;
    if (heldItem.id === 'chalk_white') return '#f8fafc';
    if (heldItem.id === 'chalk_green') return '#4ade80';
    if (heldItem.id === 'chalk_yellow') return '#facc15';
    if (heldItem.id === 'board_eraser') return 'erase';
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
    var dir = raycaster.ray.direction.clone();
    var origin = raycaster.ray.origin.clone();
    var bestPt = null;
    for (var t = 0.6; t <= 4.5; t += 0.25) {
      var p = origin.clone().addScaledVector(dir, t);
      for (var i = 0; i < supportSurfaces.length; i++) {
        var s = supportSurfaces[i];
        if (p.x >= s.minX && p.x <= s.maxX && p.z >= s.minZ && p.z <= s.maxZ && Math.abs(p.y - s.topY) < 0.35) {
          bestPt = new THREE.Vector3(p.x, s.topY, p.z);
          break;
        }
      }
      if (bestPt) break;
      var gh = getGroundHeight(p.x, p.z, playerPos.y);
      if (p.y <= gh + 0.15) {
        bestPt = new THREE.Vector3(p.x, gh, p.z);
        break;
      }
    }
    if (!bestPt) {
      var fwd = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
      var fx = playerPos.x + fwd.x * 1.4;
      var fz = playerPos.z + fwd.z * 1.4;
      bestPt = new THREE.Vector3(fx, getGroundHeight(fx, fz, playerPos.y), fz);
    }
    return bestPt;
  }

  function isPlacementBlocked(pt) {
    if (pt.y > 3.2) return false;
    for (var i = 0; i < wallSegments.length; i++) {
      var w = wallSegments[i];
      var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      var len2 = vx * vx + vz * vz;
      var t = Math.max(0, Math.min(1, ((pt.x - w.x1) * vx + (pt.z - w.z1) * vz) / len2));
      var dist = Math.hypot(pt.x - (w.x1 + t * vx), pt.z - (w.z1 + t * vz));
      if (dist < 0.35) return true;
    }
    return false;
  }

  function dropUnsupportedItems() {
    pickableItems.forEach(function (item) {
      if (heldItem === item || isHeldByRemote(item.id)) return;
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

  function buildCuteAvatar(data) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
    var hatMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(data.hat_color || '#d9534f'), roughness: 0.45 });

    var leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), bodyMat);
    leftLeg.position.set(-0.1, 0.19, 0);
    var rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), bodyMat);
    rightLeg.position.set(0.1, 0.19, 0);
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
    var hat = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hatMat);
    hat.position.set(0, 0.25, 0); hat.castShadow = true;
    headGroup.add(head, hat);

    var isProf = data.role === 'professor' || data.role === 'admin';
    if (isProf) {
      var crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.035, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.45, metalness: 0.8 })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.set(0, 0.56, 0);
      headGroup.add(crown);
    }
    g.add(headGroup);

    var labelSprite = makeTextSprite((isProf ? '👨‍🏫 ' : '') + (data.name || 'Aluno'), isProf ? '#fbbf24' : '#ffffff');
    labelSprite.position.set(0, 1.85, 0);
    var chatSprite = makeTextSprite('', '#34d399');
    chatSprite.position.set(0, 2.25, 0);
    chatSprite.visible = false;
    g.add(labelSprite, chatSprite);

    scene.add(g);
    return {
      group: g, leftLeg: leftLeg, rightLeg: rightLeg, leftArm: leftArm, rightArm: rightArm, headGroup: headGroup,
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
        heldItem.mesh.rotation.y = heldRotY;
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
      if (toolCol && chalkboardMesh) {
        var bHits = raycaster.intersectObject(chalkboardMesh, false);
        if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
          hoveredBoardHit = bHits[0];
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
        if (mag > 1) { moveX /= mag; moveZ /= mag; }
        var maxSpeed = keys['ShiftLeft'] ? 6.2 : 3.8;
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
      camera.position.set(playerPos.x, playerPos.y + PLAYER_EYE + bobY, playerPos.z);
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
        heldItem.mesh.rotation.y = heldRotY;
      }
    } else {
      if (fpsArmGroup) fpsArmGroup.visible = false;
      isWalking = false;
      controls.update();
    }

    if (!lobbyTourActive) {
      updateHoverRay();
      // Desenho ou apagamento continuo na lousa enquanto segura o clique perto dela
      var toolColor = getHeldBoardToolColor();
      if (isPrimaryDown && hoveredBoardHit && toolColor && chalkboardCtx && chalkboardTex) {
        var px = Math.round(hoveredBoardHit.uv.x * 512 * 10) / 10;
        var py = Math.round((1 - hoveredBoardHit.uv.y) * 256 * 10) / 10;
        var curPt = [px, py];
        if (!currentStroke || currentStroke.c !== toolColor) {
          flushCurrentStroke();
          currentStroke = { c: toolColor, pts: [curPt] };
          drawBoardSegment(chalkboardCtx, toolColor, curPt, curPt);
          chalkboardTex.needsUpdate = true;
          lastDrawPt = curPt;
        } else if (!lastDrawPt || Math.hypot(curPt[0] - lastDrawPt[0], curPt[1] - lastDrawPt[1]) >= 2.5) {
          drawBoardSegment(chalkboardCtx, toolColor, lastDrawPt || curPt, curPt);
          chalkboardTex.needsUpdate = true;
          currentStroke.pts.push(curPt);
          lastDrawPt = curPt;
          if (currentStroke.pts.length >= 60) {
            flushCurrentStroke();
            currentStroke = { c: toolColor, pts: [curPt] };
            lastDrawPt = curPt;
          }
        }
      } else if (currentStroke) {
        flushCurrentStroke();
      }
    }
    dropUnsupportedItems();
    stepMultiplayerAvatars(dt);
    renderer.render(scene, camera);
  }

  // ---------------- Inicializacao & API Publica ----------------

  window.initCampus3D = function (containerId, cbs) {
    callbacks = Object.assign(callbacks, cbs || {});
    var container = document.getElementById(containerId);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x60a5fa);
    scene.fog = new THREE.FogExp2(0xbfdbfe, 0.0022);

    // Nuvens brancas suaves no ceu
    var cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, emissive: 0xe0f2fe, emissiveIntensity: 0.25 });
    for (var cl = 0; cl < 12; cl++) {
      var cg = new THREE.Group();
      var ca = (cl / 12) * Math.PI * 2;
      cg.position.set(Math.cos(ca) * (70 + (cl % 3) * 18), 32 + (cl % 4) * 4, Math.sin(ca) * (70 + (cl % 3) * 18));
      for (var cp = 0; cp < 3; cp++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(5 + (cp % 2) * 2.5, 10, 8), cloudMat);
        puff.position.set((cp - 1) * 5.2, (cp % 2) * 1.4, 0);
        puff.scale.set(1.3, 0.65, 1.0);
        cg.add(puff);
      }
      scene.add(cg);
    }

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

    clock = new THREE.Clock();
    createProceduralTextures();
    buildNatureWorld();
    buildPlaza();
    buildStaircaseAndBridge();
    buildClockTowerAndAuditorium();
    buildCampusWingsAndEquipment();
    buildOuterCampus();
    buildFirstPersonArm();
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
  };

  window.updateCampusAuditoriumSlide = updateCampusAuditoriumSlide;
  window.updateCampusPlayers = updateCampusPlayers;
})();
