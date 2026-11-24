import { appState } from '../core/state.js';
import { getLanguage } from '../core/i18n.js';
import { petAction, buyCatFood } from '../services/pets.js';
import { pendingCoinOperations } from '../services/coin-outbox.js';
import { setLocalMycoCoins } from '../items/dehydration-packaging.js';
import { updateUserHud } from './hud-lobby.js';

export const PETS = [
  { id: 'cat_orange', icon: '🐈', name: 'Gatinho laranja', desc: 'Rajadinho com peito branco.' },
  { id: 'cat_black', icon: '🐈‍⬛', name: 'Gatinho preto', desc: 'Olhos verdes e patinhas brancas.' },
  { id: 'cat_calico', icon: '🐈', name: 'Gatinho tricolor', desc: 'Manchinhas laranja, pretas e brancas.' },
  { id: 'dog_golden', icon: '🐕', name: 'Cachorrinho dourado', desc: 'Orelhas caídas e pelo dourado.' },
  { id: 'dog_husky', icon: '🐕', name: 'Cachorrinho husky', desc: 'Pelagem cinza e branca.' },
  { id: 'dog_pug', icon: '🐶', name: 'Cachorrinho pug', desc: 'Focinho escuro e cauda enrolada.' }
];

const PET_TEXT = {
  'pt-BR': {
    login: 'Entre na sua conta para comprar e cuidar dos pets.', buy: 'Comprar', call: 'Chamar este pet', putAway: 'Guardar pet',
    roam: 'Andar solto', follow: 'Me seguir', stay: 'Ficar por aqui', stayHere: 'Marcar este local', foodBowl: 'Potinho de comida', waterBowl: 'Potinho de água',
    buyBowl: 'Compre uma vez e coloque onde quiser.', placeHint: 'Coloque o potinho à sua frente no campus.', full: 'O potinho está cheio.', empty: 'O potinho está vazio.',
    moveBowl: 'Mudar potinho de lugar', place: 'Colocar à minha frente', fillFood: 'Colocar ração de gato', fillWater: 'Encher com água',
    food: 'Ração para gatos', portions: n => `Pacote com 5 porções. Você tem ${n} porções.`, enter: 'Entre no campus para colocar o potinho.', sync: 'Aguarde a sincronização das moedas e tente novamente.', error: 'Não foi possível concluir. Tente novamente.', network: 'Falha de conexão. Tente novamente.'
  },
  en: {
    names: ['Orange kitten', 'Black kitten', 'Calico kitten', 'Golden puppy', 'Husky puppy', 'Pug puppy'],
    descriptions: ['Striped with a white chest.', 'Green eyes and white paws.', 'Orange, black and white patches.', 'Golden fur and floppy ears.', 'Gray and white fur.', 'Dark muzzle and curled tail.'],
    login: 'Sign in to buy and care for pets.', buy: 'Buy', call: 'Call this pet', putAway: 'Put pet away',
    roam: 'Roam freely', follow: 'Follow me', stay: 'Stay nearby', stayHere: 'Set this spot', foodBowl: 'Food bowl', waterBowl: 'Water bowl',
    buyBowl: 'Buy once and place wherever you like.', placeHint: 'Place the bowl in front of you on campus.', full: 'The bowl is full.', empty: 'The bowl is empty.',
    moveBowl: 'Move bowl', place: 'Place in front of me', fillFood: 'Add cat food', fillWater: 'Fill with water',
    food: 'Cat food', portions: n => `Pack of 5 servings. You have ${n} servings.`, enter: 'Enter the campus to place the bowl.', sync: 'Wait for your coins to sync and try again.', error: 'Could not complete. Please try again.', network: 'Connection failed. Please try again.'
  },
  es: {
    names: ['Gatito naranja', 'Gatito negro', 'Gatito tricolor', 'Cachorro dorado', 'Cachorro husky', 'Cachorro pug'],
    descriptions: ['Atigrado con pecho blanco.', 'Ojos verdes y patitas blancas.', 'Manchas naranjas, negras y blancas.', 'Pelaje dorado y orejas caídas.', 'Pelaje gris y blanco.', 'Hocico oscuro y cola enrollada.'],
    login: 'Inicia sesión para comprar y cuidar mascotas.', buy: 'Comprar', call: 'Llamar a esta mascota', putAway: 'Guardar mascota',
    roam: 'Pasear libremente', follow: 'Sígueme', stay: 'Quédate por aquí', stayHere: 'Marcar este lugar', foodBowl: 'Cuenco de comida', waterBowl: 'Cuenco de agua',
    buyBowl: 'Cómpralo una vez y colócalo donde quieras.', placeHint: 'Coloca el cuenco frente a ti en el campus.', full: 'El cuenco está lleno.', empty: 'El cuenco está vacío.',
    moveBowl: 'Mover cuenco', place: 'Colocar frente a mí', fillFood: 'Poner comida de gato', fillWater: 'Llenar con agua',
    food: 'Comida para gatos', portions: n => `Paquete de 5 porciones. Tienes ${n} porciones.`, enter: 'Entra al campus para colocar el cuenco.', sync: 'Espera a que se sincronicen tus monedas e inténtalo de nuevo.', error: 'No se pudo completar. Inténtalo de nuevo.', network: 'Falló la conexión. Inténtalo de nuevo.'
  }
};

