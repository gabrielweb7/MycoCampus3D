/**
 * Melhorias da Casa da Vila: Painel na Parede, Persianas, Portas, Luzes e 2º Andar + Escada.
 */
import { makeBox } from '../engine/textures.js';
import { apiPost } from '../services/api-client.js';
import { appState } from '../core/state.js';

const THREE = window.THREE;

export const HOUSE_UPGRADES = [
  { id: 'house_lights', icon: '💡', name: 'Iluminação Interna', desc: 'Luminária central quente que ilumina toda a casa.', price: 60 },
  { id: 'garden_lights', icon: '🏮', name: 'Iluminação no Jardim', desc: 'Dois postes com lanternas aconchegantes no quintal.', price: 80 },
  { id: 'blinds', icon: '🪟', name: 'Persianas nas Janelas', desc: 'Persianas articuladas nas janelas da frente (fundo já incluso).', price: 50 },
  { id: 'front_door', icon: '🚪', name: 'Porta da Frente', desc: 'Porta articulada com maçaneta que abre e fecha.', price: 75 },
  { id: 'back_door', icon: '🚪', name: 'Porta dos Fundos', desc: 'Passagem direta para o quintal com porta articulada.', price: 110 },
  { id: 'second_floor', icon: '🪜', name: 'Segundo Andar + Escada', desc: 'Mezanino caminhável com guarda-corpo e escadinha.', price: 220 }
];

const lotHooks = new Map();
let currentModalLotId = null;
let fetchedOnce = false;

function createBlindGroup(parent, mats, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const slats = [];
  for (let i = 0; i < 6; i++) {
    const slat = makeBox(1.02, 0.11, 0.03, mats.wood, { noShadow: true });
    slat.position.set(0, 0.34 - i * 0.135, 0);
    slats.push(slat);
    g.add(slat);
  }
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.92, 0.22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  g.add(hit);
  parent.add(g);
  const ctrl = { group: g, slats, open: true };
  const apply = () => {
    for (let i = 0; i < slats.length; i++) {
      slats[i].rotation.x = ctrl.open ? 1.28 : 0.05;
      slats[i].position.y = ctrl.open ? (0.36 - i * 0.035) : (0.34 - i * 0.135);
    }
  };
  apply();
  hit.userData.houseAction = {
    label: () => (ctrl.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana'),
    run: () => { ctrl.open = !ctrl.open; apply(); window.MycoAudio?.playClick?.(); }
  };
  return { group: g, hit, ctrl };
}

function createHouseDoor(parent, mats, x, y, z, frontDir, width = 1.04) {
  const pivot = new THREE.Group();
  pivot.position.set(x - width / 2, y, z);
  const leaf = makeBox(width, 2.24, 0.08, mats.wood);
  leaf.position.set(width / 2, 0, 0);
  const knob = makeBox(0.08, 0.14, 0.14, mats.trim, { noShadow: true });
  knob.position.set(width - 0.14, -0.05, 0);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 2.26, 0.28), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(width / 2, 0, 0);
  pivot.add(leaf, knob, hit);
  parent.add(pivot);
  const state = { open: false };
  hit.userData.houseAction = {
    label: () => (state.open ? '🚪 Fechar Porta' : '🚪 Abrir Porta'),
    run: () => {
      state.open = !state.open;
      pivot.rotation.y = state.open ? (frontDir * Math.PI * 0.48) : 0;
      window.MycoAudio?.playDoor?.();
    }
  };
  return { pivot, hit };
}

