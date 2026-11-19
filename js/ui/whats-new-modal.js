/**
 * MycoCampus3D — Modal de Novidades da Atualização (Auto-fecha em 5s ou no X)
 * Sempre escrito em linguagem simples e direta para os jogadores.
 */

const STORAGE_SEEN_KEY = 'myco_seen_whats_new_v';
const JUST_UPDATED_KEY = 'myco_just_updated_v';

export const RELEASE_NOTES_CATALOG = {
  '1.7.0': {
    title: '✨ Novidades da Atualização v1.7.0',
    subtitle: 'Seu campus ficou ainda mais mágico e completo! Veja o que mudou:',
    items: [
      { icon: '🌠', text: 'Estrelas cadentes, nomes das constelações no céu noturno, vagalumes permanentes na mata e janelas das casas iluminadas à noite!' },
      { icon: '🪙', text: 'MycoCoins salvas na sua conta do servidor (MySQL) e visíveis no Ranking do Campus!' },
      { icon: '🍄', text: 'Recompensas da Micoteca: ganhe bônus de 🪙 MycoCoins e medalhas ao descobrir 10, 25, 50, 75 e 100 espécies!' },
      { icon: '🌧️', text: 'Som de chuva no telhado e trovões distantes em dias chuvosos, além de botão rápido [📦 Mover] na barra flutuante [1..4].' },
      { icon: '🛒', text: 'Loja com aba de Equipamentos/Insumos, Pedidos VIP no Empório (+🪙 180) e Missão completa em 8 etapas.' }
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

let activeTimer = null;
let countdownInterval = null;

function closeWhatsNewModal() {
  if (activeTimer) { clearTimeout(activeTimer); activeTimer = null; }
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  const el = typeof document !== 'undefined' ? document.getElementById('whats-new-modal') : null;
  if (el) el.classList.add('hidden');
}

function ensureWhatsNewModalDom() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('whats-new-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'whats-new-modal';
  modal.className = 'hidden fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm pointer-events-auto';
  modal.innerHTML = `
    <div id="whats-new-card" class="glass-panel max-w-md w-full rounded-2xl border border-emerald-400/50 bg-slate-900/95 shadow-2xl overflow-hidden text-slate-100">
      <div class="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-900/90">
        <div class="min-w-0">
          <h2 id="whats-new-title" class="text-sm sm:text-base font-extrabold text-emerald-300 truncate">✨ Novidades da Atualização</h2>
          <p id="whats-new-subtitle" class="text-[11px] sm:text-xs text-slate-300 truncate">Veja o que foi melhorado no jogo:</p>
        </div>
        <button id="btn-close-whats-new" type="button" aria-label="Fechar novidades"
          class="w-7 h-7 rounded-lg bg-slate-800/90 hover:bg-rose-600 text-slate-200 hover:text-white text-xs font-extrabold flex items-center justify-center shrink-0 transition">✕</button>
      </div>
      <div class="p-3.5 sm:p-4">
        <ul id="whats-new-list" class="space-y-2 text-xs sm:text-[13px] text-slate-200 leading-snug"></ul>
      </div>
      <div class="px-4 pb-3 pt-1 flex items-center justify-between gap-3">
        <div class="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div id="whats-new-progress" class="h-full bg-emerald-400 transition-all duration-100 ease-linear" style="width:100%"></div>
        </div>
        <span id="whats-new-countdown" class="text-[11px] font-bold text-emerald-300 shrink-0 tabular-nums">Fecha em 5s</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#btn-close-whats-new')?.addEventListener('click', closeWhatsNewModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeWhatsNewModal();
  });
  return modal;
}

export function showWhatsNewModal(ver, autoCloseMs = 5000) {
  const notes = getCurrentNotes(ver);
  const modal = ensureWhatsNewModalDom();
  if (!notes || !modal) return;

  const titleEl = modal.querySelector('#whats-new-title');
  const subEl = modal.querySelector('#whats-new-subtitle');
  const listEl = modal.querySelector('#whats-new-list');
  const progEl = modal.querySelector('#whats-new-progress');
  const countEl = modal.querySelector('#whats-new-countdown');

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

  modal.classList.remove('hidden');

  if (activeTimer) clearTimeout(activeTimer);
  if (countdownInterval) clearInterval(countdownInterval);

  if (autoCloseMs > 0) {
    const startAt = Date.now();
    if (progEl) {
      progEl.parentElement?.classList.remove('hidden');
      progEl.style.width = '100%';
    }
    if (countEl) countEl.textContent = `Fecha em ${Math.ceil(autoCloseMs / 1000)}s`;

    countdownInterval = setInterval(() => {
      const elapsed = Date.now() - startAt;
      const remMs = Math.max(0, autoCloseMs - elapsed);
      const pct = Math.max(0, Math.min(100, (remMs / autoCloseMs) * 100));
      if (progEl) progEl.style.width = pct.toFixed(1) + '%';
      if (countEl) countEl.textContent = `Fecha em ${Math.max(1, Math.ceil(remMs / 1000))}s`;
    }, 100);

    activeTimer = setTimeout(() => {
      closeWhatsNewModal();
    }, autoCloseMs);
  } else {
    if (progEl) progEl.parentElement?.classList.add('hidden');
    if (countEl) countEl.textContent = 'Clique no ✕ para fechar';
  }
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
    showWhatsNewModal(curVer, 5000);
  }
}
