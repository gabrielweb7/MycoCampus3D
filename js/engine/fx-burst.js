/**
 * Pool leve e reutilizável de partículas 3D para feedback tátil/visual (MycoCampus3D).
 * 1 único draw call via InstancedMesh, zero alocação por frame, custo zero quando ocioso.
 */

const MAX_FX_PARTICLES = 64;
const particles = [];
let poolMesh = null;
let poolScene = null;
let _dummy = null;
let _tmpColor = null;

function getThree() {
  return (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;
}

function ensureHelpers(T) {
  if (!_dummy && T && T.Object3D) _dummy = new T.Object3D();
  if (!_tmpColor && T && T.Color) _tmpColor = new T.Color();
}

function ensurePool(scene) {
  const T = getThree();
  if (!T || !scene || !T.InstancedMesh) return null;
  if (poolMesh && poolScene === scene) return poolMesh;

  if (poolMesh) {
    if (poolMesh.parent) poolMesh.parent.remove(poolMesh);
    if (poolMesh.geometry) poolMesh.geometry.dispose();
    if (poolMesh.material) poolMesh.material.dispose();
    poolMesh = null;
    poolScene = null;
  }

  ensureHelpers(T);
  particles.length = 0;

  const geo = new T.IcosahedronGeometry(0.028, 0);
  if (geo.userData) geo.userData.shared = true;
  const mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  if (mat.userData) mat.userData.shared = true;

  const inst = new T.InstancedMesh(geo, mat, MAX_FX_PARTICLES);
  inst.visible = false;
  inst.frustumCulled = false;
  if (inst.userData) {
    inst.userData.isDynamic = true;
    inst.userData.keepDynamic = true;
  }

  if (_dummy && _tmpColor) {
    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    _tmpColor.setHex(0xffffff);
    for (let i = 0; i < MAX_FX_PARTICLES; i++) {
      inst.setColorAt(i, _tmpColor);
      inst.setMatrixAt(i, _dummy.matrix);
      particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        rot: 0, vrot: 0,
        baseScale: 1,
        life: 0,
        maxLife: 0.7
      });
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.instanceMatrix.needsUpdate = true;
  }

  scene.add(inst);
  poolMesh = inst;
  poolScene = scene;
  return inst;
}

export function spawnCampusFxBurst(scene, pos, colorHex = 0x38bdf8, count = 8) {
  const inst = ensurePool(scene);
  if (!inst || !_dummy || !_tmpColor) return;

  const px = pos && typeof pos.x === 'number' ? pos.x : 0;
  const py = pos && typeof pos.y === 'number' ? pos.y : 0;
  const pz = pos && typeof pos.z === 'number' ? pos.z : 0;
  const targetCount = Math.max(1, Math.min(MAX_FX_PARTICLES, count | 0));

  _tmpColor.setHex(typeof colorHex === 'number' ? colorHex : 0x38bdf8);

  let spawned = 0;
  for (let i = 0; i < particles.length && spawned < targetCount; i++) {
    const p = particles[i];
    if (p.active) continue;

    const ang = Math.random() * Math.PI * 2;
    const rad = 0.03 + Math.random() * 0.09;
    const speed = 0.35 + Math.random() * 0.55;

    p.active = true;
    p.x = px + Math.cos(ang) * rad;
    p.y = py + Math.random() * 0.06;
    p.z = pz + Math.sin(ang) * rad;
    p.vx = Math.cos(ang) * speed;
    p.vy = 0.85 + Math.random() * 0.75;
    p.vz = Math.sin(ang) * speed;
    p.rot = Math.random() * Math.PI * 2;
    p.vrot = (Math.random() - 0.5) * 8;
    p.baseScale = 0.75 + Math.random() * 0.5;
    p.life = 0;
    p.maxLife = 0.62 + Math.random() * 0.16;

    inst.setColorAt(i, _tmpColor);
    spawned++;
  }

  if (spawned > 0) {
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.visible = true;
  }
}

export function stepFxBursts(dt) {
  if (!poolMesh || !poolMesh.visible || !_dummy) return;
  const stepDt = Math.min(0.05, Math.max(0, dt || 0));
  let anyActive = false;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) {
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      poolMesh.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    p.life += stepDt;
    if (p.life >= p.maxLife) {
      p.active = false;
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      poolMesh.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    anyActive = true;
    p.vy -= 0.45 * stepDt;
    p.x += p.vx * stepDt;
    p.y += p.vy * stepDt;
    p.z += p.vz * stepDt;
    p.rot += p.vrot * stepDt;

    const frac = p.life / p.maxLife;
    const fadeIn = frac < 0.15 ? frac / 0.15 : 1;
    const fadeOut = Math.cos(frac * Math.PI * 0.5);
    const s = Math.max(0.001, p.baseScale * fadeIn * fadeOut);

    _dummy.position.set(p.x, p.y, p.z);
    _dummy.rotation.set(p.rot, p.rot * 0.7, 0);
    _dummy.scale.setScalar(s);
    _dummy.updateMatrix();
    poolMesh.setMatrixAt(i, _dummy.matrix);
  }

  poolMesh.instanceMatrix.needsUpdate = true;
  if (!anyActive) {
    poolMesh.visible = false;
  }
}
