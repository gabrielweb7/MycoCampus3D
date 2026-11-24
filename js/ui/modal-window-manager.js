/**
 * MycoCampus3D — Gerenciador de Modais Flutuantes (Mover, Redimensionar e Salvar por Jogador)
 * Permite arrastar qualquer modal pelo cabeçalho, ajustar largura/altura no canto ↘
 * e persistir a posição/tamanho por jogador no localStorage com limites mínimos seguros.
 */

const STORAGE_PREFIX = 'myco_modal_layout_v1_';
const MIN_WIDTH = 280;
const MIN_HEIGHT = 160;
const MODAL_MARGIN = 8;

let activeUserKey = 'guest';
let managerInitialized = false;
let observerInstance = null;

function sanitizeUserKey(rawKey) {
  const clean = String(rawKey || 'guest').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return clean || 'guest';
}

export function setModalManagerUserKey(user) {
  const keySource = user && (user.id || user.display_name) ? String(user.id || user.display_name) : 'guest';
  activeUserKey = sanitizeUserKey(keySource);
  refreshAllManagedModals();
}

function getStorageKey() {
  return STORAGE_PREFIX + activeUserKey;
}

export function readModalLayoutMap() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(getStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeModalLayoutMap(map) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(map || {}));
  } catch (e) {}
}

export function clampModalRectToViewport(rect, vw = 1280, vh = 720) {
  const safeVw = Math.max(17, Number(vw) || 1280);
  const safeVh = Math.max(17, Number(vh) || 720);
  const maxW = safeVw - MODAL_MARGIN * 2;
  const maxH = safeVh - MODAL_MARGIN * 2;
  const minW = Math.min(MIN_WIDTH, maxW);
  const minH = Math.min(MIN_HEIGHT, maxH);

  const width = Math.max(minW, Math.min(maxW, Math.round(Number(rect && rect.w) || minW)));
  const height = Math.max(minH, Math.min(maxH, Math.round(Number(rect && rect.h) || minH)));

  const left = Math.max(MODAL_MARGIN, Math.min(safeVw - width - MODAL_MARGIN, Math.round(Number(rect?.x) || 16)));
  const top = Math.max(MODAL_MARGIN, Math.min(safeVh - height - MODAL_MARGIN, Math.round(Number(rect?.y) || 16)));

  return { x: left, y: top, w: width, h: height };
}

function getViewportSize() {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  return {
    w: window.innerWidth || document.documentElement.clientWidth || 1280,
    h: window.innerHeight || document.documentElement.clientHeight || 720
  };
}

function isModalContainer(el) {
  if (!el || !el.id) return false;
  if (el.id === 'item-status-card') return true;
  if (el.tagName === 'DIALOG' || ['map-modal', 'whats-new-modal', 'first-steps-welcome-modal', 'apk-update-modal', 'ios-fullscreen-modal'].includes(el.id)) return false;
  return /-modal$/.test(el.id);
}

function canFloatModal() {
  return !window.matchMedia('(pointer: coarse), (max-width: 700px), (max-height: 480px)').matches;
}

function findDialogCard(container) {
  if (!container) return null;
  if (container.id === 'item-status-card') return container;
  const byRole = container.querySelector && container.querySelector('[role="dialog"]');
  if (byRole) return byRole;
  const children = container.children || [];
  for (let i = 0; i < children.length; i++) {
    const ch = children[i];
    if (ch && ch.tagName === 'DIV') return ch;
  }
  return null;
}

function findDragHandle(card) {
  if (!card) return null;
  if (card.id === 'item-status-card') {
    return card.firstElementChild || card;
  }
  const heading = card.querySelector && card.querySelector('h2, h3');
  if (heading && heading.parentElement) {
    return heading.parentElement;
  }
  return card.firstElementChild || card;
}

