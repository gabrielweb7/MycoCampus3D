import { t } from '../core/i18n.js';
import { normalizeCultureOrigin } from '../core/culture-origin.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { getBowlBulkReadiness, addIngredientToBowl, stirMixingBowl, updateMixingBowlLabel } from '../items/mixing-bowl.js';
import { markBladePackEmpty, updateScalpelLabel } from '../items/scalpel.js';
import { fillSpawnWithSubstrate, getSpawnContainerBaseLabel } from '../items/spawn-containers.js';
import { getItemKindId } from '../items/item-registry.js';
import { updateFalconCultureVisual } from '../items/falcon-tubes.js';
import { inoculatePetri, updatePetriVisual } from '../items/petri-dish.js';
import { unlockAchievement } from '../core/achievements.js';

export function handleFlocaoTargetAction(ctx) {
  const target = ctx.hoveredFlocaoTarget;
  if (target.bowlCtrl) {
    const receivesIngredients = target.meta && target.meta.compatibilities &&
      target.meta.compatibilities.receivesIngredients;
    if (!receivesIngredients) return;
    addIngredientToBowl(target, 'flocao', 50);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.flocao_bowl', { label: target.label }));
    ctx.notifyWorldAction();
    return;
  }
  const spawn = target.spawnCtrl;
  const receivesFlocao = target.meta && target.meta.compatibilities &&
    target.meta.compatibilities.receivesFlocao;
  if (spawn && receivesFlocao && !spawn.filled) {
    spawn.filled = true;
    spawn.fillGrams = 45;
    spawn.substrateKind = 'flocao';
    spawn.baseLabel = t('actions.lab.pp5_flocao_label');
    if (target.meta && target.meta.compatibilities) {
      target.meta.compatibilities.acceptsPdaMedium = false;
      target.meta.compatibilities.receivesFlocao = false;
    }
    if (spawn.fillMesh) spawn.fillMesh.visible = true;
    spawn.updateVisual();
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.flocao_pp5'));
    ctx.notifyWorldAction();
  }
}

export function handleMixingBowlTargetAction(ctx) {
  const target = ctx.hoveredBowlTarget;
  if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isLabSpoon) {
    const bc = target && target.bowlCtrl;
    const total = bc ? Object.values(bc.ingredients).reduce((a, b) => a + b, 0) : 0;
    if (!bc || total <= 0) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.bowl_empty'));
      return true;
    }
    if (bc.mixed) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.bowl_already_mixed'));
      return true;
    }
    ctx.stirHold = { spoon: ctx.heldItem, bowl: target, soundAt: 0 };
    return true;
  }
  if (ctx.heldItem.bowlCtrl && ctx.heldItem.bowlCtrl.mixed && target.spawnCtrl) {
    const dstSc = target.spawnCtrl;
    const bowl = ctx.heldItem.bowlCtrl;
    const bulkState = getBowlBulkReadiness(bowl);
    if (bulkState.isBulk && !bulkState.ready) {
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t('actions.lab.bowl_bulk_not_ready'));
      }
      return true;
    }
    const needSolid = dstSc.isPP5 ? 45 : 200;
    const needWater = dstSc.isPP5 ? 35 : 100;
    const cocoVermG = (bowl.ingredients.coco || 0) + (bowl.ingredients.vermiculite || 0);
    const isCocoVerm = cocoVermG >= needSolid && (bowl.ingredients.coco || 0) > 0 && (bowl.ingredients.vermiculite || 0) > 0;
    const isSawdust = !isCocoVerm && (bowl.ingredients.sawdust || 0) >= needSolid;
    const solidKey = isCocoVerm
      ? 'coco_verm'
      : (isSawdust
        ? 'sawdust'
        : (bowl.ingredients.flocao > 0
          ? 'flocao'
          : (bowl.ingredients.wheat > 0
            ? 'wheat'
            : (bowl.ingredients.sorghum > 0 ? 'sorghum' : (bowl.ingredients.corn > 0 ? 'corn' : 'corn')))));
    const solidAvailable = isCocoVerm ? cocoVermG : (bowl.ingredients[solidKey] || 0);
    const waterAvailable = bowl.ingredients.water || 0;
    if (solidAvailable >= needSolid && waterAvailable >= needWater) {
      if (isCocoVerm) {
        let rem = needSolid;
        const takeCoco = Math.min(bowl.ingredients.coco || 0, rem * 0.5);
        bowl.ingredients.coco = Math.max(0, (bowl.ingredients.coco || 0) - takeCoco);
        rem -= takeCoco;
        const takeVerm = Math.min(bowl.ingredients.vermiculite || 0, rem);
        bowl.ingredients.vermiculite = Math.max(0, (bowl.ingredients.vermiculite || 0) - takeVerm);
        rem -= takeVerm;
        if (rem > 0 && (bowl.ingredients.coco || 0) > 0) {
          bowl.ingredients.coco = Math.max(0, bowl.ingredients.coco - rem);
        }
      } else {
        bowl.ingredients[solidKey] -= needSolid;
      }
      bowl.ingredients.water -= needWater;
      updateMixingBowlLabel(ctx.heldItem);
      dstSc.filled = true;
      dstSc.hydrated = true;
      dstSc.substrateKind = solidKey;
      dstSc.fillGrams = needSolid;
      dstSc.waterMl = needWater;
      dstSc.pasteurized = false;
      dstSc.sterilized = false;
      dstSc.baseLabel = getSpawnContainerBaseLabel(dstSc.isBag, dstSc.isPP5, dstSc.substrateKind, true);
      if (dstSc.fillMesh) dstSc.fillMesh.visible = true;
      dstSc.updateVisual();
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(isCocoVerm
          ? t('actions.lab.bowl_portioned_coco_verm', { label: dstSc.baseLabel })
          : (isSawdust
            ? t('actions.lab.bowl_portioned_sawdust', { label: dstSc.baseLabel })
            : t('actions.lab.bowl_portioned_recipe', { label: dstSc.baseLabel })));
      }
      ctx.notifyWorldAction();
    } else if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('actions.lab.bowl_insufficient', { solid: needSolid, water: needWater }));
    }
    return true;
  }
  return false;
}

