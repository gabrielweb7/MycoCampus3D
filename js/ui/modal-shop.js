/**
 * MycoCampus3D — Loja de Cosméticos (Chapéus & Brinquedos)
 */
import { appState } from '../core/state.js';
import { apiPost } from '../services/api-client.js';
import { $, escapeHtml } from './dom-helpers.js';
import { updateUserHud } from './hud-lobby.js';
import { getLocalMycoCoins, addLocalMycoCoins } from '../items/dehydration-packaging.js';

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
  { id: 'sup_petri', prefabId: 'petri_empty', name: 'Placa de Petri (PDA)', desc: 'Placa de cultivo para isolar genética.', price_coins: 45, icon: '🧫' },
  { id: 'sup_mylar', prefabId: 'mylar_bag', name: 'Saco Mylar Metalizado', desc: 'Saco para embalar 10g/25g e vender no Empório.', price_coins: 45, icon: '🛍️' },
  { id: 'sup_flocao', prefabId: 'flocao_500g', name: 'Flocão de Milho 500g', desc: 'Substrato nutritivo para potes PP5 e misturas.', price_coins: 50, icon: '🌽' },
  { id: 'sup_spray', prefabId: 'alcohol_spray', name: 'Borrifador Álcool 70%', desc: 'Higienizador extra para suas bancadas.', price_coins: 60, icon: '🧴' },
  { id: 'sup_spawn_jar', prefabId: 'spawn_jar', name: 'Vidro 800ml (Spawn)', desc: 'Mais espaço para cultivar grãos inoculados.', price_coins: 70, icon: '🫙' },
  { id: 'sup_spawn_bag', prefabId: 'spawn_bag', name: 'Bag de Cultivo 1,5kg', desc: 'Saco filtrante grande de cultivo e colonização.', price_coins: 85, icon: '🍄' },
  { id: 'sup_lc', prefabId: 'liquid_culture', name: 'Frasco Cultura Líquida 800ml', desc: 'Vidro com tampa de porta autoclavável.', price_coins: 90, icon: '🧪' },
  { id: 'sup_crate', prefabId: 'delivery_crate', name: 'Caixa de Entrega', desc: 'Transporte até 4 pacotes direto para o Drive-Thru.', price_coins: 110, icon: '📤' },
  { id: 'sup_silica', prefabId: 'silica_jar', name: 'Pote com Sílica Gel', desc: 'Conserve até 8 lotes de cogumelos crocantes.', price_coins: 140, icon: '💎' },
  { id: 'sup_monotub', prefabId: 'monotub_24l', name: 'Caixa Monotub 24L', desc: 'Expanda sua produção com frutificação em massa.', price_coins: 260, icon: '📦' },
  { id: 'sup_dehydrator', prefabId: 'dehydrator', name: 'Desidratadora de Cogumelos', desc: 'Seque mais lotes simultâneos até 0% umidade.', price_coins: 380, icon: '♨️' },
  { id: 'sup_table', prefabId: 'table_stainless', name: 'Bancada Inox (1.6m)', desc: 'Mesa móvel adicional para ampliar seu laboratório.', price_coins: 320, icon: '🛠️' }
];

let activeShopTab = 'hats';

function toast3D(msg) {
  if (window.showCampusToast) window.showCampusToast(msg);
}

window.toggleCampusSnowboard = function () {
  const unlocked = (appState.currentUser && appState.currentUser.unlocked_hats) || [];
  if (unlocked.indexOf('snowboard') === -1) {
    toast3D('🔒 Desbloqueie o Snowboard na 👑 Loja -> 🏂 Brinquedos!');
    return;
  }
  const next = !(window.isCampusSnowboardActive && window.isCampusSnowboardActive());
  if (next && window.setCampusParaglider) window.setCampusParaglider(false);
  if (window.setCampusSnowboard) window.setCampusSnowboard(next);
  if (window.MycoAudio) window.MycoAudio.playClick();
  toast3D(next ? '🏂 Snowboard ativado! Olhe para baixo para ver nos seus pés!' : '🏂 Snowboard guardado!');
};

