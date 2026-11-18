/**
 * Panela de Pressao 20L (Autoclave), Fogareiro Eletrico Multi-Nivel e Simulacao Termica (MycoCampus3D)
 */

import { GAME_CONFIG } from '../core/config.js';
import { makeBox } from '../engine/textures.js';
import { registerPickable, updateItemBounds, isSurfaceOccupied } from './item-registry.js';
import { isPdaRecipeBalanced, updatePdaMediumVisual } from './pda-mix.js';
import { contaminatePetri, sterilizePetri } from './petri-dish.js';

const THREE = window.THREE;
const LAB = GAME_CONFIG.lab;

export const PRESSURE_COOKER_META = {
  category: 'sterilization',
  purpose: 'Ferver, pasteurizar (80°C) ou esterilizar (121°C / 15 PSI) com água e base perfurada',
  weightGrams: 5200,
  baseTempC: 25.0,
  maxContents: 6,
  maxVolumeMl: 20000,
  compatibilities: {
    canEnterCooker: false,
    acceptsContents: true,
    heatsOnBurner: true,
    fillsFromSink: true,
    receivesWater: true
  },
  connections: ['electric_burner', 'gas_tripod', 'cooker_base', 'lab_sink', 'distilled_jug', 'spawn_jar', 'spawn_bag', 'liquid_culture']
};

export const PRESSURE_LID_META = {
  category: 'sterilization',
  purpose: 'Vedação com válvula de segurança e trava de pressão (>= 1.5 PSI)',
  weightGrams: 1100,
  baseTempC: 25.0,
  compatibilities: { canEnterCooker: false, snapsToCookerPot: true },
  connections: ['pressure_cooker']
};

export const ELECTRIC_BURNER_META = {
  category: 'heating',
  purpose: 'Fogareiro elétrico com 3 níveis de potência (Baixo / Médio / Alto)',
  weightGrams: 3400,
  baseTempC: 24.0,
  compatibilities: { canEnterCooker: false, heatsCookerOnSurface: true },
  connections: ['pressure_cooker']
};

export const BURNER_LEVEL_NAMES = ['Desligado', 'Fogo Baixo', 'Fogo Médio', 'Fogo Alto'];
export const BURNER_TIMER_PRESETS = [0, 20, 60, 90, 120];
export const BURNER_GAME_MIN_SECONDS = 3;

export function formatBurnerTimerLabel(min) {
  if (!min) return 'Livre';
  if (min === 20) return '20m';
  if (min === 60) return '1h';
  if (min === 90) return '1h30';
  if (min === 120) return '2h';
  return min + 'm';
}

export function drawBurnerTimerDisplay(burner) {
  if (!burner || !burner.timerCtx || !burner.timerTex) return;
  const ctx2d = burner.timerCtx;
  ctx2d.clearRect(0, 0, 256, 64);
  ctx2d.fillStyle = '#040914';
  ctx2d.fillRect(0, 0, 256, 64);
  ctx2d.strokeStyle = burner.on ? '#22c55e' : '#38bdf8';
  ctx2d.lineWidth = 4;
  ctx2d.strokeRect(2, 2, 252, 60);

  let rightTxt = '--:--';
  if (burner.timerPresetMin > 0) {
    const remMinTotal = Math.max(0, Math.ceil((burner.timerRemainingSec || 0) / BURNER_GAME_MIN_SECONDS));
    const hh = Math.floor(remMinTotal / 60);
    const mm = remMinTotal % 60;
    rightTxt = (hh > 0 ? hh + 'h' : '') + String(mm).padStart(2, '0') + 'm';
  } else {
    rightTxt = 'LIVRE';
  }
  const lvlTxt = burner.on ? ('N' + (burner.level || 1)) : 'OFF';
  ctx2d.fillStyle = burner.on ? '#4ade80' : '#7dd3fc';
  ctx2d.font = 'bold 28px monospace';
  ctx2d.textAlign = 'left';
  ctx2d.textBaseline = 'middle';
  ctx2d.fillText(lvlTxt, 14, 33);
  ctx2d.textAlign = 'right';
  ctx2d.fillStyle = burner.timerPresetMin > 0 && burner.on ? '#fde047' : '#e2e8f0';
  ctx2d.fillText(rightTxt, 242, 33);
  burner.timerTex.needsUpdate = true;
}

export function cycleBurnerTimer(burner) {
  if (!burner) return 0;
  const curIdx = BURNER_TIMER_PRESETS.indexOf(burner.timerPresetMin || 0);
  const nextMin = BURNER_TIMER_PRESETS[(curIdx + 1) % BURNER_TIMER_PRESETS.length];
  burner.timerPresetMin = nextMin;
  burner.timerRemainingSec = nextMin * BURNER_GAME_MIN_SECONDS;
  drawBurnerTimerDisplay(burner);
  return nextMin;
}

function createSteamEmitter(parent, startY) {
  const count = 24;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.04;
    positions[i * 3 + 1] = startY + Math.random() * 0.35;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
  }
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', attribute);
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.06, transparent: true, opacity: 0.65 })
  );
  points.visible = false;
  points.userData.ignoreRay = true;
  parent.add(points);
  return { points, attribute, startY, endY: startY + 0.43 };
}

function stepSteamEmitter(emitter, dt, steamFactor) {
  if (!emitter || steamFactor <= 0.02) {
    if (emitter) emitter.points.visible = false;
    return;
  }
  emitter.points.visible = true;
  const positions = emitter.attribute.array;
  const riseSpeed = 0.35 + steamFactor * 0.45;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += dt * riseSpeed;
    if (positions[i + 1] > emitter.endY) {
      positions[i] = (Math.random() - 0.5) * 0.04;
      positions[i + 1] = emitter.startY;
      positions[i + 2] = (Math.random() - 0.5) * 0.04;
    }
  }
  emitter.attribute.needsUpdate = true;
}

