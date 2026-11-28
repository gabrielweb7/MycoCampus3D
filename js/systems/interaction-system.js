/**
 * Sistema de Interacoes de Itens e Mao (MycoCampus3D)
 * Coordenacao de pegar/soltar objetos, inoculacao, panela de pressao, borrifador,
 * termometro laser, lousa e delegacao de interacoes fixas do mundo e raycasting.
 */

import { t } from '../core/i18n.js';
import { interactBeehive } from '../entities/bee-ecology.js';
import { interactFlower, plantFlowerSeedAtSpot } from '../world/campus-flowers.js';
import { getHeldBoardToolColor, drawBoardSegment } from './chalkboard.js';
import { getItemGroundHeight } from '../engine/physics.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';
import {
  isPlacementBlocked,
  getPlacementBlockedReason
} from '../entities/placement-ghost.js';
import {
  beginHeldItemPlacement,
  beginVillageItemMove,
cancelHeldItemPlacement,
  commitHeldItemPlacement,
  findAimedHeldPlacement,
  placeHeldInCrate,
  setHeldTwoHandedGhost,
  updateHeldItemPlacementPreview
} from './held-item-placement.js';
import { triggerMagicCubensisEffect } from './mycoteca.js';
import { handleWildHarvest, handleWorldInteraction, isSeatOccupied } from './world-interactions.js';
import { removeCrateCargo } from './crate-cargo.js';
import { updateHoverRay, firstValidRayHit } from './hover-raycaster.js';
import { canFillFromSink, canSealSpawnBag, canSyringeSource, canSyringeTarget, disposeObjectResources, getItemKindId, hasPdaContents } from '../items/item-registry.js';
import { discardHeldLiquid } from './liquid-disposal.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { fireAlcoholSpray, fireH2O2Spray, fireWaterSpray } from '../items/alcohol-spray.js';
import { getContamInfo } from '../items/contaminations.js';
import { wipeWithPaperTowel } from '../items/paper-towel.js';
import { handleTrashDisposal, isContaminatedOrBurned, resetDisposableContainer } from '../items/lab-trash.js';
import { updateScalpelLabel } from '../items/scalpel.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { getSyringeInjectionDoseMl } from '../items/syringe.js';
import { updateCookerWaterVisual, COOKER_SLOT_OFFSETS, COOKER_SLOT_Y } from '../items/pressure-cooker.js';
import { interactDehydrator } from '../items/dehydrator.js';
import { getItemsSupportedBy } from './surface-group-move.js';
import { depositSporePrintOnPetri, fillPetriWithPda, sealPetriWithParafilm } from '../items/petri-dish.js';
import { canPlayerAccessLot } from '../world/house-upgrades.js';
import { interactMonotub, placeMonotubInLedRackSlot, rehydrateMonotubCake, dunkMonotubAtSink, treatMonotubWithH2O2 } from '../items/monotub.js';
import { isHoldingColonizedSpawn } from '../world/greenhouse.js';
import { installInGrow, openPortableGrowPanel, takeFromGrowSlot } from '../items/portable-grow.js';
import { isHoldingSpentCakeForCompost, interactGardenTarget } from '../world/campus-garden.js';
import { applyFoilWrap, applyMicroporeSeal, getSpawnContainerBaseLabel, canReceiveSpawnForFruiting, mixSpawnIntoFruitingBag, transferGrainToGrain, updateSpawnVisual } from '../items/spawn-containers.js';
import { updateLcNutrientLabel } from '../items/pda-bottle.js';
import {
  interactAlcoholLamp,
  interactLabMicroscope,
  interactSilicaStorageJar
} from '../items/lab-advanced-tools.js';
import {
  toggleAmpouleCaseLid,
  storeVialInAmpouleCase,
  openAmpouleCaseModal
} from '../items/ampoule-case.js';
import { packDriedMushroomsIntoBag, sealMushroomBag } from '../items/mushroom-packaging.js';
import { interactRoadsideStand } from '../world/roadside-stand.js';
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
    if (ctx.wearingGloves) ctx.fpsArmGroup.userData.handMat.color.setHex(0x09090b);
    else ctx.fpsArmGroup.userData.handMat.color.set(ctx.fpsArmGroup.userData.skinColor || '#fde68a');
    ctx.fpsArmGroup.userData.handMat.roughness = ctx.wearingGloves ? 0.35 : 0.65;
  }
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(t(ctx.wearingGloves
      ? 'actions.interact.gloves_on'
      : 'actions.interact.gloves_off'));
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
      ctx.callbacks.onToast(t('actions.interact.eat_magic', { species: wm.speciesName }));
    }
  } else if (ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(t('actions.interact.eat_normal', { species: wm.speciesName }));
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

function tryPlaceHeldOnAimedSurface(ctx, aimNdc) {
  const placement = findAimedHeldPlacement(ctx, aimNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc));
  if (!placement) return false;
  const { point, snapped } = placement;
  const label = ctx.heldItem.label || t('actions.common.item');
  if (!commitHeldItemPlacement(ctx, point, snapped && !!ctx.snapClosePot)) return false;
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks.onToast) ctx.callbacks.onToast(t(snapped ? 'actions.interact.placed_item' : 'actions.interact.placed_surface', { label }));
  return true;
}

