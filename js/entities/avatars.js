/**
 * Avatares Multiplayer (MycoCampus3D)
 * Construcao de avatares, chapeus cosmeticos, expressoes faciais, aura e interpolacao Hermite cubica.
 */

import { makeTextSprite, updateTextSprite } from '../engine/textures.js';
import { COOKER_SLOT_OFFSETS, COOKER_SLOT_Y } from '../items/pressure-cooker.js';
import { createParagliderWingMesh, createRoundParachuteMesh } from './vehicles/paraglider.js';
import { getSnowboardDeckGeometry } from './vehicles/snowboard.js';
import { makeChamferedGeometry } from '../items/lab-prop-shapes.js';
import { applyAvatarSkin } from './avatar-skins.js';

const THREE = window.THREE;

const _tmpInterpPos = new THREE.Vector3();
const _tmpAvatarHandOffset = new THREE.Vector3();
const _tmpAvatarYAxis = new THREE.Vector3(0, 1, 0);
const _tmpSubOff = new THREE.Vector3();
const _tmpTrayPt = new THREE.Vector3();

let sharedAvatarAssets = null;
function getSharedAvatarAssets() {
  if (sharedAvatarAssets) return sharedAvatarAssets;
  const legGeo = makeChamferedGeometry(0.15, 0.38, 0.15, 0.022);
  legGeo.translate(0, -0.19, 0);
  const armGeo = makeChamferedGeometry(0.137, 0.34, 0.14, 0.026);
  armGeo.translate(0, -0.13, 0);
  sharedAvatarAssets = {
    legGeo,
    armGeo,
    torsoGeo: makeChamferedGeometry(0.42, 0.51, 0.27, 0.045),
    headGeo: makeChamferedGeometry(0.39, 0.36, 0.35, 0.049),
    palmGeo: makeChamferedGeometry(0.105, 0.116, 0.11, 0.021),
    shoeGeo: makeChamferedGeometry(0.154, 0.082, 0.213, 0.019),
    faceGeo: new THREE.PlaneGeometry(0.32, 0.30),
    sbDeckGeo: getSnowboardDeckGeometry(),
    sbBindGeo: new THREE.BoxGeometry(0.17, 0.035, 0.12),
    sbDeckMat: new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.25, metalness: 0.15 }),
    sbBindMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 })
  };
  Object.keys(sharedAvatarAssets).forEach((k) => {
    sharedAvatarAssets[k].userData.shared = true;
  });
  return sharedAvatarAssets;
}

function createRemoteSnowboardMesh() {
  const A = getSharedAvatarAssets();
  const remoteSb = new THREE.Group();
  const rDeck = new THREE.Mesh(A.sbDeckGeo, A.sbDeckMat);
  rDeck.position.y = 0.025;
  rDeck.scale.set(0.80, 0.8, 0.70);
  const rBindF = new THREE.Mesh(A.sbBindGeo, A.sbBindMat);
  rBindF.position.set(0, 0.048, -0.20);
  const rBindB = new THREE.Mesh(A.sbBindGeo, A.sbBindMat);
  rBindB.position.set(0, 0.048, 0.20);
  remoteSb.add(rDeck, rBindF, rBindB);
  remoteSb.rotation.y = -0.28;
  return remoteSb;
}

export function normalizeAngle(a) {
  a = a % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function disposeObject3D(root, skipMat) {
  if (!root) return;
  root.traverse(function (obj) {
    if (obj.geometry && obj.geometry.dispose && !(obj.geometry.userData && obj.geometry.userData.shared)) {
      obj.geometry.dispose();
    }
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m || m === skipMat || (m.userData && m.userData.shared)) continue;
      if (m.map && m.map.dispose && !(m.map.userData && m.map.userData.shared)) m.map.dispose();
      if (m.dispose) m.dispose();
    }
  });
}

