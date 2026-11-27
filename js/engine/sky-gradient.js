/**
 * Céu em Gradiente Atmosférico (MycoCampus3D) — 1 único draw call, zero alocações por frame.
 * Dá transição suave do horizonte (Golden Hour / Dia Azul / Noite Estrelada) combinando com a névoa.
 */

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;
const _ColorCtor = THREE && THREE.Color ? THREE.Color : null;

const _cTopDay = _ColorCtor ? new _ColorCtor(0x578bb6) : null;
const _cTopSunset = _ColorCtor ? new _ColorCtor(0x796b9b) : null;
const _cTopNight = _ColorCtor ? new _ColorCtor(0x050922) : null;

const _cHorDay = _ColorCtor ? new _ColorCtor(0xb5d1d6) : null;
const _cHorSunset = _ColorCtor ? new _ColorCtor(0xdfa47e) : null;
const _cHorNight = _ColorCtor ? new _ColorCtor(0x1e1b4b) : null;

const _cRainTint = _ColorCtor ? new _ColorCtor(0x475569) : null;
const _cOverTint = _ColorCtor ? new _ColorCtor(0x94a3b8) : null;
const _cSnowTint = _ColorCtor ? new _ColorCtor(0xcbd5e1) : null;

const _topWork = _ColorCtor ? new _ColorCtor() : null;
const _horWork = _ColorCtor ? new _ColorCtor() : null;

function smoothstep(start, end, value) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function getAuroraStrength(sunY, weatherMode, weatherPhase, weatherBlend) {
  // The weather cycle starts with the clear spell after snowfall.
  if (weatherMode !== 'clear' || weatherPhase <= 12 || weatherPhase >= 105 || sunY >= -0.22) return 0;

  const darkness = smoothstep(0.22, 0.58, -sunY);
  const fadeIn = smoothstep(12, 32, weatherPhase);
  const fadeOut = 1 - smoothstep(78, 105, weatherPhase);
  const obscured = Math.max(weatherBlend.partly, weatherBlend.overcast, weatherBlend.rain, weatherBlend.snow);
  return darkness * fadeIn * fadeOut * (1 - smoothstep(0.05, 0.5, obscured));
}

