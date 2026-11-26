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
import { disposeObjectResources, getCachedCanvasTexture, registerPickable } from '../items/item-registry.js';
import { spawnCampusFxBurst } from '../engine/fx-burst.js';
import { isNaturalSoilSpot } from '../world/nature-plaza.js';
import { triggerCozyHeartBurst } from '../world/cozy-details.js';
import { firstUnoccludedRayHit, isRayOccludedByStructure } from '../systems/ray-occlusion.js';
import { updateCultureLiquidLabel } from '../items/liquid-culture.js';
import { updateLcNutrientLabel } from '../items/pda-bottle.js';

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
  // Mantém vaquinhas, cocôs e Cubensis longe da cidade, prédios, quadras, estradas e concreto
  if (Math.abs(x) < 38 && Math.abs(z) < 32) return true;
  if (!isNaturalSoilSpot(x, z, 1.2)) return true;
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
  if (cowObj.mesh && cowObj.mesh.position) {
    triggerCozyHeartBurst(cowObj.mesh.position.x, cowObj.mesh.position.y + 1.35, cowObj.mesh.position.z, 0xf472b6);
  }
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
// ABELHAS INTELIGENTES, RAINHA COM COROA, FLORES, MEL E MIGRAÇÃO DE ENXAME
// ============================================================================
const FLOWER_COLORS = [0xf472b6, 0xa855f7, 0xef4444, 0x38bdf8, 0xfb923c, 0xf8fafc];
const FLOWER_COLOR_NAMES = ['Rosa', 'Lavanda', 'Vermelha', 'Azul', 'Laranja', 'Branca'];
export const FLOWER_POLLEN_PER_VISIT = 0.10;
export const MAX_CAMPUS_FLOWERS = 110;
let flowerIdSeq = 0;
const _flowerPlantHit = {
  point: THREE && THREE.Vector3 ? new THREE.Vector3() : { x: 0, y: 0, z: 0 },
  distance: 0
};

const CAMPUS_HIVE_CANDIDATES = [
  { x: 24.8, z: 26.5 },
  { x: 68.5, z: -16.0 },
  { x: -69.5, z: 12.0 },
  { x: 38.0, z: 24.0 },
  { x: 54.0, z: -28.0 },
  { x: -72.0, z: -22.0 },
  { x: -30.5, z: 28.5 },
  { x: 46.0, z: -46.0 },
  { x: 66.0, z: 28.0 }
];

let beeSharedAssets = null;
function getBeeSharedAssets() {
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
    yellowMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48, emissive: 0xca8a04, emissiveIntensity: 0.16 }),
    queenYellowMat: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.32, emissive: 0xf59e0b, emissiveIntensity: 0.24 }),
    blushMat: new THREE.MeshBasicMaterial({ color: 0xf472b6 }),
    crownMat: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.72, emissive: 0x854d0e, emissiveIntensity: 0.25 }),
    darkMat: new THREE.MeshStandardMaterial({ color: 0x26170c, roughness: 0.72 }),
    eyeWhiteMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    wingMat: new THREE.MeshStandardMaterial({
      color: 0xf0f9ff,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    pollenMat: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, emissive: 0x92400e, emissiveIntensity: 0.2 }),
    hiveWoodMat: new THREE.MeshStandardMaterial({ color: hiveTex ? 0xffffff : 0xd97706, map: hiveTex, roughness: 0.68 }),
    hiveRoofGeo: new THREE.ConeGeometry(0.46, 0.22, 4),
    hiveDarkMat: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 }),
    hiveAbandonedMat: new THREE.MeshStandardMaterial({ color: 0x94a3b8, map: hiveTex, roughness: 0.94 }),
    hiveAbandonedBandMat: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.96 }),
    honeyMat: new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.08, emissive: 0xb45309, emissiveIntensity: 0.24 }),
    jewelMat: new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.45, roughness: 0.2 }),
    holeMat: new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    trunkMat: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 }),
    leafMat: new THREE.MeshStandardMaterial({ color: 0x36b45e, roughness: 0.82 }),
    leafLightMat: new THREE.MeshStandardMaterial({ color: 0x74cf65, roughness: 0.8 }),
    stemMat: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 }),
    flowerCenterMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }),
    flowerCenterEmptyMat: new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 }),
    petalMats: FLOWER_COLORS.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65 })),
    birchCrownGeo: new THREE.DodecahedronGeometry(1, 1),
    trunkGeo: new THREE.CylinderGeometry(0.24, 0.30, 3.6, 8),
    hiveBoxGeo: new THREE.BoxGeometry(0.56, 0.56, 0.56),
    hiveTrimGeo: new THREE.BoxGeometry(0.585, 0.045, 0.585),
    hiveHoleGeo: new THREE.BoxGeometry(0.14, 0.10, 0.04),
    hivePorchGeo: new THREE.BoxGeometry(0.20, 0.032, 0.095),
    honeyDropGeo: new THREE.SphereGeometry(0.036, 7, 6),
    jewelGeo: new THREE.SphereGeometry(0.018, 6, 5),
    beeBodyGeo: new THREE.BoxGeometry(0.18, 0.17, 0.24),
    beeStripeGeo: new THREE.BoxGeometry(0.186, 0.174, 0.045),
    beeButtGeo: new THREE.BoxGeometry(0.165, 0.152, 0.024),
    beeStingerGeo: new THREE.ConeGeometry(0.016, 0.05, 5),
    beeEyeGeo: new THREE.BoxGeometry(0.042, 0.058, 0.016),
    beeGlintGeo: new THREE.BoxGeometry(0.018, 0.022, 0.018),
    beeBlushGeo: new THREE.BoxGeometry(0.032, 0.018, 0.014),
    beeAntGeo: new THREE.BoxGeometry(0.014, 0.045, 0.045),
    beeLegGeo: new THREE.BoxGeometry(0.016, 0.038, 0.016),
    beePollenGeo: new THREE.SphereGeometry(0.045, 7, 6),
    beeWingGeo: new THREE.BoxGeometry(0.16, 0.008, 0.11),
    crownBaseGeo: new THREE.CylinderGeometry(0.058, 0.052, 0.026, 8),
    crownSpikeGeo: new THREE.ConeGeometry(0.016, 0.042, 4),
    stemGeo: new THREE.CylinderGeometry(0.018, 0.022, 0.26, 6),
    centerGeo: new THREE.SphereGeometry(0.045, 7, 6),
    petalGeo: new THREE.SphereGeometry(0.042, 6, 5),
    flowerHitGeo: new THREE.CylinderGeometry(0.22, 0.22, 0.42, 6),
    flowerHitMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    flowerSeedPodGeo: new THREE.SphereGeometry(0.055, 7, 6),
    flowerSeedPodMat: new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.42, roughness: 0.35 }),
    seedPackBodyGeo: new THREE.BoxGeometry(0.11, 0.145, 0.028),
    seedPackBodyMat: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 }),
    seedPackTrimGeo: new THREE.BoxGeometry(0.114, 0.028, 0.032),
    seedPackTrimMat: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.58 }),
    spriteMat: spriteTex ? new THREE.SpriteMaterial({ map: spriteTex, transparent: true, depthTest: true, depthWrite: false }) : null
  });
  return beeSharedAssets;
}

function markSubtreeDynamic(root) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse((o) => {
    if (o && o.userData) {
      o.userData.isDynamic = true;
      o.userData.noMerge = true;
    }
  });
}