function setFloatingBackdropMode(container, card, active) {
  if (!container || container === card) return;
  container.toggleAttribute('data-floating-window', active);
  if (active) {
    container.style.pointerEvents = 'none';
    container.style.backgroundColor = 'transparent';
    container.style.backdropFilter = 'none';
    container.style.webkitBackdropFilter = 'none';
    card.style.pointerEvents = 'auto';
  } else {
    container.style.pointerEvents = '';
    container.style.backgroundColor = '';
    container.style.backdropFilter = '';
    container.style.webkitBackdropFilter = '';
  }
}

function applySavedRectToCard(container, card) {
  if (!container || !card || !card.style) return;
  const saved = canFloatModal() && readModalLayoutMap()[container.id];
  if (!saved) {
    card.style.position = '';
    card.style.left = '';
    card.style.top = '';
    card.style.width = '';
    card.style.height = '';
    card.style.maxWidth = '';
    card.style.maxHeight = '';
    card.style.margin = '';
    card.style.overflowY = '';
    setFloatingBackdropMode(container, card, false);
    return;
  }
  const vp = getViewportSize();
  const clamped = clampModalRectToViewport(saved, vp.w, vp.h);
  if (container !== card) {
    card.style.position = 'fixed';
    card.style.margin = '0';
    setFloatingBackdropMode(container, card, true);
  }
  card.style.left = clamped.x + 'px';
  card.style.top = clamped.y + 'px';
  if (container !== card) {
    card.style.width = clamped.w + 'px';
    card.style.height = clamped.h + 'px';
    card.style.maxWidth = 'calc(100vw - 16px)';
    card.style.maxHeight = 'calc(100vh - 16px)';
    card.style.overflowY = 'auto';
  }
}

function saveRectForModal(modalId, rect) {
  const vp = getViewportSize();
  const clamped = clampModalRectToViewport(rect, vp.w, vp.h);
  const map = readModalLayoutMap();
  map[modalId] = clamped;
  writeModalLayoutMap(map);
  return clamped;
}

function resetRectForModal(container, card) {
  const map = readModalLayoutMap();
  delete map[container.id];
  writeModalLayoutMap(map);
  applySavedRectToCard(container, card);
}

