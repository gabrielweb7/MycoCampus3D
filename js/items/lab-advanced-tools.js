/**
 * Equipamentos Avançados de Micologia & Conservação (MycoCampus3D)
 *
 * 1. Microscópio Óptico Binocular 1000x (inspeção de hifas, grampos de conexão, basidiósporos,
 *    geração genética T0..T3 e diagnóstico precoce de Bacillus / Trichoderma).
 * 2. Lamparina a Álcool com Chama 3D dentro do Fluxo Laminar para flambar e re-esterilizar
 *    a lâmina do Bisturi (#24) e a agulha da Seringa até ficarem incandescentes.
 * 3. Potes Herméticos de Vidro com Sachê de Sílica Gel + Porções de Cogumelos Desidratados Crocantes (25g)
 *    saídos da Desidratadora para pesagem na balança e conservação a 0% de umidade.
 */

import { getCultureOriginLabel } from '../core/culture-origin.js';
import { makeBox } from '../engine/textures.js';
import { makeChamferedBox } from './lab-prop-shapes.js';
import { spawnCampusFxBurst } from '../engine/fx-burst.js';
import { disposeObjectResources, getCachedCanvasTexture, registerPickable } from './item-registry.js';
import { updateScalpelLabel } from './scalpel.js';
import { getContamInfo } from './contaminations.js';
import { t } from '../core/i18n.js';

const THREE = window.THREE;

export const alcoholLamps = [];
let microscopeAnimFrame = null;

function playAudio(method) {
  if (typeof window !== 'undefined' && window.MycoAudio && typeof window.MycoAudio[method] === 'function') {
    window.MycoAudio[method]();
  }
}

// ============================================================================
// 1. LAMPARINA A ÁLCOOL (FLAMBAGEM DE BISTURI & SERINGA NO FLUXO LAMINAR)
// ============================================================================
export function makeAlcoholLamp(ctx, id, px, py, pz) {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.48,
    roughness: 0.12,
    depthWrite: false
  });
  const alcoholLiquidMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.52,
    roughness: 0.1,
    depthWrite: false
  });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.82, roughness: 0.25 });
  const wickMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 });
  const outerFlameMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.88
  });
  const innerFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.92
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, 0.055, 16), glassMat);
  body.position.y = 0.0275;
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.042, 0.036, 14), alcoholLiquidMat);
  liquid.position.y = 0.020;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.016, 14), brassMat);
  collar.position.y = 0.062;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.018, 8), wickMat);
  wick.position.y = 0.074;

  const flameGroup = new THREE.Group();
  flameGroup.position.y = 0.084;
  const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.036, 10), outerFlameMat);
  outerFlame.position.y = 0.016;
  const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.020, 8), innerFlameMat);
  innerFlame.position.y = 0.010;
  flameGroup.add(outerFlame, innerFlame);

  g.add(body, liquid, collar, wick, flameGroup);
  g.userData.isAlcoholLamp = true;

  const item = registerPickable(
    ctx,
    id,
    '🔥 Lamparina a Álcool (Acesa • Clique mover • Flambar Bisturi/Seringa)',
    g,
    px,
    py,
    pz,
    0,
    0.07,
    0.12,
    {
      category: 'sterilization_tool',
      purpose: 'Flambar lâmina do bisturi ou agulha da seringa até a incandescência para esterilizar no Fluxo Laminar',
      weightGrams: 165,
      getTempC: (it) => (it && it.alcoholLampCtrl && it.alcoholLampCtrl.lit ? 680.0 : 23.0),
      compatibilities: { canEnterCooker: false, isAlcoholLamp: true },
      serializeState: (it) => {
        const lc = it && it.alcoholLampCtrl;
        if (!lc) return null;
        return { lit: !!lc.lit };
      },
      applyState: (it, custom) => {
        const lc = it && it.alcoholLampCtrl;
        if (!lc || !custom) return;
        lc.lit = !!custom.lit;
        if (lc.updateVisual) lc.updateVisual();
      }
    }
  );

  item.alcoholLampCtrl = {
    lit: true,
    flameGroup,
    outerFlame,
    innerFlame,
    phase: 0,
    updateVisual: () => {
      const lit = item.alcoholLampCtrl.lit;
      flameGroup.visible = lit;
      item.label = lit
        ? '🔥 Lamparina a Álcool (Acesa • Clique mover • Flambar Bisturi/Seringa)'
        : '🕯️ Lamparina a Álcool (Apagada • Clique mover)';
    }
  };
  alcoholLamps.push(item);
  return item;
}

