/**
 * MycoCampus3D — Motor Inteligente de Auto-FPS, Detecção de Hardware & Qualidade Adaptativa
 */
const THREE = typeof window !== 'undefined' ? window.THREE : undefined;

export const QUALITY_TIERS_ORDER = ['high', 'medium', 'low', 'min'];

const TIER_CONFIGS = {
  desktop: {
    high:   { ratioCap: 1.50, shadows: true,  soft: true,  far: 420, aura: true,  weatherParticles: 650, forestScale: 1.00, toneMap: true,  blur: true,  maxLights: 99 },
    medium: { ratioCap: 1.00, shadows: false, soft: false, far: 250, aura: true,  weatherParticles: 300, forestScale: 0.78, toneMap: true,  blur: true,  maxLights: 4  },
    low:    { fixedRatio: 0.78, shadows: false, soft: false, far: 175, aura: false, weatherParticles: 100, forestScale: 0.56, toneMap: false, blur: false, maxLights: 1  },
    min:    { fixedRatio: 0.58, shadows: false, soft: false, far: 130, aura: false, weatherParticles: 0,   forestScale: 0.38, toneMap: false, blur: false, maxLights: 0  }
  },
  mobile: {
    high:   { ratioCap: 1.00, shadows: false, soft: false, far: 210, aura: true,  weatherParticles: 80,  forestScale: 0.72, toneMap: false, blur: false, maxLights: 2, itemCullDist: 26 },
    medium: { ratioCap: 0.85, shadows: false, soft: false, far: 165, aura: false, weatherParticles: 30,  forestScale: 0.55, toneMap: false, blur: false, maxLights: 1, itemCullDist: 20 },
    low:    { fixedRatio: 0.70, shadows: false, soft: false, far: 130, aura: false, weatherParticles: 0,   forestScale: 0.40, toneMap: false, blur: false, maxLights: 0, itemCullDist: 15 },
    min:    { fixedRatio: 0.55, shadows: false, soft: false, far: 105, aura: false, weatherParticles: 0,   forestScale: 0.28, toneMap: false, blur: false, maxLights: 0, itemCullDist: 12 }
  }
};

export const qualityState = {
  mode: 'auto',
  tier: 'high',
  auraEnabled: true,
  forestScale: 1.0,
  maxPointLights: 99,
  itemCullDist: 999,
  fpsFrames: 0,
  fpsLastSampleAt: 0,
  fpsLastFrameAt: 0,
  currentFps: 60,
  lowFpsStreak: 0,
  highFpsStreak: 0,
  warmupUntil: 0,
  lastDowngradeAt: 0
};

function isSoftwareGpuRenderer() {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return false;
    const r = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
    return r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software');
  } catch (e) {
    return false;
  }
}

export function getSavedQualityMode() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('myco_quality_mode') : null;
    if (saved === 'auto' || QUALITY_TIERS_ORDER.indexOf(saved) !== -1) return saved;
  } catch (e) {}
  return 'auto';
}

export function saveQualityMode(mode) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem('myco_quality_mode', mode);
  } catch (e) {}
}

export function getInitialQualityTier(isTouchDevice) {
  if (isSoftwareGpuRenderer()) return 'min';

  const memory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;

  if (!isTouchDevice) {
    if ((typeof memory === 'number' && memory <= 4) || (typeof cores === 'number' && cores <= 2)) {
      return 'medium';
    }
    return 'high';
  }

  if ((typeof memory === 'number' && memory <= 2) || (typeof cores === 'number' && cores <= 4)) {
    return 'low';
  }
  if ((typeof memory === 'number' && memory <= 4) || (typeof cores === 'number' && cores <= 6)) {
    return 'medium';
  }
  return 'high';
}

