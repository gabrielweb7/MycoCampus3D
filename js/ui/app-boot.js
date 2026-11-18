/**
 * MycoCampus3D — Bootstrap da Aplicação, Bindings de HUD, Chat & Eventos
 */
import { SYNC_BACKGROUND_INTERVAL_MS, SYNC_INTERVAL_MS, getAppVersion } from '../core/constants.js';
import { LESSONS } from '../core/lessons-data.js';
import { appState } from '../core/state.js';
import { apiPost } from '../services/api-client.js';
import { syncMultiplayer, sendLeaveBeacon } from '../services/multiplayer-sync.js';
import { MUSHROOM_SPECIES_CATALOG } from '../world/mushroom-species.js';
import { getDiscoveredSpecies } from '../systems/mycoteca.js';
import {
  $,
  applyDeviceUi,
  getToastUntil,
  isTouch,
  releaseInputForModal,
  requestCampusFullscreen,
  showFloatingToast,
  toggleCampusFullscreen
} from './dom-helpers.js';
import {
  enterCampus,
  loadLobbyStats,
  logoutCampus,
  renderSwatches,
  tryResumeSession,
  updateFpsUi,
  updateUserHud
} from './hud-lobby.js';
import { completeLabStep, renderMapModal, renderQuestModal } from './quest-map.js';
import { renderShopModal } from './modal-shop.js';
import { broadcastSlide, renderLessonsModal } from './modal-lessons.js';
import { renderLabGuideModal } from './modal-lab-guide.js';
import {
  closeAdminModal,
  getAdminUsersCache,
  loadAdminUsers,
  openAdminModal,
  openRankingModal,
  renderAdminUsers,
  showAdminNotice
} from './modal-admin.js';
import { setupMobileJoystick } from './mobile-controls.js';

function getMobileActionIcon(prompt) {
  const text = String(prompt || '').toLocaleLowerCase('pt-BR');
  if (text.indexOf('selar') !== -1 || text.indexOf('seladora') !== -1) return '♨️';
  if (text.indexOf('seringa') !== -1 || text.indexOf('inocular') !== -1) return '💉';
  if (text.indexOf('bisturi') !== -1 || text.indexOf('micélio') !== -1) return '🔪';
  if (text.indexOf('papel') !== -1 || text.indexOf('secar') !== -1) return '🧻';
  if (text.indexOf('borrifar') !== -1 || text.indexOf('álcool') !== -1) return '💦';
  if (text.indexOf('água') !== -1 || text.indexOf('despejar') !== -1 || text.indexOf('umedecer') !== -1) return '💧';
  if (text.indexOf('misturar') !== -1 || text.indexOf('mistura') !== -1) return '🥄';
  if (text.indexOf('colher') !== -1) return '🍄';
  if (text.indexOf('sentar') !== -1) return '🪑';
  if (text.indexOf('panela') !== -1 || text.indexOf('esteril') !== -1 || text.indexOf('fogo') !== -1) return '♨️';
  if (text.indexOf('abrir') !== -1 || text.indexOf('fechar') !== -1) return '↔️';
  if (text.indexOf('pegar') !== -1) return '✋';
  return '✅';
}

async function harvestMushroom(mushId) {
  if (!appState.currentUser) return;
  try {
    const data = await apiPost('api/auth.php?action=harvest', { mushroom_id: mushId || '' }, true);
    if (data.ok && data.user) {
      appState.currentUser = data.user;
      updateUserHud();
    }
  } catch (e) {}
}

async function harvestGreenhouseSlot(slot) {
  if (!appState.currentUser) return;
  try {
    const data = await apiPost('api/auth.php?action=harvest_greenhouse', { slot_id: slot.id }, true);
    if (data.ok && data.user) {
      appState.currentUser = data.user;
      updateUserHud();
      showFloatingToast('🍄 +50 XP e +2 Cogumelos colhidos na Estufa!');
    }
  } catch (e) {}
}

