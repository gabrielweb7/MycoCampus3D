/**
 * Estação de Monitoramento da Fauna & Flora (MycoCampus3D)
 * - Ocupa o prédio ao lado do Empório Drive-Thru (x: 50, z: 28).
 * - Fachada iluminada com letreiro e radar giratório no telhado com farol de alerta.
 * - Interior com 3 telões de telemetria em tempo real:
 *   1. Flora & Abelhas (flores, pólen, colmeias ativas/extintas, rainhas/operárias, mel)
 *   2. Visão Geral Fauna & Flora (flores, abelhas, vaquinhas, cogumelos silvestres, horário)
 *   3. Radar do Campus + Alerta de Anomalia (detecta Gnomo Sombrio Solitário & Gnomo das Árvores)
 * - Bancada central de operadores com 3 computadores + bancada leste de amostras botânicas
 *   registradas como superfícies apoiáveis e colidíveis.
 */

import { makeBox } from '../engine/textures.js';
import { getBeeEcologySummary } from '../entities/bee-ecology.js';
import { getRareBlackGnomeTelemetry } from './trip-gnomes.js';
import { getVirtualDayFrac } from './staircase-clock.js';

const THREE = window.THREE;

const STATION_CENTER_X = 50;
const STATION_CENTER_Z = 28;
const FLOOR_TOP_Y = 0.21;

let stationState = null;

function registerStationSurface(ctx, mesh, x, z, w, d, topY, minY = 0) {
  const surf = {
    minX: x - w * 0.5,
    maxX: x + w * 0.5,
    minZ: z - d * 0.5,
    maxZ: z + d * 0.5,
    topY
  };
  ctx.solidColliders.push({
    minX: surf.minX,
    maxX: surf.maxX,
    minZ: surf.minZ,
    maxZ: surf.maxZ,
    minY,
    maxY: topY,
    surfaceTopY: topY
  });
  ctx.supportSurfaces.push(surf);
  if (ctx.supportMeshes && mesh) {
    mesh.userData.supportSurface = surf;
    ctx.supportMeshes.push(mesh);
  }
}

export function collectEcologyTelemetrySnapshot(ctx) {
  const beeSum = getBeeEcologySummary(ctx);
  const cows = (ctx && Array.isArray(ctx.pastureCows)) ? ctx.pastureCows : [];
  let cowActive = 0;
  let cowHealthSum = 0;
  let cowHappy = 0;
  for (let i = 0; i < cows.length; i++) {
    const c = cows[i];
    if (!c || c.abducted) continue;
    cowActive++;
    cowHealthSum += typeof c.health === 'number' ? c.health : 100;
    if ((c.happyTimer || 0) > 0) cowHappy++;
  }

  const wildMushrooms = (ctx && Array.isArray(ctx.wildMushrooms))
    ? ctx.wildMushrooms.filter((m) => m && m.active).length
    : 0;

  const gnome = getRareBlackGnomeTelemetry();
  const sunY = (ctx && typeof ctx.sunElevation === 'number')
    ? ctx.sunElevation
    : Math.sin((getVirtualDayFrac() - 0.25) * Math.PI * 2);
  const isNight = sunY < -0.05;

  const cowsList = [];
  for (let i = 0; i < cows.length; i++) {
    const c = cows[i];
    if (!c || c.abducted || !c.mesh || !c.mesh.position) continue;
    cowsList.push({ x: c.mesh.position.x, z: c.mesh.position.z });
  }
  const hiveList = (ctx && Array.isArray(ctx.beehives))
    ? ctx.beehives.filter((h) => h && !h.collected).map((h) => ({
      x: h.x,
      z: h.z,
      abandoned: !!h.abandoned,
      extinct: !!h.extinct,
      resting: !!h.groundResting
    }))
    : [];
  const flowerList = (ctx && Array.isArray(ctx.campusFlowers))
    ? ctx.campusFlowers.filter((f) => f && !f.removed).slice(0, 80).map((f) => ({
      x: f.x,
      z: f.z,
      stage: f.stage
    }))
    : [];

  return {
    ...beeSum,
    cowsCount: cowActive,
    avgCowHealthPct: cowActive > 0 ? Math.round(cowHealthSum / cowActive) : 0,
    happyCowsCount: cowHappy,
    wildMushroomsCount: wildMushrooms,
    isNight,
    gnome,
    radar: {
      cows: cowsList,
      hives: hiveList,
      flowers: flowerList
    }
  };
}

