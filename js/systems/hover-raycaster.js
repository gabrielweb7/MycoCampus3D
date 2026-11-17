/**
 * Sistema de Raycasting & Deteccao de Hover (MycoCampus3D)
 * Responsavel por identificar alvos sob a mira/cursor e atualizar o prompt contextual do HUD.
 */

import { getHeldBoardToolColor } from './chalkboard.js';
import { cancelHeldItemPlacement, updateHeldItemPlacementPreview } from './held-item-placement.js';
import { isSeatOccupied } from './world-interactions.js';
import { greenhouseHitMeshes } from '../world/greenhouse.js';
import { canFillFromSink, canItemEnterCooker, canSealSpawnBag, canSyringeSource, canSyringeTarget, hasPdaContents } from '../items/item-registry.js';
import { BURNER_LEVEL_NAMES } from '../items/pressure-cooker.js';
import { getCultureFridgeStorageTarget, isCultureAccessibleFromFridge } from '../items/culture-fridge.js';
import { PDA_POWDER_DOSE_GRAMS } from '../items/pda-mix.js';

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
  ctx.hoveredFridgeTarget = null;
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
        const aHit = intersectPickableItem(ctx.raycaster, aCand);
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
        const hit = intersectPickableItem(ctx.raycaster, pCand);
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
        const hHit = intersectPickableItem(ctx.raycaster, hCand);
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
          const hit = intersectPickableItem(ctx.raycaster, pCand);
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
        if (pCand === ctx.heldItem || ctx.isHeldByRemote(pCand.id) || !isCultureAccessibleFromFridge(ctx, pCand)) continue;
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
        const pHit = intersectPickableItem(ctx.raycaster, pCand);
        if (pHit && pHit.distance < 3.5) {
          ctx.hoveredPourTarget = pCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) {
            const targetPrompt = isPourablePetri
              ? (petriCtrl.lidOpen
                ? '🧫 Despejar 20ml de PDA/BDA em ' + pCand.label
                : '🧫 Abrir a placa no Fluxo Laminar para adicionar 20ml de PDA/BDA')
              : (isPourablePP5 && sourceHasPda
                ? '🧪 Transferir meio PDA/BDA para ' + pCand.label
                : '💧 Umedecer / Despejar água em ' + pCand.label);
            ctx.callbacks.onHoverPrompt(targetPrompt);
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
        const fHit = intersectPickableItem(ctx.raycaster, fCand);
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
        const bHit = intersectPickableItem(ctx.raycaster, bCand);
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
        if (sCand === ctx.heldItem || ctx.isHeldByRemote(sCand.id) || !isCultureAccessibleFromFridge(ctx, sCand)) continue;
        const sdx = sCand.mesh.position.x - sRefX, sdz = sCand.mesh.position.z - sRefZ;
        if (sdx * sdx + sdz * sdz > 100) continue;
        const sHit = intersectPickableItem(ctx.raycaster, sCand);
        if (sHit && sHit.distance < 3.5) {
          if (sCand.mesh.userData.isScalpelBladePack) {
            ctx.hoveredScalpelTarget = { mode: 'blade', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🔪 Trocar por lâmina #24 estéril');
            return;
          }
          const petriCtrl = sCand.mesh.userData.petriCtrl;
          if (!sc.hasMycelium && petriCtrl && petriCtrl.mode === 'clean' && petriCtrl.colonization >= 60) {
            ctx.hoveredScalpelTarget = { mode: petriCtrl.lidOpen ? 'cut' : 'open', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(petriCtrl.lidOpen
              ? '🔪 Cortar fragmento de micélio da placa colonizada'
              : '🧫 Abrir a placa colonizada dentro do Fluxo Laminar');
            return;
          }
          if (!sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.colonization >= 60) {
            ctx.hoveredScalpelTarget = { mode: 'cut', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🔪 Cortar fragmento de micélio (' + sCand.label + ')');
            return;
          }
          if (sc.hasMycelium && petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.sterilized) {
            ctx.hoveredScalpelTarget = { mode: petriCtrl.lidOpen ? 'transfer' : 'open', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(petriCtrl.lidOpen
              ? '🍄 Transferir o fragmento para ' + sCand.label
              : '🧫 Abrir a placa estéril no Fluxo Laminar');
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
        const gHit = intersectPickableItem(ctx.raycaster, gCand);
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
        if (cand === ctx.heldItem || ctx.isHeldByRemote(cand.id) || !isCultureAccessibleFromFridge(ctx, cand)) continue;
        const sydx = cand.mesh.position.x - syRefX, sydz = cand.mesh.position.z - syRefZ;
        if (sydx * sydx + sydz * sydz > 100) continue;
        const sHit = intersectPickableItem(ctx.raycaster, cand);
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
          } else if (cand.mesh.userData.isPetri) {
            const petriCtrl = cand.mesh.userData.petriCtrl;
            if (petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.sterilized) {
              if (!petriCtrl.lidOpen) {
                ctx.hoveredSyringeTarget = { item: cand, mode: 'open' };
                if (ctx.placementGhost) ctx.placementGhost.visible = false;
                if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🧫 Clique para abrir a placa no Fluxo Laminar');
              } else if (sc.volMl >= 1) {
                ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
                if (ctx.placementGhost) ctx.placementGhost.visible = false;
                if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💉 Inocular exatamente 1ml de cultura em ' + cand.label + ' (2s)');
              } else if (ctx.callbacks.onHoverPrompt) {
                ctx.callbacks.onHoverPrompt('💉 Aspire cultura líquida até ter pelo menos 1ml para a placa');
              }
            } else {
              const petriMode = petriCtrl && petriCtrl.mode;
              const hint = petriMode === 'bare'
                ? '🧫 Adicione PDA e esterilize esta placa antes de inocular'
                : (petriMode === 'filled'
                  ? '♨️ Feche a tampa e esterilize o meio PDA/BDA na panela'
                  : '🧫 Placa com cultura; use bisturi estéril para transferir micélio');
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(hint);
            }
            return;
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
            const spawnPrompt = getSyringeTargetHint(cand.spawnCtrl, sc.volMl, pdaAgarReady, cand.pdaMediumCtrl);
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(spawnPrompt);
            return;
          }
        }
      }
    }
    if (!ctx.placementMode) {
      const fridgeTarget = getCultureFridgeStorageTarget(ctx);
      if (fridgeTarget) {
        ctx.hoveredFridgeTarget = fridgeTarget;
        if (ctx.placementGhost) ctx.placementGhost.visible = false;
        const cultureLabel = fridgeTarget.displayLabel;
        const fridgePrompt = !fridgeTarget.ready
          ? '⏳ Aguarde 100% de colonização antes de refrigerar'
          : (!fridgeTarget.fridge.fridgeCtrl.doorOpen
            ? '🧊 Abra a geladeira para guardar o ' + cultureLabel
            : (fridgeTarget.slotPosition
              ? '🧊 Guardar ' + cultureLabel + ' • conservar a 4°C'
              : '🧊 Geladeira cheia • retire uma cultura antes'));
        if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(fridgePrompt);
        return;
      }
    }
    if (ctx.heldItem.mesh.userData.isPetri && !ctx.placementMode) {
      const petriCtrl = ctx.heldItem.mesh.userData.petriCtrl;
      if (petriCtrl) {
        if (ctx.callbacks.onHoverPrompt) {
          ctx.callbacks.onHoverPrompt(petriCtrl.lidOpen
            ? '🧫 Clique para fechar a tampa da placa'
            : '🧫 Clique para abrir a tampa (Fluxo Laminar ligado e higienizado)');
        }
        return;
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
      if (item === ctx.heldItem || (ctx.heldItem && item === ctx.heldItem.lidItem) ||
          !isCultureAccessibleFromFridge(ctx, item)) continue;
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
      } else if (ctx.hoveredPickable.fridgeCtrl) {
        prompt = ctx.hoveredPickable.fridgeCtrl.doorOpen
          ? '🧊 Fechar Geladeira de Culturas (4°C)'
          : '🧊 Abrir Geladeira de Culturas (4°C)';
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
