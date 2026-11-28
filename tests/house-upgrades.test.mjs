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

const {
  HOUSE_UPGRADES,
  attachHouseUpgradesToLot,
  applyVillageUpgrades,
  canPlayerAccessLot,
  findHoveredHouseAction
} = await import('../js/world/house-upgrades.js');
const { appState } = await import('../js/core/state.js');
const { firstUnoccludedRayHit } = await import('../js/systems/ray-occlusion.js');
const { applyCampusWorldState } = await import('../js/systems/world-devices-sync.js');

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
    eavesY: 4.70,
    gableH: 1.62,
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
  assert.equal(st.yEnd, 2.68);

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

function makeLotHarness(lot) {
  const root = new globalThis.THREE.Group();
  const wallSegments = [];
  const walkableFloors = [];
  const stairsList = [];
  const supportSurfaces = [];
  const supportMeshes = [];
  const houseInteractMeshes = [];
  const houseDynamicObjects = [];
  const campusDoors = [];
  let backDoorSealWall = null;

  const ctx = {
    scene: root,
    wallSegments,
    walkableFloors,
    stairsList,
    supportSurfaces,
    supportMeshes,
    houseInteractMeshes,
    houseDynamicObjects,
    campusDoors,
    playerPos: new globalThis.THREE.Vector3(lot.x, 0.1, lot.z),
    inFps: false
  };
  const mats = {
    wood: new globalThis.THREE.MeshBasicMaterial(),
    trim: new globalThis.THREE.MeshBasicMaterial(),
    wall: new globalThis.THREE.MeshBasicMaterial(),
    floor: new globalThis.THREE.MeshBasicMaterial(),
    accent: new globalThis.THREE.MeshBasicMaterial()
  };
  const boxes = [];
  const dims = {
    width: 8.4,
    depth: 6.8,
    doorway: 1.90,
    floorY: 0.10,
    eavesY: 4.70,
    gableH: 1.62,
    addSolidWall(parent, walls, x1, z1, x2, z2, minY, h, thick) {
      const col = { x1, z1, x2, z2, minY, maxY: minY + h, halfThick: thick / 2 };
      walls.push(col);
      backDoorSealWall = new globalThis.THREE.Mesh();
      parent.add(backDoorSealWall);
      return backDoorSealWall;
    },
    addWalkableSlab(parent, floors, cx, topY, cz, w, thick, d) {
      floors.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, topY });
      const m = new globalThis.THREE.Mesh();
      m.position.set(cx, topY, cz);
      parent.add(m);
      return m;
    },
    box(parent, mat, x, y, z, w, h, d) {
      const m = new globalThis.THREE.Mesh();
      m.position.set(x, y, z);
      boxes.push({ mesh: m, x, y, z, w, h, d, parent });
      parent.add(m);
      return m;
    }
  };
  attachHouseUpgradesToLot(ctx, root, lot, mats, dims);
  return { ctx, root, wallSegments, walkableFloors, stairsList, supportSurfaces, houseInteractMeshes, houseDynamicObjects, campusDoors, backDoorSealWall, boxes };
}

