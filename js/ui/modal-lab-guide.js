/**
 * Guia de controles, tutorial opcional e compatibilidade de itens.
 */
import { $, escapeHtml } from './dom-helpers.js';

const categoryLabels = {
  tool: 'Ferramentas',
  equipment: 'Equipamentos',
  spawn_container: 'Recipientes de spawn',
  solid_culture: 'Culturas sólidas',
  liquid_culture: 'Culturas líquidas',
  glassware: 'Vidraçaria',
  inoculation: 'Inoculação',
  mixing: 'Mistura',
  sterilization: 'Esterilização',
  heating: 'Aquecimento',
  culture_plate: 'Placas de cultura',
  consumable: 'Consumíveis'
};

const tutorialSteps = [
  {
    title: '1. Aprenda os controles',
    text: 'No PC, use WASD para andar, mouse para olhar e clique para agir; R ou a roda giram um item. Para posicionar, pressione G/Q ou clique direito, mire e clique para confirmar; Esc cancela. No celular, use o joystick, arraste a tela para olhar, toque em 📦 para escolher o local e toque no mundo para confirmar.'
  },
  {
    title: '2. Siga as dicas ao mirar',
    text: 'Aproxime-se de um objeto e mire nele. A mensagem na tela mostra o que a ferramenta atual pode fazer. No celular, o botão de ação acompanha o alvo; se nada for compatível, a dica explica o próximo passo.'
  },
  {
    title: '3. Prepare o recipiente',
    text: 'Use substrato para preencher um bag ou prepare o PP5 com flocão e água. Cada recipiente indica o que falta. Evite tentar inocular um recipiente vazio ou ainda sem hidratação.'
  },
  {
    title: '4. Feche e esterilize',
    text: 'Antes da esterilização, use a Seladora Térmica em um bag preenchido. Coloque o recipiente na panela, feche a tampa e use o modo e aquecimento adequados. Espere o estado indicar que está estéril.'
  },
  {
    title: '5. Inocule com cuidado',
    text: 'Higienize a área, ligue o fluxo laminar e use a seringa ou o bisturi compatível em um recipiente esterilizado. Acompanhe o rótulo do item para ver se está colonizando, contaminado ou pronto.'
  }
];

function renderItemCards() {
  const items = window.MycoCampus && window.MycoCampus.getLabItemGuide
    ? window.MycoCampus.getLabItemGuide()
    : [];
  if (!items.length) {
    return '<p class="text-sm text-slate-300">A lista de itens aparece quando o laboratório termina de carregar.</p>';
  }

  const groups = new Map();
  items.forEach(function (item) {
    const category = categoryLabels[item.category] || 'Outros itens';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });

  return Array.from(groups.entries()).map(function (group) {
    const cards = group[1].map(function (item) {
      const actions = item.compatibilities.length
        ? item.compatibilities.map((action) => `<li>${escapeHtml(action)}</li>`).join('')
        : '<li>Não possui ação direta cadastrada.</li>';
      const connections = item.connections.length
        ? `<p class="mt-2 text-xs text-sky-200"><strong>Combina com:</strong> ${item.connections.map(escapeHtml).join(', ')}</p>`
        : '';
      return `<article class="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <h4 class="font-bold text-white">${escapeHtml(item.name)}</h4>
        <p class="mt-1 text-xs text-slate-300">${escapeHtml(item.purpose || 'Ferramenta de laboratório.')}</p>
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
  progress.textContent = `Etapa ${index + 1} de ${tutorialSteps.length}`;
  back.disabled = index === 0;
  next.textContent = index === tutorialSteps.length - 1 ? 'Concluir' : 'Próximo';
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
        if (title) title.textContent = 'Tutorial concluído!';
        if (text) text.textContent = 'Pronto. Você pode rever estas etapas quando quiser ou consultar a compatibilidade de qualquer item.';
        if (progress) progress.textContent = 'Concluído';
        try { localStorage.setItem('myco_lab_tutorial_done', '1'); } catch (e) {}
      } else {
        renderTutorialStep(Math.max(0, current + 1));
      }
    };
  }

  document.querySelectorAll('[data-guide-tab]').forEach(function (button) {
    button.onclick = () => setGuideTab(button.getAttribute('data-guide-tab'));
  });
}
