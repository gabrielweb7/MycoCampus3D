/**
 * Economia Local e Constantes Comerciais do Empório MycoCampus3D (MycoCoins & VIP).
 */

export const MYCOCOIN_PRICE_PER_PACK = 120; // 🪙 120 MycoCoins por pacote selado (VIP = +50%!)
export const DELIVERY_CRATE_MAX_PACKS = 4;
export const VIP_SPECIES_MENU = [
  'Golden Teacher',
  'Juba de Leão',
  'Shimeji Rosa',
  'Shiitake',
  'Jack Frost',
  'Reishi Vermelho',
  'Blue Meanie',
  'Penis Envy'
];

let memoryMycoCoinsFallback = 250;
let activeCoinsUserKey = 'myco_coins_balance';

export function playEconomyAudio(method) {
  if (typeof window !== 'undefined' && window.MycoAudio && typeof window.MycoAudio[method] === 'function') {
    window.MycoAudio[method]();
  }
}

export function setMycoCoinsUserScope(userId) {
  activeCoinsUserKey = userId ? ('myco_coins_balance_u' + String(userId)) : 'myco_coins_balance';
  if (!userId) memoryMycoCoinsFallback = 250;
}

export function getLocalMycoCoins() {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem(activeCoinsUserKey);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          memoryMycoCoinsFallback = parsed;
          return parsed;
        }
      }
    }
  } catch (e) {}
  return memoryMycoCoinsFallback;
}

export function setLocalMycoCoins(value) {
  const next = Math.max(0, Math.min(999999, Math.round(Number(value) || 0)));
  memoryMycoCoinsFallback = next;
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(activeCoinsUserKey, String(next));
    }
  } catch (e) {}
  if (typeof document !== 'undefined') {
    const elHud = document.getElementById('hud-coins');
    if (elHud) elHud.textContent = String(next);
    const elShop = document.getElementById('shop-user-coins');
    if (elShop) elShop.textContent = String(next);
  }
  return next;
}

export function addLocalMycoCoins(amount) {
  const delta = Number(amount) || 0;
  const cur = getLocalMycoCoins();
  const next = setLocalMycoCoins(cur + delta);
  if (delta !== 0 && typeof window !== 'undefined' && typeof window.syncCampusMycoCoins === 'function') {
    window.syncCampusMycoCoins(delta);
  }
  return next;
}
