/**
 * Sistema de Raycasting & Deteccao de Hover (MycoCampus3D)
 * Responsavel por identificar alvos sob a mira/cursor e atualizar o prompt contextual do HUD.
 */

import { cancelHeldItemPlacement, findAimedHeldPlacement, updateHeldItemPlacementPreview } from './held-item-placement.js';
import { resolveHeldItemHover } from './hover-held-handlers.js';
import { isRayOccludedByStructure, firstUnoccludedRayHit } from './ray-occlusion.js';
import { isSeatOccupied } from './world-interactions.js';
import {
  greenhouseHitMeshes,
  greenhouseControlMeshes,
  greenhouseEnv,
  isHoldingColonizedSpawn
} from '../world/greenhouse.js';
import { BURNER_LEVEL_NAMES, formatBurnerTimerLabel } from '../items/pressure-cooker.js';
import { isCultureAccessibleFromFridge, isPartOfFridgeDoor, isCultureFridgeOccupied } from '../items/culture-fridge.js';
import { formatSprayHoverPrompt } from '../items/alcohol-spray.js';
import { isItemInClosedCabinet } from '../items/lab-cabinets.js';
import { formatHoverInfo, updateHover3dBadge, hideHover3dBadge } from '../entities/hover-3d-badge.js';
import { countReadyGrowSlots, growHeldFeedback, growSlotActionLabel } from '../items/portable-grow.js';
import { canPruneGardenPlant, gardenHitMeshes, gardenState } from '../world/campus-garden.js';
import { roadSaleStandMeshes, roadStandState } from '../world/roadside-stand-state.js';
import { MYCOCOIN_PRICE_PER_PACK } from '../core/myco-coins.js';
import { getMonotubActionLabel } from '../items/monotub.js';
import { getLocalCompanionPet } from '../entities/pets.js';
import { findHoveredBeehive, getBeehiveHoverPrompt } from '../entities/bee-ecology.js';
import {
  findHoveredFlower,
  getFlowerHoverPrompt,
  findFlowerPlantSpot,
  getFlowerPlantHoverPrompt
} from '../world/campus-flowers.js';
import { telescopeHitMeshes } from '../world/plaza-telescope.js';
import { t } from '../core/i18n.js';
import { cratePlacementError, findAimedCrate, freeCrateSlot } from './crate-cargo.js';
import { villageLotAt } from '../core/village-layout.js';
import { appState } from '../core/state.js';

const THREE = window.THREE;
const _vZero2 = new THREE.Vector2(0, 0);
const _tmpBadgeWorldPos = new THREE.Vector3();
const _tmpAimAssistPos = new THREE.Vector3();
const _villageTarget = new THREE.Vector3();
const GREENHOUSE_DEV_KEYS = {
  panel: 'actions.hover.gh_dev_panel',
  humidifier: 'actions.hover.gh_dev_humidifier',
  exhaust: 'actions.hover.gh_dev_exhaust',
  cooler: 'actions.hover.gh_dev_cooler'
};

function resolveHoverTargetObj(ctx) {
  return ctx.hoveredVillageItem || ctx.hoveredPickable ||
    ctx.hoveredPdaTarget ||
    ctx.hoveredHeatSealerTarget ||
    ctx.hoveredParafilmTarget ||
    (ctx.hoveredPotInsert && ctx.hoveredPotInsert.potItem) ||
    (ctx.hoveredFillPot && ctx.hoveredFillPot.potItem) ||
    ctx.hoveredPourTarget ||
    ctx.hoveredFlocaoTarget ||
    ctx.hoveredBowlTarget ||
    (ctx.hoveredScalpelTarget && ctx.hoveredScalpelTarget.item) ||
    ctx.hoveredGrainTarget ||
    (ctx.hoveredSyringeTarget && ctx.hoveredSyringeTarget.item) ||
    (ctx.hoveredWipeTarget && (ctx.hoveredWipeTarget.target === 'hood' ? { label: ctx.hoveredWipeTarget.label } : ctx.hoveredWipeTarget.target)) ||
    (ctx.hoveredSprayTarget && (ctx.hoveredSprayTarget.target === 'hood' ? { label: ctx.hoveredSprayTarget.label } : ctx.hoveredSprayTarget.target)) ||
    (ctx.hoveredFridgeTarget && ctx.hoveredFridgeTarget.fridge) ||
    ctx.hoveredAlcoholLampTarget ||
    ctx.hoveredMicroscopeTarget ||
    (ctx.hoveredSilicaJarTarget) ||
    (ctx.hoveredAmpouleCaseTarget) ||
    ctx.hoveredMushroomBagPackTarget ||
    ctx.hoveredDriedBatchForBag ||
    ctx.hoveredMushroomBagSealTarget ||
    ctx.hoveredDeliveryCrateTarget ||
    ctx.hoveredCratePlacement ||
    (ctx.hoveredRoadSaleStand ? { label: t('actions.hover.road_stand_badge') } : null) ||
    ctx.hoveredMonotubTarget ||
    ctx.hoveredDehydratorTarget ||
    ctx.hoveredSporePrintPetri ||
    (ctx.hoveredMonotubRackSlot ? { label: t('actions.hover.monotub_rack_badge', { tier: ctx.hoveredMonotubRackSlot.tier }) } : null) ||
    (ctx.hoveredGardenTarget ? { label: ctx.hoveredGardenTarget.label || (ctx.hoveredGardenTarget.plant && ctx.hoveredGardenTarget.plant.name) || t('actions.hover.garden_badge') } : null) ||
    (ctx.hoveredMonotubDunkSink ? { label: t('actions.hover.sink_badge') } : null) ||
    ctx.hoveredDoorObj ||
    ctx.hoveredCabinetPart ||
    ctx.hoveredGreenhouseSlot ||
    (ctx.hoveredMushroom ? { label: (ctx.hoveredMushroom.capMesh && ctx.hoveredMushroom.capMesh.userData.speciesName) || t('actions.hover.wild_mushroom') } : null) ||
    ctx.hoveredBlindObj ||
    (ctx.hoveredSink ? { label: t('actions.hover.sink_badge') } : null) ||
    (ctx.hoveredTrash ? { label: t('actions.hover.trash_badge') } : null) ||
    (ctx.hoveredSeat ? { label: t('actions.hover.seat_badge') } : null) ||
    (ctx.hoveredBoardHit ? { label: t('actions.hover.board_badge') } : null) ||
    (ctx.hoveredRankBtn ? { label: t('actions.hover.rank_badge') } : null) ||
    (ctx.hoveredCinema ? { label: t('actions.hover.cinema_badge') } : null) ||
    (ctx.hoveredScaleTare ? { label: t('actions.hover.scale_badge') } : null) ||
    (ctx.hoveredBurnerSwitch ? { label: t(ctx.hoveredBurnerSwitch.kind === 'gas_tripod' ? 'actions.hover.burner_gas' : 'actions.hover.burner_electric') } : null) ||
    (ctx.hoveredStirSwitch ? { label: t('actions.hover.stirrer_badge') } : null) ||
    (ctx.hoveredHoodSwitch ? { label: t('actions.hover.hood_badge') } : null) ||
    (ctx.hoveredCow ? { label: `🐄 ${ctx.hoveredCow.name}`, mesh: ctx.hoveredCow.mesh } : null) ||
    (ctx.hoveredSwitch ? { label: t('actions.hover.light_switch_badge') } : null) ||
    (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer && ctx.thermoLaserOn
      ? { label: ctx.thermoTargetLabel || t('actions.hover.thermometer_badge') }
      : null);
}

