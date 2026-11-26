/**
 * MycoCampus3D — Gnomos da Brisa (aparecem andando, correndo, observando e fugindo se chegar perto)
 */
import { getGroundHeight, terrainHeight } from '../engine/physics.js';
import { makeTextSprite, updateTextSprite } from '../engine/textures.js';
import { isNaturalSoilSpot } from './nature-plaza.js';
import { getVirtualDayFrac } from './staircase-clock.js';

const THREE = window.THREE;

const TUNIC_COLORS = [0x2563eb, 0x16a34a, 0x7c3aed, 0x0d9488, 0xd97706];
const CALM_EMOTES = ['😊', '🍄', '✨', '😐', '🤔', '🤪', '🧐', '💭'];
const FEAR_EMOTES = ['😱', '😨', '👁️', '💀'];
const FLOWER_COLORS = [0xf472b6, 0xc084fc, 0x60a5fa, 0xfb923c, 0xfacc15, 0xf8fafc, 0xfb7185];

let gnomePool = null;
let shadowGnomePool = null;
let lonelyTreeGnome = null;
const LONELY_TREE_SPOTS = [
  { x: -58, z: -52 },
  { x: -66, z: 38 },
  { x: 58, z: -52 },
  { x: 74, z: 42 }
];
let floraPool = null;
let fireflyPoints = null;
let fireflyData = null;
let trampolinePool = null;
let sharedGeos = null;
let floraGeos = null;
let cachedFlowTextures = null;
let flowTime = 0;
let flowWasActive = false;
const _tmpFireflyColor = (THREE && THREE.Color) ? new THREE.Color() : null;

function collectFlowTextures(scene) {
  const seen = new Set();
  const list = [];
  if (!scene) return list;
  scene.traverse((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m) continue;
      const tex = m.map;
      if (tex && !seen.has(tex) && tex.wrapS === THREE.RepeatWrapping && tex.wrapT === THREE.RepeatWrapping) {
        seen.add(tex);
        list.push({ tex, baseX: tex.offset.x, baseY: tex.offset.y, phase: list.length * 0.7 });
      }
    }
  });
  return list;
}

function stepTripTextureFlow(scene, dt) {
  const strength = typeof window !== 'undefined' && window.getTripTextureFlowStrength
    ? window.getTripTextureFlowStrength()
    : 0;
  if (strength <= 0) {
    if (flowWasActive && cachedFlowTextures) {
      for (let i = 0; i < cachedFlowTextures.length; i++) {
        const entry = cachedFlowTextures[i];
        entry.tex.offset.set(entry.baseX, entry.baseY);
      }
      flowWasActive = false;
      flowTime = 0;
    }
    return;
  }
  if (!cachedFlowTextures) cachedFlowTextures = collectFlowTextures(scene);
  flowWasActive = true;
  flowTime += dt;
  const drift = (flowTime * 0.012 * strength) % 1;
  for (let i = 0; i < cachedFlowTextures.length; i++) {
    const entry = cachedFlowTextures[i];
    const waveX = Math.sin(flowTime * 0.42 + entry.phase) * 0.032 * strength;
    const waveY = Math.cos(flowTime * 0.36 + entry.phase) * 0.032 * strength;
    entry.tex.offset.set(entry.baseX + drift + waveX, entry.baseY + drift * 0.65 + waveY);
  }
}

function getFloraGeos() {
  if (floraGeos) return floraGeos;
  floraGeos = {
    stem: new THREE.CylinderGeometry(0.022, 0.028, 0.34, 6),
    leaf: new THREE.SphereGeometry(0.08, 6, 5),
    petal: new THREE.SphereGeometry(0.065, 7, 6),
    center: new THREE.SphereGeometry(0.055, 8, 6),
    tuftBlade: new THREE.ConeGeometry(0.06, 0.28, 5),
    bTrunk: new THREE.CylinderGeometry(0.09, 0.14, 1.5, 8),
    bLeaf: new THREE.BoxGeometry(0.34, 0.03, 1.1),
    banana: new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6)
  };
  return floraGeos;
}

function createFlowerMesh(colorHex) {
  const g = getFloraGeos();
  const grp = new THREE.Group();
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
  const petalMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const centerMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });

  const stem = new THREE.Mesh(g.stem, stemMat);
  stem.position.y = 0.17;
  grp.add(stem);

  const leafL = new THREE.Mesh(g.leaf, stemMat);
  leafL.scale.set(1.2, 0.35, 0.7);
  leafL.position.set(-0.07, 0.11, 0);
  leafL.rotation.z = 0.55;
  const leafR = new THREE.Mesh(g.leaf, stemMat);
  leafR.scale.set(1.2, 0.35, 0.7);
  leafR.position.set(0.07, 0.13, 0);
  leafR.rotation.z = -0.55;
  grp.add(leafL, leafR);

  const head = new THREE.Group();
  head.position.set(0, 0.35, 0);
  head.rotation.x = 0.28;
  const center = new THREE.Mesh(g.center, centerMat);
  head.add(center);
  for (let p = 0; p < 6; p++) {
    const ang = (p / 6) * Math.PI * 2;
    const pet = new THREE.Mesh(g.petal, petalMat);
    pet.scale.set(0.85, 0.45, 1.25);
    pet.position.set(Math.cos(ang) * 0.085, 0, Math.sin(ang) * 0.085);
    pet.rotation.y = -ang;
    head.add(pet);
  }
  grp.add(head);
  return grp;
}

