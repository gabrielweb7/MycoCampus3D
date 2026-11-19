import test from 'node:test';
import assert from 'node:assert/strict';

class MockColor {
  constructor(hex = 0xffffff) { this.hex = hex; }
  clone() { return new MockColor(this.hex); }
  setHex(hex) { this.hex = hex; return this; }
  copy(c) { this.hex = c.hex; return this; }
  lerp() { return this; }
}

class MockMat {
  constructor(opts = {}) {
    this.color = new MockColor(opts.color ?? 0xffffff);
    this.emissive = opts.emissive ? new MockColor(opts.emissive) : undefined;
    this.transparent = !!opts.transparent;
    this.opacity = opts.opacity ?? 1;
    this.depthWrite = opts.depthWrite ?? true;
    this.colorWrite = opts.colorWrite ?? true;
    this.visible = opts.visible ?? true;
    this.userData = {};
  }
  clone() { return new MockMat({ ...this, emissive: this.emissive?.hex }); }
  dispose() {}
}

class MockObj {
  constructor(isMesh = false, mat = null) {
    this.isMesh = isMesh;
    this.material = mat;
    this.visible = true;
    this.matrixAutoUpdate = true;
    this.frustumCulled = true;
    this.userData = {};
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(p) { Object.assign(this, p); } };
    this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(r) { Object.assign(this, r); } };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1, copy(q) { Object.assign(this, q); } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(s) { Object.assign(this, s); } };
  }
  add(child) { this.children.push(child); }
  remove(child) { this.children = this.children.filter((c) => c !== child); }
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse(fn);
  }
  clone() {
    JSON.stringify(this.userData); // Simula Three.js Object3D.clone(true) que falha em circularidade
    throw new Error('updatePlacementGhostVisual nao deve chamar THREE.Object3D.clone()');
  }
}

globalThis.window = {
  THREE: {
    Color: MockColor,
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { Object.assign(this, v); return this; } },
    Group: class extends MockObj { constructor() { super(false, null); } },
    Mesh: class extends MockObj { constructor(_geo, mat) { super(true, mat); } },
    Object3D: class extends MockObj { constructor() { super(false, null); this.matrix = []; } updateMatrix() {} },
    InstancedMesh: class extends MockObj { constructor(_geo, mat) { super(true, mat); this.instanceMatrix = { needsUpdate: false }; } setMatrixAt() {} },
    RingGeometry: class {},
    CircleGeometry: class {},
    MeshBasicMaterial: MockMat,
    MeshStandardMaterial: MockMat,
    DoubleSide: 2
  }
};
globalThis.THREE = globalThis.window.THREE;

const {
  createPlacementGhost,
  updatePlacementGhostVisual,
  shouldHideHeldInPlacementMode
} = await import('../js/entities/placement-ghost.js');
const { RELEASE_NOTES_CATALOG, markPendingAutoUpdateNotice } = await import('../js/ui/whats-new-modal.js');

test('shouldHideHeldInPlacementMode oculta qualquer item em modo [G]', () => {
  const item = { id: 'burner_lab', mesh: { userData: {} } };
  assert.equal(shouldHideHeldInPlacementMode({ placementMode: false, heldItem: item }), false);
  assert.equal(shouldHideHeldInPlacementMode({ placementMode: true, heldItem: null }), false);
  assert.equal(shouldHideHeldInPlacementMode({ placementMode: true, heldItem: item }), true);
});

