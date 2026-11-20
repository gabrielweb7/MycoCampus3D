/**
 * Céu em Gradiente Atmosférico (MycoCampus3D) — 1 único draw call, zero alocações por frame.
 * Dá transição suave do horizonte (Golden Hour / Dia Azul / Noite Estrelada) combinando com a névoa.
 */

const THREE = (typeof window !== 'undefined' ? window.THREE : null) || globalThis.THREE || null;
const _ColorCtor = THREE && THREE.Color ? THREE.Color : null;

const _cTopDay = _ColorCtor ? new _ColorCtor(0x1d4ed8) : null;
const _cTopSunset = _ColorCtor ? new _ColorCtor(0x6d28d9) : null;
const _cTopNight = _ColorCtor ? new _ColorCtor(0x020617) : null;

const _cHorDay = _ColorCtor ? new _ColorCtor(0x93c5fd) : null;
const _cHorSunset = _ColorCtor ? new _ColorCtor(0xfb923c) : null;
const _cHorNight = _ColorCtor ? new _ColorCtor(0x0f172a) : null;

const _cRainTint = _ColorCtor ? new _ColorCtor(0x475569) : null;
const _cOverTint = _ColorCtor ? new _ColorCtor(0x94a3b8) : null;
const _cSnowTint = _ColorCtor ? new _ColorCtor(0xcbd5e1) : null;

const _topWork = _ColorCtor ? new _ColorCtor() : null;
const _horWork = _ColorCtor ? new _ColorCtor() : null;

export function createSkyGradientDome(scene) {
  if (!THREE || !scene || !THREE.ShaderMaterial || !THREE.SphereGeometry) return null;

  const geo = new THREE.SphereGeometry(62, 24, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uTopColor: { value: _cTopDay.clone() },
      uHorizonColor: { value: _cHorDay.clone() },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.3) },
      uSunWarmth: { value: 0.25 }
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
      varying vec3 vWorldDir;
      void main() {
        float h = clamp(vWorldDir.y, 0.0, 1.0);
        float curve = pow(h, 0.58);
        vec3 col = mix(uHorizonColor, uTopColor, curve);
        float sunAmt = max(0.0, dot(normalize(vWorldDir), normalize(uSunDir)));
        col += vec3(1.0, 0.72, 0.42) * pow(sunAmt, 7.0) * uSunWarmth;
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

export function stepSkyGradientDome(ctrl, camPos, sunX, sunY, weatherMode, weatherBlend) {
  if (!ctrl || !ctrl.mesh || !ctrl.mat || !_topWork || !_horWork) return;
  if (camPos) {
    ctrl.mesh.position.set(camPos.x, camPos.y, camPos.z);
  }

  const sY = typeof sunY === 'number' ? sunY : 0.4;
  _topWork.copy(_cTopDay);
  _horWork.copy(_cHorDay);
  let sunWarmth = 0.20;

  if (sY < 0.24 && sY > -0.18) {
    const sT = Math.max(0, Math.min(1, 1 - Math.abs(sY - 0.03) / 0.21));
    _topWork.lerp(_cTopSunset, sT * 0.85);
    _horWork.lerp(_cHorSunset, sT);
    sunWarmth = 0.20 + sT * 0.30;
  } else if (sY <= -0.18) {
    const nT = Math.min(1, (-sY - 0.18) / 0.24);
    _topWork.lerp(_cTopNight, nT);
    _horWork.lerp(_cHorNight, nT);
    sunWarmth = 0.0;
  }

  const wb = weatherBlend || null;
  const overW = wb ? (wb.overcast || 0) : (weatherMode === 'overcast' ? 1 : 0);
  const rainW = wb ? (wb.rain || 0) : (weatherMode === 'rain' ? 1 : 0);
  const snowW = wb ? (wb.snow || 0) : (weatherMode === 'snow' ? 1 : 0);

  if (overW > 0.005) {
    _topWork.lerp(_cOverTint, 0.48 * overW);
    _horWork.lerp(_cOverTint, 0.42 * overW);
    sunWarmth *= (1 - 0.65 * overW);
  }
  if (rainW > 0.005) {
    _topWork.lerp(_cRainTint, 0.72 * rainW);
    _horWork.lerp(_cRainTint, 0.65 * rainW);
    sunWarmth *= (1 - rainW);
  }
  if (snowW > 0.005) {
    _topWork.lerp(_cSnowTint, 0.55 * snowW);
    _horWork.lerp(_cSnowTint, 0.50 * snowW);
    sunWarmth *= (1 - 0.75 * snowW);
  }

  ctrl.mat.uniforms.uTopColor.value.copy(_topWork);
  ctrl.mat.uniforms.uHorizonColor.value.copy(_horWork);
  ctrl.mat.uniforms.uSunDir.value.set(sunX || 0.4, sY, -0.35).normalize();
  ctrl.mat.uniforms.uSunWarmth.value = sunWarmth;
}
