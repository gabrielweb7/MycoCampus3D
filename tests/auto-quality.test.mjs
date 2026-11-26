import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoQualityController, AUTO_BAD_SAMPLES, AUTO_GOOD_SAMPLES, AUTO_PROBE_SAMPLES } from '../js/core/auto-quality.js';

function simulate(initial = { tier: 'high', scale: 1 }) {
  const controller = createAutoQualityController();
  let current = { ...initial };
  let now = 10000;
  const decisions = [];
  return {
    controller, decisions,
    get current() { return current; },
    sample(fps, count, options) {
      for (let i = 0; i < count; i++) {
        now += 1000;
        const result = controller.observe(fps, now, current, options);
        if (result) {
          decisions.push(result);
          if (result.type !== 'save') current = { tier: result.tier, scale: result.scale };
        }
      }
    },
    wait(ms) { now += ms; }
  };
}

test('quedas breves não mudam qualidade; quedas persistentes testam resolução e níveis', () => {
  const sim = simulate();
  sim.sample(20, AUTO_BAD_SAMPLES - 1);
  assert.deepEqual(sim.current, { tier: 'high', scale: 1 });
  sim.sample(55, 1);
  sim.sample(20, AUTO_BAD_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'high', scale: 0.85 });
  sim.sample(21, AUTO_PROBE_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'medium', scale: 1 });
  sim.sample(24, AUTO_PROBE_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'medium', scale: 0.85 });
  sim.sample(26, AUTO_PROBE_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'low', scale: 1 });
  sim.sample(35, AUTO_PROBE_SAMPLES);
  assert.equal(sim.decisions.at(-1).type, 'settle');
  assert.deepEqual(sim.current, { tier: 'low', scale: 1 });
});

test('7 FPS sustentados saltam para Baixo mesmo durante o aquecimento do Auto', () => {
  const sim = simulate();
  sim.sample(7, 2, { warmingUp: true });
  sim.sample(55, 1, { warmingUp: true });
  sim.sample(7, 2, { warmingUp: true });
  assert.deepEqual(sim.current, { tier: 'high', scale: 1 });
  sim.sample(7, 1, { warmingUp: true });
  assert.deepEqual(sim.current, { tier: 'low', scale: 1 });
  assert.equal(sim.decisions.at(-1).type, 'emergency');
  sim.sample(8, 3);
  assert.equal(sim.current.tier, 'low');
  sim.sample(8, 1);
  assert.equal(sim.current.tier, 'min');
});

test('o Auto não sobe a qualidade acima do limite detectado para a GPU', () => {
  const sim = simulate({ tier: 'min', scale: 1 });
  sim.sample(60, AUTO_GOOD_SAMPLES * 2, { ceilingIdx: 3 });
  assert.equal(sim.current.tier, 'min');
});

test('se nenhum nível atingir o alvo, prefere a qualidade mais alta perto do melhor FPS e evita oscilar', () => {
  const sim = simulate();
  sim.sample(22, AUTO_BAD_SAMPLES);
  for (const fps of [22, 23, 23, 24, 24, 24, 24]) sim.sample(fps, AUTO_PROBE_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'high', scale: 1 });
  assert.equal(sim.decisions.at(-1).type, 'settle');
  const count = sim.decisions.length;
  sim.sample(20, 60);
  assert.equal(sim.decisions.length, count);
});

test('só tenta subir após FPS alto sustentado e reverte se a melhora visual derrubar o desempenho', () => {
  const sim = simulate({ tier: 'medium', scale: 1 });
  sim.sample(60, AUTO_GOOD_SAMPLES - 1);
  assert.deepEqual(sim.current, { tier: 'medium', scale: 1 });
  sim.sample(60, 1);
  assert.deepEqual(sim.current, { tier: 'high', scale: 1 });
  sim.sample(38, AUTO_PROBE_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'medium', scale: 1 });
  const count = sim.decisions.length;
  sim.sample(60, 90);
  assert.equal(sim.decisions.slice(count).some((result) => result.type === 'change'), false);
  sim.wait(180000);
  sim.sample(60, AUTO_GOOD_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'high', scale: 1 });
  sim.sample(57, AUTO_PROBE_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'high', scale: 1 });
  assert.equal(sim.decisions.at(-1).type, 'settle');
});

test('interromper uma comparação devolve a configuração anterior', () => {
  const sim = simulate();
  sim.sample(20, AUTO_BAD_SAMPLES);
  assert.deepEqual(sim.current, { tier: 'high', scale: 0.85 });
  const previous = sim.controller.pause();
  assert.equal(previous.tier, 'high');
  assert.equal(previous.scale, 1);
});