function createCuteBeeMesh(isQueen) {
  const a = getBeeSharedAssets();
  const g = new THREE.Group();

  // Corpinho cúbico fofinho estilo Minecraft
  const body = new THREE.Mesh(a.beeBodyGeo, isQueen ? a.queenYellowMat : a.yellowMat);
  g.add(body);

  // 2 listras no abdômen + acabamento traseiro + ferrão
  const stripe1 = new THREE.Mesh(a.beeStripeGeo, a.darkMat);
  stripe1.position.z = -0.005;
  const stripe2 = new THREE.Mesh(a.beeStripeGeo, a.darkMat);
  stripe2.position.z = -0.080;
  const buttCap = new THREE.Mesh(a.beeButtGeo, a.darkMat);
  buttCap.position.z = -0.114;
  const stinger = new THREE.Mesh(a.beeStingerGeo, a.darkMat);
  stinger.rotation.x = -Math.PI / 2;
  stinger.position.set(0, -0.01, -0.145);
  g.add(stripe1, stripe2, buttCap, stinger);

  // Olhinhos grandes quadrados estilo Minecraft com brilho branco
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(a.beeEyeGeo, a.darkMat);
    eye.position.set(side * 0.052, 0.005, 0.122);
    const glint = new THREE.Mesh(a.beeGlintGeo, a.eyeWhiteMat);
    glint.position.set(side * 0.042, 0.02, 0.125);
    const blush = new THREE.Mesh(a.beeBlushGeo, a.blushMat);
    blush.position.set(side * 0.062, -0.032, 0.122);
    const ant = new THREE.Mesh(a.beeAntGeo, a.darkMat);
    ant.position.set(side * 0.042, 0.09, 0.12);
    ant.rotation.x = 0.35;
    g.add(eye, glint, blush, ant);
  });

  // 6 patinhas pequenas embaixo
  const legs = [];
  for (let p = 0; p < 3; p++) {
    [-1, 1].forEach((side) => {
      const leg = new THREE.Mesh(a.beeLegGeo, a.darkMat);
      leg.position.set(side * 0.052, -0.10, 0.055 - p * 0.055);
      g.add(leg);
      legs.push(leg);
    });
  }

  // Bolinha de pólen amarela visível durante a volta para a colmeia
  const pollenMesh = new THREE.Mesh(a.beePollenGeo, a.pollenMat);
  pollenMesh.position.set(0, -0.115, -0.02);
  pollenMesh.visible = false;
  g.add(pollenMesh);

  // Asinhas translúcidas articuladas (esq/dir)
  const wingL = new THREE.Group();
  wingL.position.set(-0.036, 0.088, -0.01);
  const wMeshL = new THREE.Mesh(a.beeWingGeo, a.wingMat);
  wMeshL.position.set(-0.08, 0, 0);
  wingL.add(wMeshL);

  const wingR = new THREE.Group();
  wingR.position.set(0.036, 0.088, -0.01);
  const wMeshR = new THREE.Mesh(a.beeWingGeo, a.wingMat);
  wMeshR.position.set(0.08, 0, 0);
  wingR.add(wMeshR);

  g.add(wingL, wingR);

  let migrationSprite = null;
  if (isQueen) {
    // Coroa dourada da Abelha Rainha
    const crownBase = new THREE.Mesh(a.crownBaseGeo, a.crownMat);
    crownBase.position.set(0, 0.098, 0.05);
    g.add(crownBase);
    [-0.036, 0, 0.036].forEach((cx) => {
      const spike = new THREE.Mesh(a.crownSpikeGeo, a.crownMat);
      spike.position.set(cx, 0.128, 0.05);
      g.add(spike);
    });
    const jewel = new THREE.Mesh(a.jewelGeo, a.jewelMat);
    jewel.position.set(0, 0.154, 0.05);
    g.add(jewel);
    g.scale.setScalar(1.42);

    if (a.spriteMat) {
      migrationSprite = new THREE.Sprite(a.spriteMat);
      migrationSprite.position.set(0, 0.34, 0);
      migrationSprite.scale.set(1.45, 0.29, 1);
      migrationSprite.visible = false;
      g.add(migrationSprite);
    }
  }

  markSubtreeDynamic(g);
  return { group: g, wingL, wingR, pollenMesh, migrationSprite, legs };
}

export function createCampusFlower(ctx, x, z, colorIdx, opts = {}) {
  const gy = terrainHeight(x, z);
  const cIdx = (((colorIdx || 0) % FLOWER_COLORS.length) + FLOWER_COLORS.length) % FLOWER_COLORS.length;
  const baseScale = typeof opts.baseScale === 'number' ? opts.baseScale : (0.88 + Math.random() * 0.28);
  const stage = opts.stage || 'blooming';
  const pollen = stage === 'blooming' ? (typeof opts.pollen === 'number' ? opts.pollen : 1.0) : 0;
  const sproutDuration = typeof opts.sproutDuration === 'number' ? opts.sproutDuration : (12 + Math.random() * 20);
  const seedHoldDuration = typeof opts.seedHoldDuration === 'number' ? opts.seedHoldDuration : (18 + Math.random() * 22);
  const wiltDuration = typeof opts.wiltDuration === 'number' ? opts.wiltDuration : (3.2 + Math.random() * 3.0);
  const stageTimer = typeof opts.stageTimer === 'number' ? opts.stageTimer : 0;
  const id = 'fl_' + (++flowerIdSeq);

  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial || !ctx || !ctx.scene) {
    const mockFlower = {
      id,
      group: {
        position: { x, y: gy, z },
        scale: { x: baseScale, y: baseScale, z: baseScale, setScalar(s) { this.x = s; this.y = s; this.z = s; } },
        rotation: { x: 0, y: 0, z: 0 },
        visible: true,
        parent: null
      },
      centerMesh: {
        material: null,
        scale: { setScalar() {} }
      },
      petalGroup: { scale: { setScalar() {}, set() {} } },
      seedPodMesh: { visible: stage === 'seeding', position: { y: 0.32 }, scale: { setScalar() {} } },
      hitMesh: null,
      x,
      y: gy + 0.28 * baseScale,
      z,
      colorIdx: cIdx,
      baseScale,
      stage,
      pollen,
      stageTimer,
      sproutDuration,
      seedHoldDuration,
      wiltDuration,
      seedHarvested: false,
      removed: false
    };
    return mockFlower;
  }

  const a = getBeeSharedAssets();
  const fg = new THREE.Group();
  fg.position.set(x, gy, z);

  const stem = new THREE.Mesh(a.stemGeo, a.stemMat);
  stem.position.y = 0.13;
  const center = new THREE.Mesh(a.centerGeo, stage === 'blooming' ? a.flowerCenterMat : a.flowerCenterEmptyMat);
  center.position.y = 0.27;
  center.scale.setScalar(0.72 + pollen * 0.28);
  fg.add(stem, center);

  const petalGroup = new THREE.Group();
  const petalMat = a.petalMats[cIdx];
  for (let p = 0; p < 5; p++) {
    const ang = (p / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(a.petalGeo, petalMat);
    petal.position.set(Math.cos(ang) * 0.062, 0.265, Math.sin(ang) * 0.062);
    petal.scale.set(1.15, 0.65, 1.15);
    petalGroup.add(petal);
  }
  if (stage === 'sprouting') {
    const t = Math.max(0, Math.min(1, stageTimer / sproutDuration));
    fg.scale.setScalar(baseScale * (0.24 + 0.76 * t));
    petalGroup.scale.setScalar(0.15 + 0.85 * t);
  } else {
    fg.scale.setScalar(baseScale);
  }
  fg.add(petalGroup);

  const seedPodMesh = new THREE.Mesh(a.flowerSeedPodGeo, a.flowerSeedPodMat);
  seedPodMesh.position.set(0, 0.32, 0);
  seedPodMesh.visible = stage === 'seeding';
  fg.add(seedPodMesh);

  const hitMesh = new THREE.Mesh(a.flowerHitGeo, a.flowerHitMat);
  hitMesh.position.y = 0.21;
  fg.add(hitMesh);

  markSubtreeDynamic(fg);
  ctx.scene.add(fg);

  const fl = {
    id,
    group: fg,
    centerMesh: center,
    petalGroup,
    seedPodMesh,
    hitMesh,
    x,
    y: gy + 0.28 * baseScale,
    z,
    colorIdx: cIdx,
    baseScale,
    stage,
    pollen,
    stageTimer,
    sproutDuration,
    seedHoldDuration,
    wiltDuration,
    seedHarvested: false,
    removed: false
  };
  hitMesh.userData.flowerObj = fl;
  if (!Array.isArray(ctx.flowerHitMeshes)) ctx.flowerHitMeshes = [];
  ctx.flowerHitMeshes.push(hitMesh);
  return fl;
}

function spawnTreeWithHiveSlot(ctx, x, z) {
  const a = getBeeSharedAssets();
  const gy = terrainHeight(x, z);
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
  return { tree, gy };
}

function createHiveOnTree(ctx, id, treeInfo, opts = {}) {
  const a = getBeeSharedAssets();
  const hiveGroup = new THREE.Group();
  hiveGroup.position.set(0.48, 2.55, 0);

  const hiveBox = new THREE.Mesh(a.hiveBoxGeo, a.hiveWoodMat);
  const hiveTopTrim = new THREE.Mesh(a.hiveTrimGeo, a.hiveDarkMat);
  hiveTopTrim.position.y = 0.265;
  const hiveBotTrim = new THREE.Mesh(a.hiveTrimGeo, a.hiveDarkMat);
  hiveBotTrim.position.y = -0.265;
  const hiveRoof = new THREE.Mesh(a.hiveRoofGeo, a.hiveDarkMat);
  hiveRoof.position.y = 0.39;
  hiveRoof.rotation.y = Math.PI / 4;
  const hiveHole = new THREE.Mesh(a.hiveHoleGeo, a.holeMat);
  hiveHole.position.set(0, -0.02, 0.282);
  const hivePorch = new THREE.Mesh(a.hivePorchGeo, a.hiveDarkMat);
  hivePorch.position.set(0, -0.09, 0.315);

  const honeyDropGroup = new THREE.Group();
  const drop1 = new THREE.Mesh(a.honeyDropGeo, a.honeyMat);
  drop1.scale.set(0.95, 1.45, 0.72);
  drop1.position.set(0.085, -0.145, 0.295);
  const drop2 = new THREE.Mesh(a.honeyDropGeo, a.honeyMat);
  drop2.scale.set(0.72, 1.15, 0.65);
  drop2.position.set(-0.11, -0.21, 0.288);
  honeyDropGroup.add(drop1, drop2);

  hiveGroup.add(hiveBox, hiveTopTrim, hiveBotTrim, hiveRoof, hiveHole, hivePorch, honeyDropGroup);
  markSubtreeDynamic(hiveGroup);
  treeInfo.tree.add(hiveGroup);

  const worldX = treeInfo.tree.position.x + 0.48;
  const worldY = treeInfo.gy + 2.55;
  const worldZ = treeInfo.tree.position.z;

  const hiveObj = {
    id,
    group: hiveGroup,
    boxMesh: hiveBox,
    bandMesh: hiveBotTrim,
    trimMeshes: [hiveTopTrim, hiveBotTrim, hiveRoof, hivePorch],
    honeyDropMesh: honeyDropGroup,
    hitMesh: hiveBox,
    treePos: { x: treeInfo.tree.position.x, z: treeInfo.tree.position.z },
    x: worldX,
    y: worldY,
    z: worldZ,
    honeyLevel: typeof opts.honeyLevel === 'number' ? opts.honeyLevel : 45,
    abandoned: false,
    migrating: !!opts.migrating,
    buildProgress: typeof opts.buildProgress === 'number' ? opts.buildProgress : 1.0,
    canCollectAbandoned: false,
    collected: false,
    flowersNearby: [],
    queen: null,
    bees: [],
    noPollenTimer: 0
  };

  hiveBox.userData.hiveObj = hiveObj;
  ctx.beehiveHitMeshes.push(hiveBox);
  ctx.beehives.push(hiveObj);
  if (hiveObj.migrating) {
    hiveGroup.visible = false;
  } else {
    hiveGroup.scale.setScalar(Math.max(0.2, hiveObj.buildProgress));
  }
  return hiveObj;
}

