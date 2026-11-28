/**
 * MycoCampus3D — Loja de Cosméticos (Chapéus & Brinquedos)
 */
import { appState } from '../core/state.js';
import { getLanguage, t } from '../core/i18n.js';
import { events } from '../core/events.js';
import { apiPost } from '../services/api-client.js';
import { preserveNewerPetState } from '../services/pets.js';
import { pendingCoinOperations } from '../services/coin-outbox.js';
import { orderShopSupply } from '../services/shop-purchases.js';
import { renderPetShop } from './pet-shop.js';
import { $, escapeHtml } from './dom-helpers.js';
import { updateUserHud } from './hud-lobby.js';
import { getLocalMycoCoins, addLocalMycoCoins, setLocalMycoCoins } from '../items/dehydration-packaging.js';
import { AVATAR_SKINS, getAvatarSkin } from '../entities/avatar-skins.js';

export const COSMETIC_HATS = [
  { id: 'default', name: 'Cogumelo Vermelho Clássico', desc: 'O clássico Amanita com pintas brancas.', req_xp: 0, req_mushrooms: 0, price_coins: 0, icon: '🍄' },
  { id: 'golden_shroom', name: 'Cogumelo Dourado Radiante', desc: 'Dourado brilhante com esferas cintilantes.', req_xp: 200, req_mushrooms: 5, price_coins: 240, icon: '👑' },
  { id: 'wizard_hood', name: 'Capuz de Alquimista', desc: 'Cone místico com runas de micologia.', req_xp: 350, req_mushrooms: 10, price_coins: 360, icon: '🧙‍♂️' },
  { id: 'grad_cap', name: 'Capelo Universitário', desc: 'Chapéu acadêmico de formatura com borla dourada.', req_xp: 500, req_mushrooms: 15, price_coins: 480, icon: '🎓' },
  { id: 'flower_crown', name: 'Coroa de Flores Silvestres', desc: 'Grinalda botânica com pétalas da floresta.', req_xp: 150, req_mushrooms: 3, price_coins: 120, icon: '🌸' },
  { id: 'beret', name: 'Boina de Pesquisador', desc: 'Estilo elegante de cientista micologista.', req_xp: 100, req_mushrooms: 2, price_coins: 120, icon: '🎨' }
];

