import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMycoCozyStyle, MYCO_PALETTE } from '../js/engine/visual-style.js';
import { Group, PointLight, Scene, Vector3 } from '../js/vendor/three.bundle.min.js';

class MockColor {
  constructor(v = 0xffffff) {
    this.value = typeof v === 'number' ? v : 0xffffff;
  }
  set(v) {
    this.value = typeof v === 'number' ? v : this.value;
    return this;
  }
  getHex() {
    return this.value;
  }
  copy(c) {
    if (c) this.value = c.value;
    return this;
  }
}

class MockVector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

class MockMatrix4 {
  makeScale() {
    return this;
  }
}

class MockFogExp2 {
  constructor(color, density = 0.0022) {
    this.isFogExp2 = true;
    this.color = new MockColor(color);
    this.density = density;
  }
}

class MockStandardMaterial {
  constructor(opts = {}) {
    Object.assign(this, opts);
    this.isMeshStandardMaterial = true;
    this.color = opts.color || new MockColor(0xffffff);
    this.emissive = opts.emissive || new MockColor(0x000000);
    this.userData = opts.userData || {};
  }
}

class MockLambertMaterial {
  constructor(opts = {}) {
    Object.assign(this, opts);
    this.isMeshLambertMaterial = true;
    this.color = opts.color || new MockColor(0xffffff);
    this.emissive = opts.emissive || new MockColor(0x000000);
    this.userData = opts.userData || {};
  }
}

class MockCanvasTexture {
  constructor(canvas) {
    this.image = canvas;
    this.userData = {};
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
  }
}

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 2,
  THREE: {
    Color: MockColor,
    Vector2: MockVector2,
    Vector3,
    Box3: class {},
    Quaternion: class {},
    Matrix4: MockMatrix4,
    FogExp2: MockFogExp2,
    MeshStandardMaterial: MockStandardMaterial,
    MeshLambertMaterial: MockLambertMaterial,
    CanvasTexture: MockCanvasTexture,
    SRGBColorSpace: 'srgb',
    ACESFilmicToneMapping: 4,
    NoToneMapping: 0,
    PCFSoftShadowMap: 2,
    PCFShadowMap: 1
  }
};

globalThis.document = {
  body: { classList: { toggle() {} } },
  createElement(tag) {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: '',
            font: '',
            textAlign: '',
            fillRect() {},
            fillText() {}
          };
        }
      };
    }
    return {};
  }
};

const {
  classifyGpu,
  getInitialQualityTier,
  applyQualityTier,
  stepAutoQuality,
  resetAutoQuality,
  getAutoQualityConfig,
  setSceneMaterialQuality,
  stepPointLightBudget,
  qualityState
} = await import('../js/core/quality.js');

const {
  disposeObjectResources,
  getCachedCanvasTexture,
  registerPickable
} = await import('../js/items/item-registry.js');

const { getStackConfig } = await import('../js/entities/placement-ghost.js');

function makeRendererWithGpu(gpuStr) {
  let pixelRatio = 1;
  return {
    outputColorSpace: '',
    toneMapping: 0,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, autoUpdate: true, type: 0, needsUpdate: false },
    getContext() {
      return {
        RENDERER: 0x1F01,
        getExtension(name) {
          return name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null;
        },
        getParameter() {
          return gpuStr;
        }
      };
    },
    setPixelRatio(r) { pixelRatio = r; },
    getPixelRatio() { return pixelRatio; },
    setSize() {}
  };
}

function makeMockScene(meshes = []) {
  return {
    userData: {},
    fog: new MockFogExp2(0xbfdbfe, 0.0022),
    traverse(fn) {
      meshes.forEach((m) => fn(m));
    }
  };
}

function makeMockCamera() {
  return { far: 300, updateProjectionMatrix() {} };
}

