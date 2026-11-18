/**
 * Armários e Gavetas das Bancadas do Laboratório (MycoCampus3D)
 * - Armário de 2 alturas (portas de vidro) com prateleira interna.
 * - Armário de espaço grande (portas inox) sem divisória, para itens maiores.
 * - Gaveteiros pequenos (bisturis, talheres) com animação de abrir/fechar.
 * As prateleiras internas são superfícies de apoio: itens podem ser guardados com a porta aberta,
 * e ficam inacessíveis enquanto a porta estiver fechada.
 */

const THREE = window.THREE;

const BODY_BOTTOM = 0.14;
const BODY_TOP = 0.96;
const FLOOR_TOP = 0.245;
const MID_SHELF_TOP = 0.60;
const DOOR_BOTTOM = 0.25;
const DOOR_TOP = 0.95;
const DOOR_ANGLE = 1.55;
const DRAWER_TRAVEL = 0.42;

function addBox(parent, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function makeMaterials() {
  return {
    carcass: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5, metalness: 0.1 }),
    inside: new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.65 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.26 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.2 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 }),
    handle: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.18 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x7dd3fc, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide
    }),
    darkGlass: new THREE.MeshStandardMaterial({
      color: 0x0f172a, transparent: true, opacity: 0.42, roughness: 0.08, metalness: 0.15, depthWrite: false, side: THREE.DoubleSide
    })
  };
}

function makeDoorPanel(mats, wd, glass) {
  const g = new THREE.Group();
  const hh = DOOR_TOP - DOOR_BOTTOM;
  const fw = 0.035;
  addBox(g, wd, fw, 0.02, mats.steel, 0, hh / 2 - fw / 2, 0);
  addBox(g, wd, fw, 0.02, mats.steel, 0, -hh / 2 + fw / 2, 0);
  addBox(g, fw, hh, 0.02, mats.steel, -wd / 2 + fw / 2, 0, 0);
  addBox(g, fw, hh, 0.02, mats.steel, wd / 2 - fw / 2, 0, 0);
  // Porta escura agora usa vidro fumê transparente para ver os itens dentro do armário
  const paneMat = glass ? mats.glass : mats.darkGlass;
  const pane = addBox(g, wd - fw * 2, hh - fw * 2, 0.006, paneMat, 0, 0, 0);
  pane.userData.ignoreRay = true;
  return g;
}

/**
 * Constrói os armários ao longo da frente de uma bancada.
 * cfg: { id, bx, bz, bw, bd, face: 'x+' | 'z+', latMin, latMax }
 * latMin/latMax: intervalo lateral (coordenada local) coberto por módulos; o restante vira painel fechado.
 */
