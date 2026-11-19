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

import { makeBox } from '../engine/textures.js';
import { getCachedCanvasTexture, registerPickable, disposeObjectResources, updateItemBounds } from './item-registry.js';
import { addWallLabBench } from './laminar-hood.js';
import { addMovableStainlessTable } from './stainless-table.js';

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

export function addLocalMycoCoins(amount) {
  const cur = getLocalMycoCoins();
  const next = Math.max(0, cur + (Number(amount) || 0));
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
  const labelTex = getCachedCanvasTexture('myco_pack_label_v1', 128, 128, (lctx) => {
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(0, 0, 128, 128);
    lctx.fillStyle = '#16a34a';
    lctx.fillRect(0, 44, 128, 42);
    lctx.fillStyle = '#dc2626';
    lctx.beginPath();
    lctx.arc(64, 24, 14, Math.PI, 0);
    lctx.fill();
    lctx.fillStyle = '#ffffff';
    lctx.font = 'bold 15px system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.fillText('MycoCampus', 64, 64);
    lctx.font = 'bold 12px system-ui, sans-serif';
    lctx.fillText('COGUMELOS 25g', 64, 80);
    lctx.fillStyle = '#0f172a';
    lctx.fillRect(24, 96, 80, 20);
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

  const sealStripMesh = makeBox(0.144, 0.008, 0.015, new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    emissive: 0x059669,
    emissiveIntensity: 0.35,
    roughness: 0.25
  }));
  sealStripMesh.position.set(0, 0.036, -0.076);
  sealStripMesh.visible = Boolean(sealed);
  wrap.add(sealStripMesh);

  return { wrap, contentsGroup, sealStripMesh, labelSticker };
}

