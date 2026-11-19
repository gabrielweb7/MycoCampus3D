/**
 * MycoCampus3D — Modal de Novidades da Atualização (fecha apenas pelos botões)
 * Funciona tanto no PC quanto no Mobile (layout responsivo, touch-action: manipulation).
 */

import { releaseInputForModal } from './dom-helpers.js';

const STORAGE_SEEN_KEY = 'myco_seen_whats_new_v';
const JUST_UPDATED_KEY = 'myco_just_updated_v';

export const RELEASE_NOTES_CATALOG = {
  '1.8.1': {
    title: '✨ Novidades da Atualização v1.8.1',
    subtitle: 'Correção de carregamento + tudo que chegou na v1.8:',
    items: [
      { icon: '🛠️', text: 'Correção crítica: corrigido travamento na tela ao iniciar o Campus 3D (poças de chuva) e janela de novidades agora fecha só pelos botões (PC e Celular)!' },
      { icon: '🔭', text: 'Luneta Astronômica na Praça: clique nela para dar zoom de 2.8x nas constelações e estrelas cadentes da noite!' },
      { icon: '🧬', text: 'Cruzamento Genético (Albino & Dourado): use o bisturi com micélio sobre outra Placa colonizada no Fluxo Laminar para criar cepas F1 raras!' },
      { icon: '🧺', text: 'Cestas Orgânicas da Horta: cada 3 tomates/alfaces colhidos rendem uma Cesta vendável no Empório Drive-Thru (+🪙 240)!' },
      { icon: '🏆', text: 'Placar 3D na Quadra + Combo de Basquete/Futebol pagando +🪙 15 a +🪙 25 por gol ou cesta!' },
      { icon: '💧', text: 'Poças reflexivas na Praça quando chove (1 único instanced draw call que some ao secar) + luz nas janelas à noite!' }
    ]
  },
  '1.8.0': {
    title: '✨ Novidades da Atualização v1.8.0',
    subtitle: 'Novas mecânicas incríveis mantendo o FPS leve! Veja o que chegou:',
    items: [
      { icon: '🔭', text: 'Luneta Astronômica na Praça: clique nela para dar zoom de 2.8x nas constelações e estrelas cadentes da noite!' },
      { icon: '🧬', text: 'Cruzamento Genético (Albino & Dourado): use o bisturi com micélio sobre outra Placa colonizada no Fluxo Laminar para criar cepas F1 raras!' },
      { icon: '🧺', text: 'Cestas Orgânicas da Horta: cada 3 tomates/alfaces colhidos rendem uma Cesta vendável no Empório Drive-Thru (+🪙 240)!' },
      { icon: '🏆', text: 'Placar 3D na Quadra + Combo de Basquete/Futebol pagando +🪙 15 a +🪙 25 por gol ou cesta!' },
      { icon: '💧', text: 'Poças reflexivas na Praça quando chove (1 único instanced draw call que some ao secar) + luz nas janelas à noite!' }
    ]
  }
};

function getCurrentNotes(ver) {
  if (ver && RELEASE_NOTES_CATALOG[ver]) return RELEASE_NOTES_CATALOG[ver];
  const latestKey = Object.keys(RELEASE_NOTES_CATALOG)[0];
  return RELEASE_NOTES_CATALOG[latestKey] || null;
}

export function markPendingAutoUpdateNotice(newVer) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_SEEN_KEY);
      if (newVer) localStorage.setItem(JUST_UPDATED_KEY, String(newVer));
    }
  } catch (e) {}
}

export function closeWhatsNewModal() {
  const el = typeof document !== 'undefined' ? document.getElementById('whats-new-modal') : null;
  if (el) el.classList.add('hidden');
}

function bindCloseButton(btn) {
  if (!btn) return;
  const stopOnly = (e) => e.stopPropagation();
  btn.addEventListener('pointerdown', stopOnly);
  btn.addEventListener('touchstart', stopOnly, { passive: true });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.MycoAudio && window.MycoAudio.playClick) {
      window.MycoAudio.playClick();
    }
    closeWhatsNewModal();
  });
}

