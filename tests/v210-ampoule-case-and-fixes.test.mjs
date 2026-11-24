import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

class MockVec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}

class MockObj {
  constructor() {
    this.position = new MockVec3();
    this.rotation = new MockVec3();
    this.scale = new MockVec3(1, 1, 1);
    this.children = [];
    this.userData = {};
    this.visible = true;
    this.parent = null;
  }
  add(...objs) {
    objs.forEach((o) => {
      if (o) {
        o.parent = this;
        this.children.push(o);
      }
    });
  }
  remove(o) {
    const i = this.children.indexOf(o);
    if (i !== -1) this.children.splice(i, 1);
  }
  traverse(fn) {
    fn(this);
    this.children.forEach((c) => c.traverse && c.traverse(fn));
  }
}

class MockMat {
  constructor(opts = {}) {
    this.color = { hex: opts.color ?? 0xffffff, setHex(h) { this.hex = h; } };
    this.emissive = { hex: opts.emissive ?? 0, setHex(h) { this.hex = h; } };
    this.opacity = opts.opacity ?? 1;
    this.transparent = !!opts.transparent;
    this.userData = {};
  }
}

class MockMesh extends MockObj {
  constructor(geo, mat) {
    super();
    this.geometry = geo || {};
    this.material = mat || new MockMat();
    this.isMesh = true;
  }
}

class MockGeo {
  constructor() { this.userData = {}; }
  dispose() {}
}

globalThis.window = {
  THREE: {
    Scene: MockObj,
    Group: MockObj,
    Mesh: MockMesh,
    Vector3: MockVec3,
    BoxGeometry: MockGeo,
    CylinderGeometry: MockGeo,
    SphereGeometry: MockGeo,
    ConeGeometry: MockGeo,
    TorusGeometry: MockGeo,
    PlaneGeometry: MockGeo,
    DodecahedronGeometry: MockGeo,
    IcosahedronGeometry: MockGeo,
    RingGeometry: MockGeo,
    MeshStandardMaterial: MockMat,
    MeshBasicMaterial: MockMat,
    DoubleSide: 2
  }
};

globalThis.document = {
  createElement: () => ({
    width: 256,
    height: 96,
    getContext: () => ({
      fillStyle: '',
      font: '',
      textAlign: '',
      fillRect() {},
      fillText() {}
    })
  }),
  getElementById: () => null
};

test('Maleta de 5 ml mantém 50 vagas e restaura o volume salvo', async () => {
  const {
    AMPOULE_CASE_MAX_SLOTS,
    AMPOULE_VIAL_MAX_ML,
    AMPOULE_SPECIES_CATALOG,
    makeAmpouleCase,
    takeVialFromAmpouleCase,
    storeVialInAmpouleCase
  } = await import('../js/items/ampoule-case.js');

  assert.equal(AMPOULE_CASE_MAX_SLOTS, 50);
  assert.equal(AMPOULE_VIAL_MAX_ML, 5);
  assert.ok(AMPOULE_SPECIES_CATALOG.length >= 24);
  const groups = new Set(AMPOULE_SPECIES_CATALOG.map((s) => s.group));
  assert.ok(groups.has('Cubensis') && groups.has('Comestível') && groups.has('Raro'));

  const ctx = {
    scene: new window.THREE.Scene(),
    pickableItems: [],
    pickableMap: new Map(),
    pendingMovedItems: {},
    isTouchDevice: () => false,
    callbacks: {}
  };

  const caseItem = makeAmpouleCase(ctx, 'dyn_ampoule_case_test', 0, 1, 0);
  assert.equal(caseItem.caseCtrl.slots.length, 50);
  assert.equal(caseItem.caseCtrl.slots.filter(Boolean).length, AMPOULE_SPECIES_CATALOG.length);

  const vial = takeVialFromAmpouleCase(ctx, caseItem, 0);
  assert.ok(vial);
  assert.equal(ctx.heldItem, vial);
  assert.equal(vial.cultureCtrl.colonized, true);
  assert.equal(vial.mesh.userData.liquidCtrl.maxMl, 5);
  assert.equal(caseItem.caseCtrl.slots[0], null);

  vial.cultureCtrl.contaminated = true;
  const stored = storeVialInAmpouleCase(ctx, caseItem, vial, 49);
  assert.equal(stored, true);
  assert.equal(ctx.heldItem, null);
  assert.equal(caseItem.caseCtrl.slots[49].contaminated, true);

  const serialized = caseItem.meta.serializeState(caseItem);
  serialized.slots[25] = {
    speciesName: 'Cordyceps Militaris',
    group: 'Raro',
    volMl: 2.5,
    colonized: true,
    contaminated: false,
    sterilized: true
  };
  caseItem.meta.applyState(caseItem, serialized, ctx);
  assert.equal(caseItem.caseCtrl.slots[25].speciesName, 'Cordyceps Militaris');
  assert.equal(caseItem.caseCtrl.slots[49].contaminated, true);
  serialized.slots[25].volMl = 3;
  caseItem.meta.applyState(caseItem, serialized, ctx);
  assert.equal(caseItem.caseCtrl.slots[25].volMl, 3, 'ampolas antigas mantêm seu volume salvo');
});

