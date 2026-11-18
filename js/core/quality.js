/**
 * MycoCampus3D — Motor Inteligente de Auto-FPS, Detecção de Hardware & Qualidade Adaptativa
 */
const THREE = typeof window !== 'undefined' ? window.THREE : undefined;

export const QUALITY_TIERS_ORDER = ['high', 'medium', 'low', 'min'];

const TIER_CONFIGS = {
  desktop: {
    high:   { ratioCap: 1.50, shadows: true,  soft: true,  far: 420, aura: true,  weatherParticles: 650, forestScale: 1.00, toneMap: true,  blur: true  },
    medium: { ratioCap: 1.00, shadows: false, soft: false, far: 250, aura: true,  weatherParticles: 300, forestScale: 0.78, toneMap: true,  blur: true  },
    low:    { fixedRatio: 0.78, shadows: false, soft: false, far: 175, aura: false, weatherParticles: 100, forestScale: 0.56, toneMap: false, blur: false },
    min:    { fixedRatio: 0.58, shadows: false, soft: false, far: 130, aura: false, weatherParticles: 0,   forestScale: 0.38, toneMap: false, blur: false }
  },
  mobile: {
    high:   { ratioCap: 1.25, shadows: false, soft: false, far: 260, aura: true,  weatherParticles: 140, forestScale: 0.85, toneMap: true,  blur: false },
    medium: { ratioCap: 1.00, shadows: false, soft: false, far: 195, aura: true,  weatherParticles: 60,  forestScale: 0.65, toneMap: false, blur: false },
    low:    { fixedRatio: 0.80, shadows: false, soft: false, far: 150, aura: false, weatherParticles: 0,   forestScale: 0.48, toneMap: false, blur: false },
    min:    { fixedRatio: 0.62, shadows: false, soft: false, far: 120, aura: false, weatherParticles: 0,   forestScale: 0.34, toneMap: false, blur: false }
  }
};

export const qualityState = {
  mode: 'auto',
  tier: 'high',
  auraEnabled: true,
  forestScale: 1.0,
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
  if (onQualityChange) {
    onQualityChange({ mode: qualityState.mode, tier: qualityState.tier, fps: qualityState.currentFps });
  }
  return qualityState;
}

export function stepAutoQuality(now, deps) {
  if (typeof document !== 'undefined' && document.hidden) {
    qualityState.fpsLastFrameAt = now;
    qualityState.fpsLastSampleAt = now;
    qualityState.fpsFrames = 0;
    return;
  }
  if (qualityState.fpsLastFrameAt > 0 && (now - qualityState.fpsLastFrameAt) < 200) {
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
