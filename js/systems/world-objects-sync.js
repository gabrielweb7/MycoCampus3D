/**
 * Sincronizacao de Objetos Fisicos, Estados de Culturas e Pose Salva (MycoCampus3D)
 */

import { getItemGroundHeight } from '../engine/physics.js';
import { setHeldTwoHandedGhost } from './interaction-system.js';
import { markItemsFalling } from '../entities/placement-ghost.js';
import { spawnPersistedWildMushroom } from './world-interactions.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { updateSyringeVolume } from '../items/syringe.js';
import { updateSpawnVisual } from '../items/spawn-containers.js';
import { updateMixingBowlLabel } from '../items/mixing-bowl.js';
import { updateScalpelLabel } from '../items/scalpel.js';
import { setPetriLidOpen, updatePetriVisual, PETRI_STACK_SPACING, PETRI_STACK_ALIGNMENT_RADIUS } from '../items/petri-dish.js';
import { PP5_STACK_SPACING, PP5_STACK_ALIGNMENT_RADIUS } from '../items/pp5-cup.js';
import { updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { updatePdaMediumVisual, updatePdaReagentLabel } from '../items/pda-mix.js';
import { setCultureFridgeDoorOpen } from '../items/culture-fridge.js';
import { spawnItemFromPrefab } from '../items/item-prefabs.js';
import { disposeObjectResources } from '../items/item-registry.js';
import { makeDriedMushroomBatch } from '../items/lab-advanced-tools.js';
import { makeSpentCakeItem, updateMonotubVisual } from '../items/monotub.js';
import { updateDehydratorVisual, DEHYDRATOR_DRY_SECONDS } from '../items/dehydrator.js';
import { makeOrganicGardenBasket } from '../world/campus-garden.js';

const LOCAL_MOVED_STORAGE_KEY = 'myco_local_world_objects_v1';
let localMovedCache = null;
let localMovedDirty = false;

function quantizeStep(val, step = 25) {
  const n = Math.max(0, Math.min(100, Number(val) || 0));
  if (n >= 100) return 100;
  return Math.floor(n / step) * step;
}

function readLocalMovedMap() {
  if (localMovedCache !== null) return localMovedCache;
  if (typeof localStorage === 'undefined') {
    localMovedCache = {};
    return localMovedCache;
  }
  try {
    const raw = localStorage.getItem(LOCAL_MOVED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    localMovedCache = (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    localMovedCache = {};
  }
  return localMovedCache;
}

function writeLocalMovedMap(map) {
  localMovedCache = (map && typeof map === 'object') ? map : {};
  localMovedDirty = false;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_MOVED_STORAGE_KEY, JSON.stringify(localMovedCache));
  } catch (e) {}
}

export function flushLocalMovedObjects() {
  if (!localMovedDirty || localMovedCache === null) return;
  writeLocalMovedMap(localMovedCache);
}

function setLocalMovedEntry(itemId, entry, deferFlush = false) {
  const map = readLocalMovedMap();
  const prev = map[itemId];
  if (prev &&
    prev.x === entry.x && prev.y === entry.y && prev.z === entry.z && prev.ry === entry.ry &&
    prev.prefabId === entry.prefabId &&
    JSON.stringify(prev.state || null) === JSON.stringify(entry.state || null)) {
    return;
  }
  map[itemId] = entry;
  localMovedDirty = true;
  if (!deferFlush) flushLocalMovedObjects();
}

export function saveLocalMovedObject(item, state, deferFlush = false) {
  if (!item || !item.id || !item.mesh) return;
  const map = readLocalMovedMap();
  const prev = map[item.id] || {};
  const entry = {
    x: Number(item.mesh.position.x.toFixed(4)),
    y: Number(item.mesh.position.y.toFixed(4)),
    z: Number(item.mesh.position.z.toFixed(4)),
    ry: Number((item.mesh.rotation.y || 0).toFixed(4))
  };
  const prefabId = (item.meta && item.meta.prefabId) || (item.mesh.userData && item.mesh.userData.prefabId) || prev.prefabId;
  if (prefabId) entry.prefabId = prefabId;
  if (state !== undefined) entry.state = state;
  else if (prev.state !== undefined) entry.state = prev.state;
  setLocalMovedEntry(item.id, entry, deferFlush);
}

export function markItemRemovedForSync(sim, item, dynamicKind) {
  if (!item || !item.id) return;
  item._removedForSync = true;
  const custom = { removed: true };
  if (dynamicKind) custom.dynamicKind = dynamicKind;
  if (sim) {
    sim.pendingMovedItems = sim.pendingMovedItems || {};
    sim.pendingMovedItems[item.id] = {
      id: item.id,
      state: { custom }
    };
  }
  const map = readLocalMovedMap();
  setLocalMovedEntry(item.id, Object.assign({}, map[item.id] || {}, { state: { custom } }), false);
}

export function clearLocalMovedObjects() {
  localMovedCache = {};
  localMovedDirty = false;
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(LOCAL_MOVED_STORAGE_KEY); } catch (e) {}
}

function spawnDynamicItemFromCustom(sim, itemId, custom, pose) {
  if (!sim || !itemId || !custom || custom.removed) return null;
  const x = pose && typeof pose.x === 'number' ? pose.x : 0;
  const y = pose && typeof pose.y === 'number' ? pose.y : 0.2;
  const z = pose && typeof pose.z === 'number' ? pose.z : 0;
  if (custom.dynamicKind === 'dried_batch') {
    return makeDriedMushroomBatch(sim, itemId, custom.speciesName || 'Psilocybe cubensis', x, y, z, custom.grams || 10);
  }
  if (custom.dynamicKind === 'organic_basket') {
    return makeOrganicGardenBasket(sim, x, y, z, itemId);
  }
  if (custom.dynamicKind === 'spent_cake') {
    return makeSpentCakeItem(sim, itemId, custom.speciesName || 'Cogumelo', x, y, z);
  }
  return null;
}