test('attachHouseUpgradesToLot protects dynamic objects and applyVillageUpgrades toggles all 6 upgrades', () => {
  const lot = { id: 2, x: -26, z: 54, front: 1, houseZ: 50, doorZ: 53.4 };
  const h = makeLotHarness(lot);

  assert.equal(h.houseDynamicObjects.length, 12);
  for (const obj of h.houseDynamicObjects) {
    assert.equal(obj.userData.keepDynamic, true);
  }
  assert.ok(h.houseDynamicObjects.includes(h.backDoorSealWall));

  const frontDoorObj = h.campusDoors.find(d => d.id === 'lot_2_front_door');
  const backDoorObj = h.campusDoors.find(d => d.id === 'lot_2_back_door');
  assert.equal(frontDoorObj.installed, false);
  assert.equal(frontDoorObj.uninstalledMaxY, -1);
  assert.equal(backDoorObj.installed, false);
  assert.equal(backDoorObj.uninstalledMaxY, 4.70);

  // House light must sit flush on the roof ridge (>= eavesY + 1.4)
  const houseLightGrp = h.houseDynamicObjects.find(o => o.children?.some(c => c.position?.y >= 4.70 + 1.4));
  assert.ok(houseLightGrp, 'interior lamp must sit at the roof ridge above eavesY');

  const frontDoorCollider = h.wallSegments[0];
  const backDoorSealCollider = h.wallSegments[1];
  const backFenceSealCollider = h.wallSegments[2];
  const backFenceSealGrp = h.houseDynamicObjects[9];
  const backPathGrp = h.houseDynamicObjects[10];
  const loftSurf = h.supportSurfaces[0];
  assert.equal(loftSurf._disabled, true);
  assert.equal(h.backDoorSealWall.visible, true);
  assert.equal(backFenceSealGrp.visible, true);
  assert.equal(backPathGrp.visible, false);
  assert.equal(frontDoorCollider.maxY, -1);
  assert.equal(backDoorSealCollider.maxY, 4.70);
  assert.equal(backFenceSealCollider.maxY, 0.98);

  // Enable all 6 upgrades
  applyVillageUpgrades([{
    id: 2,
    upgrades: {
      house_lights: true,
      garden_lights: true,
      blinds: true,
      front_door: true,
      back_door: true,
      second_floor: true
    }
  }]);

  assert.equal(frontDoorObj.installed, true);
  assert.equal(backDoorObj.installed, true);
  assert.equal(h.backDoorSealWall.visible, false);
  assert.equal(backFenceSealGrp.visible, false);
  assert.equal(backPathGrp.visible, true);
  assert.equal(frontDoorCollider.maxY, 4.70);
  assert.equal(backDoorSealCollider.maxY, 4.70);
  assert.equal(backFenceSealCollider.maxY, -1);
  assert.equal(loftSurf._disabled, false);
  assert.equal(h.stairsList[0]._disabled, false);
  for (const wf of h.walkableFloors) {
    assert.equal(wf._disabled, false);
  }
  for (const obj of h.houseDynamicObjects) {
    if (obj !== h.backDoorSealWall && obj !== backFenceSealGrp) {
      assert.equal(obj.visible, true);
    }
  }

  // Opening back door clears seal collider
  const backDoorHit = h.houseInteractMeshes.find(m => m.userData?.houseAction?.label().includes('Porta dos Fundos'));
  assert.ok(backDoorHit);
  backDoorHit.userData.houseAction.run();
  assert.equal(backDoorSealCollider.maxY, -1);

  // Disabling all upgrades restores disabled state
  applyVillageUpgrades([{ id: 2, upgrades: {} }]);
  assert.equal(frontDoorObj.installed, false);
  assert.equal(backDoorObj.installed, false);
  assert.equal(h.backDoorSealWall.visible, true);
  assert.equal(backFenceSealGrp.visible, true);
  assert.equal(backPathGrp.visible, false);
  assert.equal(frontDoorCollider.maxY, -1);
  assert.equal(backDoorSealCollider.maxY, 4.70);
  assert.equal(backFenceSealCollider.maxY, 0.98);
  assert.equal(loftSurf._disabled, true);
  assert.equal(h.stairsList[0]._disabled, true);
  for (const wf of h.walkableFloors) {
    assert.equal(wf._disabled, true);
  }
});