function createWallMenuPanel(parent, mats, x, y, z, rotY, lotId) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const frame = makeBox(0.76, 0.54, 0.06, mats.trim);
  let screenMat;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 176;
    const tx = c.getContext('2d');
    tx.fillStyle = '#0f172a';
    tx.fillRect(0, 0, 256, 176);
    tx.strokeStyle = '#38bdf8';
    tx.lineWidth = 6;
    tx.strokeRect(8, 8, 240, 160);
    tx.fillStyle = '#f8fafc';
    tx.font = 'bold 26px system-ui';
    tx.textAlign = 'center';
    tx.fillText('🏡 PAINEL DA CASA', 128, 56);
    tx.fillStyle = '#94a3b8';
    tx.font = '18px system-ui';
    tx.fillText('Melhorias, Luzes', 128, 98);
    tx.fillText('Portas & 2º Andar', 128, 126);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    screenMat = new THREE.MeshBasicMaterial({ map: tex });
  } else {
    screenMat = mats.accent;
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.44), screenMat);
  face.position.z = 0.035;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.62, 0.24), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(frame, face, hit);
  parent.add(g);
  hit.userData.houseAction = {
    label: () => '🏡 Abrir Painel da Casa',
    run: () => openHouseUpgradesModal(lotId)
  };
  return hit;
}

