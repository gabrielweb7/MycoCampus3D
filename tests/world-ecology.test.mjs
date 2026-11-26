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
  PASTURE_TROUGH_POS,
  HERD_MIGRATION_LEG_SEC,
  HERD_MIGRATION_ROUTE,
  isCowPositionWalkable,
  findSafePasturePoint,
  getHerdRouteIndex,
  petCow,
  stepPastureCows,
  isBeeBlockedAt3D,
  moveBeeSafely,
  FLOWER_POLLEN_PER_VISIT,
  createCampusFlower,
  stepCampusFlowers,
  interactFlower,
  getFlowerInspectInfo,
  plantFlowerSeedAtSpot,
  findNearestHiveMountSpot,
  createHiveAtSpot,
  serializeBeehives,
  serializeCampusFlowers,
  applyBeeEcologyWorldState,
  extinguishHiveColony,
  startHiveMigration,
  stepPastureBees,
  makeStarterBeehiveItem,
  makeBeeBaitItem,
  getBeeEcologySummary
} = await import('../js/entities/pasture-cows.js');
const { separateHiveBees } = await import('../js/entities/bee-navigation.js');
const { findHoveredBeehive, getBeehiveHoverPrompt, interactBeehive } = await import('../js/entities/bee-ecology.js');
const { findHoveredFlower } = await import('../js/world/campus-flowers.js');
const { updateCelestialSkyDome } = await import('../js/engine/sky-constellations.js');
const {
  triggerRareBlackGnomeAppearance,
  clearRareBlackGnomeForTest,
  getRareBlackGnomeTelemetry
} = await import('../js/world/trip-gnomes.js');
const { collectEcologyTelemetrySnapshot } = await import('../js/world/ecology-station.js');
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

  const modelSrc = fs.readFileSync(path.resolve('js/entities/bee-models.js'), 'utf8');
  const navigationSrc = fs.readFileSync(path.resolve('js/entities/bee-navigation.js'), 'utf8');
  assert.match(modelSrc, /depthTest:\s*true/);
  assert.match(navigationSrc, /migrationSprite\.visible\s*=\s*dist\s*<=\s*18/);

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

test('abelhas não atravessam obstáculos ao se separar nem ao tentar subir em um corredor fechado', () => {
  const { Vector3 } = globalThis.window.THREE;
  const hive = {};
  const nearWall = { hive, group: { visible: true, position: new Vector3(3.80, 2, 0), rotation: {} } };
  const neighbor = { hive, group: { visible: true, position: new Vector3(3.60, 2, 0), rotation: {} } };
  const ctx = {
    pastureBees: [nearWall, neighbor],
    solidColliders: [{ minX: 4, maxX: 6, minZ: -5, maxZ: 5, minY: 0, maxY: 3.5 }]
  };
  separateHiveBees(ctx);
  assert.equal(nearWall.group.position.x, 3.80);
  assert.ok(neighbor.group.position.x < 3.60);

  ctx.solidColliders.push(
    { minX: 2, maxX: 3.6, minZ: -5, maxZ: 5, minY: 0, maxY: 3.5 },
    { minX: 2, maxX: 6, minZ: -5, maxZ: -0.2, minY: 0, maxY: 3.5 },
    { minX: 2, maxX: 6, minZ: 0.2, maxZ: 5, minY: 0, maxY: 3.5 },
    { minX: 2, maxX: 6, minZ: -5, maxZ: 5, minY: 2.26, maxY: 3.5 }
  );
  moveBeeSafely(ctx, nearWall, 5, 2, 0, 3, 0.1);
  const { x, y, z } = nearWall.group.position;
  assert.equal(isBeeBlockedAt3D(ctx, x, y, z, 0.15), false);
});

