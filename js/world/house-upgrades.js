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

  // 1. Caixa superior de acabamento (pelmet/headbox)
  const pelmet = makeBox(1.18, 0.07, 0.08, mats.trim, { noShadow: true });
  pelmet.position.set(0, 0.44, 0);
  g.add(pelmet);

  // 2. Lâminas horizontais finas e elegantes (estilo persiana veneziana de madeira)
  const slats = [];
  const slatCount = 7;
  for (let i = 0; i < slatCount; i++) {
    const slat = makeBox(1.12, 0.082, 0.014, mats.wood, { noShadow: true });
    slats.push(slat);
    g.add(slat);
  }

  // 3. Cordão decorativo lateral com puxador de madeira
  const cord = makeBox(0.01, 0.32, 0.01, mats.trim, { noShadow: true });
  cord.position.set(0.53, 0.22, 0.02);
  const cordKnob = makeBox(0.025, 0.04, 0.025, mats.wood, { noShadow: true });
  cordKnob.position.set(0.53, 0.05, 0.02);
  g.add(cord, cordKnob);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.96, 0.24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(0, 0.05, 0);
  g.add(hit);
  parent.add(g);

  const ctrl = { group: g, slats, open: true };
  const apply = () => {
    for (let i = 0; i < slats.length; i++) {
      if (ctrl.open) {
        // Recolhida no topo: lâminas horizontais empilhadas sob o pelmet
        slats[i].rotation.x = Math.PI * 0.45;
        slats[i].position.set(0, 0.39 - i * 0.014, 0);
      } else {
        // Fechada: lâminas descem cobrindo toda a janela com leve sobreposição
        slats[i].rotation.x = 0.06;
        slats[i].position.set(0, 0.36 - i * 0.120, 0);
      }
    }
  };
  apply();

  hit.userData.houseAction = {
    label: () => (ctrl.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana'),
    run: () => {
      ctrl.open = !ctrl.open;
      apply();
      window.MycoAudio?.playClick?.();
    }
  };
  return { group: g, hit, ctrl };
}

function createHouseDoubleDoor(parent, mats, x, y, z, frontDir, doorway = 1.90) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);

  const doorH = 2.28;
  const leafW = (doorway - 0.04) * 0.5; // ~0.93m cada folha
  const leafThick = 0.055;

  // Folha esquerda
  const leftPivot = new THREE.Group();
  leftPivot.position.set(-doorway / 2 + 0.02, 0, 0);
  const leftLeaf = makeBox(leafW, doorH, leafThick, mats.wood);
  leftLeaf.position.set(leafW / 2, 0, 0);
  // Almofadas / relevo decorativo da porta
  const leftPanelT = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
  leftPanelT.position.set(leafW / 2, 0.52, 0.026);
  const leftPanelB = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
  leftPanelB.position.set(leafW / 2, -0.52, 0.026);
  // Maçaneta de latão dourado
  const leftHandlePlate = makeBox(0.04, 0.18, 0.018, mats.accent, { noShadow: true });
  leftHandlePlate.position.set(leafW - 0.08, 0, 0.034);
  const leftHandleLever = makeBox(0.10, 0.025, 0.055, mats.accent, { noShadow: true });
  leftHandleLever.position.set(leafW - 0.09, 0, 0.065);
  leftPivot.add(leftLeaf, leftPanelT, leftPanelB, leftHandlePlate, leftHandleLever);

  // Folha direita
  const rightPivot = new THREE.Group();
  rightPivot.position.set(doorway / 2 - 0.02, 0, 0);
  const rightLeaf = makeBox(leafW, doorH, leafThick, mats.wood);
  rightLeaf.position.set(-leafW / 2, 0, 0);
  const rightPanelT = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
  rightPanelT.position.set(-leafW / 2, 0.52, 0.026);
  const rightPanelB = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
  rightPanelB.position.set(-leafW / 2, -0.52, 0.026);
  const rightHandlePlate = makeBox(0.04, 0.18, 0.018, mats.accent, { noShadow: true });
  rightHandlePlate.position.set(-leafW + 0.08, 0, 0.034);
  const rightHandleLever = makeBox(0.10, 0.025, 0.055, mats.accent, { noShadow: true });
  rightHandleLever.position.set(-leafW + 0.09, 0, 0.065);
  rightPivot.add(rightLeaf, rightPanelT, rightPanelB, rightHandlePlate, rightHandleLever);

  // Hitbox de interação
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(doorway + 0.1, doorH + 0.1, 0.36),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(0, 0, 0);
  g.add(leftPivot, rightPivot, hit);

  const state = { open: false };
  hit.userData.houseAction = {
    label: () => (state.open ? '🚪 Fechar Porta da Frente' : '🚪 Abrir Porta da Frente'),
    run: () => {
      state.open = !state.open;
      const swing = state.open ? (frontDir * Math.PI * 0.46) : 0;
      leftPivot.rotation.y = swing;
      rightPivot.rotation.y = -swing;
      window.MycoAudio?.playDoor?.() || window.MycoAudio?.playClick?.();
    }
  };
  return { group: g, hit, state };
}

