/**
 * MycoCampus3D — Sincronização Multiplayer em Tempo Real (Delta Sync)
 */
import { applyCampusMeetupInvite } from '../ui/campus-agenda.js';
import { appState } from '../core/state.js';
import { SYNC_BACKGROUND_INTERVAL_MS, SYNC_INTERVAL_MS } from '../core/constants.js';
import { setVillageTraffic } from '../world/village-traffic.js';
import { applyVillageUpgrades } from '../world/house-upgrades.js';
import { events } from '../core/events.js';
import { apiPost } from '../services/api-client.js';
import { $, showFloatingToast } from '../ui/dom-helpers.js';
import { applySlideTo3D } from '../ui/hud-lobby.js';
import { markPendingAutoUpdateNotice } from '../ui/whats-new-modal.js';
import { forceCacheBustReload } from '../core/version-updater.js';
import { t } from '../core/i18n.js';
import { getLocalPetPose, updateRemotePets } from '../entities/pets.js';

let lastRequestAt = -Infinity;
let alone = false;
let remoteMoving = false;

export function getMultiplayerPollDelay({ hidden, alone, moving, pending, failures }) {
  if (failures > 0) return Math.max(hidden ? SYNC_BACKGROUND_INTERVAL_MS : 0, Math.min(4000, 500 * 2 ** Math.min(3, failures - 1)));
  if (pending) return SYNC_INTERVAL_MS;
  if (hidden) return SYNC_BACKGROUND_INTERVAL_MS;
  if (alone) return 850;
  return moving ? SYNC_INTERVAL_MS : 500;
}

export function stopMultiplayerPolling() {
  if (appState.syncTimer !== null) clearInterval(appState.syncTimer);
  appState.syncTimer = null;
}

export function startMultiplayerPolling({ reset = false } = {}) {
  stopMultiplayerPolling();
  if (reset) {
    lastRequestAt = -Infinity;
    alone = false;
    remoteMoving = false;
  }
  appState.syncTimer = setInterval(() => {
    if (!appState.currentUser || appState.syncInFlight) return;
    const pending = appState.isInitialSync || !!appState.pendingChatMsg || !!window.hasCampusPendingSync?.();
    const delay = getMultiplayerPollDelay({
      pending,
      alone,
      moving: remoteMoving || !!window.isCampusSyncMoving?.(),
      hidden: !!document.hidden,
      failures: appState.syncFailures
    });
    if (performance.now() - lastRequestAt >= delay - 8) events.emit('sync:now');
  }, 125);
}

function applySyncSnapshot(data, players, sentHolding, firstSync) {
  const online = $('hud-online');
  const onlineCount = String(data.online_count || 1);
  if (online && online.textContent !== onlineCount) online.textContent = onlineCount;
  if (typeof data.server_ts === 'number' && window.setCampusServerTime) {
    window.setCampusServerTime(data.server_ts);
  }
  if (!data.layout_unchanged && data.layout_edits) {
    if (!window.applyCampusLayoutEdits) throw new Error('Layout do campus ainda não está pronto.');
    window.applyCampusLayoutEdits(data.layout_edits);
  }
  if (!data.objects_unchanged && data.objects) {
    if (!window.applyCampusWorldObjects) throw new Error('Objetos do campus ainda não estão prontos.');
    window.applyCampusWorldObjects(data.objects);
  }
  if (!data.item_states_unchanged && data.item_states && window.applyCampusItemStates) {
    window.applyCampusItemStates(
      data.item_states,
      firstSync ? data.item_state_ages : null
    );
  }
  if (firstSync && window.markCampusInitialItemStatesApplied) {
    window.markCampusInitialItemStatesApplied();
  }
  if (!data.state_unchanged && data.world_state && window.applyCampusWorldState) {
    if (typeof data.server_ts === 'number') data.world_state._serverTs = data.server_ts;
    window.applyCampusWorldState(data.world_state, firstSync);
  }
  if (!data.upgrades_unchanged && Array.isArray(data.village_upgrades)) {
    applyVillageUpgrades(data.village_upgrades);
  }
  window.applyCampusInventory?.(data.inventory, players, sentHolding, firstSync);
  if (firstSync && data.saved_pose && window.applyCampusSavedPose) {
    window.applyCampusSavedPose(data.saved_pose);
  }
  if (firstSync && !data.force_teleport) applyCampusMeetupInvite();
  window.updateCampusPlayers?.(players);
  window.applyCampusCars?.(data.cars, data.car_seat);
  window.applyCampusRemoteShots?.(players);
  window.applyCampusUfo?.(data.ufo);
  updateRemotePets(players);
  if (data.board_strokes && data.board_strokes.length && window.applyCampusBoardStrokes) {
    window.applyCampusBoardStrokes(data.board_strokes);
  }
  if (data.world_state && typeof data.world_state.auditorium_slide === 'number') {
    if (data.world_state.auditorium_slide !== appState.currentSlideIdx ||
      (data.world_state.auditorium_presenter || '') !== appState.currentPresenter) {
      applySlideTo3D(data.world_state.auditorium_slide, data.world_state.auditorium_presenter || '');
    }
  }
  // Só confirma versões depois que os dados foram aplicados; uma falha na
  // criação de um objeto precisa poder receber novamente layout e posição.
  if (typeof data.obj_ver === 'string') appState.lastObjVer = data.obj_ver;
  if (typeof data.item_state_ver === 'string') appState.lastItemStateVer = data.item_state_ver;
  if (typeof data.state_ver === 'string') appState.lastStateVer = data.state_ver;
  if (typeof data.layout_ver === 'string') appState.lastLayoutVer = data.layout_ver;
  if (typeof data.upgrades_ver === 'string') appState.lastUpgradesVer = data.upgrades_ver;
  if (typeof data.board_last_id === 'number' && data.board_last_id > appState.boardLastId) appState.boardLastId = data.board_last_id;
}