function drawRoundedPanel(sctx, x, y, w, h, r, fill, stroke = null) {
  sctx.fillStyle = fill;
  sctx.beginPath();
  if (sctx.roundRect) sctx.roundRect(x, y, w, h, r);
  else sctx.rect(x, y, w, h);
  sctx.fill();
  if (stroke) {
    sctx.strokeStyle = stroke;
    sctx.lineWidth = 3;
    sctx.stroke();
  }
}

function drawLeftMonitor(sctx, w, h, snap) {
  sctx.fillStyle = '#07131e';
  sctx.fillRect(0, 0, w, h);

  sctx.fillStyle = '#0f293d';
  sctx.fillRect(0, 0, w, 54);
  sctx.fillStyle = '#38bdf8';
  sctx.font = 'bold 24px system-ui, sans-serif';
  sctx.textAlign = 'left';
  sctx.fillText('🌸 FLORA & COLMEIAS DO CAMPUS', 22, 36);

  drawRoundedPanel(sctx, 20, 72, 225, 130, 12, '#0b1e2e', '#22c55e');
  sctx.fillStyle = '#86efac';
  sctx.font = 'bold 18px system-ui, sans-serif';
  sctx.fillText('Flores em Floração', 36, 102);
  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 42px system-ui, sans-serif';
  sctx.fillText(String(snap.bloomingFlowers), 36, 152);
  sctx.fillStyle = '#cbd5e1';
  sctx.font = '15px system-ui, sans-serif';
  sctx.fillText(`Pólen médio: ${snap.avgPollenPct}%`, 36, 184);

  drawRoundedPanel(sctx, 265, 72, 225, 130, 12, '#0b1e2e', '#facc15');
  sctx.fillStyle = '#fde047';
  sctx.font = 'bold 18px system-ui, sans-serif';
  sctx.fillText('Brotos & Sementes', 281, 102);
  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 42px system-ui, sans-serif';
  sctx.fillText(String(snap.sproutingFlowers + snap.seedingFlowers), 281, 152);
  sctx.fillStyle = '#cbd5e1';
  sctx.font = '15px system-ui, sans-serif';
  sctx.fillText(`${snap.sproutingFlowers} brotos • ${snap.seedingFlowers} sem.`, 281, 184);

  const hiveColor = snap.activeHives === 0 ? '#ef4444' : '#f59e0b';
  drawRoundedPanel(sctx, 20, 218, 470, 142, 12, '#0b1e2e', hiveColor);
  sctx.fillStyle = snap.activeHives === 0 ? '#fca5a5' : '#fcd34d';
  sctx.font = 'bold 20px system-ui, sans-serif';
  sctx.fillText(snap.activeHives === 0 ? '🕯️ ALERTA: COLÔNIAS EXTINTAS!' : '🐝 Colmeias & Mel Natural', 36, 250);

  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 28px system-ui, sans-serif';
  sctx.fillText(`Ativas: ${snap.activeHives}   •   Abelhas: ${snap.totalBees}`, 36, 294);
  sctx.fillStyle = '#cbd5e1';
  sctx.font = '17px system-ui, sans-serif';
  sctx.fillText(
    `Rainhas: ${snap.queens} | Operárias: ${snap.workers} | Mel Médio: ${snap.avgHoneyPct}%`,
    36, 326
  );
  if (snap.restingOnGroundHives > 0 || snap.extinctHives > 0) {
    sctx.fillStyle = '#fb7185';
    sctx.font = 'bold 15px system-ui, sans-serif';
    sctx.fillText(
      `No chão (sem flores): ${snap.restingOnGroundHives} • Extintas: ${snap.extinctHives}`,
      36, 349
    );
  }
}

