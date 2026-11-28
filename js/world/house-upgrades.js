/**
 * Melhorias da Casa da Vila: Painel na Parede, Persianas Venetian, Portas Articuladas, Iluminação e 2º Andar + Escada Enclausurada.
 */
import { makeBox } from '../engine/textures.js';
import { apiPost } from '../services/api-client.js';
import { appState } from '../core/state.js';
import { events } from '../core/events.js';
import { showFloatingToast } from '../ui/dom-helpers.js';
import { pendingCoinOperations } from '../services/coin-outbox.js';
import { getLocalMycoCoins, setLocalMycoCoins } from '../core/myco-coins.js';

const THREE = window.THREE;

export const HOUSE_UPGRADES = [
  { id: 'house_lights', icon: '💡', name: 'Iluminação Interna', desc: 'Luminária central quente que ilumina toda a casa.', price: 60 },
  { id: 'garden_lights', icon: '🎄', name: 'Iluminação no Jardim', desc: 'Luzes de Natal em volta da casa, na árvore do quintal e lanternas no jardim.', price: 80 },
  { id: 'blinds', icon: '🪟', name: 'Persianas nas Janelas', desc: 'Persianas articuladas nas janelas da frente (fundo já incluso).', price: 50 },
  { id: 'front_door', icon: '🚪', name: 'Porta da Frente', desc: 'Porta articulada com maçaneta que abre e fecha.', price: 75 },
  { id: 'back_door', icon: '🚪', name: 'Porta dos Fundos', desc: 'Passagem direta para o quintal com porta articulada.', price: 110 },
  { id: 'second_floor', icon: '🪜', name: 'Segundo Andar + Escada', desc: 'Mezanino caminhável com guarda-corpo e escadinha.', price: 220 }
];

const CHRISTMAS_PALETTE = [0xff4d5a, 0xffd166, 0x34d399, 0x60a5fa, 0xfff3c4];
const lotHooks = new Map();
let currentModalLotId = null;
let _cachedScreenMat = null;

export function canPlayerAccessLot(lotId) {
  if (!lotId) return true;
  if (!appState.currentUser && !appState.villageLease) return true;
  if (appState.currentUser?.role === 'admin' || appState.currentUser?.is_admin) return true;
  if (appState.villageLease && appState.villageLease.id === lotId) return true;
  if (appState.villageEditLot === lotId) return true;
  return false;
}

function markDynamic(obj, dynList) {
  if (!obj) return obj;
  obj.userData = obj.userData || {};
  obj.userData.keepDynamic = true;
  if (dynList) dynList.push(obj);
  return obj;
}

