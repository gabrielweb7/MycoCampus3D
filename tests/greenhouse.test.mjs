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
  restoreGreenhouseOptimal,
  triggerGreenhouseMistPulse,
  triggerGreenhouseVentPulse,
  isHoldingColonizedSpawn
} = await import('../js/world/greenhouse.js');
const { computeOutsideWeatherConditions } = await import('../js/engine/environment.js');

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
