/**
 * Simulacao do Laboratorio e Estufa (MycoCampus3D)
 * Fluxo laminar, agitador magnetico, balanca, fogareiro, panela de pressao,
 * colonizacao de spawn, borrifador de alcool e ciclo da estufa.
 */

import { GAME_CONFIG } from '../core/config.js';
import {
  greenhouseSlots,
  updateGreenhouseSlotMesh,
  stepGreenhouseParticles
} from '../world/greenhouse.js';

const LAB = GAME_CONFIG.lab;
const GH = GAME_CONFIG.greenhouse;

let lastScaleAt = 0;

export function stepLabAndGreenhouse(ctx, dt, now) {
  // Fluxo laminar
  if (ctx.hoodAirData && ctx.hoodAirData.on && ctx.hoodAirData.attr) {
    const aArr = ctx.hoodAirData.attr.array;
    for (let ai = 0; ai < aArr.length; ai += 3) {
      aArr[ai] += dt * 1.45;
      if (aArr[ai] > 0.78) {
        aArr[ai] = -0.36;
        aArr[ai + 1] = 0.10 + Math.random() * 0.85;
        aArr[ai + 2] = (Math.random() - 0.5) * 2.0;
      }
    }
    ctx.hoodAirData.attr.needsUpdate = true;
  }

  // Agitador magnetico
  if (ctx.stirrerDevices.length) {
    for (let si = 0; si < ctx.pickableItems.length; si++) {
      const liqIt = ctx.pickableItems[si];
      const lcCtrl = liqIt.mesh && liqIt.mesh.userData.liquidCtrl;
      if (!lcCtrl || !lcCtrl.stirBar) continue;
      const lx = liqIt.mesh.position.x, ly = liqIt.mesh.position.y, lz = liqIt.mesh.position.z;
      for (let sj = 0; sj < ctx.stirrerDevices.length; sj++) {
        const st = ctx.stirrerDevices[sj];
        if (st.on && lx >= st.surface.minX && lx <= st.surface.maxX && lz >= st.surface.minZ && lz <= st.surface.maxZ && Math.abs(ly - st.surface.topY) < 0.08) {
          lcCtrl.stirBar.rotation.y += dt * 18;
          if (lcCtrl.mycCloud) lcCtrl.mycCloud.rotation.y += dt * 4.5;
          break;
        }
      }
    }
  }

  // Balanca de precisao
  if (ctx.scaleDevices.length && (!lastScaleAt || now - lastScaleAt > LAB.scaleRefreshMs)) {
    lastScaleAt = now;
    for (let sci = 0; sci < ctx.scaleDevices.length; sci++) {
      const scObj = ctx.scaleDevices[sci];
      let gross = 0;
      for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
        const pIt = ctx.pickableItems[pi];
        if (ctx.heldItem === pIt || pIt.mesh.userData.tableDims || pIt.potItem) continue;
        const px0 = pIt.mesh.position.x, py0 = pIt.mesh.position.y, pz0 = pIt.mesh.position.z;
        if (px0 >= scObj.surface.minX && px0 <= scObj.surface.maxX && pz0 >= scObj.surface.minZ && pz0 <= scObj.surface.maxZ && py0 >= scObj.surface.topY - 0.04 && py0 <= scObj.surface.topY + 0.45) {
          if (pIt.mesh.userData.liquidCtrl) gross += 260 + pIt.mesh.userData.liquidCtrl.volMl;
          else if (pIt.id.indexOf('spawn_jar_empty') === 0) gross += 320;
          else if (pIt.id.indexOf('spawn_jar') === 0) gross += 780;
          else if (pIt.id.indexOf('spawn_bag_empty') === 0) gross += 25;
          else if (pIt.id.indexOf('spawn_bag') === 0) gross += 1525;
          else if (pIt.id.indexOf('pda_bottle') === 0) gross += 540;
          else if (pIt.id.indexOf('petri_bare_') === 0) gross += 18;
          else if (pIt.id.indexOf('petri_') === 0) gross += 38;
          else if (pIt.mesh.userData.isSyringe) gross += 12 + pIt.mesh.userData.syrCtrl.volMl;
          else if (pIt.mesh.userData.isAlcoholSpray) gross += 380;
          else if (pIt.id.indexOf('substrate_') === 0) gross += 5000;
          else if (pIt.id.indexOf('gloves_box_') === 0) gross += 420;
          else if (pIt.id.indexOf('foil_roll_') === 0) gross += 260;
          else if (pIt.id.indexOf('micropore_') === 0 || pIt.id.indexOf('parafilm_') === 0) gross += 65;
          else gross += 150;
        }
      }
      scObj.lastGross = gross;
      scObj.draw(gross - scObj.tare);
    }
  }

  // Panelas de pressao e fogareiros
  if (ctx.cookerPots.length) {
    let anyPotSteaming = false;
    for (let bni = 0; bni < ctx.burnerDevices.length; bni++) {
      const bnd = ctx.burnerDevices[bni];
      bnd.heat = bnd.on ? Math.min(1, (bnd.heat || 0) + dt * 0.55) : Math.max(0, (bnd.heat || 0) - dt * 0.25);
      const h = bnd.heat;
      const pulse = h > 0.2 ? Math.sin(ctx.clock.elapsedTime * 5.0) * 0.08 * h : 0;
      bnd.coilMat.emissiveIntensity = h * 2.2 + pulse;
      bnd.coilMat.color.setRGB(0.39 + h * 0.55, 0.45 - h * 0.30, 0.55 - h * 0.48);
      if (bnd.reflectorMat) bnd.reflectorMat.emissiveIntensity = h * 0.28;
    }
    let nearestSteamDist = Infinity;
    let bestSteamFactor = 0;
    for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
      const cp = ctx.cookerPots[cpi];
      const potP = cp.potItem.mesh.position;
      let onActiveBurner = false;
      for (let bi = 0; bi < ctx.burnerDevices.length; bi++) {
        const bn = ctx.burnerDevices[bi];
        if (bn.on && potP.x >= bn.surface.minX && potP.x <= bn.surface.maxX && potP.z >= bn.surface.minZ && potP.z <= bn.surface.maxZ && Math.abs(potP.y - bn.surface.topY) < 0.08) {
          onActiveBurner = true; break;
        }
      }
      if (onActiveBurner && cp.lidItem.isAttached) {
        if (cp.temp < LAB.autoclaveTargetTempC) {
          cp.temp = Math.min(LAB.autoclaveTargetTempC, cp.temp + dt * 6.5);
        } else if (cp.psi < LAB.autoclaveTargetPsi && cp.progress < 100) {
          cp.psi = Math.min(LAB.autoclaveTargetPsi, cp.psi + dt * 3.0);
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

      const steamFactor = (cp.lidItem.isAttached && cp.psi >= 10.0) ? Math.min(1, (cp.psi - 10.0) / 5.0) : 0;
      if (steamFactor > 0.02) {
        anyPotSteaming = true;
        const sDist = Math.hypot(potP.x - ctx.playerPos.x, potP.z - ctx.playerPos.z);
        if (sDist < nearestSteamDist) {
          nearestSteamDist = sDist;
          bestSteamFactor = steamFactor;
        }
        cp.steamPoints.visible = true;
        const sa = cp.steamAttr.array;
        const riseSpd = 0.35 + steamFactor * 0.45;
        for (let si = 0; si < sa.length; si += 3) {
          sa[si + 1] += dt * riseSpd;
          if (sa[si + 1] > 0.60) {
            sa[si] = (Math.random() - 0.5) * 0.04;
            sa[si + 1] = 0.17;
            sa[si + 2] = (Math.random() - 0.5) * 0.04;
          }
        }
        cp.steamAttr.needsUpdate = true;
        const wobble = Math.sin(ctx.clock.elapsedTime * (20 + steamFactor * 20));
        const lift = Math.abs(wobble) * (0.008 * steamFactor);
        cp.weight.position.y = 0.13 + lift;
        cp.weightTop.position.y = 0.16 + lift;
        cp.weight.rotation.z = wobble * 0.10 * steamFactor;
        cp.weightTop.rotation.z = wobble * 0.10 * steamFactor;
      } else {
        cp.steamPoints.visible = false;
        cp.weight.position.y = 0.13;
        cp.weightTop.position.y = 0.16;
        cp.weight.rotation.z = 0;
        cp.weightTop.rotation.z = 0;
      }

      if (onActiveBurner && cp.lidItem.isAttached && cp.psi >= 14.9 && !cp.burned) {
        if (cp.progress < 100) {
          cp.progress = Math.min(100, cp.progress + dt * 8.5);
          if (cp.progress >= 100) {
            cp.sterilized = true;
            cp.overheatTimer = 0;
            for (let ci = 0; ci < cp.contents.length; ci++) {
              const cIt = cp.contents[ci];
              if (cIt.spawnCtrl) {
                cIt.spawnCtrl.sterilized = true;
                cIt.spawnCtrl.updateVisual();
              }
            }
          }
        } else {
          cp.overheatTimer += dt;
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
            }
            if (ctx.callbacks.onToast) {
              ctx.callbacks.onToast('🔥 Você esqueceu o fogo ligado! Tudo na panela queimou :( Jogue fora!');
            }
          }
        }
      }

      if (cp.statusSprite) {
        const pDist = Math.hypot(potP.x - ctx.playerPos.x, potP.z - ctx.playerPos.z);
        const showHud = pDist < 10.5 && (cp.burned || cp.temp > 26 || cp.psi > 0.1 || cp.progress > 0);
        cp.statusSprite.visible = showHud;
        if (showHud) {
          let stageTitle = '';
          let stageSub = '';
          let barPct = 0;
          let barCol = '#38bdf8';
          let borderCol = '#38bdf8';

          if (cp.burned) {
            stageTitle = '🔥 Tudo queimado :(';
            stageSub = 'Jogue fora o conteúdo!';
            barPct = 100;
            barCol = '#ef4444';
            borderCol = '#ef4444';
          } else if (onActiveBurner && cp.lidItem.isAttached) {
            if (cp.temp < LAB.autoclaveTargetTempC) {
              barPct = Math.min(100, Math.round(((cp.temp - 25) / 96) * 100));
              stageTitle = '🔥 Aquecendo...';
              stageSub = Math.round(cp.temp) + '°C / ' + LAB.autoclaveTargetTempC + '°C (' + barPct + '%)';
              barCol = '#f97316';
              borderCol = '#f97316';
            } else if (cp.psi < LAB.autoclaveTargetPsi && cp.progress < 100) {
              barPct = Math.min(100, Math.round((cp.psi / LAB.autoclaveTargetPsi) * 100));
              stageTitle = '🔒 PSI aumentando...';
              stageSub = cp.psi.toFixed(1) + ' / ' + LAB.autoclaveTargetPsi + ' PSI (' + barPct + '%)';
              barCol = '#f59e0b';
              borderCol = '#f59e0b';
            } else if (cp.progress < 100) {
              barPct = Math.floor(cp.progress);
              stageTitle = '♨️ Esterilizando...';
              stageSub = barPct + '% concluído (15 PSI)';
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
              stageSub = cp.psi.toFixed(1) + ' / ' + LAB.autoclaveTargetPsi + ' PSI (aguarde < ' + LAB.autoclaveLockPsi + ')';
              barCol = '#fb923c';
              borderCol = '#f59e0b';
            } else if (cp.temp > 30) {
              barPct = Math.max(0, Math.min(100, Math.round(((cp.temp - 25) / 96) * 100)));
              stageTitle = '❄️ Temperatura caindo...';
              stageSub = Math.round(cp.temp) + '°C → ambiente (🔓 Destravada)';
              barCol = '#38bdf8';
              borderCol = '#38bdf8';
            } else if (cp.progress >= 100) {
              barPct = 100;
              stageTitle = '✅ 100% Esterilizado';
              stageSub = 'Pronto para uso! :)';
              barCol = '#22c55e';
              borderCol = '#22c55e';
            } else {
              barPct = 0;
              stageTitle = '🔓 Tampa destravada';
              stageSub = Math.round(cp.temp) + '°C';
              barCol = '#94a3b8';
              borderCol = '#64748b';
            }
          }

          const hudKey = stageTitle + '|' + stageSub + '|' + barPct + '|' + barCol;
          if (cp.lastHudKey !== hudKey) {
            cp.lastHudKey = hudKey;
            const ctxHud = cp.statusCtx;
            ctxHud.clearRect(0, 0, 320, 112);
            ctxHud.fillStyle = 'rgba(15, 23, 42, 0.90)';
            ctxHud.beginPath();
            ctxHud.roundRect(4, 4, 312, 104, 16);
            ctxHud.fill();
            ctxHud.lineWidth = 2.5;
            ctxHud.strokeStyle = borderCol;
            ctxHud.stroke();

            ctxHud.font = 'bold 21px sans-serif';
            ctxHud.fillStyle = '#f8fafc';
            ctxHud.textAlign = 'left';
            ctxHud.fillText(stageTitle, 16, 35);

            ctxHud.fillStyle = '#1e293b';
            ctxHud.fillRect(16, 48, 288, 16);
            ctxHud.fillStyle = barCol;
            ctxHud.fillRect(16, 48, Math.round(2.88 * barPct), 16);

            ctxHud.font = 'bold 17px sans-serif';
            ctxHud.fillStyle = cp.burned ? '#fca5a5' : '#e2e8f0';
            ctxHud.fillText(stageSub, 16, 90);
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
  }

  // Colonizacao de spawn
  if (ctx.spawnGrowItems.length) {
    for (let sgi = 0; sgi < ctx.spawnGrowItems.length; sgi++) {
      const sgIt = ctx.spawnGrowItems[sgi];
      const sc = sgIt.spawnCtrl;
      if (sc && sc.inoculated && sc.colonization < 100) {
        sc.colonization = Math.min(100, sc.colonization + dt * 4.2);
        sc.updateVisual();
      }
    }
  }

  // Borrifador de alcool
  if (ctx.sprayBursts.length) {
    for (let sbi = ctx.sprayBursts.length - 1; sbi >= 0; sbi--) {
      const sb = ctx.sprayBursts[sbi];
      sb.age += dt;
      const sArr = sb.attr.array;
      for (let k = 0; k < sArr.length; k += 3) {
        sArr[k] += sb.dir.x * dt * 2.2;
        sArr[k + 1] += sb.dir.y * dt * 2.2;
        sArr[k + 2] += sb.dir.z * dt * 2.2;
      }
      sb.attr.needsUpdate = true;
      sb.mat.opacity = Math.max(0, 0.85 * (1 - sb.age / 0.45));
      if (sb.age >= 0.45) {
        ctx.scene.remove(sb.pts);
        if (sb.pts.geometry && sb.pts.geometry.dispose) sb.pts.geometry.dispose();
        if (sb.mat && sb.mat.dispose) sb.mat.dispose();
        ctx.sprayBursts.splice(sbi, 1);
      }
    }
  }

  // Ciclo da estufa
  for (let gi = 0; gi < greenhouseSlots.length; gi++) {
    const gSlot = greenhouseSlots[gi];
    gSlot.humidity = Math.max(20, gSlot.humidity - dt * GH.humidityDecayPerSec);
    if (gSlot.humidity >= GH.minGrowthHumidity && gSlot.stage < 3) {
      gSlot.growth += dt * (gSlot.humidity / 100) * GH.growthRateMultiplier;
      if (gSlot.growth >= 100) {
        gSlot.stage++;
        gSlot.growth = 0;
        updateGreenhouseSlotMesh(gSlot);
        ctx.queueWorldStateChange('greenhouse_slot_' + gSlot.id + '_stage', gSlot.stage);
      }
    }
  }
  stepGreenhouseParticles(dt);
}
