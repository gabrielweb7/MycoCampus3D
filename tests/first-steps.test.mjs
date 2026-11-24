import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/core/state.js';
import { setLanguage } from '../js/core/i18n.js';
import { initFirstSteps, rememberNewFirstStepsUser, resetFirstSteps, showFirstStepsWelcome } from '../js/ui/first-steps.js';

function node(hidden = false) {
  const classes = new Set(hidden ? ['hidden'] : []);
  return {
    textContent: '', disabled: false, onclick: null,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, force) => force ? classes.add(name) : classes.delete(name)
    },
    addEventListener() {},
    click() { this.onclick?.(); }
  };
}

test('primeiros passos: convite por conta, fluxo opcional, navegação e retorno ao guia', () => {
  const ids = ['first-steps-panel', 'first-steps-welcome-modal', 'guide-modal', 'first-steps-start',
    'first-steps-explore', 'guide-first-steps', 'first-steps-close', 'first-steps-back', 'first-steps-next',
    'first-steps-lab', 'first-steps-guide', 'first-steps-title', 'first-steps-description',
    'first-steps-progress', 'first-steps-pointer-hint'];
  const nodes = Object.fromEntries(ids.map((id) => [id, node(id.endsWith('modal') || id === 'first-steps-panel')]));
  const storage = new Map();
  globalThis.localStorage = { setItem: (k, v) => storage.set(k, v), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
  globalThis.window = { innerWidth: 1440, innerHeight: 900 };
  let guideTabClicks = 0;
  globalThis.document = {
    getElementById: (id) => nodes[id] || null,
    querySelector: (selector) => selector === '[data-guide-tab="tutorial"]' ? { click() { guideTabClicks++; } } : null,
    querySelectorAll: () => [],
    documentElement: { clientWidth: 1440, clientHeight: 900 }
  };
  let labVisits = 0;
  let noticeCalls = 0;
  initFirstSteps({ onGoToLab: () => labVisits++ });
  const first = { id: 10 };
  appState.currentUser = first;
  assert.equal(showFirstStepsWelcome(first, false, () => noticeCalls++), false);
  rememberNewFirstStepsUser(first, true);
  assert.equal(showFirstStepsWelcome(first, false, () => noticeCalls++), true, 'convite pendente sobrevive à retomada');
  assert.equal(nodes['first-steps-welcome-modal'].classList.contains('hidden'), false);
  nodes['first-steps-start'].click();
  assert.equal(storage.has('myco_first_steps_pending_10'), false);
  assert.equal(nodes['first-steps-panel'].classList.contains('hidden'), false);
  assert.equal(nodes['first-steps-back'].disabled, true);
  nodes['first-steps-next'].click();
  assert.equal(nodes['first-steps-lab'].classList.contains('hidden'), false);
  nodes['first-steps-lab'].click();
  assert.equal(labVisits, 1);
  nodes['first-steps-next'].click();
  setLanguage('en', { persist: false, apply: false });
  assert.equal(nodes['first-steps-title'].textContent, 'Interact with objects');
  nodes['first-steps-next'].click();
  nodes['first-steps-guide'].click();
  assert.equal(guideTabClicks, 1);
  assert.equal(nodes['guide-modal'].classList.contains('hidden'), false);
  nodes['first-steps-next'].click();
  assert.equal(noticeCalls, 1);
  assert.equal(nodes['first-steps-panel'].classList.contains('hidden'), true);
  nodes['guide-first-steps'].click();
  assert.equal(nodes['first-steps-panel'].classList.contains('hidden'), false);
  assert.equal(nodes['guide-modal'].classList.contains('hidden'), true);
  nodes['first-steps-close'].click();
  assert.equal(noticeCalls, 1, 'repetir o guia não repete o aviso inicial');

  const second = { id: 11 };
  appState.currentUser = second;
  rememberNewFirstStepsUser(second, true);
  assert.equal(showFirstStepsWelcome(second, false, () => noticeCalls++), true);
  nodes['first-steps-explore'].click();
  assert.equal(storage.has('myco_first_steps_pending_11'), false);
  assert.equal(noticeCalls, 2);
  assert.equal(showFirstStepsWelcome(second, false, () => noticeCalls++), false);
  rememberNewFirstStepsUser(second, true);
  assert.equal(showFirstStepsWelcome(second, false, () => noticeCalls++), true);
  resetFirstSteps();
  appState.currentUser = null;
  nodes['first-steps-explore'].click();
  assert.equal(noticeCalls, 2, 'troca de sessão não deve abrir o aviso anterior');
  setLanguage('pt-BR', { persist: false, apply: false });
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
});
