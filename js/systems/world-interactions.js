/**
 * Interacoes com Mobiliario, Ambiente e Dispositivos Fixos (MycoCampus3D)
 * Portas, persianas, interruptores, fluxo laminar, agitador, balanca, fogareiro,
 * cinema, ranking, estufa, cogumelos silvestres e assentos.
 */

import { scrollRanking } from '../world/staircase-clock.js';
import { setBurnerLevel, BURNER_LEVEL_NAMES, cycleBurnerTimer, formatBurnerTimerLabel } from '../items/pressure-cooker.js';
import { toggleCabinetPart } from '../items/lab-cabinets.js';
import { petCow } from '../entities/pasture-cows.js';
import { grabSportBall, throwHeldSportBall } from './sports-physics.js';
import { registerDiscoveredSpecies, triggerMagicCubensisEffect } from './mycoteca.js';
import { registerPickable } from '../items/item-registry.js';

export function isSeatOccupied(remoteAvatars, seat) {
  if (!seat) return false;
  for (const avId in remoteAvatars) {
    if (!Object.prototype.hasOwnProperty.call(remoteAvatars, avId)) continue;
    const av = remoteAvatars[avId];
    if (!av || !av.targetPos) continue;
    if (av.seated && Math.hypot(av.targetPos.x - seat.x, av.targetPos.z - seat.z) < 0.48 && Math.abs(av.targetPos.y - seat.y) < 0.85) {
      return true;
    }
  }
  return false;
}

/**
 * Processa o clique primario em elementos fixos do mundo (quando nao ha acao de item em maos).
 * Retorna true se alguma interacao foi executada.
 */