function removeItemInstanceLocally(sim, item) {
  if (!item) return;
  item._removedForSync = true;
  if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
  disposeObjectResources(item.mesh);
  if (sim && Array.isArray(sim.pickableItems)) {
    const idx = sim.pickableItems.indexOf(item);
    if (idx !== -1) sim.pickableItems.splice(idx, 1);
  }
  if (sim && sim.pickableMap && typeof sim.pickableMap.delete === 'function') {
    sim.pickableMap.delete(item.id);
  }
  if (sim && sim.heldItem === item) {
    sim.heldItem = null;
    if (sim.placementGhost) sim.placementGhost.visible = false;
    if (sim.callbacks && sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
  }
}

export function restoreLocalWorldObjects(sim) {
  if (!sim || !Array.isArray(sim.pickableItems)) return;
  localMovedCache = null;
  const localMap = readLocalMovedMap();
  if (!localMap || !Object.keys(localMap).length) return;
  // Instancia primeiro quaisquer itens extras comprados na Loja / Prefabs ou dinâmicos salvos localmente
  Object.keys(localMap).forEach((itemId) => {
    const saved = localMap[itemId];
    if (!saved) return;
    if (saved.state && saved.state.custom && saved.state.custom.removed) {
      const existing = sim.findPickable ? sim.findPickable(itemId) : null;
      if (existing) removeItemInstanceLocally(sim, existing);
      return;
    }
    if (sim.findPickable && sim.findPickable(itemId)) return;
    if (saved.prefabId) {
      spawnItemFromPrefab(sim, saved.prefabId, {
        id: itemId,
        x: saved.x || 0,
        y: saved.y || 0,
        z: saved.z || 0,
        ry: saved.ry || 0
      });
    } else if (saved.state && saved.state.custom && saved.state.custom.dynamicKind) {
      spawnDynamicItemFromCustom(sim, itemId, saved.state.custom, saved);
    }
  });
  applyCampusWorldObjects(sim, localMap);
  Object.keys(localMap).forEach((itemId) => {
    const saved = localMap[itemId];
    if (!saved || !saved.state) return;
    const item = sim.findPickable ? sim.findPickable(itemId) : null;
    if (item) applyReplicatedItemState(sim, item, saved.state);
  });
}

export function markCampusInitialItemStatesApplied(sim) {
  if (!sim) return;
  sim.itemStateSignatures = {};
  (sim.pickableItems || []).forEach(function (item) {
    const state = getReplicatedItemState(sim, item);
    if (state) {
      sim.itemStateSignatures[item.id] = JSON.stringify(state);
    }
  });
  sim.initialItemStatesApplied = true;
}

function hasPotentiallyReplicableState(item, sim, now) {
  if (!item || !item.mesh) return false;
  if ((item.sanitizedUntil || 0) > now) return true;
  if (sim.itemStateSignatures && sim.itemStateSignatures[item.id]) return true;
  if (item._hasStaticStateCtrl !== undefined) return item._hasStaticStateCtrl;
  const ud = item.mesh.userData || {};
  const meta = item.meta || ud.itemMeta;
  const has = !!(
    item.spawnCtrl || ud.spawnCtrl || ud.petriCtrl || item.fridgeCtrl ||
    ud.liquidCtrl || item.cultureCtrl || ud.cultureCtrl || item.pdaReagentCtrl ||
    item.pdaMediumCtrl || ud.syrCtrl || item.liquidMix || item.bowlCtrl ||
    item.scalpelCtrl || item.bladePackCtrl || item.wildMushroomCtrl || item.cookerRef ||
    (meta && typeof meta.serializeState === 'function')
  );
  item._hasStaticStateCtrl = has;
  return has;
}

export function consumeCampusMovedItems(sim) {
  const pending = sim.pendingMovedItems;
  const byId = pending;
  const now = performance.now();
  if (sim.initialItemStatesApplied && (!sim.nextItemStateSyncAt || now >= sim.nextItemStateSyncAt)) {
    sim.nextItemStateSyncAt = now + 1000;
    sim.itemStateSignatures = sim.itemStateSignatures || {};
    const items = sim.pickableItems;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!hasPotentiallyReplicableState(item, sim, now)) continue;
      if (sim.isHeldByRemote(item.id)) continue;
      const state = getReplicatedItemState(sim, item);
      if (!state) continue;
      const signature = JSON.stringify(state);
      if (sim.itemStateSignatures[item.id] === signature) continue;
      sim.itemStateSignatures[item.id] = signature;
      saveLocalMovedObject(item, state, true);
      const queued = byId[item.id] || (byId[item.id] = { id: item.id });
      queued.state = state;
      const isDynamicSpawnId = item.id.indexOf('wild_picked_') === 0 ||
        item.id.indexOf('dried_batch_') === 0 ||
        item.id.indexOf('organic_basket_') === 0 ||
        item.id.indexOf('spent_cake_') === 0 ||
        item.id.indexOf('dyn_') === 0;
      if (queued.x === undefined && !item._removedForSync && (item.isMoved || isDynamicSpawnId)) {
        queued.x = item.mesh.position.x;
        queued.y = item.mesh.position.y;
        queued.z = item.mesh.position.z;
        queued.ry = item.mesh.rotation.y;
      }
    }
  }
  flushLocalMovedObjects();
  const list = Object.values(pending);
  sim.pendingMovedItems = {};
  return list;
}

export function requeueCampusMovedItems(sim, list) {
  (list || []).forEach(function (it) {
    if (!it || !it.id) return;
    const queued = sim.pendingMovedItems[it.id];
    if (!queued) {
      sim.pendingMovedItems[it.id] = it;
    } else if (it.state && !queued.state) {
      queued.state = it.state;
    }
  });
}