export function drawAvatarFace(ctx, mood, blink) {
  ctx.clearRect(0, 0, 128, 128);
  const isTripMeme = mood === 'trip_meme';
  const isLove = mood === 'love';
  const isSad = mood === 'sad';
  const isExcited = mood === 'excited';
  // Bochechas rosadas
  ctx.fillStyle = (isTripMeme || isLove) ? 'rgba(244, 114, 182, 0.78)' : 'rgba(244, 114, 182, 0.55)';
  ctx.beginPath(); ctx.ellipse(28, 76, (isTripMeme || isLove) ? 14 : 12, (isTripMeme || isLove) ? 8.5 : 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(100, 76, (isTripMeme || isLove) ? 14 : 12, (isTripMeme || isLove) ? 8.5 : 7, 0, 0, Math.PI * 2); ctx.fill();

  // Olhos
  if (isLove && !blink) {
    // Olhos de coração ♥ ♥
    ctx.fillStyle = '#f43f5e';
    [40, 88].forEach(function (ex) {
      ctx.beginPath();
      ctx.moveTo(ex, 66);
      ctx.bezierCurveTo(ex - 14, 56, ex - 13, 42, ex - 5, 42);
      ctx.bezierCurveTo(ex - 1, 42, ex, 46, ex, 48);
      ctx.bezierCurveTo(ex, 46, ex + 1, 42, ex + 5, 42);
      ctx.bezierCurveTo(ex + 13, 42, ex + 14, 56, ex, 66);
      ctx.fill();
    });
  } else if ((isTripMeme || isExcited) && !blink) {
    // Olhos felizes estilo ^ ^ brilhantes
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(40, 58, 11, Math.PI + 0.25, -0.25); ctx.stroke();
    ctx.beginPath(); ctx.arc(88, 58, 11, Math.PI + 0.25, -0.25); ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(27, 46, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(101, 46, 3.2, 0, Math.PI * 2); ctx.fill();
  } else if (blink) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(40, 56, 10, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(88, 56, 10, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    [40, 88].forEach(function (ex) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.ellipse(ex, 56, 10, isSad ? 10 : 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex - 3, 51, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 3, 60, 1.8, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Sobrancelhas & Boca conforme o humor
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  if (isTripMeme || isLove || isExcited) {
    // Sorrisão gigante :D
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.arc(64, 75, 16, 0.05, Math.PI - 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(64, 87, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (isSad) {
    ctx.beginPath(); ctx.moveTo(28, 42); ctx.lineTo(48, 37); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(100, 42); ctx.lineTo(80, 37); ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 92, 10, Math.PI + 0.3, -0.3); ctx.stroke();
  } else if (mood === 'focused') {
    ctx.beginPath(); ctx.moveTo(28, 38); ctx.lineTo(50, 42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(100, 38); ctx.lineTo(78, 42); ctx.stroke();
    ctx.beginPath(); ctx.arc(64, 86, 5, 0, Math.PI * 2); ctx.stroke();
  } else if (mood === 'chat') {
    ctx.fillStyle = '#be123c';
    ctx.beginPath(); ctx.ellipse(64, 85, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(64, 78, 12, 0.25, Math.PI - 0.25); ctx.stroke();
  }
}

export function buildAvatarHat(hatId, hatMat, hatGroup) {
  while (hatGroup.children.length > 0) {
    const oldHat = hatGroup.children[0];
    hatGroup.remove(oldHat);
    disposeObject3D(oldHat, hatMat);
  }
  const id = hatId || 'default';
  if (id === 'none') return;

  if (id === 'golden_shroom') {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xdca954, metalness: 0.43, roughness: 0.42, flatShading: true,
      emissive: 0xb45309, emissiveIntensity: 0.35
    });
    const gHat = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), goldMat);
    gHat.position.set(0, 0.24, 0); gHat.castShadow = true;
    const pearlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.1, roughness: 0.15,
      emissive: 0xfef08a, emissiveIntensity: 0.6
    });
    [[0, 0.58, 0.08], [-0.20, 0.46, -0.16], [0.20, 0.46, -0.16], [-0.18, 0.45, 0.17], [0.18, 0.45, 0.17], [0, 0.62, 0]].forEach(function (sp) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pearlMat);
      p.position.set(sp[0], sp[1], sp[2]);
      hatGroup.add(p);
    });
    hatGroup.add(gHat);
  } else if (id === 'wizard_hood') {
    const wizMat = new THREE.MeshStandardMaterial({ color: 0x70608b, roughness: 0.69, flatShading: true });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.035, 20), wizMat);
    brim.position.set(0, 0.22, 0);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.68, 20), wizMat);
    cone.position.set(0, 0.52, -0.05);
    cone.rotation.x = -0.18;
    const belt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.37, 0.38, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 })
    );
    belt.position.set(0, 0.25, -0.02);
    belt.rotation.x = -0.15;
    hatGroup.add(brim, cone, belt);
  } else if (id === 'grad_cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
    skull.position.set(0, 0.22, 0);
    capMat.color.setHex(0x53465f);
    const board = new THREE.Mesh(makeChamferedGeometry(0.56, 0.034, 0.56, 0.009), capMat);
    board.position.set(0, 0.35, 0);
    board.rotation.y = Math.PI / 4;
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7 }));
    button.position.set(0, 0.37, 0);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.035, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 }));
    tassel.position.set(0.24, 0.24, 0.12);
    tassel.rotation.z = -0.3;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.27, 6), tassel.material);
    cord.rotation.set(0, 0, -Math.PI / 2);
    cord.position.set(0.135, 0.373, 0);
    tassel.position.set(0.291, 0.25, 0);
    hatGroup.add(cord);
    hatGroup.add(skull, board, button, tassel);
  } else if (id === 'flower_crown') {
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 24), vineMat);
    vine.rotation.x = Math.PI / 2;
    vine.position.set(0, 0.24, 0);
    hatGroup.add(vine);
    const flowerCols = [0xde919b, 0xe7bd76, 0xa7b9d7, 0xc1a0c8, 0xffe8d1, 0xe4a182];
    const petalGeo = new THREE.SphereGeometry(1, 6, 4);
    const pollenMat = new THREE.MeshStandardMaterial({ color: 0xd49b5c, roughness: 0.79 });
    for (let fi = 0; fi < 6; fi++) {
      const ang = (fi / 6) * Math.PI * 2;
      const fMat = new THREE.MeshStandardMaterial({ color: flowerCols[fi], roughness: 0.35 });
      const fMesh = new THREE.Group();
      fMesh.rotation.y = Math.PI / 2 - ang;
      fMesh.position.set(Math.cos(ang) * 0.24, 0.25, Math.sin(ang) * 0.24);
      for (let p = 0; p < 5; p++) {
        const a = p * 2 * Math.PI / 5;
        const petal = new THREE.Mesh(petalGeo, fMat);
        petal.position.set(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0);
        petal.scale.set(0.031, 0.022, 0.017);
        petal.rotation.z = a;
        fMesh.add(petal);
      }
      const center = new THREE.Mesh(petalGeo, pollenMat);
      center.scale.set(0.021, 0.021, 0.014);
      center.position.z = 0.013;
      fMesh.add(center);
      hatGroup.add(fMesh);
    }
  } else if (id === 'beret') {
    const beretMat = new THREE.MeshStandardMaterial({ color: 0x62546f, roughness: 0.82 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.25, 0.10, 18), beretMat);
    disc.position.set(0.05, 0.28, -0.02);
    disc.rotation.z = -0.22;
    disc.rotation.x = 0.08;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), beretMat);
    stem.position.set(0.06, 0.35, -0.02);
    hatGroup.add(disc, stem);
  } else {
    const defHat = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hatMat);
    defHat.position.set(0, 0.24, 0); defHat.castShadow = true;
    defHat.scale.set(1, 0.94, 1.05);
    const lining = new THREE.Mesh(new THREE.CylinderGeometry(0.338, 0.310, 0.025, 16),
      new THREE.MeshStandardMaterial({ color: 0xead2b1, roughness: 0.82 }));
    lining.scale.z = 1.05;
    lining.position.y = 0.175;
    hatGroup.add(lining);
    const spotMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
    [[0, 0.56, 0.08], [-0.18, 0.45, -0.15], [0.18, 0.45, -0.15], [-0.16, 0.44, 0.16], [0.16, 0.44, 0.16]].forEach(function (sp) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), spotMat);
      dot.scale.set(1, 0.45, 1);
      dot.position.set(sp[0], sp[1], sp[2]);
      hatGroup.add(dot);
    });
    hatGroup.add(defHat);
  }
}