export function handleWorldInteraction(ctx) {
  if (ctx.heldSportBall) {
    return throwHeldSportBall(ctx);
  }
  if (ctx.hoveredSportBall) {
    return grabSportBall(ctx, ctx.hoveredSportBall);
  }
  if (ctx.hoveredGreenhouseSlot) {
    ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
    return true;
  }
  if (ctx.hoveredMushroom && ctx.hoveredMushroom.active) {
    if (ctx.heldItem) {
      if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast('⚠️ Solte ou guarde o item atual antes de colher o cogumelo.');
      }
      return true;
    }
    const wm = ctx.hoveredMushroom;
    wm.active = false;
    wm.group.visible = false;
    wm.respawnAt = performance.now() + 20000;
    ctx.queueWorldStateChange(wm.id, 0);
    if (window.MycoAudio) window.MycoAudio.playHarvest();
    const spName = (wm.capMesh && wm.capMesh.userData.speciesName) || 'Cogumelo Selvagem';
    const disc = registerDiscoveredSpecies(spName);
    const isMagic = (wm.id && wm.id.indexOf('wild_poop_') === 0) ||
      spName.indexOf('Psilocybe') !== -1 || spName.indexOf('Cubensis') !== -1;

    const heldGroup = wm.group.clone();
    heldGroup.visible = true;
    heldGroup.position.set(0, 0, 0);
    heldGroup.scale.setScalar(0.65);
    const pickedId = 'wild_picked_' + Date.now().toString(36);
    const mItem = registerPickable(ctx, pickedId, '🍄 ' + spName, heldGroup, 0, 0, 0, 0, 0.14, 0.20, {
      category: 'specimen',
      purpose: 'Comer ou levar ao Fluxo Laminar para clonar com bisturi',
      weightGrams: 18,
      compatibilities: { canEnterCooker: false }
    });
    mItem.wildMushroomCtrl = { speciesName: spName, isMagic };
    ctx.heldItem = mItem;
    ctx.lastPickupAt = performance.now();
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(mItem.label);
    if (ctx.callbacks.onHarvestMushroom) ctx.callbacks.onHarvestMushroom(wm.id);
    if (ctx.callbacks.onToast) {
      const micMsg = disc.isNew ? ` (Nova na Micoteca: ${disc.list.length}/100!)` : '';
      ctx.callbacks.onToast(`🍄 Colheu ${spName}${micMsg}! Coma ou leve ao Lab para clonar.`);
    }
    return true;
  }
  if (ctx.hoveredDoorObj) {
    ctx.hoveredDoorObj.open = !ctx.hoveredDoorObj.open;
    ctx.queueWorldStateChange(ctx.hoveredDoorObj.id, ctx.hoveredDoorObj.open ? 1 : 0);
    if (window.MycoAudio) window.MycoAudio.playDoor(ctx.hoveredDoorObj.open);
    return true;
  }
  if (ctx.hoveredBlindObj) {
    ctx.hoveredBlindObj.open = !ctx.hoveredBlindObj.open;
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange(ctx.hoveredBlindObj.id, ctx.hoveredBlindObj.open ? 1 : 0);
    return true;
  }
  if (ctx.hoveredCinema) {
    const hit = ctx.getCinemaHitTarget(ctx.hoveredCinemaUv);
    if (hit.type === 'power_on') {
      ctx.cinemaPower = true;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = (ctx.cinemaLessonIdx === -1 || ctx.cinemaPlaying);
      ctx.queueWorldStateChange('cinema_power', 1);
    } else if (hit.type === 'power_off') {
      ctx.cinemaPower = false;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = false;
      ctx.queueWorldStateChange('cinema_power', 0);
    } else if (hit.type === 'menu') {
      ctx.cinemaLessonIdx = -1;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = true;
      ctx.queueWorldStateChange('cinema_lesson', -1);
    } else if (hit.type === 'lesson') {
      ctx.cinemaLessonIdx = hit.idx;
      ctx.cinemaPlaying = true;
      ctx.cinemaTime = 0;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = true;
      ctx.queueWorldStateChange('cinema_lesson', ctx.cinemaLessonIdx);
      ctx.queueWorldStateChange('cinema_playing', 1);
    } else if (hit.type === 'toggle_play') {
      ctx.cinemaPlaying = !ctx.cinemaPlaying;
      ctx.cinemaDirty = true;
      if (ctx.cinemaBeam) ctx.cinemaBeam.visible = ctx.cinemaPlaying;
      ctx.queueWorldStateChange('cinema_playing', ctx.cinemaPlaying ? 1 : 0);
    }
    return true;
  }
  if (ctx.hoveredRankBtn) {
    scrollRanking(ctx.hoveredRankBtn);
    return true;
  }
  if (ctx.hoveredSeat) {
    if (isSeatOccupied(ctx.remoteAvatars, ctx.hoveredSeat)) return true;
    ctx.seatedSeat = ctx.hoveredSeat;
    ctx.playerPos.set(ctx.seatedSeat.x, ctx.seatedSeat.y, ctx.seatedSeat.z);
    ctx.playerYaw = ctx.seatedSeat.yaw;
    if (ctx.playerPitch < -0.06) ctx.playerPitch = -0.02;
    ctx.playerVelX = 0;
    ctx.playerVelZ = 0;
    ctx.playerVelY = 0;
    ctx.notifyWorldAction();
    return true;
  }
  if (ctx.hoveredSwitch) {
    ctx.hoveredSwitch.on = !ctx.hoveredSwitch.on;
    if (ctx.hoveredSwitch.light) {
      ctx.hoveredSwitch.light.visible = ctx.hoveredSwitch.on;
      ctx.hoveredSwitch.light.intensity = ctx.hoveredSwitch.on ? 1.35 : 0;
    }
    if (ctx.hoveredSwitch.gLight) {
      ctx.hoveredSwitch.gLight.visible = ctx.hoveredSwitch.on;
      ctx.hoveredSwitch.gLight.intensity = ctx.hoveredSwitch.on ? 0.65 : 0;
    }
    if (ctx.hoveredSwitch.tubeMat) {
      ctx.hoveredSwitch.tubeMat.emissive.setHex(ctx.hoveredSwitch.on ? 0xfffbeb : 0x1e293b);
      ctx.hoveredSwitch.tubeMat.emissiveIntensity = ctx.hoveredSwitch.on ? 0.85 : 0.02;
    }
    if (ctx.hoveredSwitch.ledMat) {
      ctx.hoveredSwitch.ledMat.color.setHex(ctx.hoveredSwitch.on ? 0x22c55e : 0xef4444);
    }
    if (ctx.hoveredSwitch.rocker) {
      ctx.hoveredSwitch.rocker.rotation.x = ctx.hoveredSwitch.on ? -0.22 : 0.22;
    }
    if (typeof ctx.hoveredSwitch.onToggle === 'function') {
      ctx.hoveredSwitch.onToggle(ctx.hoveredSwitch.on);
    }
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange(ctx.hoveredSwitch.id, ctx.hoveredSwitch.on ? 1 : 0);
    return true;
  }
  if (ctx.hoveredHoodSwitch) {
    ctx.hoveredHoodSwitch.on = !ctx.hoveredHoodSwitch.on;
    ctx.hoveredHoodSwitch.points.visible = ctx.hoveredHoodSwitch.on;
    ctx.hoveredHoodSwitch.hepaMat.emissiveIntensity = ctx.hoveredHoodSwitch.on ? 0.45 : 0.04;
    ctx.hoveredHoodSwitch.ledMat.color.setHex(ctx.hoveredHoodSwitch.on ? 0x22c55e : 0xef4444);
    if (ctx.hoveredHoodSwitch.workLight) {
      ctx.hoveredHoodSwitch.workLight.visible = ctx.hoveredHoodSwitch.on;
      ctx.hoveredHoodSwitch.workLight.intensity = ctx.hoveredHoodSwitch.on ? 0.95 : 0;
    }
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange('hood_lab', ctx.hoveredHoodSwitch.on ? 1 : 0);
    if (ctx.hoveredHoodSwitch.on && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('hood_on');
    return true;
  }
  if (ctx.hoveredStirSwitch) {
    ctx.hoveredStirSwitch.on = !ctx.hoveredStirSwitch.on;
    ctx.hoveredStirSwitch.ledMat.color.setHex(ctx.hoveredStirSwitch.on ? 0x22c55e : 0xef4444);
    ctx.queueWorldStateChange('stir_lab', ctx.hoveredStirSwitch.on ? 1 : 0);
    return true;
  }
  if (ctx.hoveredScaleTare) {
    const sc = ctx.hoveredScaleTare;
    if (sc.lastGross <= 0.05 && sc.tare > 0) {
      sc.tare = 0;
      sc.draw(0);
      if (window.MycoAudio) window.MycoAudio.playClick();
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast('⚖️ TARA cancelada (visor zerado em 0.0 g)');
      }
      return true;
    }
    sc.tare = sc.lastGross || 0;
    sc.draw(0);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(sc.tare > 0
        ? '⚖️ TARA aplicada (' + sc.tare.toFixed(1) + 'g descontados • visor zerado)'
        : '⚖️ Balança zerada (0.0 g)');
    }
    return true;
  }
  if (ctx.hoveredCabinetPart) {
    toggleCabinetPart(ctx, ctx.hoveredCabinetPart);
    if (ctx.callbacks && ctx.callbacks.onToast) {
      const verb = ctx.hoveredCabinetPart.open ? 'aberto' : 'fechado';
      ctx.callbacks.onToast(`🗄️ ${ctx.hoveredCabinetPart.label} ${verb}.`);
    }
    return true;
  }
  if (ctx.hoveredCow) {
    const msg = petCow(ctx.hoveredCow);
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks && ctx.callbacks.onToast && msg) ctx.callbacks.onToast(msg);
    return true;
  }
  if (ctx.hoveredBurnerTimer) {
    const nextMin = cycleBurnerTimer(ctx.hoveredBurnerTimer);
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('⏱️ Timer do Fogareiro definido para: ' + formatBurnerTimerLabel(nextMin));
    }
    return true;
  }
  if (ctx.hoveredBurnerSwitch) {
    const nextLvl = ((ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0)) + 1) % 4;
    setBurnerLevel(ctx.hoveredBurnerSwitch, nextLvl);
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    const bId = ctx.hoveredBurnerSwitch.id || 'burner_lab';
    ctx.queueWorldStateChange(bId, ctx.hoveredBurnerSwitch.on ? 1 : 0);
    ctx.queueWorldStateChange(bId === 'burner_lab' ? 'burner_level_lab' : `${bId}_level`, ctx.hoveredBurnerSwitch.level || 0);
    if (ctx.callbacks.onToast) {
      let desc = BURNER_LEVEL_NAMES[nextLvl];
      if (ctx.hoveredBurnerSwitch.kind === 'gas_tripod') {
        if (nextLvl === 0) desc = 'DESLIGADO';
        else if (nextLvl === 1) desc = 'FOGO BAIXO (Apenas Anel Central)';
        else if (nextLvl === 2) desc = 'FOGO MÉDIO (Queimador Duplo)';
        else if (nextLvl === 3) desc = 'FOGO ALTO (Potência Máxima)';
      }
      ctx.callbacks.onToast('🔥 ' + (ctx.hoveredBurnerSwitch.kind === 'gas_tripod' ? 'Tripé a Gás' : 'Fogareiro') + ': ' + desc);
    }
    if (ctx.hoveredBurnerSwitch.on && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('cooker_heat');
    return true;
  }
  return false;
}