export function buildBenchCabinets(ctx, cfg) {
  const mats = makeMaterials();
  const isX = cfg.face === 'x+';
  const rotY = isX ? Math.PI / 2 : 0;
  const L = isX ? cfg.bd : cfg.bw;
  const D = isX ? cfg.bw : cfg.bd;
  const fx = isX ? cfg.bx + cfg.bw / 2 : cfg.bx;
  const fz = isX ? cfg.bz : cfg.bz + cfg.bd / 2;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);

  if (!ctx.labCabinets) ctx.labCabinets = [];
  if (!ctx.cabinetHitMeshes) ctx.cabinetHitMeshes = [];
  if (!ctx.cabinetLedMats) ctx.cabinetLedMats = [];

  const ledStripMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe, emissive: 0x7dd3fc, emissiveIntensity: 1.35, roughness: 0.2
  });
  ctx.cabinetLedMats.push(ledStripMat);

  const root = new THREE.Group();
  root.position.set(fx, 0, fz);
  root.rotation.y = rotY;
  ctx.scene.add(root);

  function toWorld(lx, lz) {
    return { x: fx + lx * cos + lz * sin, z: fz - lx * sin + lz * cos };
  }

  const latMin = typeof cfg.latMin === 'number' ? cfg.latMin : -L / 2;
  const latMax = typeof cfg.latMax === 'number' ? cfg.latMax : L / 2;
  const span = latMax - latMin;
  const count = Math.max(1, Math.round(span / 0.95));
  const w = span / count;

  // Carcaça base
  const bodyH = BODY_TOP - BODY_BOTTOM;
  addBox(root, L, BODY_TOP - 0.22, 0.02, mats.carcass, 0, (BODY_TOP + 0.22) / 2, -D + 0.01);
  addBox(root, L, 0.08, 0.04, mats.blue, 0, BODY_BOTTOM + 0.04, -0.07);
  addBox(root, L, 0.04, 0.03, mats.steel, 0, BODY_TOP - 0.02, -0.015);
  addBox(root, 0.02, bodyH, D - 0.02, mats.carcass, -L / 2 + 0.01, (BODY_TOP + BODY_BOTTOM) / 2, -D / 2);
  addBox(root, 0.02, bodyH, D - 0.02, mats.carcass, L / 2 - 0.01, (BODY_TOP + BODY_BOTTOM) / 2, -D / 2);

  // Trechos fora dos módulos (ex.: encontro com outra bancada): painel fechado
  [[-L / 2, latMin], [latMax, L / 2]].forEach(function (seg) {
    const sw = seg[1] - seg[0];
    if (sw > 0.03) {
      addBox(root, sw, bodyH, D - 0.02, mats.carcass, (seg[0] + seg[1]) / 2, (BODY_TOP + BODY_BOTTOM) / 2, -D / 2);
      addBox(root, sw, 0.08, 0.04, mats.blue, (seg[0] + seg[1]) / 2, BODY_BOTTOM + 0.04, 0.0);
    }
  });

  // Divisórias verticais entre módulos
  for (let bi = 0; bi <= count; bi++) {
    addBox(root, 0.02, bodyH, D - 0.02, mats.carcass, latMin + bi * w, (BODY_TOP + BODY_BOTTOM) / 2, -D / 2);
  }

  const typeCycle = ['shelfDoors', 'bigDoor', 'drawers'];

  function updateSurfBounds(surf, lx0, lx1, zA, zB) {
    const c1 = toWorld(lx0, zA);
    const c2 = toWorld(lx1, zA);
    const c3 = toWorld(lx0, zB);
    const c4 = toWorld(lx1, zB);
    surf.minX = Math.min(c1.x, c2.x, c3.x, c4.x);
    surf.maxX = Math.max(c1.x, c2.x, c3.x, c4.x);
    surf.minZ = Math.min(c1.z, c2.z, c3.z, c4.z);
    surf.maxZ = Math.max(c1.z, c2.z, c3.z, c4.z);
  }

  function registerShelf(part, mesh, lx0, lx1, topY, zA, zB) {
    const za = typeof zA === 'number' ? zA : -D + 0.05;
    const zb = typeof zB === 'number' ? zB : -0.04;
    const surf = {
      minX: 0, maxX: 0, minZ: 0, maxZ: 0,
      topY,
      isCabinetShelf: true,
      requiresOpenPart: part
    };
    updateSurfBounds(surf, lx0, lx1, za, zb);
    ctx.supportSurfaces.push(surf);
    mesh.userData.supportSurface = surf;
    ctx.supportMeshes.push(mesh);
    part.shelves.push(surf);
    return surf;
  }

  for (let mi = 0; mi < count; mi++) {
    const lc = latMin + (mi + 0.5) * w;
    const type = typeCycle[mi % typeCycle.length];
    const key = cfg.id + mi;

    if (type === 'drawers') {
      const drawerCount = 4;
      const slotH = (DOOR_TOP - DOOR_BOTTOM) / drawerCount;
      for (let di = 0; di < drawerCount; di++) {
        const yC = DOOR_BOTTOM + slotH * (di + 0.5);
        const dg = new THREE.Group();
        dg.position.set(lc, yC, 0);
        root.add(dg);
        const faceW = w - 0.03;
        addBox(dg, faceW, slotH - 0.012, 0.025, mats.steel, 0, 0, 0.0125);
        addBox(dg, 0.22, 0.014, 0.022, mats.handle, 0, 0, 0.036);
        const trayW = w - 0.07;
        const trayLen = Math.min(0.55, D - 0.12);
        const trayBottom = addBox(dg, trayW, 0.008, trayLen, mats.inside, 0, -slotH / 2 + 0.03, -trayLen / 2);
        addBox(dg, 0.008, slotH - 0.07, trayLen, mats.inside, -trayW / 2, -0.005, -trayLen / 2);
        addBox(dg, 0.008, slotH - 0.07, trayLen, mats.inside, trayW / 2, -0.005, -trayLen / 2);
        addBox(dg, trayW, slotH - 0.07, 0.008, mats.inside, 0, -0.005, -trayLen);
        if (di === 0 || di === 2) {
          // Tapete azul organizador para bisturis e lâminas reais
          addBox(dg, trayW - 0.04, 0.012, 0.32, mats.blue, 0, -slotH / 2 + 0.04, -0.2);
        }
        let drawerSurf = null;
        const dPart = {
          id: 'cab_' + key + '_d' + di,
          kind: 'drawer',
          label: di % 2 === 0 ? 'Gaveta de Bisturis e Talheres' : 'Gaveta de Utensílios',
          open: false,
          progress: 0,
          shelves: [],
          apply: function (p) {
            const nextZ = DRAWER_TRAVEL * smooth(p);
            const dz = nextZ - dg.position.z;
            dg.position.z = nextZ;
            if (drawerSurf) {
              if (Math.abs(dz) > 1e-5 && ctx.pickableItems) {
                const wx = dz * sin;
                const wz = dz * cos;
                for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
                  const it = ctx.pickableItems[pi];
                  if (!it || !it.mesh || it === ctx.heldItem) continue;
                  const ip = it.mesh.position;
                  if (ip.x >= drawerSurf.minX - 0.04 && ip.x <= drawerSurf.maxX + 0.04 &&
                      ip.z >= drawerSurf.minZ - 0.04 && ip.z <= drawerSurf.maxZ + 0.04 &&
                      Math.abs(ip.y - drawerSurf.topY) < 0.06) {
                    ip.x += wx;
                    ip.z += wz;
                  }
                }
              }
              updateSurfBounds(drawerSurf, lc - trayW / 2, lc + trayW / 2, -trayLen + nextZ, -0.02 + nextZ);
            }
          }
        };
        const shelfTopOffset = (di === 0 || di === 2) ? 0.046 : 0.035;
        drawerSurf = registerShelf(dPart, trayBottom, lc - trayW / 2, lc + trayW / 2, yC - slotH / 2 + shelfTopOffset, -trayLen, -0.02);
        const hit = new THREE.Mesh(
          new THREE.BoxGeometry(faceW, slotH, 0.12),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        hit.position.set(0, 0, 0.03);
        hit.userData.cabinetPart = dPart;
        dg.add(hit);
        ctx.cabinetHitMeshes.push(hit);
        ctx.labCabinets.push(dPart);
      }
      continue;
    }

    // Fita de LED na parte superior no fundo interno do armário
    addBox(root, w - 0.14, 0.014, 0.018, ledStripMat, lc, DOOR_TOP - 0.035, -D + 0.06);

    // Piso do módulo (prateleira inferior)
    const part = {
      id: 'cab_' + key,
      kind: 'doors',
      label: type === 'shelfDoors' ? 'Armário de 2 Alturas' : 'Armário de Espaço Grande',
      open: false,
      progress: 0,
      shelves: [],
      pivots: [],
      apply: function (p) {
        const e = smooth(p) * DOOR_ANGLE;
        for (let pi = 0; pi < part.pivots.length; pi++) {
          part.pivots[pi].pivot.rotation.y = part.pivots[pi].dir * e;
        }
      }
    };

    const floor = addBox(root, w - 0.03, 0.02, D - 0.05, mats.inside, lc, FLOOR_TOP - 0.01, -D / 2 - 0.005);
    registerShelf(part, floor, lc - w / 2 + 0.02, lc + w / 2 - 0.02, FLOOR_TOP);

    if (type === 'shelfDoors') {
      const shelf = addBox(root, w - 0.03, 0.02, D - 0.05, mats.inside, lc, MID_SHELF_TOP - 0.01, -D / 2 - 0.005);
      registerShelf(part, shelf, lc - w / 2 + 0.02, lc + w / 2 - 0.02, MID_SHELF_TOP);
    }

    const glass = type === 'shelfDoors';
    const wd = (w - 0.03) / 2;
    const doorMidY = (DOOR_BOTTOM + DOOR_TOP) / 2;
    [-1, 1].forEach(function (side) {
      const pivot = new THREE.Group();
      pivot.position.set(lc + side * (w / 2 - 0.013), doorMidY, 0.012);
      root.add(pivot);
      const panel = makeDoorPanel(mats, wd, glass);
      panel.position.x = -side * wd / 2;
      pivot.add(panel);
      // Puxador na borda livre
      addBox(panel, 0.014, 0.20, 0.022, mats.handle, -side * (wd / 2 - 0.04), 0, 0.024);
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(wd, DOOR_TOP - DOOR_BOTTOM, 0.12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.position.set(0, 0, 0.03);
      hit.userData.cabinetPart = part;
      panel.add(hit);
      ctx.cabinetHitMeshes.push(hit);
      part.pivots.push({ pivot, dir: side < 0 ? -1 : 1 });
    });
    ctx.labCabinets.push(part);
  }
}