export function dropHeldItem(ctx) {
  if (ctx.inventory?.pending) return false;
  if (!ctx.heldItem) return false;
  if (ctx.villageMove) return cancelHeldItemPlacement(ctx);
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
      ctx.callbacks.onToast(getPlacementBlockedReason() || t('actions.interact.drop_no_space'));
    }
    return false;
  }
  const droppedLabel = ctx.heldItem ? ctx.heldItem.label : t('actions.common.item');
  if (!commitHeldItemPlacement(ctx, chosenPt, false)) return false;
  if (ctx.callbacks.onToast) {
    ctx.callbacks.onToast(t('actions.interact.dropped_ground', { label: droppedLabel }));
  }
  return true;
}

export function handlePrimaryAction(ctx, aimNdc) {
  if (ctx.inventory?.pending) return false;
  if (!ctx.placementMode && ctx.hoveredHouseAction) {
    ctx.hoveredHouseAction.run();
    return true;
  }
  if (!ctx.placementMode && ctx.hoveredDoorObj) {
    const d = ctx.hoveredDoorObj;
    if (d.lotId && !canPlayerAccessLot(d.lotId)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('Apenas o morador ou pessoas com permissão no lote podem usar esta porta.');
      return true;
    }
    d.open = !d.open;
    ctx.queueWorldStateChange(d.id, d.open ? 1 : 0);
    if (window.MycoAudio) window.MycoAudio.playDoor(d.open);
    return true;
  }
  if (!ctx.placementMode && ctx.hoveredBlindObj) {
    const b = ctx.hoveredBlindObj;
    if (b.lotId && !canPlayerAccessLot(b.lotId)) {
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('Apenas o morador ou pessoas com permissão no lote podem usar esta persiana.');
      return true;
    }
    b.open = !b.open;
    if (window.MycoAudio) window.MycoAudio.playSwitch?.() || window.MycoAudio.playClick?.();
    ctx.queueWorldStateChange(b.id, b.open ? 1 : 0);
    return true;
  }
  if (ctx.heldItem) {
    if (performance.now() - ctx.lastPickupAt < 140) return;
    if (ctx.placementMode) {
      if (!ctx.placementGhost) return;
      if (!updateHeldItemPlacementPreview(ctx, aimNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc)) || !ctx.placementValid) return false;
      if (ctx.cratePlacementTarget) return placeHeldInCrate(ctx, ctx.cratePlacementTarget);
      return commitHeldItemPlacement(ctx, ctx.placementGhost.position, true);
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable?.growCtrl && installInGrow(ctx, ctx.hoveredPickable)) return true;
    if (ctx.hoveredBeehive) return interactBeehive(ctx, ctx.hoveredBeehive);
    if (ctx.hoveredFlower) return interactFlower(ctx, ctx.hoveredFlower);
    if (ctx.hoveredFlowerPlantSpot && ctx.heldItem.flowerSeedCtrl) return plantFlowerSeedAtSpot(ctx, ctx.hoveredFlowerPlantSpot);
    if (ctx.hoveredDoorObj) {
      ctx.hoveredDoorObj.open = !ctx.hoveredDoorObj.open;
      ctx.queueWorldStateChange(ctx.hoveredDoorObj.id, ctx.hoveredDoorObj.open ? 1 : 0);
      if (window.MycoAudio) window.MycoAudio.playDoor(ctx.hoveredDoorObj.open);
      return true;
    }
    if (ctx.hoveredPdaTarget) {
      const target = ctx.hoveredPdaTarget;
      if (ctx.heldItem.pdaReagentCtrl) {
        const result = addPdaPowder(ctx.heldItem, target);
        if (result.ok) {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pda_added', { grams: PDA_POWDER_DOSE_GRAMS }));
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
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pda_already_processed'));
          return;
        }
        const expectedMl = medium.powderGrams > 0 ? (medium.powderGrams * 1000 / PDA_GRAMS_PER_LITER) : targetLiquid.maxMl;
        const addMl = medium.powderGrams > 0
          ? Math.min(sourceLiquid.volMl, targetLiquid.maxMl - targetLiquid.volMl, expectedMl - targetLiquid.volMl)
          : Math.min(100, sourceLiquid.volMl, targetLiquid.maxMl - targetLiquid.volMl);
        if (addMl <= 0) {
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast(t(medium.powderGrams > 0
              ? 'actions.interact.pda_ratio_complete'
              : 'actions.interact.container_full'));
          }
          return;
        }
        updateContainerVolume(ctx.heldItem, sourceLiquid.volMl - addMl);
        updateContainerVolume(target, targetLiquid.volMl + addMl);
        markPdaVolumeChanged(target);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t(medium.powderGrams > 0
            ? 'actions.interact.pda_water_added_ratio'
            : 'actions.interact.pda_water_added_beaker', { ml: addMl }));
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
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pot_lid_locked'));
      return;
    }
    if (ctx.hoveredPotInsert && ctx.heldItem && !ctx.heldItem.mesh.userData.twoHanded) {
      const cp = ctx.hoveredPotInsert;
      const isBase = !!(ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isCookerBase);
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      if (!isBase && !hasBase) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.pot_need_base'));
        }
        return;
      }
      if (isBase && hasBase) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.pot_has_base'));
        }
        return;
      }
      if (isBase && !hasBase && cp.waterMl > 4000) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.pot_too_much_water'));
        }
        return;
      }
      if (ctx.heldItem.mesh.userData.petriCtrl?.lidOpen) {
        ctx.callbacks.onToast?.(t('actions.interact.pot_close_petri_lid'));
        return;
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
    if (ctx.heldItem.mesh.userData.isH2O2Spray && !ctx.placementMode && ctx.hoveredH2O2Target?.target) {
      const hTarget = ctx.hoveredH2O2Target;
      fireH2O2Spray(ctx, hTarget);
      if (ctx.hoveredGreenhouseSlot) {
        ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
      } else if (hTarget && hTarget.target && hTarget.target.monotubCtrl) {
        treatMonotubWithH2O2(ctx, hTarget.target);
        ctx.notifyWorldAction();
      } else if (hTarget && hTarget.target && hTarget.target.spawnCtrl) {
        const sc = hTarget.target.spawnCtrl;
        if (sc.contaminated) {
          const info = getContamInfo(sc.contamKind || 'trichoderma');
          if (info.curableWithH2O2) {
            sc.contaminated = false;
            sc.contamKind = null;
            updateSpawnVisual(hTarget.target);
            if (ctx.callbacks.onToast) {
              ctx.callbacks.onToast(t('actions.interact.h2o2_cobweb_cured', { label: hTarget.target.label }));
            }
            ctx.notifyWorldAction();
          } else if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast(t('actions.interact.h2o2_not_curable', { name: info.name }));
          }
        } else if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.h2o2_preventive', { label: hTarget.target.label }));
        }
      } else if (hTarget && hTarget.target && hTarget.target.cultureCtrl) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.h2o2_lc_warn'));
        }
      }
      return;
    }
    if (ctx.heldItem.mesh.userData.isWaterSpray && !ctx.placementMode && ctx.hoveredSprayTarget?.target) {
      fireWaterSpray(ctx, ctx.hoveredSprayTarget);
      if (ctx.hoveredSprayTarget && ctx.hoveredSprayTarget.target && ctx.hoveredSprayTarget.target.monotubCtrl &&
          ctx.hoveredSprayTarget.target.monotubCtrl.colonization >= 100) {
        rehydrateMonotubCake(ctx, ctx.hoveredSprayTarget.target);
        return;
      }
      if (ctx.hoveredGreenhouseSlot) {
        ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
        return;
      }
      if (ctx.hoveredSprayTarget && ctx.hoveredSprayTarget.target && ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t('actions.interact.water_spray_hint'));
      } else if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t('actions.interact.water_spray_aim'));
      }
      return;
    }
    if (ctx.heldItem.mesh.userData.isAlcoholSpray && !ctx.placementMode && ctx.hoveredSprayTarget?.target) {
      if (ctx.hoveredSprayTarget && ctx.hoveredSprayTarget.target && ctx.hoveredSprayTarget.target.monotubCtrl) {
        const mc = ctx.hoveredSprayTarget.target.monotubCtrl;
        if (mc.colonization >= 100 && !mc.spent && !mc.contaminated) {
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast(t('actions.interact.alcohol_monotub_warn'));
          }
          return;
        }
      }
      if (ctx.hoveredGreenhouseSlot && !ctx.hoveredGreenhouseSlot.empty) {
        ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
        return;
      }
      fireAlcoholSpray(ctx, ctx.hoveredSprayTarget);
      return;
    }
    if (ctx.heldItem.mesh.userData.isPaperTowel && !ctx.placementMode && ctx.hoveredWipeTarget?.target) {
      wipeWithPaperTowel(ctx, ctx.hoveredWipeTarget);
      return;
    }
    if (ctx.hoveredParafilmTarget && !ctx.placementMode && ctx.heldItem.mesh.userData.isParafilm) {
      const target = ctx.hoveredParafilmTarget;
      const pc = target.mesh && target.mesh.userData && target.mesh.userData.petriCtrl;
      if (pc && pc.lidOpen) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.parafilm_close_lid'));
      } else if (pc && pc.parafilmSealed) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.parafilm_already_sealed'));
      } else if (pc && pc.mode === 'bare') {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.parafilm_need_pda'));
      } else if (sealPetriWithParafilm(target)) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.parafilm_sealed'));
        ctx.notifyWorldAction();
      }
      return;
    }
    if (ctx.hoveredFoilTarget && !ctx.placementMode && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isFoilRoll) {
      const fTarget = ctx.hoveredFoilTarget;
      if (applyFoilWrap(fTarget)) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.foil_wrapped'));
        ctx.notifyWorldAction();
      }
      return;
    }
    if (ctx.hoveredMicroporeTarget && !ctx.placementMode && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isMicropore) {
      const mTarget = ctx.hoveredMicroporeTarget;
      const pc = mTarget.mesh && mTarget.mesh.userData && mTarget.mesh.userData.petriCtrl;
      if (pc) {
        if (pc.lidOpen) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.micropore_close_lid'));
          return;
        }
        if (pc.mode === 'bare') {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.parafilm_need_pda'));
          return;
        }
        if (sealPetriWithParafilm(mTarget)) {
          mTarget.microporeSealed = true;
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.micropore_petri'));
          ctx.notifyWorldAction();
        }
      } else if (applyMicroporeSeal(mTarget)) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.micropore_filter'));
        ctx.notifyWorldAction();
      }
      return;
    }
    if (ctx.hoveredLcNutrientTarget && !ctx.placementMode && ctx.heldItem.lcNutrientCtrl) {
      const nCtrl = ctx.heldItem.lcNutrientCtrl;
      const dst = ctx.hoveredLcNutrientTarget;
      const dstLc = dst.mesh && dst.mesh.userData && dst.mesh.userData.liquidCtrl;
      if (!dstLc || dstLc.volMl < 50) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.lc_nutrient_need_water'));
        return;
      }
      if (dst.cultureCtrl && (dst.cultureCtrl.inoculated || dst.cultureCtrl.colonized || dst.cultureCtrl.contaminated)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.lc_nutrient_before_inoc'));
        return;
      }
      const doseG = Math.max(2, Math.round(dstLc.volMl * 0.04));
      if (nCtrl.remainingGrams < doseG) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.lc_nutrient_empty'));
        return;
      }
      nCtrl.remainingGrams -= doseG;
      if (dst.cultureCtrl) {
        dst.cultureCtrl.hasNutrient = true;
        dst.cultureCtrl.sterilized = false;
      }
      dstLc.sterilized = false;
      dst.sterilized = false;
      updateLcNutrientLabel(ctx.heldItem);
      if (typeof dst.setVolume === 'function') dst.setVolume(dstLc.volMl);
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.lc_nutrient_added', { dose: doseG, vol: dstLc.volMl }));
      ctx.notifyWorldAction();
      return;
    }
    if (ctx.hoveredG2GTarget && !ctx.placementMode && ctx.heldItem.spawnCtrl) {
      if (canReceiveSpawnForFruiting(ctx.hoveredG2GTarget)) {
        if (mixSpawnIntoFruitingBag(ctx, ctx.heldItem, ctx.hoveredG2GTarget)) {
          window.MycoAudio?.playClick?.();
          ctx.callbacks?.onToast?.(t('grow.bag_shake'));
        }
        return true;
      }
      const res = transferGrainToGrain(ctx, ctx.heldItem, ctx.hoveredG2GTarget);
      if (res && res.ok) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.g2g_ok', { rem: res.remainingUses }));
        ctx.notifyWorldAction();
      } else if (res && res.reason === 'g2g_exhausted') {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.g2g_exhausted'));
      } else {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.g2g_contam'));
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
      interactDehydrator(ctx, targetDehyd, ctx.heldItem);
      if (window.MycoAudio) window.MycoAudio.playClick();
      return;
    }
    if (ctx.hoveredSporePrintPetri && !ctx.placementMode && ctx.heldItem.wildMushroomCtrl) {
      const targetPetri = ctx.hoveredSporePrintPetri;
      const pc = targetPetri.mesh && targetPetri.mesh.userData && targetPetri.mesh.userData.petriCtrl;
      if (pc && !pc.lidOpen) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.spore_print_open_petri'));
        }
        return;
      }
      const spName = ctx.heldItem.wildMushroomCtrl.speciesName || 'Psilocybe cubensis';
      if (depositSporePrintOnPetri(targetPetri, spName)) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.spore_print_collected', { species: spName }));
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
    if (ctx.hoveredAmpouleCaseTarget && !ctx.placementMode && ctx.heldItem.vial3mlCtrl) {
      storeVialInAmpouleCase(ctx, ctx.hoveredAmpouleCaseTarget, ctx.heldItem);
      return;
    }
    if (ctx.hoveredAmpouleCaseTarget && !ctx.placementMode && ctx.heldItem.mesh?.userData?.isSyringe) {
      openAmpouleCaseModal(ctx, ctx.hoveredAmpouleCaseTarget);
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
      placeHeldInCrate(ctx, ctx.hoveredDeliveryCrateTarget);
      return;
    }
    if (ctx.hoveredRoadSaleStand && !ctx.placementMode) {
      interactRoadsideStand(ctx);
      return;
    }
    if (ctx.hoveredGardenTarget?.type === 'compost_box' && !ctx.placementMode && isHoldingSpentCakeForCompost(ctx.heldItem)) {
      if (interactGardenTarget(ctx, ctx.hoveredGardenTarget)) return;
    }
    if (ctx.hoveredMonotubTarget && !ctx.placementMode) {
      const tub = ctx.hoveredMonotubTarget;
      if (tub.monotubCtrl.colonization < 100 && !tub.monotubCtrl.lidOpen) {
        ctx.callbacks.onToast?.(t('actions.interact.monotub_open_first'));
        return;
      }
      interactMonotub(ctx, tub);
      return;
    }
    if (ctx.hoveredHeatSealerTarget && (
        (ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.sealsBags) ||
        (ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.isBag))) {
      const target = ctx.hoveredHeatSealerTarget;
      if (canSealSpawnBag(target)) {
        target.spawnCtrl.sealed = true;
        target.spawnCtrl.updateVisual();
        ctx.queueItemStateSync?.(target);
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
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.bag_sealed'));
        ctx.notifyWorldAction();
      } else if (ctx.callbacks.onToast) {
        const sc = target.spawnCtrl;
        const reason = t(!sc.filled ? 'actions.interact.seal_reason_fill'
          : (sc.sealed ? 'actions.interact.seal_reason_already'
            : (sc.sterilized || sc.inoculated ? 'actions.interact.seal_reason_processed'
              : (sc.burned ? 'actions.interact.seal_reason_burned' : 'actions.interact.seal_reason_contam'))));
        ctx.callbacks.onToast(t('actions.interact.seal_failed', { reason }));
      }
      return;
    }
    if (ctx.hoveredSyringeTarget && ctx.heldItem.mesh.userData.isSyringe &&
        ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.transfersLiquidCulture) {
      const syrCtrl = ctx.heldItem.mesh.userData.syrCtrl;
      const tgt = ctx.hoveredSyringeTarget;
      if (ctx.syringePumping) return;
      if (tgt.mode === 'open') {
        ctx.callbacks.onToast?.(t('actions.lab.open_lid_aimed'));
        return;
      }
      if (tgt.mode !== 'draw' && tgt.mode !== 'inject') return;
      if (tgt.mode === 'draw' && !canSyringeSource(tgt.item)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.syringe_draw_unavailable'));
        return;
      }
      if (tgt.mode === 'draw' && tgt.item && tgt.item.cultureCtrl && tgt.item.cultureCtrl.expired) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.syringe_lc_expired'));
        return;
      }
      if (tgt.mode === 'inject' && !canSyringeTarget(tgt.item)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.syringe_target_not_ready'));
        return;
      }
      const fromVol = syrCtrl.volMl;
      const isPetriInjection = tgt.mode === 'inject' && tgt.item && tgt.item.mesh.userData.isPetri;
      const isPP5Injection = tgt.mode === 'inject' && tgt.item && tgt.item.spawnCtrl && tgt.item.spawnCtrl.isPP5;
      if ((isPetriInjection || isPP5Injection) && (fromVol < 1 || !(syrCtrl.mix?.lcMl > 0.05))) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.syringe_need_1ml'));
        return;
      }
      const dstCulture = tgt.item.cultureCtrl;
      const dstLiquid = tgt.item.mesh.userData.liquidCtrl;
      if (tgt.mode === 'inject' && syrCtrl.mix?.honeyMl > 0.05 && (!dstLiquid || tgt.item.spawnCtrl)) {
        ctx.callbacks.onToast?.(t('actions.hive.honey_syringe_glass'));
        return;
      }
      if (tgt.mode === 'inject' && syrCtrl.mix?.lcMl > 0.05 && dstCulture &&
          !dstCulture.inoculated && !dstCulture.colonized && !dstCulture.contaminated &&
          (dstCulture.hasNutrient === false || dstLiquid?.volMl <= 0)) {
        ctx.callbacks.onToast?.(t('actions.held.syringe_prepare_broth'));
        return;
      }
      const doseMl = tgt.mode === 'inject' ? getSyringeInjectionDoseMl(tgt.item, fromVol) : 0;
      const sourceVol = tgt.mode === 'draw' && tgt.item && tgt.item.mesh.userData.liquidCtrl
        ? tgt.item.mesh.userData.liquidCtrl.volMl
        : 0;
      const toVol = tgt.mode === 'draw'
        ? Math.min(10, Math.round((fromVol + sourceVol) * 10) / 10)
        : Math.max(0, Math.round((fromVol - doseMl) * 10) / 10);
      if (Math.abs(toVol - fromVol) < 0.01) return;

      const isHoldLiquidPump = !!(tgt.mode === 'draw' || (tgt.item && tgt.item.mesh && tgt.item.mesh.userData.liquidCtrl && !tgt.item.spawnCtrl));
      ctx.syringePumping = {
        target: tgt,
        fromVol: fromVol,
        toVol: toVol,
        amountMl: doseMl,
        holdMode: isHoldLiquidPump,
        duration: isHoldLiquidPump ? Math.max(0.5, Math.abs(toVol - fromVol) / 4.5) : 2.0,
        elapsed: 0,
        startJarVol: (tgt.item && tgt.item.mesh && tgt.item.mesh.userData.liquidCtrl) ? tgt.item.mesh.userData.liquidCtrl.volMl : 0
      };
      return;
    }
    if (ctx.hoveredPetBowl && ctx.heldItem?.petFoodBagCtrl) {
      const bag = ctx.heldItem.petFoodBagCtrl;
      const bw = ctx.hoveredPetBowl.petBowlCtrl;
      const space = bw.maxGrams - bw.grams;
      if (bag.grams > 0 && space > 0) {
        const dose = Math.min(100, bag.grams, space);
        bag.grams -= dose;
        bw.grams += dose;
        bag.updateVisual?.();
        bw.updateVisual?.();
        window.MycoAudio?.playClick?.();
        ctx.queueItemStateSync?.(ctx.heldItem);
        ctx.queueItemStateSync?.(ctx.hoveredPetBowl);
        ctx.callbacks?.onToast?.(`🥣 Colocou ${Math.round(dose)}g de ração no potinho!`);
        ctx.notifyWorldAction();
      }
      return true;
    }
    if (ctx.hoveredSink) {
      if (ctx.hoveredSinkAction === 'drain') {
        discardHeldLiquid(ctx, ctx.hoveredSink);
        return;
      }
      if (isContaminatedOrBurned(ctx.heldItem) && resetDisposableContainer(ctx.heldItem)) {
        triggerSinkStream(ctx.hoveredSink, 500);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.sink_washed'));
        ctx.notifyWorldAction();
        return;
      }
      if (ctx.heldItem.bowlCtrl) {
        const bc = ctx.heldItem.bowlCtrl;
        const sinkAction = ctx.hoveredSinkAction || 'fill';
        if (bc.mixed) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.sink_bowl_mixed'));
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
            ctx.callbacks.onToast(t('actions.interact.sink_bowl_full'));
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
            ctx.callbacks.onToast(t('actions.interact.sink_bowl_dry_only'));
          }
        }
        return;
      }
      if (ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.filled && ctx.heldItem.spawnCtrl.hydrated === false &&
          !ctx.heldItem.spawnCtrl.sterilized && !ctx.heldItem.spawnCtrl.inoculated) {
        const sc = ctx.heldItem.spawnCtrl;
        if ((sc.waterMl || 0) < 80) {
          sc.waterMl = Math.min(80, (sc.waterMl || 0) + 30);
          if (sc.waterMl >= 60) sc.hydrated = true;
          sc.updateVisual();
          ctx.sinkFilling = { sink: ctx.hoveredSink, item: ctx.heldItem, mode: 'fill', carryMl: 0, addedAny: true };
          triggerSinkStream(ctx.hoveredSink, 500);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
          ctx.notifyWorldAction();
        } else if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.sink_grains_hydrated'));
        }
        return;
      }
      const medium = ctx.heldItem.pdaMediumCtrl;
      const isPotHeld = ctx.cookerPots.some((cp) => cp.potItem === ctx.heldItem && !(cp.lidItem && cp.lidItem.isAttached));
      if (hasPdaContents(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.sink_pda_blocked'));
        return;
      }
      if (!isPotHeld && !canFillFromSink(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.sink_cannot_fill'));
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
            const potWaterCap = hasBase ? 4000 : 15000;
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
        ctx.callbacks.onToast(t('actions.interact.sink_empty_or_full'));
      }
      return;
    }
    if (ctx.hoveredFillPot && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
      const sourceCanPourWater = ctx.heldItem.meta && ctx.heldItem.meta.compatibilities &&
        ctx.heldItem.meta.compatibilities.poursWater;
      if (!sourceCanPourWater || hasPdaContents(ctx.heldItem)) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pot_water_only'));
        return;
      }
      const srcLc = ctx.heldItem.mesh.userData.liquidCtrl;
      const cp = ctx.hoveredFillPot;
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      const potWaterCap = hasBase ? 4000 : 15000;
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
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_cannot_source'));
        return;
      }
      const dstPetri = dstItem.mesh && dstItem.mesh.userData.petriCtrl;
      const petriAcceptsPda = !!(dstItem.meta && dstItem.meta.compatibilities &&
        dstItem.meta.compatibilities.acceptsPdaMedium);
      if (sourceHasPda && petriAcceptsPda && dstPetri && dstPetri.mode === 'bare') {
        if (!dstPetri.lidOpen) {
          ctx.callbacks.onToast?.(t('actions.interact.pour_petri_open_first'));
          return;
        }
        if (!isAsepticWorkArea(ctx, dstItem)) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_petri_need_hood'));
          return;
        }
        if (srcLc.volMl < 20) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_petri_need_20ml'));
          return;
        }
        if (srcPda.burned || !srcPda.mixed || !isPdaRecipeBalanced(srcPda, srcLc.volMl)) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_petri_need_ratio'));
          return;
        }
        const pourAmt = 20;
        const sourceVolumeMl = srcLc.volMl;
        const transferredGrams = srcPda.powderGrams * pourAmt / sourceVolumeMl;
        srcPda.powderGrams = Math.max(0, srcPda.powderGrams - transferredGrams);
        updateContainerVolume(ctx.heldItem, sourceVolumeMl - pourAmt);
        updatePdaMediumVisual(ctx.heldItem);
        const sterilePourTek = !!srcPda.sterilized;
        fillPetriWithPda(dstItem, sterilePourTek);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(sterilePourTek
            ? t('actions.interact.pour_petri_sterile_ok')
            : t('actions.interact.pour_petri_unsterile_ok', { ml: pourAmt }));
        }
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
      if (dstItem.spawnCtrl && !dstItem.spawnCtrl.isPP5 && dstItem.spawnCtrl.filled &&
          dstItem.spawnCtrl.hydrated === false && !sourceHasPda && sourceCanPourWater) {
        if (srcLc.volMl > 0) {
          ctx.pourHold = { kind: 'spawn_hydrate', src: ctx.heldItem, dst: dstItem, carry: 0, any: false, soundAt: 0, dropAt: 0 };
          if (window.MycoAudio) window.MycoAudio.playSpray();
        }
        return;
      }
      if (dstLc) {
        if (sourceHasPda) {
          const dstPda = dstItem.pdaMediumCtrl;
          if (srcPda.burned || !srcPda.mixed || !isPdaRecipeBalanced(srcPda, srcLc.volMl)) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_pda_need_ratio'));
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
            if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_pda_invalid_dest'));
            return;
          }
          if (srcPda.sterilized && dstPda.kind !== 'media_bottle' && !isAsepticWorkArea(ctx, dstItem)) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_tek_need_hood'));
            return;
          }
          if (dstPda.burned || dstPda.sterilized) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_pda_clean_dest'));
            return;
          }
          if (dstLc.volMl > 0 && dstPda.powderGrams <= 0) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_slant_empty_tube'));
            return;
          }
          const stepAmt = dstLc.maxMl <= 15 ? 15 : 250;
          const pourAmt = Math.min(srcLc.volMl, stepAmt, dstLc.maxMl - dstLc.volMl);
          if (pourAmt > 0) {
            const sourceVolMl = srcLc.volMl;
            updateContainerVolume(ctx.heldItem, sourceVolMl - pourAmt);
            updateContainerVolume(dstItem, dstLc.volMl + pourAmt);
            transferPdaGrams(ctx.heldItem, dstItem, pourAmt, sourceVolMl);
            const sterilePourTek = !!(srcPda.sterilized && dstPda.kind !== 'media_bottle');
            if (dstPda.kind === 'pp5') {
              preparePP5ForPda(dstItem);
              if (sterilePourTek) {
                dstPda.sterilized = true;
                dstItem.spawnCtrl.sterilized = true;
                dstItem.spawnCtrl.sterilizeProgress = 100;
              }
              updatePdaMediumVisual(dstItem);
              dstItem.spawnCtrl.updateVisual();
            } else if (sterilePourTek) {
              dstPda.sterilized = true;
              updatePdaMediumVisual(dstItem);
            }
            if (window.MycoAudio) window.MycoAudio.playSpray();
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
            if (ctx.callbacks.onToast) {
              ctx.callbacks.onToast(t(sterilePourTek
                ? 'actions.interact.pour_pda_sterile_ok'
                : 'actions.interact.pour_pda_unsterile_ok', { label: dstItem.label }));
            }
            ctx.notifyWorldAction();
          }
          return;
        }

        const receivesWater = dstItem.meta && dstItem.meta.compatibilities &&
          dstItem.meta.compatibilities.receivesWater;
        if (!receivesWater) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_cannot_receive_water'));
          return;
        }
        const destinationHasPda = hasPdaContents(dstItem);
        if (destinationHasPda && !sourceHasPda) {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_no_dilute_pda'));
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
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_no_pda_in_bowl'));
          return;
        }
        const pourAmt = Math.min(srcLc.volMl, 50);
        if (pourAmt > 0) {
          updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
          addIngredientToBowl(dstItem, 'water', pourAmt);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.pour_bowl_water', { ml: pourAmt }));
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
        sc.hydrated = true;
        sc.substrateKind = cp.grainKind || 'grain';
        sc.fillGrams = takeG;
        sc.waterMl = 35;
        sc.baseLabel = getSpawnContainerBaseLabel(sc.isBag, sc.isPP5, sc.substrateKind, true);
        sc.updateVisual();
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.grain_scooped', { label: ctx.heldItem.label }));
        ctx.notifyWorldAction();
      }
      return;
    }
    const heldKind = getItemKindId(ctx.heldItem);
    if (ctx.hoveredGrainCooker && /^substrate_(grain|wheat|sorghum)(?:_|$)/.test(heldKind)) {
      const cp = ctx.hoveredGrainCooker;
      const gKind = heldKind.startsWith('substrate_wheat') ? 'wheat' : (heldKind.startsWith('substrate_sorghum') ? 'sorghum' : 'grain');
      const addG = Math.min(500, 4000 - (cp.grainGrams || 0));
      if (addG > 0) {
        cp.grainGrams = (cp.grainGrams || 0) + addG;
        cp.grainKind = gKind;
        cp.grainAlDente = false;
        updateCookerWaterVisual(cp);
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.grain_added_pot', { add: addG, total: cp.grainGrams }));
        ctx.notifyWorldAction();
      }
      return;
    }
    if (ctx.hoveredGrainTarget && heldKind.startsWith('substrate_')) {
      handleSubstrateTargetAction(ctx);
      return;
    }
    if (ctx.hoveredFridgeTarget && ctx.heldItem) {
      const fridgeTarget = ctx.hoveredFridgeTarget;
      if (!fridgeTarget.fridge.fridgeCtrl.doorOpen) {
        ctx.callbacks.onToast?.(t('actions.interact.fridge_open_before_store'));
        return;
      }
      if (!fridgeTarget.slotPosition) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.fridge_no_space'));
        return;
      }
      if (fridgeTarget.lidOpen) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.interact.fridge_close_petri'));
        return;
      }
      commitHeldItemPlacement(ctx, fridgeTarget.slotPosition, false);
      ctx.queueWorldStateChange(fridgeTarget.fridge.id, fridgeTarget.fridge.fridgeCtrl.doorOpen ? 1 : 0);
      return;
    }
    if (!ctx.adminEditMode && !ctx.placementMode && ctx.hoveredGreenhouseSlot && isHoldingColonizedSpawn(ctx.heldItem)) {
      ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
      return;
    }
    if (!ctx.adminEditMode && ctx.heldItem.deliveryCrateCtrl && handleWildHarvest(ctx)) return true;
    if (ctx.hoveredCratePlacement) return placeHeldInCrate(ctx, ctx.hoveredCratePlacement);
    if (!ctx.placementMode && tryPlaceHeldOnAimedSurface(ctx, aimNdc)) return;
    if (!ctx.placementMode && ctx.heldItem?.mesh.userData.isAlcoholSpray) fireAlcoholSpray(ctx, null);
    return;
  }
  if (!ctx.adminEditMode && ctx.hoveredRoadSaleStand) {
    interactRoadsideStand(ctx);
    return;
  }
  if (!ctx.adminEditMode && handleWorldInteraction(ctx)) return;
  if (ctx.hoveredPickable) {
    if (!ctx.adminEditMode && ctx.hoveredPickable.growCtrl) {
      if (ctx.hoveredGrowSlot != null) return takeFromGrowSlot(ctx, ctx.hoveredPickable, ctx.hoveredGrowSlot);
      openPortableGrowPanel(ctx, ctx.hoveredPickable);
      return true;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.dehydratorCtrl) {
      interactDehydrator(ctx, ctx.hoveredPickable);
      return;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.silicaJarCtrl && ctx.hoveredPickable.silicaJarCtrl.storedGrams > 0) {
      interactSilicaStorageJar(ctx, ctx.hoveredPickable);
      return;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.microscopeCtrl) {
      interactLabMicroscope(ctx, ctx.hoveredPickable);
      return;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.monotubCtrl) {
      interactMonotub(ctx, ctx.hoveredPickable);
      return;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.caseCtrl) {
      const cItem = ctx.hoveredPickable;
      if (!cItem.caseCtrl.lidOpen) {
        toggleAmpouleCaseLid(ctx, cItem, true);
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.case_opened'));
        }
      } else {
        openAmpouleCaseModal(ctx, cItem);
      }
      return;
    }
    if (!ctx.adminEditMode && ctx.hoveredPickable.fridgeCtrl) {
      const fridge = ctx.hoveredPickable;
      toggleCultureFridgeDoor(fridge);
      ctx.queueWorldStateChange(fridge.id, fridge.fridgeCtrl.doorOpen ? 1 : 0);
      if (window.MycoAudio) window.MycoAudio.playDoor(fridge.fridgeCtrl.doorOpen);
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t(fridge.fridgeCtrl.doorOpen ? 'actions.interact.fridge_opened' : 'actions.interact.fridge_closed'));
      }
      return;
    }
    pickUpTargetItem(ctx, ctx.hoveredPickable, !!ctx.adminEditMode);
  }
}

