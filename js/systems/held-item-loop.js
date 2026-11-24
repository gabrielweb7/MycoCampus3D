/**
 * Item Segurado em 1a Pessoa, Termometro Laser Infravermelho e Seringa (MycoCampus3D)
 */

import { GAME_CONFIG } from '../core/config.js';
import { getGroundHeight } from '../engine/physics.js';
import { getVirtualDayFrac } from '../world/staircase-clock.js';
import { updateContainerVolume } from '../items/liquid-culture.js';
import { addSyringeMix, updateSyringeVolume } from '../items/syringe.js';
import { getItemBaseTempC } from '../items/item-registry.js';
import { isAsepticWorkArea } from '../items/laminar-hood.js';
import { inoculatePetri } from '../items/petri-dish.js';
import { greenhouseSlots, greenhouseHitMeshes, greenhouseEnv } from '../world/greenhouse.js';
import { drawThermoScreen } from '../entities/thermo-laser.js';
import { triggerSinkStream } from '../items/lab-sink.js';
import { updateCookerWaterVisual, COOKER_SLOT_OFFSETS, COOKER_SLOT_Y } from '../items/pressure-cooker.js';
import { markPdaVolumeChanged } from '../items/pda-mix.js';
import { spawnSprayParticles, fireAlcoholSpray, fireWaterSpray, getSanitizationStatus } from '../items/alcohol-spray.js';
import { wipeWithPaperTowel } from '../items/paper-towel.js';
import { advanceMixingBowlStir, addIngredientToBowl, updateMixingBowlLabel } from '../items/mixing-bowl.js';
import { markBladePackEmpty, updateScalpelLabel, stepScalpels } from '../items/scalpel.js';
import { shouldHideHeldInPlacementMode } from '../entities/placement-ghost.js';

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

const _thermoStaticTargets = [];
const _thermoDynTargets = [];
let _thermoStaticBuilt = false;
let _stirRingEl = null;
let _stirArcEl = null;

function buildThermoStaticTargets(ctx) {
  _thermoStaticTargets.length = 0;
  const excludeRoots = new Set();
  if (ctx.playerGroup) excludeRoots.add(ctx.playerGroup);
  if (ctx.fpsArmGroup) excludeRoots.add(ctx.fpsArmGroup);
  if (ctx.fpsLeftArmGroup) excludeRoots.add(ctx.fpsLeftArmGroup);
  if (ctx.placementGhost) excludeRoots.add(ctx.placementGhost);
  if (ctx.thermoLaserLine) excludeRoots.add(ctx.thermoLaserLine);
  if (ctx.thermoLaserDot) excludeRoots.add(ctx.thermoLaserDot);
  if (ctx.envCloudsInst) excludeRoots.add(ctx.envCloudsInst);
  if (ctx.confettiMesh) excludeRoots.add(ctx.confettiMesh);
  if (ctx.sunDisc) excludeRoots.add(ctx.sunDisc);
  if (ctx.sunHalo) excludeRoots.add(ctx.sunHalo);
  if (ctx.rainbowMesh) excludeRoots.add(ctx.rainbowMesh);
  if (ctx.pickableItems) {
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      if (ctx.pickableItems[i] && ctx.pickableItems[i].mesh) excludeRoots.add(ctx.pickableItems[i].mesh);
    }
  }
  if (ctx.pastureCows) {
    for (let i = 0; i < ctx.pastureCows.length; i++) {
      const m = ctx.pastureCows[i] && (ctx.pastureCows[i].mesh || ctx.pastureCows[i].group);
      if (m) excludeRoots.add(m);
    }
  }
  if (ctx.cowPoops) {
    for (let i = 0; i < ctx.cowPoops.length; i++) {
      const m = ctx.cowPoops[i] && (ctx.cowPoops[i].group || ctx.cowPoops[i].mesh);
      if (m) excludeRoots.add(m);
    }
  }
  if (ctx.wildMushrooms) {
    for (let i = 0; i < ctx.wildMushrooms.length; i++) {
      if (ctx.wildMushrooms[i] && ctx.wildMushrooms[i].group) excludeRoots.add(ctx.wildMushrooms[i].group);
    }
  }
  const walk = (node) => {
    if (!node || excludeRoots.has(node)) return;
    if (node.userData && (node.userData.ignoreRay || node.userData.isDynamic || node.userData.remotePlayer)) return;
    if (node.isSprite || node.isPoints || node.isLine) return;
    if (node.isMesh && node.visible) {
      _thermoStaticTargets.push(node);
      return;
    }
    const ch = node.children;
    if (ch) {
      for (let i = 0; i < ch.length; i++) walk(ch[i]);
    }
  };
  walk(ctx.scene);
  _thermoStaticBuilt = true;
}

function getStirRingEls() {
  if (!_stirRingEl || !_stirRingEl.isConnected) {
    _stirRingEl = document.getElementById('stir-progress-ring');
  }
  if (!_stirArcEl || !_stirArcEl.isConnected) {
    _stirArcEl = document.getElementById('stir-progress-arc');
  }
  return { ring: _stirRingEl, arc: _stirArcEl };
}

function pushListWithinDist(out, list, cx, cz, maxSq) {
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m || !m.visible) continue;
    m.getWorldPosition(_tmpNormal);
    const dx = _tmpNormal.x - cx;
    const dz = _tmpNormal.z - cz;
    if (dx * dx + dz * dz <= maxSq) out.push(m);
  }
}

