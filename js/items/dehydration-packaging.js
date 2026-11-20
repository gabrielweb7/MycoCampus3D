/**
 * Sala de Desidratação, Embalagem & Drive-Thru de Vendas na Estrada (MycoCampus3D)
 *
 * Fluxo completo multiplayer:
 * 1. Cogumelo fresco colhido -> vai para uma das 6 Desidratadoras na Sala de Desidratação (Ala Leste-Norte).
 * 2. Quando fica Crocante (0% umidade) -> retirar gera um Lote de 25g de Cogumelos Desidratados Crocantes na mão.
 * 3. Pegar o Lote de 25g e colocar em um Saco Zip-Lock / Pouch de Cogumelos (`makeMushroomBag`) -> Saco Cheio (Aberto).
 * 4. Levar o Saco Cheio até uma das Seladoras Térmicas (`heat_sealer`) -> Sela o saco a vácuo/quente (`sealed = true`)!
 * 5. Pegar o Saco Selado e colocar dentro de uma Caixa de Entrega (`makeDeliveryCrate`, capacidade 4 pacotes selados).
 * 6. Levar a Caixa de Entrega (com 1 a 4 pacotes selados) até o Ponto de Venda Drive-Thru na Estrada Sul (x: 11.5, z: 36.2).
 * 7. Assim que houver pacotes disponíveis no Ponto de Venda, carros com NPCs variados aparecem na estrada em intervalos diferentes:
 *    - O carro encosta na baia do Drive-Thru e para.
 *    - O NPC abre a porta, desce do carro e caminha até o balcão de entrega.
 *    - Faz a animação pagando em dinheiro vivo (notas verdes subindo + som de caixa registradora + MycoCoins 🪙 creditados!).
 *    - Fica feliz (pula/comemora com balão de fala), pega o pacote de cogumelos na mão, volta para o carro, entra e vai embora pela estrada!
 */

import { makeBox, brickMat, woodMat, updateTextSprite } from '../engine/textures.js';
import { getCachedCanvasTexture, registerPickable, disposeObjectResources, updateItemBounds } from './item-registry.js';
import { addWallLabBench } from './laminar-hood.js';
import { addMovableStainlessTable } from './stainless-table.js';
import { buildCuteAvatar, drawAvatarFace } from '../entities/avatars.js';

const THREE = window.THREE;

export const MYCOCOIN_PRICE_PER_PACK = 120; // 🪙 120 MycoCoins por pacote selado de 25g (4 pacotes na caixa = 🪙 480!)
export const DELIVERY_CRATE_MAX_PACKS = 4;

export const roadSaleStandMeshes = [];
export const roadSaleDynamicObjects = [];

export const roadStandState = {
  availablePacks: 0,
  speciesList: [],
  standPacksMeshes: [],
  signCanvas: null,
  signCtx: null,
  signTex: null,
  npcSpawnCooldown: 2.5,
  activeNpcOrder: null,
  totalSoldPacks: 0,
  totalCoinsEarned: 0
};

const NPC_PROFILES = [
  { name: 'Dr. Henrique (Neurocientista)', carColor: 0x2563eb, shirtColor: 0x0284c7, hatColor: 0x1e3a8a, quote: '🍄 "Qualidade clínica impecável! Aqui estão seus 🪙 120 MycoCoins!"' },
  { name: 'Chef Sofia (Gastronomia)', carColor: 0xdc2626, shirtColor: 0xf43f5e, hatColor: 0xfef08a, quote: '✨ "Crocantes a 0% de umidade e selados! Toma 🪙 120 MycoCoins!"' },
  { name: 'Prof. Otávio (Botânico)', carColor: 0x16a34a, shirtColor: 0x10b981, hatColor: 0x78350f, quote: '🌿 "Linhagem rizomórfica pura! Pagamento na mão: 🪙 120 MycoCoins!"' },
  { name: 'Marina (Terapeuta)', carColor: 0x9333ea, shirtColor: 0xa855f7, hatColor: 0xf472b6, quote: '💜 "Embalagem selada perfeita! Muito obrigada, +🪙 120 MycoCoins!"' },
  { name: 'Lucas (Colecionador)', carColor: 0xeab308, shirtColor: 0xf59e0b, hatColor: 0x111827, quote: '🤩 "Direto do laboratório da universidade! Vale cada MycoCoin!"' }
];

function playAudio(method) {
  if (typeof window !== 'undefined' && window.MycoAudio && typeof window.MycoAudio[method] === 'function') {
    window.MycoAudio[method]();
  }
}

let memoryMycoCoinsFallback = 250;

export function getLocalMycoCoins() {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem('myco_coins_balance');
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          memoryMycoCoinsFallback = parsed;
          return parsed;
        }
      }
    }
  } catch (e) {}
  return memoryMycoCoinsFallback;
}

export function setLocalMycoCoins(value) {
  const next = Math.max(0, Math.min(999999, Math.round(Number(value) || 0)));
  memoryMycoCoinsFallback = next;
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('myco_coins_balance', String(next));
    }
  } catch (e) {}
  if (typeof document !== 'undefined') {
    const elHud = document.getElementById('hud-coins');
    if (elHud) elHud.textContent = String(next);
    const elShop = document.getElementById('shop-user-coins');
    if (elShop) elShop.textContent = String(next);
  }
  return next;
}

export function addLocalMycoCoins(amount) {
  const delta = Number(amount) || 0;
  const cur = getLocalMycoCoins();
  const next = setLocalMycoCoins(cur + delta);
  if (delta !== 0 && typeof window !== 'undefined' && typeof window.syncCampusMycoCoins === 'function') {
    window.syncCampusMycoCoins(delta);
  }
  return next;
}

// ============================================================================
// 1. SACO DE EMBALAGEM DE COGUMELOS DESIDRATADOS (Vazio -> Cheio -> Selado)
// ============================================================================

function createMushroomPackVisual(filled, sealed) {
  const wrap = new THREE.Group();
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42 });
  const filmMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.42,
    roughness: 0.12,
    depthWrite: false
  });
  const labelTex = getCachedCanvasTexture('myco_pack_label_v2', 256, 256, (lctx) => {
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(0, 0, 256, 256);
    lctx.strokeStyle = '#16a34a';
    lctx.lineWidth = 6;
    lctx.strokeRect(6, 6, 244, 244);

    // Logo cogumelo vermelho no topo
    lctx.fillStyle = '#dc2626';
    lctx.beginPath();
    lctx.arc(128, 56, 26, Math.PI, 0);
    lctx.fill();
    lctx.fillStyle = '#fef3c7';
    lctx.fillRect(118, 56, 20, 18);

    // Faixa verde central bem enquadrada sem cortar
    lctx.fillStyle = '#16a34a';
    lctx.fillRect(12, 86, 232, 86);
    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 28px system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.fillText('MycoCampus', 128, 122);
    lctx.fillStyle = '#fef08a';
    lctx.font = 'bold 21px system-ui, sans-serif';
    lctx.fillText('COGUMELO • 10g', 128, 156);

    // Código de barras estilizado embaixo
    lctx.fillStyle = '#0f172a';
    for (let bx = 42; bx < 214; bx += 8) {
      lctx.fillRect(bx, 190, (bx % 16 === 0) ? 4 : 2, 42);
    }
  });
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.35 });

  // Bandeja / Saco branco base
  const tray = makeBox(0.145, 0.016, 0.175, trayMat);
  tray.position.y = 0.008;
  wrap.add(tray);

  // Cogumelos visíveis dentro do saquinho/bandeja (como nas fotos 3 e 4!)
  const contentsGroup = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.48 });
  const sGeo = new THREE.CylinderGeometry(0.007, 0.009, 0.036, 6);
  const cGeo = new THREE.SphereGeometry(0.018, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58);
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ox = (col === 0 ? -1 : 1) * 0.030;
    const oz = (row - 1) * 0.042;
    const st = new THREE.Mesh(sGeo, stemMat);
    st.rotation.x = Math.PI / 2;
    st.rotation.z = (i - 2.5) * 0.22;
    st.position.set(ox, 0.022, oz + 0.008);
    const cp = new THREE.Mesh(cGeo, capMat);
    cp.position.set(ox, 0.026, oz - 0.012);
    contentsGroup.add(st, cp);
  }
  contentsGroup.visible = Boolean(filled);
  wrap.add(contentsGroup);

  // Filme plástico transparente envolvendo + Etiqueta verde impressa em cima
  const film = makeBox(0.142, 0.026, 0.172, filmMat, { noShadow: true });
  film.position.y = 0.025;
  wrap.add(film);

  const labelSticker = makeBox(0.075, 0.003, 0.085, labelMat, { noShadow: true });
  labelSticker.position.set(0, 0.039, 0);
  labelSticker.visible = Boolean(sealed);
  wrap.add(labelSticker);

  // Boca aberta do saquinho quando ainda NÃO selado na seladora térmica
  const openCollarMesh = makeBox(0.140, 0.022, 0.012, filmMat, { noShadow: true });
  openCollarMesh.position.set(0, 0.044, -0.078);
  openCollarMesh.rotation.x = -0.35;
  openCollarMesh.visible = !sealed;
  wrap.add(openCollarMesh);

  const sealStripMesh = makeBox(0.144, 0.008, 0.015, new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    emissive: 0x059669,
    emissiveIntensity: 0.35,
    roughness: 0.25
  }));
  sealStripMesh.position.set(0, 0.036, -0.076);
  sealStripMesh.visible = Boolean(sealed);
  wrap.add(sealStripMesh);

  return { wrap, contentsGroup, sealStripMesh, labelSticker, openCollarMesh };
}

