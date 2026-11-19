/**
 * Placa de Petri (MycoCampus3D)
 */

import { isAsepticWorkArea, getAsepticWorkAreaReason } from './laminar-hood.js';
import {
  CULTURE_GAME_DAY_SECONDS,
  CULTURE_REFRIGERATED_SHELF_LIFE_DAYS,
  CULTURE_ROOM_SHELF_LIFE_DAYS,
  createCultureLifecycleState,
  getCultureRemainingDays,
  isCultureIncubationTemperatureSuitable,
  stepCultureShelfLife
} from './culture-lifecycle.js';

const THREE = window.THREE;
const PETRI_SIDE_RADIUS = 0.06;
const PETRI_AGAR_RADIUS = 0.055;
const PETRI_LID_THICKNESS = 0.006;
const PETRI_LID_OPEN_ANGLE = 1.42;
const PETRI_LID_ANIMATION_SECONDS = 0.32;

export const PETRI_DISH_RADIUS = 0.062;
export const PETRI_DISH_HEIGHT = 0.024;
export const PETRI_OPEN_HEIGHT = 0.085;
export const PETRI_STACK_SPACING = 0.026;
export const PETRI_STACK_ALIGNMENT_RADIUS = 0.08;
export const PETRI_STACK_AIM_DISTANCE_SQ = 0.0064;
export const PETRI_GAME_DAY_SECONDS = CULTURE_GAME_DAY_SECONDS;
export const PETRI_ROOM_SHELF_LIFE_DAYS = CULTURE_ROOM_SHELF_LIFE_DAYS;
export const PETRI_REFRIGERATED_SHELF_LIFE_DAYS = CULTURE_REFRIGERATED_SHELF_LIFE_DAYS;

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
    getTempC: (item) => {
      const p = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
      if (p && typeof p.tempC === 'number') return p.tempC;
      return (p && p.refrigerated) ? 4.0 : (mode === 'contam' ? 26.8 : 25.0);
    },
    compatibilities: {
      canEnterCooker: mode === 'filled',
      receivesSyringe: false,
      acceptsPdaMedium: isBare,
      receivesMyceliumCut: false
    },
    connections: ['laminar_hood', 'syringe', 'beaker_1l', 'pda_media_bottle']
  };
}

function drawAgarTexture(pctx, ctrl) {
  const mode = ctrl.mode;
  pctx.clearRect(0, 0, 256, 256);
  if (mode === 'contam') {
    pctx.fillStyle = '#c99e4c';
  } else {
    const amberGrad = pctx.createRadialGradient(128, 128, 16, 128, 128, 128);
    amberGrad.addColorStop(0, '#eab949');
    amberGrad.addColorStop(1, '#cf9428');
    pctx.fillStyle = amberGrad;
  }
  pctx.fillRect(0, 0, 256, 256);
  if (mode === 'clean' || mode === 'colonizing') {
    const progress = mode === 'clean' ? 100 : Math.max(0, Math.min(100, ctrl.colonization || 0));
    const radius = mode === 'clean' ? 128 : (10 + (progress / 100) * 118);
    pctx.save();
    pctx.beginPath();
    pctx.arc(128, 128, radius, 0, Math.PI * 2);
    pctx.clip();
    pctx.fillStyle = '#f8fafc';
    pctx.fillRect(0, 0, 256, 256);
    pctx.strokeStyle = 'rgba(226,232,240,0.92)';
    pctx.lineWidth = 1.6;
    for (let a = 0; a < 110; a++) {
      const ang = (a / 110) * Math.PI * 2;
      const rEnd = Math.min(radius, 58 + Math.sin(a * 7) * 14);
      pctx.beginPath();
      pctx.moveTo(128, 128);
      pctx.quadraticCurveTo(128 + Math.cos(ang + 0.12) * rEnd * 0.55, 128 + Math.sin(ang + 0.12) * rEnd * 0.55, 128 + Math.cos(ang) * rEnd, 128 + Math.sin(ang) * rEnd);
      pctx.stroke();
    }
    pctx.restore();
    // Quadradinho branco inicial do fragmento transferido no centro do PDA âmbar
    if (mode === 'colonizing' && ctrl.inoculationMethod === 'mycelium' && progress < 35) {
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(118, 118, 20, 20);
      pctx.strokeStyle = '#cbd5e1';
      pctx.lineWidth = 1.2;
      pctx.strokeRect(118, 118, 20, 20);
    }
    const cuts = Math.min(4, ctrl.cutWedges || 0);
    if (cuts > 0) {
      const offsets = [[154, 96], [88, 152], [156, 154], [92, 92]];
      for (let ci = 0; ci < cuts; ci++) {
        const [cx, cy] = offsets[ci];
        pctx.fillStyle = '#cf9428';
        pctx.fillRect(cx - 12, cy - 12, 24, 24);
        pctx.strokeStyle = '#92400e';
        pctx.lineWidth = 1.5;
        pctx.strokeRect(cx - 12, cy - 12, 24, 24);
      }
    }
  } else if (mode === 'contam') {
    pctx.fillStyle = '#4a3f28';
    pctx.beginPath(); pctx.arc(88, 132, 62, 0, Math.PI * 2); pctx.fill();
    pctx.fillStyle = '#1c1917';
    pctx.beginPath(); pctx.arc(86, 134, 24, 0, Math.PI * 2); pctx.fill();
    pctx.fillStyle = '#e7dcc8';
    pctx.beginPath(); pctx.arc(174, 118, 44, 0, Math.PI * 2); pctx.fill();
  }
}