function updateThermometerLaser(ctx, dt, now) {
  if (!ctx.thermoLaserOn) {
    ctx.thermoLaserLine.visible = false;
    ctx.thermoLaserDot.visible = false;
    drawThermoScreen(ctx.thermoCurrentTemp, 'HOLD');
    return;
  }

  if (now - (ctx._lastThermoRayAt || 0) < 65) return;
  ctx._lastThermoRayAt = now;

  _tmpMuzzlePos.set(0, 0.155, -0.09).applyEuler(ctx.heldItem.mesh.rotation).add(ctx.heldItem.mesh.position);
  ctx.raycaster.far = 16;
  ctx.raycaster.setFromCamera(ctx.inFps ? _vZero2 : ctx.pointerNdc, ctx.camera);

  const heldMesh = ctx.heldItem ? ctx.heldItem.mesh : null;
  let lHit = null;
  if (ctx._mergedStaticCount !== undefined && ctx.scene) {
    if (!_thermoStaticBuilt) buildThermoStaticTargets(ctx);
    _thermoDynTargets.length = 0;
    const refPos = ctx.camera ? ctx.camera.position : ctx.playerPos;
    const rx = refPos.x, rz = refPos.z;
    const maxSq = 256; // 16m
    if (ctx.pickableItems) {
      for (let i = 0; i < ctx.pickableItems.length; i++) {
        const it = ctx.pickableItems[i];
        if (!it || it === ctx.heldItem || !it.mesh || !it.mesh.visible) continue;
        const dx = it.mesh.position.x - rx;
        const dz = it.mesh.position.z - rz;
        if (dx * dx + dz * dz <= maxSq) _thermoDynTargets.push(it.mesh);
      }
    }
    if (ctx.remoteAvatars) {
      for (const id in ctx.remoteAvatars) {
        const av = ctx.remoteAvatars[id];
        if (!av || !av.group || !av.group.visible) continue;
        const dx = av.group.position.x - rx;
        const dz = av.group.position.z - rz;
        if (dx * dx + dz * dz <= maxSq) _thermoDynTargets.push(av.group);
      }
    }
    if (ctx.pastureCows) {
      for (let i = 0; i < ctx.pastureCows.length; i++) {
        const cw = ctx.pastureCows[i];
        const m = cw && (cw.mesh || cw.group);
        if (!m || !m.visible) continue;
        const dx = m.position.x - rx;
        const dz = m.position.z - rz;
        if (dx * dx + dz * dz <= maxSq) _thermoDynTargets.push(m);
      }
    }
    pushListWithinDist(_thermoDynTargets, ctx.supportMeshes, rx, rz, maxSq);
    pushListWithinDist(_thermoDynTargets, ctx.doorHitMeshes, rx, rz, maxSq);
    pushListWithinDist(_thermoDynTargets, ctx.cabinetHitMeshes, rx, rz, maxSq);
    pushListWithinDist(_thermoDynTargets, ctx.burnerSwitchMeshes, rx, rz, maxSq);
    pushListWithinDist(_thermoDynTargets, ctx.stirSwitchMeshes, rx, rz, maxSq);
    pushListWithinDist(_thermoDynTargets, ctx.scaleTareMeshes, rx, rz, maxSq);
    if (greenhouseHitMeshes.length) pushListWithinDist(_thermoDynTargets, greenhouseHitMeshes, rx, rz, maxSq);

    const staticHits = ctx.raycaster.intersectObjects(_thermoStaticTargets, false);
    const dynHits = _thermoDynTargets.length ? ctx.raycaster.intersectObjects(_thermoDynTargets, true) : [];
    const pickBest = (hits, curBest) => {
      for (let rhi = 0; rhi < hits.length; rhi++) {
        const candH = hits[rhi];
        if (curBest && candH.distance >= curBest.distance) break;
        const obj = candH.object;
        if (!obj || !obj.visible) continue;
        if (obj.userData && obj.userData.ignoreRay) continue;
        if (obj === ctx.thermoLaserLine || obj === ctx.thermoLaserDot) continue;
        if (obj === ctx.placementGhost) continue;
        if (heldMesh && (obj === heldMesh || heldMesh.children.includes(obj))) continue;
        if (ctx.fpsArmGroup && (obj === ctx.fpsArmGroup || ctx.fpsArmGroup.children.includes(obj))) continue;
        if (ctx.fpsLeftArmGroup && (obj === ctx.fpsLeftArmGroup || ctx.fpsLeftArmGroup.children.includes(obj))) continue;
        if (ctx.playerGroup && (obj === ctx.playerGroup || ctx.playerGroup.children.includes(obj))) continue;
        if (obj.isSprite || obj.isPoints || obj.isLine) continue;
        return candH;
      }
      return curBest;
    };
    lHit = pickBest(staticHits, null);
    lHit = pickBest(dynHits, lHit);
  } else {
    const rawHits = ctx.raycaster.intersectObjects(ctx.scene.children, true);
    for (let rhi = 0; rhi < rawHits.length; rhi++) {
      const candH = rawHits[rhi];
      const obj = candH.object;
      if (!obj || !obj.visible) continue;
      if (obj.userData && obj.userData.ignoreRay) continue;
      if (obj === ctx.thermoLaserLine || obj === ctx.thermoLaserDot) continue;
      if (obj === ctx.placementGhost) continue;
      if (heldMesh && (obj === heldMesh || heldMesh.children.includes(obj))) continue;
      if (ctx.fpsArmGroup && (obj === ctx.fpsArmGroup || ctx.fpsArmGroup.children.includes(obj))) continue;
      if (ctx.fpsLeftArmGroup && (obj === ctx.fpsLeftArmGroup || ctx.fpsLeftArmGroup.children.includes(obj))) continue;
      if (ctx.playerGroup && (obj === ctx.playerGroup || ctx.playerGroup.children.includes(obj))) continue;
      if (obj.isSprite || obj.isPoints || obj.isLine) continue;
      lHit = candH;
      break;
    }
  }

  if (lHit && lHit.distance < 15.8) {
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
      } else if (hObj.userData.cabinetPart || (hObj.parent && hObj.parent.userData && hObj.parent.userData.cabinetPart)) {
        sTemp = 22.5;
        sLbl = 'Bancada / Armário do Laboratório';
      } else if (hObj.userData.scaleCtrl || (hObj.parent && hObj.parent.userData && hObj.parent.userData.scaleCtrl)) {
        sTemp = 22.8;
        sLbl = 'Balança Digital de Precisão';
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
        } else if (lHit.point.x > 14 && lHit.point.x < 24 && lHit.point.z > 2 && lHit.point.z < 14) {
          sTemp = greenhouseEnv.tempC || 23.0;
          sLbl = 'Estufa Climatizada (' + Math.round(greenhouseEnv.humidity) + '% UR • ' + Math.round(greenhouseEnv.co2Ppm) + ' ppm)';
        } else {
          sTemp = 23.2 + Math.sin(lHit.point.x * 0.5 + lHit.point.z * 0.3) * 0.4;
          sLbl = lHit.point.y > 0.6 ? 'Bancada / Estrutura' : 'Piso do Laboratório';
        }
      }
    }
    ctx.thermoTargetTemp = sTemp;
    ctx.thermoTargetLabel = sLbl;
  } else {
    const rOrig = ctx.raycaster.ray.origin;
    const rDir = ctx.raycaster.ray.direction;
    _tmpSkyEnd.copy(rOrig).addScaledVector(rDir, 25.0);
    const lArrG = ctx.thermoLaserLine.geometry.attributes.position.array;
    lArrG[0] = _tmpMuzzlePos.x; lArrG[1] = _tmpMuzzlePos.y; lArrG[2] = _tmpMuzzlePos.z;
    lArrG[3] = _tmpSkyEnd.x; lArrG[4] = _tmpSkyEnd.y; lArrG[5] = _tmpSkyEnd.z;
    ctx.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
    ctx.thermoLaserLine.visible = true;
    ctx.thermoLaserDot.visible = false;
    ctx.thermoTargetTemp = typeof ctx.outsideTempC === 'number'
      ? ctx.outsideTempC
      : (ctx.weatherMode === 'snow' ? -2.0 : (ctx.weatherMode === 'rain' ? 17.4 : 25.0));
    ctx.thermoTargetLabel = 'Ambiente Externo';
  }
  ctx.thermoCurrentTemp += (ctx.thermoTargetTemp - ctx.thermoCurrentTemp) * Math.min(1, dt * 14);
  drawThermoScreen(ctx.thermoCurrentTemp, 'SCAN');
}

