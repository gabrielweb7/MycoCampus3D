import { VILLAGE_ENTRY, VILLAGE_LOTS } from '../core/village-layout.js';
import { getLanguage } from '../core/i18n.js';
import { appState } from '../core/state.js';
import { events } from '../core/events.js';
import { apiPost } from '../services/api-client.js';
import { pendingCoinOperations } from '../services/coin-outbox.js';
import { setLocalMycoCoins } from '../items/dehydration-packaging.js';
import { updateUserHud } from './hud-lobby.js';
import { showFloatingToast } from './dom-helpers.js';

const COPY = {
  'pt-BR': {
    back: 'Voltar ao mapa', visit: 'Ir até a vila', login: 'Entre na sua conta para alugar.',
    loading: 'Consultando os lotes…', unavailable: 'A vila está indisponível. Tente carregar novamente.',
    retry: 'Tentar novamente', pending: 'Confirme o aluguel pendente', success: 'Aluguel confirmado!',
    coins: 'Aguarde a sincronização das moedas.', failed: 'Não foi possível confirmar o aluguel.',
    lot: id => `Casa ${id}`, free: 'Disponível', yours: 'Sua casa', rented: 'Alugada',
    expires: date => `Até ${date}`, option: (days, cost) => `${days} ${days === 1 ? 'dia' : 'dias'} · ${cost} 🪙`,
    renew: 'Renovar', rent: 'Alugar', realTime: 'O aluguel é contado em dias corridos.',
    storage: 'Depósito pessoal', withdraw: 'Entregar no quintal', delivered: 'Item entregue no quintal.',
    notebook: 'Caderno de experimentos', save: 'Salvar anotações', saved: 'Anotações salvas.',
    market: 'Deixe um Mylar selado de 10 g ou 25 g na bancada do quintal para o comprador retirar.'
  },
  en: {
    back: 'Back to map', visit: 'Visit the village', login: 'Sign in to rent a house.',
    loading: 'Checking the lots…', unavailable: 'The village is unavailable. Please reload.',
    retry: 'Try again', pending: 'Confirm pending rental', success: 'Rental confirmed!',
    coins: 'Wait for your coins to sync.', failed: 'Could not confirm the rental.',
    lot: id => `House ${id}`, free: 'Available', yours: 'Your house', rented: 'Rented',
    expires: date => `Until ${date}`, option: (days, cost) => `${days} ${days === 1 ? 'day' : 'days'} · ${cost} 🪙`,
    renew: 'Renew', rent: 'Rent', realTime: 'Rent is counted in real-world days.',
    storage: 'Personal storage', withdraw: 'Deliver to yard', delivered: 'Item delivered to your yard.',
    notebook: 'Experiment notebook', save: 'Save notes', saved: 'Notes saved.',
    market: 'Place a sealed 10 g or 25 g Mylar bag on the yard counter for pickup.'
  },
  es: {
    back: 'Volver al mapa', visit: 'Visitar la villa', login: 'Inicia sesión para alquilar.',
    loading: 'Consultando los lotes…', unavailable: 'La villa no está disponible. Vuelve a intentar.',
    retry: 'Reintentar', pending: 'Confirmar el alquiler pendiente', success: '¡Alquiler confirmado!',
    coins: 'Espera a que se sincronicen tus monedas.', failed: 'No se pudo confirmar el alquiler.',
    lot: id => `Casa ${id}`, free: 'Disponible', yours: 'Tu casa', rented: 'Alquilada',
    expires: date => `Hasta ${date}`, option: (days, cost) => `${days} ${days === 1 ? 'día' : 'días'} · ${cost} 🪙`,
    renew: 'Renovar', rent: 'Alquilar', realTime: 'El alquiler se cuenta en días reales.',
    storage: 'Depósito personal', withdraw: 'Entregar en el patio', delivered: 'Artículo entregado en tu patio.',
    notebook: 'Cuaderno de experimentos', save: 'Guardar notas', saved: 'Notas guardadas.',
    market: 'Deja una bolsa Mylar sellada de 10 g o 25 g en el mostrador del patio para la recogida.'
  }
};