function refreshHiveFlowers(ctx, hive, maxRadius = 11.5) {
  if (!ctx.campusFlowers) {
    hive.flowersNearby = [];
    return hive.flowersNearby;
  }
  const list = [];
  for (let i = 0; i < ctx.campusFlowers.length; i++) {
    const fl = ctx.campusFlowers[i];
    if (fl && !fl.removed && Math.hypot(fl.x - hive.x, fl.z - hive.z) <= maxRadius) {
      list.push(fl);
    }
  }
  hive.flowersNearby = list;
  return list;
}

function refreshAllHiveFlowers(ctx) {
  if (!ctx || !ctx.beehives) return;
  for (let i = 0; i < ctx.beehives.length; i++) {
    const h = ctx.beehives[i];
    if (h && !h.abandoned && !h.collected) refreshHiveFlowers(ctx, h);
  }
}

function transitionFlowerToSeeding(fl, a) {
  fl.pollen = 0;
  fl.stage = 'seeding';
  fl.stageTimer = 0;
  fl.seedHarvested = false;
  if (fl.centerMesh) {
    if (a) fl.centerMesh.material = a.flowerCenterEmptyMat;
    if (fl.centerMesh.scale?.setScalar) fl.centerMesh.scale.setScalar(0.72);
  }
  if (fl.petalGroup?.scale?.set) fl.petalGroup.scale.set(0.86, 0.72, 0.86);
  if (fl.seedPodMesh) fl.seedPodMesh.visible = true;
}

function removeCampusFlower(ctx, fl) {
  if (!fl || fl.removed) return;
  fl.removed = true;
  if (fl.group) {
    if (fl.group.parent) fl.group.parent.remove(fl.group);
    if (THREE && THREE.Object3D && typeof disposeObjectResources === 'function') {
      try { disposeObjectResources(fl.group); } catch (_) {}
    }
  }
  if (fl.hitMesh && ctx && Array.isArray(ctx.flowerHitMeshes)) {
    const hIdx = ctx.flowerHitMeshes.indexOf(fl.hitMesh);
    if (hIdx !== -1) ctx.flowerHitMeshes.splice(hIdx, 1);
  }
  if (ctx && Array.isArray(ctx.campusFlowers)) {
    const fIdx = ctx.campusFlowers.indexOf(fl);
    if (fIdx !== -1) ctx.campusFlowers.splice(fIdx, 1);
  }
  if (ctx && Array.isArray(ctx.pastureBees)) {
    for (let i = 0; i < ctx.pastureBees.length; i++) {
      if (ctx.pastureBees[i] && ctx.pastureBees[i].targetFlower === fl) {
        ctx.pastureBees[i].targetFlower = null;
      }
    }
  }
  if (ctx && ctx.hoveredFlower === fl) ctx.hoveredFlower = null;
  refreshAllHiveFlowers(ctx);
}

export function disperseFlowerSeed(ctx, motherFl) {
  if (!ctx || !motherFl) return null;
  if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = [];
  if (ctx.campusFlowers.length >= MAX_CAMPUS_FLOWERS) return null;

  let sx = 0, sz = 0, found = false;
  for (let attempt = 0; attempt < 22; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 1.8 + Math.random() * 3.8;
    const cx = motherFl.x + Math.cos(ang) * dist;
    const cz = motherFl.z + Math.sin(ang) * dist;
    if (!isNaturalSoilSpot(cx, cz, 0.65) || isBlockedAt(ctx, cx, cz, 0.45)) continue;
    let tooClose = false;
    for (let i = 0; i < ctx.campusFlowers.length; i++) {
      const other = ctx.campusFlowers[i];
      if (other && !other.removed && Math.hypot(other.x - cx, other.z - cz) < 0.75) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      sx = cx;
      sz = cz;
      found = true;
      break;
    }
  }
  if (!found) return null;

  const nextColor = Math.random() < 0.75
    ? motherFl.colorIdx
    : Math.floor(Math.random() * FLOWER_COLORS.length);
  const child = createCampusFlower(ctx, sx, sz, nextColor, {
    stage: 'sprouting',
    sproutDuration: 12 + Math.random() * 20
  });
  ctx.campusFlowers.push(child);
  if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: motherFl.x, y: motherFl.y, z: motherFl.z }, 0xfde047, 5);
  refreshAllHiveFlowers(ctx);
  return child;
}

export function stepCampusFlowers(ctx, dt, nowSec = 0) {
  if (!ctx || !Array.isArray(ctx.campusFlowers) || !ctx.campusFlowers.length) return;
  const a = (THREE && THREE.MeshStandardMaterial) ? getBeeSharedAssets() : null;

  for (let fi = ctx.campusFlowers.length - 1; fi >= 0; fi--) {
    const fl = ctx.campusFlowers[fi];
    if (!fl || fl.removed) {
      ctx.campusFlowers.splice(fi, 1);
      continue;
    }

    if (fl.stage === 'sprouting') {
      fl.stageTimer += dt;
      const p = Math.max(0, Math.min(1, fl.stageTimer / (fl.sproutDuration || 18)));
      if (fl.group?.scale?.setScalar) fl.group.scale.setScalar((fl.baseScale || 1) * (0.24 + 0.76 * p));
      if (fl.petalGroup?.scale?.setScalar) fl.petalGroup.scale.setScalar(0.15 + 0.85 * p);
      if (fl.stageTimer >= (fl.sproutDuration || 18)) {
        fl.stage = 'blooming';
        fl.pollen = 1.0;
        fl.stageTimer = 0;
        if (fl.centerMesh) {
          if (a) fl.centerMesh.material = a.flowerCenterMat;
          if (fl.centerMesh.scale?.setScalar) fl.centerMesh.scale.setScalar(1.0);
        }
        if (fl.petalGroup?.scale?.setScalar) fl.petalGroup.scale.setScalar(1.0);
        if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
        if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: fl.x, y: fl.y, z: fl.z }, 0xfacc15, 4);
        refreshAllHiveFlowers(ctx);
      }
    } else if (fl.stage === 'blooming') {
      if (fl.centerMesh?.scale?.setScalar) fl.centerMesh.scale.setScalar(0.72 + Math.max(0, fl.pollen) * 0.28);
      if (fl.pollen <= 0.001) {
        transitionFlowerToSeeding(fl, a);
      }
    } else if (fl.stage === 'seeding') {
      fl.stageTimer += dt;
      if (fl.seedPodMesh) {
        fl.seedPodMesh.visible = true;
        if (fl.seedPodMesh.position) fl.seedPodMesh.position.y = 0.32 + Math.sin(nowSec * 5 + fi) * 0.02;
        if (fl.seedPodMesh.scale?.setScalar) fl.seedPodMesh.scale.setScalar(0.95 + Math.sin(nowSec * 6 + fi) * 0.14);
      }
      if (fl.stageTimer >= (fl.seedHoldDuration || 25)) {
        if (!fl.seedHarvested) disperseFlowerSeed(ctx, fl);
        if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
        fl.stage = 'wilting';
        fl.stageTimer = 0;
      }
    } else if (fl.stage === 'wilting') {
      fl.stageTimer += dt;
      const wp = Math.max(0, Math.min(1, fl.stageTimer / (fl.wiltDuration || 4)));
      if (fl.group?.scale?.setScalar) fl.group.scale.setScalar((fl.baseScale || 1) * (1 - 0.95 * wp));
      if (fl.group?.rotation) fl.group.rotation.z = wp * 0.35;
      if (fl.stageTimer >= (fl.wiltDuration || 4)) {
        removeCampusFlower(ctx, fl);
      }
    }
  }
}

function markHiveAbandoned(hive) {
  const a = getBeeSharedAssets();
  hive.abandoned = true;
  hive.migrating = false;
  hive.honeyLevel = 0;
  hive.canCollectAbandoned = true;
  hive.boxMesh.material = a.hiveAbandonedMat;
  if (hive.trimMeshes && hive.trimMeshes.length) {
    for (let i = 0; i < hive.trimMeshes.length; i++) {
      if (hive.trimMeshes[i]) hive.trimMeshes[i].material = a.hiveAbandonedBandMat;
    }
  } else if (hive.bandMesh) {
    hive.bandMesh.material = a.hiveAbandonedBandMat;
  }
  hive.honeyDropMesh.visible = false;
  hive.bees = [];
  hive.queen = null;
}

