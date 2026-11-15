/**
 * MycoCampus3D — Motor 3D da Universidade do Cultivo de Cogumelos
 * Three.js r128 | FPS + Orbit | Mobile Joystick + PC PointerLock | Pick & Stack + Ghosts | Multiplayer Avatars
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
  var supportSurfaces = [];     // { minX, maxX, minZ, maxZ, topY, mesh }
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
  var inFps = false;
  var playerPos = new THREE.Vector3(0, 0, 9.5);
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
  var remoteAvatars = {}; // id -> { group, leftLeg, rightLeg, headGroup, hatMesh, bodyMesh, labelSprite, chatSprite, lastChat, targetPos, targetYaw, targetPitch, walking, walkPhase }

  // Callbacks to campus-app.js
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

  function terrainHeight(x, z) {
    // Flat central campus (-18..18, -14..14) for clean Lab, Plaza & Auditorium
    var distCenter = Math.max(Math.abs(x) - 17, Math.abs(z) - 13);
    if (distCenter <= 0) return 0;
    var blend = Math.min(1, distCenter / 8);
    // Lake depression at x ~ 4, z ~ -21
    var dxLake = (x - 4) / 8.5;
    var dzLake = (z + 21) / 5.5;
    var lakeDist = Math.sqrt(dxLake * dxLake + dzLake * dzLake);
    var lakeDrop = lakeDist < 1 ? -1.15 * (1 - lakeDist * lakeDist) : 0;
    var hills = (Math.sin(x * 0.09) * Math.cos(z * 0.08) * 1.4 + Math.sin(x * 0.21 + z * 0.15) * 0.35);
    return blend * hills + lakeDrop;
  }

  function getGroundHeight(x, z) {
    var h = terrainHeight(x, z);
    // Lab floor slab
    if (x >= -14.1 && x <= -5.9 && z >= -3.6 && z <= 3.6) {
      h = Math.max(h, 0.12);
    }
    // Auditorium stage
    if (x >= 12.2 && x <= 15.8 && z >= -4.2 && z <= 4.2) {
      h = Math.max(h, 0.32);
    }
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

  function buildNatureWorld() {
    // Terrain mesh
    var size = 110;
    var segs = 90;
    var geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = [];
    var cGrass = new THREE.Color(0x2e6f40);
    var cPlaza = new THREE.Color(0x4b5563);
    var cSand = new THREE.Color(0x9ca3af);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var y = terrainHeight(x, z);
      pos.setY(i, y);
      var col = cGrass.clone();
      if (Math.hypot(x, z) < 6.2) {
        col.lerp(cPlaza, 0.78);
      } else if (y < -0.15) {
        col.lerp(cSand, 0.65);
      }
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 });
    terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Alpine Lake water plane
    var waterGeo = new THREE.CircleGeometry(7.8, 32);
    waterGeo.rotateX(-Math.PI / 2);
    var waterMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.78
    });
    var water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(4, -0.22, -21);
    scene.add(water);

    // Pine Trees around perimeter
    var treeCoords = [
      [-18, -12], [-22, -4], [-21, 7], [-16, 15], [-6, 17], [7, 17],
      [18, 13], [21, 3], [20, -10], [15, -17], [-10, -19], [-20, -20],
      [13, -24], [-3, -25], [-25, 14], [24, -18]
    ];
    treeCoords.forEach(function (tc) {
      var tx = tc[0], tz = tc[1];
      var ty = terrainHeight(tx, tz);
      var tree = new THREE.Group();
      tree.position.set(tx, ty, tz);
      var trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
      );
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      tree.add(trunk);
      for (var k = 0; k < 3; k++) {
        var cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.7 - k * 0.35, 2.2 - k * 0.2, 8),
          new THREE.MeshStandardMaterial({ color: k === 2 ? 0x15803d : 0x166534, roughness: 0.85 })
        );
        cone.position.y = 2.6 + k * 1.25;
        cone.castShadow = true;
        tree.add(cone);
      }
      scene.add(tree);
      solidColliders.push({ minX: tx - 0.5, maxX: tx + 0.5, minZ: tz - 0.5, maxZ: tz + 0.5, minY: ty, maxY: ty + 4 });
    });

    // Wild Harvestable Mushrooms in the forest & around the lake
    var mushCoords = [
      [-15, -10], [-18, 2], [-13, 12], [-2, 15], [11, 14],
      [16, -12], [9, -15], [-6, -16], [1, -13], [12, -21]
    ];
    var capColors = [0xef4444, 0xf59e0b, 0xa855f7, 0xec4899, 0x10b981];
    mushCoords.forEach(function (mc, idx) {
      var mx = mc[0], mz = mc[1];
      var my = terrainHeight(mx, mz);
      var g = new THREE.Group();
      g.position.set(mx, my, mz);
      var stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
      );
      stem.position.y = 0.17;
      g.add(stem);
      var capColor = capColors[idx % capColors.length];
      var cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({
          color: capColor,
          roughness: 0.45,
          emissive: capColor,
          emissiveIntensity: 0.18
        })
      );
      cap.position.y = 0.34;
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
    // Stone ring & Giant Mushroom Monument in center (0, 0)
    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 })
    );
    base.position.set(0, 0.175, 0);
    base.receiveShadow = true;
    scene.add(base);

    var waterRing = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 1.9, 0.38, 24),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, transparent: true, opacity: 0.82 })
    );
    waterRing.position.set(0, 0.2, 0);
    scene.add(waterRing);

    var stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.55, 2.1, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.6 })
    );
    stem.position.set(0, 1.2, 0);
    stem.castShadow = true;
    scene.add(stem);

    var cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, emissive: 0x7f1d1d, emissiveIntensity: 0.25 })
    );
    cap.position.set(0, 2.15, 0);
    cap.castShadow = true;
    scene.add(cap);

    // White spots on monument mushroom
    for (var s = 0; s < 6; s++) {
      var ang = (s / 6) * Math.PI * 2;
      var spot = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      );
      spot.position.set(Math.cos(ang) * 1.05, 2.65, Math.sin(ang) * 1.05);
      scene.add(spot);
    }

    solidColliders.push({ minX: -2.3, maxX: 2.3, minZ: -2.3, maxZ: 2.3, minY: 0, maxY: 3.5 });
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
    // Lab centered at x = -10, z = 0 (width 8m: -14..-6, depth 7m: -3.5..3.5)
    var floor = makeBox(8.2, 0.12, 7.2, 0x334155, { roughness: 0.65 });
    floor.position.set(-10, 0.06, 0);
    scene.add(floor);

    var wallH = 3.2;
    // Back wall (x = -14)
    var backWall = makeBox(0.22, wallH, 7.0, 0xe2e8f0, { roughness: 0.5 });
    backWall.position.set(-14, wallH / 2 + 0.12, 0);
    scene.add(backWall);
    wallSegments.push({ x1: -14, z1: -3.5, x2: -14, z2: 3.5, halfThick: 0.25 });

    // North wall (z = -3.5) with glass look
    var northWall = makeBox(8.0, wallH, 0.18, 0xbae6fd, { transparent: true, opacity: 0.35, roughness: 0.15 });
    northWall.position.set(-10, wallH / 2 + 0.12, -3.5);
    scene.add(northWall);
    wallSegments.push({ x1: -14, z1: -3.5, x2: -6, z2: -3.5, halfThick: 0.25 });

    // South wall (z = +3.5)
    var southWall = makeBox(8.0, wallH, 0.18, 0xbae6fd, { transparent: true, opacity: 0.35, roughness: 0.15 });
    southWall.position.set(-10, wallH / 2 + 0.12, 3.5);
    scene.add(southWall);
    wallSegments.push({ x1: -14, z1: 3.5, x2: -6, z2: 3.5, halfThick: 0.25 });

    // Front wall (x = -6) with doorway gap z = -0.8..0.8
    var frontN = makeBox(0.22, wallH, 2.7, 0xe2e8f0);
    frontN.position.set(-6, wallH / 2 + 0.12, -2.15);
    scene.add(frontN);
    wallSegments.push({ x1: -6, z1: -3.5, x2: -6, z2: -0.8, halfThick: 0.25 });

    var frontS = makeBox(0.22, wallH, 2.7, 0xe2e8f0);
    frontS.position.set(-6, wallH / 2 + 0.12, 2.15);
    scene.add(frontS);
    wallSegments.push({ x1: -6, z1: 0.8, x2: -6, z2: 3.5, halfThick: 0.25 });

    // Swinging Lab Door at x = -6, hinged at z = -0.8
    labDoorPivot = new THREE.Group();
    labDoorPivot.position.set(-6, 0.12, -0.8);
    var doorPanel = makeBox(0.12, 2.45, 1.55, 0x0f766e, { roughness: 0.45 });
    doorPanel.position.set(0, 1.225, 0.78);
    var doorHandle = makeBox(0.18, 0.14, 0.08, 0xfbbf24, { metalness: 0.7, roughness: 0.25 });
    doorHandle.position.set(0.08, 1.05, 1.38);
    labDoorPivot.add(doorPanel);
    labDoorPivot.add(doorHandle);
    scene.add(labDoorPivot);

    // Translucent Roof
    var roof = makeBox(8.4, 0.15, 7.4, 0x1e293b, { transparent: true, opacity: 0.82 });
    roof.position.set(-10, wallH + 0.18, 0);
    scene.add(roof);

    // 1. Laminar Flow Hood (Cabine de Fluxo Laminar) at (-12.7, -1.7)
    var hoodBase = makeBox(1.4, 0.9, 2.2, 0xf1f5f9, { roughness: 0.4 });
    hoodBase.position.set(-12.7, 0.12 + 0.45, -1.7);
    scene.add(hoodBase);
    var hoodTop = makeBox(1.3, 1.1, 2.1, 0x94a3b8, { transparent: true, opacity: 0.35 });
    hoodTop.position.set(-12.7, 0.12 + 1.45, -1.7);
    scene.add(hoodTop);
    var hepa = makeBox(0.15, 0.9, 1.9, 0xecfeff, { emissive: 0x38bdf8, emissiveIntensity: 0.45 });
    hepa.position.set(-13.25, 0.12 + 1.4, -1.7);
    scene.add(hepa);
    solidColliders.push({ minX: -13.45, maxX: -11.95, minZ: -2.85, maxZ: -0.55, minY: 0.12, maxY: 2.3 });
    supportSurfaces.push({ minX: -13.3, maxX: -12.05, minZ: -2.7, maxZ: -0.7, topY: 1.02 });

    // 2. Autoclave / Sterilization Bench at (-12.7, 1.7)
    var autoBench = makeBox(1.4, 0.85, 2.0, 0x475569, { roughness: 0.5 });
    autoBench.position.set(-12.7, 0.12 + 0.425, 1.7);
    scene.add(autoBench);
    var autoclave = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.88, 16),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.78, roughness: 0.25 })
    );
    autoclave.position.set(-12.8, 0.12 + 0.85 + 0.44, 1.9);
    autoclave.castShadow = true;
    scene.add(autoclave);
    solidColliders.push({ minX: -13.45, maxX: -11.95, minZ: 0.65, maxZ: 2.75, minY: 0.12, maxY: 2.0 });
    supportSurfaces.push({ minX: -13.3, maxX: -12.05, minZ: 0.75, maxZ: 1.45, topY: 0.97 });

    // 3. Fruiting Tent (Estufa de Frutificação) at (-8.0, -2.1)
    var tentFrame = makeBox(2.2, 2.1, 1.8, 0x10b981, { transparent: true, opacity: 0.22, roughness: 0.2 });
    tentFrame.position.set(-8.0, 0.12 + 1.05, -2.1);
    scene.add(tentFrame);
    var tentLed = makeBox(1.8, 0.08, 0.25, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.85 });
    tentLed.position.set(-8.0, 0.12 + 1.95, -2.1);
    scene.add(tentLed);
    var tentTable = makeBox(1.9, 0.65, 1.5, 0x334155);
    tentTable.position.set(-8.0, 0.12 + 0.325, -2.1);
    scene.add(tentTable);
    supportSurfaces.push({ minX: -8.9, maxX: -7.1, minZ: -2.8, maxZ: -1.4, topY: 0.77 });

    // 4. Culture Shelf (Estante de Spawn) at (-8.0, 2.2)
    var shelfLow = makeBox(2.0, 0.08, 1.0, 0x92400e);
    shelfLow.position.set(-8.0, 0.12 + 0.75, 2.2);
    scene.add(shelfLow);
    supportSurfaces.push({ minX: -8.95, maxX: -7.05, minZ: 1.72, maxZ: 2.68, topY: 0.91 });
    solidColliders.push({ minX: -9.0, maxX: -7.0, minZ: 1.7, maxZ: 2.7, minY: 0.12, maxY: 1.8 });

    // Pickable Lab Items!
    // Petri Dish (Healthy Mycelium)
    var petri1 = new THREE.Group();
    var petriDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x38bdf8, emissiveIntensity: 0.2 })
    );
    petriDisk.position.y = 0.03;
    petri1.add(petriDisk);
    registerPickable('petri_clean', 'Placa de Petri (Micélio Saudável)', petri1, -12.5, 1.02, -2.1, 0, 0.22, 0.1);

    // Petri Dish (Trichoderma Contamination sample)
    var petri2 = new THREE.Group();
    var petriContam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.35 })
    );
    petriContam.position.y = 0.03;
    petri2.add(petriContam);
    registerPickable('petri_contam', 'Placa Contaminada (Tricoderma)', petri2, -12.5, 1.02, -1.3, 0, 0.22, 0.1);

    // Grain Spawn Jar
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
    registerPickable('spawn_jar', 'Pote de Spawn de Grãos', spawnJar, -12.5, 0.97, 1.05, 0, 0.22, 0.4);

    // Fruiting Mushroom Block
    var mushBlock = new THREE.Group();
    var subBlock = makeBox(0.36, 0.28, 0.26, 0xf5f5f4);
    subBlock.position.y = 0.14;
    mushBlock.add(subBlock);
    for (var m = -1; m <= 1; m++) {
      var miniStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.14, 8),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7 })
      );
      miniStem.position.set(m * 0.1, 0.34, 0);
      var miniCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0xd97706 })
      );
      miniCap.position.set(m * 0.1, 0.41, 0);
      mushBlock.add(miniStem);
      mushBlock.add(miniCap);
    }
    registerPickable('fruiting_block', 'Bloco de Cultivo em Frutificação', mushBlock, -8.0, 0.77, -2.1, 0, 0.26, 0.48);

    // Liquid Culture Flask
    var lcFlask = new THREE.Group();
    var lcBody = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.32, 14),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
    );
    lcBody.position.y = 0.16;
    lcFlask.add(lcBody);
    registerPickable('liquid_culture', 'Cultura Líquida (CL)', lcFlask, -8.0, 0.91, 2.2, 0, 0.2, 0.35);
  }

  function buildAuditorium() {
    // Open Amphitheater at x = 8..16, z = -5..5
    var stage = makeBox(3.6, 0.32, 8.4, 0x475569, { roughness: 0.7 });
    stage.position.set(14.0, 0.16, 0);
    scene.add(stage);

    // Giant Interactive Projection Screen
    var frame = makeBox(0.3, 3.3, 5.8, 0x0f172a, { roughness: 0.4 });
    frame.position.set(15.2, 2.15, 0);
    scene.add(frame);
    solidColliders.push({ minX: 14.8, maxX: 15.6, minZ: -3.0, maxZ: 3.0, minY: 0, maxY: 3.8 });

    auditoriumCanvas = document.createElement('canvas');
    auditoriumCanvas.width = 1024;
    auditoriumCanvas.height = 576;
    auditoriumCtx = auditoriumCanvas.getContext('2d');
    auditoriumTex = new THREE.CanvasTexture(auditoriumCanvas);

    auditoriumScreenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 3.0),
      new THREE.MeshBasicMaterial({ map: auditoriumTex })
    );
    auditoriumScreenMesh.position.set(15.02, 2.15, 0);
    auditoriumScreenMesh.rotation.y = -Math.PI / 2;
    scene.add(auditoriumScreenMesh);

    // Tiered Wooden Benches facing the screen
    var benchX = [10.8, 9.2, 7.6];
    benchX.forEach(function (bx, idx) {
      var bench = makeBox(0.75, 0.42, 6.4, 0x92400e, { roughness: 0.75 });
      bench.position.set(bx, 0.21 + idx * 0.12, 0);
      scene.add(bench);
      solidColliders.push({ minX: bx - 0.4, maxX: bx + 0.4, minZ: -3.2, maxZ: 3.2, minY: 0, maxY: 0.8 });
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

  // Wall & Collider clamping (from twin3d.js)
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
    // Closed lab door blocks doorway at x=-6, z in [-0.8, 0.8]
    if (!labDoorOpen && pos.z > -0.85 && pos.z < 0.85 && Math.abs(pos.x - (-6)) < radius + 0.16) {
      pos.x = pos.x >= -6 ? -6 + radius + 0.16 : -6 - radius - 0.16;
    }
    // Solid colliders
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
    pos.x = Math.max(-44, Math.min(44, pos.x));
    pos.z = Math.max(-44, Math.min(44, pos.z));
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
    // Check support surfaces first, then ground
    var maxT = 4.5;
    for (var t = 0.6; t <= maxT; t += 0.25) {
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

    // Chibi Mushroom Hat!
    var hat = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hatMat
    );
    hat.position.set(0, 0.25, 0);
    hat.castShadow = true;
    headGroup.add(hat);

    // Professor Gold Crown Ring
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

    // Nameplate sprite
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
    var ctx = canvas.getContext('2d');
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
    // 1. Place held item
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

    // 2. Harvest wild mushroom
    if (hoveredMushroom && hoveredMushroom.active) {
      hoveredMushroom.active = false;
      hoveredMushroom.group.visible = false;
      hoveredMushroom.respawnAt = performance.now() + 20000;
      if (callbacks.onHarvestMushroom) callbacks.onHarvestMushroom(hoveredMushroom.id);
      return;
    }

    // 3. Toggle Lab Door
    if (hoveredDoor) {
      labDoorOpen = !labDoorOpen;
      return;
    }

    // 4. Open Lessons Modal when clicking Auditorium Screen
    if (hoveredScreen) {
      if (document.pointerLockElement) document.exitPointerLock();
      if (callbacks.onOpenLessons) callbacks.onOpenLessons();
      return;
    }

    // 5. Pick up item
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

    // Check Auditorium Screen
    if (auditoriumScreenMesh) {
      var scrHits = raycaster.intersectObject(auditoriumScreenMesh, false);
      if (scrHits.length > 0 && scrHits[0].distance < 12) {
        hoveredScreen = true;
        prompt = '📺 Abrir Módulos da Universidade';
      }
    }

    // Check Lab Door
    if (!prompt && labDoorPivot) {
      var doorHits = raycaster.intersectObject(labDoorPivot, true);
      if (doorHits.length > 0 && doorHits[0].distance < 4.5) {
        hoveredDoor = true;
        prompt = labDoorOpen ? '🚪 Fechar Porta do Lab' : '🚪 Abrir Porta do Lab';
      }
    }

    // Check Wild Mushrooms
    if (!prompt) {
      for (var m = 0; m < wildMushrooms.length; m++) {
        var wm = wildMushrooms[m];
        if (!wm.active) continue;
        var mHits = raycaster.intersectObject(wm.group, true);
        if (mHits.length > 0 && mHits[0].distance < 4.2) {
          hoveredMushroom = wm;
          prompt = '🍄 Colher Cogumelo (+25 XP)';
          break;
        }
      }
    }

    // Check Pickable Lab Items
    if (!prompt) {
      for (var i = 0; i < pickableItems.length; i++) {
        var item = pickableItems[i];
        var hits = raycaster.intersectObject(item.mesh, true);
        if (hits.length > 0 && hits[0].distance < 4.2) {
          hoveredPickable = item;
          prompt = '✋ Pegar ' + item.label;
          break;
        }
      }
    }

    if (callbacks.onHoverPrompt) callbacks.onHoverPrompt(prompt);
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
      if (e.button !== 0) return;
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

    // Touch look on right side of screen when in FPS
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
          if (!touchMoved) {
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

    // Respawn wild mushrooms
    wildMushrooms.forEach(function (wm) {
      if (!wm.active && now >= wm.respawnAt) {
        wm.active = true;
        wm.group.visible = true;
      } else if (wm.active) {
        wm.capMesh.rotation.y += dt * 0.5;
      }
    });

    // Smooth lab door swing
    if (labDoorPivot) {
      var targetAngle = labDoorOpen ? -Math.PI * 0.48 : 0;
      labDoorAngle += (targetAngle - labDoorAngle) * Math.min(1, dt * 8);
      labDoorPivot.rotation.y = labDoorAngle;
    }

    if (inFps) {
      var moveZ = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - joyY;
      var moveX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) + joyX;
      var mag = Math.hypot(moveX, moveZ);
      isWalking = mag > 0.08;
      if (isWalking) {
        if (mag > 1) { moveX /= mag; moveZ /= mag; }
        var speed = (keys['ShiftLeft'] ? 7.2 : 4.8) * dt;
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

    updateHoverRay();
    dropUnsupportedItems();
    stepMultiplayerAvatars(dt);
    renderer.render(scene, camera);
  }

  window.initCampus3D = function (containerId, cbs) {
    callbacks = Object.assign(callbacks, cbs || {});
    var container = document.getElementById(containerId);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0xa5d8ff, 0.011);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 160);
    camera.position.set(0, 11, 21);

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
    controls.maxDistance = 42;
    controls.target.set(0, 1.5, 0);

    var hemi = new THREE.HemisphereLight(0xe0f2fe, 0x3f6212, 0.82);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfffbeb, 1.05);
    sun.position.set(18, 28, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    scene.add(sun);

    clock = new THREE.Clock();
    buildNatureWorld();
    buildPlaza();
    buildMycoLab();
    buildAuditorium();
    createPlacementGhost();
    bindControls();
    animate();
  };

  window.setCampusFpsMode = function (enable) {
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

