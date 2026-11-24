/**
 * Balanca Digital de Precisao (MycoCampus3D)
 */

import { GAME_CONFIG } from '../core/config.js';
import { makeBox } from '../engine/textures.js';
import { registerPickable, updateItemBounds, isSurfaceOccupied, getItemWeightGrams, makeRoundedRectShape } from './item-registry.js';

export const PRECISION_SCALE_META = {
  category: 'instrument',
  purpose: 'Pesar substratos, grãos e reagentes com função TARE',
  weightGrams: 1200,
  baseTempC: 24.1,
  compatibilities: { canEnterCooker: false, weighsItemsOnSurface: true },
  connections: ['substrate_5kg', 'pda_bottle', 'beaker_1l', 'spawn_jar', 'spawn_bag']
};

const THREE = window.THREE;
let lastScaleAt = 0;
let scaleBodyGeometry;

export function createPrecisionScale(ctx, id, sx, sy, sz) {
  const sg = new THREE.Group();
  if (!scaleBodyGeometry) {
    scaleBodyGeometry = new THREE.ExtrudeGeometry(makeRoundedRectShape(0.31, 0.37, 0.023), {
      depth: 0.055, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1, curveSegments: 3
    });
    scaleBodyGeometry.rotateX(-Math.PI / 2);
    scaleBodyGeometry.translate(0, 0.005, 0);
    scaleBodyGeometry.userData.shared = true;
  }
  const body = new THREE.Mesh(scaleBodyGeometry, new THREE.MeshStandardMaterial({ color: 0x256763, roughness: 0.67 }));
  body.castShadow = true;
  body.receiveShadow = true;
  const pan = makeBox(0.28, 0.016, 0.26, 0xd9edf0, { metalness: 0.28, roughness: 0.38 });
  pan.position.set(0, 0.073, -0.04);
  const lcdC = document.createElement('canvas'); lcdC.width = 256; lcdC.height = 96;
  const lcdCtx = lcdC.getContext('2d');
  const lcdTex = new THREE.CanvasTexture(lcdC);
  lcdTex.colorSpace = THREE.SRGBColorSpace;
  const lcdScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.068), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false }));
  lcdScreen.position.set(-0.042, 0.066, 0.132);
  lcdScreen.rotation.x = -Math.PI / 2;
  const tareBtn = makeBox(0.06, 0.012, 0.052, 0xf5bf69, { noShadow: true });
  tareBtn.position.set(0.094, 0.069, 0.132);
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
      const isNeg = grams < -0.05;
      const displayGrams = Math.abs(grams) < 0.05 ? 0.0 : grams;
      const txt = (isNeg ? '-' : '') + Math.abs(displayGrams).toFixed(1) + ' g';
      if (txt === this.lastText) return;
      this.lastText = txt;
      lcdCtx.fillStyle = '#102c33'; lcdCtx.fillRect(0, 0, 256, 96);
      lcdCtx.fillStyle = isNeg ? '#ff9d8a' : '#c2fbe4';
      lcdCtx.font = 'bold 56px monospace';
      lcdCtx.textAlign = 'right'; lcdCtx.textBaseline = 'middle';
      lcdCtx.fillText(txt, 240, 52);
      if (this.tare > 0) {
        lcdCtx.fillStyle = isNeg ? '#fca5a5' : '#96dec8';
        lcdCtx.font = 'bold 15px monospace';
        lcdCtx.textAlign = 'left';
        lcdCtx.fillText('TARE', 16, 26);
      }
      lcdTex.needsUpdate = true;
    }
  };
  scaleObj.draw(0);
  tareBtn.userData.scaleObj = scaleObj;
  ctx.scaleTareMeshes.push(tareBtn);
  ctx.scaleDevices.push(scaleObj);
  return registerPickable(ctx, id, 'Balança de Precisão Digital', sg, sx, sy, sz, Math.PI / 2, 0.24, 0.12, PRECISION_SCALE_META);
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
        gross += getItemWeightGrams(pIt);
      }
    }
    scObj.lastGross = gross;
    scObj.draw(gross - scObj.tare);
  }
}