export function updateMushroomBagVisual(item) {
  if (!item || !item.mushroomBagCtrl) return;
  const bc = item.mushroomBagCtrl;
  if (bc.contentsMesh) bc.contentsMesh.visible = bc.filled;
  if (bc.labelSticker) bc.labelSticker.visible = bc.sealed;
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
    item.label = '🛍️ Saco/Bandeja Vazia p/ Cogumelos Secos (Coloque 25g de Cogumelos Crocantes)';
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
      purpose: 'Embalagem transparente com visor e etiqueta para embalar 25g de cogumelos desidratados e selar na Seladora Térmica',
      getWeightGrams: (it) => 8 + ((it && it.mushroomBagCtrl && it.mushroomBagCtrl.filled) ? (it.mushroomBagCtrl.grams || 25) : 0),
      compatibilities: {
        canEnterCooker: false,
        isMushroomPackBag: true
      }
    }
  );

  item.mushroomBagCtrl = {
    filled: Boolean(opts.filled),
    sealed: Boolean(opts.sealed),
    grams: opts.filled ? (opts.grams || 25) : 0,
    speciesName: opts.speciesName || '',
    contentsMesh: vis.contentsGroup,
    sealStripMesh: vis.sealStripMesh,
    labelSticker: vis.labelSticker,
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
    if (onToast) onToast('⚠️ Este saco já está cheio com 25g de cogumelos secos! Leve-o à Seladora Térmica.');
    return true;
  }
  const dc = driedBatchItem.driedMushroomCtrl;
  bc.filled = true;
  bc.sealed = false;
  bc.grams = dc.grams || 25;
  bc.speciesName = dc.speciesName || 'Golden Teacher';
  updateMushroomBagVisual(bagItem);

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
    if (onToast) onToast('⚠️ Coloque primeiro 25g de Cogumelos Desidratados Crocantes dentro do saco antes de selar!');
    return true;
  }
  if (bc.sealed) {
    if (onToast) onToast('✅ Este pacote de cogumelos já está selado hermeticamente!');
    return true;
  }
  bc.sealed = true;
  updateMushroomBagVisual(bagItem);
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
    if (onToast) onToast('⚠️ Este saco está vazio! Coloque 25g de cogumelos desidratados e sele antes de pôr na caixa.');
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
  sctx.fillStyle = '#0f172a';
  sctx.fillRect(0, 0, 320, 128);
  sctx.strokeStyle = '#fbbf24';
  sctx.lineWidth = 5;
  sctx.strokeRect(4, 4, 312, 120);

  sctx.fillStyle = '#fde047';
  sctx.font = 'bold 20px system-ui, sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('🚗 DRIVE-THRU MYCOCAMPUS', 160, 32);

  sctx.fillStyle = roadStandState.availablePacks > 0 ? '#34d399' : '#94a3b8';
  sctx.font = 'bold 17px system-ui, sans-serif';
  sctx.fillText(
    roadStandState.availablePacks > 0
      ? `📦 ${roadStandState.availablePacks} Pacote(s) Prontos p/ Venda!`
      : '📦 Estoque: 0 Pacotes (Traga Caixas!)',
    160,
    64
  );

  sctx.fillStyle = '#fef08a';
  sctx.font = 'bold 15px system-ui, sans-serif';
  sctx.fillText(`🪙 ${MYCOCOIN_PRICE_PER_PACK} MycoCoins / pacote • Vendidos: ${roadStandState.totalSoldPacks}`, 160, 96);

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

  // CASA EMPÓRIO MYCOCAMPUS NA BEIRA DA ESTRADA (inspirada na quitanda da imagem: porta aberta, toldo listrado, estantes na frente, cogumelo gigante no teto, bancada + pia dentro!)
  const hx = 11.5;
  const hz = 32.5;
  const houseW = 5.6;
  const houseD = 4.6;
  const wallH = 3.35;
  const floorY = 0.12;
  const standGroup = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe7dfd3, roughness: 0.82 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.82 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.72 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.65 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const packMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.38, roughness: 0.12 });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

  // 1. Piso caminhável da casa + calçada frontal até a Avenida Sul (z = 39.5)
  const floorSlab = makeBox(houseW + 0.3, floorY, houseD + 0.3, 0x94a3b8, { roughness: 0.85 });
  floorSlab.position.set(hx, floorY * 0.5, hz);
  standGroup.add(floorSlab);
  if (ctx.walkableFloors) {
    ctx.walkableFloors.push({
      minX: hx - houseW * 0.5,
      maxX: hx + houseW * 0.5,
      minZ: hz - houseD * 0.5,
      maxZ: hz + houseD * 0.5 + 1.5,
      topY: floorY
    });
  }

  // 2. Paredes externas (com vão de porta larga de 1.8m na frente z = 34.8 para entrar carregando caixas!)
  const wBack = makeBox(houseW, wallH, 0.18, wallMat);
  wBack.position.set(hx, floorY + wallH * 0.5, hz - houseD * 0.5);
  const wLeft = makeBox(0.18, wallH, houseD, wallMat);
  wLeft.position.set(hx - houseW * 0.5, floorY + wallH * 0.5, hz);
  const wRight = makeBox(0.18, wallH, houseD, wallMat);
  wRight.position.set(hx + houseW * 0.5, floorY + wallH * 0.5, hz);
  // Parede frontal dividida em esquerda, direita e bandeira acima da porta
  const frontZ = hz + houseD * 0.5;
  const wFrontL = makeBox(1.9, wallH, 0.18, wallMat);
  wFrontL.position.set(hx - 1.85, floorY + wallH * 0.5, frontZ);
  const wFrontR = makeBox(1.9, wallH, 0.18, wallMat);
  wFrontR.position.set(hx + 1.85, floorY + wallH * 0.5, frontZ);
  const wFrontTop = makeBox(1.8, 0.95, 0.18, wallMat);
  wFrontTop.position.set(hx, floorY + wallH - 0.475, frontZ);
  standGroup.add(wBack, wLeft, wRight, wFrontL, wFrontR, wFrontTop);

  // Colisores das paredes da casa (deixando a porta central x: 10.6..12.4 totalmente livre!)
  ctx.solidColliders.push(
    { minX: hx - houseW * 0.5 - 0.1, maxX: hx + houseW * 0.5 + 0.1, minZ: hz - houseD * 0.5 - 0.1, maxZ: hz - houseD * 0.5 + 0.1, minY: 0, maxY: 4.0 },
    { minX: hx - houseW * 0.5 - 0.1, maxX: hx - houseW * 0.5 + 0.1, minZ: hz - houseD * 0.5, maxZ: frontZ, minY: 0, maxY: 4.0 },
    { minX: hx + houseW * 0.5 - 0.1, maxX: hx + houseW * 0.5 + 0.1, minZ: hz - houseD * 0.5, maxZ: frontZ, minY: 0, maxY: 4.0 },
    { minX: hx - houseW * 0.5, maxX: hx - 0.9, minZ: frontZ - 0.1, maxZ: frontZ + 0.1, minY: 0, maxY: 4.0 },
    { minX: hx + 0.9, maxX: hx + houseW * 0.5, minZ: frontZ - 0.1, maxZ: frontZ + 0.1, minY: 0, maxY: 4.0 }
  );

  // Janelas frontais com moldura branca
  [-1.85, 1.85].forEach((ox) => {
    const winFrame = makeBox(1.1, 1.05, 0.22, trimMat);
    winFrame.position.set(hx + ox, floorY + 1.85, frontZ);
    const winGlass = makeBox(0.95, 0.9, 0.24, glassMat, { noShadow: true });
    winGlass.position.set(hx + ox, floorY + 1.85, frontZ);
    standGroup.add(winFrame, winGlass);
  });

  // 3. Telhado inclinado + Água-furtada (2º piso decorativo) + COGUMELO GIGANTE NO TETO (como a maçã da foto!)
  const roofBase = makeBox(houseW + 0.5, 0.22, houseD + 0.5, roofMat);
  roofBase.position.set(hx, floorY + wallH + 0.11, hz);
  const roofL = makeBox(houseW + 0.4, 0.18, houseD * 0.62, roofMat);
  roofL.position.set(hx, floorY + wallH + 0.92, hz - 1.1);
  roofL.rotation.x = 0.52;
  const roofR = makeBox(houseW + 0.4, 0.18, houseD * 0.62, roofMat);
  roofR.position.set(hx, floorY + wallH + 0.92, hz + 1.1);
  roofR.rotation.x = -0.52;
  const ridge = makeBox(houseW + 0.45, 0.35, 0.4, roofMat);
  ridge.position.set(hx, floorY + wallH + 1.55, hz);
  standGroup.add(roofBase, roofL, roofR, ridge);

  // Cogumelo Gigante no topo do telhado (substituindo a maçã da imagem!)
  const roofStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 0.85, 14),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.55 })
  );
  roofStem.position.set(hx, floorY + wallH + 2.05, hz);
  const roofCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36, emissive: 0x7f1d1d, emissiveIntensity: 0.2 })
  );
  roofCap.position.set(hx, floorY + wallH + 2.42, hz);
  standGroup.add(roofStem, roofCap);
  for (let sp = 0; sp < 6; sp++) {
    const a = (sp / 6) * Math.PI * 2;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), whiteMat);
    dot.position.set(hx + Math.cos(a) * 0.68, floorY + wallH + 2.86, hz + Math.sin(a) * 0.68);
    standGroup.add(dot);
  }

  // Luz quente no interior da casa
  const houseLight = new THREE.PointLight(0xfef3c7, 0.85, 7.5, 1.5);
  houseLight.position.set(hx, floorY + 2.85, hz);
  standGroup.add(houseLight);

  // 4. Toldos Listrados Laranja e Branco na frente (esquerda e direita da entrada, igual à imagem!)
  [-1.85, 1.85].forEach((ox) => {
    for (let st = 0; st < 7; st++) {
      const stripe = makeBox(0.27, 0.08, 1.15, st % 2 === 0 ? orangeMat : whiteMat);
      stripe.position.set(hx + ox - 0.81 + st * 0.27, floorY + 2.38, frontZ + 0.58);
      stripe.rotation.x = 0.28;
      standGroup.add(stripe);
    }
  });

  // Placa luminosa dinâmica na fachada frontal da casa ("🍄 EMPÓRIO MYCOCAMPUS")
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 128;
    roadStandState.signCanvas = c;
    roadStandState.signCtx = c.getContext('2d');
    roadStandState.signTex = new THREE.CanvasTexture(c);
    drawRoadStandSign();
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.65, 0.96),
      new THREE.MeshBasicMaterial({ map: roadStandState.signTex, side: THREE.DoubleSide })
    );
    signMesh.position.set(hx, floorY + 3.05, frontZ + 0.14);
    standGroup.add(signMesh);
  }

  // 5. INTERIOR DA CASA: Bancada com Pia Inox + Água Corrente + Bancada Lateral de Empilhamento de Caixas!
  addWallLabBench(ctx, hx - 0.6, hz - 1.65, 3.2, 1.0, {
    hole: { cx: hx - 1.4, cz: hz - 1.65, w: 0.60, d: 0.50 },
    sinkPos: { x: hx - 1.4, z: hz - 1.65 }
  });
  addMovableStainlessTable(ctx, 'table_emporio_east', 'Bancada Inox (Empório Estrada)', hx + 2.0, floorY, hz - 0.2, 1.1, 0.82, 2.2);

  // 6. ESTANTES / BANCAS EXPOSITORAS DA FRENTE (x: 9.65 e x: 13.35, z: 35.65 — sob os toldos!)
  // Possuem `supportSurfaces` reais para colocar caixas/pacotes/cogumelos em cima E hitbox de clique rápido!
  const shelfXList = [hx - 1.85, hx + 1.85];
  const shelfZ = frontZ + 0.85;
  for (let si = 0; si < shelfXList.length; si++) {
    const sx = shelfXList[si];
    const shelfBase = makeBox(1.75, 0.82, 0.85, counterMat);
    shelfBase.position.set(sx, 0.41, shelfZ);
    const shelfTop = makeBox(1.82, 0.06, 0.92, woodMat);
    shelfTop.position.set(sx, 0.85, shelfZ);
    standGroup.add(shelfBase, shelfTop);

    // Plaquinha de preço verde ("$ 120") em cima da estante igual à imagem!
    const pricePost = makeBox(0.04, 0.26, 0.04, woodMat, { noShadow: true });
    pricePost.position.set(sx - 0.72, 1.00, shelfZ + 0.36);
    const priceCard = makeBox(0.32, 0.18, 0.04, new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.6 }), { noShadow: true });
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

    const standHit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.35, 1.05), hitMat);
    standHit.position.set(sx, 0.72, shelfZ);
    standHit.userData.isRoadSaleStand = true;
    standGroup.add(standHit);
    roadSaleStandMeshes.push(standHit);
  }

  // Pacotes verdes visuais empilhados sobre as 2 estantes da frente (até 12 visíveis)
  for (let i = 0; i < 12; i++) {
    const pm = makeBox(0.22, 0.07, 0.16, packMat);
    const isRight = i >= 6;
    const localIdx = i % 6;
    const col = localIdx % 3;
    const row = Math.floor(localIdx / 3);
    const baseShelfX = isRight ? (hx + 1.85) : (hx - 1.85);
    pm.position.set(baseShelfX - 0.32 + col * 0.34, 0.92 + row * 0.08, shelfZ);
    pm.visible = false;
    standGroup.add(pm);
    roadStandState.standPacksMeshes.push(pm);
    roadSaleDynamicObjects.push(pm);
  }

  scene.add(standGroup);

  // Cria o conjunto 3D reutilizável de Carro + NPC Comprador + Notas de Dinheiro para a animação Drive-Thru!
  buildNpcCarActor(scene);
}

