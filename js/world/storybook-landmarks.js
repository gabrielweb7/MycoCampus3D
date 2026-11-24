/** Marcos naturais "Myco Cozy" de baixo custo: 5 draw calls no total. */
import { MYCO_PALETTE } from '../engine/visual-style.js';
import { terrainHeight } from '../engine/physics.js';
import { isNaturalSoilSpot } from './nature-plaza.js';

const THREE = window.THREE;

const MUSHROOM_SITES = [
  [-42, 18, 1.15], [-38, -15, 0.92], [45, 25, 1.08], [49, -28, 0.88],
  [-62, 34, 1.28], [67, 17, 1.02], [-76, -25, 1.18], [77, -5, 0.96],
  [-16, 48, 0.82], [18, 51, 1.12], [-86, 8, 0.9], [88, 31, 1.24]
];

const COLORS = [
  MYCO_PALETTE.mushroomPink,
  MYCO_PALETTE.mushroomCoral,
  MYCO_PALETTE.mushroomGold,
  MYCO_PALETTE.mushroomViolet
];

function makeMaterial(options) {
  const mat = new THREE.MeshStandardMaterial(options);
  mat.userData.shared = true;
  return mat;
}

function addGiantMushrooms(group, touch) {
  const sites = MUSHROOM_SITES.filter((p) => isNaturalSoilSpot(p[0], p[1], 1.8));
  const stemGeo = new THREE.CylinderGeometry(0.48, 0.72, 3.8, touch ? 8 : 10);
  const capGeo = new THREE.SphereGeometry(1.85, touch ? 12 : 16, touch ? 7 : 9, 0, Math.PI * 2, 0, Math.PI * 0.54);
  const spotGeo = new THREE.SphereGeometry(0.16, 6, 5);
  const stemMat = makeMaterial({ color: MYCO_PALETTE.cream, roughness: 0.76 });
  const capMat = makeMaterial({ color: 0xffffff, roughness: 0.43, vertexColors: true });
  const spotMat = makeMaterial({ color: 0xfff8e7, roughness: 0.6, emissive: 0xffe8a3, emissiveIntensity: 0.08 });
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, sites.length);
  const caps = new THREE.InstancedMesh(capGeo, capMat, sites.length);
  const spotCount = touch ? sites.length * 2 : sites.length * 4;
  const spots = new THREE.InstancedMesh(spotGeo, spotMat, spotCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let spotIndex = 0;

  sites.forEach((site, i) => {
    const x = site[0], z = site[1], scale = site[2];
    const y = terrainHeight(x, z);
    dummy.position.set(x, y + 1.9 * scale, z);
    dummy.rotation.set(0, (i * 1.71) % Math.PI, 0);
    dummy.scale.set(scale * 0.9, scale, scale * 0.9);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x, y + 3.62 * scale, z);
    dummy.scale.set(scale, scale * 0.86, scale);
    dummy.updateMatrix();
    caps.setMatrixAt(i, dummy.matrix);
    color.setHex(COLORS[i % COLORS.length]);
    caps.setColorAt(i, color);

    const perCap = touch ? 2 : 4;
    for (let s = 0; s < perCap; s++) {
      const angle = (s / perCap) * Math.PI * 2 + i * 0.73;
      const radius = (s % 2 ? 0.72 : 1.18) * scale;
      dummy.position.set(
        x + Math.cos(angle) * radius,
        y + (4.15 - (s % 2) * 0.22) * scale,
        z + Math.sin(angle) * radius
      );
      dummy.rotation.set(Math.cos(angle) * 0.18, -angle, Math.sin(angle) * 0.18);
      dummy.scale.setScalar(scale * (s % 2 ? 0.9 : 1.16));
      dummy.updateMatrix();
      spots.setMatrixAt(spotIndex++, dummy.matrix);
    }
  });
  stems.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  spots.instanceMatrix.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  stems.castShadow = !touch;
  caps.castShadow = !touch;
  stems.receiveShadow = caps.receiveShadow = true;
  group.add(stems, caps, spots);
}

function addGroundDetails(group, touch) {
  const grassCount = touch ? 46 : 92;
  const rockCount = touch ? 16 : 30;
  const bladeGeo = new THREE.ConeGeometry(0.18, 0.72, 5);
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const grassMat = makeMaterial({ color: MYCO_PALETTE.grassLight, roughness: 0.9 });
  const rockMat = makeMaterial({ color: MYCO_PALETTE.stone, roughness: 0.92 });
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();

  let g = 0;
  for (let i = 0; g < grassCount && i < grassCount * 8; i++) {
    const a = i * 2.399963;
    const r = 34 + ((i * 17) % 72);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.82;
    if (!isNaturalSoilSpot(x, z, 1.2)) continue;
    const sc = 0.65 + (i % 5) * 0.12;
    dummy.position.set(x, terrainHeight(x, z) + 0.34 * sc, z);
    dummy.rotation.set((i % 3 - 1) * 0.09, a, 0);
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    grass.setMatrixAt(g++, dummy.matrix);
  }
  grass.count = g;

  let rIdx = 0;
  for (let i = 0; rIdx < rockCount && i < rockCount * 8; i++) {
    const a = i * 2.17 + 0.4;
    const r = 42 + ((i * 23) % 78);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.78;
    if (!isNaturalSoilSpot(x, z, 1.5)) continue;
    const sc = 0.48 + (i % 4) * 0.15;
    dummy.position.set(x, terrainHeight(x, z) + 0.26 * sc, z);
    dummy.rotation.set(i * 0.31, a, i * 0.17);
    dummy.scale.set(sc * 1.2, sc * 0.7, sc);
    dummy.updateMatrix();
    rocks.setMatrixAt(rIdx++, dummy.matrix);
  }
  rocks.count = rIdx;
  grass.instanceMatrix.needsUpdate = true;
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = !touch;
  rocks.receiveShadow = true;
  group.add(grass, rocks);
}

export function createStorybookLandmarks(scene, isTouchDevice = false) {
  if (!scene || !THREE || !THREE.InstancedMesh) return null;
  const group = new THREE.Group();
  group.name = 'MycoCozyLandmarks';
  addGiantMushrooms(group, !!isTouchDevice);
  addGroundDetails(group, !!isTouchDevice);
  scene.add(group);
  return group;
}
