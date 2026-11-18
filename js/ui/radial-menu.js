/**
 * Barra Flutuante Diegetica de Acoes Contextuais (PC & Mobile) - MycoCampus3D
 * Aparece automaticamente dentro do jogo ao apontar para itens/dispositivos ou segurar objetos,
 * sem soltar o Pointer Lock nem exibir cursor do Windows.
 * Acione com as teclas 1, 2, 3, 4 (PC) ou toque direto (Mobile).
 */

import { setBurnerLevel, updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { togglePetriLid } from '../items/petri-dish.js';
import { toggleCultureFridgeDoor, isCultureFridgeOccupied } from '../items/culture-fridge.js';
import { toggleCabinetPart } from '../items/lab-cabinets.js';
import { getSanitizationStatus } from '../items/alcohol-spray.js';
import { isPdaRecipeBalanced } from '../items/pda-mix.js';
import { handlePrimaryAction, dropHeldItem, setHeldTwoHandedGhost } from '../systems/interaction-system.js';
import { cancelHeldItemPlacement } from '../systems/held-item-placement.js';

let barEl = null;
let styleInjected = false;
let currentActions = [];
let lastSignature = '';

function ensureFloatingStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const st = document.createElement('style');
  st.textContent = `
    #myco-floating-actions {
      position: fixed;
      left: 50%;
      bottom: calc(76px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      z-index: 26;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      max-width: 92vw;
      pointer-events: auto;
      transition: bottom 0.18s ease;
    }
    #myco-floating-actions.with-held-item {
      bottom: calc(118px + env(safe-area-inset-bottom, 0px));
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
    .myco-float-chip:hover, .myco-float-chip:active {
      background: rgba(16, 185, 129, 0.35);
      border-color: #39ff14;
      transform: translateY(-1px);
    }
    body.device-touch .myco-float-key { display: none; }
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

export function showItemStatusCard(item, ctx) {
  if (!item) return;
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
  else chips.push({ icon: '⚠️', text: 'Não Desinfectado', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });

  const petri = item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (petri) {
    chips.push({ icon: petri.lidOpen ? '⚠️' : '✅', text: petri.lidOpen ? 'Tampa Aberta' : 'Tampa Fechada', color: petri.lidOpen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' });
    chips.push({ icon: petri.sterilized ? '✅' : '⚠️', text: petri.sterilized ? 'Estéril' : 'Não Estéril', color: petri.sterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
    if (petri.parafilmSealed) chips.push({ icon: '🎞️', text: 'Vedada (Parafilm M)', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
    if (petri.inoculated) chips.push({ icon: '🍄', text: 'Colonização ' + Math.round(petri.colonization || 0) + '%', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
    if (petri.contaminated) chips.push({ icon: '🦠', text: 'CONTAMINADA', color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    if (petri.expired) chips.push({ icon: '⏰', text: 'Vencida', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  }

  const sp = item.spawnCtrl;
  if (sp) {
    if (sp.filled) {
      chips.push({ icon: '🌾', text: 'Substrato: ' + (sp.substrateKind || 'Grãos'), color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
      if (sp.waterMl) chips.push({ icon: '💧', text: sp.waterMl + ' ml H₂O', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' });
      chips.push({ icon: sp.sterilized ? '✅' : '⚠️', text: sp.sterilized ? 'Esterilizado' : 'Não Esterilizado', color: sp.sterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30' });
      if (sp.inoculated) chips.push({ icon: '🍄', text: 'Colonização ' + Math.round(sp.colonization || 0) + '%', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });
      if (sp.contaminated) chips.push({ icon: '🦠', text: 'CONTAMINADO', color: 'bg-rose-600/30 text-rose-300 border-rose-500/50' });
    } else {
      chips.push({ icon: '📦', text: 'Recipiente Vazio', color: 'bg-slate-700/60 text-slate-300 border-slate-600/40' });
    }
  }

  const lc = item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
  if (lc) chips.push({ icon: '💧', text: 'Líquido: ' + Math.round(lc.volMl) + '/' + lc.maxMl + ' ml', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' });

  const med = item.pdaMediumCtrl;
  if (med) {
    chips.push({ icon: '🧪', text: 'Pó PDA: ' + (med.powderGrams || 0) + 'g', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' });
    if (med.mixed) chips.push({ icon: '🌀', text: 'Misturado', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' });
    chips.push({ icon: med.sterilized ? '✅' : '⏳', text: med.sterilized ? 'Esterilizado' : 'Pendente Esterilização', color: med.sterilized ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30' });
  }

  if (item.meta && item.meta.purpose && chips.length <= 1) {
    chips.push({ icon: 'ℹ️', text: item.meta.purpose, color: 'bg-slate-800/80 text-slate-200 border-slate-600/40' });
  }

  bodyEl.innerHTML = chips.map(c => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${c.color}">${c.icon} ${c.text}</span>`).join('');

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
    if (san.alcoholWet) parts.push('🧻 Álcool (secar)');
    else if (san.isSanitized) parts.push('✨ Desinfectado (' + san.remainingSec + 's)');
    ctx.callbacks.onToast(parts.join(' • '));
  }
}

