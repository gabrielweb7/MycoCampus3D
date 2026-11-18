/**
 * MycoCampus3D — Motor Inteligente de Auto-FPS, Detecção de Hardware & Qualidade Adaptativa
 */
const THREE = typeof window !== 'undefined' ? window.THREE : undefined;

export const QUALITY_TIERS_ORDER = ['high', 'medium', 'low', 'min'];

const TIER_CONFIGS = {
  desktop: {
    high:   { ratioCap: 2.00, shadows: true,  soft: true,  far: 440, aura: true,  weatherParticles: 800, forestScale: 1.00, toneMap: true,  blur: true,  maxLights: 99 },
    medium: { ratioCap: 1.00, shadows: false, soft: false, far: 250, aura: true,  weatherParticles: 300, forestScale: 0.78, toneMap: true,  blur: true,  maxLights: 4  },
    low:    { fixedRatio: 0.78, shadows: false, soft: false, far: 175, aura: false, weatherParticles: 100, forestScale: 0.56, toneMap: false, blur: false, maxLights: 1  },
    min:    { fixedRatio: 0.58, shadows: false, soft: false, far: 130, aura: false, weatherParticles: 0,   forestScale: 0.38, toneMap: false, blur: false, maxLights: 0  }
  },
  mobile: {
    high:   { ratioCap: 1.50, shadows: true,  soft: false, far: 210, aura: true,  weatherParticles: 160, forestScale: 0.86, toneMap: true,  blur: false, maxLights: 3, itemCullDist: 64, shadowExtent: 22, shadowMap: 768, shadowEvery: 2 },
    medium: { ratioCap: 1.15, shadows: false, soft: false, far: 150, aura: true,  weatherParticles: 50,  forestScale: 0.62, toneMap: false, blur: false, maxLights: 2, itemCullDist: 46 },
    low:    { fixedRatio: 0.85, shadows: false, soft: false, far: 110, aura: false, weatherParticles: 0,   forestScale: 0.44, toneMap: false, blur: false, maxLights: 1, itemCullDist: 36 },
    min:    { fixedRatio: 0.70, shadows: false, soft: false, far: 84,  aura: false, weatherParticles: 0,   forestScale: 0.32, toneMap: false, blur: false, maxLights: 0, itemCullDist: 28 }
  }
};

export const qualityState = {
  mode: 'auto',
  tier: 'high',
  auraEnabled: true,
  forestScale: 1.0,
  maxPointLights: 99,
  itemCullDist: 999,
  shadowsActive: false,
  shadowExtent: 0,
  shadowEvery: 2,
  lambertBaked: false,
  _shx: 1e9,
  _shz: 1e9,
  _shFrame: 0,
  fpsFrames: 0,
  fpsLastSampleAt: 0,
  fpsLastFrameAt: 0,
  currentFps: 60,
  lowFpsStreak: 0,
  highFpsStreak: 0,
  warmupUntil: 0,
  lastDowngradeAt: 0
};

