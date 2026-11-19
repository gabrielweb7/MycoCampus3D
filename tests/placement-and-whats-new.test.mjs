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
    this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  }
  add(child) { this.children.push(child); }
  remove(child) { this.children = this.children.filter((c) => c !== child); }
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse(fn);
  }
  clone() {
    const c = new MockObj(this.isMesh, this.material);
    c.visible = this.visible;
    c.matrixAutoUpdate = this.matrixAutoUpdate;
    c.userData = { ...this.userData };
    c.children = this.children.map((ch) => ch.clone());
    return c;
  }
}

globalThis.window = {
  THREE: {
    Color: MockColor,
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { Object.assign(this, v); return this; } },
    Group: class extends MockObj { constructor() { super(false, null); } },
    Mesh: class extends MockObj { constructor(_geo, mat) { super(true, mat); } },
    RingGeometry: class {},
    CircleGeometry: class {},
    MeshBasicMaterial: MockMat,
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

test('updatePlacementGhostVisual reativa matrixAutoUpdate após freeze e oculta hitboxes invisíveis', () => {
  const scene = { add() {} };
  const ghost = createPlacementGhost(scene);
  // Simula bug antigo onde freezeStaticWorld congelava ring/dot
  ghost.children[0].matrixAutoUpdate = false;
  ghost.children[1].matrixAutoUpdate = false;

  const burnerRoot = new MockObj(false);
  const body = new MockObj(true, new MockMat({ color: 0x0f172a }));
  const coilHit = new MockObj(true, new MockMat({ transparent: true, opacity: 0, colorWrite: false }));
  burnerRoot.add(body);
  burnerRoot.add(coilHit);

  updatePlacementGhostVisual({ id: 'burner_lab', mesh: burnerRoot }, true, 0.5, 1.0);

  assert.equal(ghost.children[0].matrixAutoUpdate, true);
  assert.equal(ghost.children[1].matrixAutoUpdate, true);
  const clonedRoot = ghost.children[2].children[0];
  assert.equal(clonedRoot.children[0].visible, true);
  assert.equal(clonedRoot.children[1].visible, false);
});

test('RELEASE_NOTES_CATALOG tem notas simples da v1.4.8 e markPendingAutoUpdateNotice atualiza storage', () => {
  const store = new Map([['myco_seen_whats_new_v', '1.4.7']]);
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  markPendingAutoUpdateNotice('1.4.8');
  assert.equal(store.get('myco_seen_whats_new_v'), undefined);
  assert.equal(store.get('myco_just_updated_v'), '1.4.8');
  assert.ok(RELEASE_NOTES_CATALOG['1.4.8']);
  assert.ok(RELEASE_NOTES_CATALOG['1.4.8'].items.length >= 4);
});
