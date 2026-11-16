/**
 * Recipientes de Spawn: Vidro 800ml (Milho) e Bag 1,5kg + Colonizacao (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

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
    getTempC: (item) => (item && item.spawnCtrl && item.spawnCtrl.inoculated) ? 26.4 : 23.8,
    compatibilities: { canEnterCooker: true, receivesSyringe: !!filled },
    connections: ['pressure_cooker', 'syringe', 'laminar_hood', 'heat_sealer', 'substrate_5kg']
  };
}

export function fillSpawnWithSubstrate(item, kind) {
  if (!item || !item.spawnCtrl || item.spawnCtrl.filled) return false;
  const sc = item.spawnCtrl;
  sc.filled = true;
  sc.fillGrams = sc.isBag ? 1500 : 460;
  sc.substrateKind = kind || 'grain';
  sc.sealed = false;
  sc.sterilized = false;
  sc.sterilizeProgress = 0;
  sc.inoculated = false;
  sc.colonized = false;
  sc.colonization = 0;
  sc.contaminated = false;
  sc.burned = false;
  sc.baseLabel = sc.isBag ? 'Bag 1,5kg Spawn' : 'Vidro 800ml (Milho)';
  if (sc.fillMesh) sc.fillMesh.visible = true;
  if (sc.mycOverlay) sc.mycOverlay.visible = false;
  if (item.meta && item.meta.compatibilities) {
    item.meta.compatibilities.receivesSyringe = true;
  }
  updateSpawnVisual(item);
  return true;
}

export function updateSpawnVisual(item) {
  if (!item || !item.spawnCtrl) return;
  const sc = item.spawnCtrl;
  if (sc.sealBand) sc.sealBand.visible = !!sc.sealed;
  if (sc.mycOverlay) {
    sc.mycOverlay.visible = sc.burned || sc.colonization > 0;
    const f = sc.burned ? 1 : Math.min(1, sc.colonization / 100);
    sc.mycOverlay.material.opacity = sc.burned ? 0.85 : (sc.contaminated ? 0.72 : (0.15 + f * 0.78));
    sc.mycOverlay.material.color.setHex(sc.burned ? 0x1c1917 : (sc.contaminated ? 0x15803d : 0xf8fafc));
    sc.mycOverlay.scale.set(1, Math.max(0.15, f), 1);
  }
  if (sc.burned) {
    item.label = sc.baseLabel + ' (Queimado 🔥 Jogue fora)';
  } else if (sc.contaminated) {
    item.label = sc.baseLabel + ' (Contaminado ⚠️)';
  } else if (sc.colonization >= 100) {
    item.label = sc.baseLabel + ' (100% Colonizado ✅)';
  } else if (sc.inoculated) {
    item.label = sc.baseLabel + ' (Colonizando ' + Math.floor(sc.colonization) + '%)';
  } else if (sc.sterilized) {
    item.label = sc.baseLabel + ' (Estéril • Pronto)';
  } else if (sc.sealed) {
    item.label = sc.baseLabel + ' (Selado • Pronto para esterilizar)';
  } else if (sc.sterilizeProgress > 0) {
    item.label = sc.baseLabel + ' (Mal esterilizado ' + Math.floor(sc.sterilizeProgress) + '% ⚠️)';
  } else {
    item.label = sc.baseLabel + ' (Não Esterilizado)';
  }
}

export function makeSpawnJar800(ctx, id, filled, px, py, pz) {
  const jg = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.1, depthWrite: false })
  );
  glass.position.y = 0.12;
  // Folha de TNT branca entre o gargalo e a tampa
  const tntCloth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098, 0.116, 0.036, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.92, side: THREE.DoubleSide })
  );
  tntCloth.position.y = 0.242;
  // Tampa preta com furo central para troca gasosa (TNT visivel no furo)
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.096, 0.096, 0.026, 16),
    new THREE.MeshStandardMaterial({ color: filled ? 0x111827 : 0x334155, roughness: 0.4, metalness: 0.25 })
  );
  lid.position.y = 0.258;
  const lidHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.028, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 })
  );
  lidHole.position.y = 0.258;
  jg.add(glass, tntCloth, lid, lidHole);
  const jc = document.createElement('canvas'); jc.width = 128; jc.height = 128;
  const jctx = jc.getContext('2d');
  jctx.fillStyle = filled ? '#eab308' : '#d97706'; jctx.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 140; k++) {
    jctx.fillStyle = k % 3 === 0 ? '#ca8a04' : '#fde047';
    jctx.beginPath(); jctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 3, 0, Math.PI * 2); jctx.fill();
  }
  const corn = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.195, 16), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(jc), roughness: 0.75 }));
  corn.position.y = 0.108;
  const mycOverlay = new THREE.Mesh(
    new THREE.CylinderGeometry(0.099, 0.099, 0.198, 16),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 })
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
    minSterilizeMin: 120, // 2h minimo para milho de pipoca
    sterilizeProgress: filled ? 100 : 0,
    baseLabel: filled ? 'Vidro 800ml (Milho)' : 'Vidro 800ml Vazio',
    sterilized: filled, inoculated: filled, colonized: filled,
    colonization: filled ? 100 : 0, contaminated: false,
    mycOverlay,
    updateVisual: function () { updateSpawnVisual(item); }
  };
  item.mesh.userData.spawnCtrl = item.spawnCtrl;
  updateSpawnVisual(item);
  ctx.spawnGrowItems.push(item);
  return item;
}

export function makeSpawnBag1500(ctx, id, filled, px, py, pz) {
  const bg = new THREE.Group();
  const filmMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: filled ? 0.34 : 0.28, roughness: 0.2, depthWrite: false });
  const outer = makeBox(0.24, 0.36, 0.18, filmMat, { noShadow: true });
  outer.position.y = 0.18;
  const filterPatch = makeBox(0.09, 0.09, 0.012, 0xffffff, { noShadow: true });
  filterPatch.position.set(0, 0.30, 0.092);
  const injPort = makeBox(0.036, 0.036, 0.016, 0x64748b, { noShadow: true });
  injPort.position.set(0, 0.11, 0.094);
  const sealBand = makeBox(0.23, 0.016, 0.19, 0xf59e0b, { noShadow: true, roughness: 0.48 });
  sealBand.position.y = 0.355;
  sealBand.visible = !!filled;
  bg.add(outer, filterPatch, injPort, sealBand);
  const bc = document.createElement('canvas'); bc.width = 128; bc.height = 128;
  const bctx = bc.getContext('2d');
  bctx.fillStyle = '#eab308'; bctx.fillRect(0, 0, 128, 128);
  for (let g = 0; g < 180; g++) {
    bctx.fillStyle = g % 4 === 0 ? '#78350f' : '#fde047';
    bctx.fillRect(Math.random() * 124, Math.random() * 124, 3, 4);
  }
  const block = makeBox(0.215, 0.215, 0.155, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(bc), roughness: 0.85 }));
  block.position.y = 0.115;
  const mycOverlay = makeBox(0.222, 0.22, 0.162, new THREE.MeshStandardMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.0, roughness: 0.85 }));
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
    sterilized: filled, inoculated: filled, colonized: filled,
    colonization: filled ? 100 : 0, contaminated: false,
    mycOverlay,
    updateVisual: function () { updateSpawnVisual(item); }
  };
  item.mesh.userData.spawnCtrl = item.spawnCtrl;
  updateSpawnVisual(item);
  ctx.spawnGrowItems.push(item);
  return item;
}

export function stepSpawnColonization(ctx, dt) {
  if (!ctx.spawnGrowItems.length) return;
  for (let sgi = 0; sgi < ctx.spawnGrowItems.length; sgi++) {
    const sgIt = ctx.spawnGrowItems[sgi];
    const sc = sgIt.spawnCtrl;
    if (sc && sc.inoculated && sc.colonization < 100) {
      sc.colonization = Math.min(100, sc.colonization + dt * 4.2);
      sc.updateVisual();
    }
  }
}