export function stepLabCabinets(ctx, dt) {
  const parts = ctx.labCabinets;
  if (!parts || !parts.length) return;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const target = part.open ? 1 : 0;
    if (part.progress === target) continue;
    const delta = target - part.progress;
    const step = dt * 3.4;
    part.progress = Math.abs(delta) <= step ? target : part.progress + Math.sign(delta) * step;
    part.apply(part.progress);
  }
}

export function toggleCabinetPart(ctx, part) {
  if (!part) return;
  part.open = !part.open;
  if (ctx.queueWorldStateChange) ctx.queueWorldStateChange(part.id, part.open ? 1 : 0);
  if (window.MycoAudio && window.MycoAudio.playDoor) window.MycoAudio.playDoor(part.open);
}

/**
 * Cria um interruptor na parede do laboratório para ligar/desligar a fita de LED
 * dos armários e uma luminária LED acima da bancada principal.
 */
export function buildBenchLedSwitch(ctx, sx, sy, sz, benchX, benchZ) {
  if (!THREE || !ctx || !ctx.scene) return null;
  const swGroup = new THREE.Group();
  swGroup.position.set(sx, sy, sz);
  swGroup.rotation.y = Math.PI / 2;

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.16, 0.025),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 })
  );
  const rocker = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.075, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35 })
  );
  rocker.position.set(0, 0, 0.016);
  rocker.rotation.x = -0.22;
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), ledMat);
  led.position.set(0, 0.055, 0.016);
  swGroup.add(plate, rocker, led);
  ctx.scene.add(swGroup);

  // Luminária LED grudada na parede ao longo da bancada
  const lampGroup = new THREE.Group();
  lampGroup.position.set(sx + 0.06, 2.55, benchZ);
  lampGroup.rotation.y = Math.PI / 2;
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xe0f2fe, emissiveIntensity: 0.95, roughness: 0.2
  });
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.05, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
  );
  const tube = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.03, 0.09), tubeMat);
  tube.position.y = -0.025;
  lampGroup.add(housing, tube);
  ctx.scene.add(lampGroup);

  const benchLight = new THREE.PointLight(0xe0f2fe, 1.35, 9.0, 1.6);
  benchLight.position.set(benchX, 2.52, benchZ);
  ctx.scene.add(benchLight);

  const swObj = {
    id: 'light_6',
    on: true,
    light: benchLight,
    tubeMat,
    ledMat,
    rocker,
    onToggle: (isOn) => {
      if (ctx.cabinetLedMats) {
        ctx.cabinetLedMats.forEach((m) => {
          m.emissiveIntensity = isOn ? 1.35 : 0.03;
          m.color.setHex(isOn ? 0xe0f2fe : 0x334155);
        });
      }
    }
  };
  plate.userData.lightSwitch = swObj;
  rocker.userData.lightSwitch = swObj;
  if (ctx.lightSwitchMeshes) ctx.lightSwitchMeshes.push(plate, rocker);
  return swObj;
}

