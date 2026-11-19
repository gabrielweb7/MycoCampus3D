/**
 * Potinho PP5 145ml (Autoclavavel) para Cultura Solida com Flocao de Milho (MycoCampus3D)
 * Esterilizacao minima: 1h20m (80 min).
 */

import { getCachedCanvasTexture, mergeStaticGeos, registerPickable } from './item-registry.js';
import { updateSpawnVisual } from './spawn-containers.js';
import { createCultureLifecycleState } from './culture-lifecycle.js';
import { attachPdaMediumCtrl } from './pda-mix.js';

const THREE = window.THREE;

let sharedPP5Assets = null;
function getPP5SharedAssets() {
  if (sharedPP5Assets) return sharedPP5Assets;
  const bodyGeo = new THREE.CylinderGeometry(0.044, 0.036, 0.056, 18, 1, true);
  const botGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.004, 18);
  const cupShellGeo = mergeStaticGeos([
    { geo: bodyGeo, y: 0.028 },
    { geo: botGeo, y: 0.002 }
  ]);
  bodyGeo.dispose();
  botGeo.dispose();

  const flocaoTex = getCachedCanvasTexture('pp5_flocao_128', 128, 128, (fctx) => {
    fctx.fillStyle = '#f59e0b'; fctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 220; i++) {
      fctx.fillStyle = i % 3 === 0 ? '#d97706' : '#fde047';
      fctx.fillRect(Math.random() * 124, Math.random() * 124, 3, 3);
    }
  });

  sharedPP5Assets = {
    cupShellGeo,
    lidGeo: new THREE.CylinderGeometry(0.047, 0.046, 0.008, 18),
    flocaoGeo: new THREE.CylinderGeometry(0.040, 0.033, 0.032, 16),
    mycGeo: new THREE.CylinderGeometry(0.041, 0.034, 0.034, 16),
    liquidGeo: new THREE.CylinderGeometry(0.032, 0.030, 0.034, 16),
    ppMat: new THREE.MeshStandardMaterial({
      color: 0xf8fafc, transparent: true, opacity: 0.36, roughness: 0.22, depthWrite: false
    }),
    flocaoMat: new THREE.MeshStandardMaterial({ map: flocaoTex, roughness: 0.85 })
  };
  Object.keys(sharedPP5Assets).forEach((k) => {
    const v = sharedPP5Assets[k];
    if (v && v.userData) v.userData.shared = true;
  });
  return sharedPP5Assets;
}

export const PP5_STACK_SPACING = 0.062;
export const PP5_STACK_ALIGNMENT_RADIUS = 0.045;
export const PP5_STACK_AIM_DISTANCE_SQ = 0.0064;

export function getPP5Meta(filled) {
  return {
    category: 'solid_culture',
    purpose: 'Potinho PP5 145ml para flocão de milho ou meio PDA/BDA (esterilizar 1h)',
    minSterilizeMin: 60,
    getWeightGrams: (item) => {
      const sc = item && item.spawnCtrl;
      if (!sc) return 12;
      const liquid = item.mesh && item.mesh.userData.liquidCtrl;
      const medium = item.pdaMediumCtrl;
      return 12 + (sc.fillGrams || 0) + (sc.waterMl || 0) +
        (liquid ? liquid.volMl : 0) + (medium ? medium.powderGrams : 0);
    },
    getTempC: (item) => (item && item.spawnCtrl && typeof item.spawnCtrl.tempC === 'number')
      ? item.spawnCtrl.tempC
      : ((item && item.spawnCtrl && item.spawnCtrl.inoculated) ? 26.1 : 23.5),
    compatibilities: {
      canEnterCooker: true,
      receivesSyringe: !!filled,
      receivesSubstrate: false,
      receivesFlocao: !filled,
      receivesWater: !!filled,
      fillsFromSink: false,
      acceptsPdaMedium: !filled,
      receivesMyceliumCut: true
    },
    connections: ['flocao_500g', 'beaker_1l', 'pda_media_bottle', 'pressure_cooker', 'scalpel', 'syringe', 'laminar_hood']
  };
}

