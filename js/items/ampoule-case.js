/**
 * Maleta Porta-Ampolas 3ML (50 Vagas) + Ampolas 3ML Transparentes c/ Cultura Líquida & Micélio
 * Suporta diversas espécies (Cubensis, Raros & Comestíveis), contaminação visual,
 * extração direta c/ Seringa 10ml e organização por modal interativo.
 */

import { registerPickable, updateItemBounds } from './item-registry.js';
import { createCultureLifecycleState } from './culture-lifecycle.js';
import { releaseInputForModal } from '../ui/dom-helpers.js';

const THREE = typeof window !== 'undefined' ? window.THREE : undefined;

export const AMPOULE_CASE_MAX_SLOTS = 50;
export const AMPOULE_VIAL_MAX_ML = 3;

export const AMPOULE_SPECIES_CATALOG = [
  // Cubensis & Psicoativos
  { speciesName: 'Golden Teacher (Psilocybe cubensis)', group: 'Cubensis', desc: 'Chapéu âmbar-dourado clássico c/ véu', color: '#f59e0b' },
  { speciesName: 'Penis Envy (Psilocybe cubensis)', group: 'Cubensis', desc: 'Estipe grosso carnudo e chapéu bulboso', color: '#fbbf24' },
  { speciesName: 'Jack Frost Albino (Psilocybe cubensis)', group: 'Cubensis', desc: 'Branco-gelo com lamelas azuladas', color: '#bae6fd' },
  { speciesName: "Avery's Albino (Psilocybe cubensis)", group: 'Cubensis', desc: 'Albino marfim delicado de ciclo rápido', color: '#f8fafc' },
  { speciesName: 'B+ Cubensis (Psilocybe cubensis)', group: 'Cubensis', desc: 'Cânone largo caramelo muito resistente', color: '#d97706' },
  { speciesName: 'Cambodian Cubensis (Psilocybe cubensis)', group: 'Cubensis', desc: 'Colonização vigorosa e pinagem intensa', color: '#eab308' },
  { speciesName: 'Blue Meanie (Panaeolus cyanescens)', group: 'Cubensis', desc: 'Haste fininha c/ azulamento intenso', color: '#94a3b8' },
  { speciesName: 'Wavy Cap (Psilocybe azurescens)', group: 'Cubensis', desc: 'Chapéu ondulado caramelo-castanho', color: '#b45309' },

  // Comestíveis Gourmet
  { speciesName: 'Shimeji Branco (Pleurotus ostreatus)', group: 'Comestível', desc: 'Buquês em conchas branco-peroladas', color: '#e2e8f0' },
  { speciesName: 'Shimeji Rosa (Pleurotus djamor)', group: 'Comestível', desc: 'Cachos vibrantes rosa-salmão', color: '#fb7185' },
  { speciesName: 'Shimeji Dourado (Pleurotus citrinopileatus)', group: 'Comestível', desc: 'Buquês amarelo-limão dourado', color: '#facc15' },
  { speciesName: 'Eryngii Rei (Pleurotus eryngii)', group: 'Comestível', desc: 'Caule branco robusto e chapéu avelã', color: '#d6b588' },
  { speciesName: 'Shiitake (Lentinula edodes)', group: 'Comestível', desc: 'Chapéu marrom chocolate arredondado', color: '#92400e' },
  { speciesName: 'Enoki Branco (Flammulina velutipes)', group: 'Comestível', desc: 'Tufos fofos de caules longos e finos', color: '#fef3c7' },
  { speciesName: 'Chanterelle Dourado (Cantharellus cibarius)', group: 'Comestível', desc: 'Formato trompete amarelo-ouro', color: '#facc15' },
  { speciesName: 'Morel Colmeia (Morchella esculenta)', group: 'Comestível', desc: 'Chapéu cônico favo-de-mel raro', color: '#a16207' },

  // Raros, Medicinais & Bioluminescentes
  { speciesName: 'Juba de Leão (Hericium erinaceus)', group: 'Raro', desc: 'Pompom branco felpudo medicinal', color: '#ffffff' },
  { speciesName: 'Reishi Vermelho (Ganoderma lucidum)', group: 'Raro', desc: 'Leques vermelhos laqueados brilhantes', color: '#dc2626' },
  { speciesName: 'Cordyceps Militaris', group: 'Raro', desc: 'Bastões alaranjados vibrantes raros', color: '#f97316' },
  { speciesName: 'Lactário Azul Índigo (Lactarius indigo)', group: 'Raro', desc: 'Funil azul-índigo exótico', color: '#3b82f6' },
  { speciesName: 'Cogumelo Neon (Mycena chlorophos)', group: 'Raro', desc: 'Bioluminescente verde-esmeralda!', color: '#4ade80' },
  { speciesName: 'Cauda de Peru (Trametes versicolor)', group: 'Raro', desc: 'Camadas em leque multicoloridas', color: '#0ea5e9' },
  { speciesName: 'Coral Roxo (Clavaria zollingeri)', group: 'Raro', desc: 'Ramificações coral violeta', color: '#a855f7' },
  { speciesName: 'Taça Carmim (Cookeina speciosa)', group: 'Raro', desc: 'Tacinhas tropicais rosa-carmim', color: '#f43f5e' }
];

