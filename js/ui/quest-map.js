/**
 * MycoCampus3D — Mapa Rápido (Teleporte) & Missão Prática de 5 Passos
 */
import { appState } from '../core/state.js';
import { apiPost } from '../services/api-client.js';
import { $, escapeHtml, showFloatingToast } from './dom-helpers.js';
import { updateUserHud } from './hud-lobby.js';

export const CAMPUS_SECTORS = [
  { id: 'plaza', icon: '🏛️', name: 'Praça Central', desc: 'Ponto inicial, fonte e torre do relógio', x: 0, y: 0, z: 10.5, yaw: 0 },
  { id: 'lab', icon: '🧪', name: 'Laboratório Asséptico', desc: 'Fluxo laminar, autoclave, fogareiro e seringas', x: -16.2, y: 0.14, z: -7.0, yaw: Math.PI / 2 },
  { id: 'storage', icon: '📦', name: 'Depósito de Insumos', desc: 'Bags, vidros, grãos, placas e borrifadores', x: -16.2, y: 0.14, z: 7.5, yaw: Math.PI / 2 },
  { id: 'greenhouse', icon: '🍄', name: 'Estufa de Frutificação', desc: 'Cultive e colha 4 espécies de cogumelos', x: 16.5, y: 0.14, z: 7.5, yaw: -Math.PI / 2 },
  { id: 'cinema', icon: '🎬', name: 'Cinema & Auditório', desc: 'Telão interativo com aulas e poltronas', x: 48, y: 0.14, z: -6.5, yaw: 0 },
  { id: 'sports', icon: '⚽', name: 'Complexo Esportivo', desc: 'Futebol, basquete com bolas reais e tênis', x: -36, y: 0, z: -15, yaw: Math.PI / 2 },
  { id: 'forest', icon: '🌲', name: 'Bosque & Lago', desc: 'Colha cogumelos silvestres pela floresta', x: 0, y: 0, z: -24, yaw: 0 },
  { id: 'mountain', icon: '🏔️', name: 'Montanhas (Snowboard)', desc: 'Pico panorâmico para descer de snowboard', x: 0, y: 28.5, z: -158, yaw: Math.PI }
];

export const LAB_QUEST_STEPS = [
  { key: 'sanitize_hood', icon: '🧴', title: '1. Higienizar a Capela', desc: 'Pegue um Borrifador de Álcool 70% e borrife dentro da Capela de Fluxo Laminar.' },
  { key: 'hood_on', icon: '🌬️', title: '2. Ligar o Fluxo Laminar', desc: 'Clique no interruptor da Capela de Fluxo Laminar para ligar o filtro HEPA.' },
  { key: 'cooker_heat', icon: '🔥', title: '3. Esterilizar na Autoclave', desc: 'Coloque um frasco/bag na Panela de Pressão ou ligue o Fogareiro Industrial.' },
  { key: 'syringe_use', icon: '💉', title: '4. Inocular com Seringa', desc: 'Use a Seringa 10ml em um frasco de Cultura Líquida ou spawn.' },
  { key: 'greenhouse_care', icon: '🍄', title: '5. Cuidar da Estufa', desc: 'Vá até a Estufa e borrife água ou colha um bloco maduro de cogumelos.' }
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
  const mods = (appState.currentUser && appState.currentUser.completed_modules) || [];
  if (mods.indexOf('lab_practica_v1') !== -1) {
    LAB_QUEST_STEPS.forEach((st) => { labQuestDone[st.key] = true; });
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

  let doneCount = 0;
  LAB_QUEST_STEPS.forEach((st) => { if (labQuestDone[st.key]) doneCount++; });

  if (doneCount < LAB_QUEST_STEPS.length) {
    showFloatingToast(`✅ Etapa concluída (${doneCount}/5): ${stepObj.title}`, 3600);
  } else {
    try {
      const res = await apiPost('api/auth.php?action=complete_lab_quest', {}, true);
      if (res && res.ok && res.user) {
        appState.currentUser = res.user;
        updateUserHud();
        if (res.new_quest) {
          if (window.MycoAudio) window.MycoAudio.playEmote('cheer');
          showFloatingToast('🏆 Missão Prática 5/5 Concluída! +100 XP no seu perfil!', 4500);
        } else {
          showFloatingToast('🧪 Missão Prática 5/5 completa!', 3200);
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
    `<span>Progresso da Prática</span><span class="text-emerald-300">${doneCount}/5 (${pct}%)</span></div>` +
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
