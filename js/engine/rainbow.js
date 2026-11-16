/**
 * MycoCampus3D — Arco-íris 3D Procedural sobre a Montanha
 */
const THREE = window.THREE;

export function createRainbowMesh() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, 'rgba(139, 92, 246, 0)');
  grad.addColorStop(0.08, 'rgba(139, 92, 246, 0.85)');
  grad.addColorStop(0.22, 'rgba(59, 130, 246, 0.88)');
  grad.addColorStop(0.36, 'rgba(6, 182, 212, 0.90)');
  grad.addColorStop(0.50, 'rgba(34, 197, 94, 0.90)');
  grad.addColorStop(0.66, 'rgba(234, 179, 8, 0.92)');
  grad.addColorStop(0.80, 'rgba(249, 115, 22, 0.90)');
  grad.addColorStop(0.92, 'rgba(239, 68, 68, 0.85)');
  grad.addColorStop(1.00, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const maskGrad = ctx.createLinearGradient(0, 0, 256, 0);
  maskGrad.addColorStop(0.00, 'rgba(0,0,0,0)');
  maskGrad.addColorStop(0.14, 'rgba(0,0,0,1)');
  maskGrad.addColorStop(0.86, 'rgba(0,0,0,1)');
  maskGrad.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = maskGrad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  const innerR = 72;
  const outerR = 92;
  const segs = 64;
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = Math.PI * (1 - t);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(cos * innerR, sin * innerR, 0);
    uvs.push(t, 0);
    positions.push(cos * outerR, sin * outerR, 0);
    uvs.push(t, 1);
  }
  for (let j = 0; j < segs; j++) {
    const a = j * 2;
    const b = j * 2 + 1;
    const cIdx = (j + 1) * 2;
    const d = (j + 1) * 2 + 1;
    indices.push(a, b, cIdx);
    indices.push(cIdx, b, d);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(12, 16, -145);
  mesh.rotation.y = 0.12;
  mesh.visible = false;
  mesh.renderOrder = 2;
  return mesh;
}

export function stepRainbow(mesh, state, dt, weatherMode, envTime) {
  if (!mesh) return;
  if (state.active) {
    state.timer += dt;
    let rOpacity = 0;
    if (state.timer < 8.0) {
      rOpacity = (state.timer / 8.0) * 0.78;
    } else if (state.timer > (state.duration - 12.0)) {
      rOpacity = Math.max(0, (state.duration - state.timer) / 12.0) * 0.78;
    } else {
      rOpacity = 0.75 + Math.sin(envTime * 1.5) * 0.04;
    }
    if (state.timer >= state.duration || weatherMode === 'rain' || weatherMode === 'snow') {
      state.active = false;
      rOpacity = 0;
    }
    mesh.material.opacity = rOpacity;
    mesh.visible = rOpacity > 0.005;
  } else if (mesh.visible) {
    mesh.visible = false;
    mesh.material.opacity = 0;
  }
}
