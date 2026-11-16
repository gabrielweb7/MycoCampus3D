/**
 * Agitador Magnetico MYCO-MAG (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable, updateItemBounds, isSurfaceOccupied } from './item-registry.js';

const THREE = window.THREE;

export function makeMagneticStirrer(ctx, id, px, py, pz) {
  const sg = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.12 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.18 });
  const body = makeBox(0.30, 0.078, 0.28, baseMat, { roughness: 0.35 });
  body.position.set(0, 0.039, -0.04);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.118, 0.018, 24), plateMat);
  plate.position.set(0, 0.088, -0.04);
  const plateRim = new THREE.Mesh(new THREE.TorusGeometry(0.116, 0.006, 8, 24), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 }));
  plateRim.rotation.x = Math.PI / 2; plateRim.position.set(0, 0.082, -0.04);

  const pCan = document.createElement('canvas'); pCan.width = 256; pCan.height = 96;
  const pCtx = pCan.getContext('2d');
  pCtx.fillStyle = '#1d4ed8'; pCtx.fillRect(0, 0, 256, 96);
  pCtx.fillStyle = '#ffffff'; pCtx.font = 'bold 18px system-ui, sans-serif';
  pCtx.textAlign = 'center'; pCtx.fillText('IKA • MYCO-MAG SH-2', 128, 22);
  pCtx.font = 'bold 12px system-ui, sans-serif';
  pCtx.fillStyle = '#bfdbfe';
  pCtx.fillText('STIRRING', 56, 84);
  pCtx.fillText('POWER', 128, 84);
  pCtx.fillText('HEATING', 200, 84);
  const panelMat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(pCan), roughness: 0.3 });
  const frontPanel = makeBox(0.28, 0.068, 0.075, panelMat, { noShadow: true });
  frontPanel.position.set(0, 0.036, 0.12);
  frontPanel.rotation.x = 0.42;

  function makeRotaryKnob(kx) {
    const kg = new THREE.Group();
    const kBase = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.016, 16), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
    const kCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.006, 16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }));
    kCap.position.y = 0.010;
    kg.add(kBase, kCap);
    kg.rotation.x = Math.PI / 2 - 1.15;
    kg.position.set(kx, 0.056, 0.135);
    return kg;
  }
  const knob1 = makeRotaryKnob(-0.075);
  const knob2 = makeRotaryKnob(0.075);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const ledBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
  ledBezel.rotation.x = Math.PI / 2 - 1.15;
  ledBezel.position.set(0, 0.052, 0.139);
  const powerLed = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), ledMat);
  powerLed.position.set(0, 0.056, 0.145);
  sg.add(body, plate, plateRim, frontPanel, knob1, knob2, ledBezel, powerLed);

  const stirSurf = { minX: px - 0.13, maxX: px + 0.13, minZ: pz - 0.16, maxZ: pz + 0.08, topY: py + 0.098 };
  ctx.supportSurfaces.push(stirSurf);
  plate.userData.supportSurface = stirSurf;
  ctx.supportMeshes.push(plate);
  sg.userData.isStirrer = true;
  sg.userData.tableDims = { w: 0.30, h: 0.098, d: 0.34, surfOffset: 0 };
  sg.userData.dynamicSurface = stirSurf;
  sg.userData.updateBounds = updateItemBounds;
  sg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(ctx, stirSurf, it); };

  const stirState = { on: false, ledMat, surface: stirSurf };
  frontPanel.userData.stirSwitch = stirState;
  knob1.children.forEach(function (c) { c.userData.stirSwitch = stirState; ctx.stirSwitchMeshes.push(c); });
  knob2.children.forEach(function (c) { c.userData.stirSwitch = stirState; ctx.stirSwitchMeshes.push(c); });
  ctx.stirSwitchMeshes.push(frontPanel);
  ctx.stirrerDevices.push(stirState);
  return registerPickable(ctx, id, 'Agitador Magnético (MYCO-MAG)', sg, px, py, pz, 0, 0.24, 0.14);
}

export function stepMagneticStirrers(ctx, dt) {
  if (!ctx.stirrerDevices.length) return;
  for (let si = 0; si < ctx.pickableItems.length; si++) {
    const liqIt = ctx.pickableItems[si];
    const lcCtrl = liqIt.mesh && liqIt.mesh.userData.liquidCtrl;
    if (!lcCtrl || !lcCtrl.stirBar) continue;
    const lx = liqIt.mesh.position.x, ly = liqIt.mesh.position.y, lz = liqIt.mesh.position.z;
    for (let sj = 0; sj < ctx.stirrerDevices.length; sj++) {
      const st = ctx.stirrerDevices[sj];
      if (st.on && lx >= st.surface.minX && lx <= st.surface.maxX && lz >= st.surface.minZ && lz <= st.surface.maxZ && Math.abs(ly - st.surface.topY) < 0.08) {
        lcCtrl.stirBar.rotation.y += dt * 18;
        if (lcCtrl.mycCloud) lcCtrl.mycCloud.rotation.y += dt * 4.5;
        break;
      }
    }
  }
}