export const COSMETIC_TOYS = [
  { id: 'skateboard', name: 'Skate MycoStreet', desc: 'Deslize pelo campus e estradas no estilo!', req_xp: 60, req_mushrooms: 1, price_coins: 90, icon: '🛹', img: 'assets/items/skateboard.jpg' },
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
  { id: 'sup_glass_bottle_1l', prefabId: 'pda_media_bottle', name: 'Frasco de Vidro 1 L com Tampa', desc: 'Frasco graduado vazio. Capacidade de trabalho de 900 ml.', price_coins: 80, icon: '🫙' },
  { id: 'sup_crate', prefabId: 'delivery_crate', name: 'Caixa de Entrega', desc: 'Transporte até 4 pacotes direto para o Drive-Thru.', price_coins: 110, icon: '📤' },
  { id: 'sup_silica', prefabId: 'silica_jar', name: 'Pote com Sílica Gel', desc: 'Conserve até 8 lotes de cogumelos crocantes.', price_coins: 140, icon: '💎' },
  { id: 'sup_grow_tent', prefabId: 'grow_tent', name: 'Grow ESP32', desc: 'Três prateleiras, nove bolos e LED integrado.', price_coins: 620, icon: '🌱' },
  { id: 'sup_grow_humidifier', prefabId: 'grow_humidifier', name: 'Umidificador para Grow', desc: 'Conecte ao grow para gerar névoa e controlar a umidade.', price_coins: 150, icon: '💧' },
  { id: 'sup_grow_exhaust', prefabId: 'grow_exhaust', name: 'Exaustor para Grow', desc: 'Conecte ao grow com um duto flexível laminado para renovar o ar.', price_coins: 170, icon: '🌀' },
  { id: 'sup_flower_seeds', prefabId: 'flower_seeds', name: 'Sementes de Flor (5 un.)', desc: 'Plante flores na grama para alimentar abelhas e gerar mel natural.', price_coins: 25, icon: '🌸' },
  { id: 'sup_bee_bait', prefabId: 'bee_bait', name: 'Isca de Abelhas (Mel & Néctar)', desc: 'Coloque ao ar livre perto de flores para atrair um novo enxame para árvores ou beirais.', price_coins: 75, icon: '🍯' },
  { id: 'sup_beehive', prefabId: 'beehive_starter', name: 'Colmeia Inicial (Com Rainha)', desc: 'Coloque no chão perto de uma árvore ou casa: a Rainha e as abelhas migram logo para o alto.', price_coins: 180, icon: '🐝' },
  { id: 'sup_pet_bowl', prefabId: 'pet_food_bowl', name: 'Potinho de Ração', desc: 'Tigela móvel para colocar onde quiser e alimentar seu pet.', price_coins: 45, icon: '🥣', img: 'assets/items/pet_bowl.jpg' },
  { id: 'sup_dog_food', prefabId: 'dog_food_bag', name: 'Ração para Cachorro (800g)', desc: 'Despeje no potinho para alimentar seu cachorro.', price_coins: 30, icon: '🦴', img: 'assets/items/dog_food_bag.jpg' },
  { id: 'sup_cat_food', prefabId: 'cat_food_bag', name: 'Ração para Gato (800g)', desc: 'Despeje no potinho para alimentar seu gato.', price_coins: 30, icon: '🐟', img: 'assets/items/cat_food_bag.jpg' },
  { id: 'sup_monotub', prefabId: 'monotub_24l', name: 'Caixa Monotub 24L', desc: 'Expanda sua produção com frutificação em massa.', price_coins: 260, icon: '📦' },
  { id: 'sup_dehydrator', prefabId: 'dehydrator', name: 'Desidratadora de Cogumelos', desc: 'Seque mais lotes simultâneos até 0% umidade.', price_coins: 380, icon: '♨️' },
  { id: 'sup_table', prefabId: 'table_stainless', name: 'Bancada Inox (1.6m)', desc: 'Mesa móvel adicional para ampliar seu laboratório.', price_coins: 320, icon: '🛠️' },
  { id: 'sup_ampoule_case', prefabId: 'ampoule_case', name: 'Maleta Porta-Ampolas 5ML (50 Vagas)', desc: '24 espécies (Cubensis, Comestíveis e Raras) já colonizadas em cultura líquida + 26 vagas extras (máx. 50).', price_coins: 1000, req_xp: 1000, req_mushrooms: 100, icon: '💼' },
  { id: 'sup_beaker_1l', prefabId: 'beaker_1l', category: 'containers', name: "Béquer graduado de 1 L", desc: "Béquer de vidro para medir e misturar líquidos.", price_coins: 75, icon: '🧪' },
  { id: 'sup_vial_3ml', prefabId: 'vial_3ml', category: 'containers', name: "Ampola vazia de 5 ml", desc: "Ampola estéril para guardar amostras na maleta.", price_coins: 30, icon: '🧪' },
  { id: 'sup_falcon_15ml', prefabId: 'falcon_15ml', category: 'containers', name: "Tubo Falcon 15 ml", desc: "Tubo graduado pequeno, com tampa.", price_coins: 35, icon: '🧪' },
  { id: 'sup_falcon_50ml', prefabId: 'falcon_50ml', category: 'containers', name: "Tubo Falcon 50 ml", desc: "Tubo graduado grande, com tampa.", price_coins: 45, icon: '🧪' },
  { id: 'sup_falcon_rack', prefabId: 'falcon_rack', category: 'containers', name: 'Suporte de Tubos Falcon', desc: 'Organize e transporte tubos juntos.', price_coins: 65, icon: '🧺' },
  { id: 'sup_petri_bare', prefabId: 'petri_bare', category: 'containers', name: "Placa de Petri sem meio", desc: "Placa vazia para receber o meio preparado no laboratório.", price_coins: 25, icon: '🧫' },
  { id: 'sup_distilled_jug', prefabId: 'distilled_jug', category: 'containers', name: "Garrafão de Água Destilada 5 L", desc: "Recipiente cheio para abastecer outros frascos.", price_coins: 75, icon: '💧' },
  { id: 'sup_mixing_bowl', prefabId: 'mixing_bowl', category: 'lab', name: "Pote de Mistura", desc: "Misture ingredientes com a colher de laboratório.", price_coins: 65, icon: '🥣' },
  { id: 'sup_lab_spoon', prefabId: 'lab_spoon', category: 'lab', name: "Colher de Laboratório", desc: "Use com o pote de mistura.", price_coins: 20, icon: '🥄' },
  { id: 'sup_lab_tray', prefabId: 'lab_tray', category: 'lab', name: "Bandeja Inox", desc: "Organize e transporte itens pequenos juntos.", price_coins: 85, icon: '🍽️' },
  { id: 'sup_scalpel', prefabId: 'scalpel', category: 'lab', name: "Bisturi", desc: "Ferramenta para coletar amostras no jogo.", price_coins: 65, icon: '🔪' },
  { id: 'sup_scalpel_blade', prefabId: 'scalpel_blade', category: 'lab', name: "Lâmina de Bisturi", desc: "Lâmina de reposição para o bisturi.", price_coins: 20, icon: '🔧' },
  { id: 'sup_pda_bottle', prefabId: 'pda_bottle', category: 'substrate', name: "Pó BDA/PDA 500 g", desc: "Frasco de reposição para o laboratório.", price_coins: 80, icon: '🫙' },
  { id: 'sup_substrate_grain', prefabId: 'substrate_grain', category: 'substrate', name: "Milho em Grão 5 kg", desc: "Saco de milho de pipoca para a bancada de preparo.", price_coins: 110, icon: '🌽' },
  { id: 'sup_substrate_wheat', prefabId: 'substrate_wheat', category: 'substrate', name: "Trigo em Grão 5 kg", desc: "Saco de trigo para a bancada de preparo.", price_coins: 110, icon: '🌾' },
  { id: 'sup_substrate_sorghum', prefabId: 'substrate_sorghum', category: 'substrate', name: "Sorgo Vermelho 5 kg", desc: "Saco de sorgo para a bancada de preparo.", price_coins: 115, icon: '🌾' },
  { id: 'sup_substrate_coco', prefabId: 'substrate_coco', category: 'substrate', name: "Pó de Coco 5 kg", desc: "Insumo para o pote de mistura e a caixa de cultivo.", price_coins: 95, icon: '🥥' },
  { id: 'sup_substrate_vermiculite', prefabId: 'substrate_vermiculite', category: 'substrate', name: "Vermiculita 5 kg", desc: "Insumo para o pote de mistura e a caixa de cultivo.", price_coins: 95, icon: '🪨' },
  { id: 'sup_substrate_sawdust', prefabId: 'substrate_sawdust', category: 'substrate', name: "Serragem de Eucalipto 5 kg", desc: "Saco para os blocos de cogumelos gourmet do jogo.", price_coins: 100, icon: '🪵' },
  { id: 'sup_paper_towel', prefabId: 'paper_towel', category: 'hygiene', name: "Papel-toalha", desc: "Seque superfícies do laboratório.", price_coins: 20, icon: '🧻' },
  { id: 'sup_gloves_box', prefabId: 'gloves_box', category: 'hygiene', name: "Caixa de Luvas", desc: "Equipe as luvas pelas ações do item.", price_coins: 35, icon: '🧤' },
  { id: 'sup_foil_roll', prefabId: 'foil_roll', category: 'hygiene', name: "Rolo de Papel-Alumínio", desc: "Proteja recipientes no laboratório.", price_coins: 30, icon: '📜' },
  { id: 'sup_micropore', prefabId: 'micropore', category: 'hygiene', name: "Fita Micropore", desc: "Rolo de fita para recipientes e placas compatíveis.", price_coins: 30, icon: '🩹' },
  { id: 'sup_parafilm', prefabId: 'parafilm', category: 'hygiene', name: "Rolo de Parafilm", desc: "Sele placas pela ação contextual.", price_coins: 35, icon: '📏' },
  { id: 'sup_lab_trash', prefabId: 'lab_trash', category: 'hygiene', name: "Lixeira de Laboratório", desc: "Ponto móvel de descarte de itens.", price_coins: 90, icon: '🗑️' },
  { id: 'sup_magnetic_stirrer', prefabId: 'magnetic_stirrer', category: 'equipment', name: "Agitador Magnético", desc: "Equipamento de bancada com controle de velocidade.", price_coins: 210, icon: '⚙️' },
  { id: 'sup_infrared_thermometer', prefabId: 'infrared_thermometer', category: 'equipment', name: "Termômetro Laser", desc: "Mire para conferir a temperatura.", price_coins: 150, icon: '🌡️' },
  { id: 'sup_precision_scale', prefabId: 'precision_scale', category: 'equipment', name: "Balança de Precisão", desc: "Pese itens e use o botão de tara.", price_coins: 180, icon: '⚖️' },
  { id: 'sup_lab_microscope', prefabId: 'lab_microscope', category: 'equipment', name: "Microscópio", desc: "Observe amostras na bancada.", price_coins: 350, icon: '🔬' },
  { id: 'sup_alcohol_lamp', prefabId: 'alcohol_lamp', category: 'equipment', name: "Lamparina a Álcool", desc: "Acenda pela ação do equipamento.", price_coins: 90, icon: '🔥' },
  { id: 'sup_culture_fridge', prefabId: 'culture_fridge', category: 'equipment', name: "Geladeira de Laboratório", desc: "Guarde amostras nas prateleiras refrigeradas.", price_coins: 480, icon: '🧊' },
  { id: 'sup_heat_sealer', prefabId: 'heat_sealer', category: 'post', name: "Seladora Térmica", desc: "Sele sacos e embalagens compatíveis.", price_coins: 230, icon: '🛠️' },
  { id: 'sup_cooker_base', prefabId: 'cooker_base', category: 'equipment', name: "Base Perfurada", desc: "Acessório que encaixa na panela.", price_coins: 65, icon: '♨️' },
  { id: 'sup_electric_burner', prefabId: 'electric_burner', category: 'equipment', name: "Fogareiro Elétrico", desc: "Fogareiro de bancada com controle de potência e timer.", price_coins: 230, icon: '🔌' },
  { id: 'sup_gas_tripod', prefabId: 'gas_tripod', category: 'equipment', name: "Tripé a Gás", desc: "Fogareiro de chão com controle de chama.", price_coins: 270, icon: '🔥' },
  { id: 'sup_pressure_cooker', prefabId: 'pressure_cooker', category: 'equipment', name: "Panela de Pressão 20 L", desc: "Panela móvel com tampa compatível inclusa.", price_coins: 360, icon: '♨️' },
  { id: 'sup_laminar_hood', prefabId: 'laminar_hood', category: 'equipment', name: "Capela de Fluxo Laminar", desc: "Estação móvel com controle de ventilação.", price_coins: 580, icon: '💨' },
];

