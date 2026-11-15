/**
 * MycoCampus3D — Aplicação Principal, Autenticação MySQL, Aulas & Multiplayer
 * Zero localStorage para perfil/progresso: tudo sincronizado com MySQL.
 */
(function () {
  'use strict';

  var HAT_COLORS = ['#dc2626', '#d97706', '#9333ea', '#059669', '#2563eb', '#db2777'];
  var BODY_COLORS = ['#4f46e5', '#0f766e', '#1e293b', '#b45309', '#be185d', '#334155'];

  var LESSONS = [
    {
      slug: 'fluxo_laminar',
      title: 'Fluxo Laminar & Técnica Asséptica',
      subtitle: 'Módulo 1 • Trabalho Limpo em Laboratório',
      bullets: [
        '• Filtro HEPA H14 retém 99,995% das partículas (>= 0,3 µm).',
        '• Nunca passe a mão entre o filtro e a placa aberta.',
        '• Higienize bancada com Álcool 70% e flambe o bisturi fora do fluxo.'
      ],
      question: 'Qual a regra de ouro ao trabalhar na cabine de fluxo laminar?',
      options: [
        { text: 'Nunca bloquear a linha reta entre o filtro HEPA e o material estéril', ok: true },
        { text: 'Usar ventilador comum virado para a placa aberta', ok: false },
        { text: 'Flambar o bisturi com álcool dentro da placa de Petri', ok: false }
      ]
    },
    {
      slug: 'esterilizacao',
      title: 'Esterilização vs Pasteurização',
      subtitle: 'Módulo 2 • Autoclave & Panela de Pressão',
      bullets: [
        '• Esterilização (121°C / 15 PSI por 60-90 min): elimina 100% dos esporos em grãos/ágar.',
        '• Pasteurização (65°C - 80°C por 60 min): reduz competidores em palha/coco mantendo microflora benéfica.',
        '• Nunca esterilize substrato bulk rico se for frutificar em ambiente não-estéril.'
      ],
      question: 'Qual temperatura/pressão padrão esteriliza potes de grãos e meios BDA na autoclave?',
      options: [
        { text: '121°C a 15 PSI (1 atm acima da pressão ambiente)', ok: true },
        { text: '50°C por 10 minutos sem pressão', ok: false },
        { text: 'Congelamento a -18°C por 24 horas', ok: false }
      ]
    },
    {
      slug: 'spawn_graos',
      title: 'Grãos, Spawn & Cultura Líquida (CL)',
      subtitle: 'Módulo 3 • Propagação de Micélio',
      bullets: [
        '• Grãos (aveia, milho, sorgo, centeio) dão energia e muitos pontos de inoculação.',
        '• Hidrate e seque superficialmente os grãos antes de autoclavar (evita wet spot).',
        '• Cultura Líquida (4% mel/malte) acelera a colonização, mas exige teste prévio em ágar!'
      ],
      question: 'Por que devemos testar a Cultura Líquida em placa de Petri (ágar) antes de inocular vários potes?',
      options: [
        { text: 'Para confirmar que o micélio está puro e sem contaminação invisível', ok: true },
        { text: 'Para mudar a cor do cogumelo na colheita', ok: false },
        { text: 'Não precisa testar, cultura líquida nunca contamina', ok: false }
      ]
    },
    {
      slug: 'contaminacao',
      title: 'Identificando Contaminações',
      subtitle: 'Módulo 4 • Tricoderma, Cobweb & Bactérias',
      bullets: [
        '• Tricoderma: começa branco denso e fica verde-esmeralda ao esporular. Isole fora do lab!',
        '• Cobweb (teia): cinza algodonoso crescendo muito rápido por cima; sensível a H2O2 3%.',
        '• Bactéria (Wet Spot): grãos melados/úmidos com cheiro ácido/fermentado.'
      ],
      question: 'O que fazer imediatamente ao encontrar uma placa ou pote com esporos verdes de Tricoderma?',
      options: [
        { text: 'Manter fechado e remover do laboratório para não espalhar esporos', ok: true },
        { text: 'Abrir dentro do fluxo laminar e assoprar para limpar', ok: false },
        { text: 'Misturar com os potes saudáveis para o micélio vencer', ok: false }
      ]
    },
    {
      slug: 'frutificacao',
      title: 'Substratos, Bulk & Frutificação',
      subtitle: 'Módulo 5 • Gatilhos de Pinagem (FAE, Umidade & Luz)',
      bullets: [
        '• Misture spawn 100% colonizado com substrato bulk (fibra de coco + vermiculita) na proporção 1:2 a 1:4.',
        '• Gatilhos de pinagem: queda leve de CO2 (troca gasosa/FAE), evaporação superficial e luz indireta.',
        '• Mantenha umidade relativa entre 85% e 95% sem encharcar os pins.'
      ],
      question: 'Quais são os principais gatilhos ambientais para induzir a formação de primórdios (pins)?',
      options: [
        { text: 'Troca gasosa fresca (redução de CO2), evaporação na superfície e luz ambiente', ok: true },
        { text: 'Escuridão total e lacrar a caixa sem entrada de ar', ok: false },
        { text: 'Aquecer a estufa para 40°C constantes', ok: false }
      ]
    }
  ];

  var APP_VERSION = window.MYCO_VERSION || 'dev';
  var SYNC_INTERVAL_MS = 200;

  var sessionId = 'mc_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  var currentUser = null;
  var authToken = '';
  var selectedHat = HAT_COLORS[0];
  var selectedBody = BODY_COLORS[0];
  var currentSlideIdx = 0;
  var currentPresenter = '';
  var pendingChatMsg = '';
  var boardLastId = 0;
  var syncTimer = null;
  var syncInFlight = false;
  var syncQueued = false;
  var isInitialSync = true;
  var syncFailures = 0;
  var inFpsState = false;

  function $(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDeviceProfile() {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var minDim = Math.min(window.innerWidth || 0, window.innerHeight || 0);
    var hasTouch = (navigator.maxTouchPoints || 0) > 0 && (window.innerWidth <= 1380 || minDim <= 1080);
    if (!coarse && !hasTouch) return 'desktop';
    return minDim >= 720 ? 'tablet' : 'phone';
  }

  function isTouch() {
    return getDeviceProfile() !== 'desktop';
  }

  function applyDeviceUi() {
    var profile = getDeviceProfile();
    document.body.classList.remove('device-desktop', 'device-tablet', 'device-phone');
    document.body.classList.add('device-' + profile);

    var hint = $('fps-hint');
    var chatInp = $('chat-input');
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
  }

  function showFloatingToast(msg) {
    var pill = $('interact-pill');
    if (!pill) return;
    pill.textContent = msg;
    pill.classList.remove('hidden');
  }

  function renderSwatches() {
    var hatWrap = $('hat-swatches');
    var bodyWrap = $('body-swatches');
    hatWrap.innerHTML = '';
    bodyWrap.innerHTML = '';

    HAT_COLORS.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch-btn' + (hex === selectedHat ? ' active' : '');
      b.style.backgroundColor = hex;
      b.onclick = function () { selectedHat = hex; renderSwatches(); };
      hatWrap.appendChild(b);
    });

    BODY_COLORS.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch-btn' + (hex === selectedBody ? ' active' : '');
      b.style.backgroundColor = hex;
      b.onclick = function () { selectedBody = hex; renderSwatches(); };
      bodyWrap.appendChild(b);
    });
  }

  function updateUserHud() {
    if (!currentUser) return;
    $('hud-name').textContent = currentUser.display_name;
    $('hud-xp').textContent = String(currentUser.xp || 0);
    $('hud-mushrooms').textContent = String(currentUser.mushrooms_harvested || 0);
    $('hud-modules').textContent = String((currentUser.completed_modules || []).length);

    var isMaster = currentUser.role === 'admin' && currentUser.username === 'gabrieldaluz';
    var isProf = currentUser.role === 'professor' || isMaster;
    var isMod = currentUser.role === 'moderator';

    var badge = $('hud-role-badge');
    if (isMaster) {
      badge.textContent = '👑 Master Admin';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-amber-500/30 text-amber-300 border border-amber-400/50 shadow-sm';
    } else if (currentUser.role === 'professor') {
      badge.textContent = '👨‍🏫 Professor';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-amber-500/25 text-amber-300 border border-amber-400/40';
    } else if (isMod) {
      badge.textContent = '🛡️ Moderador';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-sky-500/25 text-sky-300 border border-sky-400/40';
    } else {
      badge.textContent = '🎓 Aluno';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
    }

    var rLab = $('btn-reset-lab');
    if (rLab) rLab.classList.toggle('hidden', !isProf);
    var pBar = $('prof-toolbar');
    if (pBar) pBar.classList.toggle('hidden', !isProf);
    var btnAdmin = $('btn-open-admin');
    if (btnAdmin) btnAdmin.classList.toggle('hidden', !isMaster);
  }

  async function apiPost(url, payload, withAuth) {
    var data = Object.assign({}, payload || {});
    if (withAuth && currentUser) {
      data.user_id = currentUser.id;
      if (authToken) data.token = authToken;
    }
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'same-origin'
    });
    var json = await res.json();
    if (res.status === 401 && json && json.auth === false && currentUser) {
      handleSessionExpired(json.error);
    }
    return json;
  }

  function isFullscreenActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }

  function requestCampusFullscreen() {
    try {
      if (isFullscreenActive()) return;
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) {
        var p = req.call(el, { navigationUI: 'hide' });
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
      if (isTouch() && screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(function () {});
      }
    } catch (e) { /* browser policy */ }
  }

  function toggleCampusFullscreen() {
    try {
      if (isFullscreenActive()) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) exit.call(document);
      } else {
        requestCampusFullscreen();
      }
    } catch (e) { /* ignore */ }
  }

  function enterCampus(user, token) {
    currentUser = user;
    if (token) authToken = token;
    isInitialSync = true;
    requestCampusFullscreen();
    if (window.setCampusPlayerColors) window.setCampusPlayerColors(user.hat_color, user.body_color);
    $('input-pin').value = '';
    updateUserHud();
    $('campus-lobby').classList.add('hidden');
    $('campus-hud').classList.remove('hidden');
    window.setCampusFpsMode(true);
    setTimeout(function () { $('fps-hint').classList.add('faded'); }, 4000);
    if (syncTimer) clearInterval(syncTimer);
    syncMultiplayer();
    syncTimer = setInterval(syncMultiplayer, SYNC_INTERVAL_MS);
  }

  async function tryResumeSession() {
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
          enterCampus(data.user, '');
          return;
        }
      }
    } catch (e) { /* segue */ }
    if (urlName.length >= 2 && urlPin.length >= 4) {
      try {
        var loginData = await apiPost('api/auth.php?action=login', {
          display_name: urlName,
          pin: urlPin,
          hat_color: selectedHat,
          body_color: selectedBody
        });
        if (loginData.ok && loginData.user) {
          enterCampus(loginData.user, loginData.token || '');
        }
      } catch (e) { /* segue no lobby */ }
    }
  }

  async function logoutCampus() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    var lastName = currentUser ? currentUser.display_name : '';
    try {
      await apiPost('api/multiplayer.php?action=leave', { session_id: sessionId }, true);
      await apiPost('api/auth.php?action=logout', {}, true);
    } catch (e) { /* silent */ }
    currentUser = null;
    authToken = '';
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
  }

  function handleSessionExpired(msg) {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    currentUser = null;
    authToken = '';
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
  }

  async function loadLobbyStats() {
    try {
      var res = await fetch('api/auth.php?action=leaderboard', { cache: 'no-store' });
      var data = await res.json();
      if (data.ok && data.stats) {
        $('lobby-stats').textContent =
          '🟢 Online • ' + data.stats.total_users + ' estudantes • ' +
          data.stats.total_xp + ' XP acumulados • ' + data.stats.total_harvests + ' cogus colhidos';
      } else {
        $('lobby-stats').textContent = data.error || 'Aguardando configuração do MySQL.';
      }
      if (data.ok && Array.isArray(data.leaders) && window.updateCampusRanking) {
        window.updateCampusRanking(data.leaders);
      }
    } catch (err) {
      $('lobby-stats').textContent = 'Servidor offline no momento. Tente novamente em instantes.';
    }
  }

  async function harvestMushroom(mushId) {
    if (!currentUser) return;
    try {
      var data = await apiPost('api/auth.php?action=harvest', { mushroom_id: mushId || '' }, true);
      if (data.ok && data.user) {
        currentUser = data.user;
        updateUserHud();
      }
    } catch (e) { /* silent */ }
  }

  async function completeModule(slug, answerText) {
    if (!currentUser) return;
    try {
      var data = await apiPost('api/auth.php?action=complete_module', { module: slug, answer: answerText || '' }, true);
      if (data.ok && data.user) {
        currentUser = data.user;
        updateUserHud();
      }
    } catch (e) { /* silent */ }
  }

  function applySlideTo3D(idx, presenter) {
    var s = LESSONS[idx] || LESSONS[0];
    currentSlideIdx = idx;
    currentPresenter = presenter || '';
    $('prof-slide-label').textContent = 'Slide ' + (idx + 1) + '/' + LESSONS.length;
    window.updateCampusAuditoriumSlide(idx, s.title, s.subtitle, s.bullets, presenter);
  }

  function renderLessonsModal() {
    var body = $('lessons-body');
    body.innerHTML = '';
    var doneList = (currentUser && currentUser.completed_modules) || [];
    var isProf = currentUser && (currentUser.role === 'professor' || currentUser.role === 'admin');

    LESSONS.forEach(function (lesson, idx) {
      var isDone = doneList.indexOf(lesson.slug) !== -1;
      var card = document.createElement('div');
      card.className = 'rounded-xl bg-slate-900/75 border ' + (isDone ? 'border-emerald-500/50' : 'border-slate-700/70') + ' p-4 space-y-2.5';

      var header = document.createElement('div');
      header.className = 'flex items-center justify-between gap-2';
      header.innerHTML =
        '<div><div class="font-bold text-white">' + (idx + 1) + '. ' + escapeHtml(lesson.title) + '</div>' +
        '<div class="text-xs text-slate-400">' + escapeHtml(lesson.subtitle) + '</div></div>' +
        '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ' +
        (isDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300') + '">' +
        (isDone ? '✅ Concluído' : '+50 XP') + '</span>';
      card.appendChild(header);

      var ul = document.createElement('div');
      ul.className = 'text-xs text-slate-300 space-y-1';
      ul.innerHTML = lesson.bullets.map(function (b) { return '<div>' + escapeHtml(b) + '</div>'; }).join('');
      card.appendChild(ul);

      if (isProf) {
        var projBtn = document.createElement('button');
        projBtn.type = 'button';
        projBtn.className = 'px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-300 text-xs font-bold';
        projBtn.textContent = '📺 Projetar este Slide no Auditório 3D';
        projBtn.onclick = function () { broadcastSlide(idx); };
        card.appendChild(projBtn);
      }

      var qBox = document.createElement('div');
      qBox.className = 'pt-2 border-t border-slate-800 space-y-1.5';
      var qTitle = document.createElement('div');
      qTitle.className = 'text-xs font-semibold text-sky-300';
      qTitle.textContent = 'Desafio Prático: ' + lesson.question;
      qBox.appendChild(qTitle);

      var feedback = document.createElement('div');
      feedback.className = 'text-xs font-semibold hidden';

      lesson.options.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full text-left px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition';
        btn.textContent = opt.text;
        btn.onclick = function () {
          feedback.classList.remove('hidden');
          if (opt.ok) {
            feedback.className = 'text-xs font-bold text-emerald-300 pt-1';
            feedback.textContent = isDone ? '✅ Correto! Módulo já concluído.' : '🎉 Correto! +50 XP salvos no seu perfil!';
            if (!isDone) {
              completeModule(lesson.slug, opt.text).then(renderLessonsModal);
            }
          } else {
            feedback.className = 'text-xs font-bold text-rose-300 pt-1';
            feedback.textContent = '❌ Tente novamente! Revise os pontos acima.';
          }
        };
        qBox.appendChild(btn);
      });
      qBox.appendChild(feedback);
      card.appendChild(qBox);
      body.appendChild(card);
    });
  }

  async function openRankingModal() {
    $('ranking-modal').classList.remove('hidden');
    var body = $('ranking-body');
    body.innerHTML = '<div class="text-slate-400">Carregando ranking...</div>';
    try {
      var res = await fetch('api/auth.php?action=leaderboard', { cache: 'no-store' });
      var data = await res.json();
      if (!data.ok) {
        body.innerHTML = '<div class="text-rose-300">' + escapeHtml(data.error || 'Erro ao carregar') + '</div>';
        return;
      }
      var totalModules = data.total_modules || LESSONS.length;
      body.innerHTML = '';
      if (!(data.leaders || []).length) {
        body.innerHTML = '<div class="text-slate-400">Nenhum estudante ainda. Seja o primeiro! 🍄</div>';
      }
      (data.leaders || []).forEach(function (u, i) {
        var row = document.createElement('div');
        var isMe = currentUser && u.id === currentUser.id;
        row.className = 'flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border ' + (isMe ? 'border-emerald-400/30' : 'border-slate-800');
        var roleTag = (u.role === 'professor' || u.role === 'admin') ? '👨‍🏫 ' : '🎓 ';
        row.innerHTML =
          '<div class="flex items-center gap-2"><span class="font-extrabold text-amber-300 w-5">#' + (i + 1) + '</span>' +
          '<span class="font-bold text-white">' + roleTag + escapeHtml(u.display_name) + '</span></div>' +
          '<div class="flex items-center gap-3 text-slate-300">' +
          '<span>📚 ' + (u.completed_modules || []).length + '/' + totalModules + '</span>' +
          '<span>🍄 ' + (parseInt(u.mushrooms_harvested, 10) || 0) + '</span>' +
          '<span class="font-extrabold text-emerald-300">⭐ ' + (parseInt(u.xp, 10) || 0) + ' XP</span></div>';
        body.appendChild(row);
      });
    } catch (e) {
      body.innerHTML = '<div class="text-rose-300">Erro de conexão com o servidor.</div>';
    }
  }

  async function broadcastSlide(newIdx) {
    var clamped = ((newIdx % LESSONS.length) + LESSONS.length) % LESSONS.length;
    applySlideTo3D(clamped, currentUser ? currentUser.display_name : '');
    if (!currentUser) return;
    try {
      await apiPost('api/multiplayer.php?action=set_slide', { slide_index: clamped }, true);
    } catch (e) { /* silent */ }
  }

  async function syncMultiplayer() {
    if (!currentUser) return;
    if (syncInFlight) {
      syncQueued = true;
      return;
    }
    syncInFlight = true;
    syncQueued = false;
    var firstSync = isInitialSync;
    isInitialSync = false;
    var pose = window.getCampusPlayerPose();
    var moved = window.consumeCampusMovedItems();
    var strokes = window.consumeCampusBoardStrokes ? window.consumeCampusBoardStrokes() : [];
    var stateChanges = window.consumeCampusStateChanges ? window.consumeCampusStateChanges() : {};
    var chatToSend = pendingChatMsg;
    pendingChatMsg = '';

    try {
      var data = await apiPost('api/multiplayer.php?action=sync', {
        session_id: sessionId,
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
        chat_msg: chatToSend,
        moved_items: moved,
        state_changes: stateChanges,
        board_since: boardLastId,
        board_strokes: strokes
      }, true);
      if (data && data.kicked) {
        if (syncTimer) clearInterval(syncTimer);
        syncTimer = null;
        alert(data.error || 'Você foi desconectado pelo Administrador.');
        window.location.reload();
        return;
      }
      if (data.ok) {
        syncFailures = 0;
        if (data.force_teleport && window.teleportCampusPlayer) {
          window.teleportCampusPlayer(
            data.force_teleport.x,
            data.force_teleport.y,
            data.force_teleport.z,
            data.force_teleport.yaw
          );
          showFloatingToast('🧲 Você foi teletransportado pelo Administrador Master!');
        }
        if (data.app_version && window.MYCO_VERSION && data.app_version !== window.MYCO_VERSION && !window._reloadingVersion) {
          var lastReloadInfo = '';
          try { lastReloadInfo = sessionStorage.getItem('myco_reload_guard') || ''; } catch (e) {}
          var parts = lastReloadInfo.split('|');
          var guardedVer = parts[0];
          var guardedAt = Number(parts[1] || 0);
          if (guardedVer !== data.app_version || (Date.now() - guardedAt) > 30000) {
            window._reloadingVersion = true;
            try { sessionStorage.setItem('myco_reload_guard', data.app_version + '|' + Date.now()); } catch (e) {}
            showFloatingToast('🔄 Nova versão v' + data.app_version + ' disponível! Atualizando...');
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
        if (typeof data.board_last_id === 'number' && data.board_last_id > boardLastId) {
          boardLastId = data.board_last_id;
        }
        if (data.board_strokes && data.board_strokes.length && window.applyCampusBoardStrokes) {
          window.applyCampusBoardStrokes(data.board_strokes);
        }
        if (data.world_state && typeof data.world_state.auditorium_slide === 'number') {
          if (data.world_state.auditorium_slide !== currentSlideIdx ||
              (data.world_state.auditorium_presenter || '') !== currentPresenter) {
            applySlideTo3D(data.world_state.auditorium_slide, data.world_state.auditorium_presenter || '');
          }
        }
      } else if (data.auth !== false) {
        throw new Error(data.error || 'sync');
      }
    } catch (e) {
      // Reenvia itens/chat/estados/tracos que nao chegaram ao servidor
      syncFailures++;
      if (firstSync) isInitialSync = true;
      if (chatToSend && !pendingChatMsg) pendingChatMsg = chatToSend;
      if (moved && moved.length) window.requeueCampusMovedItems(moved);
      if (strokes && strokes.length && window.requeueCampusBoardStrokes) window.requeueCampusBoardStrokes(strokes);
      if (stateChanges && window.requeueCampusStateChanges) window.requeueCampusStateChanges(stateChanges);
    } finally {
      syncInFlight = false;
      if (syncQueued) {
        syncMultiplayer();
      }
    }
  }

  function setupMobileJoystick() {
    var zone = $('mobile-joystick-zone');
    var knob = $('mobile-joystick-knob');
    var activeId = null;
    var maxR = 42;

    function updateStick(clientX, clientY) {
      var rect = zone.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = clientX - cx;
      var dy = clientY - cy;
      var dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      knob.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
      var nx = dx / maxR;
      var ny = dy / maxR;
      var mag = Math.hypot(nx, ny);
      if (mag < 0.12) { nx = 0; ny = 0; }
      window.setCampusJoystick(nx, ny);
    }

    function resetStick() {
      activeId = null;
      knob.style.transform = 'translate(0px, 0px)';
      window.setCampusJoystick(0, 0);
    }

    zone.addEventListener('touchstart', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var t = e.changedTouches[0];
      if (!t) return;
      activeId = t.identifier;
      updateStick(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', function (e) {
      if (activeId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    }, { passive: true });

    function endStick(e) {
      if (activeId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          resetStick();
          break;
        }
      }
    }
    window.addEventListener('touchend', endStick, { passive: true });
    window.addEventListener('touchcancel', endStick, { passive: true });
    window.addEventListener('blur', resetStick);

    var rotBtn = $('btn-mobile-rotate');
    if (rotBtn) {
      rotBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.rotateCampusHeldItem) window.rotateCampusHeldItem();
      }, { passive: false });
      rotBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        if (window.rotateCampusHeldItem) window.rotateCampusHeldItem();
      });
    }

    var sprintBtn = $('btn-mobile-sprint');
    var sprintLatched = false;
    var sprintTouchStartAt = 0;
    function syncSprintState(active) {
      sprintBtn.classList.toggle('sprint-active', !!active);
      if (window.setCampusSprint) window.setCampusSprint(!!active);
    }
    if (sprintBtn) {
      sprintBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        sprintTouchStartAt = performance.now();
        syncSprintState(true);
      }, { passive: false });
      var endSprint = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var heldMs = performance.now() - sprintTouchStartAt;
        if (heldMs < 240) {
          sprintLatched = !sprintLatched;
          syncSprintState(sprintLatched);
        } else {
          sprintLatched = false;
          syncSprintState(false);
        }
      };
      sprintBtn.addEventListener('touchend', endSprint, { passive: false });
      sprintBtn.addEventListener('touchcancel', endSprint, { passive: false });
      sprintBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        sprintLatched = !sprintLatched;
        syncSprintState(sprintLatched);
      });
    }

    var jumpBtn = $('btn-mobile-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.setCampusJumpHeld) window.setCampusJumpHeld(true);
        window.triggerCampusJump();
      }, { passive: false });
      var endJump = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.setCampusJumpHeld) window.setCampusJumpHeld(false);
      };
      jumpBtn.addEventListener('touchend', endJump, { passive: false });
      jumpBtn.addEventListener('touchcancel', endJump, { passive: false });
      jumpBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        window.triggerCampusJump();
      });
    }
  }

  function updateFpsUi(fps) {
    inFpsState = fps;
    $('btn-toggle-fps').textContent = fps ? '🌍 Vista Aérea' : '🎥 1ª Pessoa';
    $('crosshair').style.display = fps ? 'block' : 'none';
    if (fps && isTouch()) {
      $('mobile-joystick-zone').style.display = 'block';
      $('mobile-actions').style.display = 'flex';
    } else {
      $('mobile-joystick-zone').style.display = 'none';
      $('mobile-actions').style.display = 'none';
    }
  }

  function boot() {
    applyDeviceUi();
    window.addEventListener('resize', applyDeviceUi);
    window.addEventListener('orientationchange', applyDeviceUi);
    renderSwatches();
    setupMobileJoystick();
    loadLobbyStats();
    setInterval(loadLobbyStats, 20000);
    var verEl = $('app-version');
    if (verEl) verEl.textContent = 'v' + APP_VERSION;
    if (window.location.search.indexOf('preview=1') !== -1) {
      $('campus-lobby').classList.add('hidden');
    }

    window.initCampus3D('campus-canvas-wrap', {
      onHarvestMushroom: function (mushId) {
        harvestMushroom(mushId);
      },
      onOpenLessons: function () {
        renderLessonsModal();
        $('lesson-modal').classList.remove('hidden');
      },
      onScreenNav: function (delta) {
        if (currentUser) {
          broadcastSlide(currentSlideIdx + delta);
        }
      },
      onWorldAction: function () {
        syncMultiplayer();
      },
      onNearScreen: function (near) {
        var isProf = currentUser && (currentUser.role === 'professor' || currentUser.role === 'admin');
        var tb = $('prof-toolbar');
        if (tb) tb.classList.toggle('hidden', !isProf || !near);
      },
      onHoldChange: function (label) {
        var rotBtn = $('btn-mobile-rotate');
        if (rotBtn) rotBtn.style.display = (label && isTouch()) ? 'flex' : 'none';
      },
      onFpsChange: updateFpsUi,
      onHoverPrompt: function (txt) {
        var pill = $('interact-pill');
        if (getDeviceProfile() === 'phone') {
          pill.classList.add('hidden');
          return;
        }
        if (txt && currentUser) {
          pill.textContent = txt;
          pill.classList.remove('hidden');
        } else {
          pill.classList.add('hidden');
        }
      }
    });

    $('lobby-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      requestCampusFullscreen();
      var errBox = $('lobby-error');
      errBox.classList.add('hidden');
      var btn = $('btn-enter-campus');
      btn.disabled = true;
      btn.textContent = 'Entrando no campus...';

      try {
        var data = await apiPost('api/auth.php?action=login', {
          display_name: $('input-name').value.trim(),
          pin: $('input-pin').value,
          hat_color: selectedHat,
          body_color: selectedBody
        });
        if (!data.ok) {
          errBox.textContent = data.error || 'Erro ao autenticar.';
          errBox.classList.remove('hidden');
          btn.disabled = false;
          btn.textContent = '🚀 Entrar no Campus 3D';
          return;
        }
        enterCampus(data.user, data.token || '');
      } catch (err) {
        errBox.textContent = 'Falha ao conectar com o servidor. Tente novamente em instantes.';
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '🚀 Entrar no Campus 3D';
      }
    });

    // Garante entrada automatica em Fullscreen no primeiro toque/clique caso tenha entrado via sessao salva (auto-login)
    var autoFsTriggered = false;
    function onFirstGameGesture(e) {
      if (!currentUser) return;
      if (e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.id === 'btn-fullscreen')) return;
      if (!autoFsTriggered) {
        autoFsTriggered = true;
        requestCampusFullscreen();
      }
    }
    window.addEventListener('touchstart', onFirstGameGesture, { passive: true });
    window.addEventListener('mousedown', onFirstGameGesture, { passive: true });

    var fsBtn = $('btn-fullscreen');
    if (fsBtn) {
      fsBtn.onclick = function (e) {
        e.stopPropagation();
        toggleCampusFullscreen();
      };
    }

    $('btn-toggle-fps').onclick = function () { window.setCampusFpsMode(!inFpsState); };
    $('btn-logout').onclick = logoutCampus;
    $('btn-open-lessons').onclick = function () { renderLessonsModal(); $('lesson-modal').classList.remove('hidden'); };
    $('btn-close-lessons').onclick = function () { $('lesson-modal').classList.add('hidden'); };
    $('btn-open-ranking').onclick = openRankingModal;
    $('btn-close-ranking').onclick = function () { $('ranking-modal').classList.add('hidden'); };
    $('btn-slide-prev').onclick = function () { broadcastSlide(currentSlideIdx - 1); };
    $('btn-slide-next').onclick = function () { broadcastSlide(currentSlideIdx + 1); };

    $('btn-reset-lab').onclick = async function () {
      window.resetCampusWorldObjects();
      try { await apiPost('api/multiplayer.php?action=reset_world', {}, true); } catch (e) { /* silent */ }
    };

    function submitChatMessage() {
      var inp = $('chat-input');
      if (!inp) return;
      var txt = inp.value.trim();
      if (txt) {
        pendingChatMsg = txt.slice(0, 140);
        inp.value = '';
        syncMultiplayer();
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
      if (currentUser && navigator.sendBeacon) {
        var body = { session_id: sessionId, user_id: currentUser.id };
        if (authToken) body.token = authToken;
        navigator.sendBeacon('api/multiplayer.php?action=leave', JSON.stringify(body));
      }
    }
    window.addEventListener('pagehide', sendLeave);
    window.addEventListener('beforeunload', sendLeave);

    tryResumeSession();
    if (window.setCampusCinemaLessons) window.setCampusCinemaLessons(LESSONS);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

