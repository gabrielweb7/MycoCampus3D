/**
 * Borrifador Alcool 70%, Particulas de Spray e Higienizacao Universal 3x (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';

const THREE = window.THREE;

export const ALCOHOL_SPRAY_META = {
  category: 'sanitization',
  purpose: 'Higienizar superfícies, fluxo laminar e hidratar a estufa',
  weightGrams: 380,
  baseTempC: 20.2,
  compatibilities: {
    canEnterCooker: false,
    canSanitizeHood: true,
    canSanitizeItems: true,
    canHydrateGreenhouse: true
  },
  connections: ['laminar_hood', 'greenhouse_slot', 'table', 'petri']
};

export function makeAlcoholSprayBottle(ctx, id, px, py, pz) {
  const ag = new THREE.Group();
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.062, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, roughness: 0.25 })
  );
  bottle.position.y = 0.09;
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.036, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  neck.position.y = 0.205;
  const nozzle = makeBox(0.028, 0.028, 0.08, 0xf8fafc, { noShadow: true });
  nozzle.position.set(0, 0.235, 0.025);
  const trig = makeBox(0.012, 0.045, 0.018, 0x0284c7, { noShadow: true });
  trig.position.set(0, 0.212, 0.042);
  ag.add(bottle, neck, nozzle, trig);
  ag.userData.isAlcoholSpray = true;
  ag.userData.sprayTrig = trig;
  ag.userData.sprayNozzle = nozzle;
  return registerPickable(ctx, id, 'Borrifador Álcool 70%', ag, px, py, pz, Math.PI / 2, 0.12, 0.26, ALCOHOL_SPRAY_META);
}

/**
 * Retorna o status atual de higienizacao (0..3 borrifadas e tempo restante).
 */
export function getSanitizationStatus(target, ctx) {
  if (!target) return { hits: 0, isSanitized: false, remainingSec: 0 };
  const isHood = target === 'hood' || (target.mesh && target.mesh.userData && target.mesh.userData.isHood);
  const nowPerf = performance.now();
  const nowEpoch = Date.now();

  if (isHood && ctx) {
    const active = ctx.hoodSanitizedUntil > nowEpoch;
    const hits = active ? 3 : Math.min(2, target._sanitizeHits || 0);
    return {
      hits,
      isSanitized: active,
      remainingSec: active ? Math.max(1, Math.ceil((ctx.hoodSanitizedUntil - nowEpoch) / 1000)) : 0
    };
  }

  const until = target.sanitizedUntil || target._sanitizeUntil || 0;
  const active = until > nowPerf;
  const hits = active ? 3 : Math.min(2, target._sanitizeHits || 0);
  return {
    hits,
    isSanitized: active,
    remainingSec: active ? Math.max(1, Math.ceil((until - nowPerf) / 1000)) : 0
  };
}

export function formatSprayHoverPrompt(target, label, ctx) {
  const st = getSanitizationStatus(target, ctx);
  if (st.isSanitized) {
    return '✨ [●●● HIGIENIZADO • ' + st.remainingSec + 's] ' + label + ' — Clique para reforçar';
  }
  const dots = st.hits === 0 ? '○○○ 0/3' : (st.hits === 1 ? '●○○ 1/3' : '●●○ 2/3');
  const rem = 3 - st.hits;
  const statusTxt = st.hits === 0 ? 'Não higienizado' : (st.hits === 1 ? 'Higienizando' : 'Quase limpo');
  return '🧴 [' + dots + '] ' + statusTxt + ' (' + label + ') • Clique +' + rem + 'x para higienizar';
}