function pickUpTargetItem(ctx, targetItem, startPlacement) {
  if (ctx.inventory?.pending) return false;
  if (!ctx || !targetItem || targetItem.isReadOnly) return false;
  if (targetItem.crateParent && (targetItem.crateParent.isReadOnly || ctx.isHeldByRemote(targetItem.crateParent.id))) return false;
  if (!ctx.adminEditMode && targetItem.mesh.userData.isBlockedPickup && targetItem.mesh.userData.isBlockedPickup(targetItem)) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(targetItem.mesh.userData.isBurner
        ? t('actions.hover.blocked_burner')
        : t('actions.hover.blocked_item', { label: targetItem.label }));
    }
    return false;
  }
  if (targetItem.potItem && targetItem.isAttached) {
    for (let cpLockIdx = 0; cpLockIdx < ctx.cookerPots.length; cpLockIdx++) {
      const cpLock = ctx.cookerPots[cpLockIdx];
      if (cpLock.lidItem === targetItem && cpLock.psi >= 1.5) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.interact.pot_lid_pressurized', { psi: cpLock.psi.toFixed(1) }));
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
          ctx.callbacks.onToast(t('actions.interact.pot_pressurized', { psi: cpPot.psi.toFixed(1) }));
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
  removeCrateCargo(ctx, targetItem, true);
  if (!targetItem.deliveryCrateCtrl) targetItem.trayContents = null;
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
      if (Math.abs(_locVec.x) <= 0.26 && Math.abs(_locVec.z) <= 0.20 &&
        _locVec.y >= -0.05 && _locVec.y <= 0.42) {
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

export function pickHoveredItemForMove(ctx, explicitItem, startPlacement = true) {
  if (!ctx || ctx.heldItem) return false;
  const target = explicitItem || ctx.hoveredPickable;
  if (!target) return false;
  return pickUpTargetItem(ctx, target, startPlacement);
}