test('classifyGpu e getInitialQualityTier detectam mobile antigo, mobile topo, GPU fraca e PC forte', () => {
  assert.equal(classifyGpu(makeRendererWithGpu('Adreno (TM) 506'), true), 'weak');
  assert.equal(classifyGpu(makeRendererWithGpu('Mali-T830'), true), 'weak');
  assert.equal(classifyGpu(makeRendererWithGpu('Mali-G31 MP2'), true), 'weak');
  assert.equal(classifyGpu(makeRendererWithGpu('PowerVR Rogue GE8320'), true), 'weak');
  assert.equal(classifyGpu(makeRendererWithGpu('Adreno (TM) 740'), true), 'strong');
  assert.equal(classifyGpu(makeRendererWithGpu('Apple GPU'), true), 'strong');
  assert.equal(classifyGpu(makeRendererWithGpu('Intel(R) HD Graphics 520'), false), 'weak');
  assert.equal(classifyGpu(makeRendererWithGpu('Google SwiftShader'), false), 'software');
  assert.equal(classifyGpu(makeRendererWithGpu('NVIDIA GeForce RTX 4070'), false), 'strong');

  assert.equal(getInitialQualityTier(false, makeRendererWithGpu('Google SwiftShader')), 'min');
  assert.equal(getInitialQualityTier(false, makeRendererWithGpu('NVIDIA GeForce RTX 4070')), 'high');
  assert.equal(getInitialQualityTier(true, makeRendererWithGpu('Adreno (TM) 506')), 'low');
});

test('Firefox usa o adaptador WebGL quando disponível e trata Mozilla como nome genérico', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'Mozilla/5.0 Firefox/142.0', hardwareConcurrency: 8 }
  });
  let extensionReads = 0;
  const gl = {
    RENDERER: 0x1f01,
    getExtension() {
      extensionReads++;
      return { UNMASKED_RENDERER_WEBGL: 0x9246 };
    },
    getParameter(key) {
      return key === this.RENDERER ? 'Mozilla' : 'llvmpipe (LLVM)';
    }
  };
  try {
    const renderer = { getContext: () => gl };
    assert.equal(classifyGpu(renderer, false), 'software');
    assert.equal(getInitialQualityTier(false, renderer), 'min');
    assert.equal(extensionReads, 1);

    const masked = { getContext: () => ({ ...gl, getExtension() { return null; } }) };
    assert.equal(classifyGpu(masked, false), 'unknown');
    assert.equal(getInitialQualityTier(false, masked), 'medium');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});

test('luz de equipamento novo usa o pool e acompanha o item até a remoção', () => {
  const scene = new Scene();
  const slot = new PointLight(0xffffff, 0);
  scene.add(slot);
  scene.userData._pointLightPool = [slot];
  scene.userData._virtualPointLights = [];
  const equipment = new Group();
  const light = new PointLight(0xe0f2fe, 0);
  light.position.y = 0.8;
  equipment.add(light);
  registerPickable({ scene, pickableItems: [] }, 'test-hood', 'Coifa', equipment, 10, 1, 2);

  const previousBudget = qualityState.maxPointLights;
  qualityState.maxPointLights = 1;
  try {
    assert.equal(light.parent, null);
    light.intensity = 1;
    equipment.position.set(12, 2, 5);
    stepPointLightBudget(scene, null, true);
    assert.equal(slot.intensity, 1);
    assert.deepEqual(slot.position.toArray(), [12, 2.8, 5]);

    equipment.visible = false;
    stepPointLightBudget(scene, null, true);
    assert.equal(slot.intensity, 0);

    scene.remove(equipment);
    stepPointLightBudget(scene, null, true);
    assert.equal(scene.userData._virtualPointLights.length, 0);
  } finally {
    qualityState.maxPointLights = previousBudget;
  }
});

test('applyQualityTier ajusta FogExp2.density proporcionalmente sem lançar erro', () => {
  const scene = makeMockScene();
  const camera = makeMockCamera();
  const renderer = makeRendererWithGpu('NVIDIA GeForce RTX 4070');

  applyQualityTier('high', { renderer, camera, scene, isTouchDevice: false });
  const highDensity = scene.fog.density;
  applyQualityTier('min', { renderer, camera, scene, isTouchDevice: true });
  const minDensity = scene.fog.density;

  assert.ok(highDensity > 0 && highDensity < minDensity);
  assert.equal(qualityState.baseFogDensity, minDensity);
});

