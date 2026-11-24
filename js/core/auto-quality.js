/** Decisions are made from one-second FPS samples, never from a single frame. */
export const AUTO_BAD_FPS = 30;
export const AUTO_GOOD_FPS = 52;
export const AUTO_BAD_SAMPLES = 12;
export const AUTO_GOOD_SAMPLES = 90;
export const AUTO_PROBE_SAMPLES = 12;
export const AUTO_PROBE_SCALE = 0.85;
const RETRY_DELAY_MS = 180000;
const TIERS = ['high', 'medium', 'low', 'min'];

export function createAutoQualityController() {
  let phase = 'stable';
  let lowCount = 0;
  let lowSum = 0;
  let highCount = 0;
  let highSum = 0;
  let stableCount = 0;
  let samples = 0;
  let sum = 0;
  let results = [];
  let upgradeFrom = null;
  let retryAfter = 0;

  function clearSamples() {
    lowCount = 0; lowSum = 0; highCount = 0; highSum = 0; stableCount = 0;
    samples = 0; sum = 0;
  }
  function reset() {
    phase = 'stable'; results = []; upgradeFrom = null; retryAfter = 0;
    clearSamples();
  }
  function pause() {
    const previous = phase === 'up' ? upgradeFrom : (phase === 'down' ? results[0] : null);
    phase = 'stable'; results = []; upgradeFrom = null;
    clearSamples();
    return previous;
  }
  function change(config) {
    samples = 0; sum = 0; lowCount = 0; lowSum = 0; highCount = 0; highSum = 0; stableCount = 0;
    return { type: 'change', tier: config.tier, scale: config.scale };
  }
  function settle(config, now) {
    phase = 'stable'; results = []; upgradeFrom = null;
    clearSamples();
    retryAfter = now + RETRY_DELAY_MS;
    return { type: 'settle', tier: config.tier, scale: config.scale };
  }
  function nextLower(config) {
    if (config.scale > AUTO_PROBE_SCALE + 0.01) return { tier: config.tier, scale: AUTO_PROBE_SCALE };
    const index = TIERS.indexOf(config.tier);
    return index >= 0 && index < TIERS.length - 1 ? { tier: TIERS[index + 1], scale: 1 } : null;
  }
  function chooseBest() {
    const best = Math.max(...results.map((entry) => entry.fps));
    // Results are ordered from highest visual quality to lowest. Prefer the
    // first within a small margin of the fastest when none reaches 30 FPS.
    const tolerance = Math.max(2, best * 0.08);
    return results.find((entry) => entry.fps >= best - tolerance);
  }

  return {
    reset,
    pause,
    observe(fps, now, config) {
      if (!Number.isFinite(fps) || fps <= 0 || !TIERS.includes(config.tier)) return null;
      if (phase === 'down' || phase === 'up') {
        samples++; sum += fps;
        if (samples < AUTO_PROBE_SAMPLES) return null;
        const measured = { tier: config.tier, scale: config.scale, fps: sum / samples };
        if (phase === 'up') {
          const acceptable = measured.fps >= Math.max(AUTO_BAD_FPS + 2, upgradeFrom.fps * 0.90);
          return settle(acceptable ? measured : upgradeFrom, now);
        }
        results.push(measured);
        if (measured.fps >= AUTO_BAD_FPS + 2) return settle(measured, now);
        const next = nextLower(measured);
        return next ? change(next) : settle(chooseBest(), now);
      }

      if (fps < AUTO_BAD_FPS) {
        lowCount++; lowSum += fps; highCount = 0; highSum = 0; stableCount = 0;
        if (lowCount >= AUTO_BAD_SAMPLES && now >= retryAfter) {
          const baseline = { tier: config.tier, scale: config.scale, fps: lowSum / lowCount };
          const next = nextLower(config);
          if (!next) return settle(baseline, now);
          results = [baseline]; phase = 'down';
          return change(next);
        }
      } else {
        lowCount = 0; lowSum = 0; stableCount++;
        if (fps >= AUTO_GOOD_FPS && now >= retryAfter) {
          highCount++; highSum += fps;
          if (highCount >= AUTO_GOOD_SAMPLES) {
            const index = TIERS.indexOf(config.tier);
            const next = config.scale < 0.99 ? { tier: config.tier, scale: 1 }
              : (index > 0 ? { tier: TIERS[index - 1], scale: 1 } : null);
            if (next) {
              upgradeFrom = { tier: config.tier, scale: config.scale, fps: highSum / highCount };
              phase = 'up';
              return change(next);
            }
          }
        } else { highCount = 0; highSum = 0; }
        // Persist only after a sustained acceptable period, not during a probe.
        if (stableCount === AUTO_PROBE_SAMPLES) return { type: 'save', tier: config.tier, scale: config.scale };
      }
      return null;
    }
  };
}
