/**
 * Sistema de Raycasting & Deteccao de Hover (MycoCampus3D)
 * Responsavel por identificar alvos sob a mira/cursor e atualizar o prompt contextual do HUD.
 */

import { cancelHeldItemPlacement, updateHeldItemPlacementPreview } from './held-item-placement.js';
import { resolveHeldItemHover } from './hover-held-handlers.js';
import { isSeatOccupied } from './world-interactions.js';
import { greenhouseHitMeshes } from '../world/greenhouse.js';
import { BURNER_LEVEL_NAMES } from '../items/pressure-cooker.js';
import { isCultureAccessibleFromFridge, isPartOfFridgeDoor, isCultureFridgeOccupied } from '../items/culture-fridge.js';
import { formatSprayHoverPrompt } from '../items/alcohol-spray.js';
import { isItemInClosedCabinet } from '../items/lab-cabinets.js';
import { formatHoverInfo, updateHover3dBadge, hideHover3dBadge } from '../entities/hover-3d-badge.js';

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
    ctx.hoveredDoorObj ||
    ctx.hoveredCabinetPart ||
    ctx.hoveredGreenhouseSlot ||
    ctx.hoveredMushroom ||
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
    (ctx.hoveredSwitch ? { label: 'Interruptor de Luz' } : null) ||
    (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer && ctx.thermoLaserOn
      ? { label: ctx.thermoTargetLabel || 'Termômetro Infravermelho' }
      : null);
}

