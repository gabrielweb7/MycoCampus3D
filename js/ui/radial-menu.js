/**
 * Barra Flutuante Diegetica de Acoes Contextuais (PC & Mobile) - MycoCampus3D
 * Aparece automaticamente dentro do jogo ao apontar para itens/dispositivos ou segurar objetos,
 * sem soltar o Pointer Lock nem exibir cursor do Windows.
 * Acione com as teclas 1, 2, 3, 4 (PC) ou toque direto (Mobile).
 */

import { setBurnerLevel, updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { togglePetriLid } from '../items/petri-dish.js';
import { toggleCultureFridgeDoor } from '../items/culture-fridge.js';
import { getSanitizationStatus } from '../items/alcohol-spray.js';
import { isPdaRecipeBalanced } from '../items/pda-mix.js';
import { handlePrimaryAction, dropHeldItem } from '../systems/interaction-system.js';

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
      bottom: 108px;
      transform: translateX(-50%);
      z-index: 25;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      max-width: 92vw;
      pointer-events: auto;
    }
    #myco-floating-actions.hidden { display: none; }
    .myco-float-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.82);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(57, 255, 20, 0.38);
      color: #f8fafc;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      cursor: pointer;
      user-select: none;
      transition: transform 0.1s, border-color 0.1s, background 0.1s;
    }
    .myco-float-chip:hover, .myco-float-chip:active {
      background: rgba(16, 185, 129, 0.3);
      border-color: #39ff14;
      transform: translateY(-1px);
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
  `;
  document.head.appendChild(st);
}

function inspectItemToast(ctx, item) {
  if (!item || !ctx.callbacks || !ctx.callbacks.onToast) return;
  const parts = ['🔍 ' + item.label];
  const san = getSanitizationStatus(item, ctx);
  if (san.alcoholWet) parts.push('🧻 Álcool aplicado (falta secar)');
  else if (san.isSanitized) parts.push('✨ Desinfectado (' + san.remainingSec + 's)');

  const petri = item.mesh && item.mesh.userData && item.mesh.userData.petriCtrl;
  if (petri) {
    parts.push('Modo: ' + petri.mode);
    parts.push(petri.sterilized ? 'Estéril ✅' : 'Não estéril');
    if (petri.inoculated) parts.push('Colonização: ' + Math.round(petri.colonization || 0) + '%');
    if (petri.expired) parts.push('⏰ Vencida');
  }

  const sp = item.spawnCtrl;
  if (sp) {
    if (sp.filled) {
      parts.push('Substrato: ' + (sp.substrateKind || 'N/A'));
      if (sp.waterMl) parts.push('Água: ' + sp.waterMl + 'ml');
      parts.push(sp.sterilized ? 'Estéril ✅' : 'Não estéril');
      if (sp.inoculated) parts.push('Colonização: ' + Math.round(sp.colonization || 0) + '%');
      if (sp.burned) parts.push('🔥 Queimado');
      if (sp.contaminated) parts.push('🦠 Contaminado');
      if (sp.expired) parts.push('⏰ Vencido');
    } else {
      parts.push('Vazio');
    }
  }

  const lc = item.mesh && item.mesh.userData && item.mesh.userData.liquidCtrl;
  if (lc) parts.push('Líquido: ' + Math.round(lc.volMl) + '/' + lc.maxMl + 'ml');

  const med = item.pdaMediumCtrl;
  if (med) {
    parts.push('Pó PDA: ' + (med.powderGrams || 0) + 'g');
    if (med.mixed) {
      const bal = lc ? isPdaRecipeBalanced(med, lc.volMl) : false;
      parts.push(bal ? 'Receita 40g/L ✅' : 'Receita desbalanceada ⚠️');
    }
    if (med.sterilized) parts.push('Esterilizado ✅');
    if (med.burned) parts.push('🔥 Queimado');
  }

  if (item.meta && item.meta.purpose && parts.length === 1) {
    parts.push(item.meta.purpose);
  }
  ctx.callbacks.onToast(parts.join(' • '));
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

  // 3. Item sob a mira
  if (ctx.hoveredPickable && !ctx.heldItem) {
    const target = ctx.hoveredPickable;
    if (target.fridgeCtrl) {
      actions.push({
        id: 'fridge_info_' + target.id,
        icon: '🔍',
        label: 'Ver Vagas',
        run: () => {
          const count = target.fridgeCtrl.slots ? target.fridgeCtrl.slots.filter(Boolean).length : 0;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧊 Geladeira 4°C • ' + count + '/15 culturas armazenadas.');
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

  // 4. Item em maos
  if (ctx.heldItem) {
    const held = ctx.heldItem;
    actions.push({
      id: 'held_place_' + held.id + '_' + (ctx.placementMode ? '1' : '0'),
      icon: '📦',
      label: ctx.placementMode ? 'Cancelar' : 'Posicionar (G/Q)',
      run: () => ctx.toggleHeldItemPlacement()
    });
    actions.push({
      id: 'held_drop_' + held.id,
      icon: '⬇️',
      label: 'Soltar',
      run: () => dropHeldItem(ctx)
    });
    if (held.mesh && held.mesh.userData && held.mesh.userData.isPetri) {
      actions.push({
        id: 'held_petri_lid_' + held.id,
        icon: '🧫',
        label: held.mesh.userData.petriCtrl?.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
        run: () => togglePetriLid(ctx, held)
      });
    }
    actions.push({
      id: 'held_inspect_' + held.id,
      icon: '🔍',
      label: 'Status',
      run: () => inspectItemToast(ctx, held)
    });
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