export function makePP5Cup145ml(ctx, id, filled, px, py, pz) {
  const A = getPP5SharedAssets();
  const cg = new THREE.Group();
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.044, 0.058, 0);
  const lid = new THREE.Mesh(A.lidGeo, A.ppMat);
  lid.position.set(0.044, 0, 0);
  lidPivot.add(lid);

  const flocaoMesh = new THREE.Mesh(A.flocaoGeo, A.flocaoMat);
  flocaoMesh.position.y = 0.018;
  flocaoMesh.visible = !!filled;

  const mycOverlay = new THREE.Mesh(
    A.mycGeo,
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 })
  );
  mycOverlay.position.y = 0.019;
  mycOverlay.visible = false;

  const liquidMesh = new THREE.Mesh(
    A.liquidGeo,
    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.62, roughness: 0.14 })
  );
  liquidMesh.visible = false;
  if (A.cupShellGeo) {
    cg.add(flocaoMesh, liquidMesh, mycOverlay, new THREE.Mesh(A.cupShellGeo, A.ppMat), lidPivot);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.036, 0.056, 18, 1, true), A.ppMat);
    body.position.y = 0.028;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 18), A.ppMat);
    bottom.position.y = 0.002;
    cg.add(flocaoMesh, liquidMesh, mycOverlay, body, bottom, lidPivot);
  }
  cg.userData.liquidCtrl = {
    volMl: 0,
    maxMl: 100,
    baseY: 0.002,
    maxH: 0.034,
    liqMesh: liquidMesh,
    mycCloud: null,
    stirBar: null,
    baseLabel: 'Potinho PP5 145ml'
  };

  const item = registerPickable(ctx, id, 'Potinho PP5 145ml (Vazio)', cg, px, py, pz, 0, 0.06, 0.065, getPP5Meta(!!filled));
  item.spawnCtrl = {
    isPP5: true,
    filled: !!filled,
    fillGrams: filled ? 45 : 0,
    waterMl: filled ? 35 : 0,
    substrateKind: filled ? 'flocao' : '',
    fillMesh: flocaoMesh,
    lidPivot,
    lidOpen: false,
    lidProgress: 0,
    minSterilizeMin: 60, // 1h minimo para potinho flocao
    sterilizeProgress: filled ? 100 : 0,
    baseLabel: filled ? 'Potinho PP5 145ml (Flocão)' : 'Potinho PP5 145ml Vazio',
    sterilized: false,
    inoculated: false,
    colonization: 0,
    ...createCultureLifecycleState(false),
    contaminated: false,
    mycOverlay,
    updateVisual: function () {
      updateSpawnVisual(item);
      if (item.meta && item.meta.compatibilities) {
        item.meta.compatibilities.receivesSyringe = item.spawnCtrl.filled;
        item.meta.compatibilities.receivesFlocao = !item.spawnCtrl.filled;
        item.meta.compatibilities.receivesWater = item.spawnCtrl.filled &&
          item.spawnCtrl.substrateKind !== 'pda' && (item.spawnCtrl.waterMl || 0) < 35;
        item.meta.compatibilities.acceptsPdaMedium = !item.spawnCtrl.filled;
      }
      if (item.spawnCtrl.substrateKind === 'flocao' && item.spawnCtrl.fillGrams > 0 &&
          item.spawnCtrl.waterMl === 0 && !item.spawnCtrl.inoculated) {
        item.label = 'Potinho PP5 145ml (Flocão seco • Adicione água)';
      }
    }
  };
  item.mesh.userData.spawnCtrl = item.spawnCtrl;
  attachPdaMediumCtrl(item, 'pp5', false);
  item.spawnCtrl.updateVisual();
  ctx.spawnGrowItems.push(item);
  return item;
}

export function preparePP5ForPda(item) {
  const spawn = item && item.spawnCtrl;
  if (!spawn || !spawn.isPP5 || spawn.filled || !item.pdaMediumCtrl) return false;
  spawn.filled = true;
  spawn.fillGrams = 0;
  spawn.waterMl = 0;
  spawn.substrateKind = 'pda';
  spawn.baseLabel = 'Potinho PP5 145ml (PDA/BDA)';
  spawn.sealed = false;
  spawn.sterilized = false;
  spawn.sterilizeProgress = 0;
  spawn.inoculated = false;
  spawn.colonization = 0;
  Object.assign(spawn, createCultureLifecycleState(false));
  spawn.contaminated = false;
  spawn.burned = false;
  if (spawn.fillMesh) spawn.fillMesh.visible = false;
  if (item.meta && item.meta.compatibilities) {
    item.meta.compatibilities.acceptsPdaMedium = false;
    item.meta.compatibilities.receivesFlocao = false;
  }
  spawn.updateVisual();
  return true;
}

export function setPP5LidOpen(item, open, instant = false) {
  const sc = item && item.spawnCtrl;
  if (!sc || !sc.isPP5 || !sc.lidPivot) return false;
  const next = !!open;
  if (sc.lidOpen === next && !instant) return false;
  sc.lidOpen = next;
  if (instant) {
    sc.lidProgress = next ? 1 : 0;
    sc.lidPivot.rotation.z = 1.95 * sc.lidProgress;
  }
  return true;
}

export function togglePP5Lid(ctx, item) {
  const sc = item && item.spawnCtrl;
  if (!sc || !sc.isPP5) return false;
  const changed = setPP5LidOpen(item, !sc.lidOpen, false);
  if (changed) {
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  }
  return changed;
}
