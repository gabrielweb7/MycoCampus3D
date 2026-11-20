/**
 * Controlador de Entradas (Teclado, Mouse, PointerLock, Touch, Resize) - MycoCampus3D
 */

import { getHeldBoardToolColor } from './chalkboard.js';
import { syncViewportCssVars } from '../ui/dom-helpers.js';
import { setTelescopeZoom } from '../world/plaza-telescope.js';
import { isPhotoModeActive, setPhotoMode, togglePhotoMode } from '../ui/photo-mode.js';

export function bindControls(ctx) {
  // Previne fechamento acidental da aba do navegador durante a sessão de jogo
  window.addEventListener('beforeunload', function (e) {
    if (ctx.inFps || (ctx.keys && Object.values(ctx.keys).some(Boolean))) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  window.addEventListener('keydown', function (e) {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

    // Isola comandos do jogo contra atalhos destrutivos do navegador (ex: Ctrl+W fecha aba, Ctrl+S salva, etc.)
    const GAME_KEYS = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'KeyR', 'KeyF', 'KeyG', 'KeyQ',
      'KeyX', 'KeyI', 'KeyC', 'KeyE',
      'Space', 'Tab',
      'Digit1', 'Digit2', 'Digit3', 'Digit4'
    ];
    if (GAME_KEYS.indexOf(e.code) !== -1) {
      if (e.ctrlKey || e.metaKey || e.code === 'Space' || e.code === 'Tab') {
        e.preventDefault();
      }
    }

    ctx.keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (window.triggerCampusJump) window.triggerCampusJump();
    }
    if (e.code === 'KeyX') {
      if (ctx.heldItem) {
        if (ctx.placementMode) {
          ctx.cancelHeldItemPlacement();
        } else {
          ctx.dropHeldItem();
        }
      }
    }
    if (e.code === 'KeyG' || e.code === 'KeyQ') {
      if (ctx.heldItem) {
        ctx.toggleHeldItemPlacement();
      } else if (ctx.hoveredPickable && ctx.pickHoveredItemForMove) {
        ctx.pickHoveredItemForMove();
      }
    }
    if (e.code === 'KeyR' && ctx.heldItem) {
      const step = ctx.adminEditMode ? (Math.PI / 12) : (Math.PI / 4);
      const delta = e.shiftKey ? -step : step;
      if (window.rotateCampusHeldItem) {
        window.rotateCampusHeldItem(delta);
      } else {
        ctx.heldRotY = (ctx.heldRotY || 0) + delta;
      }
    }
    if (e.code === 'KeyI') {
      if (window.inspectCampusHeldItem) {
        e.preventDefault();
        window.inspectCampusHeldItem();
      }
    }
    if (e.code === 'KeyF' && window.openCampusRadialMenu) {
      e.preventDefault();
      window.openCampusRadialMenu();
    }
    if ((e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') && window.triggerCampusFloatingAction) {
      const idx = parseInt(e.code.charAt(5), 10) - 1;
      if (window.triggerCampusFloatingAction(idx)) {
        e.preventDefault();
      }
    }
    if (e.code === 'Escape') {
      const sc = document.getElementById('item-status-card');
      if (sc && !sc.classList.contains('hidden')) {
        sc.classList.add('hidden');
      }
    }
    if (e.code === 'Escape' && window.isCampusRadialMenuOpen && window.isCampusRadialMenuOpen()) {
      e.preventDefault();
      window.closeCampusRadialMenu();
      return;
    }
    if (e.code === 'F9') {
      e.preventDefault();
      togglePhotoMode();
      return;
    }
    if (e.code === 'Escape' && isPhotoModeActive()) {
      e.preventDefault();
      setPhotoMode(false);
      return;
    }
    if (e.code === 'Escape' && ctx.telescopeZoomActive) {
      e.preventDefault();
      setTelescopeZoom(ctx, false);
      return;
    }
    if (e.code === 'Escape' && ctx.placementMode) {
      e.preventDefault();
      ctx.cancelHeldItemPlacement();
    }
    if (e.code === 'KeyB' && window.toggleCampusSnowboard) {
      window.toggleCampusSnowboard();
    }
    if (e.code === 'KeyP' && window.toggleCampusParaglider) {
      window.toggleCampusParaglider();
    }
    if (e.code === 'KeyM' && ctx.cookerPots && ctx.cookerPots.length) {
      let targetCp = null;
      let bestD = 4.5;
      for (let i = 0; i < ctx.cookerPots.length; i++) {
        const cp = ctx.cookerPots[i];
        const d = cp.potItem.mesh.position.distanceTo(ctx.playerPos);
        if (d < bestD) { bestD = d; targetCp = cp; }
      }
      if (targetCp) {
        targetCp.mode = targetCp.mode === 'pasteurize' ? 'sterilize' : 'pasteurize';
        targetCp.lastHudKey = '';
        const cookerKey = targetCp.potItem.id === 'pressure_cooker_sub' ? 'cooker_mode_sub' : 'cooker_mode_lab';
        if (ctx.queueWorldStateChange) ctx.queueWorldStateChange(cookerKey, targetCp.mode === 'pasteurize' ? 1 : 0);
        if (window.MycoAudio) window.MycoAudio.playSwitch();
        if (ctx.callbacks && ctx.callbacks.onToast) {
          ctx.callbacks.onToast(
            targetCp.mode === 'pasteurize'
              ? '🌡️ Modo da Panela: PASTEURIZAR (75–85°C)'
              : '♨️ Modo da Panela: ESTERILIZAR (121°C / 15 PSI)'
          );
        }
      }
    }
  });
  window.addEventListener('keyup', function (e) { ctx.keys[e.code] = false; });
  ctx.renderer.domElement.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  function clearAllInputKeys() {
    Object.keys(ctx.keys).forEach(function (k) { ctx.keys[k] = false; });
    ctx.isPrimaryDown = false;
    ctx.jumpHeld = false;
    ctx.flushCurrentStroke();
  }
  window.addEventListener('blur', clearAllInputKeys);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) clearAllInputKeys();
  });
  let lastPointerLockExitAt = 0;
  function safeRequestPointerLock() {
    if (performance.now() - lastPointerLockExitAt < 1100) return;
    try {
      const res = ctx.renderer.domElement.requestPointerLock();
      if (res && typeof res.catch === 'function') {
        res.catch(function () {});
      }
    } catch (err) {}
  }

  document.addEventListener('pointerlockchange', function () {
    if (document.pointerLockElement !== ctx.renderer.domElement) {
      lastPointerLockExitAt = performance.now();
      clearAllInputKeys();
    }
  });

  ctx.renderer.domElement.addEventListener('mousemove', function (e) {
    if (ctx.inFps && document.pointerLockElement === ctx.renderer.domElement) {
      ctx.playerYaw -= e.movementX * 0.0022;
      ctx.playerPitch = Math.max(-1.35, Math.min(1.35, ctx.playerPitch - e.movementY * 0.0022));
    } else {
      const rect = ctx.renderer.domElement.getBoundingClientRect();
      ctx.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ctx.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
  });

  let lastTouchEndAt = 0;
  let lastTouchActionAt = 0;

  ctx.renderer.domElement.addEventListener('mousedown', function (e) {
    if (ctx.lobbyTourActive) return;
    if ((e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) || (performance.now() - lastTouchEndAt < 700)) {
      return;
    }
    if (e.button === 2 && (ctx.heldItem || (ctx.hoveredPickable && ctx.pickHoveredItemForMove))) {
      e.preventDefault();
      if (ctx.heldItem) {
        ctx.toggleHeldItemPlacement();
      } else {
        ctx.pickHoveredItemForMove();
      }
      return;
    }
    if (e.button !== 0) return;
    if (ctx.inFps && document.pointerLockElement !== ctx.renderer.domElement) {
      safeRequestPointerLock();
      return;
    }
    ctx.isPrimaryDown = true;
    if (ctx.heldItem && ctx.placementMode && ctx.updateHoverRay) {
      ctx.updateHoverRay(ctx.inFps ? null : ctx.pointerNdc);
    }
    ctx.handlePrimaryAction();
  });

  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) {
      ctx.isPrimaryDown = false;
      ctx.flushCurrentStroke();
    }
  });

  ctx.renderer.domElement.addEventListener('wheel', function (e) {
    if (ctx.heldItem) {
      e.preventDefault();
      const step = ctx.adminEditMode ? (Math.PI / 36) : 0.175;
      ctx.heldRotY += e.deltaY > 0 ? step : -step;
    }
  }, { passive: false });

  let touchLookId = null, lastTX = 0, lastTY = 0, touchStartX = 0, touchStartY = 0, touchMoved = false;
  ctx.touchDrawingBoard = false;
  function setNdcFromTouch(t) {
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    ctx.pointerNdc.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    ctx.pointerNdc.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function isUiTouch(el) {
    if (!el || !el.closest) return false;
    return !!(
      el.closest('[id$="-modal"]') ||
      el.closest('#mobile-joystick-zone') ||
      el.closest('#mobile-actions') ||
      el.closest('#held-item-bar') ||
      el.closest('#item-status-card') ||
      el.closest('.touch-btn') ||
      el.closest('button') ||
      el.closest('a') ||
      el.closest('input') ||
      el.closest('select') ||
      el.closest('textarea') ||
      el.closest('form') ||
      el.closest('#hud-top-bar') ||
      el.closest('#hud-secondary-tools') ||
      el.closest('#chat-container') ||
      el.closest('#myco-floating-actions') ||
      el.closest('#shop-modal') ||
      el.closest('#map-modal') ||
      el.closest('#quest-modal') ||
      el.closest('#emote-bar') ||
      el.closest('#lesson-modal') ||
      el.closest('#ranking-modal') ||
      el.closest('#admin-modal') ||
      el.closest('#guide-modal') ||
      el.closest('#mycoteca-modal') ||
      el.closest('#campus-lobby')
    );
  }

  window.addEventListener('touchstart', function (e) {
    if (touchLookId !== null) {
      let stillActive = false;
      for (let k = 0; k < e.touches.length; k++) {
        if (e.touches[k].identifier === touchLookId) { stillActive = true; break; }
      }
      if (!stillActive) touchLookId = null;
    }
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (isUiTouch(t.target)) continue;
      if (touchLookId === null) {
        touchLookId = t.identifier;
        lastTX = t.clientX; lastTY = t.clientY;
        touchStartX = t.clientX; touchStartY = t.clientY;
        touchMoved = false;
      }
    }
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchLookId) {
        const dx = t.clientX - lastTX, dy = t.clientY - lastTY;
        if (Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) > 10) touchMoved = true;
        if (ctx.inFps) {
          ctx.playerYaw -= dx * 0.0080;
          ctx.playerPitch = Math.max(-1.35, Math.min(1.35, ctx.playerPitch - dy * 0.0080));
        }
        lastTX = t.clientX; lastTY = t.clientY;
      }
    }
  }, { passive: true });

  function resetTouchLook(e) {
    lastTouchEndAt = performance.now();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchLookId) {
        if (!touchMoved && !ctx.lobbyTourActive) {
          const nowT = performance.now();
          if (nowT - lastTouchActionAt > 180) {
            lastTouchActionAt = nowT;
            // O toque na tela aciona exatamente onde a mira central está apontando (crosshair em 0, 0)
            ctx.pointerNdc.set(0, 0);
            ctx.updateHoverRay(ctx.pointerNdc);
            ctx.handlePrimaryAction();
          }
        }
        touchLookId = null;
      }
    }
  }
  window.addEventListener('touchend', function (e) {
    resetTouchLook(e);
    if (e.touches.length === 0) touchLookId = null;
  }, { passive: true });
  window.addEventListener('touchcancel', function (e) {
    resetTouchLook(e);
    if (e.touches.length === 0) touchLookId = null;
  }, { passive: true });
  window.addEventListener('blur', function () { touchLookId = null; });

  function syncViewportSize(forceMeta = false) {
    if (ctx.refreshTouchCache) ctx.refreshTouchCache();
    const vp = syncViewportCssVars(Boolean(forceMeta));
    const vw = vp.width;
    const vh = vp.height;
    if (vw > 0 && vh > 0) {
      ctx.camera.aspect = vw / vh;
      ctx.camera.updateProjectionMatrix();
      ctx.renderer.setSize(vw, vh, false);
    }
  }

  window.addEventListener('resize', function () {
    syncViewportSize(false);
  });
  window.addEventListener('orientationchange', function () {
    syncViewportSize(true);
    setTimeout(function () { syncViewportSize(true); }, 80);
    setTimeout(function () { syncViewportSize(false); }, 240);
    setTimeout(function () { syncViewportSize(false); }, 500);
  });
  window.addEventListener('pageshow', function () {
    clearAllInputKeys();
    syncViewportSize(true);
  });
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', function () {
      syncViewportSize(false);
    });
  }
  ctx.renderer.domElement.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });

  ctx.renderer.domElement.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    ctx._contextLost = true;
    clearAllInputKeys();
    if (ctx.callbacks && ctx.callbacks.onToast) {
      ctx.callbacks.onToast('⚠️ Contexto gráfico WebGL pausado pelo dispositivo. Recuperando...');
    }
  });

  ctx.renderer.domElement.addEventListener('webglcontextrestored', function () {
    ctx._contextLost = false;
    if (ctx.callbacks && ctx.callbacks.onQualityRestore) {
      ctx.callbacks.onQualityRestore();
    } else if (window.setCampusQualityMode && window.getCampusQualityState) {
      const st = window.getCampusQualityState();
      window.setCampusQualityMode(st.mode || st.tier || 'auto');
    }
  });
}