export function handleScalpelTargetAction(ctx) {
  const scalpel = ctx.heldItem.scalpelCtrl;
  const target = ctx.hoveredScalpelTarget;
  if (!target) return;
  if (scalpel.hasMycelium && ['cut', 'scrape_spores', 'biopsy'].includes(target.mode)) return;
  if (target.mode === 'blade') {
    if (target.item && target.item.bladePackCtrl && target.item.bladePackCtrl.empty) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.blade_pack_empty'));
      return;
    }
    scalpel.hasBlade = true;
    scalpel.sterile = true;
    scalpel.bladeExpired = false;
    scalpel.bladeContaminated = false;
    scalpel.cutContaminated = false;
    scalpel.lastGeneticsKey = '';
    scalpel.biopsySpecies = '';
    scalpel.bladeAttachedAt = performance.now();
    scalpel.hasMycelium = false;
    scalpel.origin = '';
    if (scalpel.bladeMesh) scalpel.bladeMesh.visible = true;
    markBladePackEmpty(target.item);
    updateScalpelLabel(ctx.heldItem);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.blade_attached'));
    ctx.notifyWorldAction();
  } else if (target.mode === 'scrape_spores') {
    const petri = target.item && target.item.mesh.userData.petriCtrl;
    if (!scalpel.hasBlade) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.need_blade_spores'));
      return;
    }
    if (!isAsepticWorkArea(ctx, target.item)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.need_hood_spores'));
      return;
    }
    if (!scalpel.sterile || scalpel.bladeExpired || scalpel.bladeContaminated) {
      ctx.callbacks.onToast?.(t('actions.lab.need_sterile_blade_monospore'));
      return;
    }
    if (!petri || !petri.lidOpen || petri.mode !== 'spore_print') {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.need_open_spore_print'));
      return;
    }
    if (petri.expired || petri.sporeContaminated || petri.contaminated) {
      ctx.callbacks.onToast?.(t('actions.lab.need_viable_spore_print'));
      return;
    }
    scalpel.origin = 'monospore';
    const spName = petri.speciesName || 'Psilocybe cubensis';
    scalpel.hasMycelium = true;
    scalpel.isSporeSample = true;
    scalpel.cutGeneration = 0;
    scalpel.biopsySpecies = spName;
    scalpel.biopsyAseptic = !!scalpel.sterile && !petri.sporeContaminated && !!(ctx.wearingGloves && !ctx.glovesExpired);
    scalpel.cutContaminated = !scalpel.sterile || !!petri.sporeContaminated;
    updateScalpelLabel(ctx.heldItem);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('actions.lab.monospore_collected', { species: spName }));
    }
    ctx.notifyWorldAction();
  } else if (target.mode === 'cut') {
    const petri = target.item && target.item.mesh.userData.petriCtrl;
    const spawn = target.item && target.item.spawnCtrl;
    const slantCult = target.item && target.item.pdaMediumCtrl && target.item.pdaMediumCtrl.isSlant && target.item.cultureCtrl;
    if (!scalpel.hasBlade) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.need_blade_mycelium'));
      return;
    }
    if (!isAsepticWorkArea(ctx, target.item)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.need_hood_mycelium'));
      return;
    }
    if (petri && (!petri.lidOpen || petri.mode !== 'clean' || petri.expired || petri.contaminated)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.need_healthy_open_petri'));
      return;
    }
    if (slantCult && (!slantCult.colonized || slantCult.contaminated || slantCult.expired)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.slant_not_viable'));
      return;
    }
    if (spawn && (spawn.burned || spawn.contaminated || spawn.expired || spawn.colonization < 60)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.spawn_not_viable'));
      return;
    }
    if (spawn && spawn.isPP5 && !spawn.lidOpen) {
      ctx.callbacks.onToast?.(t('actions.lab.open_pp5_before_cut'));
      return;
    }
    const cutSpecies = (petri && petri.speciesName) || (slantCult && slantCult.speciesName) || (spawn && spawn.speciesName) || '';
    const genKey = cutSpecies || (target.item && target.item.id) || '';
    const changedGenetics = !!(scalpel.lastGeneticsKey && genKey && scalpel.lastGeneticsKey !== genKey);
    if (changedGenetics) {
      scalpel.sterile = false;
      scalpel.bladeContaminated = true;
    }
    if (genKey) scalpel.lastGeneticsKey = genKey;
    scalpel.biopsySpecies = cutSpecies;
    scalpel.origin = normalizeCultureOrigin((petri || slantCult || spawn)?.origin);
    const srcGen = petri ? (petri.generation || 0) : (slantCult ? (slantCult.generation || 1) : ((spawn && spawn.generation) || 1));
    scalpel.cutGeneration = Math.min(3, srcGen + 1);
    scalpel.biopsyAseptic = true;
    const usedContamBlade = !scalpel.sterile;
    scalpel.hasMycelium = true;
    scalpel.isSporeSample = false;
    scalpel.cutContaminated = usedContamBlade;
    if (petri) {
      petri.cutWedges = (petri.cutWedges || 0) + 1;
      if (usedContamBlade) {
        petri.mode = 'contam';
        petri.contaminated = true;
        petri.colonized = false;
      }
      updatePetriVisual(target.item);
    }
    if (usedContamBlade && spawn) {
      spawn.contaminated = true;
      spawn.updateVisual();
    }
    updateScalpelLabel(ctx.heldItem);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(changedGenetics
        ? t('actions.lab.cut_changed_genetics')
        : (usedContamBlade
          ? t('actions.lab.cut_contam_blade')
          : t('actions.lab.cut_success')));
    }
    ctx.notifyWorldAction();
  } else if (target.mode === 'biopsy' && target.item && target.item.wildMushroomCtrl) {
    if (!scalpel.hasBlade) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.need_blade_mushroom'));
      return;
    }
    const wm = target.item.wildMushroomCtrl;
    const genKey = wm.speciesName || target.item.id || '';
    const changedGenetics = !!(scalpel.lastGeneticsKey && genKey && scalpel.lastGeneticsKey !== genKey);
    if (changedGenetics) {
      scalpel.sterile = false;
      scalpel.bladeContaminated = true;
    }
    if (genKey) scalpel.lastGeneticsKey = genKey;
    const hoodOk = isAsepticWorkArea(ctx, target.item);
    const bladeOk = !!scalpel.sterile;
    const glovesOk = !!(ctx.wearingGloves && !ctx.glovesExpired);
    scalpel.hasMycelium = true;
    scalpel.isSporeSample = false;
    scalpel.cutGeneration = 1;
    scalpel.origin = 'tissue_clone';
    scalpel.biopsySpecies = wm.speciesName;
    scalpel.biopsyAseptic = hoodOk && bladeOk && glovesOk;
    scalpel.cutContaminated = !bladeOk;
    updateScalpelLabel(ctx.heldItem);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(changedGenetics
        ? t('actions.lab.biopsy_changed_genetics')
        : (scalpel.biopsyAseptic
          ? t('actions.lab.biopsy_aseptic', { species: wm.speciesName })
          : t('actions.lab.biopsy_risk', { species: wm.speciesName })));
    }
    ctx.notifyWorldAction();
  } else if (target.mode === 'open') {
    ctx.callbacks.onToast?.(t('actions.lab.open_lid_aimed'));
  } else if (target.mode === 'transfer' && target.item && target.item.mesh.userData.petriCtrl) {
    const petri = target.item.mesh.userData.petriCtrl;
    const receivesMyceliumCut = target.item.meta && target.item.meta.compatibilities &&
      target.item.meta.compatibilities.receivesMyceliumCut;
    if (!receivesMyceliumCut || !petri.lidOpen || petri.mode !== 'empty' || !petri.sterilized) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.petri_dest_not_ready'));
      return;
    }
    const sterileTransfer = scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item);
    let contamRisk = 0;
    if (!(ctx.wearingGloves && !ctx.glovesExpired)) contamRisk += 0.25;
    if (!((target.item.sanitizedUntil || 0) > performance.now())) contamRisk += 0.15;
    if (!((ctx.heldItem.sanitizedUntil || 0) > performance.now())) contamRisk += 0.15;
    if (scalpel.isSporeSample && !sterileTransfer) {
      ctx.callbacks.onToast?.(t('actions.lab.monospore_petri_aseptic'));
      return;
    }
    const inocMethod = scalpel.isSporeSample ? 'spores' : 'mycelium';
    const nextGen = scalpel.isSporeSample ? 0 : Math.min(3, Math.max(1, scalpel.cutGeneration || 1));
    if (!inoculatePetri(target.item, inocMethod, sterileTransfer, contamRisk, scalpel.biopsySpecies, nextGen, scalpel.origin)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.petri_transfer_failed'));
      return;
    }
    if (sterileTransfer && !contamRisk) unlockAchievement('first_clean_culture', ctx.callbacks?.onToast);
    if (ctx.callbacks.onToast) ctx.callbacks.onToast(sterileTransfer
      ? (scalpel.isSporeSample
        ? t('actions.lab.petri_monospore_ok')
        : (scalpel.origin === 'tissue_clone' ? t('actions.lab.petri_clone_ok') : t('actions.lab.petri_fragment_ok')))
      : t('actions.lab.petri_transfer_contam'));
    scalpel.hasMycelium = false;
    scalpel.origin = '';
    scalpel.isSporeSample = false;
    scalpel.cutContaminated = false;
    scalpel.biopsyAseptic = true;
    if (!sterileTransfer) scalpel.sterile = false;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  } else if (target.mode === 'crossbreed' && target.item && target.item.mesh.userData.petriCtrl) {
    if (scalpel.isSporeSample) return;
    const petri = target.item.mesh.userData.petriCtrl;
    const aseptic = scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item) && !!(ctx.wearingGloves && !ctx.glovesExpired);
    if (!petri.lidOpen || petri.mode !== 'clean' || petri.contaminated) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.crossbreed_need_open_petri'));
      return;
    }
    if (!aseptic) {
      petri.mode = 'contam';
      petri.contaminated = true;
      petri.colonized = false;
      updatePetriVisual(target.item);
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.crossbreed_contam'));
    } else {
      const isGold = ((petri.speciesName || '').length + (scalpel.biopsySpecies || '').length) % 2 === 0;
      petri.hybridMutant = isGold ? 'gold' : 'albino';
      petri.generation = 3;
      petri.origin = 'hybrid';
      const baseName = (petri.speciesName || 'Psilocybe cubensis').replace(/\s*•\s*(?:🌟|✨).*$/, '').trim();
      const variantTag = isGold ? t('actions.lab.variant_gold') : t('actions.lab.variant_albino');
      petri.speciesName = `${baseName} • ${variantTag}`;
      updatePetriVisual(target.item);
      if (window.MycoAudio && window.MycoAudio.playQuestComplete) window.MycoAudio.playQuestComplete();
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t('actions.lab.crossbreed_success', { species: petri.speciesName }));
      }
    }
    scalpel.hasMycelium = false;
    scalpel.origin = '';
    scalpel.isSporeSample = false;
    scalpel.cutContaminated = false;
    scalpel.biopsyAseptic = true;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  } else if (target.mode === 'transfer_slant' && target.item && target.item.cultureCtrl && target.item.pdaMediumCtrl && target.item.pdaMediumCtrl.isSlant) {
    const sl = target.item.cultureCtrl;
    const pda = target.item.pdaMediumCtrl;
    if (!pda.sterilized || pda.burned) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.slant_need_sterile'));
      return;
    }
    const aseptic = scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item) && !!(ctx.wearingGloves && !ctx.glovesExpired);
    sl.origin = normalizeCultureOrigin(scalpel.origin);
    sl.inoculated = true;
    sl.colonized = false;
    sl.sterilized = true;
    sl.generation = scalpel.isSporeSample ? 0 : Math.min(3, Math.max(1, scalpel.cutGeneration || 1));
    if (scalpel.biopsySpecies) sl.speciesName = scalpel.biopsySpecies;
    if (aseptic) {
      sl.colonization = 4;
      sl.contaminated = false;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.slant_transfer_ok'));
    } else {
      sl.colonization = 0;
      sl.contaminated = true;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.slant_transfer_contam'));
    }
    updateFalconCultureVisual(target.item);
    scalpel.hasMycelium = false;
    scalpel.origin = '';
    scalpel.isSporeSample = false;
    scalpel.cutContaminated = false;
    scalpel.biopsyAseptic = true;
    if (!aseptic) scalpel.sterile = false;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  } else if (target.mode === 'transfer_lc' && target.item && target.item.cultureCtrl) {
    const lc = target.item.cultureCtrl;
    if (lc.hasNutrient === false) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.lc_need_nutrient'));
      return;
    }
    const lcLiq = target.item.mesh && target.item.mesh.userData && target.item.mesh.userData.liquidCtrl;
    const lcSterile = !!(lc.sterilized || target.item.sterilized || (lcLiq && lcLiq.sterilized));
    const aseptic = lcSterile && scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item) && !!(ctx.wearingGloves && !ctx.glovesExpired);
    if (scalpel.isSporeSample && (!lcSterile || !aseptic)) {
      ctx.callbacks.onToast?.(t('actions.lab.monospore_lc_aseptic'));
      return;
    }
    lc.origin = normalizeCultureOrigin(scalpel.origin);
    lc.inoculated = true;
    lc.colonized = false;
    lc.generation = scalpel.isSporeSample ? 0 : Math.min(3, Math.max(1, scalpel.cutGeneration || 1));
    if (scalpel.biopsySpecies) lc.speciesName = scalpel.biopsySpecies;
    if (aseptic) {
      lc.colonization = 2;
      lc.contaminated = false;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(scalpel.isSporeSample ? t('actions.lab.lc_monospore_ok') : t('actions.lab.lc_fragment_ok'));
    } else {
      lc.colonization = 0;
      lc.contaminated = true;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(!lcSterile
        ? t('actions.lab.lc_not_sterile_contam')
        : t('actions.lab.lc_aseptic_contam'));
    }
    if (target.item.setVolume && target.item.mesh && target.item.mesh.userData.liquidCtrl) {
      target.item.setVolume(target.item.mesh.userData.liquidCtrl.volMl);
    }
    scalpel.hasMycelium = false;
    scalpel.origin = '';
    scalpel.cutContaminated = false;
    scalpel.biopsyAseptic = true;
    if (!aseptic) scalpel.sterile = false;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  } else if (target.mode === 'transfer' && target.item && target.item.spawnCtrl) {
    const spawn = target.item.spawnCtrl;
    const receivesMyceliumCut = target.item.meta && target.item.meta.compatibilities &&
      target.item.meta.compatibilities.receivesMyceliumCut;
    if (!receivesMyceliumCut || !spawn.filled || spawn.inoculated || spawn.burned || spawn.contaminated) {
      const reason = spawn.burned ? t('actions.lab.reason_burned')
        : (spawn.contaminated ? t('actions.lab.reason_contam')
          : (spawn.inoculated ? t('actions.lab.reason_inoculated') : t('actions.lab.reason_not_ready')));
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.spawn_transfer_failed', { reason }));
      return;
    }
    const isAseptic = isAsepticWorkArea(ctx, target.item);
    if (spawn.isPP5 && !spawn.lidOpen) {
      ctx.callbacks.onToast?.(t('actions.lab.open_pp5_before_transfer'));
      return;
    }
    if (scalpel.isSporeSample && (!spawn.sterilized || !isAseptic || !scalpel.biopsyAseptic)) {
      ctx.callbacks.onToast?.(t('actions.lab.monospore_spawn_aseptic'));
      return;
    }
    spawn.origin = normalizeCultureOrigin(scalpel.origin);
    spawn.inoculated = true;
    spawn.generation = scalpel.isSporeSample ? 0 : Math.min(3, Math.max(1, scalpel.cutGeneration || 1));
    if (scalpel.biopsySpecies) spawn.speciesName = scalpel.biopsySpecies;
    const okTransfer = scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && spawn.sterilized && (isAseptic || Math.random() >= 0.45);
    if (!okTransfer) {
      spawn.contaminated = true;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.lab.spawn_transfer_contam'));
    } else if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('actions.lab.spawn_transfer_ok', { label: spawn.baseLabel }));
    }
    spawn.updateVisual();
    const wasSpores = !!scalpel.isSporeSample;
    scalpel.hasMycelium = false;
    scalpel.origin = '';
    scalpel.isSporeSample = false;
    scalpel.cutContaminated = false;
    scalpel.biopsyAseptic = true;
    if (!okTransfer) scalpel.sterile = false;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (okTransfer && wasSpores && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('actions.lab.spawn_monospore_germinating', { label: spawn.baseLabel }));
    }
    ctx.notifyWorldAction();
  }
}

