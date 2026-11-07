#!/usr/bin/env node
/*
 * Builds src/levels-city.js (Cases 16+).
 *   node tools/generate-city.js            all cases
 *   node tools/generate-city.js 16 17      only these (others kept from the existing file)
 *
 * A case is kept only if:
 *   - every crew starts with a way out, far enough from the exits,
 *   - a lazy chief (greedy, one plan per turn) loses,
 *   - the beam-search chief wins (this sets par).
 * If a spec keeps coming out too easy, units are taken away (or an exit added); too hard, a roadblock is added.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const MG = require('../src/core.js');
const GEN = require('./mapgen.js');
const { solveBeam, solveGreedy } = require('./solver.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPECS = [
  // Old Town: careful crews, then planners
  { id: 16, name: 'Promotion Day', district: 'oldTown', exits: 3, units: { block: 4, heli: 1 }, cars: 1, rank: 2, parMin: 2, parMax: 6,
    hint: 'You are the Chief now! Same game, bigger city: you make one move, then they move. Patrol cars drive up to 2 corners. The CHOPPER is free: it shows where they are going.' },
  { id: 17, name: 'Crooked Lanes', district: 'oldTown', exits: 4, units: { block: 3, spike: 1, heli: 1 }, cars: 1, rank: 2, parMin: 2, parMax: 6,
    hint: 'New: SPIKES. A getaway car that drives over them gets stuck for a turn.' },
  { id: 18, name: 'Dead Ends', district: 'oldTown', exits: 4, units: { block: 3, spike: 2 }, cars: 2, rank: 2, parMin: 2, parMax: 6 },
  { id: 19, name: 'Detour', district: 'oldTown', exits: 4, units: { block: 3, traffic: 1, spike: 1, heli: 1 }, cars: 1, rank: 2, parMin: 2, parMax: 6,
    hint: 'New: TRAFFIC. Tap it, then tap a street to close that street for 2 turns.' },
  { id: 20, name: 'Market Square', district: 'oldTown', exits: 4, units: { block: 3, spike: 1, traffic: 1, heli: 1 }, cars: 2, rank: 3, parMin: 2, parMax: 7,
    hint: 'Smart robbers! They head for the exit with the most roads to it, not just the closest one.' },
  { id: 21, name: 'Back Alleys', district: 'oldTown', exits: 5, units: { block: 4, spike: 1, traffic: 1, heli: 1 }, cars: 1, rank: 3, parMin: 2, parMax: 7 },
  { id: 22, name: 'Old Town Lockdown', district: 'oldTown', exits: 5, units: { block: 4, spike: 2, traffic: 1, heli: 1 }, cars: 2, rank: 3, parMin: 3, parMax: 7 },
  // Ring Road: planners, masterminds, fast cars
  { id: 23, name: 'Ring Road', district: 'ringRoad', exits: 4, units: { block: 4, spike: 1, heli: 1 }, cars: 1, rank: 3, parMin: 2, parMax: 7,
    hint: 'Ring Road: robbers can drive round the ring to another exit. Block the roads in and out.' },
  { id: 24, name: 'Spokes', district: 'ringRoad', exits: 5, units: { block: 4, spike: 1, traffic: 1 }, cars: 2, rank: 3, parMin: 2, parMax: 7 },
  { id: 25, name: 'Mastermind', district: 'ringRoad', exits: 5, units: { block: 4, spike: 1, traffic: 1, heli: 1 }, cars: 1, rank: 4, parMin: 2, parMax: 7,
    hint: 'Master thieves! They dodge away from places you could trap them.' },
  { id: 26, name: 'Roundabout', district: 'ringRoad', exits: 5, units: { block: 4, spike: 2, traffic: 1, heli: 1 }, cars: 2, rank: 4, parMin: 3, parMax: 7 },
  { id: 27, name: 'Fast Lane', district: 'ringRoad', exits: 4, units: { block: 4, spike: 2, heli: 1 }, cars: 2, rank: 3, speed: 2, parMin: 2, parMax: 7,
    hint: 'Fast car! It drives 2 corners every turn. Spikes stop it.' },
  { id: 28, name: 'Outer Loop', district: 'ringRoad', exits: 5, units: { block: 5, spike: 2, traffic: 1, heli: 1 }, cars: 2, rank: 4, speed: 2, parMin: 2, parMax: 7 },
  { id: 29, name: 'Full Circle', district: 'ringRoad', exits: 5, units: { block: 5, spike: 2, traffic: 2, heli: 1 }, cars: 2, rank: 4, speed: 2, parMin: 3, parMax: 8 },
  // Riverside: split crews
  { id: 30, name: 'Split Up', district: 'riverside', exits: 4, units: { block: 4, spike: 1, heli: 1 }, cars: 2, rank: 2, crews: 2, parMin: 2, parMax: 7,
    hint: 'Riverside: TWO getaway cars! Catch both. Block the bridges.' },
  { id: 31, name: 'Bridges', district: 'riverside', exits: 4, units: { block: 4, spike: 2, traffic: 1, heli: 1 }, cars: 2, rank: 3, crews: 2, parMin: 2, parMax: 7 },
  { id: 32, name: 'Low Tide', district: 'riverside', exits: 5, units: { block: 5, spike: 2, traffic: 1, heli: 1 }, cars: 2, rank: 3, crews: 2, parMin: 3, parMax: 8 },
  { id: 33, name: 'Drawbridge', district: 'riverside', exits: 5, units: { block: 5, spike: 2, traffic: 2, heli: 1 }, cars: 2, rank: 4, crews: 2, parMin: 3, parMax: 8 },
  { id: 34, name: 'Riverside Run', district: 'riverside', exits: 5, units: { block: 5, spike: 2, traffic: 2, heli: 1 }, cars: 3, rank: 4, crews: 2, parMin: 3, parMax: 8 },
  { id: 35, name: 'Citywide Manhunt', district: 'riverside', exits: 6, units: { block: 6, spike: 2, traffic: 2, heli: 2 }, cars: 3, rank: 4, crews: 2, parMin: 3, parMax: 9,
    hint: 'Every unit in the city is yours, Chief. Two cars of master thieves, six exits. Catch them!' },
];

function hops(nodes, edges, from) {
  const adj = nodes.map(() => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const d = new Array(nodes.length).fill(Infinity);
  const q = [];
  for (const f of from) { d[f] = 0; q.push(f); }
  for (let qi = 0; qi < q.length; qi++) for (const v of adj[q[qi]]) if (d[v] === Infinity) { d[v] = d[q[qi]] + 1; q.push(v); }
  return { d, adj };
}

// Layout sizes, kept short enough to fill a phone screen.
// Riverside has 7 rows instead of 8. Ring Road is laid out at full size, then squeezed (see below).
const SIZE = { oldTown: { W: 5, H: 7 }, riverside: { W: 5, H: 7 } };
const RING_SQUEEZE = 0.86;

// Shrinks a Ring Road toward the top-left by k. Ramps keep their length and direction, so only
// the drawing gets bigger on screen: the street network, and so the puzzle, is unchanged.
function squeezeRing(lv, ringNodes, k) {
  const ramp = new Map();
  lv.exits.forEach(([n, dx, dy]) => { if (n >= ringNodes) ramp.set(n, [dx, dy]); });
  const gateOf = new Map();
  for (const [a, b] of lv.edges) { if (ramp.has(b)) gateOf.set(b, a); if (ramp.has(a)) gateOf.set(a, b); }
  const r3 = (v) => +v.toFixed(3);
  lv.nodes = lv.nodes.map(([x, y], n) => (n < ringNodes ? [r3(x * k), r3(y * k)] : [x, y]));
  for (const [n, [dx, dy]] of ramp) {
    const g = lv.nodes[gateOf.get(n)];
    lv.nodes[n] = [r3(g[0] + dx * 0.8), r3(g[1] + dy * 0.8)];
  }
  lv.parks = lv.parks.map(([x, y, r]) => [r3(x * k), r3(y * k), r3(r * k)]);
  return lv;
}

function makeLevel(rng, spec) {
  const m = GEN[spec.district](rng, SIZE[spec.district]);
  const nodes = m.nodes.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
  const edges = m.edges.slice();

  // Exits: spread out. Ring Road exits get a ramp node outside the ring.
  const cands = GEN.shuffle(rng, m.exitCands.slice());
  const exits = [];
  const used = new Set();
  for (const c of cands) {
    if (exits.length >= spec.exits) break;
    if (used.has(c.n)) continue;
    const p = c.spur || nodes[c.n];
    if (exits.some((e) => Math.hypot(nodes[e[0]][0] - p[0], nodes[e[0]][1] - p[1]) < 2.0)) continue;
    used.add(c.n);
    if (c.spur) {
      nodes.push([+c.spur[0].toFixed(3), +c.spur[1].toFixed(3)]);
      edges.push([c.n, nodes.length - 1]);
      exits.push([nodes.length - 1, c.dx, c.dy]);
    } else {
      exits.push([c.n, c.dx, c.dy]);
    }
  }
  if (exits.length < spec.exits) return null;
  if (spec.district === 'riverside') {
    const north = exits.filter((e) => nodes[e[0]][1] < m.riverRow + 0.5).length;
    if (north === 0 || north === exits.length) return null;
  }

  const gates = exits.map((e) => e[0]);
  // Crews need at least two turns of driving to reach an exit.
  const minDist = spec.minDist || (spec.speed >= 2 ? 4 : 3);
  const { d, adj } = hops(nodes, edges, gates);
  const pool = GEN.shuffle(rng, nodes.map((_, i) => i).filter((i) => d[i] >= minDist && !gates.includes(i)));
  if (!pool.length) return null;
  const starts = [pool[0]];
  if ((spec.crews || 1) > 1) {
    const near = hops(nodes, edges, [pool[0]]).d;
    const second = pool.find((i) => i !== pool[0] && near[i] >= 1 && near[i] <= 2);
    if (second == null) return null;
    starts.push(second);
  }
  const fromStarts = hops(nodes, edges, starts).d;
  const cars = [];
  for (const i of GEN.shuffle(rng, nodes.map((_, k) => k))) {
    if (cars.length >= spec.cars) break;
    if (gates.includes(i) || fromStarts[i] < 2) continue;
    if (cars.some((c) => hops(nodes, edges, [c]).d[i] < 2)) continue;
    cars.push(i);
  }
  if (cars.length < spec.cars) return null;

  const lv = {
    district: spec.district,
    nodes, edges, exits, starts, cars,
    units: Object.assign({ block: 0, spike: 0, traffic: 0, heli: 0 }, spec.units),
    orders: 1, carRange: 2, // one move per turn, like Downtown; patrol cars drive up to 2 corners
    crew: { rank: spec.rank, speed: spec.speed },
    river: m.river || null,
    parks: (m.parks || []).map((p) => p.map((v) => +v.toFixed(3))),
  };
  return spec.district === 'ringRoad' ? squeezeRing(lv, m.nodes.length, RING_SQUEEZE) : lv;
}

function check(level, spec) {
  const map = MG.buildMap(level);
  const s0 = MG.initialState(map, level);
  const probe = MG.applyOrder(map, s0, { t: 'heli' }).state; // runs the seal check without spending anything real
  if (probe.status !== 'play') return { ok: false, why: 'sealed at start' };
  const greedy = solveGreedy(level, { maxTurns: 10 });
  if (greedy && greedy.aborted) return { ok: false, why: 'greedy aborted' };
  if (greedy) return { ok: false, why: 'too easy' };
  if (spec.id >= 20) {
    // Later cases must also beat a chief who keeps three plans open.
    const medium = solveBeam(level, { width: 3, K: 8, maxTurns: 10, maxEvals: 60000 });
    if (medium && !medium.aborted) return { ok: false, why: 'medium wins' };
  }
  const beam = solveBeam(level, { width: 28, K: 9, maxTurns: 10, maxEvals: 160000 });
  if (!beam || beam.aborted) return { ok: false, why: beam ? 'beam aborted' : 'too hard' };
  if (beam.par < spec.parMin) return { ok: false, why: 'par low' };
  if (beam.par > spec.parMax) return { ok: false, why: 'par high' };
  return { ok: true, par: beam.par, line: beam.line };
}

// Called every 30 failed tries. One move per turn makes generous units easy, so when most tries
// come out too easy, take something away: roadblocks down to 2, then patrol cars, traffic and spikes
// down to 1, then the last roadblock; at the end, open another exit. Mostly too hard: add a roadblock.
function nudge(spec, why) {
  const easy = (why['too easy'] || 0) + (why['medium wins'] || 0) + (why['par low'] || 0), hard = why['too hard'] || 0;
  const u = spec.units;
  if (hard > easy * 2) { u.block++; return 'block+'; }
  if (easy <= hard * 2) return null;
  if (u.block > 2) { u.block--; return 'block-'; }
  if (spec.cars > 1) { spec.cars--; return 'cars-'; }
  if (u.traffic > 1) { u.traffic--; return 'traffic-'; }
  if (u.spike > 1) { u.spike--; return 'spike-'; }
  if (u.block > 1) { u.block--; return 'block-'; }
  if (spec.exits < (spec.district === 'ringRoad' ? 5 : 6)) { spec.exits++; return 'exits+'; } // a ring has room for 5 spread-out exits
  return null;
}

function main() {
  const only = process.argv.slice(2).map(Number).filter(Boolean);
  const outFile = path.join(__dirname, '..', 'src', 'levels-city.js');
  let existing = [];
  if (only.length && fs.existsSync(outFile)) { try { existing = require(outFile); } catch (e) { existing = []; } }
  const out = [];
  const t0 = Date.now();
  for (const base of SPECS) {
    if (only.length && !only.includes(base.id)) {
      const keep = existing.find((l) => l.id === base.id);
      if (keep) out.push(keep);
      continue;
    }
    const spec = JSON.parse(JSON.stringify(base));
    spec.units = Object.assign({ block: 0, spike: 0, traffic: 0, heli: 0 }, spec.units);
    spec.speed = spec.speed || 1; // one corner per turn; fast cars (Cases 27-29) drive 2
    let rng = mulberry32(20261107 + base.id * 104729);
    const ts = Date.now();
    let found = null, tries = 0;
    const why = {};
    while (!found && tries < 480) {
      if (tries === 240) rng = mulberry32(991003 + base.id * 7919); // second seed
      tries++;
      const lv = makeLevel(rng, spec);
      if (!lv) { why['no layout'] = (why['no layout'] || 0) + 1; continue; }
      const res = check(lv, spec);
      if (res.ok) { found = { lv, res }; break; }
      why[res.why] = (why[res.why] || 0) + 1;
      if (tries % 30 === 0) { const n = nudge(spec, why); if (n) why.nudged = (why.nudged ? why.nudged + ' ' : '') + n; }
    }
    if (!found) { console.log(`FAILED case ${base.id} ${base.name}: ${JSON.stringify(why)}`); continue; }
    const lv = Object.assign({ id: base.id, name: base.name }, base.hint ? { hint: base.hint } : {}, found.lv, { par: found.res.par });
    lv.units = Object.assign({}, spec.units);
    out.push(lv);
    const u = lv.units;
    console.log(`case ${base.id} ${base.name.padEnd(18)} par ${found.res.par}  blk ${u.block} spk ${u.spike} trf ${u.traffic}  cars ${lv.cars.length}  rank ${lv.crew.rank} spd ${lv.crew.speed} crews ${lv.starts.length}  tries ${tries}  ${((Date.now() - ts) / 1000).toFixed(1)}s  ${JSON.stringify(why)}`);
  }
  const body =
    '/* Cases 16+ (v0.2 city districts). Generated by tools/generate-city.js. Do not edit by hand. */\n' +
    '(function (root) {\n' +
    '  const LEVELS = [\n' + out.map((l) => '    ' + JSON.stringify(l)).join(',\n') + '\n  ];\n' +
    "  if (typeof module === 'object' && module.exports) module.exports = LEVELS;\n" +
    '  else root.MG_LEVELS_CITY = LEVELS;\n' +
    "})(typeof self !== 'undefined' ? self : this);\n";
  fs.writeFileSync(outFile, body);
  console.log(`\nWrote ${out.length} city cases in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

if (require.main === module) main();
module.exports = { SPECS, makeLevel, check, nudge, mulberry32 };
