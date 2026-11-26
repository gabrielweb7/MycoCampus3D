/**
 * Handlers de Hover para Item Segurado (MycoCampus3D)
 * Centraliza a detecção de alvos contextuais enquanto o jogador segura um item,
 * reutilizando um helper único de broad-phase + raycast em pickables.
 */

import { canReceiveSpawnForFruiting } from '../items/spawn-containers.js';
import { getHeldBoardToolColor } from './chalkboard.js';
import { isRayOccludedByStructure, firstUnoccludedRayHit } from './ray-occlusion.js';
import { cratePlacementError, freeCrateSlot } from './crate-cargo.js';
export { isRayOccludedByStructure, firstUnoccludedRayHit } from './ray-occlusion.js';
import { getSyringeInjectionDoseMl } from '../items/syringe.js';
import { updatePlacementGhostVisual } from '../entities/placement-ghost.js';
import { greenhouseHitMeshes } from '../world/greenhouse.js';
import { canFillFromSink, canItemEnterCooker, canSealSpawnBag, canSyringeSource, canSyringeTarget, hasPdaContents } from '../items/item-registry.js';
import { getDrainableVolume } from './liquid-disposal.js';
import { t } from '../core/i18n.js';
import { getCultureFridgeStorageTarget, isCultureAccessibleFromFridge } from '../items/culture-fridge.js';
import { PDA_POWDER_DOSE_GRAMS } from '../items/pda-mix.js';
import { formatSprayHoverPrompt, getSanitizationStatus } from '../items/alcohol-spray.js';
import { canDisposeItemInTrash, getTrashActionLabel } from '../items/lab-trash.js';
import { isItemInClosedCabinet } from '../items/lab-cabinets.js';
import {
  monotubRackHitMeshes,
  isHoldingColonizedGrainSpawn,
  isHoldingPasteurizedBulkSubstrate
} from '../items/monotub.js';
import { gardenHitMeshes, isHoldingSpentCakeForCompost } from '../world/campus-garden.js';
import { roadSaleStandMeshes } from '../world/roadside-stand-state.js';
import { isHoldingPackOrCrateForStand } from '../world/roadside-stand.js';
import { MYCOCOIN_PRICE_PER_PACK } from '../core/myco-coins.js';

function getRefXZ(ctx) {
  return {
    x: ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x,
    z: ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z
  };
}

function hidePlacementGhost(ctx) {
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
}


/**
 * Busca o primeiro ou mais próximo item interagível sob o raycaster.
 * @param {object} ctx
 * @param {number} maxDist
 * @param {function(object): boolean} filterFn
 * @param {function(object, THREE.Raycaster): object|null} intersectPickableItem
 * @param {{ nearest?: boolean, requireFridgeAccess?: boolean }} [opts]
 */
function findPickableHit(ctx, maxDist, filterFn, intersectPickableItem, opts) {
  const nearest = opts && opts.nearest;
  const requireFridgeAccess = opts && opts.requireFridgeAccess;
  const ref = getRefXZ(ctx);
  const ray = ctx.raycaster && ctx.raycaster.ray;
  const ro = ray && ray.origin;
  const rd = ray && ray.direction;
  let bestSmallDist = maxDist;
  let bestSmall = null;
  let bestBigDist = maxDist;
  let bestBig = null;

  for (let i = 0; i < ctx.pickableItems.length; i++) {
    const cand = ctx.pickableItems[i];
    if (cand === ctx.heldItem || ctx.isHeldByRemote(cand.id) || isItemInClosedCabinet(ctx, cand)) continue;
    if (requireFridgeAccess && !isCultureAccessibleFromFridge(ctx, cand)) continue;
    if (filterFn && !filterFn(cand)) continue;
    const dx = cand.mesh.position.x - ref.x;
    const dz = cand.mesh.position.z - ref.z;
    if (dx * dx + dz * dz > 100) continue;
    if (ro && rd && (dx * dx + dz * dz) > 2.25) {
      const dot = (cand.mesh.position.x - ro.x) * rd.x + (cand.mesh.position.z - ro.z) * rd.z;
      if (dot < -0.6) continue;
    }
    const hit = intersectPickableItem(ctx.raycaster, cand);
    if (!hit || hit.distance >= maxDist) continue;
    if (isRayOccludedByStructure(ctx, hit.distance, {
      checkWalls: true,
      ignoreCollider: cand.mesh && cand.mesh.userData && cand.mesh.userData.dynamicCollider
    })) continue;
    if (!nearest) return { item: cand, hit };
    const isBig = !!(cand.mesh && cand.mesh.userData && cand.mesh.userData.twoHanded);
    if (isBig) {
      if (hit.distance < bestBigDist) {
        bestBigDist = hit.distance;
        bestBig = { item: cand, hit };
      }
    } else if (hit.distance < bestSmallDist) {
      bestSmallDist = hit.distance;
      bestSmall = { item: cand, hit };
    }
  }
  return bestSmall || bestBig;
}

function getSyringeTargetHint(spawn, syringeVolume, pdaAgarReady, pdaMedium) {
  if (syringeVolume <= 0) return t('actions.held.syringe_empty');
  if (!spawn.filled) return t('actions.held.syringe_need_substrate');
  if (spawn.substrateKind === 'coco_verm' || spawn.substrateKind === 'sawdust') {
    return t('actions.held.syringe_bulk_invalid');
  }
  if (spawn.burned) return t('actions.held.syringe_burned');
  if (spawn.contaminated) return t('actions.held.syringe_contam');
  if (spawn.inoculated) return t('actions.held.syringe_inoculated');
  if (spawn.substrateKind === 'pda' && (!pdaMedium || !pdaMedium.mixed || !pdaMedium.sterilized || pdaMedium.burned)) {
    return t('actions.held.syringe_pda_unprepared');
  }
  if (spawn.isPP5 && (spawn.waterMl || 0) < 35 && !pdaAgarReady) return t('actions.held.syringe_pp5_hydrate');
  if (spawn.isBag && !spawn.sealed) return t('actions.held.syringe_bag_seal');
  if (!spawn.sterilized) return t('actions.held.syringe_need_sterilize');
  return t('actions.held.syringe_not_ready');
}

function handleChalkboardHover(ctx, setHoverPrompt) {
  const toolCol = getHeldBoardToolColor(ctx.heldItem);
  if (!toolCol || !ctx.chalkboardMeshes.length) return false;
  const bHits = ctx.raycaster.intersectObjects(ctx.chalkboardMeshes, false);
  if (bHits.length === 0 || bHits[0].distance >= 3.8 || !bHits[0].uv) return false;
  ctx.hoveredBoardHit = bHits[0];
  ctx.hoverHit = bHits[0];
  ctx.hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
  hidePlacementGhost(ctx);
  const touchUi = ctx.isTouchDevice();
  setHoverPrompt(ctx, t(toolCol === 'erase'
    ? (touchUi ? 'actions.held.board_erase_touch' : 'actions.held.board_erase_mouse')
    : (touchUi ? 'actions.held.board_write_touch' : 'actions.held.board_write_mouse')));
  return true;
}

function handleH2O2SprayHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh.userData.isH2O2Spray || ctx.placementMode) return false;
  let bestTarget = null;
  let bestLabel = '';
  let bestDist = 4.2;
  let bestPoint = null;
  let bestHitObj = null;

  const pickHit = findPickableHit(
    ctx,
    bestDist,
    (cand) => !!(cand.monotubCtrl || cand.spawnCtrl || cand.cultureCtrl),
    intersectPickableItem,
    { nearest: true }
  );
  if (pickHit) {
    bestDist = pickHit.hit.distance;
    bestTarget = pickHit.item;
    bestLabel = pickHit.item.label;
    bestPoint = pickHit.hit.point;
    bestHitObj = pickHit.hit;
  }
  if (greenhouseHitMeshes.length > 0) {
    const ghHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseHitMeshes, true), bestDist, { checkWalls: true });
    if (ghHit && ghHit.object.userData.greenhouseSlot) {
      const hSlot = ghHit.object.userData.greenhouseSlot;
      bestDist = ghHit.distance;
      bestTarget = hSlot;
      bestLabel = hSlot.name;
      bestPoint = ghHit.point;
      bestHitObj = ghHit;
      ctx.hoveredGreenhouseSlot = hSlot;
    }
  }
  hidePlacementGhost(ctx);
  ctx.hoverHit = bestHitObj;
  ctx.hoveredH2O2Target = bestTarget ? { target: bestTarget, label: bestLabel, hitPoint: bestPoint } : null;
  let prompt = t('actions.held.h2o2_default');
  if (bestTarget) {
    const isCobweb = !!(
      (bestTarget.monotubCtrl && bestTarget.monotubCtrl.contaminated && bestTarget.monotubCtrl.contamKind === 'cobweb') ||
      (bestTarget.spawnCtrl && bestTarget.spawnCtrl.contaminated && bestTarget.spawnCtrl.contamKind === 'cobweb') ||
      (bestTarget.contaminated && bestTarget.contamKind === 'cobweb')
    );
    prompt = t(isCobweb ? 'actions.held.h2o2_cobweb' : 'actions.held.h2o2_preventive', { label: bestLabel });
  }
  setHoverPrompt(ctx, prompt);
  return true;
}

function handleWaterSprayHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh.userData.isWaterSpray || ctx.placementMode) return false;
  let bestTarget = null;
  let bestLabel = '';
  let bestDist = 4.2;
  let bestPoint = null;
  let bestHitObj = null;

  const pickHit = findPickableHit(ctx, bestDist, (c) => !!c.monotubCtrl, intersectPickableItem, { nearest: true });
  if (pickHit) {
    bestDist = pickHit.hit.distance;
    bestTarget = pickHit.item;
    bestLabel = pickHit.item.label;
    bestPoint = pickHit.hit.point;
    bestHitObj = pickHit.hit;
  }
  if (greenhouseHitMeshes.length > 0) {
    const ghHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseHitMeshes, true), bestDist, { checkWalls: true });
    if (ghHit && ghHit.object.userData.greenhouseSlot) {
      const hSlot = ghHit.object.userData.greenhouseSlot;
      bestDist = ghHit.distance;
      bestTarget = hSlot;
      bestLabel = hSlot.name;
      bestPoint = ghHit.point;
      bestHitObj = ghHit;
      ctx.hoveredGreenhouseSlot = hSlot;
    }
  }
  hidePlacementGhost(ctx);
  ctx.hoverHit = bestHitObj;
  ctx.hoveredSprayTarget = { target: bestTarget, label: bestLabel, hitPoint: bestPoint };
  if (bestTarget && bestTarget.monotubCtrl) {
    const mc = bestTarget.monotubCtrl;
    setHoverPrompt(ctx, mc.colonization >= 100 && !mc.spent && !mc.contaminated
      ? t('actions.held.water_spray_monotub', { humidity: Math.round(mc.humidity || 70) })
      : t('actions.held.water_spray_monotub_wait'));
  } else if (bestTarget && bestTarget.id !== undefined) {
    setHoverPrompt(ctx, bestTarget.empty
      ? t('actions.held.water_spray_gh_empty')
      : t('actions.held.water_spray_gh_hydrate', { label: bestLabel, humidity: Math.round(bestTarget.humidity) }));
  } else {
    setHoverPrompt(ctx, t('actions.held.water_spray_default'));
  }
  return true;
}

function handleAlcoholSprayHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh.userData.isAlcoholSpray || ctx.placementMode) return false;
  let bestTarget = null;
  let bestLabel = '';
  let bestDist = 4.2;
  let bestPoint = null;
  let bestHitObj = null;

  const pickHit = findPickableHit(ctx, bestDist, null, intersectPickableItem, { nearest: true });
  if (pickHit) {
    bestDist = pickHit.hit.distance;
    bestTarget = pickHit.item.mesh.userData.isHood ? 'hood' : pickHit.item;
    bestLabel = pickHit.item.label;
    bestPoint = pickHit.hit.point;
    bestHitObj = pickHit.hit;
  }
  if (greenhouseHitMeshes.length > 0) {
    const ghHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseHitMeshes, true), bestDist, { checkWalls: true });
    if (ghHit && ghHit.object.userData.greenhouseSlot) {
      const hSlot = ghHit.object.userData.greenhouseSlot;
      bestDist = ghHit.distance;
      bestTarget = hSlot;
      bestLabel = hSlot.name;
      bestPoint = ghHit.point;
      bestHitObj = ghHit;
      ctx.hoveredGreenhouseSlot = hSlot;
    }
  }
  if (!bestTarget && ctx.doorHitMeshes.length) {
    const dHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false), bestDist);
    if (dHit && dHit.object.userData.doorObj) {
      bestDist = dHit.distance;
      bestTarget = dHit.object.userData.doorObj;
      bestLabel = bestTarget.label || t('actions.held.door_default');
      bestPoint = dHit.point;
      bestHitObj = dHit;
    }
  }
  if (!bestTarget && ctx.blindHitMeshes.length) {
    const bHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false), bestDist);
    if (bHit && bHit.object.userData.blindObj) {
      bestDist = bHit.distance;
      bestTarget = bHit.object.userData.blindObj;
      bestLabel = t('actions.held.blind_default');
      bestPoint = bHit.point;
      bestHitObj = bHit;
    }
  }
  hidePlacementGhost(ctx);
  ctx.hoverHit = bestHitObj;
  ctx.hoveredSprayTarget = { target: bestTarget, label: bestLabel, hitPoint: bestPoint };
  if (bestTarget && bestTarget.monotubCtrl && bestTarget.monotubCtrl.colonization >= 100 && !bestTarget.monotubCtrl.spent && !bestTarget.monotubCtrl.contaminated) {
    setHoverPrompt(ctx, t('actions.held.alcohol_monotub_warn'));
  } else if (ctx.hoveredGreenhouseSlot && !ctx.hoveredGreenhouseSlot.empty) {
    setHoverPrompt(ctx, t('actions.held.alcohol_gh_warn'));
  } else {
    setHoverPrompt(ctx, bestTarget
      ? formatSprayHoverPrompt(bestTarget, bestLabel, ctx)
      : t('actions.held.alcohol_default'));
  }
  return true;
}

function handlePaperTowelHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh.userData.isPaperTowel || ctx.placementMode) return false;
  let bestTarget = null;
  let bestLabel = '';
  let bestDist = 4.2;
  let bestHitObj = null;

  const pickHit = findPickableHit(ctx, bestDist, null, intersectPickableItem, { nearest: true });
  if (pickHit) {
    bestDist = pickHit.hit.distance;
    bestTarget = pickHit.item.mesh.userData.isHood ? 'hood' : pickHit.item;
    bestLabel = pickHit.item.label;
    bestHitObj = pickHit.hit;
  }
  if (greenhouseHitMeshes.length > 0) {
    const ghHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseHitMeshes, true), bestDist, { checkWalls: true });
    if (ghHit && ghHit.object.userData.greenhouseSlot) {
      const hSlot = ghHit.object.userData.greenhouseSlot;
      bestDist = ghHit.distance;
      bestTarget = hSlot;
      bestLabel = hSlot.name;
      bestHitObj = ghHit;
    }
  }
  if (!bestTarget && ctx.doorHitMeshes && ctx.doorHitMeshes.length) {
    const dHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false), bestDist);
    if (dHit && dHit.object.userData.doorObj) {
      bestDist = dHit.distance;
      bestTarget = dHit.object.userData.doorObj;
      bestLabel = bestTarget.label || t('actions.held.door_default');
      bestHitObj = dHit;
    }
  }
  if (!bestTarget && ctx.blindHitMeshes && ctx.blindHitMeshes.length) {
    const bHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false), bestDist);
    if (bHit && bHit.object.userData.blindObj) {
      bestDist = bHit.distance;
      bestTarget = bHit.object.userData.blindObj;
      bestLabel = t('actions.held.blind_default');
      bestHitObj = bHit;
    }
  }

  hidePlacementGhost(ctx);
  ctx.hoverHit = bestHitObj;
  ctx.hoveredWipeTarget = bestTarget ? { target: bestTarget, label: bestLabel } : null;
  if (!bestTarget) {
    setHoverPrompt(ctx, t('actions.held.paper_default'));
    return true;
  }
  const st = getSanitizationStatus(bestTarget, ctx);
  const wPrompt = st.alcoholWet
    ? t('actions.held.paper_dry', { label: bestLabel })
    : (st.isSanitized
      ? t('actions.held.paper_reset', { sec: st.remainingSec, label: bestLabel })
      : t('actions.held.paper_need_alcohol', { label: bestLabel }));
  setHoverPrompt(ctx, wPrompt);
  return true;
}

function handleParafilmHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.placementMode || !ctx.heldItem.id) return false;
  if (ctx.heldItem.id.indexOf('parafilm_') === 0) {
    const res = findPickableHit(ctx, 3.5, (c) => !!(c.mesh && c.mesh.userData.isPetri), intersectPickableItem, { requireFridgeAccess: true });
    if (!res) return false;
    ctx.hoverHit = res.hit;
    ctx.hoveredParafilmTarget = res.item;
    hidePlacementGhost(ctx);
    const pc = res.item.mesh.userData.petriCtrl;
    const pfPrompt = pc.lidOpen
      ? t('actions.held.parafilm_close_lid')
      : (pc.parafilmSealed
        ? t('actions.held.parafilm_already_sealed')
        : (pc.mode === 'bare'
          ? t('actions.held.parafilm_need_pda')
          : t('actions.held.parafilm_seal', { label: res.item.label })));
    setHoverPrompt(ctx, pfPrompt);
    return true;
  }
  if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData && ctx.heldItem.mesh.userData.isFoilRoll) {
    const resF = findPickableHit(
      ctx,
      3.5,
      (c) => !!(c !== ctx.heldItem && ((c.spawnCtrl && !c.spawnCtrl.isBag && !c.spawnCtrl.isPP5) || c.cultureCtrl || (c.pdaMediumCtrl && !c.pdaMediumCtrl.isSlant))),
      intersectPickableItem
    );
    if (!resF) return false;
    ctx.hoverHit = resF.hit;
    ctx.hoveredFoilTarget = resF.item;
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, t(resF.item.foilWrapped ? 'actions.held.foil_already' : 'actions.held.foil_wrap', { label: resF.item.label }));
    return true;
  }
  if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData && ctx.heldItem.mesh.userData.isMicropore) {
    const resM = findPickableHit(
      ctx,
      3.5,
      (c) => !!(c !== ctx.heldItem && ((c.mesh && c.mesh.userData && c.mesh.userData.isPetri) || c.spawnCtrl || c.monotubCtrl)),
      intersectPickableItem
    );
    if (!resM) return false;
    ctx.hoverHit = resM.hit;
    ctx.hoveredMicroporeTarget = resM.item;
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, t(resM.item.microporeSealed ? 'actions.held.micropore_already' : 'actions.held.micropore_apply', { label: resM.item.label }));
    return true;
  }
  if (ctx.heldItem.lcNutrientCtrl) {
    const resN = findPickableHit(
      ctx,
      3.5,
      (c) => !!(c !== ctx.heldItem && c.cultureCtrl && c.mesh && c.mesh.userData && c.mesh.userData.liquidCtrl && !c.pdaMediumCtrl),
      intersectPickableItem
    );
    if (!resN) return false;
    ctx.hoverHit = resN.hit;
    ctx.hoveredLcNutrientTarget = resN.item;
    hidePlacementGhost(ctx);
    const dLc = resN.item.mesh.userData.liquidCtrl;
    const dose = Math.max(2, Math.round((dLc.volMl || 0) * 0.04));
    setHoverPrompt(ctx, dLc.volMl < 50
      ? t('actions.held.lc_nutrient_need_water')
      : t('actions.held.lc_nutrient_add', { dose, vol: dLc.volMl, label: resN.item.label }));
    return true;
  }
  return false;
}

function handleTrashHover(ctx, setHoverPrompt) {
  if (ctx.placementMode || !ctx.labTrashMeshes || !ctx.labTrashMeshes.length || !canDisposeItemInTrash(ctx.heldItem)) return false;
  const hit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.labTrashMeshes, false), 3.5, {
    checkWalls: true,
    ignoreCollider: ctx.pickableMap?.get('lab_trash_01')?.mesh.userData.dynamicCollider
  });
  if (!hit) return false;
  ctx.hoveredTrash = true;
  ctx.hoverHit = hit;
  hidePlacementGhost(ctx);
  setHoverPrompt(ctx, getTrashActionLabel(ctx.heldItem));
  return true;
}

function handlePdaReagentHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.pdaReagentCtrl) return false;
  const res = findPickableHit(
    ctx,
    3.5,
    (c) => !!(c.pdaMediumCtrl && c.pdaMediumCtrl.kind === 'beaker' && c.meta && c.meta.compatibilities && c.meta.compatibilities.receivesPdaWater),
    intersectPickableItem
  );
  if (!res) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredPdaTarget = res.item;
  hidePlacementGhost(ctx);
  setHoverPrompt(ctx, t('actions.held.pda_add_powder', { grams: PDA_POWDER_DOSE_GRAMS }));
  return true;
}

function handleHeatSealerHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.sealsBags) {
    const res = findPickableHit(ctx, 3.5, (c) => !!(c.spawnCtrl && c.spawnCtrl.isBag), intersectPickableItem);
    if (res) {
      ctx.hoverHit = res.hit;
      ctx.hoveredHeatSealerTarget = res.item;
      hidePlacementGhost(ctx);
      const hSc = res.item.spawnCtrl;
      const hPrompt = canSealSpawnBag(res.item)
        ? t('actions.held.sealer_seal_bag', { label: res.item.label })
        : (!hSc.filled
          ? t('actions.held.sealer_fill_first')
          : (hSc.sealed
            ? t('actions.held.sealer_already_sealed')
            : (hSc.sterilized || hSc.inoculated
              ? t('actions.held.sealer_before_sterilize')
              : t(hSc.burned ? 'actions.held.sealer_burned' : 'actions.held.sealer_contam'))));
      setHoverPrompt(ctx, hPrompt);
      return true;
    }
  }
  if (ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.isBag && !ctx.placementMode) {
    const res = findPickableHit(
      ctx,
      3.5,
      (c) => !!(c.meta && c.meta.compatibilities && c.meta.compatibilities.sealsBags),
      intersectPickableItem
    );
    if (res) {
      ctx.hoverHit = res.hit;
      ctx.hoveredHeatSealerTarget = ctx.heldItem;
      hidePlacementGhost(ctx);
      const hSc = ctx.heldItem.spawnCtrl;
      const hPrompt = canSealSpawnBag(ctx.heldItem)
        ? t('actions.held.sealer_seal_held')
        : (!hSc.filled
          ? t('actions.held.sealer_fill_first')
          : t(hSc.sealed ? 'actions.held.sealer_already_sealed' : 'actions.held.sealer_invalid_state'));
      setHoverPrompt(ctx, hPrompt);
      return true;
    }
  }
  return false;
}

function handleCookerLidSnapHover(ctx, setHoverPrompt) {
  if (!ctx.heldItem || !ctx.heldItem.potItem || ctx.placementMode) return false;
  for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
    const cp = ctx.cookerPots[ci];
    const targetPot = cp.potItem;
    if (targetPot.lidItem && targetPot.lidItem.isAttached && targetPot.lidItem !== ctx.heldItem) continue;
    const cpHits = ctx.raycaster.intersectObject(targetPot.mesh, true).filter((h) => !h.object.userData || !h.object.userData.ignoreRay);
    if (cpHits.length > 0 && cpHits[0].distance < 4.5) {
      ctx.hoverHit = cpHits[0];
      ctx.hoveredSnapPot = targetPot;
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t('actions.held.cooker_snap_lid', { label: targetPot.label }));
      return true;
    }
  }
  return false;
}

function handleCookerInsertHover(ctx, setHoverPrompt) {
  if (ctx.placementMode || !canItemEnterCooker(ctx.heldItem)) return false;
  for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
    const cp = ctx.cookerPots[ci];
    if ((cp.lidItem && cp.lidItem.isAttached) || cp.contents.length >= 6) continue;
    const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true).filter((h) => !h.object.userData || !h.object.userData.ignoreRay);
    if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
      ctx.hoverHit = cpHits[0];
      ctx.hoveredPotInsert = cp;
      const isBase = !!(ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isCookerBase);
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      if (isBase && ctx.placementGhost) {
        const potP = cp.potItem.mesh.position;
        ctx.placementGhost.position.set(potP.x, potP.y + 0.036, potP.z);
        updatePlacementGhostVisual(ctx.heldItem, !hasBase, cp.potItem.mesh.rotation.y, ctx.clock.elapsedTime);
      } else {
        hidePlacementGhost(ctx);
      }
      const potPrompt = ctx.heldItem.mesh.userData.petriCtrl?.lidOpen
        ? t('actions.held.cooker_close_petri_lid')
        : isBase
        ? (hasBase
          ? t('actions.held.cooker_has_base')
          : (cp.waterMl > 4000
            ? t('actions.held.cooker_too_much_water')
            : t('actions.held.cooker_insert_base')))
        : (!hasBase
          ? t('actions.held.cooker_need_base')
          : t('actions.held.cooker_insert_item', { label: ctx.heldItem.label }));
      setHoverPrompt(ctx, potPrompt);
      return true;
    }
  }
  return false;
}

