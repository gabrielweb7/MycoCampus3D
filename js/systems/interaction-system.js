/**
 * Sistema de Interacoes de Itens e Mao (MycoCampus3D)
 * Coordenacao de pegar/soltar objetos, inoculacao, panela de pressao, borrifador,
 * termometro laser, lousa e delegacao de interacoes fixas do mundo e raycasting.
 */

import { getHeldBoardToolColor, drawBoardSegment } from './chalkboard.js';
import { getItemGroundHeight } from '../engine/physics.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';
import {
  clampPointToSurfaceXZ,
  findPlacementTarget,
  isPlacementBlocked,
  getPlacementBlockedReason,
  updatePlacementGhostVisual
} from '../entities/placement-ghost.js';
import {
  beginHeldItemPlacement,
  cancelHeldItemPlacement,
  commitHeldItemPlacement,
  setHeldTwoHandedGhost,
  updateHeldItemPlacementPreview
} from './held-item-placement.js';
import { triggerMagicCubensisEffect } from './mycoteca.js';
import { handleWorldInteraction, isSeatOccupied } from './world-interactions.js';
import { updateHoverRay, firstValidRayHit } from './hover-raycaster.js';
import { canFillFromSink, canSealSpawnBag, canSyringeSource, canSyringeTarget, disposeObjectResources, hasPdaContents, isPointInBoundsXZ } from '../items/item-registry.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { fireAlcoholSpray } from '../items/alcohol-spray.js';
import { wipeWithPaperTowel } from '../items/paper-towel.js';
import { handleTrashDisposal, isContaminatedOrBurned, resetDisposableContainer } from '../items/lab-trash.js';
import { updateScalpelLabel } from '../items/scalpel.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { updateCookerWaterVisual, COOKER_SLOT_OFFSETS, COOKER_SLOT_Y } from '../items/pressure-cooker.js';
import { interactDehydrator } from '../items/dehydrator.js';
import { getItemsSupportedBy } from './surface-group-move.js';
import { depositSporePrintOnPetri, fillPetriWithPda, togglePetriLid, setPetriLidOpen, sealPetriWithParafilm } from '../items/petri-dish.js';
import { togglePP5Lid } from '../items/pp5-cup.js';
import { interactMonotub, placeMonotubInLedRackSlot, rehydrateMonotubCake, dunkMonotubAtSink } from '../items/monotub.js';
import { interactGardenTarget } from '../world/campus-garden.js';
import { breakAndShakeSpawn } from '../items/spawn-containers.js';
import {
  interactAlcoholLamp,
  interactLabMicroscope,
  interactSilicaStorageJar
} from '../items/lab-advanced-tools.js';
import {
  packDriedMushroomsIntoBag,
  sealMushroomBag,
  addSealedBagToDeliveryCrate,
  interactRoadsideStand
} from '../items/dehydration-packaging.js';
import { toggleCultureFridgeDoor, isPartOfFridgeDoor, isCultureFridgeOccupied } from '../items/culture-fridge.js';
import { preparePP5ForPda } from '../items/pp5-cup.js';
import { addIngredientToBowl, updateMixingBowlLabel } from '../items/mixing-bowl.js';
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
const _tmpDropPt = THREE ? new THREE.Vector3() : null;
const _vZero2 = new THREE.Vector2(0, 0);

export { setHeldTwoHandedGhost, updateHoverRay, firstValidRayHit, isSeatOccupied };

export function toggleHeldThermometer(ctx) {
  if (!ctx || !ctx.heldItem || !ctx.heldItem.mesh || !ctx.heldItem.mesh.userData.isThermometer) return false;
  ctx.thermoLaserOn = !ctx.thermoLaserOn;
  if (window.MycoAudio && window.MycoAudio.playLaserBeep) {
    window.MycoAudio.playLaserBeep();
  }
  drawThermoScreen(ctx.thermoCurrentTemp, ctx.thermoLaserOn ? 'SCAN' : 'HOLD', true);
  return true;
}

