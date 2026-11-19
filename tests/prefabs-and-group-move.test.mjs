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
const { getItemsSupportedBy, moveItemWithSupported, dropSupportedItemsToGround } = await import('../js/systems/surface-group-move.js');
const { updateItemBounds, isPointInBoundsXZ } = await import('../js/items/item-registry.js');
const { clampPosAgainstWalls, getSupportSurfaceAt } = await import('../js/engine/physics.js');

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

test('dropSupportedItemsToGround faz itens em cima e dentro da panela caírem ao deletar pai', () => {
  const tableSurf = { minX: -1, maxX: 1, minZ: -1, maxZ: 1, topY: 1.0 };
  const table = {
    id: 'table_del',
    mesh: makeMesh(0, 0, 0, 0, { dynamicSurface: tableSurf })
  };
  const beaker = {
    id: 'beaker_on_table',
    mesh: makeMesh(0.2, 1.0, 0.3, 0, {})
  };
  const moved = [];
  const ctx = {
    pickableItems: [table, beaker],
    markItemMoved: (it) => moved.push(it.id)
  };
  const dropped = dropSupportedItemsToGround(ctx, table, () => 0);
  assert.deepEqual(dropped.map((i) => i.id), ['beaker_on_table']);
  assert.equal(beaker.mesh.position.y, 0);
  assert.deepEqual(moved, ['beaker_on_table']);
});

test('updateItemBounds e clampPosAgainstWalls usam OBB preciso sem parede invisível ao redor de mesas rotacionadas', () => {
  const surf = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, topY: 0 };
  const col = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: 0, maxY: 0.9, surfaceTopY: 0.9 };
  const hoodLight = { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } };
  const tableItem = {
    id: 'table_hood_lab',
    mesh: {
      position: { x: -15.0, y: 0.12, z: -8.0 },
      rotation: { y: Math.PI / 4 }, // 45 graus
      scale: { x: 1, y: 1, z: 1 },
      userData: {
        tableDims: { w: 1.5, h: 0.9, d: 2.4 },
        dynamicSurface: surf,
        dynamicCollider: col,
        hoodLight,
        updateBounds: updateItemBounds
      }
    }
  };

  updateItemBounds(tableItem);
  assert.equal(hoodLight.position.x, -15.0);
  assert.equal(hoodLight.position.z, -8.0);

  // Ponto próximo à lateral da mesa rotacionada (localX = 1.15m > halfW 0.80m + raio 0.30m, localZ = 0):
  // No antigo AABB inflado (~1.43m de meia-largura), esse ponto ficava bloqueado por uma parede invisível!
  const cos45 = Math.cos(Math.PI / 4);
  const sin45 = Math.sin(Math.PI / 4);
  const freeWorldX = -15.0 + 1.18 * cos45;
  const freeWorldZ = -8.0 - 1.18 * sin45;
  assert.equal(isPointInBoundsXZ(freeWorldX, freeWorldZ, surf, 0.08), false);
  assert.equal(getSupportSurfaceAt({ supportSurfaces: [surf], heldItem: null }, freeWorldX, freeWorldZ, 0.08), null);

  const playerFreePos = { x: freeWorldX, y: 0.12, z: freeWorldZ };
  clampPosAgainstWalls({ wallSegments: [], campusDoors: [], solidColliders: [col], heldItem: null }, playerFreePos, 0.30);
  assert.ok(Math.abs(playerFreePos.x - freeWorldX) < 1e-5, 'jogador perto da lateral da mesa rotacionada não deve bater em canto invisível');
  assert.ok(Math.abs(playerFreePos.z - freeWorldZ) < 1e-5);

  // Ponto realmente encostando na mesa (localX = 0.90m < halfW 0.80m + raio 0.30m = 1.10m) deve sofrer colisão normal
  const hitWorldX = -15.0 + 0.90 * cos45;
  const hitWorldZ = -8.0 - 0.90 * sin45;
  const playerHitPos = { x: hitWorldX, y: 0.12, z: hitWorldZ };
  clampPosAgainstWalls({ wallSegments: [], campusDoors: [], solidColliders: [col], heldItem: null }, playerHitPos, 0.30);
  const pushedDist = Math.hypot(playerHitPos.x - (-15.0), playerHitPos.z - (-8.0));
  assert.ok(Math.abs(pushedDist - (col.halfW + 0.30)) < 1e-4, 'colisão OBB deve empurrar jogador exatamente até a borda real da mesa');
});
