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
import * as textures from './engine/textures.js';
import * as physics from './engine/physics.js';
import * as quality from './core/quality.js';
import * as rainbow from './engine/rainbow.js';
import * as cinema from './engine/cinema.js';
import * as environment from './engine/environment.js';
import { bootApp } from './ui/app-boot.js';

// Ponte de módulos para o motor 3D durante a migração incremental
window.__MYCO_MODULES__ = {
  textures,
  physics,
  quality,
  rainbow,
  cinema,
  environment
};

// Ponte de depuração inspecionável via DevTools
window.__MYCO_DEBUG__ = {
  version: getAppVersion(),
  appState,
  worldState,
  events,
  mathPool,
  audio: AudioEngine,
  api: apiClient,
  modules: window.__MYCO_MODULES__
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