export function getReplicatedItemState(sim, item) {
  if (!item || !item.mesh) return null;
  const state = {};
  const meshData = item.mesh.userData || {};
  const spawn = item.spawnCtrl || meshData.spawnCtrl;
  if (spawn) {
    state.spawn = {
      filled: !!spawn.filled,
      fillGrams: Math.round(spawn.fillGrams || 0),
      substrateKind: spawn.substrateKind || '',
      waterMl: Math.round(spawn.waterMl || 0),
      sterilizeProgress: quantizeStep(spawn.sterilizeProgress, 25),
      sterilized: !!spawn.sterilized,
      sealed: !!spawn.sealed,
      inoculated: !!spawn.inoculated,
      colonized: !!spawn.colonized,
      colonization: quantizeStep(spawn.colonization, 25),
      ageGameDays: Math.round((spawn.ageGameDays || 0) * 10) / 10,
      shelfLifeAgeDays: Math.round((spawn.shelfLifeAgeDays || 0) * 10) / 10,
      expired: !!spawn.expired,
      contaminated: !!spawn.contaminated,
      burned: !!spawn.burned,
      tempC: typeof spawn.tempC === 'number' ? Math.round(spawn.tempC * 10) / 10 : 24.5,
      refrigerated: !!spawn.refrigerated,
      speciesName: spawn.speciesName || ''
    };
  }
  const petri = meshData.petriCtrl;
  if (petri && ['bare', 'filled', 'empty', 'colonizing', 'clean', 'contam', 'spore_print'].indexOf(petri.mode) !== -1) {
    state.petri = {
      mode: petri.mode,
      lidOpen: !!petri.lidOpen,
      sterilized: !!petri.sterilized,
      inoculated: !!petri.inoculated,
      parafilmSealed: !!petri.parafilmSealed,
      inoculationMethod: petri.inoculationMethod === 'mycelium' ? 'mycelium' : (petri.inoculationMethod === 'liquid' ? 'liquid' : ''),
      speciesName: petri.speciesName || '',
      colonization: quantizeStep(petri.colonization, 25),
      ageGameDays: Math.round((petri.ageGameDays || 0) * 10) / 10,
      shelfLifeAgeDays: Math.round((petri.shelfLifeAgeDays || 0) * 10) / 10,
      expired: !!petri.expired,
      cutWedges: Math.max(0, Math.min(4, petri.cutWedges || 0)),
      delayedContamAtPct: Math.round((petri.delayedContamAtPct || 0) * 10) / 10,
      tempC: typeof petri.tempC === 'number' ? Math.round(petri.tempC * 10) / 10 : 24.5,
      refrigerated: !!petri.refrigerated,
      hybridMutant: petri.hybridMutant === 'gold' || petri.hybridMutant === 'albino' ? petri.hybridMutant : '',
      generation: Math.max(1, Math.min(20, Math.round(Number(petri.generation) || 1)))
    };
  }
  if (item.fridgeCtrl) state.fridge = { doorOpen: !!item.fridgeCtrl.doorOpen };
  const liquid = meshData.liquidCtrl;
  if (liquid) state.liquid = { volMl: Math.round(liquid.volMl || 0), sterilized: !!liquid.sterilized };
  if (item.sterilized) state.sterilized = true;
  const culture = item.cultureCtrl || meshData.cultureCtrl;
  if (culture) {
    state.culture = {
      inoculated: !!culture.inoculated,
      colonized: !!culture.colonized,
      colonization: quantizeStep(culture.colonization, 25),
      contaminated: !!culture.contaminated,
      ageGameDays: Math.round((culture.ageGameDays || 0) * 10) / 10,
      shelfLifeAgeDays: Math.round((culture.shelfLifeAgeDays || 0) * 10) / 10,
      expired: !!culture.expired,
      tempC: typeof culture.tempC === 'number' ? Math.round(culture.tempC * 10) / 10 : 24.5,
      refrigerated: !!culture.refrigerated,
      speciesName: culture.speciesName || ''
    };
  }
  if (item.pdaReagentCtrl) {
    state.pdaReagent = { remainingGrams: Math.round(item.pdaReagentCtrl.remainingGrams || 0) };
  }
  if (item.pdaMediumCtrl) {
    state.pdaMedium = {
      powderGrams: Math.round((item.pdaMediumCtrl.powderGrams || 0) * 10) / 10,
      mixed: !!item.pdaMediumCtrl.mixed,
      stirProgress: Math.round((item.pdaMediumCtrl.stirProgress || 0) * 10) / 10,
      sterilized: !!item.pdaMediumCtrl.sterilized,
      burned: !!item.pdaMediumCtrl.burned,
      tempC: typeof item.pdaMediumCtrl.tempC === 'number' ? Math.round(item.pdaMediumCtrl.tempC * 10) / 10 : 24.5,
      refrigerated: !!item.pdaMediumCtrl.refrigerated
    };
  }
  const syringe = meshData.syrCtrl;
  if (syringe) {
    state.syringe = {
      volMl: Math.round((syringe.volMl || 0) * 10) / 10,
      sourceContam: !!syringe.sourceContam,
      tempC: typeof syringe.tempC === 'number' ? Math.round(syringe.tempC * 10) / 10 : 24.5,
      refrigerated: !!syringe.refrigerated,
      speciesName: syringe.speciesName || '',
      mix: syringe.mix ? {
        waterMl: Math.round((syringe.mix.waterMl || 0) * 10) / 10,
        distilledMl: Math.round((syringe.mix.distilledMl || 0) * 10) / 10,
        lcMl: Math.round((syringe.mix.lcMl || 0) * 10) / 10,
        pdaMl: Math.round((syringe.mix.pdaMl || 0) * 10) / 10
      } : null
    };
  }
  if (item.liquidMix) {
    state.liquidMix = {
      waterMl: Math.round((item.liquidMix.waterMl || 0) * 10) / 10,
      distilledMl: Math.round((item.liquidMix.distilledMl || 0) * 10) / 10,
      lcMl: Math.round((item.liquidMix.lcMl || 0) * 10) / 10,
      pdaMl: Math.round((item.liquidMix.pdaMl || 0) * 10) / 10
    };
  }
  if (item.bowlCtrl) {
    state.bowl = {
      ingredients: {
        flocao: Math.round(item.bowlCtrl.ingredients.flocao || 0),
        water: Math.round(item.bowlCtrl.ingredients.water || 0),
        corn: Math.round(item.bowlCtrl.ingredients.corn || 0),
        sawdust: Math.round(item.bowlCtrl.ingredients.sawdust || 0)
      },
      mixed: !!item.bowlCtrl.mixed,
      stirCount: Math.max(0, Math.min(3, item.bowlCtrl.stirCount || 0))
    };
  }
  if (item.scalpelCtrl) {
    const nowPerf = performance.now();
    const bladeRemMs = (item.scalpelCtrl.hasBlade && item.scalpelCtrl.sterile && item.scalpelCtrl.bladeAttachedAt)
      ? Math.round(Math.max(0, 160000 - (nowPerf - item.scalpelCtrl.bladeAttachedAt)) / 5000) * 5000
      : 0;
    state.scalpel = {
      hasBlade: !!item.scalpelCtrl.hasBlade,
      sterile: !!item.scalpelCtrl.sterile,
      hasMycelium: !!item.scalpelCtrl.hasMycelium,
      bladeContaminated: !!item.scalpelCtrl.bladeContaminated,
      cutContaminated: !!item.scalpelCtrl.cutContaminated,
      bladeRemainingMs: bladeRemMs
    };
  }
  if (item.bladePackCtrl) {
    state.bladePack = { empty: !!item.bladePackCtrl.empty };
  }
  if (item.wildMushroomCtrl) {
    state.wildMushroom = {
      speciesName: item.wildMushroomCtrl.speciesName || 'Cubensis Dourado do Pasto (Psilocybe cubensis)',
      isMagic: !!item.wildMushroomCtrl.isMagic,
      removed: !!item.wildMushroomCtrl.removed
    };
  }
  const sanRemSec = (item.sanitizedUntil || 0) > performance.now()
    ? Math.round(((item.sanitizedUntil - performance.now()) / 1000) / 5) * 5
    : 0;
  if (sanRemSec > 0) {
    state.sanitizedRemainingSec = sanRemSec;
  }
  const cookerPots = sim && Array.isArray(sim.cookerPots) ? sim.cookerPots : [];
  const containingCooker = cookerPots.find((cooker) => cooker.contents && cooker.contents.indexOf(item) !== -1);
  if (containingCooker) {
    state.containerId = containingCooker.potItem.id;
  } else if (Object.keys(state).length) {
    state.containerId = '';
  }
  const cooker = cookerPots.find((candidate) => candidate.potItem === item);
  if (cooker) {
    state.cooker = {
      waterMl: Math.round(cooker.waterMl || 0),
      mode: cooker.mode === 'pasteurize' ? 'pasteurize' : 'sterilize',
      temp: Math.round((cooker.temp || 0) / 5) * 5,
      psi: Math.round((cooker.psi || 0) / 3) * 3,
      progress: quantizeStep(cooker.progress, 25),
      sterilized: !!cooker.sterilized,
      burned: !!cooker.burned,
      overheatTimer: Math.round((cooker.overheatTimer || 0) / 5) * 5,
      grainGrams: Math.round(cooker.grainGrams || 0),
      grainCookSec: Math.round((cooker.grainCookSec || 0) / 5) * 5,
      grainAlDente: !!cooker.grainAlDente,
      hasBase: cooker.hasBase !== false,
      contents: cooker.contents.slice(0, 6).map((content) => content.id)
    };
  }
  const meta = item.meta || meshData.itemMeta;
  if (meta && typeof meta.serializeState === 'function') {
    const customState = meta.serializeState(item, sim);
    if (customState && typeof customState === 'object') {
      state.custom = customState;
    }
  }
  return Object.keys(state).length ? state : null;
}