export async function syncMultiplayer(forceHeldState = false) {
  const userId = appState.currentUser?.id;
  if (userId == null || typeof window.getCampusPlayerPose !== 'function') return false;
  if (appState.syncInFlight) {
    appState.syncQueued = true;
    return false;
  }
  appState.syncInFlight = true;
  lastRequestAt = performance.now();
  appState.syncQueued = false;
  const sessionId = appState.sessionId;
  const isCurrent = () => appState.currentUser?.id === userId && appState.sessionId === sessionId;

  const firstSync = appState.isInitialSync;
  appState.isInitialSync = false;

  let moved = [];
  let strokes = [];
  let stateChanges = {};
  const chatToSend = appState.pendingChatMsg;
  appState.pendingChatMsg = '';

  try {
    const pose = window.getCampusPlayerPose() || {};
    moved = firstSync ? [] : (window.consumeCampusMovedItems ? window.consumeCampusMovedItems() : []);
    strokes = window.consumeCampusBoardStrokes ? window.consumeCampusBoardStrokes() : [];
    stateChanges = window.consumeCampusStateChanges ? window.consumeCampusStateChanges() : {};
    if (firstSync) {
      appState.lastObjVer = '';
      appState.lastItemStateVer = '';
      appState.lastStateVer = '';
      appState.lastLayoutVer = '';
      appState.lastUpgradesVer = '';
    }
    const data = await apiPost('api/multiplayer.php?action=sync', {
      session_id: sessionId,
      init_sync: firstSync ? 1 : 0,
      save_pose: !firstSync && forceHeldState === true,
      x: pose.x,
      y: pose.y,
      z: pose.z,
      vx: pose.vx || 0,
      vz: pose.vz || 0,
      yaw: pose.yaw,
      pitch: pose.pitch,
      holding_item: pose.holding_item,
      inventory_enabled: true,
      inventory_hand: firstSync ? null : window.getCampusInventoryHandState?.(forceHeldState === true),
      inventory_op: firstSync ? null : window.getCampusInventoryOperation?.(),
      walking: pose.walking,
      seated: pose.seated,
      in_fps: pose.in_fps,
      toy_mode: pose.toy_mode || '',
      pet_pose: getLocalPetPose(),
      current_hat: pose.current_hat || 'default',
      emote: pose.emote || '',
      shots: window.getCampusRecentShots?.(),
      car: window.getCampusCarSync?.(),
      chat_msg: chatToSend,
      moved_items: moved,
      state_changes: stateChanges,
      obj_ver: appState.lastObjVer,
      item_state_ver: appState.lastItemStateVer,
      state_ver: appState.lastStateVer,
      layout_ver: appState.lastLayoutVer || '',
      upgrades_ver: appState.lastUpgradesVer || '',
      board_since: appState.boardLastId,
      board_strokes: strokes
    }, true, { timeoutMs: 6000 });

    if (!isCurrent()) return false;

    if (data && data.kicked) {
      stopMultiplayerPolling();
      appState.currentUser = null;
      appState.authToken = null;
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      alert(data.error || 'Sua conta foi conectada em outro dispositivo ou navegador. Atualize a página para jogar aqui.');
      return false;
    }

    if (data.ok) {
      const players = data.players || [];
      alone = players.length === 0 && (data.online_count || 1) <= 1;
      remoteMoving = !!data.ufo?.active || players.some(player => player.walking || player.vx || player.vz || player.ak47_equipped);
      appState.villageLease = data.village_lease || null;
      appState.villageEditLot = data.village_edit_lot || null;
      setVillageTraffic(data.village_traffic);
      if (data.force_teleport && window.teleportCampusPlayer) {
        window.teleportCampusPlayer(
          data.force_teleport.x,
          data.force_teleport.y,
          data.force_teleport.z,
          data.force_teleport.yaw
        );
        showFloatingToast('🧲 ' + t('misc.mp.teleported'));
      }

      if (data.app_version && window.MYCO_VERSION && data.app_version !== window.MYCO_VERSION && !window._reloadingVersion) {
        const reloaded = await forceCacheBustReload(data.app_version, {
          currentVer: window.MYCO_VERSION,
          delayMs: 1200,
          onBeforeReload: (nextVer) => {
            markPendingAutoUpdateNotice(nextVer);
            showFloatingToast('🔄 ' + t('misc.mp.newVersion', {ver:nextVer}));
          }
        });
        if (reloaded || !isCurrent()) return false;
        // Se já recarregou nesta sessão dentro do cooldown, apenas alinha indicador local sem loop
        window.MYCO_VERSION = data.app_version;
        const verEl = $('app-version');
        if (verEl) verEl.textContent = 'v' + data.app_version;
      }

      applySyncSnapshot(data, players, pose.holding_item, firstSync);
      if (appState.syncFailures >= 3 && !globalThis.document?.hidden) {
        showFloatingToast('✅ ' + t('misc.mp.restored'), 3000);
      }
      appState.syncFailures = 0;
      return true;
    } else if (data.auth !== false) {
      throw new Error(data.error || 'sync');
    }
  } catch (e) {
    if (!isCurrent()) return false;
    appState.syncFailures++;
    if (appState.syncFailures === 3 && !globalThis.document?.hidden) {
      showFloatingToast('⚠️ ' + t('misc.mp.unstable'), 4500);
    }
    if (firstSync) appState.isInitialSync = true;
    if (chatToSend && !appState.pendingChatMsg) appState.pendingChatMsg = chatToSend;
    if (moved && moved.length && window.requeueCampusMovedItems) window.requeueCampusMovedItems(moved);
    if (strokes && strokes.length && window.requeueCampusBoardStrokes) window.requeueCampusBoardStrokes(strokes);
    if (stateChanges && window.requeueCampusStateChanges) window.requeueCampusStateChanges(stateChanges);
  } finally {
    appState.syncInFlight = false;
    if (appState.syncQueued && isCurrent() && appState.syncFailures === 0) {
      syncMultiplayer();
    }
  }
  return false;
}