function getSharedScreenMat(mats) {
  if (_cachedScreenMat) return _cachedScreenMat;
  if (typeof document === 'undefined') return mats.accent;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 340;
  const tx = c.getContext('2d');
  const grad = tx.createLinearGradient(0, 0, 0, 340);
  grad.addColorStop(0, '#090e17');
  grad.addColorStop(1, '#0f172a');
  tx.fillStyle = grad;
  tx.fillRect(0, 0, 512, 340);

  tx.strokeStyle = '#0284c7';
  tx.lineWidth = 6;
  tx.strokeRect(10, 10, 492, 320);

  tx.fillStyle = '#10b981';
  tx.beginPath();
  tx.arc(36, 36, 8, 0, Math.PI * 2);
  tx.fill();
  tx.fillStyle = '#94a3b8';
  tx.font = 'bold 20px system-ui';
  tx.textAlign = 'left';
  tx.fillText('SMART HOME • CASA DA VILA', 56, 44);

  tx.fillStyle = '#ffffff';
  tx.font = 'bold 44px system-ui';
  tx.textAlign = 'center';
  tx.fillText('🏡 Painel da Casa', 256, 125);

  tx.fillStyle = '#38bdf8';
  tx.font = '22px system-ui';
  tx.fillText('Luzes • Portas • 2º Andar', 256, 172);

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

function createCottageVenetianBlind(parent, mats, x, topY, z, rotY, lotId, name, ctx) {
  const g = new THREE.Group();
  g.position.set(x, topY, z);
  g.rotation.y = rotY;

  const blindW = 1.12;
  const dropH = 0.86;
  const slatCount = 12;

  // 1. Headrail
  const headrail = makeBox(0.06, 0.05, blindW, mats.trim, { noShadow: true });
  headrail.position.set(0, -0.025, 0);
  g.add(headrail);

  // 2. Slats
  const slats = [];
  for (let i = 0; i < slatCount; i++) {
    const slat = makeBox(0.05, 0.008, blindW - 0.02, mats.wood, { noShadow: true });
    slat.position.set(0, -0.07 - ((i + 0.5) / slatCount) * (dropH - 0.12), 0);
    slat.rotation.z = 0.28;
    slats.push(slat);
    g.add(slat);
  }

  // 3. Ladder tapes
  const tapes = [];
  [-0.32, 0.32].forEach((tz) => {
    const tp = makeBox(0.015, dropH, 0.02, mats.trim, { noShadow: true });
    tp.position.set(0, -dropH / 2, tz);
    tapes.push(tp);
    g.add(tp);
  });

  // 4. Bottom rail
  const bottomRail = makeBox(0.055, 0.03, blindW - 0.02, mats.trim, { noShadow: true });
  bottomRail.position.set(0, -dropH, 0);
  g.add(bottomRail);

  // 5. Tilt wand and cord with knob
  const wand = makeBox(0.012, dropH * 0.65, 0.012, mats.trim, { noShadow: true });
  wand.position.set(-0.035, -dropH * 0.35, -0.42);
  const cord = makeBox(0.008, dropH * 0.50, 0.008, mats.trim, { noShadow: true });
  cord.position.set(-0.035, -dropH * 0.28, 0.42);
  const cordKnob = makeBox(0.025, 0.05, 0.025, mats.accent, { noShadow: true });
  cordKnob.position.set(-0.035, -dropH * 0.54, 0.42);
  g.add(wand, cord, cordKnob);

  // 6. Raycast hit box
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.28, dropH, blindW), hitMat);
  hit.position.set(0, -dropH / 2, 0);
  g.add(hit);

  const blindObj = {
    id: `lot_${lotId}_blind_${name}`,
    lotId,
    slats,
    tapes,
    bottomRail,
    cordKnob,
    open: true,
    progress: 0.0,
    dropH,
    dir: 1
  };

  hit.userData.blindObj = blindObj;

  const action = {
    label: () => (blindObj.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana'),
    run: () => {
      if (!canPlayerAccessLot(lotId)) {
        if (window.showToast) window.showToast('Apenas o morador ou pessoas com permissão no lote podem usar esta persiana.');
        else showFloatingToast('Apenas o morador ou pessoas com permissão no lote podem usar esta persiana.');
        return;
      }
      blindObj.open = !blindObj.open;
      if (window.MycoAudio) window.MycoAudio.playSwitch?.() || window.MycoAudio.playClick?.();
      ctx?.queueWorldStateChange?.(blindObj.id, blindObj.open ? 1 : 0);
    }
  };
  hit.userData.houseAction = action;
  headrail.userData.houseAction = action;
  slats.forEach((s) => { s.userData.houseAction = action; });

  if (ctx?.blindHitMeshes) ctx.blindHitMeshes.push(hit);
  if (ctx?.windowBlinds) ctx.windowBlinds.push(blindObj);

  parent.add(g);
  return { group: g, hit, blindObj };
}

function addDoorHandlesBothSides(pivot, mats, handleX, leafW, isLeft) {
  for (const side of [-1, 1]) {
    const panelT = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
    panelT.position.set(isLeft ? leafW / 2 : -leafW / 2, 0.52, side * 0.026);
    const panelB = makeBox(leafW - 0.14, 0.85, 0.012, mats.trim, { noShadow: true });
    panelB.position.set(isLeft ? leafW / 2 : -leafW / 2, -0.52, side * 0.026);
    const plate = makeBox(0.04, 0.18, 0.018, mats.accent, { noShadow: true });
    plate.position.set(handleX, 0, side * 0.034);
    const lever = makeBox(0.10, 0.025, 0.055, mats.accent, { noShadow: true });
    lever.position.set(isLeft ? handleX - 0.01 : handleX + 0.01, 0, side * 0.065);
    pivot.add(panelT, panelB, plate, lever);
  }
}

