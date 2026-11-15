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
  var wallSegments = [];     // { x1, z1, x2, z2, halfThick }
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
    // Plato plano da universidade (-32..32, -38..28)
    var distCenter = Math.max(Math.abs(x) - 31, Math.abs(z + 4) - 32);
    if (distCenter <= 0) return 0;
    var blend = Math.min(1, distCenter / 16);

    // Lago Alpino ao Nordeste (38, -42)
    var dxLake = (x - 38) / 14;
    var dzLake = (z + 42) / 11;
    var lakeDist = Math.sqrt(dxLake * dxLake + dzLake * dzLake);
    var lakeDrop = lakeDist < 1 ? -1.5 * (1 - lakeDist * lakeDist) : 0;

    var hills = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2.5 + Math.sin(x * 0.13 + z * 0.1) * 0.6;
    return blend * hills + lakeDrop;
  }

  function getGroundHeight(x, z, refY) {
    var h = terrainHeight(x, z);
    var curY = refY !== undefined ? refY : playerPos.y;

    // Escadaria Monumental (x: -4.2..4.2, z: -11.5 .. -19.0) sobe de 0 -> 4.0
    if (x >= -4.2 && x <= 4.2 && z <= -11.5 && z >= -19.0) {
      var t = (-11.5 - z) / 7.5; // 0 na base, 1 no topo
      var stepH = Math.min(4.0, Math.max(0, t * 4.0));
      h = Math.max(h, stepH);
    }

    // Terraco Norte da Reitoria (x: -24..24, z: -19.0 .. -36.0, y = 4.0)
    if (x >= -24 && x <= 24 && z <= -19.0 && z >= -36.0) {
      if (curY >= 2.2 || z <= -19.0 && x >= -4.4 && x <= 4.4) {
        h = Math.max(h, 4.0);
      }
    }

    // Passarela Elevada (x: -14.5..14.5, z: -16.8..-14.0, y = 4.0)
    if (x >= -14.5 && x <= 14.5 && z >= -16.8 && z <= -14.0 && curY >= 2.6) {
      h = Math.max(h, 4.0);
    }

    // Pisos terreo das alas
    if (x >= -24.2 && x <= -13.8 && z >= -13.2 && z <= 14.2) h = Math.max(h, 0.12);
    if (x >= 13.8 && x <= 24.2 && z >= -13.2 && z <= 14.2) h = Math.max(h, 0.12);

    return h;
  }

  // ---------------- Mundo Natural & Lago ----------------

  function buildNatureWorld() {
    var size = 240;
    var segs = 120;
    var geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = [];
    var cGrass = new THREE.Color(0x2f7038);
    var cGrassAlt = new THREE.Color(0x3c8444);
    var cSand = new THREE.Color(0xcbd5e1);

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var y = terrainHeight(x, z);
      pos.setY(i, y);
      var col = ((Math.sin(x * 0.14) + Math.cos(z * 0.14)) > 0 ? cGrass : cGrassAlt).clone();
      if (y < -0.2) col.lerp(cSand, 0.7);
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Lago Alpino
    var waterGeo = new THREE.CircleGeometry(13, 36);
    waterGeo.rotateX(-Math.PI / 2);
    var water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
      color: 0x0284c7, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.84
    }));
    water.position.set(38, -0.25, -42);
    scene.add(water);

    // Floresta densa ao redor do campus (72 arvores)
    var treeCoords = [];
    for (var a = 0; a < 36; a++) {
      var ang = (a / 36) * Math.PI * 2;
      var rad = 38 + (a % 3) * 8;
      var tx = Math.cos(ang) * rad;
      var tz = Math.sin(ang) * rad - 4;
      if (Math.hypot(tx - 38, tz + 42) > 13.5) treeCoords.push([tx, tz]);
    }
    // Arvores extras de fundo (Norte/Leste/Oeste)
    for (var b = 0; b < 36; b++) {
      var ang2 = (b / 36) * Math.PI * 2 + 0.09;
      var rad2 = 52 + (b % 4) * 7;
      treeCoords.push([Math.cos(ang2) * rad2, Math.sin(ang2) * rad2 - 6]);
    }

    treeCoords.forEach(function (tc, idx) {
      var tx = tc[0], tz = tc[1];
      var ty = terrainHeight(tx, tz);
      var scale = 0.9 + (idx % 4) * 0.22;
      var tree = new THREE.Group();
      tree.position.set(tx, ty, tz);
      tree.scale.setScalar(scale);

      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.38, 3.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
      );
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      tree.add(trunk);

      if (idx % 3 === 0) {
        var c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 1), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 }));
        c1.position.y = 3.9; c1.castShadow = true;
        var c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 1), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.85 }));
        c2.position.set(0.6, 4.9, 0.4); c2.castShadow = true;
        tree.add(c1); tree.add(c2);
      } else {
        for (var k = 0; k < 3; k++) {
          var cone = new THREE.Mesh(
            new THREE.ConeGeometry(2.0 - k * 0.42, 2.5 - k * 0.2, 8),
            new THREE.MeshStandardMaterial({ color: k === 2 ? 0x15803d : 0x166534, roughness: 0.85 })
          );
          cone.position.y = 3.0 + k * 1.4;
          cone.castShadow = true;
          tree.add(cone);
        }
      }
      scene.add(tree);
      solidColliders.push({ minX: tx - 0.55, maxX: tx + 0.55, minZ: tz - 0.55, maxZ: tz + 0.55, minY: ty, maxY: ty + 5 });
    });

    // 20 Cogumelos Silvestres colhiveis (+25 XP) ao redor dos canteiros externos e floresta
    var mushCoords = [
      [-11.5, 15.5], [11.5, 15.5], [-26, 8], [-27, -6], [26, 8], [27, -6],
      [-26, 18], [26, 18], [-16, 22], [16, 22], [0, 25], [-8, 27],
      [9, 27], [-28, -20], [28, -20], [31, -30], [25, -36], [34, -27],
      [-31, 0], [31, 0]
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
      var spot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      spot.position.set(fx + Math.cos(ang) * 0.82, 2.96 + (s % 2) * 0.14, fz + Math.sin(ang) * 0.82);
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
    // opts: { cx, cz, width, depth, faceDir (+1 enfrenta +X, -1 enfrenta -X), hasDoor, style ('brick'|'wood') }
    var w = opts.width || 10.0;
    var d = opts.depth || 11.5;
    var h1 = 3.5; // 1o andar
    var h2 = 3.5; // 2o andar
    var totalH = h1 + h2;
    var cx = opts.cx, cz = opts.cz;
    var dir = opts.faceDir; // +1 = fachada olha para +X (Praca), -1 = fachada olha para -X (Praca)
    var frontX = cx + dir * (w / 2);
    var backX = cx - dir * (w / 2);

    // Laje de piso
    var floor = makeBox(w + 0.4, 0.14, d + 0.4, 0x475569, { roughness: 0.7 });
    floor.position.set(cx, 0.07, cz);
    scene.add(floor);

    // Laje do 2o andar + Platibanda cinza no teto
    var midSlab = makeBox(w + 0.35, 0.24, d + 0.35, 0x334155, { roughness: 0.55 });
    midSlab.position.set(cx, h1 + 0.12, cz);
    scene.add(midSlab);

    var roofSlab = makeBox(w + 0.6, 0.32, d + 0.6, 0x94a3b8, { roughness: 0.5 });
    roofSlab.position.set(cx, totalH + 0.28, cz);
    scene.add(roofSlab);

    var parapet = makeBox(w + 0.72, 0.42, d + 0.72, 0x64748b, { roughness: 0.5 });
    parapet.position.set(cx, totalH + 0.55, cz);
    scene.add(parapet);

    // Pilares de concreto escuro nos 4 cantos + meio
    var pPositions = [
      [frontX, cz - d / 2], [frontX, cz + d / 2],
      [backX, cz - d / 2], [backX, cz + d / 2],
      [frontX, cz]
    ];
    pPositions.forEach(function (pp) {
      var col = makeBox(0.45, totalH + 0.3, 0.45, 0x1e293b, { roughness: 0.5 });
      col.position.set(pp[0], totalH / 2 + 0.12, pp[1]);
      scene.add(col);
    });

    // Parede dos fundos e laterais em tijolinho ou madeira ripada
    var wallMat = opts.style === 'wood' ? woodMat(3, 2) : brickMat(3, 2);
    var backWall = makeBox(0.28, totalH, d, wallMat);
    backWall.position.set(backX, totalH / 2 + 0.12, cz);
    scene.add(backWall);

    var sideN = makeBox(w, totalH, 0.28, brickMat(2.5, 2));
    sideN.position.set(cx, totalH / 2 + 0.12, cz - d / 2);
    scene.add(sideN);

    var sideS = makeBox(w, totalH, 0.28, brickMat(2.5, 2));
    sideS.position.set(cx, totalH / 2 + 0.12, cz + d / 2);
    scene.add(sideS);

    // Se NAO tiver porta interativa (predio decorativo/outra ala), adiciona janelas panorâmicas nos 2 andares e colisor completo
    // Se tiver porta (Lab), deixa abertura central na fachada do terreo para entrar!
    var glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.25 });

    // 2o andar sempre com janelas grandes e sala iluminada visivel
    var upperGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, h2 - 0.6, d - 0.6), glassMat);
    upperGlass.position.set(frontX, h1 + h2 / 2 + 0.12, cz);
    scene.add(upperGlass);

    // Esquadrias verticais das janelas do 2o andar
    for (var m = -2; m <= 2; m++) {
      var mullion = makeBox(0.18, h2 - 0.5, 0.1, 0x0f172a);
      mullion.position.set(frontX, h1 + h2 / 2 + 0.12, cz + m * (d / 5));
      scene.add(mullion);
    }

    // Mobiliario simples visivel no 2o andar (mesas + quadro verde + luz)
    var roomGlow = makeBox(w - 2.2, 0.1, d - 2.4, 0xfef9c3, { emissive: 0xfde68a, emissiveIntensity: 0.55, noShadow: true });
    roomGlow.position.set(cx, totalH - 0.15, cz);
    scene.add(roomGlow);
    for (var dtRow = -1; dtRow <= 1; dtRow++) {
      var desk = makeBox(1.2, 0.72, 2.2, 0xd97706, { roughness: 0.65 });
      desk.position.set(cx + dir * 1.2, h1 + 0.6, cz + dtRow * 3.0);
      scene.add(desk);
    }
    var board = makeBox(0.1, 1.3, 3.6, 0x14532d, { roughness: 0.6 });
    board.position.set(backX + dir * 0.22, h1 + 1.85, cz);
    scene.add(board);

    if (opts.hasDoor) {
      // Paredes fisicas do terreo com vao da porta em [cz - 0.9 .. cz + 0.9]
      wallSegments.push({ x1: backX, z1: cz - d / 2, x2: backX, z2: cz + d / 2, halfThick: 0.25 });
      wallSegments.push({ x1: backX, z1: cz - d / 2, x2: frontX, z2: cz - d / 2, halfThick: 0.25 });
      wallSegments.push({ x1: backX, z1: cz + d / 2, x2: frontX, z2: cz + d / 2, halfThick: 0.25 });

      var halfSeg = (d / 2) - 0.95;
      var frontN = new THREE.Mesh(new THREE.BoxGeometry(0.16, h1, halfSeg), glassMat);
      frontN.position.set(frontX, h1 / 2 + 0.12, cz - 0.95 - halfSeg / 2);
      scene.add(frontN);
      wallSegments.push({ x1: frontX, z1: cz - d / 2, x2: frontX, z2: cz - 0.95, halfThick: 0.22 });

      var frontS = new THREE.Mesh(new THREE.BoxGeometry(0.16, h1, halfSeg), glassMat);
      frontS.position.set(frontX, h1 / 2 + 0.12, cz + 0.95 + halfSeg / 2);
      scene.add(frontS);
      wallSegments.push({ x1: frontX, z1: cz + 0.95, x2: frontX, z2: cz + d / 2, halfThick: 0.22 });

      // Porta articulada do Lab
      labDoorPivot = new THREE.Group();
      labDoorPivot.position.set(frontX, 0.12, cz - 0.95);
      var doorGlass = makeBox(0.1, 2.75, 1.85, 0x0f766e, { transparent: true, opacity: 0.65, roughness: 0.2 });
      doorGlass.position.set(0, 1.38, 0.92);
      var doorHandle = makeBox(0.18, 0.22, 0.08, 0xfbbf24, { metalness: 0.75 });
      doorHandle.position.set(dir * 0.08, 1.1, 1.6);
      labDoorPivot.add(doorGlass, doorHandle);
      scene.add(labDoorPivot);
    } else if (opts.openFront) {
      // Aberto na frente para entrar direto (Substratos / Estufa), colisao so nas 3 paredes
      wallSegments.push({ x1: backX, z1: cz - d / 2, x2: backX, z2: cz + d / 2, halfThick: 0.25 });
      wallSegments.push({ x1: backX, z1: cz - d / 2, x2: frontX, z2: cz - d / 2, halfThick: 0.25 });
      wallSegments.push({ x1: backX, z1: cz + d / 2, x2: frontX, z2: cz + d / 2, halfThick: 0.25 });
    } else {
      // Bloco envidracado fechado com interior visivel
      var lowerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, h1 - 0.4, d - 0.6), glassMat);
      lowerGlass.position.set(frontX, h1 / 2 + 0.12, cz);
      scene.add(lowerGlass);
      solidColliders.push({
        minX: cx - w / 2 - 0.2, maxX: cx + w / 2 + 0.2,
        minZ: cz - d / 2 - 0.2, maxZ: cz + d / 2 + 0.2,
        minY: 0, maxY: totalH + 1
      });
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
    // 14 degraus largos de z=-11.5 ate z=-19.0 (subindo de y=0 ate y=4.0)
    var steps = 14;
    var stepD = 7.5 / steps;
    var stepH = 4.0 / steps;
    for (var i = 0; i < steps; i++) {
      var sy = (i + 1) * stepH;
      var sz = -11.5 - (i + 0.5) * stepD;
      var step = makeBox(8.4, sy, stepD + 0.04, 0xcbd5e1, { roughness: 0.72 });
      step.position.set(0, sy / 2, sz);
      scene.add(step);
    }

    // Muretas laterais da escadaria
    [-4.35, 4.35].forEach(function (rx) {
      var railWall = makeBox(0.35, 2.6, 7.6, 0x64748b, { roughness: 0.6 });
      railWall.position.set(rx, 1.3, -15.25);
      scene.add(railWall);
      solidColliders.push({ minX: rx - 0.25, maxX: rx + 0.25, minZ: -19.1, maxZ: -11.4, minY: 0, maxY: 4.9 });
    });

    // Passarela / Ponte Elevada ligando x=-14.5..14.5 em y=4.0, z=-16.8..-14.0
    var bridge = makeBox(29.0, 0.34, 2.8, 0x475569, { roughness: 0.6 });
    bridge.position.set(0, 3.83, -15.4);
    scene.add(bridge);

    // Guarda-corpo de vidro da passarela (com abertura central na escadaria -4..4)
    [-1, 1].forEach(function (side) {
      var bx = side * 9.25;
      var railF = makeBox(10.5, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
      railF.position.set(bx, 4.52, -14.05);
      var railB = makeBox(10.5, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
      railB.position.set(bx, 4.52, -16.75);
      scene.add(railF, railB);
    });

    // Terraco Norte (y = 4.0, x: -24..24, z: -19.0..-36.0)
    var terrace = makeBox(48.0, 4.0, 17.0, 0x94a3b8, { roughness: 0.8 });
    terrace.position.set(0, 2.0, -27.5);
    scene.add(terrace);
  }

  function buildClockTowerAndAuditorium() {
    // Predio Principal ao fundo (z = -28..-35, base em y = 4.0)
    var baseY = 4.0;

    // Alas laterais simetricas da Reitoria
    [-9.5, 9.5].forEach(function (ax) {
      var wing = makeBox(11.0, 6.2, 6.4, brickMat(3, 2));
      wing.position.set(ax, baseY + 3.1, -31.0);
      scene.add(wing);
      var trim = makeBox(11.4, 0.45, 6.8, 0x64748b);
      trim.position.set(ax, baseY + 6.3, -31.0);
      scene.add(trim);
      var win = makeBox(8.5, 4.6, 0.14, 0xbae6fd, { transparent: true, opacity: 0.42 });
      win.position.set(ax, baseY + 3.1, -27.78);
      scene.add(win);
      solidColliders.push({ minX: ax - 5.6, maxX: ax + 5.6, minZ: -34.3, maxZ: -27.7, minY: baseY, maxY: baseY + 7 });
    });

    // Torre Central do Relogio
    var tower = makeBox(5.6, 12.6, 6.8, 0x64748b, { roughness: 0.55 });
    tower.position.set(0, baseY + 6.3, -31.0);
    scene.add(tower);
    var towerGlass = makeBox(3.4, 7.6, 0.18, 0xbae6fd, { transparent: true, opacity: 0.45 });
    towerGlass.position.set(0, baseY + 4.4, -27.55);
    scene.add(towerGlass);
    solidColliders.push({ minX: -2.9, maxX: 2.9, minZ: -34.5, maxZ: -27.5, minY: baseY, maxY: baseY + 13 });

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
    clockMesh.position.set(0, baseY + 10.4, -27.5);
    scene.add(clockMesh);

    // Banners da Reitoria
    createBanner(-4.6, baseY + 4.0, -27.6, 0, '#1d4ed8', '🎓');
    createBanner(4.6, baseY + 4.0, -27.6, 0, '#4338ca', '🍄');

    // Telao Interativo Principal no Terraco (frente a Torre do Relogio, visivel de toda a praca)
    auditoriumCanvas = document.createElement('canvas');
    auditoriumCanvas.width = 1024;
    auditoriumCanvas.height = 576;
    auditoriumCtx = auditoriumCanvas.getContext('2d');
    auditoriumTex = new THREE.CanvasTexture(auditoriumCanvas);

    var frameMain = makeBox(6.8, 3.9, 0.25, 0x0f172a, { roughness: 0.4 });
    frameMain.position.set(0, baseY + 2.4, -26.8);
    scene.add(frameMain);

    var screenMain = new THREE.Mesh(
      new THREE.PlaneGeometry(6.3, 3.5),
      new THREE.MeshBasicMaterial({ map: auditoriumTex })
    );
    screenMain.position.set(0, baseY + 2.4, -26.64);
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

    addScreenButtons3D(0, baseY + 0.25, -26.55, 0);
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
    // Bloco Oeste-Norte (z: -13..-1): LABORATORIO DE FLUXO LAMINAR & AUTOCLAVE (com porta articulada)
    buildCampusBuildingWing({ cx: -19, cz: -7, width: 10, depth: 11.6, faceDir: 1, hasDoor: true, style: 'brick' });
    // Bloco Oeste-Sul (z: 2.2..13.8): Salas de Aula
    buildCampusBuildingWing({ cx: -19, cz: 8, width: 10, depth: 11.6, faceDir: 1, hasDoor: false, style: 'brick' });

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
    // Bloco Leste-Norte (z: -13..-1): SUBSTRATOS & PASTEURIZACAO (aberto no terreo)
    buildCampusBuildingWing({ cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, openFront: true, style: 'brick' });
    // Bloco Leste-Sul (z: 2.2..13.8): ESTUFA DE FRUTIFICACAO (aberto no terreo, madeira ripada)
    buildCampusBuildingWing({ cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, openFront: true, style: 'wood' });

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

  // ---------------- Colisao & Posicionamento de Itens ----------------

  function clampPosAgainstWalls(pos, radius) {
    for (var i = 0; i < wallSegments.length; i++) {
      var w = wallSegments[i];
      if (pos.y > 3.6) continue;
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
    pos.x = Math.max(-95, Math.min(95, pos.x));
    pos.z = Math.max(-95, Math.min(95, pos.z));
  }

  function createPlacementGhost() {
    var geo = new THREE.CylinderGeometry(0.28, 0.28, 0.14, 18);
    var mat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45, depthWrite: false });
    placementGhost = new THREE.Mesh(geo, mat);
    placementGhost.visible = false;
    scene.add(placementGhost);
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
    g.add(leftLeg, rightLeg, torso);

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
      group: g, leftLeg: leftLeg, rightLeg: rightLeg, headGroup: headGroup,
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
      } else {
        av.leftLeg.rotation.x *= 0.8;
        av.rightLeg.rotation.x *= 0.8;
      }
    });
  }

  // ---------------- Interacoes & Tour ----------------

  function handlePrimaryAction() {
    if (heldItem) {
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
      var pt = findPlacementTarget();
      placementValid = !isPlacementBlocked(pt);
      placementGhost.position.copy(pt);
      placementGhost.material.color.setHex(placementValid ? 0x10b981 : 0xef4444);
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
    var cycle = tourTime % 30;
    var camPos = new THREE.Vector3();
    var lookAt = new THREE.Vector3();

    if (cycle < 10) {
      // Vista panoramica da praca igual a foto de referencia
      var t0 = cycle / 10;
      camPos.set(-10 + t0 * 20, 12.5 - Math.sin(t0 * Math.PI) * 2.5, 22 - t0 * 3);
      lookAt.set(0, 4.5, -14);
    } else if (cycle < 20) {
      // Voo baixo sobre a fonte do cogumelo em direcao a escadaria e torre do relogio
      var t1 = (cycle - 10) / 10;
      camPos.set(Math.sin(t1 * Math.PI) * 5, 5.5 + t1 * 3.5, 14 - t1 * 22);
      lookAt.set(0, 7.5, -30);
    } else {
      // Passagem pelas alas de tijolo e vidro
      var t2 = (cycle - 20) / 10;
      camPos.set(11 - t2 * 22, 8.0, -4 + Math.sin(t2 * Math.PI) * 8);
      lookAt.set(0, 2.5, 2);
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
      handlePrimaryAction();
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
      camera.rotation.order = 'YXZ';
      camera.rotation.y = playerYaw;
      camera.rotation.x = playerPitch;
      camera.rotation.z = 0;

      if (heldItem) {
        var handPos = new THREE.Vector3(0.32, -0.26, -0.68).applyEuler(camera.rotation).add(camera.position);
        heldItem.mesh.position.copy(handPos);
        heldItem.mesh.rotation.y = heldRotY;
      }
    } else {
      isWalking = false;
      controls.update();
    }

    if (!lobbyTourActive) updateHoverRay();
    dropUnsupportedItems();
    stepMultiplayerAvatars(dt);
    renderer.render(scene, camera);
  }

  // ---------------- Inicializacao & API Publica ----------------

  window.initCampus3D = function (containerId, cbs) {
    callbacks = Object.assign(callbacks, cbs || {});
    var container = document.getElementById(containerId);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.0058);

    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 260);
    camera.position.set(-10, 12.5, 22);

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
    sun.position.set(28, 42, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);

    clock = new THREE.Clock();
    createProceduralTextures();
    buildNatureWorld();
    buildPlaza();
    buildStaircaseAndBridge();
    buildClockTowerAndAuditorium();
    buildCampusWingsAndEquipment();
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

  window.updateCampusAuditoriumSlide = updateCampusAuditoriumSlide;
  window.updateCampusPlayers = updateCampusPlayers;
})();
