import { VILLAGE_ENTRY, VILLAGE_LOTS } from '../core/village-layout.js';
import { getLanguage } from '../core/i18n.js';
import { appState } from '../core/state.js';
import { applyVillageUpgrades } from '../world/house-upgrades.js';
import { events } from '../core/events.js';
import { apiPost } from '../services/api-client.js';
import { pendingCoinOperations } from '../services/coin-outbox.js';
import { setLocalMycoCoins } from '../items/dehydration-packaging.js';
import { updateUserHud } from './hud-lobby.js';
import { showFloatingToast } from './dom-helpers.js';

const COPY = {
  'pt-BR': {
    title: 'Vila do Campus', back: 'Voltar ao mapa', visit: 'Ir até a vila', login: 'Entre na sua conta para alugar.',
    lots: 'Casas e quintais', duration: 'Duração do aluguel',
    loading: 'Consultando os lotes…', unavailable: 'A vila está indisponível. Tente carregar novamente.',
    retry: 'Tentar novamente', pending: 'Confirme o aluguel pendente', success: 'Aluguel confirmado!',
    coins: 'Aguarde a sincronização das moedas.', failed: 'Não foi possível confirmar o aluguel.',
    lot: id => `Casa ${id}`, free: 'Disponível', yours: 'Sua casa', rented: 'Alugada',
    expires: date => `Até ${date}`, tenant: name => `Morador: ${name}`, remaining: value => `Faltam ${value}`,
    underMinute: 'Menos de 1 min', ended: 'Aluguel encerrado',
    option: (days, cost) => `${days} ${days === 1 ? 'dia' : 'dias'} · ${cost} 🪙`,
    renew: 'Renovar', rent: 'Alugar', realTime: 'O aluguel é contado em dias corridos.',
    storage: 'Depósito pessoal', withdraw: 'Entregar no quintal', delivered: 'Item entregue no quintal.',
    market: 'Deixe um Mylar selado de 10 g ou 25 g na bancada do quintal para o comprador retirar.'
  },
  en: {
    title: 'Campus Village', back: 'Back to map', visit: 'Visit the village', login: 'Sign in to rent a house.',
    lots: 'Houses and yards', duration: 'Rental duration',
    loading: 'Checking the lots…', unavailable: 'The village is unavailable. Please reload.',
    retry: 'Try again', pending: 'Confirm pending rental', success: 'Rental confirmed!',
    coins: 'Wait for your coins to sync.', failed: 'Could not confirm the rental.',
    lot: id => `House ${id}`, free: 'Available', yours: 'Your house', rented: 'Rented',
    expires: date => `Until ${date}`, tenant: name => `Tenant: ${name}`, remaining: value => `${value} left`,
    underMinute: 'Less than 1 min', ended: 'Rental ended',
    option: (days, cost) => `${days} ${days === 1 ? 'day' : 'days'} · ${cost} 🪙`,
    renew: 'Renew', rent: 'Rent', realTime: 'Rent is counted in real-world days.',
    storage: 'Personal storage', withdraw: 'Deliver to yard', delivered: 'Item delivered to your yard.',
    market: 'Place a sealed 10 g or 25 g Mylar bag on the yard counter for pickup.'
  },
  es: {
    title: 'Villa del Campus', back: 'Volver al mapa', visit: 'Visitar la villa', login: 'Inicia sesión para alquilar.',
    lots: 'Casas y patios', duration: 'Duración del alquiler',
    loading: 'Consultando los lotes…', unavailable: 'La villa no está disponible. Vuelve a intentar.',
    retry: 'Reintentar', pending: 'Confirmar el alquiler pendiente', success: '¡Alquiler confirmado!',
    coins: 'Espera a que se sincronicen tus monedas.', failed: 'No se pudo confirmar el alquiler.',
    lot: id => `Casa ${id}`, free: 'Disponible', yours: 'Tu casa', rented: 'Alquilada',
    expires: date => `Hasta ${date}`, tenant: name => `Residente: ${name}`, remaining: value => `Quedan ${value}`,
    underMinute: 'Menos de 1 min', ended: 'Alquiler terminado',
    option: (days, cost) => `${days} ${days === 1 ? 'día' : 'días'} · ${cost} 🪙`,
    renew: 'Renovar', rent: 'Alquilar', realTime: 'El alquiler se cuenta en días reales.',
    storage: 'Depósito personal', withdraw: 'Entregar en el patio', delivered: 'Artículo entregado en tu patio.',
    market: 'Deja una bolsa Mylar sellada de 10 g o 25 g en el mostrador del patio para la recogida.'
  }
};

