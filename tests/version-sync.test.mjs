import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateReleaseNotes } from '../js/ui/whats-new-modal.js';

test('VERSION, package.json, sw.js e index.html estão sincronizados na mesma versão', () => {
  const version = fs.readFileSync('VERSION', 'utf8').trim();
  assert.match(version, /^\d+\.\d+\.\d+$/);
  validateReleaseNotes(version);

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, version);
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);

  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes(`mycocampus-v${version}`), 'sw.js CACHE_NAME desatualizado');
  assert.ok(sw.includes(`css/game.css?v=${version}`), 'sw.js game.css query desatualizada');

  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes(`css/game.css?v=${version}`), 'index.html game.css query desatualizada');
  assert.ok(html.includes(`>v${version}</span>`), 'index.html #app-version desatualizado');
  assert.ok(html.includes(`window.MYCO_VERSION = '${version}'`), 'index.html MYCO_VERSION desatualizado');
  assert.ok(html.includes(`js/main.js?v=${version}`), 'index.html main.js query desatualizada');
});

test('versionamento exige notas da versão atual nos três idiomas', () => {
  for (const version of ['2.11.0', '2.11.1', '2.11.2', '2.11.3', '2.11.4', '2.11.5']) {
    assert.doesNotThrow(() => validateReleaseNotes(version));
  }
  assert.throws(() => validateReleaseNotes('99.0.0'), /Adicione as novidades/);
});

test('version-updater valida reload anti-loop e constrói URL com cache bust', async () => {
  const {
    shouldTriggerVersionReload,
    recordVersionReloadAttempt,
    buildVersionedReloadUrl
  } = await import('../js/core/version-updater.js');

  const store = new Map();
  const mockStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v))
  };

  assert.equal(shouldTriggerVersionReload('1.9.4', '1.9.4', mockStorage), false);
  assert.equal(shouldTriggerVersionReload('1.9.4', '1.9.3', mockStorage), true);
  recordVersionReloadAttempt('1.9.4', mockStorage);
  assert.equal(shouldTriggerVersionReload('1.9.4', '1.9.3', mockStorage), false);

  const reloadUrl = buildVersionedReloadUrl({ pathname: '/index.html', search: '?play=1' }, '1.9.4', 123456);
  assert.equal(reloadUrl, '/index.html?play=1&_v=1.9.4&_cb=123456');
});