let sharedPetriAssets = null;
function getPetriAssets() {
  if (!sharedPetriAssets) {
    const rimGeo = new THREE.CylinderGeometry(PETRI_SIDE_RADIUS, PETRI_SIDE_RADIUS, 0.018, 22, 1, true);
    rimGeo.translate(0, 0.009, 0);
    const botGeo = new THREE.CylinderGeometry(PETRI_SIDE_RADIUS, PETRI_SIDE_RADIUS, 0.003, 22);
    botGeo.translate(0, 0.0015, 0);
    let bodyGeo = null;
    if (THREE.mergeGeometries) {
      const rNon = rimGeo.index ? rimGeo.toNonIndexed() : rimGeo;
      const bNon = botGeo.index ? botGeo.toNonIndexed() : botGeo;
      bodyGeo = THREE.mergeGeometries([rNon, bNon], false);
      if (rNon !== rimGeo) rNon.dispose();
      if (bNon !== botGeo) bNon.dispose();
      rimGeo.dispose();
      botGeo.dispose();
    }
    sharedPetriAssets = {
      bodyGeo,
      rimGeo: bodyGeo ? null : rimGeo,
      botGeo: bodyGeo ? null : botGeo,
      hitboxGeo: new THREE.CylinderGeometry(PETRI_DISH_RADIUS, PETRI_DISH_RADIUS, 0.022, 14),
      lidGeo: new THREE.CylinderGeometry(PETRI_DISH_RADIUS, PETRI_DISH_RADIUS, PETRI_LID_THICKNESS, 22),
      agarGeo: new THREE.CylinderGeometry(PETRI_AGAR_RADIUS, PETRI_AGAR_RADIUS, 0.009, 22),
      parafilmGeo: new THREE.CylinderGeometry(PETRI_DISH_RADIUS + 0.0018, PETRI_DISH_RADIUS + 0.0018, 0.011, 22, 1, true),
      glassMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0.15 }),
      hitboxMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      parafilmMat: new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.58, roughness: 0.25, side: THREE.DoubleSide })
    };
  }
  return sharedPetriAssets;
}

function ensurePetriCanvas(ctrl) {
  if (ctrl.canvas) return;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  ctrl.canvas = c;
  ctrl.context = c.getContext('2d');
}

