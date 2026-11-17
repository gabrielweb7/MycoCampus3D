/**
 * Sistema de Interacoes de Itens e Mao (MycoCampus3D)
 * Coordenacao de pegar/soltar objetos, inoculacao, panela de pressao, borrifador,
 * termometro laser, lousa e delegacao de interacoes fixas do mundo e raycasting.
 */

import { getHeldBoardToolColor, drawBoardSegment } from './chalkboard.js';
import { getItemGroundHeight } from '../engine/physics.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';
import {
  findPlacementTarget,
  isPlacementBlocked,
  getPlacementBlockedReason,
  updatePlacementGhostVisual
} from '../entities/placement-ghost.js';
import {
  cancelHeldItemPlacement,
  commitHeldItemPlacement,
  setHeldTwoHandedGhost
} from './held-item-placement.js';
import { handleWorldInteraction, isSeatOccupied } from './world-interactions.js';
import { updateHoverRay, firstValidRayHit } from './hover-raycaster.js';
import { canFillFromSink, canSealSpawnBag, canSyringeSource, canSyringeTarget, hasPdaContents } from '../items/item-registry.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { fireAlcoholSpray } from '../items/alcohol-spray.js';
import { wipeWithPaperTowel } from '../items/paper-towel.js';
import { handleTrashDisposal } from '../items/lab-trash.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { fillPetriWithPda, togglePetriLid, setPetriLidOpen, sealPetriWithParafilm } from '../items/petri-dish.js';
import { toggleCultureFridgeDoor, isPartOfFridgeDoor, isCultureFridgeOccupied } from '../items/culture-fridge.js';
import { preparePP5ForPda } from '../items/pp5-cup.js';
import { addIngredientToBowl } from '../items/mixing-bowl.js';
import {
  handleFlocaoTargetAction,
  handleMixingBowlTargetAction,
  handleScalpelTargetAction,
  handleSubstrateTargetAction
} from './lab-culture-actions.js';
import {
  addPdaPowder,
  isPdaRecipeBalanced,
  markPdaVolumeChanged,
  PDA_GRAMS_PER_LITER,
  PDA_POWDER_DOSE_GRAMS,
  transferPdaGrams,
  updatePdaMediumVisual
} from '../items/pda-mix.js';

const THREE = window.THREE;
const _vZero2 = new THREE.Vector2(0, 0);

export { setHeldTwoHandedGhost, updateHoverRay, firstValidRayHit, isSeatOccupied };

export function setMeshGhostOpacity(root, active) {
  if (!root) return;
  root.traverse(function (ch) {
    if (!ch.isMesh || !ch.material) return;
    const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
    mats.forEach(function (m) {
      if (active) {
        if (!m.userData._origHeld) {
          m.userData._origHeld = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
        }
        m.transparent = true;
        m.opacity = 0.14;
        m.depthWrite = false;
      } else if (m.userData._origHeld) {
        m.transparent = m.userData._origHeld.transparent;
        m.opacity = m.userData._origHeld.opacity;
        m.depthWrite = m.userData._origHeld.depthWrite;
      }
    });
  });
}

