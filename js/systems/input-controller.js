/**
 * Controlador de Entradas (Teclado, Mouse, PointerLock, Touch, Resize) - MycoCampus3D
 */

import { getHeldBoardToolColor } from './chalkboard.js';

export function bindControls(ctx) {
  window.addEventListener('keydown', function (e) {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    ctx.keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      if (window.triggerCampusJump) window.triggerCampusJump();
    }
    if (e.code === 'KeyG' || e.code === 'KeyQ') {
      if (ctx.heldItem) {
        ctx.toggleHeldItemPlacement();
      }
    }
    if (e.code === 'KeyR' && ctx.heldItem) {
      if (window.rotateCampusHeldItem) {
        window.rotateCampusHeldItem(e.shiftKey ? -Math.PI / 4 : Math.PI / 4);
      } else {
        ctx.heldRotY = (ctx.heldRotY || 0) + (e.shiftKey ? -Math.PI / 4 : Math.PI / 4);
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
    if (e.code === 'Escape' && window.isCampusRadialMenuOpen && window.isCampusRadialMenuOpen()) {
      e.preventDefault();
      window.closeCampusRadialMenu();
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
    if (ctx.heldItem) ctx.toggleHeldItemPlacement();
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
    if (e.button !== 0 || ctx.lobbyTourActive) return;
    if ((e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) || (performance.now() - lastTouchEndAt < 700)) {
      return;
    }
    if (ctx.inFps && document.pointerLockElement !== ctx.renderer.domElement) {
      safeRequestPointerLock();
      return;
    }
    ctx.isPrimaryDown = true;
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
      ctx.heldRotY += e.deltaY > 0 ? 0.35 : -0.35;
    }
  }, { passive: false });

  let touchLookId = null, lastTX = 0, lastTY = 0, touchMoved = false;
  ctx.touchDrawingBoard = false;
  function setNdcFromTouch(t) {
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    ctx.pointerNdc.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    ctx.pointerNdc.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function isUiTouch(el) {
    if (!el || !el.closest) return false;
    return !!(
      el.closest('#mobile-joystick-zone') ||
      el.closest('#mobile-actions') ||
      el.closest('.touch-btn') ||
      el.closest('button') ||
      el.closest('input') ||
      el.closest('textarea') ||
      el.closest('form') ||
      el.closest('#lesson-modal') ||
      el.closest('#ranking-modal') ||
      el.closest('#admin-modal') ||
      el.closest('#guide-modal') ||
      el.closest('#campus-lobby')
    );
  }

  window.addEventListener('touchstart', function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (isUiTouch(t.target)) continue;
      if (touchLookId === null) {
        touchLookId = t.identifier;
        lastTX = t.clientX; lastTY = t.clientY;
        touchMoved = false;
      }
    }
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchLookId) {
        const dx = t.clientX - lastTX, dy = t.clientY - lastTY;
        if (Math.hypot(dx, dy) > 4) touchMoved = true;
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
            setNdcFromTouch(t);
            ctx.updateHoverRay(ctx.pointerNdc);
            const isHolding = !!ctx.heldItem;
            const hasTarget = isHolding || ctx.hoveredPickable || ctx.hoveredMushroom || ctx.hoveredDoorObj || ctx.hoveredBlindObj ||
              ctx.hoveredSeat || ctx.hoveredSwitch || ctx.hoveredHoodSwitch || ctx.hoveredStirSwitch ||
              ctx.hoveredSyringeTarget || ctx.hoveredScaleTare || ctx.hoveredBurnerSwitch || ctx.hoveredPotInsert ||
              ctx.hoveredSprayTarget || ctx.hoveredRankBtn || ctx.hoveredCinema || ctx.hoveredScreen || ctx.hoveredScreenBtn ||
              (ctx.hoveredBoardHit && getHeldBoardToolColor(ctx.heldItem));
            if (!hasTarget) {
              ctx.pointerNdc.set(0, 0);
              ctx.updateHoverRay(ctx.pointerNdc);
            }
            ctx.handlePrimaryAction();
          }
        }
        touchLookId = null;
      }
    }
  }
  window.addEventListener('touchend', resetTouchLook, { passive: true });
  window.addEventListener('touchcancel', resetTouchLook, { passive: true });

  window.addEventListener('resize', function () {
    ctx.camera.aspect = window.innerWidth / window.innerHeight;
    ctx.camera.updateProjectionMatrix();
    ctx.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
