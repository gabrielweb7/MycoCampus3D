/**
 * MycoCampus3D — Loja de Cosméticos (Chapéus & Brinquedos)
 */
import { appState } from '../core/state.js';
import { t } from '../core/i18n.js';
import { events } from '../core/events.js';
import { apiPost } from '../services/api-client.js';
import { preserveNewerPetState } from '../services/pets.js';
import { pendingCoinOperations } from '../services/coin-outbox.js';
import { orderShopSupply } from '../services/shop-purchases.js';
import { renderPetShop } from './pet-shop.js';
import { $, escapeHtml } from './dom-helpers.js';
import { updateUserHud } from './hud-lobby.js';
import { getLocalMycoCoins, addLocalMycoCoins, setLocalMycoCoins } from '../items/dehydration-packaging.js';

export const COSMETIC_HATS = [
  { id: 'default', name: 'Cogumelo Vermelho Clássico', desc: 'O clássico Amanita com pintas brancas.', req_xp: 0, req_mushrooms: 0, price_coins: 0, icon: '🍄' },
  { id: 'golden_shroom', name: 'Cogumelo Dourado Radiante', desc: 'Dourado brilhante com esferas cintilantes.', req_xp: 200, req_mushrooms: 5, price_coins: 240, icon: '👑' },
  { id: 'wizard_hood', name: 'Capuz de Alquimista', desc: 'Cone místico com runas de micologia.', req_xp: 350, req_mushrooms: 10, price_coins: 360, icon: '🧙‍♂️' },
  { id: 'grad_cap', name: 'Capelo Universitário', desc: 'Chapéu acadêmico de formatura com borla dourada.', req_xp: 500, req_mushrooms: 15, price_coins: 480, icon: '🎓' },
  { id: 'flower_crown', name: 'Coroa de Flores Silvestres', desc: 'Grinalda botânica com pétalas da floresta.', req_xp: 150, req_mushrooms: 3, price_coins: 120, icon: '🌸' },
  { id: 'beret', name: 'Boina de Pesquisador', desc: 'Estilo elegante de cientista micologista.', req_xp: 100, req_mushrooms: 2, price_coins: 120, icon: '🎨' }
];

export const COSMETIC_TOYS = [
  { id: 'snowboard', name: 'Snowboard Pro MycoRide', desc: 'Desça as montanhas com física real, carving e visão nos pés! (Atalho: B)', req_xp: 100, req_mushrooms: 2, price_coins: 120, icon: '🏂' },
  { id: 'paraglider', name: 'Paraglider MycoWing', desc: 'Salte das montanhas, pegue correntes térmicas e voe pelo campus! (Atalho: P)', req_xp: 150, req_mushrooms: 3, price_coins: 240, icon: '🪂' }
];

