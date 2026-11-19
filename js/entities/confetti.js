// Confetes Dinâmicos de Celebração em 1 Único InstancedMesh (Emotes)

const MAX_CONFETTI = 48;
const confettiParticles = [];
let confettiMesh = null;
const _confettiDummy = (typeof window !== 'undefined' && window.THREE && window.THREE.Object3D) ? new window.THREE.Object3D() : null;

export function initConfettiSystem(scene) {
  const THREE = window.THREE;
  confettiParticles.length = 0;
  const geo = new THREE.PlaneGeometry(0.09, 0.09);
  geo.userData.shared = true;
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  mat.userData.shared = true;
  const colors = [0xf43f5e, 0x3b82f6, 0x10b981, 0xfbbf24, 0xa855f7, 0x06b6d4, 0xf97316];
  const inst = new THREE.InstancedMesh(geo, mat, MAX_CONFETTI);
  inst.visible = false;
  inst.frustumCulled = false;
  inst.userData.isDynamic = true;
  const tmpColor = new THREE.Color();
  const dummy = _confettiDummy || new THREE.Object3D();
  dummy.scale.set(0, 0, 0);
  dummy.updateMatrix();
  for (let i = 0; i < MAX_CONFETTI; i++) {
    tmpColor.setHex(colors[i % colors.length]);
    inst.setColorAt(i, tmpColor);
    inst.setMatrixAt(i, dummy.matrix);
    confettiParticles.push({
      active: false,
      x: 0, y: 0, z: 0,
      rx: 0, ry: 0,
      vx: 0, vy: 0, vz: 0,
      vrx: 0, vry: 0,
      life: 0, maxLife: 2.2
    });
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
  confettiMesh = inst;
  return inst;
}

export function triggerConfettiBurst(x, y, z) {
  if (!confettiMesh) return;
  let spawnCount = 0;
  for (let i = 0; i < confettiParticles.length && spawnCount < 36; i++) {
    const p = confettiParticles[i];
    if (p.active && p.life < p.maxLife) continue;
    p.x = x + (Math.random() - 0.5) * 0.45;
    p.y = y + 1.25 + Math.random() * 0.35;
    p.z = z + (Math.random() - 0.5) * 0.45;
    p.rx = Math.random() * 3.14;
    p.ry = Math.random() * 3.14;
    const ang = Math.random() * Math.PI * 2;
    const speed = 1.6 + Math.random() * 2.8;
    p.vx = Math.cos(ang) * speed;
    p.vy = 2.4 + Math.random() * 2.8;
    p.vz = Math.sin(ang) * speed;
    p.vrx = (Math.random() - 0.5) * 12;
    p.vry = (Math.random() - 0.5) * 12;
    p.life = 0;
    p.maxLife = 1.8 + Math.random() * 0.8;
    p.active = true;
    spawnCount++;
  }
  if (spawnCount > 0) confettiMesh.visible = true;
}

export function stepConfetti(dt) {
  if (!confettiMesh || !confettiMesh.visible) return;
  const dummy = _confettiDummy || new window.THREE.Object3D();
  let anyActive = false;
  for (let i = 0; i < confettiParticles.length; i++) {
    const p = confettiParticles[i];
    if (!p.active) {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      confettiMesh.setMatrixAt(i, dummy.matrix);
      continue;
    }
    p.life += dt;
    if (p.life >= p.maxLife) {
      p.active = false;
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      confettiMesh.setMatrixAt(i, dummy.matrix);
      continue;
    }
    anyActive = true;
    p.vy -= 9.8 * dt * 0.65;
    p.vx *= 0.98;
    p.vz *= 0.98;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.rx += p.vrx * dt;
    p.ry += p.vry * dt;
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx, p.ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    confettiMesh.setMatrixAt(i, dummy.matrix);
  }
  confettiMesh.instanceMatrix.needsUpdate = true;
  if (!anyActive) confettiMesh.visible = false;
}
