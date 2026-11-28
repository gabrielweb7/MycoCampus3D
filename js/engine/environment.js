/**
 * MycoCampus3D — Ambiente Dinâmico (Ciclo Dia/Noite, Clima, Neve, Fonte & Arco-íris)
 */
import { snowableEntries, getTextures } from './textures.js';
import { stepRainbow } from './rainbow.js';
import { updateCelestialSkyDome } from './sky-constellations.js';
import { stepRainPuddles } from './rain-puddles.js';
import { getAuroraStrength, stepSkyGradientDome } from './sky-gradient.js';
import { stepCozyDetails } from '../world/cozy-details.js';
import { MYCO_PALETTE as palette } from './visual-style.js';

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;
const _ColorCtor = THREE && THREE.Color ? THREE.Color : null;
const _Obj3DCtor = THREE && THREE.Object3D ? THREE.Object3D : null;

const _cSkyDay = _ColorCtor ? new _ColorCtor(palette.sky) : null;
const _cSkySunset = _ColorCtor ? new _ColorCtor(0xd99d78) : null;
const _cSkyNight = _ColorCtor ? new _ColorCtor(0x0b102b) : null;
const _cSkyWork = _ColorCtor ? new _ColorCtor() : null;
const _cPartly = _ColorCtor ? new _ColorCtor(0x93c5fd) : null;
const _cOvercast = _ColorCtor ? new _ColorCtor(0x94a3b8) : null;
const _cRain = _ColorCtor ? new _ColorCtor(0x475569) : null;
const _cSnow = _ColorCtor ? new _ColorCtor(0xcbd5e1) : null;
const _cSunDay = _ColorCtor ? new _ColorCtor(palette.daylight) : null;
const _cSunSet = _ColorCtor ? new _ColorCtor(0xffceaa) : null;
const _cSunNight = _ColorCtor ? new _ColorCtor(0xb3c3df) : null;
const _cCloudRain = _ColorCtor ? new _ColorCtor(0x64748b) : null;
const _cCloudOvercast = _ColorCtor ? new _ColorCtor(0xcbd5e1) : null;
const _cCloudWhite = _ColorCtor ? new _ColorCtor(0xffffff) : null;
const _cSunSunsetGlow = _ColorCtor ? new _ColorCtor(0xfdba74) : null;
const _cSnowWhite = _ColorCtor ? new _ColorCtor(0xf1f5f9) : null;
const _cHemiSkyDay = _ColorCtor ? new _ColorCtor(palette.daylightFill) : null;
const _cHemiSkySet = _ColorCtor ? new _ColorCtor(0xf3ddcc) : null;
const _cHemiSkyNight = _ColorCtor ? new _ColorCtor(0x9caecb) : null;
const _cHemiGndDay = _ColorCtor ? new _ColorCtor(palette.bounce) : null;
const _cHemiGndSet = _ColorCtor ? new _ColorCtor(0x887666) : null;
const _cHemiGndNight = _ColorCtor ? new _ColorCtor(0x555961) : null;
const _cloudDummy = _Obj3DCtor ? new _Obj3DCtor() : null;

let lastSnowMix = -1;

export function computeOutsideWeatherConditions(sunY, weatherMode) {
  const s = typeof sunY === 'number' ? Math.max(-1, Math.min(1, sunY)) : 0.4;
  const mode = weatherMode || 'clear';
  let tempC;
  let humidity;
  if (mode === 'snow') {
    tempC = -2.0 + s * 2.5;
    humidity = Math.round(74 - s * 4);
  } else {
    let offset = 2.5;
    let baseHum = 52;
    if (mode === 'partly') { offset = 0.5; baseHum = 58; }
    else if (mode === 'overcast') { offset = -2.0; baseHum = 68; }
    else if (mode === 'rain') { offset = -6.0; baseHum = 86; }
    tempC = 21.5 + s * 5.5 + offset;
    humidity = Math.round(baseHum - s * (mode === 'rain' ? 4 : 10));
  }
  return {
    tempC: Math.round(tempC * 10) / 10,
    humidity: Math.max(25, Math.min(95, humidity))
  };
}

