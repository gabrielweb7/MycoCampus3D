/**
 * Item Segurado em 1a Pessoa, Termometro Laser Infravermelho e Seringa (MycoCampus3D)
 */

import { GAME_CONFIG } from '../core/config.js';
import { getGroundHeight } from '../engine/physics.js';
import { getVirtualDayFrac } from '../world/staircase-clock.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { updateSyringeVolume } from '../items/syringe.js';
import { getItemBaseTempC } from '../items/item-registry.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { inoculatePetri } from '../items/petri-dish.js';
import { greenhouseSlots } from '../world/greenhouse.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { markPdaVolumeChanged } from '../items/pda-mix.js';
import { spawnSprayParticles } from '../items/alcohol-spray.js';

const THREE = window.THREE;

const _tmpHandLocal = new THREE.Vector3();
const _tmpHandPos = new THREE.Vector3();
const _tmpMuzzlePos = new THREE.Vector3();
const _vZero2 = new THREE.Vector2(0, 0);
const _tmpSyrPort = new THREE.Vector3();
const _tmpSyrHand = new THREE.Vector3();
const _tmpSyrOff = new THREE.Vector3();
const _tmpNormal = new THREE.Vector3();
const _tmpLookPt = new THREE.Vector3();
const _tmpSkyEnd = new THREE.Vector3();
const _tmpPourFrom = new THREE.Vector3();
const _tmpPourDir = new THREE.Vector3();

