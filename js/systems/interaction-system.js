/**
 * Sistema de Interacoes & Raycasting (MycoCampus3D)
 * Hover raycast, pegar/soltar objetos, inoculacao, panela de pressao, borrifador,
 * termometro laser, lousa, portas, persianas, cinema, assentos e estufa.
 */

import { getHeldBoardToolColor, drawBoardSegment } from './chalkboard.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';
import {
  findPlacementTarget,
  isPlacementBlocked,
  getPlacementBlockedReason,
  updatePlacementGhostVisual
} from '../entities/placement-ghost.js';
import { greenhouseHitMeshes } from '../world/greenhouse.js';
import { scrollRanking } from '../world/staircase-clock.js';
import { canItemEnterCooker, canSyringeTarget } from '../items/item-registry.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { setBurnerLevel, BURNER_LEVEL_NAMES, updateCookerWaterVisual } from '../items/pressure-cooker.js';
import { fillSpawnWithSubstrate } from '../items/spawn-containers.js';
import { updateScalpelLabel } from '../items/scalpel.js';

const THREE = window.THREE;
const _vZero2 = new THREE.Vector2(0, 0);

export function setMeshGhostOpacity(root, active) {
  if (!root) return;
  root.traverse(function (ch) {
    if (!ch.isMesh || !ch.material) return;
    const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
    mats.forEach(function (m) {
      if (active) {
        if (!m.userData._origHeld) {
          m.userData._origHeld = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
        }
        m.transparent = true;
        m.opacity = 0.14;
        m.depthWrite = false;
      } else if (m.userData._origHeld) {
        m.transparent = m.userData._origHeld.transparent;
        m.opacity = m.userData._origHeld.opacity;
        m.depthWrite = m.userData._origHeld.depthWrite;
      }
    });
  });
}

export function setHeldTwoHandedGhost(item, active) {
  if (!item || !item.mesh || !item.mesh.userData.twoHanded) return;
  item.mesh.visible = !active;
  if (item.lidItem) {
    if (active && item.lidItem.isAttached) {
      item.lidItem.mesh.visible = false;
    } else if (!active) {
      item.lidItem.mesh.visible = true;
    }
  }
}

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

export function firstValidRayHit(hits) {
  for (let hi = 0; hi < hits.length; hi++) {
    if (!hits[hi].object.userData.ignoreRay) return hits[hi];
  }
  return null;
}

export function dropHeldItem(ctx) {
  if (!ctx.heldItem) return;
  ctx.syringePumping = null;
  ctx.syringePunctureProgress = 0;
  ctx.lastSyringeTargetItem = null;
  const rayNdc = ctx.inFps ? _vZero2 : ctx.pointerNdc;
  const pt = findPlacementTarget(ctx.entityCtx, rayNdc);
  if (isPlacementBlocked(ctx.entityCtx, pt)) {
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast(getPlacementBlockedReason() || '🚫 Sem espaço livre aqui para soltar o item!');
    }
    return;
  }
  const dropTs = performance.now() + 15000;
  const held = ctx.heldItem;
  held.mesh.position.copy(pt);
  held.mesh.rotation.set(0, ctx.heldRotY, 0);
  held.isMoved = true;
  if (held.mesh.userData.updateBounds) held.mesh.userData.updateBounds(held);
  ctx.pendingMovedItems[held.id] = {
    id: held.id, x: held.mesh.position.x, y: held.mesh.position.y, z: held.mesh.position.z, ry: held.mesh.rotation.y
  };
  ctx.recentlyDropped[held.id] = dropTs;
  if (held.lidItem && held.lidItem.isAttached) {
    const lid = held.lidItem;
    lid.mesh.position.set(pt.x, pt.y + 0.36, pt.z);
    lid.mesh.rotation.copy(held.mesh.rotation);
    lid.isMoved = true;
    ctx.pendingMovedItems[lid.id] = {
      id: lid.id, x: lid.mesh.position.x, y: lid.mesh.position.y, z: lid.mesh.position.z, ry: lid.mesh.rotation.y
    };
    ctx.recentlyDropped[lid.id] = dropTs;
  }
  for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
    if (ctx.cookerPots[cpi].potItem === held) {
      ctx.cookerPots[cpi].contents.forEach(function (cItem, cIdx) {
        const ox = (cIdx % 2 === 0 ? -0.06 : 0.06);
        const oz = (cIdx < 2 ? -0.05 : 0.05);
        cItem.mesh.position.set(pt.x + ox, pt.y + 0.045, pt.z + oz);
        cItem.isMoved = true;
        ctx.pendingMovedItems[cItem.id] = {
          id: cItem.id, x: cItem.mesh.position.x, y: cItem.mesh.position.y, z: cItem.mesh.position.z, ry: cItem.mesh.rotation.y
        };
        ctx.recentlyDropped[cItem.id] = dropTs;
      });
      break;
    }
  }
  if (held.trayContents && held.trayContents.length) {
    const cRy = Math.cos(ctx.heldRotY), sRy = Math.sin(ctx.heldRotY);
    held.trayContents.forEach(function (tc) {
      const ci = tc.item;
      if (!ci || !ci.mesh) return;
      const wx = pt.x + tc.lx * cRy + tc.lz * sRy;
      const wz = pt.z - tc.lx * sRy + tc.lz * cRy;
      const wy = pt.y + tc.ly;
      ci.mesh.position.set(wx, wy, wz);
      ci.mesh.rotation.set(0, ctx.heldRotY + tc.lry, 0);
      ci.isMoved = true;
      if (ci.mesh.userData.updateBounds) ci.mesh.userData.updateBounds(ci);
      ctx.pendingMovedItems[ci.id] = {
        id: ci.id, x: ci.mesh.position.x, y: ci.mesh.position.y, z: ci.mesh.position.z, ry: ci.mesh.rotation.y
      };
      ctx.recentlyDropped[ci.id] = dropTs;
    });
    held.trayContents = null;
  }
  setHeldTwoHandedGhost(held, false);
  ctx.heldItem = null;
  ctx.thermoLaserOn = false;
  if (ctx.placementGhost) ctx.placementGhost.visible = false;
  if (ctx.thermoLaserLine) ctx.thermoLaserLine.visible = false;
  if (ctx.thermoLaserDot) ctx.thermoLaserDot.visible = false;
  if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
  ctx.notifyWorldAction();
}