test('mira ignora colmeias invisíveis e flores murchando para alcançar alvos válidos atrás', () => {
  const hiddenHive = { group: { visible: false } };
  const visibleHive = { group: { visible: true } };
  const wiltedFlower = { stage: 'wilting' };
  const liveFlower = { stage: 'seeding' };
  const mesh = (key, value) => ({ userData: { [key]: value } });
  const ctx = {
    beehiveHitMeshes: [mesh('hiveObj', hiddenHive), mesh('hiveObj', visibleHive)],
    flowerHitMeshes: [mesh('flowerObj', wiltedFlower), mesh('flowerObj', liveFlower)]
  };
  const raycaster = {
    intersectObjects: (objects) => objects.map((object, i) => ({ object, distance: 1 + i }))
  };
  assert.equal(findHoveredBeehive(raycaster, ctx), visibleHive);
  assert.equal(ctx.hoverHit.distance, 2);
  assert.equal(findHoveredFlower(raycaster, ctx), liveFlower);
  assert.equal(ctx.hoverHit.distance, 2);
});

test('colher mel preserva a colmeia com recipiente cheio e exibe a quantidade que coube', () => {
  const messages = [];
  const synced = [];
  const hive = { honeyLevel: 80, buildProgress: 1 };
  const liquidCtrl = { maxMl: 800, volMl: 800 };
  const heldItem = { mesh: { userData: { liquidCtrl } } };
  const ctx = {
    heldItem,
    callbacks: { onToast: (message) => messages.push(message) },
    queueItemStateSync: (item) => synced.push(item)
  };
  assert.match(getBeehiveHoverPrompt(hive, heldItem), /cheio/i);
  assert.equal(interactBeehive(ctx, hive), true);
  assert.equal(hive.honeyLevel, 80);
  assert.equal(synced.length, 0);

  liquidCtrl.volMl = 775;
  assert.equal(interactBeehive(ctx, hive), true);
  assert.equal(liquidCtrl.volMl, 800);
  assert.equal(hive.honeyLevel, 45);
  assert.match(messages.at(-1), /\+25ml/);
  assert.deepEqual(synced, [heldItem]);

  ctx.heldItem = { lcNutrientCtrl: { remainingGrams: 250, maxGrams: 250 } };
  assert.equal(interactBeehive(ctx, hive), true);
  assert.equal(hive.honeyLevel, 45);
  ctx.heldItem.lcNutrientCtrl.remainingGrams = 230;
  assert.equal(interactBeehive(ctx, hive), true);
  assert.equal(ctx.heldItem.lcNutrientCtrl.remainingGrams, 250);
  assert.match(messages.at(-1), /\+20g/);
});

