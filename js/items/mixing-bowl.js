/**
 * Pote de Mistura de Receitas + Colher Inox (MycoCampus3D)
 * Permite pesar ingredientes em gramas na balanca (flocao, agua, milho, etc.)
 * e misturar com a colher ate ficar homogeneo para formar receitas de cultivo.
 */

import { mergeStaticGeos, registerPickable } from './item-registry.js';

const THREE = window.THREE;

let sharedBowlAssets = null;
function getBowlSharedAssets() {
  if (sharedBowlAssets) return sharedBowlAssets;
  const wallGeo = new THREE.CylinderGeometry(0.115, 0.090, 0.13, 20, 1, true);
  const botGeo = new THREE.CylinderGeometry(0.090, 0.090, 0.008, 20);
  const bowlShellGeo = mergeStaticGeos([
    { geo: wallGeo, y: 0.065 },
    { geo: botGeo, y: 0.004 }
  ]);
  wallGeo.dispose();
  botGeo.dispose();

  sharedBowlAssets = {
    bowlShellGeo,
    bowlMat: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, transparent: true, opacity: 0.42, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide
    }),
    mixGeo: new THREE.CylinderGeometry(0.096, 0.080, 0.095, 18),
    waterGeo: new THREE.CylinderGeometry(0.098, 0.086, 0.095, 18),
    waterMat: new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.62, roughness: 0.12, depthWrite: false }),
    steelMat: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.12 }),
    spoonBowlMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.10, side: THREE.DoubleSide }),
    gripMat: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.55 }),
    spoonHandleGeo: new THREE.CylinderGeometry(0.0045, 0.0065, 0.15, 12),
    spoonGripGeo: new THREE.CylinderGeometry(0.0085, 0.0085, 0.055, 12),
    spoonCapGeo: new THREE.SphereGeometry(0.0085, 12, 8),
    spoonNeckGeo: new THREE.CylinderGeometry(0.0055, 0.0045, 0.028, 10),
    spoonScoopGeo: new THREE.SphereGeometry(0.026, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    spoonRimGeo: new THREE.TorusGeometry(0.026, 0.0015, 6, 24)
  };
  Object.keys(sharedBowlAssets).forEach((k) => {
    const v = sharedBowlAssets[k];
    if (v && v.userData) v.userData.shared = true;
  });
  return sharedBowlAssets;
}

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
    const tag = k === 'flocao'
      ? 'Flocão'
      : (k === 'water'
        ? 'Água'
        : (k === 'corn'
          ? 'Milho'
          : (k === 'vermiculite' ? 'Vermiculita' : (k === 'coco' ? 'Pó de Coco' : k))));
    parts.push(tag + ' ' + val + 'g');
  });
  if (bc.mixMesh) {
    const dryG = (bc.ingredients.flocao || 0) + (bc.ingredients.corn || 0) + (bc.ingredients.sawdust || 0) + (bc.ingredients.vermiculite || 0) + (bc.ingredients.coco || 0);
    const waterG = bc.ingredients.water || 0;
    if (bc.mixed) {
      bc.mixMesh.visible = totalG > 0;
      const fillFrac = Math.min(1, totalG / 600);
      const sy = Math.max(0.15, fillFrac);
      const sxz = 0.86 + 0.14 * fillFrac;
      bc.mixMesh.scale.set(sxz, sy, sxz);
      bc.mixMesh.position.y = 0.012 + (0.095 * sy) * 0.5;
      bc.mixMesh.material.color.setHex(0xf59e0b);
      if (bc.waterLayerMesh) bc.waterLayerMesh.visible = false;
    } else {
      const dryFrac = Math.min(1, dryG / 600);
      const dryH = dryG > 0 ? Math.max(0.014, 0.095 * dryFrac) : 0;
      if (dryG > 0) {
        bc.mixMesh.visible = true;
        const sy = dryH / 0.095;
        const sxz = 0.86 + 0.14 * dryFrac;
        bc.mixMesh.scale.set(sxz, sy, sxz);
        bc.mixMesh.position.y = 0.012 + dryH * 0.5;
        bc.mixMesh.material.color.setHex(0xfde047);
      } else {
        bc.mixMesh.visible = false;
      }
      if (bc.waterLayerMesh) {
        if (waterG > 0) {
          const waterFrac = Math.min(1 - dryFrac * 0.8, waterG / 600);
          const waterH = Math.max(0.012, 0.095 * Math.max(0.08, waterFrac));
          const wy = waterH / 0.095;
          const wxz = 0.88 + 0.12 * Math.min(1, (dryG + waterG) / 600);
          bc.waterLayerMesh.visible = true;
          bc.waterLayerMesh.scale.set(wxz, wy, wxz);
          bc.waterLayerMesh.position.y = 0.012 + dryH + waterH * 0.5;
        } else {
          bc.waterLayerMesh.visible = false;
        }
      }
    }
  }
  const kindCount = Object.values(bc.ingredients).filter((v) => v > 0).length;
  const status = bc.mixed ? '✅ Receita Homogênea' : (kindCount < 2 ? '➕ Adicione outro ingrediente' : '🥄 Misture c/ colher');
  item.label = 'Pote Mistura (' + parts.join(' + ') + ' = ' + totalG + 'g • ' + status + ')';
}

