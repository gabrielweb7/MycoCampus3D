/**
 * Placa de Petri (MycoCampus3D)
 */

import { getCultureOriginLabel, normalizeCultureOrigin } from '../core/culture-origin.js';
import { isAsepticWorkArea, getAsepticWorkAreaReason } from './laminar-hood.js';
import { pickContamKind, getContamInfo } from './contaminations.js';
import {
  CULTURE_GAME_DAY_SECONDS,
  CULTURE_REFRIGERATED_SHELF_LIFE_DAYS,
  CULTURE_ROOM_SHELF_LIFE_DAYS,
  createCultureLifecycleState,
  getCultureRemainingDays,
  isCultureIncubationTemperatureSuitable,
  stepCultureShelfLife
} from './culture-lifecycle.js';
import { t as tr } from '../core/i18n.js';

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
  if (mode === 'spore_print') {
    pctx.fillStyle = '#e2e8f0';
    pctx.fillRect(0, 0, 256, 256);
    // Desenha carimbo de esporos (Spore Print) radial roxo-escuro/marrom das lamelas
    pctx.save();
    pctx.strokeStyle = 'rgba(59, 7, 100, 0.78)';
    pctx.lineWidth = 2.0;
    for (let g = 0; g < 72; g++) {
      const ang = (g / 72) * Math.PI * 2;
      const rIn = 18 + (g % 2) * 5;
      const rOut = 88 + Math.sin(g * 5) * 6;
      pctx.beginPath();
      pctx.moveTo(128 + Math.cos(ang) * rIn, 128 + Math.sin(ang) * rIn);
      pctx.lineTo(128 + Math.cos(ang) * rOut, 128 + Math.sin(ang) * rOut);
      pctx.stroke();
    }
    const spGrad = pctx.createRadialGradient(128, 128, 16, 128, 128, 92);
    spGrad.addColorStop(0, 'rgba(30, 27, 75, 0.15)');
    spGrad.addColorStop(0.35, 'rgba(59, 7, 100, 0.55)');
    spGrad.addColorStop(0.85, 'rgba(46, 16, 101, 0.45)');
    spGrad.addColorStop(1, 'rgba(46, 16, 101, 0.0)');
    pctx.fillStyle = spGrad;
    pctx.beginPath();
    pctx.arc(128, 128, 92, 0, Math.PI * 2);
    pctx.fill();
    pctx.restore();
    return;
  }
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
    const radius = mode === 'clean' ? 128 : (12 + (progress / 100) * 116);
    const hybrid = ctrl.hybridMutant;
    const baseRgb = hybrid === 'gold' ? '254, 240, 138' : (hybrid === 'albino' ? '240, 249, 255' : '250, 252, 255');
    const edgeRgba = hybrid === 'gold'
      ? 'rgba(234, 179, 8, 0.92)'
      : (hybrid === 'albino' ? 'rgba(186, 230, 253, 0.95)' : 'rgba(226, 232, 240, 0.88)');

    pctx.save();
    pctx.beginPath();
    pctx.arc(128, 128, radius, 0, Math.PI * 2);
    pctx.clip();

    // Base micelial suave com halo translúcido nas pontas das hifas
    const mycGrad = pctx.createRadialGradient(128, 128, Math.max(2, radius * 0.14), 128, 128, radius);
    mycGrad.addColorStop(0, `rgba(${baseRgb}, 0.98)`);
    mycGrad.addColorStop(0.68, `rgba(${baseRgb}, ${progress > 45 ? 0.92 : 0.78})`);
    mycGrad.addColorStop(1, `rgba(${baseRgb}, ${progress > 85 ? 0.88 : 0.24})`);
    pctx.fillStyle = mycGrad;
    pctx.fillRect(0, 0, 256, 256);

    // Anéis fofos de crescimento concêntrico
    if (radius > 28) {
      pctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
      pctx.lineWidth = 2.0;
      for (let ring = 0.42; ring <= 0.82; ring += 0.36) {
        pctx.beginPath();
        pctx.arc(128, 128, radius * ring, 0, Math.PI * 2);
        pctx.stroke();
      }
    }

    // Cordões rizomórficos ramificados que se estendem do centro até toda a frente de colonização
    const rays = 128;
    for (let a = 0; a < rays; a++) {
      const ang = (a / rays) * Math.PI * 2;
      const wobble = Math.sin(a * 7.3) * 0.14 + Math.cos(a * 3.1) * 0.08;
      const rEnd = radius * (0.86 + 0.13 * Math.sin(a * 5.7));
      pctx.strokeStyle = edgeRgba;
      pctx.lineWidth = (a % 3 === 0) ? (hybrid ? 2.1 : 1.7) : 1.05;
      pctx.beginPath();
      pctx.moveTo(128, 128);
      const midR = rEnd * 0.56;
      const mx = 128 + Math.cos(ang + wobble * 0.6) * midR;
      const my = 128 + Math.sin(ang + wobble * 0.6) * midR;
      const ex = 128 + Math.cos(ang + wobble) * rEnd;
      const ey = 128 + Math.sin(ang + wobble) * rEnd;
      pctx.quadraticCurveTo(mx, my, ex, ey);
      pctx.stroke();

      // Ramificações secundárias finas na zona rizomórfica
      if (rEnd > 24 && a % 2 === 0) {
        pctx.lineWidth = 0.85;
        pctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        const forkA = ang + wobble + (a % 4 === 0 ? 0.28 : -0.28);
        pctx.beginPath();
        pctx.moveTo(mx, my);
        pctx.lineTo(128 + Math.cos(forkA) * rEnd * 0.94, 128 + Math.sin(forkA) * rEnd * 0.94);
        pctx.stroke();
      }
    }
    pctx.restore();
    // Quadradinho branco inicial do fragmento transferido ou ponto escuro de esporos germinando no centro do PDA âmbar
    if (mode === 'colonizing' && ctrl.inoculationMethod === 'mycelium' && progress < 35) {
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(118, 118, 20, 20);
      pctx.strokeStyle = '#cbd5e1';
      pctx.lineWidth = 1.2;
      pctx.strokeRect(118, 118, 20, 20);
    } else if (mode === 'colonizing' && ctrl.inoculationMethod === 'spores' && progress < 40) {
      pctx.fillStyle = '#3b0764';
      pctx.beginPath();
      pctx.arc(128, 128, 7, 0, Math.PI * 2);
      pctx.fill();
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
    if (!ctrl.contamKind) ctrl.contamKind = pickContamKind('petri');
    const cInfo = getContamInfo(ctrl.contamKind);
    if (ctrl.contamKind === 'penicillium') {
      pctx.fillStyle = '#0f766e';
      pctx.beginPath(); pctx.arc(96, 128, 52, 0, Math.PI * 2); pctx.fill();
      pctx.strokeStyle = '#99f6e4';
      pctx.lineWidth = 4;
      pctx.beginPath(); pctx.arc(96, 128, 36, 0, Math.PI * 2); pctx.stroke();
      pctx.beginPath(); pctx.arc(166, 114, 28, 0, Math.PI * 2); pctx.stroke();
    } else if (ctrl.contamKind === 'aspergillus') {
      pctx.fillStyle = '#334155';
      pctx.beginPath(); pctx.arc(108, 134, 54, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#0f172a';
      for (let d = 0; d < 18; d++) {
        pctx.beginPath();
        pctx.arc(72 + (d * 23) % 105, 86 + (d * 31) % 85, 6 + (d % 4), 0, Math.PI * 2);
        pctx.fill();
      }
    } else if (ctrl.contamKind === 'wet_spot') {
      pctx.fillStyle = 'rgba(234, 179, 8, 0.72)';
      pctx.beginPath(); pctx.arc(118, 128, 66, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#fef08a';
      pctx.beginPath(); pctx.arc(146, 112, 24, 0, Math.PI * 2); pctx.fill();
    } else if (ctrl.contamKind === 'lipstick') {
      pctx.fillStyle = '#e11d48';
      pctx.beginPath(); pctx.arc(96, 124, 48, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#fda4af';
      pctx.beginPath(); pctx.arc(162, 138, 34, 0, Math.PI * 2); pctx.fill();
    } else if (ctrl.contamKind === 'cobweb') {
      pctx.fillStyle = 'rgba(203, 213, 225, 0.55)';
      pctx.beginPath(); pctx.arc(128, 128, 92, 0, Math.PI * 2); pctx.fill();
      pctx.strokeStyle = 'rgba(100, 116, 139, 0.65)';
      pctx.lineWidth = 1.6;
      for (let w = 0; w < 20; w++) {
        const wa = (w / 20) * Math.PI * 2;
        pctx.beginPath();
        pctx.moveTo(128, 128);
        pctx.lineTo(128 + Math.cos(wa) * 98, 128 + Math.sin(wa) * 98);
        pctx.stroke();
      }
    } else {
      // Trichoderma (Duende Verde)
      pctx.fillStyle = '#f8fafc';
      pctx.beginPath(); pctx.arc(100, 130, 62, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = cInfo.badgeHex || '#16a34a';
      pctx.beginPath(); pctx.arc(96, 130, 44, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = '#4ade80';
      pctx.beginPath(); pctx.arc(168, 118, 30, 0, Math.PI * 2); pctx.fill();
    }
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
      glassMat: new THREE.MeshStandardMaterial({ color: 0xb3cbc3, transparent: true, opacity: 0.33, roughness: 0.20, metalness: 0.08 }),
      hitboxMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      lidRingGeo: new THREE.TorusGeometry(PETRI_DISH_RADIUS - 0.002, 0.0022, 4, 20),
      lidRingMat: new THREE.MeshStandardMaterial({ color: 0x839883, roughness: 0.67 }),
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
  const lidRing = new THREE.Mesh(A.lidRingGeo, A.lidRingMat);
  lidRing.rotation.x = Math.PI / 2;
  lidRing.position.set(PETRI_DISH_RADIUS, 0, 0);
  lidPivot.add(lid, lidRing);
  pg.userData.firstPersonGrip = { x: 0.027, y: 0.003, z: PETRI_DISH_RADIUS + 0.012 };

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
    generation: isColonized ? 2 : 0,
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
    if ((ctrl.sporeDropAnimTimer || 0) > 0) {
      ctrl.sporeDropAnimTimer = Math.max(0, ctrl.sporeDropAnimTimer - dt);
      const prog = 1 - (ctrl.sporeDropAnimTimer / 1.15);
      if (ctrl.sporeCapGroup) {
        ctrl.sporeCapGroup.visible = ctrl.sporeDropAnimTimer > 0.02;
        ctrl.sporeCapGroup.position.y = 0.042 - Math.sin(prog * Math.PI) * 0.014;
        ctrl.sporeCapGroup.rotation.y = prog * Math.PI * 1.5;
        if (ctrl.sporeCloudMesh) {
          ctrl.sporeCloudMesh.scale.set(0.6 + prog * 0.65, 1 - prog * 0.7, 0.6 + prog * 0.65);
        }
      }
    }
    if (ctrl.lidOpen && (ctrl.mode === 'empty' || ctrl.mode === 'clean' || ctrl.mode === 'colonizing' || ctrl.mode === 'spore_print') &&
        !isAsepticWorkArea(ctx, item)) {
      if (ctrl.mode === 'spore_print') {
        if (!ctrl.sporeContaminated) {
          ctrl.sporeContaminated = true;
          if (ctx.callbacks && ctx.callbacks.onToast) {
            ctx.callbacks.onToast(tr('items.petriDish.m1'));
          }
        }
        continue;
      }
      ctrl.mode = 'contam';
      ctrl.sterilized = false;
      ctrl.inoculated = true;
      ctrl.colonized = false;
      ctrl.contaminated = true;
      ctrl.expired = false;
      updatePetriVisual(item);
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(tr('items.petriDish.m2'));
      ctx.notifyWorldAction();
      continue;
    }

    if (ctrl.mode === 'colonizing' && !ctrl.expired) {
      const previousProgress = Math.floor(ctrl.colonization);
      const previousMode = ctrl.mode;
      const genBoost = 1 + Math.min(3, ctrl.generation || 0) * 0.22;
      const growthRate = ctrl.refrigerated
        ? (0.8 * 0.2)
        : (isCultureIncubationTemperatureSuitable(item, ctx) ? (0.8 * genBoost) : 0);
      ctrl.colonization = Math.min(100, ctrl.colonization + dt * growthRate);
      if (ctrl.delayedContamAtPct && ctrl.colonization >= ctrl.delayedContamAtPct) {
        ctrl.delayedContamAtPct = 0;
        ctrl.mode = 'contam';
        ctrl.sterilized = false;
        ctrl.colonized = false;
        ctrl.contaminated = true;
        updatePetriVisual(item);
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast(tr('items.petriDish.m3'));
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
    if ((ctrl.colonized || ctrl.mode === 'spore_print') && !ctrl.expired) {
      const lifeStep = stepCultureShelfLife(ctrl, dt);
      if (lifeStep === 2) {
        ctrl.mode = 'contam';
        updatePetriVisual(item);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(tr('items.petriDish.m4'));
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
    ctrl.contaminated = false;
    ctrl.inoculated = false;
    ctrl.colonized = false;
    ctrl.colonization = 0;
    if (ctrl.agarMesh) {
      item.mesh.remove(ctrl.agarMesh);
      ctrl.agarMesh = null;
    }
  } else {
    if (ctrl.mode === 'contam') {
      ctrl.contaminated = true;
      ctrl.sterilized = false;
      ctrl.colonized = false;
    } else if (ctrl.mode === 'empty') {
      ctrl.contaminated = false;
      ctrl.inoculated = false;
      ctrl.colonized = false;
    } else if (ctrl.mode === 'clean') {
      ctrl.contaminated = false;
      ctrl.inoculated = true;
      ctrl.colonized = true;
      ctrl.colonization = 100;
    } else if (ctrl.mode === 'colonizing') {
      ctrl.contaminated = false;
      ctrl.inoculated = true;
    }
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
  const gen = Math.min(3, Math.max(0, ctrl.generation || 0));
  const originLabel = getCultureOriginLabel(ctrl.origin);
  const hybridBadge = ctrl.hybridMutant === 'gold' ? ' • 🌟 Dourada F1' : (ctrl.hybridMutant === 'albino' ? ' • ✨ Albino F1' : '');
  const genSuffix = (ctrl.mode === 'clean' || ctrl.mode === 'colonizing')
    ? (' [T' + gen + (originLabel ? ' · ' + originLabel : '') + hybridBadge + ']')
    : '';
  if (ctrl.mode === 'spore_print') {
    item.label = 'Placa de Petri' + spSuffix + ' (Carimbo de Esporos • Colete um monoesporo com bisturi estéril)';
  } else if (ctrl.mode === 'clean') {
    item.label = 'Placa de Petri' + spSuffix + genSuffix + ' (Micélio • 100% colonizada)';
  } else if (ctrl.mode === 'colonizing') {
    item.label = 'Placa de Petri' + spSuffix + genSuffix + (ctrl.inoculationMethod === 'spores' ? ' (Monoesporo germinando • ' : ' (Micélio crescendo • ') + Math.floor(ctrl.colonization) + '%)';
  } else if (ctrl.mode === 'contam') {
    if (!ctrl.contamKind && !ctrl.expired) ctrl.contamKind = pickContamKind('petri');
    const cName = ctrl.contamKind ? getContamInfo(ctrl.contamKind).shortLabel : 'Mofo/Bactéria';
    item.label = ctrl.expired ? 'Placa de Petri (Cultura vencida)' : `Placa Contaminada (${cName})`;
  } else if (ctrl.mode === 'bare') {
    item.label = 'Placa de Petri Vazia';
  } else if (ctrl.mode === 'filled') {
    item.label = 'Placa de Petri com PDA/BDA (Não esterilizada)';
  } else {
    item.label = 'Placa de Petri Estéril (PDA)';
  }
  if (ctrl.colonized && !ctrl.expired) {
    item.label += ' • ' + (ctrl.refrigerated ? '4°C' : '25°C') + ' • validade ' + getCultureRemainingDays(ctrl) + ' dias';
  } else if (ctrl.mode === 'spore_print' && !ctrl.expired) {
    const spDays = getCultureRemainingDays(ctrl);
    const yrTag = spDays >= 365 ? ' (~' + (spDays / 365).toFixed(1).replace(/\.0$/, '') + ' anos)' : '';
    item.label += ' • validade ' + spDays + ' dias' + yrTag;
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
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
  updateLidPose(ctrl);
  item.height = ctrl.lidOpen ? PETRI_OPEN_HEIGHT : PETRI_DISH_HEIGHT;
}

export function fillPetriWithPda(item, isSterileSource = false) {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.mode !== 'bare' || !ctrl.lidOpen) return false;
  if (isSterileSource) {
    ctrl.mode = 'empty';
    ctrl.sterilized = true;
  } else {
    ctrl.mode = 'filled';
    ctrl.sterilized = false;
  }
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

export function depositSporePrintOnPetri(item, speciesName = '') {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || (ctrl.mode !== 'bare' && ctrl.mode !== 'spore_print') || !ctrl.lidOpen) return false;
  ctrl.mode = 'spore_print';
  ctrl.speciesName = speciesName || 'Psilocybe cubensis';
  ctrl.sterilized = true;
  ctrl.inoculated = false;
  ctrl.colonized = false;
  ctrl.contaminated = false;
  ctrl.expired = false;
  ctrl.ageGameDays = 0;
  ctrl.shelfLifeAgeDays = 0;
  ctrl.sporeDropAnimTimer = 1.15;
  if (!ctrl.sporeCapGroup && item.mesh && item.mesh.add && THREE && THREE.Group && THREE.ConeGeometry && THREE.CylinderGeometry) {
    const capG = new THREE.Group();
    const capM = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.022, 14),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.45 })
    );
    capM.position.y = 0.012;
    const cloudM = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.038, 0.024, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x581c87, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
    );
    capG.add(capM, cloudM);
    capG.position.y = 0.042;
    item.mesh.add(capG);
    ctrl.sporeCapGroup = capG;
    ctrl.sporeCloudMesh = cloudM;
  } else if (ctrl.sporeCapGroup) {
    ctrl.sporeCapGroup.visible = true;
  }
  updatePetriVisual(item);
  return true;
}

export function inoculatePetri(item, method, sterile, contamRisk = 0, speciesName = '', generation = null, origin = '') {
  const ctrl = item && item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (!ctrl || ctrl.mode !== 'empty' || !ctrl.lidOpen || !ctrl.sterilized) return false;
  ctrl.inoculated = true;
  ctrl.colonized = false;
  ctrl.contaminated = false;
  ctrl.inoculationMethod = method === 'spores' ? 'spores' : (method === 'mycelium' ? 'mycelium' : 'liquid');
  ctrl.origin = method === 'spores' ? 'monospore' : normalizeCultureOrigin(origin);
  ctrl.generation = method === 'spores'
    ? 0
    : Math.min(3, Math.max(0, typeof generation === 'number' ? generation : 1));
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
  if (!ctrl || ctrl.mode === 'bare') return false;
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
