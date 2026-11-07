/*
 * City road layouts for v0.2. Each returns:
 *   { nodes:[[x,y]], edges:[[a,b]], parks:[[x,y,r]], river:[[x,y]]|null, exitCands:[{n,dx,dy}] }
 * Coordinates are in street-spacing units (about 1 between neighbouring corners), portrait.
 */
'use strict';

function shuffle(rng, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function connected(n, edges, skip) {
  const adj = Array.from({ length: n }, () => []);
  edges.forEach((e, i) => { if (i !== skip && e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); } });
  const seen = new Uint8Array(n); seen[0] = 1; const q = [0];
  for (let qi = 0; qi < q.length; qi++) for (const v of adj[q[qi]]) if (!seen[v]) { seen[v] = 1; q.push(v); }
  return q.length === n;
}

function degree(n, edges) {
  const d = new Array(n).fill(0);
  for (const e of edges) if (e) { d[e[0]]++; d[e[1]]++; }
  return d;
}

// Remove random streets while the town stays connected. Dead ends allowed up to maxDead.
function thin(rng, n, edges, rate, maxDead, protect) {
  const order = shuffle(rng, edges.map((_, i) => i));
  let removed = 0;
  const target = Math.round(edges.length * rate);
  for (const i of order) {
    if (removed >= target) break;
    if (protect && protect(edges[i])) continue;
    const saved = edges[i];
    edges[i] = null;
    const d = degree(n, edges);
    const dead = d.filter((x) => x === 1).length;
    if (d[saved[0]] === 0 || d[saved[1]] === 0 || dead > maxDead || !connected(n, edges)) { edges[i] = saved; continue; }
    removed++;
  }
  return edges.filter(Boolean);
}

// Drop unused grid slots and renumber.
function compact(slots, edges) {
  const map = new Map();
  const nodes = [];
  slots.forEach((p, i) => { if (p) { map.set(i, nodes.length); nodes.push(p); } });
  return { nodes, edges: edges.map(([a, b]) => [map.get(a), map.get(b)]), map };
}

function sideCands(nodes, W, H, gx, gy) {
  // Nodes on the outer ring of the original grid get an exit direction pointing off-map.
  const out = [];
  nodes.forEach((p, n) => {
    const [i, j] = [gx[n], gy[n]];
    if (j === 0) out.push({ n, dx: 0, dy: -1 });
    if (j === H - 1) out.push({ n, dx: 0, dy: 1 });
    if (i === 0) out.push({ n, dx: -1, dy: 0 });
    if (i === W - 1) out.push({ n, dx: 1, dy: 0 });
  });
  return out;
}

// Old Town: crooked jittered streets, missing corners (plazas), diagonal lanes, dead ends.
function oldTown(rng) {
  const W = 5, H = 7;
  const slot = (i, j) => j * W + i;
  const slots = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    slots.push([i + (rng() - 0.5) * 0.44, j + (rng() - 0.5) * 0.44]);
  }
  const parks = [];
  const holes = 2 + Math.floor(rng() * 2);
  for (let k = 0, tries = 0; k < holes && tries < 50; tries++) {
    const i = 1 + Math.floor(rng() * (W - 2)), j = 1 + Math.floor(rng() * (H - 2));
    const s = slot(i, j);
    if (!slots[s]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !slots[slot(i + a, j + b)])) continue;
    parks.push([i, j, 0.55]);
    slots[s] = null; k++;
  }
  let edges = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = slot(i, j);
    if (!slots[a]) continue;
    if (i + 1 < W && slots[slot(i + 1, j)]) edges.push([a, slot(i + 1, j)]);
    if (j + 1 < H && slots[slot(i, j + 1)]) edges.push([a, slot(i, j + 1)]);
  }
  // Diagonal lanes, at most one per block.
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    if (rng() > 0.2) continue;
    const c = [slot(i, j), slot(i + 1, j), slot(i, j + 1), slot(i + 1, j + 1)];
    if (c.some((s) => !slots[s])) continue;
    edges.push(rng() < 0.5 ? [c[0], c[3]] : [c[1], c[2]]);
  }
  const live = slots.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  const remap = new Map(live.map((s, k) => [s, k]));
  const nodes = live.map((s) => slots[s]);
  const gx = live.map((s) => s % W), gy = live.map((s) => Math.floor(s / W));
  edges = edges.map(([a, b]) => [remap.get(a), remap.get(b)]);
  edges = thin(rng, nodes.length, edges, 0.16, 3);
  return { nodes, edges, parks, river: null, exitCands: sideCands(nodes, W, H, gx, gy) };
}