export function addIngredientToBowl(item, ingKey, grams) {
  if (!item || !item.bowlCtrl) return false;
  const bc = item.bowlCtrl;
  bc.ingredients[ingKey] = (bc.ingredients[ingKey] || 0) + grams;
  bc.mixed = false;
  bc.stirCount = 0;
  bc.stirProgress = 0;
  updateMixingBowlLabel(item);
  return true;
}

export function advanceMixingBowlStir(item, dt) {
  if (!item || !item.bowlCtrl) return { done: false, empty: true, progress: 0 };
  const bc = item.bowlCtrl;
  const total = Object.values(bc.ingredients).reduce((a, b) => a + b, 0);
  const kindCount = Object.values(bc.ingredients).filter((v) => v > 0).length;
  if (total <= 0) return { done: false, empty: true, progress: 0 };
  if (kindCount < 2) return { done: false, empty: false, needTwo: true, progress: 0 };
  if (bc.mixed) return { done: true, empty: false, progress: 1 };
  bc.stirProgress = Math.min(1, (bc.stirProgress || 0) + dt / 3.0);
  if (bc.stirProgress >= 1) {
    bc.mixed = true;
    updateMixingBowlLabel(item);
  }
  return { done: bc.mixed, empty: false, progress: bc.stirProgress };
}

export function stirMixingBowl(item) {
  return advanceMixingBowlStir(item, 1.0);
}

export function makeMixingBowl(ctx, id, px, py, pz) {
  const A = getBowlSharedAssets();
  const bg = new THREE.Group();
  const mixMesh = new THREE.Mesh(
    A.mixGeo,
    new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.78 })
  );
  mixMesh.visible = false;
  const waterLayerMesh = new THREE.Mesh(A.waterGeo, A.waterMat);
  waterLayerMesh.visible = false;
  if (A.bowlShellGeo) {
    bg.add(mixMesh, waterLayerMesh, new THREE.Mesh(A.bowlShellGeo, A.bowlMat));
  } else {
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.090, 0.13, 20, 1, true), A.bowlMat);
    wall.position.y = 0.065;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.090, 0.090, 0.008, 20), A.bowlMat);
    bottom.position.y = 0.004;
    bg.add(mixMesh, waterLayerMesh, wall, bottom);
  }

  const item = registerPickable(ctx, id, 'Pote de Mistura (Vazio)', bg, px, py, pz, 0, 0.14, 0.14, MIXING_BOWL_META);
  item.bowlCtrl = {
    ingredients: {},
    mixed: false,
    stirCount: 0,
    mixMesh,
    waterLayerMesh
  };
  item.mesh.userData.bowlCtrl = item.bowlCtrl;
  updateMixingBowlLabel(item);
  return item;
}

export function makeLabSpoon(ctx, id, px, py, pz) {
  const A = getBowlSharedAssets();
  const sg = new THREE.Group();

  const handle = new THREE.Mesh(A.spoonHandleGeo, A.steelMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0.012, 0.045);

  const grip = new THREE.Mesh(A.spoonGripGeo, A.gripMat);
  grip.rotation.x = Math.PI / 2;
  grip.position.set(0, 0.012, 0.095);
  const gripCap = new THREE.Mesh(A.spoonCapGeo, A.gripMat);
  gripCap.position.set(0, 0.012, 0.1225);

  const neck = new THREE.Mesh(A.spoonNeckGeo, A.steelMat);
  neck.rotation.x = Math.PI / 2 - 0.35;
  neck.position.set(0, 0.0105, -0.034);

  const scoop = new THREE.Mesh(A.spoonScoopGeo, A.spoonBowlMat);
  scoop.scale.set(0.82, 0.62, 1.28);
  scoop.position.set(0, 0.018, -0.078);
  const scoopRim = new THREE.Mesh(A.spoonRimGeo, A.steelMat);
  scoopRim.rotation.x = Math.PI / 2;
  scoopRim.scale.set(0.82, 1.28, 1);
  scoopRim.position.set(0, 0.018, -0.078);

  sg.add(handle, grip, gripCap, neck, scoop, scoopRim);
  sg.userData.isLabSpoon = true;
  return registerPickable(ctx, id, 'Colher Inox de Mistura', sg, px, py, pz, 0, 0.10, 0.04, LAB_SPOON_META);
}
