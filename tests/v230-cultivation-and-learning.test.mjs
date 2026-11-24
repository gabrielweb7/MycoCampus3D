import test from 'node:test';
import assert from 'node:assert/strict';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
globalThis.performance = globalThis.performance || { now: () => 1000 };
globalThis.document = {
  getElementById: () => null,
  body: { classList: { toggle() {} } },
  createElement: () => ({
    width: 128,
    height: 128,
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    getContext: () => ({
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
      fillRect() {}, clearRect() {}, strokeRect() {}, beginPath() {},
      arc() {}, fill() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {},
      createRadialGradient() { return { addColorStop() {} }; }
    })
  })
};

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  applyEuler() { return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
}

class Mat4 {
  makeRotationFromEuler() { return this; }
  makeScale() { return this; }
  multiply() { return this; }
}

class Obj3D {
  constructor() {
    this.position = new Vec3();
    this.rotation = { x: 0, y: 0, z: 0, order: 'XYZ', set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(r) { Object.assign(this, r); } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, setScalar(s) { this.x = this.y = this.z = s; } };
    this.children = [];
    this.userData = {};
    this.visible = true;
    this.material = { color: { setHex() {}, setRGB() {}, clone() { return this; } }, emissive: { setHex() {} }, opacity: 1, dispose() {} };
  }
  add(...args) { args.forEach((a) => { if (a) { a.parent = this; this.children.push(a); } }); }
  remove(a) { const i = this.children.indexOf(a); if (i !== -1) this.children.splice(i, 1); }
  traverse(fn) { fn(this); this.children.forEach((c) => c.traverse && c.traverse(fn)); }
  updateMatrixWorld() {}
  getWorldPosition(out = new Vec3()) { return out.copy(this.position); }
}

function fakeGeom() {
  return { dispose() {}, userData: {}, clone() { return fakeGeom(); }, translate() { return this; }, rotateX() { return this; }, attributes: { position: { count: 0 } }, index: null, getAttribute() { return { count: 0, array: [] }; } };
}
function fakeMat(opts = {}) {
  return Object.assign({ color: { setHex() {}, setRGB() {}, set() {} }, emissive: { setHex() {} }, userData: {}, dispose() {}, clone() { return fakeMat(opts); } }, opts);
}

globalThis.window = {
  THREE: {
    Vector3: Vec3,
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    Matrix4: Mat4,
    Group: Obj3D,
    Mesh: Obj3D,
    Box3: class { setFromObject() { return this; } getCenter(v) { return v.set(0, 0, 0); } getSize(v) { return v.set(0.1, 0.1, 0.1); } min = new Vec3(); },
    Points: Obj3D,
    PointsMaterial: fakeMat,
    BufferGeometry: fakeGeom,
    BufferAttribute: class {},
    CylinderGeometry: fakeGeom,
    BoxGeometry: fakeGeom,
    SphereGeometry: fakeGeom,
    ConeGeometry: fakeGeom,
    TorusGeometry: fakeGeom,
    PlaneGeometry: fakeGeom,
    DodecahedronGeometry: fakeGeom,
    MeshStandardMaterial: fakeMat,
    MeshBasicMaterial: fakeMat,
    CanvasTexture: class { constructor() { this.userData = {}; } },
    DataTexture: class { constructor(d, w, h) { this.image = { data: d, width: w, height: h }; this.userData = {}; } },
    RGBAFormat: 1023,
    EquirectangularReflectionMapping: 301,
    DoubleSide: 2,
    FrontSide: 0,
    MathUtils: { lerp: (a, b, t) => a + (b - a) * t }
  }
};
globalThis.THREE = globalThis.window.THREE;

