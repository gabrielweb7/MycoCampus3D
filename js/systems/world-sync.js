/**
 * Sincronizacao de Estado do Mundo, Objetos, Lousas e Pose Salva (MycoCampus3D)
 */

import { getItemGroundHeight } from '../engine/physics.js';
import { greenhouseSlots, updateGreenhouseSlotMesh } from '../world/greenhouse.js';
import { applyStrokeToBoard } from './chalkboard.js';
import { setHeldTwoHandedGhost } from './interaction-system.js';

export function consumeCampusMovedItems(sim) {
  const list = Object.values(sim.pendingMovedItems);
  sim.pendingMovedItems = {};
  return list;
}

export function requeueCampusMovedItems(sim, list) {
  (list || []).forEach(function (it) {
    if (it && it.id && !sim.pendingMovedItems[it.id]) sim.pendingMovedItems[it.id] = it;
  });
}

export function applyCampusWorldObjects(sim, objectsMap) {
  if (!objectsMap) return;
  const now = performance.now();

  sim.pickableItems.forEach(function (item) {
    if (!item.mesh.userData.updateBounds) return;
    if (sim.heldItem === item || sim.isHeldByRemote(item.id)) return;
    if (sim.pendingMovedItems[item.id]) return;
    if (sim.recentlyDropped[item.id] > now) {
      const svCheck = objectsMap[item.id];
      if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
        delete sim.recentlyDropped[item.id];
      } else if (sim.recentlyDropped[item.id] - now < 13500) {
        sim.pendingMovedItems[item.id] = {
          id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
        };
      }
      return;
    }
    const saved = objectsMap[item.id];
    if (saved) {
      let finalY = saved.y;
      if (!item.mesh.userData.isTable && !item.mesh.userData.isHood) {
        let suppY = getItemGroundHeight(sim.physCtx, saved.x, saved.z, saved.y, item.mesh.userData.dynamicSurface, saved.y + 0.18);
        for (let si = 0; si < sim.supportSurfaces.length; si++) {
          const s = sim.supportSurfaces[si];
          if (s === item.mesh.userData.dynamicSurface) continue;
          if (saved.x >= s.minX - 0.09 && saved.x <= s.maxX + 0.09 && saved.z >= s.minZ - 0.09 && saved.z <= s.maxZ + 0.09 && saved.y >= s.topY - 0.18) {
            suppY = Math.max(suppY, s.topY);
          }
        }
        if (Math.abs(saved.y - suppY) > 0.04) {
          finalY = suppY;
          sim.pendingMovedItems[item.id] = {
            id: item.id, x: saved.x, y: finalY, z: saved.z, ry: saved.ry || 0
          };
        } else {
          finalY = suppY;
        }
      }
      item.mesh.position.set(saved.x, finalY, saved.z);
      item.mesh.rotation.y = saved.ry || 0;
      item.isMoved = true;
      item.mesh.userData.updateBounds(item);
    } else if (item.isMoved) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      item.mesh.userData.updateBounds(item);
      item.isMoved = false;
    }
  });

  sim.pickableItems.forEach(function (item) {
    if (item.mesh.userData.updateBounds) return;
    if (sim.heldItem === item || sim.isHeldByRemote(item.id)) return;
    if (sim.pendingMovedItems[item.id]) return;
    if (sim.recentlyDropped[item.id] > now) {
      const svCheck = objectsMap[item.id];
      if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
        delete sim.recentlyDropped[item.id];
      } else if (sim.recentlyDropped[item.id] - now < 13500) {
        sim.pendingMovedItems[item.id] = {
          id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
        };
      }
      return;
    }
    if (item.potItem && item.isAttached) {
      const pRef = item.potItem;
      if (sim.heldItem === pRef || sim.isHeldByRemote(pRef.id) || sim.pendingMovedItems[pRef.id] || sim.recentlyDropped[pRef.id] > now) {
        return;
      }
    }
    const saved = objectsMap[item.id];
    if (saved) {
      if (item.potItem) {
        const pot = item.potItem;
        const potSaved = objectsMap[pot.id];
        const refX = potSaved ? potSaved.x : pot.mesh.position.x;
        const refY = potSaved ? potSaved.y : pot.mesh.position.y;
        const refZ = potSaved ? potSaved.z : pot.mesh.position.z;
        const attached = Math.hypot(saved.x - refX, saved.z - refZ) < 0.28 &&
          Math.abs(saved.y - (refY + 0.36)) < 0.28;
        item.isAttached = attached;
        if (attached) {
          item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
          item.mesh.rotation.copy(pot.mesh.rotation);
          item.isMoved = true;
          return;
        }
      }
      let suppY = getItemGroundHeight(sim.physCtx, saved.x, saved.z, saved.y, item.mesh.userData.dynamicSurface, saved.y + 0.18);
      for (let i = 0; i < sim.supportSurfaces.length; i++) {
        const s = sim.supportSurfaces[i];
        if (saved.x >= s.minX - 0.09 && saved.x <= s.maxX + 0.09 && saved.z >= s.minZ - 0.09 && saved.z <= s.maxZ + 0.09 && saved.y >= s.topY - 0.18) {
          suppY = Math.max(suppY, s.topY);
        }
      }
      let finalY = saved.y;
      if (saved.y < suppY - 0.04 || (!item.mesh.userData.isPetri && saved.y > suppY + 0.08) || Math.abs(saved.y - suppY) < 0.06) {
        finalY = suppY;
        if (Math.abs(saved.y - suppY) > 0.04) {
          sim.pendingMovedItems[item.id] = {
            id: item.id, x: saved.x, y: finalY, z: saved.z, ry: saved.ry || 0
          };
        }
      }
      item.mesh.position.set(saved.x, finalY, saved.z);
      item.mesh.rotation.y = saved.ry || 0;
      item.isMoved = true;
    } else if (item.isMoved) {
      sim.removeFromCookerContents(item);
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.potItem) item.isAttached = true;
      item.isMoved = false;
    }
  });
}

