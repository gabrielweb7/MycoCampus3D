/**
 * MycoCampus3D — Modal de Controle & Automação da Estufa Climatizada (24 Bolos)
 */
import { greenhouseEnv, greenhouseSlots } from '../world/greenhouse.js';
import { $, escapeHtml, releaseInputForModal } from './dom-helpers.js';

let refreshTimer = null;

function applySettings(partial) {
  if (window.MycoCampus && typeof window.MycoCampus.setGreenhouseSettings === 'function') {
    window.MycoCampus.setGreenhouseSettings(partial);
  }
  renderGreenhouseModal();
}

export function renderGreenhouseModal() {
  const modal = $('greenhouse-modal');
  if (!modal) return;

  const statusBadge = $('gh-status-badge');
  if (statusBadge) {
    statusBadge.textContent = `${greenhouseEnv.statusLabel} • Score ${Math.round(greenhouseEnv.climateScore)}%`;
    statusBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold border ' + (
      greenhouseEnv.statusLevel === 'optimal'
        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
        : (greenhouseEnv.statusLevel === 'adjusting'
          ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
          : 'bg-rose-500/20 border-rose-400/40 text-rose-300')
    );
  }

  if ($('gh-val-hum')) $('gh-val-hum').textContent = `${Math.round(greenhouseEnv.humidity)}%`;
  if ($('gh-val-co2')) $('gh-val-co2').textContent = `${Math.round(greenhouseEnv.co2Ppm)} ppm`;
  if ($('gh-val-temp')) $('gh-val-temp').textContent = `${greenhouseEnv.tempC.toFixed(1)}°C`;
  if ($('gh-val-light')) $('gh-val-light').textContent = greenhouseEnv.lightOn ? 'ON' : 'OFF';

  const btnAuto = $('gh-btn-mode-auto');
  const btnManual = $('gh-btn-mode-manual');
  if (btnAuto && btnManual) {
    btnAuto.className = 'flex-1 py-2 rounded-xl text-xs font-extrabold border ' + (greenhouseEnv.autoMode
      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
      : 'bg-slate-800 text-slate-300 border-slate-700');
    btnManual.className = 'flex-1 py-2 rounded-xl text-xs font-extrabold border ' + (!greenhouseEnv.autoMode
      ? 'bg-amber-400 text-slate-950 border-amber-300'
      : 'bg-slate-800 text-slate-300 border-slate-700');
  }

  const autoPanel = $('gh-auto-controls');
  const manualPanel = $('gh-manual-controls');
  if (autoPanel && manualPanel) {
    autoPanel.classList.toggle('hidden', !greenhouseEnv.autoMode);
    manualPanel.classList.toggle('hidden', greenhouseEnv.autoMode);
  }

  if ($('gh-target-hum-label')) $('gh-target-hum-label').textContent = `${greenhouseEnv.targetHumidity}%`;
  if ($('gh-target-co2-label')) $('gh-target-co2-label').textContent = `${greenhouseEnv.targetCo2} ppm`;
  if ($('gh-target-temp-label')) $('gh-target-temp-label').textContent = `${greenhouseEnv.targetTempC.toFixed(1)}°C`;

  const setActiveBtn = (id, active, activeCls) => {
    const el = $(id);
    if (!el) return;
    el.className = 'px-2.5 py-1.5 rounded-lg text-xs font-bold border ' + (active
      ? activeCls
      : 'bg-slate-800/80 text-slate-300 border-slate-700');
  };

  for (let i = 0; i <= 3; i++) {
    setActiveBtn(`gh-hum-lvl-${i}`, greenhouseEnv.humidifierPower === i, 'bg-sky-500 text-slate-950 border-sky-300');
  }
  for (let i = 0; i <= 2; i++) {
    setActiveBtn(`gh-exh-lvl-${i}`, greenhouseEnv.exhaustPower === i, 'bg-emerald-500 text-slate-950 border-emerald-300');
  }
  setActiveBtn('gh-cooler-off', !greenhouseEnv.coolerActive, 'bg-slate-500 text-white border-slate-400');
  setActiveBtn('gh-cooler-on', greenhouseEnv.coolerActive, 'bg-cyan-400 text-slate-950 border-cyan-300');
  setActiveBtn('gh-light-toggle', greenhouseEnv.lightOn, 'bg-amber-300 text-slate-950 border-amber-200');
  if ($('gh-light-toggle')) $('gh-light-toggle').textContent = greenhouseEnv.lightOn ? '💡 LED Grow: LIGADO' : '💡 LED Grow: DESLIGADO';

  const slotsGrid = $('gh-slots-grid');
  if (slotsGrid) {
    let matureCount = 0;
    let emptyCount = 0;
    const html = greenhouseSlots.map((slot) => {
      if (slot.empty || slot.stage < 0) emptyCount++;
      if (!slot.empty && slot.stage === 3) matureCount++;

      const badge = slot.empty || slot.stage < 0
        ? '<span class="text-slate-400">📦 Livre</span>'
        : (slot.stage === 3
          ? '<span class="text-emerald-300 font-extrabold">✨ Maduro!</span>'
          : (slot.stage === 2
            ? '<span class="text-amber-300">🌱 Crescendo</span>'
            : (slot.stage === 1
              ? '<span class="text-sky-300">🔬 Pins</span>'
              : '<span class="text-slate-300">⚪ Micélio</span>')));
      const borderCls = slot.empty || slot.stage < 0
        ? 'border-slate-700/60 bg-slate-900/50'
        : (slot.stage === 3 ? 'border-emerald-400/60 bg-emerald-950/35' : 'border-slate-700 bg-slate-900/80');

      return `<div class="rounded-xl border ${borderCls} p-2 text-[11px] flex flex-col justify-between gap-1">` +
        `<div class="flex items-center justify-between gap-1">` +
          `<span class="font-bold text-slate-200 truncate">#${slot.id + 1} • A${slot.tier}</span>` +
          badge +
        `</div>` +
        `<div class="text-slate-300 font-semibold truncate">${escapeHtml(slot.name)}</div>` +
        `<div class="text-[10px] text-slate-400">${escapeHtml(slot.rackName)} • ${slot.empty ? 'Espaço disponível' : `${Math.round(slot.humidity)}% UR • F${slot.flush}/3`}</div>` +
      `</div>`;
    }).join('');
    slotsGrid.innerHTML = html;
    if ($('gh-slots-summary')) {
      $('gh-slots-summary').textContent = `${24 - emptyCount}/24 bolos ativos • ${matureCount} maduros p/ colher • ${emptyCount} espaços livres`;
    }
  }
}

