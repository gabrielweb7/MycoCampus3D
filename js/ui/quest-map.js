/**
 * MycoCampus3D — Mapa Rápido (Teleporte) & Missão Prática do Campus
 */
import { appState } from '../core/state.js';
import { t } from '../core/i18n.js';
import { apiPost } from '../services/api-client.js';
import { $, escapeHtml, showFloatingToast } from './dom-helpers.js';
import { updateUserHud } from './hud-lobby.js';
import { addLocalMycoCoins } from '../items/dehydration-packaging.js';
import { ACHIEVEMENTS, getUnlockedAchievements } from '../core/achievements.js';
import { CULTIVATION_TRACKS, calculateRealWorldRecipe } from '../core/cultivation-tracks.js';
import { VILLAGE_ENTRY } from '../core/village-layout.js';
import { FOREST_ENTRY, MOUNTAIN_ENTRY } from '../core/campus-route-layout.js';
import { renderVillageRentals } from './village-rentals.js';

export const CAMPUS_SECTORS = [
  { id: 'plaza', icon: '🏛️', get name() { return t('misc.quest.sector_plaza_name'); }, get desc() { return t('misc.quest.sector_plaza_desc'); }, x: 0, y: 0, z: 10.5, yaw: 0 },
  { id: 'lab', icon: '🧪', get name() { return t('misc.quest.sector_lab_name'); }, get desc() { return t('misc.quest.sector_lab_desc'); }, x: -16.2, y: 0.14, z: -7.0, yaw: Math.PI / 2 },
  { id: 'storage', icon: '📦', get name() { return t('misc.quest.sector_storage_name'); }, get desc() { return t('misc.quest.sector_storage_desc'); }, x: -16.2, y: 0.14, z: 7.5, yaw: Math.PI / 2 },
  { id: 'dehydration', icon: '♨️', get name() { return t('misc.quest.sector_dehydration_name'); }, get desc() { return t('misc.quest.sector_dehydration_desc'); }, x: 17.0, y: 0.14, z: -7.0, yaw: -Math.PI / 2 },
  { id: 'greenhouse', icon: '🍄', get name() { return t('misc.quest.sector_greenhouse_name'); }, get desc() { return t('misc.quest.sector_greenhouse_desc'); }, x: 16.5, y: 0.14, z: 7.5, yaw: -Math.PI / 2 },
  { id: 'drivethru', icon: '🚗', get name() { return t('misc.quest.sector_drivethru_name'); }, get desc() { return t('misc.quest.sector_drivethru_desc'); }, x: 17.5, y: 0.04, z: 37.5, yaw: Math.PI },
  { id: 'village', icon: '🏡', nameKey: 'map.village', descKey: 'map.village_desc', ...VILLAGE_ENTRY },
  { id: 'cinema', icon: '🎬', get name() { return t('misc.quest.sector_cinema_name'); }, get desc() { return t('misc.quest.sector_cinema_desc'); }, x: 48, y: 0.14, z: -6.5, yaw: 0 },
  { id: 'sports', icon: '⚽', get name() { return t('misc.quest.sector_sports_name'); }, get desc() { return t('misc.quest.sector_sports_desc'); }, x: -36, y: 0, z: -15, yaw: Math.PI / 2 },
  { id: 'forest', icon: '🌲', nameKey: 'misc.quest.sector_forest_name', descKey: 'misc.quest.sector_forest_desc', ...FOREST_ENTRY },
  { id: 'lake', icon: '🌉', nameKey: 'map.route_lake', descKey: 'map.route_lake_desc', x: 0, y: 0.02, z: 18.6, yaw: Math.PI },
  { id: 'garden', icon: '🥬', nameKey: 'map.route_garden', descKey: 'map.route_garden_desc', x: 20, y: 0.02, z: 20.35, yaw: 0 },
  { id: 'ecology', icon: '🌿', nameKey: 'map.route_ecology', descKey: 'map.route_ecology_desc', x: 46, y: 0, z: 34.7, yaw: 0 },
  { id: 'mountain', icon: '🏔️', nameKey: 'misc.quest.sector_mountain_name', descKey: 'misc.quest.sector_mountain_desc', ...MOUNTAIN_ENTRY }
];

