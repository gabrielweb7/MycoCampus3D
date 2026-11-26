/**
 * Preferência de sensibilidade da câmera (Mouse e Toque), persistida por navegador.
 */
const CAM_SENS_KEY = 'myco_cam_sens';
let cachedSensitivity = null;

export function getCameraSensitivity() {
  if (cachedSensitivity !== null) return cachedSensitivity;
  let val = 1.0;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = parseFloat(localStorage.getItem(CAM_SENS_KEY));
      if (Number.isFinite(raw) && raw >= 0.4 && raw <= 2.5) val = raw;
    }
  } catch (e) {}
  cachedSensitivity = val;
  return val;
}

export function setCameraSensitivity(val) {
  const num = Math.max(0.4, Math.min(2.5, Number(val) || 1.0));
  const rounded = Math.round(num * 10) / 10;
  cachedSensitivity = rounded;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CAM_SENS_KEY, String(rounded));
    }
  } catch (e) {}
  return rounded;
}
