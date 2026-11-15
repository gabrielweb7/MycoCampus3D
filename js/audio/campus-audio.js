/**
 * MycoCampus3D — Motor de Áudio Procedural Imersivo (Web Audio API)
 * Gera 100% dos efeitos sonoros e ambientação via síntese procedural (0 downloads de áudio).
 * Centraliza todos os SFX do jogo (passos, colheita, spray, clique, porta, pickup, switch, laser, vapor).
 */
(function () {
  'use strict';

  var audioCtx = null;
  var masterGain = null;
  var isMuted = false;
  var lastFootstepAt = 0;
  var steamNode = null;
  var steamGain = null;

  try {
    isMuted = localStorage.getItem('myco_audio_muted') === 'true';
  } catch (e) { /* ignore */ }

  function getAudioContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function unlockAudio() {
    var ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
  }
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // 1. Passos Dinâmicos por Tipo de Piso
  function playFootstep(surface) {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = performance.now();
    if (now - lastFootstepAt < 280) return;
    lastFootstepAt = now;

    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();

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

  // 2. Colheita de Cogumelo (Arpejo Mágico Brilhante)
  function playHarvest() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    var notes = [523.25, 659.25, 783.99, 1046.50]; // Dó5, Mi5, Sol5, Dó6
    notes.forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.055);
      gain.gain.setValueAtTime(0.001, t + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.055 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.35);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.4);
    });
  }

  // 3. Borrifada de Spray de Água / Álcool 70% (Ruído Branco Filtrado)
  function playSpray() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var bufferSize = Math.floor(ctx.sampleRate * 0.22);
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    var noise = ctx.createBufferSource();
    noise.buffer = buffer;

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, ctx.currentTime);
    filter.Q.setValueAtTime(1.2, ctx.currentTime);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
  }

  // 4. Clique UI / Botão / Interruptor
  function playClick() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.04);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // 4b. Interruptor / Switch mecânico
  function playSwitch() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.04);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // 4c. Pegar / Soltar item
  function playPickup() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(460, t + 0.07);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.085);
  }

  // 5. Porta Abrindo / Fechando
  function playDoor() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.linearRampToValueAtTime(110, t + 0.16);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // 6. Emote Divertido
  function playEmote(type) {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    if (type === 'wave' || type === 'cheer') {
      var notes = type === 'cheer' ? [523, 659, 784, 1046] : [440, 554, 659];
      notes.forEach(function (f, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t + i * 0.08);
        gain.gain.setValueAtTime(0.22, t + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.28);
      });
    } else if (type === 'dance') {
      [261, 329, 392, 329, 523].forEach(function (f, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t + i * 0.11);
        gain.gain.setValueAtTime(0.2, t + i * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.1);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t + i * 0.11);
        osc.stop(t + i * 0.11 + 0.12);
      });
    } else if (type === 'meditate') {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, t);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + 1.9);
    }
  }

  // 7. Vapor Contínuo da Panela de Pressão
  function setPressureCookerSteam(active) {
    var ctx = getAudioContext();
    if (!ctx) return;
    if (active && !steamNode) {
      var bufferSize = ctx.sampleRate * 2;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      steamNode = ctx.createBufferSource();
      steamNode.buffer = buffer;
      steamNode.loop = true;
      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(4800, ctx.currentTime);
      filter.Q.setValueAtTime(3.5, ctx.currentTime);
      steamGain = ctx.createGain();
      steamGain.gain.setValueAtTime(isMuted ? 0 : 0.16, ctx.currentTime);
      steamNode.connect(filter);
      filter.connect(steamGain);
      steamGain.connect(masterGain);
      steamNode.start();
    } else if (!active && steamNode) {
      try { steamNode.stop(); } catch (e) {}
      steamNode = null;
      steamGain = null;
    }
  }

  // 8. Bipe do Termômetro Laser Infravermelho
  function playLaserBeep() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
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

  // 9. Controle de Mudo / Desmudo
  function toggleMute() {
    isMuted = !isMuted;
    try {
      localStorage.setItem('myco_audio_muted', isMuted ? 'true' : 'false');
    } catch (e) {}
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
    }
    if (steamGain && audioCtx) {
      steamGain.gain.setValueAtTime(isMuted ? 0 : 0.16, audioCtx.currentTime);
    }
    return isMuted;
  }

  window.MycoAudio = {
    playFootstep: playFootstep,
    playHarvest: playHarvest,
    playSpray: playSpray,
    playClick: playClick,
    playSwitch: playSwitch,
    playPickup: playPickup,
    playDoor: playDoor,
    playEmote: playEmote,
    playLaserBeep: playLaserBeep,
    setSteam: setPressureCookerSteam,
    toggleMute: toggleMute,
    isMuted: function () { return isMuted; },
    unlock: unlockAudio
  };
})();
