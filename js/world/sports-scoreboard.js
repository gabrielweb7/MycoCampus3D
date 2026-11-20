/**
 * Placar 3D dos Esportes (Futebol & Basquete) — Desenho sob demanda (zero custo por frame)
 */

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;

let sbCanvas = null;
let sbCtx = null;
let sbTex = null;

export const sportsScoreState = {
  soccerGoals: 0,
  basketPoints: 0,
  basketStreak: 0
};

export function redrawSportsScoreboard() {
  if (!sbCtx || !sbTex) return;
  const w = 256;
  const h = 128;
  sbCtx.fillStyle = '#0f172a';
  sbCtx.fillRect(0, 0, w, h);
  sbCtx.strokeStyle = '#38bdf8';
  sbCtx.lineWidth = 4;
  sbCtx.strokeRect(4, 4, w - 8, h - 8);

  sbCtx.fillStyle = '#fde047';
  sbCtx.font = 'bold 18px system-ui, sans-serif';
  sbCtx.textAlign = 'center';
  sbCtx.fillText('🏆 ARENA MYCOCAMPUS', w / 2, 27);

  sbCtx.fillStyle = '#4ade80';
  sbCtx.font = 'bold 26px system-ui, sans-serif';
  sbCtx.fillText(`⚽ ${sportsScoreState.soccerGoals}`, w * 0.28, 72);

  sbCtx.fillStyle = '#fb923c';
  sbCtx.fillText(`🏀 ${sportsScoreState.basketPoints}`, w * 0.72, 72);

  sbCtx.fillStyle = sportsScoreState.basketStreak >= 2 ? '#facc15' : '#94a3b8';
  sbCtx.font = 'bold 15px system-ui, sans-serif';
  sbCtx.fillText(
    sportsScoreState.basketStreak >= 2
      ? `🔥 SEQUÊNCIA x${sportsScoreState.basketStreak} (+🪙 25!)`
      : 'Marque gol ou cesta (+🪙 15)',
    w / 2,
    108
  );
  sbTex.needsUpdate = true;
}

export function buildSportsScoreboard(scene) {
  if (!THREE || !scene || typeof document === 'undefined') return null;

  sbCanvas = document.createElement('canvas');
  sbCanvas.width = 256;
  sbCanvas.height = 128;
  sbCtx = sbCanvas.getContext('2d');
  sbTex = new THREE.CanvasTexture(sbCanvas);
  sbTex.generateMipmaps = false;
  sbTex.minFilter = THREE.LinearFilter;
  sbTex.userData.shared = true;
  redrawSportsScoreboard();

  const g = new THREE.Group();
  g.position.set(-50, 0, -4.6);

  const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
  const screenMat = new THREE.MeshBasicMaterial({ map: sbTex });

  [-1.1, 1.1].forEach((ox) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 3.6, 8), postMat);
    post.position.set(ox, 1.8, 0);
    g.add(post);
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.45, 0.16), frameMat);
  box.position.set(0, 3.55, 0);
  const screenFront = new THREE.Mesh(new THREE.PlaneGeometry(2.72, 1.32), screenMat);
  screenFront.position.set(0, 3.55, -0.09);
  screenFront.rotation.y = Math.PI;
  const screenBack = new THREE.Mesh(new THREE.PlaneGeometry(2.72, 1.32), screenMat);
  screenBack.position.set(0, 3.55, 0.09);

  g.add(box, screenFront, screenBack);
  scene.add(g);
  g.updateMatrixWorld(true);
  g.traverse((ch) => { ch.matrixAutoUpdate = false; });
  return g;
}

export function applySportsWorldState(stateMap) {
  if (!stateMap) return;
  let dirty = false;
  if (stateMap.sport_soccer_goals !== undefined) {
    const v = Math.max(0, parseInt(stateMap.sport_soccer_goals, 10) || 0);
    if (v !== sportsScoreState.soccerGoals) { sportsScoreState.soccerGoals = v; dirty = true; }
  }
  if (stateMap.sport_basket_points !== undefined) {
    const v = Math.max(0, parseInt(stateMap.sport_basket_points, 10) || 0);
    if (v !== sportsScoreState.basketPoints) { sportsScoreState.basketPoints = v; dirty = true; }
  }
  if (stateMap.sport_basket_streak !== undefined) {
    const v = Math.max(0, parseInt(stateMap.sport_basket_streak, 10) || 0);
    if (v !== sportsScoreState.basketStreak) { sportsScoreState.basketStreak = v; dirty = true; }
  }
  if (dirty) redrawSportsScoreboard();
}

export function recordSportScore(kind) {
  if (kind === 'soccer') {
    sportsScoreState.soccerGoals++;
    sportsScoreState.basketStreak = 0;
  } else {
    sportsScoreState.basketPoints += 2;
    sportsScoreState.basketStreak++;
  }
  redrawSportsScoreboard();
  const bonus = (kind === 'basketball' && sportsScoreState.basketStreak >= 2) ? 25 : 15;
  return {
    coins: bonus,
    streak: sportsScoreState.basketStreak,
    soccerGoals: sportsScoreState.soccerGoals,
    basketPoints: sportsScoreState.basketPoints
  };
}
