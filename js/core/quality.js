/**
 * MycoCampus3D — Motor Inteligente de Auto-FPS, DRS (Dynamic Resolution Scaling),
 * Detecção de Hardware & Qualidade Adaptativa (Mobile Antigo, Mobile Novo & PC)
 */
import { getFullViewportSize, syncViewportCssVars } from '../ui/dom-helpers.js';
import { shouldHideHeldInPlacementMode } from '../entities/placement-ghost.js';

const THREE = typeof window !== 'undefined' ? window.THREE : undefined;

function getThree() {
  return (typeof window !== 'undefined' && window.THREE) || THREE;
}

export const QUALITY_TIERS_ORDER = ['high', 'medium', 'low', 'min'];

const TIER_CONFIGS = {
  desktop: {
    high:   { ratioCap: 2.00, shadows: true,  soft: true,  shadowExtent: 52, shadowMap: 1536, shadowEvery: 2, far: 440, aura: true,  weatherParticles: 800, forestScale: 1.00, toneMap: true,  blur: true,  maxLights: 4, itemCullDist: 56, lambert: false },
    medium: { ratioCap: 1.25, shadows: true,  soft: false, shadowExtent: 34, shadowMap: 1024, shadowEvery: 3, far: 280, aura: true,  weatherParticles: 300, forestScale: 0.78, toneMap: true,  blur: true,  maxLights: 3, itemCullDist: 42, lambert: false },
    low:    { fixedRatio: 0.85, shadows: false, soft: false, far: 185, aura: false, weatherParticles: 100, forestScale: 0.56, toneMap: false, blur: false, maxLights: 2, itemCullDist: 30, lambert: true },
    min:    { fixedRatio: 0.65, shadows: false, soft: false, far: 130, aura: false, weatherParticles: 0,   forestScale: 0.38, toneMap: false, blur: false, maxLights: 0, itemCullDist: 22, lambert: true }
  },
  mobile: {
    high:   { ratioCap: 1.50, shadows: true,  soft: false, shadowExtent: 24, shadowMap: 768, shadowEvery: 2, far: 215, aura: true,  weatherParticles: 160, forestScale: 0.86, toneMap: true,  blur: false, maxLights: 3, itemCullDist: 52, lambert: false },
    medium: { ratioCap: 1.15, shadows: false, soft: false, far: 155, aura: true,  weatherParticles: 50,  forestScale: 0.62, toneMap: false, blur: false, maxLights: 2, itemCullDist: 40, lambert: true },
    low:    { fixedRatio: 0.85, shadows: false, soft: false, far: 112, aura: false, weatherParticles: 0,   forestScale: 0.44, toneMap: false, blur: false, maxLights: 1, itemCullDist: 32, lambert: true },
    min:    { fixedRatio: 0.68, shadows: false, soft: false, far: 84,  aura: false, weatherParticles: 0,   forestScale: 0.32, toneMap: false, blur: false, maxLights: 0, itemCullDist: 24, lambert: true }
  }
};

export const qualityState = {
  mode: 'auto',
  tier: 'high',
  baseRatio: 1,
  dynScale: 1,
  tierCeilingIdx: 0,
  auraEnabled: true,
  forestScale: 1.0,
  maxPointLights: 99,
  itemCullDist: 999,
  shadowsActive: false,
  shadowExtent: 0,
  shadowEvery: 2,
  lambertBaked: false,
  lambertActive: false,
  baseFogDensity: 0.0022,
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

function readWebGlRendererString(renderer) {
  try {
    if (!renderer || !renderer.getContext) return '';
    const gl = renderer.getContext();
    if (!gl) return '';
    const dbg = gl.getExtension && gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg && gl.getParameter) {
      return String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
    }
    if (gl.getParameter && gl.RENDERER) {
      return String(gl.getParameter(gl.RENDERER) || '').toLowerCase();
    }
  } catch (e) {}
  return '';
}

