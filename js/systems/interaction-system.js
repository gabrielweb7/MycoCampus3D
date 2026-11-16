/**
 * Sistema de Interacoes & Raycasting (MycoCampus3D)
 * Hover raycast, pegar/soltar objetos, inoculacao, panela de pressao, borrifador,
 * termometro laser, lousa, portas, persianas, cinema, assentos e estufa.
 */

import { getHeldBoardToolColor, drawBoardSegment } from './chalkboard.js';
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
  setHeldTwoHandedGhost,
  updateHeldItemPlacementPreview
} from './held-item-placement.js';
import { greenhouseHitMeshes } from '../world/greenhouse.js';
import { scrollRanking } from '../world/staircase-clock.js';
import { canFillFromSink, canItemEnterCooker, canSealSpawnBag, canSyringeSource, canSyringeTarget, hasPdaContents } from '../items/item-registry.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { setBurnerLevel, BURNER_LEVEL_NAMES, updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { fillPetriWithPda } from '../items/petri-dish.js';
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

function getSyringeTargetHint(spawn, syringeVolume, pdaAgarReady, pdaMedium) {
  if (syringeVolume <= 0) return '💉 Seringa vazia • Aspire cultura líquida antes de inocular';
  if (!spawn.filled) return '🌽 Adicione substrato antes de inocular';
  if (spawn.burned) return '🔥 Este recipiente foi queimado e não pode ser inoculado';
  if (spawn.contaminated) return '🦠 Este recipiente está contaminado';
  if (spawn.inoculated) return '✅ Este recipiente já foi inoculado';
  if (spawn.substrateKind === 'pda' && (!pdaMedium || !pdaMedium.mixed || !pdaMedium.sterilized || pdaMedium.burned)) {
    return '♨️ Misture o PDA/BDA e esterilize o PP5 antes de inocular';
  }
  if (spawn.isPP5 && (spawn.waterMl || 0) < 35 && !pdaAgarReady) return '💧 Hidrate o PP5 com 35ml de água antes de esterilizar';
  if (spawn.isBag && !spawn.sealed) return '♨️ Sele o bag antes de esterilizar';
  if (!spawn.sterilized) return '♨️ Esterilize o recipiente antes de inocular';
  return '⚠️ Este recipiente ainda não está pronto';
}

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

export { setHeldTwoHandedGhost };

export function isSeatOccupied(remoteAvatars, seat) {
  if (!seat) return false;
  for (const avId in remoteAvatars) {
    if (!Object.prototype.hasOwnProperty.call(remoteAvatars, avId)) continue;
    const av = remoteAvatars[avId];
    if (!av || !av.targetPos) continue;
    if (av.seated && Math.hypot(av.targetPos.x - seat.x, av.targetPos.z - seat.z) < 0.48 && Math.abs(av.targetPos.y - seat.y) < 0.85) {
      return true;
    }
  }
  return false;
}

export function firstValidRayHit(hits) {
  for (let hi = 0; hi < hits.length; hi++) {
    if (!hits[hi].object.userData.ignoreRay) return hits[hi];
  }
  return null;
}

export function dropHeldItem(ctx) {
  if (!ctx.heldItem) return;
  ctx.syringePumping = null;
  ctx.syringePunctureProgress = 0;
  ctx.lastSyringeTargetItem = null;
  const rayNdc = ctx.inFps ? _vZero2 : ctx.pointerNdc;
  const pt = findPlacementTarget(ctx.entityCtx, rayNdc);
  if (isPlacementBlocked(ctx.entityCtx, pt)) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(getPlacementBlockedReason() || '🚫 Sem espaço livre aqui para soltar o item!');
    }
    return;
  }
  commitHeldItemPlacement(ctx, pt, false);
}