const { getSyringeInjectionDoseMl } = await import('../js/items/syringe.js');
const { canSyringeTarget } = await import('../js/items/item-registry.js');
const { interactDehydrator } = await import('../js/items/dehydrator.js');
const { fillPetriWithPda } = await import('../js/items/petri-dish.js');
const { makeWaterSprayBottle, ALCOHOL_SPRAY_META, WATER_SPRAY_META } = await import('../js/items/alcohol-spray.js');
const { makeDistilledJug5L } = await import('../js/items/distilled-jug.js');
const { makeFalconTube, stepFalconCultures } = await import('../js/items/falcon-tubes.js');
const { applyFoilWrap, applyMicroporeSeal, transferGrainToGrain, fillSpawnWithSubstrate } = await import('../js/items/spawn-containers.js');
const { isHoldingColonizedGrainSpawn } = await import('../js/items/monotub.js');
const { getMushroomVisualProfile } = await import('../js/world/mushroom-species.js');
const { CULTIVATION_TRACKS, calculateRealWorldRecipe, diagnoseItemPedagogy } = await import('../js/core/cultivation-tracks.js');
const { getLabEnvironmentMap } = await import('../js/engine/lab-env-map.js');

test('v2.3.0: seringa 10ml dosa corretamente por tipo de recipiente e canSyringeTarget bloqueia bulk direto', () => {
  const petri = { mesh: { userData: { isPetri: true, petriCtrl: { mode: 'empty', lidOpen: true, sterilized: true } } } };
  const pp5 = { mesh: { userData: {} }, spawnCtrl: { isPP5: true, filled: true, sterilized: true, waterMl: 35 }, meta: { compatibilities: { receivesSyringe: true } } };
  const jar = { mesh: { userData: {} }, spawnCtrl: { isBag: false, filled: true, sterilized: true }, meta: { compatibilities: { receivesSyringe: true } } };
  const bag = { mesh: { userData: {} }, spawnCtrl: { isBag: true, filled: true, sealed: true, sterilized: true }, meta: { compatibilities: { receivesSyringe: true } } };
  const bulk = { mesh: { userData: {} }, spawnCtrl: { isBag: true, filled: true, sealed: true, sterilized: true, substrateKind: 'coco_verm' } };

  assert.equal(getSyringeInjectionDoseMl(petri, 10), 1);
  assert.equal(getSyringeInjectionDoseMl(pp5, 10), 1);
  assert.equal(getSyringeInjectionDoseMl(jar, 10), 2.5);
  assert.equal(getSyringeInjectionDoseMl(bag, 10), 4);
  assert.equal(canSyringeTarget(bulk), false);
});

test('v2.3.0: desidratadora bloqueia spawn fantasma, preserva espécie/gramas e Pour Tek libera ágar estéril', () => {
  const dehyd = {
    id: 'dehyd_t',
    label: 'Desidratadora',
    mesh: new Obj3D(),
    dehydratorCtrl: { on: false, hasMushroom: false, progress: 0, crisp: false, speciesName: '', grams: 10 }
  };
  const pickables = [];
  const ctx = {
    heldItem: null,
    pickableItems: pickables,
    pendingMovedItems: {},
    callbacks: { onToast() {} },
    notifyWorldAction() {}
  };
  interactDehydrator(ctx, dehyd);
  assert.equal(dehyd.dehydratorCtrl.hasMushroom, false, 'clique sem cogumelo não pode criar cogumelo fantasma');

  const mush = {
    id: 'harvest_tub_abc',
    mesh: new Obj3D(),
    wildMushroomCtrl: { speciesName: 'Jack Frost', grams: 17, removed: false }
  };
  pickables.push(mush);
  ctx.heldItem = mush;
  interactDehydrator(ctx, dehyd);
  assert.equal(dehyd.dehydratorCtrl.hasMushroom, true);
  assert.equal(dehyd.dehydratorCtrl.speciesName, 'Jack Frost');
  assert.equal(dehyd.dehydratorCtrl.grams, 17);
  assert.equal(ctx.heldItem, null);
  assert.equal(pickables.length, 0);

  const petri = {
    label: 'Petri',
    mesh: new Obj3D()
  };
  petri.mesh.userData.petriCtrl = { mode: 'bare', lidOpen: true, sterilized: false };
  assert.equal(fillPetriWithPda(petri, true), true);
  assert.equal(petri.mesh.userData.petriCtrl.mode, 'empty');
  assert.equal(petri.mesh.userData.petriCtrl.sterilized, true);
});

