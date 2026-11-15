/**
 * MycoCampus3D — Pool de Vetores/Objetos Reutilizáveis (Zero-GC)
 * Evita alocação de objetos Three.js dentro do loop de animação 60fps.
 */
const THREE = window.THREE;

export const tmpVec1 = THREE ? new THREE.Vector3() : null;
export const tmpVec2 = THREE ? new THREE.Vector3() : null;
export const tmpVec3 = THREE ? new THREE.Vector3() : null;
export const tmpVec4 = THREE ? new THREE.Vector3() : null;
export const tmpBox1 = THREE ? new THREE.Box3() : null;
export const tmpQuat1 = THREE ? new THREE.Quaternion() : null;

export function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