export const SHOP_SUPPLY_CATEGORIES = [
  { id: 'containers', label: 'Recipientes', icon: '🫙', ids: ['sup_pp5', 'sup_spawn_jar', 'sup_spawn_bag', 'sup_glass_bottle_1l', 'sup_monotub'] },
  { id: 'substrate', label: 'Substratos', icon: '🌽', ids: ['sup_flocao', 'sup_lc_nutrient'] },
  { id: 'lab', label: 'Laboratório', icon: '🧪', ids: ['sup_petri', 'sup_syringe', 'sup_lc', 'sup_ampoule_case'] },
  { id: 'hygiene', label: 'Higiene & Mofo', icon: '🧴', ids: ['sup_spray', 'sup_water_spray', 'sup_h2o2'] },
  { id: 'equipment', label: 'Equipamentos', icon: '⚙️', ids: [] },
  { id: 'grow', label: 'Grow & Estufa', icon: '🌱', ids: ['sup_grow_tent', 'sup_grow_humidifier', 'sup_grow_exhaust', 'sup_flower_seeds', 'sup_bee_bait', 'sup_beehive', 'sup_pet_bowl', 'sup_dog_food', 'sup_cat_food'] },
  { id: 'post', label: 'Pós-colheita', icon: '📦', ids: ['sup_dehydrator', 'sup_silica', 'sup_mylar', 'sup_crate'] },
  { id: 'furniture', label: 'Bancadas', icon: '🛠️', ids: ['sup_table'] }
];