export function createSkyGradientDome(scene) {
  if (!THREE || !scene || !THREE.ShaderMaterial || !THREE.SphereGeometry) return null;

  const geo = new THREE.SphereGeometry(52, 24, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uTopColor: { value: _cTopDay.clone() },
      uHorizonColor: { value: _cHorDay.clone() },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.3) },
      uSunWarmth: { value: 0.25 },
      uNightAmt: { value: 0.0 },
      uAuroraStrength: { value: 0.0 },
      uTime: { value: 0.0 }
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform float uSunWarmth;
      uniform float uNightAmt;
      uniform float uAuroraStrength;
      uniform float uTime;
      varying vec3 vWorldDir;

      vec3 auroraRibbon(float angle, float height, float time, vec3 base, vec3 tip) {
        float folds = 0.69 + 0.19 * sin(angle * 29.0 + sin(angle * 7.0 + time) * 1.6)
                           + 0.12 * sin(angle * 54.0 - time * 1.3);
        float curtain = smoothstep(-0.036, 0.009, height)
                      * (1.0 - smoothstep(0.012, 0.29, height));
        float hem = 1.0 - smoothstep(0.0, 0.070, abs(height));
        vec3 tint = mix(base, tip, smoothstep(0.015, 0.20, height));
        return tint * (curtain * folds * 0.53 + hem * 0.22);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);
        float curve = pow(h, 0.56);
        vec3 col = mix(uHorizonColor, uTopColor, curve);
        float sunAmt = max(0.0, dot(dir, normalize(uSunDir)));
        col += vec3(1.0, 0.76, 0.46) * pow(sunAmt, 6.5) * uSunWarmth;
        if (uNightAmt > 0.01) {
          float bandCoord = dir.x * 0.65 + dir.y * 0.45 - dir.z * 0.60;
          float nebula = exp(-bandCoord * bandCoord * 7.5) * smoothstep(0.04, 0.45, h);
          float swirl = 0.5 + 0.5 * sin(dir.x * 5.0 + dir.z * 4.2 + uTime * 0.14);
          vec3 nebulaCol = mix(vec3(0.24, 0.14, 0.48), vec3(0.14, 0.42, 0.58), swirl);
          col += nebulaCol * nebula * uNightAmt * 0.34;
        }
        if (uAuroraStrength > 0.003 && dir.y > 0.06 && dir.y < 0.82 && dir.z < 0.0) {
          float angle = atan(dir.x, -dir.z);
          float facing = 1.0 - smoothstep(0.68, 1.42, abs(angle + 0.13));
          float time = uTime * 0.14;
          float front = 0.29 + 0.058 * sin(angle * 4.8 + time)
                             + 0.031 * sin(angle * 9.0 - time * 0.7) + angle * 0.038;
          float back = 0.45 + 0.047 * sin(angle * 5.3 - time * 0.75 + 1.8) - angle * 0.060;
          vec3 glow = auroraRibbon(angle, dir.y - front, time, vec3(0.22, 0.88, 0.61), vec3(0.70, 0.35, 0.76));
          glow += auroraRibbon(angle + 0.5, dir.y - back, -time, vec3(0.26, 0.67, 0.79), vec3(0.78, 0.42, 0.76)) * 0.54;
          col += glow * facing * uAuroraStrength;
        }
        float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(col + dither, 1.0);
      }
    `
  });
  mat.userData.shared = true;
  mat.userData.keepPbr = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  mesh.userData.isDynamic = true;
  mesh.userData.keepDynamic = true;
  scene.add(mesh);

  return { mesh, mat, lastSunY: -99, lastMode: '' };
}

export function stepSkyGradientDome(ctrl, camPos, sunX, sunY, weatherMode, weatherBlend, envTime = 0, auroraStrength = 0) {
  if (!ctrl || !ctrl.mesh || !ctrl.mat || !_topWork || !_horWork) return;
  if (camPos) {
    ctrl.mesh.position.set(camPos.x, camPos.y, camPos.z);
  }

  const sY = typeof sunY === 'number' ? sunY : 0.4;
  _topWork.copy(_cTopDay);
  _horWork.copy(_cHorDay);
  let sunWarmth = 0.24;
  let nightAmt = 0.0;

  if (sY < 0.24 && sY > -0.18) {
    const sT = Math.max(0, Math.min(1, 1 - Math.abs(sY - 0.03) / 0.21));
    _topWork.lerp(_cTopSunset, sT * 0.88);
    _horWork.lerp(_cHorSunset, sT);
    sunWarmth = 0.24 + sT * 0.36;
    nightAmt = sY < 0 ? Math.min(0.45, -sY * 2.2) : 0.0;
  } else if (sY <= -0.18) {
    const nT = Math.min(1, (-sY - 0.18) / 0.24);
    _topWork.lerp(_cTopNight, nT);
    _horWork.lerp(_cHorNight, nT);
    sunWarmth = 0.0;
    nightAmt = 0.45 + nT * 0.55;
  }

  const wb = weatherBlend || null;
  const overW = wb ? (wb.overcast || 0) : (weatherMode === 'overcast' ? 1 : 0);
  const rainW = wb ? (wb.rain || 0) : (weatherMode === 'rain' ? 1 : 0);
  const snowW = wb ? (wb.snow || 0) : (weatherMode === 'snow' ? 1 : 0);

  if (overW > 0.005) {
    _topWork.lerp(_cOverTint, 0.48 * overW);
    _horWork.lerp(_cOverTint, 0.42 * overW);
    sunWarmth *= (1 - 0.65 * overW);
    nightAmt *= (1 - 0.55 * overW);
  }
  if (rainW > 0.005) {
    _topWork.lerp(_cRainTint, 0.72 * rainW);
    _horWork.lerp(_cRainTint, 0.65 * rainW);
    sunWarmth *= (1 - rainW);
    nightAmt *= (1 - 0.85 * rainW);
  }
  if (snowW > 0.005) {
    _topWork.lerp(_cSnowTint, 0.55 * snowW);
    _horWork.lerp(_cSnowTint, 0.50 * snowW);
    sunWarmth *= (1 - 0.75 * snowW);
    nightAmt *= (1 - 0.4 * snowW);
  }

  ctrl.mat.uniforms.uTopColor.value.copy(_topWork);
  ctrl.mat.uniforms.uHorizonColor.value.copy(_horWork);
  ctrl.mat.uniforms.uSunDir.value.set(sunX || 0.4, sY, -0.35).normalize();
  ctrl.mat.uniforms.uSunWarmth.value = sunWarmth;
  if (ctrl.mat.uniforms.uNightAmt) ctrl.mat.uniforms.uNightAmt.value = nightAmt;
  if (ctrl.mat.uniforms.uAuroraStrength) ctrl.mat.uniforms.uAuroraStrength.value = auroraStrength;
  if (ctrl.mat.uniforms.uTime) ctrl.mat.uniforms.uTime.value = envTime || 0;
}
