import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Group, MathUtils } from '../js/vendor/three.bundle.min.js';

globalThis.window = globalThis.window || {
  THREE: {
    MathUtils,
    Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } },
    Box3: class {},
    Quaternion: class {},
    MeshStandardMaterial: class { constructor(opts = {}) { Object.assign(this, opts); this.userData = {}; } },
    MeshBasicMaterial: class { constructor(opts = {}) { Object.assign(this, opts); this.userData = {}; } },
    BoxGeometry: class { constructor() { this.userData = {}; } },
    SphereGeometry: class { constructor() { this.userData = {}; } },
    CylinderGeometry: class { constructor() { this.userData = {}; } }
  }
};

const {
  greenhouseSlots,
  greenhouseEnv,
  stepGreenhouse,
  applyGreenhouseAutomationSettings,
  restoreGreenhouseOptimal,
  triggerGreenhouseMistPulse,
  triggerGreenhouseVentPulse,
  isHoldingColonizedSpawn
} = await import('../js/world/greenhouse.js');
const { computeOutsideWeatherConditions } = await import('../js/engine/environment.js');
const {
  interactMonotub,
  stepMonotubs,
  updateMonotubVisual,
  applyMonotubCasing,
  dunkMonotubAtSink,
  MONOTUB_MAX_FLUSHES
} = await import('../js/items/monotub.js');
const {
  gardenState,
  gardenPlants,
  interactGardenTarget
} = await import('../js/world/campus-garden.js');
const { formatHoverInfo } = await import('../js/entities/hover-3d-badge.js');
const { breakAndShakeSpawn } = await import('../js/items/spawn-containers.js');
const {
  interactAlcoholLamp,
  analyzeSpecimenForMicroscope,
  interactSilicaStorageJar
} = await import('../js/items/lab-advanced-tools.js');
const {
  packDriedMushroomsIntoBag,
  sealMushroomBag,
  addSealedBagToDeliveryCrate,
  interactRoadsideStand,
  stepRoadsideMushroomSales,
  roadStandState,
  getLocalMycoCoins
} = await import('../js/items/dehydration-packaging.js');

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
    targetHumidity: 90,
    targetCo2: 650,
    targetTempC: 23.0,
    lightOn: true
  });
  assert.equal(greenhouseEnv.autoMode, true);
  assert.equal(greenhouseEnv.targetHumidity, 90);

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

