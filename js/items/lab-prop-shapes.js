import { makeRoundedRectShape } from './item-registry.js';

const THREE = window.THREE;

function makeSideProfileGeometry(points, width, bevel) {
  const shape = new THREE.Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - 2 * bevel, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2 - bevel, 0, 0);
  return geometry;
}

export function makeSideProfile(points, width, bevel, material) {
  const geometry = makeSideProfileGeometry(points, width, bevel);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function makeChamferedGeometry(width, height, depth, bevel) {
  const shape = makeRoundedRectShape(width - 2 * bevel, depth - 2 * bevel, bevel);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - 2 * bevel, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, curveSegments: 2
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel - height / 2, 0);
  return geometry;
}

export function makeChamferedBox(width, height, depth, bevel, colorOrMaterial) {
  const geometry = makeChamferedGeometry(width, height, depth, bevel);
  const material = colorOrMaterial?.isMaterial ? colorOrMaterial :
    new THREE.MeshStandardMaterial({ color: colorOrMaterial, roughness: 0.76 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function makePouchGeometry(width, height, depth) {
  const half = depth / 2;
  const low = -height / 2;
  const high = height / 2;
  const bevel = Math.min(width, height, depth) * 0.06;
  return makeSideProfileGeometry([
    [-half * 0.74, low + bevel], [-half + bevel, low + height * 0.12],
    [-half + bevel, low + height * 0.64], [-half * 0.28, high - bevel],
    [half * 0.28, high - bevel], [half - bevel, low + height * 0.64],
    [half - bevel, low + height * 0.12], [half * 0.74, low + bevel]
  ], width, bevel);
}

export function makePouch(width, height, depth, material) {
  const mesh = new THREE.Mesh(makePouchGeometry(width, height, depth), material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
