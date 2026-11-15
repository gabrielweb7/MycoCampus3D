/**
 * MycoCampus3D — Constantes Globais da Aplicação
 */
export const HAT_COLORS = ['#dc2626', '#d97706', '#9333ea', '#059669', '#2563eb', '#db2777'];
export const BODY_COLORS = ['#4f46e5', '#0f766e', '#1e293b', '#b45309', '#be185d', '#334155'];

export const SYNC_INTERVAL_MS = 125;
export const SYNC_BACKGROUND_INTERVAL_MS = 1500;
export const VIRTUAL_DAY_SECONDS = 2400; // 40 minutos reais = 24h virtuais

export function getAppVersion() {
  return (typeof window !== 'undefined' && window.MYCO_VERSION) ? window.MYCO_VERSION : 'dev';
}

export function createSessionId() {
  return 'mc_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}