export const SHOP_SUPPLIES = [
  { id: 'sup_pp5', prefabId: 'pp5_cup', name: 'Copo PP5 145ml', desc: 'Recipiente extra para ágar PDA ou grãos.', price_coins: 30, icon: '🥤' },
  { id: 'sup_syringe', prefabId: 'syringe_10ml', name: 'Seringa Estéril 10ml', desc: 'Nova seringa extra para inoculação rápida.', price_coins: 40, icon: '💉' },
  { id: 'sup_water_spray', prefabId: 'water_spray', name: 'Borrifador Água Destilada', desc: 'Hidrate Monotubs 24L e bolos da Estufa com névoa fina estéril.', price_coins: 35, icon: '💧' },
  { id: 'sup_lc_nutrient', prefabId: 'lc_nutrient_bottle', name: 'Extrato de Malte / Mel 250g', desc: 'Nutriente 4% para preparar Cultura Líquida no frasco 800ml.', price_coins: 40, icon: '🍯' },
  { id: 'sup_petri', prefabId: 'petri_empty', name: 'Placa de Petri (PDA)', desc: 'Placa de cultivo para isolar genética.', price_coins: 45, icon: '🧫' },
  { id: 'sup_mylar', prefabId: 'mylar_bag', name: 'Saco Mylar Metalizado', desc: 'Saco para embalar 10g/25g e vender no Empório.', price_coins: 45, icon: '🛍️' },
  { id: 'sup_h2o2', prefabId: 'h2o2_spray', name: 'Água Oxigenada 3% (H₂O₂)', desc: 'Borrife para curar mofo Cobweb (Teia) no Monotub e Bolos.', price_coins: 45, icon: '🫧' },
  { id: 'sup_flocao', prefabId: 'flocao_500g', name: 'Flocão de Milho 500g', desc: 'Substrato nutritivo para potes PP5 e misturas.', price_coins: 50, icon: '🌽' },
  { id: 'sup_spray', prefabId: 'alcohol_spray', name: 'Borrifador Álcool 70%', desc: 'Higienizador extra para suas bancadas.', price_coins: 60, icon: '🧴' },
  { id: 'sup_spawn_jar', prefabId: 'spawn_jar', name: 'Vidro 800ml (Spawn)', desc: 'Mais espaço para cultivar grãos inoculados.', price_coins: 70, icon: '🫙' },
  { id: 'sup_spawn_bag', prefabId: 'spawn_bag', name: 'Bag de Cultivo 1,5kg', desc: 'Saco filtrante grande de cultivo e colonização.', price_coins: 85, icon: '🍄' },
  { id: 'sup_lc', prefabId: 'liquid_culture', name: 'Frasco Cultura Líquida 800ml', desc: 'Vidro com tampa de porta autoclavável.', price_coins: 90, icon: '🧪' },
  { id: 'sup_crate', prefabId: 'delivery_crate', name: 'Caixa de Entrega', desc: 'Transporte até 4 pacotes direto para o Drive-Thru.', price_coins: 110, icon: '📤' },
  { id: 'sup_silica', prefabId: 'silica_jar', name: 'Pote com Sílica Gel', desc: 'Conserve até 8 lotes de cogumelos crocantes.', price_coins: 140, icon: '💎' },
  { id: 'sup_grow_tent', prefabId: 'grow_tent', name: 'Grow ESP32', desc: 'Três prateleiras, nove bolos e LED integrado.', price_coins: 620, icon: '🌱' },
  { id: 'sup_grow_humidifier', prefabId: 'grow_humidifier', name: 'Umidificador para Grow', desc: 'Conecte ao grow para gerar névoa e controlar a umidade.', price_coins: 150, icon: '💧' },
  { id: 'sup_grow_exhaust', prefabId: 'grow_exhaust', name: 'Exaustor para Grow', desc: 'Conecte ao grow com um duto flexível laminado para renovar o ar.', price_coins: 170, icon: '🌀' },
  { id: 'sup_monotub', prefabId: 'monotub_24l', name: 'Caixa Monotub 24L', desc: 'Expanda sua produção com frutificação em massa.', price_coins: 260, icon: '📦' },
  { id: 'sup_dehydrator', prefabId: 'dehydrator', name: 'Desidratadora de Cogumelos', desc: 'Seque mais lotes simultâneos até 0% umidade.', price_coins: 380, icon: '♨️' },
  { id: 'sup_table', prefabId: 'table_stainless', name: 'Bancada Inox (1.6m)', desc: 'Mesa móvel adicional para ampliar seu laboratório.', price_coins: 320, icon: '🛠️' },
  { id: 'sup_ampoule_case', prefabId: 'ampoule_case', name: 'Maleta Porta-Ampolas 5ML (50 Vagas)', desc: '24 espécies (Cubensis, Comestíveis e Raras) já colonizadas em cultura líquida + 26 vagas extras (máx. 50).', price_coins: 1000, req_xp: 1000, req_mushrooms: 100, icon: '💼' }
];

