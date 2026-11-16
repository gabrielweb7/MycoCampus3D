/**
 * MycoCampus3D — Ponto de Entrada Único (ES Modules)
 * Orquestra fundação, serviços, motor 3D e camada de UI.
 */
import { getAppVersion } from './core/constants.js';
import { appState, worldState } from './core/state.js';
import { events } from './core/events.js';
import * as mathPool from './core/math-pool.js';
import { AudioEngine } from './services/audio-engine.js';
import * as apiClient from './services/api-client.js';
import { registerCampusPublicApi } from './systems/campus-init.js';
import { bootApp } from './ui/app-boot.js';

// Registra API publica do motor 3D (window.initCampus3D, window.MycoCampus, etc.)
registerCampusPublicApi();

// Ponte de depuração inspecionável via DevTools
window.__MYCO_DEBUG__ = {
  version: getAppVersion(),
  appState,
  worldState,
  events,
  mathPool,
  audio: AudioEngine,
  api: apiClient
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
