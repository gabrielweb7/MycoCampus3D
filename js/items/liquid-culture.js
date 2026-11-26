/**
 * Frasco de Cultura Liquida 800ml e Bequer 1L (MycoCampus3D)
 */

import { getCultureOriginLabel } from '../core/culture-origin.js';
import { registerPickable, makeScaleTex, mergeStaticGeos } from './item-registry.js';
import {
  createCultureLifecycleState,
  getCultureRemainingDays
} from './culture-lifecycle.js';
import { pickContamKind, getContamInfo } from './contaminations.js';

const THREE = window.THREE;

let sharedLiquidAssets = null;
function getSharedLiquidAssets() {
  if (sharedLiquidAssets) return sharedLiquidAssets;
  const jBody = new THREE.CylinderGeometry(0.088, 0.088, 0.21, 22, 1, true);
  const jBottom = new THREE.CylinderGeometry(0.088, 0.088, 0.01, 22);
  const jShoulder = new THREE.CylinderGeometry(0.068, 0.088, 0.035, 22);
  const jarShellGeo = mergeStaticGeos([
    { geo: jBody, y: 0.11 },
    { geo: jBottom, y: 0.005 },
    { geo: jShoulder, y: 0.232 }
  ]);
  jBody.dispose();
  jBottom.dispose();
  jShoulder.dispose();

  const bBody = new THREE.CylinderGeometry(0.095, 0.095, 0.23, 22, 1, true);
  const bBottom = new THREE.CylinderGeometry(0.095, 0.095, 0.01, 22);
  const bRim = new THREE.TorusGeometry(0.097, 0.006, 8, 22);
  const beakerShellGeo = mergeStaticGeos([
    { geo: bBody, y: 0.12 },
    { geo: bBottom, y: 0.005 },
    { geo: bRim, y: 0.235, rx: Math.PI / 2 }
  ]);
  bBody.dispose();
  bBottom.dispose();
  bRim.dispose();

  sharedLiquidAssets = {
    jarShellGeo,
    beakerShellGeo,
    jarScaleGeo: new THREE.CylinderGeometry(0.089, 0.089, 0.19, 20, 1, true),
    jarLiqGeo: new THREE.CylinderGeometry(0.082, 0.082, 0.19, 20),
    beakerScaleGeo: new THREE.CylinderGeometry(0.096, 0.096, 0.21, 20, 1, true),
    beakerLiqGeo: new THREE.CylinderGeometry(0.089, 0.089, 0.20, 20),
    mycCloudGeo: new THREE.SphereGeometry(0.048, 12, 10),
    stirBarGeo: new THREE.CylinderGeometry(0.009, 0.009, 0.052, 10),
    capGeo: new THREE.CylinderGeometry(0.074, 0.074, 0.034, 20),
    injPortGeo: new THREE.CylinderGeometry(0.014, 0.014, 0.016, 12),
    filterPortGeo: new THREE.CylinderGeometry(0.013, 0.016, 0.022, 12),
    jarGlassMat: new THREE.MeshStandardMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.12, depthWrite: false }),
    beakerGlassMat: new THREE.MeshStandardMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0.12, depthWrite: false }),
    jarScaleMat: new THREE.MeshBasicMaterial({ map: makeScaleTex(800, 200, '800ml'), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
    beakerScaleMat: new THREE.MeshBasicMaterial({ map: makeScaleTex(1000, 200, '1000ml'), transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide }),
    stirBarMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
    capMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }),
    injPortMat: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 }),
    filterPortMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.9 })
  };
  Object.keys(sharedLiquidAssets).forEach((k) => {
    const v = sharedLiquidAssets[k];
    if (v && v.userData) v.userData.shared = true;
  });
  return sharedLiquidAssets;
}

