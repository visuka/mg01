/* mg01 player profile: coins, boosters, paint jobs, ranks, Daily Heist streak. No drawing here. */
(function (root) {
  'use strict';
  const KEY = 'mg01.profile.v1';

  // Ranks go up as you close cases. Chief (after Case 15) is also the 3-orders promotion.
  const RANKS = [
    { at: 0, name: 'Officer' },
    { at: 4, name: 'Sergeant' },
    { at: 8, name: 'Lieutenant' },
    { at: 12, name: 'Captain' },
    { at: 15, name: 'Chief' },
    { at: 25, name: 'Commissioner' },
  ];
  const RANK_BONUS = 100;

  const SKINS = [
    { id: 'classic', name: 'Classic', price: 0, body: '#f2f5fa', trim: '#0b1322' },
    { id: 'midnight', name: 'Midnight', price: 300, body: '#2a3347', trim: '#e9eef8' },
    { id: 'highway', name: 'Highway Patrol', price: 600, body: '#2f6fe0', trim: '#f2f5fa' },
    { id: 'sheriff', name: 'Sheriff', price: 900, body: '#e9dcc0', trim: '#5a3a1e' },
    { id: 'gold', name: 'Gold Badge', price: 1500, body: '#e3b53b', trim: '#0b1322' },
  ];

  const BOOSTERS = {
    block: { name: 'Extra roadblock', price: 60 },
    heli: { name: 'Chopper flight', price: 40 },
  };
  const MAX_BACKUP = 2;         // extra units of each kind per case
  const FREE_COINS = 25;        // per "watch a video" in the shop
  const FREE_COINS_PER_DAY = 5;

  // Real money items. On the web these are test purchases; on Android they go to Google Play.
  const PRODUCTS = [
    { id: 'remove_ads', name: 'Remove ads', price: '$3.99', desc: 'No ads between cases. Bonus videos stay optional.' },
    { id: 'starter', name: 'Starter pack', price: '$1.99', desc: 'Remove ads, 500 coins and 3 extra roadblocks. One time only.', once: true },
    { id: 'coins_1500', name: '1,500 coins', price: '$1.99', desc: 'Spend on boosters and paint jobs.' },
  ];

  const blank = () => ({
    coins: 0,
    boosters: { block: 2, heli: 1 },
    skins: ['classic'], skin: 'classic',
    removeAds: false, starter: false,
    rank: 0,
    seen: {},
    sinceAd: 0,
    daily: { last: null, streak: 0, best: 0, wins: 0 },
    freeCoins: { day: null, n: 0 },
  });

  let p = blank();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved.coins === 'number') {
      p = Object.assign(blank(), saved);
      p.boosters = Object.assign(blank().boosters, saved.boosters);
      p.daily = Object.assign(blank().daily, saved.daily);
    }
  } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* ignore */ } };

  // ---------- dates (local time) ----------
  const dayKey = (d) => {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dayNumber = (d) => {
    d = d || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  };
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };

  function rankFor(closed) {
    let r = 0;
    RANKS.forEach((k, i) => { if (closed >= k.at) r = i; });
    return r;
  }

  const API = {
    RANKS, SKINS, BOOSTERS, PRODUCTS, MAX_BACKUP, FREE_COINS, FREE_COINS_PER_DAY, RANK_BONUS,
    get: () => p,
    save,
    dayKey, dayNumber,

    addCoins(n) { p.coins = Math.max(0, p.coins + Math.round(n)); save(); return p.coins; },
    spend(n) { if (p.coins < n) return false; p.coins -= n; save(); return true; },

    // Coins for closing a case. prevStars = best before this win (0 = first clear).
    caseReward({ stars, prevStars, chief }) {
      if (!prevStars) {
        const base = chief ? 30 : 20;
        return { base, stars: stars * 10, total: base + stars * 10, first: true };
      }
      const extra = Math.max(0, stars - prevStars) * 10;
      return { base: 5, stars: extra, total: 5 + extra, first: false };
    },

    // Call after progress changes. Returns the new rank (or null) and pays the bonus.
    checkRank(closed) {
      const r = rankFor(closed);
      if (r <= p.rank) return null;
      p.rank = r;
      p.coins += RANK_BONUS;
      save();
      return RANKS[r];
    },
    rankName: (closed) => RANKS[closed == null ? p.rank : rankFor(closed)].name,

    // ---------- boosters ----------
    useBooster(kind) { if (!p.boosters[kind]) return false; p.boosters[kind]--; save(); return true; },
    buyBooster(kind, n) {
      const cost = BOOSTERS[kind].price * (n || 1);
      if (!API.spend(cost)) return false;
      p.boosters[kind] += n || 1; save(); return true;
    },

    // ---------- paint jobs ----------
    skin: () => SKINS.find((s) => s.id === p.skin) || SKINS[0],
    buySkin(id) {
      const s = SKINS.find((k) => k.id === id);
      if (!s || p.skins.includes(id) || !API.spend(s.price)) return false;
      p.skins.push(id); p.skin = id; save(); return true;
    },
    wearSkin(id) { if (p.skins.includes(id)) { p.skin = id; save(); } },

    // ---------- purchases ----------
    grantProduct(id) {
      if (id === 'remove_ads') p.removeAds = true;
      else if (id === 'starter') { p.starter = true; p.removeAds = true; p.coins += 500; p.boosters.block += 3; }
      else if (id === 'coins_1500') p.coins += 1500;
      save();
    },

    // ---------- free coins (rewarded video in the shop) ----------
    freeCoinsLeft() {
      if (p.freeCoins.day !== dayKey()) return FREE_COINS_PER_DAY;
      return Math.max(0, FREE_COINS_PER_DAY - p.freeCoins.n);
    },
    takeFreeCoins() {
      if (p.freeCoins.day !== dayKey()) p.freeCoins = { day: dayKey(), n: 0 };
      p.freeCoins.n++;
      p.coins += FREE_COINS;
      save();
    },

    // ---------- ads between cases ----------
    // At most one every 3 wins, never in the first 6 cases, never with Remove ads.
    countWin() { p.sinceAd++; save(); },
    interstitialDue(closed) { return !p.removeAds && closed >= 6 && p.sinceAd >= 3; },
    adShown() { p.sinceAd = 0; save(); },

    // ---------- Daily Heist ----------
    dailyDoneToday: () => p.daily.last === dayKey(),
    dailyStreakIfWon() {
      if (p.daily.last === dayKey()) return p.daily.streak;
      return p.daily.last === yesterdayKey() ? p.daily.streak + 1 : 1;
    },
    dailyReward(streak) { return 100 + 25 * Math.min(Math.max(0, streak - 1), 6); },
    winDaily() {
      if (p.daily.last === dayKey()) return null;
      const streak = API.dailyStreakIfWon();
      const coins = API.dailyReward(streak);
      p.daily = { last: dayKey(), streak, best: Math.max(p.daily.best, streak), wins: p.daily.wins + 1 };
      p.coins += coins;
      save();
      return { streak, coins };
    },
    // The streak shown on the HQ screen: broken if yesterday and today were both missed.
    currentStreak() {
      if (p.daily.last === dayKey() || p.daily.last === yesterdayKey()) return p.daily.streak;
      return 0;
    },

    // ---------- tutorial flags ----------
    seen: (k) => !!p.seen[k],
    markSeen(k) { if (!p.seen[k]) { p.seen[k] = 1; save(); } },

    reset() { p = blank(); save(); },
  };

  root.MG_META = API;
})(typeof self !== 'undefined' ? self : this);
