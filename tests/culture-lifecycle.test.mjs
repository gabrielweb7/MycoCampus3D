import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CULTURE_GAME_DAY_SECONDS,
  CULTURE_ROOM_SHELF_LIFE_DAYS,
  CULTURE_REFRIGERATED_SHELF_LIFE_DAYS,
  createCultureLifecycleState,
  getCultureRemainingDays,
  isCultureIncubationTemperatureSuitable,
  stepCultureShelfLife
} from '../js/items/culture-lifecycle.js';

test('createCultureLifecycleState inicializa corretamente', () => {
  const st = createCultureLifecycleState(true);
  assert.equal(st.colonized, true);
  assert.equal(st.contaminated, false);
  assert.equal(st.expired, false);
  assert.equal(getCultureRemainingDays(st), CULTURE_ROOM_SHELF_LIFE_DAYS);
});

test('stepCultureShelfLife avança dias em temperatura ambiente e expira aos 30 dias', () => {
  const st = createCultureLifecycleState(true);
  const changed = stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS);
  assert.equal(changed, 1);
  assert.equal(Math.floor(st.ageGameDays), 1);
  assert.equal(getCultureRemainingDays(st), CULTURE_ROOM_SHELF_LIFE_DAYS - 1);

  const expiredRes = stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS * 30);
  assert.equal(expiredRes, 2);
  assert.equal(st.expired, true);
  assert.equal(getCultureRemainingDays(st), 0);
});

test('cultura refrigerada dura o dobro (60 dias)', () => {
  const st = createCultureLifecycleState(true);
  st.refrigerated = true;
  assert.equal(getCultureRemainingDays(st), CULTURE_REFRIGERATED_SHELF_LIFE_DAYS);

  stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS * 30);
  assert.equal(st.expired, false);
  assert.equal(getCultureRemainingDays(st), 30);

  stepCultureShelfLife(st, CULTURE_GAME_DAY_SECONDS * 30);
  assert.equal(st.expired, true);
});

test('isCultureIncubationTemperatureSuitable valida faixa de 20°C a 30°C', () => {
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { baseTempC: 24 } }, {}), true);
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { baseTempC: 4 } }, {}), false);
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { baseTempC: 35 } }, {}), false);
  assert.equal(isCultureIncubationTemperatureSuitable({ meta: { getTempC: () => 27 } }, {}), true);
});
