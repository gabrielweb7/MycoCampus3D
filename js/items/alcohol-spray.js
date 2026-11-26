/**
 * Borrifador Alcool 70%, Particulas de Spray e Higienizacao Universal 3x (MycoCampus3D)
 */

import { makeBox } from '../engine/textures.js';
import { registerPickable } from './item-registry.js';
import { getHoodSanitationContext } from './laminar-hood.js';
import { t } from '../core/i18n.js';

const THREE = window.THREE;

export const ALCOHOL_SPRAY_META = {
  category: 'sanitization',
  purpose: 'Higienizar superfícies, fluxo laminar e equipamentos (NUNCA borrifar álcool no micélio vivo)',
  weightGrams: 380,
  baseTempC: 20.2,
  compatibilities: {
    canEnterCooker: false,
    canSanitizeHood: true,
    canSanitizeItems: true,
    canHydrateGreenhouse: false
  },
  connections: ['laminar_hood', 'paper_towel', 'table', 'petri']
};

export const WATER_SPRAY_META = {
  category: 'hydration',
  purpose: 'Borrifador de Água Destilada — hidratar bolos na Estufa e Monotub 24L com névoa fina sem agredir o micélio',
  weightGrams: 390,
  baseTempC: 21.0,
  compatibilities: {
    canEnterCooker: false,
    canHydrateGreenhouse: true,
    canHydrateMonotub: true
  },
  connections: ['monotub', 'greenhouse_slot', 'distilled_jug', 'lab_sink']
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
  // Hitbox invisível ampliada para facilitar clique/toque no borrifador
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.28, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitProxy.visible = false;
  hitProxy.position.y = 0.14;
  ag.add(bottle, neck, nozzle, trig, hitProxy);
  ag.userData.isAlcoholSpray = true;
  ag.userData.sprayTrig = trig;
  ag.userData.sprayNozzle = nozzle;
  return registerPickable(ctx, id, 'Borrifador Álcool 70%', ag, px, py, pz, Math.PI / 2, 0.12, 0.26, ALCOHOL_SPRAY_META);
}

export const H2O2_SPRAY_META = {
  category: 'sanitization',
  purpose: 'Água Oxigenada 3% (Peróxido) — dissolve e cura mofo Cobweb (Teia de Aranha) em bolos/monotubs',
  weightGrams: 340,
  baseTempC: 20.5,
  compatibilities: {
    canEnterCooker: false,
    treatsCobwebMold: true
  },
  connections: ['monotub', 'greenhouse_slot', 'spawn_jar']
};

export function makeH2O2SprayBottle(ctx, id, px, py, pz) {
  const ag = new THREE.Group();
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.058, 0.17, 16),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35 })
  );
  bottle.position.y = 0.085;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054, 0.055, 0.065, 16),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4 })
  );
  band.position.y = 0.095;
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.032, 0.045, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })
  );
  neck.position.y = 0.19;
  const nozzle = makeBox(0.026, 0.026, 0.072, 0xffffff, { noShadow: true });
  nozzle.position.set(0, 0.218, 0.022);
  const trig = makeBox(0.011, 0.040, 0.016, 0x0284c7, { noShadow: true });
  trig.position.set(0, 0.198, 0.038);
  ag.add(bottle, band, neck, nozzle, trig);
  ag.userData.isH2O2Spray = true;
  ag.userData.sprayTrig = trig;
  return registerPickable(ctx, id, '🫧 Borrifador Água Oxigenada 3% (H₂O₂)', ag, px, py, pz, Math.PI / 2, 0.12, 0.25, H2O2_SPRAY_META);
}

export function makeWaterSprayBottle(ctx, id, px, py, pz) {
  const wg = new THREE.Group();
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.062, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.72, roughness: 0.18 })
  );
  bottle.position.y = 0.09;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.048, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.35 })
  );
  band.position.y = 0.095;
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.036, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  neck.position.y = 0.205;
  const nozzle = makeBox(0.028, 0.028, 0.08, 0x38bdf8, { noShadow: true });
  nozzle.position.set(0, 0.235, 0.025);
  const trig = makeBox(0.012, 0.045, 0.018, 0xf8fafc, { noShadow: true });
  trig.position.set(0, 0.212, 0.042);
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.28, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitProxy.visible = false;
  hitProxy.position.y = 0.14;
  wg.add(bottle, band, neck, nozzle, trig, hitProxy);
  wg.userData.isWaterSpray = true;
  wg.userData.sprayTrig = trig;
  wg.userData.sprayNozzle = nozzle;
  return registerPickable(ctx, id, '💧 Borrifador Água Destilada (Névoa)', wg, px, py, pz, Math.PI / 2, 0.12, 0.26, WATER_SPRAY_META);
}

