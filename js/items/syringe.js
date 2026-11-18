/**
 * Seringa 10ml com Agulha e Embolo Animado (MycoCampus3D)
 */

import { registerPickable } from './item-registry.js';

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

export function updateSyringeVolume(item, newVol) {
  if (!item || !item.mesh || !item.mesh.userData.syrCtrl) return;
  const sc = item.mesh.userData.syrCtrl;
  const clamped = Math.max(0, Math.min(10, Number(newVol) || 0));
  sc.volMl = clamped;
  if (clamped <= 0.05 && sc.mix) {
    sc.mix.waterMl = 0;
    sc.mix.distilledMl = 0;
    sc.mix.lcMl = 0;
    sc.mix.pdaMl = 0;
    sc.sourceContam = false;
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
  const dispVal = Math.round(clamped * 10) / 10;
  const volTxt = dispVal % 1 === 0 ? dispVal.toFixed(0) : dispVal.toFixed(1);
  const parts = getSyringeMixParts(sc);
  if (clamped <= 0.1) {
    item.label = 'Seringa 10ml (Vazia)';
  } else if (parts.length > 1) {
    item.label = 'Seringa 10ml (Mistura ' + volTxt + 'ml)';
  } else if (parts.length === 1) {
    item.label = 'Seringa 10ml (' + parts[0] + ')';
  } else {
    item.label = 'Seringa 10ml (' + volTxt + 'ml CL)';
  }
}

export function makeSyringe10ml(ctx, id, px, py, pz) {
  const sg = new THREE.Group();
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.36, roughness: 0.12, depthWrite: false });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 14, 1, true), barrelMat);
  barrel.position.y = 0.135;
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.005, 14), barrelMat);
  flange.position.y = 0.195;
  const liqMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.78 })
  );
  liqMesh.visible = false;
  const plunger = new THREE.Group();
  const stopper = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.014, 12), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
  stopper.position.y = 0;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  rod.position.y = 0.06;
  const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.005, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
  thumb.position.y = 0.115;
  plunger.add(stopper, rod, thumb);
  plunger.position.y = 0.095;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.018, 10), new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.35 }));
  hub.position.y = 0.068;
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.001, 0.058, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 }));
  needle.position.y = 0.030;
  const layWrap = new THREE.Group();
  layWrap.add(liqMesh, plunger, barrel, flange, hub, needle);
  layWrap.rotation.z = Math.PI / 2;
  layWrap.position.set(0.12, 0.022, 0);
  sg.add(layWrap);
  sg.userData.isSyringe = true;
  sg.userData.syrCtrl = {
    volMl: 0,
    liqMesh,
    plunger,
    mix: { waterMl: 0, distilledMl: 0, lcMl: 0, pdaMl: 0 },
    sourceContam: false
  };
  const item = registerPickable(ctx, id, 'Seringa 10ml (Vazia)', sg, px, py, pz, 0, 0.14, 0.06, SYRINGE_META);
  item.setVolume = function (v) { updateSyringeVolume(item, v); };
  updateSyringeVolume(item, 0);
  return item;
}
