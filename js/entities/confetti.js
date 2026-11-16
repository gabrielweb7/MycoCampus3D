// Confetes Dinâmicos de Celebração (Emotes)

var confettiParticles = [];

export function initConfettiSystem(scene) {
  confettiParticles.length = 0;
  var geo = new THREE.PlaneGeometry(0.09, 0.09);
  var colors = [0xf43f5e, 0x3b82f6, 0x10b981, 0xfbbf24, 0xa855f7, 0x06b6d4, 0xf97316];
  for (var i = 0; i < 48; i++) {
    var mat = new THREE.MeshBasicMaterial({
      color: colors[i % colors.length],
      side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    confettiParticles.push({
      mesh: mesh,
      vx: 0, vy: 0, vz: 0,
      vrx: 0, vry: 0,
      life: 0, maxLife: 2.2
    });
  }
}

export function triggerConfettiBurst(x, y, z) {
  var spawnCount = 0;
  for (var i = 0; i < confettiParticles.length && spawnCount < 36; i++) {
    var p = confettiParticles[i];
    if (p.mesh.visible && p.life < p.maxLife) continue;
    p.mesh.position.set(
      x + (Math.random() - 0.5) * 0.45,
      y + 1.25 + Math.random() * 0.35,
      z + (Math.random() - 0.5) * 0.45
    );
    var ang = Math.random() * Math.PI * 2;
    var speed = 1.6 + Math.random() * 2.8;
    p.vx = Math.cos(ang) * speed;
    p.vy = 2.4 + Math.random() * 2.8;
    p.vz = Math.sin(ang) * speed;
    p.vrx = (Math.random() - 0.5) * 12;
    p.vry = (Math.random() - 0.5) * 12;
    p.life = 0;
    p.maxLife = 1.8 + Math.random() * 0.8;
    p.mesh.visible = true;
    spawnCount++;
  }
}

export function stepConfetti(dt) {
  for (var i = 0; i < confettiParticles.length; i++) {
    var p = confettiParticles[i];
    if (!p.mesh.visible) continue;
    p.life += dt;
    if (p.life >= p.maxLife) {
      p.mesh.visible = false;
      continue;
    }
    p.vy -= 9.8 * dt * 0.65;
    p.vx *= 0.98;
    p.vz *= 0.98;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += p.vrx * dt;
    p.mesh.rotation.y += p.vry * dt;
  }
}
