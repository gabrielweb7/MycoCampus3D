/**
 * MycoCampus3D — Motor 3D da Universidade do Cultivo de Cogumelos
 * Three.js r128 | Mapa Amplo 220x220 | 4 Alas Universitárias + Trilhas + Plaquinhas | Tour Cinemático no Lobby
 */
(function () {
  'use strict';

  var scene, camera, renderer, controls, clock;
  var raycaster = new THREE.Raycaster();
  var pointerNdc = new THREE.Vector2(0, 0);

  // World & collision data
  var terrainMesh = null;
  var solidColliders = [];      // { minX, maxX, minZ, maxZ, minY, maxY }
  var wallSegments = [];        // { x1, z1, x2, z2, halfThick }
  var supportSurfaces = [];     // { minX, maxX, minZ, maxZ, topY }
  var pickableItems = [];       // { id, label, mesh, homePos, homeRy, radius, height, isMoved }
  var wildMushrooms = [];       // { id, group, capMesh, active, respawnAt }

  // Interactive doors & auditorium
  var labDoorPivot = null;
  var labDoorOpen = false;
  var labDoorAngle = 0;
  var auditoriumScreenMesh = null;
  var auditoriumCanvas = null;
  var auditoriumCtx = null;
  var auditoriumTex = null;

  // Player & movement state
  var lobbyTourActive = true;
  var tourTime = 0;
  var inFps = false;
  var playerPos = new THREE.Vector3(0, 0, 10.5);
  var playerVelY = 0;
  var playerYaw = 0;
  var playerPitch = 0;
  var onGround = true;
  var isWalking = false;
  var keys = {};
  var joyX = 0, joyY = 0;
  var PLAYER_EYE = 1.62;
  var PLAYER_RADIUS = 0.38;

  // Held item & placement ghost
  var heldItem = null;
  var heldRotY = 0;
  var hoveredPickable = null;
  var hoveredMushroom = null;
  var hoveredDoor = false;
  var hoveredScreen = false;
  var placementGhost = null;
  var placementValid = false;
  var pendingMovedItems = {};

  // Multiplayer avatars
  var remoteAvatars = {};

  var callbacks = {
    onHarvestMushroom: null,
    onOpenLessons: null,
    onHoldChange: null,
    onFpsChange: null,
    onHoverPrompt: null
  };

  function isTouchDevice() {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var hasTouch = (navigator.maxTouchPoints || 0) > 0 && window.innerWidth <= 1180;
    return coarse || hasTouch;
  }

  function isOnCampusPath(x, z) {
    // Central Plaza circle
    if (Math.hypot(x, z) < 7.5) return true;
    // East-West avenue (Lab <-> Plaza <-> Auditorium)
    if (Math.abs(z) < 2.2 && x >= -20 && x <= 20) return true;
    // North-South avenue (Substratos <-> Plaza <-> Estufa)
    if (Math.abs(x) < 2.2 && z >= -22 && z <= 20) return true;
    // Forest trail to Alpine Lake (from (2, -14) to (26, -34))
    var t = ((x - 2) * 24 + (z + 14) * -20) / (24 * 24 + 20 * 20);
    if (t >= 0 && t <= 1) {
      var px = 2 + t * 24;
      var pz = -14 - t * 20;
      if (Math.hypot(x - px, z - pz) < 1.8) return true;
    }
    return false;
  }

  function terrainHeight(x, z) {
    // Flat central campus plateau (-28..28, -28..26)
    var distCenter = Math.max(Math.abs(x) - 27, Math.abs(z) - 26);
    if (distCenter <= 0) return 0;
    var blend = Math.min(1, distCenter / 14);

    // Alpine Lake depression at (28, -38)
    var dxLake = (x - 28) / 13.5;
    var dzLake = (z + 38) / 10.5;
    var lakeDist = Math.sqrt(dxLake * dxLake + dzLake * dzLake);
    var lakeDrop = lakeDist < 1 ? -1.45 * (1 - lakeDist * lakeDist) : 0;

    var hills = Math.sin(x * 0.055) * Math.cos(z * 0.055) * 2.2 + Math.sin(x * 0.14 + z * 0.11) * 0.55;
    return blend * hills + lakeDrop;
  }

  function getGroundHeight(x, z) {
    var h = terrainHeight(x, z);
    // Lab floor slab (-23..-13, -4..4)
    if (x >= -23.2 && x <= -12.8 && z >= -4.2 && z <= 4.2) h = Math.max(h, 0.12);
    // Auditorium stage (19.5..24.5, -5..5)
    if (x >= 19.5 && x <= 24.5 && z >= -5.0 && z <= 5.0) h = Math.max(h, 0.34);
    // Substratos building (-5..5, -24..-17)
    if (x >= -5.2 && x <= 5.2 && z >= -24.2 && z <= -16.8) h = Math.max(h, 0.12);
    // Estufa building (-5..5, 15..22)
    if (x >= -5.2 && x <= 5.2 && z >= 14.8 && z <= 22.2) h = Math.max(h, 0.12);
    return h;
  }

  function makeBox(w, h, d, color, opts) {
    opts = opts || {};
    var geo = new THREE.BoxGeometry(w, h, d);
    var mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness !== undefined ? opts.roughness : 0.72,
      metalness: opts.metalness !== undefined ? opts.metalness : 0.08,
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

  function createSignpost(x, z, rotY, lines) {
    var group = new THREE.Group();
    group.position.set(x, getGroundHeight(x, z), z);
    group.rotation.y = rotY;

    var post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
    );
    post.position.y = 1.1;
    post.castShadow = true;
    group.add(post);

    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 240);

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach(function (txt, idx) {
      ctx.font = idx === 0 ? 'bold 34px system-ui, sans-serif' : '26px system-ui, sans-serif';
      ctx.fillStyle = idx === 0 ? '#34d399' : '#e2e8f0';
      var yPos = lines.length === 1 ? 128 : (64 + idx * 62);
      ctx.fillText(txt, 256, yPos);
    });

    var tex = new THREE.CanvasTexture(canvas);
    var board = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.88, 0.1),
      [
        new THREE.MeshStandardMaterial({ color: 0x78350f }),
        new THREE.MeshStandardMaterial({ color: 0x78350f }),
        new THREE.MeshStandardMaterial({ color: 0x78350f }),
        new THREE.MeshStandardMaterial({ color: 0x78350f }),
        new THREE.MeshBasicMaterial({ map: tex }),
        new THREE.MeshBasicMaterial({ map: tex })
      ]
    );
    board.position.y = 1.9;
    board.castShadow = true;
    group.add(board);

    scene.add(group);
    solidColliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, minY: 0, maxY: 2.5 });
  }

  function createCampusLamp(x, z) {
    var g = new THREE.Group();
    var gy = getGroundHeight(x, z);
    g.position.set(x, gy, z);
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 })
    );
    pole.position.y = 1.6;
    pole.castShadow = true;
    g.add(pole);
    var bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.9 })
    );
    bulb.position.y = 3.25;
    g.add(bulb);
    scene.add(g);
  }

  function buildNatureWorld() {
    // Large 220x220m terrain
    var size = 220;
    var segs = 120;
    var geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = [];
    var cGrass = new THREE.Color(0x2d6a3e);
    var cGrassAlt = new THREE.Color(0x3a7d44);
    var cPath = new THREE.Color(0x64748b);
    var cSand = new THREE.Color(0xcbd5e1);

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var y = terrainHeight(x, z);
      pos.setY(i, y);

      var col = ((Math.sin(x * 0.15) + Math.cos(z * 0.15)) > 0 ? cGrass : cGrassAlt).clone();
      if (isOnCampusPath(x, z)) {
        col.lerp(cPath, 0.85);
      } else if (y < -0.18) {
        col.lerp(cSand, 0.7);
      }
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
    terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Alpine Lake at (28, -38)
    var waterGeo = new THREE.CircleGeometry(12.2, 36);
    waterGeo.rotateX(-Math.PI / 2);
    var waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.12,
      metalness: 0.3,
      transparent: true,
      opacity: 0.82
    });
    var water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(28, -0.25, -38);
    scene.add(water);

    // Wooden Pier at the Lake
    var pier = makeBox(2.4, 0.18, 6.0, 0x92400e, { roughness: 0.8 });
    pier.position.set(22.5, 0.12, -31.5);
    pier.rotation.y = -0.65;
    scene.add(pier);

    // Pine & Broadleaf Forest Ring (48 trees)
    var treeCoords = [
      [-32, -26], [-38, -14], [-35, -2], [-34, 12], [-28, 25], [-16, 31], [-2, 34], [14, 32],
      [28, 24], [36, 12], [38, -4], [35, -18], [44, -30], [42, -46], [26, -54], [10, -48],
      [-6, -42], [-22, -38], [-42, -36], [-48, -18], [-46, 8], [-44, 28], [-24, 44], [6, 48],
      [32, 42], [48, 20], [50, -8], [48, -22], [14, -28], [8, -35], [-14, -30], [-25, -15],
      [-28, 13], [-14, 24], [12, 22], [28, 12], [30, -14], [18, -22], [-38, 38], [38, 34],
      [-54, -4], [54, 4], [0, -56], [0, 56], [-56, -44], [56, -48], [-52, 46], [52, 46]
    ];
    treeCoords.forEach(function (tc, idx) {
      var tx = tc[0], tz = tc[1];
      var ty = terrainHeight(tx, tz);
      var tree = new THREE.Group();
      tree.position.set(tx, ty, tz);
      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.38, 2.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
      );
      trunk.position.y = 1.4;
      trunk.castShadow = true;
      tree.add(trunk);

      if (idx % 3 === 0) {
        // Broadleaf tree
        var crown = new THREE.Mesh(
          new THREE.DodecahedronGeometry(2.0, 1),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 })
        );
        crown.position.y = 3.6;
        crown.castShadow = true;
        tree.add(crown);
      } else {
        // Pine tree
        for (var k = 0; k < 3; k++) {
          var cone = new THREE.Mesh(
            new THREE.ConeGeometry(1.9 - k * 0.4, 2.4 - k * 0.2, 8),
            new THREE.MeshStandardMaterial({ color: k === 2 ? 0x15803d : 0x166534, roughness: 0.85 })
          );
          cone.position.y = 2.9 + k * 1.35;
          cone.castShadow = true;
          tree.add(cone);
        }
      }
      scene.add(tree);
      solidColliders.push({ minX: tx - 0.55, maxX: tx + 0.55, minZ: tz - 0.55, maxZ: tz + 0.55, minY: ty, maxY: ty + 4.5 });
    });

    // 20 Wild Harvestable Mushrooms scattered along trails & forest
    var mushCoords = [
      [-10, -10], [-25, -10], [-28, 6], [-12, 12], [11, 13], [26, 8],
      [25, -12], [10, -16], [16, -24], [21, -29], [36, -28], [40, -39],
      [19, -43], [-16, -26], [-32, -20], [-22, 22], [18, 25], [-8, 28],
      [8, -29], [-30, 18]
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
        new THREE.MeshStandardMaterial({
          color: capColor,
          roughness: 0.42,
          emissive: capColor,
          emissiveIntensity: 0.22
        })
      );
      cap.position.y = 0.36;
      cap.castShadow = true;
      g.add(cap);
      scene.add(g);
      wildMushrooms.push({
        id: 'wild_' + idx,
        group: g,
        capMesh: cap,
        active: true,
        respawnAt: 0
      });
    });
  }

  function buildPlaza() {
    // Monument in center (0, 0)
    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.8, 0.38, 24),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 })
    );
    base.position.set(0, 0.19, 0);
    base.receiveShadow = true;
    scene.add(base);

    var waterRing = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.15, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, transparent: true, opacity: 0.82 })
    );
    waterRing.position.set(0, 0.22, 0);
    scene.add(waterRing);

    var stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.62, 2.3, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.6 })
    );
    stem.position.set(0, 1.3, 0);
    stem.castShadow = true;
    scene.add(stem);

    var cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.75, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, emissive: 0x7f1d1d, emissiveIntensity: 0.25 })
    );
    cap.position.set(0, 2.35, 0);
    cap.castShadow = true;
    scene.add(cap);

    for (var s = 0; s < 7; s++) {
      var ang = (s / 7) * Math.PI * 2;
      var spot = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      );
      spot.position.set(Math.cos(ang) * 1.18, 2.9, Math.sin(ang) * 1.18);
      scene.add(spot);
    }
    solidColliders.push({ minX: -2.6, maxX: 2.6, minZ: -2.6, maxZ: 2.6, minY: 0, maxY: 3.8 });

    // Campus Lamps along avenues
    createCampusLamp(-6, -3);
    createCampusLamp(-6, 3);
    createCampusLamp(6, -3);
    createCampusLamp(6, 3);
    createCampusLamp(-3, -10);
    createCampusLamp(3, 10);

    // Directional Campus Signposts!
    createSignpost(-4.5, 4.5, 0.78, ['🗺️ MYCOCAMPUS 3D', '⬅ Lab Fluxo Laminar', '➡ Auditório • ⬇ Estufas']);
    createSignpost(4.5, -4.5, -2.35, ['🌲 TRILHAS & AULAS', '⬆ Substratos & Pasteurização', '↗ Lago Alpino (Cogus)']);
  }

  function registerPickable(id, label, mesh, x, y, z, ry, radius, height) {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry || 0;
    scene.add(mesh);
    pickableItems.push({
      id: id,
      label: label,
      mesh: mesh,
      homePos: new THREE.Vector3(x, y, z),
      homeRy: ry || 0,
      radius: radius || 0.28,
      height: height || 0.4,
      isMoved: false
    });
  }

  function buildMycoLab() {
    // Wing 1: Lab centered at x = -18, z = 0 (10m x 8m: x=-23..-13, z=-4..4)
    var floor = makeBox(10.2, 0.12, 8.2, 0x334155, { roughness: 0.65 });
    floor.position.set(-18, 0.06, 0);
    scene.add(floor);

    var wallH = 3.4;
    var backWall = makeBox(0.22, wallH, 8.0, 0xe2e8f0, { roughness: 0.5 });
    backWall.position.set(-23, wallH / 2 + 0.12, 0);
    scene.add(backWall);
    wallSegments.push({ x1: -23, z1: -4, x2: -23, z2: 4, halfThick: 0.25 });

    var northWall = makeBox(10.0, wallH, 0.18, 0xbae6fd, { transparent: true, opacity: 0.35, roughness: 0.15 });
    northWall.position.set(-18, wallH / 2 + 0.12, -4);
    scene.add(northWall);
    wallSegments.push({ x1: -23, z1: -4, x2: -13, z2: -4, halfThick: 0.25 });

    var southWall = makeBox(10.0, wallH, 0.18, 0xbae6fd, { transparent: true, opacity: 0.35, roughness: 0.15 });
    southWall.position.set(-18, wallH / 2 + 0.12, 4);
    scene.add(southWall);
    wallSegments.push({ x1: -23, z1: 4, x2: -13, z2: 4, halfThick: 0.25 });

    // Front wall (x = -13) with doorway gap z = -0.9..0.9
    var frontN = makeBox(0.22, wallH, 3.1, 0xe2e8f0);
    frontN.position.set(-13, wallH / 2 + 0.12, -2.45);
    scene.add(frontN);
    wallSegments.push({ x1: -13, z1: -4, x2: -13, z2: -0.9, halfThick: 0.25 });

    var frontS = makeBox(0.22, wallH, 3.1, 0xe2e8f0);
    frontS.position.set(-13, wallH / 2 + 0.12, 2.45);
    scene.add(frontS);
    wallSegments.push({ x1: -13, z1: 0.9, x2: -13, z2: 4, halfThick: 0.25 });

    // Swinging Lab Door
    labDoorPivot = new THREE.Group();
    labDoorPivot.position.set(-13, 0.12, -0.9);
    var doorPanel = makeBox(0.12, 2.55, 1.75, 0x0f766e, { roughness: 0.45 });
    doorPanel.position.set(0, 1.275, 0.88);
    var doorHandle = makeBox(0.18, 0.14, 0.08, 0xfbbf24, { metalness: 0.7, roughness: 0.25 });
    doorHandle.position.set(0.08, 1.05, 1.55);
    labDoorPivot.add(doorPanel);
    labDoorPivot.add(doorHandle);
    scene.add(labDoorPivot);

    var roof = makeBox(10.4, 0.16, 8.4, 0x1e293b, { transparent: true, opacity: 0.82 });
    roof.position.set(-18, wallH + 0.18, 0);
    scene.add(roof);

    createSignpost(-12.2, -2.2, Math.PI / 2, ['🔬 LABORATÓRIO', 'Fluxo Laminar & Autoclave']);

    // 1. Laminar Flow Hood at (-21.4, -2.1)
    var hoodBase = makeBox(1.5, 0.9, 2.4, 0xf1f5f9, { roughness: 0.4 });
    hoodBase.position.set(-21.4, 0.12 + 0.45, -2.1);
    scene.add(hoodBase);
    var hoodTop = makeBox(1.4, 1.15, 2.3, 0x94a3b8, { transparent: true, opacity: 0.35 });
    hoodTop.position.set(-21.4, 0.12 + 1.48, -2.1);
    scene.add(hoodTop);
    var hepa = makeBox(0.15, 0.95, 2.1, 0xecfeff, { emissive: 0x38bdf8, emissiveIntensity: 0.5 });
    hepa.position.set(-22.0, 0.12 + 1.42, -2.1);
    scene.add(hepa);
    solidColliders.push({ minX: -22.2, maxX: -20.6, minZ: -3.35, maxZ: -0.85, minY: 0.12, maxY: 2.3 });
    supportSurfaces.push({ minX: -22.0, maxX: -20.7, minZ: -3.2, maxZ: -1.0, topY: 1.02 });

    // 2. Autoclave / Sterilization Bench at (-21.4, 2.1)
    var autoBench = makeBox(1.5, 0.85, 2.2, 0x475569, { roughness: 0.5 });
    autoBench.position.set(-21.4, 0.12 + 0.425, 2.1);
    scene.add(autoBench);
    var autoclave = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.95, 16),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.78, roughness: 0.25 })
    );
    autoclave.position.set(-21.5, 0.12 + 0.85 + 0.47, 2.35);
    autoclave.castShadow = true;
    scene.add(autoclave);
    solidColliders.push({ minX: -22.2, maxX: -20.6, minZ: 0.95, maxZ: 3.25, minY: 0.12, maxY: 2.1 });
    supportSurfaces.push({ minX: -22.0, maxX: -20.7, minZ: 1.05, maxZ: 1.85, topY: 0.97 });

    // 3. Culture Shelf at (-15.5, 2.4)
    var shelfLow = makeBox(2.2, 0.08, 1.0, 0x92400e);
    shelfLow.position.set(-15.5, 0.12 + 0.75, 2.4);
    scene.add(shelfLow);
    supportSurfaces.push({ minX: -16.55, maxX: -14.45, minZ: 1.92, maxZ: 2.88, topY: 0.91 });
    solidColliders.push({ minX: -16.6, maxX: -14.4, minZ: 1.9, maxZ: 2.9, minY: 0.12, maxY: 1.8 });

    // Pickable Lab Items
    var petri1 = new THREE.Group();
    var petriDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.2 })
    );
    petriDisk.position.y = 0.03;
    petri1.add(petriDisk);
    registerPickable('petri_clean', 'Placa de Petri (Micélio Saudável)', petri1, -21.2, 1.02, -2.5, 0, 0.22, 0.1);

    var petri2 = new THREE.Group();
    var petriContam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.35 })
    );
    petriContam.position.y = 0.03;
    petri2.add(petriContam);
    registerPickable('petri_contam', 'Placa Contaminada (Tricoderma)', petri2, -21.2, 1.02, -1.6, 0, 0.22, 0.1);

    var spawnJar = new THREE.Group();
    var jarGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.34, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.3 })
    );
    jarGlass.position.y = 0.17;
    var jarLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 })
    );
    jarLid.position.y = 0.36;
    spawnJar.add(jarGlass);
    spawnJar.add(jarLid);
    registerPickable('spawn_jar', 'Pote de Spawn de Grãos', spawnJar, -21.2, 0.97, 1.35, 0, 0.22, 0.4);

    var lcFlask = new THREE.Group();
    var lcBody = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.32, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
    );
    lcBody.position.y = 0.16;
    lcFlask.add(lcBody);
    registerPickable('liquid_culture', 'Cultura Líquida (CL)', lcFlask, -15.5, 0.91, 2.4, 0, 0.2, 0.35);
  }

  function buildSubstratosHall() {
    // Wing 2 (North): Galpão de Substratos & Pasteurização at (0, -20.5)
    var floor = makeBox(10.4, 0.12, 7.4, 0x475569, { roughness: 0.75 });
    floor.position.set(0, 0.06, -20.5);
    scene.add(floor);

    var pillarCoords = [[-4.8, -23.8], [4.8, -23.8], [-4.8, -17.2], [4.8, -17.2]];
    pillarCoords.forEach(function (pc) {
      var p = makeBox(0.32, 3.2, 0.32, 0x78350f);
      p.position.set(pc[0], 1.72, pc[1]);
      scene.add(p);
      solidColliders.push({ minX: pc[0] - 0.25, maxX: pc[0] + 0.25, minZ: pc[1] - 0.25, maxZ: pc[1] + 0.25, minY: 0.12, maxY: 3.3 });
    });

    var roof = makeBox(10.8, 0.18, 7.8, 0x334155, { transparent: true, opacity: 0.88 });
    roof.position.set(0, 3.4, -20.5);
    scene.add(roof);

    createSignpost(-3.8, -16.4, 0, ['🧪 SUBSTRATOS', 'Pasteurização & Bulk']);

    // Pasteurizer Steam Drum
    var drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 1.35, 18),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.5, roughness: 0.35 })
    );
    drum.position.set(-3.2, 0.12 + 0.675, -22.2);
    drum.castShadow = true;
    scene.add(drum);
    solidColliders.push({ minX: -4.0, maxX: -2.4, minZ: -23.0, maxZ: -21.4, minY: 0.12, maxY: 1.6 });

    // Bulk Mixing Bench
    var bench = makeBox(3.4, 0.82, 1.5, 0x92400e, { roughness: 0.75 });
    bench.position.set(1.5, 0.12 + 0.41, -22.0);
    scene.add(bench);
    solidColliders.push({ minX: -0.2, maxX: 3.2, minZ: -22.8, maxZ: -21.2, minY: 0.12, maxY: 1.1 });
    supportSurfaces.push({ minX: -0.1, maxX: 3.1, minZ: -22.7, maxZ: -21.3, topY: 0.94 });

    // Pickable Substrate Bag
    var subBag = new THREE.Group();
    var bagMesh = makeBox(0.38, 0.44, 0.28, 0xd6d3d1, { roughness: 0.85 });
    bagMesh.position.y = 0.22;
    subBag.add(bagMesh);
    registerPickable('substrate_bag', 'Saco de Substrato Pasteurizado', subBag, 1.5, 0.94, -22.0, 0, 0.28, 0.46);
  }

  function buildGreenhouse() {
    // Wing 3 (South): Estufa de Frutificação & Secagem at (0, 18.5)
    var floor = makeBox(10.4, 0.12, 7.4, 0x334155, { roughness: 0.65 });
    floor.position.set(0, 0.06, 18.5);
    scene.add(floor);

    var glassRoof = makeBox(10.2, 0.12, 7.2, 0x6ee7b7, { transparent: true, opacity: 0.35 });
    glassRoof.position.set(0, 3.3, 18.5);
    scene.add(glassRoof);

    var gPillars = [[-4.8, 15.2], [4.8, 15.2], [-4.8, 21.8], [4.8, 21.8]];
    gPillars.forEach(function (pc) {
      var p = makeBox(0.24, 3.15, 0.24, 0x059669);
      p.position.set(pc[0], 1.7, pc[1]);
      scene.add(p);
      solidColliders.push({ minX: pc[0] - 0.2, maxX: pc[0] + 0.2, minZ: pc[1] - 0.2, maxZ: pc[1] + 0.2, minY: 0.12, maxY: 3.3 });
    });

    createSignpost(3.8, 14.5, Math.PI, ['🍄 ESTUFAS DE FRUTIFICAÇÃO', 'Umidade 90% • FAE • Luz']);

    // Fruiting Bench + LED Grow Bar
    var rack = makeBox(4.2, 0.72, 1.6, 0x1e293b);
    rack.position.set(-1.5, 0.12 + 0.36, 19.5);
    scene.add(rack);
    var ledBar = makeBox(3.8, 0.08, 0.28, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.9 });
    ledBar.position.set(-1.5, 2.45, 19.5);
    scene.add(ledBar);
    solidColliders.push({ minX: -3.65, maxX: 0.65, minZ: 18.65, maxZ: 20.35, minY: 0.12, maxY: 1.0 });
    supportSurfaces.push({ minX: -3.55, maxX: 0.55, minZ: 18.75, maxZ: 20.25, topY: 0.84 });

    // Pickable Fruiting Block inside Greenhouse
    var mushBlock = new THREE.Group();
    var subBlock = makeBox(0.38, 0.28, 0.28, 0xf5f5f4);
    subBlock.position.y = 0.14;
    mushBlock.add(subBlock);
    for (var m = -1; m <= 1; m++) {
      var miniStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.16, 8),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7 })
      );
      miniStem.position.set(m * 0.11, 0.35, 0);
      var miniCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0xd97706 })
      );
      miniCap.position.set(m * 0.11, 0.43, 0);
      mushBlock.add(miniStem);
      mushBlock.add(miniCap);
    }
    registerPickable('fruiting_block', 'Bloco em Frutificação (Ostra/Juba)', mushBlock, -1.5, 0.84, 19.5, 0, 0.26, 0.48);
  }

  function buildAuditorium() {
    // Wing 4 (East): Open Amphitheater at x = 14..24, z = -5..5
    var stage = makeBox(4.4, 0.34, 9.2, 0x475569, { roughness: 0.7 });
    stage.position.set(22.0, 0.17, 0);
    scene.add(stage);

    var frame = makeBox(0.32, 3.6, 6.4, 0x0f172a, { roughness: 0.4 });
    frame.position.set(23.5, 2.3, 0);
    scene.add(frame);
    solidColliders.push({ minX: 23.0, maxX: 24.0, minZ: -3.3, maxZ: 3.3, minY: 0, maxY: 4.1 });

    auditoriumCanvas = document.createElement('canvas');
    auditoriumCanvas.width = 1024;
    auditoriumCanvas.height = 576;
    auditoriumCtx = auditoriumCanvas.getContext('2d');
    auditoriumTex = new THREE.CanvasTexture(auditoriumCanvas);

    auditoriumScreenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6.0, 3.35),
      new THREE.MeshBasicMaterial({ map: auditoriumTex })
    );
    auditoriumScreenMesh.position.set(23.3, 2.3, 0);
    auditoriumScreenMesh.rotation.y = -Math.PI / 2;
    scene.add(auditoriumScreenMesh);

    createSignpost(12.2, -3.5, -Math.PI / 2, ['🎓 AUDITÓRIO PRINCIPAL', 'Aulas ao Vivo & Módulos']);

    var benchX = [18.0, 16.2, 14.4];
    benchX.forEach(function (bx, idx) {
      var bench = makeBox(0.8, 0.44, 7.2, 0x92400e, { roughness: 0.75 });
      bench.position.set(bx, 0.22 + idx * 0.1, 0);
      scene.add(bench);
      solidColliders.push({ minX: bx - 0.45, maxX: bx + 0.45, minZ: -3.6, maxZ: 3.6, minY: 0, maxY: 0.8 });
    });

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
      ctx.fillText('👨‍🏫 Ao vivo: ' + presenter, 680, 72);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(title || '', 48, 150);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(subtitle || '', 48, 198);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '30px system-ui, sans-serif';
    (bullets || []).forEach(function (line, i) {
      ctx.fillText(line, 60, 275 + i * 68);
    });

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('💡 Clique no telão ou abra "Aulas" para praticar e ganhar XP no MySQL!', 48, 520);

    auditoriumTex.needsUpdate = true;
  }

  function clampPosAgainstWalls(pos, radius) {
    for (var i = 0; i < wallSegments.length; i++) {
      var w = wallSegments[i];
      var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      var len2 = vx * vx + vz * vz;
      if (len2 === 0) continue;
      var t = Math.max(0, Math.min(1, ((pos.x - w.x1) * vx + (pos.z - w.z1) * vz) / len2));
      var cx = w.x1 + t * vx;
      var cz = w.z1 + t * vz;
      var dx = pos.x - cx, dz = pos.z - cz;
      var dist = Math.hypot(dx, dz);
      var minD = radius + w.halfThick;
      if (dist < minD) {
        if (dist < 0.0001) { dx = 1; dz = 0; dist = 1; }
        pos.x = cx + (dx / dist) * minD;
        pos.z = cz + (dz / dist) * minD;
      }
    }
    if (!labDoorOpen && pos.z > -0.95 && pos.z < 0.95 && Math.abs(pos.x - (-13)) < radius + 0.16) {
      pos.x = pos.x >= -13 ? -13 + radius + 0.16 : -13 - radius - 0.16;
    }
    for (var j = 0; j < solidColliders.length; j++) {
      var c = solidColliders[j];
      if (pos.y > c.maxY - 0.1) continue;
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
      var gh = getGroundHeight(p.x, p.z);
      if (p.y <= gh + 0.15) {
        bestPt = new THREE.Vector3(p.x, gh, p.z);
        break;
      }
    }
    if (!bestPt) {
      var fwd = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
      var fx = playerPos.x + fwd.x * 1.4;
      var fz = playerPos.z + fwd.z * 1.4;
      bestPt = new THREE.Vector3(fx, getGroundHeight(fx, fz), fz);
    }
    return bestPt;
  }

  function isPlacementBlocked(pt) {
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
      if (heldItem === item) return;
      var supportedY = getGroundHeight(item.mesh.position.x, item.mesh.position.z);
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

  function buildCuteAvatar(data) {
    var g = new THREE.Group();
    var hatColor = new THREE.Color(data.hat_color || '#d9534f');
    var bodyColor = new THREE.Color(data.body_color || '#4f46e5');

    var bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
    var hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.45 });

    var leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), bodyMat);
    leftLeg.position.set(-0.1, 0.19, 0);
    g.add(leftLeg);

    var rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.38, 0.14), bodyMat);
    rightLeg.position.set(0.1, 0.19, 0);
    g.add(rightLeg);

    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26), bodyMat);
    torso.position.set(0, 0.64, 0);
    torso.castShadow = true;
    g.add(torso);

    var headGroup = new THREE.Group();
    headGroup.position.set(0, 1.05, 0);

    var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.34), skinMat);
    head.position.set(0, 0.1, 0);
    head.castShadow = true;
    headGroup.add(head);

    var hat = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hatMat
    );
    hat.position.set(0, 0.25, 0);
    hat.castShadow = true;
    headGroup.add(hat);

    if (data.role === 'professor' || data.role === 'admin') {
      var crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.035, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.45, metalness: 0.8 })
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.set(0, 0.56, 0);
      headGroup.add(crown);
    }

    g.add(headGroup);

    var labelSprite = makeTextSprite((data.role === 'professor' ? '👨‍🏫 ' : '') + (data.name || 'Aluno'), data.role === 'professor' ? '#fbbf24' : '#ffffff');
    labelSprite.position.set(0, 1.85, 0);
    g.add(labelSprite);

    var chatSprite = makeTextSprite('', '#34d399');
    chatSprite.position.set(0, 2.25, 0);
    chatSprite.visible = false;
    g.add(chatSprite);

    scene.add(g);
    return {
      group: g,
      leftLeg: leftLeg,
      rightLeg: rightLeg,
      headGroup: headGroup,
      labelSprite: labelSprite,
      chatSprite: chatSprite,
      lastChat: '',
      targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      targetYaw: data.yaw || 0,
      targetPitch: data.pitch || 0,
      walking: false,
      walkPhase: 0
    };
  }

  function makeTextSprite(text, colorHex) {
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
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
    if (!text) {
      tex.needsUpdate = true;
      return;
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.beginPath();
    ctx.roundRect(16, 12, 480, 72, 24);
    ctx.fill();
    ctx.fillStyle = colorHex || '#ffffff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 30), 256, 48);
    tex.needsUpdate = true;
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
      av.targetYaw = p.yaw || 0;
      av.targetPitch = p.pitch || 0;
      av.walking = !!p.walking;

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
      av.group.rotation.y += (av.targetYaw - av.group.rotation.y) * Math.min(1, dt * 12);
      av.headGroup.rotation.x += (av.targetPitch - av.headGroup.rotation.x) * Math.min(1, dt * 12);
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
    var prompt = '';

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

    if (auditoriumScreenMesh) {
      var scrHits = raycaster.intersectObject(auditoriumScreenMesh, false);
      if (scrHits.length > 0 && scrHits[0].distance < 14) {
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
    var cycle = tourTime % 32;
    var camPos = new THREE.Vector3();
    var lookAt = new THREE.Vector3();

    if (cycle < 9) {
      // 360 smooth orbit around Central Plaza
      var a = (cycle / 9) * Math.PI * 2 * 0.45;
      camPos.set(Math.sin(a) * 18, 9.5 + Math.sin(cycle * 0.5) * 1.2, Math.cos(a) * 18);
      lookAt.set(0, 1.8, 0);
    } else if (cycle < 17) {
      // Smooth glide into & over the Mycology Lab
      var t1 = (cycle - 9) / 8;
      camPos.set(-10 - t1 * 7.5, 4.2 - Math.sin(t1 * Math.PI) * 1.6, 5.5 - t1 * 6.5);
      lookAt.set(-19.5, 1.4, -0.5);
    } else if (cycle < 25) {
      // Sweep across to the Auditorium & Telao
      var t2 = (cycle - 17) / 8;
      camPos.set(8 + t2 * 7.5, 5.5 - Math.sin(t2 * Math.PI) * 1.8, -6 + t2 * 10);
      lookAt.set(22.5, 2.2, 0);
    } else {
      // Scenic flight over Substratos, Estufas & Alpine Lake
      var t3 = (cycle - 25) / 7;
      camPos.set(16 - t3 * 22, 11.5, -18 - Math.sin(t3 * Math.PI) * 12);
      lookAt.set(8, 1.0, -24);
    }

    camera.position.lerp(camPos, Math.min(1, dt * 1.6));
    controls.target.lerp(lookAt, Math.min(1, dt * 2.0));
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
          lastTX = t.clientX;
          lastTY = t.clientY;
          touchMoved = false;
        }
      }
    }, { passive: true });

    renderer.domElement.addEventListener('touchmove', function (e) {
      if (!inFps) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          var dx = t.clientX - lastTX;
          var dy = t.clientY - lastTY;
          if (Math.hypot(dx, dy) > 4) touchMoved = true;
          playerYaw -= dx * 0.0045;
          playerPitch = Math.max(-1.35, Math.min(1.35, playerPitch - dy * 0.0045));
          lastTX = t.clientX;
          lastTY = t.clientY;
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

    wildMushrooms.forEach(function (wm) {
      if (!wm.active && now >= wm.respawnAt) {
        wm.active = true;
        wm.group.visible = true;
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
      isWalking = mag > 0.08;
      if (isWalking) {
        if (mag > 1) { moveX /= mag; moveZ /= mag; }
        var speed = (keys['ShiftLeft'] ? 7.8 : 5.2) * dt;
        var fwdX = -Math.sin(playerYaw), fwdZ = -Math.cos(playerYaw);
        var rightX = Math.cos(playerYaw), rightZ = -Math.sin(playerYaw);
        playerPos.x += (fwdX * moveZ + rightX * moveX) * speed;
        playerPos.z += (fwdZ * moveZ + rightZ * moveX) * speed;
        clampPosAgainstWalls(playerPos, PLAYER_RADIUS);
      }
      var groundY = getGroundHeight(playerPos.x, playerPos.z);
      playerVelY -= 16.5 * dt;
      playerPos.y += playerVelY * dt;
      if (playerPos.y <= groundY) {
        playerPos.y = groundY;
        playerVelY = 0;
        onGround = true;
      }
      camera.position.set(playerPos.x, playerPos.y + PLAYER_EYE, playerPos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = playerYaw;
      camera.rotation.x = playerPitch;

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

  window.initCampus3D = function (containerId, cbs) {
    callbacks = Object.assign(callbacks, cbs || {});
    var container = document.getElementById(containerId);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0xa5d8ff, 0.0075);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 240);
    camera.position.set(0, 10, 18);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 4;
    controls.maxDistance = 60;
    controls.target.set(0, 1.8, 0);

    var hemi = new THREE.HemisphereLight(0xe0f2fe, 0x3f6212, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfffbeb, 1.05);
    sun.position.set(24, 36, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);

    clock = new THREE.Clock();
    buildNatureWorld();
    buildPlaza();
    buildMycoLab();
    buildSubstratosHall();
    buildGreenhouse();
    buildAuditorium();
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
      playerPos.y = getGroundHeight(playerPos.x, playerPos.z);
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
    joyX = dx;
    joyY = dy;
  };

  window.getCampusPlayerPose = function () {
    return {
      x: playerPos.x,
      y: playerPos.y,
      z: playerPos.z,
      yaw: playerYaw,
      pitch: playerPitch,
      holding_item: heldItem ? heldItem.id : '',
      walking: isWalking,
      in_fps: inFps
    };
  };

  window.consumeCampusMovedItems = function () {
    var list = Object.values(pendingMovedItems);
    pendingMovedItems = {};
    return list;
  };

  window.applyCampusWorldObjects = function (objectsMap) {
    if (!objectsMap) return;
    pickableItems.forEach(function (item) {
      if (heldItem === item) return;
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
