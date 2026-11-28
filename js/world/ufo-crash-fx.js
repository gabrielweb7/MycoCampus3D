const THREE = window.THREE;

export function makeUfoCrashFx(scene) {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const pose = new THREE.Object3D();

  function pool(count, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const particles = Array.from({ length: count }, () => ({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), age: Infinity
    }));
    return { mesh, particles, index: 0 };
  }

  const flame = pool(18, new THREE.MeshBasicMaterial({ color: 0xff6d27, toneMapped: false }));
  const smoke = pool(24, new THREE.MeshStandardMaterial({ color: 0x46464e, roughness: 1 }));
  let untilNext = 0;

  function emit(target, position, hot) {
    const particle = target.particles[target.index++ % target.particles.length];
    particle.position.copy(position);
    particle.position.x += (Math.random() - 0.5) * 1.7;
    particle.position.z += (Math.random() - 0.5) * 1.7;
    particle.position.y += 0.38;
    particle.velocity.set((Math.random() - 0.34) * 0.85, (hot ? 1.4 : 1.0) + Math.random() * 0.8, (Math.random() - 0.5) * 0.73);
    particle.age = 0;
  }

  function stepPool(target, dt, hot) {
    const lifetime = hot ? 0.62 : 3.1;
    let count = 0;
    for (const particle of target.particles) {
      particle.age += dt;
      if (particle.age >= lifetime) continue;
      const progress = particle.age / lifetime;
      particle.position.addScaledVector(particle.velocity, dt);
      pose.position.copy(particle.position);
      pose.rotation.set(progress * 2.5, progress * 1.6, progress);
      const size = hot ? (1 - progress) * 0.52 : (0.31 + progress * 0.8) * Math.min(1, (1 - progress) * 5);
      pose.scale.set(size, size * (hot ? 1.75 : 1.05), size);
      pose.updateMatrix();
      target.mesh.setMatrixAt(count++, pose.matrix);
    }
    target.mesh.count = count;
    if (count) target.mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    step(position, dt, burning) {
      untilNext -= dt;
      if (burning && untilNext <= 0) {
        emit(flame, position, true);
        emit(flame, position, true);
        emit(smoke, position, false);
        untilNext = 0.14;
      }
      stepPool(flame, dt, true);
      stepPool(smoke, dt, false);
    }
  };
}
