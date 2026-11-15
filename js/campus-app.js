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
  var SYNC_INTERVAL_MS = 125;

  var sessionId = 'mc_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  var currentUser = null;
  var authToken = '';
  var selectedHat = HAT_COLORS[0];
  var selectedBody = BODY_COLORS[0];
  var currentSlideIdx = 0;
  var currentPresenter = '';
  var pendingChatMsg = '';
  var boardLastId = 0;
  var lastObjVer = '';
  var lastStateVer = '';
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

  var toastUntil = 0;

  function showFloatingToast(msg, durationMs) {
    var pill = $('interact-pill');
    if (!pill) return;
    toastUntil = Date.now() + (durationMs || 3200);
    pill.textContent = msg;
    pill.classList.remove('hidden');
    setTimeout(function () {
      if (Date.now() >= toastUntil && pill.textContent === msg) {
        pill.classList.add('hidden');
      }
    }, durationMs || 3200);
  }

  var CAMPUS_SECTORS = [
    { id: 'plaza', icon: '🏛️', name: 'Praça Central', desc: 'Ponto inicial, fonte e torre do relógio', x: 0, y: 0, z: 10.5, yaw: 0 },
    { id: 'lab', icon: '🧪', name: 'Laboratório Asséptico', desc: 'Fluxo laminar, autoclave, fogareiro e seringas', x: -16.2, y: 0.14, z: -7.0, yaw: Math.PI / 2 },
    { id: 'storage', icon: '📦', name: 'Depósito de Insumos', desc: 'Bags, vidros, grãos, placas e borrifadores', x: -16.2, y: 0.14, z: 7.5, yaw: Math.PI / 2 },
    { id: 'greenhouse', icon: '🍄', name: 'Estufa de Frutificação', desc: 'Cultive e colha 4 espécies de cogumelos', x: 16.5, y: 0.14, z: 7.5, yaw: -Math.PI / 2 },
    { id: 'cinema', icon: '🎬', name: 'Cinema & Auditório', desc: 'Telão interativo com aulas e poltronas', x: 48, y: 0.14, z: -6.5, yaw: 0 },
    { id: 'sports', icon: '⚽', name: 'Complexo Esportivo', desc: 'Futebol, basquete com bolas reais e tênis', x: -36, y: 0, z: -15, yaw: Math.PI / 2 },
    { id: 'forest', icon: '🌲', name: 'Bosque & Lago', desc: 'Colha cogumelos silvestres pela floresta', x: 0, y: 0, z: -24, yaw: 0 },
    { id: 'mountain', icon: '🏔️', name: 'Montanhas (Snowboard)', desc: 'Pico panorâmico para descer de snowboard', x: 0, z: -158, yaw: Math.PI }
  ];

  var LAB_QUEST_STEPS = [
    { key: 'sanitize_hood', icon: '🧴', title: '1. Higienizar a Capela', desc: 'Pegue um Borrifador de Álcool 70% e borrife dentro da Capela de Fluxo Laminar.' },
    { key: 'hood_on', icon: '🌬️', title: '2. Ligar o Fluxo Laminar', desc: 'Clique no interruptor da Capela de Fluxo Laminar para ligar o filtro HEPA.' },
    { key: 'cooker_heat', icon: '🔥', title: '3. Esterilizar na Autoclave', desc: 'Coloque um frasco/bag na Panela de Pressão ou ligue o Fogareiro Industrial.' },
    { key: 'syringe_use', icon: '💉', title: '4. Inocular com Seringa', desc: 'Use a Seringa 10ml em um frasco de Cultura Líquida ou spawn.' },
    { key: 'greenhouse_care', icon: '🍄', title: '5. Cuidar da Estufa', desc: 'Vá até a Estufa e borrife água ou colha um bloco maduro de cogumelos.' }
  ];
  var labQuestDone = {};

  function getQuestStorageKey() {
    return 'myco_quest_' + (currentUser ? currentUser.id : 'guest');
  }

  function loadLabQuestProgress() {
    labQuestDone = {};
    try {
      var raw = localStorage.getItem(getQuestStorageKey());
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') labQuestDone = parsed;
      }
    } catch (e) {}
    var mods = (currentUser && currentUser.completed_modules) || [];
    if (mods.indexOf('lab_practica_v1') !== -1) {
      LAB_QUEST_STEPS.forEach(function (st) { labQuestDone[st.key] = true; });
    }
    updateQuestBadge();
  }

  function updateQuestBadge() {
    var badge = $('quest-badge');
    if (!badge) return;
    var count = 0;
    LAB_QUEST_STEPS.forEach(function (st) { if (labQuestDone[st.key]) count++; });
    badge.textContent = count + '/' + LAB_QUEST_STEPS.length;
  }

  async function completeLabStep(stepKey) {
    if (!currentUser || !stepKey || labQuestDone[stepKey]) return;
    var stepObj = null;
    for (var i = 0; i < LAB_QUEST_STEPS.length; i++) {
      if (LAB_QUEST_STEPS[i].key === stepKey) { stepObj = LAB_QUEST_STEPS[i]; break; }
    }
    if (!stepObj) return;
    labQuestDone[stepKey] = true;
    try { localStorage.setItem(getQuestStorageKey(), JSON.stringify(labQuestDone)); } catch (e) {}
    updateQuestBadge();

    var doneCount = 0;
    LAB_QUEST_STEPS.forEach(function (st) { if (labQuestDone[st.key]) doneCount++; });
    if (doneCount < LAB_QUEST_STEPS.length) {
      showFloatingToast('✅ Etapa concluída (' + doneCount + '/5): ' + stepObj.title, 3600);
    } else {
      try {
        var res = await apiPost('api/auth.php?action=complete_lab_quest', {}, true);
        if (res && res.ok && res.user) {
          currentUser = res.user;
          updateUserHud();
          if (res.new_quest) {
            if (window.MycoAudio) window.MycoAudio.playEmote('cheer');
            showFloatingToast('🏆 Missão Prática 5/5 Concluída! +100 XP no seu perfil!', 4500);
          } else {
            showFloatingToast('🧪 Missão Prática 5/5 completa!', 3200);
          }
        }
      } catch (e) {}
    }
    var qm = $('quest-modal');
    if (qm && !qm.classList.contains('hidden')) renderQuestModal();
  }

  function renderMapModal() {
    var grid = $('map-sectors-grid');
    if (!grid) return;
    grid.innerHTML = '';
    CAMPUS_SECTORS.forEach(function (sec) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'text-left p-3 rounded-xl bg-slate-900/80 hover:bg-sky-900/50 border border-slate-700/70 hover:border-sky-400/60 transition flex items-start gap-2.5';
      btn.innerHTML =
        '<span class="text-2xl leading-none">' + sec.icon + '</span>' +
        '<div><div class="font-bold text-white">' + escapeHtml(sec.name) + '</div>' +
        '<div class="text-[11px] text-slate-400">' + escapeHtml(sec.desc) + '</div></div>';
      btn.onclick = function () {
        if (window.teleportCampusPlayer) {
          window.teleportCampusPlayer(sec.x, sec.y, sec.z, sec.yaw);
          showFloatingToast(sec.icon + ' Teleportado para ' + sec.name, 2500);
        }
        var mm = $('map-modal');
        if (mm) mm.classList.add('hidden');
      };
      grid.appendChild(btn);
    });
  }

  function renderQuestModal() {
    var body = $('quest-body');
    if (!body) return;
    body.innerHTML = '';
    var doneCount = 0;
    LAB_QUEST_STEPS.forEach(function (st) { if (labQuestDone[st.key]) doneCount++; });
    var pct = Math.round((doneCount / LAB_QUEST_STEPS.length) * 100);
    var header = document.createElement('div');
    header.className = 'p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-1.5';
    header.innerHTML =
      '<div class="flex items-center justify-between font-bold text-white">' +
      '<span>Progresso da Prática</span><span class="text-emerald-300">' + doneCount + '/5 (' + pct + '%)</span></div>' +
      '<div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">' +
      '<div class="h-full bg-emerald-400 transition-all" style="width:' + pct + '%"></div></div>';
    body.appendChild(header);

    LAB_QUEST_STEPS.forEach(function (st) {
      var isDone = !!labQuestDone[st.key];
      var row = document.createElement('div');
      row.className = 'p-3 rounded-xl border flex items-start gap-2.5 ' +
        (isDone ? 'bg-emerald-950/35 border-emerald-500/40' : 'bg-slate-900/75 border-slate-700/70');
      row.innerHTML =
        '<span class="text-xl leading-none">' + (isDone ? '✅' : st.icon) + '</span>' +
        '<div class="flex-1"><div class="font-bold ' + (isDone ? 'text-emerald-300' : 'text-white') + '">' + escapeHtml(st.title) + '</div>' +
        '<div class="text-[11px] text-slate-300">' + escapeHtml(st.desc) + '</div></div>';
      body.appendChild(row);
    });
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
    if ($('hud-name')) $('hud-name').textContent = currentUser.display_name;
    if ($('hud-xp')) $('hud-xp').textContent = String(currentUser.xp || 0);
    if ($('hud-mushrooms')) $('hud-mushrooms').textContent = String(currentUser.mushrooms_harvested || 0);
    if ($('hud-modules')) $('hud-modules').textContent = String((currentUser.completed_modules || []).length);
    if ($('shop-user-xp')) $('shop-user-xp').textContent = String(currentUser.xp || 0);
    if ($('shop-user-mushrooms')) $('shop-user-mushrooms').textContent = String(currentUser.mushrooms_harvested || 0);
    if (window.setLocalAvatarHat) {
      window.setLocalAvatarHat(currentUser.current_hat || 'default');
    }

    var isMaster = (currentUser.role === 'admin') || (currentUser.username === 'gabrieldaluz');
    var isProf = (currentUser.role === 'professor') || isMaster;
    var isMod = (currentUser.role === 'moderator');

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
    if (rLab) rLab.classList.add('hidden');
    var pBar = $('prof-toolbar');
    if (pBar) pBar.classList.add('hidden');
    var btnAdmin = $('btn-open-admin');
    if (btnAdmin) btnAdmin.classList.toggle('hidden', !isMaster);
  }

  async function harvestGreenhouseSlot(slot) {
    if (!currentUser) return;
    try {
      var data = await apiPost('api/auth.php?action=harvest_greenhouse', { slot_id: slot.id }, true);
      if (data.ok && data.user) {
        currentUser = data.user;
        updateUserHud();
        showFloatingToast('🍄 +50 XP e +2 Cogumelos colhidos na Estufa!');
      }
    } catch (e) { /* silent */ }
  }

  var COSMETIC_HATS = [
    {
      id: 'default',
      name: 'Cogumelo Vermelho Clássico',
      desc: 'O clássico Amanita com pintas brancas.',
      req_xp: 0,
      req_mushrooms: 0,
      icon: '🍄'
    },
    {
      id: 'golden_shroom',
      name: 'Cogumelo Dourado Radiante',
      desc: 'Dourado brilhante com esferas cintilantes.',
      req_xp: 200,
      req_mushrooms: 5,
      icon: '👑'
    },
    {
      id: 'wizard_hood',
      name: 'Capuz de Alquimista',
      desc: 'Cone místico com runas de micologia.',
      req_xp: 350,
      req_mushrooms: 10,
      icon: '🧙‍♂️'
    },
    {
      id: 'grad_cap',
      name: 'Capelo Universitário',
      desc: 'Chapéu acadêmico de formatura com borla dourada.',
      req_xp: 500,
      req_mushrooms: 15,
      icon: '🎓'
    },
    {
      id: 'flower_crown',
      name: 'Coroa de Flores Silvestres',
      desc: 'Grinalda botânica com pétalas da floresta.',
      req_xp: 150,
      req_mushrooms: 3,
      icon: '🌸'
    },
    {
      id: 'beret',
      name: 'Boina de Pesquisador',
      desc: 'Estilo elegante de cientista micologista.',
      req_xp: 100,
      req_mushrooms: 2,
      icon: '🎨'
    }
  ];

  window.toggleCampusSnowboard = function () {
    var unlocked = (currentUser && currentUser.unlocked_hats) || [];
    if (unlocked.indexOf('snowboard') === -1) {
      showCampusToast('🔒 Desbloqueie o Snowboard na 👑 Loja -> 🏂 Brinquedos!');
      return;
    }
    var next = !(window.isCampusSnowboardActive && window.isCampusSnowboardActive());
    if (next && window.setCampusParaglider) window.setCampusParaglider(false);
    if (window.setCampusSnowboard) window.setCampusSnowboard(next);
    if (window.MycoAudio) window.MycoAudio.playClick();
    showCampusToast(next ? '🏂 Snowboard ativado! Olhe para baixo para ver nos seus pés!' : '🏂 Snowboard guardado!');
  };

  window.toggleCampusParaglider = function () {
    var unlocked = (currentUser && currentUser.unlocked_hats) || [];
    if (unlocked.indexOf('paraglider') === -1) {
      showCampusToast('🔒 Desbloqueie o Paraglider na 👑 Loja -> 🏂 Brinquedos!');
      return;
    }
    var next = !(window.isCampusParagliderActive && window.isCampusParagliderActive());
    if (next && window.setCampusSnowboard) window.setCampusSnowboard(false);
    if (window.setCampusParaglider) window.setCampusParaglider(next);
    if (window.MycoAudio) window.MycoAudio.playClick();
    showCampusToast(next ? '🪂 Paraglider ativado! Salte de uma montanha e entre nas correntes de ar!' : '🪂 Paraglider guardado!');
  };

  var COSMETIC_TOYS = [
    {
      id: 'snowboard',
      name: 'Snowboard Pro MycoRide',
      desc: 'Desça as montanhas com física real, carving e visão nos pés! (Atalho: B)',
      req_xp: 100,
      req_mushrooms: 2,
      icon: '🏂'
    },
    {
      id: 'paraglider',
      name: 'Paraglider MycoWing',
      desc: 'Salte das montanhas, pegue correntes térmicas e voe pelo campus! (Atalho: P)',
      req_xp: 150,
      req_mushrooms: 3,
      icon: '🪂'
    }
  ];
  var activeShopTab = 'hats';

  function renderShopModal() {
    var grid = $('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var userXp = currentUser ? (currentUser.xp || 0) : 0;
    var userMush = currentUser ? (currentUser.mushrooms_harvested || 0) : 0;
    var unlocked = (currentUser && currentUser.unlocked_hats) || ['default'];
    var currentHat = (currentUser && currentUser.current_hat) || 'default';
    var snowboardOn = !!(window.isCampusSnowboardActive && window.isCampusSnowboardActive());
    var paragliderOn = !!(window.isCampusParagliderActive && window.isCampusParagliderActive());

    if ($('shop-user-xp')) $('shop-user-xp').textContent = String(userXp);
    if ($('shop-user-mushrooms')) $('shop-user-mushrooms').textContent = String(userMush);

    var tabHats = $('shop-tab-hats');
    var tabToys = $('shop-tab-toys');
    if (tabHats && tabToys) {
      tabHats.className = 'px-3 py-1 rounded-lg font-bold text-xs transition ' + (activeShopTab === 'hats' ? 'bg-purple-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white');
      tabToys.className = 'px-3 py-1 rounded-lg font-bold text-xs transition ' + (activeShopTab === 'toys' ? 'bg-cyan-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white');
      tabHats.onclick = function () { activeShopTab = 'hats'; renderShopModal(); };
      tabToys.onclick = function () { activeShopTab = 'toys'; renderShopModal(); };
    }

    var list = activeShopTab === 'toys' ? COSMETIC_TOYS : COSMETIC_HATS;
    list.forEach(function (item) {
      var isToy = activeShopTab === 'toys';
      var isEquipped = isToy ? (item.id === 'paraglider' ? paragliderOn : snowboardOn) : (currentHat === item.id);
      var isUnlocked = unlocked.indexOf(item.id) !== -1 || (!isToy && item.id === 'default');
      var canUnlock = userXp >= item.req_xp && userMush >= item.req_mushrooms;

      var card = document.createElement('div');
      card.className = 'glass-panel rounded-xl p-3 flex flex-col justify-between border ' +
        (isEquipped ? 'border-emerald-400/60 shadow-lg' : (isUnlocked ? 'border-purple-500/40' : 'border-slate-700/50'));

      var top = document.createElement('div');
      top.className = 'space-y-1.5';
      top.innerHTML =
        '<div class="flex items-center gap-2">' +
          '<span class="text-2xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">' + item.icon + '</span>' +
          '<div>' +
            '<div class="font-bold text-white text-xs">' + escapeHtml(item.name) + '</div>' +
            '<div class="text-[11px] text-slate-400">' + escapeHtml(item.desc) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-2 pt-1 text-[11px] text-slate-300 font-semibold">' +
          (item.req_xp > 0 ? '<span class="text-amber-300">⭐ ' + item.req_xp + ' XP</span>' : '<span class="text-emerald-300">Grátis</span>') +
          (item.req_mushrooms > 0 ? '<span class="text-emerald-300">• 🍄 ' + item.req_mushrooms + ' colheitas</span>' : '') +
        '</div>';
      card.appendChild(top);

      var btnWrap = document.createElement('div');
      btnWrap.className = 'pt-3';
      if (isEquipped) {
        var unequipBtn = document.createElement('button');
        unequipBtn.className = 'w-full py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition';
        unequipBtn.textContent = isToy ? ('❌ Desativar ' + (item.id === 'paraglider' ? 'Paraglider' : 'Snowboard')) : '❌ Desativar Chapéu';
        unequipBtn.onclick = async function () {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (isToy) {
            if (item.id === 'paraglider') {
              if (window.setCampusParaglider) window.setCampusParaglider(false);
              showCampusToast('🪂 Paraglider guardado!');
            } else {
              if (window.setCampusSnowboard) window.setCampusSnowboard(false);
    if (window.setCampusParaglider) window.setCampusParaglider(false);
              showCampusToast('🏂 Snowboard guardado!');
            }
            renderShopModal();
          } else {
            try {
              var res = await apiPost('api/auth.php?action=equip_cosmetic', { hat_id: 'none' }, true);
              if (res.ok && res.user) {
                currentUser = res.user;
                window.setLocalAvatarHat('none');
                updateUserHud();
                renderShopModal();
              }
            } catch (e) { /* silent */ }
          }
        };
        btnWrap.appendChild(unequipBtn);
      } else if (isUnlocked) {
        var equipBtn = document.createElement('button');
        equipBtn.className = 'w-full py-1.5 rounded-lg ' + (isToy ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-purple-600 hover:bg-purple-500') + ' text-white font-bold text-xs shadow transition';
        equipBtn.textContent = isToy ? (item.id === 'paraglider' ? '🪂 Ativar Paraglider' : '🏂 Ativar Snowboard') : 'Equipar';
        equipBtn.onclick = async function () {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (isToy) {
            if (item.id === 'paraglider') {
              if (window.setCampusSnowboard) window.setCampusSnowboard(false);
    if (window.setCampusParaglider) window.setCampusParaglider(false);
              if (window.setCampusParaglider) window.setCampusParaglider(true);
              showCampusToast('🪂 Paraglider ativado! Salte de uma montanha e pegue as correntes de ar! (P para alternar)');
            } else {
              if (window.setCampusParaglider) window.setCampusParaglider(false);
              if (window.setCampusSnowboard) window.setCampusSnowboard(true);
              showCampusToast('🏂 Snowboard ativado! Olhe para baixo para ver nos seus pés ou suba a montanha! (B para alternar)');
            }
            renderShopModal();
          } else {
            try {
              var res = await apiPost('api/auth.php?action=equip_cosmetic', { hat_id: item.id }, true);
              if (res.ok && res.user) {
                currentUser = res.user;
                window.setLocalAvatarHat(item.id);
                updateUserHud();
                renderShopModal();
              }
            } catch (e) { /* silent */ }
          }
        };
        btnWrap.appendChild(equipBtn);
      } else if (canUnlock) {
        var buyBtn = document.createElement('button');
        buyBtn.className = 'w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow transition';
        buyBtn.textContent = '🎉 Desbloquear';
        buyBtn.onclick = async function () {
          try {
            if (window.MycoAudio) window.MycoAudio.playClick();
            var res = await apiPost('api/auth.php?action=buy_cosmetic', { hat_id: item.id }, true);
            if (res.ok && res.user) {
              currentUser = res.user;
              if (isToy) {
                if (item.id === 'paraglider') {
                  if (window.setCampusSnowboard) window.setCampusSnowboard(false);
    if (window.setCampusParaglider) window.setCampusParaglider(false);
                  if (window.setCampusParaglider) window.setCampusParaglider(true);
                  showCampusToast('🪂 Paraglider desbloqueado! Vá para as 🏔️ Montanhas no 🗺️ Mapa e salte!');
                } else {
                  if (window.setCampusParaglider) window.setCampusParaglider(false);
                  if (window.setCampusSnowboard) window.setCampusSnowboard(true);
                  showCampusToast('🏂 Snowboard desbloqueado e ativado! Suba a montanha no 🗺️ Mapa!');
                }
              } else {
                window.setLocalAvatarHat(item.id);
              }
              if (window.playCampusEmote) window.playCampusEmote('cheer');
              updateUserHud();
              renderShopModal();
            }
          } catch (e) { /* silent */ }
        };
        btnWrap.appendChild(buyBtn);
      } else {
        btnWrap.innerHTML = '<button disabled class="w-full py-1.5 rounded-lg bg-slate-800/80 text-slate-500 font-semibold text-xs border border-slate-700/40">🔒 Bloqueado</button>';
      }
      card.appendChild(btnWrap);
      grid.appendChild(card);
    });
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
    var text = await res.text();
    var json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { ok: false, error: 'Erro de resposta do servidor (' + res.status + ')' };
    }
    if (res.status === 401 && json && json.auth === false && currentUser) {
      handleSessionExpired(json.error);
    }
    return json || { ok: false, error: 'Resposta inválida do servidor.' };
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
        if (p && typeof p.catch === 'function') p.catch(function () { });
      }
      if (isTouch() && screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(function () { });
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
    loadLabQuestProgress();
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

  function releaseInputForModal() {
    if (window.clearCampusKeys) window.clearCampusKeys();
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (e) { /* silent */ }
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
    pendingChatMsg = '';
    sessionId = 'mc_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    if (window.resetCampusLocalSession) window.resetCampusLocalSession();
    if (window.setCampusSnowboard) window.setCampusSnowboard(false);
    if (window.setCampusParaglider) window.setCampusParaglider(false);
    window.updateCampusPlayers([]);
    window.setCampusFpsMode(false);
    $('campus-hud').classList.add('hidden');
    $('lesson-modal').classList.add('hidden');
    $('ranking-modal').classList.add('hidden');
    ['admin-modal', 'map-modal', 'quest-modal', 'shop-modal', 'emote-bar'].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add('hidden');
    });
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
    releaseInputForModal();
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

  var adminUsersCache = [];

  function showAdminNotice(msg, isError) {
    var el = $('admin-notice');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-semibold ' +
      (isError ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200' : 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-200');
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 4000);
  }

  async function loadAdminUsers() {
    var listEl = $('admin-user-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="text-center text-slate-400 py-8">Carregando jogadores do MySQL...</div>';
    try {
      var data = await apiPost('api/auth.php?action=admin_list_users', {}, true);
      if (!data.ok) {
        listEl.innerHTML = '<div class="text-rose-300 p-4">' + escapeHtml(data.error || 'Erro ao carregar lista.') + '</div>';
        return;
      }
      adminUsersCache = data.users || [];
      renderAdminUsers(adminUsersCache);
    } catch (e) {
      listEl.innerHTML = '<div class="text-rose-300 p-4">Erro de conexão ao buscar jogadores.</div>';
    }
  }

  function renderAdminUsers(users) {
    var listEl = $('admin-user-list');
    if (!listEl) return;
    var searchVal = ($('admin-search-input') ? $('admin-search-input').value : '').toLowerCase().trim();
    var filtered = (users || []).filter(function (u) {
      if (!searchVal) return true;
      return (u.display_name && u.display_name.toLowerCase().indexOf(searchVal) !== -1) ||
        (u.username && u.username.toLowerCase().indexOf(searchVal) !== -1) ||
        (u.role && u.role.toLowerCase().indexOf(searchVal) !== -1);
    });

    if (!filtered.length) {
      listEl.innerHTML = '<div class="text-center text-slate-400 py-8">Nenhum jogador encontrado.</div>';
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(function (u) {
      var card = document.createElement('div');
      var isMe = currentUser && u.id === currentUser.id;
      var roleBadge = u.role === 'admin'
        ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-400/40 font-bold">👑 Admin</span>'
        : (u.role === 'professor'
          ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold">👨‍🏫 Professor</span>'
          : '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">🎓 Aluno</span>');

      var onlineStatus = u.is_online
        ? '<span class="flex items-center gap-1 text-emerald-400 font-bold"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Online</span>'
        : '<span class="text-slate-500">Offline</span>';

      card.className = 'p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3';
      card.innerHTML =
        '<div class="flex items-center gap-3">' +
        '<div class="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center font-bold text-xs" style="background-color:' + escapeHtml(u.hat_color) + '; color:#fff;">' +
        escapeHtml((u.display_name || '?').slice(0, 2).toUpperCase()) +
        '</div>' +
        '<div>' +
        '<div class="flex items-center gap-2">' +
        '<span class="font-bold text-white text-sm">' + escapeHtml(u.display_name) + '</span>' +
        '<span class="text-slate-400 text-[11px]">(@' + escapeHtml(u.username) + ')</span>' +
        roleBadge +
        '</div>' +
        '<div class="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">' +
        onlineStatus +
        '<span>⭐ ' + (u.xp || 0) + ' XP</span>' +
        '<span>🍄 ' + (u.mushrooms_harvested || 0) + ' colheitas</span>' +
        '<span>📚 ' + (u.completed_modules_count || 0) + '/5 módulos</span>' +
        '</div>' +
        '</div>' +
        '</div>';

      var actionsWrap = document.createElement('div');
      actionsWrap.className = 'flex flex-wrap items-center gap-1.5 justify-end';

      if (!isMe) {
        if (u.is_online) {
          var btnPull = document.createElement('button');
          btnPull.type = 'button';
          btnPull.className = 'px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 border border-sky-400/40 text-sky-200 text-[11px] font-semibold';
          btnPull.textContent = '🧲 Puxar';
          btnPull.title = 'Trazer este jogador até a sua posição';
          btnPull.onclick = async function () {
            var myPos = window.getCampusPlayerPos ? window.getCampusPlayerPos() : { x: 0, y: 0, z: 14.5, yaw: 0 };
            try {
              var r = await apiPost('api/auth.php?action=admin_teleport', {
                target_id: u.id, x: myPos.x, y: myPos.y, z: myPos.z, yaw: myPos.yaw
              }, true);
              if (r.ok) showAdminNotice('Jogador ' + u.display_name + ' teletransportado até você!', false);
              else showAdminNotice(r.error || 'Erro ao teletransportar.', true);
            } catch (e) { showAdminNotice('Falha na requisição.', true); }
          };
          actionsWrap.appendChild(btnPull);

          if (u.pos && window.teleportCampusPlayer) {
            var btnGo = document.createElement('button');
            btnGo.type = 'button';
            btnGo.className = 'px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold';
            btnGo.textContent = '🚀 Ir até';
            btnGo.title = 'Teletransportar seu avatar até este jogador';
            btnGo.onclick = function () {
              window.teleportCampusPlayer(u.pos.x, u.pos.y, u.pos.z, 0);
              $('admin-modal').classList.add('hidden');
              showFloatingToast('🚀 Você foi até ' + u.display_name + '!');
            };
            actionsWrap.appendChild(btnGo);
          }
        }

        var nextRole = u.role === 'student' ? 'professor' : 'student';
        var btnRole = document.createElement('button');
        btnRole.type = 'button';
        btnRole.className = 'px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-400/40 text-amber-200 text-[11px] font-semibold';
        btnRole.textContent = u.role === 'student' ? '👨‍🏫 Promover Prof.' : '🎓 Rebaixar Aluno';
        btnRole.onclick = async function () {
          try {
            var r = await apiPost('api/auth.php?action=admin_set_role', { target_id: u.id, new_role: nextRole }, true);
            if (r.ok) {
              showAdminNotice('Cargo de ' + u.display_name + ' alterado com sucesso!', false);
              loadAdminUsers();
            } else {
              showAdminNotice(r.error || 'Erro ao alterar cargo.', true);
            }
          } catch (e) { showAdminNotice('Falha na requisição.', true); }
        };
        actionsWrap.appendChild(btnRole);

        if (u.is_online) {
          var btnKick = document.createElement('button');
          btnKick.type = 'button';
          btnKick.className = 'px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-400/40 text-rose-200 text-[11px] font-semibold';
          btnKick.textContent = '🚫 Desconectar';
          btnKick.title = 'Desconectar a sessão deste jogador';
          btnKick.onclick = async function () {
            if (!confirm('Deseja realmente desconectar o jogador "' + u.display_name + '"?')) return;
            try {
              var r = await apiPost('api/auth.php?action=admin_kick', { target_id: u.id }, true);
              if (r.ok) {
                showAdminNotice('Jogador ' + u.display_name + ' desconectado com sucesso!', false);
                loadAdminUsers();
              } else {
                showAdminNotice(r.error || 'Erro ao desconectar.', true);
              }
            } catch (e) { showAdminNotice('Falha na requisição.', true); }
          };
          actionsWrap.appendChild(btnKick);
        }
      } else {
        var meTag = document.createElement('span');
        meTag.className = 'text-xs text-amber-300 font-bold px-2';
        meTag.textContent = '(Você)';
        actionsWrap.appendChild(meTag);
      }

      card.appendChild(actionsWrap);
      listEl.appendChild(card);
    });
  }

  function openAdminModal() {
    var m = $('admin-modal');
    if (!m) return;
    releaseInputForModal();
    m.classList.remove('hidden');
    loadAdminUsers();
  }

  function closeAdminModal() {
    var m = $('admin-modal');
    if (m) m.classList.add('hidden');
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
      if (firstSync) {
        lastObjVer = '';
        lastStateVer = '';
      }
      var data = await apiPost('api/multiplayer.php?action=sync', {
        session_id: sessionId,
        init_sync: firstSync ? 1 : 0,
        x: pose.x,
        y: pose.y,
        z: pose.z,
        vx: pose.vx || 0,
        vz: pose.vz || 0,
        yaw: pose.yaw,
        pitch: pose.pitch,
        holding_item: pose.holding_item,
        walking: pose.walking,
        seated: pose.seated,
        in_fps: pose.in_fps,
        toy_mode: pose.toy_mode || '',
        current_hat: pose.current_hat || 'default',
        emote: pose.emote || '',
        chat_msg: chatToSend,
        moved_items: moved,
        state_changes: stateChanges,
        obj_ver: lastObjVer,
        state_ver: lastStateVer,
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
          try { lastReloadInfo = sessionStorage.getItem('myco_reload_guard') || ''; } catch (e) { }
          var parts = lastReloadInfo.split('|');
          var guardedVer = parts[0];
          var guardedAt = Number(parts[1] || 0);
          if (guardedVer !== data.app_version || (Date.now() - guardedAt) > 30000) {
            window._reloadingVersion = true;
            try { sessionStorage.setItem('myco_reload_guard', data.app_version + '|' + Date.now()); } catch (e) { }
            showFloatingToast('🔄 Nova versão v' + data.app_version + ' disponível! Atualizando...');
            setTimeout(function () {
              var base = window.location.pathname || '/';
              window.location.replace(base + '?_v=' + encodeURIComponent(data.app_version));
            }, 1500);
            return;
          }
        }
        $('hud-online').textContent = String(data.online_count || 1);
        if (typeof data.obj_ver === 'string') lastObjVer = data.obj_ver;
        if (typeof data.state_ver === 'string') lastStateVer = data.state_ver;
        if (!data.objects_unchanged && data.objects) {
          window.applyCampusWorldObjects(data.objects);
        }
        if (!data.state_unchanged && data.world_state && window.applyCampusWorldState) {
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

    var actionBtn = $('btn-mobile-action');
    if (actionBtn) {
      var actionTouchId = null;
      var lastActionX = 0;
      var lastActionY = 0;

      actionBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var t = e.changedTouches[0];
        if (!t) return;
        actionTouchId = t.identifier;
        lastActionX = t.clientX;
        lastActionY = t.clientY;
        actionBtn.classList.add('action-active');
        if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(true);
      }, { passive: false });

      window.addEventListener('touchmove', function (e) {
        if (actionTouchId === null) return;
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === actionTouchId) {
            var dx = t.clientX - lastActionX;
            var dy = t.clientY - lastActionY;
            lastActionX = t.clientX;
            lastActionY = t.clientY;
            if (window.rotateCampusCamera) {
              window.rotateCampusCamera(dx, dy);
            }
            break;
          }
        }
      }, { passive: true });

      var endAction = function (e) {
        if (actionTouchId === null) return;
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === actionTouchId) {
            actionTouchId = null;
            actionBtn.classList.remove('action-active');
            if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(false);
            break;
          }
        }
      };
      window.addEventListener('touchend', endAction, { passive: true });
      window.addEventListener('touchcancel', endAction, { passive: true });

      // Suporte para mouse (testes em emulador desktop)
      actionBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        actionBtn.classList.add('action-active');
        if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(true);
        var lastMX = e.clientX;
        var lastMY = e.clientY;
        function onMouseMove(ev) {
          var dx = ev.clientX - lastMX;
          var dy = ev.clientY - lastMY;
          lastMX = ev.clientX;
          lastMY = ev.clientY;
          if (window.rotateCampusCamera) {
            window.rotateCampusCamera(dx, dy);
          }
        }
        function onMouseUp() {
          actionBtn.classList.remove('action-active');
          if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(false);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          window.removeEventListener('blur', onMouseUp);
        }
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onMouseUp);
      });
    }
  }

  function updateFpsUi(fps) {
    inFpsState = fps;
    var btnFps = $('btn-toggle-fps');
    if (btnFps) btnFps.textContent = fps ? '🌍 Vista Aérea' : '🎥 1ª Pessoa';
    var crosshair = $('crosshair');
    if (crosshair) crosshair.style.display = fps ? 'block' : 'none';
    var joyZone = $('mobile-joystick-zone');
    var mobActs = $('mobile-actions');
    if (fps && isTouch()) {
      if (joyZone) joyZone.style.display = 'block';
      if (mobActs) mobActs.style.display = 'flex';
    } else {
      if (joyZone) joyZone.style.display = 'none';
      if (mobActs) mobActs.style.display = 'none';
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
      onHarvestGreenhouse: function (slot) {
        harvestGreenhouseSlot(slot);
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
      onLabStep: function (stepKey) {
        completeLabStep(stepKey);
      },
      onToast: function (msg) {
        showFloatingToast(msg, 3500);
      },
      onNearScreen: function (near) {
        var tb = $('prof-toolbar');
        if (tb) tb.classList.add('hidden');
      },
      onHoldChange: function (label) {
        var rotBtn = $('btn-mobile-rotate');
        if (rotBtn) rotBtn.style.display = (label && isTouch()) ? 'flex' : 'none';
        var actBtn = $('btn-mobile-action');
        if (actBtn) {
          if (!isTouch() || !label) {
            actBtn.style.display = 'none';
          } else if (label.indexOf('Giz') !== -1 || label.indexOf('chalk') !== -1) {
            actBtn.style.display = 'flex';
            actBtn.textContent = '✏️';
            actBtn.title = 'Desenhar na Lousa (segure e arraste o dedo para pintar)';
          } else if (label.indexOf('Apagador') !== -1 || label.indexOf('eraser') !== -1) {
            actBtn.style.display = 'flex';
            actBtn.textContent = '🧽';
            actBtn.title = 'Apagar Lousa (segure e arraste o dedo para apagar)';
          } else if (label.indexOf('Borrifador') !== -1 || label.indexOf('Álcool') !== -1) {
            actBtn.style.display = 'flex';
            actBtn.textContent = '💦';
            actBtn.title = 'Borrifar / Soltar';
          } else if (label.indexOf('Termômetro') !== -1) {
            actBtn.style.display = 'flex';
            actBtn.textContent = '🌡️';
            actBtn.title = 'Medir Temperatura';
          } else if (label.indexOf('Seringa') !== -1) {
            actBtn.style.display = 'flex';
            actBtn.textContent = '💉';
            actBtn.title = 'Usar Seringa';
          } else {
            actBtn.style.display = 'flex';
            actBtn.textContent = '✋';
            actBtn.title = 'Soltar / Usar Item';
          }
        }
      },
      onFpsChange: updateFpsUi,
      onQualityChange: function (info) {
        var qBtn = $('btn-quality');
        if (!qBtn || !info) return;
        var labels = { high: 'Alto', medium: 'Méd', low: 'Desemp', min: 'Mín' };
        var tierTxt = labels[info.tier] || info.tier;
        var prefix = info.mode === 'auto' ? 'Auto (' + tierTxt + ')' : tierTxt;
        var fpsTxt = info.fps > 0 ? ' • ' + info.fps + 'fps' : '';
        qBtn.textContent = '⚡ ' + prefix + fpsTxt;
        qBtn.className = 'px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 font-bold border whitespace-nowrap ' +
          (info.tier === 'min' || info.tier === 'low' ? 'text-amber-300 border-amber-500/40' : 'text-cyan-300 border-cyan-500/40');
      },
      onHoverPrompt: function (txt) {
        var pill = $('interact-pill');
        if (pill && Date.now() >= toastUntil) {
          if (txt && currentUser) {
            pill.textContent = txt;
            pill.classList.remove('hidden');
          } else {
            pill.classList.add('hidden');
          }
        }
        var actBtn = $('btn-mobile-action');
        var isHolding = window.getCampusPlayerPose && window.getCampusPlayerPose().holding_item;
        if (actBtn && !isHolding) {
          if (isTouch() && txt && currentUser) {
            actBtn.style.display = 'flex';
            actBtn.textContent = '✋';
            actBtn.title = txt;
          } else {
            actBtn.style.display = 'none';
          }
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

      var data;
      try {
        data = await apiPost('api/auth.php?action=login', {
          display_name: $('input-name').value.trim(),
          pin: $('input-pin').value,
          hat_color: selectedHat,
          body_color: selectedBody
        });
      } catch (err) {
        console.error('[MycoCampus3D] Erro de rede no login:', err);
        errBox.textContent = 'Falha ao conectar com o servidor. Tente novamente em instantes.';
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '🚀 Entrar no Campus 3D';
        return;
      }
      if (!data.ok) {
        errBox.textContent = data.error || 'Erro ao autenticar.';
        errBox.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '🚀 Entrar no Campus 3D';
        return;
      }
      try {
        enterCampus(data.user, data.token || '');
      } catch (uiErr) {
        console.error('[MycoCampus3D] Erro ao iniciar o campus após login:', uiErr);
        errBox.textContent = 'Erro ao iniciar a interface do campus: ' + (uiErr && uiErr.message ? uiErr.message : 'erro interno.');
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

    var btnQuality = $('btn-quality');
    if (btnQuality && window.setCampusQualityMode && window.getCampusQualityState) {
      var qModes = ['auto', 'high', 'medium', 'low', 'min'];
      btnQuality.onclick = function (e) {
        e.stopPropagation();
        if (window.MycoAudio) window.MycoAudio.playClick();
        var cur = window.getCampusQualityState();
        var idx = qModes.indexOf(cur.mode);
        var nextMode = qModes[(idx + 1) % qModes.length];
        window.setCampusQualityMode(nextMode);
      };
    }

    var fsBtn = $('btn-fullscreen');
    if (fsBtn) {
      fsBtn.onclick = function (e) {
        e.stopPropagation();
        toggleCampusFullscreen();
      };
    }

    var btnToggleFps = $('btn-toggle-fps');
    if (btnToggleFps) btnToggleFps.onclick = function () { window.setCampusFpsMode(!inFpsState); };
    var btnLogout = $('btn-logout');
    if (btnLogout) btnLogout.onclick = logoutCampus;
    var btnOpenLessons = $('btn-open-lessons');
    if (btnOpenLessons) btnOpenLessons.onclick = function () { releaseInputForModal(); renderLessonsModal(); var m = $('lesson-modal'); if (m) m.classList.remove('hidden'); };
    var btnCloseLessons = $('btn-close-lessons');
    if (btnCloseLessons) btnCloseLessons.onclick = function () { var m = $('lesson-modal'); if (m) m.classList.add('hidden'); };
    var btnOpenRanking = $('btn-open-ranking');
    if (btnOpenRanking) btnOpenRanking.onclick = openRankingModal;
    var btnCloseRanking = $('btn-close-ranking');
    if (btnCloseRanking) btnCloseRanking.onclick = function () { var m = $('ranking-modal'); if (m) m.classList.add('hidden'); };

    var btnMap = $('btn-open-map');
    if (btnMap) {
      btnMap.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        releaseInputForModal();
        renderMapModal();
        var mm = $('map-modal');
        if (mm) mm.classList.remove('hidden');
      };
    }
    var btnCloseMap = $('btn-close-map');
    if (btnCloseMap) {
      btnCloseMap.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        var mm = $('map-modal');
        if (mm) mm.classList.add('hidden');
      };
    }

    var btnQuest = $('btn-open-quest');
    if (btnQuest) {
      btnQuest.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        releaseInputForModal();
        renderQuestModal();
        var qm = $('quest-modal');
        if (qm) qm.classList.remove('hidden');
      };
    }
    var btnCloseQuest = $('btn-close-quest');
    if (btnCloseQuest) {
      btnCloseQuest.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        var qm = $('quest-modal');
        if (qm) qm.classList.add('hidden');
      };
    }

    var btnShop = $('btn-open-shop');
    if (btnShop) {
      btnShop.onclick = function () {
        if (window.MycoAudio) window.MycoAudio.playClick();
        releaseInputForModal();
        renderShopModal();
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
    if (btnOpenAdmin) btnOpenAdmin.onclick = openAdminModal;
    var btnCloseAdmin = $('btn-close-admin');
    if (btnCloseAdmin) btnCloseAdmin.onclick = closeAdminModal;
    var btnRefreshAdmin = $('btn-admin-refresh');
    if (btnRefreshAdmin) btnRefreshAdmin.onclick = loadAdminUsers;
    var btnAdminResetWorld = $('btn-admin-reset-world');
    if (btnAdminResetWorld) {
      btnAdminResetWorld.onclick = async function () {
        try {
          var rw = await apiPost('api/multiplayer.php?action=reset_world', {}, true);
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
    var searchAdminInput = $('admin-search-input');
    if (searchAdminInput) {
      searchAdminInput.addEventListener('focus', function () {
        if (window.clearCampusKeys) window.clearCampusKeys();
      });
      searchAdminInput.addEventListener('input', function () {
        renderAdminUsers(adminUsersCache);
      });
    }

    // Otimizacao inteligente de bateria e conexao: reduz polling se a aba estiver em segundo plano
    document.addEventListener('visibilitychange', function () {
      if (!currentUser) return;
      if (document.hidden) {
        if (syncTimer) clearInterval(syncTimer);
        syncTimer = setInterval(syncMultiplayer, 1200);
      } else {
        if (syncTimer) clearInterval(syncTimer);
        syncMultiplayer();
        syncTimer = setInterval(syncMultiplayer, SYNC_INTERVAL_MS);
      }
    });

    var btnResetLab = $('btn-reset-lab');
    if (btnResetLab) {
      btnResetLab.onclick = async function () {
        window.resetCampusWorldObjects();
        try { await apiPost('api/multiplayer.php?action=reset_world', {}, true); } catch (e) { /* silent */ }
      };
    }

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

    var chatForm = $('chat-form');
    if (chatForm) {
      chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitChatMessage();
      });
    }

    var chatInput = $('chat-input');
    if (chatInput) {
      chatInput.addEventListener('focus', function () {
        if (window.clearCampusKeys) window.clearCampusKeys();
      });

      chatInput.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          this.blur();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          submitChatMessage();
        }
      });
    }

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

