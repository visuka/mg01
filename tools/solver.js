/*
 * Level solvers for the generator.
 *   solveExact(level)  breadth-first over every order. Exact fewest turns; fine for 1-order Downtown cases.
 *   solveBeam(level)   beam search over whole turns (up to 3 orders each) using a pruned set of sensible
 *                      orders. Finding a win proves the case is winnable; par = turns used.
 *   solveGreedy(level) the same with a beam of 1: a "lazy chief". Good cases should defeat it.
 */
'use strict';
const MG = require('../src/core.js');

// Police turns spent: a win in the middle of a turn counts that turn.
const turnsUsed = (s) => s.turn + (s.used > 0 ? 1 : 0);

function solveExact(level, opts) {
  opts = opts || {};
  const map = MG.buildMap(level);
  const start = MG.initialState(map, level, opts);
  const maxTurns = opts.maxTurns || 14;
  const maxStates = opts.maxStates || 600000;
  const seen = new Set([MG.stateKey(start)]);
  let frontier = [{ s: start, parent: null, a: null }];
  for (let depth = 1; depth <= maxTurns * map.cfg.orders && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const a of MG.legalOrders(map, node.s, opts)) {
        const r = MG.step(map, node.s, a);
        if (r.state.status === 'won') {
          const line = [a];
          for (let p = node; p && p.a; p = p.parent) line.unshift(p.a);
          return { par: turnsUsed(r.state), line };
        }
        if (r.state.status === 'lost') continue;
        const k = MG.stateKey(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        if (seen.size > maxStates) return { aborted: true };
        next.push({ s: r.state, parent: node, a });
      }
    }
    frontier = next;
  }
  return null;
}

// --------------------------------------------------------------- beam
function heuristic(map, s) {
  if (s.status === 'won') return -1e6;
  if (s.status === 'lost') return 1e6;
  const cs = MG.closedSet(s);
  let h = 0;
  s.crews.forEach((c, ci) => {
    if (c.status === 'caught') { h -= 60; return; }
    if (c.status !== 'run') return;
    const seal = MG.routeCount(map, s, ci, cs, c.n, null, 6);
    const d = MG.stepsToExit(map, s, ci, cs)[c.n];
    h += 12 * seal - 2.5 * Math.min(d, 7) / map.cfg.speed - (c.stun ? 3 : 0);
  });
  h -= 1.2 * s.stock.block + 0.6 * s.stock.spike + 0.8 * s.stock.traffic;
  return h;
}

// Min-cut intersections between a crew and the exits (good roadblock spots).
function cutNodes(map, s, ci) {
  // Reuse routeCount semantics with a small dedicated max-flow that returns the cut.
  const cs = MG.closedSet(s);
  const src = s.crews[ci].n;
  const N = map.N, E = map.E, V = 2 * (N + E) + 1, T = V - 1, BIG = 1e9;
  const head = new Int32Array(V).fill(-1), to = [], cap = [], nxt = [];
  const add = (u, v, c) => { to.push(v); cap.push(c); nxt.push(head[u]); head[u] = to.length - 1; to.push(u); cap.push(0); nxt.push(head[v]); head[v] = to.length - 1; };
  const blocked = (v) => v < N && v !== src && (s.blocks.includes(v) || s.cars.includes(v) || s.crews.some((c, j) => j !== ci && c.status !== 'escaped' && c.n === v));
  for (let v = 0; v < N + E; v++) if (!blocked(v)) add(2 * v, 2 * v + 1, v === src || v >= N ? BIG : 1);
  for (let u = 0; u < N; u++) {
    if (blocked(u)) continue;
    for (const v of map.adj[u]) {
      if (blocked(v)) continue;
      if (v < N && cs.has(map.edgeIndex.get(MG.ekey(u, v)))) continue;
      add(2 * u + 1, 2 * v, BIG);
    }
  }
  for (let i = 0; i < E; i++) add(2 * (N + i) + 1, T, BIG);
  const S = 2 * src;
  const prevE = new Int32Array(V);
  let flow = 0;
  for (;;) {
    prevE.fill(-1);
    const q = [S]; let found = false;
    for (let qi = 0; qi < q.length && !found; qi++) {
      const u = q[qi];
      for (let e = head[u]; e !== -1; e = nxt[e]) {
        const v = to[e];
        if (cap[e] <= 0 || v === S || prevE[v] !== -1) continue;
        prevE[v] = e; if (v === T) { found = true; break; } q.push(v);
      }
    }
    if (!found) break;
    let b = BIG;
    for (let v = T; v !== S; v = to[prevE[v] ^ 1]) b = Math.min(b, cap[prevE[v]]);
    if (b >= BIG || flow > 8) return [];
    for (let v = T; v !== S; v = to[prevE[v] ^ 1]) { cap[prevE[v]] -= 1; cap[prevE[v] ^ 1] += 1; }
    flow++;
  }
  // Nodes reachable from S in the residual graph.
  const reach = new Uint8Array(V); reach[S] = 1;
  const q = [S];
  for (let qi = 0; qi < q.length; qi++) {
    const u = q[qi];
    for (let e = head[u]; e !== -1; e = nxt[e]) if (cap[e] > 0 && !reach[to[e]]) { reach[to[e]] = 1; q.push(to[e]); }
  }
  const cut = [];
  for (let v = 0; v < N; v++) if (reach[2 * v] && !reach[2 * v + 1]) cut.push(v);
  return cut;
}

