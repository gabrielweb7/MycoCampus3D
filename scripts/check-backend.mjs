import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

for (const key of ['MYCO_TEST_DB_HOST', 'MYCO_TEST_DB_USER', 'MYCO_TEST_DB_PASS']) {
  if (!process.env[key]) throw new Error(`Configure ${key} para um MySQL de teste isolado.`);
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'myco-backend-test-'));
const files = ['api/auth.php', 'api/db.php', 'api/multiplayer.php', 'api/multiplayer_schema.php', 'database/schema.sql', 'VERSION'];
const suffix = randomBytes(6).toString('hex');

function post(file, action, body) {
  const command = '$_SERVER["REQUEST_METHOD"]="POST"; $_GET["action"]=$argv[1]; $_POST=json_decode($argv[2],true,512,JSON_THROW_ON_ERROR); require $argv[3];';
  return JSON.parse(execFileSync('php', ['-r', command, action, JSON.stringify(body), path.join(fixture, 'api', file)], {
    cwd: fixture, encoding: 'utf8', timeout: 15000
  }));
}

try {
  for (const dir of ['api', 'database', 'data']) fs.mkdirSync(path.join(fixture, dir));
  for (const file of files) fs.copyFileSync(file, path.join(fixture, file));
  fs.writeFileSync(path.join(fixture, 'api', 'config.php'), `<?php
define('DB_HOST', getenv('MYCO_TEST_DB_HOST'));
define('DB_NAME', 'mycocampus_test');
define('DB_USER', getenv('MYCO_TEST_DB_USER'));
define('DB_PASS', getenv('MYCO_TEST_DB_PASS'));
`);

  const login = post('auth.php', 'login', { display_name: `QA ${suffix}`, pin: randomBytes(8).toString('hex') });
  assert.equal(login.ok, true, login.error);
  const auth = { user_id: login.user.id, token: login.token };
  const operation = { ...auth, delta: 35, operation_id: `check-${suffix}` };
  for (let i = 0; i < 2; i++) {
    const coins = post('auth.php', 'sync_coins', operation);
    assert.equal(coins.ok, true, coins.error);
    assert.equal(coins.user.myco_coins, 285);
  }

  assert.equal(post('auth.php', 'complete_lab_quest', auth).ok, false);
  const steps = ['sanitize_hood', 'hood_on', 'cooker_heat', 'syringe_use', 'greenhouse_care', 'monotub_harvest', 'dry_pack', 'sell_pack'];
  const progress = post('auth.php', 'sync_progress', { ...auth, progress: { lab_quest_steps: steps } });
  assert.equal(progress.ok, true, progress.error);
  assert.equal(post('auth.php', 'complete_lab_quest', auth).awarded_xp, 100);
  const replay = post('auth.php', 'complete_lab_quest', auth);
  assert.equal(replay.awarded_xp, 0);
  assert.equal(replay.user.xp, 100);

  const session = { ...auth, session_id: `qa_${suffix}` };
  const initial = post('multiplayer.php', 'sync', { ...session, init_sync: 1 });
  assert.equal(initial.ok, true, initial.error);
  const stroke = { b: 0, c: '#f8fafc', pts: [[4, 5], [6, 8]], stroke_id: '123456abcdef' + suffix };
  const payload = { ...session, board_since: initial.board_last_id, board_strokes: [stroke] };
  const first = post('multiplayer.php', 'sync', payload);
  const second = post('multiplayer.php', 'sync', payload);
  assert.equal(first.ok, true, first.error);
  assert.equal(second.ok, true, second.error);
  assert.equal(first.board_strokes.length, 1);
  assert.equal(second.board_last_id, first.board_last_id);
  assert.equal(second.board_strokes.length, 1);
  console.log('Backend: migração, moedas e traços sem duplicidade e recompensa da missão verificados em MySQL.');
} finally {
  for (const file of [...files, 'api/config.php']) {
    fs.rmSync(path.join(fixture, file), { force: true });
  }
  const dataDir = path.join(fixture, 'data');
  if (fs.existsSync(dataDir)) {
    for (const marker of fs.readdirSync(dataDir)) {
      if (/^\.migrated_v\d+$/.test(marker)) fs.rmSync(path.join(dataDir, marker));
    }
  }
  for (const dir of ['api', 'database', 'data']) {
    const target = path.join(fixture, dir);
    if (fs.existsSync(target)) fs.rmdirSync(target);
  }
  fs.rmdirSync(fixture);
}