export function applyReplicatedItemState(sim, item, state) {
  if (!item || !state || typeof state !== 'object') return;
  const spawn = item.spawnCtrl || (item.mesh.userData && item.mesh.userData.spawnCtrl);
  if (spawn && state.spawn && typeof state.spawn === 'object') {
    const incoming = state.spawn;
    ['filled', 'sterilized', 'sealed', 'inoculated', 'colonized', 'expired', 'contaminated', 'burned', 'refrigerated'].forEach(function (key) {
      if (typeof incoming[key] === 'boolean') spawn[key] = incoming[key];
    });
    if (typeof incoming.tempC === 'number' && Number.isFinite(incoming.tempC)) {
      spawn.tempC = Math.max(-20, Math.min(140, incoming.tempC));
      spawn.lastRenderedTempInt = Math.round(spawn.tempC);
    }
    if (typeof incoming.speciesName === 'string') spawn.speciesName = incoming.speciesName.slice(0, 80);
    ['fillGrams', 'waterMl', 'sterilizeProgress', 'colonization', 'ageGameDays', 'shelfLifeAgeDays'].forEach(function (key) {
      if (typeof incoming[key] === 'number' && Number.isFinite(incoming[key])) {
        const maxValue = key === 'colonization' || key === 'sterilizeProgress' ? 100 : 1000;
        const clamped = Math.max(0, Math.min(maxValue, incoming[key]));
        if (key === 'colonization' && spawn.inoculated && incoming.inoculated && !spawn.colonized && clamped < 100) {
          spawn.colonization = Math.max(Number(spawn.colonization) || 0, clamped);
        } else if (key === 'sterilizeProgress' && !spawn.sterilized && !incoming.sterilized && clamped < 100 && incoming.filled) {
          spawn.sterilizeProgress = Math.max(Number(spawn.sterilizeProgress) || 0, clamped);
        } else {
          spawn[key] = clamped;
        }
      }
    });
    const validSubstrates = spawn.isPP5
      ? ['grain', 'sorghum', 'wheat', 'coco_verm', 'sawdust', 'flocao', 'corn', 'pda']
      : ['grain', 'sorghum', 'wheat', 'coco_verm', 'sawdust', 'flocao', 'corn'];
    if (validSubstrates.indexOf(incoming.substrateKind) !== -1) {
      spawn.substrateKind = incoming.substrateKind;
    }
    if (spawn.inoculated && spawn.colonization >= 100 && !spawn.contaminated && !spawn.burned) {
      spawn.colonized = true;
    }
    if (spawn.fillMesh) spawn.fillMesh.visible = spawn.filled && spawn.substrateKind !== 'pda';
    if (item.meta && item.meta.compatibilities) {
      item.meta.compatibilities.receivesSyringe = spawn.filled;
      item.meta.compatibilities.receivesSubstrate = !spawn.filled && !spawn.isPP5;
      if (spawn.isPP5) {
        item.meta.compatibilities.acceptsPdaMedium = !spawn.filled;
        item.meta.compatibilities.receivesFlocao = !spawn.filled;
      }
    }
    const gLbl = spawn.substrateKind === 'sorghum' ? 'Sorgo' : (spawn.substrateKind === 'wheat' ? 'Trigo' : 'Milho');
    if (spawn.isPP5) {
      spawn.baseLabel = spawn.substrateKind === 'pda'
        ? 'Potinho PP5 145ml (PDA/BDA)'
        : (spawn.filled ? 'Potinho PP5 145ml (Flocão)' : 'Potinho PP5 145ml Vazio');
    } else if (spawn.isBag) {
      spawn.baseLabel = spawn.filled
        ? (spawn.substrateKind === 'coco_verm' || spawn.substrateKind === 'sawdust'
          ? 'Bag 1,5kg Substrato (Coco + Vermiculita)'
          : `Bag 1,5kg Spawn (${gLbl})`)
        : 'Bag 1,5kg Vazio';
    } else {
      spawn.baseLabel = spawn.filled ? `Vidro 800ml (${gLbl})` : 'Vidro 800ml Vazio';
    }
    spawn.updateVisual ? spawn.updateVisual() : updateSpawnVisual(item);
    if (spawn.isPP5 && spawn.fillGrams > 0 && spawn.waterMl === 0 && !spawn.inoculated) {
      item.label = 'Potinho PP5 145ml (Flocão seco • Adicione água)';
    }
  }

  const meshData = item.mesh.userData || {};
  if (meshData.petriCtrl && state.petri && typeof state.petri.mode === 'string' &&
    ['bare', 'filled', 'empty', 'colonizing', 'clean', 'contam', 'spore_print'].indexOf(state.petri.mode) !== -1) {
    const petri = meshData.petriCtrl;
    const incomingPetri = state.petri;
    const wasColonizing = petri.mode === 'colonizing';
    petri.mode = incomingPetri.mode;
    ['sterilized', 'inoculated', 'expired', 'parafilmSealed', 'refrigerated'].forEach(function (key) {
      if (typeof incomingPetri[key] === 'boolean') petri[key] = incomingPetri[key];
    });
    if (typeof incomingPetri.cutWedges === 'number' && Number.isFinite(incomingPetri.cutWedges)) {
      petri.cutWedges = Math.max(0, Math.min(4, incomingPetri.cutWedges));
    }
    if (typeof incomingPetri.delayedContamAtPct === 'number' && Number.isFinite(incomingPetri.delayedContamAtPct)) {
      petri.delayedContamAtPct = Math.max(0, Math.min(100, incomingPetri.delayedContamAtPct));
    }
    if (typeof incomingPetri.tempC === 'number' && Number.isFinite(incomingPetri.tempC)) {
      petri.tempC = Math.max(-20, Math.min(140, incomingPetri.tempC));
      petri.lastRenderedTempInt = Math.round(petri.tempC);
    }
    if (typeof incomingPetri.speciesName === 'string') petri.speciesName = incomingPetri.speciesName.slice(0, 80);
    if (typeof incomingPetri.generation === 'number' && Number.isFinite(incomingPetri.generation)) {
      petri.generation = Math.max(1, Math.min(20, Math.round(incomingPetri.generation)));
    }
    if (incomingPetri.hybridMutant === 'gold' || incomingPetri.hybridMutant === 'albino') {
      petri.hybridMutant = incomingPetri.hybridMutant;
      petri.generation = 3;
    } else if (incomingPetri.hybridMutant === '') {
      petri.hybridMutant = '';
    }
    if (typeof incomingPetri.colonization === 'number' && Number.isFinite(incomingPetri.colonization)) {
      const nextCol = Math.max(0, Math.min(100, incomingPetri.colonization));
      petri.colonization = (wasColonizing && incomingPetri.mode === 'colonizing' && nextCol < 100)
        ? Math.max(Number(petri.colonization) || 0, nextCol)
        : nextCol;
    }
    if (typeof incomingPetri.ageGameDays === 'number' && Number.isFinite(incomingPetri.ageGameDays)) {
      petri.ageGameDays = Math.max(0, Math.min(1000, incomingPetri.ageGameDays));
    }
    if (typeof incomingPetri.shelfLifeAgeDays === 'number' && Number.isFinite(incomingPetri.shelfLifeAgeDays)) {
      petri.shelfLifeAgeDays = Math.max(0, Math.min(1000, incomingPetri.shelfLifeAgeDays));
    }
    petri.colonized = petri.mode === 'clean' || petri.colonization >= 100;
    petri.contaminated = petri.mode === 'contam' && !petri.expired;
    if (incomingPetri.inoculationMethod === 'liquid' || incomingPetri.inoculationMethod === 'mycelium') {
      petri.inoculationMethod = incomingPetri.inoculationMethod;
    } else {
      petri.inoculationMethod = '';
    }
    if (typeof incomingPetri.lidOpen === 'boolean') setPetriLidOpen(item, incomingPetri.lidOpen, false);
    updatePetriVisual(item);
  }
  if (item.fridgeCtrl && state.fridge && typeof state.fridge.doorOpen === 'boolean') {
    setCultureFridgeDoorOpen(item, state.fridge.doorOpen, false);
  }
  const culture = item.cultureCtrl || (meshData && meshData.cultureCtrl);
  if (culture && state.culture && typeof state.culture === 'object') {
    const wasInoc = !!culture.inoculated && !culture.colonized;
    ['inoculated', 'colonized', 'contaminated', 'expired', 'refrigerated'].forEach(function (key) {
      if (typeof state.culture[key] === 'boolean') culture[key] = state.culture[key];
    });
    if (typeof state.culture.colonization === 'number' && Number.isFinite(state.culture.colonization)) {
      const nextCol = Math.max(0, Math.min(100, state.culture.colonization));
      culture.colonization = (wasInoc && state.culture.inoculated && !state.culture.colonized && nextCol < 100)
        ? Math.max(Number(culture.colonization) || 0, nextCol)
        : nextCol;
    }
    if (typeof state.culture.tempC === 'number' && Number.isFinite(state.culture.tempC)) {
      culture.tempC = Math.max(-20, Math.min(140, state.culture.tempC));
      culture.lastRenderedTempInt = Math.round(culture.tempC);
    }
    if (typeof state.culture.speciesName === 'string') culture.speciesName = state.culture.speciesName.slice(0, 80);
    ['ageGameDays', 'shelfLifeAgeDays'].forEach(function (key) {
      if (typeof state.culture[key] === 'number' && Number.isFinite(state.culture[key])) {
        culture[key] = Math.max(0, Math.min(1000, state.culture[key]));
      }
    });
  }
  if (typeof state.sterilized === 'boolean') item.sterilized = state.sterilized;
  if (meshData.liquidCtrl && state.liquid && typeof state.liquid.volMl === 'number') {
    if (typeof state.liquid.sterilized === 'boolean') meshData.liquidCtrl.sterilized = state.liquid.sterilized;
    updateContainerVolume(item, state.liquid.volMl);
  }
  if (item.pdaReagentCtrl && state.pdaReagent && typeof state.pdaReagent.remainingGrams === 'number' &&
    Number.isFinite(state.pdaReagent.remainingGrams)) {
    item.pdaReagentCtrl.remainingGrams = Math.max(0, Math.min(item.pdaReagentCtrl.maxGrams, state.pdaReagent.remainingGrams));
    updatePdaReagentLabel(item);
  }
  if (item.pdaMediumCtrl && state.pdaMedium && typeof state.pdaMedium === 'object') {
    const medium = item.pdaMediumCtrl;
    if (typeof state.pdaMedium.powderGrams === 'number' && Number.isFinite(state.pdaMedium.powderGrams)) {
      const maxPowderGrams = item.spawnCtrl && item.spawnCtrl.isPP5 ? 4 : 500;
      medium.powderGrams = Math.max(0, Math.min(maxPowderGrams, state.pdaMedium.powderGrams));
    }
    if (typeof state.pdaMedium.stirProgress === 'number' && Number.isFinite(state.pdaMedium.stirProgress)) {
      medium.stirProgress = Math.max(0, Math.min(4, state.pdaMedium.stirProgress));
    }
    ['mixed', 'sterilized', 'burned'].forEach(function (key) {
      if (typeof state.pdaMedium[key] === 'boolean') medium[key] = state.pdaMedium[key];
    });
    if (typeof state.pdaMedium.tempC === 'number' && Number.isFinite(state.pdaMedium.tempC)) {
      medium.tempC = Math.max(-20, Math.min(140, state.pdaMedium.tempC));
      medium.lastRenderedTempInt = Math.round(medium.tempC);
    }
    if (typeof state.pdaMedium.refrigerated === 'boolean') medium.refrigerated = state.pdaMedium.refrigerated;
    updatePdaMediumVisual(item);
  }
  if (meshData.syrCtrl && state.syringe && typeof state.syringe.volMl === 'number') {
    if (state.syringe.mix && typeof state.syringe.mix === 'object') {
      meshData.syrCtrl.mix = {
        waterMl: Math.max(0, Number(state.syringe.mix.waterMl) || 0),
        distilledMl: Math.max(0, Number(state.syringe.mix.distilledMl) || 0),
        lcMl: Math.max(0, Number(state.syringe.mix.lcMl) || 0),
        pdaMl: Math.max(0, Number(state.syringe.mix.pdaMl) || 0)
      };
    }
    meshData.syrCtrl.sourceContam = !!state.syringe.sourceContam;
    if (typeof state.syringe.tempC === 'number' && Number.isFinite(state.syringe.tempC)) {
      meshData.syrCtrl.tempC = Math.max(-20, Math.min(140, state.syringe.tempC));
      meshData.syrCtrl.lastRenderedTempInt = Math.round(meshData.syrCtrl.tempC);
    }
    if (typeof state.syringe.refrigerated === 'boolean') meshData.syrCtrl.refrigerated = state.syringe.refrigerated;
    if (typeof state.syringe.speciesName === 'string') meshData.syrCtrl.speciesName = state.syringe.speciesName.slice(0, 80);
    updateSyringeVolume(item, state.syringe.volMl);
  }
  if (state.liquidMix && typeof state.liquidMix === 'object') {
    item.liquidMix = {
      waterMl: Math.max(0, Number(state.liquidMix.waterMl) || 0),
      distilledMl: Math.max(0, Number(state.liquidMix.distilledMl) || 0),
      lcMl: Math.max(0, Number(state.liquidMix.lcMl) || 0),
      pdaMl: Math.max(0, Number(state.liquidMix.pdaMl) || 0)
    };
  }
  if (item.bowlCtrl && state.bowl && typeof state.bowl === 'object') {
    const ingredients = state.bowl.ingredients || {};
    ['flocao', 'water', 'corn', 'sawdust'].forEach(function (key) {
      const value = ingredients[key];
      item.bowlCtrl.ingredients[key] = typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.min(5000, value))
        : 0;
    });
    if (typeof state.bowl.mixed === 'boolean') item.bowlCtrl.mixed = state.bowl.mixed;
    if (typeof state.bowl.stirCount === 'number') item.bowlCtrl.stirCount = Math.max(0, Math.min(3, state.bowl.stirCount));
    updateMixingBowlLabel(item);
  }
  if (item.scalpelCtrl && state.scalpel && typeof state.scalpel === 'object') {
    ['hasBlade', 'sterile', 'hasMycelium', 'bladeContaminated', 'cutContaminated'].forEach(function (key) {
      if (typeof state.scalpel[key] === 'boolean') item.scalpelCtrl[key] = state.scalpel[key];
    });
    if (typeof state.scalpel.bladeRemainingMs === 'number' && state.scalpel.bladeRemainingMs > 0) {
      item.scalpelCtrl.bladeAttachedAt = performance.now() - (160000 - state.scalpel.bladeRemainingMs);
    }
    if (item.scalpelCtrl.bladeMesh) item.scalpelCtrl.bladeMesh.visible = item.scalpelCtrl.hasBlade;
    updateScalpelLabel(item);
  }
  if (typeof state.sanitizedRemainingSec === 'number' && state.sanitizedRemainingSec > 0) {
    const untilPerf = performance.now() + state.sanitizedRemainingSec * 1000;
    item.sanitizedUntil = untilPerf;
    item._sanitizeUntil = untilPerf;
  }
  if (item.bladePackCtrl && state.bladePack && state.bladePack.empty) {
    item.bladePackCtrl.empty = true;
    item.label = 'Embalagem Lâmina #24 (Vazia ⚠️ Jogue no lixo)';
  }

  if (typeof state.containerId === 'string') {
    sim.cookerPots.forEach(function (cooker) {
      const idx = cooker.contents.indexOf(item);
      if (idx !== -1) cooker.contents.splice(idx, 1);
    });
    const targetCooker = sim.cookerPots.find((cooker) => cooker.potItem.id === state.containerId);
    if (targetCooker && targetCooker.contents.indexOf(item) === -1) targetCooker.contents.push(item);
  }

  if (item.lidItem) {
    const cooker = sim.cookerPots.find((candidate) => candidate.potItem === item);
    const incoming = state.cooker;
    if (cooker && incoming && typeof incoming === 'object') {
      if (typeof incoming.waterMl === 'number' && Number.isFinite(incoming.waterMl)) {
        cooker.waterMl = Math.max(0, Math.min(cooker.maxWaterMl, incoming.waterMl));
      }
      if (incoming.mode === 'sterilize' || incoming.mode === 'pasteurize') cooker.mode = incoming.mode;
      const potPos = item.mesh && item.mesh.position;
      const onActiveBurner = !!(potPos && Array.isArray(sim.burnerDevices) && sim.burnerDevices.some(function (bn) {
        return bn && bn.on && bn.surface &&
          potPos.x >= bn.surface.minX - 0.06 && potPos.x <= bn.surface.maxX + 0.06 &&
          potPos.z >= bn.surface.minZ - 0.06 && potPos.z <= bn.surface.maxZ + 0.06 &&
          Math.abs(potPos.y - bn.surface.topY) < 0.11;
      }));
      const recentLocalThermal = (performance.now() - (cooker._lastHeatTouchAt || 0)) < 25000;
      ['temp', 'psi', 'progress', 'overheatTimer'].forEach(function (key) {
        if (typeof incoming[key] === 'number' && Number.isFinite(incoming[key])) {
          const val = Math.max(0, incoming[key]);
          if (key === 'progress' && !incoming.sterilized && !cooker.sterilized && !incoming.burned && !cooker.burned &&
              cooker.temp >= 95 && (Number(incoming.temp) || 0) >= 95 && val < 100) {
            cooker.progress = Math.max(Number(cooker.progress) || 0, val);
          } else if (key === 'temp') {
            if (onActiveBurner || recentLocalThermal) {
              if (val > cooker.temp + 6) cooker.temp = val;
            } else if (cooker.temp >= 30 && val >= 30 && Math.abs(cooker.temp - val) <= 10) {
              cooker.temp = Math.max(cooker.temp, val);
            } else {
              cooker.temp = val;
            }
          } else if (key === 'psi' && (onActiveBurner || recentLocalThermal)) {
            if (val > cooker.psi + 3) cooker.psi = val;
          } else {
            cooker[key] = val;
          }
        }
      });
      if (typeof incoming.grainGrams === 'number' && Number.isFinite(incoming.grainGrams)) {
        cooker.grainGrams = Math.max(0, Math.min(5000, incoming.grainGrams));
      }
      if (typeof incoming.grainCookSec === 'number' && Number.isFinite(incoming.grainCookSec)) {
        cooker.grainCookSec = Math.max(0, incoming.grainCookSec);
      }
      if (typeof incoming.grainAlDente === 'boolean') cooker.grainAlDente = incoming.grainAlDente;
      if (typeof incoming.hasBase === 'boolean') cooker.hasBase = incoming.hasBase;
      ['sterilized', 'burned'].forEach(function (key) {
        if (typeof incoming[key] === 'boolean') cooker[key] = incoming[key];
      });
      cooker.lastHudKey = '';
      if (Array.isArray(incoming.contents)) {
        cooker.contents = incoming.contents.slice(0, 6)
          .map((itemId) => sim.findPickable(itemId))
          .filter(Boolean);
      }
      updateCookerWaterVisual(cooker);
    }
  }
  const meta = item.meta || (item.mesh && item.mesh.userData && item.mesh.userData.itemMeta);
  if (meta && typeof meta.applyState === 'function' && state.custom && typeof state.custom === 'object') {
    meta.applyState(item, state.custom, sim);
  }
}

