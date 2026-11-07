# mg01 — Game Design (draft v0.1)

> Working name: **mg01** (we'll pick the real name later)
> Genre: hybrid-casual **turn-based puzzle** · Portrait, one-hand play · Android first

---

## 1. The pitch

The bank has just been robbed. The getaway car is racing for the edge of town.
You are the **Police Chief**. Each turn you give one order to your force — drop a
roadblock, move a patrol car — and the robbers make their next move. Trap them
before they reach a town exit.

**Short version:** *"Think one move ahead of the getaway car."*

---

## 2. How a level works

### The map
- The town is seen **from above**: streets meet at **intersections** (the dots).
- Buildings, parks and rivers mean not every intersection is connected.
- **Exits** sit at the town's edge (highway ramp, bridge, tunnel).
- The **bank** is where the robbers start.

```
  EXIT ── o ─── o ─── o
          |     |     |
          o ─── B ─── o ── EXIT
          |           |
          o ─── o ─── o
                |
               EXIT
   B = bank (robbers start)   o = intersection
```

### Turn order
1. **Your turn:** give **one** order:
   - **Place a roadblock** on any empty intersection (limited number per level), **or**
   - **Move one patrol car** one step along a street.
2. **Robbers' turn:** the getaway car moves **one intersection** toward the nearest exit it can still reach.
3. Repeat.

Nothing moves while you think. There is no timer.

### The robbers are predictable (on purpose)
- An **arrow shows where the getaway car will go next**, so you can always plan.
- They always take the shortest open route to the nearest exit.
- This keeps the puzzle fair: every loss is "I should have blocked that street," never bad luck.

### Winning — "BUSTED!"
- **Trapped:** every road out of the robbers' intersection is blocked, **or**
- **Arrested:** a patrol car moves onto the robbers' intersection.

### Losing — "They got away!"
- The getaway car reaches an exit.
- **Second chance** (watch an ad): rewind 2 turns and try again.

### Stars
| Stars | How |
|---|---|
| ★★★ | Caught within the target number of turns |
| ★★ | Caught within target + 2 turns |
| ★ | Caught at all |

---

## 3. Your police force (unlocked as you progress)

| Unit | What it does | Unlocks |
|---|---|---|
| **Roadblock** | Blocks one intersection for the whole level | Level 1 |
| **Patrol car** | Moves 1 step per order; blocks where it stands; arrests on contact | Level 4 |
| **Spike strip** | Robbers who drive over it lose their next turn | Level 12 |
| **Traffic control** | Closes one street for 2 turns | Level 20 |
| **Helicopter** | Shows the robbers' full planned route | Booster (coins or ad) |

## 4. The robbers (get harder over time)

| Robber | Behaviour | First appears |
|---|---|---|
| **Getaway car** | 1 step per turn, nearest exit | Level 1 |
| **Smart driver** | Avoids intersections next to patrol cars | Level 15 |
| **Motorbike** | 2 steps every other turn | Level 25 |
| **Decoy convoy** | 2–3 cars, only one has the money — catch the right one | Level 35 |

## 5. Districts (themes + new map rules)

1. **Downtown:** neat grid, learn the basics
2. **Old Town:** twisty streets, dead ends
3. **Harbor:** bridges are chokepoints, some bridges lift
4. **Industrial:** train crossings close every few turns
5. **Hillside:** one-way streets

About 30 levels per district. New districts give the game a fresh look as players progress.

---

## 6. Progression (what keeps players coming back)

- **City budget (coins):** earned for every catch; more for stars. Story: a share of the recovered cash.
- **Police HQ upgrades:** start levels with +1 roadblock, faster patrol cars, extra helicopter charge.
- **Rank:** Officer → Sergeant → Lieutenant → Captain → Chief → Commissioner.
- **Daily Heist:** one special puzzle per day, with a streak bonus.
- **Skins:** police car colours and designs, badge styles.

## 7. How it earns money

**Rewarded ads** (player chooses to watch):
- Undo a move
- +1 roadblock
- Helicopter scan
- Second chance (rewind 2 turns)
- Double coins at level end

**Ads between levels:** start after level 6, at most one every 2–3 levels, never mid-level.

**Purchases:**
- Remove ads (about $2.99–$4.99)
- Coin packs
- One-time starter pack

**Ad network:** Google AdMob, optionally with mediation later.

## 8. Look and feel

- Clean, colourful top-down city with bold, readable shapes on small screens.
- **Family-friendly:** cartoon robbers in masks, no guns or violence. An "Everyone" rating means a bigger audience and better-paying ads.
- **Satisfying moments for short videos:**
  - Sirens flash as cars close in
  - A big **BUSTED!** stamp
  - The money bag pops back to the bank

## 9. Technical plan

1. **Prototype as a web game** (HTML5 canvas, TypeScript). Playable on any phone from a link.
2. **Level generator + solver:**
   - A computer makes new maps.
   - The solver checks every level can actually be won and sets the star target.
   - This works because the robbers are predictable.
3. **Android app:**
   - Wrap the same code with **Capacitor**.
   - Add the **AdMob** plugin.
   - Publish on Google Play.
4. Save progress on the phone. Add a cloud save later if needed.

## 10. First prototype (v0.1): scope

- [x] Downtown district, 15 levels (built 2026-11-06)
- [x] Roadblocks + patrol cars
- [x] Standard getaway car with "next move" arrow
- [x] Win / lose screens, stars, level select
- [x] Tap-only controls, portrait
- Not yet: ads, purchases, upgrades, other districts

**Goal of v0.1:** answer one question. **Is it fun to trap the getaway car?**
Play it, show friends, adjust the rules, then build out the rest.

## 11. Targets once live

- **Day 1 return:** ≥ 35%
- **Day 7 return:** ≥ 15%
- **Day 30 return:** ≥ 5%

## 12. Open questions

- [ ] Real game name (check it isn't already taken on Google Play). Working title: Getaway Gridlock.
- [ ] Art style: cartoon (recommended) or more realistic?
- [ ] Should the robbers have characters / names (a "crew" with personalities)?
- [ ] Story between districts (short comic panels), or keep it pure puzzle?

---

## 13. Version 0.2: real city roads, a bigger police force, smarter crews (built 2026-11-06)

Downtown (Cases 1–15, grid streets, 1 order per turn) stays as it is. It becomes the training ground.
Everything below starts at **Case 16**.

### 13.1 Promotion (first built as 3 orders per turn, changed to one move on 2026-11-07)

> **Changed 2026-11-07:** play-testing showed the 3-orders-then-Dispatch turn was hard to understand, for adults too. Now every case works like Downtown: **you make one move, then the robbers move.** There is no Dispatch button. The chopper stays free (it doesn't use your move). Crews drive 1 corner per turn (fast cars 2), and roadblocks can go right next to a crew, as in Downtown. Cases 16–35 and the Daily Heist were regenerated and re-checked by the solvers. The original design follows for the record.

After closing Downtown you are **promoted to Chief**. From then on:

- Each turn you give **up to 3 orders**, then tap **Dispatch** (or it dispatches by itself after the 3rd order).
- Orders can mix units: for example one roadblock, one spike strip and one patrol car move in the same turn.
- The robbers' arrow **updates after every order**, so you see how each order changes their plan before you dispatch.
- Units are still limited per case (e.g. 4 roadblocks, 2 spike strips, 2 patrol cars). Using all 3 orders every turn burns through them fast, so sometimes the best turn uses only 1 or 2.

**Balance rules** (added during the build, because 3 orders made every case too easy):
- **Pros drive faster:** from Case 16 crews drive **2 corners per turn**.
- **No time to set up:** a roadblock can't go on a corner right next to a crew, and traffic control can't close the street a crew is on. Seal routes *ahead* of them. Spike strips and patrol cars can still go anywhere.
- **One move per car per turn:** each patrol car can take only one order per turn.

### 13.2 The police force

| Unit | What it does | Limit |
|---|---|---|
| **Roadblock** | Blocks one intersection for the rest of the case (not right next to a crew) | Few per case |
| **Patrol car** | Moves up to 2 corners, once per turn; blocks where it stands; arrests on contact | 1–3 cars |
| **Spike strip** | Laid at an intersection; a crew that drives onto it stops there and loses its next move | Few per case |
| **Traffic control** | Closes one street for 2 turns, then it reopens | Few per case |
| **Helicopter** | Reveals the crew's full plan, route and target exit, for this turn. Doesn't use an order | 1–2 per case, also a booster |

### 13.3 Smarter crews ("they have plans to exit")

Each new case brings a smarter crew. The radio warns you at the start ("Intel: this crew plans ahead").

| Crew rank | How they think | From |
|---|---|---|
| 1. **Rookies** | Shortest road to the nearest exit (Downtown) | Case 1 |
| 2. **Careful** | Avoid streets next to patrol cars and spike strips | Case 16 |
| 3. **Planners** | Pick the escape route with the most backup roads, not just the shortest | Case 20 |
| 4. **Masterminds** | Count your remaining units: steer toward areas you can't seal with what you have left, and switch exits when you block them | Case 25 |
| 5. **Split crew** | The loot is split between two getaway cars; catch both | Case 30 |

**Fast cars** (Cases 27–29) drive 3 corners per turn.

The robbers' rules stay **fair and visible**:
- The arrow always shows their next move.
- The helicopter shows their whole plan.
- Losing is still "I should have blocked that," never bad luck.

### 13.4 City-like road patterns

Higher cases use real city layouts instead of a neat grid:

| District | Road pattern | What it adds |
|---|---|---|
| **Old Town** (16–22) | Crooked streets, odd-shaped blocks, dead ends, diagonal shortcuts | Routes are harder to read |
| **Ring Road** (23–29) | A hub, an inner ring and an outer ring joined by spokes; exits are highway ramps off the outer ring | Robbers can circle around |
| **Riverside** (30–35) | A river splits the city; only 2–3 bridges | Bridges are natural choke points |

**Sized for phones (2026-11-07):** a phone screen limits these maps by height, not width.
- Riverside is 5 streets across and 7 down (it was 8 down).
- Ring Road is drawn 14% smaller, with the same streets and the same puzzles.
- Old Town stays 5 × 7.
- Every exit is a slim green tab next to its last corner: upright on the left and right, flat at the top and bottom.
- Together that makes Chief maps about 12% bigger on screen; the smallest went from 54 to 63 pixels per street on a 360-pixel-wide phone.

**How it's built:**
- Maps become networks of intersections at any position, not grid squares.
- Roads can be straight or angled, and buildings, parks and the river fill the spaces between them.
- The level generator makes these layouts from templates (ring + spokes, river + bridges, organic old town), each with randomness.
- Every case is checked by two automatic chiefs:
  - A **lazy chief** follows the obvious plan each turn. The case is kept only if this chief **loses**.
  - A **beam-search chief** keeps the 28 best plans open each turn. It must **win**, and its turn count sets par.
  - From Case 20, a chief who keeps 3 plans open must also lose.
  - If a case keeps coming out too easy or too hard, the generator nudges its roadblock count.

### 13.5 Build order for v0.2

- [x] Free-form maps (any intersection positions) plus the Old Town generator.
- [x] 3 orders per turn, the Dispatch button, and the live arrow update.
- [x] Spike strips, traffic control and helicopter.
- [x] Crew ranks 2–4, then the split crew.
- [x] Ring Road and Riverside districts.
- [x] 20 new cases (16–35), each checked by the solvers.

---

## 14. Version 0.3: polish and money (built 2026-11-07)

After playing v0.2 the verdict was "really fun". v0.3 adds everything around the puzzle that a store release needs, except the Android wrapper itself.

### 14.1 Polish
- **Sound:** every action has its own synthesized sound (roadblock thud, spike clink, traffic whistle, chopper, siren whoop, radio squelch, getaway engine, tyre hiss, BUSTED stamp, star chimes, escape "wah-wah", coins, rank fanfare). No sound files to ship. Plus a quiet spy-style music loop.
- **Vibration** on roadblocks, spikes, arrests and escapes (phones that support it).
- **Settings:** sound, music and vibration toggles (HQ, gear tab).
- **Tutorial bubbles**, each shown once:
  - Case 1: where to put the first roadblock.
  - Case 2: what the orange arrow means.
  - Case 4: how to move a patrol car.
  - Case 16: 3 orders, then Dispatch; then the free chopper.
  - The first time spikes, traffic control or "out of roadblocks" comes up.

### 14.2 Coins (city budget)
| Event | Coins |
|---|---|
| First clear of a case | 20 (Downtown) or 30 (Chief cases) + 10 per star |
| Replay | 5, + 10 per new star |
| Rank-up | +100 |
| Daily Heist | 100, + 25 per streak day (max +150 on day 7) |
| Watch a video in the shop | +25, up to 5 per day |
| Double coins (video on the win screen) | doubles that case's coins |

### 14.3 Ranks
Officer (start) → Sergeant (4 cases closed) → Lieutenant (8) → Captain (12) → **Chief (15, the 3-orders promotion)** → Commissioner (25). Each rank-up shows a promotion card and pays 100 coins.

### 14.4 Police HQ (the button top left)
- **Cases:** the case files, as before.
- **Daily:** one Daily Heist per day.
  - It opens once you're Chief.
  - A pool of 28 solver-checked cases (4 weeks): easy on Monday, hardest on Sunday.
  - The week strip shows the streak. A red dot on the HQ button means today's heist isn't done.
- **Shop:**
  - Boosters: extra roadblock 60 coins, chopper flight 40.
  - Free coins by video.
  - Patrol car paint: Midnight 300, Highway Patrol 600, Sheriff 900, Gold Badge 1,500.
  - Real-money items: Remove ads $3.99, Starter pack $1.99 (no ads, 500 coins, 3 roadblocks), 1,500 coins $1.99.
- **Settings:** toggles, plus test tools (unlock all, +500 coins, reset everything).

### 14.5 Ads (placements)
| Placement | Type | Rule |
|---|---|---|
| Second chance after a loss: rewind 2 turns | Rewarded | Player's choice (restart stays free) |
| Double coins on the win screen | Rewarded | Player's choice |
| Backup when out of roadblocks / chopper | Rewarded (or use a booster, or pay coins) | Max 2 extra of each per case; not in Cases 1–4 |
| Free coins in the shop | Rewarded | 5 per day |
| Between cases | Interstitial | Not before 6 cases closed; at most every 3rd win; never right after a promotion or a bonus video; never with Remove ads |

Undo within a case stays free.

**In the web prototype every ad and purchase is a test screen:** a 5-second "Test ad" card and a "Test purchase" sheet. Nothing real is shown or charged. All calls go through one interface (`src/ads.js`), so the Android build can swap in AdMob and Google Play Billing without touching the game.

### 14.6 Next: Android (v0.4)
Decided 2026-11-07: use **Expo** (like the Steps app), not Capacitor. Expo's cloud builds the app, so no Android Studio is needed on this PC.
- [x] Expo app shell in `mobile/`: the game in a WebView, Android back button, native vibration. Project `@neutcrafts/mg01` on the neutcrafts Expo account; package `com.neutcrafts.mg01`.
- [x] First installable preview APK (Expo internal distribution).
- [ ] Test on real phones: sound, vibration, saved progress after closing the app, back button.
- [ ] AdMob (`react-native-google-mobile-ads`, test ad units first) and Google Play Billing, wired into `src/ads.js` through the WebView bridge.
- [ ] Real app icon and splash screen (currently Expo placeholders).
- [ ] Google Play: developer account (Neutcrafts), store listing, privacy policy, closed testing track.