function spawnSprayParticles(ctx, colorHex, count, origin, dir, spread, speed, size, life) {
  const spArr = new Float32Array(count * 3);
  const spVel = new Float32Array(count * 3);
  for (let si = 0; si < count; si++) {
    spArr[si * 3] = origin.x + (Math.random() - 0.5) * 0.08;
    spArr[si * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.08;
    spArr[si * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.08;
    spVel[si * 3] = dir.x * speed + (Math.random() - 0.5) * spread;
    spVel[si * 3 + 1] = dir.y * speed + (Math.random() - 0.5) * spread;
    spVel[si * 3 + 2] = dir.z * speed + (Math.random() - 0.5) * spread;
  }
  const spGeo = new THREE.BufferGeometry();
  const spAttr = new THREE.BufferAttribute(spArr, 3);
  spGeo.setAttribute('position', spAttr);
  const spMat = new THREE.PointsMaterial({ color: colorHex, size, transparent: true, opacity: 0.9 });
  const spPts = new THREE.Points(spGeo, spMat);
  ctx.scene.add(spPts);
  ctx.sprayBursts.push({ pts: spPts, mat: spMat, attr: spAttr, vel: spVel, age: 0, maxAge: life });
}

/**
 * Dispara o jato de alcool 70% da ponta do borrifador e avanca a higienizacao (3 cliques = 100%).
 */
export function fireAlcoholSpray(ctx, sprayInfo) {
  if (window.MycoAudio) window.MycoAudio.playSpray();
  if (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData) {
    ctx.heldItem.mesh.userData.sprayAnimUntil = performance.now() + 160;
  }

  const spOrigin = new THREE.Vector3(0.24, -0.03, -0.60).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
  const spDir = new THREE.Vector3(0, 0, -1).applyEuler(ctx.camera.rotation).normalize();
  spawnSprayParticles(ctx, 0xe0f2fe, 30, spOrigin, spDir, 0.95, 2.5, 0.032, 0.45);

  if (!sprayInfo || !sprayInfo.target) return;

  const target = sprayInfo.target;
  const label = sprayInfo.label || 'Objeto';
  const nowPerf = performance.now();
  const isHood = target === 'hood' || (target.mesh && target.mesh.userData && target.mesh.userData.isHood);
  const st = getSanitizationStatus(target, ctx);

  if (st.isSanitized) {
    if (isHood) {
      ctx.hoodSanitizedUntil = Date.now() + 90000;
      ctx.queueWorldStateChange('hood_sanitized_until', 1);
    } else {
      target.sanitizedUntil = nowPerf + 90000;
      target._sanitizeUntil = nowPerf + 90000;
    }
    if (ctx.callbacks.onToast) ctx.callbacks.onToast('✨ ' + label + ' reforçado com Álcool 70% (90s)!');
    return;
  }

  const nextHits = Math.min(3, st.hits + 1);
  if (typeof target === 'object') {
    target._sanitizeHits = nextHits;
  }

  if (nextHits < 3) {
    const dots = nextHits === 1 ? '●○○ 1/3' : '●●○ 2/3';
    if (ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🧴 [' + dots + '] Aplicado em ' + label + ' — faltam ' + (3 - nextHits) + ' borrifada(s)!');
    }
    return;
  }

  // 3/3 = 100% Higienizado!
  if (isHood) {
    ctx.hoodSanitizedUntil = Date.now() + 90000;
    ctx.queueWorldStateChange('hood_sanitized_until', 1);
    if (ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('sanitize_hood');
  } else if (typeof target === 'object') {
    target.sanitizedUntil = nowPerf + 90000;
    target._sanitizeUntil = nowPerf + 90000;
    target._sanitizeHits = 0;
  }

  // Efeito visual de brilho asséptico (particulas verde-ciano) no alvo higienizado
  const burstPos = sprayInfo.hitPoint
    ? sprayInfo.hitPoint.clone()
    : spOrigin.clone().addScaledVector(spDir, 1.4);
  spawnSprayParticles(ctx, 0x34d399, 26, burstPos, new THREE.Vector3(0, 1, 0), 1.8, 0.7, 0.045, 0.65);
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks.onToast) {
    ctx.callbacks.onToast('✨ [●●● 3/3 HIGIENIZADO] ' + label + ' 100% sanitizado (90s)!');
  }
}

export function stepSprayBursts(ctx, dt) {
  if (!ctx.sprayBursts.length) return;
  for (let sbi = ctx.sprayBursts.length - 1; sbi >= 0; sbi--) {
    const sb = ctx.sprayBursts[sbi];
    sb.age += dt;
    const maxAge = sb.maxAge || 0.45;
    const sArr = sb.attr.array;
    if (sb.vel) {
      for (let k = 0; k < sArr.length; k += 3) {
        sArr[k] += sb.vel[k] * dt;
        sArr[k + 1] += sb.vel[k + 1] * dt;
        sArr[k + 2] += sb.vel[k + 2] * dt;
      }
    } else if (sb.dir) {
      for (let k = 0; k < sArr.length; k += 3) {
        sArr[k] += sb.dir.x * dt * 2.2;
        sArr[k + 1] += sb.dir.y * dt * 2.2;
        sArr[k + 2] += sb.dir.z * dt * 2.2;
      }
    }
    sb.attr.needsUpdate = true;
    sb.mat.opacity = Math.max(0, 0.9 * (1 - sb.age / maxAge));
    if (sb.age >= maxAge) {
      ctx.scene.remove(sb.pts);
      if (sb.pts.geometry && sb.pts.geometry.dispose) sb.pts.geometry.dispose();
      if (sb.mat && sb.mat.dispose) sb.mat.dispose();
      ctx.sprayBursts.splice(sbi, 1);
    }
  }
}
