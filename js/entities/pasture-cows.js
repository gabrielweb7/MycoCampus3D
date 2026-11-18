/**
 * Vaquinhas Inteligentes, Cocôs com Mosquinhas e Cubensis Dourados (MycoCampus3D)
 * - Nasce apenas em área livre (checando solidColliders e wallSegments).
 * - Desvia de prédios, árvores, cercas e outras vaquinhas.
 * - IA viva: pasta, fica curiosa olhando para jogadores próximos, às vezes corre assustada,
 *   possui Saúde/Humor exibidos no crachá 3D e aceita carinho.
 * - Sincronização determinística via server_ts para todos verem igual sem pesar no MySQL/FPS.
 * - A cada 30s solta cocô com mosquinhas; após 30s nascem 1 grande, 2 médios ou 3 cubensis dourados.
 */

import { terrainHeight } from '../engine/physics.js';

const THREE = window.THREE;

export const COW_POOP_INTERVAL_SEC = 30;
export const POOP_CUBENSIS_GROW_SEC = 30;
export const POOP_TOTAL_LIFETIME_SEC = 120; // 30s crescendo + 90s disponível antes de desaparecer
export const MAX_ACTIVE_POOPS = 18;

const PASTURE_BOUNDS = { minX: 40, maxX: 74, minZ: -12, maxZ: 28 };
const COW_NAMES = ['Mimosa', 'Estrela', 'Pipoca', 'Bela', 'Malhada', 'Flor'];

function hash01(a, b) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function isBlockedAt(ctx, x, z, radius) {
  const r = radius || 0.9;
  const cols = ctx.solidColliders;
  if (cols) {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (!c) continue;
      if (x >= c.minX - r && x <= c.maxX + r && z >= c.minZ - r && z <= c.maxZ + r) {
        return true;
      }
    }
  }
  const walls = ctx.wallSegments;
  if (walls) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!w) continue;
      const vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((x - w.x1) * vx + (z - w.z1) * vz) / lenSq));
      const px = w.x1 + t * vx, pz = w.z1 + t * vz;
      const distSq = (x - px) * (x - px) + (z - pz) * (z - pz);
      const minR = r + (w.thickness || 0.25) * 0.5;
      if (distSq < minR * minR) return true;
    }
  }
  return false;
}

function findSafePasturePoint(ctx, seedIdx) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const u = hash01(seedIdx + 1, attempt + 1);
    const v = hash01(seedIdx + 17, attempt + 31);
    const x = PASTURE_BOUNDS.minX + u * (PASTURE_BOUNDS.maxX - PASTURE_BOUNDS.minX);
    const z = PASTURE_BOUNDS.minZ + v * (PASTURE_BOUNDS.maxZ - PASTURE_BOUNDS.minZ);
    if (!isBlockedAt(ctx, x, z, 1.1)) return { x, z };
  }
  return { x: 56, z: 8 };
}

function createCuteCowMesh(variant) {
  const g = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
  const spotMat = new THREE.MeshStandardMaterial({ color: variant % 2 === 0 ? 0x1e293b : 0x78350f, roughness: 0.78 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
  const hoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 1.02), whiteMat);
  body.position.set(0, 0.56, 0);
  g.add(body);

  const spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.28, 0.36), spotMat);
  spot1.position.set(0, 0.64, -0.14);
  const spot2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.34), spotMat);
  spot2.position.set(0.18, 0.54, 0.28);
  g.add(spot1, spot2);

  const head = new THREE.Group();
  head.position.set(0, 0.78, 0.62);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.48, 0.48), whiteMat);
  const eyePatch = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.04), spotMat);
  eyePatch.position.set(-0.14, 0.06, 0.23);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.20), snoutMat);
  snout.position.set(0, -0.10, 0.26);

  [-0.14, 0.14].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
    eye.position.set(ex, 0.06, 0.25);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 7), hornMat);
    horn.position.set(ex * 1.2, 0.29, 0);
    horn.rotation.z = ex < 0 ? 0.3 : -0.3;
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.06), whiteMat);
    ear.position.set(ex * 1.9, 0.18, -0.04);
    head.add(eye, horn, ear);
  });
  head.add(skull, eyePatch, snout);
  g.add(head);

  const legs = [];
  [[-0.24, 0.34], [0.24, 0.34], [-0.24, -0.34], [0.24, -0.34]].forEach((lp) => {
    const leg = new THREE.Group();
    leg.position.set(lp[0], 0.32, lp[1]);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.24, 8), whiteMat);
    upper.position.y = -0.12;
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.08, 8), hoofMat);
    hoof.position.y = -0.26;
    leg.add(upper, hoof);
    g.add(leg);
    legs.push(leg);
  });

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.34, 6), spotMat);
  tail.position.set(0, 0.58, -0.56);
  tail.rotation.x = 0.35;
  g.add(tail);

  return { group: g, body, head, legs, tail };
}