function drawCenterMonitor(sctx, w, h, snap) {
  sctx.fillStyle = '#061512';
  sctx.fillRect(0, 0, w, h);

  sctx.fillStyle = '#0b3026';
  sctx.fillRect(0, 0, w, 54);
  sctx.fillStyle = '#34d399';
  sctx.font = 'bold 23px system-ui, sans-serif';
  sctx.textAlign = 'left';
  sctx.fillText('🌿 TELEMETRIA FAUNA & FLORA — SERVIDOR AO VIVO', 18, 36);

  const cards = [
    { title: '🌸 FLORES', val: snap.totalFlowers, sub: `${snap.bloomingFlowers} c/ pólen`, col: '#22c55e' },
    { title: '🐝 ABELHAS', val: snap.totalBees, sub: `${snap.activeHives} colmeias ativas`, col: '#facc15' },
    { title: '🐄 VAQUINHAS', val: snap.cowsCount, sub: `Saúde ${snap.avgCowHealthPct}%`, col: '#38bdf8' },
    { title: '🍄 SILVESTRES', val: snap.wildMushroomsCount, sub: 'Ativos no pasto/mata', col: '#c084fc' }
  ];
  for (let i = 0; i < cards.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 20 + col * 240;
    const cy = 70 + row * 124;
    const c = cards[i];
    drawRoundedPanel(sctx, cx, cy, 228, 110, 12, '#0a201b', c.col);
    sctx.fillStyle = c.col;
    sctx.font = 'bold 17px system-ui, sans-serif';
    sctx.fillText(c.title, cx + 16, cy + 30);
    sctx.fillStyle = '#ffffff';
    sctx.font = 'bold 38px system-ui, sans-serif';
    sctx.fillText(String(c.val), cx + 16, cy + 74);
    sctx.fillStyle = '#cbd5e1';
    sctx.font = '14px system-ui, sans-serif';
    sctx.fillText(c.sub, cx + 16, cy + 98);
  }

  const modeStr = snap.isNight ? '🌙 Turno Noturno (Abelhas descansando)' : '☀️ Turno Diurno (Forrageio ativo)';
  drawRoundedPanel(sctx, 20, 322, 472, 42, 10, '#0c2922', '#10b981');
  sctx.fillStyle = '#a7f3d0';
  sctx.font = 'bold 16px system-ui, sans-serif';
  sctx.fillText(modeStr, 36, 349);
}

