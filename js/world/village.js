import { VILLAGE_ENTRY_X, VILLAGE_HOUSE, VILLAGE_LOTS, VILLAGE_STREET_Z } from '../core/village-layout.js';
import { addSolidWall, addWalkableSlab } from '../engine/physics.js';
import { getGroundTextures, getTextures, makeBox, woodMat } from '../engine/textures.js';
import { buildGardenTap, buildLabSink } from '../items/lab-sink.js';

const THREE = window.THREE;
const PALETTES = [
  [0xffd9aa, 0xb85946], [0xd7e7ec, 0x4b6997], [0xf6d9e0, 0x956080],
  [0xe1e9bc, 0x62764d], [0xf4dfbb, 0x8b5c46]
];
const FLOOR_Y = 0.10;
const EAVES_Y = 3.02;
const GABLE_H = 1.34;

function material(color, roughness = 0.88) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function box(parent, mat, x, y, z, w, h, d, shadow = true) {
  const mesh = makeBox(w, h, d, mat, { noShadow: !shadow });
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function ground(parent, mat, x, z, w, d, y) {
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (x - w / 2 + uv.getX(i) * w) / 5, (-z - d / 2 + uv.getY(i) * d) / 5);
  }
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(x, y, z);
  plane.receiveShadow = true;
  parent.add(plane);
}

function roofGable(parent, mat, x, z, halfWidth) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(0, GABLE_H);
  shape.closePath();
  const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false }), mat);
  panel.position.set(x, EAVES_Y, z - 0.07);
  panel.receiveShadow = true;
  parent.add(panel);
}

function registerCounter(ctx, mesh, x, z, width, depth, topY, minY = 0) {
  const surface = { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, topY };
  mesh.userData.supportSurface = surface;
  ctx.supportSurfaces.push(surface);
  ctx.supportMeshes.push(mesh);
  ctx.solidColliders.push({ ...surface, minY, maxY: topY, surfaceTopY: topY });
}

function buildCottageWorkArea(ctx, root, lot, mats) {
  const { x, front, houseZ } = lot;
  const benchX = x + front * 2.3;
  const benchZ = houseZ - front * 2.36;
  const bench = box(root, mats.wood, benchX, 0.92, benchZ, 2.75, 0.15, 0.90);
  for (const dx of [-1.15, 1.15]) {
    for (const dz of [-0.31, 0.31]) {
      box(root, mats.accent, benchX + dx, 0.51, benchZ + dz, 0.14, 0.82, 0.14);
    }
  }
  box(root, mats.wood, benchX, 0.34, benchZ, 2.37, 0.10, 0.66);
  registerCounter(ctx, bench, benchX, benchZ, 2.75, 0.90, 0.995, FLOOR_Y);

  const sinkX = x - front * 2.52;
  const sinkZ = benchZ;
  box(root, mats.wall, sinkX, 0.43, sinkZ, 1.36, 0.66, 0.78);
  for (const dx of [-0.34, 0.34]) {
    box(root, mats.accent, sinkX + dx, 0.45, sinkZ + front * 0.398, 0.56, 0.55, 0.042);
    box(root, mats.trim, sinkX + dx * 0.44, 0.55, sinkZ + front * 0.435, 0.048, 0.06, 0.043);
  }
  for (const dz of [-0.328, 0.328]) box(root, mats.wood, sinkX, 0.91, sinkZ + dz, 1.46, 0.16, 0.156);
  for (const dx of [-0.515, 0.515]) box(root, mats.wood, sinkX + dx, 0.91, sinkZ, 0.426, 0.16, 0.50);
  const cabinet = { minX: sinkX - 0.73, maxX: sinkX + 0.73, minZ: sinkZ - 0.406, maxZ: sinkZ + 0.406, minY: FLOOR_Y, maxY: 0.99 };
  ctx.solidColliders.push(cabinet);
  const sink = buildLabSink(ctx, sinkX, 0.99, sinkZ, 'cottage');
  sink.collider = cabinet;
  buildGardenTap(ctx, x + front * 5.85, lot.doorZ + front * 1.17, front);
}

