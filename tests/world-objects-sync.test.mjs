import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  consumeCampusMovedItems,
  requeueCampusMovedItems,
  applyReplicatedItemState,
  applyCampusItemStates,
  applyCampusWorldObjects,
  advanceOfflineItemState
} = await import('../js/systems/world-objects-sync.js');
const { consumeCampusBoardStrokes, requeueCampusBoardStrokes } = await import('../js/systems/world-devices-sync.js');

test('lotes do multiplayer preservam o excedente e mantêm o identificador ao repetir um traço', () => {
  const items = Array.from({ length: 305 }, (_, index) => ({ id: 'item_' + index }));
  const sim = { pendingMovedItems: Object.fromEntries(items.map((item) => [item.id, item])) };
  assert.deepEqual(consumeCampusMovedItems(sim), items.slice(0, 300));
  assert.deepEqual(consumeCampusMovedItems(sim), items.slice(300));

  const points = Array.from({ length: 83 }, (_, index) => [index, 0]);
  sim.pendingBoardStrokes = [{ b: 0, c: '#f8fafc', pts: points }];
  for (let index = 0; index < 19; index++) {
    sim.pendingBoardStrokes.push({ b: 0, c: '#f8fafc', pts: [[0, 0], [1, 1]] });
  }
  const strokes = consumeCampusBoardStrokes(sim);
  assert.equal(strokes.length, 20);
  assert.deepEqual(strokes[0].pts, points.slice(0, 80));
  assert.deepEqual(strokes[1].pts, points.slice(79));
  requeueCampusBoardStrokes(sim, strokes);
  assert.deepEqual(consumeCampusBoardStrokes(sim), strokes);
  assert.equal(consumeCampusBoardStrokes(sim).length, 1);
});

test('a posição de um item sobrevive à falha mesmo se seu estado mudar enquanto o pedido está em trânsito', () => {
  const moved = { id: 'petri_clean', x: -14, y: .8, z: 2, ry: 0.4, state: { lidOpen: false, volume: 10 } };
  const updated = { id: moved.id, state: { lidOpen: true } };
  const sim = { pendingMovedItems: { [moved.id]: updated } };
  requeueCampusMovedItems(sim, [moved]);
  assert.deepEqual(consumeCampusMovedItems(sim), [{ ...moved, state: { lidOpen: true, volume: 10 } }]);
});

test('snapshots de multiplayer só reaplicam itens alterados', () => {
  const updates = [];
  const items = ['first', 'second'].map((id) => ({
    id,
    mesh: { userData: {} },
    meta: { applyState(item, state) { updates.push([item.id, state.value]); } }
  }));
  const sim = { pickableItems: items, cookerPots: [] };
  const snapshot = { first: { custom: { value: 1 } }, second: { custom: { value: 1 } } };
  applyCampusItemStates(sim, snapshot);
  applyCampusItemStates(sim, structuredClone(snapshot));
  applyCampusItemStates(sim, { ...snapshot, second: { custom: { value: 2 } } });
  assert.deepEqual(updates, [['first', 1], ['second', 1], ['second', 2]]);
});

test('sincronização confirma o movimento recente somente com posição e rotação novas', () => {
  for (const updateBounds of [undefined, () => {}]) {
    const item = { id: 'moved', isMoved: true, mesh: {
      userData: { updateBounds },
      position: { x: 4.03, y: 0.91, z: 5, set(x, y, z) { Object.assign(this, { x, y, z }); } },
      rotation: { y: 0.4 }
    }};
    const sim = { pickableItems: [item], pendingMovedItems: {}, recentlyDropped: { moved: performance.now() + 22000 },
      isHeldByRemote: () => false };

    applyCampusWorldObjects(sim, { moved: { x: 4, y: 0.87, z: 5, ry: 0 } });
    assert.equal(sim.pendingMovedItems.moved?.x, 4.03);
    delete sim.pendingMovedItems.moved;
    applyCampusWorldObjects(sim, { moved: { x: 4.03, y: 0.91, z: 5, ry: 0 } });
    assert.equal(sim.pendingMovedItems.moved?.ry, 0.4);
    delete sim.pendingMovedItems.moved;
    applyCampusWorldObjects(sim, { moved: { x: 4.03, y: 0.91, z: 5, ry: 0.4 } });
    assert.equal(sim.recentlyDropped.moved, undefined);
  }
});

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

