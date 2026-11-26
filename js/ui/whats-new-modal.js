/**
 * MycoCampus3D — Modal de Novidades da Atualização
 * Funciona tanto no PC quanto no Mobile (layout responsivo, touch-action: manipulation).
 */

import { releaseInputForModal } from './dom-helpers.js';
import { t } from '../core/i18n.js';

const STORAGE_SEEN_KEY = 'myco_seen_whats_new_v';
const JUST_UPDATED_KEY = 'myco_just_updated_v';

export const RELEASE_NOTES_CATALOG = {
  '2.10.1': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.10.1' }); },
    get subtitle() { return t('misc.whats_new.2101.subtitle'); },
    items: [
      { icon: '🐄', get text() { return t('misc.whats_new.2101.i1'); } },
      { icon: '⌨️', get text() { return t('misc.whats_new.2101.i2'); } },
      { icon: '📦', get text() { return t('misc.whats_new.2101.i3'); } },
      { icon: '🌸', get text() { return t('misc.whats_new.2101.i4'); } }
    ]
  },
  '2.9.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.9.0' }); },
    get subtitle() { return t('misc.whats_new.290.subtitle'); },
    items: [
      { icon: '🐝', get text() { return t('misc.whats_new.290.i1'); } },
      { icon: '🐾', get text() { return t('misc.whats_new.290.i2'); } },
      { icon: '🏅', get text() { return t('misc.whats_new.290.i3'); } },
      { icon: '🎯', get text() { return t('misc.whats_new.290.i4'); } },
      { icon: '🌐', get text() { return t('misc.whats_new.290.i5'); } }
    ]
  },
  '2.8.3': {
    title: '✨ MycoCampus3D v2.8.3',
    subtitleKey: 'news.283.subtitle',
    items: [{ icon: '📦', key: 'news.283.village' }]
  },
  '2.8.0': {
    title: '✨ MycoCampus3D v2.8.0',
    subtitleKey: 'news.280.subtitle',
    items: [
      { icon: '📦', key: 'news.280.placement' },
      { icon: '🏡', key: 'news.280.modals' },
      { icon: '🎄', key: 'news.280.christmas' },
      { icon: '💬', key: 'news.280.discord' }
    ]
  },
  '2.7.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.7.0' }); },
    get subtitle() { return t('misc.whats_new.270.subtitle'); },
    items: [
      { icon: '🏡', get text() { return t('misc.whats_new.270.i1'); } },
      { icon: '📬', get text() { return t('misc.whats_new.270.i2'); } },
      { icon: '🐾', get text() { return t('misc.whats_new.270.i3'); } },
      { icon: '🎒', get text() { return t('misc.whats_new.270.i4'); } },
      { icon: '🍄', get text() { return t('misc.whats_new.270.i5'); } }
    ]
  },
  '2.6.0': {
    get title() { return t('news.260.title'); },
    get subtitle() { return t('news.260.subtitle'); },
    items: [
      { icon: '🍄', get text() { return t('news.260.tutorial'); } },
      { icon: '⚡', get text() { return t('news.260.quality'); } },
      { icon: '⚙️', get text() { return t('news.260.hud'); } },
      { icon: '📦', get text() { return t('news.260.shop'); } },
      { icon: '🐾', get text() { return t('news.260.pets'); } }
    ]
  },
  '2.5.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.5.0' }); },
    get subtitle() { return t('misc.whats_new.250.subtitle'); },
    items: [
      { icon: '🎒', get text() { return t('misc.whats_new.250.i1'); } },
      { icon: '💾', get text() { return t('misc.whats_new.250.i2'); } }
    ]
  },
  '2.4.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.4.0' }); },
    get subtitle() { return t('misc.whats_new.240.subtitle'); },
    items: [
      { icon: '🌱', get text() { return t('misc.whats_new.240.i1'); } },
      { icon: '🧫', get text() { return t('misc.whats_new.240.i2'); } },
      { icon: '💉', get text() { return t('misc.whats_new.240.i3'); } },
      { icon: '📱', get text() { return t('misc.whats_new.240.i4'); } }
    ]
  },
  '2.3.5': {
    get title() { return t('news.235.title'); },
    get subtitle() { return t('news.235.subtitle'); },
    items: [
      { icon: '⛲', get text() { return t('news.235.fountain'); } },
      { icon: '🔬', get text() { return t('news.235.lab'); } },
      { icon: '🌿', get text() { return t('news.235.grass'); } }
    ]
  },
  '2.3.2': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.3.2' }); },
    get subtitle() { return t('misc.whats_new.232.subtitle'); },
    items: [
      { icon: '🪙', get text() { return t('misc.whats_new.232.i1'); } },
      { icon: '🎯', get text() { return t('misc.whats_new.232.i2'); } },
      { icon: '👥', get text() { return t('misc.whats_new.232.i3'); } }
    ]
  },
  '2.3.1': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.3.1' }); },
    get subtitle() { return t('misc.whats_new.231.subtitle'); },
    items: [
      { icon: '☀️', get text() { return t('misc.whats_new.231.i1'); } },
      { icon: '🎨', get text() { return t('misc.whats_new.231.i2'); } }
    ]
  },
  '2.3.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.3.0' }); },
    get subtitle() { return t('misc.whats_new.230.subtitle'); },
    items: [
      { icon: '💉', get text() { return t('misc.whats_new.230.i1'); } },
      { icon: '💧', get text() { return t('misc.whats_new.230.i2'); } },
      { icon: '📘', get text() { return t('misc.whats_new.230.i3'); } },
      { icon: '✨', get text() { return t('misc.whats_new.230.i4'); } }
    ]
  },
  '2.2.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.2.0' }); },
    get subtitle() { return t('misc.whats_new.220.subtitle'); },
    items: [
      { icon: '🦠', get text() { return t('misc.whats_new.220.i1'); } },
      { icon: '🔬', get text() { return t('misc.whats_new.220.i2'); } },
      { icon: '⭐', get text() { return t('misc.whats_new.220.i3'); } },
      { icon: '⚡', get text() { return t('misc.whats_new.220.i4'); } }
    ]
  },
  '2.1.1': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.1.1' }); },
    get subtitle() { return t('misc.whats_new.211.subtitle'); },
    items: [
      { icon: '🪙', get text() { return t('misc.whats_new.211.i1'); } },
      { icon: '🛒', get text() { return t('misc.whats_new.211.i2'); } },
      { icon: '🏆', get text() { return t('misc.whats_new.211.i3'); } }
    ]
  },
  '2.1.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.1.0' }); },
    get subtitle() { return t('misc.whats_new.210.subtitle'); },
    items: [
      { icon: '💼', get text() { return t('misc.whats_new.210.i1'); } },
      { icon: '🍄', get text() { return t('misc.whats_new.210.i2'); } },
      { icon: '🧊', get text() { return t('misc.whats_new.210.i3'); } },
      { icon: '🏷️', get text() { return t('misc.whats_new.210.i4'); } }
    ]
  },
  '2.0.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '2.0.0' }); },
    get subtitle() { return t('misc.whats_new.200.subtitle'); },
    items: [
      { icon: '🎮', get text() { return t('misc.whats_new.200.i1'); } },
      { icon: '📦', get text() { return t('misc.whats_new.200.i2'); } },
      { icon: '🔍', get text() { return t('misc.whats_new.200.i3'); } }
    ]
  },
  '1.9.9': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.9' }); },
    get subtitle() { return t('misc.whats_new.199.subtitle'); },
    items: [
      { icon: '⌨️', get text() { return t('misc.whats_new.199.i1'); } },
      { icon: '🍄', get text() { return t('misc.whats_new.199.i2'); } },
      { icon: '🍲', get text() { return t('misc.whats_new.199.i3'); } },
      { icon: '🌽', get text() { return t('misc.whats_new.199.i4'); } },
      { icon: '✨', get text() { return t('misc.whats_new.199.i5'); } },
      { icon: '🥥', get text() { return t('misc.whats_new.199.i6'); } },
      { icon: '🫙', get text() { return t('misc.whats_new.199.i7'); } }
    ]
  },
  '1.9.8': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.8' }); },
    get subtitle() { return t('misc.whats_new.198.subtitle'); },
    items: [
      { icon: '🧪', get text() { return t('misc.whats_new.198.i1'); } },
      { icon: '♨️', get text() { return t('misc.whats_new.198.i2'); } },
      { icon: '🔍', get text() { return t('misc.whats_new.198.i3'); } }
    ]
  },
  '1.9.7': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.7' }); },
    get subtitle() { return t('misc.whats_new.197.subtitle'); },
    items: [
      { icon: '🖱️', get text() { return t('misc.whats_new.197.i1'); } },
      { icon: '⬇️', get text() { return t('misc.whats_new.197.i2'); } },
      { icon: '🔥', get text() { return t('misc.whats_new.197.i3'); } },
      { icon: '🍽️', get text() { return t('misc.whats_new.197.i4'); } },
      { icon: '🌾', get text() { return t('misc.whats_new.197.i5'); } },
      { icon: '🧼', get text() { return t('misc.whats_new.197.i6'); } }
    ]
  },
  '1.9.6': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.6' }); },
    get subtitle() { return t('misc.whats_new.196.subtitle'); },
    items: [
      { icon: '⚡', get text() { return t('misc.whats_new.196.i1'); } },
      { icon: '🎉', get text() { return t('misc.whats_new.196.i2'); } },
      { icon: '🌡️', get text() { return t('misc.whats_new.196.i3'); } },
      { icon: '🍲', get text() { return t('misc.whats_new.196.i4'); } },
      { icon: '🙌', get text() { return t('misc.whats_new.196.i5'); } },
      { icon: '🌱', get text() { return t('misc.whats_new.196.i6'); } }
    ]
  },
  '1.9.5': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.5' }); },
    get subtitle() { return t('misc.whats_new.195.subtitle'); },
    items: [
      { icon: '🎉', get text() { return t('misc.whats_new.195.i1'); } },
      { icon: '🌡️', get text() { return t('misc.whats_new.195.i2'); } },
      { icon: '🍲', get text() { return t('misc.whats_new.195.i3'); } },
      { icon: '🙌', get text() { return t('misc.whats_new.195.i4'); } },
      { icon: '✨', get text() { return t('misc.whats_new.195.i5'); } },
      { icon: '🌱', get text() { return t('misc.whats_new.195.i6'); } }
    ]
  },
  '1.9.4': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.4' }); },
    get subtitle() { return t('misc.whats_new.194.subtitle'); },
    items: [
      { icon: '🔄', get text() { return t('misc.whats_new.194.i1'); } },
      { icon: '📦', get text() { return t('misc.whats_new.194.i2'); } },
      { icon: '🌌', get text() { return t('misc.whats_new.194.i3'); } },
      { icon: '🌦️', get text() { return t('misc.whats_new.194.i4'); } },
      { icon: '🌈', get text() { return t('misc.whats_new.194.i5'); } },
      { icon: '⚡', get text() { return t('misc.whats_new.194.i6'); } }
    ]
  },
  '1.9.3': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.3' }); },
    get subtitle() { return t('misc.whats_new.193.subtitle'); },
    items: [
      { icon: '📦', get text() { return t('misc.whats_new.193.i1'); } },
      { icon: '⚡', get text() { return t('misc.whats_new.193.i2'); } },
      { icon: '🌐', get text() { return t('misc.whats_new.193.i3'); } }
    ]
  },
  '1.9.2': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.2' }); },
    get subtitle() { return t('misc.whats_new.192.subtitle'); },
    items: [
      { icon: '📦', get text() { return t('misc.whats_new.192.i1'); } },
      { icon: '🖱️', get text() { return t('misc.whats_new.192.i2'); } },
      { icon: '🎯', get text() { return t('misc.whats_new.192.i3'); } },
      { icon: '🌲', get text() { return t('misc.whats_new.192.i4'); } }
    ]
  },
  '1.9.1': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.1' }); },
    get subtitle() { return t('misc.whats_new.191.subtitle'); },
    items: [
      { icon: '🌲', get text() { return t('misc.whats_new.191.i1'); } },
      { icon: '🌅', get text() { return t('misc.whats_new.191.i2'); } },
      { icon: '🦋', get text() { return t('misc.whats_new.191.i3'); } },
      { icon: '📷', get text() { return t('misc.whats_new.191.i4'); } },
      { icon: '⚡', get text() { return t('misc.whats_new.191.i5'); } }
    ]
  },
  '1.9.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.9.0' }); },
    get subtitle() { return t('misc.whats_new.190.subtitle'); },
    items: [
      { icon: '🌅', get text() { return t('misc.whats_new.190.i1'); } },
      { icon: '🦋', get text() { return t('misc.whats_new.190.i2'); } },
      { icon: '💖', get text() { return t('misc.whats_new.190.i3'); } },
      { icon: '📷', get text() { return t('misc.whats_new.190.i4'); } },
      { icon: '⚡', get text() { return t('misc.whats_new.190.i5'); } }
    ]
  },
  '1.8.2': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.8.2' }); },
    get subtitle() { return t('misc.whats_new.182.subtitle'); },
    items: [
      { icon: '🧬', get text() { return t('misc.whats_new.182.i1'); } },
      { icon: '🔭', get text() { return t('misc.whats_new.182.i2'); } },
      { icon: '🪟', get text() { return t('misc.whats_new.182.i3'); } },
      { icon: '💧', get text() { return t('misc.whats_new.182.i4'); } }
    ]
  },
  '1.8.1': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.8.1' }); },
    get subtitle() { return t('misc.whats_new.181.subtitle'); },
    items: [
      { icon: '🛠️', get text() { return t('misc.whats_new.181.i1'); } },
      { icon: '🔭', get text() { return t('misc.whats_new.181.i2'); } },
      { icon: '🧬', get text() { return t('misc.whats_new.181.i3'); } },
      { icon: '🧺', get text() { return t('misc.whats_new.181.i4'); } },
      { icon: '🏆', get text() { return t('misc.whats_new.181.i5'); } },
      { icon: '💧', get text() { return t('misc.whats_new.181.i6'); } }
    ]
  },
  '1.8.0': {
    get title() { return t('misc.whats_new.version_title', { ver: '1.8.0' }); },
    get subtitle() { return t('misc.whats_new.180.subtitle'); },
    items: [
      { icon: '🔭', get text() { return t('misc.whats_new.180.i1'); } },
      { icon: '🧬', get text() { return t('misc.whats_new.180.i2'); } },
      { icon: '🧺', get text() { return t('misc.whats_new.180.i3'); } },
      { icon: '🏆', get text() { return t('misc.whats_new.180.i4'); } },
      { icon: '💧', get text() { return t('misc.whats_new.180.i5'); } }
    ]
  }
};

