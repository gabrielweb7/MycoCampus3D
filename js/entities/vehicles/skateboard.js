let skateDeckGeo;

export function getSkateboardDeckGeometry() {
  if (skateDeckGeo) return skateDeckGeo;
  const outline = new THREE.Shape();
  outline.moveTo(-0.11, -0.34);
  outline.quadraticCurveTo(-0.125, -0.46, 0, -0.46);
  outline.quadraticCurveTo(0.125, -0.46, 0.11, -0.34);
  outline.lineTo(0.11, 0.34);
  outline.quadraticCurveTo(0.125, 0.46, 0, 0.46);
  outline.quadraticCurveTo(-0.125, 0.46, -0.11, 0.34);
  outline.closePath();
  skateDeckGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.018, bevelEnabled: false, curveSegments: 5 });
  skateDeckGeo.rotateX(-Math.PI / 2);
  const pos = skateDeckGeo.attributes.position;
  const uv = skateDeckGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setY(i, pos.getY(i) + 1.8 * Math.max(0, Math.abs(z) - 0.32) ** 2);
    uv.setXY(i, 0.5 + z / 0.94, 0.5 + pos.getX(i) / 0.26);
  }
  skateDeckGeo.computeVertexNormals();
  skateDeckGeo.userData.shared = true;
  return skateDeckGeo;
}

export function createSkateboardMesh() {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 256, 64);
  grd.addColorStop(0, '#1e293b');
  grd.addColorStop(0.5, '#0f172a');
  grd.addColorStop(1, '#312e81');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#38bdf8';
  g.fillRect(28, 6, 200, 4);
  g.fillStyle = '#f472b6';
  g.fillRect(28, 54, 200, 4);
  g.font = 'bold 18px sans-serif';
  g.fillStyle = '#e2e8f0';
  g.textAlign = 'center';
  g.fillText('MYCOSKATE', 128, 38);
  const tex = new THREE.CanvasTexture(canvas);

  const deckMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0.1 });
  const truckMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.7 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 });

  const deck = new THREE.Mesh(getSkateboardDeckGeometry(), deckMat);
  deck.position.y = 0.085;
  deck.castShadow = true;
  group.add(deck);

  const wheelGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.026, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const truckGeo = new THREE.BoxGeometry(0.18, 0.024, 0.036);
  [-0.25, 0.25].forEach((tz) => {
    const truck = new THREE.Mesh(truckGeo, truckMat);
    truck.position.set(0, 0.056, tz);
    group.add(truck);
    [-0.095, 0.095].forEach((wx) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, 0.032, tz);
      wheel.castShadow = true;
      group.add(wheel);
    });
  });
  return group;
}

export function buildSkateboardRig(ctx) {
  if (ctx.getSkateboardGroup?.()) return;
  const skateGroup = createSkateboardMesh();
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const pantMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  [-0.18, 0.18].forEach((fz, idx) => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.10, 0.22), shoeMat);
    shoe.position.set(0, 0.145, fz);
    shoe.rotation.y = idx === 0 ? 0.35 : 0.15;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.12), pantMat);
    shin.position.set(0.01, 0.35, fz * 0.9);
    skateGroup.add(shoe, shin);
  });
  skateGroup.visible = false;
  ctx.scene.add(skateGroup);
  ctx.setSkateboardGroup?.(skateGroup);
}
