/*
 * mg01 rules engine v2. Pure logic, no DOM.
 * Shared by the game (window.MG) and the level tools (Node).
 *
 * Two map formats:
 *   Grid (Downtown):  { w, h, cut:[[x1,y1,x2,y2]], exits:[[x,y,dir]], bank:[x,y], blocks, cars:[[x,y]] }
 *   City (v0.2):      { nodes:[[x,y]], edges:[[a,b]], exits:[[node,dx,dy]], starts:[node,...],
 *                       units:{block,spike,traffic,heli}, cars:[node], orders, carRange,
 *                       crew:{rank,speed}, river:[[x,y]], parks:[[x,y,r]] }
 *
 * A turn: the police give up to `orders` orders, then the crews move (dispatch).
 * Crew ranks: 1 rookies, 2 careful, 3 planners, 4 masterminds.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MG = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
  const ekey = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
  const INF = 1e9;

  // ---------------------------------------------------------------- map
  function buildMap(level) {
    let pos, adj, gates, exitDirs, N, grid = null, idx = null;
    if (level.nodes) {
      pos = level.nodes.map((p) => [p[0], p[1]]);
      N = pos.length;
      adj = pos.map(() => []);
      for (const [a, b] of level.edges) { adj[a].push(b); adj[b].push(a); }
      gates = level.exits.map((e) => e[0]);
      exitDirs = level.exits.map((e) => { const l = Math.hypot(e[1], e[2]) || 1; return [e[1] / l, e[2] / l]; });
      level.exits.forEach((e, i) => adj[e[0]].push(N + i));
    } else {
      const { w, h } = level;
      N = w * h;
      grid = { w, h };
      idx = (x, y) => y * w + x;
      const cut = new Set((level.cut || []).map(([x1, y1, x2, y2]) => ekey(idx(x1, y1), idx(x2, y2))));
      const exitAt = new Map();
      level.exits.forEach(([x, y, d], i) => exitAt.set(idx(x, y) + ':' + d, N + i));
      pos = []; adj = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const n = idx(x, y);
          pos.push([x, y]);
          const list = [];
          for (let d = 0; d < 4; d++) {
            const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
              const m = idx(nx, ny);
              if (!cut.has(ekey(n, m))) list.push(m);
            } else if (exitAt.has(n + ':' + d)) {
              list.push(exitAt.get(n + ':' + d));
            }
          }
          adj.push(list);
        }
      }
      gates = level.exits.map(([x, y]) => idx(x, y));
      exitDirs = level.exits.map((e) => DIRS[e[2]].slice());
    }
    const E = gates.length;
    for (let i = 0; i < E; i++) adj.push([gates[i]]);
    const edges = [];
    for (let a = 0; a < N; a++) for (const b of adj[a]) if (b < N && a < b) edges.push([a, b]);
    const edgeIndex = new Map(edges.map(([a, b], i) => [ekey(a, b), i]));
    const crew = level.crew || {};
    return {
      N, E, pos, adj, gates, exitDirs, edges, edgeIndex, grid, idx,
      cfg: {
        orders: level.orders || 1,
        carRange: level.carRange || 1,
        rank: crew.rank || 1,
        speed: crew.speed || 1,
        keepAway: !!level.keepAway, // roadblocks need a corner between them and the crew
      },
    };
  }

  const nodeOf = (map, p) => (Array.isArray(p) ? map.idx(p[0], p[1]) : p);

  function initialState(map, level, opts) {
    const starts = level.starts || [nodeOf(map, level.bank)];
    const stock = Object.assign({ block: level.blocks || 0, spike: 0, traffic: 0, heli: 0 }, level.units || {});
    if (opts && opts.stock) Object.assign(stock, opts.stock);
    const cars = (level.cars || []).map((c) => nodeOf(map, c));
    return {
      crews: starts.map((n) => ({ n, status: 'run', stun: 0, heading: null })),
      blocks: [], spikes: [], closed: [],
      cars, carHeading: cars.map(() => -Math.PI / 2), moved: [],
      stock, used: 0, turn: 0,
      status: 'play', how: null, reveal: false,
    };
  }

  function clone(s) {
    return {
      crews: s.crews.map((c) => ({ n: c.n, status: c.status, stun: c.stun, heading: c.heading })),
      blocks: s.blocks.slice(), spikes: s.spikes.slice(), closed: s.closed.map((c) => ({ e: c.e, t: c.t })),
      cars: s.cars.slice(), carHeading: s.carHeading.slice(), moved: s.moved.slice(),
      stock: Object.assign({}, s.stock), used: s.used, turn: s.turn,
      status: s.status, how: s.how, reveal: s.reveal,
    };
  }

  function angleBetween(map, a, b) {
    if (b >= map.N) { const d = map.exitDirs[b - map.N]; return Math.atan2(d[1], d[0]); }
    const [ax, ay] = map.pos[a], [bx, by] = map.pos[b];
    return Math.atan2(by - ay, bx - ax);
  }

  // ---------------------------------------------------------- obstacles
  function crewAt(s, n) {
    for (let j = 0; j < s.crews.length; j++) if (s.crews[j].status !== 'escaped' && s.crews[j].n === n) return j;
    return -1;
  }
  // Can crew `ci` drive through node n?
  function blockedFor(map, s, n, ci) {
    if (n >= map.N) return false;
    if (s.blocks.includes(n) || s.cars.includes(n)) return true;
    for (let j = 0; j < s.crews.length; j++) {
      if (j !== ci && s.crews[j].status !== 'escaped' && s.crews[j].n === n) return true;
    }
    return false;
  }
  const closedSet = (s) => new Set(s.closed.map((c) => c.e));
  function edgeShut(map, cs, a, b) {
    if (a >= map.N || b >= map.N || !cs.size) return false;
    return cs.has(map.edgeIndex.get(ekey(a, b)));
  }
  function freeForPolice(map, s, n) {
    return n < map.N && !s.blocks.includes(n) && !s.cars.includes(n) && !s.spikes.includes(n) && crewAt(s, n) < 0;
  }

  // Nodes any patrol car could reach with one order (the arrest zone).
  function threatZone(map, s) {
    const zone = new Set();
    const cs = closedSet(s);
    s.cars.forEach((c, i) => { for (const n of carTargets(map, s, i, cs)) zone.add(n); });
    return zone;
  }

  // Where patrol car i can go with one order: up to carRange corners through open streets.
  function carTargets(map, s, i, cs) {
    cs = cs || closedSet(s);
    const start = s.cars[i];
    const seen = new Map([[start, 0]]);
    const out = [];
    const q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi], d = seen.get(u);
      if (d >= map.cfg.carRange) continue;
      for (const v of map.adj[u]) {
        if (v >= map.N || seen.has(v) || edgeShut(map, cs, u, v)) continue;
        if (s.blocks.includes(v) || s.cars.includes(v)) continue;
        const crew = crewAt(s, v);
        if (crew >= 0) {
          if (s.crews[crew].status === 'run') { seen.set(v, d + 1); out.push(v); } // arrest, but no driving through
          continue;
        }
        seen.set(v, d + 1);
        out.push(v);
        q.push(v);
      }
    }
    return out;
  }

  function carPath(map, s, i, target) {
    const cs = closedSet(s);
    const start = s.cars[i];
    const prev = new Map([[start, -1]]);
    const q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi];
      if (u === target) break;
      for (const v of map.adj[u]) {
        if (v >= map.N || prev.has(v) || edgeShut(map, cs, u, v)) continue;
        if (s.blocks.includes(v) || s.cars.includes(v)) continue;
        if (crewAt(s, v) >= 0 && v !== target) continue;
        prev.set(v, u);
        q.push(v);
      }
    }
    const path = [];
    for (let n = target; n !== -1 && n !== undefined; n = prev.get(n)) path.unshift(n);
    return path;
  }

  // ------------------------------------------------------- pathfinding
  // Step counts to the nearest exit (rookie view).
  function stepsToExit(map, s, ci, cs, only) {
    const dist = new Array(map.N + map.E).fill(Infinity);
    const q = [];
    for (let i = 0; i < map.E; i++) if (only == null || only === i) { dist[map.N + i] = 0; q.push(map.N + i); }
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi];
      for (const v of map.adj[u]) {
        if (dist[v] !== Infinity) continue;
        if (v < map.N && blockedFor(map, s, v, ci)) continue;
        if (edgeShut(map, cs, u, v)) continue;
        dist[v] = dist[u] + 1;
        q.push(v);
      }
    }
    return dist;
  }

  // Weighted cost to an exit: careful crews pay extra to pass patrol cars and spikes.
  function costToExit(map, s, ci, cs, enter, only) {
    const T = map.N + map.E;
    const dist = new Array(T).fill(Infinity);
    const done = new Uint8Array(T);
    for (let i = 0; i < map.E; i++) if (only == null || only === i) dist[map.N + i] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let k = 0; k < T; k++) if (!done[k] && dist[k] < best) { best = dist[k]; u = k; }
      if (u < 0) break;
      done[u] = 1;
      const stepIn = u >= map.N ? 1 : enter[u];
      for (const v of map.adj[u]) {
        if (done[v] || v >= map.N) continue;
        if (blockedFor(map, s, v, ci)) continue;
        if (edgeShut(map, cs, u, v)) continue;
        const nd = dist[u] + stepIn;
        if (nd < dist[v]) dist[v] = nd;
      }
    }
    return dist;
  }

  function enterCosts(map, s) {
    const zone = threatZone(map, s);
    const c = new Array(map.N).fill(1);
    for (let n = 0; n < map.N; n++) {
      if (zone.has(n)) c[n] += 3;
      if (s.spikes.includes(n)) c[n] += 4;
    }
    return c;
  }

  // How many separate escape routes start at `src` (vertex-disjoint paths), capped at `limit`.
  // Equivalently: how many intersections the police must block to seal it in.
  function routeCount(map, s, ci, cs, src, only, limit) {
    const V = 2 * (map.N + map.E) + 1, T = V - 1;
    const head = new Int32Array(V).fill(-1);
    const to = [], cap = [], nxt = [];
    const add = (u, v, c) => {
      to.push(v); cap.push(c); nxt.push(head[u]); head[u] = to.length - 1;
      to.push(u); cap.push(0); nxt.push(head[v]); head[v] = to.length - 1;
    };
    const open = (v) => v >= map.N || v === src || !blockedFor(map, s, v, ci);
    for (let v = 0; v < map.N + map.E; v++) {
      if (!open(v)) continue;
      add(2 * v, 2 * v + 1, v === src || v >= map.N ? INF : 1);
    }
    for (let u = 0; u < map.N; u++) {
      if (!open(u)) continue;
      for (const v of map.adj[u]) {
        if (!open(v) || edgeShut(map, cs, u, v)) continue;
        add(2 * u + 1, 2 * v, INF);
      }
    }
    for (let i = 0; i < map.E; i++) if (only == null || only === i) add(2 * (map.N + i) + 1, T, INF);
    let flow = 0;
    const prevE = new Int32Array(V);
    const S = 2 * src;
    while (flow < limit) {
      prevE.fill(-1);
      const q = [S];
      let found = false;
      for (let qi = 0; qi < q.length && !found; qi++) {
        const u = q[qi];
        for (let e = head[u]; e !== -1; e = nxt[e]) {
          const v = to[e];
          if (cap[e] <= 0 || v === S || prevE[v] !== -1) continue;
          prevE[v] = e;
          if (v === T) { found = true; break; }
          q.push(v);
        }
      }
      if (!found) break;
      let bottleneck = INF;
      for (let v = T; v !== S; v = to[prevE[v] ^ 1]) bottleneck = Math.min(bottleneck, cap[prevE[v]]);
      if (bottleneck >= INF) return limit; // touching an exit: cannot be sealed by roadblocks
      for (let v = T; v !== S; v = to[prevE[v] ^ 1]) { cap[prevE[v]] -= 1; cap[prevE[v] ^ 1] += 1; }
      flow += 1;
    }
    return flow;
  }

  // The crew's chosen exit: short, and with backup routes (planners and up).
  function planExit(map, s, ci, cs, enter, from) {
    let best = null;
    for (let i = 0; i < map.E; i++) {
      const d = costToExit(map, s, ci, cs, enter, i)[from];
      if (!isFinite(d)) continue;
      const k = routeCount(map, s, ci, cs, from, i, 3);
      const score = d - 2 * k;
      if (!best || score < best.score - 1e-9) best = { exit: i, score };
    }
    return best;
  }

  function policeCapacity(map, s) {
    return Math.min(map.cfg.orders, s.stock.block + s.stock.traffic + s.cars.length);
  }

  // ----------------------------------------------------- crew brains
  // Next corner for crew ci, or null when every route out is sealed.
  function crewNext(map, s, ci) {
    const r = s.crews[ci].n;
    const cs = closedSet(s);
    const rank = map.cfg.rank;
    const options = [];
    for (const v of map.adj[r]) {
      if (v < map.N && blockedFor(map, s, v, ci)) continue;
      if (edgeShut(map, cs, r, v)) continue;
      options.push(v);
    }
    if (!options.length) return null;

    if (rank <= 1) {
      const dist = stepsToExit(map, s, ci, cs);
      if (dist[r] === Infinity) return null;
      for (const v of options) if (dist[v] === dist[r] - 1) return v;
      return null;
    }

    for (const v of options) if (v >= map.N) return v; // an open exit right here: take it

    const enter = enterCosts(map, s);
    const all = costToExit(map, s, ci, cs, enter);
    if (!isFinite(all[r])) return null;
    const reach = options.filter((v) => isFinite(all[v]));
    if (!reach.length) return null;

    if (rank === 2) {
      let best = null, bv = Infinity;
      for (const v of reach) { const c = enter[v] + all[v]; if (c < bv - 1e-9) { bv = c; best = v; } }
      return best;
    }

    if (rank === 3) {
      const plan = planExit(map, s, ci, cs, enter, r);
      if (!plan) return null;
      const dist = costToExit(map, s, ci, cs, enter, plan.exit);
      let best = null, bv = Infinity;
      for (const v of reach) { const c = enter[v] + dist[v]; if (c < bv - 1e-9) { bv = c; best = v; } }
      return best != null ? best : reach[0];
    }

    // Masterminds: avoid corners the police could seal or reach next turn with what they have left.
    const capLeft = policeCapacity(map, s);
    const zone = threatZone(map, s);
    let best = null, bk = null;
    for (const v of reach) {
      const moved = clone(s); moved.crews[ci].n = v;
      const seal = routeCount(map, moved, ci, cs, v, null, capLeft + 1);
      const safe = seal > capLeft && !zone.has(v);
      const plan = planExit(map, moved, ci, cs, enter, v);
      const key = [safe ? 0 : 1, safe ? 0 : -seal, (plan ? plan.score : 99) + enter[v]];
      if (!bk || key[0] < bk[0] || (key[0] === bk[0] && (key[1] < bk[1] || (key[1] === bk[1] && key[2] < bk[2] - 1e-9)))) {
        bk = key; best = v;
      }
    }
    return best;
  }

  // The full route a crew intends to drive if nothing changes (shown by the helicopter).
  function crewRoute(map, s, ci, maxLen) {
    const route = [];
    let t = clone(s);
    for (let k = 0; k < (maxLen || map.N + 2); k++) {
      const n = crewNext(map, t, ci);
      if (n == null) break;
      route.push(n);
      if (n >= map.N) break;
      t.crews[ci].n = n;
    }
    return route;
  }

  // ------------------------------------------------------------ rules
  function sealCheck(map, s) {
    const cs = closedSet(s);
    s.crews.forEach((c, ci) => {
      if (c.status !== 'run') return;
      const dist = stepsToExit(map, s, ci, cs);
      if (dist[c.n] === Infinity) c.status = 'caught';
    });
  }

  function resolve(s, how) {
    if (s.crews.some((c) => c.status === 'escaped')) { s.status = 'lost'; s.how = 'escaped'; }
    else if (s.crews.every((c) => c.status === 'caught')) { s.status = 'won'; s.how = how; }
  }

  // Too close to set up a roadblock: next to a running crew.
  function tooClose(map, s, n) {
    if (!map.cfg.keepAway) return false;
    return s.crews.some((c) => c.status === 'run' && map.adj[c.n].includes(n));
  }
  function canPlace(map, s, kind, n) {
    if (s.status !== 'play' || s.used >= map.cfg.orders) return false;
    if (kind === 'block') return s.stock.block > 0 && freeForPolice(map, s, n) && !tooClose(map, s, n);
    if (kind === 'spike') return s.stock.spike > 0 && freeForPolice(map, s, n);
    return false;
  }
  function canClose(map, s, e) {
    if (!(s.status === 'play' && s.used < map.cfg.orders && s.stock.traffic > 0 && e >= 0 && e < map.edges.length)) return false;
    if (s.closed.some((c) => c.e === e)) return false;
    const [a, b] = map.edges[e];
    if (map.cfg.keepAway && s.crews.some((c) => c.status === 'run' && (c.n === a || c.n === b))) return false;
    return true;
  }
  function canMove(map, s, i, n) {
    return s.status === 'play' && s.used < map.cfg.orders && !s.moved.includes(i) && carTargets(map, s, i).includes(n);
  }

  // One police order. Crews do not move here.
  function applyOrder(map, s0, act) {
    const s = clone(s0);
    const ev = { act };
    let how = 'sealed';
    if (act.t === 'block') { s.blocks.push(act.n); s.stock.block--; s.used++; }
    else if (act.t === 'spike') { s.spikes.push(act.n); s.stock.spike--; s.used++; }
    else if (act.t === 'traffic') { s.closed.push({ e: act.e, t: 2 }); s.stock.traffic--; s.used++; }
    else if (act.t === 'heli') { s.stock.heli--; s.reveal = true; }
    else if (act.t === 'move') {
      const path = carPath(map, s0, act.i, act.n);
      ev.carPath = path;
      if (path.length >= 2) s.carHeading[act.i] = angleBetween(map, path[path.length - 2], path[path.length - 1]);
      s.cars[act.i] = act.n;
      s.moved.push(act.i);
      s.used++;
      const hit = s.crews.findIndex((c) => c.status === 'run' && c.n === act.n);
      if (hit >= 0) { s.crews[hit].status = 'caught'; ev.arrest = hit; how = 'arrest'; }
    }
    sealCheck(map, s);
    resolve(s, how);
    return { state: s, events: ev };
  }

  // End of the police turn: every crew drives.
  function dispatch(map, s0) {
    const s = clone(s0);
    s.used = 0; s.turn++; s.reveal = false; s.moved = [];
    const moves = [];
    s.crews.forEach((c, ci) => {
      if (c.status !== 'run') return;
      const path = [c.n];
      if (c.stun > 0) { c.stun--; moves.push({ ci, path, stunned: true }); return; }
      for (let k = 0; k < map.cfg.speed; k++) {
        const nxt = crewNext(map, s, ci);
        if (nxt == null) { c.status = 'caught'; break; }
        c.heading = angleBetween(map, c.n, nxt);
        c.n = nxt;
        path.push(nxt);
        if (nxt >= map.N) { c.status = 'escaped'; break; }
        const sp = s.spikes.indexOf(nxt);
        if (sp >= 0) { s.spikes.splice(sp, 1); c.stun = 1; break; }
      }
      moves.push({ ci, path, spiked: c.stun > 0 });
    });
    s.closed = s.closed.map((c) => ({ e: c.e, t: c.t - 1 })).filter((c) => c.t > 0);
    sealCheck(map, s);
    resolve(s, 'sealed');
    return { state: s, events: { moves } };
  }

  // An order, plus the crews' reply if it used the last order of the turn.
  function step(map, s, act) {
    if (act.t === 'dispatch' || act.t === 'wait') {
      const d = dispatch(map, s);
      return { state: d.state, events: { act, moves: d.events.moves } };
    }
    const r = applyOrder(map, s, act);
    if (r.state.status === 'play' && act.t !== 'heli' && r.state.used >= map.cfg.orders) {
      const d = dispatch(map, r.state);
      return { state: d.state, events: Object.assign(r.events, { moves: d.events.moves }) };
    }
    return r;
  }

  // Every order the police could give right now (used by the solvers).
  function legalOrders(map, s, opts) {
    const acts = [];
    if (s.status !== 'play') return acts;
    if (s.used < map.cfg.orders) {
      for (let n = 0; n < map.N; n++) {
        if (canPlace(map, s, 'block', n)) acts.push({ t: 'block', n });
        if (canPlace(map, s, 'spike', n)) acts.push({ t: 'spike', n });
      }
      if (s.stock.traffic > 0) map.edges.forEach((_, e) => { if (canClose(map, s, e)) acts.push({ t: 'traffic', e }); });
      if (!(opts && opts.freezeCars)) {
        const cs = closedSet(s);
        s.cars.forEach((_, i) => { if (!s.moved.includes(i)) for (const n of carTargets(map, s, i, cs)) acts.push({ t: 'move', i, n }); });
      }
    }
    if (!acts.length || (opts && opts.allowDispatch && s.used > 0)) acts.push({ t: 'dispatch' });
    return acts;
  }

  function stateKey(s) {
    const srt = (a) => a.slice().sort((x, y) => x - y).join(',');
    return s.crews.map((c) => c.n + c.status[0] + c.stun).join(';') + '|' + srt(s.blocks) + '|' + srt(s.spikes) + '|' +
      s.closed.map((c) => c.e + ':' + c.t).sort().join(',') + '|' + s.cars.join(',') + '/' + srt(s.moved) + '|' +
      s.stock.block + s.stock.spike + s.stock.traffic + '|' + s.used;
  }

  return {
    DIRS, ekey, buildMap, initialState, clone, angleBetween,
    crewAt, carTargets, carPath, threatZone, stepsToExit, routeCount, closedSet, freeForPolice, tooClose,
    crewNext, crewRoute, policeCapacity,
    canPlace, canClose, canMove, applyOrder, dispatch, step, legalOrders, stateKey,
  };
});
