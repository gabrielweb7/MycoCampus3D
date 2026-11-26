import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

globalThis.window = globalThis.window || {
  THREE: {
    Vector3: class {
      constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    },
    Box3: class {},
    Quaternion: class {}
  }
};

const { MUSHROOM_SPECIES_CATALOG } = await import('../js/world/mushroom-species.js');
const {
  COW_POOP_INTERVAL_SEC,
  POOP_CUBENSIS_GROW_SEC,
  petCow,
  isBeeBlockedAt3D,
  moveBeeSafely,
  FLOWER_POLLEN_PER_VISIT,
  createCampusFlower,
  stepCampusFlowers,
  interactFlower,
  getFlowerInspectInfo,
  plantFlowerSeedAtSpot
} = await import('../js/entities/pasture-cows.js');
const { SHOP_SUPPLIES } = await import('../js/ui/modal-shop.js');
const { BURNER_TIMER_PRESETS, formatBurnerTimerLabel } = await import('../js/items/pressure-cooker.js');
const { DEHYDRATOR_META } = await import('../js/items/dehydrator.js');
const { registerDiscoveredSpecies, getDiscoveredSpecies } = await import('../js/systems/mycoteca.js');

test('MUSHROOM_SPECIES_CATALOG contém exatamente 100 espécies em madeira, mata e pasto', () => {
  assert.equal(MUSHROOM_SPECIES_CATALOG.length, 100);
  const wood = MUSHROOM_SPECIES_CATALOG.filter((s) => s.habitat === 'wood');
  const forest = MUSHROOM_SPECIES_CATALOG.filter((s) => s.habitat === 'forest');
  const pasture = MUSHROOM_SPECIES_CATALOG.filter((s) => s.habitat === 'pasture');
  assert.ok(wood.length >= 30);
  assert.ok(forest.length >= 40);
  assert.ok(pasture.length >= 20);
});

test('vaquinhas soltam cocô a cada 30s, cubensis dourados nascem após 30s e carinho atualiza saúde/humor', () => {
  assert.equal(COW_POOP_INTERVAL_SEC, 30);
  assert.equal(POOP_CUBENSIS_GROW_SEC, 30);
  const cow = { name: 'Mimosa', health: 95, mood: 'Pastando 🌿', state: 'wander' };
  const msg = petCow(cow);
  assert.equal(cow.health, 100);
  assert.equal(cow.state, 'curious');
  assert.match(msg, /Mimosa.*100%/);
});

test('fogareiro elétrico possui presets de timer 20m, 1h, 1h30, 2h e Livre', () => {
  assert.deepEqual(BURNER_TIMER_PRESETS, [0, 20, 60, 90, 120]);
  assert.equal(formatBurnerTimerLabel(0), 'Livre');
  assert.equal(formatBurnerTimerLabel(20), '20m');
  assert.equal(formatBurnerTimerLabel(60), '1h');
  assert.equal(formatBurnerTimerLabel(90), '1h30');
  assert.equal(formatBurnerTimerLabel(120), '2h');
});

test('DEHYDRATOR_META serializa e restaura estado da desidratadora e mycoteca funciona sem DOM', () => {
  const item = {
    label: 'Desidratadora',
    dehydratorCtrl: { on: true, hasMushroom: true, progress: 65, crisp: false, speciesName: 'Golden Teacher' },
    mesh: { userData: {} }
  };
  const saved = DEHYDRATOR_META.serializeState(item);
  assert.deepEqual(saved, { on: true, hasMushroom: true, progress: 50, crisp: false, speciesName: 'Golden Teacher' });

  const target = {
    label: '',
    dehydratorCtrl: { on: false, hasMushroom: false, progress: 0, crisp: false, speciesName: '' },
    mesh: { userData: {} }
  };
  DEHYDRATOR_META.applyState(target, saved);
  assert.equal(target.dehydratorCtrl.on, true);
  assert.equal(target.dehydratorCtrl.progress, 50);
  assert.equal(target.dehydratorCtrl.speciesName, 'Golden Teacher');

  // Não retrocede progresso local ativo ao receber pacote de progresso quantizado menor
  target.dehydratorCtrl.progress = 78;
  DEHYDRATOR_META.applyState(target, saved);
  assert.equal(target.dehydratorCtrl.progress, 78);

  assert.ok(Array.isArray(getDiscoveredSpecies()));
  assert.equal(typeof registerDiscoveredSpecies('Psilocybe cubensis').isNew, 'boolean');
});

