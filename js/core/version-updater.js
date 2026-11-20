/**
 * Utilitario de Atualizacao Automatica & Limpeza de Cache (MycoCampus3D)
 * Garante que todos os jogadores em abas normais ou PWA recebam novos deploys sem aba anonima.
 */

const RELOAD_GUARD_KEY = 'myco_reload_guard_v2';
const RELOAD_COOLDOWN_MS = 30000;

export function isValidSemver(ver) {
  return typeof ver === 'string' && /^\d+\.\d+\.\d+$/.test(ver.trim());
}

export function shouldTriggerVersionReload(liveVer, currentVer, storage) {
  const next = typeof liveVer === 'string' ? liveVer.trim() : '';
  const cur = typeof currentVer === 'string' ? currentVer.trim() : '';
  if (!isValidSemver(next) || !isValidSemver(cur) || next === cur) return false;
  if (!storage || typeof storage.getItem !== 'function') return true;
  try {
    const raw = storage.getItem(RELOAD_GUARD_KEY) || '';
    const parts = raw.split('|');
    const guardedVer = parts[0] || '';
    const ts = parseInt(parts[1] || '0', 10) || 0;
    const count = parseInt(parts[2] || '0', 10) || 0;
    if (guardedVer === next && Date.now() - ts < RELOAD_COOLDOWN_MS && count >= 1) {
      return false;
    }
  } catch (e) {}
  return true;
}

export function recordVersionReloadAttempt(liveVer, storage) {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    const raw = storage.getItem(RELOAD_GUARD_KEY) || '';
    const parts = raw.split('|');
    const same = parts[0] === liveVer && (Date.now() - (parseInt(parts[1] || '0', 10) || 0) < RELOAD_COOLDOWN_MS);
    const nextCount = same ? ((parseInt(parts[2] || '0', 10) || 0) + 1) : 1;
    storage.setItem(RELOAD_GUARD_KEY, `${liveVer}|${Date.now()}|${nextCount}`);
  } catch (e) {}
}

export async function clearAllBrowserCachesAndUpdateSw() {
  try {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {}
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => (r && typeof r.update === 'function' ? r.update().catch(() => {}) : Promise.resolve())));
    }
  } catch (e) {}
}

export function buildVersionedReloadUrl(loc, nextVersion, nowMs = Date.now()) {
  const path = (loc && loc.pathname) ? loc.pathname : '/';
  const curSearch = (loc && loc.search) ? loc.search : '';
  const params = new URLSearchParams(curSearch);
  params.set('_v', nextVersion);
  params.set('_cb', String(nowMs));
  return `${path}?${params.toString()}`;
}

export async function forceCacheBustReload(nextVersion, opts = {}) {
  const next = typeof nextVersion === 'string' ? nextVersion.trim() : '';
  if (typeof window === 'undefined' || !isValidSemver(next)) return false;
  if (window._reloadingVersion) return false;
  const store = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  const currentVer = opts.currentVer || window.MYCO_VERSION || '';
  if (!opts.ignoreGuard && !shouldTriggerVersionReload(next, currentVer, store)) {
    return false;
  }
  window._reloadingVersion = true;
  recordVersionReloadAttempt(next, store);
  if (typeof opts.onBeforeReload === 'function') {
    try { opts.onBeforeReload(next); } catch (e) {}
  }
  await clearAllBrowserCachesAndUpdateSw();
  const targetUrl = buildVersionedReloadUrl(window.location, next);
  const delayMs = typeof opts.delayMs === 'number' ? opts.delayMs : 450;
  setTimeout(() => {
    window.location.replace(targetUrl);
  }, delayMs);
  return true;
}
