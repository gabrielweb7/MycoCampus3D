const TREE_X = 3.35;
const TREE_Z = 5.45;

export function buildChristmasPlaza({ scene, solidColliders }) {
  const THREE = window.THREE;
  const tree = new THREE.Group();
  tree.name = 'ChristmasPlaza';
  tree.position.set(TREE_X, 0.02, TREE_Z);
  scene.add(tree);

  const tiers = [
    { y: 1.12, radius: 1.34, height: 1.56, color: 0x226746 },
    { y: 2.02, radius: 1.08, height: 1.38, color: 0x31825a },
    { y: 2.81, radius: 0.79, height: 1.22, color: 0x47976e },
    { y: 3.47, radius: 0.51, height: 1.08, color: 0x56a577 }
  ];
  const baubles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.12 }), 44);
  const palette = [0xffc764, 0xe46574, 0xf9e3aa, 0xb7e8e5].map(color => new THREE.Color(color));
  const transform = new THREE.Object3D();
  let ornament = 0;
  tiers.forEach((tier, level) => {
    const foliage = new THREE.Mesh(new THREE.CylinderGeometry(tier.radius * 0.13, tier.radius, tier.height, 10),
      new THREE.MeshStandardMaterial({ color: tier.color, roughness: 0.86, flatShading: true }));
    foliage.position.y = tier.y;
    foliage.rotation.y = level * 0.31;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    tree.add(foliage);
    for (let i = 0; i < 11; i++) {
      const angle = i * Math.PI * 2 / 11 + level * 0.37;
      const radius = tier.radius * 0.91;
      transform.position.set(Math.cos(angle) * radius, tier.y - tier.height * 0.43 + Math.sin(angle * 3) * 0.05, Math.sin(angle) * radius);
      transform.scale.setScalar(i % 3 === 0 ? 0.7 : 1);
      transform.updateMatrix();
      baubles.setMatrixAt(ornament, transform.matrix);
      baubles.setColorAt(ornament++, palette[(i + level) % palette.length]);
    }
  });
  tree.add(baubles);

  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? 0.16 : 0.38;
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  const topper = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.10, bevelEnabled: false, steps: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xffd67e, emissive: 0x8d4814, emissiveIntensity: 0.55, roughness: 0.4 }));
  topper.position.set(0, 4.15, -0.05);
  tree.add(topper);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x785044, roughness: 0.92 }));
  trunk.position.y = 0.4;
  tree.add(trunk);
  const ribbon = new THREE.MeshStandardMaterial({ color: 0xf8d68c, roughness: 0.65 });
  const red = new THREE.MeshStandardMaterial({ color: 0xbd4655, roughness: 0.74 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x377e79, roughness: 0.74 });
  for (const [x, z, size, rotation, wrapping] of [[0.74, 0.46, 0.38, 0.29, red], [0.36, 0.86, 0.28, -0.18, teal], [-0.72, 0.58, 0.32, -0.4, teal]]) {
    const gift = new THREE.Group();
    gift.position.set(x, size / 2, z);
    gift.rotation.y = rotation;
    gift.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size), wrapping));
    gift.add(new THREE.Mesh(new THREE.BoxGeometry(size + 0.006, size + 0.012, size * 0.21), ribbon));
    gift.add(new THREE.Mesh(new THREE.BoxGeometry(size * 0.21, size + 0.018, size + 0.006), ribbon));
    tree.add(gift);
  }

  solidColliders.push({ minX: TREE_X - 0.9, maxX: TREE_X + 0.9, minZ: TREE_Z - 0.72, maxZ: TREE_Z + 1.0, minY: 0, maxY: 2.1 });
}
