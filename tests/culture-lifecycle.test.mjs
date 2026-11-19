import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CULTURE_GAME_DAY_SECONDS,
  CULTURE_ROOM_SHELF_LIFE_DAYS,
  CULTURE_REFRIGERATED_SHELF_LIFE_DAYS,
  createCultureLifecycleState,
  getCultureRemainingDays,
  isCultureIncubationTemperatureSuitable,
  stepCultureShelfLife,
  stepCultureTemperature
} from '../js/items/culture-lifecycle.js';

test('createCultureLifecycleState inicializa corretamente', () => {
  const st = createCultureLifecycleState(true);
  assert.equal(st.colonized, true);
  assert.equal(st.contaminated, false);
  assert.equal(st.expired, false);
  assert.equal(getCultureRemainingDays(st), CULTURE_ROOM_SHELF_LIFE_DAYS);
});

test('stepCultureShelfLife avança dias em temperatura ambiente e expira aos 15 dias', () => {
  const st = createCultureLifecycleState(true);
  const changed = stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS);
  assert.equal(changed, 1);
  assert.equal(Math.floor(st.ageGameDays), 1);
  assert.equal(getCultureRemainingDays(st), CULTURE_ROOM_SHELF_LIFE_DAYS - 1);

  const expiredRes = stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS * CULTURE_ROOM_SHELF_LIFE_DAYS);
  assert.equal(expiredRes, 2);
  assert.equal(st.expired, true);
  assert.equal(getCultureRemainingDays(st), 0);
});

test('cultura refrigerada dura 6x mais (90 dias)', () => {
  const st = createCultureLifecycleState(true);
  st.refrigerated = true;
  assert.equal(getCultureRemainingDays(st), CULTURE_REFRIGERATED_SHELF_LIFE_DAYS);

  stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS * 30);
  assert.equal(st.expired, false);
  assert.equal(getCultureRemainingDays(st), CULTURE_REFRIGERATED_SHELF_LIFE_DAYS - 30);

  stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS * 60);
  assert.equal(st.expired, true);
});

test('isCultureIncubationTemperatureSuitable valida faixa de 20°C a 30°C', () => {
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { baseTempC: 24 } }, {}), true);
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { baseTempC: 4 } }, {}), false);
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { baseTempC: 35 } }, {}), false);
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { getTempC: () => 27 } }, {}), true);
});

test('stepCultureTemperature esfria gradualmente na geladeira e aquece de volta fora dela', () => {
  const st = createCultureLifecycleState(true);
  assert.equal(st.tempC, 24.5);
  // 10s dentro da geladeira fechada: esfria parcialmente (~18°C), ainda não instantâneo
  stepCultureTemperature(st, 10, true, false);
  assert.ok(st.tempC > 10 && st.tempC < 24.5);
  assert.equal(st.refrigerated, false);

  // Mais 30s: chega a 4°C e ativa refrigeração
  stepCultureTemperature(st, 30, true, false);
  assert.equal(st.tempC, 4.0);
  assert.equal(st.refrigerated, true);

  // Tira da geladeira por 20s: aquece gradualmente
  stepCultureTemperature(st, 20, false, false);
  assert.ok(st.tempC > 10 && st.tempC < 24.5);
  assert.equal(st.refrigerated, false);
});
