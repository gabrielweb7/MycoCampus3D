/**
 * API Publica Global do Motor 3D (window.* e window.MycoCampus)
 * Mantem compatibilidade com UI, controles mobile, multiplayer e console.
 */

import { GAME_CONFIG } from '../core/config.js';
import { getInitialQualityTier, qualityState } from '../core/quality.js';
import { getGroundHeight, clampPosAgainstWalls } from '../engine/physics.js';
import { updateCampusAuditoriumSlide, setRankingList } from '../world/staircase-clock.js';
import { triggerConfettiBurst } from '../entities/confetti.js';
import { buildAvatarHat, updateCampusPlayers } from '../entities/avatars.js';
import { getLabItemGuide } from '../items/item-registry.js';
import { setHeldTwoHandedGhost } from './interaction-system.js';
import { applyQualityTier } from './game-loop.js';
import * as worldSync from './world-sync.js';
import * as adminEditor from './admin-editor.js';
import { openRadialMenu, closeRadialMenu, isRadialMenuOpen, triggerFloatingAction, inspectItemToast } from '../ui/radial-menu.js';

const qualityTiersOrder = ['high', 'medium', 'low', 'min'];

export function registerCampusPublicApi(sim, initCampus3D, triggerCampusRainbow) {
  window.initCampus3D = initCampus3D;

  window.setCampusFpsMode = function (enable) {
    sim.lobbyTourActive = false;
    sim.inFps = !!enable;
    sim.controls.enabled = !sim.inFps;
    if (!sim.inFps && document.pointerLockElement) document.exitPointerLock();
    if (sim.inFps) {
      sim.camera.up.set(0, 1, 0);
      sim.camera.rotation.order = 'YXZ';
      sim.camera.rotation.z = 0;
      sim.playerPos.y = getGroundHeight(sim.physCtx, sim.playerPos.x, sim.playerPos.z, sim.playerPos.y);
    } else if (sim.fpsArmGroup) {
      sim.fpsArmGroup.visible = false;
    }
    if (sim.callbacks.onFpsChange) sim.callbacks.onFpsChange(sim.inFps);
  };

  window.triggerCampusJump = function () {
    if (!sim.inFps) return;
    if (sim.seatedSeat) {
      sim.seatedSeat = null;
      sim.playerVelY = GAME_CONFIG.player.jumpVelocity;
      sim.onGround = false;
      return;
    }
    const now = performance.now();
    sim.jumpBufferUntil = now + GAME_CONFIG.player.jumpBufferMs;
    if (sim.onGround || (now - sim.lastGroundedAt < GAME_CONFIG.player.coyoteTimeMs && sim.playerVelY <= 0)) {
      sim.playerVelY = GAME_CONFIG.player.jumpVelocity;
      sim.onGround = false;
      sim.lastGroundedAt = 0;
      sim.jumpBufferUntil = 0;
    }
  };

  window.setCampusJumpHeld = function (held) {
    sim.jumpHeld = !!held;
    if (sim.jumpHeld) window.triggerCampusJump();
  };

  window.setCampusSprint = function (active) {
    sim.mobileSprint = !!active;
  };

  window.clearCampusKeys = function () {
    Object.keys(sim.keys).forEach(function (k) { sim.keys[k] = false; });
    sim.isPrimaryDown = false;
    sim.jumpHeld = false;
    sim.flushCurrentStroke();
  };

  window.rotateCampusHeldItem = function (deltaRad) {
    if (sim.heldItem) sim.heldRotY += (typeof deltaRad === 'number' ? deltaRad : Math.PI / 4);
  };

  window.setCampusJoystick = function (dx, dy) {
    sim.joyX = dx;
    sim.joyY = dy;
  };

  window.getCampusPlayerPose = function () {
    const gY = getGroundHeight(sim.physCtx, sim.playerPos.x, sim.playerPos.z, sim.playerPos.y);
    const inAir = sim.playerPos.y > gY + 0.18;
    return {
      x: sim.playerPos.x, y: sim.playerPos.y, z: sim.playerPos.z,
      vx: Math.round(sim.playerVelX * 100) / 100,
      vz: Math.round(sim.playerVelZ * 100) / 100,
      yaw: sim.playerYaw, pitch: sim.playerPitch,
      holding_item: sim.heldItem ? sim.heldItem.id : '',
      walking: sim.isWalking, seated: !!sim.seatedSeat, in_fps: sim.inFps,
      toy_mode: (sim.paragliderActive && inAir) ? 'paraglider' : (sim.snowboardActive ? 'snowboard' : ''),
      current_hat: sim.localHat,
      emote: sim.localEmote
    };
  };

  window.setCampusQualityMode = function (mode) {
    if (mode === 'auto' || qualityTiersOrder.indexOf(mode) !== -1) {
      sim.qualityMode = mode;
      if (mode === 'auto') {
        applyQualityTier(sim, getInitialQualityTier(sim.isTouchDevice()));
      } else {
        applyQualityTier(sim, mode);
      }
    }
  };

  window.getCampusQualityState = function () {
    return { mode: sim.qualityMode, tier: sim.qualityTier, fps: qualityState.currentFps };
  };

  window.playCampusEmote = function (name) {
    sim.localEmote = name || '';
    sim.localEmoteTimer = 4.5;
    if (window.MycoAudio) window.MycoAudio.playEmote(name);
    if (name === 'cheer') {
      triggerConfettiBurst(sim.playerPos.x, sim.playerPos.y, sim.playerPos.z);
    }
  };

  window.setCampusSnowboard = function (active) {
    sim.snowboardActive = !!active;
    if (!sim.snowboardActive && sim.snowboardGroup) sim.snowboardGroup.visible = false;
  };

  window.isCampusSnowboardActive = function () { return sim.snowboardActive; };

  window.setCampusParaglider = function (active) {
    sim.paragliderActive = !!active;
    if (!sim.paragliderActive && sim.paragliderGroup) sim.paragliderGroup.visible = false;
  };

  window.isCampusParagliderActive = function () { return sim.paragliderActive; };

  window.setLocalAvatarHat = function (hatId) {
    sim.localHat = hatId || 'default';
    if (sim.localAvatar && sim.localAvatar.hatGroup) {
      buildAvatarHat(sim.localHat, sim.localAvatar.hatMat, sim.localAvatar.hatGroup);
      sim.localAvatar.current_hat = sim.localHat;
    }
  };

  window.markCampusInitialItemStatesApplied = function () { return worldSync.markCampusInitialItemStatesApplied(sim); };
  window.consumeCampusMovedItems = function () { return worldSync.consumeCampusMovedItems(sim); };
  window.requeueCampusMovedItems = function (list) { return worldSync.requeueCampusMovedItems(sim, list); };
  window.applyCampusWorldObjects = function (objectsMap) { return worldSync.applyCampusWorldObjects(sim, objectsMap); };
  window.applyCampusItemStates = function (itemStates) { return worldSync.applyCampusItemStates(sim, itemStates); };
  window.resetCampusWorldObjects = function () { return worldSync.resetCampusWorldObjects(sim); };
  window.consumeCampusBoardStrokes = function () { return worldSync.consumeCampusBoardStrokes(sim); };
  window.requeueCampusBoardStrokes = function (strokes) { return worldSync.requeueCampusBoardStrokes(sim, strokes); };
  window.applyCampusBoardStrokes = function (strokes) { return worldSync.applyCampusBoardStrokes(sim, strokes); };
  window.consumeCampusStateChanges = function () { return worldSync.consumeCampusStateChanges(sim); };
  window.requeueCampusStateChanges = function (changes) { return worldSync.requeueCampusStateChanges(sim, changes); };
  window.applyCampusWorldState = function (stateMap, isInitial) { return worldSync.applyCampusWorldState(sim, stateMap, isInitial); };
  window.applyCampusSavedPose = function (pose) { return worldSync.applyCampusSavedPose(sim, pose); };
  window.setCampusServerTime = function (ts) {
    sim.serverTimeSec = ts;
    sim.serverTimeSyncAt = performance.now();
  };
  window.applyCampusLayoutEdits = function (edits) { return adminEditor.applyCampusLayoutEdits(sim, edits); };
  window.getCampusAdminEditor = function () {
    return {
      isEditMode: () => !!sim.adminEditMode,
      setEditMode: (active) => adminEditor.setAdminEditMode(sim, active),
      getPrefabs: () => adminEditor.getAdminPrefabOptions(),
      getTargetItem: () => sim.heldItem || sim.hoveredPickable || null,
      addPrefab: (prefabId) => adminEditor.adminAddPrefabAtPlayer(sim, prefabId),
      removeItem: (item) => adminEditor.adminRemoveTargetItem(sim, item),
      editItem: (item, opts) => adminEditor.adminEditTargetItem(sim, item, opts),
      moveGroup: (item, dx, dy, dz, dRy) => adminEditor.adminMoveTargetWithSupported(sim, item, dx, dy, dz, dRy),
      saveWorldDefault: () => adminEditor.adminSaveWorldDefault(sim)
    };
  };

  window.resetCampusLocalSession = function () {
    sim.syringePumping = null;
    sim.sinkFilling = null;
    sim.pourHold = null;
    sim.syringePunctureProgress = 0;
    sim.cancelHeldItemPlacement();
    setHeldTwoHandedGhost(sim.heldItem, false);
    sim.heldItem = null;
    sim.thermoLaserOn = false;
    sim.seatedSeat = null;
    sim.pendingMovedItems = {};
    sim.pendingBoardStrokes = [];
    sim.pendingStateChanges = {};
    sim.recentlyDropped = {};
    if (sim.placementGhost) sim.placementGhost.visible = false;
    if (sim.thermoLaserLine) sim.thermoLaserLine.visible = false;
    if (sim.thermoLaserDot) sim.thermoLaserDot.visible = false;
    sim.playerVelX = 0;
    sim.playerVelY = 0;
    sim.playerVelZ = 0;
    sim.playerPos.set(0, 0, 10.5);
    sim.playerYaw = 0;
    sim.playerPitch = 0;
    if (window.clearCampusKeys) window.clearCampusKeys();
    if (window.MycoAudio) window.MycoAudio.setSteam(false, 0);
    if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
  };

  window.setCampusPlayerColors = function (hatHex, bodyHex) {
    if (sim.fpsSleeveMat && bodyHex) sim.fpsSleeveMat.color.set(bodyHex);
    if (sim.localAvatar) {
      if (hatHex && sim.localAvatar.hatMat) sim.localAvatar.hatMat.color.set(hatHex);
      if (bodyHex && sim.localAvatar.bodyMat) sim.localAvatar.bodyMat.color.set(bodyHex);
    }
  };

  window.rotateCampusCamera = function (dx, dy) {
    if (sim.lobbyTourActive) return;
    if (sim.inFps) {
      sim.playerYaw -= dx * 0.0080;
      sim.playerPitch = Math.max(-1.35, Math.min(1.35, sim.playerPitch - dy * 0.0080));
    }
  };

  window.setCampusMobilePrimary = function (down) {
    if (sim.lobbyTourActive) return;
    sim.isPrimaryDown = !!down;
    if (down) {
      sim.pointerNdc.set(0, 0);
      sim.updateHoverRay();
      sim.handlePrimaryAction();
    } else {
      sim.flushCurrentStroke();
    }
  };

  window.updateCampusRanking = function (list) { setRankingList(list); };
  window.setCampusCinemaLessons = function (list) {
    sim.cinemaLessons = Array.isArray(list) ? list : [];
    sim.cinemaDirty = true;
  };

  window.teleportCampusPlayer = function (x, y, z, yaw) {
    if (typeof x !== 'number' || typeof z !== 'number') return;
    if (sim.seatedSeat) sim.seatedSeat = null;
    sim.syringePumping = null;
    sim.playerVelY = 0;
    const targetY = (typeof y === 'number' && !isNaN(y)) ? y : getGroundHeight(sim.physCtx, x, z, sim.playerPos.y);
    sim.playerPos.set(x, targetY, z);
    if (typeof yaw === 'number' && !isNaN(yaw)) {
      sim.playerYaw = yaw;
      if (sim.controls && sim.controls.target) sim.controls.target.set(x, targetY + 1.2, z);
    }
    clampPosAgainstWalls(sim.physCtx, sim.playerPos, 0.35);
    if (window.MycoAudio) window.MycoAudio.playSwitch();
  };

  window.getCampusPlayerPos = function () {
    return { x: sim.playerPos.x, y: sim.playerPos.y, z: sim.playerPos.z, yaw: sim.playerYaw };
  };

  window.updateCampusPlayers = function (players) {
    return updateCampusPlayers({
      scene: sim.scene,
      remoteAvatars: sim.remoteAvatars,
      heldItem: sim.heldItem,
      onDropStolenHeld: function () {
        sim.cancelHeldItemPlacement();
        setHeldTwoHandedGhost(sim.heldItem, false);
        sim.heldItem = null;
        if (sim.placementGhost) sim.placementGhost.visible = false;
        if (sim.callbacks.onHoldChange) sim.callbacks.onHoldChange(null);
      }
    }, players);
  };

  window.updateCampusAuditoriumSlide = updateCampusAuditoriumSlide;
  window.triggerCampusRainbow = triggerCampusRainbow;
  window.dropCampusHeldItem = sim.dropHeldItem;
  window.toggleCampusHeldPlacement = sim.toggleHeldItemPlacement;
  window.inspectCampusHeldItem = function () {
    if (sim.heldItem) inspectItemToast(sim, sim.heldItem);
    else if (sim.hoveredPickable) inspectItemToast(sim, sim.hoveredPickable);
  };
  window.openCampusRadialMenu = function () { openRadialMenu(sim); };
  window.closeCampusRadialMenu = closeRadialMenu;
  window.isCampusRadialMenuOpen = isRadialMenuOpen;
  window.triggerCampusFloatingAction = triggerFloatingAction;

  window.MycoCampus = window.MycoCampus || {};
  window.MycoCampus.teleportPlayer = window.teleportCampusPlayer;
  window.MycoCampus.getPlayerPos = window.getCampusPlayerPos;
  window.MycoCampus.updateRanking = window.updateCampusRanking;
  window.MycoCampus.updateSlide = updateCampusAuditoriumSlide;
  window.MycoCampus.updatePlayers = window.updateCampusPlayers;
  window.MycoCampus.getLabItemGuide = function () { return getLabItemGuide(sim.pickableItems); };
  window.MycoCampus.setColors = window.setCampusPlayerColors;
  window.MycoCampus.setFpsMode = window.setCampusFpsMode;
  window.MycoCampus.triggerRainbow = triggerCampusRainbow;
  window.MycoCampus.dropHeldItem = sim.dropHeldItem;
  window.MycoCampus.toggleHeldItemPlacement = sim.toggleHeldItemPlacement;
  window.MycoCampus.inspectHeldItem = window.inspectCampusHeldItem;
}