export function updateMushroomBagVisual(item) {
  if (!item || !item.mushroomBagCtrl) return;
  const bc = item.mushroomBagCtrl;
  if (bc.contentsMesh) bc.contentsMesh.visible = bc.filled;
  if (bc.labelSticker) bc.labelSticker.visible = bc.sealed;
  if (bc.openCollarMesh) bc.openCollarMesh.visible = !bc.sealed;
  if (bc.sealStripMesh) {
    bc.sealStripMesh.visible = bc.sealed;
    if (bc.sealStripMesh.material && bc.sealStripMesh.material.color) {
      bc.sealStripMesh.material.color.setHex(bc.sealed ? 0x16a34a : 0x64748b);
    }
  }
  const spTag = bc.speciesName ? ` • ${bc.speciesName}` : '';
  if (bc.sealed) {
    item.label = `📦 Pacote Selado de Cogumelos (${bc.grams}g Crocantes${spTag} • Pronto p/ Caixote!)`;
  } else if (bc.filled) {
    item.label = `🛍️ Saco com Cogumelos Secos (${bc.grams}g${spTag} • Segure e aponte na Seladora Térmica!)`;
  } else {
    item.label = '🛍️ Saco/Bandeja Vazia p/ Cogumelos Secos (Coloque 10g de Cogumelos Crocantes)';
  }
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function makeMushroomBag(ctx, id, px, py, pz, opts = {}) {
  const vis = createMushroomPackVisual(opts.filled, opts.sealed);
  const g = vis.wrap;
  g.userData.isMushroomBag = true;

  const item = registerPickable(
    ctx,
    id,
    '🛍️ Saco/Bandeja Vazia p/ Cogumelos Secos',
    g,
    px,
    py,
    pz,
    opts.ry || 0,
    0.13,
    0.06,
    {
      category: 'packaging',
      purpose: 'Embalagem transparente com visor e etiqueta para embalar 10g de cogumelos desidratados e selar na Seladora Térmica',
      getWeightGrams: (it) => 8 + ((it && it.mushroomBagCtrl && it.mushroomBagCtrl.filled) ? (it.mushroomBagCtrl.grams || 10) : 0),
      compatibilities: {
        canEnterCooker: false,
        isMushroomPackBag: true
      },
      serializeState: (it) => {
        const bc = it && it.mushroomBagCtrl;
        if (!bc) return null;
        return {
          filled: !!bc.filled,
          sealed: !!bc.sealed,
          grams: bc.filled ? Math.max(1, Math.min(200, Math.round(Number(bc.grams) || 10))) : 0,
          speciesName: bc.speciesName ? String(bc.speciesName).slice(0, 60) : '',
          removed: !!it._removedForSync
        };
      },
      applyState: (it, custom) => {
        const bc = it && it.mushroomBagCtrl;
        if (!bc || !custom) return;
        bc.filled = !!custom.filled;
        bc.sealed = !!custom.sealed;
        bc.grams = bc.filled ? Math.max(1, Math.min(200, Math.round(Number(custom.grams) || 10))) : 0;
        bc.speciesName = typeof custom.speciesName === 'string' ? custom.speciesName : '';
        updateMushroomBagVisual(it);
      }
    }
  );

  item.mushroomBagCtrl = {
    filled: Boolean(opts.filled),
    sealed: Boolean(opts.sealed),
    grams: opts.filled ? (opts.grams || 10) : 0,
    speciesName: opts.speciesName || '',
    contentsMesh: vis.contentsGroup,
    sealStripMesh: vis.sealStripMesh,
    labelSticker: vis.labelSticker,
    openCollarMesh: vis.openCollarMesh,
    updateVisual: () => updateMushroomBagVisual(item)
  };
  updateMushroomBagVisual(item);
  return item;
}

export function packDriedMushroomsIntoBag(ctx, bagItem, driedBatchItem) {
  if (!bagItem || !bagItem.mushroomBagCtrl || !driedBatchItem || !driedBatchItem.driedMushroomCtrl) return false;
  const bc = bagItem.mushroomBagCtrl;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;
  if (bc.filled) {
    if (onToast) onToast('⚠️ Este saco já está cheio com cogumelos secos! Segure e aponte na Seladora Térmica.');
    return true;
  }
  const dc = driedBatchItem.driedMushroomCtrl;
  bc.filled = true;
  bc.sealed = false;
  bc.grams = dc.grams || 10;
  bc.speciesName = dc.speciesName || 'Golden Teacher';
  updateMushroomBagVisual(bagItem);
  if (ctx && ctx.markItemMoved) ctx.markItemMoved(bagItem);
  driedBatchItem._removedForSync = true;
  if (ctx && ctx.pendingMovedItems && driedBatchItem.id) {
    ctx.pendingMovedItems[driedBatchItem.id] = {
      id: driedBatchItem.id,
      state: { custom: { dynamicKind: 'dried_batch', removed: true } }
    };
  }

  // Consome o lote da mão ou da bancada
  if (driedBatchItem.mesh && driedBatchItem.mesh.parent) {
    driedBatchItem.mesh.parent.remove(driedBatchItem.mesh);
  }
  disposeObjectResources(driedBatchItem.mesh);
  if (ctx && Array.isArray(ctx.pickableItems)) {
    const idx = ctx.pickableItems.indexOf(driedBatchItem);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  }
  if (ctx && ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(driedBatchItem.id);
  }
  if (ctx && ctx.heldItem === driedBatchItem) {
    ctx.heldItem = bagItem;
    ctx.lastPickupAt = performance.now();
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(bagItem.label);
  } else if (ctx && ctx.heldItem === bagItem && ctx.callbacks && ctx.callbacks.onHoldChange) {
    ctx.callbacks.onHoldChange(bagItem.label);
  }

  playAudio('playClick');
  if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('medium');
  if (onToast) {
    onToast(`🛍️ ${bc.grams}g de ${bc.speciesName} colocados dentro do Saco Mylar! Agora sele-o na Seladora Térmica!`);
  }
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

export function sealMushroomBag(ctx, bagItem) {
  if (!bagItem || !bagItem.mushroomBagCtrl) return false;
  const bc = bagItem.mushroomBagCtrl;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;
  if (!bc.filled) {
    if (onToast) onToast('⚠️ Coloque primeiro 10g de Cogumelos Desidratados Crocantes dentro do saco antes de selar!');
    return true;
  }
  if (bc.sealed) {
    if (onToast) onToast('✅ Este pacote de cogumelos já está selado hermeticamente!');
    return true;
  }
  bc.sealed = true;
  updateMushroomBagVisual(bagItem);
  // Anima a seladora térmica apontada (ou a mais próxima) pressionando a solda
  if (ctx && ctx.hoveredHeatSealerObj && ctx.hoveredHeatSealerObj.sealerCtrl) {
    ctx.hoveredHeatSealerObj.sealerCtrl.triggerSealAnimation();
  } else if (ctx && ctx.pickableItems && bagItem.mesh) {
    let bestSealer = null;
    let bestD = Infinity;
    const bp = bagItem.mesh.position;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      if (!it || !it.sealerCtrl || !it.mesh) continue;
      const d = it.mesh.position.distanceToSquared(bp);
      if (d < bestD) { bestD = d; bestSealer = it; }
    }
    if (bestSealer) bestSealer.sealerCtrl.triggerSealAnimation();
  }
  playAudio('playClick');
  if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
  if (ctx && ctx.heldItem === bagItem && ctx.callbacks && ctx.callbacks.onHoldChange) {
    ctx.callbacks.onHoldChange(bagItem.label);
  }
  if (onToast) {
    onToast(`♨️📦 Pacote de ${bc.grams}g (${bc.speciesName}) SELADO a quente! Coloque-o na Caixa de Entrega para vender na estrada!`);
  }
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

// ============================================================================
// 2. CAIXA DE ENTREGA / EXPEDIÇÃO (Guarda até 4 Pacotes Selados para Venda)
// ============================================================================

export function updateDeliveryCrateVisual(item) {
  if (!item || !item.deliveryCrateCtrl) return;
  const cc = item.deliveryCrateCtrl;
  if (cc.packMeshes) {
    for (let i = 0; i < cc.packMeshes.length; i++) {
      cc.packMeshes[i].visible = i < cc.packsCount;
    }
  }
  const valueCoins = cc.packsCount * MYCOCOIN_PRICE_PER_PACK;
  if (cc.packsCount === 0) {
    item.label = `📤 Caixa de Entrega Comercial (Vazia • 0/${DELIVERY_CRATE_MAX_PACKS} pacotes selados)`;
  } else if (cc.packsCount >= DELIVERY_CRATE_MAX_PACKS) {
    item.label = `📤 Caixa de Entrega CHEIA (${cc.packsCount}/${DELIVERY_CRATE_MAX_PACKS} pacotes • Valor: 🪙 ${valueCoins} MycoCoins — Leve à Estrada!)`;
  } else {
    item.label = `📤 Caixa de Entrega (${cc.packsCount}/${DELIVERY_CRATE_MAX_PACKS} pacotes • Valor: 🪙 ${valueCoins} MycoCoins — Leve à Estrada ou adicione mais)`;
  }
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function makeDeliveryCrate(ctx, id, px, py, pz, opts = {}) {
  const g = new THREE.Group();
  // Caixote de Madeira de Frutas (madeira pinus clara com ripas horizontais vazadas e cantoneiras internas, igual à foto!)
  const pineWoodTex = getCachedCanvasTexture('pine_fruit_crate_wood', 128, 128, (wctx) => {
    wctx.fillStyle = '#ead7b0';
    wctx.fillRect(0, 0, 128, 128);
    wctx.strokeStyle = '#d1b382';
    wctx.lineWidth = 1.5;
    for (let y = 6; y < 128; y += 11) {
      wctx.beginPath();
      wctx.moveTo(0, y);
      wctx.bezierCurveTo(40, y + (y % 2 === 0 ? 4 : -4), 88, y - 3, 128, y);
      wctx.stroke();
    }
  });
  const pineMat = new THREE.MeshStandardMaterial({ map: pineWoodTex, roughness: 0.78 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0xc8a46e, roughness: 0.85 });

  const W = 0.42;
  const H = 0.165;
  const D = 0.36;

  // Fundo ripado (3 ripas de madeira no fundo)
  for (let b = 0; b < 3; b++) {
    const botSlat = makeBox(W - 0.01, 0.012, 0.095, pineMat);
    botSlat.position.set(0, 0.008, -0.115 + b * 0.115);
    g.add(botSlat);
  }
  // 4 postes triangulares/quadrados nos cantos internos
  [[-W * 0.5 + 0.02, -D * 0.5 + 0.02], [W * 0.5 - 0.02, -D * 0.5 + 0.02], [-W * 0.5 + 0.02, D * 0.5 - 0.02], [W * 0.5 - 0.02, D * 0.5 - 0.02]].forEach((cp) => {
    const post = makeBox(0.024, H, 0.024, postMat);
    post.position.set(cp[0], H * 0.5, cp[1]);
    g.add(post);
  });
  // 3 ripas horizontais vazadas em cada lado do caixote de madeira
  const slatYs = [0.032, 0.084, 0.136];
  for (let si = 0; si < slatYs.length; si++) {
    const sy = slatYs[si];
    const fSlat = makeBox(W, 0.034, 0.012, pineMat);
    fSlat.position.set(0, sy, D * 0.5 - 0.006);
    const bSlat = makeBox(W, 0.034, 0.012, pineMat);
    bSlat.position.set(0, sy, -D * 0.5 + 0.006);
    const lSlat = makeBox(0.012, 0.034, D, pineMat);
    lSlat.position.set(-W * 0.5 + 0.006, sy, 0);
    const rSlat = makeBox(0.012, 0.034, D, pineMat);
    rSlat.position.set(W * 0.5 - 0.006, sy, 0);
    g.add(fSlat, bSlat, lSlat, rSlat);
  }

  // Dentro do caixote: 4 bandeijas/saquinhos transparentes com cogumelos visíveis e etiqueta verde!
  const packMeshes = [];
  for (let i = 0; i < DELIVERY_CRATE_MAX_PACKS; i++) {
    const pv = createMushroomPackVisual(true, true);
    const col = i % 2;
    const row = Math.floor(i / 2);
    pv.wrap.position.set(-0.092 + col * 0.184, 0.022, -0.088 + row * 0.176);
    pv.wrap.visible = i < (opts.packsCount || 0);
    g.add(pv.wrap);
    packMeshes.push(pv.wrap);
  }

  g.userData.isDeliveryCrate = true;

  const item = registerPickable(
    ctx,
    id,
    '📤 Caixa de Entrega Comercial',
    g,
    px,
    py,
    pz,
    opts.ry || 0,
    0.24,
    0.18,
    {
      category: 'packaging',
      purpose: 'Caixa de expedição para acomodar até 4 pacotes selados de cogumelos desidratados e levar ao Ponto de Venda na Estrada',
      getWeightGrams: (it) => 240 + ((it && it.deliveryCrateCtrl) ? it.deliveryCrateCtrl.packsCount * 33 : 0),
      compatibilities: {
        canEnterCooker: false,
        isDeliveryCrate: true
      },
      serializeState: (it) => {
        const cc = it && it.deliveryCrateCtrl;
        if (!cc) return null;
        return {
          packsCount: Math.max(0, Math.min(DELIVERY_CRATE_MAX_PACKS, Math.round(Number(cc.packsCount) || 0)))
        };
      },
      applyState: (it, custom) => {
        const cc = it && it.deliveryCrateCtrl;
        if (!cc || !custom) return;
        cc.packsCount = Math.max(0, Math.min(DELIVERY_CRATE_MAX_PACKS, Math.round(Number(custom.packsCount) || 0)));
        updateDeliveryCrateVisual(it);
      }
    }
  );

  item.deliveryCrateCtrl = {
    packsCount: opts.packsCount || 0,
    packMeshes,
    updateVisual: () => updateDeliveryCrateVisual(item)
  };
  updateDeliveryCrateVisual(item);
  return item;
}

export function addSealedBagToDeliveryCrate(ctx, crateItem, bagItem) {
  if (!crateItem || !crateItem.deliveryCrateCtrl || !bagItem || !bagItem.mushroomBagCtrl) return false;
  const cc = crateItem.deliveryCrateCtrl;
  const bc = bagItem.mushroomBagCtrl;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;

  if (!bc.filled) {
    if (onToast) onToast('⚠️ Este saco está vazio! Coloque 10g de cogumelos desidratados e sele antes de pôr na caixa.');
    return true;
  }
  if (!bc.sealed) {
    if (onToast) onToast('⚠️ Sele primeiro o saco na Seladora Térmica antes de colocar na Caixa de Entrega!');
    return true;
  }
  if (cc.packsCount >= DELIVERY_CRATE_MAX_PACKS) {
    if (onToast) onToast(`📦 Esta Caixa de Entrega já está cheia (${DELIVERY_CRATE_MAX_PACKS}/${DELIVERY_CRATE_MAX_PACKS})! Leve-a para o Ponto de Venda na Estrada lá fora!`);
    return true;
  }

  cc.packsCount++;
  updateDeliveryCrateVisual(crateItem);
  if (ctx && ctx.markItemMoved) ctx.markItemMoved(crateItem);
  bagItem._removedForSync = true;
  if (ctx && ctx.pendingMovedItems && bagItem.id) {
    ctx.pendingMovedItems[bagItem.id] = {
      id: bagItem.id,
      state: { custom: { dynamicKind: 'mushroom_bag', removed: true } }
    };
  }

  // Reseta o saco para vazio na bancada ou remove se estava na mão e repõe ou mantém limpo
  if (bagItem.mesh && bagItem.mesh.parent) {
    bagItem.mesh.parent.remove(bagItem.mesh);
  }
  disposeObjectResources(bagItem.mesh);
  if (ctx && Array.isArray(ctx.pickableItems)) {
    const idx = ctx.pickableItems.indexOf(bagItem);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  }
  if (ctx && ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(bagItem.id);
  }
  if (ctx && ctx.heldItem === bagItem) {
    ctx.heldItem = null;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  }

  playAudio('playClick');
  if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('medium');
  if (onToast) {
    const val = cc.packsCount * MYCOCOIN_PRICE_PER_PACK;
    onToast(`📤 Pacote selado guardado na Caixa de Entrega (${cc.packsCount}/${DELIVERY_CRATE_MAX_PACKS} • Valor: 🪙 ${val} MycoCoins)! Leve a caixa para o Ponto de Venda na Estrada!`);
  }
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

// ============================================================================
// 3. PONTO DE VENDA DRIVE-THRU NA ESTRADA SUL + CARROS & NPCS COMPRADORES
// ============================================================================

function drawRoadStandSign() {
  const sctx = roadStandState.signCtx;
  if (!sctx) return;
  const w = 512;
  const h = 160;
  sctx.fillStyle = '#0f172a';
  sctx.fillRect(0, 0, w, h);
  sctx.fillStyle = '#064e3b';
  sctx.fillRect(8, 8, w - 16, 48);
  sctx.strokeStyle = '#fbbf24';
  sctx.lineWidth = 5;
  sctx.strokeRect(5, 5, w - 10, h - 10);

  sctx.fillStyle = '#fef08a';
  sctx.font = 'bold 26px system-ui, sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('🍄 EMPÓRIO MYCOCAMPUS', w / 2, 41);

  sctx.fillStyle = roadStandState.availablePacks > 0 ? '#34d399' : '#cbd5e1';
  sctx.font = 'bold 23px system-ui, sans-serif';
  sctx.fillText(
    roadStandState.availablePacks > 0
      ? `📦 ${roadStandState.availablePacks} Pacote(s) 10g Prontos p/ Venda`
      : '📦 Estoque Vazio — Traga Caixas de 10g!',
    w / 2,
    94
  );

  sctx.fillStyle = '#fcd34d';
  sctx.font = 'bold 20px system-ui, sans-serif';
  sctx.fillText(`🪙 ${MYCOCOIN_PRICE_PER_PACK} MycoCoins / pacote   •   Vendidos: ${roadStandState.totalSoldPacks}`, w / 2, 134);

  if (roadStandState.signTex) roadStandState.signTex.needsUpdate = true;
}

function syncRoadStandVisual() {
  for (let i = 0; i < roadStandState.standPacksMeshes.length; i++) {
    roadStandState.standPacksMeshes[i].visible = i < roadStandState.availablePacks;
  }
  drawRoadStandSign();
}

export function buildRoadsideMushroomStand(ctx) {
  const scene = ctx.scene;
  roadSaleStandMeshes.length = 0;
  roadSaleDynamicObjects.length = 0;
  roadStandState.standPacksMeshes.length = 0;

  // Sincroniza saldo inicial de MycoCoins no HUD
  addLocalMycoCoins(0);

  // CASA EMPÓRIO MYCOCAMPUS NA BEIRA DA ESTRADA (no mesmo padrão arquitetônico de tijolinhos, aço escuro e vidro dos prédios do Campus!)
  const hx = 17.5;
  const hz = 32.5;
  const houseW = 5.8;
  const houseD = 4.6;
  const wallH = 3.40;
  const floorY = 0.12;
  const standGroup = new THREE.Group();

  const wallMat = brickMat(2, 2);
  const woodShelfMat = woodMat(1, 1);
  const steelFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0xead7b0, roughness: 0.78 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.25 });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

  // 1. Piso caminhável de laje + calçada frontal até a Avenida Sul (z = 39.5)
  const floorSlab = makeBox(houseW + 0.4, floorY, houseD + 0.4, 0x94a3b8, { roughness: 0.85 });
  floorSlab.position.set(hx, floorY * 0.5, hz);
  const frontWalk = makeBox(houseW + 0.4, 0.04, 3.6, 0xcbd5e1, { roughness: 0.88, noShadow: true });
  frontWalk.position.set(hx, 0.02, hz + houseD * 0.5 + 1.8);
  standGroup.add(floorSlab, frontWalk);
  if (ctx.walkableFloors) {
    ctx.walkableFloors.push({
      minX: hx - houseW * 0.5,
      maxX: hx + houseW * 0.5,
      minZ: hz - houseD * 0.5,
      maxZ: hz + houseD * 0.5 + 1.8,
      topY: floorY
    });
  }

  // 2. Paredes de tijolinhos + pilares de aço escuro (igual aos prédios do campus!)
  const wBack = makeBox(houseW, wallH, 0.22, wallMat);
  wBack.position.set(hx, floorY + wallH * 0.5, hz - houseD * 0.5);
  const wLeft = makeBox(0.22, wallH, houseD, wallMat);
  wLeft.position.set(hx - houseW * 0.5, floorY + wallH * 0.5, hz);
  const wRight = makeBox(0.22, wallH, houseD, wallMat);
  wRight.position.set(hx + houseW * 0.5, floorY + wallH * 0.5, hz);
  const frontZ = hz + houseD * 0.5;
  // Parede frontal com aberturas reais para as 2 janelas (esq/dir) e porta central (1.8m)
  const wFrontTop = makeBox(1.8, 0.95, 0.22, steelFrameMat);
  wFrontTop.position.set(hx, floorY + wallH - 0.475, frontZ);
  standGroup.add(wBack, wLeft, wRight, wFrontTop);

  const blindSlatMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 });
  const winGlassRealMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.24,
    roughness: 0.08,
    metalness: 0.2,
    depthWrite: false
  });
  [-1.90, 1.90].forEach((ox) => {
    const cx = hx + ox;
    // Peitoril inferior (0..1.05m), verga superior (2.35..3.40m) e montantes laterais da janela
    const sillWall = makeBox(2.0, 1.05, 0.22, wallMat);
    sillWall.position.set(cx, floorY + 0.525, frontZ);
    const lintelWall = makeBox(2.0, 1.05, 0.22, wallMat);
    lintelWall.position.set(cx, floorY + 2.875, frontZ);
    const postOuter = makeBox(0.42, 1.30, 0.22, wallMat);
    postOuter.position.set(cx + (ox < 0 ? -0.79 : 0.79), floorY + 1.70, frontZ);
    const postInner = makeBox(0.42, 1.30, 0.22, wallMat);
    postInner.position.set(cx + (ox < 0 ? 0.79 : -0.79), floorY + 1.70, frontZ);
    standGroup.add(sillWall, lintelWall, postOuter, postInner);

    // Moldura de aço escuro ao redor do vão + vidro transparente real
    const fTop = makeBox(1.22, 0.07, 0.26, steelFrameMat);
    fTop.position.set(cx, floorY + 2.35, frontZ);
    const fBot = makeBox(1.22, 0.07, 0.26, steelFrameMat);
    fBot.position.set(cx, floorY + 1.05, frontZ);
    const fL = makeBox(0.07, 1.30, 0.26, steelFrameMat);
    fL.position.set(cx - 0.575, floorY + 1.70, frontZ);
    const fR = makeBox(0.07, 1.30, 0.26, steelFrameMat);
    fR.position.set(cx + 0.575, floorY + 1.70, frontZ);
    const winGlass = makeBox(1.10, 1.24, 0.04, winGlassRealMat, { noShadow: true });
    winGlass.position.set(cx, floorY + 1.70, frontZ);
    standGroup.add(fTop, fBot, fL, fR, winGlass);

    // Persianas horizontais semi-recolhidas no estilo do Campus (dando pra ver dentro!)
    const blindHead = makeBox(1.08, 0.05, 0.07, steelFrameMat, { noShadow: true });
    blindHead.position.set(cx, floorY + 2.28, frontZ - 0.06);
    standGroup.add(blindHead);
    for (let sl = 0; sl < 6; sl++) {
      const slat = makeBox(1.06, 0.012, 0.045, blindSlatMat, { noShadow: true });
      slat.position.set(cx, floorY + 2.20 - sl * 0.065, frontZ - 0.06);
      slat.rotation.x = 0.35;
      standGroup.add(slat);
    }
  });

  // 4 pilares de aço escuro nos cantos
  [[-houseW * 0.5, -houseD * 0.5], [houseW * 0.5, -houseD * 0.5], [-houseW * 0.5, houseD * 0.5], [houseW * 0.5, houseD * 0.5]].forEach((cp) => {
    const col = makeBox(0.28, wallH + 0.12, 0.28, steelFrameMat);
    col.position.set(hx + cp[0], floorY + wallH * 0.5, hz + cp[1]);
    standGroup.add(col);
  });

  // Colisores das paredes da casa (deixando a porta central livre!)
  ctx.solidColliders.push(
    { minX: hx - houseW * 0.5 - 0.12, maxX: hx + houseW * 0.5 + 0.12, minZ: hz - houseD * 0.5 - 0.12, maxZ: hz - houseD * 0.5 + 0.12, minY: 0, maxY: 4.0 },
    { minX: hx - houseW * 0.5 - 0.12, maxX: hx - houseW * 0.5 + 0.12, minZ: hz - houseD * 0.5, maxZ: frontZ, minY: 0, maxY: 4.0 },
    { minX: hx + houseW * 0.5 - 0.12, maxX: hx + houseW * 0.5 + 0.12, minZ: hz - houseD * 0.5, maxZ: frontZ, minY: 0, maxY: 4.0 },
    { minX: hx - houseW * 0.5, maxX: hx - 0.9, minZ: frontZ - 0.12, maxZ: frontZ + 0.12, minY: 0, maxY: 4.0 },
    { minX: hx + 0.9, maxX: hx + houseW * 0.5, minZ: frontZ - 0.12, maxZ: frontZ + 0.12, minY: 0, maxY: 4.0 }
  );

  // 3. Laje de cobertura arquitetônica com platibanda + COGUMELO AMANITA GIGANTE NO TOPO!
  const roofSlab = makeBox(houseW + 0.5, 0.26, houseD + 0.5, roofMat);
  roofSlab.position.set(hx, floorY + wallH + 0.13, hz);
  const roofTrim = makeBox(houseW + 0.62, 0.18, houseD + 0.62, steelFrameMat);
  roofTrim.position.set(hx, floorY + wallH + 0.30, hz);
  standGroup.add(roofSlab, roofTrim);

  // Cogumelo Gigante no topo do Empório (símbolo da loja!)
  const roofStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 0.85, 14),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55 })
  );
  roofStem.position.set(hx, floorY + wallH + 0.78, hz);
  const roofCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, emissive: 0x7f1d1d, emissiveIntensity: 0.2 })
  );
  roofCap.position.set(hx, floorY + wallH + 1.15, hz);
  standGroup.add(roofStem, roofCap);
  for (let sp = 0; sp < 6; sp++) {
    const a = (sp / 6) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), whiteMat);
    dot.position.set(hx + Math.cos(a) * 0.68, floorY + wallH + 1.59, hz + Math.sin(a) * 0.68);
    standGroup.add(dot);
  }

  // Luz quente no interior da casa
  const houseLight = new THREE.PointLight(0xfef3c7, 0.85, 7.5, 1.5);
  houseLight.position.set(hx, floorY + 2.85, hz);
  standGroup.add(houseLight);

  // 4. Toldos Listrados Laranja e Branco na frente (esquerda e direita da entrada!)
  [-1.90, 1.90].forEach((ox) => {
    for (let st = 0; st < 7; st++) {
      const stripe = makeBox(0.27, 0.08, 1.15, st % 2 === 0 ? orangeMat : whiteMat);
      stripe.position.set(hx + ox - 0.81 + st * 0.27, floorY + 2.38, frontZ + 0.58);
      stripe.rotation.x = 0.28;
      standGroup.add(stripe);
    }
  });

  // Placa luminosa dinâmica na fachada frontal da casa (abaixo da platibanda para não cortar!)
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    roadStandState.signCanvas = c;
    roadStandState.signCtx = c.getContext('2d');
    roadStandState.signTex = new THREE.CanvasTexture(c);
    drawRoadStandSign();
    const signBacking = makeBox(2.74, 0.88, 0.08, steelFrameMat, { noShadow: true });
    signBacking.position.set(hx, floorY + 2.86, frontZ + 0.14);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.62, 0.80),
      new THREE.MeshBasicMaterial({ map: roadStandState.signTex, side: THREE.DoubleSide })
    );
    signMesh.position.set(hx, floorY + 2.86, frontZ + 0.19);
    standGroup.add(signBacking, signMesh);
  }

  // 5. INTERIOR DA CASA: Bancada com Pia Inox + Água Corrente + Bancada Lateral de Empilhamento de Caixas!
  addWallLabBench(ctx, hx - 0.6, hz - 1.65, 3.2, 1.0, {
    hole: { cx: hx - 1.4, cz: hz - 1.65, w: 0.60, d: 0.50 },
    sinkPos: { x: hx - 1.4, z: hz - 1.65 }
  });
  addMovableStainlessTable(ctx, 'table_emporio_east', 'Bancada Inox (Empório Estrada)', hx + 2.0, floorY, hz - 0.2, 1.1, 0.82, 2.2);

  // 6. ESTANTES / BANCAS EXPOSITORAS DA FRENTE (madeira do campus com suporte real para caixotes e pacotes!)
  const shelfXList = [hx - 1.90, hx + 1.90];
  const shelfZ = frontZ + 0.85;
  for (let si = 0; si < shelfXList.length; si++) {
    const sx = shelfXList[si];
    const shelfBase = makeBox(1.75, 0.82, 0.85, woodShelfMat);
    shelfBase.position.set(sx, 0.41, shelfZ);
    const shelfTop = makeBox(1.84, 0.06, 0.94, pineMat);
    shelfTop.position.set(sx, 0.85, shelfZ);
    standGroup.add(shelfBase, shelfTop);

    // Plaquinha de preço verde ("🪙 120") em cima da estante igual à imagem!
    const pricePost = makeBox(0.04, 0.26, 0.04, steelFrameMat, { noShadow: true });
    pricePost.position.set(sx - 0.72, 1.00, shelfZ + 0.36);
    const priceTex = getCachedCanvasTexture('emporio_price_tag_120', 128, 64, (pctx) => {
      pctx.fillStyle = '#064e3b';
      pctx.fillRect(0, 0, 128, 64);
      pctx.strokeStyle = '#34d399';
      pctx.lineWidth = 4;
      pctx.strokeRect(3, 3, 122, 58);
      pctx.fillStyle = '#fde047';
      pctx.font = 'bold 28px system-ui, sans-serif';
      pctx.textAlign = 'center';
      pctx.fillText('$ 120', 64, 42);
    });
    const priceCard = makeBox(0.32, 0.18, 0.04, new THREE.MeshStandardMaterial({ map: priceTex, roughness: 0.55 }), { noShadow: true });
    priceCard.position.set(sx - 0.72, 1.14, shelfZ + 0.36);
    standGroup.add(pricePost, priceCard);

    if (ctx.supportSurfaces && ctx.supportMeshes) {
      const sSurf = {
        minX: sx - 0.88,
        maxX: sx + 0.88,
        minZ: shelfZ - 0.44,
        maxZ: shelfZ + 0.44,
        topY: 0.88
      };
      ctx.supportSurfaces.push(sSurf);
      shelfTop.userData.supportSurface = sSurf;
      ctx.supportMeshes.push(shelfTop);
    }

    ctx.solidColliders.push({
      minX: sx - 0.90,
      maxX: sx + 0.90,
      minZ: shelfZ - 0.45,
      maxZ: shelfZ + 0.45,
      minY: 0,
      maxY: 0.95
    });

    const standHit = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.88, 0.90), hitMat);
    standHit.position.set(sx, 0.44, shelfZ);
    standHit.userData.isRoadSaleStand = true;
    standGroup.add(standHit);
    roadSaleStandMeshes.push(standHit);
  }

  // Pacotes reais com cogumelos visíveis e etiqueta empilhados sobre as 2 estantes da frente (até 12 visíveis)
  for (let i = 0; i < 12; i++) {
    const pv = createMushroomPackVisual(true, true);
    const pm = pv.wrap;
    const isRight = i >= 6;
    const localIdx = i % 6;
    const col = localIdx % 3;
    const row = Math.floor(localIdx / 3);
    const baseShelfX = isRight ? (hx + 1.90) : (hx - 1.90);
    pm.position.set(baseShelfX - 0.42 + col * 0.42, 0.885 + row * 0.052, shelfZ);
    pm.scale.set(1.25, 1.25, 1.25);
    pm.visible = false;
    standGroup.add(pm);
    roadStandState.standPacksMeshes.push(pm);
    roadSaleDynamicObjects.push(pm);
  }

  scene.add(standGroup);

  // Cria o conjunto 3D reutilizável de Carro Detalhado + Avatar NPC Fofo + Notas de Dinheiro!
  buildNpcCarActor(scene);
}

