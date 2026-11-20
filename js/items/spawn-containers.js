/**
 * Recipientes de Spawn: Vidro 800ml (Milho) e Bag 1,5kg + Colonizacao (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { bindPngTexture, getCachedCanvasTexture, registerPickable } from './item-registry.js';
import { isAsepticWorkArea } from './laminar-hood.js';
import {
  createCultureLifecycleState,
  getCultureRemainingDays,
  isCultureIncubationTemperatureSuitable,
  stepCultureShelfLife
} from './culture-lifecycle.js';

const THREE = window.THREE;

export function getSpawnMeta(kind, filled) {
  const isBag = kind === 'bag';
  return {
    category: 'spawn_container',
    purpose: isBag
      ? 'Bag autoclavável 1,5kg com filtro HEPA e porto de inoculação'
      : 'Vidro 800ml com milho hidratado para colonização de micélio',
    getWeightGrams: (item) => {
      const sc = item && item.spawnCtrl;
      if (!sc) return isBag ? 25 : 320;
      const baseTare = isBag ? 25 : 320;
      return baseTare + (sc.fillGrams || (sc.filled ? (isBag ? 1500 : 460) : 0));
    },
    getTempC: (item) => {
      const sc = item && item.spawnCtrl;
      if (sc && sc.refrigerated) return 4;
      return sc && sc.inoculated ? 26.4 : 23.8;
    },
    compatibilities: {
      canEnterCooker: true,
      receivesSyringe: !!filled,
      receivesSubstrate: !filled,
      receivesMyceliumCut: true
    },
    connections: ['pressure_cooker', 'syringe', 'laminar_hood', 'heat_sealer', 'substrate_5kg']
  };
}

export function fillSpawnWithSubstrate(item, kind) {
  if (!item || !item.spawnCtrl || item.spawnCtrl.filled ||
      !item.meta || !item.meta.compatibilities || !item.meta.compatibilities.receivesSubstrate) return false;
  const sc = item.spawnCtrl;
  sc.filled = true;
  sc.fillGrams = sc.isBag ? 1500 : 460;
  sc.substrateKind = kind || 'grain';
  sc.sealed = false;
  sc.sterilized = false;
  sc.pasteurized = false;
  sc.sterilizeProgress = 0;
  sc.inoculated = false;
  sc.colonization = 0;
  Object.assign(sc, createCultureLifecycleState(false));
  sc.contaminated = false;
  sc.burned = false;
  const isBulkSub = sc.substrateKind === 'coco_verm' || sc.substrateKind === 'sawdust' || sc.substrateKind === 'coco' || sc.substrateKind === 'vermiculite';
  const grainName = sc.substrateKind === 'sorghum' ? 'Sorgo' : (sc.substrateKind === 'wheat' ? 'Trigo' : 'Milho');
  sc.baseLabel = isBulkSub
    ? (sc.isBag ? 'Bag 1,5kg Substrato (Coco + Vermiculita)' : 'Vidro 800ml Substrato (Coco + Vermiculita)')
    : (sc.isBag ? `Bag 1,5kg Spawn (${grainName})` : `Vidro 800ml (${grainName})`);
  if (sc.fillMesh) sc.fillMesh.visible = true;
  if (sc.mycOverlay) sc.mycOverlay.visible = false;
  if (item.meta && item.meta.compatibilities) {
    item.meta.compatibilities.receivesSyringe = true;
    item.meta.compatibilities.receivesSubstrate = false;
    item.meta.compatibilities.acceptsPdaMedium = false;
  }
  updateSpawnVisual(item);
  return true;
}

function getSpawnCultureStatus(item) {
  const sc = item.spawnCtrl;
  const measuredTemperatureC = sc.refrigerated
    ? 4
    : (item.meta && typeof item.meta.getTempC === 'function'
      ? item.meta.getTempC(item)
      : (item.meta && item.meta.baseTempC) || 23.3);
  const temperatureC = Number.isFinite(measuredTemperatureC) ? measuredTemperatureC : 23.3;
  const temperatureLabel = temperatureC.toFixed(1).replace('.', ',') + '°C';
  const genTag = typeof sc.generation === 'number'
    ? (' • [' + (['T0', 'T1', 'T2 Rizomórfica', 'T3 Elite ⭐'][Math.min(3, Math.max(0, sc.generation))] || 'T1') + ']')
    : '';
  const shakeTag = sc.shaken ? ' • Break & Shake 2x ⚡' : '';
  if (sc.expired) return ' • Cultura vencida ⚠️';
  if (sc.colonized) {
    return genTag + shakeTag + ' • ' + temperatureLabel + ' • validade ' + getCultureRemainingDays(sc) + ' dias';
  }
  if (sc.inoculated) {
    return genTag + ' (Colonizando ' + Math.floor(sc.colonization) + '%' + shakeTag + ' • ' + temperatureLabel +
      (sc.refrigerated ? ' • pausada)' : ')');
  }
  return '';
}

export function updateSpawnVisual(item) {
  if (!item || !item.spawnCtrl) return;
  const sc = item.spawnCtrl;
  if (sc.fillMesh && typeof THREE !== 'undefined' && sc.filled && sc.substrateKind !== 'pda' && !sc.isPP5) {
    const A = getSpawnSharedAssets();
    if (sc.substrateKind === 'sorghum') {
      sc.fillMesh.material = sc.isBag ? A.bagSorghumMat : A.jarSorghumMat;
    } else if (sc.substrateKind === 'wheat') {
      sc.fillMesh.material = sc.isBag ? A.bagWheatMat : A.jarWheatMat;
    } else if (sc.substrateKind === 'coco_verm' || sc.substrateKind === 'sawdust' || sc.substrateKind === 'coco' || sc.substrateKind === 'vermiculite') {
      sc.fillMesh.material = A.bagBulkMat;
    } else {
      sc.fillMesh.material = sc.isBag ? A.bagGrainMat : A.cornMatFilled;
    }
  }
  if (sc.sealBand) sc.sealBand.visible = !!sc.sealed;
  if (sc.mycOverlay) {
    sc.mycOverlay.visible = sc.burned || sc.colonization > 0;
    const f = sc.burned ? 1 : Math.min(1, sc.colonization / 100);
    sc.mycOverlay.material.opacity = sc.burned ? 0.85 : (sc.contaminated ? 0.82 : (0.34 + f * 0.62));
    sc.mycOverlay.material.color.setHex(sc.burned ? 0x1c1917 : (sc.contaminated ? 0x15803d : 0xf8fafc));
    const xzScale = sc.isPP5 ? (0.48 + 0.52 * f) : 1;
    sc.mycOverlay.scale.set(xzScale, Math.max(0.08, f), xzScale);
  }
  if (sc.substrateKind === 'pda') {
    if (sc.burned) {
      item.label = sc.baseLabel + ' (Queimado 🔥 Jogue fora)';
    } else if (sc.contaminated) {
      item.label = sc.baseLabel + ' (Contaminado ⚠️)';
    } else if (sc.colonization >= 100) {
      item.label = sc.baseLabel + ' (100% Colonizado ✅)' + getSpawnCultureStatus(item);
    } else if (sc.inoculated) {
      item.label = sc.baseLabel + getSpawnCultureStatus(item);
    } else if (sc.sterilized) {
      item.label = sc.baseLabel + ' (Estéril • Pronto)';
    } else if (sc.sterilizeProgress > 0) {
      item.label = sc.baseLabel + ' (Esterilizando ' + Math.floor(sc.sterilizeProgress) + '%)';
    } else {
      item.label = sc.baseLabel + ' (Não Esterilizado)';
    }
    return;
  }
  if (sc.burned) {
    item.label = sc.baseLabel + ' (Queimado 🔥 Jogue fora)';
  } else if (sc.contaminated) {
    item.label = sc.baseLabel + ' (Contaminado ⚠️)';
  } else if (sc.colonization >= 100) {
    item.label = sc.baseLabel + ' (100% Colonizado ✅)' + getSpawnCultureStatus(item);
  } else if (sc.inoculated) {
    item.label = sc.baseLabel + getSpawnCultureStatus(item);
  } else if (sc.pasteurized) {
    item.label = sc.baseLabel + ' (Pasteurizado 75–85°C ✅ • Pronto p/ Monotub 24L)';
  } else if (sc.pasteurizedOnly) {
    item.label = sc.baseLabel + ' (Apenas Pasteurizado 75°C ⚠️ Grãos exigem Esterilizar a 121°C / 15 PSI!)';
  } else if (sc.sterilized) {
    item.label = sc.baseLabel + ((sc.substrateKind === 'coco_verm' || sc.substrateKind === 'sawdust')
      ? ' (Pasteurizado/Estéril ✅ • Pronto p/ Monotub)'
      : ' (Estéril • Pronto)');
  } else if (sc.sealed) {
    item.label = sc.baseLabel + ' (Selado • Pronto para esterilizar)';
  } else if (sc.sterilizeProgress > 0) {
    item.label = sc.baseLabel + ' (Mal esterilizado ' + Math.floor(sc.sterilizeProgress) + '% ⚠️)';
  } else {
    item.label = sc.baseLabel + ' (Não Esterilizado)';
  }
}

let sharedSpawnAssets = null;
function getSpawnSharedAssets() {
  if (sharedSpawnAssets) return sharedSpawnAssets;
  const cornTexFilled = getCachedCanvasTexture('spawn_jar_corn_filled', 128, 128, (jctx) => {
    jctx.fillStyle = '#eab308'; jctx.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 140; k++) {
      jctx.fillStyle = k % 3 === 0 ? '#ca8a04' : '#fde047';
      jctx.beginPath(); jctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 3, 0, Math.PI * 2); jctx.fill();
    }
  });
  const cornTexEmpty = getCachedCanvasTexture('spawn_jar_corn_empty', 128, 128, (jctx) => {
    jctx.fillStyle = '#d97706'; jctx.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 140; k++) {
      jctx.fillStyle = k % 3 === 0 ? '#ca8a04' : '#fde047';
      jctx.beginPath(); jctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 3, 0, Math.PI * 2); jctx.fill();
    }
  });
  const bagGrainTex = getCachedCanvasTexture('spawn_bag_grains', 128, 128, (bctx) => {
    bctx.fillStyle = '#eab308'; bctx.fillRect(0, 0, 128, 128);
    for (let g = 0; g < 180; g++) {
      bctx.fillStyle = g % 4 === 0 ? '#78350f' : '#fde047';
      bctx.fillRect(Math.random() * 124, Math.random() * 124, 3, 4);
    }
  });
  const bagWheatTex = getCachedCanvasTexture('spawn_bag_wheat', 128, 128, (bctx) => {
    bctx.fillStyle = '#d6b47a'; bctx.fillRect(0, 0, 128, 128);
    for (let g = 0; g < 220; g++) {
      bctx.fillStyle = g % 3 === 0 ? '#a16207' : '#fef3c7';
      bctx.fillRect(Math.random() * 124, Math.random() * 124, 2.5, 4.5);
    }
  });
  const bagBulkTex = getCachedCanvasTexture('spawn_bag_bulk', 128, 128, (bctx) => {
    bctx.fillStyle = '#5c3d2e'; bctx.fillRect(0, 0, 128, 128);
    for (let g = 0; g < 240; g++) {
      bctx.fillStyle = g % 5 === 0 ? '#d6d3d1' : (g % 2 === 0 ? '#3f271c' : '#78513c');
      bctx.fillRect(Math.random() * 124, Math.random() * 124, 2.5, 2.5);
    }
  });
  const sorghumFallbackTex = getCachedCanvasTexture('spawn_sorghum_fallback', 128, 128, (bctx) => {
    bctx.fillStyle = '#4a1812'; bctx.fillRect(0, 0, 128, 128);
    for (let g = 0; g < 260; g++) {
      bctx.fillStyle = g % 3 === 0 ? '#991b1b' : (g % 2 === 0 ? '#b4422a' : '#7c2d12');
      bctx.beginPath();
      bctx.arc(Math.random() * 124 + 2, Math.random() * 124 + 2, 2.8, 0, Math.PI * 2);
      bctx.fill();
    }
  });
  const bagSorghumMat = new THREE.MeshStandardMaterial({ map: sorghumFallbackTex, roughness: 0.82 });
  const jarSorghumMat = new THREE.MeshStandardMaterial({ map: sorghumFallbackTex, roughness: 0.78 });

  const cornMatFilled = new THREE.MeshStandardMaterial({ map: cornTexFilled, roughness: 0.75 });
  const cornMatEmpty = new THREE.MeshStandardMaterial({ map: cornTexEmpty, roughness: 0.75 });
  const bagGrainMat = new THREE.MeshStandardMaterial({ map: bagGrainTex, roughness: 0.85 });
  const bagWheatMat = new THREE.MeshStandardMaterial({ map: bagWheatTex, roughness: 0.85 });
  const jarWheatMat = new THREE.MeshStandardMaterial({ map: bagWheatTex, roughness: 0.78 });
  const bagBulkMat = new THREE.MeshStandardMaterial({ map: bagBulkTex, roughness: 0.90 });

  bindPngTexture('assets/textures/sorghum-grain.png', [bagSorghumMat, jarSorghumMat], { repeatX: 1.5, repeatY: 1.5 });
  bindPngTexture('assets/textures/corn-grain.png', [cornMatFilled, cornMatEmpty, bagGrainMat], { repeatX: 2, repeatY: 2 });
  bindPngTexture('assets/textures/wheat-grain.png', [bagWheatMat, jarWheatMat], { repeatX: 2, repeatY: 2 });
  bindPngTexture('assets/textures/coco-verm-substrate.png', [bagBulkMat], { repeatX: 2, repeatY: 2 });

  sharedSpawnAssets = {
    jarGlassGeo: new THREE.CylinderGeometry(0.11, 0.11, 0.24, 16),
    jarTntGeo: new THREE.CylinderGeometry(0.098, 0.116, 0.036, 16, 1, true),
    jarLidGeo: new THREE.CylinderGeometry(0.096, 0.096, 0.026, 16),
    jarHoleGeo: new THREE.CylinderGeometry(0.022, 0.022, 0.028, 12),
    jarCornGeo: new THREE.CylinderGeometry(0.096, 0.096, 0.195, 16),
    jarMycGeo: new THREE.CylinderGeometry(0.099, 0.099, 0.198, 16),
    bagOuterGeo: new THREE.BoxGeometry(0.24, 0.36, 0.18),
    bagFilterGeo: new THREE.BoxGeometry(0.09, 0.09, 0.012),
    bagPortGeo: new THREE.BoxGeometry(0.036, 0.036, 0.016),
    bagSealGeo: new THREE.BoxGeometry(0.23, 0.016, 0.19),
    bagBlockGeo: new THREE.BoxGeometry(0.215, 0.215, 0.155),
    bagMycGeo: new THREE.BoxGeometry(0.222, 0.22, 0.162),
    jarGlassMat: new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.1, depthWrite: false }),
    tntMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92, side: THREE.DoubleSide }),
    lidFilledMat: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.25 }),
    lidEmptyMat: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.25 }),
    holeMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }),
    cornMatFilled,
    cornMatEmpty,
    bagFilmFilledMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.34, roughness: 0.2, depthWrite: false }),
    bagFilmEmptyMat: new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false }),
    bagFilterMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    bagPortMat: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 }),
    bagSealMat: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.48 }),
    bagGrainMat,
    bagWheatMat,
    jarWheatMat,
    bagBulkMat,
    bagSorghumMat,
    jarSorghumMat
  };
  Object.keys(sharedSpawnAssets).forEach((k) => {
    const v = sharedSpawnAssets[k];
    if (v && v.userData) v.userData.shared = true;
  });
  return sharedSpawnAssets;
}

export function makeSpawnJar800(ctx, id, filled, px, py, pz) {
  const A = getSpawnSharedAssets();
  const jg = new THREE.Group();
  const glass = new THREE.Mesh(A.jarGlassGeo, A.jarGlassMat);
  glass.position.y = 0.12;
  const tntCloth = new THREE.Mesh(A.jarTntGeo, A.tntMat);
  tntCloth.position.y = 0.242;
  const lid = new THREE.Mesh(A.jarLidGeo, filled ? A.lidFilledMat : A.lidEmptyMat);
  lid.position.y = 0.258;
  const lidHole = new THREE.Mesh(A.jarHoleGeo, A.holeMat);
  lidHole.position.y = 0.258;
  jg.add(glass, tntCloth, lid, lidHole);
  const corn = new THREE.Mesh(A.jarCornGeo, filled ? A.cornMatFilled : A.cornMatEmpty);
  corn.position.y = 0.108;
  const jarMycMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 });
  bindPngTexture('assets/textures/mycelium-rhizo.png', jarMycMat, { repeatX: 2, repeatY: 2 });
  const mycOverlay = new THREE.Mesh(
    A.jarMycGeo,
    jarMycMat
  );
  mycOverlay.position.y = 0.108;
  if (filled) jg.add(corn, mycOverlay);
  else { corn.visible = false; mycOverlay.visible = false; jg.add(corn, mycOverlay); }

  const item = registerPickable(ctx, id, 'Vidro 800ml', jg, px, py, pz, 0, 0.16, 0.28, getSpawnMeta('jar', filled));
  item.spawnCtrl = {
    isBag: false,
    filled: !!filled,
    fillGrams: filled ? 460 : 0,
    fillMesh: corn,
    minSterilizeMin: 120,
    sterilizeProgress: filled ? 100 : 0,
    baseLabel: filled ? 'Vidro 800ml (Milho)' : 'Vidro 800ml Vazio',
    sterilized: filled, inoculated: filled,
    colonization: filled ? 100 : 0, contaminated: false,
    ...createCultureLifecycleState(filled),
    mycOverlay,
    updateVisual: function () { updateSpawnVisual(item); }
  };
  item.mesh.userData.spawnCtrl = item.spawnCtrl;
  updateSpawnVisual(item);
  ctx.spawnGrowItems.push(item);
  return item;
}

export function makeSpawnBag1500(ctx, id, filled, px, py, pz) {
  const A = getSpawnSharedAssets();
  const bg = new THREE.Group();
  const outer = new THREE.Mesh(A.bagOuterGeo, filled ? A.bagFilmFilledMat : A.bagFilmEmptyMat);
  outer.receiveShadow = true;
  outer.position.y = 0.18;
  const filterPatch = new THREE.Mesh(A.bagFilterGeo, A.bagFilterMat);
  filterPatch.receiveShadow = true;
  filterPatch.position.set(0, 0.30, 0.092);
  const injPort = new THREE.Mesh(A.bagPortGeo, A.bagPortMat);
  injPort.receiveShadow = true;
  injPort.position.set(0, 0.11, 0.094);
  const sealBand = new THREE.Mesh(A.bagSealGeo, A.bagSealMat);
  sealBand.receiveShadow = true;
  sealBand.position.y = 0.355;
  sealBand.visible = !!filled;
  bg.add(outer, filterPatch, injPort, sealBand);
  const block = new THREE.Mesh(A.bagBlockGeo, A.bagGrainMat);
  block.castShadow = true;
  block.receiveShadow = true;
  block.position.y = 0.115;
  const bagMycMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 });
  bindPngTexture('assets/textures/mycelium-rhizo.png', bagMycMat, { repeatX: 2, repeatY: 2 });
  const mycOverlay = new THREE.Mesh(
    A.bagMycGeo,
    bagMycMat
  );
  mycOverlay.position.y = 0.115;
  if (filled) bg.add(block, mycOverlay);
  else { block.visible = false; mycOverlay.visible = false; bg.add(block, mycOverlay); }

  const item = registerPickable(ctx, id, 'Bag 1,5kg', bg, px, py, pz, 0, 0.22, 0.38, getSpawnMeta('bag', filled));
  item.spawnCtrl = {
    isBag: true,
    filled: !!filled,
    sealed: !!filled,
    fillGrams: filled ? 1500 : 0,
    fillMesh: block,
    sealBand,
    minSterilizeMin: 120, // 2h minimo para milho de pipoca
    sterilizeProgress: filled ? 100 : 0,
    baseLabel: filled ? 'Bag 1,5kg Spawn' : 'Bag 1,5kg Vazio',
    sterilized: filled, inoculated: filled,
    colonization: filled ? 100 : 0, contaminated: false,
    ...createCultureLifecycleState(filled),
    mycOverlay,
    updateVisual: function () { updateSpawnVisual(item); }
  };
  item.mesh.userData.spawnCtrl = item.spawnCtrl;
  updateSpawnVisual(item);
  ctx.spawnGrowItems.push(item);
  return item;
}

export function breakAndShakeSpawn(ctx, item) {
  if (!item || !item.spawnCtrl) return false;
  const sc = item.spawnCtrl;
  if (!sc.inoculated || sc.colonized || sc.contaminated || sc.burned || sc.expired) return false;
  if (sc.colonization < 20 || sc.colonization >= 95 || sc.shaken) return false;
  sc.shaken = true;
  sc.shakeAnimTimer = 0.75;
  sc.colonization = Math.min(95, sc.colonization + 8);
  sc.updateVisual();
  if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_shake');
  if (typeof window !== 'undefined' && window.MycoAudio && typeof window.MycoAudio.playClick === 'function') {
    window.MycoAudio.playClick();
  }
  if (typeof window !== 'undefined' && window.triggerCampusHaptic) {
    window.triggerCampusHaptic('medium');
  }
  if (ctx && ctx.callbacks && ctx.callbacks.onHoldChange && ctx.heldItem === item) {
    ctx.callbacks.onHoldChange(item.label);
  }
  if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(`💥 Break & Shake realizado em ${sc.baseLabel}! Os grãos colonizados foram espalhados — velocidade de colonização dobrada (2.2x)!`);
  }
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

export function stepSpawnColonization(ctx, dt) {
  if (!ctx.spawnGrowItems.length) return;
  for (let sgi = 0; sgi < ctx.spawnGrowItems.length; sgi++) {
    const sgIt = ctx.spawnGrowItems[sgi];
    const sc = sgIt.spawnCtrl;
    if (sc && (sc.shakeAnimTimer || 0) > 0) {
      sc.shakeAnimTimer = Math.max(0, sc.shakeAnimTimer - dt);
      if (sgIt.mesh && sgIt.mesh.rotation) {
        sgIt.mesh.rotation.z = sc.shakeAnimTimer > 0.01 ? Math.sin(sc.shakeAnimTimer * 38) * 0.14 : 0;
      }
    }
    if (sc && sc.isPP5 && sc.lidPivot) {
      const targetP = sc.lidOpen ? 1 : 0;
      if (Math.abs((sc.lidProgress || 0) - targetP) > 0.005) {
        sc.lidProgress = (sc.lidProgress || 0) + (targetP - (sc.lidProgress || 0)) * Math.min(1, dt * 10);
        sc.lidPivot.rotation.z = 1.95 * sc.lidProgress;
      }
      if (sc.lidOpen && sc.filled && sc.sterilized && !sc.contaminated && !isAsepticWorkArea(ctx, sgIt)) {
        sc.contaminated = true;
        sc.updateVisual();
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🦠 O potinho aberto fora do Fluxo Laminar foi contaminado!');
        }
        ctx.notifyWorldAction();
      }
    }
    if (sc && sc.inoculated && !sc.contaminated && !sc.burned) {
      let changed = false;
      const shakeMult = sc.shaken ? 2.2 : 1.0;
      const genMult = 1 + Math.min(3, Math.max(0, sc.generation || 0)) * 0.15;
      const baseRate = 4.2 * shakeMult * genMult;
      const spawnRate = sc.refrigerated
        ? (4.2 * 0.2)
        : (isCultureIncubationTemperatureSuitable(sgIt, ctx) ? baseRate : 0);
      if (sc.colonization < 100 && spawnRate > 0) {
        sc.colonization = Math.min(100, sc.colonization + dt * spawnRate);
        changed = true;
      }
      if (sc.colonization >= 100 && !sc.colonized) {
        sc.colonized = true;
        sc.ageGameDays = 0;
        sc.shelfLifeAgeDays = 0;
        changed = true;
      }
      if (sc.colonized) {
        const lifeStep = stepCultureShelfLife(sc, dt);
        if (lifeStep > 0) changed = true;
        if (lifeStep === 2 && ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🕒 Uma cultura de spawn venceu; prepare uma nova transferência.');
        }
      }
      if (sc.refrigerated !== sc.lastRenderedRefrigerated) changed = true;
      if (changed) sc.updateVisual();
      sc.lastRenderedRefrigerated = sc.refrigerated;
      sc.lastRenderedAgeDay = Math.floor(sc.ageGameDays);
    }
  }
}
