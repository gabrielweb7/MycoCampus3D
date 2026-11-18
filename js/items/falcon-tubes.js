/**
 * Tubos Falcon Conicos (15ml e 50ml) + Estante Azul (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable, makeScaleTex, updateItemBounds } from './item-registry.js';
import { updateContainerVolume } from './liquid-culture.js';

const THREE = window.THREE;

export function getFalconMeta(maxMl) {
  const is50 = maxMl >= 50;
  return {
    category: 'tube',
    purpose: is50
      ? 'Tubo Falcon 50ml para alíquotas de cultura líquida, slants ou esporos'
      : 'Tubo Falcon 15ml para coleta de esporos, slants e amostras estéreis',
    maxVolumeMl: maxMl,
    baseTempC: 23.4,
    getWeightGrams: (item) => (is50 ? 14 : 7) +
      ((item && item.mesh && item.mesh.userData.liquidCtrl) ? item.mesh.userData.liquidCtrl.volMl : 0) +
      ((item && item.pdaMediumCtrl) ? item.pdaMediumCtrl.powderGrams : 0),
    compatibilities: {
      canEnterCooker: true,
      receivesSyringe: true,
      fillsFromSink: true,
      poursWater: true,
      receivesWater: true,
      acceptsPdaMedium: !is50
    },
    connections: ['syringe', 'liquid_culture', 'lab_sink', 'pressure_cooker', 'laminar_hood']
  };
}

export function makeFalconTube(ctx, id, maxMl, px, py, pz, initMl) {
  const is50 = maxMl >= 50;
  const r = is50 ? 0.024 : 0.015;
  const bodyH = is50 ? 0.125 : 0.115;
  const coneH = is50 ? 0.032 : 0.028;
  const capColor = is50 ? 0xea580c : 0x2563eb; // Tampa laranja (50ml) ou azul (15ml)

  const fg = new THREE.Group();
  const ppMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9, transparent: true, opacity: 0.36, roughness: 0.15, depthWrite: false
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyH, 16, 1, true), ppMat);
  body.position.y = coneH + bodyH / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, coneH, 16, 1, true), ppMat);
  cone.rotation.x = Math.PI;
  cone.position.y = coneH / 2;

  const gradCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.0005, r + 0.0005, bodyH * 0.85, 14, 1, true),
    new THREE.MeshBasicMaterial({ map: makeScaleTex(maxMl, is50 ? 10 : 5, maxMl + 'ml'), transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide })
  );
  gradCyl.position.y = coneH + bodyH * 0.45;

  const liqMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.86, r * 0.86, bodyH * 0.9, 14),
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.65, roughness: 0.12 })
  );

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.18, r * 1.18, 0.024, 16),
    new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.38 })
  );
  cap.position.y = coneH + bodyH + 0.012;

  fg.add(liqMesh, body, cone, gradCyl, cap);
  fg.userData.liquidCtrl = {
    volMl: initMl || 0,
    maxMl,
    baseY: coneH,
    maxH: bodyH * 0.9,
    liqMesh,
    mycCloud: null,
    stirBar: null,
    baseLabel: 'Tubo Falcon ' + maxMl + 'ml'
  };

  const item = registerPickable(ctx, id, 'Tubo Falcon ' + maxMl + 'ml', fg, px, py, pz, 0, 0.06, coneH + bodyH + 0.03, getFalconMeta(maxMl));
  item.setVolume = function (v) { updateContainerVolume(item, v); };
  updateContainerVolume(item, initMl || 0);
  return item;
}

export function makeFalconRack(ctx, rx, ry, rz) {
  const rg = new THREE.Group();
  rg.position.set(rx, ry, rz);
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42 });
  const topPlate = makeBox(0.24, 0.012, 0.16, blueMat);
  topPlate.position.y = 0.065;
  const botPlate = makeBox(0.24, 0.012, 0.16, blueMat);
  botPlate.position.y = 0.006;
  [[-0.105, -0.065], [0.105, -0.065], [-0.105, 0.065], [0.105, 0.065]].forEach(function (p) {
    const post = makeBox(0.014, 0.065, 0.014, blueMat);
    post.position.set(p[0], 0.035, p[1]);
    rg.add(post);
  });
  rg.add(topPlate, botPlate);
  const rackSurf = {
    minX: rx - 0.12,
    maxX: rx + 0.12,
    minZ: rz - 0.08,
    maxZ: rz + 0.08,
    topY: ry + 0.012
  };
  if (ctx.supportSurfaces) ctx.supportSurfaces.push(rackSurf);
  if (ctx.supportMeshes) {
    botPlate.userData.supportSurface = rackSurf;
    ctx.supportMeshes.push(botPlate);
  }
  rg.userData.isTray = true;
  rg.userData.isFalconRack = true;
  rg.userData.tableDims = { w: 0.24, h: 0.012, d: 0.16, surfOffset: 0 };
  rg.userData.dynamicSurface = rackSurf;
  rg.userData.updateBounds = updateItemBounds;
  const rackItem = registerPickable(ctx, 'falcon_rack_lab', 'Suporte Azul de Tubos Falcon', rg, rx, ry, rz, 0, 0.14, 0.08, {
    category: 'tool',
    purpose: 'Suporte para transportar e organizar Tubos Falcon / Slants',
    weightGrams: 180,
    compatibilities: { canEnterCooker: false, supportsItemsOnSurface: true }
  });
  return rackItem.mesh;
}
