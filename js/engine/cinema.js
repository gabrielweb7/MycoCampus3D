/**
 * MycoCampus3D — Telão Interativo do Cinema & Auditório
 */

let cinemaFrameAccum = 0;

export function getCinemaHitTarget(uv, state) {
  if (!state.power) return { type: 'power_on' };
  const px = (uv ? uv.x : 0.5) * 768;
  const py = (uv ? uv.y : 0.5) * 384;
  if (px >= 624 && px <= 752 && py >= 10 && py <= 46) return { type: 'power_off' };
  if (state.lessonIdx === -1) {
    const count = (state.lessons && state.lessons.length) || 6;
    for (let i = 0; i < count; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x0 = col === 0 ? 20 : 394;
      const y0 = 70 + row * 100;
      if (px >= x0 && px <= x0 + 354 && py >= y0 && py <= y0 + 88) {
        return { type: 'lesson', idx: i };
      }
    }
    return { type: 'idle' };
  }
  if (px >= 16 && px <= 130 && py >= 10 && py <= 46) return { type: 'menu' };
  return { type: 'toggle_play' };
}

export function drawCinemaVideoFrame(dt, state) {
  const { ctx, tex, camera } = state;
  if (!ctx || !tex) return;
  if (state.power && state.lessonIdx >= 0 && state.playing) state.time += dt;
  cinemaFrameAccum += dt;
  if (!state.dirty) {
    if (!state.power || state.lessonIdx === -1 || !state.playing) return;
    if (cinemaFrameAccum < 0.09) return;
    if (camera && Math.hypot(camera.position.x - 48, camera.position.z + 12) > 65) return;
  }
  cinemaFrameAccum = 0;
  state.dirty = false;

  const W = 768, H = 384;

  if (!state.power) {
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(W - 24, H - 20, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏻ TELA DESLIGADA — Clique para ligar', W / 2, H / 2 + 4);
    ctx.textAlign = 'left';
    tex.needsUpdate = true;
    return;
  }

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0f172a');
  g.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const hoverTarget = state.hovered ? getCinemaHitTarget(state.hoveredUv, state) : { type: 'none' };

  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, 0, W, 56);
  ctx.fillStyle = hoverTarget.type === 'power_off' ? '#ef4444' : '#991b1b';
  ctx.fillRect(624, 10, 128, 36);
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(624, 10, 128, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⏻ DESLIGAR', 688, 33);
  ctx.textAlign = 'left';

  if (state.lessonIdx === -1) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('🎬 AUDITÓRIO MYCOCAMPUS — MÓDULOS & AULAS', 22, 35);

    const list = (state.lessons && state.lessons.length) ? state.lessons : [
      { title: '1. Fluxo Laminar & Técnica Asséptica', subtitle: 'Controle de contaminação no laboratório' }
    ];
    for (let i = 0; i < Math.min(list.length, 6); i++) {
      const mod = list[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = col === 0 ? 20 : 394;
      const by = 70 + row * 100;
      const isHov = hoverTarget.type === 'lesson' && hoverTarget.idx === i;
      ctx.fillStyle = isHov ? 'rgba(14, 116, 144, 0.72)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(bx, by, 354, 88);
      ctx.strokeStyle = isHov ? '#38bdf8' : '#334155';
      ctx.lineWidth = isHov ? 2.5 : 1.5;
      ctx.strokeRect(bx, by, 354, 88);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`MÓDULO ${i + 1}  •  ▶ ASSISTIR`, bx + 14, by + 22);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px system-ui, sans-serif';
      let tTxt = mod.title || (`Módulo ${i + 1}`);
      if (tTxt.length > 36) tTxt = tTxt.slice(0, 35) + '…';
      ctx.fillText(tTxt, bx + 14, by + 46);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px system-ui, sans-serif';
      let sTxt = mod.subtitle || '';
      if (sTxt.length > 46) sTxt = sTxt.slice(0, 45) + '…';
      ctx.fillText(sTxt, bx + 14, by + 68);
    }
    tex.needsUpdate = true;
    return;
  }

  const lesson = (state.lessons && state.lessons[state.lessonIdx]) || { title: 'Aula', subtitle: '', bullets: [] };
  ctx.fillStyle = hoverTarget.type === 'menu' ? '#0284c7' : '#1e293b';
  ctx.fillRect(16, 10, 114, 36);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, 10, 114, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⬅️ MENU', 73, 33);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 17px system-ui, sans-serif';
  let headTitle = lesson.title || (`Módulo ${state.lessonIdx + 1}`);
  if (headTitle.length > 44) headTitle = headTitle.slice(0, 43) + '…';
  ctx.fillText(headTitle, 146, 35);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(lesson.subtitle || '', 26, 86);
  const bullets = lesson.bullets || [];
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px system-ui, sans-serif';
  for (let bIdx = 0; bIdx < Math.min(bullets.length, 4); bIdx++) {
    ctx.fillText('• ' + bullets[bIdx], 26, 128 + bIdx * 42);
  }

  const t = state.time;
  const cxA = 615, cyA = 195;
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 9; k++) {
    const ang = (k / 9) * Math.PI * 2 + t * 0.25;
    const r = 34 + ((Math.sin(t * 1.1 + k) + 1) * 0.5) * 68;
    ctx.beginPath();
    ctx.moveTo(cxA, cyA);
    ctx.quadraticCurveTo(cxA + Math.cos(ang + 0.4) * r * 0.6, cyA + Math.sin(ang + 0.4) * r * 0.6, cxA + Math.cos(ang) * r, cyA + Math.sin(ang) * r);
    ctx.stroke();
  }
  const grow = 0.6 + 0.4 * Math.sin(t * 0.9);
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(cxA - 10, cyA - 36 * grow, 20, 40 * grow);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cxA, cyA - 36 * grow, 30 * grow, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, H - 44, W, 44);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(state.playing ? '⏸️ Clique na aula para pausar' : '▶️ PAUSADO (clique para continuar)', 22, H - 17);
  const prog = (t % 20) / 20;
  ctx.fillStyle = '#334155';
  ctx.fillRect(420, H - 25, 320, 8);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(420, H - 25, 320 * prog, 8);
  tex.needsUpdate = true;
}
