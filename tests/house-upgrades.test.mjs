import test from 'node:test';
import assert from 'node:assert/strict';

// Mock THREE for headless testing
globalThis.window = globalThis.window || {};
if (!globalThis.THREE) {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    clone() { return new Vector3(this.x, this.y, this.z); }
  }
  class Euler {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  }
  class Object3D {
    constructor() {
      this.position = new Vector3();
      this.rotation = new Euler();
      this.visible = true;
      this.children = [];
      this.userData = {};
      this.parent = null;
    }
    add(...objs) {
      for (const o of objs) {
        o.parent = this;
        this.children.push(o);
      }
      return this;
    }
  }
  class Mesh extends Object3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }
  class Group extends Object3D {}
  class BoxGeometry {}
  class PlaneGeometry {}
  class MeshBasicMaterial {
    constructor(opts = {}) { Object.assign(this, opts); }
  }
  class MeshStandardMaterial {
    constructor(opts = {}) { Object.assign(this, opts); }
  }

  globalThis.THREE = {
    Vector3,
    Euler,
    Object3D,
    Mesh,
    Group,
    BoxGeometry,
    PlaneGeometry,
    MeshBasicMaterial,
    MeshStandardMaterial,
    SRGBColorSpace: 'srgb'
  };
  globalThis.window.THREE = globalThis.THREE;
}

const { HOUSE_UPGRADES, attachHouseUpgradesToLot, findHoveredHouseAction } = await import('../js/world/house-upgrades.js');

test('house upgrades catalog contains 6 valid upgrades with required properties', () => {
  assert.equal(HOUSE_UPGRADES.length, 6);
  const ids = HOUSE_UPGRADES.map(u => u.id);
  assert.deepEqual(ids, ['house_lights', 'garden_lights', 'blinds', 'front_door', 'back_door', 'second_floor']);
  for (const u of HOUSE_UPGRADES) {
    assert.ok(u.id && u.name && u.desc && typeof u.price === 'number');
  }
});

test('attachHouseUpgradesToLot registers interactive elements, stairs, and colliders', () => {
  const root = new globalThis.THREE.Group();
  const wallSegments = [];
  const walkableFloors = [];
  const stairsList = [];
  const supportSurfaces = [];
  const supportMeshes = [];
  const houseInteractMeshes = [];

  const ctx = {
    scene: root,
    wallSegments,
    walkableFloors,
    stairsList,
    supportSurfaces,
    supportMeshes,
    houseInteractMeshes,
    playerPos: new globalThis.THREE.Vector3(0, 0.1, 54),
    inFps: false
  };

  const lot = { id: 1, x: 0, z: 54, front: 1, houseZ: 50, doorZ: 53.4 };
  const mats = {
    wood: new globalThis.THREE.MeshBasicMaterial(),
    trim: new globalThis.THREE.MeshBasicMaterial(),
    wall: new globalThis.THREE.MeshBasicMaterial(),
    floor: new globalThis.THREE.MeshBasicMaterial(),
    accent: new globalThis.THREE.MeshBasicMaterial()
  };
  const dims = {
    width: 8.4,
    depth: 6.8,
    doorway: 1.90,
    floorY: 0.10,
    eavesY: 3.52,
    addSolidWall(parent, walls, x1, z1, x2, z2, minY, h, thick, mat) {
      const col = { x1, z1, x2, z2, minY, maxY: minY + h, halfThick: thick / 2 };
      walls.push(col);
      return new globalThis.THREE.Mesh();
    },
    addWalkableSlab(parent, floors, cx, topY, cz, w, thick, d, mat) {
      floors.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, topY });
      const m = new globalThis.THREE.Mesh();
      m.position.set(cx, topY, cz);
      parent.add(m);
      return m;
    },
    box(parent, mat, x, y, z, w, h, d) {
      const m = new globalThis.THREE.Mesh();
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }
  };

  attachHouseUpgradesToLot(ctx, root, lot, mats, dims);

  // Checks registered interaction meshes: blinds, panel, doors
  assert.ok(ctx.houseInteractMeshes.length >= 6);

  // Check stairsList registration
  assert.equal(ctx.stairsList.length, 1);
  const st = ctx.stairsList[0];
  assert.equal(st._disabled, true);
  assert.equal(st.yStart, 0.10);
  assert.equal(st.yEnd, 2.40);

  // Find panel hit mesh
  const panelHit = ctx.houseInteractMeshes.find(m => m.userData?.houseAction?.label().includes('Painel'));
  assert.ok(panelHit, 'panelHit must exist');
  assert.equal(panelHit.userData.houseAction.label(), '🏡 Abrir Painel da Casa');

  // Find front door hit mesh
  const doorHit = ctx.houseInteractMeshes.find(m => m.userData?.houseAction?.label().includes('Porta da Frente'));
  assert.ok(doorHit, 'front door action must exist');
  assert.equal(doorHit.userData.houseAction.label(), '🚪 Abrir Porta da Frente');
  doorHit.userData.houseAction.run();
  assert.equal(doorHit.userData.houseAction.label(), '🚪 Fechar Porta da Frente');
  doorHit.userData.houseAction.run();
  assert.equal(doorHit.userData.houseAction.label(), '🚪 Abrir Porta da Frente');

  // Find blind hit mesh
  const blindHit = ctx.houseInteractMeshes.find(m => m.userData?.houseAction?.label().includes('Persiana'));
  assert.ok(blindHit, 'blind action must exist');
  assert.equal(blindHit.userData.houseAction.label(), '🪟 Fechar Persiana');
  blindHit.userData.houseAction.run();
  assert.equal(blindHit.userData.houseAction.label(), '🪟 Abrir Persiana');
});

test('findHoveredHouseAction returns action when within player range and visible', () => {
  const action = { label: () => 'Test Action', run() {} };
  const parent = new globalThis.THREE.Group();
  const mesh = new globalThis.THREE.Mesh();
  mesh.userData.houseAction = action;
  parent.add(mesh);

  const ctx = {
    houseInteractMeshes: [mesh],
    scene: parent,
    playerPos: new globalThis.THREE.Vector3(0, 0, 0),
    raycaster: {
      intersectObjects: () => [
        {
          object: mesh,
          distance: 5.5,
          point: new globalThis.THREE.Vector3(1, 0, 1) // distance from player = ~1.41m (< 4.2m)
        }
      ]
    }
  };

  const found = findHoveredHouseAction(ctx);
  assert.equal(found, action);

  // If parent is hidden, should not interact
  parent.visible = false;
  assert.equal(findHoveredHouseAction(ctx), null);
  parent.visible = true;

  // If player is too far away (> 4.2m), should not interact
  ctx.playerPos.set(20, 0, 20);
  assert.equal(findHoveredHouseAction(ctx), null);
});
