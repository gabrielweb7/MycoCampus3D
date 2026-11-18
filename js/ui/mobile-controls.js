/**
 * MycoCampus3D — Controles Mobile (Joystick Analógico, Sprint, Pulo & Ação)
 */
import { $ } from './dom-helpers.js';

export function setupMobileJoystick() {
  const zone = $('mobile-joystick-zone');
  const knob = $('mobile-joystick-knob');
  if (!zone || !knob) return;

  let activeId = null;
  const maxR = 42;

  function updateStick(clientX, clientY) {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let nx = dx / maxR;
    let ny = dy / maxR;
    if (Math.hypot(nx, ny) < 0.12) { nx = 0; ny = 0; }
    if (window.setCampusJoystick) window.setCampusJoystick(nx, ny);
  }

  function resetStick() {
    activeId = null;
    knob.style.transform = 'translate(0px, 0px)';
    if (window.setCampusJoystick) window.setCampusJoystick(0, 0);
  }

  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    if (!t) return;
    activeId = t.identifier;
    updateStick(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (activeId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeId) {
        updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  }, { passive: true });

  function endStick(e) {
    if (activeId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeId) {
        resetStick();
        break;
      }
    }
  }
  window.addEventListener('touchend', endStick, { passive: true });
  window.addEventListener('touchcancel', endStick, { passive: true });
  window.addEventListener('blur', resetStick);

  function bindTouchTap(btn, handler) {
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
    }, { passive: false });
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
    });
  }

  bindTouchTap($('btn-mobile-rotate'), () => {
    if (window.rotateCampusHeldItem) window.rotateCampusHeldItem();
  });

  bindTouchTap($('btn-mobile-drop'), () => {
    if (window.dropCampusHeldItem) window.dropCampusHeldItem();
  });

  const sprintBtn = $('btn-mobile-sprint');
  let sprintLatched = false;
  let sprintTouchStartAt = 0;
  function syncSprintState(active) {
    if (sprintBtn) sprintBtn.classList.toggle('sprint-active', !!active);
    if (window.setCampusSprint) window.setCampusSprint(!!active);
  }
  if (sprintBtn) {
    sprintBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sprintTouchStartAt = performance.now();
      syncSprintState(true);
    }, { passive: false });
    const endSprint = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const heldMs = performance.now() - sprintTouchStartAt;
      if (heldMs < 240) {
        sprintLatched = !sprintLatched;
        syncSprintState(sprintLatched);
      } else {
        sprintLatched = false;
        syncSprintState(false);
      }
    };
    sprintBtn.addEventListener('touchend', endSprint, { passive: false });
    sprintBtn.addEventListener('touchcancel', endSprint, { passive: false });
    sprintBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      sprintLatched = !sprintLatched;
      syncSprintState(sprintLatched);
    });
  }

  const jumpBtn = $('btn-mobile-jump');
  if (jumpBtn) {
    jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.setCampusJumpHeld) window.setCampusJumpHeld(true);
      if (window.triggerCampusJump) window.triggerCampusJump();
    }, { passive: false });
    const endJump = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.setCampusJumpHeld) window.setCampusJumpHeld(false);
    };
    jumpBtn.addEventListener('touchend', endJump, { passive: false });
    jumpBtn.addEventListener('touchcancel', endJump, { passive: false });
    jumpBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (window.triggerCampusJump) window.triggerCampusJump();
    });
  }

  const actionBtn = $('btn-mobile-action');
  if (actionBtn) {
    function activateActionButton() {
      if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(true);
    }

    let actionTouchId = null;
    let lastActionX = 0;
    let lastActionY = 0;

    actionBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0];
      if (!t) return;
      actionTouchId = t.identifier;
      lastActionX = t.clientX;
      lastActionY = t.clientY;
      actionBtn.classList.add('action-active');
      activateActionButton();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (actionTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === actionTouchId) {
          const dx = t.clientX - lastActionX;
          const dy = t.clientY - lastActionY;
          lastActionX = t.clientX;
          lastActionY = t.clientY;
          if (window.rotateCampusCamera) window.rotateCampusCamera(dx, dy);
          break;
        }
      }
    }, { passive: true });

    const endAction = (e) => {
      if (actionTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === actionTouchId) {
          actionTouchId = null;
          actionBtn.classList.remove('action-active');
          if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(false);
          break;
        }
      }
    };
    window.addEventListener('touchend', endAction, { passive: true });
    window.addEventListener('touchcancel', endAction, { passive: true });

    actionBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      actionBtn.classList.add('action-active');
      activateActionButton();
      let lastMX = e.clientX;
      let lastMY = e.clientY;
      function onMouseMove(ev) {
        const dx = ev.clientX - lastMX;
        const dy = ev.clientY - lastMY;
        lastMX = ev.clientX;
        lastMY = ev.clientY;
        if (window.rotateCampusCamera) window.rotateCampusCamera(dx, dy);
      }
      function onMouseUp() {
        actionBtn.classList.remove('action-active');
        if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('blur', onMouseUp);
      }
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('blur', onMouseUp);
    });
  }

  bindTouchTap($('btn-mobile-place'), () => {
    if (window.toggleCampusHeldPlacement) window.toggleCampusHeldPlacement();
  });
}