export function resetCampusWorldObjects(sim) {
  setHeldTwoHandedGhost(sim.heldItem, false);
  sim.heldItem = null;
  sim.pendingMovedItems = {};
  sim.recentlyDropped = {};
  for (let cpi = 0; cpi < sim.cookerPots.length; cpi++) {
    const cp = sim.cookerPots[cpi];
    cp.contents = [];
    cp.psi = 0;
    cp.temp = 25;
    cp.progress = 0;
    cp.sterilized = false;
    cp.overheatTimer = 0;
    cp.burned = false;
    if (cp.steamPoints) cp.steamPoints.visible = false;
    if (cp.statusSprite) cp.statusSprite.visible = false;
    cp.lastHudKey = '';
    if (cp.weight) { cp.weight.position.y = 0.13; cp.weight.rotation.set(0, 0, 0); }
    if (cp.weightTop) { cp.weightTop.position.y = 0.16; cp.weightTop.rotation.set(0, 0, 0); }
    if (cp.safetyPins) {
      for (let pni = 0; pni < cp.safetyPins.length; pni++) cp.safetyPins[pni].position.y = 0.110;
    }
  }
  sim.pickableItems.forEach(function (item) {
    item.mesh.position.copy(item.homePos);
    item.mesh.rotation.y = item.homeRy;
    if (item.potItem) item.isAttached = true;
    if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
    item.isMoved = false;
  });
  if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
}

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

  if (sim.burnerDevices.length && stateMap.burner_lab !== undefined) {
    if (sim.pendingStateChanges.burner_lab === undefined && !(sim.recentlyChangedState.burner_lab > now)) {
      const wantBurnerOn = Number(stateMap.burner_lab) === 1;
      const bn0 = sim.burnerDevices[0];
      if (bn0.on !== wantBurnerOn) {
        bn0.on = wantBurnerOn;
        bn0.ledMat.color.setHex(bn0.on ? 0x22c55e : 0xef4444);
        if (bn0.knobGroup) bn0.knobGroup.rotation.z = bn0.on ? -1.45 : 0;
      }
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

  for (let gi = 0; gi < greenhouseSlots.length; gi++) {
    const slot = greenhouseSlots[gi];
    const kStage = 'greenhouse_slot_' + slot.id + '_stage';
    const kHum = 'greenhouse_slot_' + slot.id + '_humidity';
    if (stateMap[kStage] !== undefined && sim.pendingStateChanges[kStage] === undefined && !(sim.recentlyChangedState[kStage] > now)) {
      const newStage = parseInt(stateMap[kStage], 10);
      if (slot.stage !== newStage) {
        slot.stage = newStage;
        updateGreenhouseSlotMesh(slot);
      }
    }
    if (stateMap[kHum] !== undefined && sim.pendingStateChanges[kHum] === undefined && !(sim.recentlyChangedState[kHum] > now)) {
      const newHum = parseFloat(stateMap[kHum]);
      if (Math.abs(slot.humidity - newHum) > 5) {
        slot.humidity = newHum;
        updateGreenhouseSlotMesh(slot);
      }
    }
  }
}

export function applyCampusSavedPose(sim, pose) {
  if (!pose || typeof pose !== 'object') return;
  if (typeof pose.x === 'number' && typeof pose.z === 'number') {
    sim.playerPos.set(pose.x, typeof pose.y === 'number' ? pose.y : 0, pose.z);
  }
  if (typeof pose.yaw === 'number') sim.playerYaw = pose.yaw;
  if (typeof pose.pitch === 'number') sim.playerPitch = pose.pitch;
  if (pose.seated) {
    let bestSeat = null, bestD = 1.6;
    for (let i = 0; i < sim.seatMeshes.length; i++) {
      const si = sim.seatMeshes[i].userData.seatInfo;
      if (!si) continue;
      const d = Math.hypot(si.x - sim.playerPos.x, si.z - sim.playerPos.z);
      if (d < bestD && Math.abs(si.y - sim.playerPos.y) < 1.0) {
        bestD = d;
        bestSeat = si;
      }
    }
    if (bestSeat) {
      sim.seatedSeat = bestSeat;
      sim.playerPos.set(bestSeat.x, bestSeat.y, bestSeat.z);
    }
  }
  if (pose.holding && !sim.heldItem) {
    const item = sim.findPickable(pose.holding);
    if (item && !sim.isHeldByRemote(item.id)) {
      sim.removeFromCookerContents(item);
      if (item.potItem && item.isAttached) item.isAttached = false;
      sim.heldItem = item;
      sim.heldRotY = item.mesh.rotation.y;
      setHeldTwoHandedGhost(sim.heldItem, true);
      if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(sim.heldItem.label);
    }
  }
}