export function syncHover3dBadge(ctx, prompt) {
  const badge = ctx.hover3dBadge;
  if (!badge) return;
  if (!prompt) {
    hideHover3dBadge(badge);
    return;
  }
  // Se estiver segurando o termômetro, a temperatura já aparece diretamente no display LCD da pistola
  if (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer) {
    hideHover3dBadge(badge);
    return;
  }
  const targetObj = resolveHoverTargetObj(ctx);

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
  ctx.hoveredPotInsert = null;
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
  let prompt = '';

  const rayNdc = customNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc);
  ctx.raycaster.setFromCamera(rayNdc, ctx.camera);

  if (resolveHeldItemHover(ctx, rayNdc, {
    intersectPickableItem,
    setHoverPrompt,
    updateHeldItemPlacementPreview
  })) {
    return;
  }
  if (ctx.placementGhost) ctx.placementGhost.visible = false;

  if (ctx.rankingBtnMeshes.length) {
    const rHits = ctx.raycaster.intersectObjects(ctx.rankingBtnMeshes, false);
    if (rHits.length > 0 && rHits[0].distance < 18) {
      ctx.hoverHit = rHits[0];
      ctx.hoveredRankBtn = rHits[0].object.userData.rankAction;
      prompt = ctx.hoveredRankBtn === 'up' ? '▲ Subir Ranking' : '▼ Descer Ranking';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.cinemaScreenMesh) {
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
    const tHits = ctx.raycaster.intersectObjects(ctx.scaleTareMeshes, false);
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
    const bHits = ctx.raycaster.intersectObjects(ctx.burnerSwitchMeshes, false);
    if (bHits.length > 0 && bHits[0].distance < 4.0) {
      ctx.hoverHit = bHits[0];
      ctx.hoveredBurnerSwitch = ctx.burnerDevices[bHits[0].object.userData.burnerSwitchIdx];
      const curL = ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0);
      const nxtL = (curL + 1) % 4;
      prompt = '🔥 ' + BURNER_LEVEL_NAMES[curL] + ' → Mudar para ' + BURNER_LEVEL_NAMES[nxtL];
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.stirSwitchMeshes.length && (!ctx.heldItem || !ctx.heldItem.mesh.userData.isStirrer)) {
    const stSwHits = ctx.raycaster.intersectObjects(ctx.stirSwitchMeshes, false);
    if (stSwHits.length > 0 && stSwHits[0].distance < 4.0) {
      ctx.hoverHit = stSwHits[0];
      ctx.hoveredStirSwitch = stSwHits[0].object.userData.stirSwitch;
      prompt = ctx.hoveredStirSwitch.on ? '🌀 Desligar Agitador Magnético' : '🌀 Ligar Agitador Magnético';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.hoodSwitchMeshes.length) {
    const hsHits = ctx.raycaster.intersectObjects(ctx.hoodSwitchMeshes, false);
    if (hsHits.length > 0 && hsHits[0].distance < 4.0) {
      ctx.hoverHit = hsHits[0];
      ctx.hoveredHoodSwitch = hsHits[0].object.userData.hoodSwitch;
      prompt = ctx.hoveredHoodSwitch.on ? '💨 Desligar Fluxo Laminar' : '💨 Ligar Fluxo Laminar';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.lightSwitchMeshes.length) {
    const swHits = ctx.raycaster.intersectObjects(ctx.lightSwitchMeshes, false);
    if (swHits.length > 0 && swHits[0].distance < 4.0) {
      ctx.hoverHit = swHits[0];
      ctx.hoveredSwitch = swHits[0].object.userData.lightSwitch;
      prompt = ctx.hoveredSwitch.on ? '💡 Clique para desligar a luz' : '💡 Clique para ligar a luz';
      setHoverPrompt(ctx, prompt);
      return;
    }
  }

  if (ctx.seatMeshes.length) {
    const stHits = ctx.raycaster.intersectObjects(ctx.seatMeshes, false);
    if (stHits.length > 0 && stHits[0].distance < 4.2) {
      ctx.hoverHit = stHits[0];
      const candSeat = stHits[0].object.userData.seatInfo;
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
    const doorHits = ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false);
    if (doorHits.length > 0 && doorHits[0].distance < 5.0) {
      ctx.hoverHit = doorHits[0];
      ctx.hoveredDoorObj = doorHits[0].object.userData.doorObj;
      prompt = '🚪 ' + (ctx.hoveredDoorObj.open ? 'Fechar ' : 'Abrir ') + ctx.hoveredDoorObj.label;
    }
  }
  const refX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
  const refZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
  const maxMushSq = ctx.inFps ? 24 : 225;
  const maxPickSq = ctx.inFps ? 26 : 225;
  if (!prompt && !ctx.heldItem) {
    for (let m = 0; m < ctx.wildMushrooms.length; m++) {
      const wm = ctx.wildMushrooms[m];
      if (!wm.active) continue;
      const mdx = wm.group.position.x - refX, mdz = wm.group.position.z - refZ;
      if (mdx * mdx + mdz * mdz > maxMushSq) continue;
      const mHits = ctx.raycaster.intersectObject(wm.group, true);
      if (mHits.length > 0 && mHits[0].distance < 4.5) {
        ctx.hoverHit = mHits[0];
        ctx.hoveredMushroom = wm;
        prompt = '🍄 Colher Cogumelo (+25 XP)';
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
      if (fHit && fHit.distance < 4.5) {
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
        if (item.mesh.userData.isTable || item.mesh.userData.isHood) {
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
      ctx.hoverHit = bestBlockedHit;
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
      } else if (ctx.hoveredPickable.fridgeCtrl) {
        const fridge = ctx.hoveredPickable;
        prompt = fridge.fridgeCtrl.doorOpen
          ? '🧊 Fechar Porta da Geladeira (4°C)'
          : '🧊 Abrir Porta da Geladeira (4°C)';
      } else if (ctx.hoveredPickable.mesh.userData.twoHanded) {
        prompt = '🙌 Pegar ' + ctx.hoveredPickable.label + ' (2 mãos)';
      } else {
        prompt = '✋ Pegar ' + ctx.hoveredPickable.label;
      }
    }
  }
  ctx.hoveredCabinetPart = null;
  if (ctx.cabinetHitMeshes && ctx.cabinetHitMeshes.length) {
    const cabHits = ctx.raycaster.intersectObjects(ctx.cabinetHitMeshes, false);
    if (cabHits.length > 0 && cabHits[0].distance < 3.8) {
      if (!bestSmall || cabHits[0].distance < bestSmallDist) {
        const cPart = cabHits[0].object.userData.cabinetPart;
        if (cPart) {
          ctx.hoverHit = cabHits[0];
          ctx.hoveredCabinetPart = cPart;
          ctx.hoveredPickable = null;
          prompt = (cPart.open ? '🗄️ Fechar ' : '🗄️ Abrir ') + (cPart.label || 'Armário');
        }
      }
    }
  }
  if (!prompt && ctx.blindHitMeshes.length) {
    const blHits = ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false);
    if (blHits.length > 0 && blHits[0].distance < 5.5) {
      ctx.hoverHit = blHits[0];
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
        ctx.hoverHit = ghHits[0];
        ctx.hoveredGreenhouseSlot = hSlot;
        const isHoldingSpray = ctx.heldItem && (ctx.heldItem.id.indexOf('alcohol_spray') !== -1 || ctx.heldItem.id.indexOf('spray') !== -1);
        const isHoldingColonizedBag = !!(ctx.heldItem && ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.isBag && ctx.heldItem.spawnCtrl.colonized && !ctx.heldItem.spawnCtrl.contaminated);
        if (isHoldingColonizedBag) {
          prompt = hSlot.stage === 0
            ? '🍄 Transferir Spawn Colonizado (' + ctx.heldItem.label + ') para ' + hSlot.name + ' (+50 XP)'
            : '🌱 ' + hSlot.name + ' já está em frutificação (' + (hSlot.stage === 1 ? 'Primórdios' : (hSlot.stage === 2 ? 'Crescendo' : 'Pronto para colher')) + ')';
        } else if (hSlot.stage === 3) {
          prompt = '🍄 Colher ' + hSlot.name + ' (+50 XP e +2 Cogumelos)';
        } else if (isHoldingSpray) {
          prompt = '💦 Borrifar e Hidratar ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR)';
        } else {
          prompt = '🌱 ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR • ' + (hSlot.stage === 0 ? 'Micélio' : (hSlot.stage === 1 ? 'Primórdios' : 'Crescendo')) + ')';
        }
      }
    }
  }
  if (!prompt && ctx.heldItem) {
    if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isPetri) {
      const petriCtrl = ctx.heldItem.mesh.userData.petriCtrl;
      if (petriCtrl) {
        prompt = petriCtrl.lidOpen
          ? '🧫 Clique para fechar a tampa da placa'
          : '🧫 Clique para abrir a tampa (Fluxo Laminar ligado e higienizado)';
      }
    } else if (ctx.heldItem.id && ctx.heldItem.id.indexOf('gloves_box_') === 0) {
      prompt = (ctx.wearingGloves ? '🧤 Clique para retirar Luvas de Nitrilo' : '🧤 Clique para calçar Luvas de Nitrilo Estéreis') + ' • G/Q para posicionar';
    } else if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer) {
      if (ctx.thermoLaserOn) {
        prompt = '🔴 [SCAN] ' + (ctx.thermoTargetLabel || 'Ambiente') + ': ' + ctx.thermoCurrentTemp.toFixed(1) + '°C (Clique: Desligar Laser • G/Q ou clique dir.: posicionar)';
      } else {
        prompt = '🔫 Laser DESLIGADO • Última: ' + ctx.thermoCurrentTemp.toFixed(1) + '°C [HOLD] (Clique: Ligar Laser • G/Q ou clique dir.: posicionar)';
      }
    } else {
      ctx.placementValid = false;
      prompt = '📦 Pressione G/Q para posicionar este item';
    }
  }
  setHoverPrompt(ctx, prompt);
}