let sharedAmpouleAssets = null;
function getAmpouleAssets() {
  if (sharedAmpouleAssets || !THREE) return sharedAmpouleAssets;
  sharedAmpouleAssets = {
    vialGlassGeo: new THREE.CylinderGeometry(0.010, 0.010, 0.028, 12),
    vialNeckGeo: new THREE.CylinderGeometry(0.0068, 0.009, 0.005, 10),
    vialCrimpGeo: new THREE.CylinderGeometry(0.0085, 0.0085, 0.0045, 12),
    vialCapGeo: new THREE.CylinderGeometry(0.0092, 0.0092, 0.0042, 12),
    vialLiqGeo: new THREE.CylinderGeometry(0.0084, 0.0084, 0.022, 10),
    vialMycGeo: new THREE.SphereGeometry(0.0062, 8, 6),
    glassMat: new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.30,
      roughness: 0.08,
      metalness: 0.12,
      depthWrite: false
    }),
    crimpMat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.22 }),
    orangeCapMat: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.38 }),
    caseBodyMat: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.62, metalness: 0.15 }),
    caseFoamMat: new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.92 }),
    caseWellMat: new THREE.MeshBasicMaterial({ color: 0x020617 }),
    wellGeo: new THREE.CylinderGeometry(0.0108, 0.0108, 0.004, 10),
    latchMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.25 })
  };
  Object.keys(sharedAmpouleAssets).forEach((k) => {
    const v = sharedAmpouleAssets[k];
    if (v && v.userData) v.userData.shared = true;
  });
  return sharedAmpouleAssets;
}

export function buildVial3mlMeshGroup(opts = {}) {
  const A = getAmpouleAssets();
  const vg = new THREE.Group();
  const glass = new THREE.Mesh(A.vialGlassGeo, A.glassMat);
  glass.position.y = 0.014;
  const neck = new THREE.Mesh(A.vialNeckGeo, A.glassMat);
  neck.position.y = 0.0305;
  const crimp = new THREE.Mesh(A.vialCrimpGeo, A.crimpMat);
  crimp.position.y = 0.035;
  const cap = new THREE.Mesh(A.vialCapGeo, A.orangeCapMat);
  cap.position.y = 0.039;

  const isContam = !!opts.contaminated;
  const liqMat = new THREE.MeshStandardMaterial({
    color: isContam ? 0x3f6212 : 0xfde68a,
    transparent: true,
    opacity: isContam ? 0.84 : 0.56,
    roughness: 0.16,
    depthWrite: false
  });
  const liqMesh = new THREE.Mesh(A.vialLiqGeo, liqMat);
  liqMesh.position.y = 0.013;

  const mycMat = new THREE.MeshStandardMaterial({
    color: isContam ? 0x1a2e05 : 0xffffff,
    transparent: true,
    opacity: isContam ? 0.90 : 0.86,
    roughness: 0.90
  });
  const mycCloud = new THREE.Mesh(A.vialMycGeo, mycMat);
  mycCloud.scale.set(1.0, 0.85, 1.0);
  mycCloud.position.y = 0.011;

  vg.add(liqMesh, mycCloud, glass, neck, crimp, cap);
  return { vg, liqMesh, mycCloud };
}

