/**
 * MycoCampus3D — Mapa Rápido (Teleporte) & Missão Prática de 5 Passos
 */
import { appState } from '../core/state.js';
import { apiPost } from '../services/api-client.js';
import { $, escapeHtml, showFloatingToast } from './dom-helpers.js';
import { updateUserHud } from './hud-lobby.js';
import { addLocalMycoCoins } from '../items/dehydration-packaging.js';

export const CAMPUS_SECTORS = [
  { id: 'plaza', icon: '🏛️', name: 'Praça Central', desc: 'Ponto inicial, fonte e torre do relógio', x: 0, y: 0, z: 10.5, yaw: 0 },
  { id: 'lab', icon: '🧪', name: 'Laboratório Asséptico', desc: 'Fluxo laminar, lamparina, microscópio 1000x e seringas', x: -16.2, y: 0.14, z: -7.0, yaw: Math.PI / 2 },
  { id: 'storage', icon: '📦', name: 'Depósito de Insumos', desc: 'Bags, vidros, grãos, placas e borrifadores', x: -16.2, y: 0.14, z: 7.5, yaw: Math.PI / 2 },
  { id: 'dehydration', icon: '♨️', name: 'Sala de Desidratação & Embalagem', desc: '6 Desidratadoras, sacos Mylar, 3 seladoras, caixas e Monotubs LED', x: 17.0, y: 0.14, z: -7.0, yaw: -Math.PI / 2 },
  { id: 'greenhouse', icon: '🍄', name: 'Estufa Climatizada & Horta', desc: '24 bolos, umidificador, exaustor, alfaces e tomates orgânicos', x: 16.5, y: 0.14, z: 7.5, yaw: -Math.PI / 2 },
  { id: 'drivethru', icon: '🚗', name: 'Empório & Drive-Thru (Estrada)', desc: 'Venda caixas de cogumelos desidratados para carros de NPCs por 🪙 MycoCoins!', x: 17.5, y: 0.04, z: 37.5, yaw: Math.PI },
  { id: 'cinema', icon: '🎬', name: 'Cinema & Auditório', desc: 'Telão interativo com aulas e poltronas', x: 48, y: 0.14, z: -6.5, yaw: 0 },
  { id: 'sports', icon: '⚽', name: 'Complexo Esportivo', desc: 'Futebol, basquete com bolas reais e tênis', x: -36, y: 0, z: -15, yaw: Math.PI / 2 },
  { id: 'forest', icon: '🌲', name: 'Bosque & Lago', desc: 'Colha cogumelos silvestres pela floresta', x: 0, y: 0, z: -24, yaw: 0 },
  { id: 'mountain', icon: '🏔️', name: 'Montanhas (Snowboard)', desc: 'Pico panorâmico para descer de snowboard', x: 0, y: 28.5, z: -158, yaw: Math.PI }
];

export const LAB_QUEST_STEPS = [
  { key: 'sanitize_hood', icon: '🧴', title: '1. Higienizar a Capela', desc: 'Pegue um Borrifador de Álcool 70% e borrife dentro da Capela de Fluxo Laminar.', coins: 30 },
  { key: 'hood_on', icon: '🌬️', title: '2. Ligar o Fluxo Laminar', desc: 'Clique no interruptor da Capela de Fluxo Laminar para ligar o filtro HEPA.', coins: 30 },
  { key: 'cooker_heat', icon: '🔥', title: '3. Esterilizar na Autoclave', desc: 'Coloque um frasco/bag na Panela de Pressão ou ligue o Fogareiro Industrial.', coins: 40 },
  { key: 'syringe_use', icon: '💉', title: '4. Inocular com Seringa', desc: 'Use a Seringa 10ml em um frasco de Cultura Líquida ou spawn.', coins: 40 },
  { key: 'greenhouse_care', icon: '🍄', title: '5. Cuidar da Estufa', desc: 'Vá até a Estufa e borrife água ou colha um bloco maduro de cogumelos.', coins: 45 },
  { key: 'monotub_harvest', icon: '📦', title: '6. Colher no Monotub 24L', desc: 'Misture/nivele o substrato no Monotub LED e colha um flush maduro.', coins: 60 },
  { key: 'dry_pack', icon: '♨️', title: '7. Desidratar & Embalar', desc: 'Seque cogumelos na Desidratadora (55°C), armazene com Sílica ou empacote no Saco Mylar.', coins: 75 },
  { key: 'sell_pack', icon: '🚗', title: '8. Vender no Empório Drive-Thru', desc: 'Leve pacotes selados ou a Caixa de Entrega ao Empório da Estrada Sul!', coins: 100 }
];

