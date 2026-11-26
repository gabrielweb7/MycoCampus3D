/**
 * Modelos 3D compartilhados das Vaquinhas, Cocôs com Mosquinhas e Cubensis Dourados.
 */

import { hash01, markAllShared } from '../world/ecology-shared.js';

const THREE = window.THREE;

let cowSharedAssets = null;
let poopSharedAssets = null;

export function getCowSharedAssets() {
  if (cowSharedAssets) return cowSharedAssets;
  cowSharedAssets = markAllShared({
    whiteMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 }),
    spotMats: [
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 }),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.78 })
    ],
    snoutMat: new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 }),
    hornMat: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 }),
    hoofMat: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 }),
    eyeMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    bodyGeo: new THREE.BoxGeometry(0.76, 0.56, 1.02),
    spot1Geo: new THREE.BoxGeometry(0.78, 0.28, 0.36),
    spot2Geo: new THREE.BoxGeometry(0.42, 0.24, 0.34),
    skullGeo: new THREE.BoxGeometry(0.54, 0.48, 0.48),
    eyePatchGeo: new THREE.BoxGeometry(0.20, 0.18, 0.04),
    snoutGeo: new THREE.BoxGeometry(0.44, 0.24, 0.20),
    eyeGeo: new THREE.SphereGeometry(0.055, 8, 8),
    hornGeo: new THREE.ConeGeometry(0.045, 0.15, 7),
    earGeo: new THREE.BoxGeometry(0.15, 0.08, 0.06),
    legGeo: new THREE.CylinderGeometry(0.08, 0.075, 0.24, 8),
    hoofGeo: new THREE.CylinderGeometry(0.085, 0.09, 0.08, 8),
    tailGeo: new THREE.CylinderGeometry(0.025, 0.02, 0.34, 6)
  });
  return cowSharedAssets;
}

export function getPoopSharedAssets() {
  if (poopSharedAssets) return poopSharedAssets;
  const capProfile = [
    new THREE.Vector2(0.084, -0.004),
    new THREE.Vector2(0.090, 0.000),
    new THREE.Vector2(0.078, 0.016),
    new THREE.Vector2(0.050, 0.038),
    new THREE.Vector2(0.022, 0.052),
    new THREE.Vector2(0.000, 0.056)
  ];
  poopSharedAssets = markAllShared({
    poopMat: new THREE.MeshStandardMaterial({ color: 0x6b3e1b, roughness: 0.92 }),
    flyBodyMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    wingMat: new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.75 }),
    mycMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }),
    stemMat: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 }),
    veilMat: new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.85, side: THREE.DoubleSide }),
    capMat: new THREE.MeshStandardMaterial({ color: 0xa1551c, roughness: 0.42, side: THREE.DoubleSide }),
    gillsMat: new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.88, side: THREE.DoubleSide }),
    poopBaseGeo: new THREE.CylinderGeometry(0.24, 0.28, 0.08, 10),
    poopMidGeo: new THREE.CylinderGeometry(0.16, 0.21, 0.07, 10),
    poopTopGeo: new THREE.ConeGeometry(0.11, 0.09, 8),
    flyBodyGeo: new THREE.SphereGeometry(0.018, 6, 6),
    wingGeo: new THREE.BoxGeometry(0.032, 0.004, 0.016),
    mycUnitGeo: new THREE.CylinderGeometry(1.0, 1.15, 0.014, 8),
    capGeo: new THREE.LatheGeometry(capProfile, 16),
    stemGeo: new THREE.CylinderGeometry(0.016, 0.024, 0.21, 10),
    veilGeo: new THREE.CylinderGeometry(0.017, 0.030, 0.022, 10, 1, true),
    gillsGeo: new THREE.CircleGeometry(0.083, 16)
  });
  return poopSharedAssets;
}

export function createCuteCowMesh(variant) {
  const g = new THREE.Group();
  const a = getCowSharedAssets();
  const spotMat = a.spotMats[variant % a.spotMats.length];

  const body = new THREE.Mesh(a.bodyGeo, a.whiteMat);
  body.position.set(0, 0.56, 0);
  g.add(body);

  const spot1 = new THREE.Mesh(a.spot1Geo, spotMat);
  spot1.position.set(0, 0.64, -0.14);
  const spot2 = new THREE.Mesh(a.spot2Geo, spotMat);
  spot2.position.set(0.18, 0.54, 0.28);
  g.add(spot1, spot2);

  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.62);
  const skull = new THREE.Mesh(a.skullGeo, a.whiteMat);
  const eyePatch = new THREE.Mesh(a.eyePatchGeo, spotMat);
  eyePatch.position.set(-0.14, 0.06, 0.23);
  const snout = new THREE.Mesh(a.snoutGeo, a.snoutMat);
  snout.position.set(0, -0.10, 0.26);

  [-0.14, 0.14].forEach((ex) => {
    const eye = new THREE.Mesh(a.eyeGeo, a.eyeMat);
    eye.position.set(ex, 0.06, 0.25);
    const horn = new THREE.Mesh(a.hornGeo, a.hornMat);
    horn.position.set(ex * 1.2, 0.29, 0);
    horn.rotation.z = ex < 0 ? 0.3 : -0.3;
    const ear = new THREE.Mesh(a.earGeo, a.whiteMat);
    ear.position.set(ex * 1.9, 0.18, -0.04);
    head.add(eye, horn, ear);
  });
  head.add(skull, eyePatch, snout);
  g.add(head);

  const legs = [];
  [[-0.24, 0.34], [0.24, 0.34], [-0.24, -0.34], [0.24, -0.34]].forEach((lp) => {
    const leg = new THREE.Group();
    leg.position.set(lp[0], 0.32, lp[1]);
    const upper = new THREE.Mesh(a.legGeo, a.whiteMat);
    upper.position.y = -0.12;
    const hoof = new THREE.Mesh(a.hoofGeo, a.hoofMat);
    hoof.position.y = -0.26;
    leg.add(upper, hoof);
    g.add(leg);
    legs.push(leg);
  });

  const tail = new THREE.Mesh(a.tailGeo, spotMat);
  tail.position.set(0, 0.58, -0.56);
  tail.rotation.x = 0.35;
  g.add(tail);

  return { group: g, body, head, legs, tail };
}