function windowFrame(parent, mats, x, z) {
  box(parent, mats.trim, x, 1.80, z, 1.26, 1.05, 0.19);
  box(parent, mats.glass, x, 1.81, z + 0.045, 1.06, 0.85, 0.16, false);
  box(parent, mats.trim, x, 1.81, z, 0.08, 0.86, 0.27, false);
  box(parent, mats.trim, x, 1.81, z, 1.09, 0.08, 0.27, false);
  box(parent, mats.wood, x, 1.23, z, 1.41, 0.14, 0.39);
}

function lotPlaque(parent, id, x, z, direction) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#57372c';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#ffc981';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 112, 80);
  ctx.fillStyle = '#ffebc6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 62px system-ui';
  ctx.fillText(String(id).padStart(2, '0'), 64, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.69, 0.52), new THREE.MeshBasicMaterial({ map: texture }));
  plaque.position.set(x, 1.43, z);
  plaque.rotation.y = direction === 1 ? 0 : Math.PI;
  parent.add(plaque);
  return plaque;
}

function buildFence(ctx, parent, lot, mat) {
  const posts = [];
  function segment(x1, z1, x2, z2, addEnd = false) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const yaw = -Math.atan2(z2 - z1, x2 - x1);
    for (const y of [0.39, 0.77]) {
      box(parent, mat, (x1 + x2) / 2, y, (z1 + z2) / 2, length, 0.12, 0.13).rotation.y = yaw;
    }
    const count = Math.ceil(length / 0.74);
    for (let i = 0; i < count + (addEnd ? 1 : 0); i++) {
      posts.push([x1 + (x2 - x1) * i / count, z1 + (z2 - z1) * i / count]);
    }
    ctx.wallSegments.push({ x1, z1, x2, z2, minY: 0, maxY: 0.98, halfThick: 0.12 });
  }
  const { minX, maxX, x, gateZ } = lot;
  const backZ = lot.z - lot.front * 10;
  segment(minX, gateZ, minX, backZ);
  segment(minX, backZ, maxX, backZ);
  segment(maxX, backZ, maxX, gateZ);
  segment(x - 1.34, gateZ, minX, gateZ);
  segment(maxX, gateZ, x + 1.34, gateZ, true);
  const geometry = new THREE.BoxGeometry(0.15, 1, 0.15);
  const fence = new THREE.InstancedMesh(geometry, mat, posts.length);
  const matrix = new THREE.Matrix4();
  for (const [i, [px, pz]] of posts.entries()) {
    fence.setMatrixAt(i, matrix.makeTranslation(px, 0.50, pz));
  }
  fence.castShadow = fence.receiveShadow = true;
  parent.add(fence);
}