function candidates(map, s, K) {
  const scored = new Map();
  const bump = (key, act, w) => { const o = scored.get(key); if (!o || o.w < w) scored.set(key, { act, w }); };
  const cs = MG.closedSet(s);
  s.crews.forEach((c, ci) => {
    if (c.status !== 'run') return;
    const route = MG.crewRoute(map, s, ci, 8);
    const cut = cutNodes(map, s, ci);
    const onRoute = route.filter((n) => n < map.N);
    for (const n of cut) {
      if (MG.canPlace(map, s, 'block', n)) bump('b' + n, { t: 'block', n }, 10 - Math.min(5, onRoute.indexOf(n) < 0 ? 4 : onRoute.indexOf(n)));
    }
    onRoute.slice(0, 5).forEach((n, k) => {
      if (MG.canPlace(map, s, 'block', n)) bump('b' + n, { t: 'block', n }, 7 - k);
      if (MG.canPlace(map, s, 'spike', n) && k < 2) bump('s' + n, { t: 'spike', n }, 6.5 - k);
    });
    // Gates of the nearest exits are classic fallback roadblock spots.
    for (const g of map.gates) if (MG.canPlace(map, s, 'block', g)) bump('b' + g, { t: 'block', n: g }, 3);
    if (s.stock.traffic > 0) {
      let prev = c.n;
      route.slice(0, 3).forEach((n, k) => {
        if (n < map.N) {
          const e = map.edgeIndex.get(MG.ekey(prev, n));
          if (e != null && MG.canClose(map, s, e)) bump('t' + e, { t: 'traffic', e }, 6 - k);
        }
        prev = n;
      });
    }
    // Patrol cars: arrests, cut nodes, route nodes, or the reachable corner nearest the route.
    s.cars.forEach((car, i) => {
      const targets = MG.carTargets(map, s, i, cs);
      let any = false;
      for (const n of targets) {
        if (n === c.n) { bump('m' + i + ':' + n, { t: 'move', i, n }, 20); any = true; }
        else if (cut.includes(n)) { bump('m' + i + ':' + n, { t: 'move', i, n }, 9); any = true; }
        else if (onRoute.includes(n)) { bump('m' + i + ':' + n, { t: 'move', i, n }, 8 - onRoute.indexOf(n) * 0.5); any = true; }
      }
      if (!any && targets.length) {
        const goal = map.pos[onRoute[Math.min(2, onRoute.length - 1)] != null ? onRoute[Math.min(2, onRoute.length - 1)] : c.n];
        let best = null, bd = Infinity;
        for (const n of targets) { const d = Math.hypot(map.pos[n][0] - goal[0], map.pos[n][1] - goal[1]); if (d < bd) { bd = d; best = n; } }
        bump('m' + i + ':' + best, { t: 'move', i, n: best }, 4);
      }
    });
  });
  return [...scored.values()].sort((a, b) => b.w - a.w).slice(0, K).map((o) => o.act);
}

function combos(list, maxSize) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length) out.push(cur.slice());
    if (cur.length === maxSize) return;
    for (let i = start; i < list.length; i++) {
      const a = list[i];
      if (a.t === 'move' && cur.some((b) => b.t === 'move' && b.i === a.i)) continue;
      cur.push(a); rec(i + 1, cur); cur.pop();
    }
  };
  rec(0, []);
  return out;
}

function playTurn(map, s, orders) {
  let t = s;
  for (const a of orders) {
    if (a.t === 'block' || a.t === 'spike') { if (!MG.canPlace(map, t, a.t, a.n)) return null; }
    else if (a.t === 'traffic') { if (!MG.canClose(map, t, a.e)) return null; }
    else if (a.t === 'move') { if (!MG.canMove(map, t, a.i, a.n)) return null; }
    t = MG.applyOrder(map, t, a).state;
    if (t.status !== 'play') return t;
  }
  return MG.dispatch(map, t).state;
}

function solveBeam(level, opts) {
  opts = opts || {};
  const width = opts.width || 24, K = opts.K || 9, maxTurns = opts.maxTurns || 9;
  const map = MG.buildMap(level);
  const s0 = MG.initialState(map, level, opts);
  let layer = [{ s: s0, line: [] }];
  const budget = { evals: 0, max: opts.maxEvals || 250000 };
  for (let turn = 1; turn <= maxTurns; turn++) {
    const next = new Map();
    for (const node of layer) {
      const cands = candidates(map, node.s, K);
      const list = combos(cands, map.cfg.orders);
      list.push([]); // hold position
      for (const orders of list) {
        if (++budget.evals > budget.max) return { aborted: true };
        const t = playTurn(map, node.s, orders);
        if (!t) continue;
        if (t.status === 'won') return { par: turn, line: node.line.concat([orders]) };
        if (t.status === 'lost') continue;
        const key = MG.stateKey(t);
        if (next.has(key)) continue;
        next.set(key, { s: t, line: node.line.concat([orders]), h: heuristic(map, t) });
      }
    }
    if (!next.size) return null;
    layer = [...next.values()].sort((a, b) => a.h - b.h).slice(0, width);
  }
  return null;
}

const solveGreedy = (level, opts) => solveBeam(level, Object.assign({}, opts, { width: 1, K: 7 }));

module.exports = { solveExact, solveBeam, solveGreedy, heuristic, candidates };