function createHouseDoubleDoor(parent, mats, x, y, z, frontDir, doorway = 1.90, lotId, ctx, eavesY = 4.70) {
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
  leftPivot.add(leftLeaf);
  addDoorHandlesBothSides(leftPivot, mats, leafW - 0.08, leafW, true);

  // Folha direita
  const rightPivot = new THREE.Group();
  rightPivot.position.set(doorway / 2 - 0.02, 0, 0);
  const rightLeaf = makeBox(leafW, doorH, leafThick, mats.wood);
  rightLeaf.position.set(-leafW / 2, 0, 0);
  rightPivot.add(rightLeaf);
  addDoorHandlesBothSides(rightPivot, mats, -leafW + 0.08, leafW, false);

  // Hitbox de interação
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(doorway + 0.2, doorH + 0.2, 0.44), hitMat);
  hit.position.set(0, 0, 0);
  g.add(leftPivot, rightPivot, hit);

  const doorObj = {
    id: `lot_${lotId}_front_door`,
    lotId,
    label: `Porta Casa #${lotId}`,
    leftPivot,
    rightPivot,
    angle: 0,
    dir: -frontDir,
    open: false,
    installed: false,
    uninstalledMaxY: -1,
    doorCollider: null,
    eavesY
  };

  hit.userData.doorObj = doorObj;
  leftLeaf.userData.doorObj = doorObj;
  rightLeaf.userData.doorObj = doorObj;

  const action = {
    label: () => (doorObj.open ? '🚪 Fechar Porta da Frente' : '🚪 Abrir Porta da Frente'),
    run: () => {
      if (!canPlayerAccessLot(lotId)) {
        if (window.showToast) window.showToast('Apenas o morador ou pessoas com permissão no lote podem usar esta porta.');
        else showFloatingToast('Apenas o morador ou pessoas com permissão no lote podem usar esta porta.');
        return;
      }
      doorObj.open = !doorObj.open;
      const swing = doorObj.open ? (frontDir * Math.PI * 0.48) : 0;
      leftPivot.rotation.y = swing;
      rightPivot.rotation.y = -swing;
      if (doorObj.doorCollider) doorObj.doorCollider.maxY = doorObj.open ? -1 : eavesY;
      ctx?.queueWorldStateChange?.(doorObj.id, doorObj.open ? 1 : 0);
      window.MycoAudio?.playDoor?.(doorObj.open) || window.MycoAudio?.playClick?.();
    }
  };
  hit.userData.houseAction = action;
  leftLeaf.userData.houseAction = action;
  rightLeaf.userData.houseAction = action;

  if (ctx?.doorHitMeshes) ctx.doorHitMeshes.push(hit, leftLeaf, rightLeaf);
  if (ctx?.campusDoors) ctx.campusDoors.push(doorObj);

  return {
    group: g,
    hit,
    leftLeaf,
    rightLeaf,
    doorObj,
    setCollider(c) { doorObj.doorCollider = c; }
  };
}

function createHouseBackDoor(parent, mats, x, y, z, frontDir, width = 1.18, lotId, ctx, eavesY = 4.70) {
  const pivot = new THREE.Group();
  pivot.position.set(x - width / 2, y, z);
  const doorH = 2.28;
  const leaf = makeBox(width, doorH, 0.055, mats.wood);
  leaf.position.set(width / 2, 0, 0);
  pivot.add(leaf);
  addDoorHandlesBothSides(pivot, mats, width - 0.12, width - 0.02, true);

  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, doorH + 0.2, 0.44), hitMat);
  hit.position.set(width / 2, 0, 0);
  pivot.add(hit);
  parent.add(pivot);

  const doorObj = {
    id: `lot_${lotId}_back_door`,
    lotId,
    label: `Porta dos Fundos #${lotId}`,
    pivot,
    angle: 0,
    dir: -frontDir,
    open: false,
    installed: false,
    uninstalledMaxY: eavesY,
    doorCollider: null,
    eavesY
  };

  hit.userData.doorObj = doorObj;
  leaf.userData.doorObj = doorObj;

  const action = {
    label: () => (doorObj.open ? '🚪 Fechar Porta dos Fundos' : '🚪 Abrir Porta dos Fundos'),
    run: () => {
      if (!canPlayerAccessLot(lotId)) {
        if (window.showToast) window.showToast('Apenas o morador ou pessoas com permissão no lote podem usar esta porta.');
        else showFloatingToast('Apenas o morador ou pessoas com permissão no lote podem usar esta porta.');
        return;
      }
      doorObj.open = !doorObj.open;
      pivot.rotation.y = doorObj.open ? (frontDir * Math.PI * 0.48) : 0;
      if (doorObj.doorCollider) doorObj.doorCollider.maxY = doorObj.open ? -1 : eavesY;
      ctx?.queueWorldStateChange?.(doorObj.id, doorObj.open ? 1 : 0);
      window.MycoAudio?.playDoor?.(doorObj.open) || window.MycoAudio?.playClick?.();
    }
  };
  hit.userData.houseAction = action;
  leaf.userData.houseAction = action;

  if (ctx?.doorHitMeshes) ctx.doorHitMeshes.push(hit, leaf);
  if (ctx?.campusDoors) ctx.campusDoors.push(doorObj);

  return {
    pivot,
    hit,
    leaf,
    doorObj,
    setCollider(c) { doorObj.doorCollider = c; }
  };
}