function bindModalsAndToolbar() {
  const btnQuality = $('btn-quality');
  if (btnQuality && window.setCampusQualityMode && window.getCampusQualityState) {
    const qModes = ['high', 'medium', 'low', 'min'];
    btnQuality.onclick = (e) => {
      e.stopPropagation();
      if (window.MycoAudio) window.MycoAudio.playClick();
      const cur = window.getCampusQualityState();
      const curKey = qModes.indexOf(cur.mode) !== -1 ? cur.mode : cur.tier;
      const idx = qModes.indexOf(curKey);
      window.setCampusQualityMode(qModes[(idx + 1) % qModes.length]);
    };
  }

  const fsBtn = $('btn-fullscreen');
  if (fsBtn) {
    fsBtn.onclick = (e) => {
      e.stopPropagation();
      toggleCampusFullscreen();
    };
  }

  const btnToggleFps = $('btn-toggle-fps');
  if (btnToggleFps) btnToggleFps.onclick = () => window.setCampusFpsMode(!appState.inFps);
  const btnLogout = $('btn-logout');
  if (btnLogout) btnLogout.onclick = logoutCampus;

  const heldDropBtn = $('btn-held-drop');
  if (heldDropBtn) {
    heldDropBtn.onclick = (e) => {
      e.stopPropagation();
      if (mobilePlacementModeActive) {
        if (window.toggleCampusHeldPlacement) window.toggleCampusHeldPlacement();
      } else {
        if (window.dropCampusHeldItem) window.dropCampusHeldItem();
      }
    };
  }
  const heldPlaceBtn = $('btn-held-place');
  if (heldPlaceBtn) {
    heldPlaceBtn.onclick = (e) => {
      e.stopPropagation();
      if (mobilePlacementModeActive) {
        if (window.setCampusMobilePrimary) {
          window.setCampusMobilePrimary(true);
          window.setCampusMobilePrimary(false);
        }
      } else {
        if (window.toggleCampusHeldPlacement) window.toggleCampusHeldPlacement();
      }
    };
  }
  const heldRotateBtn = $('btn-held-rotate');
  if (heldRotateBtn) {
    heldRotateBtn.onclick = (e) => {
      e.stopPropagation();
      if (window.rotateCampusHeldItem) window.rotateCampusHeldItem();
    };
  }
  const heldStatusBtn = $('btn-held-status');
  if (heldStatusBtn) {
    heldStatusBtn.onclick = (e) => {
      e.stopPropagation();
      if (window.inspectCampusHeldItem) window.inspectCampusHeldItem();
    };
  }
  const btnCloseStatus = $('btn-close-status');
  if (btnCloseStatus) {
    btnCloseStatus.onclick = (e) => {
      e.stopPropagation();
      const sc = $('item-status-card');
      if (sc) sc.classList.add('hidden');
    };
  }

  const btnOpenLessons = $('btn-open-lessons');
  if (btnOpenLessons) btnOpenLessons.onclick = () => { releaseInputForModal(); renderLessonsModal(); $('lesson-modal')?.classList.remove('hidden'); };
  const btnCloseLessons = $('btn-close-lessons');
  if (btnCloseLessons) btnCloseLessons.onclick = () => $('lesson-modal')?.classList.add('hidden');

  const btnOpenGuide = $('btn-open-guide');
  if (btnOpenGuide) {
    btnOpenGuide.onclick = () => {
      releaseInputForModal();
      renderLabGuideModal();
      $('guide-modal')?.classList.remove('hidden');
    };
  }
  const btnCloseGuide = $('btn-close-guide');
  if (btnCloseGuide) btnCloseGuide.onclick = () => $('guide-modal')?.classList.add('hidden');

  const btnOpenRanking = $('btn-open-ranking');
  if (btnOpenRanking) btnOpenRanking.onclick = openRankingModal;
  const btnCloseRanking = $('btn-close-ranking');
  if (btnCloseRanking) btnCloseRanking.onclick = () => $('ranking-modal')?.classList.add('hidden');

  const btnMap = $('btn-open-map');
  if (btnMap) {
    btnMap.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      releaseInputForModal();
      renderMapModal();
      $('map-modal')?.classList.remove('hidden');
    };
  }
  const btnCloseMap = $('btn-close-map');
  if (btnCloseMap) {
    btnCloseMap.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      $('map-modal')?.classList.add('hidden');
    };
  }

  const btnQuest = $('btn-open-quest');
  if (btnQuest) {
    btnQuest.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      releaseInputForModal();
      renderQuestModal();
      $('quest-modal')?.classList.remove('hidden');
    };
  }
  const btnCloseQuest = $('btn-close-quest');
  if (btnCloseQuest) {
    btnCloseQuest.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      $('quest-modal')?.classList.add('hidden');
    };
  }

  const btnShop = $('btn-open-shop');
  if (btnShop) {
    btnShop.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      releaseInputForModal();
      renderShopModal();
      $('shop-modal')?.classList.remove('hidden');
    };
  }
  const btnCloseShop = $('btn-close-shop');
  if (btnCloseShop) {
    btnCloseShop.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      $('shop-modal')?.classList.add('hidden');
    };
  }
  const btnMycoteca = $('btn-open-mycoteca');
  if (btnMycoteca) {
    btnMycoteca.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      releaseInputForModal();
      const grid = $('mycoteca-grid');
      const summary = $('mycoteca-summary');
      const found = getDiscoveredSpecies();
      if (summary) summary.textContent = `Descobertas: ${found.length} / ${MUSHROOM_SPECIES_CATALOG.length} espécies catalogadas`;
      if (grid) {
        grid.innerHTML = MUSHROOM_SPECIES_CATALOG.map((sp) => {
          const fullName = `${sp.common} (${sp.scientific})`;
          const isFound = found.some((f) => f.indexOf(sp.scientific) !== -1 || f === fullName);
          const hab = sp.habitat === 'wood' ? '🪵 Madeira' : (sp.habitat === 'pasture' ? '🐄 Pasto' : '🌲 Mata');
          return `<div class="p-2.5 rounded-xl border ${isFound ? 'bg-teal-950/60 border-teal-400/50 text-white' : 'bg-slate-900/60 border-slate-700/50 text-slate-400'}">` +
            `<div class="font-bold truncate">${isFound ? '✅ ' + sp.common : '🔒 ' + sp.common}</div>` +
            `<div class="italic text-[11px] opacity-80 truncate">${sp.scientific}</div>` +
            `<div class="mt-1 text-[10px] font-semibold ${isFound ? 'text-teal-300' : 'text-slate-500'}">${hab} • ${isFound ? 'Catalogado' : 'Procure no mapa'}</div>` +
            `</div>`;
        }).join('');
      }
      $('mycoteca-modal')?.classList.remove('hidden');
    };
  }
  const btnCloseMycoteca = $('btn-close-mycoteca');
  if (btnCloseMycoteca) {
    btnCloseMycoteca.onclick = () => $('mycoteca-modal')?.classList.add('hidden');
  }

  const btnEmotes = $('btn-open-emotes');
  if (btnEmotes) {
    btnEmotes.onclick = () => {
      if (window.MycoAudio) window.MycoAudio.playClick();
      $('emote-bar')?.classList.toggle('hidden');
    };
  }
  const btnCloseEmotes = $('btn-close-emotes');
  if (btnCloseEmotes) btnCloseEmotes.onclick = () => $('emote-bar')?.classList.add('hidden');
  document.querySelectorAll('.emote-btn').forEach((btn) => {
    btn.onclick = () => {
      const em = btn.getAttribute('data-emote');
      if (em && window.playCampusEmote) window.playCampusEmote(em);
    };
  });

  const audioBtn = $('btn-toggle-audio');
  if (audioBtn) {
    audioBtn.textContent = (window.MycoAudio && window.MycoAudio.isMuted()) ? '🔇' : '🔊';
    audioBtn.onclick = () => {
      if (window.MycoAudio) {
        const muted = window.MycoAudio.toggleMute();
        audioBtn.textContent = muted ? '🔇' : '🔊';
      }
    };
  }

  if ($('btn-open-admin')) $('btn-open-admin').onclick = openAdminModal;
  if ($('btn-close-admin')) $('btn-close-admin').onclick = closeAdminModal;
  if ($('btn-admin-refresh')) $('btn-admin-refresh').onclick = loadAdminUsers;

  const btnAdminResetWorld = $('btn-admin-reset-world');
  if (btnAdminResetWorld) {
    btnAdminResetWorld.onclick = async () => {
      try {
        const rw = await apiPost('api/multiplayer.php?action=reset_world', {}, true);
        if (rw && rw.ok) {
          if (rw.restored_from_default > 0) {
            appState.isInitialSync = true;
            events.emit('sync:now');
            showAdminNotice(`♻️ Mundo restaurado para o padrão salvo pelo Admin (${rw.restored_from_default} itens)!`);
          } else {
            if (window.resetCampusWorldObjects) window.resetCampusWorldObjects();
            showAdminNotice('♻️ Todos os itens do laboratório e estantes foram restaurados para as posições originais!');
          }
        } else {
          showAdminNotice((rw && rw.error) || 'Não foi possível resetar os itens.', true);
        }
      } catch (e) {
        showAdminNotice('Erro de conexão ao resetar itens.', true);
      }
    };
  }

  const btnAdminSaveDefault = $('btn-admin-save-default');
  if (btnAdminSaveDefault) {
    btnAdminSaveDefault.onclick = async () => {
      const ed = window.getCampusAdminEditor ? window.getCampusAdminEditor() : null;
      if (!ed) return;
      try {
        const res = await ed.saveWorldDefault();
        if (res && res.ok) {
          showAdminNotice(`💾 Padrão do Admin salvo no MySQL (${res.saved_count} itens)! Futuros resets voltarão exatamente para este layout.`);
        } else {
          showAdminNotice((res && res.error) || 'Falha ao salvar padrão.', true);
        }
      } catch (e) {
        showAdminNotice('Erro de conexão ao salvar padrão.', true);
      }
    };
  }

  const btnAdminEditMode = $('btn-admin-edit-mode');
  const adminEditBanner = $('admin-edit-banner');
  function syncAdminEditModeUi(active) {
    if (btnAdminEditMode) {
      btnAdminEditMode.textContent = active ? '🛠️ Modo Edição: ON' : '🛠️ Modo Edição: OFF';
      btnAdminEditMode.classList.toggle('bg-amber-600', active);
      btnAdminEditMode.classList.toggle('text-white', active);
    }
    if (adminEditBanner) adminEditBanner.classList.toggle('hidden', !active);
  }
  if (btnAdminEditMode) {
    btnAdminEditMode.onclick = () => {
      const ed = window.getCampusAdminEditor ? window.getCampusAdminEditor() : null;
      if (!ed) return;
      const next = ed.setEditMode(!ed.isEditMode());
      syncAdminEditModeUi(next);
      showAdminNotice(next
        ? '🛠️ Modo Edição ATIVADO! Agora você pode pegar e mover bancadas com tudo em cima e editar/deletar itens.'
        : '🛠️ Modo Edição desativado.');
    };
  }
  const btnExitAdminEdit = $('btn-exit-admin-edit');
  if (btnExitAdminEdit) {
    btnExitAdminEdit.onclick = () => {
      const ed = window.getCampusAdminEditor ? window.getCampusAdminEditor() : null;
      if (!ed) return;
      ed.setEditMode(false);
      syncAdminEditModeUi(false);
    };
  }

  const btnAdminAddPrefab = $('btn-admin-add-prefab');
  if (btnAdminAddPrefab) {
    btnAdminAddPrefab.onclick = async () => {
      const ed = window.getCampusAdminEditor ? window.getCampusAdminEditor() : null;
      const sel = $('admin-prefab-select');
      if (!ed || !sel) return;
      try {
        const created = await ed.addPrefab(sel.value);
        showAdminNotice(created ? `➕ Adicionado: ${created.label} (sincronizado!)` : 'Prefab não encontrado.', !created);
      } catch (e) {
        showAdminNotice('Erro ao adicionar prefab.', true);
      }
    };
  }

  const btnAdminRotateGroup = $('btn-admin-rotate-group');
  if (btnAdminRotateGroup) {
    btnAdminRotateGroup.onclick = () => {
      const ed = window.getCampusAdminEditor ? window.getCampusAdminEditor() : null;
      const target = ed && ed.getTargetItem();
      if (!target) {
        showAdminNotice('Segure ou mire em uma bancada/item antes de girar.', true);
        return;
      }
      const res = ed.moveGroup(target, 0, 0, 0, Math.PI / 2);
      showAdminNotice(`🔄 ${target.label} girado +90° com ${Math.max(0, (res && res.movedCount ? res.movedCount - 1 : 0))} item(ns) em cima!`);
    };
  }

  const btnAdminEditItem = $('btn-admin-edit-item');
  if (btnAdminEditItem) {
    btnAdminEditItem.onclick = async () => {
      const ed = window.getCampusAdminEditor ? window.getCampusAdminEditor() : null;
      const target = ed && ed.getTargetItem();
      if (!target) {
        showAdminNotice('Segure ou mire em um item para editar.', true);
        return;
      }
      const newLabel = window.prompt('Novo nome/rótulo do item:', target.label || '');
      if (newLabel === null) return;
      const curScale = target.mesh ? target.mesh.scale.x : 1;
      const scaleStr = window.prompt('Escala (0.25 a 4.0):', String(curScale));
      if (scaleStr === null) return;
      const parsedScale = parseFloat(scaleStr);
      const scale = Number.isFinite(parsedScale) ? Math.max(0.25, Math.min(4.0, parsedScale)) : curScale;
      try {
        await ed.editItem(target, { label: newLabel, scale });
        showAdminNotice(`✏️ Atualizado: ${newLabel} (${scale}x)`);
      } catch (e) {
        showAdminNotice('Erro ao editar item.', true);
      }
    };
  }

  const btnAdminRemoveItem = $('btn-admin-remove-item');
  if (btnAdminRemoveItem) {
    btnAdminRemoveItem.onclick = async () => {
      const ed = window.getCampusAdminEditor ? window.getCampusAdminEditor() : null;
      const target = ed && ed.getTargetItem();
      if (!target) {
        showAdminNotice('Segure ou mire em um item para remover.', true);
        return;
      }
      try {
        await ed.removeItem(target);
        showAdminNotice(`🗑️ Removido: ${target.label} (sincronizado!)`);
      } catch (e) {
        showAdminNotice('Erro ao remover item.', true);
      }
    };
  }

  const searchAdminInput = $('admin-search-input');
  if (searchAdminInput) {
    searchAdminInput.addEventListener('focus', () => { if (window.clearCampusKeys) window.clearCampusKeys(); });
    searchAdminInput.addEventListener('input', () => renderAdminUsers(getAdminUsersCache()));
  }

  const btnResetLab = $('btn-reset-lab');
  if (btnResetLab) {
    btnResetLab.onclick = async () => {
      if (window.resetCampusWorldObjects) window.resetCampusWorldObjects();
      try { await apiPost('api/multiplayer.php?action=reset_world', {}, true); } catch (e) {}
    };
  }

  // Mobile Menu Drawer Toggle
  const btnMobileMenu = $('btn-mobile-menu');
  const hudSecTools = $('hud-secondary-tools');
  if (btnMobileMenu && hudSecTools) {
    btnMobileMenu.onclick = (e) => {
      e.stopPropagation();
      if (window.MycoAudio) window.MycoAudio.playClick();
      hudSecTools.classList.toggle('open');
    };
    document.addEventListener('click', (e) => {
      if (hudSecTools.classList.contains('open') && !hudSecTools.contains(e.target) && e.target !== btnMobileMenu) {
        hudSecTools.classList.remove('open');
      }
    });
    hudSecTools.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        hudSecTools.classList.remove('open');
      });
    });
  }

  // Mobile Chat Toggle & Keyboard Viewport Handling
  const chatContainer = $('chat-container');
  const btnChatToggle = $('btn-mobile-chat-toggle');
  const btnChatClose = $('btn-mobile-chat-close');
  const chatInput = $('chat-input');

  const updateChatKeyboardOffset = () => {
    if (!chatContainer) return;
    if (!isTouch() || !chatContainer.classList.contains('chat-expanded') || !window.visualViewport) {
      chatContainer.style.removeProperty('--chat-kb-offset');
      return;
    }
    const vv = window.visualViewport;
    const kbHeight = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    chatContainer.style.setProperty('--chat-kb-offset', `${Math.round(kbHeight + 14)}px`);
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateChatKeyboardOffset);
    window.visualViewport.addEventListener('scroll', updateChatKeyboardOffset);
  }

  if (chatContainer) {
    chatContainer.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
    chatContainer.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
  }

  if (btnChatToggle && chatContainer) {
    btnChatToggle.onclick = (e) => {
      e.stopPropagation();
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (window.clearCampusKeys) window.clearCampusKeys();
      chatContainer.classList.add('chat-expanded');
      if (isTouch()) document.body.classList.add('chat-typing');
      if (chatInput) chatInput.focus();
      updateChatKeyboardOffset();
    };
  }
  if (btnChatClose && chatContainer) {
    btnChatClose.onclick = (e) => {
      e.stopPropagation();
      chatContainer.classList.remove('chat-expanded');
      document.body.classList.remove('chat-typing');
      if (chatInput) chatInput.blur();
      updateChatKeyboardOffset();
    };
  }
}