export function buildCuteAvatar(scene, data) {
  const A = getSharedAvatarAssets();
  const g = new THREE.Group();
  const bodyMat = data.isLocal
    ? new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6 });
  const hatMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(data.hat_color || '#d9534f'), roughness: 0.45 });
  const pantsMat = bodyMat.clone();
  const accentMat = bodyMat.clone();
  const skinMat = bodyMat.clone();
  const hairMat = bodyMat.clone();

  const leftLeg = new THREE.Mesh(A.legGeo, pantsMat);
  leftLeg.position.set(-0.10, 0.38, 0); leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(A.legGeo, pantsMat);
  rightLeg.position.set(0.10, 0.38, 0); rightLeg.castShadow = true;
  const torso = new THREE.Mesh(A.torsoGeo, bodyMat);
  torso.position.set(0, 0.64, 0); torso.castShadow = true;
  const leftArm = new THREE.Mesh(A.armGeo, bodyMat);
  leftArm.position.set(-0.28, 0.82, 0); leftArm.castShadow = true;
  const rightArm = new THREE.Mesh(A.armGeo, bodyMat);
  rightArm.position.set(0.28, 0.82, 0); rightArm.castShadow = true;
  for (const arm of [leftArm, rightArm]) {
    const palm = new THREE.Mesh(A.palmGeo, skinMat);
    palm.position.y = -0.321;
    arm.add(palm);
  }
  for (const leg of [leftLeg, rightLeg]) {
    const shoe = new THREE.Mesh(A.shoeGeo, accentMat);
    shoe.position.set(0, -0.339, -0.035);
    leg.add(shoe);
  }
  const skinOutfit = new THREE.Group();
  torso.add(skinOutfit);
  g.add(leftLeg, rightLeg, torso, leftArm, rightArm);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.05, 0);
  const head = new THREE.Mesh(A.headGeo, skinMat);
  head.position.set(0, 0.1, 0); head.castShadow = true;

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128; faceCanvas.height = 128;
  const faceCtx = faceCanvas.getContext('2d');
  drawAvatarFace(faceCtx, 'happy', false);
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  const facePlane = new THREE.Mesh(
    A.faceGeo,
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
  );
  facePlane.position.set(0, 0.1, -0.178);
  facePlane.rotation.y = Math.PI;
  headGroup.add(facePlane);

  const hatGroup = new THREE.Group();
  hatGroup.position.y = 0.058;
  buildAvatarHat(data.current_hat || 'default', hatMat, hatGroup);
  const skinHair = new THREE.Group();
  headGroup.add(head, skinHair, hatGroup);

  const isProf = data.role === 'professor' || data.role === 'admin';
  const isMaster = data.role === 'admin';
  const isMod = data.role === 'moderator';
  let auraGroup = null;
  const auraOrbs = [];
  if (isProf) {
    auraGroup = new THREE.Group();
    const ringColor = isMaster ? 0xf59e0b : 0x34d399;
    const innerColor = isMaster ? 0xec4899 : 0xfbbf24;
    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.56, 36),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.025;
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.38, 36),
      new THREE.MeshBasicMaterial({ color: innerColor, transparent: true, opacity: 0.50, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.032;
    auraGroup.add(outerRing, innerRing);
    const orbGeo = new THREE.SphereGeometry(0.026, 8, 8);
    for (let oi = 0; oi < 8; oi++) {
      const oMat = new THREE.MeshBasicMaterial({
        color: oi % 2 === 0 ? ringColor : innerColor,
        transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
      });
      const orb = new THREE.Mesh(orbGeo, oMat);
      auraGroup.add(orb);
      auraOrbs.push({ mesh: orb, angle: (oi / 8) * Math.PI * 2, phase: oi * 0.75 });
    }
    g.add(auraGroup);
  }
  g.add(headGroup);
  g.scale.set(1.38, 1.38, 1.38);

  let rolePrefix = '';
  let labelColor = '#ffffff';
  if (isMaster) {
    rolePrefix = '👑 ';
    labelColor = '#fbbf24';
  } else if (data.role === 'professor') {
    rolePrefix = '👨‍🏫 ';
    labelColor = '#fcd34d';
  } else if (isMod) {
    rolePrefix = '🛡️ ';
    labelColor = '#93c5fd';
  }
  const labelSprite = data.isLocal ? null : makeTextSprite(rolePrefix + (data.name || 'Aluno'), labelColor);
  if (labelSprite) {
    labelSprite.position.set(0, 1.92, 0);
    labelSprite.scale.set(1.45, 0.36, 1);
    g.add(labelSprite);
  }
  const chatSprite = data.isLocal ? null : makeTextSprite('', '#34d399');
  if (chatSprite) {
    chatSprite.position.set(0, 2.28, 0);
    chatSprite.scale.set(1.45, 0.36, 1);
    chatSprite.visible = false;
    g.add(chatSprite);
  }

  scene.add(g);
  const avatar = {
    group: g, torso, leftLeg, rightLeg, leftArm, rightArm, headGroup,
    auraGroup, auraOrbs,
    snowboardMesh: null, paragliderMesh: null, roundParachuteMesh: null, toyMode: '',
    bodyMat, hatMat, hatGroup, pantsMat, accentMat, skinMat, hairMat, skinHair, skinOutfit,
    current_hat: data.current_hat || 'default', emote: data.emote || '',
    faceCtx, faceTex, lastMood: 'happy', lastBlink: false, blinkTimer: 2 + Math.random() * 3,
    labelSprite, chatSprite, lastChat: '', role: data.role || 'student',
    targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
    targetYaw: normalizeAngle(data.yaw || 0),
    targetPitch: data.pitch || 0,
    targetVelX: 0, targetVelZ: 0,
    avgIntervalMs: 140, interpDelay: 185, lastSnapAt: 0,
    snapshots: [],
    holding: '', walking: false, seated: false, walkPhase: 0
  };
  applyAvatarSkin(avatar, data.current_skin, avatar.role);
  if (!data.current_skin && data.body_color) bodyMat.color.set(data.body_color);
  return avatar;
}

