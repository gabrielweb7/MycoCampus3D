import { CAMPUS_CROSSINGS, CAMPUS_ROUTES } from '../core/campus-route-layout.js';
import { getGroundTextures, makeBox } from '../engine/textures.js';

const THREE = window.THREE;
let routes;

function getRoutes() {
  if (routes) return routes;
  routes = CAMPUS_ROUTES.map(route => {
    const points = route.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(points, !!route.closed);
    const samples = curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 0.65)));
    const bounds = new THREE.Box3().setFromPoints(samples);
    return { ...route, samples, bounds };
  });
  return routes;
}

export function isOverCampusRoute(x, z, margin = 0) {
  for (const { samples, bounds, width } of getRoutes()) {
    const limit = width * 0.58 + margin;
    if (x < bounds.min.x - limit || x > bounds.max.x + limit ||
        z < bounds.min.z - limit || z > bounds.max.z + limit) continue;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const fraction = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      if ((x - a.x - fraction * dx) ** 2 + (z - a.z - fraction * dz) ** 2 <= limit * limit) return true;
    }
  }
  return false;
}

function makeRibbon({ samples, width, surface, closed }, groundY, material) {
  const bands = surface ? [-1, 1] : [-1, -0.79, -0.18, 0.46, 0.83, 1];
  const coords = [];
  const uv = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();
  const edge = new THREE.Color(0x97a257);
  const dirt = new THREE.Color(0xd9d1b6);
  for (let i = 0; i < samples.length; i++) {
    const point = samples[i];
    const end = i === samples.length - 1;
    const prev = samples[closed && i === 0 ? samples.length - 2 : Math.max(0, i - 1)];
    const next = samples[closed && end ? 1 : Math.min(samples.length - 1, i + 1)];
    const phase = closed && end ? 0 : i;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const length = Math.hypot(dx, dz);
    const shape = surface ? 1 : 1 + Math.sin(phase * 0.77) * 0.08 + Math.cos(phase * 0.31) * 0.09;
    for (let j = 0; j < bands.length; j++) {
      const band = bands[j];
      const offset = band * width * shape * 0.5 / length;
      const x = point.x + dz * offset;
      const z = point.z - dx * offset;
      coords.push(x, groundY(x, z) + (surface ? 0.026 : 0.019), z);
      uv.push(x * 0.55, -z * 0.55);
      if (surface) color.setHex(0xdfc28c);
      else color.copy(dirt).lerp(edge, Math.abs(band) * (Math.abs(band) > 0.95 ? 0.62 : 0.16))
        .multiplyScalar(0.86 + Math.abs(Math.sin(phase * 1.36 + j * 0.65)) * 0.14);
      colors.push(color.r, color.g, color.b);
      if (i && j) {
        const a = (i - 1) * bands.length + j - 1;
        const b = a + bands.length;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.userData.ignoreRay = true;
  return mesh;
}

function addWoodlandDetails(scene, groundY) {
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const layouts = [[-25.8, -51, 0.8], [-14.9, -54, 1.08], [-17.9, -60.7, 1.25],
    [-31.3, -51.7, 0.7], [-26.2, -61.7, 0.75], [-29.7, -47.8, 0.72], [-9.7, -58, 0.6]];
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, layouts.length * 3);
  const transforms = new THREE.Object3D();
  const color = new THREE.Color();
  const palettes = [0x777d62, 0x8d8b79, 0x879050];
  let index = 0;
  for (const [x, z, size] of layouts) {
    for (let i = 0; i < 3; i++) {
      const rx = x + i * 0.62;
      const rz = z + (i % 2) * 0.49;
      if (isOverCampusRoute(rx, rz, 0.35)) continue;
      const scale = size * (1 - i * 0.26);
      transforms.position.set(rx, groundY(rx, rz) + scale * 0.21, rz);
      transforms.scale.set(scale * 0.86, scale * 0.47, scale * 0.71);
      transforms.rotation.set(0, index * 2.4, 0.19);
      transforms.updateMatrix();
      rocks.setMatrixAt(index, transforms.matrix);
      rocks.setColorAt(index++, color.setHex(palettes[i]));
    }
  }
  rocks.count = index;
  rocks.receiveShadow = true;
  rocks.userData.ignoreRay = true;
  rocks.computeBoundingSphere();
  scene.add(rocks);

  const shoots = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.48, 3), rockMat, 90);
  const buds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 0), rockMat, 24);
  const clusters = [[-25.1, -49.6], [-20.2, -54.1], [-13.4, -53.5], [-10, -56],
    [-15.2, -61.2], [-18.3, -63.5], [-23.4, -60.5], [-30.2, -58], [-28.8, -48.5]];
  let shooting = 0;
  let flowering = 0;
  for (const [x, z] of clusters) {
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.4;
      const spread = 0.09 + i * 0.047;
      const px = x + Math.cos(angle) * spread;
      const pz = z + Math.sin(angle) * spread;
      if (isOverCampusRoute(px, pz)) continue;
      transforms.position.set(px, groundY(px, pz) + 0.12, pz);
      transforms.rotation.set(0.24, angle, 0.2);
      transforms.scale.set(0.73, 0.54 + i * 0.035, 0.73);
      transforms.updateMatrix();
      shoots.setMatrixAt(shooting, transforms.matrix);
      shoots.setColorAt(shooting++, color.setHex(i % 2 ? 0x738e39 : 0x3c642a));
      if (i % 5 !== 2) continue;
      transforms.position.y += 0.15;
      transforms.scale.set(1.35, 0.48, 1.35);
      transforms.updateMatrix();
      buds.setMatrixAt(flowering, transforms.matrix);
      buds.setColorAt(flowering++, color.setHex(i < 5 ? 0xffe5b6 : 0xe5a479));
    }
  }
  for (const [plants, count] of [[shoots, shooting], [buds, flowering]]) {
    plants.count = count;
    plants.receiveShadow = true;
    plants.userData.ignoreRay = true;
    plants.computeBoundingSphere();
    scene.add(plants);
  }
}

export function buildCampusRoutes(scene, groundY) {
  const dirt = new THREE.MeshStandardMaterial({ map: getGroundTextures().dirt, vertexColors: true, roughness: 0.97 });
  const paving = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  dirt.userData.keepPbr = true;
  for (const route of getRoutes()) {
    const path = makeRibbon(route, groundY, route.surface ? paving : dirt);
    path.name = 'Campus path ' + route.id;
    scene.add(path);
  }
  const paint = new THREE.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.94 });
  for (const { x, z, eastWest } of CAMPUS_CROSSINGS) {
    for (let i = -3; i <= 3; i++) {
      const line = makeBox(eastWest ? 0.47 : 2.2, 0.004, eastWest ? 2.2 : 0.47, paint, { noShadow: true });
      line.position.set(x + (eastWest ? i * 0.99 : 0), 0.035, z + (eastWest ? 0 : i * 1.03));
      line.userData.ignoreRay = true;
      scene.add(line);
    }
  }
  addWoodlandDetails(scene, groundY);
}