export function classifyGpu(renderer, isTouchDevice = false) {
  const r = readWebGlRendererString(renderer);
  if (r && (r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software') || r.includes('mesa offscreen') || r.includes('microsoft basic render'))) {
    return 'software';
  }
  if (!isTouchDevice) {
    if (!r) return 'unknown';
    if (/intel.*?\b(hd|uhd)\s*(graphics\s*)?(2\d\d\d|3\d\d\d|4\d\d\d|5[0-3]\d|6[0-3]\d)\b/.test(r) ||
        /amd.*radeon.*vega\s*[1-3]\b/.test(r)) {
      return 'weak';
    }
    return 'strong';
  }
  if (!r) return 'unknown';
  // Adreno 3xx/4xx/504-509, Mali-4xx/T-series/G31, PowerVR antigos, Vivante, Tegra 3/4
  if (/adreno.*?\b(3\d\d|4\d\d|504|505|506|508|509)\b/.test(r)) return 'weak';
  if (/mali-(4|t\d+|g31)\b/.test(r) || /powervr/.test(r) || /vivante/.test(r) || /tegra\s*[34]\b/.test(r)) return 'weak';
  // Apple GPU, Adreno 630+/7xx/8xx, Mali-G77+/G710+/Immortalis, Xclipse 9xx
  if (/apple\s*gpu/.test(r) || /adreno.*?\b(6[3-9]\d|7\d\d|8\d\d)\b/.test(r) ||
      /mali-(g7[7-9]|g\d{3}|immortalis)/.test(r) || /immortalis/.test(r) || /xclipse\s*9/.test(r)) {
    return 'strong';
  }
  // Adreno 510-540/605-620, Mali-G5x/G6x/G71/G72/G76, Xclipse 5xx
  if (/adreno.*?\b(5[1-4]\d|60\d|61\d|62\d)\b/.test(r)) return 'mid';
  if (/mali-g(5\d|6\d|71|72|76)\b/.test(r) || /xclipse\s*5/.test(r)) return 'mid';
  return 'unknown';
}

export function getSavedQualityMode() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('myco_quality_mode') : null;
    if (saved === 'auto' || QUALITY_TIERS_ORDER.indexOf(saved) !== -1) return saved;
  } catch (e) {}
  return null;
}

export function saveQualityMode(mode) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem('myco_quality_mode', mode);
  } catch (e) {}
}

export function getInitialQualityTier(isTouchDevice, renderer) {
  const gpuClass = classifyGpu(renderer, isTouchDevice);
  if (gpuClass === 'software') {
    qualityState.tierCeilingIdx = 3;
    return 'min';
  }

  const memory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;

  if (!isTouchDevice) {
    qualityState.tierCeilingIdx = 0;
    if (gpuClass === 'weak' || (typeof memory === 'number' && memory <= 2) || (typeof cores === 'number' && cores > 0 && cores <= 2)) {
      return 'medium';
    }
    return 'high';
  }

  if (typeof memory === 'number' && memory <= 1) {
    qualityState.tierCeilingIdx = 2;
    return 'min';
  }
  if ((typeof memory === 'number' && memory <= 2) || (typeof cores === 'number' && cores > 0 && cores <= 2)) {
    qualityState.tierCeilingIdx = 2;
    return 'low';
  }
  if (gpuClass === 'weak') {
    qualityState.tierCeilingIdx = 2;
    return 'low';
  }
  if ((typeof memory === 'number' && memory <= 3) || gpuClass === 'mid') {
    qualityState.tierCeilingIdx = 1;
    return 'medium';
  }
  if (gpuClass === 'strong') {
    qualityState.tierCeilingIdx = 0;
    return 'high';
  }
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  qualityState.tierCeilingIdx = 0;
  if (/iphone|ipad|mac/i.test(ua)) return 'high';
  return 'medium';
}

