import test from 'node:test';
import assert from 'node:assert/strict';

// Mock mínimo de window.THREE para importar módulos de regras puras no Node
globalThis.window = {
  THREE: {
    Vector3: class {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    },
    Box3: class {},
    Quaternion: class {}
  }
};

const {
  canItemEnterCooker,
  canSyringeTarget,
  canSyringeSource,
  canFillFromSink,
  canSealSpawnBag,
  hasPdaContents,
  getItemWeightGrams,
  getItemBaseTempC
} = await import('../js/items/item-registry.js');

const { normalizeAngle } = await import('../js/core/math-pool.js');

function makeItem(overrides = {}) {
  return {
    id: overrides.id || 'test_item',
    label: overrides.label || 'Item Teste',
    meta: overrides.meta || { compatibilities: {} },
    spawnCtrl: overrides.spawnCtrl || null,
    pdaMediumCtrl: overrides.pdaMediumCtrl || null,
    cultureCtrl: overrides.cultureCtrl || null,
    mesh: {
      userData: overrides.userData || {}
    }
  };
}

test('normalizeAngle mantém ângulos dentro de [-PI, PI]', () => {
  assert.ok(Math.abs(normalizeAngle(Math.PI * 3) - Math.PI) < 1e-9);
  assert.ok(Math.abs(normalizeAngle(-Math.PI * 3) - (-Math.PI)) < 1e-9);
  assert.equal(normalizeAngle(0), 0);
});

test('canItemEnterCooker bloqueia twoHanded, seringa e borrifador', () => {
  assert.equal(canItemEnterCooker(makeItem({ userData: { twoHanded: true } })), false);
  assert.equal(canItemEnterCooker(makeItem({ userData: { isSyringe: true } })), false);
  assert.equal(canItemEnterCooker(makeItem({ userData: { isAlcoholSpray: true } })), false);
  assert.equal(canItemEnterCooker(makeItem()), true);
});

test('canSealSpawnBag exige bag preenchido, não selado e não esterilizado/queimado', () => {
  const validBag = makeItem({
    spawnCtrl: { isBag: true, filled: true, sealed: false, sterilized: false, inoculated: false, burned: false, contaminated: false }
  });
  assert.equal(canSealSpawnBag(validBag), true);

  const emptyBag = makeItem({
    spawnCtrl: { isBag: true, filled: false, sealed: false }
  });
  assert.equal(canSealSpawnBag(emptyBag), false);

  const alreadySealed = makeItem({
    spawnCtrl: { isBag: true, filled: true, sealed: true }
  });
  assert.equal(canSealSpawnBag(alreadySealed), false);
});

test('canSyringeTarget valida PP5 hidratado, bag selado e placa petri estéril aberta', () => {
  const readyBag = makeItem({
    id: 'spawn_bag_1',
    meta: { compatibilities: { receivesSyringe: true } },
    spawnCtrl: { isBag: true, filled: true, sealed: true, sterilized: true, inoculated: false }
  });
  assert.equal(canSyringeTarget(readyBag), true);

  const unsealedBag = makeItem({
    id: 'spawn_bag_2',
    meta: { compatibilities: { receivesSyringe: true } },
    spawnCtrl: { isBag: true, filled: true, sealed: false, sterilized: true, inoculated: false }
  });
  assert.equal(canSyringeTarget(unsealedBag), false);

  const dryPP5 = makeItem({
    id: 'spawn_pp5_1',
    meta: { compatibilities: { receivesSyringe: true } },
    spawnCtrl: { isPP5: true, filled: true, waterMl: 10, sterilized: true, inoculated: false }
  });
  dryPP5.spawnCtrl.lidOpen = true;
  assert.equal(canSyringeTarget(dryPP5), false);
  dryPP5.spawnCtrl.waterMl = 35;
  assert.equal(canSyringeTarget(dryPP5), true);
  dryPP5.spawnCtrl.lidOpen = false;
  assert.equal(canSyringeTarget(dryPP5), false, 'não inocula potinho fechado');

  const openSterilePetri = makeItem({
    id: 'petri_1',
    userData: { isPetri: true, petriCtrl: { mode: 'empty', lidOpen: true, sterilized: true } }
  });
  assert.equal(canSyringeTarget(openSterilePetri), true);
  openSterilePetri.mesh.userData.petriCtrl.lidOpen = false;
  assert.equal(canSyringeTarget(openSterilePetri), false);
});

test('canSyringeSource e canFillFromSink respeitam conteúdo e compatibilidade', () => {
  const lcReady = makeItem({
    meta: { compatibilities: { providesLiquidCulture: true } },
    userData: { liquidCtrl: { volMl: 50 } },
    cultureCtrl: { colonized: true, contaminated: false, expired: false }
  });
  assert.equal(canSyringeSource(lcReady), true);

  const emptyBeaker = makeItem({
    userData: { liquidCtrl: { volMl: 0 } },
    pdaMediumCtrl: { powderGrams: 0 }
  });
  assert.equal(canFillFromSink(emptyBeaker), true);
  assert.equal(hasPdaContents(emptyBeaker), false);
});

test('getItemWeightGrams e getItemBaseTempC usam metadados ou fallback padrão', () => {
  assert.equal(getItemWeightGrams(makeItem({ meta: { weightGrams: 420 } })), 420);
  assert.equal(getItemBaseTempC(makeItem({ meta: { baseTempC: 4.0 } })), 4.0);
  assert.equal(getItemBaseTempC(null), 23.3);
});
