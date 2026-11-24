import { appState } from '../core/state.js';
import { apiPost } from './api-client.js';
import { events } from '../core/events.js';

let queue = Promise.resolve();

export function preserveNewerPetState(current, incoming) {
  if (!current || !incoming || current.id !== incoming.id) return incoming;
  const oldPets = current.progress?.pets;
  const newPets = incoming.progress?.pets;
  if (oldPets && (!newPets || (oldPets.revision || 0) > (newPets.revision || 0))) {
    incoming.progress = { ...incoming.progress, pets: oldPets };
  }
  return incoming;
}

// Every operation is serialized: an eating animation must not overwrite a
// simultaneous purchase or selection with an older account snapshot.
export function petAction(operation, data = {}) {
  const userId = appState.currentUser?.id;
  if (!userId) return Promise.resolve({ ok: false, error: 'Entre na sua conta para cuidar dos pets.' });
  const run = async () => {
    if (appState.currentUser?.id !== userId) return { ok: false, error: 'Conta alterada.' };
    const result = await apiPost('api/auth.php?action=pet_action', { operation, ...data }, true);
    if (result.ok && result.user && appState.currentUser?.id === userId) {
      appState.currentUser = preserveNewerPetState(appState.currentUser, result.user);
      events.emit('pets:changed', result.user.progress?.pets);
    }
    return result;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

function foodKey(userId) { return `myco_pending_cat_food_u${userId}`; }

// Reuse the same id after an interrupted request, including after a reload.
export async function buyCatFood() {
  const userId = appState.currentUser?.id;
  if (!userId) return { ok: false, error: 'Entre na sua conta para comprar ração.' };
  let id;
  try {
    const key = foodKey(userId);
    id = localStorage.getItem(key);
    if (!/^pet_food_[a-f0-9]{32}$/.test(id || '')) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = 'pet_food_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(key, id);
    }
    if (localStorage.getItem(key) !== id) throw new Error('storage');
  } catch (_) {
    return { ok: false, error: 'Não foi possível salvar o pedido de ração neste dispositivo.' };
  }
  try {
    const result = await petAction('buy_cat_food', { operation_id: id });
    if (result.ok || result.charged === false) {
      try { localStorage.removeItem(foodKey(userId)); } catch (_) {}
    }
    return result;
  } catch (_) {
    return { ok: false, error: 'Conexão interrompida. Toque em comprar novamente para confirmar o pedido.' };
  }
}
