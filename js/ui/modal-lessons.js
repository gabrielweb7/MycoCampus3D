/**
 * MycoCampus3D — Modal de Aulas & Projeção no Auditório
 */
import { LESSONS } from '../core/lessons-data.js';
import { appState } from '../core/state.js';
import { apiPost } from '../services/api-client.js';
import { preserveNewerPetState } from '../services/pets.js';
import { $, escapeHtml } from './dom-helpers.js';
import { applySlideTo3D, updateUserHud } from './hud-lobby.js';

export async function completeModule(slug, answerText) {
  if (!appState.currentUser) return;
  try {
    const data = await apiPost('api/auth.php?action=complete_module', { module: slug, answer: answerText || '' }, true);
    if (data.ok && data.user) {
      if (appState.currentUser?.id !== data.user.id) return;
      appState.currentUser = preserveNewerPetState(appState.currentUser, data.user);
      updateUserHud();
    }
  } catch (e) {}
}

export async function broadcastSlide(newIdx) {
  const clamped = ((newIdx % LESSONS.length) + LESSONS.length) % LESSONS.length;
  applySlideTo3D(clamped, appState.currentUser ? appState.currentUser.display_name : '');
  if (!appState.currentUser) return;
  try {
    await apiPost('api/multiplayer.php?action=set_slide', { slide_index: clamped }, true);
  } catch (e) {}
}

export function renderLessonsModal() {
  const body = $('lessons-body');
  if (!body) return;
  body.innerHTML = '';
  const doneList = (appState.currentUser && appState.currentUser.completed_modules) || [];
  const isProf = appState.currentUser && (appState.currentUser.role === 'professor' || appState.currentUser.role === 'admin');

  LESSONS.forEach((lesson, idx) => {
    const isDone = doneList.indexOf(lesson.slug) !== -1;
    const card = document.createElement('div');
    card.className = 'rounded-xl bg-slate-900/75 border ' + (isDone ? 'border-emerald-500/50' : 'border-slate-700/70') + ' p-4 space-y-2.5';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-2';
    header.innerHTML =
      `<div><div class="font-bold text-white">${idx + 1}. ${escapeHtml(lesson.title)}</div>` +
      `<div class="text-xs text-slate-400">${escapeHtml(lesson.subtitle)}</div></div>` +
      `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ` +
      (isDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300') + `">` +
      (isDone ? '✅ Concluído' : '+50 XP') + `</span>`;
    card.appendChild(header);

    const ul = document.createElement('div');
    ul.className = 'text-xs text-slate-300 space-y-1';
    ul.innerHTML = lesson.bullets.map((b) => `<div>${escapeHtml(b)}</div>`).join('');
    card.appendChild(ul);

    if (isProf) {
      const projBtn = document.createElement('button');
      projBtn.type = 'button';
      projBtn.className = 'px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-300 text-xs font-bold';
      projBtn.textContent = '📺 Projetar este Slide no Auditório 3D';
      projBtn.onclick = () => broadcastSlide(idx);
      card.appendChild(projBtn);
    }

    const qBox = document.createElement('div');
    qBox.className = 'pt-2 border-t border-slate-800 space-y-1.5';
    const qTitle = document.createElement('div');
    qTitle.className = 'text-xs font-semibold text-sky-300';
    qTitle.textContent = 'Desafio Prático: ' + lesson.question;
    qBox.appendChild(qTitle);

    const feedback = document.createElement('div');
    feedback.className = 'text-xs font-semibold hidden';

    lesson.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full text-left px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition';
      btn.textContent = opt.text;
      btn.onclick = () => {
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
