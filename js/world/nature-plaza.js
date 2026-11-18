/**
 * MycoCampus3D — Mundo Natural, Floresta InstancedMesh, Cogumelos Silvestres & Praça Central
 */
import { makeBox, getTextures } from '../engine/textures.js';
import { terrainHeight } from '../engine/physics.js';

const THREE = window.THREE;

export function buildNatureWorld(ctx) {
  const { scene, solidColliders, wildMushrooms } = ctx;
  const size = 480;
  const segs = 140;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const cGrass = new THREE.Color(0x2f7038);
  const cGrassAlt = new THREE.Color(0x3c8444);
  const cMtn = new THREE.Color(0x1e462a);
  const cRock = new THREE.Color(0x475569);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    const col = ((Math.sin(x * 0.14) + Math.cos(z * 0.14)) > 0 ? cGrass : cGrassAlt).clone();
    if (y > 6) col.lerp(cMtn, Math.min(1, (y - 6) / 14));
    if (y > 22) col.lerp(cRock, Math.min(0.65, (y - 22) / 16));
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrainSnowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 });
  const terrain = new THREE.Mesh(geo, terrainSnowMat);
  terrain.receiveShadow = true;
  scene.add(terrain);
  if (ctx.setTerrainSnowMat) ctx.setTerrainSnowMat(terrainSnowMat);

  const treePositions = [];
  for (let idx = 0; idx < 420; idx++) {
    const ang = idx * 2.39996;
    const rad = 64 + Math.sqrt(idx / 420) * 95;
    const tx = Math.cos(ang) * rad;
    const tz = Math.sin(ang) * rad * 0.85;
    if (tx > -70 && tx < 74 && tz > -48 && tz < 46) continue;
    if (tz > 34 && tz < 46 && tx > -80 && tx < 20) continue;
    treePositions.push({ x: tx, y: terrainHeight(tx, tz), z: tz, s: 0.85 + (idx % 5) * 0.18 });
  }
  const extraTrees = [
    [-29, 18], [-29, -2], [-29, -20], [29, 18], [29, -18],
    [-14, 24], [14, 24], [-18, 34], [18, 34], [28, 32],
    [-32, 34], [64, -12], [68, 22], [32, -28], [-32, -32]
  ];
  extraTrees.forEach((et, k) => {
    treePositions.push({ x: et[0], y: 0, z: et[1], s: 0.95 + (k % 3) * 0.15 });
  });

  const count = treePositions.length;
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 3.2, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const cone1Geo = new THREE.ConeGeometry(2.1, 3.2, 8);
  const cone1Mat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 });
  const cone2Geo = new THREE.ConeGeometry(1.5, 2.6, 8);
  const cone2Mat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const cone1Inst = new THREE.InstancedMesh(cone1Geo, cone1Mat, count);
  const cone2Inst = new THREE.InstancedMesh(cone2Geo, cone2Mat, count);
  trunkInst.castShadow = true;
  cone1Inst.castShadow = true;
  cone2Inst.castShadow = true;

  const dummy = new THREE.Object3D();
  treePositions.forEach((tp, i) => {
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
      solidColliders.push({ minX: tp.x - 0.5, maxX: tp.x + 0.5, minZ: tp.z - 0.5, maxZ: tp.z + 0.5, minY: tp.y, maxY: tp.y + 5 });
    }
  });
  scene.add(trunkInst, cone1Inst, cone2Inst);

  const mushCoords = [
    [-11.5, 15.5], [11.5, 15.5], [-26, 8], [-27, -6], [26, 8], [27, -6],
    [-26, 18], [26, 18], [-16, 22], [16, 22], [-10, 32], [10, 32],
    [-24, 34], [24, 34], [-34, 4], [-34, -24], [32, -24], [34, 24],
    [48, -24], [58, -16], [62, 2], [58, 34], [36, 36], [-48, 28],
    [-64, 16], [-68, -12], [-58, -42], [-24, -42], [24, -42], [44, -40],
    [-74, 2], [74, 10]
  ];
  const capColors = [0xef4444, 0xf59e0b, 0xa855f7, 0xec4899, 0x10b981];
  mushCoords.forEach((mc, idx) => {
    const mx = mc[0], mz = mc[1];
    const my = terrainHeight(mx, mz);
    const g = new THREE.Group();
    g.position.set(mx, my, mz);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.14, 0.38, 8),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
    );
    stem.position.y = 0.19;
    g.add(stem);
    const capColor = capColors[idx % capColors.length];
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.42, emissive: capColor, emissiveIntensity: 0.22 })
    );
    cap.position.y = 0.36; cap.castShadow = true;
    g.add(cap);
    scene.add(g);
    wildMushrooms.push({ id: `wild_${idx}`, group: g, capMesh: cap, active: true, respawnAt: 0 });
  });
}

