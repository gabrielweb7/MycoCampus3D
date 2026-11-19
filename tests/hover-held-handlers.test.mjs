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
  resolveHeldItemHover,
  isRayOccludedByStructure,
  firstUnoccludedRayHit
} = await import('../js/systems/hover-held-handlers.js');

function makeCtx(overrides = {}) {
  return Object.assign({
    heldItem: null,
    placementMode: false,
    placementGhost: { visible: true, position: { set() {} } },
    inFps: true,
    playerPos: { x: 0, z: 0 },
    camera: { position: { x: 0, z: 0 } },
    pickableItems: [],
    cookerPots: [],
    chalkboardMeshes: [],
    labTrashMeshes: [],
    doorHitMeshes: [],
    blindHitMeshes: [],
    raycaster: { intersectObjects: () => [], intersectObject: () => [] },
    isHeldByRemote: () => false,
    isTouchDevice: () => false,
    clock: { elapsedTime: 0 }
  }, overrides);
}

test('resolveHeldItemHover retorna false quando não há item segurado', () => {
  const ctx = makeCtx({ heldItem: null });
  const handled = resolveHeldItemHover(ctx, null, {
    intersectPickableItem: () => null,
    setHoverPrompt: () => {},
    updateHeldItemPlacementPreview: () => {}
  });
  assert.equal(handled, false);
});

test('resolveHeldItemHover detecta descarte na lixeira com recipiente preenchido', () => {
  let prompt = '';
  const trashHit = { distance: 1.5, object: {} };
  const ctx = makeCtx({
    heldItem: { id: 'spawn_bag_1', spawnCtrl: { isBag: true, filled: true }, mesh: { userData: {} } },
    labTrashMeshes: [{}],
    raycaster: { intersectObjects: () => [trashHit], intersectObject: () => [] }
  });

  const handled = resolveHeldItemHover(ctx, null, {
    intersectPickableItem: () => null,
    setHoverPrompt: (_c, p) => { prompt = p; },
    updateHeldItemPlacementPreview: () => {}
  });

  assert.equal(handled, true);
  assert.equal(ctx.hoveredTrash, true);
  assert.equal(ctx.placementGhost.visible, false);
  assert.match(prompt, /Descartar Bag na Lixeira/);
});

test('resolveHeldItemHover aciona preview de posicionamento quando placementMode está ativo', () => {
  let previewCalled = false;
  const ctx = makeCtx({
    heldItem: { id: 'generic_1', mesh: { userData: {} } },
    placementMode: true
  });

  const handled = resolveHeldItemHover(ctx, { x: 0, y: 0 }, {
    intersectPickableItem: () => null,
    setHoverPrompt: () => {},
    updateHeldItemPlacementPreview: () => { previewCalled = true; }
  });

  assert.equal(handled, true);
  assert.equal(previewCalled, true);
});

test('isRayOccludedByStructure bloqueia persiana atrás da estante, mas libera item na própria estante', () => {
  const rackCollider = { minX: 14.94, maxX: 15.66, minY: 0.14, maxY: 2.39, minZ: -6.45, maxZ: -3.95 };
  const occCtx = makeCtx({
    solidColliders: [rackCollider],
    wallSegments: [],
    raycaster: {
      ray: {
        origin: { x: 17.0, y: 1.3, z: -5.2 },
        direction: { x: -1, y: 0, z: 0 }
      }
    }
  });
  // Monotub dentro da estante (~1.45m) fica antes da saída do colisor (~2.06m): clicável!
  assert.equal(isRayOccludedByStructure(occCtx, 1.45), false);
  // Persiana atrás da estante (~2.7m) fica além da saída do colisor (~2.06m): bloqueada!
  assert.equal(isRayOccludedByStructure(occCtx, 2.7), true);
  const picked = firstUnoccludedRayHit(occCtx, [{ distance: 2.7, object: { userData: {} } }], 5.5);
  assert.equal(picked, null);
});
