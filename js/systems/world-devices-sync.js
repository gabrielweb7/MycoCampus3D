/**
 * Sincronizacao de Dispositivos Fixos, Lousas, Portas, Luzes, Estufa e Cinema (MycoCampus3D)
 */

import {
  greenhouseSlots,
  greenhouseEnv,
  updateGreenhouseSlotMesh,
  updateGreenhousePanelDisplay,
  inferKindFromSpecies,
  inferColorFromSpecies
} from '../world/greenhouse.js';
import { applyStrokeToBoard } from './chalkboard.js';
import { setCultureFridgeDoorOpen } from '../items/culture-fridge.js';
import { setBurnerLevel } from '../items/pressure-cooker.js';
import { applyCabinetStates } from '../items/lab-cabinets.js';
import { applySportBallStates } from './sports-physics.js';

export function consumeCampusBoardStrokes(sim) {
  if (sim.currentStroke && sim.currentStroke.pts.length >= 2) {
    const lastPt = sim.currentStroke.pts[sim.currentStroke.pts.length - 1];
    sim.pendingBoardStrokes.push({
      b: sim.currentStroke.b,
      c: sim.currentStroke.c,
      pts: sim.currentStroke.pts.slice()
    });
    sim.currentStroke.pts = [lastPt];
  }
  const out = sim.pendingBoardStrokes.slice();
  sim.pendingBoardStrokes = [];
  return out;
}

export function requeueCampusBoardStrokes(sim, strokes) {
  if (!Array.isArray(strokes) || !strokes.length) return;
  sim.pendingBoardStrokes = strokes.concat(sim.pendingBoardStrokes);
}

export function applyCampusBoardStrokes(sim, strokes) {
  (strokes || []).forEach(function (st) {
    applyStrokeToBoard(sim.chalkboards, st);
  });
}

export function consumeCampusStateChanges(sim) {
  const out = Object.assign({}, sim.pendingStateChanges);
  sim.pendingStateChanges = {};
  return out;
}

export function requeueCampusStateChanges(sim, changes) {
  if (!changes || typeof changes !== 'object') return;
  Object.keys(changes).forEach(function (k) {
    if (sim.pendingStateChanges[k] === undefined) {
      sim.pendingStateChanges[k] = changes[k];
    }
  });
}