export function makePetriDish(mode) {
  const A = getPetriAssets();
  const pg = new THREE.Group();
  let bodyMesh = null;
  if (A.bodyGeo) {
    bodyMesh = new THREE.Mesh(A.bodyGeo, A.glassMat);
  } else {
    const rim = new THREE.Mesh(A.rimGeo, A.glassMat);
    const dishBottom = new THREE.Mesh(A.botGeo, A.glassMat);
    pg.add(rim, dishBottom);
  }
  const pickHitbox = new THREE.Mesh(A.hitboxGeo, A.hitboxMat);
  pickHitbox.visible = false;
  pickHitbox.position.y = 0.011;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-PETRI_DISH_RADIUS, 0.021, 0);
  const lid = new THREE.Mesh(A.lidGeo, A.glassMat);
  lid.position.x = PETRI_DISH_RADIUS;
  lidPivot.add(lid);

  const isColonized = mode === 'clean';
  const ctrl = {
    mode,
    canvas: null,
    context: null,
    texture: null,
    agarMesh: null,
    lidPivot,
    lidOpen: false,
    lidProgress: 0,
    lidAnimationFrom: 0,
    lidAnimationTo: 0,
    lidAnimationElapsed: PETRI_LID_ANIMATION_SECONDS,
    lidAnimationDuration: PETRI_LID_ANIMATION_SECONDS,
    sterilized: mode === 'empty' || mode === 'clean',
    inoculated: isColonized,
    parafilmSealed: false,
    parafilmMesh: null,
    inoculationMethod: isColonized ? 'mycelium' : '',
    colonization: isColonized ? 100 : 0,
    ...createCultureLifecycleState(isColonized),
    contaminated: mode === 'contam',
    lastRenderedColonization: -1
  };
  if (mode !== 'bare') {
    ensurePetriCanvas(ctrl);
    ctrl.texture = new THREE.CanvasTexture(ctrl.canvas);
    drawAgarTexture(ctrl.context, ctrl);
    ctrl.agarMesh = new THREE.Mesh(
      A.agarGeo,
      new THREE.MeshStandardMaterial({ map: ctrl.texture, roughness: 0.35 })
    );
    ctrl.agarMesh.position.y = 0.008;
    pg.add(ctrl.agarMesh);
  }
  const parafilmRing = new THREE.Mesh(A.parafilmGeo, A.parafilmMat);
  parafilmRing.position.y = 0.017;
  parafilmRing.visible = false;
  ctrl.parafilmMesh = parafilmRing;
  if (bodyMesh) pg.add(bodyMesh);
  pg.add(pickHitbox, lidPivot, parafilmRing);
  pg.userData.isPetri = true;
  pg.userData.petriCtrl = ctrl;
  return pg;
}

function updateLidPose(ctrl) {
  if (!ctrl || !ctrl.lidPivot) return;
  ctrl.lidPivot.rotation.z = PETRI_LID_OPEN_ANGLE * ctrl.lidProgress;
}

export function setPetriLidOpen(item, open, immediate) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.lidOpen === !!open) return false;
  ctrl.lidOpen = !!open;
  if (ctrl.lidOpen && ctrl.parafilmSealed) {
    ctrl.parafilmSealed = false;
  }
  ctrl.lidAnimationFrom = ctrl.lidProgress;
  ctrl.lidAnimationTo = ctrl.lidOpen ? 1 : 0;
  ctrl.lidAnimationElapsed = 0;
  if (immediate) {
    ctrl.lidProgress = ctrl.lidAnimationTo;
    ctrl.lidAnimationElapsed = ctrl.lidAnimationDuration;
  }
  updateLidPose(ctrl);
  item.height = ctrl.lidOpen ? PETRI_OPEN_HEIGHT : PETRI_DISH_HEIGHT;
  updatePetriVisual(item);
  return true;
}

export function togglePetriLid(ctx, item) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl) return false;
  const changed = setPetriLidOpen(item, !ctrl.lidOpen, false);
  if (changed) {
    if (window.MycoAudio) window.MycoAudio.playClick();
    ctx.notifyWorldAction();
  }
  return changed;
}