export function toggleHeldGloves(ctx) {
  if (!ctx) return false;
  const shouldWear = !ctx.wearingGloves || !!ctx.glovesExpired;
  ctx.wearingGloves = shouldWear;
  ctx.glovesExpired = false;
  ctx.glovesUntil = shouldWear ? (performance.now() + 160000) : 0;
  if (ctx.fpsArmGroup && ctx.fpsArmGroup.userData && ctx.fpsArmGroup.userData.handMat) {
    ctx.fpsArmGroup.userData.handMat.color.setHex(ctx.wearingGloves ? 0x09090b : 0xfde68a);
    ctx.fpsArmGroup.userData.handMat.roughness = ctx.wearingGloves ? 0.35 : 0.65;
  }
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(ctx.wearingGloves
      ? '🧤 Luvas Pretas Nitrílicas Estéreis calçadas (160s)!'
      : '🧤 Luvas Pretas retiradas.');
  }
  return true;
}

export function eatHeldMushroom(ctx) {
  if (!ctx || !ctx.heldItem || !ctx.heldItem.wildMushroomCtrl) return false;
  const wm = ctx.heldItem.wildMushroomCtrl;
  const eatenItem = ctx.heldItem;
  if (window.MycoAudio) window.MycoAudio.playHarvest();
  if (wm.isMagic) {
    triggerMagicCubensisEffect(() => {
      if (ctx.playerPos) {
        ctx.playerPos.y = 36;
        ctx.playerVelY = 0;
        ctx.onGround = false;
      }
    });
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(`🍄✨ Você comeu ${wm.speciesName}!`);
    }
  } else if (ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(`🍄 Você comeu ${wm.speciesName}!`);
  }
  wm.removed = true;
  ctx.pendingMovedItems[eatenItem.id] = {
    id: eatenItem.id,
    state: { wildMushroom: { speciesName: wm.speciesName, isMagic: !!wm.isMagic, removed: true } }
  };
  ctx.heldItem = null;
  if (eatenItem.mesh && eatenItem.mesh.parent) eatenItem.mesh.parent.remove(eatenItem.mesh);
  disposeObjectResources(eatenItem.mesh);
  const idx = ctx.pickableItems.indexOf(eatenItem);
  if (idx !== -1) ctx.pickableItems.splice(idx, 1);
  if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
    ctx.pickableMap.delete(eatenItem.id);
  }
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  ctx.notifyWorldAction();
  return true;
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

const RING_OFFSETS = [0.12, 0.22, 0.34, 0.48, 0.64];
const RING_ANGLES = 12;

function findSupportSurfaceAtPoint(ctx, pt) {
  if (!ctx || !pt) return null;
  let best = null;
  if (ctx.supportSurfaces) {
    for (let i = 0; i < ctx.supportSurfaces.length; i++) {
      const ss = ctx.supportSurfaces[i];
      if (!ss || (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.dynamicSurface === ss)) continue;
      if (ss.ownerItem && ss.ownerItem === ctx.heldItem) continue;
      if (Math.abs(pt.y - ss.topY) <= 0.08 && isPointInBoundsXZ(pt.x, pt.z, ss, 0.14)) {
        if (!best || ss.topY > best.topY) best = ss;
      }
    }
  }
  return best;
}

function findFreeSpotOnSurface(ctx, surf, anchorPt, outPt) {
  if (!surf || !outPt) return false;
  clampPointToSurfaceXZ(anchorPt.x, anchorPt.z, surf, surf.topY, outPt);
  if (!isPlacementBlocked(ctx.entityCtx, outPt)) return true;

  for (let ri = 0; ri < RING_OFFSETS.length; ri++) {
    const rad = RING_OFFSETS[ri];
    for (let ai = 0; ai < RING_ANGLES; ai++) {
      const a = (ai / RING_ANGLES) * Math.PI * 2;
      clampPointToSurfaceXZ(anchorPt.x + Math.cos(a) * rad, anchorPt.z + Math.sin(a) * rad, surf, surf.topY, outPt);
      if (!isPlacementBlocked(ctx.entityCtx, outPt)) return true;
    }
  }
  return false;
}