export function createPoopWithFliesAndCubensis(x, y, z, poopId, variantSeed) {
  const a = getPoopSharedAssets();
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const base = new THREE.Mesh(a.poopBaseGeo, a.poopMat);
  base.position.y = 0.04;
  const mid = new THREE.Mesh(a.poopMidGeo, a.poopMat);
  mid.position.y = 0.10;
  const top = new THREE.Mesh(a.poopTopGeo, a.poopMat);
  top.position.y = 0.17;
  g.add(base, mid, top);

  const flies = [];
  for (let fi = 0; fi < 3; fi++) {
    const fg = new THREE.Group();
    const fBody = new THREE.Mesh(a.flyBodyGeo, a.flyBodyMat);
    const wingL = new THREE.Mesh(a.wingGeo, a.wingMat);
    wingL.position.set(-0.018, 0.01, 0);
    const wingR = new THREE.Mesh(a.wingGeo, a.wingMat);
    wingR.position.set(0.018, 0.01, 0);
    fg.add(fBody, wingL, wingR);
    fg.position.set(0, 0.28 + fi * 0.05, 0);
    g.add(fg);
    flies.push({ group: fg, phase: fi * 2.1, radius: 0.14 + fi * 0.04 });
  }

  // Micélio branco colonizando o topo do cocô (estágio 0s-10s)
  const myceliumGroup = new THREE.Group();
  const mycCoords = [
    [0, 0.20, 0, 0.14], [-0.07, 0.18, 0.05, 0.09], [0.08, 0.18, -0.04, 0.08], [0.02, 0.19, 0.08, 0.07]
  ];
  for (let mi = 0; mi < mycCoords.length; mi++) {
    const m = mycCoords[mi];
    const patch = new THREE.Mesh(a.mycUnitGeo, a.mycMat);
    patch.scale.set(m[3], 1, m[3]);
    patch.position.set(m[0], m[1], m[2]);
    myceliumGroup.add(patch);
  }
  myceliumGroup.visible = false;
  g.add(myceliumGroup);

  // Cubensis reais com LatheGeometry compartilhada (zero alocação GPU ao defecar!)
  const cubensisGroup = new THREE.Group();
  cubensisGroup.visible = false;

  const caps = [];
  const mushParts = [];
  const patternType = Math.floor(hash01(variantSeed, 99) * 3);
  const offsets = patternType === 0
    ? [[0, 0, 1.45]]
    : (patternType === 1
      ? [[-0.06, 0.03, 1.05], [0.07, -0.04, 0.92]]
      : [[0, 0, 1.0], [-0.08, 0.06, 0.78], [0.09, -0.05, 0.85]]);

  offsets.forEach((off) => {
    const mg = new THREE.Group();
    mg.position.set(off[0], 0.14, off[1]);
    mg.scale.setScalar(off[2]);

    const stemPivot = new THREE.Group();
    const st = new THREE.Mesh(a.stemGeo, a.stemMat);
    st.position.y = 0.105;
    const veilRing = new THREE.Mesh(a.veilGeo, a.veilMat);
    veilRing.position.y = 0.135;
    veilRing.rotation.z = 0.15;
    stemPivot.add(st, veilRing);
    mg.add(stemPivot);

    const capGroup = new THREE.Group();
    capGroup.position.y = 0.205;
    const dome = new THREE.Mesh(a.capGeo, a.capMat);
    const gills = new THREE.Mesh(a.gillsGeo, a.gillsMat);
    gills.rotation.x = Math.PI / 2;
    gills.position.y = -0.002;
    dome.userData.wildMushId = poopId;
    dome.userData.speciesName = patternType === 0
      ? 'Cubensis Dourado Gigante (Psilocybe cubensis)'
      : 'Cubensis Dourado do Pasto (Psilocybe cubensis)';
    capGroup.add(dome, gills);
    mg.add(capGroup);

    cubensisGroup.add(mg);
    caps.push(dome);
    mushParts.push({ mg, stemPivot, veilRing, capGroup, targetScale: off[2] });
  });
  g.add(cubensisGroup);

  return { group: g, flies, myceliumGroup, cubensisGroup, caps, mushParts };
}