export function stepPetriCultures(ctx, dt) {
  const items = ctx.pickableItems;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
    if (!ctrl) continue;
    if (ctrl.lidAnimationElapsed < ctrl.lidAnimationDuration) {
      ctrl.lidAnimationElapsed = Math.min(ctrl.lidAnimationDuration, ctrl.lidAnimationElapsed + dt);
      const t = ctrl.lidAnimationElapsed / ctrl.lidAnimationDuration;
      const eased = t * t * (3 - 2 * t);
      ctrl.lidProgress = ctrl.lidAnimationFrom + (ctrl.lidAnimationTo - ctrl.lidAnimationFrom) * eased;
      updateLidPose(ctrl);
    }
    if (ctrl.lidOpen && (ctrl.mode === 'empty' || ctrl.mode === 'clean' || ctrl.mode === 'colonizing') &&
        !isAsepticWorkArea(ctx, item)) {
      ctrl.mode = 'contam';
      ctrl.sterilized = false;
      ctrl.inoculated = true;
      ctrl.colonized = false;
      ctrl.contaminated = true;
      ctrl.expired = false;
      updatePetriVisual(item);
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 A placa aberta fora do Fluxo Laminar foi contaminada.');
      ctx.notifyWorldAction();
      continue;
    }

    if (ctrl.mode === 'colonizing' && !ctrl.expired) {
      const previousProgress = Math.floor(ctrl.colonization);
      const previousMode = ctrl.mode;
      const growthRate = ctrl.refrigerated
        ? (0.8 * 0.2)
        : (isCultureIncubationTemperatureSuitable(item, ctx) ? 0.8 : 0);
      ctrl.colonization = Math.min(100, ctrl.colonization + dt * growthRate);
      if (ctrl.delayedContamAtPct && ctrl.colonization >= ctrl.delayedContamAtPct) {
        ctrl.delayedContamAtPct = 0;
        ctrl.mode = 'contam';
        ctrl.sterilized = false;
        ctrl.colonized = false;
        ctrl.contaminated = true;
        updatePetriVisual(item);
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🦠 Contaminação surgiu durante a colonização! Use luvas, álcool 70%, fluxo laminar e parafilme.');
        }
        ctx.notifyWorldAction();
        continue;
      }
      if (ctrl.colonization >= 100) {
        ctrl.mode = 'clean';
        ctrl.colonized = true;
        ctrl.ageGameDays = 0;
        ctrl.shelfLifeAgeDays = 0;
      }
      if (Math.floor(ctrl.colonization) !== previousProgress || ctrl.mode !== previousMode ||
          ctrl.refrigerated !== ctrl.lastRenderedRefrigerated) {
        updatePetriVisual(item);
      }
    }
    if (ctrl.colonized && !ctrl.expired) {
      const lifeStep = stepCultureShelfLife(ctrl, dt);
      if (lifeStep === 2) {
        ctrl.mode = 'contam';
        updatePetriVisual(item);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🕒 Uma cultura venceu: descarte a placa ou prepare uma nova transferência.');
        ctx.notifyWorldAction();
      } else if (ctrl.refrigerated !== ctrl.lastRenderedRefrigerated || lifeStep === 1) {
        updatePetriVisual(item);
      }
    }
  }
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
    ensurePetriCanvas(ctrl);
    if (!ctrl.texture) ctrl.texture = new THREE.CanvasTexture(ctrl.canvas);
    if (!ctrl.agarMesh) {
      ctrl.agarMesh = new THREE.Mesh(
        getPetriAssets().agarGeo,
        new THREE.MeshStandardMaterial({ map: ctrl.texture, roughness: 0.35 })
      );
      ctrl.agarMesh.position.y = 0.008;
      item.mesh.add(ctrl.agarMesh);
    } else if (ctrl.agarMesh.material.map !== ctrl.texture) {
      ctrl.agarMesh.material.map = ctrl.texture;
      ctrl.agarMesh.material.needsUpdate = true;
    }
    drawAgarTexture(ctrl.context, ctrl);
    if (ctrl.texture) ctrl.texture.needsUpdate = true;
  }
  if (item.meta && item.meta.compatibilities) {
    item.meta.compatibilities.canEnterCooker = ctrl.mode === 'filled';
    item.meta.compatibilities.receivesSyringe = ctrl.mode === 'empty' && ctrl.lidOpen && ctrl.sterilized;
    item.meta.compatibilities.acceptsPdaMedium = ctrl.mode === 'bare';
    item.meta.compatibilities.receivesMyceliumCut = ctrl.mode === 'empty' && ctrl.lidOpen && ctrl.sterilized;
  }
  if (item.meta) {
    item.meta.baseTempC = ctrl.refrigerated ? 4 : (ctrl.mode === 'contam' ? 26.8 : 25.0);
    item.meta.purpose = ctrl.mode === 'bare'
      ? 'Placa de Petri vazia aguardando meio PDA'
      : (ctrl.mode === 'filled'
        ? 'Placa com meio PDA/BDA aguardando esterilização'
        : (ctrl.mode === 'empty'
          ? 'Placa estéril com PDA pronta para inoculação'
          : (ctrl.mode === 'colonizing'
            ? 'Micélio branco em crescimento: ' + Math.floor(ctrl.colonization) + '%'
            : (ctrl.mode === 'contam' ? (ctrl.expired ? 'Cultura vencida; micélio perdeu viabilidade' : 'Cultivo contaminado por mofo ou bactéria') : 'Cultivo de micélio em meio sólido BDA/PDA'))));
  }
  const spSuffix = ctrl.speciesName ? (' [' + ctrl.speciesName + ']') : '';
  if (ctrl.mode === 'clean') {
    item.label = 'Placa de Petri' + spSuffix + ' (Micélio • 100% colonizada)';
  } else if (ctrl.mode === 'colonizing') {
    item.label = 'Placa de Petri' + spSuffix + ' (Micélio crescendo • ' + Math.floor(ctrl.colonization) + '%)';
  } else if (ctrl.mode === 'contam') {
    item.label = ctrl.expired ? 'Placa de Petri (Cultura vencida)' : 'Placa Contaminada (Mofo/Bactéria)';
  } else if (ctrl.mode === 'bare') {
    item.label = 'Placa de Petri Vazia';
  } else if (ctrl.mode === 'filled') {
    item.label = 'Placa de Petri com PDA/BDA (Não esterilizada)';
  } else {
    item.label = 'Placa de Petri Estéril (PDA)';
  }
  if (ctrl.colonized && !ctrl.expired) {
    item.label += ' • ' + (ctrl.refrigerated ? '4°C' : '25°C') + ' • validade ' + getCultureRemainingDays(ctrl) + ' dias';
  } else if (ctrl.mode === 'colonizing') {
    item.label += ' • ' + (ctrl.refrigerated ? '4°C • colonização pausada' : '25°C');
  }
  if (ctrl.parafilmSealed && !ctrl.lidOpen) {
    item.label += ' • Parafilm M';
  }
  if (ctrl.parafilmMesh) {
    ctrl.parafilmMesh.visible = !!(ctrl.parafilmSealed && !ctrl.lidOpen);
  }
  ctrl.lastRenderedColonization = Math.floor(ctrl.colonization);
  ctrl.lastRenderedRefrigerated = ctrl.refrigerated;
  ctrl.lastRenderedAgeDay = Math.floor(ctrl.ageGameDays);
  updateLidPose(ctrl);
  item.height = ctrl.lidOpen ? PETRI_OPEN_HEIGHT : PETRI_DISH_HEIGHT;
}