function getCurrentNotes(ver) {
  if (ver === '2.6.0') {
    return {
      title: t('news.260.title'),
      subtitle: t('news.260.subtitle'),
      items: [
        { icon: '🍄', text: t('news.260.tutorial') },
        { icon: '⚡', text: t('news.260.quality') },
        { icon: '⚙️', text: t('news.260.hud') },
        { icon: '📦', text: t('news.260.shop') },
        { icon: '🐾', text: t('news.260.pets') }
      ]
    };
  }
  if (ver === '2.3.5') {
    return {
      title: t('news.235.title'),
      subtitle: t('news.235.subtitle'),
      items: [
        { icon: '⛲', text: t('news.235.fountain') },
        { icon: '🔬', text: t('news.235.lab') },
        { icon: '🌿', text: t('news.235.grass') }
      ]
    };
  }
  const notes = RELEASE_NOTES_CATALOG[ver];
  if (notes?.subtitleKey) {
    return { title: notes.title, subtitle: t(notes.subtitleKey), items: notes.items.map(({ icon, key }) => ({ icon, text: t(key) })) };
  }
  if (notes) return notes;
  if (!ver) return null;
  return {
    title: '✨ MycoCampus3D v' + ver,
    subtitle: t('news.updated'),
    items: []
  };
}

