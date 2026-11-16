import {
  CAVE_TUNNELS,
  getCaveCenterline,
  getRiverCenterline,
  terrainHeight
} from '../engine/terrain-profile.js';

const THREE = window.THREE;

function buildRiver(scene, riverIndex) {
  const points = getRiverCenterline(riverIndex, 180);
  const vertices = [];
  const indices = [];
  const halfWidth = riverIndex === 2 ? 8 : 10;

  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;
    const leftX = points[i].x + nx * halfWidth;
    const leftZ = points[i].z + nz * halfWidth;
    const rightX = points[i].x - nx * halfWidth;
    const rightZ = points[i].z - nz * halfWidth;
    vertices.push(leftX, terrainHeight(leftX, leftZ) + 0.55, leftZ);
    vertices.push(rightX, terrainHeight(rightX, rightZ) + 0.55, rightZ);

    if (i < points.length - 1) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const water = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0x2389b8,
      emissive: 0x073b59,
      emissiveIntensity: 0.24,
      roughness: 0.22,
      metalness: 0.12,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide
    })
  );
  water.receiveShadow = true;
  scene.add(water);
}

function buildCave(scene, cave) {
  const points = getCaveCenterline(cave, 42);
  const crossSegments = 12;
  const vertices = [];
  const indices = [];

  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length;
    const nz = dx / length;

    for (let j = 0; j <= crossSegments; j++) {
      const angle = Math.PI * j / crossSegments;
      const across = Math.cos(angle) * cave.width / 2;
      const height = Math.sin(angle) * cave.height;
      vertices.push(points[i].x + nx * across, cave.floorY + height, points[i].z + nz * across);

      if (i < points.length - 1 && j < crossSegments) {
        const base = i * (crossSegments + 1) + j;
        const nextRow = base + crossSegments + 1;
        indices.push(base, nextRow, base + 1, base + 1, nextRow, nextRow + 1);
      }
    }
  }

  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  roofGeometry.setIndex(indices);
  roofGeometry.computeVertexNormals();
  const roof = new THREE.Mesh(
    roofGeometry,
    new THREE.MeshStandardMaterial({ color: 0x3f4547, roughness: 1, side: THREE.DoubleSide })
  );
  roof.receiveShadow = true;
  scene.add(roof);

  const directionX = cave.endX - cave.startX;
  const directionZ = cave.endZ - cave.startZ;
  const facing = Math.atan2(directionX, directionZ);
  [points[2], points[points.length - 3]].forEach((point, index) => {
    const darkness = new THREE.Mesh(
      new THREE.CircleGeometry(cave.width * 0.47, 24),
      new THREE.MeshBasicMaterial({ color: 0x080d12, side: THREE.DoubleSide })
    );
    darkness.position.set(point.x, cave.floorY + cave.height * 0.48, point.z);
    darkness.rotation.y = facing + (index ? Math.PI : 0);
    scene.add(darkness);
  });

  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: 0x7c3aed,
    emissive: 0x6d28d9,
    emissiveIntensity: 1.4,
    roughness: 0.28
  });
  const crystalGeometry = new THREE.OctahedronGeometry(0.75, 0);
  [points[5], points[points.length - 6]].forEach((point, index) => {
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.set(point.x + (index ? -2.2 : 2.2), cave.floorY + 1.2, point.z);
    crystal.scale.set(0.65, 1.5, 0.65);
    scene.add(crystal);
  });
}

export function buildWildlands(scene) {
  for (let riverIndex = 0; riverIndex < 3; riverIndex++) buildRiver(scene, riverIndex);
  for (let caveIndex = 0; caveIndex < CAVE_TUNNELS.length; caveIndex++) {
    buildCave(scene, CAVE_TUNNELS[caveIndex]);
  }
}
