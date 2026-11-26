import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };

const { setLanguage, t } = await import('../js/core/i18n.js');
const {
  assignActionShortcuts,
  getFloatingActionsPreview,
  syncFloatingActions,
  triggerFloatingActionByCode
} = await import('../js/ui/radial-menu.js');

function makeItem(id, label, extra = {}) {
  const userData = { ...(extra.userData || {}) };
  const mesh = { userData, rotation: { y: 0 }, position: { x: 0, y: 0, z: 0 } };
  return { id, label, mesh, ...extra };
}

test('atalhos flutuantes padronizados: G sempre Pegar, I sempre Inspecionar, Z sempre Etiqueta e sem números', () => {
  setLanguage('pt-BR');

  // 1. Item simples (Borrifador): apenas G (Pegar) e I (Inspecionar)
  const spray = makeItem('alcohol_spray_1', 'Borrifador Álcool 70%', { userData: { isAlcoholSpray: true } });
  const sprayActs = getFloatingActionsPreview({ hoveredPickable: spray, cookerPots: [] });
  assert.deepEqual(sprayActs.map(a => [a.key, a.label]), [
    ['G', 'Pegar'],
    ['I', 'Inspecionar']
  ]);

  // 2. Placa de Petri: F (Abrir Tampa), Z (Etiqueta), G (Pegar), I (Inspecionar)
  const petri = makeItem('petri_1', 'Placa de Petri', { userData: { isPetri: true, petriCtrl: { lidOpen: false } } });
  const petriActs = getFloatingActionsPreview({ hoveredPickable: petri, cookerPots: [] });
  assert.deepEqual(petriActs.map(a => [a.key, a.label]), [
    ['F', 'Abrir Tampa'],
    ['Z', 'Etiqueta'],
    ['G', 'Pegar'],
    ['I', 'Inspecionar']
  ]);

  // 3. Geladeira: F (Abrir porta), V (Ver Vagas), G (Pegar Geladeira), I (Inspecionar)
  const fridge = makeItem('fridge_1', 'Geladeira 4°C', { fridgeCtrl: { doorOpen: false, slots: [] } });
  const fridgeActs = getFloatingActionsPreview({ hoveredPickable: fridge, cookerPots: [] });
  assert.deepEqual(fridgeActs.map(a => [a.key, a.label]), [
    ['F', 'Abrir porta'],
    ['V', 'Ver Vagas'],
    ['G', 'Pegar Geladeira'],
    ['I', 'Inspecionar']
  ]);

  // 4. Maleta de Ampolas (5 ações): F, V, Z, G, I únicos sem cortar Inspecionar
  const ampCase = makeItem('case_1', 'Maleta de Ampolas', { caseCtrl: { lidOpen: false, slots: [] } });
  const caseActs = getFloatingActionsPreview({ hoveredPickable: ampCase, cookerPots: [] });
  assert.deepEqual(caseActs.map(a => a.key), ['F', 'V', 'Z', 'G', 'I']);
  assert.equal(caseActs[2].label, 'Etiqueta');
  assert.equal(caseActs[3].label, 'Pegar');
  assert.equal(caseActs[4].label, 'Inspecionar');

  // 5. Colmeia: I (Inspecionar)
  const hiveActs = getFloatingActionsPreview({ hoveredBeehive: { id: 'hive_0', honeyLevel: 50, buildProgress: 1 } });
  assert.deepEqual(hiveActs.map(a => [a.key, a.label]), [['I', 'Inspecionar']]);

  // 6. Segurando Placa Petri: F (Abrir Tampa) e I (Inspecionar)
  const heldActs = getFloatingActionsPreview({ heldItem: petri, placementMode: false });
  assert.deepEqual(heldActs.map(a => [a.key, a.label]), [
    ['F', 'Abrir Tampa'],
    ['I', 'Inspecionar']
  ]);

  // Nenhum atalho usa dígitos
  for (const list of [sprayActs, petriActs, fridgeActs, caseActs, hiveActs, heldActs]) {
    assert.ok(list.every(a => !/^\d+$/.test(a.key || '')), 'Nenhum atalho de ação deve ser numérico');
  }
});

