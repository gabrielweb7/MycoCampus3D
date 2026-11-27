/**
 * Borrifador Alcool 70%, Particulas de Spray e Higienizacao Universal 3x (MycoCampus3D)
 */

import { makeChamferedBox, makeSideProfile } from './lab-prop-shapes.js';
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

function makeSprayModel(bodyColor, accent, withProxy = true) {
  const group = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xead6b7, roughness: 0.76 });
  const trim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.76, flatShading: true });
  const profile = [
    [0, 0], [0.048, 0], [0.059, 0.013], [0.059, 0.137],
    [0.053, 0.155], [0.027, 0.181], [0.024, 0.205], [0, 0.205]
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(profile, 12, Math.PI / 12),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.75, flatShading: true }));
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.047, 12, 1, true, Math.PI / 12), cream);
  label.position.y = 0.079;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.009, 12, 1, true, Math.PI / 12), trim);
  stripe.position.y = 0.051;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.029, 0.026, 12), trim);
  collar.position.y = 0.195;

  const nozzle = makeSideProfile([
    [-0.035, 0.037], [0.057, 0.037], [0.067, 0.026], [0.066, 0.004],
    [0.035, 0.002], [0.011, -0.013], [-0.016, -0.013], [-0.035, 0.009]
  ], 0.048, 0.005, cream);
  nozzle.position.y = 0.211;
  const tip = makeChamferedBox(0.038, 0.035, 0.020, 0.005, cream);
  tip.position.set(0, 0.019, 0.068);
  const opening = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.0015, 9), trim);
  opening.rotation.x = Math.PI / 2;
  opening.position.z = 0.010;
  tip.add(opening);
  nozzle.add(tip);
  const trigger = makeSideProfile([
    [-0.015, 0.008], [0.003, 0.008], [0.008, -0.017],
    [0.027, -0.055], [0.021, -0.063], [0.009, -0.058], [-0.006, -0.027]
  ], 0.023, 0.003, trim);
  trigger.position.set(0, 0.215, 0.042);

  const drop = new THREE.Shape();
  drop.moveTo(0, 0.013);
  drop.quadraticCurveTo(0.018, -0.008, 0, -0.011);
  drop.quadraticCurveTo(-0.018, -0.008, 0, 0.013);
  const emblem = new THREE.Mesh(new THREE.ShapeGeometry(drop, 4), trim);
  emblem.position.set(0, 0.080, 0.061);
  group.add(bottle, label, stripe, collar, nozzle, trigger, emblem);

  if (withProxy) {
    // Volume invisível para facilitar a seleção com mouse e toque.
    const hitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.28, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hitProxy.visible = false;
    hitProxy.position.y = 0.14;
    group.add(hitProxy);
  }
  group.userData.sprayOutlet = opening;
  return { group, nozzle, trigger };
}

export function makeAlcoholSprayBottle(ctx, id, px, py, pz) {
  const { group: ag, nozzle, trigger: trig } = makeSprayModel(0xd69c91, 0x87a491);
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
  const { group: ag, trigger: trig } = makeSprayModel(0xdfcc9e, 0x847099, false);
  ag.userData.isH2O2Spray = true;
  ag.userData.sprayTrig = trig;
  return registerPickable(ctx, id, '🫧 Borrifador Água Oxigenada 3% (H₂O₂)', ag, px, py, pz, Math.PI / 2, 0.12, 0.25, H2O2_SPRAY_META);
}

export function makeWaterSprayBottle(ctx, id, px, py, pz) {
  const { group: wg, nozzle, trigger: trig } = makeSprayModel(0x79aeb8, 0x537389);
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

function aimSprayParticles(ctx, hitPoint) {
  const mesh = ctx.heldItem?.mesh;
  if (mesh?.userData.sprayOutlet) {
    mesh.userData.sprayOutlet.getWorldPosition(_spOrigin);
  } else {
    _spOrigin.set(0.24, -0.03, -0.60).applyEuler(ctx.camera.rotation).add(ctx.camera.position);
  }
  if (hitPoint) _spDir.copy(hitPoint).sub(_spOrigin).normalize();
  else _spDir.set(0, 0, -1).applyEuler(ctx.camera.rotation);
}

export function spawnSprayParticles(ctx, colorHex, count, origin, dir, spread, speed, size, life, originWidth = 0.08) {
  const spArr = new Float32Array(count * 3);
  const spVel = new Float32Array(count * 3);
  for (let si = 0; si < count; si++) {
    spArr[si * 3] = origin.x + (Math.random() - 0.5) * originWidth;
    spArr[si * 3 + 1] = origin.y + (Math.random() - 0.5) * originWidth;
    spArr[si * 3 + 2] = origin.z + (Math.random() - 0.5) * originWidth;
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

  aimSprayParticles(ctx, sprayInfo?.hitPoint);
  spawnSprayParticles(ctx, 0xe0f2fe, 30, _spOrigin, _spDir, 0.95, 2.5, 0.032, 0.45, 0.006);

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
  aimSprayParticles(ctx, sprayInfo?.hitPoint);
  spawnSprayParticles(ctx, 0xf8fafc, 28, _spOrigin, _spDir, 0.9, 2.4, 0.035, 0.5, 0.006);
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
    aimSprayParticles(ctx, sprayInfo?.hitPoint);
    spawnSprayParticles(ctx, 0x7dd3fc, 28, _spOrigin, _spDir, 1.05, 2.1, 0.028, 0.5, 0.006);
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
