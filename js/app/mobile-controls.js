/**
 * MycoCampus 3D — Mobile Virtual Joystick & Touch Action Controls
 */
(function () {
  'use strict';

  var App = window.MycoApp;
  var $ = App.$;

  App.setupMobileJoystick = function () {
    var zone = $('mobile-joystick-zone');
    var knob = $('mobile-joystick-knob');
    if (!zone || !knob) return;
    var activeId = null;
    var maxR = 42;

    function updateStick(clientX, clientY) {
      var rect = zone.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = clientX - cx;
      var dy = clientY - cy;
      var dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      knob.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
      var nx = dx / maxR;
      var ny = dy / maxR;
      var mag = Math.hypot(nx, ny);
      if (mag < 0.12) { nx = 0; ny = 0; }
      window.setCampusJoystick(nx, ny);
    }

    function resetStick() {
      activeId = null;
      knob.style.transform = 'translate(0px, 0px)';
      window.setCampusJoystick(0, 0);
    }

    zone.addEventListener('touchstart', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var t = e.changedTouches[0];
      if (!t) return;
      activeId = t.identifier;
      updateStick(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', function (e) {
      if (activeId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    }, { passive: true });

    function endStick(e) {
      if (activeId === null) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeId) {
          resetStick();
          break;
        }
      }
    }
    window.addEventListener('touchend', endStick, { passive: true });
    window.addEventListener('touchcancel', endStick, { passive: true });
    window.addEventListener('blur', resetStick);

    var rotBtn = $('btn-mobile-rotate');
    if (rotBtn) {
      rotBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.rotateCampusHeldItem) window.rotateCampusHeldItem();
      }, { passive: false });
      rotBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        if (window.rotateCampusHeldItem) window.rotateCampusHeldItem();
      });
    }

    var sprintBtn = $('btn-mobile-sprint');
    var sprintLatched = false;
    var sprintTouchStartAt = 0;
    function syncSprintState(active) {
      sprintBtn.classList.toggle('sprint-active', !!active);
      if (window.setCampusSprint) window.setCampusSprint(!!active);
    }
    if (sprintBtn) {
      sprintBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        sprintTouchStartAt = performance.now();
        syncSprintState(true);
      }, { passive: false });
      var endSprint = function (e) {
        e.preventDefault();
        e.stopPropagation();
        var heldMs = performance.now() - sprintTouchStartAt;
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
      sprintBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        sprintLatched = !sprintLatched;
        syncSprintState(sprintLatched);
      });
    }

    var jumpBtn = $('btn-mobile-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.setCampusJumpHeld) window.setCampusJumpHeld(true);
        window.triggerCampusJump();
      }, { passive: false });
      var endJump = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.setCampusJumpHeld) window.setCampusJumpHeld(false);
      };
      jumpBtn.addEventListener('touchend', endJump, { passive: false });
      jumpBtn.addEventListener('touchcancel', endJump, { passive: false });
      jumpBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        window.triggerCampusJump();
      });
    }

    var actionBtn = $('btn-mobile-action');
    if (actionBtn) {
      var actionTouchId = null;
      var lastActionX = 0;
      var lastActionY = 0;

      actionBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var t = e.changedTouches[0];
        if (!t) return;
        actionTouchId = t.identifier;
        lastActionX = t.clientX;
        lastActionY = t.clientY;
        actionBtn.classList.add('action-active');
        if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(true);
      }, { passive: false });

      window.addEventListener('touchmove', function (e) {
        if (actionTouchId === null) return;
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier === actionTouchId) {
            var dx = t.clientX - lastActionX;
            var dy = t.clientY - lastActionY;
            lastActionX = t.clientX;
            lastActionY = t.clientY;
            if (window.rotateCampusCamera) {
              window.rotateCampusCamera(dx, dy);
            }
            break;
          }
        }
      }, { passive: true });

      var endAction = function (e) {
        if (actionTouchId === null) return;
        for (var i = 0; i < e.changedTouches.length; i++) {
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

      actionBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        actionBtn.classList.add('action-active');
        if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(true);
        var lastMX = e.clientX;
        var lastMY = e.clientY;
        function onMouseMove(ev) {
          var dx = ev.clientX - lastMX;
          var dy = ev.clientY - lastMY;
          lastMX = ev.clientX;
          lastMY = ev.clientY;
          if (window.rotateCampusCamera) {
            window.rotateCampusCamera(dx, dy);
          }
        }
        function onMouseUp() {
          actionBtn.classList.remove('action-active');
          if (window.setCampusMobilePrimary) window.setCampusMobilePrimary(false);
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        }
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  };

  App.updateFpsUi = function (fps) {
    App.inFpsState = fps;
    $('btn-toggle-fps').textContent = fps ? '🌍 Vista Aérea' : '🎥 1ª Pessoa';
    $('crosshair').style.display = fps ? 'block' : 'none';
    if (fps && App.isTouch()) {
      $('mobile-joystick-zone').style.display = 'block';
      $('mobile-actions').style.display = 'flex';
    } else {
      $('mobile-joystick-zone').style.display = 'none';
      $('mobile-actions').style.display = 'none';
    }
  };
})();