test('setSceneMaterialQuality converte PBR -> Lambert com alias de .color/.emissive e restaura PBR', () => {
  const pbrMat = new MockStandardMaterial({
    color: new MockColor(0x112233),
    emissive: new MockColor(0x445566),
    roughness: 0.7,
    metalness: 0.05
  });
  const metallicMat = new MockStandardMaterial({ metalness: 0.9, roughness: 0.2 });
  const meshMatte = { isMesh: true, material: pbrMat };
  const meshMetal = { isMesh: true, material: metallicMat };
  const scene = makeMockScene([meshMatte, meshMetal]);

  const okDown = setSceneMaterialQuality(scene, true);
  assert.equal(okDown, true);
  assert.equal(meshMatte.material.isMeshLambertMaterial, true);
  assert.equal(meshMetal.material, metallicMat); // Metais preservados em PBR

  // Alias direto de Color mantém animações dinâmicas de neve/LED funcionando nos 2 modos
  assert.equal(meshMatte.material.color, pbrMat.color);
  assert.equal(meshMatte.material.emissive, pbrMat.emissive);
  meshMatte.material.color.set(0xf1f5f9);
  assert.equal(pbrMat.color.getHex(), 0xf1f5f9);

  const okUp = setSceneMaterialQuality(scene, false);
  assert.equal(okUp, true);
  assert.equal(meshMatte.material, pbrMat);
});

test('stepAutoQuality aguarda queda sustentada, reduz DRS antes do nível e respeita modo manual', () => {
  const scene = makeMockScene();
  const camera = makeMockCamera();
  const renderer = makeRendererWithGpu('NVIDIA GeForce RTX 4070');
  const deps = { renderer, camera, scene, isTouchDevice: false };

  qualityState.mode = 'auto';
  resetAutoQuality();
  qualityState.tierCeilingIdx = 0;
  applyQualityTier('high', deps);
  qualityState.warmupUntil = 0;
  qualityState.lastDowngradeAt = 0;
  qualityState.lowFpsStreak = 0;
  qualityState.highFpsStreak = 0;
  qualityState.fpsFrames = 0;
  qualityState.fpsLastSampleAt = 1000;
  qualityState.fpsLastFrameAt = 1000;

  let t = 1000;
  const stepWindow = (fpsTarget, msWindow = 1050) => {
    const frames = Math.max(1, Math.round((fpsTarget * msWindow) / 1000));
    const step = msWindow / frames;
    for (let i = 0; i < frames; i++) {
      t += step;
      stepAutoQuality(t, deps);
    }
  };

  // Uma queda curta não deve alterar a resolução ou o nível.
  t = Math.max(t, performance.now() + 10000);
  qualityState.fpsLastSampleAt = t;
  qualityState.fpsLastFrameAt = t;
  qualityState.warmupUntil = t - 10;

  stepWindow(20);
  stepWindow(20);
  assert.equal(qualityState.tier, 'high');
  assert.equal(qualityState.dynScale, 1);

  // Após aquecimento e uma janela prolongada, experimenta DRS antes de trocar o nível.
  for (let round = 0; round < 25 && qualityState.dynScale === 1; round++) stepWindow(20);
  assert.ok(qualityState.dynScale < 1.0, `Esperado dynScale < 1.0, obteve ${qualityState.dynScale}`);

  // A comparação sustentada testa o nível seguinte quando o FPS continua ruim.
  for (let round = 0; round < 25 && qualityState.tier === 'high'; round++) stepWindow(20);
  assert.equal(qualityState.tier, 'medium');

  // Modo manual jamais altera tier automaticamente
  qualityState.mode = 'manual';
  resetAutoQuality();
  applyQualityTier('high', deps);
  t += 5000;
  qualityState.warmupUntil = t - 10;
  qualityState.fpsLastSampleAt = t;
  qualityState.fpsLastFrameAt = t;
  stepWindow(15);
  stepWindow(15);
  stepWindow(15);
  assert.equal(qualityState.tier, 'high');
});

