/**
 * Estado Compartilhado, Pedidos VIP, Placa Dinâmica e Assets de Cesta do Empório MycoCampus.
 */

import {
  MYCOCOIN_PRICE_PER_PACK,
  VIP_SPECIES_MENU
} from '../core/myco-coins.js';

const THREE = window.THREE;

export const roadSaleStandMeshes = [];
export const roadSaleDynamicObjects = [];

export const roadStandState = {
  availablePacks: 0,
  speciesList: [],
  gramsList: [],
  itemKinds: [],
  standPacksMeshes: [],
  standVeggieMeshes: [],
  signCanvas: null,
  signCtx: null,
  signTex: null,
  npcSpawnCooldown: 2.5,
  activeNpcOrder: null,
  totalSoldPacks: 0,
  totalCoinsEarned: 0
};

export function getActiveVipOrders() {
  const base = Math.floor(roadStandState.totalSoldPacks / 3) % VIP_SPECIES_MENU.length;
  return [VIP_SPECIES_MENU[base], VIP_SPECIES_MENU[(base + 1) % VIP_SPECIES_MENU.length]];
}

export function matchVipOrder(speciesName) {
  const s = String(speciesName || '').toLowerCase();
  if (!s) return null;
  const vips = getActiveVipOrders();
  for (let i = 0; i < vips.length; i++) {
    const target = vips[i].toLowerCase();
    if (s.includes(target) || target.includes(s)) {
      return { index: i, species: vips[i] };
    }
  }
  return null;
}

export function drawRoadStandSign() {
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
      ? `📦 ${roadStandState.availablePacks} pacote(s) à venda`
      : '📦 Estoque vazio • traga pacotes selados ou uma caixa de entrega',
    w / 2,
    94
  );

  sctx.fillStyle = '#fcd34d';
  sctx.font = 'bold 17px system-ui, sans-serif';
  sctx.fillText(`🪙 ${MYCOCOIN_PRICE_PER_PACK} Coins/pct • Vendidos: ${roadStandState.totalSoldPacks}`, w / 2, 122);

  const vips = getActiveVipOrders();
  sctx.fillStyle = '#fef08a';
  sctx.font = 'bold 14px system-ui, sans-serif';
  sctx.fillText(`⭐ VIP (+50%): ${vips[0]} | ${vips[1]}`, w / 2, 146);

  if (roadStandState.signTex) roadStandState.signTex.needsUpdate = true;
}

let sharedVeggieStandAssets = null;
export function getVeggieStandAssets() {
  if (sharedVeggieStandAssets) return sharedVeggieStandAssets;
  const torusGeo = new THREE.TorusGeometry(0.088, 0.011, 6, 14);
  const handleGeo = new THREE.TorusGeometry(0.082, 0.0085, 6, 14, Math.PI);
  const lettuceGeo = new THREE.DodecahedronGeometry(0.036, 0);
  const tomatoGeo = new THREE.SphereGeometry(0.025, 10, 8);
  const assets = {
    baseGeo: new THREE.CylinderGeometry(0.086, 0.072, 0.062, 12),
    rimGeo: torusGeo,
    handleGeo,
    lettuceGeo,
    tomatoGeo,
    calyxGeo: new THREE.ConeGeometry(0.009, 0.008, 5),
    wickerMat: new THREE.MeshStandardMaterial({ color: 0xc58b48, roughness: 0.82 }),
    wickerTrimMat: new THREE.MeshStandardMaterial({ color: 0xd6a45f, roughness: 0.78 }),
    lettuceMat: new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.62, flatShading: true }),
    lettuceInnerMat: new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.58, flatShading: true }),
    tomatoMat: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.34 }),
    calyxMat: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 })
  };
  Object.keys(assets).forEach((k) => {
    if (assets[k] && assets[k].userData) assets[k].userData.shared = true;
  });
  sharedVeggieStandAssets = assets;
  return assets;
}

export function createOrganicVeggieStandVisual() {
  const a = getVeggieStandAssets();
  const wrap = new THREE.Group();

  const basketBody = new THREE.Mesh(a.baseGeo, a.wickerMat);
  basketBody.scale.set(1.12, 1, 0.82);
  basketBody.position.y = 0.031;

  const rim = new THREE.Mesh(a.rimGeo, a.wickerTrimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.scale.set(1.14, 0.84, 1);
  rim.position.y = 0.062;

  const handle = new THREE.Mesh(a.handleGeo, a.wickerMat);
  handle.position.y = 0.056;
  handle.scale.set(1.1, 1.0, 1.0);

  wrap.add(basketBody, rim, handle);

  for (let i = 0; i < 2; i++) {
    const ox = -0.042 + i * 0.084;
    const lOuter = new THREE.Mesh(a.lettuceGeo, a.lettuceMat);
    lOuter.scale.set(1.0, 0.78, 0.96);
    lOuter.position.set(ox, 0.068, 0.022);
    const lInner = new THREE.Mesh(a.lettuceGeo, a.lettuceInnerMat);
    lInner.scale.set(0.7, 0.65, 0.7);
    lInner.position.set(ox, 0.084, 0.022);

    const tom = new THREE.Mesh(a.tomatoGeo, a.tomatoMat);
    tom.scale.set(1, 0.88, 1);
    tom.position.set(ox, 0.072, -0.024);
    const calyx = new THREE.Mesh(a.calyxGeo, a.calyxMat);
    calyx.position.set(ox, 0.095, -0.024);

    wrap.add(lOuter, lInner, tom, calyx);
  }

  return wrap;
}

export function syncRoadStandVisual() {
  while (roadStandState.itemKinds.length < roadStandState.availablePacks) {
    roadStandState.itemKinds.push('mushroom');
  }
  if (roadStandState.itemKinds.length > roadStandState.availablePacks) {
    roadStandState.itemKinds.length = Math.max(0, roadStandState.availablePacks);
  }
  const count = Math.max(roadStandState.standPacksMeshes.length, roadStandState.standVeggieMeshes.length);
  for (let i = 0; i < count; i++) {
    const active = i < roadStandState.availablePacks;
    const isVeggie = active && roadStandState.itemKinds[i] === 'veggie';
    if (roadStandState.standPacksMeshes[i]) {
      roadStandState.standPacksMeshes[i].visible = active && !isVeggie;
    }
    if (roadStandState.standVeggieMeshes[i]) {
      roadStandState.standVeggieMeshes[i].visible = isVeggie;
    }
  }
  drawRoadStandSign();
}