test('ciclo de pólen (10% por visita), dispersão de sementes, colheita e plantio funcionam', () => {
  assert.equal(FLOWER_POLLEN_PER_VISIT, 0.10);

  // 1. Flor com 0% de pólen entra em fase de semente e dispersa um broto no solo natural antes de murchar
  const flowerUpdates = [];
  const simCtx = {
    campusFlowers: [],
    flowerHitMeshes: [],
    beehives: [],
    pastureBees: [],
    pickableItems: [],
    heldItem: null,
    queueWorldStateChange(key, value) {
      if (key === 'campus_flowers') flowerUpdates.push(value);
    },
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
  assert.equal(flowerUpdates.length, 1);
  assert.deepEqual(JSON.parse(flowerUpdates[0]).map((flower) => flower.st), ['wilting', 'sprouting']);

  const restored = { campusFlowers: [] };
  assert.equal(applyBeeEcologyWorldState(restored, { campus_flowers: flowerUpdates[0] }), true);
  stepCampusFlowers(restored, 30, 42);
  assert.equal(restored.campusFlowers.length, 1, 'a flor mãe restaurada não deve dispersar outra semente');

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

test('rota de migração e cocho das vaquinhas ficam 100% em pasto livre e corredores desobstruídos', () => {
  const worldCtx = {
    solidColliders: [
      { minX: 72.7, maxX: 75.3, minZ: 1.45, maxZ: 2.55, minY: 0, maxY: 0.7 }
    ],
    wallSegments: [
      { x1: -26, z1: -43.5, x2: 26, z2: -43.5, minY: 0, maxY: 6, halfThick: 0.25 }
    ]
  };
  assert.notEqual(PASTURE_TROUGH_POS.x, 64);
  assert.notEqual(PASTURE_TROUGH_POS.z, 8);
  assert.equal(isCowPositionWalkable({ solidColliders: [], wallSegments: [] }, PASTURE_TROUGH_POS.x, PASTURE_TROUGH_POS.z, 0.95), true);

  for (let i = 0; i < HERD_MIGRATION_ROUTE.length; i++) {
    const wp = HERD_MIGRATION_ROUTE[i];
    assert.equal(isCowPositionWalkable(worldCtx, wp.x, wp.z, 0.95), true, `waypoint ${wp.name} deve ser caminhável`);
    if (i < HERD_MIGRATION_ROUTE.length - 1) {
      const next = HERD_MIGRATION_ROUTE[i + 1];
      for (let s = 1; s < 25; s++) {
        const t = s / 25;
        const ix = wp.x + (next.x - wp.x) * t;
        const iz = wp.z + (next.z - wp.z) * t;
        assert.equal(
          isCowPositionWalkable(worldCtx, ix, iz, 0.95),
          true,
          `corredor ${wp.name} -> ${next.name} bloqueado no passo ${s}`
        );
      }
    }
  }

  const visited = new Set();
  for (let step = 0; step < HERD_MIGRATION_ROUTE.length * 2; step++) {
    visited.add(getHerdRouteIndex(step * HERD_MIGRATION_LEG_SEC));
  }
  assert.equal(visited.size, HERD_MIGRATION_ROUTE.length);
});

test('vaquinhas migram sem girar paradas perto da parede e escapam de zonas bloqueadas', () => {
  const makeCow = (id, x, z, routeIdx) => {
    const mesh = {
      position: new globalThis.window.THREE.Vector3(x, 0, z),
      rotation: { x: 0, y: 0, z: 0 },
      visible: true
    };
    return {
      id,
      name: id,
      mesh,
      group: mesh,
      head: { rotation: { x: 0, y: 0, z: 0 } },
      legs: Array.from({ length: 4 }, () => ({ rotation: { x: 0, y: 0, z: 0 } })),
      tail: { rotation: { x: 0, y: 0, z: 0 } },
      yaw: 0,
      targetYaw: 0,
      baseSpeed: 1.2,
      speed: 1.2,
      health: 100,
      mood: 'Pastando 🌿',
      state: 'wander',
      routeIdx,
      avoidSide: 1,
      avoidTimer: 0,
      avoidYaw: 0,
      curiousTimer: 0,
      curiousCooldown: 0,
      stuckTimer: 0,
      lastProgressX: x,
      lastProgressZ: z,
      grazeTimer: 0,
      fleeTimer: 0,
      happyTimer: 0,
      lastBucket: -1,
      lastPoopBucket: -1,
      walkPhase: 0
    };
  };

  // Par de vaquinhas coladas atrás da parede da Reitoria + 1 vaquinha presa dentro do Dormitório 1
  const cow0 = makeCow('cow_0', 0.0, -45.2, 4);
  const cow1 = makeCow('cow_1', 1.1, -45.2, 4);
  const cow2 = makeCow('cow_2', 58.0, 12.0, 1);
  const ctx = {
    playerPos: new globalThis.window.THREE.Vector3(0, 0, 14),
    simClockSec: 3 * HERD_MIGRATION_LEG_SEC + 1,
    solidColliders: [
      { minX: 50.5, maxX: 65.5, minZ: 6.5, maxZ: 17.5, minY: 0, maxY: 5 }
    ],
    wallSegments: [
      { x1: -26, z1: -43.5, x2: 26, z2: -43.5, minY: 0, maxY: 6, halfThick: 0.25 }
    ],
    pastureCows: [cow0, cow1, cow2],
    cowPoops: []
  };

  assert.equal(isCowPositionWalkable(ctx, cow2.mesh.position.x, cow2.mesh.position.z, 0.85), false);
  let cow2EscapedStep = -1;
  for (let s = 0; s < 1500; s++) {
    ctx.simClockSec += 0.1;
    stepPastureCows(ctx, 0.1);
    if (cow2EscapedStep === -1 && isCowPositionWalkable(ctx, cow2.mesh.position.x, cow2.mesh.position.z, 0.85)) {
      cow2EscapedStep = s;
    }
    assert.equal(isCowPositionWalkable(ctx, cow0.mesh.position.x, cow0.mesh.position.z, 0.85), true);
    assert.equal(isCowPositionWalkable(ctx, cow1.mesh.position.x, cow1.mesh.position.z, 0.85), true);
  }

  assert.ok(cow2EscapedStep >= 0 && cow2EscapedStep < 120, `vaquinha presa deve escapar rapidamente (passo ${cow2EscapedStep})`);
  const disp0 = Math.hypot(cow0.mesh.position.x - 0.0, cow0.mesh.position.z - (-45.2));
  const disp1 = Math.hypot(cow1.mesh.position.x - 1.1, cow1.mesh.position.z - (-45.2));
  assert.ok(disp0 > 20, `cow_0 deve migrar > 20m (deslocou ${disp0.toFixed(1)}m)`);
  assert.ok(disp1 > 20, `cow_1 deve migrar > 20m (deslocou ${disp1.toFixed(1)}m)`);

  const safePt = findSafePasturePoint(ctx, 0, PASTURE_TROUGH_POS);
  assert.equal(isCowPositionWalkable(ctx, safePt.x, safePt.z, 1.0), true);
  assert.equal(cow0.group, cow0.mesh);
});

test('colmeias e flores persistem em JSON, descansam no chão à noite e podem entrar em extinção', () => {
  const queued = {};
  const ctxA = {
    beehives: [],
    beehiveHitMeshes: [],
    campusFlowers: [],
    flowerHitMeshes: [],
    pastureBees: [],
    pickableItems: [],
    playerPos: { x: 0, y: 0, z: 0 },
    sunElevation: -0.35, // noite
    callbacks: { onToast() {} },
    queueWorldStateChange(k, v) { queued[k] = v; }
  };

  const eavesSpot = findNearestHiveMountSpot(ctxA, 0, 50);
  assert.ok(eavesSpot);
  assert.equal(eavesSpot.mountType, 'eaves');

  const h1 = createHiveAtSpot(ctxA, 'hive_eaves_1', eavesSpot, { honeyLevel: 60, buildProgress: 1.0 });
  const fl1 = createCampusFlower(ctxA, eavesSpot.x + 2, eavesSpot.z + 2, 2, { stage: 'blooming', pollen: 0.7 });
  ctxA.campusFlowers.push(fl1);

  const hivesJson = serializeBeehives(ctxA);
  const flowersJson = serializeCampusFlowers(ctxA);
  assert.ok(hivesJson.includes('hive_eaves_1'));
  assert.ok(hivesJson.includes('"m":"eaves"'));

  // Outro cliente restaura colmeias e flores exatamente a partir do stateMap
  const ctxB = {
    beehives: [],
    beehiveHitMeshes: [],
    campusFlowers: [],
    flowerHitMeshes: [],
    pastureBees: [],
    pickableItems: [],
    callbacks: { onToast() {} }
  };
  assert.equal(applyBeeEcologyWorldState(ctxB, { campus_beehives: hivesJson, campus_flowers: flowersJson }), true);
  assert.equal(ctxB.beehives.length, 1);
  assert.equal(ctxB.beehives[0].mountType, 'eaves');
  assert.equal(ctxB.beehives[0].honeyLevel, 60);
  assert.equal(ctxB.campusFlowers.length, 1);
  assert.equal(Math.round(ctxB.campusFlowers[0].pollen * 100), 70);
  assert.ok(ctxB.pastureBees.length >= 4, 'colmeia ativa restaurada deve ter rainha e operárias');

  // Sem flores disponíveis e falhando migrações à noite -> descansa no chão e depois extingue
  ctxB.campusFlowers.length = 0;
  ctxB.sunElevation = -0.35;
  ctxB.queueWorldStateChange = (k, v) => { queued[k] = v; };
  ctxB.beehives[0].failedMigrations = 1;
  assert.equal(startHiveMigration(ctxB, ctxB.beehives[0], true), false);
  assert.equal(ctxB.beehives[0].groundResting, true);

  for (let s = 0; s < 32; s++) {
    stepPastureBees(ctxB, 1.0);
  }
  assert.equal(ctxB.beehives[0].extinct, true);
  assert.equal(ctxB.beehives[0].abandoned, true);
  assert.equal(ctxB.pastureBees.length, 0);
  assert.equal(getBeeEcologySummary(ctxB).activeHives, 0);
  assert.ok(queued.campus_beehives.includes('"ex":1'));

  // Restaura mundo totalmente extinto em um terceiro cliente (0 abelhas ativas preservadas!)
  const ctxC = { beehives: [], beehiveHitMeshes: [], campusFlowers: [], flowerHitMeshes: [], pastureBees: [], pickableItems: [] };
  applyBeeEcologyWorldState(ctxC, { campus_beehives: queued.campus_beehives, campus_flowers: '[]' });
  assert.equal(getBeeEcologySummary(ctxC).activeHives, 0);
  assert.equal(ctxC.pastureBees.length, 0);
});

test('colmeia comprável no chão e isca migram rápido para árvore/beiral e Estação monitora Gnomo Preto Raro', () => {
  const ctx = {
    beehives: [],
    beehiveHitMeshes: [],
    campusFlowers: [],
    flowerHitMeshes: [],
    pastureBees: [],
    pastureCows: [{ mesh: { position: { x: 70, z: 4 } }, health: 96, happyTimer: 1 }],
    wildMushrooms: [{ active: true }],
    pickableItems: [],
    heldItem: null,
    sunElevation: 0.4,
    callbacks: { onToast() {} }
  };

  // Planta flores perto da vila e do ponto da isca para sustentar as colmeias
  ctx.campusFlowers.push(createCampusFlower(ctx, 3, 56, 0, { stage: 'blooming', pollen: 1.0 }));
  ctx.campusFlowers.push(createCampusFlower(ctx, 25, 27, 1, { stage: 'blooming', pollen: 1.0 }));

  // Compra e coloca Colmeia Inicial perto dos beirais da vila (x=2, z=58)
  const starter = makeStarterBeehiveItem(ctx, 'dyn_hive_starter_1', 2, 0, 58);
  assert.equal(SHOP_SUPPLIES.some((s) => s.id === 'sup_beehive' && s.prefabId === 'beehive_starter'), true);
  assert.equal(SHOP_SUPPLIES.some((s) => s.id === 'sup_bee_bait' && s.prefabId === 'bee_bait'), true);

  for (let i = 0; i < 25; i++) stepPastureBees(ctx, 0.1);
  assert.equal(starter.starterBeehiveCtrl.deployed, true);
  assert.equal(ctx.beehives.length, 1);
  assert.equal(ctx.beehives[0].mountType, 'eaves', 'deve migrar rapidamente para o beiral de casa mais próximo');
  assert.ok(ctx.pastureBees.length >= 4);
  assert.equal(ctx.beehives[0].migrating, true);

  ctx.playerPos = { x: -120, z: -120 };
  for (let i = 0; i < 120; i++) stepPastureBees(ctx, 0.1);
  assert.equal(ctx.beehives[0].migrating, false, 'a rainha deve chegar ao beiral mesmo longe do jogador');
  assert.equal(ctx.beehives[0].buildProgress, 1);
  assert.ok(ctx.pastureBees.every((bee) => !bee.group.visible));
  ctx.playerPos = null;

  // Isca colocada fora atrai novo enxame após tempo de espera
  const bait = makeBeeBaitItem(ctx, 'dyn_bee_bait_1', 24.5, 0, 26.5);
  for (let i = 0; i < 16; i++) stepPastureBees(ctx, 1.0);
  assert.equal(bait.beeBaitCtrl.triggered, true);
  assert.equal(getBeeEcologySummary(ctx).activeHives, 2);

  // Estação Fauna & Flora + Gnomo Preto Estranho Solitário
  clearRareBlackGnomeForTest();
  let snap = collectEcologyTelemetrySnapshot(ctx);
  assert.equal(snap.activeHives, 2);
  assert.equal(snap.cowsCount, 1);
  assert.equal(snap.gnome.active, false);

  triggerRareBlackGnomeAppearance(ctx, 0);
  const tel = getRareBlackGnomeTelemetry();
  assert.equal(tel.active, true);
  assert.ok(typeof tel.distToStation === 'number');
  snap = collectEcologyTelemetrySnapshot(ctx);
  assert.equal(snap.gnome.active, true);
  assert.match(snap.gnome.sector, /Estação|Bosque|Corredor|Lateral|Mata/);
  const liteSnap = collectEcologyTelemetrySnapshot(ctx, { includeRadar: false });
  assert.equal(liteSnap.cowsCount, 1);
  assert.equal(liteSnap.radar.cows.length, 0);
  clearRareBlackGnomeForTest();
});

test('abelhas coletam pólen no entardecer sem travar na colmeia/tronco e mantêm separação', () => {
  const ctx = {
    beehives: [],
    beehiveHitMeshes: [],
    campusFlowers: [],
    flowerHitMeshes: [],
    pastureBees: [],
    pickableItems: [],
    sunElevation: -0.12, // entardecer: antes interrompia a coleta precocemente
    callbacks: { onToast() {} }
  };

  applyBeeEcologyWorldState(ctx, {
    campus_beehives: JSON.stringify([
      { id: 'hive_tree_forage', m: 'tree', x: 24.48, y: 2.55, z: 26, h: 20, bp: 1.0 }
    ]),
    campus_flowers: JSON.stringify([
      { id: 'fl_tree_1', x: 27.2, z: 28.2, ci: 0, st: 'blooming', p: 1.0 }
    ])
  });
  const hive = ctx.beehives[0];
  const fl = ctx.campusFlowers[0];

  for (let i = 0; i < 180; i++) {
    stepPastureBees(ctx, 0.1);
  }

  const workers = ctx.pastureBees.filter((b) => !b.isQueen);
  assert.ok(workers.length >= 3, 'colmeia deve possuir operárias ativas');
  assert.ok(
    fl.pollen < 1.0 || hive.honeyLevel > 20 || workers.some((w) => w.hasPollen || w.state === 'to_flower' || w.state === 'collecting' || w.state === 'to_hive'),
    'operárias devem sair para coletar pólen mesmo no entardecer'
  );

  let minWorkerDist = Infinity;
  for (let i = 0; i < workers.length; i++) {
    const a = workers[i].group.position;
    assert.equal(isBeeBlockedAt3D(ctx, a.x, a.y, a.z, 0.10, null), false, `operária ${i} não deve terminar presa em colisor`);
    for (let j = i + 1; j < workers.length; j++) {
      const b = workers[j].group.position;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d < minWorkerDist) minWorkerDist = d;
    }
  }
  assert.ok(minWorkerDist >= 0.25, `abelhas devem manter separação mínima (observado ${minWorkerDist.toFixed(2)}m)`);
});

test('domo celeste escala para dentro do camera.far mobile mantendo estrelas visíveis', () => {
  const dome = {
    group: {
      visible: false,
      rotation: { y: 0, z: 0 },
      position: {
        x: 0,
        y: 0,
        z: 0,
        set(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        }
      },
      scale: {
        s: 1,
        setScalar(v) {
          this.s = v;
        }
      }
    },
    bgMat: { opacity: 0, size: 1.5 },
    baseBgSize: 1.5,
    conStarMat: { opacity: 0, size: 3.1 },
    baseConSize: 3.1,
    conLineMat: { opacity: 0 }
  };

  updateCelestialSkyDome(dome, 0.92, -0.4, 'clear', 10, { x: 12, y: 2, z: -8 }, 84);
  assert.equal(dome.group.visible, true);
  assert.equal(dome.group.position.x, 12);
  assert.equal(dome.group.position.z, -8);
  assert.ok(dome.group.scale.s < 0.4, `escala mobile deve ficar < 0.4 (recebido ${dome.group.scale.s})`);
  assert.ok(dome.group.scale.s * 204 < 84, 'estrelas e constelações devem caber dentro de camera.far=84');
  assert.ok(dome.bgMat.opacity > 0);
  assert.ok(dome.conStarMat.opacity > 0);
});
