/**
 * Handlers de Hover para Item Segurado (MycoCampus3D)
 * Centraliza a detecção de alvos contextuais enquanto o jogador segura um item,
 * reutilizando um helper único de broad-phase + raycast em pickables.
 */

import { getHeldBoardToolColor } from './chalkboard.js';
import { getSyringeInjectionDoseMl } from '../items/syringe.js';
import { updatePlacementGhostVisual } from '../entities/placement-ghost.js';
import { greenhouseHitMeshes } from '../world/greenhouse.js';
import { canFillFromSink, canItemEnterCooker, canSealSpawnBag, canSyringeSource, canSyringeTarget, hasPdaContents } from '../items/item-registry.js';
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
import {
  roadSaleStandMeshes,
  isHoldingPackOrCrateForStand,
  MYCOCOIN_PRICE_PER_PACK
} from '../items/dehydration-packaging.js';

function getRefXZ(ctx) {
  return {
    x: ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x,
    z: ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z
  };
}

function hidePlacementGhost(ctx) {
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
}

function rayIntersectsAabbExit(origin, dir, c) {
  const cMinY = typeof c.minY === 'number' ? c.minY : 0;
  const cMaxY = typeof c.maxY === 'number' ? c.maxY : 2.5;
  if (cMaxY - cMinY < 0.38) return -1;

  const invDx = 1 / (Math.abs(dir.x) > 1e-6 ? dir.x : 1e-6);
  const invDy = 1 / (Math.abs(dir.y) > 1e-6 ? dir.y : 1e-6);
  const invDz = 1 / (Math.abs(dir.z) > 1e-6 ? dir.z : 1e-6);

  const tx1 = (c.minX - origin.x) * invDx;
  const tx2 = (c.maxX - origin.x) * invDx;
  const ty1 = (cMinY - origin.y) * invDy;
  const ty2 = (cMaxY - origin.y) * invDy;
  const tz1 = (c.minZ - origin.z) * invDz;
  const tz2 = (c.maxZ - origin.z) * invDz;

  const tmin = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
  const tmax = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));
  if (tmax < tmin || tmax <= 0.05) return -1;
  return tmax;
}

function rayHitsWallBefore(origin, dir, walls, maxDist) {
  if (!walls || !walls.length) return false;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (!w) continue;
    const sx = w.x2 - w.x1;
    const sz = w.z2 - w.z1;
    const denom = dir.x * sz - dir.z * sx;
    if (Math.abs(denom) < 1e-6) continue;
    const qx = w.x1 - origin.x;
    const qz = w.z1 - origin.z;
    const t = (qx * sz - qz * sx) / denom;
    if (t <= 0.05 || t >= maxDist - 0.05) continue;
    const u = (qx * dir.z - qz * dir.x) / denom;
    if (u < -0.005 || u > 1.005) continue;
    const hitY = origin.y + dir.y * t;
    const minY = typeof w.minY === 'number' ? w.minY : 0;
    const maxY = typeof w.maxY === 'number' ? w.maxY : 3.6;
    if (hitY >= minY && hitY <= maxY) return true;
  }
  return false;
}

/**
 * Verifica se o raio atravessou completamente uma estante/bancada/móvel ou parede
 * antes de atingir um alvo mais distante (ex.: persianas, portas ou itens atrás da estante).
 */
export function isRayOccludedByStructure(ctx, targetDist, opts) {
  if (!ctx || !ctx.raycaster || !ctx.raycaster.ray || !isFinite(targetDist)) return false;
  const ray = ctx.raycaster.ray;
  const origin = ray.origin;
  const dir = ray.direction;
  const ignoreCollider = opts && opts.ignoreCollider;

  const colliders = ctx.solidColliders;
  if (colliders && colliders.length) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (!c || c === ignoreCollider) continue;
      const tExit = rayIntersectsAabbExit(origin, dir, c);
      if (tExit > 0.05 && tExit < targetDist - 0.04) {
        return true;
      }
    }
  }

  if (opts && opts.checkWalls && rayHitsWallBefore(origin, dir, ctx.wallSegments, targetDist)) {
    return true;
  }
  return false;
}

