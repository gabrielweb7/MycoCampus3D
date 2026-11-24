/**
 * MycoCampus3D — Construtor de Prédios Universitários (2 Andares, Persianas, Portas & Lousas)
 */
import { makeBox, brickMat, woodMat, registerSnowable } from '../engine/textures.js';
import { addWalkableSlab, addSolidWall } from '../engine/physics.js';
import { nightLampGlows } from './nature-plaza.js';

const THREE = window.THREE;

let sharedBlindMats = null;
function getBlindMats() {
  if (!sharedBlindMats) {
    sharedBlindMats = {
      headMat: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.72, roughness: 0.26 }),
      slatMat: new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.54, roughness: 0.30, side: THREE.DoubleSide }),
      tapeMat: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.65 }),
      wandMat: new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.72, roughness: 0.15 }),
      cordMat: new THREE.MeshBasicMaterial({ color: 0xf1f5f9 }),
      knobMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
      hitMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    };
  }
  return sharedBlindMats;
}

let sharedBuildingMats = null;
function getBuildingMats() {
  if (!sharedBuildingMats) {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0xfde68a,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      metalness: 0.25
    });
    glassMat.userData.keepPbr = true;
    glassMat.userData.shared = true;
    glassMat.userData.nightMaxEmissive = 0.55;
    nightLampGlows.push(glassMat);
    sharedBuildingMats = {
      glassMat,
      fixMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.4 }),
      fndeBlue: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42 }),
      fndeWhite: new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.3 }),
      fndeDark: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65 }),
      chairLegMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.45, roughness: 0.28 }),
      frameMat: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.35 })
    };
  }
  return sharedBuildingMats;
}

const _blindDummy = new THREE.Object3D();

export function createVenetianBlind(ctx, xPos, topY, zCenter, blindW, dropH, dir, roomCenterZ) {
  const { scene, windowBlinds, blindHitMeshes } = ctx;
  const root = new THREE.Group();
  root.position.set(xPos, topY, zCenter);

  const BM = getBlindMats();

  const headrail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.10, blindW), BM.headMat);
  headrail.position.set(0, -0.05, 0);
  root.add(headrail);

  const numSlats = 22;
  const slatGeo = new THREE.BoxGeometry(0.165, 0.012, blindW - 0.04);
  const slatInst = new THREE.InstancedMesh(slatGeo, BM.slatMat, numSlats);
  for (let s = 0; s < numSlats; s++) {
    _blindDummy.position.set(0, -0.11 - ((s + 0.5) / numSlats) * (dropH - 0.14), 0);
    _blindDummy.rotation.set(0, 0, dir * 1.15);
    _blindDummy.scale.set(1, 1, 1);
    _blindDummy.updateMatrix();
    slatInst.setMatrixAt(s, _blindDummy.matrix);
  }
  slatInst.instanceMatrix.needsUpdate = true;
  root.add(slatInst);

  const tapeGeo = new THREE.BoxGeometry(0.012, dropH, 0.022);
  const tapeParts = [];
  [-blindW * 0.34, 0, blindW * 0.34].forEach((tz) => {
    [-0.048, 0.048].forEach((tx) => {
      const tg = tapeGeo.clone();
      tg.translate(tx, -dropH * 0.5, tz);
      tapeParts.push(tg);
    });
  });
  const mergedTapeGeo = THREE.mergeGeometries ? THREE.mergeGeometries(tapeParts, false) : null;
  tapeParts.forEach((tg) => tg.dispose());
  tapeGeo.dispose();
  let tapesMesh;
  if (mergedTapeGeo) {
    tapesMesh = new THREE.Mesh(mergedTapeGeo, BM.tapeMat);
  } else {
    tapesMesh = new THREE.Group();
    [-blindW * 0.34, 0, blindW * 0.34].forEach((tz) => {
      [-0.048, 0.048].forEach((tx) => {
        const tp = new THREE.Mesh(new THREE.BoxGeometry(0.012, dropH, 0.022), BM.tapeMat);
        tp.position.set(tx, -dropH * 0.5, tz);
        tapesMesh.add(tp);
      });
    });
  }
  root.add(tapesMesh);

  const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, blindW - 0.02), BM.headMat);
  bottomRail.position.set(0, -dropH, 0);
  root.add(bottomRail);

  const sideSign = zCenter < roomCenterZ ? 1 : -1;
  const ctrlZ = sideSign * (blindW * 0.41);
  const wand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, dropH * 0.66, 8),
    BM.wandMat
  );
  wand.position.set(-dir * 0.068, -dropH * 0.36, ctrlZ - sideSign * 0.14);
  const cordLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, dropH * 0.52, 6),
    BM.cordMat
  );
  cordLine.position.set(-dir * 0.068, -dropH * 0.28, ctrlZ);
  const cordKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.024, 0.075, 10),
    BM.knobMat
  );
  cordKnob.position.set(-dir * 0.068, -dropH * 0.54, ctrlZ);
  root.add(wand, cordLine, cordKnob);

  const blindObj = {
    id: `blind_${windowBlinds.length}`,
    slatInst,
    slatCount: numSlats,
    bottomRail,
    tapesMesh,
    cordKnob,
    open: false,
    progress: 1.0,
    dropH,
    dir
  };

  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, dropH, blindW),
    BM.hitMat
  );
  hitMesh.visible = false;
  hitMesh.position.set(0, -dropH / 2, 0);
  hitMesh.userData.blindObj = blindObj;
  root.add(hitMesh);
  blindHitMeshes.push(hitMesh);
  windowBlinds.push(blindObj);
  scene.add(root);
}

