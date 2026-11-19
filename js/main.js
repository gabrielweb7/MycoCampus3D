/**
 * MycoCampus3D — Ponto de Entrada Único (ES Modules)
 * Orquestra configuração, depuração centralizada, serviços, motor 3D e camada de UI.
 */
// PRIMEIRO import: publica window.THREE (three.js r187) antes dos outros módulos.
import './vendor/three-global.js';
import { getAppVersion } from './core/constants.js';
import { GAME_CONFIG } from './core/config.js';
import { initI18n, setLanguage, getLanguage, t } from './core/i18n.js';
import { logger, installGlobalErrorHandlers } from './core/logger.js';
import { appState, worldState } from './core/state.js';
import { events } from './core/events.js';
import * as mathPool from './core/math-pool.js';
import { AudioEngine } from './services/audio-engine.js';
import * as apiClient from './services/api-client.js';
import { checkForApkUpdate, isRunningInApk } from './services/apk-updater.js';
import { registerCampusPublicApi } from './systems/campus-init.js';
import { bootApp } from './ui/app-boot.js';

// Instala captura centralizada de erros globais e Promises rejeitadas
installGlobalErrorHandlers();

// Registra API pública do motor 3D (window.initCampus3D, window.MycoCampus, etc.)
registerCampusPublicApi();

// Ponte de depuração inspecionável via DevTools
window.__MYCO_DEBUG__ = {
  version: getAppVersion(),
  config: GAME_CONFIG,
  i18n: { initI18n, setLanguage, getLanguage, t },
  logger,
  appState,
  worldState,
  events,
  mathPool,
  audio: AudioEngine,
  api: apiClient,
  isRunningInApk,
  checkApkUpdate: (opts) => checkForApkUpdate({ forcePrompt: true, ...(opts || {}) })
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    logger.tryCall('initI18n', initI18n);
    logger.tryCall('bootApp', bootApp);
  });
} else {
  logger.tryCall('initI18n', initI18n);
  logger.tryCall('bootApp', bootApp);
}
