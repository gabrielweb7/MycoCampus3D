/**
 * Item Segurado em 1a Pessoa, Termometro Laser Infravermelho e Seringa (MycoCampus3D)
 */

import { GAME_CONFIG } from '../core/config.js';
import { getGroundHeight } from '../engine/physics.js';
import { getVirtualDayFrac } from '../world/staircase-clock.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { updateSyringeVolume } from '../items/syringe.js';
import { greenhouseSlots } from '../world/greenhouse.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';

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
          sLbl = pNode.userData.pickableLabel || pid;
          if (pid.indexOf('heat_sealer') === 0) sTemp = 165.0 + Math.sin(ctx.clock.elapsedTime * 2.5) * 1.2;
          else if (pid.indexOf('laminar_hood') === 0) sTemp = (ctx.hoodAirData && ctx.hoodAirData.on) ? 21.2 : 23.5;
          else if (pid.indexOf('precision_scale') === 0) sTemp = 24.1;
          else if (pid.indexOf('alcohol_spray') === 0) sTemp = 20.2;
          else if (pid.indexOf('liquid_culture') === 0) sTemp = 24.5 + Math.sin(ctx.clock.elapsedTime * 2.0) * 0.2;
          else if (pid === 'petri_contam') sTemp = 26.8;
          else if (pid.indexOf('petri_') === 0) sTemp = 25.0;
          else if (pid === 'spawn_bag_colonized' || (pNode.userData.spawnCtrl && pNode.userData.spawnCtrl.inoculated)) sTemp = 26.4;
          else if (pid.indexOf('spawn_') === 0) sTemp = 23.8;
          else if (pid.indexOf('fruiting_block') === 0) sTemp = 21.4;
          else if (pid.indexOf('substrate_') === 0) sTemp = 22.6;
          else if (pid.indexOf('pda_bottle') === 0) sTemp = 24.0;
          else if (pid.indexOf('syringe_') === 0) sTemp = 23.6;
          else if (pid.indexOf('beaker_') === 0) sTemp = 23.5;
          else if (pid.indexOf('table_') === 0) sTemp = 21.8;
          else sTemp = 23.3;
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
    } else {
      ctx.heldItem.mesh.rotation.set(0, ctx.heldRotY, 0);
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

  if (ctx.syringePumping) {
    if (!ctx.heldItem || !ctx.heldItem.mesh.userData.isSyringe) {
      ctx.syringePumping = null;
    } else if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.position.distanceTo(ctx.playerPos) > 4.5) {
      ctx.syringePumping = null;
      if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 Bombeamento cancelado: você se afastou do recipiente.');
    }
  }
  if (ctx.syringePumping && ctx.heldItem && ctx.heldItem.mesh.userData.isSyringe) {
    ctx.syringePumping.elapsed += dt;
    const pRatio = Math.min(1, ctx.syringePumping.elapsed / ctx.syringePumping.duration);
    const pSmooth = pRatio * pRatio * (3 - 2 * pRatio);
    const curVol = THREE.MathUtils.lerp(ctx.syringePumping.fromVol, ctx.syringePumping.toVol, pSmooth);
    updateSyringeVolume(ctx.heldItem, curVol);
    if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.liquidCtrl) {
      const dHeld = curVol - ctx.syringePumping.fromVol;
      const newJVol = Math.max(0, ctx.syringePumping.startJarVol - dHeld);
      updateContainerVolume(ctx.syringePumping.target.item, newJVol);
    }
    if (pRatio >= 1.0) {
      updateSyringeVolume(ctx.heldItem, ctx.syringePumping.toVol);
      if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.liquidCtrl) {
        const finalD = ctx.syringePumping.toVol - ctx.syringePumping.fromVol;
        updateContainerVolume(ctx.syringePumping.target.item, Math.max(0, ctx.syringePumping.startJarVol - finalD));
      } else if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.spawnCtrl) {
        const spTarget = ctx.syringePumping.target.item;
        const spCtrl = spTarget.spawnCtrl;
        const isAseptic = !!(ctx.hoodAirData && ctx.hoodAirData.on && performance.now() < ctx.hoodSanitizedUntil);
        spCtrl.inoculated = true;
        if (!isAseptic && Math.random() < 0.45) {
          spCtrl.contaminated = true;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Contaminação! Lembre de ligar e higienizar o Fluxo Laminar com Álcool 70% antes de inocular!');
        } else {
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 ' + spCtrl.baseLabel + ' inoculado com sucesso! Micélio em colonização.');
        }
        spCtrl.updateVisual();
      } else if (ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.isPetri) {
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🧫 Placa de Petri inoculada com Cultura Líquida!');
      }
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('syringe_use');
      ctx.notifyWorldAction();
      ctx.syringePumping = null;
    }
  }
}
