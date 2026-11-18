/**
 * MycoCampus3D — Gnomos da Brisa (aparecem andando, correndo, observando e fugindo se chegar perto)
 */
import { getGroundHeight } from '../engine/physics.js';
import { makeTextSprite, updateTextSprite } from '../engine/textures.js';

const THREE = window.THREE;

const TUNIC_COLORS = [0x2563eb, 0x16a34a, 0x7c3aed, 0x0d9488, 0xd97706];
const CALM_EMOTES = ['😊', '🍄', '✨', '👀', '🌿'];

let gnomePool = null;
let sharedGeos = null;
let cachedFlowTextures = null;
let flowTime = 0;
let flowWasActive = false;

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

function createSingleGnome(tunicColor) {
  const geo = getSharedGeos();
  const root = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: 0xf6c39b });
  const redHatMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  const tunicMat = new THREE.MeshLambertMaterial({ color: tunicColor });
  const brownMat = new THREE.MeshLambertMaterial({ color: 0x5c3a21 });
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

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
  const nose = new THREE.Mesh(geo.nose, new THREE.MeshLambertMaterial({ color: 0xf47272 }));
  nose.position.set(0, -0.01, 0.13);
  const beard = new THREE.Mesh(geo.beard, whiteMat);
  beard.rotation.x = Math.PI;
  beard.position.set(0, -0.12, 0.05);
  const stache = new THREE.Mesh(geo.stache, whiteMat);
  stache.position.set(0, -0.045, 0.115);
  const eyeL = new THREE.Mesh(geo.eye, eyeMat);
  eyeL.position.set(-0.045, 0.03, 0.115);
  const eyeR = new THREE.Mesh(geo.eye, eyeMat);
  eyeR.position.set(0.045, 0.03, 0.115);
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

export function stepTripGnomes(ctx, dt) {
  stepTripTextureFlow(ctx.scene, dt);
  const active = typeof window !== 'undefined' && window.isTripRainbowActive && window.isTripRainbowActive();
  if (!active) {
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
      gn.state = i % 2 === 0 ? 'wander' : 'watch';
      gn.timer = 1.5 + Math.random() * 3.0;
      setGnomeEmote(gn, CALM_EMOTES[i % CALM_EMOTES.length]);
      gn.root.visible = true;
    }

    const gx = gn.root.position.x;
    const gz = gn.root.position.z;
    const dxP = px - gx;
    const dzP = pz - gz;
    const distToPlayer = Math.hypot(dxP, dzP);

    if (distToPlayer < 6.0 && gn.state !== 'flee') {
      gn.state = 'flee';
      gn.timer = 2.6;
      setGnomeEmote(gn, '😳');
      const awayAng = Math.atan2(-dzP, -dxP) + (Math.random() - 0.5) * 0.7;
      gn.targetX = Math.max(-72, Math.min(72, gx + Math.cos(awayAng) * 14));
      gn.targetZ = Math.max(-72, Math.min(72, gz + Math.sin(awayAng) * 14));
    } else if (distToPlayer > 34) {
      pickRoamTarget(gn, px, pz, 12, 22);
      gn.root.position.set(gn.targetX, getGroundHeight(ctx.physCtx, gn.targetX, gn.targetZ, 2), gn.targetZ);
    }

    gn.timer -= dt;
    let speed = 0;

    if (gn.state === 'flee') {
      speed = 5.4;
      if (gn.timer <= 0 && distToPlayer > 11.5) {
        gn.state = 'watch';
        gn.timer = 2.5 + Math.random() * 2.5;
        setGnomeEmote(gn, '👀');
      } else if (gn.timer <= 0) {
        const awayAng = Math.atan2(-dzP, -dxP);
        gn.targetX = Math.max(-72, Math.min(72, gx + Math.cos(awayAng) * 12));
        gn.targetZ = Math.max(-72, Math.min(72, gz + Math.sin(awayAng) * 12));
        gn.timer = 1.5;
      }
    } else if (gn.state === 'watch') {
      const lookYaw = Math.atan2(dxP, dzP);
      gn.root.rotation.y += Math.atan2(Math.sin(lookYaw - gn.root.rotation.y), Math.cos(lookYaw - gn.root.rotation.y)) * Math.min(1, dt * 6);
      gn.headGrp.rotation.z = Math.sin(gn.phase * 1.5) * 0.08;
      if (gn.timer <= 0) {
        gn.state = Math.random() < 0.35 ? 'run' : 'wander';
        gn.timer = 2.8 + Math.random() * 3.5;
        pickRoamTarget(gn, px, pz, 9, 21);
        setGnomeEmote(gn, CALM_EMOTES[Math.floor(Math.random() * CALM_EMOTES.length)]);
      }
    } else {
      speed = gn.state === 'run' ? 3.8 : 1.75;
      const toTgtX = gn.targetX - gx;
      const toTgtZ = gn.targetZ - gz;
      if (Math.hypot(toTgtX, toTgtZ) < 0.8 || gn.timer <= 0) {
        gn.state = 'watch';
        gn.timer = 2.4 + Math.random() * 3.0;
        setGnomeEmote(gn, Math.random() < 0.5 ? '😊' : '👀');
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
}