export function createPressureCookerPair(ctx, potId, lidId, labelSuffix, px, py, pz) {
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.20 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.2 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });

  const potGroup = new THREE.Group();
  const potWallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.20, side: THREE.DoubleSide });
  const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.23, 0.36, 22, 1, true), potWallMat);
  potBody.position.y = 0.18; potBody.castShadow = true;
  const potBase = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.03, 22), darkMat);
  potBase.position.y = 0.015;
  const potBottomIn = new THREE.Mesh(new THREE.CircleGeometry(0.22, 22), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 }));
  potBottomIn.rotation.x = -Math.PI / 2; potBottomIn.position.y = 0.034;
  const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.242, 0.018, 10, 24), steelMat);
  potRim.rotation.x = Math.PI / 2; potRim.position.y = 0.36;

  // Nivel visivel de agua dentro da panela aberta
  const waterMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.218, 0.214, 0.28, 20),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, roughness: 0.1 })
  );
  waterMesh.position.y = 0.04;
  waterMesh.userData.ignoreRay = true;

  [-1, 1].forEach(function (side) {
    const hdl = makeBox(0.09, 0.065, 0.11, darkMat, { noShadow: true });
    hdl.position.set(side * 0.275, 0.29, 0);
    potGroup.add(hdl);
  });
  potGroup.add(potBody, potBase, potBottomIn, potRim, waterMesh);
  potGroup.userData.twoHanded = true;

  const potMeta = Object.assign({}, PRESSURE_COOKER_META, {
    getWeightGrams: function () {
      return 5200 + (cpState ? Math.round(cpState.waterMl) : 0);
    }
  });
  const potItem = registerPickable(ctx, potId, 'Panela de Pressão 20L (' + labelSuffix + ')', potGroup, px, py, pz, 0, 0.30, 0.42, potMeta);

  const lidGroup = new THREE.Group();
  const lidRim = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.256, 0.045, 22), steelMat);
  lidRim.position.y = 0.022;
  const lidDome = new THREE.Mesh(new THREE.SphereGeometry(0.242, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), steelMat);
  lidDome.scale.set(1, 0.36, 1); lidDome.position.y = 0.025;
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.055, 12), darkMat);
  weight.position.y = 0.13;
  const weightTop = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 12), redMat);
  weightTop.position.y = 0.16;
  const safetyPins = [];
  [-0.12, 0.12].forEach(function (vz) {
    const vRing = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.015, 10), darkMat);
    vRing.position.set(0, 0.105, vz);
    const vPin = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.022, 10), redMat);
    vPin.position.set(0, 0.110, vz);
    safetyPins.push(vPin);
    lidGroup.add(vRing, vPin);
  });
  [-1, 1].forEach(function (side) {
    const clasp = makeBox(0.085, 0.045, 0.10, darkMat, { noShadow: true });
    clasp.position.set(side * 0.27, 0.025, 0);
    lidGroup.add(clasp);
  });
  lidGroup.add(lidRim, lidDome, weight, weightTop);

  const grainMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.195, 0.195, 0.24, 24),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.72, metalness: 0.05 })
  );
  grainMesh.position.y = 0.08;
  grainMesh.visible = false;
  potGroup.add(grainMesh);

  const valveSteam = createSteamEmitter(lidGroup, 0.17);
  const openPotSteam = createSteamEmitter(potGroup, 0.37);

  const lidItem = registerPickable(ctx, lidId, 'Tampa da Panela (' + labelSuffix + ')', lidGroup, px, py + 0.36, pz, 0, 0.26, 0.16, PRESSURE_LID_META);
  lidItem.potItem = potItem;
  lidItem.isAttached = true;
  potItem.lidItem = lidItem;

  const pCanvas = document.createElement('canvas');
  pCanvas.width = 360; pCanvas.height = 128;
  const pCtx = pCanvas.getContext('2d');
  const pTex = new THREE.CanvasTexture(pCanvas);
  pTex.generateMipmaps = false;
  pTex.minFilter = THREE.LinearFilter;
  const pSpriteMat = new THREE.SpriteMaterial({ map: pTex, transparent: true, depthTest: false });
  const pSprite = new THREE.Sprite(pSpriteMat);
  pSprite.scale.set(1.05, 0.37, 1);
  pSprite.position.set(0, 0.80, 0);
  pSprite.visible = false;
  pSprite.userData.ignoreRay = true;
  potGroup.add(pSprite);

  var cpState = {
    potItem,
    lidItem,
    weight,
    weightTop,
    safetyPins,
    waterMesh,
    grainMesh,
    grainGrams: 0,
    grainCookSec: 0,
    grainAlDente: false,
    steamPoints: valveSteam.points,
    valveSteam,
    openPotSteam,
    contents: [],
    hasBase: false,
    waterMl: 3400,
    maxWaterMl: 20000,
    mode: 'sterilize', // 'sterilize' | 'pasteurize'
    statusSprite: pSprite,
    statusCtx: pCtx,
    statusTex: pTex,
    lastHudKey: '',
    psi: 0,
    temp: 25,
    progress: 0,
    sterilized: false,
    overheatTimer: 0,
    burned: false
  };
  updateCookerWaterVisual(cpState);
  potItem.cookerRef = cpState;
  ctx.cookerPots.push(cpState);
  return cpState;
}

export function updateCookerWaterVisual(cp) {
  if (!cp || !cp.waterMesh) return;
  const frac = Math.max(0, Math.min(1, cp.waterMl / cp.maxWaterMl));
  if (cp.waterMl <= 15) {
    cp.waterMesh.visible = false;
  } else {
    cp.waterMesh.visible = true;
    const visFrac = Math.max(0.03, frac);
    cp.waterMesh.scale.y = visFrac;
    cp.waterMesh.position.y = 0.035 + (0.28 * visFrac) * 0.5;
  }
  if (cp.grainMesh) {
    if ((cp.grainGrams || 0) <= 0) {
      cp.grainMesh.visible = false;
    } else {
      cp.grainMesh.visible = true;
      const gFrac = Math.max(0.08, Math.min(1, (cp.grainGrams || 0) / 4000));
      cp.grainMesh.scale.y = gFrac;
      cp.grainMesh.position.y = 0.032 + (0.24 * gFrac) * 0.5;
      cp.grainMesh.material.color.setHex(cp.grainAlDente ? 0xfef08a : 0xfacc15);
    }
  }
}

