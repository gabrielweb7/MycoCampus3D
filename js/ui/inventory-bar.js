import { getLanguage, t } from '../core/i18n.js';

let lastSignature = '';
let bar;
let buttons;
let activeLabelEl;
let nextRender = 0;

export function getItemIcon(item, id) {
  if (!id && !item) return '';
  const key = (item?.meta?.prefabId || item?.mesh?.userData?.prefabId || item?.id || id || '').toLowerCase();
  const label = (item?.label || '').toLowerCase();

  if (key.includes('petri') || label.includes('petri') || label.includes('placa')) return '🧫';
  if (key.includes('syringe') || label.includes('seringa')) return '💉';
  if (key.includes('scalpel') || label.includes('bisturi') || label.includes('lâmina')) return '🔪';
  if (key.includes('alcohol') || key.includes('spray') || label.includes('álcool') || label.includes('spray')) return '🧴';
  if (key.includes('spoon') || label.includes('colher') || label.includes('espátula')) return '🥄';
  if (key.includes('thermometer') || label.includes('termômetro')) return '🌡️';
  if (key.includes('vial') || key.includes('ampola')) return '🧪';
  if (key.includes('falcon') || label.includes('falcon')) return '🧪';
  if (key.includes('jar') || label.includes('pote') || label.includes('vidro')) return '🫙';
  if (key.includes('bag') || label.includes('saco') || label.includes('pack')) return '🛍️';
  if (key.includes('wild_picked') || key.includes('harvest') || key.includes('mushroom') || key.includes('cogu') || label.includes('cogumelo')) return '🍄';
  if (key.includes('glove') || label.includes('luva')) return '🧤';
  if (key.includes('towel') || label.includes('papel')) return '🧻';
  if (key.includes('tape') || key.includes('micropore') || key.includes('parafilm') || label.includes('fita')) return '🩹';
  if (key.includes('foil') || label.includes('alumínio')) return '📄';
  if (key.includes('lamp') || label.includes('lamparina') || label.includes('fogo')) return '🔥';
  return '📦';
}

export function renderQuickInventory(ctx) {
  if (typeof document === 'undefined') return;
  if (!bar) {
    bar = document.getElementById('quick-inventory');
    if (!bar) return;
    buttons = bar.querySelectorAll('button[data-pocket]');
    activeLabelEl = bar.querySelector('#hotbar-active-label');
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

  // Tooltip flutuante do item em mãos (estilo Minecraft)
  const heldName = ctx.heldItem?.label || '';
  if (activeLabelEl) {
    if (heldName) {
      activeLabelEl.textContent = heldName;
      activeLabelEl.classList.remove('hidden');
      activeLabelEl.classList.add('show');
    } else {
      activeLabelEl.textContent = '';
      activeLabelEl.classList.remove('show');
      activeLabelEl.classList.add('hidden');
    }
  }

  buttons.forEach((button, slot) => {
    const rawLabel = labels[slot];
    const isSlotActive = slot === inv.active;
    const itemObj = isSlotActive ? ctx.heldItem : (inv.slots[slot] ? ctx.findPickable(inv.slots[slot]) : null);
    const hasItem = !!(isSlotActive ? ctx.heldItem : rawLabel);
    const defaultEmptyLabel = slot === 0 ? 'Mão Livre' : t('inventory.empty');
    const label = rawLabel || defaultEmptyLabel;
    const status = isSlotActive ? t('inventory.active') : rawLabel ? t('inventory.stored') : '';

    const labelEl = button.querySelector('.inventory-item');
    if (labelEl) labelEl.textContent = label;

    const iconEl = button.querySelector('.slot-icon');
    if (iconEl) {
      if (hasItem) {
        iconEl.textContent = getItemIcon(itemObj, isSlotActive ? ctx.heldItem?.id : inv.slots[slot]);
        iconEl.style.opacity = '1';
      } else {
        iconEl.textContent = slot === 0 ? '✋' : '🎒';
        iconEl.style.opacity = '0.4';
      }
    }

    const numberEl = button.querySelector('.slot-number');
    if (numberEl) numberEl.textContent = String(slot + 1);

    const description = [slot + 1, label, status].filter(Boolean).join(' · ');
    button.title = `${description} [${slot + 1} ou ${slot + 5}]`;
    button.setAttribute('aria-label', description);
    button.setAttribute('aria-pressed', String(isSlotActive));
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

  document.addEventListener('click', event => {
    if (!inventory.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setOpen(false);
  });
}
