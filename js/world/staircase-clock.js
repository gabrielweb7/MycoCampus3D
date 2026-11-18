import { getTextures, brickMat, makeBox, registerSnowable } from '../engine/textures.js';
import { addWalkableSlab, addSolidWall } from '../engine/physics.js';
import { createBanner } from './nature-plaza.js';

var clockCanvas = null;
var clockCtx = null;
var clockTex = null;
var lastClockMin = -1;

var rankingCanvas = null;
var rankingCtx = null;
var rankingTex = null;
var rankingList = [];
var rankingScroll = 0;

var auditoriumCtx = null;
var auditoriumTex = null;

// Ciclo completo de 40 minutos reais (20 min dia + 20 min noite) sincronizado para todos via UTC
export function getVirtualDayFrac() {
  return ((Date.now() / 1000) % 2400) / 2400; // 0.0=00h, 0.25=06h, 0.50=12h, 0.75=18h
}

export function updateClockTexture() {
  if (!clockCtx || !clockTex) return;
  var totalMin = Math.floor(getVirtualDayFrac() * 1440);
  var m = totalMin % 60;
  if (m === lastClockMin) return;
  lastClockMin = m;
  var h = Math.floor(totalMin / 60) % 12;

  var ctx = clockCtx;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 10; ctx.stroke();

  for (var i = 0; i < 12; i++) {
    var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
    ctx.lineTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106);
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.stroke();
  }

  var hAng = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  var mAng = (m / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#0f172a';
  ctx.lineCap = 'round';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(hAng) * 58, 128 + Math.sin(hAng) * 58); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(mAng) * 86, 128 + Math.sin(mAng) * 86); ctx.stroke();

  clockTex.needsUpdate = true;
}

export function drawRankingBoard() {
  if (!rankingCtx || !rankingTex) return;
  var ctx = rankingCtx;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 1024);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(14, 14, 484, 90);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆 RANKING DO CAMPUS', 256, 70);

  var perPage = 8;
  var maxStart = Math.max(0, rankingList.length - perPage);
  if (rankingScroll > maxStart) rankingScroll = maxStart;

  if (!rankingList.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Carregando ranking...', 256, 260);
  } else {
    for (var i = 0; i < perPage; i++) {
      var idx = rankingScroll + i;
      if (idx >= rankingList.length) break;
      var row = rankingList[idx];
      var y = 128 + i * 102;
      var isProf = row.role === 'professor' || row.role === 'admin';
      ctx.fillStyle = idx === 0 ? 'rgba(251, 191, 36, 0.18)' : 'rgba(30, 41, 59, 0.9)';
      ctx.fillRect(20, y, 472, 88);

      // Posicao (#1, #2, #3...)
      ctx.textAlign = 'left';
      ctx.fillStyle = idx === 0 ? '#fbbf24' : (idx === 1 ? '#e2e8f0' : (idx === 2 ? '#fb923c' : '#94a3b8'));
      ctx.font = 'bold 30px system-ui, sans-serif';
      var medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '#' + (idx + 1)));
      ctx.fillText(medal, 32, y + 54);

      // Cargo + Nome
      ctx.fillStyle = isProf ? '#fbbf24' : '#34d399';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(isProf ? 'PROF.' : 'ALUNO', 105, y + 32);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px system-ui, sans-serif';
      var nm = String(row.display_name || row.name || 'Explorador').slice(0, 16);
      ctx.fillText(nm, 105, y + 66);

      // XP
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText((row.xp || 0) + ' XP', 476, y + 54);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText((rankingScroll + 1) + '–' + Math.min(rankingList.length, rankingScroll + perPage) + ' de ' + rankingList.length, 256, 985);
  }
  rankingTex.needsUpdate = true;
}

export function setRankingList(list) {
  rankingList = Array.isArray(list) ? list : [];
  drawRankingBoard();
}

