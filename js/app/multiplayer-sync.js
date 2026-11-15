/**
 * MycoCampus 3D — Session Lifecycle, Multiplayer Sync & Bootstrap
 */
(function () {
  'use strict';

  var CFG = window.MycoConfig;
  var App = window.MycoApp;
  var $ = App.$;

  App.enterCampus = function (user, token) {
    App.currentUser = user;
    if (token) App.authToken = token;
    App.isInitialSync = true;
    App.requestCampusFullscreen();
    if (window.setCampusPlayerColors) window.setCampusPlayerColors(user.hat_color, user.body_color);
    $('input-pin').value = '';
    App.updateUserHud();
    $('campus-lobby').classList.add('hidden');
    $('campus-hud').classList.remove('hidden');
    window.setCampusFpsMode(true);
    setTimeout(function () { $('fps-hint').classList.add('faded'); }, 4000);
    if (App.syncTimer) clearInterval(App.syncTimer);
    App.syncMultiplayer();
    App.syncTimer = setInterval(App.syncMultiplayer, App.SYNC_INTERVAL_MS);
  };

  App.tryResumeSession = async function () {
    var params = new URLSearchParams(window.location.search);
    var urlName = (params.get('campus_name') || '').trim();
    var urlPin = params.get('campus_pin') || '';
    if (urlName || urlPin || params.has('_v')) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) { /* ignore */ }
    }
    try {
      var res = await fetch('api/auth.php?action=me', { credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) {
        var data = await res.json();
        if (data.ok && data.user) {
          App.enterCampus(data.user, '');
          return;
        }
      }
    } catch (e) { /* continue */ }
    if (urlName.length >= 2 && urlPin.length >= 4) {
      try {
        var loginData = await App.apiPost('api/auth.php?action=login', {
          display_name: urlName,
          pin: urlPin,
          hat_color: App.selectedHat,
          body_color: App.selectedBody
        });
        if (loginData.ok && loginData.user) {
          App.enterCampus(loginData.user, loginData.token || '');
        }
      } catch (e) { /* stay in lobby */ }
    }
  };

  App.logoutCampus = async function () {
    if (App.syncTimer) clearInterval(App.syncTimer);
    App.syncTimer = null;
    var lastName = App.currentUser ? App.currentUser.display_name : '';
    try {
      await App.apiPost('api/multiplayer.php?action=leave', { session_id: App.sessionId }, true);
      await App.apiPost('api/auth.php?action=logout', {}, true);
    } catch (e) { /* silent */ }
    App.currentUser = null;
    App.authToken = '';
    window.updateCampusPlayers([]);
    window.setCampusFpsMode(false);
    $('campus-hud').classList.add('hidden');
    $('lesson-modal').classList.add('hidden');
    $('ranking-modal').classList.add('hidden');
    var adminEl = $('admin-modal');
    if (adminEl) adminEl.classList.add('hidden');
    $('campus-lobby').classList.remove('hidden');
    if (lastName) $('input-name').value = lastName;
    var btn = $('btn-enter-campus');
    btn.disabled = false;
    btn.textContent = '🚀 Entrar no Campus 3D';
  };

  App.handleSessionExpired = function (msg) {
    if (App.syncTimer) clearInterval(App.syncTimer);
    App.syncTimer = null;
    App.currentUser = null;
    App.authToken = '';
    window.updateCampusPlayers([]);
    window.setCampusFpsMode(false);
    $('campus-hud').classList.add('hidden');
    $('lesson-modal').classList.add('hidden');
    $('ranking-modal').classList.add('hidden');
    var adminEl = $('admin-modal');
    if (adminEl) adminEl.classList.add('hidden');
    $('campus-lobby').classList.remove('hidden');
    var btn = $('btn-enter-campus');
    btn.disabled = false;
    btn.textContent = '🚀 Entrar no Campus 3D';
    var errBox = $('lobby-error');
    errBox.textContent = msg || 'Sessão expirada. Entre novamente.';
    errBox.classList.remove('hidden');
  };

  App.harvestMushroom = async function (mushId) {
    if (!App.currentUser) return;
    try {
      var data = await App.apiPost('api/auth.php?action=harvest', { mushroom_id: mushId || '' }, true);
      if (data.ok && data.user) {
        App.currentUser = data.user;
        App.updateUserHud();
      }
    } catch (e) { /* silent */ }
  };

  App.harvestGreenhouseSlot = async function (slot) {
    if (!App.currentUser) return;
    try {
      var data = await App.apiPost('api/auth.php?action=harvest_greenhouse', { slot_id: slot.id }, true);
      if (data.ok && data.user) {
        App.currentUser = data.user;
        App.updateUserHud();
        App.showFloatingToast('🍄 +50 XP e +2 Cogumelos colhidos na Estufa!');
      }
    } catch (e) { /* silent */ }
  };

  App.completeModule = async function (slug, answerText) {
    if (!App.currentUser) return;
    try {
      var data = await App.apiPost('api/auth.php?action=complete_module', { module: slug, answer: answerText || '' }, true);
      if (data.ok && data.user) {
        App.currentUser = data.user;
        App.updateUserHud();
      }
    } catch (e) { /* silent */ }
  };

  App.syncMultiplayer = async function () {
    if (!App.currentUser) return;
    if (App.syncInFlight) {
      App.syncQueued = true;
      return;
    }
    App.syncInFlight = true;
    App.syncQueued = false;
    var firstSync = App.isInitialSync;
    App.isInitialSync = false;
    var pose = window.getCampusPlayerPose();
    var moved = window.consumeCampusMovedItems();
    var strokes = window.consumeCampusBoardStrokes ? window.consumeCampusBoardStrokes() : [];
    var stateChanges = window.consumeCampusStateChanges ? window.consumeCampusStateChanges() : {};
    var chatToSend = App.pendingChatMsg;
    App.pendingChatMsg = '';

    try {
      var data = await App.apiPost('api/multiplayer.php?action=sync', {
        session_id: App.sessionId,
        init_sync: firstSync ? 1 : 0,
        x: pose.x,
        y: pose.y,
        z: pose.z,
        yaw: pose.yaw,
        pitch: pose.pitch,
        holding_item: pose.holding_item,
        walking: pose.walking,
        seated: pose.seated,
        in_fps: pose.in_fps,
        current_hat: pose.current_hat || 'default',
        emote: pose.emote || '',
        chat_msg: chatToSend,
        moved_items: moved,
        state_changes: stateChanges,
        board_since: App.boardLastId,
        board_strokes: strokes
      }, true);
      if (data && data.kicked) {
        if (App.syncTimer) clearInterval(App.syncTimer);
        App.syncTimer = null;
        alert(data.error || 'Você foi desconectado pelo Administrador.');
        window.location.reload();
        return;
      }
      if (data.ok) {
        App.syncFailures = 0;
        if (data.force_teleport && window.teleportCampusPlayer) {
          window.teleportCampusPlayer(
            data.force_teleport.x,
            data.force_teleport.y,
            data.force_teleport.z,
            data.force_teleport.yaw
          );
          App.showFloatingToast('🧲 Você foi teletransportado pelo Administrador Master!');
        }
        if (data.app_version && window.MYCO_VERSION && data.app_version !== window.MYCO_VERSION && !window._reloadingVersion) {
          var lastReloadInfo = '';
          try { lastReloadInfo = sessionStorage.getItem('myco_reload_guard') || ''; } catch (e) { }
          var parts = lastReloadInfo.split('|');
          var guardedVer = parts[0];
          var guardedAt = Number(parts[1] || 0);
          if (guardedVer !== data.app_version || (Date.now() - guardedAt) > 30000) {
            window._reloadingVersion = true;
            try { sessionStorage.setItem('myco_reload_guard', data.app_version + '|' + Date.now()); } catch (e) { }
            App.showFloatingToast('🔄 Nova versão v' + data.app_version + ' disponível! Atualizando...');
            setTimeout(function () {
              var base = window.location.pathname || '/';
              window.location.replace(base + '?_v=' + encodeURIComponent(data.app_version));
            }, 1500);
            return;
          }
        }
        $('hud-online').textContent = String(data.online_count || 1);
        window.applyCampusWorldObjects(data.objects || {});
        if (data.world_state && window.applyCampusWorldState) {
          window.applyCampusWorldState(data.world_state, firstSync);
        }
        if (firstSync && data.saved_pose && window.applyCampusSavedPose) {
          window.applyCampusSavedPose(data.saved_pose);
        }
        window.updateCampusPlayers(data.players || []);
        if (typeof data.board_last_id === 'number' && data.board_last_id > App.boardLastId) {
          App.boardLastId = data.board_last_id;
        }
        if (data.board_strokes && data.board_strokes.length && window.applyCampusBoardStrokes) {
          window.applyCampusBoardStrokes(data.board_strokes);
        }
        if (data.world_state && typeof data.world_state.auditorium_slide === 'number') {
          if (data.world_state.auditorium_slide !== App.currentSlideIdx ||
            (data.world_state.auditorium_presenter || '') !== App.currentPresenter) {
            App.applySlideTo3D(data.world_state.auditorium_slide, data.world_state.auditorium_presenter || '');
          }
        }
      } else if (data.auth !== false) {
        throw new Error(data.error || 'sync');
      }
    } catch (e) {
      App.syncFailures++;
      if (firstSync) App.isInitialSync = true;
      if (chatToSend && !App.pendingChatMsg) App.pendingChatMsg = chatToSend;
      if (moved && moved.length) window.requeueCampusMovedItems(moved);
      if (strokes && strokes.length && window.requeueCampusBoardStrokes) window.requeueCampusBoardStrokes(strokes);
      if (stateChanges && window.requeueCampusStateChanges) window.requeueCampusStateChanges(stateChanges);
    } finally {
      App.syncInFlight = false;
      if (App.syncQueued) {
        App.syncMultiplayer();
      }
    }
  };

  App.boot = function () {
    App.applyDeviceUi();
    window.addEventListener('resize', App.applyDeviceUi);
    window.addEventListener('orientationchange', App.applyDeviceUi);
    App.renderSwatches();
    App.setupMobileJoystick();
    App.loadLobbyStats();
    setInterval(App.loadLobbyStats, 20000);
    var verEl = $('app-version');
    if (verEl) verEl.textContent = 'v' + App.APP_VERSION;
    if (window.location.search.indexOf('preview=1') !== -1) {
      $('campus-lobby').classList.add('hidden');
    }

    window.initCampus3D('campus-canvas-wrap', {
      onHarvestMushroom: function (mushId) {
        App.harvestMushroom(mushId);
      },
      onHarvestGreenhouse: function (slot) {
        App.harvestGreenhouseSlot(slot);
      },
      onOpenLessons: function () {
        App.renderLessonsModal();
        $('lesson-modal').classList.remove('hidden');
      },
      onScreenNav: function (delta) {
        if (App.currentUser) {
          App.broadcastSlide(App.currentSlideIdx + delta);
        }
      },
      onWorldAction: function () {
        App.syncMultiplayer();
      },
      onNearScreen: function () {
        var tb = $('prof-toolbar');
        if (tb) tb.classList.add('hidden');
      },
      onHoldChange: function (label) {
        var rotBtn = $('btn-mobile-rotate');
        if (rotBtn) rotBtn.style.display = (label && App.isTouch()) ? 'flex' : 'none';
        var actBtn = $('btn-mobile-action');
        if (actBtn) {
          if (label && (label.indexOf('Giz') !== -1 || label.indexOf('chalk') !== -1)) {
            actBtn.style.display = App.isTouch() ? 'flex' : 'none';
            actBtn.textContent = '✏️';
            actBtn.title = 'Desenhar na Lousa (segure e arraste o dedo para pintar)';
          } else if (label && (label.indexOf('Apagador') !== -1 || label.indexOf('eraser') !== -1)) {
            actBtn.style.display = App.isTouch() ? 'flex' : 'none';
            actBtn.textContent = '🧽';
            actBtn.title = 'Apagar Lousa (segure e arraste o dedo para apagar)';
          } else {
            actBtn.style.display = 'none';
          }
        }
      },
      onFpsChange: App.updateFpsUi,
      onHoverPrompt: function (txt) {
        var pill = $('interact-pill');
        if (App.getDeviceProfile() === 'phone') {
          pill.classList.add('hidden');
        } else if (txt && App.currentUser) {
          pill.textContent = txt;
          pill.classList.remove('hidden');
        } else if (pill) {
          pill.classList.add('hidden');
        }
        var actBtn = $('btn-mobile-action');
        if (actBtn && (!window.getCampusPlayerPose || !window.getCampusPlayerPose().holding_item)) {
          actBtn.style.display = 'none';
        }
      }
    });

    $('lobby-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      App.requestCampusFullscreen();
      var errBox = $('lobby-error');
      errBox.classList.add('hidden');
      var btn = $('btn-enter-campus');
      btn.disabled = true;
      btn.textContent = 'Entrando no campus...';

      try {
        var data = await App.apiPost('api/auth.php?action=login', {
          display_name: $('input-name').value.trim(),
          pin: $('input-pin').value,
          hat_color: App.selectedHat,
          body_color: App.selectedBody
        });
        if (!data.ok) {
          errBox.textContent = data.error || 'Erro ao autenticar.';
          errBox.classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = '🚀 Entrar no Campus 3D';
          return;
        }
        App.enterCampus(data.user, data.token || '');
      } catch (err) {
        errBox.textContent = 'Falha ao conectar com o servidor. Tente novamente em instantes.';
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '🚀 Entrar no Campus 3D';
      }
    });

    var autoFsTriggered = false;
    function onFirstGameGesture(e) {
      if (!App.currentUser) return;
      if (e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.id === 'btn-fullscreen')) return;
      if (!autoFsTriggered) {
        autoFsTriggered = true;
        App.requestCampusFullscreen();
      }
    }
    window.addEventListener('touchstart', onFirstGameGesture, { passive: true });
    window.addEventListener('mousedown', onFirstGameGesture, { passive: true });

    var fsBtn = $('btn-fullscreen');
    if (fsBtn) {
      fsBtn.onclick = function (e) {
        e.stopPropagation();
        App.toggleCampusFullscreen();
      };
    }

    $('btn-toggle-fps').onclick = function () { window.setCampusFpsMode(!App.inFpsState); };
    $('btn-logout').onclick = App.logoutCampus;
    $('btn-open-lessons').onclick = function () { App.renderLessonsModal(); $('lesson-modal').classList.remove('hidden'); };
    $('btn-close-lessons').onclick = function () { $('lesson-modal').classList.add('hidden'); };
    $('btn-open-ranking').onclick = App.openRankingModal;
    $('btn-close-ranking').onclick = function () { $('ranking-modal').classList.add('hidden'); };
    $('btn-slide-prev').onclick = function () { App.broadcastSlide(App.currentSlideIdx - 1); };
    $('btn-slide-next').onclick = function () { App.broadcastSlide(App.currentSlideIdx + 1); };

    var btnShop = $('btn-open-shop');
    if (btnShop) {
      btnShop.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        App.renderShopModal();
        $('shop-modal').classList.remove('hidden');
      };
    }
    var btnCloseShop = $('btn-close-shop');
    if (btnCloseShop) {
      btnCloseShop.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        $('shop-modal').classList.add('hidden');
      };
    }

    var btnEmotes = $('btn-open-emotes');
    if (btnEmotes) {
      btnEmotes.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        var eb = $('emote-bar');
        if (eb) eb.classList.toggle('hidden');
      };
    }
    var btnCloseEmotes = $('btn-close-emotes');
    if (btnCloseEmotes) {
      btnCloseEmotes.onclick = function () {
        var eb = $('emote-bar');
        if (eb) eb.classList.add('hidden');
      };
    }
    document.querySelectorAll('.emote-btn').forEach(function (btn) {
      btn.onclick = function () {
        var em = btn.getAttribute('data-emote');
        if (em && window.playCampusEmote) {
          window.playCampusEmote(em);
        }
      };
    });

    var audioBtn = $('btn-toggle-audio');
    if (audioBtn) {
      audioBtn.textContent = (window.MycoAudio && window.MycoAudio.isMuted()) ? '🔇' : '🔊';
      audioBtn.onclick = function () {
        if (window.MycoAudio) {
          var muted = window.MycoAudio.toggleMute();
          audioBtn.textContent = muted ? '🔇' : '🔊';
        }
      };
    }

    var btnOpenAdmin = $('btn-open-admin');
    if (btnOpenAdmin) btnOpenAdmin.onclick = App.openAdminModal;
    var btnCloseAdmin = $('btn-close-admin');
    if (btnCloseAdmin) btnCloseAdmin.onclick = App.closeAdminModal;
    var btnRefreshAdmin = $('btn-admin-refresh');
    if (btnRefreshAdmin) btnRefreshAdmin.onclick = App.loadAdminUsers;
    var searchAdminInput = $('admin-search-input');
    if (searchAdminInput) {
      searchAdminInput.addEventListener('input', function () {
        App.renderAdminUsers(App.adminUsersCache);
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (!App.currentUser) return;
      if (document.hidden) {
        if (App.syncTimer) clearInterval(App.syncTimer);
        App.syncTimer = setInterval(App.syncMultiplayer, App.SYNC_BG_INTERVAL_MS);
      } else {
        if (App.syncTimer) clearInterval(App.syncTimer);
        App.syncMultiplayer();
        App.syncTimer = setInterval(App.syncMultiplayer, App.SYNC_INTERVAL_MS);
      }
    });

    $('btn-reset-lab').onclick = async function () {
      window.resetCampusWorldObjects();
      try { await App.apiPost('api/multiplayer.php?action=reset_world', {}, true); } catch (e) { /* silent */ }
    };

    function submitChatMessage() {
      var inp = $('chat-input');
      if (!inp) return;
      var txt = inp.value.trim();
      if (txt) {
        App.pendingChatMsg = txt.slice(0, 140);
        inp.value = '';
        App.syncMultiplayer();
      }
      inp.blur();
    }

    $('chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitChatMessage();
    });

    $('chat-input').addEventListener('focus', function () {
      if (window.clearCampusKeys) window.clearCampusKeys();
    });

    $('chat-input').addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.blur();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitChatMessage();
      }
    });

    window.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code !== 'KeyE' && e.code !== 'KeyT' && e.code !== 'Enter') return;
      var active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      var lobbyEl = $('campus-lobby');
      if (lobbyEl && !lobbyEl.classList.contains('hidden')) return;
      var lessonEl = $('lesson-modal');
      if (lessonEl && !lessonEl.classList.contains('hidden')) return;
      var rankEl = $('ranking-modal');
      if (rankEl && !rankEl.classList.contains('hidden')) return;
      var inp = $('chat-input');
      if (!inp) return;
      e.preventDefault();
      if (window.clearCampusKeys) window.clearCampusKeys();
      inp.focus();
      setTimeout(function () { if (document.activeElement !== inp) inp.focus(); }, 15);
    });

    function sendLeave() {
      if (App.currentUser && navigator.sendBeacon) {
        var body = { session_id: App.sessionId, user_id: App.currentUser.id };
        if (App.authToken) body.token = App.authToken;
        navigator.sendBeacon('api/multiplayer.php?action=leave', JSON.stringify(body));
      }
    }
    window.addEventListener('pagehide', sendLeave);
    window.addEventListener('beforeunload', sendLeave);

    App.tryResumeSession();
    if (window.setCampusCinemaLessons) window.setCampusCinemaLessons(CFG.LESSONS);
  };

  document.addEventListener('DOMContentLoaded', App.boot);
})();
