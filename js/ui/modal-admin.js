/**
 * MycoCampus3D — Modal de Ranking & Painel Master Admin
 */
import { LESSONS } from '../core/lessons-data.js';
import { appState } from '../core/state.js';
import { apiGet, apiPost } from '../services/api-client.js';
import { $, escapeHtml, releaseInputForModal, showFloatingToast } from './dom-helpers.js';

let adminUsersCache = [];

export function getAdminUsersCache() {
  return adminUsersCache;
}

export async function openRankingModal() {
  releaseInputForModal();
  const modal = $('ranking-modal');
  if (modal) modal.classList.remove('hidden');
  const body = $('ranking-body');
  if (!body) return;
  body.innerHTML = '<div class="text-slate-400">Carregando ranking...</div>';
  try {
    const data = await apiGet('api/auth.php?action=leaderboard');
    if (!data.ok) {
      body.innerHTML = `<div class="text-rose-300">${escapeHtml(data.error || 'Erro ao carregar')}</div>`;
      return;
    }
    const totalModules = data.total_modules || LESSONS.length;
    body.innerHTML = '';
    if (!(data.leaders || []).length) {
      body.innerHTML = '<div class="text-slate-400">Nenhum estudante ainda. Seja o primeiro! 🍄</div>';
    }
    (data.leaders || []).forEach((u, i) => {
      const row = document.createElement('div');
      const isMe = appState.currentUser && u.id === appState.currentUser.id;
      row.className = 'flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border ' + (isMe ? 'border-emerald-400/30' : 'border-slate-800');
      const roleTag = (u.role === 'professor' || u.role === 'admin') ? '👨‍🏫 ' : '🎓 ';
      row.innerHTML =
        `<div class="flex items-center gap-2"><span class="font-extrabold text-amber-300 w-5">#${i + 1}</span>` +
        `<span class="font-bold text-white">${roleTag}${escapeHtml(u.display_name)}</span></div>` +
        `<div class="flex items-center gap-3 text-slate-300">` +
        `<span>📚 ${(u.completed_modules || []).length}/${totalModules}</span>` +
        `<span>🍄 ${parseInt(u.mushrooms_harvested, 10) || 0}</span>` +
        `<span class="font-extrabold text-emerald-300">⭐ ${parseInt(u.xp, 10) || 0} XP</span></div>`;
      body.appendChild(row);
    });
  } catch (e) {
    body.innerHTML = '<div class="text-rose-300">Erro de conexão com o servidor.</div>';
  }
}

