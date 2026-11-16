/**
 * Capela de Fluxo Laminar Horizontal & Bancadas do Lab (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable, updateItemBounds, isSurfaceOccupied } from './item-registry.js';
import { addMovableStainlessTable } from './stainless-table.js';

const THREE = window.THREE;

export function isAsepticWorkArea(ctx, item) {
  const air = ctx.hoodAirData;
  const area = air && air.workArea;
  const pos = item && item.mesh && item.mesh.position;
  return !!(air && air.on && area && pos &&
    performance.now() < ctx.hoodSanitizedUntil &&
    pos.x >= area.minX && pos.x <= area.maxX &&
    pos.z >= area.minZ && pos.z <= area.maxZ &&
    pos.y >= area.topY - 0.15 && pos.y <= area.topY + 0.6);
}

export const LAMINAR_HOOD_META = {
  category: 'equipment',
  purpose: 'Cabine de fluxo laminar HEPA para trabalho asséptico e inoculação estéril',
  weightGrams: 45000,
  getTempC: (item, ctx) => (ctx && ctx.hoodAirData && ctx.hoodAirData.on) ? 21.2 : 23.5,
  compatibilities: { canEnterCooker: false, requiresSanitization: true, supportsItemsOnSurface: true },
  connections: ['alcohol_spray', 'petri_dish', 'syringe', 'spawn_jar', 'spawn_bag']
};

export function buildLaminarHoodAndBenches(ctx) {
  const scene = ctx.scene;
  const solidColliders = ctx.solidColliders;
  const supportSurfaces = ctx.supportSurfaces;
  const supportMeshes = ctx.supportMeshes;

  function addWallLabBench(bx, bz, bw, bd) {
    const cab = makeBox(bw, 0.82, bd, 0xe2e8f0, { roughness: 0.55 });
    cab.position.set(bx, 0.14 + 0.41, bz);
    const trim = makeBox(bw + 0.02, 0.72, bd + 0.02, 0x0284c7, { roughness: 0.5 });
    trim.position.set(bx, 0.14 + 0.36, bz);
    const top = makeBox(bw + 0.04, 0.06, bd + 0.04, 0x94a3b8, { roughness: 0.35, metalness: 0.25 });
    top.position.set(bx, 0.14 + 0.85, bz);
    scene.add(trim, cab, top);
    solidColliders.push({ minX: bx - bw / 2 - 0.05, maxX: bx + bw / 2 + 0.05, minZ: bz - bd / 2 - 0.05, maxZ: bz + bd / 2 + 0.05, minY: 0.14, maxY: 1.02, surfaceTopY: 1.02 });
    const benchSurf = { minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2, topY: 1.02 };
    supportSurfaces.push(benchSurf);
    top.userData.supportSurface = benchSurf;
    supportMeshes.push(top);
  }
  addWallLabBench(-23.15, -7.0, 1.2, 10.6);
  addWallLabBench(-18.5, -12.0, 8.1, 1.1);

  const rackX = -19.2, rackZ = -1.85;
  const rackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.65, roughness: 0.3 });
  [0.62, 1.18, 1.74].forEach(function (sy) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 0.68), rackMat);
    sh.position.set(rackX, 0.14 + sy, rackZ);
    scene.add(sh);
    const shSurf = { minX: rackX - 1.55, maxX: rackX + 1.55, minZ: rackZ - 0.3, maxZ: rackZ + 0.3, topY: 0.14 + sy + 0.02 };
    supportSurfaces.push(shSurf);
    sh.userData.supportSurface = shSurf;
    supportMeshes.push(sh);
  });
  [-1.56, 1.56].forEach(function (pxOff) {
    [-0.31, 0.31].forEach(function (pzOff) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8), rackMat);
      post.position.set(rackX + pxOff, 0.14 + 0.95, rackZ + pzOff);
      scene.add(post);
    });
  });
  solidColliders.push({ minX: rackX - 1.65, maxX: rackX + 1.65, minZ: rackZ - 0.38, maxZ: rackZ + 0.38, minY: 0.14, maxY: 2.1 });

  addMovableStainlessTable(ctx, 'table_hood_lab', 'Mesa Inox (Fluxo Laminar)', -18.5, 0.12, -8.2, 1.5, 0.90, 2.4);

  const hoodGroup = new THREE.Group();
  const hoodBackBox = makeBox(0.32, 1.08, 2.34, 0x0f172a, { roughness: 0.45, metalness: 0.4 });
  hoodBackBox.position.set(-0.58, 0.54, 0);
  const hepaCanvas = document.createElement('canvas');
  hepaCanvas.width = 256; hepaCanvas.height = 128;
  const hctx = hepaCanvas.getContext('2d');
  hctx.fillStyle = '#f8fafc';
  hctx.fillRect(0, 0, 256, 128);
  hctx.strokeStyle = '#cbd5e1';
  hctx.lineWidth = 1.5;
  for (let hx = -128; hx < 384; hx += 8) {
    hctx.beginPath(); hctx.moveTo(hx, 0); hctx.lineTo(hx + 128, 128); hctx.stroke();
    hctx.beginPath(); hctx.moveTo(hx + 128, 0); hctx.lineTo(hx, 128); hctx.stroke();
  }
  const hepaTex = new THREE.CanvasTexture(hepaCanvas);
  hepaTex.wrapS = hepaTex.wrapT = THREE.RepeatWrapping;
  hepaTex.repeat.set(3, 2);
  const hepaMat = new THREE.MeshStandardMaterial({ map: hepaTex, emissive: 0xe0f2fe, emissiveIntensity: 0.35, roughness: 0.6 });
  const hepa = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.94, 2.16), hepaMat);
  hepa.position.set(-0.41, 0.54, 0);
  const hoodTop = makeBox(1.10, 0.06, 2.34, 0x0f172a, { roughness: 0.4 });
  hoodTop.position.set(0.10, 1.08, 0);
  const hoodGlassL = makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
  hoodGlassL.position.set(0.115, 0.545, -1.15);
  hoodGlassL.userData.ignoreRay = true;
  const hoodGlassR = makeBox(1.07, 1.01, 0.04, 0xbae6fd, { transparent: true, opacity: 0.26 });
  hoodGlassR.position.set(0.115, 0.545, 1.15);
  hoodGlassR.userData.ignoreRay = true;
  const hoodBase = makeBox(1.39, 0.04, 2.34, 0xcbd5e1, { metalness: 0.72, roughness: 0.28 });
  hoodBase.position.set(-0.045, 0.02, 0);
  const hoodWorkMat = makeBox(1.03, 0.008, 2.24, 0x334155, { metalness: 0.55, roughness: 0.35 });
  hoodWorkMat.position.set(0.115, 0.042, 0);
  const hoodFrontLip = makeBox(0.03, 0.045, 2.34, 0x0f172a, { metalness: 0.5, roughness: 0.4 });
  hoodFrontLip.position.set(0.64, 0.0225, 0);

  const hoodSwitchBox = makeBox(0.06, 0.14, 0.10, 0x1e293b, { noShadow: true });
  hoodSwitchBox.position.set(0.62, 1.05, 1.13);
  const hoodBtnMesh = makeBox(0.03, 0.06, 0.06, 0x38bdf8, { noShadow: true });
  hoodBtnMesh.position.set(0.65, 1.03, 1.13);
  const hoodLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const hoodLedBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 14), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
  hoodLedBezel.rotation.z = Math.PI / 2;
  hoodLedBezel.position.set(0.648, 1.095, 1.13);
  const hoodLed = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), hoodLedMat);
  hoodLed.position.set(0.656, 1.095, 1.13);

  const airCount = 56;
  const airPos = new Float32Array(airCount * 3);
  for (let ai = 0; ai < airCount; ai++) {
    airPos[ai * 3] = -0.36 + Math.random() * 1.15;
    airPos[ai * 3 + 1] = 0.10 + Math.random() * 0.85;
    airPos[ai * 3 + 2] = (Math.random() - 0.5) * 2.0;
  }
  const airGeo = new THREE.BufferGeometry();
  const airAttr = new THREE.BufferAttribute(airPos, 3);
  airGeo.setAttribute('position', airAttr);
  const airPoints = new THREE.Points(airGeo, new THREE.PointsMaterial({ color: 0xbae6fd, size: 0.045, transparent: true, opacity: 0.72 }));
  airPoints.userData.ignoreRay = true;
  hoodGroup.add(hoodBackBox, hepa, hoodTop, hoodGlassL, hoodGlassR, hoodBase, hoodWorkMat, hoodFrontLip, hoodSwitchBox, hoodBtnMesh, hoodLedBezel, hoodLed, airPoints);

  const hoodLight = new THREE.PointLight(0xe0f2fe, 0.95, 4.0, 1.8);
  hoodLight.position.set(-18.5, 1.82, -8.2);
  scene.add(hoodLight);

  const hoodSurf = { minX: -19.08, maxX: -17.85, minZ: -9.32, maxZ: -7.08, topY: 1.065, isHood: true };
  const hoodAirData = { on: true, points: airPoints, attr: airAttr, hepaMat, ledMat: hoodLedMat, workLight: hoodLight, workArea: hoodSurf };
  if (ctx.setHoodAirData) ctx.setHoodAirData(hoodAirData);
  hoodBtnMesh.userData.hoodSwitch = hoodAirData;
  hoodSwitchBox.userData.hoodSwitch = hoodAirData;
  ctx.hoodSwitchMeshes.push(hoodBtnMesh, hoodSwitchBox);

  supportSurfaces.push(hoodSurf);
  hoodBase.userData.supportSurface = hoodSurf;
  hoodWorkMat.userData.supportSurface = hoodSurf;
  supportMeshes.push(hoodBase, hoodWorkMat);
  hoodGroup.userData.twoHanded = true;
  hoodGroup.userData.isHood = true;
  hoodGroup.userData.tableDims = { w: 1.39, h: 0.045, d: 2.34, surfOffset: 0 };
  hoodGroup.userData.dynamicSurface = hoodSurf;
  hoodGroup.userData.updateBounds = updateItemBounds;
  hoodGroup.userData.isBlockedPickup = function (item) { return isSurfaceOccupied(ctx, hoodSurf, item); };
  return registerPickable(ctx, 'laminar_hood_lab', 'Capela de Fluxo Laminar', hoodGroup, -18.5, 1.02, -8.2, 0, 0.85, 1.1, LAMINAR_HOOD_META);
}

export function stepLaminarHood(ctx, dt) {
  if (!ctx.hoodAirData || !ctx.hoodAirData.on || !ctx.hoodAirData.attr) return;
  const aArr = ctx.hoodAirData.attr.array;
  for (let ai = 0; ai < aArr.length; ai += 3) {
    aArr[ai] += dt * 1.45;
    if (aArr[ai] > 0.78) {
      aArr[ai] = -0.36;
      aArr[ai + 1] = 0.10 + Math.random() * 0.85;
      aArr[ai + 2] = (Math.random() - 0.5) * 2.0;
    }
  }
  ctx.hoodAirData.attr.needsUpdate = true;
}