function createPoopWithFliesAndCubensis(x, y, z, poopId, variantSeed) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const poopMat = new THREE.MeshStandardMaterial({ color: 0x6b3e1b, roughness: 0.92 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.08, 10), poopMat);
  base.position.y = 0.04;
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.07, 10), poopMat);
  mid.position.y = 0.10;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.09, 8), poopMat);
  top.position.y = 0.17;
  g.add(base, mid, top);

  const flies = [];
  const flyBodyMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.75 });
  for (let fi = 0; fi < 3; fi++) {
    const fg = new THREE.Group();
    const fBody = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), flyBodyMat);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.004, 0.016), wingMat);
    wingL.position.set(-0.018, 0.01, 0);
    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.004, 0.016), wingMat);
    wingR.position.set(0.018, 0.01, 0);
    fg.add(fBody, wingL, wingR);
    fg.position.set(0, 0.28 + fi * 0.05, 0);
    g.add(fg);
    flies.push({ group: fg, phase: fi * 2.1, radius: 0.14 + fi * 0.04 });
  }

  // Micélio branco colonizando o topo do cocô (estágio 0s-10s)
  const myceliumGroup = new THREE.Group();
  const mycMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
  [
    [0, 0.20, 0, 0.14], [-0.07, 0.18, 0.05, 0.09], [0.08, 0.18, -0.04, 0.08], [0.02, 0.19, 0.08, 0.07]
  ].forEach((m) => {
    const patch = new THREE.Mesh(new THREE.CylinderGeometry(m[3], m[3] * 1.15, 0.014, 8), mycMat);
    patch.position.set(m[0], m[1], m[2]);
    myceliumGroup.add(patch);
  });
  myceliumGroup.scale.setScalar(0.05);
  g.add(myceliumGroup);

  // Cubensis reais com LatheGeometry (perfil campanulado orgânico + véu fino roxo)
  const cubensisGroup = new THREE.Group();
  cubensisGroup.visible = false;
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.65 });
  const veilMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.85, side: THREE.DoubleSide });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xa1551c, roughness: 0.42, side: THREE.DoubleSide });
  const gillsMat = new THREE.MeshStandardMaterial({ color: 0x3b2820, roughness: 0.88, side: THREE.DoubleSide });

  const capProfile = [
    new THREE.Vector2(0.084, -0.004),
    new THREE.Vector2(0.090, 0.000),
    new THREE.Vector2(0.078, 0.016),
    new THREE.Vector2(0.050, 0.038),
    new THREE.Vector2(0.022, 0.052),
    new THREE.Vector2(0.000, 0.056)
  ];
  const capGeo = new THREE.LatheGeometry(capProfile, 16);

  const caps = [];
  const mushParts = [];
  const patternType = Math.floor(hash01(variantSeed, 99) * 3);
  const offsets = patternType === 0
    ? [[0, 0, 1.45]] // 1 grande!
    : (patternType === 1
      ? [[-0.06, 0.03, 1.05], [0.07, -0.04, 0.92]] // 2 médios
      : [[0, 0, 1.0], [-0.08, 0.06, 0.78], [0.09, -0.05, 0.85]]); // 3 em tufo

  offsets.forEach((off) => {
    const mg = new THREE.Group();
    mg.position.set(off[0], 0.14, off[1]);
    mg.scale.setScalar(off[2]);

    const stemPivot = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, 0.21, 10), stemMat);
    st.position.y = 0.105;
    // Anel/véu fino caído na haste igual à foto real do Cubensis
    const veilRing = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.030, 0.022, 10, 1, true), veilMat);
    veilRing.position.y = 0.135;
    veilRing.rotation.z = 0.15;
    stemPivot.add(st, veilRing);
    mg.add(stemPivot);

    const capGroup = new THREE.Group();
    capGroup.position.y = 0.205;
    const dome = new THREE.Mesh(capGeo, capMat);
    const gills = new THREE.Mesh(new THREE.CircleGeometry(0.083, 16), gillsMat);
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