let activeSupplyCat = 'all';
let supplySearchQuery = '';

let activeShopTab = 'supplies';
let supplyPurchasePending = false;

events.on('pets:changed', () => {
  if (activeShopTab === 'pets' && !$('shop-modal')?.classList.contains('hidden')) renderShopModal();
});

const nm = (kind, item, field) => t(`ui.shop.${kind}.${item.id}.${field}`);
const coinsTxt = (n) => t('ui.shop.coins', { n });

function toast3D(msg) {
  if (window.showCampusToast) window.showCampusToast(msg);
}

window.toggleCampusSkateboard = function () {
  const unlocked = (appState.currentUser && appState.currentUser.unlocked_hats) || [];
  if (unlocked.indexOf('skateboard') === -1) {
    toast3D('Desbloqueie o Skate na Loja primeiro!');
    return;
  }
  const next = !(window.isCampusSkateboardActive && window.isCampusSkateboardActive());
  if (next && window.setCampusParaglider) window.setCampusParaglider(false);
  if (window.setCampusSkateboard) window.setCampusSkateboard(next);
  if (window.syncCampusUserProgress) window.syncCampusUserProgress({ equipped_toy: next ? 'skateboard' : '' });
  if (window.MycoAudio) window.MycoAudio.playClick();
  toast3D(next ? '🛹 Skate equipado!' : '🛹 Skate guardado.');
};

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

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function showShopStatus(message, error = false) {
  const status = $('shop-status');
  status.textContent = message;
  status.hidden = !message;
  status.dataset.error = String(error);
}

