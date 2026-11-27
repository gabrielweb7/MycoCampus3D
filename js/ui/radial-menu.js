/**
 * Barra Flutuante Diegetica de Acoes Contextuais (PC & Mobile) - MycoCampus3D
 * Aparece automaticamente dentro do jogo ao apontar para itens/dispositivos ou segurar objetos,
 * sem soltar o Pointer Lock nem exibir cursor do Windows.
 * Acione pelos atalhos padronizados F, V, Z, G, I (PC) ou toque direto (Mobile).
 */

import { BURNER_LEVEL_NAMES, queuePurchasedBurnerState, setBurnerLevel, updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { getItemKindId } from '../items/item-registry.js';
import { getContamInfo } from '../items/contaminations.js';
import { togglePetriLid, updatePetriVisual } from '../items/petri-dish.js';
import { toggleCultureFridgeDoor, isCultureFridgeOccupied } from '../items/culture-fridge.js';
import { toggleCabinetPart } from '../items/lab-cabinets.js';
import { getSyringeMixParts } from '../items/syringe.js';
import { togglePP5Lid } from '../items/pp5-cup.js';
import { fireAlcoholSpray, getSanitizationStatus } from '../items/alcohol-spray.js';
import { getCultureRemainingDays } from '../items/culture-lifecycle.js';
import { isPdaRecipeBalanced, updatePdaMediumVisual } from '../items/pda-mix.js';
import { updateCultureLiquidLabel } from '../items/liquid-culture.js';
import { updateMixingBowlLabel } from '../items/mixing-bowl.js';
import { updateScalpelLabel } from '../items/scalpel.js';
import { getDehydratorActionLabel, interactDehydrator, updateDehydratorVisual } from '../items/dehydrator.js';
import { updateMushroomBagVisual } from '../items/mushroom-packaging.js';
import {
  handlePrimaryAction,
  pickHoveredItemForMove,
  setHeldTwoHandedGhost,
  eatHeldMushroom,
  toggleHeldGloves,
  toggleHeldThermometer
} from '../systems/interaction-system.js';
import { getMonotubActionLabel, interactMonotub, updateMonotubVisual } from '../items/monotub.js';
import { breakAndShakeSpawn, canReceiveSpawnForFruiting, getSpawnSubstrateDisplayName, updateSpawnVisual } from '../items/spawn-containers.js';
import { interactSilicaStorageJar, interactLabMicroscope } from '../items/lab-advanced-tools.js';
import { toggleAmpouleCaseLid, openAmpouleCaseModal } from '../items/ampoule-case.js';
import { handleWorldInteraction } from '../systems/world-interactions.js';
import { cancelHeldItemPlacement, toggleHeldItemPlacement } from '../systems/held-item-placement.js';
import { escapeHtml } from './dom-helpers.js';
import { diagnoseItemPedagogy } from '../core/cultivation-tracks.js';
import { discardHeldLiquid, getDrainableVolume } from '../systems/liquid-disposal.js';
import { canPruneGardenPlant } from '../world/campus-garden.js';
import { growDoorActionLabel, growHeldFeedback, growSlotActionLabel, openPortableGrowPanel, toggleGrowDoor } from '../items/portable-grow.js';
import { getDisplayItemTitle } from '../entities/hover-3d-badge.js';
import { getBeehiveInspectInfo, getHiveSyringeDose } from '../entities/bee-ecology.js';
import { getFlowerInspectInfo, interactFlower } from '../world/campus-flowers.js';
import { canDisposeItemInTrash, getTrashActionLabel, handleTrashDisposal, isContaminatedOrBurned } from '../items/lab-trash.js';
import { t } from '../core/i18n.js';

let barEl = null;
let styleInjected = false;
let currentActions = [];
let lastSignature = '';
let mobileHold = null;
const BOWL_ING_KEYS = {
  vermiculite: 'actions.radial.ing_vermiculite',
  coco: 'actions.radial.ing_coco',
  flocao: 'actions.radial.ing_flocao',
  corn: 'actions.radial.ing_corn',
  wheat: 'actions.radial.ing_wheat',
  sorghum: 'actions.radial.ing_sorghum',
  sawdust: 'actions.radial.ing_sawdust',
  water: 'actions.radial.ing_water'
};

function ensureFloatingStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const st = document.createElement('style');
  st.textContent = `
    #myco-floating-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      max-width: 100%;
      pointer-events: auto;
    }
    #myco-floating-actions.hidden { display: none; }
    .myco-float-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(57, 255, 20, 0.45);
      color: #f8fafc;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: transform 0.1s, border-color 0.1s, background 0.1s;
    }
    body.device-touch .myco-float-chip,
    body.device-phone .myco-float-chip,
    body.quality-low-fx .myco-float-chip {
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      background: rgba(15, 23, 42, 0.94);
    }
    .myco-float-chip:hover, .myco-float-chip:active {
      background: rgba(16, 185, 129, 0.35);
      border-color: #39ff14;
      transform: translateY(-1px);
    }
    body.device-touch .myco-float-chip {
      min-height: 34px;
      padding: 5px 12px;
    }
    .myco-float-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 4px;
      background: rgba(57, 255, 20, 0.18);
      color: #39ff14;
      font-size: 10px;
      font-weight: 800;
    }
    body.device-phone .myco-float-chip,
    body.device-tablet .myco-float-chip {
      padding: 8px 14px;
      font-size: 12px;
      min-height: 38px;
    }
    body.device-phone .myco-float-key,
    body.device-tablet .myco-float-key {
      display: none;
    }
  `;
  document.head.appendChild(st);
}

let _statusDismissTimeout = null;
const STATUS_CARD_POS_KEY = 'myco_status_card_pos_v1';

function clampStatusCardPos(card, x, y) {
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - card.offsetWidth - pad);
  const maxY = Math.max(pad, window.innerHeight - card.offsetHeight - pad);
  return {
    x: Math.round(Math.max(pad, Math.min(x, maxX))),
    y: Math.round(Math.max(pad, Math.min(y, maxY)))
  };
}

function applySavedStatusCardPos(card) {
  try {
    const raw = localStorage.getItem(STATUS_CARD_POS_KEY);
    if (!raw) return;
    const pos = JSON.parse(raw);
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
    const clamped = clampStatusCardPos(card, pos.x, pos.y);
    card.style.left = clamped.x + 'px';
    card.style.top = clamped.y + 'px';
    card.style.bottom = 'auto';
    card.style.transform = 'none';
  } catch {}
}

function scheduleStatusCardDismiss(card) {
  if (_statusDismissTimeout) clearTimeout(_statusDismissTimeout);
  _statusDismissTimeout = setTimeout(() => {
    card.classList.add('hidden');
  }, 5000);
}

function ensureStatusCardDraggable(card) {
  if (!card || card.dataset.dragBound === '1') return;
  card.dataset.dragBound = '1';

  let dragging = false;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  let origX = 0;
  let origY = 0;

  card.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target && e.target.closest && e.target.closest('#btn-close-status')) return;
    e.stopPropagation();
    const rect = card.getBoundingClientRect();
    dragging = true;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    origX = rect.left;
    origY = rect.top;
    card.style.left = origX + 'px';
    card.style.top = origY + 'px';
    card.style.bottom = 'auto';
    card.style.transform = 'none';
    card.classList.add('is-dragging');
    if (_statusDismissTimeout) clearTimeout(_statusDismissTimeout);
    if (card.setPointerCapture) {
      try { card.setPointerCapture(e.pointerId); } catch {}
    }
  });

  card.addEventListener('pointermove', (e) => {
    if (!dragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    e.stopPropagation();
    const clamped = clampStatusCardPos(card, origX + (e.clientX - startX), origY + (e.clientY - startY));
    card.style.left = clamped.x + 'px';
    card.style.top = clamped.y + 'px';
  });

  const endDrag = (e) => {
    if (!dragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    dragging = false;
    activePointerId = null;
    card.classList.remove('is-dragging');
    const rect = card.getBoundingClientRect();
    const clamped = clampStatusCardPos(card, rect.left, rect.top);
    card.style.left = clamped.x + 'px';
    card.style.top = clamped.y + 'px';
    try { localStorage.setItem(STATUS_CARD_POS_KEY, JSON.stringify(clamped)); } catch {}
    scheduleStatusCardDismiss(card);
  };

  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);
}

function syncItemLiveLabel(item, ctx) {
  if (!item) return;
  const ud = (item.mesh && item.mesh.userData) || {};
  if (ud.petriCtrl) updatePetriVisual(item);
  if (item.spawnCtrl) {
    if (item.spawnCtrl.updateVisual) item.spawnCtrl.updateVisual();
    else updateSpawnVisual(item);
  }
  if (item.cultureCtrl && ud.liquidCtrl) updateCultureLiquidLabel(item);
  if (item.pdaMediumCtrl && ud.liquidCtrl) updatePdaMediumVisual(item);
  if (item.bowlCtrl) updateMixingBowlLabel(item);
  if (item.scalpelCtrl) updateScalpelLabel(item);
  if (item.monotubCtrl) updateMonotubVisual(item);
  if (item.dehydratorCtrl) updateDehydratorVisual(item);
  if (item.mushroomBagCtrl) updateMushroomBagVisual(item);
  if (item.silicaJarCtrl && item.silicaJarCtrl.updateVisual) item.silicaJarCtrl.updateVisual();
  if (ctx && ctx.heldItem === item && ctx.callbacks && ctx.callbacks.onHoldChange) {
    ctx.callbacks.onHoldChange(item.label);
  }
}