function addButton(container, name, onClick, primary = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = primary ? 'village-button village-button-primary' : 'village-button';
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
  const title = document.getElementById('map-title');
  const subtitle = document.getElementById('map-subtitle');
  const scroller = document.getElementById('map-scroll');
  delete title.dataset.i18n;
  delete subtitle.dataset.i18n;
  title.textContent = copy.title;
  subtitle.textContent = copy.realTime;
  document.getElementById('map-heading-icon').textContent = '🏡';
  grid.classList.add('campus-map-village');
  scroller.scrollTop = 0;
  const panel = document.createElement('div');
  panel.className = 'village-panel';
  grid.replaceChildren(panel);

  const nav = document.createElement('div');
  nav.className = 'village-nav';
  panel.appendChild(nav);
  addButton(nav, `‹ ${copy.back}`, back);
  addButton(nav, copy.visit, () => {
    window.teleportCampusPlayer?.(VILLAGE_ENTRY.x, VILLAGE_ENTRY.y, VILLAGE_ENTRY.z, VILLAGE_ENTRY.yaw);
    document.getElementById('map-modal')?.classList.add('hidden');
  }, true);

  const info = document.createElement('p');
  info.setAttribute('role', 'status');
  info.className = 'village-notice';
  panel.appendChild(info);
  if (!userId) { info.textContent = copy.login; return; }
  const tools = document.createElement('div');
  tools.className = 'village-tools';
  const heading = document.createElement('h3');
  heading.textContent = copy.lots;
  heading.className = 'village-heading';
  const list = document.createElement('div');
  list.className = 'village-lots';
  panel.append(heading, list, tools);
  let busy = false;
  let countdownTimer;
  const durations = new Map();

  function updateCountdowns(entries, responseTime) {
    if (!panel.isConnected || panel.closest('#map-modal')?.classList.contains('hidden') || appState.currentUser?.id !== userId) return;
    const now = responseTime + performance.now() / 1000;
    let nextTick = 60;
    let expired = false;
    for (const entry of entries) {
      const seconds = Math.max(0, Math.ceil(entry.endsAt - now));
      const minutesTotal = Math.floor(seconds / 60);
      const days = Math.floor(minutesTotal / 1440);
      const hours = Math.floor(minutesTotal / 60) % 24;
      const minutes = minutesTotal % 60;
      const duration = days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}min` : `${minutes}min`;
      const label = !seconds ? copy.ended : !minutesTotal ? copy.underMinute : copy.remaining(duration);
      if (entry.node.textContent !== label) entry.node.textContent = label;
      if (!seconds) expired = true;
      nextTick = Math.min(nextTick, seconds % 60 || 60, seconds || 1);
    }
    if (expired && !busy) { load(); return; }
    countdownTimer = setTimeout(() => updateCountdowns(entries, responseTime), nextTick * 1000);
  }

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
    clearTimeout(countdownTimer);
    list.replaceChildren();
    tools.replaceChildren();
    heading.hidden = true;
    info.textContent = copy.loading;
    try {
      const result = await apiPost('api/village.php?action=status', {}, true);
      if (!panel.isConnected || appState.currentUser?.id !== userId) return;
      if (!result?.ok) throw new Error('status');
      if (Array.isArray(result.lots)) applyVillageUpgrades(result.lots);
      info.textContent = '';
      heading.hidden = false;
      const pending = readPendingRental(userId);
      if (pending) addButton(info, copy.pending, event => rent(pending, event.currentTarget), true);
      const ownsLot = result.lots.some(row => row.mine);
      if (result.stored_items?.length) {
        const storage = document.createElement('section');
        storage.className = 'village-storage';
        const heading = document.createElement('h3');
        heading.className = 'text-white font-bold';
        heading.textContent = `${copy.storage} (${result.stored_items.length})`;
        storage.appendChild(heading);
        for (const item of result.stored_items) {
          const row = document.createElement('div');
          row.className = 'village-storage-row';
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
        tools.appendChild(storage);
      }
      const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'short' });
      const countdowns = [];
      const serverTime = Number(result.server_ts) || Date.now() / 1000;
      for (const lot of VILLAGE_LOTS) {
        const lease = result.lots.find(row => row.id === lot.id);
        if (!lease) continue;
        const card = document.createElement('article');
        card.className = 'village-lot';
        const cardHeading = document.createElement('div');
        cardHeading.className = 'village-lot-heading';
        const title = document.createElement('h4');
        title.textContent = copy.lot(String(lot.id).padStart(2, '0'));
        const status = document.createElement('span');
        status.className = 'village-lot-status';
        status.dataset.status = lease.mine ? 'mine' : lease.occupied ? 'rented' : 'free';
        status.textContent = lease.mine ? copy.yours : lease.occupied ? copy.rented : copy.free;
        cardHeading.append(title, status);
        card.appendChild(cardHeading);
        if (lease.occupied && lease.tenant_name) {
          const tenant = document.createElement('p');
          tenant.className = 'village-tenant';
          tenant.textContent = copy.tenant(lease.tenant_name);
          card.appendChild(tenant);
        }
        if (lease.occupied && Number.isFinite(lease.expires_at) && lease.expires_at > serverTime) {
          const expiry = document.createElement('time');
          expiry.className = 'village-countdown';
          expiry.dateTime = new Date(lease.expires_at * 1000).toISOString();
          expiry.title = copy.expires(dateFormat.format(lease.expires_at * 1000));
          countdowns.push({ node: expiry, endsAt: lease.expires_at });
          card.appendChild(expiry);
        }
        if (lease.mine) {
          const marketHint = document.createElement('p');
          marketHint.className = 'village-lot-detail';
          marketHint.textContent = copy.market;
          card.appendChild(marketHint);
        }
        if (!pending && (lease.mine || (!lease.occupied && !ownsLot))) {
          const controls = document.createElement('div');
          controls.className = 'village-lot-controls';
          const select = document.createElement('select');
          select.setAttribute('aria-label', `${title.textContent} · ${copy.duration}`);
          for (const days of result.days) select.add(new Option(copy.option(days, days * result.daily_price), String(days)));
          if (durations.has(lot.id)) select.value = durations.get(lot.id);
          select.onchange = () => durations.set(lot.id, select.value);
          controls.appendChild(select);
          addButton(controls, lease.mine ? copy.renew : copy.rent, event => {
            if (busy) return;
            try {
              const request = readPendingRental(userId) || prepareRental(userId, lot.id, Number(select.value));
              rent(request, event.currentTarget);
            } catch { showFloatingToast(copy.failed); }
          }, true);
          card.appendChild(controls);
        }
        list.appendChild(card);
        if (lot.id === focusLot) {
          card.classList.add('village-lot-focused');
          requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest' }));
        }
      }
      if (countdowns.length) updateCountdowns(countdowns, serverTime - performance.now() / 1000);
    } catch {
      if (!panel.isConnected || appState.currentUser?.id !== userId) return;
      info.textContent = copy.unavailable;
      addButton(info, copy.retry, load);
    }
  }
  load();
}