function createPastureBees(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  if (!Array.isArray(ctx.pastureBees)) ctx.pastureBees = []; else ctx.pastureBees.length = 0;
  if (!Array.isArray(ctx.beehives)) ctx.beehives = []; else ctx.beehives.length = 0;
  if (!Array.isArray(ctx.beehiveHitMeshes)) ctx.beehiveHitMeshes = []; else ctx.beehiveHitMeshes.length = 0;
  if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = []; else ctx.campusFlowers.length = 0;
  if (!Array.isArray(ctx.flowerHitMeshes)) ctx.flowerHitMeshes = []; else ctx.flowerHitMeshes.length = 0;

  // Flores coloridas em solo natural com tempos variados perto das colmeias
  let flowerSeed = 0;
  CAMPUS_HIVE_CANDIDATES.forEach((spot, sIdx) => {
    const count = sIdx < 3 ? 6 : 7;
    for (let f = 0; f < count; f++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const ang = (f / count) * Math.PI * 2 + hash01(sIdx + 1, f + attempt * 7 + 3) * 1.1;
        const dist = 2.0 + hash01(f + attempt * 13 + 7, sIdx + 11) * 5.2;
        const fx = spot.x + Math.cos(ang) * dist;
        const fz = spot.z + Math.sin(ang) * dist;
        if (isNaturalSoilSpot(fx, fz, 0.7) && !isBlockedAt(ctx, fx, fz, 0.5)) {
          const isStaggeredSprout = sIdx >= 3 && (flowerSeed % 6 === 0);
          const sDur = 12 + hash01(f + 5, sIdx + 19) * 20;
          ctx.campusFlowers.push(createCampusFlower(ctx, fx, fz, flowerSeed++, {
            stage: isStaggeredSprout ? 'sprouting' : 'blooming',
            pollen: 1.0,
            sproutDuration: sDur,
            stageTimer: isStaggeredSprout ? sDur * hash01(sIdx + 2, f + 9) * 0.7 : 0
          }));
          break;
        }
      }
    }
  });

  // 3 Colmeias iniciais com Rainha + 3 abelhas operárias cada
  for (let hIdx = 0; hIdx < 3; hIdx++) {
    const hs = CAMPUS_HIVE_CANDIDATES[hIdx];
    const treeInfo = spawnTreeWithHiveSlot(ctx, hs.x, hs.z);
    const hive = createHiveOnTree(ctx, 'hive_' + hIdx, treeInfo, { honeyLevel: 45 + hIdx * 10, buildProgress: 1.0 });
    refreshHiveFlowers(ctx, hive);

    // Abelha Rainha maior com coroa dourada
    const qPhase = hIdx * 1.7;
    let qx = hive.x + 0.22 + Math.cos(qPhase) * 1.05;
    let qy = hive.y + 0.42;
    let qz = hive.z + 0.22 + Math.sin(qPhase) * 1.05;
    if (isBeeBlockedAt3D(ctx, qx, qy, qz, 0.22, null)) {
      qx = hive.x + 0.45;
      qy = hive.y + 1.05;
      qz = hive.z + 0.45;
    }
    const qVis = createCuteBeeMesh(true);
    qVis.group.position.set(qx, qy, qz);
    ctx.scene.add(qVis.group);
    const queenObj = {
      isQueen: true,
      hive,
      group: qVis.group,
      wingL: qVis.wingL,
      wingR: qVis.wingR,
      legs: qVis.legs,
      pollenMesh: qVis.pollenMesh,
      migrationSprite: qVis.migrationSprite,
      phase: qPhase,
      radius: 1.05,
      speed: 1.15,
      state: 'orbit',
      avoidSide: hIdx % 2 === 0 ? 1 : -1,
      hasPollen: false
    };
    hive.queen = queenObj;
    ctx.pastureBees.push(queenObj);

    // Operárias forrageadoras espalhadas ao redor da colmeia
    for (let b = 0; b < 3; b++) {
      const beeVis = createCuteBeeMesh(false);
      const bPhase = (hIdx * 3 + b) * 2.1;
      let bx = hive.x + Math.cos(bPhase) * 0.9;
      let by = hive.y + 0.1 + b * 0.06;
      let bz = hive.z + Math.sin(bPhase) * 0.9;
      if (isBeeBlockedAt3D(ctx, bx, by, bz, 0.22, null)) {
        bx = hive.x + (b - 1) * 0.35;
        by = hive.y + 0.65;
        bz = hive.z + 0.65;
      }
      beeVis.group.position.set(bx, by, bz);
      ctx.scene.add(beeVis.group);
      const beeObj = {
        isQueen: false,
        hive,
        group: beeVis.group,
        wingL: beeVis.wingL,
        wingR: beeVis.wingR,
        legs: beeVis.legs,
        pollenMesh: beeVis.pollenMesh,
        phase: bPhase,
        radius: 1.2 + b * 0.45,
        speed: 1.8 + b * 0.2,
        state: 'to_flower',
        targetFlower: null,
        stateTimer: 0.4 + b * 0.7,
        avoidSide: b % 2 === 0 ? 1 : -1,
        hasPollen: false
      };
      hive.bees.push(beeObj);
      ctx.pastureBees.push(beeObj);
    }
  }
}

function spawnFreshSproutsNearSpot(ctx, spot, targetCount = 4) {
  if (!ctx || !spot) return;
  if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = [];
  let activeOrSprout = 0;
  for (let i = 0; i < ctx.campusFlowers.length; i++) {
    const fl = ctx.campusFlowers[i];
    if (fl && !fl.removed && (fl.stage === 'blooming' || fl.stage === 'sprouting') &&
      Math.hypot(fl.x - spot.x, fl.z - spot.z) <= 11.5) {
      activeOrSprout++;
    }
  }
  const needed = Math.max(0, targetCount - activeOrSprout);
  let spawned = 0;
  for (let attempt = 0; attempt < 28 && spawned < needed && ctx.campusFlowers.length < MAX_CAMPUS_FLOWERS; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 2.2 + Math.random() * 5.2;
    const fx = spot.x + Math.cos(ang) * dist;
    const fz = spot.z + Math.sin(ang) * dist;
    if (!isNaturalSoilSpot(fx, fz, 0.7) || isBlockedAt(ctx, fx, fz, 0.5)) continue;
    ctx.campusFlowers.push(createCampusFlower(ctx, fx, fz, Math.floor(Math.random() * FLOWER_COLORS.length), {
      stage: 'sprouting',
      sproutDuration: 6 + Math.random() * 10
    }));
    spawned++;
  }
}

function startHiveMigration(ctx, oldHive) {
  // Escolhe outro ponto candidato do campus com mais flores disponíveis
  let bestSpot = null;
  let bestScore = -1;
  for (let i = 0; i < CAMPUS_HIVE_CANDIDATES.length; i++) {
    const cand = CAMPUS_HIVE_CANDIDATES[i];
    const occupied = ctx.beehives.some((h) => !h.abandoned && Math.hypot(h.x - cand.x, h.z - cand.z) < 6.0);
    if (occupied) continue;
    let score = 0;
    if (ctx.campusFlowers) {
      for (let f = 0; f < ctx.campusFlowers.length; f++) {
        const fl = ctx.campusFlowers[f];
        if (fl && !fl.removed && fl.stage === 'blooming' && fl.pollen > 0.001 && Math.hypot(fl.x - cand.x, fl.z - cand.z) <= 11.5) {
          score++;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSpot = cand;
    }
  }
  if (!bestSpot) {
    spawnFreshSproutsNearSpot(ctx, oldHive, 4);
    refreshHiveFlowers(ctx, oldHive);
    return;
  }

  // Garante brotos frescos no destino caso haja poucas flores ativas
  if (bestScore <= 1) {
    spawnFreshSproutsNearSpot(ctx, bestSpot, 4);
  }

  const queen = oldHive.queen;
  const bees = oldHive.bees.slice();
  markHiveAbandoned(oldHive);

  const treeInfo = spawnTreeWithHiveSlot(ctx, bestSpot.x, bestSpot.z);
  const newHive = createHiveOnTree(ctx, 'hive_mig_' + ctx.beehives.length, treeInfo, {
    honeyLevel: 12,
    migrating: true,
    buildProgress: 0.2
  });
  newHive.queen = queen;
  newHive.bees = bees;
  if (queen) {
    queen.hive = newHive;
    queen.state = 'migrate';
    if (queen.migrationSprite) queen.migrationSprite.visible = false;
  }
  for (let i = 0; i < bees.length; i++) {
    bees[i].hive = newHive;
    bees[i].state = 'migrate';
    bees[i].hasPollen = false;
    if (bees[i].pollenMesh) bees[i].pollenMesh.visible = false;
  }
}

const BEE_STEER_MAGS = [0.95, -0.95, 1.55, -1.55];

/** Verifica colisão 3D contra terreno, prédios, paredes, troncos e caixas de colmeia. */
export function isBeeBlockedAt3D(ctx, x, y, z, radius = 0.22, ignoreHiveBox = null) {
  const r = radius || 0.22;
  if (y < terrainHeight(x, z) + 0.14) return true;
  const cols = ctx && ctx.solidColliders;
  if (cols) {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (!c) continue;
      const minY = (typeof c.minY === 'number' ? c.minY : -1) - r;
      const maxY = (typeof c.maxY === 'number' ? c.maxY : 6.0) + r;
      if (y >= minY && y <= maxY &&
        x >= c.minX - r && x <= c.maxX + r &&
        z >= c.minZ - r && z <= c.maxZ + r) {
        return true;
      }
    }
  }
  const walls = ctx && ctx.wallSegments;
  if (walls) {
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (!w) continue;
      const minY = (typeof w.minY === 'number' ? w.minY : -1) - r;
      const maxY = (typeof w.maxY === 'number' ? w.maxY : 5.5) + r;
      if (y < minY || y > maxY) continue;
      const vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((x - w.x1) * vx + (z - w.z1) * vz) / lenSq));
      const px = w.x1 + t * vx, pz = w.z1 + t * vz;
      const minR = r + (w.halfThick || (w.thickness || 0.25) * 0.5);
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < minR * minR) return true;
    }
  }
  const hives = ctx && ctx.beehives;
  if (hives) {
    for (let i = 0; i < hives.length; i++) {
      const h = hives[i];
      if (!h || h.collected || h.migrating) continue;
      if (h.treePos && y < h.y + 1.35) {
        const tdx = x - h.treePos.x, tdz = z - h.treePos.z;
        const tr = 0.44 + r;
        if (tdx * tdx + tdz * tdz < tr * tr) return true;
      }
      if (ignoreHiveBox === h && z > h.z + 0.26) continue;
      if (Math.abs(x - h.x) < 0.34 + r &&
        Math.abs(y - h.y) < 0.34 + r &&
        Math.abs(z - h.z) < 0.34 + r) {
        return true;
      }
    }
  }
  return false;
}

