/**
 * Modelos 3D Low-Poly das Abelhas (Rainha e Operárias), Colmeias e Árvores (MycoCampus3D).
 */

import { terrainHeight } from '../engine/physics.js';
import { getCachedCanvasTexture } from '../items/item-registry.js';
import { FLOWER_COLORS } from '../world/campus-flowers.js';
import { markAllShared, markSubtreeDynamic } from '../world/ecology-shared.js';

const THREE = window.THREE;

let beeSharedAssets = null;

export function createBeveledBoxGeo(w, h, d, bevel = 0.022) {
  if (!THREE || !THREE.Shape || !THREE.ExtrudeGeometry) {
    return THREE && THREE.BoxGeometry ? new THREE.BoxGeometry(w, h, d) : {};
  }
  const iw = Math.max(0.012, w - bevel * 2);
  const ih = Math.max(0.012, h - bevel * 2);
  const id = Math.max(0.012, d - bevel * 2);
  const r = Math.min(bevel * 0.75, iw * 0.25, ih * 0.25);
  const hw = iw * 0.5;
  const hh = ih * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: id,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 3
  });
  geo.center();
  return geo;
}

export function createFacetedWingGeo() {
  if (!THREE || !THREE.Shape || !THREE.ExtrudeGeometry) {
    return THREE && THREE.BoxGeometry ? new THREE.BoxGeometry(0.16, 0.008, 0.11) : {};
  }
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-0.055, 0.048);
  shape.lineTo(-0.145, 0.078);
  shape.lineTo(-0.185, 0.032);
  shape.lineTo(-0.165, -0.038);
  shape.lineTo(-0.072, -0.046);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.006,
    bevelEnabled: false,
    curveSegments: 2
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function getBeeSharedAssets() {
  if (beeSharedAssets) return beeSharedAssets;
  const spriteTex = getCachedCanvasTexture('bee_swarm_migrating_lbl', 320, 64, (sctx) => {
    sctx.clearRect(0, 0, 320, 64);
    sctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    sctx.beginPath();
    if (sctx.roundRect) sctx.roundRect(6, 6, 308, 52, 14);
    else sctx.rect(6, 6, 308, 52);
    sctx.fill();
    sctx.strokeStyle = '#facc15';
    sctx.lineWidth = 3;
    sctx.stroke();
    sctx.fillStyle = '#fef08a';
    sctx.font = 'bold 22px system-ui, sans-serif';
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText('🐝 Enxame migrando!', 160, 33);
  });

  const loadCuteTex = (file) => {
    if (typeof document === 'undefined' || !THREE.TextureLoader) return null;
    try {
      const tex = new THREE.TextureLoader().load('assets/textures/' + file);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      tex.userData.shared = true;
      return tex;
    } catch (e) {
      return null;
    }
  };
  const hiveTex = loadCuteTex('beehive-cute.jpg');

  beeSharedAssets = markAllShared({
    yellowMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.42, emissive: 0xeab308, emissiveIntensity: 0.22, flatShading: true }),
    queenYellowMat: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.34, emissive: 0xf59e0b, emissiveIntensity: 0.28, flatShading: true }),
    ruffMat: new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.65, emissive: 0xfef3c7, emissiveIntensity: 0.14, flatShading: true }),
    blushMat: new THREE.MeshBasicMaterial({ color: 0xfb7185 }),
    crownMat: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.24, metalness: 0.65, emissive: 0xd97706, emissiveIntensity: 0.30, flatShading: true }),
    darkMat: new THREE.MeshStandardMaterial({ color: 0x26140a, roughness: 0.62, flatShading: true }),
    eyeWhiteMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    wingMat: new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.78,
      roughness: 0.16,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      flatShading: true
    }),
    wingVeinMat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }),
    pollenMat: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.50, emissive: 0xb45309, emissiveIntensity: 0.24, flatShading: true }),
    hiveWoodMat: new THREE.MeshStandardMaterial({ color: hiveTex ? 0xffe4b5 : 0xf59e0b, map: hiveTex, roughness: 0.62, emissive: 0xb45309, emissiveIntensity: 0.12 }),
    hiveDarkMat: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.68, emissive: 0x92400e, emissiveIntensity: 0.14, flatShading: true }),
    hiveGlowMat: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.95, roughness: 0.3 }),
    hiveLeafMat: new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.55, emissive: 0x4d7c0f, emissiveIntensity: 0.18, flatShading: true }),
    hiveAbandonedMat: new THREE.MeshStandardMaterial({ color: 0x94a3b8, map: hiveTex, roughness: 0.94 }),
    hiveAbandonedBandMat: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.96, flatShading: true }),
    hiveHitMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    honeyMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.18, metalness: 0.08, emissive: 0xd97706, emissiveIntensity: 0.34, flatShading: true }),
    jewelMat: new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.65, roughness: 0.18, flatShading: true }),
    holeMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    trunkMat: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 }),
    leafMat: new THREE.MeshStandardMaterial({ color: 0x36b45e, roughness: 0.82 }),
    leafLightMat: new THREE.MeshStandardMaterial({ color: 0x74cf65, roughness: 0.8 }),
    centerGeo: new THREE.SphereGeometry(0.045, 7, 6),
    petalMats: FLOWER_COLORS.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65 })),
    birchCrownGeo: new THREE.DodecahedronGeometry(1, 1),
    trunkGeo: new THREE.CylinderGeometry(0.24, 0.30, 3.6, 8),
    hiveBaseGeo: new THREE.CylinderGeometry(0.24, 0.14, 0.10, 8),
    hiveBandBotGeo: new THREE.CylinderGeometry(0.30, 0.25, 0.13, 8),
    hiveRibBotGeo: new THREE.CylinderGeometry(0.325, 0.32, 0.055, 8),
    hiveBandMidGeo: new THREE.CylinderGeometry(0.325, 0.325, 0.16, 8),
    hiveRibTopGeo: new THREE.CylinderGeometry(0.315, 0.325, 0.055, 8),
    hiveBandTopGeo: new THREE.CylinderGeometry(0.255, 0.30, 0.12, 8),
    hiveCapGeo: new THREE.CylinderGeometry(0.14, 0.265, 0.10, 8),
    hiveHangerBarGeo: createBeveledBoxGeo(0.56, 0.065, 0.095, 0.012),
    hiveHangerPostGeo: createBeveledBoxGeo(0.075, 0.10, 0.085, 0.010),
    hiveLeafGeo: new THREE.SphereGeometry(0.075, 6, 5),
    hiveArchPillarGeo: createBeveledBoxGeo(0.048, 0.15, 0.065, 0.010),
    hiveArchTopGeo: createBeveledBoxGeo(0.115, 0.048, 0.068, 0.010),
    hiveGlowGeo: createBeveledBoxGeo(0.105, 0.14, 0.045, 0.014),
    hivePorchGeo: createBeveledBoxGeo(0.21, 0.036, 0.095, 0.010),
    hiveHitGeo: new THREE.CylinderGeometry(0.36, 0.36, 0.72, 8),
    honeyDropGeo: new THREE.SphereGeometry(0.036, 7, 6),
    jewelGeo: new THREE.OctahedronGeometry(0.019, 0),
    beeBodyGeo: createBeveledBoxGeo(0.19, 0.175, 0.25, 0.022),
    beeStripeGeo: createBeveledBoxGeo(0.198, 0.181, 0.044, 0.014),
    beeButtGeo: createBeveledBoxGeo(0.15, 0.135, 0.036, 0.014),
    beeStingerGeo: new THREE.ConeGeometry(0.018, 0.052, 6),
    beeEyeGeo: new THREE.SphereGeometry(0.026, 8, 6),
    beeGlintGeo: new THREE.SphereGeometry(0.011, 6, 5),
    beeSmileGeo: THREE.TorusGeometry ? new THREE.TorusGeometry(0.016, 0.0045, 6, 10, Math.PI) : new THREE.BoxGeometry(0.03, 0.008, 0.008),
    beeBlushGeo: new THREE.SphereGeometry(0.018, 6, 5),
    beeAntStemGeo: new THREE.CylinderGeometry(0.007, 0.008, 0.038, 6),
    beeAntTipGeo: new THREE.SphereGeometry(0.012, 6, 5),
    beeLegGeo: new THREE.CylinderGeometry(0.011, 0.009, 0.040, 6),
    beePollenGeo: new THREE.SphereGeometry(0.045, 7, 6),
    beeWingGeo: createFacetedWingGeo(),
    beeWingVeinGeo: new THREE.BoxGeometry(0.105, 0.009, 0.008),
    queenRuffGeo: new THREE.SphereGeometry(0.034, 7, 6),
    crownBaseGeo: new THREE.CylinderGeometry(0.062, 0.054, 0.030, 8),
    crownSpikeGeo: new THREE.ConeGeometry(0.017, 0.044, 5),
    crownOrbGeo: new THREE.SphereGeometry(0.011, 6, 5),
    spriteMat: spriteTex ? new THREE.SpriteMaterial({ map: spriteTex, transparent: true, depthTest: true, depthWrite: false }) : null
  });
  return beeSharedAssets;
}

