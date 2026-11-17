/**
 * MycoCampus3D — Ambiente Dinâmico (Ciclo Dia/Noite, Clima, Neve, Fonte & Arco-íris)
 */
import { snowableEntries, getTextures } from './textures.js';
import { stepRainbow } from './rainbow.js';

const THREE = window.THREE;

const _cSkyDay = new THREE.Color(0x60a5fa);
const _cSkySunset = new THREE.Color(0xf97316);
const _cSkyNight = new THREE.Color(0x0b132b);
const _cSkyWork = new THREE.Color();
const _cPartly = new THREE.Color(0x93c5fd);
const _cOvercast = new THREE.Color(0x94a3b8);
const _cRain = new THREE.Color(0x475569);
const _cSnow = new THREE.Color(0xcbd5e1);
const _cSunDay = new THREE.Color(0xfffbeb);
const _cSunSet = new THREE.Color(0xfb923c);
const _cSunNight = new THREE.Color(0x93c5fd);
const _cCloudRain = new THREE.Color(0x64748b);
const _cCloudOvercast = new THREE.Color(0xcbd5e1);
const _cCloudWhite = new THREE.Color(0xffffff);
const _cSunSunsetGlow = new THREE.Color(0xfdba74);
const _cSnowWhite = new THREE.Color(0xf1f5f9);

let lastSnowMix = -1;

export function updateDynamicEnvironment(dt, env) {
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

  const targetSnow = weatherMode === 'snow' ? 1 : 0;
  env.snowMix += (targetSnow - env.snowMix) * Math.min(1, dt * 0.25);

  const skyCol = _cSkyWork.copy(_cSkyDay);
  if (sunY < 0.24 && sunY > -0.18) {
    const sT = 1 - Math.abs(sunY - 0.03) / 0.21;
    skyCol.lerp(_cSkySunset, Math.max(0, Math.min(1, sT)));
  } else if (sunY <= -0.18) {
    skyCol.lerp(_cSkyNight, Math.min(1, (-sunY - 0.18) / 0.25));
  }
  if (weatherMode === 'partly') skyCol.lerp(_cPartly, 0.2);
  if (weatherMode === 'overcast') skyCol.lerp(_cOvercast, 0.45);
  if (weatherMode === 'rain') skyCol.lerp(_cRain, 0.65);
  if (weatherMode === 'snow') skyCol.lerp(_cSnow, 0.5);
  env.scene.background.copy(skyCol);
  if (env.scene.fog) env.scene.fog.color.copy(skyCol);

  if (env.sunDisc && env.sunHalo) {
    env.sunDisc.position.set(sunX * 165, sunY * 145, -45);
    env.sunHalo.position.copy(env.sunDisc.position);
    const sunVis = sunY > -0.08 && weatherMode !== 'rain';
    env.sunDisc.visible = sunVis;
    env.sunHalo.visible = sunVis;
    const sunOrbCol = sunY < 0.22 ? 0xfb923c : 0xfef08a;
    env.sunDisc.material.color.setHex(sunOrbCol);
    env.sunHalo.material.color.setHex(sunOrbCol);
    env.sunHalo.material.opacity = weatherMode === 'overcast' ? 0.16 : 0.36;
  }
  if (env.moonDisc) {
    env.moonDisc.position.set(-sunX * 165, -sunY * 145, -45);
    env.moonDisc.visible = sunY < 0.08;
  }
  if (env.starPoints) {
    const starOp = Math.max(0, Math.min(0.9, (-sunY - 0.02) * 2.4)) * (weatherMode === 'rain' || weatherMode === 'overcast' ? 0.2 : 1);
    env.starPoints.visible = starOp > 0.02;
    env.starPoints.material.opacity = starOp;
  }

  if (env.envSun) {
    env.envSun.position.set(sunX * 75, Math.max(8, sunY * 75 + 12), 38);
    if (sunY > 0.22) env.envSun.color.copy(_cSunDay);
    else if (sunY > -0.15) env.envSun.color.copy(_cSunSet);
    else env.envSun.color.copy(_cSunNight);
    const cloudDim = weatherMode === 'rain' ? 0.52 : (weatherMode === 'overcast' ? 0.72 : (weatherMode === 'partly' ? 0.88 : 1));
    env.envSun.intensity = (env.isTouch ? Math.max(0.28, sunY * 0.75 + 0.35) : Math.max(0.20, sunY * 0.60 + 0.32)) * cloudDim;
  }
  if (env.envHemi) {
    env.envHemi.intensity = env.isTouch ? Math.max(0.45, sunY * 0.28 + 0.45) : Math.max(0.36, sunY * 0.25 + 0.38);
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
  for (let ci = 0; ci < env.envClouds.length; ci++) {
    env.envClouds[ci].visible = ci < targetClouds;
    env.envClouds[ci].position.x += dt * cloudSpeed * (0.8 + (ci % 3) * 0.25);
    if (env.envClouds[ci].position.x > 155) env.envClouds[ci].position.x = -155;
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

  if (env.weatherPoints && env.weatherPosAttr) {
    const particleCount = env.weatherPoints.geometry.drawRange.count;
    env.weatherPoints.visible = particleCount > 0 && (weatherMode === 'rain' || weatherMode === 'snow');
    if (env.weatherPoints.visible) {
      env.weatherPoints.material.color.setHex(weatherMode === 'rain' ? 0x93c5fd : 0xffffff);
      env.weatherPoints.material.size = weatherMode === 'rain' ? 0.16 : 0.24;
      const arr = env.weatherPosAttr.array;
      const fallSpeed = weatherMode === 'rain' ? 24 : 3.2;
      const drift = weatherMode === 'rain' ? 2.5 : Math.sin(env.envTime * 1.5) * 1.2;
      const cx = env.inFps ? env.playerPos.x : env.camera.position.x;
      const cz = env.inFps ? env.playerPos.z : env.camera.position.z;
      for (let p = 0; p < particleCount * 3; p += 3) {
        arr[p] += drift * dt;
        arr[p + 1] -= fallSpeed * dt;
        let hitRoof = false;
        for (let rz = 0; rz < env.roofZones.length; rz++) {
          const zBox = env.roofZones[rz];
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
      env.weatherPosAttr.needsUpdate = true;
    }
  }

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