export function updateVial3mlVisual(item) {
  if (!item || !item.vial3mlCtrl) return;
  const vc = item.vial3mlCtrl;
  const lc = item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
  const cc = item.cultureCtrl;
  const volMl = lc ? Math.max(0, Math.min(AMPOULE_VIAL_MAX_ML, Number(lc.volMl) || 0)) : 0;
  const isContam = !!(cc && cc.contaminated);
  const isColonized = !!(cc && (cc.colonized || cc.inoculated) && volMl > 0.05);
  const isSterile = !isContam && (!!vc.sterilized || !!(lc && lc.sterilized) || !!item.sterilized);

  if (vc.liqMesh) {
    vc.liqMesh.visible = volMl > 0.05;
    if (vc.liqMesh.visible) {
      const frac = Math.max(0.08, volMl / AMPOULE_VIAL_MAX_ML);
      vc.liqMesh.scale.y = frac;
      vc.liqMesh.position.y = 0.003 + (0.022 * frac) * 0.5;
      vc.liqMesh.material.color.setHex(isContam ? 0x3f6212 : 0xfde68a);
      vc.liqMesh.material.opacity = isContam ? 0.86 : 0.56;
    }
  }
  if (vc.mycCloud) {
    vc.mycCloud.visible = volMl > 0.05 && (isColonized || isContam);
    if (vc.mycCloud.visible) {
      vc.mycCloud.material.color.setHex(isContam ? 0x1a2e05 : 0xf8fafc);
      vc.mycCloud.material.opacity = isContam ? 0.92 : (cc && cc.colonized ? 0.88 : 0.48);
    }
  }

  const volStr = (Math.round(volMl * 10) / 10).toFixed(volMl % 1 === 0 ? 0 : 1);
  const spName = (cc && cc.speciesName) || vc.speciesName || 'Golden Teacher';
  if (volMl <= 0.05) {
    item.label = `🧪 Ampola 3ML Vazia (${isSterile ? 'Estéril ✅' : 'Não Esterilizada ⚠️'})`;
  } else if (isContam) {
    item.label = `🧪 Ampola 3ML (${spName} • ${volStr}/3 ml • Contaminada 🦠)`;
  } else {
    item.label = `🧪 Ampola 3ML (${spName} • ${volStr}/3 ml • ${isColonized ? 'Micélio Saudável ✅' : 'Estéril'})`;
  }
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function getVialMeta(opts = {}) {
  return {
    category: 'culture_liquid',
    icon: '🧪',
    purpose: 'Ampola de vidro transparente 3ML com cultura líquida estéril; aspire com Seringa 10ml ou guarde na Maleta',
    weightGrams: 11,
    baseTempC: opts.contaminated ? 26.8 : 23.5,
    compatibilities: {
      canEnterCooker: true,
      receivesSyringe: true,
      transfersLiquidCulture: true
    },
    connections: ['syringe_10ml', 'ampoule_case', 'pressure_cooker', 'culture_fridge'],
    serializeState: (item) => {
      const cc = item.cultureCtrl;
      const lc = item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
      return {
        speciesName: (cc && cc.speciesName) || (item.vial3mlCtrl && item.vial3mlCtrl.speciesName) || '',
        group: (item.vial3mlCtrl && item.vial3mlCtrl.group) || 'Cubensis',
        volMl: lc ? Number((lc.volMl || 0).toFixed(2)) : 3,
        colonized: !!(cc && cc.colonized),
        contaminated: !!(cc && cc.contaminated),
        sterilized: !!(item.sterilized || (lc && lc.sterilized))
      };
    },
    applyState: (item, custom, _sim) => {
      if (!custom || !item || !item.vial3mlCtrl) return;
      if (typeof custom.speciesName === 'string' && custom.speciesName) {
        item.vial3mlCtrl.speciesName = custom.speciesName;
        if (item.cultureCtrl) item.cultureCtrl.speciesName = custom.speciesName;
      }
      if (typeof custom.group === 'string') item.vial3mlCtrl.group = custom.group;
      const lc = item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
      if (lc && typeof custom.volMl === 'number') lc.volMl = Math.max(0, Math.min(AMPOULE_VIAL_MAX_ML, custom.volMl));
      if (item.cultureCtrl) {
        if (typeof custom.colonized === 'boolean') {
          item.cultureCtrl.colonized = custom.colonized;
          item.cultureCtrl.inoculated = custom.colonized;
          item.cultureCtrl.colonization = custom.colonized ? 100 : 0;
        }
        if (typeof custom.contaminated === 'boolean') item.cultureCtrl.contaminated = custom.contaminated;
      }
      if (typeof custom.sterilized === 'boolean') {
        item.sterilized = custom.sterilized;
        item.vial3mlCtrl.sterilized = custom.sterilized;
        if (lc) lc.sterilized = custom.sterilized;
      }
      updateVial3mlVisual(item);
    }
  };
}

export function makeVial3ml(ctx, id, px, py, pz, opts = {}) {
  const speciesName = opts.speciesName || AMPOULE_SPECIES_CATALOG[0].speciesName;
  const group = opts.group || 'Cubensis';
  const volMl = opts.volMl !== undefined ? Math.max(0, Math.min(AMPOULE_VIAL_MAX_ML, Number(opts.volMl))) : AMPOULE_VIAL_MAX_ML;
  const colonized = opts.colonized !== undefined ? !!opts.colonized : volMl > 0.05;
  const contaminated = !!opts.contaminated;
  const sterilized = !contaminated && (opts.sterilized !== undefined ? !!opts.sterilized : true);

  const built = buildVial3mlMeshGroup({ contaminated });
  const vg = built.vg;
  vg.userData.liquidCtrl = {
    volMl,
    maxMl: AMPOULE_VIAL_MAX_ML,
    baseY: 0.003,
    maxH: 0.022,
    liqMesh: built.liqMesh,
    mycCloud: built.mycCloud,
    stirBar: null,
    sterilized,
    baseLabel: 'Ampola 3ML'
  };

  const item = registerPickable(ctx, id, '🧪 Ampola 3ML', vg, px, py, pz, 0, 0.024, 0.044, getVialMeta(opts));
  item.sterilized = sterilized;
  item.cultureCtrl = {
    inoculated: colonized,
    colonized,
    colonization: colonized ? 100 : 0,
    contaminated,
    sterilized,
    generation: 2,
    speciesName,
    ...createCultureLifecycleState(colonized)
  };
  vg.userData.cultureCtrl = item.cultureCtrl;
  item.vial3mlCtrl = {
    speciesName,
    group,
    sterilized,
    liqMesh: built.liqMesh,
    mycCloud: built.mycCloud
  };
  vg.userData.vial3mlCtrl = item.vial3mlCtrl;
  if (item.meta) item.meta.prefabId = 'vial_3ml';
  vg.userData.prefabId = 'vial_3ml';
  updateVial3mlVisual(item);
  return item;
}

function buildStarterCaseSlots() {
  const slots = new Array(AMPOULE_CASE_MAX_SLOTS).fill(null);
  for (let i = 0; i < AMPOULE_SPECIES_CATALOG.length && i < AMPOULE_CASE_MAX_SLOTS; i++) {
    const sp = AMPOULE_SPECIES_CATALOG[i];
    slots[i] = {
      speciesName: sp.speciesName,
      group: sp.group,
      desc: sp.desc,
      volMl: AMPOULE_VIAL_MAX_ML,
      colonized: true,
      contaminated: false,
      sterilized: true
    };
  }
  return slots;
}

export function updateAmpouleCaseVisual(item) {
  if (!item || !item.caseCtrl) return;
  const cc = item.caseCtrl;
  let filledCount = 0;
  let contamCount = 0;
  for (let i = 0; i < AMPOULE_CASE_MAX_SLOTS; i++) {
    const slotData = cc.slots[i];
    const visual = cc.slotVisuals && cc.slotVisuals[i];
    if (slotData) {
      filledCount += 1;
      if (slotData.contaminated) contamCount += 1;
      if (visual) {
        visual.root.visible = true;
        if (visual.liqMesh) {
          const frac = Math.max(0.08, (slotData.volMl || 0) / AMPOULE_VIAL_MAX_ML);
          visual.liqMesh.visible = (slotData.volMl || 0) > 0.05;
          visual.liqMesh.scale.y = frac;
          visual.liqMesh.position.y = 0.003 + (0.022 * frac) * 0.5;
          visual.liqMesh.material.color.setHex(slotData.contaminated ? 0x3f6212 : 0xfde68a);
          visual.liqMesh.material.opacity = slotData.contaminated ? 0.86 : 0.56;
        }
        if (visual.mycCloud) {
          visual.mycCloud.visible = (slotData.volMl || 0) > 0.05 && (slotData.colonized || slotData.contaminated);
          visual.mycCloud.material.color.setHex(slotData.contaminated ? 0x1a2e05 : 0xf8fafc);
        }
      }
    } else if (visual) {
      visual.root.visible = false;
    }
  }
  const lidStatus = cc.lidOpen ? 'Aberta' : 'Fechada';
  const contamTag = contamCount > 0 ? ` • ${contamCount} Contaminadas 🦠` : '';
  item.label = `💼 Maleta Porta-Ampolas 3ML (${filledCount}/${AMPOULE_CASE_MAX_SLOTS} ampolas • ${lidStatus}${contamTag})`;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
}

export function toggleAmpouleCaseLid(ctx, item, openState) {
  if (!item || !item.caseCtrl) return false;
  const cc = item.caseCtrl;
  const next = openState !== undefined ? !!openState : !cc.lidOpen;
  if (cc.lidOpen === next) return false;
  cc.lidOpen = next;
  updateAmpouleCaseVisual(item);
  if (ctx && ctx.heldItem === item && ctx.callbacks && ctx.callbacks.onHoldChange) {
    ctx.callbacks.onHoldChange(item.label);
  }
  if (typeof window !== 'undefined' && window.MycoAudio && window.MycoAudio.playClick) {
    window.MycoAudio.playClick();
  }
  if (ctx && ctx.markItemMoved) ctx.markItemMoved(item);
  if (ctx && ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

export function takeVialFromAmpouleCase(ctx, caseItem, slotIndex) {
  if (!caseItem || !caseItem.caseCtrl) return null;
  const cc = caseItem.caseCtrl;
  if (slotIndex < 0 || slotIndex >= AMPOULE_CASE_MAX_SLOTS) return null;
  const entry = cc.slots[slotIndex];
  if (!entry) return null;
  if (ctx && ctx.heldItem) {
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🤲 Esvazie suas mãos antes de retirar uma Ampola 3ML da maleta.');
    }
    return null;
  }

  cc.slots[slotIndex] = null;
  updateAmpouleCaseVisual(caseItem);

  const px = caseItem.mesh ? caseItem.mesh.position.x : 0;
  const py = caseItem.mesh ? caseItem.mesh.position.y + 0.08 : 1.0;
  const pz = caseItem.mesh ? caseItem.mesh.position.z : 0;
  const vial = makeVial3ml(ctx, 'dyn_vial3ml_' + Date.now().toString(36) + '_' + slotIndex, px, py, pz, entry);

  if (ctx) {
    ctx.heldItem = vial;
    ctx.lastPickupAt = performance.now();
    ctx.heldRotY = 0;
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(vial.label);
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(`🧪 Pegou Ampola 3ML: ${entry.speciesName}! Use a Seringa 10ml para inocular grãos/PDA!`);
    }
    if (ctx.markItemMoved) ctx.markItemMoved(caseItem);
    if (ctx.markItemMoved) ctx.markItemMoved(vial);
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
  }
  return vial;
}

export function storeVialInAmpouleCase(ctx, caseItem, vialItem, targetSlotIndex = -1) {
  if (!caseItem || !caseItem.caseCtrl || !vialItem || !vialItem.vial3mlCtrl) return false;
  const cc = caseItem.caseCtrl;
  if (!cc.lidOpen) {
    toggleAmpouleCaseLid(ctx, caseItem, true);
  }
  let slotIdx = targetSlotIndex;
  if (slotIdx < 0 || slotIdx >= AMPOULE_CASE_MAX_SLOTS || cc.slots[slotIdx]) {
    slotIdx = cc.slots.findIndex((s) => !s);
  }
  if (slotIdx === -1) {
    if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('💼 A Maleta Porta-Ampolas está cheia (50/50 vagas ocupadas)!');
    }
    return false;
  }

  const lc = vialItem.mesh && vialItem.mesh.userData && vialItem.mesh.userData.liquidCtrl;
  const cult = vialItem.cultureCtrl;
  const vc = vialItem.vial3mlCtrl;
  cc.slots[slotIdx] = {
    speciesName: (cult && cult.speciesName) || vc.speciesName || 'Golden Teacher (Psilocybe cubensis)',
    group: vc.group || 'Cubensis',
    volMl: lc ? Math.max(0, Math.min(AMPOULE_VIAL_MAX_ML, Number(lc.volMl) || 0)) : 3,
    colonized: !!(cult && cult.colonized),
    contaminated: !!(cult && cult.contaminated),
    sterilized: !!(vialItem.sterilized || (lc && lc.sterilized))
  };
  updateAmpouleCaseVisual(caseItem);

  if (ctx) {
    vialItem._removedForSync = true;
    if (ctx.pendingMovedItems && vialItem.id) {
      ctx.pendingMovedItems[vialItem.id] = { id: vialItem.id, state: { custom: { removed: true } } };
    }
    if (vialItem.mesh && vialItem.mesh.parent) vialItem.mesh.parent.remove(vialItem.mesh);
    if (Array.isArray(ctx.pickableItems)) {
      const idx = ctx.pickableItems.indexOf(vialItem);
      if (idx !== -1) ctx.pickableItems.splice(idx, 1);
    }
    if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
      ctx.pickableMap.delete(vialItem.id);
    }
    if (ctx.heldItem === vialItem) {
      ctx.heldItem = null;
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
    }
    if (ctx.markItemMoved) ctx.markItemMoved(caseItem);
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(`💼 Ampola guardada na vaga #${slotIdx + 1} (${cc.slots[slotIdx].speciesName})!`);
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
  }
  return true;
}