function createTuftMesh() {
  const g = getFloraGeos();
  const grp = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x22c55e });
  for (let i = 0; i < 5; i++) {
    const blade = new THREE.Mesh(g.tuftBlade, mat);
    const a = (i / 5) * Math.PI * 2;
    blade.position.set(Math.cos(a) * 0.07, 0.12, Math.sin(a) * 0.07);
    blade.rotation.z = Math.cos(a) * 0.38;
    blade.rotation.x = -Math.sin(a) * 0.38;
    grp.add(blade);
  }
  return grp;
}

function createBananaTreeMesh() {
  const g = getFloraGeos();
  const grp = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x84cc16 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x16a34a });
  const bananaMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });

  const trunk = new THREE.Mesh(g.bTrunk, trunkMat);
  trunk.position.y = 0.75;
  grp.add(trunk);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const leaf = new THREE.Mesh(g.bLeaf, leafMat);
    leaf.position.set(Math.cos(a) * 0.52, 1.48, Math.sin(a) * 0.52);
    leaf.rotation.y = -a + Math.PI / 2;
    leaf.rotation.x = 0.42;
    grp.add(leaf);
  }
  const bunch = new THREE.Mesh(g.banana, bananaMat);
  bunch.position.set(0.16, 1.24, 0.12);
  bunch.rotation.z = 0.25;
  grp.add(bunch);
  return grp;
}

function stepEnchantedFlora(ctx, dt, show) {
  if (!show) {
    if (floraPool) {
      for (let i = 0; i < floraPool.length; i++) floraPool[i].mesh.visible = false;
    }
    return;
  }
  const px = ctx.playerPos.x;
  const pz = ctx.playerPos.z;
  if (!floraPool) {
    floraPool = [];
    for (let i = 0; i < 24; i++) {
      const m = createFlowerMesh(FLOWER_COLORS[i % FLOWER_COLORS.length]);
      m.visible = false;
      ctx.scene.add(m);
      floraPool.push({ mesh: m, targetScale: 0.9 + Math.random() * 0.55, curScale: 0.01, phase: Math.random() * 6.28 });
    }
    for (let i = 0; i < 12; i++) {
      const m = createTuftMesh();
      m.visible = false;
      ctx.scene.add(m);
      floraPool.push({ mesh: m, targetScale: 0.9 + Math.random() * 0.5, curScale: 0.01, phase: Math.random() * 6.28 });
    }
    for (let i = 0; i < 5; i++) {
      const m = createBananaTreeMesh();
      m.visible = false;
      ctx.scene.add(m);
      floraPool.push({ mesh: m, targetScale: 0.85 + Math.random() * 0.35, curScale: 0.01, phase: Math.random() * 6.28 });
    }
  }

  for (let i = 0; i < floraPool.length; i++) {
    const fl = floraPool[i];
    const dist = fl.mesh.visible ? Math.hypot(fl.mesh.position.x - px, fl.mesh.position.z - pz) : 999;
    if (!fl.mesh.visible || dist > 21) {
      const ang = Math.random() * Math.PI * 2;
      const r = 3.5 + Math.random() * 14.5;
      const fx = Math.max(-72, Math.min(72, px + Math.cos(ang) * r));
      const fz = Math.max(-72, Math.min(72, pz + Math.sin(ang) * r));
      // Nasce apenas em grama ou terra natural (nunca em concreto, asfalto ou dentro dos prédios!)
      if (!isNaturalSoilSpot(fx, fz, 0.8)) continue;
      fl.mesh.position.set(fx, getGroundHeight(ctx.physCtx, fx, fz, 2), fz);
      fl.mesh.rotation.y = Math.random() * Math.PI * 2;
      fl.curScale = 0.02;
      fl.mesh.scale.setScalar(0.02);
      fl.mesh.visible = true;
    } else if (fl.curScale < fl.targetScale) {
      fl.curScale = Math.min(fl.targetScale, fl.curScale + dt * 2.2);
      fl.mesh.scale.setScalar(fl.curScale);
    }
    fl.phase += dt * 1.8;
    fl.mesh.rotation.z = Math.sin(fl.phase) * 0.04;
  }
}

function isInsideRoofZone(ctx, x, z, margin = 2.0) {
  const zones = ctx && ctx.roofZones;
  if (!zones || !zones.length) return false;
  for (let i = 0; i < zones.length; i++) {
    const zb = zones[i];
    if (x >= zb.minX - margin && x <= zb.maxX + margin && z >= zb.minZ - margin && z <= zb.maxZ + margin) {
      return true;
    }
  }
  return false;
}

function isOutdoorFireflySpot(ctx, x, z, margin = 3.5) {
  return isNaturalSoilSpot(x, z, margin) && !isInsideRoofZone(ctx, x, z, margin);
}

function pickForestFireflySpot(ctx) {
  for (let tries = 0; tries < 28; tries++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 52 + Math.random() * 44;
    const fx = Math.cos(ang) * rad;
    const fz = Math.sin(ang) * rad;
    if (isOutdoorFireflySpot(ctx, fx, fz, 5.5)) {
      const fy = terrainHeight(fx, fz) + 0.8 + Math.random() * 2.4;
      return { x: fx, y: fy, z: fz };
    }
  }
  const fx = -74 + (Math.random() - 0.5) * 18;
  const fz = -58 + (Math.random() - 0.5) * 18;
  return { x: fx, y: terrainHeight(fx, fz) + 1.2 + Math.random() * 1.8, z: fz };
}

