import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v1.9.9 texturas PNG de substratos e micélio existem e bindPngTexture aplica sem duplicar carga', async () => {
  const expectedPngs = [
    'sorghum-grain.png',
    'corn-grain.png',
    'wheat-grain.png',
    'flocao-corn.png',
    'coco-verm-substrate.png',
    'mycelium-rhizo.png'
  ];
  for (const name of expectedPngs) {
    const p = path.resolve('assets/textures', name);
    assert.ok(fs.existsSync(p), `Missing texture: ${name}`);
    const data = fs.readFileSync(p);
    assert.ok(data.length > 10000, `Texture too small: ${name}`);
    assert.deepEqual([...data.slice(0, 4)], [137, 80, 78, 71], `Invalid PNG header: ${name}`);
  }

  let loadCalls = 0;
  class FakeTextureLoader {
    load(_url, onLoad) {
      loadCalls += 1;
      onLoad({
        wrapS: null,
        wrapT: null,
        repeat: { set() {} },
        colorSpace: null,
        userData: {}
      });
    }
  }
  const prevWin = globalThis.window;
  globalThis.window = {
    THREE: {
      TextureLoader: FakeTextureLoader,
      RepeatWrapping: 1000,
      ClampToEdgeWrapping: 1001,
      SRGBColorSpace: 'srgb'
    }
  };
  try {
    const regUrl = new URL('../js/items/item-registry.js?v199=' + Date.now(), import.meta.url).href;
    const { bindPngTexture } = await import(regUrl);
    const matA = { map: null, needsUpdate: false };
    const matB = { map: null, needsUpdate: false };
    bindPngTexture('assets/textures/corn-grain.png', [matA], { repeatX: 2, repeatY: 2 });
    const cached = bindPngTexture('assets/textures/corn-grain.png', [matB], { repeatX: 2, repeatY: 2 });
    assert.ok(matA.map && matB.map);
    assert.equal(matA.map, matB.map);
    assert.equal(cached, matA.map);
    assert.equal(loadCalls, 1);
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
  }
});