export function updateCampusPlayers(ctx, players) {
  const { scene, remoteAvatars, onDropStolenHeld, remoteHeldIds, findPickable } = ctx;
  if (remoteHeldIds && typeof remoteHeldIds.clear === 'function') remoteHeldIds.clear();
  const seen = {};
  const nowMs = performance.now();
  (players || []).forEach(function (p) {
    seen[p.id] = true;
    if (remoteHeldIds && p.holding) {
      remoteHeldIds.add(p.holding);
      if (findPickable) {
        const heldObj = findPickable(p.holding);
        if (heldObj && heldObj.lidItem && heldObj.lidItem.isAttached) {
          remoteHeldIds.add(heldObj.lidItem.id);
        }
        if (heldObj && heldObj.cookerRef && Array.isArray(heldObj.cookerRef.contents)) {
          heldObj.cookerRef.contents.forEach(function (ci) {
            if (ci && ci.id) remoteHeldIds.add(ci.id);
          });
        }
        if (heldObj && Array.isArray(heldObj.trayContents)) {
          heldObj.trayContents.forEach(function (tc) {
            if (tc && tc.item && tc.item.id) remoteHeldIds.add(tc.item.id);
          });
        }
      }
    }
    const nyaw = normalizeAngle(p.yaw || 0);
    const npitch = p.pitch || 0;
    let av = remoteAvatars[p.id];
    if (!av) {
      av = buildCuteAvatar(scene, p);
      av.group.position.set(p.x, p.y, p.z);
      av.group.rotation.y = nyaw;
      av.lastSnapAt = nowMs;
      av.snapshots.push({ t: nowMs, x: p.x, y: p.y, z: p.z, yaw: nyaw, pitch: npitch, vx: Number(p.vx) || 0, vz: Number(p.vz) || 0 });
      remoteAvatars[p.id] = av;
    } else {
      const snaps = av.snapshots;
      const prev = snaps.length ? snaps[snaps.length - 1] : null;
      if (av.lastSnapAt > 0) {
        const gap = nowMs - av.lastSnapAt;
        if (gap > 30 && gap < 1200) {
          av.avgIntervalMs = av.avgIntervalMs * 0.8 + gap * 0.2;
          av.interpDelay = Math.max(150, Math.min(320, av.avgIntervalMs * 1.45));
        }
      }
      av.lastSnapAt = nowMs;
      let vx = Number(p.vx) || 0;
      let vz = Number(p.vz) || 0;
      if (prev && vx === 0 && vz === 0) {
        const dtSec = (nowMs - prev.t) / 1000;
        if (dtSec > 0.03 && dtSec < 1.2) {
          const rawVx = Math.max(-14, Math.min(14, (p.x - prev.x) / dtSec));
          const rawVz = Math.max(-14, Math.min(14, (p.z - prev.z) / dtSec));
          av._emaVx = (av._emaVx || 0) * 0.45 + rawVx * 0.55;
          av._emaVz = (av._emaVz || 0) * 0.45 + rawVz * 0.55;
          vx = av._emaVx;
          vz = av._emaVz;
        }
      } else {
        av._emaVx = vx;
        av._emaVz = vz;
      }
      snaps.push({ t: nowMs, x: p.x, y: p.y, z: p.z, yaw: nyaw, pitch: npitch, vx, vz });
      if (snaps.length > 8) snaps.shift();
    }
    av.targetPos.set(p.x, p.y, p.z);
    av.villageEditor = p.village_editor || null;
    av.displayName = p.name;
    av.targetYaw = nyaw;
    av.targetPitch = npitch;
    av.targetVelX = Number(p.vx) || 0;
    av.targetVelZ = Number(p.vz) || 0;
    av.walking = !!p.walking;
    av.toyMode = p.toy_mode || ((p.walking === 4) ? 'paraglider' : (p.walking === 3 ? 'snowboard' : ''));
    av.seated = !!p.seated;
    av.holding = p.holding || '';
    if (av.current_hat !== (p.current_hat || 'default')) {
      av.current_hat = p.current_hat || 'default';
      buildAvatarHat(av.current_hat, av.hatMat, av.hatGroup);
    }
    applyAvatarSkin(av, p.current_skin, p.role);
    av.emote = p.emote || '';
    if (av.role !== p.role) {
      av.role = p.role;
      const rPfx = p.role === 'admin' ? '👑 ' : (p.role === 'professor' ? '👨‍🏫 ' : (p.role === 'moderator' ? '🛡️ ' : ''));
      const rCol = p.role === 'admin' ? '#fbbf24' : (p.role === 'professor' ? '#fcd34d' : (p.role === 'moderator' ? '#93c5fd' : '#ffffff'));
      if (av.labelSprite) {
        updateTextSprite(av.labelSprite, rPfx + (p.name || 'Aluno'), rCol);
      }
    }
    if (ctx.heldItem && av.holding === ctx.heldItem.id && onDropStolenHeld) {
      onDropStolenHeld();
    }
    if ((p.chat || '') !== av.lastChat) {
      av.lastChat = p.chat || '';
      if (av.lastChat) {
        updateTextSprite(av.chatSprite, '💬 ' + av.lastChat, '#a7f3d0');
        av.chatSprite.visible = true;
      } else {
        av.chatSprite.visible = false;
      }
    }
  });
  Object.keys(remoteAvatars).forEach(function (id) {
    if (!seen[id]) {
      disposeObject3D(remoteAvatars[id].group);
      scene.remove(remoteAvatars[id].group);
      delete remoteAvatars[id];
    }
  });
}