function stepFireflies(ctx, dt, show, isDark, inTrip) {
  if (!show && !isDark) {
    if (fireflyPoints) fireflyPoints.visible = false;
    return;
  }
  const px = ctx.playerPos.x;
  const py = ctx.playerPos.y;
  const pz = ctx.playerPos.z;
  const count = 32;
  const nightForestOnly = !inTrip && !isDark;
  const activeCount = nightForestOnly ? 14 : count;
  if (!fireflyPoints) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    fireflyData = [];
    for (let i = 0; i < count; i++) {
      const spot = pickForestFireflySpot(ctx);
      pos[i * 3] = spot.x;
      pos[i * 3 + 1] = spot.y;
      pos[i * 3 + 2] = spot.z;
      fireflyData.push({
        baseX: spot.x,
        baseY: spot.y,
        baseZ: spot.z,
        phase: Math.random() * 6.28,
        speed: 0.6 + Math.random() * 0.9,
        hue: i / count
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    fireflyPoints = new THREE.Points(geo, mat);
    fireflyPoints.frustumCulled = false;
    ctx.scene.add(fireflyPoints);
  }
  const playerIndoors = isInsideRoofZone(ctx, px, pz, 0.5);
  fireflyPoints.visible = !playerIndoors;
  if (!fireflyPoints.visible) return;
  fireflyPoints.geometry.setDrawRange(0, activeCount);
  const posAttr = fireflyPoints.geometry.getAttribute('position');
  const colAttr = fireflyPoints.geometry.getAttribute('color');
  const tmpC = _tmpFireflyColor || new THREE.Color();
  for (let i = 0; i < activeCount; i++) {
    const d = fireflyData[i];
    d.phase += dt * d.speed;
    let x = posAttr.getX(i) + Math.cos(d.phase) * dt * 0.48;
    let y = posAttr.getY(i) + Math.sin(d.phase * 1.4) * dt * 0.32;
    let z = posAttr.getZ(i) + Math.sin(d.phase * 0.8) * dt * 0.48;
    if (nightForestOnly) {
      if (Math.hypot(x - d.baseX, z - d.baseZ) > 9 || !isOutdoorFireflySpot(ctx, x, z, 3.5)) {
        const spot = pickForestFireflySpot(ctx);
        d.baseX = spot.x;
        d.baseY = spot.y;
        d.baseZ = spot.z;
        x = spot.x;
        y = spot.y;
        z = spot.z;
      }
      tmpC.setHSL(0.24 + Math.sin(d.phase * 0.5) * 0.04, 0.88, 0.62);
    } else {
      if (Math.hypot(x - px, z - pz) > 18 || y < py - 1 || y > py + 5.5 || !isOutdoorFireflySpot(ctx, x, z, 2.5)) {
        let placed = false;
        for (let t = 0; t < 10; t++) {
          const a = Math.random() * Math.PI * 2;
          const r = 4 + Math.random() * 13;
          const cx = px + Math.cos(a) * r;
          const cz = pz + Math.sin(a) * r;
          if (isOutdoorFireflySpot(ctx, cx, cz, 2.5)) {
            x = cx;
            y = terrainHeight(cx, cz) + 0.8 + Math.random() * 2.4;
            z = cz;
            placed = true;
            break;
          }
        }
        if (!placed) {
          const spot = pickForestFireflySpot(ctx);
          x = spot.x;
          y = spot.y;
          z = spot.z;
        }
      }
      if (isDark) {
        tmpC.setHSL(i % 2 === 0 ? 0.98 : 0.78, 0.9, 0.52);
      } else {
        tmpC.setHSL((d.hue + d.phase * 0.04) % 1, 0.95, 0.65);
      }
    }
    posAttr.setXYZ(i, x, y, z);
    colAttr.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
}

function stepGiantTrampolines(ctx, dt, show) {
  if (!show) {
    if (trampolinePool) {
      for (let i = 0; i < trampolinePool.length; i++) trampolinePool[i].mesh.visible = false;
    }
    return;
  }
  const px = ctx.playerPos.x;
  const pz = ctx.playerPos.z;
  if (!trampolinePool) {
    trampolinePool = [];
    const baseGeo = new THREE.CylinderGeometry(1.13, 0.95, 0.23, 10);
    const padGeo = new THREE.CylinderGeometry(0.89, 1.03, 0.18, 10);
    const markGeo = new THREE.CylinderGeometry(0.47, 0.47, 0.02, 5);
    const padColors = [0xe98e75, 0x9591e5];
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x37505b });
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffe2a4 });
    for (let i = 0; i < 2; i++) {
      const grp = new THREE.Group();
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.115;
      const pad = new THREE.Mesh(padGeo, new THREE.MeshLambertMaterial({ color: padColors[i], emissive: padColors[i], emissiveIntensity: 0.12 }));
      pad.position.y = 0.29;
      const mark = new THREE.Mesh(markGeo, markMat);
      mark.position.y = 0.39;
      grp.add(base, pad, mark);
      grp.visible = false;
      ctx.scene.add(grp);
      trampolinePool.push({ mesh: grp, bounceCooldown: 0, squish: 0 });
    }
  }

  for (let i = 0; i < trampolinePool.length; i++) {
    const tr = trampolinePool[i];
    if (tr.bounceCooldown > 0) tr.bounceCooldown -= dt;
    if (tr.squish > 0) tr.squish = Math.max(0, tr.squish - dt * 3.5);
    const dist = tr.mesh.visible ? Math.hypot(tr.mesh.position.x - px, tr.mesh.position.z - pz) : 999;
    if (!tr.mesh.visible || dist > 38) {
      const a = (i * Math.PI) + Math.random() * 1.4;
      const r = 10 + Math.random() * 12;
      const tx = Math.max(-70, Math.min(70, px + Math.cos(a) * r));
      const tz = Math.max(-70, Math.min(70, pz + Math.sin(a) * r));
      if (Math.abs(tx) < 13 && Math.abs(tz) < 13) continue;
      tr.mesh.position.set(tx, getGroundHeight(ctx.physCtx, tx, tz, 2), tz);
      tr.mesh.visible = true;
    }
    const sy = 1 - Math.sin(tr.squish * Math.PI) * 0.35;
    tr.mesh.scale.set(1 + (1 - sy) * 0.3, sy, 1 + (1 - sy) * 0.3);

    const dXZ = Math.hypot(tr.mesh.position.x - px, tr.mesh.position.z - pz);
    const dY = Math.abs(ctx.playerPos.y - (tr.mesh.position.y + 1.1));
    if (tr.bounceCooldown <= 0 && dXZ < 1.55 && dY < 1.35) {
      ctx.playerVelY = 15.2;
      ctx.onGround = false;
      tr.bounceCooldown = 0.8;
      tr.squish = 1;
      if (window.MycoAudio && window.MycoAudio.playBoing) window.MycoAudio.playBoing();
    }
  }
}

