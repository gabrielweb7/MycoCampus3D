/** Pequenos detalhes de solo "Myco Cozy" de baixo custo. */
import { MYCO_PALETTE } from '../engine/visual-style.js';
import { terrainHeight } from '../engine/physics.js';
import { isNaturalSoilSpot } from './nature-plaza.js';

const THREE = window.THREE;

function makeMaterial(options) {
  const mat = new THREE.MeshStandardMaterial(options);
  mat.userData.shared = true;
  return mat;
}

function addGroundDetails(group, touch) {
  const tuftCount = touch ? 26 : 52;
  const rockCount = touch ? 16 : 30;
  const bladeGeo = new THREE.ConeGeometry(0.11, 0.55, 4);
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const grassMat = makeMaterial({ color: 0xffffff, roughness: 0.9 });
  const rockMat = makeMaterial({ color: MYCO_PALETTE.stone, roughness: 0.92 });
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, tuftCount * 3);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const grassColors = [0x2d894e, 0x56aa50, 0x89be58];

  let g = 0;
  for (let i = 0; g < tuftCount * 3 && i < tuftCount * 8; i++) {
    const a = i * 2.399963;
    const r = 34 + ((i * 17) % 72);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.82;
    if (!isNaturalSoilSpot(x, z, 1.6)) continue;
    for (let blade = 0; blade < 3; blade++) {
      const turn = a + blade * Math.PI * 2 / 3;
      const bx = x + Math.cos(turn) * 0.12;
      const bz = z + Math.sin(turn) * 0.12;
      const scale = 0.64 + (i % 5) * 0.08 + blade * 0.12;
      dummy.position.set(bx, terrainHeight(bx, bz) + 0.23 * scale, bz);
      dummy.rotation.set(0, -turn, -0.32, 'YXZ');
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      grass.setMatrixAt(g, dummy.matrix);
      grass.setColorAt(g++, color.setHex(grassColors[blade]));
    }
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
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = !touch;
  rocks.receiveShadow = true;
  group.add(grass, rocks);
}

export function createStorybookLandmarks(scene, isTouchDevice = false) {
  if (!scene || !THREE || !THREE.InstancedMesh) return null;
  const group = new THREE.Group();
  group.name = 'MycoCozyLandmarks';
  addGroundDetails(group, !!isTouchDevice);
  scene.add(group);
  return group;
}
