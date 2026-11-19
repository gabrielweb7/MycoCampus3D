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
import { disposeObjectResources } from '../items/item-registry.js';

const THREE = window.THREE;

export const COW_POOP_INTERVAL_SEC = 30;
export const POOP_CUBENSIS_GROW_SEC = 30;
export const POOP_TOTAL_LIFETIME_SEC = 120; // 30s crescendo + 90s disponível antes de desaparecer
export const MAX_ACTIVE_POOPS = 18;

const PASTURE_BOUNDS = { minX: -84, maxX: 84, minZ: -78, maxZ: 78 };
const HERD_MIGRATION_SPOTS = [
  { x: 64, z: 8 },
  { x: 62, z: -38 },
  { x: -62, z: -38 },
  { x: -66, z: 16 },
  { x: 52, z: 60 },
  { x: -50, z: 60 }
];
const COW_NAMES = ['Mimosa', 'Estrela', 'Pipoca', 'Bela', 'Malhada', 'Flor'];

function isInsideTownOrRoad(x, z) {
  // Mantém as vaquinhas longe do núcleo urbano do campus e da Avenida Sul
  if (Math.abs(x) < 38 && Math.abs(z) < 32) return true;
  if (z > 33 && z < 46) return true;
  return false;
}

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
  for (let attempt = 0; attempt < 60; attempt++) {
    const u = hash01(seedIdx + 1, attempt + 1);
    const v = hash01(seedIdx + 17, attempt + 31);
    const x = PASTURE_BOUNDS.minX + u * (PASTURE_BOUNDS.maxX - PASTURE_BOUNDS.minX);
    const z = PASTURE_BOUNDS.minZ + v * (PASTURE_BOUNDS.maxZ - PASTURE_BOUNDS.minZ);
    if (!isInsideTownOrRoad(x, z) && !isBlockedAt(ctx, x, z, 1.1)) return { x, z };
  }
  return { x: 64, z: 8 };
}

let cowSharedAssets = null;
let poopSharedAssets = null;

function markAllShared(obj) {
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (Array.isArray(v)) {
      v.forEach((it) => { if (it && it.userData) it.userData.shared = true; });
    } else if (v && v.userData) {
      v.userData.shared = true;
    }
  });
  return obj;
}

