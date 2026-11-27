/**
 * MycoCampus3D — Controles Mobile (Joystick Analógico, Sprint, Pulo & Ação)
 */
import { $ } from './dom-helpers.js';

export function setupMobileJoystick() {
  const zone = $('mobile-joystick-zone');
  const knob = $('mobile-joystick-knob');
  if (!zone || !knob) return;

  let activeId = null;
  let cachedRect = null;
  let sprinting = false;
  const maxR = 42;

  function setSprint(active) {
    if (sprinting === active) return;
    sprinting = active;
    zone.classList.toggle('joystick-sprint', active);
    window.setCampusSprint?.(active);
  }

  function invalidateRect() {
    cachedRect = null;
  }
  window.addEventListener('resize', invalidateRect);
  window.addEventListener('orientationchange', invalidateRect);

  function updateStick(clientX, clientY) {
    const rect = cachedRect || (cachedRect = zone.getBoundingClientRect());
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    setSprint(dist >= (sprinting ? maxR : maxR + 8));
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
    cachedRect = null;
    knob.style.transform = 'translate(0px, 0px)';
    setSprint(false);
    if (window.setCampusJoystick) window.setCampusJoystick(0, 0);
  }

  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    if (!t) return;
    cachedRect = zone.getBoundingClientRect();
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
}