function bindChatAndShortcuts() {
  function submitChatMessage() {
    const inp = $('chat-input');
    if (!inp) return;
    const txt = inp.value.trim();
    if (txt.toLowerCase() === '/discord') {
      inp.value = '';
      window.open('https://discord.gg/EmpEx6PxG', '_blank', 'noopener,noreferrer');
      showToast('💬 Abrindo o Discord oficial do MycoCampus3D!');
    } else if (txt) {
      appState.pendingChatMsg = txt.slice(0, 140);
      inp.value = '';
      syncMultiplayer();
    }
    inp.blur();
    document.body.classList.remove('chat-typing');
    const chatContainer = $('chat-container');
    if (chatContainer && isTouch()) {
      chatContainer.classList.remove('chat-expanded');
      chatContainer.style.removeProperty('--chat-kb-offset');
    }
  }

  const chatForm = $('chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitChatMessage();
    });
  }

  const chatInput = $('chat-input');
  if (chatInput) {
    chatInput.addEventListener('focus', () => {
      if (window.clearCampusKeys) window.clearCampusKeys();
      if (isTouch()) document.body.classList.add('chat-typing');
    });
    chatInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (document.activeElement !== chatInput) {
          document.body.classList.remove('chat-typing');
        }
      }, 120);
    });
    chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        chatInput.blur();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitChatMessage();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code !== 'KeyE' && e.code !== 'KeyT' && e.code !== 'Enter') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    const lobbyEl = $('campus-lobby');
    if (lobbyEl && !lobbyEl.classList.contains('hidden')) return;
    const lessonEl = $('lesson-modal');
    if (lessonEl && !lessonEl.classList.contains('hidden')) return;
    const rankEl = $('ranking-modal');
    if (rankEl && !rankEl.classList.contains('hidden')) return;
    const inp = $('chat-input');
    if (!inp) return;
    e.preventDefault();
    if (window.clearCampusKeys) window.clearCampusKeys();
    inp.focus();
    setTimeout(() => { if (document.activeElement !== inp) inp.focus(); }, 15);
  });
}

