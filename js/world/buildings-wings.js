/**
 * MycoCampus 3D — Building Wings, Stairs, Auditorium, Clock Tower & Whiteboards
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.createVenetianBlind = function (xPos, topY, zCenter, blindW, dropH, dir, roomCenterZ) {
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
      id: 'blind_' + E.windowBlinds.length,
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
    E.blindHitMeshes.push(hitMesh);
    E.windowBlinds.push(blindObj);
    E.scene.add(root);
  }

  E.buildCampusBuildingWing = function (opts) {
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
    E.addWalkableSlab(cx, yFloor1, cz, w + 0.4, 0.14, d + 0.4, 0x475569, { roughness: 0.7 });
    E.addWalkableSlab(cx, yFloor2, cz, w + 0.35, 0.24, d + 0.35, 0x334155, { roughness: 0.55 });

    // Teto e platibanda cinza
    var roofSlab = E.makeBox(w + 0.6, 0.32, d + 0.6, 0x94a3b8, { roughness: 0.5 });
    roofSlab.position.set(cx, yFloor2 + h2 + 0.16, cz);
    E.registerSnowable(roofSlab.material);
    E.roofZones.push({ minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5, minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5, roofY: yFloor2 + h2 + 0.32 });
    E.scene.add(roofSlab);
    var parapet = E.makeBox(w + 0.72, 0.42, d + 0.72, 0x64748b, { roughness: 0.5 });
    parapet.position.set(cx, yFloor2 + h2 + 0.43, cz);
    E.scene.add(parapet);

    // Pilares de concreto escuro apenas nos cantos (deixa a porta central 100% livre!)
    [[frontX, zN], [frontX, zS], [backX, zN], [backX, zS]].forEach(function (pp) {
      var col = E.makeBox(0.45, totalH + 0.35, 0.45, 0x1e293b, { roughness: 0.5 });
      col.position.set(pp[0], yFloor1 + totalH / 2, pp[1]);
      E.scene.add(col);
    });

    var wallMat = opts.style === 'wood' ? E.woodMat(3, 2) : E.brickMat(3, 2);
    var glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.25 });

    // Parede dos fundos (1o e 2o andares)
    E.addSolidWall(backX, zN, backX, zS, yFloor1, totalH, 0.28, wallMat);

    // Parede Norte: 1o andar fechado, 2o andar com vao de porta se connectNorth2F
    E.addSolidWall(backX, zN, frontX, zN, yFloor1, h1, 0.28, E.brickMat(2.5, 1.2));
    if (opts.connectNorth2F) {
      // Vao central de 3.2m na parede norte do 2o andar (x: cx - 1.6 .. cx + 1.6)
      E.addSolidWall(backX, zN, cx - 1.6, zN, yFloor2, h2, 0.28, E.brickMat(1, 1));
      E.addSolidWall(cx + 1.6, zN, frontX, zN, yFloor2, h2, 0.28, E.brickMat(1, 1));
      var headerN = E.makeBox(3.2, 0.7, 0.28, 0x334155);
      headerN.position.set(cx, yFloor2 + h2 - 0.35, zN);
      E.scene.add(headerN);
    } else {
      E.addSolidWall(backX, zN, frontX, zN, yFloor2, h2, 0.28, E.brickMat(2.5, 1.2));
    }

    // Parede Sul: 1o andar fechado, 2o andar com vao se connectSouth2F
    E.addSolidWall(backX, zS, frontX, zS, yFloor1, h1, 0.28, E.brickMat(2.5, 1.2));
    if (opts.connectSouth2F) {
      E.addSolidWall(backX, zS, cx - 1.6, zS, yFloor2, h2, 0.28, E.brickMat(1, 1));
      E.addSolidWall(cx + 1.6, zS, frontX, zS, yFloor2, h2, 0.28, E.brickMat(1, 1));
      var headerS = E.makeBox(3.2, 0.7, 0.28, 0x334155);
      headerS.position.set(cx, yFloor2 + h2 - 0.35, zS);
      E.scene.add(headerS);
    } else {
      E.addSolidWall(backX, zS, frontX, zS, yFloor2, h2, 0.28, E.brickMat(2.5, 1.2));
    }

    // Fachada de vidro do 2o andar (sempre solida para nao cair pela janela, sem projetar sombra preta!)
    E.addSolidWall(frontX, zN, frontX, zS, yFloor2, h2 - 0.1, 0.14, glassMat, { noShadow: true });
    for (var m = -2; m <= 2; m++) {
      var mullion = E.makeBox(0.18, h2 - 0.1, 0.12, 0x0f172a);
      mullion.position.set(frontX, yFloor2 + (h2 - 0.1) / 2, cz + m * (d / 5));
      E.scene.add(mullion);
    }
    // Persianas horizontais clicaveis nos 2 lados de vidro do 2o andar
    E.createVenetianBlind(frontX - dir * 0.11, yFloor2 + h2 - 0.14, cz - d * 0.24, d * 0.45, h2 - 0.26, dir, cz);
    E.createVenetianBlind(frontX - dir * 0.11, yFloor2 + h2 - 0.14, cz + d * 0.24, d * 0.45, h2 - 0.26, dir, cz);

    // Forro claro no teto do 1o andar (abaixo da laje do 2o andar em y = 3.555)
    var ceilPlaster1 = E.makeBox(w - 0.1, 0.02, d - 0.1, 0xe2e8f0, { roughness: 0.7, noShadow: true });
    ceilPlaster1.position.set(cx, 3.55, cz);
    E.scene.add(ceilPlaster1);

    // Iluminacao realista em TODAS as salas (1o e 2o andares): 4 luminarias + PointLight + Interruptor por sala!
    var fixMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.4 });
    function createFloorLighting(floorY, floorH, swX, swY, swZ, swRotY) {
      var fTubeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfffbeb, emissiveIntensity: 0.85, roughness: 0.35 });
      var ceilY = floorY < 1.0 ? 3.51 : (floorY + floorH - 0.04);
      [-2.0, 2.0].forEach(function (lx) {
        [-2.8, 2.8].forEach(function (lz) {
          var trayL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 1.65), fixMat);
          trayL.position.set(cx + lx, ceilY, cz + lz);
          E.scene.add(trayL);
          [-0.1, 0.1].forEach(function (tx) {
            var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.5, 8), fTubeMat);
            tube.rotation.x = Math.PI / 2;
            tube.position.set(cx + lx + tx, ceilY - 0.04, cz + lz);
            E.scene.add(tube);
          });
        });
      });
      // Iluminação acolhedora e equilibrada (sem estourar branco no PC)
      var fLight = new THREE.PointLight(0xfffbeb, E.isTouchDevice() ? 1.15 : 0.82, 22, 1.55);
      fLight.position.set(cx, ceilY - 0.30, cz);
      E.scene.add(fLight);

      var swGroup = new THREE.Group();
      swGroup.position.set(swX, swY, swZ);
      swGroup.rotation.y = swRotY || 0;
      var swPlate = E.makeBox(0.18, 0.28, 0.03, 0xf8fafc, { roughness: 0.3 });
      var swRocker = E.makeBox(0.08, 0.12, 0.04, 0xe2e8f0, { roughness: 0.4 });
      swRocker.position.z = 0.02;
      swRocker.rotation.x = -0.22;
      var swLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      var swLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.02), swLedMat);
      swLed.position.set(0, 0.09, 0.025);
      swGroup.add(swPlate, swRocker, swLed);
      var swData = {
        id: 'light_' + E.campusLightSwitches.length,
        on: true,
        light: fLight,
        gLight: null,
        tubeMat: fTubeMat,
        ledMat: swLedMat,
        rocker: swRocker
      };
      swPlate.userData.lightSwitch = swData;
      swRocker.userData.lightSwitch = swData;
      E.lightSwitchMeshes.push(swPlate, swRocker);
      E.campusLightSwitches.push(swData);
      E.scene.add(swGroup);
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
      E.scene.add(deskGrp);
      E.solidColliders.push({
        minX: deskX - 0.56, maxX: deskX + 0.56,
        minZ: deskZ - 1.02, maxZ: deskZ + 1.02,
        minY: yFloor2, maxY: yFloor2 + 0.745, surfaceTopY: yFloor2 + 0.745
      });
      var deskSurf = {
        minX: deskX - 0.50, maxX: deskX + 0.50,
        minZ: deskZ - 0.94, maxZ: deskZ + 0.94,
        topY: yFloor2 + 0.745
      };
      E.supportSurfaces.push(deskSurf);
      deskTop.userData.supportSurface = deskSurf;
      E.supportMeshes.push(deskTop);

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
        E.seatMeshes.push(seatPad, backPad);
        E.scene.add(cg);
      });
    }
    var board = E.makeBox(0.1, 2.35, 8.0, 0x78350f, { roughness: 0.6 });
    board.position.set(backX + dir * 0.22, yFloor2 + 2.02, cz);
    E.scene.add(board);

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
    E.scene.add(bMesh);
    E.chalkboards[bIdx] = { id: bIdx, mesh: bMesh, canvas: bCanvas, ctx: bCtx, tex: bTex };
    E.chalkboardMeshes.push(bMesh);

    // Bandeja de giz & apagador
    var trayX = backX + dir * 0.42;
    var trayY = yFloor2 + 0.84;
    var tray = E.makeBox(0.38, 0.08, 6.8, 0x78350f, { roughness: 0.7 });
    tray.position.set(trayX, trayY, cz);
    E.scene.add(tray);
    E.supportSurfaces.push({
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
      E.registerPickable(cd.id, cd.label, cg, trayX, trayY + 0.04, cz + cd.dz, 0, 0.15, 0.12);
    });

    // Apagador largo de madeira + feltro (sem sobreposicao / z-fighting)
    var eraser = new THREE.Group();
    var eWood = E.makeBox(0.12, 0.06, 0.28, 0x92400e, { roughness: 0.75 });
    eWood.position.y = 0.06;
    var eFelt = E.makeBox(0.12, 0.03, 0.28, 0x1e293b, { roughness: 0.95 });
    eFelt.position.y = 0.015;
    eraser.add(eWood, eFelt);
    E.registerPickable('board_eraser' + bSuffix, 'Apagador da Lousa', eraser, trayX, trayY + 0.04, cz + 0.95, 0, 0.2, 0.14);

    // Fachada do 1o andar (terreo): totalmente fechadinha com Vidro + Esquadrias + Persianas + Porta Central Articulada com Batente e Bandeira Superior!
    var doorHalfW = 0.96;
    var doorH = 2.75;
    E.addSolidWall(frontX, zN, frontX, cz - doorHalfW, yFloor1, h1, 0.14, glassMat, { noShadow: true });
    E.addSolidWall(frontX, cz + doorHalfW, frontX, zS, yFloor1, h1, 0.14, glassMat, { noShadow: true });

    // Bandeira de vidro acima da porta (fecha o vao entre yFloor1 + doorH e o teto yFloor1 + h1!)
    var transomH = h1 - doorH;
    var transomGlass = E.makeBox(0.12, transomH, doorHalfW * 2, glassMat, { noShadow: true });
    transomGlass.position.set(frontX, yFloor1 + doorH + transomH / 2, cz);
    E.scene.add(transomGlass);

    // Batentes verticais da porta, travessa superior e esquadrias das janelas
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.35 });
    [-doorHalfW, doorHalfW].forEach(function (dz) {
      var jamb = new THREE.Mesh(new THREE.BoxGeometry(0.20, h1, 0.14), frameMat);
      jamb.position.set(frontX, yFloor1 + h1 / 2, cz + dz);
      E.scene.add(jamb);
    });
    var transomBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, doorHalfW * 2 + 0.14), frameMat);
    transomBar.position.set(frontX, yFloor1 + doorH, cz);
    var topFacadeBar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, d - 0.3), frameMat);
    topFacadeBar.position.set(frontX, yFloor1 + h1 - 0.05, cz);
    E.scene.add(transomBar, topFacadeBar);

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
      E.scene.add(signMesh);
    }

    // Persianas horizontais clicaveis cobrindo todo o vidro de cada lado da porta (Esquerda e Direita)
    var sideWinW = (d / 2) - doorHalfW - 0.26;
    var sideCenterOffset = doorHalfW + 0.04 + sideWinW / 2;
    E.createVenetianBlind(frontX - dir * 0.11, yFloor1 + h1 - 0.08, cz - sideCenterOffset, sideWinW, h1 - 0.16, dir, cz);
    E.createVenetianBlind(frontX - dir * 0.11, yFloor1 + h1 - 0.08, cz + sideCenterOffset, sideWinW, h1 - 0.16, dir, cz);

    // Folha da porta articulada com moldura metalica e macaneta dupla
    var doorPivot = new THREE.Group();
    doorPivot.position.set(frontX, yFloor1, cz - doorHalfW + 0.04);
    var leafW = (doorHalfW - 0.04) * 2;
    var doorGlass = E.makeBox(0.036, doorH - 0.17, leafW - 0.15, 0x0f766e, { transparent: true, opacity: 0.58, roughness: 0.15, noShadow: true });
    doorGlass.position.set(0, doorH / 2 - 0.01, leafW / 2);
    var stL = new THREE.Mesh(new THREE.BoxGeometry(0.11, doorH, 0.08), frameMat);
    stL.position.set(0, doorH / 2, 0.04);
    var stR = new THREE.Mesh(new THREE.BoxGeometry(0.11, doorH, 0.08), frameMat);
    stR.position.set(0, doorH / 2, leafW - 0.04);
    var rlT = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.08, leafW - 0.16), frameMat);
    rlT.position.set(0, doorH - 0.04, leafW / 2);
    var rlB = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.10, leafW - 0.16), frameMat);
    rlB.position.set(0, 0.05, leafW / 2);
    var doorHandle = E.makeBox(0.18, 0.42, 0.035, 0xe2e8f0, { metalness: 0.85, roughness: 0.2, noShadow: true });
    doorHandle.position.set(0, 1.12, leafW - 0.18);
    doorPivot.add(doorGlass, stL, stR, rlT, rlB, doorHandle);
    E.scene.add(doorPivot);

    var doorObj = {
      id: 'door_' + E.campusDoors.length,
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
    E.doorHitMeshes.push(doorGlass, stL, stR, doorHandle);
    E.campusDoors.push(doorObj);
  }

  // ---------------- Escadaria, Passarela Elevada & Torre do Relogio ----------------

  // Ciclo completo de 40 minutos reais (20 min dia + 20 min noite) sincronizado para todos via UTC
  E.buildStaircaseAndBridge = function () {
    var yTop = 3.80;
    // 14 degraus arquitetonicos de z=-11.5 ate z=-18.5 (subindo de y=0 ate y=3.80)
    var steps = 14;
    var stepD = 7.0 / steps;
    var stepH = yTop / steps;
    var riserMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
    var treadMat = new THREE.MeshStandardMaterial({ map: E.texPaving, color: 0xe2e8f0, roughness: 0.65 });
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
      E.scene.add(riser, tread, nose);
    }
    E.stairsList.push({ minX: -4.15, maxX: 4.15, zStart: -11.5, zEnd: -18.5, yStart: 0, yEnd: yTop });

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
      E.scene.add(stringer, glassPanel, handrail);

      for (var pIdx = 0; pIdx <= 3; pIdx++) {
        var frac = pIdx / 3;
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.02, 0.08), steelMat);
        post.position.set(rx, frac * yTop + 0.51, -11.5 - frac * 7.0);
        E.scene.add(post);
      }
      E.solidColliders.push({ minX: rx - 0.22, maxX: rx + 0.22, minZ: -18.55, maxZ: -11.45, minY: 0, maxY: 5.0 });
    });

    // Patamar Superior atras do topo da escada (z = -22.5 .. -18.5, livre dos degraus e conectado ao Relogio e as duas alas!)
    E.addWalkableSlab(0, yTop, -20.5, 5.6, 0.34, 4.0, 0x475569, { roughness: 0.6 });
    E.addWalkableSlab(-12.0, yTop, -20.5, 18.4, 0.34, 4.0, 0x475569, { roughness: 0.6 });
    E.addWalkableSlab(12.0, yTop, -20.5, 18.4, 0.34, 4.0, 0x475569, { roughness: 0.6 });

    // Pontes laterais ligando o Patamar (-18.5) direto as portas do 2o andar (-12.975) dos dois lados (x = +-19)
    [-19, 19].forEach(function (ax) {
      E.addWalkableSlab(ax, yTop, -15.7375, 4.4, 0.34, 5.525, 0x475569, { roughness: 0.6 });
      E.addSolidWall(ax - 2.12, -18.5, ax - 2.12, -12.975, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
      E.addSolidWall(ax + 2.12, -18.5, ax + 2.12, -12.975, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    });

    // Pilares estruturais sustentando o patamar superior e as pontes laterais
    [-19, -11, 11, 19].forEach(function (px) {
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, yTop - 0.34, 14), steelMat);
      col.position.set(px, (yTop - 0.34) / 2, -20.5);
      col.castShadow = true; col.receiveShadow = true;
      E.scene.add(col);
    });
    [-19, 19].forEach(function (px) {
      var colS = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, yTop - 0.34, 14), steelMat);
      colS.position.set(px, (yTop - 0.34) / 2, -15.5);
      colS.castShadow = true; colS.receiveShadow = true;
      E.scene.add(colS);
    });

    // Guarda-corpo de vidro + corrimao metalico no patamar superior (sem bloquear a saida da escada nem a Ponte Norte)
    [-1, 1].forEach(function (side) {
      E.addSolidWall(side * 4.25, -18.55, side * 16.85, -18.55, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
      var railS = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.06, 0.1), railMetalMat);
      railS.position.set(side * 10.55, yTop + 1.03, -18.55);
      E.scene.add(railS);

      E.addSolidWall(side * 2.8, -22.45, side * 21.15, -22.45, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
      var railN = new THREE.Mesh(new THREE.BoxGeometry(18.35, 0.06, 0.1), railMetalMat);
      railN.position.set(side * 11.975, yTop + 1.03, -22.45);
      E.scene.add(railN);

      E.addSolidWall(side * 21.15, -22.45, side * 21.15, -18.55, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    });

    // Pontes ligando Bloco Norte <-> Bloco Sul no 2o andar (x = +-19, z = -1.025 .. 2.025, y = 3.80, encontro exato sem z-fighting)
    [-19, 19].forEach(function (ax) {
      E.addWalkableSlab(ax, yTop, 0.5, 4.4, 0.28, 3.05, 0x475569, { roughness: 0.6 });
      E.addSolidWall(ax - 2.1, -1.025, ax - 2.1, 2.025, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
      E.addSolidWall(ax + 2.1, -1.025, ax + 2.1, 2.025, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Terraco Norte (y = 3.80, x: -24..24, z: -29.5 .. -42.0) — separado da passarela por um Lago Norte organico
    E.addWalkableSlab(0, yTop, -35.75, 48.0, 3.80, 12.5, 0x94a3b8, { roughness: 0.8 });

    // Ponte Norte sobre o lago ligando o Patamar (-22.5) ate o Terraco da Torre do Relogio (-29.5)
    E.addWalkableSlab(0, yTop, -26.0, 5.6, 0.34, 7.0, 0x64748b, { roughness: 0.65 });
    [-2.75, 2.75].forEach(function (bx) {
      E.addSolidWall(bx, -29.5, bx, -22.5, yTop, 1.05, 0.12, 0xbae6fd, { transparent: true, opacity: 0.45 });
    });

    // Lago Norte organico com borda de pedras dos dois lados da Ponte Norte
    var nLakeMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.88 });
    var nRimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    [-7.2, 7.2].forEach(function (lx) {
      var pond = new THREE.Mesh(new THREE.CircleGeometry(4.6, 26), nLakeMat);
      pond.rotation.x = -Math.PI / 2;
      pond.scale.set(1.2, 0.9, 1);
      pond.position.set(lx, 0.06, -24.0);
      E.scene.add(pond);
      var rim = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.05, 26), nRimMat);
      rim.rotation.x = -Math.PI / 2;
      rim.scale.set(1.2, 0.9, 1);
      rim.position.set(lx, 0.055, -24.0);
      E.scene.add(rim);
    });
  }

  E.buildClockTowerAndAuditorium = function () {
    var baseY = 3.80;

    // Alas laterais simetricas da Reitoria caminhaveis com porta aberta (z = -40.2..-33.8)
    [-9.5, 9.5].forEach(function (ax) {
      E.addWalkableSlab(ax, baseY, -37.0, 11.0, 0.2, 6.4, 0x334155);
      var rRoof = E.makeBox(11.4, 0.45, 6.8, 0x64748b);
      rRoof.position.set(ax, baseY + 6.3, -37.0);
      E.registerSnowable(rRoof.material);
      E.roofZones.push({ minX: ax - 5.7, maxX: ax + 5.7, minZ: -40.4, maxZ: -33.6, roofY: baseY + 6.5 });
      E.scene.add(rRoof);

      E.addSolidWall(ax - 5.5, -40.2, ax + 5.5, -40.2, baseY, 6.1, 0.28, E.brickMat(3, 2)); // Fundo
      E.addSolidWall(ax - 5.5, -40.2, ax - 5.5, -33.8, baseY, 6.1, 0.28, E.brickMat(2, 2)); // Esq
      E.addSolidWall(ax + 5.5, -40.2, ax + 5.5, -33.8, baseY, 6.1, 0.28, E.brickMat(2, 2)); // Dir
      // Fachada frontal (z = -33.8) com porta aberta de 2.4m no centro e janelas laterais
      E.addSolidWall(ax - 5.5, -33.8, ax - 1.2, -33.8, baseY, 6.1, 0.26, E.brickMat(1.2, 2));
      E.addSolidWall(ax + 1.2, -33.8, ax + 5.5, -33.8, baseY, 6.1, 0.26, E.brickMat(1.2, 2));
      var doorHeader = E.makeBox(2.5, 3.1, 0.28, E.brickMat(1, 1));
      doorHeader.position.set(ax, baseY + 4.55, -33.8);
      var rDesk = E.makeBox(2.6, 0.78, 1.1, 0x92400e, { roughness: 0.65 });
      rDesk.position.set(ax, baseY + 0.39, -38.2);
      E.scene.add(doorHeader, rDesk);
      E.solidColliders.push({ minX: ax - 1.35, maxX: ax + 1.35, minZ: -38.8, maxZ: -37.6, minY: baseY, maxY: baseY + 1.0 });
      E.supportSurfaces.push({ minX: ax - 1.25, maxX: ax + 1.25, minZ: -38.7, maxZ: -37.7, topY: baseY + 0.78 });
    });

    // Torre Central do Relogio
    var tower = E.makeBox(5.6, 12.6, 6.8, 0x64748b, { roughness: 0.55 });
    tower.position.set(0, baseY + 6.3, -37.0);
    E.scene.add(tower);
    var towerFrame = E.makeBox(3.6, 7.6, 0.16, 0x0f172a);
    towerFrame.position.set(0, baseY + 4.3, -33.52);
    E.scene.add(towerFrame);

    // Painel 3D Interativo de Ranking logo abaixo do Relogio
    E.rankingCanvas = document.createElement('canvas');
    E.rankingCanvas.width = 512; E.rankingCanvas.height = 1024;
    E.rankingCtx = E.rankingCanvas.getContext('2d');
    E.rankingTex = new THREE.CanvasTexture(E.rankingCanvas);
    var rankBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 6.6),
      new THREE.MeshBasicMaterial({ map: E.rankingTex })
    );
    rankBoard.position.set(0, baseY + 4.5, -33.42);
    E.scene.add(rankBoard);

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
      E.scene.add(btn);
      E.rankingBtnMeshes.push(btn);
    });
    E.drawRankingBoard();
    E.solidColliders.push({ minX: -2.9, maxX: 2.9, minZ: -40.5, maxZ: -33.5, minY: baseY, maxY: baseY + 13 });

    // Relogio funcional no topo da torre
    E.clockCanvas = document.createElement('canvas');
    E.clockCanvas.width = 256; E.clockCanvas.height = 256;
    E.clockCtx = E.clockCanvas.getContext('2d');
    E.clockTex = new THREE.CanvasTexture(E.clockCanvas);
    E.updateClockTexture();
    var clockMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 28),
      new THREE.MeshBasicMaterial({ map: E.clockTex })
    );
    clockMesh.position.set(0, baseY + 10.4, -33.5);
    E.scene.add(clockMesh);

    // Banners da Reitoria
    E.createBanner(-4.6, baseY + 4.0, -33.6, 0, '#1d4ed8', '🎓');
    E.createBanner(4.6, baseY + 4.0, -33.6, 0, '#4338ca', '🍄');
  }

  E.updateCampusAuditoriumSlide = function (slideIndex, title, subtitle, bullets, presenter) {
    if (!E.auditoriumCtx || !E.auditoriumTex) return;
    var ctx = E.auditoriumCtx;
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

    E.auditoriumTex.needsUpdate = true;
  }

  // ---------------- Itens Pegaveis & Equipamentos das Alas ----------------

  E.drawBoardSegment = function (ctx, color, p0, p1) {
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

  E.applyStrokeToBoard = function (st) {
    var b = E.chalkboards[st && st.b ? st.b : 0] || E.chalkboards[0];
    if (!b || !st || !st.pts || !st.pts.length) return;
    var pts = st.pts;
    for (var i = 0; i < pts.length; i++) {
      var p0 = i === 0 ? pts[0] : pts[i - 1];
      E.drawBoardSegment(b.ctx, st.c, p0, pts[i]);
    }
    b.tex.needsUpdate = true;
  }

  E.getHeldBoardToolColor = function () {
    if (!E.heldItem) return null;
    if (E.heldItem.id.indexOf('chalk_white') === 0) return '#f8fafc';
    if (E.heldItem.id.indexOf('chalk_green') === 0) return '#4ade80';
    if (E.heldItem.id.indexOf('chalk_yellow') === 0) return '#facc15';
    if (E.heldItem.id.indexOf('board_eraser') === 0) return 'erase';
    return null;
  }

  E.flushCurrentStroke = function () {
    if (E.currentStroke && E.currentStroke.pts.length > 0) {
      E.pendingBoardStrokes.push(E.currentStroke);
    }
    E.currentStroke = null;
    E.lastDrawPt = null;
  }
  E.drawRankingBoard = function () {
    if (!E.rankingCtx || !E.rankingTex) return;
    var ctx = E.rankingCtx;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 1024);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 14, 484, 90);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 RANKING DO CAMPUS', 256, 70);

    var perPage = 8;
    var maxStart = Math.max(0, E.rankingList.length - perPage);
    if (E.rankingScroll > maxStart) E.rankingScroll = maxStart;

    if (!E.rankingList.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText('Carregando ranking...', 256, 260);
    } else {
      for (var i = 0; i < perPage; i++) {
        var idx = E.rankingScroll + i;
        if (idx >= E.rankingList.length) break;
        var row = E.rankingList[idx];
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
      ctx.fillText((E.rankingScroll + 1) + '–' + Math.min(E.rankingList.length, E.rankingScroll + perPage) + ' de ' + E.rankingList.length, 256, 985);
    }
    E.rankingTex.needsUpdate = true;
  }

})();