export function markPendingAutoUpdateNotice(newVer) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_SEEN_KEY);
      if (newVer) localStorage.setItem(JUST_UPDATED_KEY, String(newVer));
    }
  } catch (e) {}
}

let lastOpenedNotesVersion = '';
let afterNewsClosed = null;

export function dismissWhatsNewModal() {
  afterNewsClosed = null;
  document.getElementById('whats-new-modal')?.classList.add('hidden');
}

export function closeWhatsNewModal() {
  const el = typeof document !== 'undefined' ? document.getElementById('whats-new-modal') : null;
  if (!el || el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  try {
    if (typeof localStorage !== 'undefined' && lastOpenedNotesVersion) {
      localStorage.setItem(STORAGE_SEEN_KEY, String(lastOpenedNotesVersion));
      localStorage.removeItem(JUST_UPDATED_KEY);
    }
  } catch (e) {}
  const next = afterNewsClosed;
  afterNewsClosed = null;
  next?.();
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
  if (modal.style) {
    modal.style.zIndex = '9999';
    modal.style.backgroundColor = 'rgba(2, 6, 23, 0.72)';
  }
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'whats-new-title');
  modal.innerHTML = `
    <div id="whats-new-card" class="glass-panel max-w-md w-full max-h-[90dvh] flex flex-col rounded-2xl border border-emerald-400/50 bg-slate-900/95 shadow-2xl overflow-hidden text-slate-100 my-auto">
      <div class="px-4 py-3 border-b border-slate-700/70 flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-slate-900/90 shrink-0">
        <div class="min-w-0">
          <h2 id="whats-new-title" class="text-sm sm:text-base font-extrabold text-emerald-300" data-i18n="news.title">${t('news.title')}</h2>
          <p id="whats-new-subtitle" class="text-xs text-slate-300"></p>
        </div>
        <button id="btn-close-whats-new" type="button" aria-label="${t('news.close')}"
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
          ${t('news.confirm')}
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

export function showWhatsNewModal(ver, onClosed) {
  if (typeof window !== 'undefined' && window._reloadingVersion) return false;
  const resolvedVer = String(ver || (typeof window !== 'undefined' && window.MYCO_VERSION) || Object.keys(RELEASE_NOTES_CATALOG)[0] || '').trim();
  const notes = getCurrentNotes(resolvedVer);
  const modal = ensureWhatsNewModalDom();
  if (!notes || !modal) return false;

  if (typeof onClosed === 'function') afterNewsClosed = onClosed;
  lastOpenedNotesVersion = resolvedVer;
  const titleEl = modal.querySelector('#whats-new-title');
  const subEl = modal.querySelector('#whats-new-subtitle');
  const listEl = modal.querySelector('#whats-new-list');
  const closeEl = modal.querySelector('#btn-close-whats-new');
  const confirmEl = modal.querySelector('#btn-confirm-whats-new');

  if (titleEl) titleEl.textContent = notes.title;
  if (subEl) subEl.textContent = notes.subtitle;
  if (closeEl) closeEl.setAttribute('aria-label', t('news.close'));
  if (confirmEl) confirmEl.textContent = t('news.confirm');
  if (listEl) {
    listEl.innerHTML = notes.items
      .map((it) => `<li class="flex items-start gap-2 rounded-xl bg-slate-800/70 border border-slate-700/60 px-2.5 py-2"><span class="text-base leading-none shrink-0 mt-0.5">${it.icon}</span><span>${it.text}</span></li>`)
      .join('');
  }

  releaseInputForModal();
  modal.classList.remove('hidden');
  confirmEl?.focus?.({ preventScroll: true });
  return true;
}

export function checkAndShowWhatsNewModal(fallbackVer, onClosed) {
  if (typeof window === 'undefined' || window._reloadingVersion) return false;
  const curVer = String(window.MYCO_VERSION || fallbackVer || '').trim();
  if (!curVer) return false;
  let seen = '';
  let justUpdated = '';
  try {
    seen = localStorage.getItem(STORAGE_SEEN_KEY) || '';
    justUpdated = localStorage.getItem(JUST_UPDATED_KEY) || '';
  } catch (e) {}
  return (justUpdated === curVer || seen !== curVer) && showWhatsNewModal(curVer, onClosed);
}
