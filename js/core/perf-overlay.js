/**
 * MycoCampus3D — Overlay de desempenho (ative com ?perf=1).
 * Mostra FPS, ms de CPU por frame, draw calls, triângulos, geometrias e texturas.
 * Quando desligado, stepPerfOverlay é um no-op (custo ~zero).
 */
let enabled = false;
let el = null;
let frames = 0;
let lastUpdate = 0;
let cpuAccum = 0;
let cpuMax = 0;
let frameStart = 0;

try {
  enabled = typeof location !== 'undefined' && /[?&]perf=1\b/.test(location.search);
} catch (e) {}

function ensureEl() {
  if (el || typeof document === 'undefined' || !document.body) return;
  el = document.createElement('pre');
  el.id = 'perf-overlay';
  el.style.cssText = 'position:fixed;top:4px;left:4px;z-index:99999;margin:0;padding:4px 6px;' +
    'font:11px/1.3 monospace;color:#a7f3d0;background:rgba(0,0,0,.6);border-radius:4px;' +
    'pointer-events:none;white-space:pre';
  document.body.appendChild(el);
}

export function perfBegin() {
  if (enabled) frameStart = performance.now();
}

/** Chamar logo depois de renderer.render(). */
export function perfEnd(renderer, qualityState) {
  if (!enabled) return;
  const now = performance.now();
  const cpu = now - frameStart;
  cpuAccum += cpu;
  if (cpu > cpuMax) cpuMax = cpu;
  frames++;
  if (now - lastUpdate < 500) return;
  ensureEl();
  if (!el) return;
  const info = renderer && renderer.info;
  const r = info ? info.render : { calls: 0, triangles: 0 };
  const m = info ? info.memory : { geometries: 0, textures: 0 };
  const fps = Math.round((frames * 1000) / Math.max(1, now - lastUpdate));
  el.textContent =
    'FPS ' + fps + '  CPU ' + (cpuAccum / Math.max(1, frames)).toFixed(1) + 'ms (max ' + cpuMax.toFixed(0) + ')\n' +
    'calls ' + r.calls + '  tris ' + r.triangles + '\n' +
    'geo ' + m.geometries + '  tex ' + m.textures + '\n' +
    'tier ' + (qualityState ? qualityState.tier : '?') +
    '  dpr ' + (renderer ? renderer.getPixelRatio().toFixed(2) : '?');
  frames = 0;
  cpuAccum = 0;
  cpuMax = 0;
  lastUpdate = now;
}
