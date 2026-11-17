/**
 * MycoCampus3D — Bootstrap da Aplicação, Bindings de HUD, Chat & Eventos
 */
import { SYNC_BACKGROUND_INTERVAL_MS, SYNC_INTERVAL_MS, getAppVersion } from '../core/constants.js';
import { LESSONS } from '../core/lessons-data.js';
import { appState } from '../core/state.js';
import { apiPost } from '../services/api-client.js';
import { syncMultiplayer, sendLeaveBeacon } from '../services/multiplayer-sync.js';
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
    const qModes = ['auto', 'high', 'medium', 'low', 'min'];
    btnQuality.onclick = (e) => {
      e.stopPropagation();
      if (window.MycoAudio) window.MycoAudio.playClick();
      const cur = window.getCampusQualityState();
      const idx = qModes.indexOf(cur.mode);
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
          if (window.resetCampusWorldObjects) window.resetCampusWorldObjects();
          showAdminNotice('♻️ Todos os itens do laboratório e estantes foram restaurados para as posições originais!');
        } else {
          showAdminNotice((rw && rw.error) || 'Não foi possível resetar os itens.', true);
        }
      } catch (e) {
        showAdminNotice('Erro de conexão ao resetar itens.', true);
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

  // Mobile Chat Toggle
  const chatContainer = $('chat-container');
  const btnChatToggle = $('btn-mobile-chat-toggle');
  const btnChatClose = $('btn-mobile-chat-close');
  const chatInput = $('chat-input');
  if (btnChatToggle && chatContainer) {
    btnChatToggle.onclick = (e) => {
      e.stopPropagation();
      if (window.MycoAudio) window.MycoAudio.playClick();
      chatContainer.classList.add('chat-expanded');
      setTimeout(() => { chatInput?.focus(); }, 60);
    };
  }
  if (btnChatClose && chatContainer) {
    btnChatClose.onclick = (e) => {
      e.stopPropagation();
      chatContainer.classList.remove('chat-expanded');
    };
  }
}

function bindChatAndShortcuts() {
  function submitChatMessage() {
    const inp = $('chat-input');
    if (!inp) return;
    const txt = inp.value.trim();
    if (txt) {
      appState.pendingChatMsg = txt.slice(0, 140);
      inp.value = '';
      syncMultiplayer();
    }
    inp.blur();
    const chatContainer = $('chat-container');
    if (chatContainer && isTouch()) {
      chatContainer.classList.remove('chat-expanded');
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
    chatInput.addEventListener('focus', () => { if (window.clearCampusKeys) window.clearCampusKeys(); });
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
      if (currentHoldLabel.indexOf('Giz') !== -1 || currentHoldLabel.indexOf('chalk') !== -1) {
        actBtn.textContent = '✏️';
        actBtn.title = 'Desenhar na Lousa (segure e arraste o dedo)';
      } else if (currentHoldLabel.indexOf('Apagador') !== -1 || currentHoldLabel.indexOf('eraser') !== -1) {
        actBtn.textContent = '🧽';
        actBtn.title = 'Apagar Lousa (segure e arraste o dedo)';
      } else if (currentHoldLabel.indexOf('Borrifador') !== -1 || currentHoldLabel.indexOf('Álcool') !== -1) {
        actBtn.textContent = '💦';
        actBtn.title = 'Borrifar Álcool';
      } else if (currentHoldLabel.indexOf('Termômetro') !== -1) {
        actBtn.textContent = '🌡️';
        actBtn.title = 'Medir Temperatura';
      } else if (currentHoldLabel.indexOf('Seringa') !== -1) {
        actBtn.textContent = '💉';
        actBtn.title = 'Usar Seringa (segure para aspirar/injetar)';
      } else if (currentHoldLabel.indexOf('Seladora') !== -1) {
        actBtn.textContent = '♨️';
        actBtn.title = 'Selar Bag Preenchido';
      } else if (currentHoverPrompt) {
        actBtn.textContent = getMobileActionIcon(currentHoverPrompt);
        actBtn.title = currentHoverPrompt;
      } else {
        actBtn.textContent = '✋';
        actBtn.title = currentHoldLabel;
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
      const rotBtn = $('btn-mobile-rotate');
      if (rotBtn) rotBtn.style.display = (label && isTouch()) ? 'flex' : 'none';
      const placeBtn = $('btn-mobile-place');
      if (placeBtn) {
        placeBtn.style.display = (label && isTouch()) ? 'flex' : 'none';
        placeBtn.textContent = mobilePlacementModeActive ? '✅' : '📦';
        placeBtn.title = mobilePlacementModeActive
          ? 'Mire e toque no local para confirmar; toque aqui para cancelar'
          : 'Posicionar item';
        placeBtn.classList.toggle('placement-active', mobilePlacementModeActive);
      }
      refreshMobileAction();
    },
    onPlacementModeChange: (active) => {
      mobilePlacementModeActive = active;
      const placeBtn = $('btn-mobile-place');
      if (!placeBtn) return;
      placeBtn.textContent = active ? '✅' : '📦';
      placeBtn.title = active
        ? 'Mire e toque no local para confirmar; toque aqui para cancelar'
        : 'Posicionar item';
      placeBtn.classList.toggle('placement-active', active);
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
      const prefix = info.mode === 'auto' ? `Auto (${tierTxt})` : tierTxt;
      const fpsTxt = info.fps > 0 ? ` • ${info.fps}fps` : '';
      qBtn.textContent = `⚡ ${prefix}${fpsTxt}`;
      qBtn.className = 'px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 font-bold border whitespace-nowrap ' +
        (info.tier === 'min' || info.tier === 'low' ? 'text-amber-300 border-amber-500/40' : 'text-cyan-300 border-cyan-500/40');
    },
    onHoverPrompt: (txt) => {
      currentHoverPrompt = txt || '';
      const pill = $('interact-pill');
      if (pill && Date.now() >= getToastUntil()) {
        // Crachá 3D Diegético exibe os parâmetros e ações no mundo 3D;
        // Mantém a HUD 2D limpa para eliminar sobreposição de texto
        pill.classList.add('hidden');
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
