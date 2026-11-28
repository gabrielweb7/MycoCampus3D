/**
 * MycoCampus3D — Disco Voador (Passagem Rara no Céu & Abdução de Vaquinha)
 */
import { getGroundHeight } from '../engine/physics.js';
import { findSafePasturePoint, PASTURE_TROUGH_POS } from '../entities/pasture-cows.js';

const THREE = window.THREE;

let ufoState = {
  mesh: null,
  beam: null,
  lights: [],
  phase: 'idle', // 'idle' | 'flyby' | 'approach' | 'beam' | 'depart'
  timer: 32,     // 1ª passagem após ~32s de jogo, depois a cada 75-120s
  t: 0,
  startX: -95,
  startZ: -60,
  endX: 95,
  endZ: 45,
  targetCow: null,
  cowStartY: 0,
  cowRespawnTimer: 0,
  respawnCow: null
};

function ensureUfoMesh(scene) {
  if (ufoState.mesh) return ufoState.mesh;
  const root = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.72, roughness: 0.28, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.35, flatShading: true });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0e7490, emissiveIntensity: 0.35, roughness: 0.14, metalness: 0.2, transparent: true, opacity: 0.62 });
  const alienMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

  // Casco superior e inferior facetados estilo low-poly metálico
  const saucerTop = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 2.7, 0.36, 12), hullMat);
  saucerTop.position.y = 0.14;
  root.add(saucerTop);

  const saucerRim = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.55, 0.14, 12), trimMat);
  saucerRim.position.y = -0.05;
  root.add(saucerRim);

  const saucerBottom = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 1.15, 0.34, 12), hullMat);
  saucerBottom.position.y = -0.26;
  root.add(saucerBottom);

  // Núcleo propulsor inferior brilhante
  const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 0.12, 10), cyanMat);
  thruster.position.y = -0.45;
  root.add(thruster);

  // Cúpula translúcida com piloto alienígena low-poly dentro
  const cockpitSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.16, 10), trimMat);
  cockpitSeat.position.y = 0.34;
  root.add(cockpitSeat);

  const alienHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), alienMat);
  alienHead.scale.set(0.95, 1.15, 0.9);
  alienHead.position.y = 0.72;
  root.add(alienHead);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), eyeMat);
    eye.scale.set(0.8, 1.25, 0.7);
    eye.position.set(side * 0.12, 0.74, 0.25);
    root.add(eye);
  }

  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.54), domeMat);
  dome.position.y = 0.28;
  root.add(dome);

  // Anel ciano brilhante na base da cúpula
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.075, 6, 16), cyanMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.34;
  root.add(ring);

  // 4 aletas estabilizadoras + 8 luzinhas amarelas na borda
  const finGeo = new THREE.BoxGeometry(0.55, 0.12, 0.22);
  for (let fi = 0; fi < 4; fi++) {
    const fa = (fi / 4) * Math.PI * 2 + Math.PI / 4;
    const fin = new THREE.Mesh(finGeo, trimMat);
    fin.position.set(Math.cos(fa) * 2.55, 0.05, Math.sin(fa) * 2.55);
    fin.rotation.y = -fa;
    fin.rotation.z = 0.25;
    root.add(fin);
  }

  const bulbGeo = new THREE.OctahedronGeometry(0.11, 0);
  ufoState.lights = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bulb = new THREE.Mesh(bulbGeo, yellowMat.clone());
    bulb.position.set(Math.cos(a) * 2.32, 0.08, Math.sin(a) * 2.32);
    root.add(bulb);
    ufoState.lights.push(bulb);
  }

  // Feixe de luz trator (cone invertido: topo na nave, base no chão)
  const beamGeo = new THREE.ConeGeometry(2.8, 12.5, 18, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -6.4;
  beam.visible = false;
  root.add(beam);

  root.visible = false;
  scene.add(root);
  ufoState.mesh = root;
  ufoState.beam = beam;
  return root;
}

function releaseCow(cow, ctx) {
  if (!cow) return;
  cow.abducted = false;
  cow.mesh.scale.setScalar(1);
  cow.mesh.rotation.set(0, cow.yaw || 0, 0);
  const safePt = findSafePasturePoint(ctx, Math.floor(Math.random() * 999), PASTURE_TROUGH_POS);
  const rx = safePt.x;
  const rz = safePt.z;
  const ry = ctx && ctx.physCtx ? getGroundHeight(ctx.physCtx, rx, rz, 2) : 0;
  cow.mesh.position.set(rx, ry, rz);
  cow.mesh.visible = true;
  cow.stuckTimer = 0;
  cow.avoidTimer = 0;
  cow.routeIdx = 1;
  cow.lastProgressX = rx;
  cow.lastProgressZ = rz;
}

/** Telemetria da nave para o radar da Estação Ecológica. */
export function getUfoTelemetry() {
  const pos = ufoState.mesh?.position;
  const active = ufoState.phase !== 'idle' && !!ufoState.mesh && ufoState.mesh.visible && !!pos;
  return {
    active,
    x: active ? Math.round(pos.x * 10) / 10 : 0,
    z: active ? Math.round(pos.z * 10) / 10 : 0,
    phase: active ? ufoState.phase : 'idle',
    abducting: active && (ufoState.phase === 'approach' || ufoState.phase === 'beam')
  };
}