export function createPastureAndCows(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  ctx.pastureCows = ctx.pastureCows || [];
  ctx.pastureCows.length = 0;
  ctx.cowPoops = ctx.cowPoops || [];
  ctx.cowPoops.length = 0;
  ctx.cowHitMeshes = ctx.cowHitMeshes || [];

  // Cerca rústica do pasto + Porteira interativa + Cocho de Feno & Bebedouro
  const fenceGroup = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, transparent: true, opacity: 0.85 });

  function addFencePost(fx, fz) {
    const fy = terrainHeight(fx, fz);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 0.16), woodMat);
    post.position.set(fx, fy + 0.55, fz);
    fenceGroup.add(post);
  }
  function addFenceRail(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    const my = terrainHeight(mx, mz);
    [0.42, 0.82].forEach((ry) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, len), woodMat);
      rail.position.set(mx, my + ry, mz);
      rail.rotation.y = ang;
      fenceGroup.add(rail);
    });
  }
  for (let x = PASTURE_BOUNDS.minX; x <= PASTURE_BOUNDS.maxX; x += 6) {
    addFencePost(x, PASTURE_BOUNDS.minZ);
    addFencePost(x, PASTURE_BOUNDS.maxZ);
    if (x + 6 <= PASTURE_BOUNDS.maxX) {
      addFenceRail(x, PASTURE_BOUNDS.minZ, x + 6, PASTURE_BOUNDS.minZ);
      addFenceRail(x, PASTURE_BOUNDS.maxZ, x + 6, PASTURE_BOUNDS.maxZ);
    }
  }
  for (let z = PASTURE_BOUNDS.minZ; z <= PASTURE_BOUNDS.maxZ; z += 6) {
    addFencePost(PASTURE_BOUNDS.maxX, z);
    if (z + 6 <= PASTURE_BOUNDS.maxZ) {
      addFenceRail(PASTURE_BOUNDS.maxX, z, PASTURE_BOUNDS.maxX, z + 6);
    }
    if (Math.abs(z - 8) > 3.5) {
      addFencePost(PASTURE_BOUNDS.minX, z);
      if (z + 6 <= PASTURE_BOUNDS.maxZ && Math.abs(z + 3 - 8) > 3.0) {
        addFenceRail(PASTURE_BOUNDS.minX, z, PASTURE_BOUNDS.minX, z + 6);
      }
    }
  }
  // Cocho de Feno e Bebedouro no centro do pasto (x=57, z=8)
  const ty = terrainHeight(57, 8);
  const trough = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.9), woodMat);
  trough.position.set(57, ty + 0.21, 8);
  const hayPile = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.26, 0.72), hayMat);
  hayPile.position.set(56.45, ty + 0.36, 8);
  const troughWater = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.72), waterMat);
  troughWater.position.set(57.55, ty + 0.32, 8);
  fenceGroup.add(trough, hayPile, troughWater);
  ctx.scene.add(fenceGroup);

  for (let i = 0; i < 6; i++) {
    const pos = findSafePasturePoint(ctx, i);
    const cy = terrainHeight(pos.x, pos.z);
    const cowVis = createCuteCowMesh(i);
    cowVis.group.position.set(pos.x, cy, pos.z);
    const initYaw = hash01(i, 7) * Math.PI * 2;
    cowVis.group.rotation.y = initYaw;
    ctx.scene.add(cowVis.group);

    const cowObj = {
      id: 'cow_' + i,
      name: COW_NAMES[i % COW_NAMES.length],
      mesh: cowVis.group,
      head: cowVis.head,
      legs: cowVis.legs,
      tail: cowVis.tail,
      yaw: initYaw,
      baseSpeed: 0.95 + (i % 3) * 0.22,
      speed: 0.95,
      health: 100,
      mood: 'Pastando 🌿',
      state: 'wander', // 'wander' | 'graze' | 'curious' | 'flee'
      fleeTimer: 0,
      lastBucket: -1,
      lastPoopBucket: -1,
      walkPhase: i * 1.3
    };
    cowVis.body.userData.cowObj = cowObj;
    ctx.cowHitMeshes.push(cowVis.body);
    ctx.pastureCows.push(cowObj);
  }
}

