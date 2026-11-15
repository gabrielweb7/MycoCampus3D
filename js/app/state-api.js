/**
 * MycoCampus 3D — App State & API Client
 * Manages shared application state, DOM helpers, device profile, fullscreen, and authenticated API calls.
 */
(function () {
  'use strict';

  var CFG = window.MycoConfig;

  var App = window.MycoApp || {};

  App.APP_VERSION = window.MYCO_VERSION || 'dev';
  App.SYNC_INTERVAL_MS = CFG.SYNC_INTERVAL_MS || 350;
  App.SYNC_BG_INTERVAL_MS = CFG.SYNC_BG_INTERVAL_MS || 1200;

  App.sessionId = 'mc_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  App.currentUser = null;
  App.authToken = '';
  App.selectedHat = CFG.HAT_COLORS[0];
  App.selectedBody = CFG.BODY_COLORS[0];
  App.currentSlideIdx = 0;
  App.currentPresenter = '';
  App.pendingChatMsg = '';
  App.boardLastId = 0;
  App.syncTimer = null;
  App.syncInFlight = false;
  App.syncQueued = false;
  App.isInitialSync = true;
  App.syncFailures = 0;
  App.inFpsState = false;
  App.adminUsersCache = [];

  App.$ = function (id) {
    return document.getElementById(id);
  };

  App.escapeHtml = function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  App.getDeviceProfile = function () {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var minDim = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    var hasTouch = (navigator.maxTouchPoints || 0) > 0 && (window.innerWidth <= 1380 || minDim <= 1080);
    if (!coarse && !hasTouch) return 'desktop';
    return minDim >= 720 ? 'tablet' : 'phone';
  };

  App.isTouch = function () {
    return App.getDeviceProfile() !== 'desktop';
  };

  App.applyDeviceUi = function () {
    var profile = App.getDeviceProfile();
    document.body.classList.remove('device-desktop', 'device-tablet', 'device-phone');
    document.body.classList.add('device-' + profile);

    var hint = App.$('fps-hint');
    var chatInp = App.$('chat-input');
    if (profile === 'desktop') {
      if (hint) hint.textContent = 'WASD anda • Shift corre • Espaço pula • R gira item • Clique interage • E ou T abre o Chat';
      if (chatInp) chatInp.placeholder = '💬 Aperte E ou T para digitar (Enter envia)...';
    } else if (profile === 'tablet') {
      if (hint) hint.textContent = 'Joystick anda • Arraste para olhar • Toque para interagir • 🔄 gira item';
      if (chatInp) chatInp.placeholder = '💬 Toque para digitar no chat...';
    } else {
      if (hint) hint.textContent = 'Joystick anda • Arraste para olhar • Toque para interagir';
      if (chatInp) chatInp.placeholder = '💬 Escreva no chat...';
    }
  };

  App.showFloatingToast = function (msg) {
    var pill = App.$('interact-pill');
    if (!pill) return;
    pill.textContent = msg;
    pill.classList.remove('hidden');
  };

  App.apiPost = async function (url, payload, withAuth) {
    var data = Object.assign({}, payload || {});
    if (withAuth && App.currentUser) {
      data.user_id = App.currentUser.id;
      if (App.authToken) data.token = App.authToken;
    }
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin'
    });
    var json = await res.json();
    if (res.status === 401 && json && json.auth === false && App.currentUser && App.handleSessionExpired) {
      App.handleSessionExpired(json.error);
    }
    return json;
  };

  App.isFullscreenActive = function () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  };

  App.requestCampusFullscreen = function () {
    try {
      if (App.isFullscreenActive()) return;
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) {
        var p = req.call(el, { navigationUI: 'hide' });
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
      if (App.isTouch() && screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(function () {});
      }
    } catch (e) { /* browser policy */ }
  };

  App.toggleCampusFullscreen = function () {
    try {
      if (App.isFullscreenActive()) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) exit.call(document);
      } else {
        App.requestCampusFullscreen();
      }
    } catch (e) { /* ignore */ }
  };

  window.MycoApp = App;
})();