function buildNpcCarActor(scene) {
  const carGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.28, metalness: 0.48 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.12, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  // Chassi inferior + para-choques cromados + capô + para-brisa inclinado + teto
  const lowerBody = makeBox(3.7, 0.56, 1.72, bodyMat);
  lowerBody.position.set(0, 0.50, 0);
  const frontBumper = makeBox(0.14, 0.22, 1.76, chromeMat);
  frontBumper.position.set(1.86, 0.34, 0);
  const rearBumper = makeBox(0.14, 0.22, 1.76, chromeMat);
  rearBumper.position.set(-1.86, 0.34, 0);
  const grille = makeBox(0.08, 0.20, 0.82, chromeMat);
  grille.position.set(1.86, 0.52, 0);

  const cabinRoof = makeBox(1.55, 0.48, 1.50, bodyMat);
  cabinRoof.position.set(-0.20, 1.02, 0);
  const windshield = makeBox(0.55, 0.44, 1.44, glassMat);
  windshield.position.set(0.70, 0.98, 0);
  windshield.rotation.z = -0.58;
  const rearGlass = makeBox(0.50, 0.42, 1.44, glassMat);
  rearGlass.position.set(-1.08, 0.98, 0);
  rearGlass.rotation.z = 0.55;
  const sideWindows = makeBox(1.42, 0.34, 1.54, glassMat);
  sideWindows.position.set(-0.20, 1.01, 0);

  // Porta articulada voltada para o Empório (lado z-)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0.42, 0.56, -0.87);
  const doorPanel = makeBox(0.92, 0.48, 0.06, bodyMat);
  doorPanel.position.set(-0.46, 0, 0);
  const doorHandle = makeBox(0.14, 0.04, 0.08, chromeMat, { noShadow: true });
  doorHandle.position.set(-0.74, 0.12, -0.02);
  doorPivot.add(doorPanel, doorHandle);

  carGroup.add(lowerBody, frontBumper, rearBumper, grille, cabinRoof, windshield, rearGlass, sideWindows, doorPivot);

  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16);
  wGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 10);
  rimGeo.rotateX(Math.PI / 2);
  [[-1.15, -0.84], [1.15, -0.84], [-1.15, 0.84], [1.15, 0.84]].forEach((wp) => {
    const wg = new THREE.Group();
    wg.position.set(wp[0], 0.32, wp[1]);
    wg.add(new THREE.Mesh(wGeo, wheelMat), new THREE.Mesh(rimGeo, chromeMat));
    carGroup.add(wg);
    wheels.push(wg);
  });

  [-0.58, 0.58].forEach((lz) => {
    const hl = makeBox(0.08, 0.15, 0.28, headlightMat, { noShadow: true });
    hl.position.set(1.86, 0.56, lz);
    const tl = makeBox(0.08, 0.14, 0.26, taillightMat, { noShadow: true });
    tl.position.set(-1.86, 0.58, lz);
    carGroup.add(hl, tl);
  });

  carGroup.visible = false;
  scene.add(carGroup);
  roadSaleDynamicObjects.push(carGroup);

  // NPC Comprador Fofo (mesmo padrão visual dos avatares dos jogadores!)
  const avatar = buildCuteAvatar(scene, {
    id: 'npc_buyer',
    name: 'Cliente',
    role: 'student',
    hat_color: '#1e3a8a',
    body_color: '#0284c7',
    current_hat: 'default',
    x: 17.5,
    y: 0.04,
    z: 39.0
  });
  const npcGroup = avatar.group;
  npcGroup.visible = false;
  roadSaleDynamicObjects.push(npcGroup);

  // Pacote real de cogumelos nas mãos do NPC (mostrando os cogumelos e etiqueta!)
  const heldPackVis = createMushroomPackVisual(true, true);
  const heldPack = heldPackVis.wrap;
  heldPack.position.set(0, 0.62, -0.26);
  heldPack.scale.set(1.35, 1.35, 1.35);
  heldPack.visible = false;
  npcGroup.add(heldPack);

  // Cédulas de dinheiro verde e moedas douradas flutuando durante o pagamento
  const cashGroup = new THREE.Group();
  const billMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  for (let i = 0; i < 6; i++) {
    const bill = makeBox(0.14, 0.015, 0.08, i % 2 === 0 ? billMat : coinMat, { noShadow: true });
    bill.position.set((i - 2.5) * 0.09, 1.35 + (i % 2) * 0.11, -0.18);
    cashGroup.add(bill);
  }
  cashGroup.visible = false;
  npcGroup.add(cashGroup);

  roadStandState.actor = {
    carGroup,
    bodyMat,
    doorPivot,
    wheels,
    avatar,
    npcGroup,
    shirtMat: avatar.bodyMat,
    hatMat: avatar.hatMat,
    heldPack,
    cashGroup
  };
}