export function stepPrecipitation(env, dt, wb) {
  const points = env.weatherPoints;
  const attribute = env.weatherPosAttr;
  if (!points || !attribute) return;

  const geometry = points.geometry;
  const arr = attribute.array;
  const budget = Math.min(arr.length / 3, geometry.userData.weatherParticleLimit ?? arr.length / 3);
  const intensity = Math.max(wb.rain, wb.snow);
  const active = Math.floor(budget * Math.min(1, intensity * 1.1));
  if (geometry.drawRange.count !== active) geometry.setDrawRange(0, active);
  points.visible = active > 4 && intensity > 0.025;
  if (!points.visible) return;

  const snow = wb.snow >= wb.rain;
  points.material.color.setHex(snow ? 0xffffff : 0x93c5fd);
  points.material.size = snow ? 0.24 : 0.16;
  points.material.opacity = Math.min(0.78, intensity * 0.82);
  const fall = (snow ? 2.2 + wb.snow * 1.1 : 16 + wb.rain * 8.5) * dt;
  const drift = (snow ? Math.sin(env.envTime * 1.5) * 1.2 : 1.6 + wb.rain) * dt;
  const origin = env.inFps ? env.playerPos : env.camera.position;
  const bottom = Math.max(0, origin.y - 12);
  for (let p = 0; p < active * 3; p += 3) {
    arr[p] += drift;
    arr[p + 1] -= fall;
    const outOfRange = Math.abs(arr[p] - origin.x) > 32 || Math.abs(arr[p + 2] - origin.z) > 32 ||
      arr[p + 1] > bottom + 36;
    let hitRoof = false;
    if (!outOfRange) {
      for (let r = 0; r < env.roofZones.length; r++) {
        const roof = env.roofZones[r];
        if (arr[p] >= roof.minX && arr[p] <= roof.maxX && arr[p + 2] >= roof.minZ && arr[p + 2] <= roof.maxZ &&
            arr[p + 1] <= roof.roofY + 0.25) {
          hitRoof = true;
          break;
        }
      }
    }
    if (outOfRange || hitRoof || arr[p + 1] < bottom) {
      arr[p] = origin.x + (Math.random() - 0.5) * 55;
      arr[p + 1] = bottom + (outOfRange ? 2 + Math.random() * 30 : 24 + Math.random() * 8);
      arr[p + 2] = origin.z + (Math.random() - 0.5) * 55;
    }
  }
  attribute.clearUpdateRanges?.();
  attribute.addUpdateRange?.(0, active * 3);
  attribute.needsUpdate = true;
}