function createWallMenuPanel(parent, mats, x, y, z, rotY, lotId) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

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

  return { group: g, hit, frame, face };
}

function buildGardenAndChristmasLights(root, x, houseZ, doorZ, backZ, front, width, eavesY, gableH, mats) {
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

  const bulbs = [];
  const pushLine = (x1, y1, z1, x2, y2, z2, count, sag = 0) => {
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const drop = sag ? sag * Math.sin(t * Math.PI) : 0;
      bulbs.push([
        x1 + (x2 - x1) * t,
        y1 + (y2 - y1) * t - drop,
        z1 + (z2 - z1) * t,
        CHRISTMAS_PALETTE[bulbs.length % CHRISTMAS_PALETTE.length]
      ]);
    }
  };

  const halfW = width / 2 + 0.18;
  const frontZ = doorZ + front * 0.22;
  const rearZ = backZ - front * 0.22;
  pushLine(x - halfW, eavesY - 0.08, frontZ, x + halfW, eavesY - 0.08, frontZ, 18, 0.05);
  pushLine(x - halfW, eavesY - 0.08, rearZ, x + halfW, eavesY - 0.08, rearZ, 18, 0.05);
  pushLine(x - halfW, eavesY - 0.16, backZ, x - halfW, eavesY - 0.16, doorZ, 14, 0.04);
  pushLine(x + halfW, eavesY - 0.16, backZ, x + halfW, eavesY - 0.16, doorZ, 14, 0.04);

  const gablePeakY = eavesY + gableH;
  const frontGableZ = doorZ + front * 0.24;
  const backGableZ = backZ - front * 0.24;
  pushLine(x - width / 2 - 0.15, eavesY - 0.05, frontGableZ, x, gablePeakY, frontGableZ, 9);
  pushLine(x, gablePeakY, frontGableZ, x + width / 2 + 0.15, eavesY - 0.05, frontGableZ, 9);
  pushLine(x - width / 2 - 0.15, eavesY - 0.05, backGableZ, x, gablePeakY, backGableZ, 9);
  pushLine(x, gablePeakY, backGableZ, x + width / 2 + 0.15, eavesY - 0.05, backGableZ, 9);

  const treeX = x - front * 7.9;
  const treeZ = houseZ + front * 3.35;
  const treeCount = 28;
  for (let i = 0; i < treeCount; i++) {
    const t = i / (treeCount - 1);
    const y = 1.35 + t * 1.90;
    const angle = t * Math.PI * 7;
    const r = t < 0.35
      ? (1.05 + (t / 0.35) * 0.17)
      : (1.22 - ((t - 0.35) / 0.65) * 0.77);
    bulbs.push([
      treeX + Math.cos(angle) * r,
      y,
      treeZ + Math.sin(angle) * r,
      CHRISTMAS_PALETTE[bulbs.length % CHRISTMAS_PALETTE.length]
    ]);
  }
  bulbs.push([treeX, 3.38, treeZ, 0xffd166]);

  if (THREE.InstancedMesh && THREE.SphereGeometry && THREE.Matrix4 && THREE.Color) {
    const bulbGeo = new THREE.SphereGeometry(0.055, 6, 5);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbs.length);
    const mat4 = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < bulbs.length; i++) {
      const [bx, by, bz, hex] = bulbs[i];
      mat4.makeTranslation(bx, by, bz);
      inst.setMatrixAt(i, mat4);
      col.setHex(hex);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    gardenLightGrp.add(inst);
  }

  let gardenPointLight = null;
  if (THREE.PointLight) {
    gardenPointLight = new THREE.PointLight(0xffe09a, 1.6, 14, 1.5);
    gardenPointLight.position.set(x - front * 2.2, 2.5, doorZ + front * 2.2);
    gardenPointLight.visible = false;
    gardenLightGrp.add(gardenPointLight);
  }

  gardenLightGrp.visible = false;
  root.add(gardenLightGrp);
  return { gardenLightGrp, gardenPointLight };
}

