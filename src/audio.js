/* mg01 sound and vibration. Everything is synthesized with Web Audio: no sound files to ship. */
(function (root) {
  'use strict';
  const KEY = 'mg01.settings.v1';
  const settings = { sound: true, music: true, vibrate: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } };

  let ac = null, sfxBus = null, musicBus = null, noiseBuf = null, ducked = false;
  const MUSIC_VOL = 0.26;

  function ensure() {
    if (ac) return ac;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch (e) { return null; }
    const master = ac.createGain();
    master.gain.value = 0.85;
    master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = settings.sound ? 1 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = settings.music ? MUSIC_VOL : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }

  // One note. o: {f, f2?, type?, at?|t?, d, v?, attack?, lp?, bus?}
  function tone(o) {
    const t0 = o.at != null ? o.at : ac.currentTime + (o.t || 0);
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v == null ? 0.3 : o.v, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    let node = osc;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t0); osc.stop(t0 + o.d + 0.03);
  }
  // Filtered noise burst. o: {f, f2?, type?, q?, at?|t?, d, v?, attack?, bus?}
  function noise(o) {
    const t0 = o.at != null ? o.at : ac.currentTime + (o.t || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.v == null ? 0.3 : o.v, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + o.d + 0.03);
  }

  const SFX = {
    tap: () => tone({ f: 900, f2: 700, d: 0.05, v: 0.1 }),
    select: () => { tone({ f: 660, d: 0.06, v: 0.12, type: 'triangle' }); tone({ f: 990, t: 0.05, d: 0.08, v: 0.12, type: 'triangle' }); },
    block: () => { noise({ type: 'lowpass', f: 900, d: 0.16, v: 0.5 }); tone({ f: 150, f2: 55, d: 0.2, v: 0.5 }); },
    spike: () => { tone({ f: 2300, d: 0.07, v: 0.12, type: 'triangle' }); tone({ f: 3200, t: 0.035, d: 0.09, v: 0.09, type: 'triangle' }); noise({ type: 'highpass', f: 5000, d: 0.06, v: 0.08 }); },
    traffic: () => { tone({ f: 2150, d: 0.08, v: 0.14 }); tone({ f: 2150, t: 0.12, d: 0.16, v: 0.14 }); },
    heli: () => { for (let k = 0; k < 8; k++) noise({ type: 'lowpass', f: 320, t: k * 0.085, d: 0.07, v: 0.5 - k * 0.04 }); tone({ f: 72, d: 0.7, v: 0.08 }); },
    car: () => { tone({ f: 650, f2: 1300, d: 0.2, v: 0.11, type: 'triangle' }); tone({ f: 1300, f2: 650, t: 0.2, d: 0.22, v: 0.11, type: 'triangle' }); },
    dispatch: () => { noise({ f: 1800, q: 2, d: 0.08, v: 0.22 }); tone({ f: 1250, t: 0.09, d: 0.06, v: 0.05, type: 'square' }); tone({ f: 1250, t: 0.18, d: 0.06, v: 0.05, type: 'square' }); },
    crew: () => tone({ f: 70, f2: 155, d: 0.34, v: 0.13, type: 'sawtooth', lp: 650 }),
    tyre: () => noise({ type: 'highpass', f: 2600, d: 0.45, v: 0.12, attack: 0.02 }),
    sealed: () => { tone({ f: 523, d: 0.12, v: 0.12, type: 'triangle' }); tone({ f: 784, t: 0.1, d: 0.2, v: 0.12, type: 'triangle' }); },
    busted: () => {
      noise({ type: 'lowpass', f: 700, d: 0.22, v: 0.6 }); tone({ f: 95, f2: 40, d: 0.3, v: 0.55 });
      for (let k = 0; k < 2; k++) { tone({ f: 720, f2: 1150, t: 0.12 + k * 0.42, d: 0.21, v: 0.1, type: 'triangle' }); tone({ f: 1150, f2: 720, t: 0.33 + k * 0.42, d: 0.21, v: 0.1, type: 'triangle' }); }
    },
    star: (k) => { const f = [1047, 1319, 1568][k || 0]; tone({ f, d: 0.32, v: 0.16 }); tone({ f: f * 2, d: 0.22, v: 0.04 }); },
    escape: () => {
      tone({ f: 392, f2: 370, d: 0.26, v: 0.13, type: 'sawtooth', lp: 1400 });
      tone({ f: 330, f2: 311, t: 0.28, d: 0.26, v: 0.13, type: 'sawtooth', lp: 1400 });
      tone({ f: 262, f2: 185, t: 0.56, d: 0.6, v: 0.13, type: 'sawtooth', lp: 1400 });
    },
    coin: () => { tone({ f: 1568, d: 0.07, v: 0.12 }); tone({ f: 2093, t: 0.06, d: 0.24, v: 0.12 }); },
    error: () => tone({ f: 150, d: 0.13, v: 0.07, type: 'square', lp: 800 }),
    rank: () => [523, 659, 784, 1047].forEach((f, k) => tone({ f, t: k * 0.1, d: 0.3, v: 0.15, type: 'triangle' })),
  };

  // ---------- background music: a quiet spy-style loop ----------
  const Music = (function () {
    let timer = null, step = 0, nextT = 0;
    const S16 = 60 / 98 / 4;
    const ROOTS = [45, 45, 41, 43];                 // A2 A2 F2 G2, one per bar
    const BASS = [0, null, 0, 12, null, 0, 10, null, 7, null, 0, null, 3, null, 10, 7];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    function tick() {
      while (nextT < ac.currentTime + 0.15) {
        const bar = Math.floor(step / 16) % ROOTS.length, s = step % 16;
        const off = BASS[s];
        if (off != null) tone({ f: hz(ROOTS[bar] + off), at: nextT, d: S16 * 1.7, v: 0.2, type: 'triangle', lp: 520, bus: musicBus });
        if (s % 8 === 0) tone({ f: 115, f2: 45, at: nextT, d: 0.16, v: 0.3, bus: musicBus });
        if (s % 4 === 2) noise({ type: 'highpass', f: 7500, at: nextT, d: 0.035, v: 0.05, bus: musicBus });
        if (s === 12 && bar % 2 === 1) tone({ f: hz(ROOTS[bar] + 24 + 7), at: nextT, d: 0.35, v: 0.035, type: 'square', lp: 1800, bus: musicBus });
        step++; nextT += S16;
      }
    }
    return {
      start() {
        if (timer || !ac) return;
        nextT = ac.currentTime + 0.1;
        timer = setInterval(tick, 50);
      },
      stop() { clearInterval(timer); timer = null; },
    };
  })();

  function applyLevels() {
    if (!ac) return;
    const t = ac.currentTime;
    sfxBus.gain.setTargetAtTime(settings.sound && !ducked ? 1 : 0, t, 0.02);
    musicBus.gain.setTargetAtTime(settings.music && !ducked ? MUSIC_VOL : 0, t, 0.08);
    if (settings.music) Music.start(); else Music.stop();
  }

  const API = {
    settings,
    // Browsers only allow sound after the first tap.
    unlock() {
      const a = ensure();
      if (!a) return;
      if (a.state === 'suspended') a.resume();
      applyLevels();
    },
    play(name, arg) {
      if (!settings.sound || ducked || !ac || ac.state !== 'running') return;
      try { SFX[name] && SFX[name](arg); } catch (e) { /* never break the game for a sound */ }
    },
    buzz(pattern) {
      if (!settings.vibrate) return;
      try {
        // Inside the phone app the native side vibrates (WebView has no reliable navigator.vibrate).
        if (root.ReactNativeWebView) { root.ReactNativeWebView.postMessage(JSON.stringify({ t: 'vibrate', p: pattern })); return; }
        if (root.navigator && navigator.vibrate) navigator.vibrate(pattern);
      } catch (e) { /* ignore */ }
    },
    set(key, value) {
      settings[key] = !!value;
      save();
      applyLevels();
    },
    // Silence the game while an ad plays.
    duck(on) { ducked = !!on; applyLevels(); },
  };

  if (root.document) {
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) ac.suspend(); else if (!ducked) ac.resume();
    });
  }
  root.MG_AUDIO = API;
})(typeof self !== 'undefined' ? self : this);
