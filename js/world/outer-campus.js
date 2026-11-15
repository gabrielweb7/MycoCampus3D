/**
 * MycoCampus 3D — Outer Campus, Arched Bridge, Sports Complex & Open-Air Cinema
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.buildOuterCampus = function () {
    // 1. Avenidas asfaltadas com faixas de pedestres
    var roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 });
    var roadSouth = E.makeBox(140, 0.03, 7.0, roadMat, { noShadow: true });
    roadSouth.position.set(0, 0.015, 39.5);
    var roadEast = E.makeBox(7.0, 0.03, 62, roadMat, { noShadow: true });
    roadEast.position.set(30.5, 0.015, 8.5);
    E.scene.add(roadSouth, roadEast);

    // Faixas de pedestres
    for (var s = -2; s <= 2; s++) {
      var st1 = E.makeBox(0.65, 0.04, 4.8, 0xf8fafc, { noShadow: true });
      st1.position.set(-42 + s * 1.3, 0.02, 39.5);
      var st2 = E.makeBox(4.8, 0.04, 0.65, 0xf8fafc, { noShadow: true });
      st2.position.set(30.5, 0.02, 12 + s * 1.3);
      E.scene.add(st1, st2);
    }

    // Calcada em bloquetes ligando a Praca Central ate a ponte e continuando do outro lado do Lago em 8!
    var walkS = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.2), new THREE.MeshStandardMaterial({ map: E.texPaving, roughness: 0.88 }));
    walkS.rotation.x = -Math.PI / 2; walkS.position.set(0, 0.022, 18.4); walkS.receiveShadow = true;
    var walkSouthEnd = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 6.5), new THREE.MeshStandardMaterial({ map: E.texPaving, roughness: 0.88 }));
    walkSouthEnd.rotation.x = -Math.PI / 2; walkSouthEnd.position.set(0, 0.022, 38.6); walkSouthEnd.receiveShadow = true;
    var walkE = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshStandardMaterial({ map: E.texPaving, roughness: 0.88 }));
    walkE.rotation.x = -Math.PI / 2; walkE.position.set(27, 0.022, 12); walkE.receiveShadow = true;
    E.scene.add(walkS, walkSouthEnd, walkE);

    // 2. Lago Duplo (formato de 8) com profundidade em camadas + agua cristalina animada + Ponte de Madeira Arqueada
    var lakeMat = new THREE.MeshStandardMaterial({
      map: E.texWater,
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
      E.scene.add(bed1, bed2, bed3, lobe, rim);
      // Algumas pedras submersas e na margem para dar sensacao de profundidade real
      for (var st = 0; st < 8; st++) {
        var sang = (st / 8) * Math.PI * 2 + (lx > 0 ? 0.3 : 0);
        var srad = 3.2 + (st % 3) * 1.4;
        var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + (st % 2) * 0.14, 0), lakeStoneMat);
        rock.scale.set(1.2, 0.45, 1.0);
        rock.position.set(lx + Math.cos(sang) * srad, 0.03, 28.0 + Math.sin(sang) * srad);
        E.scene.add(rock);
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

      var plankMat = E.woodMat(1, 1);
      var railMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.78 });
      var postMat = new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.82 });

      // 38 Tabuas individuais seguindo o arco suave da ponte + segmentos caminhaveis
      var plankCount = 38;
      var stepZ = (zEnd - zStart) / plankCount;
      for (var pi = 0; pi < plankCount; pi++) {
        var pz = zStart + (pi + 0.5) * stepZ;
        var py = deckYAt(pz);
        var slope = Math.atan2(deckYAt(pz + 0.15) - deckYAt(pz - 0.15), 0.30);
        var plank = E.makeBox(bridgeW, 0.09, stepZ * 0.88, plankMat);
        plank.position.set(0, py - 0.045, pz);
        plank.rotation.x = -slope;
        bg.add(plank);
        if (pi % 2 === 0) {
          var segZ = zStart + (pi + 1) * stepZ;
          var segY = deckYAt(segZ);
          E.walkableFloors.push({
            minX: -bridgeW / 2 + 0.12, maxX: bridgeW / 2 - 0.12,
            minZ: pz - stepZ * 0.6, maxZ: pz + stepZ * 1.6,
            topY: segY
          });
        }
      }

      // Vigas longitudinais curvas e postes + trelicas em X + escoras diagonais externas (estilo da foto!)
      var postCount = 10;
      var postStep = (zEnd - zStart) / postCount;
      var sideX = bridgeW / 2 - 0.10;
      for (var k = 0; k <= postCount; k++) {
        var kz = zStart + k * postStep;
        var ky = deckYAt(kz);
        [-sideX, sideX].forEach(function (sx) {
          // Estaca submersa indo ate o fundo do lago
          if (k > 0 && k < postCount) {
            var pile = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, ky + 0.2, 10), postMat);
            pile.position.set(sx * 0.92, (ky - 0.1) * 0.5, kz);
            pile.castShadow = true;
            bg.add(pile);
          }
          // Poste vertical do guarda-corpo
          var post = E.makeBox(0.11, 0.98, 0.11, postMat);
          post.position.set(sx, ky + 0.46, kz);
          bg.add(post);
          // Escora diagonal externa nos postes (fiel a referencia!)
          if (k % 2 === 0) {
            var dirSign = sx > 0 ? 1 : -1;
            var brace = E.makeBox(0.07, 0.88, 0.07, railMat);
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
            // Corrimao superior e travessa inferior
            var topRail = E.makeBox(0.11, 0.08, spanLen + 0.04, railMat);
            topRail.position.set(sx, my + 0.92, mz);
            topRail.rotation.x = -ang;
            var botRail = E.makeBox(0.08, 0.06, spanLen + 0.02, railMat);
            botRail.position.set(sx, my + 0.14, mz);
            botRail.rotation.x = -ang;
            // Trelica em X entre os postes
            var x1 = E.makeBox(0.055, 0.055, crossLen, railMat);
            x1.position.set(sx, my + 0.52, mz);
            x1.rotation.x = crossAng - ang;
            var x2 = E.makeBox(0.055, 0.055, crossLen, railMat);
            x2.position.set(sx, my + 0.52, mz);
            x2.rotation.x = -crossAng - ang;
            bg.add(topRail, botRail, x1, x2);
          });
        }
      }

      // Colisoes laterais invisiveis para o jogador nao cair pelas laterais da ponte
      [-sideX, sideX].forEach(function (sx) {
        E.solidColliders.push({
          minX: sx - 0.10, maxX: sx + 0.10,
          minZ: zStart + 0.2, maxZ: zEnd - 0.2,
          minY: 0, maxY: 2.4
        });
      });

      E.scene.add(bg);
    })();

    // 3. Complexo Esportivo Oeste
    // 3a. Campo de Futebol + Pista de Atletismo vermelha (x: -54, z: -15)
    var track = E.makeBox(30, 0.04, 19, 0xb91c1c, { roughness: 0.85, noShadow: true });
    track.position.set(-50, 0.02, -15);
    var field = E.makeBox(24, 0.05, 14, 0x16a34a, { roughness: 0.9, noShadow: true });
    field.position.set(-50, 0.025, -15);
    E.scene.add(track, field);
    var midLine = E.makeBox(0.14, 0.06, 13.8, 0xffffff, { noShadow: true });
    midLine.position.set(-50, 0.03, -15);
    E.scene.add(midLine);
    [-61.5, -38.5].forEach(function (gx) {
      var goal = E.makeBox(0.3, 2.0, 4.2, 0xf8fafc, { transparent: true, opacity: 0.75 });
      goal.position.set(gx, 1.0, -15);
      E.scene.add(goal);
    });
    // Arquibancada
    for (var b = 0; b < 3; b++) {
      var bleacher = E.makeBox(18, 0.45, 1.1, 0x94a3b8);
      bleacher.position.set(-50, 0.22 + b * 0.45, -26 - b * 1.1);
      E.scene.add(bleacher);
    }

    // 3b. Quadra de Basquete (x: -48, z: 6)
    var bball = E.makeBox(18, 0.04, 12, 0x0f766e, { roughness: 0.8, noShadow: true });
    bball.position.set(-48, 0.02, 6);
    var bballIn = E.makeBox(15, 0.05, 9.5, 0x15803d, { roughness: 0.8, noShadow: true });
    bballIn.position.set(-48, 0.025, 6);
    E.scene.add(bball, bballIn);
    [-55.5, -40.5].forEach(function (hx) {
      var post = E.makeBox(0.16, 3.0, 0.16, 0x1e293b);
      post.position.set(hx, 1.5, 6);
      var boardB = E.makeBox(0.12, 1.0, 1.6, 0xf8fafc);
      boardB.position.set(hx + (hx < -48 ? 0.35 : -0.35), 2.8, 6);
      E.scene.add(post, boardB);
    });

    // 3c. Quadras de Tenis azuis (x: -48, z: -36)
    [-54, -42].forEach(function (tx) {
      var tCourt = E.makeBox(10, 0.04, 15, 0x1d4ed8, { roughness: 0.8, noShadow: true });
      tCourt.position.set(tx, 0.02, -36);
      var tNet = E.makeBox(9.2, 0.9, 0.1, 0xf8fafc, { transparent: true, opacity: 0.85 });
      tNet.position.set(tx, 0.45, -36);
      E.scene.add(tCourt, tNet);
    });

    // 3d. Estacionamento Sudoeste com carros
    var lot = E.makeBox(24, 0.03, 18, roadMat, { noShadow: true });
    lot.position.set(-48, 0.015, 24);
    E.scene.add(lot);
    var carCols = [0xef4444, 0x3b82f6, 0xfacc15, 0xf8fafc, 0x10b981, 0x64748b];
    for (var c = 0; c < 6; c++) {
      var car = E.makeBox(2.0, 1.1, 3.6, carCols[c], { roughness: 0.35, metalness: 0.3 });
      car.position.set(-55 + (c % 3) * 6.5, 0.55, 19 + Math.floor(c / 3) * 9.5);
      E.scene.add(car);
      E.solidColliders.push({
        minX: car.position.x - 1.1, maxX: car.position.x + 1.1,
        minZ: car.position.z - 1.9, maxZ: car.position.z + 1.9, minY: 0, maxY: 1.4
      });
    }

    // 4. Setor Leste: Student Center + 2a Praca Circular + Dormitorios
    // 4a. Student Center (x: 48, z: -12) com terraco aberto no 2o andar
    // 4a. Student Center -> GRANDE AUDITORIO / CINEMA CAMINHÁVEL (x: 48, z: -12)
    E.addWalkableSlab(48, 0.14, -12, 22, 0.14, 16, 0x334155);
    var scRoof = E.makeBox(22.6, 0.4, 16.6, 0x64748b);
    scRoof.position.set(48, 6.7, -12);
    E.registerSnowable(scRoof.material);
    E.roofZones.push({ minX: 36.5, maxX: 59.5, minZ: -20.5, maxZ: -3.5, roofY: 6.9 });
    E.scene.add(scRoof);
    // Paredes do Auditorio com entrada ampla no Sul (x: 46..50 aberta!)
    E.addSolidWall(37, -20, 59, -20, 0.14, 6.4, 0.35, E.brickMat(5, 2)); // Norte (fundo da tela)
    E.addSolidWall(37, -20, 37, -4, 0.14, 6.4, 0.35, E.brickMat(4, 2));  // Oeste
    E.addSolidWall(59, -20, 59, -4, 0.14, 6.4, 0.35, E.brickMat(4, 2));  // Leste
    E.addSolidWall(37, -4, 46, -4, 0.14, 6.4, 0.35, E.brickMat(2.2, 2)); // Sul esq
    E.addSolidWall(50, -4, 59, -4, 0.14, 6.4, 0.35, E.brickMat(2.2, 2)); // Sul dir
    var scHeader = E.makeBox(4.2, 2.8, 0.35, E.brickMat(1.2, 0.8));
    scHeader.position.set(48, 5.1, -4);
    E.scene.add(scHeader);

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
    E.scene.add(scSign);

    // Tela gigante do Projetor na parede Norte (z = -19.65)
    E.cinemaCanvas = document.createElement('canvas');
    E.cinemaCanvas.width = 768; E.cinemaCanvas.height = 384;
    E.cinemaCtx = E.cinemaCanvas.getContext('2d');
    E.cinemaTex = new THREE.CanvasTexture(E.cinemaCanvas);
    var cinemaFrame = E.makeBox(11.6, 5.4, 0.18, 0x0f172a);
    cinemaFrame.position.set(48, 3.6, -19.72);
    E.scene.add(cinemaFrame);
    E.cinemaScreenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(11.0, 5.0),
      new THREE.MeshBasicMaterial({ map: E.cinemaTex })
    );
    E.cinemaScreenMesh.position.set(48, 3.6, -19.6);
    E.scene.add(E.cinemaScreenMesh);

    // Projetor no teto + Feixe de luz volumetrico
    var projBody = E.makeBox(0.85, 0.38, 1.0, 0x1e293b, { metalness: 0.6 });
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
    E.cinemaBeam = new THREE.Mesh(new THREE.ConeGeometry(4.2, 10.6, 24, 1, true), beamMat);
    E.cinemaBeam.position.set(48, 4.65, -14.3);
    E.cinemaBeam.rotation.x = Math.PI / 2 - 0.19;
    E.scene.add(projBody, projLens, E.cinemaBeam);

    // 3 fileiras de poltronas do Auditorio (clicaveis para sentar e assistir!)
    [-14.5, -12.2, -9.9].forEach(function (rz, rIdx) {
      var rowBench = E.makeBox(11.0, 0.45, 0.85, 0x991b1b, { roughness: 0.7 });
      rowBench.position.set(48, 0.38 + rIdx * 0.18, rz);
      var rowBack = E.makeBox(11.0, 0.55, 0.16, 0x7f1d1d, { roughness: 0.7 });
      rowBack.position.set(48, 0.78 + rIdx * 0.18, rz + 0.36);
      E.scene.add(rowBench, rowBack);
      E.solidColliders.push({ minX: 42.4, maxX: 53.6, minZ: rz - 0.45, maxZ: rz + 0.45, minY: 0, maxY: 1.4 });
      [-4.4, -2.2, 0, 2.2, 4.4].forEach(function (sx) {
        var audSeatHit = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 0.65, 0.85),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        audSeatHit.position.set(48 + sx, 0.52 + rIdx * 0.18, rz);
        audSeatHit.userData.seatInfo = { x: 48 + sx, y: 0.14 + rIdx * 0.18, z: rz - 0.04, yaw: 0 };
        E.scene.add(audSeatHit);
        E.seatMeshes.push(audSeatHit);
      });
    });

    // Quadra poliesportiva livre (sem guarda-sois)

    // 4b. 2a Praca Circular Leste com Fonte (x: 42, z: 12, sem z-fighting!)
    var plazaE = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.04, 28), new THREE.MeshStandardMaterial({ map: E.texPaving, roughness: 0.88 }));
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
    E.scene.add(plazaE, bedE, wallE, rimTorusE, waterE);
    E.solidColliders.push({ minX: 39.5, maxX: 44.5, minZ: 9.5, maxZ: 14.5, minY: 0, maxY: 1.2 });

    // 4c. 2 Dormitorios Caminhaveis no Sudeste (com porta aberta, piso, cama e mesa!)
    [[58, 12, 0xfacc15], [50, 28, 0x38bdf8]].forEach(function (dm) {
      var dx = dm[0], dz = dm[1];
      E.addWalkableSlab(dx, 0.14, dz, 14, 0.14, 10, 0x475569);
      var dRoof = E.makeBox(14.6, 0.4, 10.6, 0x64748b);
      dRoof.position.set(dx, 5.4, dz);
      E.registerSnowable(dRoof.material);
      E.roofZones.push({ minX: dx - 7.5, maxX: dx + 7.5, minZ: dz - 5.5, maxZ: dz + 5.5, roofY: 5.6 });
      E.scene.add(dRoof);
      E.addSolidWall(dx - 7, dz - 5, dx + 7, dz - 5, 0.14, 5.1, 0.3, E.brickMat(3, 2)); // Fundo
      E.addSolidWall(dx - 7, dz - 5, dx - 7, dz + 5, 0.14, 5.1, 0.3, E.brickMat(2, 2)); // Esq
      E.addSolidWall(dx + 7, dz - 5, dx + 7, dz + 5, 0.14, 5.1, 0.3, E.brickMat(2, 2)); // Dir
      // Frente (dz + 5) com porta aberta em dx - 4.0 (largura 2.4m)
      E.addSolidWall(dx - 7, dz + 5, dx - 5.2, dz + 5, 0.14, 5.1, 0.3, E.brickMat(1, 2));
      E.addSolidWall(dx - 2.8, dz + 5, dx + 7, dz + 5, 0.14, 5.1, 0.3, E.brickMat(2, 2));
      var dHeader = E.makeBox(2.5, 2.3, 0.3, E.brickMat(1, 1));
      dHeader.position.set(dx - 4.0, 4.1, dz + 5);
      var awning = E.makeBox(2.8, 0.25, 1.3, dm[2]);
      awning.position.set(dx - 4.0, 2.95, dz + 5.65);
      // Cama & escrivaninha interna
      var bed = E.makeBox(2.2, 0.55, 1.3, 0x3b82f6, { roughness: 0.7 });
      bed.position.set(dx + 3.5, 0.42, dz - 2.5);
      var dDesk = E.makeBox(1.8, 0.75, 0.9, 0xd97706, { roughness: 0.65 });
      dDesk.position.set(dx + 3.5, 0.52, dz + 2.5);
      E.scene.add(dHeader, awning, bed, dDesk);
      E.solidColliders.push({ minX: dx + 2.3, maxX: dx + 4.7, minZ: dz - 3.2, maxZ: dz - 1.8, minY: 0, maxY: 0.69, surfaceTopY: 0.69 });
      E.solidColliders.push({ minX: dx + 2.5, maxX: dx + 4.5, minZ: dz + 2.0, maxZ: dz + 3.0, minY: 0, maxY: 0.89, surfaceTopY: 0.89 });
      E.supportSurfaces.push({ minX: dx + 2.3, maxX: dx + 4.7, minZ: dz - 3.2, maxZ: dz - 1.8, topY: 0.69 });
      E.supportSurfaces.push({ minX: dx + 2.5, maxX: dx + 4.5, minZ: dz + 2.0, maxZ: dz + 3.0, topY: 0.89 });
    });
  }

  // ---------------- Colisao & Posicionamento de Itens ----------------

  E.getCinemaHitTarget = function (uv) {
    if (!E.cinemaPower) return { type: 'power_on' };
    var px = (uv ? uv.x : 0.5) * 768;
    var py = (uv ? uv.y : 0.5) * 384;
    if (px >= 624 && px <= 752 && py >= 10 && py <= 46) return { type: 'power_off' };
    if (E.cinemaLessonIdx === -1) {
      var count = E.cinemaLessons.length || 6;
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

  E.cinemaFrameAccum = 0, E.cinemaDrawnOnce = false;
  E.drawCinemaVideoFrame = function (dt) {
    if (!E.cinemaCtx || !E.cinemaTex) return;
    if (E.cinemaPower && E.cinemaLessonIdx >= 0 && E.cinemaPlaying) E.cinemaTime += dt;
    E.cinemaFrameAccum += dt;
    if (!E.cinemaDirty) {
      if (!E.cinemaPower || E.cinemaLessonIdx === -1 || !E.cinemaPlaying) return;
      if (E.cinemaFrameAccum < 0.09) return;
      if (E.camera && Math.hypot(E.camera.position.x - 48, E.camera.position.z + 12) > 65) return;
    }
    E.cinemaFrameAccum = 0;
    E.cinemaDirty = false;
    E.cinemaDrawnOnce = true;
    var ctx = E.cinemaCtx;
    var W = 768, H = 384;

    // 1) TELA DESLIGADA (preto / cinza escuro com LED standby)
    if (!E.cinemaPower) {
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
      E.cinemaTex.needsUpdate = true;
      return;
    }

    // Fundo ligado
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0f172a');
    g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var hoverTarget = E.hoveredCinema ? E.getCinemaHitTarget(E.hoveredCinemaUv) : { type: 'none' };

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
    if (E.cinemaLessonIdx === -1) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText('🎬 AUDITÓRIO MYCOCAMPUS — MÓDULOS & AULAS', 22, 35);

      var list = E.cinemaLessons.length ? cinemaLessons : [
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
      E.cinemaTex.needsUpdate = true;
      return;
    }

    // 3) REPRODUZINDO AULA SELECIONADA
    var lesson = E.cinemaLessons[E.cinemaLessonIdx] || { title: 'Aula', subtitle: '', bullets: [] };
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
    var headTitle = lesson.title || ('Módulo ' + (E.cinemaLessonIdx + 1));
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
    var t = E.cinemaTime;
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
    ctx.fillText(E.cinemaPlaying ? '⏸️ Clique na aula para pausar' : '▶️ PAUSADO (clique para continuar)', 22, H - 17);
    var prog = (t % 20) / 20;
    ctx.fillStyle = '#334155';
    ctx.fillRect(420, H - 25, 320, 8);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(420, H - 25, 320 * prog, 8);
    E.cinemaTex.needsUpdate = true;
  }

})();