export function isHoldingPackOrCrateForStand(held) {
  if (!held) return false;
  if (held.deliveryCrateCtrl && held.deliveryCrateCtrl.packsCount > 0) return true;
  if (held.mushroomBagCtrl && held.mushroomBagCtrl.filled && held.mushroomBagCtrl.sealed) return true;
  if (held.organicBasketCtrl && held.organicBasketCtrl.packsValue > 0) return true;
  return false;
}

export function applyRoadStandWorldState(stateMap) {
  if (!stateMap) return;
  let dirty = false;
  if (stateMap.stand_packs !== undefined) {
    const p = Math.max(0, Math.min(200, parseInt(stateMap.stand_packs, 10) || 0));
    if (p !== roadStandState.availablePacks) {
      roadStandState.availablePacks = p;
      dirty = true;
    }
  }
  if (stateMap.stand_sold !== undefined) {
    const s = Math.max(0, parseInt(stateMap.stand_sold, 10) || 0);
    if (s !== roadStandState.totalSoldPacks) {
      roadStandState.totalSoldPacks = s;
      dirty = true;
    }
  }
  if (dirty) syncRoadStandVisual();
}

function consumeHeldStandItem(ctx, held, packsVal) {
  roadStandState.availablePacks += packsVal;
  roadStandState.npcSpawnCooldown = Math.min(roadStandState.npcSpawnCooldown, 1.2);
  if (ctx && ctx.queueWorldStateChange) {
    ctx.queueWorldStateChange('stand_packs', roadStandState.availablePacks);
  }
  if (held && held.id) {
    held._removedForSync = true;
    if (ctx && ctx.pendingMovedItems) {
      ctx.pendingMovedItems[held.id] = {
        id: held.id,
        state: {
          custom: {
            dynamicKind: held.organicBasketCtrl ? 'organic_basket' : 'mushroom_bag',
            removed: true
          }
        }
      };
    }
  }
  if (held.mesh && held.mesh.parent) held.mesh.parent.remove(held.mesh);
  disposeObjectResources(held.mesh);
  if (Array.isArray(ctx.pickableItems)) {
    const idx = ctx.pickableItems.indexOf(held);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  }
  if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(held.id);
  }
  ctx.heldItem = null;
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  syncRoadStandVisual();
  playAudio('playClick');
}

