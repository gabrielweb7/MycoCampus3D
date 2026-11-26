/** A purchase is retried with the same ID until the server confirms delivery. */
import { appState } from '../core/state.js';
import { events } from '../core/events.js';
import { apiGet, apiPost } from './api-client.js';
import { preserveNewerPetState } from './pets.js';
import { pendingCoinOperations } from './coin-outbox.js';
import { setLocalMycoCoins } from '../items/dehydration-packaging.js';
import { t } from '../core/i18n.js';
import { updateUserHud } from '../ui/hud-lobby.js';

const STORAGE_PREFIX = 'myco_shop_order_v1_';
const RETRY_MS = 10000;
let inFlight = null;
let nextRetryAt = 0;

function keyFor(userId) { return STORAGE_PREFIX + userId; }

function readPending(userId) {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function clearPending(userId, orderId) {
  try {
    const current = readPending(userId);
    if (current && current.order_id === orderId) localStorage.removeItem(keyFor(userId));
  } catch (e) {}
}

function newOrderId(supplyId) {
  if (!globalThis.crypto?.getRandomValues) return '';
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return 'purchase_' + supplyId + '_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function retryPendingShopPurchase(force = false) {
  const userId = appState.currentUser?.id;
  if (userId == null) return null;
  if (inFlight) return inFlight.userId === userId ? inFlight.promise : null;
  if (!force && Date.now() < nextRetryAt) return null;
  nextRetryAt = Date.now() + RETRY_MS;
  const order = readPending(userId);
  if (!order) return null;
  const promise = (async () => {
    try {
      const capability = await apiGet('api/auth.php?action=shop_capabilities');
      if (!capability?.ok || capability.durable_delivery !== 1 || appState.currentUser?.id !== userId) {
        return { ok: false, pending: true, error: t('misc.shop.deliveryUnavailable') };
      }
      const res = await apiPost('api/auth.php?action=buy_supply_durable', order, true);
      if (appState.currentUser?.id !== userId) return { ok: false, pending: true };
      if (res?.ok && res.user && typeof res.delivery_id === 'string' && res.delivery_id.startsWith('dyn_shop_')) {
        clearPending(userId, order.order_id);
        appState.currentUser = preserveNewerPetState(appState.currentUser, res.user);
        const pending = pendingCoinOperations(userId).reduce((sum, entry) => sum + entry.delta, 0);
        setLocalMycoCoins(res.user.myco_coins + pending);
        updateUserHud();
        events.emit('sync:now');
        if (!force && typeof window !== 'undefined' && window.showCampusToast) {
          window.showCampusToast('📦 ' + t('misc.shop.confirmed'));
        }
        return res;
      }
      if (res?.charged === false) {
        clearPending(userId, order.order_id);
        return res;
      }
      return { ok: false, pending: true, error: res?.error || t('misc.shop.awaitConfirm') };
    } catch (e) {
      return { ok: false, pending: true, error: t('misc.shop.awaitConn') };
    }
  })();
  inFlight = { userId, promise };
  try { return await promise; } finally { if (inFlight?.promise === promise) inFlight = null; }
}

export async function orderShopSupply(supplyId, delivery) {
  const userId = appState.currentUser?.id;
  if (userId == null) return { ok: false, error: 'Entre na sua conta para comprar.' };
  if (readPending(userId)) {
    const previous = await retryPendingShopPurchase(true);
    return { ok: false, pending: true, error: previous?.ok
      ? t('misc.shop.prevConfirmed')
      : t('misc.shop.pendingDelivery') };
  }
  const orderId = newOrderId(supplyId);
  if (!orderId || !delivery || !['x', 'y', 'z', 'ry'].every((key) => Number.isFinite(delivery[key]))) {
    return { ok: false, error: t('misc.shop.prepareFail') };
  }
  const order = { supply_id: supplyId, order_id: orderId, delivery };
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(order));
    if (readPending(userId)?.order_id !== orderId) throw new Error('storage');
  } catch (e) {
    return { ok: false, error: 'Ative o armazenamento do navegador para garantir a entrega.' };
  }
  return (await retryPendingShopPurchase(true)) || { ok: false, pending: true, error: t('misc.shop.awaitConfirm') };
}

events.on('sync:now', () => { retryPendingShopPurchase().catch(() => {}); });
