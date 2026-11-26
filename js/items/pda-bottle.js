/**
 * Frasco de Agar BDA / PDA 500g (MycoCampus3D)
 */

import { getCachedCanvasTexture, registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const LC_NUTRIENT_META = {
  category: 'reagent',
  purpose: 'Extrato de Malte + Mel (caldo nutritivo 4%) para preparar Cultura Líquida (4g por 100ml)',
  getWeightGrams: (item) => 55 + (item && item.lcNutrientCtrl ? item.lcNutrientCtrl.remainingGrams : 250),
  baseTempC: 23.0,
  compatibilities: { canEnterCooker: false, addsLcNutrient: true },
  connections: ['liquid_culture', 'beaker_1l', 'distilled_jug']
};

export function updateLcNutrientLabel(item) {
  if (!item || !item.lcNutrientCtrl) return;
  const grams = Math.round(item.lcNutrientCtrl.remainingGrams);
  item.label = item.lcNutrientCtrl.isNaturalHoney
    ? `🍯 Pote com Mel Natural (${grams}g)`
    : `🍯 Extrato de Malte / Mel 250g (${grams}g restantes • CL 4%)`;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function makeLcNutrientBottle(ctx, id, px, py, pz) {
  const g = new THREE.Group();
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xb45309, transparent: true, opacity: 0.82, roughness: 0.16 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.15, 20), amberMat);
  body.position.y = 0.075;
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.068, 0.025, 20), amberMat);
  shoulder.position.y = 0.162;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.036, 18),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 })
  );
  cap.position.y = 0.19;
  const lblTex = getCachedCanvasTexture('lc_nutrient_malt_lbl', 256, 128, (lctx) => {
    lctx.fillStyle = '#fffbeb'; lctx.fillRect(0, 0, 256, 128);
    lctx.fillStyle = '#d97706'; lctx.fillRect(0, 0, 256, 36);
    lctx.fillStyle = '#ffffff'; lctx.font = 'bold 18px system-ui, sans-serif';
    lctx.textAlign = 'center'; lctx.fillText('🍯 NUTRIENTE CL 4%', 128, 25);
    lctx.fillStyle = '#78350f'; lctx.font = 'bold 24px system-ui, sans-serif';
    lctx.fillText('MALTE / MEL', 128, 72);
    lctx.fillStyle = '#92400e'; lctx.font = '16px system-ui, sans-serif';
    lctx.fillText('4g / 100ml p/ Micélio', 128, 104);
  });
  const lbl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0695, 0.0695, 0.098, 22, 1, true, -0.9, 1.8),
    new THREE.MeshBasicMaterial({ map: lblTex, transparent: true })
  );
  lbl.position.y = 0.078;
  g.add(body, shoulder, cap, lbl);
  g.userData.isLcNutrientBottle = true;
  const item = registerPickable(ctx, id, '🍯 Extrato de Malte / Mel 250g', g, px, py, pz, 0, 0.10, 0.21, LC_NUTRIENT_META);
  item.lcNutrientCtrl = { remainingGrams: 250, maxGrams: 250 };
  updateLcNutrientLabel(item);
  return item;
}

export const PDA_BOTTLE_META = {
  category: 'reagent',
  purpose: 'Pó desidratado BDA/PDA para preparar meio de cultura',
  getWeightGrams: (item) => 40 + (item && item.pdaReagentCtrl ? item.pdaReagentCtrl.remainingGrams : 500),
  baseTempC: 24.0,
  compatibilities: { canEnterCooker: false, addsPdaPowder: true },
  connections: ['beaker_1l', 'precision_scale']
};

export function createPdaBottleGroup() {
  const pdaGroup = new THREE.Group();
  const hdpeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.05 });
  const pdaBody = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.21, 28), hdpeMat);
  pdaBody.position.y = 0.105;
  pdaBody.castShadow = true;
  const pdaShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.102, 0.038, 28), hdpeMat);
  pdaShoulder.position.y = 0.228;
  const pdaNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.024, 24), hdpeMat);
  pdaNeck.position.y = 0.255;

  const pdaC = document.createElement('canvas');
  pdaC.width = 512; pdaC.height = 256;
  const pdaCtx = pdaC.getContext('2d');
  pdaCtx.fillStyle = '#ffffff';
  pdaCtx.fillRect(0, 0, 512, 256);
  [0, 256].forEach(function (ox) {
    pdaCtx.fillStyle = '#f8fafc';
    pdaCtx.fillRect(ox + 10, 8, 236, 240);
    pdaCtx.strokeStyle = '#cbd5e1';
    pdaCtx.lineWidth = 3;
    pdaCtx.strokeRect(ox + 10, 8, 236, 240);
    pdaCtx.fillStyle = '#0284c7';
    pdaCtx.fillRect(ox + 12, 10, 232, 38);
    pdaCtx.fillStyle = '#ffffff';
    pdaCtx.font = 'bold 17px system-ui, sans-serif';
    pdaCtx.textAlign = 'center';
    pdaCtx.fillText('🧪 MYCOLAB • REAGENTE', ox + 128, 35);
    pdaCtx.fillStyle = '#0f172a';
    pdaCtx.font = '900 32px system-ui, sans-serif';
    pdaCtx.fillText('BDA / PDA', ox + 128, 86);
    pdaCtx.fillStyle = '#0369a1';
    pdaCtx.font = 'bold 20px system-ui, sans-serif';
    pdaCtx.fillText('POTATO DEXTROSE', ox + 128, 118);
    pdaCtx.fillText('AGAR • MEIO SÓLIDO', ox + 128, 144);
    pdaCtx.fillStyle = '#059669';
    pdaCtx.fillRect(ox + 28, 162, 200, 32);
    pdaCtx.fillStyle = '#ffffff';
    pdaCtx.font = 'bold 17px system-ui, sans-serif';
    pdaCtx.fillText('CULTIVO DE COGUMELOS', ox + 128, 184);
    pdaCtx.fillStyle = '#334155';
    pdaCtx.font = 'bold 21px system-ui, sans-serif';
    pdaCtx.fillText('PESO LÍQ. 500g  •  pH 5.6', ox + 128, 222);
    pdaCtx.fillStyle = '#ea580c';
    pdaCtx.fillRect(ox + 12, 236, 232, 10);
  });
  const pdaLabelTex = new THREE.CanvasTexture(pdaC);
  pdaLabelTex.anisotropy = 4;
  const pdaLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1035, 0.1035, 0.175, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: pdaLabelTex, roughness: 0.32 })
  );
  pdaLabel.position.y = 0.105;

  const capMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32 });
  const pdaCap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.080, 0.056, 24), capMat);
  pdaCap.position.y = 0.285;
  const pdaSealRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.010, 24),
    new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.4 })
  );
  pdaSealRing.position.y = 0.254;
  pdaGroup.add(pdaBody, pdaShoulder, pdaNeck, pdaLabel, pdaCap, pdaSealRing);
  return pdaGroup;
}