function createHouseBackDoor(parent, mats, x, y, z, frontDir, width = 1.18) {
  const pivot = new THREE.Group();
  pivot.position.set(x - width / 2, y, z);
  const leaf = makeBox(width, 2.28, 0.055, mats.wood);
  leaf.position.set(width / 2, 0, 0);
  const panelT = makeBox(width - 0.16, 0.85, 0.012, mats.trim, { noShadow: true });
  panelT.position.set(width / 2, 0.52, 0.026);
  const panelB = makeBox(width - 0.16, 0.85, 0.012, mats.trim, { noShadow: true });
  panelB.position.set(width / 2, -0.52, 0.026);
  const handlePlate = makeBox(0.04, 0.18, 0.018, mats.accent, { noShadow: true });
  handlePlate.position.set(width - 0.12, 0, 0.034);
  const handleLever = makeBox(0.10, 0.025, 0.055, mats.accent, { noShadow: true });
  handleLever.position.set(width - 0.13, 0, 0.065);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 2.30, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(width / 2, 0, 0);
  pivot.add(leaf, panelT, panelB, handlePlate, handleLever, hit);
  parent.add(pivot);

  const state = { open: false };
  hit.userData.houseAction = {
    label: () => (state.open ? '🚪 Fechar Porta dos Fundos' : '🚪 Abrir Porta dos Fundos'),
    run: () => {
      state.open = !state.open;
      pivot.rotation.y = state.open ? (frontDir * Math.PI * 0.48) : 0;
      window.MycoAudio?.playDoor?.() || window.MycoAudio?.playClick?.();
    }
  };
  return { pivot, hit, state };
}

