/**
 * Frasco de Agar BDA / PDA 500g (MycoCampus3D)
 */

const THREE = window.THREE;

export function createPdaBottleGroup() {
  const pdaGroup = new THREE.Group();
  const hdpeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.05 });
  const pdaBody = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.21, 28), hdpeMat);
  pdaBody.position.y = 0.105;
  pdaBody.castShadow = true;
  const pdaShoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.102, 0.038, 28), hdpeMat);
  pdaShoulder.position.y = 0.228;
  const pdaNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.024, 24), hdpeMat);
  pdaNeck.position.y = 0.255;

  const pdaC = document.createElement('canvas');
  pdaC.width = 512; pdaC.height = 256;
  const pdaCtx = pdaC.getContext('2d');
  pdaCtx.fillStyle = '#ffffff';
  pdaCtx.fillRect(0, 0, 512, 256);
  [0, 256].forEach(function (ox) {
    pdaCtx.fillStyle = '#f8fafc';
    pdaCtx.fillRect(ox + 10, 8, 236, 240);
    pdaCtx.strokeStyle = '#cbd5e1';
    pdaCtx.lineWidth = 3;
    pdaCtx.strokeRect(ox + 10, 8, 236, 240);
    pdaCtx.fillStyle = '#0284c7';
    pdaCtx.fillRect(ox + 12, 10, 232, 38);
    pdaCtx.fillStyle = '#ffffff';
    pdaCtx.font = 'bold 17px system-ui, sans-serif';
    pdaCtx.textAlign = 'center';
    pdaCtx.fillText('🧪 MYCOLAB • REAGENTE', ox + 128, 35);
    pdaCtx.fillStyle = '#0f172a';
    pdaCtx.font = '900 32px system-ui, sans-serif';
    pdaCtx.fillText('BDA / PDA', ox + 128, 86);
    pdaCtx.fillStyle = '#0369a1';
    pdaCtx.font = 'bold 20px system-ui, sans-serif';
    pdaCtx.fillText('POTATO DEXTROSE', ox + 128, 118);
    pdaCtx.fillText('AGAR • MEIO SÓLIDO', ox + 128, 144);
    pdaCtx.fillStyle = '#059669';
    pdaCtx.fillRect(ox + 28, 162, 200, 32);
    pdaCtx.fillStyle = '#ffffff';
    pdaCtx.font = 'bold 17px system-ui, sans-serif';
    pdaCtx.fillText('CULTIVO DE COGUMELOS', ox + 128, 184);
    pdaCtx.fillStyle = '#334155';
    pdaCtx.font = 'bold 21px system-ui, sans-serif';
    pdaCtx.fillText('PESO LÍQ. 500g  •  pH 5.6', ox + 128, 222);
    pdaCtx.fillStyle = '#ea580c';
    pdaCtx.fillRect(ox + 12, 236, 232, 10);
  });
  const pdaLabelTex = new THREE.CanvasTexture(pdaC);
  pdaLabelTex.anisotropy = 4;
  const pdaLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1035, 0.1035, 0.175, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: pdaLabelTex, roughness: 0.32 })
  );
  pdaLabel.position.y = 0.105;

  const capMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32 });
  const pdaCap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.080, 0.056, 24), capMat);
  pdaCap.position.y = 0.285;
  const pdaSealRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.010, 24),
    new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.4 })
  );
  pdaSealRing.position.y = 0.254;
  pdaGroup.add(pdaBody, pdaShoulder, pdaNeck, pdaLabel, pdaCap, pdaSealRing);
  return pdaGroup;
}
