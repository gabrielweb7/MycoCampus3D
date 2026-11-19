import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.window = globalThis.window || {
  THREE: {
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
    Box3: class {},
    Quaternion: class {},
    MeshStandardMaterial: class { constructor(opts = {}) { Object.assign(this, opts); this.userData = {}; } },
    MeshBasicMaterial: class { constructor(opts = {}) { Object.assign(this, opts); this.userData = {}; } },
    BoxGeometry: class { constructor() { this.userData = {}; } }
  }
};

const {
  greenhouseSlots,
  greenhouseEnv,
  stepGreenhouse,
  applyGreenhouseAutomationSettings,
  triggerGreenhouseMistPulse,
  triggerGreenhouseVentPulse,
  isHoldingColonizedSpawn
} = await import('../js/world/greenhouse.js');

test('estufa possui 24 lugares em 2 estantes x 3 andares com slots livres e ocupados', () => {
  assert.equal(greenhouseSlots.length, 24);
  const central = greenhouseSlots.filter((s) => s.rackId === 'central');
  const leste = greenhouseSlots.filter((s) => s.rackId === 'leste');
  assert.equal(central.length, 12);
  assert.equal(leste.length, 12);

  const emptyCount = greenhouseSlots.filter((s) => s.empty).length;
  assert.equal(emptyCount, 8);
  assert.equal(greenhouseSlots[0].tier, 1);
  assert.equal(greenhouseSlots[11].tier, 3);
});

test('automação da estufa controla umidade, CO2, temperatura e crescimento dos bolos', () => {
  applyGreenhouseAutomationSettings({
    autoMode: true,
    targetHumidity: 92,
    targetCo2: 600,
    targetTempC: 22.0,
    lightOn: true
  });
  assert.equal(greenhouseEnv.autoMode, true);
  assert.equal(greenhouseEnv.targetHumidity, 92);

  greenhouseEnv.humidity = 75;
  greenhouseEnv.co2Ppm = 1100;
  stepGreenhouse({ queueWorldStateChange: () => {} }, 1.0);
  assert.equal(greenhouseEnv.humidifierPower, 3);
  assert.equal(greenhouseEnv.exhaustPower, 2);

  const prevHum = greenhouseEnv.humidity;
  triggerGreenhouseMistPulse();
  assert.ok(greenhouseEnv.humidity > prevHum);

  const prevCo2 = greenhouseEnv.co2Ppm;
  triggerGreenhouseVentPulse();
  assert.ok(greenhouseEnv.co2Ppm < prevCo2);
});

test('isHoldingColonizedSpawn aceita bag/PP5 colonizado limpo e rejeita contaminado', () => {
  assert.equal(isHoldingColonizedSpawn(null), false);
  assert.equal(isHoldingColonizedSpawn({ spawnCtrl: { colonized: false, contaminated: false } }), false);
  assert.equal(isHoldingColonizedSpawn({ spawnCtrl: { colonized: true, contaminated: true } }), false);
  assert.equal(isHoldingColonizedSpawn({ spawnCtrl: { isPP5: true, colonized: true, contaminated: false } }), true);
  assert.equal(isHoldingColonizedSpawn({ spawnCtrl: { isBag: true, colonized: true, contaminated: false } }), true);
});

test('back-end PHP aceita 24 slots e chaves da estufa automatizada', () => {
  const auth = fs.readFileSync('api/auth.php', 'utf8');
  assert.ok(auth.includes('$slotId > 23'), 'api/auth.php deve permitir slot_id até 23');

  const schema = fs.readFileSync('api/multiplayer_schema.php', 'utf8');
  assert.ok(schema.includes('greenhouse_auto'), 'multiplayer_schema.php deve aceitar greenhouse_auto');
  assert.ok(schema.includes('greenhouse_slot_([0-9]|1[0-9]|2[0-3])_'), 'multiplayer_schema.php deve aceitar slots 0..23');
});