function handleSinkHover(ctx, setHoverPrompt) {
  if (!ctx.labSinkMeshes || !ctx.labSinkMeshes.length) return false;
  const isPotHeld = ctx.cookerPots.some((cp) => cp.potItem === ctx.heldItem && !(cp.lidItem && cp.lidItem.isAttached));
  const isLiquidHeld = canFillFromSink(ctx.heldItem);
  const isBowlHeld = !!(ctx.heldItem && ctx.heldItem.bowlCtrl);
  const isDrySpawnHeld = !!(ctx.heldItem && ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.filled &&
    ctx.heldItem.spawnCtrl.hydrated === false && !ctx.heldItem.spawnCtrl.sterilized && !ctx.heldItem.spawnCtrl.inoculated);
  const isDunkMonotubHeld = !!(ctx.heldItem && ctx.heldItem.monotubCtrl &&
    ctx.heldItem.monotubCtrl.colonization >= 100 && !ctx.heldItem.monotubCtrl.spent && !ctx.heldItem.monotubCtrl.contaminated);
  const canDrain = getDrainableVolume(ctx, ctx.heldItem) > 0;
  const canFill = isPotHeld || isLiquidHeld || isBowlHeld || isDrySpawnHeld;
  if (!canFill && !canDrain && !isDunkMonotubHeld) return false;
  const hits = ctx.raycaster.intersectObjects(ctx.labSinkMeshes, false);
  const hit = hits.find(candidate => candidate.distance < 3.5 && !isRayOccludedByStructure(ctx, candidate.distance, {
    checkWalls: true,
    ignoreCollider: candidate.object.userData.labSink?.collider
  }));
  if (!hit) return false;
  const sinkAction = hit.object.userData.sinkAction || 'fill';
  if (sinkAction === 'drain' && !isDunkMonotubHeld) {
    if (!canDrain) return false;
    ctx.hoverHit = hit;
    ctx.hoveredSink = hit.object.userData.labSink;
    ctx.hoveredSinkAction = 'drain';
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, t('liquid.drain_sink'));
    return true;
  }
  if (sinkAction === 'fill' && !canFill && !isDunkMonotubHeld) return false;
  ctx.hoverHit = hit;
  if (isDunkMonotubHeld) {
    ctx.hoveredMonotubDunkSink = true;
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, t('actions.held.sink_dunk_monotub', { flush: ctx.heldItem.monotubCtrl.flush }));
    return true;
  }
  ctx.hoveredSink = hit.object.userData.labSink;
  ctx.hoveredSinkAction = sinkAction;
  hidePlacementGhost(ctx);
  if (isDrySpawnHeld) {
    const scDry = ctx.heldItem.spawnCtrl;
    setHoverPrompt(ctx, t('actions.held.sink_hydrate_grain', { water: Math.round(scDry.waterMl || 0) }));
    return true;
  }
  if (isBowlHeld) {
    const bc = ctx.heldItem.bowlCtrl;
    if (bc.mixed) {
      setHoverPrompt(ctx, t('actions.held.sink_bowl_mixed'));
    } else if (sinkAction === 'drain') {
      const w = Math.round(bc.ingredients.water || 0);
      setHoverPrompt(ctx, w > 0
        ? t('actions.held.sink_bowl_drain', { water: w })
        : t('actions.held.sink_bowl_solids_only'));
    } else {
      const tot = Math.round(Object.values(bc.ingredients).reduce((a, b) => a + b, 0));
      setHoverPrompt(ctx, t('actions.held.sink_bowl_fill', { total: tot }));
    }
    return true;
  }
  const sinkLc = ctx.heldItem.mesh && ctx.heldItem.mesh.userData && ctx.heldItem.mesh.userData.liquidCtrl;
  const sinkPot = ctx.cookerPots.find((cp) => cp.potItem === ctx.heldItem);
  const curVol = sinkLc ? sinkLc.volMl : (sinkPot ? sinkPot.waterMl : 0);
  const maxVol = sinkLc ? sinkLc.maxMl : (sinkPot ? (sinkPot.hasBase ? 4000 : 10000) : 0);
  const volTxt = sinkLc
    ? ' • ' + Math.round(sinkLc.volMl) + '/' + sinkLc.maxMl + ' ml'
    : (sinkPot ? ' • ' + (sinkPot.waterMl / 1000).toFixed(1) + '/' + (maxVol / 1000).toFixed(0) + ' L' : '');
  setHoverPrompt(ctx, t(sinkAction === 'drain' ? 'actions.held.sink_drain_item' : 'actions.held.sink_fill_item', { label: ctx.heldItem.label, vol: volTxt }));
  return true;
}

function handleLiquidPourHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh || !ctx.heldItem.mesh.userData.liquidCtrl || ctx.heldItem.mesh.userData.liquidCtrl.volMl <= 0) return false;
  const sourceHasPda = hasPdaContents(ctx.heldItem);
  const sourceCanPourWater = !!(ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.poursWater);
  const isTubeSlantOrCulture = !!(
    (ctx.heldItem.id && ctx.heldItem.id.indexOf('falcon_') === 0) ||
    ctx.heldItem.cultureCtrl ||
    (ctx.heldItem.mesh && ctx.heldItem.mesh.userData && ctx.heldItem.mesh.userData.cultureCtrl) ||
    (ctx.heldItem.pdaMediumCtrl && ctx.heldItem.pdaMediumCtrl.isSlant)
  );

  if (sourceCanPourWater && !sourceHasPda && !isTubeSlantOrCulture) {
    const beakerRes = findPickableHit(
      ctx,
      3.5,
      (c) => !!(c.pdaMediumCtrl && c.pdaMediumCtrl.kind === 'beaker' && c.meta && c.meta.compatibilities && c.meta.compatibilities.receivesPdaPowder),
      intersectPickableItem
    );
    if (beakerRes) {
      ctx.hoverHit = beakerRes.hit;
      ctx.hoveredPdaTarget = beakerRes.item;
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t(beakerRes.item.pdaMediumCtrl.powderGrams > 0
        ? 'actions.held.pour_beaker_complete_pda'
        : 'actions.held.pour_beaker_add_water'));
      return true;
    }
    for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
      const cp = ctx.cookerPots[ci];
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      const potWaterCap = hasBase ? 4000 : 10000;
      if ((cp.lidItem && cp.lidItem.isAttached) || cp.waterMl >= potWaterCap) continue;
      const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
      if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
        ctx.hoverHit = cpHits[0];
        ctx.hoveredFillPot = cp;
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.pour_pot_water', { cur: (cp.waterMl / 1000).toFixed(1), max: (potWaterCap / 1000).toFixed(1) }));
        return true;
      }
    }
  }

  let matchedMode = null;
  const pourRes = findPickableHit(ctx, 3.5, (pCand) => {
    const isPourableLc = !!(pCand.mesh && pCand.mesh.userData.liquidCtrl &&
      pCand.mesh.userData.liquidCtrl.volMl < pCand.mesh.userData.liquidCtrl.maxMl &&
      !(pCand.spawnCtrl && pCand.spawnCtrl.isPP5) &&
      pCand.meta && pCand.meta.compatibilities &&
      (sourceHasPda ? pCand.meta.compatibilities.acceptsPdaMedium : sourceCanPourWater && pCand.meta.compatibilities.receivesWater));
    const isPourablePP5 = !!(pCand.spawnCtrl && pCand.spawnCtrl.isPP5 &&
      (sourceHasPda
        ? !pCand.spawnCtrl.filled && pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.acceptsPdaMedium
        : sourceCanPourWater && pCand.spawnCtrl.filled && (pCand.spawnCtrl.waterMl || 0) < 35 &&
          pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.receivesWater));
    const isPourableDryGrain = !!(!sourceHasPda && sourceCanPourWater && pCand.spawnCtrl && !pCand.spawnCtrl.isPP5 &&
      pCand.spawnCtrl.filled && pCand.spawnCtrl.hydrated === false);
    const isPourableBowl = !!(!sourceHasPda && sourceCanPourWater && pCand.bowlCtrl &&
      pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.receivesWater);
    const petriCtrl = pCand.mesh && pCand.mesh.userData.petriCtrl;
    const isPourablePetri = !!(sourceHasPda && petriCtrl && petriCtrl.mode === 'bare' &&
      pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.acceptsPdaMedium);
    if (!isPourableLc && !isPourablePP5 && !isPourableDryGrain && !isPourableBowl && !isPourablePetri) return false;
    matchedMode = { isPourablePetri, isPourablePP5, isPourableDryGrain, petriCtrl };
    return true;
  }, intersectPickableItem, { requireFridgeAccess: true });

  if (!pourRes || !matchedMode) return false;
  ctx.hoverHit = pourRes.hit;
  ctx.hoveredPourTarget = pourRes.item;
  hidePlacementGhost(ctx);
  const targetPrompt = matchedMode.isPourablePetri
    ? (matchedMode.petriCtrl.lidOpen
      ? t('actions.held.pour_petri_pda', { label: pourRes.item.label })
      : t('actions.held.pour_petri_open_first'))
    : (matchedMode.isPourableDryGrain
      ? t('actions.held.pour_hydrate_grain', { label: pourRes.item.label })
      : (matchedMode.isPourablePP5 && sourceHasPda
        ? t('actions.held.pour_pp5_pda', { label: pourRes.item.label })
        : t('actions.held.pour_water', { label: pourRes.item.label })));
  setHoverPrompt(ctx, targetPrompt);
  return true;
}

function handleFlocaoHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh || !ctx.heldItem.mesh.userData.isFlocao) return false;
  const heldCanAddFlocao = ctx.heldItem.meta && ctx.heldItem.meta.compatibilities && ctx.heldItem.meta.compatibilities.fillsPP5WithFlocao;
  let isBowlTarget = false;
  const res = findPickableHit(ctx, 3.5, (fCand) => {
    const canPP5 = !!(heldCanAddFlocao && fCand.spawnCtrl && fCand.spawnCtrl.isPP5 &&
      !fCand.spawnCtrl.filled && fCand.meta && fCand.meta.compatibilities && fCand.meta.compatibilities.receivesFlocao);
    const canBowl = !!(fCand.bowlCtrl && fCand.meta && fCand.meta.compatibilities && fCand.meta.compatibilities.receivesIngredients);
    if (!canPP5 && !canBowl) return false;
    isBowlTarget = canBowl;
    return true;
  }, intersectPickableItem);
  if (!res) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredFlocaoTarget = res.item;
  hidePlacementGhost(ctx);
  setHoverPrompt(ctx, isBowlTarget ? t('actions.held.flocao_bowl') : t('actions.held.flocao_pp5', { label: res.item.label }));
  return true;
}

function handleSpoonOrBowlHover(ctx, intersectPickableItem, setHoverPrompt) {
  const isSpoon = !!(ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isLabSpoon);
  const isMixedBowl = !!(ctx.heldItem.bowlCtrl && ctx.heldItem.bowlCtrl.mixed);
  if (!isSpoon && !isMixedBowl) return false;
  let isSpoonTarget = false;
  const res = findPickableHit(ctx, 3.5, (bCand) => {
    const spoonT = isSpoon && !!bCand.bowlCtrl;
    const portionT = isMixedBowl && bCand.spawnCtrl && !bCand.spawnCtrl.filled;
    if (!spoonT && !portionT) return false;
    isSpoonTarget = spoonT;
    return true;
  }, intersectPickableItem);
  if (!res) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredBowlTarget = res.item;
  hidePlacementGhost(ctx);
  const spoonKindCount = isSpoonTarget && res.item.bowlCtrl
    ? Object.values(res.item.bowlCtrl.ingredients || {}).filter((v) => v > 0).length
    : 0;
  const bIng = (isSpoonTarget && res.item.bowlCtrl && res.item.bowlCtrl.ingredients) || {};
  const bulkIncomplete = isSpoonTarget && ((bIng.coco || 0) > 0 || (bIng.vermiculite || 0) > 0 || (bIng.sawdust || 0) > 0) &&
    !(((bIng.coco || 0) > 0 && (bIng.vermiculite || 0) > 0 && (bIng.water || 0) > 0) || ((bIng.sawdust || 0) > 0 && (bIng.coco || 0) <= 0 && (bIng.vermiculite || 0) <= 0 && (bIng.water || 0) > 0));
  setHoverPrompt(ctx, isSpoonTarget
    ? (res.item.bowlCtrl && res.item.bowlCtrl.mixed
      ? t('actions.held.bowl_already_mixed')
      : (bulkIncomplete
        ? t(((bIng.sawdust || 0) > 0 && (bIng.coco || 0) <= 0 && (bIng.vermiculite || 0) <= 0)
          ? 'actions.held.bowl_sawdust_need_water'
          : 'actions.held.bowl_bulk_need_ingredients')
        : t(spoonKindCount < 2 ? 'actions.held.bowl_need_two_ingredients' : 'actions.held.bowl_hold_stir')))
    : t('actions.held.bowl_portion', { label: res.item.label }));
  return true;
}

function handleScalpelHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData && ctx.heldItem.mesh.userData.isScalpelBladePack) {
    if (ctx.heldItem.bladePackCtrl && ctx.heldItem.bladePackCtrl.empty) return false;
    const resB = findPickableHit(ctx, 3.5, (sCand) => !!sCand.scalpelCtrl, intersectPickableItem);
    if (!resB) return false;
    ctx.hoverHit = resB.hit;
    ctx.hoveredScalpelTarget = { mode: 'attach_blade_to_scalpel', item: resB.item };
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, t('actions.held.scalpel_attach_blade'));
    return true;
  }
  if (!ctx.heldItem.scalpelCtrl) return false;
  const sc = ctx.heldItem.scalpelCtrl;
  let matched = null;
  const res = findPickableHit(ctx, 3.5, (sCand) => {
    if (sCand.mesh.userData.isScalpelBladePack) {
      if (sCand.bladePackCtrl && sCand.bladePackCtrl.empty) {
        matched = { mode: 'blade', prompt: t('actions.held.scalpel_blade_pack_empty') };
      } else {
        matched = { mode: 'blade', prompt: t('actions.held.scalpel_swap_blade') };
      }
      return true;
    }
    const petriCtrl = sCand.mesh.userData.petriCtrl;
    if (!sc.hasMycelium && petriCtrl && petriCtrl.mode === 'spore_print') {
      matched = {
        mode: petriCtrl.lidOpen ? 'scrape_spores' : 'open',
        prompt: petriCtrl.lidOpen
          ? t('actions.held.scalpel_scrape_spores', { species: petriCtrl.speciesName || t('actions.held.mushroom_default') })
          : t('actions.held.scalpel_open_petri_spores')
      };
      return true;
    }
    if (!sc.hasMycelium && petriCtrl && petriCtrl.mode === 'clean' && petriCtrl.colonization >= 60) {
      matched = {
        mode: petriCtrl.lidOpen ? 'cut' : 'open',
        prompt: t(petriCtrl.lidOpen ? 'actions.held.scalpel_cut_petri' : 'actions.held.scalpel_open_petri_hood')
      };
      return true;
    }
    if (!sc.hasMycelium && sCand.pdaMediumCtrl && sCand.pdaMediumCtrl.isSlant && sCand.cultureCtrl &&
        sCand.cultureCtrl.colonized && !sCand.cultureCtrl.contaminated && !sCand.cultureCtrl.expired) {
      matched = { mode: 'cut', prompt: t('actions.held.scalpel_cut_slant', { label: sCand.label }) };
      return true;
    }
    if (!sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.colonization >= 60) {
      if (sCand.spawnCtrl.isPP5 && !sCand.spawnCtrl.lidOpen) {
        matched = { mode: 'open', prompt: t('actions.held.scalpel_open_pp5_cut') };
      } else {
        matched = { mode: 'cut', prompt: t('actions.held.scalpel_cut_spawn', { label: sCand.label }) };
      }
      return true;
    }
    if (!sc.hasMycelium && sCand.wildMushroomCtrl) {
      matched = { mode: 'biopsy', prompt: t('actions.held.scalpel_biopsy', { species: sCand.wildMushroomCtrl.speciesName }) };
      return true;
    }
    if (sc.hasMycelium && sCand.pdaMediumCtrl && sCand.pdaMediumCtrl.isSlant && sCand.pdaMediumCtrl.sterilized &&
        !sCand.pdaMediumCtrl.burned && sCand.cultureCtrl && !sCand.cultureCtrl.inoculated && !sCand.cultureCtrl.contaminated) {
      matched = { mode: 'transfer_slant', prompt: t('actions.held.scalpel_transfer_slant') };
      return true;
    }
    if (sc.hasMycelium && petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.sterilized) {
      matched = {
        mode: petriCtrl.lidOpen ? 'transfer' : 'open',
        prompt: petriCtrl.lidOpen
          ? t(sc.isSporeSample ? 'actions.held.scalpel_germinate_petri' : 'actions.held.scalpel_transfer_petri', { label: sCand.label })
          : t('actions.held.scalpel_open_petri_hood')
      };
      return true;
    }
    if (sc.hasMycelium && !sc.isSporeSample && petriCtrl && petriCtrl.mode === 'clean' && !petriCtrl.contaminated && !petriCtrl.hybridMutant) {
      matched = {
        mode: petriCtrl.lidOpen ? 'crossbreed' : 'open',
        prompt: t(petriCtrl.lidOpen ? 'actions.held.scalpel_crossbreed' : 'actions.held.scalpel_open_petri_cross')
      };
      return true;
    }
    if (sc.hasMycelium && sCand.cultureCtrl && !sCand.cultureCtrl.inoculated && !sCand.cultureCtrl.colonized &&
        !sCand.cultureCtrl.contaminated && !(sCand.pdaMediumCtrl && sCand.pdaMediumCtrl.isSlant) &&
        sCand.mesh.userData.liquidCtrl && sCand.mesh.userData.liquidCtrl.volMl > 0) {
      matched = { mode: 'transfer_lc', prompt: t(sc.isSporeSample ? 'actions.held.scalpel_germinate_lc' : 'actions.held.scalpel_transfer_lc') };
      return true;
    }
    if (sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.filled && !sCand.spawnCtrl.inoculated &&
        sCand.meta && sCand.meta.compatibilities && sCand.meta.compatibilities.receivesMyceliumCut) {
      if (sCand.spawnCtrl.isPP5 && !sCand.spawnCtrl.lidOpen) {
        matched = { mode: 'open', prompt: t('actions.held.scalpel_open_pp5_hood') };
      } else {
        matched = { mode: 'transfer', prompt: t('actions.held.scalpel_transfer_spawn', { label: sCand.label }) };
      }
      return true;
    }
    return false;
  }, intersectPickableItem, { requireFridgeAccess: true });

  if (!res || !matched) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredScalpelTarget = { mode: matched.mode, item: res.item };
  hidePlacementGhost(ctx);
  setHoverPrompt(ctx, matched.prompt);
  return true;
}

function handleSubstrateHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.heldItem.spawnCtrl && !ctx.heldItem.spawnCtrl.filled && !ctx.heldItem.spawnCtrl.burned) {
    for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
      const cp = ctx.cookerPots[ci];
      if ((cp.lidItem && cp.lidItem.isAttached) || !cp.grainAlDente || (cp.grainGrams || 0) <= 0) continue;
      const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
      if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
        ctx.hoverHit = cpHits[0];
        ctx.hoveredCornScoopPot = cp;
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.cooker_scoop_corn', { label: ctx.heldItem.label, grams: Math.round(cp.grainGrams) }));
        return true;
      }
    }
  }
  if (!ctx.heldItem.id || ctx.heldItem.id.indexOf('substrate_') !== 0) return false;
  if (ctx.heldItem.id.indexOf('substrate_grain_') === 0 || ctx.heldItem.id.indexOf('substrate_wheat_') === 0 || ctx.heldItem.id.indexOf('substrate_sorghum_') === 0) {
    for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
      const cp = ctx.cookerPots[ci];
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      if ((cp.lidItem && cp.lidItem.isAttached) || hasBase || cp.waterMl < 3500 || (cp.grainGrams || 0) >= 4000) continue;
      const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
      if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
        ctx.hoverHit = cpHits[0];
        ctx.hoveredGrainCooker = cp;
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.cooker_add_grain', { grams: Math.round(cp.grainGrams || 0) }));
        return true;
      }
    }
  }
  const heldId = (ctx.heldItem && ctx.heldItem.id) || '';
  const isVerm = heldId.indexOf('vermiculite') !== -1;
  const isSawdust = heldId.indexOf('sawdust') !== -1;
  const isCoco = !isSawdust && heldId.indexOf('coco') !== -1;
  const isSorghum = heldId.indexOf('sorghum') !== -1;
  const isWheat = heldId.indexOf('wheat') !== -1;
  const isRawBulkPart = isVerm || isCoco || isSawdust;
  let isBowl = false;
  const res = findPickableHit(ctx, 3.5, (gCand) => {
    const recSub = !isRawBulkPart && !!(gCand.spawnCtrl && !gCand.spawnCtrl.filled &&
      gCand.meta && gCand.meta.compatibilities && gCand.meta.compatibilities.receivesSubstrate);
    const recIng = !!(gCand.bowlCtrl && gCand.meta && gCand.meta.compatibilities && gCand.meta.compatibilities.receivesIngredients);
    if (!recSub && !recIng) return false;
    isBowl = recIng;
    return true;
  }, intersectPickableItem);
  if (!res) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredGrainTarget = res.item;
  hidePlacementGhost(ctx);
  const subName = t(isVerm
    ? 'actions.lab.sub_vermiculite'
    : (isSawdust
      ? 'actions.lab.sub_sawdust'
      : (isCoco
        ? 'actions.lab.sub_coco'
        : (isSorghum ? 'actions.lab.sub_sorghum' : (isWheat ? 'actions.lab.sub_wheat' : 'actions.lab.sub_corn')))));
  setHoverPrompt(ctx, isBowl
    ? t('actions.held.substrate_bowl', { substrate: subName })
    : t('actions.held.substrate_fill', { label: res.item.label, substrate: subName }));
  return true;
}

function handleSyringeHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh.userData.isSyringe || !ctx.heldItem.meta ||
      !ctx.heldItem.meta.compatibilities || !ctx.heldItem.meta.compatibilities.transfersLiquidCulture) {
    return false;
  }
  const sc = ctx.heldItem.mesh.userData.syrCtrl;
  const res = findPickableHit(
    ctx,
    4.2,
    (cand) => !!(
      (cand.mesh && cand.mesh.userData && (cand.mesh.userData.liquidCtrl || cand.mesh.userData.isPetri)) ||
      cand.spawnCtrl
    ),
    intersectPickableItem,
    { nearest: true, requireFridgeAccess: true }
  );
  if (!res) return false;
  const cand = res.item;
  ctx.hoverHit = res.hit;

  if (cand.spawnCtrl && cand.spawnCtrl.isPP5 && cand.spawnCtrl.filled && !cand.spawnCtrl.inoculated) {
    if (!cand.spawnCtrl.lidOpen) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'open' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t('actions.held.syringe_open_pp5_hood'));
      return true;
    }
    if (canSyringeTarget(cand) && sc.volMl >= 1 && sc.mix?.lcMl > 0.05) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t('actions.held.syringe_drop_pp5', { label: cand.label }));
      return true;
    }
    if (canSyringeTarget(cand)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
      setHoverPrompt(ctx, t('actions.held.syringe_need_1ml_pp5'));
      return true;
    }
  }

  if (cand.mesh.userData.liquidCtrl && !(cand.spawnCtrl && cand.spawnCtrl.isPP5)) {
    const lc = cand.mesh.userData.liquidCtrl;
    if (ctx.syringePumping) {
      ctx.hoveredSyringeTarget = { item: cand, mode: ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'draw' : 'inject' };
      hidePlacementGhost(ctx);
      const pPct = Math.round((ctx.syringePumping.elapsed / ctx.syringePumping.duration) * 100);
      setHoverPrompt(ctx, t(ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'actions.held.syringe_drawing' : 'actions.held.syringe_injecting', { pct: pPct }));
      return true;
    }
    const hasCulture = (sc.mix?.lcMl || 0) > 0.05;
    const culture = cand.cultureCtrl;
    const prepareCulture = hasCulture && culture && !culture.inoculated && !culture.colonized && !culture.contaminated;
    if (prepareCulture && (culture.hasNutrient === false || lc.volMl <= 0)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
      setHoverPrompt(ctx, t('actions.held.syringe_prepare_broth'));
      return true;
    }
    const canDraw = sc.volMl < 10 && canSyringeSource(cand) && !culture?.expired;
    const injectMl = canSyringeTarget(cand) ? getSyringeInjectionDoseMl(cand, sc.volMl) : 0;
    if (injectMl > 0 && (prepareCulture || !canDraw)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t(prepareCulture ? 'actions.held.syringe_hold_inoculate' : 'actions.held.syringe_hold_inject', { ml: injectMl, label: cand.label }));
      return true;
    }
    if (canDraw) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'draw' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t('actions.held.syringe_hold_draw', { label: cand.label }));
      return true;
    }
    ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
    setHoverPrompt(ctx, t(sc.volMl < 9.9 && lc.volMl > 0
      ? 'actions.held.syringe_draw_lc_only'
      : 'actions.held.syringe_target_invalid'));
    return true;
  }

  if (cand.mesh.userData.isPetri) {
    ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
    const petriCtrl = cand.mesh.userData.petriCtrl;
    if (petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.sterilized) {
      if (!petriCtrl.lidOpen) {
        ctx.hoveredSyringeTarget = { item: cand, mode: 'open' };
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.scalpel_open_petri_hood'));
      } else if (sc.volMl >= 1 && sc.mix?.lcMl > 0.05) {
        ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.syringe_inoculate_petri', { label: cand.label }));
      } else {
        setHoverPrompt(ctx, t('actions.held.syringe_need_1ml_petri'));
      }
    } else {
      const petriMode = petriCtrl && petriCtrl.mode;
      const hint = t(petriMode === 'bare'
        ? 'actions.held.syringe_petri_bare'
        : (petriMode === 'filled'
          ? 'actions.held.syringe_petri_filled'
          : 'actions.held.syringe_petri_cultured'));
      setHoverPrompt(ctx, hint);
    }
    return true;
  }

  if (canSyringeTarget(cand)) {
    if (sc.volMl > 0) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
      hidePlacementGhost(ctx);
      const doseMl = getSyringeInjectionDoseMl(cand, sc.volMl);
      const doseTxt = doseMl % 1 === 0 ? doseMl.toFixed(0) : doseMl.toFixed(1);
      setHoverPrompt(ctx, t('actions.held.syringe_inoculate_dose', { dose: doseTxt, label: cand.label }));
    } else {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
      setHoverPrompt(ctx, t('actions.held.syringe_empty'));
    }
    return true;
  }

  if (cand.spawnCtrl) {
    ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
    const pdaAgarReady = cand.pdaMediumCtrl && cand.pdaMediumCtrl.powderGrams > 0 &&
      cand.mesh.userData.liquidCtrl && cand.mesh.userData.liquidCtrl.volMl > 0;
    setHoverPrompt(ctx, getSyringeTargetHint(cand.spawnCtrl, sc.volMl, pdaAgarReady, cand.pdaMediumCtrl));
    return true;
  }
  return false;
}