function buildContextActions(ctx) {
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
    }
    return actions;
  }

  // 2. Fogareiro / Tripe a Gas
  if (ctx.hoveredBurnerSwitch && ctx.hoveredBurnerSwitch.on) {
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
        icon: '🔍',
        label: 'Ver Vagas',
        run: () => {
          const count = target.fridgeCtrl.slots ? target.fridgeCtrl.slots.filter(Boolean).length : 0;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧊 Geladeira 4°C • ' + count + ' vagas configuradas nas prateleiras.');
        }
      });
      return actions;
    }
    if (target.mesh && target.mesh.userData && target.mesh.userData.isPetri) {
      actions.push({
        id: 'petri_lid_' + target.id + '_' + (target.mesh.userData.petriCtrl?.lidOpen ? '1' : '0'),
        icon: '🧫',
        label: target.mesh.userData.petriCtrl?.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
        run: () => togglePetriLid(ctx, target)
      });
    }
    actions.push({
      id: 'inspect_' + target.id,
      icon: '🔍',
      label: 'Inspecionar',
      run: () => inspectItemToast(ctx, target)
    });
    return actions;
  }

  // 4. Ações especiais contextuais do item em mãos (sem poluir com chips estáticos que já estão na barra #held-item-bar)
  if (ctx.heldItem) {
    const held = ctx.heldItem;
    if (held.mesh && held.mesh.userData && held.mesh.userData.isPetri) {
      actions.push({
        id: 'held_petri_lid_' + held.id,
        icon: '🧫',
        label: held.mesh.userData.petriCtrl?.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
        run: () => togglePetriLid(ctx, held)
      });
    }
    return actions;
  }

  return actions;
}

export function syncFloatingActions(ctx) {
  if (!ctx || !ctx.inFps || ctx.lobbyTourActive) {
    if (barEl) barEl.classList.add('hidden');
    currentActions = [];
    lastSignature = '';
    return;
  }

  const actions = buildContextActions(ctx);
  if (!actions.length) {
    if (barEl && !barEl.classList.contains('hidden')) {
      barEl.classList.add('hidden');
    }
    currentActions = [];
    lastSignature = '';
    return;
  }

  if (barEl) {
    barEl.classList.toggle('with-held-item', !!ctx.heldItem);
  }
  const sig = actions.map((a) => a.id).join('|');
  currentActions = actions;
  if (sig === lastSignature && barEl && !barEl.classList.contains('hidden')) return;
  lastSignature = sig;

  ensureFloatingStyles();
  if (!barEl) {
    barEl = document.createElement('div');
    barEl.id = 'myco-floating-actions';
    document.body.appendChild(barEl);
  }
  barEl.classList.toggle('with-held-item', !!ctx.heldItem);
  barEl.classList.remove('hidden');
  barEl.replaceChildren();

  actions.forEach(function (act, idx) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'myco-float-chip';
    chip.innerHTML = `<span class="myco-float-key">${idx + 1}</span><span>${act.icon} ${act.label}</span>`;
    chip.addEventListener('click', function (ev) {
      ev.stopPropagation();
      act.run();
    });
    barEl.appendChild(chip);
  });
}

export function triggerFloatingAction(index) {
  if (index >= 0 && index < currentActions.length && currentActions[index]) {
    currentActions[index].run();
    return true;
  }
  return false;
}

export function isRadialMenuOpen() { return false; }
export function closeRadialMenu() {}
export function openRadialMenu(ctx) {
  if (currentActions.length) {
    triggerFloatingAction(0);
  } else if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast('🎯 Aponte para um item para ver as opções flutuantes (teclas 1–4).');
  }
}
