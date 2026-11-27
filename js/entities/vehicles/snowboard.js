let deckGeometry;
export function getSnowboardDeckGeometry() {
  if (deckGeometry) return deckGeometry;
  const outline = new THREE.Shape();
  outline.moveTo(-0.15, -0.58);
  outline.quadraticCurveTo(-0.17, -0.86, 0, -0.86);
  outline.quadraticCurveTo(0.17, -0.86, 0.15, -0.58);
  outline.quadraticCurveTo(0.128, 0, 0.15, 0.58);
  outline.quadraticCurveTo(0.17, 0.86, 0, 0.86);
  outline.quadraticCurveTo(-0.17, 0.86, -0.15, 0.58);
  outline.quadraticCurveTo(-0.128, 0, -0.15, -0.58);
  deckGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.022, bevelEnabled: false, curveSegments: 5 });
  deckGeometry.rotateX(-Math.PI / 2);
  const position = deckGeometry.attributes.position;
  const uv = deckGeometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    position.setY(i, position.getY(i) + 1.6 * Math.max(0, Math.abs(z) - 0.62) ** 2);
    uv.setXY(i, 0.5 + z / 1.73, 0.5 + position.getX(i) / 0.33);
  }
  deckGeometry.computeVertexNormals();
  deckGeometry.userData.shared = true;
  return deckGeometry;
}

export function buildSnowboardRig(ctx) {
  if (ctx.getSnowboardGroup()) return;
  var snowboardGroup = new THREE.Group();

  // Textura estilizada de snowboard gradiente (ciano -> roxo -> rosa)
  var sbCanvas = document.createElement('canvas');
  sbCanvas.width = 256; sbCanvas.height = 64;
  var sbx = sbCanvas.getContext('2d');
  var grd = sbx.createLinearGradient(0, 0, 256, 64);
  grd.addColorStop(0, '#84c5b5');
  grd.addColorStop(0.5, '#708da4');
  grd.addColorStop(1, '#ba8ca4');
  sbx.fillStyle = grd;
  sbx.fillRect(0, 0, 256, 64);
  sbx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  sbx.fillRect(42, 6, 172, 10);
  sbx.fillRect(42, 48, 172, 10);
  sbx.font = 'bold 20px sans-serif';
  sbx.fillStyle = '#ffffff';
  sbx.textAlign = 'center';
  sbx.fillText('MYCORIDE PRO', 128, 39);
  var sbTex = new THREE.CanvasTexture(sbCanvas);

  var deckMat = new THREE.MeshStandardMaterial({ map: sbTex, roughness: 0.25, metalness: 0.2 });
  var darkBootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
  var pantMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });

  // Prancha principal
  var deck = new THREE.Mesh(getSnowboardDeckGeometry(), deckMat);
  deck.position.y = 0.02;
  deck.castShadow = true;

  // Fixações e botas em posição lateral de snowboarder
  [-0.28, 0.28].forEach(function (fz, idx) {
    var binding = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.16), darkBootMat);
    binding.position.set(0, 0.048, fz);
    binding.rotation.y = idx === 0 ? 0.48 : 0.25;

    var boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.24), darkBootMat);
    boot.position.set(0.02, 0.12, fz);
    boot.rotation.y = idx === 0 ? 0.48 : 0.25;

    var shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.14), pantMat);
    shin.position.set(0.03, 0.34, fz * 0.92);
    shin.rotation.x = idx === 0 ? 0.16 : -0.16;

    snowboardGroup.add(binding, boot, shin);
  });

  snowboardGroup.add(deck);
  snowboardGroup.visible = false;
  ctx.scene.add(snowboardGroup);
  ctx.setSnowboardGroup(snowboardGroup);
}