export function attachHouseUpgradesToLot(ctx, root, lot, mats, dims) {
  const { x, front, houseZ, doorZ, id } = lot;
  const { width, depth, floorY, eavesY, addSolidWall, addWalkableSlab, box } = dims;
  const backZ = houseZ - front * depth / 2;
  const left = x - width / 2;
  const right = x + width / 2;
  const hitList = ctx.houseInteractMeshes || (ctx.houseInteractMeshes = []);

  // 1. Janela traseira com persiana já instalada
  const backWinX = x - front * 2.1;
  const backDoorX = x + front * 1.9;
  const backBlind = createBlindGroup(root, mats, backWinX, 1.81, backZ + front * 0.04, front === 1 ? Math.PI : 0);
  hitList.push(backBlind.hit);

  // Persianas frontais (visíveis quando compra 'blinds')
  const fBlinds = [
    createBlindGroup(root, mats, x - 2.46, 1.81, doorZ - front * 0.06, front === 1 ? 0 : Math.PI),
    createBlindGroup(root, mats, x + 2.46, 1.81, doorZ - front * 0.06, front === 1 ? 0 : Math.PI)
  ];
  fBlinds.forEach((b) => { b.group.visible = false; hitList.push(b.hit); });

  // 2. Painel da Casa na parede interna (ao lado da entrada)
  const panelHit = createWallMenuPanel(root, mats, x - front * 1.35, 1.68, doorZ - front * 0.16, front === 1 ? Math.PI : 0, id);
  hitList.push(panelHit);

  // 3. Iluminação interna e no jardim
  const houseLightGrp = new THREE.Group();
  const lamp = makeBox(0.42, 0.08, 0.42, mats.trim, { noShadow: true });
  lamp.position.set(x, eavesY - 0.1, houseZ);
  const ptLight = new THREE.PointLight(0xffedd5, 1.35, 11, 1.5);
  ptLight.position.set(x, eavesY - 0.35, houseZ);
  houseLightGrp.add(lamp, ptLight);
  houseLightGrp.visible = false;
  root.add(houseLightGrp);

  const gardenLightGrp = new THREE.Group();
  [-3.8, 3.8].forEach((ox) => {
    const lz = backZ - front * 2.2;
    const post = makeBox(0.12, 1.75, 0.12, mats.wood);
    post.position.set(x + ox, 0.88, lz);
    const bulb = makeBox(0.24, 0.22, 0.24, mats.trim, { noShadow: true });
    bulb.position.set(x + ox, 1.82, lz);
    const gPt = new THREE.PointLight(0xfef08a, 1.15, 9, 1.6);
    gPt.position.set(x + ox, 1.82, lz);
    gardenLightGrp.add(post, bulb, gPt);
  });
  gardenLightGrp.visible = false;
  root.add(gardenLightGrp);

  // 4. Portas (frente e fundo) + tampa da passagem traseira antes de comprar back_door
  const fDoor = createHouseDoor(root, mats, x, 1.24, doorZ, front, 1.12);
  fDoor.pivot.visible = false;
  hitList.push(fDoor.hit);

  const bDoor = createHouseDoor(root, mats, backDoorX, 1.24, backZ, -front, 1.10);
  bDoor.pivot.visible = false;
  hitList.push(bDoor.hit);

  const backDoorSealWall = addSolidWall(root, ctx.wallSegments, backDoorX - 0.6, backZ, backDoorX + 0.6, backZ, floorY, eavesY - floorY, 0.24, mats.wall);
  const backDoorSealCollider = ctx.wallSegments[ctx.wallSegments.length - 1];

  // 5. Segundo andar + escada (mezanino nos fundos/lateral direita)
  const secondFloorGrp = new THREE.Group();
  const loftY = 2.55;
  const loftW = width - 0.5;
  const loftD = depth * 0.46;
  const loftZ = houseZ - front * (depth * 0.24);
  const loftFloor = addWalkableSlab(secondFloorGrp, ctx.walkableFloors, x, loftY, loftZ, loftW, 0.12, loftD, mats.floor);
  const loftSlabObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
  loftSlabObj._disabled = true;
  // Escadinha para subir ao 2º andar
  const stairX = x + front * (width * 0.34);
  const steps = 8;
  const stepSlabs = [];
  for (let s = 1; s <= steps; s++) {
    const sy = floorY + (loftY - floorY) * (s / steps);
    const sz = loftZ + front * (loftD / 2 + (steps - s + 0.5) * 0.28);
    addWalkableSlab(secondFloorGrp, ctx.walkableFloors, stairX, sy, sz, 0.92, 0.14, 0.30, mats.wood);
    const stObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
    stObj._disabled = true;
    stepSlabs.push(stObj);
  }
  const rail = box(secondFloorGrp, mats.trim, x - front * 0.75, loftY + 0.45, loftZ + front * (loftD / 2 - 0.06), loftW - 1.5, 0.85, 0.08);
  rail.castShadow = false;
  if (ctx.supportSurfaces && ctx.supportMeshes) {
    const loftSurf = { minX: x - loftW / 2, maxX: x + loftW / 2, minZ: loftZ - loftD / 2, maxZ: loftZ + loftD / 2, topY: loftY + 0.06 };
    loftFloor.userData.supportSurface = loftSurf;
    ctx.supportSurfaces.push(loftSurf);
    ctx.supportMeshes.push(loftFloor);
  }
  secondFloorGrp.visible = false;
  root.add(secondFloorGrp);

  lotHooks.set(id, {
    upgrades: {},
    apply(u = {}) {
      this.upgrades = u || {};
      houseLightGrp.visible = !!u.house_lights;
      gardenLightGrp.visible = !!u.garden_lights;
      fBlinds.forEach((b) => { b.group.visible = !!u.blinds; });
      fDoor.pivot.visible = !!u.front_door;
      bDoor.pivot.visible = !!u.back_door;
      if (backDoorSealWall) backDoorSealWall.visible = !u.back_door;
      if (backDoorSealCollider) backDoorSealCollider.maxY = u.back_door ? -1 : eavesY;
      secondFloorGrp.visible = !!u.second_floor;
      loftSlabObj._disabled = !u.second_floor;
      stepSlabs.forEach((st) => { st._disabled = !u.second_floor; });
    }
  });
  if (!fetchedOnce && typeof window !== 'undefined') {
    fetchedOnce = true;
    apiPost('api/village.php?action=status', {}, true)
      .then((res) => { if (res?.ok && Array.isArray(res.lots)) applyVillageUpgrades(res.lots); })
      .catch(() => {});
  }
}

export function applyVillageUpgrades(lots) {
  if (!Array.isArray(lots)) return;
  for (const l of lots) {
    const hook = lotHooks.get(l.id);
    if (hook) hook.apply(l.upgrades || {});
  }
  if (currentModalLotId) renderHouseUpgradesModal(currentModalLotId);
}

export function findHoveredHouseAction(ctx) {
  if (!ctx.houseInteractMeshes?.length || !ctx.raycaster) return null;
  const hits = ctx.raycaster.intersectObjects(ctx.houseInteractMeshes, false);
  for (const h of hits) {
    if (h.distance < 3.6 && h.object?.visible !== false && h.object.parent?.visible !== false && h.object.userData.houseAction) {
      return h.object.userData.houseAction;
    }
  }
  return null;
}

