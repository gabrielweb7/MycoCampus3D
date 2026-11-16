/**
 * Placa de Petri (MycoCampus3D)
 */

const THREE = window.THREE;
const PETRI_SIDE_RADIUS = 0.06;
const PETRI_AGAR_RADIUS = 0.055;

export const PETRI_DISH_RADIUS = 0.062;
export const PETRI_DISH_HEIGHT = 0.024;
export const PETRI_STACK_SPACING = 0.026;
export const PETRI_STACK_ALIGNMENT_RADIUS = 0.08;
export const PETRI_STACK_AIM_DISTANCE_SQ = 0.0064;

export function getPetriMeta(mode) {
  const isBare = mode === 'bare';
  return {
    category: 'culture_plate',
    purpose: isBare
      ? 'Placa de Petri vazia aguardando meio PDA'
      : (mode === 'filled'
        ? 'Placa com meio PDA/BDA aguardando esterilização'
        : (mode === 'empty' ? 'Placa estéril com PDA pronta para inoculação' : 'Cultivo de micélio em meio sólido BDA/PDA')),
    weightGrams: isBare ? 18 : 38,
    baseTempC: mode === 'contam' ? 26.8 : 25.0,
    compatibilities: { canEnterCooker: true, receivesSyringe: mode === 'empty', acceptsPdaMedium: isBare },
    connections: ['laminar_hood', 'syringe', 'beaker_1l', 'pda_media_bottle']
  };
}

function drawAgarTexture(pctx, mode) {
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
}

export function makePetriDish(mode) {
  const pg = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.15 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(PETRI_SIDE_RADIUS, PETRI_SIDE_RADIUS, 0.018, 22, 1, true), glassMat);
  rim.position.y = 0.009;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(PETRI_DISH_RADIUS, PETRI_DISH_RADIUS, 0.006, 22), glassMat);
  lid.position.y = 0.021;

  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const pctx = c.getContext('2d');
  drawAgarTexture(pctx, mode);
  const agarTexture = mode === 'bare' ? null : new THREE.CanvasTexture(c);
  let agarMesh = null;
  if (mode !== 'bare') {
    agarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(PETRI_AGAR_RADIUS, PETRI_AGAR_RADIUS, 0.009, 22),
      new THREE.MeshStandardMaterial({ map: agarTexture, roughness: 0.35 })
    );
    agarMesh.position.y = 0.008;
    pg.add(agarMesh);
  }
  pg.add(rim, lid);
  pg.userData.isPetri = true;
  pg.userData.petriCtrl = { mode, canvas: c, context: pctx, texture: agarTexture, agarMesh };
  return pg;
}

export function updatePetriVisual(item) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl) return;
  if (ctrl.mode === 'bare') {
    if (ctrl.agarMesh) {
      item.mesh.remove(ctrl.agarMesh);
      ctrl.agarMesh = null;
    }
  } else {
    if (!ctrl.texture) ctrl.texture = new THREE.CanvasTexture(ctrl.canvas);
    if (!ctrl.agarMesh) {
      ctrl.agarMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(PETRI_AGAR_RADIUS, PETRI_AGAR_RADIUS, 0.009, 22),
        new THREE.MeshStandardMaterial({ map: ctrl.texture, roughness: 0.35 })
      );
      ctrl.agarMesh.position.y = 0.008;
      item.mesh.add(ctrl.agarMesh);
    } else if (ctrl.agarMesh.material.map !== ctrl.texture) {
      ctrl.agarMesh.material.map = ctrl.texture;
      ctrl.agarMesh.material.needsUpdate = true;
    }
  }
  drawAgarTexture(ctrl.context, ctrl.mode);
  if (ctrl.texture) ctrl.texture.needsUpdate = true;
  if (item.meta && item.meta.compatibilities) {
    item.meta.compatibilities.receivesSyringe = ctrl.mode === 'empty';
    item.meta.compatibilities.acceptsPdaMedium = ctrl.mode === 'bare';
  }
  if (item.meta) {
    item.meta.baseTempC = ctrl.mode === 'contam' ? 26.8 : 25.0;
    item.meta.purpose = ctrl.mode === 'bare'
      ? 'Placa de Petri vazia aguardando meio PDA'
      : (ctrl.mode === 'filled'
        ? 'Placa com meio PDA/BDA aguardando esterilização'
        : (ctrl.mode === 'empty'
          ? 'Placa estéril com PDA pronta para inoculação'
          : (ctrl.mode === 'contam' ? 'Cultivo contaminado por mofo ou bactéria' : 'Cultivo de micélio em meio sólido BDA/PDA')));
  }
  if (ctrl.mode === 'clean') {
    item.label = 'Placa de Petri (Micélio Rizomórfico)';
  } else if (ctrl.mode === 'contam') {
    item.label = 'Placa Contaminada (Mofo/Bactéria)';
  } else if (ctrl.mode === 'bare') {
    item.label = 'Placa de Petri Vazia';
  } else if (ctrl.mode === 'filled') {
    item.label = 'Placa de Petri com PDA/BDA (Não esterilizada)';
  } else {
    item.label = 'Placa de Petri Estéril (PDA)';
  }
}

export function fillPetriWithPda(item) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.mode !== 'bare') return false;
  ctrl.mode = 'filled';
  updatePetriVisual(item);
  return true;
}