export function createCuteBeeMesh(isQueen) {
  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial) {
    return {
      group: {
        position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        rotation: { x: 0, y: 0, z: 0 },
        visible: true,
        parent: null
      },
      wingL: { rotation: { x: 0, y: 0, z: 0 } },
      wingR: { rotation: { x: 0, y: 0, z: 0 } },
      pollenMesh: { visible: false },
      migrationSprite: isQueen ? { visible: false } : null,
      legs: []
    };
  }
  const a = getBeeSharedAssets();
  const g = new THREE.Group();

  const body = new THREE.Mesh(a.beeBodyGeo, isQueen ? a.queenYellowMat : a.yellowMat);
  g.add(body);

  const stripe1 = new THREE.Mesh(a.beeStripeGeo, a.darkMat);
  stripe1.position.z = -0.005;
  const stripe2 = new THREE.Mesh(a.beeStripeGeo, a.darkMat);
  stripe2.position.z = -0.075;
  const buttCap = new THREE.Mesh(a.beeButtGeo, a.darkMat);
  buttCap.position.z = -0.116;
  const stinger = new THREE.Mesh(a.beeStingerGeo, a.darkMat);
  stinger.rotation.x = -Math.PI / 2;
  stinger.position.set(0, -0.01, -0.15);
  g.add(stripe1, stripe2, buttCap, stinger);

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(a.beeEyeGeo, a.darkMat);
    eye.scale.set(0.85, 1.32, 0.52);
    eye.position.set(side * 0.052, 0.006, 0.124);
    const glint = new THREE.Mesh(a.beeGlintGeo, a.eyeWhiteMat);
    glint.position.set(side * 0.044, 0.020, 0.134);
    const blush = new THREE.Mesh(a.beeBlushGeo, a.blushMat);
    blush.scale.set(1.25, 0.72, 0.45);
    blush.position.set(side * 0.068, -0.026, 0.122);

    const antPivot = new THREE.Group();
    antPivot.position.set(side * 0.046, 0.088, 0.092);
    antPivot.rotation.set(0.45, 0, -side * 0.25);
    const antStem = new THREE.Mesh(a.beeAntStemGeo, a.darkMat);
    antStem.position.y = 0.018;
    const antTip = new THREE.Mesh(a.beeAntTipGeo, a.darkMat);
    antTip.position.set(0, 0.038, 0.010);
    antPivot.add(antStem, antTip);

    g.add(eye, glint, blush, antPivot);
  });

  const smile = new THREE.Mesh(a.beeSmileGeo, a.darkMat);
  smile.position.set(0, -0.006, 0.130);
  smile.rotation.z = Math.PI;
  g.add(smile);

  const legs = [];
  for (let p = 0; p < 3; p++) {
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(a.beeLegGeo, a.darkMat);
      leg.position.set(side * 0.052, -0.10, 0.052 - p * 0.055);
      g.add(leg);
      legs.push(leg);
    });
  }

  const pollenMesh = new THREE.Mesh(a.beePollenGeo, a.pollenMat);
  pollenMesh.position.set(0, -0.115, -0.02);
  pollenMesh.visible = false;
  g.add(pollenMesh);

  const wingL = new THREE.Group();
  wingL.position.set(-0.040, 0.092, -0.01);
  const wMeshL = new THREE.Mesh(a.beeWingGeo, a.wingMat);
  const wVeinL1 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinL1.position.set(-0.08, 0.003, -0.012);
  wVeinL1.rotation.y = 0.16;
  const wVeinL2 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinL2.scale.set(0.68, 1, 0.9);
  wVeinL2.position.set(-0.075, 0.003, 0.016);
  wVeinL2.rotation.y = -0.26;
  wingL.add(wMeshL, wVeinL1, wVeinL2);

  const wingR = new THREE.Group();
  wingR.position.set(0.040, 0.092, -0.01);
  const wMeshR = new THREE.Mesh(a.beeWingGeo, a.wingMat);
  wMeshR.scale.x = -1;
  const wVeinR1 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinR1.position.set(0.08, 0.003, -0.012);
  wVeinR1.rotation.y = -0.16;
  const wVeinR2 = new THREE.Mesh(a.beeWingVeinGeo, a.wingVeinMat);
  wVeinR2.scale.set(0.68, 1, 0.9);
  wVeinR2.position.set(0.075, 0.003, 0.016);
  wVeinR2.rotation.y = 0.26;
  wingR.add(wMeshR, wVeinR1, wVeinR2);

  g.add(wingL, wingR);

  let migrationSprite = null;
  if (isQueen) {
    [-0.068, -0.036, 0, 0.036, 0.068].forEach((rx, rIdx) => {
      const puff = new THREE.Mesh(a.queenRuffGeo, a.ruffMat);
      const midBoost = 1 - Math.abs(rIdx - 2) * 0.12;
      puff.scale.set(0.95 * midBoost, 0.85 * midBoost, 0.95 * midBoost);
      puff.position.set(rx, -0.062 - (1 - midBoost) * 0.008, 0.105 - Math.abs(rx) * 0.28);
      g.add(puff);
    });

    const crownBase = new THREE.Mesh(a.crownBaseGeo, a.crownMat);
    crownBase.position.set(0, 0.106, 0.045);
    g.add(crownBase);
    [[-0.038, 0.048], [0, 0.056], [0.038, 0.048]].forEach(([cx, cz]) => {
      const spike = new THREE.Mesh(a.crownSpikeGeo, a.crownMat);
      spike.position.set(cx, 0.138, cz);
      const orb = new THREE.Mesh(a.crownOrbGeo, a.crownMat);
      orb.position.set(cx, 0.162, cz);
      g.add(spike, orb);
    });
    const jewel = new THREE.Mesh(a.jewelGeo, a.jewelMat);
    jewel.position.set(0, 0.130, 0.072);
    g.add(jewel);
    g.scale.setScalar(1.06);

    if (a.spriteMat) {
      migrationSprite = new THREE.Sprite(a.spriteMat);
      migrationSprite.position.set(0, 0.34, 0);
      migrationSprite.scale.set(1.45, 0.29, 1);
      migrationSprite.visible = false;
      g.add(migrationSprite);
    }
  } else {
    g.scale.setScalar(0.76);
  }

  markSubtreeDynamic(g);
  return { group: g, wingL, wingR, pollenMesh, migrationSprite, legs };
}

