import { makeBox } from '../engine/textures.js';

export function buildLaminarHoodAndBenches(ctx, helpers) {
  var scene = ctx.scene;
  var solidColliders = ctx.solidColliders;
  var supportSurfaces = ctx.supportSurfaces;
  var supportMeshes = ctx.supportMeshes;

  function addWallLabBench(bx, bz, bw, bd) {
    var cab = makeBox(bw, 0.82, bd, 0xe2e8f0, { roughness: 0.55 });
    cab.position.set(bx, 0.14 + 0.41, bz);
    var trim = makeBox(bw + 0.02, 0.72, bd + 0.02, 0x0284c7, { roughness: 0.5 });
    trim.position.set(bx, 0.14 + 0.36, bz);
    var top = makeBox(bw + 0.04, 0.06, bd + 0.04, 0x94a3b8, { roughness: 0.35, metalness: 0.25 });
    top.position.set(bx, 0.14 + 0.85, bz);
    scene.add(trim, cab, top);
    solidColliders.push({ minX: bx - bw / 2 - 0.05, maxX: bx + bw / 2 + 0.05, minZ: bz - bd / 2 - 0.05, maxZ: bz + bd / 2 + 0.05, minY: 0.14, maxY: 1.02, surfaceTopY: 1.02 });
    var benchSurf = { minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, topY: 1.02 };
    supportSurfaces.push(benchSurf);
    top.userData.supportSurface = benchSurf;
    supportMeshes.push(top);
  }
  addWallLabBench(-23.15, -7.0, 1.2, 10.6); // Parede Oeste inteira
  addWallLabBench(-18.5, -12.0, 8.1, 1.1);  // Parede Norte inteira

  // Estante 3 niveis para Culturas Solidas (Parede Sul do Lab)
  var rackX = -19.2, rackZ = -1.85;
  var rackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.65, roughness: 0.3 });
  [0.62, 1.18, 1.74].forEach(function (sy) {
    var sh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 0.68), rackMat);
    sh.position.set(rackX, 0.14 + sy, rackZ);
    scene.add(sh);
    var shSurf = { minX: rackX - 1.55, maxX: rackX + 1.55, minZ: rackZ - 0.3, maxZ: rackZ + 0.3, topY: 0.14 + sy + 0.02 };
    supportSurfaces.push(shSurf);
    sh.userData.supportSurface = shSurf;
    supportMeshes.push(sh);
  });
  [-1.56, 1.56].forEach(function (pxOff) {
    [-0.31, 0.31].forEach(function (pzOff) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8), rackMat);
      post.position.set(rackX + pxOff, 0.14 + 0.95, rackZ + pzOff);
      scene.add(post);
    });
  });
  solidColliders.push({ minX: rackX - 1.65, maxX: rackX + 1.65, minZ: rackZ - 0.38, maxZ: rackZ + 0.38, minY: 0.14, maxY: 2.1 });

  // Ilha central em Inox com Fluxo Laminar Horizontal
  helpers.addMovableStainlessTable('table_hood_lab', 'Mesa Inox (Fluxo Laminar)', -18.5, 0.12, -8.2, 1.5, 0.90, 2.4);

  var hoodGroup = new THREE.Group();
  var hoodBackBox = makeBox(0.32, 1.08, 2.34, 0x0f172a, { roughness: 0.45, metalness: 0.4 });
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
  var hoodTop = makeBox(1.10, 0.06, 2.34, 0x0f172a, { roughness: 0.4 });
  hoodTop.position.set(0.10, 1.08, 0);
  var hoodGlassL = makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
  hoodGlassL.position.set(0.115, 0.545, -1.15);
  hoodGlassL.userData.ignoreRay = true;
  var hoodGlassR = makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
  hoodGlassR.position.set(0.115, 0.545, 1.15);
  hoodGlassR.userData.ignoreRay = true;
  var hoodBase = makeBox(1.39, 0.04, 2.34, 0xcbd5e1, { metalness: 0.72, roughness: 0.28 });
  hoodBase.position.set(-0.045, 0.02, 0);
  var hoodWorkMat = makeBox(1.03, 0.008, 2.24, 0x334155, { metalness: 0.55, roughness: 0.35 });
  hoodWorkMat.position.set(0.115, 0.042, 0);
  var hoodFrontLip = makeBox(0.03, 0.045, 2.34, 0x0f172a, { metalness: 0.5, roughness: 0.4 });
  hoodFrontLip.position.set(0.64, 0.0225, 0);

  var hoodSwitchBox = makeBox(0.06, 0.14, 0.10, 0x1e293b, { noShadow: true });
  hoodSwitchBox.position.set(0.62, 1.05, 1.13);
  var hoodBtnMesh = makeBox(0.03, 0.06, 0.06, 0x38bdf8, { noShadow: true });
  hoodBtnMesh.position.set(0.65, 1.03, 1.13);
  var hoodLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  var hoodLedBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 14), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
  hoodLedBezel.rotation.z = Math.PI / 2;
  hoodLedBezel.position.set(0.648, 1.095, 1.13);
  var hoodLed = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), hoodLedMat);
  hoodLed.position.set(0.656, 1.095, 1.13);

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
  scene.add(hoodLight);

  var hoodAirData = { on: true, points: airPoints, attr: airAttr, hepaMat: hepaMat, ledMat: hoodLedMat, workLight: hoodLight };
  if (ctx.setHoodAirData) ctx.setHoodAirData(hoodAirData);
  hoodBtnMesh.userData.hoodSwitch = hoodAirData;
  hoodSwitchBox.userData.hoodSwitch = hoodAirData;
  ctx.hoodSwitchMeshes.push(hoodBtnMesh, hoodSwitchBox);

  var hoodSurf = { minX: -19.08, maxX: -17.85, minZ: -9.32, maxZ: -7.08, topY: 1.065, isHood: true };
  supportSurfaces.push(hoodSurf);
  hoodBase.userData.supportSurface = hoodSurf;
  hoodWorkMat.userData.supportSurface = hoodSurf;
  supportMeshes.push(hoodBase, hoodWorkMat);
  hoodGroup.userData.twoHanded = true;
  hoodGroup.userData.isHood = true;
  hoodGroup.userData.tableDims = { w: 1.39, h: 0.045, d: 2.34, surfOffset: 0 };
  hoodGroup.userData.dynamicSurface = hoodSurf;
  hoodGroup.userData.updateBounds = helpers.updateItemBounds;
  hoodGroup.userData.isBlockedPickup = function (item) { return helpers.isSurfaceOccupied(hoodSurf, item); };
  helpers.registerPickable('laminar_hood_lab', 'Capela de Fluxo Laminar', hoodGroup, -18.5, 1.02, -8.2, 0, 0.85, 1.1);
}