const LITE_FLORA = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

let sharedBedAssets = null;
function getSharedBedAssets() {
  if (sharedBedAssets) return sharedBedAssets;
  const flowerCols = [0xf472b6, 0xc084fc, 0x38bdf8, 0xfb923c, 0xfacc15];
  sharedBedAssets = {
    curbGeo: new THREE.CylinderGeometry(1, 1, 0.22, 24),
    curbMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 }),
    grassGeo: new THREE.CylinderGeometry(1, 1, 0.24, 24),
    grassMat: new THREE.MeshStandardMaterial({ color: 0x3b8c3b, roughness: 0.9 }),
    trunkGeo: new THREE.CylinderGeometry(0.16, 0.28, 1.55, 8),
    rootGeo: new THREE.ConeGeometry(0.11, 0.42, 6),
    branchGeo: new THREE.CylinderGeometry(0.07, 0.11, 0.85, 6),
    puffGeo: new THREE.SphereGeometry(1, 10, 8),
    potGeo: new THREE.CylinderGeometry(0.18, 0.13, 0.24, 10),
    rimGeo: new THREE.TorusGeometry(0.18, 0.028, 6, 12),
    leafGeo: new THREE.SphereGeometry(0.09, 7, 6),
    stemGeo: new THREE.CylinderGeometry(0.018, 0.022, 0.24, 6),
    centerGeo: new THREE.SphereGeometry(0.045, 7, 5),
    petalGeo: new THREE.SphereGeometry(0.055, 6, 5),
    trunkMat: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.88 }),
    leafDarkMat: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 }),
    leafBrightMat: new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.68 }),
    potMat: new THREE.MeshStandardMaterial({ color: 0xc26a3b, roughness: 0.75 }),
    rimMat: new THREE.MeshStandardMaterial({ color: 0xd97742, roughness: 0.7 }),
    stemMat: new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.65 }),
    centerMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }),
    petalMats: flowerCols.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }))
  };
  return sharedBedAssets;
}