/** Move a abelha rumo ao alvo desviando lateralmente ou subindo sobre obstáculos 3D. */
export function moveBeeSafely(ctx, bee, tx, ty, tz, speed, dt, bobY = 0, ignoreHiveBox = null) {
  const pos = bee.group.position;
  const dx = tx - pos.x;
  const dy = ty - pos.y;
  const dz = tz - pos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-4) return 0;

  const stepDist = Math.min(d, speed * dt);
  const dirX = dx / d;
  const dirY = dy / d;
  const dirZ = dz / d;

  let nx = pos.x + dirX * stepDist;
  let ny = pos.y + dirY * stepDist + bobY;
  let nz = pos.z + dirZ * stepDist;
  const minGroundY = terrainHeight(nx, nz) + 0.16;
  if (ny < minGroundY) ny = minGroundY;

  const lookDist = Math.min(d, 0.95);
  const lx = pos.x + dirX * lookDist;
  const lz = pos.z + dirZ * lookDist;
  const ly = Math.max(terrainHeight(lx, lz) + 0.16, pos.y + dirY * lookDist);

  if (!isBeeBlockedAt3D(ctx, nx, ny, nz, 0.22, ignoreHiveBox) &&
    !isBeeBlockedAt3D(ctx, lx, ly, lz, 0.22, ignoreHiveBox)) {
    pos.set(nx, ny, nz);
    if (dx * dx + dz * dz > 1e-6) bee.group.rotation.y = Math.atan2(dx, dz);
    return d;
  }

  const horizLen = Math.hypot(dx, dz);
  const hDirX = horizLen > 1e-4 ? dx / horizLen : 1;
  const hDirZ = horizLen > 1e-4 ? dz / horizLen : 0;
  const baseAngle = Math.atan2(hDirX, hDirZ);
  const sidePref = bee.avoidSide || 1;
  const steerStep = Math.max(stepDist, Math.min(d, speed * dt));

  for (let aIdx = 0; aIdx < BEE_STEER_MAGS.length; aIdx++) {
    const deltaAng = sidePref * BEE_STEER_MAGS[aIdx];
    const ang = baseAngle + deltaAng;
    const sx = Math.sin(ang);
    const sz = Math.cos(ang);
    const cx = pos.x + sx * steerStep;
    const cz = pos.z + sz * steerStep;
    const cy = Math.max(terrainHeight(cx, cz) + 0.16, pos.y + dirY * steerStep * 0.5 + bobY);
    const alx = pos.x + sx * 0.85;
    const alz = pos.z + sz * 0.85;
    const aly = Math.max(terrainHeight(alx, alz) + 0.16, pos.y + dirY * 0.35);
    if (!isBeeBlockedAt3D(ctx, cx, cy, cz, 0.22, ignoreHiveBox) &&
      !isBeeBlockedAt3D(ctx, alx, aly, alz, 0.22, ignoreHiveBox)) {
      pos.set(cx, cy, cz);
      bee.avoidSide = deltaAng >= 0 ? 1 : -1;
      bee.group.rotation.y = Math.atan2(sx, sz);
      return d;
    }
  }

  // Todos os desvios horizontais bloqueados -> sobe suavemente por cima do obstáculo
  const climbStep = speed * 0.85 * dt;
  let climbY = pos.y + climbStep;
  let cx = pos.x + hDirX * stepDist * 0.35;
  let cz = pos.z + hDirZ * stepDist * 0.35;
  if (isBeeBlockedAt3D(ctx, cx, climbY, cz, 0.22, ignoreHiveBox)) {
    cx = pos.x;
    cz = pos.z;
    if (isBeeBlockedAt3D(ctx, cx, climbY, cz, 0.22, ignoreHiveBox)) {
      climbY = pos.y + climbStep * 1.25;
    }
  }
  const minGroundClimb = terrainHeight(cx, cz) + 0.16;
  if (climbY < minGroundClimb) climbY = minGroundClimb;
  pos.set(cx, climbY, cz);
  if (horizLen > 1e-4) bee.group.rotation.y = Math.atan2(dx, dz);
  return d;
}