function card(grid, title, description) {
  const el = document.createElement('div');
  el.className = 'glass-panel rounded-xl p-3 flex flex-col gap-2 border border-amber-500/35';
  const heading = document.createElement('div');
  heading.className = 'font-bold text-white text-xs';
  heading.textContent = title;
  const desc = document.createElement('div');
  desc.className = 'text-[11px] text-slate-300';
  desc.textContent = description;
  el.append(heading, desc);
  grid.appendChild(el);
  return el;
}
function actionButton(container, label, callback, disabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-xs transition';
  btn.textContent = label;
  btn.disabled = disabled;
  btn.onclick = async () => {
    btn.disabled = true;
    try { await callback(); } catch (_) { window.showCampusToast?.('❌ ' + (PET_TEXT[getLanguage()] || PET_TEXT['pt-BR']).network); }
    finally { btn.disabled = false; }
  };
  container.appendChild(btn);
}

export function renderPetShop(grid, rerender) {
  const text = PET_TEXT[getLanguage()] || PET_TEXT['pt-BR'];
  const user = appState.currentUser;
  if (!user) {
    card(grid, '🐾 Pets', text.login);
    return;
  }
  const pets = user.progress?.pets || {};
  const owned = pets.owned || [];
  async function run(op, data = {}, purchase = false) {
    const userId = appState.currentUser?.id;
    if (purchase && window.flushCampusMycoCoins) await window.flushCampusMycoCoins();
    if (appState.currentUser?.id !== userId) return;
    if (purchase && pendingCoinOperations(userId).length) { window.showCampusToast?.(text.sync); return; }
    const res = op === 'buy_cat_food' ? await buyCatFood() : await petAction(op, data);
    if (!res?.ok) {
      window.showCampusToast?.('❌ ' + (res?.error || text.error));
      return;
    }
    if (purchase && res.user && appState.currentUser?.id === userId) {
      const pending = pendingCoinOperations(userId).reduce((sum, entry) => sum + entry.delta, 0);
      setLocalMycoCoins(res.user.myco_coins + pending);
    }
    updateUserHud();
    rerender();
  }
  for (const [index, pet] of PETS.entries()) {
    const el = card(grid, `${pet.icon} ${text.names?.[index] || pet.name}`, text.descriptions?.[index] || pet.desc);
    if (!owned.includes(pet.id)) {
      actionButton(el, `🪙 ${text.buy} · 200 MycoCoins`, () => run('buy_pet', { pet_id: pet.id }, true));
    } else if (pets.selected !== pet.id) {
      actionButton(el, '🐾 ' + text.call, () => run('select', { pet_id: pet.id }));
    } else {
      actionButton(el, '💤 ' + text.putAway, () => run('select', { pet_id: '' }));
      for (const mode of ['follow', 'roam', 'stay']) {
        const current = mode === (pets.mode || 'follow');
        actionButton(el, `${current ? '✓ ' : ''}${current && mode === 'stay' ? text.stayHere : text[mode]}`, () => {
          if (mode !== 'stay') return run('mode', { mode });
          const pos = window.getCampusPetBowlPosition?.();
          if (!pos) { window.showCampusToast?.(text.enter); return; }
          return run('mode', { mode, pos });
        }, current && mode !== 'stay');
      }
    }
  }
  for (const [kind, name] of [['food', '🍽️ ' + text.foodBowl], ['water', '💧 ' + text.waterBowl]]) {
    const bowl = pets.bowls?.[kind] || {};
    const el = card(grid, name, !bowl.owned ? text.buyBowl : !bowl.pos ? text.placeHint : bowl.full ? text.full : text.empty);
    if (!bowl.owned) actionButton(el, `🪙 ${text.buy} · 40 MycoCoins`, () => run('buy_' + kind + '_bowl', {}, true));
    else {
      actionButton(el, '📍 ' + (bowl.pos ? text.moveBowl : text.place), async () => {
        const pos = window.getCampusPetBowlPosition?.();
        if (!pos) { window.showCampusToast?.(text.enter); return; }
        await run('place_' + kind, { pos });
      });
      if (bowl.pos) actionButton(el, kind === 'food' ? '🍽️ ' + text.fillFood : '💧 ' + text.fillWater, () => run('fill_' + kind), !!bowl.full);
    }
  }
  const food = card(grid, '🐟 ' + text.food, text.portions(pets.cat_food || 0));
  actionButton(food, `🪙 ${text.buy} · 25 MycoCoins`, () => run('buy_cat_food', {}, true));
}