export function openAmpouleCaseModal(ctx, caseItem) {
  if (!caseItem || !caseItem.caseCtrl || typeof document === 'undefined') return false;
  if (!caseItem.caseCtrl.lidOpen) toggleAmpouleCaseLid(ctx, caseItem, true);

  let modal = document.getElementById('ampoule-case-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ampoule-case-modal';
    modal.className = 'fixed inset-0 z-[125] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm';
    modal.innerHTML =
      `<div class="glass-panel rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col border border-orange-500/40 shadow-2xl overflow-hidden">` +
        `<div data-modal-drag-handle class="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-900/70">` +
          `<div>` +
            `<h3 id="ampoule-modal-title" class="text-sm sm:text-base font-extrabold text-orange-300">💼 Maleta Porta-Ampolas 3ML (50 Vagas)</h3>` +
            `<p id="ampoule-modal-sub" class="text-[11px] text-slate-400">Culturas líquidas puras com micélio colonizado pronto para seringa & cultivo</p>` +
          `</div>` +
          `<button id="btn-close-ampoule-modal" type="button" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold">✕ Fechar</button>` +
        `</div>` +
        `<div id="ampoule-filter-bar" class="flex flex-wrap gap-1.5 px-4 py-2 border-b border-slate-800/70 bg-slate-900/40"></div>` +
        `<div id="ampoule-slots-grid" class="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 overflow-y-auto"></div>` +
      `</div>`;
    document.body.appendChild(modal);
    const closeBtn = document.getElementById('btn-close-ampoule-modal');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
  }

  let activeFilter = 'Todas';
  const filterBar = document.getElementById('ampoule-filter-bar');
  const grid = document.getElementById('ampoule-slots-grid');

  const renderGrid = () => {
    const cc = caseItem.caseCtrl;
    const occupied = cc.slots.filter(Boolean).length;
    const titleEl = document.getElementById('ampoule-modal-title');
    if (titleEl) titleEl.textContent = `💼 Maleta Porta-Ampolas 3ML (${occupied}/${AMPOULE_CASE_MAX_SLOTS} ocupadas)`;

    if (filterBar) {
      filterBar.replaceChildren();
      ['Todas', 'Cubensis', 'Comestível', 'Raro', 'Vagas Livres'].forEach((cat) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold transition ' +
          (activeFilter === cat ? 'bg-orange-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700');
        b.textContent = cat;
        b.onclick = () => { activeFilter = cat; renderGrid(); };
        filterBar.appendChild(b);
      });
    }

    if (!grid) return;
    grid.replaceChildren();
    const holdingVial = !!(ctx && ctx.heldItem && ctx.heldItem.vial3mlCtrl);

    for (let i = 0; i < AMPOULE_CASE_MAX_SLOTS; i++) {
      const slot = cc.slots[i];
      if (activeFilter === 'Vagas Livres' && slot) continue;
      if (activeFilter !== 'Todas' && activeFilter !== 'Vagas Livres' && (!slot || slot.group !== activeFilter)) continue;

      const card = document.createElement('div');
      card.className = 'rounded-xl p-2 border flex flex-col justify-between text-left ' +
        (slot
          ? (slot.contaminated ? 'bg-rose-950/35 border-rose-500/40' : 'bg-slate-900/80 border-emerald-500/35')
          : 'bg-slate-950/50 border-slate-800/80');

      if (slot) {
        const badgeCol = slot.group === 'Cubensis'
          ? 'text-amber-300'
          : (slot.group === 'Raro' ? 'text-fuchsia-300' : 'text-emerald-300');
        const stTxt = slot.contaminated
          ? '🦠 Contaminada'
          : (slot.volMl <= 0.05 ? '📦 Vazia' : `✅ ${Number(slot.volMl).toFixed(1)}ml • Micélio`);
        card.innerHTML =
          `<div>` +
            `<div class="flex items-center justify-between text-[10px] font-bold">` +
              `<span class="text-slate-400">#${i + 1}</span>` +
              `<span class="${badgeCol}">${slot.group}</span>` +
            `</div>` +
            `<div class="text-[11px] font-extrabold text-white mt-0.5 leading-tight">${slot.speciesName}</div>` +
            `<div class="text-[10px] mt-1 ${slot.contaminated ? 'text-rose-300' : 'text-cyan-300'}">${stTxt}</div>` +
          `</div>`;
        const takeBtn = document.createElement('button');
        takeBtn.type = 'button';
        takeBtn.className = 'mt-2 w-full py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-extrabold text-[10px] transition';
        takeBtn.textContent = '🖐️ Pegar Ampola';
        takeBtn.onclick = () => {
          takeVialFromAmpouleCase(ctx, caseItem, i);
          modal.classList.add('hidden');
        };
        card.appendChild(takeBtn);
      } else {
        card.innerHTML =
          `<div class="text-[10px] text-slate-500 font-bold">#${i + 1} • Vaga Livre</div>` +
          `<div class="text-[10px] text-slate-600 mt-1">Espuma 3ML</div>`;
        if (holdingVial) {
          const putBtn = document.createElement('button');
          putBtn.type = 'button';
          putBtn.className = 'mt-2 w-full py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] transition';
          putBtn.textContent = '📥 Guardar Aqui';
          putBtn.onclick = () => {
            storeVialInAmpouleCase(ctx, caseItem, ctx.heldItem, i);
            renderGrid();
          };
          card.appendChild(putBtn);
        }
      }
      grid.appendChild(card);
    }
  };

  renderGrid();
  modal.classList.remove('hidden');
  releaseInputForModal();
  if (typeof window !== 'undefined' && window.setupMycoModalWindows) {
    window.setupMycoModalWindows();
  }
  return true;
}