function isSoftwareGpuRenderer(renderer) {
  try {
    if (!renderer || !renderer.getContext) return false;
    const gl = renderer.getContext();
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

export function getInitialQualityTier(isTouchDevice, renderer) {
  if (isSoftwareGpuRenderer(renderer)) return 'min';

  const memory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;

  if (!isTouchDevice) {
    qualityState.tierCeilingIdx = 0;
    // PC: qualidade máxima. Só cai de cara em máquinas realmente fracas.
    if ((typeof memory === 'number' && memory <= 2) || (typeof cores === 'number' && cores <= 2)) {
      return 'medium';
    }
    return 'high';
  }

  // iPhone não expõe deviceMemory e vários Androids bons reportam 4 núcleos.
  // Começa alto; o auto-FPS reduz resolução e só então desce o preset.
  if ((typeof memory === 'number' && memory <= 2) || (typeof cores === 'number' && cores > 0 && cores <= 2)) {
    return 'low';
  }
  if (typeof memory === 'number' && memory <= 3) return 'medium';

  // GPU fraca (ex.: Redmi Note 7 = Adreno 512, 4 GB): começa em 'medium'
  // para não pagar sombra/tone mapping de cara. O auto-FPS sobe sozinho se sobrar folga.
  const gpuClass = classifyMobileGpu(renderer);
  // Teto do auto-upgrade: GPU fraca/média nunca sobe para um preset que ela não sustenta
  // (evita ciclo sobe→cai a cada ~18s).
  qualityState.tierCeilingIdx = gpuClass === 'weak' ? 2 : (gpuClass === 'mid' ? 1 : 0);
  if (gpuClass === 'weak') return 'low';
  if (gpuClass === 'mid') return 'medium';
  // Android com GPU desconhecida: perfil otimizado por padrão; iPhone/GPU forte: high.
  if (gpuClass === 'unknown' && !/iphone|ipad|mac/i.test(navigator.userAgent || '')) return 'medium';
  return 'high';
}

function classifyMobileGpu(renderer) {
  try {
    const gl = renderer && renderer.getContext && renderer.getContext();
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return 'unknown';
    const r = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
    // Adreno 3xx/4xx/5xx baixos, Mali-4xx/T-series, PowerVR antigos
    if (/adreno.*\b(3\d\d|4\d\d)\b/.test(r)) return 'weak';
    if (/mali-(4|t)\d+/.test(r) || /powervr/.test(r)) return 'weak';
    // Adreno 5xx/6xx baixos (508-619), Mali-G5x/G7x de entrada
    if (/adreno.*\b(5\d\d|60\d|61\d)\b/.test(r)) return 'mid';
    if (/mali-g(3|5|6)\d/.test(r)) return 'mid';
  } catch (e) {}
  return 'unknown';
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
    renderer.toneMappingExposure = cfg.toneMap ? (isTouchDevice ? 1.06 : 1.02) : 1;
  }
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = cfg.shadows;
    // No celular o mapa só redesenha quando stepMobileSunShadow pede.
    renderer.shadowMap.autoUpdate = cfg.shadows && !isTouchDevice;
    renderer.shadowMap.type = cfg.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.needsUpdate = cfg.shadows;
  }
  if (envSun) {
    envSun.castShadow = cfg.shadows;
    if (cfg.shadows && cfg.shadowExtent) {
      const ext = cfg.shadowExtent;
      const cam = envSun.shadow.camera;
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext;
      cam.bottom = -ext;
      cam.near = 1;
      cam.far = 150;
      cam.updateProjectionMatrix();
      envSun.shadow.bias = -0.0008;
      if (envSun.shadow.normalBias !== undefined) envSun.shadow.normalBias = 0.025;
      const ms = cfg.shadowMap || 768;
      if (envSun.shadow.mapSize.x !== ms) {
        envSun.shadow.mapSize.set(ms, ms);
        if (envSun.shadow.map) {
          envSun.shadow.map.dispose();
          envSun.shadow.map = null;
        }
      }
    }
  }
  qualityState.shadowsActive = !!(cfg.shadows && isTouchDevice && cfg.shadowExtent);
  qualityState.shadowExtent = cfg.shadowExtent || 0;
  qualityState.shadowEvery = cfg.shadowEvery || 2;
  qualityState._shx = 1e9;
  qualityState._shz = 1e9;
  if (isTouchDevice && tier !== 'high' && scene && !qualityState.lambertBaked) {
    optimizeSceneMaterialsForMobile(scene);
    qualityState.lambertBaked = true;
  }
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
  const n = cachedPointLights.length;
  if (_lightOrder.length !== n) {
    _lightOrder = new Array(n);
    _lightD2 = new Float32Array(n);
  }
  for (let i = 0; i < n; i++) {
    const p = cachedPointLights[i].light.position;
    const dx = p.x - px;
    const dz = p.z - pz;
    _lightD2[i] = dx * dx + dz * dz;
    _lightOrder[i] = i;
  }
  _lightOrder.sort(_lightCmp);

  for (let i = 0; i < n; i++) {
    const entry = cachedPointLights[_lightOrder[i]];
    if (!entry.light.visible) continue; // interruptor desligado
    entry.light.intensity = i < maxLights ? entry.baseIntensity : 0;
  }
}