function ensureWhatsNewModalDom() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('whats-new-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'whats-new-modal';
  modal.className = 'hidden fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm pointer-events-auto overflow-y-auto';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div id="whats-new-card" class="glass-panel max-w-md w-full max-h-[90dvh] flex flex-col rounded-2xl border border-emerald-400/50 bg-slate-900/95 shadow-2xl overflow-hidden text-slate-100 my-auto">
      <div class="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-900/90 shrink-0">
        <div class="min-w-0">
          <h2 id="whats-new-title" class="text-sm sm:text-base font-extrabold text-emerald-300 truncate">✨ Novidades da Atualização</h2>
          <p id="whats-new-subtitle" class="text-[11px] sm:text-xs text-slate-300 truncate">Veja o que foi melhorado no jogo:</p>
        </div>
        <button id="btn-close-whats-new" type="button" aria-label="Fechar novidades"
          style="touch-action: manipulation;"
          class="w-9 h-9 rounded-xl bg-slate-800/90 hover:bg-rose-600 active:scale-95 text-slate-200 hover:text-white text-sm font-extrabold flex items-center justify-center shrink-0 transition cursor-pointer select-none">✕</button>
      </div>
      <div class="p-3.5 sm:p-4 overflow-y-auto flex-1 overscroll-contain">
        <ul id="whats-new-list" class="space-y-2 text-xs sm:text-[13px] text-slate-200 leading-snug"></ul>
      </div>
      <div class="px-4 pb-3.5 pt-2 border-t border-slate-800/80 flex items-center justify-end gap-3 shrink-0 bg-slate-900/95">
        <button id="btn-confirm-whats-new" type="button"
          style="touch-action: manipulation;"
          class="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-900/40 transition cursor-pointer select-none">
          ✅ Entendi, fechar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  bindCloseButton(modal.querySelector('#btn-close-whats-new'));
  bindCloseButton(modal.querySelector('#btn-confirm-whats-new'));

  const card = modal.querySelector('#whats-new-card');
  if (card) {
    card.addEventListener('pointerdown', (e) => e.stopPropagation());
    card.addEventListener('mousedown', (e) => e.stopPropagation());
  }
  return modal;
}

export function showWhatsNewModal(ver) {
  const notes = getCurrentNotes(ver);
  const modal = ensureWhatsNewModalDom();
  if (!notes || !modal) return;

  const titleEl = modal.querySelector('#whats-new-title');
  const subEl = modal.querySelector('#whats-new-subtitle');
  const listEl = modal.querySelector('#whats-new-list');

  if (titleEl) titleEl.textContent = notes.title;
  if (subEl) subEl.textContent = notes.subtitle;
  if (listEl) {
    listEl.innerHTML = notes.items
      .map((it) => `<li class="flex items-start gap-2 rounded-xl bg-slate-800/70 border border-slate-700/60 px-2.5 py-2"><span class="text-base leading-none shrink-0 mt-0.5">${it.icon}</span><span>${it.text}</span></li>`)
      .join('');
  }

  try {
    if (typeof localStorage !== 'undefined' && ver) {
      localStorage.setItem(STORAGE_SEEN_KEY, String(ver));
      localStorage.removeItem(JUST_UPDATED_KEY);
    }
  } catch (e) {}

  releaseInputForModal();
  modal.classList.remove('hidden');
}

export function checkAndShowWhatsNewModal(fallbackVer) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const curVer = String(window.MYCO_VERSION || fallbackVer || '').trim();
  if (!curVer) return;
  let seen = '';
  let justUpdated = '';
  try {
    seen = localStorage.getItem(STORAGE_SEEN_KEY) || '';
    justUpdated = localStorage.getItem(JUST_UPDATED_KEY) || '';
  } catch (e) {}
  if (justUpdated === curVer || seen !== curVer) {
    showWhatsNewModal(curVer);
  }
}