export function applyQualityTier(tier, deps) {
  qualityState.tier = tier;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  qualityState.warmupUntil = now + 2600;
  const { renderer, camera, scene, envSun, weatherPoints, isTouchDevice, onQualityChange } = deps || {};
  if (!renderer || !camera) return qualityState;

  const ThreeRef = getThree();
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 1);
  const profile = isTouchDevice ? TIER_CONFIGS.mobile : TIER_CONFIGS.desktop;
  const cfg = profile[tier] || profile.medium;
  const effectiveCap = (isIos && isTouchDevice && cfg.ratioCap) ? Math.min(cfg.ratioCap, 1.35) : cfg.ratioCap;
  const ratio = cfg.fixedRatio !== undefined ? cfg.fixedRatio : Math.min(dpr, effectiveCap);
  qualityState.baseRatio = ratio;
  qualityState.dynScale = 1;

  renderer.setPixelRatio(ratio);
  const vp = typeof window !== 'undefined' ? syncViewportCssVars(false) : getFullViewportSize();
  renderer.setSize(vp.width, vp.height, false);
  if (camera && vp.width > 0 && vp.height > 0) {
    camera.aspect = vp.width / vp.height;
    if (typeof camera.updateProjectionMatrix === 'function') {
      camera.updateProjectionMatrix();
    }
  }
  if (ThreeRef && ThreeRef.SRGBColorSpace && renderer.outputColorSpace !== undefined) {
    renderer.outputColorSpace = ThreeRef.SRGBColorSpace;
  }
  if (ThreeRef && ThreeRef.ACESFilmicToneMapping !== undefined && ThreeRef.NoToneMapping !== undefined) {
    renderer.toneMapping = cfg.toneMap ? ThreeRef.ACESFilmicToneMapping : ThreeRef.NoToneMapping;
    renderer.toneMappingExposure = cfg.toneMap ? (isTouchDevice ? 1.06 : 1.02) : 1;
  }
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = cfg.shadows;
    const shEvery = cfg.shadowEvery || (isTouchDevice ? 2 : 1);
    renderer.shadowMap.autoUpdate = cfg.shadows && !isTouchDevice && shEvery <= 1;
    if (ThreeRef) {
      renderer.shadowMap.type = ThreeRef.PCFShadowMap;
    }
    renderer.shadowMap.needsUpdate = cfg.shadows;
  }
  if (envSun) {
    envSun.castShadow = cfg.shadows;
    if (cfg.shadows && cfg.shadowExtent && envSun.shadow && envSun.shadow.camera) {
      const ext = cfg.shadowExtent;
      const cam = envSun.shadow.camera;
      cam.left = -ext;
      cam.right = ext;
      cam.top = ext;
      cam.bottom = -ext;
      cam.near = 1;
      cam.far = 160;
      cam.updateProjectionMatrix();
      envSun.shadow.bias = -0.0007;
      if (envSun.shadow.normalBias !== undefined) envSun.shadow.normalBias = 0.025;
      const ms = cfg.shadowMap || (isTouchDevice ? 768 : 1536);
      if (envSun.shadow.mapSize && envSun.shadow.mapSize.x !== ms) {
        envSun.shadow.mapSize.set(ms, ms);
        if (envSun.shadow.map) {
          envSun.shadow.map.dispose();
          envSun.shadow.map = null;
        }
      }
    }
  }
  qualityState.shadowsActive = !!(cfg.shadows && cfg.shadowExtent);
  qualityState.shadowExtent = cfg.shadowExtent || 0;
  qualityState.shadowEvery = cfg.shadowEvery || 2;
  qualityState._shx = 1e9;
  qualityState._shz = 1e9;
  if (scene) {
    setSceneMaterialQuality(scene, !!cfg.lambert);
  }
  if (weatherPoints && weatherPoints.geometry) {
    weatherPoints.geometry.setDrawRange(0, cfg.weatherParticles);
    weatherPoints.visible = cfg.weatherParticles > 0;
  }
  if (camera.far !== cfg.far) {
    camera.far = cfg.far;
    if (camera.updateProjectionMatrix) camera.updateProjectionMatrix();
  }
  const inFreakout = typeof window !== 'undefined' && window.isTripFreakoutActive && window.isTripFreakoutActive();
  if (scene && scene.fog && !inFreakout) {
    if (scene.fog.isFogExp2) {
      const targetDensity = Math.max(0.0018, Math.min(0.011, 0.92 / Math.max(84, cfg.far)));
      scene.fog.density = targetDensity;
      qualityState.baseFogDensity = targetDensity;
    } else {
      scene.fog.far = Math.max(85, cfg.far * 0.72);
    }
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
    onQualityChange({
      mode: qualityState.mode,
      tier: qualityState.tier,
      fps: qualityState.currentFps,
      dynScale: qualityState.dynScale
    });
  }
  return qualityState;
}