test('v2.3.0: borrifador Água Destilada, Garrafão 5L isWaterGallon e isHoldingColonizedGrainSpawn excluindo bulk', () => {
  const ctx = { scene: new Obj3D(), pickableItems: [], falconItems: [], spawnGrowItems: [] };
  const wSpray = makeWaterSprayBottle(ctx, 'water_spray_lab_01', 0, 1, 0);
  const jug = makeDistilledJug5L(ctx, 'distilled_jug_5l', 0, 1, 0, 5000);

  assert.equal(wSpray.mesh.userData.isWaterSpray, true);
  assert.equal(WATER_SPRAY_META.compatibilities.canHydrateGreenhouse, true);
  assert.equal(ALCOHOL_SPRAY_META.compatibilities.canHydrateGreenhouse, false);
  assert.equal(jug.mesh.userData.isWaterGallon, true);
  assert.equal(isHoldingColonizedGrainSpawn({ spawnCtrl: { filled: true, colonized: true, substrateKind: 'coco_verm' } }), false);
  assert.equal(isHoldingColonizedGrainSpawn({ spawnCtrl: { filled: true, colonized: true, substrateKind: 'corn' } }), true);
});

test('v2.3.0: Falcon slant/LC, Foil, Micropore, G2G e espécies Azurescens/Jack Frost corretas', () => {
  const ctx = {
    scene: new Obj3D(),
    pickableItems: [],
    falconItems: [],
    spawnGrowItems: [],
    hoodAirData: {
      on: true,
      workArea: { minX: -19, maxX: -18, minZ: -9, maxZ: -8, topY: 1 }
    },
    hoodSanitizedUntil: Date.now() + 60000
  };
  const tube = makeFalconTube(ctx, 'falcon_15ml_test', 15, 0, 1, 0, 10);
  tube.cultureCtrl.inoculated = true;
  tube.cultureCtrl.sterilized = true;
  tube.cultureCtrl.speciesName = 'Golden Teacher';
  for (let i = 0; i < 30; i++) stepFalconCultures(ctx, 1.0);
  assert.equal(tube.cultureCtrl.colonized, true);

  const jar = { label: 'Vidro', mesh: new Obj3D(), meta: { compatibilities: { receivesSubstrate: true } }, spawnCtrl: { isBag: false, isPP5: false, filled: false, updateVisual() {} } };
  fillSpawnWithSubstrate(jar, 'sawdust');
  assert.equal(jar.spawnCtrl.substrateKind, 'sawdust');
  applyFoilWrap(jar);
  applyMicroporeSeal(jar);
  assert.equal(jar.foilWrapped, true);
  assert.equal(jar.microporeSealed, true);

  const srcG = { spawnCtrl: { filled: true, colonized: true, substrateKind: 'corn', generation: 1, speciesName: 'B+', g2gUses: 0, updateVisual() {} }, mesh: { position: new Vec3(-18.2, 1.06, -8.2) } };
  const dstG = { spawnCtrl: { filled: true, sterilized: true, substrateKind: 'wheat', inoculated: false, updateVisual() {} }, mesh: { position: new Vec3(-18.2, 1.06, -8.2) } };
  const g2g = transferGrainToGrain(ctx, srcG, dstG);
  assert.equal(g2g.ok, true);
  assert.equal(dstG.spawnCtrl.inoculated, true);
  assert.equal(dstG.spawnCtrl.generation, 2);

  const azu = getMushroomVisualProfile('Psilocybe azurescens');
  assert.equal(azu.scientific, 'Psilocybe azurescens');
  assert.equal(azu.shape, 'cubensis');
  assert.equal(getMushroomVisualProfile('Jack Frost').glow, true);
});

test('v2.3.0: trilhas solo, calculadora real, diagnóstico pedagógico e EnvMap procedural funcionam', () => {
  assert.equal(CULTIVATION_TRACKS.length, 4);
  const lc = calculateRealWorldRecipe('lc', 500);
  assert.ok(lc.items.some((t) => t.includes('20 g')));
  const diag = diagnoseItemPedagogy({ spawnCtrl: { filled: true, hydrated: false, waterMl: 0, substrateKind: 'corn' } });
  assert.equal(diag.level, 'warn');
  assert.ok(getLabEnvironmentMap() !== null);
});