export function animateAvatarExpression(av, dt, holding, chatMsg) {
  if (!av || !av.faceCtx) return;
  av.blinkTimer -= dt;
  const blinkNow = av.blinkTimer <= 0;
  if (av.blinkTimer <= -0.14) av.blinkTimer = 2.4 + Math.random() * 3.5;
  const mood = av.emote === 'rainbow_trip' ? 'trip_meme' : (chatMsg ? 'chat' : (holding ? 'focused' : 'happy'));
  if (mood !== av.lastMood || blinkNow !== av.lastBlink) {
    av.lastMood = mood;
    av.lastBlink = blinkNow;
    drawAvatarFace(av.faceCtx, mood, blinkNow);
    av.faceTex.needsUpdate = true;
  }
}

function ensureRainbowAura(av) {
  if (av.rainbowAuraGroup) return av.rainbowAuraGroup;
  const grp = new THREE.Group();
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.56, 32),
    new THREE.MeshBasicMaterial({ color: 0xff0080, transparent: true, opacity: 0.48, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.025;
  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.39, 32),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.52, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.032;
  grp.add(outerRing, innerRing);
  const orbGeo = new THREE.SphereGeometry(0.028, 8, 8);
  const orbs = [];
  for (let oi = 0; oi < 8; oi++) {
    const col = new THREE.Color().setHSL(oi / 8, 0.95, 0.62);
    const oMat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const orb = new THREE.Mesh(orbGeo, oMat);
    grp.add(orb);
    orbs.push({ mesh: orb, angle: (oi / 8) * Math.PI * 2, phase: oi * 0.75, baseHue: oi / 8 });
  }
  av.group.add(grp);
  av.rainbowAuraGroup = grp;
  av.rainbowAuraOrbs = orbs;
  return grp;
}

export function animateRainbowAura(av, tNow) {
  if (!av) return;
  const active = av.emote === 'rainbow_trip';
  if (!active) {
    if (av.rainbowAuraGroup) av.rainbowAuraGroup.visible = false;
    return;
  }
  const grp = ensureRainbowAura(av);
  grp.visible = true;
  grp.rotation.y = tNow * 0.9;
  const pScale = 1 + Math.sin(tNow * 2.8) * 0.07;
  grp.children[0].scale.set(pScale, pScale, 1);
  grp.children[0].material.color.setHSL((tNow * 0.18) % 1, 0.95, 0.58);
  grp.children[1].material.color.setHSL((tNow * 0.18 + 0.5) % 1, 0.95, 0.62);
  const orbs = av.rainbowAuraOrbs || [];
  for (let oi = 0; oi < orbs.length; oi++) {
    const o = orbs[oi];
    const a = o.angle + tNow * 1.25;
    const h = ((tNow * 0.5 + o.phase) % 1.45) + 0.08;
    const rad = 0.46 + Math.sin(tNow * 2.2 + o.phase) * 0.06;
    o.mesh.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
    o.mesh.material.color.setHSL((o.baseHue + tNow * 0.2) % 1, 0.95, 0.62);
    o.mesh.material.opacity = Math.sin((h - 0.08) / 1.45 * Math.PI) * 0.82;
  }
}

export function animateAvatarAura(av, tNow) {
  if (!av || !av.auraGroup) return;
  av.auraGroup.rotation.y = tNow * 0.7;
  const pScale = 1 + Math.sin(tNow * 2.6) * 0.06;
  av.auraGroup.children[0].scale.set(pScale, pScale, 1);
  for (let oi = 0; oi < av.auraOrbs.length; oi++) {
    const o = av.auraOrbs[oi];
    const a = o.angle + tNow * 1.1;
    const h = ((tNow * 0.45 + o.phase) % 1.45) + 0.08;
    const rad = 0.44 + Math.sin(tNow * 2 + o.phase) * 0.05;
    o.mesh.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
    o.mesh.material.opacity = Math.sin((h - 0.08) / 1.45 * Math.PI) * 0.78;
  }
}