function updateThermometerLaser(ctx, dt, now) {
  if (!ctx.thermoLaserOn) {
    ctx.thermoLaserLine.visible = false;
    ctx.thermoLaserDot.visible = false;
    drawThermoScreen(ctx.thermoCurrentTemp, 'HOLD');
    return;
  }

  _tmpMuzzlePos.set(0, 0.155, -0.09).applyEuler(ctx.heldItem.mesh.rotation).add(ctx.heldItem.mesh.position);
  ctx.raycaster.setFromCamera(ctx.inFps ? _vZero2 : ctx.pointerNdc, ctx.camera);

  if (!window._cachedLaserTargets || (now - (window._lastLaserCacheAt || 0) > 800)) {
    window._lastLaserCacheAt = now;
    const lTargets = [];
    for (let pki = 0; pki < ctx.pickableItems.length; pki++) {
      const pItem = ctx.pickableItems[pki];
      if (pItem && pItem.mesh && pItem !== ctx.heldItem) lTargets.push(pItem.mesh);
    }
    for (let smi = 0; smi < ctx.supportMeshes.length; smi++) {
      const sMesh = ctx.supportMeshes[smi];
      if (sMesh && (!ctx.heldItem || sMesh !== ctx.heldItem.mesh)) lTargets.push(sMesh);
    }
    for (let dmi = 0; dmi < ctx.doorHitMeshes.length; dmi++) {
      if (ctx.doorHitMeshes[dmi]) lTargets.push(ctx.doorHitMeshes[dmi]);
    }
    for (let gsi = 0; gsi < greenhouseSlots.length; gsi++) {
      if (greenhouseSlots[gsi] && greenhouseSlots[gsi].group) lTargets.push(greenhouseSlots[gsi].group);
    }
    Object.keys(ctx.remoteAvatars).forEach(function (rId) {
      const rAv = ctx.remoteAvatars[rId];
      if (rAv && rAv.group) lTargets.push(rAv.group);
    });
    window._cachedLaserTargets = lTargets;
  }

  const rawHits = ctx.raycaster.intersectObjects(window._cachedLaserTargets, true);
  let lHit = null;
  for (let rhi = 0; rhi < rawHits.length; rhi++) {
    const candH = rawHits[rhi];
    if (!candH.object.userData.ignoreRay &&
        candH.object !== ctx.heldItem.mesh &&
        candH.object !== ctx.thermoLaserLine &&
        candH.object !== ctx.thermoLaserDot) {
      lHit = candH;
      break;
    }
  }

  if (lHit && lHit.distance < GAME_CONFIG.interaction.maxLaserDist) {
    const lArr = ctx.thermoLaserLine.geometry.attributes.position.array;
    lArr[0] = _tmpMuzzlePos.x; lArr[1] = _tmpMuzzlePos.y; lArr[2] = _tmpMuzzlePos.z;
    lArr[3] = lHit.point.x; lArr[4] = lHit.point.y; lArr[5] = lHit.point.z;
    ctx.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
    ctx.thermoLaserLine.visible = true;

    if (lHit.face) {
      _tmpNormal.copy(lHit.face.normal).transformDirection(lHit.object.matrixWorld);
    } else {
      _tmpNormal.set(0, 1, 0);
    }
    ctx.thermoLaserDot.position.copy(lHit.point).addScaledVector(_tmpNormal, 0.005);
    _tmpLookPt.copy(lHit.point).add(_tmpNormal);
    ctx.thermoLaserDot.lookAt(_tmpLookPt);
    ctx.thermoLaserDot.visible = true;

    let sTemp = 23.4;
    let sLbl = '';
    const hObj = lHit.object;

    for (let bi = 0; bi < ctx.burnerDevices.length; bi++) {
      const bd = ctx.burnerDevices[bi];
      if (hObj.userData.burnerSwitchIdx !== undefined || hObj.userData.supportSurface === bd.surface ||
          (lHit.point.x >= bd.surface.minX && lHit.point.x <= bd.surface.maxX &&
           lHit.point.z >= bd.surface.minZ && lHit.point.z <= bd.surface.maxZ &&
           Math.abs(lHit.point.y - bd.surface.topY) < 0.15)) {
        sTemp = 24.0 + (bd.heat || 0) * 215.0;
        sLbl = (bd.heat > 0.15) ? 'Fogareiro Incandescente' : 'Fogareiro Elétrico';
        break;
      }
    }
    if (!sLbl) {
      for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
        const cp = ctx.cookerPots[cpi];
        if (hObj === cp.potItem.mesh || hObj === cp.lidItem.mesh ||
            hObj.parent === cp.potItem.mesh || hObj.parent === cp.lidItem.mesh ||
            cp.contents.some(function (it) { return it.mesh === hObj || it.mesh.children.includes(hObj); })) {
          sTemp = cp.temp || 24.5;
          sLbl = cp.psi >= 14 ? 'Panela Esterilizando (' + Math.round(cp.psi) + ' PSI)' : (cp.temp > 35 ? 'Panela Aquecendo' : 'Panela de Pressão');
          break;
        }
      }
    }
    if (!sLbl) {
      if (hObj.userData.stirSwitch || (hObj.parent && hObj.parent.userData.stirSwitch)) {
        sTemp = (ctx.stirrerDevices[0] && ctx.stirrerDevices[0].on) ? 34.5 : 23.8;
        sLbl = 'Agitador Magnético';
      } else if (hObj.userData.remotePlayer || (hObj.parent && hObj.parent.userData.remotePlayer)) {
        sTemp = 36.7 + Math.sin(ctx.clock.elapsedTime * 1.3) * 0.2;
        sLbl = 'Jogador (Corporal)';
      } else if (hObj.userData.doorObj) {
        sTemp = 22.8;
        sLbl = hObj.userData.doorObj.label || 'Porta';
      } else {
        let pWalk = hObj;
        let pNode = null;
        while (pWalk) {
          if (pWalk.userData && pWalk.userData.pickableId) { pNode = pWalk; break; }
          pWalk = pWalk.parent;
        }
        if (pNode) {
          const pid = pNode.userData.pickableId;
          const pItem = ctx.findPickable ? ctx.findPickable(pid) : null;
          sLbl = (pItem && pItem.label) || pNode.userData.pickableLabel || pid;
          sTemp = pItem ? getItemBaseTempC(pItem, ctx) : 23.3;
        } else if (lHit.point.x > 18 && lHit.point.z > 5 && lHit.point.z < 11) {
          sTemp = 20.5 + Math.cos(ctx.clock.elapsedTime * 1.5) * 0.3;
          sLbl = 'Estufa de Frutificação';
        } else {
          sTemp = 23.2 + Math.sin(lHit.point.x * 0.5 + lHit.point.z * 0.3) * 0.4;
          sLbl = lHit.point.y > 0.6 ? 'Bancada / Estrutura' : 'Piso';
        }
      }
    }
    ctx.thermoTargetTemp = sTemp;
    ctx.thermoTargetLabel = sLbl;
  } else {
    const rOrig = ctx.raycaster.ray.origin;
    const rDir = ctx.raycaster.ray.direction;
    let gHitPt = null;
    for (let stepD = 1.0; stepD <= 32.0; stepD += 1.0) {
      const sx = rOrig.x + rDir.x * stepD;
      const sy = rOrig.y + rDir.y * stepD;
      const sz = rOrig.z + rDir.z * stepD;
      const gy = getGroundHeight(ctx.physCtx, sx, sz, sy + 1.0);
      if (sy <= gy) {
        _tmpLookPt.set(sx, gy, sz);
        gHitPt = _tmpLookPt;
        break;
      }
    }
    if (gHitPt) {
      const lArrG = ctx.thermoLaserLine.geometry.attributes.position.array;
      lArrG[0] = _tmpMuzzlePos.x; lArrG[1] = _tmpMuzzlePos.y; lArrG[2] = _tmpMuzzlePos.z;
      lArrG[3] = gHitPt.x; lArrG[4] = gHitPt.y; lArrG[5] = gHitPt.z;
      ctx.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
      ctx.thermoLaserLine.visible = true;
      ctx.thermoLaserDot.position.set(gHitPt.x, gHitPt.y + 0.008, gHitPt.z);
      ctx.thermoLaserDot.lookAt(gHitPt.x, gHitPt.y + 1, gHitPt.z);
      ctx.thermoLaserDot.visible = true;

      const isLake = (Math.hypot(gHitPt.x, gHitPt.z - 48) < 17) || gHitPt.y < 0.05;
      if (isLake) {
        ctx.thermoTargetTemp = 19.2;
        ctx.thermoTargetLabel = 'Água do Lago';
      } else if (ctx.weatherMode === 'snow') {
        ctx.thermoTargetTemp = 1.5;
        ctx.thermoTargetLabel = 'Solo com Neve';
      } else if (ctx.weatherMode === 'rain') {
        ctx.thermoTargetTemp = 17.4;
        ctx.thermoTargetLabel = 'Solo Molhado';
      } else {
        const sunBoost = Math.max(0, Math.sin((getVirtualDayFrac() - 0.25) * Math.PI * 2)) * 8.5;
        ctx.thermoTargetTemp = 18.8 + sunBoost + Math.sin(gHitPt.x * 0.2 + gHitPt.z * 0.2) * 0.4;
        ctx.thermoTargetLabel = (Math.abs(gHitPt.x) < 13 && Math.abs(gHitPt.z) < 13) ? 'Piso da Praça' : 'Grama / Terreno';
      }
    } else {
      _tmpSkyEnd.copy(rOrig).addScaledVector(rDir, 22.0);
      const lArrS = ctx.thermoLaserLine.geometry.attributes.position.array;
      lArrS[0] = _tmpMuzzlePos.x; lArrS[1] = _tmpMuzzlePos.y; lArrS[2] = _tmpMuzzlePos.z;
      lArrS[3] = _tmpSkyEnd.x; lArrS[4] = _tmpSkyEnd.y; lArrS[5] = _tmpSkyEnd.z;
      ctx.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
      ctx.thermoLaserLine.visible = true;
      ctx.thermoLaserDot.visible = false;
      ctx.thermoTargetTemp = ctx.weatherMode === 'snow' ? -6.5 : 4.2;
      ctx.thermoTargetLabel = 'Céu Aberto';
    }
  }
  ctx.thermoCurrentTemp += (ctx.thermoTargetTemp - ctx.thermoCurrentTemp) * Math.min(1, dt * 14);
  drawThermoScreen(ctx.thermoCurrentTemp, 'SCAN');
}

