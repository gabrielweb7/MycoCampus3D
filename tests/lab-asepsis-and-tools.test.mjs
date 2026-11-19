import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {
  THREE: {
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
    Box3: class {},
    Quaternion: class {}
  }
};

const { getSanitizationStatus, formatSprayHoverPrompt } = await import('../js/items/alcohol-spray.js');
const { canDisposeItemInTrash } = await import('../js/items/lab-trash.js');
const { isItemInClosedCabinet } = await import('../js/items/lab-cabinets.js');

test('getSanitizationStatus e formatSprayHoverPrompt refletem estado não higienizado, álcool úmido e desinfecção', () => {
  const target = { _sanitizeHits: 1, alcoholWet: false, sanitizedUntil: 0 };
  const st1 = getSanitizationStatus(target, {});
  assert.equal(st1.hits, 1);
  assert.equal(st1.isSanitized, false);
  assert.match(formatSprayHoverPrompt(target, 'Bancada', {}), /Não higienizado/);

  target.alcoholWet = true;
  assert.match(formatSprayHoverPrompt(target, 'Bancada', {}), /MOLHADO C\/ ÁLCOOL 70%/);

  target.alcoholWet = false;
  target.sanitizedUntil = performance.now() + 45000;
  const stDone = getSanitizationStatus(target, {});
  assert.equal(stDone.isSanitized, true);
  assert.ok(stDone.remainingSec >= 44);
  assert.match(formatSprayHoverPrompt(target, 'Bancada', {}), /DESINFECTADO/);
});

test('getSanitizationStatus para Fluxo Laminar (hood) usa epoch do ctx', () => {
  const ctx = { hoodAlcoholWet: false, hoodSanitizedUntil: Date.now() + 30000, hoodSanitizeHits: 0 };
  const st = getSanitizationStatus('hood', ctx);
  assert.equal(st.isSanitized, true);
  assert.equal(st.hits, 3);
});

test('canDisposeItemInTrash aceita recipientes com conteúdo e bloqueia lixeira/galão destilado', () => {
  assert.equal(canDisposeItemInTrash({ id: 'trash_1', mesh: { userData: { isTrash: true } } }), false);
  assert.equal(canDisposeItemInTrash({ id: 'distilled_jug_1', mesh: { userData: { liquidCtrl: { volMl: 500 } } } }), false);
  assert.equal(canDisposeItemInTrash({ id: 'beaker_1', mesh: { userData: { liquidCtrl: { volMl: 100 } } } }), false);
  assert.equal(canDisposeItemInTrash({ id: 'beaker_1', pdaMediumCtrl: { powderGrams: 10 }, mesh: { userData: { liquidCtrl: { volMl: 100 } } } }), true);
  assert.equal(canDisposeItemInTrash({ id: 'bag_1', spawnCtrl: { filled: true }, mesh: { userData: {} } }), true);
  assert.equal(canDisposeItemInTrash({ id: 'petri_1', mesh: { userData: { isPetri: true, petriCtrl: { mode: 'bare' } } } }), true);
  assert.equal(canDisposeItemInTrash({ id: 'petri_2', mesh: { userData: { isPetri: true, petriCtrl: { mode: 'clean' } } } }), true);
});

test('isItemInClosedCabinet detecta item dentro de armário fechado e libera quando aberto', () => {
  const part = {
    open: false,
    shelves: [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1, topY: 1.0 }]
  };
  const itemInside = { mesh: { position: { x: 0.5, y: 1.1, z: 0.5 } } };
  const itemOutside = { mesh: { position: { x: 3.0, y: 1.1, z: 0.5 } } };

  assert.equal(isItemInClosedCabinet({ labCabinets: [part] }, itemInside), true);
  assert.equal(isItemInClosedCabinet({ labCabinets: [part] }, itemOutside), false);

  part.open = true;
  assert.equal(isItemInClosedCabinet({ labCabinets: [part] }, itemInside), false);

  // Item na bancada (y = 1.02) acima da gaveta superior fechada (topY = 0.81) nunca deve ser bloqueado
  const topDrawer = {
    kind: 'drawer',
    open: false,
    shelves: [{ minX: -23.5, maxX: -22.5, minZ: -7.6, maxZ: -6.5, topY: 0.81 }]
  };
  const sprayOnCounter = { mesh: { position: { x: -22.85, y: 1.02, z: -7.1 } } };
  assert.equal(isItemInClosedCabinet({ labCabinets: [topDrawer] }, sprayOnCounter), false);
});