export function spawnTreeWithHiveSlot(ctx, x, z) {
  const gy = terrainHeight(x, z);
  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial || !ctx || !ctx.scene) {
    return { tree: null, gy, posX: x, posZ: z };
  }
  const a = getBeeSharedAssets();
  const tree = new THREE.Group();
  tree.position.set(x, gy, z);
  const trunk = new THREE.Mesh(a.trunkGeo, a.trunkMat);
  trunk.position.y = 1.8;
  const crownPuffs = [
    [-0.62, 3.9, 0.08, 1.05, 0], [0.62, 3.95, -0.12, 1.08, 1],
    [0.05, 4.18, 0.64, 0.96, 1], [-0.08, 4.25, -0.62, 0.92, 0],
    [0, 4.88, 0, 1.02, 1]
  ];
  const crownMeshes = [];
  for (let ci = 0; ci < crownPuffs.length; ci++) {
    const cp = crownPuffs[ci];
    const crown = new THREE.Mesh(a.birchCrownGeo, cp[4] ? a.leafLightMat : a.leafMat);
    crown.position.set(cp[0], cp[1], cp[2]);
    crown.scale.set(cp[3], cp[3] * 0.8, cp[3]);
    crown.rotation.set(ci * 0.11, ci * 0.72, ci * 0.08);
    crown.castShadow = true;
    crownMeshes.push(crown);
  }
  tree.add(trunk, ...crownMeshes);
  ctx.scene.add(tree);
  return { tree, gy, posX: x, posZ: z };
}