export function createPressureCookerPair(ctx, helpers, potId, lidId, labelSuffix, px, py, pz) {
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
    var hdl = makeBox(0.09, 0.065, 0.11, darkMat, { noShadow: true });
    hdl.position.set(side * 0.275, 0.29, 0);
    potGroup.add(hdl);
  });
  potGroup.add(potBody, potBase, potBottomIn, potRim);
  potGroup.userData.twoHanded = true;
  var potItem = helpers.registerPickable(potId, 'Panela de Pressão 20L (' + labelSuffix + ')', potGroup, px, py, pz, 0, 0.30, 0.42);

  var lidGroup = new THREE.Group();
  var lidRim = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.256, 0.045, 22), steelMat);
  lidRim.position.y = 0.022;
  var lidDome = new THREE.Mesh(new THREE.SphereGeometry(0.242, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), steelMat);
  lidDome.scale.set(1, 0.36, 1); lidDome.position.y = 0.025;
  var weight = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.055, 12), darkMat);
  weight.position.y = 0.13;
  var weightTop = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 12), redMat);
  weightTop.position.y = 0.16;
  var safetyPins = [];
  [-0.12, 0.12].forEach(function (vz) {
    var vRing = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.015, 10), darkMat);
    vRing.position.set(0, 0.105, vz);
    var vPin = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.022, 10), redMat);
    vPin.position.set(0, 0.110, vz);
    safetyPins.push(vPin);
    lidGroup.add(vRing, vPin);
  });
  [-1, 1].forEach(function (side) {
    var clasp = makeBox(0.085, 0.045, 0.10, darkMat, { noShadow: true });
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

  var lidItem = helpers.registerPickable(lidId, 'Tampa da Panela (' + labelSuffix + ')', lidGroup, px, py + 0.36, pz, 0, 0.26, 0.16);
  lidItem.potItem = potItem;
  lidItem.isAttached = true;
  potItem.lidItem = lidItem;

  // Indicador 3D de Pressão (0-15 PSI) & Esterilização acima da panela
  var pCanvas = document.createElement('canvas');
  pCanvas.width = 320;
  pCanvas.height = 112;
  var pCtx = pCanvas.getContext('2d');
  var pTex = new THREE.CanvasTexture(pCanvas);
  var pSpriteMat = new THREE.SpriteMaterial({ map: pTex, transparent: true, depthTest: false });
  var pSprite = new THREE.Sprite(pSpriteMat);
  pSprite.scale.set(0.95, 0.33, 1);
  pSprite.position.set(0, 0.78, 0);
  pSprite.visible = false;
  pSprite.userData.ignoreRay = true;
  potGroup.add(pSprite);

  ctx.cookerPots.push({
    potItem: potItem, lidItem: lidItem, weight: weight, weightTop: weightTop,
    safetyPins: safetyPins,
    steamPoints: steamPoints, steamAttr: sAttr, contents: [],
    statusSprite: pSprite, statusCtx: pCtx, statusTex: pTex, lastHudKey: '',
    psi: 0, temp: 25, progress: 0, sterilized: false,
    overheatTimer: 0, burned: false
  });
}

export function makeElectricBurner(ctx, helpers, id, px, py, pz) {
  var bg = new THREE.Group();
  var footGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.012, 10);
  var footMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
  [[-0.22, -0.24], [0.22, -0.24], [-0.22, 0.24], [0.22, 0.24]].forEach(function (fp) {
    var ft = new THREE.Mesh(footGeo, footMat);
    ft.position.set(fp[0], 0.006, fp[1]);
    bg.add(ft);
  });

  var body = makeBox(0.54, 0.068, 0.58, 0x0f172a, { metalness: 0.55, roughness: 0.22 });
  body.position.y = 0.044;
  bg.add(body);

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

  var crossMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
  var cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.008, 0.014), crossMat);
  cross1.position.set(0, 0.081, -0.02);
  var cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.38), crossMat);
  cross2.position.set(0, 0.081, -0.02);
  bg.add(cross1, cross2);

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

  var coilHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.205, 0.012, 22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  coilHit.position.set(0, 0.082, -0.02);
  bg.add(coilHit);

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

  var warn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.002, 3),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  warn.rotation.y = Math.PI;
  warn.position.set(0.21, 0.079, 0.21);
  bg.add(warn);

  var cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 })
  );
  cord.rotation.x = Math.PI / 2;
  cord.position.set(0.12, 0.032, -0.35);
  bg.add(cord);

  var bSurf = { minX: px - 0.26, maxX: px + 0.26, minZ: pz - 0.28, maxZ: pz + 0.24, topY: py + 0.088 };
  ctx.supportSurfaces.push(bSurf);
  body.userData.supportSurface = bSurf;
  coilHit.userData.supportSurface = bSurf;
  ctx.supportMeshes.push(body, coilHit);
  bg.userData.isBurner = true;
  bg.userData.tableDims = { w: 0.54, h: 0.088, d: 0.58, surfOffset: 0 };
  bg.userData.dynamicSurface = bSurf;
  bg.userData.updateBounds = helpers.updateItemBounds;
  bg.userData.isBlockedPickup = function (it) { return helpers.isSurfaceOccupied(bSurf, it); };

  var bState = {
    on: false,
    heat: 0,
    coilMat: coilMat,
    reflectorMat: reflectorMat,
    ledMat: ledMat,
    knobGroup: knobGroup,
    surface: bSurf
  };
  var bIdx = ctx.burnerDevices.length;
  knobBase.userData.burnerSwitchIdx = bIdx;
  knobPointer.userData.burnerSwitchIdx = bIdx;
  ctx.burnerSwitchMeshes.push(knobBase, knobPointer);
  ctx.burnerDevices.push(bState);
  return helpers.registerPickable(id, 'Fogareiro Elétrico (Autoclave)', bg, px, py, pz, 0, 0.32, 0.12);
}
