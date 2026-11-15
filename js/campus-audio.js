/**
 * MycoCampus3D — Motor de Áudio Procedural Imersivo (Web Audio API)
 * Gera 100% dos efeitos sonoros e ambientação via síntese procedural (0 downloads de áudio).
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
      // Ponte arqueada / decks de madeira: grave oco e ressonante
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
      // Grama / Floresta: estalinho fofo e macio
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
      // Piso epóxi do laboratório: estalo agudo sutil de sola de borracha
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
      // Bloquetes de pedra / praça
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
    var notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach(function (freq, i) {
      var t = ctx.currentTime + i * 0.065;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
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

  // 3. Borrifador de Álcool 70% / Água (Spray de Ruído Branco Filtrado)
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
    filter.Q.setValueAtTime(1.8, ctx.currentTime);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.38, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start();
  }

  // 4. Clique Mecânico de Interruptor / Botão
  function playClick() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
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

  // 5. Porta de Madeira Abrindo / Fechando
  function playDoor(open) {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
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

  // 6. Sons de Emotes (Comemoração, Dança, Tchau)
  function playEmote(type) {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var t = ctx.currentTime;
    if (type === 'cheer') {
      // Fanfarra alegre
      [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach(function (f, i) {
        var st = t + i * 0.055;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, st);
        gain.gain.setValueAtTime(0.24, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.28);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(st);
        osc.stop(st + 0.3);
      });
    } else if (type === 'wave') {
      // Som simpático de "oi" / dois tons agudos suaves
      [880, 1174.66].forEach(function (f, i) {
        var st = t + i * 0.09;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, st);
        gain.gain.setValueAtTime(0.18, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.16);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(st);
        osc.stop(st + 0.18);
      });
    } else if (type === 'dance') {
      // Beat lo-fi de 4 notas sincopadas
      [261.63, 329.63, 392.00, 523.25].forEach(function (f, i) {
        var st = t + i * 0.11;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, st);
        gain.gain.setValueAtTime(0.20, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.14);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(st);
        osc.stop(st + 0.15);
      });
    } else if (type === 'meditate') {
      // Tigela tibetana / sino zen com fade longo
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, t); // 432 Hz harmônico
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

  // 9. Som de Interruptor / Botão Físico
  function playSwitch() {
    if (isMuted) return;
    var ctx = getAudioContext();
    if (!ctx) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
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

  // 10. Controle de Mudo / Desmudo
  function toggleMute() {
    isMuted = !isMuted;
    try {
      localStorage.setItem('myco_audio_muted', isMuted ? 'true' : 'false');
    } catch (e) {}
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
    }
    return isMuted;
  }

  window.MycoAudio = {
    playFootstep: playFootstep,
    playHarvest: playHarvest,
    playSpray: playSpray,
    playClick: playClick,
    playDoor: playDoor,
    playEmote: playEmote,
    playLaserBeep: playLaserBeep,
    playSwitch: playSwitch,
    setSteam: setPressureCookerSteam,
    toggleMute: toggleMute,
    isMuted: function () { return isMuted; },
    unlock: unlockAudio
  };
})();