function tryPlaceHeldOnAimedSurface(ctx) {
  if (!ctx.heldItem) return false;
  const aimNdc = ctx.inFps ? _vZero2 : ctx.pointerNdc;
  if (!aimNdc) return false;
  const aimPt = findPlacementTarget(ctx.entityCtx, aimNdc);
  const dAim = Math.hypot(aimPt.x - ctx.playerPos.x, aimPt.z - ctx.playerPos.z);
  if (dAim > 4.4 || Math.abs(aimPt.y - ctx.playerPos.y) > 2.6) return false;

  if (ctx.snapClosePot || ctx.snapPetriStack) {
    if (!isPlacementBlocked(ctx.entityCtx, aimPt)) {
      const label = ctx.heldItem.label || 'Item';
      commitHeldItemPlacement(ctx, aimPt, !!ctx.snapClosePot);
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('📦 ' + label + ' colocado.');
      return true;
    }
  }

  const ss = findSupportSurfaceAtPoint(ctx, aimPt);
  if (!ss || ss.topY <= ctx.playerPos.y + 0.04) return false;

  const candPt = _tmpDropPt;
  if (!findFreeSpotOnSurface(ctx, ss, aimPt, candPt)) return false;

  const label = ctx.heldItem.label || 'Item';
  commitHeldItemPlacement(ctx, candPt, false);
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks.onToast) ctx.callbacks.onToast('📦 ' + label + ' colocado na superfície.');
  return true;
}