function applySyringeMixDelta(ctx, syringeTarget, targetLiquid, targetSpawn, finalD, syrSnap) {
  const syrCtrl = ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData && ctx.heldItem.mesh.userData.syrCtrl;
  const scMix = syrCtrl && syrCtrl.mix;
  const hadLc = syrSnap ? syrSnap.hadLiveLc : !!(scMix && scMix.lcMl > 0.05);
  const srcContam = syrSnap ? syrSnap.sourceContam : !!(syrCtrl && syrCtrl.sourceContam);
  const srcSpecies = (syrSnap && syrSnap.speciesName) || (syrCtrl && syrCtrl.speciesName) || '';
  const srcGen = (syrSnap && typeof syrSnap.generation === 'number')
    ? syrSnap.generation
    : (syrCtrl && typeof syrCtrl.generation === 'number' ? syrCtrl.generation : null);
  if (finalD > 0.01 && syringeTarget) {
    let drawKind = 'water';
    if (syringeTarget.id && syringeTarget.id.indexOf('distilled_jug') === 0) drawKind = 'distilled';
    else if (syringeTarget.cultureCtrl && syringeTarget.cultureCtrl.colonized) drawKind = 'lc';
    else if (syringeTarget.pdaMediumCtrl && syringeTarget.pdaMediumCtrl.powderGrams > 0) drawKind = 'pda';
    if (syringeTarget.cultureCtrl && syringeTarget.cultureCtrl.contaminated && syrCtrl) {
      syrCtrl.sourceContam = true;
    }
    if (syringeTarget.cultureCtrl && syringeTarget.cultureCtrl.speciesName && syrCtrl) {
      syrCtrl.speciesName = syringeTarget.cultureCtrl.speciesName;
    }
    if (syringeTarget.cultureCtrl && syrCtrl) {
      syrCtrl.generation = typeof syringeTarget.cultureCtrl.generation === 'number'
        ? syringeTarget.cultureCtrl.generation
        : (syringeTarget.cultureCtrl.colonized ? 1 : syrCtrl.generation);
    }
    addSyringeMix(ctx.heldItem, drawKind, finalD);
  } else if (finalD < -0.01 && syringeTarget && targetLiquid && !(ctx.syringePumping.target.mode === 'inject' && targetSpawn)) {
    const injMl = -finalD;
    const totalMix = scMix ? ((scMix.waterMl || 0) + (scMix.distilledMl || 0) + (scMix.lcMl || 0) + (scMix.pdaMl || 0)) : 0;
    if (!syringeTarget.liquidMix) syringeTarget.liquidMix = { waterMl: 0, distilledMl: 0, lcMl: 0, pdaMl: 0 };
    if (totalMix > 0.01) {
      syringeTarget.liquidMix.waterMl += injMl * ((scMix.waterMl || 0) / totalMix);
      syringeTarget.liquidMix.distilledMl += injMl * ((scMix.distilledMl || 0) / totalMix);
      syringeTarget.liquidMix.lcMl += injMl * ((scMix.lcMl || 0) / totalMix);
      syringeTarget.liquidMix.pdaMl += injMl * ((scMix.pdaMl || 0) / totalMix);
    } else {
      syringeTarget.liquidMix.waterMl += injMl;
    }
    addSyringeMix(ctx.heldItem, null, -injMl);
    if (hadLc && syringeTarget.cultureCtrl && !syringeTarget.cultureCtrl.inoculated && !syringeTarget.cultureCtrl.contaminated) {
      if (syringeTarget.cultureCtrl.hasNutrient === false) {
        if (ctx.callbacks.onToast) {
          ctx.callbacks.onToast('⚠️ Este frasco tem apenas água pura! Adicione 🍯 Extrato de Malte / Mel (4%) e esterilize na panela antes de inocular!');
        }
        return;
      }
      const lcSterile = !!(syringeTarget.cultureCtrl.sterilized || syringeTarget.sterilized || (targetLiquid && targetLiquid.sterilized));
      const aseptic = lcSterile && isAsepticWorkArea(ctx, syringeTarget) && !srcContam;
      syringeTarget.cultureCtrl.inoculated = true;
      if (srcSpecies) {
        syringeTarget.cultureCtrl.speciesName = srcSpecies;
      }
      if (typeof srcGen === 'number') {
        syringeTarget.cultureCtrl.generation = Math.min(3, Math.max(1, srcGen));
      }
      if (aseptic) {
        syringeTarget.cultureCtrl.colonization = 2;
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 Cultura Líquida inoculada pela seringa! Aguarde colonizar até 100%.');
      } else {
        syringeTarget.cultureCtrl.contaminated = true;
        if (ctx.callbacks.onToast) ctx.callbacks.onToast(!lcSterile
          ? '🦠 O caldo nutritivo não estava esterilizado na autoclave!'
          : (srcContam
            ? '🦠 A seringa carregava cultura contaminada e infectou o frasco!'
            : '🦠 Injeção fora do fluxo laminar contaminou a Cultura Líquida!'));
      }
    }
  } else if (finalD < -0.01) {
    addSyringeMix(ctx.heldItem, null, finalD);
  }
}

