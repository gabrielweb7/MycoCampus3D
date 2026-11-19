/**
 * MycoCampus3D — Modal de Controle & Automação da Estufa Climatizada (24 Bolos)
 */
import { greenhouseEnv, greenhouseSlots } from '../world/greenhouse.js';
import { $, releaseInputForModal } from './dom-helpers.js';

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
    statusBadge.className = 'px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border ' + (
      greenhouseEnv.statusLevel === 'optimal'
        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
        : (greenhouseEnv.statusLevel === 'adjusting'
          ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
          : 'bg-rose-500/20 border-rose-400/40 text-rose-300')
    );
  }

  const alertBox = $('gh-health-alert');
  const alertText = $('gh-health-alert-text');
  const healBtn = $('gh-btn-auto-heal');
  const hasStress = greenhouseEnv.primaryStress && greenhouseEnv.primaryStress !== 'none';
  if (alertBox && alertText) {
    if (hasStress) {
      alertBox.className = 'rounded-xl bg-rose-950/65 border border-rose-500/50 px-3 py-2 text-xs text-rose-100 font-semibold flex flex-wrap items-center justify-between gap-2';
      alertText.textContent = `⚠️ ${greenhouseEnv.stressAdvice}`;
      if (healBtn) healBtn.classList.remove('hidden');
    } else if (greenhouseEnv.avgHealth < 98) {
      alertBox.className = 'rounded-xl bg-amber-950/55 border border-amber-500/45 px-3 py-2 text-xs text-amber-100 font-semibold flex flex-wrap items-center justify-between gap-2';
      alertText.textContent = `🌱 Microclima estabilizado! Bolos se recuperando (Saúde média: ${Math.round(greenhouseEnv.avgHealth)}%)`;
      if (healBtn) healBtn.classList.add('hidden');
    } else {
      alertBox.className = 'rounded-xl bg-emerald-950/60 border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200 font-semibold flex flex-wrap items-center justify-between gap-2';
      alertText.textContent = `✅ Todos os bolos saudáveis (${Math.round(greenhouseEnv.avgHealth)}%) • Microclima ideal!`;
      if (healBtn) healBtn.classList.add('hidden');
    }
  }

  if ($('gh-val-hum')) $('gh-val-hum').textContent = `${Math.round(greenhouseEnv.humidity)}%`;
  if ($('gh-sub-hum')) $('gh-sub-hum').textContent = `Umidificador: ${greenhouseEnv.humidifierPower > 0 ? 'Nível ' + greenhouseEnv.humidifierPower : 'OFF'}`;
  if ($('gh-val-co2')) $('gh-val-co2').textContent = `${Math.round(greenhouseEnv.co2Ppm)} ppm`;
  if ($('gh-sub-co2')) $('gh-sub-co2').textContent = `Exaustor: ${greenhouseEnv.exhaustPower === 0 ? 'OFF' : (greenhouseEnv.exhaustPower === 1 ? 'Suave' : 'Forte')}`;
  if ($('gh-val-temp')) $('gh-val-temp').textContent = `${greenhouseEnv.tempC.toFixed(1)}°C`;
  if ($('gh-sub-temp')) $('gh-sub-temp').textContent = `3 Fans: ${greenhouseEnv.coolerActive ? 'ON (' + greenhouseEnv.targetTempC.toFixed(0) + '°C)' : 'OFF'}`;
  if ($('gh-val-health')) {
    const avgH = Math.round(greenhouseEnv.avgHealth);
    $('gh-val-health').textContent = `${avgH}%`;
    $('gh-val-health').className = 'text-base sm:text-lg font-extrabold ' + (avgH >= 80 ? 'text-emerald-300' : (avgH >= 55 ? 'text-amber-300' : 'text-rose-400'));
  }
  if ($('gh-val-light')) $('gh-val-light').textContent = `LED Grow: ${greenhouseEnv.lightOn ? 'ON' : 'OFF'}`;

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
  if ($('gh-manual-temp-label')) $('gh-manual-temp-label').textContent = `${greenhouseEnv.targetTempC.toFixed(1)}°C`;

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
  setActiveBtn('gh-cooler-off', !greenhouseEnv.coolerActive, 'bg-rose-500 text-white border-rose-400');
  setActiveBtn('gh-cooler-on', greenhouseEnv.coolerActive, 'bg-cyan-400 text-slate-950 border-cyan-300');
  setActiveBtn('gh-light-toggle', greenhouseEnv.lightOn, 'bg-amber-300 text-slate-950 border-amber-200');
  if ($('gh-light-toggle')) $('gh-light-toggle').textContent = greenhouseEnv.lightOn ? '💡 LED Grow: LIGADO' : '💡 LED Grow: DESLIGADO';

  let matureCount = 0;
  let emptyCount = 0;
  let stressedCount = 0;
  for (let i = 0; i < greenhouseSlots.length; i++) {
    const slot = greenhouseSlots[i];
    if (slot.empty || slot.stage < 0) emptyCount++;
    else {
      if (slot.stage === 3) matureCount++;
      const slotHealth = typeof slot.health === 'number' ? Math.round(slot.health) : 100;
      if ((slot.stressType && slot.stressType !== 'none') || slotHealth < 80) stressedCount++;
    }
  }
  if ($('gh-slots-summary')) {
    $('gh-slots-summary').textContent = `${greenhouseSlots.length - emptyCount}/${greenhouseSlots.length} ativos • ${matureCount} maduros • ${stressedCount > 0 ? stressedCount + ' estressados' : emptyCount + ' livres'}`;
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

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (window.MycoAudio) window.MycoAudio.playClick();
      close();
    }
  });

  $('gh-btn-mode-auto')?.addEventListener('click', () => {
    if (window.MycoAudio) window.MycoAudio.playClick();
    applySettings({ autoMode: true });
  });
  $('gh-btn-mode-manual')?.addEventListener('click', () => {
    if (window.MycoAudio) window.MycoAudio.playClick();
    applySettings({ autoMode: false });
  });

  $('gh-btn-auto-heal')?.addEventListener('click', () => {
    if (window.MycoAudio) window.MycoAudio.playClick();
    if (window.MycoCampus && typeof window.MycoCampus.restoreGreenhouseOptimal === 'function') {
      window.MycoCampus.restoreGreenhouseOptimal();
    }
    renderGreenhouseModal();
  });

  $('gh-hum-minus')?.addEventListener('click', () => applySettings({ targetHumidity: greenhouseEnv.targetHumidity - 2 }));
  $('gh-hum-plus')?.addEventListener('click', () => applySettings({ targetHumidity: greenhouseEnv.targetHumidity + 2 }));
  $('gh-co2-minus')?.addEventListener('click', () => applySettings({ targetCo2: greenhouseEnv.targetCo2 - 50 }));
  $('gh-co2-plus')?.addEventListener('click', () => applySettings({ targetCo2: greenhouseEnv.targetCo2 + 50 }));
  $('gh-temp-minus')?.addEventListener('click', () => applySettings({ targetTempC: greenhouseEnv.targetTempC - 1 }));
  $('gh-temp-plus')?.addEventListener('click', () => applySettings({ targetTempC: greenhouseEnv.targetTempC + 1 }));

  $('gh-manual-temp-minus')?.addEventListener('click', () => applySettings({ autoMode: false, coolerActive: true, targetTempC: greenhouseEnv.targetTempC - 1 }));
  $('gh-manual-temp-plus')?.addEventListener('click', () => applySettings({ autoMode: false, coolerActive: true, targetTempC: greenhouseEnv.targetTempC + 1 }));

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