export function applyQualityTier(tier, deps) {
  qualityState.tier = tier;
  qualityState.warmupUntil = performance.now() + 2600;
  const { renderer, camera, scene, envSun, weatherPoints, isTouchDevice, onQualityChange } = deps || {};
  if (!renderer || !camera) return qualityState;

  const dpr = window.devicePixelRatio || 1;
  const profile = isTouchDevice ? TIER_CONFIGS.mobile : TIER_CONFIGS.desktop;
  const cfg = profile[tier] || profile.medium;
  const ratio = cfg.fixedRatio !== undefined ? cfg.fixedRatio : Math.min(dpr, cfg.ratioCap);
  qualityState.baseRatio = ratio;
  qualityState.dynScale = 1;

  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping !== undefined && THREE.NoToneMapping !== undefined) {
    renderer.toneMapping = cfg.toneMap ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  }
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = cfg.shadows;
    renderer.shadowMap.autoUpdate = cfg.shadows;
    renderer.shadowMap.type = cfg.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.needsUpdate = true;
  }
  if (envSun) envSun.castShadow = cfg.shadows;
  if (weatherPoints && weatherPoints.geometry) {
    weatherPoints.geometry.setDrawRange(0, cfg.weatherParticles);
    weatherPoints.visible = cfg.weatherParticles > 0;
  }
  if (camera.far !== cfg.far) {
    camera.far = cfg.far;
    camera.updateProjectionMatrix();
  }
  if (scene && scene.fog && !window.isTripFreakoutActive?.()) {
    scene.fog.far = Math.max(85, cfg.far * 0.72);
  }
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('quality-low-fx', !cfg.blur);
  }
  qualityState.auraEnabled = cfg.aura;
  qualityState.forestScale = cfg.forestScale;
  qualityState.maxPointLights = cfg.maxLights !== undefined ? cfg.maxLights : 99;
  qualityState.itemCullDist = cfg.itemCullDist !== undefined ? cfg.itemCullDist : 999;
  if (scene) stepPointLightBudget(scene, null, true);
  if (onQualityChange) {
    onQualityChange({ mode: qualityState.mode, tier: qualityState.tier, fps: qualityState.currentFps });
  }
  return qualityState;
}

let cachedPointLights = null;
let lastLightBudgetAt = 0;

export function stepPointLightBudget(scene, playerPos, force = false) {
  if (!scene) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!force && now - lastLightBudgetAt < 450) return;
  lastLightBudgetAt = now;

  if (!cachedPointLights) {
    cachedPointLights = [];
    scene.traverse((obj) => {
      // Ignora luzes dinâmicas (ex.: chama do fogareiro começa com intensidade 0)
      if (obj && obj.isPointLight && obj.intensity > 0) {
        cachedPointLights.push({ light: obj, baseIntensity: obj.intensity });
      }
    });
  }

  // Usa intensidade (não "visible") para nunca mudar a contagem de luzes:
  // evita recompilar todos os shaders (travadas) e respeita os interruptores das salas.
  const maxLights = qualityState.maxPointLights;
  const px = playerPos ? playerPos.x : 0;
  const pz = playerPos ? playerPos.z : 0;
  const sorted = cachedPointLights.map((entry, idx) => {
    const p = entry.light.position;
    const dx = p.x - px;
    const dz = p.z - pz;
    return { idx, d2: dx * dx + dz * dz };
  }).sort((a, b) => a.d2 - b.d2);

  for (let i = 0; i < sorted.length; i++) {
    const entry = cachedPointLights[sorted[i].idx];
    if (!entry.light.visible) continue; // interruptor desligado
    entry.light.intensity = i < maxLights ? entry.baseIntensity : 0;
  }
}

let lastItemCullAt = 0;

export function optimizeSceneMaterialsForMobile(scene) {
  if (!scene || !THREE || !THREE.MeshLambertMaterial) return;
  const converted = new Map();
  scene.traverse((obj) => {
    if (!obj || (!obj.isMesh && !obj.isInstancedMesh) || !obj.material) return;
    if (Array.isArray(obj.material)) return;
    const m = obj.material;
    if (!m.isMeshStandardMaterial) return;
    // Mantém vidros/metais muito reflexivos; converte materiais foscos/orgânicos para Lambert (4x mais rápido no mobile)
    if (m.transparent && m.opacity < 0.85) return;
    if ((m.metalness || 0) > 0.35) return;
    let lambert = converted.get(m);
    if (!lambert) {
      lambert = new THREE.MeshLambertMaterial({
        color: m.color,
        map: m.map || null,
        emissive: m.emissive,
        emissiveIntensity: m.emissiveIntensity !== undefined ? m.emissiveIntensity : 1,
        side: m.side,
        transparent: m.transparent,
        opacity: m.opacity,
        depthWrite: m.depthWrite,
        vertexColors: m.vertexColors
      });
      converted.set(m, lambert);
    }
    obj.material = lambert;
  });
}

