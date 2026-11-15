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

  var sessionId = 'mc_' + Math.random().toString(36).slice(2, 12);
  var currentUser = null;
  var selectedHat = HAT_COLORS[0];
  var selectedBody = BODY_COLORS[0];
  var currentSlideIdx = 0;
  var currentPresenter = '';
  var pendingChatMsg = '';
  var syncTimer = null;
  var inFpsState = false;

  function $(id) { return document.getElementById(id); }

  function isTouch() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
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

    var isProf = currentUser.role === 'professor' || currentUser.role === 'admin';
    var badge = $('hud-role-badge');
    badge.textContent = isProf ? '👨‍🏫 Prof.' : '🎓 Aluno';
    badge.className = isProf
      ? 'px-2 py-0.5 rounded-full font-bold bg-amber-500/25 text-amber-300 border border-amber-400/40'
      : 'px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';

    if (isProf) {
      $('prof-toolbar').classList.remove('hidden');
    } else {
      $('prof-toolbar').classList.add('hidden');
    }
  }

  async function apiPost(url, payload) {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    return res.json();
  }

  async function loadLobbyStats() {
    try {
      var res = await fetch('api/auth.php?action=leaderboard');
      var data = await res.json();
      if (data.ok && data.stats) {
        $('lobby-stats').textContent =
          'MySQL Conectado • ' + data.stats.total_users + ' estudantes • ' +
          data.stats.total_xp + ' XP acumulados • ' + data.stats.total_harvests + ' cogus colhidos';
      } else {
        $('lobby-stats').textContent = data.error || 'Aguardando configuração do MySQL.';
      }
    } catch (err) {
      $('lobby-stats').textContent = 'Servidor PHP/MySQL offline localmente (modo preview 3D disponível após configurar HostGator/XAMPP).';
    }
  }

  async function awardProgress(xpDelta, harvestDelta, moduleSlug) {
    if (!currentUser) return;
    try {
      var data = await apiPost('api/auth.php?action=add_progress', {
        user_id: currentUser.id,
        xp_delta: xpDelta || 0,
        harvest_delta: harvestDelta || 0,
        completed_module: moduleSlug || ''
      });
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
        '<div><div class="font-bold text-white">' + (idx + 1) + '. ' + lesson.title + '</div>' +
        '<div class="text-xs text-slate-400">' + lesson.subtitle + '</div></div>' +
        '<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ' +
        (isDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300') + '">' +
        (isDone ? '✅ Concluído' : '+50 XP') + '</span>';
      card.appendChild(header);

      var ul = document.createElement('div');
      ul.className = 'text-xs text-slate-300 space-y-1';
      ul.innerHTML = lesson.bullets.map(function (b) { return '<div>' + b + '</div>'; }).join('');
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
            feedback.textContent = isDone ? '✅ Correto! Módulo já registrado no MySQL.' : '🎉 Correto! +50 XP salvos no MySQL!';
            if (!isDone) {
              awardProgress(50, 0, lesson.slug).then(renderLessonsModal);
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
    body.innerHTML = '<div class="text-slate-400">Carregando ranking do MySQL...</div>';
    try {
      var res = await fetch('api/auth.php?action=leaderboard');
      var data = await res.json();
      if (!data.ok) {
        body.innerHTML = '<div class="text-rose-300">' + (data.error || 'Erro ao carregar') + '</div>';
        return;
      }
      body.innerHTML = '';
      (data.leaders || []).forEach(function (u, i) {
        var row = document.createElement('div');
        row.className = 'flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800';
        var roleTag = (u.role === 'professor' || u.role === 'admin') ? '👨‍🏫 ' : '🎓 ';
        row.innerHTML =
          '<div class="flex items-center gap-2"><span class="font-extrabold text-amber-300 w-5">#' + (i + 1) + '</span>' +
          '<span class="font-bold text-white">' + roleTag + u.display_name + '</span></div>' +
          '<div class="flex items-center gap-3 text-slate-300">' +
          '<span>📚 ' + (u.completed_modules || []).length + '/5</span>' +
          '<span>🍄 ' + u.mushrooms_harvested + '</span>' +
          '<span class="font-extrabold text-emerald-300">⭐ ' + u.xp + ' XP</span></div>';
        body.appendChild(row);
      });
    } catch (e) {
      body.innerHTML = '<div class="text-rose-300">Erro de conexão com o MySQL.</div>';
    }
  }

  async function broadcastSlide(newIdx) {
    var clamped = ((newIdx % LESSONS.length) + LESSONS.length) % LESSONS.length;
    applySlideTo3D(clamped, currentUser ? currentUser.display_name : '');
    if (!currentUser) return;
    try {
      await apiPost('api/multiplayer.php?action=set_slide', {
        user_id: currentUser.id,
        slide_index: clamped
      });
    } catch (e) { /* silent */ }
  }

  async function syncMultiplayer() {
    if (!currentUser) return;
    var pose = window.getCampusPlayerPose();
    var moved = window.consumeCampusMovedItems();
    var chatToSend = pendingChatMsg;
    pendingChatMsg = '';

    try {
      var data = await apiPost('api/multiplayer.php?action=sync', {
        session_id: sessionId,
        user_id: currentUser.id,
        display_name: currentUser.display_name,
        role: currentUser.role,
        hat_color: currentUser.hat_color,
        body_color: currentUser.body_color,
        x: pose.x,
        y: pose.y,
        z: pose.z,
        yaw: pose.yaw,
        pitch: pose.pitch,
        holding_item: pose.holding_item,
        walking: pose.walking,
        in_fps: pose.in_fps,
        chat_msg: chatToSend,
        moved_items: moved
      });
      if (data.ok) {
        $('hud-online').textContent = String(data.online_count || 1);
        window.updateCampusPlayers(data.players || []);
        window.applyCampusWorldObjects(data.objects || {});
        if (data.world_state && typeof data.world_state.auditorium_slide === 'number') {
          if (data.world_state.auditorium_slide !== currentSlideIdx ||
              (data.world_state.auditorium_presenter || '') !== currentPresenter) {
            applySlideTo3D(data.world_state.auditorium_slide, data.world_state.auditorium_presenter || '');
          }
        }
      }
    } catch (e) { /* keep running */ }
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
      if (Math.hypot(nx, ny) < 0.14) { nx = 0; ny = 0; }
      window.setCampusJoystick(nx, ny);
    }

    zone.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      activeId = t.identifier;
      updateStick(t.clientX, t.clientY);
    }, { passive: true });

    zone.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        }
      }
    }, { passive: true });

    function endStick(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          activeId = null;
          knob.style.transform = 'translate(0px, 0px)';
          window.setCampusJoystick(0, 0);
        }
      }
    }
    zone.addEventListener('touchend', endStick, { passive: true });
    zone.addEventListener('touchcancel', endStick, { passive: true });

    $('btn-mobile-jump').onclick = function () { window.triggerCampusJump(); };
    $('btn-rot-left').onclick = function () { window.rotateCampusHeldItem(-0.45); };
    $('btn-rot-right').onclick = function () { window.rotateCampusHeldItem(0.45); };
  }

  function updateFpsUi(fps) {
    inFpsState = fps;
    $('btn-toggle-fps').textContent = fps ? '🌍 Vista Aérea' : '🎥 1ª Pessoa';
    $('crosshair').style.display = fps && !isTouch() ? 'block' : 'none';
    if (fps && isTouch()) {
      $('mobile-joystick-zone').style.display = 'block';
      $('mobile-actions').style.display = 'flex';
    } else {
      $('mobile-joystick-zone').style.display = 'none';
      $('mobile-actions').style.display = 'none';
    }
  }

  function boot() {
    renderSwatches();
    setupMobileJoystick();
    loadLobbyStats();

    window.initCampus3D('campus-canvas-wrap', {
      onHarvestMushroom: function () {
        awardProgress(25, 1, '');
      },
      onOpenLessons: function () {
        renderLessonsModal();
        $('lesson-modal').classList.remove('hidden');
      },
      onHoldChange: function (label) {
        if (label) {
          $('mobile-rotate-row').classList.remove('hidden');
        } else {
          $('mobile-rotate-row').classList.add('hidden');
        }
      },
      onFpsChange: updateFpsUi,
      onHoverPrompt: function (txt) {
        var pill = $('interact-pill');
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
      var errBox = $('lobby-error');
      errBox.classList.add('hidden');
      var btn = $('btn-enter-campus');
      btn.disabled = true;
      btn.textContent = 'Conectando ao MySQL...';

      try {
        var data = await apiPost('api/auth.php?action=login', {
          display_name: $('input-name').value.trim(),
          pin: $('input-pin').value,
          professor_key: $('input-prof-key').value,
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
        currentUser = data.user;
        updateUserHud();
        $('campus-lobby').classList.add('hidden');
        $('campus-hud').classList.remove('hidden');
        window.setCampusFpsMode(true);
        setTimeout(function () { $('fps-hint').classList.add('faded'); }, 4000);
        if (syncTimer) clearInterval(syncTimer);
        syncMultiplayer();
        syncTimer = setInterval(syncMultiplayer, 150);
      } catch (err) {
        errBox.textContent = 'Falha ao conectar em api/auth.php (verifique o MySQL e api/config.php).';
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '🚀 Entrar no Campus 3D';
      }
    });

    $('btn-toggle-fps').onclick = function () { window.setCampusFpsMode(!inFpsState); };
    $('btn-open-lessons').onclick = function () { renderLessonsModal(); $('lesson-modal').classList.remove('hidden'); };
    $('btn-close-lessons').onclick = function () { $('lesson-modal').classList.add('hidden'); };
    $('btn-open-ranking').onclick = openRankingModal;
    $('btn-close-ranking').onclick = function () { $('ranking-modal').classList.add('hidden'); };
    $('btn-slide-prev').onclick = function () { broadcastSlide(currentSlideIdx - 1); };
    $('btn-slide-next').onclick = function () { broadcastSlide(currentSlideIdx + 1); };

    $('btn-reset-lab').onclick = async function () {
      window.resetCampusWorldObjects();
      try { await apiPost('api/multiplayer.php?action=reset_world', {}); } catch (e) { /* silent */ }
    };

    $('chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('chat-input');
      var txt = inp.value.trim();
      if (txt) {
        pendingChatMsg = txt;
        inp.value = '';
        inp.blur();
      }
    });

    window.addEventListener('beforeunload', function () {
      if (currentUser && navigator.sendBeacon) {
        navigator.sendBeacon('api/multiplayer.php?action=leave', JSON.stringify({ session_id: sessionId }));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