function aimAtVillageGuestOrItem(ctx) {
  if (!ctx.inFps || ctx.heldItem || (!appState.villageLease && !appState.villageEditLot)) return false;
  const lotId = villageLotAt(ctx.playerPos.x, ctx.playerPos.z)?.id;
  if (!lotId) return false;
  const ray = ctx.raycaster.ray;
  let distance = 4;
  if (lotId === appState.villageLease?.id) {
    for (const id in ctx.remoteAvatars) {
      const avatar = ctx.remoteAvatars[id];
      if (avatar.villageEditor?.lot !== lotId || !avatar.group.visible) continue;
      _villageTarget.copy(avatar.group.position);
      _villageTarget.y += 0.86;
      const range = ray.origin.distanceTo(_villageTarget);
      if (range >= distance || ray.distanceSqToPoint(_villageTarget) > 0.30) continue;
      if (isRayOccludedByStructure(ctx, range, { checkWalls: true })) continue;
      distance = range;
      ctx.hoveredVillageEditor = avatar;
    }
    if (ctx.hoveredVillageEditor) return true;
  }
  if (lotId !== appState.villageEditLot) return false;
  for (const item of ctx.pickableItems) {
    if (item.villageEditLot !== lotId || !item.mesh.visible || ctx.isHeldByRemote(item.id)) continue;
    if (ray.distanceSqToPoint(item.mesh.position) > Math.max(0.8, item.radius || 0) ** 2) continue;
    const hit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObject(item.mesh, true), distance, {
      checkWalls: true, ignoreCollider: item.mesh.userData.dynamicCollider
    });
    if (!hit) continue;
    distance = hit.distance;
    ctx.hoverHit = hit;
    ctx.hoveredVillageItem = item;
  }
  if (!ctx.hoveredVillageItem) return false;
  setHoverPrompt(ctx, ctx.hoveredVillageItem.label, false);
  return true;
}

export function syncHover3dBadge(ctx, prompt) {
  const badge = ctx.hover3dBadge;
  if (!badge) return;
  if (!prompt || (ctx.isTouchDevice && ctx.isTouchDevice())) {
    hideHover3dBadge(badge);
    return;
  }
  // Se estiver segurando o termômetro, a temperatura já aparece diretamente no display LCD da pistola
  if (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer) {
    hideHover3dBadge(badge);
    return;
  }
  const targetObj = resolveHoverTargetObj(ctx);

  if (targetObj && ctx.cookerPots && ctx.cookerPots.some((cp) => (cp.potItem === targetObj || cp.lidItem === targetObj) && cp.pSprite && cp.pSprite.visible)) {
    hideHover3dBadge(badge);
    return;
  }

  if (!targetObj && !ctx.hoverHit && !ctx.hoveredBoardHit) {
    hideHover3dBadge(badge);
    return;
  }

  const formatted = formatHoverInfo(prompt, targetObj);
  if (!formatted) {
    hideHover3dBadge(badge);
    return;
  }

  let hasWorldPos = false;
  if (ctx.hoverHit && ctx.hoverHit.point) {
    _tmpBadgeWorldPos.copy(ctx.hoverHit.point);
    _tmpBadgeWorldPos.y += 0.16;
    hasWorldPos = true;
  } else if (ctx.hoveredBoardHit && ctx.hoveredBoardHit.point) {
    _tmpBadgeWorldPos.copy(ctx.hoveredBoardHit.point);
    _tmpBadgeWorldPos.y += 0.18;
    hasWorldPos = true;
  } else if (targetObj && targetObj.mesh) {
    targetObj.mesh.getWorldPosition(_tmpBadgeWorldPos);
    _tmpBadgeWorldPos.y += ((targetObj.mesh.userData && targetObj.mesh.userData.height) || targetObj.height || 0.35) + 0.16;
    hasWorldPos = true;
  } else if (targetObj && targetObj.group) {
    targetObj.group.getWorldPosition(_tmpBadgeWorldPos);
    _tmpBadgeWorldPos.y += 0.24;
    hasWorldPos = true;
  } else if (targetObj && targetObj.position) {
    _tmpBadgeWorldPos.copy(targetObj.position);
    _tmpBadgeWorldPos.y += 0.24;
    hasWorldPos = true;
  }

  if (hasWorldPos) {
    updateHover3dBadge(badge, {
      visible: true,
      title: formatted.title,
      params: formatted.params,
      action: formatted.action,
      worldPos: _tmpBadgeWorldPos
    }, ctx.camera, performance.now());
  } else {
    hideHover3dBadge(badge);
  }
}

function setHoverPrompt(ctx, prompt, contextual = true) {
  ctx.aimActionPrompt = contextual ? prompt : '';
  if (ctx.callbacks && ctx.callbacks.onHoverPrompt) {
    ctx.callbacks.onHoverPrompt(prompt, contextual);
  }
  syncHover3dBadge(ctx, prompt);
}

export function firstValidRayHit(hits) {
  for (let hi = 0; hi < hits.length; hi++) {
    let part = hits[hi].object;
    const data = part.userData;
    if (data.growSlotIndex !== undefined) {
      while (part?.visible) part = part.parent;
      if (part) continue;
    }
    if (!data.ignoreRay && !data.hiddenCratePack) return hits[hi];
  }
  return null;
}

/**
 * Broad-phase de baixo custo: evita raycast recursivo em sub-malhas quando
 * o centro do item esta distante da linha do raio.
 */
function intersectPickableItem(raycaster, item) {
  if (!item || !item.mesh || item.isReadOnly) return null;
  const ud = item.mesh.userData;
  const maxRadSq = (ud && (ud.isTable || ud.isHood || ud.isRack || item.fridgeCtrl)) ? 9.0 : 0.72;
  if (raycaster.ray.distanceSqToPoint(item.mesh.position) > maxRadSq) return null;
  return firstValidRayHit(raycaster.intersectObject(item.mesh, true));
}