export function stepUfoAbduction(ctx, dt) {
  if (!ctx || !ctx.scene) return;

  if (ufoState.respawnCow) {
    ufoState.cowRespawnTimer -= dt;
    if (ufoState.cowRespawnTimer <= 0) {
      releaseCow(ufoState.respawnCow, ctx);
      ufoState.respawnCow = null;
    }
  }

  if (ufoState.phase === 'idle') {
    ufoState.timer -= dt;
    if (ufoState.timer > 0) return;

    const ufo = ensureUfoMesh(ctx.scene);
    const cows = ctx.pastureCows || [];
    const availableCows = cows.filter((c) => !c.abducted);
    const doAbduct = availableCows.length > 0 && Math.random() < 0.55;

    ufo.visible = true;
    ufoState.beam.visible = false;
    ufoState.t = 0;
    ctx.callbacks?.onToast?.('🛸 Nave detectada! Veja a posição no radar da Estação Ecológica.');

    if (doAbduct) {
      const cow = availableCows[Math.floor(Math.random() * availableCows.length)];
      cow.abducted = true;
      cow.mood = 'Abduzida 🛸!';
      ufoState.targetCow = cow;
      ufoState.cowStartY = cow.mesh.position.y;
      ufoState.startX = cow.mesh.position.x - 55;
      ufoState.startZ = cow.mesh.position.z - 45;
      ufo.position.set(ufoState.startX, 32, ufoState.startZ);
      ufoState.phase = 'approach';
    } else {
      const ang = Math.random() * Math.PI * 2;
      ufoState.startX = Math.cos(ang) * 95;
      ufoState.startZ = Math.sin(ang) * 95;
      ufoState.endX = -ufoState.startX;
      ufoState.endZ = -ufoState.startZ;
      ufo.position.set(ufoState.startX, 28 + Math.random() * 8, ufoState.startZ);
      ufoState.phase = 'flyby';
    }
    return;
  }

  const ufo = ufoState.mesh;
  if (!ufo) return;
  ufoState.t += dt;

  // Girar nave e piscar luzinhas
  ufo.rotation.y += dt * 1.4;
  for (let i = 0; i < ufoState.lights.length; i++) {
    const pulse = (Math.sin(ufoState.t * 8 + i * 0.9) + 1) * 0.5;
    ufoState.lights[i].material.color.setHSL(0.14, 1, 0.45 + pulse * 0.35);
  }

  if (ufoState.phase === 'flyby') {
    const dur = 14;
    const p = Math.min(1, ufoState.t / dur);
    ufo.position.x = ufoState.startX + (ufoState.endX - ufoState.startX) * p;
    ufo.position.z = ufoState.startZ + (ufoState.endZ - ufoState.startZ) * p;
    ufo.position.y = 29 + Math.sin(p * Math.PI * 2) * 2.5;
    ufo.rotation.z = 0.14;
    if (p >= 1) {
      ufo.visible = false;
      ufoState.phase = 'idle';
      ufoState.timer = 75 + Math.random() * 45;
    }
  } else if (ufoState.phase === 'approach') {
    const cow = ufoState.targetCow;
    if (!cow) { ufoState.phase = 'depart'; ufoState.t = 0; return; }
    const dur = 5.5;
    const p = Math.min(1, ufoState.t / dur);
    const ease = 1 - Math.pow(1 - p, 2);
    const tx = cow.mesh.position.x;
    const tz = cow.mesh.position.z;
    const ty = ufoState.cowStartY + 11.5;
    ufo.position.x = ufoState.startX + (tx - ufoState.startX) * ease;
    ufo.position.z = ufoState.startZ + (tz - ufoState.startZ) * ease;
    ufo.position.y = 32 + (ty - 32) * ease;
    ufo.rotation.z = (1 - ease) * 0.22;
    if (p >= 1) {
      ufoState.phase = 'beam';
      ufoState.t = 0;
      ufoState.beam.visible = true;
      if (ctx.playerPos && Math.hypot(ctx.playerPos.x - tx, ctx.playerPos.z - tz) < 55) {
        if (window.MycoAudio && window.MycoAudio.playUfoBeam) window.MycoAudio.playUfoBeam();
      }
    }
  } else if (ufoState.phase === 'beam') {
    const cow = ufoState.targetCow;
    const dur = 5.2;
    const p = Math.min(1, ufoState.t / dur);
    ufo.rotation.z = Math.sin(ufoState.t * 3) * 0.04;
    ufoState.beam.material.opacity = 0.28 + Math.sin(ufoState.t * 10) * 0.1;

    if (cow) {
      cow.mesh.visible = true;
      cow.mesh.position.y = ufoState.cowStartY + p * 11.2;
      cow.mesh.rotation.y += dt * 3.5;
      cow.mesh.rotation.z = Math.sin(ufoState.t * 5) * 0.18;
      if (p > 0.72) {
        const shrink = Math.max(0.05, 1 - (p - 0.72) / 0.28);
        cow.mesh.scale.setScalar(shrink);
      }
    }
    if (p >= 1) {
      ufoState.beam.visible = false;
      if (cow) {
        cow.mesh.visible = false;
        ufoState.respawnCow = cow;
        ufoState.cowRespawnTimer = 10;
      }
      ufoState.targetCow = null;
      ufoState.phase = 'depart';
      ufoState.t = 0;
      ufoState.startX = ufo.position.x;
      ufoState.startZ = ufo.position.z;
    }
  } else if (ufoState.phase === 'depart') {
    const dur = 4.2;
    const p = Math.min(1, ufoState.t / dur);
    const ease = p * p;
    ufo.position.x = ufoState.startX + ease * 85;
    ufo.position.z = ufoState.startZ - ease * 60;
    ufo.position.y = 12 + ease * 55;
    ufo.rotation.z = -0.25 * p;
    if (p >= 1) {
      ufo.visible = false;
      ufoState.phase = 'idle';
      ufoState.timer = 85 + Math.random() * 50;
    }
  }
}