export const LAB_QUEST_STEPS = [
  { key: 'sanitize_hood', icon: '🧴', get title() { return t('misc.quest.step_sanitize_hood_title'); }, get desc() { return t('misc.quest.step_sanitize_hood_desc'); }, coins: 30 },
  { key: 'hood_on', icon: '🌬️', get title() { return t('misc.quest.step_hood_on_title'); }, get desc() { return t('misc.quest.step_hood_on_desc'); }, coins: 30 },
  { key: 'cooker_heat', icon: '🔥', get title() { return t('misc.quest.step_cooker_heat_title'); }, get desc() { return t('misc.quest.step_cooker_heat_desc'); }, coins: 40 },
  { key: 'syringe_use', icon: '💉', get title() { return t('misc.quest.step_syringe_use_title'); }, get desc() { return t('misc.quest.step_syringe_use_desc'); }, coins: 40 },
  { key: 'greenhouse_care', icon: '🍄', get title() { return t('misc.quest.step_greenhouse_care_title'); }, get desc() { return t('misc.quest.step_greenhouse_care_desc'); }, coins: 45 },
  { key: 'monotub_harvest', icon: '📦', get title() { return t('misc.quest.step_monotub_harvest_title'); }, get desc() { return t('misc.quest.step_monotub_harvest_desc'); }, coins: 60 },
  { key: 'dry_pack', icon: '♨️', get title() { return t('misc.quest.step_dry_pack_title'); }, get desc() { return t('misc.quest.step_dry_pack_desc'); }, coins: 75 },
  { key: 'sell_pack', icon: '🚗', get title() { return t('misc.quest.step_sell_pack_title'); }, get desc() { return t('misc.quest.step_sell_pack_desc'); }, coins: 100 }
];

let labQuestDone = {};
const LAB_QUEST_MODULE = 'lab_practica_v1';
const LAB_QUEST_SECTORS = {
  sanitize_hood: 'lab', hood_on: 'lab', cooker_heat: 'lab', syringe_use: 'lab',
  greenhouse_care: 'greenhouse', monotub_harvest: 'dehydration',
  dry_pack: 'dehydration', sell_pack: 'drivethru'
};
const questRequests = new Map();

function hasQuestReward() {
  return (appState.currentUser?.completed_modules || []).includes(LAB_QUEST_MODULE);
}

export function claimLabQuestReward() {
  const userId = appState.currentUser?.id;
  if (userId == null || hasQuestReward() || !LAB_QUEST_STEPS.every((step) => labQuestDone[step.key])) return;
  if (questRequests.has(userId)) return questRequests.get(userId);
  const request = (async () => {
    const steps = LAB_QUEST_STEPS.map((step) => step.key);
    const persisted = await window.syncCampusUserProgress?.({ lab_quest_steps: steps });
    if (!persisted?.ok || appState.currentUser?.id !== userId) return;
    const res = await apiPost('api/auth.php?action=complete_lab_quest', {}, true);
    if (!res?.ok || !res.user || appState.currentUser?.id !== userId) return;
    appState.currentUser.completed_modules = res.user.completed_modules;
    appState.currentUser.xp = res.user.xp;
    updateUserHud();
    if (res.new_quest) {
      window.MycoAudio?.playQuestComplete?.();
      showFloatingToast(t('misc.quest.journey_complete', { xp: res.awarded_xp }), 4600);
    }
  })().catch(() => {}).finally(() => {
    questRequests.delete(userId);
    const modal = $('quest-modal');
    if (appState.currentUser?.id === userId && modal && !modal.classList.contains('hidden')) renderQuestModal();
  });
  questRequests.set(userId, request);
  return request;
}

function getQuestStorageKey() {
  return 'myco_quest_' + (appState.currentUser ? appState.currentUser.id : 'guest');
}