function buildNpcCarActor(scene) {
  const carGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.32, metalness: 0.45 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.3 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const chassis = makeBox(3.4, 0.68, 1.65, bodyMat);
  chassis.position.y = 0.52;
  const cabin = makeBox(1.85, 0.58, 1.48, cabinMat);
  cabin.position.set(-0.15, 1.10, 0);
  carGroup.add(chassis, cabin);

  const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
  wGeo.rotateX(Math.PI / 2);
  [[-1.1, -0.84], [1.1, -0.84], [-1.1, 0.84], [1.1, 0.84]].forEach((wp) => {
    const w = new THREE.Mesh(wGeo, wheelMat);
    w.position.set(wp[0], 0.32, wp[1]);
    carGroup.add(w);
  });
  const hl1 = makeBox(0.08, 0.16, 0.28, lightMat, { noShadow: true });
  hl1.position.set(1.71, 0.56, -0.55);
  const hl2 = makeBox(0.08, 0.16, 0.28, lightMat, { noShadow: true });
  hl2.position.set(1.71, 0.56, 0.55);
  carGroup.add(hl1, hl2);
  carGroup.visible = false;
  scene.add(carGroup);
  roadSaleDynamicObjects.push(carGroup);

  // NPC Comprador articulado
  const npcGroup = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.65 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.48 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.72, 12), shirtMat);
  torso.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), headMat);
  head.position.y = 1.22;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat);
  hat.position.y = 1.34;
  const heldPack = makeBox(0.18, 0.08, 0.14, new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 }));
  heldPack.position.set(0, 0.76, -0.28);
  heldPack.visible = false;

  // Cédulas de dinheiro / Moedas Douradas flutuando durante o pagamento
  const cashGroup = new THREE.Group();
  const billMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
  const coinMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  for (let i = 0; i < 5; i++) {
    const bill = makeBox(0.16, 0.02, 0.09, i % 2 === 0 ? billMat : coinMat, { noShadow: true });
    bill.position.set((i - 2) * 0.11, 1.55 + (i % 2) * 0.12, -0.15);
    cashGroup.add(bill);
  }
  cashGroup.visible = false;

  npcGroup.add(torso, head, hat, heldPack, cashGroup);
  npcGroup.visible = false;
  scene.add(npcGroup);
  roadSaleDynamicObjects.push(npcGroup);

  roadStandState.actor = {
    carGroup,
    bodyMat,
    npcGroup,
    shirtMat,
    hatMat,
    heldPack,
    cashGroup
  };
}

