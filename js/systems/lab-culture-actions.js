import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { addIngredientToBowl, stirMixingBowl, updateMixingBowlLabel } from '../items/mixing-bowl.js';
import { updateScalpelLabel } from '../items/scalpel.js';
import { fillSpawnWithSubstrate } from '../items/spawn-containers.js';
import { inoculatePetri, togglePetriLid } from '../items/petri-dish.js';

export function handleFlocaoTargetAction(ctx) {
  const target = ctx.hoveredFlocaoTarget;
  if (target.bowlCtrl) {
    const receivesIngredients = target.meta && target.meta.compatibilities &&
      target.meta.compatibilities.receivesIngredients;
    if (!receivesIngredients) return;
    addIngredientToBowl(target, 'flocao', 50);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌽 +50g de Flocão no Pote de Mistura! (' + target.label + ')');
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
    spawn.baseLabel = 'Potinho PP5 145ml (Flocão)';
    if (target.meta && target.meta.compatibilities) {
      target.meta.compatibilities.acceptsPdaMedium = false;
      target.meta.compatibilities.receivesFlocao = false;
    }
    if (spawn.fillMesh) spawn.fillMesh.visible = true;
    spawn.updateVisual();
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌽 45g de Flocão colocados no Potinho PP5! Adicione água e esterilize por 1h20m.');
    ctx.notifyWorldAction();
  }
}

export function handleMixingBowlTargetAction(ctx) {
  const target = ctx.hoveredBowlTarget;
  if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isLabSpoon) {
    const bc = target && target.bowlCtrl;
    const total = bc ? Object.values(bc.ingredients).reduce((a, b) => a + b, 0) : 0;
    if (!bc || total <= 0) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🥄 Pote de Mistura está vazio!');
      return true;
    }
    if (bc.mixed) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('✅ Receita já está homogênea! Use o pote para porcionar.');
      return true;
    }
    ctx.stirHold = { spoon: ctx.heldItem, bowl: target, soundAt: 0 };
    return true;
  }
  if (ctx.heldItem.bowlCtrl && ctx.heldItem.bowlCtrl.mixed && target.spawnCtrl) {
    const dstSc = target.spawnCtrl;
    const bowl = ctx.heldItem.bowlCtrl;
    const needSolid = dstSc.isPP5 ? 45 : 250;
    const needWater = dstSc.isPP5 ? 35 : 150;
    const solidKey = bowl.ingredients.flocao > 0 ? 'flocao' : (bowl.ingredients.corn > 0 ? 'corn' : 'sawdust');
    const solidAvailable = bowl.ingredients[solidKey] || 0;
    const waterAvailable = bowl.ingredients.water || 0;
    if (solidAvailable >= needSolid && waterAvailable >= needWater) {
      bowl.ingredients[solidKey] -= needSolid;
      bowl.ingredients.water -= needWater;
      updateMixingBowlLabel(ctx.heldItem);
      dstSc.filled = true;
      dstSc.fillGrams = needSolid;
      dstSc.waterMl = needWater;
      if (dstSc.fillMesh) dstSc.fillMesh.visible = true;
      dstSc.updateVisual();
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🥣 Receita porcionada em ' + dstSc.baseLabel + '!');
      ctx.notifyWorldAction();
    } else if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast('⚠️ Mistura insuficiente: precisa de ' + needSolid + 'g de sólido e ' + needWater + 'ml de água.');
    }
    return true;
  }
  return false;
}