export function updateQuestBadge() {
  const badge = $('quest-badge');
  if (!badge) return;
  let count = 0;
  let nextStep = null;
  LAB_QUEST_STEPS.forEach((st) => {
    if (labQuestDone[st.key]) count++;
    else if (!nextStep) nextStep = st;
  });
  badge.textContent = `${count}/${LAB_QUEST_STEPS.length}`;
  const btn = $('btn-quest');
  if (btn) {
    btn.title = nextStep
      ? `${t('modal.quest_next_step')}: ${nextStep.title}`
      : t('modal.quest_title');
  }
}

export function loadLabQuestProgress() {
  labQuestDone = {};
  try {
    const raw = localStorage.getItem(getQuestStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') labQuestDone = parsed;
    }
  } catch (e) {}
  const srvSteps = (appState.currentUser && appState.currentUser.progress && Array.isArray(appState.currentUser.progress.lab_quest_steps))
    ? appState.currentUser.progress.lab_quest_steps
    : [];
  srvSteps.forEach((k) => { labQuestDone[k] = true; });
  const mods = (appState.currentUser && appState.currentUser.completed_modules) || [];
  if (mods.includes(LAB_QUEST_MODULE)) {
    LAB_QUEST_STEPS.forEach((st) => { labQuestDone[st.key] = true; });
  }
  const doneKeys = Object.keys(labQuestDone).filter((k) => labQuestDone[k]);
  if (LAB_QUEST_STEPS.every((step) => labQuestDone[step.key])) {
    claimLabQuestReward();
  } else if (doneKeys.length > srvSteps.length && typeof window !== 'undefined' && typeof window.syncCampusUserProgress === 'function') {
    window.syncCampusUserProgress({ lab_quest_steps: doneKeys });
  }
  updateQuestBadge();
}

export async function completeLabStep(stepKey) {
  if (!appState.currentUser || !stepKey || labQuestDone[stepKey]) return;
  const stepObj = LAB_QUEST_STEPS.find((s) => s.key === stepKey);
  if (!stepObj) return;

  labQuestDone[stepKey] = true;
  try { localStorage.setItem(getQuestStorageKey(), JSON.stringify(labQuestDone)); } catch (e) {}
  updateQuestBadge();
  const doneKeys = Object.keys(labQuestDone).filter((k) => labQuestDone[k]);
  const allDone = LAB_QUEST_STEPS.every((step) => labQuestDone[step.key]);
  if (!allDone && typeof window !== 'undefined' && typeof window.syncCampusUserProgress === 'function') {
    window.syncCampusUserProgress({ lab_quest_steps: doneKeys });
  }

  let doneCount = 0;
  LAB_QUEST_STEPS.forEach((st) => { if (labQuestDone[st.key]) doneCount++; });
  const coinBonus = stepObj.coins || 30;
  addLocalMycoCoins(coinBonus);
  updateUserHud();

  if (doneCount < LAB_QUEST_STEPS.length) {
    if (window.MycoAudio && window.MycoAudio.playQuestComplete) window.MycoAudio.playQuestComplete();
    showFloatingToast(t('misc.quest.step_complete', { done: doneCount, total: LAB_QUEST_STEPS.length, title: stepObj.title, coins: coinBonus }), 3800);
  } else {
    showFloatingToast(t('misc.quest.last_step_complete', { coins: coinBonus }), 3800);
    await claimLabQuestReward();
  }

  const qm = $('quest-modal');
  if (qm && !qm.classList.contains('hidden')) renderQuestModal();
}