export function interactAlcoholLamp(ctx, lampItem) {
  if (!lampItem || !lampItem.alcoholLampCtrl) return false;
  const lc = lampItem.alcoholLampCtrl;
  const held = ctx.heldItem;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;

  // 1. Flambar Bisturi na chama acesa -> fica incandescente e 100% estéril!
  if (held && held.scalpelCtrl) {
    if (!lc.lit) {
      lc.lit = true;
      lc.updateVisual();
    }
    const sc = held.scalpelCtrl;
    if (!sc.hasBlade) {
      if (onToast) onToast(t('items.labAdvancedTools.m1'));
      return true;
    }
    sc.sterile = true;
    sc.bladeExpired = false;
    sc.bladeContaminated = false;
    sc.cutContaminated = false;
    sc.hasMycelium = false;
    sc.isSporeSample = false;
    sc.origin = '';
    sc.lastGeneticsKey = '';
    sc.bladeAttachedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    sc.flameGlowTimer = 2.2;
    if (sc.bladeMesh && sc.bladeMesh.material && sc.bladeMesh.material.emissive) {
      sc.bladeMesh.material.emissive.setHex(0xf97316);
      sc.bladeMesh.material.emissiveIntensity = 1.6;
    }
    updateScalpelLabel(held);
    playAudio('playSpray');
    if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_flame');
    if (ctx && ctx.scene && lampItem.mesh) {
      spawnCampusFxBurst(ctx.scene, {
        x: lampItem.mesh.position.x,
        y: lampItem.mesh.position.y + 0.12,
        z: lampItem.mesh.position.z
      }, 0xf97316, 8);
    }
    if (typeof window !== 'undefined') window.triggerCampusHaptic?.('success');
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
    if (onToast) {
      onToast(t('items.labAdvancedTools.m2'));
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 2. Flambar agulha da Seringa na chama acesa -> elimina contaminação da agulha!
  if (held && held.mesh && held.mesh.userData && held.mesh.userData.syrCtrl) {
    if (!lc.lit) {
      lc.lit = true;
      lc.updateVisual();
    }
    const syr = held.mesh.userData.syrCtrl;
    syr.sourceContam = false;
    held.sanitizedUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 160000;
    playAudio('playSpray');
    if (onToast) {
      onToast(t('items.labAdvancedTools.m3'));
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 3. Alternar chama acesa / apagada
  lc.lit = !lc.lit;
  lc.updateVisual();
  if (ctx.markItemMoved) ctx.markItemMoved(lampItem);
  playAudio('playClick');
  if (onToast) {
    onToast(lc.lit ? '🔥 Lamparina a Álcool acesa!' : '🕯️ Lamparina a Álcool apagada.');
  }
  if (ctx.notifyWorldAction) ctx.notifyWorldAction();
  return true;
}

export function stepAlcoholLamps(ctx, dt) {
  for (let i = 0; i < alcoholLamps.length; i++) {
    const item = alcoholLamps[i];
    const lc = item && item.alcoholLampCtrl;
    if (!lc || !lc.lit) continue;
    lc.phase += dt * 14;
    const sY = 0.92 + Math.sin(lc.phase) * 0.14 + Math.cos(lc.phase * 1.7) * 0.06;
    const sXZ = 0.95 + Math.cos(lc.phase * 1.3) * 0.08;
    lc.flameGroup.scale.set(sXZ, sY, sXZ);
    lc.flameGroup.rotation.z = Math.sin(lc.phase * 0.8) * 0.09;
  }

  // Resfria gradualmente o brilho incandescente da lâmina do bisturi flambado
  if (ctx && ctx.pickableItems) {
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      const sc = it && it.scalpelCtrl;
      if (sc && sc.flameGlowTimer > 0) {
        sc.flameGlowTimer = Math.max(0, sc.flameGlowTimer - dt);
        if (sc.flameGlowTimer <= 0 && sc.bladeMesh && sc.bladeMesh.material && sc.bladeMesh.material.emissive) {
          sc.bladeMesh.material.emissive.setHex(0x475569);
          sc.bladeMesh.material.emissiveIntensity = 0.35;
        }
      }
    }
  }
}

// ============================================================================
// 2. MICROSCÓPIO ÓPTICO BINOCULAR 1000X (ANÁLISE DE HIFAS, ESPOROS & CONTAMINAÇÃO)
// ============================================================================
export function makeLabMicroscope(ctx, id, px, py, pz) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe6cca6, roughness: 0.72 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x626e58, roughness: 0.76 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.55, roughness: 0.1 });

  const base = makeChamferedBox(0.18, 0.032, 0.22, 0.008, darkMetalMat);
  base.position.y = 0.016;
  const lightWell = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.018, 14), lensMat);
  lightWell.position.set(0, 0.038, 0.03);

  const arm = makeChamferedBox(0.055, 0.155, 0.061, 0.012, bodyMat);
  arm.position.set(0, 0.109, -0.066);
  arm.rotation.x = -0.16;
  const shoulder = makeChamferedBox(0.064, 0.125, 0.065, 0.014, bodyMat);
  shoulder.position.set(0, 0.207, -0.064);
  shoulder.rotation.x = 0.46;
  const focus = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.027, 0.012, 12), darkMetalMat);
  focus.rotation.z = Math.PI / 2;
  focus.position.set(0.033, 0.108, -0.061);
  const oppositeFocus = focus.clone();
  oppositeFocus.position.x *= -1;

  const stage = makeChamferedBox(0.13, 0.012, 0.12, 0.004, 0x464740);
  stage.position.set(0, 0.13, 0.025);

  // Lâmina de vidro com lamínula em cima do estágio!
  const slideMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x0284c7,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.78,
    roughness: 0.1
  });
  const glassSlide = makeBox(0.075, 0.004, 0.026, slideMat, { noShadow: true });
  glassSlide.position.set(0, 0.138, 0.025);

  const head = makeChamferedBox(0.09, 0.065, 0.11, 0.013, bodyMat);
  head.position.set(0, 0.26, -0.01);

  const scopeGlass = new THREE.MeshStandardMaterial({ color: 0x334640, roughness: 0.38 });
  [-0.022, 0.022].forEach((ox) => {
    const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.013, 0.062, 10), darkMetalMat);
    eyepiece.position.set(ox, 0.31, 0.035);
    eyepiece.rotation.x = -0.55;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.002, 10), scopeGlass);
    glass.position.y = 0.032;
    eyepiece.add(glass);
    g.add(eyepiece);
  });

  // Revólver com 3 objetivas (40x, 400x, 1000x)
  const revolver = new THREE.Group();
  revolver.position.set(0, 0.22, 0.025);
  [-0.02, 0, 0.02].forEach((ox, idx) => {
    const objLens = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.038 + idx * 0.006, 10), bodyMat);
    objLens.position.set(ox, -0.02, 0);
    revolver.add(objLens);
  });

  g.add(base, lightWell, arm, shoulder, focus, oppositeFocus, stage, glassSlide, head, revolver);
  g.userData.isMicroscope = true;

  const item = registerPickable(
    ctx,
    id,
    '🔬 Microscópio Óptico 1000x (Clique analisar • [G]/Botão Dir. mover)',
    g,
    px,
    py,
    pz,
    0,
    0.14,
    0.34,
    {
      category: 'analytical_equipment',
      purpose: 'Analisar lâminas de esporos, grampos de conexão das hifas (T0-T3) e diagnosticar contaminações microscópicas',
      weightGrams: 3400,
      compatibilities: { canEnterCooker: false, isMicroscope: true }
    }
  );
  let scopeTimer = null;
  item.microscopeCtrl = {
    magnification: 1000,
    pulseAnalyze: (contaminated) => {
      lensMat.emissive.setHex(contaminated ? 0xef4444 : 0x22c55e);
      lensMat.emissiveIntensity = 1.8;
      slideMat.emissive.setHex(contaminated ? 0xef4444 : 0x38bdf8);
      slideMat.emissiveIntensity = 1.2;
      revolver.rotation.y += Math.PI / 3;
      if (scopeTimer) clearTimeout(scopeTimer);
      scopeTimer = setTimeout(() => {
        lensMat.emissive.setHex(0x0284c7);
        lensMat.emissiveIntensity = 0.55;
        slideMat.emissive.setHex(0x0284c7);
        slideMat.emissiveIntensity = 0.2;
        scopeTimer = null;
      }, 950);
    }
  };
  return item;
}