test('auto guarda configuração estável e ignora dados de outro dispositivo ou inválidos', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  const renderer = makeRendererWithGpu('NVIDIA GeForce RTX 4070');
  const deps = { renderer, camera: makeMockCamera(), scene: makeMockScene(), isTouchDevice: false };
  qualityState.mode = 'auto';
  resetAutoQuality();
  applyQualityTier('medium', deps);
  let now = performance.now() + 10000;
  for (let frame = 0; frame < 60 * 25; frame++) {
    now += 1000 / 60;
    stepAutoQuality(now, deps);
  }
  assert.deepEqual(getAutoQualityConfig(false, renderer), { tier: 'medium', scale: 1 });
  assert.equal(getAutoQualityConfig(false, makeRendererWithGpu('Google SwiftShader')).tier, 'min');
  storage.set('myco_auto_quality_v1', '{inválido');
  assert.equal(getAutoQualityConfig(false, renderer).tier, 'high');
  delete globalThis.localStorage;
});

test('auto persiste resolução experimentada e desfaz teste interrompido em segundo plano', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
  const renderer = makeRendererWithGpu('NVIDIA GeForce RTX 4070');
  const deps = { renderer, camera: makeMockCamera(), scene: makeMockScene(), isTouchDevice: false };
  qualityState.mode = 'auto';
  resetAutoQuality();
  applyQualityTier('high', deps);
  let now = performance.now() + 10000;
  const frames = (fps, seconds) => {
    for (let i = 0; i < fps * seconds; i++) { now += 1000 / fps; stepAutoQuality(now, deps); }
  };
  frames(20, 25);
  assert.equal(qualityState.dynScale, 0.85);
  document.hidden = true;
  stepAutoQuality(now + 100, deps);
  assert.equal(qualityState.tier, 'high');
  assert.equal(qualityState.dynScale, 1);
  assert.equal(storage.has('myco_auto_quality_v1'), false);
  document.hidden = false;
  now += 200;
  for (let i = 0; i < 30 && qualityState.dynScale === 1; i++) frames(20, 1);
  assert.equal(qualityState.dynScale, 0.85);
  frames(38, 20);
  assert.deepEqual(getAutoQualityConfig(false, renderer), { tier: 'high', scale: 0.85 });
  delete globalThis.localStorage;
});

test('disposeObjectResources libera recursos exclusivos e preserva userData.shared', () => {
  let ownedGeoDisposed = false;
  let sharedGeoDisposed = false;
  let ownedMatDisposed = false;
  let sharedMatDisposed = false;
  let ownedTexDisposed = false;
  let sharedTexDisposed = false;

  const ownedTex = { userData: {}, dispose() { ownedTexDisposed = true; } };
  const sharedTex = { userData: { shared: true }, dispose() { sharedTexDisposed = true; } };
  const ownedMat = { userData: {}, map: ownedTex, dispose() { ownedMatDisposed = true; } };
  const sharedMat = { userData: { shared: true }, map: sharedTex, dispose() { sharedMatDisposed = true; } };
  const ownedGeo = { userData: {}, dispose() { ownedGeoDisposed = true; } };
  const sharedGeo = { userData: { shared: true }, dispose() { sharedGeoDisposed = true; } };

  const nodes = [
    { geometry: ownedGeo, material: ownedMat },
    { geometry: sharedGeo, material: [sharedMat, ownedMat] }
  ];
  const root = { traverse(fn) { nodes.forEach(fn); } };

  disposeObjectResources(root);
  assert.equal(ownedGeoDisposed, true);
  assert.equal(ownedMatDisposed, true);
  assert.equal(ownedTexDisposed, true);
  assert.equal(sharedGeoDisposed, false);
  assert.equal(sharedMatDisposed, false);
  assert.equal(sharedTexDisposed, false);
});

test('getCachedCanvasTexture reutiliza CanvasTexture por chave e marca como shared', () => {
  let buildCount = 0;
  const t1 = getCachedCanvasTexture('test_label_alpha', 64, 32, () => { buildCount++; });
  const t2 = getCachedCanvasTexture('test_label_alpha', 64, 32, () => { buildCount++; });
  assert.ok(t1);
  assert.equal(t1, t2);
  assert.equal(t1.userData.shared, true);
  assert.equal(buildCount, 1);
});

