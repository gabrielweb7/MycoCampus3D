import { getLanguage, t } from '../core/i18n.js';

let lastSignature = '';
let bar;
let buttons;
let nextRender = 0;

export function renderQuickInventory(ctx) {
  if (typeof document === 'undefined') return;
  if (!bar) {
    bar = document.getElementById('quick-inventory');
    if (!bar) return;
    buttons = bar.querySelectorAll('button[data-pocket]');
  }
  const inv = ctx.inventory;
  const visible = !!(ctx.inFps && inv?.ready && !ctx.adminEditMode);
  bar.classList.toggle('hidden', !visible);
  if (!visible) return;
  const now = performance.now();
  if (now < nextRender) return;
  nextRender = now + 100;
  const labels = inv.slots.map((id, slot) => slot === inv.active
    ? (ctx.heldItem?.label || '')
    : (id && ctx.findPickable(id)?.label) || (id ? t('inventory.loading') : ''));
  const signature = JSON.stringify([inv.active, !!inv.pending, getLanguage(), ...labels]);
  if (signature === lastSignature) return;
  lastSignature = signature;
  bar.setAttribute('aria-label', t('inventory.title'));
  bar.setAttribute('aria-busy', String(!!inv.pending));
  const count = bar.querySelector('#inventory-count');
  if (count) count.textContent = String(inv.slots.filter((id, slot) => id && slot !== inv.active).length);
  buttons.forEach((button, slot) => {
    const label = labels[slot] || t('inventory.empty');
    const status = slot === inv.active ? t('inventory.active') : labels[slot] ? t('inventory.stored') : '';
    button.querySelector('.inventory-item').textContent = label;
    const description = [slot + 5, label, status].filter(Boolean).join(' · ');
    button.title = description;
    button.setAttribute('aria-label', description);
    button.setAttribute('aria-pressed', String(slot === inv.active));
    button.disabled = !!inv.pending;
  });
}

export function bindQuickInventory(selectSlot) {
  const inventory = document.getElementById('quick-inventory');
  const toggle = document.getElementById('inventory-toggle');
  if (!inventory) return;
  function setOpen(open) {
    inventory.classList.toggle('open', open);
    toggle?.setAttribute('aria-expanded', String(open));
  }
  inventory.addEventListener('click', event => {
    if (event.target.closest('#inventory-toggle')) {
      event.stopPropagation();
      setOpen(!inventory.classList.contains('open'));
      return;
    }
    const target = event.target.closest('button[data-pocket]');
    if (!target) return;
    event.stopPropagation();
    selectSlot(Number(target.dataset.pocket));
    setOpen(false);
  });
  document.addEventListener('click', event => { if (!inventory.contains(event.target)) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
}