function createWallMenuPanel(parent, mats, x, y, z, rotY, lotId) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  // Moldura compacta e discreta estilo tablet / interfone inteligente (~28cm x 19cm)
  const frame = makeBox(0.28, 0.19, 0.022, mats.trim);
  let screenMat;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 340;
    const tx = c.getContext('2d');
    // Fundo vidro escuro com degradê tecnológico
    const grad = tx.createLinearGradient(0, 0, 0, 340);
    grad.addColorStop(0, '#090e17');
    grad.addColorStop(1, '#0f172a');
    tx.fillStyle = grad;
    tx.fillRect(0, 0, 512, 340);

    // Borda fina azul-ciano
    tx.strokeStyle = '#0284c7';
    tx.lineWidth = 6;
    tx.strokeRect(10, 10, 492, 320);

    // Barra superior
    tx.fillStyle = '#10b981';
    tx.beginPath();
    tx.arc(36, 36, 8, 0, Math.PI * 2);
    tx.fill();
    tx.fillStyle = '#94a3b8';
    tx.font = 'bold 20px system-ui';
    tx.textAlign = 'left';
    tx.fillText('SMART HOME • CASA DA VILA', 56, 44);

    // Conteúdo principal
    tx.fillStyle = '#ffffff';
    tx.font = 'bold 44px system-ui';
    tx.textAlign = 'center';
    tx.fillText('🏡 Painel da Casa', 256, 125);

    tx.fillStyle = '#38bdf8';
    tx.font = '22px system-ui';
    tx.fillText('Luzes • Portas • 2º Andar', 256, 172);

    // Botão de ação "Toque para Abrir"
    tx.fillStyle = '#0284c7';
    tx.beginPath();
    tx.roundRect(64, 218, 384, 76, 16);
    tx.fill();
    tx.fillStyle = '#ffffff';
    tx.font = 'bold 26px system-ui';
    tx.fillText('⚡ Toque para Gerenciar', 256, 266);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    screenMat = new THREE.MeshBasicMaterial({ map: tex });
  } else {
    screenMat = mats.accent;
  }

  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.17), screenMat);
  face.position.z = 0.012;

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.18), new THREE.MeshBasicMaterial({ visible: false }));
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
  const { width, depth, doorway = 1.90, floorY, eavesY, addSolidWall, addWalkableSlab, box } = dims;
  const backZ = houseZ - front * depth / 2;
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

  // 2. Painel da Casa na parede interna (ao lado da entrada, elegante e discreto)
  const panelX = x - front * (doorway / 2 + 0.36);
  const panelHit = createWallMenuPanel(root, mats, panelX, 1.55, doorZ - front * 0.14, front === 1 ? Math.PI : 0, id);
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

  // 4. Porta da Frente Dupla (preenche os 1.9m com duas folhas articuladas) e Porta dos Fundos
  const fDoor = createHouseDoubleDoor(root, mats, x, 1.24, doorZ, front, doorway);
  fDoor.group.visible = false;
  hitList.push(fDoor.hit);

  const bDoor = createHouseBackDoor(root, mats, backDoorX, 1.24, backZ, -front, 1.18);
  bDoor.pivot.visible = false;
  hitList.push(bDoor.hit);

  const backDoorSealWall = addSolidWall(root, ctx.wallSegments, backDoorX - 0.6, backZ, backDoorX + 0.6, backZ, floorY, eavesY - floorY, 0.24, mats.wall);
  const backDoorSealCollider = ctx.wallSegments[ctx.wallSegments.length - 1];

  // 5. Segundo andar + escada (mezanino elegante e robusto nos fundos/lateral)
  const secondFloorGrp = new THREE.Group();
  const loftY = 2.22;
  const loftW = width - 0.40;
  const loftD = depth * 0.48;
  const loftZ = houseZ - front * (depth * 0.24);

  // Piso do mezanino
  const loftFloor = addWalkableSlab(secondFloorGrp, ctx.walkableFloors, x, loftY, loftZ, loftW, 0.10, loftD, mats.floor);
  const loftSlabObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
  loftSlabObj._disabled = true;

  // Vigas e pilares de sustentação de madeira nobre
  box(secondFloorGrp, mats.wood, x, loftY - 0.07, loftZ + front * (loftD / 2), loftW, 0.12, 0.12);
  [-loftW / 2 + 0.25, loftW / 2 - 0.25].forEach((px) => {
    box(secondFloorGrp, mats.wood, x + px, (loftY + floorY) / 2, loftZ + front * (loftD / 2), 0.14, loftY - floorY, 0.14);
  });

  // Guarda-corpo de proteção com corrimão e ripas verticais
  const railW = loftW - 1.60;
  const railCenterX = x - front * 0.80;
  const railZ = loftZ + front * (loftD / 2 - 0.04);
  box(secondFloorGrp, mats.trim, railCenterX, loftY + 0.82, railZ, railW, 0.06, 0.06); // Corrimão superior
  box(secondFloorGrp, mats.trim, railCenterX, loftY + 0.12, railZ, railW, 0.05, 0.05); // Régua inferior
  const spindleCount = Math.floor(railW / 0.32);
  for (let sp = 0; sp <= spindleCount; sp++) {
    const sx = railCenterX - railW / 2 + sp * (railW / spindleCount);
    box(secondFloorGrp, mats.trim, sx, loftY + 0.47, railZ, 0.035, 0.65, 0.035);
  }

  // Escada de madeira para subir ao 2º andar
  const stairX = x + front * (width * 0.35);
  const steps = 8;
  const stepSlabs = [];
  for (let s = 1; s <= steps; s++) {
    const sy = floorY + (loftY - floorY) * (s / steps);
    const sz = loftZ + front * (loftD / 2 + (steps - s + 0.4) * 0.26);
    addWalkableSlab(secondFloorGrp, ctx.walkableFloors, stairX, sy, sz, 0.94, 0.12, 0.28, mats.wood);
    const stObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
    stObj._disabled = true;
    stepSlabs.push(stObj);
  }
  // Corrimão lateral da escada
  const stairZStart = loftZ + front * (loftD / 2 + 0.4 * 0.26);
  const stairZEnd = loftZ + front * (loftD / 2 + (steps + 0.4) * 0.26);
  const stairMidZ = (stairZStart + stairZEnd) / 2;
  const stairMidY = (floorY + loftY) / 2 + 0.78;
  const stairRun = Math.abs(stairZEnd - stairZStart);
  box(secondFloorGrp, mats.trim, stairX - front * 0.45, stairMidY, stairMidZ, 0.05, 0.06, stairRun + 0.2);

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
      fDoor.group.visible = !!u.front_door;
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
  el.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4';
  el.innerHTML =
    `<div class="glass-panel w-full max-w-lg rounded-2xl border border-slate-600/50 p-4 sm:p-5 text-white shadow-2xl space-y-3.5 bg-slate-950/90 max-h-[88vh] flex flex-col">` +
      `<div class="flex items-center justify-between border-b border-slate-700/60 pb-2.5 shrink-0">` +
        `<div class="font-bold text-base flex items-center gap-2"><span>🏡</span><span>Painel de Melhorias</span> <span id="house-up-lot" class="text-cyan-400 font-mono text-xs px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40"></span></div>` +
        `<button id="btn-close-house-up" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold transition">✕</button>` +
      `</div>` +
      `<div id="house-up-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 flex-1"></div>` +
    `</div>`;
  document.body.appendChild(el);

  const closeFn = () => {
    el.classList.add('hidden');
    el.classList.remove('flex');
    currentModalLotId = null;
  };
  document.getElementById('btn-close-house-up').onclick = closeFn;
  el.onclick = (e) => { if (e.target === el) closeFn(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.classList.contains('hidden')) closeFn();
  });
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
  const isOwner = appState.villageLease?.id === lotId || appState.currentUser?.role === 'admin';
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