export function createFlowerBed(scene, cx, cz, rx, rz, rotY) {
  const A = getSharedBedAssets();
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY || 0;

  const curb = new THREE.Mesh(A.curbGeo, A.curbMat);
  curb.scale.set(rx + 0.22, 1, rz + 0.22);
  curb.position.y = 0.11;
  curb.receiveShadow = true;
  g.add(curb);

  const grass = new THREE.Mesh(A.grassGeo, A.grassMat);
  grass.scale.set(rx, 1, rz);
  grass.position.y = 0.12;
  grass.receiveShadow = true;
  g.add(grass);

  // Árvore estilizada central com galhos, raízes e copa em camadas
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(A.trunkGeo, A.trunkMat);
  trunk.position.y = 0.95;
  trunk.castShadow = true;
  tree.add(trunk);

  for (let ri = 0; ri < 4; ri++) {
    const ra = (ri / 4) * Math.PI * 2 + 0.35;
    const root = new THREE.Mesh(A.rootGeo, A.trunkMat);
    root.position.set(Math.cos(ra) * 0.22, 0.28, Math.sin(ra) * 0.22);
    root.rotation.z = Math.cos(ra) * 0.95;
    root.rotation.x = -Math.sin(ra) * 0.95;
    tree.add(root);
  }

  const branchAngles = [0.2, 2.3, 4.4];
  for (let bi = 0; bi < branchAngles.length; bi++) {
    const ba = branchAngles[bi];
    const br = new THREE.Mesh(A.branchGeo, A.trunkMat);
    br.position.set(Math.cos(ba) * 0.32, 1.75, Math.sin(ba) * 0.32);
    br.rotation.z = -Math.cos(ba) * 0.65;
    br.rotation.x = Math.sin(ba) * 0.65;
    tree.add(br);
  }

  const canopyClusters = [
    [0, 2.45, 0, 0.95, 1],
    [-0.65, 2.15, 0.25, 0.68, 0],
    [0.62, 2.2, -0.22, 0.72, 1],
    [0.12, 2.12, 0.64, 0.66, 0],
    [-0.18, 2.18, -0.62, 0.64, 1],
    [0, 2.85, 0, 0.65, 1]
  ];
  for (let ci = 0; ci < canopyClusters.length; ci++) {
    const c = canopyClusters[ci];
    const puff = new THREE.Mesh(A.puffGeo, c[4] ? A.leafBrightMat : A.leafDarkMat);
    puff.position.set(c[0], c[1], c[2]);
    puff.scale.set(c[3], c[3] * 0.78, c[3]);
    puff.castShadow = true;
    tree.add(puff);
  }
  g.add(tree);

  for (let pi = 0; pi < (LITE_FLORA ? 0 : 3); pi++) {
    const pa = (pi / 3) * Math.PI * 2 + 0.5;
    const px = Math.cos(pa) * rx * 0.52;
    const pz = Math.sin(pa) * rz * 0.52;
    const potGrp = new THREE.Group();
    potGrp.position.set(px, 0.24, pz);
    const pot = new THREE.Mesh(A.potGeo, A.potMat);
    pot.position.y = 0.12;
    const rim = new THREE.Mesh(A.rimGeo, A.rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.24;
    potGrp.add(pot, rim);
    for (let li = 0; li < 5; li++) {
      const la = (li / 5) * Math.PI * 2;
      const lf = new THREE.Mesh(A.leafGeo, A.leafBrightMat);
      lf.scale.set(0.7, 1.35, 0.35);
      lf.position.set(Math.cos(la) * 0.11, 0.33, Math.sin(la) * 0.11);
      lf.rotation.y = -la;
      lf.rotation.x = 0.45;
      potGrp.add(lf);
    }
    g.add(potGrp);
  }

  const flowerCount = LITE_FLORA ? 6 : 12;
  for (let i = 0; i < flowerCount; i++) {
    const a = (i / flowerCount) * Math.PI * 2;
    const fx = Math.cos(a) * rx * 0.78;
    const fz = Math.sin(a) * rz * 0.78;
    const flGrp = new THREE.Group();
    flGrp.position.set(fx, 0.24, fz);
    const stem = new THREE.Mesh(A.stemGeo, A.stemMat);
    stem.position.y = 0.12;
    flGrp.add(stem);

    const head = new THREE.Group();
    head.position.y = 0.25;
    head.rotation.x = 0.25;
    head.add(new THREE.Mesh(A.centerGeo, A.centerMat));
    const pMat = A.petalMats[i % A.petalMats.length];
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2;
      const pet = new THREE.Mesh(A.petalGeo, pMat);
      pet.scale.set(0.85, 0.45, 1.25);
      pet.position.set(Math.cos(pa) * 0.075, 0, Math.sin(pa) * 0.075);
      pet.rotation.y = -pa;
      head.add(pet);
    }
    flGrp.add(head);
    g.add(flGrp);
  }
  scene.add(g);
}

let benchWoodMat = null;
let benchFrameMat = null;