export function handlePrimaryAction(ctx) {
  if (ctx.heldItem) {
    if (performance.now() - ctx.lastPickupAt < 140) return;
    if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isThermometer) {
      ctx.thermoLaserOn = !ctx.thermoLaserOn;
      if (window.MycoAudio && window.MycoAudio.playLaserBeep) {
        window.MycoAudio.playLaserBeep();
      }
      drawThermoScreen(ctx.thermoCurrentTemp, ctx.thermoLaserOn ? 'SCAN' : 'HOLD', true);
      return;
    }
    if (ctx.hoveredBoardHit && getHeldBoardToolColor(ctx.heldItem)) {
      const boardToolCol = getHeldBoardToolColor(ctx.heldItem);
      const brd = ctx.chalkboards[ctx.hoveredBoardIndex];
      if (boardToolCol && brd && ctx.hoveredBoardHit.uv) {
        const tapPx = Math.round(ctx.hoveredBoardHit.uv.x * 512 * 10) / 10;
        const tapPy = Math.round((1 - ctx.hoveredBoardHit.uv.y) * 256 * 10) / 10;
        const tapPt = [tapPx, tapPy];
        drawBoardSegment(brd.ctx, boardToolCol, tapPt, tapPt);
        brd.tex.needsUpdate = true;
        ctx.pendingBoardStrokes.push({
          b: ctx.hoveredBoardIndex,
          c: boardToolCol,
          pts: [tapPt, [tapPt[0] + 0.1, tapPt[1]]]
        });
      }
      return;
    }
    if (ctx.hoveredPotInsert && ctx.heldItem && !ctx.heldItem.mesh.userData.twoHanded) {
      const potP = ctx.hoveredPotInsert.potItem.mesh.position;
      const slotIdx = ctx.hoveredPotInsert.contents.length;
      const ox = (slotIdx % 2 === 0 ? -0.06 : 0.06);
      const oz = (slotIdx < 2 ? -0.05 : 0.05);
      ctx.heldItem.mesh.position.set(potP.x + ox, potP.y + 0.045, potP.z + oz);
      ctx.heldItem.mesh.rotation.set(0, ctx.heldRotY, 0);
      ctx.heldItem.isMoved = true;
      if (ctx.hoveredPotInsert.contents.indexOf(ctx.heldItem) === -1) ctx.hoveredPotInsert.contents.push(ctx.heldItem);
      ctx.pendingMovedItems[ctx.heldItem.id] = {
        id: ctx.heldItem.id, x: ctx.heldItem.mesh.position.x, y: ctx.heldItem.mesh.position.y, z: ctx.heldItem.mesh.position.z, ry: ctx.heldItem.mesh.rotation.y
      };
      ctx.recentlyDropped[ctx.heldItem.id] = performance.now() + 15000;
      if (ctx.heldItem.lidItem && ctx.heldItem.lidItem.isAttached) {
        ctx.recentlyDropped[ctx.heldItem.lidItem.id] = performance.now() + 15000;
      }
      ctx.heldItem = null;
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
      if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('cooker_heat');
      ctx.notifyWorldAction();
      return;
    }
    if (ctx.hoveredSprayTarget && ctx.heldItem.mesh.userData.isAlcoholSpray) {
      if (window.MycoAudio) window.MycoAudio.playSpray();
      const nowMs = performance.now();
      if (ctx.hoveredSprayTarget === 'hood') {
        ctx.hoodSanitizedUntil = nowMs + 90000;
        if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('sanitize_hood');
      } else {
        ctx.hoveredSprayTarget.sanitizedUntil = nowMs + 90000;
      }
      const spCount = 24;
      const spArr = new Float32Array(spCount * 3);
      const spOrigin = new THREE.Vector3(0.24, -0.14, -0.52).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
      const spDir = new THREE.Vector3(0, 0, -1).applyEuler(ctx.camera.rotation);
      for (let si = 0; si < spCount; si++) {
        spArr[si * 3] = spOrigin.x + (Math.random() - 0.5) * 0.14;
        spArr[si * 3 + 1] = spOrigin.y + (Math.random() - 0.5) * 0.14;
        spArr[si * 3 + 2] = spOrigin.z + (Math.random() - 0.5) * 0.14;
      }
      const spGeo = new THREE.BufferGeometry();
      const spAttr = new THREE.BufferAttribute(spArr, 3);
      spGeo.setAttribute('position', spAttr);
      const spMat = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.035, transparent: true, opacity: 0.85 });
      const spPts = new THREE.Points(spGeo, spMat);
      ctx.scene.add(spPts);
      ctx.sprayBursts.push({ pts: spPts, mat: spMat, attr: spAttr, dir: spDir, age: 0 });
      return;
    }
    if (ctx.hoveredSyringeTarget && ctx.heldItem.mesh.userData.isSyringe) {
      const syrCtrl = ctx.heldItem.mesh.userData.syrCtrl;
      const tgt = ctx.hoveredSyringeTarget;
      if (ctx.syringePumping) return;
      const fromVol = syrCtrl.volMl;
      let toVol;
      if (tgt.mode === 'draw') toVol = 10;
      else toVol = 0;
      if (fromVol >= 9.9) toVol = 0;
      else if (fromVol <= 0.1) toVol = 10;
      else toVol = (fromVol >= 5 ? 0 : 10);

      ctx.syringePumping = {
        target: tgt,
        fromVol: fromVol,
        toVol: toVol,
        duration: 2.0,
        elapsed: 0,
        startJarVol: (tgt.item && tgt.item.mesh && tgt.item.mesh.userData.liquidCtrl) ? tgt.item.mesh.userData.liquidCtrl.volMl : 0
      };
      return;
    }
    if (ctx.hoveredSink) {
      let filledSomething = false;
      if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
        const lc = ctx.heldItem.mesh.userData.liquidCtrl;
        const addAmt = lc.maxMl >= 4000 ? 1000 : (lc.maxMl >= 500 ? 250 : lc.maxMl);
        if (lc.volMl < lc.maxMl) {
          updateContainerVolume(ctx.heldItem, Math.min(lc.maxMl, lc.volMl + addAmt));
          filledSomething = true;
        }
      } else {
        for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
          const cp = ctx.cookerPots[cpi];
          if (cp.potItem === ctx.heldItem && cp.waterMl < cp.maxWaterMl) {
            cp.waterMl = Math.min(cp.maxWaterMl, cp.waterMl + 1000);
            updateCookerWaterVisual(cp);
            filledSomething = true;
            break;
          }
        }
      }
      if (filledSomething) {
        triggerSinkStream(ctx.hoveredSink, 900);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      } else if (ctx.callbacks.onToast) {
        ctx.callbacks.onToast('💧 Recipiente já está cheio!');
      }
      return;
    }
    if (ctx.hoveredFillPot && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
      const srcLc = ctx.heldItem.mesh.userData.liquidCtrl;
      const cp = ctx.hoveredFillPot;
      const pourAmt = Math.min(srcLc.volMl, 500, cp.maxWaterMl - cp.waterMl);
      if (pourAmt > 0) {
        updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
        cp.waterMl += pourAmt;
        updateCookerWaterVisual(cp);
        if (window.MycoAudio) window.MycoAudio.playSpray();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      }
      return;
    }
    if (ctx.hoveredPourTarget && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl) {
      const srcLc = ctx.heldItem.mesh.userData.liquidCtrl;
      const dstItem = ctx.hoveredPourTarget;
      const dstLc = dstItem.mesh && dstItem.mesh.userData.liquidCtrl;
      if (dstLc) {
        const stepAmt = dstLc.maxMl <= 50 ? 15 : 250;
        const pourAmt = Math.min(srcLc.volMl, stepAmt, dstLc.maxMl - dstLc.volMl);
        if (pourAmt > 0) {
          updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
          updateContainerVolume(dstItem, dstLc.volMl + pourAmt);
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        }
      } else if (dstItem.spawnCtrl && dstItem.spawnCtrl.isPP5 && dstItem.spawnCtrl.filled && (dstItem.spawnCtrl.waterMl || 0) < 35) {
        const pourAmt = Math.min(srcLc.volMl, 35 - (dstItem.spawnCtrl.waterMl || 0));
        if (pourAmt > 0) {
          updateContainerVolume(ctx.heldItem, srcLc.volMl - pourAmt);
          dstItem.spawnCtrl.waterMl = (dstItem.spawnCtrl.waterMl || 0) + pourAmt;
          dstItem.spawnCtrl.updateVisual();
          if (window.MycoAudio) window.MycoAudio.playSpray();
          if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        }
      }
      return;
    }
    if (ctx.hoveredFlocaoTarget && ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isFlocao) {
      const ppSc = ctx.hoveredFlocaoTarget.spawnCtrl;
      if (ppSc && !ppSc.filled) {
        ppSc.filled = true;
        ppSc.fillGrams = 45;
        ppSc.baseLabel = 'Potinho PP5 145ml (Flocão)';
        if (ppSc.fillMesh) ppSc.fillMesh.visible = true;
        ppSc.updateVisual();
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌽 45g de Flocão colocados no Potinho PP5! Adicione água e esterilize por 1h20m.');
      }
      return;
    }
    if (ctx.hoveredScalpelTarget && ctx.heldItem.scalpelCtrl) {
      const sc = ctx.heldItem.scalpelCtrl;
      const tgt = ctx.hoveredScalpelTarget;
      if (tgt.mode === 'blade') {
        sc.hasBlade = true;
        sc.sterile = true;
        sc.hasMycelium = false;
        if (sc.bladeMesh) sc.bladeMesh.visible = true;
        updateScalpelLabel(ctx.heldItem);
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🔪 Lâmina estéril #24 encaixada no bisturi!');
      } else if (tgt.mode === 'cut') {
        sc.hasMycelium = true;
        updateScalpelLabel(ctx.heldItem);
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🔪 Fragmento de micélio coletado! Leve até um potinho PP5 estéril.');
      } else if (tgt.mode === 'transfer' && tgt.item && tgt.item.spawnCtrl) {
        const dstSc = tgt.item.spawnCtrl;
        const isAseptic = !!(ctx.hoodAirData && ctx.hoodAirData.on && performance.now() < ctx.hoodSanitizedUntil);
        dstSc.inoculated = true;
        if (!sc.sterile || !dstSc.sterilized || (!isAseptic && Math.random() < 0.45)) {
          dstSc.contaminated = true;
          if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Contaminação na transferência! Use lâmina estéril, substrato esterilizado (1h20m) e Fluxo Laminar higienizado!');
        } else if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('🍄 Micélio transferido com sucesso para ' + dstSc.baseLabel + '!');
        }
        dstSc.updateVisual();
        sc.hasMycelium = false;
        sc.sterile = false;
        updateScalpelLabel(ctx.heldItem);
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      }
      return;
    }
    if (ctx.hoveredGrainTarget && ctx.heldItem.id.indexOf('substrate_') === 0) {
      const kind = ctx.heldItem.id.indexOf('grain') !== -1 ? 'grain' : 'sawdust';
      if (fillSpawnWithSubstrate(ctx.hoveredGrainTarget, kind)) {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🌾 ' + ctx.hoveredGrainTarget.label + ' preenchido!');
      }
      return;
    }
    if (ctx.placementValid && ctx.placementGhost) {
      if (isPlacementBlocked(ctx.entityCtx, ctx.placementGhost.position)) {
        ctx.placementValid = false;
        updatePlacementGhostVisual(ctx.heldItem, false, ctx.heldRotY, ctx.clock.elapsedTime);
        return;
      }
      ctx.heldItem.mesh.position.copy(ctx.placementGhost.position);
      ctx.heldItem.mesh.rotation.set(0, ctx.heldRotY, 0);
      ctx.heldItem.isMoved = true;
      if (ctx.heldItem.potItem && ctx.snapClosePot) {
        ctx.heldItem.isAttached = true;
        ctx.heldItem.potItem = ctx.snapClosePot;
        ctx.snapClosePot.lidItem = ctx.heldItem;
        ctx.heldItem.mesh.position.set(ctx.snapClosePot.mesh.position.x, ctx.snapClosePot.mesh.position.y + 0.36, ctx.snapClosePot.mesh.position.z);
        ctx.heldItem.mesh.rotation.copy(ctx.snapClosePot.mesh.rotation);
        ctx.snapClosePot = null;
      }
      ctx.pendingMovedItems[ctx.heldItem.id] = {
        id: ctx.heldItem.id,
        x: ctx.heldItem.mesh.position.x,
        y: ctx.heldItem.mesh.position.y,
        z: ctx.heldItem.mesh.position.z,
        ry: ctx.heldItem.mesh.rotation.y
      };
      if (ctx.heldItem.lidItem && ctx.heldItem.lidItem.isAttached) {
        const attLid = ctx.heldItem.lidItem;
        attLid.mesh.position.set(ctx.heldItem.mesh.position.x, ctx.heldItem.mesh.position.y + 0.36, ctx.heldItem.mesh.position.z);
        attLid.mesh.rotation.copy(ctx.heldItem.mesh.rotation);
        attLid.isMoved = true;
        ctx.pendingMovedItems[attLid.id] = {
          id: attLid.id, x: attLid.mesh.position.x, y: attLid.mesh.position.y, z: attLid.mesh.position.z, ry: attLid.mesh.rotation.y
        };
        ctx.recentlyDropped[attLid.id] = performance.now() + 15000;
      }
      for (let cpiDrop = 0; cpiDrop < ctx.cookerPots.length; cpiDrop++) {
        const cpDrop = ctx.cookerPots[cpiDrop];
        if (cpDrop.potItem === ctx.heldItem && cpDrop.contents.length > 0) {
          for (let ciDrop = 0; ciDrop < cpDrop.contents.length; ciDrop++) {
            const cItem = cpDrop.contents[ciDrop];
            if (!cItem || !cItem.mesh) continue;
            const cox = (ciDrop % 2 === 0 ? -0.06 : 0.06);
            const coz = (ciDrop < 2 ? -0.05 : 0.05);
            cItem.mesh.position.set(ctx.heldItem.mesh.position.x + cox, ctx.heldItem.mesh.position.y + 0.045, ctx.heldItem.mesh.position.z + coz);
            cItem.isMoved = true;
            ctx.pendingMovedItems[cItem.id] = {
              id: cItem.id, x: cItem.mesh.position.x, y: cItem.mesh.position.y, z: cItem.mesh.position.z, ry: cItem.mesh.rotation.y
            };
            ctx.recentlyDropped[cItem.id] = performance.now() + 15000;
          }
        }
      }
      ctx.recentlyDropped[ctx.heldItem.id] = performance.now() + 15000;
      if (ctx.heldItem.trayContents && ctx.heldItem.trayContents.length) {
        const cRy = Math.cos(ctx.heldRotY), sRy = Math.sin(ctx.heldRotY);
        const dropPt = ctx.heldItem.mesh.position;
        ctx.heldItem.trayContents.forEach(function (tc) {
          const ci = tc.item;
          if (!ci || !ci.mesh) return;
          ci.mesh.position.set(
            dropPt.x + tc.lx * cRy + tc.lz * sRy,
            dropPt.y + tc.ly,
            dropPt.z - tc.lx * sRy + tc.lz * cRy
          );
          ci.mesh.rotation.set(0, ctx.heldRotY + tc.lry, 0);
          ci.isMoved = true;
          if (ci.mesh.userData.updateBounds) ci.mesh.userData.updateBounds(ci);
          ctx.pendingMovedItems[ci.id] = {
            id: ci.id, x: ci.mesh.position.x, y: ci.mesh.position.y, z: ci.mesh.position.z, ry: ci.mesh.rotation.y
          };
          ctx.recentlyDropped[ci.id] = performance.now() + 15000;
        });
        ctx.heldItem.trayContents = null;
      }
      setHeldTwoHandedGhost(ctx.heldItem, false);
      ctx.heldItem = null;
      ctx.placementGhost.visible = false;
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);
      ctx.notifyWorldAction();
    }
    return;
  }
  if (ctx.hoveredGreenhouseSlot) {
    ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
    return;
  }
  if (ctx.hoveredMushroom && ctx.hoveredMushroom.active) {
    ctx.hoveredMushroom.active = false;
    ctx.hoveredMushroom.group.visible = false;
    ctx.hoveredMushroom.respawnAt = performance.now() + 20000;
    ctx.queueWorldStateChange(ctx.hoveredMushroom.id, 0);
    if (window.MycoAudio) window.MycoAudio.playHarvest();
    if (ctx.callbacks.onHarvestMushroom) ctx.callbacks.onHarvestMushroom(ctx.hoveredMushroom.id);
    return;
  }
  if (ctx.hoveredDoorObj) {
    ctx.hoveredDoorObj.open = !ctx.hoveredDoorObj.open;
    ctx.queueWorldStateChange(ctx.hoveredDoorObj.id, ctx.hoveredDoorObj.open ? 1 : 0);
    if (window.MycoAudio) window.MycoAudio.playDoor(ctx.hoveredDoorObj.open);
    return;
  }
  if (ctx.hoveredBlindObj) {
    ctx.hoveredBlindObj.open = !ctx.hoveredBlindObj.open;
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange(ctx.hoveredBlindObj.id, ctx.hoveredBlindObj.open ? 1 : 0);
    return;
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
    return;
  }
  if (ctx.hoveredRankBtn) {
    scrollRanking(ctx.hoveredRankBtn);
    return;
  }
  if (ctx.hoveredSeat) {
    if (isSeatOccupied(ctx.remoteAvatars, ctx.hoveredSeat)) return;
    ctx.seatedSeat = ctx.hoveredSeat;
    ctx.playerPos.set(ctx.seatedSeat.x, ctx.seatedSeat.y, ctx.seatedSeat.z);
    ctx.playerYaw = ctx.seatedSeat.yaw;
    if (ctx.playerPitch < -0.06) ctx.playerPitch = -0.02;
    ctx.playerVelX = 0; ctx.playerVelZ = 0; ctx.playerVelY = 0;
    ctx.notifyWorldAction();
    return;
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
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    ctx.queueWorldStateChange(ctx.hoveredSwitch.id, ctx.hoveredSwitch.on ? 1 : 0);
    return;
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
    return;
  }
  if (ctx.hoveredStirSwitch) {
    ctx.hoveredStirSwitch.on = !ctx.hoveredStirSwitch.on;
    ctx.hoveredStirSwitch.ledMat.color.setHex(ctx.hoveredStirSwitch.on ? 0x22c55e : 0xef4444);
    ctx.queueWorldStateChange('stir_lab', ctx.hoveredStirSwitch.on ? 1 : 0);
    return;
  }
  if (ctx.hoveredScaleTare) {
    ctx.hoveredScaleTare.tare = ctx.hoveredScaleTare.lastGross || 0;
    ctx.hoveredScaleTare.draw(0);
    return;
  }
  if (ctx.hoveredBurnerSwitch) {
    const nextLvl = ((ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0)) + 1) % 4;
    setBurnerLevel(ctx.hoveredBurnerSwitch, nextLvl);
    if (window.MycoAudio) window.MycoAudio.playSwitch();
    if (ctx.hoveredBurnerSwitch.id === 'burner_lab') {
      ctx.queueWorldStateChange('burner_lab', ctx.hoveredBurnerSwitch.on ? 1 : 0);
    }
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🔥 ' + (ctx.hoveredBurnerSwitch.kind === 'gas_tripod' ? 'Tripé a Gás' : 'Fogareiro') + ': ' + BURNER_LEVEL_NAMES[nextLvl]);
    }
    if (ctx.hoveredBurnerSwitch.on && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('cooker_heat');
    return;
  }
  if (ctx.hoveredPickable) {
    if (ctx.hoveredPickable.mesh.userData.isBlockedPickup && ctx.hoveredPickable.mesh.userData.isBlockedPickup(ctx.hoveredPickable)) {
      return;
    }
    if (ctx.hoveredPickable.potItem && ctx.hoveredPickable.isAttached) {
      for (let cpLockIdx = 0; cpLockIdx < ctx.cookerPots.length; cpLockIdx++) {
        const cpLock = ctx.cookerPots[cpLockIdx];
        if (cpLock.lidItem === ctx.hoveredPickable && cpLock.psi >= 1.5) {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('🔒 Tampa travada pela pressão (' + cpLock.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar (< 1.5 PSI).');
          }
          return;
        }
      }
      const lidIt = ctx.hoveredPickable;
      lidIt.isAttached = false;
      ctx.heldItem = lidIt;
      ctx.lastPickupAt = performance.now();
      setHeldTwoHandedGhost(ctx.heldItem, false);
      if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
      ctx.notifyWorldAction();
      return;
    }
    if (ctx.hoveredPickable.lidItem) {
      for (let cpPotIdx = 0; cpPotIdx < ctx.cookerPots.length; cpPotIdx++) {
        const cpPot = ctx.cookerPots[cpPotIdx];
        if (cpPot.potItem === ctx.hoveredPickable && cpPot.psi >= 1.5) {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (ctx.callbacks.onToast) {
            ctx.callbacks.onToast('🔒 Panela pressurizada (' + cpPot.psi.toFixed(1) + ' PSI)! Desligue o fogareiro e aguarde despressurizar.');
          }
          return;
        }
      }
    }
    for (let cpIdx = 0; cpIdx < ctx.cookerPots.length; cpIdx++) {
      const idxInPot = ctx.cookerPots[cpIdx].contents.indexOf(ctx.hoveredPickable);
      if (idxInPot !== -1) ctx.cookerPots[cpIdx].contents.splice(idxInPot, 1);
    }
    ctx.hoveredPickable.trayContents = null;
    if (ctx.hoveredPickable.mesh && ctx.hoveredPickable.mesh.userData.isTray && ctx.hoveredPickable.mesh.userData.dynamicSurface) {
      const tSurf = ctx.hoveredPickable.mesh.userData.dynamicSurface;
      const tPos = ctx.hoveredPickable.mesh.position;
      const tRy = ctx.hoveredPickable.mesh.rotation.y;
      const cT = Math.cos(-tRy), sT = Math.sin(-tRy);
      const carried = [];
      for (let ti = 0; ti < ctx.pickableItems.length; ti++) {
        const cand = ctx.pickableItems[ti];
        if (!cand || cand === ctx.hoveredPickable || !cand.mesh || ctx.isHeldByRemote(cand.id)) continue;
        if (cand.mesh.userData.isTable || cand.mesh.userData.isHood || cand.mesh.userData.isTray) continue;
        const cp = cand.mesh.position;
        if (cp.x >= tSurf.minX - 0.04 && cp.x <= tSurf.maxX + 0.04 &&
          cp.z >= tSurf.minZ - 0.04 && cp.z <= tSurf.maxZ + 0.04 &&
          cp.y >= tSurf.topY - 0.04 && cp.y <= tSurf.topY + 0.35) {
          const dx = cp.x - tPos.x, dz = cp.z - tPos.z;
          carried.push({
            item: cand,
            lx: dx * cT + dz * sT,
            ly: cp.y - tPos.y,
            lz: -dx * sT + dz * cT,
            lry: cand.mesh.rotation.y - tRy
          });
        }
      }
      if (carried.length) ctx.hoveredPickable.trayContents = carried;
    }
    ctx.heldItem = ctx.hoveredPickable;
    ctx.lastPickupAt = performance.now();
    ctx.heldRotY = ctx.heldItem.mesh.rotation.y;
    setHeldTwoHandedGhost(ctx.heldItem, true);
    if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(ctx.heldItem.label);
    ctx.notifyWorldAction();
  }
}