function buildHouse(ctx, root, lot, mats) {
  const { scene, wallSegments, walkableFloors } = ctx;
  const { width, depth, doorway } = VILLAGE_HOUSE;
  const { x, front, houseZ, doorZ } = lot;
  const backZ = houseZ - front * depth / 2;
  const left = x - width / 2;
  const right = x + width / 2;
  const wallHeight = EAVES_Y - FLOOR_Y;
  addWalkableSlab(root, walkableFloors, x, FLOOR_Y, houseZ, width, 0.18, depth, mats.floor);
  addWalkableSlab(root, walkableFloors, x, FLOOR_Y, doorZ + front * 0.68, 2.6, 0.15, 1.5, mats.trim);
  addSolidWall(root, wallSegments, left, backZ, right, backZ, FLOOR_Y, wallHeight, 0.24, mats.wall);
  addSolidWall(root, wallSegments, left, backZ, left, doorZ, FLOOR_Y, wallHeight, 0.24, mats.wall);
  addSolidWall(root, wallSegments, right, backZ, right, doorZ, FLOOR_Y, wallHeight, 0.24, mats.wall);
  addSolidWall(root, wallSegments, left, doorZ, x - doorway / 2, doorZ, FLOOR_Y, wallHeight, 0.24, mats.wall);
  addSolidWall(root, wallSegments, x + doorway / 2, doorZ, right, doorZ, FLOOR_Y, wallHeight, 0.24, mats.wall);
  box(root, mats.wall, x, EAVES_Y - 0.33, doorZ, doorway + 0.04, 0.66, 0.25);
  for (const off of [-doorway / 2, doorway / 2]) {
    box(root, mats.trim, x + off, 1.28, doorZ, 0.13, 2.37, 0.36);
  }
  box(root, mats.trim, x, 2.44, doorZ, doorway + 0.22, 0.17, 0.36);

  // Local +Z faces the lane, so trim and glazing work for both rows.
  const facade = new THREE.Group();
  facade.position.set(x, 0, doorZ);
  facade.rotation.y = front === 1 ? 0 : Math.PI;
  root.add(facade);
  windowFrame(facade, mats, -2.46, 0.12);
  windowFrame(facade, mats, 2.46, 0.12);
  for (const off of [-1, 1]) {
    box(facade, mats.wood, off * (width / 2 - 0.07), 1.54, 0.10, 0.18, 2.90, 0.24);
  }
  box(facade, mats.wood, 0, EAVES_Y - 0.05, 0.15, width, 0.16, 0.17);
  box(facade, mats.wood, 0, EAVES_Y + 0.51, 0.15, 0.16, 1.09, 0.17);
  for (const side of [-1, 1]) {
    box(facade, mats.wood, side * 1.74, EAVES_Y + 0.55, 0.15, 3.61, 0.14, 0.17).rotation.z = -side * 0.31;
  }
  box(facade, mats.accent, 0, 2.71, 0.47, 2.35, 0.13, 1.21).rotation.x = 0.15;
  roofGable(root, mats.wall, x, doorZ, width / 2);
  roofGable(root, mats.wall, x, backZ, width / 2);
  const run = width / 2 + 0.46;
  const angle = Math.atan2(GABLE_H, width / 2);
  const rafter = run / Math.cos(angle);
  const roofY = EAVES_Y + GABLE_H + 0.07;
  for (const side of [-1, 1]) {
    const panel = box(root, mats.roof, x + side * run / 2, roofY - Math.sin(angle) * rafter / 2, houseZ,
      rafter + 0.05, 0.18, depth + 0.9);
    panel.rotation.z = -side * angle;
    for (let tileRow = 1; tileRow <= 6; tileRow++) {
      const off = tileRow * run / 7;
      box(root, mats.accent, x + side * off, roofY + 0.105 - off * Math.tan(angle), houseZ,
        0.06, 0.037, depth + 0.84, false).rotation.z = -side * angle;
    }
  }
  box(root, mats.accent, x, roofY + 0.09, houseZ, 0.28, 0.18, depth + 0.94);
  box(root, mats.chimney, x + front * 2.2, 3.97, houseZ - front * 1.68, 0.58, 1.36, 0.58);
  box(root, mats.trim, x + front * 2.2, 4.66, houseZ - front * 1.68, 0.75, 0.17, 0.73);
  ctx.roofZones.push({ minX: left, maxX: right, minZ: Math.min(doorZ, backZ), maxZ: Math.max(doorZ, backZ), roofY: EAVES_Y });
  if (root.parent !== scene) scene.add(root);
}