// Ring Road: a hub, an inner ring, an outer ring, spokes between them. Exits leave from the outer ring.
function ringRoad(rng) {
  const cx = 2.1, cy = 3.1;
  const nodes = [[cx + (rng() - 0.5) * 0.2, cy + (rng() - 0.5) * 0.2]];
  const k1 = 6, k2 = 12;
  const off1 = rng() * Math.PI, off2 = rng() * Math.PI;
  const inner = [], outer = [];
  for (let k = 0; k < k1; k++) {
    const a = off1 + (k / k1) * Math.PI * 2;
    inner.push(nodes.length);
    nodes.push([cx + Math.cos(a) * 0.95, cy + Math.sin(a) * 1.25]);
  }
  for (let k = 0; k < k2; k++) {
    const a = off2 + (k / k2) * Math.PI * 2;
    outer.push(nodes.length);
    nodes.push([cx + Math.cos(a) * 1.85, cy + Math.sin(a) * 2.45]);
  }
  let edges = [];
  inner.forEach((n, k) => { edges.push([0, n]); edges.push([n, inner[(k + 1) % k1]]); });
  outer.forEach((n, k) => edges.push([n, outer[(k + 1) % k2]]));
  // Each inner corner links to the nearest outer corner by angle.
  const ang = (n) => Math.atan2((nodes[n][1] - cy) / 1.45, nodes[n][0] - cx);
  inner.forEach((n) => {
    let best = null, bd = Infinity;
    for (const m of outer) {
      let d = Math.abs(ang(n) - ang(m)); d = Math.min(d, Math.PI * 2 - d);
      if (d < bd) { bd = d; best = m; }
    }
    edges.push([n, best]);
  });
  const protect = (e) => false;
  edges = thin(rng, nodes.length, edges, 0.14, 2, protect);
  // Exits are highway ramps: a short spur road outside the ring (created only for chosen exits).
  const exitCands = outer.map((n) => {
    const dx = nodes[n][0] - cx, dy = nodes[n][1] - cy;
    const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); // snap to 8 directions
    const ux = +Math.cos(a).toFixed(3), uy = +Math.sin(a).toFixed(3);
    return { n, dx: ux, dy: uy, spur: [nodes[n][0] + ux * 0.8, nodes[n][1] + uy * 0.8] };
  });
  const parks = [];
  for (let k = 0; k < 2; k++) {
    const a = rng() * Math.PI * 2;
    parks.push([cx + Math.cos(a) * 1.4, cy + Math.sin(a) * 1.85, 0.28]);
  }
  return { nodes, edges, parks, river: null, exitCands };
}

// Riverside: two banks joined by a few bridges.
function riverside(rng) {
  const W = 5, H = 8, RIVER = 3; // river between rows 3 and 4
  const slot = (i, j) => j * W + i;
  const slots = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const jit = j === RIVER || j === RIVER + 1 ? 0.1 : 0.36;
    slots.push([i + (rng() - 0.5) * jit * 1.2, j + (rng() - 0.5) * jit + (j <= RIVER ? -0.12 : 0.12)]);
  }
  const bridgeCount = 2 + (rng() < 0.5 ? 1 : 0);
  const cols = shuffle(rng, [0, 1, 2, 3, 4]);
  const bridges = [];
  for (const c of cols) { if (bridges.length >= bridgeCount) break; if (bridges.every((b) => Math.abs(b - c) >= 2)) bridges.push(c); }
  let edges = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = slot(i, j);
    if (i + 1 < W) edges.push([a, slot(i + 1, j)]);
    if (j + 1 < H && (j !== RIVER || bridges.includes(i))) edges.push([a, slot(i, j + 1)]);
  }
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    if (j === RIVER || rng() > 0.12) continue;
    edges.push(rng() < 0.5 ? [slot(i, j), slot(i + 1, j + 1)] : [slot(i + 1, j), slot(i, j + 1)]);
  }
  const isBridge = (e) => {
    const [a, b] = e; const ja = Math.floor(a / W), jb = Math.floor(b / W);
    return Math.min(ja, jb) === RIVER && Math.max(ja, jb) === RIVER + 1;
  };
  edges = thin(rng, slots.length, edges, 0.13, 2, isBridge);
  const river = [];
  const phase = rng() * Math.PI * 2;
  for (let k = 0; k <= 24; k++) {
    const x = -0.9 + (k / 24) * (W - 1 + 1.8);
    river.push([+x.toFixed(3), +(RIVER + 0.5 + Math.sin(phase + x * 1.3) * 0.08).toFixed(3)]);
  }
  const gx = slots.map((_, s) => s % W), gy = slots.map((_, s) => Math.floor(s / W));
  return { nodes: slots, edges, parks: [], river, bridges, exitCands: sideCands(slots, W, H, gx, gy), riverRow: RIVER, W };
}

module.exports = { oldTown, ringRoad, riverside, shuffle };
