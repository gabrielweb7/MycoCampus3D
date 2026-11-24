import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.bundle.min.js';

globalThis.window = { THREE };
globalThis.document = { getElementById: () => null, querySelectorAll: () => [] };
const { appState } = await import('../js/core/state.js');
const { syncMultiplayer, sendLeaveBeacon } = await import('../js/services/multiplayer-sync.js');
const { logoutCampus } = await import('../js/ui/hud-lobby.js');
const { apiPost } = await import('../js/services/api-client.js');

function setup(t) {
  const previous = { ...appState };
  Object.assign(appState, { currentUser: { id: 7, display_name: 'QA' }, sessionId: 'test_old', isInitialSync: false,
    villageLease: null, syncFailures: 0, syncInFlight: false, syncQueued: false });
  t.mock.property(globalThis, 'window', {
    THREE,
    getCampusPlayerPose: () => ({ x: 3, y: 0.02, z: 19, in_fps: true, holding_item: '' }),
    consumeCampusMovedItems: () => []
  });
  t.mock.property(globalThis, 'document', { getElementById: () => null, querySelectorAll: () => [] });
  t.after(() => { clearInterval(appState.syncTimer); Object.assign(appState, previous); });
}

test('uma queda de rede ao sair mantém a conta e recoloca o item pendente na fila', async (t) => {
  setup(t);
  let queue = [{ id: 'petri_clean', x: 3, y: .8, z: 4 }];
  window.consumeCampusMovedItems = () => queue.splice(0);
  window.requeueCampusMovedItems = moved => queue.push(...moved);
  window.resetCampusLocalSession = () => assert.fail('A sessão não deve apagar a fila após falha de salvamento');
  const actions = [];
  t.mock.method(globalThis, 'fetch', async url => { actions.push(url); throw new Error('Conexão interrompida'); });
  assert.equal(await logoutCampus(), false);
  assert.equal(appState.currentUser.id, 7);
  assert.equal(queue.length, 1);
  assert.deepEqual(actions, ['api/multiplayer.php?action=sync']);
});

test('respostas antigas de sincronização e de autenticação não alteram uma sessão nova', async (t) => {
  setup(t);
  let resolve;
  const response = new Promise(done => { resolve = done; });
  t.mock.method(globalThis, 'fetch', async () => new Response(await response));
  const outgoing = syncMultiplayer();
  const oldAction = apiPost('api/auth.php?action=sync_coins', {}, true);
  appState.sessionId = 'test_new';
  resolve(JSON.stringify({ ok: true, village_lease: { id: 4 } }));
  assert.equal(await outgoing, false);
  await oldAction;
  assert.equal(appState.villageLease, null);

  let deny;
  const denied = new Promise(done => { deny = done; });
  t.mock.method(globalThis, 'fetch', async () => {
    const res = await denied;
    return new Response(res.body, { status: res.status });
  });
  const expired = apiPost('api/auth.php?action=sync_coins', {}, true);
  appState.sessionId = 'test_newer';
  deny({ body: '{"ok":false,"auth":false}', status: 401 });
  assert.equal((await expired).auth, false);
  assert.equal(appState.currentUser.id, 7);
});

test('fechar a página envia a posição mesmo com a mão vazia e encerra na mesma requisição', (t) => {
  setup(t);
  const calls = [];
  const originalNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { sendBeacon: (url, data) => { calls.push([url, JSON.parse(data)]); return true; } },
    configurable: true,
    writable: true
  });
  t.after(() => {
    if (originalNav) Object.defineProperty(globalThis, 'navigator', originalNav);
    else delete globalThis.navigator;
  });
  sendLeaveBeacon();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'api/multiplayer.php?action=sync');
  assert.equal(calls[0][1].leaving, true);
  assert.equal(calls[0][1].z, 19);
});

test('fechar a página fora do FPS (no lobby) envia encerramento simples via beacon leave', (t) => {
  setup(t);
  window.getCampusPlayerPose = () => ({ in_fps: false });
  const calls = [];
  const originalNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { sendBeacon: (url, data) => { calls.push([url, JSON.parse(data)]); return true; } },
    configurable: true,
    writable: true
  });
  t.after(() => {
    if (originalNav) Object.defineProperty(globalThis, 'navigator', originalNav);
    else delete globalThis.navigator;
  });
  sendLeaveBeacon();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'api/multiplayer.php?action=leave');
  assert.equal(calls[0][1].session_id, 'test_old');
  assert.equal(calls[0][1].user_id, 7);
});