export const SHOP_SUPPLY_CATEGORIES = [
  { id: 'containers', label: 'Recipientes', icon: '🫙', ids: ['sup_pp5', 'sup_spawn_jar', 'sup_spawn_bag', 'sup_monotub'] },
  { id: 'substrate', label: 'Substratos', icon: '🌽', ids: ['sup_flocao', 'sup_lc_nutrient'] },
  { id: 'lab', label: 'Laboratório', icon: '🧪', ids: ['sup_petri', 'sup_syringe', 'sup_lc', 'sup_ampoule_case'] },
  { id: 'hygiene', label: 'Higiene & Mofo', icon: '🧴', ids: ['sup_spray', 'sup_water_spray', 'sup_h2o2'] },
  { id: 'grow', label: 'Grow & Estufa', icon: '🌱', ids: ['sup_grow_tent', 'sup_grow_humidifier', 'sup_grow_exhaust'] },
  { id: 'post', label: 'Pós-colheita', icon: '📦', ids: ['sup_dehydrator', 'sup_silica', 'sup_mylar', 'sup_crate'] },
  { id: 'furniture', label: 'Bancadas', icon: '🛠️', ids: ['sup_table'] }
];

let activeSupplyCat = 'all';

let activeShopTab = 'hats';

events.on('pets:changed', () => {
  if (activeShopTab === 'pets' && !$('shop-modal')?.classList.contains('hidden')) renderShopModal();
});

const nm = (kind, item, field) => t(`ui.shop.${kind}.${item.id}.${field}`);
const coinsTxt = (n) => t('ui.shop.coins', { n });

function toast3D(msg) {
  if (window.showCampusToast) window.showCampusToast(msg);
}

window.toggleCampusSnowboard = function () {
  const unlocked = (appState.currentUser && appState.currentUser.unlocked_hats) || [];
  if (unlocked.indexOf('snowboard') === -1) {
    toast3D(t('ui.shop.lockedSnowboard'));
    return;
  }
  const next = !(window.isCampusSnowboardActive && window.isCampusSnowboardActive());
  if (next && window.setCampusParaglider) window.setCampusParaglider(false);
  if (window.setCampusSnowboard) window.setCampusSnowboard(next);
  if (window.syncCampusUserProgress) window.syncCampusUserProgress({ equipped_toy: next ? 'snowboard' : '' });
  if (window.MycoAudio) window.MycoAudio.playClick();
  toast3D(next ? t('ui.shop.snowboardOn') : t('ui.shop.snowboardOff'));
};

window.toggleCampusParaglider = function () {
  const unlocked = (appState.currentUser && appState.currentUser.unlocked_hats) || [];
  if (unlocked.indexOf('paraglider') === -1) {
    toast3D(t('ui.shop.lockedParaglider'));
    return;
  }
  const next = !(window.isCampusParagliderActive && window.isCampusParagliderActive());
  if (next && window.setCampusSnowboard) window.setCampusSnowboard(false);
  if (window.setCampusParaglider) window.setCampusParaglider(next);
  if (window.syncCampusUserProgress) window.syncCampusUserProgress({ equipped_toy: next ? 'paraglider' : '' });
  if (window.MycoAudio) window.MycoAudio.playClick();
  toast3D(next ? t('ui.shop.paragliderOn') : t('ui.shop.paragliderOff'));
};