export function dropHeldItem(ctx) {
  if (!ctx.heldItem) return;
  ctx.syringePumping = null;
  ctx.syringePunctureProgress = 0;
  ctx.lastSyringeTargetItem = null;
  if (!ctx.placementMode) ctx.heldRotY = ctx.playerYaw || 0;

  const candPt = new THREE.Vector3();
  const baseYaw = ctx.playerYaw || 0;
  const radii = [0.75, 1.15, 1.55, 0.45];
  const angleOffsets = [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4, Math.PI];
  let chosenPt = null;

  for (let ri = 0; ri < radii.length && !chosenPt; ri++) {
    const r = radii[ri];
    for (let ai = 0; ai < angleOffsets.length; ai++) {
      const a = baseYaw + angleOffsets[ai];
      const cx = ctx.playerPos.x - Math.sin(a) * r;
      const cz = ctx.playerPos.z - Math.cos(a) * r;
      const cy = getItemGroundHeight(
        ctx.physCtx,
        cx,
        cz,
        ctx.playerPos.y + 0.9,
        ctx.heldItem.fridgeCtrl ? 'fridge' : ctx.heldItem.mesh.userData.dynamicSurface,
        ctx.playerPos.y + 1.25
      );
      candPt.set(cx, cy, cz);
      if (!isPlacementBlocked(ctx.entityCtx, candPt)) {
        chosenPt = candPt;
        break;
      }
    }
  }

  if (!chosenPt) {
    const rayNdc = ctx.inFps ? _vZero2 : ctx.pointerNdc;
    const pt = findPlacementTarget(ctx.entityCtx, rayNdc);
    if (!isPlacementBlocked(ctx.entityCtx, pt)) chosenPt = pt;
  }

  if (!chosenPt) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(getPlacementBlockedReason() || '🚫 Sem espaço livre ao redor para soltar o item!');
    }
    return;
  }
  const droppedLabel = ctx.heldItem ? ctx.heldItem.label : 'Item';
  commitHeldItemPlacement(ctx, chosenPt, false);
  if (ctx.callbacks.onToast) {
    ctx.callbacks.onToast('📦 ' + droppedLabel + ' solto.');
  }
}

