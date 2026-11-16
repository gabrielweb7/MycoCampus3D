/**
 * Placa de Petri (MycoCampus3D)
 */

const THREE = window.THREE;

export function getPetriMeta(mode) {
  const isBare = mode === 'bare';
  return {
    category: 'culture_plate',
    purpose: isBare ? 'Placa de Petri vazia aguardando meio PDA' : 'Cultivo de micélio em meio sólido BDA/PDA',
    weightGrams: isBare ? 18 : 38,
    baseTempC: mode === 'contam' ? 26.8 : 25.0,
    compatibilities: { canEnterCooker: true, receivesSyringe: !isBare },
    connections: ['laminar_hood', 'syringe', 'pda_bottle']
  };
}

export function makePetriDish(mode) {
  const pg = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.15 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.048, 22, 1, true), glassMat);
  rim.position.y = 0.024;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.012, 22), glassMat);
  lid.position.y = 0.048;

  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const pctx = c.getContext('2d');
  pctx.fillStyle = mode === 'contam' ? '#d9b36c' : '#efe7d2';
  pctx.fillRect(0, 0, 256, 256);
  if (mode === 'clean') {
    pctx.strokeStyle = 'rgba(255,255,255,0.88)';
    pctx.lineWidth = 1.6;
    for (let a = 0; a < 110; a++) {
      const ang = (a / 110) * Math.PI * 2;
      const rEnd = 88 + Math.sin(a * 7) * 14;
      pctx.beginPath();
      pctx.moveTo(128, 128);
      pctx.quadraticCurveTo(128 + Math.cos(ang + 0.12) * rEnd * 0.55, 128 + Math.sin(ang + 0.12) * rEnd * 0.55, 128 + Math.cos(ang) * rEnd, 128 + Math.sin(ang) * rEnd);
      pctx.stroke();
    }
    pctx.fillStyle = '#f8fafc';
    pctx.beginPath(); pctx.moveTo(120, 120); pctx.lineTo(138, 122); pctx.lineTo(128, 138); pctx.closePath(); pctx.fill();
  } else if (mode === 'contam') {
    pctx.fillStyle = '#4a3f28';
    pctx.beginPath(); pctx.arc(88, 132, 62, 0, Math.PI * 2); pctx.fill();
    pctx.fillStyle = '#1c1917';
    pctx.beginPath(); pctx.arc(86, 134, 24, 0, Math.PI * 2); pctx.fill();
    pctx.fillStyle = '#e7dcc8';
    pctx.beginPath(); pctx.arc(174, 118, 44, 0, Math.PI * 2); pctx.fill();
  }
  if (mode !== 'bare') {
    const agarTex = new THREE.CanvasTexture(c);
    const agar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.156, 0.156, 0.022, 22),
      new THREE.MeshStandardMaterial({ map: agarTex, roughness: 0.35 })
    );
    agar.position.y = 0.015;
    pg.add(agar);
  }
  pg.add(rim, lid);
  pg.userData.isPetri = true;
  return pg;
}
