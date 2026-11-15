/**
 * MycoCampus 3D — Cute Mushroom Avatars, Cosmetics, Expressions & Multiplayer Interpolation
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.buildFirstPersonArm = function () {
    E.fpsArmGroup = new THREE.Group();
    E.fpsSleeveMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.6 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
    var sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.36), E.fpsSleeveMat);
    sleeve.position.set(0, 0, 0.18);
    var hand = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.13), skinMat);
    hand.position.set(0, 0.01, -0.04);
    E.fpsArmGroup.add(sleeve, hand);
    E.fpsArmGroup.position.set(0.32, -0.28, -0.42);
    E.fpsArmGroup.rotation.set(0.18, -0.14, 0.05);
    E.fpsArmGroup.visible = false;
    E.camera.add(E.fpsArmGroup);

    E.fpsLeftArmGroup = new THREE.Group();
    var sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.36), E.fpsSleeveMat);
    sleeveL.position.set(0, 0, 0.18);
    var handL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.13), skinMat);
    handL.position.set(0, 0.01, -0.04);
    E.fpsLeftArmGroup.add(sleeveL, handL);
    E.fpsLeftArmGroup.position.set(-0.32, -0.28, -0.42);
    E.fpsLeftArmGroup.rotation.set(0.18, 0.14, -0.05);
    E.fpsLeftArmGroup.visible = false;
    E.camera.add(E.fpsLeftArmGroup);
    E.scene.add(E.camera);
  }

  E.isHeldByRemote = function (itemId) {
    var ids = Object.keys(E.remoteAvatars);
    for (var i = 0; i < ids.length; i++) {
      var hId = E.remoteAvatars[ids[i]].holding;
      if (hId === itemId) return true;
      if (hId) {
        var item = E.findPickable(itemId);
        if (item && item.potItem && item.isAttached && item.potItem.id === hId) {
          return true;
        }
      }
    }
    return false;
  }

  E.drawAvatarFace = function (ctx, mood, blink) {
    ctx.clearRect(0, 0, 128, 128);
    // Bochechas rosadas
    ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
    ctx.beginPath(); ctx.ellipse(28, 76, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(100, 76, 12, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Olhos
    if (blink) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(40, 56, 10, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(88, 56, 10, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      [40, 88].forEach(function (ex) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.ellipse(ex, 56, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex - 3, 51, 3.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + 3, 60, 1.8, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Sobrancelhas & Boca conforme o humor
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    if (mood === 'focused') {
      ctx.beginPath(); ctx.moveTo(28, 38); ctx.lineTo(50, 42); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(100, 38); ctx.lineTo(78, 42); ctx.stroke();
      ctx.beginPath(); ctx.arc(64, 86, 5, 0, Math.PI * 2); ctx.stroke();
    } else if (mood === 'chat') {
      ctx.fillStyle = '#be123c';
      ctx.beginPath(); ctx.ellipse(64, 85, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(64, 78, 12, 0.25, Math.PI - 0.25); ctx.stroke();
    }
  }

  E.buildAvatarHat = function (hatId, hatMat, hatGroup) {
    while (hatGroup.children.length > 0) {
      hatGroup.remove(hatGroup.children[0]);
    }
    var id = hatId || 'default';

    if (id === 'golden_shroom') {
      var goldMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15, metalness: 0.88, roughness: 0.18,
        emissive: 0xb45309, emissiveIntensity: 0.35
      });
      var gHat = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), goldMat);
      gHat.position.set(0, 0.24, 0); gHat.castShadow = true;
      var pearlMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, metalness: 0.1, roughness: 0.15,
        emissive: 0xfef08a, emissiveIntensity: 0.6
      });
      [[0, 0.58, 0.08], [-0.20, 0.46, -0.16], [0.20, 0.46, -0.16], [-0.18, 0.45, 0.17], [0.18, 0.45, 0.17], [0, 0.62, 0]].forEach(function (sp) {
        var p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pearlMat);
        p.position.set(sp[0], sp[1], sp[2]);
        hatGroup.add(p);
      });
      hatGroup.add(gHat);
    } else if (id === 'wizard_hood') {
      var wizMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.55 });
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.035, 20), wizMat);
      brim.position.set(0, 0.22, 0);
      var cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.68, 20), wizMat);
      cone.position.set(0, 0.52, -0.05);
      cone.rotation.x = -0.18;
      var belt = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.38, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 }));
      belt.position.set(0, 0.25, -0.02);
      belt.rotation.x = -0.15;
      hatGroup.add(brim, cone, belt);
    } else if (id === 'grad_cap') {
      var capMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
      var skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
      skull.position.set(0, 0.22, 0);
      var board = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.56), capMat);
      board.position.set(0, 0.35, 0);
      board.rotation.y = Math.PI / 4;
      var button = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7 }));
      button.position.set(0, 0.37, 0);
      var tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.035, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 }));
      tassel.position.set(0.24, 0.24, 0.12);
      tassel.rotation.z = -0.3;
      hatGroup.add(skull, board, button, tassel);
    } else if (id === 'flower_crown') {
      var vineMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
      var vine = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 8, 24), vineMat);
      vine.rotation.x = Math.PI / 2;
      vine.position.set(0, 0.24, 0);
      hatGroup.add(vine);
      var flowerCols = [0xf43f5e, 0xfacc15, 0x38bdf8, 0xa855f7, 0xffedd5, 0xf97316];
      for (var fi = 0; fi < 6; fi++) {
        var ang = (fi / 6) * Math.PI * 2;
        var fMat = new THREE.MeshStandardMaterial({ color: flowerCols[fi], roughness: 0.35 });
        var fMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), fMat);
        fMesh.position.set(Math.cos(ang) * 0.24, 0.25, Math.sin(ang) * 0.24);
        hatGroup.add(fMesh);
      }
    } else if (id === 'beret') {
      var beretMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.8 });
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.25, 0.10, 18), beretMat);
      disc.position.set(0.05, 0.28, -0.02);
      disc.rotation.z = -0.22;
      disc.rotation.x = 0.08;
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), beretMat);
      stem.position.set(0.06, 0.35, -0.02);
      hatGroup.add(disc, stem);
    } else {
      // Padrão: cogumelo vermelho com pintas brancas
      var defHat = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), hatMat);
      defHat.position.set(0, 0.24, 0); defHat.castShadow = true;
      var spotMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
      [[0, 0.56, 0.08], [-0.18, 0.45, -0.15], [0.18, 0.45, -0.15], [-0.16, 0.44, 0.16], [0.16, 0.44, 0.16]].forEach(function (sp) {
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), spotMat);
        dot.scale.set(1, 0.45, 1);
        dot.position.set(sp[0], sp[1], sp[2]);
        hatGroup.add(dot);
      });
      hatGroup.add(defHat);
    }
  }

  E.buildCuteAvatar = function (data) {
    var g = new THREE.Group();
    var bodyMat = data.isLocal
      ? new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: new THREE.Color(data.body_color || '#4f46e5'), roughness: 0.6 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.65 });
    var hatMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(data.hat_color || '#d9534f'), roughness: 0.45 });

    var legGeo = new THREE.BoxGeometry(0.14, 0.38, 0.14);
    legGeo.translate(0, -0.19, 0); // Pivo na articulacao do quadril (topo da perna)
    var leftLeg = new THREE.Mesh(legGeo, bodyMat);
    leftLeg.position.set(-0.10, 0.38, 0); leftLeg.castShadow = true;
    var rightLeg = new THREE.Mesh(legGeo, bodyMat);
    rightLeg.position.set(0.10, 0.38, 0); rightLeg.castShadow = true;
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26), bodyMat);
    torso.position.set(0, 0.64, 0); torso.castShadow = true;
    var armGeo = new THREE.BoxGeometry(0.13, 0.44, 0.13);
    armGeo.translate(0, -0.16, 0); // Pivo na articulacao do ombro (topo do braco)
    var leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.28, 0.82, 0); leftArm.castShadow = true;
    var rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.position.set(0.28, 0.82, 0); rightArm.castShadow = true;
    g.add(leftLeg, rightLeg, torso, leftArm, rightArm);

    var headGroup = new THREE.Group();
    headGroup.position.set(0, 1.05, 0);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.34), skinMat);
    head.position.set(0, 0.1, 0); head.castShadow = true;

    // Rosto expressivo (CanvasTexture na frente -Z)
    var faceCanvas = document.createElement('canvas');
    faceCanvas.width = 128; faceCanvas.height = 128;
    var faceCtx = faceCanvas.getContext('2d');
    E.drawAvatarFace(faceCtx, 'happy', false);
    var faceTex = new THREE.CanvasTexture(faceCanvas);
    var facePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.30),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true })
    );
    facePlane.position.set(0, 0.1, -0.173);
    facePlane.rotation.y = Math.PI;
    headGroup.add(facePlane);

    // Chapeu com suporte a cosmeticos especiais
    var hatGroup = new THREE.Group();
    E.buildAvatarHat(data.current_hat || 'default', hatMat, hatGroup);
    headGroup.add(head, hatGroup);

    var isProf = data.role === 'professor' || data.role === 'admin';
    var isMaster = data.role === 'admin';
    var isMod = data.role === 'moderator';
    var auraGroup = null;
    var auraOrbs = [];
    if (isProf) {
      auraGroup = new THREE.Group();
      var ringColor = isMaster ? 0xf59e0b : 0x34d399;
      var innerColor = isMaster ? 0xec4899 : 0xfbbf24;
      var outerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 0.56, 36),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.025;
      var innerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.38, 36),
        new THREE.MeshBasicMaterial({ color: innerColor, transparent: true, opacity: 0.50, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      innerRing.rotation.x = -Math.PI / 2;
      innerRing.position.y = 0.032;
      auraGroup.add(outerRing, innerRing);
      var orbGeo = new THREE.SphereGeometry(0.026, 8, 8);
      for (var oi = 0; oi < 8; oi++) {
        var oMat = new THREE.MeshBasicMaterial({
          color: oi % 2 === 0 ? ringColor : innerColor,
          transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
        });
        var orb = new THREE.Mesh(orbGeo, oMat);
        auraGroup.add(orb);
        auraOrbs.push({ mesh: orb, angle: (oi / 8) * Math.PI * 2, phase: oi * 0.75 });
      }
      g.add(auraGroup);
    }
    g.add(headGroup);
    g.scale.set(1.38, 1.38, 1.38);

    var rolePrefix = '';
    var labelColor = '#ffffff';
    if (isMaster) {
      rolePrefix = '👑 ';
      labelColor = '#fbbf24';
    } else if (data.role === 'professor') {
      rolePrefix = '👨‍🏫 ';
      labelColor = '#fcd34d';
    } else if (isMod) {
      rolePrefix = '🛡️ ';
      labelColor = '#93c5fd';
    }
    var labelSprite = data.isLocal ? null : E.makeTextSprite(rolePrefix + (data.name || 'Aluno'), labelColor);
    if (labelSprite) {
      labelSprite.position.set(0, 1.92, 0);
      labelSprite.scale.set(1.45, 0.36, 1);
      g.add(labelSprite);
    }
    var chatSprite = data.isLocal ? null : E.makeTextSprite('', '#34d399');
    if (chatSprite) {
      chatSprite.position.set(0, 2.28, 0);
      chatSprite.scale.set(1.45, 0.36, 1);
      chatSprite.visible = false;
      g.add(chatSprite);
    }

    E.scene.add(g);
    return {
      group: g, torso: torso, leftLeg: leftLeg, rightLeg: rightLeg, leftArm: leftArm, rightArm: rightArm, headGroup: headGroup,
      auraGroup: auraGroup, auraOrbs: auraOrbs,
      bodyMat: bodyMat, hatMat: hatMat, hatGroup: hatGroup, current_hat: data.current_hat || 'default', emote: data.emote || '',
      faceCtx: faceCtx, faceTex: faceTex, lastMood: 'happy', lastBlink: false, blinkTimer: 2 + Math.random() * 3,
      labelSprite: labelSprite, chatSprite: chatSprite, lastChat: '', role: data.role || 'student',
      targetPos: new THREE.Vector3(data.x || 0, data.y || 0, data.z || 0),
      targetYaw: E.normalizeAngle(data.yaw || 0),
      targetPitch: data.pitch || 0,
      holding: '', walking: false, seated: false, walkPhase: 0
    };
  }

  E.updateCampusPlayers = function (players) {
    var seen = {};
    (players || []).forEach(function (p) {
      seen[p.id] = true;
      var av = E.remoteAvatars[p.id];
      if (!av) {
        av = E.buildCuteAvatar(p);
        av.group.position.set(p.x, p.y, p.z);
        E.remoteAvatars[p.id] = av;
      }
      av.targetPos.set(p.x, p.y, p.z);
      av.targetYaw = E.normalizeAngle(p.yaw || 0);
      av.targetPitch = p.pitch || 0;
      av.walking = !!p.walking;
      av.seated = !!p.seated;
      av.holding = p.holding || '';
      if (av.current_hat !== (p.current_hat || 'default')) {
        av.current_hat = p.current_hat || 'default';
        E.buildAvatarHat(av.current_hat, av.hatMat, av.hatGroup);
      }
      av.emote = p.emote || '';
      if (av.role !== p.role) {
        av.role = p.role;
        var rPfx = p.role === 'admin' ? '👑 ' : (p.role === 'professor' ? '👨‍🏫 ' : (p.role === 'moderator' ? '🛡️ ' : ''));
        var rCol = p.role === 'admin' ? '#fbbf24' : (p.role === 'professor' ? '#fcd34d' : (p.role === 'moderator' ? '#93c5fd' : '#ffffff'));
        if (av.labelSprite) {
          E.updateTextSprite(av.labelSprite, rPfx + (p.name || 'Aluno'), rCol);
        }
      }
      if (E.heldItem && av.holding === E.heldItem.id) {
        E.setHeldTwoHandedGhost(E.heldItem, false);
        E.heldItem = null;
        if (E.placementGhost) E.placementGhost.visible = false;
        if (E.callbacks.onHoldChange) E.callbacks.onHoldChange(null);
      }
      if ((p.chat || '') !== av.lastChat) {
        av.lastChat = p.chat || '';
        if (av.lastChat) {
          E.updateTextSprite(av.chatSprite, '💬 ' + av.lastChat, '#a7f3d0');
          av.chatSprite.visible = true;
        } else {
          av.chatSprite.visible = false;
        }
      }
    });
    Object.keys(E.remoteAvatars).forEach(function (id) {
      if (!seen[id]) {
        E.scene.remove(E.remoteAvatars[id].group);
        delete E.remoteAvatars[id];
      }
    });
  }

  E.animateAvatarExpression = function (av, dt, holding, chatMsg) {
    if (!av || !av.faceCtx) return;
    av.blinkTimer -= dt;
    var blinkNow = av.blinkTimer <= 0;
    if (av.blinkTimer <= -0.14) av.blinkTimer = 2.4 + Math.random() * 3.5;
    var mood = chatMsg ? 'chat' : (holding ? 'focused' : 'happy');
    if (mood !== av.lastMood || blinkNow !== av.lastBlink) {
      av.lastMood = mood;
      av.lastBlink = blinkNow;
      E.drawAvatarFace(av.faceCtx, mood, blinkNow);
      av.faceTex.needsUpdate = true;
    }
  }

  E.animateAvatarAura = function (av, tNow) {
    if (!av || !av.auraGroup) return;
    av.auraGroup.rotation.y = tNow * 0.7;
    var pScale = 1 + Math.sin(tNow * 2.6) * 0.06;
    av.auraGroup.children[0].scale.set(pScale, pScale, 1);
    for (var oi = 0; oi < av.auraOrbs.length; oi++) {
      var o = av.auraOrbs[oi];
      var a = o.angle + tNow * 1.1;
      var h = ((tNow * 0.45 + o.phase) % 1.45) + 0.08;
      var rad = 0.44 + Math.sin(tNow * 2 + o.phase) * 0.05;
      o.mesh.position.set(Math.cos(a) * rad, h, Math.sin(a) * rad);
      o.mesh.material.opacity = Math.sin((h - 0.08) / 1.45 * Math.PI) * 0.78;
    }
  }

  E.stepMultiplayerAvatars = function (dt) {
    var tNow = E.clock.elapsedTime;
    Object.keys(E.remoteAvatars).forEach(function (id) {
      var av = E.remoteAvatars[id];
      E.animateAvatarAura(av, tNow);
      av.group.position.lerp(av.targetPos, Math.min(1, dt * 10));
      var dYaw = E.normalizeAngle(av.targetYaw - av.group.rotation.y);
      av.group.rotation.y = E.normalizeAngle(av.group.rotation.y + dYaw * Math.min(1, dt * 12));
      av.headGroup.rotation.x += (av.targetPitch - av.headGroup.rotation.x) * Math.min(1, dt * 12);
      var heldObj = null;
      if (av.holding) {
        heldObj = E.findPickable(av.holding);
        if (heldObj && heldObj !== E.heldItem) {
          var isTwo = !!heldObj.mesh.userData.twoHanded;
          if (isTwo) {
            E._tmpAvatarHandOffset.set(0, 0.72, -0.62);
          } else {
            E._tmpAvatarHandOffset.set(0.36, 0.88, -0.38);
          }
          E._tmpAvatarHandOffset.applyAxisAngle(E._tmpAvatarYAxis, av.group.rotation.y);
          heldObj.mesh.position.copy(av.group.position).add(E._tmpAvatarHandOffset);
          heldObj.mesh.rotation.y = av.group.rotation.y;
          if (heldObj.mesh.userData.updateBounds) heldObj.mesh.userData.updateBounds(heldObj);
          if (heldObj.lidItem && heldObj.lidItem.isAttached) {
            var lidObj = heldObj.lidItem.mesh;
            lidObj.position.set(heldObj.mesh.position.x, heldObj.mesh.position.y + 0.36, heldObj.mesh.position.z);
            lidObj.rotation.copy(heldObj.mesh.rotation);
          }
        }
      }
      var twoH = !!(heldObj && heldObj.mesh.userData.twoHanded);
      if (av.seated) {
        if (av.torso) av.torso.position.set(0, 0.60, 0);
        av.headGroup.position.set(0, 1.01, 0);
        av.leftLeg.position.set(-0.11, 0.41, 0);
        av.rightLeg.position.set(0.11, 0.41, 0);
        av.leftLeg.rotation.x = Math.PI / 2;
        av.rightLeg.rotation.x = Math.PI / 2;
        av.leftArm.position.set(-0.28, 0.78, 0);
        av.rightArm.position.set(0.28, 0.78, 0);
        av.leftArm.rotation.x = twoH ? 1.05 : 0.42;
        av.rightArm.rotation.x = av.holding ? 1.05 : 0.42;
        if (av.labelSprite) av.labelSprite.position.y = 1.84;
        if (av.chatSprite) av.chatSprite.position.y = 2.20;
      } else {
        if (av.torso) av.torso.position.set(0, 0.64, 0);
        av.headGroup.position.set(0, 1.05, 0);
        av.leftLeg.position.set(-0.10, 0.38, 0);
        av.rightLeg.position.set(0.10, 0.38, 0);
        av.leftArm.position.set(-0.28, 0.82, 0);
        av.rightArm.position.set(0.28, 0.82, 0);
        if (av.labelSprite) av.labelSprite.position.y = 1.92;
        if (av.chatSprite) av.chatSprite.position.y = 2.28;
        if (av.walking) {
          av.walkPhase += dt * 10;
          av.leftLeg.rotation.x = Math.sin(av.walkPhase) * 0.55;
          av.rightLeg.rotation.x = -Math.sin(av.walkPhase) * 0.55;
          av.leftArm.rotation.x = twoH ? 1.05 : -Math.sin(av.walkPhase) * 0.45;
          av.rightArm.rotation.x = av.holding ? 1.05 : Math.sin(av.walkPhase) * 0.45;
        } else {
          av.leftLeg.rotation.x *= 0.8;
          av.rightLeg.rotation.x *= 0.8;
          av.leftArm.rotation.x = twoH ? 1.0 : av.leftArm.rotation.x * 0.8;
          av.rightArm.rotation.x = av.holding ? 1.0 : av.rightArm.rotation.x * 0.8;
        }
        if (av.emote && !av.walking && !av.seated) {
          if (av.emote === 'wave') {
            av.rightArm.rotation.x = -Math.PI * 0.82;
            av.rightArm.rotation.z = Math.sin(tNow * 10) * 0.35 + 0.32;
            av.headGroup.rotation.z = Math.sin(tNow * 4) * 0.08;
          } else if (av.emote === 'dance') {
            av.group.rotation.y += Math.sin(tNow * 6) * 0.08;
            if (av.torso) av.torso.position.y = 0.64 + Math.abs(Math.sin(tNow * 8)) * 0.10;
            av.leftArm.rotation.z = Math.sin(tNow * 8) * 0.5 - 0.25;
            av.rightArm.rotation.z = -Math.sin(tNow * 8) * 0.5 + 0.25;
            av.leftLeg.rotation.x = Math.sin(tNow * 8) * 0.30;
            av.rightLeg.rotation.x = -Math.sin(tNow * 8) * 0.30;
          } else if (av.emote === 'cheer') {
            av.leftArm.rotation.x = -Math.PI * 0.88;
            av.rightArm.rotation.x = -Math.PI * 0.88;
            av.leftArm.rotation.z = -0.38;
            av.rightArm.rotation.z = 0.38;
            av.group.position.y += Math.abs(Math.sin(tNow * 9)) * 0.16;
          } else if (av.emote === 'meditate') {
            av.leftLeg.rotation.x = Math.PI / 2;
            av.rightLeg.rotation.x = Math.PI / 2;
            av.leftLeg.rotation.z = -0.3;
            av.rightLeg.rotation.z = 0.3;
            av.leftArm.rotation.x = 0.4; av.leftArm.rotation.z = -0.28;
            av.rightArm.rotation.x = 0.4; av.rightArm.rotation.z = 0.28;
            av.group.position.y += 0.30 + Math.sin(tNow * 2.5) * 0.06;
          }
        }
      }
      E.animateAvatarExpression(av, dt, av.holding, av.lastChat);
    });
  }

})();