import { t } from '../core/i18n.js';
/**
 * MycoCampus3D — Verificador Automático de Atualização do APK Android
 *
 * Enquanto o conteúdo web/3D atualiza automaticamente ao abrir o app,
 * este módulo detecta quando existe uma nova versão nativa do .apk
 * (ex: melhorias no WebView, ícone ou recursos nativos) e exibe o link
 * direto para o usuário baixar e instalar por cima da versão atual.
 */

const APK_DISMISS_STORAGE_KEY = 'myco_apk_update_dismissed_vc';

export function isRunningInApk() {
  if (typeof window === 'undefined') return false;
  const cap = window.Capacitor;
  if (cap) {
    if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
    if (cap.isNative) return true;
  }
  const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
  return /MycoCampusAPK\/\d+/i.test(ua);
}

function compareSemver(a, b) {
  const pa = String(a || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

async function getInstalledApkInfo() {
  let versionCode = 0;
  let versionName = typeof window !== 'undefined' && window.MYCO_VERSION ? String(window.MYCO_VERSION) : '1.0.0';

  try {
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (appPlugin && typeof appPlugin.getInfo === 'function') {
      const info = await appPlugin.getInfo();
      if (info) {
        const parsedBuild = parseInt(String(info.build || ''), 10);
        if (Number.isFinite(parsedBuild) && parsedBuild > 0) versionCode = parsedBuild;
        if (info.version) versionName = String(info.version);
      }
    }
  } catch (e) {
    // Segue para fallback pelo User-Agent
  }

  if (!versionCode && typeof navigator !== 'undefined') {
    const match = String(navigator.userAgent || '').match(/MycoCampusAPK\/(\d+)/i);
    if (match) versionCode = parseInt(match[1], 10) || 1;
  }

  return { versionCode: versionCode || 1, versionName };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showApkUpdateModal({ installed, remote }) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('apk-update-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'apk-update-modal';
  modal.className = 'fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4';

  const notesHtml = remote.notes
    ? `<div class="rounded-xl bg-slate-900/90 border border-slate-700/80 p-3 text-xs text-slate-200 leading-relaxed">${escapeHtml(remote.notes)}</div>`
    : '';

  const laterBtnHtml = remote.mandatory
    ? ''
    : `<button id="btn-apk-update-later" type="button" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700">${t('misc.apk.later')}</button>`;

  modal.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl bg-slate-900 border border-emerald-500/45 shadow-2xl p-5 space-y-4 text-slate-100">
      <div class="space-y-1 text-center">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 text-xs font-bold">
          📲 ${t('misc.apk.available')}
        </div>
        <h2 class="text-lg font-extrabold text-white pt-1">${t('misc.apk.newApk')}</h2>
        <p class="text-xs text-slate-300">
          ${t('misc.apk.yourVersion')} <span class="font-semibold text-slate-200">v${escapeHtml(installed.versionName)} (${installed.versionCode})</span>
          → ${t('misc.apk.newLabel')} <span class="font-bold text-emerald-300">v${escapeHtml(remote.versionName)} (${remote.versionCode})</span>
        </p>
      </div>

      ${notesHtml}

      <div class="space-y-2">
        <a id="btn-apk-download"
          href="${escapeHtml(remote.apkUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="block w-full text-center py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-extrabold shadow-lg">
          ⬇️ ${t('misc.apk.download')}
        </a>
        <button id="btn-apk-copy-link" type="button"
          class="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-sky-300 text-xs font-semibold border border-slate-700/80">
          🔗 ${t('misc.apk.copyLink')}
        </button>
        ${laterBtnHtml}
      </div>

      <p class="text-[11px] text-slate-400 text-center leading-snug">
        ${t('misc.apk.afterDownload')}
      </p>
    </div>
  `;

  document.body.appendChild(modal);

  const copyBtn = modal.querySelector('#btn-apk-copy-link');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(remote.apkUrl);
          copyBtn.textContent = '✅ ' + t('misc.apk.copied');
        } else {
          copyBtn.textContent = remote.apkUrl;
        }
      } catch (e) {
        copyBtn.textContent = remote.apkUrl;
      }
    });
  }

  const laterBtn = modal.querySelector('#btn-apk-update-later');
  if (laterBtn) {
    laterBtn.addEventListener('click', () => {
      try {
        localStorage.setItem(APK_DISMISS_STORAGE_KEY, String(remote.versionCode));
      } catch (e) {}
      modal.remove();
    });
  }
}

export async function checkForApkUpdate({ forcePrompt = false } = {}) {
  if (!isRunningInApk()) {
    return { inApk: false, updateAvailable: false };
  }

  const installed = await getInstalledApkInfo();
  let remote = null;

  try {
    const res = await fetch(`api/apk-version.php?_t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { inApk: true, updateAvailable: false, status: res.status };
    remote = await res.json();
  } catch (e) {
    return { inApk: true, updateAvailable: false, error: e?.message || 'network_error' };
  }

  if (!remote || !remote.apkUrl) {
    return { inApk: true, updateAvailable: false };
  }

  const remoteCode = parseInt(String(remote.versionCode || '0'), 10) || 0;
  const isNewerByCode = remoteCode > 0 && remoteCode > installed.versionCode;
  const isNewerByName = remoteCode <= 0 && compareSemver(remote.versionName, installed.versionName) > 0;
  const updateAvailable = isNewerByCode || isNewerByName;

  if (!updateAvailable) {
    return { inApk: true, updateAvailable: false, installed, remote };
  }

  if (!forcePrompt && !remote.mandatory) {
    try {
      const dismissed = parseInt(localStorage.getItem(APK_DISMISS_STORAGE_KEY) || '0', 10);
      if (dismissed >= remoteCode) {
        return { inApk: true, updateAvailable: true, suppressed: true, installed, remote };
      }
    } catch (e) {}
  }

  showApkUpdateModal({ installed, remote });
  return { inApk: true, updateAvailable: true, installed, remote };
}
