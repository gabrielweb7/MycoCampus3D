/**
 * Pasto com Vaquinhas Fofinhas Animadas, Cocôs com Mosquinhas e Psilocybe cubensis Dourados (MycoCampus3D)
 * - Vaquinhas andam pelo pasto e soltam cocô a cada 30 segundos.
 * - Mosquinhas orbitam em cima do cocô.
 * - Após 60 segundos, nascem cubensis dourados colhíveis direto do cocô.
 */

import { terrainHeight } from '../engine/physics.js';

const THREE = window.THREE;

export const COW_POOP_INTERVAL_SEC = 30;
export const POOP_CUBENSIS_GROW_SEC = 60;
export const MAX_ACTIVE_POOPS = 18;

const PASTURE_BOUNDS = { minX: 38, maxX: 68, minZ: 16, maxZ: 44 };

function createCuteCowMesh(variant) {
  const g = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
  const spotMat = new THREE.MeshStandardMaterial({ color: variant % 2 === 0 ? 0x1e293b : 0x78350f, roughness: 0.78 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
  const hoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

  // Corpo fofinho arredondado
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 1.02), whiteMat);
  body.position.set(0, 0.56, 0);
  g.add(body);

  // Manchas fofinhas
  const spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.28, 0.36), spotMat);
  spot1.position.set(0, 0.64, -0.14);
  const spot2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.34), spotMat);
  spot2.position.set(0.18, 0.54, 0.28);
  g.add(spot1, spot2);

  // Cabeça fofa + focinho rosado
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

  // 4 patinhas animáveis
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

  // Rabinho
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.34, 6), spotMat);
  tail.position.set(0, 0.58, -0.56);
  tail.rotation.x = 0.35;
  g.add(tail);

  return { group: g, head, legs, tail };
}

function createPoopWithFliesAndCubensis(x, y, z, poopId) {
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

  // Mosquinhas voando!
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

  // Grupo dos Cubensis Dourados (cresce após 60s)
  const cubensisGroup = new THREE.Group();
  cubensisGroup.visible = false;
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.65 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.42 });
  const caps = [];
  [[0, 0, 1.0], [-0.08, 0.06, 0.78], [0.09, -0.05, 0.85]].forEach((off) => {
    const mg = new THREE.Group();
    mg.position.set(off[0], 0.12, off[1]);
    mg.scale.setScalar(off[2]);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.18, 7), stemMat);
    st.position.y = 0.09;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), capMat);
    cap.position.y = 0.17;
    cap.userData.wildMushId = poopId;
    cap.userData.speciesName = 'Cubensis Dourado do Pasto (Psilocybe cubensis)';
    mg.add(st, cap);
    cubensisGroup.add(mg);
    caps.push(cap);
  });
  g.add(cubensisGroup);

  return { group: g, flies, cubensisGroup, caps };
}

export function createPastureAndCows(ctx) {
  if (!THREE || !ctx || !ctx.scene) return;
  ctx.pastureCows = [];
  ctx.cowPoops = [];

  for (let i = 0; i < 6; i++) {
    const cx = PASTURE_BOUNDS.minX + 4 + (i % 3) * 9;
    const cz = PASTURE_BOUNDS.minZ + 5 + Math.floor(i / 3) * 12;
    const cy = terrainHeight(cx, cz);
    const cow = createCuteCowMesh(i);
    cow.group.position.set(cx, cy, cz);
    cow.group.rotation.y = i * 1.1;
    ctx.scene.add(cow.group);

    ctx.pastureCows.push({
      id: 'cow_' + i,
      mesh: cow.group,
      head: cow.head,
      legs: cow.legs,
      tail: cow.tail,
      yaw: i * 1.1,
      speed: 0.9 + (i % 3) * 0.25,
      turnTimer: 2 + i * 0.7,
      poopTimer: 5 + i * 4.5, // escalonado inicialmente, depois a cada 30s
      walkPhase: i * 1.3
    });
  }
}