export function bootApp() {
  applyDeviceUi();
  window.addEventListener('resize', applyDeviceUi);
  window.addEventListener('orientationchange', applyDeviceUi);
  renderSwatches();
  setupMobileJoystick();
  loadLobbyStats();
  setInterval(loadLobbyStats, 20000);

  const verEl = $('app-version');
  if (verEl) verEl.textContent = 'v' + getAppVersion();
  fetch('VERSION?_=' + Date.now(), { cache: 'no-store' })
    .then((r) => (r.ok ? r.text() : ''))
    .then((v) => {
      const liveVer = (v || '').trim();
      if (/^\d+\.\d+\.\d+$/.test(liveVer)) {
        window.MYCO_VERSION = liveVer;
        if (verEl) verEl.textContent = 'v' + liveVer;
      }
    })
    .catch(() => {});
  let mobilePlacementModeActive = false;
  let currentHoldLabel = '';
  let currentHoverPrompt = '';

  function refreshMobileAction() {
    const actBtn = $('btn-mobile-action');
    if (!actBtn) return;
    if (!isTouch() || !appState.currentUser || !appState.inFps) {
      actBtn.style.display = 'none';
      return;
    }

    const isHolding = !!(window.getCampusPlayerPose && window.getCampusPlayerPose().holding_item);

    if (isHolding && currentHoldLabel) {
      actBtn.style.display = 'flex';
      actBtn.dataset.action = 'use';
      if (mobilePlacementModeActive) {
        actBtn.textContent = '✅';
        actBtn.title = 'Confirmar Posição do Item';
      } else if (currentHoldLabel.indexOf('Giz') !== -1 || currentHoldLabel.indexOf('chalk') !== -1) {
        actBtn.textContent = '✏️';
        actBtn.title = 'Desenhar na Lousa (segure e arraste o dedo)';
      } else if (currentHoldLabel.indexOf('Apagador') !== -1 || currentHoldLabel.indexOf('eraser') !== -1) {
        actBtn.textContent = '🧽';
        actBtn.title = 'Apagar Lousa (segure e arraste o dedo)';
      } else if (currentHoldLabel.indexOf('Borrifador') !== -1 || currentHoldLabel.indexOf('Álcool') !== -1) {
        actBtn.textContent = '💦';
        actBtn.title = 'Borrifar Álcool 70%';
      } else if (currentHoldLabel.indexOf('Papel Toalha') !== -1) {
        actBtn.textContent = '🧻';
        actBtn.title = 'Secar Álcool 70% (120s)';
      } else if (currentHoldLabel.indexOf('Termômetro') !== -1) {
        actBtn.textContent = '🌡️';
        actBtn.title = 'Medir Temperatura';
      } else if (currentHoldLabel.indexOf('Seringa') !== -1) {
        actBtn.textContent = '💉';
        actBtn.title = 'Usar Seringa (segure para aspirar/injetar)';
      } else if (currentHoldLabel.indexOf('Seladora') !== -1) {
        actBtn.textContent = '♨️';
        actBtn.title = 'Selar Bag Preenchido';
      } else if (currentHoldLabel.indexOf('Luva') !== -1) {
        actBtn.textContent = '🧤';
        actBtn.title = currentHoverPrompt || 'Luvas de Nitrilo';
      } else if (currentHoverPrompt) {
        actBtn.textContent = getMobileActionIcon(currentHoverPrompt);
        actBtn.title = currentHoverPrompt;
      } else {
        actBtn.style.display = 'none';
        actBtn.dataset.action = '';
        return;
      }
      if (currentHoverPrompt) {
        actBtn.title = currentHoverPrompt;
        actBtn.setAttribute('aria-label', currentHoverPrompt);
      }
    } else if (currentHoverPrompt) {
      actBtn.style.display = 'flex';
      actBtn.dataset.action = 'interact';
      actBtn.textContent = getMobileActionIcon(currentHoverPrompt);
      actBtn.title = currentHoverPrompt;
      actBtn.setAttribute('aria-label', currentHoverPrompt);
    } else {
      actBtn.style.display = 'none';
      actBtn.dataset.action = '';
    }
  }

  if (window.location.search.indexOf('preview=1') !== -1) {
    $('campus-lobby')?.classList.add('hidden');
  }

  // Auto-fade FPS hint on touch after 8 seconds
  if (isTouch()) {
    setTimeout(() => {
      const hint = $('fps-hint');
      if (hint) {
        hint.style.transition = 'opacity 0.8s ease';
        hint.style.opacity = '0';
        hint.style.pointerEvents = 'none';
      }
    }, 8000);
  }

  window.initCampus3D('campus-canvas-wrap', {
    onHarvestMushroom: (mushId) => harvestMushroom(mushId),
    onHarvestGreenhouse: (slot) => harvestGreenhouseSlot(slot),
    onDehydrateReward: () => harvestMushroom('dehydrator_crisp'),
    onOpenLessons: () => {
      renderLessonsModal();
      $('lesson-modal')?.classList.remove('hidden');
    },
    onScreenNav: (delta) => {
      if (appState.currentUser) broadcastSlide(appState.currentSlideIdx + delta);
    },
    onWorldAction: () => syncMultiplayer(),
    onLabStep: (stepKey) => completeLabStep(stepKey),
    onToast: (msg) => showFloatingToast(msg, 3500),
    onNearScreen: () => { $('prof-toolbar')?.classList.add('hidden'); },
    onHoldChange: (label) => {
      currentHoldLabel = label || '';
      const heldBar = $('held-item-bar');
      const heldName = $('held-item-bar-name');
      if (heldBar && heldName) {
        if (label && appState.currentUser && !isTouch()) {
          heldName.textContent = label;
          heldBar.classList.remove('hidden');
        } else {
          heldBar.classList.add('hidden');
        }
      }
      const dropBtn = $('btn-mobile-drop');
      if (dropBtn) dropBtn.style.display = (label && isTouch()) ? 'flex' : 'none';
      const rotBtn = $('btn-mobile-rotate');
      if (rotBtn) rotBtn.style.display = (label && isTouch() && mobilePlacementModeActive) ? 'flex' : 'none';
      const heldRot = $('btn-held-rotate');
      if (heldRot) heldRot.style.display = (label && !isTouch() && mobilePlacementModeActive) ? 'inline-flex' : 'none';
      const placeBtn = $('btn-mobile-place');
      if (placeBtn) {
        placeBtn.style.display = (label && isTouch()) ? 'flex' : 'none';
        placeBtn.textContent = mobilePlacementModeActive ? '✖️' : '📦';
        placeBtn.title = mobilePlacementModeActive
          ? 'Cancelar posicionamento'
          : 'Posicionar item';
        placeBtn.classList.toggle('placement-active', mobilePlacementModeActive);
      }
      refreshMobileAction();
    },
    onPlacementModeChange: (active) => {
      mobilePlacementModeActive = active;
      const rotBtn = $('btn-mobile-rotate');
      if (rotBtn) rotBtn.style.display = (currentHoldLabel && isTouch() && active) ? 'flex' : 'none';
      const heldRot = $('btn-held-rotate');
      if (heldRot) heldRot.style.display = (currentHoldLabel && !isTouch() && active) ? 'inline-flex' : 'none';
      const placeBtn = $('btn-mobile-place');
      if (placeBtn) {
        placeBtn.textContent = active ? '✖️' : '📦';
        placeBtn.title = active
          ? 'Cancelar posicionamento'
          : 'Posicionar item';
        placeBtn.classList.toggle('placement-active', active);
      }
      const heldPlace = $('btn-held-place');
      const heldDrop = $('btn-held-drop');
      if (heldPlace) {
        heldPlace.innerHTML = active
          ? '<span class="hidden sm:inline bg-slate-900/80 text-emerald-300 px-1 py-0.2 rounded text-[10px] font-mono border border-emerald-500/30">[Clique]</span> ✅ Confirmar'
          : '<span class="hidden sm:inline bg-slate-900/80 text-emerald-300 px-1 py-0.2 rounded text-[10px] font-mono border border-emerald-500/30">[G]</span> 📦 Posicionar';
      }
      if (heldDrop) {
        heldDrop.innerHTML = active
          ? '<span class="hidden sm:inline bg-slate-900/80 text-amber-300 px-1 py-0.2 rounded text-[10px] font-mono border border-amber-500/30">[Esc]</span> ✕ Cancelar'
          : '<span class="hidden sm:inline bg-slate-900/80 text-amber-300 px-1 py-0.2 rounded text-[10px] font-mono border border-amber-500/30">[X]</span> ⬇️ Largar';
      }
      refreshMobileAction();
    },
    onFpsChange: (fps) => {
      updateFpsUi(fps);
      refreshMobileAction();
    },
    onQualityChange: (info) => {
      const qBtn = $('btn-quality');
      if (!qBtn || !info) return;
      const labels = { high: 'Alto', medium: 'Méd', low: 'Desemp', min: 'Mín' };
      const tierTxt = labels[info.tier] || info.tier;
      const fpsTxt = info.fps > 0 ? ` • ${info.fps}fps` : '';
      qBtn.textContent = `⚡ ${tierTxt}${fpsTxt}`;
      qBtn.className = 'px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 font-bold border whitespace-nowrap ' +
        (info.tier === 'min' || info.tier === 'low' ? 'text-amber-300 border-amber-500/40' : 'text-cyan-300 border-cyan-500/40');
    },
    onHoverPrompt: (txt) => {
      currentHoverPrompt = txt || '';
      const pill = $('interact-pill');
      if (pill && Date.now() >= getToastUntil()) {
        if (isTouch() && currentHoverPrompt) {
          pill.textContent = currentHoverPrompt;
          pill.classList.remove('hidden');
        } else {
          // No Desktop, o Crachá 3D Diegético exibe os parâmetros e ações no mundo 3D
          pill.classList.add('hidden');
        }
      }
      refreshMobileAction();
    }
  });

  const lobbyForm = $('lobby-form');
  if (lobbyForm) {
    lobbyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      requestCampusFullscreen();
      const errBox = $('lobby-error');
      if (errBox) errBox.classList.add('hidden');
      const btn = $('btn-enter-campus');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Entrando no campus...';
      }

      let data;
      try {
        data = await apiPost('api/auth.php?action=login', {
          display_name: $('input-name').value.trim(),
          pin: $('input-pin').value,
          hat_color: appState.selectedHat,
          body_color: appState.selectedBody
        });
      } catch (err) {
        console.error('[MycoCampus3D] Erro de rede no login:', err);
        if (errBox) {
          errBox.textContent = 'Falha ao conectar com o servidor. Tente novamente em instantes.';
          errBox.classList.remove('hidden');
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🚀 Entrar no Campus 3D';
        }
        return;
      }

      if (!data.ok) {
        if (errBox) {
          errBox.textContent = data.error || 'Erro ao autenticar.';
          errBox.classList.remove('hidden');
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🚀 Entrar no Campus 3D';
        }
        return;
      }

      try {
        enterCampus(data.user, data.token || '');
      } catch (uiErr) {
        console.error('[MycoCampus3D] Erro ao iniciar o campus após login:', uiErr);
        if (errBox) {
          errBox.textContent = 'Erro ao iniciar a interface do campus: ' + (uiErr && uiErr.message ? uiErr.message : 'erro interno.');
          errBox.classList.remove('hidden');
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🚀 Entrar no Campus 3D';
        }
      }
    });
  }

  let autoFsTriggered = false;
  function onFirstGameGesture(e) {
    if (!appState.currentUser) return;
    if (e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.id === 'btn-fullscreen')) return;
    if (!autoFsTriggered) {
      autoFsTriggered = true;
      requestCampusFullscreen();
    }
  }
  window.addEventListener('touchstart', onFirstGameGesture, { passive: true });
  window.addEventListener('mousedown', onFirstGameGesture, { passive: true });

  bindModalsAndToolbar();
  bindChatAndShortcuts();

  document.addEventListener('visibilitychange', () => {
    if (!appState.currentUser) return;
    if (document.hidden) {
      if (appState.syncTimer) clearInterval(appState.syncTimer);
      appState.syncTimer = setInterval(syncMultiplayer, SYNC_BACKGROUND_INTERVAL_MS);
    } else {
      if (appState.syncTimer) clearInterval(appState.syncTimer);
      syncMultiplayer();
      appState.syncTimer = setInterval(syncMultiplayer, SYNC_INTERVAL_MS);
    }
  });

  window.addEventListener('pagehide', sendLeaveBeacon);
  window.addEventListener('beforeunload', sendLeaveBeacon);

  tryResumeSession();
  if (window.setCampusCinemaLessons) window.setCampusCinemaLessons(LESSONS);
}