export function handlePrimaryAction(ctx) {
  if (ctx.heldItem) {
    if (performance.now() - ctx.lastPickupAt < 140) return;
    if (ctx.hoveredPdaTarget) {
      const target = ctx.hoveredPdaTarget;
      if (ctx.heldItem.pdaReagentCtrl) {
        const result = addPdaPowder(ctx.heldItem, target);
        if (result.ok) {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧪 +' + PDA_POWDER_DOSE_GRAMS + 'g de PDA/BDA no béquer.');
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
          ctx.notifyWorldAction();
        } else if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('⚠️ ' + result.reason);
        }
        return;
      }

      const sourceLiquid = ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl;
      const targetLiquid = target.mesh && target.mesh.userData.liquidCtrl;
      const medium = target.pdaMediumCtrl;
      const sourceHasPda = hasPdaContents(ctx.heldItem);
      const canPourWater = ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.poursWater && !sourceHasPda;
      const targetCanReceivePdaWater = target.meta && target.meta.compatibilities &&
        target.meta.compatibilities.receivesPdaWater;
      if (sourceLiquid && targetLiquid && medium && canPourWater && targetCanReceivePdaWater) {
        if (medium.burned || medium.sterilized) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este meio já foi processado; use um béquer limpo.');
          return;
        }
        if (medium.powderGrams <= 0) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Adicione o pó PDA/BDA antes da água.');
          return;
        }
        const expectedMl = medium.powderGrams * 1000 / PDA_GRAMS_PER_LITER;
        const addMl = Math.min(sourceLiquid.volMl, targetLiquid.maxMl - targetLiquid.volMl, expectedMl - targetLiquid.volMl);
        if (addMl <= 0) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ A proporção já está completa; ajuste a quantidade de pó para preparar mais meio.');
          return;
        }
        updateContainerVolume(ctx.heldItem, sourceLiquid.volMl - addMl);
        updateContainerVolume(target, targetLiquid.volMl + addMl);
        markPdaVolumeChanged(target);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('💧 +' + addMl + 'ml de água. Proporção: 40g/L.');
        ctx.notifyWorldAction();
        return;
      }
    }
    if (ctx.hoveredBoardHit && getHeldBoardToolColor(ctx.heldItem)) {
      const boardToolCol = getHeldBoardToolColor(ctx.heldItem);
      const brd = ctx.chalkboards[ctx.hoveredBoardIndex];
      if (boardToolCol && brd && ctx.hoveredBoardHit.uv) {
        const tapPx = Math.round(ctx.hoveredBoardHit.uv.x * 512 * 10) / 10;
        const tapPy = Math.round((1 - ctx.hoveredBoardHit.uv.y) * 256 * 10) / 10;
        const tapPt = [tapPx, tapPy];
        drawBoardSegment(brd.ctx, boardToolCol, tapPt, tapPt);
        brd.tex.needsUpdate = true;
        ctx.pendingBoardStrokes.push({
          b: ctx.hoveredBoardIndex,
          c: boardToolCol,
          pts: [tapPt, [tapPt[0] + 0.1, tapPt[1]]]
        });
      }
      return;
    }
    if (ctx.hoveredPotInsert && ctx.heldItem && !ctx.heldItem.mesh.userData.twoHanded) {
      const cp = ctx.hoveredPotInsert;
      const isBase = !!(ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isCookerBase);
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      if (!isBase && !hasBase) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('⚠️ Encaixe primeiro a Base Perfurada (4cm) no fundo da panela para os recipientes não boiarem!');
        }
        return;
      }
      if (isBase && hasBase) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('⚠️ Esta panela já possui uma Base Perfurada encaixada.');
        }
        return;
      }
      if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isPetri) {
        setPetriLidOpen(ctx.heldItem, false, true);
      }
      const potP = cp.potItem.mesh.position;
      if (isBase) {
        cp.hasBase = true;
        ctx.heldItem.mesh.position.set(potP.x, potP.y + 0.036, potP.z);
        ctx.heldItem.mesh.rotation.set(0, cp.potItem.mesh.rotation.y, 0);
      } else {
        const nonBaseCount = cp.contents.filter((it) => it && (!it.mesh || !it.mesh.userData.isCookerBase)).length;
        const ox = (nonBaseCount % 2 === 0 ? -0.065 : 0.065);
        const oz = (nonBaseCount < 2 ? -0.055 : 0.055);
        ctx.heldItem.mesh.position.set(potP.x + ox, potP.y + 0.080, potP.z + oz);
        ctx.heldItem.mesh.rotation.set(0, ctx.heldRotY, 0);
      }
      ctx.heldItem.isMoved = true;
      if (cp.contents.indexOf(ctx.heldItem) === -1) cp.contents.push(ctx.heldItem);
      ctx.pendingMovedItems[ctx.heldItem.id] = {
        id: ctx.heldItem.id, x: ctx.heldItem.mesh.position.x, y: ctx.heldItem.mesh.position.y, z: ctx.heldItem.mesh.position.z, ry: ctx.heldItem.mesh.rotation.y
      };
      ctx.recentlyDropped[ctx.heldItem.id] = performance.now() + 15000;
      if (ctx.heldItem.lidItem && ctx.heldItem.lidItem.isAttached) {
        ctx.recentlyDropped[ctx.heldItem.lidItem.id] = performance.now() + 15000;
      }
      cancelHeldItemPlacement(ctx);
      ctx.heldItem = null;
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
      if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('cooker_heat');
      ctx.notifyWorldAction();
      return;
    }
    if (ctx.heldItem.mesh.userData.isAlcoholSpray && !ctx.placementMode) {
      fireAlcoholSpray(ctx, ctx.hoveredSprayTarget);
      if (ctx.hoveredGreenhouseSlot) {
        ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
      }
      return;
    }
    if (ctx.heldItem.mesh.userData.isPaperTowel && !ctx.placementMode && ctx.hoveredWipeTarget) {
      wipeWithPaperTowel(ctx, ctx.hoveredWipeTarget);
      return;
    }
    if (ctx.hoveredParafilmTarget && !ctx.placementMode && ctx.heldItem.id && ctx.heldItem.id.indexOf('parafilm_') === 0) {
      const target = ctx.hoveredParafilmTarget;
      const pc = target.mesh && target.mesh.userData && target.mesh.userData.petriCtrl;
      if (pc && pc.lidOpen) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Feche a tampa da Placa de Petri antes de vedar com Parafilm M.');
      } else if (pc && pc.parafilmSealed) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('✅ Esta Placa de Petri já está vedada com Parafilm M.');
      } else if (pc && pc.mode === 'bare') {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧫 Adicione PDA/BDA e esterilize a placa antes de vedar.');
      } else if (sealPetriWithParafilm(target)) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🎞️ Placa de Petri vedada com Parafilm M! Protegida contra contaminação externa.');
        ctx.notifyWorldAction();
      }
      return;
    }
    if (ctx.hoveredTrash && !ctx.placementMode) {
      handleTrashDisposal(ctx, ctx.heldItem);
      return;
    }
    if (ctx.hoveredHeatSealerTarget && (
        (ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.sealsBags) ||
        (ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.isBag))) {
      const target = ctx.hoveredHeatSealerTarget;
      if (canSealSpawnBag(target)) {
        target.spawnCtrl.sealed = true;
        target.spawnCtrl.updateVisual();
        if (target === ctx.heldItem && ctx.callbacks.onHoldChange) {
          ctx.callbacks.onHoldChange(ctx.heldItem.label);
        }
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('♨️ Bag selado! Leve-o à panela para esterilizar antes de inocular.');
        ctx.notifyWorldAction();
      } else if (ctx.callbacks.onToast) {
        const sc = target.spawnCtrl;
        const reason = !sc.filled ? 'preencha o bag com substrato primeiro'
          : (sc.sealed ? 'este bag já está selado'
            : (sc.sterilized || sc.inoculated ? 'este bag já foi processado; sele apenas antes da esterilização'
              : (sc.burned ? 'este bag foi queimado' : 'este bag está contaminado')));
        ctx.callbacks.onToast('⚠️ Não foi possível selar: ' + reason + '.');
      }
      return;
    }
    if (ctx.hoveredSyringeTarget && ctx.heldItem.mesh.userData.isSyringe &&
        ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.transfersLiquidCulture) {
      const syrCtrl = ctx.heldItem.mesh.userData.syrCtrl;
      const tgt = ctx.hoveredSyringeTarget;
      if (ctx.syringePumping) return;
      if (tgt.mode === 'open' && tgt.item && tgt.item.mesh.userData.isPetri) {
        togglePetriLid(ctx, tgt.item);
        return;
      }
      if (tgt.mode === 'draw' && !canSyringeSource(tgt.item)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Só é possível aspirar uma cultura líquida colonizada e dentro da validade.');
        return;
      }
      if (tgt.mode === 'inject' && !canSyringeTarget(tgt.item)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente não está preparado para receber cultura pela seringa.');
        return;
      }
      const fromVol = syrCtrl.volMl;
      const isPetriInjection = tgt.mode === 'inject' && tgt.item && tgt.item.mesh.userData.isPetri;
      if (isPetriInjection && fromVol < 1) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ A seringa precisa conter pelo menos 1ml para inocular a placa.');
        return;
      }
      const sourceVol = tgt.mode === 'draw' && tgt.item && tgt.item.mesh.userData.liquidCtrl
        ? tgt.item.mesh.userData.liquidCtrl.volMl
        : 0;
      const toVol = tgt.mode === 'draw'
        ? Math.min(10, fromVol + sourceVol)
        : (isPetriInjection ? fromVol - 1 : 0);
      if (Math.abs(toVol - fromVol) < 0.01) return;

      const isHoldLiquidPump = !!(tgt.mode === 'draw' || (tgt.item && tgt.item.mesh && tgt.item.mesh.userData.liquidCtrl && !tgt.item.spawnCtrl));
      ctx.syringePumping = {
        target: tgt,
        fromVol: fromVol,
        toVol: toVol,
        amountMl: isPetriInjection ? 1 : 0,
        holdMode: isHoldLiquidPump,
        duration: isHoldLiquidPump ? Math.max(0.5, Math.abs(toVol - fromVol) / 4.5) : 2.0,
        elapsed: 0,
        startJarVol: (tgt.item && tgt.item.mesh && tgt.item.mesh.userData.liquidCtrl) ? tgt.item.mesh.userData.liquidCtrl.volMl : 0
      };
      return;
    }
    if (ctx.hoveredSink) {
      const medium = ctx.heldItem.pdaMediumCtrl;
      const isPotHeld = ctx.cookerPots.some((cp) => cp.potItem === ctx.heldItem && !cp.lidItem.isAttached);
      if (hasPdaContents(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente já contém ou processou meio PDA/BDA; use um recipiente limpo.');
        return;
      }
      if (!isPotHeld && !canFillFromSink(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente não pode ser preenchido pela pia.');
        return;
      }
      let filledSomething = false;
      if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
        const lc = ctx.heldItem.mesh.userData.liquidCtrl;
        if (lc.volMl < lc.maxMl) {
          updateContainerVolume(ctx.heldItem, Math.min(lc.maxMl, lc.volMl + 35));
          if (medium) markPdaVolumeChanged(ctx.heldItem);
          filledSomething = true;
        }
      } else {
        for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
          const cp = ctx.cookerPots[cpi];
          if (cp.potItem === ctx.heldItem && cp.waterMl < cp.maxWaterMl) {
            cp.waterMl = Math.min(cp.maxWaterMl, cp.waterMl + 100);
            updateCookerWaterVisual(cp);
            filledSomething = true;
            break;
          }
        }
      }
      if (filledSomething) {
        ctx.sinkFilling = { sink: ctx.hoveredSink, item: ctx.heldItem, carryMl: 0, addedAny: true };
        triggerSinkStream(ctx.hoveredSink, 500);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        ctx.notifyWorldAction();
      } else if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast('💧 Recipiente já está cheio!');
      }
      return;
    }
    if (ctx.hoveredFillPot && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
      const sourceCanPourWater = ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.poursWater;
      if (!sourceCanPourWater || hasPdaContents(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ A panela recebe água, não cultura líquida ou meio PDA/BDA.');
        return;
      }
      const srcLc = ctx.heldItem.mesh.userData.liquidCtrl;
      const cp = ctx.hoveredFillPot;
      if (srcLc.volMl > 0 && cp.waterMl < cp.maxWaterMl) {
        ctx.pourHold = { kind: 'pot', src: ctx.heldItem, dst: cp, carry: 0, any: false, soundAt: 0, dropAt: 0 };
        if (window.MycoAudio) window.MycoAudio.playSpray();
      }
      return;
    }
    if (ctx.hoveredPourTarget && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
      const srcLc = ctx.heldItem.mesh.userData.liquidCtrl;
      const dstItem = ctx.hoveredPourTarget;
      const dstLc = dstItem.mesh && dstItem.mesh.userData.liquidCtrl;
      const srcPda = ctx.heldItem.pdaMediumCtrl;
      const sourceHasPda = hasPdaContents(ctx.heldItem);
      const sourceCanPourWater = ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.poursWater;
      if (!sourceHasPda && !sourceCanPourWater) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente não pode despejar água ou solução.');
        return;
      }
      const dstPetri = dstItem.mesh && dstItem.mesh.userData.petriCtrl;
      const petriAcceptsPda = !!(dstItem.meta && dstItem.meta.compatibilities &&
        dstItem.meta.compatibilities.acceptsPdaMedium);
      if (sourceHasPda && petriAcceptsPda && dstPetri && dstPetri.mode === 'bare') {
        if (!dstPetri.lidOpen) {
          togglePetriLid(ctx, dstItem);
          return;
        }
        if (!isAsepticWorkArea(ctx, dstItem)) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ O Fluxo Laminar precisa estar ligado e higienizado para despejar PDA na placa.');
          return;
        }
        if (srcLc.volMl < 20) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ São necessários 20ml de meio preparado para preencher uma placa de Petri.');
          return;
        }
        if (srcPda.burned || srcPda.sterilized || !srcPda.mixed ||
            !isPdaRecipeBalanced(srcPda, srcLc.volMl)) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Misture o meio PDA/BDA na proporção de 40g/L antes de preencher a placa.');
          return;
        }
        const pourAmt = 20;
        const sourceVolumeMl = srcLc.volMl;
        const transferredGrams = srcPda.powderGrams * pourAmt / sourceVolumeMl;
        srcPda.powderGrams = Math.max(0, srcPda.powderGrams - transferredGrams);
        updateContainerVolume(ctx.heldItem, sourceVolumeMl - pourAmt);
        updatePdaMediumVisual(ctx.heldItem);
        fillPetriWithPda(dstItem);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧫 ' + pourAmt + 'ml de meio PDA/BDA colocados na placa. Leve para esterilizar.');
        ctx.notifyWorldAction();
        return;
      }
      if (dstItem.spawnCtrl && dstItem.spawnCtrl.isPP5 && !sourceHasPda) {
        const spawn = dstItem.spawnCtrl;
        const receivesWater = dstItem.meta && dstItem.meta.compatibilities &&
          dstItem.meta.compatibilities.receivesWater;
        if (!receivesWater || !spawn.filled || spawn.substrateKind === 'pda' || spawn.waterMl >= 35) return;
        if (srcLc.volMl > 0) {
          ctx.pourHold = { kind: 'pp5', src: ctx.heldItem, dst: dstItem, carry: 0, any: false, soundAt: 0, dropAt: 0 };
          if (window.MycoAudio) window.MycoAudio.playSpray();
        }
        return;
      }
      if (dstLc) {
        if (sourceHasPda) {
          const dstPda = dstItem.pdaMediumCtrl;
          if (srcPda.burned || srcPda.sterilized || !srcPda.mixed || !isPdaRecipeBalanced(srcPda, srcLc.volMl)) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Misture o meio PDA/BDA na proporção de 40g/L antes de transferir.');
            return;
          }
          const canReceivePda = !!(dstPda && (
            dstItem.meta && dstItem.meta.compatibilities &&
            dstItem.meta.compatibilities.acceptsPdaMedium &&
            (dstPda.kind === 'media_bottle' ||
              (dstPda.kind === 'falcon' && dstPda.isSlant) ||
              (dstPda.kind === 'pp5' && dstItem.spawnCtrl && dstItem.spawnCtrl.isPP5 && !dstItem.spawnCtrl.filled))
          ));
          if (!canReceivePda) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Transfira o meio para um Falcon slant, frasco de 1L ou PP5 vazio.');
            return;
          }
          if (dstPda.burned || dstPda.sterilized) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Use um recipiente limpo que ainda não foi processado.');
            return;
          }
          if (dstLc.volMl > 0 && dstPda.powderGrams <= 0) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Use um tubo vazio para preparar o slant.');
            return;
          }
          const stepAmt = dstLc.maxMl <= 15 ? 15 : 250;
          const pourAmt = Math.min(srcLc.volMl, stepAmt, dstLc.maxMl - dstLc.volMl);
          if (pourAmt > 0) {
            const sourceVolMl = srcLc.volMl;
            updateContainerVolume(ctx.heldItem, sourceVolMl - pourAmt);
            updateContainerVolume(dstItem, dstLc.volMl + pourAmt);
            transferPdaGrams(ctx.heldItem, dstItem, pourAmt, sourceVolMl);
            if (dstPda.kind === 'pp5') {
              preparePP5ForPda(dstItem);
              updatePdaMediumVisual(dstItem);
            }
            if (window.MycoAudio) window.MycoAudio.playSpray();
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧪 Meio transferido para ' + dstItem.label + '. Leve à panela para esterilizar.');
            ctx.notifyWorldAction();
          }
          return;
        }

        const receivesWater = dstItem.meta && dstItem.meta.compatibilities &&
          dstItem.meta.compatibilities.receivesWater;
        if (!receivesWater) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente não pode receber água por transferência.');
          return;
        }
        const destinationHasPda = hasPdaContents(dstItem);
        if (destinationHasPda && !sourceHasPda) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Não dilua um meio PDA/BDA em preparo; use água no próprio béquer ou transfira outro meio preparado.');
          return;
        }

        if (srcLc.volMl > 0 && dstLc.volMl < dstLc.maxMl) {
          ctx.pourHold = { kind: 'lc', src: ctx.heldItem, dst: dstItem, carry: 0, any: false, soundAt: 0, dropAt: 0 };
          if (window.MycoAudio) window.MycoAudio.playSpray();
        }
      } else if (dstItem.bowlCtrl) {
        const receivesWater = dstItem.meta && dstItem.meta.compatibilities &&
          dstItem.meta.compatibilities.receivesWater;
        if (!receivesWater) return;
        if (hasPdaContents(ctx.heldItem)) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Meio PDA/BDA não pode ser adicionado como água da receita; use água limpa.');
          return;
        }
        const pourAmt = Math.min(srcLc.volMl, 50);
        if (pourAmt > 0) {
          updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
          addIngredientToBowl(dstItem, 'water', pourAmt);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('💧 +' + pourAmt + 'g água no Pote de Mistura!');
          ctx.notifyWorldAction();
        }
      }
      return;
    }
    if (ctx.hoveredFlocaoTarget && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isFlocao &&
        ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.fillsPP5WithFlocao) {
      handleFlocaoTargetAction(ctx);
      return;
    }
    if (ctx.hoveredBowlTarget) {
      if (handleMixingBowlTargetAction(ctx)) return;
    }
    if (ctx.hoveredScalpelTarget && ctx.heldItem.scalpelCtrl &&
        ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.transfersMycelium) {
      handleScalpelTargetAction(ctx);
      return;
    }
    if (ctx.hoveredGrainTarget && ctx.heldItem.id.indexOf('substrate_') === 0) {
      handleSubstrateTargetAction(ctx);
      return;
    }
    if (ctx.hoveredFridgeTarget && ctx.heldItem) {
      const fridgeTarget = ctx.hoveredFridgeTarget;
      if (!fridgeTarget.fridge.fridgeCtrl.doorOpen) {
        toggleCultureFridgeDoor(fridgeTarget.fridge);
        ctx.queueWorldStateChange(fridgeTarget.fridge.id, fridgeTarget.fridge.fridgeCtrl.doorOpen ? 1 : 0);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧊 Geladeira aberta. Clique novamente para guardar o item.');
        return;
      }
      if (!fridgeTarget.slotPosition) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧊 Não há espaço livre nas prateleiras da geladeira.');
        return;
      }
      if (fridgeTarget.lidOpen) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Feche a placa antes de guardá-la na geladeira.');
        return;
      }
      commitHeldItemPlacement(ctx, fridgeTarget.slotPosition, false);
      ctx.queueWorldStateChange(fridgeTarget.fridge.id, fridgeTarget.fridge.fridgeCtrl.doorOpen ? 1 : 0);
      return;
    }
    if (ctx.placementMode && ctx.placementValid && ctx.placementGhost) {
      if (isPlacementBlocked(ctx.entityCtx, ctx.placementGhost.position)) {
        ctx.placementValid = false;
        updatePlacementGhostVisual(ctx.heldItem, false, ctx.heldRotY, ctx.clock.elapsedTime);
        return;
      }
      commitHeldItemPlacement(ctx, ctx.placementGhost.position, true);
      return;
    }
    if (!ctx.placementMode) {
      if (handleWorldInteraction(ctx)) return;
      if (ctx.hoveredPickable && ctx.hoveredPickable.fridgeCtrl) {
        toggleCultureFridgeDoor(ctx.hoveredPickable);
        ctx.queueWorldStateChange(ctx.hoveredPickable.id, ctx.hoveredPickable.fridgeCtrl.doorOpen ? 1 : 0);
        if (window.MycoAudio) window.MycoAudio.playDoor(ctx.hoveredPickable.fridgeCtrl.doorOpen);
        return;
      }
      if (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer) {
        ctx.thermoLaserOn = !ctx.thermoLaserOn;
        if (window.MycoAudio && window.MycoAudio.playLaserBeep) {
          window.MycoAudio.playLaserBeep();
        }
        drawThermoScreen(ctx.thermoCurrentTemp, ctx.thermoLaserOn ? 'SCAN' : 'HOLD', true);
        return;
      }
      if (ctx.heldItem && ctx.heldItem.mesh.userData.isPetri) {
        togglePetriLid(ctx, ctx.heldItem);
        return;
      }
      if (ctx.heldItem && ctx.heldItem.id && ctx.heldItem.id.indexOf('gloves_box_') === 0) {
        ctx.wearingGloves = !ctx.wearingGloves;
        if (ctx.fpsArmGroup && ctx.fpsArmGroup.userData && ctx.fpsArmGroup.userData.handMat) {
          ctx.fpsArmGroup.userData.handMat.color.setHex(ctx.wearingGloves ? 0x38bdf8 : 0xfde68a);
        }
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(ctx.wearingGloves
            ? '🧤 Luvas de Nitrilo Estéreis calçadas!'
            : '🧤 Luvas de Nitrilo retiradas.');
        }
        return;
      }
    }
    return;
  }
  if (handleWorldInteraction(ctx)) return;
  if (ctx.hoveredPickable) {
    if (ctx.hoveredPickable.fridgeCtrl) {
      const fridge = ctx.hoveredPickable;
      toggleCultureFridgeDoor(fridge);
      ctx.queueWorldStateChange(fridge.id, fridge.fridgeCtrl.doorOpen ? 1 : 0);
      if (window.MycoAudio) window.MycoAudio.playDoor(fridge.fridgeCtrl.doorOpen);
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(fridge.fridgeCtrl.doorOpen ? '🧊 Geladeira 4°C: Porta ABERTA' : '🧊 Geladeira 4°C: Porta FECHADA');
      }
      return;
    }
    if (ctx.hoveredPickable.mesh.userData.isBlockedPickup && ctx.hoveredPickable.mesh.userData.isBlockedPickup(ctx.hoveredPickable)) {
      return;
    }
    if (ctx.hoveredPickable.potItem && ctx.hoveredPickable.isAttached) {
      for (let cpLockIdx = 0; cpLockIdx < ctx.cookerPots.length; cpLockIdx++) {
        const cpLock = ctx.cookerPots[cpLockIdx];
        if (cpLock.lidItem === ctx.hoveredPickable && cpLock.psi >= 1.5) {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('🔒 Tampa travada pela pressão (' + cpLock.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar (< 1.5 PSI).');
          }
          return;
        }
      }
      const lidIt = ctx.hoveredPickable;
      lidIt.isAttached = false;
      ctx.heldItem = lidIt;
      ctx.lastPickupAt = performance.now();
      setHeldTwoHandedGhost(ctx.heldItem, false);
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      ctx.notifyWorldAction();
      return;
    }
    if (ctx.hoveredPickable.lidItem) {
      for (let cpPotIdx = 0; cpPotIdx < ctx.cookerPots.length; cpPotIdx++) {
        const cpPot = ctx.cookerPots[cpPotIdx];
        if (cpPot.potItem === ctx.hoveredPickable && cpPot.psi >= 1.5) {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('🔒 Panela pressurizada (' + cpPot.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar.');
          }
          return;
        }
      }
    }
    for (let cpIdx = 0; cpIdx < ctx.cookerPots.length; cpIdx++) {
      const cp = ctx.cookerPots[cpIdx];
      const idxInPot = cp.contents.indexOf(ctx.hoveredPickable);
      if (idxInPot !== -1) {
        cp.contents.splice(idxInPot, 1);
        if (ctx.hoveredPickable.mesh && ctx.hoveredPickable.mesh.userData.isCookerBase) {
          cp.hasBase = cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
        }
      }
    }
    ctx.hoveredPickable.trayContents = null;
    if (ctx.hoveredPickable.mesh && ctx.hoveredPickable.mesh.userData.isTray) {
      const trayMesh = ctx.hoveredPickable.mesh;
      trayMesh.updateMatrixWorld(true);
      const tRy = trayMesh.rotation.y;
      const carried = [];
      const _locVec = new THREE.Vector3();
      for (let ti = 0; ti < ctx.pickableItems.length; ti++) {
        const cand = ctx.pickableItems[ti];
        if (!cand || cand === ctx.hoveredPickable || !cand.mesh || ctx.isHeldByRemote(cand.id)) continue;
        if (cand.mesh.userData.isTable || cand.mesh.userData.isHood || cand.mesh.userData.isTray) continue;
        cand.mesh.getWorldPosition(_locVec);
        trayMesh.worldToLocal(_locVec);
        if (Math.abs(_locVec.x) <= 0.22 && Math.abs(_locVec.z) <= 0.16 &&
          _locVec.y >= -0.05 && _locVec.y <= 0.38) {
          carried.push({
            item: cand,
            localOffset: _locVec.clone(),
            localRotY: cand.mesh.rotation.y - tRy
          });
        }
      }
      if (carried.length) ctx.hoveredPickable.trayContents = carried;
    }
    ctx.heldItem = ctx.hoveredPickable;
    cancelHeldItemPlacement(ctx);
    ctx.lastPickupAt = performance.now();
    ctx.heldRotY = ctx.heldItem.mesh.rotation.y;
    setHeldTwoHandedGhost(ctx.heldItem, true);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  }
}