function addButton(container, name, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rounded-lg px-3 py-2 bg-sky-800/60 hover:bg-sky-700/70 text-sm font-bold text-white disabled:opacity-50';
  button.textContent = name;
  button.onclick = onClick;
  container.appendChild(button);
  return button;
}

function requestKey(userId) {
  return `myco_village_rental_v1_${userId}`;
}

function readPendingRental(userId) {
  try { return JSON.parse(localStorage.getItem(requestKey(userId))); }
  catch { return null; }
}

function prepareRental(userId, lotId, days) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const suffix = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const request = { lot_id: lotId, days, operation_id: `village_rent_${lotId}_${days}_${suffix}` };
  localStorage.setItem(requestKey(userId), JSON.stringify(request));
  if (readPendingRental(userId)?.operation_id !== request.operation_id) throw new Error('storage');
  return request;
}

export function renderVillageRentals(grid, back, focusLot = null) {
  const lang = getLanguage();
  const copy = COPY[lang] || COPY['pt-BR'];
  const userId = appState.currentUser?.id;
  const panel = document.createElement('div');
  panel.className = 'col-span-full grid gap-3';
  grid.replaceChildren(panel);

  const nav = document.createElement('div');
  nav.className = 'flex flex-wrap gap-2';
  panel.appendChild(nav);
  addButton(nav, copy.back, back);
  addButton(nav, copy.visit, () => {
    window.teleportCampusPlayer?.(VILLAGE_ENTRY.x, VILLAGE_ENTRY.y, VILLAGE_ENTRY.z, VILLAGE_ENTRY.yaw);
    document.getElementById('map-modal')?.classList.add('hidden');
  });

  const info = document.createElement('p');
  info.setAttribute('role', 'status');
  info.className = 'text-sm text-slate-300';
  panel.appendChild(info);
  if (!userId) { info.textContent = copy.login; return; }
  const list = document.createElement('div');
  list.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';
  panel.appendChild(list);
  let busy = false;

  async function rent(request, control) {
    if (busy || appState.currentUser?.id !== userId) return;
    busy = true;
    control.disabled = true;
    try {
      await window.flushCampusMycoCoins?.();
      if (appState.currentUser?.id !== userId) return;
      if (pendingCoinOperations(userId).length) { showFloatingToast(copy.coins); return; }
      const result = await apiPost('api/village.php?action=rent', request, true);
      if (appState.currentUser?.id !== userId) return;
      if (result?.ok || result?.charged === false) {
        if (readPendingRental(userId)?.operation_id === request.operation_id) localStorage.removeItem(requestKey(userId));
      }
      if (result?.ok) {
        const lease = result.lots.find(row => row.mine);
        appState.villageLease = lease ? { id: lease.id, expires_at: lease.expires_at } : null;
        appState.currentUser.myco_coins = result.myco_coins;
        setLocalMycoCoins(result.myco_coins + pendingCoinOperations(userId).reduce((total, entry) => total + entry.delta, 0));
        updateUserHud();
        events.emit('sync:now');
        showFloatingToast(copy.success);
      } else showFloatingToast(result?.error || copy.failed);
    } catch { showFloatingToast(copy.failed); }
    finally {
      busy = false;
      control.disabled = false;
      if (panel.isConnected && appState.currentUser?.id === userId) load();
    }
  }

  async function load() {
    list.replaceChildren();
    info.textContent = copy.loading;
    try {
      const result = await apiPost('api/village.php?action=status', {}, true);
      if (!panel.isConnected || appState.currentUser?.id !== userId) return;
      if (!result?.ok) throw new Error('status');
      info.textContent = copy.realTime;
      const pending = readPendingRental(userId);
      if (pending) addButton(list, copy.pending, event => rent(pending, event.currentTarget));
      const ownsLot = result.lots.some(row => row.mine);
      const notebook = document.createElement('details');
      notebook.className = 'col-span-full rounded-xl border border-slate-700 p-3 text-sm text-slate-300';
      const summary = document.createElement('summary');
      summary.className = 'font-bold text-white';
      summary.textContent = `📓 ${copy.notebook}`;
      const note = document.createElement('textarea');
      note.className = 'w-full my-2 rounded-lg bg-slate-800 text-white p-2';
      note.rows = 4;
      note.maxLength = 4000;
      note.value = result.notebook || '';
      note.setAttribute('aria-label', copy.notebook);
      notebook.append(summary, note);
      addButton(notebook, copy.save, async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const response = await apiPost('api/village.php?action=save_note', { note: note.value }, true);
          if (appState.currentUser?.id === userId) showFloatingToast(response?.ok ? copy.saved : (response?.error || copy.failed));
        } catch { showFloatingToast(copy.failed); }
        finally { button.disabled = false; }
      });
      list.appendChild(notebook);
      if (result.stored_items?.length) {
        const storage = document.createElement('section');
        storage.className = 'col-span-full grid gap-2 rounded-xl bg-slate-900/80 border border-slate-700 p-3';
        const heading = document.createElement('h3');
        heading.className = 'text-white font-bold';
        heading.textContent = `${copy.storage} (${result.stored_items.length})`;
        storage.appendChild(heading);
        for (const item of result.stored_items) {
          const row = document.createElement('div');
          row.className = 'flex items-center justify-between gap-2 text-sm text-slate-300';
          const name = document.createElement('span');
          name.textContent = item.label || item.prefab_id.replaceAll('_', ' ');
          row.appendChild(name);
          if (ownsLot) addButton(row, copy.withdraw, async event => {
            if (busy || appState.currentUser?.id !== userId) return;
            const button = event.currentTarget;
            busy = true;
            button.disabled = true;
            try {
              const response = await apiPost('api/village.php?action=withdraw', { item_id: item.item_id }, true);
              if (appState.currentUser?.id !== userId) return;
              showFloatingToast(response?.ok ? copy.delivered : (response?.error || copy.failed));
              if (response?.ok) events.emit('sync:now');
            } catch { showFloatingToast(copy.failed); }
            finally {
              busy = false;
              button.disabled = false;
              if (panel.isConnected && appState.currentUser?.id === userId) load();
            }
          });
          storage.appendChild(row);
        }
        list.appendChild(storage);
      }
      const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' });
      for (const lot of VILLAGE_LOTS) {
        const lease = result.lots.find(row => row.id === lot.id);
        if (!lease) continue;
        const card = document.createElement('article');
        card.className = 'rounded-xl bg-slate-900/80 border border-slate-700 p-3 grid gap-2';
        const title = document.createElement('h3');
        title.className = 'text-white font-bold';
        title.textContent = `🏡 ${copy.lot(String(lot.id).padStart(2, '0'))}`;
        const status = document.createElement('p');
        status.className = 'text-xs text-slate-300';
        status.textContent = lease.mine ? copy.yours : lease.occupied ? copy.rented : copy.free;
        if (lease.occupied) status.textContent += ` · ${copy.expires(dateFormat.format(lease.expires_at * 1000))}`;
        card.append(title, status);
        if (lease.mine) {
          const marketHint = document.createElement('p');
          marketHint.className = 'text-xs text-slate-300';
          marketHint.textContent = copy.market;
          card.appendChild(marketHint);
        }
        if (!pending && (lease.mine || (!lease.occupied && !ownsLot))) {
          const controls = document.createElement('div');
          controls.className = 'flex flex-wrap gap-2 items-center';
          const select = document.createElement('select');
          select.className = 'rounded-lg px-2 py-2 bg-slate-800 text-sm text-white';
          select.setAttribute('aria-label', copy.realTime);
          for (const days of result.days) select.add(new Option(copy.option(days, days * result.daily_price), String(days)));
          controls.appendChild(select);
          addButton(controls, lease.mine ? copy.renew : copy.rent, event => {
            if (busy) return;
            try {
              const request = readPendingRental(userId) || prepareRental(userId, lot.id, Number(select.value));
              rent(request, event.currentTarget);
            } catch { showFloatingToast(copy.failed); }
          });
          card.appendChild(controls);
        }
        list.appendChild(card);
        if (lot.id === focusLot) card.scrollIntoView({ block: 'nearest' });
      }
    } catch {
      if (!panel.isConnected || appState.currentUser?.id !== userId) return;
      info.textContent = copy.unavailable;
      addButton(list, copy.retry, load);
    }
  }
  load();
}