function stepPastureBees(ctx, dt) {
  if (!ctx) return;
  const nowSec = performance.now() * 0.001;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;

  // Ciclo de vida das flores silvestres (broto -> flor -> semente -> dispersão -> murchar)
  stepCampusFlowers(ctx, dt, nowSec);

  // Atualiza colmeias (construção, brilho de mel, detecção de falta de flores -> migração)
  if (ctx.beehives) {
    for (let hi = 0; hi < ctx.beehives.length; hi++) {
      const hive = ctx.beehives[hi];
      if (hive.collected || hive.abandoned) continue;

      if (!hive.migrating && hive.buildProgress < 1.0) {
        hive.buildProgress = Math.min(1.0, hive.buildProgress + dt * 0.12);
        hive.group.visible = true;
        hive.group.scale.setScalar(Math.max(0.2, hive.buildProgress));
      }

      if (hive.honeyDropMesh) {
        hive.honeyDropMesh.visible = hive.buildProgress >= 0.8 && hive.honeyLevel >= 35;
        if (hive.honeyDropMesh.visible) {
          const dropScale = 0.7 + (hive.honeyLevel / 100) * 0.6;
          hive.honeyDropMesh.scale.set(1, dropScale, 1);
        }
      }

      // Verifica se ainda existem flores em floração ou brotando perto da colmeia
      if (!hive.migrating && hive.buildProgress >= 1.0) {
        let availableFlowers = 0;
        let upcomingSprouts = 0;
        for (let fi = 0; fi < hive.flowersNearby.length; fi++) {
          const fl = hive.flowersNearby[fi];
          if (!fl || fl.removed) continue;
          if (fl.stage === 'blooming' && fl.pollen > 0.001) availableFlowers++;
          else if (fl.stage === 'sprouting' || (fl.stage === 'seeding' && !fl.seedHarvested)) upcomingSprouts++;
        }
        if (availableFlowers === 0 && upcomingSprouts === 0) {
          hive.noPollenTimer += dt;
          if (hive.noPollenTimer > 5.0) {
            hive.noPollenTimer = 0;
            startHiveMigration(ctx, hive);
          }
        } else {
          hive.noPollenTimer = 0;
        }
      }
    }
  }

  if (!ctx.pastureBees || !ctx.pastureBees.length) return;
  const a = (THREE && THREE.MeshStandardMaterial) ? getBeeSharedAssets() : null;

  for (let i = 0; i < ctx.pastureBees.length; i++) {
    const bee = ctx.pastureBees[i];
    const hive = bee.hive;
    if (!hive) continue;

    const dist = Math.hypot(px - bee.group.position.x, pz - bee.group.position.z);
    bee.group.visible = dist <= 65;
    if (!bee.group.visible) continue;

    bee.phase += dt * (bee.speed || 1.4);
    const flap = Math.sin(nowSec * 42 + i * 1.7) * 0.75;
    bee.wingL.rotation.z = flap;
    bee.wingR.rotation.z = -flap;
    if (bee.legs && bee.legs.length) {
      for (let li = 0; li < bee.legs.length; li++) {
        bee.legs[li].rotation.x = Math.sin(nowSec * 18 + i + li * 0.6) * 0.25;
      }
    }

    // 1. Voo de migração em enxame com a Rainha
    if (hive.migrating) {
      if (bee.isQueen) {
        if (bee.migrationSprite) bee.migrationSprite.visible = dist <= 18;
        const tx = hive.x;
        const ty = hive.y + 0.55;
        const tz = hive.z;
        const arrivalDist = Math.hypot(
          tx - bee.group.position.x,
          ty - bee.group.position.y,
          tz - bee.group.position.z
        );
        if (arrivalDist < 0.65) {
          hive.migrating = false;
          hive.group.visible = true;
          hive.group.scale.setScalar(hive.buildProgress);
          if (bee.migrationSprite) bee.migrationSprite.visible = false;
          bee.state = 'orbit';
          refreshHiveFlowers(ctx, hive);
          for (let bi = 0; bi < hive.bees.length; bi++) {
            hive.bees[bi].state = 'to_flower';
            hive.bees[bi].stateTimer = 0.5 + bi * 0.6;
          }
        } else {
          const targetY = arrivalDist > 4.5
            ? Math.max(ty, terrainHeight(bee.group.position.x, bee.group.position.z) + 6.5)
            : ty;
          moveBeeSafely(ctx, bee, tx, targetY, tz, 4.2, dt, Math.sin(nowSec * 5) * 0.01, null);
          bee.group.rotation.x = 0.14;
        }
      } else {
        const q = hive.queen;
        const qx = q ? q.group.position.x : hive.x;
        const qy = q ? q.group.position.y : hive.y + 0.5;
        const qz = q ? q.group.position.z : hive.z;
        const ox = Math.cos(bee.phase * 1.6 + i) * 0.85;
        const oy = Math.sin(bee.phase * 2.2 + i) * 0.35 - 0.15;
        const oz = Math.sin(bee.phase * 1.4 + i) * 0.85;
        moveBeeSafely(ctx, bee, qx + ox, qy + oy, qz + oz, 5.2, dt, 0, null);
        bee.group.rotation.x = 0.14;
      }
      continue;
    }

    // 2. Rainha orbita suavemente ao redor da colmeia evitando obstáculos
    if (bee.isQueen) {
      if (bee.migrationSprite) bee.migrationSprite.visible = false;
      const t = bee.phase;
      const qx = hive.x + 0.22 + Math.cos(t) * 1.05;
      const qz = hive.z + 0.22 + Math.sin(t) * 1.05;
      const qy = hive.y + 0.42 + Math.sin(t * 2.5) * 0.22;
      moveBeeSafely(ctx, bee, qx, qy, qz, 2.4, dt, 0, null);
      bee.group.rotation.x = Math.sin(t * 2.5) * 0.10;
      continue;
    }

    // 3. Operárias: forrageio entre colmeia e flores próximas
    if (bee.pollenMesh) bee.pollenMesh.visible = !!bee.hasPollen;

    if (hive.buildProgress < 1.0) {
      // Orbitando e construindo a nova colmeia sem atravessar obstáculos
      const t = bee.phase;
      const nx = hive.x + 0.22 + Math.cos(t) * 1.1;
      const nz = hive.z + 0.22 + Math.sin(t) * 1.1;
      const ny = hive.y + Math.sin(t * 3.0) * 0.35;
      moveBeeSafely(ctx, bee, nx, ny, nz, 2.6, dt, 0, null);
      bee.group.rotation.x = 0;
      continue;
    }

    if (bee.state === 'to_flower') {
      if (!bee.targetFlower || bee.targetFlower.removed || bee.targetFlower.stage !== 'blooming' || bee.targetFlower.pollen <= 0.001) {
        const candidates = hive.flowersNearby.filter((fl) => fl && !fl.removed && fl.stage === 'blooming' && fl.pollen > 0.001);
        bee.targetFlower = candidates.length
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : null;
      }
      if (!bee.targetFlower) {
        // Sem flores disponíveis -> orbita colmeia aguardando brotos ou migração
        const t = bee.phase;
        const nx = hive.x + 0.22 + Math.cos(t) * bee.radius;
        const nz = hive.z + 0.22 + Math.sin(t) * bee.radius;
        const ny = hive.y + Math.sin(t * 2.8) * 0.3;
        moveBeeSafely(ctx, bee, nx, ny, nz, 2.6, dt, 0, null);
        bee.group.rotation.x = 0;
      } else {
        const fl = bee.targetFlower;
        const flDist = Math.hypot(
          fl.x - bee.group.position.x,
          (fl.y + 0.14) - bee.group.position.y,
          fl.z - bee.group.position.z
        );
        if (flDist < 0.28) {
          bee.state = 'collect';
          bee.stateTimer = 1.1;
          bee.group.rotation.x = 0;
        } else {
          moveBeeSafely(ctx, bee, fl.x, fl.y + 0.14, fl.z, 2.8, dt, Math.sin(nowSec * 9 + i) * 0.008, null);
          bee.group.rotation.x = 0.16;
        }
      }
    } else if (bee.state === 'collect') {
      bee.group.rotation.x = 0;
      bee.stateTimer -= dt;
      if (bee.targetFlower && !bee.targetFlower.removed && bee.targetFlower.stage === 'blooming') {
        bee.group.position.y = bee.targetFlower.y + 0.14 + Math.sin(nowSec * 14) * 0.04;
        bee.group.rotation.y += dt * 4.2;
      } else {
        bee.targetFlower = null;
        bee.state = 'to_flower';
        continue;
      }
      if (bee.stateTimer <= 0) {
        if (bee.targetFlower && !bee.targetFlower.removed) {
          const nextPollen = Math.max(0, Math.round((bee.targetFlower.pollen - FLOWER_POLLEN_PER_VISIT) * 100) / 100);
          bee.targetFlower.pollen = nextPollen;
          if (nextPollen <= 0.001) {
            transitionFlowerToSeeding(bee.targetFlower, a);
          }
        }
        bee.hasPollen = true;
        bee.state = 'to_hive';
      }
    } else if (bee.state === 'to_hive') {
      const tx = hive.x;
      const ty = hive.y - 0.02;
      const tz = hive.z + 0.36;
      const d = Math.hypot(
        tx - bee.group.position.x,
        ty - bee.group.position.y,
        tz - bee.group.position.z
      );
      if (d < 0.30) {
        bee.hasPollen = false;
        hive.honeyLevel = Math.min(100, (hive.honeyLevel || 0) + 12);
        if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: hive.x, y: hive.y, z: hive.z }, 0xfacc15, 5);
        bee.targetFlower = null;
        bee.state = 'to_flower';
        bee.group.rotation.x = 0;
      } else {
        moveBeeSafely(ctx, bee, tx, ty, tz, 2.6, dt, Math.sin(nowSec * 8 + i) * 0.008, hive);
        bee.group.rotation.x = 0.16;
      }
    }
  }
}

// ============================================================================
// INTERAÇÃO E COLHEITA DE MEL / COLMEIA ABANDONADA
// ============================================================================
function isHoneyContainer(held) {
  if (!held) return false;
  if (held.lcNutrientCtrl) return true;
  if (held.mesh && held.mesh.userData && held.mesh.userData.liquidCtrl && !held.spawnCtrl) return true;
  if (held.spawnCtrl && !held.spawnCtrl.filled && !held.spawnCtrl.isBag) return true;
  return false;
}

export function findHoveredBeehive(raycaster, ctx) {
  if (!raycaster || !ctx || !ctx.beehiveHitMeshes || !ctx.beehiveHitMeshes.length) return null;
  const hits = raycaster.intersectObjects(ctx.beehiveHitMeshes, false);
  const hit = firstUnoccludedRayHit(ctx, hits, 5.5, { checkWalls: true });
  if (hit && hit.object && hit.object.userData && hit.object.userData.hiveObj) {
    const hive = hit.object.userData.hiveObj;
    if (hive.collected) return null;
    ctx.hoverHit = hit;
    return hive;
  }
  return null;
}

export function getBeehiveHoverPrompt(hive, held) {
  if (!hive || hive.collected) return '';
  if (hive.abandoned && hive.canCollectAbandoned) {
    return held
      ? '🪹 Colmeia Abandonada — Esvazie a mão para recolher'
      : '🪹 Colmeia Abandonada — Levar p/ Compostagem';
  }
  if (hive.migrating) return '🐝 Enxame migrando!';
  if (hive.buildProgress < 1.0) {
    return `🐝 Colmeia em construção (${Math.round(hive.buildProgress * 100)}%)`;
  }
  const honeyPct = Math.round(hive.honeyLevel || 0);
  if (honeyPct >= 35 && isHoneyContainer(held)) {
    return `🍯 Colher Mel Natural (Colmeia: ${honeyPct}%)`;
  }
  return `🐝 Colmeia (Mel: ${honeyPct}%)`;
}

function createAbandonedHiveCompostItem(ctx, hive) {
  const a = getBeeSharedAssets();
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), a.hiveAbandonedMat);
  box.position.y = 0.14;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.295, 0.06, 0.295), a.hiveAbandonedBandMat);
  band.position.y = 0.09;
  g.add(box, band);

  const itemId = 'compost_hive_' + (hive.id || '0') + '_' + Math.floor(performance.now());
  const item = registerPickable(
    ctx,
    itemId,
    '🪹 Colmeia Seca (Leve à Caixa de Substrato da Horta)',
    g,
    hive.x,
    hive.y,
    hive.z,
    0,
    0.18,
    0.28,
    {
      category: 'spent_substrate',
      purpose: 'Colmeia seca abandonada; excelente material orgânico para a Caixa de Substrato da Horta',
      weightGrams: 420,
      compatibilities: { canEnterCooker: false, isSpentMushroomCake: true }
    }
  );
  item.spentCakeCtrl = { speciesName: 'Colmeia Seca' };
  item.compostHiveCtrl = { hiveId: hive.id };
  return item;
}