test('abelhas protegem objetos dinâmicos, respeitam oclusão de migração e desviam de paredes em 3D', () => {
  const optSrc = fs.readFileSync(path.resolve('js/engine/scene-optimizer.js'), 'utf8');
  assert.match(optSrc, /markTreeList\(sim\.pastureBees/);
  assert.match(optSrc, /markTreeList\(sim\.beehives/);
  assert.match(optSrc, /markTreeList\(sim\.campusFlowers/);

  const beeSrc = fs.readFileSync(path.resolve('js/entities/pasture-cows.js'), 'utf8');
  assert.match(beeSrc, /depthTest:\s*true/);
  assert.match(beeSrc, /migrationSprite\.visible\s*=\s*dist\s*<=\s*18/);

  const wallCtx = {
    solidColliders: [{ minX: 4, maxX: 6, minZ: -5, maxZ: 5, minY: 0, maxY: 3.5 }],
    wallSegments: [],
    beehives: []
  };
  assert.equal(isBeeBlockedAt3D(wallCtx, 5, 2.0, 0, 0.22, null), true);
  assert.equal(isBeeBlockedAt3D(wallCtx, 5, 4.2, 0, 0.22, null), false);

  const bee = {
    avoidSide: 1,
    group: {
      position: new globalThis.window.THREE.Vector3(3.6, 2.0, 0),
      rotation: { x: 0, y: 0, z: 0 }
    }
  };
  for (let s = 0; s < 35; s++) {
    moveBeeSafely(wallCtx, bee, 8.0, 2.0, 0.0, 3.0, 0.1, 0, null);
    assert.equal(
      isBeeBlockedAt3D(wallCtx, bee.group.position.x, bee.group.position.y, bee.group.position.z, 0.05, null),
      false,
      `abelha não pode entrar na parede no passo ${s}`
    );
  }
});

test('ciclo de pólen (10% por visita), dispersão de sementes, colheita e plantio funcionam', () => {
  assert.equal(FLOWER_POLLEN_PER_VISIT, 0.10);

  // 1. Flor com 0% de pólen entra em fase de semente e dispersa um broto no solo natural antes de murchar
  const simCtx = {
    campusFlowers: [],
    flowerHitMeshes: [],
    beehives: [],
    pastureBees: [],
    pickableItems: [],
    heldItem: null,
    callbacks: { onToast() {}, onHoldChange() {} }
  };
  const f1 = createCampusFlower(simCtx, 25.0, 26.5, 0, {
    stage: 'blooming',
    pollen: 1.0,
    seedHoldDuration: 10,
    wiltDuration: 2
  });
  simCtx.campusFlowers.push(f1);

  for (let v = 0; v < 10; v++) {
    f1.pollen = Math.max(0, Math.round((f1.pollen - FLOWER_POLLEN_PER_VISIT) * 100) / 100);
  }
  assert.equal(f1.pollen, 0);

  stepCampusFlowers(simCtx, 0.1, 1);
  assert.equal(f1.stage, 'seeding');
  assert.equal(getFlowerInspectInfo(f1).pollenPct, 0);

  stepCampusFlowers(simCtx, 10.5, 12);
  assert.equal(f1.stage, 'wilting');
  const sprout = simCtx.campusFlowers.find((f) => f !== f1 && f.stage === 'sprouting');
  assert.ok(sprout, 'deve brotar uma nova flor ao redor após a fase de semente sem colheita');

  stepCampusFlowers(simCtx, 2.5, 15);
  assert.equal(f1.removed, true);
  assert.equal(simCtx.campusFlowers.includes(f1), false);

  // 2. Colher a semente manualmente impede a dispersão e entrega Sementes de Flor ao jogador
  const f2 = createCampusFlower(simCtx, 26.2, 27.0, 1, {
    stage: 'blooming',
    pollen: 0,
    seedHoldDuration: 10,
    wiltDuration: 2
  });
  simCtx.campusFlowers.push(f2);
  stepCampusFlowers(simCtx, 0.1, 16);
  assert.equal(f2.stage, 'seeding');

  const countBeforeHarvest = simCtx.campusFlowers.length;
  assert.equal(interactFlower(simCtx, f2), true);
  assert.equal(f2.seedHarvested, true);
  assert.equal(f2.stage, 'wilting');
  assert.ok(simCtx.heldItem && simCtx.heldItem.flowerSeedCtrl);
  assert.equal(simCtx.heldItem.flowerSeedCtrl.count, 1);

  stepCampusFlowers(simCtx, 12.0, 28);
  assert.equal(f2.removed, true);
  assert.equal(simCtx.campusFlowers.length, countBeforeHarvest - 1, 'flor com semente colhida não deve gerar broto extra');

  // 3. Plantar a semente na grama cria um broto e consome o pacote quando zera
  assert.equal(plantFlowerSeedAtSpot(simCtx, { x: 24.5, y: 0, z: 27.5 }), true);
  assert.equal(simCtx.heldItem, null);
  assert.ok(simCtx.campusFlowers.some((f) => f.stage === 'sprouting' && Math.hypot(f.x - 24.5, f.z - 27.5) < 0.05));

  // 4. Sementes de flor estão na loja
  const shopEntry = SHOP_SUPPLIES.find((s) => s.id === 'sup_flower_seeds');
  assert.ok(shopEntry);
  assert.equal(shopEntry.prefabId, 'flower_seeds');
});