export function makeElectricBurner(ctx, id, px, py, pz) {
  const bg = new THREE.Group();
  const footGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.012, 10);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
  [[-0.22, -0.24], [0.22, -0.24], [-0.22, 0.24], [0.22, 0.24]].forEach(function (fp) {
    const ft = new THREE.Mesh(footGeo, footMat);
    ft.position.set(fp[0], 0.006, fp[1]);
    bg.add(ft);
  });

  const body = makeBox(0.54, 0.068, 0.58, 0x0f172a, { metalness: 0.55, roughness: 0.22 });
  body.position.y = 0.044;
  bg.add(body);

  const reflectorMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe, emissive: 0xff4500, emissiveIntensity: 0, metalness: 0.88, roughness: 0.2
  });
  const reflector = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.185, 0.012, 28), reflectorMat);
  reflector.position.set(0, 0.077, -0.02);
  bg.add(reflector);

  const crossMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.008, 0.014), crossMat);
  cross1.position.set(0, 0.081, -0.02);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.38), crossMat);
  cross2.position.set(0, 0.081, -0.02);
  bg.add(cross1, cross2);

  const coilMat = new THREE.MeshStandardMaterial({
    color: 0x64748b, emissive: 0xff2a00, emissiveIntensity: 0.0, metalness: 0.55, roughness: 0.35
  });
  const coilGroup = new THREE.Group();
  coilGroup.position.set(0, 0.084, -0.02);
  [0.165, 0.112, 0.060].forEach(function (r) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 10, 28), coilMat);
    ring.rotation.x = Math.PI / 2;
    coilGroup.add(ring);
  });
  bg.add(coilGroup);

  const coilHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.205, 0.205, 0.012, 22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  coilHit.position.set(0, 0.082, -0.02);
  bg.add(coilHit);

  const knobGroup = new THREE.Group();
  knobGroup.position.set(0.14, 0.044, 0.296);
  const knobBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.035, 0.028, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 })
  );
  knobBase.rotation.x = Math.PI / 2;
  const knobPointer = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.024, 0.006), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
  knobPointer.position.set(0, 0.012, 0.014);
  knobGroup.add(knobBase, knobPointer);
  bg.add(knobGroup);

  const ledBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.85, roughness: 0.2 })
  );
  ledBezel.rotation.x = Math.PI / 2;
  ledBezel.position.set(-0.14, 0.044, 0.292);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 12), ledMat);
  led.position.set(-0.14, 0.044, 0.296);
  bg.add(ledBezel, led);

  const warn = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.002, 3), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  warn.rotation.y = Math.PI;
  warn.position.set(0.21, 0.079, 0.21);
  bg.add(warn);

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8 }));
  cord.rotation.x = Math.PI / 2;
  cord.position.set(0.12, 0.032, -0.35);
  bg.add(cord);

  const bSurf = { minX: px - 0.26, maxX: px + 0.26, minZ: pz - 0.28, maxZ: pz + 0.24, topY: py + 0.088 };
  ctx.supportSurfaces.push(bSurf);
  body.userData.supportSurface = bSurf;
  coilHit.userData.supportSurface = bSurf;
  ctx.supportMeshes.push(body, coilHit);
  bg.userData.isBurner = true;
  bg.userData.tableDims = { w: 0.54, h: 0.088, d: 0.58, surfOffset: 0 };
  bg.userData.dynamicSurface = bSurf;
  bg.userData.updateBounds = updateItemBounds;
  bg.userData.isBlockedPickup = function (it) { return isSurfaceOccupied(ctx, bSurf, it); };

  const tCanvas = document.createElement('canvas');
  tCanvas.width = 256; tCanvas.height = 64;
  const tCtx = tCanvas.getContext('2d');
  const tTex = new THREE.CanvasTexture(tCanvas);
  tTex.generateMipmaps = false;
  tTex.minFilter = THREE.LinearFilter;
  const timerScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.042),
    new THREE.MeshBasicMaterial({ map: tTex })
  );
  timerScreen.position.set(0, 0.044, 0.292);
  bg.add(timerScreen);

  const bState = {
    id, kind: 'electric', on: false, level: 0, heat: 0,
    coilMat, reflectorMat, ledMat, knobGroup, surface: bSurf,
    timerPresetMin: 0, timerRemainingSec: 0, timerCtx: tCtx, timerTex: tTex, timerDrawAcc: 0
  };
  drawBurnerTimerDisplay(bState);
  const bIdx = ctx.burnerDevices.length;
  knobBase.userData.burnerSwitchIdx = bIdx;
  knobPointer.userData.burnerSwitchIdx = bIdx;
  timerScreen.userData.burnerTimerIdx = bIdx;
  ctx.burnerSwitchMeshes.push(knobBase, knobPointer, timerScreen);
  ctx.burnerDevices.push(bState);
  return registerPickable(ctx, id, 'Fogareiro Elétrico (Autoclave)', bg, px, py, pz, 0, 0.32, 0.12, ELECTRIC_BURNER_META);
}

export function setBurnerLevel(burner, level) {
  if (!burner) return;
  const lvl = Math.max(0, Math.min(3, level | 0));
  burner.level = lvl;
  burner.on = lvl > 0;
  if (burner.ledMat) {
    burner.ledMat.color.setHex(lvl === 0 ? 0xef4444 : (lvl === 1 ? 0x38bdf8 : (lvl === 2 ? 0xf59e0b : 0x22c55e)));
  }
  if (burner.kind === 'gas_tripod') {
    if (burner.knob1) {
      // Registro 1 (anel interno de caulim): abre em Fogo Baixo e permanece aberto em Médio/Alto
      burner.knob1.rotation.x = lvl >= 1 ? (lvl === 1 ? 0.6 : 1.2) : 0;
    }
    if (burner.knob2) {
      // Registro 2 (anel externo de caulim): só abre a partir de Fogo Médio (lvl 2) e Alto (lvl 3)
      burner.knob2.rotation.x = lvl >= 2 ? (lvl === 2 ? 0.6 : 1.2) : 0;
    }
  } else if (burner.knobGroup) {
    burner.knobGroup.rotation.z = -lvl * 0.65;
  }
  if (burner.kind === 'electric') {
    if (lvl > 0 && burner.timerPresetMin > 0 && (burner.timerRemainingSec || 0) <= 0) {
      burner.timerRemainingSec = burner.timerPresetMin * BURNER_GAME_MIN_SECONDS;
    }
    drawBurnerTimerDisplay(burner);
  }
}