export function createBench(scene, seatMeshes, x, z, rotY) {
  if (!benchWoodMat) {
    const wc = document.createElement('canvas');
    wc.width = 512; wc.height = 128;
    const wctx = wc.getContext('2d');
    const grad = wctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#9a5b25');
    grad.addColorStop(0.5, '#b06d32');
    grad.addColorStop(1, '#854d1e');
    wctx.fillStyle = grad;
    wctx.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 42; i++) {
      wctx.strokeStyle = i % 3 === 0 ? 'rgba(69, 26, 3, 0.28)' : 'rgba(120, 53, 15, 0.20)';
      wctx.lineWidth = 1 + (i % 3);
      wctx.beginPath();
      const baseY = (i / 42) * 128;
      wctx.moveTo(0, baseY);
      for (let wx = 32; wx <= 512; wx += 32) {
        wctx.lineTo(wx, baseY + Math.sin(wx * 0.025 + i * 0.7) * 5);
      }
      wctx.stroke();
    }
    const wTex = new THREE.CanvasTexture(wc);
    wTex.wrapS = wTex.wrapT = THREE.RepeatWrapping;
    benchWoodMat = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.38, metalness: 0.06 });
    benchFrameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.30, metalness: 0.78 });
  }

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  [-0.88, 0.88].forEach((sx) => {
    const frontLeg = makeBox(0.046, 0.43, 0.046, benchFrameMat);
    frontLeg.position.set(sx, 0.215, 0.235);
    const rearLeg = makeBox(0.046, 0.43, 0.046, benchFrameMat);
    rearLeg.position.set(sx, 0.215, -0.225);
    const footF = makeBox(0.054, 0.014, 0.054, benchFrameMat, { noShadow: true });
    footF.position.set(sx, 0.007, 0.235);
    const footR = makeBox(0.054, 0.014, 0.054, benchFrameMat, { noShadow: true });
    footR.position.set(sx, 0.007, -0.225);
    const sideBar = makeBox(0.046, 0.046, 0.506, benchFrameMat);
    sideBar.position.set(sx, 0.422, 0.005);
    const backPost = makeBox(0.046, 0.51, 0.046, benchFrameMat);
    backPost.position.set(sx, 0.655, -0.268);
    backPost.rotation.x = -0.20;
    g.add(frontLeg, rearLeg, footF, footR, sideBar, backPost);
  });

  const frontRail = makeBox(1.806, 0.040, 0.042, benchFrameMat);
  frontRail.position.set(0, 0.422, 0.235);
  const rearRail = makeBox(1.806, 0.040, 0.042, benchFrameMat);
  rearRail.position.set(0, 0.422, -0.225);
  const midBrace = makeBox(0.040, 0.036, 0.48, benchFrameMat, { noShadow: true });
  midBrace.position.set(0, 0.418, 0.005);
  g.add(frontRail, rearRail, midBrace);

  const seatPlankF = makeBox(1.714, 0.034, 0.195, benchWoodMat);
  seatPlankF.position.set(0, 0.442, 0.115);
  const seatPlankR = makeBox(1.714, 0.034, 0.195, benchWoodMat);
  seatPlankR.position.set(0, 0.442, -0.105);

  const backPlankLow = makeBox(1.714, 0.156, 0.032, benchWoodMat);
  backPlankLow.position.set(0, 0.585, -0.248);
  backPlankLow.rotation.x = -0.20;
  const backPlankHigh = makeBox(1.714, 0.156, 0.032, benchWoodMat);
  backPlankHigh.position.set(0, 0.782, -0.288);
  backPlankHigh.rotation.x = -0.20;

  g.add(seatPlankF, seatPlankR, backPlankLow, backPlankHigh);

  const sitYaw = rotY + Math.PI;
  [-0.44, 0.44].forEach((offsetX) => {
    const worldX = x + Math.cos(rotY) * offsetX + Math.sin(rotY) * 0.05;
    const worldZ = z - Math.sin(rotY) * offsetX + Math.cos(rotY) * 0.05;
    const seatHit = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.55, 0.56),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    seatHit.position.set(offsetX, 0.56, -0.02);
    seatHit.userData.seatInfo = { x: worldX, y: 0.02, z: worldZ, yaw: sitYaw };
    g.add(seatHit);
    seatMeshes.push(seatHit);
  });

  scene.add(g);
}