export function dropHeldItem(ctx) {
  if (!ctx.heldItem) return;
  ctx.syringePumping = null;
  ctx.syringePunctureProgress = 0;
  ctx.lastSyringeTargetItem = null;
  if (!ctx.placementMode) ctx.heldRotY = ctx.playerYaw || 0;
  cancelHeldItemPlacement(ctx);
  if (ctx.setSnapClosePot) ctx.setSnapClosePot(null);
  if (ctx.setSnapPetriStack) ctx.setSnapPetriStack(false);

  const candPt = _tmpDropPt;
  const baseYaw = ctx.playerYaw || 0;
  let chosenPt = null;

  // Botão "Largar" sempre solta no CHÃO livre próximo ao jogador (nunca na mira nem em cima de outro item)
  const radii = [0.78, 1.12, 1.48, 1.85, 0.48];
  const angleOffsets = [0, 0.45, -0.45, 0.95, -0.95, 1.5, -1.5, 2.2, -2.2, Math.PI];
  const dynamicSurfFilter = ctx.heldItem.fridgeCtrl ? 'fridge' : ctx.heldItem.mesh.userData.dynamicSurface;

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
        ctx.playerPos.y + 0.35,
        dynamicSurfFilter,
        ctx.playerPos.y + 0.55
      );
      if (Math.abs(cy - ctx.playerPos.y) > 0.24) continue;
      candPt.set(cx, cy, cz);
      if (!isPlacementBlocked(ctx.entityCtx, candPt)) {
        chosenPt = candPt;
        break;
      }
    }
  }

  if (!chosenPt) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(getPlacementBlockedReason() || '🚫 Sem espaço livre no chão ao redor para largar o item!');
    }
    return;
  }
  const droppedLabel = ctx.heldItem ? ctx.heldItem.label : 'Item';
  commitHeldItemPlacement(ctx, chosenPt, false);
  if (ctx.callbacks.onToast) {
    ctx.callbacks.onToast('⬇️ ' + droppedLabel + ' largado no chão.');
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
        const expectedMl = medium.powderGrams > 0 ? (medium.powderGrams * 1000 / PDA_GRAMS_PER_LITER) : targetLiquid.maxMl;
        const addMl = medium.powderGrams > 0
          ? Math.min(sourceLiquid.volMl, targetLiquid.maxMl - targetLiquid.volMl, expectedMl - targetLiquid.volMl)
          : Math.min(100, sourceLiquid.volMl, targetLiquid.maxMl - targetLiquid.volMl);
        if (addMl <= 0) {
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast(medium.powderGrams > 0
              ? '⚠️ A proporção já está completa; ajuste a quantidade de pó para preparar mais meio.'
              : '⚠️ O recipiente já está cheio.');
          }
          return;
        }
        updateContainerVolume(ctx.heldItem, sourceLiquid.volMl - addMl);
        updateContainerVolume(target, targetLiquid.volMl + addMl);
        markPdaVolumeChanged(target);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(medium.powderGrams > 0
            ? '💧 +' + addMl + 'ml de água. Proporção: 40g/L.'
            : '💧 +' + addMl + 'ml de água no Béquer (adicione o pó PDA quando quiser).');
        }
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
    if (ctx.hoveredSnapPot && ctx.heldItem && ctx.heldItem.potItem) {
      ctx.snapClosePot = ctx.hoveredSnapPot;
      commitHeldItemPlacement(ctx, ctx.hoveredSnapPot.mesh.position, true);
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('🍲 Tampa encaixada e travada na panela!');
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
      if (isBase && !hasBase && cp.waterMl > 4000) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('⚠️ Muita água na panela! Tire o excesso na pia antes de encaixar a Base Perfurada.');
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
        const slot = COOKER_SLOT_OFFSETS[nonBaseCount % COOKER_SLOT_OFFSETS.length];
        ctx.heldItem.mesh.position.set(potP.x + slot[0], potP.y + COOKER_SLOT_Y, potP.z + slot[1]);
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
      if (ctx.hoveredSprayTarget && ctx.hoveredSprayTarget.target && ctx.hoveredSprayTarget.target.monotubCtrl &&
          ctx.hoveredSprayTarget.target.monotubCtrl.colonization >= 100) {
        rehydrateMonotubCake(ctx, ctx.hoveredSprayTarget.target);
        return;
      }
      fireAlcoholSpray(ctx, ctx.hoveredSprayTarget);
      if (ctx.hoveredGreenhouseSlot) {
        ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
      }
      return;
    }
    if (ctx.heldItem.mesh.userData.isPaperTowel && !ctx.placementMode) {
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
    if (ctx.hoveredDehydratorTarget && !ctx.placementMode && ctx.heldItem.wildMushroomCtrl) {
      const targetDehyd = ctx.hoveredDehydratorTarget;
      const dc = targetDehyd.dehydratorCtrl;
      if (dc && !dc.hasMushroom) {
        const eatenItem = ctx.heldItem;
        const wm = eatenItem.wildMushroomCtrl;
        wm.removed = true;
        ctx.heldItem = null;
        if (eatenItem.mesh && eatenItem.mesh.parent) eatenItem.mesh.parent.remove(eatenItem.mesh);
        disposeObjectResources(eatenItem.mesh);
        const idx = ctx.pickableItems.indexOf(eatenItem);
        if (idx !== -1) ctx.pickableItems.splice(idx, 1);
        if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
          ctx.pickableMap.delete(eatenItem.id);
        }
        if (ctx.placementGhost) ctx.placementGhost.visible = false;
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
      }
      interactDehydrator(ctx, targetDehyd);
      if (window.MycoAudio) window.MycoAudio.playClick();
      ctx.notifyWorldAction();
      return;
    }
    if (ctx.hoveredSporePrintPetri && !ctx.placementMode && ctx.heldItem.wildMushroomCtrl) {
      const targetPetri = ctx.hoveredSporePrintPetri;
      const pc = targetPetri.mesh && targetPetri.mesh.userData && targetPetri.mesh.userData.petriCtrl;
      if (pc && !pc.lidOpen) {
        togglePetriLid(ctx, targetPetri);
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🧫 Tampa da Placa de Petri aberta! Clique novamente com o cogumelo para depositar o Carimbo de Esporos.');
        }
        return;
      }
      const spName = ctx.heldItem.wildMushroomCtrl.speciesName || 'Psilocybe cubensis';
      if (depositSporePrintOnPetri(targetPetri, spName)) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(`🍄 Carimbo de Esporos de ${spName} coletado na Placa de Petri! Pegue um ponto de esporos com o Bisturi no Fluxo Laminar para germinar!`);
        }
        ctx.notifyWorldAction();
      }
      return;
    }
    if (ctx.hoveredMonotubRackSlot && !ctx.placementMode && ctx.heldItem.monotubCtrl) {
      placeMonotubInLedRackSlot(ctx, ctx.hoveredMonotubRackSlot);
      return;
    }
    if (ctx.hoveredMonotubDunkSink && !ctx.placementMode && ctx.heldItem.monotubCtrl) {
      dunkMonotubAtSink(ctx, ctx.heldItem);
      return;
    }
    if (ctx.hoveredAlcoholLampTarget && !ctx.placementMode) {
      interactAlcoholLamp(ctx, ctx.hoveredAlcoholLampTarget);
      return;
    }
    if (ctx.hoveredMicroscopeTarget && !ctx.placementMode) {
      interactLabMicroscope(ctx);
      return;
    }
    if (ctx.hoveredSilicaJarTarget && !ctx.placementMode) {
      interactSilicaStorageJar(ctx, ctx.hoveredSilicaJarTarget);
      return;
    }
    if (ctx.hoveredMushroomBagPackTarget && !ctx.placementMode && ctx.heldItem.driedMushroomCtrl) {
      packDriedMushroomsIntoBag(ctx, ctx.hoveredMushroomBagPackTarget, ctx.heldItem);
      return;
    }
    if (ctx.hoveredDriedBatchForBag && !ctx.placementMode && ctx.heldItem.mushroomBagCtrl) {
      packDriedMushroomsIntoBag(ctx, ctx.heldItem, ctx.hoveredDriedBatchForBag);
      return;
    }
    if (ctx.hoveredMushroomBagSealTarget && !ctx.placementMode) {
      sealMushroomBag(ctx, ctx.hoveredMushroomBagSealTarget);
      return;
    }
    if (ctx.hoveredDeliveryCrateTarget && !ctx.placementMode && ctx.heldItem.mushroomBagCtrl) {
      addSealedBagToDeliveryCrate(ctx, ctx.hoveredDeliveryCrateTarget, ctx.heldItem);
      return;
    }
    if (ctx.hoveredRoadSaleStand && !ctx.placementMode) {
      interactRoadsideStand(ctx);
      return;
    }
    if (ctx.hoveredGardenTarget && !ctx.placementMode) {
      if (interactGardenTarget(ctx, ctx.hoveredGardenTarget)) return;
    }
    if (ctx.hoveredMonotubTarget && !ctx.placementMode) {
      interactMonotub(ctx, ctx.hoveredMonotubTarget);
      return;
    }
    if (ctx.hoveredHeatSealerTarget && (
        (ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.sealsBags) ||
        (ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.isBag))) {
      const target = ctx.hoveredHeatSealerTarget;
      if (canSealSpawnBag(target)) {
        target.spawnCtrl.sealed = true;
        target.spawnCtrl.updateVisual();
        if (ctx.hoveredHeatSealerObj && ctx.hoveredHeatSealerObj.sealerCtrl) {
          ctx.hoveredHeatSealerObj.sealerCtrl.triggerSealAnimation();
        } else if (ctx.pickableItems && target.mesh) {
          let bestSealer = null;
          let bestD = Infinity;
          for (let i = 0; i < ctx.pickableItems.length; i++) {
            const it = ctx.pickableItems[i];
            if (it && it.sealerCtrl && it.mesh) {
              const d = it.mesh.position.distanceToSquared(target.mesh.position);
              if (d < bestD) { bestD = d; bestSealer = it; }
            }
          }
          if (bestSealer) bestSealer.sealerCtrl.triggerSealAnimation();
        }
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
      if (tgt.mode === 'open' && tgt.item && tgt.item.spawnCtrl && tgt.item.spawnCtrl.isPP5) {
        togglePP5Lid(ctx, tgt.item);
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
      if (isContaminatedOrBurned(ctx.heldItem) && resetDisposableContainer(ctx.heldItem)) {
        triggerSinkStream(ctx.hoveredSink, 500);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🚰 Recipiente lavado na pia! Pronto para reesterilizar.');
        ctx.notifyWorldAction();
        return;
      }
      if (ctx.heldItem.bowlCtrl) {
        const bc = ctx.heldItem.bowlCtrl;
        const sinkAction = ctx.hoveredSinkAction || 'fill';
        if (bc.mixed) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🗑️ Receita já misturada! Descarte na lixeira.');
          return;
        }
        const totalG = Object.values(bc.ingredients).reduce((a, b) => a + b, 0);
        if (sinkAction === 'fill') {
          if (totalG < 600) {
            const add = Math.min(25, 600 - totalG);
            addIngredientToBowl(ctx.heldItem, 'water', add);
            ctx.sinkFilling = { sink: ctx.hoveredSink, item: ctx.heldItem, mode: 'fill', carryMl: 0, addedAny: true };
            triggerSinkStream(ctx.hoveredSink, 500);
            if (window.MycoAudio) window.MycoAudio.playSpray();
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
            ctx.notifyWorldAction();
          } else if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('💧 Pote de Mistura já está cheio (600g)!');
          }
        } else {
          if ((bc.ingredients.water || 0) > 0) {
            bc.ingredients.water = Math.max(0, (bc.ingredients.water || 0) - 25);
            bc.stirProgress = 0;
            updateMixingBowlLabel(ctx.heldItem);
            ctx.sinkFilling = { sink: ctx.hoveredSink, item: ctx.heldItem, mode: 'drain', carryMl: 0, addedAny: true };
            if (window.MycoAudio) window.MycoAudio.playSpray();
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
            ctx.notifyWorldAction();
          } else if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('🗑️ Só há ingredientes secos no pote; use a lixeira para descartar.');
          }
        }
        return;
      }
      const medium = ctx.heldItem.pdaMediumCtrl;
      const isPotHeld = ctx.cookerPots.some((cp) => cp.potItem === ctx.heldItem && !(cp.lidItem && cp.lidItem.isAttached));
      if (hasPdaContents(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente já contém ou processou meio PDA/BDA; use um recipiente limpo.');
        return;
      }
      if (!isPotHeld && !canFillFromSink(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ Este recipiente não pode ser preenchido pela pia.');
        return;
      }
      const sinkAction = ctx.hoveredSinkAction || 'fill';
      let sinkMode = sinkAction;
      let didStep = false;
      if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
        const lc = ctx.heldItem.mesh.userData.liquidCtrl;
        if (sinkAction === 'fill' && lc.volMl < lc.maxMl) {
          updateContainerVolume(ctx.heldItem, Math.min(lc.maxMl, lc.volMl + 35));
          if (medium) markPdaVolumeChanged(ctx.heldItem);
          didStep = true;
        } else if (sinkAction === 'drain' && lc.volMl > 0) {
          updateContainerVolume(ctx.heldItem, Math.max(0, lc.volMl - 45));
          if (medium) markPdaVolumeChanged(ctx.heldItem);
          didStep = true;
        }
      } else {
        for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
          const cp = ctx.cookerPots[cpi];
          if (cp.potItem === ctx.heldItem) {
            const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
            const potWaterCap = hasBase ? 4000 : 10000;
            if (sinkAction === 'fill' && cp.waterMl < potWaterCap) {
              cp.waterMl = Math.min(potWaterCap, cp.waterMl + 100);
              updateCookerWaterVisual(cp);
              didStep = true;
            } else if (sinkAction === 'drain' && cp.waterMl > 0) {
              cp.waterMl = Math.max(0, cp.waterMl - 120);
              updateCookerWaterVisual(cp);
              didStep = true;
            }
            break;
          }
        }
      }
      if (didStep) {
        ctx.sinkFilling = { sink: ctx.hoveredSink, item: ctx.heldItem, mode: sinkMode, carryMl: 0, addedAny: true };
        if (sinkMode === 'fill') triggerSinkStream(ctx.hoveredSink, 500);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        ctx.notifyWorldAction();
      } else if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast('💧 Recipiente já está vazio/cheio!');
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
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      const potWaterCap = hasBase ? 4000 : 10000;
      if (srcLc.volMl > 0 && cp.waterMl < potWaterCap) {
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
    if (ctx.hoveredScalpelTarget && ctx.hoveredScalpelTarget.mode === 'attach_blade_to_scalpel' && ctx.hoveredScalpelTarget.item && ctx.hoveredScalpelTarget.item.scalpelCtrl) {
      ctx.bladeAttachHold = { pack: ctx.heldItem, scalpel: ctx.hoveredScalpelTarget.item, progress: 0, soundAt: 0 };
      return;
    }
    if (ctx.hoveredScalpelTarget && ctx.heldItem.scalpelCtrl &&
        ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.transfersMycelium) {
      handleScalpelTargetAction(ctx);
      return;
    }
    if (ctx.hoveredCornScoopPot && ctx.heldItem.spawnCtrl && !ctx.heldItem.spawnCtrl.filled) {
      const cp = ctx.hoveredCornScoopPot;
      const takeG = Math.min(200, cp.grainGrams || 0);
      if (takeG > 0) {
        cp.grainGrams -= takeG;
        if (cp.grainGrams <= 0) { cp.grainGrams = 0; cp.grainCookSec = 0; cp.grainAlDente = false; }
        updateCookerWaterVisual(cp);
        const sc = ctx.heldItem.spawnCtrl;
        sc.filled = true;
        sc.substrateKind = 'grain';
        sc.fillGrams = takeG;
        sc.waterMl = 35;
        sc.updateVisual();
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌽 ' + ctx.heldItem.label + ' preenchido com Milho Ao Dente!');
        ctx.notifyWorldAction();
      }
      return;
    }
    if (ctx.hoveredGrainCooker && ctx.heldItem.id.indexOf('substrate_grain_') === 0) {
      const cp = ctx.hoveredGrainCooker;
      const addG = Math.min(500, 4000 - (cp.grainGrams || 0));
      if (addG > 0) {
        cp.grainGrams = (cp.grainGrams || 0) + addG;
        cp.grainAlDente = false;
        updateCookerWaterVisual(cp);
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌽 +' + addG + 'g de Milho na Panela (' + cp.grainGrams + '/4000g)! Ligue o fogão por 20m!');
        ctx.notifyWorldAction();
      }
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
    if (ctx.placementMode && ctx.placementGhost) {
      updateHeldItemPlacementPreview(ctx, ctx.inFps ? _vZero2 : ctx.pointerNdc);
      if (!ctx.placementValid || isPlacementBlocked(ctx.entityCtx, ctx.placementGhost.position)) {
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
      if (toggleHeldThermometer(ctx)) return;
      if (ctx.heldItem && ctx.heldItem.monotubCtrl) {
        interactMonotub(ctx, ctx.heldItem);
        return;
      }
      if (ctx.heldItem && ctx.heldItem.spawnCtrl && breakAndShakeSpawn(ctx, ctx.heldItem)) {
        return;
      }
      if (ctx.heldItem && ctx.heldItem.mesh.userData.isPetri) {
        togglePetriLid(ctx, ctx.heldItem);
        return;
      }
      if (ctx.heldItem && ctx.heldItem.id && ctx.heldItem.id.indexOf('gloves_box_') === 0) {
        toggleHeldGloves(ctx);
        return;
      }
    }
    if (!ctx.adminEditMode && !ctx.placementMode) {
      if (ctx.hoveredGreenhouseDevice) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks && ctx.callbacks.onOpenGreenhouseModal) {
          ctx.callbacks.onOpenGreenhouseModal(ctx.hoveredGreenhouseDevice);
        }
        return;
      }
      if (ctx.hoveredGreenhouseSlot) {
        ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
        return;
      }
    }
    if (!ctx.placementMode && tryPlaceHeldOnAimedSurface(ctx)) {
      return;
    }
    return;
  }
  if (!ctx.adminEditMode && ctx.hoveredRoadSaleStand) {
    interactRoadsideStand(ctx);
    return;
  }
  if (!ctx.adminEditMode && handleWorldInteraction(ctx)) return;
  if (ctx.hoveredPickable) {
    if (!ctx.adminEditMode && ctx.hoveredPickable.dehydratorCtrl) {
      interactDehydrator(ctx, ctx.hoveredPickable);
      return;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.microscopeCtrl) {
      interactLabMicroscope(ctx, ctx.hoveredPickable);
      return;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.monotubCtrl) {
      const mc = ctx.hoveredPickable.monotubCtrl;
      if ((!mc.spent && !mc.contaminated && mc.fruitingStage === 3) ||
          (mc.lidOpen && mc.hasSpawn && mc.hasBulk && (!mc.mixed || !mc.leveled))) {
        interactMonotub(ctx, ctx.hoveredPickable);
        return;
      }
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.fridgeCtrl) {
      const fridge = ctx.hoveredPickable;
      toggleCultureFridgeDoor(fridge);
      ctx.queueWorldStateChange(fridge.id, fridge.fridgeCtrl.doorOpen ? 1 : 0);
      if (window.MycoAudio) window.MycoAudio.playDoor(fridge.fridgeCtrl.doorOpen);
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(fridge.fridgeCtrl.doorOpen ? '🧊 Geladeira 4°C: Porta ABERTA' : '🧊 Geladeira 4°C: Porta FECHADA');
      }
      return;
    }
    pickUpTargetItem(ctx, ctx.hoveredPickable, !!ctx.adminEditMode);
  }
}

