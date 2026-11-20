/**
 * MycoCampus3D — Sincronização Multiplayer em Tempo Real (Delta Sync)
 */
import { appState } from '../core/state.js';
import { events } from '../core/events.js';
import { apiPost } from '../services/api-client.js';
import { $, showFloatingToast } from '../ui/dom-helpers.js';
import { applySlideTo3D } from '../ui/hud-lobby.js';
import { markPendingAutoUpdateNotice } from '../ui/whats-new-modal.js';
import { forceCacheBustReload } from '../core/version-updater.js';

export async function syncMultiplayer() {
  if (!appState.currentUser) return;
  if (appState.syncInFlight) {
    appState.syncQueued = true;
    return;
  }
  appState.syncInFlight = true;
  appState.syncQueued = false;

  const firstSync = appState.isInitialSync;
  appState.isInitialSync = false;

  const pose = window.getCampusPlayerPose();
  const moved = firstSync ? [] : window.consumeCampusMovedItems();
  const strokes = window.consumeCampusBoardStrokes ? window.consumeCampusBoardStrokes() : [];
  const stateChanges = window.consumeCampusStateChanges ? window.consumeCampusStateChanges() : {};
  const chatToSend = appState.pendingChatMsg;
  appState.pendingChatMsg = '';

  try {
    if (firstSync) {
      appState.lastObjVer = '';
      appState.lastItemStateVer = '';
      appState.lastStateVer = '';
      appState.lastLayoutVer = '';
    }
    const data = await apiPost('api/multiplayer.php?action=sync', {
      session_id: appState.sessionId,
      init_sync: firstSync ? 1 : 0,
      x: pose.x,
      y: pose.y,
      z: pose.z,
      vx: pose.vx || 0,
      vz: pose.vz || 0,
      yaw: pose.yaw,
      pitch: pose.pitch,
      holding_item: pose.holding_item,
      walking: pose.walking,
      seated: pose.seated,
      in_fps: pose.in_fps,
      toy_mode: pose.toy_mode || '',
      current_hat: pose.current_hat || 'default',
      emote: pose.emote || '',
      chat_msg: chatToSend,
      moved_items: moved,
      state_changes: stateChanges,
      obj_ver: appState.lastObjVer,
      item_state_ver: appState.lastItemStateVer,
      state_ver: appState.lastStateVer,
      layout_ver: appState.lastLayoutVer || '',
      board_since: appState.boardLastId,
      board_strokes: strokes
    }, true, { timeoutMs: 6000 });

    if (data && data.kicked) {
      if (appState.syncTimer) clearInterval(appState.syncTimer);
      appState.syncTimer = null;
      alert(data.error || 'Você foi desconectado pelo Administrador.');
      window.location.reload();
      return;
    }

    if (data.ok) {
      appState.syncFailures = 0;
      if (data.force_teleport && window.teleportCampusPlayer) {
        window.teleportCampusPlayer(
          data.force_teleport.x,
          data.force_teleport.y,
          data.force_teleport.z,
          data.force_teleport.yaw
        );
        showFloatingToast('🧲 Você foi teletransportado pelo Administrador Master!');
      }

      if (data.app_version && window.MYCO_VERSION && data.app_version !== window.MYCO_VERSION && !window._reloadingVersion) {
        const reloaded = await forceCacheBustReload(data.app_version, {
          currentVer: window.MYCO_VERSION,
          delayMs: 1200,
          onBeforeReload: (nextVer) => {
            markPendingAutoUpdateNotice(nextVer);
            showFloatingToast(`🔄 Nova versão v${nextVer} disponível! Limpando cache e atualizando...`);
          }
        });
        if (reloaded) return;
        // Se já recarregou nesta sessão dentro do cooldown, apenas alinha indicador local sem loop
        window.MYCO_VERSION = data.app_version;
        const verEl = $('app-version');
        if (verEl) verEl.textContent = 'v' + data.app_version;
      }

      if ($('hud-online')) $('hud-online').textContent = String(data.online_count || 1);
      if (typeof data.server_ts === 'number' && window.setCampusServerTime) {
        window.setCampusServerTime(data.server_ts);
      }
      if (typeof data.obj_ver === 'string') appState.lastObjVer = data.obj_ver;
      if (typeof data.item_state_ver === 'string') appState.lastItemStateVer = data.item_state_ver;
      if (typeof data.state_ver === 'string') appState.lastStateVer = data.state_ver;
      if (typeof data.layout_ver === 'string') appState.lastLayoutVer = data.layout_ver;
      if (!data.layout_unchanged && data.layout_edits && window.applyCampusLayoutEdits) {
        window.applyCampusLayoutEdits(data.layout_edits);
      }
      if (!data.objects_unchanged && data.objects && window.applyCampusWorldObjects) {
        window.applyCampusWorldObjects(data.objects);
      }
      if (!data.item_states_unchanged && data.item_states && window.applyCampusItemStates) {
        window.applyCampusItemStates(
          data.item_states,
          (firstSync && (data.online_count || 1) === 1) ? data.item_state_ages : null
        );
      }
      if (firstSync && window.markCampusInitialItemStatesApplied) {
        window.markCampusInitialItemStatesApplied();
      }
      if (!data.state_unchanged && data.world_state && window.applyCampusWorldState) {
        if (typeof data.server_ts === 'number') data.world_state._serverTs = data.server_ts;
        window.applyCampusWorldState(data.world_state, firstSync);
      }
      if (firstSync && data.saved_pose && window.applyCampusSavedPose) {
        window.applyCampusSavedPose(data.saved_pose);
      }
      if (window.updateCampusPlayers) window.updateCampusPlayers(data.players || []);
      if (typeof data.board_last_id === 'number' && data.board_last_id > appState.boardLastId) {
        appState.boardLastId = data.board_last_id;
      }
      if (data.board_strokes && data.board_strokes.length && window.applyCampusBoardStrokes) {
        window.applyCampusBoardStrokes(data.board_strokes);
      }
      if (data.world_state && typeof data.world_state.auditorium_slide === 'number') {
        if (data.world_state.auditorium_slide !== appState.currentSlideIdx ||
          (data.world_state.auditorium_presenter || '') !== appState.currentPresenter) {
          applySlideTo3D(data.world_state.auditorium_slide, data.world_state.auditorium_presenter || '');
        }
      }
    } else if (data.auth !== false) {
      throw new Error(data.error || 'sync');
    }
  } catch (e) {
    appState.syncFailures++;
    if (firstSync) appState.isInitialSync = true;
    if (chatToSend && !appState.pendingChatMsg) appState.pendingChatMsg = chatToSend;
    if (moved && moved.length && window.requeueCampusMovedItems) window.requeueCampusMovedItems(moved);
    if (strokes && strokes.length && window.requeueCampusBoardStrokes) window.requeueCampusBoardStrokes(strokes);
    if (stateChanges && window.requeueCampusStateChanges) window.requeueCampusStateChanges(stateChanges);
  } finally {
    appState.syncInFlight = false;
    if (appState.syncQueued && appState.syncFailures === 0) {
      syncMultiplayer();
    }
  }
}

export function sendLeaveBeacon() {
  if (appState.currentUser && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const moved = window.consumeCampusMovedItems ? window.consumeCampusMovedItems() : [];
    const stateChanges = window.consumeCampusStateChanges ? window.consumeCampusStateChanges() : {};
    if ((moved && moved.length) || (stateChanges && Object.keys(stateChanges).length)) {
      const syncPayload = {
        session_id: appState.sessionId,
        user_id: appState.currentUser.id,
        moved_items: moved,
        state_changes: stateChanges
      };
      if (appState.authToken) syncPayload.token = appState.authToken;
      navigator.sendBeacon('api/multiplayer.php?action=sync', JSON.stringify(syncPayload));
    }
    const body = { session_id: appState.sessionId, user_id: appState.currentUser.id };
    if (appState.authToken) body.token = appState.authToken;
    navigator.sendBeacon('api/multiplayer.php?action=leave', JSON.stringify(body));
  }
}

events.on('sync:now', syncMultiplayer);
