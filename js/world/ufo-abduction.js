/**
 * MycoCampus3D — Disco Voador (Passagem Rara no Céu & Abdução de Vaquinha)
 */
import { getGroundHeight, terrainHeight } from '../engine/physics.js';
import { findSafePasturePoint, PASTURE_TROUGH_POS } from '../entities/pasture-cows.js';
import { registerShotTarget } from '../systems/shot-targets.js';
import { spawnCampusFxBurst } from '../engine/fx-burst.js';
import { makeUfoCrashFx } from './ufo-crash-fx.js';

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
const UFO_CRASH_HITS = 20;
const UFO_WRECK_SECONDS = 72;
const TARGETABLE_PHASES = new Set(['flyby', 'approach', 'beam', 'depart']);
const SHARED_FLIGHT_SECONDS = 36;
const SHARED_CRASH_SECONDS = 8.5;
const SHARED_RECOVERY_SECONDS = 6.5;

function ensureUfoMesh(ctx) {
  const scene = ctx.scene;
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
  registerShotTarget(ctx, root, {
    radius: 2.66, halfHeight: 0.73, centerY: 0.19,
    active: () => root.visible && TARGETABLE_PHASES.has(ufoState.phase),
    onHit: hitUfo
  });
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

function hitUfo(ctx, _source, point, direction) {
  spawnCampusFxBurst(ctx.scene, point, 0xfbbf24, 4);
  if (ctx.sharedUfo) return;
  if (++ufoState.hits < UFO_CRASH_HITS) return;
  const ufo = ufoState.mesh;
  ufoState.beam.visible = false;
  if (ufoState.targetCow) releaseCow(ufoState.targetCow, ctx);
  ufoState.targetCow = null;
  ufoState.phase = 'crashing';
  ufoState.t = 0;
  ufoState.crashFx ||= makeUfoCrashFx(ctx.scene);
  ufoState.crashYaw = Math.atan2(direction.x, direction.z) + 0.6;
  ufoState.crashVelY = 1.4;
  ufoState.crashStart.set(ufo.position.x, ufo.position.y, ufo.position.z);
}

function stepSharedUfo(ctx, dt) {
  const packet = ctx.sharedUfo;
  const now = packet.now + Math.max(0, performance.now() - packet.receivedAt);
  const elapsed = (now - packet.start) / 1000;
  const crashedFor = (now - packet.crash_at) / 1000;
  const plane = ufoState.mesh;
  const visible = packet.crash_at
    ? crashedFor < SHARED_CRASH_SECONDS + UFO_WRECK_SECONDS + SHARED_RECOVERY_SECONDS
    : elapsed < SHARED_FLIGHT_SECONDS;
  if (!visible) {
    if (ufoState.targetCow) releaseCow(ufoState.targetCow, ctx);
    ufoState.targetCow = null;
    ufoState.phase = 'idle';
    if (plane) {
      plane.visible = false;
      ufoState.crashFx?.step(plane.position, dt, false);
    }
    return;
  }
  const ufo = ensureUfoMesh(ctx);
  ufo.visible = true;
  ufoState.beam.visible = false;
  const side = packet.cycle % 2 ? 1 : -1;
  if (!packet.crash_at) {
    const time = THREE.MathUtils.clamp(elapsed, 0, SHARED_FLIGHT_SECONDS);
    if (packet.cycle % 3 === 0) {
      if (time < 11) {
        const approach = 1 - (1 - time / 11) ** 2;
        ufo.position.set(127 - 53 * approach, 30 - 18 * approach, -39 + 41 * approach);
        ufoState.phase = 'approach';
      } else if (time < 17) {
        ufo.position.set(74, 12, 2);
        const progress = (time - 11) / 6;
        ufoState.beam.visible = true;
        ufoState.beam.material.opacity = 0.32 + Math.sin(elapsed * 10) * 0.09;
        if (ufoState.phase !== 'beam') {
          let distance = 13;
          for (const cow of ctx.pastureCows || []) {
            const position = cow.mesh.position;
            const nearby = Math.hypot(position.x - 74, position.z - 2);
            if (!cow.abducted && nearby < distance) {
              distance = nearby;
              ufoState.targetCow = cow;
            }
          }
          if (ufoState.targetCow) {
            ufoState.targetCow.abducted = true;
            ufoState.cowStartY = ufoState.targetCow.mesh.position.y;
          }
        }
        if (ufoState.targetCow) {
          const cow = ufoState.targetCow;
          cow.mesh.position.y = THREE.MathUtils.lerp(ufoState.cowStartY, ufo.position.y, progress);
          cow.mesh.rotation.y += dt * 2.6;
          cow.mesh.scale.setScalar(Math.max(0.08, 1 - progress));
        }
        ufoState.phase = 'beam';
      } else {
        const depart = (time - 17) / 19;
        ufo.position.set(74 - 161 * depart, 12 + 19 * Math.sin(depart * Math.PI * 0.5), 2 + 47 * depart);
        if (ufoState.targetCow) releaseCow(ufoState.targetCow, ctx);
        ufoState.targetCow = null;
        ufoState.phase = 'depart';
      }
    } else {
      const progress = time / SHARED_FLIGHT_SECONDS;
      const line = packet.cycle % 4 < 2 ? 35 : -35;
      ufo.position.set(side * (-94 + 188 * progress), 25 + 2.4 * Math.sin(progress * Math.PI * 2),
        line + Math.sin(progress * Math.PI) * 18);
      ufoState.phase = 'flyby';
    }
    ufo.rotation.set(0.04, elapsed * 1.4, side * 0.12);
    ufoState.crashFx?.step(ufo.position, dt, false);
  } else {
    if (ufoState.targetCow) releaseCow(ufoState.targetCow, ctx);
    ufoState.targetCow = null;
    const [x, y, z] = packet.crash_pos;
    const landX = THREE.MathUtils.clamp(x + side * 48, -191, 191);
    const landZ = THREE.MathUtils.clamp(z + (packet.cycle % 4 < 2 ? -1 : 1) * 25, -191, 191);
    const terrain = terrainHeight(landX, landZ) - 0.24;
    if (crashedFor < SHARED_CRASH_SECONDS) {
      const progress = THREE.MathUtils.clamp(crashedFor / SHARED_CRASH_SECONDS, 0, 1);
      const sway = Math.sin(progress * Math.PI * 5) * Math.sin(progress * Math.PI);
      ufo.position.set(THREE.MathUtils.lerp(x, landX, progress) + sway * 3,
        THREE.MathUtils.lerp(y, terrain, progress ** 3) + sway * 1.3,
        THREE.MathUtils.lerp(z, landZ, progress) + sway * 5);
      ufo.rotation.set(0.19 * progress + Math.sin(progress * 24) * 0.52 * (1 - progress),
        progress * 26, 0.27 * progress + Math.cos(progress * 21) * 0.56 * (1 - progress));
      ufoState.phase = 'crashing';
    } else if (crashedFor < SHARED_CRASH_SECONDS + UFO_WRECK_SECONDS) {
      ufo.position.set(landX, terrain, landZ);
      ufo.rotation.set(0.19, 26, 0.27);
      ufoState.phase = 'wrecked';
    } else {
      const lift = crashedFor - SHARED_CRASH_SECONDS - UFO_WRECK_SECONDS;
      const distance = Math.max(0, lift - 1.1) ** 2;
      ufo.position.set(landX + side * distance * 2.6, terrain + lift * 1.5 + distance * 2.4, landZ + distance * 1.4);
      ufo.rotation.set(Math.sin(lift * 4) * 0.16, 26 + lift * 1.8, Math.cos(lift * 3) * 0.19);
      ufoState.phase = 'recovering';
    }
    ufoState.crashFx ||= makeUfoCrashFx(ctx.scene);
    ufoState.crashFx.step(ufo.position, dt, true);
  }
  for (let i = 0; i < ufoState.lights.length; i++) {
    const pulse = (Math.sin(elapsed * 8 + i * 0.9) + 1) * 0.5;
    ufoState.lights[i].material.color.setHSL(packet.crash_at ? 0.028 : 0.14, 1, 0.44 + pulse * 0.35);
  }
}

function stepDamagedUfo(dt) {
  const ufo = ufoState.mesh;
  const time = ufoState.t;
  const yaw = ufoState.crashYaw;
  if (ufoState.phase === 'crashing') {
    ufoState.crashVelY -= dt * 0.95;
    ufo.position.x = THREE.MathUtils.clamp(ufo.position.x + Math.sin(yaw + Math.sin(time * 2.6) * 0.82) * dt * 9, -192, 192);
    ufo.position.z = THREE.MathUtils.clamp(ufo.position.z + Math.cos(yaw + Math.sin(time * 2.6) * 0.82) * dt * 9, -192, 192);
    ufo.position.y += ufoState.crashVelY * dt;
    ufo.rotation.set(Math.sin(time * 3) * 0.5, ufo.rotation.y + dt * 3.7, Math.cos(time * 2.7) * 0.62);
    const ground = terrainHeight(ufo.position.x, ufo.position.z);
    if (ufo.position.y <= ground) {
      ufo.position.y = ground - 0.24;
      ufo.rotation.set(0.19, ufo.rotation.y, 0.27);
      ufoState.phase = 'wrecked';
      ufoState.t = 0;
    }
  } else if (ufoState.phase === 'wrecked' && time >= UFO_WRECK_SECONDS) {
    ufoState.phase = 'recovering';
    ufoState.t = 0;
    ufoState.crashStart.copy(ufo.position);
  } else if (ufoState.phase === 'recovering') {
    const speedUp = Math.max(0, time - 1.1) ** 2;
    ufo.position.set(ufoState.crashStart.x + Math.sin(yaw) * speedUp * 3,
      ufoState.crashStart.y + time * 1.9 + speedUp * 1.75,
      ufoState.crashStart.z + Math.cos(yaw) * speedUp * 3);
    ufo.rotation.x = Math.sin(time * 4) * 0.15;
    ufo.rotation.y += dt * 1.8;
    ufo.rotation.z = Math.cos(time * 3) * 0.2;
    if (time >= 6) {
      ufo.visible = false;
      ufo.rotation.set(0, 0, 0);
      ufoState.phase = 'idle';
      ufoState.timer = 95;
    }
  }
  ufoState.crashFx.step(ufo.position, dt, ufoState.phase !== 'idle');
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
  if (ctx.sharedUfo) {
    if (!ufoState.sharedMode) {
      if (ufoState.targetCow) releaseCow(ufoState.targetCow, ctx);
      if (ufoState.respawnCow) releaseCow(ufoState.respawnCow, ctx);
      ufoState.targetCow = ufoState.respawnCow = null;
      ufoState.sharedMode = true;
    }
    stepSharedUfo(ctx, dt);
    return;
  }
  if (ufoState.sharedMode) {
    ufoState.sharedMode = false;
    ufoState.phase = 'idle';
    ufoState.timer = 25;
    if (ufoState.mesh) ufoState.mesh.visible = false;
  }

  if (ufoState.respawnCow) {
    ufoState.cowRespawnTimer -= dt;
    if (ufoState.cowRespawnTimer <= 0) {
      releaseCow(ufoState.respawnCow, ctx);
      ufoState.respawnCow = null;
    }
  }

  if (ufoState.phase === 'idle') {
    if (ufoState.crashFx) ufoState.crashFx.step(ufoState.mesh.position, dt, false);
    ufoState.timer -= dt;
    if (ufoState.timer > 0) return;

    const ufo = ensureUfoMesh(ctx);
    const cows = ctx.pastureCows || [];
    const availableCows = cows.filter((c) => !c.abducted);
    const doAbduct = availableCows.length > 0 && Math.random() < 0.55;

    ufo.visible = true;
    ufoState.beam.visible = false;
    ufoState.t = 0;
    ufoState.hits = 0;
    ufoState.crashStart ||= new THREE.Vector3();
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
  if (ufoState.phase === 'crashing' || ufoState.phase === 'wrecked' || ufoState.phase === 'recovering') {
    stepDamagedUfo(dt);
    return;
  }

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
