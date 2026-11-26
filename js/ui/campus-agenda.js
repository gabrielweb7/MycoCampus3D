import { CAMPUS_SECTORS } from './quest-map.js';
import { getActiveVipOrders } from '../world/roadside-stand-state.js';
import { MYCOCOIN_PRICE_PER_PACK } from '../core/myco-coins.js';
import { t } from '../core/i18n.js';
import { releaseInputForModal, showFloatingToast } from './dom-helpers.js';

const ROUTES = [
  { sector: 'forest', key: 'forest', icon: '🌲' },
  { sector: 'drivethru', key: 'delivery', icon: '🚗' },
  { sector: 'dehydration', key: 'prep', icon: '📦' }
];

const MEETUP_PARAM = 'encontro';
const findSector = id => CAMPUS_SECTORS.find(sector => sector.id === id);
const isMeetup = id => ROUTES.some(route => route.sector === id);

function goTo(sector) {
  if (!sector || !window.teleportCampusPlayer) return false;
  window.teleportCampusPlayer(sector.x, sector.y, sector.z, sector.yaw);
  return true;
}

export function applyCampusMeetupInvite() {
  if (!window.location?.href) return false;
  const url = new URL(window.location.href);
  const destination = url.searchParams.get(MEETUP_PARAM);
  if (!isMeetup(destination) || !goTo(findSector(destination))) return false;
  url.searchParams.delete(MEETUP_PARAM);
  window.history.replaceState(window.history.state, '', url);
  showFloatingToast(t('agenda.joined', { place: t('agenda.' + ROUTES.find(route => route.sector === destination).key) }));
  return true;
}

export function openCampusAgenda() {
  if (document.getElementById('campus-agenda')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'campus-agenda';
  dialog.className = 'glass-panel portable-grow-panel';
  dialog.setAttribute('aria-labelledby', 'campus-agenda-title');

  function make(tag, parent, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    parent.append(el);
    return el;
  }

  function button(parent, label, action) {
    const el = make('button', parent, label);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }

  const header = make('header', dialog, null, 'grow-panel-header');
  const heading = make('h2', header, t('agenda.title'));
  heading.id = 'campus-agenda-title';
  const close = button(header, t('grow.close'), () => dialog.close());
  close.className = 'grow-close';
  const body = make('div', dialog, null, 'grow-panel-body');
  const order = make('section', body, null, 'grow-metric');
  make('strong', order, t('agenda.vip'));
  const orderDetail = make('p', order);
  const updateOrder = () => {
    const species = getActiveVipOrders().join(' · ');
    orderDetail.textContent = t('agenda.order', { species, coins: Math.round(MYCOCOIN_PRICE_PER_PACK * 1.5) });
  };
  updateOrder();

  for (const route of ROUTES) {
    const card = make('section', body, null, 'grow-metric');
    const name = t('agenda.' + route.key);
    make('strong', card, route.icon + ' ' + name);
    make('p', card, t('agenda.' + route.key + '_help'));
    const actions = make('div', card, null, 'grow-mode-controls');
    button(actions, t('agenda.go'), () => {
      if (goTo(findSector(route.sector))) dialog.close();
    });
    button(actions, t('agenda.copy'), async () => {
      const url = new URL('index.html', window.location.href);
      url.searchParams.set(MEETUP_PARAM, route.sector);
      try {
        await navigator.clipboard.writeText(url.href);
        showFloatingToast(t('agenda.copied'));
      } catch {
        let field = card.querySelector('input');
        if (!field) {
          field = make('input', card);
          field.type = 'url';
          field.readOnly = true;
          field.className = 'rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200';
          field.setAttribute('aria-label', t('agenda.copy'));
        }
        field.value = url.href;
        field.select();
      }
    });
  }

  document.body.append(dialog);
  releaseInputForModal();
  const timer = setInterval(updateOrder, 1500);
  dialog.addEventListener('close', () => {
    clearInterval(timer);
    dialog.remove();
  }, { once: true });
  dialog.showModal();
}
