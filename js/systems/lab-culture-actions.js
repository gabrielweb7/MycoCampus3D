import { normalizeCultureOrigin } from '../core/culture-origin.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { getBowlBulkReadiness, addIngredientToBowl, stirMixingBowl, updateMixingBowlLabel } from '../items/mixing-bowl.js';
import { markBladePackEmpty, updateScalpelLabel } from '../items/scalpel.js';
import { fillSpawnWithSubstrate, getSpawnContainerBaseLabel } from '../items/spawn-containers.js';
import { updateFalconCultureVisual } from '../items/falcon-tubes.js';
import { inoculatePetri, updatePetriVisual } from '../items/petri-dish.js';

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
    const bulkState = getBowlBulkReadiness(bowl);
    if (bulkState.isBulk && !bulkState.ready) {
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast('⚠️ Para substrato bulk: adicione Vermiculita + Pó de Coco + Água e misture com a colher antes!');
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
          ? '🥥 Substrato de Vermiculita + Pó de Coco + Água porcionado em ' + dstSc.baseLabel + '! Leve à Panela no modo PASTEURIZAR (Tecla M)!'
          : (isSawdust
            ? '🪵 Serragem hidratada porcionada em ' + dstSc.baseLabel + '! Pasteurize ou Esterilize na Panela para blocos gourmet!'
            : '🥣 Receita porcionada em ' + dstSc.baseLabel + '!'));
      }
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
  if (!target) return;
  if (scalpel.hasMycelium && ['cut', 'scrape_spores', 'biopsy'].includes(target.mode)) return;
  if (target.mode === 'blade') {
    if (target.item && target.item.bladePackCtrl && target.item.bladePackCtrl.empty) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Esta embalagem de lâmina já está vazia! Jogue no lixo.');
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
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('🔪 Lâmina estéril #24 encaixada! Jogue a embalagem vazia no lixo.');
    ctx.notifyWorldAction();
  } else if (target.mode === 'scrape_spores') {
    const petri = target.item && target.item.mesh.userData.petriCtrl;
    if (!scalpel.hasBlade) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Encaixe uma lâmina #24 no bisturi antes de raspar um ponto de esporos.');
      return;
    }
    if (!isAsepticWorkArea(ctx, target.item)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Colete o ponto de esporos apenas dentro do Fluxo Laminar ligado e higienizado.');
      return;
    }
    if (!scalpel.sterile || scalpel.bladeExpired || scalpel.bladeContaminated) {
      ctx.callbacks.onToast?.('🔪 Use uma lâmina estéril para coletar um monoesporo.');
      return;
    }
    if (!petri || !petri.lidOpen || petri.mode !== 'spore_print') {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Abra a placa com Carimbo de Esporos dentro do Fluxo Laminar.');
      return;
    }
    if (petri.expired || petri.sporeContaminated || petri.contaminated) {
      ctx.callbacks.onToast?.('⚠️ Use um carimbo viável e sem contaminação.');
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
      ctx.callbacks.onToast(`🔪 Monoesporo de ${spName} coletado. Transfira para um meio sólido estéril ou caldo nutritivo estéril para germinar.`);
    }
    ctx.notifyWorldAction();
  } else if (target.mode === 'cut') {
    const petri = target.item && target.item.mesh.userData.petriCtrl;
    const spawn = target.item && target.item.spawnCtrl;
    const slantCult = target.item && target.item.pdaMediumCtrl && target.item.pdaMediumCtrl.isSlant && target.item.cultureCtrl;
    if (!scalpel.hasBlade) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Encaixe uma lâmina #24 no bisturi antes de coletar micélio.');
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
    if (slantCult && (!slantCult.colonized || slantCult.contaminated || slantCult.expired)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este Slant não possui micélio viável para repique.');
      return;
    }
    if (spawn && (spawn.burned || spawn.contaminated || spawn.expired || spawn.colonization < 60)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ O micélio deste recipiente não está viável para transferência.');
      return;
    }
    if (spawn && spawn.isPP5 && !spawn.lidOpen) {
      ctx.callbacks.onToast?.('🥣 Use a opção numerada Abrir potinho no alvo antes de cortar.');
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
        ? '🦠 Você mudou de genética com a mesma lâmina! A amostra e a cultura contaminaram.'
        : (usedContamBlade
          ? '🦠 Lâmina contaminada! Você contaminou esta cultura e coletou um fragmento contaminado.'
          : '🔪 Fragmento de micélio coletado! Transfira para uma placa estéril, cultura líquida ou potinho/spawn.'));
    }
    ctx.notifyWorldAction();
  } else if (target.mode === 'biopsy' && target.item && target.item.wildMushroomCtrl) {
    if (!scalpel.hasBlade) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Encaixe uma lâmina #24 no bisturi antes de cortar o cogumelo.');
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
        ? '🦠 Você usou a mesma lâmina em outra genética! Lâmina contaminada.'
        : (scalpel.biopsyAseptic
          ? `🔪 Tecido de ${wm.speciesName} coletado para clonagem. Transfira para um meio estéril.`
          : `🔪 Amostra de ${wm.speciesName} coletada (⚠️ risco de contaminação sem fluxo/luvas/lâmina estéril!).`));
    }
    ctx.notifyWorldAction();
  } else if (target.mode === 'open') {
    ctx.callbacks.onToast?.('🧫 Use a opção numerada para abrir a tampa no alvo.');
  } else if (target.mode === 'transfer' && target.item && target.item.mesh.userData.petriCtrl) {
    const petri = target.item.mesh.userData.petriCtrl;
    const receivesMyceliumCut = target.item.meta && target.item.meta.compatibilities &&
      target.item.meta.compatibilities.receivesMyceliumCut;
    if (!receivesMyceliumCut || !petri.lidOpen || petri.mode !== 'empty' || !petri.sterilized) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ A placa de destino precisa estar estéril, aberta e dentro da área asséptica.');
      return;
    }
    const sterileTransfer = scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item);
    let contamRisk = 0;
    if (!(ctx.wearingGloves && !ctx.glovesExpired)) contamRisk += 0.25;
    if (!((target.item.sanitizedUntil || 0) > performance.now())) contamRisk += 0.15;
    if (!((ctx.heldItem.sanitizedUntil || 0) > performance.now())) contamRisk += 0.15;
    if (scalpel.isSporeSample && !sterileTransfer) {
      ctx.callbacks.onToast?.('🌱 Para germinar o monoesporo, use uma placa estéril no Fluxo Laminar preparado.');
      return;
    }
    const inocMethod = scalpel.isSporeSample ? 'spores' : 'mycelium';
    const nextGen = scalpel.isSporeSample ? 0 : Math.min(3, Math.max(1, scalpel.cutGeneration || 1));
    if (!inoculatePetri(target.item, inocMethod, sterileTransfer, contamRisk, scalpel.biopsySpecies, nextGen, scalpel.origin)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Não foi possível transferir para esta placa.');
      return;
    }
    if (ctx.callbacks.onToast) ctx.callbacks.onToast(sterileTransfer
      ? (scalpel.isSporeSample
        ? '🌱 Monoesporo transferido para o ágar. Aguarde a germinação.'
        : (scalpel.origin === 'tissue_clone' ? '🧬 Tecido ou micélio clonal transferido. Aguarde a colonização.' : '🍄 Fragmento transferido. Aguarde a colonização.'))
      : '🦠 A transferência contaminou a placa; higienize o Fluxo Laminar, use luvas e lâmina estéril.');
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
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Para cruzar cepas, abra uma Placa colonizada saudável no Fluxo Laminar.');
      return;
    }
    if (!aseptic) {
      petri.mode = 'contam';
      petri.contaminated = true;
      petri.colonized = false;
      updatePetriVisual(target.item);
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Cruzamento falhou e contaminou! Use Fluxo Laminar higienizado, luvas e lâmina estéril.');
    } else {
      const isGold = ((petri.speciesName || '').length + (scalpel.biopsySpecies || '').length) % 2 === 0;
      petri.hybridMutant = isGold ? 'gold' : 'albino';
      petri.generation = 3;
      petri.origin = 'hybrid';
      const baseName = (petri.speciesName || 'Psilocybe cubensis').replace(/\s*•\s*(?:🌟|✨).*$/, '').trim();
      const variantTag = isGold ? '🌟 Linhagem Dourada F1' : '✨ Albino Híbrido F1';
      petri.speciesName = `${baseName} • ${variantTag}`;
      updatePetriVisual(target.item);
      if (window.MycoAudio && window.MycoAudio.playQuestComplete) window.MycoAudio.playQuestComplete();
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(`🧬✨ SUCESSO! Cruzamento gerou cepa rara "${petri.speciesName}" (F1)!`);
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
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Esterilize o Tubo Slant na panela (ou verta PDA estéril no Fluxo Laminar) antes de inocular!');
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
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧪✨ Micélio transferido para o Tubo Slant 15ml! Quando colonizar, guarde na Geladeira 4°C (cultura-mãe).');
    } else {
      sl.colonization = 0;
      sl.contaminated = true;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 O Tubo Slant contaminou por falta de assepsia (Fluxo Laminar/luvas/lâmina estéril)!');
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
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este frasco tem apenas água pura! Adicione 🍯 Extrato de Malte / Mel (4%) e esterilize na panela antes de inocular.');
      return;
    }
    const lcLiq = target.item.mesh && target.item.mesh.userData && target.item.mesh.userData.liquidCtrl;
    const lcSterile = !!(lc.sterilized || target.item.sterilized || (lcLiq && lcLiq.sterilized));
    const aseptic = lcSterile && scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && isAsepticWorkArea(ctx, target.item) && !!(ctx.wearingGloves && !ctx.glovesExpired);
    if (scalpel.isSporeSample && (!lcSterile || !aseptic)) {
      ctx.callbacks.onToast?.('🧪 Para germinar o monoesporo, use caldo estéril e trabalhe no Fluxo Laminar preparado.');
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
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(scalpel.isSporeSample ? '🌱 Monoesporo inoculado no caldo estéril. Aguarde germinar e colonizar.' : '🍄 Fragmento inserido na cultura líquida. Aguarde colonizar.');
    } else {
      lc.colonization = 0;
      lc.contaminated = true;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(!lcSterile
        ? '🦠 O caldo nutritivo não estava esterilizado na autoclave e contaminou!'
        : '🦠 Cultura Líquida contaminou por falta de assepsia (fluxo/luvas/lâmina estéril)!');
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
      const reason = spawn.burned ? 'este recipiente foi queimado'
        : (spawn.contaminated ? 'este recipiente está contaminado'
          : (spawn.inoculated ? 'já foi inoculado' : 'não está pronto para receber micélio'));
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Não foi possível transferir: ' + reason + '.');
      return;
    }
    const isAseptic = isAsepticWorkArea(ctx, target.item);
    if (spawn.isPP5 && !spawn.lidOpen) {
      ctx.callbacks.onToast?.('🥣 Abra a tampa do PP5 pela opção numerada antes de transferir.');
      return;
    }
    if (scalpel.isSporeSample && (!spawn.sterilized || !isAseptic || !scalpel.biopsyAseptic)) {
      ctx.callbacks.onToast?.('🌱 Para germinar o monoesporo, use substrato estéril no Fluxo Laminar preparado.');
      return;
    }
    spawn.origin = normalizeCultureOrigin(scalpel.origin);
    spawn.inoculated = true;
    spawn.generation = scalpel.isSporeSample ? 0 : Math.min(3, Math.max(1, scalpel.cutGeneration || 1));
    if (scalpel.biopsySpecies) spawn.speciesName = scalpel.biopsySpecies;
    const okTransfer = scalpel.sterile && !scalpel.cutContaminated && (scalpel.biopsyAseptic !== false) && spawn.sterilized && (isAseptic || Math.random() >= 0.45);
    if (!okTransfer) {
      spawn.contaminated = true;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Contaminação na transferência! Use lâmina estéril, substrato esterilizado (1h20m) e Fluxo Laminar higienizado!');
    } else if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🍄 Micélio transferido com sucesso para ' + spawn.baseLabel + '!');
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
      ctx.callbacks.onToast(`🌱 Monoesporo germinando em ${spawn.baseLabel}!`);
    }
    ctx.notifyWorldAction();
  }
}

export function handleSubstrateTargetAction(ctx) {
  const target = ctx.hoveredGrainTarget;
  const heldId = (ctx.heldItem && ctx.heldItem.id) || '';
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
      const lbl = isVerm ? 'Vermiculita' : (isSawdust ? 'Serragem de Eucalipto' : (isCoco ? 'Pó de Coco' : (isSorghum ? 'Sorgo Vermelho' : (isWheat ? 'Trigo em Grão' : 'Milho de Pipoca'))));
      ctx.callbacks.onToast(`🥣 +100g de ${lbl} no Pote de Mistura!`);
    }
    ctx.notifyWorldAction();
    return;
  }
  if (isVerm || isCoco || isSawdust) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(isSawdust
        ? '🪵 Misture Serragem de Eucalipto + Água no Pote de Mistura e mexa com a Colher antes de pôr na Bag!'
        : '🥥 Misture Vermiculita + Pó de Coco + Água no Pote de Mistura e mexa com a Colher antes de colocar na Bag!');
    }
    return;
  }
  if (fillSpawnWithSubstrate(target, kind)) {
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🌾 ' + target.label + ' preenchido! Hidrate na pia ou com água destilada antes de esterilizar.');
    }
    ctx.notifyWorldAction();
  }
}
