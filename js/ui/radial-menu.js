/**
 * Menu Radial Contextual (PC & Mobile) - MycoCampus3D
 * Abre com a tecla F (PC) ou botao de acoes (Mobile) para executar acoes secundarias
 * sobre o item em maos ou sobre o objeto/dispositivo sob a mira.
 */

import { setBurnerLevel, BURNER_LEVEL_NAMES, updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { togglePetriLid } from '../items/petri-dish.js';
import { toggleCultureFridgeDoor } from '../items/culture-fridge.js';
import { getSanitizationStatus } from '../items/alcohol-spray.js';
import { isPdaRecipeBalanced } from '../items/pda-mix.js';
import { handlePrimaryAction, dropHeldItem } from '../systems/interaction-system.js';

let overlayEl = null;
let styleInjected = false;

function ensureRadialStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const st = document.createElement('style');
  st.textContent = `
    #myco-radial-overlay {
      position: fixed; inset: 0; z-index: 60;
      display: flex; align-items: center; justify-content: center;
      background: rgba(2, 6, 23, 0.42);
      backdrop-filter: blur(4px);
      animation: mycoRadialFade 0.14s ease-out;
    }
    @keyframes mycoRadialFade {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
    .myco-radial-ring {
      position: relative;
      width: min(320px, 84vw);
      height: min(320px, 84vw);
      border-radius: 9999px;
      background: radial-gradient(circle, rgba(15, 23, 42, 0.25) 28%, rgba(15, 23, 42, 0.82) 72%);
      border: 1.5px solid rgba(57, 255, 20, 0.35);
      box-shadow: 0 0 32px rgba(16, 185, 129, 0.22), inset 0 0 24px rgba(15, 23, 42, 0.8);
    }
    .myco-radial-center {
      position: absolute; left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: 94px; height: 94px; border-radius: 9999px;
      background: rgba(15, 23, 42, 0.94);
      border: 1.5px solid rgba(148, 163, 184, 0.45);
      color: #e2e8f0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 6px; cursor: pointer;
      font-size: 11px; font-weight: 700; line-height: 1.2;
      transition: transform 0.12s, border-color 0.12s;
    }
    .myco-radial-center:hover {
      border-color: #ef4444; transform: translate(-50%, -50%) scale(1.06);
    }
    .myco-radial-btn {
      position: absolute;
      transform: translate(-50%, -50%);
      min-width: 96px; max-width: 124px;
      padding: 8px 10px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(56, 189, 248, 0.42);
      color: #f8fafc;
      font-size: 12px; font-weight: 700;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      text-align: center; cursor: pointer;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
      transition: transform 0.12s, background 0.12s, border-color 0.12s;
      user-select: none;
    }
    .myco-radial-btn:hover, .myco-radial-btn:active {
      background: rgba(16, 185, 129, 0.25);
      border-color: #39ff14;
      transform: translate(-50%, -50%) scale(1.08);
    }
    .myco-radial-btn .ico { font-size: 18px; line-height: 1; }
  `;
  document.head.appendChild(st);
}