export function getAmpouleCaseMeta() {
  return {
    category: 'storage_case',
    icon: '💼',
    purpose: 'Maleta rígida porta-ampolas 3ML (50 vagas) com coleção de culturas líquidas de cubensis, comestíveis e espécies raras',
    weightGrams: 1150,
    baseTempC: 21.5,
    compatibilities: {
      canEnterCooker: false,
      holdsVials3ml: true
    },
    connections: ['vial_3ml', 'syringe_10ml', 'culture_fridge'],
    serializeState: (item) => {
      const cc = item && item.caseCtrl;
      if (!cc) return null;
      return {
        lidOpen: !!cc.lidOpen,
        slots: cc.slots.map((s) => (s ? {
          speciesName: s.speciesName,
          group: s.group,
          volMl: Number((s.volMl || 0).toFixed(2)),
          colonized: !!s.colonized,
          contaminated: !!s.contaminated,
          sterilized: !!s.sterilized
        } : null))
      };
    },
    applyState: (item, custom, _sim) => {
      if (!custom || !item || !item.caseCtrl) return;
      const cc = item.caseCtrl;
      if (typeof custom.lidOpen === 'boolean') cc.lidOpen = custom.lidOpen;
      if (Array.isArray(custom.slots)) {
        for (let i = 0; i < AMPOULE_CASE_MAX_SLOTS; i++) {
          const inc = custom.slots[i];
          cc.slots[i] = inc && typeof inc === 'object' ? {
            speciesName: String(inc.speciesName || 'Golden Teacher (Psilocybe cubensis)').slice(0, 90),
            group: String(inc.group || 'Cubensis').slice(0, 32),
            volMl: Math.max(0, Math.min(AMPOULE_VIAL_MAX_ML, Number(inc.volMl) || 0)),
            colonized: !!inc.colonized,
            contaminated: !!inc.contaminated,
            sterilized: !!inc.sterilized
          } : null;
        }
      }
      updateAmpouleCaseVisual(item);
    }
  };
}

