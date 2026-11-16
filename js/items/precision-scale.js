/**
 * Balanca Digital de Precisao (MycoCampus3D)
 */

import { GAME_CONFIG } from '../core/config.js';
import { makeBox } from '../engine/textures.js';
import { registerPickable, updateItemBounds, isSurfaceOccupied } from './item-registry.js';

const THREE = window.THREE;
let lastScaleAt = 0;

export function createPrecisionScale(ctx, id, sx, sy, sz) {
  const sg = new THREE.Group();
  const body = makeBox(0.32, 0.065, 0.38, 0x1e293b, { roughness: 0.45 });
  body.position.y = 0.0325;
  const pan = makeBox(0.28, 0.016, 0.26, 0xe2e8f0, { metalness: 0.82, roughness: 0.22 });
  pan.position.set(0, 0.073, -0.04);
  const lcdC = document.createElement('canvas'); lcdC.width = 256; lcdC.height = 96;
  const lcdCtx = lcdC.getContext('2d');
  const lcdTex = new THREE.CanvasTexture(lcdC);
  const lcdScreen = makeBox(0.18, 0.045, 0.01, new THREE.MeshBasicMaterial({ map: lcdTex }), { noShadow: true });
  lcdScreen.position.set(-0.04, 0.045, 0.192);
  lcdScreen.rotation.x = -0.35;
  const tareBtn = makeBox(0.065, 0.028, 0.016, 0x22c55e, { noShadow: true });
  tareBtn.position.set(0.095, 0.042, 0.194);
  tareBtn.rotation.x = -0.35;
  sg.add(body, pan, lcdScreen, tareBtn);

  const scSurf = { minX: sx - 0.15, maxX: sx + 0.15, minZ: sz - 0.18, maxZ: sz + 0.10, topY: sy + 0.082 };
  ctx.supportSurfaces.push(scSurf);
  pan.userData.supportSurface = scSurf;
  ctx.supportMeshes.push(pan);
  sg.userData.isScale = true;
  sg.userData.tableDims = { w: 0.32, h: 0.082, d: 0.38, surfOffset: 0 };
  sg.userData.dynamicSurface = scSurf;
  sg.userData.updateBounds = updateItemBounds;
  sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(ctx, scSurf, it); };

  const scaleObj = {
    tare: 0, lastText: '', lastGross: 0, surface: scSurf,
    lcdCtx, lcdTex,
    draw: function (grams) {
      const txt = grams.toFixed(1) + ' g';
      if (txt === this.lastText) return;
      this.lastText = txt;
      lcdCtx.fillStyle = '#064e3b'; lcdCtx.fillRect(0, 0, 256, 96);
      lcdCtx.fillStyle = '#34d399'; lcdCtx.font = 'bold 46px monospace';
      lcdCtx.textAlign = 'right'; lcdCtx.textBaseline = 'middle';
      lcdCtx.fillText(txt, 240, 50);
      lcdTex.needsUpdate = true;
    }
  };
  scaleObj.draw(0);
  tareBtn.userData.scaleObj = scaleObj;
  ctx.scaleTareMeshes.push(tareBtn);
  ctx.scaleDevices.push(scaleObj);
  return registerPickable(ctx, id, 'Balança de Precisão Digital', sg, sx, sy, sz, Math.PI / 2, 0.24, 0.12);
}

export function stepPrecisionScales(ctx, now) {
  if (!ctx.scaleDevices.length || (lastScaleAt && now - lastScaleAt <= GAME_CONFIG.lab.scaleRefreshMs)) return;
  lastScaleAt = now;

  for (let sci = 0; sci < ctx.scaleDevices.length; sci++) {
    const scObj = ctx.scaleDevices[sci];
    let gross = 0;
    for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
      const pIt = ctx.pickableItems[pi];
      if (ctx.heldItem === pIt || pIt.mesh.userData.tableDims || pIt.potItem) continue;
      const px0 = pIt.mesh.position.x, py0 = pIt.mesh.position.y, pz0 = pIt.mesh.position.z;
      if (px0 >= scObj.surface.minX && px0 <= scObj.surface.maxX && pz0 >= scObj.surface.minZ && pz0 <= scObj.surface.maxZ && py0 >= scObj.surface.topY - 0.04 && py0 <= scObj.surface.topY + 0.45) {
        if (pIt.mesh.userData.liquidCtrl) gross += 260 + pIt.mesh.userData.liquidCtrl.volMl;
        else if (pIt.id.indexOf('spawn_jar_empty') === 0) gross += 320;
        else if (pIt.id.indexOf('spawn_jar') === 0) gross += 780;
        else if (pIt.id.indexOf('spawn_bag_empty') === 0) gross += 25;
        else if (pIt.id.indexOf('spawn_bag') === 0) gross += 1525;
        else if (pIt.id.indexOf('pda_bottle') === 0) gross += 540;
        else if (pIt.id.indexOf('petri_bare_') === 0) gross += 18;
        else if (pIt.id.indexOf('petri_') === 0) gross += 38;
        else if (pIt.mesh.userData.isSyringe) gross += 12 + pIt.mesh.userData.syrCtrl.volMl;
        else if (pIt.mesh.userData.isAlcoholSpray) gross += 380;
        else if (pIt.id.indexOf('substrate_') === 0) gross += 5000;
        else if (pIt.id.indexOf('gloves_box_') === 0) gross += 420;
        else if (pIt.id.indexOf('foil_roll_') === 0) gross += 260;
        else if (pIt.id.indexOf('micropore_') === 0 || pIt.id.indexOf('parafilm_') === 0) gross += 65;
        else gross += 150;
      }
    }
    scObj.lastGross = gross;
    scObj.draw(gross - scObj.tare);
  }
}
