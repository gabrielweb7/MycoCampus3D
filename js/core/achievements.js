/**
 * Conquistas / Marcos de Carreira do MycoCampus3D.
 * Persistido por conta em localStorage e integrado com HUD, XP e MycoCoins.
 */
import { appState } from './state.js';
import { t } from './i18n.js';
import { addLocalMycoCoins } from '../items/dehydration-packaging.js';

export const ACHIEVEMENTS = [
  { id: 'sterile_master', icon: '🍲', coins: 40, xp: 25 },
  { id: 'first_clean_culture', icon: '🧪', coins: 50, xp: 30 },
  { id: 'golden_harvest', icon: '🍄', coins: 40, xp: 25 },
  { id: 'monotub_master', icon: '📦', coins: 80, xp: 50 },
  { id: 'vip_seller', icon: '⭐', coins: 70, xp: 40 },
  { id: 'emporium_10', icon: '🏆', coins: 150, xp: 100 }
];

function getStorageKey() {
  const uid = appState.currentUser ? appState.currentUser.id : 'guest';
  return 'myco_achievements_u' + uid;
}

export function getUnlockedAchievements() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(getStorageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

export function unlockAchievement(id, onToast) {
  if (!id || !appState.currentUser) return false;
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return false;
  const unlocked = getUnlockedAchievements();
  if (unlocked[id]) return false;

  unlocked[id] = Date.now();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getStorageKey(), JSON.stringify(unlocked));
    }
  } catch (e) {}

  addLocalMycoCoins(def.coins);
  if (appState.currentUser) {
    appState.currentUser.xp = (appState.currentUser.xp || 0) + def.xp;
  }
  if (typeof window !== 'undefined') {
    if (window.MycoAudio?.playQuestComplete) window.MycoAudio.playQuestComplete();
    if (window.triggerCampusHaptic) window.triggerCampusHaptic('success');
  }
  const msg = t('misc.ach.unlocked', {
    icon: def.icon,
    name: t('misc.ach.' + id + '.name'),
    coins: def.coins,
    xp: def.xp
  });
  if (typeof onToast === 'function') onToast(msg);
  else if (typeof window !== 'undefined' && window.showCampusToast) window.showCampusToast(msg);
  return true;
}