export function isHoldingPackOrCrateForStand(held) {
  if (!held) return false;
  if (held.deliveryCrateCtrl && held.deliveryCrateCtrl.packsCount > 0) return true;
  if (held.mushroomBagCtrl && held.mushroomBagCtrl.filled && held.mushroomBagCtrl.sealed) return true;
  return false;
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
    playAudio('playClick');
    if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
    if (onToast) {
      onToast(`🚗📦 ${count} pacote(s) selado(s) colocados no Quiosque Drive-Thru da Estrada! Aguarde: um carro de cliente já está vindo comprar!`);
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  if (held && held.mushroomBagCtrl && held.mushroomBagCtrl.filled && held.mushroomBagCtrl.sealed) {
    roadStandState.availablePacks += 1;
    roadStandState.npcSpawnCooldown = Math.min(roadStandState.npcSpawnCooldown, 1.2);
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
    if (p.x < 8.5 || p.x > 14.5 || p.z < 34.8 || p.z > 36.8 || p.y < 0.4) continue;
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
 * Simulação frame-a-frame dos clientes NPCs que passam de carro na Avenida Sul (z = 39.5)
 * apenas quando há pacotes de cogumelos desidratados disponíveis no Quiosque Drive-Thru
 * ou colocados fisicamente sobre as estantes da frente!
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
    actor.carGroup.position.set(-48, 0.04, 39.5);
    actor.carGroup.rotation.y = 0;
    actor.carGroup.visible = true;
    actor.npcGroup.visible = false;
    actor.heldPack.visible = false;
    actor.cashGroup.visible = false;

    roadStandState.activeNpcOrder = {
      profile,
      phase: 'driving_in', // driving_in -> walking_to_stand -> paying_happy -> walking_to_car -> driving_away
      timer: 0
    };
    return;
  }

  const order = roadStandState.activeNpcOrder;
  const standX = 11.5;
  const roadZ = 39.5;
  const standStopZ = 37.3;

  if (order.phase === 'driving_in') {
    actor.carGroup.position.x = Math.min(standX, actor.carGroup.position.x + dt * 16.5);
    if (actor.carGroup.position.x >= standX - 0.05) {
      actor.carGroup.position.x = standX;
      order.phase = 'walking_to_stand';
      order.timer = 0;
      actor.npcGroup.position.set(standX, 0.04, roadZ - 0.9);
      actor.npcGroup.rotation.y = Math.PI;
      actor.npcGroup.visible = true;
      actor.heldPack.visible = false;
      actor.cashGroup.visible = false;
    }
  } else if (order.phase === 'walking_to_stand') {
    order.timer += dt;
    actor.npcGroup.position.z = Math.max(standStopZ, actor.npcGroup.position.z - dt * 2.2);
    actor.npcGroup.position.y = 0.04 + Math.abs(Math.sin(order.timer * 10)) * 0.06;
    if (actor.npcGroup.position.z <= standStopZ + 0.04) {
      order.phase = 'paying_happy';
      order.timer = 0;
      actor.cashGroup.visible = true;
      playAudio('playHarvest');
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
          soldOne = true;
        } else {
          const soldIt = entry.item;
          if (soldIt.mesh && soldIt.mesh.parent) soldIt.mesh.parent.remove(soldIt.mesh);
          disposeObjectResources(soldIt.mesh);
          const idx = ctx.pickableItems.indexOf(soldIt);
          if (idx !== -1) ctx.pickableItems.splice(idx, 1);
          if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') ctx.pickableMap.delete(soldIt.id);
          soldOne = true;
        }
      }
      if (soldOne) {
        roadStandState.totalSoldPacks++;
        roadStandState.totalCoinsEarned += MYCOCOIN_PRICE_PER_PACK;
        const newBalance = addLocalMycoCoins(MYCOCOIN_PRICE_PER_PACK);
        syncRoadStandVisual();
        actor.heldPack.visible = true;
        if (ctx && ctx.callbacks && ctx.callbacks.onHarvestMushroom) {
          ctx.callbacks.onHarvestMushroom('sale_pack_' + roadStandState.totalSoldPacks);
        }
        if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast(`🚗💵 ${order.profile.name}: ${order.profile.quote} (Saldo: 🪙 ${newBalance} MycoCoins)`);
        }
      }
    }
  } else if (order.phase === 'paying_happy') {
    order.timer += dt;
    // Animação feliz do NPC pulando e notas de dinheiro subindo!
    actor.npcGroup.position.y = 0.04 + Math.abs(Math.sin(order.timer * 9.5)) * 0.18;
    actor.npcGroup.rotation.y = Math.PI + Math.sin(order.timer * 7) * 0.35;
    actor.cashGroup.position.y = order.timer * 0.45;
    actor.cashGroup.rotation.y = order.timer * 3.5;

    if (order.timer >= 2.2) {
      order.phase = 'walking_to_car';
      order.timer = 0;
      actor.cashGroup.visible = false;
      actor.cashGroup.position.y = 0;
      actor.npcGroup.rotation.y = 0;
    }
  } else if (order.phase === 'walking_to_car') {
    order.timer += dt;
    actor.npcGroup.position.z = Math.min(roadZ - 0.85, actor.npcGroup.position.z + dt * 2.4);
    actor.npcGroup.position.y = 0.04 + Math.abs(Math.sin(order.timer * 10)) * 0.06;
    if (actor.npcGroup.position.z >= roadZ - 0.88) {
      actor.npcGroup.visible = false;
      order.phase = 'driving_away';
      order.timer = 0;
    }
  } else if (order.phase === 'driving_away') {
    actor.carGroup.position.x += dt * 19.0;
    if (actor.carGroup.position.x >= 68) {
      actor.carGroup.visible = false;
      roadStandState.activeNpcOrder = null;
      // Próximo cliente vem em um tempo aleatório diferente (entre 3.5s e 7.5s) se ainda houver cogumelos!
      roadStandState.npcSpawnCooldown = 3.5 + Math.random() * 4.0;
    }
  }
}