export function handlePrimaryAction(ctx) {
  if (ctx.heldItem) {
    if (performance.now() - ctx.lastPickupAt < 140) return;
    if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer && !ctx.placementMode) {
      ctx.thermoLaserOn = !ctx.thermoLaserOn;
      if (window.MycoAudio && window.MycoAudio.playLaserBeep) {
        window.MycoAudio.playLaserBeep();
      }
      drawThermoScreen(ctx.thermoCurrentTemp, ctx.thermoLaserOn ? 'SCAN' : 'HOLD', true);
      return;
    }
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
      const potP = ctx.hoveredPotInsert.potItem.mesh.position;
      const slotIdx = ctx.hoveredPotInsert.contents.length;
      const ox = (slotIdx % 2 === 0 ? -0.06 : 0.06);
      const oz = (slotIdx < 2 ? -0.05 : 0.05);
      ctx.heldItem.mesh.position.set(potP.x + ox, potP.y + 0.045, potP.z + oz);
      ctx.heldItem.mesh.rotation.set(0, ctx.heldRotY, 0);
      ctx.heldItem.isMoved = true;
      if (ctx.hoveredPotInsert.contents.indexOf(ctx.heldItem) === -1) ctx.hoveredPotInsert.contents.push(ctx.heldItem);
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
    if (ctx.hoveredSprayTarget && ctx.heldItem.mesh.userData.isAlcoholSpray) {
      if (window.MycoAudio) window.MycoAudio.playSpray();
      const nowMs = performance.now();
      if (ctx.hoveredSprayTarget === 'hood') {
        ctx.hoodSanitizedUntil = Date.now() + 90000;
        ctx.queueWorldStateChange('hood_sanitized_until', 1);
        if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('sanitize_hood');
      } else {
        ctx.hoveredSprayTarget.sanitizedUntil = nowMs + 90000;
      }
      const spCount = 24;
      const spArr = new Float32Array(spCount * 3);
      const spOrigin = new THREE.Vector3(0.24, -0.14, -0.52).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
      const spDir = new THREE.Vector3(0, 0, -1).applyEuler(ctx.camera.rotation);
      for (let si = 0; si < spCount; si++) {
        spArr[si * 3] = spOrigin.x + (Math.random() - 0.5) * 0.14;
        spArr[si * 3 + 1] = spOrigin.y + (Math.random() - 0.5) * 0.14;
        spArr[si * 3 + 2] = spOrigin.z + (Math.random() - 0.5) * 0.14;
      }
      const spGeo = new THREE.BufferGeometry();
      const spAttr = new THREE.BufferAttribute(spArr, 3);
      spGeo.setAttribute('position', spAttr);
      const spMat = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.035, transparent: true, opacity: 0.85 });
      const spPts = new THREE.Points(spGeo, spMat);
      ctx.scene.add(spPts);
      ctx.sprayBursts.push({ pts: spPts, mat: spMat, attr: spAttr, dir: spDir, age: 0 });
      return;
    }
    if (ctx.hoveredHeatSealerTarget && ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.sealsBags) {
      const target = ctx.hoveredHeatSealerTarget;
      if (canSealSpawnBag(target)) {
        target.spawnCtrl.sealed = true;
        target.spawnCtrl.updateVisual();
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
      if (tgt.mode === 'draw' && !canSyringeSource(tgt.item)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Aspire apenas cultura líquida do frasco próprio; água e meio PDA/BDA não são cultura.');
        return;
      }
      if (tgt.mode === 'inject' && !canSyringeTarget(tgt.item)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente não está preparado para receber cultura pela seringa.');
        return;
      }
      const fromVol = syrCtrl.volMl;
      const sourceVol = tgt.mode === 'draw' && tgt.item && tgt.item.mesh.userData.liquidCtrl
        ? tgt.item.mesh.userData.liquidCtrl.volMl
        : 0;
      const toVol = tgt.mode === 'draw'
        ? Math.min(10, fromVol + sourceVol)
        : 0;
      if (Math.abs(toVol - fromVol) < 0.01) return;

      ctx.syringePumping = {
        target: tgt,
        fromVol: fromVol,
        toVol: toVol,
        duration: 2.0,
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
        const addAmt = lc.maxMl >= 4000 ? 1000 : (lc.maxMl >= 500 ? 250 : lc.maxMl);
        if (lc.volMl < lc.maxMl) {
          updateContainerVolume(ctx.heldItem, Math.min(lc.maxMl, lc.volMl + addAmt));
          if (medium) markPdaVolumeChanged(ctx.heldItem);
          filledSomething = true;
        }
      } else {
        for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
          const cp = ctx.cookerPots[cpi];
          if (cp.potItem === ctx.heldItem && cp.waterMl < cp.maxWaterMl) {
            cp.waterMl = Math.min(cp.maxWaterMl, cp.waterMl + 1000);
            updateCookerWaterVisual(cp);
            filledSomething = true;
            break;
          }
        }
      }
      if (filledSomething) {
        triggerSinkStream(ctx.hoveredSink, 900);
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
      const pourAmt = Math.min(srcLc.volMl, 500, cp.maxWaterMl - cp.waterMl);
      if (pourAmt > 0) {
        updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
        cp.waterMl += pourAmt;
        updateCookerWaterVisual(cp);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        ctx.notifyWorldAction();
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
        const pourAmt = Math.min(srcLc.volMl, 35 - (spawn.waterMl || 0));
        if (pourAmt > 0) {
          updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
          spawn.waterMl = (spawn.waterMl || 0) + pourAmt;
          spawn.updateVisual();
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
          ctx.notifyWorldAction();
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

        const stepAmt = dstLc.maxMl <= 50 ? 15 : 250;
        const pourAmt = Math.min(srcLc.volMl, stepAmt, dstLc.maxMl - dstLc.volMl);
        if (pourAmt > 0) {
          updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
          updateContainerVolume(dstItem, dstLc.volMl + pourAmt);
          if (dstItem.pdaMediumCtrl) markPdaVolumeChanged(dstItem);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
          ctx.notifyWorldAction();
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
    if (ctx.placementMode && ctx.placementValid && ctx.placementGhost) {
      if (isPlacementBlocked(ctx.entityCtx, ctx.placementGhost.position)) {
        ctx.placementValid = false;
        updatePlacementGhostVisual(ctx.heldItem, false, ctx.heldRotY, ctx.clock.elapsedTime);
        return;
      }
      commitHeldItemPlacement(ctx, ctx.placementGhost.position, true);
    }
    return;
  }
  if (ctx.hoveredGreenhouseSlot) {
    ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
    return;
  }
  if (ctx.hoveredMushroom && ctx.hoveredMushroom.active) {
    ctx.hoveredMushroom.active = false;
    ctx.hoveredMushroom.group.visible = false;
    ctx.hoveredMushroom.respawnAt = performance.now() + 20000;
    ctx.queueWorldStateChange(ctx.hoveredMushroom.id, 0);
    if (window.MycoAudio) window.MycoAudio.playHarvest();
    if (ctx.callbacks.onHarvestMushroom) ctx.callbacks.onHarvestMushroom(ctx.hoveredMushroom.id);
    return;
  }
  if (ctx.hoveredDoorObj) {
    ctx.hoveredDoorObj.open = !ctx.hoveredDoorObj.open;
    ctx.queueWorldStateChange(ctx.hoveredDoorObj.id, ctx.hoveredDoorObj.open ? 1 : 0);
    if (window.MycoAudio) window.MycoAudio.playDoor(ctx.hoveredDoorObj.open);
    return;
  }
  if (ctx.hoveredBlindObj) {
    ctx.hoveredBlindObj.open = !ctx.hoveredBlindObj.open;
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange(ctx.hoveredBlindObj.id, ctx.hoveredBlindObj.open ? 1 : 0);
    return;
  }
  if (ctx.hoveredCinema) {
    const hit = ctx.getCinemaHitTarget(ctx.hoveredCinemaUv);
    if (hit.type === 'power_on') {
      ctx.cinemaPower = true;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = (ctx.cinemaLessonIdx === -1 || ctx.cinemaPlaying);
      ctx.queueWorldStateChange('cinema_power', 1);
    } else if (hit.type === 'power_off') {
      ctx.cinemaPower = false;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = false;
      ctx.queueWorldStateChange('cinema_power', 0);
    } else if (hit.type === 'menu') {
      ctx.cinemaLessonIdx = -1;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = true;
      ctx.queueWorldStateChange('cinema_lesson', -1);
    } else if (hit.type === 'lesson') {
      ctx.cinemaLessonIdx = hit.idx;
      ctx.cinemaPlaying = true;
      ctx.cinemaTime = 0;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = true;
      ctx.queueWorldStateChange('cinema_lesson', ctx.cinemaLessonIdx);
      ctx.queueWorldStateChange('cinema_playing', 1);
    } else if (hit.type === 'toggle_play') {
      ctx.cinemaPlaying = !ctx.cinemaPlaying;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = ctx.cinemaPlaying;
      ctx.queueWorldStateChange('cinema_playing', ctx.cinemaPlaying ? 1 : 0);
    }
    return;
  }
  if (ctx.hoveredRankBtn) {
    scrollRanking(ctx.hoveredRankBtn);
    return;
  }
  if (ctx.hoveredSeat) {
    if (isSeatOccupied(ctx.remoteAvatars, ctx.hoveredSeat)) return;
    ctx.seatedSeat = ctx.hoveredSeat;
    ctx.playerPos.set(ctx.seatedSeat.x, ctx.seatedSeat.y, ctx.seatedSeat.z);
    ctx.playerYaw = ctx.seatedSeat.yaw;
    if (ctx.playerPitch < -0.06) ctx.playerPitch = -0.02;
    ctx.playerVelX = 0; ctx.playerVelZ = 0; ctx.playerVelY = 0;
    ctx.notifyWorldAction();
    return;
  }
  if (ctx.hoveredSwitch) {
    ctx.hoveredSwitch.on = !ctx.hoveredSwitch.on;
    if (ctx.hoveredSwitch.light) {
      ctx.hoveredSwitch.light.visible = ctx.hoveredSwitch.on;
      ctx.hoveredSwitch.light.intensity = ctx.hoveredSwitch.on ? 1.35 : 0;
    }
    if (ctx.hoveredSwitch.gLight) {
      ctx.hoveredSwitch.gLight.visible = ctx.hoveredSwitch.on;
      ctx.hoveredSwitch.gLight.intensity = ctx.hoveredSwitch.on ? 0.65 : 0;
    }
    if (ctx.hoveredSwitch.tubeMat) {
      ctx.hoveredSwitch.tubeMat.emissive.setHex(ctx.hoveredSwitch.on ? 0xfffbeb : 0x1e293b);
      ctx.hoveredSwitch.tubeMat.emissiveIntensity = ctx.hoveredSwitch.on ? 0.85 : 0.02;
    }
    if (ctx.hoveredSwitch.ledMat) {
      ctx.hoveredSwitch.ledMat.color.setHex(ctx.hoveredSwitch.on ? 0x22c55e : 0xef4444);
    }
    if (ctx.hoveredSwitch.rocker) {
      ctx.hoveredSwitch.rocker.rotation.x = ctx.hoveredSwitch.on ? -0.22 : 0.22;
    }
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange(ctx.hoveredSwitch.id, ctx.hoveredSwitch.on ? 1 : 0);
    return;
  }
  if (ctx.hoveredHoodSwitch) {
    ctx.hoveredHoodSwitch.on = !ctx.hoveredHoodSwitch.on;
    ctx.hoveredHoodSwitch.points.visible = ctx.hoveredHoodSwitch.on;
    ctx.hoveredHoodSwitch.hepaMat.emissiveIntensity = ctx.hoveredHoodSwitch.on ? 0.45 : 0.04;
    ctx.hoveredHoodSwitch.ledMat.color.setHex(ctx.hoveredHoodSwitch.on ? 0x22c55e : 0xef4444);
    if (ctx.hoveredHoodSwitch.workLight) {
      ctx.hoveredHoodSwitch.workLight.visible = ctx.hoveredHoodSwitch.on;
      ctx.hoveredHoodSwitch.workLight.intensity = ctx.hoveredHoodSwitch.on ? 0.95 : 0;
    }
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange('hood_lab', ctx.hoveredHoodSwitch.on ? 1 : 0);
    if (ctx.hoveredHoodSwitch.on && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('hood_on');
    return;
  }
  if (ctx.hoveredStirSwitch) {
    ctx.hoveredStirSwitch.on = !ctx.hoveredStirSwitch.on;
    ctx.hoveredStirSwitch.ledMat.color.setHex(ctx.hoveredStirSwitch.on ? 0x22c55e : 0xef4444);
    ctx.queueWorldStateChange('stir_lab', ctx.hoveredStirSwitch.on ? 1 : 0);
    return;
  }
  if (ctx.hoveredScaleTare) {
    ctx.hoveredScaleTare.tare = ctx.hoveredScaleTare.lastGross || 0;
    ctx.hoveredScaleTare.draw(0);
    return;
  }
  if (ctx.hoveredBurnerSwitch) {
    const nextLvl = ((ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0)) + 1) % 4;
    setBurnerLevel(ctx.hoveredBurnerSwitch, nextLvl);
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    if (ctx.hoveredBurnerSwitch.id === 'burner_lab') {
      ctx.queueWorldStateChange('burner_lab', ctx.hoveredBurnerSwitch.on ? 1 : 0);
      ctx.queueWorldStateChange('burner_level_lab', ctx.hoveredBurnerSwitch.level || 0);
    }
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🔥 ' + (ctx.hoveredBurnerSwitch.kind === 'gas_tripod' ? 'Tripé a Gás' : 'Fogareiro') + ': ' + BURNER_LEVEL_NAMES[nextLvl]);
    }
    if (ctx.hoveredBurnerSwitch.on && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('cooker_heat');
    return;
  }
  if (ctx.hoveredPickable) {
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
      const idxInPot = ctx.cookerPots[cpIdx].contents.indexOf(ctx.hoveredPickable);
      if (idxInPot !== -1) ctx.cookerPots[cpIdx].contents.splice(idxInPot, 1);
    }
    ctx.hoveredPickable.trayContents = null;
    if (ctx.hoveredPickable.mesh && ctx.hoveredPickable.mesh.userData.isTray && ctx.hoveredPickable.mesh.userData.dynamicSurface) {
      const tSurf = ctx.hoveredPickable.mesh.userData.dynamicSurface;
      const tPos = ctx.hoveredPickable.mesh.position;
      const tRy = ctx.hoveredPickable.mesh.rotation.y;
      const cT = Math.cos(-tRy), sT = Math.sin(-tRy);
      const carried = [];
      for (let ti = 0; ti < ctx.pickableItems.length; ti++) {
        const cand = ctx.pickableItems[ti];
        if (!cand || cand === ctx.hoveredPickable || !cand.mesh || ctx.isHeldByRemote(cand.id)) continue;
        if (cand.mesh.userData.isTable || cand.mesh.userData.isHood || cand.mesh.userData.isTray) continue;
        const cp = cand.mesh.position;
        if (cp.x >= tSurf.minX - 0.04 && cp.x <= tSurf.maxX + 0.04 &&
          cp.z >= tSurf.minZ - 0.04 && cp.z <= tSurf.maxZ + 0.04 &&
          cp.y >= tSurf.topY - 0.04 && cp.y <= tSurf.topY + 0.35) {
          const dx = cp.x - tPos.x, dz = cp.z - tPos.z;
          carried.push({
            item: cand,
            lx: dx * cT + dz * sT,
            ly: cp.y - tPos.y,
            lz: -dx * sT + dz * cT,
            lry: cand.mesh.rotation.y - tRy
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

export function updateHoverRay(ctx, customNdc) {
  if (!ctx.heldItem && ctx.placementMode) cancelHeldItemPlacement(ctx);
  ctx.hoveredPickable = null;
  ctx.hoveredMushroom = null;
  ctx.hoveredDoorObj = null;
  ctx.hoveredBlindObj = null;
  ctx.hoveredBoardHit = null;
  ctx.hoveredCinema = false;
  ctx.hoveredCinemaUv = null;
  ctx.hoveredRankBtn = null;
  ctx.hoveredSeat = null;
  ctx.hoveredSwitch = null;
  ctx.hoveredHoodSwitch = null;
  ctx.hoveredStirSwitch = null;
  ctx.hoveredPdaTarget = null;
  ctx.hoveredSyringeTarget = null;
  ctx.hoveredHeatSealerTarget = null;
  ctx.hoveredScaleTare = null;
  ctx.hoveredBurnerSwitch = null;
  ctx.hoveredPotInsert = null;
  ctx.hoveredSprayTarget = null;
  ctx.hoveredSink = null;
  ctx.hoveredPourTarget = null;
  ctx.hoveredFillPot = null;
  ctx.hoveredGrainTarget = null;
  ctx.hoveredFlocaoTarget = null;
  ctx.hoveredScalpelTarget = null;
  ctx.hoveredBowlTarget = null;
  let prompt = '';

  const rayNdc = customNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc);
  ctx.raycaster.setFromCamera(rayNdc, ctx.camera);

  if (ctx.heldItem) {
    const toolCol = getHeldBoardToolColor(ctx.heldItem);
    if (toolCol && ctx.chalkboardMeshes.length) {
      const bHits = ctx.raycaster.intersectObjects(ctx.chalkboardMeshes, false);
      if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
        ctx.hoveredBoardHit = bHits[0];
        ctx.hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
        if (ctx.placementGhost) ctx.placementGhost.visible = false;
        const touchUi = ctx.isTouchDevice();
        prompt = toolCol === 'erase'
          ? (touchUi ? '🧽 Arraste na lousa para apagar' : '🧽 Segure o clique para apagar a lousa')
          : (touchUi ? '✏️ Arraste na lousa para escrever' : '✏️ Segure o clique para escrever na lousa');
        if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
        return;
      }
    }
    if (ctx.heldItem.mesh.userData.isAlcoholSpray) {
      const spRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const spRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let ai = 0; ai < ctx.pickableItems.length; ai++) {
        const aCand = ctx.pickableItems[ai];
        if (aCand === ctx.heldItem || ctx.isHeldByRemote(aCand.id)) continue;
        const adx = aCand.mesh.position.x - spRefX, adz = aCand.mesh.position.z - spRefZ;
        if (adx * adx + adz * adz > 100) continue;
        const aHit = firstValidRayHit(ctx.raycaster.intersectObject(aCand.mesh, true));
        if (aHit && aHit.distance < 3.5) {
          ctx.hoveredSprayTarget = aCand.mesh.userData.isHood ? 'hood' : aCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🧴 Borrifar Álcool 70% (' + aCand.label + ')');
          return;
        }
      }
    }
    if (ctx.heldItem.pdaReagentCtrl) {
      const pdaRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const pdaRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
        const pCand = ctx.pickableItems[pi];
        if (pCand === ctx.heldItem || !pCand.pdaMediumCtrl || pCand.pdaMediumCtrl.kind !== 'beaker' ||
            !pCand.meta || !pCand.meta.compatibilities || !pCand.meta.compatibilities.receivesPdaWater ||
            ctx.isHeldByRemote(pCand.id)) continue;
        const dx = pCand.mesh.position.x - pdaRefX, dz = pCand.mesh.position.z - pdaRefZ;
        if (dx * dx + dz * dz > 100) continue;
        const hit = firstValidRayHit(ctx.raycaster.intersectObject(pCand.mesh, true));
        if (hit && hit.distance < 3.5) {
          ctx.hoveredPdaTarget = pCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🧪 Adicionar ' + PDA_POWDER_DOSE_GRAMS + 'g de PDA/BDA ao béquer');
          return;
        }
      }
    }
    if (ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.sealsBags) {
      const hsRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const hsRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let hi = 0; hi < ctx.pickableItems.length; hi++) {
        const hCand = ctx.pickableItems[hi];
        if (!hCand.spawnCtrl || !hCand.spawnCtrl.isBag || hCand === ctx.heldItem || ctx.isHeldByRemote(hCand.id)) continue;
        const hdx = hCand.mesh.position.x - hsRefX, hdz = hCand.mesh.position.z - hsRefZ;
        if (hdx * hdx + hdz * hdz > 100) continue;
        const hHit = firstValidRayHit(ctx.raycaster.intersectObject(hCand.mesh, true));
        if (!hHit || hHit.distance >= 3.5) continue;
        ctx.hoveredHeatSealerTarget = hCand;
        if (ctx.placementGhost) ctx.placementGhost.visible = false;
        const hSc = hCand.spawnCtrl;
        const hPrompt = canSealSpawnBag(hCand)
          ? '♨️ Selar ' + hCand.label + ' antes da esterilização'
          : (!hSc.filled
            ? '🌾 Preencha o bag com substrato antes de selar'
            : (hSc.sealed
              ? '✅ Este bag já está selado'
              : (hSc.sterilized || hSc.inoculated
                ? '⚠️ O bag deve ser selado antes da esterilização'
                : (hSc.burned ? '🔥 Este bag foi queimado' : '🦠 Este bag está contaminado'))));
        if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(hPrompt);
        return;
      }
    }
    if (canItemEnterCooker(ctx.heldItem)) {
      for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
        const cp = ctx.cookerPots[ci];
        if (cp.lidItem.isAttached || cp.contents.length >= 6) continue;
        const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
        if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
          ctx.hoveredPotInsert = cp;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🍲 Colocar ' + ctx.heldItem.label + ' dentro da Panela');
          return;
        }
      }
    }
    if (ctx.labSinkMeshes && ctx.labSinkMeshes.length) {
      const isPotHeld = ctx.cookerPots.some((cp) => cp.potItem === ctx.heldItem && !cp.lidItem.isAttached);
      const isLiquidHeld = canFillFromSink(ctx.heldItem);
      if (isPotHeld || isLiquidHeld) {
        const sHits = ctx.raycaster.intersectObjects(ctx.labSinkMeshes, false);
        if (sHits.length > 0 && sHits[0].distance < 3.5) {
          ctx.hoveredSink = sHits[0].object.userData.labSink;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🚰 Encher ' + ctx.heldItem.label + ' com água da torneira');
          return;
        }
      }
    }
    if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl && ctx.heldItem.mesh.userData.liquidCtrl.volMl > 0) {
      const sourceHasPda = hasPdaContents(ctx.heldItem);
      const sourceCanPourWater = ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.poursWater;
      if (ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
          ctx.heldItem.meta.compatibilities.poursWater && !sourceHasPda) {
        const pdaRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
        const pdaRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
        for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
          const pCand = ctx.pickableItems[pi];
          if (pCand === ctx.heldItem || !pCand.pdaMediumCtrl || pCand.pdaMediumCtrl.kind !== 'beaker' ||
              !pCand.meta || !pCand.meta.compatibilities || !pCand.meta.compatibilities.receivesPdaPowder ||
              ctx.isHeldByRemote(pCand.id)) continue;
          const dx = pCand.mesh.position.x - pdaRefX, dz = pCand.mesh.position.z - pdaRefZ;
          if (dx * dx + dz * dz > 100) continue;
          const hit = firstValidRayHit(ctx.raycaster.intersectObject(pCand.mesh, true));
          if (hit && hit.distance < 3.5) {
            ctx.hoveredPdaTarget = pCand;
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            const hint = pCand.pdaMediumCtrl.powderGrams > 0
              ? '💧 Completar o preparo do PDA/BDA com água'
              : '🧪 Adicione o pó PDA/BDA antes da água';
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(hint);
            return;
          }
        }
      }
      for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
        if (!sourceCanPourWater || sourceHasPda) break;
        const cp = ctx.cookerPots[ci];
        if (cp.lidItem.isAttached || cp.waterMl >= cp.maxWaterMl) continue;
        const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
        if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
          ctx.hoveredFillPot = cp;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) {
            ctx.callbacks.onHoverPrompt('💧 Despejar água na Panela (' + (cp.waterMl / 1000).toFixed(1) + 'L / 20L)');
          }
          return;
        }
      }
      const pRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const pRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
        const pCand = ctx.pickableItems[pi];
        if (pCand === ctx.heldItem || ctx.isHeldByRemote(pCand.id)) continue;
        const isPourableLc = !!(pCand.mesh && pCand.mesh.userData.liquidCtrl &&
          pCand.mesh.userData.liquidCtrl.volMl < pCand.mesh.userData.liquidCtrl.maxMl &&
          !(pCand.spawnCtrl && pCand.spawnCtrl.isPP5) &&
          pCand.meta && pCand.meta.compatibilities &&
          (sourceHasPda
            ? pCand.meta.compatibilities.acceptsPdaMedium
            : sourceCanPourWater && pCand.meta.compatibilities.receivesWater));
        const isPourablePP5 = !!(pCand.spawnCtrl && pCand.spawnCtrl.isPP5 &&
          (sourceHasPda
            ? !pCand.spawnCtrl.filled && pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.acceptsPdaMedium
            : sourceCanPourWater && pCand.spawnCtrl.filled && (pCand.spawnCtrl.waterMl || 0) < 35 &&
              pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.receivesWater));
        const isPourableBowl = !!(!sourceHasPda && sourceCanPourWater && pCand.bowlCtrl &&
          pCand.meta && pCand.meta.compatibilities &&
          pCand.meta.compatibilities.receivesWater);
        const petriCtrl = pCand.mesh && pCand.mesh.userData.petriCtrl;
        const isPourablePetri = !!(sourceHasPda && petriCtrl && petriCtrl.mode === 'bare' &&
          pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.acceptsPdaMedium);
        if (!isPourableLc && !isPourablePP5 && !isPourableBowl && !isPourablePetri) continue;
        const pdx = pCand.mesh.position.x - pRefX, pdz = pCand.mesh.position.z - pRefZ;
        if (pdx * pdx + pdz * pdz > 100) continue;
        const pHit = firstValidRayHit(ctx.raycaster.intersectObject(pCand.mesh, true));
        if (pHit && pHit.distance < 3.5) {
          ctx.hoveredPourTarget = pCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) {
            const prompt = isPourablePetri
              ? '🧫 Despejar 20ml de PDA/BDA em ' + pCand.label
              : (isPourablePP5 && sourceHasPda
                ? '🧪 Transferir meio PDA/BDA para ' + pCand.label
                : '💧 Umedecer / Despejar água em ' + pCand.label);
            ctx.callbacks.onHoverPrompt(prompt);
          }
          return;
        }
      }
    }
    if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isFlocao) {
      const fRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const fRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let fi = 0; fi < ctx.pickableItems.length; fi++) {
        const fCand = ctx.pickableItems[fi];
        const heldCanAddFlocao = ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
          ctx.heldItem.meta.compatibilities.fillsPP5WithFlocao;
        const canFlocaoPP5 = !!(heldCanAddFlocao && fCand.spawnCtrl && fCand.spawnCtrl.isPP5 &&
          !fCand.spawnCtrl.filled && fCand.meta && fCand.meta.compatibilities && fCand.meta.compatibilities.receivesFlocao);
        const canFlocaoBowl = !!(fCand.bowlCtrl && fCand.meta && fCand.meta.compatibilities &&
          fCand.meta.compatibilities.receivesIngredients);
        if ((!canFlocaoPP5 && !canFlocaoBowl) || ctx.isHeldByRemote(fCand.id)) continue;
        const fdx = fCand.mesh.position.x - fRefX, fdz = fCand.mesh.position.z - fRefZ;
        if (fdx * fdx + fdz * fdz > 100) continue;
        const fHit = firstValidRayHit(ctx.raycaster.intersectObject(fCand.mesh, true));
        if (fHit && fHit.distance < 3.5) {
          ctx.hoveredFlocaoTarget = fCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) {
            ctx.callbacks.onHoverPrompt(canFlocaoBowl ? '🌽 Adicionar +50g de Flocão no Pote de Mistura' : '🌽 Colocar 45g de Flocão em ' + fCand.label);
          }
          return;
        }
      }
    }
    if ((ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isLabSpoon) || (ctx.heldItem.bowlCtrl && ctx.heldItem.bowlCtrl.mixed)) {
      const bRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const bRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let bi = 0; bi < ctx.pickableItems.length; bi++) {
        const bCand = ctx.pickableItems[bi];
        if (bCand === ctx.heldItem || ctx.isHeldByRemote(bCand.id)) continue;
        const isSpoonTarget = ctx.heldItem.mesh.userData.isLabSpoon && !!bCand.bowlCtrl;
        const isPortionTarget = ctx.heldItem.bowlCtrl && ctx.heldItem.bowlCtrl.mixed && bCand.spawnCtrl && !bCand.spawnCtrl.filled;
        if (!isSpoonTarget && !isPortionTarget) continue;
        const bdx = bCand.mesh.position.x - bRefX, bdz = bCand.mesh.position.z - bRefZ;
        if (bdx * bdx + bdz * bdz > 100) continue;
        const bHit = firstValidRayHit(ctx.raycaster.intersectObject(bCand.mesh, true));
        if (bHit && bHit.distance < 3.5) {
          ctx.hoveredBowlTarget = bCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) {
            ctx.callbacks.onHoverPrompt(isSpoonTarget ? '🥄 Misturar ingredientes no Pote' : '🥣 Porcionar receita em ' + bCand.label);
          }
          return;
        }
      }
    }
    if (ctx.heldItem.scalpelCtrl) {
      const sc = ctx.heldItem.scalpelCtrl;
      const sRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const sRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let si = 0; si < ctx.pickableItems.length; si++) {
        const sCand = ctx.pickableItems[si];
        if (sCand === ctx.heldItem || ctx.isHeldByRemote(sCand.id)) continue;
        const sdx = sCand.mesh.position.x - sRefX, sdz = sCand.mesh.position.z - sRefZ;
        if (sdx * sdx + sdz * sdz > 100) continue;
        const sHit = firstValidRayHit(ctx.raycaster.intersectObject(sCand.mesh, true));
        if (sHit && sHit.distance < 3.5) {
          if (sCand.mesh.userData.isScalpelBladePack) {
            ctx.hoveredScalpelTarget = { mode: 'blade', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🔪 Trocar por lâmina #24 estéril');
            return;
          }
          const petriCtrl = sCand.mesh.userData.petriCtrl;
          if (!sc.hasMycelium && ((petriCtrl && petriCtrl.mode === 'clean') || (sCand.spawnCtrl && sCand.spawnCtrl.colonization >= 60))) {
            ctx.hoveredScalpelTarget = { mode: 'cut', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🔪 Cortar fragmento de micélio (' + sCand.label + ')');
            return;
          }
          if (sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.filled && !sCand.spawnCtrl.inoculated &&
              sCand.meta && sCand.meta.compatibilities && sCand.meta.compatibilities.receivesMyceliumCut) {
            ctx.hoveredScalpelTarget = { mode: 'transfer', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🍄 Transferir micélio para ' + sCand.label);
            return;
          }
        }
      }
    }
    if (ctx.heldItem.id.indexOf('substrate_') === 0) {
      const gRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const gRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let gi = 0; gi < ctx.pickableItems.length; gi++) {
        const gCand = ctx.pickableItems[gi];
        const receivesSubstrate = !!(gCand.spawnCtrl && !gCand.spawnCtrl.filled &&
          gCand.meta && gCand.meta.compatibilities && gCand.meta.compatibilities.receivesSubstrate);
        const receivesIngredients = !!(gCand.bowlCtrl && gCand.meta && gCand.meta.compatibilities &&
          gCand.meta.compatibilities.receivesIngredients);
        if ((!receivesSubstrate && !receivesIngredients) || ctx.isHeldByRemote(gCand.id)) continue;
        const gdx = gCand.mesh.position.x - gRefX, gdz = gCand.mesh.position.z - gRefZ;
        if (gdx * gdx + gdz * gdz > 100) continue;
        const gHit = firstValidRayHit(ctx.raycaster.intersectObject(gCand.mesh, true));
        if (gHit && gHit.distance < 3.5) {
          ctx.hoveredGrainTarget = gCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) {
            ctx.callbacks.onHoverPrompt(receivesIngredients
              ? '🌾 Adicionar +100g de grãos/substrato no Pote de Mistura'
              : '🌾 Encher ' + gCand.label + ' com grãos/substrato');
          }
          return;
        }
      }
    }
    if (ctx.heldItem.mesh.userData.isSyringe && ctx.heldItem.meta &&
        ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.transfersLiquidCulture) {
      const sc = ctx.heldItem.mesh.userData.syrCtrl;
      const syRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const syRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let si = 0; si < ctx.pickableItems.length; si++) {
        const cand = ctx.pickableItems[si];
        if (cand === ctx.heldItem || ctx.isHeldByRemote(cand.id)) continue;
        const sydx = cand.mesh.position.x - syRefX, sydz = cand.mesh.position.z - syRefZ;
        if (sydx * sydx + sydz * sydz > 100) continue;
        const sHit = firstValidRayHit(ctx.raycaster.intersectObject(cand.mesh, true));
        if (sHit && sHit.distance < 4.2) {
          if (cand.mesh.userData.liquidCtrl && !(cand.spawnCtrl && cand.spawnCtrl.isPP5)) {
            const lc = cand.mesh.userData.liquidCtrl;
            if (ctx.syringePumping) {
              ctx.hoveredSyringeTarget = { item: cand, mode: ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'draw' : 'inject' };
              if (ctx.placementGhost) ctx.placementGhost.visible = false;
              const pPct = Math.round((ctx.syringePumping.elapsed / ctx.syringePumping.duration) * 100);
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('⏳ ' + (ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'Aspirando Micélio' : 'Injetando de volta') + ' (' + pPct + '%)...');
              return;
            }
            if (sc.volMl < 9.9 && lc.volMl > 0 && canSyringeSource(cand)) {
              ctx.hoveredSyringeTarget = { item: cand, mode: 'draw' };
              if (ctx.placementGhost) ctx.placementGhost.visible = false;
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💉 Furando Septo • Clique para aspirar cultura líquida (2s)');
              return;
            } else if (sc.volMl > 0.1 && canSyringeTarget(cand)) {
              ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
              if (ctx.placementGhost) ctx.placementGhost.visible = false;
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💉 Seringa cheia (' + Math.round(sc.volMl) + 'ml) • Clique para esvaziar de volta (2s)');
              return;
            } else if (sc.volMl < 9.9 && lc.volMl > 0 && ctx.callbacks.onHoverPrompt) {
              ctx.callbacks.onHoverPrompt('⚠️ Aspiração disponível apenas em frasco de cultura líquida');
              return;
            } else if (sc.volMl > 0.1 && ctx.callbacks.onHoverPrompt) {
              ctx.callbacks.onHoverPrompt('⚠️ Este recipiente não recebe cultura pela seringa');
              return;
            }
          } else if (canSyringeTarget(cand)) {
            if (sc.volMl > 0) {
              ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
              if (ctx.placementGhost) ctx.placementGhost.visible = false;
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💉 Inocular ' + Math.round(sc.volMl) + 'ml em ' + cand.label + ' (2s)');
            } else if (ctx.callbacks.onHoverPrompt) {
              ctx.callbacks.onHoverPrompt('💉 Seringa vazia • Aspire cultura líquida antes de inocular');
            }
            return;
          } else if (cand.spawnCtrl) {
            const pdaAgarReady = cand.pdaMediumCtrl && cand.pdaMediumCtrl.powderGrams > 0 &&
              cand.mesh.userData.liquidCtrl && cand.mesh.userData.liquidCtrl.volMl > 0;
            const prompt = getSyringeTargetHint(cand.spawnCtrl, sc.volMl, pdaAgarReady, cand.pdaMediumCtrl);
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
            return;
          } else if (cand.mesh.userData.isPetri) {
            const petriMode = cand.mesh.userData.petriCtrl && cand.mesh.userData.petriCtrl.mode;
            const prompt = petriMode === 'bare'
              ? '🧫 Adicione meio PDA antes de inocular esta placa'
              : (petriMode === 'filled'
                ? '♨️ Esterilize o meio PDA/BDA na panela antes de inocular'
              : (petriMode === 'empty'
                ? '🧫 Placa estéril pronta para inocular'
                : '🧫 Esta placa já contém cultura; use o bisturi para transferir micélio'));
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
            return;
          }
        }
      }
    }
    if (ctx.heldItem.mesh.userData.isThermometer && !ctx.placementMode) {
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (ctx.thermoLaserOn) {
        prompt = '🔴 [SCAN] ' + (ctx.thermoTargetLabel || 'Ambiente') + ': ' + ctx.thermoCurrentTemp.toFixed(1) + '°C (Clique: Desligar Laser • G/Q ou clique dir.: posicionar)';
      } else {
        prompt = '🔫 Laser DESLIGADO • Última: ' + ctx.thermoCurrentTemp.toFixed(1) + '°C [HOLD] (Clique: Ligar Laser • G/Q ou clique dir.: posicionar)';
      }
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
    if (!ctx.placementMode) {
      ctx.placementValid = false;
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      prompt = '📦 Pressione G/Q para posicionar este item';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
    updateHeldItemPlacementPreview(ctx, rayNdc);
    return;
  }
  if (ctx.placementGhost) ctx.placementGhost.visible = false;

  if (ctx.rankingBtnMeshes.length) {
    const rHits = ctx.raycaster.intersectObjects(ctx.rankingBtnMeshes, false);
    if (rHits.length > 0 && rHits[0].distance < 18) {
      ctx.hoveredRankBtn = rHits[0].object.userData.rankAction;
      prompt = ctx.hoveredRankBtn === 'up' ? '▲ Subir Ranking' : '▼ Descer Ranking';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.cinemaScreenMesh) {
    const cHits = ctx.raycaster.intersectObject(ctx.cinemaScreenMesh, false);
    if (cHits.length > 0 && cHits[0].distance < 22) {
      ctx.hoveredCinema = true;
      ctx.hoveredCinemaUv = cHits[0].uv ? { x: cHits[0].uv.x, y: 1 - cHits[0].uv.y } : { x: 0.5, y: 0.5 };
      const cTarget = ctx.getCinemaHitTarget(ctx.hoveredCinemaUv);
      if (cTarget.type !== ctx.lastCinemaHoverType || (cTarget.idx || -1) !== ctx.lastCinemaHoverIdx) {
        ctx.lastCinemaHoverType = cTarget.type;
        ctx.lastCinemaHoverIdx = cTarget.idx !== undefined ? cTarget.idx : -1;
        ctx.cinemaDirty = true;
      }
      if (cTarget.type === 'power_on') prompt = '⏻ Clique na tela para ligar o Auditório';
      else if (cTarget.type === 'power_off') prompt = '⏻ Desligar tela do Auditório';
      else if (cTarget.type === 'menu') prompt = '📋 Voltar ao menu de módulos';
      else if (cTarget.type === 'lesson') prompt = '▶️ Assistir: ' + ((ctx.cinemaLessons[cTarget.idx] && ctx.cinemaLessons[cTarget.idx].title) || 'Aula');
      else if (cTarget.type === 'toggle_play') prompt = ctx.cinemaPlaying ? '⏸️ Clique na aula para pausar' : '▶️ Clique na aula para continuar';
      else prompt = '🎬 Escolha um módulo na tela para assistir';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.scaleTareMeshes.length) {
    const tHits = ctx.raycaster.intersectObjects(ctx.scaleTareMeshes, false);
    if (tHits.length > 0 && tHits[0].distance < 3.5) {
      ctx.hoveredScaleTare = tHits[0].object.userData.scaleObj;
      prompt = '⚖️ Zerar Balança (TARE)';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.burnerSwitchMeshes.length && (!ctx.heldItem || !ctx.heldItem.mesh.userData.isBurner)) {
    const bHits = ctx.raycaster.intersectObjects(ctx.burnerSwitchMeshes, false);
    if (bHits.length > 0 && bHits[0].distance < 4.0) {
      ctx.hoveredBurnerSwitch = ctx.burnerDevices[bHits[0].object.userData.burnerSwitchIdx];
      const curL = ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0);
      const nxtL = (curL + 1) % 4;
      prompt = '🔥 ' + BURNER_LEVEL_NAMES[curL] + ' → Mudar para ' + BURNER_LEVEL_NAMES[nxtL];
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.stirSwitchMeshes.length && (!ctx.heldItem || !ctx.heldItem.mesh.userData.isStirrer)) {
    const stSwHits = ctx.raycaster.intersectObjects(ctx.stirSwitchMeshes, false);
    if (stSwHits.length > 0 && stSwHits[0].distance < 4.0) {
      ctx.hoveredStirSwitch = stSwHits[0].object.userData.stirSwitch;
      prompt = ctx.hoveredStirSwitch.on ? '🌀 Desligar Agitador Magnético' : '🌀 Ligar Agitador Magnético';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.hoodSwitchMeshes.length) {
    const hsHits = ctx.raycaster.intersectObjects(ctx.hoodSwitchMeshes, false);
    if (hsHits.length > 0 && hsHits[0].distance < 4.0) {
      ctx.hoveredHoodSwitch = hsHits[0].object.userData.hoodSwitch;
      prompt = ctx.hoveredHoodSwitch.on ? '💨 Desligar Fluxo Laminar' : '💨 Ligar Fluxo Laminar';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.lightSwitchMeshes.length) {
    const swHits = ctx.raycaster.intersectObjects(ctx.lightSwitchMeshes, false);
    if (swHits.length > 0 && swHits[0].distance < 4.0) {
      ctx.hoveredSwitch = swHits[0].object.userData.lightSwitch;
      prompt = ctx.hoveredSwitch.on ? '💡 Clique para desligar a luz' : '💡 Clique para ligar a luz';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.seatMeshes.length) {
    const stHits = ctx.raycaster.intersectObjects(ctx.seatMeshes, false);
    if (stHits.length > 0 && stHits[0].distance < 4.2) {
      const candSeat = stHits[0].object.userData.seatInfo;
      if (isSeatOccupied(ctx.remoteAvatars, candSeat)) {
        prompt = '🚫 Assento ocupado (sente ao lado!)';
      } else {
        ctx.hoveredSeat = candSeat;
        prompt = '🪑 Clique para sentar';
      }
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (!prompt && ctx.doorHitMeshes.length) {
    const doorHits = ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false);
    if (doorHits.length > 0 && doorHits[0].distance < 5.0) {
      ctx.hoveredDoorObj = doorHits[0].object.userData.doorObj;
      prompt = '🚪 ' + (ctx.hoveredDoorObj.open ? 'Fechar ' : 'Abrir ') + ctx.hoveredDoorObj.label;
    }
  }
  const refX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
  const refZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
  const maxMushSq = ctx.inFps ? 24 : 225;
  const maxPickSq = ctx.inFps ? 26 : 225;
  if (!prompt) {
    for (let m = 0; m < ctx.wildMushrooms.length; m++) {
      const wm = ctx.wildMushrooms[m];
      if (!wm.active) continue;
      const mdx = wm.group.position.x - refX, mdz = wm.group.position.z - refZ;
      if (mdx * mdx + mdz * mdz > maxMushSq) continue;
      const mHits = ctx.raycaster.intersectObject(wm.group, true);
      if (mHits.length > 0 && mHits[0].distance < 4.5) {
        ctx.hoveredMushroom = wm;
        prompt = '🍄 Colher Cogumelo (+25 XP)';
        break;
      }
    }
  }
  if (!prompt) {
    let bestSmall = null, bestSmallDist = Infinity;
    let bestLarge = null, bestLargeDist = Infinity;
    let bestBlocked = null, bestBlockedDist = Infinity;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      let item = ctx.pickableItems[i];
      if (item === ctx.heldItem || (ctx.heldItem && item === ctx.heldItem.lidItem)) continue;
      if (ctx.isHeldByRemote(item.id)) continue;
      const idx = item.mesh.position.x - refX, idz = item.mesh.position.z - refZ;
      if (idx * idx + idz * idz > maxPickSq) continue;
      const hit0 = firstValidRayHit(ctx.raycaster.intersectObject(item.mesh, true));
      if (hit0 && hit0.distance < 4.5) {
        const dHit = hit0.distance;
        if (item.lidItem && item.lidItem.isAttached && hit0.point.y >= item.mesh.position.y + 0.26) {
          item = item.lidItem;
        }
        if (ctx.isItemInsideClosedCooker(item)) continue;
        if (item.mesh.userData.isBlockedPickup && item.mesh.userData.isBlockedPickup(item)) {
          if (dHit < bestBlockedDist) {
            bestBlockedDist = dHit;
            bestBlocked = item;
          }
          continue;
        }
        if (item.mesh.userData.isTable || item.mesh.userData.isHood) {
          if (dHit < bestLargeDist) {
            bestLargeDist = dHit; bestLarge = item;
          }
        } else if (dHit < bestSmallDist) {
          bestSmallDist = dHit; bestSmall = item;
        }
      }
    }
    ctx.hoveredPickable = bestSmall || bestLarge;
    if (!ctx.hoveredPickable && bestBlocked && bestBlockedDist < 3.8) {
      if (bestBlocked.mesh.userData.isBurner) {
        prompt = '🚫 Retire a panela de cima antes de mover o Fogareiro';
      } else {
        prompt = '🚫 Retire os objetos de cima antes de mover ' + bestBlocked.label;
      }
    } else if (ctx.hoveredPickable) {
      let potStatus = null;
      for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
        if (ctx.cookerPots[cpi].potItem === ctx.hoveredPickable || ctx.cookerPots[cpi].lidItem === ctx.hoveredPickable) {
          potStatus = ctx.cookerPots[cpi]; break;
        }
      }
      if (ctx.hoveredPickable.potItem && ctx.hoveredPickable.isAttached) {
        if (potStatus && potStatus.psi >= 1.5) {
          const pctP = Math.min(100, Math.round((potStatus.psi / 15) * 100));
          if (potStatus.progress >= 100) {
            prompt = '🔒 Tampa Travada (' + potStatus.psi.toFixed(1) + ' PSI • ✅ 100%) — Desligue o fogo e aguarde';
          } else if (potStatus.psi >= 14) {
            prompt = '🔒 Esterilizando: ' + potStatus.psi.toFixed(1) + '/15 PSI (' + pctP + '%) • ' + Math.floor(potStatus.progress) + '%';
          } else {
            prompt = '🔒 Pressurizada: ' + potStatus.psi.toFixed(1) + '/15 PSI (' + pctP + '%) — Aguarde < 1.5 PSI';
          }
        } else if (potStatus && potStatus.progress >= 100) {
          prompt = '🍲 Retirar Tampa (🔓 Despressurizada • ✅ Esterilizado 100%)';
        } else if (potStatus && potStatus.temp > 32) {
          prompt = '🍲 Retirar Tampa (🔥 Aquecendo: ' + Math.round(potStatus.temp) + '°C)';
        } else {
          prompt = '🍲 Retirar Tampa da Panela de Pressão';
        }
      } else if (ctx.hoveredPickable.mesh.userData.twoHanded) {
        prompt = '🙌 Pegar ' + ctx.hoveredPickable.label + ' (2 mãos)';
      } else {
        prompt = '✋ Pegar ' + ctx.hoveredPickable.label;
      }
    }
  }
  if (!prompt && ctx.blindHitMeshes.length) {
    const blHits = ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false);
    if (blHits.length > 0 && blHits[0].distance < 5.5) {
      ctx.hoveredBlindObj = blHits[0].object.userData.blindObj;
      prompt = ctx.hoveredBlindObj.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana';
    }
  }
  ctx.hoveredGreenhouseSlot = null;
  if (!prompt && greenhouseHitMeshes.length > 0) {
    const ghHits = ctx.raycaster.intersectObjects(greenhouseHitMeshes, true);
    if (ghHits.length > 0 && ghHits[0].distance < 4.8) {
      const hSlot = ghHits[0].object.userData.greenhouseSlot;
      if (hSlot) {
        ctx.hoveredGreenhouseSlot = hSlot;
        const isHoldingSpray = ctx.heldItem && (ctx.heldItem.id.indexOf('alcohol_spray') !== -1 || ctx.heldItem.id.indexOf('spray') !== -1);
        if (hSlot.stage === 3) {
          prompt = '🍄 Colher ' + hSlot.name + ' (+50 XP e +2 Cogumelos)';
        } else if (isHoldingSpray) {
          prompt = '💦 Borrifar e Hidratar ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR)';
        } else {
          prompt = '🌱 ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR • ' + (hSlot.stage === 0 ? 'Micélio' : (hSlot.stage === 1 ? 'Primórdios' : 'Crescendo')) + ')';
        }
      }
    }
  }
  if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
}
