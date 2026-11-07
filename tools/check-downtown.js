#!/usr/bin/env node
// Regression check: every frozen Downtown case must still solve at its recorded par with the v2 engine.
'use strict';
const LEVELS = require('../src/levels-downtown.js');
const { solveExact } = require('./solver.js');

let bad = 0;
for (const lv of LEVELS) {
  const t = Date.now();
  const sol = solveExact(lv);
  const ok = sol && !sol.aborted && sol.par === lv.par;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} case ${String(lv.id).padStart(2)} ${lv.name.padEnd(16)} par ${lv.par} -> ${sol ? (sol.aborted ? 'aborted' : sol.par) : 'unsolvable'}  ${Date.now() - t}ms`);
}
process.exit(bad ? 1 : 0);
