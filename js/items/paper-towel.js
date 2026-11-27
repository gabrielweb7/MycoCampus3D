/**
 * Rolo de Papel Toalha Asseptico (MycoCampus3D)
 * Etapa 2 do ciclo de desinfeccao: seca o Alcool 70% aplicado e reseta o tempo de protecao (120s).
 */

import { registerPickable } from './item-registry.js';
import { spawnSprayParticles } from './alcohol-spray.js';
import { getHoodSanitationContext } from './laminar-hood.js';
import { t } from '../core/i18n.js';

const THREE = window.THREE;

export const PAPER_TOWEL_META = {
  category: 'sanitization',
  purpose: 'Secar Álcool 70% e finalizar o ciclo de desinfecção asséptica (120s)',
  weightGrams: 220,
  baseTempC: 22.0,
  compatibilities: {
    canEnterCooker: false,
    driesAlcohol: true
  },
  connections: ['alcohol_spray', 'laminar_hood', 'petri', 'table']
};

export function makePaperTowelRoll(ctx, id, px, py, pz) {
  const pg = new THREE.Group();
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf1dec0, roughness: 0.9, flatShading: true });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x92704e, roughness: 0.9, side: THREE.DoubleSide });
  const profile = [[0.02, 0.014], [0.053, 0.014], [0.059, 0.020], [0.059, 0.188],
    [0.055, 0.20], [0.021, 0.20], [0.02, 0.196], [0.02, 0.014]];
  const roll = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 14), paperMat);
  roll.castShadow = true;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.20, 12, 1, true), coreMat);
  core.position.y = 0.102;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.059, 0.055, 0.020, 14),
    new THREE.MeshStandardMaterial({ color: 0x71816c, roughness: 0.81 }));
  band.position.y = 0.01;
  const fold = new THREE.BufferGeometry();
  fold.setAttribute('position', new THREE.Float32BufferAttribute([
    0.040, 0.190, 0.042,  0.065, 0.112, 0.057,  0.052, 0.193, 0.006,
    0.065, 0.112, 0.057,  0.071, 0.106, 0.019,  0.052, 0.193, 0.006,
    0.065, 0.112, 0.057,  0.063, 0.013, 0.049,  0.071, 0.106, 0.019,
    0.063, 0.013, 0.049,  0.075, 0.022, 0.004,  0.071, 0.106, 0.019
  ], 3));
  fold.computeVertexNormals();
  const flap = new THREE.Mesh(fold, new THREE.MeshStandardMaterial({ color: 0xe8d1b1, side: THREE.DoubleSide, roughness: 0.92 }));
  pg.userData.firstPersonGrip = { x: -0.019, y: 0.078, z: 0.057 };

  // Hitbox invisível ampliada para facilitar clique/toque no papel toalha
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.26, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitProxy.position.y = 0.12;

  pg.add(roll, core, band, flap, hitProxy);
  pg.userData.isPaperTowel = true;
  return registerPickable(ctx, id, 'Papel Toalha Asséptico', pg, px, py, pz, 0, 0.12, 0.21, PAPER_TOWEL_META);
}

/**
 * Seca o alcool 70% e finaliza/reseta o temporizador de desinfeccao (120s).
 */
function dryTarget(ctx, target, nowPerf) {
  target.alcoholWet = false;
  target.sanitizedUntil = nowPerf + 120000;
  target._sanitizeUntil = nowPerf + 120000;
  target._sanitizeHits = 0;
}

export function wipeWithPaperTowel(ctx, wipeInfo) {
  if (window.MycoAudio) window.MycoAudio.playSpray();
  if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_wipe');
  if (!wipeInfo || !wipeInfo.target) {
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(t('items.paperTowel.m1'));
    }
    return;
  }

  const target = wipeInfo.target;
  const label = wipeInfo.label || 'Objeto';
  const nowPerf = performance.now();
  if (ctx.heldItem?.mesh.userData.isPaperTowel) ctx.heldItem.mesh.userData.wipeStartedAt = nowPerf;
  const isHood = target === 'hood' || (target.mesh && target.mesh.userData && target.mesh.userData.isHood);

  if (isHood) {
    const hood = getHoodSanitationContext(ctx, target);
    const hadWet = !!hood.hoodAlcoholWet;
    const wasActive = hood.hoodSanitizedUntil > Date.now();
    if (!hadWet && !wasActive) {
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast(t('items.paperTowel.m2'));
      }
      return;
    }
    hood.hoodAlcoholWet = false;
    hood.hoodSanitizeHits = 0;
    hood.hoodSanitizedUntil = Date.now() + 120000;
    if (hood.portable) {
      ctx.queueItemStateSync?.(target);
      ctx.notifyWorldAction?.();
    } else {
      ctx.queueWorldStateChange('hood_sanitized_until', 1);
    }
    if (ctx.callbacks && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('sanitize_hood');
    let extraDry = 0;
    if (ctx.hoverHit && ctx.hoverHit.point && ctx.pickableItems) {
      const hp = ctx.hoverHit.point;
      for (let i = 0; i < ctx.pickableItems.length; i++) {
        const it = ctx.pickableItems[i];
        if (!it || !it.mesh || !it.alcoholWet) continue;
        const dx = it.mesh.position.x - hp.x;
        const dz = it.mesh.position.z - hp.z;
        if (dx * dx + dz * dz <= 0.45 * 0.45) {
          dryTarget(ctx, it, nowPerf);
          extraDry++;
        }
      }
      spawnSprayParticles(ctx, 0xf8fafc, 16, ctx.hoverHit.point.clone(), new THREE.Vector3(0, 1, 0), 1.2, 0.45, 0.035, 0.4);
    }
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks && ctx.callbacks.onToast) {
      const ex = extraDry > 0 ? ` (+${extraDry} ao redor)` : '';
      ctx.callbacks.onToast(hadWet
        ? `✨🧻 Fluxo Laminar${ex} seco e desinfectado (120s)!`
        : `✨🧻 Proteção do Fluxo Laminar${ex} resetada para 120s!`);
    }
    return;
  }

  const hadWet = !!target.alcoholWet;
  const wasActive = (target.sanitizedUntil || 0) > nowPerf;
  if (!hadWet && !wasActive) {
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('⚠️ Aplique primeiro Álcool 70% em ' + label + ' antes de secar.');
    }
    return;
  }

  dryTarget(ctx, target, nowPerf);
  let extraDry = 0;
  if (ctx.hoverHit && ctx.hoverHit.point && ctx.pickableItems) {
    const hp = ctx.hoverHit.point;
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      if (!it || !it.mesh || it === target || !it.alcoholWet) continue;
      const dx = it.mesh.position.x - hp.x;
      const dz = it.mesh.position.z - hp.z;
      if (dx * dx + dz * dz <= 0.42 * 0.42) {
        dryTarget(ctx, it, nowPerf);
        extraDry++;
      }
    }
    spawnSprayParticles(ctx, 0xf8fafc, 14, ctx.hoverHit.point.clone(), new THREE.Vector3(0, 1, 0), 1.1, 0.4, 0.032, 0.38);
  }
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks && ctx.callbacks.onToast) {
    const ex = extraDry > 0 ? ` (+${extraDry} ao redor)` : '';
    ctx.callbacks.onToast(hadWet
      ? `✨🧻 ${label}${ex} seco e desinfectado (120s)!`
      : `✨🧻 Desinfecção de ${label}${ex} resetada para 120s!`);
  }
}
