/**
 * Guia de controles, tutorial opcional e compatibilidade de itens.
 */
import { $, escapeHtml } from './dom-helpers.js';
import { t } from '../core/i18n.js';

const categoryLabelKeys = {
  tool: 'misc.guide.cat_tool',
  equipment: 'misc.guide.cat_equipment',
  spawn_container: 'misc.guide.cat_spawn_container',
  solid_culture: 'misc.guide.cat_solid_culture',
  liquid_culture: 'misc.guide.cat_liquid_culture',
  glassware: 'misc.guide.cat_glassware',
  inoculation: 'misc.guide.cat_inoculation',
  mixing: 'misc.guide.cat_mixing',
  sterilization: 'misc.guide.cat_sterilization',
  heating: 'misc.guide.cat_heating',
  culture_plate: 'misc.guide.cat_culture_plate',
  consumable: 'misc.guide.cat_consumable'
};

const tutorialSteps = [
  {
    get title() { return t('misc.guide.step1_title'); },
    get text() { return t('misc.guide.step1_text'); }
  },
  {
    get title() { return t('misc.guide.step2_title'); },
    get text() { return t('misc.guide.step2_text'); }
  },
  {
    get title() { return t('misc.guide.step3_title'); },
    get text() { return t('misc.guide.step3_text'); }
  },
  {
    get title() { return t('misc.guide.step4_title'); },
    get text() { return t('misc.guide.step4_text'); }
  },
  {
    get title() { return t('misc.guide.step5_title'); },
    get text() { return t('misc.guide.step5_text'); }
  }
];

function renderItemCards() {
  const items = window.MycoCampus && window.MycoCampus.getLabItemGuide
    ? window.MycoCampus.getLabItemGuide()
    : [];
  if (!items.length) {
    return `<p class="text-sm text-slate-300">${escapeHtml(t('misc.guide.empty_items'))}</p>`;
  }

  const groups = new Map();
  items.forEach(function (item) {
    const category = t(categoryLabelKeys[item.category] || 'misc.guide.cat_other');
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });

  return Array.from(groups.entries()).map(function (group) {
    const cards = group[1].map(function (item) {
      const actions = item.compatibilities.length
        ? item.compatibilities.map((action) => `<li>${escapeHtml(action)}</li>`).join('')
        : `<li>${escapeHtml(t('misc.guide.no_direct_action'))}</li>`;
      const connections = item.connections.length
        ? `<p class="mt-2 text-xs text-sky-200"><strong>${escapeHtml(t('misc.guide.combines_with'))}</strong> ${item.connections.map(escapeHtml).join(', ')}</p>`
        : '';
      return `<article class="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <h4 class="font-bold text-white">${escapeHtml(item.name)}</h4>
        <p class="mt-1 text-xs text-slate-300">${escapeHtml(item.purpose || t('misc.guide.default_purpose'))}</p>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-200">${actions}</ul>
        ${connections}
      </article>`;
    }).join('');
    return `<section class="space-y-2">
      <h3 class="sticky top-0 rounded-lg bg-slate-950/95 px-2 py-1 text-sm font-bold text-emerald-300">${escapeHtml(group[0])}</h3>
      <div class="grid gap-2 sm:grid-cols-2">${cards}</div>
    </section>`;
  }).join('');
}

function setGuideTab(tab) {
  document.querySelectorAll('[data-guide-panel]').forEach(function (panel) {
    panel.classList.toggle('hidden', panel.getAttribute('data-guide-panel') !== tab);
  });
  document.querySelectorAll('[data-guide-tab]').forEach(function (button) {
    const active = button.getAttribute('data-guide-tab') === tab;
    button.classList.toggle('bg-emerald-500', active);
    button.classList.toggle('text-slate-950', active);
    button.classList.toggle('bg-slate-800', !active);
    button.classList.toggle('text-slate-200', !active);
  });
}

function renderTutorialStep(index) {
  const step = tutorialSteps[index];
  const title = $('guide-tutorial-title');
  const text = $('guide-tutorial-text');
  const progress = $('guide-tutorial-progress');
  const back = $('guide-tutorial-back');
  const next = $('guide-tutorial-next');
  const start = $('guide-tutorial-start');
  if (!step || !title || !text || !progress || !back || !next || !start) return;
  title.textContent = step.title;
  text.textContent = step.text;
  progress.textContent = t('misc.guide.step_progress', { current: index + 1, total: tutorialSteps.length });
  back.disabled = index === 0;
  next.textContent = index === tutorialSteps.length - 1 ? t('misc.guide.btn_finish') : t('misc.guide.btn_next');
  start.classList.add('hidden');
  back.classList.remove('hidden');
  next.classList.remove('hidden');
}

export function renderLabGuideModal() {
  const list = $('guide-items-list');
  if (list) list.innerHTML = renderItemCards();
  setGuideTab('controls');

  const start = $('guide-tutorial-start');
  if (start) {
    start.classList.remove('hidden');
    start.onclick = () => renderTutorialStep(0);
  }
  const back = $('guide-tutorial-back');
  if (back) {
    back.onclick = () => {
      const current = Math.max(0, tutorialSteps.findIndex((step) => step.title === $('guide-tutorial-title').textContent));
      renderTutorialStep(Math.max(0, current - 1));
    };
  }
  const next = $('guide-tutorial-next');
  if (next) {
    next.onclick = () => {
      const current = tutorialSteps.findIndex((step) => step.title === $('guide-tutorial-title').textContent);
      if (current >= tutorialSteps.length - 1) {
        start.classList.remove('hidden');
        back.classList.add('hidden');
        next.classList.add('hidden');
        const title = $('guide-tutorial-title');
        const text = $('guide-tutorial-text');
        const progress = $('guide-tutorial-progress');
        if (title) title.textContent = t('misc.guide.done_title');
        if (text) text.textContent = t('misc.guide.done_text');
        if (progress) progress.textContent = t('misc.guide.done_badge');
        try { localStorage.setItem('myco_lab_tutorial_done', '1'); } catch (e) {}
        if (typeof window !== 'undefined' && typeof window.syncCampusUserProgress === 'function') {
          window.syncCampusUserProgress({ lab_tutorial_done: true });
        }
      } else {
        renderTutorialStep(Math.max(0, current + 1));
      }
    };
  }

  document.querySelectorAll('[data-guide-tab]').forEach(function (button) {
    button.onclick = () => setGuideTab(button.getAttribute('data-guide-tab'));
  });
}
