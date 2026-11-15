/**
 * MycoCampus 3D — UI Modals, HUD, Shop, Lessons, Ranking & Admin Panel
 */
(function () {
  'use strict';

  var CFG = window.MycoConfig;
  var App = window.MycoApp;
  var $ = App.$;
  var escapeHtml = App.escapeHtml;

  App.renderSwatches = function () {
    var hatWrap = $('hat-swatches');
    var bodyWrap = $('body-swatches');
    if (!hatWrap || !bodyWrap) return;
    hatWrap.innerHTML = '';
    bodyWrap.innerHTML = '';

    CFG.HAT_COLORS.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch-btn' + (hex === App.selectedHat ? ' active' : '');
      b.style.backgroundColor = hex;
      b.onclick = function () { App.selectedHat = hex; App.renderSwatches(); };
      hatWrap.appendChild(b);
    });

    CFG.BODY_COLORS.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch-btn' + (hex === App.selectedBody ? ' active' : '');
      b.style.backgroundColor = hex;
      b.onclick = function () { App.selectedBody = hex; App.renderSwatches(); };
      bodyWrap.appendChild(b);
    });
  };

  App.updateUserHud = function () {
    var u = App.currentUser;
    if (!u) return;
    $('hud-name').textContent = u.display_name;
    $('hud-xp').textContent = String(u.xp || 0);
    $('hud-mushrooms').textContent = String(u.mushrooms_harvested || 0);
    $('hud-modules').textContent = String((u.completed_modules || []).length);
    if ($('shop-user-xp')) $('shop-user-xp').textContent = String(u.xp || 0);
    if ($('shop-user-mushrooms')) $('shop-user-mushrooms').textContent = String(u.mushrooms_harvested || 0);
    if (window.setLocalAvatarHat) {
      window.setLocalAvatarHat(u.current_hat || 'default');
    }

    var isMaster = (u.role === 'admin') || (u.username === 'gabrieldaluz');
    var isMod = (u.role === 'moderator');

    var badge = $('hud-role-badge');
    if (isMaster) {
      badge.textContent = '👑 Master Admin';
      badge.className = 'px-2 py-0.5 rounded-full font-bold bg-amber-500/30 text-amber-300 border border-amber-400/50 shadow-sm';
    } else if (u.role === 'professor') {
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
  };

  App.renderShopModal = function () {
    var grid = $('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var u = App.currentUser;
    var userXp = u ? (u.xp || 0) : 0;
    var userMush = u ? (u.mushrooms_harvested || 0) : 0;
    var unlocked = (u && u.unlocked_hats) || ['default'];
    var currentHat = (u && u.current_hat) || 'default';

    if ($('shop-user-xp')) $('shop-user-xp').textContent = String(userXp);
    if ($('shop-user-mushrooms')) $('shop-user-mushrooms').textContent = String(userMush);

    CFG.COSMETIC_HATS.forEach(function (hat) {
      var isEquipped = currentHat === hat.id;
      var isUnlocked = unlocked.indexOf(hat.id) !== -1 || hat.id === 'default';
      var canUnlock = userXp >= hat.req_xp && userMush >= hat.req_mushrooms;

      var card = document.createElement('div');
      card.className = 'glass-panel rounded-xl p-3 flex flex-col justify-between border ' +
        (isEquipped ? 'border-emerald-400/60 shadow-lg' : (isUnlocked ? 'border-purple-500/40' : 'border-slate-700/50'));

      var top = document.createElement('div');
      top.className = 'space-y-1.5';
      top.innerHTML =
        '<div class="flex items-center gap-2">' +
          '<span class="text-2xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">' + hat.icon + '</span>' +
          '<div>' +
            '<div class="font-bold text-white text-xs">' + escapeHtml(hat.name) + '</div>' +
            '<div class="text-[11px] text-slate-400">' + escapeHtml(hat.desc) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-2 pt-1 text-[11px] text-slate-300 font-semibold">' +
          (hat.req_xp > 0 ? '<span class="text-amber-300">⭐ ' + hat.req_xp + ' XP</span>' : '<span class="text-emerald-300">Grátis</span>') +
          (hat.req_mushrooms > 0 ? '<span class="text-emerald-300">• 🍄 ' + hat.req_mushrooms + ' colheitas</span>' : '') +
        '</div>';
      card.appendChild(top);

      var btnWrap = document.createElement('div');
      btnWrap.className = 'pt-3';
      if (isEquipped) {
        btnWrap.innerHTML = '<button disabled class="w-full py-1.5 rounded-lg bg-emerald-600/80 text-white font-bold text-xs shadow-sm">✅ Equipado</button>';
      } else if (isUnlocked) {
        var equipBtn = document.createElement('button');
        equipBtn.className = 'w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition';
        equipBtn.textContent = 'Equipar';
        equipBtn.onclick = async function () {
          try {
            if (window.MycoAudio) window.MycoAudio.playClick();
            var res = await App.apiPost('api/auth.php?action=equip_cosmetic', { hat_id: hat.id }, true);
            if (res.ok && res.user) {
              App.currentUser = res.user;
              window.setLocalAvatarHat(hat.id);
              App.updateUserHud();
              App.renderShopModal();
            }
          } catch (e) { /* silent */ }
        };
        btnWrap.appendChild(equipBtn);
      } else if (canUnlock) {
        var buyBtn = document.createElement('button');
        buyBtn.className = 'w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow transition';
        buyBtn.textContent = '🎉 Desbloquear';
        buyBtn.onclick = async function () {
          try {
            if (window.MycoAudio) window.MycoAudio.playClick();
            var res = await App.apiPost('api/auth.php?action=buy_cosmetic', { hat_id: hat.id }, true);
            if (res.ok && res.user) {
              App.currentUser = res.user;
              window.setLocalAvatarHat(hat.id);
              if (window.playCampusEmote) window.playCampusEmote('cheer');
              App.updateUserHud();
              App.renderShopModal();
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
  };

  App.applySlideTo3D = function (idx, presenter) {
    var s = CFG.LESSONS[idx] || CFG.LESSONS[0];
    App.currentSlideIdx = idx;
    App.currentPresenter = presenter || '';
    $('prof-slide-label').textContent = 'Slide ' + (idx + 1) + '/' + CFG.LESSONS.length;
    window.updateCampusAuditoriumSlide(idx, s.title, s.subtitle, s.bullets, presenter);
  };

  App.broadcastSlide = async function (newIdx) {
    var len = CFG.LESSONS.length;
    var clamped = ((newIdx % len) + len) % len;
    App.applySlideTo3D(clamped, App.currentUser ? App.currentUser.display_name : '');
    if (!App.currentUser) return;
    try {
      await App.apiPost('api/multiplayer.php?action=set_slide', { slide_index: clamped }, true);
    } catch (e) { /* silent */ }
  };

  App.renderLessonsModal = function () {
    var body = $('lessons-body');
    body.innerHTML = '';
    var doneList = (App.currentUser && App.currentUser.completed_modules) || [];
    var isProf = App.currentUser && (App.currentUser.role === 'professor' || App.currentUser.role === 'admin');

    CFG.LESSONS.forEach(function (lesson, idx) {
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
        projBtn.onclick = function () { App.broadcastSlide(idx); };
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
            if (!isDone && App.completeModule) {
              App.completeModule(lesson.slug, opt.text).then(App.renderLessonsModal);
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
  };

  App.openRankingModal = async function () {
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
      var totalModules = data.total_modules || CFG.LESSONS.length;
      body.innerHTML = '';
      if (!(data.leaders || []).length) {
        body.innerHTML = '<div class="text-slate-400">Nenhum estudante ainda. Seja o primeiro! 🍄</div>';
      }
      (data.leaders || []).forEach(function (u, i) {
        var row = document.createElement('div');
        var isMe = App.currentUser && u.id === App.currentUser.id;
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
  };

  App.loadLobbyStats = async function () {
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
  };

  App.showAdminNotice = function (msg, isError) {
    var el = $('admin-notice');
    if (!el) return;
    el.textContent = msg;
    el.className = 'mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-semibold ' +
      (isError ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200' : 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-200');
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 4000);
  };

  App.loadAdminUsers = async function () {
    var listEl = $('admin-user-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="text-center text-slate-400 py-8">Carregando jogadores do MySQL...</div>';
    try {
      var data = await App.apiPost('api/auth.php?action=admin_list_users', {}, true);
      if (!data.ok) {
        listEl.innerHTML = '<div class="text-rose-300 p-4">' + escapeHtml(data.error || 'Erro ao carregar lista.') + '</div>';
        return;
      }
      App.adminUsersCache = data.users || [];
      App.renderAdminUsers(App.adminUsersCache);
    } catch (e) {
      listEl.innerHTML = '<div class="text-rose-300 p-4">Erro de conexão ao buscar jogadores.</div>';
    }
  };

  App.renderAdminUsers = function (users) {
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
      var isMe = App.currentUser && u.id === App.currentUser.id;
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
              var r = await App.apiPost('api/auth.php?action=admin_teleport', {
                target_id: u.id, x: myPos.x, y: myPos.y, z: myPos.z, yaw: myPos.yaw
              }, true);
              if (r.ok) App.showAdminNotice('Jogador ' + u.display_name + ' teletransportado até você!', false);
              else App.showAdminNotice(r.error || 'Erro ao teletransportar.', true);
            } catch (e) { App.showAdminNotice('Falha na requisição.', true); }
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
              App.showFloatingToast('🚀 Você foi até ' + u.display_name + '!');
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
            var r = await App.apiPost('api/auth.php?action=admin_set_role', { target_id: u.id, new_role: nextRole }, true);
            if (r.ok) {
              App.showAdminNotice('Cargo de ' + u.display_name + ' alterado com sucesso!', false);
              App.loadAdminUsers();
            } else {
              App.showAdminNotice(r.error || 'Erro ao alterar cargo.', true);
            }
          } catch (e) { App.showAdminNotice('Falha na requisição.', true); }
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
              var r = await App.apiPost('api/auth.php?action=admin_kick', { target_id: u.id }, true);
              if (r.ok) {
                App.showAdminNotice('Jogador ' + u.display_name + ' desconectado com sucesso!', false);
                App.loadAdminUsers();
              } else {
                App.showAdminNotice(r.error || 'Erro ao desconectar.', true);
              }
            } catch (e) { App.showAdminNotice('Falha na requisição.', true); }
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
  };

  App.openAdminModal = function () {
    var m = $('admin-modal');
    if (!m) return;
    m.classList.remove('hidden');
    App.loadAdminUsers();
  };

  App.closeAdminModal = function () {
    var m = $('admin-modal');
    if (m) m.classList.add('hidden');
  };
})();