/**
 * Retorna o status atual de higienizacao (0..3 borrifadas e tempo restante).
 */
export function getSanitizationStatus(target, ctx) {
  if (!target) return { hits: 0, alcoholWet: false, isSanitized: false, remainingSec: 0 };
  const isHood = target === 'hood' || (target.mesh && target.mesh.userData && target.mesh.userData.isHood);
  const nowPerf = performance.now();
  const nowEpoch = Date.now();

  if (isHood && ctx) {
    const hood = getHoodSanitationContext(ctx, target);
    const wet = !!hood.hoodAlcoholWet;
    const active = !wet && hood.hoodSanitizedUntil > nowEpoch;
    const hits = (wet || active) ? 3 : Math.min(2, hood.hoodSanitizeHits || 0);
    return {
      hits,
      alcoholWet: wet,
      isSanitized: active,
      remainingSec: active ? Math.max(1, Math.ceil((hood.hoodSanitizedUntil - nowEpoch) / 1000)) : 0
    };
  }

  const wet = !!target.alcoholWet;
  const until = target.sanitizedUntil || target._sanitizeUntil || 0;
  const active = !wet && until > nowPerf;
  const hits = (wet || active) ? 3 : Math.min(2, target._sanitizeHits || 0);
  return {
    hits,
    alcoholWet: wet,
    isSanitized: active,
    remainingSec: active ? Math.max(1, Math.ceil((until - nowPerf) / 1000)) : 0
  };
}

export function formatSprayHoverPrompt(target, label, ctx) {
  const st = getSanitizationStatus(target, ctx);
  if (st.alcoholWet) {
    return '🧻 [MOLHADO C/ ÁLCOOL 70%] ' + label + ' — Passe Papel Toalha para secar!';
  }
  if (st.isSanitized) {
    return '✨ [DESINFECTADO • ' + st.remainingSec + 's] ' + label + ' — Borrifar + Papel reseta';
  }
  return '🧴 Não higienizado (' + label + ') • Clique ou segure para borrifar Álcool 70%';
}

// Vetores reutilizados (spawnSprayParticles apenas le x/y/z, nao guarda referencia).
const _spOrigin = new THREE.Vector3();
const _spDir = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

export function spawnSprayParticles(ctx, colorHex, count, origin, dir, spread, speed, size, life) {
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
export function fireAlcoholSpray(ctx, sprayInfo, { sanitizeGloves = false } = {}) {
  if (window.MycoAudio) window.MycoAudio.playSpray();
  if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_spray');
  if (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData) {
    ctx.heldItem.mesh.userData.sprayAnimUntil = performance.now() + 160;
  }

  const spOrigin = _spOrigin.set(0.24, -0.03, -0.60).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
  const spDir = _spDir.set(0, 0, -1).applyEuler(ctx.camera.rotation).normalize();
  spawnSprayParticles(ctx, 0xe0f2fe, 30, spOrigin, spDir, 0.95, 2.5, 0.032, 0.45);

  if (!sprayInfo || !sprayInfo.target) {
    if (sanitizeGloves || !ctx.hoveredGreenhouseSlot) {
      if (sanitizeGloves && ctx.wearingGloves) {
        ctx.glovesExpired = false;
        ctx.glovesUntil = performance.now() + 160000;
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast(t('items.alcoholSpray.m1'));
        }
        if (ctx.notifyWorldAction) ctx.notifyWorldAction();
        return;
      }
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t('items.alcoholSpray.m2'));
      }
    }
    return;
  }

  const target = sprayInfo.target;
  const label = sprayInfo.label || 'Objeto';
  const isHood = target === 'hood' || (target.mesh && target.mesh.userData && target.mesh.userData.isHood);
  const st = getSanitizationStatus(target, ctx);

  if (isHood) {
    const hood = getHoodSanitationContext(ctx, target);
    hood.hoodAlcoholWet = true;
    hood.hoodSanitizeHits = 0;
    if (hood.portable) {
      hood.hoodSanitizedUntil = 0;
      ctx.queueItemStateSync?.(target);
    }
  } else if (typeof target === 'object') {
    target.alcoholWet = true;
    target._sanitizeHits = 0;
  }

  // Respinga e molha itens próximos ao redor/abaixo do ponto atingido (ex.: placa + bandeja + bisturi)
  let extraWet = 0;
  if (sprayInfo.hitPoint && ctx.pickableItems) {
    const hp = sprayInfo.hitPoint;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      if (!it || !it.mesh || it === ctx.heldItem || it === target) continue;
      if (it.mesh.userData && it.mesh.userData.isHood) {
        const hood = getHoodSanitationContext(ctx, it);
        if (!hood.hoodAlcoholWet && Math.abs(hp.x - it.mesh.position.x) <= 0.9 && Math.abs(hp.z - it.mesh.position.z) <= 0.6) {
          hood.hoodAlcoholWet = true;
          hood.hoodSanitizeHits = 0;
          if (hood.portable) {
            hood.hoodSanitizedUntil = 0;
            ctx.queueItemStateSync?.(it);
          }
          extraWet++;
        }
        continue;
      }
      const dx = it.mesh.position.x - hp.x;
      const dz = it.mesh.position.z - hp.z;
      const dy = hp.y - it.mesh.position.y;
      if (dx * dx + dz * dz <= 0.42 * 0.42 && dy >= -0.25 && dy <= 0.45) {
        if (!it.alcoholWet) {
          it.alcoholWet = true;
          it._sanitizeHits = 0;
          extraWet++;
        }
      }
    }
  }

  const burstPos = sprayInfo.hitPoint
    ? sprayInfo.hitPoint.clone()
    : spOrigin.clone().addScaledVector(spDir, 1.4);
  spawnSprayParticles(ctx, 0x38bdf8, 22, burstPos, _UP, 1.6, 0.6, 0.04, 0.55);
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks && ctx.callbacks.onToast && (!st.alcoholWet || extraWet > 0)) {
    const extraTxt = extraWet > 0 ? ` (+${extraWet} ao redor)` : '';
    ctx.callbacks.onToast(t('items.alcoholSpray.m3', { label, extraTxt }));
  }
}