window.toggleCampusParaglider = function () {
  const unlocked = (appState.currentUser && appState.currentUser.unlocked_hats) || [];
  if (unlocked.indexOf('paraglider') === -1) {
    toast3D('🔒 Desbloqueie o Paraglider na 👑 Loja -> 🏂 Brinquedos!');
    return;
  }
  const next = !(window.isCampusParagliderActive && window.isCampusParagliderActive());
  if (next && window.setCampusSnowboard) window.setCampusSnowboard(false);
  if (window.setCampusParaglider) window.setCampusParaglider(next);
  if (window.MycoAudio) window.MycoAudio.playClick();
  toast3D(next ? '🪂 Paraglider ativado! Salte de uma montanha e entre nas correntes de ar!' : '🪂 Paraglider guardado!');
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
  try {
    const rawC = localStorage.getItem('myco_coin_unlocked_items');
    if (rawC) coinUnlocked = JSON.parse(rawC) || [];
  } catch (e) {}

  const tabHats = $('shop-tab-hats');
  const tabToys = $('shop-tab-toys');
  const tabSupplies = $('shop-tab-supplies');
  if (tabHats && tabToys) {
    tabHats.className = 'px-3 py-1 rounded-lg font-bold text-xs transition ' + (activeShopTab === 'hats' ? 'bg-purple-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white');
    tabToys.className = 'px-3 py-1 rounded-lg font-bold text-xs transition ' + (activeShopTab === 'toys' ? 'bg-cyan-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white');
    if (tabSupplies) {
      tabSupplies.className = 'px-3 py-1 rounded-lg font-bold text-xs transition ' + (activeShopTab === 'supplies' ? 'bg-emerald-600 text-white' : 'bg-slate-800/80 text-slate-300 hover:text-white');
      tabSupplies.onclick = () => { activeShopTab = 'supplies'; renderShopModal(); };
    }
    tabHats.onclick = () => { activeShopTab = 'hats'; renderShopModal(); };
    tabToys.onclick = () => { activeShopTab = 'toys'; renderShopModal(); };
  }

  if (activeShopTab === 'supplies') {
    SHOP_SUPPLIES.forEach((sup) => {
      const canBuy = userCoins >= sup.price_coins;
      const card = document.createElement('div');
      card.className = 'glass-panel rounded-xl p-3 flex flex-col justify-between border border-emerald-500/35';
      card.innerHTML =
        `<div class="space-y-1.5">` +
          `<div class="flex items-center gap-2">` +
            `<span class="text-2xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">${sup.icon}</span>` +
            `<div>` +
              `<div class="font-bold text-white text-xs">${escapeHtml(sup.name)}</div>` +
              `<div class="text-[11px] text-slate-400">${escapeHtml(sup.desc)}</div>` +
            `</div>` +
          `</div>` +
          `<div class="pt-1 text-[11px] font-bold text-yellow-300">🪙 ${sup.price_coins} MycoCoins</div>` +
        `</div>`;
      const btnWrap = document.createElement('div');
      btnWrap.className = 'pt-3';
      const btn = document.createElement('button');
      btn.type = 'button';
      if (canBuy) {
        btn.className = 'w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow transition';
        btn.textContent = `🛒 Comprar & Entregar (🪙 ${sup.price_coins})`;
        btn.onclick = () => {
          const spawned = window.spawnCampusShopItem ? window.spawnCampusShopItem(sup.prefabId) : null;
          if (!spawned) {
            toast3D('⚠️ Entre no Campus 3D para receber sua entrega!');
            return;
          }
          addLocalMycoCoins(-sup.price_coins);
          if (window.MycoAudio && window.MycoAudio.playCashRegister) window.MycoAudio.playCashRegister();
          updateUserHud();
          $('shop-modal')?.classList.add('hidden');
          toast3D(`📦 ${sup.name} entregue bem à sua frente!`);
        };
      } else {
        btn.disabled = true;
        btn.className = 'w-full py-1.5 rounded-lg bg-slate-800/80 text-slate-500 font-semibold text-xs border border-slate-700/40';
        btn.textContent = `🔒 Faltam ${sup.price_coins - userCoins} MycoCoins`;
      }
      btnWrap.appendChild(btn);
      card.appendChild(btnWrap);
      grid.appendChild(card);
    });
    return;
  }

  const list = activeShopTab === 'toys' ? COSMETIC_TOYS : COSMETIC_HATS;
  list.forEach((item) => {
    const isToy = activeShopTab === 'toys';
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
          `<div class="font-bold text-white text-xs">${escapeHtml(item.name)}</div>` +
          `<div class="text-[11px] text-slate-400">${escapeHtml(item.desc)}</div>` +
        `</div>` +
      `</div>` +
      `<div class="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-300 font-semibold">` +
        (item.price_coins > 0 ? `<span class="text-yellow-300 font-bold">🪙 ${item.price_coins} MycoCoins</span>` : '') +
        (item.req_xp > 0 ? `<span class="text-amber-300">• ⭐ ${item.req_xp} XP</span>` : `<span class="text-emerald-300">Grátis</span>`) +
        (item.req_mushrooms > 0 ? `<span class="text-emerald-300">• 🍄 ${item.req_mushrooms} colheitas</span>` : '') +
      `</div>`;
    card.appendChild(top);

    const btnWrap = document.createElement('div');
    btnWrap.className = 'pt-3';

    if (isEquipped) {
      const unequipBtn = document.createElement('button');
      unequipBtn.className = 'w-full py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition';
      unequipBtn.textContent = isToy ? (`❌ Desativar ${item.id === 'paraglider' ? 'Paraglider' : 'Snowboard'}`) : '❌ Desativar Chapéu';
      unequipBtn.onclick = async () => {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (isToy) {
          if (item.id === 'paraglider') {
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            toast3D('🪂 Paraglider guardado!');
          } else {
            if (window.setCampusSnowboard) window.setCampusSnowboard(false);
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            toast3D('🏂 Snowboard guardado!');
          }
          renderShopModal();
        } else {
          try {
            const res = await apiPost('api/auth.php?action=equip_cosmetic', { hat_id: 'none' }, true);
            if (res.ok && res.user) {
              appState.currentUser = res.user;
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
      equipBtn.textContent = isToy ? (item.id === 'paraglider' ? '🪂 Ativar Paraglider' : '🏂 Ativar Snowboard') : 'Equipar';
      equipBtn.onclick = async () => {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (isToy) {
          if (item.id === 'paraglider') {
            if (window.setCampusSnowboard) window.setCampusSnowboard(false);
            if (window.setCampusParaglider) window.setCampusParaglider(true);
            toast3D('🪂 Paraglider ativado! Salte de uma montanha e pegue as correntes de ar! (P para alternar)');
          } else {
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            if (window.setCampusSnowboard) window.setCampusSnowboard(true);
            toast3D('🏂 Snowboard ativado! Olhe para baixo para ver nos seus pés ou suba a montanha! (B para alternar)');
          }
          renderShopModal();
        } else {
          try {
            const res = await apiPost('api/auth.php?action=equip_cosmetic', { hat_id: item.id }, true);
            if (res.ok && res.user) {
              appState.currentUser = res.user;
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
        ? `🪙 Comprar (${item.price_coins} MycoCoins)`
        : '🎉 Desbloquear';
      buyBtn.onclick = async () => {
        try {
          if (window.MycoAudio) window.MycoAudio.playClick();
          if (canUnlockByCoins && !canUnlockByXp) {
            let syncedFromServer = false;
            if (appState.currentUser) {
              const coinRes = await apiPost('api/auth.php?action=buy_cosmetic', { hat_id: item.id, by_coins: true }, true);
              if (coinRes && coinRes.ok && coinRes.user) {
                appState.currentUser = coinRes.user;
                try { localStorage.setItem('myco_coins', String(coinRes.user.myco_coins ?? getLocalMycoCoins())); } catch (e) {}
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
            try { localStorage.setItem('myco_coin_unlocked_items', JSON.stringify(coinUnlocked)); } catch (e) {}
            if (isToy) {
              if (item.id === 'paraglider') {
                if (window.setCampusSnowboard) window.setCampusSnowboard(false);
                if (window.setCampusParaglider) window.setCampusParaglider(true);
                toast3D('🪂 Paraglider comprado com MycoCoins! Vá para as 🏔️ Montanhas e salte!');
              } else {
                if (window.setCampusParaglider) window.setCampusParaglider(false);
                if (window.setCampusSnowboard) window.setCampusSnowboard(true);
                toast3D('🏂 Snowboard comprado com MycoCoins e ativado!');
              }
            } else {
              if (appState.currentUser) appState.currentUser.current_hat = item.id;
              if (window.setLocalAvatarHat) window.setLocalAvatarHat(item.id);
              toast3D(`👑 ${item.name} comprado com 🪙 ${item.price_coins} MycoCoins e equipado!`);
            }
            if (window.playCampusEmote) window.playCampusEmote('cheer');
            updateUserHud();
            renderShopModal();
            return;
          }
          const res = await apiPost('api/auth.php?action=buy_cosmetic', { hat_id: item.id }, true);
          if (res.ok && res.user) {
            appState.currentUser = res.user;
            if (isToy) {
              if (item.id === 'paraglider') {
                if (window.setCampusSnowboard) window.setCampusSnowboard(false);
                if (window.setCampusParaglider) window.setCampusParaglider(true);
                toast3D('🪂 Paraglider desbloqueado! Vá para as 🏔️ Montanhas no 🗺️ Mapa e salte!');
              } else {
                if (window.setCampusParaglider) window.setCampusParaglider(false);
                if (window.setCampusSnowboard) window.setCampusSnowboard(true);
                toast3D('🏂 Snowboard desbloqueado e ativado! Suba a montanha no 🗺️ Mapa!');
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
      btnWrap.innerHTML = '<button disabled class="w-full py-1.5 rounded-lg bg-slate-800/80 text-slate-500 font-semibold text-xs border border-slate-700/40">🔒 Bloqueado</button>';
    }

    card.appendChild(btnWrap);
    grid.appendChild(card);
  });
}