function drawRightRadarMonitor(sctx, w, h, snap, blinkPhase) {
  const gnomeActive = snap.gnome && snap.gnome.active;
  sctx.fillStyle = gnomeActive ? '#1b0714' : '#06111c';
  sctx.fillRect(0, 0, w, h);

  sctx.fillStyle = gnomeActive ? '#4c0519' : '#0c2238';
  sctx.fillRect(0, 0, w, 54);
  sctx.fillStyle = gnomeActive ? '#fda4af' : '#60a5fa';
  sctx.font = 'bold 22px system-ui, sans-serif';
  sctx.textAlign = 'left';
  sctx.fillText('📡 RADAR BIOLÓGICO & ANOMALIAS', 20, 36);

  // Mapa radar top-down (-85..85 -> box 24..274)
  const mapX = 24;
  const mapY = 68;
  const mapS = 210;
  drawRoundedPanel(sctx, mapX, mapY, mapS, mapS, 12, '#030b14', gnomeActive ? '#e11d48' : '#1d4ed8');

  const toRadarX = (wx) => mapX + Math.max(6, Math.min(mapS - 6, ((wx + 85) / 170) * mapS));
  const toRadarY = (wz) => mapY + Math.max(6, Math.min(mapS - 6, ((wz + 85) / 170) * mapS));

  // Grades do radar
  sctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  sctx.lineWidth = 1;
  sctx.beginPath();
  sctx.arc(mapX + mapS / 2, mapY + mapS / 2, mapS * 0.36, 0, Math.PI * 2);
  sctx.arc(mapX + mapS / 2, mapY + mapS / 2, mapS * 0.18, 0, Math.PI * 2);
  sctx.stroke();

  // Flores (pontos verdes)
  sctx.fillStyle = '#4ade80';
  for (let i = 0; i < snap.radar.flowers.length; i++) {
    const f = snap.radar.flowers[i];
    sctx.fillRect(toRadarX(f.x) - 1, toRadarY(f.z) - 1, 3, 3);
  }
  // Colmeias (amarelo ou vermelho se extinta)
  for (let i = 0; i < snap.radar.hives.length; i++) {
    const hv = snap.radar.hives[i];
    sctx.fillStyle = (hv.abandoned || hv.extinct) ? '#64748b' : '#facc15';
    sctx.beginPath();
    sctx.arc(toRadarX(hv.x), toRadarY(hv.z), 4.2, 0, Math.PI * 2);
    sctx.fill();
  }
  // Vaquinhas (pontos cianos/brancos)
  sctx.fillStyle = '#f8fafc';
  for (let i = 0; i < snap.radar.cows.length; i++) {
    const cw = snap.radar.cows[i];
    sctx.beginPath();
    sctx.arc(toRadarX(cw.x), toRadarY(cw.z), 3.2, 0, Math.PI * 2);
    sctx.fill();
  }
  // Estação Ecológica [50, 28]
  sctx.fillStyle = '#38bdf8';
  sctx.fillRect(toRadarX(STATION_CENTER_X) - 4, toRadarY(STATION_CENTER_Z) - 4, 8, 8);

  // Gnomo Preto Sombrio Solitário (anel pulsante roxo/vermelho)
  if (gnomeActive) {
    const gx = toRadarX(snap.gnome.x);
    const gz = toRadarY(snap.gnome.z);
    sctx.strokeStyle = blinkPhase ? '#f43f5e' : '#a855f7';
    sctx.lineWidth = 2.5;
    sctx.beginPath();
    sctx.arc(gx, gz, blinkPhase ? 12 : 8, 0, Math.PI * 2);
    sctx.stroke();
    sctx.fillStyle = '#09090b';
    sctx.beginPath();
    sctx.arc(gx, gz, 5, 0, Math.PI * 2);
    sctx.fill();
    sctx.fillStyle = '#f43f5e';
    sctx.fillRect(gx - 2, gz - 1, 2, 2);
    sctx.fillRect(gx + 1, gz - 1, 2, 2);
  }

  // Painel lateral de legenda & status de anomalia
  drawRoundedPanel(sctx, 248, 68, 244, 210, 12, '#081828', '#334155');
  sctx.fillStyle = '#e2e8f0';
  sctx.font = 'bold 16px system-ui, sans-serif';
  sctx.fillText('Legenda ao Vivo:', 264, 96);
  const leg = [
    { col: '#4ade80', txt: 'Flores Silvestres' },
    { col: '#facc15', txt: 'Colmeias Ativas' },
    { col: '#f8fafc', txt: 'Rebanho de Vaquinhas' },
    { col: '#38bdf8', txt: 'Estação Ecológica' },
    { col: '#f43f5e', txt: 'Gnomo Sombrio Raro' }
  ];
  for (let i = 0; i < leg.length; i++) {
    sctx.fillStyle = leg[i].col;
    sctx.fillRect(264, 114 + i * 26, 12, 12);
    sctx.fillStyle = '#cbd5e1';
    sctx.font = '14px system-ui, sans-serif';
    sctx.fillText(leg[i].txt, 284, 125 + i * 26);
  }
  sctx.fillStyle = snap.gnome?.lonelyTreeActive ? '#fcd34d' : '#94a3b8';
  sctx.font = '13px system-ui, sans-serif';
  sctx.fillText(
    snap.gnome?.lonelyTreeActive ? '🌲 Gnomo das Árvores ativo na mata' : '🌲 Sem atividade na mata alta',
    262, 260
  );

  // Banner de Aviso Inferior
  if (gnomeActive) {
    drawRoundedPanel(
      sctx, 20, 290, 472, 74, 12,
      blinkPhase ? '#7f1d1d' : '#4c1d95',
      blinkPhase ? '#fb7185' : '#c084fc'
    );
    sctx.fillStyle = '#ffffff';
    sctx.font = 'bold 19px system-ui, sans-serif';
    sctx.fillText('⚠️ GNOMO PRETO SOLITÁRIO DETECTADO!', 36, 320);
    sctx.fillStyle = '#fde68a';
    sctx.font = 'bold 15px system-ui, sans-serif';
    sctx.fillText(
      `Setor: ${snap.gnome.sector} (${snap.gnome.distToStation ?? '?'}m da Estação)`,
      36, 348
    );
  } else {
    drawRoundedPanel(sctx, 20, 290, 472, 74, 12, '#08271d', '#22c55e');
    sctx.fillStyle = '#4ade80';
    sctx.font = 'bold 19px system-ui, sans-serif';
    sctx.fillText('✅ PERÍMETRO NORMAL • SEM ANOMALIAS', 36, 322);
    sctx.fillStyle = '#cbd5e1';
    sctx.font = '14px system-ui, sans-serif';
    sctx.fillText('Sensores escaneando aparições raras de gnomo sombrio...', 36, 348);
  }
}