export function handleScalpelTargetAction(ctx) {
  const scalpel = ctx.heldItem.scalpelCtrl;
  const target = ctx.hoveredScalpelTarget;
  if (target.mode === 'blade') {
    scalpel.hasBlade = true;
    scalpel.sterile = true;
    scalpel.hasMycelium = false;
    if (scalpel.bladeMesh) scalpel.bladeMesh.visible = true;
    updateScalpelLabel(ctx.heldItem);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🔪 Lâmina estéril #24 encaixada no bisturi!');
    ctx.notifyWorldAction();
  } else if (target.mode === 'cut') {
    const petri = target.item && target.item.mesh.userData.petriCtrl;
    const spawn = target.item && target.item.spawnCtrl;
    if (!scalpel.hasBlade || !scalpel.sterile) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Encaixe uma lâmina estéril #24 no bisturi antes de coletar micélio.');
      return;
    }
    if (!isAsepticWorkArea(ctx, target.item)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Colete micélio apenas dentro do Fluxo Laminar ligado e higienizado com Álcool 70%.');
      return;
    }
    if (petri && (!petri.lidOpen || petri.mode !== 'clean' || petri.expired || petri.contaminated)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Para retirar micélio, use uma placa colonizada saudável e aberta no Fluxo Laminar.');
      return;
    }
    if (spawn && (spawn.burned || spawn.contaminated || spawn.expired || spawn.colonization < 60)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ O micélio deste recipiente não está viável para transferência.');
      return;
    }
    scalpel.hasMycelium = true;
    updateScalpelLabel(ctx.heldItem);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🔪 Fragmento de micélio coletado! Transfira para uma placa estéril ou frasco/bag de spawn.');
    ctx.notifyWorldAction();
  } else if (target.mode === 'biopsy' && target.item && target.item.wildMushroomCtrl) {
    if (!scalpel.hasBlade) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Encaixe uma lâmina #24 no bisturi antes de cortar o cogumelo.');
      return;
    }
    const wm = target.item.wildMushroomCtrl;
    const hoodOk = isAsepticWorkArea(ctx, target.item);
    const bladeOk = !!scalpel.sterile;
    const glovesOk = !!ctx.wearingGloves;
    scalpel.hasMycelium = true;
    scalpel.biopsySpecies = wm.speciesName;
    scalpel.biopsyAseptic = hoodOk && bladeOk && glovesOk;
    updateScalpelLabel(ctx.heldItem);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(scalpel.biopsyAseptic
        ? `🔪 Amostra estéril de ${wm.speciesName} coletada! Transfira para Placa de Petri ou Cultura Líquida.`
        : `🔪 Amostra de ${wm.speciesName} coletada (⚠️ risco de contaminação sem fluxo/luvas/lâmina estéril!).`);
    }
    ctx.notifyWorldAction();
  } else if (target.mode === 'open' && target.item && target.item.mesh.userData.isPetri) {
    togglePetriLid(ctx, target.item);
  } else if (target.mode === 'transfer' && target.item && target.item.mesh.userData.petriCtrl) {
    const petri = target.item.mesh.userData.petriCtrl;
    const receivesMyceliumCut = target.item.meta && target.item.meta.compatibilities &&
      target.item.meta.compatibilities.receivesMyceliumCut;
    if (!receivesMyceliumCut || !petri.lidOpen || petri.mode !== 'empty' || !petri.sterilized) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ A placa de destino precisa estar estéril, aberta e dentro da área asséptica.');
      return;
    }
    const sterileTransfer = scalpel.sterile && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item);
    if (!inoculatePetri(target.item, 'mycelium', sterileTransfer)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Não foi possível transferir o fragmento para esta placa.');
      return;
    }
    if (ctx.callbacks.onToast) ctx.callbacks.onToast(sterileTransfer
      ? '🍄 Fragmento transferido! Acompanhe o crescimento do micélio branco.'
      : '🦠 A transferência contaminou a placa; higienize o Fluxo Laminar, use luvas e lâmina estéril.');
    scalpel.hasMycelium = false;
    scalpel.biopsyAseptic = true;
    scalpel.sterile = false;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  } else if (target.mode === 'transfer_lc' && target.item && target.item.cultureCtrl) {
    const lc = target.item.cultureCtrl;
    const aseptic = scalpel.sterile && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item) && !!ctx.wearingGloves;
    if (aseptic) {
      lc.colonized = true;
      lc.contaminated = false;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🍄 Cultura Líquida inoculada com sucesso!');
    } else {
      lc.contaminated = true;
      lc.colonized = false;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Cultura Líquida contaminou por falta de assepsia (fluxo/luvas/lâmina estéril)!');
    }
    scalpel.hasMycelium = false;
    scalpel.biopsyAseptic = true;
    scalpel.sterile = false;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  } else if (target.mode === 'transfer' && target.item && target.item.spawnCtrl) {
    const spawn = target.item.spawnCtrl;
    const receivesMyceliumCut = target.item.meta && target.item.meta.compatibilities &&
      target.item.meta.compatibilities.receivesMyceliumCut;
    if (!receivesMyceliumCut || !spawn.filled || spawn.inoculated || spawn.burned || spawn.contaminated) {
      const reason = spawn.burned ? 'este recipiente foi queimado'
        : (spawn.contaminated ? 'este recipiente está contaminado'
          : (spawn.inoculated ? 'já foi inoculado' : 'não está pronto para receber micélio'));
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Não foi possível transferir: ' + reason + '.');
      return;
    }
    const isAseptic = isAsepticWorkArea(ctx, target.item);
    spawn.inoculated = true;
    if (!scalpel.sterile || !spawn.sterilized || (!isAseptic && Math.random() < 0.45)) {
      spawn.contaminated = true;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Contaminação na transferência! Use lâmina estéril, substrato esterilizado (1h20m) e Fluxo Laminar higienizado!');
    } else if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🍄 Micélio transferido com sucesso para ' + spawn.baseLabel + '!');
    }
    spawn.updateVisual();
    scalpel.hasMycelium = false;
    scalpel.sterile = false;
    updateScalpelLabel(ctx.heldItem);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  }
}

export function handleSubstrateTargetAction(ctx) {
  const target = ctx.hoveredGrainTarget;
  const kind = ctx.heldItem.id.indexOf('grain') !== -1 ? 'grain' : 'sawdust';
  if (target.bowlCtrl) {
    const receivesIngredients = target.meta && target.meta.compatibilities &&
      target.meta.compatibilities.receivesIngredients;
    if (!receivesIngredients) return;
    addIngredientToBowl(target, kind === 'grain' ? 'corn' : 'sawdust', 100);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌾 +100g no Pote de Mistura!');
    ctx.notifyWorldAction();
    return;
  }
  if (fillSpawnWithSubstrate(target, kind)) {
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌾 ' + target.label + ' preenchido!');
    ctx.notifyWorldAction();
  }
}
