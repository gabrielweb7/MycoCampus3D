/**
 * Sistema de Raycasting & Deteccao de Hover (MycoCampus3D)
 * Responsavel por identificar alvos sob a mira/cursor e atualizar o prompt contextual do HUD.
 */

import { cancelHeldItemPlacement, updateHeldItemPlacementPreview } from './held-item-placement.js';
import { resolveHeldItemHover, isRayOccludedByStructure, firstUnoccludedRayHit } from './hover-held-handlers.js';
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
import { gardenHitMeshes, gardenState } from '../world/campus-garden.js';
import { roadSaleStandMeshes, roadStandState, MYCOCOIN_PRICE_PER_PACK } from '../items/dehydration-packaging.js';
import { telescopeHitMeshes } from '../world/plaza-telescope.js';

const THREE = window.THREE;
const _vZero2 = new THREE.Vector2(0, 0);
const _tmpBadgeWorldPos = new THREE.Vector3();

function resolveHoverTargetObj(ctx) {
  return ctx.hoveredPickable ||
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
    ctx.hoveredSilicaJarTarget ||
    ctx.hoveredMushroomBagPackTarget ||
    ctx.hoveredDriedBatchForBag ||
    ctx.hoveredMushroomBagSealTarget ||
    ctx.hoveredDeliveryCrateTarget ||
    (ctx.hoveredRoadSaleStand ? { label: '🚗 Quiosque Drive-Thru MycoCampus (Estrada Sul)' } : null) ||
    ctx.hoveredMonotubTarget ||
    ctx.hoveredDehydratorTarget ||
    ctx.hoveredSporePrintPetri ||
    (ctx.hoveredMonotubRackSlot ? { label: `Estante LED Monotub (Andar ${ctx.hoveredMonotubRackSlot.tier})` } : null) ||
    (ctx.hoveredGardenTarget ? { label: ctx.hoveredGardenTarget.label || (ctx.hoveredGardenTarget.plant && ctx.hoveredGardenTarget.plant.name) || 'Horta Orgânica' } : null) ||
    (ctx.hoveredMonotubDunkSink ? { label: 'Pia Inox do Laboratório' } : null) ||
    ctx.hoveredDoorObj ||
    ctx.hoveredCabinetPart ||
    ctx.hoveredGreenhouseSlot ||
    (ctx.hoveredMushroom ? { label: (ctx.hoveredMushroom.capMesh && ctx.hoveredMushroom.capMesh.userData.speciesName) || 'Cogumelo Selvagem' } : null) ||
    ctx.hoveredBlindObj ||
    (ctx.hoveredSink ? { label: 'Pia Inox do Laboratório' } : null) ||
    (ctx.hoveredTrash ? { label: 'Lixeira do Laboratório' } : null) ||
    (ctx.hoveredSeat ? { label: 'Assento' } : null) ||
    (ctx.hoveredBoardHit ? { label: 'Lousa Interativa' } : null) ||
    (ctx.hoveredRankBtn ? { label: 'Ranking do Campus' } : null) ||
    (ctx.hoveredCinema ? { label: 'Telão do Auditório' } : null) ||
    (ctx.hoveredScaleTare ? { label: 'Balança de Precisão' } : null) ||
    (ctx.hoveredBurnerSwitch ? { label: ctx.hoveredBurnerSwitch.kind === 'gas_tripod' ? 'Tripé Fogareiro a Gás' : 'Fogareiro Elétrico' } : null) ||
    (ctx.hoveredStirSwitch ? { label: 'Agitador Magnético' } : null) ||
    (ctx.hoveredHoodSwitch ? { label: 'Capela de Fluxo Laminar' } : null) ||
    (ctx.hoveredCow ? { label: `🐄 ${ctx.hoveredCow.name}`, mesh: ctx.hoveredCow.mesh } : null) ||
    (ctx.hoveredSwitch ? { label: 'Interruptor de Luz' } : null) ||
    (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer && ctx.thermoLaserOn
      ? { label: ctx.thermoTargetLabel || 'Termômetro Infravermelho' }
      : null);
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

function setHoverPrompt(ctx, prompt) {
  if (ctx.callbacks && ctx.callbacks.onHoverPrompt) {
    ctx.callbacks.onHoverPrompt(prompt);
  }
  syncHover3dBadge(ctx, prompt);
}

export function firstValidRayHit(hits) {
  for (let hi = 0; hi < hits.length; hi++) {
    if (!hits[hi].object.userData.ignoreRay) return hits[hi];
  }
  return null;
}

/**
 * Broad-phase de baixo custo: evita raycast recursivo em sub-malhas quando
 * o centro do item esta distante da linha do raio.
 */
function intersectPickableItem(raycaster, item) {
  if (!item || !item.mesh) return null;
  const ud = item.mesh.userData;
  const maxRadSq = (ud && (ud.isTable || ud.isHood || ud.isRack || item.fridgeCtrl)) ? 9.0 : 0.72;
  if (raycaster.ray.distanceSqToPoint(item.mesh.position) > maxRadSq) return null;
  return firstValidRayHit(raycaster.intersectObject(item.mesh, true));
}

export function updateHoverRay(ctx, customNdc) {
  if (!ctx.heldItem && ctx.placementMode) cancelHeldItemPlacement(ctx);
  ctx.hoverHit = null;
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
  ctx.hoveredParafilmTarget = null;
  ctx.hoveredScaleTare = null;
  ctx.hoveredBurnerSwitch = null;
  ctx.hoveredBurnerTimer = null;
  ctx.hoveredCow = null;
  ctx.hoveredSportBall = null;
  ctx.hoveredSinkAction = null;
  ctx.hoveredGrainCooker = null;
  ctx.hoveredCornScoopPot = null;
  ctx.hoveredPotInsert = null;
  ctx.hoveredSnapPot = null;
  ctx.hoveredSprayTarget = null;
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
  ctx.hoveredGardenTarget = null;
  ctx.hoveredAlcoholLampTarget = null;
  ctx.hoveredMicroscopeTarget = null;
  ctx.hoveredSilicaJarTarget = null;
  ctx.hoveredMushroomBagPackTarget = null;
  ctx.hoveredDriedBatchForBag = null;
  ctx.hoveredMushroomBagSealTarget = null;
  ctx.hoveredDeliveryCrateTarget = null;
  ctx.hoveredRoadSaleStand = false;
  ctx.hoveredTelescope = false;
  let prompt = '';

  const rayNdc = customNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc);
  const refX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
  const refZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
  const maxPickSq = ctx.inFps ? 26 : 225;
  ctx.raycaster.far = 24;
  ctx.raycaster.setFromCamera(rayNdc, ctx.camera);

  if (resolveHeldItemHover(ctx, rayNdc, {
    intersectPickableItem,
    setHoverPrompt,
    updateHeldItemPlacementPreview
  })) {
    return;
  }
  if (ctx.placementGhost) ctx.placementGhost.visible = false;

  if (ctx.rankingBtnMeshes.length && (!ctx.inFps || (Math.abs(refX) < 30 && refZ < 16))) {
    const rHits = ctx.raycaster.intersectObjects(ctx.rankingBtnMeshes, false);
    if (rHits.length > 0 && rHits[0].distance < 18) {
      ctx.hoverHit = rHits[0];
      ctx.hoveredRankBtn = rHits[0].object.userData.rankAction;
      prompt = ctx.hoveredRankBtn === 'up' ? '▲ Subir Ranking' : '▼ Descer Ranking';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.cinemaScreenMesh && (!ctx.inFps || (refX > 16 && refZ > -32 && refZ < 12))) {
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
      if (cTarget.type === 'power_on') prompt = '⏻ Clique na tela para ligar o Auditório';
      else if (cTarget.type === 'power_off') prompt = '⏻ Desligar tela do Auditório';
      else if (cTarget.type === 'menu') prompt = '📋 Voltar ao menu de módulos';
      else if (cTarget.type === 'lesson') prompt = '▶️ Assistir: ' + ((ctx.cinemaLessons[cTarget.idx] && ctx.cinemaLessons[cTarget.idx].title) || 'Aula');
      else if (cTarget.type === 'toggle_play') prompt = ctx.cinemaPlaying ? '⏸️ Clique na aula para pausar' : '▶️ Clique na aula para continuar';
      else prompt = '🎬 Escolha um módulo na tela para assistir';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.scaleTareMeshes.length) {
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
        prompt = '⚖️ Cancelar TARA (Voltar para 0.0 g)';
      } else if (sc.lastGross > 0) {
        prompt = '⚖️ Aplicar TARA (Descontar ' + sc.lastGross.toFixed(1) + 'g)';
      } else {
        prompt = '⚖️ Zerar Balança (TARE)';
      }
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.burnerSwitchMeshes.length && (!ctx.heldItem || !ctx.heldItem.mesh.userData.isBurner)) {
    let anyBurnerNear = false;
    for (let bi = 0; bi < ctx.burnerSwitchMeshes.length; bi++) {
      if (ctx.raycaster.ray.distanceSqToPoint(ctx.burnerSwitchMeshes[bi].getWorldPosition(_tmpBadgeWorldPos)) < 2.25) {
        anyBurnerNear = true;
        break;
      }
    }
    const bHits = anyBurnerNear ? ctx.raycaster.intersectObjects(ctx.burnerSwitchMeshes, false) : [];
    if (bHits.length > 0 && bHits[0].distance < 4.0) {
      ctx.hoverHit = bHits[0];
      if (bHits[0].object.userData.burnerTimerIdx !== undefined) {
        ctx.hoveredBurnerTimer = ctx.burnerDevices[bHits[0].object.userData.burnerTimerIdx];
        const curLbl = formatBurnerTimerLabel(ctx.hoveredBurnerTimer.timerPresetMin || 0);
        prompt = '⏱️ Timer Digital (' + curLbl + ') • Clique para alternar (20m / 1h / 1h30 / 2h / Livre)';
        setHoverPrompt(ctx, prompt);
        return;
      }
      ctx.hoveredBurnerSwitch = ctx.burnerDevices[bHits[0].object.userData.burnerSwitchIdx];
      const curL = ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0);
      const nxtL = (curL + 1) % 4;
      prompt = '🔥 ' + BURNER_LEVEL_NAMES[curL] + ' → Mudar para ' + BURNER_LEVEL_NAMES[nxtL];
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.stirSwitchMeshes.length && (!ctx.heldItem || !ctx.heldItem.mesh.userData.isStirrer)) {
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
      prompt = ctx.hoveredStirSwitch.on ? '🌀 Desligar Agitador Magnético' : '🌀 Ligar Agitador Magnético';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.hoodSwitchMeshes.length) {
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
      prompt = ctx.hoveredHoodSwitch.on ? '💨 Desligar Fluxo Laminar' : '💨 Ligar Fluxo Laminar';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.lightSwitchMeshes.length) {
    const swHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.lightSwitchMeshes, false), 4.0);
    if (swHit) {
      ctx.hoverHit = swHit;
      ctx.hoveredSwitch = swHit.object.userData.lightSwitch;
      prompt = ctx.hoveredSwitch.on ? '💡 Clique para desligar a luz' : '💡 Clique para ligar a luz';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.seatMeshes.length) {
    const stHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.seatMeshes, false), 4.2);
    if (stHit) {
      ctx.hoverHit = stHit;
      const candSeat = stHit.object.userData.seatInfo;
      if (isSeatOccupied(ctx.remoteAvatars, candSeat)) {
        prompt = '🚫 Assento ocupado (sente ao lado!)';
      } else {
        ctx.hoveredSeat = candSeat;
        prompt = '🪑 Clique para sentar';
      }
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (!prompt && ctx.doorHitMeshes.length) {
    const doorHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false), 5.0);
    if (doorHit) {
      ctx.hoverHit = doorHit;
      ctx.hoveredDoorObj = doorHit.object.userData.doorObj;
      prompt = '🚪 ' + (ctx.hoveredDoorObj.open ? 'Fechar ' : 'Abrir ') + ctx.hoveredDoorObj.label;
    }
  }
  const maxMushSq = ctx.inFps ? 24 : 225;
  if (!prompt && !ctx.heldItem) {
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
        const spLabel = (wm.capMesh && wm.capMesh.userData && wm.capMesh.userData.speciesName) || 'Cogumelo Selvagem';
        prompt = isPoop
          ? `🍄 Comer / Colher ${spLabel} (+40 XP • +1 Cogu)`
          : `🍄 Colher ${spLabel} (+25 XP • +1 Cogu)`;
        break;
      }
    }
  }
  if (!prompt && ctx.heldItem) {
    for (let fi = 0; fi < ctx.pickableItems.length; fi++) {
      const fItem = ctx.pickableItems[fi];
      if (!fItem || !fItem.fridgeCtrl) continue;
      const fdx = fItem.mesh.position.x - refX, fdz = fItem.mesh.position.z - refZ;
      if (fdx * fdx + fdz * fdz > maxPickSq) continue;
      const fHit = intersectPickableItem(ctx.raycaster, fItem);
      if (fHit && fHit.distance < 4.5 && !isRayOccludedByStructure(ctx, fHit.distance, {
        checkWalls: true,
        ignoreCollider: fItem.mesh.userData && fItem.mesh.userData.dynamicCollider
      })) {
        ctx.hoveredPickable = fItem;
        ctx.hoverHit = fHit;
        prompt = fItem.fridgeCtrl.doorOpen
          ? '🧊 Fechar Geladeira de Culturas (4°C)'
          : '🧊 Abrir Geladeira de Culturas (4°C)';
        break;
      }
    }
  }
  let bestSmall = null, bestSmallDist = Infinity, bestSmallHit = null;
  let bestLarge = null, bestLargeDist = Infinity, bestLargeHit = null;
  let bestBlocked = null, bestBlockedDist = Infinity, bestBlockedHit = null;

  if (!prompt && !ctx.heldItem) {
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      let item = ctx.pickableItems[i];
      if (item === ctx.heldItem || (ctx.heldItem && item === ctx.heldItem.lidItem) ||
        !isCultureAccessibleFromFridge(ctx, item) || isItemInClosedCabinet(ctx, item)) continue;
      if (ctx.isHeldByRemote(item.id)) continue;
      const idx = item.mesh.position.x - refX, idz = item.mesh.position.z - refZ;
      if (idx * idx + idz * idz > maxPickSq) continue;
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
    ctx.hoveredPickable = bestSmall || bestLarge;
    ctx.hoverHit = bestSmall ? bestSmallHit : bestLargeHit;
    if (!ctx.hoveredPickable && bestBlocked && bestBlockedDist < 3.8) {
      ctx.hoveredPickable = bestBlocked;
      ctx.hoverHit = bestBlockedHit;
      if (ctx.adminEditMode) {
        if (bestBlocked.mesh.userData.isBurner) {
          prompt = '🚫 Retire a panela de cima antes de mover o Fogareiro';
        } else {
          prompt = '🚫 Retire os objetos de cima antes de mover ' + bestBlocked.label;
        }
      } else {
        prompt = bestBlocked.label;
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
      } else if (ctx.hoveredPickable.fridgeCtrl) {
        const fridge = ctx.hoveredPickable;
        prompt = fridge.fridgeCtrl.doorOpen
          ? '🧊 Fechar Porta da Geladeira (4°C)'
          : '🧊 Abrir Porta da Geladeira (4°C)';
      } else {
        prompt = ctx.hoveredPickable.label;
      }
    }
  }
  ctx.hoveredCabinetPart = null;
  if (ctx.cabinetHitMeshes && ctx.cabinetHitMeshes.length) {
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
          prompt = (cPart.open ? '🗄️ Fechar ' : '🗄️ Abrir ') + (cPart.label || 'Armário');
        }
      }
    }
  }
  if (ctx.heldSportBall) {
    setHoverPrompt(ctx, '🏀 Mire acima da cesta e clique para arremessar!');
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
        prompt = '🏀 Pegar Bola de Basquete (p/ arremessar na cesta)';
        break;
      }
    }
  }
  if (!prompt && ctx.cowHitMeshes && ctx.cowHitMeshes.length && refX > 26 && refX < 78 && refZ > 4 && refZ < 56) {
    const cowHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.cowHitMeshes, false), 5.5, { checkWalls: true });
    if (cowHit && cowHit.object.userData.cowObj) {
      ctx.hoverHit = cowHit;
      ctx.hoveredCow = cowHit.object.userData.cowObj;
      prompt = `🐄 ${ctx.hoveredCow.name} (Saúde ${ctx.hoveredCow.health}% • ${ctx.hoveredCow.mood}) • Clique para fazer carinho`;
    }
  }
  ctx.hoveredGreenhouseSlot = null;
  ctx.hoveredGreenhouseDevice = null;
  if (!prompt && refX > 11 && refX < 28 && refZ > -2 && refZ < 17) {
    if (greenhouseControlMeshes.length > 0) {
      const ctrlHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseControlMeshes, true), 4.8, { checkWalls: true });
      if (ctrlHit && ctrlHit.object.userData.greenhouseDevice) {
        const dev = ctrlHit.object.userData.greenhouseDevice;
        ctx.hoverHit = ctrlHit;
        ctx.hoveredGreenhouseDevice = dev;
        const devNames = {
          panel: '🎛️ Painel de Automação da Estufa',
          humidifier: '💧 Umidificador Ultrassônico',
          exhaust: '🌬️ Exaustor de CO₂ (Troca de Ar)',
          cooler: '❄️ Climatizador 3 Ventoinhas'
        };
        const modeTxt = greenhouseEnv.autoMode ? 'AUTO' : 'MANUAL';
        prompt = `${devNames[dev] || '🎛️ Estufa'} (${modeTxt} • ${Math.round(greenhouseEnv.humidity)}% UR • ${Math.round(greenhouseEnv.co2Ppm)} ppm • ${greenhouseEnv.tempC.toFixed(1)}°C) • Clique para abrir controles`;
      }
    }
    if (!prompt && greenhouseHitMeshes.length > 0) {
      const ghHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(greenhouseHitMeshes, true), 4.8, { checkWalls: true });
      if (ghHit) {
        const hSlot = ghHit.object.userData.greenhouseSlot;
        if (hSlot) {
          ctx.hoverHit = ghHit;
          ctx.hoveredGreenhouseSlot = hSlot;
          const isHoldingSpray = ctx.heldItem && (ctx.heldItem.id.indexOf('alcohol_spray') !== -1 || ctx.heldItem.id.indexOf('spray') !== -1);
          const hasColonizedSpawn = isHoldingColonizedSpawn(ctx.heldItem);
          const loc = `${hSlot.rackName} • A${hSlot.tier}`;
          const hPct = typeof hSlot.health === 'number' ? Math.round(hSlot.health) : 100;
          const diagLabel = (hSlot.stressReasons && hSlot.stressReasons.length > 0)
            ? `⚠️ Estressado (${hPct}%): ${hSlot.stressReasons.join(' + ')}`
            : `❤️ Saudável (${hPct}%)`;
          if (hasColonizedSpawn) {
            prompt = (hSlot.empty || hSlot.stage <= 0)
              ? `🍄 Colocar Spawn (${ctx.heldItem.label}) em ${loc} (+50 XP na colheita)`
              : `🌱 ${hSlot.name} (${loc}) já está em frutificação`;
          } else if (hSlot.spent || hSlot.contaminated) {
            prompt = hSlot.contaminated
              ? `🦠 ${hSlot.name} (${loc}) Contaminado (Trichoderma) • Clique p/ retirar e descartar`
              : `🍂 ${hSlot.name} (${loc} • 4/4 Flushs • Bolo Seco Esgotado) • Clique p/ retirar e levar à Horta!`;
          } else if (hSlot.empty || hSlot.stage < 0) {
            prompt = `📦 ${hSlot.name} (${loc}) • Traga Spawn colonizado ou clique para iniciar cultivo`;
          } else if (hSlot.stage === 3) {
            prompt = `🍄 Colher ${hSlot.name} (${loc} • Flush ${hSlot.flush}/4) • ${diagLabel} • (+50 XP)`;
          } else if (isHoldingSpray) {
            prompt = `💦 Borrifar ${hSlot.name} (${loc} • ${Math.round(hSlot.humidity)}% UR) • ${diagLabel}`;
          } else {
            const stText = hSlot.stage === 0 ? 'Micélio' : (hSlot.stage === 1 ? 'Primórdios' : 'Crescendo');
            prompt = `🌱 ${hSlot.name} (${loc} • Flush ${hSlot.flush}/4) • ${stText} (${Math.round(hSlot.humidity)}% UR) • ${diagLabel}`;
          }
        }
      }
    }
  }
  if (!prompt && gardenHitMeshes.length > 0 && refX > 10 && refX < 28 && refZ > 12 && refZ < 24) {
    const gHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(gardenHitMeshes, false), 5.0, { checkWalls: true });
    if (gHit && gHit.object.userData.gardenTarget) {
      const gt = gHit.object.userData.gardenTarget;
      ctx.hoverHit = gHit;
      ctx.hoveredGardenTarget = gt;
      if (gt.type === 'compost_box') {
        prompt = `🌱 Caixa de Substrato da Horta (${gardenState.compostCakes} bolos • Fertilidade ${Math.round(gardenState.soilRichness)}%) • Traga Bolos Secos após 4 Flushs!`;
      } else if (gt.type === 'harvest_basket') {
        prompt = gardenState.readyBaskets > 0
          ? `🧺 Pegar Cesta Orgânica PRONTA (${gardenState.readyBaskets} disponível • Entregar no Empório +🪙 240)`
          : `🧺 Cesta da Horta (${gardenState.totalHarvested} colheitas • Colha 3 plantas p/ montar Cesta vendável!)`;
      } else if (gt.type === 'plant' && gt.plant) {
        const pl = gt.plant;
        if (pl.stage === 2) {
          prompt = pl.kind === 'tomato'
            ? `🍅 Colher Tomates Vermelhos Orgânicos (${pl.name})`
            : `🥬 Colher Alface Crespa Orgânica (${pl.name})`;
        } else {
          const stTxt = pl.stage === 0 ? 'Muda crescendo' : (pl.kind === 'tomato' ? 'Tomates verdes amadurecendo' : 'Folhas crescendo');
          prompt = `🌿 ${pl.name} • ${stTxt} (${Math.floor(pl.growth)}%) • Adube na Caixa de Substrato ao lado!`;
        }
      }
    }
  }
  if (!prompt && telescopeHitMeshes.length > 0) {
    const tHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(telescopeHitMeshes, false), 4.5);
    if (tHit && tHit.object && tHit.object.userData && tHit.object.userData.isTelescope) {
      ctx.hoverHit = tHit;
      ctx.hoveredTelescope = true;
      prompt = ctx.telescopeZoomActive
        ? '🔭 Sair do Zoom da Luneta Astronômica'
        : '🔭 Olhar na Luneta Astronômica (Zoom no Céu & Constelações)';
    }
  }
  if (!prompt && ctx.blindHitMeshes.length) {
    const blHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false), 5.5);
    if (blHit && blHit.object.userData.blindObj) {
      ctx.hoverHit = blHit;
      ctx.hoveredBlindObj = blHit.object.userData.blindObj;
      prompt = ctx.hoveredBlindObj.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana';
    }
  }
  if (!prompt && roadSaleStandMeshes.length > 0 && refX > 2 && refX < 24 && refZ > 28 && refZ < 44) {
    const stHits = ctx.raycaster.intersectObjects(roadSaleStandMeshes, false);
    if (stHits.length > 0 && stHits[0].distance < 5.5) {
      ctx.hoverHit = stHits[0];
      ctx.hoveredRoadSaleStand = true;
      prompt = roadStandState.availablePacks > 0
        ? `🚗 Quiosque Drive-Thru (${roadStandState.availablePacks} pacotes no balcão • 🪙 ${MYCOCOIN_PRICE_PER_PACK} MycoCoins cada • Clientes a caminho!)`
        : '🚗 Quiosque Drive-Thru da Estrada • Traga Caixas de Entrega ou Pacotes Selados da Sala de Desidratação!';
    }
  }
  if (!prompt && ctx.heldItem) {
    const isTouch = !!(ctx.isTouchDevice && ctx.isTouchDevice());
    if (ctx.heldItem.monotubCtrl) {
      prompt = isTouch
        ? '📦 Toque para abrir/fechar tampa ou misturar/nivelar • Posicione na bancada ou na Estante LED'
        : '📦 Clique para abrir/fechar tampa ou misturar/nivelar • G/Q para posicionar na bancada ou Estante LED';
    } else if (ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.inoculated &&
        !ctx.heldItem.spawnCtrl.colonized && !ctx.heldItem.spawnCtrl.contaminated &&
        !ctx.heldItem.spawnCtrl.burned && !ctx.heldItem.spawnCtrl.shaken &&
        ctx.heldItem.spawnCtrl.colonization >= 20 && ctx.heldItem.spawnCtrl.colonization < 95) {
      prompt = isTouch
        ? '💥 Toque para fazer Break & Shake (Chacoalhar grãos e dobrar a velocidade de colonização 2.2x!)'
        : '💥 Clique para fazer Break & Shake (Chacoalhar grãos e dobrar a velocidade de colonização 2.2x!) • G/Q para posicionar';
    } else if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isPetri) {
      const petriCtrl = ctx.heldItem.mesh.userData.petriCtrl;
      if (petriCtrl) {
        prompt = petriCtrl.lidOpen
          ? (isTouch ? '🧫 Toque para fechar a tampa da placa' : '🧫 Clique para fechar a tampa da placa')
          : (isTouch ? '🧫 Toque para abrir a tampa (Fluxo Laminar ligado e higienizado)' : '🧫 Clique para abrir a tampa (Fluxo Laminar ligado e higienizado)');
      }
    } else if (ctx.heldItem.id && ctx.heldItem.id.indexOf('gloves_box_') === 0) {
      prompt = isTouch
        ? (ctx.wearingGloves && !ctx.glovesExpired ? '🧤 Toque para retirar Luvas Pretas' : '🧤 Toque para calçar Luvas Pretas Estéreis (160s)')
        : ((ctx.wearingGloves && !ctx.glovesExpired ? '🧤 Clique para retirar Luvas Pretas' : '🧤 Clique para calçar Luvas Pretas Estéreis (160s)') + ' • G/Q para posicionar');
    } else if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer) {
      if (ctx.thermoLaserOn) {
        prompt = '🔴 [SCAN] ' + (ctx.thermoTargetLabel || 'Ambiente') + ': ' + ctx.thermoCurrentTemp.toFixed(1) + '°C' +
          (isTouch ? ' (Toque: Desligar Laser)' : ' (Clique: Desligar Laser • G/Q ou clique dir.: posicionar)');
      } else {
        prompt = '🔫 Laser DESLIGADO • Última: ' + ctx.thermoCurrentTemp.toFixed(1) + '°C [HOLD]' +
          (isTouch ? ' (Toque: Ligar Laser)' : ' (Clique: Ligar Laser • G/Q ou clique dir.: posicionar)');
      }
    } else if (ctx.heldItem.wildMushroomCtrl) {
      prompt = (isTouch ? '🍄 Toque para comer ' : '🍄 Clique para comer ') + ctx.heldItem.wildMushroomCtrl.speciesName;
    } else {
      ctx.placementValid = false;
    }
  }
  setHoverPrompt(ctx, prompt);
}
