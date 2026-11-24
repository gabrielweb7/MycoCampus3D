/** Optional, account-scoped welcome and in-game introduction. */
import { appState } from '../core/state.js';
import { events } from '../core/events.js';
import { t } from '../core/i18n.js';
import { $, isTouch, releaseInputForModal } from './dom-helpers.js';
import { renderLabGuideModal } from './modal-lab-guide.js';

const STEPS = [
  { title: 'controls_title', desktop: 'controls_desktop', touch: 'controls_touch' },
  { title: 'lab_title', text: 'lab_text' },
  { title: 'interact_title', desktop: 'interact_desktop', touch: 'interact_touch' },
  { title: 'cultivation_title', text: 'cultivation_text' }
];
let stepIndex = 0;
let active = false;
let welcomeUserId = null;
let afterIntroduction = null;
let goToLab = null;
let initialized = false;

function pendingKey(userId) { return 'myco_first_steps_pending_' + userId; }

export function rememberNewFirstStepsUser(user, created) {
  if (!created || user?.id == null) return;
  try { localStorage.setItem(pendingKey(user.id), '1'); } catch (e) {}
}

function clearPending(userId) {
  if (userId == null) return;
  try { localStorage.removeItem(pendingKey(userId)); } catch (e) {}
}

function finishIntroduction() {
  active = false;
  $('first-steps-panel')?.classList.add('hidden');
  const callback = afterIntroduction;
  afterIntroduction = null;
  if (callback && appState.currentUser?.id === welcomeUserId) callback();
  welcomeUserId = null;
}

function renderStep() {
  if (!active) return;
  const step = STEPS[stepIndex];
  const title = $('first-steps-title');
  const description = $('first-steps-description');
  const progress = $('first-steps-progress');
  const back = $('first-steps-back');
  const next = $('first-steps-next');
  const lab = $('first-steps-lab');
  const guide = $('first-steps-guide');
  const pointerHint = $('first-steps-pointer-hint');
  const panel = $('first-steps-panel');
  const topBar = $('hud-top-bar');
  if (title) title.textContent = t('first_steps.' + step.title);
  if (description) description.textContent = t('first_steps.' + (step.text || (isTouch() ? step.touch : step.desktop)));
  if (progress) progress.textContent = t('first_steps.progress', { current: stepIndex + 1, total: STEPS.length });
  if (back) back.disabled = stepIndex === 0;
  if (next) next.textContent = t(stepIndex === STEPS.length - 1 ? 'first_steps.finish' : 'first_steps.next');
  if (lab) lab.classList.toggle('hidden', stepIndex !== 1 || !goToLab);
  if (guide) guide.classList.toggle('hidden', stepIndex !== STEPS.length - 1);
  if (pointerHint) pointerHint.classList.toggle('hidden', isTouch());
  if (panel && topBar && panel.style && topBar.getBoundingClientRect) {
    const top = Math.max(72, Math.ceil(topBar.getBoundingClientRect().bottom) + 8);
    panel.style.top = top + 'px';
    panel.style.maxHeight = `max(100px, min(55vh, calc(100vh - ${top + 12}px)))`;
  }
}

export function startFirstSteps() {
  if (!appState.currentUser) return;
  clearPending(appState.currentUser.id);
  $('first-steps-welcome-modal')?.classList.add('hidden');
  $('guide-modal')?.classList.add('hidden');
  stepIndex = 0;
  active = true;
  $('first-steps-panel')?.classList.remove('hidden');
  renderStep();
}

export function showFirstStepsWelcome(user, created, onFinished) {
  if (!user || user.id == null || appState.currentUser?.id !== user.id) return false;
  let pending = !!created;
  try { pending ||= localStorage.getItem(pendingKey(user.id)) === '1'; } catch (e) {}
  const modal = $('first-steps-welcome-modal');
  if (!pending || !modal) return false;
  welcomeUserId = user.id;
  afterIntroduction = onFinished;
  releaseInputForModal();
  modal.classList.remove('hidden');
  return true;
}

export function resetFirstSteps() {
  active = false;
  afterIntroduction = null;
  welcomeUserId = null;
  $('first-steps-welcome-modal')?.classList.add('hidden');
  $('first-steps-panel')?.classList.add('hidden');
}

export function initFirstSteps({ onGoToLab } = {}) {
  goToLab = onGoToLab || null;
  if (initialized) return;
  initialized = true;
  const panel = $('first-steps-panel');
  if (panel) {
    panel.addEventListener('pointerdown', (event) => event.stopPropagation());
    panel.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
  }
  const start = $('first-steps-start');
  if (start) start.onclick = startFirstSteps;
  const explore = $('first-steps-explore');
  if (explore) explore.onclick = () => {
    clearPending(welcomeUserId);
    $('first-steps-welcome-modal')?.classList.add('hidden');
    finishIntroduction();
  };
  const replay = $('guide-first-steps');
  if (replay) replay.onclick = startFirstSteps;
  const close = $('first-steps-close');
  if (close) close.onclick = finishIntroduction;
  const back = $('first-steps-back');
  if (back) back.onclick = () => { stepIndex = Math.max(0, stepIndex - 1); renderStep(); };
  const next = $('first-steps-next');
  if (next) next.onclick = () => {
    if (stepIndex === STEPS.length - 1) finishIntroduction();
    else { stepIndex++; renderStep(); }
  };
  const lab = $('first-steps-lab');
  if (lab) lab.onclick = () => { if (goToLab) goToLab(); };
  const guide = $('first-steps-guide');
  if (guide) guide.onclick = () => {
    releaseInputForModal();
    renderLabGuideModal();
    document.querySelector('[data-guide-tab="tutorial"]')?.click();
    $('guide-modal')?.classList.remove('hidden');
  };
  events.on('language:changed', renderStep);
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', renderStep);
}