export function analyzeSpecimenForMicroscope(held) {
  if (!held) {
    return {
      title: 'Lâmina Padrão de Referência (Psilocybe cubensis • T2 Rizomórfico)',
      kind: 'mycelium',
      status: 'rhizomorphic',
      generation: 2,
      contaminated: false,
      contamType: '',
      diagnosis: '✅ Hifas dicarióticas saudáveis com grampos de conexão (clamp connections) e cordões rizomórficos densos (Isolamento T2).'
    };
  }
  const petri = held.mesh && held.mesh.userData && held.mesh.userData.petriCtrl;
  if (petri) {
    const gen = petri.generation || 0;
    const isSporePrint = petri.mode === 'spore_print';
    const contam = !!(petri.contaminated || petri.mode === 'contam' || petri.sporeContaminated || (petri.delayedContamAtPct && petri.delayedContamAtPct > 0));
    const cKind = contam ? (petri.contamKind || 'trichoderma') : '';
    const cInfo = contam ? getContamInfo(cKind) : null;
    return {
      title: held.label,
      kind: isSporePrint ? 'spores' : 'mycelium',
      status: contam ? 'contaminated' : (isSporePrint ? 'spores' : (gen >= 2 ? 'rhizomorphic' : 'tomentose')),
      generation: gen,
      speciesName: petri.speciesName || '',
      contaminated: contam,
      contamKind: cKind,
      contamType: cInfo ? cInfo.name : '',
      diagnosis: contam
        ? `🦠 ALERTA MICROSCÓPICO: ${cInfo.name} (${cInfo.scientific})! ${cInfo.microscopeNote}`
        : (isSporePrint
          ? '🔬 Basidiósporos elipsoides roxo-escuros íntegros (12×8 µm). Prontos para germinação T0 em ágar PDA!'
          : `✅ Micélio • T${gen}${getCultureOriginLabel(petri.origin) ? ' • ' + getCultureOriginLabel(petri.origin) : ''}. A imagem mostra a morfologia; a origem vem do registro do cultivo.`)
    };
  }
  if (held.spawnCtrl) {
    const sc = held.spawnCtrl;
    const gen = sc.generation || 1;
    const contam = !!(sc.contaminated || sc.pasteurizedOnly);
    const cKind = contam ? (sc.pasteurizedOnly ? 'wet_spot' : (sc.contamKind || 'trichoderma')) : '';
    const cInfo = contam ? getContamInfo(cKind) : null;
    return {
      title: held.label,
      kind: 'mycelium',
      status: contam ? 'contaminated' : (gen >= 2 ? 'rhizomorphic' : 'tomentose'),
      generation: gen,
      speciesName: sc.speciesName || '',
      contaminated: contam,
      contamKind: cKind,
      contamType: cInfo ? cInfo.name : '',
      diagnosis: contam
        ? `🦠 ALERTA: ${cInfo.name}! ${sc.pasteurizedOnly ? 'Grãos foram apenas pasteurizados a 75°C — esterilize a 121°C / 15 PSI!' : cInfo.microscopeNote}`
        : `✅ Micélio vigoroso (Geração T${gen}${sc.shaken ? ' • Break & Shake ativo' : ''}) colonizando o substrato sem competidores.`
    };
  }
  if (held.cultureCtrl) {
    const cc = held.cultureCtrl;
    const contam = !!cc.contaminated;
    const cKind = contam ? (cc.contamKind || 'wet_spot') : '';
    const cInfo = contam ? getContamInfo(cKind) : null;
    return {
      title: held.label,
      kind: 'mycelium',
      generation: cc.generation || 2,
      speciesName: cc.speciesName || '',
      contaminated: contam,
      contamKind: cKind,
      contamType: cInfo ? cInfo.name : '',
      diagnosis: contam
        ? `🦠 Cultura líquida contaminada por ${cInfo.name}! ${cInfo.microscopeNote}`
        : `✅ Hifas fragmentadas em suspensão líquida pura (${cc.speciesName || 'Cubensis'}) prontas para seringa!`
    };
  }
  if (held.monotubCtrl) {
    const mc = held.monotubCtrl;
    const cKind = mc.contaminated ? (mc.contamKind || (/cobweb/i.test(mc.contamReason || '') ? 'cobweb' : 'trichoderma')) : '';
    const cInfo = mc.contaminated ? getContamInfo(cKind) : null;
    return {
      title: held.label,
      kind: 'mycelium',
      generation: mc.generation || 2,
      speciesName: mc.speciesName || '',
      contaminated: !!mc.contaminated,
      contamKind: cKind,
      contamType: cInfo ? cInfo.name : '',
      diagnosis: mc.contaminated
        ? `🦠 ${cInfo.name} no Monotub! ${cInfo.microscopeNote}`
        : `✅ Rede micelial bulk saudável (Geração T${mc.generation || 1}${mc.hasCasing ? ' + Camada de Casing' : ''} • Flush ${mc.flush}/4).`
    };
  }
  if (held.wildMushroomCtrl) {
    return {
      title: held.label,
      kind: 'spores',
      generation: 1,
      contaminated: false,
      contamType: '',
      diagnosis: `🔬 Lamelas repletas de basídios tetraspóricos maduros de ${held.wildMushroomCtrl.speciesName}. Excelente para Carimbo de Esporos ou Biópsia!`
    };
  }
  return {
    title: held.label || 'Amostra do Laboratório',
    kind: 'mycelium',
    generation: 1,
    contaminated: false,
    contamType: '',
    diagnosis: '🔬 Superfície inspecionada em 1000x sem esporos contaminantes visíveis.'
  };
}