test('simulação de estresse biológico detecta excesso de umidade, secura, excesso de FAE, CO2 alto, calor e frio e recupera no Auto', () => {
  const noopCtx = { queueWorldStateChange: () => {} };

  // 1. Excesso de umidade (>95.5%)
  applyGreenhouseAutomationSettings({ autoMode: false, humidifierPower: 3, exhaustPower: 0, coolerActive: true, targetTempC: 23.0, lightOn: true });
  greenhouseEnv.humidity = 98;
  greenhouseEnv.co2Ppm = 650;
  greenhouseEnv.tempC = 23.0;
  stepGreenhouse(noopCtx, 1.0);
  assert.equal(greenhouseEnv.primaryStress, 'excess_humidity');
  assert.ok(greenhouseSlots[0].health < 100);

  // 2. Baixa umidade (<74%)
  greenhouseEnv.humidity = 65;
  stepGreenhouse(noopCtx, 1.0);
  assert.equal(greenhouseEnv.primaryStress, 'low_humidity');

  // 3. Excesso de FAE (exaustor forte + CO2 baixo + umidade <86%)
  applyGreenhouseAutomationSettings({ autoMode: false, humidifierPower: 0, exhaustPower: 2, coolerActive: true, targetTempC: 23.0, lightOn: true });
  greenhouseEnv.humidity = 82;
  greenhouseEnv.co2Ppm = 430;
  stepGreenhouse(noopCtx, 1.0);
  assert.equal(greenhouseEnv.primaryStress, 'excess_fae');

  // 4. CO2 alto (>1100 ppm)
  applyGreenhouseAutomationSettings({ autoMode: false, humidifierPower: 1, exhaustPower: 0 });
  greenhouseEnv.humidity = 89;
  greenhouseEnv.co2Ppm = 1400;
  stepGreenhouse(noopCtx, 1.0);
  assert.equal(greenhouseEnv.primaryStress, 'high_co2');

  // 5. Muito calor (>27°C)
  greenhouseEnv.co2Ppm = 650;
  greenhouseEnv.tempC = 29.0;
  greenhouseEnv.coolerActive = false;
  stepGreenhouse(noopCtx, 1.0);
  assert.equal(greenhouseEnv.primaryStress, 'heat_stress');

  // 6. Muito frio (<17.5°C)
  applyGreenhouseAutomationSettings({ autoMode: false, coolerActive: true, targetTempC: 15.0 });
  greenhouseEnv.tempC = 15.5;
  stepGreenhouse(noopCtx, 1.0);
  assert.equal(greenhouseEnv.primaryStress, 'cold_stress');

  // 6b. Múltiplos diagnósticos simultâneos no mesmo bolo
  applyGreenhouseAutomationSettings({ autoMode: false, humidifierPower: 3, exhaustPower: 0, coolerActive: false, lightOn: false });
  greenhouseEnv.humidity = 98;
  greenhouseEnv.co2Ppm = 1450;
  greenhouseEnv.tempC = 29.0;
  stepGreenhouse(noopCtx, 1.0);
  assert.ok(greenhouseSlots[0].stressReasons.includes('Muito calor'));
  assert.ok(greenhouseSlots[0].stressReasons.includes('Excesso de umidade'));
  assert.ok(greenhouseSlots[0].stressReasons.includes('CO₂ alto (pouco FAE)'));
  assert.ok(greenhouseSlots[0].stressReasons.includes('Sem luz LED Grow'));
  assert.ok(greenhouseSlots[0].stressReasons.length >= 4);

  // 7. Restaurar ideal recupera saúde dos bolos
  const healthBeforeHeal = greenhouseSlots[0].health;
  restoreGreenhouseOptimal(noopCtx);
  greenhouseEnv.humidity = 90;
  greenhouseEnv.co2Ppm = 650;
  greenhouseEnv.tempC = 23.0;
  for (let i = 0; i < greenhouseSlots.length; i++) {
    if (!greenhouseSlots[i].empty) greenhouseSlots[i].humidity = 90;
  }
  stepGreenhouse(noopCtx, 2.0);
  assert.equal(greenhouseEnv.primaryStress, 'none');
  assert.ok(greenhouseSlots[0].health > healthBeforeHeal);
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

  const mp = fs.readFileSync('api/multiplayer.php', 'utf8');
  assert.ok(mp.includes("sKey === 'greenhouse_temp'"), 'multiplayer.php deve sanitizar greenhouse_temp sem virar 0/1');
  assert.ok(mp.includes("sKey === 'greenhouse_target_temp'"), 'multiplayer.php deve sanitizar greenhouse_target_temp');
  assert.ok(mp.includes("greenhouse_slot_([0-9]|1[0-9]|2[0-3])_humidity"), 'multiplayer.php deve sanitizar umidade dos 24 slots');
});

