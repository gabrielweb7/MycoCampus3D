/**
 * MycoCampus 3D — Dynamic Sky, Weather, Rainbow & Clock Tower Sync
 */
(function () {
  'use strict';

  var E = window.MycoEngine = window.MycoEngine || {};

  E.getVirtualDayFrac = function () {
    return ((Date.now() / 1000) % 2400) / 2400; // 0.0=00h, 0.25=06h, 0.50=12h, 0.75=18h
  }

  E.updateClockTexture = function () {
    if (!E.clockCtx || !E.clockTex) return;
    var totalMin = Math.floor(E.getVirtualDayFrac() * 1440);
    var m = totalMin % 60;
    if (m === E.lastClockMin) return;
    E.lastClockMin = m;
    var h = Math.floor(totalMin / 60) % 12;

    var ctx = E.clockCtx;
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 10; ctx.stroke();

    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
      ctx.lineTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106);
      ctx.lineWidth = i % 3 === 0 ? 6 : 3;
      ctx.stroke();
    }

    var hAng = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    var mAng = (m / 60) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = '#0f172a';
    ctx.lineCap = 'round';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(hAng) * 58, 128 + Math.sin(hAng) * 58); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(mAng) * 86, 128 + Math.sin(mAng) * 86); ctx.stroke();

    E.clockTex.needsUpdate = true;
  }

  E.updateDynamicEnvironment = function (dt) {
    E.envTime += dt;
    // Ciclo completo de 40 min reais (20 min dia + 20 min noite), sincronizado com o Relogio da Torre
    var dayFrac = E.getVirtualDayFrac();
    var sunAngle = (dayFrac - 0.25) * Math.PI * 2;
    var sunY = Math.sin(sunAngle); // >0 dia (06h..18h), ~0 nascer/por do sol, <0 noite (18h..06h)
    var sunX = Math.cos(sunAngle);

    // 5 condicoes climaticas sincronizadas (ciclo de 7.5 min = 450s):
    // 0..110 Ensolarado, 110..185 Parcialmente nublado, 185..250 Nublado, 250..330 Chuva, 330..390 Ceu limpo pos-chuva (Arco-iris sobre a montanha), 390..450 Neve
    var wCycle = (Date.now() / 1000) % 450;
    if (wCycle < 110) E.weatherMode = 'clear';
    else if (wCycle < 185) E.weatherMode = 'partly';
    else if (wCycle < 250) E.weatherMode = 'overcast';
    else if (wCycle < 330) E.weatherMode = 'rain';
    else if (wCycle < 390) E.weatherMode = 'clear';
    else E.weatherMode = 'snow';

    // Deteccao de termino da chuva -> Disparo do Arco-iris majestoso sobre a montanha
    if (E.lastWeatherMode === 'rain' && E.weatherMode !== 'rain') {
      E.rainbowActive = true;
      E.rainbowTimer = 0;
      E.rainbowDuration = 68;
    }
    E.lastWeatherMode = E.weatherMode;

    var targetSnow = E.weatherMode === 'snow' ? 1 : 0;
    E.snowMix += (targetSnow - E.snowMix) * Math.min(1, dt * 0.25);

    // Cores do ceu conforme Nascer do Sol, Dia, Por do Sol, Noite e Clima (zero alocacao)
    var skyCol = E._cSkyWork.copy(E._cSkyDay);
    if (sunY < 0.24 && sunY > -0.18) {
      var sT = 1 - Math.abs(sunY - 0.03) / 0.21;
      skyCol.lerp(E._cSkySunset, Math.max(0, Math.min(1, sT)));
    } else if (sunY <= -0.18) {
      skyCol.lerp(E._cSkyNight, Math.min(1, (-sunY - 0.18) / 0.25));
    }
    if (E.weatherMode === 'partly') skyCol.lerp(E._cPartly, 0.2);
    if (E.weatherMode === 'overcast') skyCol.lerp(E._cOvercast, 0.45);
    if (E.weatherMode === 'rain') skyCol.lerp(E._cRain, 0.65);
    if (E.weatherMode === 'snow') skyCol.lerp(E._cSnow, 0.5);
    E.scene.background.copy(skyCol);
    if (E.scene.fog) E.scene.fog.color.copy(skyCol);

    // Sol 3D, Halo, Lua 3D e Estrelas
    if (E.sunDisc && E.sunHalo) {
      E.sunDisc.position.set(sunX * 165, sunY * 145, -45);
      E.sunHalo.position.copy(E.sunDisc.position);
      var sunVis = sunY > -0.08 && E.weatherMode !== 'rain';
      E.sunDisc.visible = sunVis;
      E.sunHalo.visible = sunVis;
      var sunOrbCol = sunY < 0.22 ? 0xfb923c : 0xfef08a;
      E.sunDisc.material.color.setHex(sunOrbCol);
      E.sunHalo.material.color.setHex(sunOrbCol);
      E.sunHalo.material.opacity = E.weatherMode === 'overcast' ? 0.16 : 0.36;
    }
    if (E.moonDisc) {
      E.moonDisc.position.set(-sunX * 165, -sunY * 145, -45);
      E.moonDisc.visible = sunY < 0.08;
    }
    if (E.starPoints) {
      var starOp = Math.max(0, Math.min(0.9, (-sunY - 0.02) * 2.4)) * (E.weatherMode === 'rain' || E.weatherMode === 'overcast' ? 0.2 : 1);
      E.starPoints.visible = starOp > 0.02;
      E.starPoints.material.opacity = starOp;
    }

    if (E.envSun) {
      E.envSun.position.set(sunX * 75, Math.max(8, sunY * 75 + 12), 38);
      if (sunY > 0.22) E.envSun.color.copy(E._cSunDay);
      else if (sunY > -0.15) E.envSun.color.copy(E._cSunSet);
      else E.envSun.color.copy(E._cSunNight);
      var cloudDim = E.weatherMode === 'rain' ? 0.52 : (E.weatherMode === 'overcast' ? 0.72 : (E.weatherMode === 'partly' ? 0.88 : 1));
      E.envSun.intensity = (E.isTouchDevice() ? Math.max(0.28, sunY * 0.75 + 0.35) : Math.max(0.20, sunY * 0.60 + 0.32)) * cloudDim;
    }
    if (E.envHemi) {
      E.envHemi.intensity = E.isTouchDevice() ? Math.max(0.55, sunY * 0.35 + 0.55) : Math.max(0.30, sunY * 0.30 + 0.42);
    }

    // Nuvens dinamicas: quantidade, cor e velocidade conforme o clima
    var targetClouds = E.weatherMode === 'clear' ? 8 : (E.weatherMode === 'partly' ? 15 : (E.weatherMode === 'snow' ? 20 : 24));
    var cloudSpeed = E.weatherMode === 'rain' ? 2.6 : (E.weatherMode === 'overcast' ? 1.8 : 1.0);
    if (E.envCloudMat) {
      var cCol = E.weatherMode === 'rain' ? _cCloudRain : (E.weatherMode === 'overcast' ? _cCloudOvercast : E._cCloudWhite);
      if (sunY < 0.22 && sunY > -0.15 && E.weatherMode !== 'rain') {
        E._cSkyWork.copy(cCol).lerp(E._cSunSunsetGlow, 0.35);
        E.envCloudMat.color.copy(E._cSkyWork);
      } else {
        E.envCloudMat.color.copy(cCol);
      }
    }
    for (var ci = 0; ci < E.envClouds.length; ci++) {
      E.envClouds[ci].visible = ci < targetClouds;
      E.envClouds[ci].position.x += dt * cloudSpeed * (0.8 + (ci % 3) * 0.25);
      if (E.envClouds[ci].position.x > 155) E.envClouds[ci].position.x = -155;
    }

    // Acumulo de neve no terreno e telhados (so atualiza quando snowMix muda)
    if (E.terrainSnowMat) {
      E.terrainSnowMat.emissive.setHex(0xe2e8f0);
      E.terrainSnowMat.emissiveIntensity = E.snowMix * 0.42;
    }
    if (Math.abs(E.snowMix - (E.updateDynamicEnvironment._lastSnowMix || -1)) > 0.005) {
      E.updateDynamicEnvironment._lastSnowMix = E.snowMix;
      for (var si = 0; si < E.snowableEntries.length; si++) {
        E.snowableEntries[si].mat.color.copy(E.snowableEntries[si].base).lerp(E._cSnowWhite, E.snowMix * 0.85);
      }
    }

    // Particulas de Chuva / Neve ao redor do jogador (bloqueadas por roofZones)
    if (E.weatherPoints && E.weatherPosAttr) {
      E.weatherPoints.visible = E.weatherMode === 'rain' || E.weatherMode === 'snow';
      if (E.weatherPoints.visible) {
        E.weatherPoints.material.color.setHex(E.weatherMode === 'rain' ? 0x93c5fd : 0xffffff);
        E.weatherPoints.material.size = E.weatherMode === 'rain' ? 0.16 : 0.24;
        var arr = E.weatherPosAttr.array;
        var fallSpeed = E.weatherMode === 'rain' ? 24 : 3.2;
        var drift = E.weatherMode === 'rain' ? 2.5 : Math.sin(E.envTime * 1.5) * 1.2;
        var cx = E.inFps ? E.playerPos.x : E.camera.position.x;
        var cz = E.inFps ? E.playerPos.z : E.camera.position.z;
        for (var p = 0; p < arr.length; p += 3) {
          arr[p] += drift * dt;
          arr[p + 1] -= fallSpeed * dt;
          var hitRoof = false;
          for (var rz = 0; rz < E.roofZones.length; rz++) {
            var zBox = E.roofZones[rz];
            if (arr[p] >= zBox.minX && arr[p] <= zBox.maxX && arr[p + 2] >= zBox.minZ && arr[p + 2] <= zBox.maxZ && arr[p + 1] <= zBox.roofY + 0.25) {
              hitRoof = true;
              break;
            }
          }
          if (hitRoof || arr[p + 1] < 0) {
            arr[p] = cx + (Math.random() - 0.5) * 55;
            arr[p + 1] = 24 + Math.random() * 8;
            arr[p + 2] = cz + (Math.random() - 0.5) * 55;
          }
        }
        E.weatherPosAttr.needsUpdate = true;
      }
    }

    // Arco-iris sobre a montanha (aparecimento suave, brilho etereo e esvanecimento)
    if (E.rainbowMesh) {
      if (E.rainbowActive) {
        E.rainbowTimer += dt;
        var rOpacity = 0;
        if (E.rainbowTimer < 8.0) {
          // Aparecimento suave pos-chuva
          rOpacity = (E.rainbowTimer / 8.0) * 0.78;
        } else if (E.rainbowTimer > (E.rainbowDuration - 12.0)) {
          // Desaparecimento suave
          rOpacity = Math.max(0, (E.rainbowDuration - E.rainbowTimer) / 12.0) * 0.78;
        } else {
          // Brilho no ceu com sutil pulsacao atmosferica
          rOpacity = 0.75 + Math.sin(E.envTime * 1.5) * 0.04;
        }

        if (E.rainbowTimer >= E.rainbowDuration || E.weatherMode === 'rain' || E.weatherMode === 'snow') {
          E.rainbowActive = false;
          rOpacity = 0;
        }

        E.rainbowMesh.material.opacity = rOpacity;
        E.rainbowMesh.visible = rOpacity > 0.005;
      } else if (E.rainbowMesh.visible) {
        E.rainbowMesh.visible = false;
        E.rainbowMesh.material.opacity = 0;
      }
    }

    // Animacao continua da agua da Fonte Central e Lagos (caustics + ondas de espuma + gotas de agua)
    if (E.texWater) {
      E.texWater.offset.x = (E.envTime * 0.045) % 1;
      E.texWater.offset.y = (Math.sin(E.envTime * 0.4) * 0.04) % 1;
    }
    var camFX = E.inFps ? E.playerPos.x : E.camera.position.x;
    var camFZ = (E.inFps ? E.playerPos.z : E.camera.position.z) - 2.0;
    if (camFX * camFX + camFZ * camFZ < 1225) {
      for (var ri = 0; ri < E.fountainRipples.length; ri++) {
        var rp = E.fountainRipples[ri];
        var rPhase = (E.envTime * 0.55 + rp.phase) % 1;
        var rScale = 0.28 + rPhase * 0.85;
        rp.mesh.scale.set(rScale, rScale, 1);
        rp.mesh.material.opacity = (1 - rPhase) * 0.52;
      }
      if (E.fountainDropsAttr) {
        var dArr = E.fountainDropsAttr.array;
        for (var di = 0; di < dArr.length; di += 3) {
          dArr[di + 1] -= dt * 1.65;
          var dxF = dArr[di];
          var dzF = dArr[di + 2] - 2.0;
          var rDist = Math.hypot(dxF, dzF) || 0.01;
          dArr[di] += (dxF / rDist) * dt * 0.52;
          dArr[di + 2] += (dzF / rDist) * dt * 0.52;
          if (dArr[di + 1] < 0.44) {
            var nAng = Math.random() * Math.PI * 2;
            var isTop = (di % 6 === 0);
            var startR = isTop ? (0.35 + Math.random() * 0.25) : (1.28 + Math.random() * 0.22);
            dArr[di] = Math.cos(nAng) * startR;
            dArr[di + 1] = isTop ? (1.85 + Math.random() * 0.35) : (1.15 + Math.random() * 0.28);
            dArr[di + 2] = 2.0 + Math.sin(nAng) * startR;
          }
        }
        E.fountainDropsAttr.needsUpdate = true;
      }
    }
  }

  // ---------------- Arco-iris 3D sobre a Montanha ----------------

  E.createRainbowMesh = function () {
    var c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext('2d');

    // Gradiente espectral de 7 cores no eixo Y (interior ao topo)
    var grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, 'rgba(139, 92, 246, 0)');
    grad.addColorStop(0.08, 'rgba(139, 92, 246, 0.85)'); // Violeta
    grad.addColorStop(0.22, 'rgba(59, 130, 246, 0.88)');  // Azul
    grad.addColorStop(0.36, 'rgba(6, 182, 212, 0.90)');   // Ciano
    grad.addColorStop(0.50, 'rgba(34, 197, 94, 0.90)');   // Verde
    grad.addColorStop(0.66, 'rgba(234, 179, 8, 0.92)');   // Amarelo
    grad.addColorStop(0.80, 'rgba(249, 115, 22, 0.90)');  // Laranja
    grad.addColorStop(0.92, 'rgba(239, 68, 68, 0.85)');   // Vermelho
    grad.addColorStop(1.00, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Suavizacao das pontas que tocam o relevo/montanhas (eixo X)
    var maskGrad = ctx.createLinearGradient(0, 0, 256, 0);
    maskGrad.addColorStop(0.00, 'rgba(0,0,0,0)');
    maskGrad.addColorStop(0.14, 'rgba(0,0,0,1)');
    maskGrad.addColorStop(0.86, 'rgba(0,0,0,1)');
    maskGrad.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = maskGrad;
    ctx.fillRect(0, 0, 256, 256);

    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    // Arco semicircular sobre as montanhas com coordenadas UV radiais
    var innerR = 72;
    var outerR = 92;
    var segs = 64;
    var geo = new THREE.BufferGeometry();
    var positions = [];
    var uvs = [];
    var indices = [];
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var angle = Math.PI * (1 - t); // de PI (esquerda) a 0 (direita)
      var cos = Math.cos(angle);
      var sin = Math.sin(angle);
      positions.push(cos * innerR, sin * innerR, 0);
      uvs.push(t, 0);
      positions.push(cos * outerR, sin * outerR, 0);
      uvs.push(t, 1);
    }
    for (var j = 0; j < segs; j++) {
      var a = j * 2;
      var b = j * 2 + 1;
      var c = (j + 1) * 2;
      var d = (j + 1) * 2 + 1;
      indices.push(a, b, c);
      indices.push(c, b, d);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    var mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });

    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(12, 16, -145);
    mesh.rotation.y = 0.12;
    mesh.visible = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  E.triggerCampusRainbow = function (dur) {
    E.rainbowActive = true;
    E.rainbowTimer = 0;
    E.rainbowDuration = (typeof dur === 'number' && dur > 0) ? dur : 68;
    return 'Arco-íris ativado por ' + E.rainbowDuration + 's sobre a montanha!';
  }

})();