export function getBeehiveInspectInfo(hive) {
  if (!hive) return null;
  const flowers = Array.isArray(hive.flowersNearby) ? hive.flowersNearby.filter((fl) => fl && !fl.removed) : [];
  const totalFlowers = flowers.length;
  let activeFlowers = 0;
  for (let i = 0; i < totalFlowers; i++) {
    if (flowers[i].stage === 'blooming' && flowers[i].pollen > 0.001) activeFlowers++;
  }
  const honeyPct = Math.round(hive.honeyLevel || 0);
  const buildPct = Math.round((hive.buildProgress || 0) * 100);
  let status = 'healthy';
  if (hive.abandoned) status = 'abandoned';
  else if (hive.migrating) status = 'migrating';
  else if (hive.buildProgress < 1.0) status = 'building';
  else if (activeFlowers === 0) status = 'starving';
  else if (activeFlowers < 3) status = 'surviving';
  return { honeyPct, activeFlowers, totalFlowers, status, buildPct };
}

export function interactBeehive(ctx, hive) {
  if (!ctx || !hive || hive.collected) return false;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  const held = ctx.heldItem;

  // 1. Recolher colmeia abandonada para compostagem na Horta
  if (hive.abandoned && hive.canCollectAbandoned) {
    if (held) {
      onToast?.('👐 Esvazie a mão para recolher a colmeia seca!');
      return true;
    }
    const item = createAbandonedHiveCompostItem(ctx, hive);
    hive.collected = true;
    hive.canCollectAbandoned = false;
    hive.group.visible = false;
    if (hive.hitMesh && hive.hitMesh.userData) hive.hitMesh.userData.ignoreRay = true;

    ctx.heldItem = item;
    ctx.lastPickupAt = performance.now();
    ctx.callbacks?.onHoldChange?.(item.label);
    onToast?.('🪹 Colmeia seca recolhida! Leve à Caixa de Substrato da Horta.');
    return true;
  }

  if (hive.migrating || hive.buildProgress < 1.0) {
    onToast?.('🐝 As abelhas ainda estão construindo esta colmeia!');
    return true;
  }

  // 2. Colheita de Mel Natural
  if ((hive.honeyLevel || 0) < 35) {
    onToast?.(`🐝 Colmeia com pouco mel (${Math.round(hive.honeyLevel || 0)}%). Aguarde as abelhas coletarem pólen!`);
    return true;
  }

  if (!isHoneyContainer(held)) {
    onToast?.('🍯 Segure um frasco de Cultura Líquida, Béquer, Nutriente CL ou Pote vazio para colher Mel!');
    return true;
  }

  if (held.lcNutrientCtrl) {
    const maxG = held.lcNutrientCtrl.maxGrams || 250;
    held.lcNutrientCtrl.remainingGrams = Math.min(maxG, (held.lcNutrientCtrl.remainingGrams || 0) + 50);
    updateLcNutrientLabel(held);
    ctx.callbacks?.onHoldChange?.(held.label);
    onToast?.('🍯 Mel Natural adicionado ao frasco de Nutriente CL! (+50g)');
  } else if (held.mesh && held.mesh.userData && held.mesh.userData.liquidCtrl && !held.spawnCtrl) {
    const lc = held.mesh.userData.liquidCtrl;
    const nextMl = Math.min(lc.maxMl || 800, (lc.volMl || 0) + 100);
    if (held.setVolume) held.setVolume(nextMl);
    else lc.volMl = nextMl;
    if (held.cultureCtrl) {
      held.cultureCtrl.hasNutrient = true;
      if (!held.cultureCtrl.contaminated && !held.cultureCtrl.colonized && lc.liqMesh?.material?.color) {
        lc.liqMesh.material.color.setHex(0xf59e0b);
      }
      updateCultureLiquidLabel(held);
    } else {
      held.label = `${lc.baseLabel || 'Recipiente'} (${Math.round(lc.volMl)}ml • 🍯 Mel Natural)`;
    }
    ctx.callbacks?.onHoldChange?.(held.label);
    onToast?.('🍯 Mel Natural colhido! (+100ml de nutriente pronto para Cultura Líquida)');
  } else if (held.spawnCtrl && !held.spawnCtrl.filled && !held.spawnCtrl.isBag) {
    held.lcNutrientCtrl = { remainingGrams: 120, maxGrams: 250, isNaturalHoney: true };
    held.label = '🍯 Pote com Mel Natural (120g • Nutriente CL 4%)';
    if (held.mesh && held.mesh.userData) {
      held.mesh.userData.isLcNutrientBottle = true;
      held.mesh.userData.pickableLabel = held.label;
    }
    ctx.callbacks?.onHoldChange?.(held.label);
    onToast?.('🍯 Pote de vidro preenchido com Mel Natural! (Nutriente CL 4%)');
  }

  hive.honeyLevel = Math.max(0, (hive.honeyLevel || 0) - 35);
  triggerCozyHeartBurst(hive.x, hive.y + 0.35, hive.z, 0xfacc15);
  return true;
}