export function firstUnoccludedRayHit(ctx, hits, maxDist, opts) {
  if (!hits || !hits.length) return null;
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (!h || h.distance >= maxDist) continue;
    if (h.object && h.object.userData && h.object.userData.ignoreRay) continue;
    if (!isRayOccludedByStructure(ctx, h.distance, opts)) return h;
  }
  return null;
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
  if (syringeVolume <= 0) return '💉 Seringa vazia • Aspire cultura líquida antes de inocular';
  if (!spawn.filled) return '🌽 Adicione substrato antes de inocular';
  if (spawn.substrateKind === 'coco_verm' || spawn.substrateKind === 'sawdust') {
    return '⚠️ Substrato bulk não vai na seringa — use spawn colonizado no Monotub/Estufa';
  }
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
  setHoverPrompt(ctx, toolCol === 'erase'
    ? (touchUi ? '🧽 Arraste na lousa para apagar' : '🧽 Segure o clique para apagar a lousa')
    : (touchUi ? '✏️ Arraste na lousa para escrever' : '✏️ Segure o clique para escrever na lousa'));
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
  let prompt = '🫧 H₂O₂ 3% (Água Oxigenada) • Aponte em Monotub, Spawn ou Bolo da Estufa c/ Cobweb';
  if (bestTarget) {
    const isCobweb = !!(
      (bestTarget.monotubCtrl && bestTarget.monotubCtrl.contaminated && bestTarget.monotubCtrl.contamKind === 'cobweb') ||
      (bestTarget.spawnCtrl && bestTarget.spawnCtrl.contaminated && bestTarget.spawnCtrl.contamKind === 'cobweb') ||
      (bestTarget.contaminated && bestTarget.contamKind === 'cobweb')
    );
    prompt = isCobweb
      ? `🫧 Clique para dissolver Cobweb (Teia) com H₂O₂ 3% em ${bestLabel}`
      : `🫧 Borrifar H₂O₂ 3% preventivo em ${bestLabel}`;
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
      ? `💧 Borrifar névoa de Água Destilada no Monotub (${Math.round(mc.humidity || 70)}% UR)`
      : '💧 Aguarde o Monotub colonizar 100% para borrifar névoa de frutificação');
  } else if (bestTarget && bestTarget.id !== undefined) {
    setHoverPrompt(ctx, bestTarget.empty
      ? '💧 Espaço vazio na Estufa — coloque spawn antes de borrifar névoa'
      : `💧 Hidratar ${bestLabel} (${Math.round(bestTarget.humidity)}% UR) com Água Destilada`);
  } else {
    setHoverPrompt(ctx, '💧 Mire no Monotub ou na Estufa para hidratar • mire numa bancada para posicionar');
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
      bestLabel = bestTarget.label || 'Porta';
      bestPoint = dHit.point;
      bestHitObj = dHit;
    }
  }
  if (!bestTarget && ctx.blindHitMeshes.length) {
    const bHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false), bestDist);
    if (bHit && bHit.object.userData.blindObj) {
      bestDist = bHit.distance;
      bestTarget = bHit.object.userData.blindObj;
      bestLabel = 'Persiana';
      bestPoint = bHit.point;
      bestHitObj = bHit;
    }
  }
  hidePlacementGhost(ctx);
  ctx.hoverHit = bestHitObj;
  ctx.hoveredSprayTarget = { target: bestTarget, label: bestLabel, hitPoint: bestPoint };
  if (bestTarget && bestTarget.monotubCtrl && bestTarget.monotubCtrl.colonization >= 100 && !bestTarget.monotubCtrl.spent && !bestTarget.monotubCtrl.contaminated) {
    setHoverPrompt(ctx, '⚠️ Não borrife Álcool 70% sobre micélio colonizado! Use o 💧 Borrifador Água Destilada');
  } else if (ctx.hoveredGreenhouseSlot && !ctx.hoveredGreenhouseSlot.empty) {
    setHoverPrompt(ctx, '⚠️ Álcool 70% agride bolos vivos! Use o 💧 Borrifador Água Destilada para hidratar');
  } else {
    setHoverPrompt(ctx, bestTarget
      ? formatSprayHoverPrompt(bestTarget, bestLabel, ctx)
      : '🧴 Mire numa superfície para borrifar • use a opção numerada para higienizar as luvas');
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
      bestLabel = bestTarget.label || 'Porta';
      bestHitObj = dHit;
    }
  }
  if (!bestTarget && ctx.blindHitMeshes && ctx.blindHitMeshes.length) {
    const bHit = firstUnoccludedRayHit(ctx, ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false), bestDist);
    if (bHit && bHit.object.userData.blindObj) {
      bestDist = bHit.distance;
      bestTarget = bHit.object.userData.blindObj;
      bestLabel = 'Persiana';
      bestHitObj = bHit;
    }
  }

  hidePlacementGhost(ctx);
  ctx.hoverHit = bestHitObj;
  ctx.hoveredWipeTarget = bestTarget ? { target: bestTarget, label: bestLabel } : null;
  if (!bestTarget) {
    setHoverPrompt(ctx, '🧻 Papel Toalha Asséptico • Aponte para item ou Fluxo Laminar com Álcool 70% para secar (120s)');
    return true;
  }
  const st = getSanitizationStatus(bestTarget, ctx);
  const wPrompt = st.alcoholWet
    ? '🧻 Secar Álcool 70% de ' + bestLabel + ' (Desinfectar 120s!)'
    : (st.isSanitized
      ? '✨ [DESINFECTADO • ' + st.remainingSec + 's] ' + bestLabel + ' — Passar Papel reseta 120s'
      : '⚠️ Passe Álcool 70% em ' + bestLabel + ' antes de secar');
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
      ? '⚠️ Feche a tampa da Placa de Petri antes de vedar com Parafilm M'
      : (pc.parafilmSealed
        ? '✅ Placa de Petri já vedada com Parafilm M'
        : (pc.mode === 'bare'
          ? '🧫 Adicione PDA/BDA e esterilize a placa antes de vedar'
          : '🎞️ Vedar ' + res.item.label + ' com Parafilm M (Protege contra contaminação)'));
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
    setHoverPrompt(ctx, resF.item.foilWrapped
      ? '✅ ' + resF.item.label + ' já protegido com Papel Alumínio'
      : '🪙 Envolver tampa de ' + resF.item.label + ' com Papel Alumínio (Autoclave)');
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
    setHoverPrompt(ctx, resM.item.microporeSealed
      ? '✅ ' + resM.item.label + ' já possui Fita Micropore'
      : '🩹 Aplicar Fita Micropore (troca gasosa estéril) em ' + resM.item.label);
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
      ? '💧 Adicione pelo menos 50ml de água antes de colocar Malte/Mel (4%)'
      : `🍯 Adicionar +${dose}g de Malte/Mel (4% para ${dLc.volMl}ml) em ${resN.item.label}`);
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
  setHoverPrompt(ctx, '🧪 Adicionar ' + PDA_POWDER_DOSE_GRAMS + 'g de PDA/BDA ao béquer');
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
        ? '♨️ Selar ' + res.item.label + ' antes da esterilização'
        : (!hSc.filled
          ? '🌾 Preencha o bag com substrato antes de selar'
          : (hSc.sealed
            ? '✅ Este bag já está selado'
            : (hSc.sterilized || hSc.inoculated
              ? '⚠️ O bag deve ser selado antes da esterilização'
              : (hSc.burned ? '🔥 Este bag foi queimado' : '🦠 Este bag está contaminado'))));
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
        ? '♨️ Selar este Bag na Seladora Térmica (na mão!)'
        : (!hSc.filled
          ? '🌾 Preencha o bag com substrato antes de selar'
          : (hSc.sealed ? '✅ Este bag já está selado' : '⚠️ O bag não pode ser selado neste estado'));
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
      setHoverPrompt(ctx, '🍲 Clique para fechar a Tampa na ' + targetPot.label);
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
        ? '🧫 Use a opção numerada Fechar Tampa antes de colocar a placa na panela'
        : isBase
        ? (hasBase
          ? '⚠️ Esta panela já possui Base Perfurada'
          : (cp.waterMl > 4000
            ? '⚠️ Muita água na panela! Tire o excesso na pia antes de encaixar a Base'
            : '⚙️ Clique para encaixar a Base Perfurada (4cm) no fundo'))
        : (!hasBase
          ? '⚠️ Encaixe primeiro a Base Perfurada (4cm) na panela'
          : '🍲 Colocar ' + ctx.heldItem.label + ' sobre a Base na Panela');
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
  if (!isPotHeld && !isLiquidHeld && !isBowlHeld && !isDrySpawnHeld && !isDunkMonotubHeld) return false;
  const sHits = ctx.raycaster.intersectObjects(ctx.labSinkMeshes, false);
  if (sHits.length === 0 || sHits[0].distance >= 3.5) return false;
  ctx.hoverHit = sHits[0];
  if (isDunkMonotubHeld) {
    ctx.hoveredMonotubDunkSink = true;
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, `💦 Mergulhar/Encher Monotub 24L na Pia (Cold Shock / Dunk 99% UR p/ Flush ${ctx.heldItem.monotubCtrl.flush}/4!)`);
    return true;
  }
  ctx.hoveredSink = sHits[0].object.userData.labSink;
  const sinkAction = sHits[0].object.userData.sinkAction || 'fill';
  ctx.hoveredSinkAction = sinkAction;
  hidePlacementGhost(ctx);
  if (isDrySpawnHeld) {
    const scDry = ctx.heldItem.spawnCtrl;
    setHoverPrompt(ctx, `💧 SEGURE na Torneira para hidratar os grãos (${Math.round(scDry.waterMl || 0)}/60ml) antes de esterilizar`);
    return true;
  }
  if (isBowlHeld) {
    const bc = ctx.heldItem.bowlCtrl;
    if (bc.mixed) {
      setHoverPrompt(ctx, '🗑️ Mistura já homogênea — descarte na lixeira');
    } else if (sinkAction === 'drain') {
      const w = Math.round(bc.ingredients.water || 0);
      setHoverPrompt(ctx, w > 0
        ? '🚰 SEGURE na Cuba para esvaziar água do Pote (' + w + 'g água)'
        : '🗑️ Só há sólidos no Pote — use a lixeira para descartar');
    } else {
      const tot = Math.round(Object.values(bc.ingredients).reduce((a, b) => a + b, 0));
      setHoverPrompt(ctx, '💧 SEGURE na Torneira para encher água no Pote (' + tot + '/600g)');
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
  setHoverPrompt(ctx, sinkAction === 'drain'
    ? '🚰 SEGURE na Cuba da Pia para derramar água de ' + ctx.heldItem.label + volTxt
    : '🚰 SEGURE na Torneira para encher ' + ctx.heldItem.label + volTxt + ' (solte para parar)');
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
      setHoverPrompt(ctx, beakerRes.item.pdaMediumCtrl.powderGrams > 0
        ? '💧 Completar o preparo do PDA/BDA com água'
        : '💧 Adicionar água ao Béquer (pode pôr PDA depois)');
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
        setHoverPrompt(ctx, '💧 SEGURE o clique para despejar água na Panela (' + (cp.waterMl / 1000).toFixed(1) + 'L / ' + (potWaterCap / 1000).toFixed(1) + 'L)');
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
      ? '🧫 Despejar 20ml de PDA/BDA em ' + pourRes.item.label
      : '🧫 Use a opção numerada Abrir placa no alvo dentro do Fluxo Laminar')
    : (matchedMode.isPourableDryGrain
      ? '💧 Hidratar grãos em ' + pourRes.item.label
      : (matchedMode.isPourablePP5 && sourceHasPda
        ? '🧪 Transferir meio PDA/BDA para ' + pourRes.item.label
        : '💧 Umedecer / Despejar água em ' + pourRes.item.label));
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
  setHoverPrompt(ctx, isBowlTarget ? '🌽 Adicionar +50g de Flocão no Pote de Mistura' : '🌽 Colocar 45g de Flocão em ' + res.item.label);
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
      ? '✅ Receita já homogênea'
      : (bulkIncomplete
        ? (((bIng.sawdust || 0) > 0 && (bIng.coco || 0) <= 0 && (bIng.vermiculite || 0) <= 0)
          ? '⚠️ Adicione Água à Serragem antes de misturar!'
          : '⚠️ Substrato requer Vermiculita + Pó de Coco + Água antes de misturar!')
        : (spoonKindCount < 2 ? '⚠️ Adicione pelo menos 2 ingredientes antes de misturar' : '🥄 Segure 3s para misturar no Pote')))
    : '🥣 Porcionar receita em ' + res.item.label);
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
    setHoverPrompt(ctx, '🔪 Encaixar Lâmina Estéril #24 no Bisturi');
    return true;
  }
  if (!ctx.heldItem.scalpelCtrl) return false;
  const sc = ctx.heldItem.scalpelCtrl;
  let matched = null;
  const res = findPickableHit(ctx, 3.5, (sCand) => {
    if (sCand.mesh.userData.isScalpelBladePack) {
      if (sCand.bladePackCtrl && sCand.bladePackCtrl.empty) {
        matched = { mode: 'blade', prompt: '🗑️ Embalagem de lâmina vazia (jogue no lixo)' };
      } else {
        matched = { mode: 'blade', prompt: '🔪 Trocar por lâmina #24 estéril' };
      }
      return true;
    }
    const petriCtrl = sCand.mesh.userData.petriCtrl;
    if (!sc.hasMycelium && petriCtrl && petriCtrl.mode === 'spore_print') {
      matched = {
        mode: petriCtrl.lidOpen ? 'scrape_spores' : 'open',
        prompt: petriCtrl.lidOpen
          ? '🔪 Coletar um monoesporo do carimbo (' + (petriCtrl.speciesName || 'Cogumelo') + ')'
          : '🧫 Use a opção numerada Abrir placa no alvo antes de raspar os esporos'
      };
      return true;
    }
    if (!sc.hasMycelium && petriCtrl && petriCtrl.mode === 'clean' && petriCtrl.colonization >= 60) {
      matched = {
        mode: petriCtrl.lidOpen ? 'cut' : 'open',
        prompt: petriCtrl.lidOpen ? '🔪 Cortar fragmento de micélio da placa colonizada' : '🧫 Use a opção numerada Abrir placa no alvo dentro do Fluxo Laminar'
      };
      return true;
    }
    if (!sc.hasMycelium && sCand.pdaMediumCtrl && sCand.pdaMediumCtrl.isSlant && sCand.cultureCtrl &&
        sCand.cultureCtrl.colonized && !sCand.cultureCtrl.contaminated && !sCand.cultureCtrl.expired) {
      matched = { mode: 'cut', prompt: '🔪 Coletar repique do Tubo Slant (' + sCand.label + ')' };
      return true;
    }
    if (!sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.colonization >= 60) {
      if (sCand.spawnCtrl.isPP5 && !sCand.spawnCtrl.lidOpen) {
        matched = { mode: 'open', prompt: '🥣 Use a opção numerada Abrir potinho no alvo antes de cortar' };
      } else {
        matched = { mode: 'cut', prompt: '🔪 Cortar fragmento de micélio (' + sCand.label + ')' };
      }
      return true;
    }
    if (!sc.hasMycelium && sCand.wildMushroomCtrl) {
      matched = { mode: 'biopsy', prompt: '🔪 Cortar amostra de tecido de ' + sCand.wildMushroomCtrl.speciesName };
      return true;
    }
    if (sc.hasMycelium && sCand.pdaMediumCtrl && sCand.pdaMediumCtrl.isSlant && sCand.pdaMediumCtrl.sterilized &&
        !sCand.pdaMediumCtrl.burned && sCand.cultureCtrl && !sCand.cultureCtrl.inoculated && !sCand.cultureCtrl.contaminated) {
      matched = { mode: 'transfer_slant', prompt: '🧪 Inocular fragmento no Tubo Slant 15ml (Cultura-Mãe)' };
      return true;
    }
    if (sc.hasMycelium && petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.sterilized) {
      matched = {
        mode: petriCtrl.lidOpen ? 'transfer' : 'open',
        prompt: petriCtrl.lidOpen ? (sc.isSporeSample ? '🌱 Germinar monoesporo em ' : '🍄 Transferir amostra para ') + sCand.label : '🧫 Use a opção numerada Abrir placa no alvo dentro do Fluxo Laminar'
      };
      return true;
    }
    if (sc.hasMycelium && !sc.isSporeSample && petriCtrl && petriCtrl.mode === 'clean' && !petriCtrl.contaminated && !petriCtrl.hybridMutant) {
      matched = {
        mode: petriCtrl.lidOpen ? 'crossbreed' : 'open',
        prompt: petriCtrl.lidOpen
          ? '🧬 Cruzar genéticas na Placa de Petri (Gerar Híbrido Albino/Dourado)'
          : '🧫 Use a opção numerada Abrir placa no alvo antes do cruzamento'
      };
      return true;
    }
    if (sc.hasMycelium && sCand.cultureCtrl && !sCand.cultureCtrl.inoculated && !sCand.cultureCtrl.colonized &&
        !sCand.cultureCtrl.contaminated && !(sCand.pdaMediumCtrl && sCand.pdaMediumCtrl.isSlant) &&
        sCand.mesh.userData.liquidCtrl && sCand.mesh.userData.liquidCtrl.volMl > 0) {
      matched = { mode: 'transfer_lc', prompt: sc.isSporeSample ? '🌱 Germinar monoesporo no caldo nutritivo' : '🧪 Inocular amostra na cultura líquida' };
      return true;
    }
    if (sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.filled && !sCand.spawnCtrl.inoculated &&
        sCand.meta && sCand.meta.compatibilities && sCand.meta.compatibilities.receivesMyceliumCut) {
      if (sCand.spawnCtrl.isPP5 && !sCand.spawnCtrl.lidOpen) {
        matched = { mode: 'open', prompt: '🥣 Use a opção numerada Abrir potinho no alvo dentro do Fluxo Laminar' };
      } else {
        matched = { mode: 'transfer', prompt: '🍄 Transferir micélio para ' + sCand.label };
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
        setHoverPrompt(ctx, '🌽 Encher ' + ctx.heldItem.label + ' com Milho Ao Dente (' + Math.round(cp.grainGrams) + 'g disponíveis)');
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
        setHoverPrompt(ctx, '🌾 Adicionar +500g de Grãos na Panela (' + Math.round(cp.grainGrams || 0) + '/4000g • cozinhar 20m ao dente)');
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
  const subName = isVerm
    ? 'Vermiculita'
    : (isSawdust
      ? 'Serragem de Eucalipto'
      : (isCoco
        ? 'Pó de Coco'
        : (isSorghum ? 'Sorgo Vermelho' : (isWheat ? 'Trigo em Grão' : 'Milho de Pipoca'))));
  setHoverPrompt(ctx, isBowl
    ? `🥣 Adicionar +100g de ${subName} no Pote de Mistura`
    : `🌾 Encher ${res.item.label} com ${subName}`);
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
      setHoverPrompt(ctx, '🥣 Use a opção numerada Abrir potinho no alvo dentro do Fluxo Laminar');
      return true;
    }
    if (canSyringeTarget(cand) && sc.volMl >= 1 && sc.mix?.lcMl > 0.05) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, '💉 Pingar 1ml de cultura em ' + cand.label + ' (2s)');
      return true;
    }
    if (canSyringeTarget(cand)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
      setHoverPrompt(ctx, '💉 Aspire cultura líquida até ter pelo menos 1 ml para o potinho');
      return true;
    }
  }

  if (cand.mesh.userData.liquidCtrl && !(cand.spawnCtrl && cand.spawnCtrl.isPP5)) {
    const lc = cand.mesh.userData.liquidCtrl;
    if (ctx.syringePumping) {
      ctx.hoveredSyringeTarget = { item: cand, mode: ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'draw' : 'inject' };
      hidePlacementGhost(ctx);
      const pPct = Math.round((ctx.syringePumping.elapsed / ctx.syringePumping.duration) * 100);
      setHoverPrompt(ctx, '⏳ ' + (ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'Aspirando líquido' : 'Injetando líquido') + ' (' + pPct + '%)...');
      return true;
    }
    const hasCulture = (sc.mix?.lcMl || 0) > 0.05;
    const culture = cand.cultureCtrl;
    const prepareCulture = hasCulture && culture && !culture.inoculated && !culture.colonized && !culture.contaminated;
    if (prepareCulture && (culture.hasNutrient === false || lc.volMl <= 0)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
      setHoverPrompt(ctx, '🧪 Prepare o caldo nutritivo e esterilize o frasco antes de inocular');
      return true;
    }
    const canDraw = sc.volMl < 10 && canSyringeSource(cand) && !culture?.expired;
    const injectMl = canSyringeTarget(cand) ? getSyringeInjectionDoseMl(cand, sc.volMl) : 0;
    if (injectMl > 0 && (prepareCulture || !canDraw)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, `💉 Segure para ${prepareCulture ? 'inocular' : 'injetar'} até ${injectMl} ml em ${cand.label} • solte para parar`);
      return true;
    }
    if (canDraw) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'draw' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, '💉 Segure para aspirar de ' + cand.label + ' • solte para parar');
      return true;
    }
    ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
    setHoverPrompt(ctx, sc.volMl < 9.9 && lc.volMl > 0
      ? '⚠️ Aspiração disponível apenas em frasco de cultura líquida'
      : '⚠️ Este recipiente não recebe cultura pela seringa');
    return true;
  }

  if (cand.mesh.userData.isPetri) {
    ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
    const petriCtrl = cand.mesh.userData.petriCtrl;
    if (petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.sterilized) {
      if (!petriCtrl.lidOpen) {
        ctx.hoveredSyringeTarget = { item: cand, mode: 'open' };
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, '🧫 Use a opção numerada Abrir placa no alvo dentro do Fluxo Laminar');
      } else if (sc.volMl >= 1 && sc.mix?.lcMl > 0.05) {
        ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, '💉 Inocular exatamente 1ml de cultura em ' + cand.label + ' (2s)');
      } else {
        setHoverPrompt(ctx, '💉 Aspire cultura líquida até ter pelo menos 1ml para a placa');
      }
    } else {
      const petriMode = petriCtrl && petriCtrl.mode;
      const hint = petriMode === 'bare'
        ? '🧫 Adicione PDA e esterilize esta placa antes de inocular'
        : (petriMode === 'filled'
          ? '♨️ Feche a tampa e esterilize o meio PDA/BDA na panela'
          : '🧫 Placa com cultura; use bisturi estéril para transferir micélio');
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
      setHoverPrompt(ctx, '💉 Inocular ' + doseTxt + 'ml em ' + cand.label + ' (2s)');
    } else {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'none' };
      setHoverPrompt(ctx, '💉 Seringa vazia • Aspire cultura líquida antes de inocular');
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
    ? '🧊 Use a opção numerada Abrir geladeira para guardar ' + cultureLabel
    : (fridgeTarget.slotPosition
      ? '🧊 Guardar ' + cultureLabel + ' • conservar a 4°C'
      : '🧊 Geladeira cheia • retire um item antes'));
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
      ? `♨️ Colocar ${ctx.heldItem.wildMushroomCtrl.speciesName} na Desidratadora (55°C • Secar até 0% umidade)`
      : (dc.crisp ? '✨ Lote pronto • libere a mão para retirar' : '♨️ Desidratadora ocupada • um lote por vez'));
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
    ? `🍄 Coletar Carimbo de Esporos de ${ctx.heldItem.wildMushroomCtrl.speciesName} na Placa de Petri`
    : '🧫 Use a opção numerada Abrir placa no alvo antes de fazer o carimbo');
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
      setHoverPrompt(ctx, `💡 Posicionar ${held.label} na Estante com Luz LED Direcional (Andar ${slot.tier})`);
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
        setHoverPrompt(ctx, '🌱 Despejar Bolo Seco Esgotado na Caixa de Substrato da Horta (Adubar Alfaces e Tomates!)');
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
        setHoverPrompt(ctx, '📦 Aguarde a animação');
      } else if (!mc.spent && !mc.contaminated && mc.fruitingStage === 3) {
        setHoverPrompt(ctx, '🍄 Libere a mão para colher a leva');
      } else if (mc.colonization >= 100 && !mc.spent && !mc.contaminated && !mc.hasCasing && (canAddBulk || isCasingSack)) {
        setHoverPrompt(ctx, '🥥 Aplicar Camada de Casing (Vermiculita + Fibra de Coco) sobre o Monotub 24L (+40% velocidade!)');
      } else if (mc.colonization >= 100 && !mc.spent && !mc.contaminated && isWaterJug) {
        setHoverPrompt(ctx, `💦 Cold Shock / Dunk: Reidratar Bolo do Monotub 24L com Água (99% UR p/ Flush ${mc.flush}/4)`);
      } else if (!mc.lidOpen) {
        setHoverPrompt(ctx, '📦 Use a opção numerada Abrir Monotub no alvo');
      } else if (canAddSpawn && !mc.hasSpawn) {
        setHoverPrompt(ctx, `🌾 Despejar Spawn Colonizado (${held.label}) no Monotub 24L`);
      } else if (canAddBulk && !mc.hasBulk) {
        setHoverPrompt(ctx, held.bowlCtrl && !held.bowlCtrl.pasteurized
          ? '⚠️ Adicionar substrato cru (risco de contaminação)'
          : `🥥 Adicionar substrato tratado (${held.label}) ao Monotub 24L`);
      } else if (mc.hasSpawn && mc.hasBulk && !mc.mixed) {
        setHoverPrompt(ctx, '🤲 Misturar Spawn + Substrato Pasteurizado dentro do Monotub 24L');
      } else if (mc.mixed && !mc.leveled) {
        setHoverPrompt(ctx, '📏 Nivelar e compactar o bolo dentro do Monotub 24L');
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
    const dIsGrain = d.substrateKind !== 'coco_verm' && d.substrateKind !== 'sawdust' && d.substrateKind !== 'pda';
    return !!(d.filled && dIsGrain && d.sterilized && !d.inoculated && !d.contaminated && !d.burned && (!d.isBag || d.sealed));
  }, intersectPickableItem);
  if (!res) return false;
  ctx.hoverHit = res.hit;
  ctx.hoveredG2GTarget = res.item;
  hidePlacementGhost(ctx);
  const rem = Math.max(0, 3 - (srcSc.g2gUses || 0));
  setHoverPrompt(ctx, rem > 0
    ? `🌾🧬 Transferência Grão-para-Grão (G2G) no Fluxo Laminar para ${res.item.label} (${rem}/3 usos)`
    : '⚠️ Limite de 3 repiques G2G atingido neste spawn');
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
      setHoverPrompt(ctx, held.scalpelCtrl
        ? '🔥 Flambar Lâmina #24 do Bisturi na Chama da Lamparina a Álcool (Re-esterilizar 100% Incandescente!)'
        : '🔥 Flambar Agulha da Seringa na Chama da Lamparina a Álcool (Re-esterilizar 100%!)');
      return true;
    }
  }

  // 1b. Segurando Ampola 3ML -> Guardar dentro da Maleta Porta-Ampolas 3ML!
  if (held.vial3mlCtrl) {
    const caseRes = findPickableHit(ctx, 3.6, (cand) => !!cand.caseCtrl, intersectPickableItem);
    if (caseRes) {
      const cc = caseRes.item.caseCtrl;
      const used = cc.slots ? cc.slots.filter(Boolean).length : 0;
      ctx.hoverHit = caseRes.hit;
      ctx.hoveredAmpouleCaseTarget = caseRes.item;
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, `💼 Guardar ${held.label} na Maleta Porta-Ampolas (${used}/${cc.maxSlots || 50} vagas)`);
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
      setHoverPrompt(ctx, `🛍️ Colocar ${held.driedMushroomCtrl.grams || 10}g de Cogumelos Crocantes no Saco Mylar/Zip (p/ selar na Seladora)`);
      return true;
    }
    const jarRes = findPickableHit(ctx, 3.6, (cand) => !!cand.silicaJarCtrl, intersectPickableItem);
    if (jarRes) {
      ctx.hoverHit = jarRes.hit;
      ctx.hoveredSilicaJarTarget = jarRes.item;
      hidePlacementGhost(ctx);
      const jc = jarRes.item.silicaJarCtrl;
      setHoverPrompt(ctx, `🫙 Guardar +${held.driedMushroomCtrl.grams || 10}g de Cogumelos Crocantes no Pote Hermético c/ Sílica Gel (${jc.storedGrams}/${jc.capacityGrams}g)`);
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
        setHoverPrompt(ctx, `🛍️ Encher Saco Mylar com ${batchRes.item.driedMushroomCtrl.grams || 10}g de Cogumelos Crocantes`);
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
        setHoverPrompt(ctx, `♨️ Selar Saco Mylar (${bc.grams}g • ${bc.speciesName || 'Cogumelo'}) na Seladora Térmica!`);
        return true;
      }
    } else {
      const crateRes = findPickableHit(ctx, 3.8, (cand) => !!cand.deliveryCrateCtrl, intersectPickableItem);
      if (crateRes) {
        ctx.hoverHit = crateRes.hit;
        ctx.hoveredDeliveryCrateTarget = crateRes.item;
        hidePlacementGhost(ctx);
        const cc = crateRes.item.deliveryCrateCtrl;
        setHoverPrompt(ctx, `📤 Colocar Pacote Selado (${bc.grams}g) na Caixa de Entrega (${cc.packsCount}/4)`);
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
      setHoverPrompt(ctx, `🚗💵 Colocar ${count} pacote(s) no Quiosque Drive-Thru da Estrada (Valor: 🪙 ${count * MYCOCOIN_PRICE_PER_PACK} MycoCoins — Clientes vêm de carro!)`);
      return true;
    }
  }

  // 3. Segurando qualquer cultura/amostra -> Analisar no Microscópio Óptico 1000x!
  const micRes = findPickableHit(ctx, 3.6, (cand) => !!cand.microscopeCtrl, intersectPickableItem);
  if (micRes) {
    ctx.hoverHit = micRes.hit;
    ctx.hoveredMicroscopeTarget = micRes.item;
    hidePlacementGhost(ctx);
    setHoverPrompt(ctx, `🔬 Analisar ${held.label} no Microscópio Óptico Binocular (1000x • Hifas, Grampos & Esporos)`);
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