export function fireH2O2Spray(ctx, sprayInfo) {
  if (typeof window !== 'undefined' && window.MycoAudio) {
    if (typeof window.MycoAudio.playFizz === 'function') window.MycoAudio.playFizz();
    else window.MycoAudio.playSpray();
  }
  if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_spray');
  if (ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData) {
    ctx.heldItem.mesh.userData.sprayAnimUntil = performance.now() + 160;
  }
  const spOrigin = _spOrigin.set(0.24, -0.03, -0.60).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
  const spDir = _spDir.set(0, 0, -1).applyEuler(ctx.camera.rotation).normalize();
  spawnSprayParticles(ctx, 0xf8fafc, 28, spOrigin, spDir, 0.9, 2.4, 0.035, 0.5);
  if (sprayInfo && sprayInfo.hitPoint) {
    const bp = sprayInfo.hitPoint.clone ? sprayInfo.hitPoint.clone() : new THREE.Vector3(sprayInfo.hitPoint.x, sprayInfo.hitPoint.y, sprayInfo.hitPoint.z);
    spawnSprayParticles(ctx, 0xffffff, 24, bp, _UP, 1.4, 0.55, 0.045, 0.65);
  }
}

export function fireWaterSpray(ctx, sprayInfo) {
  if (typeof window !== 'undefined' && window.MycoAudio) window.MycoAudio.playSpray();
  if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_spray');
  if (ctx && ctx.heldItem && ctx.heldItem.mesh && ctx.heldItem.mesh.userData) {
    ctx.heldItem.mesh.userData.sprayAnimUntil = performance.now() + 160;
  }
  if (ctx && ctx.camera && ctx.scene) {
    const spOrigin = _spOrigin.set(0.24, -0.03, -0.60).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
    const spDir = _spDir.set(0, 0, -1).applyEuler(ctx.camera.rotation).normalize();
    spawnSprayParticles(ctx, 0x7dd3fc, 28, spOrigin, spDir, 1.05, 2.1, 0.028, 0.5);
  }
  if (sprayInfo && sprayInfo.hitPoint && ctx && ctx.scene) {
    const bp = sprayInfo.hitPoint.clone ? sprayInfo.hitPoint.clone() : new THREE.Vector3(sprayInfo.hitPoint.x, sprayInfo.hitPoint.y, sprayInfo.hitPoint.z);
    spawnSprayParticles(ctx, 0xbae6fd, 22, bp, _UP, 1.5, 0.45, 0.035, 0.55);
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