export function renderShopModal() {
  const grid = $('shop-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const user = appState.currentUser;
  const userXp = user ? (user.xp || 0) : 0;
  const userMush = user ? (user.mushrooms_harvested || 0) : 0;
  const unlocked = (user && user.unlocked_hats) || ['default'];
  const currentHat = (user && user.current_hat) || 'default';
  const snowboardOn = !!(window.isCampusSnowboardActive && window.isCampusSnowboardActive());
  const paragliderOn = !!(window.isCampusParagliderActive && window.isCampusParagliderActive());

  if ($('shop-user-xp')) $('shop-user-xp').textContent = String(userXp);
  if ($('shop-user-mushrooms')) $('shop-user-mushrooms').textContent = String(userMush);
  const userCoins = getLocalMycoCoins();
  if ($('shop-user-coins')) $('shop-user-coins').textContent = String(userCoins);
  let coinUnlocked = [];
  const coinUnlockedKey = user && user.id ? ('myco_coin_unlocked_items_u' + user.id) : 'myco_coin_unlocked_items';
  try {
    const rawC = localStorage.getItem(coinUnlockedKey);
    if (rawC) {
      const parsedC = JSON.parse(rawC);
      coinUnlocked = Array.isArray(parsedC) ? parsedC : [];
    }
  } catch (e) {}

  const tabHats = $('shop-tab-hats');
  const tabToys = $('shop-tab-toys');
  const tabPets = $('shop-tab-pets');
  const tabSupplies = $('shop-tab-supplies');
  if (tabHats && tabToys) {
    const baseTab = 'shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg font-bold text-xs transition ';
    tabHats.className = baseTab + (activeShopTab === 'hats' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-800/80 text-slate-300 hover:text-white');
    tabToys.className = baseTab + (activeShopTab === 'toys' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-800/80 text-slate-300 hover:text-white');
    if (tabPets) {
      tabPets.className = baseTab + (activeShopTab === 'pets' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-800/80 text-slate-300 hover:text-white');
      tabPets.onclick = () => { activeShopTab = 'pets'; renderShopModal(); };
    }
    if (tabSupplies) {
      tabSupplies.className = baseTab + (activeShopTab === 'supplies' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800/80 text-slate-300 hover:text-white');
      tabSupplies.onclick = () => { activeShopTab = 'supplies'; renderShopModal(); };
    }
    tabHats.onclick = () => { activeShopTab = 'hats'; renderShopModal(); };
    tabToys.onclick = () => { activeShopTab = 'toys'; renderShopModal(); };
  }

  if (activeShopTab === 'pets') {
    renderPetShop(grid, renderShopModal);
    return;
  }

  if (activeShopTab === 'supplies') {
    const chipBar = document.createElement('div');
    chipBar.className = 'col-span-full flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar sticky top-0 z-10 py-2 -mt-2 sm:-mt-3 -mx-3 sm:-mx-5 px-3 sm:px-5 bg-slate-900/95 border-b border-slate-800/80 shadow-sm';
    [{ id: 'all', icon: '🛒' }].concat(SHOP_SUPPLY_CATEGORIES).forEach((c) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold border transition ' +
        (activeSupplyCat === c.id ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm' : 'bg-slate-800/90 text-slate-300 border-slate-700/70 hover:text-white');
      chip.textContent = c.icon + ' ' + t('ui.shop.cat.' + c.id);
      chip.onclick = () => { activeSupplyCat = c.id; renderShopModal(); };
      chipBar.appendChild(chip);
    });
    grid.appendChild(chipBar);
    const supplyById = new Map(SHOP_SUPPLIES.map((s) => [s.id, s]));
    const supplyEntries = [];
    SHOP_SUPPLY_CATEGORIES.forEach((c) => {
      if (activeSupplyCat !== 'all' && activeSupplyCat !== c.id) return;
      const items = c.ids.map((id) => supplyById.get(id)).filter(Boolean).sort((a, b) => a.price_coins - b.price_coins);
      if (!items.length) return;
      const head = document.createElement('div');
      head.className = 'col-span-full flex items-center justify-between text-[11px] sm:text-xs font-extrabold text-emerald-300 uppercase tracking-wider pt-2 pb-1.5 border-b border-emerald-500/20';
      head.innerHTML = `<span>${c.icon} ${escapeHtml(t('ui.shop.cat.' + c.id))}</span><span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px]">${items.length}</span>`;
      grid.appendChild(head);
      items.forEach((s) => supplyEntries.push(s));
      items.forEach((sup) => renderSupplyCard(sup));
    });
    function renderSupplyCard(sup) {
      const reqXp = sup.req_xp || 0;
      const reqMush = sup.req_mushrooms || 0;
      const hasCoins = userCoins >= sup.price_coins;
      const hasXp = userXp >= reqXp;
      const hasMush = userMush >= reqMush;
      const canBuy = hasCoins && hasXp && hasMush;
      const reqLine = `🪙 ${coinsTxt(sup.price_coins)}` +
        (reqXp > 0 ? ` • ⭐ ${reqXp} XP` : '') +
        (reqMush > 0 ? ` • 🍄 ${t('ui.shop.mushrooms', { n: reqMush })}` : '');
      const card = document.createElement('div');
      card.className = 'glass-panel rounded-xl p-3 flex flex-col justify-between border border-emerald-500/35';
      card.innerHTML =
        `<div class="space-y-1.5">` +
          `<div class="flex items-center gap-2">` +
            `<span class="text-2xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">${sup.icon}</span>` +
            `<div>` +
              `<div class="font-bold text-white text-xs">${escapeHtml(nm('sup', sup, 'name'))}</div>` +
              `<div class="text-[11px] text-slate-400">${escapeHtml(nm('sup', sup, 'desc'))}</div>` +
            `</div>` +
          `</div>` +
          `<div class="pt-1 text-[11px] font-bold text-yellow-300">${reqLine}</div>` +
        `</div>`;
      const btnWrap = document.createElement('div');
      btnWrap.className = 'pt-3';
      const btn = document.createElement('button');
      btn.type = 'button';
      if (canBuy) {
        btn.className = 'w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow transition';
        btn.textContent = t('ui.shop.buyDeliver', { price: sup.price_coins });
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            if (appState.currentUser) {
              const userId = appState.currentUser.id;
              const delivery = window.getCampusShopDeliveryPose?.(sup.prefabId);
              if (!delivery) {
                toast3D(t('ui.shop.waitCampus'));
                btn.disabled = false;
                return;
              }
              if (window.flushCampusMycoCoins) await window.flushCampusMycoCoins();
              if (appState.currentUser?.id !== userId) return;
              if (pendingCoinOperations(userId).length) {
                toast3D(t('ui.shop.waitCoinSync'));
                btn.disabled = false;
                return;
              }
              const buyRes = await orderShopSupply(sup.id, delivery);
              if (!buyRes?.ok) {
                toast3D((buyRes?.pending ? '⌛ ' : '❌ ') + (buyRes?.error || t('ui.shop.buyFailed')));
                btn.disabled = false;
                return;
              }
            } else {
              const spawned = window.spawnCampusShopItem ? window.spawnCampusShopItem(sup.prefabId) : null;
              if (!spawned) {
                toast3D(t('ui.shop.enterCampus'));
                btn.disabled = false;
                return;
              }
              addLocalMycoCoins(-sup.price_coins);
            }
            if (window.MycoAudio && window.MycoAudio.playCashRegister) window.MycoAudio.playCashRegister();
            updateUserHud();
            $('shop-modal')?.classList.add('hidden');
            events.emit('sync:now');
            toast3D(appState.currentUser
              ? t('ui.shop.purchaseConfirmed', { name: nm('sup', sup, 'name') })
              : t('ui.shop.delivered', { name: nm('sup', sup, 'name') }));
          } catch (e) {
            toast3D('❌ ' + (e.message || t('ui.shop.supplyError')));
            btn.disabled = false;
          }
        };
      } else {
        btn.disabled = true;
        btn.className = 'w-full py-1.5 rounded-lg bg-slate-800/80 text-slate-500 font-semibold text-xs border border-slate-700/40';
        const missing = [];
        if (!hasCoins) missing.push(coinsTxt(sup.price_coins - userCoins));
        if (!hasXp) missing.push(`${reqXp - userXp} XP`);
        if (!hasMush) missing.push(t('ui.shop.mushrooms', { n: reqMush - userMush }));
        btn.textContent = t('ui.shop.missing', { list: missing.join(' + ') });
      }
      btnWrap.appendChild(btn);
      card.appendChild(btnWrap);
      grid.appendChild(card);
    }
    return;
  }

  const list = activeShopTab === 'toys' ? COSMETIC_TOYS : COSMETIC_HATS;
  list.forEach((item) => {
    const isToy = activeShopTab === 'toys';
    const kindKey = isToy ? 'toy' : 'hat';
    const isEquipped = isToy ? (item.id === 'paraglider' ? paragliderOn : snowboardOn) : (currentHat === item.id);
    const isUnlocked = unlocked.indexOf(item.id) !== -1 || coinUnlocked.indexOf(item.id) !== -1 || (!isToy && item.id === 'default');
    const canUnlockByXp = userXp >= item.req_xp && userMush >= item.req_mushrooms;
    const canUnlockByCoins = (item.price_coins || 0) > 0 && userCoins >= item.price_coins;
    const canUnlock = canUnlockByXp || canUnlockByCoins;

    const card = document.createElement('div');
    card.className = 'glass-panel rounded-xl p-3 flex flex-col justify-between border ' +
      (isEquipped ? 'border-emerald-400/60 shadow-lg' : (isUnlocked ? 'border-purple-500/40' : 'border-slate-700/50'));

    const top = document.createElement('div');
    top.className = 'space-y-1.5';
    top.innerHTML =
      `<div class="flex items-center gap-2">` +
        `<span class="text-2xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">${item.icon}</span>` +
        `<div>` +
          `<div class="font-bold text-white text-xs">${escapeHtml(nm(kindKey, item, 'name'))}</div>` +
          `<div class="text-[11px] text-slate-400">${escapeHtml(nm(kindKey, item, 'desc'))}</div>` +
        `</div>` +
      `</div>` +
      `<div class="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-300 font-semibold">` +
        (item.price_coins > 0 ? `<span class="text-yellow-300 font-bold">🪙 ${coinsTxt(item.price_coins)}</span>` : '') +
        (item.req_xp > 0 ? `<span class="text-amber-300">• ⭐ ${item.req_xp} XP</span>` : `<span class="text-emerald-300">${t('ui.shop.free')}</span>`) +
        (item.req_mushrooms > 0 ? `<span class="text-emerald-300">• 🍄 ${t('ui.shop.harvests', { n: item.req_mushrooms })}</span>` : '') +
      `</div>`;
    card.appendChild(top);

    const btnWrap = document.createElement('div');
    btnWrap.className = 'pt-3';

    if (isEquipped) {
      const unequipBtn = document.createElement('button');
      unequipBtn.className = 'w-full py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition';
      unequipBtn.textContent = isToy ? t('ui.shop.deactivate', { name: t(item.id === 'paraglider' ? 'ui.shop.name.paraglider' : 'ui.shop.name.snowboard') }) : t('ui.shop.deactivateHat');
      unequipBtn.onclick = async () => {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (isToy) {
          if (item.id === 'paraglider') {
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            toast3D(t('ui.shop.paragliderOff'));
          } else {
            if (window.setCampusSnowboard) window.setCampusSnowboard(false);
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            toast3D(t('ui.shop.snowboardOff'));
          }
          renderShopModal();
        } else {
          try {
            const res = await apiPost('api/auth.php?action=equip_cosmetic', { hat_id: 'none' }, true);
            if (res.ok && res.user) {
              if (appState.currentUser?.id !== res.user.id) return;
              appState.currentUser = preserveNewerPetState(appState.currentUser, res.user);
              if (window.setLocalAvatarHat) window.setLocalAvatarHat('none');
              updateUserHud();
              renderShopModal();
            }
          } catch (e) {}
        }
      };
      btnWrap.appendChild(unequipBtn);
    } else if (isUnlocked) {
      const equipBtn = document.createElement('button');
      equipBtn.className = 'w-full py-1.5 rounded-lg ' + (isToy ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-purple-600 hover:bg-purple-500') + ' text-white font-bold text-xs shadow transition';
      equipBtn.textContent = isToy ? (item.id === 'paraglider' ? t('ui.shop.activateParaglider') : t('ui.shop.activateSnowboard')) : t('ui.shop.equip');
      equipBtn.onclick = async () => {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (isToy) {
          if (item.id === 'paraglider') {
            if (window.setCampusSnowboard) window.setCampusSnowboard(false);
            if (window.setCampusParaglider) window.setCampusParaglider(true);
            toast3D(t('ui.shop.paragliderEquipped'));
          } else {
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            if (window.setCampusSnowboard) window.setCampusSnowboard(true);
            toast3D(t('ui.shop.snowboardEquipped'));
          }
          renderShopModal();
        } else {
          try {
            const res = await apiPost('api/auth.php?action=equip_cosmetic', { hat_id: item.id }, true);
            if (res.ok && res.user) {
              if (appState.currentUser?.id !== res.user.id) return;
              appState.currentUser = preserveNewerPetState(appState.currentUser, res.user);
              if (window.setLocalAvatarHat) window.setLocalAvatarHat(item.id);
              updateUserHud();
              renderShopModal();
            }
          } catch (e) {}
        }
      };
      btnWrap.appendChild(equipBtn);
    } else if (canUnlock) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow transition';
      buyBtn.textContent = canUnlockByCoins && !canUnlockByXp
        ? t('ui.shop.buyCoins', { price: item.price_coins })
        : t('ui.shop.unlock');
      buyBtn.onclick = async () => {
        try {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (canUnlockByCoins && !canUnlockByXp) {
            let syncedFromServer = false;
            if (appState.currentUser) {
              const coinRes = await apiPost('api/auth.php?action=buy_cosmetic', { hat_id: item.id, by_coins: true }, true);
              if (coinRes && coinRes.ok && coinRes.user) {
                if (appState.currentUser?.id !== coinRes.user.id) return;
                appState.currentUser = preserveNewerPetState(appState.currentUser, coinRes.user);
                setLocalMycoCoins(coinRes.user.myco_coins ?? getLocalMycoCoins());
                syncedFromServer = true;
              } else if (coinRes && coinRes.error) {
                toast3D('❌ ' + coinRes.error);
                return;
              }
            }
            if (!syncedFromServer) {
              addLocalMycoCoins(-item.price_coins);
              if (appState.currentUser) {
                if (!Array.isArray(appState.currentUser.unlocked_hats)) appState.currentUser.unlocked_hats = ['default'];
                if (appState.currentUser.unlocked_hats.indexOf(item.id) === -1) {
                  appState.currentUser.unlocked_hats.push(item.id);
                }
              }
            }
            if (coinUnlocked.indexOf(item.id) === -1) coinUnlocked.push(item.id);
            try { localStorage.setItem(coinUnlockedKey, JSON.stringify(coinUnlocked)); } catch (e) {}
            if (isToy) {
              if (item.id === 'paraglider') {
                if (window.setCampusSnowboard) window.setCampusSnowboard(false);
                if (window.setCampusParaglider) window.setCampusParaglider(true);
                toast3D(t('ui.shop.paragliderBoughtCoins'));
              } else {
                if (window.setCampusParaglider) window.setCampusParaglider(false);
                if (window.setCampusSnowboard) window.setCampusSnowboard(true);
                toast3D(t('ui.shop.snowboardBoughtCoins'));
              }
            } else {
              if (appState.currentUser) appState.currentUser.current_hat = item.id;
              if (window.setLocalAvatarHat) window.setLocalAvatarHat(item.id);
              toast3D(t('ui.shop.hatBought', { name: nm('hat', item, 'name'), price: item.price_coins }));
            }
            if (window.playCampusEmote) window.playCampusEmote('cheer');
            updateUserHud();
            renderShopModal();
            return;
          }
          const res = await apiPost('api/auth.php?action=buy_cosmetic', { hat_id: item.id }, true);
          if (res.ok && res.user) {
            if (appState.currentUser?.id !== res.user.id) return;
            appState.currentUser = preserveNewerPetState(appState.currentUser, res.user);
            if (isToy) {
              if (item.id === 'paraglider') {
                if (window.setCampusSnowboard) window.setCampusSnowboard(false);
                if (window.setCampusParaglider) window.setCampusParaglider(true);
                toast3D(t('ui.shop.paragliderUnlocked'));
              } else {
                if (window.setCampusParaglider) window.setCampusParaglider(false);
                if (window.setCampusSnowboard) window.setCampusSnowboard(true);
                toast3D(t('ui.shop.snowboardUnlocked'));
              }
            } else if (window.setLocalAvatarHat) {
              window.setLocalAvatarHat(item.id);
            }
            if (window.playCampusEmote) window.playCampusEmote('cheer');
            updateUserHud();
            renderShopModal();
          }
        } catch (e) {}
      };
      btnWrap.appendChild(buyBtn);
    } else {
      btnWrap.innerHTML = '<button disabled class="w-full py-1.5 rounded-lg bg-slate-800/80 text-slate-500 font-semibold text-xs border border-slate-700/40">' + t('ui.shop.locked') + '</button>';
    }

    card.appendChild(btnWrap);
    grid.appendChild(card);
  });
}