function pickUpTargetItem(ctx, targetItem, startPlacement) {
  if (!ctx || !targetItem) return false;
  if (!ctx.adminEditMode && targetItem.mesh.userData.isBlockedPickup && targetItem.mesh.userData.isBlockedPickup(targetItem)) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(targetItem.mesh.userData.isBurner
        ? '🚫 Retire a panela de cima antes de mover o Fogareiro'
        : '🚫 Retire os objetos de cima antes de mover ' + targetItem.label);
    }
    return false;
  }
  if (targetItem.potItem && targetItem.isAttached) {
    for (let cpLockIdx = 0; cpLockIdx < ctx.cookerPots.length; cpLockIdx++) {
      const cpLock = ctx.cookerPots[cpLockIdx];
      if (cpLock.lidItem === targetItem && cpLock.psi >= 1.5) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🔒 Tampa travada pela pressão (' + cpLock.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar (< 1.5 PSI).');
        }
        return false;
      }
    }
    const lidIt = targetItem;
    lidIt.isAttached = false;
    ctx.heldItem = lidIt;
    ctx.lastPickupAt = performance.now();
    setHeldTwoHandedGhost(ctx.heldItem, false);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    if (startPlacement) beginHeldItemPlacement(ctx);
    ctx.notifyWorldAction();
    return true;
  }
  if (targetItem.lidItem) {
    for (let cpPotIdx = 0; cpPotIdx < ctx.cookerPots.length; cpPotIdx++) {
      const cpPot = ctx.cookerPots[cpPotIdx];
      if (cpPot.potItem === targetItem && cpPot.psi >= 1.5) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🔒 Panela pressurizada (' + cpPot.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar.');
        }
        return false;
      }
    }
  }
  for (let cpIdx = 0; cpIdx < ctx.cookerPots.length; cpIdx++) {
    const cp = ctx.cookerPots[cpIdx];
    const idxInPot = cp.contents.indexOf(targetItem);
    if (idxInPot !== -1) {
      cp.contents.splice(idxInPot, 1);
      if (targetItem.mesh && targetItem.mesh.userData.isCookerBase) {
        cp.hasBase = cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      }
    }
  }
  targetItem.trayContents = null;
  if (ctx.adminEditMode && targetItem.mesh &&
      (targetItem.mesh.userData.dynamicSurface || targetItem.mesh.userData.dynamicSurfaces)) {
    const hostMesh = targetItem.mesh;
    hostMesh.updateMatrixWorld(true);
    const hRy = hostMesh.rotation.y || 0;
    const supported = getItemsSupportedBy(ctx, targetItem);
    if (supported.length > 0) {
      const carried = [];
      const _locVec = new THREE.Vector3();
      for (let si = 0; si < supported.length; si++) {
        const cand = supported[si];
        if (!cand || !cand.mesh) continue;
        cand.mesh.getWorldPosition(_locVec);
        hostMesh.worldToLocal(_locVec);
        carried.push({
          item: cand,
          localOffset: _locVec.clone(),
          localRotY: (cand.mesh.rotation.y || 0) - hRy
        });
      }
      targetItem.trayContents = carried.length ? carried : null;
    }
  } else if (targetItem.mesh && targetItem.mesh.userData.isTray) {
    const trayMesh = targetItem.mesh;
    trayMesh.updateMatrixWorld(true);
    const tRy = trayMesh.rotation.y;
    const carried = [];
    const _locVec = new THREE.Vector3();
    for (let ti = 0; ti < ctx.pickableItems.length; ti++) {
      const cand = ctx.pickableItems[ti];
      if (!cand || cand === targetItem || !cand.mesh || ctx.isHeldByRemote(cand.id)) continue;
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
    if (carried.length) targetItem.trayContents = carried;
  }
  ctx.heldItem = targetItem;
  cancelHeldItemPlacement(ctx);
  ctx.lastPickupAt = performance.now();
  ctx.heldRotY = ctx.heldItem.mesh.rotation.y;
  setHeldTwoHandedGhost(ctx.heldItem, true);
  if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
  if (startPlacement) {
    beginHeldItemPlacement(ctx);
  }
  ctx.notifyWorldAction();
  return true;
}

export function pickHoveredItemForMove(ctx, explicitItem) {
  if (!ctx || ctx.heldItem) return false;
  const target = explicitItem || ctx.hoveredPickable;
  if (!target) return false;
  return pickUpTargetItem(ctx, target, true);
}