function inspectItemToast(ctx, item) {
  if (!item || !ctx.callbacks || !ctx.callbacks.onToast) return;
  const parts = ['🔍 ' + item.label];
  const san = getSanitizationStatus(item, ctx);
  if (san.isSanitized) parts.push('✨ Higienizado (' + san.remainingSec + 's)');

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
  if (lc) {
    parts.push('Líquido: ' + Math.round(lc.volMl) + '/' + lc.maxMl + 'ml');
  }

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

function buildRadialActions(ctx) {
  const actions = [];
  let title = 'Ações';

  // 1. Alvo sob a mira: Panela de Pressao
  const hoveredPot = ctx.hoveredPotInsert ||
    (ctx.hoveredPickable && ctx.cookerPots.find((cp) => cp.potItem === ctx.hoveredPickable || cp.lidItem === ctx.hoveredPickable));

  if (hoveredPot) {
    title = hoveredPot.potItem.label;
    actions.push({
      icon: '🍲',
      label: hoveredPot.lidItem.isAttached ? 'Retirar Tampa' : 'Ação Principal',
      run: () => handlePrimaryAction(ctx)
    });
    actions.push({
      icon: hoveredPot.mode === 'pasteurize' ? '♨️' : '🌡️',
      label: hoveredPot.mode === 'pasteurize' ? 'Modo Esterilizar' : 'Modo Pasteurizar',
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
      icon: '💧',
      label: 'Água: ' + (hoveredPot.waterMl / 1000).toFixed(1) + 'L',
      run: () => {
        const baseTxt = hoveredPot.hasBase ? 'Base 4cm ✅' : 'Sem Base ⚠️';
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('💧 Panela: ' + (hoveredPot.waterMl / 1000).toFixed(1) + 'L (Ideal: 3.0–4.0L • +0,5cm da base) • ' + baseTxt);
        }
      }
    });
    if (hoveredPot.waterMl > 3600) {
      actions.push({
        icon: '🚰',
        label: 'Ajustar 3.4L Ideal',
        run: () => {
          hoveredPot.waterMl = 3400;
          updateCookerWaterVisual(hoveredPot);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('💧 Excesso drenado para 3.4L (+0,5cm acima da base)!');
        }
      });
    }
    return { title, actions };
  }

  // 2. Alvo sob a mira: Fogareiro / Tripe a Gas
  if (ctx.hoveredBurnerSwitch) {
    title = ctx.hoveredBurnerSwitch.kind === 'gas_tripod' ? 'Tripé a Gás' : 'Fogareiro';
    actions.push({
      icon: '🔥',
      label: 'Mudar Chama',
      run: () => handlePrimaryAction(ctx)
    });
    actions.push({
      icon: '🛑',
      label: 'Desligar',
      run: () => {
        setBurnerLevel(ctx.hoveredBurnerSwitch, 0);
        if (window.MycoAudio) window.MycoAudio.playSwitch();
        const bId = ctx.hoveredBurnerSwitch.id || 'burner_lab';
        ctx.queueWorldStateChange(bId, 0);
        ctx.queueWorldStateChange(bId === 'burner_lab' ? 'burner_level_lab' : `${bId}_level`, 0);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🛑 Queimador desligado.');
      }
    });
    return { title, actions };
  }

  // 3. Alvo sob a mira: Item pegavel / Geladeira
  if (ctx.hoveredPickable) {
    const target = ctx.hoveredPickable;
    title = target.label;
    if (target.fridgeCtrl) {
      actions.push({
        icon: '🧊',
        label: target.fridgeCtrl.doorOpen ? 'Fechar Porta' : 'Abrir Porta',
        run: () => {
          toggleCultureFridgeDoor(target);
          ctx.queueWorldStateChange(target.id, target.fridgeCtrl.doorOpen ? 1 : 0);
          if (window.MycoAudio) window.MycoAudio.playDoor(target.fridgeCtrl.doorOpen);
        }
      });
      actions.push({
        icon: '🔍',
        label: 'Ver Status',
        run: () => {
          const count = target.fridgeCtrl.slots ? target.fridgeCtrl.slots.filter(Boolean).length : 0;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧊 Geladeira 4°C • ' + count + '/15 culturas armazenadas.');
        }
      });
      return { title, actions };
    }
    actions.push({
      icon: '✋',
      label: 'Pegar',
      run: () => handlePrimaryAction(ctx)
    });
    if (target.mesh && target.mesh.userData && target.mesh.userData.isPetri) {
      actions.push({
        icon: '🧫',
        label: target.mesh.userData.petriCtrl?.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
        run: () => togglePetriLid(ctx, target)
      });
    }
    actions.push({
      icon: '🔍',
      label: 'Inspecionar',
      run: () => inspectItemToast(ctx, target)
    });
    return { title, actions };
  }

  // 4. Item em maos
  if (ctx.heldItem) {
    const held = ctx.heldItem;
    title = held.label;
    actions.push({
      icon: '📦',
      label: ctx.placementMode ? 'Confirmar Local' : 'Posicionar (G/Q)',
      run: () => ctx.toggleHeldItemPlacement()
    });
    actions.push({
      icon: '⬇️',
      label: 'Soltar Aqui',
      run: () => dropHeldItem(ctx)
    });
    if (held.mesh && held.mesh.userData && held.mesh.userData.isPetri) {
      actions.push({
        icon: '🧫',
        label: held.mesh.userData.petriCtrl?.lidOpen ? 'Fechar Tampa' : 'Abrir Tampa',
        run: () => togglePetriLid(ctx, held)
      });
    }
    actions.push({
      icon: '🔍',
      label: 'Inspecionar',
      run: () => inspectItemToast(ctx, held)
    });
    return { title, actions };
  }

  // 5. Elementos fixos do campus (Porta, Persiana, Luz, Fluxo, Estufa)
  if (ctx.hoveredDoorObj || ctx.hoveredBlindObj || ctx.hoveredSwitch || ctx.hoveredHoodSwitch || ctx.hoveredStirSwitch || ctx.hoveredGreenhouseSlot) {
    title = ctx.hoveredDoorObj ? ctx.hoveredDoorObj.label
      : (ctx.hoveredBlindObj ? 'Persiana'
        : (ctx.hoveredGreenhouseSlot ? ctx.hoveredGreenhouseSlot.name : 'Dispositivo'));
    actions.push({
      icon: '⚡',
      label: 'Ativar / Alternar',
      run: () => handlePrimaryAction(ctx)
    });
  }

  return { title, actions };
}

export function isRadialMenuOpen() {
  return !!overlayEl;
}

export function closeRadialMenu() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

export function openRadialMenu(ctx) {
  if (overlayEl) {
    closeRadialMenu();
    return;
  }
  const { title, actions } = buildRadialActions(ctx);
  if (!actions.length) {
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🎯 Aponte para um item ou segure um objeto para abrir ações rápidas.');
    }
    return;
  }

  ensureRadialStyles();
  if (document.pointerLockElement) {
    try { document.exitPointerLock(); } catch (e) {}
  }

  overlayEl = document.createElement('div');
  overlayEl.id = 'myco-radial-overlay';

  const ring = document.createElement('div');
  ring.className = 'myco-radial-ring';

  const centerBtn = document.createElement('button');
  centerBtn.type = 'button';
  centerBtn.className = 'myco-radial-center';
  const shortTitle = title.length > 26 ? title.slice(0, 24) + '…' : title;
  centerBtn.innerHTML = `<span style="color:#39ff14;font-size:13px;">✕</span><span>${shortTitle}</span>`;
  centerBtn.addEventListener('click', closeRadialMenu);
  ring.appendChild(centerBtn);

  const count = actions.length;
  const radiusPct = 39;
  actions.forEach(function (act, idx) {
    const angle = -Math.PI / 2 + (idx * Math.PI * 2) / count;
    const xPct = 50 + Math.cos(angle) * radiusPct;
    const yPct = 50 + Math.sin(angle) * radiusPct;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'myco-radial-btn';
    btn.style.left = xPct + '%';
    btn.style.top = yPct + '%';
    btn.innerHTML = `<span class="ico">${act.icon}</span><span>${act.label}</span>`;
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      closeRadialMenu();
      act.run();
    });
    ring.appendChild(btn);
  });

  overlayEl.appendChild(ring);
  overlayEl.addEventListener('click', function (ev) {
    if (ev.target === overlayEl) closeRadialMenu();
  });
  document.body.appendChild(overlayEl);
}
