import { makeBox } from '../engine/textures.js';

function matte(THREE, color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...options });
}

// A folded surface with a light midrib and a scalloped or lobed silhouette.
function leafGeometry(THREE, width, rise, lobed) {
  const positions = [];
  const colors = [];
  const indices = [];
  const segments = 12;
  for (let row = 0; row <= segments; row++) {
    const t = row / segments;
    const ripple = Math.cos(row * Math.PI * (lobed ? 0.65 : 0.9));
    const spread = width * (0.025 + Math.sin(Math.PI * t) ** 0.72) * (1 + ripple * (lobed ? 0.32 : 0.12));
    for (let col = -2; col <= 2; col++) {
      const across = col / 2;
      const edge = Math.abs(across);
      positions.push(spread * across, rise * t * t + edge * edge * t * (0.19 + ripple * 0.08) - Math.sin(Math.PI * t) * 0.1, t);
      const light = col === 0 ? 1 : 0.73 + t * 0.16 + across * 0.05;
      colors.push(light, light, light);
    }
    if (row === 0) continue;
    for (let col = 0; col < 4; col++) {
      const a = (row - 1) * 5 + col;
      indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGardenModels(THREE) {
  const leafOptions = { side: THREE.DoubleSide, vertexColors: true, flatShading: true };
  const lettuceLeaf = leafGeometry(THREE, 0.52, 0.52, false);
  const tomatoLeaf = leafGeometry(THREE, 0.35, -0.32, true);
  const lettuce = [0x54723d, 0x81924d, 0xa4ad61, 0xbfc776].map((color) => matte(THREE, color, leafOptions));
  const tomato = [0x617a45, 0x779151].map((color) => matte(THREE, color, leafOptions));
  const bamboo = matte(THREE, 0xc88e42);
  const twine = matte(THREE, 0xa9753a);
  const stem = matte(THREE, 0x477323);
  const rod = new THREE.CylinderGeometry(0.82, 1, 1, 6);
  const knot = new THREE.TorusGeometry(0.018, 0.004, 5, 9);
  knot.rotateX(Math.PI / 2);
  const fruitGeometry = new THREE.SphereGeometry(1, 9, 6);
  const ripe = matte(THREE, 0xd16b4c, { flatShading: true, roughness: 0.55 });
  const green = matte(THREE, 0x8fad30, { flatShading: true });
  const calyxPoints = Array.from({ length: 10 }, (_, i) => {
    const a = i * Math.PI / 5;
    const radius = i % 2 ? 0.012 : 0.033;
    return new THREE.Vector2(Math.cos(a) * radius, Math.sin(a) * radius);
  });
  const calyxGeometry = new THREE.ShapeGeometry(new THREE.Shape(calyxPoints));
  calyxGeometry.rotateX(-Math.PI / 2);
  const up = new THREE.Vector3(0, 1, 0);

  function segment(parent, start, end, radius, material) {
    const direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(rod, material);
    mesh.position.copy(start).lerp(end, 0.5);
    mesh.scale.set(radius, direction.length(), radius);
    mesh.quaternion.setFromUnitVectors(up, direction.normalize());
    parent.add(mesh);
  }

  function makeLettuce() {
    const group = new THREE.Group();
    for (let layer = 0; layer < lettuce.length; layer++) {
      const count = 7 - layer;
      for (let i = 0; i < count; i++) {
        const leaf = new THREE.Mesh(lettuceLeaf, lettuce[layer]);
        const length = 0.22 - 0.043 * layer + 0.008 * Math.cos(i * 3);
        leaf.scale.set(length, length + layer * 0.009, length);
        leaf.rotation.order = 'YXZ';
        leaf.rotation.set(-0.04 - layer * 0.24, i * Math.PI * 2 / count + layer * 0.53, 0);
        leaf.position.y = 0.016 + layer * 0.017;
        group.add(leaf);
      }
    }
    return group;
  }

  function makeFruit() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(fruitGeometry, ripe);
    body.scale.set(0.051, 0.044, 0.049);
    const calyx = new THREE.Mesh(calyxGeometry, stem);
    calyx.position.y = 0.043;
    group.add(body, calyx);
    return { group, body };
  }

  function makeTomato() {
    const stake = new THREE.Group();
    segment(stake, new THREE.Vector3(0.025, 0, 0), new THREE.Vector3(0.025, 0.87, 0), 0.016, bamboo);
    for (const y of [0.14, 0.37, 0.6, 0.79]) {
      const ring = new THREE.Mesh(knot, twine);
      ring.position.set(0.025, y, 0);
      stake.add(ring);
    }
    const foliage = new THREE.Group();
    const lowerShoots = new THREE.Group();
    const fruits = [];
    const base = new THREE.Vector3(-0.036, 0, 0);
    const elbow = new THREE.Vector3(-0.023, 0.42, 0.01);
    const tip = new THREE.Vector3(-0.043, 0.75, 0.012);
    segment(foliage, base, elbow, 0.014, stem);
    segment(foliage, elbow, tip, 0.011, stem);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const y = 0.17 + i * 0.087;
      const start = new THREE.Vector3(-0.03, y, 0.008);
      const end = start.clone().add(new THREE.Vector3(Math.sin(angle) * 0.14, 0.065, Math.cos(angle) * 0.14));
      const shoot = i < 2 ? lowerShoots : foliage;
      segment(shoot, start, end, 0.006, stem);
      for (let side = -1; side <= 1; side++) {
        const leaf = new THREE.Mesh(tomatoLeaf, tomato[(i + Math.abs(side)) % 2]);
        leaf.position.copy(side === 0 ? end : start.clone().lerp(end, 0.65));
        leaf.scale.setScalar(side === 0 ? 0.145 : 0.10);
        leaf.rotation.y = angle + side * 0.85;
        shoot.add(leaf);
      }
    }
    foliage.add(lowerShoots);
    for (const [x, y, z] of [[-0.16, 0.32, 0.07], [-0.10, 0.25, 0.14], [0.15, 0.54, 0.06], [0.11, 0.47, 0.14], [0.18, 0.46, -0.028]]) {
      const fruit = makeFruit();
      fruit.group.position.set(x, y, z);
      segment(fruit.group, new THREE.Vector3(-0.035 - x, 0.12, -z), new THREE.Vector3(0, 0.043, 0), 0.004, stem);
      foliage.add(fruit.group);
      fruits.push(fruit);
    }
    return { stake, foliage, lowerShoots, fruits };
  }

  return { makeLettuce, makeTomato, makeFruit, ripe, green };
}

export function makeSubstrateBox(THREE, width, height, depth) {
  const group = new THREE.Group();
  const fill = new THREE.Group();
  const wood = [0xca812b, 0xe5a139, 0xd89131, 0xf4b94d].map((color) => matte(THREE, color));
  const metal = matte(THREE, 0x725337);
  const soilColors = [0x493020, 0x5e3d28, 0x6c4630, 0x8f6941].map((color) => matte(THREE, color, { flatShading: true }));
  const sprout = matte(THREE, 0x567729, { side: THREE.DoubleSide });
  const boardHeight = (height - 0.1) / 3;
  const nail = new THREE.IcosahedronGeometry(0.015, 0);
  const clump = new THREE.IcosahedronGeometry(1, 0);

  function board(w, h, d, x, y, z, material, parent = group) {
    const mesh = makeBox(w, h, d, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
  }

  board(width - 0.1, 0.08, depth - 0.1, 0, 0.05, 0, wood[0]);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      const y = 0.06 + boardHeight * (row + 0.5);
      board(width - 0.05, boardHeight - 0.009, 0.055, 0, y, side * (depth / 2 - 0.05), wood[row]);
      board(0.055, boardHeight - 0.009, depth - 0.1, side * (width / 2 - 0.05), y, 0, wood[(row + 1) % 3]);
    }
    for (const end of [-1, 1]) {
      const x = side * (width / 2 - 0.055);
      const z = end * (depth / 2 - 0.045);
      board(0.098, height - 0.044, 0.084, x, (height - 0.044) / 2, z, wood[2]);
      for (const y of [0.09, height - 0.13]) {
        const pin = new THREE.Mesh(nail, metal);
        pin.position.set(x, y, z + end * 0.044);
        group.add(pin);
      }
    }
  }

  const outer = new THREE.Shape([
    new THREE.Vector2(-width / 2 + 0.015, -depth / 2 + 0.015),
    new THREE.Vector2(width / 2 - 0.015, -depth / 2 + 0.015),
    new THREE.Vector2(width / 2 - 0.015, depth / 2 - 0.015),
    new THREE.Vector2(-width / 2 + 0.015, depth / 2 - 0.015)
  ]);
  const innerX = width / 2 - 0.106;
  const innerZ = depth / 2 - 0.106;
  outer.holes.push(new THREE.Path([
    new THREE.Vector2(-innerX, -innerZ), new THREE.Vector2(-innerX, innerZ),
    new THREE.Vector2(innerX, innerZ), new THREE.Vector2(innerX, -innerZ)
  ]));
  const rimGeometry = new THREE.ExtrudeGeometry(outer, { depth: 0.036, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
  rimGeometry.rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(rimGeometry, wood[3]);
  rim.position.y = height - 0.048;
  group.add(rim);

  board(width - 0.16, 0.08, depth - 0.16, 0, -0.04, 0, soilColors[0], fill);
  for (let i = 0; i < 40; i++) {
    const x = (i % 8 - 3.5) * (width - 0.22) / 8 + Math.sin(i * 7.1) * 0.034;
    const z = (Math.floor(i / 8) - 2) * (depth - 0.24) / 5 + Math.cos(i * 8.4) * 0.042;
    const mesh = new THREE.Mesh(clump, soilColors[i % 11 === 0 ? 3 : i % 3]);
    mesh.position.set(x, -0.008, z);
    mesh.scale.set(0.077 + i % 4 * 0.009, 0.027 + i % 5 * 0.004, 0.09);
    mesh.rotation.y = i * 2.37;
    fill.add(mesh);
  }
  group.add(fill);

  const mark = new THREE.Shape();
  mark.moveTo(0, 0.01);
  mark.quadraticCurveTo(-0.13, 0.01, -0.143, 0.116);
  mark.quadraticCurveTo(-0.03, 0.126, 0, 0.045);
  mark.quadraticCurveTo(0.027, 0.146, 0.142, 0.162);
  mark.quadraticCurveTo(0.137, 0.047, 0.016, 0.018);
  mark.lineTo(0.014, -0.041);
  mark.lineTo(-0.006, -0.041);
  mark.closePath();
  const emblem = new THREE.Mesh(new THREE.ShapeGeometry(mark, 5), sprout);
  emblem.position.set(0, height * 0.41, -depth / 2 + 0.02);
  emblem.rotation.y = Math.PI;
  group.add(emblem);
  return { group, fill };
}

export function makeGardenBasketModel(THREE) {
  const group = new THREE.Group();
  const wicker = [0xa67b54, 0xbf9163, 0xd5b17d].map(color => matte(THREE, color));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.268, 0.254, 0.035, 20), wicker[0]);
  base.scale.z = 0.71;
  base.position.y = 0.028;
  group.add(base);

  const strands = 24;
  for (let row = 0; row < 7; row++) {
    const height = 0.055 + row * 0.028;
    const radius = 0.257 + row * 0.006;
    const points = Array.from({ length: strands }, (_, col) => {
      const angle = col * Math.PI * 2 / strands;
      const weave = (row + col) % 2 ? 0.008 : -0.008;
      return new THREE.Vector3(Math.cos(angle) * (radius + weave), height, Math.sin(angle) * (radius * 0.71 + weave));
    });
    const curve = new THREE.CatmullRomCurve3(points, true);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, strands * 2, 0.017, 5, true), wicker[row % 3]));
  }

  const rib = new THREE.CylinderGeometry(0.010, 0.011, 0.18, 5);
  const stakes = new THREE.InstancedMesh(rib, wicker[1], strands);
  const stake = new THREE.Object3D();
  for (let col = 0; col < strands; col++) {
    const angle = col * Math.PI * 2 / strands;
    stake.position.set(0.274 * Math.cos(angle), 0.136, 0.196 * Math.sin(angle));
    stake.rotation.set(Math.sin(angle) * 0.13, 0, -Math.cos(angle) * 0.18);
    stake.updateMatrix();
    stakes.setMatrixAt(col, stake.matrix);
  }
  group.add(stakes);

  const rimGeo = new THREE.TorusGeometry(0.294, 0.023, 7, 32);
  const rim = new THREE.Mesh(rimGeo, wicker[2]);
  rim.rotation.x = -Math.PI / 2;
  rim.scale.y = 0.74;
  rim.position.y = 0.235;
  group.add(rim);

  const handlePoints = Array.from({ length: 13 }, (_, i) => {
    const angle = i * Math.PI / 12;
    return new THREE.Vector3(Math.cos(angle) * 0.282, 0.216 + Math.sin(angle) * 0.31, 0);
  });
  const handleCurve = new THREE.CatmullRomCurve3(handlePoints);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 28, 0.024, 7, false), wicker[1]));
  return group;
}