test('SHOP_SUPPLIES inclui maleta por 1000 Moedas, 1000 XP e 100 Cogumelos', async () => {
  const { SHOP_SUPPLIES } = await import('../js/ui/modal-shop.js');
  const sup = SHOP_SUPPLIES.find((s) => s.id === 'sup_ampoule_case');
  assert.ok(sup);
  assert.equal(sup.prefabId, 'ampoule_case');
  assert.equal(sup.price_coins, 1000);
  assert.equal(sup.req_xp, 1000);
  assert.equal(sup.req_mushrooms, 100);
});

test('Formas 3D reais fofinhas de cogumelos por espécie e updateItemBounds síncrono da geladeira', async () => {
  const {
    getMushroomVisualProfile,
    createMushroomMeshBySpeciesName
  } = await import('../js/world/mushroom-species.js');

  assert.equal(getMushroomVisualProfile('Juba de Leão (Hericium erinaceus)').shape, 'lions_mane');
  assert.equal(getMushroomVisualProfile('Cordyceps Militaris').shape, 'cordyceps');
  assert.equal(getMushroomVisualProfile('Morel Colmeia (Morchella esculenta)').shape, 'morel');
  assert.equal(getMushroomVisualProfile('Reishi Vermelho (Ganoderma lucidum)').shape, 'shelf');
  assert.equal(getMushroomVisualProfile('Jack Frost Albino (Psilocybe cubensis)').isMagic, true);
  assert.equal(getMushroomVisualProfile('Enoki Branco (Flammulina velutipes)').isMagic, false);

  const mesh = createMushroomMeshBySpeciesName('Chanterelle Dourado (Cantharellus cibarius)', 0.05);
  assert.ok(mesh && Array.isArray(mesh.children) && mesh.children.length > 0);

  const { updateItemBounds } = await import('../js/items/item-registry.js');
  const fakeShelf = {
    localMinX: -0.34, localMaxX: 0.34,
    localMinZ: -0.285, localMaxZ: 0.275,
    localTopY: 0.20,
    isCultureFridgeShelf: true
  };
  const fakeFridge = {
    id: 'culture_fridge_test',
    mesh: Object.assign(new MockObj(), {
      userData: { tableDims: { w: 0.88, h: 1.55, d: 0.72, surfOffset: 0 } }
    }),
    fridgeCtrl: {
      roofSurface: {},
      shelfSurfaces: [fakeShelf],
      slots: [{ localX: 0, localY: 0.20, localZ: 0.04, worldPosition: new MockVec3() }]
    }
  };
  fakeFridge.mesh.position.set(10, 0.5, -4);
  updateItemBounds(fakeFridge);
  assert.equal(fakeShelf.ownerItem, fakeFridge);
  assert.ok(Math.abs(fakeShelf.topY - 0.70) < 1e-6);
  assert.ok(Math.abs(fakeFridge.fridgeCtrl.slots[0].worldPosition.x - 10) < 1e-6);
  assert.ok(Math.abs(fakeFridge.fridgeCtrl.slots[0].worldPosition.y - 0.70) < 1e-6);
});