export function showAdminNotice(msg, isError) {
  const el = $('admin-notice');
  if (!el) return;
  el.textContent = msg;
  el.className = 'mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-semibold ' +
    (isError ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200' : 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-200');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

export async function loadAdminUsers() {
  const listEl = $('admin-user-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="text-center text-slate-400 py-8">Carregando jogadores do MySQL...</div>';
  try {
    const data = await apiPost('api/auth.php?action=admin_list_users', {}, true);
    if (!data.ok) {
      listEl.innerHTML = `<div class="text-rose-300 p-4">${escapeHtml(data.error || 'Erro ao carregar lista.')}</div>`;
      return;
    }
    adminUsersCache = data.users || [];
    renderAdminUsers(adminUsersCache);
  } catch (e) {
    listEl.innerHTML = '<div class="text-rose-300 p-4">Erro de conexão ao buscar jogadores.</div>';
  }
}

export function renderAdminUsers(users) {
  const listEl = $('admin-user-list');
  if (!listEl) return;
  const searchVal = ($('admin-search-input') ? $('admin-search-input').value : '').toLowerCase().trim();
  const filtered = (users || []).filter((u) => {
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
  filtered.forEach((u) => {
    const card = document.createElement('div');
    const isMe = appState.currentUser && u.id === appState.currentUser.id;
    const roleBadge = u.role === 'admin'
      ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-400/40 font-bold">👑 Admin</span>'
      : (u.role === 'professor'
        ? '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold">👨‍🏫 Professor</span>'
        : '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">🎓 Aluno</span>');

    const onlineStatus = u.is_online
      ? '<span class="flex items-center gap-1 text-emerald-400 font-bold"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Online</span>'
      : '<span class="text-slate-500">Offline</span>';

    card.className = 'p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3';
    card.innerHTML =
      `<div class="flex items-center gap-3">` +
      `<div class="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center font-bold text-xs" style="background-color:${escapeHtml(u.hat_color)}; color:#fff;">` +
      escapeHtml((u.display_name || '?').slice(0, 2).toUpperCase()) +
      `</div><div><div class="flex items-center gap-2">` +
      `<span class="font-bold text-white text-sm">${escapeHtml(u.display_name)}</span>` +
      `<span class="text-slate-400 text-[11px]">(@${escapeHtml(u.username)})</span>${roleBadge}</div>` +
      `<div class="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">` +
      `${onlineStatus}<span>⭐ ${u.xp || 0} XP</span><span>🍄 ${u.mushrooms_harvested || 0} colheitas</span>` +
      `<span>📚 ${u.completed_modules_count || 0}/5 módulos</span></div></div></div>`;

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'flex flex-wrap items-center gap-1.5 justify-end';

    if (!isMe) {
      if (u.is_online) {
        const btnPull = document.createElement('button');
        btnPull.type = 'button';
        btnPull.className = 'px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 border border-sky-400/40 text-sky-200 text-[11px] font-semibold';
        btnPull.textContent = '🧲 Puxar';
        btnPull.title = 'Trazer este jogador até a sua posição';
        btnPull.onclick = async () => {
          const myPos = window.getCampusPlayerPos ? window.getCampusPlayerPos() : { x: 0, y: 0, z: 14.5, yaw: 0 };
          try {
            const r = await apiPost('api/auth.php?action=admin_teleport', {
              target_id: u.id, x: myPos.x, y: myPos.y, z: myPos.z, yaw: myPos.yaw
            }, true);
            if (r.ok) showAdminNotice(`Jogador ${u.display_name} teletransportado até você!`, false);
            else showAdminNotice(r.error || 'Erro ao teletransportar.', true);
          } catch (e) { showAdminNotice('Falha na requisição.', true); }
        };
        actionsWrap.appendChild(btnPull);

        if (u.pos && window.teleportCampusPlayer) {
          const btnGo = document.createElement('button');
          btnGo.type = 'button';
          btnGo.className = 'px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold';
          btnGo.textContent = '🚀 Ir até';
          btnGo.title = 'Teletransportar seu avatar até este jogador';
          btnGo.onclick = () => {
            window.teleportCampusPlayer(u.pos.x, u.pos.y, u.pos.z, 0);
            $('admin-modal').classList.add('hidden');
            showFloatingToast(`🚀 Você foi até ${u.display_name}!`);
          };
          actionsWrap.appendChild(btnGo);
        }
      }

      const nextRole = u.role === 'student' ? 'professor' : 'student';
      const btnRole = document.createElement('button');
      btnRole.type = 'button';
      btnRole.className = 'px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-400/40 text-amber-200 text-[11px] font-semibold';
      btnRole.textContent = u.role === 'student' ? '👨‍🏫 Promover Prof.' : '🎓 Rebaixar Aluno';
      btnRole.onclick = async () => {
        try {
          const r = await apiPost('api/auth.php?action=admin_set_role', { target_id: u.id, new_role: nextRole }, true);
          if (r.ok) {
            showAdminNotice(`Cargo de ${u.display_name} alterado com sucesso!`, false);
            loadAdminUsers();
          } else {
            showAdminNotice(r.error || 'Erro ao alterar cargo.', true);
          }
        } catch (e) { showAdminNotice('Falha na requisição.', true); }
      };
      actionsWrap.appendChild(btnRole);

      if (u.is_online) {
        const btnKick = document.createElement('button');
        btnKick.type = 'button';
        btnKick.className = 'px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 border border-rose-400/40 text-rose-200 text-[11px] font-semibold';
        btnKick.textContent = '🚫 Desconectar';
        btnKick.title = 'Desconectar a sessão deste jogador';
        btnKick.onclick = async () => {
          if (!confirm(`Deseja realmente desconectar o jogador "${u.display_name}"?`)) return;
          try {
            const r = await apiPost('api/auth.php?action=admin_kick', { target_id: u.id }, true);
            if (r.ok) {
              showAdminNotice(`Jogador ${u.display_name} desconectado com sucesso!`, false);
              loadAdminUsers();
            } else {
              showAdminNotice(r.error || 'Erro ao desconectar.', true);
            }
          } catch (e) { showAdminNotice('Falha na requisição.', true); }
        };
        actionsWrap.appendChild(btnKick);
      }
    } else {
      const meTag = document.createElement('span');
      meTag.className = 'text-xs text-amber-300 font-bold px-2';
      meTag.textContent = '(Você)';
      actionsWrap.appendChild(meTag);
    }

    card.appendChild(actionsWrap);
    listEl.appendChild(card);
  });
}

export function openAdminModal() {
  const m = $('admin-modal');
  if (!m) return;
  releaseInputForModal();
  m.classList.remove('hidden');
  loadAdminUsers();
}

export function closeAdminModal() {
  const m = $('admin-modal');
  if (m) m.classList.add('hidden');
}
