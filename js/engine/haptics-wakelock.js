/**
 * MycoCampus3D — Haptics, Screen Wake Lock & PWA Install Manager
 * - Feedback Háptico Tátil (vibrações sutis para celulares)
 * - Screen Wake Lock (impede a tela de apagar durante aulas e jogo)
 * - Gerenciamento de Instalação do PWA (App na tela inicial)
 */

import { isIosDevice, isStandaloneMode, openIosFullscreenModal } from '../ui/dom-helpers.js';
import { forceCacheBustReload } from '../core/version-updater.js';

let wakeLockSentinel = null;
let deferredInstallPrompt = null;

// ============================================================================
// 1. Screen Wake Lock API
// ============================================================================
export async function requestScreenWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) return;
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
  } catch (err) {
    // Pode falhar se bateria estiver crítica ou bloqueado pelo SO
  }
}

export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

// Re-adquire wake lock se o usuário voltar para a aba
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && window.MycoCampus && window.MycoCampus.inGame) {
    requestScreenWakeLock();
  }
});

// ============================================================================
// 2. Feedback Háptico Tátil (Vibrações do Celular)
// ============================================================================
export function triggerHaptic(type = 'light') {
  if (!('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'light':
      case 'tap':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(22);
        break;
      case 'heavy':
        navigator.vibrate([28, 16, 28]);
        break;
      case 'success':
        navigator.vibrate([12, 24, 20]);
        break;
      case 'pulse':
        navigator.vibrate([8, 14, 8]);
        break;
      case 'error':
        navigator.vibrate([35, 20, 35]);
        break;
      default:
        navigator.vibrate(12);
        break;
    }
  } catch (e) {
    // ignora se desativado no sistema
  }
}

window.triggerCampusHaptic = triggerHaptic;

// ============================================================================
// 3. PWA Install Prompt & Service Worker Registration
// ============================================================================
export function initPwaFeatures() {
  // Registra Service Worker sem cache HTTP no script e força verificação de update
  if ('serviceWorker' in navigator) {
    let swRegistration = null;
    const initialBootController = navigator.serviceWorker.controller;
    const bootStartedAt = Date.now();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Se já havia um SW antigo controlando e um novo assumiu após o boot, atualiza o bundle em execução
      if (initialBootController && Date.now() - bootStartedAt > 1500) {
        fetch('api/auth.php?action=version&_=' + Date.now(), { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            const v = d && d.version ? String(d.version).trim() : '';
            if (v && v !== (window.MYCO_VERSION || '')) {
              forceCacheBustReload(v);
            }
          })
          .catch(() => {});
      }
    });

    const registerAndCheckSw = () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
        swRegistration = reg;
        if (typeof reg.update === 'function') reg.update().catch(() => {});
        // Atualiza silenciosamente e ativa imediatamente se houver nova versão
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nova versão disponível em cache');
                try { installingWorker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
              }
            };
          }
        };
      }).catch((err) => {
        console.warn('[PWA] Falha ao registrar Service Worker:', err);
      });
    };

    if (document.readyState === 'complete') registerAndCheckSw();
    else window.addEventListener('load', registerAndCheckSw);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && swRegistration && typeof swRegistration.update === 'function') {
        swRegistration.update().catch(() => {});
      }
    });
  }

  // Captura evento nativo do navegador para instalar o app
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.style.display = 'none';
    if (window.showCampusToast) {
      window.showCampusToast('📲 MycoCampus3D instalado com sucesso!');
    }
  });

  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn && isIosDevice() && !isStandaloneMode()) {
    installBtn.style.display = 'inline-flex';
    installBtn.textContent = '📲 App / Tela Cheia';
  }
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        if (isIosDevice()) {
          openIosFullscreenModal();
        }
        return;
      }
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        installBtn.style.display = 'none';
      }
      deferredInstallPrompt = null;
    });
  }
}