export function stepMultiplayerAvatars(ctx, dt) {
  const { remoteAvatars, clock, auraEnabled, findPickable, heldItem, camera } = ctx;
  const tNow = clock.elapsedTime;
  const nowMs = performance.now();
  const blend = 1 - Math.exp(-12 * dt);
  const camPos = camera ? camera.position : null;

  for (const id in remoteAvatars) {
    if (!Object.prototype.hasOwnProperty.call(remoteAvatars, id)) continue;
    const av = remoteAvatars[id];
    if (auraEnabled) animateAvatarAura(av, tNow);
    animateRainbowAura(av, tNow);

    const prevX = av.group.position.x;
    const prevZ = av.group.position.z;
    const snaps = av.snapshots;
    const renderTime = nowMs - (av.interpDelay || 185);
    let desiredYaw = av.targetYaw;
    let desiredPitch = av.targetPitch;
    _tmpInterpPos.copy(av.targetPos);

    if (snaps && snaps.length >= 2) {
      const s0 = snaps[0], s1 = snaps[snaps.length - 1];
      if (renderTime <= s0.t) {
        _tmpInterpPos.set(s0.x, s0.y, s0.z);
        desiredYaw = s0.yaw;
        desiredPitch = s0.pitch;
      } else if (renderTime >= s1.t) {
        const extrap = Math.min(0.26, (renderTime - s1.t) / 1000);
        const damp = Math.max(0.15, 1 - extrap * 1.8);
        _tmpInterpPos.set(s1.x + s1.vx * extrap * damp, s1.y, s1.z + s1.vz * extrap * damp);
        desiredYaw = s1.yaw;
        desiredPitch = s1.pitch;
      } else {
        for (let si = 0; si < snaps.length - 1; si++) {
          if (renderTime >= snaps[si].t && renderTime <= snaps[si + 1].t) {
            const a = snaps[si], b = snaps[si + 1];
            const spanMs = Math.max(1, b.t - a.t);
            const u = (renderTime - a.t) / spanMs;
            const spanSec = spanMs / 1000;
            const u2 = u * u, u3 = u2 * u;
            const h00 = 2 * u3 - 3 * u2 + 1;
            const h10 = u3 - 2 * u2 + u;
            const h01 = -2 * u3 + 3 * u2;
            const h11 = u3 - u2;
            _tmpInterpPos.set(
              h00 * a.x + h10 * spanSec * a.vx + h01 * b.x + h11 * spanSec * b.vx,
              a.y + (b.y - a.y) * u,
              h00 * a.z + h10 * spanSec * a.vz + h01 * b.z + h11 * spanSec * b.vz
            );
            desiredYaw = normalizeAngle(a.yaw + normalizeAngle(b.yaw - a.yaw) * u);
            desiredPitch = a.pitch + (b.pitch - a.pitch) * u;
            break;
          }
        }
      }
    }

    if (av.campusVehicle?.item.mesh.visible) {
      const { item, seat, at, from } = av.campusVehicle;
      item.mesh.localToWorld(_tmpInterpPos.set(seat === 'driver' ? -0.48 : 0.48, 0.72, 0.05));
      const progress = Math.max(0, Math.min(1, (nowMs - at) / 780));
      av.group.position.copy(from).lerp(_tmpInterpPos, progress * progress * (3 - 2 * progress));
      desiredYaw = item.mesh.rotation.y;
    } else if (av.group.position.distanceToSquared(_tmpInterpPos) > 100) {
      av.group.position.copy(_tmpInterpPos);
    } else {
      av.group.position.lerp(_tmpInterpPos, blend);
    }
    const dYaw = normalizeAngle(desiredYaw - av.group.rotation.y);
    av.group.rotation.y = normalizeAngle(av.group.rotation.y + dYaw * Math.min(1, dt * 12));
    av.headGroup.rotation.x += (desiredPitch - av.headGroup.rotation.x) * Math.min(1, dt * 12);

    const moveSpeed = Math.hypot(av.group.position.x - prevX, av.group.position.z - prevZ) / Math.max(dt, 0.001);
    let heldObj = null;
    if (av.holding) {
      heldObj = findPickable(av.holding);
      if (heldObj && heldObj !== heldItem) {
        const data = heldObj.mesh.userData;
        const isTwo = !!(data.twoHanded || data.firstPersonSideGrip);
        let carryYaw = 0;
        if (isTwo) {
          _tmpAvatarHandOffset.set(0, 0.72, -0.62);
        } else {
          _tmpAvatarHandOffset.set(0.36, 0.88, -0.38);
          if (data.isAlcoholSpray || data.isWaterSpray || data.isH2O2Spray) {
            carryYaw = Math.PI;
            _tmpAvatarHandOffset.set(0.38, 0.81, -0.44);
          } else if (data.firstPersonGrip) {
            const { x, y, z } = data.firstPersonGrip;
            _tmpAvatarHandOffset.set(0.38 - x * heldObj.mesh.scale.x, 0.91 - y * heldObj.mesh.scale.y, -0.38 - z * heldObj.mesh.scale.z);
          }
        }
        _tmpAvatarHandOffset.applyAxisAngle(_tmpAvatarYAxis, av.group.rotation.y);
        heldObj.mesh.position.copy(av.group.position).add(_tmpAvatarHandOffset);
        heldObj.mesh.rotation.set(0, av.group.rotation.y + carryYaw, 0);
        if (heldObj.mesh.userData.updateBounds) heldObj.mesh.userData.updateBounds(heldObj);
        if (heldObj.lidItem && heldObj.lidItem.isAttached) {
          const lidObj = heldObj.lidItem.mesh;
          lidObj.position.set(heldObj.mesh.position.x, heldObj.mesh.position.y + 0.36, heldObj.mesh.position.z);
          lidObj.rotation.copy(heldObj.mesh.rotation);
        }
        if (heldObj.cookerRef && Array.isArray(heldObj.cookerRef.contents)) {
          let nonBaseIdx = 0;
          const potQuat = heldObj.mesh.quaternion;
          const potPos = heldObj.mesh.position;
          for (let cci = 0; cci < heldObj.cookerRef.contents.length; cci++) {
            const cIt = heldObj.cookerRef.contents[cci];
            if (!cIt || !cIt.mesh) continue;
            cIt.mesh.visible = true;
            if (cIt.mesh.userData && cIt.mesh.userData.isCookerBase) {
              _tmpSubOff.set(0, 0.036, 0).applyQuaternion(potQuat).add(potPos);
              cIt.mesh.position.copy(_tmpSubOff);
              cIt.mesh.quaternion.copy(potQuat);
            } else {
              const slot = COOKER_SLOT_OFFSETS[nonBaseIdx % COOKER_SLOT_OFFSETS.length];
              _tmpSubOff.set(slot[0], COOKER_SLOT_Y, slot[1]).applyQuaternion(potQuat).add(potPos);
              cIt.mesh.position.copy(_tmpSubOff);
              cIt.mesh.quaternion.copy(potQuat);
              nonBaseIdx++;
            }
          }
        }
        if (heldObj.trayContents && heldObj.trayContents.length) {
          heldObj.mesh.updateMatrixWorld(true);
          const hRy = heldObj.mesh.rotation.y;
          const hp = heldObj.mesh.position;
          const ch = Math.cos(hRy);
          const sh = Math.sin(hRy);
          for (let tci = 0; tci < heldObj.trayContents.length; tci++) {
            const tc = heldObj.trayContents[tci];
            if (!tc || !tc.item || !tc.item.mesh) continue;
            tc.item.mesh.visible = true;
            if (tc.localOffset) {
              _tmpTrayPt.copy(tc.localOffset);
              heldObj.mesh.localToWorld(_tmpTrayPt);
              tc.item.mesh.position.copy(_tmpTrayPt);
              tc.item.mesh.rotation.set(0, hRy + (tc.localRotY || 0), 0);
            } else {
              tc.item.mesh.position.set(
                hp.x + (tc.lx || 0) * ch + (tc.lz || 0) * sh,
                hp.y + (tc.ly || 0),
                hp.z - (tc.lx || 0) * sh + (tc.lz || 0) * ch
              );
              tc.item.mesh.rotation.set(0, hRy + (tc.lry || 0), 0);
            }
          }
        }
      }
    }
    const twoH = !!(heldObj && (heldObj.mesh.userData.twoHanded || heldObj.mesh.userData.firstPersonSideGrip));
    if (av.toyMode === 'snowboard') {
      if (!av.snowboardMesh) {
        av.snowboardMesh = createRemoteSnowboardMesh();
        av.group.add(av.snowboardMesh);
      }
      av.snowboardMesh.visible = true;
    } else if (av.snowboardMesh) {
      av.snowboardMesh.visible = false;
    }
    if (av.toyMode === 'paraglider') {
      if (!av.paragliderMesh) {
        av.paragliderMesh = createParagliderWingMesh(0.75);
        av.group.add(av.paragliderMesh);
      }
      av.paragliderMesh.visible = true;
    } else if (av.paragliderMesh) {
      av.paragliderMesh.visible = false;
    }
    if (av.toyMode === 'parachute') {
      if (!av.roundParachuteMesh) {
        av.roundParachuteMesh = createRoundParachuteMesh(0.75);
        av.group.add(av.roundParachuteMesh);
      }
      av.roundParachuteMesh.visible = true;
    } else if (av.roundParachuteMesh) {
      av.roundParachuteMesh.visible = false;
    }
    if (av.toyMode === 'paraglider' || av.toyMode === 'parachute') {
      av.leftLeg.rotation.x = 0.7;
      av.rightLeg.rotation.x = 0.7;
      av.leftArm.rotation.x = -2.4;
      av.rightArm.rotation.x = -2.4;
      av.leftArm.rotation.z = 0;
      av.rightArm.rotation.z = 0;
      av.group.rotation.z *= Math.exp(-8 * dt);
    } else if (av.toyMode === 'snowboard') {
      const sbGlide = Math.min(1, moveSpeed / 6.0);
      if (av.torso) {
        av.torso.position.set(0, 0.67, 0);
        av.torso.rotation.x = 0.08 * sbGlide;
        av.torso.rotation.z = Math.sin(av.walkPhase * 0.5) * 0.06 * sbGlide;
      }
      av.headGroup.position.set(0, 1.08, 0);
      av.leftLeg.position.set(-0.10, 0.42, -0.06);
      av.rightLeg.position.set(0.10, 0.42, 0.06);
      av.leftLeg.rotation.x = 0.22;
      av.rightLeg.rotation.x = -0.22;
      av.leftArm.position.set(-0.28, 0.84, 0);
      av.rightArm.position.set(0.28, 0.84, 0);
      av.leftArm.rotation.x = twoH ? 1.05 : -0.15;
      av.rightArm.rotation.x = av.holding ? 1.05 : 0.15;
      av.leftArm.rotation.z = -0.58;
      av.rightArm.rotation.z = 0.58;
      if (sbGlide > 0.08) av.walkPhase += dt * 4.5;
      av.group.rotation.z = Math.sin(av.walkPhase * 0.5) * 0.07 * sbGlide;
    } else if (av.seated || av.campusVehicle) {
      av.leftArm.rotation.z *= Math.exp(-10 * dt);
      av.rightArm.rotation.z *= Math.exp(-10 * dt);
      av.group.rotation.z *= Math.exp(-10 * dt);
      if (av.torso) av.torso.position.set(0, 0.60, 0);
      av.headGroup.position.set(0, 1.01, 0);
      av.leftLeg.position.set(-0.11, 0.41, 0);
      av.rightLeg.position.set(0.11, 0.41, 0);
      av.leftLeg.rotation.x = Math.PI / 2;
      av.rightLeg.rotation.x = Math.PI / 2;
      av.leftArm.position.set(-0.28, 0.78, 0);
      av.rightArm.position.set(0.28, 0.78, 0);
      av.leftArm.rotation.x = twoH ? 1.05 : 0.42;
      av.rightArm.rotation.x = av.holding ? 1.05 : 0.42;
      if (av.labelSprite) av.labelSprite.position.y = 1.84;
      if (av.chatSprite) av.chatSprite.position.y = 2.20;
    } else {
      const resetDecay = Math.exp(-10 * dt);
      av.leftArm.rotation.z *= resetDecay;
      av.rightArm.rotation.z *= resetDecay;
      av.group.rotation.z *= resetDecay;
      if (av.torso) av.torso.position.set(0, 0.64, 0);
      av.headGroup.position.set(0, 1.05, 0);
      av.leftLeg.position.set(-0.10, 0.38, 0);
      av.rightLeg.position.set(0.10, 0.38, 0);
      av.leftArm.position.set(-0.28, 0.82, 0);
      av.rightArm.position.set(0.28, 0.82, 0);
      if (av.labelSprite) av.labelSprite.position.y = 1.92;
      if (av.chatSprite) av.chatSprite.position.y = 2.28;
      const isMoving = moveSpeed > 0.28;
      if (isMoving) {
        const walkIntensity = Math.min(1, moveSpeed / 4.2);
        const stepRate = Math.max(5.5, Math.min(14, moveSpeed * 2.15));
        av.walkPhase += dt * stepRate;
        const swing = Math.sin(av.walkPhase);
        const stepBob = Math.abs(swing) * 0.045 * walkIntensity;
        if (av.torso) {
          av.torso.position.y = 0.64 + stepBob;
          av.torso.rotation.x = 0.06 * walkIntensity;
          av.torso.rotation.z = swing * 0.035 * walkIntensity;
        }
        av.headGroup.position.y = 1.05 + stepBob;
        av.leftLeg.rotation.x = swing * 0.58 * walkIntensity;
        av.rightLeg.rotation.x = -swing * 0.58 * walkIntensity;
        av.leftArm.rotation.x = twoH ? 1.05 : -swing * 0.46 * walkIntensity;
        av.rightArm.rotation.x = av.holding ? 1.05 : swing * 0.46 * walkIntensity;
      } else {
        const stopDecay = Math.exp(-12 * dt);
        if (av.torso) {
          av.torso.position.y += Math.sin(tNow * 2.6 + av.targetYaw) * 0.006;
          av.torso.rotation.x *= stopDecay;
          av.torso.rotation.z *= stopDecay;
        }
        av.leftLeg.rotation.x *= stopDecay;
        av.rightLeg.rotation.x *= stopDecay;
        av.leftArm.rotation.x = twoH ? 1.0 : av.leftArm.rotation.x * stopDecay;
        av.rightArm.rotation.x = av.holding ? 1.0 : av.rightArm.rotation.x * stopDecay;
      }
      if (av.emote && !av.walking && !av.seated) {
        if (av.emote === 'wave') {
          av.rightArm.rotation.x = -Math.PI * 0.82;
          av.rightArm.rotation.z = Math.sin(tNow * 10) * 0.35 + 0.32;
          av.headGroup.rotation.z = Math.sin(tNow * 4) * 0.08;
        } else if (av.emote === 'dance') {
          av.group.rotation.y += Math.sin(tNow * 6) * 0.08;
          if (av.torso) av.torso.position.y = 0.64 + Math.abs(Math.sin(tNow * 8)) * 0.10;
          av.leftArm.rotation.z = Math.sin(tNow * 8) * 0.5 - 0.25;
          av.rightArm.rotation.z = -Math.sin(tNow * 8) * 0.5 + 0.25;
          av.leftLeg.rotation.x = Math.sin(tNow * 8) * 0.30;
          av.rightLeg.rotation.x = -Math.sin(tNow * 8) * 0.30;
        } else if (av.emote === 'cheer') {
          av.leftArm.rotation.x = -Math.PI * 0.88;
          av.rightArm.rotation.x = -Math.PI * 0.88;
          av.leftArm.rotation.z = -0.38;
          av.rightArm.rotation.z = 0.38;
          av.group.position.y += Math.abs(Math.sin(tNow * 9)) * 0.16;
        } else if (av.emote === 'meditate') {
          av.leftLeg.rotation.x = Math.PI / 2;
          av.rightLeg.rotation.x = Math.PI / 2;
          av.leftLeg.rotation.z = -0.3;
          av.rightLeg.rotation.z = 0.3;
          av.leftArm.rotation.x = 0.4; av.leftArm.rotation.z = -0.28;
          av.rightArm.rotation.x = 0.4; av.rightArm.rotation.z = 0.28;
          av.group.position.y += 0.30 + Math.sin(tNow * 2.5) * 0.06;
        } else if (av.emote === 'rainbow_trip') {
          av.headGroup.rotation.z = Math.sin(tNow * 3) * 0.09;
          av.leftArm.rotation.z = -0.22 - Math.abs(Math.sin(tNow * 4)) * 0.16;
          av.rightArm.rotation.z = 0.22 + Math.abs(Math.sin(tNow * 4)) * 0.16;
        }
      }
      if (av.emote && av.emote.indexOf('fx_') === 0) {
        if (av.emote === 'fx_spray') {
          av.rightArm.rotation.x = 1.18 + Math.sin(tNow * 18) * 0.10;
        } else if (av.emote === 'fx_wipe') {
          av.rightArm.rotation.x = 1.12;
          av.rightArm.rotation.z = Math.sin(tNow * 16) * 0.36;
        } else if (av.emote === 'fx_syringe') {
          av.rightArm.rotation.x = 1.25 + Math.sin(tNow * 10) * 0.14;
        } else if (av.emote === 'fx_flame') {
          av.rightArm.rotation.x = 1.16;
          av.rightArm.rotation.z = Math.sin(tNow * 7) * 0.08;
        } else if (av.emote === 'fx_shake') {
          av.rightArm.rotation.x = 1.05 + Math.sin(tNow * 24) * 0.32;
          av.rightArm.rotation.z = Math.cos(tNow * 22) * 0.18;
          if (heldObj && heldObj.mesh) {
            heldObj.mesh.rotation.z = Math.sin(tNow * 26) * 0.18;
          }
        } else if (av.emote === 'fx_mix' || av.emote === 'fx_level') {
          av.rightArm.rotation.x = 1.10 + Math.cos(tNow * 12) * 0.16;
          av.rightArm.rotation.z = Math.sin(tNow * 12) * 0.24;
        } else {
          av.rightArm.rotation.x = 1.14 + Math.sin(tNow * 12) * 0.16;
        }
        if (ctx.onRemoteActionFx && (av._lastFxKey !== av.emote || tNow - (av._lastFxAt || 0) > 1.25)) {
          av._lastFxKey = av.emote;
          av._lastFxAt = tNow;
          ctx.onRemoteActionFx(av.emote, av, heldObj);
        }
      } else {
        av._lastFxKey = '';
      }
    }
    if (av.group.visible && (!camPos || av.group.position.distanceToSquared(camPos) < 3025)) {
      animateAvatarExpression(av, dt, av.holding, av.lastChat);
    }
  }
}
