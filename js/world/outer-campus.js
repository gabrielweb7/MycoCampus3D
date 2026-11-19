import { getTextures, brickMat, woodMat, makeBox, registerSnowable } from '../engine/textures.js';
import { addWalkableSlab, addSolidWall } from '../engine/physics.js';

export function buildOuterCampus(ctx) {
  var scene = ctx.scene;
  var tex = getTextures();
  var texPaving = tex.texPaving;
  var texWater = tex.texWater;

  // 1. Avenidas asfaltadas ligando de ponta a ponta do mapa até os Túneis nas Colinas!
  var roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 });
  var roadSouth = makeBox(240, 0.03, 7.2, roadMat, { noShadow: true });
  roadSouth.position.set(0, 0.015, 39.5);
  var roadEast = makeBox(7.0, 0.03, 62, roadMat, { noShadow: true });
  roadEast.position.set(30.5, 0.015, 8.5);
  scene.add(roadSouth, roadEast);

  // Faixa amarela central tracejada na Avenida Sul
  var dashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  for (var dx = -108; dx <= 108; dx += 5.5) {
    var dash = makeBox(2.4, 0.036, 0.16, dashMat, { noShadow: true });
    dash.position.set(dx, 0.019, 39.5);
    scene.add(dash);
  }

  // Túneis Escuros nas Colinas (Oeste x=-112 e Leste x=+112) de onde os carros dos NPCs saem e entram!
  var stoneTunnelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
  var darkVoidMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
  var hillTunnelMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.94 });
  [-112, 112].forEach(function (tx) {
    var dir = tx < 0 ? 1 : -1;
    var tHill = new THREE.Mesh(new THREE.SphereGeometry(9.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hillTunnelMat);
    tHill.scale.set(1.1, 0.72, 1.3);
    tHill.position.set(tx - dir * 3.5, 0, 39.5);
    var archFrame = makeBox(1.4, 5.2, 8.4, stoneTunnelMat);
    archFrame.position.set(tx, 2.6, 39.5);
    var darkPortal = makeBox(1.8, 3.8, 6.2, darkVoidMat, { noShadow: true });
    darkPortal.position.set(tx - dir * 0.6, 1.9, 39.5);
    var tunnelLamp = makeBox(0.2, 0.25, 1.6, new THREE.MeshBasicMaterial({ color: 0xfef08a }), { noShadow: true });
    tunnelLamp.position.set(tx + dir * 0.65, 4.3, 39.5);
    scene.add(tHill, archFrame, darkPortal, tunnelLamp);
  });

  // Faixas de pedestres
  for (var s = -2; s <= 2; s++) {
    var st1 = makeBox(0.65, 0.04, 4.8, 0xf8fafc, { noShadow: true });
    st1.position.set(-42 + s * 1.3, 0.02, 39.5);
    var st2 = makeBox(4.8, 0.04, 0.65, 0xf8fafc, { noShadow: true });
    st2.position.set(30.5, 0.02, 12 + s * 1.3);
    scene.add(st1, st2);
  }

  // Calcada em bloquetes ligando a Praca Central ate a ponte e continuando do outro lado do Lago em 8!
  var walkS = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.2), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
  walkS.rotation.x = -Math.PI / 2; walkS.position.set(0, 0.022, 18.4); walkS.receiveShadow = true;
  var walkSouthEnd = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 6.5), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
  walkSouthEnd.rotation.x = -Math.PI / 2; walkSouthEnd.position.set(0, 0.022, 38.6); walkSouthEnd.receiveShadow = true;
  var walkE = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88 }));
  walkE.rotation.x = -Math.PI / 2; walkE.position.set(27, 0.022, 12); walkE.receiveShadow = true;
  scene.add(walkS, walkSouthEnd, walkE);

  // 2. Lago Duplo (formato de 8) com profundidade em camadas + agua cristalina animada + Ponte de Madeira Arqueada
  var lakeMat = new THREE.MeshStandardMaterial({
    map: texWater,
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.16,
    roughness: 0.06,
    metalness: 0.32,
    transparent: true,
    opacity: 0.78,
    depthWrite: false
  });
  var lakeShallowMat = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.92 });
  var lakeMidMat = new THREE.MeshStandardMaterial({ color: 0x082f49, roughness: 0.95 });
  var lakeDeepMat = new THREE.MeshStandardMaterial({ color: 0x021724, roughness: 0.98 });
  var lakeBedMat = lakeDeepMat;
  var lakeStoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 });
  [-6.5, 6.5].forEach(function (lx) {
    var bed1 = new THREE.Mesh(new THREE.CircleGeometry(7.55, 36), lakeShallowMat);
    bed1.rotation.x = -Math.PI / 2; bed1.position.set(lx, 0.015, 28.0);
    var bed2 = new THREE.Mesh(new THREE.CircleGeometry(5.8, 32), lakeMidMat);
    bed2.rotation.x = -Math.PI / 2; bed2.position.set(lx, 0.018, 28.0);
    var bed3 = new THREE.Mesh(new THREE.CircleGeometry(3.7, 28), lakeDeepMat);
    bed3.rotation.x = -Math.PI / 2; bed3.position.set(lx, 0.021, 28.0);
    var lobe = new THREE.Mesh(new THREE.CircleGeometry(7.55, 36), lakeMat);
    lobe.rotation.x = -Math.PI / 2; lobe.position.set(lx, 0.11, 28.0);
    var rim = new THREE.Mesh(new THREE.RingGeometry(7.42, 8.28, 36), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.82 }));
    rim.rotation.x = -Math.PI / 2; rim.position.set(lx, 0.045, 28.0);
    scene.add(bed1, bed2, bed3, lobe, rim);
    // Algumas pedras submersas e na margem para dar sensacao de profundidade real
    for (var st = 0; st < 8; st++) {
      var sang = (st / 8) * Math.PI * 2 + (lx > 0 ? 0.3 : 0);
      var srad = 3.2 + (st % 3) * 1.4;
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + (st % 2) * 0.14, 0), lakeStoneMat);
      rock.scale.set(1.2, 0.45, 1.0);
      rock.position.set(lx + Math.cos(sang) * srad, 0.03, 28.0 + Math.sin(sang) * srad);
      scene.add(rock);
    }
  });

  // Ponte de Madeira Arqueada (z: 20.6 .. 35.4, ligando os dois lados do lago!)
  (function buildArchedWoodBridge() {
    var bg = new THREE.Group();
    var bridgeW = 3.2;
    var zStart = 20.6, zEnd = 35.4;
    var zMid = (zStart + zEnd) * 0.5;
    var halfSpan = (zEnd - zStart) * 0.5; // 7.4m
    var archHeight = 0.88;
    var baseDeckY = 0.14;
    function deckYAt(z) {
      var u = Math.max(-1, Math.min(1, (z - zMid) / halfSpan));
      return baseDeckY + archHeight * (1 - u * u);
    }

    var plankMat = woodMat(1, 1);
    var railMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.78 });
    var postMat = new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.82 });

    // 38 Tabuas individuais seguindo o arco suave da ponte + segmentos caminhaveis
    var plankCount = 38;
    var stepZ = (zEnd - zStart) / plankCount;
    for (var pi = 0; pi < plankCount; pi++) {
      var pz = zStart + (pi + 0.5) * stepZ;
      var py = deckYAt(pz);
      var slope = Math.atan2(deckYAt(pz + 0.15) - deckYAt(pz - 0.15), 0.30);
      var plank = makeBox(bridgeW, 0.09, stepZ * 0.88, plankMat);
      plank.position.set(0, py - 0.045, pz);
      plank.rotation.x = -slope;
      bg.add(plank);
      if (pi % 2 === 0) {
        var segZ = zStart + (pi + 1) * stepZ;
        var segY = deckYAt(segZ);
        ctx.walkableFloors.push({
          minX: -bridgeW / 2 + 0.12, maxX: bridgeW / 2 - 0.12,
          minZ: pz - stepZ * 0.6, maxZ: pz + stepZ * 1.6,
          topY: segY
        });
      }
    }

    // Vigas longitudinais curvas e postes + trelicas em X + escoras diagonais externas
    var postCount = 10;
    var postStep = (zEnd - zStart) / postCount;
    var sideX = bridgeW / 2 - 0.10;
    for (var k = 0; k <= postCount; k++) {
      var kz = zStart + k * postStep;
      var ky = deckYAt(kz);
      [-sideX, sideX].forEach(function (sx) {
        if (k > 0 && k < postCount) {
          var pile = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, ky + 0.2, 10), postMat);
          pile.position.set(sx * 0.92, (ky - 0.1) * 0.5, kz);
          pile.castShadow = true;
          bg.add(pile);
        }
        var post = makeBox(0.11, 0.98, 0.11, postMat);
        post.position.set(sx, ky + 0.46, kz);
        bg.add(post);
        if (k % 2 === 0) {
          var dirSign = sx > 0 ? 1 : -1;
          var brace = makeBox(0.07, 0.88, 0.07, railMat);
          brace.position.set(sx + dirSign * 0.24, ky + 0.34, kz);
          brace.rotation.z = dirSign * 0.52;
          bg.add(brace);
        }
      });

      if (k < postCount) {
        var nz = zStart + (k + 1) * postStep;
        var ny = deckYAt(nz);
        var mz = (kz + nz) * 0.5;
        var my = (ky + ny) * 0.5;
        var dz = nz - kz;
        var dy = ny - ky;
        var spanLen = Math.hypot(dz, dy);
        var ang = Math.atan2(dy, dz);
        var crossLen = Math.hypot(dz, 0.72);
        var crossAng = Math.atan2(0.72, dz);

        [-sideX, sideX].forEach(function (sx) {
          var topRail = makeBox(0.11, 0.08, spanLen + 0.04, railMat);
          topRail.position.set(sx, my + 0.92, mz);
          topRail.rotation.x = -ang;
          var botRail = makeBox(0.08, 0.06, spanLen + 0.02, railMat);
          botRail.position.set(sx, my + 0.14, mz);
          botRail.rotation.x = -ang;
          var x1 = makeBox(0.055, 0.055, crossLen, railMat);
          x1.position.set(sx, my + 0.52, mz);
          x1.rotation.x = crossAng - ang;
          var x2 = makeBox(0.055, 0.055, crossLen, railMat);
          x2.position.set(sx, my + 0.52, mz);
          x2.rotation.x = -crossAng - ang;
          bg.add(topRail, botRail, x1, x2);
        });
      }
    }

    [-sideX, sideX].forEach(function (sx) {
      ctx.solidColliders.push({
        minX: sx - 0.10, maxX: sx + 0.10,
        minZ: zStart + 0.2, maxZ: zEnd - 0.2,
        minY: 0, maxY: 2.4
      });
    });

    scene.add(bg);
  })();

  // 3. Complexo Esportivo Oeste
  var track = makeBox(30, 0.04, 19, 0xb91c1c, { roughness: 0.85, noShadow: true });
  track.position.set(-50, 0.02, -15);
  var field = makeBox(24, 0.05, 14, 0x16a34a, { roughness: 0.9, noShadow: true });
  field.position.set(-50, 0.025, -15);
  scene.add(track, field);
  var midLine = makeBox(0.14, 0.06, 13.8, 0xffffff, { noShadow: true });
  midLine.position.set(-50, 0.03, -15);
  scene.add(midLine);
  [-61.5, -38.5].forEach(function (gx) {
    var goal = makeBox(0.3, 2.0, 4.2, 0xf8fafc, { transparent: true, opacity: 0.75, noShadow: true });
    goal.position.set(gx, 1.0, -15);
    scene.add(goal);
  });
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
  ctx.basketballHoops = [];
  var hoopRimGeo = new THREE.TorusGeometry(0.28, 0.026, 8, 20);
  var hoopRimMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.5 });
  var hoopNetGeo = new THREE.CylinderGeometry(0.26, 0.16, 0.38, 12, 2, true);
  var hoopNetMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, wireframe: true });
  [-55.5, -40.5].forEach(function (hx) {
    var dirIn = hx < -48 ? 1 : -1;
    var post = makeBox(0.16, 3.1, 0.16, 0x1e293b);
    post.position.set(hx, 1.55, 6);
    var arm = makeBox(0.36, 0.12, 0.12, 0x334155);
    arm.position.set(hx + dirIn * 0.18, 2.9, 6);
    var boardB = makeBox(0.10, 1.05, 1.65, 0xf8fafc);
    boardB.position.set(hx + dirIn * 0.36, 2.95, 6);
    var targetSq = makeBox(0.11, 0.42, 0.56, 0xef4444);
    targetSq.position.set(hx + dirIn * 0.365, 2.86, 6);

    var rimX = hx + dirIn * 0.68;
    var rimY = 2.66;
    var rim = new THREE.Mesh(hoopRimGeo, hoopRimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(rimX, rimY, 6);

    var net = new THREE.Mesh(hoopNetGeo, hoopNetMat);
    net.castShadow = false;
    net.position.set(rimX, rimY - 0.19, 6);

    scene.add(post, arm, boardB, targetSq, rim, net);
    ctx.basketballHoops.push({ x: rimX, y: rimY, z: 6 });
  });

  // Bolas interativas do Complexo Esportivo (Futebol + Basquete)
  (function createSportBalls() {
    function makeBallTex(bg, lineCol, isSoccer) {
      var c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      var cctx = c.getContext('2d');
      cctx.fillStyle = bg; cctx.fillRect(0, 0, 128, 64);
      cctx.strokeStyle = lineCol; cctx.fillStyle = lineCol;
      if (isSoccer) {
        for (var sx = 16; sx < 128; sx += 32) {
          for (var sy = 16; sy < 64; sy += 32) {
            cctx.beginPath(); cctx.arc(sx, sy, 8, 0, Math.PI * 2); cctx.fill();
          }
        }
      } else {
        cctx.lineWidth = 3;
        cctx.beginPath(); cctx.moveTo(0, 32); cctx.lineTo(128, 32); cctx.stroke();
        cctx.beginPath(); cctx.moveTo(64, 0); cctx.lineTo(64, 64); cctx.stroke();
        cctx.beginPath(); cctx.arc(32, 32, 22, -1.1, 1.1); cctx.stroke();
        cctx.beginPath(); cctx.arc(96, 32, 22, Math.PI - 1.1, Math.PI + 1.1); cctx.stroke();
      }
      return new THREE.CanvasTexture(c);
    }

    var soccerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12),
      new THREE.MeshStandardMaterial({ map: makeBallTex('#f8fafc', '#0f172a', true), roughness: 0.55 })
    );
    soccerMesh.position.set(-50, 0.29, -15);
    soccerMesh.castShadow = true;
    scene.add(soccerMesh);
    ctx.sportBalls.push({
      kind: 'soccer', mesh: soccerMesh, r: 0.24,
      vx: 0, vy: 0, vz: 0,
      homeX: -50, homeZ: -15, groundY: 0.05,
      minX: -61.8, maxX: -38.2, minZ: -21.8, maxZ: -8.2,
      bounceUp: 3.2, goalCooldown: 0
    });

    var bballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshStandardMaterial({ map: makeBallTex('#ea580c', '#1e293b', false), roughness: 0.65 })
    );
    bballMesh.position.set(-48, 0.27, 6);
    bballMesh.castShadow = true;
    scene.add(bballMesh);
    ctx.sportBalls.push({
      kind: 'basketball', mesh: bballMesh, r: 0.22,
      vx: 0, vy: 0, vz: 0,
      homeX: -48, homeZ: 6, groundY: 0.05,
      minX: -55.3, maxX: -40.7, minZ: 1.4, maxZ: 10.6,
      bounceUp: 4.5, goalCooldown: 0
    });
  })();

  // 3c. Quadras de Tenis azuis (x: -48, z: -36)
  [-54, -42].forEach(function (tx) {
    var tCourt = makeBox(10, 0.04, 15, 0x1d4ed8, { roughness: 0.8, noShadow: true });
    tCourt.position.set(tx, 0.02, -36);
    var tNet = makeBox(9.2, 0.9, 0.1, 0xf8fafc, { transparent: true, opacity: 0.85, noShadow: true });
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
    ctx.solidColliders.push({
      minX: car.position.x - 1.1, maxX: car.position.x + 1.1,
      minZ: car.position.z - 1.9, maxZ: car.position.z + 1.9, minY: 0, maxY: 1.4
    });
  }

  // 4. Setor Leste: Student Center -> GRANDE AUDITORIO / CINEMA CAMINHÁVEL (x: 48, z: -12)
  addWalkableSlab(ctx.scene, ctx.walkableFloors, 48, 0.14, -12, 22, 0.14, 16, 0x334155);
  var scRoof = makeBox(22.6, 0.4, 16.6, 0x64748b, { uniqueMat: true });
  scRoof.position.set(48, 6.7, -12);
  registerSnowable(scRoof.material);
  ctx.roofZones.push({ minX: 36.5, maxX: 59.5, minZ: -20.5, maxZ: -3.5, roofY: 6.9 });
  scene.add(scRoof);
  // Paredes do Auditorio com entrada ampla no Sul (x: 46..50 aberta!)
  addSolidWall(ctx.scene, ctx.wallSegments, 37, -20, 59, -20, 0.14, 6.4, 0.35, brickMat(5, 2)); // Norte (fundo da tela)
  addSolidWall(ctx.scene, ctx.wallSegments, 37, -20, 37, -4, 0.14, 6.4, 0.35, brickMat(4, 2));  // Oeste
  addSolidWall(ctx.scene, ctx.wallSegments, 59, -20, 59, -4, 0.14, 6.4, 0.35, brickMat(4, 2));  // Leste
  addSolidWall(ctx.scene, ctx.wallSegments, 37, -4, 46, -4, 0.14, 6.4, 0.35, brickMat(2.2, 2)); // Sul esq
  addSolidWall(ctx.scene, ctx.wallSegments, 50, -4, 59, -4, 0.14, 6.4, 0.35, brickMat(2.2, 2)); // Sul dir
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
  var cinemaCanvas = document.createElement('canvas');
  cinemaCanvas.width = 768; cinemaCanvas.height = 384;
  var cinemaCtx = cinemaCanvas.getContext('2d');
  var cinemaTex = new THREE.CanvasTexture(cinemaCanvas);
  var cinemaFrame = makeBox(11.6, 5.4, 0.18, 0x0f172a);
  cinemaFrame.position.set(48, 3.6, -19.72);
  scene.add(cinemaFrame);
  var cinemaScreenMesh = new THREE.Mesh(
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
  var cinemaBeam = new THREE.Mesh(new THREE.ConeGeometry(4.2, 10.6, 24, 1, true), beamMat);
  cinemaBeam.position.set(48, 4.65, -14.3);
  cinemaBeam.rotation.x = Math.PI / 2 - 0.19;
  scene.add(projBody, projLens, cinemaBeam);

  if (ctx.setCinemaRefs) {
    ctx.setCinemaRefs({
      cinemaCanvas: cinemaCanvas,
      cinemaCtx: cinemaCtx,
      cinemaTex: cinemaTex,
      cinemaScreenMesh: cinemaScreenMesh,
      cinemaBeam: cinemaBeam
    });
  }

  // 3 fileiras de poltronas do Auditorio (clicaveis para sentar e assistir!)
  [-14.5, -12.2, -9.9].forEach(function (rz, rIdx) {
    var rowBench = makeBox(11.0, 0.45, 0.85, 0x991b1b, { roughness: 0.7 });
    rowBench.position.set(48, 0.38 + rIdx * 0.18, rz);
    var rowBack = makeBox(11.0, 0.55, 0.16, 0x7f1d1d, { roughness: 0.7 });
    rowBack.position.set(48, 0.78 + rIdx * 0.18, rz + 0.36);
    scene.add(rowBench, rowBack);
    ctx.solidColliders.push({ minX: 42.4, maxX: 53.6, minZ: rz - 0.45, maxZ: rz + 0.45, minY: 0, maxY: 1.4 });
    [-4.4, -2.2, 0, 2.2, 4.4].forEach(function (sx) {
      var audSeatHit = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.65, 0.85),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      audSeatHit.visible = false;
      audSeatHit.position.set(48 + sx, 0.52 + rIdx * 0.18, rz);
      audSeatHit.userData.seatInfo = { x: 48 + sx, y: 0.14 + rIdx * 0.18, z: rz - 0.04, yaw: 0 };
      scene.add(audSeatHit);
      ctx.seatMeshes.push(audSeatHit);
    });
  });

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
  ctx.solidColliders.push({ minX: 39.5, maxX: 44.5, minZ: 9.5, maxZ: 14.5, minY: 0, maxY: 1.2 });

  // 4c. 2 Dormitorios Caminhaveis no Sudeste (com porta aberta, piso, cama e mesa!)
  [[58, 12, 0xfacc15], [50, 28, 0x38bdf8]].forEach(function (dm) {
    var dx = dm[0], dz = dm[1];
    addWalkableSlab(ctx.scene, ctx.walkableFloors, dx, 0.14, dz, 14, 0.14, 10, 0x475569);
    var dRoof = makeBox(14.6, 0.4, 10.6, 0x64748b, { uniqueMat: true });
    dRoof.position.set(dx, 5.4, dz);
    registerSnowable(dRoof.material);
    ctx.roofZones.push({ minX: dx - 7.5, maxX: dx + 7.5, minZ: dz - 5.5, maxZ: dz + 5.5, roofY: 5.6 });
    scene.add(dRoof);
    addSolidWall(ctx.scene, ctx.wallSegments, dx - 7, dz - 5, dx + 7, dz - 5, 0.14, 5.1, 0.3, brickMat(3, 2)); // Fundo
    addSolidWall(ctx.scene, ctx.wallSegments, dx - 7, dz - 5, dx - 7, dz + 5, 0.14, 5.1, 0.3, brickMat(2, 2)); // Esq
    addSolidWall(ctx.scene, ctx.wallSegments, dx + 7, dz - 5, dx + 7, dz + 5, 0.14, 5.1, 0.3, brickMat(2, 2)); // Dir
    // Frente (dz + 5) com porta aberta em dx - 4.0 (largura 2.4m)
    addSolidWall(ctx.scene, ctx.wallSegments, dx - 7, dz + 5, dx - 5.2, dz + 5, 0.14, 5.1, 0.3, brickMat(1, 2));
    addSolidWall(ctx.scene, ctx.wallSegments, dx - 2.8, dz + 5, dx + 7, dz + 5, 0.14, 5.1, 0.3, brickMat(2, 2));
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
    ctx.solidColliders.push({ minX: dx + 2.3, maxX: dx + 4.7, minZ: dz - 3.2, maxZ: dz - 1.8, minY: 0, maxY: 0.69, surfaceTopY: 0.69 });
    ctx.solidColliders.push({ minX: dx + 2.5, maxX: dx + 4.5, minZ: dz + 2.0, maxZ: dz + 3.0, minY: 0, maxY: 0.89, surfaceTopY: 0.89 });
    ctx.supportSurfaces.push({ minX: dx + 2.3, maxX: dx + 4.7, minZ: dz - 3.2, maxZ: dz - 1.8, topY: 0.69 });
    ctx.supportSurfaces.push({ minX: dx + 2.5, maxX: dx + 4.5, minZ: dz + 2.0, maxZ: dz + 3.0, topY: 0.89 });
  });
}