export function createCampusLamp(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65 }));
  pole.position.y = 1.7; pole.castShadow = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.85 }));
  bulb.position.y = 3.45;
  g.add(pole, bulb);
  scene.add(g);
}

export function createBanner(scene, x, y, z, rotY, colorHex, emblem) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 320;
  const ctx = c.getContext('2d');
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

  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 2.2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
}

export function buildPlaza(ctx) {
  const { scene, solidColliders, seatMeshes, fountainRipples } = ctx;
  const { texPaving, texWater } = getTextures();

  const plazaFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 42),
    new THREE.MeshStandardMaterial({ map: texPaving, roughness: 0.88, metalness: 0.02 })
  );
  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.position.set(0, 0.02, 1);
  plazaFloor.receiveShadow = true;
  scene.add(plazaFloor);

  const fx = 0, fz = 2;
  const basinStoneMat = new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.58, metalness: 0.08 });
  const basinInnerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.68, side: THREE.DoubleSide });
  const tilePoolMat = new THREE.MeshStandardMaterial({ color: 0x075985, roughness: 0.35, metalness: 0.15 });
  const waterSurfMat = new THREE.MeshStandardMaterial({
    map: texWater, color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.22,
    roughness: 0.06, metalness: 0.22, transparent: true, opacity: 0.88, depthWrite: false
  });

  const poolFloor = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.12, 36), tilePoolMat);
  poolFloor.position.set(fx, 0.06, fz);
  poolFloor.receiveShadow = true;
  scene.add(poolFloor);

  const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(2.98, 3.10, 0.50, 36, 1, true), basinStoneMat);
  outerWall.position.set(fx, 0.25, fz);
  outerWall.castShadow = true; outerWall.receiveShadow = true;
  const innerWall = new THREE.Mesh(new THREE.CylinderGeometry(2.58, 2.58, 0.48, 36, 1, true), basinInnerMat);
  innerWall.position.set(fx, 0.24, fz);
  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(2.78, 0.23, 14, 40), basinStoneMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.scale.set(1, 1, 0.45);
  rimTop.position.set(fx, 0.50, fz);
  rimTop.castShadow = true; rimTop.receiveShadow = true;
  scene.add(outerWall, innerWall, rimTop);

  const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(2.57, 36), waterSurfMat);
  waterDisc.rotation.x = -Math.PI / 2;
  waterDisc.position.set(fx, 0.43, fz);
  scene.add(waterDisc);

  const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 0.26, 24), basinStoneMat);
  pedBase.position.set(fx, 0.22, fz);
  const ped1 = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.86, 0.88, 24), basinStoneMat);
  ped1.position.set(fx, 0.72, fz); ped1.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 0.68, 0.30, 28), basinStoneMat);
  bowl.position.set(fx, 1.22, fz); bowl.castShadow = true;
  const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.08, 10, 32), basinStoneMat);
  bowlRim.rotation.x = Math.PI / 2;
  bowlRim.position.set(fx, 1.37, fz);
  const upperWater = new THREE.Mesh(new THREE.CircleGeometry(1.23, 28), waterSurfMat);
  upperWater.rotation.x = -Math.PI / 2;
  upperWater.position.set(fx, 1.38, fz);
  scene.add(pedBase, ped1, bowl, bowlRim, upperWater);

  const streamMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide });
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  for (let j = 0; j < 8; j++) {
    const jAng = (j / 8) * Math.PI * 2;
    const jx = fx + Math.cos(jAng) * 1.42;
    const jz = fz + Math.sin(jAng) * 1.42;
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.055, 0.96, 8, 1, true), streamMat);
    stream.position.set(fx + Math.cos(jAng) * 1.34, 0.89, fz + Math.sin(jAng) * 1.34);
    stream.rotation.z = -Math.cos(jAng) * 0.16;
    stream.rotation.x = Math.sin(jAng) * 0.16;
    scene.add(stream);

    const rip = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.15, 18), rippleMat);
    rip.rotation.x = -Math.PI / 2;
    rip.position.set(jx, 0.44, jz);
    scene.add(rip);
    fountainRipples.push({ mesh: rip, phase: j * 0.78 });
  }

  const dropCount = 84;
  const dropArr = new Float32Array(dropCount * 3);
  for (let di = 0; di < dropCount; di++) {
    const dAng = (di / dropCount) * Math.PI * 2 * 4;
    const dRad = 1.15 + (di % 7) * 0.12;
    dropArr[di * 3] = fx + Math.cos(dAng) * dRad;
    dropArr[di * 3 + 1] = 0.44 + (di / dropCount) * 0.95;
    dropArr[di * 3 + 2] = fz + Math.sin(dAng) * dRad;
  }
  const dropGeo = new THREE.BufferGeometry();
  const fountainDropsAttr = new THREE.BufferAttribute(dropArr, 3);
  dropGeo.setAttribute('position', fountainDropsAttr);
  const dropPoints = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.075, transparent: true, opacity: 0.82, depthWrite: false }));
  scene.add(dropPoints);
  if (ctx.setFountainDropsAttr) ctx.setFountainDropsAttr(fountainDropsAttr);

  const mStem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.35, 16), new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.55 }));
  mStem.position.set(fx, 1.98, fz); mStem.castShadow = true;
  const mCap = new THREE.Mesh(
    new THREE.SphereGeometry(1.18, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, emissive: 0x7f1d1d, emissiveIntensity: 0.22, side: THREE.DoubleSide })
  );
  mCap.position.set(fx, 2.58, fz); mCap.castShadow = true;
  const mGills = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 1.158, 0.14, 22),
    new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.78 })
  );
  mGills.position.set(fx, 2.43, fz);
  const mRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.41, 0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 })
  );
  mRing.position.set(fx, 2.16, fz);
  scene.add(mStem, mCap, mGills, mRing);
  for (let s = 0; s < 8; s++) {
    const ang = (s / 8) * Math.PI * 2;
    const rSpot = s % 2 === 0 ? 0.96 : 0.68;
    const ySpot = s % 2 === 0 ? 3.12 : 3.48;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
    spot.position.set(fx + Math.cos(ang) * rSpot, ySpot, fz + Math.sin(ang) * rSpot);
    scene.add(spot);
  }
  // Colisão octogonal inscrita no chafariz redondo (sem cantos quadrados invisíveis!)
  solidColliders.push(
    { minX: fx - 2.65, maxX: fx + 2.65, minZ: fz - 1.45, maxZ: fz + 1.45, minY: 0, maxY: 4.0 },
    { minX: fx - 1.45, maxX: fx + 1.45, minZ: fz - 2.65, maxZ: fz + 2.65, minY: 0, maxY: 4.0 },
    { minX: fx - 2.0, maxX: fx + 2.0, minZ: fz - 2.0, maxZ: fz + 2.0, minY: 0, maxY: 4.0 }
  );

  createFlowerBed(scene, -5.8, -4.5, 3.0, 1.8, -0.35);
  createFlowerBed(scene, 5.8, -4.5, 3.0, 1.8, 0.35);
  createFlowerBed(scene, -6.2, 8.2, 3.2, 1.9, 0.42);
  createFlowerBed(scene, 6.2, 8.2, 3.2, 1.9, -0.42);

  createBench(scene, seatMeshes, -3.8, -2.2, 0.8);
  createBench(scene, seatMeshes, 3.8, -2.2, -0.8);
  createBench(scene, seatMeshes, -6.0, 2.2, Math.PI / 2);
  createBench(scene, seatMeshes, 6.0, 2.2, -Math.PI / 2);
  createBench(scene, seatMeshes, -3.5, 13.5, 0);
  createBench(scene, seatMeshes, 3.5, 13.5, 0);

  createCampusLamp(scene, -10.5, -10.5);
  createCampusLamp(scene, 10.5, -10.5);
  createCampusLamp(scene, -10.5, 12.0);
  createCampusLamp(scene, 10.5, 12.0);
}