function handleFridgeStorageHover(ctx, setHoverPrompt) {
  if (ctx.placementMode) return false;
  const fridgeTarget = getCultureFridgeStorageTarget(ctx);
  if (!fridgeTarget) return false;
  ctx.hoveredFridgeTarget = fridgeTarget;
  ctx.hoverHit = fridgeTarget.hit || null;
  hidePlacementGhost(ctx);
  const cultureLabel = fridgeTarget.displayLabel;
  setHoverPrompt(ctx, !fridgeTarget.fridge.fridgeCtrl.doorOpen
    ? t('actions.held.fridge_open_to_store', { label: cultureLabel })
    : (fridgeTarget.slotPosition
      ? t('actions.held.fridge_store', { label: cultureLabel })
      : t('actions.held.fridge_full')));
  return true;
}

function handleSporePrintHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.placementMode || !ctx.heldItem || !ctx.heldItem.wildMushroomCtrl) return false;
  const dehydRes = findPickableHit(
    ctx,
    3.8,
    (cand) => !!cand.dehydratorCtrl,
    intersectPickableItem
  );
  if (dehydRes) {
    ctx.hoverHit = dehydRes.hit;
    ctx.hoveredDehydratorTarget = dehydRes.item;
    hidePlacementGhost(ctx);
    const dc = dehydRes.item.dehydratorCtrl;
    setHoverPrompt(ctx, !dc.hasMushroom
      ? t('actions.held.dehydrator_load', { species: ctx.heldItem.wildMushroomCtrl.speciesName })
      : t(dc.crisp ? 'actions.held.dehydrator_crisp' : 'actions.held.dehydrator_busy'));
    return true;
  }
  const res = findPickableHit(
    ctx,
    3.5,
    (cand) => !!(cand.mesh && cand.mesh.userData && cand.mesh.userData.petriCtrl &&
      (cand.mesh.userData.petriCtrl.mode === 'bare' || cand.mesh.userData.petriCtrl.mode === 'spore_print')),
    intersectPickableItem
  );
  if (!res) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredSporePrintPetri = res.item;
  hidePlacementGhost(ctx);
  const pc = res.item.mesh.userData.petriCtrl;
  setHoverPrompt(ctx, pc.lidOpen
    ? t('actions.held.spore_print_collect', { species: ctx.heldItem.wildMushroomCtrl.speciesName })
    : t('actions.held.spore_print_open_petri'));
  return true;
}

function handleMonotubAndGardenHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.placementMode || !ctx.heldItem) return false;
  const held = ctx.heldItem;

  // 1. Segurando Monotub 24L -> posicionar na Estante LED de Monotubes
  if (held.monotubCtrl && monotubRackHitMeshes.length > 0) {
    const rHits = ctx.raycaster.intersectObjects(monotubRackHitMeshes, false);
    if (rHits.length > 0 && rHits[0].distance < 4.5 && rHits[0].object.userData.monotubRackSlot) {
      const slot = rHits[0].object.userData.monotubRackSlot;
      ctx.hoverHit = rHits[0];
      ctx.hoveredMonotubRackSlot = slot;
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t('actions.held.monotub_place_rack', { label: held.label, tier: slot.tier }));
      return true;
    }
  }

  // 2. Segurando Bolo Seco Esgotado ou Monotub Esgotado -> jogar na Caixa de Substrato da Horta
  if (isHoldingSpentCakeForCompost(held) && gardenHitMeshes.length > 0) {
    const gHits = ctx.raycaster.intersectObjects(gardenHitMeshes, false);
    if (gHits.length > 0 && gHits[0].distance < 4.8 && gHits[0].object.userData.gardenTarget) {
      const gt = gHits[0].object.userData.gardenTarget;
      if (gt.type === 'compost_box') {
        ctx.hoverHit = gHits[0];
        ctx.hoveredGardenTarget = gt;
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.garden_compost_cake'));
        return true;
      }
    }
  }

  // 3. Segurando Spawn Colonizado, Substrato Pasteurizado, Vermiculita/Pó de Coco (Casing), Galão 5L (Dunk) ou Colher Inox -> interagir com Monotub 24L
  const canAddSpawn = isHoldingColonizedGrainSpawn(held);
  const canAddBulk = isHoldingPasteurizedBulkSubstrate(held);
  const isCasingSack = typeof held.id === 'string' && (held.id.indexOf('substrate_vermiculite') === 0 || held.id.indexOf('substrate_coco') === 0);
  const isWaterJug = !!(held.mesh && held.mesh.userData && held.mesh.userData.isWaterGallon);
  const isSpoon = !!(held.mesh && held.mesh.userData && held.mesh.userData.isLabSpoon);
  if (canAddSpawn || canAddBulk || isCasingSack || isWaterJug || isSpoon) {
    const res = findPickableHit(ctx, 3.8, (cand) => !!cand.monotubCtrl, intersectPickableItem);
    if (res) {
      const mc = res.item.monotubCtrl;
      ctx.hoverHit = res.hit;
      ctx.hoveredMonotubTarget = res.item;
      hidePlacementGhost(ctx);
      if (mc.mixAnimTimer > 0 || mc.levelAnimTimer > 0) {
        setHoverPrompt(ctx, t('actions.held.monotub_wait_anim'));
      } else if (!mc.spent && !mc.contaminated && mc.fruitingStage === 3) {
        setHoverPrompt(ctx, t('actions.held.monotub_free_hand_harvest'));
      } else if (mc.colonization >= 100 && !mc.spent && !mc.contaminated && !mc.hasCasing && (canAddBulk || isCasingSack)) {
        setHoverPrompt(ctx, t('actions.held.monotub_casing'));
      } else if (mc.colonization >= 100 && !mc.spent && !mc.contaminated && isWaterJug) {
        setHoverPrompt(ctx, t('actions.held.monotub_dunk', { flush: mc.flush }));
      } else if (!mc.lidOpen) {
        setHoverPrompt(ctx, t('actions.held.monotub_open_first'));
      } else if (canAddSpawn && !mc.hasSpawn) {
        setHoverPrompt(ctx, t('actions.held.monotub_add_spawn', { label: held.label }));
      } else if (canAddBulk && !mc.hasBulk) {
        setHoverPrompt(ctx, held.bowlCtrl && !held.bowlCtrl.pasteurized
          ? t('actions.held.monotub_add_bulk_raw')
          : t('actions.held.monotub_add_bulk_treated', { label: held.label }));
      } else if (mc.hasSpawn && mc.hasBulk && !mc.mixed) {
        setHoverPrompt(ctx, t('actions.held.monotub_mix'));
      } else if (mc.mixed && !mc.leveled) {
        setHoverPrompt(ctx, t('actions.held.monotub_level'));
      } else {
        setHoverPrompt(ctx, res.item.label);
      }
      return true;
    }
  }

  return false;
}