export function attachHouseUpgradesToLot(ctx, root, lot, mats, dims) {
  const { x, front, houseZ, doorZ, id } = lot;
  const { width, depth, doorway = 1.90, floorY, eavesY, gableH = 1.62, addSolidWall, addWalkableSlab, box } = dims;
  const backZ = houseZ - front * depth / 2;
  const hitList = ctx.houseInteractMeshes || (ctx.houseInteractMeshes = []);
  const dynList = ctx.houseDynamicObjects || (ctx.houseDynamicObjects = []);

  // 1. Janela traseira com persiana veneziana
  const backWinX = x - front * 2.1;
  const backDoorX = x + front * 1.9;
  const backBlind = createCottageVenetianBlind(
    root, mats, backWinX, 2.24, backZ + front * 0.08,
    front === 1 ? -Math.PI / 2 : Math.PI / 2, id, 'back', ctx
  );
  markDynamic(backBlind.group, dynList);
  hitList.push(backBlind.hit);

  // Persianas venezianas frontais (visíveis com 'blinds')
  const fBlinds = [
    createCottageVenetianBlind(root, mats, x - 2.46, 2.24, doorZ - front * 0.08, front === 1 ? Math.PI / 2 : -Math.PI / 2, id, 'front_left', ctx),
    createCottageVenetianBlind(root, mats, x + 2.46, 2.24, doorZ - front * 0.08, front === 1 ? Math.PI / 2 : -Math.PI / 2, id, 'front_right', ctx)
  ];
  fBlinds.forEach((b) => {
    b.group.visible = false;
    markDynamic(b.group, dynList);
    hitList.push(b.hit);
  });

  // 2. Painel inteligente na parede interna
  const panelX = x - front * (doorway / 2 + 0.38);
  const panel = createWallMenuPanel(root, mats, panelX, 1.55, doorZ - front * 0.14, front === 1 ? Math.PI : 0, id);
  markDynamic(panel.group, dynList);
  hitList.push(panel.hit, panel.frame, panel.face);

  // 3. Iluminação interna presa na cumeeira do teto + Natal/Jardim
  const peakY = eavesY + gableH - 0.06;
  const houseLightGrp = new THREE.Group();
  const lampWood = makeBox(0.56, 0.08, 0.56, mats.wood, { noShadow: true });
  lampWood.position.set(x, peakY, houseZ);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6df });
  const lampGlow = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.44), lampMat);
  lampGlow.position.set(x, peakY - 0.06, houseZ);
  houseLightGrp.add(lampWood, lampGlow);
  let housePointLight = null;
  if (THREE.PointLight) {
    housePointLight = new THREE.PointLight(0xffe6b3, 2.5, 16, 1.4);
    housePointLight.position.set(x, peakY - 0.35, houseZ);
    housePointLight.visible = false;
    houseLightGrp.add(housePointLight);
  }
  houseLightGrp.visible = false;
  markDynamic(houseLightGrp, dynList);
  root.add(houseLightGrp);

  const { gardenLightGrp, gardenPointLight } = buildGardenAndChristmasLights(
    root, x, houseZ, doorZ, backZ, front, width, eavesY, gableH, mats
  );
  markDynamic(gardenLightGrp, dynList);

  // 4. Porta da Frente Dupla e Porta dos Fundos
  const fDoor = createHouseDoubleDoor(root, mats, x, 1.24, doorZ, front, doorway, id, ctx, eavesY);
  fDoor.group.visible = false;
  markDynamic(fDoor.group, dynList);
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

  const bDoor = createHouseBackDoor(root, mats, backDoorX, 1.24, backZ, front, 1.18, id, ctx, eavesY);
  bDoor.pivot.visible = false;
  markDynamic(bDoor.pivot, dynList);
  hitList.push(bDoor.hit, bDoor.leaf);

  const backDoorSealWall = addSolidWall(root, ctx.wallSegments, backDoorX - 0.6, backZ, backDoorX + 0.6, backZ, floorY, 2.44 - floorY, 0.24, mats.wall);
  markDynamic(backDoorSealWall, dynList);
  const backDoorSealCollider = ctx.wallSegments[ctx.wallSegments.length - 1];
  backDoorSealCollider.maxY = eavesY;
  bDoor.setCollider(backDoorSealCollider);

  // Fechamento dinâmico do cercado traseiro (aberto ao comprar 'back_door')
  const fenceBackZ = (typeof lot.z === 'number' ? lot.z : (houseZ + front * 4)) - front * 10;
  const backFenceSealGrp = new THREE.Group();
  for (const ry of [0.39, 0.77]) {
    box(backFenceSealGrp, mats.wood, backDoorX, ry, fenceBackZ, 2.20, 0.12, 0.13);
  }
  for (const px of [backDoorX - 0.38, backDoorX + 0.38]) {
    box(backFenceSealGrp, mats.wood, px, 0.50, fenceBackZ, 0.15, 1.0, 0.15);
  }
  markDynamic(backFenceSealGrp, dynList);
  root.add(backFenceSealGrp);
  const backFenceSealCollider = {
    x1: backDoorX - 1.1,
    z1: fenceBackZ,
    x2: backDoorX + 1.1,
    z2: fenceBackZ,
    minY: 0,
    maxY: 0.98,
    halfThick: 0.12
  };
  ctx.wallSegments.push(backFenceSealCollider);

  // Batente, soleira e trilha de saída nos fundos (visíveis ao comprar 'back_door')
  const backPathGrp = new THREE.Group();
  box(backPathGrp, mats.trim, backDoorX, floorY - 0.096, backZ - front * 0.42, 1.48, 0.18, 0.60);
  for (const off of [-0.60, 0.60]) {
    box(backPathGrp, mats.trim, backDoorX + off, 1.2275, backZ, 0.11, 2.255, 0.30);
  }
  box(backPathGrp, mats.trim, backDoorX, 2.41, backZ, 1.32, 0.12, 0.32);
  const pathStartZ = backZ - front * 0.12;
  const pathEndZ = fenceBackZ - front * 1.6;
  const pathLen = Math.abs(pathEndZ - pathStartZ);
  const backPathMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.65, pathLen), mats.path || mats.trim);
  backPathMesh.rotation.x = -Math.PI / 2;
  backPathMesh.position.set(backDoorX, 0.034, (pathStartZ + pathEndZ) / 2);
  backPathMesh.receiveShadow = true;
  backPathGrp.add(backPathMesh);
  backPathGrp.visible = false;
  markDynamic(backPathGrp, dynList);
  root.add(backPathGrp);

  // 5. Segundo andar + escada (mezanino elegante nos fundos com pé-direito alto)
  const secondFloorGrp = new THREE.Group();
  const loftY = 2.40;
  const loftW = width - 0.24; // 8.16m, cobre de parede a parede
  const loftD = 3.30; // metade traseira da casa
  const loftZ = (backZ + houseZ) / 2;
  const frontEdgeZ = houseZ;

  // Piso de madeira nobre do mezanino
  const loftFloor = addWalkableSlab(secondFloorGrp, ctx.walkableFloors, x, loftY, loftZ, loftW, 0.10, loftD, mats.floor);
  const loftSlabObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
  loftSlabObj._disabled = true;

  // Viga mestra frontal robusta (abaixo do piso para zero z-fighting)
  box(secondFloorGrp, mats.wood, x, loftY - 0.18, frontEdgeZ, loftW, 0.16, 0.16);

  // Vigas estruturais sob o piso (encostadas por baixo, sem faces coplanares)
  for (let j = -2; j <= 2; j++) {
    box(secondFloorGrp, mats.wood, x + j * 1.5, loftY - 0.17, loftZ, 0.10, 0.14, loftD - 0.08);
  }

  // Pilares estruturais encostados na parede oposta à escada (ZERO pilares no meio da sala)
  const postH = loftY - 0.10 - floorY;
  const postMidY = (loftY - 0.10 + floorY) / 2;
  box(secondFloorGrp, mats.wood, x - front * 3.70, postMidY, frontEdgeZ, 0.16, postH, 0.16);
  box(secondFloorGrp, mats.wood, x - front * 3.70, postMidY, backZ + front * 0.14, 0.16, postH, 0.16);

  // Guarda-corpo de proteção com corrimão e ripas verticais elegantes
  // Deixa abertura de ~1.20m para a chegada da escada
  const railW = loftW - 1.30;
  const railCenterX = x - front * 0.65;
  box(secondFloorGrp, mats.wood, railCenterX, loftY + 0.88, frontEdgeZ, railW, 0.07, 0.07);
  box(secondFloorGrp, mats.wood, railCenterX, loftY + 0.08, frontEdgeZ, railW, 0.06, 0.06);
  const spindleCount = Math.floor(railW / 0.26);
  for (let sp = 0; sp <= spindleCount; sp++) {
    const sx = railCenterX - railW / 2 + sp * (railW / spindleCount);
    box(secondFloorGrp, mats.trim, sx, loftY + 0.48, frontEdgeZ, 0.035, 0.74, 0.035);
  }
  // Coluna de terminação do corrimão na abertura da escada
  box(secondFloorGrp, mats.wood, railCenterX + front * (railW / 2), loftY + 0.48, frontEdgeZ, 0.09, 0.92, 0.09);

  // Colisor do guarda-corpo para impedir queda do segundo andar
  const railCollider = {
    x1: x - front * 4.05,
    z1: frontEdgeZ,
    x2: railCenterX + front * (railW / 2),
    z2: frontEdgeZ,
    halfThick: 0.10,
    minY: loftY,
    maxY: -1
  };
  ctx.wallSegments.push(railCollider);

  // Escada caminhável encostada na parede lateral
  const stairX = x + front * 3.55;
  const steps = 12;
  const stairZStart = houseZ + front * 2.50;
  const stairZEnd = houseZ - front * 0.10;
  const stepSlabs = [];

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const sy = floorY + (loftY - floorY) * t;
    const sz = stairZStart + (stairZEnd - stairZStart) * t;
    addWalkableSlab(secondFloorGrp, ctx.walkableFloors, stairX, sy, sz, 0.90, 0.06, 0.26, mats.wood);
    const stObj = ctx.walkableFloors[ctx.walkableFloors.length - 1];
    stObj._disabled = true;
    stepSlabs.push(stObj);
    // Espelho vertical fechando o vão do degrau
    box(secondFloorGrp, mats.trim, stairX, sy - 0.10, sz - front * 0.11, 0.88, 0.18, 0.03);
  }

  // Painel de fechamento maciço sob a escada e longarina lateral
  const stairRunZ = stairZEnd - stairZStart;
  const stairMidZ = (stairZStart + stairZEnd) / 2;
  const stairMidY = (floorY + loftY) / 2;
  const stairInnerX = stairX - front * 0.46;
  const stairRunLen = Math.hypot(stairRunZ, loftY - floorY);
  const stairAngle = Math.atan2(loftY - floorY, Math.abs(stairRunZ));

  // Longarina de madeira
  const stringer = box(secondFloorGrp, mats.wood, stairInnerX, stairMidY, stairMidZ, 0.06, 0.16, stairRunLen + 0.10);
  stringer.rotation.x = front === 1 ? stairAngle : -stairAngle;

  // Painelamento ripado sob a escada (impede visão e passagem por baixo)
  for (let p = 0; p <= 8; p++) {
    const pt = p / 8;
    const pz = stairZStart + stairRunZ * pt;
    const ph = (loftY - floorY) * pt;
    if (ph > 0.15) {
      box(secondFloorGrp, mats.wall, stairInnerX, floorY + ph / 2, pz, 0.04, ph, Math.abs(stairRunZ) / 8 + 0.02);
    }
  }

  // Colunas verticais de suporte do corrimão (newel posts)
  for (const tPost of [0, 0.33, 0.67, 1.0]) {
    const py = floorY + (loftY - floorY) * tPost + 0.44;
    const pz = stairZStart + stairRunZ * tPost;
    box(secondFloorGrp, mats.wood, stairInnerX, py, pz, 0.06, 0.88, 0.06);
  }
  // Corrimão contínuo apoiado nas colunas
  const handrail = box(secondFloorGrp, mats.wood, stairInnerX, stairMidY + 0.88, stairMidZ, 0.06, 0.06, stairRunLen + 0.12);
  handrail.rotation.x = front === 1 ? stairAngle : -stairAngle;

  // Colisor de parede lateral sob a escada: IMPEDE o jogador de passar por baixo / atravessar de lado igual fantasma!
  const stairSideWall = {
    x1: stairInnerX,
    z1: stairZStart,
    x2: stairInnerX,
    z2: stairZEnd,
    halfThick: 0.12,
    minY: floorY,
    maxY: -1
  };
  ctx.wallSegments.push(stairSideWall);

  // Registro no stairsList para subida 100% contínua e suave da física
  const stairBox = {
    minX: Math.min(stairX - 0.50, stairX + 0.50),
    maxX: Math.max(stairX - 0.50, stairX + 0.50),
    zStart: stairZStart,
    zEnd: stairZEnd,
    yStart: floorY,
    yEnd: loftY,
    _disabled: true
  };
  if (ctx.stairsList) ctx.stairsList.push(stairBox);

  // Superfície de apoio no piso do mezanino para posicionar itens/vasos/caixas
  let loftSurf = null;
  if (ctx.supportSurfaces && ctx.supportMeshes) {
    loftSurf = {
      minX: x - loftW / 2,
      maxX: x + loftW / 2,
      minZ: Math.min(loftZ - loftD / 2, loftZ + loftD / 2),
      maxZ: Math.max(loftZ - loftD / 2, loftZ + loftD / 2),
      topY: loftY + 0.06,
      _disabled: true
    };
    loftFloor.userData.supportSurface = loftSurf;
    ctx.supportSurfaces.push(loftSurf);
    ctx.supportMeshes.push(loftFloor);
  }
  secondFloorGrp.visible = false;
  markDynamic(secondFloorGrp, dynList);
  root.add(secondFloorGrp);

  lotHooks.set(id, {
    upgrades: {},
    apply(u = {}) {
      this.upgrades = u || {};
      houseLightGrp.visible = !!u.house_lights;
      if (housePointLight) housePointLight.visible = !!u.house_lights;
      gardenLightGrp.visible = !!u.garden_lights;
      if (gardenPointLight) gardenPointLight.visible = !!u.garden_lights;
      fBlinds.forEach((b) => { b.group.visible = !!u.blinds; });
      if (!u.front_door) fDoor.doorObj.open = false;
      fDoor.doorObj.installed = !!u.front_door;
      fDoor.group.visible = !!u.front_door;
      frontDoorCollider.maxY = (u.front_door && !fDoor.doorObj.open) ? eavesY : -1;
      if (!u.back_door) bDoor.doorObj.open = false;
      bDoor.doorObj.installed = !!u.back_door;
      bDoor.pivot.visible = !!u.back_door;
      if (backDoorSealWall) backDoorSealWall.visible = !u.back_door;
      if (backDoorSealCollider) backDoorSealCollider.maxY = (u.back_door && bDoor.doorObj.open) ? -1 : eavesY;
      backFenceSealGrp.visible = !u.back_door;
      backFenceSealCollider.maxY = u.back_door ? -1 : 0.98;
      backPathGrp.visible = !!u.back_door;
      secondFloorGrp.visible = !!u.second_floor;
      loftSlabObj._disabled = !u.second_floor;
      stairBox._disabled = !u.second_floor;
      stepSlabs.forEach((st) => { st._disabled = !u.second_floor; });
      if (loftSurf) loftSurf._disabled = !u.second_floor;
      stairSideWall.maxY = u.second_floor ? (loftY + 1.0) : -1;
      railCollider.maxY = u.second_floor ? (loftY + 1.10) : -1;
    }
  });
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

    let cur = h.object;
    let visible = true;
    while (cur) {
      if (cur.visible === false) { visible = false; break; }
      if (cur === ctx.scene) break;
      cur = cur.parent;
    }
    if (!visible) continue;

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
      `<div class="flex items-center justify-between border-b border-slate-700/60 pb-2.5 shrink-0 gap-2">` +
        `<div class="font-bold text-base flex items-center gap-2 flex-wrap"><span>🏡</span><span>Painel de Melhorias</span> <span id="house-up-lot" class="text-cyan-400 font-mono text-xs px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40"></span> <span id="house-up-coins" class="text-amber-300 font-mono text-xs px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-500/40"></span></div>` +
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

  if (appState.currentUser) {
    apiPost('api/village.php?action=status', {}, true)
      .then((res) => {
        if (!res?.ok || !Array.isArray(res.lots)) return;
        const lease = res.lots.find((row) => row.mine);
        appState.villageLease = lease ? { id: lease.id, expires_at: lease.expires_at } : null;
        if (typeof res.myco_coins === 'number' && appState.currentUser) {
          appState.currentUser.myco_coins = res.myco_coins;
          const pendingDelta = pendingCoinOperations(appState.currentUser.id)
            .reduce((sum, entry) => sum + entry.delta, 0);
          setLocalMycoCoins(res.myco_coins + pendingDelta);
        }
        applyVillageUpgrades(res.lots);
      })
      .catch(() => {});
  }
}