function getItemUseTip(item) {
  const ud = item.mesh?.userData;
  const petri = ud?.petriCtrl;
  const spawn = item.spawnCtrl;
  if (petri && !petri.contaminated && !petri.expired) {
    if (!petri.lidOpen) return t('actions.radial.tip_petri_closed');
    if (petri.mode === 'empty' && petri.sterilized) return t('actions.radial.tip_petri_empty_sterile');
    if (petri.mode === 'bare') return t('actions.radial.tip_petri_bare');
    return t('actions.radial.tip_petri_close_after');
  }
  if (spawn?.isPP5 && !spawn.contaminated && !spawn.expired && !spawn.burned) {
    if (!spawn.filled) return t('actions.radial.tip_pp5_empty');
    return t('actions.radial.tip_pp5_ready');
  }
  if (ud?.isSyringe) return t((ud.syrCtrl?.mix?.lcMl || 0) > 0.05
    ? 'actions.radial.tip_syringe_loaded'
    : 'actions.radial.tip_syringe_empty');
  if (item.bladePackCtrl) return t(item.bladePackCtrl.empty
    ? 'actions.radial.tip_blade_pack_empty'
    : 'actions.radial.tip_blade_pack_full');
  if (ud?.isTrash) return t('actions.radial.tip_trash');
  if (ud?.isHood) return t('actions.radial.tip_hood');
  if (item.fridgeCtrl) return t('actions.radial.tip_fridge');
  if (item.monotubCtrl) return t(item.monotubCtrl.spent
    ? 'actions.radial.tip_monotub_spent'
    : 'actions.radial.tip_monotub_active');
  if (item.dehydratorCtrl) return t(item.dehydratorCtrl.crisp
    ? 'actions.radial.tip_dehydrator_crisp'
    : 'actions.radial.tip_dehydrator_idle');
  if (item.mushroomBagCtrl) return t(item.mushroomBagCtrl.sealed
    ? 'actions.radial.tip_bag_sealed'
    : (item.mushroomBagCtrl.filled ? 'actions.radial.tip_bag_filled' : 'actions.radial.tip_bag_empty'));
  return '';
}