export function stepMobileItemCulling(ctx, now) {
  const maxDist = qualityState.itemCullDist;
  if (!ctx || !ctx.pickableItems || !ctx.playerPos || maxDist >= 900) return;
  if (now - lastItemCullAt < 240) return;
  lastItemCullAt = now;
  const px = ctx.playerPos.x;
  const pz = ctx.playerPos.z;
  const maxSq = maxDist * maxDist;
  const items = ctx.pickableItems;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || !it.mesh) continue;
    if (it === ctx.heldItem) {
      it.mesh.visible = true;
      continue;
    }
    const ud = it.mesh.userData;
    if (ud && (ud.isTable || ud.isHood || ud.isRack || it.fridgeCtrl)) continue;
    const dx = it.mesh.position.x - px;
    const dz = it.mesh.position.z - pz;
    it.mesh.visible = (dx * dx + dz * dz) <= maxSq;
  }
}

export function stepAutoQuality(now, deps) {
  if (typeof document !== 'undefined' && document.hidden) {
    qualityState.fpsLastFrameAt = now;
    qualityState.fpsLastSampleAt = now;
    qualityState.fpsFrames = 0;
    return;
  }
  if (qualityState.fpsLastFrameAt > 0 && (now - qualityState.fpsLastFrameAt) < 1000) {
    qualityState.fpsFrames++;
  }
  qualityState.fpsLastFrameAt = now;
  if (!qualityState.fpsLastSampleAt) {
    qualityState.fpsLastSampleAt = now;
    qualityState.warmupUntil = now + 3000;
    return;
  }
  const elapsed = now - qualityState.fpsLastSampleAt;
  if (elapsed < 1000) return;

  qualityState.currentFps = Math.max(1, Math.round((qualityState.fpsFrames * 1000) / elapsed));
  qualityState.fpsFrames = 0;
  qualityState.fpsLastSampleAt = now;

  if (qualityState.mode === 'auto' && now >= qualityState.warmupUntil) {
    const idx = QUALITY_TIERS_ORDER.indexOf(qualityState.tier);
    const fps = qualityState.currentFps;
    const r = deps && deps.renderer;

    // 1º nível de inteligência: resolução dinâmica contínua (sem trocar preset/efeitos)
    if (r && qualityState.baseRatio) {
      let next = qualityState.dynScale || 1;
      if (fps < 42 && next > 0.62) next = Math.max(0.62, next - 0.12);
      else if (fps >= 58 && next < 1) next = Math.min(1, next + 0.06);
      if (next !== qualityState.dynScale) {
        qualityState.dynScale = next;
        r.setPixelRatio(qualityState.baseRatio * next);
        r.setSize(window.innerWidth, window.innerHeight, false);
        qualityState.lowFpsStreak = 0;
        if (deps.onQualityChange) deps.onQualityChange({ mode: qualityState.mode, tier: qualityState.tier, fps });
        return;
      }
    }

    // 2º nível: só troca o preset quando a resolução já está no limite
    const downThresholds = { high: 46, medium: 38, low: 28, min: 0 };
    if (qualityState.currentFps < (downThresholds[qualityState.tier] || 0) && idx < QUALITY_TIERS_ORDER.length - 1) {
      qualityState.lowFpsStreak++;
      qualityState.highFpsStreak = 0;
      if (qualityState.lowFpsStreak >= 2) {
        qualityState.lowFpsStreak = 0;
        qualityState.lastDowngradeAt = now;
        applyQualityTier(QUALITY_TIERS_ORDER[idx + 1], deps);
        return;
      }
    } else if (qualityState.currentFps >= 57 && idx > 0 && (now - qualityState.lastDowngradeAt) > 18000) {
      qualityState.highFpsStreak++;
      qualityState.lowFpsStreak = 0;
      if (qualityState.highFpsStreak >= 6) {
        qualityState.highFpsStreak = 0;
        applyQualityTier(QUALITY_TIERS_ORDER[idx - 1], deps);
        return;
      }
    } else {
      qualityState.lowFpsStreak = 0;
      qualityState.highFpsStreak = 0;
    }
  }
  if (deps && deps.onQualityChange) {
    deps.onQualityChange({ mode: qualityState.mode, tier: qualityState.tier, fps: qualityState.currentFps });
  }
}
