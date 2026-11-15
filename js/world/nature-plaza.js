/**
 * MycoCampus 3D — Nature, Trees, Wild Mushrooms & Central Plaza
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.buildNatureWorld = function () {
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
      var y = E.terrainHeight(x, z);
      pos.setY(i, y);
      var col = ((Math.sin(x * 0.14) + Math.cos(z * 0.14)) > 0 ? cGrass : cGrassAlt).clone();
      if (y > 6) col.lerp(cMtn, Math.min(1, (y - 6) / 14));
      if (y > 22) col.lerp(cRock, Math.min(0.65, (y - 22) / 16));
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    E.terrainSnowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 });
    var terrain = new THREE.Mesh(geo, E.terrainSnowMat);
    terrain.receiveShadow = true;
    E.scene.add(terrain);

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
      treePositions.push({ x: tx, y: E.terrainHeight(tx, tz), z: tz, s: 0.85 + (idx % 5) * 0.18 });
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
        E.solidColliders.push({ minX: tp.x - 0.5, maxX: tp.x + 0.5, minZ: tp.z - 0.5, maxZ: tp.z + 0.5, minY: tp.y, maxY: tp.y + 5 });
      }
    });
    E.scene.add(trunkInst, cone1Inst, cone2Inst);

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
      var my = E.terrainHeight(mx, mz);
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
      E.scene.add(g);
      E.wildMushrooms.push({ id: 'wild_' + idx, group: g, capMesh: cap, active: true, respawnAt: 0 });
    });
  }

  // ---------------- Praca Central, Canteiros, Bancos & Fonte com Cogumelo ----------------

  E.createFlowerBed = function (cx, cz, rx, rz, rotY) {
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
    E.scene.add(g);
  }

  E.createBench = function (x, z, rotY) {
    if (!E.createBench._woodMat) {
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
      E.createBench._woodMat = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.38, metalness: 0.06 });
      E.createBench._frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.30, metalness: 0.78 });
    }

    var woodM = E.createBench._woodMat;
    var frameM = E.createBench._frameMat;
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    // Estrutura tubular preta nas duas extremidades (fiel a foto de referencia!)
    [-0.88, 0.88].forEach(function (sx) {
      // Perna dianteira e traseira em tubo quadrado preto + sapatas
      var frontLeg = E.makeBox(0.046, 0.43, 0.046, frameM);
      frontLeg.position.set(sx, 0.215, 0.235);
      var rearLeg = E.makeBox(0.046, 0.43, 0.046, frameM);
      rearLeg.position.set(sx, 0.215, -0.225);
      var footF = E.makeBox(0.054, 0.014, 0.054, frameM, { noShadow: true });
      footF.position.set(sx, 0.007, 0.235);
      var footR = E.makeBox(0.054, 0.014, 0.054, frameM, { noShadow: true });
      footR.position.set(sx, 0.007, -0.225);
      // Travessa lateral horizontal do assento
      var sideBar = E.makeBox(0.046, 0.046, 0.506, frameM);
      sideBar.position.set(sx, 0.422, 0.005);
      // Coluna inclinada do encosto
      var backPost = E.makeBox(0.046, 0.51, 0.046, frameM);
      backPost.position.set(sx, 0.655, -0.268);
      backPost.rotation.x = -0.20;
      g.add(frontLeg, rearLeg, footF, footR, sideBar, backPost);
    });

    // Longarinas horizontais pretas sob o assento + travessa central
    var frontRail = E.makeBox(1.806, 0.040, 0.042, frameM);
    frontRail.position.set(0, 0.422, 0.235);
    var rearRail = E.makeBox(1.806, 0.040, 0.042, frameM);
    rearRail.position.set(0, 0.422, -0.225);
    var midBrace = E.makeBox(0.040, 0.036, 0.48, frameM, { noShadow: true });
    midBrace.position.set(0, 0.418, 0.005);
    g.add(frontRail, rearRail, midBrace);

    // 2 ripas largas de madeira envernizada no assento (com fresta central)
    var seatPlankF = E.makeBox(1.714, 0.034, 0.195, woodM);
    seatPlankF.position.set(0, 0.442, 0.115);
    var seatPlankR = E.makeBox(1.714, 0.034, 0.195, woodM);
    seatPlankR.position.set(0, 0.442, -0.105);

    // 2 ripas largas de madeira envernizada no encosto inclinado
    var backPlankLow = E.makeBox(1.714, 0.156, 0.032, woodM);
    backPlankLow.position.set(0, 0.585, -0.248);
    backPlankLow.rotation.x = -0.20;
    var backPlankHigh = E.makeBox(1.714, 0.156, 0.032, woodM);
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
      E.seatMeshes.push(seatHit);
    });

    E.scene.add(g);
  }

  E.createUmbrellaTable = function (x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.35, 8), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    pole.position.y = 1.18; pole.castShadow = true;
    var table = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 }));
    table.position.y = 0.76; table.castShadow = true;
    var canopy = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.52, 8), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 }));
    canopy.position.y = 2.35; canopy.castShadow = true;
    g.add(pole, table, canopy);
    E.scene.add(g);
    E.solidColliders.push({ minX: x - 0.65, maxX: x + 0.65, minZ: z - 0.65, maxZ: z + 0.65, minY: 0, maxY: 2.5 });
  }

  E.createCampusLamp = function (x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65 }));
    pole.position.y = 1.7; pole.castShadow = true;
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.85 }));
    bulb.position.y = 3.45;
    g.add(pole, bulb);
    E.scene.add(g);
  }

  E.createBanner = function (x, y, z, rotY, colorHex, emblem) {
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
    E.scene.add(mesh);
  }

  E.buildPlaza = function () {
    // Piso da praca em bloquetes (x: -28..28, z: -20..22)
    var plazaFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 42),
      new THREE.MeshStandardMaterial({ map: E.texPaving, roughness: 0.88, metalness: 0.02 })
    );
    plazaFloor.rotation.x = -Math.PI / 2;
    plazaFloor.position.set(0, 0.02, 1);
    plazaFloor.receiveShadow = true;
    E.scene.add(plazaFloor);

    // Fonte Central Realista em (0, 0, 2) com Bacia Vazada (Zero Z-Fighting), Agua Cristalina Animada, Cascatas e Cogumelo no Topo!
    var fx = 0, fz = 2;
    var basinStoneMat = new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.58, metalness: 0.08 });
    var basinInnerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.68, side: THREE.DoubleSide });
    var tilePoolMat = new THREE.MeshStandardMaterial({ color: 0x075985, roughness: 0.35, metalness: 0.15 });
    var waterSurfMat = new THREE.MeshStandardMaterial({
      map: E.texWater,
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
    E.scene.add(poolFloor);

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
    E.scene.add(outerWall, innerWall, rimTop);

    // Superficie da agua cristalina inferior (y = 0.43, livre de qualquer sobreposicao!)
    var waterDisc = new THREE.Mesh(new THREE.CircleGeometry(2.57, 36), waterSurfMat);
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.set(fx, 0.43, fz);
    E.scene.add(waterDisc);

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
    E.scene.add(pedBase, ped1, bowl, bowlRim, upperWater);

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
      E.scene.add(stream);

      var rip = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.15, 18), rippleMat);
      rip.rotation.x = -Math.PI / 2;
      rip.position.set(jx, 0.44, jz);
      E.scene.add(rip);
      E.fountainRipples.push({ mesh: rip, phase: j * 0.78 });
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
    E.fountainDropsAttr = new THREE.BufferAttribute(dropArr, 3);
    dropGeo.setAttribute('position', E.fountainDropsAttr);
    var dropPoints = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.075, transparent: true, opacity: 0.82, depthWrite: false }));
    E.scene.add(dropPoints);

    // Cogumelo no topo da fonte!
    var mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.35, 16), new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.55 }));
    mStem.position.set(fx, 1.98, fz); mStem.castShadow = true;
    var mCap = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, emissive: 0x7f1d1d, emissiveIntensity: 0.22 })
    );
    mCap.position.set(fx, 2.58, fz); mCap.castShadow = true;
    E.scene.add(mStem, mCap);
    for (var s = 0; s < 8; s++) {
      var ang = (s / 8) * Math.PI * 2;
      var rSpot = s % 2 === 0 ? 0.96 : 0.68;
      var ySpot = s % 2 === 0 ? 3.12 : 3.48;
      var spot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
      spot.position.set(fx + Math.cos(ang) * rSpot, ySpot, fz + Math.sin(ang) * rSpot);
      E.scene.add(spot);
    }
    E.solidColliders.push({ minX: fx - 2.9, maxX: fx + 2.9, minZ: fz - 2.9, maxZ: fz + 2.9, minY: 0, maxY: 4.0 });

    // Canteiros organicos exatamente ao redor da praca
    E.createFlowerBed(-5.8, -4.5, 3.0, 1.8, -0.35);
    E.createFlowerBed(5.8, -4.5, 3.0, 1.8, 0.35);
    E.createFlowerBed(-6.2, 8.2, 3.2, 1.9, 0.42);
    E.createFlowerBed(6.2, 8.2, 3.2, 1.9, -0.42);

    // Bancos e mesas com guarda-sol
    E.createBench(-3.2, -1.8, 0.8);
    E.createBench(3.2, -1.8, -0.8);
    E.createBench(-5.5, 2.2, Math.PI / 2);
    E.createBench(5.5, 2.2, -Math.PI / 2);
    E.createBench(-3.5, 13.5, 0);
    E.createBench(3.5, 13.5, 0);

    // Luminarias
    E.createCampusLamp(-10.5, -10.5);
    E.createCampusLamp(10.5, -10.5);
    E.createCampusLamp(-10.5, 12.0);
    E.createCampusLamp(10.5, 12.0);
  }

  // ---------------- Modulo Geometrico de Predio Universitario (2 Andares) ----------------

})();