export function buildEcologyMonitoringStation(ctx, dx = STATION_CENTER_X, dz = STATION_CENTER_Z) {
  if (!THREE || !ctx || !ctx.scene) return null;
  const scene = ctx.scene;
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.5 });
  const deskWoodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 });
  const deskSteelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 });
  const pcCaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.45 });
  const pcKeyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const screenGlowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.55 });
  const ledStripMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });

  // 1. Fachada Sul: Letreiro iluminado voltado para a estrada (+Z)
  const signC = document.createElement('canvas');
  signC.width = 512;
  signC.height = 128;
  const signCtx = signC.getContext('2d');
  signCtx.fillStyle = '#071a15';
  signCtx.fillRect(0, 0, 512, 128);
  signCtx.strokeStyle = '#34d399';
  signCtx.lineWidth = 8;
  signCtx.strokeRect(6, 6, 500, 116);
  signCtx.fillStyle = '#6ee7b7';
  signCtx.textAlign = 'center';
  signCtx.font = 'bold 31px system-ui, sans-serif';
  signCtx.fillText('🌿 ESTAÇÃO FAUNA & FLORA', 256, 54);
  signCtx.fillStyle = '#38bdf8';
  signCtx.font = 'bold 21px system-ui, sans-serif';
  signCtx.fillText('MONITORAMENTO ECOLÓGICO DO CAMPUS', 256, 94);
  const signTex = new THREE.CanvasTexture(signC);
  if (THREE.SRGBColorSpace) signTex.colorSpace = THREE.SRGBColorSpace;
  const signBoard = makeBox(4.8, 1.15, 0.14, frameMat);
  signBoard.position.set(dx + 1.8, 3.25, dz + 5.20);
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.0),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signFace.position.set(dx + 1.8, 3.25, dz + 5.28);
  group.add(signBoard, signFace);

  // Vasinhos decorativos na porta (x = dx - 4.0)
  [dx - 5.55, dx - 2.45].forEach((pxSpot) => {
    const pot = makeBox(0.55, 0.42, 0.55, deskWoodMat);
    pot.position.set(pxSpot, 0.21, dz + 5.55);
    const shrub = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.78, flatShading: true })
    );
    shrub.position.set(pxSpot, 0.58, dz + 5.55);
    group.add(pot, shrub);
  });

  // 2. Radar giratório no telhado (roof top ~ y = 5.60) + Farol de Alerta
  const radarPivot = new THREE.Group();
  radarPivot.position.set(dx + 2.2, 5.62, dz - 0.5);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 1.15, 8), deskSteelMat);
  mast.position.y = 0.55;
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.22, 0.42, 10),
    dishMat
  );
  dish.position.set(0, 1.18, 0.18);
  dish.rotation.x = Math.PI * 0.34;
  radarPivot.add(mast, dish);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 0.9,
    roughness: 0.2
  });
  const beaconOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), beaconMat);
  beaconOrb.position.set(dx - 4.0, 5.95, dz + 4.4);
  const beaconPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8), deskSteelMat);
  beaconPole.position.set(dx - 4.0, 5.68, dz + 4.4);
  group.add(radarPivot, beaconPole, beaconOrb);

  // Iluminação LED interna no teto + ponto de luz
  [-3.8, 0, 3.8].forEach((lx) => {
    const strip = makeBox(2.4, 0.08, 0.26, ledStripMat, { noShadow: true });
    strip.position.set(dx + lx, 5.05, dz);
    group.add(strip);
  });

  // 3. 3 Telões gigantes na parede norte (dz - 4.55 = 23.45)
  const screens = [];
  const screenSpecs = [
    { x: dx - 4.05, draw: drawLeftMonitor },
    { x: dx, draw: drawCenterMonitor },
    { x: dx + 4.05, draw: drawRightRadarMonitor }
  ];
  for (let si = 0; si < screenSpecs.length; si++) {
    const sp = screenSpecs[si];
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 384;
    const sctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const bezel = makeBox(3.65, 2.55, 0.12, frameMat);
    bezel.position.set(sp.x, 2.75, dz - 4.62);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(3.45, 2.38),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    panel.position.set(sp.x, 2.75, dz - 4.55);
    group.add(bezel, panel);
    screens.push({ canvas: c, ctx: sctx, tex, draw: sp.draw });
  }

  // 4. Bancada Central dos Operadores + 3 Computadores + Cadeiras (z = dz - 1.5 = 26.5)
  const deskZ = dz - 1.5;
  const deskTop = makeBox(5.8, 0.10, 1.05, deskWoodMat);
  deskTop.position.set(dx, FLOOR_TOP_Y + 0.74, deskZ);
  group.add(deskTop);
  [-2.6, 2.6].forEach((lx) => {
    [-0.4, 0.4].forEach((lz) => {
      const leg = makeBox(0.10, 0.72, 0.10, deskSteelMat);
      leg.position.set(dx + lx, FLOOR_TOP_Y + 0.36, deskZ + lz);
      group.add(leg);
    });
  });
  registerStationSurface(ctx, deskTop, dx, deskZ, 5.8, 1.05, FLOOR_TOP_Y + 0.79, FLOOR_TOP_Y);

  [-1.95, 0, 1.95].forEach((ox, idx) => {
    const pcX = dx + ox;
    const monitorStand = makeBox(0.10, 0.18, 0.10, deskSteelMat);
    monitorStand.position.set(pcX, FLOOR_TOP_Y + 0.88, deskZ - 0.22);
    const monitor = makeBox(0.78, 0.48, 0.05, frameMat);
    monitor.position.set(pcX, FLOOR_TOP_Y + 1.12, deskZ - 0.22);
    const monitorFace = makeBox(0.70, 0.40, 0.02, screenGlowMat, { noShadow: true });
    monitorFace.position.set(pcX, FLOOR_TOP_Y + 1.12, deskZ - 0.19);
    const tower = makeBox(0.22, 0.44, 0.44, pcCaseMat);
    tower.position.set(pcX + 0.56, FLOOR_TOP_Y + 1.01, deskZ - 0.12);
    const keyboard = makeBox(0.42, 0.025, 0.16, pcKeyMat, { noShadow: true });
    keyboard.position.set(pcX - 0.06, FLOOR_TOP_Y + 0.80, deskZ + 0.16);
    const mouse = makeBox(0.08, 0.025, 0.12, pcKeyMat, { noShadow: true });
    mouse.position.set(pcX + 0.24, FLOOR_TOP_Y + 0.80, deskZ + 0.16);

    // Cadeira giratória dos operadores (z = deskZ + 0.88)
    const seatBase = makeBox(0.10, 0.42, 0.10, deskSteelMat);
    seatBase.position.set(pcX, FLOOR_TOP_Y + 0.21, deskZ + 0.88);
    const seat = makeBox(0.50, 0.08, 0.48, pcCaseMat);
    seat.position.set(pcX, FLOOR_TOP_Y + 0.44, deskZ + 0.88);
    const seatBack = makeBox(0.48, 0.52, 0.08, pcCaseMat);
    seatBack.position.set(pcX, FLOOR_TOP_Y + 0.72, deskZ + 1.10);
    seatBack.rotation.y = (idx - 1) * 0.05;
    group.add(monitorStand, monitor, monitorFace, tower, keyboard, mouse, seatBase, seat, seatBack);
  });

  // 5. Bancada Leste de Amostras Botânicas (x = dx + 4.8, z = dz + 1.2)
  const labBenchX = dx + 4.8;
  const labBenchZ = dz + 1.2;
  const labBench = makeBox(1.25, 0.10, 3.2, deskWoodMat);
  labBench.position.set(labBenchX, FLOOR_TOP_Y + 0.74, labBenchZ);
  group.add(labBench);
  [-0.5, 0.5].forEach((lx) => {
    [-1.4, 1.4].forEach((lz) => {
      const leg = makeBox(0.10, 0.72, 0.10, deskSteelMat);
      leg.position.set(labBenchX + lx, FLOOR_TOP_Y + 0.36, labBenchZ + lz);
      group.add(leg);
    });
  });
  registerStationSurface(ctx, labBench, labBenchX, labBenchZ, 1.25, 3.2, FLOOR_TOP_Y + 0.79, FLOOR_TOP_Y);

  // Vasos com amostras botânicas sobre a extremidade sul da bancada leste
  const potMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
  const petalCols = [0xf472b6, 0xfacc15];
  [labBenchZ - 1.1, labBenchZ - 0.55].forEach((pzSpot, i) => {
    const vPot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.16, 8), potMat);
    vPot.position.set(labBenchX + 0.3, FLOOR_TOP_Y + 0.87, pzSpot);
    const vStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.20, 6),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 })
    );
    vStem.position.set(labBenchX + 0.3, FLOOR_TOP_Y + 1.02, pzSpot);
    const vBloom = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({ color: petalCols[i], roughness: 0.5, flatShading: true })
    );
    vBloom.position.set(labBenchX + 0.3, FLOOR_TOP_Y + 1.13, pzSpot);
    group.add(vPot, vStem, vBloom);
  });

  scene.add(group);

  stationState = {
    dx,
    dz,
    group,
    radarPivot,
    beaconOrb,
    beaconMat,
    screens,
    updateAccum: 1.0,
    blinkTimer: 0
  };

  // Desenho inicial das telas
  const snap = collectEcologyTelemetrySnapshot(ctx);
  for (let i = 0; i < screens.length; i++) {
    screens[i].draw(screens[i].ctx, screens[i].canvas.width, screens[i].canvas.height, snap, false);
    screens[i].tex.needsUpdate = true;
  }
  return stationState;
}