test('Carimbo de esporos na Petri dura >= 1 ano (730 dias) e receitas/schema/gavetas consistentes', async () => {
  const {
    SPORE_PRINT_ROOM_SHELF_LIFE_DAYS,
    CULTURE_GAME_DAY_SECONDS,
    getCultureRemainingDays,
    stepCultureShelfLife
  } = await import('../js/items/culture-lifecycle.js');

  assert.ok(SPORE_PRINT_ROOM_SHELF_LIFE_DAYS >= 365);
  const sporeCtrl = {
    mode: 'spore_print',
    colonized: false,
    contaminated: false,
    expired: false,
    refrigerated: false,
    ageGameDays: 0,
    shelfLifeAgeDays: 0
  };
  assert.ok(getCultureRemainingDays(sporeCtrl) >= 365);
  stepCultureShelfLife(sporeCtrl, CULTURE_GAME_DAY_SECONDS * 200);
  assert.equal(sporeCtrl.expired, false);
  assert.ok(getCultureRemainingDays(sporeCtrl) >= 500);

  const schemaPhp = fs.readFileSync(path.resolve('api/multiplayer_schema.php'), 'utf8');
  assert.ok(schemaPhp.includes("'vermiculite', 'coco'"));

  const syncJs = fs.readFileSync(path.resolve('js/systems/world-objects-sync.js'), 'utf8');
  assert.ok(syncJs.includes('vermiculite:') && syncJs.includes('coco:'));

  const cabJs = fs.readFileSync(path.resolve('js/items/lab-cabinets.js'), 'utf8');
  assert.ok(cabJs.includes('drawerLiner'));
});

test('Persistência completa de conta: MycoCoins sem trava de authToken, buy_supply e sync_progress no PHP', async () => {
  const { SHOP_SUPPLIES } = await import('../js/ui/modal-shop.js');
  const bootJs = fs.readFileSync(path.resolve('js/ui/app-boot.js'), 'utf8');
  assert.ok(!bootJs.includes('if (!appState.currentUser || !appState.authToken) return;'));
  assert.ok(bootJs.includes('flushCampusMycoCoins'));
  assert.ok(bootJs.includes('syncCampusUserProgress'));

  const authPhp = fs.readFileSync(path.resolve('api/auth.php'), 'utf8');
  assert.ok(authPhp.includes("action === 'buy_supply'"));
  assert.ok(authPhp.includes("action === 'sync_progress'"));
  SHOP_SUPPLIES.forEach((sup) => {
    assert.ok(authPhp.includes(`'${sup.id}' => ['prefab_id' => '${sup.prefabId}', 'price_coins' => ${sup.price_coins},`),
      `Catálogo do servidor não corresponde à entrega e ao preço de ${sup.id}`);
  });

  const dbPhp = fs.readFileSync(path.resolve('api/db.php'), 'utf8');
  assert.ok(dbPhp.includes('progress_json'));

  const { setMycoCoinsUserScope, getLocalMycoCoins, setLocalMycoCoins } = await import('../js/items/dehydration-packaging.js');
  setMycoCoinsUserScope(77);
  setLocalMycoCoins(1350);
  assert.equal(getLocalMycoCoins(), 1350);
  setMycoCoinsUserScope(null);
  assert.equal(getLocalMycoCoins(), 250);
});