test('updatePlacementGhostVisual funciona com userData circular (ownerItem no fogareiro) e oculta hitboxes invisíveis', () => {
  const scene = { add() {} };
  const ghost = createPlacementGhost(scene);
  // Simula bug antigo onde freezeStaticWorld congelava ring/dot
  ghost.children[0].matrixAutoUpdate = false;
  ghost.children[1].matrixAutoUpdate = false;

  const burnerRoot = new MockObj(false);
  const bSurf = {};
  const burnerItem = { id: 'burner_lab', mesh: burnerRoot };
  bSurf.ownerItem = burnerItem; // Referência circular intencional igual registerPickable antigo
  burnerRoot.userData.dynamicSurface = bSurf;
  const body = new MockObj(true, new MockMat({ color: 0x0f172a }));
  body.userData.supportSurface = bSurf;
  const coilHit = new MockObj(true, new MockMat({ transparent: true, opacity: 0, colorWrite: false }));
  coilHit.userData.supportSurface = bSurf;
  burnerRoot.add(body);
  burnerRoot.add(coilHit);

  updatePlacementGhostVisual(burnerItem, true, 0.5, 1.0);

  assert.equal(ghost.children[0].matrixAutoUpdate, true);
  assert.equal(ghost.children[1].matrixAutoUpdate, true);
  const clonedRoot = ghost.children[2].children[0];
  assert.equal(clonedRoot.children.length, 1);
  assert.equal(clonedRoot.children[0].visible, true);
});

test('RELEASE_NOTES_CATALOG tem notas simples da v1.8.1 e modal fecha apenas pelos botões', async () => {
  const store = new Map([['myco_seen_whats_new_v', '1.8.0']]);
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  markPendingAutoUpdateNotice('1.8.1');
  assert.equal(store.get('myco_seen_whats_new_v'), undefined);
  assert.equal(store.get('myco_just_updated_v'), '1.8.1');
  assert.ok(RELEASE_NOTES_CATALOG['1.8.1']);
  assert.ok(RELEASE_NOTES_CATALOG['1.8.1'].items.length >= 4);

  const elements = new Map();
  const makeNode = (id = '') => {
    const classes = new Set();
    const listeners = new Map();
    return {
      id,
      _listeners: listeners,
      textContent: '',
      _innerHTML: '',
      set innerHTML(v) {
        this._innerHTML = v;
        if (String(v).includes('btn-close-whats-new')) elements.set('#btn-close-whats-new', makeNode('btn-close-whats-new'));
        if (String(v).includes('btn-confirm-whats-new')) elements.set('#btn-confirm-whats-new', makeNode('btn-confirm-whats-new'));
        if (String(v).includes('whats-new-card')) elements.set('#whats-new-card', makeNode('whats-new-card'));
        if (String(v).includes('whats-new-title')) elements.set('#whats-new-title', makeNode('whats-new-title'));
        if (String(v).includes('whats-new-subtitle')) elements.set('#whats-new-subtitle', makeNode('whats-new-subtitle'));
        if (String(v).includes('whats-new-list')) elements.set('#whats-new-list', makeNode('whats-new-list'));
      },
      get innerHTML() { return this._innerHTML; },
      classList: {
        add: (...c) => c.forEach((k) => classes.add(k)),
        remove: (...c) => c.forEach((k) => classes.delete(k)),
        contains: (c) => classes.has(c)
      },
      setAttribute() {},
      addEventListener: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      querySelector: (sel) => elements.get(sel) || null,
      dispatchClick(target) {
        const list = listeners.get('click') || [];
        list.forEach((fn) => fn({ target: target || this, preventDefault() {}, stopPropagation() {} }));
      }
    };
  };
  const modalNode = makeNode('whats-new-modal');
  const prevDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === 'whats-new-modal' && elements.has('whats-new-modal') ? elements.get('whats-new-modal') : null),
    createElement: () => modalNode,
    body: {
      appendChild(el) {
        elements.set(el.id, el);
      }
    }
  };
  const { showWhatsNewModal } = await import('../js/ui/whats-new-modal.js');
  showWhatsNewModal('1.8.1');
  assert.equal(modalNode.classList.contains('hidden'), false);
  // Clicar no backdrop (modalNode diretamente) NÃO deve fechar
  modalNode.dispatchClick(modalNode);
  assert.equal(modalNode.classList.contains('hidden'), false);
  // Clicar no botão confirmar fecha o modal
  elements.get('#btn-confirm-whats-new').dispatchClick();
  assert.equal(modalNode.classList.contains('hidden'), true);
  // Reabrir e fechar pelo botão X
  showWhatsNewModal('1.8.1');
  assert.equal(modalNode.classList.contains('hidden'), false);
  elements.get('#btn-close-whats-new').dispatchClick();
  assert.equal(modalNode.classList.contains('hidden'), true);
  globalThis.document = prevDoc;
});