test('south row lots (front = -1) keep stair clearance from pillars and swing back door outward', () => {
  const lot = { id: 9, x: 26, z: 84, front: -1, houseZ: 88, doorZ: 84.6 };
  const h = makeLotHarness(lot);
  const st = h.stairsList[0];

  // Pillars of the loft should not intersect stairX range
  const pillars = h.boxes.filter(b => (b.w === 0.14 || b.w === 0.16) && (b.d === 0.14 || b.d === 0.16) && b.h > 2.0);
  assert.ok(pillars.length >= 2);
  for (const p of pillars) {
    assert.ok(p.x < st.minX || p.x > st.maxX, `pillar at x=${p.x} must not block stairs [${st.minX}, ${st.maxX}]`);
  }

  // Back door should swing outward (+Z -> negative Y rotation for front = -1)
  applyVillageUpgrades([{ id: 9, upgrades: { back_door: true } }]);
  const backDoorHit = h.houseInteractMeshes.find(m => m.userData?.houseAction?.label().includes('Porta dos Fundos'));
  backDoorHit.userData.houseAction.run();
  const backDoorPivot = h.houseDynamicObjects.find(o => o.children?.includes(backDoorHit));
  assert.ok(backDoorPivot);
  assert.ok(backDoorPivot.rotation.y < 0, 'back door should rotate negatively to swing outward (+Z) when front = -1');
});

test('canPlayerAccessLot validates owner, editor, admin, and non-owners', () => {
  const prevUser = appState.currentUser;
  const prevLease = appState.villageLease;
  const prevEdit = appState.villageEditLot;
  try {
    appState.currentUser = { id: 10, role: 'student' };
    appState.villageLease = { id: 3 };
    appState.villageEditLot = 7;

    assert.equal(canPlayerAccessLot(null), true);
    assert.equal(canPlayerAccessLot(3), true);
    assert.equal(canPlayerAccessLot(7), true);
    assert.equal(canPlayerAccessLot(5), false);

    appState.currentUser = { id: 1, role: 'admin' };
    assert.equal(canPlayerAccessLot(5), true);
  } finally {
    appState.currentUser = prevUser;
    appState.villageLease = prevLease;
    appState.villageEditLot = prevEdit;
  }
});

test('firstUnoccludedRayHit skips objects hidden by an invisible parent group', () => {
  const scene = new globalThis.THREE.Group();
  const hiddenGroup = new globalThis.THREE.Group();
  hiddenGroup.visible = false;
  const hiddenMesh = new globalThis.THREE.Mesh();
  hiddenGroup.add(hiddenMesh);
  const visibleGroup = new globalThis.THREE.Group();
  const visibleMesh = new globalThis.THREE.Mesh();
  visibleGroup.add(visibleMesh);
  scene.add(hiddenGroup, visibleGroup);

  const ctx = { scene, raycaster: { ray: { origin: new globalThis.THREE.Vector3(), direction: new globalThis.THREE.Vector3(0, 0, 1) } } };
  const hit = firstUnoccludedRayHit(ctx, [
    { object: hiddenMesh, distance: 1.5 },
    { object: visibleMesh, distance: 2.0 }
  ], 4.2);
  assert.equal(hit?.object, visibleMesh);
});