// ============================================================================
// FLORES SILVESTRES, INSPEÇÃO DE PÓLEN, SEMENTES E PLANTIO
// ============================================================================
export function updateFlowerSeedLabel(item) {
  if (!item || !item.flowerSeedCtrl) return;
  const count = Math.max(0, Math.round(item.flowerSeedCtrl.count || 0));
  item.label = `🌱 Sementes de Flor (${count} un.)`;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function makeFlowerSeedPacket(ctx, id, x, y, z, opts = {}) {
  const count = Math.max(1, Math.min(20, opts.count ?? 5));
  const meta = {
    category: 'gardening',
    purpose: 'Pacote de sementes de flores silvestres; mire na grama natural para plantar e alimentar abelhas.',
    compatibilities: { canEnterCooker: false },
    serializeState: (it) => ({
      flowerSeeds: it && it.flowerSeedCtrl ? Math.max(0, Math.round(it.flowerSeedCtrl.count || 0)) : 0
    }),
    applyState: (it, custom) => {
      if (!it || !custom || typeof custom.flowerSeeds !== 'number') return;
      it.flowerSeedCtrl = it.flowerSeedCtrl || { count: 5, maxCount: 20 };
      it.flowerSeedCtrl.count = Math.max(1, Math.min(20, Math.round(custom.flowerSeeds)));
      updateFlowerSeedLabel(it);
    }
  };

  if (!THREE || !THREE.Group || !THREE.MeshStandardMaterial) {
    const mockItem = {
      id,
      label: `🌱 Sementes de Flor (${count} un.)`,
      flowerSeedCtrl: { count, maxCount: 20 },
      mesh: {
        position: { x, y, z, set() {} },
        userData: { isFlowerSeedPacket: true }
      },
      meta
    };
    if (ctx && Array.isArray(ctx.pickableItems)) ctx.pickableItems.push(mockItem);
    return mockItem;
  }

  const a = getBeeSharedAssets();
  const g = new THREE.Group();

  const body = new THREE.Mesh(a.seedPackBodyGeo, a.seedPackBodyMat);
  body.position.y = 0.075;
  const trim = new THREE.Mesh(a.seedPackTrimGeo, a.seedPackTrimMat);
  trim.position.y = 0.132;

  const emblemCenter = new THREE.Mesh(a.centerGeo, a.flowerCenterMat);
  emblemCenter.scale.setScalar(0.32);
  emblemCenter.position.set(0, 0.068, 0.015);
  const emblemMat = a.petalMats[(opts.colorIdx || 0) % a.petalMats.length];
  for (let p = 0; p < 5; p++) {
    const ang = (p / 5) * Math.PI * 2;
    const ep = new THREE.Mesh(a.petalGeo, emblemMat);
    ep.scale.set(0.32, 0.32, 0.18);
    ep.position.set(Math.cos(ang) * 0.019, 0.068 + Math.sin(ang) * 0.019, 0.014);
    g.add(ep);
  }

  g.add(body, trim, emblemCenter);
  g.userData.isFlowerSeedPacket = true;
  markSubtreeDynamic(g);

  const label = `🌱 Sementes de Flor (${count} un.)`;
  const item = registerPickable(ctx, id, label, g, x, y, z, opts.ry || 0, 0.08, 0.15, meta);
  item.flowerSeedCtrl = { count, maxCount: 20 };
  updateFlowerSeedLabel(item);
  return item;
}

export function findHoveredFlower(raycaster, ctx) {
  if (!raycaster || !ctx || !ctx.flowerHitMeshes || !ctx.flowerHitMeshes.length) return null;
  const hits = raycaster.intersectObjects(ctx.flowerHitMeshes, false);
  const hit = firstUnoccludedRayHit(ctx, hits, 4.2, { checkWalls: true });
  if (hit && hit.object && hit.object.userData && hit.object.userData.flowerObj) {
    const fl = hit.object.userData.flowerObj;
    if (fl.removed || fl.stage === 'wilting') return null;
    ctx.hoverHit = hit;
    return fl;
  }
  return null;
}

export function getFlowerHoverPrompt(fl, held) {
  if (!fl || fl.removed) return '';
  if (fl.stage === 'seeding' && !fl.seedHarvested) {
    if (!held || held.flowerSeedCtrl) {
      return '🌾 Flor (Semente Pronta!) — Colher Semente';
    }
    return '🌾 Flor (Semente Pronta!) — Esvazie a mão para colher';
  }
  if (fl.stage === 'sprouting') {
    const pct = Math.max(0, Math.min(100, Math.round((fl.stageTimer / (fl.sproutDuration || 18)) * 100)));
    return `🌱 Broto de Flor (${pct}%)`;
  }
  const pollenPct = Math.max(0, Math.min(100, Math.round((fl.pollen || 0) * 100)));
  return `🌸 Flor Silvestre (Pólen: ${pollenPct}%)`;
}

export function getFlowerInspectInfo(fl) {
  if (!fl || fl.removed) return null;
  const pollenPct = Math.max(0, Math.min(100, Math.round((fl.pollen || 0) * 100)));
  const growthPct = fl.stage === 'sprouting'
    ? Math.max(0, Math.min(100, Math.round((fl.stageTimer / (fl.sproutDuration || 18)) * 100)))
    : 100;
  const seedTimeLeftSec = fl.stage === 'seeding'
    ? Math.max(0, Math.ceil((fl.seedHoldDuration || 25) - (fl.stageTimer || 0)))
    : 0;
  const colorName = FLOWER_COLOR_NAMES[fl.colorIdx] || 'Silvestre';
  return {
    stage: fl.stage,
    pollenPct,
    growthPct,
    seedTimeLeftSec,
    colorName,
    seedHarvested: !!fl.seedHarvested
  };
}

export function interactFlower(ctx, fl) {
  if (!ctx || !fl || fl.removed) return false;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  const held = ctx.heldItem;
  const win = typeof window !== 'undefined' ? window : null;

  if (fl.stage === 'seeding' && !fl.seedHarvested) {
    if (held && !held.flowerSeedCtrl) {
      onToast?.('👐 Esvazie a mão ou segure Sementes de Flor para colher esta semente!');
      return true;
    }

    if (held && held.flowerSeedCtrl) {
      const maxC = held.flowerSeedCtrl.maxCount || 20;
      if ((held.flowerSeedCtrl.count || 0) >= maxC) {
        onToast?.('🎒 Seu pacote de sementes já está cheio (20 un.)!');
        return true;
      }
      held.flowerSeedCtrl.count = Math.min(maxC, (held.flowerSeedCtrl.count || 0) + 1);
      updateFlowerSeedLabel(held);
      ctx.callbacks?.onHoldChange?.(held.label);
      ctx.markItemMoved?.(held);
      ctx.notifyWorldAction?.();
    } else {
      const id = 'dyn_flower_seeds_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 999);
      const item = makeFlowerSeedPacket(ctx, id, fl.x, fl.y, fl.z, { count: 1, colorIdx: fl.colorIdx });
      item.isMoved = true;
      ctx.heldItem = item;
      ctx.lastPickupAt = performance.now();
      ctx.callbacks?.onHoldChange?.(item.label);
      ctx.markItemMoved?.(item);
      ctx.notifyWorldAction?.();
    }

    fl.seedHarvested = true;
    if (fl.seedPodMesh) fl.seedPodMesh.visible = false;
    fl.stage = 'wilting';
    fl.stageTimer = 0;
    if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: fl.x, y: fl.y, z: fl.z }, 0x4ade80, 6);
    if (win && win.MycoAudio) win.MycoAudio.playClick();
    onToast?.('🌾 Semente colhida! Esta flor não vai se espalhar e vai murchar.');
    return true;
  }

  if (fl.stage === 'sprouting') {
    const pct = Math.max(0, Math.min(100, Math.round((fl.stageTimer / (fl.sproutDuration || 18)) * 100)));
    onToast?.(`🌱 Broto de Flor crescendo (${pct}%). Em breve atrairá as abelhas!`);
    return true;
  }

  if (fl.stage === 'blooming') {
    const pollenPct = Math.max(0, Math.min(100, Math.round((fl.pollen || 0) * 100)));
    onToast?.(`🌸 Flor Silvestre (${pollenPct}% de pólen • pressione F para inspecionar).`);
    return true;
  }

  return true;
}

export function findFlowerPlantSpot(raycaster, ctx) {
  if (!raycaster || !raycaster.ray) return null;
  const ro = raycaster.ray.origin;
  const rd = raycaster.ray.direction;
  if (!ro || !rd || rd.y >= -0.05) return null;

  let t = (terrainHeight(ro.x, ro.z) - ro.y) / rd.y;
  if (!Number.isFinite(t) || t < 0.45 || t > 5.2) return null;

  let x = ro.x + rd.x * t;
  let z = ro.z + rd.z * t;
  const gy = terrainHeight(x, z);
  const t2 = (gy - ro.y) / rd.y;
  if (Number.isFinite(t2) && t2 >= 0.45 && t2 <= 5.2) {
    t = t2;
    x = ro.x + rd.x * t;
    z = ro.z + rd.z * t;
  }
  const finalY = terrainHeight(x, z);

  if (ctx && isRayOccludedByStructure(ctx, t, { checkWalls: true })) return null;
  if (!isNaturalSoilSpot(x, z, 0.55) || isBlockedAt(ctx || {}, x, z, 0.45)) return null;
  if (ctx && ctx.campusFlowers) {
    for (let i = 0; i < ctx.campusFlowers.length; i++) {
      const fl = ctx.campusFlowers[i];
      if (fl && !fl.removed && Math.hypot(fl.x - x, fl.z - z) < 0.45) return null;
    }
  }

  if (_flowerPlantHit.point.set) _flowerPlantHit.point.set(x, finalY, z);
  else {
    _flowerPlantHit.point.x = x;
    _flowerPlantHit.point.y = finalY;
    _flowerPlantHit.point.z = z;
  }
  _flowerPlantHit.distance = t;
  if (ctx) ctx.hoverHit = _flowerPlantHit;
  return { x, y: finalY, z, distance: t };
}

export function getFlowerPlantHoverPrompt(held) {
  const count = held && held.flowerSeedCtrl ? Math.max(0, Math.round(held.flowerSeedCtrl.count || 0)) : 0;
  return `🌱 Plantar Semente de Flor aqui (${count} un.)`;
}

export function plantFlowerSeedAtSpot(ctx, spot) {
  if (!ctx || !spot || !ctx.heldItem || !ctx.heldItem.flowerSeedCtrl) return false;
  const held = ctx.heldItem;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;
  const win = typeof window !== 'undefined' ? window : null;

  if ((held.flowerSeedCtrl.count || 0) <= 0) return false;
  if (!Array.isArray(ctx.campusFlowers)) ctx.campusFlowers = [];
  if (ctx.campusFlowers.length >= MAX_CAMPUS_FLOWERS) {
    onToast?.('🌸 O campus já está cheio de flores! Aguarde algumas murcharem.');
    return true;
  }

  const colorIdx = Math.floor(Math.random() * FLOWER_COLORS.length);
  const sprout = createCampusFlower(ctx, spot.x, spot.z, colorIdx, {
    stage: 'sprouting',
    sproutDuration: 10 + Math.random() * 14
  });
  ctx.campusFlowers.push(sprout);
  refreshAllHiveFlowers(ctx);
  if (ctx.scene) spawnCampusFxBurst(ctx.scene, { x: spot.x, y: spot.y + 0.15, z: spot.z }, 0x4ade80, 6);
  if (win && win.MycoAudio) win.MycoAudio.playClick();

  held.flowerSeedCtrl.count = Math.max(0, (held.flowerSeedCtrl.count || 0) - 1);
  if (held.flowerSeedCtrl.count <= 0) {
    held._removedForSync = true;
    if (ctx.pendingMovedItems && held.id) {
      ctx.pendingMovedItems[held.id] = {
        id: held.id,
        state: { custom: { dynamicKind: 'flower_seeds', removed: true } }
      };
    }
    if (held.mesh && held.mesh.parent) held.mesh.parent.remove(held.mesh);
    if (THREE && THREE.Object3D && typeof disposeObjectResources === 'function') {
      try { disposeObjectResources(held.mesh); } catch (_) {}
    }
    if (Array.isArray(ctx.pickableItems)) {
      const idx = ctx.pickableItems.indexOf(held);
      if (idx !== -1) ctx.pickableItems.splice(idx, 1);
    }
    if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
      ctx.pickableMap.delete(held.id);
    }
    ctx.heldItem = null;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    ctx.callbacks?.onHoldChange?.(null);
    ctx.notifyWorldAction?.();
    onToast?.('🌸 Última semente plantada! A flor vai brotar em breve.');
  } else {
    updateFlowerSeedLabel(held);
    ctx.callbacks?.onHoldChange?.(held.label);
    ctx.markItemMoved?.(held);
    ctx.notifyWorldAction?.();
    onToast?.(`🌱 Semente de flor plantada! (${held.flowerSeedCtrl.count} restantes)`);
  }
  return true;
}