export function stepHeldItemAndSyringe(ctx, dt, now) {
  const isTwoHanded = !!(ctx.heldItem && ctx.heldItem.mesh.userData.twoHanded);

  if (ctx.heldItem) {
    const reachZ = ctx.fpsArmGroup ? ctx.armReach * 0.16 : 0;
    const reachY = ctx.fpsArmGroup ? ctx.armReach * 0.06 : 0;
    if (isTwoHanded) {
      _tmpHandLocal.set(0, -0.48, -0.78);
    } else if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isTray) {
      _tmpHandLocal.set(0.14, -0.26 + reachY, -0.58 - reachZ);
    } else {
      _tmpHandLocal.set(0.30, -0.22 + reachY, -0.58 - reachZ);
    }
    _tmpHandPos.copy(_tmpHandLocal).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
    ctx.heldItem.mesh.position.copy(_tmpHandPos);
    if (ctx.heldItem.id.indexOf('chalk_') === 0) {
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(ctx.playerPitch + 0.35, ctx.playerYaw, 0);
    } else if (ctx.heldItem.id.indexOf('board_eraser') === 0) {
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(ctx.playerPitch + Math.PI / 2, ctx.playerYaw, 0);
    } else if (ctx.heldItem.mesh.userData.isThermometer) {
      _tmpHandLocal.set(0.24, -0.22 + reachY, -0.46 - reachZ);
      _tmpHandPos.copy(_tmpHandLocal).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
      ctx.heldItem.mesh.position.copy(_tmpHandPos);
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(ctx.playerPitch, ctx.playerYaw, 0);
      updateThermometerLaser(ctx, dt, now);
    } else if (ctx.heldItem.mesh.userData.isAlcoholSpray) {
      const spUd = ctx.heldItem.mesh.userData;
      const squeezing = spUd.sprayAnimUntil && spUd.sprayAnimUntil > now;
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(-ctx.playerPitch * 0.45 + (squeezing ? 0.08 : 0), ctx.playerYaw + Math.PI, 0);
      if (spUd.sprayTrig) {
        spUd.sprayTrig.position.z = squeezing ? 0.032 : 0.042;
      }
    } else if (ctx.heldItem.mesh.userData.isLabSpoon) {
      const spoonUd = ctx.heldItem.mesh.userData;
      const stirRem = (spoonUd.spoonStirUntil || 0) - now;
      const stirBowl = spoonUd.spoonStirTarget;
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      if (stirRem > 0 && stirBowl && stirBowl.mesh) {
        const stirPhase = (700 - stirRem) * 0.014;
        const bp = stirBowl.mesh.position;
        const fall = Math.min(1, (700 - stirRem) / 120, stirRem / 120);
        const k = Math.max(0, fall);
        ctx.heldItem.mesh.position.set(
          _tmpHandPos.x + (bp.x + Math.cos(stirPhase) * 0.045 - _tmpHandPos.x) * k,
          _tmpHandPos.y + (bp.y + 0.075 - _tmpHandPos.y) * k,
          _tmpHandPos.z + (bp.z + Math.sin(stirPhase) * 0.045 - _tmpHandPos.z) * k
        );
        ctx.heldItem.mesh.rotation.set(-1.05 * k - 0.15 * (1 - k), ctx.playerYaw + Math.sin(stirPhase) * 0.4 * k, 0);
        if (stirBowl.bowlCtrl && stirBowl.bowlCtrl.mixMesh) stirBowl.bowlCtrl.mixMesh.rotation.y += dt * 9;
      } else {
        ctx.heldItem.mesh.rotation.set(-0.15, ctx.playerYaw, 0);
      }
    } else {
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(0, ctx.playerYaw, 0);
    }

    if (ctx.heldItem.trayContents && ctx.heldItem.trayContents.length) {
      const hRy = ctx.heldItem.mesh.rotation.y;
      const ch = Math.cos(hRy), sh = Math.sin(hRy);
      const hp = ctx.heldItem.mesh.position;
      for (let tci = 0; tci < ctx.heldItem.trayContents.length; tci++) {
        const tc = ctx.heldItem.trayContents[tci];
        if (!tc.item || !tc.item.mesh) continue;
        tc.item.mesh.position.set(
          hp.x + tc.lx * ch + tc.lz * sh,
          hp.y + tc.ly,
          hp.z - tc.lx * sh + tc.lz * ch
        );
        tc.item.mesh.rotation.set(0, hRy + tc.lry, 0);
      }
    }

    if (ctx.heldItem.mesh.userData.isSyringe) {
      const activeSyrItem = (ctx.hoveredSyringeTarget && ctx.hoveredSyringeTarget.item && ctx.hoveredSyringeTarget.item.mesh.userData.liquidCtrl)
        ? ctx.hoveredSyringeTarget.item
        : ((ctx.syringePumping && ctx.syringePumping.target && ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.liquidCtrl) ? ctx.syringePumping.target.item : null);
      const isPuncturing = !!activeSyrItem;
      if (activeSyrItem) ctx.lastSyringeTargetItem = activeSyrItem;
      ctx.syringePunctureProgress += ((isPuncturing ? 1 : 0) - ctx.syringePunctureProgress) * Math.min(1, dt * 10);
      if (ctx.syringePunctureProgress > 0.01 && ctx.lastSyringeTargetItem) {
        const sTgt = ctx.lastSyringeTargetItem;
        _tmpSyrPort.set(0.036, 0.290, 0).applyEuler(sTgt.mesh.rotation).add(sTgt.mesh.position);
        const tgtRotX = 0.08 * ctx.syringePunctureProgress;
        const tgtRotY = ctx.playerYaw * (1 - ctx.syringePunctureProgress) + (sTgt.mesh.rotation.y + Math.PI * 0.5) * ctx.syringePunctureProgress;
        const tgtRotZ = -1.48 * ctx.syringePunctureProgress;
        ctx.heldItem.mesh.rotation.set(tgtRotX, tgtRotY, tgtRotZ);

        _tmpSyrOff.set(0.12, 0.022, 0).applyEuler(ctx.heldItem.mesh.rotation);
        _tmpSyrHand.copy(_tmpSyrPort).sub(_tmpSyrOff);
        _tmpSyrHand.y -= 0.018 * ctx.syringePunctureProgress;
        _tmpHandPos.lerp(_tmpSyrHand, ctx.syringePunctureProgress);
        ctx.heldItem.mesh.position.copy(_tmpHandPos);

        if (ctx.fpsArmGroup) {
          ctx.fpsArmGroup.position.set(
            0.32 - 0.04 * ctx.syringePunctureProgress,
            -0.28 - 0.04 * ctx.syringePunctureProgress,
            -0.42 - 0.04 * ctx.syringePunctureProgress
          );
          ctx.fpsArmGroup.rotation.set(
            0.18 + 0.14 * ctx.syringePunctureProgress,
            -0.14 + 0.04 * ctx.syringePunctureProgress,
            0.05
          );
        }
      } else if (ctx.syringePunctureProgress <= 0.01) {
        ctx.syringePunctureProgress = 0;
        ctx.lastSyringeTargetItem = null;
      }
    }

    if (ctx.heldItem.lidItem && ctx.heldItem.lidItem.isAttached) {
      const lidObj = ctx.heldItem.lidItem.mesh;
      lidObj.position.set(_tmpHandPos.x, _tmpHandPos.y + 0.36, _tmpHandPos.z);
      lidObj.rotation.copy(ctx.heldItem.mesh.rotation);
    }
  } else {
    if (ctx.thermoLaserLine && ctx.thermoLaserLine.visible) ctx.thermoLaserLine.visible = false;
    if (ctx.thermoLaserDot && ctx.thermoLaserDot.visible) ctx.thermoLaserDot.visible = false;
  }

  if (ctx.pourHold) {
    const ph = ctx.pourHold;
    const srcLcP = ph.src && ph.src.mesh && ph.src.mesh.userData.liquidCtrl;
    const aimingOk = ctx.isPrimaryDown && ctx.heldItem === ph.src &&
      (ph.kind === 'pot' ? ctx.hoveredFillPot === ph.dst : ctx.hoveredPourTarget === ph.dst);
    let stopPour = !aimingOk || !srcLcP || srcLcP.volMl <= 0;
    if (!stopPour) {
      const rate = ph.kind === 'pp5' ? 30 : (ph.kind === 'pot' ? 420 : 240);
      ph.carry += dt * rate;
      const stepMl = Math.floor(ph.carry);
      if (stepMl >= 1) {
        ph.carry -= stepMl;
        let amt = 0;
        if (ph.kind === 'pot') {
          amt = Math.min(stepMl, srcLcP.volMl, ph.dst.maxWaterMl - ph.dst.waterMl);
          if (amt > 0) {
            updateContainerVolume(ph.src, srcLcP.volMl - amt);
            ph.dst.waterMl += amt;
            updateCookerWaterVisual(ph.dst);
          }
        } else if (ph.kind === 'pp5') {
          const sp = ph.dst.spawnCtrl;
          amt = Math.min(stepMl, srcLcP.volMl, 35 - (sp.waterMl || 0));
          if (amt > 0) {
            updateContainerVolume(ph.src, srcLcP.volMl - amt);
            sp.waterMl = (sp.waterMl || 0) + amt;
            sp.updateVisual();
          }
        } else {
          const dLc = ph.dst.mesh.userData.liquidCtrl;
          amt = Math.min(stepMl, srcLcP.volMl, dLc.maxMl - dLc.volMl);
          if (amt > 0) {
            updateContainerVolume(ph.src, srcLcP.volMl - amt);
            updateContainerVolume(ph.dst, dLc.volMl + amt);
            if (ph.dst.pdaMediumCtrl) markPdaVolumeChanged(ph.dst);
          }
        }
        if (amt <= 0) {
          stopPour = true;
        } else {
          ph.any = true;
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ph.src.label);
        }
      }
      if (!stopPour) {
        if (now - ph.dropAt > 80) {
          ph.dropAt = now;
          _tmpPourFrom.copy(ph.src.mesh.position);
          _tmpPourFrom.y += 0.10;
          _tmpPourDir.set(0, -1, 0);
          spawnSprayParticles(ctx, 0x7dd3fc, 5, _tmpPourFrom, _tmpPourDir, 0.12, 0.9, 0.032, 0.42);
        }
        if (now - ph.soundAt > 260) {
          ph.soundAt = now;
          if (window.MycoAudio) window.MycoAudio.playSpray();
        }
      }
    }
    if (stopPour) {
      if (ph.any) ctx.notifyWorldAction();
      ctx.pourHold = null;
    }
  }

  if (ctx.sinkFilling) {
    const sf = ctx.sinkFilling;
    if (!ctx.isPrimaryDown || !ctx.heldItem || ctx.heldItem !== sf.item || !ctx.hoveredSink) {
      if (sf.addedAny) {
        if (ctx.callbacks.onHoldChange && ctx.heldItem) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        ctx.notifyWorldAction();
      }
      ctx.sinkFilling = null;
    } else {
      triggerSinkStream(ctx.hoveredSink, 250);
      const lc = sf.item.mesh && sf.item.mesh.userData && sf.item.mesh.userData.liquidCtrl;
      if (lc) {
        if (lc.volMl < lc.maxMl) {
          const rate = lc.maxMl >= 4000 ? 450 : 220;
          sf.carryMl = (sf.carryMl || 0) + dt * rate;
          const stepMl = Math.floor(sf.carryMl);
          if (stepMl >= 1) {
            sf.carryMl -= stepMl;
            updateContainerVolume(sf.item, Math.min(lc.maxMl, lc.volMl + stepMl));
            if (sf.item.pdaMediumCtrl) markPdaVolumeChanged(sf.item);
            sf.addedAny = true;
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(sf.item.label);
          }
        }
      } else {
        for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
          const cp = ctx.cookerPots[cpi];
          if (cp.potItem === sf.item && cp.waterMl < cp.maxWaterMl) {
            sf.carryMl = (sf.carryMl || 0) + dt * 500;
            const stepMl = Math.floor(sf.carryMl);
            if (stepMl >= 1) {
              sf.carryMl -= stepMl;
              cp.waterMl = Math.min(cp.maxWaterMl, cp.waterMl + stepMl);
              updateCookerWaterVisual(cp);
              sf.addedAny = true;
              if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(sf.item.label);
            }
            break;
          }
        }
      }
    }
  }

  if (ctx.syringePumping) {
    if (!ctx.heldItem || !ctx.heldItem.mesh.userData.isSyringe) {
      ctx.syringePumping = null;
    } else if (ctx.syringePumping.target && ctx.syringePumping.target.item &&
               ctx.syringePumping.target.item.mesh &&
               ctx.syringePumping.target.item.mesh.position.distanceTo(ctx.playerPos) > 4.5) {
      ctx.syringePumping = null;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 Bombeamento cancelado: você se afastou do recipiente.');
    }
  }
  if (ctx.syringePumping && ctx.heldItem && ctx.heldItem.mesh.userData.isSyringe) {
    if (ctx.syringePumping.holdMode && !ctx.isPrimaryDown) {
      const syrCtrl = ctx.heldItem.mesh.userData.syrCtrl;
      const finalVol = Math.round((syrCtrl ? syrCtrl.volMl : 0) * 10) / 10;
      updateSyringeVolume(ctx.heldItem, finalVol);
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 Seringa com ' + finalVol.toFixed(1) + ' ml');
      ctx.notifyWorldAction();
      ctx.syringePumping = null;
    } else {
      ctx.syringePumping.elapsed += dt;
      const pRatio = Math.min(1, ctx.syringePumping.elapsed / ctx.syringePumping.duration);
      const pSmooth = ctx.syringePumping.holdMode ? pRatio : (pRatio * pRatio * (3 - 2 * pRatio));
      const curVol = THREE.MathUtils.lerp(ctx.syringePumping.fromVol, ctx.syringePumping.toVol, pSmooth);
      const syringeTarget = ctx.syringePumping.target.item;
      const targetLiquid = syringeTarget && syringeTarget.mesh.userData.liquidCtrl;
      const targetSpawn = syringeTarget && syringeTarget.spawnCtrl;
      updateSyringeVolume(ctx.heldItem, curVol);
      if (targetLiquid && !(ctx.syringePumping.target.mode === 'inject' && targetSpawn)) {
        const dHeld = curVol - ctx.syringePumping.fromVol;
        const newJVol = Math.max(0, ctx.syringePumping.startJarVol - dHeld);
        updateContainerVolume(syringeTarget, newJVol);
      }
      if (ctx.syringePumping.holdMode && ctx.callbacks.onHoverPrompt) {
        const isDraw = ctx.syringePumping.toVol > ctx.syringePumping.fromVol;
        ctx.callbacks.onHoverPrompt('💉 ' + (isDraw ? 'Aspirando' : 'Injetando') + ': ' + curVol.toFixed(1) + ' / 10.0 ml (solte para parar)');
      }
      if (pRatio >= 1.0) {
      updateSyringeVolume(ctx.heldItem, ctx.syringePumping.toVol);
      if (targetLiquid && !(ctx.syringePumping.target.mode === 'inject' && targetSpawn)) {
        const finalD = ctx.syringePumping.toVol - ctx.syringePumping.fromVol;
        updateContainerVolume(syringeTarget, Math.max(0, ctx.syringePumping.startJarVol - finalD));
      } else if (targetSpawn) {
        const spTarget = syringeTarget;
        const spCtrl = targetSpawn;
        const isAseptic = isAsepticWorkArea(ctx, spTarget);
        spCtrl.inoculated = true;
        if (!spCtrl.sterilized && Math.random() < 0.85) {
          spCtrl.contaminated = true;
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('🦠 Contaminação! O substrato não completou o tempo mínimo de esterilização (' + (spCtrl.minSterilizeMin || 80) + ' min)!');
          }
        } else if (!isAseptic && Math.random() < 0.45) {
          spCtrl.contaminated = true;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Contaminação! Lembre de ligar e higienizar o Fluxo Laminar com Álcool 70% antes de inocular!');
        } else {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 ' + spCtrl.baseLabel + ' inoculado com sucesso! Micélio em colonização.');
        }
        spCtrl.updateVisual();
      } else if (syringeTarget && syringeTarget.mesh.userData.isPetri) {
        const petriTarget = syringeTarget;
        const petriCtrl = petriTarget.mesh.userData.petriCtrl;
        const doseMl = ctx.syringePumping.amountMl || 1;
        if (petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.lidOpen && petriCtrl.sterilized) {
          const aseptic = isAsepticWorkArea(ctx, petriTarget);
          inoculatePetri(petriTarget, 'liquid', aseptic);
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast(aseptic
              ? '💉 ' + doseMl + 'ml inoculado. O micélio branco começará a crescer na placa.'
              : '🦠 ' + doseMl + 'ml aplicado fora da área asséptica; a placa foi contaminada.');
          }
        } else if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('⚠️ Esta placa não está mais vazia e estéril para inoculação.');
        }
      }
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('syringe_use');
      ctx.notifyWorldAction();
      ctx.syringePumping = null;
      }
    }
  }
}
