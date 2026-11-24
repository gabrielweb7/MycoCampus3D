/**
 * Seringa 10ml com Agulha e Embolo Animado (MycoCampus3D)
 */

import { getCultureOriginLabel } from '../core/culture-origin.js';
import { mergeStaticGeos, registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const SYRINGE_META = {
  category: 'inoculation',
  purpose: 'Aspirar cultura líquida e inocular vidros, bags e placas de Petri',
  maxVolumeMl: 10,
  baseTempC: 23.6,
  getTempC: (item) => {
    const s = item && item.mesh && item.mesh.userData && item.mesh.userData.syrCtrl;
    if (s && typeof s.tempC === 'number') return s.tempC;
    return (s && s.refrigerated) ? 4.0 : 23.6;
  },
  getWeightGrams: (item) => 12 + ((item && item.mesh && item.mesh.userData.syrCtrl) ? item.mesh.userData.syrCtrl.volMl : 0),
  compatibilities: { canEnterCooker: false, transfersLiquidCulture: true },
  connections: ['liquid_culture', 'spawn_jar', 'spawn_bag', 'petri_dish']
};

export function getSyringeInjectionDoseMl(target, availableMl) {
  const avail = Math.max(0, Math.round((Number(availableMl) || 0) * 10) / 10);
  if (!target || !target.mesh || avail <= 0) return 0;
  if (target.mesh.userData && target.mesh.userData.isPetri) {
    return avail >= 1 ? 1 : 0;
  }
  const sp = target.spawnCtrl;
  if (sp) {
    if (sp.isPP5) return avail >= 1 ? 1 : 0;
    if (sp.isBag) return Math.min(4.0, avail);
    return Math.min(2.5, avail);
  }
  const liquid = target.mesh.userData?.liquidCtrl;
  return liquid ? Math.min(avail, Math.floor(Math.max(0, liquid.maxMl - liquid.volMl) * 10 + 1e-8) / 10) : avail;
}

export function getSyringeMixParts(sc) {
  if (!sc || !sc.mix) return [];
  const parts = [];
  if (sc.mix.lcMl > 0.05) parts.push(`${sc.mix.lcMl.toFixed(1)}ml Cultura Líquida`);
  if (sc.mix.distilledMl > 0.05) parts.push(`${sc.mix.distilledMl.toFixed(1)}ml Água Destilada`);
  if (sc.mix.waterMl > 0.05) parts.push(`${sc.mix.waterMl.toFixed(1)}ml Água`);
  if (sc.mix.pdaMl > 0.05) parts.push(`${sc.mix.pdaMl.toFixed(1)}ml Meio PDA`);
  return parts;
}

export function addSyringeMix(item, kind, deltaMl) {
  const sc = item && item.mesh && item.mesh.userData && item.mesh.userData.syrCtrl;
  if (!sc) return;
  if (!sc.mix) sc.mix = { waterMl: 0, distilledMl: 0, lcMl: 0, pdaMl: 0 };
  if (deltaMl > 0) {
    const key = kind === 'lc' ? 'lcMl' : (kind === 'distilled' ? 'distilledMl' : (kind === 'pda' ? 'pdaMl' : 'waterMl'));
    sc.mix[key] = Math.max(0, (sc.mix[key] || 0) + deltaMl);
  } else if (deltaMl < 0) {
    const total = (sc.mix.waterMl || 0) + (sc.mix.distilledMl || 0) + (sc.mix.lcMl || 0) + (sc.mix.pdaMl || 0);
    if (total > 0.001) {
      const keep = Math.max(0, (total + deltaMl) / total);
      sc.mix.waterMl *= keep;
      sc.mix.distilledMl *= keep;
      sc.mix.lcMl *= keep;
      sc.mix.pdaMl *= keep;
    }
  }
}

export function updateSyringeVolume(item, newVol, preview = false) {
  if (!item || !item.mesh || !item.mesh.userData.syrCtrl) return;
  const sc = item.mesh.userData.syrCtrl;
  const clamped = Math.max(0, Math.min(10, Math.round((Number(newVol) || 0) * 10) / 10));
  if (!preview) sc.volMl = clamped;
  if (!preview && clamped <= 0.05 && sc.mix) {
    sc.mix.waterMl = 0;
    sc.mix.distilledMl = 0;
    sc.mix.lcMl = 0;
    sc.mix.pdaMl = 0;
    sc.sourceContam = false;
    sc.speciesName = '';
    sc.origin = '';
    sc.generation = null;
  }
  const frac = clamped / 10;
  if (clamped <= 0.05) {
    sc.liqMesh.visible = false;
  } else {
    sc.liqMesh.visible = true;
    sc.liqMesh.scale.y = Math.max(0.02, frac);
    sc.liqMesh.position.y = 0.085 + (0.09 * frac) * 0.5;
    if (sc.liqMesh.material) {
      const m = sc.mix || {};
      const hasLc = (m.lcMl || 0) > 0.05 || (m.pdaMl || 0) > 0.05;
      const hasWater = (m.waterMl || 0) > 0.05 || (m.distilledMl || 0) > 0.05;
      sc.liqMesh.material.color.setHex(hasLc && hasWater ? 0xfde68a : (hasLc ? 0xfef08a : 0x7dd3fc));
    }
  }
  sc.plunger.position.y = 0.095 + 0.09 * frac;
  if (preview) return;
  const dispVal = Math.round(clamped * 10) / 10;
  const volTxt = dispVal % 1 === 0 ? dispVal.toFixed(0) : dispVal.toFixed(1);
  const parts = getSyringeMixParts(sc);
  const originLabel = getCultureOriginLabel(sc.origin);
  const originTag = originLabel ? ' • ' + originLabel : '';
  const spTag = sc.speciesName ? (' • ' + sc.speciesName.split('(')[0].trim()) : '';
  const genTag = typeof sc.generation === 'number' ? (' • G' + sc.generation) : '';
  if (clamped <= 0.1) {
    item.label = 'Seringa 10ml (Vazia)';
  } else if (parts.length > 1) {
    item.label = 'Seringa 10ml (Mistura ' + volTxt + 'ml' + spTag + genTag + originTag + ')';
  } else if (parts.length === 1) {
    item.label = 'Seringa 10ml (' + parts[0] + spTag + genTag + originTag + ')';
  } else {
    item.label = 'Seringa 10ml (' + volTxt + 'ml CL' + spTag + genTag + originTag + ')';
  }
}

let sharedSyrAssets = null;
function getSyringeAssets() {
  if (!sharedSyrAssets) {
    const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 14, 1, true);
    const flangeGeo = new THREE.CylinderGeometry(0.023, 0.023, 0.005, 14);
    const barrelBodyGeo = mergeStaticGeos([
      { geo: barrelGeo, y: 0.135 },
      { geo: flangeGeo, y: 0.195 }
    ]);
    const rodGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.11, 8);
    const thumbGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.005, 12);
    const plungerRodGeo = mergeStaticGeos([
      { geo: rodGeo, y: 0.06 },
      { geo: thumbGeo, y: 0.115 }
    ]);

    sharedSyrAssets = {
      barrelBodyGeo,
      plungerRodGeo,
      barrelGeo,
      flangeGeo,
      liqGeo: new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12),
      stopperGeo: new THREE.CylinderGeometry(0.0125, 0.0125, 0.014, 12),
      rodGeo,
      thumbGeo,
      hubGeo: new THREE.CylinderGeometry(0.006, 0.009, 0.018, 10),
      needleGeo: new THREE.CylinderGeometry(0.0016, 0.001, 0.058, 8),
      barrelMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.36, roughness: 0.12, depthWrite: false }),
      stopperMat: new THREE.MeshStandardMaterial({ color: 0x1e293b }),
      rodMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }),
      hubMat: new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 }),
      needleMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
    };
    Object.keys(sharedSyrAssets).forEach((k) => {
      const v = sharedSyrAssets[k];
      if (v && v.userData) v.userData.shared = true;
    });
  }
  return sharedSyrAssets;
}