let labQuestDone = {};

function getQuestStorageKey() {
  return 'myco_quest_' + (appState.currentUser ? appState.currentUser.id : 'guest');
}

export function updateQuestBadge() {
  const badge = $('quest-badge');
  if (!badge) return;
  let count = 0;
  LAB_QUEST_STEPS.forEach((st) => { if (labQuestDone[st.key]) count++; });
  badge.textContent = `${count}/${LAB_QUEST_STEPS.length}`;
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
  if (mods.indexOf('lab_practica_v1') !== -1) {
    LAB_QUEST_STEPS.forEach((st) => { labQuestDone[st.key] = true; });
  }
  const doneKeys = Object.keys(labQuestDone).filter((k) => labQuestDone[k]);
  if (doneKeys.length > srvSteps.length && typeof window !== 'undefined' && typeof window.syncCampusUserProgress === 'function') {
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
  if (typeof window !== 'undefined' && typeof window.syncCampusUserProgress === 'function') {
    window.syncCampusUserProgress({ lab_quest_steps: doneKeys });
  }

  let doneCount = 0;
  LAB_QUEST_STEPS.forEach((st) => { if (labQuestDone[st.key]) doneCount++; });
  const coinBonus = stepObj.coins || 30;
  addLocalMycoCoins(coinBonus);
  updateUserHud();

  if (doneCount < LAB_QUEST_STEPS.length) {
    if (window.MycoAudio && window.MycoAudio.playQuestComplete) window.MycoAudio.playQuestComplete();
    showFloatingToast(`✅ Etapa concluída (${doneCount}/${LAB_QUEST_STEPS.length}): ${stepObj.title} (+🪙 ${coinBonus} MycoCoins!)`, 3800);
  } else {
    try {
      const res = await apiPost('api/auth.php?action=complete_lab_quest', {}, true);
      if (res && res.ok && res.user) {
        appState.currentUser = res.user;
        updateUserHud();
        if (res.new_quest) {
          if (window.MycoAudio && window.MycoAudio.playQuestComplete) window.MycoAudio.playQuestComplete();
          else if (window.MycoAudio) window.MycoAudio.playEmote('cheer');
          showFloatingToast(`🏆 Jornada completa ${LAB_QUEST_STEPS.length}/${LAB_QUEST_STEPS.length}! +100 XP +🪙 ${coinBonus} MycoCoins!`, 4600);
        } else {
          showFloatingToast(`🧪 Missão Prática ${LAB_QUEST_STEPS.length}/${LAB_QUEST_STEPS.length} completa!`, 3200);
        }
      }
    } catch (e) {}
  }

  const qm = $('quest-modal');
  if (qm && !qm.classList.contains('hidden')) renderQuestModal();
}

export function renderMapModal() {
  const grid = $('map-sectors-grid');
  if (!grid) return;
  grid.innerHTML = '';
  CAMPUS_SECTORS.forEach((sec) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-left p-3 rounded-xl bg-slate-900/80 hover:bg-sky-900/50 border border-slate-700/70 hover:border-sky-400/60 transition flex items-start gap-2.5';
    btn.innerHTML =
      `<span class="text-2xl leading-none">${sec.icon}</span>` +
      `<div><div class="font-bold text-white">${escapeHtml(sec.name)}</div>` +
      `<div class="text-[11px] text-slate-400">${escapeHtml(sec.desc)}</div></div>`;
    btn.onclick = () => {
      if (window.teleportCampusPlayer) {
        window.teleportCampusPlayer(sec.x, sec.y, sec.z, sec.yaw);
        showFloatingToast(`${sec.icon} Teleportado para ${sec.name}`, 2500);
      }
      const mm = $('map-modal');
      if (mm) mm.classList.add('hidden');
    };
    grid.appendChild(btn);
  });
}

export function renderQuestModal() {
  const body = $('quest-body');
  if (!body) return;
  body.innerHTML = '';
  let doneCount = 0;
  LAB_QUEST_STEPS.forEach((st) => { if (labQuestDone[st.key]) doneCount++; });
  const pct = Math.round((doneCount / LAB_QUEST_STEPS.length) * 100);

  const header = document.createElement('div');
  header.className = 'p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-1.5';
  header.innerHTML =
    `<div class="flex items-center justify-between font-bold text-white">` +
    `<span>Progresso da Jornada</span><span class="text-emerald-300">${doneCount}/${LAB_QUEST_STEPS.length} (${pct}%)</span></div>` +
    `<div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">` +
    `<div class="h-full bg-emerald-400 transition-all" style="width:${pct}%"></div></div>`;
  body.appendChild(header);

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
}
