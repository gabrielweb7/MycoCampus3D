/**
 * MycoCampus3D — Utilitários DOM, Perfil de Dispositivo, Toast & Fullscreen
 */
export const $ = (id) => document.getElementById(id);

export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let cachedDeviceProfile = null;

export function invalidateDeviceProfileCache() {
  cachedDeviceProfile = null;
}

export function getFullViewportSize() {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  const docEl = typeof document !== 'undefined' ? document.documentElement : null;
  const vv = window.visualViewport;
  let w = Math.max(
    window.innerWidth || 0,
    (docEl && docEl.clientWidth) || 0,
    (vv && vv.width) ? Math.round(vv.width) : 0
  );
  let h = Math.max(
    window.innerHeight || 0,
    (docEl && docEl.clientHeight) || 0,
    (vv && vv.height) ? Math.round(vv.height) : 0
  );

  if (isIosDevice() && window.screen) {
    const scrW = window.screen.width || 0;
    const scrH = window.screen.height || 0;
    if (scrW > 0 && scrH > 0) {
      const isLandscape =
        w >= h ||
        (typeof window.orientation === 'number' && Math.abs(window.orientation) === 90) ||
        Boolean(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
      const physW = isLandscape ? Math.max(scrW, scrH) : Math.min(scrW, scrH);
      const physH = isLandscape ? Math.min(scrW, scrH) : Math.max(scrW, scrH);
      const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      const isIphone = /iPhone|iPod/i.test(ua);

      // No iPhone adicionado à Tela de Início (Standalone), o WebKit frequentemente
      // subtrai 40px-80px de window.innerHeight ao girar para horizontal (landscape),
      // causando uma faixa preta na parte de baixo. Forçamos a dimensão física real da tela.
      if (isStandaloneMode() && (isIphone || (Math.abs(physW - w) <= 160 && Math.abs(physH - h) <= 160))) {
        w = Math.max(w, physW);
        h = Math.max(h, physH);
      } else if (isIphone && isLandscape && physH > h && (physH - h) <= 96) {
        w = Math.max(w, physW);
        if (document && document.body && document.body.classList && document.body.classList.contains('ios-immersive-fullscreen')) {
          h = Math.max(h, physH);
        }
      }
    }
  }

  return {
    width: w || 1280,
    height: h || 720
  };
}

export function syncViewportCssVars(forceMetaRefresh = false) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return getFullViewportSize();
  if (forceMetaRefresh && isIosDevice()) {
    try {
      const vpMeta = document.querySelector && document.querySelector('meta[name="viewport"]');
      if (vpMeta && vpMeta.setAttribute) {
        vpMeta.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover'
        );
      }
    } catch (e) { /* ignore */ }
  }
  const sz = getFullViewportSize();
  try {
    const docEl = document.documentElement;
    if (docEl && docEl.style && docEl.style.setProperty) {
      docEl.style.setProperty('--app-vw', `${sz.width}px`);
      docEl.style.setProperty('--app-vh', `${sz.height}px`);
      docEl.style.width = `${sz.width}px`;
      docEl.style.height = `${sz.height}px`;
    }
    if (document.body && document.body.style) {
      document.body.style.width = `${sz.width}px`;
      document.body.style.height = `${sz.height}px`;
    }
    const wrap = document.getElementById && document.getElementById('campus-canvas-wrap');
    if (wrap && wrap.style) {
      wrap.style.width = `${sz.width}px`;
      wrap.style.height = `${sz.height}px`;
    }
    if (window.scrollTo) {
      window.scrollTo(0, 0);
    }
  } catch (e) { /* ignore */ }
  return sz;
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('resize', () => {
    invalidateDeviceProfileCache();
    syncViewportCssVars(false);
  });
  window.addEventListener('orientationchange', () => {
    invalidateDeviceProfileCache();
    syncViewportCssVars(true);
    setTimeout(() => syncViewportCssVars(true), 80);
    setTimeout(() => syncViewportCssVars(false), 240);
    setTimeout(() => syncViewportCssVars(false), 500);
  });
}

export function getDeviceProfile() {
  if (cachedDeviceProfile) return cachedDeviceProfile;
  const coarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const vp = getFullViewportSize();
  const w = vp.width;
  const h = vp.height;
  const minDim = Math.min(w, h);
  const tPts = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints || 0) : 0;
  const hasTouch = tPts > 0 && (w <= 1380 || minDim <= 1080);
  if (!coarse && !hasTouch) {
    cachedDeviceProfile = 'desktop';
  } else {
    cachedDeviceProfile = minDim >= 720 ? 'tablet' : 'phone';
  }
  return cachedDeviceProfile;
}

export function isTouch() {
  return getDeviceProfile() !== 'desktop';
}

