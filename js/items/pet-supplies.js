/**
 * Itens de Pet compráveis e móveis: Potinho de Ração e Saquinhos de Ração (Cachorro / Gato).
 */
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export function makePetFoodBowl(ctx, id, x, y, z) {
  const g = new THREE.Group();
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.42, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 });
  const kibbleMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.085, 16), bowlMat);
  base.position.y = 0.042;
  base.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.014, 8, 16), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.084;
  const boneBadge = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.02), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 }));
  boneBadge.position.set(0, 0.045, 0.175);

  const foodMesh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), kibbleMat);
  foodMesh.scale.set(1, 0.35, 1);
  foodMesh.position.y = 0.04;
  foodMesh.visible = false;
  foodMesh.userData.ignoreRay = true;

  g.add(base, rim, boneBadge, foodMesh);

  const ctrl = { grams: 0, maxGrams: 400, foodMesh, updateVisual: null };
  ctrl.updateVisual = () => {
    const frac = Math.max(0, Math.min(1, ctrl.grams / ctrl.maxGrams));
    foodMesh.visible = ctrl.grams > 5;
    foodMesh.scale.set(1, 0.12 + frac * 0.32, 1);
    foodMesh.position.y = 0.026 + frac * 0.032;
  };

  const item = registerPickable(ctx, id, 'Potinho de Ração', g, x, y, z, 0, 0.21, 0.11, {
    icon: '🥣',
    weightGrams: 320,
    purpose: 'Tigela móvel para alimentar seu cachorro ou gato com ração',
    serializeState: () => ({ petBowl: { grams: Math.round(ctrl.grams) } }),
    applyState: (st) => {
      if (st?.petBowl && typeof st.petBowl.grams === 'number') {
        ctrl.grams = Math.max(0, Math.min(ctrl.maxGrams, st.petBowl.grams));
        ctrl.updateVisual();
      }
    }
  });
  item.petBowlCtrl = ctrl;
  return item;
}

export function makePetFoodBag(ctx, id, species, x, y, z) {
  const isCat = species === 'cat';
  const g = new THREE.Group();
  const bagMat = new THREE.MeshStandardMaterial({ color: isCat ? 0xa855f7 : 0xf97316, roughness: 0.72 });
  const bandMat = new THREE.MeshStandardMaterial({ color: isCat ? 0x22d3ee : 0xfef3c7, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.10), bagMat);
  body.position.y = 0.13;
  body.castShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.035, 0.045), bandMat);
  top.position.y = 0.265;
  const label = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.106), bandMat);
  label.position.y = 0.14;
  g.add(body, top, label);

  const ctrl = { species: isCat ? 'cat' : 'dog', grams: 800, maxGrams: 800, updateVisual: null };
  ctrl.updateVisual = () => {
    const s = 0.78 + 0.22 * (ctrl.grams / ctrl.maxGrams);
    body.scale.y = s;
  };

  const title = isCat ? 'Ração para Gato (800g)' : 'Ração para Cachorro (800g)';
  const item = registerPickable(ctx, id, title, g, x, y, z, 0, 0.15, 0.28, {
    icon: isCat ? '🐟' : '🦴',
    weightGrams: 800,
    purpose: 'Despeje no potinho de ração para alimentar seu pet',
    serializeState: () => ({ petFoodBag: { grams: Math.round(ctrl.grams) } }),
    applyState: (st) => {
      if (st?.petFoodBag && typeof st.petFoodBag.grams === 'number') {
        ctrl.grams = Math.max(0, Math.min(ctrl.maxGrams, st.petFoodBag.grams));
        ctrl.updateVisual();
      }
    }
  });
  item.petFoodBagCtrl = ctrl;
  return item;
}
