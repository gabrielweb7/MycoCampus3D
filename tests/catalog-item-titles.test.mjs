import assert from 'node:assert/strict';
import test from 'node:test';
import { getCanonicalItemTitle, getItemFamily } from '../js/items/item-titles.js';

test('catalog groups world copies and saved states by physical item family', () => {
  for (const [canonical, examples] of [
    ['beaker_1l', ['beaker_1l_a', 'beaker_1l_b']],
    ['lab_tray', ['lab_tray_01', 'lab_tray_02', 'lab_tray_03']],
    ['monotub_24l', ['monotub_24l_01', 'monotub_24l_04']],
    ['pda_bottle', ['pda_bottle_02', 'pda_bottle_lab_02']],
    ['mylar_bag', ['mushroom_pack_bag_01', 'mushroom_pack_bag_11']],
    ['heat_sealer', ['heat_sealer_east_01']],
    ['dehydrator', ['dehydrator_east_01', 'dehydrator_lab']],
    ['parafilm', ['parafilm_lab_01']],
    ['water_spray', ['water_spray_east_01']],
    ['table_cooker_lab', ['table_hood_lab']]
  ]) {
    for (const id of examples) assert.equal(getItemFamily({ id }), canonical);
  }
  assert.equal(getItemFamily({ id: 'placed_874', meta: { prefabId: 'monotub_24l' } }), 'monotub_24l');
  assert.notEqual(getItemFamily({ id: 'falcon_15ml_02' }), getItemFamily({ id: 'falcon_50ml_01' }));
  assert.notEqual(getItemFamily({ id: 'petri_bare_01' }), getItemFamily({ id: 'petri_sterile_hood_01' }));
});

test('pickable titles omit changing inspection data and retain capacity', async () => {
  globalThis.window = {};
  const { formatHoverInfo } = await import('../js/entities/hover-3d-badge.js');
  const label = 'Caixa Monotub 24L (MADURO • Golden Teacher (Psilocybe cubensis) • 92% UR)';
  const info = formatHoverInfo(label, { label, id: 'monotub_24l_03', mesh: {} });
  assert.deepEqual(info, { title: 'Caixa Monotub 24 L', params: '', action: '' });
  assert.equal(getCanonicalItemTitle('beaker_1l'), 'Béquer de Vidro 1 L');
});