export function stepPressureCookers(ctx, dt) {
  if (!ctx.cookerPots.length) return;

  let anyPotSteaming = false;
  for (let bni = 0; bni < ctx.burnerDevices.length; bni++) {
    const bnd = ctx.burnerDevices[bni];
    if (bnd.kind === 'electric' && bnd.on && bnd.timerPresetMin > 0) {
      bnd.timerRemainingSec = Math.max(0, (bnd.timerRemainingSec || 0) - dt);
      bnd.timerDrawAcc = (bnd.timerDrawAcc || 0) + dt;
      if (bnd.timerRemainingSec <= 0) {
        setBurnerLevel(bnd, 0);
        if (ctx.queueWorldStateChange) {
          const bId = bnd.id || 'burner_lab';
          ctx.queueWorldStateChange(bId, 0);
          ctx.queueWorldStateChange(bId === 'burner_lab' ? 'burner_level_lab' : `${bId}_level`, 0);
        }
        if (window.MycoAudio) window.MycoAudio.playSwitch();
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast('⏰ Timer do Fogareiro (' + formatBurnerTimerLabel(bnd.timerPresetMin) + ') concluído! Desligado automaticamente.');
        }
      } else if (bnd.timerDrawAcc >= 0.25) {
        bnd.timerDrawAcc = 0;
        drawBurnerTimerDisplay(bnd);
      }
    }
    const lvl = bnd.on ? (bnd.level || 0) : 0;
    const targetHeat = lvl === 0 ? 0 : (lvl === 1 ? 0.38 : (lvl === 2 ? 0.68 : 1.0));
    if (bnd.heat < targetHeat) {
      bnd.heat = Math.min(targetHeat, (bnd.heat || 0) + dt * 0.55);
    } else {
      bnd.heat = Math.max(targetHeat, (bnd.heat || 0) - dt * 0.30);
    }
    const h = bnd.heat;
    const pulse = h > 0.15 ? Math.sin(ctx.clock.elapsedTime * 5.0) * 0.08 * h : 0;

    if (bnd.kind === 'gas_tripod') {
      const flicker = lvl > 0 ? (Math.sin(ctx.clock.elapsedTime * 18.0) * 0.08 + Math.cos(ctx.clock.elapsedTime * 27.0) * 0.05) : 0;

      // 0 = DESLIGADO: Ambos os anéis de caulim apagados
      if (lvl === 0 || h <= 0.02) {
        if (bnd.innerFlamesGroup) bnd.innerFlamesGroup.visible = false;
        if (bnd.outerFlamesGroup) bnd.outerFlamesGroup.visible = false;
        if (bnd.flameLight) bnd.flameLight.intensity = 0;
      }
      // 1 = FOGO BAIXO: APENAS anel central (queimador pequeno) aceso nos 6 bicos de caulim! O anel externo fica 100% desligado!
      else if (lvl === 1) {
        if (bnd.innerFlamesGroup) {
          bnd.innerFlamesGroup.visible = true;
          const sc = Math.max(0.4, 0.70 + flicker * 0.4);
          bnd.innerFlamesGroup.scale.set(sc, sc * 0.82, sc);
        }
        if (bnd.outerFlamesGroup) {
          bnd.outerFlamesGroup.visible = false; // 100% apagado!
        }
        if (bnd.flameLight) {
          bnd.flameLight.intensity = 0.45 + flicker * 0.3;
          bnd.flameLight.distance = 2.2;
        }
      }
      // 2 = FOGO MÉDIO: Ambos os anéis (interno e externo) acesos em potência moderada!
      else if (lvl === 2) {
        if (bnd.innerFlamesGroup) {
          bnd.innerFlamesGroup.visible = true;
          const sc = Math.max(0.6, 0.95 + flicker * 0.5);
          bnd.innerFlamesGroup.scale.set(sc, sc, sc);
        }
        if (bnd.outerFlamesGroup) {
          bnd.outerFlamesGroup.visible = true;
          const scOut = Math.max(0.6, 0.90 + flicker * 0.5);
          bnd.outerFlamesGroup.scale.set(scOut, scOut, scOut);
        }
        if (bnd.flameLight) {
          bnd.flameLight.intensity = 1.05 + flicker * 0.7;
          bnd.flameLight.distance = 3.0;
        }
      }
      // 3 = FOGO ALTO: Ambos os anéis em potência máxima, chamas altas e vivas saindo de todos os bicos!
      else if (lvl === 3) {
        if (bnd.innerFlamesGroup) {
          bnd.innerFlamesGroup.visible = true;
          const sc = Math.max(0.8, 1.35 + flicker * 0.9);
          bnd.innerFlamesGroup.scale.set(sc, sc * 1.35, sc);
        }
        if (bnd.outerFlamesGroup) {
          bnd.outerFlamesGroup.visible = true;
          const scOut = Math.max(0.8, 1.30 + flicker * 0.85);
          bnd.outerFlamesGroup.scale.set(scOut, scOut * 1.30, scOut);
        }
        if (bnd.flameLight) {
          bnd.flameLight.intensity = 1.95 + flicker * 1.5;
          bnd.flameLight.distance = 3.8;
        }
      }
    } else {
      bnd.coilMat.emissiveIntensity = h * 2.2 + pulse;
      bnd.coilMat.color.setRGB(0.39 + h * 0.55, 0.45 - h * 0.30, 0.55 - h * 0.48);
      if (bnd.reflectorMat) bnd.reflectorMat.emissiveIntensity = h * 0.28;
    }
  }

  let nearestSteamDist = Infinity;
  let bestSteamFactor = 0;
  for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
    const cp = ctx.cookerPots[cpi];
    const potP = cp.potItem.mesh.position;

    // Verifica se possui base perfurada dentro
    cp.hasBase = cp.contents.some((it) => it && it.mesh && it.mesh.userData && it.mesh.userData.isCookerBase);

    let activeBurner = null;
    for (let bi = 0; bi < ctx.burnerDevices.length; bi++) {
      const bn = ctx.burnerDevices[bi];
      if (bn.on && potP.x >= bn.surface.minX && potP.x <= bn.surface.maxX && potP.z >= bn.surface.minZ && potP.z <= bn.surface.maxZ && Math.abs(potP.y - bn.surface.topY) < 0.09) {
        activeBurner = bn; break;
      }
    }

    const heatLvl = activeBurner ? (activeBurner.level > 0 ? activeBurner.level : 3) : 0;
    const hasWater = cp.waterMl > 5;
    const heatRate = heatLvl === 1 ? 2.8 : (heatLvl === 2 ? 4.8 : (heatLvl === 3 ? 7.5 : 0));

    // Evaporacao da agua conforme fogo & temperatura
    let evapRateMl = 0;
    if (activeBurner && hasWater && cp.temp >= 96) {
      const baseEvap = heatLvl === 1 ? 4.5 : (heatLvl === 2 ? 10.0 : 26.0);
      evapRateMl = cp.lidItem.isAttached ? baseEvap : baseEvap * 1.85;
      cp.waterMl = Math.max(0, cp.waterMl - evapRateMl * dt);
      updateCookerWaterVisual(cp);
    }

    if (activeBurner && !hasWater && !cp.burned) {
      cp.burned = true;
      cp.sterilized = false;
      cp.contents.forEach((bIt) => {
        if (bIt.spawnCtrl) { bIt.spawnCtrl.burned = true; bIt.spawnCtrl.sterilized = false; bIt.spawnCtrl.updateVisual(); }
        if (bIt.mesh.userData.petriCtrl && bIt.mesh.userData.petriCtrl.mode === 'filled') {
          contaminatePetri(bIt);
        }
        if (bIt.pdaMediumCtrl) {
          bIt.pdaMediumCtrl.burned = true;
          bIt.pdaMediumCtrl.sterilized = false;
          if (bIt.spawnCtrl && bIt.spawnCtrl.substrateKind === 'pda') {
            bIt.spawnCtrl.burned = true;
            bIt.spawnCtrl.sterilized = false;
            bIt.spawnCtrl.updateVisual();
          }
          updatePdaMediumVisual(bIt);
        }
      });
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast('🔥 A água da panela secou! Tudo queimou lá dentro :(');
      }
    }

    if (activeBurner && hasWater) {
      if (!cp.lidItem.isAttached) {
        // Fervura aberta a 100°C
        cp.temp = Math.min(100, cp.temp + dt * heatRate);
        cp.psi = Math.max(0, cp.psi - dt * 4.0);
        if ((cp.grainGrams || 0) > 0 && cp.temp >= 96 && !cp.burned) {
          cp.grainCookSec = (cp.grainCookSec || 0) + dt;
          if (!cp.grainAlDente && cp.grainCookSec >= 60) {
            cp.grainAlDente = true;
            updateCookerWaterVisual(cp);
            if (ctx.callbacks && ctx.callbacks.onToast) {
              ctx.callbacks.onToast('🌽 Milho de pipoca no ponto AO DENTE (20 min)! Escorra na pia e porcione nos potes/bags!');
            }
          }
        }
      } else if (cp.mode === 'pasteurize') {
        const targetPastTemp = heatLvl === 1 ? 76 : (heatLvl === 2 ? 84 : 96);
        if (cp.temp < targetPastTemp) cp.temp = Math.min(targetPastTemp, cp.temp + dt * heatRate);
        else cp.temp = Math.max(targetPastTemp, cp.temp - dt * 2.0);
        cp.psi = Math.max(0, cp.psi - dt * 2.0);
      } else {
        const targetTemp = heatLvl === 1 ? 108 : LAB.autoclaveTargetTempC;
        if (cp.temp < targetTemp) {
          cp.temp = Math.min(targetTemp, cp.temp + dt * heatRate);
        } else if (heatLvl >= 2 && cp.psi < LAB.autoclaveTargetPsi && cp.progress < 100) {
          cp.psi = Math.min(LAB.autoclaveTargetPsi, cp.psi + dt * (heatLvl === 3 ? 3.2 : 1.8));
        } else if (heatLvl === 1 && cp.psi > 6.0) {
          cp.psi = Math.max(6.0, cp.psi - dt * 0.8);
        }
      }
    } else {
      if (cp.psi > 0) {
        cp.psi = Math.max(0, cp.psi - dt * 2.2);
      } else {
        cp.temp = Math.max(25, cp.temp - dt * 9.5);
      }
      if (!cp.lidItem.isAttached) {
        cp.psi = 0;
        cp.overheatTimer = 0;
        if (cp.contents.length === 0) cp.burned = false;
        if (!cp.burned) cp.progress = 0;
      }
    }

    const isLocked = cp.lidItem.isAttached && cp.psi >= LAB.autoclaveLockPsi;
    if (cp.safetyPins) {
      const targetPinY = isLocked ? 0.128 : 0.110;
      for (let pni = 0; pni < cp.safetyPins.length; pni++) {
        cp.safetyPins[pni].position.y += (targetPinY - cp.safetyPins[pni].position.y) * Math.min(1, dt * 10);
      }
    }

    const openBoiling = !cp.lidItem.isAttached && cp.temp >= 98 && hasWater;
    const pressureSteamFactor = (cp.lidItem.isAttached && cp.psi >= 10.0)
      ? Math.min(1, (cp.psi - 10.0) / 5.0)
      : 0;
    const openSteamFactor = openBoiling ? 0.45 : 0;
    const steamFactor = Math.max(pressureSteamFactor, openSteamFactor);

    if (steamFactor > 0.02) {
      anyPotSteaming = true;
      const sDist = Math.hypot(potP.x - ctx.playerPos.x, potP.z - ctx.playerPos.z);
      if (sDist < nearestSteamDist) {
        nearestSteamDist = sDist;
        bestSteamFactor = steamFactor;
      }
      stepSteamEmitter(cp.valveSteam, dt, pressureSteamFactor);
      stepSteamEmitter(cp.openPotSteam, dt, openSteamFactor);
      if (pressureSteamFactor > 0.02) {
        const wobble = Math.sin(ctx.clock.elapsedTime * (20 + steamFactor * 20));
        const lift = Math.abs(wobble) * (0.008 * steamFactor);
        cp.weight.position.y = 0.13 + lift;
        cp.weightTop.position.y = 0.16 + lift;
        cp.weight.rotation.z = wobble * 0.10 * steamFactor;
        cp.weightTop.rotation.z = wobble * 0.10 * steamFactor;
      } else {
        cp.weight.position.y = 0.13;
        cp.weightTop.position.y = 0.16;
        cp.weight.rotation.z = 0;
        cp.weightTop.rotation.z = 0;
      }
    } else {
      stepSteamEmitter(cp.valveSteam, dt, 0);
      stepSteamEmitter(cp.openPotSteam, dt, 0);
      cp.weight.position.y = 0.13;
      cp.weightTop.position.y = 0.16;
      cp.weight.rotation.z = 0;
      cp.weightTop.rotation.z = 0;
    }

    const hasBase = cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
    cp.hasBase = hasBase;
    const hasContainers = cp.contents.some((it) => it && (!it.mesh || !it.mesh.userData.isCookerBase));
    const waterTooLow = cp.waterMl < 3000;
    const waterTooHigh = cp.waterMl > 4000;
    const waterLevelOk = !waterTooLow && !waterTooHigh;

    const canAdvanceProcess = activeBurner && hasWater && cp.lidItem.isAttached && !cp.burned &&
      (!hasContainers || (hasBase && waterLevelOk)) && (
        (cp.mode === 'sterilize' && cp.psi >= 14.2) ||
        (cp.mode === 'pasteurize' && cp.temp >= 74 && cp.temp <= 90)
      );

    const hasElectricTimer = !!(activeBurner && activeBurner.kind === 'electric' && activeBurner.timerPresetMin > 0);
    if (canAdvanceProcess) {
      if (cp.progress < 100) {
        const baseMin = cp.mode === 'pasteurize' ? 45 : 80;
        let maxMin = baseMin;
        for (let ci = 0; ci < cp.contents.length; ci++) {
          const cIt = cp.contents[ci];
          if (cIt && cIt.spawnCtrl && cIt.spawnCtrl.minSterilizeMin > maxMin) {
            maxMin = cIt.spawnCtrl.minSterilizeMin;
          }
        }
        // ~12s para 80m no modo Livre; com timer elétrico, acompanha o timer e termina pouco antes de desligar
        const baseRate = (680 / maxMin);
        let potRate = baseRate;
        if (hasElectricTimer) {
          const leadSec = Math.min(6, Math.max(2, activeBurner.timerPresetMin * BURNER_GAME_MIN_SECONDS * 0.08));
          const remTarget = Math.max(1.5, (activeBurner.timerRemainingSec || 0) - leadSec);
          potRate = Math.max(0.15, Math.min(25, (100 - cp.progress) / remTarget));
        }
        cp.progress = Math.min(100, cp.progress + dt * potRate);
        for (let ci = 0; ci < cp.contents.length; ci++) {
          const cIt = cp.contents[ci];
          if (cIt && cIt.spawnCtrl) {
            const itemMin = cIt.spawnCtrl.minSterilizeMin || 80;
            const itemRate = hasElectricTimer ? potRate * (maxMin / itemMin) : (680 / itemMin);
            cIt.spawnCtrl.sterilizeProgress = Math.min(100, (cIt.spawnCtrl.sterilizeProgress || 0) + dt * itemRate);
            if (cIt.spawnCtrl.sterilizeProgress >= 100) {
              cIt.spawnCtrl.sterilized = true;
            }
            cIt.spawnCtrl.updateVisual();
          }
          if (cIt && cIt.pdaMediumCtrl) {
            const medium = cIt.pdaMediumCtrl;
            const liquidCtrl = cIt.mesh && cIt.mesh.userData && cIt.mesh.userData.liquidCtrl;
            if (cp.mode === 'sterilize' && cp.progress >= 100 && medium.mixed && !medium.burned &&
              liquidCtrl && isPdaRecipeBalanced(medium, liquidCtrl.volMl)) {
              medium.sterilized = true;
              if (cIt.spawnCtrl && cIt.spawnCtrl.substrateKind === 'pda') {
                cIt.spawnCtrl.sterilized = true;
                cIt.spawnCtrl.sterilizeProgress = 100;
                cIt.spawnCtrl.updateVisual();
              }
              updatePdaMediumVisual(cIt);
            }
          }
          if (cIt && cIt.mesh.userData.petriCtrl && cIt.mesh.userData.petriCtrl.mode === 'filled' &&
            cp.mode === 'sterilize' && cp.progress >= 100) {
            sterilizePetri(cIt);
          }
        }
        if (cp.progress >= 100) {
          cp.sterilized = true;
          cp.overheatTimer = 0;
        }
      } else if (hasElectricTimer) {
        cp.overheatTimer = 0;
      } else {
        cp.overheatTimer += dt * (heatLvl === 3 ? 1.35 : (heatLvl === 2 ? 0.65 : 0.35));
        if (cp.overheatTimer >= LAB.autoclaveOverheatSec) {
          cp.burned = true;
          cp.sterilized = false;
          for (let bi2 = 0; bi2 < cp.contents.length; bi2++) {
            const bIt = cp.contents[bi2];
            if (bIt.spawnCtrl) {
              bIt.spawnCtrl.burned = true;
              bIt.spawnCtrl.sterilized = false;
              bIt.spawnCtrl.updateVisual();
            }
            if (bIt.mesh.userData.petriCtrl && bIt.mesh.userData.petriCtrl.mode === 'filled') {
              contaminatePetri(bIt);
            }
            if (bIt.pdaMediumCtrl) {
              bIt.pdaMediumCtrl.burned = true;
              bIt.pdaMediumCtrl.sterilized = false;
              if (bIt.spawnCtrl && bIt.spawnCtrl.substrateKind === 'pda') {
                bIt.spawnCtrl.burned = true;
                bIt.spawnCtrl.sterilized = false;
                bIt.spawnCtrl.updateVisual();
              }
              updatePdaMediumVisual(bIt);
            }
          }
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('🔥 Você esqueceu o fogo ligado! Tudo na panela queimou :( Jogue fora!');
          }
        }
      }
    }

    if (cp.statusSprite) {
      const isHeld = ctx.heldItem === cp.potItem || ctx.heldItem === cp.lidItem;
      const pDist = Math.hypot(potP.x - ctx.playerPos.x, potP.z - ctx.playerPos.z);
      const showHud = !isHeld && pDist < 10.5 && (cp.burned || cp.temp > 26 || cp.psi > 0.1 || cp.progress > 0 || activeBurner);
      cp.statusSprite.visible = showHud;
      if (showHud) {
        let stageTitle = '', stageSub = '', barPct = 0, barCol = '#38bdf8', borderCol = '#38bdf8';
        const waterLit = (cp.waterMl / 1000).toFixed(1) + 'L';
        const waterEta = evapRateMl > 0 ? (' • ~' + Math.ceil(cp.waterMl / evapRateMl) + 's água') : '';
        const fireTag = activeBurner ? (' • ' + BURNER_LEVEL_NAMES[heatLvl]) : '';

        if (cp.burned) {
          stageTitle = '🔥 Tudo queimado :(';
          stageSub = 'Jogue fora o conteúdo!';
          barPct = 100; barCol = '#ef4444'; borderCol = '#ef4444';
        } else if (!hasWater) {
          stageTitle = '⚠️ Panela sem água!';
          stageSub = 'Encha na Pia ou Garrafão 5L';
          barPct = 100; barCol = '#ef4444'; borderCol = '#ef4444';
        } else if (hasContainers && !hasBase) {
          stageTitle = '⚠️ Falta Base Perfurada!';
          stageSub = 'Encaixe a base 4cm no fundo';
          barPct = 100; barCol = '#ef4444'; borderCol = '#ef4444';
        } else if (hasContainers && waterTooLow) {
          stageTitle = '💧 Água abaixo da base!';
          stageSub = 'Ideal: 3.4L (+0.5cm acima da base)';
          barPct = 100; barCol = '#f59e0b'; borderCol = '#f59e0b';
        } else if (hasContainers && waterTooHigh) {
          stageTitle = '🌊 Muita água na panela!';
          stageSub = 'Ideal: 3.0–4.0L (+0.5cm da base)';
          barPct = 100; barCol = '#f59e0b'; borderCol = '#f59e0b';
        } else if (activeBurner && !cp.lidItem.isAttached) {
          if ((cp.grainGrams || 0) > 0) {
            barPct = cp.grainAlDente ? 100 : Math.min(100, Math.round(((cp.grainCookSec || 0) / 60) * 100));
            stageTitle = cp.grainAlDente ? '🌽 Milho AO DENTE (Pronto!)' : '🌽 Cozinhando Milho (' + barPct + '%)';
            stageSub = Math.round(cp.grainGrams) + 'g • ' + Math.round(cp.temp) + '°C • Água ' + waterLit;
            barCol = cp.grainAlDente ? '#22c55e' : '#eab308';
          } else {
            barPct = Math.min(100, Math.round(((cp.temp - 25) / 75) * 100));
            stageTitle = cp.temp >= 98 ? '♨️ Fervendo (sem tampa)' : '🔥 Aquecendo água...';
            stageSub = Math.round(cp.temp) + '°C • Água ' + waterLit + waterEta;
            barCol = cp.temp >= 98 ? '#38bdf8' : '#f97316';
          }
          borderCol = barCol;
        } else if (activeBurner && cp.lidItem.isAttached) {
          if (cp.mode === 'pasteurize') {
            if (cp.temp < 74) {
              barPct = Math.min(100, Math.round(((cp.temp - 25) / 50) * 100));
              stageTitle = '🔥 Aquecendo p/ Pasteurizar...';
              stageSub = Math.round(cp.temp) + '°C / 78°C • ' + waterLit + fireTag;
              barCol = '#f97316'; borderCol = '#f97316';
            } else if (cp.progress < 100) {
              barPct = Math.floor(cp.progress);
              stageTitle = '🌡️ Pasteurizando... (' + Math.round(cp.temp) + '°C)';
              stageSub = barPct + '% • Água ' + waterLit + waterEta;
              barCol = '#10b981'; borderCol = '#10b981';
            } else {
              stageTitle = '✅ Pasteurização 100%!';
              stageSub = hasElectricTimer
                ? ('Timer desliga em ' + Math.max(0, Math.ceil(activeBurner.timerRemainingSec || 0)) + 's • ' + waterLit)
                : ('Desligue o fogo • ' + waterLit);
              barPct = 100; barCol = '#22c55e'; borderCol = '#22c55e';
            }
          } else if (cp.temp < LAB.autoclaveTargetTempC) {
            barPct = Math.min(100, Math.round(((cp.temp - 25) / 96) * 100));
            stageTitle = '🔥 Aquecendo... (' + BURNER_LEVEL_NAMES[heatLvl] + ')';
            stageSub = Math.round(cp.temp) + '°C / 121°C • ' + waterLit + waterEta;
            barCol = '#f97316'; borderCol = '#f97316';
          } else if (cp.psi < 14.2 && cp.progress < 100) {
            barPct = Math.min(100, Math.round((cp.psi / LAB.autoclaveTargetPsi) * 100));
            stageTitle = '🔒 PSI aumentando...';
            stageSub = cp.psi.toFixed(1) + '/15 PSI • ' + waterLit + waterEta;
            barCol = '#f59e0b'; borderCol = '#f59e0b';
          } else if (cp.progress < 100) {
            barPct = Math.floor(cp.progress);
            stageTitle = '♨️ Esterilizando (15 PSI)...';
            stageSub = barPct + '% • ' + waterLit + waterEta + (heatLvl === 3 ? ' (Baixe p/ Médio!)' : '');
            barCol = '#22c55e'; borderCol = '#22c55e';
          } else if (hasElectricTimer) {
            const tSec = Math.max(0, Math.ceil(activeBurner.timerRemainingSec || 0));
            barPct = 100;
            stageTitle = '✅ 100% Esterilizado!';
            stageSub = 'Timer desliga em ' + tSec + 's • ' + waterLit;
            barCol = '#22c55e';
            borderCol = '#22c55e';
          } else {
            const secLeft = Math.max(0, Math.ceil(LAB.autoclaveOverheatSec - cp.overheatTimer));
            barPct = Math.round((secLeft / LAB.autoclaveOverheatSec) * 100);
            stageTitle = '✅ 100% Esterilizado!';
            stageSub = 'Desligue o fogo! (' + secLeft + 's)';
            barCol = secLeft <= 5 ? '#ef4444' : '#eab308';
            borderCol = barCol;
          }
        } else {
          if (cp.psi >= LAB.autoclaveLockPsi) {
            barPct = Math.min(100, Math.round((cp.psi / LAB.autoclaveTargetPsi) * 100));
            stageTitle = '🔒 Perdendo pressão...';
            stageSub = cp.psi.toFixed(1) + ' / 15 PSI (aguarde < 1.5)';
            barCol = '#fb923c'; borderCol = '#f59e0b';
          } else if (cp.temp > 30) {
            barPct = Math.max(0, Math.min(100, Math.round(((cp.temp - 25) / 96) * 100)));
            stageTitle = '❄️ Esfriando... (🔓 Destravada)';
            stageSub = Math.round(cp.temp) + '°C • Água ' + waterLit;
            barCol = '#38bdf8'; borderCol = '#38bdf8';
          } else if (cp.progress >= 100) {
            barPct = 100; stageTitle = '✅ 100% Esterilizado'; stageSub = 'Pronto para uso! • Água ' + waterLit;
            barCol = '#22c55e'; borderCol = '#22c55e';
          } else {
            barPct = 0; stageTitle = '🔓 Tampa destravada'; stageSub = Math.round(cp.temp) + '°C • Água ' + waterLit;
            barCol = '#94a3b8'; borderCol = '#64748b';
          }
        }

        const hudKey = stageTitle + '|' + stageSub + '|' + barPct + '|' + barCol;
        if (cp.lastHudKey !== hudKey) {
          cp.lastHudKey = hudKey;
          const ctxHud = cp.statusCtx;
          ctxHud.clearRect(0, 0, 360, 128);
          ctxHud.fillStyle = 'rgba(15, 23, 42, 0.90)';
          ctxHud.beginPath();
          ctxHud.roundRect(4, 4, 352, 120, 16);
          ctxHud.fill();
          ctxHud.lineWidth = 2.5;
          ctxHud.strokeStyle = borderCol;
          ctxHud.stroke();

          ctxHud.font = 'bold 21px sans-serif';
          ctxHud.fillStyle = '#f8fafc';
          ctxHud.textAlign = 'left';
          ctxHud.fillText(stageTitle, 16, 36);

          ctxHud.fillStyle = '#1e293b';
          ctxHud.fillRect(16, 52, 328, 16);
          ctxHud.fillStyle = barCol;
          ctxHud.fillRect(16, 52, Math.round(3.28 * barPct), 16);

          ctxHud.font = 'bold 16px sans-serif';
          ctxHud.fillStyle = cp.burned ? '#fca5a5' : '#e2e8f0';
          ctxHud.fillText(stageSub, 16, 98);
          cp.statusTex.needsUpdate = true;
        }
      }
    }
  }

  if (window.MycoAudio) {
    const lobbyEl = document.getElementById('campus-lobby');
    const inLobby = lobbyEl && !lobbyEl.classList.contains('hidden');
    const steamVol = (!inLobby && anyPotSteaming && nearestSteamDist < 12)
      ? Math.max(0, Math.min(1, 1 - (nearestSteamDist - 2) / 10)) * (0.45 + 0.55 * bestSteamFactor)
      : 0;
    window.MycoAudio.setSteam(steamVol > 0.01, steamVol);
  }

  // Painel 2D nítido no Mobile/Tablet para ler Panela e Timer do Fogareiro mesmo em resolução reduzida
  if (typeof document !== 'undefined') {
    const isMobileUi = !!(ctx.isTouchDevice && ctx.isTouchDevice());
    let telEl = document.getElementById('mobile-lab-telemetry');
    if (!isMobileUi || !ctx.inFps) {
      if (telEl) telEl.style.display = 'none';
    } else {
      const lines = [];
      const pots = ctx.cookerPots || [];
      for (let i = 0; i < pots.length; i++) {
        const cp = pots[i];
        if (!cp || !cp.potItem || !cp.potItem.mesh) continue;
        const d = Math.hypot(cp.potItem.mesh.position.x - ctx.playerPos.x, cp.potItem.mesh.position.z - ctx.playerPos.z);
        if (d < 4.5 && (cp.temp > 28 || cp.waterMl > 0 || (cp.contents && cp.contents.length > 0))) {
          const pct = Math.round(cp.progress || 0);
          lines.push(`🍲 ${Math.round(cp.temp)}°C • ${cp.psi.toFixed(1)} PSI • ${pct}%`);
          break;
        }
      }
      const burners = ctx.burnerStations || [];
      for (let i = 0; i < burners.length; i++) {
        const b = burners[i];
        if (!b) continue;
        const bx = b.mesh ? b.mesh.position.x : (b.x || 0);
        const bz = b.mesh ? b.mesh.position.z : (b.z || 0);
        const d = Math.hypot(bx - ctx.playerPos.x, bz - ctx.playerPos.z);
        if (d < 4.5 && (b.on || b.timerPresetMin > 0)) {
          let tTxt = 'LIVRE';
          if (b.timerPresetMin > 0) {
            const rem = Math.max(0, Math.ceil((b.timerRemainingSec || 0) / BURNER_GAME_MIN_SECONDS));
            const hh = Math.floor(rem / 60);
            const mm = rem % 60;
            tTxt = (hh > 0 ? hh + 'h' : '') + String(mm).padStart(2, '0') + 'm';
          }
          lines.push(`🔥 Fogareiro ${b.on ? ('N' + (b.level || 1)) : 'OFF'} • ⏱️ ${tTxt}`);
          break;
        }
      }
      if (lines.length) {
        if (!telEl) {
          telEl = document.createElement('div');
          telEl.id = 'mobile-lab-telemetry';
          telEl.style.cssText =
            'position:fixed;top:56px;right:10px;z-index:26;pointer-events:none;' +
            'background:rgba(15,23,42,0.92);border:1px solid rgba(52,211,153,0.45);' +
            'border-radius:12px;padding:6px 10px;color:#f8fafc;font-size:12px;font-weight:700;' +
            'line-height:1.45;box-shadow:0 8px 20px rgba(0,0,0,0.45);max-width:62vw;';
          document.body.appendChild(telEl);
        }
        const nextTxt = lines.join('\n');
        if (telEl.textContent !== nextTxt) {
          telEl.style.whiteSpace = 'pre-line';
          telEl.textContent = nextTxt;
        }
        telEl.style.display = 'block';
      } else if (telEl) {
        telEl.style.display = 'none';
      }
    }
  }
}