export function stepPastureCows(ctx, dt) {
  if (!ctx || !ctx.pastureCows) return;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;

  // Anima vaquinhas
  for (let i = 0; i < ctx.pastureCows.length; i++) {
    const cow = ctx.pastureCows[i];
    const distSq = (cow.mesh.position.x - px) ** 2 + (cow.mesh.position.z - pz) ** 2;
    cow.mesh.visible = distSq <= 75 * 75;

    cow.turnTimer -= dt;
    if (cow.turnTimer <= 0) {
      cow.turnTimer = 3.5 + Math.random() * 4.5;
      cow.yaw += (Math.random() - 0.5) * 1.8;
    }

    let nx = cow.mesh.position.x + Math.sin(cow.yaw) * cow.speed * dt;
    let nz = cow.mesh.position.z + Math.cos(cow.yaw) * cow.speed * dt;
    if (nx < PASTURE_BOUNDS.minX || nx > PASTURE_BOUNDS.maxX) {
      cow.yaw = -cow.yaw;
      nx = Math.max(PASTURE_BOUNDS.minX, Math.min(PASTURE_BOUNDS.maxX, nx));
    }
    if (nz < PASTURE_BOUNDS.minZ || nz > PASTURE_BOUNDS.maxZ) {
      cow.yaw = Math.PI - cow.yaw;
      nz = Math.max(PASTURE_BOUNDS.minZ, Math.min(PASTURE_BOUNDS.maxZ, nz));
    }
    const ny = terrainHeight(nx, nz);
    cow.mesh.position.set(nx, ny, nz);
    cow.mesh.rotation.y = cow.yaw;

    // Animação fofa das patas, cabeça e rabinho
    if (cow.mesh.visible) {
      cow.walkPhase += dt * cow.speed * 5.2;
      const swing = Math.sin(cow.walkPhase) * 0.42;
      cow.legs[0].rotation.x = swing;
      cow.legs[3].rotation.x = swing;
      cow.legs[1].rotation.x = -swing;
      cow.legs[2].rotation.x = -swing;
      cow.head.rotation.x = 0.14 + Math.sin(cow.walkPhase * 0.4) * 0.10;
      cow.tail.rotation.z = Math.sin(cow.walkPhase * 1.5) * 0.25;
    }

    // Solta cocô a cada 30 segundos!
    cow.poopTimer += dt;
    if (cow.poopTimer >= COW_POOP_INTERVAL_SEC) {
      cow.poopTimer = 0;
      if (ctx.cowPoops.length >= MAX_ACTIVE_POOPS) {
        const oldest = ctx.cowPoops.shift();
        if (oldest && oldest.group && oldest.group.parent) oldest.group.parent.remove(oldest.group);
      }
      const poopId = 'wild_poop_' + Date.now().toString(36) + '_' + i;
      const poopVis = createPoopWithFliesAndCubensis(nx, ny, nz, poopId);
      ctx.scene.add(poopVis.group);
      const poopEntry = {
        id: poopId,
        group: poopVis.group,
        flies: poopVis.flies,
        cubensisGroup: poopVis.cubensisGroup,
        ageSec: 0,
        grown: false,
        wildEntry: {
          id: poopId,
          group: poopVis.cubensisGroup,
          capMesh: poopVis.caps[0],
          active: false,
          respawnAt: 0
        }
      };
      ctx.cowPoops.push(poopEntry);
    }
  }

  // Atualiza mosquinhas + nascimento dos Cubensis Dourados após 60s
  for (let pi = 0; pi < ctx.cowPoops.length; pi++) {
    const p = ctx.cowPoops[pi];
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
    }

    if (!p.grown) {
      p.ageSec += dt;
      if (p.ageSec >= POOP_CUBENSIS_GROW_SEC) {
        p.grown = true;
        p.cubensisGroup.visible = true;
        p.wildEntry.active = true;
        if (ctx.wildMushrooms) ctx.wildMushrooms.push(p.wildEntry);
      }
    }
  }
}
