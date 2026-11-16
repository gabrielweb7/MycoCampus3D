/**
 * Pote de Mistura de Receitas + Colher Inox (MycoCampus3D)
 * Permite pesar ingredientes em gramas na balanca (flocao, agua, milho, etc.)
 * e misturar com a colher ate ficar homogeneo para formar receitas de cultivo.
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const MIXING_BOWL_META = {
  category: 'mixing',
  purpose: 'Misturar ingredientes por peso exato (g/ml) na balança e homogeneizar com a colher',
  baseTempC: 22.8,
  getWeightGrams: (item) => {
    const bc = item && item.bowlCtrl;
    if (!bc) return 180;
    let total = 180;
    Object.keys(bc.ingredients).forEach((k) => { total += bc.ingredients[k] || 0; });
    return total;
  },
  compatibilities: {
    canEnterCooker: false,
    receivesIngredients: true,
    receivesWater: true
  },
  connections: ['precision_scale', 'flocao_500g', 'lab_sink', 'distilled_jug', 'lab_spoon', 'pp5_cup', 'spawn_jar']
};

export const LAB_SPOON_META = {
  category: 'tool',
  purpose: 'Misturar ingredientes no pote até atingir receita homogênea',
  weightGrams: 42,
  baseTempC: 22.0,
  compatibilities: { canEnterCooker: false, stirsMixingBowl: true },
  connections: ['mixing_bowl']
};

export function updateMixingBowlLabel(item) {
  if (!item || !item.bowlCtrl) return;
  const bc = item.bowlCtrl;
  const keys = Object.keys(bc.ingredients).filter((k) => bc.ingredients[k] > 0);
  if (keys.length === 0) {
    item.label = 'Pote de Mistura (Vazio)';
    if (bc.mixMesh) bc.mixMesh.visible = false;
    return;
  }
  let totalG = 0;
  const parts = [];
  keys.forEach((k) => {
    const val = Math.round(bc.ingredients[k]);
    totalG += val;
    const tag = k === 'flocao' ? 'Flocão' : (k === 'water' ? 'Água' : (k === 'corn' ? 'Milho' : k));
    parts.push(tag + ' ' + val + 'g');
  });
  if (bc.mixMesh) {
    bc.mixMesh.visible = true;
    const fillFrac = Math.min(1, totalG / 600);
    bc.mixMesh.scale.y = Math.max(0.15, fillFrac);
    bc.mixMesh.position.y = 0.015 + (0.095 * bc.mixMesh.scale.y) * 0.5;
    bc.mixMesh.material.color.setHex(bc.mixed ? 0xf59e0b : (bc.ingredients.water > 0 && !bc.ingredients.flocao && !bc.ingredients.corn ? 0x7dd3fc : 0xfde047));
  }
  const status = bc.mixed ? '✅ Receita Homogênea' : '🥄 Misture c/ colher';
  item.label = 'Pote Mistura (' + parts.join(' + ') + ' = ' + totalG + 'g • ' + status + ')';
}

export function addIngredientToBowl(item, ingKey, grams) {
  if (!item || !item.bowlCtrl) return false;
  const bc = item.bowlCtrl;
  bc.ingredients[ingKey] = (bc.ingredients[ingKey] || 0) + grams;
  bc.mixed = false;
  bc.stirCount = 0;
  updateMixingBowlLabel(item);
  return true;
}

export function stirMixingBowl(item) {
  if (!item || !item.bowlCtrl) return { done: false, empty: true };
  const bc = item.bowlCtrl;
  const total = Object.values(bc.ingredients).reduce((a, b) => a + b, 0);
  if (total <= 0) return { done: false, empty: true };
  bc.stirCount += 1;
  if (bc.stirCount >= 3) bc.mixed = true;
  updateMixingBowlLabel(item);
  return { done: bc.mixed, empty: false, stirCount: bc.stirCount };
}

export function makeMixingBowl(ctx, id, px, py, pz) {
  const bg = new THREE.Group();
  const bowlMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, transparent: true, opacity: 0.42, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.090, 0.13, 20, 1, true), bowlMat);
  wall.position.y = 0.065;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.090, 0.090, 0.008, 20), bowlMat);
  bottom.position.y = 0.004;
  const mixMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.084, 0.095, 18),
    new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.78 })
  );
  mixMesh.visible = false;
  bg.add(mixMesh, wall, bottom);

  const item = registerPickable(ctx, id, 'Pote de Mistura (Vazio)', bg, px, py, pz, 0, 0.14, 0.14, MIXING_BOWL_META);
  item.bowlCtrl = {
    ingredients: {},
    mixed: false,
    stirCount: 0,
    mixMesh
  };
  item.mesh.userData.bowlCtrl = item.bowlCtrl;
  updateMixingBowlLabel(item);
  return item;
}

export function makeLabSpoon(ctx, id, px, py, pz) {
  const sg = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.90, roughness: 0.18 });
  const handle = makeBox(0.014, 0.004, 0.15, steelMat);
  handle.position.set(0, 0.008, 0.02);
  const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), steelMat);
  scoop.scale.set(0.85, 0.45, 1.3);
  scoop.position.set(0, 0.012, -0.070);
  sg.add(handle, scoop);
  sg.userData.isLabSpoon = true;
  return registerPickable(ctx, id, 'Colher Inox de Mistura', sg, px, py, pz, 0, 0.10, 0.03, LAB_SPOON_META);
}
