/**
 * Handlers de Hover para Item Segurado (MycoCampus3D)
 * Centraliza a detecção de alvos contextuais enquanto o jogador segura um item,
 * reutilizando um helper único de broad-phase + raycast em pickables.
 */

import { getHeldBoardToolColor } from './chalkboard.js';
import { updatePlacementGhostVisual } from '../entities/placement-ghost.js';
import { greenhouseHitMeshes } from '../world/greenhouse.js';
import { canFillFromSink, canItemEnterCooker, canSealSpawnBag, canSyringeSource, canSyringeTarget, hasPdaContents } from '../items/item-registry.js';
import { getCultureFridgeStorageTarget, isCultureAccessibleFromFridge } from '../items/culture-fridge.js';
import { PDA_POWDER_DOSE_GRAMS } from '../items/pda-mix.js';
import { formatSprayHoverPrompt, getSanitizationStatus } from '../items/alcohol-spray.js';
import { canDisposeItemInTrash } from '../items/lab-trash.js';
import { isItemInClosedCabinet } from '../items/lab-cabinets.js';

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
    const hit = intersectPickableItem(ctx.raycaster, cand);
    if (!hit || hit.distance >= maxDist) continue;
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
    const ghHits = ctx.raycaster.intersectObjects(greenhouseHitMeshes, true);
    if (ghHits.length > 0 && ghHits[0].distance < bestDist && ghHits[0].object.userData.greenhouseSlot) {
      const hSlot = ghHits[0].object.userData.greenhouseSlot;
      bestDist = ghHits[0].distance;
      bestTarget = hSlot;
      bestLabel = hSlot.name;
      bestPoint = ghHits[0].point;
      bestHitObj = ghHits[0];
      ctx.hoveredGreenhouseSlot = hSlot;
    }
  }
  if (!bestTarget && ctx.doorHitMeshes.length) {
    const dHits = ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false);
    if (dHits.length > 0 && dHits[0].distance < bestDist && dHits[0].object.userData.doorObj) {
      bestDist = dHits[0].distance;
      bestTarget = dHits[0].object.userData.doorObj;
      bestLabel = bestTarget.label || 'Porta';
      bestPoint = dHits[0].point;
      bestHitObj = dHits[0];
    }
  }
  if (!bestTarget && ctx.blindHitMeshes.length) {
    const bHits = ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false);
    if (bHits.length > 0 && bHits[0].distance < bestDist && bHits[0].object.userData.blindObj) {
      bestDist = bHits[0].distance;
      bestTarget = bHits[0].object.userData.blindObj;
      bestLabel = 'Persiana';
      bestPoint = bHits[0].point;
      bestHitObj = bHits[0];
    }
  }
  hidePlacementGhost(ctx);
  ctx.hoverHit = bestHitObj;
  ctx.hoveredSprayTarget = { target: bestTarget, label: bestLabel, hitPoint: bestPoint };
  setHoverPrompt(ctx, bestTarget
    ? formatSprayHoverPrompt(bestTarget, bestLabel, ctx)
    : '🧴 Borrifador Álcool 70% • Clique para borrifar ou aponte em algo (3x higieniza)');
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
    const ghHits = ctx.raycaster.intersectObjects(greenhouseHitMeshes, true);
    if (ghHits.length > 0 && ghHits[0].distance < bestDist && ghHits[0].object.userData.greenhouseSlot) {
      const hSlot = ghHits[0].object.userData.greenhouseSlot;
      bestDist = ghHits[0].distance;
      bestTarget = hSlot;
      bestLabel = hSlot.name;
      bestHitObj = ghHits[0];
    }
  }
  if (!bestTarget && ctx.doorHitMeshes && ctx.doorHitMeshes.length) {
    const dHits = ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false);
    if (dHits.length > 0 && dHits[0].distance < bestDist && dHits[0].object.userData.doorObj) {
      bestDist = dHits[0].distance;
      bestTarget = dHits[0].object.userData.doorObj;
      bestLabel = bestTarget.label || 'Porta';
      bestHitObj = dHits[0];
    }
  }
  if (!bestTarget && ctx.blindHitMeshes && ctx.blindHitMeshes.length) {
    const bHits = ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false);
    if (bHits.length > 0 && bHits[0].distance < bestDist && bHits[0].object.userData.blindObj) {
      bestDist = bHits[0].distance;
      bestTarget = bHits[0].object.userData.blindObj;
      bestLabel = 'Persiana';
      bestHitObj = bHits[0];
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
  if (ctx.placementMode || !ctx.heldItem.id || ctx.heldItem.id.indexOf('parafilm_') !== 0) return false;
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

function handleTrashHover(ctx, setHoverPrompt) {
  if (ctx.placementMode || !ctx.labTrashMeshes || !ctx.labTrashMeshes.length || !canDisposeItemInTrash(ctx.heldItem)) return false;
  const trHits = ctx.raycaster.intersectObjects(ctx.labTrashMeshes, false);
  if (trHits.length === 0 || trHits[0].distance >= 3.5) return false;
  ctx.hoveredTrash = true;
  ctx.hoverHit = trHits[0];
  hidePlacementGhost(ctx);
  setHoverPrompt(ctx, ctx.heldItem.spawnCtrl && ctx.heldItem.spawnCtrl.isBag
    ? '🗑️ Descartar Bag na Lixeira (repõe novo no estoque)'
    : '🗑️ Esvaziar conteúdo na Lixeira (limpar recipiente)');
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
    const cpHits = ctx.raycaster.intersectObject(targetPot.mesh, true);
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
  if (!canItemEnterCooker(ctx.heldItem)) return false;
  for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
    const cp = ctx.cookerPots[ci];
    if ((cp.lidItem && cp.lidItem.isAttached) || cp.contents.length >= 6) continue;
    const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
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
      const potPrompt = isBase
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
  if (!isPotHeld && !isLiquidHeld && !isBowlHeld) return false;
  const sHits = ctx.raycaster.intersectObjects(ctx.labSinkMeshes, false);
  if (sHits.length === 0 || sHits[0].distance >= 3.5) return false;
  ctx.hoverHit = sHits[0];
  ctx.hoveredSink = sHits[0].object.userData.labSink;
  const sinkAction = sHits[0].object.userData.sinkAction || 'fill';
  ctx.hoveredSinkAction = sinkAction;
  hidePlacementGhost(ctx);
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

  if (sourceCanPourWater && !sourceHasPda) {
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
    const isPourableBowl = !!(!sourceHasPda && sourceCanPourWater && pCand.bowlCtrl &&
      pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.receivesWater);
    const petriCtrl = pCand.mesh && pCand.mesh.userData.petriCtrl;
    const isPourablePetri = !!(sourceHasPda && petriCtrl && petriCtrl.mode === 'bare' &&
      pCand.meta && pCand.meta.compatibilities && pCand.meta.compatibilities.acceptsPdaMedium);
    if (!isPourableLc && !isPourablePP5 && !isPourableBowl && !isPourablePetri) return false;
    matchedMode = { isPourablePetri, isPourablePP5, petriCtrl };
    return true;
  }, intersectPickableItem, { requireFridgeAccess: true });

  if (!pourRes || !matchedMode) return false;
  ctx.hoverHit = pourRes.hit;
  ctx.hoveredPourTarget = pourRes.item;
  hidePlacementGhost(ctx);
  const targetPrompt = matchedMode.isPourablePetri
    ? (matchedMode.petriCtrl.lidOpen
      ? '🧫 Despejar 20ml de PDA/BDA em ' + pourRes.item.label
      : '🧫 Abrir a placa no Fluxo Laminar para adicionar 20ml de PDA/BDA')
    : (matchedMode.isPourablePP5 && sourceHasPda
      ? '🧪 Transferir meio PDA/BDA para ' + pourRes.item.label
      : '💧 Umedecer / Despejar água em ' + pourRes.item.label);
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
  setHoverPrompt(ctx, isSpoonTarget
    ? (res.item.bowlCtrl && res.item.bowlCtrl.mixed ? '✅ Receita já homogênea' : '🥄 Segure 3s para misturar no Pote')
    : '🥣 Porcionar receita em ' + res.item.label);
  return true;
}

function handleScalpelHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData && ctx.heldItem.mesh.userData.isScalpelBladePack) {
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
      matched = { mode: 'blade', prompt: '🔪 Trocar por lâmina #24 estéril' };
      return true;
    }
    const petriCtrl = sCand.mesh.userData.petriCtrl;
    if (!sc.hasMycelium && petriCtrl && petriCtrl.mode === 'clean' && petriCtrl.colonization >= 60) {
      matched = {
        mode: petriCtrl.lidOpen ? 'cut' : 'open',
        prompt: petriCtrl.lidOpen ? '🔪 Cortar fragmento de micélio da placa colonizada' : '🧫 Abrir a placa colonizada dentro do Fluxo Laminar'
      };
      return true;
    }
    if (!sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.colonization >= 60) {
      matched = { mode: 'cut', prompt: '🔪 Cortar fragmento de micélio (' + sCand.label + ')' };
      return true;
    }
    if (!sc.hasMycelium && sCand.wildMushroomCtrl) {
      matched = { mode: 'biopsy', prompt: '🔪 Cortar amostra de tecido de ' + sCand.wildMushroomCtrl.speciesName };
      return true;
    }
    if (sc.hasMycelium && petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.sterilized) {
      matched = {
        mode: petriCtrl.lidOpen ? 'transfer' : 'open',
        prompt: petriCtrl.lidOpen ? '🍄 Transferir o fragmento para ' + sCand.label : '🧫 Abrir a placa estéril no Fluxo Laminar'
      };
      return true;
    }
    if (sc.hasMycelium && sCand.cultureCtrl && !sCand.cultureCtrl.colonized && !sCand.cultureCtrl.contaminated) {
      matched = { mode: 'transfer_lc', prompt: '🧪 Inocular fragmento na Cultura Líquida' };
      return true;
    }
    if (sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.filled && !sCand.spawnCtrl.inoculated &&
        sCand.meta && sCand.meta.compatibilities && sCand.meta.compatibilities.receivesMyceliumCut) {
      matched = { mode: 'transfer', prompt: '🍄 Transferir micélio para ' + sCand.label };
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
  if (ctx.heldItem.id.indexOf('substrate_grain_') === 0) {
    for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
      const cp = ctx.cookerPots[ci];
      const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
      if ((cp.lidItem && cp.lidItem.isAttached) || hasBase || cp.waterMl < 3500 || (cp.grainGrams || 0) >= 4000) continue;
      const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
      if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
        ctx.hoverHit = cpHits[0];
        ctx.hoveredGrainCooker = cp;
        hidePlacementGhost(ctx);
        setHoverPrompt(ctx, '🌽 Adicionar +500g de Milho de Pipoca na Panela (' + Math.round(cp.grainGrams || 0) + '/4000g • cozinhar 20m ao dente)');
        return true;
      }
    }
  }
  let isBowl = false;
  const res = findPickableHit(ctx, 3.5, (gCand) => {
    const recSub = !!(gCand.spawnCtrl && !gCand.spawnCtrl.filled &&
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
  setHoverPrompt(ctx, isBowl
    ? '🌾 Adicionar +100g de grãos/substrato no Pote de Mistura'
    : '🌾 Encher ' + res.item.label + ' com grãos/substrato');
  return true;
}

function handleSyringeHover(ctx, intersectPickableItem, setHoverPrompt) {
  if (!ctx.heldItem.mesh.userData.isSyringe || !ctx.heldItem.meta ||
      !ctx.heldItem.meta.compatibilities || !ctx.heldItem.meta.compatibilities.transfersLiquidCulture) {
    return false;
  }
  const sc = ctx.heldItem.mesh.userData.syrCtrl;
  const res = findPickableHit(ctx, 4.2, null, intersectPickableItem, { requireFridgeAccess: true });
  if (!res) return false;
  const cand = res.item;
  ctx.hoverHit = res.hit;

  if (cand.mesh.userData.liquidCtrl && !(cand.spawnCtrl && cand.spawnCtrl.isPP5)) {
    const lc = cand.mesh.userData.liquidCtrl;
    if (ctx.syringePumping) {
      ctx.hoveredSyringeTarget = { item: cand, mode: ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'draw' : 'inject' };
      hidePlacementGhost(ctx);
      const pPct = Math.round((ctx.syringePumping.elapsed / ctx.syringePumping.duration) * 100);
      setHoverPrompt(ctx, '⏳ ' + (ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'Aspirando Micélio' : 'Injetando de volta') + ' (' + pPct + '%)...');
      return true;
    }
    if (sc.volMl < 9.9 && lc.volMl > 0 && canSyringeSource(cand)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'draw' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, '💉 SEGURE o clique para aspirar cultura líquida (' + sc.volMl.toFixed(1) + '/10 ml • solte para parar)');
      return true;
    }
    if (sc.volMl > 0.1 && canSyringeTarget(cand)) {
      ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
      hidePlacementGhost(ctx);
      setHoverPrompt(ctx, '💉 Seringa com ' + sc.volMl.toFixed(1) + ' ml • SEGURE o clique para devolver ao frasco (solte para parar)');
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
        setHoverPrompt(ctx, '🧫 Clique para abrir a placa no Fluxo Laminar');
      } else if (sc.volMl >= 1) {
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
      setHoverPrompt(ctx, '💉 Inocular ' + Math.round(sc.volMl) + 'ml em ' + cand.label + ' (2s)');
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
    ? '🧊 Abra a geladeira para guardar ' + cultureLabel
    : (fridgeTarget.slotPosition
      ? '🧊 Guardar ' + cultureLabel + ' • conservar a 4°C'
      : '🧊 Geladeira cheia • retire um item antes'));
  return true;
}

/**
 * Executa os handlers contextuais para o item atualmente segurado.
 * @returns {boolean} true se um alvo contextual assumiu o hover e já atualizou o prompt.
 */
export function resolveHeldItemHover(ctx, rayNdc, helpers) {
  const { intersectPickableItem, setHoverPrompt, updateHeldItemPlacementPreview } = helpers;
  if (!ctx.heldItem) return false;

  if (handleChalkboardHover(ctx, setHoverPrompt)) return true;
  if (handleAlcoholSprayHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handlePaperTowelHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleParafilmHover(ctx, intersectPickableItem, setHoverPrompt)) return true;
  if (handleTrashHover(ctx, setHoverPrompt)) return true;
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

  if (ctx.placementMode) {
    updateHeldItemPlacementPreview(ctx, rayNdc);
    return true;
  }
  return false;
}