export function makeAmpouleCase(ctx, id, px, py, pz, opts = {}) {
  const A = getAmpouleAssets();
  const root = new THREE.Group();
  const W = 0.34;
  const H = 0.044;
  const D = 0.21;

  // Base rígida preta + espuma furada com 50 poços (10 cols x 5 rows)
  const baseBox = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), A.caseBodyMat);
  baseBox.position.y = H * 0.5;
  const foamBox = new THREE.Mesh(new THREE.BoxGeometry(W - 0.018, 0.014, D - 0.018), A.caseFoamMat);
  foamBox.position.y = H - 0.004;
  root.add(baseBox, foamBox);

  // Travas frontais + dobradiças traseiras estilizadas (iguais à maleta Pelican das fotos)
  [-0.10, -0.055, 0.055, 0.10].forEach((lx) => {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.012), A.latchMat);
    latch.position.set(lx, H * 0.62, D * 0.5 + 0.004);
    root.add(latch);
  });
  [-0.095, -0.055, 0.055, 0.095].forEach((hx) => {
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.020, 0.014), A.latchMat);
    hinge.position.set(hx, H * 0.85, -D * 0.5 - 0.003);
    root.add(hinge);
  });

  // Tampa articulada preta
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D * 0.5);
  const lidTop = new THREE.Mesh(new THREE.BoxGeometry(W, 0.024, D), A.caseBodyMat);
  lidTop.position.set(0, 0.012, D * 0.5);
  lidPivot.add(lidTop);
  root.add(lidPivot);

  const slots = Array.isArray(opts.slots) ? opts.slots.slice(0, AMPOULE_CASE_MAX_SLOTS) : buildStarterCaseSlots();
  while (slots.length < AMPOULE_CASE_MAX_SLOTS) slots.push(null);

  const slotVisuals = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 10; c++) {
      const sx = (c - 4.5) * 0.0295;
      const sz = (r - 2) * 0.032;
      const well = new THREE.Mesh(A.wellGeo, A.caseWellMat);
      well.position.set(sx, H + 0.002, sz);
      root.add(well);

      const vBuilt = buildVial3mlMeshGroup({ contaminated: false });
      vBuilt.vg.position.set(sx, H + 0.002, sz);
      vBuilt.vg.visible = false;
      root.add(vBuilt.vg);
      slotVisuals.push({
        root: vBuilt.vg,
        liqMesh: vBuilt.liqMesh,
        mycCloud: vBuilt.mycCloud
      });
    }
  }

  const item = registerPickable(
    ctx,
    id,
    '💼 Maleta Porta-Ampolas 3ML',
    root,
    px,
    py,
    pz,
    opts.ry || 0,
    0.20,
    0.072,
    getAmpouleCaseMeta()
  );
  item.caseCtrl = {
    lidOpen: !!opts.lidOpen,
    lidProgress: opts.lidOpen ? 1 : 0,
    lidPivot,
    maxSlots: AMPOULE_CASE_MAX_SLOTS,
    slots,
    slotVisuals
  };
  ctx.ampouleCases = ctx.ampouleCases || [];
  ctx.ampouleCases.push(item);
  lidPivot.rotation.x = -1.65 * item.caseCtrl.lidProgress;
  updateAmpouleCaseVisual(item);
  return item;
}

export function stepAmpouleCases(ctx, dt) {
  const list = ctx && ctx.ampouleCases;
  if (!list || !list.length) return;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const cc = item && item.caseCtrl;
    if (!cc || !cc.lidPivot) continue;
    const target = cc.lidOpen ? 1 : 0;
    if (Math.abs((cc.lidProgress || 0) - target) > 0.004) {
      cc.lidProgress = (cc.lidProgress || 0) + (target - (cc.lidProgress || 0)) * Math.min(1, dt * 8.5);
      cc.lidPivot.rotation.x = -1.65 * cc.lidProgress;
      updateItemBounds(item);
    }
  }
}
