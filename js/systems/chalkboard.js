export function drawBoardSegment(ctx, color, p0, p1) {
  if (!ctx) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (color === 'erase') {
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 38;
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4.5;
  }
  ctx.beginPath();
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.stroke();
  ctx.restore();
}

export function applyStrokeToBoard(chalkboards, st) {
  var b = chalkboards[st && st.b ? st.b : 0] || chalkboards[0];
  if (!b || !st || !st.pts || !st.pts.length) return;
  var pts = st.pts;
  for (var i = 0; i < pts.length; i++) {
    var p0 = i === 0 ? pts[0] : pts[i - 1];
    drawBoardSegment(b.ctx, st.c, p0, pts[i]);
  }
  b.tex.needsUpdate = true;
}

export function getHeldBoardToolColor(heldItem) {
  if (!heldItem) return null;
  if (heldItem.id.indexOf('chalk_white') === 0) return '#f8fafc';
  if (heldItem.id.indexOf('chalk_green') === 0) return '#4ade80';
  if (heldItem.id.indexOf('chalk_yellow') === 0) return '#facc15';
  if (heldItem.id.indexOf('board_eraser') === 0) return 'erase';
  return null;
}