export const LIQUID_JAR_META = {
  category: 'liquid_culture',
  purpose: 'Cultura líquida com septo de borracha para aspiração estéril via seringa',
  maxVolumeMl: 800,
  getWeightGrams: (item) => 260 + ((item && item.mesh && item.mesh.userData.liquidCtrl) ? item.mesh.userData.liquidCtrl.volMl : 0),
  getTempC: (item, ctx) => {
    if (item && item.cultureCtrl && typeof item.cultureCtrl.tempC === 'number') {
      return item.cultureCtrl.tempC;
    }
    return item && item.cultureCtrl && item.cultureCtrl.refrigerated
      ? 4
      : 24.5 + Math.sin(((ctx && ctx.clock && ctx.clock.elapsedTime) || 0) * 2.0) * 0.2;
  },
  compatibilities: {
    canEnterCooker: true,
    fillsFromSink: false,
    receivesSyringe: true,
    providesLiquidCulture: true,
    stirsOnMagneticPlate: true
  },
  connections: ['magnetic_stirrer', 'syringe', 'pressure_cooker']
};

export const BEAKER_META = {
  category: 'glassware',
  purpose: 'Béquer graduado 1L para preparo e mistura de soluções nutritivas',
  maxVolumeMl: 1000,
  baseTempC: 23.5,
  getWeightGrams: (item) => 260 +
    ((item && item.mesh && item.mesh.userData.liquidCtrl) ? item.mesh.userData.liquidCtrl.volMl : 0) +
    ((item && item.pdaMediumCtrl) ? item.pdaMediumCtrl.powderGrams : 0),
  compatibilities: {
    canEnterCooker: true,
    fillsFromSink: true,
    receivesSyringe: true,
    stirsOnMagneticPlate: true,
    poursWater: true,
    receivesWater: true,
    receivesPdaPowder: true,
    receivesPdaWater: true
  },
  connections: [
    'magnetic_stirrer', 'precision_scale', 'syringe', 'pda_bottle', 'distilled_jug',
    'pda_media_bottle', 'petri_dish', 'pp5_cup'
  ]
};

export function updateCultureLiquidLabel(item) {
  const liquid = item && item.mesh && item.mesh.userData.liquidCtrl;
  const culture = item && item.cultureCtrl;
  if (!liquid || !culture) return;
  const originLabel = getCultureOriginLabel(culture.origin);
  const volumeLabel = liquid.baseLabel + ' (' + liquid.volMl + 'ml/' + liquid.maxMl + 'ml)' + (originLabel ? ' • ' + originLabel : '');
  if (liquid.volMl <= 0) {
    item.label = volumeLabel + ' • sem cultura líquida';
  } else if (culture.contaminated) {
    if (!culture.contamKind) culture.contamKind = pickContamKind('liquid');
    const cInfo = getContamInfo(culture.contamKind);
    if (liquid.liqMesh && liquid.liqMesh.material && liquid.liqMesh.material.color) {
      liquid.liqMesh.material.color.setHex(cInfo.liquidHex || 0x166534);
      liquid.liqMesh.material.opacity = 0.84;
    }
    if (liquid.mycCloud && liquid.mycCloud.material && liquid.mycCloud.material.color) {
      liquid.mycCloud.material.color.setHex(cInfo.hex || 0x16a34a);
    }
    item.label = volumeLabel + ' • 🦠 ' + cInfo.shortLabel;
  } else if (culture.expired) {
    item.label = volumeLabel + ' • cultura vencida';
  } else if (culture.colonized) {
    const tempVal = typeof culture.tempC === 'number' ? culture.tempC : (culture.refrigerated ? 4.0 : 24.5);
    const temperature = tempVal.toFixed(1).replace('.', ',') + '°C' + (culture.refrigerated ? ' ❄️' : '');
    item.label = volumeLabel + ' • 100% colonizada • ' + temperature +
      ' • validade ' + getCultureRemainingDays(culture) + ' dias';
  } else if (culture.inoculated) {
    const tempVal = typeof culture.tempC === 'number' ? culture.tempC : (culture.refrigerated ? 4.0 : 24.5);
    const temperature = tempVal.toFixed(1).replace('.', ',') + '°C' + (culture.refrigerated ? ' ❄️' : '');
    item.label = volumeLabel + (culture.origin === 'monospore' ? ' • germinando e colonizando ' : ' • colonizando ') + Math.floor(culture.colonization || 0) + '% • ' + temperature;
  } else {
    const nutTag = culture.hasNutrient === false ? ' • 💧 Sem nutriente (adicione Malte 4%)' : ' • 🍯 Caldo 4%';
    const sterTag = (culture.sterilized || liquid.sterilized || item.sterilized) ? ' • estéril ✅' : ' • não esterilizada';
    item.label = volumeLabel + nutTag + sterTag;
  }
}