export function petCow(cowObj) {
  if (!cowObj) return '';
  cowObj.health = Math.min(100, (cowObj.health || 100) + 5);
  cowObj.mood = 'Feliz 💚 (Muuu!)';
  cowObj.state = 'curious';
  cowObj.happyTimer = 3.0;
  return `🐄 ${cowObj.name}: Muuu! 💚 (Saúde ${cowObj.health}%)`;
}

export function stepPastureCows(ctx, dt) {
  if (!ctx || !ctx.pastureCows) return;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;

  // Relógio sincronizado com o servidor para todas as telas verem igual
  const syncClock = (ctx.serverTimeSec && ctx.serverTimeSec > 0)
    ? ctx.serverTimeSec + ((performance.now() - (ctx.serverTimeSyncAt || 0)) / 1000)
    : (Date.now() / 1000);
  const steerBucket = Math.floor(syncClock / 4);

  for (let i = 0; i < ctx.pastureCows.length; i++) {
    const cow = ctx.pastureCows[i];
    if (cow.abducted) continue;
    const cx = cow.mesh.position.x;
    const cz = cow.mesh.position.z;
    const distToPlayer = Math.hypot(px - cx, pz - cz);
    cow.mesh.visible = distToPlayer <= 78;

    // 1. Comportamento inteligente: curiosa com jogador perto, ou corre assustada se muito perto
    if (cow.fleeTimer > 0) {
      cow.fleeTimer -= dt;
      cow.state = 'flee';
      cow.speed = cow.baseSpeed * 2.4;
      cow.mood = 'Correndo 💨';
    } else if (distToPlayer < 2.4) {
      cow.fleeTimer = 3.2;
      cow.yaw = Math.atan2(cx - px, cz - pz);
      cow.state = 'flee';
      cow.speed = cow.baseSpeed * 2.4;
      cow.mood = 'Assustada 💨';
    } else if (distToPlayer < 6.5) {
      cow.state = 'curious';
      cow.speed = 0;
      cow.mood = 'Curiosa 👀';
      const lookYaw = Math.atan2(px - cx, pz - cz);
      let diff = lookYaw - cow.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cow.yaw += diff * Math.min(1, dt * 4.5);
    } else {
      if (steerBucket !== cow.lastBucket) {
        cow.lastBucket = steerBucket;
        const rAct = hash01(i + 3, steerBucket);
        if (rAct < 0.24) {
          cow.state = 'graze';
          cow.speed = 0;
          const nearTrough = Math.hypot(cx - 57, cz - 8) < 3.6;
          cow.mood = nearTrough ? (rAct < 0.12 ? 'Bebendo água 💧' : 'Comendo feno 🌾') : 'Pastando 🌿';
        } else {
          cow.state = 'wander';
          cow.speed = cow.baseSpeed;
          cow.mood = 'Passeando 🌤️';
          if (rAct > 0.82) {
            cow.yaw = Math.atan2(57 - cx, 8 - cz); // Vai até o cocho!
          } else {
            cow.yaw += (hash01(i + 19, steerBucket) - 0.5) * 2.0;
          }
        }
      }
    }

    // 2. Movimento com desvio de obstáculos e outras vaquinhas
    if (cow.speed > 0.01) {
      let nx = cx + Math.sin(cow.yaw) * cow.speed * dt;
      let nz = cz + Math.cos(cow.yaw) * cow.speed * dt;
      let blocked = nx < PASTURE_BOUNDS.minX || nx > PASTURE_BOUNDS.maxX ||
        nz < PASTURE_BOUNDS.minZ || nz > PASTURE_BOUNDS.maxZ ||
        isBlockedAt(ctx, nx, nz, 0.95);

      if (!blocked) {
        for (let j = 0; j < ctx.pastureCows.length; j++) {
          if (i === j) continue;
          const other = ctx.pastureCows[j];
          const odx = nx - other.mesh.position.x, odz = nz - other.mesh.position.z;
          if (odx * odx + odz * odz < 1.8 * 1.8) { blocked = true; break; }
        }
      }

      if (blocked) {
        // Desvia suavemente para ângulo livre
        let escaped = false;
        for (const offset of [0.8, -0.8, 1.6, -1.6, Math.PI]) {
          const tryYaw = cow.yaw + offset;
          const tx = cx + Math.sin(tryYaw) * cow.speed * dt;
          const tz = cz + Math.cos(tryYaw) * cow.speed * dt;
          if (tx >= PASTURE_BOUNDS.minX && tx <= PASTURE_BOUNDS.maxX &&
              tz >= PASTURE_BOUNDS.minZ && tz <= PASTURE_BOUNDS.maxZ &&
              !isBlockedAt(ctx, tx, tz, 0.95)) {
            cow.yaw = tryYaw;
            nx = tx; nz = tz;
            escaped = true;
            break;
          }
        }
        if (!escaped) {
          cow.yaw += Math.PI * 0.75;
          nx = cx; nz = cz;
        }
      }

      const ny = terrainHeight(nx, nz);
      cow.mesh.position.set(nx, ny, nz);
    }
    cow.mesh.rotation.y = cow.yaw;

    // 3. Animação (só quando visível para manter FPS alto)
    if (cow.happyTimer > 0) cow.happyTimer = Math.max(0, cow.happyTimer - dt);
    if (cow.mesh.visible) {
      if (cow.happyTimer > 0) {
        const bounce = Math.abs(Math.sin(syncClock * 10.0 + i)) * 0.14;
        cow.mesh.position.y += bounce;
        cow.tail.rotation.z = Math.sin(syncClock * 18.0) * 0.65;
        cow.head.rotation.x = -0.12 + Math.sin(syncClock * 8.0) * 0.14;
      } else if (cow.speed > 0.01) {
        cow.walkPhase += dt * cow.speed * 5.2;
        const swing = Math.sin(cow.walkPhase) * 0.44;
        cow.legs[0].rotation.x = swing;
        cow.legs[3].rotation.x = swing;
        cow.legs[1].rotation.x = -swing;
        cow.legs[2].rotation.x = -swing;
        cow.head.rotation.x = 0.12 + Math.sin(cow.walkPhase * 0.4) * 0.08;
        cow.tail.rotation.z = Math.sin(cow.walkPhase * 1.5) * 0.25;
      } else {
        for (let li = 0; li < 4; li++) cow.legs[li].rotation.x *= 0.85;
        cow.head.rotation.x = cow.state === 'graze'
          ? 0.48 + Math.sin(syncClock * 3.0 + i) * 0.10
          : 0.05 + Math.sin(syncClock * 1.5 + i) * 0.04;
        cow.tail.rotation.z = Math.sin(syncClock * 2.2 + i) * 0.18;
      }
    }

    // 4. Rastro de cocô sincronizado a cada 30s
    const poopBucket = Math.floor((syncClock + i * 5) / COW_POOP_INTERVAL_SEC);
    if (cow.lastPoopBucket === -1) {
      cow.lastPoopBucket = poopBucket;
    } else if (poopBucket > cow.lastPoopBucket) {
      cow.lastPoopBucket = poopBucket;
      if (ctx.cowPoops.length >= MAX_ACTIVE_POOPS) {
        const oldest = ctx.cowPoops.shift();
        if (oldest && oldest.group && oldest.group.parent) oldest.group.parent.remove(oldest.group);
      }
      const pxPos = cow.mesh.position.x - Math.sin(cow.yaw) * 0.55;
      const pzPos = cow.mesh.position.z - Math.cos(cow.yaw) * 0.55;
      const pyPos = terrainHeight(pxPos, pzPos);
      const poopId = `wild_poop_${i}_${poopBucket}`;
      const poopVis = createPoopWithFliesAndCubensis(pxPos, pyPos, pzPos, poopId, poopBucket + i * 13);
      ctx.scene.add(poopVis.group);
      ctx.cowPoops.push({
        id: poopId,
        group: poopVis.group,
        flies: poopVis.flies,
        myceliumGroup: poopVis.myceliumGroup,
        cubensisGroup: poopVis.cubensisGroup,
        mushParts: poopVis.mushParts,
        ageSec: 0,
        grown: false,
        wildEntry: {
          id: poopId,
          group: poopVis.cubensisGroup,
          worldX: pxPos,
          worldZ: pzPos,
          capMesh: poopVis.caps[0],
          active: false,
          respawnAt: 0
        }
      });
    }
  }

  // 5. Atualiza mosquinhas + crescimento animado (micélio -> pins -> haste -> chapéu) + desaparecimento após 120s
  for (let pi = ctx.cowPoops.length - 1; pi >= 0; pi--) {
    const p = ctx.cowPoops[pi];
    p.ageSec += dt;

    if (p.ageSec >= POOP_TOTAL_LIFETIME_SEC) {
      if (p.group && p.group.parent) p.group.parent.remove(p.group);
      p.wildEntry.active = false;
      if (ctx.wildMushrooms) {
        const wIdx = ctx.wildMushrooms.indexOf(p.wildEntry);
        if (wIdx !== -1) ctx.wildMushrooms.splice(wIdx, 1);
      }
      ctx.cowPoops.splice(pi, 1);
      continue;
    }

    const pDistSq = (p.group.position.x - px) ** 2 + (p.group.position.z - pz) ** 2;
    p.group.visible = pDistSq <= 45 * 45;

    if (p.group.visible) {
      for (let fi = 0; fi < p.flies.length; fi++) {
        const fl = p.flies[fi];
        fl.phase += dt * 5.8;
        fl.group.position.x = Math.cos(fl.phase) * fl.radius;
        fl.group.position.z = Math.sin(fl.phase * 1.3) * fl.radius;
        fl.group.position.y = 0.26 + Math.sin(fl.phase * 2.4) * 0.05;
        fl.group.rotation.y = -fl.phase;
      }

      // Fade/encolhimento suave nos últimos 5s antes de sumir
      if (p.ageSec > POOP_TOTAL_LIFETIME_SEC - 5) {
        const fade = Math.max(0.05, (POOP_TOTAL_LIFETIME_SEC - p.ageSec) / 5);
        p.group.scale.setScalar(fade);
      }
    }

    // Estágios de crescimento (0-10s micélio, 10-20s pins, 20-30s haste + véu + abertura do chapéu)
    if (p.myceliumGroup) {
      const mycFrac = Math.min(1, Math.max(0.08, p.ageSec / 10));
      p.myceliumGroup.scale.set(mycFrac, 1, mycFrac);
    }

    if (p.ageSec >= 10 && p.mushParts && (!p.grown || p.wildEntry.active)) {
      p.cubensisGroup.visible = true;
      const pinFrac = Math.min(1, (p.ageSec - 10) / 10); // 10s..20s
      const growFrac = Math.min(1, Math.max(0, (p.ageSec - 20) / 10)); // 20s..30s
      for (let mi = 0; mi < p.mushParts.length; mi++) {
        const mp = p.mushParts[mi];
        const stemH = 0.18 + pinFrac * 0.22 + growFrac * 0.60;
        const capOpen = 0.28 + pinFrac * 0.20 + growFrac * 0.52;
        mp.stemPivot.scale.set(0.45 + 0.55 * growFrac, stemH, 0.45 + 0.55 * growFrac);
        mp.veilRing.visible = growFrac > 0.35;
        mp.capGroup.position.y = 0.195 * stemH;
        mp.capGroup.scale.set(capOpen, 0.45 + 0.55 * growFrac, capOpen);
      }
    }

    if (!p.grown && p.ageSec >= POOP_CUBENSIS_GROW_SEC) {
      p.grown = true;
      p.wildEntry.active = true;
      if (ctx.wildMushrooms && ctx.wildMushrooms.indexOf(p.wildEntry) === -1) {
        ctx.wildMushrooms.push(p.wildEntry);
      }
    }
  }
}
