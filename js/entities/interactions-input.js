/**
 * MycoCampus 3D — Raycast Hover, Placement Ghost, Infrared Thermo, Syringe & Input Controls
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.placementRing = null;
  E.placementDot = null;
  E.placementHoloWrap = null;
  E.placementHoloMats = [];
  E.placementGhostItemId = null;
  E.placementGhostHasLid = false;
  E.placementGhostLastValid = null;

  E._cGhostGreenTint = new THREE.Color(0x22c55e); // Verde vivo esmeralda
  E._cGhostGreenEmi = new THREE.Color(0x10b981); // Brilho verde neon
  E._cGhostRedTint = new THREE.Color(0xef4444); // Vermelho vibrante
  E._cGhostRedEmi = new THREE.Color(0xdc2626); // Brilho vermelho neon

  E.createPlacementGhost = function () {
    E.placementGhost = new THREE.Group();
    E.placementRing = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.142, 48),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
    );
    E.placementRing.rotation.x = -Math.PI / 2;
    E.placementRing.position.y = 0.008;
    E.placementGhost.add(E.placementRing);

    E.placementDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.024, 24),
      new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    E.placementDot.rotation.x = -Math.PI / 2;
    E.placementDot.position.y = 0.009;
    E.placementGhost.add(E.placementDot);

    E.placementHoloWrap = new THREE.Group();
    E.placementGhost.add(E.placementHoloWrap);

    E.placementGhost.visible = false;
    E.scene.add(E.placementGhost);
  }

  E.initThermoDisplay = function () {
    E.thermoCanvas = document.createElement('canvas');
    E.thermoCanvas.width = 128;
    E.thermoCanvas.height = 128;
    E.thermoCtx = E.thermoCanvas.getContext('2d');
    E.thermoTex = new THREE.CanvasTexture(E.thermoCanvas);
    E.drawThermoScreen(24.0, 'HOLD');
  }

  E.lastDrawnTempStr = '';
  E.lastDrawnMode = '';
  E.drawThermoScreen = function (tempVal, modeStr, force) {
    if (!E.thermoCtx || !E.thermoTex) return;
    var tStr = (typeof tempVal === 'number' ? tempVal.toFixed(1) : '24.0') + '°C';
    var mStr = modeStr || 'SCAN';
    if (!force && tStr === E.lastDrawnTempStr && mStr === E.lastDrawnMode) return;
    E.lastDrawnTempStr = tStr;
    E.lastDrawnMode = mStr;
    var ctx = E.thermoCtx;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(mStr, 10, 22);

    ctx.textAlign = 'right';
    ctx.fillText('⚡ 🔋', 118, 22);

    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tStr, 64, 68);

    ctx.font = 'bold 11px monospace';
    ctx.fillText('ε=0.95  MAX 380°', 64, 98);
    ctx.font = '9px monospace';
    ctx.fillText('INFRARED TEMP', 64, 114);

    E.thermoTex.needsUpdate = true;
  }

  E.createThermoLaserFx = function () {
    var lineGeo = new THREE.BufferGeometry();
    var linePos = new Float32Array(6);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    E.thermoLaserLine = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xff0033, transparent: true, opacity: 0.88, linewidth: 2, depthWrite: false })
    );
    E.thermoLaserLine.visible = false;
    E.scene.add(E.thermoLaserLine);

    var dotGeo = new THREE.CircleGeometry(0.016, 16);
    var dotMat = new THREE.MeshBasicMaterial({
      color: 0xff1133,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    E.thermoLaserDot = new THREE.Mesh(dotGeo, dotMat);
    E.thermoLaserDot.visible = false;
    E.scene.add(E.thermoLaserDot);
  }

  E.prepareGhostCloneMesh = function (rootGroup, matList) {
    rootGroup.traverse(function (ch) {
      ch.userData.ignoreRay = true;
      ch.userData.supportSurface = null;
      ch.userData.dynamicSurface = null;
      ch.userData.burnerSwitch = null;
      ch.userData.stirSwitch = null;
      ch.userData.hoodSwitch = null;
      ch.userData.scaleObj = null;
      ch.userData.isTable = false;
      ch.userData.isHood = false;
      ch.userData.isBurner = false;
      ch.userData.isStirrer = false;
      if (ch.isPoints) {
        ch.visible = false;
        return;
      }
      if (ch.isMesh && ch.material) {
        ch.castShadow = false;
        ch.receiveShadow = false;
        var cloneOneMat = function (origM) {
          var m = origM.clone();
          m.userData._baseColor = m.color ? m.color.clone() : new THREE.Color(0xffffff);
          m.transparent = true;
          var origOp = origM.transparent ? origM.opacity : 1.0;
          m.opacity = origM.transparent ? Math.max(0.38, origOp * 0.90) : 0.76;
          m.depthWrite = false;
          matList.push(m);
          return m;
        };
        if (Array.isArray(ch.material)) {
          ch.material = ch.material.map(cloneOneMat);
        } else {
          ch.material = cloneOneMat(ch.material);
        }
      }
    });
  }

  E.updatePlacementGhostVisual = function (item, isValid, rotY) {
    if (!E.placementGhost || !item) return;
    var hasLid = !!(item.lidItem && item.lidItem.isAttached);
    if (E.placementGhostItemId !== item.id || E.placementGhostHasLid !== hasLid) {
      while (E.placementHoloWrap.children.length > 0) {
        E.placementHoloWrap.remove(E.placementHoloWrap.children[0]);
      }
      E.placementHoloMats = [];
      var clone = item.mesh.clone(true);
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.visible = true;
      E.prepareGhostCloneMesh(clone, E.placementHoloMats);
      E.placementHoloWrap.add(clone);

      if (hasLid && item.lidItem && item.lidItem.mesh) {
        var lidClone = item.lidItem.mesh.clone(true);
        lidClone.position.set(0, 0.36, 0);
        lidClone.rotation.set(0, 0, 0);
        lidClone.visible = true;
        E.prepareGhostCloneMesh(lidClone, E.placementHoloMats);
        E.placementHoloWrap.add(lidClone);
      }

      E.placementGhostItemId = item.id;
      E.placementGhostHasLid = hasLid;
      E.placementGhostLastValid = null;
    }
    var col = isValid ? 0x10b981 : 0xef4444;
    E.placementRing.material.color.setHex(col);
    E.placementDot.material.color.setHex(col);

    var tintCol = isValid ? _cGhostGreenTint : E._cGhostRedTint;
    var emiCol = isValid ? _cGhostGreenEmi : E._cGhostRedEmi;
    var tintRatio = isValid ? 0.74 : 0.82; // Efeito verde/vermelho bem evidente e vivo
    var pulse = 0.52 + Math.sin(E.clock.elapsedTime * 6.0) * 0.16;

    if (E.placementGhostLastValid !== isValid) {
      E.placementGhostLastValid = isValid;
      for (var i = 0; i < E.placementHoloMats.length; i++) {
        var m = E.placementHoloMats[i];
        if (m.color && m.userData._baseColor) {
          m.color.copy(m.userData._baseColor).lerp(tintCol, tintRatio);
        }
        if (m.emissive) {
          m.emissive.copy(emiCol);
        }
      }
    }

    // Pulso holográfico suave e contínuo no brilho
    for (var j = 0; j < E.placementHoloMats.length; j++) {
      if (E.placementHoloMats[j].emissive) {
        E.placementHoloMats[j].emissiveIntensity = pulse;
      }
    }

    E.placementHoloWrap.rotation.y = rotY;
    var ringPulse = 1 + Math.sin(E.clock.elapsedTime * 6.0) * 0.06;
    E.placementRing.scale.set(ringPulse, ringPulse, 1);
  }

  E.findPlacementTarget = function (customNdc) {
    E.snapClosePot = null;
    E.snapPetriStack = false;
    var rayNdc = customNdc || (E.inFps ? new THREE.Vector2(0, 0) : E.pointerNdc);
    E.raycaster.setFromCamera(rayNdc, E.camera);
    var dir = E.raycaster.ray.direction;
    var origin = E.raycaster.ray.origin;
    var bestPt = null;
    var bestT = Infinity;

    // 0. Se estiver segurando uma Tampa de Panela e mirar na Panela aberta (ou na boca dela), encaixa para fechar!
    if (E.heldItem && E.heldItem.potItem) {
      for (var cpi = 0; cpi < E.cookerPots.length; cpi++) {
        var cp = E.cookerPots[cpi];
        var targetPot = cp.potItem;
        if (targetPot.lidItem && targetPot.lidItem.isAttached && targetPot.lidItem !== E.heldItem) continue;
        var potCenter = new THREE.Vector3(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.24, targetPot.mesh.position.z);
        var camDist = origin.distanceTo(potCenter);
        var potHits = E.raycaster.intersectObject(targetPot.mesh, true);
        if ((potHits.length > 0 && potHits[0].distance < 4.5) || (camDist < 4.5 && E.raycaster.ray.distanceSqToPoint(potCenter) < 0.25)) {
          E.snapClosePot = targetPot;
          E.heldRotY = targetPot.mesh.rotation.y;
          return new THREE.Vector3(targetPot.mesh.position.x, targetPot.mesh.position.y + 0.36, targetPot.mesh.position.z);
        }
      }
    }

    // 0b. Se estiver segurando uma Placa de Petri e mirar em outra Placa de Petri (pilha max 7 placas!)
    if (E.heldItem && E.heldItem.mesh && E.heldItem.mesh.userData.isPetri) {
      var petriBest = null;
      var petriDist = 4.2;
      for (var pi = 0; pi < E.pickableItems.length; pi++) {
        var cand = E.pickableItems[pi];
        if (!cand || cand === E.heldItem || !cand.mesh || !cand.mesh.userData.isPetri) continue;
        if (E.isHeldByRemote(cand.id)) continue;
        var cp = cand.mesh.position;
        var cTop = new THREE.Vector3(cp.x, cp.y + 0.03, cp.z);
        var dCam = origin.distanceTo(cTop);
        if (dCam < petriDist && E.raycaster.ray.distanceSqToPoint(cTop) < 0.036) {
          petriDist = dCam;
          petriBest = cand;
        }
      }
      if (petriBest) {
        var bx = petriBest.mesh.position.x;
        var bz = petriBest.mesh.position.z;
        var stackCount = 0;
        var maxY = petriBest.mesh.position.y;
        for (var pj = 0; pj < E.pickableItems.length; pj++) {
          var pOther = E.pickableItems[pj];
          if (!pOther || pOther === E.heldItem || !pOther.mesh || !pOther.mesh.userData.isPetri) continue;
          if (Math.hypot(pOther.mesh.position.x - bx, pOther.mesh.position.z - bz) < 0.10) {
            stackCount++;
            if (pOther.mesh.position.y > maxY) maxY = pOther.mesh.position.y;
          }
        }
        if (stackCount < 7) {
          E.snapPetriStack = true;
          return new THREE.Vector3(bx, maxY + 0.055, bz);
        }
      }
    }

    // 1. Raycast direto nas meshes de prateleiras, bancadas e mesas (evita atravessar prateleiras de cima!)
    if (E.supportMeshes.length) {
      var sHits = E.raycaster.intersectObjects(E.supportMeshes, false);
      for (var si = 0; si < sHits.length; si++) {
        var sh = sHits[si];
        if (sh.distance < 0.02 || sh.distance > 5.5) continue;
        if (sh.object.userData.ignoreRay) continue;
        var sSurf = sh.object.userData.supportSurface;
        if (!sSurf) continue;
        if (E.heldItem && E.heldItem.mesh) {
          if (E.heldItem.mesh.userData.dynamicSurface === sSurf) continue;
          if (E.heldItem.mesh === sh.object || E.heldItem.mesh.getObjectById(sh.object.id)) continue;
        }
        var cx = Math.max(sSurf.minX + 0.02, Math.min(sSurf.maxX - 0.02, sh.point.x));
        var cz = Math.max(sSurf.minZ + 0.02, Math.min(sSurf.maxZ - 0.02, sh.point.z));
        return new THREE.Vector3(cx, sSurf.topY, cz);
      }
    }

    // 1b. Fallback plano matematico para superficies sem mesh associada
    if (dir.y < -0.005) {
      for (var i = 0; i < E.supportSurfaces.length; i++) {
        var s = E.supportSurfaces[i];
        if (E.heldItem && E.heldItem.mesh && E.heldItem.mesh.userData.dynamicSurface === s) continue;
        var tPlane = (s.topY - origin.y) / dir.y;
        if (tPlane >= 0.08 && tPlane <= 5.5 && tPlane < bestT) {
          var hx = origin.x + dir.x * tPlane;
          var hz = origin.z + dir.z * tPlane;
          if (hx >= s.minX - 0.05 && hx <= s.maxX + 0.05 && hz >= s.minZ - 0.05 && hz <= s.maxZ + 0.05) {
            var cx = Math.max(s.minX + 0.02, Math.min(s.maxX - 0.02, hx));
            var cz = Math.max(s.minZ + 0.02, Math.min(s.maxZ - 0.02, hz));
            bestT = tPlane;
            bestPt = new THREE.Vector3(cx, s.topY, cz);
          }
        }
      }
    }
    if (bestPt) return bestPt;

    // 2. Intersecao fina com piso / terreno / escadas ao longo da mira
    for (var t = 0.45; t <= 5.0; t += 0.08) {
      var px = origin.x + dir.x * t;
      var py = origin.y + dir.y * t;
      var pz = origin.z + dir.z * t;
      var gh = E.getGroundHeight(px, pz, E.playerPos.y);
      if (py <= gh + 0.04) {
        return new THREE.Vector3(px, gh, pz);
      }
    }

    // 3. Fallback suave seguindo a direcao exata do mouse/mira (mesmo olhando para parede/canto)
    var hLen = Math.hypot(dir.x, dir.z) || 1;
    var fx = E.playerPos.x + (dir.x / hLen) * 1.8;
    var fz = E.playerPos.z + (dir.z / hLen) * 1.8;
    return new THREE.Vector3(fx, E.getGroundHeight(fx, fz, E.playerPos.y), fz);
  }

  E.placementBlockedReason = '';
  E.isPlacementBlocked = function (pt) {
    E.placementBlockedReason = '';
    if (!E.heldItem || !E.heldItem.mesh) return false;
    if (E.snapClosePot || E.snapPetriStack) return false;

    // Altura e limites verticais do item sendo segurado
    var heldH = E.heldItem.height || (E.heldItem.mesh.userData.tableDims ? E.heldItem.mesh.userData.tableDims.h : 0.32);
    var heldMinY = pt.y;
    var heldMaxY = pt.y + heldH;

    // Dimensões horizontais do item segurado
    var heldIsBox = !!(E.heldItem.mesh.userData.tableDims);
    var heldHw = 0, heldHd = 0, heldRad = 0;
    if (heldIsBox) {
      var dims = E.heldItem.mesh.userData.tableDims;
      var cRot = Math.abs(Math.cos(E.heldRotY)), sRot = Math.abs(Math.sin(E.heldRotY));
      heldHw = (dims.w * cRot + dims.d * sRot) * 0.5;
      heldHd = (dims.w * sRot + dims.d * cRot) * 0.5;
      heldRad = Math.max(heldHw, heldHd);
    } else {
      heldRad = E.heldItem.radius || 0.16;
      heldHw = heldRad;
      heldHd = heldRad;
    }

    // 1. CHECAGEM DE COLISÃO COM TODOS OS ITENS EXISTENTES NO MUNDO
    // Impede colocar qualquer item por dentro de outro item!
    for (var k = 0; k < E.pickableItems.length; k++) {
      var other = E.pickableItems[k];
      if (!other || !other.mesh) continue;
      if (other === E.heldItem) continue;
      if (E.heldItem.lidItem && other === E.heldItem.lidItem) continue;
      if (E.heldItem.potItem && other === E.heldItem.potItem) continue;
      if (other.isAttached && other.potItem) continue; // Tampa acoplada na panela é coberta pelo corpo da panela
      if (E.isHeldByRemote(other.id)) continue; // Item sendo carregado no ar por outro jogador

      var oPos = other.mesh.position;
      var otherH = other.height || (other.mesh.userData.tableDims ? other.mesh.userData.tableDims.h : 0.32);
      var otherMinY = oPos.y;
      var otherMaxY = oPos.y + otherH;

      // Se o 'other' for um suporte/mesa/equipamento com superfície dinâmica no topo
      if (other.mesh.userData.dynamicSurface) {
        var dynSurf = other.mesh.userData.dynamicSurface;
        // O jogador está colocando o item EM CIMA da superfície deste equipamento/mesa?
        if (pt.y >= dynSurf.topY - 0.04) {
          // Impedir colocar uma mesa em cima de outra mesa ou capela
          if (other.mesh.userData.isTable && (E.heldItem.mesh.userData.isTable || E.heldItem.mesh.userData.isHood)) {
            E.placementBlockedReason = '🚫 Não é permitido sobrepor mesas/capelas';
            return true;
          }
          if (other.mesh.userData.isHood && E.heldItem.mesh.userData.isTable) {
            E.placementBlockedReason = '🚫 Não cabe aqui';
            return true;
          }
          // Está apoiado sobre a superfície: o suporte em si não bloqueia
          // (mas qualquer outro objeto já em cima desse suporte será checado nas próximas iterações!)
          continue;
        }
      }

      // Verificação de sobreposição vertical:
      // Se não há interseção na faixa de altura (ex: prateleira superior vs inferior, ou chão vs mesa alta)
      if (heldMinY >= otherMaxY - 0.02 || heldMaxY <= otherMinY + 0.02) {
        continue;
      }

      // Verificação de sobreposição horizontal (X e Z):
      if (!heldIsBox && !other.mesh.userData.tableDims) {
        // Dois objetos radiais/cilíndricos (vidros, potes, béqueres, bags, seringas, etc.)
        var oRad = other.radius || 0.16;
        var minDist = (heldRad + oRad) * 0.94; // Permite toque encostado mas bloqueia penetração
        var dx = pt.x - oPos.x;
        var dz = pt.z - oPos.z;
        if (dx * dx + dz * dz < minDist * minDist) {
          E.placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
          return true; // BLOQUEADO: Tentando colocar item por dentro de outro item!
        }
      } else {
        // Pelo menos um dos objetos é retangular/caixa (mesas, fogareiro, balança, capela)
        var oHw, oHd;
        if (other.mesh.userData.tableDims) {
          var od = other.mesh.userData.tableDims;
          var oc = Math.abs(Math.cos(other.mesh.rotation.y)), os = Math.abs(Math.sin(other.mesh.rotation.y));
          oHw = (od.w * oc + od.d * os) * 0.5;
          oHd = (od.w * os + od.d * oc) * 0.5;
        } else {
          var oR = other.radius || 0.16;
          oHw = oR * 0.90;
          oHd = oR * 0.90;
        }
        var cW = (heldHw + oHw) * 0.93;
        var cD = (heldHd + oHd) * 0.93;
        if (Math.abs(pt.x - oPos.x) < cW && Math.abs(pt.z - oPos.z) < cD) {
          E.placementBlockedReason = '🚫 Espaço ocupado por outro objeto';
          return true; // BLOQUEADO: Colisão de caixa com objeto!
        }
      }
    }

    // 2. CHECAGEM DE COLISÃO COM PAREDES
    if (pt.y > 3.2) return false;
    for (var wIdx = 0; wIdx < E.wallSegments.length; wIdx++) {
      var w = E.wallSegments[wIdx];
      var vx = w.x2 - w.x1, vz = w.z2 - w.z1;
      var len2 = vx * vx + vz * vz;
      var t = Math.max(0, Math.min(1, ((pt.x - w.x1) * vx + (pt.z - w.z1) * vz) / len2));
      var dist = Math.hypot(pt.x - (w.x1 + t * vx), pt.z - (w.z1 + t * vz));
      var minWallDist = Math.max(0.16, heldRad * 0.82);
      if (dist < minWallDist) {
        E.placementBlockedReason = '🚫 Muito próximo da parede';
        return true;
      }
    }

    return false;
  }

  E.setMeshGhostOpacity = function (root, active) {
    if (!root) return;
    root.traverse(function (ch) {
      if (!ch.isMesh || !ch.material) return;
      var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      mats.forEach(function (m) {
        if (active) {
          if (!m.userData._origHeld) {
            m.userData._origHeld = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite };
          }
          m.transparent = true;
          m.opacity = 0.14;
          m.depthWrite = false;
        } else if (m.userData._origHeld) {
          m.transparent = m.userData._origHeld.transparent;
          m.opacity = m.userData._origHeld.opacity;
          m.depthWrite = m.userData._origHeld.depthWrite;
        }
      });
    });
  }

  E.setHeldTwoHandedGhost = function (item, active) {
    if (!item || !item.mesh || !item.mesh.userData.twoHanded) return;
    // Objetos grandes (2 maos: Fluxo Laminar, Mesas Inox, Panelas de Pressao) ficam 100% invisiveis nas maos,
    // mostrando apenas o fantasma texturizado verde/vermelho no local onde sera solto!
    item.mesh.visible = !active;
    if (item.lidItem) {
      if (active && item.lidItem.isAttached) {
        item.lidItem.mesh.visible = false;
      } else if (!active) {
        item.lidItem.mesh.visible = true;
      }
    }
  }

  E.dropHeldItem = function () {
    if (!E.heldItem) return;
    var rayNdc = E.inFps ? new THREE.Vector2(0, 0) : E.pointerNdc;
    var pt = E.findPlacementTarget(rayNdc);
    if (E.isPlacementBlocked(pt)) {
      var fwdX = -Math.sin(E.playerYaw), fwdZ = -Math.cos(E.playerYaw);
      var altPt = new THREE.Vector3(E.playerPos.x + fwdX * 0.85, E.getGroundHeight(E.playerPos.x + fwdX * 0.85, E.playerPos.z + fwdZ * 0.85, E.playerPos.y), E.playerPos.z + fwdZ * 0.85);
      if (!E.isPlacementBlocked(altPt)) pt = altPt;
    }
    E.heldItem.mesh.position.copy(pt);
    E.heldItem.mesh.rotation.set(0, E.heldRotY, 0);
    E.heldItem.isMoved = true;
    if (E.heldItem.mesh.userData.updateBounds) E.heldItem.mesh.userData.updateBounds(E.heldItem);
    E.pendingMovedItems[E.heldItem.id] = {
      id: E.heldItem.id, x: E.heldItem.mesh.position.x, y: E.heldItem.mesh.position.y, z: E.heldItem.mesh.position.z, ry: E.heldItem.mesh.rotation.y
    };
    E.recentlyDropped[E.heldItem.id] = performance.now() + 5000;
    E.setHeldTwoHandedGhost(E.heldItem, false);
    E.heldItem = null;
    if (E.placementGhost) E.placementGhost.visible = false;
    if (E.thermoLaserLine) E.thermoLaserLine.visible = false;
    if (E.thermoLaserDot) E.thermoLaserDot.visible = false;
    if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(null);
    E.notifyWorldAction();
  }

  E.lastPickupAt = 0;
  E.handlePrimaryAction = function () {
    if (E.heldItem) {
      if (performance.now() - E.lastPickupAt < 140) return;
      // Se estiver segurando o termômetro laser:
      // O clique aciona o gatilho da pistola de medição com bipe sonoro (não solta no chão)
      if (E.heldItem.mesh && E.heldItem.mesh.userData.isThermometer) {
        if (window.MycoAudio && window.MycoAudio.playLaserBeep) {
          window.MycoAudio.playLaserBeep();
        }
        E.drawThermoScreen(E.thermoCurrentTemp, 'HOLD', true);
        return;
      }
      // Se estiver perto da lousa com giz ou apagador, o clique desenha/apaga no ponto em vez de soltar
      if (E.hoveredBoardHit && E.getHeldBoardToolColor()) {
        var boardToolCol = E.getHeldBoardToolColor();
        var brd = E.chalkboards[E.hoveredBoardIndex];
        if (boardToolCol && brd && E.hoveredBoardHit.uv) {
          var tapPx = Math.round(E.hoveredBoardHit.uv.x * 512 * 10) / 10;
          var tapPy = Math.round((1 - E.hoveredBoardHit.uv.y) * 256 * 10) / 10;
          var tapPt = [tapPx, tapPy];
          E.drawBoardSegment(brd.ctx, boardToolCol, tapPt, tapPt);
          brd.tex.needsUpdate = true;
          E.pendingBoardStrokes.push({
            b: E.hoveredBoardIndex,
            c: boardToolCol,
            pts: [tapPt, [tapPt[0] + 0.1, tapPt[1]]]
          });
        }
        return;
      }
      if (E.hoveredPotInsert && E.heldItem && !E.heldItem.mesh.userData.twoHanded) {
        var potP = E.hoveredPotInsert.potItem.mesh.position;
        var slotIdx = E.hoveredPotInsert.contents.length;
        var ox = (slotIdx % 2 === 0 ? -0.06 : 0.06);
        var oz = (slotIdx < 2 ? -0.05 : 0.05);
        E.heldItem.mesh.position.set(potP.x + ox, potP.y + 0.045, potP.z + oz);
        E.heldItem.mesh.rotation.set(0, E.heldRotY, 0);
        E.heldItem.isMoved = true;
        if (E.hoveredPotInsert.contents.indexOf(E.heldItem) === -1) E.hoveredPotInsert.contents.push(E.heldItem);
        E.pendingMovedItems[E.heldItem.id] = {
          id: E.heldItem.id, x: E.heldItem.mesh.position.x, y: E.heldItem.mesh.position.y, z: E.heldItem.mesh.position.z, ry: E.heldItem.mesh.rotation.y
        };
        E.recentlyDropped[E.heldItem.id] = performance.now() + 5000;
        if (E.heldItem.lidItem && E.heldItem.lidItem.isAttached) {
          E.recentlyDropped[E.heldItem.lidItem.id] = performance.now() + 5000;
        }
        E.heldItem = null;
        E.placementGhost.visible = false;
        if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(null);
        E.notifyWorldAction();
        return;
      }
      if (E.hoveredSprayTarget && E.heldItem.mesh.userData.isAlcoholSpray) {
        if (window.MycoAudio) window.MycoAudio.playSpray();
        var nowMs = performance.now();
        if (E.hoveredSprayTarget === 'hood') {
          E.hoodSanitizedUntil = nowMs + 90000;
        } else {
          E.hoveredSprayTarget.sanitizedUntil = nowMs + 90000;
        }
        var spCount = 24;
        var spArr = new Float32Array(spCount * 3);
        var spOrigin = new THREE.Vector3(0.24, -0.14, -0.52).applyEuler(E.camera.rotation).add(E.camera.position);
        var spDir = new THREE.Vector3(0, 0, -1).applyEuler(E.camera.rotation);
        for (var si = 0; si < spCount; si++) {
          spArr[si * 3] = spOrigin.x + (Math.random() - 0.5) * 0.14;
          spArr[si * 3 + 1] = spOrigin.y + (Math.random() - 0.5) * 0.14;
          spArr[si * 3 + 2] = spOrigin.z + (Math.random() - 0.5) * 0.14;
        }
        var spGeo = new THREE.BufferGeometry();
        var spAttr = new THREE.BufferAttribute(spArr, 3);
        spGeo.setAttribute('position', spAttr);
        var spMat = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.035, transparent: true, opacity: 0.85 });
        var spPts = new THREE.Points(spGeo, spMat);
        E.scene.add(spPts);
        E.sprayBursts.push({ pts: spPts, mat: spMat, attr: spAttr, dir: spDir, age: 0 });
        return;
      }
      if (E.hoveredSyringeTarget && E.heldItem.mesh.userData.isSyringe) {
        var syrCtrl = E.heldItem.mesh.userData.syrCtrl;
        var tgt = E.hoveredSyringeTarget;
        if (E.syringePumping) {
          return; // Já está bombeando (aguarda concluir os 2s)
        }
        var fromVol = syrCtrl.volMl;
        var toVol;
        if (tgt.mode === 'draw') {
          toVol = 10;
        } else {
          toVol = 0;
        }
        if (fromVol >= 9.9) toVol = 0;
        else if (fromVol <= 0.1) toVol = 10;
        else toVol = (fromVol >= 5 ? 0 : 10);

        E.syringePumping = {
          target: tgt,
          fromVol: fromVol,
          toVol: toVol,
          duration: 2.0,
          elapsed: 0,
          startJarVol: (tgt.item && tgt.item.mesh && tgt.item.mesh.userData.liquidCtrl) ? tgt.item.mesh.userData.liquidCtrl.volMl : 0
        };
        return;
      }
      if (E.placementValid && E.placementGhost) {
        if (E.isPlacementBlocked(E.placementGhost.position)) {
          E.placementValid = false;
          E.updatePlacementGhostVisual(E.heldItem, false, E.heldRotY);
          return;
        }
        E.heldItem.mesh.position.copy(E.placementGhost.position);
        E.heldItem.mesh.rotation.set(0, E.heldRotY, 0);
        E.heldItem.isMoved = true;
        if (E.heldItem.potItem && E.snapClosePot) {
          E.heldItem.isAttached = true;
          E.heldItem.potItem = E.snapClosePot;
          E.snapClosePot.lidItem = E.heldItem;
          E.heldItem.mesh.position.set(E.snapClosePot.mesh.position.x, E.snapClosePot.mesh.position.y + 0.36, E.snapClosePot.mesh.position.z);
          E.heldItem.mesh.rotation.copy(E.snapClosePot.mesh.rotation);
          E.snapClosePot = null;
        }
        E.pendingMovedItems[E.heldItem.id] = {
          id: E.heldItem.id,
          x: E.heldItem.mesh.position.x,
          y: E.heldItem.mesh.position.y,
          z: E.heldItem.mesh.position.z,
          ry: E.heldItem.mesh.rotation.y
        };
        if (E.heldItem.lidItem && E.heldItem.lidItem.isAttached) {
          var attLid = E.heldItem.lidItem;
          attLid.mesh.position.set(E.heldItem.mesh.position.x, E.heldItem.mesh.position.y + 0.36, E.heldItem.mesh.position.z);
          attLid.mesh.rotation.copy(E.heldItem.mesh.rotation);
          attLid.isMoved = true;
          E.pendingMovedItems[attLid.id] = {
            id: attLid.id, x: attLid.mesh.position.x, y: attLid.mesh.position.y, z: attLid.mesh.position.z, ry: attLid.mesh.rotation.y
          };
          E.recentlyDropped[attLid.id] = performance.now() + 1500;
        }
        E.recentlyDropped[E.heldItem.id] = performance.now() + 5000;
        if (E.heldItem.lidItem && E.heldItem.lidItem.isAttached) {
          E.recentlyDropped[E.heldItem.lidItem.id] = performance.now() + 5000;
        }
        if (E.heldItem.mesh.userData.updateBounds) E.heldItem.mesh.userData.updateBounds(E.heldItem);
        E.setHeldTwoHandedGhost(E.heldItem, false);
        E.heldItem = null;
        E.placementGhost.visible = false;
        if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(null);
        E.notifyWorldAction();
      }
      return;
    }
    if (E.hoveredGreenhouseSlot) {
      E.interactGreenhouseSlot(E.hoveredGreenhouseSlot);
      return;
    }
    if (E.hoveredMushroom && E.hoveredMushroom.active) {
      E.hoveredMushroom.active = false;
      E.hoveredMushroom.group.visible = false;
      E.hoveredMushroom.respawnAt = performance.now() + 20000;
      E.queueWorldStateChange(E.hoveredMushroom.id, 0);
      if (window.MycoAudio) window.MycoAudio.playHarvest();
      if (E.callbacks.onHarvestMushroom) E.callbacks.onHarvestMushroom(E.hoveredMushroom.id);
      return;
    }
    if (E.hoveredDoorObj) {
      E.hoveredDoorObj.open = !E.hoveredDoorObj.open;
      E.queueWorldStateChange(E.hoveredDoorObj.id, E.hoveredDoorObj.open ? 1 : 0);
      if (window.MycoAudio) window.MycoAudio.playDoor(E.hoveredDoorObj.open);
      return;
    }
    if (E.hoveredBlindObj) {
      E.hoveredBlindObj.open = !E.hoveredBlindObj.open;
      E.queueWorldStateChange(E.hoveredBlindObj.id, E.hoveredBlindObj.open ? 1 : 0);
      return;
    }
    if (E.hoveredCinema) {
      var hit = E.getCinemaHitTarget(E.hoveredCinemaUv);
      if (hit.type === 'power_on') {
        E.cinemaPower = true;
        E.cinemaDirty = true;
        if (E.cinemaBeam) E.cinemaBeam.visible = (E.cinemaLessonIdx === -1 || E.cinemaPlaying);
        E.queueWorldStateChange('cinema_power', 1);
      } else if (hit.type === 'power_off') {
        E.cinemaPower = false;
        E.cinemaDirty = true;
        if (E.cinemaBeam) E.cinemaBeam.visible = false;
        E.queueWorldStateChange('cinema_power', 0);
      } else if (hit.type === 'menu') {
        E.cinemaLessonIdx = -1;
        E.cinemaDirty = true;
        if (E.cinemaBeam) E.cinemaBeam.visible = true;
        E.queueWorldStateChange('cinema_lesson', -1);
      } else if (hit.type === 'lesson') {
        E.cinemaLessonIdx = hit.idx;
        E.cinemaPlaying = true;
        E.cinemaTime = 0;
        E.cinemaDirty = true;
        if (E.cinemaBeam) E.cinemaBeam.visible = true;
        E.queueWorldStateChange('cinema_lesson', E.cinemaLessonIdx);
        E.queueWorldStateChange('cinema_playing', 1);
      } else if (hit.type === 'toggle_play') {
        E.cinemaPlaying = !E.cinemaPlaying;
        E.cinemaDirty = true;
        if (E.cinemaBeam) E.cinemaBeam.visible = E.cinemaPlaying;
        E.queueWorldStateChange('cinema_playing', E.cinemaPlaying ? 1 : 0);
      }
      return;
    }
    if (E.hoveredRankBtn) {
      var maxStart = Math.max(0, E.rankingList.length - 8);
      if (E.hoveredRankBtn === 'up') E.rankingScroll = Math.max(0, E.rankingScroll - 1);
      else E.rankingScroll = Math.min(maxStart, E.rankingScroll + 1);
      E.drawRankingBoard();
      return;
    }
    if (E.hoveredSeat) {
      if (E.isSeatOccupied(E.hoveredSeat)) return;
      E.seatedSeat = E.hoveredSeat;
      E.playerPos.set(E.seatedSeat.x, E.seatedSeat.y, E.seatedSeat.z);
      E.playerYaw = E.seatedSeat.yaw;
      if (E.playerPitch < -0.06) E.playerPitch = -0.02;
      E.playerVelX = 0; E.playerVelZ = 0; E.playerVelY = 0;
      E.notifyWorldAction();
      return;
    }
    if (E.hoveredSwitch) {
      E.hoveredSwitch.on = !E.hoveredSwitch.on;
      if (E.hoveredSwitch.light) {
        E.hoveredSwitch.light.visible = E.hoveredSwitch.on;
        E.hoveredSwitch.light.intensity = E.hoveredSwitch.on ? (E.isTouchDevice() ? 1.15 : 0.82) : 0;
      }
      if (E.hoveredSwitch.gLight) {
        E.hoveredSwitch.gLight.visible = E.hoveredSwitch.on;
        E.hoveredSwitch.gLight.intensity = E.hoveredSwitch.on ? 0.65 : 0;
      }
      if (E.hoveredSwitch.tubeMat) {
        E.hoveredSwitch.tubeMat.emissive.setHex(E.hoveredSwitch.on ? 0xfffbeb : 0x1e293b);
        E.hoveredSwitch.tubeMat.emissiveIntensity = E.hoveredSwitch.on ? 0.85 : 0.02;
      }
      if (E.hoveredSwitch.ledMat) {
        E.hoveredSwitch.ledMat.color.setHex(E.hoveredSwitch.on ? 0x22c55e : 0xef4444);
      }
      if (E.hoveredSwitch.rocker) {
        E.hoveredSwitch.rocker.rotation.x = E.hoveredSwitch.on ? -0.22 : 0.22;
      }
      (window.MycoAudio && window.MycoAudio.playSwitch());
      E.queueWorldStateChange(E.hoveredSwitch.id, E.hoveredSwitch.on ? 1 : 0);
      return;
    }
    if (E.hoveredScreenBtn) {
      if (E.hoveredScreenBtn.action === 'prev' && E.callbacks.onScreenNav) E.callbacks.onScreenNav(-1);
      else if (E.hoveredScreenBtn.action === 'next' && E.callbacks.onScreenNav) E.callbacks.onScreenNav(1);
      else if (E.hoveredScreenBtn.action === 'lessons') {
        if (document.pointerLockElement) document.exitPointerLock();
        if (E.callbacks.onOpenLessons) E.callbacks.onOpenLessons();
      }
      return;
    }
    if (E.hoveredScreen) {
      if (document.pointerLockElement) document.exitPointerLock();
      if (E.callbacks.onOpenLessons) E.callbacks.onOpenLessons();
      return;
    }
    if (E.hoveredHoodSwitch) {
      E.hoveredHoodSwitch.on = !E.hoveredHoodSwitch.on;
      E.hoveredHoodSwitch.points.visible = E.hoveredHoodSwitch.on;
      E.hoveredHoodSwitch.hepaMat.emissiveIntensity = E.hoveredHoodSwitch.on ? 0.45 : 0.04;
      E.hoveredHoodSwitch.ledMat.color.setHex(E.hoveredHoodSwitch.on ? 0x22c55e : 0xef4444);
      if (E.hoveredHoodSwitch.workLight) {
        E.hoveredHoodSwitch.workLight.visible = E.hoveredHoodSwitch.on;
        E.hoveredHoodSwitch.workLight.intensity = E.hoveredHoodSwitch.on ? 0.95 : 0;
      }
      (window.MycoAudio && window.MycoAudio.playSwitch());
      E.queueWorldStateChange('hood_lab', E.hoveredHoodSwitch.on ? 1 : 0);
      return;
    }
    if (E.hoveredStirSwitch) {
      E.hoveredStirSwitch.on = !E.hoveredStirSwitch.on;
      E.hoveredStirSwitch.ledMat.color.setHex(E.hoveredStirSwitch.on ? 0x22c55e : 0xef4444);
      E.queueWorldStateChange('stir_lab', E.hoveredStirSwitch.on ? 1 : 0);
      return;
    }
    if (E.hoveredScaleTare) {
      E.hoveredScaleTare.tare = E.hoveredScaleTare.lastGross || 0;
      E.hoveredScaleTare.draw(0);
      return;
    }
    if (E.hoveredBurnerSwitch) {
      E.hoveredBurnerSwitch.on = !E.hoveredBurnerSwitch.on;
      E.hoveredBurnerSwitch.ledMat.color.setHex(E.hoveredBurnerSwitch.on ? 0x22c55e : 0xef4444);
      if (E.hoveredBurnerSwitch.knobGroup) {
        E.hoveredBurnerSwitch.knobGroup.rotation.z = E.hoveredBurnerSwitch.on ? -1.45 : 0;
      }
      E.queueWorldStateChange('burner_lab', E.hoveredBurnerSwitch.on ? 1 : 0);
      return;
    }
    if (E.hoveredPickable) {
      if (E.hoveredPickable.mesh.userData.isBlockedPickup && E.hoveredPickable.mesh.userData.isBlockedPickup(E.hoveredPickable)) {
        return;
      }
      if (E.hoveredPickable.potItem && E.hoveredPickable.isAttached) {
        var lidIt = E.hoveredPickable;
        lidIt.isAttached = false;
        E.heldItem = lidIt;
        E.lastPickupAt = performance.now();
        E.heldRotY = E.heldItem.mesh.rotation.y;
        E.setHeldTwoHandedGhost(E.heldItem, false);
        if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(E.heldItem.label);
        E.notifyWorldAction();
        return;
      }
      for (var cpIdx = 0; cpIdx < E.cookerPots.length; cpIdx++) {
        var idxInPot = E.cookerPots[cpIdx].contents.indexOf(E.hoveredPickable);
        if (idxInPot !== -1) E.cookerPots[cpIdx].contents.splice(idxInPot, 1);
      }
      E.heldItem = E.hoveredPickable;
      E.lastPickupAt = performance.now();
      E.heldRotY = E.heldItem.mesh.rotation.y;
      E.setHeldTwoHandedGhost(E.heldItem, true);
      if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(E.heldItem.label);
      E.notifyWorldAction();
    }
  }

  E.isSeatOccupied = function (seat) {
    if (!seat) return false;
    var ids = Object.keys(E.remoteAvatars);
    for (var i = 0; i < ids.length; i++) {
      var av = E.remoteAvatars[ids[i]];
      if (!av || !av.targetPos) continue;
      if (av.seated && Math.hypot(av.targetPos.x - seat.x, av.targetPos.z - seat.z) < 0.48 && Math.abs(av.targetPos.y - seat.y) < 0.85) {
        return true;
      }
    }
    return false;
  }

  E.updateHoverRay = function (customNdc) {
    E.hoveredPickable = null;
    E.hoveredMushroom = null;
    E.hoveredDoorObj = null;
    E.hoveredBlindObj = null;
    E.hoveredScreen = false;
    E.hoveredScreenBtn = null;
    E.hoveredBoardHit = null;
    E.hoveredCinema = false;
    E.hoveredCinemaUv = null;
    E.hoveredRankBtn = null;
    E.hoveredSeat = null;
    E.hoveredSwitch = null;
    E.hoveredHoodSwitch = null;
    E.hoveredStirSwitch = null;
    E.hoveredSyringeTarget = null;
    E.hoveredScaleTare = null;
    E.hoveredBurnerSwitch = null;
    E.hoveredPotInsert = null;
    E.hoveredSprayTarget = null;
    var prompt = '';

    // Verifica proximidade dos teloes para exibir opcoes contextuais
    var nearScr = false;
    for (var s = 0; s < E.auditoriumScreenMeshes.length; s++) {
      if (E.playerPos.distanceTo(E.auditoriumScreenMeshes[s].position) < 18) {
        nearScr = true;
        break;
      }
    }
    if (nearScr !== E.nearScreenState) {
      E.nearScreenState = nearScr;
      if (E.callbacks.onNearScreen) E.callbacks.onNearScreen(E.nearScreenState);
    }

    var rayNdc = customNdc || (E.inFps ? new THREE.Vector2(0, 0) : E.pointerNdc);
    E.raycaster.setFromCamera(rayNdc, E.camera);

    if (E.heldItem) {
      var toolCol = E.getHeldBoardToolColor();
      if (toolCol && E.chalkboardMeshes.length) {
        var bHits = E.raycaster.intersectObjects(E.chalkboardMeshes, false);
        if (bHits.length > 0 && bHits[0].distance < 3.8 && bHits[0].uv) {
          E.hoveredBoardHit = bHits[0];
          E.hoveredBoardIndex = bHits[0].object.userData.boardIndex || 0;
          if (E.placementGhost) E.placementGhost.visible = false;
          var touchUi = E.isTouchDevice();
          prompt = toolCol === 'erase'
            ? (touchUi ? '🧽 Arraste na lousa para apagar' : '🧽 Segure o clique para apagar a lousa')
            : (touchUi ? '✏️ Arraste na lousa para escrever' : '✏️ Segure o clique para escrever na lousa');
          if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
          return;
        }
      }
      if (E.heldItem.mesh.userData.isAlcoholSpray) {
        for (var ai = 0; ai < E.pickableItems.length; ai++) {
          var aCand = E.pickableItems[ai];
          if (aCand === E.heldItem || E.isHeldByRemote(aCand.id)) continue;
          var aHits = E.raycaster.intersectObject(aCand.mesh, true).filter(function (h) { return !h.object.userData.ignoreRay; });
          if (aHits.length > 0 && aHits[0].distance < 3.5) {
            E.hoveredSprayTarget = aCand.mesh.userData.isHood ? 'hood' : aCand;
            E.placementGhost.visible = false;
            if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt('🧴 Borrifar Álcool 70% (' + aCand.label + ')');
            return;
          }
        }
      }
      if (!E.heldItem.mesh.userData.twoHanded && !E.heldItem.mesh.userData.isSyringe && !E.heldItem.mesh.userData.isAlcoholSpray) {
        for (var ci = 0; ci < E.cookerPots.length; ci++) {
          var cp = E.cookerPots[ci];
          if (cp.lidItem.isAttached || cp.contents.length >= 4) continue;
          var cpHits = E.raycaster.intersectObject(cp.potItem.mesh, true);
          if (cpHits.length > 0 && cpHits[0].distance < 3.5) {
            E.hoveredPotInsert = cp;
            E.placementGhost.visible = false;
            if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt('🍲 Colocar ' + E.heldItem.label + ' dentro da Panela');
            return;
          }
        }
      }
      if (E.heldItem.mesh.userData.isSyringe) {
        var sc = E.heldItem.mesh.userData.syrCtrl;
        for (var si = 0; si < E.pickableItems.length; si++) {
          var cand = E.pickableItems[si];
          if (cand === E.heldItem || E.isHeldByRemote(cand.id)) continue;
          var sHits = E.raycaster.intersectObject(cand.mesh, true).filter(function (h) { return !h.object.userData.ignoreRay; });
          if (sHits.length > 0 && sHits[0].distance < 3.5) {
            if (cand.mesh.userData.liquidCtrl) {
              var lc = cand.mesh.userData.liquidCtrl;
              if (E.syringePumping) {
                E.hoveredSyringeTarget = { item: cand, mode: E.syringePumping.toVol > E.syringePumping.fromVol ? 'draw' : 'inject' };
                E.placementGhost.visible = false;
                var pPct = Math.round((E.syringePumping.elapsed / E.syringePumping.duration) * 100);
                if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt('⏳ ' + (E.syringePumping.toVol > E.syringePumping.fromVol ? 'Aspirando Micélio' : 'Injetando de volta') + ' (' + pPct + '%)...');
                return;
              }
              if (sc.volMl < 9.9 && lc.volMl > 0) {
                E.hoveredSyringeTarget = { item: cand, mode: 'draw' };
                E.placementGhost.visible = false;
                if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt('💉 Furando Septo • Clique para aspirar cultura líquida (2s)');
                return;
              } else if (sc.volMl > 0.1) {
                E.hoveredSyringeTarget = { item: cand, mode: 'inject' };
                E.placementGhost.visible = false;
                if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt('💉 Seringa cheia (' + Math.round(sc.volMl) + 'ml) • Clique para esvaziar de volta (2s)');
                return;
              }
            } else if (sc.volMl > 0 && (cand.id.indexOf('spawn_') === 0 || (cand.id.indexOf('petri_') === 0 && cand.id.indexOf('petri_bare_') !== 0))) {
              E.hoveredSyringeTarget = { item: cand, mode: 'inject' };
              E.placementGhost.visible = false;
              if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt('💉 Inocular ' + Math.round(sc.volMl) + 'ml em ' + cand.label + ' (2s)');
              return;
            }
          }
        }
      }
      if (E.heldItem.mesh.userData.isThermometer) {
        if (E.placementGhost) E.placementGhost.visible = false;
        var modeStr = E.isPrimaryDown ? 'SCAN' : 'HOLD';
        prompt = '🔫 ' + (E.thermoTargetLabel || 'Ambiente') + ': ' + E.thermoCurrentTemp.toFixed(1) + '°C [' + modeStr + '] (Clique: Medir • Tecla G ou clique dir.: Soltar)';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
      var pt = E.findPlacementTarget(rayNdc);
      E.placementValid = !E.isPlacementBlocked(pt);
      E.placementGhost.position.copy(pt);
      E.updatePlacementGhostVisual(E.heldItem, E.placementValid, E.heldRotY);
      E.placementGhost.visible = true;
      if (E.snapClosePot) {
        prompt = '🍲 Fechar tampa na Panela de Pressão';
      } else {
        prompt = E.placementValid ? 'Soltar: ' + E.heldItem.label : (E.placementBlockedReason || '🚫 Local bloqueado (espaço ocupado)');
      }
      if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
      return;
    }
    if (E.placementGhost) E.placementGhost.visible = false;

    if (E.rankingBtnMeshes.length) {
      var rHits = E.raycaster.intersectObjects(E.rankingBtnMeshes, false);
      if (rHits.length > 0 && rHits[0].distance < 18) {
        E.hoveredRankBtn = rHits[0].object.userData.rankAction;
        prompt = E.hoveredRankBtn === 'up' ? '▲ Subir Ranking' : '▼ Descer Ranking';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.cinemaScreenMesh) {
      var cHits = E.raycaster.intersectObject(E.cinemaScreenMesh, false);
      if (cHits.length > 0 && cHits[0].distance < 22) {
        E.hoveredCinema = true;
        E.hoveredCinemaUv = cHits[0].uv ? { x: cHits[0].uv.x, y: 1 - cHits[0].uv.y } : { x: 0.5, y: 0.5 };
        E.cinemaDirty = true;
        var cTarget = E.getCinemaHitTarget(E.hoveredCinemaUv);
        if (cTarget.type === 'power_on') prompt = '⏻ Clique na tela para ligar o Auditório';
        else if (cTarget.type === 'power_off') prompt = '⏻ Desligar tela do Auditório';
        else if (cTarget.type === 'menu') prompt = '📋 Voltar ao menu de módulos';
        else if (cTarget.type === 'lesson') prompt = '▶️ Assistir: ' + ((E.cinemaLessons[cTarget.idx] && E.cinemaLessons[cTarget.idx].title) || 'Aula');
        else if (cTarget.type === 'toggle_play') prompt = E.cinemaPlaying ? '⏸️ Clique na aula para pausar' : '▶️ Clique na aula para continuar';
        else prompt = '🎬 Escolha um módulo na tela para assistir';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.scaleTareMeshes.length) {
      var tHits = E.raycaster.intersectObjects(E.scaleTareMeshes, false);
      if (tHits.length > 0 && tHits[0].distance < 3.5) {
        E.hoveredScaleTare = tHits[0].object.userData.scaleObj;
        prompt = '⚖️ Zerar Balança (TARE)';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.burnerSwitchMeshes.length && (!E.heldItem || !E.heldItem.mesh.userData.isBurner)) {
      var bHits = E.raycaster.intersectObjects(E.burnerSwitchMeshes, false);
      if (bHits.length > 0 && bHits[0].distance < 4.0) {
        E.hoveredBurnerSwitch = bHits[0].object.userData.burnerSwitch;
        prompt = E.hoveredBurnerSwitch.on ? '🔥 Desligar Fogareiro' : '🔥 Ligar Fogareiro';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.stirSwitchMeshes.length && (!E.heldItem || !E.heldItem.mesh.userData.isStirrer)) {
      var stSwHits = E.raycaster.intersectObjects(E.stirSwitchMeshes, false);
      if (stSwHits.length > 0 && stSwHits[0].distance < 4.0) {
        E.hoveredStirSwitch = stSwHits[0].object.userData.stirSwitch;
        prompt = E.hoveredStirSwitch.on ? '🌀 Desligar Agitador Magnético' : '🌀 Ligar Agitador Magnético';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.hoodSwitchMeshes.length) {
      var hsHits = E.raycaster.intersectObjects(E.hoodSwitchMeshes, false);
      if (hsHits.length > 0 && hsHits[0].distance < 4.0) {
        E.hoveredHoodSwitch = hsHits[0].object.userData.hoodSwitch;
        prompt = E.hoveredHoodSwitch.on ? '💨 Desligar Fluxo Laminar' : '💨 Ligar Fluxo Laminar';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.lightSwitchMeshes.length) {
      var swHits = E.raycaster.intersectObjects(E.lightSwitchMeshes, false);
      if (swHits.length > 0 && swHits[0].distance < 4.0) {
        E.hoveredSwitch = swHits[0].object.userData.lightSwitch;
        prompt = E.hoveredSwitch.on ? '💡 Clique para desligar a luz' : '💡 Clique para ligar a luz';
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.seatMeshes.length) {
      var stHits = E.raycaster.intersectObjects(E.seatMeshes, false);
      if (stHits.length > 0 && stHits[0].distance < 4.2) {
        var candSeat = stHits[0].object.userData.seatInfo;
        if (E.isSeatOccupied(candSeat)) {
          prompt = '🚫 Assento ocupado (sente ao lado!)';
        } else {
          E.hoveredSeat = candSeat;
          prompt = '🪑 Clique para sentar';
        }
        if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
        return;
      }
    }

    if (E.screenActionMeshes.length) {
      var btnHits = E.raycaster.intersectObjects(E.screenActionMeshes, false);
      if (btnHits.length > 0 && btnHits[0].distance < 18) {
        var act = btnHits[0].object.userData.screenAction;
        E.hoveredScreenBtn = { action: act, mesh: btnHits[0].object };
        prompt = act === 'prev' ? '◀ Slide Anterior' : (act === 'next' ? '▶ Próximo Slide' : '📚 Abrir Módulos');
      }
    }

    if (!prompt && E.auditoriumScreenMeshes.length) {
      var scrHits = E.raycaster.intersectObjects(E.auditoriumScreenMeshes, false);
      if (scrHits.length > 0 && scrHits[0].distance < 22) {
        E.hoveredScreen = true;
        prompt = '📺 Abrir Módulos da Universidade';
      }
    }
    if (!prompt && E.doorHitMeshes.length) {
      var doorHits = E.raycaster.intersectObjects(E.doorHitMeshes, false);
      if (doorHits.length > 0 && doorHits[0].distance < 5.0) {
        E.hoveredDoorObj = doorHits[0].object.userData.doorObj;
        prompt = '🚪 ' + (E.hoveredDoorObj.open ? 'Fechar ' : 'Abrir ') + E.hoveredDoorObj.label;
      }
    }
    var refX = E.inFps ? E.playerPos.x : E.camera.position.x;
    var refZ = E.inFps ? E.playerPos.z : E.camera.position.z;
    if (!prompt) {
      for (var m = 0; m < E.wildMushrooms.length; m++) {
        var wm = E.wildMushrooms[m];
        if (!wm.active) continue;
        var mdx = wm.group.position.x - refX, mdz = wm.group.position.z - refZ;
        if (E.inFps && (mdx * mdx + mdz * mdz > 24)) continue;
        var mHits = E.raycaster.intersectObject(wm.group, true);
        if (mHits.length > 0 && mHits[0].distance < 4.5) {
          E.hoveredMushroom = wm;
          prompt = '🍄 Colher Cogumelo (+25 XP)';
          break;
        }
      }
    }
    if (!prompt) {
      var bestSmall = null, bestSmallDist = Infinity;
      var bestLarge = null, bestLargeDist = Infinity;
      var bestBlocked = null, bestBlockedDist = Infinity;
      for (var i = 0; i < E.pickableItems.length; i++) {
        var item = E.pickableItems[i];
        if (item === E.heldItem || (E.heldItem && item === E.heldItem.lidItem)) continue;
        if (E.isHeldByRemote(item.id)) continue;
        var idx = item.mesh.position.x - refX, idz = item.mesh.position.z - refZ;
        if (E.inFps && (idx * idx + idz * idz > 26)) continue;
        var hits = E.raycaster.intersectObject(item.mesh, true).filter(function (h) { return !h.object.userData.ignoreRay; });
        if (hits.length > 0 && hits[0].distance < 4.5) {
          var dHit = hits[0].distance;
          // Se mirar na parte superior da panela de pressão com tampa acoplada, prioriza a tampa!
          if (item.lidItem && item.lidItem.isAttached && hits[0].point.y >= item.mesh.position.y + 0.26) {
            item = item.lidItem;
          }
          if (item.mesh.userData.isBlockedPickup && item.mesh.userData.isBlockedPickup(item)) {
            if (dHit < bestBlockedDist) {
              bestBlockedDist = dHit;
              bestBlocked = item;
            }
            continue;
          }
          if (item.mesh.userData.isTable || item.mesh.userData.isHood) {
            if (dHit < bestLargeDist) {
              bestLargeDist = dHit; bestLarge = item;
            }
          } else if (dHit < bestSmallDist) {
            bestSmallDist = dHit; bestSmall = item;
          }
        }
      }
      E.hoveredPickable = bestSmall || bestLarge;
      if (!E.hoveredPickable && bestBlocked && bestBlockedDist < 3.8) {
        if (bestBlocked.mesh.userData.isBurner) {
          prompt = '🚫 Retire a panela de cima antes de mover o Fogareiro';
        } else {
          prompt = '🚫 Retire os objetos de cima antes de mover ' + bestBlocked.label;
        }
      } else if (E.hoveredPickable) {
        var potStatus = null;
        for (var cpi = 0; cpi < E.cookerPots.length; cpi++) {
          if (E.cookerPots[cpi].potItem === E.hoveredPickable || E.cookerPots[cpi].lidItem === E.hoveredPickable) {
            potStatus = E.cookerPots[cpi]; break;
          }
        }
        if (E.hoveredPickable.potItem && E.hoveredPickable.isAttached) {
          if (potStatus && potStatus.progress >= 100) prompt = '🍲 Retirar Tampa (✅ Esterilizado 100%)';
          else if (potStatus && potStatus.psi >= 14) prompt = '🔥 Esterilizando: ' + Math.round(potStatus.temp) + '°C • ' + Math.round(potStatus.psi) + ' PSI (' + Math.floor(potStatus.progress) + '%)';
          else if (potStatus && potStatus.temp > 32) prompt = '🔥 Aquecendo: ' + Math.round(potStatus.temp) + '°C • ' + potStatus.psi.toFixed(1) + ' PSI';
          else prompt = '🍲 Retirar Tampa da Panela de Pressão';
        } else if (E.hoveredPickable.mesh.userData.twoHanded) {
          prompt = '🙌 Pegar ' + E.hoveredPickable.label + ' (2 mãos)';
        } else {
          prompt = '✋ Pegar ' + E.hoveredPickable.label;
        }
      }
    }
    if (!prompt && E.blindHitMeshes.length) {
      var blHits = E.raycaster.intersectObjects(E.blindHitMeshes, false);
      if (blHits.length > 0 && blHits[0].distance < 5.5) {
        E.hoveredBlindObj = blHits[0].object.userData.blindObj;
        prompt = E.hoveredBlindObj.open ? '🪟 Fechar Persiana' : '🪟 Abrir Persiana';
      }
    }
    E.hoveredGreenhouseSlot = null;
    if (!prompt && E.greenhouseHitMeshes.length > 0) {
      var ghHits = E.raycaster.intersectObjects(E.greenhouseHitMeshes, true);
      if (ghHits.length > 0 && ghHits[0].distance < 4.8) {
        var hSlot = ghHits[0].object.userData.greenhouseSlot;
        if (hSlot) {
          E.hoveredGreenhouseSlot = hSlot;
          var isHoldingSpray = E.heldItem && (E.heldItem.id.indexOf('alcohol_spray') !== -1 || E.heldItem.id.indexOf('spray') !== -1);
          if (hSlot.stage === 3) {
            prompt = '🍄 Colher ' + hSlot.name + ' (+50 XP e +2 Cogumelos)';
          } else if (isHoldingSpray) {
            prompt = '💦 Borrifar e Hidratar ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR)';
          } else {
            prompt = '🌱 ' + hSlot.name + ' (' + Math.round(hSlot.humidity) + '% UR • ' + (hSlot.stage === 0 ? 'Micélio' : (hSlot.stage === 1 ? 'Primórdios' : 'Crescendo')) + ')';
          }
        }
      }
    }
    if (E.callbacks.onHoverPrompt) E.callbacks.onHoverPrompt(prompt);
  }

  E.stepLobbyTour = function (dt) {
    E.tourTime += dt;
    var cycle = E.tourTime % 36;
    var camPos = new THREE.Vector3();
    var lookAt = new THREE.Vector3();

    if (cycle < 12) {
      // Vista panoramica da praca, fonte do cogumelo e ponte da Torre do Relogio
      var t0 = cycle / 12;
      camPos.set(-14 + t0 * 28, 16.0 - Math.sin(t0 * Math.PI) * 3.0, 26 - t0 * 4);
      lookAt.set(0, 3.5, -12);
    } else if (cycle < 24) {
      // Sobrevoo pelo Lago em 8 e Complexo Esportivo
      var t1 = (cycle - 12) / 12;
      camPos.set(16 - t1 * 48, 22.0, 36 - t1 * 28);
      lookAt.set(-22, 1.5, 4);
    } else {
      // Retorno pelo Student Center, Praca Leste e Montanhas
      var t2 = (cycle - 24) / 12;
      camPos.set(52 - t2 * 64, 24.0, 28 - Math.sin(t2 * Math.PI) * 18);
      lookAt.set(8, 2.5, -6);
    }

    E.camera.position.lerp(camPos, Math.min(1, dt * 1.4));
    E.controls.target.lerp(lookAt, Math.min(1, dt * 1.8));
    E.controls.update();
  }

  E.bindControls = function () {
    window.addEventListener('keydown', function (e) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      E.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        window.triggerCampusJump();
      }
      if (e.code === 'KeyG' || e.code === 'KeyQ') {
        if (E.heldItem) {
          E.dropHeldItem();
        }
      }
    });
    window.addEventListener('keyup', function (e) { E.keys[e.code] = false; });

    function clearAllInputKeys() {
      Object.keys(E.keys).forEach(function (k) { E.keys[k] = false; });
      E.isPrimaryDown = false;
      E.jumpHeld = false;
      E.flushCurrentStroke();
    }
    window.addEventListener('blur', clearAllInputKeys);
    document.addEventListener('pointerlockchange', function () {
      if (document.pointerLockElement !== E.renderer.domElement) {
        clearAllInputKeys();
      }
    });

    E.renderer.domElement.addEventListener('mousemove', function (e) {
      if (E.inFps && document.pointerLockElement === E.renderer.domElement) {
        E.playerYaw -= e.movementX * 0.0022;
        E.playerPitch = Math.max(-1.35, Math.min(1.35, E.playerPitch - e.movementY * 0.0022));
      } else {
        var rect = E.renderer.domElement.getBoundingClientRect();
        E.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        E.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      }
    });

    var lastTouchEndAt = 0;
    var lastTouchActionAt = 0;

    E.renderer.domElement.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || E.lobbyTourActive) return;
      if ((e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) || (performance.now() - lastTouchEndAt < 700)) {
        return;
      }
      if (E.inFps && document.pointerLockElement !== E.renderer.domElement) {
        E.renderer.domElement.requestPointerLock();
        return;
      }
      E.isPrimaryDown = true;
      E.handlePrimaryAction();
    });

    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) {
        E.isPrimaryDown = false;
        E.flushCurrentStroke();
      }
    });

    E.renderer.domElement.addEventListener('wheel', function (e) {
      if (E.heldItem) {
        e.preventDefault();
        E.heldRotY += e.deltaY > 0 ? 0.35 : -0.35;
      }
    }, { passive: false });

    var touchLookId = null, lastTX = 0, lastTY = 0, touchMoved = false;
    E.touchDrawingBoard = false;
    function setNdcFromTouch(t) {
      var rect = E.renderer.domElement.getBoundingClientRect();
      E.pointerNdc.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      E.pointerNdc.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
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
        el.closest('#campus-lobby')
      );
    }

    window.addEventListener('touchstart', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (isUiTouch(t.target)) continue;
        if (touchLookId === null) {
          touchLookId = t.identifier;
          lastTX = t.clientX; lastTY = t.clientY;
          touchMoved = false;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          var dx = t.clientX - lastTX, dy = t.clientY - lastTY;
          if (Math.hypot(dx, dy) > 4) touchMoved = true;
          if (E.inFps) {
            // Sensibilidade ágil e fluida para o dedão da mão direita (0.0080)
            E.playerYaw -= dx * 0.0080;
            E.playerPitch = Math.max(-1.35, Math.min(1.35, E.playerPitch - dy * 0.0080));
          }
          lastTX = t.clientX; lastTY = t.clientY;
        }
      }
    }, { passive: true });

    function resetTouchLook(e) {
      lastTouchEndAt = performance.now();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touchLookId) {
          if (!touchMoved && !E.lobbyTourActive) {
            var nowT = performance.now();
            if (nowT - lastTouchActionAt > 180) {
              lastTouchActionAt = nowT;
              setNdcFromTouch(t);
              E.updateHoverRay(E.pointerNdc);
              // Se tocou no vazio, tenta tambem na mira central (crosshair) para facilitar no celular
              var hasTarget = E.hoveredPickable || E.hoveredMushroom || E.hoveredDoorObj || E.hoveredBlindObj ||
                E.hoveredSeat || E.hoveredSwitch || E.hoveredHoodSwitch || E.hoveredStirSwitch ||
                E.hoveredSyringeTarget || E.hoveredScaleTare || E.hoveredBurnerSwitch || E.hoveredPotInsert ||
                E.hoveredSprayTarget || E.hoveredRankBtn || E.hoveredCinema || E.hoveredScreen || E.hoveredScreenBtn ||
                (E.hoveredBoardHit && E.getHeldBoardToolColor());
              if (!hasTarget) {
                E.pointerNdc.set(0, 0);
                E.updateHoverRay(E.pointerNdc);
              }
              E.handlePrimaryAction();
            }
          }
          touchLookId = null;
        }
      }
    }
    window.addEventListener('touchend', resetTouchLook, { passive: true });
    window.addEventListener('touchcancel', resetTouchLook, { passive: true });

    window.addEventListener('resize', function () {
      E.camera.aspect = window.innerWidth / window.innerHeight;
      E.camera.updateProjectionMatrix();
      E.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Vetores e Cores pré-alocados para ZERO Garbage Collection no loop de renderizacao
})();