/** Verdadeiro se o item está guardado dentro de um armário com a porta fechada. */
export function isItemInClosedCabinet(ctx, item) {
  const parts = ctx.labCabinets;
  if (!parts || !parts.length || !item || !item.mesh) return false;
  const p = item.mesh.position;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.open || !part.shelves.length) continue;
    const maxShelfH = part.kind === 'drawer' ? 0.15 : 0.34;
    for (let si = 0; si < part.shelves.length; si++) {
      const s = part.shelves[si];
      if (p.x >= s.minX - 0.03 && p.x <= s.maxX + 0.03 && p.z >= s.minZ - 0.03 && p.z <= s.maxZ + 0.03 &&
          p.y >= s.topY - 0.03 && p.y <= s.topY + maxShelfH) {
        return true;
      }
    }
  }
  return false;
}

export function applyCabinetStates(ctx, stateMap, now, isInitial) {
  const parts = ctx.labCabinets;
  if (!parts || !parts.length) return;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const raw = stateMap[part.id];
    if (raw === undefined) continue;
    if (ctx.pendingStateChanges[part.id] !== undefined || ctx.recentlyChangedState[part.id] > now) continue;
    const want = Number(raw) === 1;
    if (part.open !== want) {
      part.open = want;
      if (isInitial) {
        part.progress = want ? 1 : 0;
        part.apply(part.progress);
      }
    }
  }
}