export function updateContainerVolume(item, newVol, honeyMl) {
  if (!item || !item.mesh || !item.mesh.userData.liquidCtrl) return;
  const ctrl = item.mesh.userData.liquidCtrl;
  const clamped = Math.max(0, Math.min(ctrl.maxMl, Math.round(newVol * 10) / 10));
  const previousVol = ctrl.volMl;
  if (honeyMl === undefined && ctrl.honeyMl > 0) {
    honeyMl = clamped < previousVol ? ctrl.honeyMl * clamped / previousVol : ctrl.honeyMl;
  }
  if (honeyMl !== undefined) ctrl.honeyMl = Math.max(0, Math.min(clamped, honeyMl));
  ctrl.volMl = clamped;
  if (item.cultureCtrl && clamped <= 0) {
    item.cultureCtrl.colonized = false;
    item.cultureCtrl.inoculated = false;
    item.cultureCtrl.origin = '';
    item.cultureCtrl.colonization = 0;
    item.cultureCtrl.hasNutrient = false;
  }
  const frac = clamped / ctrl.maxMl;
  if (clamped <= 0) {
    ctrl.liqMesh.visible = false;
    if (ctrl.mycCloud) ctrl.mycCloud.visible = false;
  } else {
    ctrl.liqMesh.visible = true;
    ctrl.liqMesh.scale.y = Math.max(0.02, frac);
    ctrl.liqMesh.position.y = ctrl.baseY + (ctrl.maxH * frac) * 0.5;
    if (ctrl.mycCloud) {
      const cCtrl = item.cultureCtrl;
      const showCloud = !!(cCtrl && (cCtrl.colonized || cCtrl.inoculated));
      ctrl.mycCloud.visible = showCloud;
      if (showCloud) {
        const growthScale = cCtrl.colonized ? 1 : Math.max(0.28, (cCtrl.colonization || 0) / 100);
        ctrl.mycCloud.scale.set(1.25 * growthScale, 0.55 * growthScale, 1.15 * growthScale);
      }
      ctrl.mycCloud.position.y = ctrl.baseY + Math.min(ctrl.maxH * frac * 0.45, 0.048);
    }
  }
  if (typeof ctrl.onAfterVolumeUpdate === 'function') {
    ctrl.onAfterVolumeUpdate(item, clamped);
  } else if (item.pdaMediumCtrl && item.pdaMediumCtrl.updateVisual) {
    item.pdaMediumCtrl.updateVisual();
  } else if (item.cultureCtrl) {
    updateCultureLiquidLabel(item);
  } else {
    const sterTag = (ctrl.sterilized || item.sterilized) ? ' • ✅ Estéril' : '';
    item.label = ctrl.baseLabel + ' (' + clamped + 'ml/' + ctrl.maxMl + 'ml' + sterTag + ')';
  }
  if (item.pdaMediumCtrl && !item.cultureCtrl) return;
  const color = ctrl.liqMesh.material?.color;
  if (ctrl.honeyMl > 0.05) {
    if (color) {
      ctrl.honeyBaseColor ??= color.getHex();
      color.setHex(0xe89428);
    }
    item.label += ' • 🍯';
  } else if (color && ctrl.honeyBaseColor !== undefined) {
    color.setHex(ctrl.honeyBaseColor);
    delete ctrl.honeyBaseColor;
  }
}