export function renderMapModal() {
  const grid = $('map-sectors-grid');
  if (!grid) return;
  grid.classList.remove('campus-map-village');
  $('map-scroll').scrollTop = 0;
  $('map-heading-icon').textContent = '🗺️';
  $('map-title').dataset.i18n = 'modal.map_title';
  $('map-subtitle').dataset.i18n = 'modal.map_subtitle';
  $('map-title').textContent = t('modal.map_title');
  $('map-subtitle').textContent = t('modal.map_subtitle');
  grid.innerHTML = '';
  CAMPUS_SECTORS.forEach((sec) => {
    const name = sec.nameKey ? t(sec.nameKey) : sec.name;
    const desc = sec.descKey ? t(sec.descKey) : sec.desc;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'campus-map-sector';
    btn.innerHTML =
      `<span class="text-2xl leading-none">${sec.icon}</span>` +
      `<div><div class="font-bold text-white">${escapeHtml(name)}</div>` +
      `<div class="text-sm text-slate-300">${escapeHtml(desc)}</div></div>`;
    btn.onclick = () => {
      if (sec.id === 'village') {
        renderVillageRentals(grid, renderMapModal);
        return;
      }
      if (window.teleportCampusPlayer) {
        window.teleportCampusPlayer(sec.x, sec.y, sec.z, sec.yaw);
        showFloatingToast(`${sec.icon} ${name}`, 2500);
      }
      const mm = $('map-modal');
      if (mm) mm.classList.add('hidden');
    };
    grid.appendChild(btn);
  });
}

let activeQuestModalTab = 'quest';
let activeTrackId = CULTIVATION_TRACKS[0].id;
let calcRecipeKind = 'pda';
let calcRecipeAmount = 500;
function trackStorageKey() {
  return 'myco_learning_track_steps_v1:' + (appState.currentUser?.id ?? 'guest');
}

function loadTrackChecks() {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      const raw = localStorage.getItem(trackStorageKey());
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    }
  } catch (_e) {}
  return {};
}

function saveTrackChecks(map) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(trackStorageKey(), JSON.stringify(map));
    }
  } catch (_e) {}
}