function getSharedGeos() {
  if (sharedGeos) return sharedGeos;
  sharedGeos = {
    boot: new THREE.BoxGeometry(0.11, 0.08, 0.16),
    leg: new THREE.CylinderGeometry(0.045, 0.04, 0.16, 8),
    tunic: new THREE.CylinderGeometry(0.14, 0.18, 0.28, 12),
    belt: new THREE.CylinderGeometry(0.155, 0.155, 0.045, 12),
    buckle: new THREE.BoxGeometry(0.06, 0.055, 0.03),
    arm: new THREE.CylinderGeometry(0.036, 0.032, 0.18, 8),
    hand: new THREE.SphereGeometry(0.04, 8, 8),
    head: new THREE.SphereGeometry(0.13, 12, 10),
    nose: new THREE.SphereGeometry(0.042, 8, 8),
    beard: new THREE.ConeGeometry(0.125, 0.22, 10),
    stache: new THREE.BoxGeometry(0.15, 0.036, 0.05),
    eye: new THREE.SphereGeometry(0.018, 6, 6),
    hat: new THREE.ConeGeometry(0.145, 0.34, 12)
  };
  return sharedGeos;
}

function createSingleGnome(tunicColor, isShadow = false) {
  const geo = getSharedGeos();
  const root = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: isShadow ? 0x334155 : 0xf6c39b });
  const redHatMat = new THREE.MeshLambertMaterial({ color: isShadow ? 0x09090b : 0xdc2626 });
  const whiteMat = new THREE.MeshLambertMaterial({ color: isShadow ? 0x1e293b : 0xf8fafc });
  const tunicMat = new THREE.MeshLambertMaterial({ color: isShadow ? 0x050507 : tunicColor });
  const brownMat = new THREE.MeshLambertMaterial({ color: isShadow ? 0x09090b : 0x5c3a21 });
  const goldMat = new THREE.MeshBasicMaterial({ color: isShadow ? 0xef4444 : 0xfacc15 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: isShadow ? 0xf87171 : 0x0f172a });

  const legL = new THREE.Group();
  const lLegMesh = new THREE.Mesh(geo.leg, brownMat);
  lLegMesh.position.y = 0.08;
  const lBoot = new THREE.Mesh(geo.boot, brownMat);
  lBoot.position.set(0, 0.04, 0.025);
  legL.add(lLegMesh, lBoot);
  legL.position.set(-0.07, 0, 0);

  const legR = new THREE.Group();
  const rLegMesh = new THREE.Mesh(geo.leg, brownMat);
  rLegMesh.position.y = 0.08;
  const rBoot = new THREE.Mesh(geo.boot, brownMat);
  rBoot.position.set(0, 0.04, 0.025);
  legR.add(rLegMesh, rBoot);
  legR.position.set(0.07, 0, 0);

  const body = new THREE.Mesh(geo.tunic, tunicMat);
  body.position.y = 0.29;
  const belt = new THREE.Mesh(geo.belt, brownMat);
  belt.position.y = 0.23;
  const buckle = new THREE.Mesh(geo.buckle, goldMat);
  buckle.position.set(0, 0.23, 0.15);

  const armL = new THREE.Group();
  const lArmMesh = new THREE.Mesh(geo.arm, tunicMat);
  lArmMesh.position.y = -0.07;
  const lHand = new THREE.Mesh(geo.hand, skinMat);
  lHand.position.y = -0.16;
  armL.add(lArmMesh, lHand);
  armL.position.set(-0.17, 0.39, 0);
  armL.rotation.z = 0.2;

  const armR = new THREE.Group();
  const rArmMesh = new THREE.Mesh(geo.arm, tunicMat);
  rArmMesh.position.y = -0.07;
  const rHand = new THREE.Mesh(geo.hand, skinMat);
  rHand.position.y = -0.16;
  armR.add(rArmMesh, rHand);
  armR.position.set(0.17, 0.39, 0);
  armR.rotation.z = -0.2;

  const headGrp = new THREE.Group();
  headGrp.position.set(0, 0.50, 0);
  const head = new THREE.Mesh(geo.head, skinMat);
  const nose = new THREE.Mesh(geo.nose, new THREE.MeshLambertMaterial({ color: isShadow ? 0x1e293b : 0xf47272 }));
  nose.position.set(0, -0.01, 0.13);
  const beard = new THREE.Mesh(geo.beard, whiteMat);
  beard.rotation.x = Math.PI;
  beard.position.set(0, -0.12, 0.05);
  const stache = new THREE.Mesh(geo.stache, whiteMat);
  stache.position.set(0, -0.045, 0.115);
  const eyeL = new THREE.Mesh(geo.eye, eyeMat);
  eyeL.position.set(-0.045, 0.03, 0.115);
  if (isShadow) eyeL.scale.setScalar(1.65);
  const eyeR = new THREE.Mesh(geo.eye, eyeMat);
  eyeR.position.set(0.045, 0.03, 0.115);
  if (isShadow) eyeR.scale.setScalar(1.65);
  const hat = new THREE.Mesh(geo.hat, redHatMat);
  hat.position.set(0, 0.24, -0.01);
  hat.rotation.x = -0.06;
  headGrp.add(head, nose, beard, stache, eyeL, eyeR, hat);

  const emoteSprite = makeTextSprite('😊', '#fde047');
  emoteSprite.position.set(0, 0.98, 0);
  emoteSprite.scale.set(0.55, 0.22, 1);

  root.add(legL, legR, body, belt, buckle, armL, armR, headGrp, emoteSprite);
  root.scale.setScalar(1.05);
  root.visible = false;

  return {
    root, legL, legR, armL, armR, headGrp, emoteSprite,
    state: 'wander',
    targetX: 0,
    targetZ: 0,
    timer: 0,
    phase: Math.random() * Math.PI * 2,
    currentEmote: '😊'
  };
}

