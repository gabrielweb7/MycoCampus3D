import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('VERSION, package.json, sw.js e index.html estão sincronizados na mesma versão', () => {
  const version = fs.readFileSync('VERSION', 'utf8').trim();
  assert.match(version, /^\d+\.\d+\.\d+$/);

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, version);

  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes(`mycocampus-v${version}`), 'sw.js CACHE_NAME desatualizado');
  assert.ok(sw.includes(`css/game.css?v=${version}`), 'sw.js game.css query desatualizada');

  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes(`css/game.css?v=${version}`), 'index.html game.css query desatualizada');
  assert.ok(html.includes(`>v${version}</span>`), 'index.html #app-version desatualizado');
  assert.ok(html.includes(`window.MYCO_VERSION = '${version}'`), 'index.html MYCO_VERSION desatualizado');
  assert.ok(html.includes(`js/main.js?v=${version}`), 'index.html main.js query desatualizada');
});
