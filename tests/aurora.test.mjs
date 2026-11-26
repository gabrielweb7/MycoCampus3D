import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuroraStrength } from '../js/engine/sky-gradient.js';

const clearSky = { partly: 0, overcast: 0, rain: 0, snow: 0 };

test('the aurora fades in and out during the clear night after snowfall', () => {
  assert.equal(getAuroraStrength(-1, 'clear', 0, clearSky), 0);
  assert.equal(getAuroraStrength(-1, 'clear', 22, clearSky), 0.5);
  assert.equal(getAuroraStrength(-1, 'clear', 50, clearSky), 1);
  assert.equal(getAuroraStrength(-1, 'clear', 91.5, clearSky), 0.5);
  assert.equal(getAuroraStrength(-1, 'clear', 105, clearSky), 0);
  assert.equal(getAuroraStrength(-1, 'clear', 350, clearSky), 0);
});

test('daylight and lingering cloud cover keep the aurora hidden', () => {
  assert.equal(getAuroraStrength(1, 'clear', 50, clearSky), 0);
  assert.equal(getAuroraStrength(-0.22, 'clear', 50, clearSky), 0);
  assert.ok(getAuroraStrength(-0.4, 'clear', 50, clearSky) > 0);
  for (const mode of ['partly', 'overcast', 'rain', 'snow']) {
    assert.equal(getAuroraStrength(-1, mode, 50, clearSky), 0);
    assert.equal(getAuroraStrength(-1, 'clear', 50, { ...clearSky, [mode]: 0.7 }), 0);
  }
});