export function buildCampusBuildingWing(ctx, opts) {
  const {
    scene, walkableFloors, wallSegments, roofZones, lightSwitchMeshes, campusLightSwitches,
    solidColliders, supportSurfaces, supportMeshes, seatMeshes, chalkboards, chalkboardMeshes,
    campusDoors, doorHitMeshes, registerPickable
  } = ctx;

  const w = opts.width || 10.0;
  const d = opts.depth || 11.6;
  const h1 = 3.56;
  const h2 = 3.5;
  const yFloor1 = 0.12;
  const yFloor2 = 3.80;
  const totalH = h1 + h2;
  const cx = opts.cx, cz = opts.cz;
  const dir = opts.faceDir;
  const frontX = cx + dir * (w / 2);
  const backX = cx - dir * (w / 2);
  const zN = cz - d / 2;
  const zS = cz + d / 2;

  addWalkableSlab(scene, walkableFloors, cx, yFloor1, cz, w + 0.4, 0.14, d + 0.4, 0x475569, { roughness: 0.7 });
  addWalkableSlab(scene, walkableFloors, cx, yFloor2, cz, w + 0.35, 0.24, d + 0.35, 0x334155, { roughness: 0.55 });

  const roofSlab = makeBox(w + 0.6, 0.32, d + 0.6, 0x94a3b8, { roughness: 0.5, uniqueMat: true });
  roofSlab.position.set(cx, yFloor2 + h2 + 0.16, cz);
  registerSnowable(roofSlab.material);
  roofZones.push({ minX: cx - w / 2 - 0.5, maxX: cx + w / 2 + 0.5, minZ: cz - d / 2 - 0.5, maxZ: cz + d / 2 + 0.5, roofY: yFloor2 + h2 + 0.32 });
  scene.add(roofSlab);
  const parapet = makeBox(w + 0.72, 0.42, d + 0.72, 0x64748b, { roughness: 0.5 });
  parapet.position.set(cx, yFloor2 + h2 + 0.43, cz);
  scene.add(parapet);

  [[frontX, zN], [frontX, zS], [backX, zN], [backX, zS]].forEach((pp) => {
    const col = makeBox(0.45, totalH + 0.35, 0.45, 0x1e293b, { roughness: 0.5 });
    col.position.set(pp[0], yFloor1 + totalH / 2, pp[1]);
    scene.add(col);
  });

  const wallMat = opts.style === 'wood' ? woodMat(3, 2) : brickMat(3, 2);
  const BLD = getBuildingMats();
  const glassMat = BLD.glassMat;

  addSolidWall(scene, wallSegments, backX, zN, backX, zS, yFloor1, totalH, 0.28, wallMat);

  const wallMinX = cx - w / 2;
  const wallMaxX = cx + w / 2;

  addSolidWall(scene, wallSegments, backX, zN, frontX, zN, yFloor1, h1, 0.28, brickMat(2.5, 1.2));
  if (opts.connectNorth2F) {
    addSolidWall(scene, wallSegments, wallMinX, zN, cx - 1.6, zN, yFloor2, h2, 0.28, brickMat(1, 1));
    addSolidWall(scene, wallSegments, cx + 1.6, zN, wallMaxX, zN, yFloor2, h2, 0.28, brickMat(1, 1));
    const headerN = makeBox(3.2, 0.7, 0.28, 0x334155);
    headerN.position.set(cx, yFloor2 + h2 - 0.35, zN);
    scene.add(headerN);
  } else {
    addSolidWall(scene, wallSegments, backX, zN, frontX, zN, yFloor2, h2, 0.28, brickMat(2.5, 1.2));
  }

  addSolidWall(scene, wallSegments, backX, zS, frontX, zS, yFloor1, h1, 0.28, brickMat(2.5, 1.2));
  if (opts.labInterior) {
    // Revestimento interno em duas faixas. O tijolo continua visível pelo lado de fora.
    const panels = [
      [d, backX + dir * 0.145, cz, dir * Math.PI / 2],
      [w, cx, zN + 0.145, 0],
      [w, cx, zS - 0.145, Math.PI]
    ];
    const finish = [
      [1.48, 0.74, 0x52958e],
      [h1 - 1.48, (h1 + 1.48) * 0.5, 0xe6d8bd]
    ];
    for (const [height, centerY, color] of finish) {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
      mat.userData.keepExactStyle = true;
      for (const [width, x, z, yaw] of panels) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
        panel.position.set(x, yFloor1 + centerY, z);
        panel.rotation.y = yaw;
        panel.receiveShadow = true;
        scene.add(panel);
      }
    }
  }
  if (opts.connectSouth2F) {
    addSolidWall(scene, wallSegments, wallMinX, zS, cx - 1.6, zS, yFloor2, h2, 0.28, brickMat(1, 1));
    addSolidWall(scene, wallSegments, cx + 1.6, zS, wallMaxX, zS, yFloor2, h2, 0.28, brickMat(1, 1));
    const headerS = makeBox(3.2, 0.7, 0.28, 0x334155);
    headerS.position.set(cx, yFloor2 + h2 - 0.35, zS);
    scene.add(headerS);
  } else {
    addSolidWall(scene, wallSegments, backX, zS, frontX, zS, yFloor2, h2, 0.28, brickMat(2.5, 1.2));
  }

  addSolidWall(scene, wallSegments, frontX, zN, frontX, zS, yFloor2, h2 - 0.1, 0.14, glassMat, { noShadow: true });
  for (let m = -2; m <= 2; m++) {
    const mullion = makeBox(0.18, h2 - 0.1, 0.12, 0x0f172a);
    mullion.position.set(frontX, yFloor2 + (h2 - 0.1) / 2, cz + m * (d / 5));
    scene.add(mullion);
  }
  createVenetianBlind(ctx, frontX - dir * 0.11, yFloor2 + h2 - 0.14, cz - d * 0.24, d * 0.45, h2 - 0.26, dir, cz);
  createVenetianBlind(ctx, frontX - dir * 0.11, yFloor2 + h2 - 0.14, cz + d * 0.24, d * 0.45, h2 - 0.26, dir, cz);

  const ceilPlaster1 = makeBox(w - 0.1, 0.02, d - 0.1, 0xe2e8f0, { roughness: 0.7, noShadow: true });
  ceilPlaster1.position.set(cx, 3.55, cz);
  scene.add(ceilPlaster1);

  const fixMat = BLD.fixMat;
  function createFloorLighting(floorY, floorH, swX, swY, swZ, swRotY) {
    const fTubeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfffbeb, emissiveIntensity: 0.85, roughness: 0.35 });
    const ceilY = floorY < 1.0 ? 3.51 : (floorY + floorH - 0.04);
    [-2.0, 2.0].forEach((lx) => {
      [-2.8, 2.8].forEach((lz) => {
        const trayL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 1.65), fixMat);
        trayL.position.set(cx + lx, ceilY, cz + lz);
        scene.add(trayL);
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 1.5, 6), fTubeMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(cx + lx, ceilY - 0.04, cz + lz);
        tube.matrixAutoUpdate = false;
        tube.updateMatrix();
        scene.add(tube);
      });
    });

    const fLight = new THREE.PointLight(0xfffbeb, 1.35, 16, 1.85);
    fLight.position.set(cx, ceilY - 0.55, cz);
    scene.add(fLight);

    const swGroup = new THREE.Group();
    swGroup.position.set(swX, swY, swZ);
    swGroup.rotation.y = swRotY || 0;
    const swPlate = makeBox(0.18, 0.28, 0.03, 0xf8fafc, { roughness: 0.3 });
    const swRocker = makeBox(0.08, 0.12, 0.04, 0xe2e8f0, { roughness: 0.4 });
    swRocker.position.z = 0.02;
    swRocker.rotation.x = -0.22;
    const swLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const swLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.02), swLedMat);
    swLed.position.set(0, 0.09, 0.025);
    swGroup.add(swPlate, swRocker, swLed);
    const swData = {
      id: `light_${campusLightSwitches.length}`,
      on: true,
      light: fLight,
      gLight: null,
      tubeMat: fTubeMat,
      ledMat: swLedMat,
      rocker: swRocker
    };
    swPlate.userData.lightSwitch = swData;
    swRocker.userData.lightSwitch = swData;
    lightSwitchMeshes.push(swPlate, swRocker);
    campusLightSwitches.push(swData);
    scene.add(swGroup);
  }
  createFloorLighting(yFloor1, h1, frontX - dir * 1.15, yFloor1 + 1.32, zS - 0.155, Math.PI);
  createFloorLighting(yFloor2, h2, cx - dir * 2.15, yFloor2 + 1.32, zN + 0.155, 0);

  const fndeBlue = BLD.fndeBlue;
  const fndeWhite = BLD.fndeWhite;
  const fndeDark = BLD.fndeDark;
  const legMat = BLD.chairLegMat;
  const padMat = BLD.fndeBlue;
  for (let dtRow = -1; dtRow <= 1; dtRow++) {
    const deskZ = cz + dtRow * 3.0;
    const deskX = cx + dir * 1.1;
    const deskGrp = new THREE.Group();
    deskGrp.position.set(deskX, yFloor2, deskZ);
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.045, 1.96), fndeBlue);
    deskTop.position.set(0, 0.72, 0);
    const underTray = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 1.66), fndeDark);
    underTray.position.set(0, 0.61, 0);
    [-0.82, 0.82].forEach((lz) => {
      const legPost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.70, 10), fndeWhite);
      legPost.position.set(0, 0.36, lz);
      const footBar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.88, 10), fndeWhite);
      footBar.rotation.z = Math.PI / 2;
      footBar.position.set(0, 0.032, lz);
      [-0.42, 0.42].forEach((fx) => {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.07), fndeDark);
        cap.position.set(fx, 0.028, lz);
        deskGrp.add(cap);
      });
      deskGrp.add(legPost, footBar);
    });
    deskGrp.add(deskTop, underTray);
    scene.add(deskGrp);
    solidColliders.push({
      minX: deskX - 0.56, maxX: deskX + 0.56,
      minZ: deskZ - 1.02, maxZ: deskZ + 1.02,
      minY: yFloor2, maxY: yFloor2 + 0.745, surfaceTopY: yFloor2 + 0.745
    });
    const deskSurf = {
      minX: deskX - 0.50, maxX: deskX + 0.50,
      minZ: deskZ - 0.94, maxZ: deskZ + 0.94,
      topY: yFloor2 + 0.745
    };
    supportSurfaces.push(deskSurf);
    deskTop.userData.supportSurface = deskSurf;
    supportMeshes.push(deskTop);

    [-0.5, 0.5].forEach((chDz) => {
      const chairX = cx + dir * 2.1;
      const chairZ = deskZ + chDz;
      const cg = new THREE.Group();
      cg.position.set(chairX, yFloor2, chairZ);
      [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach((lp) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), legMat);
        leg.position.set(lp[0], 0.22, lp[1]);
        cg.add(leg);
      });
      [-0.15, 0.15].forEach((bz) => {
        const backBar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8), legMat);
        backBar.position.set(dir * 0.21, 0.60, bz);
        cg.add(backBar);
      });
      const seatPad = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.045, 0.45), padMat);
      seatPad.position.set(0, 0.445, 0);
      const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.44), padMat);
      backPad.position.set(dir * 0.21, 0.72, 0);
      cg.add(seatPad, backPad);
      const sitYaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      seatPad.userData.seatInfo = { x: chairX, y: yFloor2, z: chairZ, yaw: sitYaw };
      seatMeshes.push(seatPad);
      scene.add(cg);
    });
  }

  const board = makeBox(0.1, 2.35, 8.0, 0x78350f, { roughness: 0.6 });
  board.position.set(backX + dir * 0.22, yFloor2 + 2.02, cz);
  scene.add(board);

  const bIdx = opts.boardIndex || 0;
  const bSuffix = bIdx === 0 ? '' : '_' + bIdx;
  const bCanvas = document.createElement('canvas');
  bCanvas.width = 512;
  bCanvas.height = 256;
  const bCtx = bCanvas.getContext('2d');
  bCtx.fillStyle = '#14532d';
  bCtx.fillRect(0, 0, 512, 256);
  bCtx.fillStyle = 'rgba(255,255,255,0.28)';
  bCtx.font = 'bold 16px system-ui, sans-serif';
  bCtx.fillText('Lousa Interativa • Pegue um giz ou apagador abaixo', 16, 26);
  const bTex = new THREE.CanvasTexture(bCanvas);

  const bMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 2.15),
    new THREE.MeshBasicMaterial({ map: bTex })
  );
  bMesh.position.set(backX + dir * 0.28, yFloor2 + 2.02, cz);
  bMesh.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  bMesh.userData.boardIndex = bIdx;
  scene.add(bMesh);
  chalkboards[bIdx] = { id: bIdx, mesh: bMesh, canvas: bCanvas, ctx: bCtx, tex: bTex };
  chalkboardMeshes.push(bMesh);

  const trayX = backX + dir * 0.42;
  const trayY = yFloor2 + 0.84;
  const tray = makeBox(0.38, 0.08, 6.8, 0x78350f, { roughness: 0.7 });
  tray.position.set(trayX, trayY, cz);
  scene.add(tray);
  const traySurf = {
    minX: trayX - 0.24, maxX: trayX + 0.24,
    minZ: cz - 3.42, maxZ: cz + 3.42,
    topY: trayY + 0.04
  };
  supportSurfaces.push(traySurf);
  tray.userData.supportSurface = traySurf;
  supportMeshes.push(tray);

  const chalkDefs = [
    { id: 'chalk_white' + bSuffix, label: 'Giz Branco', color: 0xf8fafc, dz: -0.9 },
    { id: 'chalk_green' + bSuffix, label: 'Giz Verde', color: 0x4ade80, dz: -0.3 },
    { id: 'chalk_yellow' + bSuffix, label: 'Giz Amarelo', color: 0xfacc15, dz: 0.3 }
  ];
  chalkDefs.forEach((cd) => {
    const cg = new THREE.Group();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: cd.color, roughness: 0.9 })
    );
    stick.rotation.x = Math.PI / 2;
    stick.position.y = 0.03;
    cg.add(stick);
    registerPickable(cd.id, cd.label, cg, trayX, trayY + 0.04, cz + cd.dz, 0, 0.15, 0.12);
  });

  const eraser = new THREE.Group();
  const eWood = makeBox(0.12, 0.06, 0.28, 0x92400e, { roughness: 0.75 });
  eWood.position.y = 0.06;
  const eFelt = makeBox(0.12, 0.03, 0.28, 0x1e293b, { roughness: 0.95 });
  eFelt.position.y = 0.015;
  eraser.add(eWood, eFelt);
  registerPickable('board_eraser' + bSuffix, 'Apagador da Lousa', eraser, trayX, trayY + 0.04, cz + 0.95, 0, 0.2, 0.14);

  const doorHalfW = 0.96;
  const doorH = 2.75;
  addSolidWall(scene, wallSegments, frontX, zN, frontX, cz - doorHalfW, yFloor1, h1, 0.14, glassMat, { noShadow: true });
  addSolidWall(scene, wallSegments, frontX, cz + doorHalfW, frontX, zS, yFloor1, h1, 0.14, glassMat, { noShadow: true });

  const transomH = h1 - doorH;
  const transomGlass = makeBox(0.12, transomH, doorHalfW * 2, glassMat, { noShadow: true });
  transomGlass.position.set(frontX, yFloor1 + doorH + transomH / 2, cz);
  scene.add(transomGlass);

  const frameMat = BLD.frameMat;
  [-doorHalfW, doorHalfW].forEach((dz) => {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.20, h1, 0.14), frameMat);
    jamb.position.set(frontX, yFloor1 + h1 / 2, cz + dz);
    scene.add(jamb);
  });
  const transomBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, doorHalfW * 2 + 0.14), frameMat);
  transomBar.position.set(frontX, yFloor1 + doorH, cz);
  const topFacadeBar = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, d - 0.3), frameMat);
  topFacadeBar.position.set(frontX, yFloor1 + h1 - 0.05, cz);
  scene.add(transomBar, topFacadeBar);

  if (opts.doorSign) {
    const sCan = document.createElement('canvas');
    sCan.width = 512; sCan.height = 160;
    const sCtx = sCan.getContext('2d');
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
    const sTex = new THREE.CanvasTexture(sCan);
    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.44, 1.55),
      new THREE.MeshStandardMaterial({ map: sTex, emissive: 0x064e3b, emissiveIntensity: 0.35, roughness: 0.3 })
    );
    signMesh.position.set(frontX + dir * 0.06, yFloor1 + doorH + transomH * 0.5, cz);
    if (dir < 0) signMesh.rotation.y = Math.PI;
    scene.add(signMesh);
  }

  const sideWinW = (d / 2) - doorHalfW - 0.26;
  const sideCenterOffset = doorHalfW + 0.04 + sideWinW / 2;
  createVenetianBlind(ctx, frontX - dir * 0.11, yFloor1 + h1 - 0.08, cz - sideCenterOffset, sideWinW, h1 - 0.16, dir, cz);
  createVenetianBlind(ctx, frontX - dir * 0.11, yFloor1 + h1 - 0.08, cz + sideCenterOffset, sideWinW, h1 - 0.16, dir, cz);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(frontX, yFloor1, cz - doorHalfW + 0.04);
  const leafW = (doorHalfW - 0.04) * 2;
  const doorGlass = makeBox(0.036, doorH - 0.17, leafW - 0.15, 0x0f766e, { transparent: true, opacity: 0.58, roughness: 0.15, noShadow: true });
  doorGlass.position.set(0, doorH / 2 - 0.01, leafW / 2);
  const stL = new THREE.Mesh(new THREE.BoxGeometry(0.11, doorH, 0.08), frameMat);
  stL.position.set(0, doorH / 2, 0.04);
  const stR = new THREE.Mesh(new THREE.BoxGeometry(0.11, doorH, 0.08), frameMat);
  stR.position.set(0, doorH / 2, leafW - 0.04);
  const rlT = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.08, leafW - 0.16), frameMat);
  rlT.position.set(0, doorH - 0.04, leafW / 2);
  const rlB = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.10, leafW - 0.16), frameMat);
  rlB.position.set(0, 0.05, leafW / 2);
  const doorHandle = makeBox(0.18, 0.42, 0.035, 0xe2e8f0, { metalness: 0.85, roughness: 0.2, noShadow: true });
  doorHandle.position.set(0, 1.12, leafW - 0.18);
  doorPivot.add(doorGlass, stL, stR, rlT, rlB, doorHandle);
  scene.add(doorPivot);

  const doorObj = {
    id: `door_${campusDoors.length}`,
    pivot: doorPivot,
    open: false,
    angle: 0,
    frontX,
    minZ: cz - doorHalfW,
    maxZ: cz + doorHalfW,
    dir,
    label: opts.doorLabel || 'Porta da Sala'
  };
  doorGlass.userData.doorObj = doorObj;
  stL.userData.doorObj = doorObj;
  stR.userData.doorObj = doorObj;
  doorHandle.userData.doorObj = doorObj;
  doorHitMeshes.push(doorGlass, stL, stR, doorHandle);
  campusDoors.push(doorObj);
}