export async function flushInventoryBeforeLogout() {
  // Hydration and an unsent pickup can each require a sync before a queued swap.
  const sessionId = appState.sessionId;
  for (let attempt = 0; attempt < 4; attempt++) {
    while (appState.syncInFlight) await new Promise(resolve => setTimeout(resolve, 25));
    if (!appState.currentUser || appState.sessionId !== sessionId) return false;
    const initial = appState.isInitialSync;
    if (!await syncMultiplayer(true)) return false;
    if (!initial && !window.hasCampusPendingSync?.()) return true;
  }
  return false;
}

export function sendLeaveBeacon() {
  if (appState.currentUser && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    // Let an already dispatched request finish; never send an older hand snapshot over a swap.
    if (appState.syncInFlight || appState.isInitialSync) return;
    const pose = window.getCampusPlayerPose?.();
    if (pose?.in_fps) {
      const moved = window.consumeCampusMovedItems ? window.consumeCampusMovedItems() : [];
      const stateChanges = window.consumeCampusStateChanges ? window.consumeCampusStateChanges() : {};
      const strokes = window.consumeCampusBoardStrokes ? window.consumeCampusBoardStrokes() : [];
      const syncPayload = {
        ...pose,
        leaving: true,
        inventory_enabled: true,
        inventory_op: window.getCampusInventoryOperation?.(),
        inventory_hand: window.getCampusInventoryHandState?.(true),
        session_id: appState.sessionId,
        user_id: appState.currentUser.id,
        moved_items: moved,
        state_changes: stateChanges,
        board_strokes: strokes
      };
      if (appState.authToken) syncPayload.token = appState.authToken;
      if (!navigator.sendBeacon('api/multiplayer.php?action=sync', JSON.stringify(syncPayload))) {
        window.requeueCampusMovedItems?.(moved);
        window.requeueCampusStateChanges?.(stateChanges);
        window.requeueCampusBoardStrokes?.(strokes);
      }
    } else {
      const body = { session_id: appState.sessionId, user_id: appState.currentUser.id };
      if (appState.authToken) body.token = appState.authToken;
      navigator.sendBeacon('api/multiplayer.php?action=leave', JSON.stringify(body));
    }
  }
}

events.on('sync:now', syncMultiplayer);
