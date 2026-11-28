import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtrudeGeometry, Shape } from '../js/vendor/three.bundle.min.js';

class MockColor {
  constructor(hex = 0xffffff) { this.hex = hex; }
  clone() { return new MockColor(this.hex); }
  setHex(hex) { this.hex = hex; return this; }
  copy(c) { this.hex = c.hex; return this; }
  lerp() { return this; }
}

class MockMat {
  constructor(opts = {}) {
    this.isMaterial = true;
    this.color = new MockColor(opts.color ?? 0xffffff);
    this.transparent = !!opts.transparent;
    this.opacity = opts.opacity ?? 1;
    this.userData = {};
  }
  clone() { return new MockMat(); }
  dispose() {}
}

class MockObj {
  constructor(isMesh = false, mat = null) {
    this.isMesh = isMesh;
    this.material = mat;
    this.visible = true;
    this.matrixAutoUpdate = true;
    this.userData = {};
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(p) { Object.assign(this, p); } };
    this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(r) { Object.assign(this, r); } };
    this.quaternion = { x: 0, y: 0, z: 0, w: 1, copy(q) { Object.assign(this, q); } };
    this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(s) { Object.assign(this, s); } };
  }
  add(child) { this.children.push(child); }
  remove(child) { this.children = this.children.filter((c) => c !== child); }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}

globalThis.window = {
  THREE: {
    ExtrudeGeometry,
    Shape,
    Color: MockColor,
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { Object.assign(this, v); return this; } },
    Group: class extends MockObj { constructor() { super(false, null); } },
    Mesh: class extends MockObj { constructor(_geo, mat) { super(true, mat); } },
    Object3D: class extends MockObj { constructor() { super(false, null); this.matrix = []; } updateMatrix() {} },
    InstancedMesh: class extends MockObj { constructor(_geo, mat) { super(true, mat); } },
    RingGeometry: class {},
    CircleGeometry: class {},
    OctahedronGeometry: class {},
    BoxGeometry: class {},
    CylinderGeometry: class {},
    MeshBasicMaterial: MockMat,
    MeshStandardMaterial: MockMat,
    DoubleSide: 2
  }
};
globalThis.THREE = globalThis.window.THREE;

const { dropUnsupportedItems } = await import('../js/entities/placement-ghost.js');
const { addMovableStainlessTable } = await import('../js/items/stainless-table.js');
const { registerPickable } = await import('../js/items/item-registry.js');

function makeCtx() {
  const ctx = {
    scene: { add() {} },
    camera: {},
    playerPos: { x: 0, y: 0.12, z: 0 },
    solidColliders: [],
    wallSegments: [],
    walkableFloors: [{ minX: -50, maxX: 50, minZ: -50, maxZ: 50, topY: 0.12 }],
    stairsList: [],
    supportSurfaces: [],
    supportMeshes: [],
    pickableItems: [],
    pickableMap: new Map(),
    cookerPots: [],
    pendingMovedItems: {},
    recentlyDropped: {},
    heldItem: null,
    isHeldByRemote: () => false,
    removeFromCookerContents() {},
    notifyWorldAction() {}
  };
  ctx.physCtx = ctx;
  ctx.entityCtx = ctx;
  return ctx;
}

function runGravity(ctx, steps) {
  for (let i = 0; i < steps; i++) {
    ctx._stackPhysicsDirty = true;
    dropUnsupportedItems(ctx);
  }
}

test('itens colocados sobre uma bancada permanecem na altura da mesa', () => {
  const ctx = makeCtx();
  addMovableStainlessTable(ctx, 'tbl_a', 'Mesa', 0, 0.12, 0, 2.0, 0.79, 1.0);
  const jar = registerPickable(ctx, 'jar_a', 'Vidro', new MockObj(), 0.3, 0.91, 0.1, 0, 0.14, 0.25);
  runGravity(ctx, 40);
  assert.ok(Math.abs(jar.mesh.position.y - 0.91) < 0.02, `item caiu da mesa (y=${jar.mesh.position.y})`);
});

test('panela com base do fogareiro no conteúdo não sobe sozinha', () => {
  const ctx = makeCtx();
  addMovableStainlessTable(ctx, 'tbl_b', 'Mesa', 0, 0.12, 0, 2.0, 0.79, 1.0);
  const pot = registerPickable(ctx, 'pot_a', 'Panela', new MockObj(), 0, 0.91, 0, 0, 0.22, 0.4);
  const base = registerPickable(ctx, 'base_a', 'Base 4cm', new MockObj(), 0, 0.946, 0, 0, 0.2, 0.04);
  base.mesh.userData.isCookerBase = true;
  ctx.cookerPots.push({ potItem: pot, contents: [base] });
  runGravity(ctx, 80);
  assert.ok(Math.abs(pot.mesh.position.y - 0.91) < 0.02, `panela subiu (y=${pot.mesh.position.y})`);
});


test('item empilhado sobre caixa continua apoiado na caixa e n�o cai na mesa', () => {
  const ctx = makeCtx();
  addMovableStainlessTable(ctx, 'tbl_c', 'Mesa', 0, 0.12, 0, 2.0, 0.79, 1.0);
  const crate = registerPickable(ctx, 'crate_c', 'Caixa', new MockObj(), 0, 0.91, 0, 0, 0.24, 0.165);
  crate.deliveryCrateCtrl = {};
  const jar = registerPickable(ctx, 'jar_c', 'Vidro', new MockObj(), 0.02, 0.91 + 0.165, 0.02, 0, 0.14, 0.25);
  runGravity(ctx, 40);
  assert.ok(Math.abs(crate.mesh.position.y - 0.91) < 0.02, 'caixa deve ficar na mesa');
  assert.ok(Math.abs(jar.mesh.position.y - (0.91 + 0.165)) < 0.02, `vidro deve ficar sobre a caixa (y=${jar.mesh.position.y})`);
});

test('bancada movida e girada conserva o item abaixo do piso superior', () => {
  const ctx = makeCtx();
  const table = addMovableStainlessTable(ctx, 'tbl_loft', 'Mesa', 0, 0.12, 0, 2.0, 0.79, 1.0);
  table.mesh.position.set(4, 0.12, 5);
  table.mesh.rotation.y = Math.PI / 2;
  table.mesh.userData.updateBounds(table);
  ctx.walkableFloors.push({ minX: 3, maxX: 5, minZ: 4, maxZ: 6, topY: 1.9 });
  const jar = registerPickable(ctx, 'jar_loft', 'Vidro', new MockObj(), 4, 0.91, 5.7, 0, 0.14, 0.25);
  runGravity(ctx, 10);
  assert.ok(Math.abs(table.mesh.position.y - 0.12) < 0.001);
  assert.ok(Math.abs(jar.mesh.position.y - 0.91) < 0.001, 'vidro foi deslocado para o piso superior');
});

test('apoio desativado deixa o item cair no piso e sincroniza a posicao final', () => {
  const ctx = makeCtx();
  const jar = registerPickable(ctx, 'jar_removed', 'Vidro', new MockObj(), 0, 0.91, 0, 0, 0.14, 0.25);
  ctx.supportSurfaces.push({ minX: -1, maxX: 1, minZ: -1, maxZ: 1, topY: 0.91, _disabled: true });
  runGravity(ctx, 10);
  assert.equal(jar.mesh.position.y, 0.12);
  assert.equal(ctx.pendingMovedItems[jar.id].y, 0.12);
});