export function updateDynamicEnvironment(dt, env, precipitationDt = dt) {
  env.envTime += dt;
  const dayFrac = env.getVirtualDayFrac();
  const sunAngle = (dayFrac - 0.25) * Math.PI * 2;
  const sunY = Math.sin(sunAngle);
  const sunX = Math.cos(sunAngle);

  const wCycle = (Date.now() / 1000) % 450;
  let weatherMode = 'clear';
  if (wCycle < 110) weatherMode = 'clear';
  else if (wCycle < 185) weatherMode = 'partly';
  else if (wCycle < 250) weatherMode = 'overcast';
  else if (wCycle < 330) weatherMode = 'rain';
  else if (wCycle < 390) weatherMode = 'clear';
  else weatherMode = 'snow';

  if (env.lastWeatherMode === 'rain' && weatherMode !== 'rain') {
    env.rainbow.active = true;
    env.rainbow.timer = 0;
    env.rainbow.duration = 68;
  }
  env.lastWeatherMode = weatherMode;
  env.weatherMode = weatherMode;
  const extCond = computeOutsideWeatherConditions(sunY, weatherMode);
  env.outsideTempC = extCond.tempC;
  env.outsideHumidity = extCond.humidity;

  const targetSnow = weatherMode === 'snow' ? 1 : 0;
  env.snowMix += (targetSnow - env.snowMix) * Math.min(1, dt * 0.11);
  if (!env.weatherBlend) {
    env.weatherBlend = {
      partly: weatherMode === 'partly' ? 1 : 0,
      overcast: weatherMode === 'overcast' ? 1 : 0,
      rain: weatherMode === 'rain' ? 1 : 0,
      snow: weatherMode === 'snow' ? 1 : 0
    };
  }
  const wb = env.weatherBlend;
  const wFade = Math.min(1, dt * 0.22);
  wb.partly += ((weatherMode === 'partly' ? 1 : 0) - wb.partly) * wFade;
  wb.overcast += ((weatherMode === 'overcast' ? 1 : 0) - wb.overcast) * wFade;
  wb.rain += ((weatherMode === 'rain' ? 1 : 0) - wb.rain) * wFade;
  wb.snow += (targetSnow - wb.snow) * wFade;

  if (env.rainPuddles) stepRainPuddles(env.rainPuddles, weatherMode, dt);

  const skyCol = _cSkyWork.copy(_cSkyDay);
  if (sunY < 0.24 && sunY > -0.18) {
    const sT = 1 - Math.abs(sunY - 0.03) / 0.21;
    skyCol.lerp(_cSkySunset, Math.max(0, Math.min(1, sT)));
  } else if (sunY <= -0.18) {
    skyCol.lerp(_cSkyNight, Math.min(1, (-sunY - 0.18) / 0.25));
  }
  if (wb.partly > 0.005) skyCol.lerp(_cPartly, 0.2 * wb.partly);
  if (wb.overcast > 0.005) skyCol.lerp(_cOvercast, 0.45 * wb.overcast);
  if (wb.rain > 0.005) skyCol.lerp(_cRain, 0.65 * wb.rain);
  if (wb.snow > 0.005) skyCol.lerp(_cSnow, 0.5 * wb.snow);
  env.scene.background.copy(skyCol);
  if (env.scene.fog) env.scene.fog.color.copy(skyCol);
  const skyOrigin = env.inFps ? env.playerPos : (env.camera ? env.camera.position : env.playerPos);
  const cameraFar = (env.camera && typeof env.camera.far === 'number') ? env.camera.far : 220;
  const skyRadius = Math.max(58, Math.min(200, cameraFar - 10));
  const celestialDist = skyRadius * 0.90;
  const celestialScale = celestialDist / 170;
  const ox = skyOrigin ? (skyOrigin.x || 0) : 0;
  const oy = skyOrigin ? (skyOrigin.y || 0) : 0;
  const oz = skyOrigin ? (skyOrigin.z || 0) : 0;

  if (env.skyGradient) {
    const auroraStrength = getAuroraStrength(sunY, weatherMode, wCycle, wb);
    stepSkyGradientDome(env.skyGradient, skyOrigin, sunX, sunY, weatherMode, wb, env.envTime, auroraStrength);
  }

  if (env.sunDisc && env.sunHalo) {
    env.sunDisc.position.set(ox + sunX * celestialDist, oy + sunY * celestialDist * 0.88, oz - celestialDist * 0.27);
    env.sunHalo.position.copy(env.sunDisc.position);
    env.sunDisc.scale.setScalar(celestialScale);
    env.sunHalo.scale.setScalar(celestialScale);
    const sunVis = sunY > -0.08 && wb.rain < 0.85;
    env.sunDisc.visible = sunVis;
    env.sunHalo.visible = sunVis;
    const sunOrbCol = sunY < 0.22 ? 0xfb923c : 0xfef08a;
    env.sunDisc.material.color.setHex(sunOrbCol);
    // Halo na passada opaca (atrás do relevo): a intensidade vai na cor, pois o aditivo não usa opacidade sem transparent.
    env.sunHalo.material.color.setHex(sunOrbCol).multiplyScalar(Math.max(0.06, (0.34 - 0.18 * wb.overcast) * (1 - wb.rain)));
  }
  if (env.moonDisc) {
    env.moonDisc.position.set(ox - sunX * celestialDist, oy - sunY * celestialDist * 0.88, oz - celestialDist * 0.27);
    env.moonDisc.scale.setScalar(celestialScale);
    const moonVis = sunY < 0.12 && wb.rain < 0.85;
    env.moonDisc.visible = moonVis;
  }
  if (env.celestialDome) {
    updateCelestialSkyDome(env.celestialDome, dayFrac, sunY, weatherMode, env.envTime, skyOrigin, cameraFar);
  } else if (env.starPoints) {
    const starOp = Math.max(0, Math.min(0.95, (-sunY + 0.04) * 2.6)) * (weatherMode === 'rain' || weatherMode === 'overcast' ? 0.25 : 1);
    env.starPoints.visible = starOp > 0.02;
    env.starPoints.material.opacity = starOp;
  }
  if (env.nightLampGlows && env.nightLampGlows.length) {
    const nightFactor = Math.max(0, Math.min(1, (-sunY + 0.12) / 0.34));
    for (let li = 0; li < env.nightLampGlows.length; li++) {
      const m = env.nightLampGlows[li];
      const maxE = (m.userData && typeof m.userData.nightMaxEmissive === 'number') ? m.userData.nightMaxEmissive : 1.45;
      const baseE = maxE < 0.8 ? 0.0 : 0.22;
      m.emissiveIntensity = baseE + nightFactor * maxE;
    }
  }

  if (env.envSun) {
    env.envSun.position.set(sunX * 75, Math.max(8, sunY * 75 + 12), 38);
    if (sunY >= 0.22) env.envSun.color.copy(_cSunDay);
    else if (sunY >= 0) env.envSun.color.copy(_cSunSet).lerp(_cSunDay, sunY / 0.22);
    else env.envSun.color.copy(_cSunSet).lerp(_cSunNight, Math.min(1, -sunY / 0.22));
    const cloudDim = Math.max(0.48, 1 - 0.12 * wb.partly - 0.28 * wb.overcast - 0.48 * wb.rain - 0.22 * wb.snow);
    env.envSun.intensity = Math.max(0.16, sunY * 0.5 + 0.36) * cloudDim;
  }
  if (env.envHemi) {
    env.envHemi.intensity = Math.max(0.3, sunY * 0.06 + 0.3);
    if (_cHemiSkyDay && _cHemiGndDay) {
      env.envHemi.color.copy(_cHemiSkyDay);
      env.envHemi.groundColor.copy(_cHemiGndDay);
      if (sunY < 0.22 && sunY >= 0) {
        const sT = 1 - sunY / 0.22;
        env.envHemi.color.lerp(_cHemiSkySet, sT);
        env.envHemi.groundColor.lerp(_cHemiGndSet, sT);
      } else if (sunY < 0) {
        const nT = Math.min(1, -sunY / 0.36);
        env.envHemi.color.copy(_cHemiSkySet).lerp(_cHemiSkyNight, nT);
        env.envHemi.groundColor.copy(_cHemiGndSet).lerp(_cHemiGndNight, nT);
      }
    }
  }
  if (env.cozyDetails) {
    stepCozyDetails(env.cozyDetails, dt, env.envTime, sunY, weatherMode, env.qualityTier);
  }

  const targetClouds = weatherMode === 'clear' ? 8 : (weatherMode === 'partly' ? 15 : (weatherMode === 'snow' ? 20 : 24));
  const cloudSpeed = weatherMode === 'rain' ? 2.6 : (weatherMode === 'overcast' ? 1.8 : 1.0);
  if (env.envCloudMat) {
    const cCol = weatherMode === 'rain' ? _cCloudRain : (weatherMode === 'overcast' ? _cCloudOvercast : _cCloudWhite);
    if (sunY < 0.22 && sunY > -0.15 && weatherMode !== 'rain') {
      _cSkyWork.copy(cCol).lerp(_cSunSunsetGlow, 0.35);
      env.envCloudMat.color.copy(_cSkyWork);
    } else {
      env.envCloudMat.color.copy(cCol);
    }
  }
  env.cloudDelta = (env.cloudDelta || 0) + dt;
  const cloudPeriod = env.isTouch ? 0.08 : 0.05;
  if (env.envCloudsInst && env.envClouds?.length &&
      (env.cloudDelta >= cloudPeriod || env.envCloudsInst.count !== Math.min(targetClouds, env.envClouds.length) * 3)) {
    const cloudDt = env.cloudDelta;
    env.cloudDelta = 0;
    const visibleClouds = Math.min(targetClouds, env.envClouds.length);
    for (let ci = 0; ci < visibleClouds; ci++) {
      const cl = env.envClouds[ci];
      cl.x += cloudDt * cloudSpeed * (0.8 + (ci % 3) * 0.25);
      if (cl.x > 155) cl.x = -155;
      for (let cp = 0; cp < 3; cp++) {
        const r = 5 + (cp % 2) * 2.5;
        _cloudDummy.position.set(cl.x + (cp - 1) * 5.2, cl.y + (cp % 2) * 1.4, cl.z);
        _cloudDummy.scale.set(r * 1.3, r * 0.65, r);
        _cloudDummy.updateMatrix();
        env.envCloudsInst.setMatrixAt(ci * 3 + cp, _cloudDummy.matrix);
      }
    }
    env.envCloudsInst.count = visibleClouds * 3;
    env.envCloudsInst.instanceMatrix.needsUpdate = true;
  } else if (!env.envCloudsInst && env.envClouds) {
    env.cloudDelta = 0;
    for (let ci = 0; ci < env.envClouds.length; ci++) {
      env.envClouds[ci].visible = ci < targetClouds;
      env.envClouds[ci].position.x += dt * cloudSpeed * (0.8 + (ci % 3) * 0.25);
      if (env.envClouds[ci].position.x > 155) env.envClouds[ci].position.x = -155;
    }
  }

  if (env.terrainSnowMat) {
    env.terrainSnowMat.emissive.setHex(0xe2e8f0);
    env.terrainSnowMat.emissiveIntensity = env.snowMix * 0.42;
  }
  if (Math.abs(env.snowMix - lastSnowMix) > 0.005) {
    lastSnowMix = env.snowMix;
    for (let si = 0; si < snowableEntries.length; si++) {
      snowableEntries[si].mat.color.copy(snowableEntries[si].base).lerp(_cSnowWhite, env.snowMix * 0.85);
    }
  }

  stepPrecipitation(env, precipitationDt, wb);

  stepRainbow(env.rainbowMesh, env.rainbow, dt, weatherMode, env.envTime);

  const { texWater } = getTextures();
  if (texWater) {
    texWater.offset.x = (env.envTime * 0.045) % 1;
    texWater.offset.y = (Math.sin(env.envTime * 0.4) * 0.04) % 1;
  }
  const camFX = env.inFps ? env.playerPos.x : env.camera.position.x;
  const camFZ = (env.inFps ? env.playerPos.z : env.camera.position.z) - 2.0;
  if (camFX * camFX + camFZ * camFZ < 1225) {
    for (let ri = 0; ri < env.fountainRipples.length; ri++) {
      const rp = env.fountainRipples[ri];
      const rPhase = (env.envTime * 0.55 + rp.phase) % 1;
      const rScale = 0.28 + rPhase * 0.85;
      rp.mesh.scale.set(rScale, rScale, 1);
      rp.mesh.material.opacity = (1 - rPhase) * 0.52;
    }
    if (env.fountainDropsAttr) {
      const dArr = env.fountainDropsAttr.array;
      for (let di = 0; di < dArr.length; di += 3) {
        dArr[di + 1] -= dt * 1.65;
        const dxF = dArr[di];
        const dzF = dArr[di + 2] - 2.0;
        const rDist = Math.hypot(dxF, dzF) || 0.01;
        dArr[di] += (dxF / rDist) * dt * 0.52;
        dArr[di + 2] += (dzF / rDist) * dt * 0.52;
        if (dArr[di + 1] < 0.44) {
          const nAng = Math.random() * Math.PI * 2;
          const isTop = (di % 6 === 0);
          const startR = isTop ? (0.35 + Math.random() * 0.25) : (1.28 + Math.random() * 0.22);
          dArr[di] = Math.cos(nAng) * startR;
          dArr[di + 1] = isTop ? (1.85 + Math.random() * 0.35) : (1.15 + Math.random() * 0.28);
          dArr[di + 2] = 2.0 + Math.sin(nAng) * startR;
        }
      }
      env.fountainDropsAttr.needsUpdate = true;
    }
  }
}