async function buySupply(supply, button) {
  if (supplyPurchasePending) return;
  supplyPurchasePending = true;
  button.disabled = true;
  showShopStatus(t('ui.shop.processing'));
  const userId = appState.currentUser?.id;
  try {
    if (userId != null) {
      const delivery = window.getCampusShopDeliveryPose?.(supply.prefabId);
      if (!delivery) {
        showShopStatus(t('ui.shop.waitCampus'), true);
        return;
      }
      await window.flushCampusMycoCoins?.();
      if (appState.currentUser?.id !== userId) {
        showShopStatus('');
        return;
      }
      if (pendingCoinOperations(userId).length) {
        showShopStatus(t('ui.shop.waitCoinSync'), true);
        return;
      }
      const result = await orderShopSupply(supply.id, delivery);
      if (!result?.ok) {
        showShopStatus(result?.error || t('ui.shop.buyFailed'), true);
        return;
      }
    } else {
      if (getLocalMycoCoins() < supply.price_coins) {
        showShopStatus(t('ui.shop.missing', { list: coinsTxt(supply.price_coins - getLocalMycoCoins()) }), true);
        return;
      }
      if (!window.spawnCampusShopItem?.(supply.prefabId)) {
        showShopStatus(t('ui.shop.enterCampus'), true);
        return;
      }
      addLocalMycoCoins(-supply.price_coins);
    }
    window.MycoAudio?.playCashRegister?.();
    updateUserHud();
    events.emit('sync:now');
    showShopStatus(t(userId != null ? 'ui.shop.purchaseConfirmed' : 'ui.shop.delivered', { name: nm('sup', supply, 'name') }));
  } catch (error) {
    showShopStatus(error.message || t('ui.shop.supplyError'), true);
  } finally {
    supplyPurchasePending = false;
    renderShopModal();
  }
}

