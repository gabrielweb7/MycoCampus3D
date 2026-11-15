/**
 * MycoCampus 3D — Main Animation Loop, World Init & Public API Exports
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.animate = function () {
    requestAnimationFrame(E.animate);
    var dt = Math.min(0.05, E.clock.getDelta());
    var now = performance.now();

    E.updateClockTexture();

    E.wildMushrooms.forEach(function (wm) {
      if (!wm.active && now >= wm.respawnAt) {
        wm.active = true; wm.group.visible = true;
      } else if (wm.active) {
        wm.capMesh.rotation.y += dt * 0.5;
      }
    });

    for (var di = 0; di < E.campusDoors.length; di++) {
      var d = E.campusDoors[di];
      var targetAngle = d.open ? -d.dir * Math.PI * 0.48 : 0;
      d.angle += (targetAngle - d.angle) * Math.min(1, dt * 8);
      d.pivot.rotation.y = d.angle;
    }

    for (var bi = 0; bi < E.windowBlinds.length; bi++) {
      var b = E.windowBlinds[bi];
      var targetProg = b.open ? 0.0 : 1.0; // 1.0 = persiana abaixada cobrindo o vidro, 0.0 = recolhida no topo
      if (Math.abs(b.progress - targetProg) > 0.001) {
        b.progress += (targetProg - b.progress) * Math.min(1, dt * 7.5);
        var p = b.progress;
        var count = b.slats.length;
        var activeSpan = (b.dropH - 0.14) * p;
        for (var si = 0; si < count; si++) {
          var frac = (si + 0.5) / count;
          var stackedY = -0.05 - si * 0.007;
          var fullY = -0.07 - frac * (b.dropH - 0.12);
          b.slats[si].position.y = stackedY + (fullY - stackedY) * p;
          // Lâminas inclinam enquanto abrem/fecham, simulando o giro da vareta da persiana
          b.slats[si].rotation.z = b.dir * (0.28 * p + (1 - p) * 1.15);
        }
        var bottomY = -0.09 - count * 0.007 - activeSpan;
        b.bottomRail.position.y = bottomY;
        var tapeLen = Math.max(0.08, -bottomY);
        for (var ti = 0; ti < b.tapes.length; ti++) {
          b.tapes[ti].scale.y = tapeLen / b.dropH;
          b.tapes[ti].position.y = -tapeLen / 2;
        }
        if (b.cordKnob) {
          b.cordKnob.position.y = -b.dropH * 0.42 - (1 - p) * (b.dropH * 0.35);
        }
      }
    }

    if (E.lobbyTourActive) {
      E.stepLobbyTour(dt);
    } else if (E.inFps) {
      var moveZ = (E.keys['KeyW'] || E.keys['ArrowUp'] ? 1 : 0) - (E.keys['KeyS'] || E.keys['ArrowDown'] ? 1 : 0) - E.joyY;
      var moveX = (E.keys['KeyD'] || E.keys['ArrowRight'] ? 1 : 0) - (E.keys['KeyA'] || E.keys['ArrowLeft'] ? 1 : 0) + E.joyX;
      var mag = Math.hypot(moveX, moveZ);
      var targetVX = 0, targetVZ = 0;
      if (mag > 0.08) {
        if (E.seatedSeat) E.seatedSeat = null; // levanta automaticamente ao andar!
        var isSprinting = !!(E.keys['ShiftLeft'] || E.keys['ShiftRight'] || E.mobileSprint);
        var maxSpeed = isSprinting ? 7.5 : 4.6;
        var throttle = Math.min(1, mag);
        moveX /= mag; moveZ /= mag;
        var fwdX = -Math.sin(E.playerYaw), fwdZ = -Math.cos(E.playerYaw);
        var rightX = Math.cos(E.playerYaw), rightZ = -Math.sin(E.playerYaw);
        targetVX = (fwdX * moveZ + rightX * moveX) * maxSpeed * throttle;
        targetVZ = (fwdZ * moveZ + rightZ * moveX) * maxSpeed * throttle;
      }
      // Aceleracao e desaceleracao suaves (inercia natural ao andar e parar)
      var accelFactor = 1 - Math.exp(-(mag > 0.08 ? 9.5 : 7.5) * dt);
      E.playerVelX += (targetVX - E.playerVelX) * accelFactor;
      E.playerVelZ += (targetVZ - E.playerVelZ) * accelFactor;

      var speedNow = Math.hypot(E.playerVelX, E.playerVelZ);
      E.isWalking = speedNow > 0.2;
      if (speedNow > 0.01) {
        E.playerPos.x += E.playerVelX * dt;
        E.playerPos.z += E.playerVelZ * dt;
        E.clampPosAgainstWalls(E.playerPos, E.PLAYER_RADIUS);
      }
      var groundY = E.getGroundHeight(E.playerPos.x, E.playerPos.z, E.playerPos.y);
      E.playerVelY -= 16.5 * dt;
      E.playerPos.y += E.playerVelY * dt;
      if (E.playerPos.y <= groundY) {
        E.playerPos.y = groundY;
        E.playerVelY = 0;
        E.onGround = true;
        E.lastGroundedAt = now;
      } else {
        E.onGround = false;
      }
      if (E.inFps && E.isWalking && E.onGround && window.MycoAudio) {
        var sType = E.getSurfaceTypeAt(E.playerPos.x, E.playerPos.y, E.playerPos.z);
        window.MycoAudio.playFootstep(sType);
      }
      // Pulo responsivo: Coyote Time (150ms), Jump Buffer (150ms) e segurar Espaco/Pulo
      var wantsJump = (now <= E.jumpBufferUntil) || E.keys['Space'] || E.jumpHeld;
      if (wantsJump && (E.onGround || (now - E.lastGroundedAt < 150 && E.playerVelY <= 0))) {
        if (E.seatedSeat) E.seatedSeat = null;
        E.playerVelY = 6.2;
        E.onGround = false;
        E.lastGroundedAt = 0;
        E.jumpBufferUntil = 0;
      }
      var bobY = 0;
      if (E.onGround && speedNow > 0.25) {
        E.walkBobPhase += dt * (4.5 + speedNow * 1.4);
        bobY = Math.sin(E.walkBobPhase) * 0.028 * Math.min(1, speedNow / 3.8);
      }
      var eyeH = E.seatedSeat ? 1.50 : E.PLAYER_EYE;
      if (E.seatedSeat) {
        E.playerPos.set(E.seatedSeat.x, E.seatedSeat.y, E.seatedSeat.z);
        E.playerVelY = 0;
      }
      E.camera.position.set(E.playerPos.x, E.playerPos.y + eyeH + bobY, E.playerPos.z);
      E.camera.up.set(0, 1, 0);
      E.camera.rotation.order = 'YXZ';
      E.camera.rotation.y = E.playerYaw;
      E.camera.rotation.x = E.playerPitch;
      E.camera.rotation.z = 0;

      // Braço(s) em 1a pessoa + item segurado na(s) mao(s)
      var isTwoHanded = !!(E.heldItem && E.heldItem.mesh.userData.twoHanded);
      if (E.fpsArmGroup) {
        E.fpsArmGroup.visible = true;
        var drawingNow = !!(E.isPrimaryDown && E.hoveredBoardHit && E.getHeldBoardToolColor());
        E.armReach += ((drawingNow ? 1 : 0) - E.armReach) * Math.min(1, dt * 14);
        if (speedNow > 0.2) E.armSwingPhase += dt * 7;
        E.fpsArmGroup.position.set(
          (isTwoHanded ? 0.27 : 0.32) - E.armReach * 0.08,
          (isTwoHanded ? -0.34 : -0.28) + Math.sin(E.armSwingPhase) * 0.014 + E.armReach * 0.06,
          (isTwoHanded ? -0.56 : -0.42) - E.armReach * 0.16
        );
        E.fpsArmGroup.rotation.set(0.18 + E.armReach * 0.35, (isTwoHanded ? 0.12 : -0.14) + E.armReach * 0.1, 0.05);
      }
      if (E.fpsLeftArmGroup) {
        E.fpsLeftArmGroup.visible = isTwoHanded;
        if (isTwoHanded) {
          E.fpsLeftArmGroup.position.set(-0.27, -0.34 + Math.sin(E.armSwingPhase) * 0.014, -0.56);
          E.fpsLeftArmGroup.rotation.set(0.18, -0.12, -0.05);
        }
      }

      if (E.heldItem) {
        var reachZ = E.fpsArmGroup ? E.armReach * 0.16 : 0;
        var reachY = E.fpsArmGroup ? E.armReach * 0.06 : 0;
        if (isTwoHanded) {
          E._tmpHandLocal.set(0, -0.48, -0.78);
        } else {
          E._tmpHandLocal.set(0.30, -0.22 + reachY, -0.58 - reachZ);
        }
        E._tmpHandPos.copy(E._tmpHandLocal).applyEuler(E.camera.rotation).add(E.camera.position);
        E.heldItem.mesh.position.copy(E._tmpHandPos);
        if (E.heldItem.id.indexOf('chalk_') === 0) {
          E.heldItem.mesh.rotation.order = 'YXZ';
          E.heldItem.mesh.rotation.set(E.playerPitch + 0.35, E.playerYaw, 0);
        } else if (E.heldItem.id.indexOf('board_eraser') === 0) {
          E.heldItem.mesh.rotation.order = 'YXZ';
          E.heldItem.mesh.rotation.set(E.playerPitch + Math.PI / 2, E.playerYaw, 0);
        } else if (E.heldItem.mesh.userData.isThermometer) {
          E._tmpHandLocal.set(0.24, -0.22 + reachY, -0.46 - reachZ);
          E._tmpHandPos.copy(E._tmpHandLocal).applyEuler(E.camera.rotation).add(E.camera.position);
          E.heldItem.mesh.position.copy(E._tmpHandPos);
          E.heldItem.mesh.rotation.order = 'YXZ';
          E.heldItem.mesh.rotation.set(E.playerPitch, E.playerYaw, 0);

          // Feixe laser e leitura de temperatura em tempo real (otimizado sem travar o jogo)
          var muzzlePos = new THREE.Vector3(0, 0.155, -0.09).applyEuler(E.heldItem.mesh.rotation).add(E.heldItem.mesh.position);
          E.raycaster.setFromCamera(E.inFps ? _vZero2 : E.pointerNdc, E.camera);

          if (!window._cachedLaserTargets || (now - (window._lastLaserCacheAt || 0) > 800)) {
            window._lastLaserCacheAt = now;
            var lTargets = [];
            for (var pki = 0; pki < E.pickableItems.length; pki++) {
              var pItem = E.pickableItems[pki];
              if (pItem && pItem.mesh && pItem !== E.heldItem) lTargets.push(pItem.mesh);
            }
            for (var smi = 0; smi < E.supportMeshes.length; smi++) {
              var sMesh = E.supportMeshes[smi];
              if (sMesh && (!E.heldItem || sMesh !== E.heldItem.mesh)) lTargets.push(sMesh);
            }
            Object.keys(E.remoteAvatars).forEach(function (rId) {
              var rAv = E.remoteAvatars[rId];
              if (rAv && rAv.group) lTargets.push(rAv.group);
            });
            window._cachedLaserTargets = lTargets;
          }

          var allLaserHits = E.raycaster.intersectObjects(window._cachedLaserTargets, true).filter(function (h) {
            return !h.object.userData.ignoreRay &&
                   h.object !== E.heldItem.mesh &&
                   h.object !== E.thermoLaserLine &&
                   h.object !== E.thermoLaserDot;
          });
          if (allLaserHits.length > 0 && allLaserHits[0].distance < 35.0) {
            var lHit = allLaserHits[0];
            var lArr = E.thermoLaserLine.geometry.attributes.position.array;
            lArr[0] = muzzlePos.x; lArr[1] = muzzlePos.y; lArr[2] = muzzlePos.z;
            lArr[3] = lHit.point.x; lArr[4] = lHit.point.y; lArr[5] = lHit.point.z;
            E.thermoLaserLine.geometry.attributes.position.needsUpdate = true;
            E.thermoLaserLine.visible = true;

            var lNorm = lHit.face ? lHit.face.normal.clone().transformDirection(lHit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
            E.thermoLaserDot.position.copy(lHit.point).addScaledVector(lNorm, 0.005);
            E.thermoLaserDot.lookAt(lHit.point.clone().add(lNorm));
            E.thermoLaserDot.visible = true;

            // Simulação física de temperatura por material / objeto
            var sTemp = 23.4;
            var sLbl = 'Ambiente';
            var hObj = lHit.object;

            var isBurnerHit = false;
            for (var bi = 0; bi < E.burnerDevices.length; bi++) {
              var bd = E.burnerDevices[bi];
              if (hObj.userData.burnerSwitch || hObj.userData.supportSurface === bd.surface ||
                  (lHit.point.x >= bd.surface.minX && lHit.point.x <= bd.surface.maxX &&
                   lHit.point.z >= bd.surface.minZ && lHit.point.z <= bd.surface.maxZ &&
                   Math.abs(lHit.point.y - bd.surface.topY) < 0.15)) {
                sTemp = 24.0 + (bd.heat || 0) * 215.0;
                sLbl = (bd.heat > 0.15) ? 'Fogareiro Incandescente (' + Math.round(sTemp) + '°C)' : 'Fogareiro Elétrico';
                isBurnerHit = true; break;
              }
            }
            if (!isBurnerHit) {
              for (var cpi = 0; cpi < E.cookerPots.length; cpi++) {
                var cp = E.cookerPots[cpi];
                if (hObj === cp.potItem.mesh || hObj === cp.lidItem.mesh ||
                    hObj.parent === cp.potItem.mesh || hObj.parent === cp.lidItem.mesh ||
                    cp.contents.some(function (it) { return it.mesh === hObj || it.mesh.children.includes(hObj); })) {
                  sTemp = cp.temp || 24.5;
                  sLbl = cp.psi >= 14 ? 'Panela Esterilizando (' + Math.round(cp.psi) + ' PSI)' : (cp.temp > 35 ? 'Panela Aquecendo' : 'Panela de Pressão');
                  break;
                }
              }
            }
            if (!isBurnerHit && sLbl === 'Ambiente') {
              if (hObj.userData.stirSwitch || hObj.parent && hObj.parent.userData.stirSwitch) {
                sTemp = (E.stirrerDevices[0] && E.stirrerDevices[0].on) ? 33.5 : 23.8;
                sLbl = 'Agitador Magnético';
              } else if (hObj.userData.liquidCtrl || hObj.parent && hObj.parent.userData.liquidCtrl) {
                sTemp = 24.4 + Math.sin(E.clock.elapsedTime * 2.0) * 0.2;
                sLbl = 'Cultura Líquida (Inoculação)';
              } else if (lHit.point.x > 18 && lHit.point.z > 5 && lHit.point.z < 11) {
                sTemp = 20.8 + Math.cos(E.clock.elapsedTime * 1.5) * 0.3;
                sLbl = 'Câmara de Frutificação (Estufa)';
              } else if (hObj.userData.remotePlayer) {
                sTemp = 36.8;
                sLbl = 'Jogador (Temperatura Corporal)';
              } else {
                sTemp = 23.2 + Math.sin(lHit.point.x * 0.5 + lHit.point.z * 0.3) * 0.4;
                sLbl = 'Ambiente / ' + (lHit.point.y > 0.6 ? 'Bancada' : 'Piso');
              }
            }
            E.thermoTargetTemp = sTemp;
            E.thermoTargetLabel = sLbl;
          } else {
            E.thermoLaserLine.visible = false;
            E.thermoLaserDot.visible = false;
            E.thermoTargetTemp = 23.5;
            E.thermoTargetLabel = 'Ar Ambiente';
          }
          E.thermoCurrentTemp += (E.thermoTargetTemp - E.thermoCurrentTemp) * Math.min(1, dt * 14);
          E.drawThermoScreen(E.thermoCurrentTemp, E.isPrimaryDown ? 'SCAN' : 'HOLD');
        } else {
          E.heldItem.mesh.rotation.set(0, E.heldRotY, 0);
        }

        // Animação da Seringa furando o septo de borracha vermelha
        if (E.heldItem.mesh.userData.isSyringe) {
          var isPuncturing = !!(E.hoveredSyringeTarget && E.hoveredSyringeTarget.item && E.hoveredSyringeTarget.item.mesh.userData.liquidCtrl);
          E.syringePunctureProgress += ((isPuncturing ? 1 : 0) - E.syringePunctureProgress) * Math.min(1, dt * 10);
          if (E.syringePunctureProgress > 0.01) {
            var sTgt = E.hoveredSyringeTarget.item;
            var portLocal = new THREE.Vector3(0.036, 0.290, 0);
            var portWorld = portLocal.applyEuler(sTgt.mesh.rotation).add(sTgt.mesh.position);
            var piercedHandPos = portWorld.clone().add(new THREE.Vector3(0.04, 0.12, 0.05));
            E._tmpHandPos.lerp(piercedHandPos, E.syringePunctureProgress);
            E.heldItem.mesh.position.copy(E._tmpHandPos);
            E.heldItem.mesh.rotation.set(0.78, sTgt.mesh.rotation.y + Math.PI, 0);

            if (E.fpsArmGroup) {
              E.armReach += (1.45 - E.armReach) * Math.min(1, dt * 12);
              E.fpsArmGroup.position.set(0.18, -0.20, -0.62);
              E.fpsArmGroup.rotation.set(0.52, -0.05, 0.08);
            }
          }
        }

        if (E.heldItem.lidItem && E.heldItem.lidItem.isAttached) {
          var lidObj = E.heldItem.lidItem.mesh;
          lidObj.position.set(E._tmpHandPos.x, E._tmpHandPos.y + 0.36, E._tmpHandPos.z);
          lidObj.rotation.copy(E.heldItem.mesh.rotation);
        }
      } else {
        if (E.thermoLaserLine && E.thermoLaserLine.visible) E.thermoLaserLine.visible = false;
        if (E.thermoLaserDot && E.thermoLaserDot.visible) E.thermoLaserDot.visible = false;
      }

      // Processo de bombeamento contínuo da seringa de 2 segundos (0% a 100%)
      if (E.syringePumping && E.heldItem && E.heldItem.mesh.userData.isSyringe) {
        E.syringePumping.elapsed += dt;
        var pRatio = Math.min(1, E.syringePumping.elapsed / E.syringePumping.duration);
        var pSmooth = pRatio * pRatio * (3 - 2 * pRatio); // ease-in-out suave
        var curVol = THREE.MathUtils.lerp(E.syringePumping.fromVol, E.syringePumping.toVol, pSmooth);
        updateSyringeVolume(E.heldItem, curVol);
        if (E.syringePumping.target.item && E.syringePumping.target.item.mesh.userData.liquidCtrl) {
          var dHeld = curVol - E.syringePumping.fromVol;
          var newJVol = Math.max(0, E.syringePumping.startJarVol - dHeld);
          updateContainerVolume(E.syringePumping.target.item, newJVol);
        }
        if (pRatio >= 1.0) {
          updateSyringeVolume(E.heldItem, E.syringePumping.toVol);
          if (E.syringePumping.target.item && E.syringePumping.target.item.mesh.userData.liquidCtrl) {
            var finalD = E.syringePumping.toVol - E.syringePumping.fromVol;
            updateContainerVolume(E.syringePumping.target.item, Math.max(0, E.syringePumping.startJarVol - finalD));
          }
          if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(E.heldItem.label);
          E.notifyWorldAction();
          E.syringePumping = null;
        }
      }
      if (E.localAvatar) {
        E.localAvatar.group.visible = true;
        E.animateAvatarAura(E.localAvatar, E.clock.elapsedTime);
        // Desloca 0.14m para tras para enxergar as proprias pernas ao olhar para baixo e projetar sombra inteira!
        var backOff = E.seatedSeat ? 0.02 : 0.14;
        E.localAvatar.group.position.set(
          E.playerPos.x + Math.sin(E.playerYaw) * backOff,
          E.playerPos.y,
          E.playerPos.z + Math.cos(E.playerYaw) * backOff
        );
        E.localAvatar.group.rotation.y = E.playerYaw;
        if (E.seatedSeat) {
          if (E.localAvatar.torso) {
            E.localAvatar.torso.visible = false;
            E.localAvatar.torso.position.set(0, 0.60, 0);
          }
          E.localAvatar.leftLeg.position.set(-0.11, 0.41, 0);
          E.localAvatar.rightLeg.position.set(0.11, 0.41, 0);
          E.localAvatar.leftLeg.rotation.x = Math.PI / 2;
          E.localAvatar.rightLeg.rotation.x = Math.PI / 2;
        } else {
          if (E.localAvatar.torso) {
            E.localAvatar.torso.visible = true;
            E.localAvatar.torso.position.set(0, 0.64, 0);
          }
          E.localAvatar.leftLeg.position.set(-0.10, 0.38, 0);
          E.localAvatar.rightLeg.position.set(0.10, 0.38, 0);
          if (E.isWalking) {
            E.localAvatar.walkPhase += dt * 10;
            E.localAvatar.leftLeg.rotation.x = Math.sin(E.localAvatar.walkPhase) * 0.55;
            E.localAvatar.rightLeg.rotation.x = -Math.sin(E.localAvatar.walkPhase) * 0.55;
          } else {
            E.localAvatar.leftLeg.rotation.x *= 0.8;
            E.localAvatar.rightLeg.rotation.x *= 0.8;
          }
        }
        E.localAvatar.headGroup.visible = false; // nunca tampa a visao em 1a pessoa ao olhar para baixo
        E.localAvatar.leftArm.visible = false;
        E.localAvatar.rightArm.visible = false; // usa os bracos 1a pessoa detalhados
      }
    } else {
      if (E.fpsArmGroup) E.fpsArmGroup.visible = false;
      if (E.fpsLeftArmGroup) E.fpsLeftArmGroup.visible = false;
      if (E.localAvatar) E.localAvatar.group.visible = false;
      E.isWalking = false;
      E.controls.update();
    }

    if (!E.lobbyTourActive) {
      if (!E.touchDrawingBoard && (!E.isTouchDevice() || E.isPrimaryDown || (E.heldItem && now - E.lastMobileHoverAt > 45) || (now - E.lastMobileHoverAt > 260))) {
        E.lastMobileHoverAt = now;
        E.updateHoverRay();
      }
      // Desenho ou apagamento continuo na lousa enquanto segura o clique perto dela
      var toolColor = E.getHeldBoardToolColor();
      var activeBoard = E.chalkboards[E.hoveredBoardIndex];
      if (E.isPrimaryDown && E.hoveredBoardHit && toolColor && activeBoard) {
        var px = Math.round(E.hoveredBoardHit.uv.x * 512 * 10) / 10;
        var py = Math.round((1 - E.hoveredBoardHit.uv.y) * 256 * 10) / 10;
        var curPt = [px, py];
        if (!E.currentStroke || E.currentStroke.c !== toolColor || E.currentStroke.b !== E.hoveredBoardIndex) {
          E.flushCurrentStroke();
          E.currentStroke = { b: E.hoveredBoardIndex, c: toolColor, pts: [curPt] };
          E.drawBoardSegment(activeBoard.ctx, toolColor, curPt, curPt);
          activeBoard.tex.needsUpdate = true;
          E.lastDrawPt = curPt;
        } else if (!E.lastDrawPt || Math.hypot(curPt[0] - E.lastDrawPt[0], curPt[1] - E.lastDrawPt[1]) >= 2.5) {
          E.drawBoardSegment(activeBoard.ctx, toolColor, E.lastDrawPt || curPt, curPt);
          activeBoard.tex.needsUpdate = true;
          E.currentStroke.pts.push(curPt);
          E.lastDrawPt = curPt;
          if (E.currentStroke.pts.length >= 60) {
            E.flushCurrentStroke();
            E.currentStroke = { b: E.hoveredBoardIndex, c: toolColor, pts: [curPt] };
            E.lastDrawPt = curPt;
          }
        }
      } else if (E.currentStroke) {
        E.flushCurrentStroke();
      }
    }
    if (E.hoodAirData && E.hoodAirData.on && E.hoodAirData.attr) {
      var aArr = E.hoodAirData.attr.array;
      for (var ai = 0; ai < aArr.length; ai += 3) {
        aArr[ai] += dt * 1.45;
        if (aArr[ai] > 0.78) {
          aArr[ai] = -0.36;
          aArr[ai + 1] = 0.10 + Math.random() * 0.85;
          aArr[ai + 2] = (Math.random() - 0.5) * 2.0;
        }
      }
      E.hoodAirData.attr.needsUpdate = true;
    }
    if (E.stirrerDevices.length) {
      for (var si = 0; si < E.pickableItems.length; si++) {
        var liqIt = E.pickableItems[si];
        var lcCtrl = liqIt.mesh && liqIt.mesh.userData.liquidCtrl;
        if (!lcCtrl || !lcCtrl.stirBar) continue;
        var lx = liqIt.mesh.position.x, ly = liqIt.mesh.position.y, lz = liqIt.mesh.position.z;
        for (var sj = 0; sj < E.stirrerDevices.length; sj++) {
          var st = E.stirrerDevices[sj];
          if (st.on && lx >= st.surface.minX && lx <= st.surface.maxX && lz >= st.surface.minZ && lz <= st.surface.maxZ && Math.abs(ly - st.surface.topY) < 0.08) {
            lcCtrl.stirBar.rotation.y += dt * 18;
            if (lcCtrl.mycCloud) lcCtrl.mycCloud.rotation.y += dt * 4.5;
            break;
          }
        }
      }
    }
    if (E.scaleDevices.length && (!E.animate._lastScaleAt || now - E.animate._lastScaleAt > 150)) {
      E.animate._lastScaleAt = now;
      for (var sci = 0; sci < E.scaleDevices.length; sci++) {
        var scObj = E.scaleDevices[sci];
        var gross = 0;
        for (var pi = 0; pi < E.pickableItems.length; pi++) {
          var pIt = E.pickableItems[pi];
          if (E.heldItem === pIt || pIt.mesh.userData.tableDims || pIt.potItem) continue;
          var px0 = pIt.mesh.position.x, py0 = pIt.mesh.position.y, pz0 = pIt.mesh.position.z;
          if (px0 >= scObj.surface.minX && px0 <= scObj.surface.maxX && pz0 >= scObj.surface.minZ && pz0 <= scObj.surface.maxZ && Math.abs(py0 - scObj.surface.topY) < 0.08) {
            if (pIt.mesh.userData.liquidCtrl) gross += 260 + pIt.mesh.userData.liquidCtrl.volMl;
            else if (pIt.id.indexOf('spawn_jar_empty') === 0) gross += 320;
            else if (pIt.id.indexOf('spawn_jar') === 0) gross += 780;
            else if (pIt.id.indexOf('spawn_bag_empty') === 0) gross += 25;
            else if (pIt.id.indexOf('spawn_bag') === 0) gross += 1525;
            else if (pIt.id.indexOf('pda_bottle') === 0) gross += 540;
            else if (pIt.id.indexOf('petri_bare_') === 0) gross += 18;
            else if (pIt.id.indexOf('petri_') === 0) gross += 38;
            else if (pIt.mesh.userData.isSyringe) gross += 12 + pIt.mesh.userData.syrCtrl.volMl;
            else if (pIt.mesh.userData.isAlcoholSpray) gross += 380;
            else if (pIt.id.indexOf('substrate_') === 0) gross += 5000;
            else if (pIt.id.indexOf('gloves_box_') === 0) gross += 420;
            else if (pIt.id.indexOf('foil_roll_') === 0) gross += 260;
            else if (pIt.id.indexOf('micropore_') === 0 || pIt.id.indexOf('parafilm_') === 0) gross += 65;
            else gross += 150;
          }
        }
        scObj.lastGross = gross;
        scObj.draw(gross - scObj.tare);
      }
    }
    if (E.cookerPots.length) {
      var anyPotSteaming = false;
      for (var bni = 0; bni < E.burnerDevices.length; bni++) {
        var bnd = E.burnerDevices[bni];
        bnd.heat = bnd.on ? Math.min(1, (bnd.heat || 0) + dt * 0.55) : Math.max(0, (bnd.heat || 0) - dt * 0.25);
        var h = bnd.heat;
        var pulse = h > 0.2 ? Math.sin(E.clock.elapsedTime * 5.0) * 0.08 * h : 0;
        bnd.coilMat.emissiveIntensity = h * 2.2 + pulse;
        bnd.coilMat.color.setRGB(0.39 + h * 0.55, 0.45 - h * 0.30, 0.55 - h * 0.48);
        if (bnd.reflectorMat) bnd.reflectorMat.emissiveIntensity = h * 0.28;
      }
      for (var cpi = 0; cpi < E.cookerPots.length; cpi++) {
        var cp = E.cookerPots[cpi];
        var potP = cp.potItem.mesh.position;
        var onActiveBurner = false;
        for (var bi = 0; bi < E.burnerDevices.length; bi++) {
          var bn = E.burnerDevices[bi];
          if (bn.on && potP.x >= bn.surface.minX && potP.x <= bn.surface.maxX && potP.z >= bn.surface.minZ && potP.z <= bn.surface.maxZ && Math.abs(potP.y - bn.surface.topY) < 0.08) {
            onActiveBurner = true; break;
          }
        }
        if (onActiveBurner && cp.lidItem.isAttached) {
          cp.temp = Math.min(121, cp.temp + dt * 16);
          cp.psi = Math.max(0, ((cp.temp - 100) / 21) * 15);
          if (cp.psi >= 14.2) {
            anyPotSteaming = true;
            cp.steamPoints.visible = true;
            var sa = cp.steamAttr.array;
            for (var si = 0; si < sa.length; si += 3) {
              sa[si + 1] += dt * 0.65;
              if (sa[si + 1] > 0.60) {
                sa[si] = (Math.random() - 0.5) * 0.04;
                sa[si + 1] = 0.17;
                sa[si + 2] = (Math.random() - 0.5) * 0.04;
              }
            }
            cp.steamAttr.needsUpdate = true;
            cp.weight.position.y = 0.13 + Math.sin(E.clock.elapsedTime * 35) * 0.004;
            cp.weightTop.position.y = 0.16 + Math.sin(E.clock.elapsedTime * 35) * 0.004;
            if (cp.progress < 100) {
              cp.progress = Math.min(100, cp.progress + dt * 8.5);
              if (cp.progress >= 100) {
                cp.sterilized = true;
                for (var ci = 0; ci < cp.contents.length; ci++) {
                  var cIt = cp.contents[ci];
                  if (cIt.spawnCtrl) {
                    cIt.spawnCtrl.sterilized = true;
                    cIt.spawnCtrl.updateVisual();
                  }
                }
              }
            }
          } else {
            cp.steamPoints.visible = false;
          }
        } else {
          cp.temp = Math.max(25, cp.temp - dt * 12);
          cp.psi = Math.max(0, cp.psi - dt * 6);
          cp.steamPoints.visible = false;
          cp.weight.position.y = 0.13;
          cp.weightTop.position.y = 0.16;
          if (!cp.lidItem.isAttached) cp.progress = 0;
        }
      }
      if (window.MycoAudio) {
        window.MycoAudio.setSteam(anyPotSteaming);
      }
    }
    if (E.spawnGrowItems.length) {
      for (var sgi = 0; sgi < E.spawnGrowItems.length; sgi++) {
        var sgIt = E.spawnGrowItems[sgi];
        var sc = sgIt.spawnCtrl;
        if (sc && sc.inoculated && sc.colonization < 100) {
          sc.colonization = Math.min(100, sc.colonization + dt * 4.2);
          sc.updateVisual();
        }
      }
    }
    if (E.sprayBursts.length) {
      for (var sbi = E.sprayBursts.length - 1; sbi >= 0; sbi--) {
        var sb = E.sprayBursts[sbi];
        sb.age += dt;
        var sArr = sb.attr.array;
        for (var k = 0; k < sArr.length; k += 3) {
          sArr[k] += sb.dir.x * dt * 2.2;
          sArr[k + 1] += sb.dir.y * dt * 2.2;
          sArr[k + 2] += sb.dir.z * dt * 2.2;
        }
        sb.attr.needsUpdate = true;
        sb.mat.opacity = Math.max(0, 0.85 * (1 - sb.age / 0.45));
        if (sb.age >= 0.45) {
          E.scene.remove(sb.pts);
          E.sprayBursts.splice(sbi, 1);
        }
      }
    }
    E.drawCinemaVideoFrame(dt);
    E.updateDynamicEnvironment(dt);
    E.dropUnsupportedItems();

    // Ciclo de cultivo e umidade da Estufa
    for (var gi = 0; gi < E.greenhouseSlots.length; gi++) {
      var gSlot = E.greenhouseSlots[gi];
      gSlot.humidity = Math.max(20, gSlot.humidity - dt * 0.12);
      if (gSlot.humidity >= 60 && gSlot.stage < 3) {
        gSlot.growth += dt * (gSlot.humidity / 100) * 1.6;
        if (gSlot.growth >= 100) {
          gSlot.stage++;
          gSlot.growth = 0;
          E.updateGreenhouseSlotMesh(gSlot);
          E.queueWorldStateChange('greenhouse_slot_' + gSlot.id + '_stage', gSlot.stage);
        }
      }
    }
    E.stepGreenhouseParticles(dt);
    E.stepConfetti(dt);

    if (E.localEmoteTimer > 0) {
      E.localEmoteTimer -= dt;
      if (E.isWalking || E.localEmoteTimer <= 0) {
        E.localEmote = '';
        E.localEmoteTimer = 0;
      }
    }

    E.stepMultiplayerAvatars(dt);
    E.renderer.render(E.scene, E.camera);
  }

  window.initCampus3D = function (containerId, cbs) {
    E.callbacks = Object.assign(E.callbacks, cbs || {});
    var container = document.getElementById(containerId);
    E.scene = new THREE.Scene();
    E.scene.background = new THREE.Color(0x60a5fa);
    E.scene.fog = new THREE.FogExp2(0xbfdbfe, 0.0022);

    // Arco-iris sobre as montanhas (aparece ao cessar da chuva)
    E.rainbowMesh = E.createRainbowMesh();
    E.scene.add(E.rainbowMesh);

    // Sol 3D + Halo, Lua 3D, Estrelas e 24 Nuvens dinamicas no ceu
    E.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
    );
    E.sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(14.5, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    E.moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(5.5, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false })
    );
    E.scene.add(E.sunDisc, E.sunHalo, E.moonDisc);

    var starCount = 320;
    var starPos = new Float32Array(starCount * 3);
    for (var st = 0; st < starCount; st++) {
      var sTheta = Math.random() * Math.PI * 2;
      var sPhi = Math.random() * Math.PI * 0.44;
      starPos[st * 3] = Math.cos(sTheta) * Math.cos(sPhi) * 210;
      starPos[st * 3 + 1] = Math.sin(sPhi) * 210 + 18;
      starPos[st * 3 + 2] = Math.sin(sTheta) * Math.cos(sPhi) * 210;
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    E.starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf8fafc, size: 1.4, transparent: true, opacity: 0, fog: false }));
    E.scene.add(E.starPoints);

    E.envCloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, emissive: 0xe0f2fe, emissiveIntensity: 0.22 });
    for (var cl = 0; cl < 24; cl++) {
      var cg = new THREE.Group();
      var ca = (cl / 24) * Math.PI * 2;
      cg.position.set(Math.cos(ca) * (55 + (cl % 4) * 24), 30 + (cl % 5) * 4.5, Math.sin(ca) * (55 + (cl % 4) * 24));
      for (var cp = 0; cp < 3; cp++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(5 + (cp % 2) * 2.5, 10, 8), E.envCloudMat);
        puff.position.set((cp - 1) * 5.2, (cp % 2) * 1.4, 0);
        puff.scale.set(1.3, 0.65, 1.0);
        cg.add(puff);
      }
      E.scene.add(cg);
      E.envClouds.push(cg);
    }

    // Particulas dinamicas de Chuva / Neve
    var wCount = 800;
    var wPositions = new Float32Array(wCount * 3);
    for (var wi = 0; wi < wCount; wi++) {
      wPositions[wi * 3] = (Math.random() - 0.5) * 60;
      wPositions[wi * 3 + 1] = Math.random() * 28;
      wPositions[wi * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    var wGeo = new THREE.BufferGeometry();
    E.weatherPosAttr = new THREE.BufferAttribute(wPositions, 3);
    wGeo.setAttribute('position', E.weatherPosAttr);
    E.weatherPoints = new THREE.Points(wGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.78 }));
    E.weatherPoints.visible = false;
    E.weatherPoints.frustumCulled = false;
    E.scene.add(E.weatherPoints);

    var touch = E.isTouchDevice();
    E.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, touch ? 210 : 440);
    E.camera.position.set(-14, 16, 26);

    E.renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
    E.renderer.setSize(window.innerWidth, window.innerHeight);
    E.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.0 : 1.5));
    E.renderer.shadowMap.enabled = !touch;
    E.renderer.shadowMap.type = touch ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) {
      E.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Exposição equilibrada: suave e confortável no PC (0.95), nítida no Mobile (1.08)
      E.renderer.toneMappingExposure = touch ? 1.08 : 0.95;
    }
    container.innerHTML = '';
    container.appendChild(E.renderer.domElement);

    E.controls = new THREE.OrbitControls(E.camera, E.renderer.domElement);
    E.controls.enableDamping = true;
    E.controls.maxPolarAngle = Math.PI * 0.47;
    E.controls.minDistance = 4;
    E.controls.maxDistance = 65;
    E.controls.target.set(0, 4.5, -14);

    // Iluminação ambiente suave com rebatimento neutro (sem estouro de branco e sem tom escuro)
    var hemi = new THREE.HemisphereLight(0xe0f2fe, 0x334155, touch ? 0.90 : 0.72);
    E.scene.add(hemi);
    E.envHemi = hemi;
    var sun = new THREE.DirectionalLight(0xfffbeb, touch ? 1.05 : 0.95);
    sun.position.set(45, 65, 38);
    sun.castShadow = !touch;
    var shSize = touch ? 768 : 1536;
    sun.shadow.mapSize.set(shSize, shSize);
    sun.shadow.camera.left = -85;
    sun.shadow.camera.right = 85;
    sun.shadow.camera.top = 85;
    sun.shadow.camera.bottom = -85;
    sun.shadow.camera.far = 220;
    E.scene.add(sun);
    E.envSun = sun;

    E.clock = new THREE.Clock();
    E.createProceduralTextures();
    E.buildNatureWorld();
    E.buildPlaza();
    E.buildStaircaseAndBridge();
    E.buildClockTowerAndAuditorium();
    E.buildCampusWingsAndEquipment();
    E.buildOuterCampus();
    E.buildFirstPersonArm();
    E.localAvatar = E.buildCuteAvatar({ isLocal: true, hat_color: '#d9534f', body_color: '#4f46e5' });
    E.localAvatar.group.visible = false;
    E.createPlacementGhost();
    E.createThermoLaserFx();
    E.initConfettiSystem();
    E.initGreenhouseParticlePools();
    E.bindControls();
    E.animate();
  };

  window.setCampusFpsMode = function (enable) {
    E.lobbyTourActive = false;
    E.inFps = !!enable;
    E.controls.enabled = !E.inFps;
    if (!E.inFps && document.pointerLockElement) document.exitPointerLock();
    if (E.inFps) {
      E.camera.up.set(0, 1, 0);
      E.camera.rotation.order = 'YXZ';
      E.camera.rotation.z = 0;
      E.playerPos.y = E.getGroundHeight(E.playerPos.x, E.playerPos.z, E.playerPos.y);
    } else if (E.fpsArmGroup) {
      E.fpsArmGroup.visible = false;
    }
    if (E.callbacks.onFpsChange) E.callbacks.onFpsChange(E.inFps);
  };

  window.triggerCampusJump = function () {
    if (!E.inFps) return;
    if (E.seatedSeat) {
      E.seatedSeat = null;
      E.playerVelY = 6.2;
      E.onGround = false;
      return;
    }
    var now = performance.now();
    E.jumpBufferUntil = now + 150;
    if (E.onGround || (now - E.lastGroundedAt < 150 && E.playerVelY <= 0)) {
      E.playerVelY = 6.2;
      E.onGround = false;
      E.lastGroundedAt = 0;
      E.jumpBufferUntil = 0;
    }
  };

  window.setCampusJumpHeld = function (held) {
    E.jumpHeld = !!held;
    if (E.jumpHeld) window.triggerCampusJump();
  };

  window.setCampusSprint = function (active) {
    E.mobileSprint = !!active;
  };

  window.clearCampusKeys = function () {
    Object.keys(E.keys).forEach(function (k) { E.keys[k] = false; });
    E.isPrimaryDown = false;
    E.jumpHeld = false;
    E.flushCurrentStroke();
  };

  window.rotateCampusHeldItem = function (deltaRad) {
    if (E.heldItem) E.heldRotY += (typeof deltaRad === 'number' ? deltaRad : Math.PI / 4);
  };

  window.setCampusJoystick = function (dx, dy) {
    E.joyX = dx; E.joyY = dy;
  };

  window.getCampusPlayerPose = function () {
    return {
      x: E.playerPos.x, y: E.playerPos.y, z: E.playerPos.z,
      yaw: E.playerYaw, pitch: E.playerPitch,
      holding_item: E.heldItem ? E.heldItem.id : '',
      walking: E.isWalking, seated: !!E.seatedSeat, in_fps: E.inFps,
      current_hat: E.localHat,
      emote: E.localEmote
    };
  };

  window.playCampusEmote = function (name) {
    E.localEmote = name || '';
    E.localEmoteTimer = 4.5;
    if (window.MycoAudio) window.MycoAudio.playEmote(name);
    if (name === 'cheer') {
      E.triggerConfettiBurst(E.playerPos.x, E.playerPos.y, E.playerPos.z);
    }
  };

  window.setLocalAvatarHat = function (hatId) {
    E.localHat = hatId || 'default';
    if (E.localAvatar && E.localAvatar.hatGroup) {
      E.buildAvatarHat(E.localHat, E.localAvatar.hatMat, E.localAvatar.hatGroup);
      E.localAvatar.current_hat = E.localHat;
    }
  };

  window.consumeCampusMovedItems = function () {
    var list = Object.values(E.pendingMovedItems);
    E.pendingMovedItems = {};
    return list;
  };

  window.requeueCampusMovedItems = function (list) {
    (list || []).forEach(function (it) {
      if (it && it.id && !E.pendingMovedItems[it.id]) E.pendingMovedItems[it.id] = it;
    });
  };

  window.applyCampusWorldObjects = function (objectsMap) {
    if (!objectsMap) return;
    var now = performance.now();
    // 1o passo: atualiza mesas e fluxo laminar primeiro para que suas superficies de suporte estejam na posicao exata!
    E.pickableItems.forEach(function (item) {
      if (!item.mesh.userData.updateBounds) return;
      if (E.heldItem === item || E.isHeldByRemote(item.id)) return;
      if (E.pendingMovedItems[item.id]) return;
      if (E.recentlyDropped[item.id] > now) {
        var svCheck = objectsMap[item.id];
        if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
          delete E.recentlyDropped[item.id];
        } else if (E.recentlyDropped[item.id] - now < 3200) {
          // Servidor ainda esta com posicao antiga: reenvia posicao local para nao voltar pro chao!
          E.pendingMovedItems[item.id] = {
            id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
          };
        }
        return;
      }
      var saved = objectsMap[item.id];
      if (saved) {
        item.mesh.position.set(saved.x, saved.y, saved.z);
        item.mesh.rotation.y = saved.ry || 0;
        item.isMoved = true;
        item.mesh.userData.updateBounds(item);
      } else if (item.isMoved) {
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        item.mesh.userData.updateBounds(item);
        item.isMoved = false;
      }
    });
    // 2o passo: atualiza os demais itens e tampas de panela sem jamais causar salto/queda em loop ou desacoplar tampa em movimento
    E.pickableItems.forEach(function (item) {
      if (item.mesh.userData.updateBounds) return;
      if (E.heldItem === item || E.isHeldByRemote(item.id)) return;
      if (E.pendingMovedItems[item.id]) return;
      if (E.recentlyDropped[item.id] > now) {
        var svCheck = objectsMap[item.id];
        if (svCheck && Math.hypot(svCheck.x - item.mesh.position.x, svCheck.z - item.mesh.position.z) < 0.06 && Math.abs(svCheck.y - item.mesh.position.y) < 0.06) {
          delete E.recentlyDropped[item.id];
        } else if (E.recentlyDropped[item.id] - now < 3200) {
          // Servidor ainda esta com posicao antiga: reenvia posicao local para nao voltar pro chao!
          E.pendingMovedItems[item.id] = {
            id: item.id, x: item.mesh.position.x, y: item.mesh.position.y, z: item.mesh.position.z, ry: item.mesh.rotation.y
          };
        }
        return;
      }
      if (item.potItem && item.isAttached) {
        var pRef = item.potItem;
        if (E.heldItem === pRef || E.isHeldByRemote(pRef.id) || E.pendingMovedItems[pRef.id] || E.recentlyDropped[pRef.id] > now) {
          return;
        }
      }
      var saved = objectsMap[item.id];
      if (saved) {
        if (item.potItem) {
          var pot = item.potItem;
          var potSaved = objectsMap[pot.id];
          var refX = potSaved ? potSaved.x : pot.mesh.position.x;
          var refY = potSaved ? potSaved.y : pot.mesh.position.y;
          var refZ = potSaved ? potSaved.z : pot.mesh.position.z;
          var attached = Math.hypot(saved.x - refX, saved.z - refZ) < 0.28 &&
            Math.abs(saved.y - (refY + 0.36)) < 0.28;
          item.isAttached = attached;
          if (attached) {
            item.mesh.position.set(pot.mesh.position.x, pot.mesh.position.y + 0.36, pot.mesh.position.z);
            item.mesh.rotation.copy(pot.mesh.rotation);
            item.isMoved = true;
            return;
          }
        }
        var suppY = E.getGroundHeight(saved.x, saved.z, saved.y);
        for (var i = 0; i < E.supportSurfaces.length; i++) {
          var s = E.supportSurfaces[i];
          if (saved.x >= s.minX && saved.x <= s.maxX && saved.z >= s.minZ && saved.z <= s.maxZ && saved.y >= s.topY - 0.15) {
            suppY = Math.max(suppY, s.topY);
          }
        }
        var finalY = Math.abs(saved.y - suppY) < 0.06 ? suppY : saved.y;
        item.mesh.position.set(saved.x, finalY, saved.z);
        item.mesh.rotation.y = saved.ry || 0;
        item.isMoved = true;
      } else if (item.isMoved) {
        item.mesh.position.copy(item.homePos);
        item.mesh.rotation.y = item.homeRy;
        if (item.potItem) item.isAttached = true;
        item.isMoved = false;
      }
    });
  };

  window.resetCampusWorldObjects = function () {
    E.setHeldTwoHandedGhost(E.heldItem, false);
    E.heldItem = null;
    E.pendingMovedItems = {};
    E.pickableItems.forEach(function (item) {
      item.mesh.position.copy(item.homePos);
      item.mesh.rotation.y = item.homeRy;
      if (item.potItem) item.isAttached = true;
      if (item.mesh.userData.updateBounds) item.mesh.userData.updateBounds(item);
      item.isMoved = false;
    });
    if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(null);
  };

  window.consumeCampusBoardStrokes = function () {
    // Transmite os tracos da lousa em tempo real enquanto o jogador desenha (sem precisar esperar soltar o mouse!)
    if (E.currentStroke && E.currentStroke.pts.length >= 2) {
      var lastPt = E.currentStroke.pts[E.currentStroke.pts.length - 1];
      E.pendingBoardStrokes.push({
        b: E.currentStroke.b,
        c: E.currentStroke.c,
        pts: E.currentStroke.pts.slice()
      });
      E.currentStroke.pts = [lastPt];
    }
    var out = E.pendingBoardStrokes.slice();
    E.pendingBoardStrokes = [];
    return out;
  };

  window.requeueCampusBoardStrokes = function (strokes) {
    if (!Array.isArray(strokes) || !strokes.length) return;
    E.pendingBoardStrokes = strokes.concat(E.pendingBoardStrokes);
  };

  window.applyCampusBoardStrokes = function (strokes) {
    (strokes || []).forEach(E.applyStrokeToBoard);
  };

  window.consumeCampusStateChanges = function () {
    var out = Object.assign({}, E.pendingStateChanges);
    E.pendingStateChanges = {};
    return out;
  };

  window.requeueCampusStateChanges = function (changes) {
    if (!changes || typeof changes !== 'object') return;
    Object.keys(changes).forEach(function (k) {
      if (E.pendingStateChanges[k] === undefined) {
        E.pendingStateChanges[k] = changes[k];
      }
    });
  };

  window.applyCampusWorldState = function (stateMap, isInitial) {
    if (!stateMap || typeof stateMap !== 'object') return;
    var now = performance.now();

    // 1. Portas das salas (door_0..door_3)
    for (var di = 0; di < E.campusDoors.length; di++) {
      var d = E.campusDoors[di];
      if (!d.id || stateMap[d.id] === undefined) continue;
      if (E.pendingStateChanges[d.id] !== undefined || E.recentlyChangedState[d.id] > now) continue;
      var wantOpen = Number(stateMap[d.id]) === 1;
      if (d.open !== wantOpen) {
        d.open = wantOpen;
        if (isInitial) {
          d.angle = d.open ? -d.dir * Math.PI * 0.48 : 0;
          d.pivot.rotation.y = d.angle;
        }
      }
    }

    // 2. Persianas horizontais de todos os vidros (blind_0..blind_15)
    for (var bi = 0; bi < E.windowBlinds.length; bi++) {
      var b = E.windowBlinds[bi];
      if (!b.id || stateMap[b.id] === undefined) continue;
      if (E.pendingStateChanges[b.id] !== undefined || E.recentlyChangedState[b.id] > now) continue;
      var wantBlindOpen = Number(stateMap[b.id]) === 1;
      if (b.open !== wantBlindOpen) {
        b.open = wantBlindOpen;
      }
    }

    // 3. Interruptores de luz de todas as salas (light_0..light_7)
    for (var li = 0; li < E.campusLightSwitches.length; li++) {
      var sw = E.campusLightSwitches[li];
      if (!sw.id || stateMap[sw.id] === undefined) continue;
      if (E.pendingStateChanges[sw.id] !== undefined || E.recentlyChangedState[sw.id] > now) continue;
      var wantLightOn = Number(stateMap[sw.id]) !== 0;
      if (sw.on !== wantLightOn) {
        sw.on = wantLightOn;
        if (sw.light) {
          sw.light.visible = sw.on;
          sw.light.intensity = sw.on ? (E.isTouchDevice() ? 1.15 : 0.82) : 0;
        }
        if (sw.gLight) {
          sw.gLight.visible = sw.on;
          sw.gLight.intensity = sw.on ? 0.65 : 0;
        }
        if (sw.tubeMat) {
          sw.tubeMat.emissive.setHex(sw.on ? 0xfffbeb : 0x1e293b);
          sw.tubeMat.emissiveIntensity = sw.on ? 0.85 : 0.02;
        }
        if (sw.ledMat) {
          sw.ledMat.color.setHex(sw.on ? 0x22c55e : 0xef4444);
        }
        if (sw.rocker) {
          sw.rocker.rotation.x = sw.on ? -0.22 : 0.22;
        }
      }
    }

    // 4. Capela de Fluxo Laminar (hood_lab), Agitador Magnetico (stir_lab) e Fogareiro (burner_lab)
    if (E.hoodAirData && stateMap.hood_lab !== undefined) {
      if (E.pendingStateChanges.hood_lab === undefined && !(E.recentlyChangedState.hood_lab > now)) {
        var wantHoodOn = Number(stateMap.hood_lab) !== 0;
        if (E.hoodAirData.on !== wantHoodOn) {
          E.hoodAirData.on = wantHoodOn;
          E.hoodAirData.points.visible = E.hoodAirData.on;
          E.hoodAirData.hepaMat.emissiveIntensity = E.hoodAirData.on ? 0.45 : 0.04;
          E.hoodAirData.ledMat.color.setHex(E.hoodAirData.on ? 0x22c55e : 0xef4444);
          if (E.hoodAirData.workLight) {
            E.hoodAirData.workLight.visible = E.hoodAirData.on;
            E.hoodAirData.workLight.intensity = E.hoodAirData.on ? 0.95 : 0;
          }
        }
      }
    }
    if (E.stirrerDevices.length && stateMap.stir_lab !== undefined) {
      if (E.pendingStateChanges.stir_lab === undefined && !(E.recentlyChangedState.stir_lab > now)) {
        var wantStirOn = Number(stateMap.stir_lab) === 1;
        var st0 = E.stirrerDevices[0];
        if (st0.on !== wantStirOn) {
          st0.on = wantStirOn;
          st0.ledMat.color.setHex(st0.on ? 0x22c55e : 0xef4444);
        }
      }
    }
    if (E.burnerDevices.length && stateMap.burner_lab !== undefined) {
      if (E.pendingStateChanges.burner_lab === undefined && !(E.recentlyChangedState.burner_lab > now)) {
        var wantBurnerOn = Number(stateMap.burner_lab) === 1;
        var bn0 = E.burnerDevices[0];
        if (bn0.on !== wantBurnerOn) {
          bn0.on = wantBurnerOn;
          bn0.ledMat.color.setHex(bn0.on ? 0x22c55e : 0xef4444);
          if (bn0.knobGroup) bn0.knobGroup.rotation.z = bn0.on ? -1.45 : 0;
        }
      }
    }

    // 5. Tela de Cinema / Aulas do Student Center (cinema_power, cinema_lesson, cinema_playing)
    var cinemaChanged = false;
    if (stateMap.cinema_power !== undefined && E.pendingStateChanges.cinema_power === undefined && !(E.recentlyChangedState.cinema_power > now)) {
      var wantPower = Number(stateMap.cinema_power) === 1;
      if (E.cinemaPower !== wantPower) {
        E.cinemaPower = wantPower;
        cinemaChanged = true;
      }
    }
    if (stateMap.cinema_lesson !== undefined && E.pendingStateChanges.cinema_lesson === undefined && !(E.recentlyChangedState.cinema_lesson > now)) {
      var wantLes = parseInt(stateMap.cinema_lesson, 10);
      if (!isNaN(wantLes) && E.cinemaLessonIdx !== wantLes) {
        E.cinemaLessonIdx = wantLes;
        E.cinemaTime = 0;
        cinemaChanged = true;
      }
    }
    if (stateMap.cinema_playing !== undefined && E.pendingStateChanges.cinema_playing === undefined && !(E.recentlyChangedState.cinema_playing > now)) {
      var wantPlay = Number(stateMap.cinema_playing) === 1;
      if (E.cinemaPlaying !== wantPlay) {
        E.cinemaPlaying = wantPlay;
        cinemaChanged = true;
      }
    }
    if (cinemaChanged) {
      E.cinemaDirty = true;
      if (E.cinemaBeam) E.cinemaBeam.visible = E.cinemaPower && (E.cinemaLessonIdx === -1 || E.cinemaPlaying);
    }

    // 6. Cogumelos silvestres colhidos (wild_0..wild_31)
    // No servidor: '1' = ativo/disponível no mapa (pronto para colher); '0' = colhido (em cooldown)
    for (var mi = 0; mi < E.wildMushrooms.length; mi++) {
      var wm = E.wildMushrooms[mi];
      if (!wm.id || stateMap[wm.id] === undefined) continue;
      if (E.pendingStateChanges[wm.id] !== undefined || E.recentlyChangedState[wm.id] > now) continue;
      var isAvailable = Number(stateMap[wm.id]) === 1;
      if (isAvailable && !wm.active) {
        wm.active = true;
        wm.group.visible = true;
        wm.respawnAt = 0;
      } else if (!isAvailable && wm.active) {
        wm.active = false;
        wm.group.visible = false;
        wm.respawnAt = now + 20000;
      }
    }

    // 7. Bancada de Cultivo da Estufa (greenhouse_slot_0..3)
    for (var gi = 0; gi < E.greenhouseSlots.length; gi++) {
      var slot = E.greenhouseSlots[gi];
      var kStage = 'greenhouse_slot_' + slot.id + '_stage';
      var kHum = 'greenhouse_slot_' + slot.id + '_humidity';
      if (stateMap[kStage] !== undefined && E.pendingStateChanges[kStage] === undefined && !(E.recentlyChangedState[kStage] > now)) {
        var newStage = parseInt(stateMap[kStage], 10);
        if (slot.stage !== newStage) {
          slot.stage = newStage;
          E.updateGreenhouseSlotMesh(slot);
        }
      }
      if (stateMap[kHum] !== undefined && E.pendingStateChanges[kHum] === undefined && !(E.recentlyChangedState[kHum] > now)) {
        var newHum = parseFloat(stateMap[kHum]);
        if (Math.abs(slot.humidity - newHum) > 5) {
          slot.humidity = newHum;
          E.updateGreenhouseSlotMesh(slot);
        }
      }
    }
  };

  window.applyCampusSavedPose = function (pose) {
    if (!pose || typeof pose !== 'object') return;
    if (typeof pose.x === 'number' && typeof pose.z === 'number') {
      E.playerPos.set(pose.x, typeof pose.y === 'number' ? pose.y : 0, pose.z);
    }
    if (typeof pose.yaw === 'number') E.playerYaw = pose.yaw;
    if (typeof pose.pitch === 'number') E.playerPitch = pose.pitch;
    if (pose.seated) {
      var bestSeat = null, bestD = 1.6;
      for (var i = 0; i < E.seatMeshes.length; i++) {
        var si = E.seatMeshes[i].userData.seatInfo;
        if (!si) continue;
        var d = Math.hypot(si.x - E.playerPos.x, si.z - E.playerPos.z);
        if (d < bestD && Math.abs(si.y - E.playerPos.y) < 1.0) {
          bestD = d;
          bestSeat = si;
        }
      }
      if (bestSeat) {
        E.seatedSeat = bestSeat;
        E.playerPos.set(bestSeat.x, bestSeat.y, bestSeat.z);
      }
    }
    if (pose.holding && !E.heldItem) {
      var item = E.findPickable(pose.holding);
      if (item && !E.isHeldByRemote(item.id)) {
        if (item.potItem && item.isAttached) {
          item.isAttached = false;
        }
        E.heldItem = item;
        E.heldRotY = item.mesh.rotation.y;
        E.setHeldTwoHandedGhost(E.heldItem, true);
        if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(E.heldItem.label);
      }
    }
  };

  window.setCampusPlayerColors = function (hatHex, bodyHex) {
    if (E.fpsSleeveMat && bodyHex) {
      E.fpsSleeveMat.color.set(bodyHex);
    }
    if (E.localAvatar) {
      if (hatHex && E.localAvatar.hatMat) E.localAvatar.hatMat.color.set(hatHex);
      if (bodyHex && E.localAvatar.bodyMat) E.localAvatar.bodyMat.color.set(bodyHex);
    }
  };

  window.rotateCampusCamera = function (dx, dy) {
    if (E.lobbyTourActive) return;
    if (E.inFps) {
      E.playerYaw -= dx * 0.0080;
      E.playerPitch = Math.max(-1.35, Math.min(1.35, E.playerPitch - dy * 0.0080));
    }
  };

  window.setCampusMobilePrimary = function (down) {
    if (E.lobbyTourActive) return;
    E.isPrimaryDown = !!down;
    if (down) {
      E.pointerNdc.set(0, 0);
      E.updateHoverRay();
      E.handlePrimaryAction();
    } else {
      E.flushCurrentStroke();
    }
  };

  window.updateCampusRanking = function (list) {
    E.rankingList = Array.isArray(list) ? list : [];
    E.drawRankingBoard();
  };

  window.setCampusCinemaLessons = function (list) {
    E.cinemaLessons = Array.isArray(list) ? list : [];
    E.cinemaDirty = true;
  };

  window.teleportCampusPlayer = function (x, y, z, yaw) {
    if (typeof x !== 'number' || typeof z !== 'number') return;
    if (E.seatedSeat) E.seatedSeat = null;
    E.playerVelY = 0;
    var targetY = (typeof y === 'number' && !isNaN(y)) ? y : E.getGroundHeight(x, z, E.playerPos.y);
    E.playerPos.set(x, targetY, z);
    if (typeof yaw === 'number' && !isNaN(yaw)) {
      E.playerYaw = yaw;
      if (E.controls && E.controls.target) E.controls.target.set(x, targetY + 1.2, z);
    }
    (window.MycoAudio && window.MycoAudio.playSwitch());
  };

  window.getCampusPlayerPos = function () {
    return { x: E.playerPos.x, y: E.playerPos.y, z: E.playerPos.z, yaw: E.playerYaw };
  };

  window.updateCampusAuditoriumSlide = E.updateCampusAuditoriumSlide;
  window.updateCampusPlayers = E.updateCampusPlayers;
  window.triggerCampusRainbow = E.triggerCampusRainbow;
  window.dropCampusHeldItem = E.dropHeldItem;

  // Namespace unificado MycoCampus para arquitetura limpa e escalabilidade
  window.MycoCampus = window.MycoCampus || {};
  window.MycoCampus.teleportPlayer = window.teleportCampusPlayer;
  window.MycoCampus.getPlayerPos = window.getCampusPlayerPos;
  window.MycoCampus.updateRanking = window.updateCampusRanking;
  window.MycoCampus.updateSlide = E.updateCampusAuditoriumSlide;
  window.MycoCampus.updatePlayers = E.updateCampusPlayers;
  window.MycoCampus.setColors = window.setCampusPlayerColors;
  window.MycoCampus.setFpsMode = window.setCampusFpsMode;
  window.MycoCampus.triggerRainbow = E.triggerCampusRainbow;
  window.MycoCampus.dropHeldItem = E.dropHeldItem;
})();