test('applyCampusWorldState restores lot doors, blinds, and light power on initial sync and queues toggles', () => {
  const lot = { id: 2, x: -26, z: 54, front: 1, houseZ: 50, doorZ: 53.4 };
  const h = makeLotHarness(lot);
  const queued = [];
  h.ctx.windowBlinds = [];
  const root2 = new globalThis.THREE.Group();
  const ctx2 = {
    scene: root2,
    wallSegments: [],
    walkableFloors: [],
    stairsList: [],
    supportSurfaces: [],
    supportMeshes: [],
    houseInteractMeshes: [],
    houseDynamicObjects: [],
    campusDoors: [],
    windowBlinds: [],
    pendingStateChanges: {},
    recentlyChangedState: {},
    pickableItems: [],
    campusLightSwitches: [],
    stirrerDevices: [],
    burnerDevices: [],
    cookerPots: [],
    wildMushrooms: [],
    labCabinets: [],
    sportBalls: [],
    queueWorldStateChange: (k, v) => queued.push([k, v])
  };
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
    eavesY: 4.70,
    gableH: 1.62,
    addSolidWall(parent, walls, x1, z1, x2, z2, minY, hgt, thick) {
      walls.push({ x1, z1, x2, z2, minY, maxY: minY + hgt, halfThick: thick / 2 });
      const m = new globalThis.THREE.Mesh();
      parent.add(m);
      return m;
    },
    addWalkableSlab(parent, floors, cx, topY, cz, w, thick, d) {
      floors.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, topY });
      const m = new globalThis.THREE.Mesh();
      parent.add(m);
      return m;
    },
    box(parent, mat, x, y, z) {
      const m = new globalThis.THREE.Mesh();
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    }
  };
  attachHouseUpgradesToLot(ctx2, root2, { id: 8, x: 0, z: 84, front: -1, houseZ: 88, doorZ: 84.6 }, mats, dims);
  applyVillageUpgrades([{
    id: 8,
    upgrades: { house_lights: true, garden_lights: true, front_door: true, back_door: true }
  }]);

  applyCampusWorldState(ctx2, {
    lot_8_front_door: '1',
    lot_8_back_door: '1',
    lot_8_blind_back: '0',
    lot_8_house_lights_on: '0',
    lot_8_garden_lights_on: '0'
  }, true);

  const fDoor = ctx2.campusDoors.find(d => d.id === 'lot_8_front_door');
  const bDoor = ctx2.campusDoors.find(d => d.id === 'lot_8_back_door');
  const backBlind = ctx2.windowBlinds.find(b => b.id === 'lot_8_blind_back');
  assert.equal(fDoor.open, true);
  assert.equal(fDoor.doorCollider.maxY, -1);
  assert.notEqual(fDoor.leftPivot.rotation.y, 0);
  assert.equal(bDoor.open, true);
  assert.equal(bDoor.doorCollider.maxY, -1);
  assert.equal(backBlind.open, false);

  const houseLightGrp = ctx2.houseDynamicObjects[4];
  const gardenLightGrp = ctx2.houseDynamicObjects[5];
  assert.equal(houseLightGrp.visible, false);
  assert.equal(gardenLightGrp.visible, false);

  // Clicking door and blind queues world state changes
  const frontDoorHit = ctx2.houseInteractMeshes.find(m => m.userData?.houseAction?.label().includes('Porta da Frente'));
  const blindHit = ctx2.houseInteractMeshes.find(m => m.userData?.houseAction?.label().includes('Persiana'));
  frontDoorHit.userData.houseAction.run();
  blindHit.userData.houseAction.run();
  assert.deepEqual(queued, [
    ['lot_8_front_door', 0],
    ['lot_8_blind_back', 1]
  ]);
});

test('second_floor upgrade registers 4 under-stair storage shelves and toggles them safely', () => {
  const lot = { id: 3, x: 0, z: 54, front: 1, houseZ: 50, doorZ: 53.4 };
  const h = makeLotHarness(lot);

  // loftSurf + 4 under-stair shelf surfaces
  assert.equal(h.supportSurfaces.length, 5);
  assert.equal(h.ctx.supportMeshes.length, 5);
  const shelfSurfs = h.supportSurfaces.slice(1);
  assert.deepEqual(shelfSurfs.map(s => s.topY), [0.16, 0.60, 1.04, 1.48]);
  for (const sf of shelfSurfs) {
    assert.equal(sf._disabled, true);
  }
  const cabCollider = h.wallSegments[h.wallSegments.length - 1];
  assert.equal(cabCollider.maxY, -1);

  applyVillageUpgrades([{ id: 3, upgrades: { second_floor: true } }]);
  for (const sf of shelfSurfs) {
    assert.equal(sf._disabled, false);
  }
  assert.equal(cabCollider.maxY, 2.68);

  applyVillageUpgrades([{ id: 3, upgrades: { second_floor: false } }]);
  for (const sf of shelfSurfs) {
    assert.equal(sf._disabled, true);
  }
  assert.equal(cabCollider.maxY, -1);
});
