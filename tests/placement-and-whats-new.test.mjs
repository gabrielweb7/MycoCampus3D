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

  // Valida que as estrelas de fundo são menores e espalhadas aleatoriamente sem alinhamento em arco circular
  const { createCelestialSkyDome } = await import('../js/engine/sky-constellations.js');
  const prevT = globalThis.window.THREE;
  class Attr { constructor(arr) { this.array = arr; } }
  const origThree = globalThis.window.THREE;
  origThree.Float32BufferAttribute = Attr;
  origThree.BufferAttribute = Attr;
  origThree.BufferGeometry = class { constructor() { this.attrs = {}; } setAttribute(k, v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k]; } };
  origThree.PointsMaterial = class { constructor(o) { Object.assign(this, o); } };
  origThree.Points = class { constructor(geo, mat) { this.geometry = geo; this.material = mat; } };
  origThree.LineBasicMaterial = class { constructor(o) { Object.assign(this, o); } };
  origThree.LineSegments = class { constructor(geo, mat) { this.geometry = geo; this.material = mat; } };
  origThree.Line = class { constructor(geo, mat) { this.geometry = geo; this.material = mat; } };
  const domeBuilt = createCelestialSkyDome({ add() {} });
  assert.ok(domeBuilt.bgMat.size < domeBuilt.conStarMat.size, 'Estrelas de fundo devem ser menores que estrelas de constelação');
  const posArr = domeBuilt.bgStars.geometry.getAttribute('position').array;
  // Verifica que estrelas consecutivas não caem em passos angulares idênticos formando arco
  const angleDeltas = new Set();
  for (let i = 0; i < 60; i += 3) {
    const a1 = Math.atan2(posArr[i + 2], posArr[i]);
    const a2 = Math.atan2(posArr[i + 5], posArr[i + 3]);
    angleDeltas.add(Math.round((a2 - a1) * 100));
  }
  assert.ok(angleDeltas.size > 10, 'Estrelas de fundo devem ter distribuição orgânica sem arco repetitivo');
  globalThis.window.THREE = prevT;
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

  // Testa dropHeldItem sobre bancada com vizinhos próximos: deve permanecer na altura da mesa (topY=0.91), nunca cair no chão
  const { addMovableStainlessTable } = await import('../js/items/stainless-table.js');
  const { registerPickable } = await import('../js/items/item-registry.js');
  const { dropHeldItem } = await import('../js/systems/interaction-system.js');
  const { dropUnsupportedItems } = await import('../js/entities/placement-ghost.js');

  globalThis.window.THREE.Raycaster = class {
    constructor() {
      this.ray = {
        origin: { x: -20, y: 1.7, z: -9.2 },
        direction: { x: 0, y: -0.5, z: -0.86 },
        distanceSqToPoint: () => 99
      };
    }
    setFromCamera() {}
    intersectObjects() { return []; }
    intersectObject() { return []; }
  };
  globalThis.window.THREE.BoxGeometry = class {};
  globalThis.window.THREE.CylinderGeometry = class {};

  const pCtx = {
    scene: { add() {} },
    camera: {},
    raycaster: new globalThis.window.THREE.Raycaster(),
    playerPos: { x: -20, y: 0.12, z: -9.2 },
    playerYaw: 0,
    inFps: true,
    pointerNdc: { x: 0, y: 0 },
    clock: { elapsedTime: 1 },
    solidColliders: [],
    wallSegments: [],
    walkableFloors: [{ minX: -25, maxX: -15, minZ: -15, maxZ: -5, topY: 0.12 }],
    stairsList: [],
    supportSurfaces: [],
    supportMeshes: [],
    pickableItems: [],
    pickableMap: new Map(),
    cookerPots: [],
    pendingMovedItems: {},
    recentlyDropped: {},
    heldRotY: 0,
    heldItem: null,
    snapClosePot: null,
    snapPetriStack: false,
    placementMode: false,
    placementValid: false,
    placementGhost: new MockObj(),
    callbacks: {},
    isHeldByRemote: () => false,
    removeFromCookerContents() {},
    setSnapClosePot(v) { this.snapClosePot = v; },
    setSnapPetriStack(v) { this.snapPetriStack = v; },
    setHeldRotY(v) { this.heldRotY = v; },
    notifyWorldAction() {}
  };
  pCtx.physCtx = pCtx;
  pCtx.entityCtx = pCtx;

  addMovableStainlessTable(pCtx, 'tbl_test', 'Mesa Teste', -20, 0.12, -10.6, 2.0, 0.79, 1.0);
  registerPickable(pCtx, 'blocker_jar', 'Vidro Vizinho', new MockObj(), -20, 0.91, -10.56, 0, 0.14, 0.25);
  const droppedJar = registerPickable(pCtx, 'dropped_jar', 'Béquer', new MockObj(), -19, 0.12, -9, 0, 0.14, 0.25);
  pCtx.heldItem = droppedJar;
  dropHeldItem(pCtx);
  dropUnsupportedItems(pCtx);
  assert.ok(Math.abs(droppedJar.mesh.position.y - 0.12) < 0.02, 'Botão Largar [X] deve soltar no chão próximo do jogador (y=0.12), nunca na mira/bancada');

  // Regra estrita: itens comuns NÃO podem ficar empilhados um em cima do outro nem ocupar o mesmo espaço
  const { isPlacementBlocked } = await import('../js/entities/placement-ghost.js');
  const crateA = registerPickable(pCtx, 'crate_a', 'Caixa Base', new MockObj(), -20.45, 0.91, -10.56, 0, 0.24, 0.165);
  const crateB = registerPickable(pCtx, 'crate_b', 'Caixa Extra', new MockObj(), -19.5, 0.12, -9.5, 0, 0.24, 0.165);
  assert.ok(crateA && crateB);
  pCtx.heldItem = crateB;
  assert.equal(isPlacementBlocked(pCtx, { x: -20.45, y: 0.91, z: -10.56 }), true, 'Não pode colocar item no mesmo espaço de outro item');

  assert.equal(isHoldingPackOrCrateForStand({ organicBasketCtrl: { packsValue: 2 } }), true);
});

