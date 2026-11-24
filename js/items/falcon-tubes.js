/**
 * Tubos Falcon Conicos (15ml e 50ml) + Estante Azul (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable, makeScaleTex, mergeStaticGeos, updateItemBounds } from './item-registry.js';
import { updateContainerVolume } from './liquid-culture.js';
import { updatePdaMediumVisual } from './pda-mix.js';
import {
  createCultureLifecycleState,
  getCultureRemainingDays,
  isCultureIncubationTemperatureSuitable,
  stepCultureShelfLife
} from './culture-lifecycle.js';
import { pickContamKind, getContamInfo } from './contaminations.js';

const THREE = window.THREE;

const falconAssetCache = {};
function getFalconAssets(is50) {
  const key = is50 ? '50' : '15';
  if (falconAssetCache[key]) return falconAssetCache[key];
  const r = is50 ? 0.024 : 0.015;
  const bodyH = is50 ? 0.125 : 0.115;
  const coneH = is50 ? 0.032 : 0.028;
  const bodyGeo = new THREE.CylinderGeometry(r, r, bodyH, 16, 1, true);
  const coneGeo = new THREE.ConeGeometry(r, coneH, 16, 1, true);
  const shellGeo = mergeStaticGeos([
    { geo: bodyGeo, y: coneH + bodyH / 2 },
    { geo: coneGeo, y: coneH / 2, rx: Math.PI }
  ]);
  bodyGeo.dispose();
  coneGeo.dispose();

  const maxMl = is50 ? 50 : 15;
  const assets = {
    shellGeo,
    gradGeo: new THREE.CylinderGeometry(r + 0.0005, r + 0.0005, bodyH * 0.85, 14, 1, true),
    liqGeo: new THREE.CylinderGeometry(r * 0.86, r * 0.86, bodyH * 0.9, 14),
    capGeo: new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.024, 16),
    ppMat: new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, transparent: true, opacity: 0.36, roughness: 0.15, depthWrite: false
    }),
    gradMat: new THREE.MeshBasicMaterial({
      map: makeScaleTex(maxMl, is50 ? 10 : 5, maxMl + 'ml'),
      transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide
    }),
    capMat: new THREE.MeshStandardMaterial({ color: is50 ? 0xea580c : 0x2563eb, roughness: 0.38 })
  };
  Object.keys(assets).forEach((k) => {
    if (assets[k] && assets[k].userData) assets[k].userData.shared = true;
  });
  falconAssetCache[key] = assets;
  return assets;
}

export function getFalconMeta(maxMl) {
  const is50 = maxMl >= 50;
  return {
    category: 'tube',
    purpose: is50
      ? 'Tubo Falcon 50ml para alíquotas de cultura líquida, slants ou esporos'
      : 'Tubo Falcon 15ml para coleta de esporos, slants e amostras estéreis',
    maxVolumeMl: maxMl,
    baseTempC: 23.4,
    getWeightGrams: (item) => (is50 ? 14 : 7) +
      ((item && item.mesh && item.mesh.userData.liquidCtrl) ? item.mesh.userData.liquidCtrl.volMl : 0) +
      ((item && item.pdaMediumCtrl) ? item.pdaMediumCtrl.powderGrams : 0),
    compatibilities: {
      canEnterCooker: true,
      receivesSyringe: true,
      fillsFromSink: true,
      poursWater: true,
      receivesWater: true,
      acceptsPdaMedium: !is50,
      receivesMyceliumCut: !is50,
      providesLiquidCulture: is50
    },
    connections: ['syringe', 'liquid_culture', 'lab_sink', 'pressure_cooker', 'laminar_hood', 'scalpel']
  };
}

export function updateFalconCultureVisual(item) {
  if (!item || !item.cultureCtrl || !item.mesh || !item.mesh.userData.liquidCtrl) return;
  const cc = item.cultureCtrl;
  const lc = item.mesh.userData.liquidCtrl;
  const isSlant = !!(item.pdaMediumCtrl && item.pdaMediumCtrl.isSlant);
  if (!cc.inoculated && !cc.colonized && !cc.contaminated) {
    if (lc.mycCloud) lc.mycCloud.visible = false;
    if (item.pdaMediumCtrl) {
      updatePdaMediumVisual(item);
    } else {
      const sterTag = (lc.sterilized || item.sterilized || cc.sterilized) ? ' • ✅ Estéril' : '';
      item.label = lc.baseLabel + ' (' + lc.volMl + 'ml/' + lc.maxMl + 'ml' + sterTag + ')';
    }
    if (item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
    return;
  }
  if (lc.mycCloud) {
    lc.mycCloud.visible = true;
    const gFrac = cc.colonized ? 1 : Math.max(0.25, (cc.colonization || 0) / 100);
    lc.mycCloud.scale.setScalar(0.55 + gFrac * 0.65);
    if (cc.contaminated) {
      if (!cc.contamKind) cc.contamKind = pickContamKind('liquid');
      const ci = getContamInfo(cc.contamKind);
      lc.mycCloud.material.color.setHex(ci.hex || 0x16a34a);
    } else {
      lc.mycCloud.material.color.setHex(0xffffff);
    }
  }
  const spTag = cc.speciesName ? (' • ' + cc.speciesName.split('(')[0].trim()) : '';
  const genTag = typeof cc.generation === 'number' ? (' • T' + cc.generation) : '';
  const kindPrefix = isSlant ? (lc.baseLabel + ' [Slant PDA]') : lc.baseLabel;
  if (cc.contaminated) {
    const ci = getContamInfo(cc.contamKind || 'trichoderma');
    item.label = kindPrefix + spTag + ' • 🦠 ' + ci.shortLabel;
  } else if (cc.expired) {
    item.label = kindPrefix + spTag + ' • cultura vencida ⚠️';
  } else if (cc.colonized) {
    const remDays = getCultureRemainingDays(cc);
    item.label = kindPrefix + spTag + genTag + ' • 100% Colonizada ✅ • validade ' + remDays + ' dias';
  } else {
    item.label = kindPrefix + spTag + genTag + ' • Colonizando ' + Math.floor(cc.colonization || 0) + '%';
  }
  if (item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function stepFalconCultures(ctx, dt) {
  const list = ctx && ctx.falconItems;
  if (!list || !list.length) return;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const cc = item && item.cultureCtrl;
    const lc = item && item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
    if (!cc || !lc || !cc.inoculated || cc.contaminated) continue;
    let changed = false;
    const rate = cc.refrigerated ? 0.65 : (isCultureIncubationTemperatureSuitable(item, ctx) ? 4.8 : 0);
    const prevPct = Math.floor(cc.colonization || 0);
    if (cc.colonization < 100 && rate > 0) {
      cc.colonization = Math.min(100, (cc.colonization || 0) + dt * rate);
      if (Math.floor(cc.colonization) !== prevPct) changed = true;
    }
    if (cc.colonization >= 100 && !cc.colonized) {
      cc.colonized = true;
      cc.ageGameDays = 0;
      cc.shelfLifeAgeDays = 0;
      changed = true;
    }
    if (cc.colonized) {
      const lifeStep = stepCultureShelfLife(cc, dt);
      if (lifeStep > 0) changed = true;
    }
    if (changed) updateFalconCultureVisual(item);
  }
}

export function makeFalconTube(ctx, id, maxMl, px, py, pz, initMl) {
  const is50 = maxMl >= 50;
  const A = getFalconAssets(is50);
  const r = is50 ? 0.024 : 0.015;
  const bodyH = is50 ? 0.125 : 0.115;
  const coneH = is50 ? 0.032 : 0.028;

  const fg = new THREE.Group();
  const gradCyl = new THREE.Mesh(A.gradGeo, A.gradMat);
  gradCyl.position.y = coneH + bodyH * 0.45;

  const liqMesh = new THREE.Mesh(
    A.liqGeo,
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.65, roughness: 0.12 })
  );

  const cap = new THREE.Mesh(A.capGeo, A.capMat);
  cap.position.y = coneH + bodyH + 0.012;

  const mycCloud = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.72, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf8fafc, emissiveIntensity: 0.25, transparent: true, opacity: 0.78, roughness: 0.85 })
  );
  mycCloud.position.y = coneH + bodyH * 0.25;
  mycCloud.visible = false;

  if (A.shellGeo) {
    fg.add(liqMesh, mycCloud, new THREE.Mesh(A.shellGeo, A.ppMat), gradCyl, cap);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyH, 16, 1, true), A.ppMat);
    body.position.y = coneH + bodyH / 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, coneH, 16, 1, true), A.ppMat);
    cone.rotation.x = Math.PI;
    cone.position.y = coneH / 2;
    fg.add(liqMesh, mycCloud, body, cone, gradCyl, cap);
  }
  fg.userData.liquidCtrl = {
    volMl: initMl || 0,
    maxMl,
    baseY: coneH,
    maxH: bodyH * 0.9,
    liqMesh,
    mycCloud,
    stirBar: null,
    baseLabel: 'Tubo Falcon ' + maxMl + 'ml'
  };

  const item = registerPickable(ctx, id, 'Tubo Falcon ' + maxMl + 'ml', fg, px, py, pz, 0, 0.06, coneH + bodyH + 0.03, getFalconMeta(maxMl));
  item.cultureCtrl = Object.assign(createCultureLifecycleState(false), {
    inoculated: false,
    colonized: false,
    colonization: 0,
    contaminated: false,
    sterilized: false,
    hasNutrient: false,
    generation: 1,
    speciesName: '',
    updateVisual: function () { updateFalconCultureVisual(item); }
  });
  fg.userData.cultureCtrl = item.cultureCtrl;
  item.setVolume = function (v) { updateContainerVolume(item, v); };
  updateContainerVolume(item, initMl || 0);
  if (ctx) {
    ctx.falconItems = ctx.falconItems || [];
    ctx.falconItems.push(item);
  }
  return item;
}

export function makeFalconRack(ctx, rx, ry, rz) {
  const rg = new THREE.Group();
  rg.position.set(rx, ry, rz);
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42 });
  const topPlate = makeBox(0.24, 0.012, 0.16, blueMat);
  topPlate.position.y = 0.065;
  const botPlate = makeBox(0.24, 0.012, 0.16, blueMat);
  botPlate.position.y = 0.006;
  [[-0.105, -0.065], [0.105, -0.065], [-0.105, 0.065], [0.105, 0.065]].forEach(function (p) {
    const post = makeBox(0.014, 0.065, 0.014, blueMat);
    post.position.set(p[0], 0.035, p[1]);
    rg.add(post);
  });
  rg.add(topPlate, botPlate);
  const rackSurf = {
    minX: rx - 0.12,
    maxX: rx + 0.12,
    minZ: rz - 0.08,
    maxZ: rz + 0.08,
    topY: ry + 0.012
  };
  if (ctx.supportSurfaces) ctx.supportSurfaces.push(rackSurf);
  if (ctx.supportMeshes) {
    botPlate.userData.supportSurface = rackSurf;
    ctx.supportMeshes.push(botPlate);
  }
  rg.userData.isTray = true;
  rg.userData.isFalconRack = true;
  rg.userData.tableDims = { w: 0.24, h: 0.012, d: 0.16, surfOffset: 0 };
  rg.userData.dynamicSurface = rackSurf;
  rg.userData.updateBounds = updateItemBounds;
  const rackItem = registerPickable(ctx, 'falcon_rack_lab', 'Suporte Azul de Tubos Falcon', rg, rx, ry, rz, 0, 0.14, 0.08, {
    category: 'tool',
    purpose: 'Suporte para transportar e organizar Tubos Falcon / Slants',
    weightGrams: 180,
    compatibilities: { canEnterCooker: false, supportsItemsOnSurface: true }
  });
  return rackItem.mesh;
}
