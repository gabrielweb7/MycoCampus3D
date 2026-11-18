/**
 * MycoCampus3D — Auto-FPS Dynamic Resolution & Presets de Qualidade WebGL
 */
const THREE = window.THREE;

export const QUALITY_TIERS_ORDER = ['high', 'medium', 'low', 'min'];

const TIER_CONFIGS = {
  desktop: {
    high:   { ratioCap: 1.5, shadows: true,  soft: true,  far: 420, aura: true,  weatherParticles: 800 },
    medium: { ratioCap: 1.0, shadows: false, soft: false, far: 260, aura: true,  weatherParticles: 400 },
    low:    { fixedRatio: 0.75, shadows: false, soft: false, far: 185, aura: true,  weatherParticles: 300 },
    min:    { fixedRatio: 0.55, shadows: false, soft: false, far: 135, aura: false, weatherParticles: 0 }
  },
  mobile: {
    high:   { ratioCap: 1.5, shadows: true,  soft: false, far: 300, aura: true,  weatherParticles: 240 },
    medium: { ratioCap: 1.0, shadows: false, soft: false, far: 210, aura: true,  weatherParticles: 90 },
    low:    { fixedRatio: 0.82, shadows: false, soft: false, far: 165, aura: false, weatherParticles: 0 },
    min:    { fixedRatio: 0.62, shadows: false, soft: false, far: 125, aura: false, weatherParticles: 0 }
  }
};

export const qualityState = {
  mode: 'auto',
  tier: 'high',
  auraEnabled: true,
  fpsFrames: 0,
  fpsLastSampleAt: 0,
  fpsLastFrameAt: 0,
  currentFps: 60,
  lowFpsStreak: 0,
  highFpsStreak: 0
};

export function getInitialQualityTier(isTouchDevice) {
  if (!isTouchDevice) return 'high';

  const memory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if ((typeof memory === 'number' && memory <= 2) ||
      (typeof cores === 'number' && cores <= 4)) {
    return 'low';
  }
  if (typeof memory === 'number' && memory <= 3) {
    return 'medium';
  }
  return 'high';
}

export function applyQualityTier(tier, deps) {
  qualityState.tier = tier;
  const { renderer, camera, envSun, weatherPoints, isTouchDevice, onQualityChange } = deps || {};
  if (!renderer || !camera) return qualityState;

  const dpr = window.devicePixelRatio || 1;
  const profile = isTouchDevice ? TIER_CONFIGS.mobile : TIER_CONFIGS.desktop;
  const cfg = profile[tier] || profile.medium;
  const ratio = cfg.fixedRatio !== undefined ? cfg.fixedRatio : Math.min(dpr, cfg.ratioCap);

  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = cfg.shadows;
    renderer.shadowMap.type = cfg.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.needsUpdate = true;
  }
  if (envSun) envSun.castShadow = cfg.shadows;
  if (weatherPoints && weatherPoints.geometry) {
    weatherPoints.geometry.setDrawRange(0, cfg.weatherParticles);
    if (!cfg.weatherParticles) weatherPoints.visible = false;
  }
  if (camera.far !== cfg.far) {
    camera.far = cfg.far;
    camera.updateProjectionMatrix();
  }
  qualityState.auraEnabled = cfg.aura;
  if (onQualityChange) {
    onQualityChange({ mode: qualityState.mode, tier: qualityState.tier, fps: qualityState.currentFps });
  }
  return qualityState;
}

export function stepAutoQuality(now, deps) {
  if (document.hidden) {
    qualityState.fpsLastFrameAt = now;
    qualityState.fpsLastSampleAt = now;
    qualityState.fpsFrames = 0;
    return;
  }
  if (qualityState.fpsLastFrameAt > 0 && (now - qualityState.fpsLastFrameAt) < 180) {
    qualityState.fpsFrames++;
  }
  qualityState.fpsLastFrameAt = now;
  if (!qualityState.fpsLastSampleAt) {
    qualityState.fpsLastSampleAt = now;
    return;
  }
  const elapsed = now - qualityState.fpsLastSampleAt;
  if (elapsed < 1500) return;

  qualityState.currentFps = Math.max(1, Math.round((qualityState.fpsFrames * 1000) / elapsed));
  qualityState.fpsFrames = 0;
  qualityState.fpsLastSampleAt = now;

  if (qualityState.mode === 'auto') {
    const idx = QUALITY_TIERS_ORDER.indexOf(qualityState.tier);
    const downThresholds = { high: 45, medium: 40, low: 32, min: 0 };
    if (qualityState.currentFps < (downThresholds[qualityState.tier] || 0) && idx < QUALITY_TIERS_ORDER.length - 1) {
      qualityState.lowFpsStreak++;
      qualityState.highFpsStreak = 0;
      if (qualityState.lowFpsStreak >= 2) {
        qualityState.lowFpsStreak = 0;
        applyQualityTier(QUALITY_TIERS_ORDER[idx + 1], deps);
        return;
      }
    } else if (qualityState.currentFps >= 55 && idx > 0) {
      qualityState.highFpsStreak++;
      qualityState.lowFpsStreak = 0;
      if (qualityState.highFpsStreak >= 4) {
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