test('getStackConfig retorna referências congeladas sem alocação por chamada', () => {
  const petri = { mesh: { userData: { isPetri: true } } };
  const pp5 = { mesh: { userData: {} }, spawnCtrl: { isPP5: true } };
  const c1 = getStackConfig(petri);
  const c2 = getStackConfig(petri);
  const p1 = getStackConfig(pp5);
  const p2 = getStackConfig(pp5);

  assert.equal(c1, c2);
  assert.equal(p1, p2);
  assert.equal(Object.isFrozen(c1), true);
  assert.equal(Object.isFrozen(p1), true);
  assert.equal(getStackConfig({ mesh: { userData: {} } }), null);
});

test('Myco Cozy harmoniza materiais opacos uma vez e preserva vidro', () => {
  const opaqueColor = {
    getHSL(out) { out.h = 0.34; out.s = 0.5; out.l = 0.4; return out; },
    setHSL(h, s, l) { this.last = { h, s, l }; return this; }
  };
  const opaque = {
    isMeshStandardMaterial: true,
    transparent: false,
    opacity: 1,
    roughness: 0.2,
    metalness: 0,
    color: opaqueColor,
    userData: {}
  };
  const glass = {
    isMeshStandardMaterial: true,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0,
    color: opaqueColor,
    userData: {}
  };
  const nodes = [
    { isMesh: true, material: opaque },
    { isMesh: true, material: opaque },
    { isMesh: true, material: glass }
  ];
  const scene = { userData: {}, traverse(fn) { nodes.forEach(fn); } };

  const first = applyMycoCozyStyle(scene);
  const second = applyMycoCozyStyle(scene);
  assert.equal(first.materials, 1);
  assert.equal(first.meshes, 3);
  assert.equal(second.materials, 0);
  assert.equal(opaque.roughness, 0.56);
  assert.equal(opaque.dithering, true);
  assert.equal(glass.roughness, 0.1);
  assert.equal(MYCO_PALETTE.mushroomPink, 0xf05aa8);
});

test('classifyGpu cacheia consulta WebGL e getLabEnvironmentMap usa PMREMGenerator sem gerar mipmap cúbico', async () => {
  let extCalls = 0;
  let paramCalls = 0;
  const cachedRenderer = {
    getContext() {
      return {
        RENDERER: 0x1F01,
        getExtension(name) {
          extCalls++;
          return name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null;
        },
        getParameter() {
          paramCalls++;
          return 'NVIDIA GeForce RTX 4070';
        }
      };
    }
  };
  assert.equal(classifyGpu(cachedRenderer, false), 'strong');
  assert.equal(classifyGpu(cachedRenderer, false), 'strong');
  assert.equal(classifyGpu(cachedRenderer, false), 'strong');
  assert.equal(paramCalls, 1);
  assert.ok(extCalls <= 1);

  const prevThree = globalThis.window.THREE;
  let pmremCalls = 0;
  let disposed = 0;
  globalThis.window.THREE = {
    ...prevThree,
    RGBAFormat: 1023,
    EquirectangularReflectionMapping: 303,
    LinearFilter: 1006,
    DataTexture: class {
      constructor(data, w, h, fmt) {
        this.data = data;
        this.w = w;
        this.h = h;
        this.fmt = fmt;
        this.userData = {};
      }
    },
    PMREMGenerator: class {
      compileEquirectangularShader() {}
      fromEquirectangular(tex) {
        pmremCalls++;
        return { texture: { userData: {}, sourceTex: tex, isPmrem: true } };
      }
      dispose() {
        disposed++;
      }
    }
  };
  try {
    const { getLabEnvironmentMap } = await import('../js/engine/lab-env-map.js');
    const baked1 = getLabEnvironmentMap(cachedRenderer);
    const baked2 = getLabEnvironmentMap(cachedRenderer);
    assert.equal(baked1.isPmrem, true);
    assert.equal(baked1, baked2);
    assert.equal(pmremCalls, 1);
    assert.equal(disposed, 1);
  } finally {
    globalThis.window.THREE = prevThree;
  }
});
