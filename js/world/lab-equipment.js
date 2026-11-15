/**
 * MycoCampus 3D — Mycology Lab, Storage, Laminar Flow, Autoclave & Sterilization
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.buildCampusWingsAndEquipment = function () {
    // ALA OESTE (Esquerda) — 2 blocos de 2 andares (x: -24..-14)
    // Bloco Oeste-Norte (z: -12.8..-1.2): LABORATORIO DE FLUXO LAMINAR & AUTOCLAVE + 2o andar acessivel
    E.buildCampusBuildingWing({ cx: -19, cz: -7, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Laboratório', doorSign: '🔬 LAB', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 0 });
    // Bloco Oeste-Sul (z: 2.2..13.8): DEPOSITO DE INSUMOS & EQUIPAMENTOS (1o andar) + Sala de Aula (2o andar)
    E.buildCampusBuildingWing({ cx: -19, cz: 8, width: 10, depth: 11.6, faceDir: 1, doorLabel: 'Porta do Depósito', doorSign: '📦 DEPÓSITO', style: 'brick', connectNorth2F: true, boardIndex: 1 });

    E.createBanner(-13.85, 5.1, -11.6, Math.PI / 2, '#6d28d9', '🔬');
    E.createBanner(-13.85, 5.1, -2.4, Math.PI / 2, '#1d4ed8', '🧬');
    E.createBanner(-13.85, 5.1, 12.6, Math.PI / 2, '#d97706', '📦');

    // Equipamentos do Lab dentro do Bloco Oeste-Norte (x: -24..-14, z: -12.8..-1.2)
    function updateItemBounds(item) {
      if (!item || !item.mesh) return;
      var px = item.mesh.position.x, py = item.mesh.position.y, pz = item.mesh.position.z;
      var surf = item.mesh.userData.dynamicSurface;
      var col = item.mesh.userData.dynamicCollider;
      var dims = item.mesh.userData.tableDims;
      if (dims) {
        var cRot = Math.abs(Math.cos(item.mesh.rotation.y));
        var sRot = Math.abs(Math.sin(item.mesh.rotation.y));
        var hw = (dims.w * cRot + dims.d * sRot) / 2;
        var hd = (dims.w * sRot + dims.d * cRot) / 2;
        if (surf) {
          surf.minX = px - hw + 0.02; surf.maxX = px + hw - 0.02;
          surf.minZ = pz - hd + 0.02; surf.maxZ = pz + hd - 0.02;
          surf.topY = py + dims.h + (dims.surfOffset || 0);
        }
        if (col) {
          col.minX = px - hw - 0.05; col.maxX = px + hw + 0.05;
          col.minZ = pz - hd - 0.05; col.maxZ = pz + hd + 0.05;
          col.minY = py; col.maxY = py + dims.h; col.surfaceTopY = py + dims.h;
        }
      }
    }

    function isSurfaceOccupied(surf, ignoreItem) {
      if (!surf) return false;
      for (var i = 0; i < E.pickableItems.length; i++) {
        var o = E.pickableItems[i];
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
      var col = { minX: tx - tw / 2 - 0.05, maxX: tx + tw / 2 + 0.05, minZ: tz - td / 2 - 0.05, maxZ: tz + td / 2 + 0.05, minY: floorY, maxY: floorY + th, surfaceTopY: floorY + th };
      E.supportSurfaces.push(surf);
      top.userData.supportSurface = surf;
      E.supportMeshes.push(top);
      E.solidColliders.push(col);
      tg.userData.twoHanded = true;
      tg.userData.isTable = true;
      tg.userData.tableDims = { w: tw, h: th, d: td, surfOffset: 0 };
      tg.userData.dynamicSurface = surf;
      tg.userData.dynamicCollider = col;
      tg.userData.updateBounds = updateItemBounds;
      tg.userData.isBlockedPickup = function (item) { return isSurfaceOccupied(surf, item); };
      E.registerPickable(id, label, tg, tx, floorY, tz, 0, Math.max(tw, td) * 0.5, th);
    }

    // Bancadas fixas nas paredes do Laboratorio (Oeste e Norte) + Estante de Culturas Solidas (Sul)
    function addWallLabBench(bx, bz, bw, bd) {
      var cab = E.makeBox(bw, 0.82, bd, 0xe2e8f0, { roughness: 0.55 });
      cab.position.set(bx, 0.14 + 0.41, bz);
      var trim = E.makeBox(bw + 0.02, 0.72, bd + 0.02, 0x0284c7, { roughness: 0.5 });
      trim.position.set(bx, 0.14 + 0.36, bz);
      var top = E.makeBox(bw + 0.04, 0.06, bd + 0.04, 0x94a3b8, { roughness: 0.35, metalness: 0.25 });
      top.position.set(bx, 0.14 + 0.85, bz);
      E.scene.add(trim, cab, top);
      E.solidColliders.push({ minX: bx - bw / 2 - 0.05, maxX: bx + bw / 2 + 0.05, minZ: bz - bd / 2 - 0.05, maxZ: bz + bd / 2 + 0.05, minY: 0.14, maxY: 1.02, surfaceTopY: 1.02 });
      var benchSurf = { minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, topY: 1.02 };
      E.supportSurfaces.push(benchSurf);
      top.userData.supportSurface = benchSurf;
      E.supportMeshes.push(top);
    }
    addWallLabBench(-23.15, -7.0, 1.2, 10.6); // Parede Oeste inteira
    addWallLabBench(-18.5, -12.0, 8.1, 1.1);  // Parede Norte inteira

    // Estante 3 niveis para Culturas Solidas (Parede Sul do Lab)
    var rackX = -19.2, rackZ = -1.85;
    var rackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.65, roughness: 0.3 });
    [0.62, 1.18, 1.74].forEach(function (sy) {
      var sh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 0.68), rackMat);
      sh.position.set(rackX, 0.14 + sy, rackZ);
      E.scene.add(sh);
      var shSurf = { minX: rackX - 1.55, maxX: rackX + 1.55, minZ: rackZ - 0.3, maxZ: rackZ + 0.3, topY: 0.14 + sy + 0.02 };
      E.supportSurfaces.push(shSurf);
      sh.userData.supportSurface = shSurf;
      E.supportMeshes.push(sh);
    });
    [-1.56, 1.56].forEach(function (pxOff) {
      [-0.31, 0.31].forEach(function (pzOff) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8), rackMat);
        post.position.set(rackX + pxOff, 0.14 + 0.95, rackZ + pzOff);
        E.scene.add(post);
      });
    });
    E.solidColliders.push({ minX: rackX - 1.65, maxX: rackX + 1.65, minZ: rackZ - 0.38, maxZ: rackZ + 0.38, minY: 0.14, maxY: 2.1 });

    // Ilha central em Inox com Fluxo Laminar Horizontal (movivel se vazio + botao Power/LED + ar esteril!)
    addMovableStainlessTable('table_hood_lab', 'Mesa Inox (Fluxo Laminar)', -18.5, 0.12, -8.2, 1.5, 0.90, 2.4);

    var hoodGroup = new THREE.Group();
    var hoodBackBox = E.makeBox(0.32, 1.08, 2.34, 0x0f172a, { roughness: 0.45, metalness: 0.4 });
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
    var hoodTop = E.makeBox(1.10, 0.06, 2.34, 0x0f172a, { roughness: 0.4 });
    hoodTop.position.set(0.10, 1.08, 0);
    var hoodGlassL = E.makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
    hoodGlassL.position.set(0.115, 0.545, -1.15);
    hoodGlassL.userData.ignoreRay = true;
    var hoodGlassR = E.makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
    hoodGlassR.position.set(0.115, 0.545, 1.15);
    hoodGlassR.userData.ignoreRay = true;
    // Base fechada em aco inox sem frestas no chao (encaixa perfeitamente em bancadas e mesas)
    var hoodBase = E.makeBox(1.39, 0.04, 2.34, 0xcbd5e1, { metalness: 0.72, roughness: 0.28 });
    hoodBase.position.set(-0.045, 0.02, 0);
    var hoodWorkMat = E.makeBox(1.03, 0.008, 2.24, 0x334155, { metalness: 0.55, roughness: 0.35 });
    hoodWorkMat.position.set(0.115, 0.042, 0);
    var hoodFrontLip = E.makeBox(0.03, 0.045, 2.34, 0x0f172a, { metalness: 0.5, roughness: 0.4 });
    hoodFrontLip.position.set(0.64, 0.0225, 0);

    // Botao Power + LED no canto superior direito do Fluxo Laminar
    var hoodSwitchBox = E.makeBox(0.06, 0.14, 0.10, 0x1e293b, { noShadow: true });
    hoodSwitchBox.position.set(0.62, 1.05, 1.13);
    var hoodBtnMesh = E.makeBox(0.03, 0.06, 0.06, 0x38bdf8, { noShadow: true });
    hoodBtnMesh.position.set(0.65, 1.03, 1.13);
    var hoodLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    var hoodLedBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 14), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
    hoodLedBezel.rotation.z = Math.PI / 2;
    hoodLedBezel.position.set(0.648, 1.095, 1.13);
    var hoodLed = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), hoodLedMat);
    hoodLed.position.set(0.656, 1.095, 1.13);

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
    hoodGroup.add(hoodBackBox, hepa, hoodTop, hoodGlassL, hoodGlassR, hoodBase, hoodWorkMat, hoodFrontLip, hoodSwitchBox, hoodBtnMesh, hoodLedBezel, hoodLed, airPoints);

    var hoodLight = new THREE.PointLight(0xe0f2fe, 0.95, 4.0, 1.8);
    hoodLight.position.set(-18.5, 1.82, -8.2);
    E.scene.add(hoodLight);

    E.hoodAirData = { on: true, points: airPoints, attr: airAttr, hepaMat: hepaMat, ledMat: hoodLedMat, workLight: hoodLight };
    hoodBtnMesh.userData.hoodSwitch = E.hoodAirData;
    hoodSwitchBox.userData.hoodSwitch = E.hoodAirData;
    E.hoodSwitchMeshes.push(hoodBtnMesh, hoodSwitchBox);

    var hoodSurf = { minX: -19.08, maxX: -17.85, minZ: -9.32, maxZ: -7.08, topY: 1.065, isHood: true };
    E.supportSurfaces.push(hoodSurf);
    hoodBase.userData.supportSurface = hoodSurf;
    hoodWorkMat.userData.supportSurface = hoodSurf;
    E.supportMeshes.push(hoodBase, hoodWorkMat);
    hoodGroup.userData.twoHanded = true;
    hoodGroup.userData.isHood = true;
    hoodGroup.userData.tableDims = { w: 1.39, h: 0.045, d: 2.34, surfOffset: 0 };
    hoodGroup.userData.dynamicSurface = hoodSurf;
    hoodGroup.userData.updateBounds = updateItemBounds;
    hoodGroup.userData.isBlockedPickup = function (item) { return isSurfaceOccupied(hoodSurf, item); };
    E.registerPickable('laminar_hood_lab', 'Capela de Fluxo Laminar', hoodGroup, -18.5, 1.02, -8.2, 0, 0.85, 1.1);

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
        var hdl = E.makeBox(0.09, 0.065, 0.11, darkMat, { noShadow: true });
        hdl.position.set(side * 0.275, 0.29, 0);
        potGroup.add(hdl);
      });
      potGroup.add(potBody, potBase, potBottomIn, potRim);
      potGroup.userData.twoHanded = true;
      var potItem = E.registerPickable(potId, 'Panela de Pressão 20L (' + labelSuffix + ')', potGroup, px, py, pz, 0, 0.30, 0.42);

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
        var clasp = E.makeBox(0.085, 0.045, 0.10, darkMat, { noShadow: true });
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

      var lidItem = E.registerPickable(lidId, 'Tampa da Panela (' + labelSuffix + ')', lidGroup, px, py + 0.36, pz, 0, 0.26, 0.16);
      lidItem.potItem = potItem;
      lidItem.isAttached = true;
      potItem.lidItem = lidItem;
      E.cookerPots.push({
        potItem: potItem, lidItem: lidItem, weight: weight, weightTop: weightTop,
        steamPoints: steamPoints, steamAttr: sAttr, contents: [],
        psi: 0, temp: 25, progress: 0, sterilized: false
      });
    }

    function makeElectricBurner(id, px, py, pz) {
      var bg = new THREE.Group();
      // Pés de borracha antiderrapantes
      var footGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.012, 10);
      var footMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
      [[-0.22, -0.24], [0.22, -0.24], [-0.22, 0.24], [0.22, 0.24]].forEach(function (fp) {
        var ft = new THREE.Mesh(footGeo, footMat);
        ft.position.set(fp[0], 0.006, fp[1]);
        bg.add(ft);
      });

      // Corpo esmaltado preto brilhante
      var body = E.makeBox(0.54, 0.068, 0.58, 0x0f172a, { metalness: 0.55, roughness: 0.22 });
      body.position.y = 0.044;
      bg.add(body);

      // Bandeja refletora de inox rebaixada
      var reflectorMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        emissive: 0xff4500,
        emissiveIntensity: 0,
        metalness: 0.88,
        roughness: 0.2
      });
      var reflector = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.185, 0.012, 28), reflectorMat);
      reflector.position.set(0, 0.077, -0.02);
      bg.add(reflector);

      // Suporte em cruz sob a resistência espiral
      var crossMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
      var cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.008, 0.014), crossMat);
      cross1.position.set(0, 0.081, -0.02);
      var cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.38), crossMat);
      cross2.position.set(0, 0.081, -0.02);
      bg.add(cross1, cross2);

      // Resistência espiral 3D (anéis concêntricos que ficam vermelho-incandescentes)
      var coilMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        emissive: 0xff2a00,
        emissiveIntensity: 0.0,
        metalness: 0.55,
        roughness: 0.35
      });
      var coilGroup = new THREE.Group();
      coilGroup.position.set(0, 0.084, -0.02);
      [0.165, 0.112, 0.060].forEach(function (r) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 10, 28), coilMat);
        ring.rotation.x = Math.PI / 2;
        coilGroup.add(ring);
      });
      bg.add(coilGroup);

      // Superfície invisível de apoio/raycast exatamente na altura da resistência
      var coilHit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.205, 0.205, 0.012, 22),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      coilHit.position.set(0, 0.082, -0.02);
      bg.add(coilHit);

      // Botão termostato giratório preto com marcador branco (frente direita)
      var knobGroup = new THREE.Group();
      knobGroup.position.set(0.14, 0.044, 0.296);
      var knobBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.035, 0.028, 16),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 })
      );
      knobBase.rotation.x = Math.PI / 2;
      var knobPointer = new THREE.Mesh(
        new THREE.BoxGeometry(0.007, 0.024, 0.006),
        new THREE.MeshBasicMaterial({ color: 0xf8fafc })
      );
      knobPointer.position.set(0, 0.012, 0.014);
      knobGroup.add(knobBase, knobPointer);
      bg.add(knobGroup);

      // LED piloto com aro metálico (frente esquerda: vermelho desligado / verde ligado)
      var ledBezel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 })
      );
      ledBezel.rotation.x = Math.PI / 2;
      ledBezel.position.set(-0.14, 0.044, 0.292);
      var ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      var led = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 12), ledMat);
      led.position.set(-0.14, 0.044, 0.296);
      bg.add(ledBezel, led);

      // Adesivo triangular de alerta "Quente" na frente direita
      var warn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.002, 3),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      warn.rotation.y = Math.PI;
      warn.position.set(0.21, 0.079, 0.21);
      bg.add(warn);

      // Cabo de força traseiro
      var cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.009, 0.16, 8),
        new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 })
      );
      cord.rotation.x = Math.PI / 2;
      cord.position.set(0.12, 0.032, -0.35);
      bg.add(cord);

      var bSurf = { minX: px - 0.26, maxX: px + 0.26, minZ: pz - 0.28, maxZ: pz + 0.24, topY: py + 0.088 };
      E.supportSurfaces.push(bSurf);
      body.userData.supportSurface = bSurf;
      coilHit.userData.supportSurface = bSurf;
      E.supportMeshes.push(body, coilHit);
      bg.userData.isBurner = true;
      bg.userData.tableDims = { w: 0.54, h: 0.088, d: 0.58, surfOffset: 0 };
      bg.userData.dynamicSurface = bSurf;
      bg.userData.updateBounds = updateItemBounds;
      bg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(bSurf, it); };

      var bState = {
        on: false,
        heat: 0,
        coilMat: coilMat,
        reflectorMat: reflectorMat,
        ledMat: ledMat,
        knobGroup: knobGroup,
        surface: bSurf
      };
      knobBase.userData.burnerSwitch = bState;
      knobPointer.userData.burnerSwitch = bState;
      E.burnerSwitchMeshes.push(knobBase, knobPointer);
      E.burnerDevices.push(bState);
      return E.registerPickable(id, 'Fogareiro Elétrico (Autoclave)', bg, px, py, pz, 0, 0.32, 0.12);
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

    E.registerPickable('petri_clean', 'Placa de Petri (Micélio Rizomórfico)', makePetriDish('clean'), -18.3, 1.065, -8.6, 0, 0.20, 0.08);
    E.registerPickable('petri_contam', 'Placa Contaminada (Mofo/Bactéria)', makePetriDish('contam'), -18.3, 1.065, -7.8, 0, 0.20, 0.08);
    E.registerPickable('petri_empty', 'Placa de Petri Estéril (PDA)', makePetriDish('empty'), -19.2, 1.34, -1.85, 0, 0.20, 0.08);

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
    E.registerPickable('pda_bottle', 'Frasco PDA 500g (Ágar Batata Dextrose)', pdaGroup, -19.6, 1.02, -12.0, 0, 0.15, 0.34);

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
      var item = E.registerPickable(id, 'Vidro 800ml', jg, px, py, pz, 0, 0.16, 0.28);
      item.spawnCtrl = {
        baseLabel: filled ? 'Vidro 800ml (Milho)' : 'Vidro 800ml Vazio',
        sterilized: filled, inoculated: filled, colonized: filled,
        colonization: filled ? 100 : 0, contaminated: false,
        mycOverlay: filled ? mycOverlay : null,
        updateVisual: function () { updateSpawnVisual(item); }
      };
      updateSpawnVisual(item);
      E.spawnGrowItems.push(item);
      return item;
    }
    makeSpawnJar800('spawn_jar', true, -23.1, 1.02, -4.5);
    makeSpawnJar800('spawn_jar_empty', false, -23.1, 1.02, -3.7);

    // Bags de Semente 1.5kg (Vazio e Colonizado com Filtro Microporoso + Porta de Injecao)
    function makeSpawnBag1500(id, filled, px, py, pz) {
      var bg = new THREE.Group();
      var filmMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: filled ? 0.34 : 0.28, roughness: 0.2, depthWrite: false });
      var outer = E.makeBox(0.24, 0.36, 0.18, filmMat, { noShadow: true });
      outer.position.y = 0.18;
      var filterPatch = E.makeBox(0.09, 0.09, 0.012, 0xffffff, { noShadow: true });
      filterPatch.position.set(0, 0.30, 0.092);
      var injPort = E.makeBox(0.036, 0.036, 0.016, 0x64748b, { noShadow: true });
      injPort.position.set(0, 0.11, 0.094);
      bg.add(outer, filterPatch, injPort);
      var bc = document.createElement('canvas'); bc.width = 128; bc.height = 128;
      var bctx = bc.getContext('2d');
      bctx.fillStyle = '#eab308'; bctx.fillRect(0, 0, 128, 128);
      for (var g = 0; g < 180; g++) {
        bctx.fillStyle = g % 4 === 0 ? '#78350f' : '#fde047';
        bctx.fillRect(Math.random() * 124, Math.random() * 124, 3, 4);
      }
      var block = E.makeBox(0.215, 0.215, 0.155, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(bc), roughness: 0.85 }));
      block.position.y = 0.115;
      var mycOverlay = E.makeBox(0.222, 0.22, 0.162, new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 }));
      mycOverlay.position.y = 0.115;
      if (filled) bg.add(block, mycOverlay);
      var item = E.registerPickable(id, 'Bag 1,5kg', bg, px, py, pz, 0, 0.22, 0.38);
      item.spawnCtrl = {
        baseLabel: filled ? 'Bag 1,5kg Spawn' : 'Bag 1,5kg Vazio',
        sterilized: filled, inoculated: filled, colonized: filled,
        colonization: filled ? 100 : 0, contaminated: false,
        mycOverlay: filled ? mycOverlay : null,
        updateVisual: function () { updateSpawnVisual(item); }
      };
      updateSpawnVisual(item);
      E.spawnGrowItems.push(item);
      return item;
    }
    makeSpawnBag1500('spawn_bag_colonized', true, -23.1, 1.02, -8.5);
    makeSpawnBag1500('spawn_bag_empty', false, -23.1, 1.02, -7.8);

    // Balanca Digital de Precisao (com prato inox, visor LCD em gramas e botao TARE)
    (function () {
      var sg = new THREE.Group();
      var body = E.makeBox(0.32, 0.065, 0.38, 0x1e293b, { roughness: 0.45 });
      body.position.y = 0.0325;
      var pan = E.makeBox(0.28, 0.016, 0.26, 0xe2e8f0, { metalness: 0.82, roughness: 0.22 });
      pan.position.set(0, 0.073, -0.04);
      var lcdC = document.createElement('canvas'); lcdC.width = 256; lcdC.height = 96;
      var lcdCtx = lcdC.getContext('2d');
      var lcdTex = new THREE.CanvasTexture(lcdC);
      var lcdScreen = E.makeBox(0.18, 0.045, 0.01, new THREE.MeshBasicMaterial({ map: lcdTex }), { noShadow: true });
      lcdScreen.position.set(-0.04, 0.045, 0.192);
      lcdScreen.rotation.x = -0.35;
      var tareBtn = E.makeBox(0.065, 0.028, 0.016, 0x22c55e, { noShadow: true });
      tareBtn.position.set(0.095, 0.042, 0.194);
      tareBtn.rotation.x = -0.35;
      sg.add(body, pan, lcdScreen, tareBtn);

      var sx = -23.1, sy = 1.02, sz = -9.6;
      var scSurf = { minX: sx - 0.15, maxX: sx + 0.15, minZ: sz - 0.18, maxZ: sz + 0.10, topY: sy + 0.082 };
      E.supportSurfaces.push(scSurf);
      pan.userData.supportSurface = scSurf;
      E.supportMeshes.push(pan);
      sg.userData.isScale = true;
      sg.userData.tableDims = { w: 0.32, h: 0.082, d: 0.38, surfOffset: 0 };
      sg.userData.dynamicSurface = scSurf;
      sg.userData.updateBounds = updateItemBounds;
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
      E.scaleTareMeshes.push(tareBtn);
      E.scaleDevices.push(scaleObj);
      E.registerPickable('precision_scale', 'Balança de Precisão Digital', sg, sx, sy, sz, Math.PI / 2, 0.24, 0.12);
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
      var nozzle = E.makeBox(0.028, 0.028, 0.08, 0xf8fafc, { noShadow: true });
      nozzle.position.set(0, 0.235, 0.025);
      var trig = E.makeBox(0.012, 0.045, 0.018, 0x0284c7, { noShadow: true });
      trig.position.set(0, 0.212, 0.042);
      ag.add(bottle, neck, nozzle, trig);
      ag.userData.isAlcoholSpray = true;
      return E.registerPickable(id, 'Borrifador Álcool 70%', ag, px, py, pz, Math.PI / 2, 0.12, 0.26);
    }
    makeAlcoholSprayBottle('alcohol_spray', -23.1, 1.02, -7.1);

    // Seladora Termica de Bancada
    var sealerGroup = new THREE.Group();
    var sealerBase = E.makeBox(0.46, 0.08, 0.18, 0x1d4ed8, { roughness: 0.4, metalness: 0.35 });
    sealerBase.position.y = 0.04;
    var sealerArm = E.makeBox(0.44, 0.04, 0.05, 0x94a3b8, { metalness: 0.7, roughness: 0.25 });
    sealerArm.position.set(0, 0.11, -0.02);
    sealerArm.rotation.x = 0.18;
    var sealerLed = E.makeBox(0.02, 0.02, 0.02, 0xef4444, { noShadow: true });
    sealerLed.position.set(0.18, 0.085, 0.06);
    sealerGroup.add(sealerBase, sealerArm, sealerLed);
    E.registerPickable('heat_sealer', 'Seladora Térmica de Bags', sealerGroup, -23.1, 1.02, -6.2, Math.PI / 2, 0.28, 0.16);

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
      var item = E.registerPickable(id, 'Cultura Líquida 800ml', jg, px, py, pz, 0, 0.14, 0.30);
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
      var item = E.registerPickable(id, 'Béquer 1L', bg, px, py, pz, 0, 0.14, 0.24);
      item.setVolume = function (v) { updateContainerVolume(item, v); };
      updateContainerVolume(item, initMl);
      return item;
    }

    function makeMagneticStirrer(id, px, py, pz) {
      var sg = new THREE.Group();
      var baseMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.12 });
      var plateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.18 });
      var body = E.makeBox(0.30, 0.078, 0.28, baseMat, { roughness: 0.35 });
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
      var frontPanel = E.makeBox(0.28, 0.068, 0.075, panelMat, { noShadow: true });
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
      var ledBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
      ledBezel.rotation.x = Math.PI / 2 - 1.15;
      ledBezel.position.set(0, 0.052, 0.139);
      var powerLed = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), ledMat);
      powerLed.position.set(0, 0.056, 0.145);
      sg.add(body, plate, plateRim, frontPanel, knob1, knob2, ledBezel, powerLed);

      var stirSurf = { minX: px - 0.13, maxX: px + 0.13, minZ: pz - 0.16, maxZ: pz + 0.08, topY: py + 0.098 };
      E.supportSurfaces.push(stirSurf);
      plate.userData.supportSurface = stirSurf;
      E.supportMeshes.push(plate);
      sg.userData.isStirrer = true;
      sg.userData.tableDims = { w: 0.30, h: 0.098, d: 0.34, surfOffset: 0 };
      sg.userData.dynamicSurface = stirSurf;
      sg.userData.updateBounds = updateItemBounds;
      sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(stirSurf, it); };

      var stirState = { on: false, ledMat: ledMat, surface: stirSurf };
      frontPanel.userData.stirSwitch = stirState;
      knob1.children.forEach(function (c) { c.userData.stirSwitch = stirState; E.stirSwitchMeshes.push(c); });
      knob2.children.forEach(function (c) { c.userData.stirSwitch = stirState; E.stirSwitchMeshes.push(c); });
      E.stirSwitchMeshes.push(frontPanel);
      E.stirrerDevices.push(stirState);
      return E.registerPickable(id, 'Agitador Magnético (MYCO-MAG)', sg, px, py, pz, 0, 0.24, 0.14);
    }

    function updateSyringeVolume(item, newVol) {
      if (!item || !item.mesh || !item.mesh.userData.syrCtrl) return;
      var sc = item.mesh.userData.syrCtrl;
      var clamped = Math.max(0, Math.min(10, Number(newVol) || 0));
      sc.volMl = clamped;
      var frac = clamped / 10;
      if (clamped <= 0.05) {
        sc.liqMesh.visible = false;
      } else {
        sc.liqMesh.visible = true;
        sc.liqMesh.scale.y = Math.max(0.02, frac);
        sc.liqMesh.position.y = 0.085 + (0.09 * frac) * 0.5;
      }
      sc.plunger.position.y = 0.095 + 0.09 * frac;
      var dispVal = Math.round(clamped * 10) / 10;
      item.label = clamped > 0.1 ? 'Seringa 10ml (' + (dispVal % 1 === 0 ? dispVal.toFixed(0) : dispVal.toFixed(1)) + 'ml CL)' : 'Seringa 10ml (Vazia)';
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
      var item = E.registerPickable(id, 'Seringa 10ml (Vazia)', sg, px, py, pz, 0, 0.14, 0.06);
      item.setVolume = function (v) { updateSyringeVolume(item, v); };
      updateSyringeVolume(item, 0);
      return item;
    }

    function makeInfraredThermometer(id, px, py, pz) {
      if (!E.thermoTex) E.initThermoDisplay();
      var tg = new THREE.Group();
      var yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.05 });
      var darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.15 });
      var redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

      // Cabeça do termômetro (carenagem amarela industrial)
      var head = E.makeBox(0.062, 0.084, 0.145, yellowMat);
      head.position.set(0, 0.155, 0);

      // Friso superior protetor preto
      var topCap = E.makeBox(0.054, 0.012, 0.11, darkMat);
      topCap.position.set(0, 0.202, -0.01);

      // Focinho frontal preto com lente óptica e furo emissor do feixe laser
      var snout = E.makeBox(0.054, 0.076, 0.024, darkMat);
      snout.position.set(0, 0.155, -0.082);
      var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 14), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 }));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.145, -0.096);
      var laserDiode = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.008, 10), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
      laserDiode.rotation.x = Math.PI / 2;
      laserDiode.position.set(0, 0.178, -0.096);

      // Moldura traseira preta com display LCD voltado para trás
      var backBezel = E.makeBox(0.058, 0.078, 0.016, darkMat);
      backBezel.position.set(0, 0.155, 0.076);
      var screenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.046, 0.046),
        new THREE.MeshBasicMaterial({ map: E.thermoTex })
      );
      screenMesh.position.set(0, 0.160, 0.086);
      screenMesh.rotation.y = Math.PI; // voltado para trás em direção ao olhar do jogador!

      // Botões amarelos de controle abaixo da tela LCD
      [-0.015, 0, 0.015].forEach(function (bx) {
        var btn = E.makeBox(0.009, 0.009, 0.004, yellowMat);
        btn.position.set(bx, 0.128, 0.086);
        tg.add(btn);
      });

      // Cabo ergonômico com empunhadura texturizada preta e ranhuras
      var handle = new THREE.Group();
      handle.position.set(0, 0.085, 0.015);
      handle.rotation.x = -0.16;
      var gripCore = E.makeBox(0.046, 0.135, 0.052, yellowMat);
      var gripRubberF = E.makeBox(0.048, 0.125, 0.016, darkMat);
      gripRubberF.position.set(0, 0, -0.022);
      var gripRubberB = E.makeBox(0.048, 0.125, 0.016, darkMat);
      gripRubberB.position.set(0, 0, 0.022);
      handle.add(gripCore, gripRubberF, gripRubberB);

      // Gatilho vermelho ergonômico
      var trigger = E.makeBox(0.014, 0.032, 0.018, redMat);
      trigger.position.set(0, 0.105, -0.022);

      // Adesivo lateral amarelo com aviso de radiação laser
      var sticker = E.makeBox(0.065, 0.026, 0.055, new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      sticker.position.set(0, 0.165, 0);

      tg.add(head, topCap, snout, lens, laserDiode, backBezel, screenMesh, handle, trigger, sticker);
      tg.userData.isThermometer = true;
      return E.registerPickable(id, 'Termômetro Laser Infravermelho', tg, px, py, pz, 0, 0.18, 0.22);
    }

    makeMagneticStirrer('magnetic_stirrer', -20.95, 0.91, -10.55);
    makeLiquidJar800('liquid_culture', -20.95, 1.015, -10.59, 350);
    makeBeaker1L('beaker_1l_a', -20.42, 0.91, -10.55, 0);
    makeBeaker1L('beaker_1l_b', -20.08, 0.91, -10.55, 500);
    makeSyringe10ml('syringe_10ml_a', -19.72, 0.91, -10.42);
    makeSyringe10ml('syringe_10ml_b', -19.72, 0.91, -10.72);
    makeInfraredThermometer('infrared_thermometer', -20.0, 0.91, -10.2);

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
          var post = E.makeBox(0.065, rackH, 0.065, blueMat);
          post.position.set(cx, rackH / 2, cz);
          var foot = E.makeBox(0.11, 0.018, 0.11, darkFootMat, { noShadow: true });
          foot.position.set(cx, 0.009, cz);
          rg.add(post, foot);
        });
        // Travessas horizontais azuis conectando frente e fundo do montante
        [0.18, 0.88, 1.58, 2.26].forEach(function (by) {
          var hBrace = E.makeBox(0.036, 0.036, depth - 0.08, blueMat, { noShadow: true });
          hBrace.position.set(cx, by, 0);
          rg.add(hBrace);
        });
        // Trelicas diagonais azuis em zig-zag entre as colunas frontal e traseira
        var diagSpanZ = depth - 0.12;
        var diagSpanY = 0.66;
        var diagLen = Math.hypot(diagSpanZ, diagSpanY);
        var diagAng = Math.atan2(diagSpanY, diagSpanZ);
        [[0.53, 1], [1.23, -1], [1.92, 1]].forEach(function (dg) {
          var dBar = E.makeBox(0.030, 0.030, diagLen, blueMat, { noShadow: true });
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
        E.supportSurfaces.push(rSurf);
        [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
          var beam = E.makeBox(totalLen - 0.04, 0.072, 0.042, orangeMat);
          beam.position.set(0, sy, bz);
          beam.userData.supportSurface = rSurf;
          E.supportMeshes.push(beam);
          rg.add(beam);
          colPositions.forEach(function (cx) {
            var bracket = E.makeBox(0.082, 0.12, 0.082, orangeMat, { noShadow: true });
            bracket.position.set(cx, sy, bz);
            rg.add(bracket);
          });
        });
        var tray = E.makeBox(totalLen - 0.10, 0.032, depth - 0.08, orangeMat);
        tray.position.set(0, sy + 0.022, 0);
        tray.userData.supportSurface = rSurf;
        E.supportMeshes.push(tray);
        rg.add(tray);
      });

      // Longarinas superiores laranjas de travamento no topo (como na foto!)
      [-halfD + 0.04, halfD - 0.04].forEach(function (bz) {
        var topBeam = E.makeBox(totalLen - 0.04, 0.068, 0.042, orangeMat);
        topBeam.position.set(0, 2.24, bz);
        rg.add(topBeam);
        colPositions.forEach(function (cx) {
          var topBracket = E.makeBox(0.082, 0.11, 0.082, orangeMat, { noShadow: true });
          topBracket.position.set(cx, 2.24, bz);
          rg.add(topBracket);
        });
      });

      E.scene.add(rg);

      E.solidColliders.push({
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
      var bag = E.makeBox(0.30, 0.42, 0.22, bagColor, { roughness: 0.85 });
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
      return E.registerPickable(id, label, sg, px, py, pz, 0, 0.26, 0.42);
    }

    function makeGlovesBox(id, px, py, pz) {
      var gg = new THREE.Group();
      var box = E.makeBox(0.24, 0.12, 0.13, 0x0284c7, { roughness: 0.45 });
      box.position.y = 0.06;
      var slot = E.makeBox(0.12, 0.008, 0.05, 0xe0f2fe, { noShadow: true });
      slot.position.set(0, 0.122, 0);
      var strip = E.makeBox(0.242, 0.04, 0.132, 0xf8fafc, { noShadow: true });
      strip.position.y = 0.085;
      gg.add(box, slot, strip);
      return E.registerPickable(id, 'Caixa de Luvas Nitrílicas Estéreis', gg, px, py, pz, 0, 0.18, 0.14);
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
      return E.registerPickable(id, lbl, tg, px, py, pz, 0, 0.08, 0.06);
    }

    function makeFoilRoll(id, px, py, pz) {
      var fg = new THREE.Group();
      var box = E.makeBox(0.32, 0.065, 0.065, 0xdc2626, { roughness: 0.45 });
      box.position.y = 0.0325;
      var band = E.makeBox(0.322, 0.025, 0.067, 0xfef08a, { noShadow: true });
      band.position.y = 0.04;
      fg.add(box, band);
      return E.registerPickable(id, 'Papel Alumínio (Autoclave)', fg, px, py, pz, 0, 0.18, 0.08);
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
      E.registerPickable(
        'petri_bare_' + pad2(pIdx + 1),
        'Placa de Petri Vazia',
        makePetriDish('bare'),
        -21.3 + stackIdx * 0.56,
        1.798 + stackLvl * 0.055,
        3.05,
        0, 0.20, 0.08
      );
    }
    E.registerPickable('pda_bottle_02', 'Ágar PDA / BDA (500g)', pdaGroup.clone(), -17.55, 1.798, 3.05, 0, 0.14, 0.31);
    E.registerPickable('pda_bottle_03', 'Ágar PDA / BDA (500g)', pdaGroup.clone(), -17.15, 1.798, 3.05, 0, 0.14, 0.31);

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
    E.buildCampusBuildingWing({ cx: 19, cz: -7, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta de Substratos', doorSign: '🧪 SUBSTRATOS', style: 'brick', connectNorth2F: true, connectSouth2F: true, boardIndex: 2 });
    // Bloco Leste-Sul (z: 2.2..13.8): ESTUFA DE FRUTIFICACAO + 2o andar acessivel
    E.buildCampusBuildingWing({ cx: 19, cz: 8, width: 10, depth: 11.6, faceDir: -1, doorLabel: 'Porta da Estufa', doorSign: '🍄 ESTUFA', style: 'wood', connectNorth2F: true, boardIndex: 3 });

    E.createBanner(13.85, 5.1, -11.6, -Math.PI / 2, '#0284c7', '🧪');
    E.createBanner(13.85, 5.1, 3.6, -Math.PI / 2, '#15803d', '🍄');

    // Equipamentos de Substratos (Leste-Norte)
    addMovableStainlessTable('table_sub_east', 'Mesa Inox (Substratos)', 21.2, 0.12, -5.2, 1.5, 0.82, 3.2);
    createPressureCookerPair('pressure_cooker_sub', 'pressure_lid_sub', 'Substrato', 21.2, 0.94, -4.3);

    // Equipamentos da Estufa (Leste-Sul)
    var rack = E.makeBox(1.6, 0.72, 4.0, 0x1e293b);
    rack.position.set(21.0, 0.14 + 0.36, 8.0);
    E.scene.add(rack);
    var ledBar = E.makeBox(0.28, 0.08, 3.6, 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.1 });
    ledBar.position.set(21.0, 2.55, 8.0);
    E.scene.add(ledBar);
    var estufaLight = new THREE.PointLight(0xfef08a, 1.25, 14, 1.35);
    estufaLight.position.set(21.0, 2.45, 8.0);
    E.scene.add(estufaLight);
    E.solidColliders.push({ minX: 20.15, maxX: 21.85, minZ: 5.95, maxZ: 10.05, minY: 0.14, maxY: 0.86, surfaceTopY: 0.86 });
    var estufaSurf = { minX: 20.25, maxX: 21.75, minZ: 6.05, maxZ: 9.95, topY: 0.86 };
    E.supportSurfaces.push(estufaSurf);
    rack.userData.supportSurface = estufaSurf;
    E.supportMeshes.push(rack);

    E.buildGreenhouseBench(estufaSurf);
  }

  // ---------------- Bancada de Cultivo Interativo da Estufa (Ciclo Completo) ----------------

})();