test('força dos cogumelos mantém cores sem mandala e só ativa gnomos após >3 doses', async () => {
  const createdIds = [];
  const docBodyClasses = new Set();
  const makeEl = (id) => ({
    id,
    style: { cssText: '', opacity: '0', transition: '', setProperty() {}, removeProperty() {} },
    classList: {
      add: (c) => docBodyClasses.add(c),
      remove: (c) => docBodyClasses.delete(c),
      contains: (c) => docBodyClasses.has(c)
    }
  });
  const byId = new Map();
  globalThis.document = {
    body: {
      classList: makeEl('body').classList,
      appendChild(el) { byId.set(el.id, el); createdIds.push(el.id); }
    },
    documentElement: makeEl('html'),
    getElementById: (id) => byId.get(id) || null,
    createElement: () => makeEl('')
  };
  const {
    triggerMagicCubensisEffect,
    resetMagicCubensisEffect,
    isTripRainbowActive,
    isTripGnomesActive
  } = await import('../js/systems/mycoteca.js');

  triggerMagicCubensisEffect(); // 1ª (timer assíncrono)
  triggerMagicCubensisEffect(); // 2ª (ativo imediato)
  assert.equal(isTripRainbowActive(), true);
  assert.equal(isTripGnomesActive(), false);
  triggerMagicCubensisEffect(); // 3ª
  assert.equal(isTripGnomesActive(), false);
  triggerMagicCubensisEffect(); // 4ª (> 3 vezes)
  assert.equal(isTripGnomesActive(), true);
  assert.equal(byId.get('myco-mandala-overlay'), undefined);
  assert.ok(byId.get('myco-magic-overlay'));
  resetMagicCubensisEffect();
  delete globalThis.document;
});

test('FAMOUS_CONSTELLATIONS inclui Órion, Cruzeiro do Sul, Ursa Maior, Escorpião e gira no céu noturno', async () => {
  const {
    FAMOUS_CONSTELLATIONS,
    equatorialToDomeXYZ,
    updateCelestialSkyDome
  } = await import('../js/engine/sky-constellations.js');
  const ids = FAMOUS_CONSTELLATIONS.map((c) => c.id);
  assert.ok(ids.includes('orion'));
  assert.ok(ids.includes('crux'));
  assert.ok(ids.includes('ursa_major'));
  assert.ok(ids.includes('cassiopeia'));
  assert.ok(ids.includes('scorpius'));
  const xyz = equatorialToDomeXYZ(88.8, 24.4, 204);
  assert.equal(xyz.length, 3);
  assert.ok(xyz[1] > 12);

  const dome = {
    group: { visible: false, rotation: { y: 0, z: 0 } },
    bgMat: { opacity: 0 },
    conStarMat: { opacity: 0 },
    conLineMat: { opacity: 0 }
  };
  updateCelestialSkyDome(dome, 0.5, 0.8, 'clear', 10);
  assert.equal(dome.group.visible, false);
  updateCelestialSkyDome(dome, 0.94, -0.6, 'clear', 25);
  assert.equal(dome.group.visible, true);
  assert.ok(dome.conStarMat.opacity > 0.5);
  assert.ok(dome.conLineMat.opacity > 0.1);
  assert.notEqual(dome.group.rotation.y, 0);
});