export function applyCampusWorldState(sim, stateMap, isInitial) {
  if (!stateMap || typeof stateMap !== 'object') return;
  const now = performance.now();

  applyCabinetStates(sim, stateMap, now, isInitial);

  for (let di = 0; di < sim.campusDoors.length; di++) {
    const d = sim.campusDoors[di];
    if (!d.id || stateMap[d.id] === undefined) continue;
    if (sim.pendingStateChanges[d.id] !== undefined || sim.recentlyChangedState[d.id] > now) continue;
    const wantOpen = Number(stateMap[d.id]) === 1;
    if (d.open !== wantOpen) {
      d.open = wantOpen;
      if (isInitial) {
        d.angle = d.open ? -d.dir * Math.PI * 0.48 : 0;
        d.pivot.rotation.y = d.angle;
      }
    }
  }

  for (let bi = 0; bi < sim.windowBlinds.length; bi++) {
    const b = sim.windowBlinds[bi];
    if (!b.id || stateMap[b.id] === undefined) continue;
    if (sim.pendingStateChanges[b.id] !== undefined || sim.recentlyChangedState[b.id] > now) continue;
    const wantBlindOpen = Number(stateMap[b.id]) === 1;
    if (b.open !== wantBlindOpen) b.open = wantBlindOpen;
  }

  sim.pickableItems.forEach(function (item) {
    if (!item.fridgeCtrl || stateMap[item.id] === undefined) return;
    if (sim.pendingStateChanges[item.id] !== undefined || sim.recentlyChangedState[item.id] > now) return;
    setCultureFridgeDoorOpen(item, Number(stateMap[item.id]) === 1, !!isInitial);
  });

  for (let li = 0; li < sim.campusLightSwitches.length; li++) {
    const sw = sim.campusLightSwitches[li];
    if (!sw.id || stateMap[sw.id] === undefined) continue;
    if (sim.pendingStateChanges[sw.id] !== undefined || sim.recentlyChangedState[sw.id] > now) continue;
    const wantLightOn = Number(stateMap[sw.id]) !== 0;
    if (sw.on !== wantLightOn) {
      sw.on = wantLightOn;
      if (sw.light) { sw.light.visible = sw.on; sw.light.intensity = sw.on ? 1.35 : 0; }
      if (sw.gLight) { sw.gLight.visible = sw.on; sw.gLight.intensity = sw.on ? 0.65 : 0; }
      if (sw.tubeMat) {
        sw.tubeMat.emissive.setHex(sw.on ? 0xfffbeb : 0x1e293b);
        sw.tubeMat.emissiveIntensity = sw.on ? 0.85 : 0.02;
      }
      if (sw.ledMat) sw.ledMat.color.setHex(sw.on ? 0x22c55e : 0xef4444);
      if (sw.rocker) sw.rocker.rotation.x = sw.on ? -0.22 : 0.22;
    }
  }

  if (sim.hoodAirData && stateMap.hood_lab !== undefined) {
    if (sim.pendingStateChanges.hood_lab === undefined && !(sim.recentlyChangedState.hood_lab > now)) {
      const wantHoodOn = Number(stateMap.hood_lab) !== 0;
      if (sim.hoodAirData.on !== wantHoodOn) {
        sim.hoodAirData.on = wantHoodOn;
        sim.hoodAirData.points.visible = sim.hoodAirData.on;
        sim.hoodAirData.hepaMat.emissiveIntensity = sim.hoodAirData.on ? 0.45 : 0.04;
        sim.hoodAirData.ledMat.color.setHex(sim.hoodAirData.on ? 0x22c55e : 0xef4444);
        if (sim.hoodAirData.workLight) {
          sim.hoodAirData.workLight.visible = sim.hoodAirData.on;
          sim.hoodAirData.workLight.intensity = sim.hoodAirData.on ? 0.95 : 0;
        }
      }
    }
  }

  if (stateMap.hood_sanitized_until !== undefined &&
      sim.pendingStateChanges.hood_sanitized_until === undefined &&
      !(sim.recentlyChangedState.hood_sanitized_until > now)) {
    const expiresAt = Number(stateMap.hood_sanitized_until);
    if (Number.isFinite(expiresAt)) {
      const serverNow = typeof stateMap._serverTs === 'number' ? stateMap._serverTs : Math.floor(Date.now() / 1000);
      const remainingMs = Math.max(0, (expiresAt - serverNow) * 1000);
      sim.hoodSanitizedUntil = remainingMs > 0 ? (Date.now() + remainingMs) : 0;
    }
  }

  if (sim.stirrerDevices.length && stateMap.stir_lab !== undefined) {
    if (sim.pendingStateChanges.stir_lab === undefined && !(sim.recentlyChangedState.stir_lab > now)) {
      const wantStirOn = Number(stateMap.stir_lab) === 1;
      const st0 = sim.stirrerDevices[0];
      if (st0.on !== wantStirOn) {
        st0.on = wantStirOn;
        st0.ledMat.color.setHex(st0.on ? 0x22c55e : 0xef4444);
      }
    }
  }

  for (let bi = 0; bi < sim.burnerDevices.length; bi++) {
    const bn = sim.burnerDevices[bi];
    const bId = bn.id || (bi === 0 ? 'burner_lab' : 'gas_tripod_sub');
    const levelKey = bId === 'burner_lab' ? 'burner_level_lab' : `${bId}_level`;
    const toggleKey = bId;
    const burnerSyncKey = stateMap[levelKey] !== undefined ? levelKey : (stateMap[toggleKey] !== undefined ? toggleKey : null);
    if (burnerSyncKey && sim.pendingStateChanges[burnerSyncKey] === undefined && !(sim.recentlyChangedState[burnerSyncKey] > now)) {
      const savedValue = parseInt(stateMap[burnerSyncKey], 10) || 0;
      const burnerLevel = (burnerSyncKey === levelKey)
        ? Math.max(0, Math.min(3, savedValue))
        : (savedValue === 1 ? 3 : 0);
      if (bn.level !== burnerLevel) setBurnerLevel(bn, burnerLevel);
    }
  }

  for (let ci = 0; ci < sim.cookerPots.length; ci++) {
    const cooker = sim.cookerPots[ci];
    const cookerKey = cooker.potItem.id === 'pressure_cooker_sub' ? 'cooker_mode_sub' : 'cooker_mode_lab';
    if (stateMap[cookerKey] === undefined || sim.pendingStateChanges[cookerKey] !== undefined || sim.recentlyChangedState[cookerKey] > now) continue;
    const mode = Number(stateMap[cookerKey]) === 1 ? 'pasteurize' : 'sterilize';
    if (cooker.mode !== mode) {
      cooker.mode = mode;
      cooker.lastHudKey = '';
    }
  }

  let cinemaChanged = false;
  if (stateMap.cinema_power !== undefined && sim.pendingStateChanges.cinema_power === undefined && !(sim.recentlyChangedState.cinema_power > now)) {
    const wantPower = Number(stateMap.cinema_power) === 1;
    if (sim.cinemaPower !== wantPower) { sim.cinemaPower = wantPower; cinemaChanged = true; }
  }
  if (stateMap.cinema_lesson !== undefined && sim.pendingStateChanges.cinema_lesson === undefined && !(sim.recentlyChangedState.cinema_lesson > now)) {
    const wantLes = parseInt(stateMap.cinema_lesson, 10);
    if (!isNaN(wantLes) && sim.cinemaLessonIdx !== wantLes) {
      sim.cinemaLessonIdx = wantLes;
      sim.cinemaTime = 0;
      cinemaChanged = true;
    }
  }
  if (stateMap.cinema_playing !== undefined && sim.pendingStateChanges.cinema_playing === undefined && !(sim.recentlyChangedState.cinema_playing > now)) {
    const wantPlay = Number(stateMap.cinema_playing) === 1;
    if (sim.cinemaPlaying !== wantPlay) { sim.cinemaPlaying = wantPlay; cinemaChanged = true; }
  }
  if (cinemaChanged) {
    sim.cinemaDirty = true;
    if (sim.cinemaBeam) sim.cinemaBeam.visible = sim.cinemaPower && (sim.cinemaLessonIdx === -1 || sim.cinemaPlaying);
  }

  for (let mi = 0; mi < sim.wildMushrooms.length; mi++) {
    const wm = sim.wildMushrooms[mi];
    if (!wm.id || stateMap[wm.id] === undefined) continue;
    if (sim.pendingStateChanges[wm.id] !== undefined || sim.recentlyChangedState[wm.id] > now) continue;
    const isAvailable = Number(stateMap[wm.id]) === 1;
    if (isAvailable && !wm.active) {
      wm.active = true; wm.group.visible = true; wm.respawnAt = 0;
    } else if (!isAvailable && wm.active) {
      wm.active = false; wm.group.visible = false; wm.respawnAt = now + 20000;
    }
  }

  let envChanged = false;
  const syncEnvNum = (key, applyFn) => {
    if (stateMap[key] !== undefined && sim.pendingStateChanges[key] === undefined && !(sim.recentlyChangedState[key] > now)) {
      const val = parseFloat(stateMap[key]);
      if (Number.isFinite(val)) {
        applyFn(val);
        envChanged = true;
      }
    }
  };
  syncEnvNum('greenhouse_auto', (v) => { greenhouseEnv.autoMode = Number(v) === 1; });
  syncEnvNum('greenhouse_target_hum', (v) => { greenhouseEnv.targetHumidity = v; });
  syncEnvNum('greenhouse_target_co2', (v) => { greenhouseEnv.targetCo2 = v; });
  syncEnvNum('greenhouse_target_temp', (v) => { greenhouseEnv.targetTempC = v / 10; });
  syncEnvNum('greenhouse_hum', (v) => { if (Math.abs(greenhouseEnv.humidity - v) > 4) greenhouseEnv.humidity = v; });
  syncEnvNum('greenhouse_co2', (v) => { if (Math.abs(greenhouseEnv.co2Ppm - v) > 80) greenhouseEnv.co2Ppm = v; });
  syncEnvNum('greenhouse_temp', (v) => { if (Math.abs(greenhouseEnv.tempC - (v / 10)) > 1.2) greenhouseEnv.tempC = v / 10; });
  syncEnvNum('greenhouse_humidifier', (v) => { if (!greenhouseEnv.autoMode) greenhouseEnv.humidifierPower = v; });
  syncEnvNum('greenhouse_exhaust', (v) => { if (!greenhouseEnv.autoMode) greenhouseEnv.exhaustPower = v; });
  syncEnvNum('greenhouse_cooler', (v) => { if (!greenhouseEnv.autoMode) greenhouseEnv.coolerActive = Number(v) === 1; });
  syncEnvNum('greenhouse_light', (v) => { greenhouseEnv.lightOn = Number(v) === 1; });
  if (envChanged) updateGreenhousePanelDisplay();

  for (let gi = 0; gi < greenhouseSlots.length; gi++) {
    const slot = greenhouseSlots[gi];
    const kStage = 'greenhouse_slot_' + slot.id + '_stage';
    const kHum = 'greenhouse_slot_' + slot.id + '_humidity';
    const kEmpty = 'greenhouse_slot_' + slot.id + '_empty';
    const kSpecies = 'greenhouse_slot_' + slot.id + '_species';
    let slotDirty = false;
    if (stateMap[kEmpty] !== undefined && sim.pendingStateChanges[kEmpty] === undefined && !(sim.recentlyChangedState[kEmpty] > now)) {
      const nextEmpty = Number(stateMap[kEmpty]) === 1;
      if (slot.empty !== nextEmpty) {
        slot.empty = nextEmpty;
        if (nextEmpty) {
          slot.stage = -1;
          slot.name = 'Espaço Livre #' + (slot.id + 1);
          slot.sci = 'Aguardando Spawn';
          slot.speciesName = '';
        }
        slotDirty = true;
      }
    }
    if (stateMap[kSpecies] !== undefined && sim.pendingStateChanges[kSpecies] === undefined && !(sim.recentlyChangedState[kSpecies] > now)) {
      const spName = String(stateMap[kSpecies] || '');
      if (spName && slot.speciesName !== spName) {
        slot.speciesName = spName;
        slot.name = spName;
        slot.kind = inferKindFromSpecies(spName);
        slot.color = inferColorFromSpecies(spName);
        slotDirty = true;
      }
    }
    if (stateMap[kStage] !== undefined && sim.pendingStateChanges[kStage] === undefined && !(sim.recentlyChangedState[kStage] > now)) {
      const newStage = parseInt(stateMap[kStage], 10);
      if (newStage >= 0 && slot.empty && stateMap[kEmpty] === undefined) {
        slot.empty = false;
      }
      if (!slot.empty && slot.stage !== newStage) {
        slot.stage = newStage;
        slotDirty = true;
      }
    }
    if (stateMap[kHum] !== undefined && sim.pendingStateChanges[kHum] === undefined && !(sim.recentlyChangedState[kHum] > now)) {
      const newHum = parseFloat(stateMap[kHum]);
      if (Math.abs(slot.humidity - newHum) > 5) {
        slot.humidity = newHum;
        slotDirty = true;
      }
    }
    if (slotDirty) updateGreenhouseSlotMesh(slot);
  }
  applySportBallStates(sim, stateMap);
}
