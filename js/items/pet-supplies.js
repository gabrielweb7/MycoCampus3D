/**
 * Itens de Pet compráveis e móveis: Potinho de Ração e Saquinhos de Ração (Cachorro / Gato).
 */
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export function makePetFoodBowl(ctx, id, x, y, z) {
  const g = new THREE.Group();
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.35, metalness: 0.08 });
  const baseFootMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.3, metalness: 0.1 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.45 });
  const kibbleMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.92 });
  const kibbleAccentMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.88 });
  const badgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const pawMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.4 });

  // 1. Base inferior com elevação de segurança (+0.018) para nunca afundar na grama ou terreno
  const baseFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.228, 0.024, 24), baseFootMat);
  baseFoot.position.y = 0.030;
  baseFoot.castShadow = true;
  baseFoot.receiveShadow = true;

  // 2. Corpo abaulado e arredondado da tigela turquesa (fiel à arte conceitual pet_bowl.jpg)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.180, 0.210, 0.076, 24), bowlMat);
  body.position.y = 0.072;
  body.castShadow = true;
  body.receiveShadow = true;

  // 3. Borda superior arredondada e suave (Torus)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.016, 12, 28), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.110;
  rim.castShadow = true;

  // 4. Fundo rebaixado interno (cavidade côncava para receber comida ou água)
  const interior = new THREE.Mesh(new THREE.CylinderGeometry(0.166, 0.145, 0.022, 20), innerMat);
  interior.position.y = 0.058;
  interior.receiveShadow = true;

  // 5. Emblema frontal tridimensional (medalhão circular branco com patinha estilizada)
  const badgeGroup = new THREE.Group();
  const badgePlaque = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.014, 18), badgeMat);
  badgePlaque.rotation.x = Math.PI / 2;
  badgePlaque.position.set(0, 0.070, 0.202);

  const pawMain = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), pawMat);
  pawMain.scale.set(1.2, 0.9, 0.45);
  pawMain.position.set(0, 0.067, 0.210);

  const toeL = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), pawMat);
  toeL.position.set(-0.016, 0.084, 0.208);
  const toeC = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), pawMat);
  toeC.position.set(0, 0.088, 0.208);
  const toeR = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), pawMat);
  toeR.position.set(0.016, 0.084, 0.208);
  badgeGroup.add(badgePlaque, pawMain, toeL, toeC, toeR);

  // 6. Ração interna (montinho de kibble com pedacinhos crocantes que cresce dinamicamente)
  const foodGroup = new THREE.Group();
  const foodDome = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), kibbleMat);
  foodDome.scale.set(1, 0.35, 1);
  foodGroup.add(foodDome);

  // Pedacinhos soltos no topo do montinho
  [
    [-0.04, 0.038, 0.03, 0.022],
    [0.05, 0.042, -0.02, 0.020],
    [-0.01, 0.052, -0.04, 0.024],
    [0.02, 0.046, 0.04, 0.019]
  ].forEach(([kx, ky, kz, ks]) => {
    const bit = new THREE.Mesh(new THREE.DodecahedronGeometry(ks, 0), kibbleAccentMat);
    bit.position.set(kx, ky, kz);
    bit.rotation.set(kx * 10, ky * 8, kz * 5);
    foodGroup.add(bit);
  });
  foodGroup.position.y = 0.058;
  foodGroup.visible = false;
  foodGroup.userData.ignoreRay = true;

  g.add(baseFoot, body, rim, interior, badgeGroup, foodGroup);

  const ctrl = { grams: 0, maxGrams: 400, foodMesh: foodGroup, updateVisual: null };
  ctrl.updateVisual = () => {
    const frac = Math.max(0, Math.min(1, ctrl.grams / ctrl.maxGrams));
    foodGroup.visible = ctrl.grams > 5;
    foodDome.scale.set(1, 0.14 + frac * 0.34, 1);
    foodGroup.position.y = 0.052 + frac * 0.024;
  };

  const item = registerPickable(ctx, id, 'Potinho de Ração', g, x, y, z, 0, 0.23, 0.13, {
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