let cachedPointLights = null;
let lastLightBudgetAt = 0;
const _tmpVLightPos = THREE ? new THREE.Vector3() : null;

export function stepPointLightBudget(scene, playerPos, force = false) {
  if (!scene) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!force && now - lastLightBudgetAt < 250) return;
  lastLightBudgetAt = now;

  const px = playerPos ? playerPos.x : 0;
  const pz = playerPos ? playerPos.z : 0;
  const maxLights = qualityState.maxPointLights;

  const vLights = scene.userData && scene.userData._virtualPointLights;
  const pool = scene.userData && scene.userData._pointLightPool;
  if (vLights && pool) {
    const vn = vLights.length;
    if (_lightOrder.length !== vn) {
      _lightOrder = new Array(vn);
      _lightD2 = new Float32Array(vn);
    }
    for (let i = 0; i < vn; i++) {
      const entry = vLights[i];
      const l = entry.light;
      if (!l.visible || l.intensity <= 0.001) {
        _lightD2[i] = 1e12;
      } else {
        let wx = entry.worldPos.x;
        let wz = entry.worldPos.z;
        if (entry.isDynamic && entry.parent && _tmpVLightPos) {
          entry.parent.updateWorldMatrix(true, false);
          _tmpVLightPos.copy(l.position).applyMatrix4(entry.parent.matrixWorld);
          entry.worldPos.copy(_tmpVLightPos);
          wx = _tmpVLightPos.x;
          wz = _tmpVLightPos.z;
        }
        const dx = wx - px;
        const dz = wz - pz;
        _lightD2[i] = dx * dx + dz * dz;
      }
      _lightOrder[i] = i;
    }
    _lightOrder.sort(_lightCmp);

    const activeBudget = Math.min(pool.length, maxLights);
    for (let k = 0; k < pool.length; k++) {
      const slot = pool[k];
      if (k < activeBudget && k < vn) {
        const entry = vLights[_lightOrder[k]];
        const src = entry.light;
        if (src.visible && src.intensity > 0.001 && _lightD2[_lightOrder[k]] < 1e11) {
          slot.position.copy(entry.worldPos);
          slot.color.copy(src.color);
          slot.intensity = src.intensity;
          slot.distance = src.distance;
          slot.decay = src.decay;
          continue;
        }
      }
      slot.intensity = 0;
    }
    return;
  }

  if (!cachedPointLights) {
    cachedPointLights = [];
    scene.traverse((obj) => {
      // Ignora luzes dinâmicas (ex.: chama do fogareiro começa com intensidade 0)
      if (obj && obj.isPointLight && obj.intensity > 0) {
        cachedPointLights.push({ light: obj, baseIntensity: obj.intensity });
      }
    });
  }

  // Fallback quando há <= 4 luzes (sem pool virtualizado)
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
    if (!entry.light.visible) continue;
    entry.light.intensity = i < maxLights ? entry.baseIntensity : 0;
  }
}