export function fillPetriWithPda(item) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.mode !== 'bare' || !ctrl.lidOpen) return false;
  ctrl.mode = 'filled';
  ctrl.sterilized = false;
  ctrl.inoculated = false;
  ctrl.expired = false;
  ctrl.colonized = false;
  ctrl.contaminated = false;
  ctrl.colonization = 0;
  ctrl.ageGameDays = 0;
  ctrl.shelfLifeAgeDays = 0;
  updatePetriVisual(item);
  return true;
}

export function sterilizePetri(item) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.mode !== 'filled' || ctrl.lidOpen) return false;
  ctrl.mode = 'empty';
  ctrl.sterilized = true;
  ctrl.inoculated = false;
  ctrl.expired = false;
  ctrl.colonized = false;
  ctrl.contaminated = false;
  ctrl.colonization = 0;
  ctrl.ageGameDays = 0;
  ctrl.shelfLifeAgeDays = 0;
  updatePetriVisual(item);
  return true;
}

export function inoculatePetri(item, method, sterile, contamRisk = 0, speciesName = '') {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.mode !== 'empty' || !ctrl.lidOpen || !ctrl.sterilized) return false;
  ctrl.inoculated = true;
  ctrl.colonized = false;
  ctrl.contaminated = false;
  ctrl.inoculationMethod = method === 'mycelium' ? 'mycelium' : 'liquid';
  if (speciesName) ctrl.speciesName = speciesName;
  ctrl.ageGameDays = 0;
  ctrl.shelfLifeAgeDays = 0;
  ctrl.colonization = 0;
  ctrl.expired = false;
  ctrl.delayedContamAtPct = (sterile && contamRisk > 0 && Math.random() < contamRisk)
    ? (16 + Math.random() * 48)
    : 0;
  if (!sterile) {
    ctrl.mode = 'contam';
    ctrl.sterilized = false;
  } else {
    ctrl.mode = 'colonizing';
    ctrl.colonization = 2;
  }
  ctrl.contaminated = !sterile;
  updatePetriVisual(item);
  return true;
}

export function contaminatePetri(item) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl) return false;
  ctrl.mode = 'contam';
  ctrl.sterilized = false;
  ctrl.inoculated = true;
  ctrl.colonized = false;
  ctrl.contaminated = true;
  ctrl.expired = false;
  updatePetriVisual(item);
  return true;
}

export function sealPetriWithParafilm(item) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.lidOpen || ctrl.mode === 'bare' || ctrl.parafilmSealed) return false;
  ctrl.parafilmSealed = true;
  updatePetriVisual(item);
  return true;
}