test('SHOP_SUPPLIES e LAB_QUEST_STEPS estão completos e marcos da Micoteca dão recompensa', async () => {
  const { SHOP_SUPPLIES } = await import('../js/ui/modal-shop.js');
  const { LAB_QUEST_STEPS } = await import('../js/ui/quest-map.js');
  const { MICOTECA_MILESTONES, registerDiscoveredSpecies } = await import('../js/systems/mycoteca.js');
  assert.ok(SHOP_SUPPLIES.length >= 10);
  assert.ok(SHOP_SUPPLIES.some((s) => s.prefabId === 'monotub_24l'));
  assert.ok(SHOP_SUPPLIES.some((s) => s.prefabId === 'dehydrator'));
  assert.equal(LAB_QUEST_STEPS.length, 8);
  assert.equal(MICOTECA_MILESTONES.length, 5);

  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  let lastRes = null;
  for (let i = 1; i <= 10; i++) {
    lastRes = registerDiscoveredSpecies('Espécie Teste ' + i);
  }
  assert.equal(lastRes.list.length, 10);
  assert.ok(lastRes.rewardMilestone);
  assert.equal(lastRes.rewardMilestone.count, 10);
  assert.equal(lastRes.rewardMilestone.coins, 50);
});

test('sports-scoreboard, rain-puddles (create + step) e Cesta Orgânica da Horta funcionam sem overhead', async () => {
  const { recordSportScore } = await import('../js/world/sports-scoreboard.js');
  const { createRainPuddles, stepRainPuddles } = await import('../js/engine/rain-puddles.js');
  const { isHoldingPackOrCrateForStand } = await import('../js/items/dehydration-packaging.js');

  const s1 = recordSportScore('basketball');
  assert.equal(s1.coins, 15);
  assert.equal(s1.streak, 1);
  const s2 = recordSportScore('basketball');
  assert.equal(s2.coins, 25);
  assert.equal(s2.streak, 2);

  const sceneMock = { add() {} };
  const createdPuddle = createRainPuddles(sceneMock);
  assert.ok(createdPuddle && createdPuddle.inst);
  assert.equal(createdPuddle.inst.visible, false);

  stepRainPuddles(createdPuddle, 'clear', 1.0);
  assert.equal(createdPuddle.inst.visible, false);
  stepRainPuddles(createdPuddle, 'rain', 1.0);
  assert.equal(createdPuddle.inst.visible, true);
  assert.ok(createdPuddle.mat.opacity > 0);

  const { getReplicatedItemState } = await import('../js/systems/world-objects-sync.js');
  const mutantPetri = {
    mesh: {
      userData: {
        petriCtrl: {
          mode: 'clean',
          lidOpen: false,
          sterilized: true,
          inoculated: true,
          hybridMutant: 'gold',
          speciesName: 'Psilocybe cubensis • 🌟 Linhagem Dourada F1',
          colonization: 100
        }
      }
    }
  };
  const rep = getReplicatedItemState({}, mutantPetri);
  assert.equal(rep.petri.hybridMutant, 'gold');

  const { stepSkyGradientDome } = await import('../js/engine/sky-gradient.js');
  const { stepBlobShadows } = await import('../js/engine/blob-shadows.js');
  const { triggerCozyHeartBurst, stepCozyDetails } = await import('../js/world/cozy-details.js');
  const { isPhotoModeActive, setPhotoMode } = await import('../js/ui/photo-mode.js');

  const skyCtrl = {
    mesh: { position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } } },
    mat: {
      uniforms: {
        uTopColor: { value: new MockColor() },
        uHorizonColor: { value: new MockColor() },
        uSunDir: { value: { set() { return this; }, normalize() { return this; } } },
        uSunWarmth: { value: 0 }
      }
    }
  };
  stepSkyGradientDome(skyCtrl, { x: 1, y: 2, z: 3 }, 0.5, 0.03, 'clear');
  assert.ok(skyCtrl.mat.uniforms.uSunWarmth.value > 0.2);

  const blobCtrl = { inst: { visible: true, count: 0, instanceMatrix: { needsUpdate: false }, setMatrixAt() {} } };
  stepBlobShadows(blobCtrl, {}, true);
  assert.equal(blobCtrl.inst.visible, false);

  triggerCozyHeartBurst(2, 1, 2, 0xf472b6);
  assert.equal(typeof stepCozyDetails, 'function');
  assert.equal(isPhotoModeActive(), false);
  setPhotoMode(false);

  assert.equal(isHoldingPackOrCrateForStand({ organicBasketCtrl: { packsValue: 2 } }), true);
});
