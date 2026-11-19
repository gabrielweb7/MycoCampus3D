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

import { makeBox } from '../engine/textures.js';
import { disposeObjectResources, getCachedCanvasTexture, registerPickable } from './item-registry.js';
import { updateScalpelLabel } from './scalpel.js';

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
    '🔥 Lamparina a Álcool (Acesa • Aponte Bisturi ou Seringa para flambar e esterilizar)',
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
      compatibilities: { canEnterCooker: false, isAlcoholLamp: true }
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
        ? '🔥 Lamparina a Álcool (Acesa • Flambar Bisturi/Seringa para esterilizar 100%)'
        : '🕯️ Lamparina a Álcool (Apagada • Clique para acender)';
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
      if (onToast) onToast('⚠️ Encaixe uma lâmina #24 no bisturi antes de flambar na lamparina.');
      return true;
    }
    sc.sterile = true;
    sc.bladeExpired = false;
    sc.bladeContaminated = false;
    sc.cutContaminated = false;
    sc.hasMycelium = false;
    sc.isSporeSample = false;
    sc.lastGeneticsKey = '';
    sc.bladeAttachedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    sc.flameGlowTimer = 2.2;
    if (sc.bladeMesh && sc.bladeMesh.material && sc.bladeMesh.material.emissive) {
      sc.bladeMesh.material.emissive.setHex(0xf97316);
      sc.bladeMesh.material.emissiveIntensity = 1.6;
    }
    updateScalpelLabel(held);
    playAudio('playSpray');
    if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
    if (ctx.callbacks && ctx.callbacks.onHoldChange) ctx.callbacks.onHoldChange(held.label);
    if (onToast) {
      onToast('🔥 Lâmina #24 flambada ao rubro na Lamparina a Álcool! 100% Re-esterilizada para novos cortes!');
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
      onToast('🔥 Agulha da seringa flambada na Lamparina a Álcool! Esterilizada por 160s.');
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  // 3. Alternar chama acesa / apagada
  lc.lit = !lc.lit;
  lc.updateVisual();
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
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.25 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.72 });
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.55, roughness: 0.1 });

  const base = makeBox(0.18, 0.032, 0.22, darkMetalMat);
  base.position.y = 0.016;
  const lightWell = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.018, 14), lensMat);
  lightWell.position.set(0, 0.038, 0.03);

  const arm = makeBox(0.042, 0.24, 0.045, bodyMat);
  arm.position.set(0, 0.14, -0.065);
  arm.rotation.x = 0.15;

  const stage = makeBox(0.13, 0.012, 0.12, darkMetalMat);
  stage.position.set(0, 0.13, 0.025);

  const head = makeBox(0.08, 0.065, 0.11, bodyMat);
  head.position.set(0, 0.26, -0.01);

  [-0.022, 0.022].forEach((ox) => {
    const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.075, 12), darkMetalMat);
    eyepiece.position.set(ox, 0.31, 0.035);
    eyepiece.rotation.x = -0.55;
    g.add(eyepiece);
  });

  // Revólver com 3 objetivas (40x, 400x, 1000x)
  [-0.02, 0, 0.02].forEach((ox, idx) => {
    const objLens = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.038 + idx * 0.006, 10), darkMetalMat);
    objLens.position.set(ox, 0.20, 0.025);
    g.add(objLens);
  });

  g.add(base, lightWell, arm, stage, head);
  g.userData.isMicroscope = true;

  const item = registerPickable(
    ctx,
    id,
    '🔬 Microscópio Óptico Binocular 1000x (Clique c/ amostra ou mão livre para analisar hifas e esporos)',
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
  item.microscopeCtrl = { magnification: 1000 };
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
    return {
      title: held.label,
      kind: isSporePrint ? 'spores' : 'mycelium',
      status: contam ? 'contaminated' : (isSporePrint ? 'spores' : (gen >= 2 ? 'rhizomorphic' : 'tomentose')),
      generation: gen,
      contaminated: contam,
      contamType: contam ? 'Conídios verdes de Trichoderma / Endósporos ocultos' : '',
      diagnosis: contam
        ? '🦠 ALERTA MICROSCÓPICO PRECOCE: Presença de conídios esféricos de mofo ou endósporos bacterianos ocultos na amostra! Descarte ou isole setor limpo.'
        : (isSporePrint
          ? '🔬 Basidiósporos elipsoides roxo-escuros íntegros (12×8 µm). Prontos para germinação T0 em ágar PDA!'
          : `✅ Micélio Dicariótico Saudável • Geração T${gen} (${gen >= 3 ? 'Isolado Elite ⭐' : (gen >= 2 ? 'Rizomórfico Forte' : (gen === 1 ? 'Setorizado T1' : 'Multi-Esporos T0'))}).`)
    };
  }
  if (held.spawnCtrl) {
    const sc = held.spawnCtrl;
    const gen = sc.generation || 1;
    const contam = !!(sc.contaminated || sc.pasteurizedOnly);
    return {
      title: held.label,
      kind: 'mycelium',
      status: contam ? 'contaminated' : (gen >= 2 ? 'rhizomorphic' : 'tomentose'),
      generation: gen,
      contaminated: contam,
      contamType: sc.pasteurizedOnly ? 'Endósporos de Bacillus (Wet Spot)' : 'Trichoderma harzianum',
      diagnosis: sc.pasteurizedOnly
        ? '🦠 ALERTA: Endósporos bacterianos de Bacillus vivos! Grãos foram apenas pasteurizados a 75°C — esterilize a 121°C / 15 PSI!'
        : (sc.contaminated
          ? '🦠 Contaminação fúngica/bacteriana ativa detectada entre os grãos!'
          : `✅ Micélio vigoroso (Geração T${gen}${sc.shaken ? ' • Break & Shake ativo' : ''}) colonizando o substrato sem competidores.`)
    };
  }
  if (held.monotubCtrl) {
    const mc = held.monotubCtrl;
    return {
      title: held.label,
      kind: 'mycelium',
      generation: mc.generation || 2,
      contaminated: !!mc.contaminated,
      contamType: mc.contamReason || 'Trichoderma',
      diagnosis: mc.contaminated
        ? `🦠 Conidióforos de ${mc.contamReason || 'Trichoderma'} detectados no substrato bulk!`
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
        <button id="btn-close-microscope" type="button"
          class="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold shrink-0">✕ Fechar</button>
      </div>
      <div class="p-3 sm:p-4 overflow-y-auto space-y-3 text-xs flex flex-col items-center">
        <div class="relative rounded-full p-1.5 bg-slate-950 border-4 border-cyan-500/60 shadow-inner">
          <canvas id="microscope-lens-canvas" width="240" height="240" class="rounded-full block"></canvas>
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
  modal.querySelector('#btn-close-microscope')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  return modal;
}

export function interactLabMicroscope(ctx) {
  const info = analyzeSpecimenForMicroscope(ctx && ctx.heldItem);
  playAudio('playClick');
  if (ctx && ctx.callbacks && ctx.callbacks.onToast) {
    ctx.callbacks.onToast(info.diagnosis);
  }
  const modal = ensureMicroscopeModalDom();
  if (!modal) return true;

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
    const renderLens = () => {
      if (modal.classList.contains('hidden')) return;
      phase += 0.035;
      c.clearRect(0, 0, 240, 240);

      // Fundo iluminado do campo claro óptico
      const bg = c.createRadialGradient(120, 120, 20, 120, 120, 120);
      bg.addColorStop(0, info.contaminated ? '#fef2f2' : '#f0f9ff');
      bg.addColorStop(0.82, info.contaminated ? '#fecdd3' : '#bae6fd');
      bg.addColorStop(1, '#0f172a');
      c.fillStyle = bg;
      c.fillRect(0, 0, 240, 240);

      // Retículo micrométrico
      c.strokeStyle = 'rgba(15, 23, 42, 0.18)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(40, 120); c.lineTo(200, 120);
      c.moveTo(120, 40); c.lineTo(120, 200);
      c.stroke();

      if (info.kind === 'spores') {
        // Basidiósporos elipsoides flutuando levemente no fluido da lâmina
        for (let i = 0; i < 34; i++) {
          const ang = (i * 1.7) + Math.sin(phase + i) * 0.15;
          const r = 16 + ((i * 19) % 85);
          const sx = 120 + Math.cos(ang) * r + Math.sin(phase * 1.4 + i) * 2.5;
          const sy = 120 + Math.sin(ang) * r + Math.cos(phase * 1.2 + i) * 2.5;
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
        // Hifas ramificadas (densidade proporcional à geração T0..T3)
        const branchCount = 10 + (info.generation || 0) * 8;
        c.strokeStyle = 'rgba(30, 64, 175, 0.72)';
        c.lineWidth = 1.6 + (info.generation || 0) * 0.45;
        for (let b = 0; b < branchCount; b++) {
          const a = (b / branchCount) * Math.PI * 2;
          const len = 65 + ((b * 13) % 38);
          const sway = Math.sin(phase + b) * 4;
          c.beginPath();
          c.moveTo(120, 120);
          c.quadraticCurveTo(
            120 + Math.cos(a + 0.18) * len * 0.55 + sway,
            120 + Math.sin(a + 0.18) * len * 0.55 + sway,
            120 + Math.cos(a) * len,
            120 + Math.sin(a) * len
          );
          c.stroke();
        }
      }

      if (info.contaminated) {
        // Conídios verdes de Trichoderma ou bastonetes de Bacillus agitados
        c.fillStyle = '#15803d';
        for (let k = 0; k < 28; k++) {
          const kx = 55 + ((k * 37) % 130) + Math.sin(phase * 3 + k) * 4;
          const ky = 55 + ((k * 53) % 130) + Math.cos(phase * 3 + k) * 4;
          c.beginPath();
          c.arc(kx, ky, 4.5, 0, Math.PI * 2);
          c.fill();
        }
      }

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
export function makeDriedMushroomBatch(ctx, id, speciesName, px, py, pz) {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.65 });
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
    `🍄 Cogumelos Desidratados Crocantes (${sp} • 25g • 0% UR — Guarde no Pote c/ Sílica Gel ou pese na Balança)`,
    g,
    px,
    py,
    pz,
    0,
    0.11,
    0.09,
    {
      category: 'dried_harvest',
      purpose: 'Cogumelos desidratados a 55°C (0% umidade, cracker dry); pese na balança ou armazene em Pote Hermético com Sílica Gel',
      weightGrams: 25,
      compatibilities: { canEnterCooker: false, isDriedMushroomBatch: true }
    }
  );
  item.driedMushroomCtrl = { grams: 25, speciesName: sp };
  return item;
}

export function makeSilicaStorageJar(ctx, id, px, py, pz, initialGrams = 0) {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.36,
    roughness: 0.1,
    depthWrite: false
  });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.45, metalness: 0.2 });
  const clampMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
  const driedFillMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.19, 16), glassMat);
  body.position.y = 0.095;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.022, 16), lidMat);
  lid.position.y = 0.198;
  const wireClamp = makeBox(0.182, 0.055, 0.012, clampMat, { noShadow: true });
  wireClamp.position.y = 0.175;

  // Sachê de Sílica Gel 3D dentro do pote!
  const silicaTex = getCachedCanvasTexture('silica_gel_sachet_tex', 128, 64, (c) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 64);
    c.strokeStyle = '#0284c7'; c.lineWidth = 4; c.strokeRect(3, 3, 122, 58);
    c.fillStyle = '#0369a1'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center';
    c.fillText('SÍLICA GEL', 64, 28);
    c.fillStyle = '#dc2626'; c.font = 'bold 12px sans-serif';
    c.fillText('0% UMIDADE', 64, 48);
  });
  const sachet = makeBox(0.058, 0.042, 0.012, new THREE.MeshBasicMaterial({ map: silicaTex }));
  sachet.position.set(0, 0.045, 0.052);

  const fillMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.15, 14), driedFillMat);
  fillMesh.position.y = 0.08;
  fillMesh.visible = initialGrams > 0;

  g.add(body, lid, wireClamp, sachet, fillMesh);
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
      purpose: 'Pote hermético com sachê dessecante de Sílica Gel para conservar cogumelos desidratados crocantes por longo prazo',
      getWeightGrams: (it) => 240 + ((it && it.silicaJarCtrl && it.silicaJarCtrl.storedGrams) || 0),
      compatibilities: { canEnterCooker: false, isSilicaStorageJar: true }
    }
  );

  item.silicaJarCtrl = {
    storedGrams: initialGrams,
    maxGrams: 150,
    capacityGrams: 150,
    fillMesh,
    updateVisual: () => {
      const jc = item.silicaJarCtrl;
      const cap = jc.maxGrams || jc.capacityGrams || 150;
      const gVal = Math.round(jc.storedGrams || 0);
      jc.fillMesh.visible = gVal > 0;
      if (gVal > 0) {
        const f = Math.max(0.18, Math.min(1, gVal / cap));
        jc.fillMesh.scale.y = f;
        jc.fillMesh.position.y = 0.015 + 0.075 * f;
      }
      item.label = gVal > 0
        ? `🫙 Pote Hermético c/ Sílica Gel (${gVal}/${cap}g Crocantes • 0% UR ✅)`
        : '🫙 Pote Hermético com Sílica Gel (Vazio • Guarde Cogumelos Crocantes da Desidratadora)';
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
    const addG = held.driedMushroomCtrl.grams || 25;
    if (jc.storedGrams >= cap) {
      if (onToast) onToast('⚠️ Este Pote Hermético com Sílica Gel já está cheio (150g)! Use outro pote.');
      return true;
    }
    jc.storedGrams = Math.min(cap, jc.storedGrams + addG);
    jc.updateVisual();

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
    if (typeof window !== 'undefined' && window.triggerCampusHaptic) window.triggerCampusHaptic('success');
    if (onToast) {
      onToast(`🫙 +${addG}g de Cogumelos Crocantes guardados no Pote Hermético com Sílica Gel (${jc.storedGrams}/${jc.maxGrams}g • 0% UR)!`);
    }
    if (ctx.notifyWorldAction) ctx.notifyWorldAction();
    return true;
  }

  playAudio('playClick');
  if (onToast) {
    onToast(`🫙 ${jarItem.label} • Pese na Balança (${240 + jc.storedGrams}g bruto) ou traga cogumelos secos da Desidratadora.`);
  }
  return true;
}