function renderHouseUpgradesModal(lotId) {
  const list = document.getElementById('house-up-list');
  const lotEl = document.getElementById('house-up-lot');
  const coinsEl = document.getElementById('house-up-coins');
  if (!list) return;
  if (lotEl) lotEl.textContent = `#${lotId}`;
  if (coinsEl) coinsEl.textContent = `🪙 ${getLocalMycoCoins()}`;
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
        if (btn.disabled) return;
        btn.disabled = true;
        try {
          await window.flushCampusMycoCoins?.();
          const res = await apiPost('api/village.php?action=buy_upgrade', { lot_id: lotId, upgrade_id: u.id }, true);
          if (res?.ok) {
            if (Array.isArray(res.lots)) applyVillageUpgrades(res.lots);
            if (typeof res.myco_coins === 'number' && appState.currentUser) {
              appState.currentUser.myco_coins = res.myco_coins;
              const pendingDelta = pendingCoinOperations(appState.currentUser.id)
                .reduce((sum, entry) => sum + entry.delta, 0);
              setLocalMycoCoins(res.myco_coins + pendingDelta);
            }
            appState.lastUpgradesVer = '';
            events.emit('sync:now');
            window.MycoAudio?.playClick?.();
            showFloatingToast(`🏡 ${u.name} instalado!`);
            if (currentModalLotId === lotId) renderHouseUpgradesModal(lotId);
          } else {
            btn.disabled = false;
            showFloatingToast(res?.error || 'Não foi possível comprar.');
          }
        } catch {
          btn.disabled = false;
          showFloatingToast('Erro de conexão ao comprar melhoria.');
        }
      };
    }
    card.appendChild(btn);
    list.appendChild(card);
  }
}