let _lightOrder = [];
let _lightD2 = new Float32Array(0);
function _lightCmp(a, b) { return _lightD2[a] - _lightD2[b]; }

let lastItemCullAt = 0;

/**
 * Alterna materiais PBR foscos entre MeshStandardMaterial e MeshLambertMaterial de forma 100% reversível,
 * mantendo alias direto de `.color` e `.emissive` para preservar animações (neve, LEDs, trip).
 */
export function setSceneMaterialQuality(scene, useLambert) {
  const ThreeRef = getThree();
  if (!scene || !ThreeRef || !ThreeRef.MeshLambertMaterial) return false;
  scene.userData = scene.userData || {};
  let swapList = scene.userData._pbrSwapList;
  if (!swapList) {
    if (!useLambert) return false;
    swapList = [];
    const converted = new Map();
    scene.traverse((obj) => {
      if (!obj || (!obj.isMesh && !obj.isInstancedMesh) || !obj.material) return;
      if (Array.isArray(obj.material)) return;
      const m = obj.material;
      if (!m.isMeshStandardMaterial) return;
      if (m.userData && m.userData.keepPbr) return;
      if (m.transparent && m.opacity < 0.85) return;
      if ((m.metalness || 0) > 0.35) return;
      if (m.vertexColors) return;
      let lambert = converted.get(m);
      if (!lambert) {
        lambert = new ThreeRef.MeshLambertMaterial({
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
        // Mantém a mesma instância de Color para tintura de neve/cor refletir nos dois modos
        if (m.color) lambert.color = m.color;
        if (m.emissive) lambert.emissive = m.emissive;
        lambert.userData = Object.assign({}, lambert.userData, { shared: !!(m.userData && m.userData.shared) });
        converted.set(m, lambert);
      }
      swapList.push({ mesh: obj, pbr: m, lambert });
    });
    scene.userData._pbrSwapList = swapList;
  }

  for (let i = 0; i < swapList.length; i++) {
    const entry = swapList[i];
    if (!entry || !entry.mesh) continue;
    entry.mesh.material = useLambert ? entry.lambert : entry.pbr;
  }
  qualityState.lambertActive = !!useLambert;
  if (useLambert) qualityState.lambertBaked = true;
  return true;
}

export function optimizeSceneMaterialsForMobile(scene) {
  return setSceneMaterialQuality(scene, true);
}

export function stepMobileItemCulling(ctx, now) {
  if (!ctx || !ctx.playerPos) return;
  if (now - lastItemCullAt < 240) return;
  lastItemCullAt = now;
  const refPos = ctx.inFps ? ctx.playerPos : ((ctx.camera && ctx.camera.position) || ctx.playerPos);
  const px = refPos.x;
  const pz = refPos.z;

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
    if (it === ctx.heldItem ||
        (ctx.heldItem && ctx.heldItem.lidItem === it && it.isAttached) ||
        (ctx.heldItem && ctx.heldItem.trayContents && ctx.heldItem.trayContents.some((tc) => tc && tc.item === it)) ||
        (ctx.heldItem && ctx.heldItem.cookerRef && ctx.heldItem.cookerRef.contents && ctx.heldItem.cookerRef.contents.indexOf(it) !== -1)) {
      it.mesh.visible = !shouldHideHeldInPlacementMode(ctx);
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
 * Atualização inteligente de sombras:
 * - No celular, o sol acompanha o jogador num quadrado curto e atualiza a cada shadowEvery frames.
 * - No desktop, atualiza a cada shadowEvery frames (ex.: 3) quando autoUpdate está desligado.
 */
export function stepSunShadow(renderer, sun, playerPos) {
  if (!renderer || !renderer.shadowMap || !renderer.shadowMap.enabled) return;
  if (qualityState.shadowsActive && sun && playerPos) {
    const ext = qualityState.shadowExtent || 22;
    const map = sun.shadow.mapSize.x || 768;
    const texel = (ext * 2) / map;
    const sx = Math.round(playerPos.x / texel) * texel;
    const sz = Math.round(playerPos.z / texel) * texel;
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
  } else if (!renderer.shadowMap.autoUpdate) {
    qualityState._shFrame++;
    const every = qualityState.shadowEvery || 3;
    if (qualityState._shFrame % every === 0) renderer.shadowMap.needsUpdate = true;
  }
}

export const stepMobileSunShadow = stepSunShadow;

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
  if (elapsed > 4000) {
    qualityState.fpsFrames = 0;
    qualityState.fpsLastSampleAt = now;
    return;
  }

  qualityState.currentFps = Math.max(1, Math.round((qualityState.fpsFrames * 1000) / elapsed));
  qualityState.fpsFrames = 0;
  qualityState.fpsLastSampleAt = now;

  const onQualityChange = deps && deps.onQualityChange;
  if (qualityState.mode !== 'auto' || now < qualityState.warmupUntil) {
    if (onQualityChange) {
      onQualityChange({
        mode: qualityState.mode,
        tier: qualityState.tier,
        fps: qualityState.currentFps,
        dynScale: qualityState.dynScale
      });
    }
    return;
  }

  const isTouch = !!(deps && deps.isTouchDevice);
  const tierIdx = QUALITY_TIERS_ORDER.indexOf(qualityState.tier);
  const targetLow = isTouch ? (tierIdx <= 1 ? 34 : 28) : (tierIdx <= 1 ? 44 : 35);
  const targetHigh = isTouch ? 52 : 56;
  const renderer = deps && deps.renderer;

  if (qualityState.currentFps < targetLow) {
    qualityState.lowFpsStreak++;
    qualityState.highFpsStreak = 0;
    if (qualityState.lowFpsStreak >= 2) {
      if (qualityState.dynScale > 0.72 && renderer && typeof renderer.setPixelRatio === 'function') {
        qualityState.dynScale = Math.max(0.70, +(qualityState.dynScale - 0.14).toFixed(2));
        renderer.setPixelRatio(Math.max(0.55, (qualityState.baseRatio || 1) * qualityState.dynScale));
        qualityState.lowFpsStreak = 0;
        qualityState.lastDowngradeAt = now;
        qualityState.warmupUntil = now + 2200;
      } else if (tierIdx !== -1 && tierIdx < QUALITY_TIERS_ORDER.length - 1) {
        qualityState.lowFpsStreak = 0;
        qualityState.lastDowngradeAt = now;
        applyQualityTier(QUALITY_TIERS_ORDER[tierIdx + 1], deps);
        return;
      }
    }
  } else if (qualityState.currentFps >= targetHigh && (now - qualityState.lastDowngradeAt) > 16000) {
    qualityState.highFpsStreak++;
    qualityState.lowFpsStreak = 0;
    if (qualityState.dynScale < 0.99 && qualityState.highFpsStreak >= 4 && renderer && typeof renderer.setPixelRatio === 'function') {
      qualityState.dynScale = Math.min(1.0, +(qualityState.dynScale + 0.10).toFixed(2));
      renderer.setPixelRatio(Math.max(0.55, (qualityState.baseRatio || 1) * qualityState.dynScale));
      qualityState.highFpsStreak = 0;
    } else if (qualityState.highFpsStreak >= 8 && tierIdx > (qualityState.tierCeilingIdx || 0)) {
      qualityState.highFpsStreak = 0;
      applyQualityTier(QUALITY_TIERS_ORDER[tierIdx - 1], deps);
      return;
    }
  } else {
    qualityState.lowFpsStreak = 0;
    qualityState.highFpsStreak = 0;
  }

  if (onQualityChange) {
    onQualityChange({
      mode: qualityState.mode,
      tier: qualityState.tier,
      fps: qualityState.currentFps,
      dynScale: qualityState.dynScale
    });
  }
}