export function interactRoadsideStand(ctx) {
  const held = ctx.heldItem;
  const onToast = ctx && ctx.callbacks && ctx.callbacks.onToast;

  if (held && held.deliveryCrateCtrl && held.deliveryCrateCtrl.packsCount > 0) {
    const count = held.deliveryCrateCtrl.packsCount;
    roadStandState.availablePacks += count;
    roadStandState.npcSpawnCooldown = Math.min(roadStandState.npcSpawnCooldown, 1.2);
    held.deliveryCrateCtrl.packsCount = 0;
    updateDeliveryCrateVisual(held);
    syncRoadStandVisual();
    if (ctx && ctx.markItemMoved) ctx.markItemMoved(held);
    if (ctx && ctx.queueWorldStateChange) {
      ctx.queueWorldStateChange('stand_packs', roadStandState.availablePacks);
    }
    playAudio('playClick');
    if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
    if (onToast) {
      onToast(`🚗📦 ${count} pacote(s) selado(s) colocados no Quiosque Drive-Thru da Estrada! Aguarde: um carro de cliente já está vindo comprar!`);
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  if (held && held.organicBasketCtrl && held.organicBasketCtrl.packsValue > 0) {
    const packsVal = held.organicBasketCtrl.packsValue;
    consumeHeldStandItem(ctx, held, packsVal);
    if (onToast) {
      onToast(`🚗🧺 Cesta Orgânica da Horta (+${packsVal} lotes) colocada no Empório! Carros já estão vindo comprar!`);
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  if (held && held.mushroomBagCtrl && held.mushroomBagCtrl.filled && held.mushroomBagCtrl.sealed) {
    consumeHeldStandItem(ctx, held, 1);
    if (onToast) {
      onToast('🚗📦 1 pacote selado colocado no Quiosque Drive-Thru! Um cliente de carro já está a caminho!');
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  playAudio('playClick');
  if (onToast) {
    if (roadStandState.availablePacks > 0) {
      onToast(`🚗 Quiosque Drive-Thru: ${roadStandState.availablePacks} pacote(s) aguardando o próximo cliente na estrada (🪙 ${MYCOCOIN_PRICE_PER_PACK} MycoCoins cada)!`);
    } else {
      onToast('🚗 Quiosque Drive-Thru da Estrada: Traga Caixas de Entrega ou Pacotes Selados da Sala de Desidratação para atrair clientes de carro!');
    }
  }
  return true;
}

function getFrontShelfSaleItems(ctx) {
  const found = [];
  if (!ctx || !Array.isArray(ctx.pickableItems)) return found;
  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const it = ctx.pickableItems[i];
    if (!it || !it.mesh || !it.mesh.position || it === ctx.heldItem) continue;
    const p = it.mesh.position;
    if (p.x < 14.4 || p.x > 20.6 || p.z < 34.8 || p.z > 36.8 || p.y < 0.4) continue;
    if (it.deliveryCrateCtrl && it.deliveryCrateCtrl.packsCount > 0) {
      found.push({ item: it, kind: 'crate', count: it.deliveryCrateCtrl.packsCount });
    } else if (it.mushroomBagCtrl && it.mushroomBagCtrl.filled && it.mushroomBagCtrl.sealed) {
      found.push({ item: it, kind: 'bag', count: 1 });
    } else if (it.wildMushroomCtrl && !it.wildMushroomCtrl.removed) {
      found.push({ item: it, kind: 'mushroom', count: 1 });
    }
  }
  return found;
}

/**
 * Simulação frame-a-frame dos clientes NPCs que saem do Túnel Escuro das Colinas Oeste (-114),
 * estacionam em frente ao Empório MycoCampus (x = 17.5), descem com animação de avatar fofo,
 * pagam em dinheiro com emoções felizes e vão embora pelo Túnel Leste (+114)!
 */
export function stepRoadsideMushroomSales(ctx, dt) {
  const actor = roadStandState.actor;
  if (!actor) return;

  const shelfItems = getFrontShelfSaleItems(ctx);
  let shelfCount = 0;
  for (let i = 0; i < shelfItems.length; i++) shelfCount += shelfItems[i].count;
  const totalForSale = roadStandState.availablePacks + shelfCount;

  // Só gera novo cliente se houver cogumelo selado disponível no Quiosque ou nas estantes da frente!
  if (!roadStandState.activeNpcOrder) {
    if (totalForSale <= 0) return;
    roadStandState.npcSpawnCooldown -= dt;
    if (roadStandState.npcSpawnCooldown > 0) return;

    const profile = NPC_PROFILES[(roadStandState.totalSoldPacks + Math.floor(Math.random() * NPC_PROFILES.length)) % NPC_PROFILES.length];
    actor.bodyMat.color.setHex(profile.carColor);
    actor.shirtMat.color.setHex(profile.shirtColor);
    actor.hatMat.color.setHex(profile.hatColor);
    // Carro nasce DENTRO do Túnel Escuro das Colinas Oeste (x = -114)!
    actor.carGroup.position.set(-114, 0.04, 39.5);
    actor.carGroup.rotation.y = 0;
    actor.carGroup.visible = true;
    if (actor.doorPivot) actor.doorPivot.rotation.y = 0;
    actor.npcGroup.visible = false;
    actor.heldPack.visible = false;
    actor.cashGroup.visible = false;
    if (actor.avatar) {
      if (actor.avatar.labelSprite) updateTextSprite(actor.avatar.labelSprite, profile.name, '#ffffff');
      if (actor.avatar.chatSprite) actor.avatar.chatSprite.visible = false;
      if (actor.avatar.faceCtx) {
        drawAvatarFace(actor.avatar.faceCtx, 'happy', false);
        if (actor.avatar.faceTex) actor.avatar.faceTex.needsUpdate = true;
      }
    }

    const isVip = (roadStandState.totalSoldPacks % 3 === 2) || Math.random() < 0.28;
    roadStandState.activeNpcOrder = {
      profile,
      isVip,
      phase: 'driving_in', // driving_in -> walking_to_stand -> paying_happy -> walking_to_car -> driving_away
      timer: 0
    };
    if (isVip && actor.avatar && actor.avatar.labelSprite) {
      updateTextSprite(actor.avatar.labelSprite, `⭐ VIP: ${profile.name}`, '#fde047');
    }
    return;
  }

  const order = roadStandState.activeNpcOrder;
  const standX = 17.5;
  const roadZ = 39.5;
  const standStopZ = 36.65;

  const spinWheels = (speed) => {
    if (!actor.wheels) return;
    for (let wi = 0; wi < actor.wheels.length; wi++) {
      actor.wheels[wi].rotation.z -= dt * speed;
    }
  };

  const animateWalkLimbs = (t, active) => {
    const av = actor.avatar;
    if (!av) return;
    const sw = active ? Math.sin(t * 11) * 0.55 : 0;
    if (av.leftLeg) av.leftLeg.rotation.x = sw;
    if (av.rightLeg) av.rightLeg.rotation.x = -sw;
    if (av.leftArm) av.leftArm.rotation.x = actor.heldPack.visible ? -0.75 : -sw * 0.8;
    if (av.rightArm) av.rightArm.rotation.x = actor.heldPack.visible ? -0.75 : sw * 0.8;
  };

  if (order.phase === 'driving_in') {
    const dist = Math.max(0.5, standX - actor.carGroup.position.x);
    const speed = dist < 12 ? Math.max(4.5, dist * 1.45) : 22.0;
    actor.carGroup.position.x = Math.min(standX, actor.carGroup.position.x + dt * speed);
    spinWheels(speed * 2.2);
    if (actor.carGroup.position.x >= standX - 0.05) {
      actor.carGroup.position.x = standX;
      order.phase = 'walking_to_stand';
      order.timer = 0;
      if (actor.doorPivot) actor.doorPivot.rotation.y = -1.05;
      playAudio('playCarHonk');
      actor.npcGroup.position.set(standX, 0.04, roadZ - 1.15);
      actor.npcGroup.rotation.y = Math.PI;
      actor.npcGroup.visible = true;
      actor.heldPack.visible = false;
      actor.cashGroup.visible = false;
      if (actor.avatar && actor.avatar.chatSprite) {
        updateTextSprite(actor.avatar.chatSprite, '🍄 Vim comprar cogumelos!', '#38bdf8');
        actor.avatar.chatSprite.visible = true;
      }
    }
  } else if (order.phase === 'walking_to_stand') {
    order.timer += dt;
    if (actor.doorPivot && order.timer > 0.35) {
      actor.doorPivot.rotation.y = Math.min(0, actor.doorPivot.rotation.y + dt * 3.5);
    }
    actor.npcGroup.position.z = Math.max(standStopZ, actor.npcGroup.position.z - dt * 2.3);
    actor.npcGroup.position.y = 0.04 + Math.abs(Math.sin(order.timer * 11)) * 0.05;
    animateWalkLimbs(order.timer, true);
    if (actor.npcGroup.position.z <= standStopZ + 0.04) {
      order.phase = 'paying_happy';
      order.timer = 0;
      animateWalkLimbs(0, false);
      actor.cashGroup.visible = true;
      playAudio('playCashRegister');
      if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');

      // Consome 1 pacote do balcão OU da estante da frente e paga 🪙 120 MycoCoins + XP!
      let soldOne = false;
      if (roadStandState.availablePacks > 0) {
        roadStandState.availablePacks--;
        soldOne = true;
      } else if (shelfItems.length > 0) {
        const entry = shelfItems[0];
        if (entry.kind === 'crate' && entry.item.deliveryCrateCtrl) {
          entry.item.deliveryCrateCtrl.packsCount = Math.max(0, entry.item.deliveryCrateCtrl.packsCount - 1);
          updateDeliveryCrateVisual(entry.item);
          if (ctx && ctx.markItemMoved) ctx.markItemMoved(entry.item);
          soldOne = true;
        } else {
          const soldIt = entry.item;
          if (soldIt && soldIt.id) {
            soldIt._removedForSync = true;
            if (ctx && ctx.pendingMovedItems) {
              ctx.pendingMovedItems[soldIt.id] = {
                id: soldIt.id,
                state: {
                  custom: {
                    dynamicKind: soldIt.organicBasketCtrl ? 'organic_basket' : 'mushroom_bag',
                    removed: true
                  }
                }
              };
            }
          }
          if (soldIt.mesh && soldIt.mesh.parent) soldIt.mesh.parent.remove(soldIt.mesh);
          disposeObjectResources(soldIt.mesh);
          const idx = ctx.pickableItems.indexOf(soldIt);
          if (idx !== -1) ctx.pickableItems.splice(idx, 1);
          if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') ctx.pickableMap.delete(soldIt.id);
          soldOne = true;
        }
      }
      if (soldOne) {
        const earnedCoins = order.isVip ? Math.round(MYCOCOIN_PRICE_PER_PACK * 1.5) : MYCOCOIN_PRICE_PER_PACK;
        roadStandState.totalSoldPacks++;
        roadStandState.totalCoinsEarned += earnedCoins;
        const newBalance = addLocalMycoCoins(earnedCoins);
        syncRoadStandVisual();
        if (ctx && ctx.queueWorldStateChange) {
          ctx.queueWorldStateChange('stand_packs', roadStandState.availablePacks);
          ctx.queueWorldStateChange('stand_sold', roadStandState.totalSoldPacks);
        }
        actor.heldPack.visible = true;
        if (actor.avatar) {
          if (actor.avatar.faceCtx) {
            drawAvatarFace(actor.avatar.faceCtx, 'love', false);
            if (actor.avatar.faceTex) actor.avatar.faceTex.needsUpdate = true;
          }
          if (actor.avatar.chatSprite) {
            updateTextSprite(
              actor.avatar.chatSprite,
              order.isVip ? `⭐😍 VIP +🪙 ${earnedCoins}!` : `😍🍄 +🪙 ${earnedCoins}! Obrigado!`,
              order.isVip ? '#fde047' : '#34d399'
            );
            actor.avatar.chatSprite.visible = true;
          }
        }
        if (ctx && ctx.callbacks && ctx.callbacks.onHarvestMushroom) {
          ctx.callbacks.onHarvestMushroom('sale_pack_' + roadStandState.totalSoldPacks);
        }
        if (ctx && ctx.callbacks && ctx.callbacks.onLabStep) {
          ctx.callbacks.onLabStep('sell_pack');
        }
        if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
          const vipPrefix = order.isVip ? `⭐ PEDIDO VIP (+🪙 ${earnedCoins})! ` : '';
          ctx.callbacks.onToast(`🚗💵 ${vipPrefix}${order.profile.name}: ${order.profile.quote} (Saldo: 🪙 ${newBalance} MycoCoins)`);
        }
      }
    }
  } else if (order.phase === 'paying_happy') {
    order.timer += dt;
    // Animação feliz do avatar pulando, acenando e notas de dinheiro subindo!
    actor.npcGroup.position.y = 0.04 + Math.abs(Math.sin(order.timer * 9.5)) * 0.22;
    actor.npcGroup.rotation.y = Math.PI + Math.sin(order.timer * 6.5) * 0.28;
    if (actor.avatar && actor.avatar.leftArm && actor.avatar.rightArm) {
      actor.avatar.leftArm.rotation.x = -0.8 - Math.sin(order.timer * 12) * 0.35;
      actor.avatar.rightArm.rotation.x = -0.8 + Math.sin(order.timer * 12) * 0.35;
    }
    actor.cashGroup.position.y = order.timer * 0.45;
    actor.cashGroup.rotation.y = order.timer * 3.5;

    if (order.timer >= 2.3) {
      order.phase = 'walking_to_car';
      order.timer = 0;
      actor.cashGroup.visible = false;
      actor.cashGroup.position.y = 0;
      actor.npcGroup.rotation.y = 0;
      if (actor.doorPivot) actor.doorPivot.rotation.y = -1.05;
    }
  } else if (order.phase === 'walking_to_car') {
    order.timer += dt;
    actor.npcGroup.position.z = Math.min(roadZ - 1.10, actor.npcGroup.position.z + dt * 2.4);
    actor.npcGroup.position.y = 0.04 + Math.abs(Math.sin(order.timer * 11)) * 0.05;
    animateWalkLimbs(order.timer, true);
    if (actor.npcGroup.position.z >= roadZ - 1.12) {
      actor.npcGroup.visible = false;
      if (actor.avatar && actor.avatar.chatSprite) actor.avatar.chatSprite.visible = false;
      if (actor.doorPivot) actor.doorPivot.rotation.y = 0;
      playAudio('playCarHonk');
      order.phase = 'driving_away';
      order.timer = 0;
    }
  } else if (order.phase === 'driving_away') {
    order.timer += dt;
    const speed = Math.min(24.0, 6.0 + order.timer * 12.0);
    actor.carGroup.position.x += dt * speed;
    spinWheels(speed * 2.2);
    // Entra no Túnel Escuro das Colinas Leste (x = +114)
    if (actor.carGroup.position.x >= 114) {
      actor.carGroup.visible = false;
      roadStandState.activeNpcOrder = null;
      roadStandState.npcSpawnCooldown = 3.5 + Math.random() * 4.0;
    }
  }
}
