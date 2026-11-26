/**
 * Mini-timers discretos na HUD para Panela de Pressão e Desidratadora.
 * Atualiza apenas quando o texto visível muda (zero trabalho por frame).
 */
import { t } from '../core/i18n.js';

let lastSignature = '';

export function syncHudMiniTimers(ctx) {
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById('hud-mini-timers');
  if (!wrap) return;

  if (!ctx || !ctx.inFps || ctx.lobbyTourActive) {
    if (lastSignature !== '') {
      lastSignature = '';
      wrap.replaceChildren();
    }
    return;
  }

  const pills = [];
  if (Array.isArray(ctx.cookerPots)) {
    for (let i = 0; i < ctx.cookerPots.length; i++) {
      const cp = ctx.cookerPots[i];
      if (!cp) continue;
      if (cp.progress >= 100 && cp.psi > 0.5) {
        pills.push({ id: 'pot_done_' + i, text: t('misc.timers.pot_ready'), cls: 'border-emerald-400/50 text-emerald-200 bg-emerald-950/80' });
      } else if (cp.progress > 0 && cp.progress < 100) {
        pills.push({ id: 'pot_' + i, text: t('misc.timers.pot_pct', { pct: Math.round(cp.progress) }), cls: 'border-amber-400/45 text-amber-200 bg-slate-900/85' });
      }
    }
  }

  if (Array.isArray(ctx.pickableItems)) {
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      const dc = it && it.dehydratorCtrl;
      if (!dc || !dc.hasMushroom) continue;
      if (dc.crisp) {
        pills.push({ id: 'deh_done_' + it.id, text: t('misc.timers.deh_ready'), cls: 'border-emerald-400/50 text-emerald-200 bg-emerald-950/80' });
      } else {
        const pct = Math.max(0, Math.min(99, Math.round(dc.progress || 0)));
        pills.push({ id: 'deh_' + it.id, text: t('misc.timers.deh_pct', { pct }), cls: 'border-orange-400/45 text-orange-200 bg-slate-900/85' });
      }
    }
  }

  const sig = pills.map((p) => p.id + ':' + p.text).join('|');
  if (sig === lastSignature) return;
  lastSignature = sig;

  wrap.replaceChildren();
  for (let i = 0; i < pills.length; i++) {
    const p = pills[i];
    const el = document.createElement('div');
    el.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-md ' + p.cls;
    el.textContent = p.text;
    wrap.appendChild(el);
  }
}
