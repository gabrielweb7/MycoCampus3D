/**
 * Barra Flutuante Diegetica de Acoes Contextuais (PC & Mobile) - MycoCampus3D
 * Aparece automaticamente dentro do jogo ao apontar para itens/dispositivos ou segurar objetos,
 * sem soltar o Pointer Lock nem exibir cursor do Windows.
 * Acione com as teclas 1, 2, 3, 4 (PC) ou toque direto (Mobile).
 */

import { BURNER_LEVEL_NAMES, setBurnerLevel, updateCookerWaterVisual } from '../items/pressure-cooker.js';
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
import { interactDehydrator, updateDehydratorVisual } from '../items/dehydrator.js';
import { updateMushroomBagVisual } from '../items/dehydration-packaging.js';
import {
  handlePrimaryAction,
  pickHoveredItemForMove,
  dropHeldItem,
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
import { cancelHeldItemPlacement } from '../systems/held-item-placement.js';
import { escapeHtml } from './dom-helpers.js';
import { diagnoseItemPedagogy } from '../core/cultivation-tracks.js';
import { discardHeldLiquid, getDrainableVolume } from '../systems/liquid-disposal.js';
import { canPruneGardenPlant } from '../world/campus-garden.js';
import { growHeldAction } from '../items/portable-grow.js';
import { t } from '../core/i18n.js';

let barEl = null;
let styleInjected = false;
let currentActions = [];
let lastSignature = '';
let touchActionsOpen = false;

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
      min-height: 44px;
      padding: 5px 8px;
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
    if (!petri.lidOpen) return 'Na capela preparada, escolha Abrir Tampa no menu numerado. A placa fica fechada ao clicar para apoiá-la.';
    if (petri.mode === 'empty' && petri.sterilized) return 'Aponte uma seringa com cultura líquida para a placa e aplique 1 ml. Depois feche a tampa pela opção numerada.';
    if (petri.mode === 'bare') return 'Uma placa aberta e sem ágar pode receber meio PDA ou um carimbo de esporos.';
    return 'Ao terminar a manipulação, feche a tampa pela opção numerada.';
  }
  if (spawn?.isPP5 && !spawn.contaminated && !spawn.expired && !spawn.burned) {
    if (!spawn.filled) return 'Coloque o substrato e prepare o potinho antes de inocular.';
    return 'Com o potinho preparado, abra a tampa pela opção numerada. Mire nele com uma seringa de cultura líquida para aplicar 1 ml.';
  }
  if (ud?.isSyringe) return (ud.syrCtrl?.mix?.lcMl || 0) > 0.05
    ? 'Mire numa placa ou potinho aberto para aplicar 1 ml. Para inocular um frasco de caldo preparado, segure a ação e solte no volume desejado.'
    : 'Mire num frasco de cultura colonizada e segure a ação para aspirar. Solte quando tiver o volume desejado.';
  if (item.bladePackCtrl) return item.bladePackCtrl.empty
    ? 'Segure a embalagem vazia, mire na lixeira e use a ação de descarte.'
    : 'Segure a embalagem, mire no bisturi e mantenha a ação para encaixar a lâmina. Descarte a embalagem vazia na lixeira.';
  if (ud?.isTrash) return 'Segure o resíduo e mire aqui. A ação informa se descarta o item inteiro ou só esvazia o conteúdo.';
  if (ud?.isHood) return 'Ligue o fluxo, aplique álcool e seque com papel. Apoie as culturas na bancada interna antes de abri-las.';
  if (item.fridgeCtrl) return 'Abra a porta pela opção numerada enquanto segura uma cultura fechada. Mire numa vaga livre e clique para guardar.';
  if (item.monotubCtrl) return item.monotubCtrl.spent
    ? 'Carregue a caixa com Mover e despeje o bolo no compostor da horta.'
    : 'Use o menu numerado para operar a caixa na mão. Apoie na bancada para preparar ou na estante LED para frutificar.';
  if (item.dehydratorCtrl) return item.dehydratorCtrl.crisp
    ? 'Clique com a mão livre para recolher o lote pronto.'
    : 'Segure um cogumelo fresco e mire na desidratadora para carregar um lote.';
  if (item.mushroomBagCtrl) return item.mushroomBagCtrl.sealed
    ? 'Mire numa caixa de entrega ou no balcão de vendas para entregar o pacote.'
    : item.mushroomBagCtrl.filled ? 'Segure o saco cheio e aponte para a seladora.' : 'Mire neste saco segurando um lote seco para embalá-lo.';
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

  const title = item.label || 'Item';
  const icon = (item.meta && item.meta.icon) || (item.mesh && item.mesh.userData && item.mesh.userData.isTray ? '📥' : '🔍');
  if (titleEl) titleEl.textContent = title;
  if (iconEl) iconEl.textContent = icon;

  const chips = [];
  const san = getSanitizationStatus(item, ctx);
  if (san.alcoholWet) chips.push({ icon: '🧻', text: 'Álcool 70% Aplicado (Aguardando Secagem)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  else if (san.isSanitized) chips.push({ icon: '✨', text: 'Desinfectado (' + san.remainingSec + 's)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });

  const petri = item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (petri) {
    chips.push({ icon: petri.lidOpen ? '⚠️' : '✅', text: petri.lidOpen ? 'Tampa Aberta' : 'Tampa Fechada', color: petri.lidOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    chips.push({ icon: petri.sterilized ? '✅' : '⚠️', text: petri.sterilized ? 'Estéril' : 'Não Estéril', color: petri.sterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
    if (petri.mode === 'bare') {
      chips.push({ icon: '📦', text: 'Sem Ágar (Vazia)', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else {
      if (petri.parafilmSealed) chips.push({ icon: '🎞️', text: 'Vedada (Parafilm M)', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
      if (petri.inoculated) {
        chips.push({ icon: '🍄', text: 'Colonizada (' + Math.round(petri.colonization || 0) + '%)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      } else {
        chips.push({ icon: '⚪', text: 'Não Colonizada', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
      }
      if (petri.contaminated || petri.mode === 'contam') {
        chips.push({ icon: '🦠', text: 'Contaminada', color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
      } else {
        chips.push({ icon: '💚', text: 'Saudável', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
      }
      if (petri.expired) {
        chips.push({ icon: '⏰', text: 'Vencida', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
      } else if (!petri.contaminated) {
        const remD = getCultureRemainingDays(petri);
        const pTemp = (typeof petri.tempC === 'number' ? petri.tempC : (petri.refrigerated ? 4.0 : 24.5)).toFixed(1).replace('.', ',');
        const envTxt = petri.refrigerated ? `❄️ ${pTemp}°C Refrigerada` : `🌡️ ${pTemp}°C Ambiente`;
        chips.push({ icon: '⏳', text: 'Validade: ' + remD + 'd (' + envTxt + ')', color: petri.refrigerated ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-slate-800/80 text-slate-200 border-slate-600/40' });
      }
    }
  }

  const sp = item.spawnCtrl;
  if (sp) {
    if (sp.isPP5) {
      chips.push({
        icon: sp.lidOpen ? '⚠️' : '✅',
        text: sp.lidOpen ? 'Tampa Aberta' : 'Tampa Fechada',
        color: sp.lidOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      });
    }
    if (sp.filled) {
      const subLbl = getSpawnSubstrateDisplayName(sp.substrateKind, sp.isPP5);
      chips.push({ icon: sp.isPP5 || sp.substrateKind === 'flocao' || sp.substrateKind === 'corn' || sp.substrateKind === 'grain' ? '🌽' : '🌾', text: 'Substrato: ' + subLbl, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
      if (sp.waterMl) chips.push({ icon: '💧', text: sp.waterMl + ' ml H₂O', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
      const heatTreated = sp.pasteurized || sp.sterilized;
      const treatment = sp.pasteurized ? 'Pasteurizado' : (sp.sterilized ? 'Esterilizado' : 'Sem tratamento térmico');
      chips.push({ icon: heatTreated ? '✅' : '⚠️', text: treatment, color: heatTreated ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
      if (sp.inoculated) chips.push({ icon: '🍄', text: 'Colonização ' + Math.round(sp.colonization || 0) + '%', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      if (sp.contaminated) {
        const scInfo = getContamInfo(sp.contamKind || 'trichoderma');
        chips.push({ icon: scInfo.emoji, text: scInfo.name, color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
      }
    } else {
      chips.push({ icon: '📦', text: 'Recipiente Vazio', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
      const emptySterilized = !!(sp.sterilized || item.sterilized);
      chips.push({ icon: emptySterilized ? '✅' : '⚠️', text: emptySterilized ? 'Esterilizado' : 'Não Esterilizado', color: emptySterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
    }
  }

  const lc = item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
  if (lc && !(sp && sp.isPP5 && lc.volMl <= 0)) {
    chips.push({ icon: '💧', text: 'Líquido: ' + Math.round(lc.volMl * 10) / 10 + '/' + lc.maxMl + ' ml', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    if (item.liquidMix) {
      const mParts = [];
      if (item.liquidMix.lcMl > 0.05) mParts.push(item.liquidMix.lcMl.toFixed(1) + 'ml CL');
      if (item.liquidMix.distilledMl > 0.05) mParts.push(item.liquidMix.distilledMl.toFixed(1) + 'ml Destilada');
      if (item.liquidMix.waterMl > 0.05) mParts.push(item.liquidMix.waterMl.toFixed(1) + 'ml Água');
      if (item.liquidMix.pdaMl > 0.05) mParts.push(item.liquidMix.pdaMl.toFixed(1) + 'ml PDA');
      if (mParts.length) {
        chips.push({ icon: '🧪', text: 'Mistura: ' + mParts.join(' + '), color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
      }
    }
  }

  const syr = item.mesh && item.mesh.userData && item.mesh.userData.syrCtrl;
  if (syr) {
    const parts = getSyringeMixParts(syr);
    chips.push({
      icon: syr.sourceContam ? '🦠' : '✅',
      text: syr.sourceContam ? 'Agulha Contaminada' : 'Agulha Estéril',
      color: syr.sourceContam ? 'bg-rose-600/30 text-rose-300 border-rose-500/50' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    });
    if (syr.volMl <= 0.05) {
      chips.push({ icon: '💉', text: 'Seringa Vazia (0/10 ml)', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else {
      chips.push({ icon: '💉', text: 'Volume: ' + syr.volMl.toFixed(1) + '/10 ml', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      if (parts.length) {
        chips.push({ icon: '🧪', text: 'Mistura: ' + parts.join(' + '), color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
      }
      const hasLc = !!(syr.mix && syr.mix.lcMl > 0.05);
      chips.push({
        icon: syr.sourceContam ? '🦠' : (hasLc ? '🍄' : '💧'),
        text: syr.sourceContam ? 'Contaminada' : (hasLc ? 'Com micélio vivo' : 'Sem micélio (água/meio)'),
        color: syr.sourceContam ? 'bg-rose-600/30 text-rose-300 border-rose-500/50' : (hasLc ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-sky-500/20 text-sky-300 border-sky-500/30')
      });
    }
  }

  if (item.bowlCtrl) {
    const bc = item.bowlCtrl;
    const ingNames = { vermiculite: 'Vermiculita', coco: 'Pó de Coco', flocao: 'Flocão', corn: 'Milho', wheat: 'Trigo', sorghum: 'Sorgo', sawdust: 'Serragem', water: 'Água' };
    const ingList = Object.keys(bc.ingredients || {}).filter((k) => (bc.ingredients[k] || 0) > 0);
    if (!ingList.length) {
      chips.push({ icon: '🥣', text: 'Pote Vazio', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else {
      ingList.forEach((k) => {
        chips.push({
          icon: k === 'water' ? '💧' : (k === 'coco' ? '🥥' : (k === 'vermiculite' ? '🧱' : '🌾')),
          text: `${ingNames[k] || k}: ${Math.round(bc.ingredients[k])}${k === 'water' ? 'ml' : 'g'}`,
          color: k === 'water' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        });
      });
      chips.push({
        icon: bc.mixed ? '✅' : '🥄',
        text: bc.mixed ? 'Receita Homogênea' : 'Falta misturar c/ Colher',
        color: bc.mixed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      });
    }
  }

  if (item.wildMushroomCtrl) {
    const wm = item.wildMushroomCtrl;
    chips.push({
      icon: wm.isMagic ? '✨' : '🍄',
      text: wm.isMagic ? 'Psicoativo (Trip Mágica)' : 'Culinário / Medicinal',
      color: wm.isMagic ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    });
    if (wm.speciesName) chips.push({ icon: '🧬', text: wm.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
    chips.push({ icon: '♨️', text: 'Fresco (Desidrate ou tire Esporos)', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
  }

  if (item.driedMushroomCtrl) {
    const dm = item.driedMushroomCtrl;
    chips.push({ icon: '⚖️', text: `Peso: ${dm.grams || 10}g Crocantes`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
    chips.push({ icon: '💎', text: '0% Umidade', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    if (dm.speciesName) chips.push({ icon: '🧬', text: dm.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
  }

  if (item.mushroomBagCtrl) {
    const mb = item.mushroomBagCtrl;
    chips.push({ icon: '⚖️', text: `Embalado: ${mb.filled ? mb.grams : 0} g`, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    chips.push({
      icon: mb.sealed ? '🔒' : (mb.filled ? '⚠️' : '📦'),
      text: mb.sealed ? 'Selado a quente' : (mb.filled ? 'Aberto • passe na seladora' : 'Vazio • adicione um lote seco'),
      color: mb.sealed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    });
    if (mb.filled && mb.speciesName) chips.push({ icon: '🧬', text: mb.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
  }

  if (item.monotubCtrl) {
    const mc = item.monotubCtrl;
    chips.push({ icon: mc.lidOpen ? '⚠️' : '✅', text: mc.lidOpen ? 'Tampa Aberta' : 'Tampa Fechada', color: mc.lidOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    chips.push({ icon: mc.boxSanitized ? '✅' : '⚠️', text: mc.boxSanitized ? 'Caixa Desinfectada' : 'Precisa Álcool + Papel', color: mc.boxSanitized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
    chips.push({ icon: mc.hasSpawn ? '🌽' : '⚪', text: mc.hasSpawn ? 'Com Spawn ✅' : 'Sem Spawn', color: mc.hasSpawn ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    chips.push({ icon: mc.hasBulk ? '🥥' : '⚪', text: mc.hasBulk ? 'Com Substrato ✅' : 'Sem Substrato', color: mc.hasBulk ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    if (mc.hasSpawn || mc.hasBulk) {
      chips.push({ icon: mc.leveled ? '📐' : '🥄', text: mc.leveled ? 'Bolo Nivelado' : (mc.mixed ? 'Misturado (Falta Nivelar)' : 'Falta Misturar'), color: mc.leveled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
      chips.push({ icon: '🍄', text: `Colonização ${Math.round(mc.colonization || 0)}%`, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      chips.push({ icon: '📦', text: `Flush ${mc.flush || 1}/4`, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
    }
    if (mc.contaminated) {
      const mcInfo = getContamInfo(mc.contamKind || 'trichoderma');
      chips.push({ icon: mcInfo.emoji, text: mcInfo.name + (mcInfo.curableWithH2O2 ? ' (Curável c/ H₂O₂)' : ''), color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    }
    else if (mc.spent) chips.push({ icon: '🍂', text: 'Bolo Esgotado (Levar à Horta)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  }

  if (item.dehydratorCtrl) {
    const dc = item.dehydratorCtrl;
    chips.push({ icon: dc.on ? '♨️' : '⏸️', text: dc.on ? 'Ligada (55°C)' : 'Desligada', color: dc.on ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    chips.push({
      icon: dc.crisp ? '✅' : '🍄',
      text: !dc.hasMushroom ? 'Bandejas Vazias' : (dc.crisp ? `Lote crocante • ${dc.grams} g` : `${dc.on ? 'Secando' : 'Pausada'} • ${Math.round(dc.progress || 0)}%`),
      color: dc.crisp ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    });
  }

  if (item.mesh && item.mesh.userData && item.mesh.userData.isTray) {
    const cnt = Array.isArray(item.trayContents) ? item.trayContents.length : 0;
    chips.push({ icon: '📥', text: `Itens apoiados: ${cnt}`, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
  }

  const cc = item.cultureCtrl || (item.mesh && item.mesh.userData && item.mesh.userData.cultureCtrl);
  if (cc) {
    const ccSterilized = !cc.contaminated && !!(cc.sterilized || lc?.sterilized || item.sterilized);
    chips.push({ icon: ccSterilized ? '✅' : '⚠️', text: ccSterilized ? 'Estéril' : 'Não Esterilizado', color: ccSterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
    if (lc && lc.volMl <= 0) {
      chips.push({ icon: '📦', text: 'Frasco Vazio', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    } else if (cc.colonized) {
      chips.push({ icon: '🍄', text: 'Colonizada (100%)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    } else if (cc.inoculated) {
      chips.push({ icon: '🍄', text: 'Colonizando (' + Math.round(cc.colonization || 0) + '%)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    } else {
      chips.push({ icon: '⚪', text: 'Não Colonizada', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    }
    if (cc.contaminated) {
      const ccInfo = getContamInfo(cc.contamKind || 'trichoderma');
      chips.push({ icon: ccInfo.emoji, text: ccInfo.name, color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    } else if (cc.inoculated) {
      chips.push({ icon: '💚', text: 'Sem sinais de contaminação', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    }
    if (cc.expired) {
      chips.push({ icon: '⏰', text: 'Vencida', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
    } else if (cc.inoculated && !cc.contaminated) {
      const remD = getCultureRemainingDays(cc);
      const cTemp = (typeof cc.tempC === 'number' ? cc.tempC : (cc.refrigerated ? 4.0 : 24.5)).toFixed(1).replace('.', ',');
      const cEnvTxt = cc.refrigerated ? `❄️ ${cTemp}°C Refrigerada` : `🌡️ ${cTemp}°C Ambiente`;
      chips.push({ icon: '⏳', text: 'Validade: ' + remD + 'd (' + cEnvTxt + ')', color: cc.refrigerated ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-slate-800/80 text-slate-200 border-slate-600/40' });
    }
  }

  const sj = item.silicaJarCtrl;
  if (sj) {
    const cap = sj.maxGrams || sj.capacityGrams || 150;
    chips.push({ icon: '🫙', text: `Armazenado: ${sj.storedGrams || 0}/${cap}g`, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    if (sj.storedGrams > 0 && sj.speciesName) {
      chips.push({ icon: '🧬', text: sj.speciesName, color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' });
    }
    chips.push({ icon: '💎', text: 'Sílica Gel (0% Umidade)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
  }

  if (item.caseCtrl) {
    const cc = item.caseCtrl;
    const used = cc.slots ? cc.slots.filter(Boolean).length : 0;
    const contam = cc.slots ? cc.slots.filter((s) => s && s.contaminated).length : 0;
    chips.push({ icon: '💼', text: `Vagas: ${used}/${cc.maxSlots || 50}`, color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' });
    chips.push({ icon: cc.lidOpen ? '📂' : '🔒', text: cc.lidOpen ? 'Tampa Aberta' : 'Tampa Fechada', color: 'bg-slate-700/60 text-slate-200 border-slate-600/40' });
    if (contam > 0) {
      chips.push({ icon: '🦠', text: `${contam} Contaminadas`, color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    }
  }

  if (item.vial3mlCtrl) {
    chips.push({ icon: '🧪', text: `Ampola 5ML (${item.vial3mlCtrl.group || 'Cubensis'})`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  }

  const med = item.pdaMediumCtrl;
  const canAutoclave = !!(item.meta && item.meta.compatibilities && item.meta.compatibilities.canEnterCooker);
  const isDistilledContainer = !!(item.meta && item.meta.compatibilities && item.meta.compatibilities.isDistilledWater);
  if (med && !(sp && sp.isPP5 && (sp.filled && sp.substrateKind !== 'pda'))) {
    if ((med.powderGrams || 0) > 0) {
      chips.push({ icon: '🧪', text: 'Pó PDA: ' + (Math.round(med.powderGrams * 10) / 10) + 'g', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' });
    }
    if (med.mixed) chips.push({ icon: '🌀', text: 'Misturado', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
    if (med.burned) {
      chips.push({ icon: '🔥', text: 'Queimado', color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    } else if (!cc && !(sp && sp.isPP5)) {
      const isMedSter = !!(med.sterilized || (lc && lc.sterilized) || item.sterilized);
      chips.push({
        icon: isMedSter ? '✅' : '⚠️',
        text: isMedSter ? 'Estéril' : 'Não Esterilizado',
        color: isMedSter ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      });
    }
  } else if (lc && !cc && !sp && !isDistilledContainer) {
    const onlyDistilled = !!(lc.volMl > 0 && item.liquidMix && item.liquidMix.distilledMl > 0.05 && (item.liquidMix.waterMl || 0) <= 0.05);
    const isLiqSter = !!(lc.sterilized || item.sterilized || onlyDistilled);
    chips.push({
      icon: isLiqSter ? '✅' : '⚠️',
      text: isLiqSter ? (onlyDistilled && !lc.sterilized && !item.sterilized ? 'Estéril (Água Destilada)' : 'Estéril') : 'Não Esterilizado',
      color: isLiqSter ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    });
  } else if (canAutoclave && !petri && !sp && !cc && !isDistilledContainer && !(item.mesh && item.mesh.userData && item.mesh.userData.isCookerBase)) {
    const isItemSter = !!item.sterilized;
    chips.push({
      icon: isItemSter ? '✅' : '⚠️',
      text: isItemSter ? 'Estéril' : 'Não Esterilizado',
      color: isItemSter ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    });
  }

  if (item.scalpelCtrl) {
    const sc = item.scalpelCtrl;
    chips.push({
      icon: !sc.hasBlade ? '⚪' : (sc.sterile ? '✅' : '🦠'),
      text: !sc.hasBlade ? 'Sem lâmina' : (sc.sterile ? 'Lâmina #24 Estéril' : 'Lâmina Contaminada'),
      color: !sc.hasBlade ? 'bg-slate-700/60 text-slate-300 border-slate-600/40' : (sc.sterile ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-600/30 text-rose-300 border-rose-500/50')
    });
    if (sc.hasMycelium) {
      chips.push({ icon: '🍄', text: 'Com fragmento de micélio', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    }
  }

  if (item.bladePackCtrl) {
    chips.push({
      icon: item.bladePackCtrl.empty ? '🗑️' : '✅',
      text: item.bladePackCtrl.empty ? 'Embalagem Vazia (Jogar no lixo)' : 'Lâmina #24 Estéril Lacrada',
      color: item.bladePackCtrl.empty ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    });
  }

  if (item.pdaReagentCtrl) {
    chips.push({
      icon: '🧪',
      text: 'Pó BDA/PDA: ' + Math.round(item.pdaReagentCtrl.remainingGrams || 0) + 'g',
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    });
  }

  if (item.id && item.id.indexOf('gloves_box_') === 0 && ctx) {
    const gRem = ctx.glovesUntil ? Math.max(0, Math.ceil((ctx.glovesUntil - performance.now()) / 1000)) : 0;
    const gActive = !!(ctx.wearingGloves && !ctx.glovesExpired && gRem > 0);
    chips.push({
      icon: gActive ? '🧤' : (ctx.wearingGloves ? '⚠️' : '🖐️'),
      text: gActive ? `Luvas Pretas Estéreis (${gRem}s)` : (ctx.wearingGloves ? 'Luvas Expiradas (Trocar)' : 'Sem Luvas'),
      color: gActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    });
  }

  if (item.customTag) {
    chips.push({ icon: '🏷️', text: 'Etiqueta: ' + item.customTag, color: 'bg-teal-500/20 text-teal-200 border-teal-500/40' });
  }

  const itemSpecies = (petri && petri.speciesName) || (cc && cc.speciesName) || (sp && sp.inoculated && sp.speciesName) || (syr && syr.speciesName) || (item.scalpelCtrl && item.scalpelCtrl.biopsySpecies) || '';
  if (itemSpecies) {
    chips.push({ icon: '🧬', text: 'Espécie: ' + itemSpecies, color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' });
  }

  const purposeHtml = item.meta?.purpose
    ? `<p class="w-full text-slate-200 text-[11px] leading-snug"><b>Para que serve:</b> ${escapeHtml(item.meta.purpose)}</p>`
    : '';

  const tip = getItemUseTip(item);
  const tipHtml = tip ? `<p class="w-full text-cyan-200 text-[11px] leading-snug"><b>Próximo passo:</b> ${escapeHtml(tip)}</p>` : '';
  const diag = diagnoseItemPedagogy(item);
  const diagHtml = diag
    ? `<div class="mt-2 w-full p-2 rounded-lg border text-[11px] leading-snug ${diag.level === 'danger' ? 'bg-rose-950/50 border-rose-500/40 text-rose-200' : (diag.level === 'warn' ? 'bg-amber-950/50 border-amber-500/40 text-amber-200' : 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200')}"><b>📘 ${diag.status}:</b> ${diag.cause} <i>Dica real:</i> ${diag.realWorldTip}</div>`
    : '';
  bodyEl.innerHTML = chips.map(c => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${c.color}">${c.icon} ${escapeHtml(c.text)}</span>`).join('') + purposeHtml + tipHtml + diagHtml;

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
    ? window.prompt('🏷️ Digite uma etiqueta curta para este recipiente (máx 28 caracteres):', current)
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
    ctx.callbacks.onToast(cleaned ? `🏷️ Etiqueta salva: "${cleaned}"` : '🏷️ Etiqueta removida.');
  }
}

export function inspectItemToast(ctx, item) {
  if (!item) return;
  showItemStatusCard(item, ctx);
  if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
    const parts = ['🔍 ' + item.label];
    const san = getSanitizationStatus(item, ctx);
    if (san.alcoholWet) parts.push('🧻 Álcool (secar)');
    else if (san.isSanitized) parts.push('✨ Desinfectado (' + san.remainingSec + 's)');
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
      label: 'Comer Cogumelo',
      run: () => eatHeldMushroom(ctx)
    });
  } else if (held.mesh && held.mesh.userData && held.mesh.userData.isPetri) {
    actions.push({
      id: 'held_petri_lid_' + held.id + '_' + (held.mesh.userData.petriCtrl?.lidOpen ? '1' : '0'),
      icon: '🧫',
      label: held.mesh.userData.petriCtrl?.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
      run: () => togglePetriLid(ctx, held)
    });
  } else if (held.spawnCtrl && held.spawnCtrl.isPP5) {
    actions.push({
      id: 'held_pp5_lid_' + held.id + '_' + (held.spawnCtrl.lidOpen ? '1' : '0'),
      icon: '🥣',
      label: held.spawnCtrl.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
      run: () => togglePP5Lid(ctx, held)
    });
  } else if (held.monotubCtrl) {
    actions.push({
      id: 'held_monotub_' + held.id + '_' + getMonotubActionLabel(held.monotubCtrl),
      icon: '📦',
      label: getMonotubActionLabel(held.monotubCtrl) === 'Colher leva'
        ? 'Apoie a caixa para colher'
        : getMonotubActionLabel(held.monotubCtrl),
      run: () => interactMonotub(ctx, held)
    });
  } else if (held.mesh && held.mesh.userData && held.mesh.userData.isThermometer) {
    actions.push({
      id: 'held_thermo_laser_' + (ctx.thermoLaserOn ? '1' : '0'),
      icon: ctx.thermoLaserOn ? '⭕' : '🔴',
      label: ctx.thermoLaserOn ? 'Desligar Laser' : 'Ligar Laser',
      run: () => toggleHeldThermometer(ctx)
    });
  } else if (held.id && held.id.indexOf('gloves_box_') === 0) {
    const gRem = ctx.glovesUntil ? Math.max(0, Math.ceil((ctx.glovesUntil - performance.now()) / 1000)) : 0;
    const wearActive = !!(ctx.wearingGloves && !ctx.glovesExpired && gRem > 0);
    actions.push({
      id: 'held_gloves_' + (wearActive ? '1' : '0'),
      icon: '🧤',
      label: wearActive ? `Retirar Luvas (${gRem}s)` : 'Calçar Luvas (160s)',
      run: () => toggleHeldGloves(ctx)
    });
  } else if (held.mesh?.userData.isAlcoholSpray && ctx.wearingGloves) {
    actions.push({
      id: 'held_sanitize_gloves_' + held.id,
      icon: '🧴',
      label: 'Higienizar luvas',
      run: () => fireAlcoholSpray(ctx, null, { sanitizeGloves: true })
    });
  } else if (held.dehydratorCtrl && !held.dehydratorCtrl.hasMushroom) {
    actions.push({
      id: 'held_dehyd_' + held.id + '_' + (held.dehydratorCtrl.on ? '1' : '0'),
      icon: held.dehydratorCtrl.on ? '⏸️' : '♨️',
      label: held.dehydratorCtrl.on ? 'Desligar' : 'Ligar 55°C',
      run: () => interactDehydrator(ctx, held)
    });
  } else if (held.caseCtrl) {
    const used = held.caseCtrl.slots ? held.caseCtrl.slots.filter(Boolean).length : 0;
    actions.push({
      id: 'held_case_lid_' + held.id + '_' + (held.caseCtrl.lidOpen ? '1' : '0'),
      icon: '💼',
      label: held.caseCtrl.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
      run: () => toggleAmpouleCaseLid(ctx, held)
    });
    actions.push({
      id: 'held_case_modal_' + held.id + '_' + used,
      icon: '🧪',
      label: `Ver Ampolas (${used}/50)`,
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
  actions.push({
    id: 'held_inspect_' + held.id,
    icon: '🔍',
    label: 'Inspecionar',
    run: () => inspectItemToast(ctx, held)
  });
  if (!ctx.placementMode) {
    const plate = ctx.hoveredSporePrintPetri || ctx.hoveredPourTarget ||
      (ctx.hoveredSyringeTarget?.mode === 'open' ? ctx.hoveredSyringeTarget.item : null) ||
      (ctx.hoveredScalpelTarget?.mode === 'open' ? ctx.hoveredScalpelTarget.item : null);
    if (plate?.mesh.userData.petriCtrl?.lidOpen === false) {
      actions.push({
        id: 'open_aimed_petri_' + plate.id,
        icon: '🧫',
        label: 'Abrir placa no alvo',
        run: () => { if (!plate.mesh.userData.petriCtrl.lidOpen) togglePetriLid(ctx, plate); }
      });
    } else if (plate?.spawnCtrl?.isPP5 && !plate.spawnCtrl.lidOpen) {
      actions.push({
        id: 'open_aimed_pp5_' + plate.id,
        icon: '🥣',
        label: 'Abrir potinho no alvo',
        run: () => { if (!plate.spawnCtrl.lidOpen) togglePP5Lid(ctx, plate); }
      });
    }
    const tub = ctx.hoveredMonotubTarget;
    if (tub && tub.monotubCtrl.colonization < 100 && !tub.monotubCtrl.lidOpen && getMonotubActionLabel(tub.monotubCtrl) === 'Abrir tampa') {
      actions.push({
        id: 'open_aimed_monotub_' + tub.id,
        icon: '📦',
        label: 'Abrir Monotub no alvo',
        run: () => { if (ctx.hoveredMonotubTarget === tub && !tub.monotubCtrl.lidOpen) interactMonotub(ctx, tub); }
      });
    }
    const fridge = ctx.hoveredFridgeTarget?.fridge || (ctx.hoveredPickable?.fridgeCtrl && ctx.hoveredPickable);
    if (fridge) {
      actions.push({
        id: 'aimed_fridge_door_' + fridge.id + '_' + fridge.fridgeCtrl.doorOpen,
        icon: '🧊',
        label: fridge.fridgeCtrl.doorOpen ? 'Fechar geladeira' : 'Abrir geladeira',
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
        label: door.open ? 'Fechar porta' : 'Abrir porta',
        run: () => { if (ctx.hoveredDoorObj === door) handleWorldInteraction(ctx); }
      });
    }
  }
  actions.length = Math.min(4, actions.length);
  for (const action of actions) {
    const run = action.run;
    action.run = () => { if (ctx.heldItem === held) run(); };
  }
  return actions;
}

function buildContextActions(ctx) {
  if (!ctx.adminEditMode && ctx.hoveredPickable?.growCtrl) {
    const item = ctx.hoveredPickable;
    const label = ctx.heldItem ? growHeldAction(ctx.heldItem) : t('grow.panel');
    if (label) {
      const actions = [{ id: 'portable_grow', icon: '🌱', label, run: () => handlePrimaryAction(ctx) }];
      if (!ctx.heldItem) {
        actions.push({ id: 'portable_grow_carry', icon: '🎒', label: t('grow.carry'), run: () => pickHoveredItemForMove(ctx, item, false) });
      }
      return actions;
    }
  }

  if (ctx.heldItem && canReceiveSpawnForFruiting(ctx.hoveredG2GTarget)) {
    return [{ id: 'grow_mix_bag', icon: '🌾', label: t('grow.mix_bag'), run: () => handlePrimaryAction(ctx) }];
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
      label: hoveredPot.mode === 'pasteurize' ? 'Esterilizar' : 'Pasteurizar',
      run: () => {
        hoveredPot.mode = hoveredPot.mode === 'pasteurize' ? 'sterilize' : 'pasteurize';
        hoveredPot.lastHudKey = '';
        const k = hoveredPot.potItem.id === 'pressure_cooker_sub' ? 'cooker_mode_sub' : 'cooker_mode_lab';
        if (ctx.queueWorldStateChange) ctx.queueWorldStateChange(k, hoveredPot.mode === 'pasteurize' ? 1 : 0);
        if (window.MycoAudio) window.MycoAudio.playSwitch();
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(hoveredPot.mode === 'pasteurize'
            ? '🌡️ Modo da Panela: PASTEURIZAR (75–85°C)'
            : '♨️ Modo da Panela: ESTERILIZAR (121°C / 15 PSI)');
        }
      }
    });
    const potItems = (hoveredPot.contents || []).filter((it) => it && (!it.mesh || !it.mesh.userData || !it.mesh.userData.isCookerBase));
    actions.push({
      id: 'pot_contents_' + hoveredPot.potItem.id + '_' + potItems.length,
      icon: '📦',
      label: `Conteúdo (${potItems.length})`,
      run: () => {
        const baseTxt = hoveredPot.hasBase ? 'Base 4cm ✅' : 'Sem Base ⚠️';
        const listTxt = potItems.length
          ? potItems.map((it) => it.label || it.id).slice(0, 4).join(' • ') + (potItems.length > 4 ? ` (+${potItems.length - 4})` : '')
          : 'Nenhum recipiente dentro';
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast(`🍲 Panela (${baseTxt} • ${Math.round(hoveredPot.temp || 25)}°C): ${listTxt}`);
        }
      }
    });
    if (hoveredPot.waterMl > 3600) {
      actions.push({
        id: 'pot_drain',
        icon: '🚰',
        label: 'Ajustar 3.4L',
        run: () => {
          hoveredPot.waterMl = 3400;
          updateCookerWaterVisual(hoveredPot);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('💧 Excesso drenado para 3.4L (+0,5cm acima da base)!');
        }
      });
    } else {
      actions.push({
        id: 'pot_water_' + Math.round(hoveredPot.waterMl),
        icon: '💧',
        label: 'Água ' + (hoveredPot.waterMl / 1000).toFixed(1) + 'L',
        run: () => {
          const baseTxt = hoveredPot.hasBase ? 'Base 4cm ✅' : 'Sem Base ⚠️';
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('💧 Panela: ' + (hoveredPot.waterMl / 1000).toFixed(1) + 'L (Ideal: 3.0–4.0L • +0,5cm da base) • ' + baseTxt);
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
      label: 'Alternar Timer',
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
      label: BURNER_LEVEL_NAMES ? BURNER_LEVEL_NAMES[nxtL] : (curL ? 'Próxima Chama' : 'Ligar Fogo'),
      run: () => handlePrimaryAction(ctx)
    });
    if (ctx.hoveredBurnerSwitch.on) {
      actions.push({
        id: 'burner_off_' + (ctx.hoveredBurnerSwitch.id || '0'),
        icon: '🛑',
        label: 'Desligar Chama',
        run: () => {
          setBurnerLevel(ctx.hoveredBurnerSwitch, 0);
          if (window.MycoAudio) window.MycoAudio.playSwitch();
          const bId = ctx.hoveredBurnerSwitch.id || 'burner_lab';
          ctx.queueWorldStateChange(bId, 0);
          ctx.queueWorldStateChange(bId === 'burner_lab' ? 'burner_level_lab' : `${bId}_level`, 0);
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🛑 Queimador desligado.');
        }
      });
    }
    return actions;
  }

  if (ctx.hoveredScaleTare) {
    actions.push({
      id: 'scale_tare',
      icon: '⚖️',
      label: 'Zerar (Tara)',
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredStirSwitch) {
    actions.push({
      id: 'stir_toggle_' + (ctx.hoveredStirSwitch.on ? '1' : '0'),
      icon: '🌀',
      label: ctx.hoveredStirSwitch.on ? 'Desligar Agitador' : 'Ligar Agitador',
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredHoodSwitch) {
    actions.push({
      id: 'hood_toggle_' + (ctx.hoveredHoodSwitch.on ? '1' : '0'),
      icon: '💨',
      label: ctx.hoveredHoodSwitch.on ? 'Desligar Fluxo' : 'Ligar Fluxo',
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredSwitch) {
    actions.push({
      id: 'light_toggle_' + (ctx.hoveredSwitch.on ? '1' : '0'),
      icon: '💡',
      label: ctx.hoveredSwitch.on ? 'Apagar Luz' : 'Acender Luz',
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (ctx.hoveredCabinetPart) {
    const cp = ctx.hoveredCabinetPart;
    actions.push({
      id: 'cab_toggle_' + cp.id,
      icon: '🗄️',
      label: (cp.open ? 'Fechar ' : 'Abrir ') + (cp.label || 'Armário'),
      run: () => toggleCabinetPart(ctx, cp)
    });
    return actions;
  }

  if (!ctx.heldItem && ctx.hoveredGreenhouseDevice) {
    actions.push({
      id: 'gh_dev_' + ctx.hoveredGreenhouseDevice,
      icon: '🎛️',
      label: 'Controles Estufa',
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (!ctx.heldItem && ctx.hoveredGreenhouseSlot) {
    const gs = ctx.hoveredGreenhouseSlot;
    actions.push({
      id: 'gh_slot_' + gs.id + '_' + gs.stage,
      icon: gs.stage === 3 ? '🍄' : '🌱',
      label: gs.stage === 3 ? 'Colher Flush' : (gs.contaminated || gs.spent ? 'Retirar Bolo' : 'Abrir Estufa'),
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
      label: prune ? t('garden.prune') : (gt.type === 'harvest_basket' ? 'Pegar Cesta' : (gt.plant?.stage === 2 ? 'Colher Planta' : 'Ver Horta')),
      run: () => handlePrimaryAction(ctx)
    });
    return actions;
  }

  if (!ctx.heldItem && ctx.hoveredCow) {
    actions.push({
      id: 'cow_pet_' + ctx.hoveredCow.name,
      icon: '💖',
      label: 'Fazer Carinho',
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
        label: target.fridgeCtrl.doorOpen ? 'Fechar Porta' : 'Abrir Porta',
        run: () => {
          toggleCultureFridgeDoor(target);
          ctx.queueWorldStateChange(target.id, target.fridgeCtrl.doorOpen ? 1 : 0);
          if (window.MycoAudio) window.MycoAudio.playDoor(target.fridgeCtrl.doorOpen);
        }
      });
      actions.push({
        id: 'fridge_move_' + target.id,
        icon: '🙌',
        label: 'Mover Geladeira',
        run: () => {
          if (isCultureFridgeOccupied(ctx, target)) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('🚫 Retire tudo de dentro da geladeira antes de movê-la.');
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
        id: 'fridge_info_' + target.id,
        icon: '📋',
        label: 'Ver Vagas',
        run: () => {
          const count = target.fridgeCtrl.slots ? target.fridgeCtrl.slots.filter(Boolean).length : 0;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧊 Geladeira 4°C • ' + count + ' vagas configuradas nas prateleiras.');
        }
      });
      actions.push({
        id: 'inspect_' + target.id,
        icon: '🔍',
        label: 'Inspecionar',
        run: () => inspectItemToast(ctx, target)
      });
      return actions;
    }
    if (target.id && target.id.indexOf('gloves_box_') === 0) {
      const gRem = ctx.glovesUntil ? Math.max(0, Math.ceil((ctx.glovesUntil - performance.now()) / 1000)) : 0;
      const wearActive = !!(ctx.wearingGloves && !ctx.glovesExpired && gRem > 0);
      actions.push({
        id: 'gloves_toggle_' + target.id + '_' + (wearActive ? '1' : '0'),
        icon: '🧤',
        label: wearActive ? `Retirar Luvas (${gRem}s)` : (ctx.wearingGloves ? 'Trocar Luvas (160s)' : 'Calçar Luvas (160s)'),
        run: () => toggleHeldGloves(ctx)
      });
    }
    if (target.dehydratorCtrl) {
      const dc = target.dehydratorCtrl;
      actions.push({
        id: 'dehyd_act_' + target.id + '_' + (dc.crisp ? 'c' : (dc.on ? '1' : '0')),
        icon: dc.crisp ? '🍄' : (dc.on ? '⏸️' : '♨️'),
        label: dc.crisp ? `Retirar ${dc.grams} g` : (dc.on ? 'Desligar' : 'Ligar a 55°C'),
        run: () => interactDehydrator(ctx, target)
      });
    }
    if (target.microscopeCtrl) {
      actions.push({
        id: 'microscope_use_' + target.id,
        icon: '🔬',
        label: 'Analisar Lente',
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
        run: () => interactMonotub(ctx, target)
      });
    }
    if (target.mesh && target.mesh.userData && target.mesh.userData.isPetri) {
      actions.push({
        id: 'petri_lid_' + target.id + '_' + (target.mesh.userData.petriCtrl?.lidOpen ? '1' : '0'),
        icon: '🧫',
        label: target.mesh.userData.petriCtrl?.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
        run: () => togglePetriLid(ctx, target)
      });
    }
    if (target.spawnCtrl && target.spawnCtrl.isPP5) {
      actions.push({
        id: 'pp5_lid_' + target.id + '_' + (target.spawnCtrl.lidOpen ? '1' : '0'),
        icon: '🥣',
        label: target.spawnCtrl.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
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
        label: `Retirar ${Math.min(10, target.silicaJarCtrl.storedGrams)} g`,
        run: () => interactSilicaStorageJar(ctx, target)
      });
    }
    if (target.caseCtrl) {
      const used = target.caseCtrl.slots ? target.caseCtrl.slots.filter(Boolean).length : 0;
      actions.push({
        id: 'case_lid_' + target.id + '_' + (target.caseCtrl.lidOpen ? '1' : '0'),
        icon: '💼',
        label: target.caseCtrl.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
        run: () => toggleAmpouleCaseLid(ctx, target)
      });
      actions.push({
        id: 'case_modal_' + target.id + '_' + used,
        icon: '🧪',
        label: `Ver Ampolas (${used}/50)`,
        run: () => openAmpouleCaseModal(ctx, target)
      });
    }
    if (target.spawnCtrl || target.cultureCtrl || target.monotubCtrl || target.caseCtrl || (target.mesh && target.mesh.userData && target.mesh.userData.isPetri)) {
      actions.push({
        id: 'tag_' + target.id + '_' + (target.customTag || ''),
        icon: '🏷️',
        label: target.customTag ? 'Editar Etiqueta' : 'Etiqueta',
        run: () => promptCustomItemTag(ctx, target)
      });
    }
    actions.push({
      id: 'move_' + target.id,
      icon: '📦',
      label: 'Mover',
      run: () => {
        if (ctx.pickHoveredItemForMove) ctx.pickHoveredItemForMove(target);
      }
    });
    actions.push({
      id: 'inspect_' + target.id,
      icon: '🔍',
      label: 'Inspecionar',
      run: () => inspectItemToast(ctx, target)
    });
    return actions.slice(0, 4);
  }

  return actions;
}

export function syncFloatingActions(ctx) {
  if (!ctx || !ctx.inFps || ctx.lobbyTourActive || ctx.placementMode || ctx.inventory?.pending) {
    if (barEl) barEl.classList.add('hidden');
    currentActions = [];
    touchActionsOpen = false;
    lastSignature = '';
    return;
  }

  const actions = buildContextActions(ctx);
  if (!actions.length) {
    if (barEl && !barEl.classList.contains('hidden')) {
      barEl.classList.add('hidden');
    }
    currentActions = [];
    touchActionsOpen = false;
    lastSignature = '';
    return;
  }

  const touch = !!ctx.isTouchDevice?.();
  const sig = `${touch ? 'touch:' : ''}${actions.map((action) => action.id).join('|')}`;
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
  barEl.replaceChildren();

  if (touch) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'myco-float-chip action-drawer-toggle';
    toggle.textContent = touchActionsOpen ? `× ${t('hud.item_actions')}` : `⋯ ${t('hud.item_actions')}`;
    toggle.setAttribute('aria-expanded', String(touchActionsOpen));
    toggle.setAttribute('aria-controls', 'myco-item-actions-list');
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      touchActionsOpen = !touchActionsOpen;
      lastSignature = '';
      syncFloatingActions(ctx);
    });
    barEl.appendChild(toggle);
    if (!touchActionsOpen) return;
  }

  const container = touch ? document.createElement('div') : barEl;
  if (touch) {
    container.id = 'myco-item-actions-list';
    barEl.appendChild(container);
  }
  const ACTION_KEYS = ['F', 'Z', 'V', '4'];
  actions.forEach(function (act, idx) {
    const keyHint = ACTION_KEYS[idx] || String(idx + 1);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'myco-float-chip';
    chip.innerHTML = `<span class="myco-float-key">${keyHint}</span><span>${act.icon} ${act.label}</span>`;
    chip.addEventListener('click', function (ev) {
      ev.stopPropagation();
      act.run();
      if (touch) closeRadialMenu();
    });
    container.appendChild(chip);
  });
}

export function triggerFloatingAction(index) {
  if (index >= 0 && index < currentActions.length && currentActions[index]) {
    currentActions[index].run();
    return true;
  }
  return false;
}

export function isRadialMenuOpen() { return touchActionsOpen; }
export function closeRadialMenu() {
  if (!touchActionsOpen) return;
  touchActionsOpen = false;
  lastSignature = '';
  document.getElementById('myco-item-actions-list')?.remove();
}
export function openRadialMenu(ctx) {
  if (ctx.isTouchDevice?.()) {
    touchActionsOpen = true;
    lastSignature = '';
    syncFloatingActions(ctx);
    return;
  }
  syncFloatingActions(ctx);
  ctx?.callbacks?.onToast?.('🎯 Pressione F ou clique na ação desejada.');
}