function ensureModalDom() {
  if (typeof document === 'undefined' || document.getElementById('house-upgrades-modal')) return;
  const el = document.createElement('div');
  el.id = 'house-upgrades-modal';
  el.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/60 backdrop-blur-sm p-4';
  el.innerHTML =
    `<div class="glass-panel w-full max-w-lg rounded-2xl border border-slate-600/50 p-4 text-white shadow-2xl space-y-3">` +
      `<div class="flex items-center justify-between border-b border-slate-700/60 pb-2">` +
        `<div class="font-bold text-base">🏡 Painel da Casa <span id="house-up-lot" class="text-cyan-300 text-sm"></span></div>` +
        `<button id="btn-close-house-up" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold">✕</button>` +
      `</div>` +
      `<div id="house-up-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[65vh] overflow-y-auto pr-1"></div>` +
    `</div>`;
  document.body.appendChild(el);
  document.getElementById('btn-close-house-up').onclick = () => {
    el.classList.add('hidden');
    el.classList.remove('flex');
    currentModalLotId = null;
  };
}

export function openHouseUpgradesModal(lotId) {
  ensureModalDom();
  currentModalLotId = lotId;
  const el = document.getElementById('house-upgrades-modal');
  if (!el) return;
  if (document.pointerLockElement) document.exitPointerLock?.();
  renderHouseUpgradesModal(lotId);
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function renderHouseUpgradesModal(lotId) {
  const list = document.getElementById('house-up-list');
  const lotEl = document.getElementById('house-up-lot');
  if (!list) return;
  if (lotEl) lotEl.textContent = `#${lotId}`;
  const hook = lotHooks.get(lotId);
  const owned = hook?.upgrades || {};
  const isOwner = appState.villageLease?.id === lotId;
  list.innerHTML = '';
  for (const u of HOUSE_UPGRADES) {
    const active = !!owned[u.id];
    const card = document.createElement('div');
    card.className = 'rounded-xl p-3 border flex flex-col justify-between ' +
      (active ? 'bg-emerald-950/35 border-emerald-500/45' : 'bg-slate-900/70 border-slate-700/60');
    card.innerHTML =
      `<div>` +
        `<div class="font-bold text-xs flex items-center gap-1.5"><span>${u.icon}</span><span>${u.name}</span></div>` +
        `<div class="text-[11px] text-slate-300 mt-1">${u.desc}</div>` +
      `</div>`;
    const btn = document.createElement('button');
    btn.className = 'mt-2.5 w-full py-1.5 rounded-lg font-bold text-xs transition ' +
      (active ? 'bg-emerald-700/40 text-emerald-200 cursor-default'
        : (isOwner ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 cursor-not-allowed'));
    btn.textContent = active ? '✅ Instalado' : (isOwner ? `🪙 Comprar (${u.price})` : `🪙 ${u.price} (só o dono)`);
    btn.disabled = active || !isOwner;
    if (!active && isOwner) {
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const res = await apiPost('api/village.php?action=buy_upgrade', { lot_id: lotId, upgrade_id: u.id }, true);
          if (res?.ok) {
            if (Array.isArray(res.lots)) applyVillageUpgrades(res.lots);
            if (typeof res.myco_coins === 'number' && appState.currentUser) {
              appState.currentUser.myco_coins = res.myco_coins;
            }
            window.MycoAudio?.playClick?.();
            window.dispatchEvent(new CustomEvent('myco-toast', { detail: `🏡 ${u.name} instalado!` }));
          } else {
            btn.disabled = false;
            window.dispatchEvent(new CustomEvent('myco-toast', { detail: res?.error || 'Não foi possível comprar.' }));
          }
        } catch {
          btn.disabled = false;
        }
      };
    }
    card.appendChild(btn);
    list.appendChild(card);
  }
}