function setGnomeEmote(gn, emoji) {
  if (gn.currentEmote === emoji) return;
  gn.currentEmote = emoji;
  updateTextSprite(gn.emoteSprite, emoji, '#fde047');
}

function pickRoamTarget(gn, px, pz, minR, maxR) {
  const ang = Math.random() * Math.PI * 2;
  const dist = minR + Math.random() * (maxR - minR);
  gn.targetX = Math.max(-72, Math.min(72, px + Math.cos(ang) * dist));
  gn.targetZ = Math.max(-72, Math.min(72, pz + Math.sin(ang) * dist));
}

let savedUmbralEnv = null;

function applyUmbralAtmosphere(ctx, active) {
  const scene = ctx && ctx.scene;
  if (!scene) return;
  if (active) {
    if (!savedUmbralEnv) {
      savedUmbralEnv = {
        bg: scene.background ? scene.background.clone() : null,
        fogColor: scene.fog && scene.fog.color ? scene.fog.color.clone() : null,
        fogDensity: (scene.fog && scene.fog.isFogExp2) ? scene.fog.density : null,
        fogNear: (scene.fog && !scene.fog.isFogExp2) ? scene.fog.near : null,
        fogFar: (scene.fog && !scene.fog.isFogExp2) ? scene.fog.far : null,
        sunInt: ctx.envSun ? ctx.envSun.intensity : null,
        hemiInt: ctx.envHemi ? ctx.envHemi.intensity : null
      };
    }
    if (scene.background && scene.background.setHex) scene.background.setHex(0x030107);
    if (scene.fog) {
      if (scene.fog.color) scene.fog.color.setHex(0x06020c);
      if (scene.fog.isFogExp2) {
        scene.fog.density = 0.085;
      } else {
        scene.fog.near = 2.5;
        scene.fog.far = 25;
      }
    }
    if (ctx.envSun) ctx.envSun.intensity = 0.24;
    if (ctx.envHemi) ctx.envHemi.intensity = 0.28;
  } else if (savedUmbralEnv) {
    if (savedUmbralEnv.bg && scene.background) scene.background.copy(savedUmbralEnv.bg);
    if (scene.fog) {
      if (savedUmbralEnv.fogColor && scene.fog.color) scene.fog.color.copy(savedUmbralEnv.fogColor);
      if (scene.fog.isFogExp2 && savedUmbralEnv.fogDensity !== null) {
        scene.fog.density = savedUmbralEnv.fogDensity;
      } else {
        if (savedUmbralEnv.fogNear !== null) scene.fog.near = savedUmbralEnv.fogNear;
        if (savedUmbralEnv.fogFar !== null) scene.fog.far = savedUmbralEnv.fogFar;
      }
    }
    if (ctx.envSun && savedUmbralEnv.sunInt !== null) ctx.envSun.intensity = savedUmbralEnv.sunInt;
    if (ctx.envHemi && savedUmbralEnv.hemiInt !== null) ctx.envHemi.intensity = savedUmbralEnv.hemiInt;
    savedUmbralEnv = null;
  }
}

