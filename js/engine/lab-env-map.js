/**
 * Reflection EnvMap procedural em cache (64x32 Equirectangular, zero alocacao por frame).
 * Da reflexos realistas a vidros borossilicato, aço inox das autoclaves e capela laminar.
 */

const THREE = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;

let cachedLabEnvMap = null;

export function getLabEnvironmentMap() {
  if (cachedLabEnvMap) return cachedLabEnvMap;
  if (!THREE || typeof THREE.DataTexture !== 'function' || !THREE.EquirectangularReflectionMapping) {
    return null;
  }
  try {
    const w = 64;
    const h = 32;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1); // 0 = bottom, 1 = zenith
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const stripe = Math.pow(Math.max(0, Math.sin(u * Math.PI * 4)), 6) * (v > 0.55 && v < 0.85 ? 1 : 0.25);
        const sky = Math.max(0, Math.min(1, (v - 0.35) / 0.65));
        const r = Math.min(255, Math.round(42 + sky * 165 + stripe * 75));
        const g = Math.min(255, Math.round(52 + sky * 178 + stripe * 80));
        const b = Math.min(255, Math.round(68 + sky * 182 + stripe * 85));
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    tex.userData = { shared: true };
    cachedLabEnvMap = tex;
    return cachedLabEnvMap;
  } catch (_e) {
    return null;
  }
}