function renderSupplies(grid, userCoins, userXp, userMush, scrollTop) {
  const panel = $('shop-categories');
  const search = $('shop-supply-search');
  panel.replaceChildren();
  for (const category of [{ id: 'all', icon: '🛒' }, ...SHOP_SUPPLY_CATEGORIES]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = category.icon + ' ' + t('ui.shop.cat.' + category.id);
    button.setAttribute('aria-pressed', String(activeSupplyCat === category.id));
    button.onclick = () => {
      activeSupplyCat = category.id;
      for (const chip of panel.children) chip.setAttribute('aria-pressed', String(chip === button));
      renderResults(0);
    };
    panel.appendChild(button);
  }

  search.placeholder = t('ui.shop.search_placeholder');
  search.setAttribute('aria-label', search.placeholder);
  search.value = supplySearchQuery;
  search.oninput = () => {
    supplySearchQuery = search.value;
    renderResults(0);
  };
  renderResults(scrollTop);

  function renderResults(nextScroll) {
    const terms = normalizeSearch(supplySearchQuery).split(/\s+/).filter(Boolean);
    let count = 0;
    const results = document.createDocumentFragment();
    for (const category of SHOP_SUPPLY_CATEGORIES) {
      if (activeSupplyCat !== 'all' && activeSupplyCat !== category.id) continue;
      const supplies = SHOP_SUPPLIES.filter((supply) => {
        if (supply.category ? supply.category !== category.id : !category.ids.includes(supply.id)) return false;
        if (!terms.length) return true;
        const text = normalizeSearch([nm('sup', supply, 'name'), nm('sup', supply, 'desc'), supply.name, supply.prefabId].join(' '));
        return terms.every((term) => text.includes(term));
      }).sort((a, b) => a.price_coins - b.price_coins);
      if (!supplies.length) continue;
      count += supplies.length;
      if (activeSupplyCat === 'all') {
        const heading = document.createElement('h3');
        heading.className = 'shop-section-title';
        heading.textContent = t('ui.shop.cat.' + category.id);
        results.appendChild(heading);
      }
      for (const supply of supplies) results.appendChild(makeSupplyCard(supply));
    }
    if (!count) {
      const empty = document.createElement('p');
      empty.className = 'shop-empty';
      empty.textContent = t('ui.shop.search_empty');
      results.appendChild(empty);
    }
    $('shop-results-count').textContent = t(count === 1 ? 'ui.shop.result_single' : 'ui.shop.result_count', { n: count });
    grid.replaceChildren(results);
    grid.scrollTop = nextScroll;
  }

  function makeSupplyCard(supply) {
    const card = document.createElement('article');
    card.className = 'shop-product';
    card.dataset.supplyId = supply.id;
    card.innerHTML = '<div class="shop-product-head"><span class="shop-product-icon" aria-hidden="true"></span><h4></h4></div><p></p>';
    const iconSlot = card.querySelector('.shop-product-icon');
    if (supply.img) {
      iconSlot.innerHTML = `<img src="${supply.img}" alt="${escapeHtml(supply.name)}" class="w-9 h-9 object-cover rounded-lg">`;
    } else {
      iconSlot.textContent = supply.icon;
    }
    card.querySelector('h4').textContent = nm('sup', supply, 'name');
    card.querySelector('p').textContent = nm('sup', supply, 'desc');

    const missing = [];
    if (userCoins < supply.price_coins) missing.push(coinsTxt(supply.price_coins - userCoins));
    if (userXp < (supply.req_xp || 0)) missing.push((supply.req_xp - userXp) + ' XP');
    if (userMush < (supply.req_mushrooms || 0)) missing.push(t('ui.shop.mushrooms', { n: supply.req_mushrooms - userMush }));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-product-buy';
    button.disabled = missing.length > 0 || supplyPurchasePending;
    button.textContent = t('ui.shop.buyDeliver', { price: supply.price_coins });
    if (missing.length) {
      const requirements = document.createElement('p');
      requirements.textContent = t('ui.shop.missing', { list: missing.join(' + ') });
      card.appendChild(requirements);
    }
    button.setAttribute('aria-label', nm('sup', supply, 'name') + ' · ' + button.textContent);
    button.onclick = () => buySupply(supply, button);
    card.appendChild(button);
    return card;
  }
}