export function stepTripGnomes(ctx, dt) {
  stepTripTextureFlow(ctx.scene, dt);
  const freakout = typeof window !== 'undefined' && window.isTripFreakoutActive && window.isTripFreakoutActive();
  const active = typeof window !== 'undefined' && window.isTripRainbowActive && window.isTripRainbowActive();
  const nightFireflies = Math.sin((getVirtualDayFrac() - 0.25) * Math.PI * 2) < -0.08;
  applyUmbralAtmosphere(ctx, freakout);
  stepEnchantedFlora(ctx, dt, active && !freakout);
  stepFireflies(ctx, dt, (active && !freakout) || nightFireflies, freakout, active);
  stepGiantTrampolines(ctx, dt, active && !freakout);

  if (!freakout && shadowGnomePool) {
    for (let i = 0; i < shadowGnomePool.length; i++) shadowGnomePool[i].root.visible = false;
  }

  if (freakout) {
    if (gnomePool) {
      for (let i = 0; i < gnomePool.length; i++) gnomePool[i].root.visible = false;
    }
    const px = ctx.playerPos.x;
    const pz = ctx.playerPos.z;
    const fwdX = -Math.sin(ctx.playerYaw || 0);
    const fwdZ = -Math.cos(ctx.playerYaw || 0);

    if (!shadowGnomePool) {
      shadowGnomePool = Array.from({ length: 7 }, () => {
        const gn = createSingleGnome(0x050507, true);
        gn.respawnTimer = 0;
        gn.gazeDecided = false;
        ctx.scene.add(gn.root);
        return gn;
      });
    }

    for (let i = 0; i < shadowGnomePool.length; i++) {
      const gn = shadowGnomePool[i];
      if (!gn.root.visible) {
        gn.respawnTimer -= dt;
        if (gn.respawnTimer > 0) continue;
        // Nasce fora do centro direto do olhar ou ao redor na escuridão
        const backAng = Math.atan2(-fwdZ, -fwdX) + (Math.random() - 0.5) * 2.5;
        const dist = 9 + Math.random() * 11;
        const sx = Math.max(-72, Math.min(72, px + Math.cos(backAng) * dist));
        const sz = Math.max(-72, Math.min(72, pz + Math.sin(backAng) * dist));
        gn.root.position.set(sx, getGroundHeight(ctx.physCtx, sx, sz, 2), sz);
        pickRoamTarget(gn, px, pz, 6, 18);
        gn.state = 'sprint';
        gn.timer = 1.6 + Math.random() * 2.2;
        gn.gazeDecided = false;
        setGnomeEmote(gn, FEAR_EMOTES[i % FEAR_EMOTES.length]);
        gn.root.visible = true;
      }

      const gx = gn.root.position.x;
      const gz = gn.root.position.z;
      const toGnomeX = gx - px;
      const toGnomeZ = gz - pz;
      const distP = Math.hypot(toGnomeX, toGnomeZ) || 1;
      const dot = (fwdX * (toGnomeX / distP)) + (fwdZ * (toGnomeZ / distP));

      // Se o jogador olhar direto para o gnomo preto, na maioria das vezes ele some na hora; às vezes fica encarando
      if (dot > 0.87 && distP < 24) {
        if (!gn.gazeDecided) {
          gn.gazeDecided = true;
          if (Math.random() < 0.72) {
            gn.root.visible = false;
            gn.respawnTimer = 0.6 + Math.random() * 1.4;
            if (window.MycoAudio && window.MycoAudio.playUmbralWhisper) window.MycoAudio.playUmbralWhisper();
            continue;
          } else {
            gn.state = 'stare';
            gn.timer = 1.6;
            setGnomeEmote(gn, '😱');
          }
        }
      } else {
        gn.gazeDecided = false;
      }

      gn.timer -= dt;
      let speed = 0;
      if (gn.state === 'stare') {
        const lookYaw = Math.atan2(px - gx, pz - gz);
        gn.root.rotation.y += Math.atan2(Math.sin(lookYaw - gn.root.rotation.y), Math.cos(lookYaw - gn.root.rotation.y)) * Math.min(1, dt * 10);
        if (gn.timer <= 0) {
          gn.state = 'sprint';
          gn.timer = 2.0 + Math.random() * 2.0;
          const awayAng = Math.atan2(gz - pz, gx - px) + (Math.random() - 0.5) * 1.2;
          gn.targetX = Math.max(-72, Math.min(72, gx + Math.cos(awayAng) * 16));
          gn.targetZ = Math.max(-72, Math.min(72, gz + Math.sin(awayAng) * 16));
          setGnomeEmote(gn, FEAR_EMOTES[Math.floor(Math.random() * FEAR_EMOTES.length)]);
        }
      } else {
        speed = 9.2;
        if (Math.hypot(gn.targetX - gx, gn.targetZ - gz) < 1.1 || gn.timer <= 0) {
          pickRoamTarget(gn, px, pz, 7, 19);
          gn.timer = 1.4 + Math.random() * 1.8;
          setGnomeEmote(gn, FEAR_EMOTES[Math.floor(Math.random() * FEAR_EMOTES.length)]);
        }
      }

      if (speed > 0) {
        const tx = gn.targetX - gx;
        const tz = gn.targetZ - gz;
        const tLen = Math.hypot(tx, tz) || 1;
        const step = Math.min(tLen, speed * dt);
        const nx = gx + (tx / tLen) * step;
        const nz = gz + (tz / tLen) * step;
        gn.root.position.set(nx, getGroundHeight(ctx.physCtx, nx, nz, gn.root.position.y + 0.5), nz);
        const moveYaw = Math.atan2(tx, tz);
        gn.root.rotation.y += Math.atan2(Math.sin(moveYaw - gn.root.rotation.y), Math.cos(moveYaw - gn.root.rotation.y)) * Math.min(1, dt * 12);
        gn.phase += dt * 26;
        const sw = Math.sin(gn.phase) * 0.85;
        gn.legL.rotation.x = sw;
        gn.legR.rotation.x = -sw;
        gn.armL.rotation.x = -sw * 0.85;
        gn.armR.rotation.x = sw * 0.85;
        gn.root.position.y += Math.abs(Math.sin(gn.phase)) * 0.06;
      }
    }
    return;
  }

  const gnomesActive = typeof window !== 'undefined' && window.isTripGnomesActive
    ? window.isTripGnomesActive()
    : false;
  if (!gnomesActive) {
    if (gnomePool) {
      for (let i = 0; i < gnomePool.length; i++) gnomePool[i].root.visible = false;
    }
    return;
  }

  const px = ctx.playerPos.x;
  const pz = ctx.playerPos.z;

  if (!gnomePool) {
    gnomePool = TUNIC_COLORS.map((col) => {
      const gn = createSingleGnome(col);
      ctx.scene.add(gn.root);
      return gn;
    });
  }

  for (let i = 0; i < gnomePool.length; i++) {
    const gn = gnomePool[i];
    if (!gn.root.visible) {
      pickRoamTarget(gn, px, pz, 11, 20);
      const gy = getGroundHeight(ctx.physCtx, gn.targetX, gn.targetZ, 2);
      gn.root.position.set(gn.targetX, gy, gn.targetZ);
      gn.root.scale.setScalar(1.05);
      gn.shrinkTimer = 0;
      gn.state = i % 2 === 0 ? 'wander' : 'happy';
      gn.timer = 1.8 + Math.random() * 2.5;
      setGnomeEmote(gn, CALM_EMOTES[i % CALM_EMOTES.length]);
      gn.root.visible = true;
    }

    const gx = gn.root.position.x;
    const gz = gn.root.position.z;
    const dxP = px - gx;
    const dzP = pz - gz;
    const distToPlayer = Math.hypot(dxP, dzP);

    // Se o jogador pegar / chegar muito perto (< 3.4m): encolhe correndo até sumir e reaparece longe!
    if (distToPlayer < 3.4 && gn.state !== 'shrink_flee') {
      gn.state = 'shrink_flee';
      gn.timer = 1.35;
      gn.shrinkTimer = 1.35;
      setGnomeEmote(gn, '😳');
      if (window.MycoAudio && window.MycoAudio.playGnomeGiggle) window.MycoAudio.playGnomeGiggle();
      const awayAng = Math.atan2(-dzP, -dxP) + (Math.random() - 0.5) * 0.6;
      gn.targetX = Math.max(-72, Math.min(72, gx + Math.cos(awayAng) * 16));
      gn.targetZ = Math.max(-72, Math.min(72, gz + Math.sin(awayAng) * 16));
    } else if (distToPlayer < 6.5 && gn.state !== 'flee' && gn.state !== 'shrink_flee') {
      gn.state = 'flee';
      gn.timer = 2.4;
      setGnomeEmote(gn, '💨');
      const awayAng = Math.atan2(-dzP, -dxP) + (Math.random() - 0.5) * 0.7;
      gn.targetX = Math.max(-72, Math.min(72, gx + Math.cos(awayAng) * 15));
      gn.targetZ = Math.max(-72, Math.min(72, gz + Math.sin(awayAng) * 15));
    } else if (distToPlayer > 34) {
      pickRoamTarget(gn, px, pz, 12, 22);
      gn.root.position.set(gn.targetX, getGroundHeight(ctx.physCtx, gn.targetX, gn.targetZ, 2), gn.targetZ);
      gn.root.scale.setScalar(1.05);
    }

    gn.timer -= dt;
    let speed = 0;

    if (gn.state === 'shrink_flee') {
      speed = 9.5;
      const s = Math.max(0.04, (gn.timer / 1.35) * 1.05);
      gn.root.scale.setScalar(s);
      if (gn.timer <= 0) {
        pickRoamTarget(gn, px, pz, 14, 23);
        gn.root.position.set(gn.targetX, getGroundHeight(ctx.physCtx, gn.targetX, gn.targetZ, 2), gn.targetZ);
        gn.root.scale.setScalar(1.05);
        gn.state = 'happy';
        gn.timer = 2.5;
        setGnomeEmote(gn, '😊');
      }
    } else if (gn.state === 'flee') {
      speed = 7.6;
      if (gn.timer <= 0 && distToPlayer > 11.5) {
        gn.state = 'serious';
        gn.timer = 2.2 + Math.random() * 2.0;
        setGnomeEmote(gn, '🧐');
      } else if (gn.timer <= 0) {
        const awayAng = Math.atan2(-dzP, -dxP);
        gn.targetX = Math.max(-72, Math.min(72, gx + Math.cos(awayAng) * 13));
        gn.targetZ = Math.max(-72, Math.min(72, gz + Math.sin(awayAng) * 13));
        gn.timer = 1.4;
      }
    } else if (gn.state === 'happy' || gn.state === 'serious' || gn.state === 'thoughtful') {
      const lookYaw = Math.atan2(dxP, dzP);
      gn.root.rotation.y += Math.atan2(Math.sin(lookYaw - gn.root.rotation.y), Math.cos(lookYaw - gn.root.rotation.y)) * Math.min(1, dt * 6);
      if (gn.state === 'happy') {
        gn.headGrp.rotation.z = Math.sin(gn.phase * 2.2) * 0.12;
        gn.root.position.y = getGroundHeight(ctx.physCtx, gx, gz, gn.root.position.y + 0.3) + Math.abs(Math.sin(gn.phase * 2.4)) * 0.09;
      } else if (gn.state === 'thoughtful') {
        gn.headGrp.rotation.z = 0.22;
        gn.headGrp.rotation.x = -0.18;
      } else {
        gn.headGrp.rotation.z = 0;
        gn.headGrp.rotation.x = 0;
      }
      if (gn.timer <= 0) {
        const roll = Math.random();
        gn.state = roll < 0.35 ? 'freak' : (roll < 0.72 ? 'run' : 'wander');
        gn.timer = 2.4 + Math.random() * 3.0;
        pickRoamTarget(gn, px, pz, 8, 21);
        setGnomeEmote(gn, gn.state === 'freak' ? '🤪' : CALM_EMOTES[Math.floor(Math.random() * CALM_EMOTES.length)]);
      }
    } else {
      speed = gn.state === 'freak' ? 7.8 : (gn.state === 'run' ? 5.6 : 2.6);
      if (gn.state === 'freak') {
        gn.headGrp.rotation.z = Math.sin(gn.phase * 3.0) * 0.25;
      }
      const toTgtX = gn.targetX - gx;
      const toTgtZ = gn.targetZ - gz;
      if (Math.hypot(toTgtX, toTgtZ) < 0.85 || gn.timer <= 0) {
        const moods = [
          { s: 'happy', e: '😊' },
          { s: 'serious', e: '😐' },
          { s: 'thoughtful', e: '🤔' }
        ];
        const pick = moods[Math.floor(Math.random() * moods.length)];
        gn.state = pick.s;
        gn.timer = 2.2 + Math.random() * 2.6;
        setGnomeEmote(gn, pick.e);
      }
    }

    if (speed > 0) {
      const tx = gn.targetX - gx;
      const tz = gn.targetZ - gz;
      const tLen = Math.hypot(tx, tz) || 1;
      const step = Math.min(tLen, speed * dt);
      const nx = gx + (tx / tLen) * step;
      const nz = gz + (tz / tLen) * step;
      const ny = getGroundHeight(ctx.physCtx, nx, nz, gn.root.position.y + 0.5);
      gn.root.position.set(nx, ny, nz);
      const moveYaw = Math.atan2(tx, tz);
      gn.root.rotation.y += Math.atan2(Math.sin(moveYaw - gn.root.rotation.y), Math.cos(moveYaw - gn.root.rotation.y)) * Math.min(1, dt * 8);

      gn.phase += dt * (speed * 3.2);
      const sw = Math.sin(gn.phase) * 0.65;
      gn.legL.rotation.x = sw;
      gn.legR.rotation.x = -sw;
      gn.armL.rotation.x = -sw * 0.7;
      gn.armR.rotation.x = sw * 0.7;
      gn.root.position.y += Math.abs(Math.sin(gn.phase)) * 0.045;
    } else {
      gn.phase += dt * 2.5;
      gn.legL.rotation.x *= Math.exp(-10 * dt);
      gn.legR.rotation.x *= Math.exp(-10 * dt);
      gn.armL.rotation.x *= Math.exp(-10 * dt);
      gn.armR.rotation.x *= Math.exp(-10 * dt);
    }
  }

  // Gnomo Solitário das Árvores (aparece longe da população e sobe na árvore ao se aproximar!)
  stepLonelyTreeGnome(ctx, dt, px, pz);
}

