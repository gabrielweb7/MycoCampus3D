export function buildSnowboardRig(ctx) {
  if (ctx.getSnowboardGroup()) return;
  var snowboardGroup = new THREE.Group();

  // Textura estilizada de snowboard gradiente (ciano -> roxo -> rosa)
  var sbCanvas = document.createElement('canvas');
  sbCanvas.width = 256; sbCanvas.height = 64;
  var sbx = sbCanvas.getContext('2d');
  var grd = sbx.createLinearGradient(0, 0, 256, 64);
  grd.addColorStop(0, '#06b6d4');
  grd.addColorStop(0.5, '#6366f1');
  grd.addColorStop(1, '#ec4899');
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
  var deck = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.028, 1.38), deckMat);
  deck.position.y = 0.02;
  deck.castShadow = true;

  // Bicos levantados (rocker frontal e traseiro)
  var nose = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 0.24), deckMat);
  nose.position.set(0, 0.055, -0.76);
  nose.rotation.x = 0.34;
  var tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 0.24), deckMat);
  tail.position.set(0, 0.055, 0.76);
  tail.rotation.x = -0.34;

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

  snowboardGroup.add(deck, nose, tail);
  snowboardGroup.visible = false;
  ctx.scene.add(snowboardGroup);
  ctx.setSnowboardGroup(snowboardGroup);
}