export function advanceOfflineItemState(item, ageSec) {
  const sec = Math.max(0, Math.min(7200, Number(ageSec) || 0));
  if (!item || sec < 2) return false;
  const meshData = item.mesh && item.mesh.userData;
  let progressed = false;

  const dc = item.dehydratorCtrl;
  if (dc && dc.on && dc.hasMushroom && !dc.crisp) {
    dc.progress = Math.min(100, (Number(dc.progress) || 0) + (sec / DEHYDRATOR_DRY_SECONDS) * 100);
    if (dc.progress >= 100) dc.crisp = true;
    if (dc.updateVisual) dc.updateVisual();
    else updateDehydratorVisual(item);
    progressed = true;
  }

  const sc = item.spawnCtrl || (meshData && meshData.spawnCtrl);
  if (sc && sc.inoculated && !sc.colonized && !sc.contaminated && !sc.burned && !sc.expired) {
    const shakeMult = sc.shaken ? 2.2 : 1.0;
    const genMult = 1 + Math.min(3, Math.max(0, sc.generation || 0)) * 0.15;
    const rate = sc.refrigerated ? (4.2 * 0.2) : (4.2 * shakeMult * genMult);
    sc.colonization = Math.min(100, (Number(sc.colonization) || 0) + sec * rate);
    if (sc.colonization >= 100) sc.colonized = true;
    sc.updateVisual();
    progressed = true;
  }

  const petri = meshData && meshData.petriCtrl;
  if (petri && petri.mode === 'colonizing' && !petri.expired && !petri.contaminated) {
    const genBoost = 1 + Math.min(3, petri.generation || 0) * 0.22;
    const rate = petri.refrigerated ? (0.8 * 0.2) : (0.8 * genBoost);
    petri.colonization = Math.min(100, (Number(petri.colonization) || 0) + sec * rate);
    if (petri.colonization >= 100) {
      petri.mode = 'clean';
      petri.colonized = true;
    }
    updatePetriVisual(item);
    progressed = true;
  }

  const culture = item.cultureCtrl || (meshData && meshData.cultureCtrl);
  if (culture && culture.inoculated && !culture.colonized && !culture.contaminated && !culture.expired) {
    const rate = culture.refrigerated ? 0.25 : 2.5;
    culture.colonization = Math.min(100, (Number(culture.colonization) || 0) + sec * rate);
    if (culture.colonization >= 100) culture.colonized = true;
    progressed = true;
  }

  const mc = item.monotubCtrl;
  if (mc && !mc.spent && !mc.contaminated) {
    let tubChanged = false;
    let rem = sec;
    if (mc.mixed && mc.leveled && !mc.lidOpen && mc.colonization < 100) {
      const needCol = 100 - mc.colonization;
      const tCol = needCol / 3.8;
      if (rem >= tCol) {
        mc.colonization = 100;
        rem -= tCol;
      } else {
        mc.colonization += rem * 3.8;
        rem = 0;
      }
      tubChanged = true;
    }
    const pos = item.mesh && item.mesh.position;
    const inLed = mc.onLedRack || (pos && pos.x >= 14.8 && pos.x <= 15.8 && pos.z >= -5.4 && pos.z <= -2.2 && pos.y >= 0.35);
    if (rem > 0 && mc.colonization >= 100 && inLed && mc.fruitingStage < 3) {
      mc.onLedRack = true;
      if (mc.fruitingStage === 0) {
        mc.fruitingStage = 1;
        mc.growth = 0;
        tubChanged = true;
      }
      const casingMult = mc.hasCasing ? 1.4 : 1.0;
      const humMult = (mc.humidity || 90) >= 85 ? 1.15 : 0.78;
      const genMult = 1 + Math.min(3, Math.max(0, mc.generation || 0)) * 0.14;
      const gRate = 4.5 * casingMult * humMult * genMult;
      mc.growth = (Number(mc.growth) || 0) + rem * gRate;
      while (mc.growth >= 100 && mc.fruitingStage < 3) {
        mc.growth -= 100;
        mc.fruitingStage++;
      }
      if (mc.fruitingStage >= 3) mc.growth = 0;
      tubChanged = true;
    }
    if (tubChanged) {
      if (mc.updateVisual) mc.updateVisual();
      else updateMonotubVisual(item);
      progressed = true;
    }
  }
  return progressed;
}