test('sensor de Porta da Estufa aberta derruba umidade, altera temperatura conforme clima externo, dispara beep após 10s e normaliza ao fechar', () => {
  const sunnyNoon = computeOutsideWeatherConditions(1.0, 'clear');
  const coldSnow = computeOutsideWeatherConditions(-0.8, 'snow');
  assert.ok(sunnyNoon.tempC > 27.5, 'dia de sol deve ter temperatura externa quente');
  assert.ok(sunnyNoon.humidity < 50, 'dia de sol deve ter umidade externa mais seca');
  assert.ok(coldSnow.tempC < 5.0, 'neve deve ter temperatura externa fria');

  restoreGreenhouseOptimal({ queueWorldStateChange: () => {} });
  greenhouseEnv.humidity = 90.0;
  greenhouseEnv.tempC = 23.0;
  greenhouseEnv.co2Ppm = 650;

  let beepCount = 0;
  const toasts = [];
  globalThis.window.MycoAudio = {
    playGreenhouseDoorBeep: () => { beepCount++; }
  };

  const estufaDoor = { label: 'Porta da Estufa', open: true };
  const simCtx = {
    outsideTempC: sunnyNoon.tempC,
    outsideHumidity: sunnyNoon.humidity,
    weatherMode: 'clear',
    campusDoors: [estufaDoor],
    playerPos: { x: 19, y: 0.14, z: 8 },
    callbacks: { onToast: (msg) => toasts.push(msg) },
    queueWorldStateChange: () => {}
  };

  // Primeiros 5s de porta aberta: umidade já cai e temperatura sobe, mas alarme ainda não toca (<10s)
  for (let i = 0; i < 5; i++) stepGreenhouse(simCtx, 1.0);
  assert.equal(greenhouseEnv.doorOpen, true);
  assert.equal(greenhouseEnv.doorAlarmActive, false);
  assert.equal(beepCount, 0);
  assert.ok(greenhouseEnv.humidity < 85.0, 'umidade deve cair com a porta aberta no sol');
  assert.ok(greenhouseEnv.tempC > 24.5, 'temperatura deve subir com calor externo e porta aberta');

  // Mais 6s (total 11s >= 10s): alarme sonoro dispara e diagnóstico acusa Porta aberta
  for (let i = 0; i < 6; i++) stepGreenhouse(simCtx, 1.0);
  assert.equal(greenhouseEnv.doorAlarmActive, true);
  assert.ok(beepCount >= 1, 'deve emitir beep sonoro quando porta fica aberta >= 10s');
  assert.ok(toasts.some((t) => t.includes('ALARME ESTUFA')));
  assert.ok(greenhouseSlots[0].stressReasons.includes('Porta aberta'));

  // No frio extremo lá fora com porta aberta, temperatura esfria
  simCtx.outsideTempC = coldSnow.tempC;
  simCtx.outsideHumidity = coldSnow.humidity;
  simCtx.weatherMode = 'snow';
  const tempBeforeCold = greenhouseEnv.tempC;
  for (let i = 0; i < 6; i++) stepGreenhouse(simCtx, 1.0);
  assert.ok(greenhouseEnv.tempC < tempBeforeCold - 4.0, 'temperatura da estufa deve cair com frio externo e porta aberta');

  // Fechar a porta silencia o alarme e o modo automático normaliza umidade e temperatura
  estufaDoor.open = false;
  const humWhenOpen = greenhouseEnv.humidity;
  const tempWhenCold = greenhouseEnv.tempC;
  for (let i = 0; i < 12; i++) stepGreenhouse(simCtx, 1.0);
  assert.equal(greenhouseEnv.doorOpen, false);
  assert.equal(greenhouseEnv.doorAlarmActive, false);
  assert.equal(greenhouseEnv.doorOpenSec, 0);
  assert.ok(toasts.some((t) => t.includes('Porta da Estufa fechada')));
  assert.ok(greenhouseEnv.humidity > humWhenOpen + 8.0, 'automação deve recuperar a umidade após fechar a porta');
  assert.ok(greenhouseEnv.tempC > tempWhenCold + 3.0, 'climatizador deve recuperar a temperatura após fechar a porta');
});

