/**
 * Reflection EnvMap procedural em cache (64x32 Equirectangular pré-compilado via PMREM quando disponível).
 * Dá reflexos realistas a vidros borossilicato, aço inox das autoclaves e capela laminar sem stalls na GPU.
 */

const THREE = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;

function getThree() {
  return (typeof window !== 'undefined' && window.THREE) || (typeof globalThis !== 'undefined' && globalThis.THREE) || THREE;
}

let cachedLabEnvMap = null;
const cachedPmremByRenderer = typeof WeakMap === 'function' ? new WeakMap() : null;

export function getLabEnvironmentMap(renderer = null) {
  const ThreeRef = getThree();
  if (!ThreeRef || typeof ThreeRef.DataTexture !== 'function' || !ThreeRef.EquirectangularReflectionMapping) {
    return null;
  }
  try {
    if (!cachedLabEnvMap) {
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
      const tex = new ThreeRef.DataTexture(data, w, h, ThreeRef.RGBAFormat);
      tex.mapping = ThreeRef.EquirectangularReflectionMapping;
      tex.generateMipmaps = false;
      if (ThreeRef.LinearFilter) {
        tex.minFilter = ThreeRef.LinearFilter;
        tex.magFilter = ThreeRef.LinearFilter;
      }
      tex.needsUpdate = true;
      tex.userData = { shared: true };
      cachedLabEnvMap = tex;
    }

    if (renderer && cachedPmremByRenderer && typeof ThreeRef.PMREMGenerator === 'function') {
      const existing = cachedPmremByRenderer.get(renderer);
      if (existing) return existing;
      try {
        const pmrem = new ThreeRef.PMREMGenerator(renderer);
        if (typeof pmrem.compileEquirectangularShader === 'function') {
          pmrem.compileEquirectangularShader();
        }
        const rt = pmrem.fromEquirectangular(cachedLabEnvMap);
        if (rt && rt.texture) {
          rt.texture.userData = Object.assign({}, rt.texture.userData, { shared: true, _pmremTarget: rt });
          cachedPmremByRenderer.set(renderer, rt.texture);
          pmrem.dispose();
          return rt.texture;
        }
        pmrem.dispose();
      } catch (_pmremErr) {}
    }

    return cachedLabEnvMap;
  } catch (_e) {
    return null;
  }
}