export function applyCampusItemStates(sim, itemStates, itemStateAges) {
  if (!itemStates || typeof itemStates !== 'object') return;
  const itemsById = new Map(sim.pickableItems.map((item) => [item.id, item]));
  let spawnedPlaced = false;
  Object.keys(itemStates).forEach(function (itemId) {
    let item = itemsById.get(itemId);
    const st = itemStates[itemId];
    if (st && st.custom && st.custom.removed === true) {
      if (item) {
        removeItemInstanceLocally(sim, item);
        itemsById.delete(itemId);
      }
      return;
    }
    if (!item && itemId.indexOf('wild_picked_') === 0 && st && st.wildMushroom && !st.wildMushroom.removed) {
      item = spawnPersistedWildMushroom(sim, itemId, st.wildMushroom);
      if (item) itemsById.set(itemId, item);
    }
    if (!item && st && st.custom && st.custom.dynamicKind && !st.custom.removed) {
      const savedPose = (sim._lastWorldObjectsMap && sim._lastWorldObjectsMap[itemId]) || null;
      item = spawnDynamicItemFromCustom(sim, itemId, st.custom, savedPose);
      if (item) {
        itemsById.set(itemId, item);
        if (savedPose && item.mesh) {
          item.mesh.position.set(savedPose.x || 0, savedPose.y || 0, savedPose.z || 0);
          item.mesh.rotation.y = savedPose.ry || 0;
          item.isMoved = true;
          if (item.mesh.userData && item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
          spawnedPlaced = true;
        }
      }
    }
    if (!item) return;
    applyReplicatedItemState(sim, item, st);
    const ageSec = itemStateAges && typeof itemStateAges[itemId] === 'number' ? itemStateAges[itemId] : 0;
    if (ageSec > 1 && advanceOfflineItemState(item, ageSec) && sim.markItemMoved) {
      sim.markItemMoved(item);
    }
    sim.itemStateSignatures = sim.itemStateSignatures || {};
    const currentState = getReplicatedItemState(sim, item);
    if (currentState) sim.itemStateSignatures[itemId] = JSON.stringify(currentState);
  });
  if (spawnedPlaced) {
    sim._stackPhysicsDirty = true;
    markItemsFalling(sim);
  }
}

export function applyCampusWorldObjects(sim, objectsMap) {
  if (!objectsMap) return;
  sim._lastWorldObjectsMap = objectsMap;
  const now = performance.now();
  let anyPositionChanged = false;

  sim.pickableItems.forEach(function (item) {
    if (!item.mesh.userData.updateBounds || item._removedForSync) return;
    const isInHeldPot = !!(sim.heldItem && sim.heldItem.cookerRef && sim.heldItem.cookerRef.contents && sim.heldItem.cookerRef.contents.indexOf(item) !== -1);
    const isInHeldTray = !!(sim.heldItem && sim.heldItem.trayContents && sim.heldItem.trayContents.some((tc) => tc && tc.item === item));
    const isHeldLid = !!(sim.heldItem && sim.heldItem.lidItem === item);
    if (sim.heldItem === item || isInHeldPot || isInHeldTray || isHeldLid || sim.isHeldByRemote(item.id)) return;
    if (sim.pendingMovedItems[item.id]) return;
    if (sim.recentlyDropped[item.id] > now) {
      const svCheck = objectsMap[item.id];
      if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.08 && Math.abs(svCheck.y - item.mesh.position.y) < 0.08) {
        delete sim.recentlyDropped[item.id];
      } else if (sim.recentlyDropped[item.id] - now < 23500) {
        sim.pendingMovedItems[item.id] = {
          id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
        };
      }
      return;
    }
    const saved = objectsMap[item.id];
    if (saved) {
      const nextRy = saved.ry || 0;
      const changed = !item.isMoved ||
        Math.abs(item.mesh.position.x - saved.x) > 0.002 ||
        Math.abs(item.mesh.position.y - saved.y) > 0.002 ||
        Math.abs(item.mesh.position.z - saved.z) > 0.002 ||
        Math.abs((item.mesh.rotation.y || 0) - nextRy) > 0.002;
      if (changed) {
        item.mesh.position.set(saved.x, saved.y, saved.z);
        item.mesh.rotation.y = nextRy;
        item.isMoved = true;
        item.mesh.userData.updateBounds(item);
        saveLocalMovedObject(item, undefined, true);
        anyPositionChanged = true;
      }
    } else if (item.isMoved && !(item.movedAt && (now - item.movedAt < 25000))) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      item.mesh.userData.updateBounds(item);
      item.isMoved = false;
      anyPositionChanged = true;
    }
  });

  sim.pickableItems.forEach(function (item) {
    if (item.mesh.userData.updateBounds || item._removedForSync) return;
    const isInHeldPot = !!(sim.heldItem && sim.heldItem.cookerRef && sim.heldItem.cookerRef.contents && sim.heldItem.cookerRef.contents.indexOf(item) !== -1);
    const isInHeldTray = !!(sim.heldItem && sim.heldItem.trayContents && sim.heldItem.trayContents.some((tc) => tc && tc.item === item));
    const isHeldLid = !!(sim.heldItem && sim.heldItem.lidItem === item);
    if (sim.heldItem === item || isInHeldPot || isInHeldTray || isHeldLid || sim.isHeldByRemote(item.id)) return;
    if (sim.pendingMovedItems[item.id]) return;
    if (sim.recentlyDropped[item.id] > now) {
      const svCheck = objectsMap[item.id];
      if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.08 && Math.abs(svCheck.y - item.mesh.position.y) < 0.08) {
        delete sim.recentlyDropped[item.id];
      } else if (sim.recentlyDropped[item.id] - now < 23500) {
        sim.pendingMovedItems[item.id] = {
          id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
        };
      }
      return;
    }
    if (item.potItem && item.isAttached) {
      const pRef = item.potItem;
      if (sim.heldItem === pRef || sim.isHeldByRemote(pRef.id) || sim.pendingMovedItems[pRef.id] || sim.recentlyDropped[pRef.id] > now) {
        return;
      }
    }
    const saved = objectsMap[item.id];
    if (saved) {
      if (item.potItem) {
        const pot = item.potItem;
        const potSaved = objectsMap[pot.id];
        const refX = potSaved ? potSaved.x : pot.mesh.position.x;
        const refY = potSaved ? potSaved.y : pot.mesh.position.y;
        const refZ = potSaved ? potSaved.z : pot.mesh.position.z;
        const attached = Math.hypot(saved.x - refX, saved.z - refZ) < 0.28 &&
          Math.abs(saved.y - (refY + 0.36)) < 0.28;
        item.isAttached = attached;
        if (attached) {
          const targetY = pot.mesh.position.y + 0.36;
          const changed = !item.isMoved ||
            Math.abs(item.mesh.position.x - pot.mesh.position.x) > 0.002 ||
            Math.abs(item.mesh.position.y - targetY) > 0.002 ||
            Math.abs(item.mesh.position.z - pot.mesh.position.z) > 0.002;
          if (changed) {
            item.mesh.position.set(pot.mesh.position.x, targetY, pot.mesh.position.z);
            item.mesh.rotation.copy(pot.mesh.rotation);
            item.isMoved = true;
            saveLocalMovedObject(item, undefined, true);
            anyPositionChanged = true;
          }
          return;
        }
      }
      const nextRy = saved.ry || 0;
      const changed = !item.isMoved ||
        Math.abs(item.mesh.position.x - saved.x) > 0.002 ||
        Math.abs(item.mesh.position.y - saved.y) > 0.002 ||
        Math.abs(item.mesh.position.z - saved.z) > 0.002 ||
        Math.abs((item.mesh.rotation.y || 0) - nextRy) > 0.002;
      if (changed) {
        item.mesh.position.set(saved.x, saved.y, saved.z);
        item.mesh.rotation.y = nextRy;
        item.isMoved = true;
        saveLocalMovedObject(item, undefined, true);
        anyPositionChanged = true;
      }
    } else if (item.isMoved && !(item.movedAt && (now - item.movedAt < 25000))) {
      sim.removeFromCookerContents(item);
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.potItem) item.isAttached = true;
      item.isMoved = false;
      anyPositionChanged = true;
    }
  });
  flushLocalMovedObjects();
  if (anyPositionChanged) {
    sim._stackPhysicsDirty = true;
    markItemsFalling(sim);
  }
}

