import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ExtrudeGeometry, Shape, ShapeGeometry } from '../js/vendor/three.bundle.min.js';

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
      if (o) { o.parent = this; this.children.push(o); }
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
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    BoxGeometry: MockGeo,
    CylinderGeometry: MockGeo,
    SphereGeometry: MockGeo,
    ConeGeometry: MockGeo,
    TorusGeometry: MockGeo,
    PlaneGeometry: MockGeo,
    DodecahedronGeometry: MockGeo,
    IcosahedronGeometry: MockGeo,
    RingGeometry: MockGeo,
    LatheGeometry: MockGeo,
    ExtrudeGeometry,
    Shape,
    ShapeGeometry,
    TubeGeometry: MockGeo,
    CatmullRomCurve3: class { constructor(pts) { this.points = pts || []; } },
    MeshStandardMaterial: MockMat,
    MeshBasicMaterial: MockMat,
    MeshPhysicalMaterial: MockMat,
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1,
    CanvasTexture: class { constructor() { this.needsUpdate = false; } }
  }
};

globalThis.document = {
  createElement: () => ({
    width: 256,
    height: 160,
    getContext: () => ({
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      fillRect() {},
      strokeRect() {},
      fillText() {},
      beginPath() {},
      arc() {},
      fill() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      stroke() {},
      save() {},
      restore() {},
      beginPath() {},
      translate() {},
      rotate() {},
      createRadialGradient: () => ({ addColorStop() {} })
    })
  })
};

const { CONTAMINATION_CATALOG, CONTAM_IDS, pickContamKind, getContamInfo } = await import('../js/items/contaminations.js');
const { makeH2O2SprayBottle } = await import('../js/items/alcohol-spray.js');
const { treatMonotubWithH2O2, calculateHarvestYieldGrams } = await import('../js/items/monotub.js');
const { SHOP_SUPPLIES } = await import('../js/ui/modal-shop.js');
const { getActiveVipOrders, matchVipOrder } = await import('../js/items/dehydration-packaging.js');
const { analyzeSpecimenForMicroscope } = await import('../js/items/lab-advanced-tools.js');

function createMockCtx() {
  return {
    scene: new MockObj(),
    pickableItems: [],
    pickableMap: new Map(),
    dynamicColliderItems: [],
    cabinetManagedItems: [],
    itemRegistry: {},
    callbacks: { onToast() {} }
  };
}

test('v2.2.0: contaminations catalog defines all 6 pathogens and only cobweb is H2O2 curable', () => {
  assert.deepEqual(
    CONTAM_IDS.slice().sort(),
    ['aspergillus', 'cobweb', 'lipstick', 'penicillium', 'trichoderma', 'wet_spot']
  );
  for (const id of CONTAM_IDS) {
    const info = CONTAMINATION_CATALOG[id];
    assert.ok(info && info.name && info.badgeHex && typeof info.hex === 'number');
    assert.equal(Boolean(info.curableWithH2O2), id === 'cobweb');
  }
  assert.equal(getContamInfo('unknown_kind').id, 'trichoderma');
  assert.ok(CONTAM_IDS.includes(pickContamKind('petri')));
  assert.ok(CONTAM_IDS.includes(pickContamKind('monotub')));
  assert.equal(pickContamKind('monotub', 'cobweb'), 'cobweb');
});

test('v2.2.0: H2O2 3% spray bottle treats cobweb monotub and rejects trichoderma', () => {
  const ctx = createMockCtx();
  const bottle = makeH2O2SprayBottle(ctx, 'h2o2_spray_lab', 0, 1, 0);
  assert.equal(bottle.mesh.userData.isH2O2Spray, true);
  assert.ok(SHOP_SUPPLIES.some((s) => s.id === 'sup_h2o2' && s.prefabId === 'h2o2_spray'));

  const cobwebTub = {
    label: 'Monotub',
    monotubCtrl: { contaminated: true, contamKind: 'cobweb', contamReason: 'Cobweb' }
  };
  assert.equal(treatMonotubWithH2O2(ctx, cobwebTub), true);
  assert.equal(cobwebTub.monotubCtrl.contaminated, false);
  assert.equal(cobwebTub.monotubCtrl.contamKind, '');

  const trichTub = {
    label: 'Monotub',
    monotubCtrl: { contaminated: true, contamKind: 'trichoderma', contamReason: 'Trichoderma' }
  };
  assert.equal(treatMonotubWithH2O2(ctx, trichTub), false);
  assert.equal(trichTub.monotubCtrl.contaminated, true);
});

