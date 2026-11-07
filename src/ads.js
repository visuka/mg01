/*
 * mg01 ads and purchases: one interface for the whole game.
 *   MG_ADS.rewarded(placement) -> Promise<boolean>  (true = watched to the end, give the reward)
 *   MG_ADS.interstitial()      -> Promise<void>     (ad between cases)
 *   MG_ADS.buy(product)        -> Promise<boolean>  (true = purchase went through)
 * In this web prototype they show TEST screens: no real ads, nothing is charged.
 * The Android build will route the same calls to AdMob and Google Play Billing.
 */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const AD_SECONDS = 5;
  const PLACEMENT = {
    double: 'double your coins',
    rewind: 'rewind 2 turns',
    block: 'get an extra roadblock',
    heli: 'get a chopper flight',
    coins: 'get free coins',
  };
  const audio = () => root.MG_AUDIO;

  function showAd(rewarded, placement) {
    return new Promise((resolve) => {
      const ov = $('ov-ad'), done = $('ad-done'), skip = $('ad-skip'), bar = $('ad-bar'), timer = $('ad-timer');
      const prevFocus = document.activeElement;
      $('ad-title').textContent = rewarded ? 'Bonus video' : 'Ad break';
      $('ad-text').textContent = rewarded
        ? `Watch to the end to ${PLACEMENT[placement] || 'get your reward'}. On Android a real video ad plays here.`
        : 'On Android a real ad plays here, between cases only. Remove ads in the HQ shop.';
      done.textContent = rewarded ? 'Collect reward' : 'Close';
      done.disabled = true;
      skip.hidden = !rewarded;
      let left = AD_SECONDS;
      timer.textContent = left;
      bar.style.transition = 'none';
      bar.style.width = '0%';
      ov.hidden = false;
      void bar.offsetWidth;
      bar.style.transition = `width ${AD_SECONDS}s linear`;
      bar.style.width = '100%';
      if (audio()) audio().duck(true);
      skip.focus({ preventScroll: true });
      const iv = setInterval(() => {
        left--;
        timer.textContent = Math.max(0, left);
        if (left <= 0) { clearInterval(iv); done.disabled = false; done.focus({ preventScroll: true }); }
      }, 1000);
      const finish = (ok) => {
        clearInterval(iv);
        done.onclick = skip.onclick = null;
        ov.hidden = true;
        if (audio()) audio().duck(false);
        if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
        resolve(ok);
      };
      done.onclick = () => finish(true);
      skip.onclick = () => finish(false);
    });
  }

  function buy(product) {
    return new Promise((resolve) => {
      const ov = $('ov-buy');
      $('buy-title').textContent = product.name;
      $('buy-price').textContent = product.price;
      $('buy-desc').textContent = product.desc || '';
      ov.hidden = false;
      $('buy-ok').focus({ preventScroll: true });
      const finish = (ok) => { $('buy-ok').onclick = $('buy-cancel').onclick = null; ov.hidden = true; resolve(ok); };
      $('buy-ok').onclick = () => finish(true);
      $('buy-cancel').onclick = () => finish(false);
    });
  }

  root.MG_ADS = {
    rewarded: (placement) => showAd(true, placement),
    interstitial: () => showAd(false).then(() => undefined),
    buy,
  };
})(typeof self !== 'undefined' ? self : this);
