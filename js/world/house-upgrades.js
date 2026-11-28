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
let _cachedScreenMat = null;

function getSharedScreenMat(mats) {
  if (_cachedScreenMat) return _cachedScreenMat;
  if (typeof document === 'undefined') return mats.accent;
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
  _cachedScreenMat = new THREE.MeshBasicMaterial({ map: tex });
  return _cachedScreenMat;
}

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

  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.30, 1.10, 0.32), hitMat);
  hit.position.set(0, 0.05, 0);
  g.add(hit);
  parent.add(g);

  const ctrl = { group: g, slats, open: true };
  const apply = () => {
    for (let i = 0; i < slats.length; i++) {
      if (ctrl.open) {
        slats[i].rotation.x = Math.PI * 0.45;
        slats[i].position.set(0, 0.39 - i * 0.014, 0);
      } else {
        slats[i].rotation.x = 0.06;
        slats[i].position.set(0, 0.36 - i * 0.120, 0);
      }
    }
  };
  apply();

  const action = {
    label: () => (ctrl.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana'),
    run: () => {
      ctrl.open = !ctrl.open;
      apply();
      window.MycoAudio?.playClick?.();
    }
  };
  hit.userData.houseAction = action;
  pelmet.userData.houseAction = action;
  slats.forEach((s) => { s.userData.houseAction = action; });

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
  const leftPanelT = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
  leftPanelT.position.set(leafW / 2, 0.52, 0.026);
  const leftPanelB = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
  leftPanelB.position.set(leafW / 2, -0.52, 0.026);
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

  // Hitbox de interação invisível mas raycastable
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(doorway + 0.2, doorH + 0.2, 0.44), hitMat);
  hit.position.set(0, 0, 0);
  g.add(leftPivot, rightPivot, hit);

  const state = { open: false };
  let doorCollider = null;

  const action = {
    label: () => (state.open ? '🚪 Fechar Porta da Frente' : '🚪 Abrir Porta da Frente'),
    run: () => {
      state.open = !state.open;
      const swing = state.open ? (frontDir * Math.PI * 0.48) : 0;
      leftPivot.rotation.y = swing;
      rightPivot.rotation.y = -swing;
      if (doorCollider) doorCollider.maxY = state.open ? -1 : 3.5;
      window.MycoAudio?.playDoor?.(state.open) || window.MycoAudio?.playClick?.();
    }
  };
  hit.userData.houseAction = action;
  leftLeaf.userData.houseAction = action;
  rightLeaf.userData.houseAction = action;

  return {
    group: g,
    hit,
    leftLeaf,
    rightLeaf,
    state,
    setCollider(c) { doorCollider = c; }
  };
}

function createHouseBackDoor(parent, mats, x, y, z, frontDir, width = 1.18) {
  const pivot = new THREE.Group();
  pivot.position.set(x - width / 2, y, z);
  const doorH = 2.28;
  const leaf = makeBox(width, doorH, 0.055, mats.wood);
  leaf.position.set(width / 2, 0, 0);
  const panelT = makeBox(width - 0.16, 0.85, 0.012, mats.trim, { noShadow: true });
  panelT.position.set(width / 2, 0.52, 0.026);
  const panelB = makeBox(width - 0.16, 0.85, 0.012, mats.trim, { noShadow: true });
  panelB.position.set(width / 2, -0.52, 0.026);
  const handlePlate = makeBox(0.04, 0.18, 0.018, mats.accent, { noShadow: true });
  handlePlate.position.set(width - 0.12, 0, 0.034);
  const handleLever = makeBox(0.10, 0.025, 0.055, mats.accent, { noShadow: true });
  handleLever.position.set(width - 0.13, 0, 0.065);

  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, doorH + 0.2, 0.44), hitMat);
  hit.position.set(width / 2, 0, 0);
  pivot.add(leaf, panelT, panelB, handlePlate, handleLever, hit);
  parent.add(pivot);

  const state = { open: false };
  let doorCollider = null;

  const action = {
    label: () => (state.open ? '🚪 Fechar Porta dos Fundos' : '🚪 Abrir Porta dos Fundos'),
    run: () => {
      state.open = !state.open;
      pivot.rotation.y = state.open ? (frontDir * Math.PI * 0.48) : 0;
      if (doorCollider) doorCollider.maxY = state.open ? -1 : 3.5;
      window.MycoAudio?.playDoor?.(state.open) || window.MycoAudio?.playClick?.();
    }
  };
  hit.userData.houseAction = action;
  leaf.userData.houseAction = action;

  return {
    pivot,
    hit,
    leaf,
    state,
    setCollider(c) { doorCollider = c; }
  };
}

