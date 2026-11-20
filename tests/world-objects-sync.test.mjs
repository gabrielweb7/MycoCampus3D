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

const {
  getReplicatedItemState,
  applyReplicatedItemState,
  applyCampusItemStates,
  applyCampusWorldObjects
} = await import('../js/systems/world-objects-sync.js');

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

test('petri spore_print/generation, panela grainCook e quantização sem retrocesso de progresso funcionam corretamente', () => {
  const mkMesh = (ud = {}) => ({
    userData: ud,
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; } },
    rotation: { y: 0, copy(o) { this.y = o.y; } }
  });
  const potItem = { id: 'pot_1', mesh: mkMesh(), lidItem: { id: 'lid_1' } };
  const cooker = {
    potItem,
    waterMl: 500,
    mode: 'sterilize',
    temp: 103,
    psi: 14.2,
    progress: 63,
    sterilized: false,
    burned: false,
    overheatTimer: 7,
    grainGrams: 500,
    grainCookSec: 12,
    grainAlDente: true,
    hasBase: true,
    contents: []
  };
  const petriItem = {
    id: 'petri_1',
    mesh: mkMesh({
      petriCtrl: {
        mode: 'spore_print',
        lidOpen: false,
        sterilized: true,
        inoculated: false,
        parafilmSealed: false,
        speciesName: 'Blue Meanie',
        colonization: 41,
        generation: 3
      }
    })
  };
  const sim = {
    cookerPots: [cooker],
    pickableItems: [potItem, petriItem],
    findPickable: (id) => (id === 'pot_1' ? potItem : petriItem),
    isHeldByRemote: () => false,
    pendingMovedItems: {},
    recentlyDropped: {}
  };

  const potState = getReplicatedItemState(sim, potItem);
  assert.equal(potState.cooker.progress, 50);
  assert.equal(potState.cooker.grainGrams, 500);
  assert.equal(potState.cooker.grainCookSec, 10);
  assert.equal(potState.cooker.grainAlDente, true);
  assert.equal(potState.cooker.hasBase, true);

  const petriState = getReplicatedItemState(sim, petriItem);
  assert.equal(petriState.petri.mode, 'spore_print');
  assert.equal(petriState.petri.generation, 3);
  assert.equal(petriState.petri.colonization, 25);

  const mockTex = { needsUpdate: false };
  const remotePetri = {
    id: 'petri_remote',
    mesh: mkMesh({
      petriCtrl: {
        mode: 'filled',
        lidOpen: true,
        generation: 1,
        colonization: 0,
        canvas: {},
        texture: mockTex,
        context: new Proxy({}, { get: () => () => ({ addColorStop() {} }) }),
        agarMesh: { visible: true, material: { map: mockTex, needsUpdate: false } }
      }
    })
  };
  applyReplicatedItemState(sim, remotePetri, petriState);
  assert.equal(remotePetri.mesh.userData.petriCtrl.mode, 'spore_print');
  assert.equal(remotePetri.mesh.userData.petriCtrl.generation, 3);

  // Não retrocede progresso ativo quando outro jogador já está em 63%
  applyReplicatedItemState(sim, potItem, potState);
  assert.equal(cooker.progress, 63);
});

test('applyCampusWorldObjects ignora reprocessamento idêntico e applyCampusItemStates remove itens marcados removed', () => {
  const mkItem = (id, x, y, z) => ({
    id,
    label: id,
    homePos: { x, y, z },
    homeRy: 0,
    isMoved: false,
    mesh: {
      userData: {},
      parent: null,
      position: { x, y, z, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; }, copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; } },
      rotation: { y: 0, copy(o) { this.y = o.y; } }
    }
  });
  const bag = mkItem('bag_1', 1, 0.9, 2);
  const sim = {
    pickableItems: [bag],
    pickableMap: new Map([['bag_1', bag]]),
    cookerPots: [],
    pendingMovedItems: {},
    recentlyDropped: {},
    isHeldByRemote: () => false,
    removeFromCookerContents() {}
  };
  const objectsMap = { bag_1: { x: 1, y: 0.9, z: 2, ry: 0 } };
  applyCampusWorldObjects(sim, objectsMap);
  assert.equal(sim._stackPhysicsDirty, true);
  sim._stackPhysicsDirty = false;
  // Segunda aplicação com coordenadas idênticas não dispara re-física
  applyCampusWorldObjects(sim, objectsMap);
  assert.equal(sim._stackPhysicsDirty, false);

  applyCampusItemStates(sim, { bag_1: { custom: { dynamicKind: 'mushroom_bag', removed: true } } });
  assert.equal(sim.pickableItems.length, 0);
  assert.equal(sim.pickableMap.has('bag_1'), false);
});