export function applyDeviceUi() {
  invalidateDeviceProfileCache();
  const profile = getDeviceProfile();
  document.body.classList.remove('device-desktop', 'device-tablet', 'device-phone', 'device-touch');
  document.body.classList.add(`device-${profile}`);
  if (profile !== 'desktop') document.body.classList.add('device-touch');

  const hint = $('fps-hint');
  const chatInp = $('chat-input');
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

let toastUntil = 0;

export function getToastUntil() {
  return toastUntil;
}

export function showFloatingToast(msg, durationMs = 3200) {
  const pill = $('interact-pill');
  if (!pill) return;
  toastUntil = Date.now() + durationMs;
  pill.textContent = msg;
  pill.classList.remove('hidden');
  setTimeout(() => {
    if (Date.now() >= toastUntil && pill.textContent === msg) {
      pill.classList.add('hidden');
    }
  }, durationMs);
}

export function releaseInputForModal() {
  if (window.clearCampusKeys) window.clearCampusKeys();
  if (document.pointerLockElement && document.exitPointerLock) {
    try { document.exitPointerLock(); } catch (e) { /* silent */ }
  }
}

export function getBlockingCampusModal() {
  return document.querySelector('dialog[open]') ||
    [...document.querySelectorAll('div[id$="-modal"]:not(.hidden):not([data-floating-window])')].at(-1);
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window.navigator && window.navigator.standalone === true) ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.Capacitor
  );
}

export function isNativeFullscreenSupported() {
  if (typeof document === 'undefined' || !document.documentElement) return false;
  const el = document.documentElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
}

export function isFullscreenActive() {
  if (typeof document === 'undefined') return false;
  const nativeFs = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement ||
    document.msFullscreenElement
  );
  const iosImmersive = !!(document.body && document.body.classList.contains('ios-immersive-fullscreen'));
  return nativeFs || iosImmersive;
}

export function syncFullscreenButtonUi() {
  if (typeof document === 'undefined') return;
  const btn = $('btn-fullscreen');
  if (!btn) return;
  const active = isFullscreenActive();
  btn.classList.toggle('border-emerald-400/70', active);
  btn.classList.toggle('text-emerald-300', active);
}

export function setIosImmersiveFullscreen(active) {
  if (typeof document === 'undefined' || !document.body) return false;
  const next = Boolean(active);
  document.body.classList.toggle('ios-immersive-fullscreen', next);
  try {
    syncViewportCssVars(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('resize'));
    }
  } catch (e) { /* ignore */ }
  syncFullscreenButtonUi();
  return next;
}

export function openIosFullscreenModal() {
  if (typeof document === 'undefined') return;
  const modal = $('ios-fullscreen-modal');
  if (!modal) {
    showFloatingToast('🍎 No iPhone: toque em "aA" → Ocultar Barra de Ferramentas ou Compartilhar → Adicionar à Tela de Início!', 5200);
    return;
  }
  releaseInputForModal();
  modal.classList.remove('hidden');
}

export function requestCampusFullscreen(opts = {}) {
  try {
    const explicit = Boolean(opts && opts.explicitUserClick);
    if (!explicit && !isTouch()) return;
    if (isNativeFullscreenSupported()) {
      if (!isFullscreenActive()) {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) {
          let p;
          try {
            p = req.call(el, { navigationUI: 'hide' });
          } catch (argErr) {
            p = req.call(el);
          }
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              if (isIosDevice()) {
                setIosImmersiveFullscreen(true);
                if (explicit && !isStandaloneMode()) openIosFullscreenModal();
              }
            });
          }
        }
      }
      if (isTouch() && typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('landscape').catch(() => {});
      }
      syncFullscreenButtonUi();
      return;
    }

    // Fallback especial para iPhone (iOS Safari não possui requestFullscreen em elementos HTML)
    if (isIosDevice()) {
      setIosImmersiveFullscreen(true);
      if (explicit) {
        if (isStandaloneMode()) {
          showFloatingToast('🍎 Modo Tela Cheia Imersiva ativado no iPhone!', 3200);
        } else {
          openIosFullscreenModal();
        }
      }
    }
  } catch (e) { /* browser policy */ }
}

export function toggleCampusFullscreen(opts = {}) {
  try {
    const explicit = opts && opts.explicitUserClick !== undefined ? Boolean(opts.explicitUserClick) : true;
    const nativeActive = typeof document !== 'undefined' && !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.webkitCurrentFullScreenElement ||
      document.msFullscreenElement
    );
    if (nativeActive) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen || document.msExitFullscreen;
      if (exit) exit.call(document);
      syncFullscreenButtonUi();
      return;
    }

    if (!isNativeFullscreenSupported() && isIosDevice()) {
      const currentlyImmersive = document.body && document.body.classList.contains('ios-immersive-fullscreen');
      if (isStandaloneMode()) {
        const next = setIosImmersiveFullscreen(!currentlyImmersive);
        showFloatingToast(next ? '🍎 Modo Imersivo ativado (HUD compacto)!' : '🍎 HUD padrão restaurado.', 2800);
        return;
      }
      if (!currentlyImmersive) {
        setIosImmersiveFullscreen(true);
        if (explicit) openIosFullscreenModal();
      } else if (explicit) {
        openIosFullscreenModal();
      } else {
        setIosImmersiveFullscreen(false);
      }
      return;
    }

    requestCampusFullscreen({ explicitUserClick: explicit });
  } catch (e) { /* ignore */ }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('fullscreenchange', syncFullscreenButtonUi);
  document.addEventListener('webkitfullscreenchange', syncFullscreenButtonUi);
}