function handleG2GHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.placementMode || !ctx.heldItem || !isHoldingColonizedGrainSpawn(ctx.heldItem)) return false;
  const srcSc = ctx.heldItem.spawnCtrl;
  const res = findPickableHit(ctx, 3.5, (c) => {
    const d = c && c.spawnCtrl;
    if (!d || c === ctx.heldItem) return false;
    if (canReceiveSpawnForFruiting(c)) return true;
    const dIsGrain = d.substrateKind !== 'coco_verm' && d.substrateKind !== 'sawdust' && d.substrateKind !== 'pda';
    return !!(d.filled && dIsGrain && d.sterilized && !d.inoculated && !d.contaminated && !d.burned && (!d.isBag || d.sealed));
  }, intersectPickableItem);
  if (!res) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredG2GTarget = res.item;
  hidePlacementGhost(ctx);
  if (canReceiveSpawnForFruiting(res.item)) {
    setHoverPrompt(ctx, t('grow.mix_bag'));
    return true;
  }
  const rem = Math.max(0, 3 - (srcSc.g2gUses || 0));
  setHoverPrompt(ctx, rem > 0
    ? t('actions.held.g2g_transfer', { label: res.item.label, rem })
    : t('actions.held.g2g_limit'));
  return true;
}

function handleAdvancedLabToolsHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.placementMode || !ctx.heldItem) return false;
  const held = ctx.heldItem;

  // 1. Segurando Bisturi ou Seringa -> Flambar na Lamparina a Álcool!
  const isScalpelOrSyringe = !!(held.scalpelCtrl || (held.mesh && held.mesh.userData && held.mesh.userData.isSyringe));
  if (isScalpelOrSyringe) {
    const lampRes = findPickableHit(ctx, 3.6, (cand) => !!cand.alcoholLampCtrl, intersectPickableItem);
    if (lampRes) {
      ctx.hoverHit = lampRes.hit;
      ctx.hoveredAlcoholLampTarget = lampRes.item;
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t(held.scalpelCtrl ? 'actions.held.flame_scalpel' : 'actions.held.flame_syringe'));
      return true;
    }
  }

  // A seringa também pode acessar o catálogo enquanto está na mão.
  if (held.vial3mlCtrl || held.mesh?.userData?.isSyringe) {
    const caseRes = findPickableHit(ctx, 3.6, (cand) => !!cand.caseCtrl, intersectPickableItem);
    if (caseRes) {
      const cc = caseRes.item.caseCtrl;
      const used = cc.slots ? cc.slots.filter(Boolean).length : 0;
      ctx.hoverHit = caseRes.hit;
      ctx.hoveredAmpouleCaseTarget = caseRes.item;
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, held.vial3mlCtrl
        ? t('actions.held.case_store_vial', { label: held.label, used, max: cc.maxSlots || 50 })
        : t('actions.held.case_open_syringe'));
      return true;
    }
  }

  // 2. Segurando Lote de Cogumelos Desidratados Crocantes -> Guardar no Pote Hermético com Sílica Gel ou Embalar no Saco Mylar/Zip!
  if (held.driedMushroomCtrl) {
    const bagRes = findPickableHit(ctx, 3.6, (cand) => !!(cand.mushroomBagCtrl && !cand.mushroomBagCtrl.filled), intersectPickableItem);
    if (bagRes) {
      ctx.hoverHit = bagRes.hit;
      ctx.hoveredMushroomBagPackTarget = bagRes.item;
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, t('actions.held.bag_pack_dried', { grams: held.driedMushroomCtrl.grams || 10 }));
      return true;
    }
    const jarRes = findPickableHit(ctx, 3.6, (cand) => !!cand.silicaJarCtrl, intersectPickableItem);
    if (jarRes) {
      ctx.hoverHit = jarRes.hit;
      ctx.hoveredSilicaJarTarget = jarRes.item;
      hidePlacementGhost(ctx);
      const jc = jarRes.item.silicaJarCtrl;
      setHoverPrompt(ctx, t('actions.held.silica_store', { grams: held.driedMushroomCtrl.grams || 10, stored: jc.storedGrams, cap: jc.capacityGrams }));
      return true;
    }
  }

  // 2b. Segurando Saco Mylar com Cogumelos Secos -> Selar na Seladora Térmica ou Guardar na Caixa de Entrega!
  if (held.mushroomBagCtrl) {
    const bc = held.mushroomBagCtrl;
    if (!bc.filled) {
      const batchRes = findPickableHit(ctx, 3.6, (cand) => !!cand.driedMushroomCtrl, intersectPickableItem);
      if (batchRes) {
        ctx.hoverHit = batchRes.hit;
        ctx.hoveredDriedBatchForBag = batchRes.item;
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.bag_fill_from_batch', { grams: batchRes.item.driedMushroomCtrl.grams || 10 }));
        return true;
      }
    } else if (!bc.sealed) {
      const sealerRes = findPickableHit(
        ctx,
        3.6,
        (cand) => !!(cand.meta && cand.meta.compatibilities && cand.meta.compatibilities.sealsBags),
        intersectPickableItem
      );
      if (sealerRes) {
        ctx.hoverHit = sealerRes.hit;
        ctx.hoveredMushroomBagSealTarget = held;
        ctx.hoveredHeatSealerObj = sealerRes.item;
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, t('actions.held.bag_seal', { grams: bc.grams, species: bc.speciesName || t('actions.held.mushroom_default') }));
        return true;
      }
    } else {
      const crateRes = findPickableHit(ctx, 3.8, (cand) => !!cand.deliveryCrateCtrl, intersectPickableItem);
      if (crateRes) {
        ctx.hoverHit = crateRes.hit;
        ctx.hoveredDeliveryCrateTarget = crateRes.item;
        hidePlacementGhost(ctx);
        const error = cratePlacementError(crateRes.item, held, freeCrateSlot(crateRes.item));
        setHoverPrompt(ctx, error || t('crate.place'));
        return true;
      }
    }
  }

  // 2d. Segurando Caixa de Entrega ou Pacote Selado -> Entregar no Quiosque Drive-Thru na Estrada Sul!
  if (isHoldingPackOrCrateForStand(held) && roadSaleStandMeshes.length > 0) {
    const stHits = ctx.raycaster.intersectObjects(roadSaleStandMeshes, false);
    if (stHits.length > 0 && stHits[0].distance < 5.0) {
      ctx.hoverHit = stHits[0];
      ctx.hoveredRoadSaleStand = true;
      hidePlacementGhost(ctx);
      const count = held.deliveryCrateCtrl
        ? held.deliveryCrateCtrl.packsCount
        : (held.organicBasketCtrl ? held.organicBasketCtrl.packsValue : 1);
      setHoverPrompt(ctx, t('actions.held.road_stand_deliver', { count, value: count * MYCOCOIN_PRICE_PER_PACK }));
      return true;
    }
  }

  // 3. Segurando qualquer cultura/amostra -> Analisar no Microscópio Óptico 1000x!
  const micRes = findPickableHit(ctx, 3.6, (cand) => !!cand.microscopeCtrl, intersectPickableItem);
  if (micRes) {
    ctx.hoverHit = micRes.hit;
    ctx.hoveredMicroscopeTarget = micRes.item;
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, t('actions.held.microscope_analyze', { label: held.label }));
    return true;
  }

  return false;
}

/**
 * Executa os handlers contextuais para o item atualmente segurado.
 * @returns {boolean} true se um alvo contextual assumiu o hover e já atualizou o prompt.
 */
export function resolveHeldItemHover(ctx, rayNdc, helpers) {
  const { intersectPickableItem, setHoverPrompt, updateHeldItemPlacementPreview } = helpers;
  if (!ctx.heldItem) return false;

  // No modo Posicionar (G/Q), prioriza o preview de posicionamento para que lousa/pia/outros alvos não congelem o ghost!
  if (ctx.placementMode) {
    updateHeldItemPlacementPreview(ctx, rayNdc);
    return true;
  }

  if (handleChalkboardHover(ctx, setHoverPrompt)) return true;
  if (handleH2O2SprayHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleWaterSprayHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleAlcoholSprayHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handlePaperTowelHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleParafilmHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleTrashHover(ctx, setHoverPrompt)) return true;
  if (handleSporePrintHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleAdvancedLabToolsHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleMonotubAndGardenHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleG2GHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handlePdaReagentHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleHeatSealerHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleSinkHover(ctx, setHoverPrompt)) return true;
  if (handleLiquidPourHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleCookerLidSnapHover(ctx, setHoverPrompt)) return true;
  if (handleCookerInsertHover(ctx, setHoverPrompt)) return true;
  if (handleFlocaoHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleSpoonOrBowlHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleScalpelHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleSubstrateHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleSyringeHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleFridgeStorageHover(ctx, setHoverPrompt)) return true;

  return false;
}
