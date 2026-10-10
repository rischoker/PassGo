// ============================================================
// AUDIO — ambient soundscape + music + sound effects.
// Everything is synthesised live with the Web Audio API, so there
// are no audio files to host and the single-file build stays small.
//
//   PassAudio.unlock()      call from a user gesture (tap/click/key)
//   PassAudio.sfx(name)     one-shot effects (see SFX below)
//   PassAudio.duck(true)    lower music/ambience during learning activities
//   PassAudio.setVolume(v)  0..1, remembered per browser
// Browsers block autoplay, so nothing starts until the first gesture.
// ============================================================
const PassAudio = (() => {
  const PREF_KEY = "passgo_audio_v1";
  let prefs = { volume: 0.6, music: 0.6, muted: false };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} };

  let ctx = null, master, musicBus, ambBus, sfxBus, noiseBuf, brownBuf;
  let started = false, ducked = false, scene = "none", voiceDuck = false;
  const timers = [];
  const listeners = [];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function makeNoise(seconds, brown) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    // loudness chain: gentle glue compressor -> make-up gain -> brick-wall limiter
    // (the synth voices are soft by design, so the whole mix is lifted here)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -30; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    const makeup = ctx.createGain(); makeup.gain.value = 3.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
    master.connect(comp).connect(makeup).connect(limiter).connect(ctx.destination);
    musicBus = ctx.createGain(); ambBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(master); ambBus.connect(master); sfxBus.connect(master);
    sfxBus.gain.value = 1.4;
    noiseBuf = makeNoise(2, false);
    brownBuf = makeNoise(6, true);
    applyVolume(true);
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else if (started) ctx.resume();
    });
    return true;
  }

  function applyVolume(instant) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = prefs.muted ? 0 : prefs.volume;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(v, t, instant ? 0.01 : 0.15);
    const duckF = ducked ? 0.12 : 1;
    const musicOn = scene === "map" || scene === "create";
    musicBus.gain.setTargetAtTime((scene === "create" ? 0.7 : 0.55) * prefs.music * duckF * (voiceDuck ? 0.25 : 1) * (musicOn ? 1 : 0), t, 0.6);
    ambBus.gain.setTargetAtTime(0.4 * (ducked ? 0.25 : 1) * (scene === "none" ? 0 : (scene === "intro" || scene === "create") ? 0.4 : 1), t, 0.6);
  }

  // ---------- small synth helpers ----------
  function env(g, t, a, peak, decay, sustain = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + decay);
  }
  function tone({ freq, type = "sine", t = ctx.currentTime, a = 0.005, peak = 0.2, decay = 0.4, dest = sfxBus, detune = 0, pan = 0, glideTo = null, glideTime = 0.1 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + glideTime);
    env(g, t, a, peak, decay);
    let out = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(g); out.connect(dest);
    o.start(t); o.stop(t + a + decay + 0.05);
  }
  function noiseBurst({ t = ctx.currentTime, dur = 0.2, peak = 0.2, type = "bandpass", f = 1200, f2 = null, q = 1, dest = sfxBus, a = 0.01, pan = 0 }) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    let out = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    s.connect(fl).connect(g); out.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
  }
  // soft marimba / kalimba voice
  function mallet(freq, t, vel = 0.12, dest = musicBus, pan = 0) {
    tone({ freq, type: "sine", t, a: 0.004, peak: vel, decay: 0.9, dest, pan });
    tone({ freq: freq * 4, type: "sine", t, a: 0.002, peak: vel * 0.18, decay: 0.12, dest, pan });
    tone({ freq: freq * 2.01, type: "triangle", t, a: 0.003, peak: vel * 0.12, decay: 0.35, dest, pan });
  }
  function chime(freq, t, vel = 0.1, pan = 0) {
    tone({ freq, t, a: 0.003, peak: vel, decay: 1.2, pan });
    tone({ freq: freq * 2.76, t, a: 0.002, peak: vel * 0.35, decay: 0.5, pan });
    tone({ freq: freq * 5.4, t, a: 0.002, peak: vel * 0.12, decay: 0.25, pan });
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz

  // ---------- ambience ----------
  function loopSource(buf, dest, filterType, freq, q, gain) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f).connect(g).connect(dest); s.start();
    return { s, f, g };
  }
  function startAmbience() {
    // waves: brown noise, slow irregular swells
    const waves = loopSource(brownBuf, ambBus, "lowpass", 520, 0.5, 0.0);
    const waves2 = loopSource(noiseBuf, ambBus, "bandpass", 900, 0.4, 0.0);
    (function swell() {
      const t = ctx.currentTime, dur = rnd(4.5, 8.5), peak = rnd(0.16, 0.28);
      waves.g.gain.setTargetAtTime(peak, t, dur * 0.28);
      waves.g.gain.setTargetAtTime(0.05, t + dur * 0.55, dur * 0.3);
      waves2.g.gain.setTargetAtTime(peak * 0.08, t + dur * 0.35, dur * 0.15);   // foam hiss at the crest
      waves2.g.gain.setTargetAtTime(0.004, t + dur * 0.6, dur * 0.2);
      waves.f.frequency.setTargetAtTime(rnd(420, 700), t, dur * 0.4);
      timers.push(setTimeout(swell, dur * 1000));
    })();
    // wind: band-passed noise with a slowly wandering centre
    const wind = loopSource(noiseBuf, ambBus, "bandpass", 500, 0.8, 0.018);
    (function gust() {
      const t = ctx.currentTime, d = rnd(5, 11);
      wind.f.frequency.setTargetAtTime(rnd(280, 900), t, d * 0.4);
      wind.g.gain.setTargetAtTime(rnd(0.008, 0.03), t, d * 0.4);
      timers.push(setTimeout(gust, d * 1000));
    })();
    // birds & other nature sounds, now and then
    (function critters() {
      const r = Math.random();
      if (r < 0.55) bird(); else if (r < 0.68) leaves(); else if (r < 0.8) distantParrot(); else if (r < 0.9) cityBell(); else insects();
      timers.push(setTimeout(critters, rnd(2500, 8000)));
    })();
  }
  function bird() {
    const t0 = ctx.currentTime + 0.05, pan = rnd(-0.8, 0.8), kind = Math.floor(Math.random() * 3);
    const base = rnd(2400, 3600), n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (kind === 1 ? 0.07 : rnd(0.12, 0.2));
      if (kind === 0) tone({ freq: base, glideTo: base * 1.35, glideTime: 0.06, t, a: 0.005, peak: 0.022, decay: 0.08, dest: ambBus, pan });
      else if (kind === 1) tone({ freq: base * 1.2, glideTo: base * 0.9, glideTime: 0.04, t, a: 0.003, peak: 0.015, decay: 0.05, dest: ambBus, pan });
      else tone({ freq: base * 0.8, glideTo: base * 0.55, glideTime: 0.22, t, a: 0.02, peak: 0.018, decay: 0.25, dest: ambBus, pan });
    }
  }
  function cityBell() { const t = ctx.currentTime, pan = rnd(-0.8, 0.8); [0, 0.22].forEach(d => { tone({ freq: 1320, t: t + d, peak: 0.012, decay: 0.6, dest: ambBus, pan }); tone({ freq: 1760, t: t + d, peak: 0.006, decay: 0.4, dest: ambBus, pan }); }); }
  function leaves() { noiseBurst({ dur: rnd(0.6, 1.2), peak: 0.02, type: "highpass", f: 3500, a: 0.3, dest: ambBus, pan: rnd(-0.6, 0.6) }); }
  function insects() {
    const t0 = ctx.currentTime, pan = rnd(-0.7, 0.7);
    for (let i = 0; i < 10; i++) tone({ freq: 4700, t: t0 + i * 0.06, a: 0.004, peak: 0.006, decay: 0.03, dest: ambBus, pan });
  }
  function distantParrot() {
    const t = ctx.currentTime, pan = rnd(-0.9, 0.9);
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1100, t + 0.08); o.frequency.linearRampToValueAtTime(820, t + 0.22);
    f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 3;
    env(g, t, 0.02, 0.012, 0.25);
    let out = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    o.connect(f).connect(g); out.connect(ambBus); o.start(t); o.stop(t + 0.35);
  }

  // ---------- generative music (gentle jungle adventure) ----------
  // two moods: "map" = gentle adventure (84 bpm), "create" = bouncy character-creation theme (112 bpm)
  const STYLES = {
    map:    { bpm: 84,  chords: [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]], scale: [60, 62, 64, 67, 69, 72, 74, 76, 79], density: 0.55 },
    create: { bpm: 112, chords: [[48, 55, 64, 67], [53, 57, 60, 65], [45, 52, 60, 64], [43, 50, 59, 62]], scale: [67, 69, 72, 74, 76, 79, 81, 84], density: 0.8 }
  };
  let nextBeat = 0, beat = 0;
  function startMusic() {
    nextBeat = ctx.currentTime + 0.3;
    (function sched() {
      const st = STYLES[scene === "create" ? "create" : "map"];
      const spb = 60 / st.bpm;
      while (nextBeat < ctx.currentTime + 0.4) {
        const bar = Math.floor(beat / 4), chord = st.chords[Math.floor(bar / 2) % st.chords.length];
        const inBar = beat % 4;
        if (scene === "create") {
          // bass on 1 and 3, arpeggio on eighths, hand-claps on 2 and 4
          if (inBar % 2 === 0) tone({ freq: N(chord[0] - 12), type: "triangle", t: nextBeat, a: 0.005, peak: 0.13, decay: 0.32, dest: musicBus });
          for (let h = 0; h < 2; h++) mallet(N(chord[(beat * 2 + h) % 4] + 12), nextBeat + h * spb / 2, 0.05, musicBus, h ? 0.3 : -0.3);
          if (inBar % 2 === 1) noiseBurst({ t: nextBeat, dur: 0.07, peak: 0.05, type: "bandpass", f: 1800, q: 1.2, dest: musicBus, a: 0.002 });
          if (Math.random() < 0.45 && inBar === 3) mallet(N(pick(st.scale)), nextBeat + spb / 2, 0.06, musicBus, rnd(-0.3, 0.3));
          if (inBar === 0 && bar % 2 === 0) playPad(chord, nextBeat, spb * 8);
        } else {
          if (inBar === 0 && bar % 2 === 0) playPad(chord, nextBeat, spb * 8);
          if (inBar === 0) mallet(N(chord[0]), nextBeat, 0.07, musicBus, -0.2);
          if (Math.random() < st.density) {
            const n = pick(st.scale.filter(sc => chord.some(c => (sc - c) % 12 === 0) || Math.random() < 0.35));
            mallet(N(n), nextBeat, 0.06, musicBus, rnd(-0.3, 0.4));
            if (Math.random() < 0.3) mallet(N(pick(st.scale)), nextBeat + spb / 2, 0.045, musicBus, rnd(-0.3, 0.4));
          }
        }
        if (Math.random() < 0.7) noiseBurst({ t: nextBeat + spb / 2, dur: 0.05, peak: 0.012, type: "highpass", f: 6000, dest: musicBus, a: 0.005 });
        nextBeat += spb; beat++;
      }
      timers.push(setTimeout(sched, 120));
    })();
  }
  function playPad(chord, t, dur) {
    chord.forEach((m, i) => {
      [-7, 7].forEach(det => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = "triangle"; o.frequency.value = N(m); o.detune.value = det;
        f.type = "lowpass"; f.frequency.value = 900;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.012, t + 1.2);
        g.gain.setValueAtTime(0.012, t + dur - 1.2);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
        o.connect(f).connect(g).connect(musicBus);
        o.start(t); o.stop(t + dur + 0.5);
      });
    });
  }

  // ---------- sound effects ----------
  const SFX = {
    click() { noiseBurst({ dur: 0.05, peak: 0.12, type: "bandpass", f: 900, q: 4, a: 0.002 }); tone({ freq: 320, t: ctx.currentTime, peak: 0.06, decay: 0.08 }); },
    locked() { tone({ freq: 140, type: "triangle", peak: 0.12, decay: 0.18 }); noiseBurst({ dur: 0.08, peak: 0.06, type: "lowpass", f: 500 }); },
    page() { noiseBurst({ dur: 0.18, peak: 0.08, type: "bandpass", f: 2500, f2: 1200, q: 0.8, a: 0.02 }); },
    open() {
      const t = ctx.currentTime;
      noiseBurst({ t, dur: 0.9, peak: 0.07, type: "bandpass", f: 400, f2: 3000, q: 0.7, a: 0.25 });
      [72, 76, 79, 84, 88].forEach((m, i) => chime(N(m), t + 0.25 + i * 0.09, 0.05, rnd(-0.4, 0.4)));
    },
    sparkle() { const t = ctx.currentTime; [88, 91, 96].forEach((m, i) => chime(N(m), t + i * 0.06, 0.03, rnd(-0.5, 0.5))); },
    welcome() {
      const t = ctx.currentTime;
      [[67, 0], [72, 0.18], [76, 0.36], [79, 0.54], [84, 0.8]].forEach(([m, d]) => mallet(N(m), t + d, 0.12, sfxBus));
      [60, 64, 67].forEach(m => tone({ freq: N(m), type: "triangle", t: t + 0.8, a: 0.2, peak: 0.03, decay: 1.8 }));
    },
    reveal() {
      const t = ctx.currentTime;
      noiseBurst({ t, dur: 1.6, peak: 0.05, type: "bandpass", f: 600, f2: 4000, q: 0.5, a: 0.6 });
      [84, 88, 91, 96, 100].forEach((m, i) => chime(N(m), t + 0.2 + i * 0.12, 0.025, rnd(-0.6, 0.6)));
    },
    unlock() {
      const t = ctx.currentTime;
      noiseBurst({ t, dur: 0.04, peak: 0.2, type: "bandpass", f: 3000, q: 6, a: 0.001 });
      tone({ freq: 1800, t: t + 0.02, peak: 0.06, decay: 0.06, type: "square" });
      [79, 84, 88, 91].forEach((m, i) => chime(N(m), t + 0.15 + i * 0.08, 0.07));
    },
    celebrate() {
      const t = ctx.currentTime;
      [[60, 0], [64, 0.1], [67, 0.2], [72, 0.3], [67, 0.45], [72, 0.55]].forEach(([m, d]) => {
        tone({ freq: N(m), type: "triangle", t: t + d, peak: 0.1, decay: 0.3 });
        tone({ freq: N(m + 12), type: "sine", t: t + d, peak: 0.05, decay: 0.25 });
      });
      noiseBurst({ t: t + 0.55, dur: 0.6, peak: 0.05, type: "highpass", f: 5000, a: 0.01 });
    },
    xp() { const t = ctx.currentTime; tone({ freq: N(88), t, peak: 0.08, decay: 0.15, type: "square" }); tone({ freq: N(95), t: t + 0.08, peak: 0.08, decay: 0.5, type: "square" }); },
    step() { noiseBurst({ dur: 0.05, peak: 0.02, type: "lowpass", f: 700, a: 0.004, pan: rnd(-0.2, 0.2) }); },
    flap() { const t = ctx.currentTime; for (let i = 0; i < 3; i++) noiseBurst({ t: t + i * 0.11, dur: 0.08, peak: 0.05, type: "lowpass", f: 900, a: 0.01 }); },
    squawk() {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1500, t + 0.06); o.frequency.linearRampToValueAtTime(1100, t + 0.16);
      f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 2.5;
      env(g, t, 0.01, 0.06, 0.18);
      o.connect(f).connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.25);
    },
    wave() { const t = ctx.currentTime; mallet(N(76), t, 0.07, sfxBus); mallet(N(79), t + 0.12, 0.07, sfxBus); },
    think() { const t = ctx.currentTime; tone({ freq: N(72), t, peak: 0.04, decay: 0.2 }); tone({ freq: N(74), t: t + 0.15, peak: 0.04, decay: 0.3 }); },
    pop() { tone({ freq: 500, glideTo: 900, glideTime: 0.06, peak: 0.08, decay: 0.1 }); },
    stamp() {
      const t = ctx.currentTime;
      tone({ freq: 120, glideTo: 45, glideTime: 0.18, type: "sine", t, a: 0.002, peak: 0.5, decay: 0.28 });
      noiseBurst({ t, dur: 0.12, peak: 0.28, type: "lowpass", f: 900, a: 0.001 });
      noiseBurst({ t: t + 0.01, dur: 0.05, peak: 0.12, type: "bandpass", f: 2600, q: 2, a: 0.001 });
      [72, 76, 79, 84].forEach((m, i) => chime(N(m), t + 0.28 + i * 0.07, 0.05));
    },
    magic() {
      const t = ctx.currentTime;
      [60, 64, 67, 71, 72, 76, 79, 83, 84, 88, 91, 96].forEach((m, i) => chime(N(m), t + i * 0.045, 0.028, Math.sin(i) * 0.6));
      noiseBurst({ t, dur: 1.2, peak: 0.04, type: "bandpass", f: 1500, f2: 6000, q: 0.6, a: 0.4 });
    },
    flash() {
      const t = ctx.currentTime;
      noiseBurst({ t, dur: 0.7, peak: 0.12, type: "bandpass", f: 300, f2: 7000, q: 0.5, a: 0.25 });
      tone({ freq: N(96), t: t + 0.3, peak: 0.05, decay: 1.2 });
      tone({ freq: N(91), t: t + 0.3, peak: 0.05, decay: 1.2 });
    },
    critter() { const f = rnd(1400, 2600); tone({ freq: f, glideTo: f * 1.5, glideTime: 0.07, peak: 0.025, decay: 0.09, pan: rnd(-0.8, 0.8) }); },
    type() { noiseBurst({ dur: 0.025, peak: 0.03, type: "bandpass", f: 3500, q: 3, a: 0.001 }); },
    finale() {
      const t = ctx.currentTime;
      [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [76, 0.7], [79, 0.85], [84, 1.1]].forEach(([m, d]) => {
        tone({ freq: N(m), type: "triangle", t: t + d, peak: 0.1, decay: 0.5 });
        chime(N(m + 12), t + d, 0.03);
      });
    }
  };

  // ---------- public API ----------
  function unlock() {
    if (!ctx && !init()) return;
    if (ctx.state === "suspended") ctx.resume();
    if (!started) {
      started = true;
      startAmbience();
      startMusic();
      applyVolume();
      listeners.forEach(fn => fn());
    }
  }
  function sfx(name) {
    if (!ctx || !started || prefs.muted) return;
    try { SFX[name] && SFX[name](); } catch (e) { /* audio is decorative: never break the app */ }
  }
  function setScene(s) { scene = s; applyVolume(); }
  // recorded voice lines (character selection): plays through an <audio> element, music ducks underneath
  let voiceEl = null;
  function voice(src) {
    try {
      if (voiceEl) { voiceEl.pause(); }
      voiceEl = new Audio(src);
      voiceEl.volume = prefs.muted ? 0 : Math.min(1, prefs.volume * 1.4 + 0.15);
      voiceDuck = true; applyVolume();
      const done = () => { voiceDuck = false; applyVolume(); };
      voiceEl.addEventListener("ended", done); voiceEl.addEventListener("error", done);
      const p = voiceEl.play(); if (p && p.catch) p.catch(done);
      return voiceEl;
    } catch (e) { voiceDuck = false; return null; }
  }
  function duck(on) { ducked = !!on; applyVolume(); }
  function setVolume(v) { prefs.volume = v; if (v > 0) prefs.muted = false; savePrefs(); applyVolume(); }
  function setMusic(v) { prefs.music = v; savePrefs(); applyVolume(); }
  function toggleMute() { prefs.muted = !prefs.muted; savePrefs(); applyVolume(); return prefs.muted; }

  return {
    unlock, sfx, setScene, voice, duck, setVolume, setMusic, toggleMute,
    get prefs() { return prefs; },
    get started() { return started; },
    onStart(fn) { listeners.push(fn); }
  };
})();