export function stepHeldItemAndSyringe(ctx, dt, now) {
  const isTwoHanded = !!(ctx.heldItem && ctx.heldItem.mesh.userData.twoHanded);

  if (ctx.heldItem) {
    const reachZ = ctx.fpsArmGroup ? ctx.armReach * 0.16 : 0;
    const reachY = ctx.fpsArmGroup ? ctx.armReach * 0.06 : 0;
    const ud = ctx.heldItem.mesh && ctx.heldItem.mesh.userData;
    if (ctx.heldItem.fridgeCtrl || (ud && ud.isCultureFridge)) {
      _tmpHandLocal.set(0, -1.05, -2.05);
    } else if (ud && ud.isHood) {
      _tmpHandLocal.set(0, -0.78, -1.48);
    } else if (ud && ud.isTable) {
      _tmpHandLocal.set(0, -0.65, -1.35);
    } else if (isTwoHanded) {
      _tmpHandLocal.set(0, -0.48, -0.95);
    } else if (ud && ud.isTray) {
      _tmpHandLocal.set(0.14, -0.26 + reachY, -0.58 - reachZ);
    } else if (ctx.heldItem.wildMushroomCtrl) {
      if (ctx.heldItem.wildMushroomCtrl.bodyGroup) {
        ctx.heldItem.wildMushroomCtrl.bodyGroup.rotation.z = 0;
        ctx.heldItem.wildMushroomCtrl.bodyGroup.position.y = 0;
      }
      _tmpHandLocal.set(0.24, -0.26 + reachY, -0.46 - reachZ);
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
    } else if (ctx.heldItem.mesh.userData.isAlcoholSpray || ctx.heldItem.mesh.userData.isWaterSpray || ctx.heldItem.mesh.userData.isH2O2Spray) {
      const spUd = ctx.heldItem.mesh.userData;
      const squeezing = spUd.sprayAnimUntil && spUd.sprayAnimUntil > now;
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(-ctx.playerPitch * 0.45 + (squeezing ? 0.08 : 0), ctx.playerYaw + Math.PI, 0);
      if (spUd.sprayTrig) {
        spUd.sprayTrig.position.z = squeezing ? 0.032 : 0.042;
      }
    } else if (ctx.heldItem.mesh.userData.isLabSpoon) {
      const spoonUd = ctx.heldItem.mesh.userData;
      const isHoldingStir = !!(ctx.stirHold && ctx.stirHold.spoon === ctx.heldItem && ctx.stirHold.bowl && ctx.stirHold.bowl.mesh);
      const stirRem = isHoldingStir ? 500 : ((spoonUd.spoonStirUntil || 0) - now);
      const stirBowl = isHoldingStir ? ctx.stirHold.bowl : spoonUd.spoonStirTarget;
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      if (stirRem > 0 && stirBowl && stirBowl.mesh) {
        const stirPhase = isHoldingStir ? (now * 0.014) : ((700 - stirRem) * 0.014);
        const bp = stirBowl.mesh.position;
        const k = isHoldingStir ? 1 : Math.max(0, Math.min(1, (700 - stirRem) / 120, stirRem / 120));
        ctx.heldItem.mesh.position.set(
          _tmpHandPos.x + (bp.x + Math.cos(stirPhase) * 0.045 - _tmpHandPos.x) * k,
          _tmpHandPos.y + (bp.y + 0.075 - _tmpHandPos.y) * k,
          _tmpHandPos.z + (bp.z + Math.sin(stirPhase) * 0.045 - _tmpHandPos.z) * k
        );
        ctx.heldItem.mesh.rotation.set(-1.05 * k - 0.15 * (1 - k), ctx.playerYaw + Math.sin(stirPhase) * 0.4 * k, 0);
        if (stirBowl.bowlCtrl && stirBowl.bowlCtrl.mixMesh) stirBowl.bowlCtrl.mixMesh.rotation.y += dt * 9;
        if (isHoldingStir && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_mix');
      } else {
        ctx.heldItem.mesh.rotation.set(-0.15, ctx.playerYaw, 0);
      }
    } else if (ctx.sinkFilling && ctx.sinkFilling.item === ctx.heldItem && ctx.sinkFilling.sink && ctx.sinkFilling.sink.nozzleWorld) {
      const sk = ctx.sinkFilling.sink;
      const nw = sk.nozzleWorld;
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      if (ctx.sinkFilling.mode === 'fill') {
        ctx.heldItem.mesh.position.set(nw.x, nw.y - 0.16, nw.z);
        ctx.heldItem.mesh.rotation.set(0, ctx.playerYaw, 0);
      } else {
        const yOff = ctx.heldItem.cookerRef ? 0.14 : 0.05;
        ctx.heldItem.mesh.position.set(sk.x, sk.y + yOff, sk.z);
        ctx.heldItem.mesh.rotation.order = 'YXZ';
        ctx.heldItem.mesh.rotation.set(0.72, ctx.playerYaw, -0.15);
        if (now - (ctx.sinkFilling.dropAt || 0) > 85) {
          ctx.sinkFilling.dropAt = now;
          _tmpPourFrom.set(0, ctx.heldItem.cookerRef ? 0.22 : 0.12, -0.18).applyEuler(ctx.heldItem.mesh.rotation).add(ctx.heldItem.mesh.position);
          _tmpPourDir.set(0, -1, 0);
          spawnSprayParticles(ctx, 0x7dd3fc, 5, _tmpPourFrom, _tmpPourDir, 0.12, 1.1, 0.032, 0.36);
        }
      }
    } else if (ctx.pourHold && ctx.pourHold.src === ctx.heldItem) {
      const dstObj = ctx.pourHold.dst && (ctx.pourHold.dst.mesh || (ctx.pourHold.dst.potItem && ctx.pourHold.dst.potItem.mesh));
      if (dstObj) {
        const dp = dstObj.position;
        ctx.heldItem.mesh.position.set(
          _tmpHandPos.x + (dp.x - _tmpHandPos.x) * 0.55,
          _tmpHandPos.y + (dp.y + 0.24 - _tmpHandPos.y) * 0.55,
          _tmpHandPos.z + (dp.z - _tmpHandPos.z) * 0.55
        );
      }
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(-0.85, ctx.playerYaw, -0.35);
    } else {
      ctx.heldItem.mesh.rotation.order = 'YXZ';
      ctx.heldItem.mesh.rotation.set(0, ctx.playerYaw, 0);
    }

    // Esconde o item segurado (e tampa/conteúdo acoplado) no modo posicionamento [G] para exibir só o fantasma
    const hideInPlaceMode = shouldHideHeldInPlacementMode(ctx);
    ctx.heldItem.mesh.visible = !hideInPlaceMode;

    const heldPos = ctx.heldItem.mesh.position;

    // Follow attached cooker lid
    if (ctx.heldItem.lidItem && ctx.heldItem.lidItem.isAttached && ctx.heldItem.lidItem.mesh) {
      ctx.heldItem.lidItem.mesh.visible = !hideInPlaceMode;
      ctx.heldItem.lidItem.mesh.position.set(heldPos.x, heldPos.y + 0.36, heldPos.z);
      ctx.heldItem.lidItem.mesh.rotation.copy(ctx.heldItem.mesh.rotation);
    }

    // Follow cooker pot contents (respeitando a inclinação/rotação da panela)
    if (ctx.heldItem.cookerRef && Array.isArray(ctx.heldItem.cookerRef.contents)) {
      let nonBaseIdx = 0;
      const potQuat = ctx.heldItem.mesh.quaternion;
      ctx.heldItem.cookerRef.contents.forEach(function (cItem) {
        if (!cItem || !cItem.mesh) return;
        cItem.mesh.visible = !hideInPlaceMode;
        if (cItem.mesh.userData && cItem.mesh.userData.isCookerBase) {
          _tmpPourFrom.set(0, 0.036, 0).applyQuaternion(potQuat).add(heldPos);
          cItem.mesh.position.copy(_tmpPourFrom);
          cItem.mesh.quaternion.copy(potQuat);
        } else {
          const slot = COOKER_SLOT_OFFSETS[nonBaseIdx % COOKER_SLOT_OFFSETS.length];
          _tmpPourFrom.set(slot[0], COOKER_SLOT_Y, slot[1]).applyQuaternion(potQuat).add(heldPos);
          cItem.mesh.position.copy(_tmpPourFrom);
          cItem.mesh.quaternion.copy(potQuat);
          nonBaseIdx++;
        }
      });
    }

    // Follow tray carried items
    if (ctx.heldItem.trayContents && ctx.heldItem.trayContents.length) {
      ctx.heldItem.mesh.updateMatrixWorld(true);
      const hRy = ctx.heldItem.mesh.rotation.y;
      for (let tci = 0; tci < ctx.heldItem.trayContents.length; tci++) {
        const tc = ctx.heldItem.trayContents[tci];
        if (!tc.item || !tc.item.mesh) continue;
        tc.item.mesh.visible = !hideInPlaceMode;
        if (tc.localOffset) {
          _tmpLookPt.copy(tc.localOffset);
          ctx.heldItem.mesh.localToWorld(_tmpLookPt);
          tc.item.mesh.position.copy(_tmpLookPt);
          tc.item.mesh.rotation.set(0, hRy + (tc.localRotY || 0), 0);
        } else {
          const ch = Math.cos(hRy), sh = Math.sin(hRy);
          const hp = ctx.heldItem.mesh.position;
          tc.item.mesh.position.set(
            hp.x + tc.lx * ch + tc.lz * sh,
            hp.y + tc.ly,
            hp.z - tc.lx * sh + tc.lz * ch
          );
          tc.item.mesh.rotation.set(0, hRy + (tc.lry || 0), 0);
        }
      }
    }

    if (ctx.heldItem.mesh.userData.isSyringe) {
      const activeSyrItem = (ctx.hoveredSyringeTarget && ctx.hoveredSyringeTarget.item && ctx.hoveredSyringeTarget.item.mesh.userData.liquidCtrl)
        ? ctx.hoveredSyringeTarget.item
        : ((ctx.syringePumping && ctx.syringePumping.target && ctx.syringePumping.target.item && ctx.syringePumping.target.item.mesh.userData.liquidCtrl) ? ctx.syringePumping.target.item : null);
      const isPuncturing = !!activeSyrItem;
      if (isPuncturing && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_syringe');
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
          const hasBase = ph.dst.hasBase || ph.dst.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
          const potWaterCap = hasBase ? 4000 : 10000;
          amt = Math.min(stepMl, srcLcP.volMl, Math.max(0, potWaterCap - ph.dst.waterMl));
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
        } else if (ph.kind === 'spawn_hydrate') {
          const sp = ph.dst.spawnCtrl;
          amt = Math.min(stepMl, srcLcP.volMl, Math.max(0, 80 - (sp.waterMl || 0)));
          if (amt > 0) {
            updateContainerVolume(ph.src, srcLcP.volMl - amt);
            sp.waterMl = (sp.waterMl || 0) + amt;
            if (sp.waterMl >= 60) sp.hydrated = true;
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
        if (ctx.heldItem === ph.src && ph.src.mesh) {
          ph.src.mesh.rotation.z = -0.68;
          ph.src.mesh.rotation.x = 0.22;
        }
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

  if (ctx.isPrimaryDown && !ctx.placementMode && ctx.heldItem && ctx.heldItem.mesh) {
    if (ctx.heldItem.mesh.userData.isAlcoholSpray && now - (ctx._lastSprayLoopAt || 0) >= 260) {
      if (!(ctx.hoveredSprayTarget && ctx.hoveredSprayTarget.target && ctx.hoveredSprayTarget.target.monotubCtrl && ctx.hoveredSprayTarget.target.monotubCtrl.colonization >= 100) &&
          !(ctx.hoveredGreenhouseSlot && !ctx.hoveredGreenhouseSlot.empty)) {
        ctx._lastSprayLoopAt = now;
        fireAlcoholSpray(ctx, ctx.hoveredSprayTarget);
      }
    } else if (ctx.heldItem.mesh.userData.isWaterSpray && now - (ctx._lastSprayLoopAt || 0) >= 260) {
      ctx._lastSprayLoopAt = now;
      fireWaterSpray(ctx, ctx.hoveredSprayTarget);
      if (ctx.hoveredGreenhouseSlot) ctx.interactGreenhouseSlot(ctx.hoveredGreenhouseSlot);
    } else if (ctx.heldItem.mesh.userData.isPaperTowel && ctx.hoveredWipeTarget && now - (ctx._lastWipeLoopAt || 0) >= 220) {
      const wSt = getSanitizationStatus(ctx.hoveredWipeTarget.target, ctx);
      if (wSt.alcoholWet || wSt.isSanitized) {
        ctx._lastWipeLoopAt = now;
        wipeWithPaperTowel(ctx, ctx.hoveredWipeTarget);
      }
    }
  }

  stepScalpels(ctx, now);

  if (ctx.bladeAttachHold) {
    const bh = ctx.bladeAttachHold;
    const { ring, arc } = getStirRingEls();
    if (!ctx.isPrimaryDown || !ctx.heldItem || ctx.heldItem !== bh.pack || !ctx.hoveredScalpelTarget || ctx.hoveredScalpelTarget.item !== bh.scalpel) {
      ctx.bladeAttachHold = null;
      if (ring && !ctx.stirHold) ring.classList.add('hidden');
    } else {
      bh.progress = Math.min(1, (bh.progress || 0) + dt / 1.5);
      if (ring && arc) {
        ring.classList.remove('hidden');
        arc.setAttribute('stroke-dashoffset', String(113.1 * (1 - bh.progress)));
      }
      if (bh.progress >= 1) {
        const sc = bh.scalpel.scalpelCtrl;
        sc.hasBlade = true;
        sc.sterile = true;
        sc.bladeExpired = false;
        sc.bladeContaminated = false;
        sc.cutContaminated = false;
        sc.bladeAttachedAt = now;
        sc.hasMycelium = false;
        if (sc.bladeMesh) sc.bladeMesh.visible = true;
        updateScalpelLabel(bh.scalpel);
        // Deixa a embalagem vazia na mão do jogador para jogar no lixo
        const packItem = bh.pack;
        markBladePackEmpty(packItem);
        if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(packItem.label);
        ctx.bladeAttachHold = null;
        if (ring) ring.classList.add('hidden');
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (ctx.callbacks.onToast) ctx.callbacks.onToast('🔪 Lâmina estéril #24 encaixada! Jogue a embalagem vazia no lixo.');
        ctx.notifyWorldAction();
      }
    }
  }

  if (ctx.stirHold) {
    const sh = ctx.stirHold;
    const { ring, arc } = getStirRingEls();
    if (!ctx.isPrimaryDown || !ctx.heldItem || ctx.heldItem !== sh.spoon || !ctx.hoveredBowlTarget || ctx.hoveredBowlTarget !== sh.bowl) {
      ctx.stirHold = null;
      if (ring) ring.classList.add('hidden');
    } else {
      const res = advanceMixingBowlStir(sh.bowl, dt);
      if (ring && arc) {
        ring.classList.remove('hidden');
        arc.setAttribute('stroke-dashoffset', String(113.1 * (1 - (res.progress || 0))));
      }
      if (now - (sh.soundAt || 0) > 380) {
        sh.soundAt = now;
        if (window.MycoAudio) window.MycoAudio.playClick();
      }
      if (res.done) {
        ctx.stirHold = null;
        if (ring) ring.classList.add('hidden');
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast('✅ Receita homogênea pronta para porcionar!');
        }
        ctx.notifyWorldAction();
      }
    }
  } else if (!ctx.bladeAttachHold) {
    const { ring } = getStirRingEls();
    if (ring && !ring.classList.contains('hidden')) ring.classList.add('hidden');
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
      const isDrain = sf.mode === 'drain';
      if (!isDrain) triggerSinkStream(ctx.hoveredSink, 250);
      const lc = sf.item.mesh && sf.item.mesh.userData && sf.item.mesh.userData.liquidCtrl;
      if (lc) {
        if ((!isDrain && lc.volMl < lc.maxMl) || (isDrain && lc.volMl > 0)) {
          const rate = lc.maxMl >= 4000 ? 450 : 220;
          sf.carryMl = (sf.carryMl || 0) + dt * rate;
          const stepMl = Math.floor(sf.carryMl);
          if (stepMl >= 1) {
            sf.carryMl -= stepMl;
            const nextVol = isDrain ? Math.max(0, lc.volMl - stepMl) : Math.min(lc.maxMl, lc.volMl + stepMl);
            updateContainerVolume(sf.item, nextVol);
            if (sf.item.pdaMediumCtrl) markPdaVolumeChanged(sf.item);
            sf.addedAny = true;
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(sf.item.label);
          }
        }
      } else if (sf.item.bowlCtrl && !sf.item.bowlCtrl.mixed) {
        const bc = sf.item.bowlCtrl;
        const totalG = Object.values(bc.ingredients).reduce((a, b) => a + b, 0);
        const curWater = bc.ingredients.water || 0;
        if ((!isDrain && totalG < 600) || (isDrain && curWater > 0)) {
          sf.carryMl = (sf.carryMl || 0) + dt * 200;
          const stepMl = Math.floor(sf.carryMl);
          if (stepMl >= 1) {
            sf.carryMl -= stepMl;
            if (isDrain) {
              bc.ingredients.water = Math.max(0, curWater - stepMl);
              bc.stirProgress = 0;
              updateMixingBowlLabel(sf.item);
            } else {
              const add = Math.min(stepMl, 600 - totalG);
              if (add > 0) addIngredientToBowl(sf.item, 'water', add);
            }
            sf.addedAny = true;
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(sf.item.label);
          }
        }
      } else if (sf.item.spawnCtrl && sf.item.spawnCtrl.filled && sf.item.spawnCtrl.hydrated === false && !sf.item.spawnCtrl.sterilized && !sf.item.spawnCtrl.inoculated) {
        const sc = sf.item.spawnCtrl;
        if (!isDrain && (sc.waterMl || 0) < 80) {
          sf.carryMl = (sf.carryMl || 0) + dt * 90;
          const stepMl = Math.floor(sf.carryMl);
          if (stepMl >= 1) {
            sf.carryMl -= stepMl;
            const prevHyd = !!sc.hydrated;
            sc.waterMl = Math.min(80, (sc.waterMl || 0) + stepMl);
            if (sc.waterMl >= 60) sc.hydrated = true;
            sc.updateVisual();
            sf.addedAny = true;
            if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(sf.item.label);
            if (!prevHyd && sc.hydrated && ctx.callbacks && ctx.callbacks.onToast) {
              ctx.callbacks.onToast('💧 Grãos hidratados! Agora sele/tampe e leve para esterilizar a 121°C.');
            }
          }
        }
      } else {
        for (let cpi = 0; cpi < ctx.cookerPots.length; cpi++) {
          const cp = ctx.cookerPots[cpi];
          if (cp.potItem === sf.item) {
            const hasBase = cp.hasBase || cp.contents.some((it) => it && it.mesh && it.mesh.userData.isCookerBase);
            const potWaterCap = hasBase ? 4000 : 10000;
            if ((!isDrain && cp.waterMl < potWaterCap) || (isDrain && cp.waterMl > 0)) {
              sf.carryMl = (sf.carryMl || 0) + dt * 500;
              const stepMl = Math.floor(sf.carryMl);
              if (stepMl >= 1) {
                sf.carryMl -= stepMl;
                cp.waterMl = isDrain ? Math.max(0, cp.waterMl - stepMl) : Math.min(potWaterCap, cp.waterMl + stepMl);
                updateCookerWaterVisual(cp);
                sf.addedAny = true;
                if (ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(sf.item.label);
              }
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
      const earlyDelta = finalVol - ctx.syringePumping.fromVol;
      const syringeTarget = ctx.syringePumping.target.item;
      const targetLiquid = syringeTarget && syringeTarget.mesh.userData.liquidCtrl;
      const targetSpawn = syringeTarget && syringeTarget.spawnCtrl;
      const syrSnap = {
        hadLiveLc: !!(syrCtrl && syrCtrl.mix && syrCtrl.mix.lcMl > 0.05),
        speciesName: (syrCtrl && syrCtrl.speciesName) || '',
        generation: syrCtrl && typeof syrCtrl.generation === 'number' ? syrCtrl.generation : null,
        sourceContam: !!(syrCtrl && syrCtrl.sourceContam)
      };
      applySyringeMixDelta(ctx, syringeTarget, targetLiquid, targetSpawn, earlyDelta, syrSnap);
      updateSyringeVolume(ctx.heldItem, finalVol <= 0.05 ? 0 : finalVol);
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
      const scDuring = ctx.heldItem.mesh.userData.syrCtrl;
      const syrSnap = {
        hadLiveLc: !!(scDuring && scDuring.mix && scDuring.mix.lcMl > 0.05),
        speciesName: (scDuring && scDuring.speciesName) || '',
        generation: scDuring && typeof scDuring.generation === 'number' ? scDuring.generation : null,
        sourceContam: !!(scDuring && scDuring.sourceContam)
      };
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
        const finalD = ctx.syringePumping.toVol - ctx.syringePumping.fromVol;
        applySyringeMixDelta(ctx, syringeTarget, targetLiquid, targetSpawn, finalD, syrSnap);
        updateSyringeVolume(ctx.heldItem, ctx.syringePumping.toVol);
        if (targetLiquid && !(ctx.syringePumping.target.mode === 'inject' && targetSpawn)) {
          updateContainerVolume(syringeTarget, Math.max(0, ctx.syringePumping.startJarVol - finalD));
        } else if (targetSpawn) {
          const spTarget = syringeTarget;
          const spCtrl = targetSpawn;
          const syrSp = syrSnap.speciesName;
          const hadLiveLc = syrSnap.hadLiveLc;
          if (!hadLiveLc) {
            spCtrl.waterMl = (spCtrl.waterMl || 0) + Math.round((ctx.syringePumping.amountMl || Math.abs(finalD) || 1) * 10) / 10;
            spCtrl.updateVisual();
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('💧 Água aplicada em ' + spCtrl.baseLabel + ' (sem cultura líquida na seringa).');
          } else {
            const isAseptic = isAsepticWorkArea(ctx, spTarget) && !syrSnap.sourceContam;
            spCtrl.inoculated = true;
            spCtrl.generation = typeof syrSnap.generation === 'number' ? Math.min(3, Math.max(1, syrSnap.generation)) : 1;
            if (syrSp) spCtrl.speciesName = syrSp;
            if (syrSnap.sourceContam) {
              spCtrl.contaminated = true;
              if (ctx.callbacks.onToast) {
                ctx.callbacks.onToast('🦠 A seringa continha cultura contaminada e infectou o ' + spCtrl.baseLabel + '!');
              }
            } else if (!spCtrl.sterilized && Math.random() < 0.85) {
              spCtrl.contaminated = true;
              if (ctx.callbacks.onToast) {
                ctx.callbacks.onToast('🦠 Contaminação! O substrato não completou o tempo mínimo de esterilização (' + (spCtrl.minSterilizeMin || 80) + ' min)!');
              }
            } else if (!isAseptic && Math.random() < 0.45) {
              spCtrl.contaminated = true;
              if (ctx.callbacks.onToast) ctx.callbacks.onToast('🦠 Contaminação! Lembre de ligar e higienizar o Fluxo Laminar com Álcool 70% antes de inocular!');
            } else {
              const doseDone = Math.round((ctx.syringePumping.amountMl || Math.abs(finalD) || 1) * 10) / 10;
              if (ctx.callbacks.onToast) ctx.callbacks.onToast('💉 ' + doseDone + 'ml inoculados em ' + spCtrl.baseLabel + '! Micélio em colonização.');
            }
            spCtrl.updateVisual();
          }
        } else if (syringeTarget && syringeTarget.mesh.userData.isPetri) {
          const petriTarget = syringeTarget;
          const petriCtrl = petriTarget.mesh.userData.petriCtrl;
          const doseMl = ctx.syringePumping.amountMl || 1;
          const hadLiveLc = syrSnap.hadLiveLc;
          if (!hadLiveLc) {
            if (ctx.callbacks.onToast) ctx.callbacks.onToast('⚠️ A seringa não contém cultura líquida (apenas água/meio); aspire cultura líquida para inocular.');
          } else if (petriCtrl && petriCtrl.mode === 'empty' && petriCtrl.lidOpen && petriCtrl.sterilized) {
            const aseptic = isAsepticWorkArea(ctx, petriTarget) && !syrSnap.sourceContam;
            inoculatePetri(petriTarget, 'liquid', aseptic, 0, syrSnap.speciesName || '', syrSnap.generation);
            if (ctx.callbacks.onToast) {
              ctx.callbacks.onToast(syrSnap.sourceContam
                ? '🦠 A seringa continha cultura contaminada e infectou a placa!'
                : (aseptic
                  ? '💉 ' + doseMl + 'ml inoculado. O micélio branco começará a crescer na placa.'
                  : '🦠 ' + doseMl + 'ml aplicado fora da área asséptica; a placa foi contaminada.'));
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