export function updateHoverRay(ctx, customNdc) {
  if (!ctx.heldItem && ctx.placementMode) cancelHeldItemPlacement(ctx);
  ctx.aimActionPrompt = '';
  ctx.hoverHit = null;
  ctx.hoveredPickable = null;
  ctx.hoveredGrowSlot = null;
  ctx.hoveredMushroom = null;
  ctx.hoveredVillageLot = null;
  ctx.hoveredVillageEditor = null;
  ctx.hoveredVillageItem = null;
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
  ctx.hoveredHeatSealerObj = null;
  ctx.hoveredG2GTarget = null;
  ctx.hoveredLcNutrientTarget = null;
  ctx.hoveredFoilTarget = null;
  ctx.hoveredMicroporeTarget = null;
  ctx.hoveredParafilmTarget = null;
  ctx.hoveredScaleTare = null;
  ctx.hoveredBurnerSwitch = null;
  ctx.hoveredBurnerTimer = null;
  ctx.hoveredCow = null;
  ctx.hoveredPet = null;
  ctx.hoveredBeehive = null;
  ctx.hoveredFlower = null;
  ctx.hoveredFlowerPlantSpot = null;
  ctx.hoveredSportBall = null;
  ctx.hoveredSinkAction = null;
  ctx.hoveredGrainCooker = null;
  ctx.hoveredCornScoopPot = null;
  ctx.hoveredPotInsert = null;
  ctx.hoveredSnapPot = null;
  ctx.hoveredSprayTarget = null;
  ctx.hoveredH2O2Target = null;
  ctx.hoveredWipeTarget = null;
  ctx.hoveredTrash = false;
  ctx.hoveredSink = null;
  ctx.hoveredPourTarget = null;
  ctx.hoveredFillPot = null;
  ctx.hoveredGrainTarget = null;
  ctx.hoveredFlocaoTarget = null;
  ctx.hoveredScalpelTarget = null;
  ctx.hoveredBowlTarget = null;
  ctx.hoveredFridgeTarget = null;
  ctx.hoveredSporePrintPetri = null;
  ctx.hoveredDehydratorTarget = null;
  ctx.hoveredMonotubTarget = null;
  ctx.hoveredMonotubRackSlot = null;
  ctx.hoveredMonotubDunkSink = false;
  ctx.hoveredGreenhouseSlot = null;
  ctx.hoveredGreenhouseDevice = null;
  ctx.hoveredGardenTarget = null;
  ctx.hoveredAlcoholLampTarget = null;
  ctx.hoveredMicroscopeTarget = null;
  ctx.hoveredSilicaJarTarget = null;
  ctx.hoveredAmpouleCaseTarget = null;
  ctx.hoveredMushroomBagPackTarget = null;
  ctx.hoveredDriedBatchForBag = null;
  ctx.hoveredMushroomBagSealTarget = null;
  ctx.hoveredDeliveryCrateTarget = null;
  ctx.hoveredCratePlacement = null;
  ctx.hoveredRoadSaleStand = false;
  ctx.hoveredTelescope = false;
  let prompt = '';

  const rayNdc = customNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc);
  const refX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
  const refZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
  const maxPickSq = ctx.inFps ? 26 : 225;
  ctx.raycaster.far = 24;
  ctx.raycaster.setFromCamera(rayNdc, ctx.camera);

  // Permite mirar e abrir/fechar portas mesmo segurando um item na mão (quando não está em modo posicionamento)
  if (!ctx.placementMode && ctx.doorHitMeshes.length) {
    const doorHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false), 4.2, { checkWalls: true });
    if (doorHit) {
      ctx.hoverHit = doorHit;
      ctx.hoveredDoorObj = doorHit.object.userData.doorObj;
      const dPrompt = t(
        ctx.hoveredDoorObj.open ? 'actions.hover.door_close' : 'actions.hover.door_open',
        { label: ctx.hoveredDoorObj.label }
      );
      setHoverPrompt(ctx, dPrompt);
      return;
    }
  }

  if (aimAtVillageGuestOrItem(ctx)) return;
  if (resolveHeldItemHover(ctx, rayNdc, {
    intersectPickableItem,
    setHoverPrompt,
    updateHeldItemPlacementPreview
  })) {
    if (!ctx.placementMode && !ctx.aimActionPrompt && findAimedHeldPlacement(ctx, rayNdc)) {
      setHoverPrompt(ctx, t('hud.place_aimed'));
    }
    return;
  }
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.heldItem && !ctx.adminEditMode) {
    const crate = findAimedCrate(ctx, rayNdc);
    if (crate) {
      ctx.hoveredCratePlacement = crate;
      const slot = freeCrateSlot(crate, ctx.heldItem);
      const error = cratePlacementError(crate, ctx.heldItem, slot);
      setHoverPrompt(ctx, error || t('crate.place'), !error);
      return;
    }
  }

  if (!ctx.heldItem && ctx.rankingBtnMeshes.length && (!ctx.inFps || (Math.abs(refX) < 30 && refZ < 16))) {
    const rHits = ctx.raycaster.intersectObjects(ctx.rankingBtnMeshes, false);
    if (rHits.length > 0 && rHits[0].distance < 18) {
      ctx.hoverHit = rHits[0];
      ctx.hoveredRankBtn = rHits[0].object.userData.rankAction;
      prompt = t(ctx.hoveredRankBtn === 'up' ? 'actions.hover.rank_up' : 'actions.hover.rank_down');
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!ctx.heldItem && ctx.cinemaScreenMesh && (!ctx.inFps || (refX > 16 && refZ > -32 && refZ < 12))) {
    const cHits = ctx.raycaster.intersectObject(ctx.cinemaScreenMesh, false);
    if (cHits.length > 0 && cHits[0].distance < 22) {
      ctx.hoverHit = cHits[0];
      ctx.hoveredCinema = true;
      ctx.hoveredCinemaUv = cHits[0].uv ? { x: cHits[0].uv.x, y: 1 - cHits[0].uv.y } : { x: 0.5, y: 0.5 };
      const cTarget = ctx.getCinemaHitTarget(ctx.hoveredCinemaUv);
      if (cTarget.type !== ctx.lastCinemaHoverType || (cTarget.idx || -1) !== ctx.lastCinemaHoverIdx) {
        ctx.lastCinemaHoverType = cTarget.type;
        ctx.lastCinemaHoverIdx = cTarget.idx !== undefined ? cTarget.idx : -1;
        ctx.cinemaDirty = true;
      }
      if (cTarget.type === 'power_on') prompt = t('actions.hover.cinema_power_on');
      else if (cTarget.type === 'power_off') prompt = t('actions.hover.cinema_power_off');
      else if (cTarget.type === 'menu') prompt = t('actions.hover.cinema_menu');
      else if (cTarget.type === 'lesson') prompt = t('actions.hover.cinema_watch', { title: (ctx.cinemaLessons[cTarget.idx] && ctx.cinemaLessons[cTarget.idx].title) || t('actions.hover.cinema_lesson_default') });
      else if (cTarget.type === 'toggle_play') prompt = t(ctx.cinemaPlaying ? 'actions.hover.cinema_pause' : 'actions.hover.cinema_resume');
      else prompt = t('actions.hover.cinema_choose');
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!ctx.heldItem && ctx.scaleTareMeshes.length) {
    let anyScaleNear = false;
    for (let si = 0; si < ctx.scaleTareMeshes.length; si++) {
      if (ctx.raycaster.ray.distanceSqToPoint(ctx.scaleTareMeshes[si].getWorldPosition(_tmpBadgeWorldPos)) < 1.5) {
        anyScaleNear = true;
        break;
      }
    }
    const tHits = anyScaleNear ? ctx.raycaster.intersectObjects(ctx.scaleTareMeshes, false) : [];
    if (tHits.length > 0 && tHits[0].distance < 3.5) {
      ctx.hoverHit = tHits[0];
      const sc = tHits[0].object.userData.scaleObj;
      ctx.hoveredScaleTare = sc;
      if (sc.lastGross <= 0.05 && sc.tare > 0) {
        prompt = t('actions.hover.scale_tare_cancel');
      } else if (sc.lastGross > 0) {
        prompt = t('actions.hover.scale_tare_apply', { grams: sc.lastGross.toFixed(1) });
      } else {
        prompt = t('actions.hover.scale_tare_zero');
      }
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!ctx.heldItem && ctx.burnerSwitchMeshes.length) {
    let anyBurnerNear = false;
    for (let bi = 0; bi < ctx.burnerSwitchMeshes.length; bi++) {
      if (ctx.raycaster.ray.distanceSqToPoint(ctx.burnerSwitchMeshes[bi].getWorldPosition(_tmpBadgeWorldPos)) < 2.25) {
        anyBurnerNear = true;
        break;
      }
    }
    const rawBHits = anyBurnerNear ? ctx.raycaster.intersectObjects(ctx.burnerSwitchMeshes, false) : [];
    const bHit = firstUnoccludedRayHit(ctx, rawBHits, 4.0, { checkWalls: true });
    let blockedByCloserObject = false;
    if (bHit && ctx.pickableItems && ctx.pickableItems.length) {
      for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
        const pIt = ctx.pickableItems[pi];
        if (!pIt || pIt === ctx.heldItem || !pIt.mesh) continue;
        if (pIt.mesh.userData && pIt.mesh.userData.isBurner) continue;
        const pDx = pIt.mesh.position.x - refX, pDz = pIt.mesh.position.z - refZ;
        if (pDx * pDx + pDz * pDz > maxPickSq) continue;
        const pHit = intersectPickableItem(ctx.raycaster, pIt);
        if (pHit && pHit.distance < bHit.distance - 0.015) {
          blockedByCloserObject = true;
          break;
        }
      }
    }
    if (bHit && !blockedByCloserObject) {
      ctx.hoverHit = bHit;
      if (bHit.object.userData.burnerTimerIdx !== undefined) {
        ctx.hoveredBurnerTimer = ctx.burnerDevices[bHit.object.userData.burnerTimerIdx];
        const curLbl = formatBurnerTimerLabel(ctx.hoveredBurnerTimer.timerPresetMin || 0);
        prompt = t('actions.hover.burner_timer', { label: curLbl });
        setHoverPrompt(ctx, prompt);
        return;
      }
      ctx.hoveredBurnerSwitch = ctx.burnerDevices[bHit.object.userData.burnerSwitchIdx];
      const curL = ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0);
      const nxtL = (curL + 1) % 4;
      prompt = t('actions.hover.burner_switch', { current: BURNER_LEVEL_NAMES[curL], next: BURNER_LEVEL_NAMES[nxtL] });
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!ctx.heldItem && ctx.stirSwitchMeshes.length) {
    let anyStirNear = false;
    for (let si = 0; si < ctx.stirSwitchMeshes.length; si++) {
      if (ctx.raycaster.ray.distanceSqToPoint(ctx.stirSwitchMeshes[si].getWorldPosition(_tmpBadgeWorldPos)) < 1.5) {
        anyStirNear = true;
        break;
      }
    }
    const stSwHits = anyStirNear ? ctx.raycaster.intersectObjects(ctx.stirSwitchMeshes, false) : [];
    if (stSwHits.length > 0 && stSwHits[0].distance < 4.0) {
      ctx.hoverHit = stSwHits[0];
      ctx.hoveredStirSwitch = stSwHits[0].object.userData.stirSwitch;
      prompt = t(ctx.hoveredStirSwitch.on ? 'actions.hover.stirrer_off' : 'actions.hover.stirrer_on');
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!ctx.heldItem && ctx.hoodSwitchMeshes.length) {
    let anyHoodNear = false;
    for (let hi = 0; hi < ctx.hoodSwitchMeshes.length; hi++) {
      if (ctx.raycaster.ray.distanceSqToPoint(ctx.hoodSwitchMeshes[hi].getWorldPosition(_tmpBadgeWorldPos)) < 2.25) {
        anyHoodNear = true;
        break;
      }
    }
    const hsHits = anyHoodNear ? ctx.raycaster.intersectObjects(ctx.hoodSwitchMeshes, false) : [];
    if (hsHits.length > 0 && hsHits[0].distance < 4.0) {
      ctx.hoverHit = hsHits[0];
      ctx.hoveredHoodSwitch = hsHits[0].object.userData.hoodSwitch;
      prompt = t(ctx.hoveredHoodSwitch.on ? 'actions.hover.hood_off' : 'actions.hover.hood_on');
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!ctx.heldItem && ctx.lightSwitchMeshes.length) {
    const swHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.lightSwitchMeshes, false), 4.0);
    if (swHit) {
      ctx.hoverHit = swHit;
      ctx.hoveredSwitch = swHit.object.userData.lightSwitch;
      prompt = t(ctx.hoveredSwitch.on ? 'actions.hover.light_off' : 'actions.hover.light_on');
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!prompt && ctx.doorHitMeshes.length) {
    const doorHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false), 5.0);
    if (doorHit) {
      ctx.hoverHit = doorHit;
      ctx.hoveredDoorObj = doorHit.object.userData.doorObj;
      prompt = t(
        ctx.hoveredDoorObj.open
          ? (ctx.heldItem ? 'actions.hover.door_close_numbered' : 'actions.hover.door_close')
          : (ctx.heldItem ? 'actions.hover.door_open_numbered' : 'actions.hover.door_open'),
        { label: ctx.hoveredDoorObj.label }
      );
    }
  }
  const maxMushSq = ctx.inFps ? 24 : 225;
  if (!prompt && (!ctx.heldItem || (ctx.heldItem.deliveryCrateCtrl && !ctx.adminEditMode))) {
    for (let m = 0; m < ctx.wildMushrooms.length; m++) {
      const wm = ctx.wildMushrooms[m];
      if (!wm.active) continue;
      const wmX = wm.worldX !== undefined ? wm.worldX : wm.group.position.x;
      const wmZ = wm.worldZ !== undefined ? wm.worldZ : wm.group.position.z;
      const mdx = wmX - refX, mdz = wmZ - refZ;
      if (mdx * mdx + mdz * mdz > maxMushSq) continue;
      const mHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObject(wm.group, true), 4.5, { checkWalls: true });
      if (mHit) {
        ctx.hoverHit = mHit;
        ctx.hoveredMushroom = wm;
        const isPoop = wm.id && wm.id.indexOf('wild_poop_') === 0;
        const spLabel = (wm.capMesh && wm.capMesh.userData && wm.capMesh.userData.speciesName) || t('actions.hover.wild_mushroom');
        const crate = ctx.heldItem;
        if (crate) {
          prompt = freeCrateSlot(crate) < 0 ? t('crate.full') : t('crate.harvest', { species: spLabel });
        } else {
          prompt = t(isPoop ? 'actions.hover.wild_harvest_poop' : 'actions.hover.wild_harvest', { species: spLabel });
        }
        break;
      }
    }
  }
  if (!prompt && ctx.heldItem) {
    for (let fi = 0; fi < ctx.pickableItems.length; fi++) {
      const fItem = ctx.pickableItems[fi];
      if (!fItem || fItem === ctx.heldItem || !fItem.fridgeCtrl) continue;
      const fdx = fItem.mesh.position.x - refX, fdz = fItem.mesh.position.z - refZ;
      if (fdx * fdx + fdz * fdz > maxPickSq) continue;
      const fHit = intersectPickableItem(ctx.raycaster, fItem);
      if (fHit && fHit.distance < 4.5 && !isRayOccludedByStructure(ctx, fHit.distance, {
        checkWalls: true,
        ignoreCollider: fItem.mesh.userData && fItem.mesh.userData.dynamicCollider
      })) {
        ctx.hoveredPickable = fItem;
        ctx.hoverHit = fHit;
        prompt = t(fItem.fridgeCtrl.doorOpen ? 'actions.hover.fridge_close_numbered' : 'actions.hover.fridge_open_numbered');
        break;
      }
    }
  }
  if (!prompt && !ctx.adminEditMode && !ctx.placementMode && (ctx.heldItem?.growModule || (ctx.heldItem?.spawnCtrl?.isBag && ctx.heldItem.spawnCtrl.filled))) {
    let nearest = 4;
    for (const item of ctx.pickableItems) {
      if (!item.growCtrl || item.isReadOnly || ctx.isHeldByRemote(item.id)) continue;
      const hit = intersectPickableItem(ctx.raycaster, item);
      if (!hit || hit.distance >= nearest || isRayOccludedByStructure(ctx, hit.distance, { checkWalls: true })) continue;
      nearest = hit.distance;
      ctx.hoveredPickable = item;
      ctx.hoverHit = hit;
    }
    if (ctx.hoveredPickable?.growCtrl) prompt = growHeldFeedback(ctx.heldItem, ctx.hoveredPickable.growCtrl);
  }
  let bestSmall = null, bestSmallDist = Infinity, bestSmallHit = null;
  let bestLarge = null, bestLargeDist = Infinity, bestLargeHit = null;
  let bestBlocked = null, bestBlockedDist = Infinity, bestBlockedHit = null;

  if (!prompt && !ctx.heldItem) {
    const ray = ctx.raycaster && ctx.raycaster.ray;
    const ro = ray && ray.origin;
    const rd = ray && ray.direction;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      let item = ctx.pickableItems[i];
      if (item === ctx.heldItem || (ctx.heldItem && item === ctx.heldItem.lidItem) ||
        !isCultureAccessibleFromFridge(ctx, item) || isItemInClosedCabinet(ctx, item)) continue;
      if (ctx.isHeldByRemote(item.id)) continue;
      if (item.crateParent && (item.crateParent.isReadOnly || ctx.isHeldByRemote(item.crateParent.id))) continue;
      const idx = item.mesh.position.x - refX, idz = item.mesh.position.z - refZ;
      const dSq = idx * idx + idz * idz;
      if (dSq > maxPickSq) continue;
      if (ro && rd && dSq > 2.25) {
        const dot = (item.mesh.position.x - ro.x) * rd.x + (item.mesh.position.z - ro.z) * rd.z;
        if (dot < -0.6) continue;
      }
      const hit0 = intersectPickableItem(ctx.raycaster, item);
      if (hit0 && hit0.distance < 4.5) {
        if (isRayOccludedByStructure(ctx, hit0.distance, {
          checkWalls: true,
          ignoreCollider: item.mesh.userData && item.mesh.userData.dynamicCollider
        })) continue;
        const dHit = hit0.distance;
        if (item.lidItem && item.lidItem.isAttached && hit0.point.y >= item.mesh.position.y + 0.26) {
          item = item.lidItem;
        }
        if (ctx.isItemInsideClosedCooker(item)) continue;
        if (item.mesh.userData.isBlockedPickup && item.mesh.userData.isBlockedPickup(item)) {
          if (dHit < bestBlockedDist) {
            bestBlockedDist = dHit;
            bestBlocked = item;
            bestBlockedHit = hit0;
          }
          continue;
        }
        if (item.mesh.userData.isTable || item.mesh.userData.isHood || item.cookerRef) {
          if (dHit < bestLargeDist) {
            bestLargeDist = dHit; bestLarge = item; bestLargeHit = hit0;
          }
        } else if (dHit < bestSmallDist) {
          bestSmallDist = dHit; bestSmall = item; bestSmallHit = hit0;
        }
      }
    }
    // Aim Assist leve no Mobile: facilita acertar itens pequenos (ampolas, bisturi, petri) perto da mira
    if (!bestSmall && ctx.isTouchDevice?.() && ray && ro && rd) {
      let bestAssistScore = Infinity;
      for (let i = 0; i < ctx.pickableItems.length; i++) {
        const item = ctx.pickableItems[i];
        if (!item || !item.mesh || item.isReadOnly || item === ctx.heldItem || (ctx.heldItem && item === ctx.heldItem.lidItem)) continue;
        const ud = item.mesh.userData;
        if (ud.isTable || ud.isHood || ud.isRack || item.fridgeCtrl || item.cookerRef) continue;
        if (!isCultureAccessibleFromFridge(ctx, item) || isItemInClosedCabinet(ctx, item) || ctx.isHeldByRemote(item.id) || ctx.isItemInsideClosedCooker(item)) continue;
        if (item.crateParent && (item.crateParent.isReadOnly || ctx.isHeldByRemote(item.crateParent.id))) continue;
        if (ud.isBlockedPickup && ud.isBlockedPickup(item)) continue;
        item.mesh.getWorldPosition(_tmpAimAssistPos);
        const toX = _tmpAimAssistPos.x - ro.x;
        const toY = _tmpAimAssistPos.y - ro.y;
        const toZ = _tmpAimAssistPos.z - ro.z;
        const fwd = toX * rd.x + toY * rd.y + toZ * rd.z;
        if (fwd < 0.25 || fwd > 3.2) continue;
        const rayDistSq = ray.distanceSqToPoint(_tmpAimAssistPos);
        if (rayDistSq > 0.022) continue; // ~0.148m de raio de ímã
        if (isRayOccludedByStructure(ctx, fwd, { checkWalls: true, ignoreCollider: ud.dynamicCollider })) continue;
        const score = rayDistSq + fwd * 0.002;
        if (score < bestAssistScore) {
          bestAssistScore = score;
          bestSmall = item;
          bestSmallHit = { distance: fwd, point: _tmpAimAssistPos.clone(), object: item.mesh };
        }
      }
    }
    ctx.hoveredPickable = bestSmall || bestLarge;
    ctx.hoverHit = bestSmall ? bestSmallHit : bestLargeHit;
    if (!ctx.hoveredPickable && bestBlocked && bestBlockedDist < 3.8) {
      ctx.hoveredPickable = bestBlocked;
      ctx.hoverHit = bestBlockedHit;
      if (ctx.adminEditMode) {
        if (bestBlocked.mesh.userData.isBurner) {
          prompt = t('actions.hover.blocked_burner');
        } else {
          prompt = t('actions.hover.blocked_item', { label: bestBlocked.label });
        }
      } else {
        prompt = bestBlocked.label;
      }
    } else if (ctx.hoveredPickable?.growCtrl && !ctx.adminEditMode) {
      const grow = ctx.hoveredPickable.growCtrl;
      const index = ctx.hoverHit?.object.userData.growSlotIndex;
      const harvest = growSlotActionLabel(grow, index);
      if (harvest) {
        ctx.hoveredGrowSlot = index;
        prompt = harvest;
      } else {
        const ready = countReadyGrowSlots(grow);
        prompt = ready ? t('grow.ready_count', { count: ready }) + ' · ' + t('grow.panel') : t('grow.panel');
      }
    } else if (ctx.hoveredPickable) {
      let potStatus = null;
      for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
        if (ctx.cookerPots[cpi].potItem === ctx.hoveredPickable || ctx.cookerPots[cpi].lidItem === ctx.hoveredPickable) {
          potStatus = ctx.cookerPots[cpi]; break;
        }
      }
      if (ctx.hoveredPickable.potItem && ctx.hoveredPickable.isAttached) {
        const wLit = potStatus ? ((potStatus.waterMl / 1000).toFixed(1) + 'L') : '';
        if (potStatus && potStatus.burned) {
          prompt = t('actions.hover.pot_lid_burned');
        } else if (potStatus && potStatus.psi >= 1.5) {
          const pctP = Math.min(100, Math.round((potStatus.psi / 15) * 100));
          if (potStatus.progress >= 100) {
            prompt = t('actions.hover.pot_lid_locked_done', { psi: potStatus.psi.toFixed(1), temp: Math.round(potStatus.temp), water: wLit });
          } else if (potStatus.psi >= 14) {
            prompt = t('actions.hover.pot_lid_sterilizing', { pct: Math.floor(potStatus.progress), psi: potStatus.psi.toFixed(1), temp: Math.round(potStatus.temp), water: wLit });
          } else {
            prompt = t('actions.hover.pot_lid_pressurized', { psi: potStatus.psi.toFixed(1), pct: pctP, temp: Math.round(potStatus.temp), water: wLit });
          }
        } else if (potStatus && potStatus.progress >= 100) {
          const coolTag = potStatus.temp > 30
            ? t('actions.hover.pot_cool_temp', { temp: Math.round(potStatus.temp) })
            : t('actions.hover.pot_depressurized');
          prompt = t('actions.hover.pot_lid_remove_done', { coolTag, water: wLit });
        } else if (potStatus && potStatus.temp > 30) {
          prompt = t('actions.hover.pot_lid_remove_hot', { temp: Math.round(potStatus.temp), water: wLit });
        } else {
          prompt = t('actions.hover.pot_lid_remove');
        }
      } else if (potStatus && ctx.hoveredPickable === potStatus.potItem) {
        const wLit = (potStatus.waterMl / 1000).toFixed(1) + 'L';
        if (potStatus.burned) {
          prompt = t('actions.hover.pot_burned', { label: ctx.hoveredPickable.label });
        } else if ((potStatus.grainGrams || 0) > 0) {
          const gPct = potStatus.grainAlDente ? 100 : Math.min(100, Math.round(((potStatus.grainCookSec || 0) / 60) * 100));
          const grainState = potStatus.grainAlDente
            ? t('actions.hover.pot_grain_al_dente')
            : t('actions.hover.pot_grain_cooking', { pct: gPct });
          prompt = t('actions.hover.pot_grain_status', { label: ctx.hoveredPickable.label, state: grainState, temp: Math.round(potStatus.temp), water: wLit });
        } else if (potStatus.temp > 30 || potStatus.progress > 0 || potStatus.psi >= 1.5) {
          const stPart = potStatus.psi >= 1.5
            ? `🔒 ${potStatus.psi.toFixed(1)} PSI`
            : (potStatus.progress >= 100 ? t('actions.hover.pot_sterilized_done') : `${Math.round(potStatus.temp)}°C`);
          prompt = t('actions.hover.pot_status_water', { label: ctx.hoveredPickable.label, state: stPart, water: wLit });
        } else {
          prompt = t('actions.hover.pot_water', { label: ctx.hoveredPickable.label, water: wLit });
        }
      } else if (ctx.hoveredPickable.caseCtrl) {
        const cc = ctx.hoveredPickable.caseCtrl;
        const used = cc.slots ? cc.slots.filter(Boolean).length : 0;
        prompt = t(cc.lidOpen ? 'actions.hover.case_open_catalog' : 'actions.hover.case_open', { used, max: cc.maxSlots || 50 });
      } else if (ctx.hoveredPickable.fridgeCtrl) {
        const fridge = ctx.hoveredPickable;
        prompt = t(fridge.fridgeCtrl.doorOpen ? 'actions.hover.fridge_close' : 'actions.hover.fridge_open');
      } else if (ctx.hoveredPickable.monotubCtrl && !ctx.adminEditMode) {
        const move = t(ctx.isTouchDevice?.() ? 'actions.hover.monotub_move_touch' : 'actions.hover.monotub_move_key');
        prompt = `📦 ${getMonotubActionLabel(ctx.hoveredPickable.monotubCtrl)} • ${move}`;
      } else if (ctx.hoveredPickable.silicaJarCtrl) {
        const jc = ctx.hoveredPickable.silicaJarCtrl;
        const cap = jc.maxGrams || jc.capacityGrams || 150;
        prompt = jc.storedGrams > 0
          ? t('actions.hover.silica_take', { grams: Math.min(10, jc.storedGrams), stored: jc.storedGrams, cap, species: jc.speciesName || t('actions.hover.silica_crisp_default') })
          : t('actions.hover.silica_empty', { cap });
      } else {
        prompt = ctx.hoveredPickable.label;
      }
    }
  }
  ctx.hoveredCabinetPart = null;
  if (!ctx.heldItem && ctx.cabinetHitMeshes && ctx.cabinetHitMeshes.length) {
    const cabHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.cabinetHitMeshes, false), 3.8, { checkWalls: true });
    if (cabHit) {
      const smallOnCounter = bestSmall && bestSmall.mesh && bestSmall.mesh.position.y >= 0.94;
      const smallInDrawerOrCab = bestSmall && bestSmallDist <= cabHit.distance + 0.03;
      if (!smallOnCounter && !smallInDrawerOrCab && (!bestSmall || cabHit.distance < bestSmallDist)) {
        const cPart = cabHit.object.userData.cabinetPart;
        if (cPart) {
          ctx.hoverHit = cabHit;
          ctx.hoveredCabinetPart = cPart;
          ctx.hoveredPickable = null;
          prompt = t(cPart.open ? 'actions.hover.cabinet_close' : 'actions.hover.cabinet_open', { label: cPart.label || t('actions.hover.cabinet_default') });
        }
      }
    }
  }
  if (ctx.heldSportBall) {
    setHoverPrompt(ctx, t('actions.hover.basketball_aim'));
    return;
  }
  if (!prompt && !ctx.heldItem && ctx.sportBalls && ctx.sportBalls.length) {
    for (let si = 0; si < ctx.sportBalls.length; si++) {
      const sb = ctx.sportBalls[si];
      if (sb.kind !== 'basketball' || !sb.mesh) continue;
      const bHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObject(sb.mesh, false), 4.2, { checkWalls: true });
      if (bHit) {
        ctx.hoverHit = bHit;
        ctx.hoveredSportBall = sb;
        prompt = t('actions.hover.basketball_pick');
        break;
      }
    }
  }
  if (!prompt && !ctx.heldItem && ctx.cowHitMeshes && ctx.cowHitMeshes.length && ctx.pastureCows && ctx.pastureCows.length) {
    let nearAnyCow = false;
    for (let ci = 0; ci < ctx.pastureCows.length; ci++) {
      const cw = ctx.pastureCows[ci];
      if (!cw || cw.abducted || !cw.mesh || !cw.mesh.position) continue;
      const cdx = cw.mesh.position.x - refX;
      const cdz = cw.mesh.position.z - refZ;
      if (cdx * cdx + cdz * cdz <= 49) {
        nearAnyCow = true;
        break;
      }
    }
    if (nearAnyCow) {
      const cowHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.cowHitMeshes, false), 5.5, { checkWalls: true });
      if (cowHit && cowHit.object.userData.cowObj) {
        ctx.hoverHit = cowHit;
        ctx.hoveredCow = cowHit.object.userData.cowObj;
        prompt = t('actions.hover.cow_pet', { name: ctx.hoveredCow.name, health: ctx.hoveredCow.health, mood: ctx.hoveredCow.mood });
      }
    }
  }
  if (!prompt && !ctx.heldItem) {
    const pet = getLocalCompanionPet();
    if (pet && pet.group && pet.group.visible) {
      const pHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObject(pet.group, true), 4.2, { checkWalls: true });
      if (pHit) {
        ctx.hoverHit = pHit;
        ctx.hoveredPet = pet;
        prompt = t('misc.pet.hover');
      }
    }
  }
  if (!prompt) {
    const hive = findHoveredBeehive(ctx.raycaster, ctx);
    if (hive) {
      ctx.hoveredBeehive = hive;
      prompt = getBeehiveHoverPrompt(hive, ctx.heldItem);
    }
  }
  if (!prompt) {
    const fl = findHoveredFlower(ctx.raycaster, ctx);
    if (fl) {
      ctx.hoveredFlower = fl;
      prompt = getFlowerHoverPrompt(fl, ctx.heldItem);
    }
  }
  if (!prompt && ctx.heldItem && ctx.heldItem.flowerSeedCtrl && !ctx.placementMode) {
    const plantSpot = findFlowerPlantSpot(ctx.raycaster, ctx);
    if (plantSpot) {
      ctx.hoveredFlowerPlantSpot = plantSpot;
      prompt = getFlowerPlantHoverPrompt(ctx.heldItem);
    }
  }
  if (!prompt && !ctx.heldItem && !ctx.seated && ctx.seatMeshes.length) {
    const stHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.seatMeshes, false), 3.0, { checkWalls: true });
    if (stHit) {
      ctx.hoverHit = stHit;
      const candSeat = stHit.object.userData.seatInfo;
      if (isSeatOccupied(ctx.remoteAvatars, candSeat)) {
        prompt = t('actions.hover.seat_occupied');
      } else {
        ctx.hoveredSeat = candSeat;
        prompt = t('actions.hover.seat_sit');
      }
    }
  }
  if (!prompt && !ctx.heldItem && refZ >= 43 && refZ <= 97 && ctx.villageHitMeshes?.length) {
    const hit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.villageHitMeshes, false), 4, { checkWalls: true });
    if (hit) {
      ctx.hoverHit = hit;
      ctx.hoveredVillageLot = hit.object.userData.villageLot;
      prompt = t('village.open_lot', { id: String(ctx.hoveredVillageLot).padStart(2, '0') });
    }
  }
  if (!prompt && refX > 11 && refX < 28 && refZ > -2 && refZ < 17) {
    if (!ctx.heldItem && greenhouseControlMeshes.length > 0) {
      const ctrlHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseControlMeshes, true), 4.8, { checkWalls: true });
      if (ctrlHit && ctrlHit.object.userData.greenhouseDevice) {
        const dev = ctrlHit.object.userData.greenhouseDevice;
        ctx.hoverHit = ctrlHit;
        ctx.hoveredGreenhouseDevice = dev;
        const devName = t(GREENHOUSE_DEV_KEYS[dev] || 'actions.hover.gh_dev_default');
        const modeTxt = t(greenhouseEnv.autoMode ? 'actions.hover.gh_mode_auto' : 'actions.hover.gh_mode_manual');
        prompt = t('actions.hover.gh_device_prompt', {
          device: devName,
          mode: modeTxt,
          humidity: Math.round(greenhouseEnv.humidity),
          co2: Math.round(greenhouseEnv.co2Ppm),
          temp: greenhouseEnv.tempC.toFixed(1)
        });
      }
    }
    if (!prompt && (!ctx.heldItem || isHoldingColonizedSpawn(ctx.heldItem)) && greenhouseHitMeshes.length > 0) {
      const ghHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseHitMeshes, true), 4.8, { checkWalls: true });
      if (ghHit) {
        const hSlot = ghHit.object.userData.greenhouseSlot;
        if (hSlot) {
          ctx.hoverHit = ghHit;
          ctx.hoveredGreenhouseSlot = hSlot;
          const hasColonizedSpawn = isHoldingColonizedSpawn(ctx.heldItem);
          const loc = `${hSlot.rackName} • A${hSlot.tier}`;
          const hPct = typeof hSlot.health === 'number' ? Math.round(hSlot.health) : 100;
          const diagLabel = (hSlot.stressReasons && hSlot.stressReasons.length > 0)
            ? t('actions.hover.gh_stressed', { pct: hPct, reasons: hSlot.stressReasons.join(' + ') })
            : t('actions.hover.gh_healthy', { pct: hPct });
          if (hasColonizedSpawn) {
            prompt = (hSlot.empty || hSlot.stage <= 0)
              ? t('actions.hover.gh_place_spawn', { label: ctx.heldItem.label, loc })
              : t('actions.hover.gh_already_fruiting', { name: hSlot.name, loc });
          } else if (hSlot.spent || hSlot.contaminated) {
            prompt = hSlot.contaminated
              ? t('actions.hover.gh_contam', { name: hSlot.name, loc })
              : t('actions.hover.gh_spent', { name: hSlot.name, loc });
          } else if (hSlot.empty || hSlot.stage < 0) {
            prompt = t('actions.hover.gh_empty', { name: hSlot.name, loc });
          } else if (hSlot.stage === 3) {
            prompt = t('actions.hover.gh_harvest', { name: hSlot.name, loc, flush: hSlot.flush, diag: diagLabel });
          } else {
            const stText = t(hSlot.stage === 0 ? 'actions.hover.gh_stage_mycelium' : (hSlot.stage === 1 ? 'actions.hover.gh_stage_pins' : 'actions.hover.gh_stage_growing'));
            prompt = t('actions.hover.gh_growing', { name: hSlot.name, loc, flush: hSlot.flush, stage: stText, humidity: Math.round(hSlot.humidity), diag: diagLabel });
          }
        }
      }
    }
  }
  if (!prompt && !ctx.heldItem && gardenHitMeshes.length > 0 && refX > 10 && refX < 28 && refZ > 12 && refZ < 24) {
    const gHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(gardenHitMeshes, false), 5.0, { checkWalls: true });
    if (gHit && gHit.object.userData.gardenTarget) {
      const gt = gHit.object.userData.gardenTarget;
      ctx.hoverHit = gHit;
      ctx.hoveredGardenTarget = gt;
      if (gt.type === 'compost_box') {
        prompt = t('actions.hover.garden_compost', { cakes: gardenState.compostCakes, richness: Math.round(gardenState.soilRichness) });
      } else if (gt.type === 'harvest_basket') {
        prompt = gardenState.readyBaskets > 0
          ? t('actions.hover.garden_basket_ready', { count: gardenState.readyBaskets })
          : t('actions.hover.garden_basket_progress', { count: gardenState.totalHarvested });
      } else if (gt.type === 'plant' && gt.plant) {
        const pl = gt.plant;
        if (pl.stage === 2) {
          prompt = t(pl.kind === 'tomato' ? 'actions.hover.garden_harvest_tomato' : 'actions.hover.garden_harvest_lettuce', { name: pl.name });
        } else if (canPruneGardenPlant(pl)) {
          prompt = `✂️ ${t('garden.prune')} • ${Math.floor(pl.growth)}%`;
        } else {
          const stTxt = t(pl.stage === 0 ? 'actions.hover.garden_stage_seedling' : (pl.kind === 'tomato' ? 'actions.hover.garden_stage_tomato' : 'actions.hover.garden_stage_lettuce'));
          prompt = t('actions.hover.garden_plant_growing', { name: pl.name, stage: stTxt, growth: Math.floor(pl.growth) });
        }
      }
    }
  }
  if (!prompt && !ctx.heldItem && telescopeHitMeshes.length > 0) {
    const tHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(telescopeHitMeshes, false), 4.5);
    if (tHit && tHit.object && tHit.object.userData && tHit.object.userData.isTelescope) {
      ctx.hoverHit = tHit;
      ctx.hoveredTelescope = true;
      prompt = t(ctx.telescopeZoomActive ? 'actions.hover.telescope_exit' : 'actions.hover.telescope_look');
    }
  }
  if (!prompt && !ctx.heldItem && ctx.blindHitMeshes.length) {
    const blHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false), 5.5);
    if (blHit && blHit.object.userData.blindObj) {
      ctx.hoverHit = blHit;
      ctx.hoveredBlindObj = blHit.object.userData.blindObj;
      prompt = t(ctx.hoveredBlindObj.open ? 'actions.hover.blind_close' : 'actions.hover.blind_open');
    }
  }
  if (!prompt && !ctx.heldItem && roadSaleStandMeshes.length > 0 && refX > 2 && refX < 24 && refZ > 28 && refZ < 44) {
    const stHits = ctx.raycaster.intersectObjects(roadSaleStandMeshes, false);
    if (stHits.length > 0 && stHits[0].distance < 5.5) {
      ctx.hoverHit = stHits[0];
      ctx.hoveredRoadSaleStand = true;
      prompt = roadStandState.availablePacks > 0
        ? t('actions.hover.road_stand_packs', { packs: roadStandState.availablePacks, price: MYCOCOIN_PRICE_PER_PACK })
        : t('actions.hover.road_stand_empty');
    }
  }
  let hasAimTarget = !!prompt;
  if (ctx.heldItem && !ctx.placementMode && (!prompt || ctx.hoveredPickable)) {
    hasAimTarget = !!findAimedHeldPlacement(ctx, rayNdc);
    if (hasAimTarget) prompt = t('hud.place_aimed');
  }
  if (!prompt && ctx.heldItem) {
    const held = ctx.heldItem;
    const isTouch = ctx.isTouchDevice?.();
    const options = t('actions.hover.held_options_hint');
    if (held.mesh?.userData.isThermometer && ctx.thermoLaserOn) {
      prompt = `🌡️ ${ctx.thermoTargetLabel || t('actions.hover.thermo_ambient')}: ${ctx.thermoCurrentTemp.toFixed(1)}°C`;
      if (!isTouch) prompt += ' • ' + options;
    } else if (!isTouch) {
      prompt = t('actions.hover.held_place_hint', { options });
    }
    ctx.placementValid = false;
  }
  setHoverPrompt(ctx, prompt, hasAimTarget);
}