export function updateHoverRay(ctx, customNdc) {
  ctx.hoveredPickable = null;
  ctx.hoveredMushroom = null;
  ctx.hoveredDoorObj = null;
  ctx.hoveredBlindObj = null;
  ctx.hoveredBoardHit = null;
  ctx.hoveredCinema = false;
  ctx.hoveredCinemaUv = null;
  ctx.hoveredRankBtn = null;
  ctx.hoveredSeat = null;
  ctx.hoveredSwitch = null;
  ctx.hoveredHoodSwitch = null;
  ctx.hoveredStirSwitch = null;
  ctx.hoveredSyringeTarget = null;
  ctx.hoveredScaleTare = null;
  ctx.hoveredBurnerSwitch = null;
  ctx.hoveredPotInsert = null;
  ctx.hoveredSprayTarget = null;
  ctx.hoveredSink = null;
  ctx.hoveredPourTarget = null;
  ctx.hoveredFillPot = null;
  ctx.hoveredGrainTarget = null;
  ctx.hoveredFlocaoTarget = null;
  ctx.hoveredScalpelTarget = null;
  let prompt = '';

  const rayNdc = customNdc || (ctx.inFps ? _vZero2 : ctx.pointerNdc);
  ctx.raycaster.setFromCamera(rayNdc, ctx.camera);

  if (ctx.heldItem) {
    const toolCol = getHeldBoardToolColor(ctx.heldItem);
    if (toolCol && ctx.chalkboardMeshes.length) {
      const bHits = ctx.raycaster.intersectObjects(ctx.chalkboardMeshes, false);
      if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
        ctx.hoveredBoardHit = bHits[0];
        ctx.hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
        if (ctx.placementGhost) ctx.placementGhost.visible = false;
        const touchUi = ctx.isTouchDevice();
        prompt = toolCol === 'erase'
          ? (touchUi ? '🧽 Arraste na lousa para apagar' : '🧽 Segure o clique para apagar a lousa')
          : (touchUi ? '✏️ Arraste na lousa para escrever' : '✏️ Segure o clique para escrever na lousa');
        if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
        return;
      }
    }
    if (ctx.heldItem.mesh.userData.isAlcoholSpray) {
      const spRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const spRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let ai = 0; ai < ctx.pickableItems.length; ai++) {
        const aCand = ctx.pickableItems[ai];
        if (aCand === ctx.heldItem || ctx.isHeldByRemote(aCand.id)) continue;
        const adx = aCand.mesh.position.x - spRefX, adz = aCand.mesh.position.z - spRefZ;
        if (adx * adx + adz * adz > 100) continue;
        const aHit = firstValidRayHit(ctx.raycaster.intersectObject(aCand.mesh, true));
        if (aHit && aHit.distance < 3.5) {
          ctx.hoveredSprayTarget = aCand.mesh.userData.isHood ? 'hood' : aCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🧴 Borrifar Álcool 70% (' + aCand.label + ')');
          return;
        }
      }
    }
    if (canItemEnterCooker(ctx.heldItem)) {
      for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
        const cp = ctx.cookerPots[ci];
        if (cp.lidItem.isAttached || cp.contents.length >= 6) continue;
        const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
        if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
          ctx.hoveredPotInsert = cp;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🍲 Colocar ' + ctx.heldItem.label + ' dentro da Panela');
          return;
        }
      }
    }
    if (ctx.labSinkMeshes && ctx.labSinkMeshes.length) {
      const isPotHeld = ctx.cookerPots.some((cp) => cp.potItem === ctx.heldItem && !cp.lidItem.isAttached);
      const isLiquidHeld = !!(ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl);
      if (isPotHeld || isLiquidHeld) {
        const sHits = ctx.raycaster.intersectObjects(ctx.labSinkMeshes, false);
        if (sHits.length > 0 && sHits[0].distance < 3.5) {
          ctx.hoveredSink = sHits[0].object.userData.labSink;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🚰 Encher ' + ctx.heldItem.label + ' com água na Pia');
          return;
        }
      }
    }
    if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.liquidCtrl && ctx.heldItem.mesh.userData.liquidCtrl.volMl > 0) {
      for (let ci = 0; ci < ctx.cookerPots.length; ci++) {
        const cp = ctx.cookerPots[ci];
        if (cp.lidItem.isAttached || cp.waterMl >= cp.maxWaterMl) continue;
        const cpHits = ctx.raycaster.intersectObject(cp.potItem.mesh, true);
        if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
          ctx.hoveredFillPot = cp;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) {
            ctx.callbacks.onHoverPrompt('💧 Despejar água na Panela (' + (cp.waterMl / 1000).toFixed(1) + 'L / 20L)');
          }
          return;
        }
      }
      const pRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const pRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let pi = 0; pi < ctx.pickableItems.length; pi++) {
        const pCand = ctx.pickableItems[pi];
        if (pCand === ctx.heldItem || ctx.isHeldByRemote(pCand.id)) continue;
        const isPourableLc = !!(pCand.mesh && pCand.mesh.userData.liquidCtrl && pCand.mesh.userData.liquidCtrl.volMl < pCand.mesh.userData.liquidCtrl.maxMl);
        const isPourablePP5 = !!(pCand.spawnCtrl && pCand.spawnCtrl.isPP5 && pCand.spawnCtrl.filled && (pCand.spawnCtrl.waterMl || 0) < 35);
        if (!isPourableLc && !isPourablePP5) continue;
        const pdx = pCand.mesh.position.x - pRefX, pdz = pCand.mesh.position.z - pRefZ;
        if (pdx * pdx + pdz * pdz > 100) continue;
        const pHit = firstValidRayHit(ctx.raycaster.intersectObject(pCand.mesh, true));
        if (pHit && pHit.distance < 3.5) {
          ctx.hoveredPourTarget = pCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💧 Umedecer / Despejar água em ' + pCand.label);
          return;
        }
      }
    }
    if (ctx.heldItem.mesh && ctx.heldItem.mesh.userData.isFlocao) {
      const fRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const fRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let fi = 0; fi < ctx.pickableItems.length; fi++) {
        const fCand = ctx.pickableItems[fi];
        if (!fCand.spawnCtrl || !fCand.spawnCtrl.isPP5 || fCand.spawnCtrl.filled || ctx.isHeldByRemote(fCand.id)) continue;
        const fdx = fCand.mesh.position.x - fRefX, fdz = fCand.mesh.position.z - fRefZ;
        if (fdx * fdx + fdz * fdz > 100) continue;
        const fHit = firstValidRayHit(ctx.raycaster.intersectObject(fCand.mesh, true));
        if (fHit && fHit.distance < 3.5) {
          ctx.hoveredFlocaoTarget = fCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🌽 Colocar 45g de Flocão em ' + fCand.label);
          return;
        }
      }
    }
    if (ctx.heldItem.scalpelCtrl) {
      const sc = ctx.heldItem.scalpelCtrl;
      const sRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const sRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let si = 0; si < ctx.pickableItems.length; si++) {
        const sCand = ctx.pickableItems[si];
        if (sCand === ctx.heldItem || ctx.isHeldByRemote(sCand.id)) continue;
        const sdx = sCand.mesh.position.x - sRefX, sdz = sCand.mesh.position.z - sRefZ;
        if (sdx * sdx + sdz * sdz > 100) continue;
        const sHit = firstValidRayHit(ctx.raycaster.intersectObject(sCand.mesh, true));
        if (sHit && sHit.distance < 3.5) {
          if (sCand.mesh.userData.isScalpelBladePack) {
            ctx.hoveredScalpelTarget = { mode: 'blade', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🔪 Trocar por lâmina #24 estéril');
            return;
          }
          if (!sc.hasMycelium && (sCand.id === 'petri_clean' || (sCand.spawnCtrl && sCand.spawnCtrl.colonization >= 60))) {
            ctx.hoveredScalpelTarget = { mode: 'cut', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🔪 Cortar fragmento de micélio (' + sCand.label + ')');
            return;
          }
          if (sc.hasMycelium && sCand.spawnCtrl && sCand.spawnCtrl.filled && !sCand.spawnCtrl.inoculated) {
            ctx.hoveredScalpelTarget = { mode: 'transfer', item: sCand };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🍄 Transferir micélio para ' + sCand.label);
            return;
          }
        }
      }
    }
    if (ctx.heldItem.id.indexOf('substrate_') === 0) {
      const gRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const gRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let gi = 0; gi < ctx.pickableItems.length; gi++) {
        const gCand = ctx.pickableItems[gi];
        if (!gCand.spawnCtrl || gCand.spawnCtrl.filled || ctx.isHeldByRemote(gCand.id)) continue;
        const gdx = gCand.mesh.position.x - gRefX, gdz = gCand.mesh.position.z - gRefZ;
        if (gdx * gdx + gdz * gdz > 100) continue;
        const gHit = firstValidRayHit(ctx.raycaster.intersectObject(gCand.mesh, true));
        if (gHit && gHit.distance < 3.5) {
          ctx.hoveredGrainTarget = gCand;
          if (ctx.placementGhost) ctx.placementGhost.visible = false;
          if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('🌾 Encher ' + gCand.label + ' com grãos/substrato');
          return;
        }
      }
    }
    if (ctx.heldItem.mesh.userData.isSyringe) {
      const sc = ctx.heldItem.mesh.userData.syrCtrl;
      const syRefX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
      const syRefZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
      for (let si = 0; si < ctx.pickableItems.length; si++) {
        const cand = ctx.pickableItems[si];
        if (cand === ctx.heldItem || ctx.isHeldByRemote(cand.id)) continue;
        const sydx = cand.mesh.position.x - syRefX, sydz = cand.mesh.position.z - syRefZ;
        if (sydx * sydx + sydz * sydz > 100) continue;
        const sHit = firstValidRayHit(ctx.raycaster.intersectObject(cand.mesh, true));
        if (sHit && sHit.distance < 4.2) {
          if (cand.mesh.userData.liquidCtrl) {
            const lc = cand.mesh.userData.liquidCtrl;
            if (ctx.syringePumping) {
              ctx.hoveredSyringeTarget = { item: cand, mode: ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'draw' : 'inject' };
              if (ctx.placementGhost) ctx.placementGhost.visible = false;
              const pPct = Math.round((ctx.syringePumping.elapsed / ctx.syringePumping.duration) * 100);
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('⏳ ' + (ctx.syringePumping.toVol > ctx.syringePumping.fromVol ? 'Aspirando Micélio' : 'Injetando de volta') + ' (' + pPct + '%)...');
              return;
            }
            if (sc.volMl < 9.9 && lc.volMl > 0) {
              ctx.hoveredSyringeTarget = { item: cand, mode: 'draw' };
              if (ctx.placementGhost) ctx.placementGhost.visible = false;
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💉 Furando Septo • Clique para aspirar cultura líquida (2s)');
              return;
            } else if (sc.volMl > 0.1) {
              ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
              if (ctx.placementGhost) ctx.placementGhost.visible = false;
              if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💉 Seringa cheia (' + Math.round(sc.volMl) + 'ml) • Clique para esvaziar de volta (2s)');
              return;
            }
          } else if (sc.volMl > 0 && canSyringeTarget(cand)) {
            ctx.hoveredSyringeTarget = { item: cand, mode: 'inject' };
            if (ctx.placementGhost) ctx.placementGhost.visible = false;
            if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt('💉 Inocular ' + Math.round(sc.volMl) + 'ml em ' + cand.label + ' (2s)');
            return;
          }
        }
      }
    }
    if (ctx.heldItem.mesh.userData.isThermometer) {
      if (ctx.placementGhost) ctx.placementGhost.visible = false;
      if (ctx.thermoLaserOn) {
        prompt = '🔴 [SCAN] ' + (ctx.thermoTargetLabel || 'Ambiente') + ': ' + ctx.thermoCurrentTemp.toFixed(1) + '°C (Clique: Desligar Laser • Tecla G ou clique dir.: Soltar)';
      } else {
        prompt = '🔫 Laser DESLIGADO • Última: ' + ctx.thermoCurrentTemp.toFixed(1) + '°C [HOLD] (Clique: Ligar Laser • Tecla G ou clique dir.: Soltar)';
      }
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
    const pt = findPlacementTarget(ctx.entityCtx, rayNdc);
    ctx.placementValid = !isPlacementBlocked(ctx.entityCtx, pt);
    ctx.placementGhost.position.copy(pt);
    updatePlacementGhostVisual(ctx.heldItem, ctx.placementValid, ctx.heldRotY, ctx.clock.elapsedTime);
    ctx.placementGhost.visible = true;
    if (ctx.snapClosePot) {
      prompt = '🍲 Fechar tampa na Panela de Pressão';
    } else {
      prompt = ctx.placementValid ? 'Soltar: ' + ctx.heldItem.label : (getPlacementBlockedReason() || '🚫 Local bloqueado (espaço ocupado)');
    }
    if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
    return;
  }
  if (ctx.placementGhost) ctx.placementGhost.visible = false;

  if (ctx.rankingBtnMeshes.length) {
    const rHits = ctx.raycaster.intersectObjects(ctx.rankingBtnMeshes, false);
    if (rHits.length > 0 && rHits[0].distance < 18) {
      ctx.hoveredRankBtn = rHits[0].object.userData.rankAction;
      prompt = ctx.hoveredRankBtn === 'up' ? '▲ Subir Ranking' : '▼ Descer Ranking';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.cinemaScreenMesh) {
    const cHits = ctx.raycaster.intersectObject(ctx.cinemaScreenMesh, false);
    if (cHits.length > 0 && cHits[0].distance < 22) {
      ctx.hoveredCinema = true;
      ctx.hoveredCinemaUv = cHits[0].uv ? { x: cHits[0].uv.x, y: 1 - cHits[0].uv.y } : { x: 0.5, y: 0.5 };
      const cTarget = ctx.getCinemaHitTarget(ctx.hoveredCinemaUv);
      if (cTarget.type !== ctx.lastCinemaHoverType || (cTarget.idx || -1) !== ctx.lastCinemaHoverIdx) {
        ctx.lastCinemaHoverType = cTarget.type;
        ctx.lastCinemaHoverIdx = cTarget.idx !== undefined ? cTarget.idx : -1;
        ctx.cinemaDirty = true;
      }
      if (cTarget.type === 'power_on') prompt = '⏻ Clique na tela para ligar o Auditório';
      else if (cTarget.type === 'power_off') prompt = '⏻ Desligar tela do Auditório';
      else if (cTarget.type === 'menu') prompt = '📋 Voltar ao menu de módulos';
      else if (cTarget.type === 'lesson') prompt = '▶️ Assistir: ' + ((ctx.cinemaLessons[cTarget.idx] && ctx.cinemaLessons[cTarget.idx].title) || 'Aula');
      else if (cTarget.type === 'toggle_play') prompt = ctx.cinemaPlaying ? '⏸️ Clique na aula para pausar' : '▶️ Clique na aula para continuar';
      else prompt = '🎬 Escolha um módulo na tela para assistir';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.scaleTareMeshes.length) {
    const tHits = ctx.raycaster.intersectObjects(ctx.scaleTareMeshes, false);
    if (tHits.length > 0 && tHits[0].distance < 3.5) {
      ctx.hoveredScaleTare = tHits[0].object.userData.scaleObj;
      prompt = '⚖️ Zerar Balança (TARE)';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.burnerSwitchMeshes.length && (!ctx.heldItem || !ctx.heldItem.mesh.userData.isBurner)) {
    const bHits = ctx.raycaster.intersectObjects(ctx.burnerSwitchMeshes, false);
    if (bHits.length > 0 && bHits[0].distance < 4.0) {
      ctx.hoveredBurnerSwitch = ctx.burnerDevices[bHits[0].object.userData.burnerSwitchIdx];
      const curL = ctx.hoveredBurnerSwitch.level || (ctx.hoveredBurnerSwitch.on ? 3 : 0);
      const nxtL = (curL + 1) % 4;
      prompt = '🔥 ' + BURNER_LEVEL_NAMES[curL] + ' → Mudar para ' + BURNER_LEVEL_NAMES[nxtL];
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.stirSwitchMeshes.length && (!ctx.heldItem || !ctx.heldItem.mesh.userData.isStirrer)) {
    const stSwHits = ctx.raycaster.intersectObjects(ctx.stirSwitchMeshes, false);
    if (stSwHits.length > 0 && stSwHits[0].distance < 4.0) {
      ctx.hoveredStirSwitch = stSwHits[0].object.userData.stirSwitch;
      prompt = ctx.hoveredStirSwitch.on ? '🌀 Desligar Agitador Magnético' : '🌀 Ligar Agitador Magnético';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.hoodSwitchMeshes.length) {
    const hsHits = ctx.raycaster.intersectObjects(ctx.hoodSwitchMeshes, false);
    if (hsHits.length > 0 && hsHits[0].distance < 4.0) {
      ctx.hoveredHoodSwitch = hsHits[0].object.userData.hoodSwitch;
      prompt = ctx.hoveredHoodSwitch.on ? '💨 Desligar Fluxo Laminar' : '💨 Ligar Fluxo Laminar';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.lightSwitchMeshes.length) {
    const swHits = ctx.raycaster.intersectObjects(ctx.lightSwitchMeshes, false);
    if (swHits.length > 0 && swHits[0].distance < 4.0) {
      ctx.hoveredSwitch = swHits[0].object.userData.lightSwitch;
      prompt = ctx.hoveredSwitch.on ? '💡 Clique para desligar a luz' : '💡 Clique para ligar a luz';
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (ctx.seatMeshes.length) {
    const stHits = ctx.raycaster.intersectObjects(ctx.seatMeshes, false);
    if (stHits.length > 0 && stHits[0].distance < 4.2) {
      const candSeat = stHits[0].object.userData.seatInfo;
      if (isSeatOccupied(ctx.remoteAvatars, candSeat)) {
        prompt = '🚫 Assento ocupado (sente ao lado!)';
      } else {
        ctx.hoveredSeat = candSeat;
        prompt = '🪑 Clique para sentar';
      }
      if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
      return;
    }
  }

  if (!prompt && ctx.doorHitMeshes.length) {
    const doorHits = ctx.raycaster.intersectObjects(ctx.doorHitMeshes, false);
    if (doorHits.length > 0 && doorHits[0].distance < 5.0) {
      ctx.hoveredDoorObj = doorHits[0].object.userData.doorObj;
      prompt = '🚪 ' + (ctx.hoveredDoorObj.open ? 'Fechar ' : 'Abrir ') + ctx.hoveredDoorObj.label;
    }
  }
  const refX = ctx.inFps ? ctx.playerPos.x : ctx.camera.position.x;
  const refZ = ctx.inFps ? ctx.playerPos.z : ctx.camera.position.z;
  const maxMushSq = ctx.inFps ? 24 : 225;
  const maxPickSq = ctx.inFps ? 26 : 225;
  if (!prompt) {
    for (let m = 0; m < ctx.wildMushrooms.length; m++) {
      const wm = ctx.wildMushrooms[m];
      if (!wm.active) continue;
      const mdx = wm.group.position.x - refX, mdz = wm.group.position.z - refZ;
      if (mdx * mdx + mdz * mdz > maxMushSq) continue;
      const mHits = ctx.raycaster.intersectObject(wm.group, true);
      if (mHits.length > 0 && mHits[0].distance < 4.5) {
        ctx.hoveredMushroom = wm;
        prompt = '🍄 Colher Cogumelo (+25 XP)';
        break;
      }
    }
  }
  if (!prompt) {
    let bestSmall = null, bestSmallDist = Infinity;
    let bestLarge = null, bestLargeDist = Infinity;
    let bestBlocked = null, bestBlockedDist = Infinity;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      let item = ctx.pickableItems[i];
      if (item === ctx.heldItem || (ctx.heldItem && item === ctx.heldItem.lidItem)) continue;
      if (ctx.isHeldByRemote(item.id)) continue;
      const idx = item.mesh.position.x - refX, idz = item.mesh.position.z - refZ;
      if (idx * idx + idz * idz > maxPickSq) continue;
      const hit0 = firstValidRayHit(ctx.raycaster.intersectObject(item.mesh, true));
      if (hit0 && hit0.distance < 4.5) {
        const dHit = hit0.distance;
        if (item.lidItem && item.lidItem.isAttached && hit0.point.y >= item.mesh.position.y + 0.26) {
          item = item.lidItem;
        }
        if (ctx.isItemInsideClosedCooker(item)) continue;
        if (item.mesh.userData.isBlockedPickup && item.mesh.userData.isBlockedPickup(item)) {
          if (dHit < bestBlockedDist) {
            bestBlockedDist = dHit;
            bestBlocked = item;
          }
          continue;
        }
        if (item.mesh.userData.isTable || item.mesh.userData.isHood) {
          if (dHit < bestLargeDist) {
            bestLargeDist = dHit; bestLarge = item;
          }
        } else if (dHit < bestSmallDist) {
          bestSmallDist = dHit; bestSmall = item;
        }
      }
    }
    ctx.hoveredPickable = bestSmall || bestLarge;
    if (!ctx.hoveredPickable && bestBlocked && bestBlockedDist < 3.8) {
      if (bestBlocked.mesh.userData.isBurner) {
        prompt = '🚫 Retire a panela de cima antes de mover o Fogareiro';
      } else {
        prompt = '🚫 Retire os objetos de cima antes de mover ' + bestBlocked.label;
      }
    } else if (ctx.hoveredPickable) {
      let potStatus = null;
      for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
        if (ctx.cookerPots[cpi].potItem === ctx.hoveredPickable || ctx.cookerPots[cpi].lidItem === ctx.hoveredPickable) {
          potStatus = ctx.cookerPots[cpi]; break;
        }
      }
      if (ctx.hoveredPickable.potItem && ctx.hoveredPickable.isAttached) {
        if (potStatus && potStatus.psi >= 1.5) {
          const pctP = Math.min(100, Math.round((potStatus.psi / 15) * 100));
          if (potStatus.progress >= 100) {
            prompt = '🔒 Tampa Travada (' + potStatus.psi.toFixed(1) + ' PSI • ✅ 100%) — Desligue o fogo e aguarde';
          } else if (potStatus.psi >= 14) {
            prompt = '🔒 Esterilizando: ' + potStatus.psi.toFixed(1) + '/15 PSI (' + pctP + '%) • ' + Math.floor(potStatus.progress) + '%';
          } else {
            prompt = '🔒 Pressurizada: ' + potStatus.psi.toFixed(1) + '/15 PSI (' + pctP + '%) — Aguarde < 1.5 PSI';
          }
        } else if (potStatus && potStatus.progress >= 100) {
          prompt = '🍲 Retirar Tampa (🔓 Despressurizada • ✅ Esterilizado 100%)';
        } else if (potStatus && potStatus.temp > 32) {
          prompt = '🍲 Retirar Tampa (🔥 Aquecendo: ' + Math.round(potStatus.temp) + '°C)';
        } else {
          prompt = '🍲 Retirar Tampa da Panela de Pressão';
        }
      } else if (ctx.hoveredPickable.mesh.userData.twoHanded) {
        prompt = '🙌 Pegar ' + ctx.hoveredPickable.label + ' (2 mãos)';
      } else {
        prompt = '✋ Pegar ' + ctx.hoveredPickable.label;
      }
    }
  }
  if (!prompt && ctx.blindHitMeshes.length) {
    const blHits = ctx.raycaster.intersectObjects(ctx.blindHitMeshes, false);
    if (blHits.length > 0 && blHits[0].distance < 5.5) {
      ctx.hoveredBlindObj = blHits[0].object.userData.blindObj;
      prompt = ctx.hoveredBlindObj.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana';
    }
  }
  ctx.hoveredGreenhouseSlot = null;
  if (!prompt && greenhouseHitMeshes.length > 0) {
    const ghHits = ctx.raycaster.intersectObjects(greenhouseHitMeshes, true);
    if (ghHits.length > 0 && ghHits[0].distance < 4.8) {
      const hSlot = ghHits[0].object.userData.greenhouseSlot;
      if (hSlot) {
        ctx.hoveredGreenhouseSlot = hSlot;
        const isHoldingSpray = ctx.heldItem && (ctx.heldItem.id.indexOf('alcohol_spray') !== -1 || ctx.heldItem.id.indexOf('spray') !== -1);
        if (hSlot.stage === 3) {
          prompt = '🍄 Colher ' + hSlot.name + ' (+50 XP e +2 Cogumelos)';
        } else if (isHoldingSpray) {
          prompt = '💦 Borrifar e Hidratar ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR)';
        } else {
          prompt = '🌱 ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR • ' + (hSlot.stage === 0 ? 'Micélio' : (hSlot.stage === 1 ? 'Primórdios' : 'Crescendo')) + ')';
        }
      }
    }
  }
  if (ctx.callbacks.onHoverPrompt) ctx.callbacks.onHoverPrompt(prompt);
}