export function makeSyringe10ml(ctx, id, px, py, pz) {
  const A = getSyringeAssets();
  const sg = new THREE.Group();
  const liqMesh = new THREE.Mesh(
    A.liqGeo,
    new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.78 })
  );
  liqMesh.visible = false;
  const plunger = new THREE.Group();
  const stopper = new THREE.Mesh(A.stopperGeo, A.stopperMat);
  stopper.position.y = 0;
  if (A.plungerRodGeo) {
    plunger.add(stopper, new THREE.Mesh(A.plungerRodGeo, A.rodMat));
  } else {
    const rod = new THREE.Mesh(A.rodGeo, A.rodMat);
    rod.position.y = 0.06;
    const thumb = new THREE.Mesh(A.thumbGeo, A.rodMat);
    thumb.position.y = 0.115;
    plunger.add(stopper, rod, thumb);
  }
  plunger.position.y = 0.095;
  const hub = new THREE.Mesh(A.hubGeo, A.hubMat);
  hub.position.y = 0.068;
  const needle = new THREE.Mesh(A.needleGeo, A.needleMat);
  needle.position.y = 0.030;
  const layWrap = new THREE.Group();
  if (A.barrelBodyGeo) {
    layWrap.add(liqMesh, plunger, new THREE.Mesh(A.barrelBodyGeo, A.barrelMat), hub, needle);
  } else {
    const barrel = new THREE.Mesh(A.barrelGeo, A.barrelMat);
    barrel.position.y = 0.135;
    const flange = new THREE.Mesh(A.flangeGeo, A.barrelMat);
    flange.position.y = 0.195;
    layWrap.add(liqMesh, plunger, barrel, flange, hub, needle);
  }
  layWrap.rotation.z = Math.PI / 2;
  layWrap.position.set(0.12, 0.022, 0);
  sg.add(layWrap);
  sg.userData.isSyringe = true;
  sg.userData.syrCtrl = {
    volMl: 0,
    liqMesh,
    plunger,
    mix: { waterMl: 0, distilledMl: 0, lcMl: 0, pdaMl: 0 },
    sourceContam: false,
    speciesName: '',
    generation: null
  };
  const item = registerPickable(ctx, id, 'Seringa 10ml (Vazia)', sg, px, py, pz, 0, 0.14, 0.06, SYRINGE_META);
  item.setVolume = function (v) { updateSyringeVolume(item, v); };
  updateSyringeVolume(item, 0);
  return item;
}