export function stepEcologyMonitoringStation(ctx, dt) {
  if (!stationState || !ctx) return;
  const px = ctx.playerPos ? ctx.playerPos.x : 0;
  const pz = ctx.playerPos ? ctx.playerPos.z : 0;
  const dist = Math.hypot(px - stationState.dx, pz - stationState.dz);

  // Radar giratório & beacon de alerta quando visível
  if (dist <= 95 && stationState.radarPivot) {
    stationState.radarPivot.rotation.y += dt * 0.75;
  }

  stationState.updateAccum += dt;
  stationState.blinkTimer += dt;
  const refreshRate = dist <= 22 ? 0.85 : 3.5;
  if (stationState.updateAccum < refreshRate) return;
  stationState.updateAccum = 0;

  const snap = collectEcologyTelemetrySnapshot(ctx);
  const blinkPhase = Math.floor(stationState.blinkTimer * 2) % 2 === 0;
  const hasGnomeAlert = !!(snap.gnome && snap.gnome.active);
  const hasExtinction = snap.activeHives === 0 && snap.extinctHives > 0;

  if (stationState.beaconMat) {
    if (hasGnomeAlert) {
      stationState.beaconMat.color.setHex(blinkPhase ? 0xf43f5e : 0xa855f7);
      stationState.beaconMat.emissive.setHex(blinkPhase ? 0xf43f5e : 0xa855f7);
      stationState.beaconMat.emissiveIntensity = blinkPhase ? 1.6 : 0.9;
    } else if (hasExtinction) {
      stationState.beaconMat.color.setHex(0xf59e0b);
      stationState.beaconMat.emissive.setHex(0xf59e0b);
      stationState.beaconMat.emissiveIntensity = blinkPhase ? 1.4 : 0.4;
    } else {
      stationState.beaconMat.color.setHex(0x22c55e);
      stationState.beaconMat.emissive.setHex(0x22c55e);
      stationState.beaconMat.emissiveIntensity = 0.85;
    }
  }

  if (dist <= 24) {
    for (let i = 0; i < stationState.screens.length; i++) {
      const sc = stationState.screens[i];
      sc.draw(sc.ctx, sc.canvas.width, sc.canvas.height, snap, blinkPhase);
      sc.tex.needsUpdate = true;
    }
  }
}