export function scrollRanking(direction) {
  var maxStart = Math.max(0, rankingList.length - 8);
  if (direction === 'up') rankingScroll = Math.max(0, rankingScroll - 1);
  else rankingScroll = Math.min(maxStart, rankingScroll + 1);
  drawRankingBoard();
}

export function buildStaircaseAndBridge(ctx) {
  var scene = ctx.scene;
  var texPaving = getTextures().texPaving;
  var yTop = 3.80;
  // 14 degraus arquitetonicos de z=-11.5 ate z=-18.5 (subindo de y=0 ate y=3.80)
  var steps = 14;
  var stepD = 7.0 / steps;
  var stepH = yTop / steps;
  var riserMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
  var treadMat = new THREE.MeshStandardMaterial({ map: texPaving, color: 0xe2e8f0, roughness: 0.65 });
  var noseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.25 });
  for (var i = 0; i < steps; i++) {
    var sy = (i + 1) * stepH;
    var sz = -11.5 - (i + 0.5) * stepD;
    var riserH = Math.max(0.05, sy - 0.06);
    var riser = new THREE.Mesh(new THREE.BoxGeometry(8.2, riserH, stepD), riserMat);
    riser.position.set(0, riserH / 2, sz);
    riser.castShadow = true; riser.receiveShadow = true;
    var tread = new THREE.Mesh(new THREE.BoxGeometry(8.36, 0.06, stepD + 0.03), treadMat);
    tread.position.set(0, sy - 0.03, sz + 0.015);
    tread.castShadow = true; tread.receiveShadow = true;
    var nose = new THREE.Mesh(new THREE.BoxGeometry(8.36, 0.025, 0.04), noseMat);
    nose.position.set(0, sy - 0.012, sz + stepD / 2 + 0.015);
    scene.add(riser, tread, nose);
  }
  ctx.stairsList.push({ minX: -4.15, maxX: 4.15, zStart: -11.5, zEnd: -18.5, yStart: 0, yEnd: yTop });

  // Guarda-corpo inclinado profissional com viga lateral, vidro temperado, postes e corrimao metalico
  var slopeLen = Math.hypot(7.0, yTop);
  var slopeAng = Math.atan2(yTop, 7.0);
  var steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 });
  var railMetalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.22, metalness: 0.8 });
  var stairGlassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.2 });
  [-4.25, 4.25].forEach(function (rx) {
    var stringer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, slopeLen + 0.3), steelMat);
    stringer.position.set(rx, yTop / 2 - 0.08, -15.0);
    stringer.rotation.x = slopeAng;
    stringer.castShadow = true;
    var glassPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.88, slopeLen), stairGlassMat);
    glassPanel.position.set(rx, yTop / 2 + 0.52, -15.0);
    glassPanel.rotation.x = slopeAng;
    var handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, slopeLen + 0.2, 12), railMetalMat);
    handrail.position.set(rx, yTop / 2 + 1.0, -15.0);
    handrail.rotation.x = Math.PI / 2 + slopeAng;
    scene.add(stringer, glassPanel, handrail);

    for (var pIdx = 0; pIdx <= 3; pIdx++) {
      var frac = pIdx / 3;
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.02, 0.08), steelMat);
      post.position.set(rx, frac * yTop + 0.51, -11.5 - frac * 7.0);
      scene.add(post);
    }
    ctx.solidColliders.push({ minX: rx - 0.22, maxX: rx + 0.22, minZ: -18.55, maxZ: -11.45, minY: 0, maxY: 5.0 });
  });

  // Patamar Superior atras do topo da escada (z = -22.5 .. -18.5, livre dos degraus e conectado ao Relogio e as duas alas!)
  addWalkableSlab(ctx.scene, ctx.walkableFloors, 0, yTop, -20.5, 5.6, 0.34, 4.0, 0x475569, { roughness: 0.6 });
  addWalkableSlab(ctx.scene, ctx.walkableFloors, -12.0, yTop, -20.5, 18.4, 0.34, 4.0, 0x475569, { roughness: 0.6 });
  addWalkableSlab(ctx.scene, ctx.walkableFloors, 12.0, yTop, -20.5, 18.4, 0.34, 4.0, 0x475569, { roughness: 0.6 });

  // Pontes laterais ligando o Patamar (-18.5) direto as portas do 2o andar (-12.975) dos dois lados (x = +-19)
  [-19, 19].forEach(function (ax) {
    addWalkableSlab(ctx.scene, ctx.walkableFloors, ax, yTop, -15.7375, 4.4, 0.34, 5.525, 0x475569, { roughness: 0.6 });
    addSolidWall(ctx.scene, ctx.wallSegments, ax - 2.12, -18.5, ax - 2.12, -12.975, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    addSolidWall(ctx.scene, ctx.wallSegments, ax + 2.12, -18.5, ax + 2.12, -12.975, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
  });

  // Pilares estruturais sustentando o patamar superior e as pontes laterais
  [-19, -11, 11, 19].forEach(function (px) {
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, yTop - 0.34, 14), steelMat);
    col.position.set(px, (yTop - 0.34) / 2, -20.5);
    col.castShadow = true; col.receiveShadow = true;
    scene.add(col);
  });
  [-19, 19].forEach(function (px) {
    var colS = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, yTop - 0.34, 14), steelMat);
    colS.position.set(px, (yTop - 0.34) / 2, -15.5);
    colS.castShadow = true; colS.receiveShadow = true;
    scene.add(colS);
  });

  // Guarda-corpo de vidro + corrimao metalico no patamar superior (sem bloquear a saida da escada nem a Ponte Norte)
  [-1, 1].forEach(function (side) {
    addSolidWall(ctx.scene, ctx.wallSegments, side * 4.25, -18.55, side * 16.85, -18.55, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    var railS = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.06, 0.1), railMetalMat);
    railS.position.set(side * 10.55, yTop + 1.03, -18.55);
    scene.add(railS);

    addSolidWall(ctx.scene, ctx.wallSegments, side * 2.8, -22.45, side * 21.15, -22.45, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
    var railN = new THREE.Mesh(new THREE.BoxGeometry(18.35, 0.06, 0.1), railMetalMat);
    railN.position.set(side * 11.975, yTop + 1.03, -22.45);
    scene.add(railN);

    addSolidWall(ctx.scene, ctx.wallSegments, side * 21.15, -22.45, side * 21.15, -18.55, yTop, 1.02, 0.08, 0xbae6fd, { transparent: true, opacity: 0.38 });
  });

  // Pontes ligando Bloco Norte <-> Bloco Sul no 2o andar (x = +-19, z = -1.025 .. 2.025, y = 3.80, encontro exato sem z-fighting)
  [-19, 19].forEach(function (ax) {
    addWalkableSlab(ctx.scene, ctx.walkableFloors, ax, yTop, 0.5, 4.4, 0.28, 3.05, 0x475569, { roughness: 0.6 });
    addSolidWall(ctx.scene, ctx.wallSegments, ax - 2.1, -1.025, ax - 2.1, 2.025, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
    addSolidWall(ctx.scene, ctx.wallSegments, ax + 2.1, -1.025, ax + 2.1, 2.025, yTop, 1.05, 0.1, 0xbae6fd, { transparent: true, opacity: 0.45 });
  });

  // Terraco Norte (y = 3.80, x: -24..24, z: -29.5 .. -42.0) — separado da passarela por um Lago Norte organico
  addWalkableSlab(ctx.scene, ctx.walkableFloors, 0, yTop, -35.75, 48.0, 3.80, 12.5, 0x94a3b8, { roughness: 0.8 });

  // Ponte Norte sobre o lago ligando o Patamar (-22.5) ate o Terraco da Torre do Relogio (-29.5)
  addWalkableSlab(ctx.scene, ctx.walkableFloors, 0, yTop, -26.0, 5.6, 0.34, 7.0, 0x64748b, { roughness: 0.65 });
  [-2.75, 2.75].forEach(function (bx) {
    addSolidWall(ctx.scene, ctx.wallSegments, bx, -29.5, bx, -22.5, yTop, 1.05, 0.12, 0xbae6fd, { transparent: true, opacity: 0.45 });
  });

  // Lago Norte organico com borda de pedras dos dois lados da Ponte Norte
  var nLakeMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.88 });
  var nRimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  [-7.2, 7.2].forEach(function (lx) {
    var pond = new THREE.Mesh(new THREE.CircleGeometry(4.6, 26), nLakeMat);
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(1.2, 0.9, 1);
    pond.position.set(lx, 0.06, -24.0);
    scene.add(pond);
    var rim = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.05, 26), nRimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.scale.set(1.2, 0.9, 1);
    rim.position.set(lx, 0.055, -24.0);
    scene.add(rim);
  });
}

