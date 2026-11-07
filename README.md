# mg01: Getaway Gridlock (working title)

A turn-based police puzzle for phones. See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design.

**Play online:** https://claude.ai/artifact/2ENqgaUHM6PwqKpLPtBJDD (private link, sign in to claude.ai)

- **Cases 1–15, Downtown:** grid streets, 1 order per turn.
- **Cases 16–35:** you are promoted to Chief.
  - City road layouts: Old Town, Ring Road and Riverside.
  - 3 orders per turn.
  - New units: spikes, traffic control and the chopper.
  - Smarter crews.
- **Daily Heist** (opens at Chief).
- **Coins, ranks, boosters, paint jobs** in Police HQ.
- **Sound, music, vibration, tutorial bubbles.**
- **Ads and purchases** are test screens in the web build (nothing real is shown or charged).

## Run it locally

```bash
node tools/serve.js
```

Then open http://localhost:5173.

## Levels

```bash
node tools/generate-city.js
```

Regenerates Cases 16–35 into `src/levels-city.js`. To redo only some cases, pass their numbers: `node tools/generate-city.js 25 30`.

```bash
node tools/generate-daily.js
```

Regenerates the 28-case Daily Heist pool into `src/levels-daily.js` (about a minute).

```bash
node tools/check-downtown.js
```

Confirms Downtown (Cases 1–15, frozen in `src/levels-downtown.js`) still solves at its recorded par after engine changes.

## Files

| File | What it is |
|---|---|
| `index.html` | Page layout and styles |
| `src/core.js` | Game rules, crew AI (4 ranks), units. No graphics; shared by the game and the tools |
| `src/game.js` | Map drawing, touch controls, units tray, tutorial bubbles, result screen, Police HQ (cases, daily, shop, settings) |
| `src/meta.js` | Player profile: coins, ranks, boosters, paint jobs, Daily Heist streak, ad pacing |
| `src/ads.js` | Ads and purchases behind one interface (test screens on the web; AdMob and Google Play Billing on Android later) |
| `src/audio.js` | Synthesized sound effects, music loop, vibration, sound settings |
| `src/levels-downtown.js` | Cases 1–15 (frozen) |
| `src/levels-city.js` | Cases 16–35 (generated) |
| `src/levels-daily.js` | Daily Heist pool, 28 cases (generated) |
| `tools/mapgen.js` | Old Town, Ring Road and Riverside road layouts |
| `tools/solver.js` | Exact solver (Downtown) and beam-search / greedy chiefs (city) |
| `tools/generate-city.js` | City case generator and difficulty checks |
| `tools/generate-daily.js` | Daily Heist generator (reuses the city checks) |
| `tools/check-downtown.js` | Downtown regression check |
| `tools/serve.js` | Local playtest server |
