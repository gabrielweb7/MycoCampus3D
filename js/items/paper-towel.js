/**
 * Rolo de Papel Toalha Asseptico (MycoCampus3D)
 * Etapa 2 do ciclo de desinfeccao: seca o Alcool 70% aplicado e reseta o tempo de protecao (120s).
 */

import { registerPickable } from './item-registry.js';
import { spawnSprayParticles } from './alcohol-spray.js';

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
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });

  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.20, 18), paperMat);
  roll.position.y = 0.10;
  roll.castShadow = true;

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.204, 12), coreMat);
  core.position.y = 0.10;

  const flap = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.18, 0.07),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 })
  );
  flap.position.set(0.058, 0.10, 0.02);
  flap.rotation.y = 0.35;

  // Hitbox invisível ampliada para facilitar clique/toque no papel toalha
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.26, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitProxy.position.y = 0.12;

  pg.add(roll, core, flap, hitProxy);
  pg.userData.isPaperTowel = true;
  return registerPickable(ctx, id, 'Papel Toalha Asséptico', pg, px, py, pz, 0, 0.12, 0.21, PAPER_TOWEL_META);
}

/**
 * Seca o alcool 70% e finaliza/reseta o temporizador de desinfeccao (120s).
 */
export function wipeWithPaperTowel(ctx, wipeInfo) {
  if (window.MycoAudio) window.MycoAudio.playSpray();
  if (!wipeInfo || !wipeInfo.target) {
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('🧻 Aponte para o Fluxo Laminar ou item com Álcool 70% para secar.');
    }
    return;
  }

  const target = wipeInfo.target;
  const label = wipeInfo.label || 'Objeto';
  const nowPerf = performance.now();
  const isHood = target === 'hood' || (target.mesh && target.mesh.userData && target.mesh.userData.isHood);

  if (isHood) {
    const hadWet = !!ctx.hoodAlcoholWet;
    const wasActive = ctx.hoodSanitizedUntil > Date.now();
    if (!hadWet && !wasActive) {
      if (ctx.callbacks && ctx.callbacks.onToast) {
        ctx.callbacks.onToast('⚠️ Passe primeiro o Álcool 70% (3x) no Fluxo Laminar antes de secar com papel.');
      }
      return;
    }
    ctx.hoodAlcoholWet = false;
    ctx.hoodSanitizeHits = 0;
    ctx.hoodSanitizedUntil = Date.now() + 120000;
    ctx.queueWorldStateChange('hood_sanitized_until', 1);
    if (ctx.callbacks && ctx.callbacks.onLabStep) ctx.callbacks.onLabStep('sanitize_hood');
    if (ctx.hoverHit && ctx.hoverHit.point) {
      spawnSprayParticles(ctx, 0xf8fafc, 16, ctx.hoverHit.point.clone(), new THREE.Vector3(0, 1, 0), 1.2, 0.45, 0.035, 0.4);
    }
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast(hadWet
        ? '✨🧻 Fluxo Laminar seco e 100% desinfectado (120s)!'
        : '✨🧻 Proteção do Fluxo Laminar resetada para 120s!');
    }
    return;
  }

  const hadWet = !!target.alcoholWet;
  const wasActive = (target.sanitizedUntil || 0) > nowPerf;
  if (!hadWet && !wasActive) {
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('⚠️ Aplique primeiro Álcool 70% (3x) em ' + label + ' antes de secar.');
    }
    return;
  }

  target.alcoholWet = false;
  target.sanitizedUntil = nowPerf + 120000;
  target._sanitizeUntil = nowPerf + 120000;
  target._sanitizeHits = 0;

  if (ctx.hoverHit && ctx.hoverHit.point) {
    spawnSprayParticles(ctx, 0xf8fafc, 14, ctx.hoverHit.point.clone(), new THREE.Vector3(0, 1, 0), 1.1, 0.4, 0.032, 0.38);
  }
  if (window.MycoAudio) window.MycoAudio.playClick();
  if (ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(hadWet
      ? '✨🧻 ' + label + ' seco e 100% desinfectado (120s)!'
      : '✨🧻 Desinfecção de ' + label + ' resetada para 120s!');
  }
}