test('v1.9.9 Alt solta cursor ao segurar e retoma mira FPS ao soltar a tecla', async () => {
  const winListeners = {};
  const docListeners = {};
  const domListeners = {};
  let exitCalls = 0;
  let lockCalls = 0;
  const domEl = {
    addEventListener: (ev, fn) => { domListeners[ev] = fn; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    requestPointerLock: () => {
      lockCalls += 1;
      globalThis.document.pointerLockElement = domEl;
      return Promise.resolve();
    }
  };
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevPerf = globalThis.performance;

  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  globalThis.document = {
    pointerLockElement: domEl,
    activeElement: null,
    hidden: false,
    addEventListener: (ev, fn) => { docListeners[ev] = fn; },
    exitPointerLock: () => {
      exitCalls += 1;
      globalThis.document.pointerLockElement = null;
      if (docListeners.pointerlockchange) docListeners.pointerlockchange();
    }
  };
  globalThis.window = {
    addEventListener: (ev, fn) => { winListeners[ev] = fn; }
  };

  try {
    const icUrl = new URL('../js/systems/input-controller.js?v199=' + Date.now(), import.meta.url).href;
    const { bindControls } = await import(icUrl);
    bindControls({
      inFps: true,
      keys: {},
      pointerNdc: { x: 0, y: 0, clone() { return { ...this }; } },
      renderer: { domElement: domEl },
      flushCurrentStroke() {}
    });

    let prevented = false;
    winListeners.keydown({
      code: 'AltLeft',
      repeat: false,
      preventDefault: () => { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.equal(exitCalls, 1);
    assert.equal(globalThis.document.pointerLockElement, null);

    prevented = false;
    winListeners.keyup({
      code: 'AltLeft',
      preventDefault: () => { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.equal(lockCalls, 1);
    assert.equal(globalThis.document.pointerLockElement, domEl);
  } finally {
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    globalThis.performance = prevPerf;
  }
});

test('v1.9.9 comer cogumelo usa chip numérico [1] (sem comer ao clicar), panela sem sprite gigante, vagalume só fora e fundo sem ligar fogareiro', () => {
  const interSrc = fs.readFileSync(path.resolve('js/systems/interaction-system.js'), 'utf8');
  const radialSrc = fs.readFileSync(path.resolve('js/ui/radial-menu.js'), 'utf8');
  const cookerSrc = fs.readFileSync(path.resolve('js/items/pressure-cooker.js'), 'utf8');
  const tripodSrc = fs.readFileSync(path.resolve('js/items/gas-tripod.js'), 'utf8');
  const raySrc = fs.readFileSync(path.resolve('js/systems/hover-raycaster.js'), 'utf8');
  const gnomesSrc = fs.readFileSync(path.resolve('js/world/trip-gnomes.js'), 'utf8');

  // Cogumelo em mãos não é comido no clique primário; ação [1] Comer Cogumelo via radial-menu
  assert.match(interSrc, /export function eatHeldMushroom\(/);
  assert.doesNotMatch(interSrc, /if\s*\(\s*ctx\.heldItem\s*&&\s*ctx\.heldItem\.wildMushroomCtrl\s*\)/);
  assert.match(radialSrc, /held\.wildMushroomCtrl[\s\S]*label:\s*'Comer Cogumelo'/);
  assert.match(radialSrc, /eatHeldMushroom\(ctx\)/);

  // Sprite gigante atrás do balão da panela removido
  assert.match(cookerSrc, /statusSprite:\s*null/);
  assert.doesNotMatch(cookerSrc, /stageTitle\s*=\s*'❄️ Esfriando\.\.\.'/);

  // Fundo da panela / suporte do fogareiro não liga chama
  assert.doesNotMatch(tripodSrc, /drumMesh\.userData\.burnerSwitchIdx/);
  assert.match(raySrc, /blockedByCloserObject/);

  // Vagalumes apenas ao ar livre fora dos edifícios/laboratórios
  assert.match(gnomesSrc, /function isInsideRoofZone\(/);
  assert.match(gnomesSrc, /function isOutdoorFireflySpot\(/);
  assert.match(gnomesSrc, /fireflyPoints\.visible\s*=\s*!playerIndoors/);

  // Revisão v1.9.9: Petri bare sem contam fantasma, Silica Jar c/ chip [1] Retirar 10g, Vermiculita + Pó de Coco sem Serragem, Spawn c/ substrato exato
  const petriSrc = fs.readFileSync(path.resolve('js/items/petri-dish.js'), 'utf8');
  const rackSrc = fs.readFileSync(path.resolve('js/items/storage-rack.js'), 'utf8');
  const labSrc = fs.readFileSync(path.resolve('js/world/lab-tools.js'), 'utf8');
  const spawnSrc = fs.readFileSync(path.resolve('js/items/spawn-containers.js'), 'utf8');
  const bowlSrc = fs.readFileSync(path.resolve('js/items/mixing-bowl.js'), 'utf8');

  assert.match(petriSrc, /if \(!ctrl \|\| ctrl\.mode === 'bare'\) return false;/);
  assert.match(radialSrc, /id:\s*'silica_take_10g_'/);
  assert.match(labSrc, /substrate_coco_/);
  assert.doesNotMatch(rackSrc, /Serragem \+ Fibra Coco/);
  assert.match(bowlSrc, /export function getBowlBulkReadiness\(/);
  assert.match(spawnSrc, /Bag 1,5kg Spawn \(\$\{subName\}\)/);

  // v2.0.0: Rótulos rápidos completos + syncItemLiveLabel + Geladeira sem duplicata + dispositivos
  assert.match(radialSrc, /function syncItemLiveLabel\(/);
  assert.match(radialSrc, /id:\s*'scale_tare'/);
  assert.match(radialSrc, /id:\s*'burner_step_'/);
  assert.match(radialSrc, /id:\s*'dehyd_act_'/);
  assert.match(radialSrc, /id:\s*'monotub_act_'/);
  assert.match(radialSrc, /id:\s*'pot_contents_'/);
  const fridgeBlock = radialSrc.match(/if \(target\.fridgeCtrl\)[\s\S]*?return actions;/);
  assert.ok(fridgeBlock);
  assert.doesNotMatch(fridgeBlock[0], /id:\s*'move_'\s*\+\s*target\.id/);
});
