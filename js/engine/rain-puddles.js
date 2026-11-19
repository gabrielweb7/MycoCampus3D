/**
 * Poças de Chuva na Praça (MycoCampus3D) — 1 único draw call via InstancedMesh
 * Fica 100% invisível (custo zero) quando o piso está seco.
 */

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;

const PUDDLE_SPOTS = [
  { x: 0.2, z: 15.6, rx: 1.55, rz: 1.25 },
  { x: -5.4, z: 9.6, rx: 1.25, rz: 1.05 },
  { x: 6.1, z: 11.4, rx: 1.35, rz: 1.15 },
  { x: -7.2, z: 21.0, rx: 1.65, rz: 1.20 },
  { x: 8.4, z: 24.5, rx: 1.40, rz: 1.10 },
  { x: -3.2, z: 29.0, rx: 1.50, rz: 1.30 },
  { x: 3.4, z: 33.2, rx: 1.35, rz: 1.05 },
  { x: 11.4, z: 32.0, rx: 1.45, rz: 1.15 }
];

let _dummy = null;

function ensureDummy() {
  if (_dummy) return _dummy;
  const T = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || THREE;
  if (T && T.Object3D) {
    _dummy = new T.Object3D();
  }
  return _dummy;
}

export function createRainPuddles(scene) {
  if (!THREE || !scene || !THREE.InstancedMesh) return null;

  const geo = new THREE.CircleGeometry(1, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.82,
    roughness: 0.05,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  mat.userData.keepPbr = true;
  mat.userData.shared = true;

  const inst = new THREE.InstancedMesh(geo, mat, PUDDLE_SPOTS.length);
  inst.visible = false;
  inst.frustumCulled = false;
  inst.userData.isDynamic = true;
  inst.userData.keepDynamic = true;

  for (let i = 0; i < PUDDLE_SPOTS.length; i++) {
    const p = PUDDLE_SPOTS[i];
    _dummy.position.set(p.x, 0.024, p.z);
    _dummy.rotation.set(-Math.PI / 2, 0, i * 0.7);
    _dummy.scale.set(p.rx, p.rz, 1);
    _dummy.updateMatrix();
    inst.setMatrixAt(i, _dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  return {
    inst,
    mat,
    wetness: 0,
    lastAppliedScale: -1
  };
}

export function stepRainPuddles(ctrl, weatherMode, dt) {
  if (!ctrl || !ctrl.inst || !ctrl.mat) return;
  const target = weatherMode === 'rain' ? 1.0 : 0.0;
  const speed = weatherMode === 'rain' ? 0.22 : 0.09;
  if (target > ctrl.wetness) {
    ctrl.wetness = Math.min(1, ctrl.wetness + dt * speed);
  } else if (target < ctrl.wetness) {
    ctrl.wetness = Math.max(0, ctrl.wetness - dt * speed);
  }

  if (ctrl.wetness <= 0.01) {
    ctrl.inst.visible = false;
    return;
  }

  ctrl.inst.visible = true;
  ctrl.mat.opacity = ctrl.wetness * 0.40;
  const s = 0.35 + ctrl.wetness * 0.65;
  if (Math.abs(s - ctrl.lastAppliedScale) > 0.015) {
    ctrl.lastAppliedScale = s;
    const dummy = ensureDummy();
    if (dummy && typeof ctrl.inst.setMatrixAt === 'function') {
      for (let i = 0; i < PUDDLE_SPOTS.length; i++) {
        const p = PUDDLE_SPOTS[i];
        dummy.position.set(p.x, 0.024, p.z);
        dummy.rotation.set(-Math.PI / 2, 0, i * 0.7);
        dummy.scale.set(p.rx * s, p.rz * s, 1);
        dummy.updateMatrix();
        ctrl.inst.setMatrixAt(i, dummy.matrix);
      }
      if (ctrl.inst.instanceMatrix) {
        ctrl.inst.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
