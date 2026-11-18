import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  THREE: {
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
    Box3: class {},
    Quaternion: class {}
  }
};

const { MUSHROOM_SPECIES_CATALOG } = await import('../js/world/mushroom-species.js');
const { COW_POOP_INTERVAL_SEC, POOP_CUBENSIS_GROW_SEC } = await import('../js/entities/pasture-cows.js');
const { BURNER_TIMER_PRESETS, formatBurnerTimerLabel } = await import('../js/items/pressure-cooker.js');

test('MUSHROOM_SPECIES_CATALOG contém exatamente 100 espécies em madeira, mata e pasto', () => {
  assert.equal(MUSHROOM_SPECIES_CATALOG.length, 100);
  const wood = MUSHROOM_SPECIES_CATALOG.filter((s) => s.habitat === 'wood');
  const forest = MUSHROOM_SPECIES_CATALOG.filter((s) => s.habitat === 'forest');
  const pasture = MUSHROOM_SPECIES_CATALOG.filter((s) => s.habitat === 'pasture');
  assert.ok(wood.length >= 30);
  assert.ok(forest.length >= 40);
  assert.ok(pasture.length >= 20);
});

test('vaquinhas soltam cocô a cada 30s e cubensis dourados nascem após 60s', () => {
  assert.equal(COW_POOP_INTERVAL_SEC, 30);
  assert.equal(POOP_CUBENSIS_GROW_SEC, 60);
});

test('fogareiro elétrico possui presets de timer 20m, 1h, 1h30, 2h e Livre', () => {
  assert.deepEqual(BURNER_TIMER_PRESETS, [0, 20, 60, 90, 120]);
  assert.equal(formatBurnerTimerLabel(0), 'Livre');
  assert.equal(formatBurnerTimerLabel(20), '20m');
  assert.equal(formatBurnerTimerLabel(60), '1h');
  assert.equal(formatBurnerTimerLabel(90), '1h30');
  assert.equal(formatBurnerTimerLabel(120), '2h');
});
