/* mg01 prototype v0.3: rendering, input and screens. Rules live in core.js; coins and ranks in meta.js. */
(function () {
  'use strict';
  const MG = window.MG;
  const LEVELS = [].concat(window.MG_LEVELS_DOWNTOWN || [], window.MG_LEVELS_CITY || []);
  const DAILY = window.MG_LEVELS_DAILY || [];
  const META = window.MG_META, ADS = window.MG_ADS;
  const AUDIO = window.MG_AUDIO || { play() {}, buzz() {}, unlock() {}, set() {}, duck() {}, settings: {} };
  const sfx = (name, arg) => AUDIO.play(name, arg);
  const VERSION = 'v0.3';
  const $ = (id) => document.getElementById(id);

  const canvas = $('map');
  const ctx = canvas.getContext('2d');
  const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SPEED = reduceMotion ? 0.4 : 1;

  const rootStyle = getComputedStyle(document.documentElement);
  const COL = {};
  ['console', 'ground', 'asphalt', 'curb', 'lane', 'roof-1', 'roof-2', 'roof-3', 'park', 'tree', 'water', 'water-edge', 'bank',
    'siren-red', 'siren-blue', 'caution', 'exit-green', 'getaway', 'ink', 'muted', 'line']
    .forEach((k) => { COL[k] = rootStyle.getPropertyValue('--' + k).trim(); });
  const FONT_LABEL = rootStyle.getPropertyValue('--font-label').trim();

  const STREETS = ['Oak', 'Elm', 'Pine', 'Main', 'Cedar', 'Maple', 'Birch', 'Ash'];
  const AVES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
  const HWYS = [9, 12, 30, 66, 101, 5, 44];
  const DIR_WORD = ['north', 'east', 'south', 'west'];
  const COMPASS = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
  const DISTRICT = { downtown: 'Downtown', oldTown: 'Old Town', ringRoad: 'Ring Road', riverside: 'Riverside' };
  const RANK = { 1: 'Rookies', 2: 'Careful', 3: 'Planners', 4: 'Masterminds' };
  const INTEL = {
    2: 'careful crew. They steer around patrol cars and spikes.',
    3: 'planners. They pick the exit with the most backup roads.',
    4: 'masterminds. They count your units and steer where you cannot box them in.',
  };
  const ROAD = 0.17;   // half road width, in street units
  const EDGE = 0.4;    // Downtown city edge beyond the outer streets
  // Framing kept tight so the map gets as much of a phone screen as possible.
  const SIGN_OUT = 0.62;   // exit sign centre (and where escaping cars end), beyond the gate corner
  const SIGN_W = 0.64, SIGN_H = 0.34;
  const RAMP = 0.9;        // city exit ramp drawn past the gate
  const GROUND_PAD = 0.28; // city ground beyond the outermost corners
  const ZMAX = 2.6;        // pinch zoom limit
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"%CLS%><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z"/></svg>';
  const ICON = {
    block: '<svg viewBox="0 0 30 18" aria-hidden="true"><rect x="1" y="4" width="28" height="8" rx="2" fill="#ffc41f"/><path d="M6 4h4l-4 8H2zM14 4h4l-4 8h-4zM22 4h4l-4 8h-4z" fill="#0b1322"/><rect x="5" y="12" width="2.5" height="5" fill="#8796b3"/><rect x="22.5" y="12" width="2.5" height="5" fill="#8796b3"/></svg>',
    spike: '<svg viewBox="0 0 30 18" aria-hidden="true"><rect x="1" y="10" width="28" height="5" rx="1.5" fill="#4a5b7d"/><path d="M3 10l2.5-7L8 10zM9 10l2.5-7L14 10zM15 10l2.5-7L20 10zM21 10l2.5-7L26 10z" fill="#d5ddeb"/></svg>',
    traffic: '<svg viewBox="0 0 30 18" aria-hidden="true"><path d="M15 1l6 14H9z" fill="#ff7a2f"/><path d="M12.5 6.8h5l1.1 2.8h-7.2z" fill="#f2f5fa"/><rect x="7" y="15" width="16" height="2.5" rx="1" fill="#ff7a2f"/></svg>',
    heli: '<svg viewBox="0 0 30 18" aria-hidden="true"><rect x="3" y="1.5" width="22" height="1.6" rx=".8" fill="#d5ddeb"/><rect x="13.2" y="2.5" width="1.6" height="3" fill="#d5ddeb"/><ellipse cx="13" cy="9.5" rx="7" ry="4.2" fill="#3d8bff"/><rect x="19" y="8.6" width="9" height="1.8" rx=".9" fill="#3d8bff"/><path d="M8 15h10" stroke="#d5ddeb" stroke-width="1.6"/></svg>',
    car: '<svg viewBox="0 0 30 18" aria-hidden="true"><rect x="2" y="3" width="26" height="12" rx="4" fill="#f2f5fa"/><rect x="21" y="3" width="7" height="12" rx="3" fill="#0b1322"/><rect x="13" y="3.5" width="3" height="5.5" fill="#ff3d57"/><rect x="13" y="9" width="3" height="5.5" fill="#3d8bff"/></svg>',
  };
  const COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><use href="#i-coin"/></svg>';
  const PLAY = '<svg class="play" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1v10L11 6z"/></svg>';
  const carSvg = (skin) => `<svg viewBox="0 0 30 18" aria-hidden="true"><rect x="2" y="3" width="26" height="12" rx="4" fill="${skin.body}"/><rect x="21" y="3" width="7" height="12" rx="3" fill="${skin.trim}"/><rect x="2" y="3" width="4.5" height="12" rx="2" fill="${skin.trim}"/><rect x="13" y="3.5" width="3" height="5.5" fill="#ff3d57"/><rect x="13" y="9" width="3" height="5.5" fill="#3d8bff"/></svg>`;

  // ---------- helpers ----------
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const pad3 = (n) => String(n).padStart(3, '0');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function segDist(px0, py0, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    const t = clamp(((px0 - ax) * dx + (py0 - ay) * dy) / l2, 0, 1);
    return Math.hypot(px0 - (ax + t * dx), py0 - (ay + t * dy));
  }
  const starsHTML = (n) => [0, 1, 2].map((i) => STAR.replace('%CLS%', i < n ? ' class="on"' : '')).join('');
  const turnsUsed = (s) => s.turn + (s.used > 0 ? 1 : 0);

  // ---------- progress (per-device convenience only) ----------
  const SAVE_KEY = 'mg01.progress.v1';
  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (p && typeof p.unlocked === 'number' && p.stars) return p;
    } catch (e) { /* storage unavailable */ }
    return { unlocked: 1, stars: {} };
  }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }
  let progress = loadProgress();

  // ---------- game state ----------
  let levelIndex = 0, level = null, map = null, state = null, history = [];
  let mode = 'case';                       // 'case' or 'daily'
  let boost = { key: null, block: 0, heli: 0 }; // backup called in for this case
  let selectedCar = null, busy = false, hoverPt = null, tool = 'block';
  const anim = { place: null, close: null, car: null, crews: [], fx: null, escape: null };
  let decor = null, staticLayer = null, cityRoads = null;
  let planCache = { state: null };
  const L = { s: 40, ox: 0, oy: 0, dpr: 1, W: 0, H: 0 };
  const base = { s: 40, ox: 0, oy: 0, view: [0, 0, 1, 1] }; // the whole map fitted to the board
  const cam = { z: 1, x: 0, y: 0 };                          // pinch zoom and pan on top of that
  let staticDirty = false;

  const px = (gx) => L.ox + gx * L.s;
  const py = (gy) => L.oy + gy * L.s;
  const isGrid = () => !!map.grid;

  function gpos(n) {
    if (n < map.N) return map.pos[n];
    const i = n - map.N, g = map.pos[map.gates[i]], d = map.exitDirs[i];
    return [g[0] + d[0] * SIGN_OUT, g[1] + d[1] * SIGN_OUT];
  }

  // ---------- names for the radio ----------
  const corner = (n) => { const [x, y] = map.pos[n]; return `${STREETS[y]} & ${AVES[x]}`; };
  const exitName = (i) => `Hwy ${HWYS[i % HWYS.length]}`;
  const crewName = (ci) => (state.crews.length > 1 ? `Crew ${ci + 1}` : 'Suspect');
  const compass = (ang) => COMPASS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  function movePhrase(path) {
    const a = path[path.length - 2], b = path[path.length - 1];
    if (isGrid() && b < map.N) {
      const [ax, ay] = map.pos[a], [bx, by] = map.pos[b];
      const road = ax === bx ? `${AVES[ax]} Ave` : `${STREETS[ay]} St`;
      const word = by < ay ? 'north' : by > ay ? 'south' : bx > ax ? 'east' : 'west';
      return `${word}bound on ${road}`;
    }
    return `heading ${compass(MG.angleBetween(map, path[0], b))}`;
  }

  // The radio is always two lines tall. Longer messages show MORE; tap to open them over the map.
  // open=true opens a long message right away (case hints), until the next tap anywhere.
  function radio(text, open) {
    const box = $('radio'), t = $('radio-text');
    t.textContent = text;
    box.classList.remove('flash', 'open');
    void box.offsetWidth;
    box.classList.add('flash');
    if (checkRadioClip() && open) box.classList.add('open');
  }
  function checkRadioClip() {
    const box = $('radio'), t = $('radio-text');
    if (box.classList.contains('open')) return true;
    const clipped = t.scrollHeight > t.clientHeight + 2;
    box.classList.toggle('clipped', clipped);
    return clipped;
  }
  $('radio').addEventListener('click', () => {
    const box = $('radio');
    if (box.classList.contains('open')) box.classList.remove('open');
    else if (box.classList.contains('clipped')) box.classList.add('open');
  });
  document.addEventListener('pointerdown', (e) => {
    if (!$('radio').contains(e.target)) $('radio').classList.remove('open');
  }, true);

  // ---------- level setup ----------
  function todayDaily() {
    if (!DAILY.length) return null;
    const day = META.dayNumber();
    const week = Math.floor((day + 3) / 7), weekday = (day + 3) % 7; // Monday = 0
    return DAILY[((week % 4) * 7 + weekday) % DAILY.length];
  }
  const dailyOpen = () => progress.unlocked >= 16 && !!todayDaily();

  function loadLevel(i, restore) {
    mode = 'case';
    levelIndex = clamp(i, 0, LEVELS.length - 1);
    setup(LEVELS[levelIndex], restore);
  }
  function loadDaily(restore) {
    const lv = todayDaily();
    if (!lv) return;
    mode = 'daily';
    setup(lv, restore);
  }
  function setup(lv, restore) {
    level = lv;
    map = MG.buildMap(level);
    const key = mode + ':' + level.id;
    if (boost.key !== key) boost = { key, block: 0, heli: 0 };
    if (restore) state = restore.state;
    else {
      state = MG.initialState(map, level);
      state.stock.block += boost.block;
      state.stock.heli += boost.heli;
    }
    history = restore ? restore.history : [];
    selectedCar = null; busy = false; hoverPt = null;
    anim.place = anim.close = anim.car = anim.fx = anim.escape = null; anim.crews = [];
    planCache = { state: null };
    $('ov-result').hidden = true;
    tool = ['block', 'spike', 'traffic'].find((k) => state.stock[k] > 0) || 'block';
    decor = isGrid() ? makeDecor() : null;
    cityRoads = isGrid() ? null : citySegments();
    cam.z = 1; cam.x = 0; cam.y = 0;
    hideCoach(false);
    buildTools();
    resize();
    updateHud();
    radio(level.hint || openingCall(), true);
    maybeCoach();
  }

  function openingCall() {
    const lines = [mode === 'daily'
      ? `Daily Heist: ${level.name}. ${plural(level.exits.length, 'highway exit')} open.`
      : `Code 211 at First National. ${plural(level.exits.length, 'highway exit')} open.`];
    if (!isGrid()) {
      const intel = INTEL[map.cfg.rank];
      if (intel) lines.push(`Intel: ${intel}`);
      if (state.crews.length > 1) lines.push('Two getaway cars. Catch both.');
      if (map.cfg.speed >= 3) lines.push('Fast car: 3 corners per turn.');
      return lines.join(' ');
    }
    const units = [];
    if (state.stock.block) units.push(plural(state.stock.block, 'roadblock'));
    if (state.cars.length) units.push(plural(state.cars.length, 'patrol car'));
    if (units.length) lines.push(`You have ${units.join(' and ')}.`);
    return lines.join(' ');
  }

  function crewLabel() {
    if (isGrid()) return null;
    let t = RANK[map.cfg.rank];
    if (state.crews.length > 1) t = '2 cars · ' + t;
    if (map.cfg.speed >= 3) t += ' · Fast';
    return t;
  }

  function buildTools() {
    const box = $('tools');
    box.innerHTML = '';
    const defs = [{ key: 'block', label: 'Roadblock' }];
    if (state.stock.spike) defs.push({ key: 'spike', label: 'Spikes' });
    if (state.stock.traffic) defs.push({ key: 'traffic', label: 'Traffic' });
    if (state.stock.heli || !isGrid()) defs.push({ key: 'heli', label: 'Chopper' });
    defs.push({ key: 'car', label: 'Units', info: true });
    for (const d of defs) {
      const el = document.createElement(d.info ? 'div' : 'button');
      el.className = 'tool' + (d.info ? ' info' : '');
      el.id = 'tool-' + d.key;
      el.innerHTML = `<span class="tool-top">${ICON[d.key]}<span class="tool-count"></span></span><span class="tool-label">${d.label}</span>`;
      if (d.info) el.title = 'Patrol cars: tap one on the map to move it';
      else el.addEventListener('click', () => onTool(d.key));
      box.appendChild(el);
    }
    const multi = map.cfg.orders > 1;
    $('orders').hidden = !multi;
    $('btn-dispatch').hidden = !multi;
  }

  function updateHud() {
    $('case-meta').textContent = [mode === 'daily' ? 'Daily Heist' : `Case ${pad3(level.id)}`, DISTRICT[level.district || 'downtown'], crewLabel()].filter(Boolean).join(' · ');
    $('case-name').textContent = level.name;
    $('turn').textContent = turnsUsed(state);
    $('par').textContent = level.par;
    for (const k of ['block', 'spike', 'traffic', 'heli']) {
      const el = $('tool-' + k);
      if (!el) continue;
      el.querySelector('.tool-count').textContent = state.stock[k];
      el.classList.toggle('empty', state.stock[k] === 0);
      if (k === 'heli') el.disabled = state.reveal || state.status !== 'play';
      else el.setAttribute('aria-pressed', String(tool === k && selectedCar == null));
    }
    const carEl = $('tool-car');
    carEl.querySelector('.tool-count').textContent = state.cars.length;
    carEl.classList.toggle('empty', state.cars.length === 0);
    const orders = map.cfg.orders;
    if (orders > 1) {
      const left = orders - state.used;
      $('orders').innerHTML = Array.from({ length: orders }, (_, k) => `<span class="pip${k < state.used ? ' used' : ''}"></span>`).join('');
      $('orders').setAttribute('aria-label', `${plural(left, 'order')} left this turn`);
    }
    const playing = state.status === 'play';
    $('btn-undo').disabled = history.length === 0 || busy || !playing;
    $('btn-dispatch').disabled = busy || !playing;
    $('btn-dispatch').classList.toggle('ready', playing && !busy && state.used > 0);
  }

  function onTool(key) {
    if (busy || state.status !== 'play') return;
    if (coach && coach.tool === key) hideCoach(true);
    if (key === 'heli') {
      if (state.reveal) return;
      if (state.stock.heli > 0) doAction({ t: 'heli' });
      else askBackup('heli');
      return;
    }
    if (state.stock[key] === 0) {
      if (key === 'block') { askBackup('block'); return; }
      nudge('tool-' + key); sfx('error');
      radio(`No ${key === 'spike' ? 'spike strips' : 'traffic units'} left.`);
      return;
    }
    tool = key;
    selectedCar = null;
    sfx('tap');
    if (key === 'traffic') radio('Traffic control: tap a street to close it for 2 turns.');
    else if (key === 'spike') radio('Spike strip: tap a corner. A crew driving over it loses its next move.');
    updateHud();
  }

  // ---------- backup: extra units from boosters, a video or coins ----------
  function askBackup(kind) {
    if (busy || state.status !== 'play') return;
    const what = kind === 'block' ? 'roadblock' : 'chopper flight';
    if (mode === 'case' && level.id < 5) { // no sales pitch while learning
      nudge('tool-' + kind); sfx('error');
      radio(state.cars.length ? 'No roadblocks left. Tap a patrol car to move it.' : 'No roadblocks left. Restart and try another corner.');
      return;
    }
    if (boost[kind] >= META.MAX_BACKUP) {
      nudge('tool-' + kind); sfx('error');
      radio(`No more backup for this case: ${META.MAX_BACKUP} extra ${what}s is the limit.`);
      return;
    }
    const p = META.get(), price = META.BOOSTERS[kind].price, have = p.boosters[kind];
    $('backup-title').textContent = kind === 'block' ? 'Out of roadblocks' : 'Chopper grounded';
    $('backup-text').textContent = `Call in 1 extra ${what} for this case?`;
    const use = $('backup-use'), buy = $('backup-buy');
    use.hidden = have === 0;
    use.textContent = `Use a booster (${have} left)`;
    buy.innerHTML = `Buy for ${COIN}${price}`;
    buy.disabled = p.coins < price;
    if (p.coins < price) buy.innerHTML = `Need ${COIN}${price} (you have ${p.coins})`;
    $('ov-backup').hidden = false;
    (have ? use : $('backup-ad')).focus({ preventScroll: true });
    const close = () => { $('ov-backup').hidden = true; use.onclick = buy.onclick = $('backup-ad').onclick = $('backup-cancel').onclick = null; };
    use.onclick = () => { close(); if (META.useBooster(kind)) grantBackup(kind, 'Booster used'); };
    buy.onclick = () => { close(); if (META.spend(price)) grantBackup(kind, `Bought for ${price} coins`); };
    $('backup-ad').onclick = () => {
      close();
      ADS.rewarded(kind).then((ok) => {
        if (ok) { META.adShown(); grantBackup(kind, 'Thanks for watching'); }
        else radio('No video, no backup. Make do with what you have, Chief.');
      });
    };
    $('backup-cancel').onclick = close;
  }
  function grantBackup(kind, why) {
    boost[kind]++;
    state.stock[kind]++;
    history.forEach((h) => { h.stock[kind]++; }); // Undo keeps the extra unit
    if (kind === 'block') tool = 'block';
    planCache = { state: null };
    buildTools();
    updateHud();
    sfx('coin');
    radio(`${why}. Backup on the way: +1 ${kind === 'block' ? 'roadblock' : 'chopper flight'}.`);
  }

  // ---------- Downtown decor (grid) ----------
  function makeDecor() {
    const { w, h } = map.grid;
    const CW = w + 1;
    const cid = (cx, cy) => (cy + 1) * CW + (cx + 1);
    const total = (w + 1) * (h + 1);
    const parent = Array.from({ length: total }, (_, k) => k);
    const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
    const unite = (a, b) => { parent[find(a)] = find(b); };
    const gaps = [];
    for (const [x1, y1, x2, y2] of level.cut) {
      if (y1 === y2) {
        const x = Math.min(x1, x2), y = y1;
        unite(cid(x, y - 1), cid(x, y));
        gaps.push({ rect: [x + ROAD, y - ROAD, x + 1 - ROAD, y + ROAD], cell: cid(x, y) });
      } else {
        const x = x1, y = Math.min(y1, y2);
        unite(cid(x - 1, y), cid(x, y));
        gaps.push({ rect: [x - ROAD, y + ROAD, x + ROAD, y + 1 - ROAD], cell: cid(x, y) });
      }
    }
    const size = new Map();
    for (let k = 0; k < total; k++) { const g = find(k); size.set(g, (size.get(g) || 0) + 1); }
    const [bx, by] = level.bank;
    const options = [[bx - 1, by - 1], [bx, by - 1], [bx - 1, by], [bx, by]];
    const inside = (c) => c[0] >= 0 && c[1] >= 0 && c[0] <= w - 2 && c[1] <= h - 2;
    const bankCell = options.find((c) => inside(c) && size.get(find(cid(c[0], c[1]))) === 1) || options.find(inside) || options[0];
    const bankGroup = find(cid(bankCell[0], bankCell[1]));
    const rng = mulberry(level.id * 977 + 13);
    const roofs = [COL['roof-1'], COL['roof-2'], COL['roof-3']];
    const look = new Map();
    const cells = [];
    for (let cy = -1; cy < h; cy++) {
      for (let cx = -1; cx < w; cx++) {
        const g = find(cid(cx, cy));
        if (!look.has(g)) {
          const big = size.get(g) >= 2;
          const park = g !== bankGroup && (big ? rng() < 0.5 : rng() < 0.07);
          look.set(g, { park, color: park ? COL.park : roofs[Math.floor(rng() * roofs.length)] });
        }
        cells.push({ cx, cy, g, trees: [rng(), rng(), rng(), rng(), rng(), rng()] });
      }
    }
    return { cells, gaps: gaps.map((gp) => ({ rect: gp.rect, g: find(gp.cell) })), look, bankCell, bankGroup };
  }

  // Road segments of a city map (streets plus exit ramps), in street units.
  function citySegments() {
    const segs = map.edges.map(([a, b]) => [map.pos[a], map.pos[b]]);
    map.gates.forEach((g, i) => {
      const p = map.pos[g], d = map.exitDirs[i];
      segs.push([p, [p[0] + d[0] * RAMP, p[1] + d[1] * RAMP]]);
    });
    return segs;
  }

  // ---------- layout ----------
  function resize() {
    const rect = $('board').getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    L.dpr = dpr; L.W = Math.max(1, rect.width); L.H = Math.max(1, rect.height);
    checkRadioClip();
    canvas.width = Math.round(L.W * dpr);
    canvas.height = Math.round(L.H * dpr);
    if (!map) return;
    let x0, y0, x1, y1;
    if (isGrid()) {
      const side = [0, 0, 0, 0];
      level.exits.forEach((e) => { side[e[2]] = 1; });
      const sx = 0.24 + SIGN_W / 2 + 0.02, sy = 0.24 + SIGN_H / 2 + 0.03; // sign extents past the edge
      x0 = -(EDGE + (side[3] ? sx : 0.06)); x1 = map.grid.w - 1 + EDGE + (side[1] ? sx : 0.06);
      y0 = -(EDGE + (side[0] ? sy : 0.06)); y1 = map.grid.h - 1 + EDGE + (side[2] ? sy : 0.06);
    } else {
      const b = cityBounds();
      [x0, y0, x1, y1] = b.view;
    }
    base.s = Math.min(L.W / (x1 - x0), L.H / (y1 - y0), 92);
    base.ox = (L.W - (x1 - x0) * base.s) / 2 - x0 * base.s;
    base.oy = (L.H - (y1 - y0) * base.s) / 2 - y0 * base.s;
    base.view = [x0, y0, x1, y1];
    updateView();
    staticLayer = isGrid() ? renderStaticGrid() : renderStaticCity();
    staticDirty = false;
  }

  // Apply zoom and pan to the fitted view. The map can't be dragged off the board.
  function updateView() {
    cam.z = clamp(cam.z, 1, ZMAX);
    L.s = base.s * cam.z;
    const [x0, y0, x1, y1] = base.view;
    const fitOx = L.W / 2 + (base.ox - L.W / 2) * cam.z, fitOy = L.H / 2 + (base.oy - L.H / 2) * cam.z;
    const slackX = Math.max(0, ((x1 - x0) * L.s - L.W) / 2), slackY = Math.max(0, ((y1 - y0) * L.s - L.H) / 2);
    cam.x = clamp(cam.x, -slackX, slackX);
    cam.y = clamp(cam.y, -slackY, slackY);
    L.ox = fitOx + cam.x;
    L.oy = fitOy + cam.y;
    staticDirty = true;
    $('btn-fit').hidden = cam.z <= 1.01;
    if (coach) placeCoach();
  }
  // Zoom to z1 keeping the map point under (mx, my) where it is.
  function zoomAt(mx, my, z1) {
    const ux = (mx - L.ox) / L.s, uy = (my - L.oy) / L.s;
    cam.z = clamp(z1, 1, ZMAX);
    const s1 = base.s * cam.z;
    cam.x = mx - ux * s1 - (L.W / 2 + (base.ox - L.W / 2) * cam.z);
    cam.y = my - uy * s1 - (L.H / 2 + (base.oy - L.H / 2) * cam.z);
    updateView();
  }
  function resetZoom() { cam.z = 1; cam.x = 0; cam.y = 0; updateView(); }

  function cityBounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of map.pos) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const P = GROUND_PAD;
    const ground = [x0 - P, y0 - P, x1 + P, y1 + P];
    const view = ground.slice();
    map.gates.forEach((g, i) => {
      const p = map.pos[g], d = map.exitDirs[i];
      const c = [p[0] + d[0] * SIGN_OUT, p[1] + d[1] * SIGN_OUT];
      view[0] = Math.min(view[0], c[0] - SIGN_W / 2 - 0.03); view[2] = Math.max(view[2], c[0] + SIGN_W / 2 + 0.03);
      view[1] = Math.min(view[1], c[1] - SIGN_H / 2 - 0.03); view[3] = Math.max(view[3], c[1] + SIGN_H / 2 + 0.03);
    });
    return { ground, view };
  }

  function drawSign(g, sx, sy, i) {
    const s = L.s, sw = s * SIGN_W, sh = s * SIGN_H;
    g.fillStyle = COL['exit-green'];
    rr(g, sx - sw / 2, sy - sh / 2, sw, sh, s * 0.05); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = Math.max(1, s * 0.018);
    rr(g, sx - sw / 2 + s * 0.025, sy - sh / 2 + s * 0.025, sw - s * 0.05, sh - s * 0.05, s * 0.035); g.stroke();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.max(9, Math.round(s * 0.14))}px ${FONT_LABEL}`;
    g.fillText('EXIT', sx, sy - sh * 0.18);
    g.font = `600 ${Math.max(8, Math.round(s * 0.115))}px ${FONT_LABEL}`;
    g.fillText(exitName(i).toUpperCase(), sx, sy + sh * 0.22);
  }

  function drawBankGlyph(g, x, y, wd, ht) {
    const s = L.s;
    g.fillStyle = COL.bank;
    rr(g, x, y, wd, ht, s * 0.05); g.fill();
    g.fillStyle = rgba(COL.console, 0.55);
    const cxm = x + wd / 2, top = y + ht * 0.2;
    g.beginPath(); g.moveTo(cxm - wd * 0.32, top + ht * 0.16); g.lineTo(cxm, top); g.lineTo(cxm + wd * 0.32, top + ht * 0.16); g.closePath(); g.fill();
    for (let k = 0; k < 3; k++) g.fillRect(cxm - wd * 0.24 + k * wd * 0.2, top + ht * 0.22, wd * 0.08, ht * 0.26);
    g.fillRect(cxm - wd * 0.32, top + ht * 0.5, wd * 0.64, ht * 0.05);
    if (ht > s * 0.32) {
      g.fillStyle = COL.console;
      g.font = `700 ${Math.round(Math.min(s * 0.15, ht * 0.22))}px ${FONT_LABEL}`;
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText('BANK', cxm, y + ht * 0.92);
    }
  }

  function newLayer() {
    const off = document.createElement('canvas');
    off.width = canvas.width; off.height = canvas.height;
    const g = off.getContext('2d');
    g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    return { off, g };
  }

  function renderStaticGrid() {
    const { off, g } = newLayer();
    const s = L.s, w = map.grid.w, h = map.grid.h;
    const minX = -EDGE, minY = -EDGE, maxX = w - 1 + EDGE, maxY = h - 1 + EDGE;
    g.strokeStyle = COL.asphalt;
    g.lineWidth = 2 * ROAD * s;
    level.exits.forEach(([x, y, d]) => {
      g.beginPath();
      g.moveTo(px(x), py(y));
      g.lineTo(px(x + MG.DIRS[d][0] * (EDGE + 0.5)), py(y + MG.DIRS[d][1] * (EDGE + 0.5)));
      g.stroke();
    });
    g.fillStyle = COL.ground;
    rr(g, px(minX), py(minY), (maxX - minX) * s, (maxY - minY) * s, s * 0.16);
    g.fill();
    const cellRect = (cx, cy) => [
      clamp(cx + ROAD, minX, maxX), clamp(cy + ROAD, minY, maxY),
      clamp(cx + 1 - ROAD, minX, maxX), clamp(cy + 1 - ROAD, minY, maxY),
    ];
    const fillRect = (r, color) => { g.fillStyle = color; g.fillRect(px(r[0]), py(r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s); };
    for (const c of decor.cells) {
      const r = cellRect(c.cx, c.cy);
      if (r[2] - r[0] <= 0.01 || r[3] - r[1] <= 0.01) continue;
      fillRect(r, decor.look.get(c.g).color);
    }
    for (const gp of decor.gaps) fillRect(gp.rect, decor.look.get(gp.g).color);
    for (const c of decor.cells) {
      const r = cellRect(c.cx, c.cy);
      const wdt = r[2] - r[0], hgt = r[3] - r[1];
      if (wdt < 0.2 || hgt < 0.2) continue;
      const lk = decor.look.get(c.g);
      if (lk.park) {
        for (let k = 0; k < 3; k++) {
          const tx = r[0] + 0.12 + c.trees[k * 2] * (wdt - 0.24);
          const ty = r[1] + 0.12 + c.trees[k * 2 + 1] * (hgt - 0.24);
          g.fillStyle = COL.tree;
          g.beginPath(); g.arc(px(tx), py(ty), s * (0.07 + c.trees[k] * 0.04), 0, Math.PI * 2); g.fill();
        }
      } else if (c.g !== decor.bankGroup) {
        g.strokeStyle = rgba(COL.lane, 0.08);
        g.lineWidth = 1;
        g.strokeRect(px(r[0]) + s * 0.06, py(r[1]) + s * 0.06, wdt * s - s * 0.12, hgt * s - s * 0.12);
        g.fillStyle = rgba(COL.lane, 0.1);
        g.fillRect(px(r[0]) + s * (0.1 + c.trees[0] * (wdt - 0.3)), py(r[1]) + s * (0.1 + c.trees[1] * (hgt - 0.3)), s * 0.1, s * 0.08);
      }
    }
    {
      const r = cellRect(decor.bankCell[0], decor.bankCell[1]);
      drawBankGlyph(g, px(r[0]), py(r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s);
    }
    g.strokeStyle = COL.asphalt;
    g.lineWidth = 2 * ROAD * s;
    g.lineCap = 'butt';
    for (const [a, b] of map.edges) {
      const [ax, ay] = map.pos[a], [bx, by] = map.pos[b];
      g.beginPath(); g.moveTo(px(ax), py(ay)); g.lineTo(px(bx), py(by)); g.stroke();
    }
    g.fillStyle = COL.asphalt;
    for (let n = 0; n < map.N; n++) {
      const [x, y] = map.pos[n];
      g.fillRect(px(x) - ROAD * s, py(y) - ROAD * s, 2 * ROAD * s, 2 * ROAD * s);
    }
    laneDashes(g, map.edges.map(([a, b]) => [map.pos[a], map.pos[b]]).concat(
      level.exits.map(([x, y, d]) => [[x, y], [x + MG.DIRS[d][0] * (EDGE + 0.5), y + MG.DIRS[d][1] * (EDGE + 0.5)]])));
    level.exits.forEach(([x, y, d], i) => {
      const along = EDGE + 0.24; // sits on the ramp, just outside the city edge
      drawSign(g, px(x + MG.DIRS[d][0] * along), py(y + MG.DIRS[d][1] * along), i);
    });
    return off;
  }

  function laneDashes(g, segs) {
    const s = L.s;
    g.strokeStyle = rgba(COL.lane, 0.38);
    g.lineWidth = Math.max(1, s * 0.022);
    g.setLineDash([s * 0.09, s * 0.1]);
    for (const [[ax, ay], [bx, by]] of segs) {
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const ux = dx / len, uy = dy / len, cut = ROAD + 0.05;
      g.beginPath();
      g.moveTo(px(ax + ux * cut), py(ay + uy * cut));
      g.lineTo(px(bx - ux * cut), py(by - uy * cut));
      g.stroke();
    }
    g.setLineDash([]);
  }

  function renderStaticCity() {
    const { off, g } = newLayer();
    const s = L.s;
    const { ground } = cityBounds();
    const rng = mulberry(level.id * 7717 + 3);
    const segs = cityRoads;
    const nearest = (x, y) => {
      let d = Infinity, ang = 0;
      for (const [[ax, ay], [bx, by]] of segs) {
        const k = segDist(x, y, ax, ay, bx, by);
        if (k < d) { d = k; ang = Math.atan2(by - ay, bx - ax); }
      }
      return { d, ang };
    };
    const riverDist = (x, y) => {
      if (!level.river) return Infinity;
      let d = Infinity;
      for (let k = 0; k < level.river.length - 1; k++) {
        const [ax, ay] = level.river[k], [bx, by] = level.river[k + 1];
        d = Math.min(d, segDist(x, y, ax, ay, bx, by));
      }
      return d;
    };
    const RIVER_HALF = 0.3;

    // Exit ramps under everything outside the ground.
    g.lineCap = 'round';
    g.strokeStyle = COL.asphalt;
    g.lineWidth = 2 * ROAD * s;
    map.gates.forEach((gt, i) => {
      const p = map.pos[gt], d = map.exitDirs[i];
      g.beginPath(); g.moveTo(px(p[0]), py(p[1])); g.lineTo(px(p[0] + d[0] * RAMP), py(p[1] + d[1] * RAMP)); g.stroke();
    });

    g.fillStyle = COL.ground;
    rr(g, px(ground[0]), py(ground[1]), (ground[2] - ground[0]) * s, (ground[3] - ground[1]) * s, s * 0.2);
    g.fill();
    g.save();
    rr(g, px(ground[0]), py(ground[1]), (ground[2] - ground[0]) * s, (ground[3] - ground[1]) * s, s * 0.2);
    g.clip();

    // Parks
    for (const [x, y, r] of level.parks || []) {
      g.fillStyle = COL.park;
      g.beginPath(); g.arc(px(x), py(y), r * s, 0, Math.PI * 2); g.fill();
    }
    // River
    if (level.river) {
      const line = () => { g.beginPath(); level.river.forEach(([x, y], k) => (k ? g.lineTo(px(x), py(y)) : g.moveTo(px(x), py(y)))); };
      g.lineCap = 'butt'; g.lineJoin = 'round';
      g.strokeStyle = COL['water-edge']; g.lineWidth = (2 * RIVER_HALF + 0.06) * s; line(); g.stroke();
      g.strokeStyle = COL.water; g.lineWidth = 2 * RIVER_HALF * s; line(); g.stroke();
      g.strokeStyle = rgba(COL['water-edge'], 0.5); g.lineWidth = Math.max(1, s * 0.02);
      g.setLineDash([s * 0.18, s * 0.3]); line(); g.stroke(); g.setLineDash([]);
    }
    // Rooftops fill the blocks between streets.
    const roofs = [COL['roof-1'], COL['roof-2'], COL['roof-3']];
    const STEP = 0.27;
    for (let y = ground[1] + STEP / 2; y < ground[3]; y += STEP) {
      for (let x = ground[0] + STEP / 2; x < ground[2]; x += STEP) {
        const jx = x + (rng() - 0.5) * 0.06, jy = y + (rng() - 0.5) * 0.06;
        const roll = rng(), shade = rng(), sz = 0.16 + rng() * 0.06;
        const near = nearest(jx, jy);
        if (near.d < ROAD + 0.09) continue;
        if (riverDist(jx, jy) < RIVER_HALF + 0.1) continue;
        const park = (level.parks || []).some(([qx, qy, r]) => Math.hypot(jx - qx, jy - qy) < r);
        if (park) {
          if (roll < 0.5) {
            g.fillStyle = COL.tree;
            g.beginPath(); g.arc(px(jx), py(jy), s * (0.05 + shade * 0.04), 0, Math.PI * 2); g.fill();
          }
          continue;
        }
        g.save();
        g.translate(px(jx), py(jy));
        g.rotate(near.ang);
        g.fillStyle = roofs[Math.floor(shade * roofs.length)];
        g.fillRect(-sz * s / 2, -sz * s / 2, sz * s, sz * s);
        if (roll < 0.25) { g.fillStyle = rgba(COL.lane, 0.1); g.fillRect(-sz * s * 0.2, -sz * s * 0.2, sz * s * 0.35, sz * s * 0.3); }
        g.restore();
      }
    }
    g.restore();

    // Streets: curb, then asphalt, with round joins at the corners.
    const stroke = (w, color) => {
      g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
      for (const [a, b] of map.edges) {
        const [ax, ay] = map.pos[a], [bx, by] = map.pos[b];
        g.beginPath(); g.moveTo(px(ax), py(ay)); g.lineTo(px(bx), py(by)); g.stroke();
      }
    };
    stroke((2 * ROAD + 0.06) * s, COL.curb);
    stroke(2 * ROAD * s, COL.asphalt);
    laneDashes(g, segs);

    // Bank: the open spot nearest the first crew's start.
    const start = map.pos[state.crews[0].n];
    let best = null, bd = -1;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const p = [start[0] + Math.cos(a) * 0.42, start[1] + Math.sin(a) * 0.42];
      const d = Math.min(nearest(p[0], p[1]).d, riverDist(p[0], p[1]) - RIVER_HALF);
      if (d > bd) { bd = d; best = p; }
    }
    const bsz = clamp(bd * 2 - 0.1, 0.24, 0.42) * s;
    drawBankGlyph(g, px(best[0]) - bsz / 2, py(best[1]) - bsz / 2, bsz, bsz);

    map.gates.forEach((gt, i) => {
      const p = map.pos[gt], d = map.exitDirs[i];
      drawSign(g, px(p[0] + d[0] * SIGN_OUT), py(p[1] + d[1] * SIGN_OUT), i);
    });
    return off;
  }

  // ---------- dynamic layer ----------
  function alongPath(path, p) {
    const segs = path.length - 1;
    if (segs <= 0) return { pt: gpos(path[0]), seg: 0 };
    const f = clamp(p, 0, 1) * segs;
    const k = Math.min(segs - 1, Math.floor(f)), q = f - k;
    const [ax, ay] = gpos(path[k]), [bx, by] = gpos(path[k + 1]);
    return { pt: [ax + (bx - ax) * q, ay + (by - ay) * q], ang: Math.atan2(by - ay, bx - ax) };
  }
  const tweenP = (tw, t) => (tw ? ease(clamp((t - tw.start) / tw.dur, 0, 1)) : 1);

  function crewPose(ci, t) {
    const tw = anim.crews.find((c) => c.ci === ci);
    if (tw && t < tw.start + tw.dur) {
      if (t < tw.start) return { pt: gpos(tw.path[0]), ang: crewAngle(ci, tw.path) };
      const r = alongPath(tw.path, tweenP(tw, t));
      return { pt: r.pt, ang: r.ang };
    }
    return { pt: gpos(state.crews[ci].n), ang: crewAngle(ci) };
  }
  function crewAngle(ci, path) {
    const c = state.crews[ci];
    if (path && path.length > 1) return MG.angleBetween(map, path[0], path[1]);
    if (c.heading != null) return c.heading;
    const route = plans().next[ci];
    return route && route.length ? MG.angleBetween(map, c.n, route[0]) : -Math.PI / 2;
  }
  function carPose(i, t) {
    if (anim.car && anim.car.i === i && t < anim.car.start + anim.car.dur) {
      const r = alongPath(anim.car.path, tweenP(anim.car, t));
      return { pt: r.pt, ang: r.ang != null ? r.ang : state.carHeading[i] };
    }
    return { pt: gpos(state.cars[i]), ang: state.carHeading[i] };
  }

  function plans() {
    if (planCache.state !== state) {
      planCache = {
        state,
        next: state.crews.map((c, ci) => (c.status === 'run' ? MG.crewRoute(map, state, ci, map.cfg.speed) : [])),
        full: null,
      };
    }
    if (state.reveal && !planCache.full) {
      planCache.full = state.crews.map((c, ci) => (c.status === 'run' ? MG.crewRoute(map, state, ci, 40) : []));
    }
    return planCache;
  }

  function ring(x, y, radius, color, width, alpha) {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
  }

  function drawRoadblock(gx, gy, scale, alpha, t) {
    const s = L.s * scale, bw = s * 0.63, bh = s * 0.22;
    ctx.save();
    ctx.translate(px(gx), py(gy));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, -bw / 2 + s * 0.03, -bh / 2 + s * 0.05, bw, bh, s * 0.04); ctx.fill();
    ctx.fillStyle = COL.muted;
    ctx.fillRect(-bw * 0.36, bh / 2 - s * 0.01, s * 0.05, s * 0.09);
    ctx.fillRect(bw * 0.36 - s * 0.05, bh / 2 - s * 0.01, s * 0.05, s * 0.09);
    rr(ctx, -bw / 2, -bh / 2, bw, bh, s * 0.04);
    ctx.save(); ctx.clip();
    ctx.fillStyle = COL.caution; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = COL.console;
    for (let k = -6; k < 8; k++) {
      ctx.beginPath();
      const x0 = -bw / 2 + k * s * 0.1;
      ctx.moveTo(x0, bh / 2); ctx.lineTo(x0 + s * 0.05, bh / 2); ctx.lineTo(x0 + s * 0.05 + bh, -bh / 2); ctx.lineTo(x0 + bh, -bh / 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const blink = Math.floor(t / 500) % 2 === 0;
    ctx.fillStyle = blink ? COL.caution : rgba(COL.caution, 0.25);
    ctx.beginPath(); ctx.arc(-bw / 2, -bh / 2, s * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = !blink ? COL.caution : rgba(COL.caution, 0.25);
    ctx.beginPath(); ctx.arc(bw / 2, -bh / 2, s * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSpikes(gx, gy, scale, alpha) {
    const s = L.s * scale, w = s * 0.6, h = s * 0.11;
    ctx.save();
    ctx.translate(px(gx), py(gy));
    ctx.rotate(-0.5);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    rr(ctx, -w / 2 + s * 0.02, -h / 2 + s * 0.04, w, h, h / 2); ctx.fill();
    ctx.fillStyle = COL.curb;
    rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#d5ddeb';
    for (let k = 0; k < 6; k++) {
      const x = -w / 2 + w * (k + 0.5) / 6;
      ctx.beginPath(); ctx.moveTo(x - s * 0.035, -h / 2); ctx.lineTo(x, -h / 2 - s * 0.09); ctx.lineTo(x + s * 0.035, -h / 2); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawClosure(e, turnsLeft, alpha) {
    const [a, b] = map.edges[e];
    const [ax, ay] = map.pos[a], [bx, by] = map.pos[b];
    const s = L.s;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rgba(COL['siren-red'], 0.28);
    ctx.lineWidth = 2 * ROAD * s;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(px(ax), py(ay)); ctx.lineTo(px(bx), py(by)); ctx.stroke();
    const mx = px((ax + bx) / 2), my = py((ay + by) / 2);
    const ang = Math.atan2(by - ay, bx - ax);
    ctx.translate(mx, my);
    ctx.rotate(ang + Math.PI / 2);
    for (const off of [-0.11, 0.11]) {
      ctx.fillStyle = COL.getaway;
      ctx.beginPath(); ctx.moveTo(off * s, -s * 0.1); ctx.lineTo(off * s + s * 0.07, s * 0.07); ctx.lineTo(off * s - s * 0.07, s * 0.07); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2f5fa';
      ctx.fillRect(off * s - s * 0.035, -s * 0.02, s * 0.07, s * 0.03);
    }
    ctx.rotate(-(ang + Math.PI / 2));
    ctx.fillStyle = COL.console;
    ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.2, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.caution;
    ctx.font = `700 ${Math.round(s * 0.14)}px ${FONT_LABEL}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(turnsLeft), s * 0.2, -s * 0.195);
    ctx.restore();
  }

  function drawCar(gx, gy, angle, kind, t, alpha, label) {
    const s = L.s, len = s * 0.54, wid = s * 0.31;
    const x = px(gx), y = py(gy);
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (kind === 'police') {
      const phase = Math.floor(t / 240) % 2;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, s * 0.62);
      grd.addColorStop(0, rgba(phase ? COL['siren-red'] : COL['siren-blue'], 0.42));
      grd.addColorStop(1, rgba(phase ? COL['siren-red'] : COL['siren-blue'], 0));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y, s * 0.62, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    rr(ctx, -len / 2 + s * 0.02, -wid / 2 + s * 0.04, len, wid, wid * 0.32); ctx.fill();
    if (kind === 'police') {
      const skin = META.skin();
      ctx.fillStyle = skin.body;
      rr(ctx, -len / 2, -wid / 2, len, wid, wid * 0.32); ctx.fill();
      ctx.save(); rr(ctx, -len / 2, -wid / 2, len, wid, wid * 0.32); ctx.clip();
      ctx.fillStyle = skin.trim;
      ctx.fillRect(len * 0.27, -wid / 2, len * 0.25, wid);
      ctx.fillRect(-len / 2, -wid / 2, len * 0.17, wid);
      ctx.restore();
      ctx.fillStyle = '#9fb4d6';
      ctx.fillRect(len * 0.1, -wid * 0.36, len * 0.14, wid * 0.72);
      ctx.fillRect(-len * 0.3, -wid * 0.34, len * 0.09, wid * 0.68);
      const phase = Math.floor(t / 240) % 2;
      ctx.fillStyle = phase ? COL['siren-red'] : rgba(COL['siren-red'], 0.45);
      ctx.fillRect(-len * 0.08, -wid * 0.42, len * 0.11, wid * 0.4);
      ctx.fillStyle = !phase ? COL['siren-blue'] : rgba(COL['siren-blue'], 0.45);
      ctx.fillRect(-len * 0.08, wid * 0.02, len * 0.11, wid * 0.4);
    } else {
      ctx.fillStyle = COL.getaway;
      rr(ctx, -len / 2, -wid / 2, len, wid, wid * 0.32); ctx.fill();
      ctx.fillStyle = COL.console;
      ctx.fillRect(len * 0.1, -wid * 0.36, len * 0.15, wid * 0.72);
      ctx.fillRect(-len * 0.33, -wid * 0.34, len * 0.1, wid * 0.68);
      ctx.rotate(-angle);
      ctx.fillStyle = '#f3e3b8';
      ctx.beginPath(); ctx.arc(0, 0, wid * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.console;
      ctx.font = `700 ${Math.round(wid * 0.44)}px ${FONT_LABEL}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label || '$', 0, wid * 0.03);
    }
    ctx.restore();
  }

  function drawRoute(startPt, nodes, color, t, opts) {
    if (!nodes.length) return;
    const pts = [startPt].concat(nodes.map(gpos)).map(([x, y]) => [px(x), py(y)]);
    const pulse = opts.faint ? 0.5 : 0.55 + 0.35 * Math.sin(t / 220);
    ctx.save();
    ctx.strokeStyle = rgba(color, pulse);
    ctx.lineWidth = Math.max(2, L.s * (opts.faint ? 0.035 : 0.06));
    ctx.lineJoin = 'round';
    ctx.setLineDash(opts.faint ? [L.s * 0.05, L.s * 0.09] : [L.s * 0.08, L.s * 0.07]);
    ctx.lineDashOffset = -t / 40;
    // Start just off the car, end just before the last corner for the arrowhead.
    const first = pts[0], second = pts[1];
    const d0 = Math.hypot(second[0] - first[0], second[1] - first[1]) || 1;
    const sx = first[0] + (second[0] - first[0]) * Math.min(0.45, (L.s * 0.3) / d0);
    const sy = first[1] + (second[1] - first[1]) * Math.min(0.45, (L.s * 0.3) / d0);
    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    const ex = last[0] - Math.cos(ang) * L.s * 0.22, ey = last[1] - Math.sin(ang) * L.s * 0.22;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let k = 1; k < pts.length - 1; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!opts.faint) {
      ctx.fillStyle = rgba(color, pulse);
      const hx = last[0] - Math.cos(ang) * L.s * 0.1, hy = last[1] - Math.sin(ang) * L.s * 0.1;
      ctx.translate(hx, hy); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-L.s * 0.18, -L.s * 0.12); ctx.lineTo(-L.s * 0.18, L.s * 0.12); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function draw(t) {
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.fillStyle = COL.console;
    ctx.fillRect(0, 0, L.W, L.H);
    if (!map || !staticLayer) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticLayer, 0, 0);
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    const s = L.s;
    const playing = state.status === 'play';
    const idle = playing && !busy;

    // Closed streets
    state.closed.forEach((c) => {
      const a = anim.close && anim.close.e === c.e ? clamp((t - anim.close.start) / anim.close.dur, 0, 1) : 1;
      drawClosure(c.e, c.t, a);
    });

    // Where the selected unit can go
    if (idle && selectedCar == null) {
      if (tool === 'block' || tool === 'spike') {
        if (state.stock[tool] > 0 && state.used < map.cfg.orders) {
          for (let n = 0; n < map.N; n++) {
            const [x, y] = map.pos[n];
            if (MG.canPlace(map, state, tool, n)) {
              ctx.fillStyle = rgba(COL.lane, 0.34);
              ctx.beginPath(); ctx.arc(px(x), py(y), s * 0.045, 0, Math.PI * 2); ctx.fill();
            } else if (tool === 'block' && MG.tooClose(map, state, n) && MG.freeForPolice(map, state, n)) {
              ctx.strokeStyle = rgba(COL['siren-red'], 0.5);
              ctx.lineWidth = 1.5;
              const r = s * 0.05;
              ctx.beginPath(); ctx.moveTo(px(x) - r, py(y) - r); ctx.lineTo(px(x) + r, py(y) + r); ctx.moveTo(px(x) + r, py(y) - r); ctx.lineTo(px(x) - r, py(y) + r); ctx.stroke();
            }
          }
        }
      } else if (tool === 'traffic' && state.stock.traffic > 0) {
        map.edges.forEach(([a, b], e) => {
          if (!MG.canClose(map, state, e)) return;
          const [ax, ay] = map.pos[a], [bx, by] = map.pos[b];
          ctx.fillStyle = rgba(COL.getaway, 0.55);
          ctx.beginPath(); ctx.arc(px((ax + bx) / 2), py((ay + by) / 2), s * 0.05, 0, Math.PI * 2); ctx.fill();
        });
      }
    }

    // Hover (mouse only)
    if (idle && hoverPt) {
      const n = nodeAt(hoverPt[0], hoverPt[1]);
      if (tool === 'traffic' && selectedCar == null) {
        const e = edgeAt(hoverPt[0], hoverPt[1]);
        if (e != null && MG.canClose(map, state, e)) {
          const [a, b] = map.edges[e];
          ctx.strokeStyle = rgba(COL.ink, 0.35); ctx.lineWidth = 2 * ROAD * s * 0.8; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(px(map.pos[a][0]), py(map.pos[a][1])); ctx.lineTo(px(map.pos[b][0]), py(map.pos[b][1])); ctx.stroke();
        }
      } else if (n != null) {
        const ok = selectedCar != null ? MG.canMove(map, state, selectedCar, n) : MG.canPlace(map, state, tool, n) || state.cars.includes(n);
        if (ok) ring(px(map.pos[n][0]), py(map.pos[n][1]), s * 0.24, COL.ink, 1.5, 0.45);
      }
    }

    // Tutorial pointers
    if (idle && state.turn === 0 && state.used === 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 260);
      if (level.id === 1) {
        const [x, y] = map.pos[map.gates[0]];
        ring(px(x), py(y), s * (0.24 + 0.05 * pulse), COL.caution, 3, 0.5 + 0.4 * pulse);
      } else if (level.id === 4 && selectedCar == null && state.cars.length) {
        const [x, y] = map.pos[state.cars[0]];
        ring(px(x), py(y), s * (0.36 + 0.05 * pulse), COL.caution, 3, 0.5 + 0.4 * pulse);
      }
    }

    // Spikes and roadblocks
    state.spikes.forEach((n) => {
      const [x, y] = map.pos[n];
      const p = anim.place && anim.place.n === n ? clamp((t - anim.place.start) / anim.place.dur, 0, 1) : 1;
      drawSpikes(x, y, 1 + 0.4 * (1 - p), Math.min(1, p * 2));
    });
    state.blocks.forEach((n) => {
      const [x, y] = map.pos[n];
      if (anim.place && anim.place.n === n) {
        const p = clamp((t - anim.place.start) / anim.place.dur, 0, 1);
        drawRoadblock(x, y, 1 + 0.55 * (1 - p) * (1 - p) - 0.08 * Math.sin(p * Math.PI), Math.min(1, p * 2.2), t);
      } else drawRoadblock(x, y, 1, 1, t);
    });

    // Patrol car move targets
    if (playing && selectedCar != null) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 200);
      const [cx, cy] = map.pos[state.cars[selectedCar]];
      ring(px(cx), py(cy), s * 0.36, COL.caution, 3, 0.95);
      for (const v of MG.carTargets(map, state, selectedCar)) {
        const [x, y] = map.pos[v];
        const arrest = MG.crewAt(state, v) >= 0;
        const col = arrest ? COL['siren-red'] : COL['siren-blue'];
        ctx.fillStyle = rgba(col, 0.18 + 0.12 * pulse);
        ctx.beginPath(); ctx.arc(px(x), py(y), s * 0.22, 0, Math.PI * 2); ctx.fill();
        ring(px(x), py(y), s * (0.22 + 0.03 * pulse), col, 2.5, 0.9);
        if (arrest) {
          ctx.fillStyle = COL['siren-red'];
          ctx.font = `700 ${Math.round(s * 0.15)}px ${FONT_LABEL}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText('ARREST', px(x), py(y) - s * 0.3);
        }
      }
    }

    // Crew plans: next move always; whole route under the chopper.
    if (idle) {
      const pl = plans();
      state.crews.forEach((c, ci) => {
        if (c.status !== 'run') return;
        if (pl.full && pl.full[ci].length) {
          drawRoute(map.pos[c.n], pl.full[ci], COL.ink, t, { faint: true });
          const tail = pl.full[ci][pl.full[ci].length - 1];
          if (tail >= map.N) { const [ex, ey] = gpos(tail); ring(px(ex), py(ey), s * 0.42, COL.ink, 2, 0.4 + 0.3 * Math.sin(t / 300)); }
        }
        if (c.stun === 0 && pl.next[ci].length) drawRoute(map.pos[c.n], pl.next[ci], COL.getaway, t, {});
      });
    }

    // Crews
    state.crews.forEach((c, ci) => {
      const pose = crewPose(ci, t);
      let alpha = 1;
      if (c.status === 'escaped' && anim.escape) alpha = 1 - clamp((t - anim.escape) / 500, 0, 1) * 0.7;
      if (c.status === 'caught') alpha = 0.75;
      if (state.reveal && c.status === 'run' && !busy) {
        const grd = ctx.createRadialGradient(px(pose.pt[0]), py(pose.pt[1]), 0, px(pose.pt[0]), py(pose.pt[1]), s * 0.75);
        grd.addColorStop(0, 'rgba(255,255,255,0.16)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(px(pose.pt[0]), py(pose.pt[1]), s * 0.75, 0, Math.PI * 2); ctx.fill();
      }
      drawCar(pose.pt[0], pose.pt[1], pose.ang, 'robber', t, alpha, state.crews.length > 1 ? String(ci + 1) : '$');
      const tag = c.status === 'caught' ? 'CAUGHT' : c.stun > 0 ? 'STUCK' : null;
      if (tag && !anim.crews.some((a) => a.ci === ci && t < a.start + a.dur)) {
        if (c.status === 'caught') {
          const ph = Math.floor(t / 300) % 2;
          ring(px(pose.pt[0]), py(pose.pt[1]), s * 0.34, ph ? COL['siren-red'] : COL['siren-blue'], 2.5, 0.8);
        }
        ctx.fillStyle = c.status === 'caught' ? COL['siren-red'] : COL.caution;
        ctx.font = `700 ${Math.round(s * 0.14)}px ${FONT_LABEL}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(tag, px(pose.pt[0]), py(pose.pt[1]) - s * 0.26);
      }
    });

    // Patrol cars
    state.cars.forEach((n, i) => {
      const pose = carPose(i, t);
      const spent = playing && state.moved.includes(i) && map.cfg.orders > 1;
      drawCar(pose.pt[0], pose.pt[1], pose.ang, 'police', t, spent ? 0.6 : 1);
      ctx.fillStyle = spent ? COL.muted : COL.ink;
      ctx.font = `700 ${Math.round(s * 0.13)}px ${FONT_LABEL}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('UNIT ' + (i + 1), px(pose.pt[0]), py(pose.pt[1]) + s * 0.24);
    });

    // Capture effect
    if (anim.fx) {
      const p = clamp((t - anim.fx) / 900, 0, 1);
      state.crews.forEach((c) => {
        if (c.status !== 'caught') return;
        const [x, y] = gpos(c.n);
        for (let k = 0; k < 3; k++) {
          const q = clamp(p * 1.4 - k * 0.2, 0, 1);
          if (q <= 0) continue;
          ring(px(x), py(y), s * (0.2 + q * 0.9), k % 2 ? COL['siren-red'] : COL['siren-blue'], 3, 1 - q);
        }
      });
    }
  }

  function frame() {
    if (staticDirty && map) { staticLayer = isGrid() ? renderStaticGrid() : renderStaticCity(); staticDirty = false; }
    draw(now());
    requestAnimationFrame(frame);
  }

  // ---------- turns ----------
  function heliReport(s) {
    const lines = [];
    s.crews.forEach((c, ci) => {
      if (c.status !== 'run') return;
      const route = MG.crewRoute(map, s, ci, 40);
      const tail = route[route.length - 1];
      const who = s.crews.length > 1 ? `Crew ${ci + 1}` : 'Crew';
      if (tail != null && tail >= map.N) lines.push(`${who} heading for ${exitName(tail - map.N)}, ${plural(route.length - 1, 'corner')} out.`);
      else lines.push(`${who} has no clear way out.`);
    });
    return 'Chopper up. ' + lines.join(' ');
  }

  function describe(prev, res) {
    const a = res.events.act, s = res.state;
    const at = (n) => (isGrid() ? ` at ${corner(n)}` : '');
    const parts = [];
    if (a.t === 'block') parts.push(`Roadblock up${at(a.n)}.`);
    else if (a.t === 'spike') parts.push(`Spike strip down${at(a.n)}.`);
    else if (a.t === 'traffic') parts.push('Street closed for 2 turns.');
    else if (a.t === 'heli') return heliReport(s);
    else if (a.t === 'move') {
      if (res.events.arrest != null) parts.push(`Unit ${a.i + 1} made the arrest${at(a.n)}!`);
      else parts.push(isGrid() ? `Unit ${a.i + 1} to ${corner(a.n)}.` : `Unit ${a.i + 1} in position.`);
    } else parts.push(map.cfg.orders > 1 ? 'Orders sent.' : 'Units holding position.');

    if (s.status === 'won') {
      if (s.crews.length > 1) parts.push('Both crews in custody. Code 4.');
      else parts.push(res.events.arrest != null ? 'Code 4.' : 'Every route out is sealed. Suspect boxed in. Code 4.');
      return parts.join(' ');
    }
    if (s.status === 'lost') {
      const ci = s.crews.findIndex((c) => c.status === 'escaped');
      return `${crewName(ci)} took ${exitName(s.crews[ci].n - map.N)} out of town. We lost them.`;
    }
    s.crews.forEach((c, ci) => {
      if (prev.crews[ci].status === 'run' && c.status === 'caught') parts.push(`${crewName(ci)} boxed in!`);
    });
    if (res.events.moves) {
      for (const m of res.events.moves) {
        const c = s.crews[m.ci];
        if (c.status === 'caught') continue;
        if (m.stunned) parts.push(`${crewName(m.ci)} is stuck changing a tyre.`);
        else if (m.spiked) parts.push(`${crewName(m.ci)} hit the spikes!`);
        else if (m.path.length > 1) parts.push(`${crewName(m.ci)} ${movePhrase(m.path)}.`);
      }
    } else if (map.cfg.orders > 1) {
      const left = map.cfg.orders - s.used;
      parts.push(left ? `${plural(left, 'order')} left.` : '');
    }
    return parts.filter(Boolean).join(' ');
  }

  function actionSounds(a, res, prev, t0, crewStart) {
    const s = res.state;
    if (a.t === 'block') { sfx('block'); AUDIO.buzz(12); }
    else if (a.t === 'spike') sfx('spike');
    else if (a.t === 'traffic') sfx('traffic');
    else if (a.t === 'heli') sfx('heli');
    else if (a.t === 'move') sfx('car');
    else sfx('dispatch');
    const moves = res.events.moves || [];
    const later = (ms, fn) => setTimeout(fn, Math.max(0, ms));
    if (moves.some((m) => m.path.length > 1)) later(crewStart - t0, () => sfx('crew'));
    if (moves.some((m) => m.spiked)) later(crewStart - t0 + 280 * SPEED, () => { sfx('tyre'); AUDIO.buzz(25); });
    const newlyCaught = s.crews.some((c, ci) => prev.crews[ci].status === 'run' && c.status === 'caught');
    if (newlyCaught && s.status === 'play') later(crewStart - t0 + 300, () => sfx('sealed'));
  }

  function doAction(a) {
    if (busy || state.status !== 'play') return;
    hideCoach(true);
    const prev = state;
    const res = MG.step(map, state, a);
    history.push(prev);
    selectedCar = null;
    busy = true;
    const t0 = now();
    const D1 = 240 * SPEED, STEP = 270 * SPEED;
    anim.place = a.t === 'block' || a.t === 'spike' ? { n: a.n, start: t0, dur: D1 } : null;
    anim.close = a.t === 'traffic' ? { e: a.e, start: t0, dur: D1 } : null;
    anim.car = a.t === 'move' && res.events.carPath ? { i: a.i, path: res.events.carPath, start: t0, dur: D1 * Math.max(1, res.events.carPath.length - 1) * 0.85 } : null;
    let end = t0 + (a.t === 'dispatch' || a.t === 'heli' ? 0 : anim.car ? anim.car.dur : D1);
    anim.crews = [];
    const st = end - D1 * 0.15;
    actionSounds(a, res, prev, t0, st);
    if (res.events.moves) {
      for (const m of res.events.moves) {
        if (m.path.length < 2) continue;
        const dur = STEP * (m.path.length - 1);
        anim.crews.push({ ci: m.ci, path: m.path, start: st, dur });
        end = Math.max(end, st + dur);
      }
    }
    state = res.state;
    if ((a.t === 'spike' || a.t === 'traffic') && state.stock.block > 0) tool = 'block';
    if (state.stock[tool] === 0) tool = ['block', 'spike', 'traffic'].find((k) => state.stock[k] > 0) || tool;
    radio(describe(prev, res));
    updateHud();
    setTimeout(finishAction, Math.max(40, end - t0 + 30));
  }

  function finishAction() {
    anim.place = anim.close = anim.car = null;
    anim.crews = [];
    if (state.status === 'won') {
      anim.fx = now();
      sfx('busted'); AUDIO.buzz([30, 40, 70]);
      setTimeout(showResult, 750 * SPEED + 150);
      return;
    }
    if (state.status === 'lost') {
      anim.escape = now();
      sfx('escape'); AUDIO.buzz(180);
      setTimeout(showResult, 550);
      return;
    }
    busy = false;
    updateHud();
    maybeCoach();
    const acts = MG.legalOrders(map, state);
    const stuck = acts.length === 1 && acts[0].t === 'dispatch';
    if (stuck && map.cfg.orders === 1) {
      radio('No orders left to give. Units holding.');
      busy = true;
      setTimeout(() => { busy = false; doAction({ t: 'dispatch' }); }, 700);
    } else if (stuck) {
      radio('Nothing left to deploy this turn. Tap DISPATCH.');
    }
  }

  function nodeAt(x, y) {
    let best = null, bd = Infinity;
    for (let n = 0; n < map.N; n++) {
      const [gx, gy] = map.pos[n];
      const d = Math.hypot(px(gx) - x, py(gy) - y);
      if (d < bd) { bd = d; best = n; }
    }
    return bd <= L.s * 0.45 ? best : null;
  }
  function edgeAt(x, y) {
    let best = null, bd = Infinity;
    map.edges.forEach(([a, b], e) => {
      const d = segDist(x, y, px(map.pos[a][0]), py(map.pos[a][1]), px(map.pos[b][0]), py(map.pos[b][1]));
      if (d < bd) { bd = d; best = e; }
    });
    return bd <= L.s * 0.3 ? best : null;
  }

  function nudge(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
  }

  // ---------- tutorial bubbles (each one shows once per player) ----------
  let coach = null; // { key, text, at() -> [x, y] on screen, gap, tool? }
  function nodeScreen(n) {
    const r = canvas.getBoundingClientRect(), [x, y] = gpos(n);
    return [r.left + px(x), r.top + py(y)];
  }
  function elScreen(id, side) {
    const el = $(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return side === 'left' ? [r.left, r.top + r.height / 2] : [r.left + r.width / 2, r.top];
  }
  function placeCoach() {
    const el = $('coach');
    const pt = coach && coach.at();
    if (!pt) { el.hidden = true; return; }
    el.hidden = false;
    el.classList.remove('below', 'above', 'left');
    const gap = coach.gap || 14;
    if (coach.side === 'left') { // bubble sits left of the target, arrow pointing right
      el.style.maxWidth = Math.max(140, pt[0] - gap - 16) + 'px';
      el.classList.add('left');
      el.style.left = Math.max(16, pt[0] - gap - el.offsetWidth) + 'px';
      el.style.top = (pt[1] - el.offsetHeight / 2) + 'px';
      return;
    }
    el.style.maxWidth = '';
    const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth;
    const below = pt[1] - gap - h < 8;
    const left = clamp(pt[0] - w / 2, 16, Math.max(16, vw - 16 - w));
    el.style.left = left + 'px';
    el.style.top = (below ? pt[1] + gap : pt[1] - gap - h) + 'px';
    el.classList.add(below ? 'below' : 'above');
    el.style.setProperty('--ax', clamp(pt[0] - left, 14, w - 14) + 'px');
  }
  function hideCoach(markSeen) {
    if (coach && markSeen) META.markSeen(coach.key);
    coach = null;
    const el = $('coach');
    if (el) el.hidden = true;
  }
  function maybeCoach() {
    if (coach || busy || !state || state.status !== 'play') return;
    const fresh = state.turn === 0 && state.used === 0;
    const id = mode === 'case' ? level.id : 0;
    const near = L.s * 0.42;
    const list = [
      id === 1 && fresh && { key: 'c1-block', text: 'Tap this corner to set up a roadblock.', at: () => nodeScreen(map.gates[0]), gap: near },
      id === 2 && fresh && { key: 'c2-arrow', text: 'The orange arrow is their next move. Seal every road out.', at: () => nodeScreen(state.crews[0].n), gap: near },
      id === 4 && fresh && state.cars.length && { key: 'c4-car', text: 'Tap your patrol car, then a glowing corner.', at: () => nodeScreen(state.cars[0]), gap: near },
      id === 16 && fresh && { key: 'c16-orders', text: 'Up to 3 orders, then DISPATCH.', at: () => elScreen('btn-dispatch', 'left'), side: 'left', gap: 12 },
      id === 16 && !fresh && !state.reveal && state.stock.heli > 0 && { key: 'c16-heli', text: 'Free: the chopper shows their whole plan.', at: () => elScreen('tool-heli'), tool: 'heli' },
      $('tool-spike') && { key: 'spike', text: 'New: spike strips. Select, then tap a corner.', at: () => elScreen('tool-spike'), tool: 'spike' },
      $('tool-traffic') && { key: 'traffic', text: 'New: traffic control. Select, then tap a street.', at: () => elScreen('tool-traffic'), tool: 'traffic' },
      !isGrid() && fresh && { key: 'zoom', text: 'Tip: pinch the map to zoom in.', at: () => { const r = canvas.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; } },
      (id >= 5 || mode === 'daily') && state.stock.block === 0 && boost.block < META.MAX_BACKUP &&
        { key: 'backup', text: 'Out of roadblocks? Tap here to call backup.', at: () => elScreen('tool-block'), tool: 'block' },
    ];
    const c = list.find((k) => k && !META.seen(k.key));
    if (!c) return;
    coach = c;
    $('coach-text').textContent = c.text;
    placeCoach();
  }

  function handleTap(x, y) {
    if (busy || state.status !== 'play') return;
    const n = nodeAt(x, y);
    if (n != null) {
      const carIdx = state.cars.indexOf(n);
      if (carIdx >= 0) {
        if (state.moved.includes(carIdx)) { sfx('error'); radio(`Unit ${carIdx + 1} already moved this turn.`); return; }
        if (state.used >= map.cfg.orders) return;
        selectedCar = selectedCar === carIdx ? null : carIdx;
        if (selectedCar != null) {
          sfx('select');
          if (coach && coach.key === 'c4-car') hideCoach(true);
          radio(`Unit ${carIdx + 1} standing by. Pick a glowing corner${map.cfg.carRange > 1 ? ', up to 2 away' : ''}.`);
        }
        updateHud();
        return;
      }
    }
    if (selectedCar != null) {
      if (n != null && MG.canMove(map, state, selectedCar, n)) doAction({ t: 'move', i: selectedCar, n });
      else { selectedCar = null; updateHud(); }
      return;
    }
    if (tool === 'traffic') {
      const e = edgeAt(x, y);
      if (e == null) return;
      if (MG.canClose(map, state, e)) doAction({ t: 'traffic', e });
      else if (state.stock.traffic === 0) { nudge('tool-traffic'); radio('No traffic units left.'); }
      else radio('Too late to close that street: the crew is already on it.');
      return;
    }
    if (n == null) return;
    if (MG.crewAt(state, n) >= 0) {
      sfx('error');
      radio('That is a getaway car. Box it in, or drive a patrol car into it.');
      return;
    }
    if (state.stock[tool] === 0) {
      if (tool === 'block' && MG.freeForPolice(map, state, n)) { askBackup('block'); return; }
      nudge('tool-' + tool); sfx('error');
      radio(state.cars.length ? `No ${tool === 'block' ? 'roadblocks' : 'spike strips'} left. Tap a patrol car to move it.` : 'Nothing left of that unit.');
      return;
    }
    if (MG.canPlace(map, state, tool, n)) doAction({ t: tool, n });
    else if (tool === 'block' && MG.tooClose(map, state, n)) { sfx('error'); radio('Too close: there is no time to set a roadblock right in front of them. Use a patrol car or spikes.'); }
  }

  document.addEventListener('pointerdown', () => AUDIO.unlock(), true);
  document.addEventListener('keydown', () => AUDIO.unlock(), true);
  // ---------- map gestures: tap (on release), drag to pan when zoomed, pinch or wheel to zoom ----------
  const touches = new Map(); // pointerId -> [x, y]
  let gesture = null;        // { kind: 'tap' | 'pan' | 'drag' | 'pinch' | 'done', ... }
  const localPt = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const midDist = () => {
    const [a, b] = [...touches.values()];
    return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!map) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = localPt(e);
    touches.set(e.pointerId, p);
    if (touches.size === 1) gesture = { kind: 'tap', start: p, cx: cam.x, cy: cam.y };
    else if (touches.size === 2) {
      const m = midDist();
      gesture = { kind: 'pinch', d0: m.d, z0: cam.z, last: m.mid };
      if (coach && coach.key === 'zoom') hideCoach(true);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!map) return;
    const p = localPt(e);
    if (e.pointerType === 'mouse' && !touches.size) { hoverPt = p; return; }
    hoverPt = null;
    if (!touches.has(e.pointerId) || !gesture) return;
    touches.set(e.pointerId, p);
    if (gesture.kind === 'pinch' && touches.size >= 2) {
      const m = midDist();
      cam.x += m.mid[0] - gesture.last[0];
      cam.y += m.mid[1] - gesture.last[1];
      updateView();
      zoomAt(m.mid[0], m.mid[1], gesture.z0 * m.d / gesture.d0);
      gesture.last = m.mid;
    } else if (gesture.kind === 'tap' || gesture.kind === 'pan') {
      const dx = p[0] - gesture.start[0], dy = p[1] - gesture.start[1];
      const zoomed = cam.z > 1.01;
      if (gesture.kind === 'tap' && Math.hypot(dx, dy) > (zoomed ? 10 : 24)) gesture.kind = zoomed ? 'pan' : 'drag';
      if (gesture.kind === 'pan') { cam.x = gesture.cx + dx; cam.y = gesture.cy + dy; updateView(); }
    }
  });
  function endTouch(e, cancelled) {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    if (gesture && gesture.kind === 'tap' && !cancelled && touches.size === 0) handleTap(gesture.start[0], gesture.start[1]);
    if (touches.size === 0) gesture = null;
    else if (gesture && gesture.kind === 'pinch') gesture = { kind: 'done' }; // wait until every finger is up
  }
  canvas.addEventListener('pointerup', (e) => endTouch(e, false));
  canvas.addEventListener('pointercancel', (e) => endTouch(e, true));
  canvas.addEventListener('pointerleave', () => { hoverPt = null; });
  canvas.addEventListener('wheel', (e) => {
    if (!map) return;
    e.preventDefault();
    const p = localPt(e);
    zoomAt(p[0], p[1], cam.z * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  $('btn-fit').addEventListener('click', () => { resetZoom(); sfx('tap'); });

  // ---------- screens ----------
  let result = null; // what the open result screen paid out: { coins, doubled, rank, watched }
  const closedCount = () => progress.unlocked - 1;

  function showResult() {
    busy = false;
    hideCoach(false);
    const won = state.status === 'won';
    const used = turnsUsed(state);
    const stars = won ? (used <= level.par ? 3 : used <= level.par + 1 ? 2 : 1) : 0;
    result = { coins: 0, doubled: false, rank: null, watched: false, note: '' };
    if (won && mode === 'case') {
      const prevStars = progress.stars[level.id] || 0;
      progress.stars[level.id] = Math.max(prevStars, stars);
      progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2));
      saveProgress();
      const r = META.caseReward({ stars, prevStars, chief: level.id >= 16 });
      META.addCoins(r.total);
      result.coins = r.total;
      result.note = r.first ? `${r.base} for the case + ${r.stars} for stars` : r.stars ? 'Replay bonus + new stars' : 'Replay bonus';
      result.rank = META.checkRank(closedCount());
      META.countWin();
    } else if (won && mode === 'daily') {
      const d = META.winDaily();
      if (d) {
        result.coins = d.coins;
        result.note = d.streak > 1 ? `Daily Heist · ${d.streak}-day streak bonus` : 'Daily Heist reward';
      } else result.note = 'Already closed today: no coins on replays.';
      META.countWin();
      updateDots();
    }
    const stamp = $('stamp');
    stamp.textContent = won ? 'BUSTED!' : 'GOT AWAY';
    stamp.className = 'stamp ' + (won ? 'won' : 'lost');
    const escaped = state.crews.find((c) => c.status === 'escaped');
    $('result-line').textContent = won
      ? (state.crews.length > 1 ? 'Both crews in custody. Code 4.' : state.how === 'arrest' ? 'Arrest made. Code 4.' : 'Every route out sealed. Code 4.')
      : `Suspect escaped on ${exitName(escaped.n - map.N)}.`;
    $('stars').innerHTML = starsHTML(stars);
    $('stars').hidden = !won;
    for (let k = 0; k < stars; k++) setTimeout(() => sfx('star', k), 420 + k * 190);
    const turns = plural(used, 'turn');
    $('result-meta').textContent = won
      ? (stars === 3 ? `Caught in ${turns}. That is par.` : `Caught in ${turns}. Par is ${level.par}.`)
      : 'Watch a video to rewind 2 turns, or restart the case.';
    showReward();
    const rk = result.rank;
    $('promo').hidden = !rk;
    if (rk) {
      $('promo-title').textContent = `Promoted to ${rk.name}`;
      $('promo-text').textContent = (rk.name === 'Chief'
        ? 'You now give 3 orders per turn. New units: spike strips, traffic control and the chopper. The crews are pros now: they drive 2 corners per turn and get smarter every case. The Daily Heist is open too. '
        : 'Your city trusts you with more. ') + `Rank bonus: +${META.RANK_BONUS} coins.`;
      setTimeout(() => sfx('rank'), 1100);
    }
    const last = mode === 'case' && levelIndex === LEVELS.length - 1;
    $('btn-next').hidden = !won;
    $('btn-next').textContent = mode === 'daily' ? 'Back to HQ' : last ? 'All cases closed' : rk && rk.name === 'Chief' ? 'Take command' : 'Next case';
    $('btn-double').hidden = !won || result.coins === 0;
    $('btn-double').disabled = false;
    $('btn-rewind').hidden = won || history.length === 0;
    $('btn-retry').textContent = won ? (mode === 'daily' ? 'Play again' : 'Replay case') : 'Restart case';
    $('ov-result').hidden = false;
    (won ? $('btn-next') : (history.length ? $('btn-rewind') : $('btn-retry'))).focus({ preventScroll: true });
    updateHud();
  }

  function showReward() {
    const box = $('reward');
    box.hidden = !(state.status === 'won');
    if (box.hidden) return;
    $('reward-coins').textContent = result.coins ? `+${result.coins}` : '+0';
    $('reward-note').textContent = result.doubled ? 'Doubled. Thanks for watching!' : result.note;
    const amt = $('reward-amt');
    amt.classList.remove('pop'); void amt.offsetWidth; amt.classList.add('pop');
    if (result.coins) setTimeout(() => sfx('coin'), 250);
  }

  function nextFromResult() {
    if (mode === 'daily') { $('ov-result').hidden = true; openCases('daily'); return; }
    if (levelIndex === LEVELS.length - 1) { $('ov-result').hidden = true; openCases('cases'); return; }
    const go = () => loadLevel(levelIndex + 1);
    // An ad between cases: never right after a promotion or a bonus video.
    if (!result.rank && !result.watched && META.interstitialDue(closedCount())) {
      $('btn-next').disabled = true;
      ADS.interstitial().then(() => { META.adShown(); $('btn-next').disabled = false; go(); });
    } else go();
  }

  // ---------- Police HQ: cases, daily heist, shop, settings ----------
  let hqTab = 'cases';
  const TABS = ['cases', 'daily', 'shop', 'settings'];

  function updateDots() {
    const due = dailyOpen() && !META.dailyDoneToday();
    $('hq-dot').hidden = !due;
    $('tab-daily-dot').hidden = !due;
  }

  function openCases(tab) {
    hqTab = TABS.includes(tab) ? tab : hqTab;
    $('ov-cases').hidden = false;
    renderHQ();
    $('btn-cases-close').focus({ preventScroll: true });
  }

  function renderHQ() {
    $('cases-rank').textContent = `Rank: ${META.rankName()}`;
    $('hq-coins').textContent = META.get().coins.toLocaleString();
    TABS.forEach((t) => {
      $('tab-' + t).setAttribute('aria-selected', String(t === hqTab));
      $('panel-' + t).hidden = t !== hqTab;
    });
    updateDots();
    if (hqTab === 'cases') renderCases();
    else if (hqTab === 'daily') renderDaily();
    else if (hqTab === 'shop') renderShop();
    else renderSettings();
  }

  function rankLine(lv) {
    const t = [DISTRICT[lv.district || 'downtown'], RANK[lv.crew ? lv.crew.rank : 1]];
    if ((lv.starts || []).length > 1) t.push('2 cars');
    if (lv.crew && lv.crew.speed >= 3) t.push('Fast');
    return t.join(' · ');
  }

  function renderDaily() {
    const box = $('panel-daily');
    const lv = todayDaily();
    if (!dailyOpen() || !lv) {
      box.innerHTML = `<div class="hq-section"><div class="daily-card"><h3>Daily Heist</h3><p class="daily-locked">A new heist every day, with bonus coins and a streak reward. Opens when you make Chief (close Case 15).</p></div></div>`;
      return;
    }
    const done = META.dailyDoneToday();
    const streak = META.currentStreak();
    const nextStreak = META.dailyStreakIfWon();
    const coins = META.dailyReward(nextStreak);
    const today = new Date();
    const dateStr = today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    // This week, Monday first. A day is lit if it falls inside the current streak.
    const p = META.get();
    const last = p.daily.last ? new Date(p.daily.last + 'T12:00:00') : null;
    const mondayOff = (today.getDay() + 6) % 7;
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, k) => {
      const d = new Date(today); d.setDate(today.getDate() - mondayOff + k);
      let lit = false;
      if (last && streak > 0) {
        const diff = Math.round((last - new Date(META.dayKey(d) + 'T12:00:00')) / 86400000);
        lit = diff >= 0 && diff < p.daily.streak;
      }
      return `<span class="${lit ? 'done' : ''}${k === mondayOff ? ' today' : ''}">${label}</span>`;
    }).join('');
    box.innerHTML = `
      <div class="hq-section">
        <div class="daily-card">
          <span class="eyebrow">Daily Heist · ${dateStr}</span>
          <h3></h3>
          <span class="daily-meta">${rankLine(lv)} · Par ${lv.par}</span>
          <p>${done ? 'Closed today. A new heist drops at midnight.' : `Reward: ${COIN} <strong>${coins}</strong> coins${nextStreak > 1 ? ` (day ${nextStreak} streak bonus)` : ''}.`}</p>
          <div class="week" aria-label="This week">${days}</div>
          <span class="daily-meta">Streak: ${plural(streak, 'day')}${p.daily.best > 1 ? ` · Best ${p.daily.best}` : ''}. Easy on Monday, hardest on Sunday.</span>
          <button class="btn primary" id="btn-daily-go">${done ? 'Play again (no coins)' : 'Start the heist'}</button>
        </div>
      </div>`;
    box.querySelector('h3').textContent = lv.name;
    $('btn-daily-go').addEventListener('click', () => { $('ov-cases').hidden = true; loadDaily(); });
  }

  function renderShop() {
    const box = $('panel-shop');
    const p = META.get();
    const freeLeft = META.freeCoinsLeft();
    const boosterRow = (kind, icon) => {
      const b = META.BOOSTERS[kind];
      return `<div class="row"><span class="row-icon">${icon}</span><span class="row-main"><strong>${b.name}</strong><span>You have ${p.boosters[kind]}. Use one when you run out in a case.</span></span>
        <button class="btn" data-buy-booster="${kind}" ${p.coins < b.price ? 'disabled' : ''}>${COIN}${b.price}</button></div>`;
    };
    const skins = META.SKINS.map((s) => {
      const owned = p.skins.includes(s.id), on = p.skin === s.id;
      const tag = on ? 'Equipped' : owned ? 'Owned' : `${COIN}${s.price}`;
      return `<button class="skin${!owned && p.coins < s.price ? ' locked' : ''}" data-skin="${s.id}" aria-pressed="${on}">${carSvg(s)}<strong>${s.name}</strong><span>${tag}</span></button>`;
    }).join('');
    const products = META.PRODUCTS.map((pr) => {
      const owned = (pr.id === 'remove_ads' && p.removeAds) || (pr.id === 'starter' && p.starter);
      return `<div class="row"><span class="row-main"><strong>${pr.name}</strong><span>${pr.desc}</span></span>
        <button class="btn${owned ? '' : ' primary'}" data-product="${pr.id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : pr.price}</button></div>`;
    }).join('');
    box.innerHTML = `
      <div class="hq-section"><h3>Boosters</h3>${boosterRow('block', ICON.block)}${boosterRow('heli', ICON.heli)}</div>
      <div class="hq-section"><h3>Free coins</h3>
        <div class="row"><span class="row-icon">${COIN}</span><span class="row-main"><strong>+${META.FREE_COINS} coins</strong><span>Watch a short video. ${freeLeft} left today.</span></span>
        <button class="btn video" id="btn-free-coins" ${freeLeft ? '' : 'disabled'}>${PLAY}Watch</button></div>
      </div>
      <div class="hq-section"><h3>Patrol car paint</h3><div class="skins">${skins}</div></div>
      <div class="hq-section"><h3>Support the force</h3>${products}</div>`;
    box.querySelectorAll('[data-buy-booster]').forEach((b) => b.addEventListener('click', () => {
      if (META.buyBooster(b.dataset.buyBooster)) { sfx('coin'); renderHQ(); }
    }));
    box.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.skin;
      if (p.skins.includes(id)) { META.wearSkin(id); sfx('tap'); renderHQ(); }
      else if (META.buySkin(id)) { sfx('coin'); renderHQ(); }
      else { sfx('error'); nudge(b.id); }
    }));
    box.querySelectorAll('[data-product]').forEach((b) => b.addEventListener('click', () => {
      const pr = META.PRODUCTS.find((k) => k.id === b.dataset.product);
      ADS.buy(pr).then((ok) => { if (ok) { META.grantProduct(pr.id); sfx('rank'); renderHQ(); } });
    }));
    $('btn-free-coins').addEventListener('click', () => {
      ADS.rewarded('coins').then((ok) => { if (ok) { META.takeFreeCoins(); META.adShown(); sfx('coin'); renderHQ(); } });
    });
  }

  function renderSettings() {
    const box = $('panel-settings');
    const s = AUDIO.settings;
    const toggle = (key, label, sub) => `<div class="row toggle-row"><span class="row-main"><strong>${label}</strong><span>${sub}</span></span>
      <button class="switch" role="switch" aria-checked="${!!s[key]}" aria-label="${label}" data-set="${key}"></button></div>`;
    box.innerHTML = `
      <div class="hq-section"><h3>Settings</h3>
        ${toggle('sound', 'Sound effects', 'Sirens, roadblocks, radio')}
        ${toggle('music', 'Music', 'Quiet background loop')}
        ${toggle('vibrate', 'Vibration', 'On phones that support it')}
      </div>
      <div class="hq-section"><h3>Testing</h3>
        <div class="row"><span class="row-main"><strong>Unlock all cases</strong><span>Jump to any case.</span></span><button class="btn" id="btn-unlock">Unlock</button></div>
        <div class="row"><span class="row-main"><strong>+500 coins</strong><span>Try the shop.</span></span><button class="btn" id="btn-test-coins">Add</button></div>
        <div class="row"><span class="row-main"><strong>Reset everything</strong><span>Progress, coins, purchases, tutorial.</span></span><button class="btn" id="btn-reset">Reset</button></div>
      </div>
      <p class="eyebrow">Getaway Gridlock · prototype ${VERSION}</p>`;
    box.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
      AUDIO.set(b.dataset.set, !AUDIO.settings[b.dataset.set]);
      b.setAttribute('aria-checked', String(!!AUDIO.settings[b.dataset.set]));
      sfx('tap');
    }));
    $('btn-unlock').addEventListener('click', () => { progress.unlocked = LEVELS.length; saveProgress(); updateDots(); hqTab = 'cases'; renderHQ(); });
    $('btn-test-coins').addEventListener('click', () => { META.addCoins(500); sfx('coin'); renderHQ(); });
    let armed = false;
    $('btn-reset').addEventListener('click', (e) => {
      if (!armed) { armed = true; e.currentTarget.textContent = 'Tap again'; return; }
      progress = { unlocked: 1, stars: {} }; saveProgress();
      META.reset();
      $('ov-cases').hidden = true;
      loadLevel(0);
      updateDots();
    });
  }

  function renderCases() {
    const grid = $('case-grid');
    grid.innerHTML = '';
    let group = null;
    LEVELS.forEach((lv, i) => {
      const d = lv.district || 'downtown';
      if (d !== group) {
        group = d;
        const head = document.createElement('div');
        head.className = 'case-group';
        const first = LEVELS.findIndex((l) => (l.district || 'downtown') === d);
        const lastIdx = LEVELS.length - 1 - [...LEVELS].reverse().findIndex((l) => (l.district || 'downtown') === d);
        head.innerHTML = `<h3></h3><span class="eyebrow">Cases ${LEVELS[first].id}–${LEVELS[lastIdx].id}${d === 'downtown' ? ' · Officer' : ' · Chief'}</span>`;
        head.querySelector('h3').textContent = DISTRICT[d];
        grid.appendChild(head);
      }
      const b = document.createElement('button');
      const locked = i + 1 > progress.unlocked;
      b.className = 'case-tile' + (mode === 'case' && i === levelIndex ? ' current' : '');
      b.disabled = locked;
      b.innerHTML = `<span class="tile-no">#${pad3(lv.id)}</span><span class="tile-name"></span><span class="tile-stars">${starsHTML(progress.stars[lv.id] || 0)}</span>`;
      b.querySelector('.tile-name').textContent = locked ? 'Locked' : lv.name;
      b.setAttribute('aria-label', locked ? `Case ${lv.id}, locked` : `Case ${lv.id}, ${lv.name}, ${progress.stars[lv.id] || 0} stars`);
      b.addEventListener('click', () => { $('ov-cases').hidden = true; loadLevel(i); });
      grid.appendChild(b);
    });
    const cur = grid.querySelector('.case-tile.current');
    if (cur) cur.scrollIntoView({ block: 'center' });
  }

  const replay = () => (mode === 'daily' ? loadDaily() : loadLevel(levelIndex));
  $('btn-cases').addEventListener('click', () => openCases());
  $('btn-cases-close').addEventListener('click', () => { $('ov-cases').hidden = true; });
  TABS.forEach((t) => $('tab-' + t).addEventListener('click', () => { hqTab = t; sfx('tap'); renderHQ(); }));
  $('btn-restart').addEventListener('click', () => { if (!busy) replay(); });
  $('btn-dispatch').addEventListener('click', () => doAction({ t: 'dispatch' }));
  $('btn-undo').addEventListener('click', () => {
    if (busy || !history.length || state.status !== 'play') return;
    const heliLeft = state.stock.heli;
    state = MG.clone(history.pop());
    state.stock.heli = Math.min(state.stock.heli, heliLeft); // a chopper flight is not refunded
    if (state.reveal && heliLeft === state.stock.heli) state.reveal = state.reveal;
    selectedCar = null;
    updateHud();
    radio('Last order cancelled.');
  });
  $('btn-retry').addEventListener('click', replay);
  $('btn-next').addEventListener('click', nextFromResult);
  $('btn-double').addEventListener('click', () => {
    if (!result || result.doubled || !result.coins) return;
    $('btn-double').disabled = true;
    ADS.rewarded('double').then((ok) => {
      if (!ok) { $('btn-double').disabled = false; return; }
      META.addCoins(result.coins);
      META.adShown();
      result.coins *= 2; result.doubled = true; result.watched = true;
      $('btn-double').hidden = true;
      showReward();
    });
  });
  $('btn-rewind').addEventListener('click', () => {
    ADS.rewarded('rewind').then((ok) => {
      if (!ok) return;
      META.adShown();
      rewind();
    });
  });
  function rewind() {
    const target = Math.max(0, state.turn - 2);
    let k = history.length - 1;
    while (k > 0 && !(history[k].turn === target && history[k].used === 0)) k--;
    state = history[k];
    history = history.slice(0, k);
    anim.escape = anim.fx = null;
    selectedCar = null;
    $('ov-result').hidden = true;
    updateHud();
    radio(`Rewound to the start of turn ${target + 1}. Try a different plan.`);
  }
  // Android back button (phone app): close the top panel; false = nothing open, let the app exit.
  window.MG_BACK = function () {
    if (!$('ov-ad').hidden) return true; // an ad finishes or is skipped by its own buttons
    if (!$('ov-buy').hidden) { $('buy-cancel').click(); return true; }
    if (!$('ov-backup').hidden) { $('backup-cancel').click(); return true; }
    if (!$('ov-cases').hidden) { $('ov-cases').hidden = true; return true; }
    if (selectedCar != null) { selectedCar = null; updateHud(); return true; }
    return false;
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('ov-backup').hidden) $('backup-cancel').click();
    else if (!$('ov-cases').hidden) $('ov-cases').hidden = true;
    else if (selectedCar != null) { selectedCar = null; updateHud(); }
  });

  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($('board'));
  else window.addEventListener('resize', resize);

  // ---------- boot (keeps the current case across live updates) ----------
  function start(data) {
    data = data || {};
    META.checkRank(closedCount()); // catch up players who started before ranks existed
    const startAt = typeof data.levelIndex === 'number' ? data.levelIndex : Math.min(progress.unlocked, LEVELS.length) - 1;
    const ok = data.state && data.state.crews && data.state.status === 'play';
    if (data.mode === 'daily' && dailyOpen()) loadDaily(ok ? { state: data.state, history: data.history || [] } : null);
    else loadLevel(startAt, ok && data.levelIndex === startAt && data.mode !== 'daily' ? { state: data.state, history: data.history || [] } : null);
    updateDots();
    requestAnimationFrame(frame);
  }
  try {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.snapshot) hot.snapshot(() => ({ levelIndex, state, history, mode }));
  } catch (e) { /* not in a viewer */ }

  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.ready) hot.ready(start);
    else start((hot && hot.data) || {});
  });
})();