function getCowSharedAssets() {
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

function getPoopSharedAssets() {
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

function createCuteCowMesh(variant) {
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

function createPoopWithFliesAndCubensis(x, y, z, poopId, variantSeed) {
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

export function createPastureAndCows(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  ctx.pastureCows = ctx.pastureCows || [];
  ctx.pastureCows.length = 0;
  ctx.cowPoops = ctx.cowPoops || [];
  ctx.cowPoops.length = 0;
  ctx.cowHitMeshes = ctx.cowHitMeshes || [];

  // Cocho de Feno e Bebedouro no pasto (sem cercas, permitindo migração livre pelo campus)
  const fenceGroup = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, transparent: true, opacity: 0.85 });

  const ty = terrainHeight(64, 8);
  const trough = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.9), woodMat);
  trough.position.set(64, ty + 0.21, 8);
  const hayPile = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.26, 0.72), hayMat);
  hayPile.position.set(63.45, ty + 0.36, 8);
  const troughWater = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.14, 0.72), waterMat);
  troughWater.position.set(64.55, ty + 0.32, 8);
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
  createPastureBees(ctx);
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
  stepPastureBees(ctx, dt);
  if (!ctx || !ctx.pastureCows) return;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;

  // Relógio sincronizado com o servidor para todas as telas verem igual
  const syncClock = (ctx.serverTimeSec && ctx.serverTimeSec > 0)
    ? ctx.serverTimeSec + ((performance.now() - (ctx.serverTimeSyncAt || 0)) / 1000)
    : (Date.now() / 1000);
  const steerBucket = Math.floor(syncClock / 4);
  const herdSpot = HERD_MIGRATION_SPOTS[Math.floor(syncClock / 28) % HERD_MIGRATION_SPOTS.length];
  let herdCx = 0, herdCz = 0, herdN = 0;
  for (let hi = 0; hi < ctx.pastureCows.length; hi++) {
    const hc = ctx.pastureCows[hi];
    if (hc && !hc.abducted) {
      herdCx += hc.mesh.position.x;
      herdCz += hc.mesh.position.z;
      herdN++;
    }
  }
  if (herdN > 0) { herdCx /= herdN; herdCz /= herdN; }

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
          if (herdN > 1 && Math.hypot(herdCx - cx, herdCz - cz) > 7.0) {
            cow.yaw = Math.atan2(herdCx - cx, herdCz - cz) + (hash01(i + 13, steerBucket) - 0.5) * 0.45;
            cow.mood = 'Seguindo o rebanho 🐄';
          } else if (rAct > 0.55) {
            cow.yaw = Math.atan2(herdSpot.x - cx, herdSpot.z - cz) + (hash01(i + 19, steerBucket) - 0.5) * 0.55;
            cow.mood = 'Migrando 🌿';
          } else {
            cow.yaw += (hash01(i + 19, steerBucket) - 0.5) * 1.4;
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
        isInsideTownOrRoad(nx, nz) ||
        isBlockedAt(ctx, nx, nz, 0.95);

      if (!blocked) {
        for (let j = 0; j < ctx.pastureCows.length; j++) {
          if (i === j) continue;
          const other = ctx.pastureCows[j];
          const odx = nx - other.mesh.position.x, odz = nz - other.mesh.position.z;
          if (odx * odx + odz * odz < 1.8 * 1.8) { blocked = true; break; }
        }
      }

      if (cow.turnCooldown > 0) cow.turnCooldown = Math.max(0, cow.turnCooldown - dt);
      if (blocked) {
        if ((cow.turnCooldown || 0) <= 0) {
          let escaped = false;
          for (const offset of [0.7, -0.7, 1.4, -1.4, Math.PI * 0.75]) {
            const tryYaw = cow.yaw + offset;
            const tx = cx + Math.sin(tryYaw) * cow.speed * dt;
            const tz = cz + Math.cos(tryYaw) * cow.speed * dt;
            if (tx >= PASTURE_BOUNDS.minX && tx <= PASTURE_BOUNDS.maxX &&
                tz >= PASTURE_BOUNDS.minZ && tz <= PASTURE_BOUNDS.maxZ &&
                !isInsideTownOrRoad(tx, tz) &&
                !isBlockedAt(ctx, tx, tz, 0.95)) {
              cow.yaw = tryYaw;
              nx = tx; nz = tz;
              escaped = true;
              break;
            }
          }
          if (!escaped) {
            cow.yaw += Math.PI * 0.65;
            cow.turnCooldown = 0.55;
            nx = cx; nz = cz;
          } else {
            cow.turnCooldown = 0.25;
          }
        } else {
          nx = cx; nz = cz;
        }
      }

      const ny = terrainHeight(nx, nz);
      cow.mesh.position.set(nx, ny, nz);
    }
    cow.mesh.rotation.y = cow.yaw;

    // 3. Animação (só quando visível para manter FPS alto)
    const groundY = terrainHeight(cow.mesh.position.x, cow.mesh.position.z);
    if (cow.happyTimer > 0) cow.happyTimer = Math.max(0, cow.happyTimer - dt);
    if (cow.mesh.visible) {
      if (cow.happyTimer > 0) {
        const bounce = Math.abs(Math.sin(syncClock * 10.0 + i)) * 0.14;
        cow.mesh.position.y = groundY + bounce;
        cow.tail.rotation.z = Math.sin(syncClock * 18.0) * 0.65;
        cow.head.rotation.x = -0.12 + Math.sin(syncClock * 8.0) * 0.14;
      } else if (cow.speed > 0.01) {
        cow.mesh.position.y = groundY;
        cow.walkPhase += dt * cow.speed * 5.2;
        const swing = Math.sin(cow.walkPhase) * 0.44;
        cow.legs[0].rotation.x = swing;
        cow.legs[3].rotation.x = swing;
        cow.legs[1].rotation.x = -swing;
        cow.legs[2].rotation.x = -swing;
        cow.head.rotation.x = 0.12 + Math.sin(cow.walkPhase * 0.4) * 0.08;
        cow.tail.rotation.z = Math.sin(cow.walkPhase * 1.5) * 0.25;
      } else {
        cow.mesh.position.y = groundY;
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
        if (oldest && oldest.group) {
          if (oldest.group.parent) oldest.group.parent.remove(oldest.group);
          disposeObjectResources(oldest.group);
        }
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
      if (p.group) {
        if (p.group.parent) p.group.parent.remove(p.group);
        disposeObjectResources(p.group);
      }
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

// ============================================================================
// ABELHAS FOFINHAS ESTILO MINECRAFT + COLMEIAS NAS ÁRVORES E FLORES
// ============================================================================
function createCuteBeeMesh() {
  const g = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.72,
    roughness: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const pollenMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 });

  // Corpinho cúbico fofinho estilo Minecraft (mais largo e gorduchinho)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, 0.24), yellowMat);
  g.add(body);

  // 2 listras pretas no abdômen
  const stripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.186, 0.174, 0.045), darkMat);
  stripe1.position.z = -0.015;
  const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.186, 0.174, 0.045), darkMat);
  stripe2.position.z = -0.095;
  const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 5), darkMat);
  stinger.rotation.x = -Math.PI / 2;
  stinger.position.set(0, -0.01, -0.145);
  g.add(stripe1, stripe2, stinger);

  // Olhinhos grandes quadrados estilo Minecraft com brilho branco!
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.058, 0.016), darkMat);
    eye.position.set(side * 0.052, 0.005, 0.122);
    const glint = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.018), eyeWhiteMat);
    glint.position.set(side * 0.042, 0.02, 0.125);
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.045, 0.045), darkMat);
    ant.position.set(side * 0.042, 0.09, 0.12);
    ant.rotation.x = 0.35;
    g.add(eye, glint, ant);
  });

  // 6 patinhas pequenas embaixo + pontinhos de pólen
  for (let p = 0; p < 3; p++) {
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.038, 0.016), darkMat);
      leg.position.set(side * 0.052, -0.10, 0.055 - p * 0.055);
      g.add(leg);
    });
  }
  const pollen = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), pollenMat);
  pollen.position.set(0.045, -0.08, -0.02);
  g.add(pollen);

  // Asinhas translúcidas articuladas (esq/dir)
  const wingL = new THREE.Group();
  wingL.position.set(-0.04, 0.088, 0.01);
  const wMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.11), wingMat);
  wMeshL.position.set(-0.08, 0, 0);
  wingL.add(wMeshL);

  const wingR = new THREE.Group();
  wingR.position.set(0.04, 0.088, 0.01);
  const wMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.11), wingMat);
  wMeshR.position.set(0.08, 0, 0);
  wingR.add(wMeshR);

  g.add(wingL, wingR);
  return { group: g, wingL, wingR };
}