let _lightOrder = [];
let _lightD2 = new Float32Array(0);
function _lightCmp(a, b) { return _lightD2[a] - _lightD2[b]; }

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
    if (m.userData && m.userData.keepPbr) return;
    if (m.transparent && m.opacity < 0.85) return;
    if ((m.metalness || 0) > 0.35) return;
    if (m.vertexColors) return;
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
  if (!ctx || !ctx.playerPos) return;
  if (now - lastItemCullAt < 240) return;
  lastItemCullAt = now;
  const px = ctx.playerPos.x;
  const pz = ctx.playerPos.z;

  // Oclusão por Setor: quando o jogador está dentro de um prédio (Lab / Substrato / Estufa), reduz o raio da floresta externa
  const isInsideWing = Math.abs(px) > 13.5 && Math.abs(px) < 34 && Math.abs(pz) < 16.5;
  qualityState.indoorForestFactor = isInsideWing ? 0.38 : 1.0;

  const maxDist = qualityState.itemCullDist;
  if (!ctx.pickableItems || maxDist >= 900) return;
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

/**
 * Sombra local no celular: o sol acompanha o jogador num quadrado curto,
 * então o mapa 768 fica nítido e a floresta instanciada não entra no passe.
 * O mapa só é redesenhado a cada shadowEvery frames.
 */
export function stepMobileSunShadow(renderer, sun, playerPos) {
  if (!qualityState.shadowsActive || !renderer || !sun || !playerPos) return;
  const ext = qualityState.shadowExtent || 22;
  const map = sun.shadow.mapSize.x || 768;
  const texel = (ext * 2) / map;
  const sx = Math.round(playerPos.x / texel) * texel;
  const sz = Math.round(playerPos.z / texel) * texel;
  // environment.js grava a direção do sol a partir da origem, todo frame.
  const dx = sun.position.x;
  const dy = sun.position.y;
  const dz = sun.position.z;
  sun.target.position.set(sx, 0, sz);
  sun.target.updateMatrixWorld();
  sun.position.set(sx + dx, dy, sz + dz);
  qualityState._shx = sx;
  qualityState._shz = sz;
  qualityState._shFrame++;
  const every = qualityState.shadowEvery || 2;
  if (qualityState._shFrame % every === 0) renderer.shadowMap.needsUpdate = true;
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

    // 1º nível de inteligência: resolução dinâmica contínua com deadband estável (só ajusta após 2s fora da faixa)
    if (r && qualityState.baseRatio) {
      let next = qualityState.dynScale || 1;
      if (fps < 50 && next > 0.68) {
        qualityState.lowFpsStreak++;
        qualityState.highFpsStreak = 0;
        if (qualityState.lowFpsStreak >= 2) {
          next = Math.max(0.68, Math.round((next - 0.08) * 100) / 100);
          qualityState.lowFpsStreak = 0;
        }
      } else if (fps >= 57 && next < 1) {
        qualityState.highFpsStreak++;
        qualityState.lowFpsStreak = 0;
        if (qualityState.highFpsStreak >= 3) {
          next = Math.min(1, Math.round((next + 0.08) * 100) / 100);
          qualityState.highFpsStreak = 0;
        }
      } else {
        qualityState.lowFpsStreak = 0;
        qualityState.highFpsStreak = 0;
      }
      if (next !== qualityState.dynScale) {
        qualityState.dynScale = next;
        r.setPixelRatio(qualityState.baseRatio * next);
        r.setSize(window.innerWidth, window.innerHeight, false);
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
    } else if (qualityState.currentFps >= 57 && idx > (qualityState.tierCeilingIdx || 0) && (now - qualityState.lastDowngradeAt) > 18000) {
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