function ensureMicroscopeModalDom() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('microscope-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'microscope-modal';
  modal.className = 'hidden fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-2 sm:p-4';
  modal.innerHTML = `
    <div class="glass-panel modal-card-md rounded-2xl w-full flex flex-col border border-cyan-400/50 overflow-hidden shadow-2xl">
      <div class="p-3 sm:p-4 border-b border-slate-700/60 flex items-center justify-between gap-2 bg-slate-900/65">
        <div class="min-w-0">
          <h2 class="text-sm sm:text-base font-extrabold text-cyan-300 truncate">🔬 Microscópio Óptico Binocular (1000x)</h2>
          <p id="micro-specimen-title" class="text-[11px] text-slate-300 truncate">Lâmina em foco</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button id="btn-move-microscope" type="button"
            class="px-2.5 py-1.5 rounded-lg bg-emerald-600/85 hover:bg-emerald-500 text-white text-xs font-bold">📦 Pegar</button>
          <button id="btn-close-microscope" type="button"
            class="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold">✕ Fechar</button>
        </div>
      </div>
      <div class="p-3 sm:p-4 overflow-y-auto space-y-3 text-xs flex flex-col items-center">
        <div class="flex flex-wrap items-center justify-center gap-1.5 w-full">
          <span class="text-[11px] font-bold text-slate-400 mr-1">Objetiva:</span>
          <button data-mag="40" type="button" class="micro-mag-btn px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold text-[11px]">40x</button>
          <button data-mag="100" type="button" class="micro-mag-btn px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold text-[11px]">100x</button>
          <button data-mag="400" type="button" class="micro-mag-btn px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold text-[11px]">400x</button>
          <button data-mag="1000" type="button" class="micro-mag-btn px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-extrabold text-[11px]">1000x Óleo</button>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-1.5 w-full">
          <span class="text-[11px] font-bold text-slate-400 mr-1">Corante:</span>
          <button data-stain="natural" type="button" class="micro-stain-btn px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-extrabold text-[11px]">Natural</button>
          <button data-stain="lactophenol" type="button" class="micro-stain-btn px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 font-bold text-[11px]">Azul Lactofenol</button>
          <button data-stain="congo" type="button" class="micro-stain-btn px-2.5 py-1 rounded-lg bg-slate-800 text-rose-300 font-bold text-[11px]">Vermelho Congo</button>
        </div>
        <div class="relative rounded-full p-1.5 bg-slate-950 border-4 border-cyan-500/60 shadow-inner">
          <canvas id="microscope-lens-canvas" width="240" height="240" class="rounded-full block transition-[filter] duration-100"></canvas>
        </div>
        <div class="w-full max-w-xs flex items-center gap-2 text-[11px] text-slate-300">
          <span class="font-bold shrink-0">🔍 Foco:</span>
          <input id="micro-focus-slider" type="range" min="-5" max="5" step="1" value="0" class="w-full accent-cyan-400">
          <span id="micro-focus-val" class="font-mono text-cyan-300 w-10 text-right">Nitido</span>
        </div>
        <div id="micro-diagnosis-box" class="w-full rounded-xl bg-slate-900/85 border border-cyan-500/35 p-3 text-slate-100 font-semibold leading-relaxed"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => {
    modal.classList.add('hidden');
    if (microscopeAnimFrame) {
      cancelAnimationFrame(microscopeAnimFrame);
      microscopeAnimFrame = null;
    }
  };
  modal._closeModal = close;
  modal.querySelector('#btn-close-microscope')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  return modal;
}

export function interactLabMicroscope(ctx, scopeItem) {
  const info = analyzeSpecimenForMicroscope(ctx && ctx.heldItem);
  if (ctx && ctx.pickableItems) {
    for (let i = 0; i < ctx.pickableItems.length; i++) {
      const it = ctx.pickableItems[i];
      if (it && it.microscopeCtrl && it.microscopeCtrl.pulseAnalyze) {
        it.microscopeCtrl.pulseAnalyze(info.contaminated);
      }
    }
  }
  playAudio('playClick');
  if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(info.diagnosis);
  }
  const modal = ensureMicroscopeModalDom();
  if (!modal) return true;

  const moveBtn = modal.querySelector('#btn-move-microscope');
  if (moveBtn) {
    moveBtn.onclick = () => {
      if (modal._closeModal) modal._closeModal();
      if (ctx && ctx.pickHoveredItemForMove && scopeItem) {
        ctx.pickHoveredItemForMove(scopeItem);
      }
    };
  }

  const titleEl = modal.querySelector('#micro-specimen-title');
  const diagEl = modal.querySelector('#micro-diagnosis-box');
  const canvas = modal.querySelector('#microscope-lens-canvas');
  if (titleEl) titleEl.textContent = info.title;
  if (diagEl) {
    diagEl.textContent = info.diagnosis;
    diagEl.className = 'w-full rounded-xl p-3 font-semibold leading-relaxed border ' + (info.contaminated
      ? 'bg-rose-950/70 border-rose-500/55 text-rose-100'
      : 'bg-emerald-950/60 border-emerald-500/45 text-emerald-100');
  }
  modal.classList.remove('hidden');

  if (canvas && canvas.getContext) {
    const c = canvas.getContext('2d');
    let phase = 0;
    let currentMag = 1000;
    let currentStain = 'natural';
    let focusBlur = 0;

    const magBtns = modal.querySelectorAll('.micro-mag-btn');
    const stainBtns = modal.querySelectorAll('.micro-stain-btn');
    const focusSlider = modal.querySelector('#micro-focus-slider');
    const focusLabel = modal.querySelector('#micro-focus-val');

    const syncControls = () => {
      magBtns.forEach((b) => {
        const active = Number(b.getAttribute('data-mag')) === currentMag;
        b.className = 'micro-mag-btn px-2.5 py-1 rounded-lg text-[11px] transition ' +
          (active ? 'bg-cyan-500 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-200 font-bold hover:bg-slate-700');
      });
      stainBtns.forEach((b) => {
        const active = b.getAttribute('data-stain') === currentStain;
        b.className = 'micro-stain-btn px-2.5 py-1 rounded-lg text-[11px] transition ' +
          (active ? 'bg-cyan-500 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-200 font-bold hover:bg-slate-700');
      });
    };
    magBtns.forEach((b) => {
      b.onclick = () => {
        currentMag = Number(b.getAttribute('data-mag')) || 1000;
        playAudio('playClick');
        syncControls();
      };
    });
    stainBtns.forEach((b) => {
      b.onclick = () => {
        currentStain = b.getAttribute('data-stain') || 'natural';
        playAudio('playClick');
        syncControls();
      };
    });
    if (focusSlider) {
      focusSlider.value = '0';
      canvas.style.filter = 'none';
      if (focusLabel) focusLabel.textContent = 'Nítido';
      focusSlider.oninput = () => {
        focusBlur = Math.abs(Number(focusSlider.value) || 0);
        canvas.style.filter = focusBlur > 0 ? `blur(${focusBlur * 0.9}px)` : 'none';
        if (focusLabel) focusLabel.textContent = focusBlur === 0 ? 'Nítido' : 'Desf.';
      };
    }
    syncControls();

    const renderLens = () => {
      if (modal.classList.contains('hidden')) return;
      phase += 0.038;
      c.clearRect(0, 0, 240, 240);

      const zoomFactor = currentMag === 40 ? 0.55 : (currentMag === 100 ? 0.72 : (currentMag === 400 ? 0.92 : 1.15));
      const bgInner = currentStain === 'lactophenol' ? '#dbeafe' : (currentStain === 'congo' ? '#ffe4e6' : (info.contaminated ? '#fef2f2' : '#f0f9ff'));
      const bgOuter = currentStain === 'lactophenol' ? '#60a5fa' : (currentStain === 'congo' ? '#fda4af' : (info.contaminated ? '#fecdd3' : '#bae6fd'));
      const hyphaCol = currentStain === 'lactophenol' ? 'rgba(29, 78, 216, 0.85)' : (currentStain === 'congo' ? 'rgba(190, 18, 60, 0.85)' : 'rgba(30, 64, 175, 0.74)');

      const bg = c.createRadialGradient(120, 120, 18, 120, 120, 120);
      bg.addColorStop(0, bgInner);
      bg.addColorStop(0.84, bgOuter);
      bg.addColorStop(1, '#0f172a');
      c.fillStyle = bg;
      c.fillRect(0, 0, 240, 240);

      c.strokeStyle = 'rgba(15, 23, 42, 0.18)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(40, 120); c.lineTo(200, 120);
      c.moveTo(120, 40); c.lineTo(120, 200);
      c.stroke();

      c.save();
      c.translate(120, 120);
      c.scale(zoomFactor, zoomFactor);

      if (info.kind === 'spores') {
        for (let i = 0; i < 34; i++) {
          const ang = (i * 1.7) + Math.sin(phase + i) * 0.15;
          const r = 16 + ((i * 19) % 85);
          const sx = Math.cos(ang) * r + Math.sin(phase * 1.4 + i) * 2.5;
          const sy = Math.sin(ang) * r + Math.cos(phase * 1.2 + i) * 2.5;
          c.save();
          c.translate(sx, sy);
          c.rotate(i * 0.6 + phase * 0.3);
          c.fillStyle = '#4c1d95';
          c.beginPath();
          c.ellipse(0, 0, 6.5, 4.2, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#c4b5fd';
          c.lineWidth = 1;
          c.stroke();
          c.restore();
        }
      } else {
        const branchCount = 10 + (info.generation || 0) * 8;
        c.strokeStyle = hyphaCol;
        c.lineWidth = 1.6 + (info.generation || 0) * 0.45;
        for (let b = 0; b < branchCount; b++) {
          const a = (b / branchCount) * Math.PI * 2;
          const len = 65 + ((b * 13) % 38);
          const sway = Math.sin(phase + b) * 3.5;
          const mx = Math.cos(a + 0.18) * len * 0.55 + sway;
          const my = Math.sin(a + 0.18) * len * 0.55 + sway;
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(mx, my, Math.cos(a) * len, Math.sin(a) * len);
          c.stroke();
          // Grampos de conexão (clamp connections) visíveis em 400x/1000x
          if (!info.contaminated && currentMag >= 400 && b % 2 === 0) {
            c.fillStyle = hyphaCol;
            c.beginPath();
            c.arc(mx, my, 2.4, 0, Math.PI * 2);
            c.fill();
          }
        }
      }

      if (info.contaminated) {
        const ck = info.contamKind || 'trichoderma';
        const cHex = getContamInfo(ck).sporeHex || '#16a34a';
        c.fillStyle = cHex;
        c.strokeStyle = cHex;
        if (ck === 'wet_spot') {
          for (let k = 0; k < 30; k++) {
            const ang = k * 2.1 + phase * 1.4;
            const r = 12 + ((k * 29) % 85);
            c.save();
            c.translate(Math.cos(ang) * r, Math.sin(ang) * r);
            c.rotate(ang);
            c.beginPath();
            c.roundRect(-5, -1.6, 10, 3.2, 1.5);
            c.fill();
            c.restore();
          }
        } else if (ck === 'cobweb') {
          c.lineWidth = 2.2;
          for (let w = 0; w < 14; w++) {
            const a1 = w * 0.45 + Math.sin(phase + w) * 0.08;
            c.beginPath();
            c.moveTo(Math.cos(a1) * 15, Math.sin(a1) * 15);
            c.lineTo(Math.cos(a1 + 0.6) * 95, Math.sin(a1 + 0.6) * 95);
            c.stroke();
          }
        } else {
          for (let k = 0; k < 28; k++) {
            const kx = ((k * 37) % 150) - 75 + Math.sin(phase * 2.6 + k) * 3.5;
            const ky = ((k * 53) % 150) - 75 + Math.cos(phase * 2.6 + k) * 3.5;
            c.beginPath();
            c.arc(kx, ky, ck === 'aspergillus' ? 5.6 : 4.2, 0, Math.PI * 2);
            c.fill();
          }
        }
      }
      c.restore();

      c.fillStyle = 'rgba(15, 23, 42, 0.78)';
      c.fillRect(68, 212, 104, 18);
      c.fillStyle = '#38bdf8';
      c.font = 'bold 10px monospace';
      c.textAlign = 'center';
      c.fillText(`${currentMag}x • ${currentStain.toUpperCase()}`, 120, 224);

      if (typeof requestAnimationFrame === 'function') {
        microscopeAnimFrame = requestAnimationFrame(renderLens);
      }
    };
    renderLens();
  }
  return true;
}

// ============================================================================
// 3. POTES HERMÉTICOS COM SÍLICA GEL & PORÇÃO DE COGUMELOS DESIDRATADOS (25G)
// ============================================================================
export function makeDriedMushroomBatch(ctx, id, speciesName, px, py, pz, grams = 10) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.65 });
  const wGrams = Number(grams) || 10;
  for (let i = -1; i <= 1; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.07, 8), stemMat);
    stem.position.set(i * 0.032, 0.02, 0);
    stem.rotation.z = i * 0.25;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.022, 10), capMat);
    cap.position.set(i * 0.04, 0.055, 0);
    g.add(stem, cap);
  }
  g.userData.isDriedMushroomBatch = true;
  const sp = speciesName || 'Psilocybe cubensis';
  const item = registerPickable(
    ctx,
    id,
    `🍄 Cogumelos Desidratados Crocantes (${sp} • ${wGrams}g • 0% UR — Guarde no Pote c/ Sílica Gel ou Saco Mylar)`,
    g,
    px,
    py,
    pz,
    0,
    0.11,
    0.09,
    {
      category: 'dried_harvest',
      purpose: 'Lote de cogumelos desidratados. Pese na balança, guarde no pote com sílica ou embale no saco Mylar.',
      getWeightGrams: (it) => it?.driedMushroomCtrl?.grams || wGrams,
      compatibilities: { canEnterCooker: false, isDriedMushroomBatch: true },
      serializeState: (it) => {
        const dc = it && it.driedMushroomCtrl;
        if (!dc) return null;
        return {
          dynamicKind: 'dried_batch',
          grams: Math.max(1, Math.min(500, Math.round(Number(dc.grams) || 10))),
          speciesName: dc.speciesName ? String(dc.speciesName).slice(0, 60) : 'Psilocybe cubensis',
          removed: !!it._removedForSync
        };
      },
      applyState: (it, custom) => {
        const dc = it && it.driedMushroomCtrl;
        if (!dc || !custom) return;
        if (custom.grams !== undefined) dc.grams = Math.max(1, Math.min(500, Math.round(Number(custom.grams) || 10)));
        if (typeof custom.speciesName === 'string' && custom.speciesName) dc.speciesName = custom.speciesName;
        it.label = `🍄 Cogumelos Desidratados Crocantes (${dc.speciesName} • ${dc.grams}g • 0% UR — Guarde no Pote c/ Sílica Gel ou Saco Mylar)`;
      }
    }
  );
  item.driedMushroomCtrl = { grams: wGrams, speciesName: sp };
  return item;
}

export function makeSilicaStorageJar(ctx, id, px, py, pz, initialOpt = 0) {
  const initObj = (initialOpt && typeof initialOpt === 'object') ? initialOpt : { storedGrams: Number(initialOpt) || 0 };
  const initialGrams = Math.max(0, Number(initObj.storedGrams) || 0);
  const initialSpecies = initObj.speciesName || 'Psilocybe cubensis';

  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.1,
    depthWrite: false
  });
  const glassRimMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.55, roughness: 0.12 });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.45, metalness: 0.2 });
  const sealRingMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const clampMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });

  // Corpo de vidro + fundo espesso + aro superior
  const baseGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.084, 0.014, 18), glassRimMat);
  baseGlass.position.y = 0.007;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.185, 18), glassMat);
  body.position.y = 0.098;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.006, 8, 20), glassRimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.188;

  // Tampa articulada (pivot atrás em z = -0.085 para abrir de verdade!)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.194, -0.085);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.022, 18), lidMat);
  lid.position.set(0, 0.008, 0.085);
  const rubberSeal = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.005, 8, 18), sealRingMat);
  rubberSeal.rotation.x = Math.PI / 2;
  rubberSeal.position.set(0, -0.003, 0.085);
  const wireClamp = makeBox(0.182, 0.048, 0.01, clampMat, { noShadow: true });
  wireClamp.position.set(0, -0.015, 0.168);
  lidPivot.add(lid, rubberSeal, wireClamp);

  // Camada de bolinhas de Sílica Gel indicadora (laranja/âmbar secas) no fundo do pote
  const silicaBeadGroup = new THREE.Group();
  const amberBeadMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, emissive: 0x92400e, emissiveIntensity: 0.15 });
  const clearBeadMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.25 });
  for (let sb = 0; sb < 18; sb++) {
    const ang = sb * 2.39996;
    const rad = 0.015 + (sb / 18) * 0.052;
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.0085, 6, 5),
      sb % 3 === 0 ? amberBeadMat : clearBeadMat
    );
    bead.position.set(Math.cos(ang) * rad, 0.02, Math.sin(ang) * rad);
    silicaBeadGroup.add(bead);
  }

  // Sachê de Sílica Gel 3D dentro do pote!
  const silicaTex = getCachedCanvasTexture('silica_gel_sachet_tex', 128, 64, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 64);
    c.strokeStyle = '#0284c7'; c.lineWidth = 4; c.strokeRect(3, 3, 122, 58);
    c.fillStyle = '#0369a1'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
    c.fillText('SÍLICA GEL', 64, 28);
    c.fillStyle = '#dc2626'; c.font = 'bold 12px sans-serif';
    c.fillText('0% UMIDADE', 64, 48);
  });
  const sachet = makeBox(0.054, 0.038, 0.01, new THREE.MeshBasicMaterial({ map: silicaTex }));
  sachet.position.set(0, 0.036, 0.056);
  sachet.rotation.x = -0.22;

  // Cogumelos desidratados 3D reais empilhados dentro do pote (vão aparecendo conforme storedGrams sobe!)
  const driedLayerGroup = new THREE.Group();
  const jarStemMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.85 });
  const jarCapMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.62 });
  const jarMushMeshes = [];
  const totalSlots = 30;
  for (let mi = 0; mi < totalSlots; mi++) {
    const layer = Math.floor(mi / 5); // 6 camadas de altura (0..5)
    const slotInLayer = mi % 5;
    const angle = slotInLayer * ((Math.PI * 2) / 5) + layer * 0.65;
    const dist = slotInLayer === 0 ? 0.008 : 0.038;
    const mGroup = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.034, 6), jarStemMat);
    const cp = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.016, 8), jarCapMat);
    cp.position.y = 0.018;
    mGroup.add(st, cp);
    mGroup.position.set(
      Math.cos(angle) * dist,
      0.036 + layer * 0.024,
      Math.sin(angle) * dist
    );
    mGroup.rotation.set(
      Math.sin(mi * 1.7) * 0.45,
      mi * 1.1,
      Math.cos(mi * 2.3) * 0.5
    );
    mGroup.visible = false;
    driedLayerGroup.add(mGroup);
    jarMushMeshes.push(mGroup);
  }

  g.add(baseGlass, body, rim, lidPivot, silicaBeadGroup, sachet, driedLayerGroup);
  g.userData.isSilicaJar = true;

  const item = registerPickable(
    ctx,
    id,
    '🫙 Pote Hermético com Sílica Gel (Vazio • 0% UR)',
    g,
    px,
    py,
    pz,
    0,
    0.11,
    0.22,
    {
      category: 'storage_jar',
      purpose: 'Pote hermético com sachê e pérolas de Sílica Gel para conservar cogumelos desidratados crocantes (clique com cogumelos p/ guardar ou mão vazia p/ retirar 10g)',
      getWeightGrams: (it) => 240 + ((it && it.silicaJarCtrl && it.silicaJarCtrl.storedGrams) || 0),
      compatibilities: { canEnterCooker: false, isSilicaStorageJar: true },
      serializeState: (it) => {
        const jc = it && it.silicaJarCtrl;
        if (!jc) return null;
        return {
          storedGrams: Math.max(0, Math.min(500, Math.round(Number(jc.storedGrams) || 0))),
          speciesName: jc.speciesName ? String(jc.speciesName).slice(0, 60) : 'Psilocybe cubensis'
        };
      },
      applyState: (it, custom) => {
        const jc = it && it.silicaJarCtrl;
        if (!jc || !custom) return;
        jc.storedGrams = Math.max(0, Math.min(jc.maxGrams || 150, Math.round(Number(custom.storedGrams) || 0)));
        if (typeof custom.speciesName === 'string' && custom.speciesName) jc.speciesName = custom.speciesName;
        if (jc.updateVisual) jc.updateVisual();
      }
    }
  );

  let lidAnimTimer = null;
  item.silicaJarCtrl = {
    storedGrams: initialGrams,
    speciesName: initialSpecies,
    maxGrams: 150,
    capacityGrams: 150,
    lidPivot,
    jarMushMeshes,
    pulseLid: () => {
      lidPivot.rotation.x = -0.95;
      if (lidAnimTimer) clearTimeout(lidAnimTimer);
      lidAnimTimer = setTimeout(() => {
        lidPivot.rotation.x = 0;
        lidAnimTimer = null;
      }, 480);
    },
    updateVisual: () => {
      const jc = item.silicaJarCtrl;
      const cap = jc.maxGrams || jc.capacityGrams || 150;
      const gVal = Math.max(0, Math.round(Number(jc.storedGrams) || 0));
      jc.storedGrams = gVal;
      const visibleCount = gVal <= 0 ? 0 : Math.min(jarMushMeshes.length, Math.max(3, Math.round((gVal / cap) * jarMushMeshes.length)));
      for (let i = 0; i < jarMushMeshes.length; i++) {
        jarMushMeshes[i].visible = i < visibleCount;
      }
      item.label = gVal > 0
        ? `🫙 Pote Hermético c/ Sílica Gel (${gVal}/${cap}g • ${jc.speciesName || 'Crocantes'})`
        : '🫙 Pote Hermético c/ Sílica Gel (Vazio • Guarde cogumelos crocantes)';
    }
  };
  item.silicaJarCtrl.updateVisual();
  return item;
}

export function interactSilicaStorageJar(ctx, jarItem) {
  if (!jarItem || !jarItem.silicaJarCtrl) return false;
  const jc = jarItem.silicaJarCtrl;
  const cap = jc.maxGrams || jc.capacityGrams || 150;
  const held = ctx.heldItem;
  const onToast = ctx.callbacks && ctx.callbacks.onToast;

  if (held && held.driedMushroomCtrl) {
    const addG = held.driedMushroomCtrl.grams || 10;
    if (jc.storedGrams + addG > cap) {
      if (onToast) onToast(t('items.labAdvancedTools.m4', { addG, v2: Math.max(0, cap - jc.storedGrams) }));
      return true;
    }
    jc.storedGrams += addG;
    if (held.driedMushroomCtrl.speciesName) jc.speciesName = held.driedMushroomCtrl.speciesName;
    if (jc.pulseLid) jc.pulseLid();
    jc.updateVisual();
    if (ctx.markItemMoved) ctx.markItemMoved(jarItem);
    held._removedForSync = true;
    if (ctx.pendingMovedItems && held.id) {
      ctx.pendingMovedItems[held.id] = {
        id: held.id,
        state: { custom: { dynamicKind: 'dried_batch', removed: true } }
      };
    }

    if (held.mesh && held.mesh.parent) held.mesh.parent.remove(held.mesh);
    disposeObjectResources(held.mesh);
    const idx = ctx.pickableItems.indexOf(held);
    if (idx !== -1) ctx.pickableItems.splice(idx, 1);
    if (ctx.pickableMap && typeof ctx.pickableMap.delete === 'function') {
      ctx.pickableMap.delete(held.id);
    }
    ctx.heldItem = null;
    if (ctx.placementGhost) ctx.placementGhost.visible = false;
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(null);

    playAudio('playClick');
    if (ctx && ctx.triggerLocalAvatarAction) ctx.triggerLocalAvatarAction('fx_jar');
    if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
    if (onToast) {
      onToast(t('items.labAdvancedTools.m5', { addG, storedGrams: jc.storedGrams, cap }));
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // Com a mão livre, retire até 10 g, incluindo a última porção do pote.
  if (!held && jc.storedGrams > 0) {
    const takeG = Math.min(10, jc.storedGrams);
    jc.storedGrams -= takeG;
    if (jc.pulseLid) jc.pulseLid();
    jc.updateVisual();

    const batchId = `dried_batch_jar_${Date.now()}_${Math.floor(Math.random() * 999)}`;
    const pos = jarItem.mesh.position;
    const batchItem = makeDriedMushroomBatch(ctx, batchId, jc.speciesName || 'Psilocybe cubensis', pos.x, pos.y + 0.25, pos.z, takeG);
    ctx.heldItem = batchItem;
    if (batchItem.mesh && batchItem.mesh.parent) batchItem.mesh.parent.remove(batchItem.mesh);
    if (ctx.markItemMoved) {
      ctx.markItemMoved(jarItem);
      ctx.markItemMoved(batchItem);
    }
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(batchItem.label);

    playAudio('playClick');
    if (onToast) {
      onToast(t('items.labAdvancedTools.m6', { takeG, storedGrams: jc.storedGrams, cap }));
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  playAudio('playClick');
  if (onToast) {
    onToast(t('items.labAdvancedTools.m7', { label: jarItem.label, v2: 240 + jc.storedGrams }));
  }
  return true;
}