function stepLonelyTreeGnome(ctx, dt, px, pz) {
  if (!ctx || !ctx.scene) return;
  if (!lonelyTreeGnome) {
    const gn = createSingleGnome(0x15803d, false);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 4.2, 8), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
    trunk.position.y = 2.1;
    const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 1), new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 }));
    crown.position.y = 4.6;
    tree.add(trunk, crown);
    ctx.scene.add(tree);
    ctx.scene.add(gn.root);
    const spot = LONELY_TREE_SPOTS[0];
    const gy = getGroundHeight(ctx.physCtx, spot.x, spot.z, 2);
    tree.position.set(spot.x, gy, spot.z);
    gn.root.position.set(spot.x + 1.1, gy, spot.z + 0.8);
    setGnomeEmote(gn, '🌲');
    lonelyTreeGnome = { gn, tree, spotIdx: 0, phase: 'idle', timer: 0, treeX: spot.x, treeY: gy, treeZ: spot.z };
  }
  const L = lonelyTreeGnome;
  const gn = L.gn;
  if (L.phase === 'hidden') {
    L.timer -= dt;
    if (L.timer <= 0) {
      L.spotIdx = (L.spotIdx + 1) % LONELY_TREE_SPOTS.length;
      const spot = LONELY_TREE_SPOTS[L.spotIdx];
      const gy = getGroundHeight(ctx.physCtx, spot.x, spot.z, 2);
      L.treeX = spot.x; L.treeY = gy; L.treeZ = spot.z;
      L.tree.position.set(spot.x, gy, spot.z);
      gn.root.position.set(spot.x + 1.1, gy, spot.z + 0.8);
      gn.root.scale.setScalar(1);
      gn.root.visible = true;
      setGnomeEmote(gn, '🌲');
      L.phase = 'idle';
    }
    return;
  }
  const distToPlayer = Math.hypot(gn.root.position.x - px, gn.root.position.z - pz);
  if (L.phase === 'idle') {
    gn.root.rotation.y += dt * 0.4;
    if (distToPlayer < 7.0) {
      L.phase = 'run_to_tree';
      setGnomeEmote(gn, '😮');
    }
  } else if (L.phase === 'run_to_tree') {
    const dx = L.treeX - gn.root.position.x;
    const dz = L.treeZ - gn.root.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.45) {
      L.phase = 'climbing';
      L.timer = 0;
      setGnomeEmote(gn, '💨');
    } else {
      const step = Math.min(d, 5.5 * dt);
      gn.root.position.x += (dx / d) * step;
      gn.root.position.z += (dz / d) * step;
      gn.root.position.y = getGroundHeight(ctx.physCtx, gn.root.position.x, gn.root.position.z, L.treeY + 1);
      gn.root.rotation.y = Math.atan2(dx, dz);
      gn.phase += dt * 16;
      const sw = Math.sin(gn.phase) * 0.7;
      gn.legL.rotation.x = sw; gn.legR.rotation.x = -sw;
    }
  } else if (L.phase === 'climbing') {
    L.timer += dt;
    gn.root.position.y += dt * 3.4;
    gn.phase += dt * 20;
    gn.armL.rotation.x = -1.6 + Math.sin(gn.phase) * 0.5;
    gn.armR.rotation.x = -1.6 - Math.sin(gn.phase) * 0.5;
    if (gn.root.position.y >= L.treeY + 3.8) {
      const shrink = Math.max(0.05, 1 - (gn.root.position.y - (L.treeY + 3.8)) * 1.2);
      gn.root.scale.setScalar(shrink);
    }
    if (gn.root.position.y >= L.treeY + 4.7) {
      gn.root.visible = false;
      L.phase = 'hidden';
      L.timer = 18 + Math.random() * 14;
    }
  }
}
