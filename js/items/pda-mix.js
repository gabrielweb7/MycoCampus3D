/**
 * Preparo, transferencia e frasco de meio PDA/BDA (MycoCampus3D)
 */

import { makeScaleTex, registerPickable } from './item-registry.js';
import { updateContainerVolume } from './liquid-culture.js';

const THREE = window.THREE;

export const PDA_GRAMS_PER_LITER = 40;
export const PDA_POWDER_DOSE_GRAMS = 1;
export const PDA_MIX_TIME_SECONDS = 4;

export const PDA_MEDIA_BOTTLE_META = {
  category: 'glassware',
  purpose: 'Frasco autoclavável de meio PDA/BDA com capacidade de trabalho de 900ml',
  maxVolumeMl: 900,
  getWeightGrams: (item) => 380 +
    ((item && item.mesh && item.mesh.userData.liquidCtrl) ? item.mesh.userData.liquidCtrl.volMl : 0) +
    ((item && item.pdaMediumCtrl) ? item.pdaMediumCtrl.powderGrams : 0),
  compatibilities: {
    canEnterCooker: true,
    fillsFromSink: true,
    poursWater: true,
    receivesWater: true,
    acceptsPdaMedium: true
  },
  connections: ['beaker_1l', 'falcon_15ml', 'petri_dish', 'pp5_cup', 'pressure_cooker', 'lab_sink']
};

export function isPdaRecipeBalanced(ctrl, volumeMl) {
  if (!ctrl || volumeMl <= 0 || ctrl.powderGrams <= 0) return false;
  const expectedGrams = volumeMl * PDA_GRAMS_PER_LITER / 1000;
  return Math.abs(ctrl.powderGrams - expectedGrams) <= Math.max(0.5, expectedGrams * 0.1);
}

export function attachPdaMediumCtrl(item, kind, isSlant) {
  if (!item || !item.mesh || !item.mesh.userData.liquidCtrl) return null;
  const liquid = item.mesh.userData.liquidCtrl;
  const material = liquid.liqMesh && liquid.liqMesh.material;
  const ctrl = {
    kind,
    isSlant: !!isSlant,
    powderGrams: 0,
    mixed: false,
    stirProgress: 0,
    sterilized: false,
    burned: false,
    baseColor: material && material.color ? material.color.getHex() : 0x7dd3fc,
    baseEmissive: material && material.emissive ? material.emissive.getHex() : 0,
    baseEmissiveIntensity: material && typeof material.emissiveIntensity === 'number' ? material.emissiveIntensity : 0
  };
  ctrl.updateVisual = function () { updatePdaMediumVisual(item); };
  item.pdaMediumCtrl = ctrl;
  item.mesh.userData.pdaMediumCtrl = ctrl;
  updatePdaMediumVisual(item);
  return ctrl;
}

export function attachPdaReagentCtrl(item) {
  if (!item || !item.mesh) return null;
  item.pdaReagentCtrl = { remainingGrams: 500, maxGrams: 500, baseLabel: 'Pó desidratado PDA/BDA 500g' };
  item.mesh.userData.pdaReagentCtrl = item.pdaReagentCtrl;
  updatePdaReagentLabel(item);
  return item.pdaReagentCtrl;
}

export function updatePdaReagentLabel(item) {
  if (!item || !item.pdaReagentCtrl) return;
  item.label = item.pdaReagentCtrl.baseLabel + ' (' + Math.round(item.pdaReagentCtrl.remainingGrams) + 'g restantes)';
}

export function addPdaPowder(source, target) {
  const reagent = source && source.pdaReagentCtrl;
  const medium = target && target.pdaMediumCtrl;
  const compatibilities = target && target.meta && target.meta.compatibilities;
  if (!reagent || !medium || medium.kind !== 'beaker' ||
      !compatibilities || !compatibilities.receivesPdaPowder) {
    return { ok: false, reason: 'Use o reagente no béquer de preparo.' };
  }
  if (medium.burned || medium.sterilized) return { ok: false, reason: 'Este meio já foi processado; use um béquer limpo.' };
  if (reagent.remainingGrams < PDA_POWDER_DOSE_GRAMS) return { ok: false, reason: 'O frasco de PDA/BDA está vazio.' };

  reagent.remainingGrams -= PDA_POWDER_DOSE_GRAMS;
  medium.powderGrams += PDA_POWDER_DOSE_GRAMS;
  medium.mixed = false;
  medium.stirProgress = 0;
  medium.sterilized = false;
  updatePdaReagentLabel(source);
  updatePdaMediumVisual(target);
  return { ok: true, gramsAdded: PDA_POWDER_DOSE_GRAMS };
}

export function markPdaVolumeChanged(item) {
  const ctrl = item && item.pdaMediumCtrl;
  if (!ctrl) return;
  ctrl.mixed = false;
  ctrl.stirProgress = 0;
  ctrl.sterilized = false;
  updatePdaMediumVisual(item);
}