test('Monotub 24L exige misturar antes de nivelar, frutifica até 4 flushs sob LED, vira bolo seco e aduba a Horta de Alfaces e Tomates', () => {
  const tub = {
    id: 'monotub_test_24l',
    label: 'Caixa Monotub 24L',
    sanitizedUntil: Date.now() + 60000,
    mesh: { position: { x: 21.2, y: 0.94, z: -6.2 } },
    monotubCtrl: {
      lidOpen: false,
      boxSanitized: true,
      hasSpawn: false,
      hasBulk: false,
      mixed: false,
      leveled: false,
      colonization: 0,
      onLedRack: false,
      fruitingStage: 0,
      growth: 0,
      flush: 1,
      contaminated: false,
      contamReason: '',
      spent: false,
      speciesName: '',
      asepticScore: 1.0,
      updateVisual: () => updateMonotubVisual(tub)
    }
  };

  const toasts = [];
  const ctx = {
    heldItem: null,
    wearingGloves: true,
    glovesExpired: false,
    pickableItems: [tub],
    callbacks: {
      onToast: (m) => toasts.push(m),
      onHoldChange: () => {},
      onHarvestGreenhouse: () => {}
    },
    notifyWorldAction: () => {}
  };

  // 1. Abrir a tampa
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.lidOpen, true);

  // 2. Adicionar Spawn Colonizado
  ctx.heldItem = {
    label: 'Bag 1,5kg Spawn (100% Colonizado)',
    meta: { compatibilities: {} },
    spawnCtrl: {
      filled: true,
      colonized: true,
      contaminated: false,
      burned: false,
      expired: false,
      speciesName: 'Golden Teacher',
      updateVisual: () => {}
    }
  };
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.hasSpawn, true);
  assert.equal(tub.monotubCtrl.speciesName, 'Golden Teacher');

  // 3. Tentar nivelar antes de adicionar substrato e misturar -> bloqueado!
  ctx.heldItem = null;
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.leveled, false, 'não pode nivelar antes de misturar spawn + substrato');

  // 4. Adicionar Substrato Pasteurizado (Vermiculita + Pó de Coco)
  ctx.heldItem = {
    label: 'Bag 1,5kg Substrato (Coco + Vermiculita • Pasteurizado)',
    meta: { compatibilities: {} },
    spawnCtrl: {
      filled: true,
      substrateKind: 'coco_verm',
      pasteurized: true,
      sterilized: true,
      inoculated: false,
      contaminated: false,
      burned: false,
      updateVisual: () => {}
    }
  };
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.hasBulk, true);

  // 5. Misturar Spawn + Substrato
  ctx.heldItem = null;
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.mixed, true);
  assert.equal(tub.monotubCtrl.leveled, false);

  // Cliques repetidos não podem pular a animação.
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.leveled, false);
  stepMonotubs(ctx, 1);

  // 6. Nivelar o bolo (agora permitido pois já misturou!)
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.leveled, true);

  // 7. Fechar a tampa e colonizar até 100%
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.lidOpen, true);
  stepMonotubs(ctx, 1);
  interactMonotub(ctx, tub);
  assert.equal(tub.monotubCtrl.lidOpen, false);
  for (let i = 0; i < 30; i++) stepMonotubs(ctx, 1.0);
  assert.equal(tub.monotubCtrl.colonization, 100);

  // 8. Levar para a Estante Exclusiva de Monotubes com Luz LED embaixo da prateleira
  tub.mesh.position = { x: 15.3, y: 0.48, z: -3.8 };
  for (let f = 1; f <= MONOTUB_MAX_FLUSHES; f++) {
    for (let s = 0; s < 75; s++) stepMonotubs(ctx, 1.0);
    assert.equal(tub.monotubCtrl.onLedRack, true);
    assert.equal(tub.monotubCtrl.fruitingStage, 3, `deve amadurecer no Flush ${f}/4 sob a luz LED`);
    assert.equal(tub.monotubCtrl.flush, f);
    ctx.heldItem = tub;
    interactMonotub(ctx, tub);
    assert.equal(tub.monotubCtrl.fruitingStage, 3, 'mão ocupada não consome a colheita');
    ctx.heldItem = null;
    interactMonotub(ctx, tub); // Colhe o flush f
  }

  // 9. Após o 4º Flush, o bolo fica Seco/Esgotado (spent = true)
  assert.equal(tub.monotubCtrl.spent, true, 'após 4 flushs o bolo deve ficar seco/esgotado');
  assert.ok(tub.label.includes('Bolo Seco Esgotado'));

  // 10. Levar o Monotub com Bolo Seco Esgotado para a Caixa de Substrato da Horta
  const prevCompost = gardenState.compostCakes;
  ctx.heldItem = tub;
  gardenPlants.push({
    id: 'lettuce_test',
    kind: 'lettuce',
    name: 'Pé de Alface Crespa Orgânica',
    stage: 1,
    growth: 70,
    group: {},
    foliageGroup: { scale: { set: () => {} } }
  });
  interactGardenTarget(ctx, { type: 'compost_box' });
  assert.equal(gardenState.compostCakes, prevCompost + 1, 'deve incrementar bolos compostados na Caixa de Substrato da Horta');
  assert.equal(tub.monotubCtrl.spent, false, 'deve esvaziar o Monotub 24L ao despejar o bolo na Caixa de Substrato da Horta');
  assert.equal(tub.monotubCtrl.hasSpawn, false);
  assert.equal(gardenPlants[0].stage, 2, 'adubo micelial deve fazer a alface amadurecer na Horta');

  // Colher a Alface madura na Horta
  const prevHarv = gardenState.totalHarvested;
  interactGardenTarget(ctx, { type: 'plant', plant: gardenPlants[0] });
  assert.equal(gardenState.totalHarvested, prevHarv + 1);
});