let skinRequestPending = false;
const studentArt = new URL('../../assets/campus-students-low-poly.png', import.meta.url).href;
const clubArt = new URL('../../assets/campus-clubs-low-poly.png', import.meta.url).href;

function renderSkinShop(grid, user, userCoins) {
  const active = getAvatarSkin(user?.current_skin, user?.role);
  const owned = new Set(user?.unlocked_skins || []);
  const faculty = user?.role === 'professor' || user?.role === 'admin';
  const language = getLanguage();
  const languageIndex = language === 'en' ? 1 : language === 'es' ? 2 : 0;

  for (const [index, skin] of AVATAR_SKINS.entries()) {
    if (skin.faculty && !faculty) continue;
    const equipped = skin.id === active.id;
    const unlocked = skin.price === 0 || owned.has(skin.id);
    const card = document.createElement('article');
    card.className = 'shop-skin-card';
    card.classList.toggle('shop-active-skin', equipped);
    const art = document.createElement('div');
    art.className = 'shop-skin-art';
    art.setAttribute('aria-hidden', 'true');
    const tile = index % 7;
    const top = tile < 4;
    art.style.backgroundImage = `url("${index < 7 ? studentArt : clubArt}")`;
    art.style.backgroundSize = `${top ? 400 : 300}% 200%`;
    art.style.backgroundPosition = `${top ? tile * 100 / 3 : (tile - 4) * 50}% ${top ? 0 : 100}%`;
    const title = document.createElement('h3');
    title.textContent = skin.title[languageIndex];
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = equipped ? t('ui.shop.skin_active')
      : unlocked ? t('ui.shop.skin_equip') : t('ui.shop.buyCoins', { price: skin.price });
    button.disabled = !user || equipped || skinRequestPending || (!unlocked && userCoins < skin.price);
    button.addEventListener('click', async () => {
      if (skinRequestPending || appState.currentUser?.id !== user?.id) return;
      skinRequestPending = true;
      for (const control of grid.querySelectorAll('button')) control.disabled = true;
      try {
        const action = unlocked ? 'equip_skin' : 'buy_skin';
        const result = await apiPost('api/auth.php?action=' + action, { skin_id: skin.id }, true);
        if (appState.currentUser?.id !== user.id) return;
        if (!result?.ok || !result.user || result.user.id !== user.id) {
          toast3D(result?.error || t('ui.shop.skin_error'));
          return;
        }
        appState.currentUser = preserveNewerPetState(appState.currentUser, result.user);
        if (!unlocked) setLocalMycoCoins(result.user.myco_coins ?? getLocalMycoCoins());
        updateUserHud();
        if (!unlocked) window.playCampusEmote?.('cheer');
      } catch {
        toast3D(t('ui.shop.skin_error'));
      } finally {
        skinRequestPending = false;
        if (activeShopTab === 'skins') renderShopModal();
      }
    });
    card.append(art, title, button);
    if (equipped) grid.prepend(card);
    else grid.appendChild(card);
  }
}