export function buildClockTowerAndAuditorium(ctx) {
  var scene = ctx.scene;
  var baseY = 3.80;

  // Alas laterais simetricas da Reitoria caminhaveis com porta aberta (z = -40.2..-33.8)
  [-9.5, 9.5].forEach(function (ax) {
    addWalkableSlab(ctx.scene, ctx.walkableFloors, ax, baseY + 0.02, -37.0, 11.0, 0.04, 6.4, 0x334155);
    var rRoof = makeBox(11.4, 0.45, 6.8, 0x64748b);
    rRoof.position.set(ax, baseY + 6.3, -37.0);
    registerSnowable(rRoof.material);
    ctx.roofZones.push({ minX: ax - 5.7, maxX: ax + 5.7, minZ: -40.4, maxZ: -33.6, roofY: baseY + 6.5 });
    scene.add(rRoof);

    addSolidWall(ctx.scene, ctx.wallSegments, ax - 5.5, -40.2, ax + 5.5, -40.2, baseY, 6.1, 0.28, brickMat(3, 2)); // Fundo
    addSolidWall(ctx.scene, ctx.wallSegments, ax - 5.5, -40.2, ax - 5.5, -33.8, baseY, 6.1, 0.28, brickMat(2, 2)); // Esq
    addSolidWall(ctx.scene, ctx.wallSegments, ax + 5.5, -40.2, ax + 5.5, -33.8, baseY, 6.1, 0.28, brickMat(2, 2)); // Dir
    // Fachada frontal (z = -33.8) com porta aberta de 2.4m no centro e janelas laterais
    addSolidWall(ctx.scene, ctx.wallSegments, ax - 5.5, -33.8, ax - 1.2, -33.8, baseY, 6.1, 0.26, brickMat(1.2, 2));
    addSolidWall(ctx.scene, ctx.wallSegments, ax + 1.2, -33.8, ax + 5.5, -33.8, baseY, 6.1, 0.26, brickMat(1.2, 2));
    var doorHeader = makeBox(2.5, 3.1, 0.28, brickMat(1, 1));
    doorHeader.position.set(ax, baseY + 4.55, -33.8);
    var rDesk = makeBox(2.6, 0.78, 1.1, 0x92400e, { roughness: 0.65 });
    rDesk.position.set(ax, baseY + 0.39, -38.2);
    scene.add(doorHeader, rDesk);
    ctx.solidColliders.push({ minX: ax - 1.35, maxX: ax + 1.35, minZ: -38.8, maxZ: -37.6, minY: baseY, maxY: baseY + 1.0 });
    ctx.supportSurfaces.push({ minX: ax - 1.25, maxX: ax + 1.25, minZ: -38.7, maxZ: -37.7, topY: baseY + 0.78 });
  });

  // Torre Central do Relogio
  var tower = makeBox(5.6, 12.6, 6.8, 0x64748b, { roughness: 0.55 });
  tower.position.set(0, baseY + 6.3, -37.0);
  scene.add(tower);
  var towerFrame = makeBox(3.6, 7.6, 0.16, 0x0f172a);
  towerFrame.position.set(0, baseY + 4.3, -33.52);
  scene.add(towerFrame);

  // Painel 3D Interativo de Ranking logo abaixo do Relogio
  rankingCanvas = document.createElement('canvas');
  rankingCanvas.width = 512; rankingCanvas.height = 1024;
  rankingCtx = rankingCanvas.getContext('2d');
  rankingTex = new THREE.CanvasTexture(rankingCanvas);
  var rankBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 6.6),
    new THREE.MeshBasicMaterial({ map: rankingTex })
  );
  rankBoard.position.set(0, baseY + 4.5, -33.42);
  scene.add(rankBoard);

  // Botoes 3D de rolagem (▲ Subir / ▼ Descer) no rodape do painel
  [['▲', -0.75, 'up'], ['▼', 0.75, 'down']].forEach(function (rb) {
    var bc = document.createElement('canvas');
    bc.width = 128; bc.height = 96;
    var bctx = bc.getContext('2d');
    bctx.fillStyle = '#1e293b'; bctx.fillRect(0, 0, 128, 96);
    bctx.strokeStyle = '#38bdf8'; bctx.lineWidth = 6; bctx.strokeRect(4, 4, 120, 88);
    bctx.fillStyle = '#f8fafc'; bctx.font = 'bold 48px system-ui, sans-serif';
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    bctx.fillText(rb[0], 64, 48);
    var btn = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.62, 0.1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) })
    );
    btn.position.set(rb[1], baseY + 0.85, -33.36);
    btn.userData.rankAction = rb[2];
    scene.add(btn);
    ctx.rankingBtnMeshes.push(btn);
  });
  drawRankingBoard();
  ctx.solidColliders.push({ minX: -2.9, maxX: 2.9, minZ: -40.5, maxZ: -33.5, minY: baseY, maxY: baseY + 13 });

  // Relogio funcional no topo da torre
  clockCanvas = document.createElement('canvas');
  clockCanvas.width = 256; clockCanvas.height = 256;
  clockCtx = clockCanvas.getContext('2d');
  clockTex = new THREE.CanvasTexture(clockCanvas);
  updateClockTexture();
  var clockMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 28),
    new THREE.MeshBasicMaterial({ map: clockTex })
  );
  clockMesh.position.set(0, baseY + 10.4, -33.5);
  scene.add(clockMesh);

  // Banners da Reitoria
  createBanner(scene, -4.6, baseY + 4.0, -33.6, 0, '#1d4ed8', '🎓');
  createBanner(scene, 4.6, baseY + 4.0, -33.6, 0, '#4338ca', '🍄');
}

export function updateCampusAuditoriumSlide(slideIndex, title, subtitle, bullets, presenter) {
  if (!auditoriumCtx || !auditoriumTex) return;
  var ctx = auditoriumCtx;
  var grad = ctx.createLinearGradient(0, 0, 1024, 576);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#064e3b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 576);

  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, 988, 540);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('🎓 MYCOCAMPUS 3D  •  SLIDE ' + (slideIndex + 1), 48, 72);

  if (presenter) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('👨‍🏫 Ao vivo: ' + presenter, 660, 72);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText(title || '', 48, 150);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '26px system-ui, sans-serif';
  ctx.fillText(subtitle || '', 48, 198);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '29px system-ui, sans-serif';
  (bullets || []).forEach(function (line, i) {
    ctx.fillText(line, 60, 275 + i * 68);
  });

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('💡 Clique no telão ou abra "Aulas" para praticar e ganhar XP!', 48, 520);

  auditoriumTex.needsUpdate = true;
}