test('formatHoverInfo: deduplica nome repetido do item no action e preserva variation selector de emoji colorido', () => {
  const info = formatHoverInfo('🗄️ Abrir Armário de 2 Alturas', { label: 'Armário de 2 Alturas' });
  assert.ok(info);
  assert.ok(info.title.includes('\uFE0F'), 'deve preservar \\uFE0F para emoji colorido no iOS/Android');
  assert.equal(info.action, 'Abrir', 'não deve repetir o título Armário de 2 Alturas na linha de ação');

  const mush = formatHoverInfo('🍄 Colher Cantarelo Dourado (Cantharellus cibarius) (+25 XP • +1 Cogu)', {
    label: 'Cantarelo Dourado (Cantharellus cibarius)'
  });
  assert.ok(mush);
  assert.equal(mush.title, '🍄 Cantarelo Dourado');
  assert.equal(mush.params, 'Cantharellus cibarius • +25 XP • +1 Cogu');
  assert.equal(mush.action, 'Colher');
});

test('10 Novas Mecânicas de Imersão: Break & Shake, Flambagem na Lamparina, Microscópio 1000x, Casing, Dunk e Pote c/ Sílica Gel', () => {
  // 1. Break & Shake em spawn 35% colonizado
  const jar = {
    label: 'Vidro 800ml (Milho)',
    mesh: { rotation: { z: 0 } },
    spawnCtrl: {
      baseLabel: 'Vidro 800ml (Milho)',
      inoculated: true,
      colonized: false,
      contaminated: false,
      burned: false,
      expired: false,
      colonization: 35,
      shaken: false,
      generation: 3,
      updateVisual: () => {}
    }
  };
  const ctx = {
    heldItem: jar,
    pickableItems: [],
    callbacks: { onToast: () => {}, onHoldChange: () => {} },
    notifyWorldAction: () => {}
  };
  assert.equal(breakAndShakeSpawn(ctx, jar), true);
  assert.equal(jar.spawnCtrl.shaken, true);
  assert.equal(jar.spawnCtrl.colonization, 43);

  // 2. Flambagem de Bisturi contaminado na Lamparina a Álcool
  const lamp = {
    label: 'Lamparina a Álcool',
    alcoholLampCtrl: { lit: true, flamePhase: 0, updateVisual: () => {} }
  };
  const scalpel = {
    label: 'Bisturi Cirúrgico',
    scalpelCtrl: {
      hasBlade: true,
      sterile: false,
      bladeContaminated: true,
      cutContaminated: true,
      hasMycelium: true
    }
  };
  ctx.heldItem = scalpel;
  assert.equal(interactAlcoholLamp(ctx, lamp), true);
  assert.equal(scalpel.scalpelCtrl.sterile, true, 'flambar na chama deve re-esterilizar 100% a lâmina #24');
  assert.equal(scalpel.scalpelCtrl.bladeContaminated, false);
  assert.equal(scalpel.scalpelCtrl.hasMycelium, false);

  // 3. Análise no Microscópio Óptico 1000x (T3 Elite e detecção precoce de contaminante)
  const cleanT3 = analyzeSpecimenForMicroscope(jar);
  assert.equal(cleanT3.status, 'rhizomorphic');
  assert.equal(cleanT3.generation, 3);

  const secretContamPetri = {
    label: 'Placa de Petri [Golden Teacher]',
    mesh: {
      userData: {
        petriCtrl: {
          mode: 'colonizing',
          colonization: 18,
          delayedContamAtPct: 42,
          generation: 1
        }
      }
    }
  };
  const earlyAlert = analyzeSpecimenForMicroscope(secretContamPetri);
  assert.equal(earlyAlert.status, 'contaminated', 'microscópio 1000x deve detectar endósporos ocultos antes de aparecer a olho nu');

  // 4. Camada de Casing + Cold Shock / Dunk no Monotub 24L
  const tub = {
    id: 'tub_adv',
    label: 'Caixa Monotub 24L',
    mesh: { position: { x: 0, y: 0, z: 0 } },
    monotubCtrl: {
      colonization: 100,
      hasCasing: false,
      humidity: 72,
      flush: 2,
      spent: false,
      contaminated: false,
      updateVisual: () => {}
    }
  };
  assert.equal(applyMonotubCasing(ctx, tub), true);
  assert.equal(tub.monotubCtrl.hasCasing, true);
  assert.equal(dunkMonotubAtSink(ctx, tub), true);
  assert.equal(tub.monotubCtrl.humidity, 99);

  // 5. Pote Hermético com Sílica Gel guardando lote de 25g de cogumelos crocantes
  const silicaJar = {
    id: 'silica_test',
    label: 'Pote Hermético',
    silicaJarCtrl: {
      storedGrams: 25,
      capacityGrams: 150,
      speciesName: 'Golden Teacher',
      hasSilicaPacket: true,
      updateVisual: () => {}
    }
  };
  const driedBatch = {
    id: 'dried_25',
    label: '25g Cogumelos Crocantes',
    mesh: {},
    driedMushroomCtrl: { grams: 25, speciesName: 'Golden Teacher' }
  };
  ctx.heldItem = driedBatch;
  ctx.pickableItems = [silicaJar, driedBatch];
  assert.equal(interactSilicaStorageJar(ctx, silicaJar), true);
  assert.equal(silicaJar.silicaJarCtrl.storedGrams, 50);
  assert.equal(ctx.heldItem, null, 'lote desidratado deve entrar no pote hermético');

  silicaJar.silicaJarCtrl.storedGrams = 145;
  ctx.heldItem = driedBatch;
  assert.equal(interactSilicaStorageJar(ctx, silicaJar), true);
  assert.equal(silicaJar.silicaJarCtrl.storedGrams, 145);
  assert.equal(ctx.heldItem, driedBatch, 'lote inteiro permanece disponível se não couber');

  // 6. Sala de Desidratação -> Saco Mylar -> Seladora Térmica -> Caixa de Entrega -> Drive-Thru de Venda na Estrada c/ Carro e NPC!
  const packBag = {
    id: 'mushroom_pack_bag_test',
    label: 'Saco Mylar Vazio',
    mesh: {},
    mushroomBagCtrl: {
      filled: false,
      sealed: false,
      grams: 0,
      speciesName: '',
      updateVisual: () => {}
    }
  };
  const batch2 = {
    id: 'dried_25_b',
    label: '25g Cogumelos Crocantes',
    mesh: {},
    driedMushroomCtrl: { grams: 25, speciesName: 'Golden Teacher' }
  };
  ctx.heldItem = batch2;
  ctx.pickableItems = [packBag, batch2];
  assert.equal(packDriedMushroomsIntoBag(ctx, packBag, batch2), true);
  assert.equal(packBag.mushroomBagCtrl.filled, true);
  assert.equal(packBag.mushroomBagCtrl.sealed, false);

  assert.equal(sealMushroomBag(ctx, packBag), true);
  assert.equal(packBag.mushroomBagCtrl.sealed, true);

  const crate = {
    id: 'crate_test',
    label: 'Caixa de Entrega',
    deliveryCrateCtrl: {
      packsCount: 0,
      updateVisual: () => {}
    }
  };
  assert.equal(addSealedBagToDeliveryCrate(ctx, crate, packBag), true);
  assert.equal(crate.deliveryCrateCtrl.packsCount, 1);

  ctx.heldItem = crate;
  roadStandState.availablePacks = 0;
  assert.equal(interactRoadsideStand(ctx), true);
  assert.equal(roadStandState.availablePacks, 1);
  assert.equal(crate.deliveryCrateCtrl.packsCount, 0);

  // Simula carro de NPC vindo na estrada quando há cogumelo disponível, descendo, pagando MycoCoins e indo embora
  roadStandState.actor = {
    carGroup: { position: { x: -48, y: 0.04, z: 39.5, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { y: 0 }, visible: false },
    bodyMat: { color: { setHex: () => {} } },
    npcGroup: { position: { x: 11.5, y: 0.04, z: 38.6, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { y: 0 }, visible: false },
    shirtMat: { color: { setHex: () => {} } },
    hatMat: { color: { setHex: () => {} } },
    avatar: { headGroup: new Group(), leftLeg: new Group(), rightLeg: new Group(), leftArm: new Group(), rightArm: new Group() },
    heldPack: new Group(),
    cashGroup: { position: { y: 0 }, rotation: { y: 0 }, visible: false }
  };
  roadStandState.npcSpawnCooldown = 0.1;
  roadStandState.activeNpcOrder = null;
  const coinsBefore = getLocalMycoCoins();

  const seen = new Set();
  for (let s = 0; s < 360; s++) {
    stepRoadsideMushroomSales(ctx, 0.1);
    const phase = roadStandState.activeNpcOrder?.phase;
    seen.add(phase);
    if (phase === 'examining') {
      assert.equal(roadStandState.availablePacks, 1);
      assert.equal(roadStandState.actor.npcGroup.rotation.y, 0);
    }
    if (phase === 'walking_to_car') {
      assert.equal(roadStandState.actor.npcGroup.rotation.y, Math.PI);
      assert.equal(roadStandState.actor.heldPack.visible, true);
    }
  }
  assert.ok(seen.has('examining') && seen.has('paying') && seen.has('walking_to_car'));
  assert.equal(roadStandState.availablePacks, 0, 'NPC deve ter comprado o pacote de cogumelos desidratados');
  assert.ok(getLocalMycoCoins() >= coinsBefore + 120, 'NPC deve ter pago +120 MycoCoins');
});

test('Horta garden_plants serializa/restaura estágios e applySyncedBurnerTimer sincroniza contagem pelo servidor', async () => {
  const {
    serializeGardenPlants,
    applySerializedGardenPlants,
    applyGardenWorldState
  } = await import('../js/world/campus-garden.js');
  const { applySyncedBurnerTimer } = await import('../js/items/pressure-cooker.js');

  const plants = [
    { stage: 0, growth: 12, kind: 'lettuce', foliageGroup: { scale: { set() {} } } },
    { stage: 2, growth: 88, kind: 'tomato', foliageGroup: { scale: { set() {} } }, fruits: [] }
  ];
  const serialized = serializeGardenPlants(plants);
  assert.equal(serialized, '0:12,2:88');
  assert.equal(applySerializedGardenPlants('1:55,0:4', plants), true);
  assert.equal(plants[0].stage, 1);
  assert.equal(plants[0].growth, 55);
  assert.equal(plants[1].stage, 0);
  applyGardenWorldState({ garden_compost: '3', garden_richness: '80', garden_plants: '2:0,1:40' });

  const mockBurner = {
    kind: 'electric',
    on: true,
    timerPresetMin: 0,
    timerRemainingSec: 0,
    timerCanvas: { width: 256, height: 64 },
    timerCtx: new Proxy({}, { get: () => () => {} }),
    timerTex: { needsUpdate: false }
  };
  applySyncedBurnerTimer(mockBurner, 60, 1000 + 125, 1000);
  assert.equal(mockBurner.timerPresetMin, 60);
  assert.equal(mockBurner.timerRemainingSec, 125);
});