export function resetCampusWorldObjects(sim) {
  clearLocalMovedObjects();
  if (sim.cancelHeldItemPlacement) sim.cancelHeldItemPlacement();
  setHeldTwoHandedGhost(sim.heldItem, false);
  sim.heldItem = null;
  sim.pendingMovedItems = {};
  sim.recentlyDropped = {};
  sim.itemStateSignatures = {};
  for (let cpi = 0; cpi < sim.cookerPots.length; cpi++) {
    const cp = sim.cookerPots[cpi];
    cp.contents = [];
    cp.waterMl = 0;
    cp.psi = 0;
    cp.temp = 25;
    cp.progress = 0;
    cp.sterilized = false;
    cp.overheatTimer = 0;
    cp.burned = false;
    if (cp.steamPoints) cp.steamPoints.visible = false;
    if (cp.openPotSteam) cp.openPotSteam.points.visible = false;
    if (cp.statusSprite) cp.statusSprite.visible = false;
    cp.lastHudKey = '';
    if (cp.weight) { cp.weight.position.y = 0.13; cp.weight.rotation.set(0, 0, 0); }
    if (cp.weightTop) { cp.weightTop.position.y = 0.16; cp.weightTop.rotation.set(0, 0, 0); }
    if (cp.safetyPins) {
      for (let pni = 0; pni < cp.safetyPins.length; pni++) cp.safetyPins[pni].position.y = 0.110;
    }
    updateCookerWaterVisual(cp);
  }
  sim.pickableItems.forEach(function (item) {
    item.mesh.position.copy(item.homePos);
    item.mesh.rotation.y = item.homeRy;
    if (item.potItem) item.isAttached = true;
    if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
    item.isMoved = false;
    if (item.mesh.userData.syrCtrl) {
      updateSyringeVolume(item, 0);
    }
    if (item.bowlCtrl) {
      item.bowlCtrl.ingredients.flocao = 0;
      item.bowlCtrl.ingredients.water = 0;
      item.bowlCtrl.ingredients.corn = 0;
      item.bowlCtrl.ingredients.sawdust = 0;
      item.bowlCtrl.mixed = false;
      item.bowlCtrl.stirCount = 0;
      updateMixingBowlLabel(item);
    }
    if (item.scalpelCtrl) {
      item.scalpelCtrl.hasBlade = true;
      item.scalpelCtrl.sterile = true;
      item.scalpelCtrl.hasMycelium = false;
      if (item.scalpelCtrl.bladeMesh) item.scalpelCtrl.bladeMesh.visible = true;
      updateScalpelLabel(item);
    }
  });
  sim._stackPhysicsDirty = true;
  markItemsFalling(sim);
  if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
}