export function buildHiveVisualGroup() {
  const a = getBeeSharedAssets();
  const hiveGroup = new THREE.Group();

  const baseBowl = new THREE.Mesh(a.hiveBaseGeo, a.hiveDarkMat);
  baseBowl.position.y = -0.27;
  const bandBot = new THREE.Mesh(a.hiveBandBotGeo, a.hiveWoodMat);
  bandBot.position.y = -0.16;
  const ribBot = new THREE.Mesh(a.hiveRibBotGeo, a.hiveDarkMat);
  ribBot.position.y = -0.085;
  const bandMid = new THREE.Mesh(a.hiveBandMidGeo, a.hiveWoodMat);
  bandMid.position.y = 0.02;
  const ribTop = new THREE.Mesh(a.hiveRibTopGeo, a.hiveDarkMat);
  ribTop.position.y = 0.125;
  const bandTop = new THREE.Mesh(a.hiveBandTopGeo, a.hiveWoodMat);
  bandTop.position.y = 0.21;
  const capDome = new THREE.Mesh(a.hiveCapGeo, a.hiveDarkMat);
  capDome.position.y = 0.315;

  const hangerBar = new THREE.Mesh(a.hiveHangerBarGeo, a.hiveDarkMat);
  hangerBar.position.set(-0.08, 0.42, 0);
  const hangerPostL = new THREE.Mesh(a.hiveHangerPostGeo, a.hiveDarkMat);
  hangerPostL.position.set(-0.28, 0.36, 0);
  const hangerPostR = new THREE.Mesh(a.hiveHangerPostGeo, a.hiveDarkMat);
  hangerPostR.position.set(0.14, 0.36, 0);
  const hiveLeaf = new THREE.Mesh(a.hiveLeafGeo, a.hiveLeafMat);
  hiveLeaf.scale.set(1.1, 0.72, 0.42);
  hiveLeaf.position.set(0.04, 0.485, 0);
  hiveLeaf.rotation.set(0.18, 0.35, 0.48);

  const archL = new THREE.Mesh(a.hiveArchPillarGeo, a.hiveDarkMat);
  archL.position.set(-0.078, -0.11, 0.302);
  const archR = new THREE.Mesh(a.hiveArchPillarGeo, a.hiveDarkMat);
  archR.position.set(0.078, -0.11, 0.302);
  const archTop = new THREE.Mesh(a.hiveArchTopGeo, a.hiveDarkMat);
  archTop.position.set(0, -0.032, 0.302);
  const hiveGlow = new THREE.Mesh(a.hiveGlowGeo, a.hiveGlowMat);
  hiveGlow.position.set(0, -0.108, 0.282);
  const hivePorch = new THREE.Mesh(a.hivePorchGeo, a.hiveDarkMat);
  hivePorch.position.set(0, -0.195, 0.318);

  const honeyDropGroup = new THREE.Group();
  const dropSpecs = [
    [-0.14, 0.08, 0.318, 1.05, 1.55, 0.65],
    [-0.18, 0.095, 0.305, 0.75, 1.15, 0.60],
    [0.19, 0.165, 0.255, 0.85, 1.40, 0.65],
    [0.24, 0.045, 0.225, 0.70, 1.15, 0.60]
  ];
  for (let di = 0; di < dropSpecs.length; di++) {
    const ds = dropSpecs[di];
    const dm = new THREE.Mesh(a.honeyDropGeo, a.honeyMat);
    dm.position.set(ds[0], ds[1], ds[2]);
    dm.scale.set(ds[3], ds[4], ds[5]);
    honeyDropGroup.add(dm);
  }

  const hitMesh = new THREE.Mesh(a.hiveHitGeo, a.hiveHitMat);
  hitMesh.position.y = 0.04;

  hiveGroup.add(
    baseBowl, bandBot, ribBot, bandMid, ribTop, bandTop, capDome,
    hangerBar, hangerPostL, hangerPostR, hiveLeaf,
    archL, archR, archTop, hiveGlow, hivePorch, honeyDropGroup, hitMesh
  );
  markSubtreeDynamic(hiveGroup);
  return {
    hiveGroup,
    bandBot,
    bandMid,
    bandTop,
    ribBot,
    baseBowl,
    ribTop,
    capDome,
    hangerBar,
    hangerPostL,
    hangerPostR,
    archL,
    archR,
    archTop,
    hiveGlow,
    hiveLeaf,
    hivePorch,
    honeyDropGroup,
    hitMesh
  };
}