function enhanceModalWindow(container) {
  if (!container || !isModalContainer(container) || container.dataset.windowEnhanced === '1') return;
  const card = findDialogCard(container);
  if (!card || !card.style) return;
  container.dataset.windowEnhanced = '1';

  const handle = findDragHandle(card);
  if (handle && handle.style && container.dataset.dragBound !== '1') {
    handle.style.cursor = 'move';
    handle.style.userSelect = 'none';
    if (!handle.title) {
      handle.title = 'Arraste para mover • Duplo clique para centralizar (Alt mostra o cursor no PC)';
    }

    handle.addEventListener('dblclick', (e) => {
      if (e.target && e.target.closest && e.target.closest('button, input, select, a')) return;
      resetRectForModal(container, card);
    });

    handle.addEventListener('pointerdown', (e) => {
      if (!canFloatModal() || e.pointerType !== 'mouse' || e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('button, input, select, textarea, a')) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = card.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const origLeft = rect.left;
      const origTop = rect.top;
      const origW = Math.max(MIN_WIDTH, rect.width);
      const origH = Math.max(MIN_HEIGHT, rect.height);

      if (container !== card) {
        setFloatingBackdropMode(container, card, true);
        card.style.position = 'fixed';
        card.style.margin = '0';
        card.style.width = Math.round(origW) + 'px';
        card.style.height = Math.round(origH) + 'px';
        card.style.maxWidth = 'calc(100vw - 16px)';
        card.style.maxHeight = 'calc(100vh - 16px)';
        card.style.overflowY = 'auto';
      }

      const onMove = (ev) => {
        const vp = getViewportSize();
        const clamped = clampModalRectToViewport({
          x: origLeft + (ev.clientX - startX),
          y: origTop + (ev.clientY - startY),
          w: origW,
          h: origH
        }, vp.w, vp.h);
        card.style.left = clamped.x + 'px';
        card.style.top = clamped.y + 'px';
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const curRect = card.getBoundingClientRect();
        saveRectForModal(container.id, {
          x: curRect.left,
          y: curRect.top,
          w: Math.max(MIN_WIDTH, curRect.width),
          h: Math.max(MIN_HEIGHT, curRect.height)
        });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  }

  // Alça discreta no canto inferior direito para aumentar/diminuir qualquer modal no PC
  if (container !== card && card.querySelector && !card.querySelector('.myco-modal-resizer')) {
    if (!card.style.position) card.style.position = 'relative';
    const resizer = document.createElement('div');
    resizer.className = 'myco-modal-resizer';
    resizer.title = 'Arraste para redimensionar janela';
    resizer.textContent = '◢';
    Object.assign(resizer.style, {
      position: 'absolute',
      bottom: '2px',
      right: '2px',
      width: '18px',
      height: '18px',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      fontSize: '11px',
      lineHeight: '1',
      color: 'rgba(148, 163, 184, 0.72)',
      cursor: 'nwse-resize',
      userSelect: 'none',
      touchAction: 'none',
      zIndex: '20',
      paddingRight: '3px',
      paddingBottom: '2px'
    });
    resizer.addEventListener('pointerdown', (e) => {
      if (!canFloatModal() || e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = card.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const origLeft = rect.left;
      const origTop = rect.top;
      const origW = rect.width;
      const origH = rect.height;

      setFloatingBackdropMode(container, card, true);
      card.style.position = 'fixed';
      card.style.margin = '0';
      card.style.left = Math.round(origLeft) + 'px';
      card.style.top = Math.round(origTop) + 'px';
      card.style.maxWidth = 'calc(100vw - 16px)';
      card.style.maxHeight = 'calc(100vh - 16px)';
      card.style.overflowY = 'auto';

      const onMove = (ev) => {
        const vp = getViewportSize();
        const clamped = clampModalRectToViewport({
          x: origLeft,
          y: origTop,
          w: origW + (ev.clientX - startX),
          h: origH + (ev.clientY - startY)
        }, vp.w, vp.h);
        card.style.width = clamped.w + 'px';
        card.style.height = clamped.h + 'px';
        card.style.left = clamped.x + 'px';
        card.style.top = clamped.y + 'px';
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const curRect = card.getBoundingClientRect();
        saveRectForModal(container.id, {
          x: curRect.left,
          y: curRect.top,
          w: curRect.width,
          h: curRect.height
        });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
    card.appendChild(resizer);
  }

  applySavedRectToCard(container, card);
}

export function refreshAllManagedModals() {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const candidates = document.querySelectorAll('[id$="-modal"], #item-status-card, #whats-new-modal');
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (el.dataset.windowEnhanced !== '1') {
      enhanceModalWindow(el);
    } else {
      const card = findDialogCard(el);
      if (card) applySavedRectToCard(el, card);
    }
  }
}

export function initModalWindowManager(initialUser = null) {
  if (typeof document === 'undefined') return;
  if (initialUser) setModalManagerUserKey(initialUser);
  refreshAllManagedModals();
  if (managerInitialized) return;
  managerInitialized = true;

  if (typeof MutationObserver === 'function' && document.body) {
    observerInstance = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (node && node.nodeType === 1 && isModalContainer(node)) {
              enhanceModalWindow(node);
            }
          }
        } else if (m.type === 'attributes' && m.target && isModalContainer(m.target)) {
          if (m.target.dataset.windowEnhanced !== '1') {
            enhanceModalWindow(m.target);
          } else if (!m.target.classList.contains('hidden')) {
            const card = findDialogCard(m.target);
            if (card) applySavedRectToCard(m.target, card);
          }
        }
      }
    });
    observerInstance.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      refreshAllManagedModals();
    });
  }
}
