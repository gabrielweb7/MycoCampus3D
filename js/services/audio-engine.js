/**
 * MycoCampus3D — Motor de Áudio Procedural Imersivo (Web Audio API)
 * Gera 100% dos efeitos sonoros via síntese procedural (0 downloads de áudio).
 */

let audioCtx = null;
let masterGain = null;
let isMuted = false;
let userHasGestured = false;
let lastFootstepAt = 0;
let steamNode = null;
let steamGain = null;
let _sprayBuf = null;
let _sprayBufRate = 0;
let _steamBuf = null;
let _steamBufRate = 0;

try {
  isMuted = localStorage.getItem('myco_audio_muted') === 'true';
} catch (e) { /* ignore */ }

function getAudioContext() {
  if (!audioCtx) {
    if (!userHasGestured) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended' && userHasGestured) {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlock() {
  userHasGestured = true;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

window.addEventListener('click', unlock, { once: true });
window.addEventListener('touchstart', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

export function playFootstep(surface) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = performance.now();
  if (now - lastFootstepAt < 280) return;
  lastFootstepAt = now;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  if (surface === 'wood') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110 + Math.random() * 25, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, t);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t);
    osc.stop(t + 0.1);
  } else if (surface === 'grass' || surface === 'dirt') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 + Math.random() * 20, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.06);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.start(t);
    osc.stop(t + 0.08);
  } else if (surface === 'lab') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 + Math.random() * 40, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.05);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, t);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.start(t);
    osc.stop(t + 0.07);
  } else {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 30, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.06);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    gain.gain.setValueAtTime(0.20, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.start(t);
    osc.stop(t + 0.08);
  }
}

export function playHarvest() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.065;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}

export function playSpray() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (!_sprayBuf || _sprayBufRate !== ctx.sampleRate) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    _sprayBuf = buffer;
    _sprayBufRate = ctx.sampleRate;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = _sprayBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3200, ctx.currentTime);
  filter.Q.setValueAtTime(1.8, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.38, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  noise.start();
}

export function playClick() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(350, t + 0.025);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.035);
}

export function playDoor(open) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(open ? 160 : 210, t);
  osc.frequency.linearRampToValueAtTime(open ? 260 : 130, t + 0.14);
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.18);
}

export function playEmote(type) {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const seq = (freqs, oscType, step, dur, vol) => {
    freqs.forEach((f, i) => {
      const st = t + i * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = oscType;
      osc.frequency.setValueAtTime(f, st);
      gain.gain.setValueAtTime(vol, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + dur);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(st);
      osc.stop(st + dur + 0.02);
    });
  };

  if (type === 'cheer') seq([523.25, 659.25, 783.99, 1046.50, 1318.51], 'triangle', 0.055, 0.28, 0.24);
  else if (type === 'wave') seq([880, 1174.66], 'sine', 0.09, 0.16, 0.18);
  else if (type === 'dance') seq([261.63, 329.63, 392.00, 523.25], 'triangle', 0.11, 0.14, 0.20);
  else if (type === 'meditate') seq([432], 'sine', 0, 1.8, 0.28);
}

function stopSteamNode() {
  if (steamNode) {
    try { steamNode.stop(); } catch (e) {}
    try { steamNode.disconnect(); } catch (e) {}
    steamNode = null;
  }
  if (steamGain) {
    try { steamGain.disconnect(); } catch (e) {}
    steamGain = null;
  }
}

export function setSteam(active, volume) {
  const vol = (typeof volume === 'number') ? Math.max(0, Math.min(1, volume)) : (active ? 1 : 0);
  if (!active || isMuted || vol <= 0.01) {
    stopSteamNode();
    return;
  }
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;
  const targetGain = 0.125 * vol;
  if (!steamNode) {
    if (!_steamBuf || _steamBufRate !== ctx.sampleRate) {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.08 * white) / 1.08;
        data[i] = lastOut * 2.2;
      }
      _steamBuf = buffer;
      _steamBufRate = ctx.sampleRate;
    }
    steamNode = ctx.createBufferSource();
    steamNode.buffer = _steamBuf;
    steamNode.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2700, ctx.currentTime);
    filter.Q.setValueAtTime(1.9, ctx.currentTime);
    steamGain = ctx.createGain();
    steamGain.gain.setValueAtTime(targetGain, ctx.currentTime);
    steamNode.connect(filter);
    filter.connect(steamGain);
    steamGain.connect(masterGain);
    steamNode.start();
  } else if (steamGain) {
    steamGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
  }
}

export function playLaserBeep() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

export function playSwitch() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(360, now + 0.04);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.045);
}

export function toggleMute() {
  isMuted = !isMuted;
  if (isMuted) stopSteamNode();
  try {
    localStorage.setItem('myco_audio_muted', isMuted ? 'true' : 'false');
  } catch (e) {}
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
  }
  return isMuted;
}

export function getIsMuted() {
  return isMuted;
}

export function playGnomeGiggle() {
  if (isMuted || !audioCtx || !masterGain) return;
  const now = audioCtx.currentTime;
  [680, 860, 1020, 790].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    const t = now + i * 0.065;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.18, t + 0.05);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  });
}

export function playUmbralWhisper() {
  if (isMuted || !audioCtx || !masterGain) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(98, now);
  osc.frequency.exponentialRampToValueAtTime(58, now + 0.45);
  g.gain.setValueAtTime(0.11, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.52);
}

export function playBoing() {
  if (isMuted || !audioCtx || !masterGain) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.24);
  g.gain.setValueAtTime(0.16, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.34);
}

export function playUfoBeam() {
  if (isMuted || !audioCtx || !masterGain) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.linearRampToValueAtTime(340, now + 1.8);
  lfo.frequency.setValueAtTime(7, now);
  lfoGain.gain.setValueAtTime(35, now);
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.11, now + 0.35);
  g.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(now);
  lfo.start(now);
  osc.stop(now + 2.25);
  lfo.stop(now + 2.25);
}

export function playGreenhouseDoorBeep() {
  const c = getAudioContext();
  if (!c || getIsMuted()) return;
  try {
    const t = c.currentTime;
    const tones = [1760, 1320];
    for (let i = 0; i < tones.length; i++) {
      const osc = c.createOscillator();
      const g = c.createGain();
      const start = t + i * 0.14;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(tones[i], start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.14, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.13);
    }
  } catch (e) {}
}

export const AudioEngine = {
  playFootstep,
  playHarvest,
  playSpray,
  playClick,
  playDoor,
  playEmote,
  playLaserBeep,
  playGreenhouseDoorBeep,
  playSwitch,
  playGnomeGiggle,
  playUmbralWhisper,
  playBoing,
  playUfoBeam,
  setSteam,
  toggleMute,
  isMuted: getIsMuted,
  unlock
};

// Ponte de compatibilidade durante a migração incremental
if (typeof window !== 'undefined') {
  window.MycoAudio = AudioEngine;
}