test('rendimento distingue clone de tecido, repiques e origem desconhecida', () => {
  assert.equal(calculateHarvestYieldGrams(10, 'monospore', false), 10);
  assert.equal(calculateHarvestYieldGrams(10, 'hybrid', false), 10);
  assert.equal(calculateHarvestYieldGrams(10, '', false), 10);
  assert.equal(calculateHarvestYieldGrams(10, 'tissue_clone', false), 14);
  assert.equal(calculateHarvestYieldGrams(10, 'tissue_clone', true), 17);
});


test('v2.2.0: drive-thru VIP orders expose 2 active species and match orders cleanly', () => {
  const vips = getActiveVipOrders();
  assert.equal(vips.length, 2);
  const hit = matchVipOrder(`${vips[0]} (Cultivo Especial)`);
  assert.ok(hit && hit.species === vips[0]);
  assert.equal(matchVipOrder('Espécie Inexistente XYZ'), null);
});

test('v2.2.0: microscope 2.0 analyzes pathogen-specific contamination and healthy F1 hyphae', () => {
  const wetPetri = {
    label: 'Placa de Petri',
    mesh: {
      userData: {
        isPetri: true,
        petriCtrl: { mode: 'contam', contaminated: true, contamKind: 'wet_spot', colonization: 30, speciesName: 'Golden Teacher' }
      }
    }
  };
  const wetRes = analyzeSpecimenForMicroscope(wetPetri);
  assert.equal(wetRes.status, 'contaminated');
  assert.equal(wetRes.contamKind, 'wet_spot');

  const clonePetri = {
    label: 'Placa de Petri F1',
    mesh: {
      userData: {
        isPetri: true,
        petriCtrl: { mode: 'clean', colonized: true, colonization: 100, generation: 3, speciesName: 'Jack Frost' }
      }
    }
  };
  const cloneRes = analyzeSpecimenForMicroscope(clonePetri);
  assert.equal(cloneRes.status, 'rhizomorphic');
  assert.match(cloneRes.diagnosis, /T3|Clonagem|Grampos/i);
});

test('v2.2.0: quality shadowMap.autoUpdate disabled + auth & schema persistence present', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const qualitySrc = fs.readFileSync(path.join(root, 'js/core/quality.js'), 'utf8');
  assert.match(qualitySrc, /renderer\.shadowMap\.autoUpdate\s*=\s*false;/);

  const authSrc = fs.readFileSync(path.join(root, 'api/auth.php'), 'utf8');
  assert.match(authSrc, /'sup_h2o2'/);
  assert.match(authSrc, /'equipped_toy'/);

  const schemaSrc = fs.readFileSync(path.join(root, 'api/multiplayer_schema.php'), 'utf8');
  assert.match(schemaSrc, /'h2o2_spray_lab'/);
  assert.match(schemaSrc, /\$validContamKinds/);
  assert.match(schemaSrc, /customTag/);
});

test('toy persistence: setEquippedToy synchronizes local state, localStorage, and progress', async () => {
  const { setEquippedToy } = await import('../js/ui/modal-shop.js');
  const { appState } = await import('../js/core/state.js');

  const syncCalls = [];
  globalThis.window.syncCampusUserProgress = (p) => { syncCalls.push(p); };
  let sbActive = false;
  let skActive = false;
  let pgActive = false;
  globalThis.window.setCampusSnowboard = (a) => { sbActive = a; };
  globalThis.window.setCampusSkateboard = (a) => { skActive = a; };
  globalThis.window.setCampusParaglider = (a) => { pgActive = a; };

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  appState.currentUser = { id: 42, progress: { equipped_toy: '' } };

  // 1. Equip snowboard
  setEquippedToy('snowboard');
  assert.equal(sbActive, true);
  assert.equal(skActive, false);
  assert.equal(pgActive, false);
  assert.equal(appState.currentUser.progress.equipped_toy, 'snowboard');
  assert.equal(globalThis.localStorage.getItem('myco_equipped_toy'), 'snowboard');
  assert.deepEqual(syncCalls[syncCalls.length - 1], { equipped_toy: 'snowboard' });

  // 2. Deactivate snowboard
  setEquippedToy('');
  assert.equal(sbActive, false);
  assert.equal(skActive, false);
  assert.equal(pgActive, false);
  assert.equal(appState.currentUser.progress.equipped_toy, '');
  assert.equal(globalThis.localStorage.getItem('myco_equipped_toy'), '');
  assert.deepEqual(syncCalls[syncCalls.length - 1], { equipped_toy: '' });
});
