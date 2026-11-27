import { makeRoundedRectShape } from './item-registry.js';

const THREE = window.THREE;

export function makeChamferedBox(width, height, depth, bevel, colorOrMaterial) {
  const shape = makeRoundedRectShape(width - 2 * bevel, depth - 2 * bevel, bevel);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height - 2 * bevel, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, curveSegments: 2
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel - height / 2, 0);
  const material = colorOrMaterial?.isMaterial ? colorOrMaterial :
    new THREE.MeshStandardMaterial({ color: colorOrMaterial, roughness: 0.76 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
