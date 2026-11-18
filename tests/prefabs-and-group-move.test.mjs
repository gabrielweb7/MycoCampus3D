import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  THREE: {
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
    Box3: class {},
    Quaternion: class {}
  }
};

const { registerItemPrefab, getItemPrefab, listItemPrefabs, spawnItemFromPrefab } = await import('../js/items/item-prefabs.js');
const { getItemsSupportedBy, moveItemWithSupported } = await import('../js/systems/surface-group-move.js');

function makeMesh(x, y, z, ry = 0, userData = {}) {
  return {
    position: {
      x, y, z,
      set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; }
    },
    rotation: { y: ry },
    userData
  };
}

test('registerItemPrefab e spawnItemFromPrefab criam itens com prefabId', () => {
  registerItemPrefab('glass_schott_500', {
    label: 'Frasco Schott 500ml',
    category: 'glassware',
    factory: (_ctx, opts) => ({
      id: opts.id || 'schott_test_1',
      label: 'Frasco Schott 500ml',
      meta: { category: 'glassware' },
      mesh: makeMesh(opts.x, opts.y, opts.z, opts.ry, {})
    })
  });

  assert.ok(getItemPrefab('glass_schott_500'));
  assert.ok(listItemPrefabs('glassware').some((p) => p.prefabId === 'glass_schott_500'));

  const spawned = spawnItemFromPrefab({}, 'glass_schott_500', { x: 2, y: 1, z: -3, ry: 0.5 });
  assert.equal(spawned.meta.prefabId, 'glass_schott_500');
  assert.equal(spawned.mesh.userData.prefabId, 'glass_schott_500');
  assert.equal(spawned.mesh.position.x, 2);
});

test('moveItemWithSupported move mesa + bandeja + petri em cima, rotacionando e marcando tudo para sync', () => {
  const tableSurf = { minX: -1, maxX: 1, minZ: -1, maxZ: 1, topY: 1.0 };
  const traySurf = { minX: 0.2, maxX: 0.8, minZ: -0.3, maxZ: 0.3, topY: 1.05 };

  const table = {
    id: 'table_1',
    mesh: makeMesh(0, 0, 0, 0, {
      dynamicSurface: tableSurf,
      tableDims: { w: 2, d: 2, h: 1 }
    })
  };
  const tray = {
    id: 'tray_1',
    mesh: makeMesh(0.5, 1.0, 0, 0, {
      dynamicSurface: traySurf,
      tableDims: { w: 0.6, d: 0.6, h: 0.05 }
    })
  };
  const petri = {
    id: 'petri_1',
    mesh: makeMesh(0.5, 1.05, 0, 0, {})
  };
  const floorItem = {
    id: 'floor_bucket',
    mesh: makeMesh(5, 0, 5, 0, {})
  };

  const movedIds = [];
  const ctx = {
    pickableItems: [table, tray, petri, floorItem],
    markItemMoved: (it) => movedIds.push(it.id)
  };

  const supported = getItemsSupportedBy(ctx, table);
  assert.deepEqual(supported.map((i) => i.id), ['tray_1', 'petri_1']);

  // Move mesa para (10, 0, 4) com rotação de 90 graus (PI/2)
  const res = moveItemWithSupported(ctx, table, { x: 10, y: 0, z: 4 }, Math.PI / 2);
  assert.equal(res.movedCount, 3);
  assert.deepEqual(movedIds, ['table_1', 'tray_1', 'petri_1']);

  // Com rotação +90° em Y: (0.5, 0) relativo vira (0, -0.5) => (10, 3.5)
  assert.ok(Math.abs(tray.mesh.position.x - 10) < 1e-6);
  assert.ok(Math.abs(tray.mesh.position.z - 3.5) < 1e-6);
  assert.ok(Math.abs(petri.mesh.position.x - 10) < 1e-6);
  assert.ok(Math.abs(petri.mesh.position.z - 3.5) < 1e-6);
  assert.equal(floorItem.mesh.position.x, 5);
});