export function handleSubstrateTargetAction(ctx) {
  const target = ctx.hoveredGrainTarget;
  const heldId = getItemKindId(ctx.heldItem);
  const isVerm = heldId.indexOf('vermiculite') !== -1;
  const isSawdust = heldId.indexOf('sawdust') !== -1;
  const isCoco = !isSawdust && heldId.indexOf('coco') !== -1;
  const isSorghum = heldId.indexOf('sorghum') !== -1;
  const isWheat = heldId.indexOf('wheat') !== -1;
  const kind = isVerm ? 'vermiculite' : (isSawdust ? 'sawdust' : (isCoco ? 'coco' : (isSorghum ? 'sorghum' : (isWheat ? 'wheat' : 'corn'))));
  if (target.bowlCtrl) {
    const receivesIngredients = target.meta && target.meta.compatibilities &&
      target.meta.compatibilities.receivesIngredients;
    if (!receivesIngredients) return;
    const ingKey = kind;
    addIngredientToBowl(target, ingKey, 100);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) {
      const lbl = t(isVerm
        ? 'actions.lab.sub_vermiculite'
        : (isSawdust
          ? 'actions.lab.sub_sawdust'
          : (isCoco
            ? 'actions.lab.sub_coco'
            : (isSorghum
              ? 'actions.lab.sub_sorghum'
              : (isWheat ? 'actions.lab.sub_wheat' : 'actions.lab.sub_corn')))));
      ctx.callbacks.onToast(t('actions.lab.substrate_bowl', { substrate: lbl }));
    }
    ctx.notifyWorldAction();
    return;
  }
  if (isVerm || isCoco || isSawdust) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(isSawdust
        ? t('actions.lab.substrate_sawdust_use_bowl')
        : t('actions.lab.substrate_bulk_use_bowl'));
    }
    return;
  }
  if (fillSpawnWithSubstrate(target, kind)) {
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('actions.lab.substrate_filled', { label: target.label }));
    }
    ctx.notifyWorldAction();
  }
}