test('sincronização preserva a gramatura da colheita e a geração da seringa', () => {
  const sim = { cookerPots: [] };
  const harvest = {
    id: 'harvest_gh_test',
    mesh: { userData: {} },
    wildMushroomCtrl: { speciesName: 'Teste', grams: 17 }
  };
  assert.equal(getReplicatedItemState(sim, harvest).wildMushroom.grams, 17);

  const makeSyringe = (generation) => ({
    id: 'syringe_10ml_a',
    mesh: {
      userData: {
        syrCtrl: {
          volMl: 2.5, mix: { lcMl: 2.5 }, generation,
          liqMesh: { scale: {}, position: {} }, plunger: { position: {} }
        }
      }
    }
  });
  const remote = makeSyringe(null);
  const state = getReplicatedItemState(sim, makeSyringe(0));
  applyReplicatedItemState(sim, remote, state);
  assert.equal(remote.mesh.userData.syrCtrl.generation, 0);
  assert.equal(remote.mesh.userData.syrCtrl.volMl, 2.5);
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

test('advanceOfflineItemState e applyCampusItemStates avançam culturas/desidratadora pelo tempo offline e backend aceita novos campos', () => {
  const mkSimple = (id) => ({
    id,
    label: id,
    mesh: { userData: {}, position: { x: 15.2, y: 1.0, z: -4.0 }, rotation: { y: 0 } }
  });
  const dehydrator = mkSimple('dehydrator_lab');
  dehydrator.dehydratorCtrl = { on: true, hasMushroom: true, crisp: false, progress: 20, updateVisual() {} };

  const spawn = mkSimple('spawn_jar_1');
  spawn.spawnCtrl = {
    inoculated: true,
    colonized: false,
    contaminated: false,
    burned: false,
    expired: false,
    shaken: false,
    generation: 1,
    refrigerated: false,
    colonization: 50,
    updateVisual() {}
  };

  const tub = mkSimple('monotub_lab_1');
  tub.monotubCtrl = {
    spent: false,
    contaminated: false,
    mixed: true,
    leveled: true,
    lidOpen: false,
    colonization: 90,
    onLedRack: true,
    hasCasing: true,
    humidity: 90,
    generation: 1,
    fruitingStage: 0,
    growth: 0,
    updateVisual() {}
  };

  let markedIds = [];
  const sim = {
    pickableItems: [dehydrator, spawn, tub],
    cookerPots: [],
    markItemMoved: (it) => markedIds.push(it.id),
    findPickable: () => null
  };

  applyCampusItemStates(
    sim,
    {
      dehydrator_lab: { custom: { on: true, hasMushroom: true, crisp: false, progress: 20 } },
      spawn_jar_1: { spawn: { inoculated: true, colonized: false, colonization: 50, generation: 1 } },
      monotub_lab_1: { custom: { mixed: true, leveled: true, lidOpen: false, colonization: 90, hasCasing: true, humidity: 90 } }
    },
    { dehydrator_lab: 20, spawn_jar_1: 15, monotub_lab_1: 30 }
  );

  assert.equal(dehydrator.dehydratorCtrl.crisp, true);
  assert.equal(dehydrator.dehydratorCtrl.progress, 100);
  assert.equal(spawn.spawnCtrl.colonized, true);
  assert.equal(tub.monotubCtrl.colonization, 100);
  assert.ok(tub.monotubCtrl.fruitingStage >= 2);
  assert.ok(markedIds.includes('dehydrator_lab'));
  assert.ok(markedIds.includes('spawn_jar_1'));
  assert.ok(markedIds.includes('monotub_lab_1'));
  assert.equal(advanceOfflineItemState(null, 10), false);

  const schemaPhp = fs.readFileSync('api/multiplayer_schema.php', 'utf8');
  assert.ok(schemaPhp.includes('mp_is_allowed_item_id($contentId)'));
  assert.ok(schemaPhp.includes("'garden_plants'"));
  assert.ok(schemaPhp.includes("'burner_timer_end_lab'"));

  const mpPhp = fs.readFileSync('api/multiplayer.php', 'utf8');
  assert.ok(mpPhp.includes("'fx_spray'"));
  assert.ok(mpPhp.includes("'fx_harvest'"));
  assert.ok(mpPhp.includes("'item_state_ages'"));

  const hoverHeldSrc = fs.readFileSync('js/systems/hover-held-handlers.js', 'utf8');
  assert.ok(hoverHeldSrc.includes('isTubeSlantOrCulture'), 'Tubo Falcon / Slant não deve tentar despejar água na panela');

  const cookerSrc = fs.readFileSync('js/items/pressure-cooker.js', 'utf8');
  assert.ok(cookerSrc.includes('cLiq.sterilized = true'), 'Autoclave deve marcar recipientes líquidos (ex.: Falcon 50ml) como estéreis ao concluir');

  // Testa round-trip de esterilização de líquido/recipiente
  const falconItem = {
    id: 'falcon_50ml_01',
    label: 'Tubo Falcon 50ml (15ml/50ml)',
    sterilized: true,
    mesh: {
      userData: {
        liquidCtrl: {
          volMl: 15,
          maxMl: 50,
          baseY: 0.03,
          maxH: 0.11,
          baseLabel: 'Tubo Falcon 50ml',
          sterilized: true,
          liqMesh: { visible: false, scale: { set() {} }, position: { y: 0 } }
        }
      }
    }
  };
  const serializedFalcon = getReplicatedItemState({ cookerPots: [] }, falconItem);
  assert.equal(serializedFalcon.liquid.sterilized, true);
  assert.equal(serializedFalcon.sterilized, true);

  const radialSrc = fs.readFileSync('js/ui/radial-menu.js', 'utf8');
  assert.ok(radialSrc.includes('emptySterilized'), 'Inspeção deve exibir status de esterilização mesmo para recipientes vazios');
  assert.ok(radialSrc.includes('canAutoclave'), 'Inspeção deve cobrir todos itens autoclaváveis');
});