test('assignActionShortcuts, triggerFloatingActionByCode e Pegar sem forçar modo posicionamento', () => {
  setLanguage('pt-BR');
  const pickedCalls = [];
  const petri = makeItem('petri_pick', 'Placa de Petri', { userData: { isPetri: true, petriCtrl: { lidOpen: false } } });
  const ctx = {
    inFps: true,
    lobbyTourActive: false,
    placementMode: false,
    adminEditMode: false,
    hoveredPickable: petri,
    cookerPots: [],
    isTouchDevice: () => false,
    pickHoveredItemForMove: (target, startPlacement) => pickedCalls.push([target.id, startPlacement])
  };

  // Mock DOM mínimo para syncFloatingActions
  const fakeElements = new Map();
  const makeEl = (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      textContent: '',
      children: [],
      listeners: {},
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, f) { if (f) this._set.add(c); else this._set.delete(c); },
        contains(c) { return this._set.has(c); }
      },
      appendChild(ch) { this.children.push(ch); return ch; },
      prepend(ch) { this.children.unshift(ch); return ch; },
      replaceChildren() { this.children.length = 0; },
      setAttribute() {},
      setPointerCapture() {},
      addEventListener(type, fn) { this.listeners[type] = fn; }
    };
    return el;
  };
  const hudControls = makeEl('div');
  hudControls.id = 'bottom-hud-controls';
  fakeElements.set('bottom-hud-controls', hudControls);

  const prevDocument = globalThis.document;
  globalThis.document = {
    head: makeEl('head'),
    createElement: (tag) => makeEl(tag),
    getElementById: (id) => fakeElements.get(id) || null
  };
  try {
    syncFloatingActions(ctx);
    const bar = hudControls.children[0];
    assert.equal(bar.id, 'myco-floating-actions');
    const renderedKeys = bar.children.map(chip => chip.children[0].textContent);
    assert.deepEqual(renderedKeys, ['F', 'Z', 'G', 'I']);

    assert.equal(triggerFloatingActionByCode('KeyQ'), true);
    assert.deepEqual(pickedCalls, [['petri_pick', false]]);
    assert.equal(triggerFloatingActionByCode('Digit4'), false);

    ctx.isTouchDevice = () => true;
    ctx.hoveredPickable = makeItem('simple_tool', 'Ferramenta');
    ctx.mobileAimPrompt = ctx.hoveredPickable.label;
    syncFloatingActions(ctx);
    assert.match(bar.children[0].children[0].textContent, /Pegar Ferramenta/);
    assert.deepEqual(bar.children[1].children.map(button => button.children[0].textContent), ['🔍 Inspecionar']);

    ctx.hoveredPickable = null;
    ctx.heldItem = makeItem('water_test', 'Água', {
      meta: { compatibilities: { poursWater: true } },
      userData: { liquidCtrl: { volMl: 350 } }
    });
    ctx.lastPickupAt = -1000;
    ctx.hoveredFillPot = { contents: [], waterMl: 0 };
    ctx.mobileAimPrompt = 'Despejar água';
    syncFloatingActions(ctx);
    const holdButton = bar.children[0];
    assert.match(holdButton.children[0].textContent, /Segure · Despejar água/);
    holdButton.listeners.pointerdown({ button: 0, pointerId: 7, clientX: 1, clientY: 2 });
    assert.equal(ctx.isPrimaryDown, true);
    assert.equal(ctx.pourHold.dst, ctx.hoveredFillPot);
    ctx.mobileAimPrompt = '';
    syncFloatingActions(ctx);
    assert.equal(bar.children[0], holdButton);
    holdButton.listeners.pointercancel({ pointerId: 7 });
    assert.equal(ctx.isPrimaryDown, false);
    ctx.heldItem = null;
    ctx.hoveredFillPot = null;
    syncFloatingActions(ctx);
    assert.equal(bar.classList.contains('hidden'), true);
  } finally {
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
  }

  // Valida também assignActionShortcuts direto
  const custom = assignActionShortcuts([
    { id: 'act_a', label: 'A', run() {} },
    { id: 'act_b', label: 'B', run() {} },
    { id: 'move_x', label: 'Pegar', run() {} },
    { id: 'inspect_x', label: 'Inspecionar', run() {} }
  ]);
  assert.deepEqual(custom.map(a => a.key), ['F', 'V', 'G', 'I']);
});

test('traduções de Pegar e atalhos padronizados estão consistentes em PT-BR, EN e ES', () => {
  setLanguage('pt-BR');
  assert.equal(t('actions.radial.move'), 'Pegar');
  assert.equal(t('actions.radial.move_fridge'), 'Pegar Geladeira');
  assert.match(t('actions.hover.held_options_hint'), /F, V, Z ou I/);

  setLanguage('en');
  assert.equal(t('actions.radial.move'), 'Pick Up');
  assert.equal(t('actions.radial.move_fridge'), 'Pick Up Fridge');
  assert.match(t('actions.hover.held_options_hint'), /F, V, Z or I/);

  setLanguage('es');
  assert.equal(t('actions.radial.move'), 'Recoger');
  assert.equal(t('actions.radial.move_fridge'), 'Recoger Nevera');
  assert.match(t('actions.hover.held_options_hint'), /F, V, Z o I/);

  setLanguage('pt-BR');
});