export function updatePdaMediumVisual(item) {
  const ctrl = item && item.pdaMediumCtrl;
  const liquid = item && item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
  if (!ctrl || !liquid) return;

  const material = liquid.liqMesh && liquid.liqMesh.material;
  if (material && material.color) {
    if (ctrl.powderGrams > 0) {
      material.color.setHex(0x4ade80);
      if (material.emissive) material.emissive.setHex(0x15803d);
      if (typeof material.emissiveIntensity === 'number') material.emissiveIntensity = 0.12;
    } else {
      material.color.setHex(ctrl.baseColor);
      if (material.emissive) material.emissive.setHex(ctrl.baseEmissive);
      if (typeof material.emissiveIntensity === 'number') material.emissiveIntensity = ctrl.baseEmissiveIntensity;
    }
  }

  if (ctrl.kind === 'pp5' && item.spawnCtrl &&
      (item.spawnCtrl.substrateKind === 'pda' || (ctrl.powderGrams <= 0 && liquid.volMl <= 0))) {
    item.spawnCtrl.updateVisual();
    return;
  }

  if (ctrl.powderGrams <= 0) {
    item.label = liquid.baseLabel + ' (' + liquid.volMl + 'ml/' + liquid.maxMl + 'ml)';
    return;
  }

  let status;
  if (ctrl.burned) status = 'meio queimado';
  else if (ctrl.sterilized) status = 'esterilizado';
  else if (liquid.volMl <= 0) status = 'adicione água';
  else if (!isPdaRecipeBalanced(ctrl, liquid.volMl)) status = 'ajuste para 40g/L';
  else if (ctrl.mixed) status = ctrl.isSlant ? 'slant homogêneo' : 'homogêneo';
  else if (ctrl.stirProgress > 0) status = 'agitando ' + Math.floor(ctrl.stirProgress / PDA_MIX_TIME_SECONDS * 100) + '%';
  else status = 'pronto para agitar';

  item.label = liquid.baseLabel + ' (' + ctrl.powderGrams.toFixed(1) + 'g PDA • ' +
    liquid.volMl + 'ml • ' + status + ')';
}

export function transferPdaGrams(source, target, amountMl, sourceVolumeMl) {
  const sourceCtrl = source && source.pdaMediumCtrl;
  const targetCtrl = target && target.pdaMediumCtrl;
  if (!sourceCtrl || !targetCtrl || sourceVolumeMl <= 0) return 0;
  const transferred = sourceCtrl.powderGrams * amountMl / sourceVolumeMl;
  sourceCtrl.powderGrams = Math.max(0, sourceCtrl.powderGrams - transferred);
  targetCtrl.powderGrams += transferred;
  targetCtrl.mixed = true;
  targetCtrl.stirProgress = PDA_MIX_TIME_SECONDS;
  targetCtrl.sterilized = false;
  updatePdaMediumVisual(source);
  updatePdaMediumVisual(target);
  return transferred;
}

export function makePdaMediaBottle1L(ctx, id, px, py, pz) {
  const bottle = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xf0f9ff, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.12, depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 24, 1, true), glassMat);
  body.position.y = 0.20;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.018, 24), glassMat);
  bottom.position.y = 0.026;
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.13, 0.12, 24), glassMat);
  shoulder.position.y = 0.44;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.071, 0.071, 0.052, 20), glassMat);
  neck.position.y = 0.51;
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.118, 0.118, 0.30, 20),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.58, roughness: 0.14 })
  );
  const graduations = new THREE.Mesh(
    new THREE.CylinderGeometry(0.131, 0.131, 0.29, 24, 1, true),
    new THREE.MeshBasicMaterial({ map: makeScaleTex(1000, 100, '1000ml'), transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide })
  );
  graduations.position.y = 0.20;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 })
  );
  cap.position.y = 0.566;
  const capSeal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.074, 0.074, 0.012, 24),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.38 })
  );
  capSeal.position.y = 0.531;
  bottle.add(liquid, body, bottom, shoulder, neck, graduations, cap, capSeal);
  const bottleScale = 0.62;
  bottle.scale.setScalar(bottleScale);

  const liquidCtrl = {
    volMl: 0, maxMl: 900, baseY: 0.05, maxH: 0.30,
    liqMesh: liquid, mycCloud: null, stirBar: null,
    baseLabel: 'Frasco de Meio PDA 1L'
  };
  bottle.userData.liquidCtrl = liquidCtrl;
  const item = registerPickable(
    ctx, id, liquidCtrl.baseLabel, bottle, px, py, pz, 0,
    0.17 * bottleScale, 0.60 * bottleScale, PDA_MEDIA_BOTTLE_META
  );
  attachPdaMediumCtrl(item, 'media_bottle', false);
  item.setVolume = function (volume) { updateContainerVolume(item, volume); };
  updateContainerVolume(item, 0);
  return item;
}