export function renderQuestModal() {
  const body = $('quest-body');
  if (!body) return;
  body.innerHTML = '';

  const tabBar = document.createElement('div');
  tabBar.className = 'flex flex-wrap gap-1.5 mb-2';
  [
    { id: 'quest', label: '🎯 ' + t('hud.quest') },
    { id: 'tracks', label: t('modal.quest_tab_tracks') },
    { id: 'calc', label: t('modal.quest_tab_calculator') }
  ].forEach((tb) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ' +
      (activeQuestModalTab === tb.id
        ? 'bg-emerald-600/80 text-white border-emerald-400'
        : 'bg-slate-900/75 text-slate-300 border-slate-700 hover:bg-slate-800');
    btn.textContent = tb.label;
    btn.onclick = () => {
      activeQuestModalTab = tb.id;
      renderQuestModal();
    };
    tabBar.appendChild(btn);
  });
  body.appendChild(tabBar);

  if (activeQuestModalTab === 'tracks') {
    const checks = loadTrackChecks();
    const trBar = document.createElement('div');
    trBar.className = 'flex flex-wrap gap-1.5 mb-2';
    CULTIVATION_TRACKS.forEach((tr) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'px-2 py-1 rounded-lg text-[11px] font-semibold border transition ' +
        (activeTrackId === tr.id
          ? 'bg-cyan-700/80 text-white border-cyan-400'
          : 'bg-slate-900/70 text-slate-300 border-slate-700 hover:bg-slate-800');
      b.textContent = tr.level;
      b.onclick = () => { activeTrackId = tr.id; renderQuestModal(); };
      trBar.appendChild(b);
    });
    body.appendChild(trBar);

    const track = CULTIVATION_TRACKS.find((t) => t.id === activeTrackId) || CULTIVATION_TRACKS[0];
    const head = document.createElement('div');
    head.className = 'p-3 rounded-xl bg-slate-900/80 border border-cyan-500/35 space-y-1.5 mb-2';
    head.innerHTML =
      `<div class="font-bold text-white text-xs">${escapeHtml(track.title)}</div>` +
      `<div class="text-[11px] text-cyan-300 font-semibold">${escapeHtml(t('modal.quest_species'))}: ${escapeHtml(track.speciesHint)}</div>` +
      `<div class="text-[11px] text-slate-300">${escapeHtml(track.summary)}</div>` +
      `<div class="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">${escapeHtml(track.gameVsReal)}</div>`;
    body.appendChild(head);

    track.steps.forEach((stepTxt, idx) => {
      const cKey = track.id + ':' + idx;
      const done = !!checks[cKey];
      const row = document.createElement('button');
      row.type = 'button';
      row.setAttribute('aria-pressed', String(done));
      row.className = 'w-full text-left p-2.5 rounded-xl border flex items-start gap-2 mb-1.5 transition ' +
        (done ? 'bg-emerald-950/35 border-emerald-500/45 text-emerald-200' : 'bg-slate-900/75 border-slate-700/70 text-slate-200 hover:bg-slate-800/80');
      row.innerHTML = `<span class="text-base leading-none">${done ? '✅' : '⬜'}</span><span class="text-[11px] flex-1">${idx + 1}. ${escapeHtml(stepTxt)}</span>`;
      row.onclick = () => {
        checks[cKey] = !checks[cKey];
        saveTrackChecks(checks);
        renderQuestModal();
      };
      body.appendChild(row);
    });
    return;
  }

  if (activeQuestModalTab === 'calc') {
    const controls = document.createElement('div');
    controls.className = 'p-3 rounded-xl bg-slate-900/80 border border-emerald-500/35 space-y-2 mb-2';
    controls.innerHTML =
      `<div class="flex flex-wrap gap-1.5" id="calc-kind-btns"></div>` +
      `<div class="flex items-center gap-2 pt-1">` +
      `<label class="text-[11px] text-slate-300 font-semibold" for="calc-amt-input">${escapeHtml(t('modal.quest_amount'))}</label>` +
      `<input id="calc-amt-input" type="number" min="50" max="10000" step="50" value="${calcRecipeAmount}" class="w-24 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs">` +
      `</div>`;
    body.appendChild(controls);

    const kWrap = controls.querySelector('#calc-kind-btns');
    [
      { id: 'pda', label: t('misc.quest.calc_pda') },
      { id: 'lc', label: t('misc.quest.calc_lc') },
      { id: 'cvg', label: t('misc.quest.calc_cvg') },
      { id: 'spawn_bulk', label: t('misc.quest.calc_spawn_bulk') }
    ].forEach((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'px-2 py-1 rounded-lg text-[11px] font-bold border ' +
        (calcRecipeKind === opt.id ? 'bg-emerald-600/80 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700');
      b.textContent = opt.label;
      b.onclick = () => { calcRecipeKind = opt.id; renderQuestModal(); };
      kWrap.appendChild(b);
    });

    const resBox = document.createElement('div');
    resBox.className = 'p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 space-y-1.5';
    const renderCalcResult = () => {
      const r = calculateRealWorldRecipe(calcRecipeKind, calcRecipeAmount);
      resBox.innerHTML =
        `<div class="font-bold text-emerald-300 text-xs">${escapeHtml(r.title)}</div>` +
        `<ul class="space-y-1 text-[11px] text-slate-200">${r.items.map((it) => `<li>• ${escapeHtml(it)}</li>`).join('')}</ul>` +
        `<div class="text-[11px] text-amber-300 pt-1">💡 ${escapeHtml(r.note)}</div>`;
    };
    const inp = controls.querySelector('#calc-amt-input');
    if (inp) {
      inp.oninput = () => {
        calcRecipeAmount = Math.max(50, Math.min(10000, Number(inp.value) || 500));
        renderCalcResult();
      };
    }
    renderCalcResult();
    body.appendChild(resBox);
    return;
  }

  let doneCount = 0;
  LAB_QUEST_STEPS.forEach((st) => { if (labQuestDone[st.key]) doneCount++; });
  const pct = Math.round((doneCount / LAB_QUEST_STEPS.length) * 100);

  const header = document.createElement('div');
  header.className = 'p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-1.5';
  header.innerHTML =
    `<div class="flex items-center justify-between font-bold text-white">` +
    `<span>${escapeHtml(t('misc.quest.progress_title'))}</span><span class="text-emerald-300">${doneCount}/${LAB_QUEST_STEPS.length} (${pct}%)</span></div>` +
    `<div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">` +
    `<div class="h-full bg-emerald-400 transition-all" style="width:${pct}%"></div></div>`;
  body.appendChild(header);

  const nextStep = LAB_QUEST_STEPS.find((step) => !labQuestDone[step.key]);
  if (nextStep) {
    const next = document.createElement('p');
    next.className = 'p-2 my-2 rounded-lg bg-cyan-950/60 text-sm text-cyan-100';
    next.textContent = `${t('modal.quest_next_step')}: ${nextStep.title}`;
    body.appendChild(next);
    const sector = CAMPUS_SECTORS.find((entry) => entry.id === LAB_QUEST_SECTORS[nextStep.key]);
    if (sector && typeof window.teleportCampusPlayer === 'function') {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'px-3 py-2 rounded-lg bg-cyan-800 text-white font-semibold';
      go.textContent = `${t('modal.quest_go_to_sector')} · ${sector.name}`;
      go.onclick = () => {
        window.teleportCampusPlayer(sector.x, sector.y, sector.z, sector.yaw);
        $('quest-modal')?.classList.add('hidden');
      };
      body.appendChild(go);
    }
  } else if (appState.currentUser && !hasQuestReward()) {
    const claim = document.createElement('button');
    claim.type = 'button';
    claim.className = 'p-2 my-2 rounded-lg bg-amber-900/80 text-sm text-amber-100';
    const pending = questRequests.has(appState.currentUser.id);
    claim.disabled = pending;
    claim.textContent = t(pending ? 'modal.quest_reward_confirming' : 'modal.quest_reward_retry');
    claim.onclick = () => {
      claimLabQuestReward();
      renderQuestModal();
    };
    body.appendChild(claim);
  }

  LAB_QUEST_STEPS.forEach((st) => {
    const isDone = !!labQuestDone[st.key];
    const row = document.createElement('div');
    row.className = 'p-3 rounded-xl border flex items-start gap-2.5 ' +
      (isDone ? 'bg-emerald-950/35 border-emerald-500/40' : 'bg-slate-900/75 border-slate-700/70');
    row.innerHTML =
      `<span class="text-xl leading-none">${isDone ? '✅' : st.icon}</span>` +
      `<div class="flex-1"><div class="font-bold ${isDone ? 'text-emerald-300' : 'text-white'}">${escapeHtml(st.title)}</div>` +
      `<div class="text-[11px] text-slate-300">${escapeHtml(st.desc)}</div></div>`;
    body.appendChild(row);
  });

  const unlockedAch = getUnlockedAchievements();
  const achDoneCount = ACHIEVEMENTS.filter((a) => !!unlockedAch[a.id]).length;
  const achTitle = document.createElement('div');
  achTitle.className = 'pt-3 pb-1 text-xs font-extrabold text-amber-300 border-t border-slate-700/60 mt-2';
  achTitle.textContent = t('misc.ach.section_title', { done: achDoneCount, total: ACHIEVEMENTS.length });
  body.appendChild(achTitle);
  const achGrid = document.createElement('div');
  achGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';
  ACHIEVEMENTS.forEach((a) => {
    const got = !!unlockedAch[a.id];
    const card = document.createElement('div');
    card.className = 'p-2.5 rounded-xl border flex items-center gap-2 ' +
      (got ? 'bg-amber-950/35 border-amber-400/45' : 'bg-slate-900/60 border-slate-700/60 opacity-75');
    card.innerHTML = `<span class="text-lg">${got ? a.icon : '🔒'}</span>` +
      `<div class="min-w-0 flex-1"><div class="font-bold text-[11px] ${got ? 'text-amber-200' : 'text-slate-300'} truncate">${escapeHtml(t('misc.ach.' + a.id + '.name'))}</div>` +
      `<div class="text-[10px] text-slate-400">+🪙 ${a.coins} • +${a.xp} XP</div></div>`;
    achGrid.appendChild(card);
  });
  body.appendChild(achGrid);
}
