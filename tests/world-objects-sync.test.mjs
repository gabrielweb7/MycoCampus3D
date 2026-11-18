import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  THREE: {
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    Color: class { constructor(c = 0) { this.c = c; } },
    Box3: class {},
    Quaternion: class {}
  }
};
globalThis.THREE = globalThis.window.THREE;

const { getReplicatedItemState, applyReplicatedItemState } = await import('../js/systems/world-objects-sync.js');

test('getReplicatedItemState e applyReplicatedItemState executam hooks meta.serializeState e meta.applyState', () => {
  const sim = { cookerPots: [], findPickable: () => null };
  const item = {
    id: 'custom_autoclave_1',
    meta: {
      serializeState: (it) => ({ doorLocked: !!it.customCtrl.doorLocked, cycles: it.customCtrl.cycles }),
      applyState: (it, custom) => {
        it.customCtrl.doorLocked = !!custom.doorLocked;
        it.customCtrl.cycles = custom.cycles;
      }
    },
    customCtrl: { doorLocked: true, cycles: 3 },
    mesh: { userData: {} }
  };

  const serialized = getReplicatedItemState(sim, item);
  assert.deepEqual(serialized, {
    custom: { doorLocked: true, cycles: 3 }
  });

  const remoteItem = {
    id: 'custom_autoclave_1',
    meta: item.meta,
    customCtrl: { doorLocked: false, cycles: 0 },
    mesh: { userData: {} }
  };
  applyReplicatedItemState(sim, remoteItem, serialized);
  assert.equal(remoteItem.customCtrl.doorLocked, true);
  assert.equal(remoteItem.customCtrl.cycles, 3);
});
