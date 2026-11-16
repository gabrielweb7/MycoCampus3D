/**
 * MycoCampus3D — Sincronização Multiplayer em Tempo Real (Delta Sync)
 */
import { appState } from '../core/state.js';
import { events } from '../core/events.js';
import { apiPost } from '../services/api-client.js';
import { $, showFloatingToast } from '../ui/dom-helpers.js';
import { applySlideTo3D } from '../ui/hud-lobby.js';

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
  const moved = window.consumeCampusMovedItems();
  const strokes = window.consumeCampusBoardStrokes ? window.consumeCampusBoardStrokes() : [];
  const stateChanges = window.consumeCampusStateChanges ? window.consumeCampusStateChanges() : {};
  const chatToSend = appState.pendingChatMsg;
  appState.pendingChatMsg = '';

  try {
    if (firstSync) {
      appState.lastObjVer = '';
      appState.lastStateVer = '';
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
      state_ver: appState.lastStateVer,
      board_since: appState.boardLastId,
      board_strokes: strokes
    }, true);

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
        let lastReloadInfo = '';
        try { lastReloadInfo = sessionStorage.getItem('myco_reload_guard') || ''; } catch (e) {}
        const parts = lastReloadInfo.split('|');
        const guardedVer = parts[0];
        const guardedAt = Number(parts[1] || 0);
        if (guardedVer !== data.app_version || (Date.now() - guardedAt) > 30000) {
          window._reloadingVersion = true;
          try { sessionStorage.setItem('myco_reload_guard', `${data.app_version}|${Date.now()}`); } catch (e) {}
          showFloatingToast(`🔄 Nova versão v${data.app_version} disponível! Atualizando...`);
          setTimeout(() => {
            const base = window.location.pathname || '/';
            window.location.replace(`${base}?_v=${encodeURIComponent(data.app_version)}`);
          }, 1500);
          return;
        }
      }

      if ($('hud-online')) $('hud-online').textContent = String(data.online_count || 1);
      if (typeof data.obj_ver === 'string') appState.lastObjVer = data.obj_ver;
      if (typeof data.state_ver === 'string') appState.lastStateVer = data.state_ver;
      if (!data.objects_unchanged && data.objects && window.applyCampusWorldObjects) {
        window.applyCampusWorldObjects(data.objects);
      }
      if (!data.state_unchanged && data.world_state && window.applyCampusWorldState) {
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
    if (appState.syncQueued) {
      syncMultiplayer();
    }
  }
}

export function sendLeaveBeacon() {
  if (appState.currentUser && navigator.sendBeacon) {
    const body = { session_id: appState.sessionId, user_id: appState.currentUser.id };
    if (appState.authToken) body.token = appState.authToken;
    navigator.sendBeacon('api/multiplayer.php?action=leave', JSON.stringify(body));
  }
}

events.on('sync:now', syncMultiplayer);