export function applyCampusSavedPose(sim, pose) {
  if (!pose || typeof pose !== 'object') return;
  if (typeof pose.x === 'number' && typeof pose.z === 'number') {
    sim.playerPos.set(pose.x, typeof pose.y === 'number' ? pose.y : 0, pose.z);
  }
  if (typeof pose.yaw === 'number') sim.playerYaw = pose.yaw;
  if (typeof pose.pitch === 'number') sim.playerPitch = pose.pitch;
  if (pose.seated) {
    let bestSeat = null, bestD = 1.6;
    for (let i = 0; i < sim.seatMeshes.length; i++) {
      const si = sim.seatMeshes[i].userData.seatInfo;
      if (!si) continue;
      const d = Math.hypot(si.x - sim.playerPos.x, si.z - sim.playerPos.z);
      if (d < bestD && Math.abs(si.y - sim.playerPos.y) < 1.0) {
        bestD = d;
        bestSeat = si;
      }
    }
    if (bestSeat) {
      sim.seatedSeat = bestSeat;
      sim.playerPos.set(bestSeat.x, bestSeat.y, bestSeat.z);
    }
  }
  if (pose.holding && !sim.heldItem) {
    const item = sim.findPickable(pose.holding);
    if (item && !sim.isHeldByRemote(item.id)) {
      sim.removeFromCookerContents(item);
      if (item.potItem && item.isAttached) item.isAttached = false;
      sim.heldItem = item;
      sim.heldRotY = item.mesh.rotation.y;
      setHeldTwoHandedGhost(sim.heldItem, true);
      if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(sim.heldItem.label);
    }
  }
}