export function bindGreenhouseModalControls() {
  const modal = $('greenhouse-modal');
  if (!modal || modal.dataset.bound === '1') return;
  modal.dataset.bound = '1';

  const close = () => {
    modal.classList.add('hidden');
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  $('btn-close-greenhouse')?.addEventListener('click', () => {
    if (window.MycoAudio) window.MycoAudio.playClick();
    close();
  });

  $('gh-btn-mode-auto')?.addEventListener('click', () => {
    if (window.MycoAudio) window.MycoAudio.playClick();
    applySettings({ autoMode: true });
  });
  $('gh-btn-mode-manual')?.addEventListener('click', () => {
    if (window.MycoAudio) window.MycoAudio.playClick();
    applySettings({ autoMode: false });
  });

  $('gh-hum-minus')?.addEventListener('click', () => applySettings({ targetHumidity: greenhouseEnv.targetHumidity - 2 }));
  $('gh-hum-plus')?.addEventListener('click', () => applySettings({ targetHumidity: greenhouseEnv.targetHumidity + 2 }));
  $('gh-co2-minus')?.addEventListener('click', () => applySettings({ targetCo2: greenhouseEnv.targetCo2 - 50 }));
  $('gh-co2-plus')?.addEventListener('click', () => applySettings({ targetCo2: greenhouseEnv.targetCo2 + 50 }));
  $('gh-temp-minus')?.addEventListener('click', () => applySettings({ targetTempC: greenhouseEnv.targetTempC - 1 }));
  $('gh-temp-plus')?.addEventListener('click', () => applySettings({ targetTempC: greenhouseEnv.targetTempC + 1 }));

  for (let i = 0; i <= 3; i++) {
    $(`gh-hum-lvl-${i}`)?.addEventListener('click', () => applySettings({ autoMode: false, humidifierPower: i }));
  }
  for (let i = 0; i <= 2; i++) {
    $(`gh-exh-lvl-${i}`)?.addEventListener('click', () => applySettings({ autoMode: false, exhaustPower: i }));
  }
  $('gh-cooler-off')?.addEventListener('click', () => applySettings({ autoMode: false, coolerActive: false }));
  $('gh-cooler-on')?.addEventListener('click', () => applySettings({ autoMode: false, coolerActive: true }));
  $('gh-light-toggle')?.addEventListener('click', () => applySettings({ lightOn: !greenhouseEnv.lightOn }));

  $('gh-btn-mist-pulse')?.addEventListener('click', () => {
    if (window.MycoCampus && window.MycoCampus.pulseGreenhouseMist) window.MycoCampus.pulseGreenhouseMist();
    renderGreenhouseModal();
  });
  $('gh-btn-vent-pulse')?.addEventListener('click', () => {
    if (window.MycoCampus && window.MycoCampus.pulseGreenhouseVent) window.MycoCampus.pulseGreenhouseVent();
    renderGreenhouseModal();
  });
}

export function openGreenhouseControlModal() {
  bindGreenhouseModalControls();
  releaseInputForModal();
  renderGreenhouseModal();
  const modal = $('greenhouse-modal');
  if (modal) modal.classList.remove('hidden');
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const m = $('greenhouse-modal');
    if (!m || m.classList.contains('hidden')) {
      clearInterval(refreshTimer);
      refreshTimer = null;
      return;
    }
    renderGreenhouseModal();
  }, 1000);
}
