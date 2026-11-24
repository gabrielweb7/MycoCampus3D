import { $, releaseInputForModal } from './dom-helpers.js';

const accepted = new Set();
let pending = null;

export function showDiscordWelcome(userId, onClosed) {
  const dialog = $('discord-welcome-modal');
  if (!userId || !dialog?.showModal) return false;
  const key = `myco_discord_welcome_v1_${userId}`;
  if (accepted.has(key)) return false;
  try { if (localStorage.getItem(key)) return false; } catch { /* session memory is sufficient */ }

  releaseInputForModal();
  pending = { key, onClosed };
  dialog.onclose = () => {
    if (dialog.open || !pending) return;
    const entry = pending;
    pending = null;
    accepted.add(entry.key);
    try { localStorage.setItem(entry.key, '1'); } catch { /* session memory is sufficient */ }
    entry.onClosed?.();
  };
  $('discord-welcome-join').onclick = () => dialog.close();
  $('discord-welcome-later').onclick = () => dialog.close();
  if (!dialog.open) dialog.showModal();
  return true;
}

export function dismissDiscordWelcome() {
  pending = null;
  $('discord-welcome-modal')?.close();
}