function buildYard(ctx, root, lot, mats) {
  const { x, front, gateZ, doorZ } = lot;
  ground(root, mats.path, x, (doorZ + gateZ) / 2, 1.7, Math.abs(gateZ - doorZ) + 0.2, 0.029);
  buildFence(ctx, root, lot, mats.wood);
  const signX = x - front * 1.76;
  box(root, mats.wood, signX, 0.67, gateZ - front * 0.12, 0.17, 1.34, 0.17);
  box(root, mats.wood, signX, 1.43, gateZ, 0.77, 0.60, 0.13);
  const plaque = lotPlaque(root, lot.id, signX, gateZ + front * 0.076, front);
  plaque.userData.villageLot = lot.id;
  ctx.villageHitMeshes.push(plaque);

  const mailX = x + front * 1.72;
  box(root, mats.wood, mailX, 0.48, gateZ - front * 0.1, 0.16, 0.96, 0.16);
  const mailbox = box(root, mats.mail, mailX, 1.03, gateZ - front * 0.1, 0.43, 0.33, 0.45);
  box(root, mats.trim, mailX, 1.07, gateZ + front * 0.13, 0.24, 0.036, 0.028, false);
  box(root, mats.chimney, mailX + 0.25, 1.16, gateZ - front * 0.1, 0.046, 0.25, 0.12, false);
  mailbox.userData.villageLot = lot.id;
  ctx.villageHitMeshes.push(mailbox);

  const standX = lot.benchX;
  const standZ = lot.benchZ;
  const top = box(root, mats.wood, standX, 0.82, standZ, 2.12, 0.14, 1.05);
  for (const dx of [-0.87, 0.87]) {
    for (const dz of [-0.40, 0.40]) box(root, mats.wood, standX + dx, 0.37, standZ + dz, 0.14, 0.74, 0.14);
  }
  registerCounter(ctx, top, standX, standZ, 2.12, 1.05, 0.89);

  const planterZ = doorZ + front * 1.2;
  for (const dx of [-3.1, 3.1]) {
    box(root, mats.wood, x + dx, 0.18, planterZ, 1.36, 0.36, 0.54);
    for (let i = 0; i < 3; i++) {
      const flowerX = x + dx + (i - 1) * 0.36;
      const flowerZ = planterZ + (i === 1 ? 0.08 : -0.07);
      box(root, mats.leaf, flowerX, 0.46, flowerZ, 0.105, 0.22, 0.105, false);
      const flower = new THREE.Mesh(mats.flowerGeo, i === 1 ? mats.flowerLight : mats.flower);
      flower.position.set(flowerX, 0.62 + (i === 1 ? 0.06 : 0), flowerZ);
      root.add(flower);
    }
  }

  const treeX = x - front * 7.9;
  const treeZ = lot.houseZ + front * 3.35;
  const trunk = new THREE.Mesh(mats.trunkGeo, mats.wood);
  trunk.position.set(treeX, 0.82, treeZ);
  trunk.castShadow = true;
  root.add(trunk);
  for (const [offsetX, y, offsetZ, scale] of [[0, 2.1, 0, 1.13], [-0.55, 1.92, 0.14, 0.79], [0.49, 2.01, -0.2, 0.81], [0.10, 2.72, -0.08, 0.70]]) {
    const crown = new THREE.Mesh(mats.crownGeo, offsetX < 0 ? mats.leaf : mats.canopy);
    crown.position.set(treeX + offsetX, y, treeZ + offsetZ);
    crown.scale.set(scale, scale * 0.87, scale);
    crown.rotation.y = lot.id * 0.41 + y;
    crown.castShadow = true;
    root.add(crown);
  }
  ctx.solidColliders.push({ minX: treeX - 0.24, maxX: treeX + 0.24, minZ: treeZ - 0.24, maxZ: treeZ + 0.24, minY: 0, maxY: 1.8 });
}

export function buildVillage(ctx) {
  const dirt = new THREE.MeshStandardMaterial({ map: getGroundTextures().dirt, color: 0xebc394, roughness: 0.97 });
  dirt.userData.keepPbr = true;
  const path = new THREE.MeshStandardMaterial({ map: getTextures().texPaving, color: 0xd5bc9a, roughness: 0.95 });
  const shared = {
    path, wood: woodMat(1, 1), floor: woodMat(1.8, 1.8), trim: material(0xd8c1a7), mail: material(0x4e8d8c),
    chimney: material(0x8f665b), leaf: material(0x4f783a), canopy: material(0x77a750), glass: material(0x648c9b, 0.54),
    trunkGeo: new THREE.CylinderGeometry(0.16, 0.22, 1.64, 7), crownGeo: new THREE.DodecahedronGeometry(1, 0),
    flower: material(0xe57d8e), flowerLight: material(0xfbd484), flowerGeo: new THREE.IcosahedronGeometry(0.14, 0)
  };
  // Short sections preserve frustum culling along the lane without breaking texture UVs.
  for (let x = -52; x <= 52; x += 26) ground(ctx.scene, dirt, x, VILLAGE_STREET_Z, 26, 7, 0.028);
  ground(ctx.scene, dirt, VILLAGE_ENTRY_X, 54.35, 3.7, 23.5, 0.030);
  const palettes = PALETTES.map(([wall, roof]) => ({
    wall: material(wall), roof: material(roof), accent: material(new THREE.Color(roof).multiplyScalar(0.76))
  }));
  for (const lot of VILLAGE_LOTS) {
    const root = new THREE.Group();
    root.name = `Village lot ${lot.id}`;
    const mats = { ...shared, ...palettes[(lot.id - 1 + (lot.front < 0 ? 2 : 0)) % palettes.length] };
    buildHouse(ctx, root, lot, mats);
    buildYard(ctx, root, lot, mats);
    buildCottageWorkArea(ctx, root, lot, mats);
  }
}