export function makeLiquidJar800(ctx, id, px, py, pz, initMl) {
  const A = getSharedLiquidAssets();
  const jg = new THREE.Group();
  const scaleCyl = new THREE.Mesh(A.jarScaleGeo, A.jarScaleMat);
  scaleCyl.position.y = 0.11;
  const liqMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xca8a04, emissiveIntensity: 0.14, transparent: true, opacity: 0.58, roughness: 0.15 });
  const liqMesh = new THREE.Mesh(A.jarLiqGeo, liqMat);
  const mycCloud = new THREE.Mesh(
    A.mycCloudGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf8fafc, emissiveIntensity: 0.25, transparent: true, opacity: 0.72, roughness: 0.85 })
  );
  mycCloud.scale.set(1.25, 0.55, 1.15);
  const stirBar = new THREE.Mesh(A.stirBarGeo, A.stirBarMat);
  stirBar.rotation.z = Math.PI / 2;
  stirBar.position.set(0, 0.018, 0);
  const cap = new THREE.Mesh(A.capGeo, A.capMat);
  cap.position.y = 0.266;
  const injPort = new THREE.Mesh(A.injPortGeo, A.injPortMat);
  injPort.position.set(0.036, 0.290, 0);
  const filterPort = new THREE.Mesh(A.filterPortGeo, A.filterPortMat);
  filterPort.position.set(-0.036, 0.292, 0);

  if (A.jarShellGeo) {
    jg.add(liqMesh, mycCloud, stirBar, new THREE.Mesh(A.jarShellGeo, A.jarGlassMat), scaleCyl, cap, injPort, filterPort);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.21, 22, 1, true), A.jarGlassMat);
    body.position.y = 0.11;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.01, 22), A.jarGlassMat);
    bottom.position.y = 0.005;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.088, 0.035, 22), A.jarGlassMat);
    shoulder.position.y = 0.232;
    jg.add(liqMesh, mycCloud, stirBar, body, bottom, shoulder, scaleCyl, cap, injPort, filterPort);
  }
  jg.userData.liquidCtrl = {
    volMl: initMl, maxMl: 800, baseY: 0.012, maxH: 0.19,
    liqMesh, mycCloud, stirBar,
    baseLabel: 'Cultura Líquida 800ml'
  };
  const item = registerPickable(ctx, id, 'Cultura Líquida 800ml', jg, px, py, pz, 0, 0.14, 0.30, LIQUID_JAR_META);
  item.setVolume = function (v) { updateContainerVolume(item, v); };
  item.cultureCtrl = Object.assign(createCultureLifecycleState(initMl > 0), {
    hasNutrient: initMl > 0,
    sterilized: initMl > 0
  });
  jg.userData.cultureCtrl = item.cultureCtrl;
  updateContainerVolume(item, initMl);
  return item;
}

export function makeBeaker1L(ctx, id, px, py, pz, initMl) {
  const A = getSharedLiquidAssets();
  const bg = new THREE.Group();
  const scaleCyl = new THREE.Mesh(A.beakerScaleGeo, A.beakerScaleMat);
  scaleCyl.position.y = 0.12;
  const liqMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x0284c7, emissiveIntensity: 0.10, transparent: true, opacity: 0.52, roughness: 0.15 });
  const liqMesh = new THREE.Mesh(A.beakerLiqGeo, liqMat);
  const stirBar = new THREE.Mesh(A.stirBarGeo, A.stirBarMat);
  stirBar.rotation.z = Math.PI / 2;
  stirBar.position.set(0, 0.018, 0);
  if (A.beakerShellGeo) {
    bg.add(liqMesh, stirBar, new THREE.Mesh(A.beakerShellGeo, A.beakerGlassMat), scaleCyl);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.23, 22, 1, true), A.beakerGlassMat);
    body.position.y = 0.12;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.01, 22), A.beakerGlassMat);
    bottom.position.y = 0.005;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.097, 0.006, 8, 22), A.beakerGlassMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.235;
    bg.add(liqMesh, stirBar, body, bottom, rim, scaleCyl);
  }
  bg.userData.liquidCtrl = {
    volMl: initMl, maxMl: 1000, baseY: 0.012, maxH: 0.20,
    liqMesh, mycCloud: null, stirBar, syringePortY: 0.22,
    baseLabel: 'Béquer 1L'
  };
  const item = registerPickable(ctx, id, 'Béquer 1L', bg, px, py, pz, 0, 0.14, 0.24, BEAKER_META);
  item.setVolume = function (v) { updateContainerVolume(item, v); };
  updateContainerVolume(item, initMl);
  return item;
}