export function renderShopModal() {
  const grid = $('shop-grid');
  if (!grid) return;
  const previousScroll = grid.scrollTop;
  grid.innerHTML = '';
  const user = appState.currentUser;
  const userXp = user ? (user.xp || 0) : 0;
  const userMush = user ? (user.mushrooms_harvested || 0) : 0;
  const unlocked = (user && user.unlocked_hats) || ['default'];
  const currentHat = (user && user.current_hat) || 'default';
  const skateboardOn = !!(window.isCampusSkateboardActive && window.isCampusSkateboardActive());
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

  for (const tab of ['supplies', 'hats', 'skins', 'toys', 'pets']) {
    const button = $('shop-tab-' + tab);
    if (!button) continue;
    button.setAttribute('aria-pressed', String(activeShopTab === tab));
    button.onclick = () => {
      if (activeShopTab === tab) return;
      activeShopTab = tab;
      grid.scrollTop = 0;
      renderShopModal();
    };
  }
  const isCatalog = activeShopTab === 'supplies';
  $('shop-toolbar').hidden = !isCatalog;
  $('shop-categories').hidden = !isCatalog;
  $('btn-close-shop')?.setAttribute('aria-label', t('ui.shop.close'));
  if (isCatalog) {
    renderSupplies(grid, userCoins, userXp, userMush, previousScroll);
    return;
  }
  if (activeShopTab === 'pets') {
    renderPetShop(grid, renderShopModal);
    return;
  }
  if (activeShopTab === 'skins') {
    renderSkinShop(grid, user, userCoins);
    grid.scrollTop = previousScroll;
    return;
  }

  const list = activeShopTab === 'toys' ? COSMETIC_TOYS : COSMETIC_HATS;
  list.forEach((item) => {
    const isToy = activeShopTab === 'toys';
    const kindKey = isToy ? 'toy' : 'hat';
    const isEquipped = isToy ? (item.id === 'paraglider' ? paragliderOn : (item.id === 'skateboard' ? skateboardOn : snowboardOn)) : (currentHat === item.id);
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
        (item.img
          ? `<img src="${item.img}" alt="${escapeHtml(item.name)}" class="w-10 h-10 object-cover rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">`
          : `<span class="text-2xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">${item.icon}</span>`) +
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
      unequipBtn.textContent = isToy ? t('ui.shop.deactivate', { name: item.id === 'skateboard' ? 'Skate' : t(item.id === 'paraglider' ? 'ui.shop.name.paraglider' : 'ui.shop.name.snowboard') }) : t('ui.shop.deactivateHat');
      unequipBtn.onclick = async () => {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (isToy) {
          if (item.id === 'paraglider') {
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            toast3D(t('ui.shop.paragliderOff'));
          } else if (item.id === 'skateboard') {
            if (window.setCampusSkateboard) window.setCampusSkateboard(false);
            toast3D('🛹 Skate guardado.');
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
      equipBtn.textContent = isToy ? (item.id === 'paraglider' ? t('ui.shop.activateParaglider') : (item.id === 'skateboard' ? '🛹 Ativar Skate' : t('ui.shop.activateSnowboard'))) : t('ui.shop.equip');
      equipBtn.onclick = async () => {
        if (window.MycoAudio) window.MycoAudio.playClick();
        if (isToy) {
          if (item.id === 'paraglider') {
            if (window.setCampusSnowboard) window.setCampusSnowboard(false);
            if (window.setCampusSkateboard) window.setCampusSkateboard(false);
            if (window.setCampusParaglider) window.setCampusParaglider(true);
            toast3D(t('ui.shop.paragliderEquipped'));
          } else if (item.id === 'skateboard') {
            if (window.setCampusParaglider) window.setCampusParaglider(false);
            if (window.setCampusSkateboard) window.setCampusSkateboard(true);
            toast3D('🛹 Skate equipado!');
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