function createWallMenuPanel(parent, mats, x, y, z, rotY, lotId) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  // Moldura compacta e discreta estilo tablet / interfone inteligente (~28cm x 19cm)
  const frame = makeBox(0.28, 0.19, 0.022, mats.trim);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.17), getSharedScreenMat(mats));
  face.position.z = 0.012;

  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.24), hitMat);
  hit.position.set(0, 0, 0.02);
  g.add(frame, face, hit);
  parent.add(g);

  const action = {
    label: () => '🏡 Abrir Painel da Casa',
    run: () => openHouseUpgradesModal(lotId)
  };
  hit.userData.houseAction = action;
  frame.userData.houseAction = action;
  face.userData.houseAction = action;

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
  fBlinds.forEach((b) => {
    b.group.visible = false;
    hitList.push(b.hit);
  });

  // 2. Painel da Casa na parede interna (ao lado da entrada, elegante e discreto)
  const panelX = x - front * (doorway / 2 + 0.38);
  const panelHit = createWallMenuPanel(root, mats, panelX, 1.55, doorZ - front * 0.14, front === 1 ? Math.PI : 0, id);
  hitList.push(panelHit);

  // 3. Iluminação interna e no jardim (emissivas puras sem PointLights adicionais para preservar 60+ FPS e evitar WebGL context loss)
  const houseLightGrp = new THREE.Group();
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6df });
  const lampWood = makeBox(0.48, 0.08, 0.48, mats.wood, { noShadow: true });
  lampWood.position.set(x, eavesY - 0.08, houseZ);
  const lampGlow = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.38), lampMat);
  lampGlow.position.set(x, eavesY - 0.14, houseZ);
  houseLightGrp.add(lampWood, lampGlow);
  houseLightGrp.visible = false;
  root.add(houseLightGrp);

  const gardenLightGrp = new THREE.Group();
  [-3.8, 3.8].forEach((ox) => {
    const lz = backZ - front * 2.2;
    const post = makeBox(0.12, 1.75, 0.12, mats.wood);
    post.position.set(x + ox, 0.88, lz);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff0aa });
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), bulbMat);
    bulb.position.set(x + ox, 1.82, lz);
    gardenLightGrp.add(post, bulb);
  });
  gardenLightGrp.visible = false;
  root.add(gardenLightGrp);

  // 4. Porta da Frente Dupla (preenche os 1.9m com duas folhas articuladas) e Porta dos Fundos
  const fDoor = createHouseDoubleDoor(root, mats, x, 1.24, doorZ, front, doorway);
  fDoor.group.visible = false;
  hitList.push(fDoor.hit, fDoor.leftLeaf, fDoor.rightLeaf);

  const frontDoorCollider = {
    x1: x - doorway / 2, z1: doorZ,
    x2: x + doorway / 2, z2: doorZ,
    halfThick: 0.15,
    minY: floorY,
    maxY: -1
  };
  ctx.wallSegments.push(frontDoorCollider);
  fDoor.setCollider(frontDoorCollider);

  const bDoor = createHouseBackDoor(root, mats, backDoorX, 1.24, backZ, -front, 1.18);
  bDoor.pivot.visible = false;
  hitList.push(bDoor.hit, bDoor.leaf);

  const backDoorSealWall = addSolidWall(root, ctx.wallSegments, backDoorX - 0.6, backZ, backDoorX + 0.6, backZ, floorY, eavesY - floorY, 0.24, mats.wall);
  const backDoorSealCollider = ctx.wallSegments[ctx.wallSegments.length - 1];
  bDoor.setCollider(backDoorSealCollider);

  // 5. Segundo andar + escada (mezanino elegante e robusto nos fundos/lateral com pé-direito alto)
  const secondFloorGrp = new THREE.Group();
  const loftY = 2.40;
  const loftW = width - 0.36; // 8.04m, cobre de parede a parede
  const loftD = 2.80; // fundos da casa
  const loftZ = backZ + front * (loftD / 2);
  const frontEdgeZ = loftZ + front * (loftD / 2);

  // Piso de madeira nobre do mezanino
  const loftFloor = addWalkableSlab(secondFloorGrp, ctx.walkableFloors, x, loftY, loftZ, loftW, 0.12, loftD, mats.floor);
  const loftSlabObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
  loftSlabObj._disabled = true;

  // Vigas estruturais robustas de sustentação sob o piso
  box(secondFloorGrp, mats.wood, x, loftY - 0.08, frontEdgeZ, loftW, 0.16, 0.16);
  for (let j = -2; j <= 2; j++) {
    box(secondFloorGrp, mats.wood, x + j * 1.8, loftY - 0.08, loftZ, 0.12, 0.14, loftD);
  }
  // Pilares nos cantos até o piso térreo
  box(secondFloorGrp, mats.wood, x - 3.70, (loftY + floorY) / 2, frontEdgeZ, 0.16, loftY - floorY, 0.16);
  box(secondFloorGrp, mats.wood, x + 1.20, (loftY + floorY) / 2, frontEdgeZ, 0.16, loftY - floorY, 0.16);

  // Guarda-corpo de proteção com corrimão e ripas verticais (deixando vão de 1.4m para a escada)
  const railW = loftW - 1.50;
  const railCenterX = x - front * 0.75;
  box(secondFloorGrp, mats.wood, railCenterX, loftY + 0.88, frontEdgeZ, railW, 0.07, 0.07); // Corrimão superior
  box(secondFloorGrp, mats.wood, railCenterX, loftY + 0.08, frontEdgeZ, railW, 0.06, 0.06); // Régua inferior
  const spindleCount = Math.floor(railW / 0.28);
  for (let sp = 0; sp <= spindleCount; sp++) {
    const sx = railCenterX - railW / 2 + sp * (railW / spindleCount);
    box(secondFloorGrp, mats.trim, sx, loftY + 0.48, frontEdgeZ, 0.035, 0.74, 0.035);
  }
  box(secondFloorGrp, mats.wood, railCenterX + front * (railW / 2), loftY + 0.48, frontEdgeZ, 0.09, 0.92, 0.09);

  // Escada caminhável encostada na parede lateral
  const stairX = x + front * 3.55;
  const steps = 11;
  const stairZStart = houseZ + front * 1.50;
  const stairZEnd = frontEdgeZ;
  const stepSlabs = [];

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const sy = floorY + (loftY - floorY) * t;
    const sz = stairZStart + (stairZEnd - stairZStart) * t;
    // Degrau de madeira
    addWalkableSlab(secondFloorGrp, ctx.walkableFloors, stairX, sy, sz, 0.92, 0.08, 0.28, mats.wood);
    const stObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
    stObj._disabled = true;
    stepSlabs.push(stObj);
    // Espelho / fechamento vertical do degrau
    box(secondFloorGrp, mats.trim, stairX, sy - 0.10, sz - front * 0.12, 0.90, 0.18, 0.04);
  }

  // Corrimão da escada
  const stairMidZ = (stairZStart + stairZEnd) / 2;
  const stairMidY = (floorY + loftY) / 2 + 0.82;
  const stairRun = Math.hypot(stairZEnd - stairZStart, loftY - floorY);
  const stairAngle = Math.atan2(loftY - floorY, Math.abs(stairZEnd - stairZStart));
  const handrail = box(secondFloorGrp, mats.wood, stairX - front * 0.46, stairMidY, stairMidZ, 0.05, 0.06, Math.abs(stairZEnd - stairZStart) + 0.2);
  handrail.rotation.x = front === 1 ? -stairAngle : stairAngle;

  // Registro no stairsList para subida 100% contínua e suave da física
  const stairBox = {
    minX: stairX - 0.55,
    maxX: stairX + 0.55,
    zStart: stairZStart,
    zEnd: stairZEnd,
    yStart: floorY,
    yEnd: loftY,
    _disabled: true
  };
  if (ctx.stairsList) ctx.stairsList.push(stairBox);

  // Superfície de apoio no piso do mezanino para posicionar itens/vasos/caixas
  if (ctx.supportSurfaces && ctx.supportMeshes) {
    const loftSurf = {
      minX: x - loftW / 2,
      maxX: x + loftW / 2,
      minZ: Math.min(loftZ - loftD / 2, loftZ + loftD / 2),
      maxZ: Math.max(loftZ - loftD / 2, loftZ + loftD / 2),
      topY: loftY + 0.06
    };
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
      frontDoorCollider.maxY = (u.front_door && !fDoor.state.open) ? eavesY : -1;
      bDoor.pivot.visible = !!u.back_door;
      if (backDoorSealWall) backDoorSealWall.visible = !u.back_door;
      if (backDoorSealCollider) backDoorSealCollider.maxY = (u.back_door && bDoor.state.open) ? -1 : eavesY;
      secondFloorGrp.visible = !!u.second_floor;
      loftSlabObj._disabled = !u.second_floor;
      stairBox._disabled = !u.second_floor;
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
  const hits = ctx.raycaster.intersectObjects(ctx.houseInteractMeshes, true);
  for (const h of hits) {
    const act = h.object?.userData?.houseAction;
    if (!act) continue;

    // Confere visibilidade subindo a hierarquia
    let cur = h.object;
    let visible = true;
    while (cur) {
      if (cur.visible === false) { visible = false; break; }
      if (cur === ctx.scene) break;
      cur = cur.parent;
    }
    if (!visible) continue;

    // Distância do ponto atingido até a posição do jogador (ou da câmera se em FPS)
    const distToPlayer = ctx.playerPos ? h.point.distanceTo(ctx.playerPos) : h.distance;
    if (distToPlayer < 4.2 || (ctx.inFps && h.distance < 4.8)) {
      return act;
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