export function showItemStatusCard(item, ctx) {
  if (!item) return;
  syncItemLiveLabel(item, ctx);
  const card = document.getElementById('item-status-card');
  const titleEl = document.getElementById('item-status-title');
  const iconEl = document.getElementById('item-status-icon');
  const bodyEl = document.getElementById('item-status-body');
  if (!card || !bodyEl) return;

  const rawTitle = item.label || t('actions.common.item');
  const title = getDisplayItemTitle(item, rawTitle) || rawTitle;
  const icon = (item.meta && item.meta.icon) || (item.mesh && item.mesh.userData && item.mesh.userData.isTray ? '📥' : '🔍');
  if (titleEl) titleEl.textContent = title;
  if (iconEl) iconEl.textContent = icon;

  const chips = [];
  const san = getSanitizationStatus(item, ctx);
  if (san.alcoholWet) chips.push({ icon: '🧻', text: t('actions.radial.chip_alcohol_wet'), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  else if (san.isSanitized) chips.push({ icon: '✨', text: t('actions.radial.chip_sanitized', { sec: san.remainingSec }), color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });

  const petri = item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (petri) {
    chips.push({ icon: petri.lidOpen ? '⚠️' : '✅', text: t(petri.lidOpen ? 'actions.radial.chip_lid_open' : 'actions.radial.chip_lid_closed'), color: petri.lidOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    chips.push({ icon: petri.sterilized ? '✅' : '⚠️', text: t(petri.sterilized ? 'actions.radial.chip_sterile' : 'actions.radial.chip_not_sterile'), color: petri.sterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
    if (petri.mode === 'bare') {
      chips.push({ icon: '📦', text: t('actions.radial.chip_no_agar'), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else {
      if (petri.parafilmSealed) chips.push({ icon: '🎞️', text: t('actions.radial.chip_parafilm'), color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
      if (petri.inoculated) {
        chips.push({ icon: '🍄', text: t('actions.radial.chip_colonized_pct', { pct: Math.round(petri.colonization || 0) }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      } else {
        chips.push({ icon: '⚪', text: t('actions.radial.chip_not_colonized'), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
      }
      if (petri.contaminated || petri.mode === 'contam') {
        chips.push({ icon: '🦠', text: t('actions.radial.chip_contaminated'), color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
      } else {
        chips.push({ icon: '💚', text: t('actions.radial.chip_healthy'), color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
      }
      if (petri.expired) {
        chips.push({ icon: '⏰', text: t('actions.radial.chip_expired'), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
      } else if (!petri.contaminated) {
        const remD = getCultureRemainingDays(petri);
        const pTemp = (typeof petri.tempC === 'number' ? petri.tempC : (petri.refrigerated ? 4.0 : 24.5)).toFixed(1).replace('.', ',');
        const envTxt = t(petri.refrigerated ? 'actions.radial.env_refrigerated' : 'actions.radial.env_ambient', { temp: pTemp });
        chips.push({ icon: '⏳', text: t('actions.radial.chip_validity', { days: remD, env: envTxt }), color: petri.refrigerated ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-slate-800/80 text-slate-200 border-slate-600/40' });
      }
    }
  }

  const sp = item.spawnCtrl;
  if (sp) {
    if (sp.isPP5) {
      chips.push({
        icon: sp.lidOpen ? '⚠️' : '✅',
        text: t(sp.lidOpen ? 'actions.radial.chip_lid_open' : 'actions.radial.chip_lid_closed'),
        color: sp.lidOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      });
    }
    if (sp.filled) {
      const subLbl = getSpawnSubstrateDisplayName(sp.substrateKind, sp.isPP5);
      chips.push({ icon: sp.isPP5 || sp.substrateKind === 'flocao' || sp.substrateKind === 'corn' || sp.substrateKind === 'grain' ? '🌽' : '🌾', text: t('actions.radial.chip_substrate', { sub: subLbl }), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
      if (sp.waterMl) chips.push({ icon: '💧', text: sp.waterMl + ' ml H₂O', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
      const heatTreated = sp.pasteurized || sp.sterilized;
      const treatment = t(sp.pasteurized ? 'actions.radial.chip_pasteurized' : (sp.sterilized ? 'actions.radial.chip_sterilized' : 'actions.radial.chip_no_heat_treatment'));
      chips.push({ icon: heatTreated ? '✅' : '⚠️', text: treatment, color: heatTreated ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
      if (sp.inoculated) chips.push({ icon: '🍄', text: t('actions.radial.chip_colonization_pct', { pct: Math.round(sp.colonization || 0) }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      if (sp.contaminated) {
        const scInfo = getContamInfo(sp.contamKind || 'trichoderma');
        chips.push({ icon: scInfo.emoji, text: scInfo.name, color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
      }
    } else {
      chips.push({ icon: '📦', text: t('actions.radial.chip_empty_container'), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
      const emptySterilized = !!(sp.sterilized || item.sterilized);
      chips.push({ icon: emptySterilized ? '✅' : '⚠️', text: t(emptySterilized ? 'actions.radial.chip_sterilized' : 'actions.radial.chip_not_sterilized'), color: emptySterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
    }
  }

  const lc = item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
  if (lc && !(sp && sp.isPP5 && lc.volMl <= 0)) {
    chips.push({ icon: '💧', text: t('actions.radial.chip_liquid', { vol: Math.round(lc.volMl * 10) / 10, max: lc.maxMl }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    if (item.liquidMix) {
      const mParts = [];
      if (item.liquidMix.lcMl > 0.05) mParts.push(item.liquidMix.lcMl.toFixed(1) + 'ml ' + t('actions.radial.mix_lc'));
      if (item.liquidMix.distilledMl > 0.05) mParts.push(item.liquidMix.distilledMl.toFixed(1) + 'ml ' + t('actions.radial.mix_distilled'));
      if (item.liquidMix.waterMl > 0.05) mParts.push(item.liquidMix.waterMl.toFixed(1) + 'ml ' + t('actions.radial.mix_water'));
      if (item.liquidMix.pdaMl > 0.05) mParts.push(item.liquidMix.pdaMl.toFixed(1) + 'ml PDA');
      if (mParts.length) {
        chips.push({ icon: '🧪', text: t('actions.radial.chip_mixture', { parts: mParts.join(' + ') }), color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
      }
    }
  }

  const syr = item.mesh && item.mesh.userData && item.mesh.userData.syrCtrl;
  if (syr) {
    const parts = getSyringeMixParts(syr);
    chips.push({
      icon: syr.sourceContam ? '🦠' : '✅',
      text: t(syr.sourceContam ? 'actions.radial.chip_needle_contam' : 'actions.radial.chip_needle_sterile'),
      color: syr.sourceContam ? 'bg-rose-600/30 text-rose-300 border-rose-500/50' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    });
    if (syr.volMl <= 0.05) {
      chips.push({ icon: '💉', text: t('actions.radial.chip_syringe_empty'), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else {
      chips.push({ icon: '💉', text: t('actions.radial.chip_volume', { vol: syr.volMl.toFixed(1) }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      if (parts.length) {
        chips.push({ icon: '🧪', text: t('actions.radial.chip_mixture', { parts: parts.join(' + ') }), color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
      }
      const hasLc = !!(syr.mix && syr.mix.lcMl > 0.05);
      chips.push({
        icon: syr.sourceContam ? '🦠' : (hasLc ? '🍄' : '💧'),
        text: t(syr.sourceContam ? 'actions.radial.chip_contaminated' : (hasLc ? 'actions.radial.chip_with_mycelium' : 'actions.radial.chip_no_mycelium')),
        color: syr.sourceContam ? 'bg-rose-600/30 text-rose-300 border-rose-500/50' : (hasLc ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-sky-500/20 text-sky-300 border-sky-500/30')
      });
    }
  }

  if (item.bowlCtrl) {
    const bc = item.bowlCtrl;
    const ingList = Object.keys(bc.ingredients || {}).filter((k) => (bc.ingredients[k] || 0) > 0);
    if (!ingList.length) {
      chips.push({ icon: '🥣', text: t('actions.radial.chip_bowl_empty'), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else {
      ingList.forEach((k) => {
        const ingLabel = BOWL_ING_KEYS[k] ? t(BOWL_ING_KEYS[k]) : k;
        chips.push({
          icon: k === 'water' ? '💧' : (k === 'coco' ? '🥥' : (k === 'vermiculite' ? '🧱' : '🌾')),
          text: `${ingLabel}: ${Math.round(bc.ingredients[k])}${k === 'water' ? 'ml' : 'g'}`,
          color: k === 'water' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        });
      });
      chips.push({
        icon: bc.mixed ? '✅' : '🥄',
        text: t(bc.mixed ? 'actions.radial.chip_bowl_mixed' : 'actions.radial.chip_bowl_unmixed'),
        color: bc.mixed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      });
    }
  }

  if (item.wildMushroomCtrl) {
    const wm = item.wildMushroomCtrl;
    chips.push({
      icon: wm.isMagic ? '✨' : '🍄',
      text: t(wm.isMagic ? 'actions.radial.chip_mush_magic' : 'actions.radial.chip_mush_culinary'),
      color: wm.isMagic ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    });
    if (wm.speciesName) chips.push({ icon: '🧬', text: wm.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
    chips.push({ icon: '♨️', text: t('actions.radial.chip_mush_fresh'), color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
  }

  if (item.driedMushroomCtrl) {
    const dm = item.driedMushroomCtrl;
    chips.push({ icon: '⚖️', text: t('actions.radial.chip_dried_weight', { grams: dm.grams || 10 }), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
    chips.push({ icon: '💎', text: t('actions.radial.chip_zero_humidity'), color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    if (dm.speciesName) chips.push({ icon: '🧬', text: dm.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
  }

  if (item.mushroomBagCtrl) {
    const mb = item.mushroomBagCtrl;
    chips.push({ icon: '⚖️', text: t('actions.radial.chip_bag_packed', { grams: mb.filled ? mb.grams : 0 }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    chips.push({
      icon: mb.sealed ? '🔒' : (mb.filled ? '⚠️' : '📦'),
      text: t(mb.sealed ? 'actions.radial.chip_bag_sealed' : (mb.filled ? 'actions.radial.chip_bag_open' : 'actions.radial.chip_bag_empty')),
      color: mb.sealed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    });
    if (mb.filled && mb.speciesName) chips.push({ icon: '🧬', text: mb.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
  }

  if (item.monotubCtrl) {
    const mc = item.monotubCtrl;
    chips.push({ icon: mc.lidOpen ? '⚠️' : '✅', text: t(mc.lidOpen ? 'actions.radial.chip_lid_open' : 'actions.radial.chip_lid_closed'), color: mc.lidOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    chips.push({ icon: mc.boxSanitized ? '✅' : '⚠️', text: t(mc.boxSanitized ? 'actions.radial.chip_box_sanitized' : 'actions.radial.chip_box_need_alcohol'), color: mc.boxSanitized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
    chips.push({ icon: mc.hasSpawn ? '🌽' : '⚪', text: t(mc.hasSpawn ? 'actions.radial.chip_with_spawn' : 'actions.radial.chip_without_spawn'), color: mc.hasSpawn ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    chips.push({ icon: mc.hasBulk ? '🥥' : '⚪', text: t(mc.hasBulk ? 'actions.radial.chip_with_bulk' : 'actions.radial.chip_without_bulk'), color: mc.hasBulk ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    if (mc.hasSpawn || mc.hasBulk) {
      chips.push({ icon: mc.leveled ? '📐' : '🥄', text: t(mc.leveled ? 'actions.radial.chip_cake_leveled' : (mc.mixed ? 'actions.radial.chip_cake_mixed' : 'actions.radial.chip_cake_unmixed')), color: mc.leveled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
      chips.push({ icon: '🍄', text: t('actions.radial.chip_colonization_pct', { pct: Math.round(mc.colonization || 0) }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      chips.push({ icon: '📦', text: `Flush ${mc.flush || 1}/4`, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
    }
    if (mc.contaminated) {
      const mcInfo = getContamInfo(mc.contamKind || 'trichoderma');
      chips.push({ icon: mcInfo.emoji, text: mcInfo.name + (mcInfo.curableWithH2O2 ? ' ' + t('actions.radial.chip_curable_h2o2') : ''), color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    }
    else if (mc.spent) chips.push({ icon: '🍂', text: t('actions.radial.chip_cake_spent'), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  }

  if (item.dehydratorCtrl) {
    const dc = item.dehydratorCtrl;
    chips.push({ icon: dc.on ? '♨️' : '⏸️', text: t(dc.on ? 'actions.radial.chip_dehyd_on' : 'actions.radial.chip_dehyd_off'), color: dc.on ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    chips.push({
      icon: dc.crisp ? '✅' : '🍄',
      text: !dc.hasMushroom
        ? t('actions.radial.chip_dehyd_empty')
        : (dc.crisp
          ? t('actions.radial.chip_dehyd_crisp', { grams: dc.grams })
          : t(dc.on ? 'actions.radial.chip_dehyd_drying' : 'actions.radial.chip_dehyd_paused', { pct: Math.round(dc.progress || 0) })),
      color: dc.crisp ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    });
  }

  if (item.mesh && item.mesh.userData && item.mesh.userData.isTray) {
    const cnt = Array.isArray(item.trayContents) ? item.trayContents.length : 0;
    chips.push({ icon: '📥', text: t('actions.radial.chip_tray_count', { count: cnt }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
  }

  const cc = item.cultureCtrl || (item.mesh && item.mesh.userData && item.mesh.userData.cultureCtrl);
  if (cc) {
    const ccSterilized = !cc.contaminated && !!(cc.sterilized || lc?.sterilized || item.sterilized);
    chips.push({ icon: ccSterilized ? '✅' : '⚠️', text: t(ccSterilized ? 'actions.radial.chip_sterile' : 'actions.radial.chip_not_sterilized'), color: ccSterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
    if (lc && lc.volMl <= 0) {
      chips.push({ icon: '📦', text: t('actions.radial.chip_jar_empty'), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else if (cc.colonized) {
      chips.push({ icon: '🍄', text: t('actions.radial.chip_colonized_100'), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    } else if (cc.inoculated) {
      chips.push({ icon: '🍄', text: t('actions.radial.chip_colonizing_pct', { pct: Math.round(cc.colonization || 0) }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    } else {
      chips.push({ icon: '⚪', text: t('actions.radial.chip_not_colonized'), color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    }
    if (cc.contaminated) {
      const ccInfo = getContamInfo(cc.contamKind || 'trichoderma');
      chips.push({ icon: ccInfo.emoji, text: ccInfo.name, color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    } else if (cc.inoculated) {
      chips.push({ icon: '💚', text: t('actions.radial.chip_no_contam_signs'), color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    }
    if (cc.expired) {
      chips.push({ icon: '⏰', text: t('actions.radial.chip_expired'), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
    } else if (cc.inoculated && !cc.contaminated) {
      const remD = getCultureRemainingDays(cc);
      const cTemp = (typeof cc.tempC === 'number' ? cc.tempC : (cc.refrigerated ? 4.0 : 24.5)).toFixed(1).replace('.', ',');
      const cEnvTxt = t(cc.refrigerated ? 'actions.radial.env_refrigerated' : 'actions.radial.env_ambient', { temp: cTemp });
      chips.push({ icon: '⏳', text: t('actions.radial.chip_validity', { days: remD, env: cEnvTxt }), color: cc.refrigerated ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-slate-800/80 text-slate-200 border-slate-600/40' });
    }
  }

  const sj = item.silicaJarCtrl;
  if (sj) {
    const cap = sj.maxGrams || sj.capacityGrams || 150;
    chips.push({ icon: '🫙', text: t('actions.radial.chip_silica_stored', { stored: sj.storedGrams || 0, cap }), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    if (sj.storedGrams > 0 && sj.speciesName) {
      chips.push({ icon: '🧬', text: sj.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
    }
    chips.push({ icon: '💎', text: t('actions.radial.chip_silica_gel'), color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
  }

  if (item.caseCtrl) {
    const cc = item.caseCtrl;
    const used = cc.slots ? cc.slots.filter(Boolean).length : 0;
    const contam = cc.slots ? cc.slots.filter((s) => s && s.contaminated).length : 0;
    chips.push({ icon: '💼', text: t('actions.radial.chip_case_slots', { used, max: cc.maxSlots || 50 }), color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' });
    chips.push({ icon: cc.lidOpen ? '📂' : '🔒', text: t(cc.lidOpen ? 'actions.radial.chip_lid_open' : 'actions.radial.chip_lid_closed'), color: 'bg-slate-700/60 text-slate-200 border-slate-600/40' });
    if (contam > 0) {
      chips.push({ icon: '🦠', text: t('actions.radial.chip_case_contam', { count: contam }), color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    }
  }

  if (item.vial3mlCtrl) {
    chips.push({ icon: '🧪', text: t('actions.radial.chip_vial_5ml', { group: item.vial3mlCtrl.group || 'Cubensis' }), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  }

  const med = item.pdaMediumCtrl;
  const canAutoclave = !!(item.meta && item.meta.compatibilities && item.meta.compatibilities.canEnterCooker);
  const isDistilledContainer = !!(item.meta && item.meta.compatibilities && item.meta.compatibilities.isDistilledWater);
  if (med && !(sp && sp.isPP5 && (sp.filled && sp.substrateKind !== 'pda'))) {
    if ((med.powderGrams || 0) > 0) {
      chips.push({ icon: '🧪', text: t('actions.radial.chip_pda_powder', { grams: Math.round(med.powderGrams * 10) / 10 }), color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' });
    }
    if (med.mixed) chips.push({ icon: '🌀', text: t('actions.radial.chip_mixed'), color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
    if (med.burned) {
      chips.push({ icon: '🔥', text: t('actions.radial.chip_burned'), color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    } else if (!cc && !(sp && sp.isPP5)) {
      const isMedSter = !!(med.sterilized || (lc && lc.sterilized) || item.sterilized);
      chips.push({
        icon: isMedSter ? '✅' : '⚠️',
        text: t(isMedSter ? 'actions.radial.chip_sterile' : 'actions.radial.chip_not_sterilized'),
        color: isMedSter ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      });
    }
  } else if (lc && !cc && !sp && !isDistilledContainer) {
    const onlyDistilled = !!(lc.volMl > 0 && item.liquidMix && item.liquidMix.distilledMl > 0.05 && (item.liquidMix.waterMl || 0) <= 0.05);
    const isLiqSter = !!(lc.sterilized || item.sterilized || onlyDistilled);
    chips.push({
      icon: isLiqSter ? '✅' : '⚠️',
      text: t(isLiqSter ? (onlyDistilled && !lc.sterilized && !item.sterilized ? 'actions.radial.chip_sterile_distilled' : 'actions.radial.chip_sterile') : 'actions.radial.chip_not_sterilized'),
      color: isLiqSter ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    });
  } else if (canAutoclave && !petri && !sp && !cc && !isDistilledContainer && !(item.mesh && item.mesh.userData && item.mesh.userData.isCookerBase)) {
    const isItemSter = !!item.sterilized;
    chips.push({
      icon: isItemSter ? '✅' : '⚠️',
      text: t(isItemSter ? 'actions.radial.chip_sterile' : 'actions.radial.chip_not_sterilized'),
      color: isItemSter ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    });
  }

  if (item.scalpelCtrl) {
    const sc = item.scalpelCtrl;
    chips.push({
      icon: !sc.hasBlade ? '⚪' : (sc.sterile ? '✅' : '🦠'),
      text: t(!sc.hasBlade ? 'actions.radial.chip_no_blade' : (sc.sterile ? 'actions.radial.chip_blade_sterile' : 'actions.radial.chip_blade_contam')),
      color: !sc.hasBlade ? 'bg-slate-700/60 text-slate-300 border-slate-600/40' : (sc.sterile ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-600/30 text-rose-300 border-rose-500/50')
    });
    if (sc.hasMycelium) {
      chips.push({ icon: '🍄', text: t('actions.radial.chip_with_fragment'), color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    }
  }

  if (item.bladePackCtrl) {
    chips.push({
      icon: item.bladePackCtrl.empty ? '🗑️' : '✅',
      text: t(item.bladePackCtrl.empty ? 'actions.radial.chip_blade_pack_empty' : 'actions.radial.chip_blade_pack_sealed'),
      color: item.bladePackCtrl.empty ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    });
  }

  if (item.pdaReagentCtrl) {
    chips.push({
      icon: '🧪',
      text: t('actions.radial.chip_pda_reagent', { grams: Math.round(item.pdaReagentCtrl.remainingGrams || 0) }),
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    });
  }

  if (getItemKindId(item).startsWith('gloves_box') && ctx) {
    const gRem = ctx.glovesUntil ? Math.max(0, Math.ceil((ctx.glovesUntil - performance.now()) / 1000)) : 0;
    const gActive = !!(ctx.wearingGloves && !ctx.glovesExpired && gRem > 0);
    chips.push({
      icon: gActive ? '🧤' : (ctx.wearingGloves ? '⚠️' : '🖐️'),
      text: gActive ? t('actions.radial.chip_gloves_active', { sec: gRem }) : t(ctx.wearingGloves ? 'actions.radial.chip_gloves_expired' : 'actions.radial.chip_gloves_none'),
      color: gActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    });
  }

  if (item.customTag) {
    chips.push({ icon: '🏷️', text: t('actions.radial.chip_tag', { tag: item.customTag }), color: 'bg-teal-500/20 text-teal-200 border-teal-500/40' });
  }

  const itemSpecies =
    (petri && petri.speciesName) ||
    (cc && cc.speciesName) ||
    (sp && sp.speciesName) ||
    (syr && syr.speciesName) ||
    (item.monotubCtrl && item.monotubCtrl.speciesName) ||
    (item.spentCakeCtrl && item.spentCakeCtrl.speciesName) ||
    (item.dehydratorCtrl && item.dehydratorCtrl.speciesName) ||
    (item.mushroomBagCtrl && item.mushroomBagCtrl.speciesName) ||
    (item.falconCtrl && item.falconCtrl.speciesName) ||
    (item.vial3mlCtrl && item.vial3mlCtrl.speciesName) ||
    (item.scalpelCtrl && item.scalpelCtrl.biopsySpecies) ||
    '';
  if (itemSpecies && !chips.some((c) => c.icon === '🧬')) {
    chips.unshift({ icon: '🧬', text: t('actions.radial.chip_species', { species: itemSpecies }), color: 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/45' });
  } else if (item.growTentCtrl && Array.isArray(item.growTentCtrl.slots)) {
    const growSpecies = [...new Set(item.growTentCtrl.slots.map((sl) => sl && sl.speciesName).filter(Boolean))];
    if (growSpecies.length) {
      chips.unshift({ icon: '🧬', text: t('actions.radial.chip_species', { species: growSpecies.join(', ') }), color: 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/45' });
    }
  }

  const purposeHtml = item.meta?.purpose
    ? `<p class="w-full text-slate-200 text-[11px] leading-snug"><b>${escapeHtml(t('actions.radial.label_purpose'))}</b> ${escapeHtml(item.meta.purpose)}</p>`
    : '';

  const tip = getItemUseTip(item);
  const tipHtml = tip ? `<p class="w-full text-cyan-200 text-[11px] leading-snug"><b>${escapeHtml(t('actions.radial.label_next_step'))}</b> ${escapeHtml(tip)}</p>` : '';
  const diag = diagnoseItemPedagogy(item);
  const diagHtml = diag
    ? `<div class="mt-2 w-full p-2 rounded-lg border text-[11px] leading-snug ${diag.level === 'danger' ? 'bg-rose-950/50 border-rose-500/40 text-rose-200' : (diag.level === 'warn' ? 'bg-amber-950/50 border-amber-500/40 text-amber-200' : 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200')}"><b>📘 ${diag.status}:</b> ${diag.cause} <i>${escapeHtml(t('actions.radial.label_real_tip'))}</i> ${diag.realWorldTip}</div>`
    : '';
  bodyEl.innerHTML = chips.map(c => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${c.color}">${c.icon} ${escapeHtml(c.text)}</span>`).join('') + purposeHtml + tipHtml + diagHtml;

  if (ctx && (isContaminatedOrBurned(item) || canDisposeItemInTrash(item))) {
    const canTrash = canDisposeItemInTrash(item);
    if (canTrash && isContaminatedOrBurned(item)) {
      const quickBtn = document.createElement('button');
      quickBtn.type = 'button';
      quickBtn.className = 'mt-1.5 w-full py-1.5 px-3 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[11px] border border-rose-400/50 transition';
      quickBtn.textContent = getTrashActionLabel(item);
      quickBtn.onclick = () => {
        handleTrashDisposal(ctx, item);
        card.classList.add('hidden');
      };
      bodyEl.appendChild(quickBtn);
    }
  }

  ensureStatusCardDraggable(card);
  card.classList.remove('hidden');
  applySavedStatusCardPos(card);
  scheduleStatusCardDismiss(card);
}

function promptCustomItemTag(ctx, item) {
  if (!item) return;
  if (typeof document !== 'undefined' && document.pointerLockElement && typeof document.exitPointerLock === 'function') {
    document.exitPointerLock();
  }
  const current = item.customTag || '';
  const next = typeof window !== 'undefined' && typeof window.prompt === 'function'
    ? window.prompt(t('actions.radial.tag_prompt'), current)
    : null;
  if (next === null) return;
  const cleaned = String(next).trim().slice(0, 28);
  item.customTag = cleaned;
  const base = String(item.label || '').replace(/\s*\[🏷️[^\]]+\]$/, '');
  item.label = cleaned ? `${base} [🏷️ ${cleaned}]` : base;
  if (item.mesh && item.mesh.userData) item.mesh.userData.pickableLabel = item.label;
  if (ctx && ctx.heldItem === item && ctx.callbacks && ctx.callbacks.onHoldChange) {
    ctx.callbacks.onHoldChange(item.label);
  }
  if (ctx && ctx.markItemMoved) ctx.markItemMoved(item);
  if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(cleaned ? t('actions.radial.tag_saved', { tag: cleaned }) : t('actions.radial.tag_removed'));
  }
}

export function inspectBeehiveCard(ctx, hive) {
  const info = getBeehiveInspectInfo(hive);
  if (!info) return;
  const card = document.getElementById('item-status-card');
  const titleEl = document.getElementById('item-status-title');
  const iconEl = document.getElementById('item-status-icon');
  const bodyEl = document.getElementById('item-status-body');
  if (!card || !bodyEl) return;

  if (iconEl) iconEl.textContent = info.status === 'abandoned' ? '🪹' : '🐝';
  if (titleEl) titleEl.textContent = t(info.status === 'abandoned' ? 'actions.hive.title_abandoned' : 'actions.hive.title');

  const statusMeta = {
    healthy: { icon: '💚', key: 'actions.hive.status_healthy', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
    surviving: { icon: '💛', key: 'actions.hive.status_surviving', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
    starving: { icon: '⚠️', key: 'actions.hive.status_starving', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40' },
    migrating: { icon: '👑', key: 'actions.hive.status_migrating', cls: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/40' },
    building: { icon: '🛠️', key: 'actions.hive.status_building', cls: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' },
    abandoned: { icon: '🍂', key: 'actions.hive.status_abandoned', cls: 'bg-slate-700/70 text-slate-300 border-slate-500/40' }
  }[info.status];

  const chips = [
    { icon: statusMeta.icon, text: t(statusMeta.key, { pct: info.buildPct }), color: statusMeta.cls },
    { icon: '🍯', text: t('actions.hive.honey', { pct: info.honeyPct }), color: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
    { icon: '🌸', text: t('actions.hive.flowers', { active: info.activeFlowers, total: info.totalFlowers }), color: info.activeFlowers >= 3 ? 'bg-pink-500/20 text-pink-200 border-pink-400/40' : 'bg-slate-800/80 text-slate-300 border-slate-600/40' }
  ];

  const tipKey = info.status === 'abandoned'
    ? 'actions.hive.tip_abandoned'
    : (info.honeyPct >= 35 ? 'actions.hive.tip_harvest' : 'actions.hive.tip_wait');
  const tipHtml = `<p class="w-full text-cyan-200 text-[11px] leading-snug pt-1">💡 ${escapeHtml(t(tipKey))}</p>`;

  bodyEl.innerHTML = chips.map(c => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${c.color}">${c.icon} ${escapeHtml(c.text)}</span>`).join('') + tipHtml;

  ensureStatusCardDraggable(card);
  card.classList.remove('hidden');
  applySavedStatusCardPos(card);
  scheduleStatusCardDismiss(card);
}

export function inspectFlowerCard(ctx, fl) {
  const info = getFlowerInspectInfo(fl);
  if (!info) return;
  const card = document.getElementById('item-status-card');
  const titleEl = document.getElementById('item-status-title');
  const iconEl = document.getElementById('item-status-icon');
  const bodyEl = document.getElementById('item-status-body');
  if (!card || !bodyEl) return;

  const iconMap = {
    sprouting: '🌱',
    blooming: '🌸',
    seeding: '🌾',
    wilting: '🥀'
  };
  if (iconEl) iconEl.textContent = iconMap[info.stage] || '🌸';
  if (titleEl) titleEl.textContent = t('actions.flower.title', { color: info.colorName });

  const statusMeta = {
    sprouting: { icon: '🌱', key: 'actions.flower.status_sprouting', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
    blooming: { icon: '🌸', key: 'actions.flower.status_blooming', cls: 'bg-pink-500/20 text-pink-200 border-pink-400/40' },
    seeding: { icon: '🌾', key: 'actions.flower.status_seeding', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
    wilting: { icon: '🥀', key: 'actions.flower.status_wilting', cls: 'bg-slate-700/70 text-slate-300 border-slate-500/40' }
  }[info.stage] || { icon: '🌸', key: 'actions.flower.status_blooming', cls: 'bg-pink-500/20 text-pink-200 border-pink-400/40' };

  const chips = [
    { icon: statusMeta.icon, text: t(statusMeta.key, { pct: info.growthPct }), color: statusMeta.cls },
    {
      icon: '🌼',
      text: t('actions.flower.pollen', { pct: info.pollenPct }),
      color: info.pollenPct > 0 ? 'bg-yellow-500/20 text-yellow-200 border-yellow-400/40' : 'bg-slate-800/80 text-slate-300 border-slate-600/40'
    }
  ];
  if (info.stage === 'seeding' && !info.seedHarvested) {
    chips.push({
      icon: '⏳',
      text: t('actions.flower.seed_timer', { sec: info.seedTimeLeftSec }),
      color: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
    });
  }

  const tipKey = info.stage === 'seeding'
    ? 'actions.flower.tip_seeding'
    : (info.stage === 'sprouting' ? 'actions.flower.tip_sprouting' : 'actions.flower.tip_blooming');
  const tipHtml = `<p class="w-full text-cyan-200 text-[11px] leading-snug pt-1">💡 ${escapeHtml(t(tipKey))}</p>`;

  bodyEl.innerHTML = chips.map(c => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${c.color}">${c.icon} ${escapeHtml(c.text)}</span>`).join('') + tipHtml;

  ensureStatusCardDraggable(card);
  card.classList.remove('hidden');
  applySavedStatusCardPos(card);
  scheduleStatusCardDismiss(card);
}

export function inspectItemToast(ctx, item) {
  if (!item) return;
  showItemStatusCard(item, ctx);
  if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
    const parts = ['🔍 ' + item.label];
    const san = getSanitizationStatus(item, ctx);
    if (san.alcoholWet) parts.push(t('actions.radial.toast_alcohol_wet'));
    else if (san.isSanitized) parts.push(t('actions.radial.toast_sanitized', { sec: san.remainingSec }));
    ctx.callbacks.onToast(parts.join(' • '));
  }
}

function buildHeldItemActions(ctx) {
  const actions = [];
  const held = ctx.heldItem;
  if (!ctx.placementMode && getDrainableVolume(ctx, held) > 0) {
    actions.push({
      id: 'held_discard_liquid_' + held.id,
      icon: '💧',
      label: t(ctx.hoveredSinkAction === 'drain' ? 'liquid.drain_sink' : 'liquid.drain_ground'),
      run: () => discardHeldLiquid(ctx, ctx.hoveredSinkAction === 'drain' ? ctx.hoveredSink : null)
    });
  }
  if (held.wildMushroomCtrl) {
    actions.push({
      id: 'held_eat_mush_' + held.id,
      icon: '🍄',
      label: t('actions.radial.eat_mushroom'),
      run: () => eatHeldMushroom(ctx)
    });
  } else if (held.mesh && held.mesh.userData && held.mesh.userData.isPetri) {
    actions.push({
      id: 'held_petri_lid_' + held.id + '_' + (held.mesh.userData.petriCtrl?.lidOpen ? '1' : '0'),
      icon: '🧫',
      label: t(held.mesh.userData.petriCtrl?.lidOpen ? 'actions.radial.close_lid' : 'actions.radial.open_lid'),
      run: () => togglePetriLid(ctx, held)
    });
  } else if (held.spawnCtrl && held.spawnCtrl.isPP5) {
    actions.push({
      id: 'held_pp5_lid_' + held.id + '_' + (held.spawnCtrl.lidOpen ? '1' : '0'),
      icon: '🥣',
      label: t(held.spawnCtrl.lidOpen ? 'actions.radial.close_lid' : 'actions.radial.open_lid'),
      run: () => togglePP5Lid(ctx, held)
    });
  } else if (held.monotubCtrl) {
    actions.push({
      id: 'held_monotub_' + held.id + '_' + getMonotubActionLabel(held.monotubCtrl),
      icon: '📦',
      label: getMonotubActionLabel(held.monotubCtrl) === 'Colher leva'
        ? t('actions.radial.monotub_place_to_harvest')
        : getMonotubActionLabel(held.monotubCtrl),
      run: () => interactMonotub(ctx, held)
    });
  } else if (held.mesh && held.mesh.userData && held.mesh.userData.isThermometer) {
    actions.push({
      id: 'held_thermo_laser_' + (ctx.thermoLaserOn ? '1' : '0'),
      icon: ctx.thermoLaserOn ? '⭕' : '🔴',
      label: t(ctx.thermoLaserOn ? 'actions.radial.laser_off' : 'actions.radial.laser_on'),
      run: () => toggleHeldThermometer(ctx)
    });
  } else if (getItemKindId(held).startsWith('gloves_box')) {
    const gRem = ctx.glovesUntil ? Math.max(0, Math.ceil((ctx.glovesUntil - performance.now()) / 1000)) : 0;
    const wearActive = !!(ctx.wearingGloves && !ctx.glovesExpired && gRem > 0);
    actions.push({
      id: 'held_gloves_' + (wearActive ? '1' : '0'),
      icon: '🧤',
      label: wearActive ? t('actions.radial.gloves_remove', { sec: gRem }) : t('actions.radial.gloves_put_on'),
      run: () => toggleHeldGloves(ctx)
    });
  } else if (held.mesh?.userData.isAlcoholSpray && ctx.wearingGloves) {
    actions.push({
      id: 'held_sanitize_gloves_' + held.id,
      icon: '🧴',
      label: t('actions.radial.sanitize_gloves'),
      run: () => fireAlcoholSpray(ctx, null, { sanitizeGloves: true })
    });
  } else if (held.dehydratorCtrl && !held.dehydratorCtrl.hasMushroom) {
    actions.push({
      id: 'held_dehyd_' + held.id + '_' + (held.dehydratorCtrl.on ? '1' : '0'),
      icon: held.dehydratorCtrl.on ? '⏸️' : '♨️',
      label: t(held.dehydratorCtrl.on ? 'actions.radial.turn_off' : 'actions.radial.turn_on_55c'),
      run: () => interactDehydrator(ctx, held)
    });
  } else if (held.caseCtrl) {
    const used = held.caseCtrl.slots ? held.caseCtrl.slots.filter(Boolean).length : 0;
    actions.push({
      id: 'held_case_lid_' + held.id + '_' + (held.caseCtrl.lidOpen ? '1' : '0'),
      icon: '💼',
      label: t(held.caseCtrl.lidOpen ? 'actions.radial.close_lid' : 'actions.radial.open_lid'),
      run: () => toggleAmpouleCaseLid(ctx, held)
    });
    actions.push({
      id: 'held_case_modal_' + held.id + '_' + used,
      icon: '🧪',
      label: t('actions.radial.view_ampoules', { used }),
      run: () => openAmpouleCaseModal(ctx, held)
    });
  }
  if (held.spawnCtrl && held.spawnCtrl.inoculated && !held.spawnCtrl.contaminated &&
      held.spawnCtrl.colonization >= 20 && held.spawnCtrl.colonization < 95 && !held.spawnCtrl.shaken) {
    actions.push({
      id: 'held_shake_' + held.id,
      icon: '💥',
      label: 'Break & Shake',
      run: () => breakAndShakeSpawn(ctx, held)
    });
  }
  if (!ctx.placementMode) {
    const plate = ctx.hoveredSporePrintPetri || ctx.hoveredPourTarget ||
      (ctx.hoveredSyringeTarget?.mode === 'open' ? ctx.hoveredSyringeTarget.item : null) ||
      (ctx.hoveredScalpelTarget?.mode === 'open' ? ctx.hoveredScalpelTarget.item : null);
    if (plate?.mesh.userData.petriCtrl?.lidOpen === false) {
      actions.push({
        id: 'open_aimed_petri_' + plate.id,
        icon: '🧫',
        primary: true,
        label: t('actions.radial.open_aimed_petri'),
        run: () => { if (!plate.mesh.userData.petriCtrl.lidOpen) togglePetriLid(ctx, plate); }
      });
    } else if (plate?.spawnCtrl?.isPP5 && !plate.spawnCtrl.lidOpen) {
      actions.push({
        id: 'open_aimed_pp5_' + plate.id,
        icon: '🥣',
        primary: true,
        label: t('actions.radial.open_aimed_pp5'),
        run: () => { if (!plate.spawnCtrl.lidOpen) togglePP5Lid(ctx, plate); }
      });
    }
    const tub = ctx.hoveredMonotubTarget;
    if (tub && tub.monotubCtrl.colonization < 100 && !tub.monotubCtrl.lidOpen && getMonotubActionLabel(tub.monotubCtrl) === 'Abrir tampa') {
      actions.push({
        id: 'open_aimed_monotub_' + tub.id,
        icon: '📦',
        primary: true,
        label: t('actions.radial.open_aimed_monotub'),
        run: () => { if (ctx.hoveredMonotubTarget === tub && !tub.monotubCtrl.lidOpen) interactMonotub(ctx, tub); }
      });
    }
    const fridge = ctx.hoveredFridgeTarget?.fridge || (ctx.hoveredPickable?.fridgeCtrl && ctx.hoveredPickable);
    if (fridge) {
      actions.push({
        id: 'aimed_fridge_door_' + fridge.id + '_' + fridge.fridgeCtrl.doorOpen,
        icon: '🧊',
        label: t(fridge.fridgeCtrl.doorOpen ? 'actions.radial.close_fridge' : 'actions.radial.open_fridge'),
        primary: !fridge.fridgeCtrl.doorOpen || ctx.hoveredPickable === fridge,
        run: () => {
          toggleCultureFridgeDoor(fridge);
          ctx.queueWorldStateChange(fridge.id, fridge.fridgeCtrl.doorOpen ? 1 : 0);
          window.MycoAudio?.playDoor(fridge.fridgeCtrl.doorOpen);
        }
      });
    } else if (ctx.hoveredDoorObj) {
      const door = ctx.hoveredDoorObj;
      actions.push({
        id: 'aimed_door_' + door.id + '_' + door.open,
        icon: '🚪',
        label: t(door.open ? 'actions.radial.close_door' : 'actions.radial.open_door'),
        primary: true,
        run: () => { if (ctx.hoveredDoorObj === door) handleWorldInteraction(ctx); }
      });
    }
  }
  if (actions.length > 3) actions.length = 3;
  for (const action of actions) {
    const run = action.run;
    action.run = () => { if (ctx.heldItem === held) run(); };
  }
  return actions;
}

function buildContextActions(ctx) {
  if (!ctx.adminEditMode && ctx.hoveredPickable?.growCtrl) {
    const item = ctx.hoveredPickable;
    const label = ctx.heldItem ? growHeldFeedback(ctx.heldItem, item.growCtrl) : t('grow.panel');
    const doorAction = {
      id: item.id + '_door_' + item.growCtrl.doorClosed, label: growDoorActionLabel(item.growCtrl),
      icon: '🚪', run: () => toggleGrowDoor(ctx, item)
    };
    if (ctx.heldItem && label === t('grow.open_to_access')) return [{ ...doorAction, primary: true }];
    if (label) {
      const actions = [{ id: 'portable_grow', icon: '🌱', label, primary: true, run: () => handlePrimaryAction(ctx) }, doorAction];
      if (!ctx.heldItem) {
        actions.push({ id: 'portable_grow_carry', icon: '🎒', key: 'G', label: t('grow.carry'), run: () => pickHoveredItemForMove(ctx, item, false) });
        const harvest = growSlotActionLabel(item.growCtrl, ctx.hoveredGrowSlot);
        if (harvest) {
          actions[0].primary = false;
          actions[0].run = () => openPortableGrowPanel(ctx, item);
          actions.unshift({ id: item.id + '_slot_' + ctx.hoveredGrowSlot, icon: '🍄', label: harvest,
            primary: true, run: () => handlePrimaryAction(ctx) });
        }
      }
      return actions;
    }
  }

  if (ctx.heldItem && canReceiveSpawnForFruiting(ctx.hoveredG2GTarget)) {
    return [{ id: 'grow_mix_bag', icon: '🌾', label: t('grow.mix_bag'), primary: true, run: () => handlePrimaryAction(ctx) }];
  }
  if (ctx.heldItem && ctx.heldItem.flowerSeedCtrl && ctx.hoveredFlower) {
    const fl = ctx.hoveredFlower;
    const flActions = [];
    if (fl.stage === 'seeding' && !fl.seedHarvested) {
      flActions.push({
        id: 'harvest_flower_seed_' + (fl.id || '0'),
        icon: '🌾',
        label: t('actions.flower.harvest_seed'),
        primary: true,
        run: () => interactFlower(ctx, fl)
      });
    }
    flActions.push({
      id: 'inspect_flower_' + (fl.id || '0') + '_' + fl.stage + '_' + Math.round((fl.pollen || 0) * 100),
      icon: '🔍',
      label: t('actions.radial.inspect'),
      run: () => inspectFlowerCard(ctx, fl)
    });
    return flActions;
  }
  if (ctx.heldItem) return buildHeldItemActions(ctx);
  const actions = [];

  // 1. Panela de Pressao
  const hoveredPot = ctx.hoveredPotInsert ||
    (ctx.hoveredPickable && ctx.cookerPots.find((cp) => cp.potItem === ctx.hoveredPickable || cp.lidItem === ctx.hoveredPickable));

  if (hoveredPot) {
    actions.push({
      id: 'pot_mode_' + hoveredPot.potItem.id + '_' + hoveredPot.mode,
      icon: hoveredPot.mode === 'pasteurize' ? '♨️' : '🌡️',
      label: t(hoveredPot.mode === 'pasteurize' ? 'actions.radial.pot_sterilize' : 'actions.radial.pot_pasteurize'),
      run: () => {
        hoveredPot.mode = hoveredPot.mode === 'pasteurize' ? 'sterilize' : 'pasteurize';
        hoveredPot.lastHudKey = '';
        const k = hoveredPot.potItem.id === 'pressure_cooker_sub' ? 'cooker_mode_sub' : 'cooker_mode_lab';
        if (ctx.queueWorldStateChange) ctx.queueWorldStateChange(k, hoveredPot.mode === 'pasteurize' ? 1 : 0);
        if (window.MycoAudio) window.MycoAudio.playSwitch();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t(hoveredPot.mode === 'pasteurize'
            ? 'actions.radial.pot_mode_pasteurize'
            : 'actions.radial.pot_mode_sterilize'));
        }
      }
    });
    const potItems = (hoveredPot.contents || []).filter((it) => it && (!it.mesh || !it.mesh.userData || !it.mesh.userData.isCookerBase));
    actions.push({
      id: 'pot_contents_' + hoveredPot.potItem.id + '_' + potItems.length,
      icon: '📦',
      label: t('actions.radial.pot_contents', { count: potItems.length }),
      run: () => {
        const baseTxt = t(hoveredPot.hasBase ? 'actions.radial.pot_base_ok' : 'actions.radial.pot_base_missing');
        const listTxt = potItems.length
          ? potItems.map((it) => it.label || it.id).slice(0, 4).join(' • ') + (potItems.length > 4 ? ` (+${potItems.length - 4})` : '')
          : t('actions.radial.pot_no_items');
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('actions.radial.pot_contents_toast', { base: baseTxt, temp: Math.round(hoveredPot.temp || 25), list: listTxt }));
        }
      }
    });
    if (hoveredPot.waterMl > 3600) {
      actions.push({
        id: 'pot_drain',
        icon: '🚰',
        label: t('actions.radial.pot_adjust_water'),
        run: () => {
          hoveredPot.waterMl = 3400;
          updateCookerWaterVisual(hoveredPot);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.radial.pot_drained_toast'));
        }
      });
    } else {
      actions.push({
        id: 'pot_water_' + Math.round(hoveredPot.waterMl),
        icon: '💧',
        label: t('actions.radial.pot_water_label', { liters: (hoveredPot.waterMl / 1000).toFixed(1) }),
        run: () => {
          const baseTxt = t(hoveredPot.hasBase ? 'actions.radial.pot_base_ok' : 'actions.radial.pot_base_missing');
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast(t('actions.radial.pot_water_toast', { liters: (hoveredPot.waterMl / 1000).toFixed(1), base: baseTxt }));
          }
        }
      });
    }
    return actions;
  }

  // 2. Fogareiro, Timer, Balanca, Agitador, Fluxo, Luz, Estufa, Horta, Vaquinha & Armario
  if (ctx.hoveredBurnerTimer) {
    actions.push({
      id: 'burner_timer_' + (ctx.hoveredBurnerTimer.timerPresetMin || 0),
      icon: '⏱️',
      label: t('actions.radial.toggle_timer'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredBurnerSwitch) {
    const curL = ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0);
    const nxtL = (curL + 1) % 4;
    actions.push({
      id: 'burner_step_' + (ctx.hoveredBurnerSwitch.id || '0') + '_' + curL,
      icon: '🔥',
      label: BURNER_LEVEL_NAMES ? BURNER_LEVEL_NAMES[nxtL] : t(curL ? 'actions.radial.next_flame' : 'actions.radial.light_fire'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    if (ctx.hoveredBurnerSwitch.on) {
      actions.push({
        id: 'burner_off_' + (ctx.hoveredBurnerSwitch.id || '0'),
        icon: '🛑',
        label: t('actions.radial.turn_off_flame'),
        run: () => {
          setBurnerLevel(ctx.hoveredBurnerSwitch, 0);
          if (window.MycoAudio) window.MycoAudio.playSwitch();
          if (!queuePurchasedBurnerState(ctx, ctx.hoveredBurnerSwitch)) {
            const bId = ctx.hoveredBurnerSwitch.id || 'burner_lab';
            ctx.queueWorldStateChange(bId, 0);
            ctx.queueWorldStateChange(bId === 'burner_lab' ? 'burner_level_lab' : `${bId}_level`, 0);
          }
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.radial.burner_off_toast'));
        }
      });
    }
    return actions;
  }

  if (ctx.hoveredScaleTare) {
    actions.push({
      id: 'scale_tare',
      icon: '⚖️',
      label: t('actions.radial.scale_tare'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredStirSwitch) {
    actions.push({
      id: 'stir_toggle_' + (ctx.hoveredStirSwitch.on ? '1' : '0'),
      icon: '🌀',
      label: t(ctx.hoveredStirSwitch.on ? 'actions.radial.stirrer_off' : 'actions.radial.stirrer_on'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredHoodSwitch) {
    actions.push({
      id: 'hood_toggle_' + (ctx.hoveredHoodSwitch.on ? '1' : '0'),
      icon: '💨',
      label: t(ctx.hoveredHoodSwitch.on ? 'actions.radial.hood_off' : 'actions.radial.hood_on'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredSwitch) {
    actions.push({
      id: 'light_toggle_' + (ctx.hoveredSwitch.on ? '1' : '0'),
      icon: '💡',
      label: t(ctx.hoveredSwitch.on ? 'actions.radial.light_off' : 'actions.radial.light_on'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredBeehive) {
    actions.push({
      id: 'inspect_hive_' + (ctx.hoveredBeehive.id || '0'),
      icon: '🔍',
      key: 'I',
      label: t('actions.radial.inspect'),
      run: () => inspectBeehiveCard(ctx, ctx.hoveredBeehive)
    });
    return actions;
  }

  if (ctx.hoveredFlower) {
    const fl = ctx.hoveredFlower;
    if (fl.stage === 'seeding' && !fl.seedHarvested) {
      actions.push({
        id: 'harvest_flower_seed_' + (fl.id || '0'),
        icon: '🌾',
        label: t('actions.flower.harvest_seed'),
        primary: true,
        run: () => interactFlower(ctx, fl)
      });
    }
    actions.push({
      id: 'inspect_flower_' + (fl.id || '0') + '_' + fl.stage + '_' + Math.round((fl.pollen || 0) * 100),
      icon: '🔍',
      label: t('actions.radial.inspect'),
      run: () => inspectFlowerCard(ctx, fl)
    });
    return actions;
  }

  if (ctx.hoveredCabinetPart) {
    const cp = ctx.hoveredCabinetPart;
    actions.push({
      id: 'cab_toggle_' + cp.id,
      icon: '🗄️',
      label: t(cp.open ? 'actions.radial.cabinet_close' : 'actions.radial.cabinet_open', { label: cp.label || t('actions.hover.cabinet_default') }),
      primary: true,
      run: () => toggleCabinetPart(ctx, cp)
    });
    return actions;
  }

  if (!ctx.heldItem && ctx.hoveredGreenhouseDevice) {
    actions.push({
      id: 'gh_dev_' + ctx.hoveredGreenhouseDevice,
      icon: '🎛️',
      label: t('actions.radial.gh_controls'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (!ctx.heldItem && ctx.hoveredGreenhouseSlot) {
    const gs = ctx.hoveredGreenhouseSlot;
    actions.push({
      id: 'gh_slot_' + gs.id + '_' + gs.stage,
      icon: gs.stage === 3 ? '🍄' : '🌱',
      label: t(gs.stage === 3 ? 'actions.radial.gh_harvest_flush' : (gs.contaminated || gs.spent ? 'actions.radial.gh_remove_cake' : 'actions.radial.gh_open')),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (!ctx.heldItem && ctx.hoveredGardenTarget) {
    const gt = ctx.hoveredGardenTarget;
    const prune = canPruneGardenPlant(gt.plant);
    actions.push({
      id: 'garden_' + gt.type,
      icon: gt.type === 'harvest_basket' ? '🧺' : '🌿',
      label: prune ? t('garden.prune') : t(gt.type === 'harvest_basket' ? 'actions.radial.garden_take_basket' : (gt.plant?.stage === 2 ? 'actions.radial.garden_harvest_plant' : 'actions.radial.garden_view')),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (!ctx.heldItem && ctx.hoveredCow) {
    actions.push({
      id: 'cow_pet_' + ctx.hoveredCow.name,
      icon: '💖',
      label: t('actions.radial.cow_pet'),
      primary: true,
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  // 3. Item sob a mira
  if (ctx.hoveredPickable && !ctx.heldItem) {
    const target = ctx.hoveredPickable;
    if (target.fridgeCtrl) {
      actions.push({
        id: 'fridge_door_' + target.id,
        icon: '🚪',
        label: t(target.fridgeCtrl.doorOpen ? 'actions.radial.close_door' : 'actions.radial.open_door'),
        primary: true,
        run: () => {
          toggleCultureFridgeDoor(target);
          ctx.queueWorldStateChange(target.id, target.fridgeCtrl.doorOpen ? 1 : 0);
          if (window.MycoAudio) window.MycoAudio.playDoor(target.fridgeCtrl.doorOpen);
        }
      });
      actions.push({
        id: 'fridge_info_' + target.id,
        icon: '📋',
        label: t('actions.radial.fridge_slots'),
        run: () => {
          const count = target.fridgeCtrl.slots ? target.fridgeCtrl.slots.filter(Boolean).length : 0;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.radial.fridge_slots_toast', { count }));
        }
      });
      actions.push({
        id: 'fridge_move_' + target.id,
        icon: '🙌',
        key: 'G',
        label: t('actions.radial.move_fridge'),
        run: () => {
          if (isCultureFridgeOccupied(ctx, target)) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast(t('actions.radial.fridge_empty_first'));
            return;
          }
          ctx.heldItem = target;
          cancelHeldItemPlacement(ctx);
          ctx.lastPickupAt = performance.now();
          ctx.heldRotY = target.mesh.rotation.y;
          setHeldTwoHandedGhost(target, true);
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(target.label);
          ctx.notifyWorldAction();
        }
      });
      actions.push({
        id: 'inspect_' + target.id,
        icon: '🔍',
        key: 'I',
        label: t('actions.radial.inspect'),
        run: () => inspectItemToast(ctx, target)
      });
      return actions;
    }
    if (getItemKindId(target).startsWith('gloves_box')) {
      const gRem = ctx.glovesUntil ? Math.max(0, Math.ceil((ctx.glovesUntil - performance.now()) / 1000)) : 0;
      const wearActive = !!(ctx.wearingGloves && !ctx.glovesExpired && gRem > 0);
      actions.push({
        id: 'gloves_toggle_' + target.id + '_' + (wearActive ? '1' : '0'),
        icon: '🧤',
        label: wearActive ? t('actions.radial.gloves_remove', { sec: gRem }) : t(ctx.wearingGloves ? 'actions.radial.gloves_swap' : 'actions.radial.gloves_put_on'),
        run: () => toggleHeldGloves(ctx)
      });
    }
    if (target.dehydratorCtrl) {
      const dc = target.dehydratorCtrl;
      actions.push({
        id: 'dehyd_act_' + target.id + '_' + (dc.crisp ? 'c' : (dc.on ? '1' : '0')),
        icon: dc.crisp ? '🍄' : (dc.on ? '⏸️' : '♨️'),
        label: getDehydratorActionLabel(target),
        primary: true,
        run: () => interactDehydrator(ctx, target)
      });
    }
    if (target.microscopeCtrl) {
      actions.push({
        id: 'microscope_use_' + target.id,
        icon: '🔬',
        label: t('actions.radial.microscope_analyze'),
        primary: true,
        run: () => interactLabMicroscope(ctx, target)
      });
    }
    if (target.monotubCtrl) {
      const mc = target.monotubCtrl;
      const tubAct = getMonotubActionLabel(mc);
      const tubIcon = tubAct === 'Colher leva' ? '🍄' : '📦';
      actions.push({
        id: 'monotub_act_' + target.id + '_' + tubAct,
        icon: tubIcon,
        label: tubAct,
        primary: true,
        run: () => interactMonotub(ctx, target)
      });
    }
    if (target.mesh && target.mesh.userData && target.mesh.userData.isPetri) {
      actions.push({
        id: 'petri_lid_' + target.id + '_' + (target.mesh.userData.petriCtrl?.lidOpen ? '1' : '0'),
        icon: '🧫',
        label: t(target.mesh.userData.petriCtrl?.lidOpen ? 'actions.radial.close_lid' : 'actions.radial.open_lid'),
        run: () => togglePetriLid(ctx, target)
      });
    }
    if (target.spawnCtrl && target.spawnCtrl.isPP5) {
      actions.push({
        id: 'pp5_lid_' + target.id + '_' + (target.spawnCtrl.lidOpen ? '1' : '0'),
        icon: '🥣',
        label: t(target.spawnCtrl.lidOpen ? 'actions.radial.close_lid' : 'actions.radial.open_lid'),
        run: () => togglePP5Lid(ctx, target)
      });
    }
    if (target.spawnCtrl && target.spawnCtrl.inoculated && !target.spawnCtrl.contaminated &&
        target.spawnCtrl.colonization >= 20 && target.spawnCtrl.colonization < 95 && !target.spawnCtrl.shaken) {
      actions.push({
        id: 'target_shake_' + target.id,
        icon: '💥',
        label: 'Break & Shake',
        run: () => breakAndShakeSpawn(ctx, target)
      });
    }
    if (target.silicaJarCtrl && target.silicaJarCtrl.storedGrams > 0) {
      actions.push({
        id: 'silica_take_10g_' + target.id + '_' + target.silicaJarCtrl.storedGrams,
        icon: '🍄',
        label: t('actions.radial.silica_take', { grams: Math.min(10, target.silicaJarCtrl.storedGrams) }),
        primary: true,
        run: () => interactSilicaStorageJar(ctx, target)
      });
    }
    if (target.caseCtrl) {
      const used = target.caseCtrl.slots ? target.caseCtrl.slots.filter(Boolean).length : 0;
      actions.push({
        id: 'case_lid_' + target.id + '_' + (target.caseCtrl.lidOpen ? '1' : '0'),
        icon: '💼',
        label: t(target.caseCtrl.lidOpen ? 'actions.radial.close_lid' : 'actions.radial.open_lid'),
        primary: !target.caseCtrl.lidOpen,
        run: () => toggleAmpouleCaseLid(ctx, target)
      });
      actions.push({
        id: 'case_modal_' + target.id + '_' + used,
        icon: '🧪',
        label: t('actions.radial.view_ampoules', { used }),
        primary: target.caseCtrl.lidOpen,
        run: () => openAmpouleCaseModal(ctx, target)
      });
    }
    if (actions.length > 2) actions.length = 2;
    if (target.spawnCtrl || target.cultureCtrl || target.monotubCtrl || target.caseCtrl || (target.mesh && target.mesh.userData && target.mesh.userData.isPetri)) {
      actions.push({
        id: 'tag_' + target.id + '_' + (target.customTag || ''),
        icon: '🏷️',
        key: 'Z',
        label: t(target.customTag ? 'actions.radial.edit_tag' : 'actions.radial.tag'),
        run: () => promptCustomItemTag(ctx, target)
      });
    }
    actions.push({
      id: 'move_' + target.id,
      icon: '📦',
      key: 'G',
      label: t('actions.radial.move'),
      run: () => {
        if (ctx.pickHoveredItemForMove) ctx.pickHoveredItemForMove(target, false);
      }
    });
    actions.push({
      id: 'inspect_' + target.id,
      icon: '🔍',
      key: 'I',
      label: t('actions.radial.inspect'),
      run: () => inspectItemToast(ctx, target)
    });
    return actions.slice(0, 5);
  }

  return actions;
}

const CONTEXT_ACTION_KEYS = ['F', 'V', 'Z'];

function getSemanticActionKey(act) {
  if (!act) return '';
  if (act.key) return String(act.key).toUpperCase();
  const id = act.id || '';
  if (id.startsWith('move_') || id.startsWith('fridge_move_') || id === 'portable_grow_carry') return 'G';
  if (id.startsWith('inspect_') || id.startsWith('held_inspect_')) return 'I';
  if (id.startsWith('tag_')) return 'Z';
  return '';
}

export function assignActionShortcuts(actions) {
  if (!Array.isArray(actions)) return [];
  const usedKeys = new Set();
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (!act) continue;
    const fixed = getSemanticActionKey(act);
    if (fixed) {
      act.key = fixed;
      act.code = 'Key' + fixed;
      usedKeys.add(fixed);
    }
  }
  let ctxCursor = 0;
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (!act || act.key) continue;
    while (ctxCursor < CONTEXT_ACTION_KEYS.length && usedKeys.has(CONTEXT_ACTION_KEYS[ctxCursor])) {
      ctxCursor++;
    }
    const assigned = CONTEXT_ACTION_KEYS[ctxCursor] || '';
    if (assigned) {
      act.key = assigned;
      act.code = 'Key' + assigned;
      usedKeys.add(assigned);
      ctxCursor++;
    }
  }
  return actions;
}

export function getFloatingActionsPreview(ctx) {
  if (!ctx) return [];
  const touch = !!ctx.isTouchDevice?.();
  const held = ctx.heldItem;
  const placing = !!(ctx.placementMode && held);
  const actions = placing ? [] : buildContextActions(ctx);
  if (touch || held) addAimPrimaryAction(ctx, actions, touch);
  if (placing) {
    actions.push(
      { id: 'rotate_held', key: 'R', label: t('hud.rotate_held'), run: () => window.rotateCampusHeldItem?.() },
      { id: 'cancel_placement', key: 'G', label: t('hud.cancel_placement'), run: () => cancelHeldItemPlacement(ctx) }
    );
  } else if (held) {
    actions.push(
      {
        id: 'position_held_' + held.id, key: 'G', label: t('hud.position_held'),
        run: () => { if (ctx.heldItem === held) toggleHeldItemPlacement(ctx); }
      },
      {
        id: 'held_inspect_' + held.id, icon: '🔍', key: 'I', label: t('actions.radial.inspect'),
        run: () => { if (ctx.heldItem === held) inspectItemToast(ctx, held); }
      }
    );
  } else if (ctx.hoveredPickable && !ctx.hoveredPickable.isReadOnly) {
    const target = ctx.hoveredPickable;
    const pick = actions.findIndex(action => action.key === 'G');
    if (pick >= 0) {
      const pickup = actions[pick];
      actions.splice(pick + 1, 0, {
        id: 'reposition_' + target.id, key: 'Q', label: t('hud.move_aimed'),
        run: () => {
          if (ctx.heldItem || ctx.hoveredPickable !== target) return;
          pickup.run();
          if (ctx.heldItem === target && !ctx.placementMode) toggleHeldItemPlacement(ctx);
        }
      });
    }
  }
  return assignActionShortcuts(actions);
}

function addAimPrimaryAction(ctx, actions, touch) {
  const existing = actions.findIndex(action => action.primary);
  if (existing >= 0) {
    if (existing > 0) actions.unshift(actions.splice(existing, 1)[0]);
    return;
  }
  const isPlacing = !!(ctx.placementMode && ctx.heldItem);
  const prompt = isPlacing
    ? (ctx.placementValid ? t('hud.confirm_place') : '')
    : ctx.aimActionPrompt || (ctx.heldItem?.mesh?.userData.isAlcoholSpray ? t('hud.spray_held') : '');
  if (!prompt) {
    if (ctx.heldItem && actions[0] && !actions[0].key) actions[0].primary = true;
    return;
  }
  const target = ctx.hoveredPickable;
  const wildMushroom = ctx.hoveredMushroom;
  let label = prompt;
  if (ctx.heldItem?.mesh?.userData.isAlcoholSpray && ctx.hoveredSprayTarget?.target) label = t('hud.spray_held');
  if (!ctx.heldItem && wildMushroom) {
    const species = wildMushroom.capMesh?.userData.speciesName;
    if (species) label = t('hud.harvest_aimed', { item: species });
  } else if (!ctx.heldItem && target?.label === prompt) {
    label = t('hud.pick_aimed', { item: getDisplayItemTitle(target, prompt) });
    const pick = actions.findIndex(action => action.id === 'move_' + target.id);
    if (pick >= 0) {
      const action = actions.splice(pick, 1)[0];
      actions.unshift({ ...action, label, primary: true });
      return;
    }
  }
  const syringe = ctx.hoveredSyringeTarget;
  const liquidPump = syringe?.mode === 'draw' ||
    (syringe?.mode === 'inject' && syringe.item?.mesh?.userData.liquidCtrl && !syringe.item.spawnCtrl);
  const hold = touch && !isPlacing && !!ctx.heldItem && !!(
    liquidPump || getHiveSyringeDose(ctx.hoveredBeehive, ctx.heldItem) > 0 || ctx.hoveredFillPot || ctx.hoveredPourTarget ||
    ctx.hoveredSinkAction === 'fill' || ctx.hoveredBowlTarget ||
    ctx.hoveredScalpelTarget?.mode === 'attach_blade_to_scalpel' || ctx.hoveredBoardHit
  );
  actions.unshift({
    id: 'aim_primary_' + (target?.id || wildMushroom?.id || ctx.hoveredDoorObj?.id || ''),
    label,
    primary: true,
    hold,
    run: () => handlePrimaryAction(ctx)
  });
}

function releaseMobileHold() {
  if (!mobileHold) return;
  const { ctx } = mobileHold;
  mobileHold = null;
  ctx.isPrimaryDown = false;
  ctx.flushCurrentStroke?.();
}

function bindMobileHold(button, ctx, getAction) {
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || mobileHold) return;
    const action = getAction();
    if (!action) return;
    mobileHold = { ctx, id: event.pointerId, x: event.clientX, y: event.clientY };
    button.setPointerCapture(event.pointerId);
    ctx.isPrimaryDown = true;
    action.run();
  });
  button.addEventListener('pointermove', event => {
    if (mobileHold?.id !== event.pointerId) return;
    window.rotateCampusCamera?.(event.clientX - mobileHold.x, event.clientY - mobileHold.y);
    mobileHold.x = event.clientX;
    mobileHold.y = event.clientY;
  });
  const release = event => {
    if (mobileHold?.id === event.pointerId) releaseMobileHold();
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

export function syncFloatingActions(ctx) {
  const touch = !!ctx?.isTouchDevice?.();
  if (mobileHold && (!touch || !ctx.inFps || ctx.lobbyTourActive || ctx.inventory?.pending || !ctx.isPrimaryDown)) releaseMobileHold();
  if (mobileHold) return;
  if (!ctx || !ctx.inFps || ctx.lobbyTourActive || ctx.inventory?.pending) {
    if (barEl) barEl.classList.add('hidden');
    currentActions = [];
    lastSignature = '';
    return;
  }

  if (ctx.placementMode && !ctx.heldItem) cancelHeldItemPlacement(ctx);
  const actions = getFloatingActionsPreview(ctx);
  if (!actions.length) {
    if (barEl && !barEl.classList.contains('hidden')) {
      barEl.classList.add('hidden');
    }
    currentActions = [];
    lastSignature = '';
    return;
  }

  const sig = (touch ? 'touch:' : '') + actions.map(action =>
    `${action.id}:${action.key || ''}:${action.label}:${Number(!!action.primary)}:${Number(!!action.hold)}`).join('|');
  currentActions = actions;
  if (sig === lastSignature && barEl && !barEl.classList.contains('hidden')) return;
  lastSignature = sig;

  ensureFloatingStyles();
  if (!barEl) {
    barEl = document.createElement('div');
    barEl.id = 'myco-floating-actions';
    document.getElementById('bottom-hud-controls').prepend(barEl);
  }
  barEl.classList.remove('hidden');
  barEl.classList.toggle('mobile-context-actions', touch);
  barEl.replaceChildren();

  const hasPrimary = touch && !!actions[0].primary;
  const secondary = touch && actions.length > Number(hasPrimary) ? document.createElement('div') : null;
  if (secondary) {
    secondary.id = 'myco-item-actions-list';
    secondary.setAttribute('role', 'group');
    secondary.setAttribute('aria-label', t('hud.item_actions'));
  }
  actions.forEach(function (act, idx) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'myco-float-chip';
    if (act.primary) chip.classList.add('myco-context-primary');
    if (!touch && act.key) {
      const key = document.createElement('span');
      key.className = 'myco-float-key';
      key.textContent = act.key;
      chip.appendChild(key);
    }
    const label = document.createElement('span');
    label.textContent = act.hold ? t('hud.hold_action', { action: act.label }) : (act.icon ? `${act.icon} ${act.label}` : act.label);
    chip.appendChild(label);
    const getAction = () => {
      const live = currentActions[idx];
      return live?.id === act.id && (!touch || live.label === act.label) ? live : null;
    };
    if (act.hold) {
      chip.classList.add('myco-context-hold');
      bindMobileHold(chip, ctx, getAction);
    }
    chip.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!act.hold) getAction()?.run();
    });
    if (hasPrimary && idx === 0) {
      barEl.appendChild(chip);
    } else {
      (secondary || barEl).appendChild(chip);
    }
  });
  if (secondary) barEl.appendChild(secondary);
}

export function triggerFloatingAction(index) {
  if (index >= 0 && index < currentActions.length && currentActions[index]) {
    currentActions[index].run();
    return true;
  }
  return false;
}

export function triggerFloatingActionByCode(code) {
  if (!code) return false;
  for (let i = 0; i < currentActions.length; i++) {
    const act = currentActions[i];
    if (act && act.code === code) {
      act.run();
      return true;
    }
  }
  return false;
}

export function openRadialMenu(ctx) {
  syncFloatingActions(ctx);
  if (!ctx?.isTouchDevice?.()) ctx?.callbacks?.onToast?.(t('actions.radial.open_menu_hint'));
}
