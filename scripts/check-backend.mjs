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
  // A separate account exercises durable pet ownership and care without
  // changing the balance assumptions of the existing shop checks.
  const petLogin = post('auth.php', 'login', { display_name: `Pet QA ${suffix}`, pin: randomBytes(8).toString('hex') });
  const petAuth = { user_id: petLogin.user.id, token: petLogin.token };
  const pet = (operation, data = {}) => post('auth.php', 'pet_action', { ...petAuth, operation, ...data });
  assert.equal(pet('select', { pet_id: 'cat_black' }).ok, false);
  assert.equal(pet('buy_pet', { pet_id: 'cat_black' }).user.myco_coins, 50);
  assert.equal(pet('buy_pet', { pet_id: 'cat_black' }).user.myco_coins, 50);
  assert.equal(pet('select', { pet_id: 'cat_black' }).user.progress.pets.selected, 'cat_black');
  assert.equal(pet('mode', { mode: 'roam' }).user.progress.pets.mode, 'roam');
  assert.equal(pet('buy_food_bowl').user.myco_coins, 10);
  assert.equal(pet('place_food', { pos: { x: 9999, y: 0, z: 0 } }).ok, false);
  assert.equal(pet('place_food', { pos: { x: 1, y: 0, z: 2 } }).ok, true);
  assert.equal(pet('fill_food').ok, false);
  const credit = post('auth.php', 'sync_coins', { ...petAuth, delta: 35, operation_id: `pet-credit-${suffix}` });
  assert.equal(credit.ok, true);
  const foodId = `pet_food_${randomBytes(16).toString('hex')}`;
  assert.equal(pet('buy_cat_food', { operation_id: foodId }).user.progress.pets.cat_food, 5);
  const foodRetry = pet('buy_cat_food', { operation_id: foodId });
  assert.equal(foodRetry.user.progress.pets.cat_food, 5);
  assert.equal(foodRetry.user.myco_coins, 20);
  assert.equal(pet('fill_food').user.progress.pets.cat_food, 4);
  const eaten = pet('consume_food');
  assert.equal(eaten.user.progress.pets.bowls.food.full, false);
  assert.ok(eaten.user.progress.pets.next_food.cat_black > 0);
  assert.equal(pet('consume_food').ok, false);
  const preservePet = post('auth.php', 'sync_progress', { ...petAuth, progress: { pets: { selected: 'dog_pug', cat_food: 999 } } });
  assert.equal(preservePet.user.progress.pets.selected, 'cat_black');
  assert.equal(preservePet.user.progress.pets.cat_food, 4);
  assert.deepEqual(preservePet.user.progress.pets.bowls.food.pos, { x: 1, y: 0, z: 2 });
  assert.equal(preservePet.user.progress.pets.mode, 'roam');
  assert.equal(post('auth.php', 'sync_coins', { ...petAuth, delta: 100, operation_id: `pet-water-${suffix}` }).ok, true);
  assert.equal(pet('buy_water_bowl').ok, true);
  assert.equal(pet('place_water', { pos: { x: 2, y: 0, z: 2 } }).ok, true);
  assert.equal(pet('fill_water').user.progress.pets.bowls.water.full, true);
  assert.equal(pet('consume_water').user.progress.pets.bowls.water.full, false);
  assert.equal(pet('fill_water').ok, true);
  assert.equal(pet('consume_water').ok, false, 'a pet cannot drink again before its thirst timer');
  const operation = { ...auth, delta: 35, operation_id: `check-${suffix}` };
  for (let i = 0; i < 2; i++) {
    const coins = post('auth.php', 'sync_coins', operation);
    assert.equal(coins.ok, true, coins.error);
    assert.equal(coins.user.myco_coins, 285);
  }

  const orderId = `purchase_sup_pp5_${randomBytes(16).toString('hex')}`;
  const order = { ...auth, supply_id: 'sup_pp5', order_id: orderId, delivery: { x: 2, y: 0.2, z: 3, ry: 0 } };
  const invalidOrder = post('auth.php', 'buy_supply_durable', { ...order, delivery: { ...order.delivery, x: 999 } });
  assert.equal(invalidOrder.ok, false);
  assert.equal(invalidOrder.charged, false);
  const purchased = post('auth.php', 'buy_supply_durable', order);
  assert.equal(purchased.ok, true, purchased.error);
  assert.equal(purchased.user.myco_coins, 255);
  assert.match(purchased.delivery_id, /^dyn_shop_[a-f0-9]{32}$/);
  const retried = post('auth.php', 'buy_supply_durable', { ...order, delivery: { ...order.delivery, x: 9 } });
  assert.equal(retried.ok, true);
  assert.equal(retried.user.myco_coins, 255);
  assert.equal(retried.delivery_id, purchased.delivery_id);

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
  assert.equal(initial.objects[purchased.delivery_id].x, 2);
  assert.equal(initial.layout_edits[purchased.delivery_id].prefab_id, 'pp5_cup');
  const petSession = { ...petAuth, session_id: `pet_${suffix}` };
  const petSync = post('multiplayer.php', 'sync', { ...petSession, in_fps: true, pet_pose: { id: 'cat_black', x: 3, y: 0, z: 4, yaw: 1, motion: 'walk' } });
  assert.equal(petSync.ok, true, petSync.error);
  const observer = post('multiplayer.php', 'sync', session);
  const seenPet = observer.players.find(p => p.pets?.pet?.id === 'cat_black');
  assert.ok(seenPet, 'the other player should see the selected owned pet');
  assert.equal(seenPet.pets.pet.x, 3);
  assert.equal(seenPet.pets.bowls.food.x, 1);
  assert.equal(seenPet.pets.bowls.food.full, false);
  assert.equal('cat_food' in seenPet.pets, false);
  assert.equal(post('multiplayer.php', 'sync', { ...petSession, pet_pose: { id: 'dog_pug', x: 3, y: 0, z: 4 } }).ok, true);
  const noFakePet = post('multiplayer.php', 'sync', session);
  assert.equal(noFakePet.players.some(p => p.pets?.pet?.id === 'dog_pug'), false);
  const stroke = { b: 0, c: '#f8fafc', pts: [[4, 5], [6, 8]], stroke_id: '123456abcdef' + suffix };
  const payload = { ...session, board_since: initial.board_last_id, board_strokes: [stroke] };
  const first = post('multiplayer.php', 'sync', payload);
  const second = post('multiplayer.php', 'sync', payload);
  assert.equal(first.ok, true, first.error);
  assert.equal(second.ok, true, second.error);
  assert.equal(first.board_strokes.length, 1);
  assert.equal(second.board_last_id, first.board_last_id);
  assert.equal(second.board_strokes.length, 1);
  console.log('Backend: migração, entrega de compra, moedas e traços sem duplicidade e recompensa da missão verificados em MySQL.');
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