test('modal-window-manager persiste posição/tamanho por jogador, sorghum-grain.png existe e aquecimento do fogareiro não retrocede no sync', async () => {
  const fsMod = await import('node:fs');
  assert.equal(fsMod.existsSync('assets/textures/sorghum-grain.png'), true, 'Textura assets/textures/sorghum-grain.png deve existir');

  const pp5Src = fsMod.readFileSync('js/items/pp5-cup.js', 'utf8');
  assert.ok(pp5Src.includes('DoubleSide'), 'Potinho PP5 deve usar DoubleSide para mostrar a parede interna traseira');

  const {
    clampModalRectToViewport,
    setModalManagerUserKey,
    readModalLayoutMap
  } = await import('../js/ui/modal-window-manager.js');
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  setModalManagerUserKey({ id: 7, display_name: 'Gabriel' });
  const clamped = clampModalRectToViewport({ x: 9999, y: -50, w: 120, h: 90 }, 1280, 720);
  assert.ok(clamped.w >= 280);
  assert.ok(clamped.h >= 160);
  assert.ok(clamped.x <= 1280 - 56);
  assert.ok(clamped.y >= 8);
  assert.deepEqual(readModalLayoutMap(), {});

  const { applyReplicatedItemState } = await import('../js/systems/world-objects-sync.js');
  const cookerObj = { temp: 76, psi: 0, progress: 0, waterMl: 3300, contents: [], maxWaterMl: 20000 };
  const potObj = {
    id: 'pressure_cooker_sub',
    lidItem: { id: 'pressure_lid_sub' },
    mesh: { position: { x: 18, y: 0.65, z: 2 }, userData: {} }
  };
  const simHeat = {
    burnerDevices: [{
      id: 'gas_tripod_sub',
      on: true,
      surface: { minX: 17.7, maxX: 18.3, minZ: 1.7, maxZ: 2.3, topY: 0.65 }
    }],
    cookerPots: [{ potItem: potObj, ...cookerObj }],
    findPickable: () => null
  };
  // Simula ref compatível como referenciado pelo item
  simHeat.cookerPots[0] = Object.assign(cookerObj, { potItem: potObj });
  applyReplicatedItemState(simHeat, potObj, { cooker: { temp: 70, psi: 0, progress: 0, waterMl: 3300 } });
  assert.equal(cookerObj.temp, 76, 'Sync atrasado (70°C) não deve travar nem reduzir aquecimento ativo (76°C)');
});

test('whats-new modal usa zIndex explicito 9999, hover-raycaster prioriza Base Perfurada fora de bestLarge e avatars sincronizam conteúdo na mão', async () => {
  const fsMod = await import('node:fs');
  const raySrc = fsMod.readFileSync('js/systems/hover-raycaster.js', 'utf8');
  const bestLargeLine = raySrc.split('\n').find((l) => l.includes('item.mesh.userData.isTable'));
  assert.ok(bestLargeLine && !bestLargeLine.includes('isCookerBase'), 'isCookerBase deve ficar em bestSmall para poder retirar a base de dentro da panela');

  const wnSrc = fsMod.readFileSync('js/ui/whats-new-modal.js', 'utf8');
  assert.ok(wnSrc.includes("modal.style.zIndex = '9999'"), 'Modal de novidades deve forçar zIndex 9999 acima do lobby');

  const { updateCampusPlayers, stepMultiplayerAvatars } = await import('../js/entities/avatars.js');
  assert.equal(typeof stepMultiplayerAvatars, 'function');

  const cookerItem = {
    id: 'pressure_cooker_lab',
    lidItem: { id: 'pressure_lid_lab', isAttached: true },
    cookerRef: { contents: [{ id: 'cooker_base_lab' }, { id: 'spawn_jar_1' }] }
  };
  const remoteHeldIds = new Set();
  const remoteAvatars = {
    p2: {
      id: 'p2',
      name: 'Micólogo',
      group: { position: { set() {} }, rotation: { y: 0 }, visible: true },
      snapshots: [{ t: 1000, x: 0, y: 0, z: 2, yaw: 0, pitch: 0, vx: 0, vz: 0 }],
      lastSnapAt: 1000,
      avgIntervalMs: 140,
      interpDelay: 185,
      targetPos: { set() {} },
      hatGroup: {},
      hatMat: {},
      current_hat: 'default',
      role: 'student',
      roleBadge: { material: { map: {} } },
      labelSprite: { material: { map: { image: {} } } },
      chatSprite: null,
      lastChat: ''
    }
  };
  updateCampusPlayers(
    {
      scene: { add() {} },
      remoteAvatars,
      remoteHeldIds,
      findPickable: (id) => (id === 'pressure_cooker_lab' ? cookerItem : null),
      heldItem: null
    },
    [{ id: 'p2', name: 'Micólogo', x: 1, y: 0, z: 2, yaw: 0, pitch: 0, holding: 'pressure_cooker_lab', emote: 'fx_spray', current_hat: 'default', role: 'student' }]
  );
  assert.ok(remoteHeldIds.has('pressure_cooker_lab'));
  assert.ok(remoteHeldIds.has('pressure_lid_lab'));
  assert.ok(remoteHeldIds.has('cooker_base_lab'));
  assert.ok(remoteHeldIds.has('spawn_jar_1'));
  assert.equal(remoteAvatars.p2.emote, 'fx_spray');
});