function createPastureBees(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  ctx.pastureBees = [];

  // 3 Colmeias estilo madeira/mel perto de árvores e da horta/bosques
  const hiveSpots = [
    { x: 25.5, z: 18.5, bees: 3 },
    { x: 46.0, z: -12.0, bees: 3 },
    { x: -34.0, z: 24.0, bees: 3 }
  ];

  const hiveWoodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 });
  const hiveDarkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const honeyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, emissive: 0x854d0e, emissiveIntensity: 0.15 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });

  hiveSpots.forEach((hs, hIdx) => {
    const gy = terrainHeight(hs.x, hs.z);
    // Árvore de bétula fofa com colmeia pendurada igual à referência!
    const tree = new THREE.Group();
    tree.position.set(hs.x, gy, hs.z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.30, 3.6, 8), trunkMat);
    trunk.position.y = 1.8;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.3, 8), leafMat);
    crown.position.y = 4.1;
    const crown2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.8, 8), leafMat);
    crown2.position.y = 5.1;

    // Colmeia quadrada listrada com mel escorrendo
    const hive = new THREE.Group();
    hive.position.set(0.48, 2.55, 0);
    const hiveBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), hiveWoodMat);
    const hiveBand = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.58), hiveDarkMat);
    hiveBand.position.y = -0.10;
    const hiveHole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.04), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    hiveHole.position.set(0, -0.02, 0.285);
    const honeyDrop = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.05), honeyMat);
    honeyDrop.position.set(0.08, -0.22, 0.285);
    hive.add(hiveBox, hiveBand, hiveHole, honeyDrop);

    tree.add(trunk, crown, crown2, hive);
    ctx.scene.add(tree);

    for (let b = 0; b < hs.bees; b++) {
      const beeVis = createCuteBeeMesh();
      beeVis.group.position.set(hs.x + 0.8, gy + 2.2, hs.z + 0.8);
      ctx.scene.add(beeVis.group);
      ctx.pastureBees.push({
        group: beeVis.group,
        wingL: beeVis.wingL,
        wingR: beeVis.wingR,
        homeX: hs.x + 0.4,
        homeY: gy + 1.85,
        homeZ: hs.z + 0.4,
        phase: (hIdx * 3 + b) * 2.1,
        radius: 1.6 + b * 0.75,
        speed: 0.95 + b * 0.22
      });
    }
  });
}

function stepPastureBees(ctx, dt) {
  if (!ctx || !ctx.pastureBees || !ctx.pastureBees.length) return;
  const nowSec = performance.now() * 0.001;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;

  for (let i = 0; i < ctx.pastureBees.length; i++) {
    const bee = ctx.pastureBees[i];
    const dist = Math.hypot(px - bee.homeX, pz - bee.homeZ);
    bee.group.visible = dist <= 55;
    if (!bee.group.visible) continue;

    bee.phase += dt * bee.speed;
    const t = bee.phase;
    const nx = bee.homeX + Math.cos(t) * bee.radius + Math.sin(t * 2.3) * 0.45;
    const nz = bee.homeZ + Math.sin(t * 0.85) * bee.radius + Math.cos(t * 1.7) * 0.45;
    const ny = bee.homeY + Math.sin(t * 3.1) * 0.42;

    const dx = nx - bee.group.position.x;
    const dz = nz - bee.group.position.z;
    if (dx * dx + dz * dz > 1e-6) {
      bee.group.rotation.y = Math.atan2(dx, dz);
    }
    bee.group.position.set(nx, ny, nz);

    // Batida rápida de asinhas + leve balanço fofo
    const flap = Math.sin(nowSec * 42 + i * 1.7) * 0.75;
    bee.wingL.rotation.z = flap;
    bee.wingR.rotation.z = -flap;
    bee.group.rotation.x = Math.sin(t * 3.1) * 0.12;
  }
}