test('compra pendente sobrevive à resposta perdida e reenvia o mesmo pedido sem cobrar duas vezes', async () => {
  const { appState } = await import('../js/core/state.js');
  const { orderShopSupply, retryPendingShopPurchase } = await import('../js/services/shop-purchases.js');
  const { setMycoCoinsUserScope } = await import('../js/items/dehydration-packaging.js');
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k) };
  const buyer = { id: 91, display_name: 'Jogador', role: 'student', myco_coins: 250, completed_modules: [] };
  appState.currentUser = buyer;
  setMycoCoinsUserScope(buyer.id);
  let orderId = '';
  let balance = 250;
  let calls = 0;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('shop_capabilities')) return { status: 200, text: async () => '{"ok":true,"durable_delivery":1}' };
    const body = JSON.parse(opts.body);
    calls++;
    if (!orderId) { orderId = body.order_id; balance -= 30; throw new Error('resposta perdida'); }
    assert.equal(body.order_id, orderId);
    return { status: 200, text: async () => JSON.stringify({ ok: true, delivery_id: 'dyn_shop_test', user: { ...buyer, myco_coins: balance } }) };
  };
  try {
    const result = await orderShopSupply('sup_pp5', { x: 1, y: 0, z: 2, ry: 0 });
    assert.equal(result.pending, true);
    assert.ok(values.has('myco_shop_order_v1_91'));
    appState.currentUser = { id: 92 };
    assert.equal(await retryPendingShopPurchase(true), null);
    appState.currentUser = buyer;
    const confirmed = await retryPendingShopPurchase(true);
    assert.equal(confirmed.ok, true);
    assert.equal(calls, 2);
    assert.equal(appState.currentUser.myco_coins, 220);
    assert.equal(values.has('myco_shop_order_v1_91'), false);
  } finally {
    appState.currentUser = null;
    setMycoCoinsUserScope(null);
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('sincronização só confirma versões após aplicar layout e posição da entrega', async () => {
  const { appState } = await import('../js/core/state.js');
  const { syncMultiplayer } = await import('../js/services/multiplayer-sync.js');
  const originalFetch = globalThis.fetch;
  const oldWindow = { ...globalThis.window };
  const previous = { ...appState };
  Object.assign(appState, { currentUser: { id: 93 }, syncInFlight: false, syncQueued: false, isInitialSync: false,
    lastLayoutVer: 'old-layout', lastObjVer: 'old-objects', syncFailures: 0 });
  let failLayout = true;
  const calls = [];
  window.getCampusPlayerPose = () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  window.consumeCampusMovedItems = () => [];
  window.applyCampusLayoutEdits = () => { calls.push('layout'); if (failLayout) throw new Error('ainda carregando'); };
  window.applyCampusWorldObjects = () => calls.push('objects');
  const sentVersions = [];
  globalThis.fetch = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    sentVersions.push([body.layout_ver, body.obj_ver]);
    return { status: 200, text: async () => JSON.stringify({ ok: true, layout_ver: 'new-layout', obj_ver: 'new-objects',
      layout_edits: { dyn_shop_1: { prefab_id: 'pp5_cup' } }, objects: { dyn_shop_1: { x: 1, y: 0, z: 2 } } }) };
  };
  try {
    await syncMultiplayer();
    assert.equal(appState.lastLayoutVer, 'old-layout');
    assert.equal(appState.lastObjVer, 'old-objects');
    assert.equal(appState.syncFailures, 1);
    failLayout = false;
    await syncMultiplayer();
    assert.deepEqual(sentVersions, [['old-layout', 'old-objects'], ['old-layout', 'old-objects']]);
    assert.deepEqual(calls, ['layout', 'layout', 'objects']);
    assert.equal(appState.lastLayoutVer, 'new-layout');
    assert.equal(appState.lastObjVer, 'new-objects');
    assert.equal(appState.syncFailures, 0);
    window.getCampusPlayerPose = () => { throw new Error('câmera indisponível'); };
    await syncMultiplayer();
    assert.equal(appState.syncInFlight, false, 'falha antes da requisição não deve travar a sincronização');
  } finally {
    globalThis.fetch = originalFetch;
    Object.keys(window).forEach((key) => { if (!(key in oldWindow)) delete window[key]; });
    Object.assign(window, oldWindow);
    Object.assign(appState, previous);
  }
});
