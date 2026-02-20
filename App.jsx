import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEXUS v7.0 — 24/7 NON-STOP AI TRADING INTELLIGENCE (PRODUCTION GRADE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✦ ZERO-ERROR TOLERANCE — Every function wrapped with safety
// ✦ FULL PERSISTENCE — Balance, positions, brain survive page refresh
// ✦ AI AUTO-PILOT — Learns first, trades smart, stop button for user
// ✦ BINANCE API PLUGIN — Connect real account when AI is trained
// ✦ $100 START — Training account | realistic fees + slippage = real money results
// ✦ 26+ INDICATORS + News + Sessions + Social + Macro + On-Chain + LLM Brain + Fake Detection + Brain Learning
// ✦ FULL SCREEN — Uses entire viewport
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ═══ CONSTANTS ═══
const FEE_RATE = 0.002;
// ═══ REALISTIC EXECUTION ═══
// Real Binance fees (0.2%) + market slippage + vol-adjusted friction
// What you see in training = what you get with real money
const SLIPPAGE_BPS = 3; // 0.03% avg slippage (Binance market orders)
const SLIPPAGE_VOL_MULT = 2.5; // slippage increases with volatility
function simulateSlippage(entryPrice, side, atrPct = 1) {
  try {
    // Base slippage: 0.03% + random 0-0.02% + volatility multiplier
    const volFactor = Math.min(atrPct / 1.5, 3); // higher ATR = more slippage
    const baseBps = SLIPPAGE_BPS + Math.random() * 2;
    const totalBps = baseBps * (0.5 + volFactor * 0.5);
    const slip = entryPrice * (totalBps / 10000);
    // Slippage always works against you: LONG fills higher, SHORT fills lower
    return side === "LONG" ? entryPrice + slip : entryPrice - slip;
  } catch { return entryPrice; }
}
const MIN_BALANCE = 5;
const MAX_POSITIONS = 5;
const MIN_STACK_DISTANCE_PCT = 0.25; // Min 0.25% price distance between stacked entries on same pair
const STACK_SIZE_DECAY = [1, 0.8, 0.6, 0.45, 0.3]; // Position size multiplier: 1st=100%, 2nd=80%, 3rd=60%, 4th=45%, 5th=30%
const COOL_AFTER_LOSS = 60000;
const MAX_TRADES_PER_SESSION = 20;
const MIN_CONF_TO_TRADE = 40;
// ═══ PRICE SANITY — Prevent fake PnL from stale/fallback prices ═══
const MAX_SANE_MOVE_PCT = 8;       // Max 8% price move considered real (BTC rarely moves more in one candle)
const MAX_SANE_PNL_PCT = 10;       // Max 10% PnL considered real (anything above is data error)
const STALE_WINNER_MINS = 180;     // Close stale winners after 3 hours
const STALE_WINNER_MIN_PCT = 0.5;  // Minimum profit% to keep holding past stale timer
const SESSION_PROFIT_TARGET = 0.8;
const SESSION_MAX_LOSS = 1.5;
const INITIAL_BALANCE = 100;
const LEARNING_TICKS = 80;

const SYMBOLS = [
  { sym: "BTCUSDT", name: "BTC", icon: "₿", dp: 2 },
  { sym: "ETHUSDT", name: "ETH", icon: "Ξ", dp: 2 },
  { sym: "SOLUSDT", name: "SOL", icon: "◎", dp: 2 },
  { sym: "BNBUSDT", name: "BNB", icon: "◆", dp: 2 },
  { sym: "XRPUSDT", name: "XRP", icon: "✕", dp: 4 },
  { sym: "DOGEUSDT", name: "DOGE", icon: "D", dp: 5 },
  { sym: "ADAUSDT", name: "ADA", icon: "₳", dp: 4 },
  { sym: "AVAXUSDT", name: "AVAX", icon: "▲", dp: 2 },
];

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

const ENDPOINTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

// ═══ YOUR PROXY (deployed on Render — never blocked) ═══
const MY_PROXY = "https://nexus-proxy-fd7v.onrender.com/proxy?url=";

const CORS_PROXIES = [
  MY_PROXY,
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?url=",
];

// ╔══════════════════════════════════════════════════════════════╗
// SOCIAL ENGINE — Real Fear & Greed API + Reddit Sentiment
// ╚══════════════════════════════════════════════════════════════╝
const SocialEngine = {
  // Fetch real Fear & Greed Index from Alternative.me
  async fetchFearGreed() {
    try {
      const proxies = ["", ...CORS_PROXIES];
      const url = "https://api.alternative.me/fng/?limit=7";
      for (const proxy of proxies) {
        try {
          const fetchUrl = proxy ? proxy + encodeURIComponent(url) : url;
          const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) continue;
          const data = await res.json();
          if (!data?.data?.length) continue;
          const current = data.data[0];
          const prev = data.data.length > 1 ? data.data[1] : null;
          const weekAgo = data.data.length > 6 ? data.data[6] : null;
          const value = +current.value;
          const label = current.value_classification;
          // Calculate trend from 7-day history
          let trend = "stable";
          if (prev) {
            const diff = value - (+prev.value);
            if (diff > 5) trend = "rising";
            else if (diff < -5) trend = "falling";
          }
          // Weekly change
          const weekChange = weekAgo ? value - (+weekAgo.value) : 0;
          return {
            value, label, trend, weekChange,
            prevValue: prev ? +prev.value : value,
            isExtremeFear: value <= 20,
            isExtremeGreed: value >= 80,
            isFear: value <= 35,
            isGreed: value >= 65,
            signal: value <= 15 ? 1.0 : value <= 25 ? 0.7 : value <= 35 ? 0.3 : value >= 85 ? -1.0 : value >= 75 ? -0.7 : value >= 65 ? -0.3 : 0,
            live: true, timestamp: Date.now(),
          };
        } catch { continue; }
      }
      return this._fallbackFG();
    } catch { return this._fallbackFG(); }
  },

  _fallbackFG() {
    return { value: 50, label: "Neutral", trend: "stable", weekChange: 0, prevValue: 50, isExtremeFear: false, isExtremeGreed: false, isFear: false, isGreed: false, signal: 0, live: false, timestamp: Date.now() };
  },

  // Fetch Reddit r/Bitcoin sentiment — with backoff, caching, RSS fallback
  _redditBackoff: 0,
  _redditCache: null,
  _redditConsecutiveFails: 0,

  async fetchRedditSentiment() {
    try {
      // Return cache if backoff active
      if (Date.now() < this._redditBackoff && this._redditCache) return this._redditCache;

      // Try JSON first, then RSS fallback
      const result = await this._tryRedditJSON() || await this._tryRedditRSS();

      if (result) {
        this._redditCache = result;
        this._redditConsecutiveFails = 0;
        this._redditBackoff = 0;
        return result;
      }

      // All failed — exponential backoff (max 30min)
      this._redditConsecutiveFails++;
      const backoffMs = Math.min(1800000, 60000 * Math.pow(2, this._redditConsecutiveFails));
      this._redditBackoff = Date.now() + backoffMs;
      console.warn(`[NEXUS] Reddit: ${this._redditConsecutiveFails} fails, backoff ${Math.round(backoffMs/1000)}s`);
      return this._redditCache || this._fallbackReddit();
    } catch { return this._redditCache || this._fallbackReddit(); }
  },

  async _tryRedditJSON() {
    const urls = [
      "https://www.reddit.com/r/Bitcoin/hot.json?limit=25",
      "https://www.reddit.com/r/cryptocurrency/hot.json?limit=25",
    ];
    const proxyList = CORS_PROXIES.filter(Boolean);
    for (const baseUrl of urls) {
      for (const proxy of proxyList) {
        try {
          const res = await fetch(proxy + encodeURIComponent(baseUrl), {
            signal: AbortSignal.timeout(10000),
            headers: { "Accept": "application/json" },
          });
          if (res.status === 429 || res.status === 403) continue;
          if (!res.ok) continue;
          const data = await res.json();
          if (!data?.data?.children?.length) continue;
          return this._parseRedditPosts(data.data.children.map(p => p.data).filter(p => p && p.title));
        } catch { continue; }
      }
    }
    return null;
  },

  async _tryRedditRSS() {
    // RSS feeds are less rate-limited than JSON API
    const urls = [
      "https://www.reddit.com/r/Bitcoin/hot.rss?limit=20",
      "https://www.reddit.com/r/cryptocurrency/hot.rss?limit=20",
    ];
    const proxyList = CORS_PROXIES.filter(Boolean);
    for (const baseUrl of urls) {
      for (const proxy of proxyList) {
        try {
          const res = await fetch(proxy + encodeURIComponent(baseUrl), {
            signal: AbortSignal.timeout(10000),
          });
          if (res.status === 429 || res.status === 403) continue;
          if (!res.ok) continue;
          const text = await res.text();
          const titleMatches = [...text.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)];
          if (titleMatches.length < 3) continue;
          const posts = titleMatches.slice(1).map(m => ({
            title: m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
            ups: 10, upvote_ratio: 0.7, selftext: "",
          }));
          if (posts.length > 0) return this._parseRedditPosts(posts);
        } catch { continue; }
      }
    }
    return null;
  },

  _parseRedditPosts(posts) {
    try {
      let totalScore = 0;
      let bullCount = 0, bearCount = 0, totalPosts = 0;
      const bullWords = ["bull","moon","pump","ath","buy","long","breakout","rally","surge","adoption","institutional","etf approved","bullish","higher","recover","bounce","support held","accumulate","halving"];
      const bearWords = ["bear","crash","dump","sell","short","plunge","fear","collapse","scam","ban","regulation","bubble","ponzi","correction","lower","resistance","breakdown","capitulation","bearish"];
      for (const post of posts.slice(0, 25)) {
        const text = (post.title + " " + (post.selftext || "")).toLowerCase();
        let postScore = 0;
        const upvoteWeight = Math.min(Math.log10(Math.max(post.ups || 1, 1)) / 3, 1.5);
        bullWords.forEach(w => { if (text.includes(w)) postScore += 4 * upvoteWeight; });
        bearWords.forEach(w => { if (text.includes(w)) postScore -= 4 * upvoteWeight; });
        const ratio = post.upvote_ratio || 0.5;
        postScore *= (0.5 + ratio);
        totalScore += postScore;
        if (postScore > 2) bullCount++;
        else if (postScore < -2) bearCount++;
        totalPosts++;
      }
      const normalized = clamp(Math.round(totalScore / Math.max(totalPosts, 1) * 5), -100, 100);
      const label = normalized > 25 ? "Bullish" : normalized > 8 ? "Slightly Bullish" : normalized < -25 ? "Bearish" : normalized < -8 ? "Slightly Bearish" : "Neutral";
      return {
        score: normalized, label, bullCount, bearCount, totalPosts,
        signal: normalized > 30 ? 0.6 : normalized > 15 ? 0.3 : normalized < -30 ? -0.6 : normalized < -15 ? -0.3 : 0,
        live: true, timestamp: Date.now(),
      };
    } catch { return null; }
  },

  _fallbackReddit() {
    return { score: 0, label: "Neutral", bullCount: 0, bearCount: 0, totalPosts: 0, signal: 0, live: false, timestamp: Date.now() };
  },

  // Combined social score for AI decision engine
  getCombinedSignal(fg, reddit) {
    try {
      // F&G is stronger signal (70% weight), Reddit is 30%
      const fgWeight = 0.7;
      const rdWeight = 0.3;
      const combined = (fg.signal * fgWeight) + (reddit.signal * rdWeight);
      return {
        signal: combined,
        fgContrib: fg.signal * fgWeight,
        rdContrib: reddit.signal * rdWeight,
        isContrarian: fg.isExtremeFear || fg.isExtremeGreed,
        description: fg.isExtremeFear ? "Extreme Fear = contrarian BUY zone" : fg.isExtremeGreed ? "Extreme Greed = contrarian SELL zone" : fg.isFear ? "Fear = accumulation zone" : fg.isGreed ? "Greed = caution zone" : "Neutral social sentiment",
      };
    } catch { return { signal: 0, fgContrib: 0, rdContrib: 0, isContrarian: false, description: "Social data unavailable" }; }
  },
};

// ╔══════════════════════════════════════════════════════════════╗
// MACRO ENGINE — S&P 500, DXY, Gold via 5-SOURCE FALLBACK
// Sources: Yahoo, GoldPrice.org, Metals.live, ExchangeRate API, TwelveData
// ╚══════════════════════════════════════════════════════════════╝
const MacroEngine = {
  _cache: null,
  _cacheTime: 0,
  _tdRateLimited: false,
  _tdCooldownUntil: 0,
  _lastWorkingProxy: "",
  _lastWorkingSource: "",

  // Helper: direct fetch (no proxy needed) with timeout
  async _directFetch(url, timeout = 8000) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  },

  // Helper: fetch via CORS proxy chain
  async _proxyFetch(targetUrl, proxies, timeout = 8000) {
    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy + encodeURIComponent(targetUrl), { signal: AbortSignal.timeout(timeout) });
        if (!res.ok) continue;
        const data = await res.json();
        if (data) { this._lastWorkingProxy = proxy; return data; }
      } catch { continue; }
    }
    return null;
  },

  async fetchMacroData() {
    try {
      // 5-minute cache to prevent API hammering
      if (this._cache?.live && Date.now() - this._cacheTime < 300000) return this._cache;

      const results = { sp500: null, dxy: null, gold: null, regime: "NEUTRAL", live: false, timestamp: Date.now(), source: "" };
      const proxies = CORS_PROXIES.filter(Boolean);
      const orderedProxies = this._lastWorkingProxy 
        ? [this._lastWorkingProxy, ...proxies.filter(p => p !== this._lastWorkingProxy)]
        : proxies;

      // ═══ SOURCE 1: Yahoo Finance via CORS proxy (S&P, DXY, Gold) ═══
      const yfSymbols = [
        { key: "sp500", yf: "^GSPC", name: "S&P 500" },
        { key: "dxy", yf: "DX-Y.NYB", name: "DXY" },
        { key: "gold", yf: "GC=F", name: "Gold" },
      ];
      for (const sym of yfSymbols) {
        if (results[sym.key]?.live) continue;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym.yf}?range=2d&interval=1d`;
        const data = await this._proxyFetch(url, orderedProxies);
        const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        if (closes?.length >= 2) {
          const today = closes[closes.length - 1];
          const yesterday = closes[closes.length - 2];
          if (today && yesterday) {
            results[sym.key] = { price: today, change: ((today - yesterday) / yesterday) * 100, name: sym.name, live: true };
            results.live = true;
            results.source = "yahoo";
          }
        }
      }

      // ═══ SOURCE 2: Gold from goldprice.org (FREE, CORS-enabled, NO proxy) ═══
      if (!results.gold?.live) {
        try {
          const data = await this._directFetch("https://data-asg.goldprice.org/dbXRates/USD", 6000);
          if (data?.items?.[0]) {
            const item = data.items[0];
            const goldPrice = item.xauPrice;
            const goldPrev = item.xauClose || goldPrice;
            if (goldPrice && goldPrev) {
              results.gold = { price: goldPrice, change: ((goldPrice - goldPrev) / goldPrev) * 100, name: "Gold", live: true };
              results.live = true;
              if (!results.source) results.source = "goldprice.org";
            }
          }
        } catch { /* silent */ }
      }

      // ═══ SOURCE 3: Gold from metals.live (FREE, no key, direct) ═══
      if (!results.gold?.live) {
        try {
          const gData = await this._directFetch("https://api.metals.live/v1/spot/gold", 6000);
          if (Array.isArray(gData) && gData.length > 0 && gData[0]?.price) {
            results.gold = { price: gData[0].price, change: 0, name: "Gold", live: true };
            results.live = true;
            if (!results.source) results.source = "metals.live";
          }
        } catch { /* silent */ }
      }

      // ═══ SOURCE 4: Synthetic DXY from exchange rates (FREE, CORS-enabled, NO proxy) ═══
      if (!results.dxy?.live) {
        try {
          const fxData = await this._directFetch("https://open.er-api.com/v6/latest/USD", 8000);
          if (fxData?.result === "success" && fxData?.rates) {
            const r = fxData.rates;
            // Official DXY basket weights: EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%
            if (r.EUR && r.JPY && r.GBP && r.CAD && r.SEK && r.CHF) {
              const syntheticDXY = 50.14348 
                * Math.pow(1 / r.EUR, 0.576) 
                * Math.pow(r.JPY, 0.136) 
                * Math.pow(1 / r.GBP, 0.119) 
                * Math.pow(r.CAD, 0.091) 
                * Math.pow(r.SEK, 0.042) 
                * Math.pow(r.CHF, 0.036);
              // % change vs previous cached value (first fetch = 0%)
              const prevDXY = this._cache?.dxy?.price || syntheticDXY;
              const dxyChange = prevDXY !== syntheticDXY ? ((syntheticDXY - prevDXY) / prevDXY) * 100 : 0;
              results.dxy = { price: Math.round(syntheticDXY * 100) / 100, change: dxyChange, name: "DXY", live: true, synthetic: true };
              results.live = true;
              if (!results.source) results.source = "exchange-rates";
            }
          }
        } catch { /* silent */ }
      }

      // ═══ SOURCE 5: TwelveData fallback (rate-limit aware, via proxy) ═══
      const tdOk = !this._tdRateLimited || Date.now() > this._tdCooldownUntil;
      if (tdOk && (!results.sp500?.live || !results.dxy?.live || !results.gold?.live)) {
        const tdSymbols = [
          { key: "sp500", td: "SPX", name: "S&P 500" },
          { key: "dxy", td: "DXY", name: "DXY" },
          { key: "gold", td: "XAU/USD", name: "Gold" },
        ];
        for (const sym of tdSymbols) {
          if (results[sym.key]?.live) continue;
          const url = `https://api.twelvedata.com/time_series?symbol=${sym.td}&interval=1day&outputsize=2&format=JSON`;
          const data = await this._proxyFetch(url, orderedProxies, 8000);
          if (data?.code === 429 || data?.status === "error") {
            this._tdRateLimited = true;
            this._tdCooldownUntil = Date.now() + 3600000;
            break;
          }
          if (data?.values?.length >= 2) {
            const today = parseFloat(data.values[0].close);
            const yesterday = parseFloat(data.values[1].close);
            results[sym.key] = { price: today, change: ((today - yesterday) / yesterday) * 100, name: sym.name, live: true };
            results.live = true;
            if (!results.source) results.source = "twelvedata";
          }
        }
      }

      // Determine macro regime
      const sp = results.sp500?.change || 0;
      const dx = results.dxy?.change || 0;
      const gl = results.gold?.change || 0;

      if (sp < -1 && dx > 0.3 && gl > 0.5) results.regime = "RISK-OFF";
      else if (sp < -0.5 && dx > 0.2) results.regime = "CAUTIOUS";
      else if (sp > 0.5 && dx < -0.2) results.regime = "RISK-ON";
      else if (sp > 1 && dx < -0.5) results.regime = "BULLISH";
      else results.regime = "NEUTRAL";

      // Debug log what worked
      console.log("[NEXUS] Macro fetch:", 
        "SP500=" + (results.sp500?.live ? "LIVE" : "FAIL"), 
        "DXY=" + (results.dxy?.live ? "LIVE" : "FAIL"), 
        "Gold=" + (results.gold?.live ? "LIVE" : "FAIL"), 
        "via " + (results.source || "none"));

      // Cache successful results
      if (results.live) { this._cache = results; this._cacheTime = Date.now(); }
      return results;
    } catch(e) { 
      console.warn("[NEXUS] MacroEngine error:", e?.message);
      return { sp500: null, dxy: null, gold: null, regime: "NEUTRAL", live: false, timestamp: Date.now(), source: "" }; 
    }
  },

  // Score for AI decision engine: -20 to +20
  getMacroSignal(macro) {
    try {
      if (!macro?.live) return { score: 0, signal: 0, description: "Macro data unavailable" };
      let score = 0;
      const reasons = [];

      const sp = macro.sp500?.change || 0;
      const dx = macro.dxy?.change || 0;
      const gl = macro.gold?.change || 0;

      // S&P correlation (BTC follows risk appetite)
      if (sp > 1) { score += 8; reasons.push("S&P strong +" + fx(sp, 1) + "%"); }
      else if (sp > 0.3) { score += 4; reasons.push("S&P green +" + fx(sp, 1) + "%"); }
      else if (sp < -1) { score -= 8; reasons.push("S&P weak " + fx(sp, 1) + "%"); }
      else if (sp < -0.3) { score -= 4; reasons.push("S&P red " + fx(sp, 1) + "%"); }

      // DXY inverse correlation (strong dollar = bad for BTC)
      if (dx > 0.5) { score -= 6; reasons.push("DXY rising +" + fx(dx, 1) + "% (headwind)"); }
      else if (dx < -0.5) { score += 6; reasons.push("DXY falling " + fx(dx, 1) + "% (tailwind)"); }

      // Gold (mixed correlation - both safe havens)
      if (gl > 1.5) { score += 3; reasons.push("Gold surge +" + fx(gl, 1) + "%"); }
      else if (gl < -1.5) { score -= 3; reasons.push("Gold drop " + fx(gl, 1) + "%"); }

      const signal = clamp(score / 20, -1, 1);
      return { score, signal, reasons, regime: macro.regime, description: reasons.join(" | ") || "Macro neutral" };
    } catch { return { score: 0, signal: 0, reasons: [], regime: "NEUTRAL", description: "Macro error" }; }
  },
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  ON-CHAIN INTELLIGENCE ENGINE                                ║
// ║  Whale movements, exchange flows, mempool stress             ║
// ║  APIs: Blockchain.info, Mempool.space (all free, no key)     ║
// ╚══════════════════════════════════════════════════════════════╝
const OnChainEngine = {
  _cache: { whales: null, mempool: null, exchangeFlow: null, timestamp: 0 },
  _interval: 120000, // 2 min cache

  async fetchAll() {
    try {
      const now = Date.now();
      if (now - this._cache.timestamp < this._interval && this._cache.whales) return this._cache;

      const [whales, mempool, exchangeFlow] = await Promise.allSettled([
        this._fetchWhaleActivity(),
        this._fetchMempool(),
        this._fetchExchangeFlow(),
      ]);

      this._cache = {
        whales: whales.status === "fulfilled" ? whales.value : this._cache.whales || this._fallbackWhales(),
        mempool: mempool.status === "fulfilled" ? mempool.value : this._cache.mempool || this._fallbackMempool(),
        exchangeFlow: exchangeFlow.status === "fulfilled" ? exchangeFlow.value : this._cache.exchangeFlow || this._fallbackExchangeFlow(),
        timestamp: now,
        live: whales.status === "fulfilled" || mempool.status === "fulfilled",
      };
      return this._cache;
    } catch { return { ...this._cache, live: false }; }
  },

  // Whale activity via Blockchain.info recent blocks
  async _fetchWhaleActivity() {
    try {
      const proxies = CORS_PROXIES.filter(Boolean);
      let data = null;

      for (const proxy of proxies) {
        try {
          const url = proxy + encodeURIComponent("https://blockchain.info/latestblock");
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (r.ok) { data = await r.json(); break; }
        } catch { continue; }
      }

      if (!data) return this._fallbackWhales();

      // Fetch recent unconfirmed transactions stats from mempool.space (supports CORS)
      let unconfirmed = null;
      for (const proxy of ["", ...proxies]) {
        try {
          const target = "https://mempool.space/api/mempool";
          const url = proxy ? proxy + encodeURIComponent(target) : target;
          const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (r.ok) { const mp = await r.json(); unconfirmed = mp.count || mp.vsize ? Math.round((mp.vsize || 0) / 250) : null; if (mp.count) unconfirmed = mp.count; break; }
        } catch { continue; }
      }

      // Large tx indicator from block index
      const blockHeight = data.height || 0;
      const blockHash = data.hash || "";
      const txCount = data.txIndexes?.length || data.n_tx || 0;

      // Whale heuristic: high tx count in latest block = high activity
      const whaleScore = txCount > 3500 ? 30 : txCount > 2500 ? 20 : txCount > 1500 ? 10 : 0;
      const activity = txCount > 3000 ? "VERY HIGH" : txCount > 2000 ? "HIGH" : txCount > 1000 ? "MODERATE" : "LOW";

      // Pending tx congestion
      const pendingPressure = unconfirmed ? (unconfirmed > 200000 ? "EXTREME" : unconfirmed > 100000 ? "HIGH" : unconfirmed > 50000 ? "MODERATE" : "LOW") : "UNKNOWN";

      return {
        blockHeight,
        txCount,
        unconfirmed: unconfirmed || 0,
        whaleScore,
        activity,
        pendingPressure,
        live: true,
        signal: whaleScore > 20 ? "BULLISH" : whaleScore > 10 ? "NEUTRAL" : "CAUTIOUS",
      };
    } catch { return this._fallbackWhales(); }
  },

  // Mempool stress via Mempool.space API
  async _fetchMempool() {
    try {
      const proxies = ["", ...CORS_PROXIES.filter(Boolean)];
      let fees = null;

      for (const proxy of proxies) {
        try {
          const target = "https://mempool.space/api/v1/fees/recommended";
          const url = proxy ? proxy + encodeURIComponent(target) : target;
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (r.ok) { fees = await r.json(); break; }
        } catch { continue; }
      }

      if (!fees) return this._fallbackMempool();

      const fastest = fees.fastestFee || 0;
      const halfHour = fees.halfHourFee || 0;
      const hour = fees.hourFee || 0;
      const economy = fees.economyFee || 0;
      const minimum = fees.minimumFee || 1;

      // Fee stress analysis
      const feeRatio = fastest / Math.max(economy, 1);
      const stress = feeRatio > 10 ? "EXTREME" : feeRatio > 5 ? "HIGH" : feeRatio > 2.5 ? "ELEVATED" : "NORMAL";

      // Trading signal from mempool stress
      // High fees = network congestion = often precedes big moves
      const mempoolScore = fastest > 100 ? 15 : fastest > 50 ? 8 : fastest > 20 ? 3 : 0;

      return {
        fastestFee: fastest,
        halfHourFee: halfHour,
        hourFee: hour,
        economyFee: economy,
        feeRatio: feeRatio,
        stress,
        mempoolScore,
        live: true,
        signal: stress === "EXTREME" ? "HIGH ACTIVITY" : stress === "HIGH" ? "ACTIVE" : "NORMAL",
      };
    } catch { return this._fallbackMempool(); }
  },

  // Exchange flow estimation via Blockchain.info hash rate + difficulty
  async _fetchExchangeFlow() {
    try {
      const proxies = CORS_PROXIES.filter(Boolean);
      let hashRate = null;
      let difficulty = null;

      for (const proxy of proxies) {
        try {
          const url = proxy + encodeURIComponent("https://blockchain.info/q/hashrate");
          const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (r.ok) { hashRate = parseFloat(await r.text()); break; }
        } catch { continue; }
      }

      for (const proxy of proxies) {
        try {
          const url = proxy + encodeURIComponent("https://blockchain.info/q/getdifficulty");
          const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (r.ok) { difficulty = parseFloat(await r.text()); break; }
        } catch { continue; }
      }

      // Hash rate health: growing = miners confident = bullish
      // We can't get historical easily, but high absolute values are positive
      const hrTH = hashRate ? hashRate / 1e9 : 0; // Convert to TH/s approx
      const diffT = difficulty ? difficulty / 1e12 : 0;

      // Network health score
      const healthScore = hrTH > 500 ? 10 : hrTH > 300 ? 5 : 0;

      return {
        hashRate: hrTH,
        difficulty: diffT,
        healthScore,
        minerConfidence: hrTH > 400 ? "STRONG" : hrTH > 200 ? "HEALTHY" : "WEAK",
        live: hashRate !== null,
        signal: healthScore > 5 ? "BULLISH" : "NEUTRAL",
      };
    } catch { return this._fallbackExchangeFlow(); }
  },

  // Combined on-chain signal for AI decision
  getOnChainSignal(data) {
    try {
      if (!data) return { score: 0, signal: 0, reasons: [], description: "No on-chain data" };
      const w = data.whales || {};
      const m = data.mempool || {};
      const e = data.exchangeFlow || {};

      let score = 0;
      const reasons = [];

      // Whale activity
      if (w.whaleScore > 20) { score += 8; reasons.push("Whale activity VERY HIGH (" + w.txCount + " txs)"); }
      else if (w.whaleScore > 10) { score += 4; reasons.push("Whale activity elevated (" + w.txCount + " txs)"); }

      // Mempool stress (high stress can precede big moves — be cautious)
      if (m.stress === "EXTREME") { score -= 5; reasons.push("Mempool EXTREME (" + m.fastestFee + " sat/vB) — volatility incoming"); }
      else if (m.stress === "HIGH") { score -= 2; reasons.push("Mempool stressed (" + m.fastestFee + " sat/vB)"); }
      else if (m.stress === "NORMAL" && m.live) { score += 2; reasons.push("Mempool clear (" + m.fastestFee + " sat/vB)"); }

      // Pending transactions pressure
      if (w.unconfirmed > 150000) { score -= 3; reasons.push("Pending txs: " + (w.unconfirmed / 1000).toFixed(0) + "K (congested)"); }

      // Network health (hash rate / miners)
      if (e.healthScore > 5) { score += 4; reasons.push("Network health: " + e.minerConfidence); }
      else if (e.live) { score += 1; reasons.push("Hash rate: " + e.hashRate.toFixed(0) + " TH/s"); }

      const signal = clamp(score / 15, -1, 1);
      return { score, signal, reasons, description: reasons.join(" | ") || "On-chain neutral", live: data.live || false };
    } catch { return { score: 0, signal: 0, reasons: [], description: "On-chain error", live: false }; }
  },

  _fallbackWhales() { return { blockHeight: 0, txCount: 0, unconfirmed: 0, whaleScore: 0, activity: "UNKNOWN", pendingPressure: "UNKNOWN", live: false, signal: "OFFLINE" }; },
  _fallbackMempool() { return { fastestFee: 0, halfHourFee: 0, hourFee: 0, economyFee: 0, feeRatio: 1, stress: "UNKNOWN", mempoolScore: 0, live: false, signal: "OFFLINE" }; },
  _fallbackExchangeFlow() { return { hashRate: 0, difficulty: 0, healthScore: 0, minerConfidence: "UNKNOWN", live: false, signal: "OFFLINE" }; },
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  LLM BRAIN ENGINE v2 — DUAL PROVIDER (Groq + Gemini)          ║
// ║  Smart change detection — only calls when market shifts        ║
// ║  Groq primary: 30 RPM / 14,400 RPD (6x more than Gemini)     ║
// ║  Gemini fallback: 15 RPM / 1,500 RPD                         ║
// ║  Adaptive intervals: 45s volatile → 180s ranging              ║
// ╚══════════════════════════════════════════════════════════════════╝
const LLMEngine = {
  _lastCall: 0,
  _cache: null,
  _consecutiveErrors: 0,
  _maxErrors: 5,
  _lastError: "",
  _backoffUntil: 0,
  _lastSnapshot: null,
  _callCount: 0,
  _skippedCount: 0,
  _provider: "groq",
  _quotaHits: { groq: 0, gemini: 0 },
  _keyInvalid: { groq: false, gemini: false },
  _models: ["gemini-2.0-flash-lite", "gemini-2.0-flash"], // kept for TradeJournal compat
  _modelIdx: 0,

  _providers: {
    groq: { name: "Groq", model: "llama-3.3-70b-versatile", fallback: "llama-3.1-8b-instant", minInterval: 30000 },
    gemini: { name: "Gemini", model: "gemini-2.0-flash-lite", fallback: "gemini-2.0-flash", minInterval: 60000 },
  },

  // Adaptive interval based on market state
  getNextInterval(aiResult) {
    const regime = aiResult?.analysis?.regime || "ranging";
    if (regime === "volatile" || regime === "breakout") return 45000;
    if (aiResult?.action !== "WAIT") return 60000;
    if (regime === "trending") return 90000;
    return 180000; // Ranging/idle — save calls
  },

  // Smart change detection — THE KEY OPTIMIZATION (60-80% call reduction)
  _hasChanged(aiResult, price, fgData, macroData) {
    const s = this._lastSnapshot;
    if (!s) return true; // First call always runs
    if (Math.abs(price - s.price) / s.price > 0.003) return true; // >0.3% price move
    if (aiResult?.action !== s.action) return true; // Signal flipped
    if (Math.abs((aiResult?.confidence || 0) - s.confidence) > 15) return true; // Big confidence shift
    if (aiResult?.analysis?.regime !== s.regime) return true; // Regime changed
    if (Math.abs((fgData?.value || 0) - s.fg) > 10) return true; // Fear & Greed shifted
    if (macroData?.regime !== s.macroRegime) return true; // Macro changed
    const rsi = aiResult?.indicators?.rsi || 50;
    if ((rsi > 70 && s.rsi <= 70) || (rsi < 30 && s.rsi >= 30) || (rsi <= 70 && s.rsi > 70) || (rsi >= 30 && s.rsi < 30)) return true; // RSI crossed key levels
    return false; // Nothing meaningful changed — serve cache
  },

  _saveSnapshot(aiResult, price, fgData, macroData) {
    this._lastSnapshot = { price, action: aiResult?.action, confidence: aiResult?.confidence || 0, regime: aiResult?.analysis?.regime, fg: fgData?.value || 0, macroRegime: macroData?.regime, rsi: aiResult?.indicators?.rsi || 50, time: Date.now() };
  },

  buildPrompt(aiResult, candles, currentPrice, symbol, fgData, redditData, macroData, brainStats, balance, history, mtfData) {
    try {
      const recent = (history || []).slice(0, 10);
      const recentWins = recent.filter(h => h.net > 0).length;
      const recentLosses = recent.filter(h => h.net <= 0).length;
      const ind = aiResult?.indicators || {};
      const fg = fgData || {};
      const macro = macroData || {};
      const mtf = mtfData && mtfData.combined && mtfData.combined.valid ? mtfData.combined : null;
      const mtfStr = mtf ? `MTF:${mtf.trend} ${mtf.strength}% ${mtf.aligned?"ALIGNED":""} (${(mtfData.combined.details||[]).map(d=>`${d.tf}:${d.dir}`).join(" ")})` : "MTF:loading";
      return `BTC trading analyst. JSON only.

${symbol} $${currentPrice.toFixed(0)} RSI:${ind.rsi?.toFixed(0)||"?"} MACD:${ind.macd?.toFixed(1)||"?"} EMA9v21:${currentPrice>(ind.ema9||0)?"above":"below"} BB:${ind.bbPos?.toFixed(1)||"?"} Vol:${ind.volRatio?.toFixed(1)||"?"}x ${aiResult?.analysis?.regime||"?"}
Signal:${aiResult?.action||"WAIT"} ${aiResult?.confidence?.toFixed(0)||0}% | F&G:${fg.value||"?"} ${fg.label||""} | Macro:${macro.regime||"?"} | Bias:${ind.marketBias||"neutral"} | ${mtfStr} | Bal:$${balance?.toFixed(0)||100} ${recentWins}W/${recentLosses}L
${brainStats?.brainSize > 0 ? `Brain:${brainStats.brainSize} WR:${brainStats.totalWins+brainStats.totalLosses>0?((brainStats.totalWins/(brainStats.totalWins+brainStats.totalLosses))*100).toFixed(0):"0"}%` : ""}
Fee:0.4% RT. Trade ONLY if move>0.6%. In bear markets, prefer shorts over contrarian longs. When MTF is ALIGNED, trade WITH the higher timeframe trend.

{"action":"LONG|SHORT|WAIT","confidence":0-100,"reasoning":"1 sentence","risks":"brief","conviction":"HIGH|MEDIUM|LOW","override":false,"adjustConfidence":0}`;
    } catch { return null; }
  },

  async _callGroq(prompt, apiKey) {
    const cfg = this._providers.groq;
    const model = this._consecutiveErrors >= 2 ? cfg.fallback : cfg.model;
    const key = apiKey.trim();
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: "You are a Bitcoin trading analyst. Respond ONLY with valid JSON, no markdown." }, { role: "user", content: prompt }], temperature: 0.3, max_tokens: 150, response_format: { type: "json_object" } }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`Groq ${res.status}: key=${key.substring(0,8)}...${key.substring(key.length-4)} len=${key.length} body=${errBody.substring(0,200)}`);
      throw { code: res.status, provider: "groq" };
    }
    const data = await res.json();
    return { text: data?.choices?.[0]?.message?.content || "", model, provider: "groq" };
  },

  async _callGemini(prompt, apiKey) {
    const cfg = this._providers.gemini;
    const model = this._consecutiveErrors >= 2 ? cfg.fallback : cfg.model;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 150 } }),
    });
    if (!res.ok) throw { code: res.status, provider: "gemini" };
    const data = await res.json();
    return { text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "", model, provider: "gemini" };
  },

  async analyze(aiResult, candles, currentPrice, symbol, fgData, redditData, macroData, brainStats, balance, history, geminiKey, groqKey, mtfData) {
    try {
      const hasGroq = !!groqKey, hasGemini = !!geminiKey;
      if (!hasGroq && !hasGemini) return this.getFallback();
      const now = Date.now();

      // Backoff active — return cache silently
      if (now < this._backoffUntil) return this._cache?.live ? this._cache : this.getFallback();

      // Min interval per provider
      const minInt = this._providers[this._provider]?.minInterval || 60000;
      if (now - this._lastCall < minInt) return this._cache || this.getFallback();

      // ═══ SMART CHANGE DETECTION — skip if nothing meaningful changed ═══
      if (!this._hasChanged(aiResult, currentPrice, fgData, macroData) && this._cache?.live) {
        this._skippedCount++;
        return this._cache; // Serve cached — no API call
      }

      // Circuit breaker
      if (this._consecutiveErrors >= this._maxErrors) {
        if (now - this._lastCall < 300000) return this._cache || this.getFallback();
        this._consecutiveErrors = 0;
      }

      const prompt = this.buildPrompt(aiResult, candles, currentPrice, symbol, fgData, redditData, macroData, brainStats, balance, history, mtfData);
      if (!prompt) return this._cache || this.getFallback();

      this._lastCall = now;
      let result = null;

      // Try Groq first (30 RPM, 14,400/day — 6x more generous)
      if (hasGroq && this._quotaHits.groq < 3 && !this._keyInvalid.groq) {
        try { result = await this._callGroq(prompt, groqKey); this._provider = "groq"; this._quotaHits.groq = 0; }
        catch (e) { if (e.code === 401 || e.code === 403) { this._keyInvalid.groq = true; this._lastError = "Groq key invalid - update in Settings"; console.error("Groq key invalid (" + e.code + ") - stopped retrying"); } else if (e.code === 429) this._quotaHits.groq++; }
      }
      // Fallback to Gemini (15 RPM, 1,500/day)
      if (!result && hasGemini && this._quotaHits.gemini < 3 && !this._keyInvalid.gemini) {
        try { result = await this._callGemini(prompt, geminiKey); this._provider = "gemini"; this._quotaHits.gemini = 0; }
        catch (e) { if (e.code === 401 || e.code === 403) { this._keyInvalid.gemini = true; this._lastError = "Gemini key invalid - update in Settings"; console.error("Gemini key invalid (" + e.code + ") - stopped retrying"); } else if (e.code === 429) this._quotaHits.gemini++; }
      }

      if (!result) {
        const allInvalid = (this._keyInvalid.groq || !hasGroq) && (this._keyInvalid.gemini || !hasGemini);
        if (allInvalid) {
          this._lastError = "API key(s) invalid - update in Settings";
          this._backoffUntil = now + 300000; // stop hammering, wait 5 min
          return { ...this.getFallback(), error: this._lastError };
        }
        const backoff = Math.min(300000, 60000 * Math.pow(2, Math.max(this._quotaHits.groq, this._quotaHits.gemini)));
        this._backoffUntil = now + backoff;
        this._consecutiveErrors++;
        if (this._cache?.live) return this._cache;
        this._lastError = `All providers rate-limited - retry ${Math.round(backoff/1000)}s`;
        return { ...this.getFallback(), error: this._lastError };
      }

      const parsed = this.parseResponse(result.text);
      if (!parsed) { this._consecutiveErrors++; this._lastError = "Parse error"; return this._cache?.live ? this._cache : { ...this.getFallback(), error: this._lastError }; }

      // Success — reset everything
      this._consecutiveErrors = 0;
      this._lastError = "";
      this._backoffUntil = 0;
      this._callCount++;
      this._saveSnapshot(aiResult, currentPrice, fgData, macroData);
      this._cache = { ...parsed, timestamp: now, model: result.model, provider: result.provider, latency: Date.now() - now, live: true };
      return this._cache;
    } catch(e) {
      this._consecutiveErrors++;
      if (this._cache?.live) return this._cache;
      this._lastError = e?.message || "Network error";
      return { ...this.getFallback(), error: this._lastError };
    }
  },

  parseResponse(text) {
    try { return this.validateResult(JSON.parse(text)); } catch {
      try { const m = text.match(/\{[\s\S]*?\}/); if (m) return this.validateResult(JSON.parse(m[0])); } catch {}
      return null;
    }
  },

  validateResult(json) {
    try {
      return {
        action: ["LONG", "SHORT", "WAIT"].includes(json.action) ? json.action : "WAIT",
        confidence: clamp(Number(json.confidence) || 0, 0, 100),
        reasoning: String(json.reasoning || "No reasoning provided").slice(0, 500),
        risks: String(json.risks || "").slice(0, 300),
        conviction: ["HIGH", "MEDIUM", "LOW"].includes(json.conviction) ? json.conviction : "LOW",
        override: Boolean(json.override),
        adjustConfidence: clamp(Number(json.adjustConfidence) || 0, -20, 20),
      };
    } catch { return null; }
  },

  applyToDecision(aiResult, llmResult) {
    try {
      if (!llmResult || !aiResult) return aiResult;
      const modified = { ...aiResult };
      if (llmResult.adjustConfidence) modified.confidence = clamp(modified.confidence + llmResult.adjustConfidence, 0, 95);
      if (llmResult.override) {
        if (llmResult.action === "WAIT" && modified.action !== "WAIT") {
          modified.action = "WAIT";
          modified.reasons = ["LLM VETO: " + llmResult.reasoning, ...modified.reasons];
        } else if (modified.action === "WAIT" && llmResult.action !== "WAIT" && llmResult.confidence >= 75 && llmResult.conviction === "HIGH") {
          modified.action = llmResult.action;
          modified.confidence = Math.min(llmResult.confidence, 70);
          modified.reasons = ["LLM SIGNAL: " + llmResult.reasoning, ...modified.reasons];
        }
      }
      modified.llmResult = llmResult;
      modified.llmActive = true;
      return modified;
    } catch { return aiResult; }
  },

  getStatus() {
    return { provider: this._provider, name: this._providers[this._provider]?.name || "—", calls: this._callCount, skipped: this._skippedCount, errors: this._consecutiveErrors, lastError: this._lastError, isBackoff: Date.now() < this._backoffUntil, backoffSec: Math.max(0, Math.ceil((this._backoffUntil - Date.now()) / 1000)), quotaHits: { ...this._quotaHits }, hasCache: !!this._cache?.live };
  },

  getFallback() {
    return { action: "WAIT", confidence: 0, reasoning: "LLM not connected", risks: "", conviction: "LOW", override: false, adjustConfidence: 0, live: false, timestamp: 0 };
  },
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  DRAWDOWN ESCALATION — 4-Tier Risk Management                  ║
// ║  NORMAL → CAUTIOUS → RECOVERY → EMERGENCY                     ║
// ╚══════════════════════════════════════════════════════════════════╝
const DrawdownManager = {
  TIERS: [
    { name: "NORMAL",    threshold: 0,  riskMult: 1.0,  minConf: 0,  color: "#00e676", desc: "Full trading capacity" },
    { name: "CAUTIOUS",  threshold: 5,  riskMult: 0.5,  minConf: 72, color: "#ffd740", desc: "Reduced size, higher bar" },
    { name: "RECOVERY",  threshold: 10, riskMult: 0.25, minConf: 80, color: "#ff9100", desc: "Minimal size, only A+ setups" },
    { name: "EMERGENCY", threshold: 15, riskMult: 0.0,  minConf: 99, color: "#ff1744", desc: "Trading PAUSED — protect capital" },
  ],

  calculate(balance, peakBalance) {
    try {
      const peak = Math.max(peakBalance || 100, balance);
      const drawdownPct = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
      let tier = this.TIERS[0];
      for (let i = this.TIERS.length - 1; i >= 0; i--) {
        if (drawdownPct >= this.TIERS[i].threshold) { tier = this.TIERS[i]; break; }
      }
      return { drawdownPct, peak, tier, isRestricted: tier.name !== "NORMAL", isPaused: tier.name === "EMERGENCY" };
    } catch { return { drawdownPct: 0, peak: peakBalance || 100, tier: this.TIERS[0], isRestricted: false, isPaused: false }; }
  },

  applyToTrade(riskPct, confidence, drawdownState) {
    try {
      if (!drawdownState || !drawdownState.tier) return { adjustedRisk: riskPct, blocked: false, reason: "" };
      const t = drawdownState.tier;
      if (t.name === "EMERGENCY") return { adjustedRisk: 0, blocked: true, reason: `EMERGENCY: ${drawdownState.drawdownPct.toFixed(1)}% drawdown — trading paused` };
      if (confidence < t.minConf) return { adjustedRisk: 0, blocked: true, reason: `${t.name}: conf ${confidence}% < required ${t.minConf}%` };
      return { adjustedRisk: riskPct * t.riskMult, blocked: false, reason: t.name !== "NORMAL" ? `${t.name}: risk reduced to ${(t.riskMult * 100).toFixed(0)}%` : "" };
    } catch { return { adjustedRisk: riskPct, blocked: false, reason: "" }; }
  }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  AI TRADE JOURNAL — LLM-Powered Performance Coaching           ║
// ║  Analyzes trades, finds patterns, gives actionable advice      ║
// ╚══════════════════════════════════════════════════════════════════╝
const TradeJournal = {
  _reports: [],
  _lastGenerated: 0,

  init() {
    try {
      const saved = localStorage.getItem("nexus7_journal");
      if (saved) this._reports = JSON.parse(saved);
    } catch { this._reports = []; }
  },

  _save() {
    try { localStorage.setItem("nexus7_journal", JSON.stringify(this._reports.slice(0, 50))); DB._dirty.add("journal"); } catch {}
  },

  buildReportPrompt(history, stats, balance, startBalance, brainStats) {
    try {
      const last24h = history.filter(h => {
        const age = Date.now() - new Date(h.exitTime).getTime();
        return age < 86400000;
      });
      const wins = last24h.filter(h => h.net > 0);
      const losses = last24h.filter(h => h.net <= 0);
      const totalPnl = last24h.reduce((a, h) => a + h.net, 0);
      const totalFees = last24h.reduce((a, h) => a + (h.totalFees || 0), 0);
      const totalSlippage = last24h.reduce((a, h) => a + (h.totalSlippage || 0), 0);
      const avgHold = last24h.length > 0 ? last24h.reduce((a, h) => {
        const entry = h.entryTime || h.time;
        if (!entry || !h.exitTime) return a;
        const ms = new Date(h.exitTime).getTime() - new Date(entry).getTime();
        return a + (ms > 0 ? ms / 60000 : 0);
      }, 0) / last24h.length : 0;

      const byPair = {};
      last24h.forEach(h => {
        if (!byPair[h.pairName]) byPair[h.pairName] = { wins: 0, losses: 0, pnl: 0 };
        if (h.net > 0) byPair[h.pairName].wins++;
        else byPair[h.pairName].losses++;
        byPair[h.pairName].pnl += h.net;
      });

      const bySide = { LONG: { w: 0, l: 0, pnl: 0 }, SHORT: { w: 0, l: 0, pnl: 0 } };
      last24h.forEach(h => {
        const s = bySide[h.side] || bySide.LONG;
        if (h.net > 0) s.w++; else s.l++;
        s.pnl += h.net;
      });

      const byReason = {};
      last24h.forEach(h => {
        const r = h.reason || "Unknown";
        if (!byReason[r]) byReason[r] = { count: 0, pnl: 0, totalHold: 0 };
        byReason[r].count++;
        byReason[r].pnl += h.net;
        const entry = h.entryTime || h.time;
        if (entry && h.exitTime) {
          const ms = new Date(h.exitTime).getTime() - new Date(entry).getTime();
          if (ms > 0) byReason[r].totalHold += ms / 60000;
        }
      });
      Object.values(byReason).forEach(v => { v.avgHold = v.count > 0 ? v.totalHold / v.count : 0; });

      const biggestWin = wins.sort((a, b) => b.net - a.net)[0];
      const biggestLoss = losses.sort((a, b) => a.net - b.net)[0];

      return `You are a crypto trading coach. Analyze this 24h trading session and provide actionable coaching.

SESSION SUMMARY:
- Total trades: ${last24h.length} (${wins.length}W / ${losses.length}L)
- Win rate: ${last24h.length > 0 ? ((wins.length / last24h.length) * 100).toFixed(1) : 0}%
- Net P&L: $${totalPnl.toFixed(2)}
- Total fees: $${totalFees.toFixed(2)}
- Total slippage: $${totalSlippage.toFixed(2)}
- Avg hold time: ${avgHold.toFixed(1)} minutes
- Account: $${balance.toFixed(2)} (started: $${startBalance || 100})
- Brain patterns learned: ${brainStats?.patterns || 0}

STREAK ANALYSIS:
${(() => {
  let maxWin = 0, maxLoss = 0, curW = 0, curL = 0;
  last24h.forEach(h => {
    if (h.net > 0) { curW++; curL = 0; maxWin = Math.max(maxWin, curW); }
    else { curL++; curW = 0; maxLoss = Math.max(maxLoss, curL); }
  });
  return `- Max consecutive wins: ${maxWin}\n- Max consecutive losses: ${maxLoss}\n- Current streak: ${curW > 0 ? curW + " wins" : curL > 0 ? curL + " losses" : "even"}`;
})()}

BY PAIR:
${Object.entries(byPair).map(([k, v]) => `- ${k}: ${v.wins}W/${v.losses}L, $${v.pnl.toFixed(2)}`).join("\n")}

BY DIRECTION:
- LONG: ${bySide.LONG.w}W/${bySide.LONG.l}L, $${bySide.LONG.pnl.toFixed(2)}
- SHORT: ${bySide.SHORT.w}W/${bySide.SHORT.l}L, $${bySide.SHORT.pnl.toFixed(2)}

EXIT REASONS:
${Object.entries(byReason).map(([k, v]) => `- ${k}: ${v.count}x, $${v.pnl.toFixed(2)}, avg hold: ${v.avgHold.toFixed(1)}min`).join("\n")}

${biggestWin ? `BEST TRADE: ${biggestWin.side} ${biggestWin.pairName} +$${biggestWin.net.toFixed(2)} (${biggestWin.pct.toFixed(1)}%)` : ""}
${biggestLoss ? `WORST TRADE: ${biggestLoss.side} ${biggestLoss.pairName} $${biggestLoss.net.toFixed(2)} (${biggestLoss.pct.toFixed(1)}%)` : ""}

ALL-TIME STATS:
- Total trades: ${stats.total} | Win rate: ${stats.winRate.toFixed(1)}%
- Avg win: $${stats.avgWin.toFixed(2)} | Avg loss: $${stats.avgLoss.toFixed(2)}
- Profit factor: ${stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}

Respond in this EXACT JSON format:
{
  "grade": "A/B/C/D/F",
  "summary": "2-3 sentence performance summary",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["specific actionable rec 1", "rec 2", "rec 3"],
  "riskAssessment": "1-2 sentence risk evaluation",
  "focusArea": "single most important thing to improve next session"
}`;
    } catch { return null; }
  },

  async generateReport(history, stats, balance, startBalance, brainStats, geminiKey, groqKey) {
    try {
      if (!geminiKey && !groqKey) return { error: "No LLM key — add Groq or Gemini key in Settings to enable AI coaching" };
      if (Date.now() - this._lastGenerated < 60000) return this._reports[0] || { error: "Rate limited — wait 1 minute" };
      if (LLMEngine._backoffUntil > Date.now()) return this._reports[0] || { error: "Quota cooldown — try again in " + Math.ceil((LLMEngine._backoffUntil - Date.now())/1000) + "s" };

      const prompt = this.buildReportPrompt(history, stats, balance, startBalance, brainStats);
      if (!prompt) return { error: "Not enough trade data for analysis" };

      let text = "";
      // Try Groq first (more generous quota)
      if (groqKey) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey.trim()}` },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: "You are a trading coach. Respond ONLY with valid JSON." }, { role: "user", content: prompt }], temperature: 0.4, max_tokens: 800, response_format: { type: "json_object" } }),
          });
          if (res.ok) { const d = await res.json(); text = d?.choices?.[0]?.message?.content || ""; }
          else if (res.status === 401 || res.status === 403) { LLMEngine._keyInvalid.groq = true; console.error("Groq key invalid in report"); }
          else if (res.status === 429) LLMEngine._backoffUntil = Date.now() + 90000;
        } catch {}
      }
      // Fallback to Gemini
      if (!text && geminiKey) {
        try {
          const model = LLMEngine._models[LLMEngine._modelIdx] || "gemini-2.0-flash-lite";
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 800 } })
          });
          if (res.ok) { const d = await res.json(); text = d?.candidates?.[0]?.content?.parts?.[0]?.text || ""; }
          else if (res.status === 429) { LLMEngine._backoffUntil = Date.now() + 90000; return this._reports[0] || { error: "Quota cooldown — auto-retry in 90s" }; }
          else return { error: "API " + res.status };
        } catch {}
      }

      if (!text) return this._reports[0] || { error: "No response from LLM providers" };

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this._reports[0] || { error: "Parse error — retrying next time" };

      const report = JSON.parse(jsonMatch[0]);
      report.timestamp = new Date().toISOString();
      report.tradesAnalyzed = history.filter(h => Date.now() - new Date(h.exitTime).getTime() < 86400000).length;
      report.balance = balance;

      this._reports.unshift(report);
      this._reports = this._reports.slice(0, 50);
      this._save();
      this._lastGenerated = Date.now();
      return report;
    } catch(e) { return { error: "Journal generation failed: " + (e?.message || "unknown") }; }
  },

  getReports() { return this._reports; },
  getLatest() { return this._reports[0] || null; },
  clear() { this._reports = []; this._save(); }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  PHASE 6: ML ENGINE — In-Browser Neural Network + CSV Export   ║
// ╚══════════════════════════════════════════════════════════════════╝
const MLEngine = {
  // Network architecture: 20 inputs → 16 hidden → 8 hidden → 1 output
  FEATURES: ["rsi","rsi7","macdHist","atrPct","bbWidth","volRatio","trendStr","mom5","mom20",
    "stochRSI","greenStreak","redStreak","sentiment","newsScore","fgIndex","redditScore",
    "macroScore","onChainScore","obvTrend","regime_enc"],
  LEARN_RATE: 0.03,
  MIN_SAMPLES: 30,
  RETRAIN_EVERY: 20,
  _weights: null,
  _biases: null,
  _trained: false,
  _accuracy: 0,
  _trainCount: 0,
  _lastTrainSize: 0,
  _featureImportance: null,
  _trainingLog: [],
  _epoch: 0,

  init() {
    try {
      const saved = DB.get("ml_engine", null);
      if (saved && saved.w1) {
        this._weights = { w1: saved.w1, w2: saved.w2, w3: saved.w3 };
        this._biases = { b1: saved.b1, b2: saved.b2, b3: saved.b3 };
        this._trained = saved.trained || false;
        this._accuracy = saved.accuracy || 0;
        this._trainCount = saved.trainCount || 0;
        this._lastTrainSize = saved.lastTrainSize || 0;
        this._featureImportance = saved.featureImportance || null;
        this._trainingLog = saved.trainingLog || [];
        this._epoch = saved.epoch || 0;
      } else {
        this._initWeights();
      }
    } catch { this._initWeights(); }
  },

  _initWeights() {
    const nIn = 20, nH1 = 16, nH2 = 8, nOut = 1;
    const he = (fan_in) => Math.sqrt(2 / fan_in);
    const rw = (rows, cols, scale) => Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale));
    const rb = (n) => Array.from({ length: n }, () => 0);
    this._weights = { w1: rw(nIn, nH1, he(nIn)), w2: rw(nH1, nH2, he(nH1)), w3: rw(nH2, nOut, he(nH2)) };
    this._biases = { b1: rb(nH1), b2: rb(nH2), b3: rb(nOut) };
    this._trained = false;
    this._accuracy = 0;
    this._featureImportance = null;
    this._trainingLog = [];
    this._epoch = 0;
  },

  save() {
    try {
      DB.set("ml_engine", {
        w1: this._weights.w1, w2: this._weights.w2, w3: this._weights.w3,
        b1: this._biases.b1, b2: this._biases.b2, b3: this._biases.b3,
        trained: this._trained, accuracy: this._accuracy,
        trainCount: this._trainCount, lastTrainSize: this._lastTrainSize,
        featureImportance: this._featureImportance,
        trainingLog: this._trainingLog.slice(-50),
        epoch: this._epoch,
      });
    } catch {}
  },

  // Activation functions
  _sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x)))); },
  _relu(x) { return Math.max(0, x); },
  _reluDeriv(x) { return x > 0 ? 1 : 0; },

  // Extract normalized feature vector from indicators
  extractFeatures(indicators, action, extra = {}) {
    const i = indicators || {};
    const regimeMap = { trending: 0.8, volatile: 0.2, ranging: 0.5, calm: 0.6 };
    const dirMul = action === "SHORT" ? -1 : 1;
    return [
      clamp((i.rsi || 50) / 100, 0, 1),
      clamp((i.rsi7 || 50) / 100, 0, 1),
      clamp(((i.macdHist || 0) * dirMul + 5) / 10, 0, 1),
      clamp((i.atrPct || 1) / 5, 0, 1),
      clamp((i.bbWidth || 3) / 10, 0, 1),
      clamp((i.volRatio || 1) / 5, 0, 1),
      clamp(((i.trendStr || 0) * dirMul + 10) / 20, 0, 1),
      clamp(((i.mom5 || 0) * dirMul + 5) / 10, 0, 1),
      clamp(((i.mom20 || 0) * dirMul + 10) / 20, 0, 1),
      clamp((i.stochRSI || 50) / 100, 0, 1),
      clamp((i.greenStreak || 0) / 8, 0, 1),
      clamp((i.redStreak || 0) / 8, 0, 1),
      clamp(((i.sentiment || 0) + 100) / 200, 0, 1),
      clamp(((i.newsScore || 0) + 50) / 100, 0, 1),
      clamp((extra.fgIndex || 50) / 100, 0, 1),
      clamp(((extra.redditScore || 0) + 50) / 100, 0, 1),
      clamp(((extra.macroScore || 0) + 30) / 60, 0, 1),
      clamp(((extra.onChainScore || 0) + 30) / 60, 0, 1),
      clamp((i.obvTrend === "up" ? 0.8 : i.obvTrend === "down" ? 0.2 : 0.5), 0, 1),
      regimeMap[i.regime] || 0.5,
    ];
  },

  // Forward pass
  _forward(input) {
    const { w1, w2, w3 } = this._weights;
    const { b1, b2, b3 } = this._biases;
    // Layer 1: input → hidden1 (ReLU)
    const h1 = b1.map((b, j) => {
      let sum = b;
      for (let k = 0; k < input.length; k++) sum += input[k] * (w1[k]?.[j] || 0);
      return this._relu(sum);
    });
    // Layer 2: hidden1 → hidden2 (ReLU)
    const h2 = b2.map((b, j) => {
      let sum = b;
      for (let k = 0; k < h1.length; k++) sum += h1[k] * (w2[k]?.[j] || 0);
      return this._relu(sum);
    });
    // Output: hidden2 → output (Sigmoid)
    let out = b3[0];
    for (let k = 0; k < h2.length; k++) out += h2[k] * (w3[k]?.[0] || 0);
    return { h1, h2, output: this._sigmoid(out) };
  },

  // Backpropagation for one sample
  _backward(input, target, lr) {
    const { w1, w2, w3 } = this._weights;
    const { b1, b2, b3 } = this._biases;
    const { h1, h2, output } = this._forward(input);

    // Output gradient
    const dOut = (output - target) * output * (1 - output);

    // Hidden2 gradients
    const dH2 = h2.map((v, j) => dOut * (w3[j]?.[0] || 0) * this._reluDeriv(v));

    // Hidden1 gradients
    const dH1 = h1.map((v, j) => {
      let sum = 0;
      for (let k = 0; k < dH2.length; k++) sum += dH2[k] * (w2[j]?.[k] || 0);
      return sum * this._reluDeriv(v);
    });

    // Update w3, b3
    for (let k = 0; k < h2.length; k++) {
      if (!w3[k]) w3[k] = [0];
      w3[k][0] -= lr * dOut * h2[k];
    }
    b3[0] -= lr * dOut;

    // Update w2, b2
    for (let j = 0; j < dH2.length; j++) {
      b2[j] -= lr * dH2[j];
      for (let k = 0; k < h1.length; k++) {
        if (!w2[k]) w2[k] = [];
        if (w2[k][j] === undefined) w2[k][j] = 0;
        w2[k][j] -= lr * dH2[j] * h1[k];
      }
    }

    // Update w1, b1
    for (let j = 0; j < dH1.length; j++) {
      b1[j] -= lr * dH1[j];
      for (let k = 0; k < input.length; k++) {
        if (!w1[k]) w1[k] = [];
        if (w1[k][j] === undefined) w1[k][j] = 0;
        w1[k][j] -= lr * dH1[j] * input[k];
      }
    }
  },

  // Build training data from Brain's win/loss history
  _buildTrainingData() {
    const data = [];
    const wins = Brain.wins || [];
    const losses = Brain.losses || [];
    for (const w of wins) {
      if (!w.fp || w.fp === "unknown") continue;
      const features = this.extractFeatures(
        this._indicatorsFromEntry(w),
        w.action || "LONG",
        {}
      );
      data.push({ x: features, y: 1, profit: w.profit || 0 });
    }
    for (const l of losses) {
      if (!l.fp || l.fp === "unknown") continue;
      const features = this.extractFeatures(
        this._indicatorsFromEntry(l),
        l.action || "LONG",
        {}
      );
      data.push({ x: features, y: 0, loss: l.loss || 0 });
    }
    return data;
  },

  // Reconstruct approximate indicators from Brain entry (fingerprint + stored data)
  _indicatorsFromEntry(entry) {
    if (entry.indicators) return entry.indicators;
    // Parse from fingerprint if indicators not stored
    const parts = (entry.fp || "").split("|");
    const rsiMatch = (parts[2] || "").match(/rsi(\d+)/);
    const volMatch = (parts[4] || "").match(/vol(\w+)/);
    const atrMatch = (parts[5] || "").match(/atr(\w+)/);
    const trendMatch = (parts[7] || "").match(/trend(\w+)/);
    const regimeMatch = (parts[8] || "").match(/regime(\w+)/);
    const volMap = { XH: 3, H: 2, N: 1, L: 0.4 };
    const atrMap = { XH: 3.5, H: 1.8, N: 0.8, L: 0.3 };
    const trendMap = { SU: 5, U: 2, F: 0, D: -2, SD: -5 };
    return {
      rsi: rsiMatch ? parseInt(rsiMatch[1]) : 50,
      rsi7: 50,
      macdHist: 0,
      atrPct: atrMap[atrMatch?.[1]] || 1,
      bbWidth: 3,
      volRatio: volMap[volMatch?.[1]] || 1,
      trendStr: trendMap[trendMatch?.[1]] || 0,
      mom5: 0, mom20: 0,
      stochRSI: 50,
      greenStreak: 0, redStreak: 0,
      sentiment: 0, newsScore: 0,
      obvTrend: "flat",
      regime: regimeMatch?.[1] || "ranging",
    };
  },

  // Train the network
  train(epochs = 100) {
    const data = this._buildTrainingData();
    if (data.length < this.MIN_SAMPLES) {
      return { success: false, reason: `Need ${this.MIN_SAMPLES} trades, have ${data.length}` };
    }

    // Shuffle data
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }

    // Split: 80% train, 20% validation
    const splitIdx = Math.floor(data.length * 0.8);
    const trainSet = data.slice(0, splitIdx);
    const valSet = data.slice(splitIdx);

    let bestValAcc = 0;
    let bestWeights = null;
    let trainLoss = 0;

    for (let e = 0; e < epochs; e++) {
      // Shuffle training set each epoch
      for (let i = trainSet.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [trainSet[i], trainSet[j]] = [trainSet[j], trainSet[i]];
      }

      let epochLoss = 0;
      const lr = this.LEARN_RATE * (1 - e / epochs * 0.5); // Learning rate decay
      for (const sample of trainSet) {
        this._backward(sample.x, sample.y, lr);
        const pred = this._forward(sample.x).output;
        epochLoss += -(sample.y * Math.log(pred + 1e-8) + (1 - sample.y) * Math.log(1 - pred + 1e-8));
      }
      trainLoss = epochLoss / trainSet.length;

      // Validation accuracy every 10 epochs
      if (e % 10 === 0 && valSet.length > 0) {
        let correct = 0;
        for (const s of valSet) {
          const pred = this._forward(s.x).output;
          if ((pred >= 0.5 && s.y === 1) || (pred < 0.5 && s.y === 0)) correct++;
        }
        const valAcc = (correct / valSet.length) * 100;
        if (valAcc > bestValAcc) {
          bestValAcc = valAcc;
          bestWeights = JSON.parse(JSON.stringify({ w: this._weights, b: this._biases }));
        }
      }
      this._epoch++;
    }

    // Restore best weights
    if (bestWeights) {
      this._weights = bestWeights.w;
      this._biases = bestWeights.b;
    }

    // Final accuracy on full dataset
    let correct = 0;
    for (const s of data) {
      const pred = this._forward(s.x).output;
      if ((pred >= 0.5 && s.y === 1) || (pred < 0.5 && s.y === 0)) correct++;
    }
    this._accuracy = (correct / data.length) * 100;
    this._trained = true;
    this._trainCount++;
    this._lastTrainSize = data.length;

    // Compute feature importance (mean absolute gradient approximation)
    this._computeFeatureImportance(data.slice(0, 50));

    this._trainingLog.push({
      ts: Date.now(), epoch: this._epoch, samples: data.length,
      accuracy: +this._accuracy.toFixed(1), valAccuracy: +bestValAcc.toFixed(1),
      loss: +trainLoss.toFixed(4), wins: data.filter(d => d.y === 1).length,
      losses: data.filter(d => d.y === 0).length,
    });

    this.save();
    return {
      success: true, accuracy: this._accuracy, valAccuracy: bestValAcc,
      samples: data.length, epochs: epochs, loss: trainLoss,
    };
  },

  _computeFeatureImportance(samples) {
    const imp = new Array(20).fill(0);
    const eps = 0.01;
    for (const s of samples) {
      const baseOut = this._forward(s.x).output;
      for (let f = 0; f < 20; f++) {
        const tweaked = [...s.x];
        tweaked[f] = Math.min(1, tweaked[f] + eps);
        const newOut = this._forward(tweaked).output;
        imp[f] += Math.abs(newOut - baseOut);
      }
    }
    const maxImp = Math.max(...imp, 0.001);
    this._featureImportance = this.FEATURES.map((name, i) => ({
      name, importance: +(imp[i] / maxImp * 100).toFixed(1),
    })).sort((a, b) => b.importance - a.importance);
  },

  // Predict win probability for a trade
  predict(indicators, action, extra = {}) {
    if (!this._trained) return { probability: 0.5, confidence: 0, available: false };
    try {
      const features = this.extractFeatures(indicators, action, extra);
      const { output } = this._forward(features);
      // Confidence is how far from 0.5 the prediction is
      const confidence = Math.abs(output - 0.5) * 200;
      return {
        probability: +output.toFixed(4),
        confidence: +confidence.toFixed(1),
        signal: output >= 0.6 ? "BULLISH" : output <= 0.4 ? "BEARISH" : "NEUTRAL",
        available: true,
      };
    } catch { return { probability: 0.5, confidence: 0, available: false }; }
  },

  // Check if retrain needed
  needsRetrain() {
    const totalTrades = (Brain.wins?.length || 0) + (Brain.losses?.length || 0);
    return totalTrades >= this.MIN_SAMPLES && totalTrades - this._lastTrainSize >= this.RETRAIN_EVERY;
  },

  // Export all trade data as CSV for Colab
  exportCSV() {
    const data = this._buildTrainingData();
    if (data.length === 0) return null;
    const header = [...this.FEATURES, "outcome", "pnl"].join(",");
    const rows = data.map(d => {
      const pnl = d.y === 1 ? (d.profit || 0) : -(d.loss || 0);
      return [...d.x.map(v => v.toFixed(4)), d.y, pnl.toFixed(4)].join(",");
    });
    return header + "\n" + rows.join("\n");
  },

  // Get stats for UI
  getStats() {
    return {
      trained: this._trained,
      accuracy: +this._accuracy.toFixed(1),
      trainCount: this._trainCount,
      lastTrainSize: this._lastTrainSize,
      totalSamples: (Brain.wins?.length || 0) + (Brain.losses?.length || 0),
      minSamples: this.MIN_SAMPLES,
      featureImportance: this._featureImportance,
      trainingLog: this._trainingLog,
      epoch: this._epoch,
      needsRetrain: this.needsRetrain(),
    };
  },

  reset() {
    this._initWeights();
    this._trainCount = 0;
    this._lastTrainSize = 0;
    this._trainingLog = [];
    this.save();
  }
};

const FALLBACK_PRICES = {
  // ═══ NOTE: These are FALLBACK ONLY — hasLivePrice flag blocks all trading until real price arrives ═══
  // Updated Feb 2026 — keep roughly current to minimize damage if sanity checks fail
  BTCUSDT: { base: 98000, vol: 420 }, ETHUSDT: { base: 2700, vol: 38 },
  SOLUSDT: { base: 170, vol: 4.5 }, BNBUSDT: { base: 650, vol: 12 },
  XRPUSDT: { base: 2.60, vol: 0.06 }, DOGEUSDT: { base: 0.25, vol: 0.006 },
  ADAUSDT: { base: 0.75, vol: 0.018 }, AVAXUSDT: { base: 38.5, vol: 1.4 },
};

// ═══ COLORS ═══
const K = {
  bg: "#030510", s1: "#080b1e", s2: "#0c1028", s3: "#111537",
  bd: "#181d52", bdL: "#242a6e",
  tx: "#dde0f5", txD: "#5c6a94", txM: "#2e3458",
  up: "#00e676", upSoft: "#00e67620", upGlow: "#00e67608",
  dn: "#ff2d55", dnSoft: "#ff2d5520", dnGlow: "#ff2d5508",
  warn: "#f7931a", warnSoft: "#f7931a28",
  gold: "#ffd740", blue: "#448aff", purple: "#b388ff",
  cyan: "#18ffff", pink: "#ff80ab",
  tokyo: "#ff6b9d", london: "#4fc3f7", nyc: "#ab47bc", sydney: "#66bb6a",
};

// ═══ SAFE HELPERS (no crashes) ═══
const fx = (n, d = 2) => { try { return Number(n || 0).toFixed(d); } catch { return "0.00"; } };
const fMoney = n => { try { return (n >= 0 ? "+$" : "-$") + fx(Math.abs(n)); } catch { return "$0.00"; } };
const fPct = n => { try { return (n >= 0 ? "+" : "") + fx(n) + "%"; } catch { return "0.00%"; } };
const fShort = n => { try { const a = Math.abs(n); return a >= 1e6 ? (n/1e6).toFixed(1)+"M" : a >= 1e3 ? (n/1e3).toFixed(1)+"K" : n >= 1 ? fx(n) : fx(n, 4); } catch { return "0"; } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const timeAgo = ts => { try { const s = (Date.now() - new Date(ts).getTime()) / 1000; return s < 60 ? Math.floor(s)+"s" : s < 3600 ? Math.floor(s/60)+"m" : s < 86400 ? Math.floor(s/3600)+"h" : Math.floor(s/86400)+"d"; } catch { return "?"; } };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══ PERSISTENT STORAGE (safe, never crashes) ═══
const DB = {
  _dirty: new Set(),
  get(k, fallback) { try { const v = JSON.parse(localStorage.getItem("nxv7_" + k)); return v !== null && v !== undefined ? v : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem("nxv7_" + k, JSON.stringify(v)); this._dirty.add(k); } catch(e) { console.warn("DB save failed:", k, e); } },
  remove(k) { try { localStorage.removeItem("nxv7_" + k); this._dirty.add(k); } catch {} },
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  STABILITY ENGINE — Pro-grade crash/dupe/lock protection        ║
// ╚══════════════════════════════════════════════════════════════════╝
const StabilityEngine = {
  // ═══ EXECUTION LOCK — prevents concurrent AI trade triggers ═══
  _locked: false,
  async withLock(fn) {
    if (this._locked) return null;
    this._locked = true;
    try { return await fn(); }
    catch (e) { console.error("StabilityEngine: locked fn error:", e?.message); return null; }
    finally { this._locked = false; }
  },
  isLocked() { return this._locked; },

  // ═══ SIGNAL DEDUP — hash AI signal to prevent double-trades ═══
  _recentSignals: [],
  _DEDUP_WINDOW: 15000, // 15s — same signal within window = duplicate
  signalHash(action, pair, confidence) {
    // Round confidence to nearest 5 to catch near-identical signals
    const confBucket = Math.round((confidence || 0) / 5) * 5;
    return `${action}_${pair}_${confBucket}`;
  },
  isDuplicate(action, pair, confidence) {
    const hash = this.signalHash(action, pair, confidence);
    const now = Date.now();
    // Clean expired entries
    this._recentSignals = this._recentSignals.filter(s => now - s.time < this._DEDUP_WINDOW);
    // Check for duplicate
    if (this._recentSignals.find(s => s.hash === hash)) return true;
    return false;
  },
  recordSignal(action, pair, confidence) {
    const hash = this.signalHash(action, pair, confidence);
    this._recentSignals.push({ hash, time: Date.now() });
    // Keep max 20 entries
    if (this._recentSignals.length > 20) this._recentSignals = this._recentSignals.slice(-20);
  },

  // ═══ TRADE THROTTLE — minimum time between trades ═══
  _MIN_TRADE_GAP: 3000, // 3s minimum between any two trades
  _lastTradeTime: 0,
  canTradeNow() {
    return Date.now() - this._lastTradeTime >= this._MIN_TRADE_GAP;
  },
  recordTrade() {
    this._lastTradeTime = Date.now();
    DB.set("stability_lastTrade", this._lastTradeTime);
  },
  load() {
    this._lastTradeTime = DB.get("stability_lastTrade", 0);
    this._recentSignals = [];
    this._locked = false;
  },

  // ═══ CRASH RECOVERY — validate state integrity on startup ═══
  validateState(balance, positions, history) {
    const issues = [];
    // Check balance sanity
    if (typeof balance !== "number" || isNaN(balance)) {
      issues.push({ field: "balance", issue: "NaN or invalid", fix: INITIAL_BALANCE });
    } else if (balance < 0) {
      issues.push({ field: "balance", issue: "Negative balance: $" + balance.toFixed(2), fix: Math.abs(balance) });
    } else if (balance > 1e9) {
      issues.push({ field: "balance", issue: "Unrealistic balance: $" + balance.toFixed(2), fix: INITIAL_BALANCE });
    }
    // Check positions array integrity
    if (!Array.isArray(positions)) {
      issues.push({ field: "positions", issue: "Not an array", fix: [] });
    } else {
      const orphans = positions.filter(p => !p.id || !p.entry || !p.qty || p.entry <= 0 || p.qty <= 0);
      if (orphans.length > 0) {
        issues.push({ field: "positions", issue: `${orphans.length} corrupt position(s) found`, fixIds: orphans.map(p => p.id) });
      }
    }
    // Check history integrity
    if (!Array.isArray(history)) {
      issues.push({ field: "history", issue: "Not an array", fix: [] });
    }
    return { valid: issues.length === 0, issues };
  }
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  CLOUD SYNC ENGINE — SUPABASE                                   ║
// ║  Persistent cloud backup for brain, trades, settings            ║
// ║  Local-first: localStorage is primary, cloud is backup          ║
// ║  Auto-sync every 60s, manual backup/restore anytime             ║
// ║  Free tier: 500MB storage, unlimited reads                      ║
// ╚══════════════════════════════════════════════════════════════════╝
const CloudSync = {
  _url: "",
  _key: "",
  _userId: "",
  _status: "disconnected", // disconnected | syncing | synced | error | restored
  _lastSync: 0,
  _lastError: "",
  _syncCount: 0,
  _table: "nexus_data",

  // All keys that should be synced to cloud
  _syncKeys: ["state7", "brain_losses", "brain_wins", "brain_cool", "brain_sessions", "api_settings", "ml_engine", "currentSession"],

  isConnected() { return !!(this._url && this._key && this._userId); },

  init(url, key, userId) {
    this._url = (url || "").replace(/\/$/, "");
    this._key = key || "";
    this._userId = userId || "";
    if (this.isConnected()) this._status = "idle";
  },

  _headers() {
    return {
      "Content-Type": "application/json",
      "apikey": this._key,
      "Authorization": `Bearer ${this._key}`,
      "Prefer": "resolution=merge-duplicates,return=minimal",
    };
  },

  // Push a single key-value pair to Supabase
  async _push(dataKey, value) {
    try {
      if (!this._url || !this._key) return false;
      const res = await fetch(`${this._url}/rest/v1/${this._table}?user_id=eq.${encodeURIComponent(this._userId)}&data_key=eq.${encodeURIComponent(dataKey)}`, {
        method: "PATCH",
        headers: { ...this._headers(), "Prefer": "return=minimal" },
        body: JSON.stringify({ data_value: value, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      });
      // If PATCH finds no row (404 or empty), INSERT instead
      if (!res.ok) {
        const ins = await fetch(`${this._url}/rest/v1/${this._table}`, {
          method: "POST",
          headers: { ...this._headers(), "Prefer": "return=minimal" },
          body: JSON.stringify({ user_id: this._userId, data_key: dataKey, data_value: value, updated_at: new Date().toISOString() }),
          signal: AbortSignal.timeout(10000),
        });
        return ins.ok || ins.status === 409;
      }
      return true;
    } catch { return false; }
  },

  // Pull all data for this user from Supabase
  async pullAll() {
    try {
      const res = await fetch(
        `${this._url}/rest/v1/${this._table}?user_id=eq.${encodeURIComponent(this._userId)}&select=data_key,data_value,updated_at`,
        { headers: { "apikey": this._key, "Authorization": `Bearer ${this._key}` }, signal: AbortSignal.timeout(12000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch(e) { this._lastError = e.message; return []; }
  },

  // Sync only dirty (changed) keys to cloud — called periodically
  async syncDirty() {
    if (!this.isConnected() || DB._dirty.size === 0) return { pushed: 0 };
    this._status = "syncing";
    const keysToSync = [...DB._dirty].filter(k => this._syncKeys.includes(k));
    if (keysToSync.length === 0) { this._status = "synced"; return { pushed: 0 }; }

    let pushed = 0;
    for (const key of keysToSync) {
      const value = DB.get(key, null);
      if (value !== null && await this._push(key, value)) { pushed++; DB._dirty.delete(key); }
    }

    // Also sync journal (stored separately)
    if (DB._dirty.has("journal")) {
      try {
        const journal = JSON.parse(localStorage.getItem("nexus7_journal") || "[]");
        if (journal.length > 0 && await this._push("journal", journal)) { DB._dirty.delete("journal"); pushed++; }
      } catch {}
    }

    this._status = pushed > 0 ? "synced" : "error";
    this._lastSync = Date.now();
    this._syncCount += pushed;
    return { pushed };
  },

  // Full backup — push ALL data to cloud regardless of dirty state
  async backupAll() {
    if (!this.isConnected()) return { success: false, error: "Not connected" };
    this._status = "syncing";
    let pushed = 0;
    let failed = 0;

    for (const key of this._syncKeys) {
      const value = DB.get(key, null);
      if (value !== null) {
        if (await this._push(key, value)) pushed++; else failed++;
      }
    }

    // Journal
    try {
      const journal = JSON.parse(localStorage.getItem("nexus7_journal") || "[]");
      if (journal.length > 0) { if (await this._push("journal", journal)) pushed++; else failed++; }
    } catch {}

    DB._dirty.clear();
    this._status = failed === 0 ? "synced" : "error";
    this._lastSync = Date.now();
    this._syncCount += pushed;
    return { success: failed === 0, pushed, failed };
  },

  // Restore — pull ALL data from cloud and write to localStorage
  async restoreFromCloud() {
    if (!this.isConnected()) return { success: false, error: "Not connected", restored: 0 };
    this._status = "syncing";

    const allData = await this.pullAll();
    if (allData.length === 0) { this._status = "error"; return { success: false, error: this._lastError || "No cloud data found", restored: 0 }; }

    let restored = 0;
    for (const row of allData) {
      try {
        if (row.data_key === "journal") {
          localStorage.setItem("nexus7_journal", JSON.stringify(row.data_value));
        } else {
          localStorage.setItem("nxv7_" + row.data_key, JSON.stringify(row.data_value));
        }
        restored++;
      } catch {}
    }

    this._status = "restored";
    this._lastSync = Date.now();
    return { success: true, restored, total: allData.length };
  },

  getStatus() {
    return {
      connected: this.isConnected(),
      status: this._status,
      lastSync: this._lastSync,
      syncCount: this._syncCount,
      dirtyKeys: DB._dirty.size,
      lastError: this._lastError,
      userId: this._userId,
    };
  },
};

// ═══ DEMO CANDLE GENERATOR ═══
function genDemoCandles(base, count, volatility) {
  try {
    const candles = [];
    let price = base;
    for (let i = 0; i < count; i++) {
      const trend = Math.sin(i / 20) * volatility * 0.3;
      const noise = (Math.random() - 0.48) * volatility;
      const open = price;
      const close = open + trend + noise;
      const high = Math.max(open, close) + Math.random() * volatility * 0.4;
      const low = Math.min(open, close) - Math.random() * volatility * 0.4;
      candles.push({ t: Date.now() - (count - i) * 60000, o: open, h: high, l: low, c: close, v: 500 + Math.random() * 2800 });
      price = close;
    }
    return candles;
  } catch { return []; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SESSION ENGINE — NYC / London / Tokyo / Sydney
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const Sessions = {
  zones: [
    { name: "Sydney", emoji: "AU", color: K.sydney, utcOpen: 21, utcClose: 6, traits: "AUD pairs, lower vol, early Asian tone", bestPairs: ["BTCUSDT","ETHUSDT"], volProfile: "low", bias: "continuation" },
    { name: "Tokyo", emoji: "JP", color: K.tokyo, utcOpen: 0, utcClose: 9, traits: "JPY pairs, moderate vol, Asian sentiment", bestPairs: ["BTCUSDT","ETHUSDT","XRPUSDT"], volProfile: "moderate", bias: "breakout" },
    { name: "London", emoji: "GB", color: K.london, utcOpen: 7, utcClose: 16, traits: "Highest volume, institutional flow, major breakouts", bestPairs: ["BTCUSDT","ETHUSDT","SOLUSDT"], volProfile: "high", bias: "trend" },
    { name: "New York", emoji: "US", color: K.nyc, utcOpen: 13, utcClose: 22, traits: "USD dominance, highest crypto vol, whale moves", bestPairs: ["BTCUSDT","ETHUSDT","SOLUSDT","AVAXUSDT"], volProfile: "highest", bias: "reversal" },
  ],
  getCurrent() {
    try {
      const utcH = new Date().getUTCHours();
      const active = [];
      this.zones.forEach(z => {
        if (z.utcOpen < z.utcClose) { if (utcH >= z.utcOpen && utcH < z.utcClose) active.push(z); }
        else { if (utcH >= z.utcOpen || utcH < z.utcClose) active.push(z); }
      });
      const overlaps = active.length >= 2 ? [active.map(a => a.name).join("+") + " overlap - PEAK VOLUME"] : [];
      const primary = active.length > 0 ? active[active.length - 1] : { name: "Interbank", emoji: "24H", color: K.gold, traits: "Low liquidity gap", volProfile: "lowest", bias: "ranging" };
      return {
        active, primary, overlaps, isOverlap: active.length >= 2,
        volatilityExpected: active.length >= 2 ? "EXTREME" : primary.volProfile === "highest" ? "VERY HIGH" : primary.volProfile === "high" ? "HIGH" : primary.volProfile === "moderate" ? "MODERATE" : "LOW",
        tradingAdvice: this.getAdvice(primary, active.length >= 2),
      };
    } catch { return { active: [], primary: { name: "Unknown", emoji: "?", color: K.gold, traits: "", volProfile: "low", bias: "ranging" }, overlaps: [], isOverlap: false, volatilityExpected: "LOW", tradingAdvice: "" }; }
  },
  getAdvice(s, isOverlap) {
    if (isOverlap) return "Session overlap = max liquidity. Best time to trade.";
    switch(s.name) {
      case "Tokyo": return "Asian session. Watch for breakouts.";
      case "London": return "London open = institutional flow. Follow the trend.";
      case "New York": return "NYSE correlation high. Watch for reversals.";
      case "Sydney": return "Quiet session. Smaller positions.";
      default: return "Interbank gap. Reduced liquidity.";
    }
  },
  getSessionModifier(symbol, session) {
    try {
      let mod = 0;
      if (session.isOverlap) mod += 8;
      if (session.primary.bestPairs && session.primary.bestPairs.includes(symbol)) mod += 5;
      if (session.primary.volProfile === "lowest") mod -= 10;
      if (session.primary.volProfile === "low") mod -= 3;
      return mod;
    } catch { return 0; }
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEWS INTELLIGENCE ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const NewsEngine = {
  cache: [], lastFetch: 0, fetchInterval: 120000,
  async fetchNews() {
    try {
      if (Date.now() - this.lastFetch < this.fetchInterval && this.cache.length > 0) return this.cache;
      const allNews = [];
      try {
        // CryptoCompare free news API (no key needed, CORS-friendly)
        const newsUrls = [
          "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular",
          "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC",
        ];
        let data = null;
        // Try direct first (CryptoCompare supports CORS)
        for (const nUrl of newsUrls) {
          try {
            const res = await fetch(nUrl, { signal: AbortSignal.timeout(5000) });
            if (res.ok) { data = await res.json(); break; }
          } catch { continue; }
        }
        // Fallback to proxy if direct fails
        if (!data) {
          for (const proxy of CORS_PROXIES.filter(Boolean)) {
            try {
              const res = await fetch(proxy + encodeURIComponent(newsUrls[0]), { signal: AbortSignal.timeout(5000) });
              if (res.ok) { data = await res.json(); break; }
            } catch { continue; }
          }
        }
        if (data && data.Data) {
          data.Data.slice(0, 20).forEach(item => {
            allNews.push({
              id: item.id || uid(), title: item.title, source: item.source_info?.name || item.source || "CryptoCompare",
              url: item.url || item.guid, time: item.published_on ? new Date(item.published_on * 1000).toISOString() : new Date().toISOString(),
              sentiment: this.analyzeSentiment(item.title), votes: {},
              credibility: this.scoreCredibility({ source: { title: item.source_info?.name || item.source } }), currencies: item.tags ? item.tags.split("|").map(t => t.toUpperCase()) : [], kind: "news",
            });
          });
        }
      } catch {}
      if (allNews.length === 0) allNews.push(...this.generateMarketNews());
      this.cache = allNews.slice(0, 30);
      this.lastFetch = Date.now();
      return this.cache;
    } catch { return this.cache.length > 0 ? this.cache : this.generateMarketNews(); }
  },
  analyzeSentiment(title) {
    try {
      if (!title) return { score: 0, label: "neutral", isFake: false };
      const t = title.toLowerCase();
      const bullWords = ["surge","rally","bull","pump","breakout","all-time high","ath","soar","moon","buying","accumulate","institutional","adopt","etf approved","upgrade","partnership","milestone","record","billion","growth","profit","halving","approval","bullish","outperform","inflow","whale buy","support"];
      const bearWords = ["crash","dump","bear","plunge","collapse","hack","exploit","sec","lawsuit","ban","regulation","crackdown","sell-off","selloff","fear","liquidation","warning","risk","bubble","fraud","scam","ponzi","rug pull","bankruptcy","default","sanctions","war","bearish","outflow"];
      const fakeWords = ["guaranteed","100x","1000x","get rich","free money","secret","insider","pump alert","easy profit","last chance","act now","limited time"];
      let score = 0;
      bullWords.forEach(w => { if (t.includes(w)) score += 15; });
      bearWords.forEach(w => { if (t.includes(w)) score -= 15; });
      let isFake = false;
      fakeWords.forEach(w => { if (t.includes(w)) { isFake = true; score = 0; } });
      score = clamp(score, -100, 100);
      const label = isFake ? "FAKE" : score > 30 ? "bullish" : score < -30 ? "bearish" : "neutral";
      return { score, label, isFake };
    } catch { return { score: 0, label: "neutral", isFake: false }; }
  },
  scoreCredibility(item) {
    try {
      let cred = 50;
      const trusted = ["coindesk","cointelegraph","theblock","decrypt","bloomberg","reuters","cnbc","wsj","ft","bbc","binance","coinbase"];
      const suspicious = ["telegram","unknown","twitter","x.com","reddit user","anonymous"];
      const src = (item.source?.title || "").toLowerCase();
      if (trusted.some(t => src.includes(t))) cred += 30;
      if (suspicious.some(s => src.includes(s))) cred -= 25;
      if (item.votes) {
        if ((item.votes.positive || 0) > 5) cred += 10;
        if ((item.votes.negative || 0) > (item.votes.positive || 0)) cred -= 15;
        if ((item.votes.toxic || 0) > 0) cred -= 20;
      }
      const title = (item.title || "").toLowerCase();
      if (title.includes("guaranteed") || title.includes("100x")) cred -= 40;
      if (title.includes("insider") || title.includes("secret")) cred -= 30;
      if (title.length < 15) cred -= 10;
      if (title.split("!").length > 2) cred -= 15;
      if (title === title.toUpperCase() && title.length > 10) cred -= 20;
      return clamp(cred, 0, 100);
    } catch { return 50; }
  },
  generateMarketNews() {
    const templates = [
      { title: "Bitcoin holds steady as market awaits next catalyst", sentiment: { score: 5, label: "neutral", isFake: false } },
      { title: "Crypto market volume increases during Asian session", sentiment: { score: 10, label: "neutral", isFake: false } },
      { title: "Institutional interest in digital assets continues to grow", sentiment: { score: 25, label: "bullish", isFake: false } },
      { title: "DeFi protocols see increased total value locked", sentiment: { score: 20, label: "bullish", isFake: false } },
      { title: "Global regulatory clarity improving for crypto sector", sentiment: { score: 15, label: "neutral", isFake: false } },
      { title: "Market analysts debate next support and resistance levels", sentiment: { score: 0, label: "neutral", isFake: false } },
    ];
    return templates.map((t, i) => ({
      id: uid(), title: t.title, source: "Market Analysis",
      time: new Date(Date.now() - i * 600000).toISOString(),
      sentiment: t.sentiment, credibility: 60, currencies: ["BTC"], kind: "analysis",
    }));
  },
  getNewsSentiment(news, symbol) {
    try {
      if (!news || news.length === 0) return { score: 0, bullCount: 0, bearCount: 0, fakeCount: 0, confidence: 0 };
      const coinName = symbol.replace("USDT", "").toLowerCase();
      const relevant = news.filter(n => n.currencies?.some(c => c.toLowerCase() === coinName) || n.title?.toLowerCase().includes(coinName) || n.title?.toLowerCase().includes("crypto") || n.title?.toLowerCase().includes("bitcoin"));
      const reliable = relevant.filter(n => n.credibility > 40 && !n.sentiment.isFake);
      const fakeCount = relevant.filter(n => n.sentiment.isFake || n.credibility < 25).length;
      let totalScore = 0, weight = 0;
      reliable.forEach(n => {
        const recency = Math.max(0.1, 1 - (Date.now() - new Date(n.time).getTime()) / 3600000);
        const credWeight = n.credibility / 100;
        totalScore += n.sentiment.score * recency * credWeight;
        weight += recency * credWeight;
      });
      return {
        score: Math.round(weight > 0 ? totalScore / weight : 0),
        bullCount: reliable.filter(n => n.sentiment.label === "bullish").length,
        bearCount: reliable.filter(n => n.sentiment.label === "bearish").length,
        fakeCount, confidence: Math.min(100, reliable.length * 15),
      };
    } catch { return { score: 0, bullCount: 0, bearCount: 0, fakeCount: 0, confidence: 0 }; }
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FAKE MOVE DETECTOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FakeDetector = {
  analyze(candles, volumes, price) {
    try {
      const warnings = [];
      const L = candles.length;
      if (L < 30) return { isSuspicious: false, warnings, score: 0, level: "CLEAR" };
      let s = 0;
      const last = candles[L-1];
      const wickR = (last.h - last.l) / (Math.abs(last.c - last.o) || 0.0001);
      if (wickR > 8 && volumes[L-1] < volumes[L-2] * 0.5) { warnings.push("Long wick + low volume = stop hunt"); s += 25; }
      const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      if (volumes[L-1] > avgVol * 4 && Math.abs(last.c - last.o) / last.o < 0.001) { warnings.push("Massive volume but no price move = wash trade"); s += 30; }
      if (L >= 4) {
        const c1 = candles[L-3], c2 = candles[L-2], c3 = candles[L-1];
        const pump = (c2.h - c1.o) / c1.o * 100;
        const dump = (c2.h - c3.c) / c2.h * 100;
        if (pump > 2 && dump > 1.5) { warnings.push("Pump & dump pattern (3-candle)"); s += 35; }
      }
      const bullVol = candles.slice(-5).filter(c => c.c > c.o).reduce((a, c) => a + c.v, 0);
      const bearVol = candles.slice(-5).filter(c => c.c <= c.o).reduce((a, c) => a + c.v, 0);
      const pd = candles[L-1].c - (candles[L-5]?.c || candles[L-1].c);
      if (bullVol > bearVol * 2 && pd < 0) { warnings.push("Bullish vol but price falling = divergence"); s += 20; }
      if (bearVol > bullVol * 2 && pd > 0) { warnings.push("Bearish vol but price rising = divergence"); s += 20; }
      if (L >= 2) {
        const gap = Math.abs(candles[L-1].o - candles[L-2].c) / candles[L-2].c * 100;
        if (gap > 0.5) { warnings.push(`Unusual gap ${fx(gap)}% between candles`); s += 15; }
      }
      return { isSuspicious: s > 30, warnings, score: Math.min(100, s), level: s > 60 ? "DANGER" : s > 30 ? "CAUTION" : "CLEAR" };
    } catch { return { isSuspicious: false, warnings: [], score: 0, level: "CLEAR" }; }
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BRAIN v7 — SELF-LEARNING ENGINE (PERSISTENT ACROSS REFRESH)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const Brain = {
  losses: [], wins: [], coolUntil: 0, sessionTrades: {},
  load() {
    try {
      this.losses = DB.get("brain_losses", []);
      this.wins = DB.get("brain_wins", []);
      this.coolUntil = DB.get("brain_cool", 0);
      this.sessionTrades = DB.get("brain_sessions", {});
      this._pruneOldSessions();
    } catch { this.losses = []; this.wins = []; this.coolUntil = 0; this.sessionTrades = {}; }
  },
  save() {
    try {
      DB.set("brain_losses", this.losses.slice(-2000));
      DB.set("brain_wins", this.wins.slice(-2000));
      DB.set("brain_cool", this.coolUntil);
      this._pruneOldSessions();
      DB.set("brain_sessions", this.sessionTrades);
    } catch {}
  },
  _pruneOldSessions() {
    try {
      const MAX_AGE = 30 * 24 * 3600000; // 30 days
      const now = Date.now();
      const keys = Object.keys(this.sessionTrades);
      if (keys.length <= 720) return; // ~30 days of hourly keys, no need to prune yet
      for (const key of keys) {
        const dateStr = key.split("_").slice(1).join("_");
        const ts = new Date(dateStr + ":00:00Z").getTime();
        if (!isNaN(ts) && now - ts > MAX_AGE) delete this.sessionTrades[key];
      }
    } catch {}
  },
  fingerprint(indicators, action, symbol) {
    try {
      const i = indicators || {};
      const session = Sessions.getCurrent().primary.name.slice(0, 3);
      return [
        action, symbol,
        "rsi" + (Math.round((i.rsi || 50) / 5) * 5),
        "macd" + (i.macdDir || "n"),
        "vol" + (i.volRatio > 2.5 ? "XH" : i.volRatio > 1.5 ? "H" : i.volRatio > 0.8 ? "N" : "L"),
        "atr" + (i.atrPct > 2.5 ? "XH" : i.atrPct > 1.2 ? "H" : i.atrPct > 0.5 ? "N" : "L"),
        "bb" + (i.bbZone || "m"),
        "trend" + (i.trendStr > 3 ? "SU" : i.trendStr > 0 ? "U" : i.trendStr < -3 ? "SD" : i.trendStr < 0 ? "D" : "F"),
        "regime" + (i.regime || "n"),
        "srsi" + (Math.round((i.stochRSI || 50) / 10) * 10),
        "sess" + session,
        "news" + (i.newsScore > 20 ? "B" : i.newsScore < -20 ? "R" : "N"),
        "bias" + (i.marketBias || "n"),
      ].join("|");
    } catch { return "unknown"; }
  },
  recordLoss(entry) {
    try {
      const fp = this.fingerprint(entry.indicators, entry.action, entry.symbol);
      this.losses.push({ fp, loss: entry.loss, ts: Date.now(), pair: entry.symbol, action: entry.action, session: Sessions.getCurrent().primary.name, liveVerified: true });
      this.coolUntil = Date.now() + COOL_AFTER_LOSS;
      this.trackSession("loss");
      this.save();
    } catch {}
  },
  recordWin(entry) {
    try {
      const fp = this.fingerprint(entry.indicators, entry.action, entry.symbol);
      this.wins.push({ fp, profit: entry.profit, ts: Date.now(), pair: entry.symbol, action: entry.action, session: Sessions.getCurrent().primary.name, liveVerified: true });
      this.trackSession("win");
      this.save();
    } catch {}
  },
  trackSession(result) {
    try {
      const session = Sessions.getCurrent().primary.name;
      const key = `${session}_${new Date().toISOString().slice(0, 13)}`;
      if (!this.sessionTrades[key]) this.sessionTrades[key] = { wins: 0, losses: 0, trades: 0 };
      this.sessionTrades[key].trades++;
      result === "win" ? this.sessionTrades[key].wins++ : this.sessionTrades[key].losses++;
    } catch {}
  },
  shouldBlock(indicators, action, symbol) {
    try {
      const fp = this.fingerprint(indicators, action, symbol);
      const WEEK = 7 * 864e5;
      const HOUR = 36e5;
      if (Date.now() < this.coolUntil) return { blocked: true, reason: `Cooling down (${Math.ceil((this.coolUntil - Date.now()) / 1000)}s)`, severity: "COOL" };
      const exactLosses = this.losses.filter(e => e.fp === fp && Date.now() - e.ts < WEEK);
      if (exactLosses.length >= 2) return { blocked: true, reason: `Exact pattern lost ${exactLosses.length}x this week`, severity: "HIGH" };
      const parts = fp.split("|");
      const simKey = parts.slice(0, 4).join("|");
      const similar = this.losses.filter(e => e.fp.startsWith(simKey) && Date.now() - e.ts < WEEK);
      if (similar.length >= 3) return { blocked: true, reason: `Similar setup lost ${similar.length}x`, severity: "HIGH" };
      const pairLosses = this.losses.filter(e => e.pair === symbol && Date.now() - e.ts < HOUR);
      if (pairLosses.length >= 3) return { blocked: true, reason: `3+ losses on ${symbol} in 1h`, severity: "MED" };
      const allRecent = this.losses.filter(e => Date.now() - e.ts < HOUR * 2);
      if (allRecent.length >= 5) return { blocked: true, reason: `${allRecent.length} losses in 2h - emergency brake`, severity: "CRIT" };
      const sessionName = Sessions.getCurrent().primary.name;
      const sessionLosses = this.losses.filter(e => e.session === sessionName && e.fp.startsWith(simKey));
      const sessionWins = this.wins.filter(e => e.session === sessionName && e.fp.startsWith(simKey));
      if (sessionLosses.length >= 3 && sessionWins.length < sessionLosses.length * 0.3) return { blocked: true, reason: `Pattern fails in ${sessionName} (${sessionWins.length}W/${sessionLosses.length}L)`, severity: "MED" };
      return { blocked: false };
    } catch { return { blocked: false }; }
  },
  getWinRate(indicators, action, symbol) {
    try {
      const fp = this.fingerprint(indicators, action, symbol);
      const baseKey = fp.split("|").slice(0, 5).join("|");
      const lossCount = this.losses.filter(e => e.fp.startsWith(baseKey)).length;
      const winCount = this.wins.filter(e => e.fp.startsWith(baseKey)).length;
      const total = winCount + lossCount;
      if (total === 0) return { rate: 50, total: 0, wins: 0, losses: 0 };
      return { rate: (winCount / total) * 100, total, wins: winCount, losses: lossCount };
    } catch { return { rate: 50, total: 0, wins: 0, losses: 0 }; }
  },
  getConfidenceModifier(indicators, action, symbol) {
    try {
      const wr = this.getWinRate(indicators, action, symbol);
      if (wr.total < 3) return 0;
      if (wr.rate > 70) return +15;
      if (wr.rate > 60) return +7;
      if (wr.rate < 30) return -22;
      if (wr.rate < 40) return -12;
      return 0;
    } catch { return 0; }
  },
  getSessionPerformance() {
    try {
      const perf = {};
      Sessions.zones.forEach(z => {
        const wins = this.wins.filter(w => w.session === z.name).length;
        const losses = this.losses.filter(l => l.session === z.name).length;
        const total = wins + losses;
        perf[z.name] = { wins, losses, total, winRate: total > 0 ? (wins / total * 100) : 0,
          profit: this.wins.filter(w => w.session === z.name).reduce((a, e) => a + (e.profit || 0), 0),
          loss: this.losses.filter(l => l.session === z.name).reduce((a, e) => a + (e.loss || 0), 0),
        };
      });
      return perf;
    } catch { return {}; }
  },
  getStats() {
    try {
      const WEEK = 7 * 864e5;
      const weekLosses = this.losses.filter(e => Date.now() - e.ts < WEEK);
      const totalLossPrevented = this.losses.reduce((a, e) => a + (e.loss || 0), 0);
      const totalWinValue = this.wins.reduce((a, e) => a + (e.profit || 0), 0);
      const patterns = {};
      this.losses.forEach(e => { patterns[e.fp] = (patterns[e.fp] || 0) + 1; });
      const topBlocked = Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return { totalLosses: this.losses.length, totalWins: this.wins.length, weekLosses: weekLosses.length, totalLossPrevented, totalWinValue, topBlocked, brainSize: this.losses.length + this.wins.length };
    } catch { return { totalLosses: 0, totalWins: 0, weekLosses: 0, totalLossPrevented: 0, totalWinValue: 0, topBlocked: [], brainSize: 0 }; }
  },
  reset() { this.losses = []; this.wins = []; this.coolUntil = 0; this.sessionTrades = {}; this.save(); },
  // ═══ PURGE DEMO DATA: One-time cleanup of entries recorded during offline/demo mode ═══
  purgeDemo() {
    try {
      const before = this.wins.length + this.losses.length;
      this.wins = this.wins.filter(w => w.liveVerified !== false);
      this.losses = this.losses.filter(l => l.liveVerified !== false);
      const after = this.wins.length + this.losses.length;
      if (before !== after) { this.save(); }
      return before - after;
    } catch { return 0; }
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BACKTEST ENGINE — Pre-train Brain with historical BTC data
// Fetches 5x1000 1-min candles from different time periods, simulates trades,
// records win/loss patterns to Brain for smarter future decisions.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BacktestEngine = {
  _running: false, _results: null, _progress: "",

  async run(symbol, onProgress) {
    if (this._running) return null;
    this._running = true;
    this._progress = "Fetching historical data...";
    if (onProgress) onProgress(this._progress);

    try {
      const batches = await this._fetchBatches(symbol, onProgress);
      if (batches.length === 0) { this._running = false; return { error: "No historical data fetched" }; }

      let wins = 0, losses = 0;
      for (let b = 0; b < batches.length; b++) {
        this._progress = `Simulating batch ${b + 1}/${batches.length}... (${batches[b].length} candles)`;
        if (onProgress) onProgress(this._progress);
        const results = this._simulate(batches[b], symbol);
        for (const r of results) {
          if (r.won) {
            Brain.wins.push({ fp: r.fp, profit: r.profit, ts: r.ts, pair: symbol, action: r.action, session: r.session, liveVerified: true, source: "backtest" });
            wins++;
          } else {
            Brain.losses.push({ fp: r.fp, loss: r.loss, ts: r.ts, pair: symbol, action: r.action, session: r.session, liveVerified: true, source: "backtest" });
            losses++;
          }
        }
      }

      Brain.save();
      const total = wins + losses;
      this._results = { wins, losses, total, winRate: total > 0 ? (wins / total * 100) : 0, batches: batches.length };
      this._progress = `Done: ${total} patterns (${wins}W/${losses}L = ${total > 0 ? (wins/total*100).toFixed(1) : 0}% WR)`;
      if (onProgress) onProgress(this._progress);
      this._running = false;
      return this._results;
    } catch (e) {
      this._running = false;
      this._progress = "Error: " + (e.message || "unknown");
      if (onProgress) onProgress(this._progress);
      return { error: e.message };
    }
  },

  async _fetchBatches(symbol, onProgress) {
    const now = Date.now();
    // 5 batches from different time periods for diverse market conditions
    const offsets = [
      0,                  // now to 16h ago
      60000 * 3000,       // ~2 days ago
      60000 * 7000,       // ~5 days ago
      60000 * 15000,      // ~10 days ago
      60000 * 30000,      // ~21 days ago
    ];
    const batches = [];

    for (let idx = 0; idx < offsets.length; idx++) {
      const offset = offsets[idx];
      const endTime = now - offset;
      const startTime = endTime - 1000 * 60000;
      this._progress = `Fetching batch ${idx + 1}/${offsets.length}...`;
      if (onProgress) onProgress(this._progress);

      try {
        const baseUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startTime}&endTime=${endTime}&limit=1000`;
        let data = null;

        // Try direct endpoints first
        for (const ep of ENDPOINTS) {
          try {
            const url = `${ep}/api/v3/klines?symbol=${symbol}&interval=1m&startTime=${startTime}&endTime=${endTime}&limit=1000`;
            const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
            const json = await resp.json();
            if (Array.isArray(json) && json.length > 100) { data = json; break; }
          } catch { continue; }
        }

        // Fallback to CORS proxies
        if (!data) {
          for (const proxy of CORS_PROXIES.filter(Boolean)) {
            try {
              const resp = await fetch(proxy + encodeURIComponent(baseUrl), { signal: AbortSignal.timeout(10000) });
              const json = await resp.json();
              if (Array.isArray(json) && json.length > 100) { data = json; break; }
            } catch { continue; }
          }
        }

        if (data && data.length > 300) {
          batches.push(data.map(k => ({
            t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5]
          })));
        }
      } catch {}

      // Polite delay between API requests
      await new Promise(r => setTimeout(r, 300));
    }

    return batches;
  },

  _getSession(ts) {
    const h = new Date(ts).getUTCHours();
    if (h >= 13 && h < 22) return "New York";
    if (h >= 7 && h < 16) return "London";
    if (h >= 0 && h < 9) return "Tokyo";
    return "Sydney";
  },

  _simulate(candles, symbol) {
    const results = [];
    if (candles.length < 350) return results;

    const closes = candles.map(c => c.c);

    // Pre-calculate indicator arrays across all candles
    const rsiArr = calcRSI(closes);
    const macd = calcMACD(closes);
    const bb = calcBB(closes);
    const srsiArr = calcStochRSI(closes);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const ema50 = calcEMA(closes, 50);

    const WARMUP = 300;     // Indicator stabilization period
    const STEP = 8;         // Check every 8th candle (diverse but not too many)
    const LOOKAHEAD = 120;  // 2 hours max to hit SL/TP

    for (let i = WARMUP; i < candles.length - LOOKAHEAD; i += STEP) {
      const price = candles[i].c;
      const atr = calcATR(candles.slice(Math.max(0, i - 30), i + 1));
      if (atr === 0 || price === 0) continue;

      const atrPct = (atr / price) * 100;
      const rsi = rsiArr[i] || 50;
      const prevRsi = rsiArr[i - 1] || 50;
      const srsi = srsiArr[i] || 50;

      // MACD (offset by 26 due to EMA26 warmup)
      const mi = i - 26;
      const macdHistVal = (mi >= 0 && mi < macd.hist.length) ? macd.hist[mi] : 0;
      const prevMacdHist = (mi > 0 && mi - 1 < macd.hist.length) ? macd.hist[mi - 1] : 0;
      const macdDir = macdHistVal > 0 ? "up" : macdHistVal < 0 ? "down" : "n";
      const macdCross = (macdHistVal > 0 && prevMacdHist <= 0) ? "bullCross" : (macdHistVal < 0 && prevMacdHist >= 0) ? "bearCross" : "none";

      // Bollinger Bands
      const bbU = bb.upper[i], bbL = bb.lower[i], bbM = bb.middle[i];
      const bbZone = (bbL && price <= bbL) ? "lower" : (bbU && price >= bbU) ? "upper" : "mid";
      const bbWidth = (bbU && bbL && bbM) ? ((bbU - bbL) / bbM) * 100 : 2;

      // Volume ratio
      const vol20 = candles.slice(Math.max(0, i - 20), i).reduce((a, c) => a + c.v, 0) / 20;
      const volRatio = vol20 > 0 ? candles[i].v / vol20 : 1;

      // Trend strength
      let trendStr = 0;
      if (ema9[i] > ema21[i]) trendStr += 2; else trendStr -= 2;
      if (ema50[i] && ema9[i] > ema50[i]) trendStr += 2; else if (ema50[i]) trendStr -= 2;

      // Momentum
      const mom5 = i >= 5 ? ((price - closes[i - 5]) / closes[i - 5]) * 100 : 0;

      // Regime
      const regime = atrPct > 2.5 ? "volatile" : atrPct < 0.5 ? "ranging" : "normal";

      // ═══ SCORING (simplified version of aiDecision) ═══
      let bull = 0, bear = 0;

      if (rsi < 18) bull += 28;
      else if (rsi < 28) bull += 20;
      else if (rsi < 40 && rsi > prevRsi) bull += 8;
      if (rsi > 82) bear += 28;
      else if (rsi > 72) bear += 20;
      else if (rsi > 60 && rsi < prevRsi) bear += 8;

      if (macdCross === "bullCross") bull += 22;
      else if (macdCross === "bearCross") bear += 22;
      else if (macdHistVal > 0 && macdHistVal > prevMacdHist) bull += 8;
      else if (macdHistVal < 0 && macdHistVal < prevMacdHist) bear += 8;

      if (bbZone === "lower") bull += 18;
      else if (bbZone === "upper") bear += 18;

      if (ema9[i] > ema21[i]) bull += 10; else bear += 10;
      if (ema50[i]) { if (price > ema50[i] && ema9[i] > ema50[i]) bull += 8; else if (price < ema50[i] && ema9[i] < ema50[i]) bear += 8; }

      if (srsi < 8) bull += 12; else if (srsi < 18) bull += 6;
      if (srsi > 92) bear += 12; else if (srsi > 82) bear += 6;

      if (volRatio > 2) { if (bull > bear) bull += 8; else bear += 8; }
      else if (volRatio > 1.3) { if (bull > bear) bull += 4; else bear += 4; }

      if (mom5 > 0.3) bull += 6; else if (mom5 < -0.3) bear += 6;

      // RSI divergence
      if (rsi < 35 && rsi > prevRsi && closes[i] < closes[i - 1]) bull += 14;
      if (rsi > 65 && rsi < prevRsi && closes[i] > closes[i - 1]) bear += 14;

      const total = bull + bear;
      if (total === 0) continue;
      const bullPct = (bull / total) * 100;
      const bearPct = (bear / total) * 100;

      // Need clear signal (matching live v7.2 raised thresholds)
      let action = null;
      if (bullPct > 66 && bull > 28) action = "LONG";
      else if (bearPct > 66 && bear > 28) action = "SHORT";
      if (!action) continue;

      // ═══ SL/TP (matching tighter v7.2 levels) ═══
      const slMult = regime === "volatile" ? 1.8 : 1.3;
      const tpMult = regime === "volatile" ? 4.0 : 3.2;

      let sl, tp;
      if (action === "LONG") { sl = price - atr * slMult; tp = price + atr * tpMult; }
      else { sl = price + atr * slMult; tp = price - atr * tpMult; }

      // ═══ LOOK AHEAD: Does SL or TP hit first? ═══
      let won = null;
      let exitPrice = price;

      for (let j = i + 1; j < Math.min(i + LOOKAHEAD, candles.length); j++) {
        const c = candles[j];
        if (action === "LONG") {
          if (c.l <= sl) { won = false; exitPrice = sl; break; }
          if (c.h >= tp) { won = true; exitPrice = tp; break; }
        } else {
          if (c.h >= sl) { won = false; exitPrice = sl; break; }
          if (c.l <= tp) { won = true; exitPrice = tp; break; }
        }
      }

      // Timeout: check P&L at end of lookahead window
      if (won === null) {
        const finalPrice = candles[Math.min(i + LOOKAHEAD, candles.length - 1)].c;
        if (action === "LONG") won = finalPrice > price * 1.001; // Need >0.1% to count as win (fees)
        else won = finalPrice < price * 0.999;
        exitPrice = finalPrice;
      }

      // Build indicators for Brain fingerprint
      const indicators = {
        rsi, macdDir, volRatio, atrPct, bbZone, trendStr, regime,
        stochRSI: srsi, newsScore: 0, marketBias: "neutral",
      };

      const fp = Brain.fingerprint(indicators, action, symbol);
      const session = this._getSession(candles[i].t);
      const pnl = action === "LONG" ? exitPrice - price : price - exitPrice;

      results.push({
        fp, action, won,
        profit: won ? Math.abs(pnl) : 0,
        loss: won ? 0 : Math.abs(pnl),
        ts: candles[i].t,
        session,
      });
    }

    return results;
  },

  getStats() { return this._results || null; },
  isRunning() { return this._running; },
  getProgress() { return this._progress; },

  // Remove all backtest patterns (keep live patterns)
  purge() {
    const before = Brain.wins.length + Brain.losses.length;
    Brain.wins = Brain.wins.filter(w => w.source !== "backtest");
    Brain.losses = Brain.losses.filter(l => l.source !== "backtest");
    Brain.save();
    return before - (Brain.wins.length + Brain.losses.length);
  },

  countBacktestPatterns() {
    return Brain.wins.filter(w => w.source === "backtest").length + Brain.losses.filter(l => l.source === "backtest").length;
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TECHNICAL ANALYSIS LIBRARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function calcEMA(data, period) { try { if (!data.length) return []; const k = 2 / (period + 1); let val = data[0]; const r = [val]; for (let i = 1; i < data.length; i++) { val = data[i] * k + val * (1 - k); r.push(val); } return r; } catch { return []; } }
function calcRSI(closes, period = 14) { try { if (closes.length < period + 1) return closes.map(() => 50); const r = Array(period).fill(50); let aG = 0, aL = 0; for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i-1]; d > 0 ? aG += d : aL -= d; } aG /= period; aL /= period; r.push(aL === 0 ? 100 : 100 - 100 / (1 + aG / aL)); for (let i = period + 1; i < closes.length; i++) { const d = closes[i] - closes[i-1]; aG = (aG * (period - 1) + (d > 0 ? d : 0)) / period; aL = (aL * (period - 1) + (d < 0 ? -d : 0)) / period; r.push(aL === 0 ? 100 : 100 - 100 / (1 + aG / aL)); } return r; } catch { return closes.map(() => 50); } }
function calcMACD(closes) { try { if (closes.length < 26) return { line: [], signal: [], hist: [] }; const e12 = calcEMA(closes, 12), e26 = calcEMA(closes, 26); const line = e12.map((v, i) => v - e26[i]); const sig = calcEMA(line.slice(26), 9); return { line: line.slice(26), signal: sig, hist: sig.map((v, i) => line[26 + i] - v) }; } catch { return { line: [], signal: [], hist: [] }; } }
function calcBB(closes, period = 20) { try { const upper = [], middle = [], lower = []; for (let i = 0; i < closes.length; i++) { if (i < period - 1) { upper.push(null); middle.push(null); lower.push(null); continue; } const slice = closes.slice(i - period + 1, i + 1); const avg = slice.reduce((a, b) => a + b, 0) / period; const std = Math.sqrt(slice.reduce((a, b) => a + (b - avg) ** 2, 0) / period); middle.push(avg); upper.push(avg + 2 * std); lower.push(avg - 2 * std); } return { upper, middle, lower }; } catch { return { upper: [], middle: [], lower: [] }; } }
function calcATR(candles, period = 14) { try { const tr = []; for (let i = 1; i < candles.length; i++) { tr.push(Math.max(candles[i].h - candles[i].l, Math.abs(candles[i].h - candles[i-1].c), Math.abs(candles[i].l - candles[i-1].c))); } if (tr.length < period) return tr.length > 0 ? tr[tr.length - 1] : 0; let atr = tr.slice(0, period).reduce((s, v) => s + v, 0) / period; for (let i = period; i < tr.length; i++) atr = (atr * (period - 1) + tr[i]) / period; return atr; } catch { return 0; } }
function calcStochRSI(closes, rP = 14, sP = 14) { try { const rv = calcRSI(closes, rP); const r = []; for (let i = 0; i < rv.length; i++) { if (i < sP - 1) { r.push(50); continue; } const s = rv.slice(i - sP + 1, i + 1); const mn = Math.min(...s), mx = Math.max(...s); r.push(mx === mn ? 50 : ((rv[i] - mn) / (mx - mn)) * 100); } return r; } catch { return closes.map(() => 50); } }
function calcVWAP(candles) { try { let cpv = 0, cv = 0; return candles.map(c => { const tp = (c.h + c.l + c.c) / 3; cpv += tp * c.v; cv += c.v; return cv > 0 ? cpv / cv : tp; }); } catch { return candles.map(c => c.c); } }
function calcOBV(candles) { try { let v = 0; const r = [0]; for (let i = 1; i < candles.length; i++) { if (candles[i].c > candles[i-1].c) v += candles[i].v; else if (candles[i].c < candles[i-1].c) v -= candles[i].v; r.push(v); } return r; } catch { return candles.map(() => 0); } }

function detectRegime(candles, atr, bbWidth) {
  try {
    if (candles.length < 30) return "unknown";
    const closes = candles.slice(-30).map(c => c.c);
    const changes = [];
    for (let i = 1; i < closes.length; i++) changes.push((closes[i] - closes[i-1]) / closes[i-1] * 100);
    const avgChange = changes.reduce((a, b) => a + Math.abs(b), 0) / changes.length;
    const direction = changes.reduce((a, b) => a + (b > 0 ? 1 : -1), 0);
    if (bbWidth < 1.2 && avgChange < 0.3) return "squeeze";
    if (avgChange > 1.5) return "volatile";
    if (Math.abs(direction) > 18) return "trending";
    if (Math.abs(direction) < 8 && avgChange < 0.6) return "ranging";
    return "mixed";
  } catch { return "unknown"; }
}

// ═══ MARKET BIAS DETECTION — Adapts strategy to bull/bear/neutral ═══
// Looks at MA alignment + trend + momentum to determine market direction
// Prevents contrarian F&G from fighting a clear trend
function detectMarketBias(closes, price, ema9, ema21, ema50, mom5, mom20, trendStr) {
  try {
    let bearSignals = 0, bullSignals = 0;
    // MA alignment (short-term)
    if (price < ema9 && price < ema21) bearSignals += 2;
    else if (price > ema9 && price > ema21) bullSignals += 2;
    if (ema50 !== null) {
      if (price < ema50 && ema9 < ema50) bearSignals += 2;
      else if (price > ema50 && ema9 > ema50) bullSignals += 2;
    }
    if (ema9 < ema21) bearSignals += 1; else bullSignals += 1;
    // Momentum
    if (mom5 < -0.5 && mom20 < -1) bearSignals += 2;
    else if (mom5 > 0.5 && mom20 > 1) bullSignals += 2;
    // Trend strength
    if (trendStr < -2) bearSignals += 1;
    else if (trendStr > 2) bullSignals += 1;
    // 20-period trend: how many of last 20 closes were declining
    const recent20 = closes.slice(-20);
    if (recent20.length >= 20) {
      const declining = recent20.filter((c, i) => i > 0 && c < recent20[i - 1]).length;
      if (declining >= 13) bearSignals += 2;
      else if (declining <= 7) bullSignals += 2;
    }
    // ═══ LONGER LOOKBACK: Use full candle history for macro trend ═══
    // 100-candle trend (covers ~1.7 hours of 1-min data)
    if (closes.length >= 100) {
      const avg100 = closes.slice(-100).reduce((a, b) => a + b, 0) / 100;
      const pctFrom100 = (price - avg100) / avg100 * 100;
      if (pctFrom100 < -0.5) bearSignals += 2;
      else if (pctFrom100 > 0.5) bullSignals += 2;
    }
    // 300-candle trend (covers ~5 hours — strong directional signal)
    if (closes.length >= 300) {
      const avg300 = closes.slice(-300).reduce((a, b) => a + b, 0) / 300;
      const pctFrom300 = (price - avg300) / avg300 * 100;
      if (pctFrom300 < -0.8) bearSignals += 3; // heavy weight — this is a macro signal
      else if (pctFrom300 > 0.8) bullSignals += 3;
      // Also check slope: is avg300 itself declining over time?
      const earlyAvg = closes.slice(-300, -200).reduce((a, b) => a + b, 0) / 100;
      const lateAvg = closes.slice(-100).reduce((a, b) => a + b, 0) / 100;
      const slope = (lateAvg - earlyAvg) / earlyAvg * 100;
      if (slope < -0.3) bearSignals += 2;
      else if (slope > 0.3) bullSignals += 2;
    }
    const total = bearSignals + bullSignals;
    if (total === 0) return { bias: "neutral", strength: 0, bearSignals, bullSignals };
    // Lower threshold: 1.5x instead of 2x — easier to detect directional markets
    if (bearSignals >= bullSignals * 1.5) return { bias: "bear", strength: Math.min(100, bearSignals * 8), bearSignals, bullSignals };
    if (bullSignals >= bearSignals * 1.5) return { bias: "bull", strength: Math.min(100, bullSignals * 8), bearSignals, bullSignals };
    return { bias: "neutral", strength: Math.abs(bearSignals - bullSignals) * 8, bearSignals, bullSignals };
  } catch { return { bias: "neutral", strength: 0, bearSignals: 0, bullSignals: 0 }; }
}

function analyzeSentiment(candles, volume, rsi, atrPct) {
  try {
    if (candles.length < 40) return { score: 50, label: "Neutral", signal: 0 };
    const closes = candles.map(c => c.c);
    const recent20 = closes.slice(-20), recent5 = closes.slice(-5);
    const mom = (recent5[recent5.length - 1] - recent20[0]) / recent20[0] * 100;
    const avgVol = volume.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const recentVol = volume.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const volFactor = recentVol / (avgVol || 1);
    const volScore = atrPct > 3 ? -15 : atrPct > 2 ? -8 : atrPct < 0.5 ? 5 : 0;
    let score = clamp(50 + mom * 5 + (rsi - 50) * 0.3 + (volFactor > 1.5 ? (mom > 0 ? 8 : -8) : 0) + volScore, 0, 100);
    let label, signal;
    if (score >= 80) { label = "Extreme Greed"; signal = -1; }
    else if (score >= 60) { label = "Greed"; signal = -0.3; }
    else if (score <= 20) { label = "Extreme Fear"; signal = 1; }
    else if (score <= 40) { label = "Fear"; signal = 0.3; }
    else { label = "Neutral"; signal = 0; }
    return { score: Math.round(score), label, signal };
  } catch { return { score: 50, label: "Neutral", signal: 0 }; }
}

function detectCandlePatterns(candles) {
  try {
    if (candles.length < 4) return [];
    const patterns = [];
    const c = candles, L = c.length;
    const cur = c[L-1], prev = c[L-2], prev2 = c[L-3];
    const bodySize = c2 => Math.abs(c2.c - c2.o);
    const upperWick = c2 => c2.h - Math.max(c2.o, c2.c);
    const lowerWick = c2 => Math.min(c2.o, c2.c) - c2.l;
    const isBullish = c2 => c2.c > c2.o;
    const isBearish = c2 => c2.c < c2.o;
    const range = c2 => c2.h - c2.l || 0.0001;
    if (lowerWick(cur) > bodySize(cur) * 2 && upperWick(cur) < bodySize(cur) * 0.3 && isBearish(prev)) patterns.push({ name: "Hammer", signal: 1, weight: 12, desc: "Bullish reversal" });
    if (upperWick(cur) > bodySize(cur) * 2 && lowerWick(cur) < bodySize(cur) * 0.3 && isBearish(prev)) patterns.push({ name: "Inv Hammer", signal: 1, weight: 8, desc: "Potential bullish" });
    if (upperWick(cur) > bodySize(cur) * 2 && lowerWick(cur) < bodySize(cur) * 0.3 && isBullish(prev)) patterns.push({ name: "Shooting Star", signal: -1, weight: 12, desc: "Bearish reversal" });
    if (lowerWick(cur) > bodySize(cur) * 2 && upperWick(cur) < bodySize(cur) * 0.3 && isBullish(prev)) patterns.push({ name: "Hanging Man", signal: -1, weight: 8, desc: "Bearish after uptrend" });
    if (isBearish(prev) && isBullish(cur) && cur.c > prev.o && cur.o < prev.c) patterns.push({ name: "Bull Engulfing", signal: 1, weight: 15, desc: "Strong bullish" });
    if (isBullish(prev) && isBearish(cur) && cur.o > prev.c && cur.c < prev.o) patterns.push({ name: "Bear Engulfing", signal: -1, weight: 15, desc: "Strong bearish" });
    if (bodySize(cur) < range(cur) * 0.05) patterns.push({ name: "Doji", signal: 0, weight: 5, desc: "Indecision" });
    if (isBearish(prev2) && bodySize(prev) < bodySize(prev2) * 0.3 && isBullish(cur) && cur.c > prev2.o * 0.998) patterns.push({ name: "Morning Star", signal: 1, weight: 18, desc: "3-candle bullish" });
    if (isBullish(prev2) && bodySize(prev) < bodySize(prev2) * 0.3 && isBearish(cur) && cur.c < prev2.o * 1.002) patterns.push({ name: "Evening Star", signal: -1, weight: 18, desc: "3-candle bearish" });
    if (isBullish(prev2) && isBullish(prev) && isBullish(cur) && prev.c > prev2.c && cur.c > prev.c && bodySize(cur) > range(cur) * 0.5) patterns.push({ name: "3 White Soldiers", signal: 1, weight: 16, desc: "Bullish cont" });
    if (isBearish(prev2) && isBearish(prev) && isBearish(cur) && prev.c < prev2.c && cur.c < prev.c && bodySize(cur) > range(cur) * 0.5) patterns.push({ name: "3 Black Crows", signal: -1, weight: 16, desc: "Bearish cont" });
    if (Math.abs(cur.l - prev.l) < range(cur) * 0.05 && isBearish(prev) && isBullish(cur)) patterns.push({ name: "Tweezer Bottom", signal: 1, weight: 10, desc: "Double bottom" });
    if (Math.abs(cur.h - prev.h) < range(cur) * 0.05 && isBullish(prev) && isBearish(cur)) patterns.push({ name: "Tweezer Top", signal: -1, weight: 10, desc: "Double top" });
    return patterns;
  } catch { return []; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MULTI-TIMEFRAME ANALYSIS ENGINE — See the big picture
// Fetches 5m, 15m, 1h, 4h candles and calculates RSI, EMA, MACD, trend on each
// Higher timeframes carry more weight: 4h(4x) > 1h(3x) > 15m(2x) > 5m(1x)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MTFEngine = {
  _cache: {},
  _lastFetch: 0,
  _fetchInterval: 60000, // fetch new MTF data every 60s max

  // Analyze a single timeframe's candles
  analyzeTimeframe(candles, label) {
    try {
      if (!candles || candles.length < 30) return { label, trend: "unknown", strength: 0, rsi: 50, emaSignal: "neutral", macdSignal: "neutral", valid: false };
      const closes = candles.map(c => c.c);
      const L = closes.length;
      const price = closes[L - 1];

      // RSI
      const rsi14 = calcRSI(closes, 14);
      const rsi = rsi14[L - 1] || 50;

      // EMAs
      const ema9 = calcEMA(closes, 9);
      const ema21 = calcEMA(closes, 21);
      const ema50 = calcEMA(closes, 50);
      const e9 = ema9[L - 1] || price;
      const e21 = ema21[L - 1] || price;
      const e50 = L > 50 ? (ema50[L - 1] || price) : null;

      // EMA signal
      let emaSignal = "neutral";
      if (price > e9 && e9 > e21) emaSignal = "bullish";
      else if (price < e9 && e9 < e21) emaSignal = "bearish";
      else if (price > e9) emaSignal = "mildBull";
      else if (price < e9) emaSignal = "mildBear";

      // MACD
      const mc = calcMACD(closes);
      const lastHist = mc.hist.length > 0 ? mc.hist[mc.hist.length - 1] : 0;
      const prevHist = mc.hist.length > 1 ? mc.hist[mc.hist.length - 2] : 0;
      let macdSignal = "neutral";
      if (lastHist > 0 && lastHist > prevHist) macdSignal = "bullish";
      else if (lastHist > 0) macdSignal = "mildBull";
      else if (lastHist < 0 && lastHist < prevHist) macdSignal = "bearish";
      else if (lastHist < 0) macdSignal = "mildBear";

      // Trend: price vs EMA50 + slope
      let trend = "neutral", strength = 0;
      if (e50 !== null) {
        const pctFromE50 = (price - e50) / e50 * 100;
        if (pctFromE50 < -1.5) { trend = "bearish"; strength = Math.min(100, Math.abs(pctFromE50) * 15); }
        else if (pctFromE50 > 1.5) { trend = "bullish"; strength = Math.min(100, pctFromE50 * 15); }
        else { trend = "neutral"; strength = Math.abs(pctFromE50) * 10; }
      } else {
        // No EMA50, use EMA9 vs EMA21
        const emaDiff = (e9 - e21) / e21 * 100;
        if (emaDiff < -0.3) { trend = "bearish"; strength = Math.min(100, Math.abs(emaDiff) * 30); }
        else if (emaDiff > 0.3) { trend = "bullish"; strength = Math.min(100, emaDiff * 30); }
      }

      // Recent momentum (last 5 candles)
      const mom = closes.length >= 6 ? (closes[L - 1] - closes[L - 6]) / closes[L - 6] * 100 : 0;

      return { label, trend, strength: Math.round(strength), rsi: Math.round(rsi), emaSignal, macdSignal, mom: +mom.toFixed(2), price, valid: true };
    } catch { return { label, trend: "unknown", strength: 0, rsi: 50, emaSignal: "neutral", macdSignal: "neutral", valid: false }; }
  },

  // Combine all timeframe signals into one verdict
  // Weights: 4h=4, 1h=3, 15m=2, 5m=1
  combineSignals(tf5m, tf15m, tf1h, tf4h) {
    try {
      const timeframes = [
        { data: tf5m, weight: 1 },
        { data: tf15m, weight: 2 },
        { data: tf1h, weight: 3 },
        { data: tf4h, weight: 4 },
      ].filter(t => t.data && t.data.valid);

      if (timeframes.length === 0) return { trend: "neutral", strength: 0, confidence: 0, aligned: false, bullTFs: 0, bearTFs: 0, details: [], valid: false };

      let bullScore = 0, bearScore = 0, totalWeight = 0;
      const details = [];

      for (const tf of timeframes) {
        const d = tf.data;
        const w = tf.weight;
        totalWeight += w;

        // Trend direction scoring
        let tfBull = 0, tfBear = 0;
        if (d.trend === "bullish") tfBull += 3 * w;
        else if (d.trend === "bearish") tfBear += 3 * w;

        // EMA alignment
        if (d.emaSignal === "bullish") tfBull += 2 * w;
        else if (d.emaSignal === "bearish") tfBear += 2 * w;
        else if (d.emaSignal === "mildBull") tfBull += 1 * w;
        else if (d.emaSignal === "mildBear") tfBear += 1 * w;

        // MACD direction
        if (d.macdSignal === "bullish") tfBull += 2 * w;
        else if (d.macdSignal === "bearish") tfBear += 2 * w;
        else if (d.macdSignal === "mildBull") tfBull += 1 * w;
        else if (d.macdSignal === "mildBear") tfBear += 1 * w;

        // RSI context
        if (d.rsi > 70) tfBear += 1 * w; // overbought on this TF
        else if (d.rsi < 30) tfBull += 1 * w; // oversold

        bullScore += tfBull;
        bearScore += tfBear;

        const dir = tfBull > tfBear ? "BULL" : tfBear > tfBull ? "BEAR" : "NEUTRAL";
        details.push({ tf: d.label, dir, rsi: d.rsi, ema: d.emaSignal, macd: d.macdSignal, trend: d.trend, str: d.strength });
      }

      const total = bullScore + bearScore;
      const bullPct = total > 0 ? bullScore / total * 100 : 50;
      const bearPct = total > 0 ? bearScore / total * 100 : 50;
      const diff = Math.abs(bullScore - bearScore);
      const maxPossible = totalWeight * 8; // max score per TF = 8
      const strength = Math.min(100, Math.round(diff / Math.max(maxPossible, 1) * 100));

      const bullTFs = details.filter(d => d.dir === "BULL").length;
      const bearTFs = details.filter(d => d.dir === "BEAR").length;
      const aligned = bullTFs >= 3 || bearTFs >= 3; // 3+ timeframes agree

      let trend = "neutral";
      if (bullScore > bearScore * 1.3) trend = "bullish";
      else if (bearScore > bullScore * 1.3) trend = "bearish";

      return {
        trend, strength, confidence: Math.round(Math.max(bullPct, bearPct)),
        aligned, bullTFs, bearTFs, totalTFs: timeframes.length,
        bullScore: Math.round(bullScore), bearScore: Math.round(bearScore),
        details, valid: true,
      };
    } catch { return { trend: "neutral", strength: 0, confidence: 50, aligned: false, bullTFs: 0, bearTFs: 0, details: [], valid: false }; }
  },

  // Fetch candles for a specific timeframe from Binance
  async fetchTFCandles(symbol, interval, limit, endpoints, corsProxies) {
    // Try direct endpoints first
    for (const ep of endpoints) {
      try {
        const res = await fetch(`${ep}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(d => ({ t: d[0], o: +d[1], h: +d[2], l: +d[3], c: +d[4], v: +d[5] }));
        }
      } catch { continue; }
    }
    // Try CORS proxies
    for (const proxy of corsProxies) {
      if (!proxy) continue;
      try {
        const url = `${proxy}${encodeURIComponent(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(d => ({ t: d[0], o: +d[1], h: +d[2], l: +d[3], c: +d[4], v: +d[5] }));
        }
      } catch { continue; }
    }
    return null;
  },

  // Fetch and analyze all timeframes
  async fetchAndAnalyze(symbol, endpoints, corsProxies) {
    try {
      // Rate limit: don't fetch more than once per minute
      if (Date.now() - this._lastFetch < this._fetchInterval && this._cache[symbol]) {
        return this._cache[symbol];
      }

      const [c5m, c15m, c1h, c4h] = await Promise.all([
        this.fetchTFCandles(symbol, "5m", 100, endpoints, corsProxies),
        this.fetchTFCandles(symbol, "15m", 100, endpoints, corsProxies),
        this.fetchTFCandles(symbol, "1h", 100, endpoints, corsProxies),
        this.fetchTFCandles(symbol, "4h", 100, endpoints, corsProxies),
      ]);

      const tf5m = this.analyzeTimeframe(c5m, "5m");
      const tf15m = this.analyzeTimeframe(c15m, "15m");
      const tf1h = this.analyzeTimeframe(c1h, "1h");
      const tf4h = this.analyzeTimeframe(c4h, "4h");

      const combined = this.combineSignals(tf5m, tf15m, tf1h, tf4h);

      const result = { tf5m, tf15m, tf1h, tf4h, combined, timestamp: Date.now(), live: !!(c5m || c15m || c1h || c4h) };

      this._cache[symbol] = result;
      this._lastFetch = Date.now();

      console.log(`[NEXUS] MTF: ${combined.trend} ${combined.strength}% (${combined.bullTFs}B/${combined.bearTFs}Bear) aligned=${combined.aligned} | 5m:${tf5m.trend} 15m:${tf15m.trend} 1h:${tf1h.trend} 4h:${tf4h.trend}`);
      return result;
    } catch(e) {
      console.warn("[NEXUS] MTF fetch error:", e);
      return this._cache[symbol] || { tf5m: null, tf15m: null, tf1h: null, tf4h: null, combined: { trend: "neutral", strength: 0, aligned: false, valid: false }, live: false };
    }
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI DECISION ENGINE v7 — 26 FACTORS + NEWS + SESSIONS + FAKE + BRAIN + SOCIAL + MACRO + MTF
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function aiDecision(candles, currentPrice, symbol, sessionPnl, sessionStart, positions, sessionTradeCount, news, session, socialFG, socialReddit, macroInfo, onChainInfo, mtfData) {
  const WAIT = (reasons, ind = {}, extra = {}) => ({
    action: "WAIT", confidence: 0, sl: 0, tp: 0, reasons, indicators: ind, bullScore: "50.0", bearScore: "50.0",
    riskLevel: "-", analysis: extra, sentiment: { score: 50, label: "-" }, patterns: [],
    newsImpact: { score: 0, bullCount: 0, bearCount: 0, fakeCount: 0 },
    fakeAlert: { isSuspicious: false, warnings: [], score: 0, level: "CLEAR" }, session: session || Sessions.getCurrent(),
  });

  try {
    if (!candles || candles.length < LEARNING_TICKS) return WAIT([`Learning... ${candles?.length || 0}/${LEARNING_TICKS} ticks`], {}, { phase: "LEARNING" });

    const closes = candles.map(c => c.c);
    const volumes = candles.map(c => c.v);
    const L = closes.length;
    const price = currentPrice;

    const rsi14 = calcRSI(closes, 14);
    const curRSI = rsi14[L-1] || 50, prevRSI = rsi14[L-2] || 50;
    const rsi7 = calcRSI(closes, 7);
    const curRSI7 = rsi7[L-1] || 50;
    const mc = calcMACD(closes);
    const lastHist = mc.hist.length > 0 ? mc.hist[mc.hist.length - 1] : 0;
    const prevHist = mc.hist.length > 1 ? mc.hist[mc.hist.length - 2] : 0;
    const macdDir = lastHist > 0 ? "bull" : "bear";
    const macdCross = (lastHist > 0 && prevHist <= 0) ? "bullCross" : (lastHist < 0 && prevHist >= 0) ? "bearCross" : "none";
    const bands = calcBB(closes, 20);
    const bbU = bands.upper[L-1], bbL = bands.lower[L-1], bbM = bands.middle[L-1];
    const bbWidth = bbU && bbL && bbM ? (bbU - bbL) / bbM * 100 : 2;
    const bbZone = bbL && price <= bbL * 1.003 ? "lower" : bbU && price >= bbU * 0.997 ? "upper" : "mid";
    const atrVal = calcATR(candles, 14);
    const atrPct = (atrVal / price) * 100;
    const ema9 = calcEMA(closes, 9), ema21 = calcEMA(closes, 21), ema50 = calcEMA(closes, 50);
    const curEma9 = ema9[L-1] || price, curEma21 = ema21[L-1] || price, curEma50 = L > 50 ? ema50[L-1] : null;
    const srsi = calcStochRSI(closes, 14, 14);
    const curSRSI = srsi[L-1] || 50;
    const vwapData = calcVWAP(candles);
    const curVWAP = vwapData[vwapData.length - 1] || price;
    const obvData = calcOBV(candles);
    const obvTrend = obvData[obvData.length - 1] - obvData[Math.max(0, obvData.length - 15)];
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volRatio = (volumes[L-1] || 0) / (avgVol || 1);
    const shortT = closes.slice(-5).reduce((a, v, i, arr) => i > 0 ? a + (v > arr[i-1] ? 1 : -1) : 0, 0);
    const medT = closes.slice(-15).reduce((a, v, i, arr) => i > 0 ? a + (v > arr[i-1] ? 1 : -1) : 0, 0);
    const trendStr = shortT * 1.5 + medT / 2;
    const mom5 = L > 5 ? (price - closes[L-6]) / closes[L-6] * 100 : 0;
    const mom20 = L > 20 ? (price - closes[L-21]) / closes[L-21] * 100 : 0;
    const recentHigh = Math.max(...candles.slice(-30).map(c => c.h));
    const recentLow = Math.min(...candles.slice(-30).map(c => c.l));
    const priceInRange = (price - recentLow) / (recentHigh - recentLow || 1);
    const nearSupport = priceInRange < 0.15;
    const nearResistance = priceInRange > 0.85;
    const regime = detectRegime(candles, atrVal, bbWidth);
    const marketBias = detectMarketBias(closes, price, curEma9, curEma21, curEma50, mom5, mom20, trendStr);
    console.log(`[NEXUS] MarketBias: ${marketBias.bias} ${marketBias.strength}% (bear=${marketBias.bearSignals} bull=${marketBias.bullSignals}) closes=${closes.length}`);
    const sentiment = analyzeSentiment(candles, volumes, curRSI, atrPct);
    const candlePatterns = detectCandlePatterns(candles);
    const newsImpact = NewsEngine.getNewsSentiment(news || [], symbol);
    const fakeAlert = FakeDetector.analyze(candles, volumes, price);
    const sessionInfo = session || Sessions.getCurrent();

    let greenStreak = 0, redStreak = 0;
    for (let i = L - 1; i > Math.max(0, L - 10); i--) { if (closes[i] > closes[i-1]) greenStreak++; else break; }
    for (let i = L - 1; i > Math.max(0, L - 10); i--) { if (closes[i] < closes[i-1]) redStreak++; else break; }

    const indicators = {
      rsi: curRSI, rsi7: curRSI7, macdDir, macdHist: lastHist, macdCross, atr: atrVal, atrPct, bbWidth, bbZone,
      ema9: curEma9, ema21: curEma21, ema50: curEma50, stochRSI: curSRSI, vwap: curVWAP, obvTrend,
      volRatio, trendStr, mom5, mom20, regime, sentiment: sentiment.score, greenStreak, redStreak,
      support: recentLow, resistance: recentHigh, newsScore: newsImpact.score, sessionName: sessionInfo.primary.name,
      marketBias: marketBias.bias, marketBiasStrength: marketBias.strength,
    };

    const sessionBal = sessionStart || INITIAL_BALANCE;
    const sessionLossPct = (sessionPnl / sessionBal) * 100;
    const isSessionPaused = sessionLossPct <= -SESSION_MAX_LOSS;
    const isMaxTrades = sessionTradeCount >= MAX_TRADES_PER_SESSION;
    const isFakeBlocked = fakeAlert.isSuspicious && fakeAlert.score > 50;

    // ═══ WEIGHTED SCORING — 28 FACTORS (now including MTF) ═══
    let bull = 0, bear = 0;
    const reasons = [];

    if (curRSI < 18) { bull += 28; reasons.push(`RSI extreme oversold ${fx(curRSI,0)}`); }
    else if (curRSI < 28) { bull += 20; reasons.push(`RSI oversold ${fx(curRSI,0)}`); }
    else if (curRSI < 40 && curRSI > prevRSI) { bull += 8; reasons.push(`RSI recovering ${fx(curRSI,0)}`); }
    else if (curRSI > 82) { bear += 28; reasons.push(`RSI extreme overbought ${fx(curRSI,0)}`); }
    else if (curRSI > 72) { bear += 20; reasons.push(`RSI overbought ${fx(curRSI,0)}`); }
    else if (curRSI > 60 && curRSI < prevRSI) { bear += 8; reasons.push(`RSI weakening ${fx(curRSI,0)}`); }

    if (curRSI < 35 && curRSI > prevRSI && closes[L-1] < closes[L-2]) { bull += 16; reasons.push("Bullish RSI divergence"); }
    if (curRSI > 65 && curRSI < prevRSI && closes[L-1] > closes[L-2]) { bear += 16; reasons.push("Bearish RSI divergence"); }

    if (macdCross === "bullCross") { bull += 22; reasons.push("MACD bullish crossover"); }
    else if (macdCross === "bearCross") { bear += 22; reasons.push("MACD bearish crossover"); }
    else if (lastHist > 0 && lastHist > prevHist) { bull += 8; reasons.push("MACD momentum rising"); }
    else if (lastHist < 0 && lastHist < prevHist) { bear += 8; reasons.push("MACD momentum falling"); }

    if (bbZone === "lower") { bull += 18; reasons.push("Price at lower BB - bounce zone"); }
    else if (bbZone === "upper") { bear += 18; reasons.push("Price at upper BB - reversal risk"); }
    if (bbWidth < 1.2) reasons.push("BB squeeze - breakout imminent");

    if (curEma9 > curEma21) { bull += 10; reasons.push("EMA 9>21 bullish"); } else { bear += 10; reasons.push("EMA 9<21 bearish"); }
    if (curEma50 !== null) { if (price > curEma50 && curEma9 > curEma50) { bull += 8; } else if (price < curEma50 && curEma9 < curEma50) { bear += 8; } }

    if (curSRSI < 8) { bull += 12; reasons.push("StochRSI deeply oversold"); } else if (curSRSI < 18) { bull += 6; }
    else if (curSRSI > 92) { bear += 12; reasons.push("StochRSI deeply overbought"); } else if (curSRSI > 82) { bear += 6; }

    if (price > curVWAP * 1.004) { bull += 5; reasons.push("Above VWAP"); } else if (price < curVWAP * 0.996) { bear += 5; reasons.push("Below VWAP"); }

    if (volRatio > 2.5) { const vDir = closes[L-1] > closes[L-2]; if (vDir) { bull += 14; reasons.push(`Vol spike ${fx(volRatio,1)}x bullish`); } else { bear += 14; reasons.push(`Vol spike ${fx(volRatio,1)}x bearish`); } }
    else if (volRatio > 1.5) { closes[L-1] > closes[L-2] ? bull += 6 : bear += 6; }

    if (obvTrend > 0 && closes[L-1] > closes[L-6]) { bull += 7; reasons.push("OBV confirms uptrend"); }
    else if (obvTrend < 0 && closes[L-1] < closes[L-6]) { bear += 7; reasons.push("OBV confirms downtrend"); }

    if (nearSupport) { bull += 10; reasons.push("Near support level"); }
    if (nearResistance) { bear += 10; reasons.push("Near resistance level"); }

    candlePatterns.forEach(p => { if (p.signal > 0) { bull += p.weight; reasons.push(`${p.name} - ${p.desc}`); } else if (p.signal < 0) { bear += p.weight; reasons.push(`${p.name} - ${p.desc}`); } });

    if (greenStreak >= 5) { bear += 10; reasons.push(`${greenStreak} green streak - exhaustion`); }
    if (redStreak >= 5) { bull += 10; reasons.push(`${redStreak} red streak - bounce due`); }

    if (mom5 > 1 && mom20 > 2) { bull += 8; reasons.push("Multi-TF momentum bullish"); }
    else if (mom5 < -1 && mom20 < -2) { bear += 8; reasons.push("Multi-TF momentum bearish"); }

    if (regime === "trending" && trendStr > 0) { bull += 6; reasons.push("Trending (bull)"); }
    else if (regime === "trending" && trendStr < 0) { bear += 6; reasons.push("Trending (bear)"); }
    if (regime === "squeeze") reasons.push("Squeeze - big move coming");
    if (regime === "volatile") reasons.push("High volatility - caution");

    // Local sentiment — context-aware: fear in bear market confirms trend
    if (marketBias.bias === "bear" && marketBias.strength > 30) {
      // In bear market, fear = confirmation, greed = contrarian sell
      if (sentiment.signal > 0.5) { /* extreme fear in bear = neutral, don't add bull */ reasons.push(`Fear (${sentiment.score}) in bear trend - confirmation`); }
      else if (sentiment.signal < -0.5) { bear += 10; reasons.push(`Greed (${sentiment.score}) in bear trend - sell`); }
      else if (sentiment.signal < 0) { bear += 4; }
    } else {
      // Normal/bull: traditional contrarian
      if (sentiment.signal > 0.5) { bull += 10; reasons.push(`Extreme Fear (${sentiment.score}) - contrarian buy`); }
      else if (sentiment.signal < -0.5) { bear += 10; reasons.push(`Extreme Greed (${sentiment.score}) - contrarian sell`); }
      else if (sentiment.signal > 0) { bull += 4; } else if (sentiment.signal < 0) { bear += 4; }
    }

    // ═══ REAL FEAR & GREED INDEX — CONTEXT-AWARE (v7.1) ═══
    // In bull/neutral markets: contrarian (buy fear, sell greed)
    // In bear markets: fear CONFIRMS trend, only contrarian on reversal signals
    const fg = socialFG || SocialEngine._fallbackFG();
    if (fg.live) {
      const isBearMarket = marketBias.bias === "bear" && marketBias.strength > 30;
      const isBullMarket = marketBias.bias === "bull" && marketBias.strength > 30;
      const hasReversalSignals = (curRSI < 25 && curRSI > prevRSI) || macdCross === "bullCross" || (nearSupport && candlePatterns.some(p => p.signal > 0));

      if (isBearMarket) {
        // ═══ BEAR MARKET: Fear confirms trend, don't fight it ═══
        if (fg.value <= 10) {
          if (hasReversalSignals) { bull += 8; reasons.push(`F&G Extreme Fear (${fg.value}) + reversal signals - cautious buy`); }
          else { bear += 6; reasons.push(`F&G Extreme Fear (${fg.value}) confirms bear trend`); }
        } else if (fg.value <= 20) {
          if (hasReversalSignals) { bull += 5; reasons.push(`F&G Fear (${fg.value}) + reversal signals`); }
          else { bear += 4; reasons.push(`F&G Fear (${fg.value}) confirms downtrend`); }
        } else if (fg.value <= 30) {
          // mild fear in bear market — neutral, slight bear confirmation
          bear += 2;
        } else if (fg.value >= 80) { bear += 18; reasons.push(`F&G Extreme Greed (${fg.value}) in bear market - strong sell`); }
        else if (fg.value >= 70) { bear += 12; reasons.push(`F&G Greed (${fg.value}) in bear market - sell`); }
      } else {
        // ═══ BULL/NEUTRAL MARKET: Traditional contrarian works ═══
        if (fg.value <= 10) { bull += 18; reasons.push(`F&G EXTREME FEAR (${fg.value}) - strong contrarian buy`); }
        else if (fg.value <= 20) { bull += 14; reasons.push(`F&G Extreme Fear (${fg.value}) - contrarian buy`); }
        else if (fg.value <= 30) { bull += 8; reasons.push(`F&G Fear (${fg.value}) - accumulation zone`); }
        else if (fg.value >= 90) { bear += 18; reasons.push(`F&G EXTREME GREED (${fg.value}) - strong contrarian sell`); }
        else if (fg.value >= 80) { bear += 14; reasons.push(`F&G Extreme Greed (${fg.value}) - contrarian sell`); }
        else if (fg.value >= 70) { bear += 8; reasons.push(`F&G Greed (${fg.value}) - caution zone`); }
      }
      // F&G trend amplifier — only in matching market direction
      if (fg.trend === "falling" && fg.value < 35 && !isBearMarket) { bull += 4; reasons.push("F&G falling \u2192 deeper fear (contrarian)"); }
      if (fg.trend === "rising" && fg.value > 65) { bear += 4; reasons.push("F&G rising \u2192 more greed"); }
    }

    // ═══ REDDIT SENTIMENT (r/Bitcoin) ═══
    const rd = socialReddit || SocialEngine._fallbackReddit();
    if (rd.live && Math.abs(rd.score) > 10) {
      if (rd.score > 40) { bull += 8; reasons.push(`Reddit strongly bullish (${rd.score})`); }
      else if (rd.score > 20) { bull += 5; reasons.push(`Reddit bullish (${rd.score})`); }
      else if (rd.score < -40) { bear += 8; reasons.push(`Reddit strongly bearish (${rd.score})`); }
      else if (rd.score < -20) { bear += 5; reasons.push(`Reddit bearish (${rd.score})`); }
    }

    // ═══ MACRO: S&P 500 + DXY + Gold ═══
    const macro = macroInfo || {};
    const macroSignal = MacroEngine.getMacroSignal(macro);
    if (macro.live && Math.abs(macroSignal.score) > 3) {
      if (macroSignal.score > 0) { bull += Math.min(12, macroSignal.score); reasons.push(`Macro: ${macroSignal.regime} (${macroSignal.reasons?.[0] || "risk-on"})`); }
      else { bear += Math.min(12, Math.abs(macroSignal.score)); reasons.push(`Macro: ${macroSignal.regime} (${macroSignal.reasons?.[0] || "risk-off"})`); }
    }

    // ON-CHAIN INTELLIGENCE
    const onChain = onChainInfo || {};
    const onChainSignal = OnChainEngine.getOnChainSignal(onChain);
    if (onChain.live && Math.abs(onChainSignal.score) > 2) {
      if (onChainSignal.score > 0) { bull += Math.min(10, onChainSignal.score); reasons.push(`On-chain: ${onChainSignal.reasons?.[0] || "bullish"}`); }
      else { bear += Math.min(10, Math.abs(onChainSignal.score)); reasons.push(`On-chain: ${onChainSignal.reasons?.[0] || "bearish"}`); }
    }

    // ═══ MULTI-TIMEFRAME ANALYSIS — The Big Picture (v7.2) ═══
    // Higher timeframes override 1-min noise. When 4h+1h agree, trade WITH them.
    const mtf = mtfData && mtfData.combined && mtfData.combined.valid ? mtfData.combined : null;
    if (mtf) {
      const mtfWeight = mtf.aligned ? 25 : 15; // Aligned TFs = much stronger signal
      if (mtf.trend === "bullish") {
        bull += mtfWeight;
        reasons.push(`MTF ${mtf.trend} ${mtf.strength}% (${mtf.bullTFs}/${mtf.totalTFs} TFs bull${mtf.aligned ? " ALIGNED" : ""})`);
      } else if (mtf.trend === "bearish") {
        bear += mtfWeight;
        reasons.push(`MTF ${mtf.trend} ${mtf.strength}% (${mtf.bearTFs}/${mtf.totalTFs} TFs bear${mtf.aligned ? " ALIGNED" : ""})`);
      }
      // When MTF strongly disagrees with 1-min signal, dampen the 1-min signal
      // Conservative: don't trade AGAINST the higher timeframes
      if (mtf.aligned && mtf.trend === "bearish" && bull > bear) {
        const dampening = Math.round((bull - bear) * 0.4);
        bear += dampening;
        reasons.push(`MTF bear aligned - dampening bull by ${dampening}`);
      }
      if (mtf.aligned && mtf.trend === "bullish" && bear > bull) {
        const dampening = Math.round((bear - bull) * 0.4);
        bull += dampening;
        reasons.push(`MTF bull aligned - dampening bear by ${dampening}`);
      }
      // Also upgrade marketBias when MTF and bias agree
      if (mtf.trend === "bearish" && marketBias.bias === "bear") {
        marketBias.strength = Math.min(100, marketBias.strength + 20);
      }
      if (mtf.trend === "bullish" && marketBias.bias === "bull") {
        marketBias.strength = Math.min(100, marketBias.strength + 20);
      }
    }

    if (newsImpact.confidence > 20) {
      if (newsImpact.score > 30) { bull += Math.min(18, Math.round(newsImpact.score * 0.3)); reasons.push(`News bullish (${newsImpact.bullCount} positive)`); }
      else if (newsImpact.score < -30) { bear += Math.min(18, Math.round(Math.abs(newsImpact.score) * 0.3)); reasons.push(`News bearish (${newsImpact.bearCount} negative)`); }
      if (newsImpact.fakeCount > 0) reasons.push(`${newsImpact.fakeCount} fake headlines filtered`);
    }

    const sessMod = Sessions.getSessionModifier(symbol, sessionInfo);
    if (sessMod > 0) { bull += sessMod; bear += sessMod; reasons.push(`${sessionInfo.primary.name} session - optimal`); }
    if (sessMod < 0) { reasons.push(`${sessionInfo.primary.name} - low liquidity`); }

    if (fakeAlert.isSuspicious) { bull = Math.round(bull * 0.6); bear = Math.round(bear * 0.6); reasons.push(`Manipulation detected (${fakeAlert.score}/100)`); }

    const total = bull + bear || 1;
    let bullPct = (bull / total) * 100;
    let bearPct = (bear / total) * 100;
    const rawConf = Math.abs(bullPct - bearPct);

    let riskLevel = "LOW";
    if (atrPct > 3 || volRatio > 3 || regime === "volatile") riskLevel = "HIGH";
    else if (atrPct > 1.5 || volRatio > 2) riskLevel = "MED";

    // ═══ TUNED THRESHOLDS v7.3 — Balance quality vs frequency ═══
    const confThreshold = riskLevel === "HIGH" ? 38 : riskLevel === "MED" ? 30 : 24;
    const pctThreshold = riskLevel === "HIGH" ? 64 : riskLevel === "MED" ? 58 : 54;

    let action = "WAIT";
    let sl = 0, tp = 0;
    let finalConf = rawConf;

    if (bullPct > pctThreshold && rawConf > confThreshold) {
      action = "LONG";
      // ═══ TIGHTER SL + MTF-AWARE LEVELS (v7.2) ═══
      // MTF confirms: moderate SL (trend supports bounce), wider TP (let it run)
      // MTF neutral: tight SL (no macro support), standard TP
      // MTF against: shouldn't reach here (blocked by gate), but extra tight
      const mtfDir = mtf ? mtf.trend : "neutral";
      const slMult = riskLevel === "HIGH" ? (mtfDir === "bullish" ? 2.0 : 1.8) : (mtfDir === "bullish" ? 1.5 : 1.2);
      const tpMult = riskLevel === "HIGH" ? (mtfDir === "bullish" ? 5.0 : 3.8) : (mtfDir === "bullish" ? 4.0 : 3.0);
      sl = price - atrVal * slMult;
      tp = price + atrVal * tpMult;
      const blockCheck = Brain.shouldBlock(indicators, "LONG", symbol);
      if (blockCheck.blocked) { action = "WAIT"; reasons.unshift("BRAIN: " + blockCheck.reason); }
      const wr = Brain.getWinRate(indicators, "LONG", symbol);
      if (wr.total >= 4 && wr.rate < 32) { action = "WAIT"; reasons.unshift(`Pattern WR ${fx(wr.rate,0)}% (${wr.wins}W/${wr.losses}L) - too low`); }
      finalConf += Brain.getConfidenceModifier(indicators, "LONG", symbol);
    } else if (bearPct > pctThreshold && rawConf > confThreshold) {
      action = "SHORT";
      const mtfDir = mtf ? mtf.trend : "neutral";
      const slMult = riskLevel === "HIGH" ? (mtfDir === "bearish" ? 2.0 : 1.8) : (mtfDir === "bearish" ? 1.5 : 1.2);
      const tpMult = riskLevel === "HIGH" ? (mtfDir === "bearish" ? 5.0 : 3.8) : (mtfDir === "bearish" ? 4.0 : 3.0);
      sl = price + atrVal * slMult;
      tp = price - atrVal * tpMult;
      const blockCheck = Brain.shouldBlock(indicators, "SHORT", symbol);
      if (blockCheck.blocked) { action = "WAIT"; reasons.unshift("BRAIN: " + blockCheck.reason); }
      const wr = Brain.getWinRate(indicators, "SHORT", symbol);
      if (wr.total >= 4 && wr.rate < 32) { action = "WAIT"; reasons.unshift(`Pattern WR ${fx(wr.rate,0)}% (${wr.wins}W/${wr.losses}L) - too low`); }
      finalConf += Brain.getConfidenceModifier(indicators, "SHORT", symbol);
    }

    // Log signal decision details
    if (action === "WAIT" && rawConf > 20) {
      console.log(`[NEXUS] 🔍 Signal check: bull=${fx(bullPct,0)}% bear=${fx(bearPct,0)}% need>${pctThreshold}% | rawConf=${fx(rawConf,0)}% need>${confThreshold} | risk=${riskLevel}`);
    }

    // ML Engine prediction
    let mlPrediction = { probability: 0.5, confidence: 0, available: false };
    if (action !== "WAIT" && MLEngine._trained) {
      const mlExtra = { fgIndex: fg?.value || 50, redditScore: rd?.score || 0, macroScore: macroSignal?.score || 0, onChainScore: onChainSignal?.score || 0 };
      mlPrediction = MLEngine.predict(indicators, action, mlExtra);
      if (mlPrediction.available && mlPrediction.confidence > 15) {
        const mlAdj = action === "LONG"
          ? (mlPrediction.probability - 0.5) * 20
          : (0.5 - mlPrediction.probability) * 20;
        finalConf += mlAdj;
        if (Math.abs(mlAdj) > 2) reasons.push(`ML ${mlPrediction.probability > 0.5 ? "bullish" : "bearish"} ${fx(mlPrediction.probability * 100, 0)}% (${mlAdj > 0 ? "+" : ""}${fx(mlAdj, 0)})`);
        if (mlPrediction.probability < 0.3 && action === "LONG") { action = "WAIT"; reasons.unshift(`ML warns LOW win prob ${fx(mlPrediction.probability * 100, 0)}%`); }
        if (mlPrediction.probability > 0.7 && action === "SHORT") { action = "WAIT"; reasons.unshift(`ML warns HIGH win prob ${fx(mlPrediction.probability * 100, 0)}%`); }
      }
    }

    finalConf = clamp(finalConf, 0, 95);
    if (action !== "WAIT" && positions.length >= MAX_POSITIONS) { action = "WAIT"; reasons.unshift(`Max ${MAX_POSITIONS} positions`); }
    // Stack-awareness: note when adding to existing position
    const samePairOpen = positions.filter(p => p.pair === symbol);
    if (action !== "WAIT" && samePairOpen.length > 0) {
      const nearest = Math.min(...samePairOpen.map(p => Math.abs(currentPrice - p.entry) / p.entry * 100));
      if (nearest < MIN_STACK_DISTANCE_PCT) { action = "WAIT"; reasons.unshift(`Stack too close (${nearest.toFixed(2)}% < ${MIN_STACK_DISTANCE_PCT}%)`); }
      else { reasons.unshift(`Stacking #${samePairOpen.length + 1} (${nearest.toFixed(1)}% from last)`); }
    }
    if (action !== "WAIT" && finalConf < MIN_CONF_TO_TRADE) { reasons.unshift(`Confidence ${fx(finalConf,0)}% < ${MIN_CONF_TO_TRADE}%`); action = "WAIT"; }

    let phase = action === "WAIT" ? "SCANNING" : "SIGNAL";
    if (isSessionPaused) { action = "PAUSE"; finalConf = 100; sl = 0; tp = 0; riskLevel = "CRITICAL"; phase = "SESSION_PAUSE"; reasons.unshift(`Session loss: ${fx(sessionLossPct, 1)}%`, "Pausing until new session or recovery"); }
    else if (isMaxTrades) { action = "WAIT"; sl = 0; tp = 0; phase = "MAX_TRADES"; reasons.unshift(`Max ${MAX_TRADES_PER_SESSION} trades this session`); }
    else if (isFakeBlocked) { action = "WAIT"; sl = 0; tp = 0; phase = "FAKE_DETECTED"; reasons.unshift("FAKE ALERT: " + (fakeAlert.warnings[0] || "Manipulation detected")); }

    return {
      action, confidence: finalConf, sl, tp, reasons: reasons.slice(0, 18), indicators, bullScore: fx(bullPct, 1), bearScore: fx(bearPct, 1), riskLevel,
      analysis: { phase, regime, marketBias: marketBias.bias, marketBiasStrength: marketBias.strength, candlePattern: candlePatterns.length > 0 ? candlePatterns[0].name : "None", totalFactors: 28, brainPatterns: Brain.losses.length + Brain.wins.length, mlTrained: MLEngine._trained, mtfTrend: mtf ? mtf.trend : "loading", mtfStrength: mtf ? mtf.strength : 0, mtfAligned: mtf ? mtf.aligned : false, mtfDetails: mtfData && mtfData.combined ? mtfData.combined.details : [] },
      sentiment, patterns: candlePatterns, newsImpact, fakeAlert, session: sessionInfo,
      socialFG: fg, socialReddit: rd, macroSignal, macroData: macro, onChainSignal, onChainData: onChain, mlPrediction,
    };
  } catch(err) { return WAIT(["AI engine error: " + (err?.message || "unknown")], {}, { phase: "ERROR" }); }
}

// ═══ CANDLESTICK CHART (SVG) ═══
function CandleChart({ candles, w = 900, h = 380 }) {
  try {
    if (!candles || candles.length < 5) return <div style={{ height: h, display: "flex", alignItems: "center", justifyContent: "center", color: K.txM, fontSize: 12 }}><div style={{ width: 18, height: 18, border: `2px solid ${K.bd}`, borderTopColor: K.warn, borderRadius: "50%", animation: "spin .7s linear infinite", marginRight: 8 }}/>Loading chart...</div>;
    const visible = candles.slice(-100);
    const pr = 54, pl = 2, pt = 6, pb = 18;
    const cw = (w - pl - pr) / visible.length;
    const allPrices = visible.flatMap(c => [c.h, c.l]);
    const min = Math.min(...allPrices), max = Math.max(...allPrices);
    const range = max - min || 1;
    const yPos = p => pt + ((max - p) / range) * (h - pt - pb);
    const maxVol = Math.max(...visible.map(c => c.v)) || 1;
    const closes = visible.map(c => c.c);
    const e9 = calcEMA(closes, 9), e21 = calcEMA(closes, 21);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="vG7" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={K.up} stopOpacity=".12"/><stop offset="1" stopColor={K.up} stopOpacity=".01"/></linearGradient>
          <linearGradient id="vR7" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={K.dn} stopOpacity=".12"/><stop offset="1" stopColor={K.dn} stopOpacity=".01"/></linearGradient>
        </defs>
        {[0,.25,.5,.75,1].map((frac, i) => { const p = min + range * (1 - frac); return <g key={i}><line x1={pl} y1={yPos(p)} x2={w-pr} y2={yPos(p)} stroke={K.bd} strokeWidth=".4" strokeDasharray="2,4"/><text x={w-pr+4} y={yPos(p)+3} fill={K.txM} fontSize="6.5" fontFamily="monospace">{fShort(p)}</text></g>; })}
        {visible.map((c, i) => { const g = c.c >= c.o; const cx = pl + i * cw + cw / 2; return <rect key={"v"+i} x={cx - cw * .38} y={h - pb - (c.v / maxVol) * 26} width={cw * .76} height={(c.v / maxVol) * 26} fill={g ? "url(#vG7)" : "url(#vR7)"}/>; })}
        {e9.length > 1 && <polyline fill="none" stroke={K.blue} strokeWidth=".7" opacity=".5" points={e9.map((v, i) => `${pl + i * cw + cw/2},${yPos(v)}`).join(" ")}/>}
        {e21.length > 1 && <polyline fill="none" stroke={K.purple} strokeWidth=".7" opacity=".5" points={e21.map((v, i) => `${pl + i * cw + cw/2},${yPos(v)}`).join(" ")}/>}
        {visible.map((c, i) => { const g = c.c >= c.o; const col = g ? K.up : K.dn; const bt = yPos(Math.max(c.o, c.c)); const bb = yPos(Math.min(c.o, c.c)); const cx = pl + i * cw + cw / 2; return <g key={i}><line x1={cx} y1={yPos(c.h)} x2={cx} y2={yPos(c.l)} stroke={col} strokeWidth=".6" opacity=".8"/><rect x={cx - cw * .32} y={bt} width={cw * .64} height={Math.max(.7, bb - bt)} fill={col} rx=".3" opacity=".9"/></g>; })}
        {visible.length > 0 && (() => { const lp = visible[visible.length - 1].c; const y = yPos(lp); const up = visible.length > 1 && lp >= visible[visible.length - 2].c; return <g><line x1={pl} y1={y} x2={w-pr} y2={y} stroke={up ? K.up : K.dn} strokeWidth=".5" strokeDasharray="3,3" opacity=".5"/><rect x={w-pr} y={y-6} width={50} height={12} rx={2} fill={up ? K.up : K.dn} opacity=".9"/><text x={w-pr+4} y={y+3} fill={up ? "#000" : "#fff"} fontSize="7" fontWeight="700" fontFamily="monospace">{fShort(lp)}</text></g>; })()}
        <text x={pl+2} y={h-3} fill={K.txM} fontSize="5.5" fontFamily="monospace"><tspan fill={K.blue}>- EMA9</tspan>{"  "}<tspan fill={K.purple}>- EMA21</tspan></text>
      </svg>
    );
  } catch { return <div style={{ height: h, display: "flex", alignItems: "center", justifyContent: "center", color: K.dn, fontSize: 11 }}>Chart error</div>; }
}

function SentimentGauge({ score, label }) {
  const col = score > 70 ? K.up : score > 55 ? "#8bc34a" : score > 45 ? K.gold : score > 30 ? K.warn : K.dn;
  return (<div style={{ textAlign: "center" }}><svg viewBox="0 0 100 55" width="100" height="55"><path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke={K.bd} strokeWidth="6" strokeLinecap="round"/><path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * 126} 126`} style={{ transition: "all .6s" }}/><text x="50" y="40" textAnchor="middle" fill={col} fontSize="16" fontWeight="800" fontFamily="monospace">{score}</text><text x="50" y="52" textAnchor="middle" fill={K.txD} fontSize="6" fontFamily="monospace">{label}</text></svg></div>);
}

function SessionClock({ session }) {
  if (!session) return null;
  const { active, volatilityExpected } = session;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {Sessions.zones.map(z => {
        const isActive = active.some(a => a.name === z.name);
        return (<div key={z.name} style={{ padding: "3px 8px", borderRadius: 8, fontSize: 9, fontWeight: 700, background: isActive ? z.color + "18" : "transparent", border: `1px solid ${isActive ? z.color + "40" : K.bd}`, color: isActive ? z.color : K.txM }}>{z.emoji} {z.name} {isActive ? "●" : "○"}</div>);
      })}
      <div style={{ fontSize: 8, color: K.txM, marginLeft: 4 }}>Vol: <span style={{ color: volatilityExpected === "EXTREME" ? K.dn : volatilityExpected === "VERY HIGH" ? K.warn : K.txD, fontWeight: 700 }}>{volatilityExpected}</span></div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN APPLICATION — 24/7 NON-STOP AI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function NexusV7() {
  const [pair, setPair] = useState(SYMBOLS[0]);
  const [timeframe, setTimeframe] = useState("15m");
  const [candles, setCandles] = useState([]);
  const [price, setPrice] = useState(0);
  const [change24h, setChange24h] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [endpointIdx, setEndpointIdx] = useState(0);

  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);

  const [sessionPnl, setSessionPnl] = useState(0);
  const [sessionStart, setSessionStart] = useState(INITIAL_BALANCE);
  const [sessionTradeCount, setSessionTradeCount] = useState(0);
  const [currentSession, setCurrentSession] = useState("-");
  const [sessionProfit, setSessionProfit] = useState(0);

  const [aiResult, setAiResult] = useState(null);
  const [aiActive, setAiActive] = useState(false);
  const [riskPct, setRiskPct] = useState(2);
  const [peakBalance, setPeakBalance] = useState(100);
  const [drawdownState, setDrawdownState] = useState(() => DrawdownManager.calculate(100, 100));
  const [journalReports, setJournalReports] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [mlStats, setMlStats] = useState(null);
  const [mlTraining, setMlTraining] = useState(false);
  const [brainStats, setBrainStats] = useState({ totalLosses: 0, totalWins: 0, weekLosses: 0, totalLossPrevented: 0, totalWinValue: 0, topBlocked: [], brainSize: 0 });
  const [mtfData, setMtfData] = useState(null); // Multi-Timeframe analysis (5m, 15m, 1h, 4h)
  const [backtestProgress, setBacktestProgress] = useState("");

  // ═══ STREAK & COOLDOWN TRACKING (PERSISTED — survives refresh) ═══
  const [consecutiveLosses, setConsecutiveLosses] = useState(() => DB.get("streak_losses", 0));
  const [consecutiveWins, setConsecutiveWins] = useState(() => DB.get("streak_wins", 0));
  const [cooldownUntil, setCooldownUntil] = useState(() => DB.get("cooldown_until", 0));
  const executionLockRef = useRef(false); // React-level double-trigger guard

  // ═══ DATA INTEGRITY SHIELD ═══
  const [lastDataUpdate, setLastDataUpdate] = useState(0); // ═══ FIX: Start at 0 — blocks SL/TP until real price arrives ═══
  const [hasLivePrice, setHasLivePrice] = useState(false);  // ═══ FIX: Only true after first REAL Binance price ═══
  const [dataFetchFails, setDataFetchFails] = useState(0);
  const STALE_TRADE_BLOCK = 30000;   // 30s — block new trades
  const STALE_SL_BLOCK = 60000;      // 60s — block SL/TP on stale price (could be wrong)
  const STALE_CRITICAL = 120000;     // 2min — force pause all activity
  const MAX_CANDLE_AGE = 180000;     // 3min — latest candle timestamp must be recent

  const [news, setNews] = useState([]);
  const [session, setSession] = useState(null);

  const [tab, setTab] = useState("chart");
  const [logs, setLogs] = useState([]);
  const [manualAmt, setManualAmt] = useState("5");
  const [manualSL, setManualSL] = useState("");
  const [manualTP, setManualTP] = useState("");

  const [uptime, setUptime] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Binance API connection
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [tradingMode, setTradingMode] = useState("paper"); // paper | live

  // ═══ LLM BRAIN STATE ═══
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [llmResult, setLlmResult] = useState(LLMEngine.getFallback());
  const [llmCalls, setLlmCalls] = useState(0);
  const [llmRefresh, setLlmRefresh] = useState(0);
  const [llmCountdown, setLlmCountdown] = useState(0);
  const llmStartRef = useRef(0);

  // ═══ SOCIAL + MACRO STATE ═══
  const [fgData, setFgData] = useState(SocialEngine._fallbackFG());
  const [redditData, setRedditData] = useState(SocialEngine._fallbackReddit());
  const [macroData, setMacroData] = useState({ sp500: null, dxy: null, gold: null, regime: "NEUTRAL", live: false, timestamp: 0 });
  const [onChainData, setOnChainData] = useState({ whales: OnChainEngine._fallbackWhales(), mempool: OnChainEngine._fallbackMempool(), exchangeFlow: OnChainEngine._fallbackExchangeFlow(), live: false, timestamp: 0 });

  // ═══ CLOUD SYNC STATE ═══
  const [cloudUrl, setCloudUrl] = useState("");
  const [cloudKey, setCloudKey] = useState("");
  const [cloudUserId, setCloudUserId] = useState("");
  const [cloudStatus, setCloudStatus] = useState("disconnected");
  const [lastCloudSync, setLastCloudSync] = useState(0);

  const addLog = useCallback((type, msg) => {
    setLogs(p => [{ id: uid(), type, msg, time: new Date().toLocaleTimeString() }, ...p].slice(0, 500));
  }, []);

  // ═══ INITIALIZE (LOAD PERSISTED STATE) ═══
  useEffect(() => {
    try {
      Brain.load();
      setBrainStats(Brain.getStats());
      StabilityEngine.load(); // ═══ STABILITY: restore trade throttle state ═══
      const saved = DB.get("state7", {});

      // ═══ CRASH RECOVERY: Validate state integrity before restoring ═══
      const validation = StabilityEngine.validateState(
        saved.balance, saved.positions, saved.history
      );
      if (!validation.valid) {
        console.warn("NEXUS Stability: State issues detected on startup:", validation.issues);
        for (const issue of validation.issues) {
          if (issue.field === "balance" && issue.fix !== undefined) {
            saved.balance = issue.fix;
            console.warn("  -> Fixed balance to:", issue.fix);
          }
          if (issue.field === "positions" && issue.fix) {
            saved.positions = issue.fix;
          }
          if (issue.field === "positions" && issue.fixIds) {
            // Remove corrupt positions, keep valid ones
            saved.positions = (saved.positions || []).filter(p => p.id && p.entry > 0 && p.qty > 0);
            console.warn("  -> Removed", issue.fixIds.length, "corrupt position(s)");
          }
          if (issue.field === "history" && issue.fix) {
            saved.history = issue.fix;
          }
        }
        // Re-save the cleaned state
        DB.set("state7", saved);
      }

      if (saved.balance !== undefined && saved.balance !== null) setBalance(saved.balance);
      if (saved.history) setHistory(saved.history);
      if (saved.positions) setPositions(saved.positions);
      if (saved.sessionPnl !== undefined) setSessionPnl(saved.sessionPnl);
      if (saved.sessionStart !== undefined) setSessionStart(saved.sessionStart);
      if (saved.sessionTradeCount !== undefined) setSessionTradeCount(saved.sessionTradeCount);
      if (saved.sessionProfit !== undefined) setSessionProfit(saved.sessionProfit);
      if (saved.aiActive !== undefined) setAiActive(saved.aiActive);
      if (saved.riskPct !== undefined) setRiskPct(saved.riskPct);
      if (saved.peakBalance !== undefined) setPeakBalance(saved.peakBalance);

      // Init Trade Journal
      TradeJournal.init();
      setJournalReports(TradeJournal.getReports());

      // Init ML Engine
      MLEngine.init();
      setMlStats(MLEngine.getStats());

      // Load API settings (with hardcoded defaults for cross-device access)
      const DEFAULT_KEYS = {
        groqKey: "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",
        geminiKey: "",
      };
      const DEFAULT_CLOUD = {
        url: "https://weoveyphvuokmtlxwbgr.supabase.co",
        key: "sb_publishable_ISM6jc6EqMjTxZ4HwoNooQ_MuctWqkh",
        userId: "nexus1",
      };
      const apiSettings = DB.get("api_settings", {});
      const gk = apiSettings.groqKey || DEFAULT_KEYS.groqKey;
      const gmk = apiSettings.geminiKey || DEFAULT_KEYS.geminiKey;
      if (gk) { setGroqKey(gk.trim()); }
      if (gmk) { setGeminiKey(gmk.trim()); }
      if (apiSettings.apiKey) setApiKey(apiSettings.apiKey);
      if (apiSettings.tradingMode) setTradingMode(apiSettings.tradingMode);
      // Auto-save defaults if not already saved
      if (!apiSettings.groqKey && gk) {
        DB.set("api_settings", { ...apiSettings, groqKey: gk, geminiKey: gmk });
      }

      // Load Cloud Sync settings (with hardcoded defaults)
      const cloudSettings = DB.get("cloud_settings", {});
      const cUrl = cloudSettings.url || DEFAULT_CLOUD.url;
      const cKey = cloudSettings.key || DEFAULT_CLOUD.key;
      const cId = cloudSettings.userId || DEFAULT_CLOUD.userId;
      if (cUrl && cKey && cId) {
        setCloudUrl(cUrl);
        setCloudKey(cKey);
        setCloudUserId(cId);
        CloudSync.init(cUrl, cKey, cId);
        setCloudStatus("idle");
        // Auto-save defaults if not already saved
        if (!cloudSettings.url) {
          DB.set("cloud_settings", { url: cUrl, key: cKey, userId: cId });
        }
      }

      const sess = Sessions.getCurrent();
      setSession(sess);
      const savedSess = DB.get("currentSession", "");
      if (savedSess !== sess.primary.name) {
        DB.set("currentSession", sess.primary.name);
        setSessionPnl(0);
        setSessionTradeCount(0);
        setSessionProfit(0);
        setSessionStart(saved.balance || INITIAL_BALANCE);
        addLog("AI", `New session: ${sess.primary.emoji} ${sess.primary.name} - AI continues 24/7`);
      }
      setCurrentSession(sess.primary.name);

      const demo = FALLBACK_PRICES[SYMBOLS[0].sym];
      setCandles(genDemoCandles(demo.base, 200, demo.vol));
      setPrice(demo.base);
      console.warn(`[NEXUS] ⚠️ FALLBACK PRICE SET: $${demo.base} — SL/TP BLOCKED until live Binance price confirms (hasLivePrice=false)`);
      setChange24h((Math.random() - 0.4) * 5);
      setReady(true);
      addLog("AI", "NEXUS v7.3 online - 24/7 AI active - $" + fx(saved.balance || INITIAL_BALANCE) + " balance restored");
      addLog("AI", `Config: ${MAX_POSITIONS} max positions | ${MIN_STACK_DISTANCE_PCT}% min stack dist | ${MAX_TRADES_PER_SESSION} trades/session | MTF gate +3 | Dedup 15s | Gap 3s`);
      console.log("[NEXUS] 🚀 STARTUP: Balance=$" + fx(saved.balance || INITIAL_BALANCE) + " | Positions:" + (saved.positions?.length || 0) + " | History:" + (saved.history?.length || 0) + " | hasLivePrice=false (waiting for Binance)");
      if (saved.positions?.length > 0) {
        saved.positions.forEach(p => console.log(`[NEXUS] 📌 RESTORED POS: ${p.side} ${p.pairName} entry=$${p.entry?.toFixed(2)} qty=${p.qty?.toFixed(6)} cost=$${p.cost?.toFixed(2)}`));
      }
      if (!validation.valid) addLog("WARN", "Stability: " + validation.issues.length + " state issue(s) auto-repaired on startup");
      if (cooldownUntil > Date.now()) addLog("WARN", "Cooldown restored: " + Math.ceil((cooldownUntil - Date.now()) / 60000) + "min remaining from last session");
      addLog("AI", "Stability layer active: exec-lock + signal-dedup + crash-recovery + trade-throttle");
    } catch(e) { console.error("Init error:", e); setReady(true); }
  }, []);

  // Save state on every change
  useEffect(() => {
    if (!ready) return;
    DB.set("state7", { balance, history: history.slice(-700), positions, sessionPnl, sessionStart, sessionTradeCount, sessionProfit, aiActive, riskPct, peakBalance });
  }, [balance, history, positions, sessionPnl, sessionStart, sessionTradeCount, sessionProfit, aiActive, riskPct, peakBalance, ready]);

  // ═══ STABILITY: Persist streaks & cooldown (survive refresh) ═══
  useEffect(() => {
    if (!ready) return;
    DB.set("streak_losses", consecutiveLosses);
    DB.set("streak_wins", consecutiveWins);
    DB.set("cooldown_until", cooldownUntil);
  }, [consecutiveLosses, consecutiveWins, cooldownUntil, ready]);

  // Cloud sync — auto-push dirty keys every 60s
  useEffect(() => {
    if (!CloudSync.isConnected()) return;
    const i = setInterval(async () => {
      try {
        const result = await CloudSync.syncDirty();
        if (result.pushed > 0) {
          setCloudStatus("synced");
          setLastCloudSync(Date.now());
        }
      } catch { setCloudStatus("error"); }
    }, 60000);
    return () => clearInterval(i);
  }, [cloudUrl, cloudKey, cloudUserId]);

  // Uptime
  useEffect(() => { const i = setInterval(() => setUptime(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000); return () => clearInterval(i); }, []);

  // Session rotation (5min)
  useEffect(() => {
    const i = setInterval(() => {
      try {
        const sess = Sessions.getCurrent();
        setSession(sess);
        if (sess.primary.name !== currentSession) {
          setCurrentSession(sess.primary.name);
          setSessionPnl(0); setSessionTradeCount(0); setSessionProfit(0); setSessionStart(balance);
          DB.set("currentSession", sess.primary.name);
          addLog("AI", `Session change: ${sess.primary.emoji} ${sess.primary.name} - fresh targets`);
        }
      } catch {}
    }, 300000);
    return () => clearInterval(i);
  }, [currentSession, balance]);

  // Fetch news (2min)
  useEffect(() => {
    const fn = async () => { try { const n = await NewsEngine.fetchNews(); setNews(n); } catch {} };
    fn(); const i = setInterval(fn, 120000); return () => clearInterval(i);
  }, []);

  // ═══ FETCH FEAR & GREED (every 5 min — API updates every ~8 hours but we check often) ═══
  useEffect(() => {
    const fn = async () => {
      try {
        const fg = await SocialEngine.fetchFearGreed();
        setFgData(fg);
        if (fg.live && fg.isExtremeFear) addLog("SOCIAL", `F&G EXTREME FEAR: ${fg.value} — monitoring for signals`);
        if (fg.live && fg.isExtremeGreed) addLog("SOCIAL", `F&G EXTREME GREED: ${fg.value} — monitoring for signals`);
      } catch {}
    };
    fn(); const i = setInterval(fn, 300000); return () => clearInterval(i);
  }, []);

  // ═══ FETCH REDDIT SENTIMENT (every 3 min) ═══
  useEffect(() => {
    const fn = async () => {
      try {
        const rd = await SocialEngine.fetchRedditSentiment();
        setRedditData(rd);
      } catch {}
    };
    fn(); const i = setInterval(fn, 600000); return () => clearInterval(i); // 10min — Reddit rate-limits aggressively
  }, []);

  // ═══ FETCH MACRO DATA — S&P, DXY, Gold (every 10 min) ═══
  useEffect(() => {
    const fn = async () => {
      try {
        const macro = await MacroEngine.fetchMacroData();
        setMacroData(macro);
        if (macro.live && macro.regime === "RISK-OFF") addLog("MACRO", `RISK-OFF detected: S&P weak, DXY strong — BTC headwind`);
        if (macro.live && macro.regime === "RISK-ON") addLog("MACRO", `RISK-ON: S&P strong, DXY weak — BTC tailwind`);
      } catch {}
    };
    fn(); const i = setInterval(fn, 600000); return () => clearInterval(i);
  }, []);

  // ═══ FETCH ON-CHAIN DATA — Whales, Mempool, Network Health (every 2 min) ═══
  useEffect(() => {
    const fn = async () => {
      try {
        const oc = await OnChainEngine.fetchAll();
        setOnChainData(oc);
        if (oc.live && oc.mempool?.stress === "EXTREME") addLog("CHAIN", `Mempool EXTREME: ${oc.mempool.fastestFee} sat/vB — expect volatility`);
        if (oc.live && oc.whales?.activity === "VERY HIGH") addLog("CHAIN", `Whale activity VERY HIGH: ${oc.whales.txCount} txs in latest block`);
      } catch {}
    };
    fn(); const i = setInterval(fn, 120000); return () => clearInterval(i);
  }, []);

  // ═══ MULTI-TIMEFRAME ANALYSIS — 5m, 15m, 1h, 4h (every 60s) ═══
  useEffect(() => {
    if (!isLive) return; // Only fetch when live — don't waste API calls in demo
    const fn = async () => {
      try {
        const endpoints = [...ENDPOINTS.slice(endpointIdx), ...ENDPOINTS.slice(0, endpointIdx)];
        const result = await MTFEngine.fetchAndAnalyze(pair.sym, endpoints, CORS_PROXIES);
        setMtfData(result);
        if (result.live && result.combined.aligned) {
          addLog("MTF", `${result.combined.trend.toUpperCase()} aligned across ${result.combined.bullTFs + result.combined.bearTFs}/${result.combined.totalTFs} timeframes (${result.combined.strength}%)`);
        }
      } catch {}
    };
    fn(); const i = setInterval(fn, 60000); return () => clearInterval(i);
  }, [isLive, pair, endpointIdx]);

  // ═══ FETCH LIVE DATA ═══
  const fetchMarketData = useCallback(async () => {
    try {
      const endpoints = [...ENDPOINTS.slice(endpointIdx), ...ENDPOINTS.slice(0, endpointIdx)];
      for (let i = 0; i < endpoints.length; i++) {
        try {
          const [klineRes, tickerRes] = await Promise.all([
            fetch(`${endpoints[i]}/api/v3/klines?symbol=${pair.sym}&interval=${timeframe}&limit=200`, { signal: AbortSignal.timeout(7000) }).then(r => r.json()),
            fetch(`${endpoints[i]}/api/v3/ticker/24hr?symbol=${pair.sym}`, { signal: AbortSignal.timeout(7000) }).then(r => r.json()),
          ]);
          if (Array.isArray(klineRes) && klineRes.length > 0) {
            setCandles(klineRes.map(d => ({ t: d[0], o: +d[1], h: +d[2], l: +d[3], c: +d[4], v: +d[5] })));
            if (!isLive) { setIsLive(true); addLog("AI", "Connected to LIVE Binance feed"); }
            if (i !== 0) setEndpointIdx(ENDPOINTS.indexOf(endpoints[i]));
            setLastDataUpdate(Date.now()); setDataFetchFails(0); setHasLivePrice(true);
          }
          if (tickerRes && tickerRes.lastPrice) { setPrice(+tickerRes.lastPrice); setChange24h(+tickerRes.priceChangePercent); setLastDataUpdate(Date.now()); setHasLivePrice(true); console.log("[NEXUS] ✅ LIVE price confirmed:", +tickerRes.lastPrice); }
          return;
        } catch { continue; }
      }
      // Try CORS proxies for UAE
      for (const proxy of CORS_PROXIES) {
        if (!proxy) continue;
        try {
          const url = `${proxy}${encodeURIComponent(`https://api.binance.com/api/v3/klines?symbol=${pair.sym}&interval=${timeframe}&limit=200`)}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCandles(data.map(d => ({ t: d[0], o: +d[1], h: +d[2], l: +d[3], c: +d[4], v: +d[5] })));
            setPrice(+data[data.length - 1][4]);
            if (!isLive) { setIsLive(true); addLog("AI", "Connected via CORS proxy"); }
            setLastDataUpdate(Date.now()); setDataFetchFails(0); setHasLivePrice(true);
            console.log("[NEXUS] ✅ LIVE price via proxy:", +data[data.length - 1][4]);
            return;
          }
        } catch { continue; }
      }
      // Fallback demo
      if (!isLive) {
        const demo = FALLBACK_PRICES[pair.sym] || FALLBACK_PRICES.BTCUSDT;
        setCandles(genDemoCandles(demo.base, 200, demo.vol));
        setPrice(demo.base + (Math.random() - 0.5) * demo.vol * 2);
        setChange24h(0); // ═══ HONEST: No fake 24h change in offline mode ═══
      } else {
        // ═══ DATA INTEGRITY: Track consecutive failures while live ═══
        setDataFetchFails(prev => {
          const fails = prev + 1;
          if (fails === 3) addLog("WARN", "⚠ DATA STALE: 3 consecutive fetch failures — trades blocked until fresh data");
          if (fails >= 6) { addLog("ERR", "🚨 DATA CRITICAL: 6+ failures — consider pausing auto-trade"); }
          return fails;
        });
      }
    } catch {}
  }, [pair, timeframe, isLive, endpointIdx]);

  useEffect(() => { fetchMarketData(); }, [pair, timeframe]);
  useEffect(() => { const i = setInterval(fetchMarketData, 10000); return () => clearInterval(i); }, [fetchMarketData]);

  // Demo price sim (when offline)
  useEffect(() => {
    if (isLive) return;
    const i = setInterval(() => {
      try {
        const demo = FALLBACK_PRICES[pair.sym] || FALLBACK_PRICES.BTCUSDT;
        setPrice(p => Math.max(p * 0.96, Math.min(p * 1.04, p + (Math.random() - 0.49) * demo.vol * 0.25)));
        setCandles(prev => {
          if (!prev.length) return prev;
          const last = { ...prev[prev.length - 1] };
          last.c += (Math.random() - 0.49) * demo.vol * 0.12;
          last.h = Math.max(last.h, last.c); last.l = Math.min(last.l, last.c); last.v += Math.random() * 30;
          return [...prev.slice(0, -1), last];
        });
      } catch {}
    }, 2000);
    return () => clearInterval(i);
  }, [pair, isLive]);

  // ═══ AI ANALYSIS ═══
  useEffect(() => {
    try { 
      if (candles.length > 60 && price > 0) {
        const result = aiDecision(candles, price, pair.sym, sessionPnl, sessionStart, positions, sessionTradeCount, news, session, fgData, redditData, macroData, onChainData, mtfData);
        setAiResult(result);
        if (result && result.action !== "WAIT") {
          console.log(`[NEXUS] 🤖 AI DECISION: ${result.action} ${pair.name} | Conf:${result.confidence}% | SL:${result.sl||'none'} TP:${result.tp||'none'} | Bias:${result.indicators?.marketBias||'?'} ${result.indicators?.marketBiasStrength||0}%`);
        }
      }
    } catch {}
  }, [candles, price, pair, sessionPnl, sessionStart, positions, sessionTradeCount, news, session, onChainData, mtfData]);

  // ═══ AUTO-TRADING (AI FREE HAND) ═══
  // ═══ LLM BRAIN ANALYSIS (Gemini Flash) ═══
  const llmDataRef = useRef({ aiResult: null, candles: [], price: 0, fgData: null, redditData: null, macroData: null, brainStats: null, balance: 0, history: [] });
  useEffect(() => {
    llmDataRef.current = { aiResult, candles, price, fgData, redditData, macroData, brainStats, balance, history, mtfData };
  }, [aiResult, candles, price, fgData, redditData, macroData, brainStats, balance, history, mtfData]);

  useEffect(() => {
    if (!geminiKey && !groqKey) return;
    llmStartRef.current = Date.now();
    setLlmCountdown(15);
    let intervalId = null;
    
    const runLLM = async () => {
      const d = llmDataRef.current;
      if (!d.aiResult || !d.candles.length || d.price <= 0) return;
      try {
        const result = await LLMEngine.analyze(d.aiResult, d.candles, d.price, pair.sym, d.fgData, d.redditData, d.macroData, d.brainStats, d.balance, d.history, geminiKey, groqKey, d.mtfData);
        if (result) {
          if (result.error && !result.live && !LLMEngine._cache?.live && !result.error.includes("Quota") && !result.error.includes("limited")) {
            addLog("LLM", `Error: ${result.error}`);
          }
          if (result.live) {
            setLlmResult(result);
            setLlmCalls(c => c + 1);
            setLlmCountdown(0);
            if (result.override && result.action === "WAIT" && d.aiResult.action !== "WAIT") {
              addLog("LLM", "VETO " + d.aiResult.action + ": " + result.reasoning.slice(0, 80));
            } else if (result.override && result.action !== "WAIT" && d.aiResult.action === "WAIT" && result.conviction === "HIGH") {
              addLog("LLM", "OPPORTUNITY: " + result.action + " — " + result.reasoning.slice(0, 80));
            }
          }
        }
        // Adaptive interval — reschedule based on market state
        const next = LLMEngine.getNextInterval(d.aiResult);
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(runLLM, next);
      } catch(e) { addLog("LLM", "Call failed: " + (e?.message || "unknown")); }
    };
    const t = setTimeout(runLLM, 15000); // First call after 15s
    intervalId = setInterval(runLLM, 90000); // Initial 90s, then adaptive
    return () => { clearTimeout(t); if (intervalId) clearInterval(intervalId); };
  }, [geminiKey, groqKey, pair.sym, llmRefresh]);

  // LLM countdown ticker
  useEffect(() => {
    if ((!geminiKey && !groqKey) || llmResult?.live) return;
    const tick = setInterval(() => {
      if (LLMEngine._backoffUntil > Date.now()) {
        setLlmCountdown(Math.max(1, Math.ceil((LLMEngine._backoffUntil - Date.now()) / 1000)));
      } else if (LLMEngine._lastCall > 0) {
        const nextInt = LLMEngine.getNextInterval(llmDataRef.current?.aiResult);
        const nextCall = LLMEngine._lastCall + nextInt;
        const remaining = Math.max(0, Math.ceil((nextCall - Date.now()) / 1000));
        setLlmCountdown(remaining);
      } else {
        const elapsed = Math.floor((Date.now() - llmStartRef.current) / 1000);
        setLlmCountdown(Math.max(0, 15 - elapsed));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [geminiKey, groqKey, llmResult?.live]);

  useEffect(() => {
    try {
      if (!aiActive || !aiResult) return;
      // ═══ DEMO GUARD: Never auto-trade on fake/offline data ═══
      if (!isLive) { console.log("[NEXUS] ⏸ Trade skip: not live"); return; }
      if (!hasLivePrice) { console.log("[NEXUS] ⏸ Trade skip: no live price confirmed"); return; }
      if (aiResult.action === "WAIT" || aiResult.action === "PAUSE") { console.log(`[NEXUS] ⏸ AI says ${aiResult.action} (conf: ${Number(aiResult.confidence).toFixed(1)}%) | Reasons: ${(aiResult.reasons||[]).slice(0,3).join('; ')}`); return; }
      if ((geminiKey || groqKey) && llmResult?.live && llmResult.override && llmResult.action === "WAIT") { console.log("[NEXUS] ⏸ LLM override: WAIT"); return; }
      // ═══ POSITION STACKING GUARDS ═══
      const samePairPositions = positions.filter(p => p.pair === pair.sym);
      // Enforce minimum price distance between stacked entries
      if (samePairPositions.length > 0) {
        const tooClose = samePairPositions.some(p => {
          const dist = Math.abs(price - p.entry) / p.entry * 100;
          if (dist < MIN_STACK_DISTANCE_PCT) {
            console.log(`[NEXUS] ⏸ Stack blocked: ${pair.name} distance ${dist.toFixed(2)}% < ${MIN_STACK_DISTANCE_PCT}% min (entry $${p.entry.toFixed(2)} vs now $${price.toFixed(2)})`);
          }
          return dist < MIN_STACK_DISTANCE_PCT;
        });
        if (tooClose) return; // silently skip — entries too close to stack
      }
      if (positions.length >= MAX_POSITIONS) { console.log(`[NEXUS] ⏸ Max positions reached (${positions.length}/${MAX_POSITIONS})`); return; }

      // ═══ STABILITY: Execution lock — prevent React double-trigger ═══
      if (executionLockRef.current) { console.log("[NEXUS] ⏸ Execution lock active"); return; }
      if (StabilityEngine.isLocked()) { console.log("[NEXUS] ⏸ StabilityEngine locked"); return; }

      // ═══ STABILITY: Trade throttle — minimum 5s between trades ═══
      if (!StabilityEngine.canTradeNow()) { console.log("[NEXUS] ⏸ Trade throttle active"); return; }

      // ═══ STABILITY: Signal dedup — same signal won't fire twice in 30s ═══
      if (StabilityEngine.isDuplicate(aiResult.action, pair.sym, aiResult.confidence)) { console.log("[NEXUS] ⏸ Duplicate signal filtered"); return; }

      // ═══ CONSECUTIVE LOSS COOLDOWN ═══
      if (cooldownUntil > Date.now()) {
        const remaining = Math.ceil((cooldownUntil - Date.now()) / 60000);
        console.log(`[NEXUS] ⏸ Loss cooldown: ${remaining}min remaining`);
        return; // silently skip — cooldown active
      }

      // ═══ DATA INTEGRITY SHIELD — Block trades on stale data ═══
      const dataAge = Date.now() - lastDataUpdate;
      if (dataAge > STALE_TRADE_BLOCK) {
        console.log(`[NEXUS] ⏸ Stale data: ${Math.round(dataAge/1000)}s old > ${STALE_TRADE_BLOCK/1000}s limit`);
        return; // silently block — data too old for safe entry
      }
      // Validate candle freshness — latest candle should be recent
      if (candles.length > 0 && candles[candles.length - 1].t) {
        const candleAge = Date.now() - candles[candles.length - 1].t;
        if (candleAge > MAX_CANDLE_AGE) {
          console.log(`[NEXUS] ⏸ Stale candle: ${Math.round(candleAge/1000)}s old`);
          return; // candle data too old — API may be returning cached/stale klines
        }
      }

      // Drawdown escalation check
      if (drawdownState?.isPaused) { console.log("[NEXUS] ⏸ Drawdown pause active"); return; }

      // ═══ MTF ALIGNMENT GATE (v7.2) — Don't trade against the big picture ═══
      const mtfCombined = mtfData?.combined;
      console.log(`[NEXUS] 🧠 AI Signal: ${aiResult.action} ${pair.name} conf=${aiResult.confidence}% | MTF: ${mtfCombined?.valid ? mtfCombined.trend + " " + mtfCombined.strength + "%" + (mtfCombined.aligned ? " ALIGNED" : "") : "no data"} | Positions: ${positions.length}/${MAX_POSITIONS} (${samePairPositions.length} same pair)`);
      if (mtfCombined && mtfCombined.valid) {
        // HARD BLOCK: Never open a LONG when MTF is aligned bearish (or vice versa)
        if (aiResult.action === "LONG" && mtfCombined.trend === "bearish" && mtfCombined.aligned) {
          addLog("MTF", "BLOCKED LONG: 3+ timeframes aligned bearish — not fighting the trend");
          console.log("[NEXUS] 🚫 MTF HARD BLOCK: LONG vs aligned bearish");
          return;
        }
        if (aiResult.action === "SHORT" && mtfCombined.trend === "bullish" && mtfCombined.aligned) {
          addLog("MTF", "BLOCKED SHORT: 3+ timeframes aligned bullish — not fighting the trend");
          console.log("[NEXUS] 🚫 MTF HARD BLOCK: SHORT vs aligned bullish");
          return;
        }
        // SOFT GATE: When MTF is neutral or weak, require slightly higher confidence
        if (mtfCombined.trend === "neutral" || mtfCombined.strength < 20) {
          const requiredConf = MIN_CONF_TO_TRADE + 3;
          if (aiResult.confidence < requiredConf) {
            console.log(`[NEXUS] ⏸ MTF SOFT GATE: conf ${aiResult.confidence}% < ${requiredConf}% (neutral/weak MTF needs +3)`);
            return; // silently skip — MTF not confirming, need extra confidence
          }
        }
        // BONUS: When MTF confirms trade direction, boost confidence
        if (aiResult.action === "LONG" && mtfCombined.trend === "bullish") {
          // Trade is WITH the MTF trend — no extra gate needed
        }
        if (aiResult.action === "SHORT" && mtfCombined.trend === "bearish") {
          // Trade is WITH the MTF trend — no extra gate needed
        }
      }

      let tradeConf = aiResult.confidence;
      if ((geminiKey || groqKey) && llmResult?.live && llmResult.adjustConfidence) {
        tradeConf = Math.max(0, Math.min(95, tradeConf + llmResult.adjustConfidence));
      }

      // ═══ DYNAMIC SHORT CONFIDENCE — adapts to market bias + MTF (v7.2) ═══
      // Bull market: shorts need extra confidence (crypto upward bias)
      // Bear market: shorts get a BONUS (trend-aligned)
      // MTF aligned: additional boost/penalty
      if (aiResult.action === "SHORT") {
        const bias = aiResult?.indicators?.marketBias || "neutral";
        const biasStr = aiResult?.indicators?.marketBiasStrength || 0;
        if (bias === "bear" && biasStr > 40) {
          tradeConf += 4; // Bear market: shorts are trend-aligned, small boost
        } else if (bias === "bear") {
          // mild bear: no penalty, no bonus
        } else if (bias === "bull" && biasStr > 40) {
          tradeConf -= 12; // Strong bull: shorts heavily penalized
        } else {
          tradeConf -= 5; // Neutral: small penalty (was -8)
        }
        // MTF alignment bonus for shorts
        if (mtfCombined?.valid && mtfCombined.trend === "bearish" && mtfCombined.aligned) {
          tradeConf += 6; // All timeframes say down — high conviction short
          addLog("MTF", `Short +6 conf: MTF aligned bearish ${mtfCombined.strength}%`);
        }
        if (tradeConf < MIN_CONF_TO_TRADE) { console.log(`[NEXUS] ⏸ Conf too low after SHORT penalty: ${tradeConf.toFixed(0)}% < ${MIN_CONF_TO_TRADE}%`); return; }
      }

      // MTF alignment bonus for longs
      if (aiResult.action === "LONG" && mtfCombined?.valid && mtfCombined.trend === "bullish" && mtfCombined.aligned) {
        tradeConf += 6;
        addLog("MTF", `Long +6 conf: MTF aligned bullish ${mtfCombined.strength}%`);
      }

      if (tradeConf < MIN_CONF_TO_TRADE) { console.log(`[NEXUS] ⏸ Final conf too low: ${tradeConf.toFixed(0)}% < ${MIN_CONF_TO_TRADE}%`); return; }

      // Apply drawdown risk adjustment
      const ddResult = DrawdownManager.applyToTrade(riskPct, tradeConf, drawdownState);
      if (ddResult.blocked) { console.log("[NEXUS] ⏸ Drawdown manager blocked trade"); return; }

      if (balance < MIN_BALANCE) { addLog("WARN", "Balance too low"); return; }
      let effectiveRisk = ddResult.adjustedRisk || riskPct;

      // ═══ WIN STREAK MOMENTUM ═══
      // After 3+ consecutive wins, boost position size by 25% (max 50% boost at 5+)
      if (consecutiveWins >= 3) {
        const streakBoost = Math.min(0.5, (consecutiveWins - 2) * 0.125); // 12.5% per extra win
        effectiveRisk *= (1 + streakBoost);
        addLog("AI", `Win streak ${consecutiveWins} — size boost +${(streakBoost * 100).toFixed(0)}%`);
      }

      const amount = Math.max(1, balance * effectiveRisk / 100);
      // ═══ STACK SIZE DECAY — reduce size for 2nd/3rd stacked positions ═══
      const stackLevel = positions.filter(p => p.pair === pair.sym).length; // 0, 1, or 2
      const stackMultiplier = STACK_SIZE_DECAY[Math.min(stackLevel, STACK_SIZE_DECAY.length - 1)];
      const stackedAmount = Math.max(1, amount * stackMultiplier);
      if (stackLevel > 0) addLog("AI", `Stack level ${stackLevel + 1}: size ${(stackMultiplier * 100).toFixed(0)}% \u2014 $${stackedAmount.toFixed(2)}`);
      if (stackedAmount < 1) return;

      console.log(`[NEXUS] ✅ ALL GATES PASSED — EXECUTING: ${aiResult.action} ${pair.name} | Conf:${tradeConf.toFixed(0)}% | Amount:$${stackedAmount.toFixed(2)} | Stack:${stackLevel+1}/${MAX_POSITIONS} | SL:${aiResult.sl||'none'} TP:${aiResult.tp||'none'}`);

      // ═══ STABILITY: Lock execution, record signal, execute ═══
      executionLockRef.current = true;
      try {
        StabilityEngine.recordSignal(aiResult.action, pair.sym, aiResult.confidence);
        StabilityEngine.recordTrade();
        executeTrade(aiResult.action, stackedAmount, aiResult.sl, aiResult.tp, true);
      } finally {
        executionLockRef.current = false;
      }
    } catch {}
  }, [aiResult, aiActive, llmResult, drawdownState, cooldownUntil, lastDataUpdate, candles, isLive, mtfData, hasLivePrice]);

  // ═══ SL/TP MONITOR + MTF-AWARE SMART EXITS (v7.3 — Price Sanity + Stale Winner) ═══
  useEffect(() => {
    try {
      if (!price || positions.length === 0) return;

      // ═══ FIX: Block ALL exits until we have confirmed live price ═══
      if (!hasLivePrice) {
        console.log("[NEXUS] ⛔ SL/TP BLOCKED: No live price yet (hasLivePrice=false)");
        return;
      }

      // ═══ DATA INTEGRITY: Don't trigger SL/TP on stale prices ═══
      const dataAge = Date.now() - lastDataUpdate;
      if (dataAge > STALE_SL_BLOCK) {
        console.log(`[NEXUS] ⛔ SL/TP BLOCKED: Data stale (${Math.round(dataAge/1000)}s old > ${STALE_SL_BLOCK/1000}s limit)`);
        return;
      }

      const mtfCombined = mtfData?.combined;
      setPositions(prev => {
        let changed = false;
        const updated = prev.filter(p => {
          if (p.pair !== pair.sym) return true;

          // ═══ PRICE SANITY CHECK — Reject exits on impossible prices ═══
          const priceVsEntry = Math.abs(price - p.entry) / p.entry * 100;
          if (priceVsEntry > MAX_SANE_MOVE_PCT) {
            console.warn(`[NEXUS] 🚨 PRICE SANITY BLOCK: ${p.side} ${p.pairName} | Price $${price.toFixed(2)} is ${priceVsEntry.toFixed(1)}% from entry $${p.entry.toFixed(2)} | MAX_SANE=${MAX_SANE_MOVE_PCT}% | BLOCKING EXIT`);
            return true; // keep position, don't close on insane price
          }

          const pnl = p.side === "LONG" ? (price - p.entry) * p.qty : (p.entry - price) * p.qty;
          const pnlPct = (pnl / p.cost) * 100;
          const holdMins = (Date.now() - new Date(p.entryTime).getTime()) / 60000;

          // ═══ PERIODIC POSITION LOG (every price tick for open positions) ═══
          console.log(`[NEXUS] 📊 POS: ${p.side} ${p.pairName} | Entry:$${p.entry.toFixed(2)} Now:$${price.toFixed(2)} | PnL:${pnlPct.toFixed(2)}% ($${pnl.toFixed(2)}) | Hold:${holdMins.toFixed(0)}min | SL:$${(p.sl||0).toFixed(2)} TP:$${(p.tp||0).toFixed(2)}`);

          // ═══ MTF-AWARE TRAILING STOPS ═══
          const mtfConfirms = mtfCombined?.valid && (
            (p.side === "LONG" && mtfCombined.trend === "bullish") ||
            (p.side === "SHORT" && mtfCombined.trend === "bearish")
          );
          const mtfAgainst = mtfCombined?.valid && (
            (p.side === "LONG" && mtfCombined.trend === "bearish") ||
            (p.side === "SHORT" && mtfCombined.trend === "bullish")
          );
          const mtfAlignedAgainst = mtfAgainst && mtfCombined.aligned;

          // === TRAIL TO BREAKEVEN ===
          const beThreshold = mtfAgainst ? 1.2 : 2;
          if (pnlPct > beThreshold && p.sl) {
            const be = p.entry + (p.side === "LONG" ? 1 : -1) * (p.cost * FEE_RATE * 2 / p.qty);
            if (p.side === "LONG" && p.sl < be) { p.sl = be; addLog("AI", `Trail SL to breakeven ${p.pairName}${mtfAgainst ? " (MTF opposing)" : ""}`); console.log(`[NEXUS] 🔄 TRAIL BE: ${p.pairName} SL→$${be.toFixed(2)}`); }
            if (p.side === "SHORT" && p.sl > be) { p.sl = be; addLog("AI", `Trail SL to breakeven ${p.pairName}${mtfAgainst ? " (MTF opposing)" : ""}`); console.log(`[NEXUS] 🔄 TRAIL BE: ${p.pairName} SL→$${be.toFixed(2)}`); }
          }

          // === PROFIT TRAILING ===
          const trailThreshold = mtfConfirms ? 4.5 : mtfAgainst ? 2.5 : 3.5;
          const trailKeep = mtfConfirms ? 0.3 : mtfAgainst ? 0.55 : 0.4;
          if (pnlPct > trailThreshold && p.sl) {
            const trail = p.side === "LONG" ? price - (price - p.entry) * trailKeep : price + (p.entry - price) * trailKeep;
            if (p.side === "LONG" && trail > p.sl) { p.sl = trail; console.log(`[NEXUS] 🔄 PROFIT TRAIL: ${p.pairName} SL→$${trail.toFixed(2)} (keeping ${(trailKeep*100).toFixed(0)}%)`); }
            if (p.side === "SHORT" && trail < p.sl) { p.sl = trail; console.log(`[NEXUS] 🔄 PROFIT TRAIL: ${p.pairName} SL→$${trail.toFixed(2)} (keeping ${(trailKeep*100).toFixed(0)}%)`); }
          }

          // === MTF EARLY EXIT: Take profit when MTF turns against profitable position ===
          if (pnlPct > 1.5 && mtfAlignedAgainst) {
            addLog("MTF", `SMART EXIT: ${p.side} ${p.pairName} +${pnlPct.toFixed(1)}% — MTF aligned against, locking profit`);
            console.log(`[NEXUS] 🎯 MTF SMART EXIT: ${p.side} ${p.pairName} +${pnlPct.toFixed(1)}% at $${price.toFixed(2)}`);
            closeTrade(p, price, "MTF Smart Exit");
            changed = true;
            return false;
          }

          // === MTF FAST CUT: Cut losers faster when MTF confirms you're wrong ===
          if (pnlPct < -0.8 && mtfAlignedAgainst && holdMins > 5) {
            addLog("MTF", `FAST CUT: ${p.side} ${p.pairName} ${pnlPct.toFixed(1)}% — MTF aligned against, cutting loss early`);
            console.log(`[NEXUS] ✂️ MTF FAST CUT: ${p.side} ${p.pairName} ${pnlPct.toFixed(1)}% at $${price.toFixed(2)}`);
            closeTrade(p, price, "MTF Fast Cut");
            changed = true;
            return false;
          }

          // === TIME-BASED EXIT: Stale positions with no MTF support ===
          if (holdMins > 120 && pnlPct < 0 && !mtfConfirms && mtfCombined?.valid) {
            addLog("AI", `TIME EXIT: ${p.side} ${p.pairName} ${pnlPct.toFixed(1)}% after ${Math.round(holdMins)}min — no MTF support`);
            console.log(`[NEXUS] ⏰ TIME EXIT (loser): ${p.side} ${p.pairName} ${pnlPct.toFixed(1)}% held ${Math.round(holdMins)}min`);
            closeTrade(p, price, "Time Exit (no MTF support)");
            changed = true;
            return false;
          }

          // ═══ NEW: STALE WINNER EXIT — Don't let tiny profits sit forever ═══
          // If held >3hrs and profit is under 0.5%, close and free capital for better trades
          if (holdMins > STALE_WINNER_MINS && pnlPct > 0 && pnlPct < STALE_WINNER_MIN_PCT) {
            addLog("AI", `STALE WIN EXIT: ${p.side} ${p.pairName} +${pnlPct.toFixed(2)}% after ${Math.round(holdMins)}min — tiny profit, freeing capital`);
            console.log(`[NEXUS] 💤 STALE WINNER EXIT: ${p.side} ${p.pairName} +${pnlPct.toFixed(2)}% held ${Math.round(holdMins)}min`);
            closeTrade(p, price, "Stale Winner Exit");
            changed = true;
            return false;
          }

          // === EXTENDED WINNER HOLD: Let winners ride when MTF confirms ===
          if (pnlPct > 3 && mtfConfirms && mtfCombined.aligned && p.tp) {
            const tpDist = Math.abs(p.tp - p.entry);
            const extendedTp = p.side === "LONG" ? p.entry + tpDist * 1.3 : p.entry - tpDist * 1.3;
            if (p.side === "LONG" && extendedTp > p.tp) {
              addLog("MTF", `Extending TP: ${p.pairName} → $${extendedTp.toFixed(pair.dp)} (MTF aligned, letting winner run)`);
              console.log(`[NEXUS] 🚀 TP EXTEND: ${p.pairName} TP $${p.tp.toFixed(2)}→$${extendedTp.toFixed(2)}`);
              p.tp = extendedTp;
            }
            if (p.side === "SHORT" && extendedTp < p.tp) {
              addLog("MTF", `Extending TP: ${p.pairName} → $${extendedTp.toFixed(pair.dp)} (MTF aligned, letting winner run)`);
              console.log(`[NEXUS] 🚀 TP EXTEND: ${p.pairName} TP $${p.tp.toFixed(2)}→$${extendedTp.toFixed(2)}`);
              p.tp = extendedTp;
            }
          }

          // === STANDARD SL/TP HITS ===
          if (p.sl && ((p.side === "LONG" && price <= p.sl) || (p.side === "SHORT" && price >= p.sl))) {
            console.log(`[NEXUS] 🛑 STOP LOSS HIT: ${p.side} ${p.pairName} at $${price.toFixed(2)} (SL=$${p.sl.toFixed(2)})`);
            closeTrade(p, price, "Stop Loss"); changed = true; return false;
          }
          if (p.tp && ((p.side === "LONG" && price >= p.tp) || (p.side === "SHORT" && price <= p.tp))) {
            console.log(`[NEXUS] 🎯 TAKE PROFIT HIT: ${p.side} ${p.pairName} at $${price.toFixed(2)} (TP=$${p.tp.toFixed(2)})`);
            closeTrade(p, price, "Take Profit"); changed = true; return false;
          }
          return true;
        });
        return changed ? updated : prev;
      });
    } catch {}
  }, [price, lastDataUpdate, mtfData, hasLivePrice]);

  // ═══ TRADE EXECUTION ═══
  function executeTrade(side, amount, sl, tp, isAI = false) {
    try {
      // ═══ FIX: Block trades if no confirmed live price ═══
      if (!hasLivePrice) {
        console.warn(`[NEXUS] ⛔ TRADE BLOCKED: No live price confirmed yet`);
        addLog("WARN", "Trade blocked — waiting for live price confirmation");
        return;
      }
      if (amount > balance) { addLog("ERR", "Insufficient balance"); return; }
      if (balance < MIN_BALANCE) { addLog("ERR", `Min $${MIN_BALANCE} required`); return; }
      console.log(`[NEXUS] 🔔 OPENING: ${side} ${pair.name} | Amount:$${amount.toFixed(2)} | Price:$${price.toFixed(2)} | SL:${sl||'none'} TP:${tp||'none'}`);
      // ═══ REALISTIC EXECUTION: apply slippage on entry ═══
      const atrPct = aiResult?.indicators?.atrPct || 1;
      const fillPrice = simulateSlippage(price, side, atrPct);
      const slippageCost = Math.abs(fillPrice - price) * ((amount) / price);
      const entryFee = amount * FEE_RATE;
      const qty = (amount - entryFee) / fillPrice;
      const trade = {
        id: uid(), pair: pair.sym, pairName: pair.name, side, entry: fillPrice,
        qty, cost: amount, fee: entryFee, slippage: slippageCost,
        sl: sl ? +sl : 0, tp: tp ? +tp : 0,
        entryTime: new Date().toISOString(), isAI,
        isDemo: !isLive, // ═══ HONEST: Tag demo trades so Brain/ML can filter ═══
        indicators: aiResult ? { ...aiResult.indicators } : {},
        session: session?.primary?.name || "-",
      };
      setBalance(b => b - amount);
      setPositions(prev => [...prev, trade]);
      setSessionTradeCount(d => d + 1);
      addLog(isAI ? "AI" : "TRADE", `${side} ${qty.toFixed(6)} ${pair.name} @ $${fillPrice.toFixed(pair.dp)} (slip: $${fx(slippageCost,4)}) | $${fx(amount)}${sl ? ` SL:$${fx(sl, pair.dp)}` : ""}${tp ? ` TP:$${fx(tp, pair.dp)}` : ""}${!isLive ? " [DEMO]" : ""}`);
    } catch(e) { addLog("ERR", "Trade failed: " + (e?.message || "unknown")); }
  }

  function closeTrade(p, exitPrice, reason) {
    try {
      // ═══ PRICE SANITY CHECK — Reject impossible exits ═══
      const priceVsEntry = Math.abs(exitPrice - p.entry) / p.entry * 100;
      if (priceVsEntry > MAX_SANE_PNL_PCT) {
        console.error(`[NEXUS] 🚨 CLOSE BLOCKED — INSANE PRICE: ${p.side} ${p.pairName} exit $${exitPrice.toFixed(2)} is ${priceVsEntry.toFixed(1)}% from entry $${p.entry.toFixed(2)} | reason: ${reason} | This is likely a fallback/stale price bug`);
        addLog("ERR", `BLOCKED ${reason}: Price $${exitPrice.toFixed(0)} is ${priceVsEntry.toFixed(1)}% from entry — data error, not closing`);
        return; // DO NOT CLOSE — price is insane
      }
      console.log(`[NEXUS] 💰 CLOSING: ${p.side} ${p.pairName} | Entry:$${p.entry.toFixed(2)} Exit:$${exitPrice.toFixed(2)} (${priceVsEntry.toFixed(2)}% move) | Reason: ${reason}`);

      // ═══ REALISTIC EXECUTION: slippage on exit (reversed — works against you) ═══
      const exitSide = p.side === "LONG" ? "SHORT" : "LONG"; // closing is opposite direction
      const atrPct = aiResult?.indicators?.atrPct || 1;
      const realExit = simulateSlippage(exitPrice, exitSide, atrPct);
      const exitSlippage = Math.abs(realExit - exitPrice) * p.qty;
      const grossPnl = p.side === "LONG" ? (realExit - p.entry) * p.qty : (p.entry - realExit) * p.qty;
      const exitFee = realExit * p.qty * FEE_RATE;
      const netPnl = grossPnl - exitFee;
      const pct = (netPnl / p.cost) * 100;
      const totalFees = p.fee + exitFee;
      const totalSlippage = (p.slippage || 0) + exitSlippage;
      const isDemo = !isLive || p.isDemo;
      const record = { ...p, exit: realExit, exitTime: new Date().toISOString(), gross: grossPnl, exitFee, net: netPnl, pct, totalFees, totalSlippage, reason, isDemo };
      console.log(`[NEXUS] 📋 TRADE CLOSED: ${p.side} ${p.pairName} | Entry:$${p.entry.toFixed(2)} Exit:$${realExit.toFixed(2)} | Gross:$${grossPnl.toFixed(4)} Net:$${netPnl.toFixed(4)} (${pct.toFixed(2)}%) | Fees:$${totalFees.toFixed(4)} Slip:$${totalSlippage.toFixed(4)} | ${reason}${isDemo ? " [DEMO]" : ""}`);
      setHistory(prev => [record, ...prev]);
      setBalance(b => b + p.cost + netPnl);
      setSessionPnl(d => d + netPnl);
      if (netPnl > 0) {
        setSessionProfit(d => d + netPnl);
        // ═══ DEMO GUARD: Never pollute Brain with offline/demo data ═══
        if (!isDemo) Brain.recordWin({ symbol: p.pair, action: p.side, indicators: p.indicators, profit: netPnl });
        addLog("WIN", `${p.side} ${p.pairName} | ${fMoney(netPnl)} (${fPct(pct)}) | ${reason}${isDemo ? " [DEMO]" : ""}`);
        setConsecutiveWins(prev => prev + 1);
        setConsecutiveLosses(0);
      } else {
        // ═══ DEMO GUARD: Never pollute Brain with offline/demo data ═══
        if (!isDemo) Brain.recordLoss({ symbol: p.pair, action: p.side, indicators: p.indicators, loss: Math.abs(netPnl) });
        addLog("LOSS", `${p.side} ${p.pairName} | ${fMoney(netPnl)} (${fPct(pct)}) | ${reason}${isDemo ? " [DEMO]" : ""}`);
        setConsecutiveLosses(prev => {
          const newStreak = prev + 1;
          if (newStreak >= 3) {
            const cooldownMs = 5 * 60 * 1000; // 5 minutes
            setCooldownUntil(Date.now() + cooldownMs);
            addLog("WARN", `${newStreak} consecutive losses — AUTO-COOLDOWN 5min to prevent tilt trading`);
          }
          return newStreak;
        });
        setConsecutiveWins(0);
      }
      setBrainStats(Brain.getStats());
      // ML auto-retrain check
      if (MLEngine.needsRetrain()) {
        const result = MLEngine.train(150);
        if (result.success) { addLog("ML", `Auto-retrained: ${result.accuracy.toFixed(1)}% accuracy on ${result.samples} trades`); setMlStats(MLEngine.getStats()); }
      }
    } catch(e) { addLog("ERR", "Close failed: " + (e?.message || "unknown")); }
  }

  function manualClose(p) { closeTrade(p, price, "Manual Close"); setPositions(prev => prev.filter(x => x.id !== p.id)); }

  // ═══ STATS ═══
  const stats = useMemo(() => {
    try {
      const wins = history.filter(h => h.net > 0);
      const losses = history.filter(h => h.net <= 0);
      const total = wins.length + losses.length;
      const totalPnl = history.reduce((a, h) => a + h.net, 0);
      const totalFees = history.reduce((a, h) => a + (h.totalFees || 0), 0);
      const totalSlippage = history.reduce((a, h) => a + (h.totalSlippage || 0), 0);
      const winRate = total > 0 ? (wins.length / total) * 100 : 0;
      const avgWin = wins.length > 0 ? wins.reduce((a, h) => a + h.net, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((a, h) => a + Math.abs(h.net), 0) / losses.length : 0;
      const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
      return { wins: wins.length, losses: losses.length, total, totalPnl, totalFees, totalSlippage, winRate, avgWin, avgLoss, profitFactor };
    } catch { return { wins: 0, losses: 0, total: 0, totalPnl: 0, totalFees: 0, totalSlippage: 0, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0 }; }
  }, [history]);

  const equity = balance + positions.reduce((a, p) => {
    try { const cp = p.pair === pair.sym ? price : p.entry; return a + p.cost + (p.side === "LONG" ? (cp - p.entry) * p.qty : (p.entry - cp) * p.qty); } catch { return a; }
  }, 0);

  const uptimeStr = `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${uptime%60}s`;

  // ═══ DRAWDOWN ESCALATION ═══
  useEffect(() => {
    try {
      const newPeak = Math.max(peakBalance, balance);
      if (newPeak > peakBalance) setPeakBalance(newPeak);
      const dd = DrawdownManager.calculate(balance, newPeak);
      setDrawdownState(dd);
      if (dd.tier.name === "EMERGENCY" && drawdownState?.tier?.name !== "EMERGENCY") addLog("WARN", `EMERGENCY DRAWDOWN: ${dd.drawdownPct.toFixed(1)}% — trading PAUSED`);
      else if (dd.tier.name === "RECOVERY" && drawdownState?.tier?.name !== "RECOVERY") addLog("WARN", `RECOVERY MODE: ${dd.drawdownPct.toFixed(1)}% drawdown — risk reduced 75%`);
      else if (dd.tier.name === "CAUTIOUS" && drawdownState?.tier?.name !== "CAUTIOUS") addLog("WARN", `CAUTIOUS MODE: ${dd.drawdownPct.toFixed(1)}% drawdown — risk reduced 50%`);
      else if (dd.tier.name === "NORMAL" && drawdownState?.tier?.name !== "NORMAL" && drawdownState?.tier?.name) addLog("AI", `Drawdown recovered — back to NORMAL trading`);
    } catch {}
  }, [balance]);

  // ═══ STYLES ═══
  const S = {
    card: { background: K.s1, border: `1px solid ${K.bd}`, borderRadius: 12, padding: 16, marginBottom: 10 },
    btn: (active, color = K.warn) => ({ padding: "6px 14px", borderRadius: 6, border: `1px solid ${active ? color + "50" : K.bd}`, background: active ? color + "14" : "transparent", color: active ? color : K.txD, cursor: "pointer", fontSize: 10, fontWeight: 700, fontFamily: "inherit" }),
    input: { width: "100%", padding: "8px 10px", background: K.s2, border: `1px solid ${K.bd}`, borderRadius: 6, color: K.tx, fontFamily: "inherit", fontSize: 12, outline: "none" },
    badge: col => ({ padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700, background: col + "14", color: col, display: "inline-block" }),
    metric: { background: K.s2, borderRadius: 8, padding: "10px 12px", textAlign: "center" },
  };

  // ═══ LOADING SCREEN ═══
  if (!ready) return (
    <div style={{ background: K.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "'SF Mono',monospace" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${K.warn},#e8700a)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: "#000" }}>N</div>
      <div style={{ width: 28, height: 28, border: `2px solid ${K.bd}`, borderTopColor: K.warn, borderRadius: "50%", animation: "spin .7s linear infinite" }}/>
      <div style={{ color: K.txM, fontSize: 10, letterSpacing: 3, animation: "pulse 1.5s infinite" }}>NEXUS v7 | 24/7 AI | LOADING</div>
    </div>
  );

  // ═══ MAIN RENDER ═══
  return (
    <div style={{ background: K.bg, minHeight: "100vh", fontFamily: "'SF Mono','Fira Code','JetBrains Mono','Courier New',monospace", color: K.tx, fontSize: 12, width: "100%", margin: "0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes glow{0%,100%{box-shadow:0 0 10px ${K.warn}40}50%{box-shadow:0 0 22px ${K.warn}55}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}@keyframes slideIn{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:translateX(0)}}@keyframes breathe{0%,100%{opacity:.6}50%{opacity:1}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${K.bd};border-radius:2px}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;background:${K.bd}}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:${K.warn};cursor:pointer}select{-webkit-appearance:none}`}</style>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: `1px solid ${K.bd}`, background: "rgba(3,5,16,.97)", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(12px)", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${K.warn},#e8700a)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#000", animation: "glow 3s infinite" }}>N</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, background: `linear-gradient(90deg,${K.warn},${K.gold})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NEXUS v7</div>
            <div style={{ fontSize: 7, color: K.txM, letterSpacing: 1.2 }}>24/7 AI | {Brain.losses.length + Brain.wins.length} PATTERNS{BacktestEngine.countBacktestPatterns() > 0 ? ` (${BacktestEngine.countBacktestPatterns()} BT)` : ""} | {(geminiKey || groqKey) ? "LLM BRAIN ACTIVE" : "REALISTIC MODE"}{MLEngine._trained ? " | ML ACTIVE" : ""}{CloudSync.isConnected() ? " | \u2601 CLOUD" : ""}{drawdownState?.tier?.name !== "NORMAL" ? ` | ${drawdownState.tier.name}` : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ ...S.badge(K.cyan), fontSize: 7, animation: "breathe 3s infinite" }}>{uptimeStr}</span>
          {session && <span style={{ ...S.badge(session.primary.color || K.gold), fontSize: 7 }}>{session.primary.emoji} {session.primary.name}</span>}
          {aiActive && <span style={{ ...S.badge(K.up), fontSize: 8, animation: "pulse 1.5s infinite" }}>AI 24/7 ON</span>}
          {!aiActive && <span style={{ ...S.badge(K.txM), fontSize: 8 }}>AI OFF</span>}
          {consecutiveWins >= 3 && <span style={{ ...S.badge(K.up), fontSize: 7 }}>🔥 {consecutiveWins}W STREAK</span>}
          {consecutiveLosses >= 2 && <span style={{ ...S.badge(K.dn), fontSize: 7 }}>⚠ {consecutiveLosses}L</span>}
          {cooldownUntil > Date.now() && <span style={{ ...S.badge("#ff1744"), fontSize: 7, animation: "pulse 1.5s infinite" }}>{"\u2764"} COOLDOWN {Math.ceil((cooldownUntil - Date.now()) / 60000)}m</span>}
          <span style={{ ...S.badge("#00e5ff"), fontSize: 7 }}>{"\u26A1"} STABLE</span>
          {aiResult?.action === "PAUSE" && <span style={{ ...S.badge(K.dn), fontSize: 8 }}>PAUSED</span>}
          {(geminiKey || groqKey) && <span style={{ ...S.badge(llmResult?.live ? K.cyan : K.txM), fontSize: 7, animation: llmResult?.live ? "breathe 3s infinite" : "none" }}>LLM {llmResult?.live ? "ON" : "..."}</span>}
          {CloudSync.isConnected() && <span style={{ ...S.badge(cloudStatus === "synced" || cloudStatus === "idle" ? "#4caf50" : cloudStatus === "syncing" ? K.cyan : cloudStatus === "error" ? K.dn : K.txM), fontSize: 7 }}>☁ {cloudStatus === "synced" ? "SYNCED" : cloudStatus === "syncing" ? "SYNCING" : cloudStatus === "restored" ? "RESTORED" : cloudStatus === "idle" ? "CLOUD" : cloudStatus === "error" ? "SYNC ERR" : "CLOUD"}</span>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 7, color: K.txM, letterSpacing: 1.5 }}>ACCOUNT EQUITY</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: equity >= INITIAL_BALANCE ? K.up : K.dn }}>${fx(equity)}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, color: sessionPnl >= 0 ? K.up : K.dn }}>Session: {fMoney(sessionPnl)}</span>
            <span style={{ fontSize: 8, color: stats.totalPnl >= 0 ? K.up : K.dn }}>P&L: {fMoney(stats.totalPnl)}</span>
            <span style={{ fontSize: 8, color: K.warn }}>Costs: -${fx(stats.totalFees + stats.totalSlippage)}</span>
          </div>
        </div>
      </div>

      {/* SESSION BAR */}
      <div style={{ padding: "6px 20px", borderBottom: `1px solid ${K.bd}`, background: K.s1 }}>
        <SessionClock session={session}/>
      </div>

      {/* ═══ DEMO MODE BANNER — Honest visibility when offline ═══ */}
      {!isLive && <div style={{ padding: "10px 20px", background: "#ff1744", color: "#fff", fontWeight: 800, fontSize: 13, textAlign: "center", letterSpacing: 2, borderBottom: "2px solid #d50000", animation: "pulse 2s infinite" }}>
        ⚠ DEMO MODE — OFFLINE DATA — AI AUTO-TRADING DISABLED — CONNECT TO BINANCE FOR LIVE
      </div>}

      {/* PRICE BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", borderBottom: `1px solid ${K.bd}`, flexWrap: "wrap" }}>
        <select value={pair.sym} onChange={e => { setPair(SYMBOLS.find(s => s.sym === e.target.value)); setIsLive(false); }} style={{ background: K.s1, border: `1px solid ${K.bd}`, borderRadius: 6, padding: "6px 10px", color: K.tx, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>
          {SYMBOLS.map(s => <option key={s.sym} value={s.sym}>{s.icon} {s.name}</option>)}
        </select>
        <div style={{ fontSize: 22, fontWeight: 800, color: isLive ? (change24h >= 0 ? K.up : K.dn) : K.txM }}>${price.toFixed(pair.dp)}</div>
        {isLive ? <span style={S.badge(change24h >= 0 ? K.up : K.dn)}>{change24h >= 0 ? "▲" : "▼"}{Math.abs(change24h).toFixed(2)}%</span> : <span style={S.badge(K.txM)}>24h: N/A</span>}
        <span style={{ ...S.badge(isLive ? K.up : K.dn), animation: isLive ? "pulse 2s infinite" : "none" }}>{isLive ? "● LIVE" : "○ OFFLINE"}</span>
        {/* ═══ DATA INTEGRITY INDICATOR ═══ */}
        {(() => {
          const age = Date.now() - lastDataUpdate;
          const ageSec = Math.floor(age / 1000);
          if (age > STALE_CRITICAL) return <span style={{ ...S.badge("#ff1744"), animation: "pulse .5s infinite", fontWeight: 800 }}>🚨 DATA STALE {ageSec}s — PAUSED</span>;
          if (age > STALE_TRADE_BLOCK) return <span style={{ ...S.badge(K.warn), animation: "pulse 1s infinite" }}>⚠ STALE {ageSec}s</span>;
          if (dataFetchFails >= 3) return <span style={{ ...S.badge(K.warn) }}>⚠ {dataFetchFails} FAILS</span>;
          return isLive ? <span style={{ fontSize: 8, color: K.txD }}>{ageSec}s ago</span> : null;
        })()}
        <div style={{ marginLeft: "auto", display: "flex", gap: 3, flexWrap: "wrap" }}>
          {TIMEFRAMES.map(t => <button key={t} onClick={() => setTimeframe(t)} style={S.btn(timeframe === t)}>{t}</button>)}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 2, padding: "5px 20px", borderBottom: `1px solid ${K.bd}`, background: K.s1, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {[
          ["chart", "Chart"], ["ai", "AI"], ["news", "News"], ["trade", "Trade"],
          ["pos", `Pos (${positions.length})`], ["hist", "History"], ["stats", "Stats"],
          ["brain", "Brain"], ["journal", "Journal"], ["ml", "ML"], ["sessions", "Sessions"], ["settings", "Settings"], ["log", "Log"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 10px", borderRadius: 6, background: tab === id ? K.warn + "10" : "transparent", border: `1px solid ${tab === id ? K.warn + "30" : "transparent"}`, color: tab === id ? K.gold : K.txM, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "16px 20px", animation: "fadeIn .2s" }}>

        {/* CHART */}
        {tab === "chart" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 1.5, marginBottom: 8 }}>{pair.name}/USDT | {timeframe} | {candles.length} candles {isLive ? "| LIVE FEED" : "| OFFLINE"}{isLive && candles.length > 0 && candles[candles.length-1].t ? ` | Last candle: ${Math.floor((Date.now() - candles[candles.length-1].t)/1000)}s ago` : ""}</div>
          <CandleChart candles={candles}/>
        </div>}

        {/* AI ENGINE */}
        {tab === "ai" && aiResult && <div style={S.card}>
          <div style={{ fontSize: 8, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>AI ENGINE v7.2 | 28 FACTORS + SOCIAL + MACRO + ON-CHAIN + MTF {(geminiKey || groqKey) ? "+ LLM BRAIN" : ""} | {aiResult.analysis?.brainPatterns || 0} LEARNED | {session?.primary?.name} SESSION</div>

          {/* ═══ DRAWDOWN ESCALATION BAR ═══ */}
          <div style={{ marginBottom: 12, padding: 10, background: K.s2, borderRadius: 8, border: `1px solid ${drawdownState?.tier?.color || K.bd}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: K.txM, letterSpacing: 1.5, fontWeight: 700 }}>DRAWDOWN PROTECTION</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: drawdownState?.tier?.color || K.txD, padding: "2px 8px", background: (drawdownState?.tier?.color || K.txD) + "15", borderRadius: 4 }}>{drawdownState?.tier?.name || "NORMAL"}</div>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {DrawdownManager.TIERS.map((t, i) => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: drawdownState?.tier?.name === t.name ? t.color : t.color + "20", transition: "all .3s" }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: K.txD }}>DD: {fx(drawdownState?.drawdownPct || 0, 1)}% | Peak: ${fx(peakBalance, 2)} | Risk: {drawdownState?.tier?.riskMult !== undefined ? (drawdownState.tier.riskMult * 100).toFixed(0) : 100}%</div>
              <div style={{ fontSize: 8, color: drawdownState?.tier?.color || K.txD }}>{drawdownState?.tier?.desc || ""}</div>
            </div>
          </div>
          {aiResult.action === "PAUSE" && <div style={{ padding: 14, borderRadius: 8, marginBottom: 14, background: K.dnGlow, border: `1px solid ${K.dn}30` }}><div style={{ fontSize: 14, fontWeight: 800, color: K.dn, marginBottom: 4 }}>SESSION PAUSE</div>{aiResult.reasons.map((r, i) => <div key={i} style={{ fontSize: 10, color: K.txD, marginTop: 2 }}>{r}</div>)}<div style={{ fontSize: 9, color: K.txM, marginTop: 6 }}>AI resumes when session rotates.</div></div>}
          {aiResult.fakeAlert?.isSuspicious && <div style={{ padding: 12, borderRadius: 8, marginBottom: 14, background: "#ff980020", border: "1px solid #ff980040" }}><div style={{ fontSize: 11, fontWeight: 800, color: "#ff9800", marginBottom: 4 }}>MANIPULATION DETECTED</div>{aiResult.fakeAlert.warnings.map((w, i) => <div key={i} style={{ fontSize: 10, color: K.txD, marginTop: 2 }}>{w}</div>)}<div style={{ fontSize: 9, color: K.txM, marginTop: 4 }}>Score: {aiResult.fakeAlert.score}/100</div></div>}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: K.up }}>{aiResult.bullScore}%</div><div style={{ fontSize: 9, color: K.txM }}>BULL</div></div>
            <div style={{ width: 85, height: 85, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", background: aiResult.action === "LONG" ? `radial-gradient(circle,${K.up}18,transparent)` : aiResult.action === "SHORT" ? `radial-gradient(circle,${K.dn}18,transparent)` : `radial-gradient(circle,${K.gold}08,transparent)`, border: `2px solid ${aiResult.action === "LONG" ? K.up + "35" : aiResult.action === "SHORT" ? K.dn + "35" : K.bd}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: aiResult.action === "LONG" ? K.up : aiResult.action === "SHORT" || aiResult.action === "PAUSE" ? K.dn : K.gold }}>{aiResult.action}</div>
              <div style={{ fontSize: 9, color: K.txM }}>{fx(aiResult.confidence, 0)}% conf</div>
            </div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, color: K.dn }}>{aiResult.bearScore}%</div><div style={{ fontSize: 9, color: K.txM }}>BEAR</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 8, color: K.txM, textAlign: "center", marginBottom: 2 }}>TECH MOMENTUM</div><SentimentGauge score={aiResult.sentiment.score} label={aiResult.sentiment.label}/></div>
            <div><div style={{ fontSize: 8, color: K.txM, textAlign: "center", marginBottom: 2 }}>NEWS</div><SentimentGauge score={clamp(50 + (aiResult.newsImpact?.score || 0), 0, 100)} label={aiResult.newsImpact?.score > 20 ? "Bullish" : aiResult.newsImpact?.score < -20 ? "Bearish" : "Neutral"}/></div>
          </div>
          <div style={{ padding: 12, background: K.s2, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 8, color: K.txM, letterSpacing: 1.5, marginBottom: 4 }}>ANALYSIS (28 FACTORS + MTF + CHAIN{MLEngine._trained ? " + ML" : ""})</div>
            {aiResult.reasons.map((r, i) => <div key={i} style={{ padding: "4px 0", fontSize: 10, color: r.startsWith("BRAIN") ? K.purple : r.startsWith("LLM") ? K.cyan : r.startsWith("ML ") ? "#e040fb" : r.startsWith("On-chain") ? K.gold : r.startsWith("News") ? K.cyan : r.startsWith("FAKE") ? K.warn : r.startsWith("MTF") ? "#42a5f5" : K.txD, borderBottom: i < aiResult.reasons.length - 1 ? `1px solid ${K.bd}` : "none", animation: `slideIn .12s ${i * .03}s both`, fontWeight: r.startsWith("LLM") || r.startsWith("ML ") || r.startsWith("MTF") ? 700 : 400 }}>{r}</div>)}
          </div>
          {/* ML Prediction Bar */}
          {MLEngine._trained && aiResult?.mlPrediction?.available && <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", padding: "8px 12px", background: K.s2, borderRadius: 8, border: `1px solid ${"#e040fb"}20` }}>
            <div style={{ fontSize: 8, color: "#e040fb", fontWeight: 700, letterSpacing: 1 }}>ML</div>
            <div style={{ flex: 1, height: 8, background: K.s3, borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: K.txD + "40" }} />
              <div style={{ height: "100%", width: `${(aiResult.mlPrediction.probability * 100)}%`, background: aiResult.mlPrediction.probability > 0.55 ? K.up : aiResult.mlPrediction.probability < 0.45 ? K.dn : K.warn, borderRadius: 4, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: aiResult.mlPrediction.probability > 0.55 ? K.up : aiResult.mlPrediction.probability < 0.45 ? K.dn : K.warn }}>{(aiResult.mlPrediction.probability * 100).toFixed(0)}%</div>
            <div style={{ fontSize: 8, color: K.txD }}>win prob | {mlStats?.accuracy || 0}% acc</div>
          </div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setAiActive(!aiActive)} style={{ ...S.btn(aiActive, aiActive ? K.dn : K.up), padding: "10px 20px", fontSize: 13, background: aiActive ? K.dn + "15" : K.up + "15", fontWeight: 900 }}>
              {aiActive ? "⏸ STOP AI" : "▶ START AI (AUTO-TRADE)"}
            </button>
            <div style={{ fontSize: 9, color: K.txM }}>Risk:</div>
            <input type="range" min="0.5" max="5" step="0.5" value={riskPct} onChange={e => setRiskPct(+e.target.value)}/>
            <span style={{ fontSize: 10, color: K.gold, fontWeight: 700 }}>{riskPct}%</span>
          </div>
          {aiResult.sl > 0 && <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <div style={S.metric}><div style={{ fontSize: 8, color: K.dn }}>STOP LOSS</div><div style={{ fontSize: 13, fontWeight: 700, color: K.dn }}>${fx(aiResult.sl, pair.dp)}</div></div>
            <div style={S.metric}><div style={{ fontSize: 8, color: K.up }}>TAKE PROFIT</div><div style={{ fontSize: 13, fontWeight: 700, color: K.up }}>${fx(aiResult.tp, pair.dp)}</div></div>
            <div style={S.metric}><div style={{ fontSize: 8, color: K.txM }}>REGIME</div><div style={{ fontSize: 11, fontWeight: 700, color: K.gold }}>{aiResult.analysis?.regime || "-"}</div></div>
          </div>}
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ ...S.metric, border: aiResult.analysis?.marketBias === "bear" ? `1px solid ${K.dn}` : aiResult.analysis?.marketBias === "bull" ? `1px solid ${K.up}` : `1px solid ${K.txD}` }}><div style={{ fontSize: 8, color: K.txM }}>MKT BIAS</div><div style={{ fontSize: 13, fontWeight: 900, color: aiResult.analysis?.marketBias === "bear" ? K.dn : aiResult.analysis?.marketBias === "bull" ? K.up : K.warn }}>{(aiResult.analysis?.marketBias || "neutral").toUpperCase()} {aiResult.analysis?.marketBiasStrength > 0 ? `${aiResult.analysis.marketBiasStrength}%` : ""}</div></div>
            <div style={S.metric}><div style={{ fontSize: 8, color: K.txM }}>REGIME</div><div style={{ fontSize: 11, fontWeight: 700, color: K.gold }}>{aiResult.analysis?.regime || "-"}</div></div>
            <div style={{ ...S.metric, border: aiResult.analysis?.mtfTrend === "bearish" ? `1px solid ${K.dn}` : aiResult.analysis?.mtfTrend === "bullish" ? `1px solid ${K.up}` : `1px solid ${K.txD}`, minWidth: 90 }}>
              <div style={{ fontSize: 8, color: K.txM }}>MTF TREND</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: aiResult.analysis?.mtfTrend === "bearish" ? K.dn : aiResult.analysis?.mtfTrend === "bullish" ? K.up : K.warn }}>
                {(aiResult.analysis?.mtfTrend || "loading").toUpperCase()} {aiResult.analysis?.mtfStrength > 0 ? `${aiResult.analysis.mtfStrength}%` : ""}
              </div>
              <div style={{ fontSize: 7, color: K.txD }}>{aiResult.analysis?.mtfAligned ? "\u2705 ALIGNED" : ""} {mtfData?.live ? "\u25CF LIVE" : "\u25CB"}</div>
            </div>
          </div>

          {/* ═══ MTF TIMEFRAME BREAKDOWN ═══ */}
          {mtfData?.live && aiResult.analysis?.mtfDetails?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8, padding: "6px 8px", background: K.s2, borderRadius: 6, border: `1px solid ${K.bd}` }}>
            <div style={{ fontSize: 7, color: K.txM, fontWeight: 700, letterSpacing: 1, width: "100%", marginBottom: 2 }}>MULTI-TIMEFRAME</div>
            {aiResult.analysis.mtfDetails.map((d, i) => <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 6px", borderRadius: 4, background: d.dir === "BULL" ? K.up + "12" : d.dir === "BEAR" ? K.dn + "12" : K.s3, minWidth: 70 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: K.txM }}>{d.tf}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: d.dir === "BULL" ? K.up : d.dir === "BEAR" ? K.dn : K.txD }}>{d.dir}</span>
              <span style={{ fontSize: 7, color: K.txD }}>R{d.rsi}</span>
            </div>)}
          </div>}

          {/* ═══ SOCIAL DATA: F&G + Reddit + Macro ═══ */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>F&G INDEX</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: fgData.value <= 20 ? K.dn : fgData.value <= 40 ? K.warn : fgData.value >= 75 ? K.up : fgData.value >= 55 ? K.cyan : K.tx }}>{fgData.value}</div>
              <div style={{ fontSize: 7, color: K.txD }}>{fgData.label} {fgData.live ? <span style={{ color: K.up }}>● LIVE</span> : <span style={{ color: K.dn }}>○ OFFLINE</span>}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>REDDIT</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: redditData.score > 15 ? K.up : redditData.score < -15 ? K.dn : K.txD }}>{redditData.score > 0 ? "+" : ""}{redditData.score}</div>
              <div style={{ fontSize: 7, color: K.txD }}>{redditData.label} {redditData.live ? <span style={{ color: K.up }}>● LIVE</span> : <span style={{ color: K.dn }}>○ OFFLINE</span>}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>F&G TREND</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: fgData.trend === "rising" ? K.up : fgData.trend === "falling" ? K.dn : K.txD }}>{fgData.trend === "rising" ? "↑ rising" : fgData.trend === "falling" ? "↓ falling" : "→ stable"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>SOCIAL</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: fgData.live || redditData.live ? K.up : K.dn }}>{fgData.live || redditData.live ? "● LIVE" : "○ OFFLINE"}</div>
            </div>
          </div>

          {/* MACRO ROW */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <div style={{ fontSize: 9, color: K.txM, fontWeight: 700, display: "flex", alignItems: "center", paddingRight: 4 }}>MACRO</div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>S&P 500</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: macroData.sp500 ? (macroData.sp500.change >= 0 ? K.up : K.dn) : K.txM }}>{macroData.sp500 ? (macroData.sp500.change >= 0 ? "+" : "") + fx(macroData.sp500.change, 2) + "%" : "--"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>DXY</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: macroData.dxy ? (macroData.dxy.change >= 0 ? K.warn : K.up) : K.txM }}>{macroData.dxy ? (macroData.dxy.change >= 0 ? "+" : "") + fx(macroData.dxy.change, 2) + "%" : "--"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>GOLD</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: macroData.gold ? (macroData.gold.change >= 0 ? K.gold : K.dn) : K.txM }}>{macroData.gold ? (macroData.gold.change >= 0 ? "+" : "") + fx(macroData.gold.change, 1) + "%" : "--"}</div>
              {macroData.gold?.price && <div style={{ fontSize: 7, color: K.txD }}>${fShort(macroData.gold.price)}</div>}
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>REGIME</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: macroData.regime === "RISK-ON" || macroData.regime === "BULLISH" ? K.up : macroData.regime === "RISK-OFF" ? K.dn : macroData.regime === "CAUTIOUS" ? K.warn : K.txD }}>{macroData.regime || "NEUTRAL"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>STATUS</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: macroData.live ? K.up : K.dn }}>{macroData.live ? `● LIVE` : "○ OFFLINE"}</div>
              {macroData.source && <div style={{ fontSize: 7, color: K.txD }}>via {macroData.source}</div>}
            </div>
          </div>

          {/* ═══ ON-CHAIN DATA: Whales, Mempool, Network ═══ */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <div style={{ fontSize: 9, color: K.txM, fontWeight: 700, display: "flex", alignItems: "center", paddingRight: 4 }}>CHAIN</div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>BLOCK ACTIVITY</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: onChainData.whales?.activity === "VERY HIGH" ? K.up : onChainData.whales?.activity === "HIGH" ? K.cyan : K.txD }}>{onChainData.whales?.activity || "--"}</div>
              {onChainData.whales?.txCount > 0 && <div style={{ fontSize: 7, color: K.txD }}>{onChainData.whales.txCount} txs</div>}
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>MEMPOOL</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: onChainData.mempool?.stress === "EXTREME" ? K.dn : onChainData.mempool?.stress === "HIGH" ? K.warn : onChainData.mempool?.stress === "ELEVATED" ? K.gold : K.up }}>{onChainData.mempool?.stress || "--"}</div>
              {onChainData.mempool?.fastestFee > 0 && <div style={{ fontSize: 7, color: K.txD }}>{onChainData.mempool.fastestFee} sat/vB</div>}
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>PENDING</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: onChainData.whales?.unconfirmed > 150000 ? K.warn : K.txD }}>{onChainData.whales?.unconfirmed > 0 ? (onChainData.whales.unconfirmed / 1000).toFixed(0) + "K" : "--"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>NETWORK</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: onChainData.exchangeFlow?.minerConfidence === "STRONG" ? K.up : K.txD }}>{onChainData.exchangeFlow?.minerConfidence || "--"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>BLOCK</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: K.gold }}>{onChainData.whales?.blockHeight > 0 ? "#" + onChainData.whales.blockHeight.toLocaleString() : "--"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 8, color: K.txM }}>STATUS</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: onChainData.live ? K.up : K.dn }}>{onChainData.live ? "● LIVE" : "○ OFFLINE"}</div>
            </div>
          </div>

          {/* ═══ LLM BRAIN (Dual Provider: Groq + Gemini) ═══ */}
          <div style={{ marginTop: 14, padding: 12, background: (geminiKey || groqKey) ? K.cyan + "06" : K.s2, borderRadius: 8, border: `1px solid ${(geminiKey || groqKey) && llmResult?.live ? K.cyan + "30" : K.bd}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: K.cyan, letterSpacing: 1.5, fontWeight: 700 }}>LLM BRAIN {(geminiKey || groqKey) ? `(${llmResult?.provider?.toUpperCase() || LLMEngine._provider.toUpperCase()})` : "(NOT CONNECTED)"}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(geminiKey || groqKey) && <span style={{ ...S.badge(llmResult?.live ? K.cyan : LLMEngine._lastError && !LLMEngine._cache?.live && !LLMEngine._lastError.includes("limited") ? K.dn : K.txM), fontSize: 7 }}>{llmResult?.live ? "● LIVE" : LLMEngine._lastError && !LLMEngine._cache?.live && !LLMEngine._lastError.includes("limited") ? "● ERROR" : "○ WAITING"}</span>}
                {llmResult?.live && <span style={{ ...S.badge(K.txM), fontSize: 7 }}>{llmResult.latency}ms</span>}
                {llmResult?.live && <span style={{ ...S.badge(K.txM), fontSize: 7 }}>{llmResult.model}</span>}
                {LLMEngine._callCount > 0 && <span style={{ ...S.badge(K.txM), fontSize: 7 }}>{LLMEngine._callCount} calls</span>}
                {LLMEngine._skippedCount > 0 && <span style={{ ...S.badge(K.up), fontSize: 7 }}>{LLMEngine._skippedCount} saved</span>}
              </div>
            </div>
            {!(geminiKey || groqKey) && <div style={{ fontSize: 9, color: K.txD, padding: 8 }}>
              Add your free Groq API key (recommended) or Gemini key in Settings. The LLM analyzes every signal with AI reasoning — can veto bad trades or spot hidden opportunities.
              <div style={{ marginTop: 6, color: K.cyan }}>Get free Groq key: console.groq.com | Gemini: aistudio.google.com/apikey</div>
            </div>}
            {(geminiKey || groqKey) && !llmResult?.live && <div style={{ fontSize: 9, color: K.txD, padding: 8, textAlign: "center" }}>
              {LLMEngine._lastError && !LLMEngine._cache?.live && !LLMEngine._lastError.includes("limited")
                ? <><div style={{ color: K.dn, fontWeight: 700, marginBottom: 4 }}>LLM Error: {LLMEngine._lastError}</div><div>Provider: {LLMEngine._provider} | Retrying...</div></>
                : llmCountdown > 0
                  ? <><span style={{ color: K.cyan, fontWeight: 700, fontSize: 16 }}>{llmCountdown}</span><span style={{ color: K.txM, marginLeft: 6, fontSize: 9 }}>{LLMEngine._backoffUntil > Date.now() ? "quota cooldown" : LLMEngine._lastCall > 0 ? "next analysis" : "first analysis"}</span></>
                  : <span style={{ color: K.txM }}>LLM analyzing...</span>}
            </div>}
            {(geminiKey || groqKey) && llmResult?.live && <>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={S.metric}>
                  <div style={{ fontSize: 8, color: K.txM }}>LLM SAYS</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: llmResult.action === "LONG" ? K.up : llmResult.action === "SHORT" ? K.dn : K.gold }}>{llmResult.action}</div>
                </div>
                <div style={S.metric}>
                  <div style={{ fontSize: 8, color: K.txM }}>CONFIDENCE</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: llmResult.confidence >= 70 ? K.up : llmResult.confidence >= 40 ? K.gold : K.dn }}>{llmResult.confidence}%</div>
                </div>
                <div style={S.metric}>
                  <div style={{ fontSize: 8, color: K.txM }}>CONVICTION</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: llmResult.conviction === "HIGH" ? K.up : llmResult.conviction === "MEDIUM" ? K.gold : K.dn }}>{llmResult.conviction}</div>
                </div>
                <div style={S.metric}>
                  <div style={{ fontSize: 8, color: K.txM }}>CONF ADJUST</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: llmResult.adjustConfidence > 0 ? K.up : llmResult.adjustConfidence < 0 ? K.dn : K.txD }}>{llmResult.adjustConfidence > 0 ? "+" : ""}{llmResult.adjustConfidence}</div>
                </div>
                {llmResult.override && <div style={S.metric}>
                  <div style={{ fontSize: 8, color: K.warn }}>OVERRIDE</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: K.warn }}>YES</div>
                </div>}
              </div>
              <div style={{ fontSize: 10, color: K.tx, lineHeight: 1.5, padding: 8, background: K.s1, borderRadius: 6, marginBottom: 6 }}>
                <span style={{ color: K.cyan, fontWeight: 700 }}>REASONING: </span>{llmResult.reasoning}
              </div>
              {llmResult.risks && <div style={{ fontSize: 9, color: K.warn, padding: "4px 8px" }}>
                <span style={{ fontWeight: 700 }}>RISKS: </span>{llmResult.risks}
              </div>}
              <div style={{ marginTop: 8, fontSize: 9, color: K.txD, textAlign: "center" }}>
                {llmResult.action === aiResult?.action ?
                  <span style={{ color: K.up }}>Rule Engine + LLM AGREE on {llmResult.action}</span> :
                  <span style={{ color: K.warn }}>Rule Engine: {aiResult?.action} | LLM: {llmResult.action} {llmResult.override ? "(OVERRIDE ACTIVE)" : ""}</span>
                }
              </div>
            </>}
          </div>
        </div>}

        {/* NEWS */}
        {tab === "news" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>LIVE NEWS | AI CREDIBILITY SCORED | FAKE DETECTION</div>
          {news.length === 0 && <div style={{ color: K.txM, fontSize: 11, padding: 24, textAlign: "center" }}>Fetching news... (updates every 2 min)</div>}
          {news.map((n, i) => (
            <div key={n.id || i} style={{ padding: "10px 12px", borderBottom: `1px solid ${K.bd}`, animation: `slideIn .15s ${i * .04}s both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: n.sentiment.isFake ? K.dn : n.sentiment.label === "bullish" ? K.up : n.sentiment.label === "bearish" ? K.dn : K.tx, fontWeight: 600, lineHeight: 1.4 }}>{n.title}</div>
                  <div style={{ fontSize: 8, color: K.txM, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}><span>{n.source}</span><span>{timeAgo(n.time)} ago</span>{n.currencies?.length > 0 && <span style={{ color: K.gold }}>{n.currencies.join(", ")}</span>}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", minWidth: 75 }}>
                  <span style={{ ...S.badge(n.sentiment.isFake ? K.dn : n.credibility > 60 ? K.up : n.credibility > 35 ? K.gold : K.dn), fontSize: 8 }}>{n.sentiment.isFake ? "FAKE" : n.credibility > 60 ? "TRUSTED" : n.credibility > 35 ? "UNVERIFIED" : "SUSPICIOUS"}</span>
                  <span style={{ ...S.badge(n.sentiment.score > 20 ? K.up : n.sentiment.score < -20 ? K.dn : K.txD), fontSize: 8 }}>{n.sentiment.label === "bullish" ? "BULL" : n.sentiment.label === "bearish" ? "BEAR" : "NEUTRAL"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>}

        {/* TRADE */}
        {tab === "trade" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>MANUAL TRADE | {pair.name}/USDT</div>
          <div style={{ marginBottom: 10 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Amount ($)</div><input type="number" value={manualAmt} onChange={e => setManualAmt(e.target.value)} style={S.input}/></div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Stop Loss</div><input type="number" value={manualSL} onChange={e => setManualSL(e.target.value)} placeholder="Optional" style={S.input}/></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Take Profit</div><input type="number" value={manualTP} onChange={e => setManualTP(e.target.value)} placeholder="Optional" style={S.input}/></div>
          </div>
          {aiResult && aiResult.sl > 0 && <button onClick={() => { setManualSL(fx(aiResult.sl, pair.dp)); setManualTP(fx(aiResult.tp, pair.dp)); }} style={{ ...S.btn(false, K.purple), marginBottom: 10, fontSize: 9 }}>Use AI SL/TP</button>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => executeTrade("LONG", +manualAmt, +manualSL, +manualTP)} style={{ ...S.btn(true, K.up), flex: 1, padding: "12px 0", fontSize: 14 }}>LONG ↑</button>
            <button onClick={() => executeTrade("SHORT", +manualAmt, +manualSL, +manualTP)} style={{ ...S.btn(true, K.dn), flex: 1, padding: "12px 0", fontSize: 14 }}>SHORT ↓</button>
          </div>
        </div>}

        {/* POSITIONS */}
        {tab === "pos" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>OPEN POSITIONS | {positions.length}/{MAX_POSITIONS}</div>
          {positions.length === 0 && <div style={{ color: K.txM, fontSize: 11, textAlign: "center", padding: 24 }}>No open positions - AI scanning 24/7</div>}
          {positions.map(p => {
            const cp = p.pair === pair.sym ? price : p.entry;
            const pnl = p.side === "LONG" ? (cp - p.entry) * p.qty : (p.entry - cp) * p.qty;
            const pct = (pnl / p.cost) * 100;
            return (
              <div key={p.id} style={{ padding: 12, background: K.s2, borderRadius: 8, marginBottom: 8, border: `1px solid ${pnl >= 0 ? K.up + "20" : K.dn + "20"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div><span style={{ fontWeight: 700, color: p.side === "LONG" ? K.up : K.dn }}>{p.side}</span> <span style={{ color: K.gold }}>{p.pairName}</span> {p.isAI && <span style={{ ...S.badge(K.blue), fontSize: 7 }}>AI</span>}</div>
                  <div style={{ color: pnl >= 0 ? K.up : K.dn, fontWeight: 800, fontSize: 14 }}>{fMoney(pnl)} ({fPct(pct)})</div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 9, color: K.txD, flexWrap: "wrap" }}>
                  <span>Entry: ${fx(p.entry, pair.dp)}</span>
                  {p.sl > 0 && <span style={{ color: K.dn }}>SL: ${fx(p.sl, pair.dp)}</span>}
                  {p.tp > 0 && <span style={{ color: K.up }}>TP: ${fx(p.tp, pair.dp)}</span>}
                  <span>${fx(p.cost)}</span><span>⏱ {timeAgo(p.entryTime)} held</span>
                </div>
                <button onClick={() => manualClose(p)} style={{ ...S.btn(false, K.dn), marginTop: 8, fontSize: 9 }}>Close Position</button>
              </div>
            );
          })}
        </div>}

        {/* HISTORY */}
        {tab === "hist" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>TRADE HISTORY | LAST {Math.min(60, history.length)}</div>
          {history.slice(0, 60).map((h, i) => (
            <div key={h.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${K.bd}`, fontSize: 10, animation: `slideIn .1s ${i*.02}s both` }}>
              <div><span style={{ color: h.side === "LONG" ? K.up : K.dn, fontWeight: 700 }}>{h.side}</span> {h.pairName} {h.isAI && <span style={{ color: K.blue, fontSize: 8 }}>AI</span>}</div>
              <div style={{ color: h.net >= 0 ? K.up : K.dn, fontWeight: 700 }}>{fMoney(h.net)} ({fPct(h.pct)})</div>
              <div style={{ color: K.txM, fontSize: 8 }}>{h.reason} | {timeAgo(h.exitTime)}</div>
            </div>
          ))}
        </div>}

        {/* STATS */}
        {tab === "stats" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>PERFORMANCE ANALYTICS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 14 }}>
            {[["Trades", stats.total, K.tx], ["Win Rate", fx(stats.winRate,1)+"%", stats.winRate > 50 ? K.up : K.dn], ["Total P&L", fMoney(stats.totalPnl), stats.totalPnl >= 0 ? K.up : K.dn], ["Avg Win", fMoney(stats.avgWin), K.up], ["Avg Loss", "-$"+fx(stats.avgLoss), K.dn], ["Profit Factor", fx(stats.profitFactor,2), stats.profitFactor > 1 ? K.up : K.dn], ["Fees Paid", "$"+fx(stats.totalFees), K.warn], ["Slippage Cost", "$"+fx(stats.totalSlippage), K.warn], ["Total Costs", "$"+fx(stats.totalFees + stats.totalSlippage), "#ff4444"], ["Brain Size", brainStats.brainSize, K.purple], ["Session P&L", fMoney(sessionPnl), sessionPnl >= 0 ? K.up : K.dn], ["Uptime", uptimeStr, K.cyan]].map(([label, val, col]) => (
              <div key={label} style={S.metric}><div style={{ fontSize: 8, color: K.txM }}>{label}</div><div style={{ fontSize: 14, fontWeight: 800, color: col }}>{val}</div></div>
            ))}
          </div>

          {/* ═══ EQUITY CURVE CHART ═══ */}
          {(() => {
            try {
              const sorted = [...history].sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));
              if (sorted.length < 2) return <div style={{ padding: 20, textAlign: "center", color: K.txD, fontSize: 10 }}>Need 2+ trades for equity curve</div>;

              // Build equity points: start from INITIAL_BALANCE, accumulate net P&L
              const points = [{ bal: INITIAL_BALANCE, time: sorted[0]?.entryTime || sorted[0]?.time || sorted[0]?.exitTime, net: 0, label: "Start" }];
              let running = INITIAL_BALANCE;
              sorted.forEach(h => {
                running += h.net;
                points.push({ bal: running, time: h.exitTime, net: h.net, side: h.side, reason: h.reason, pairName: h.pairName });
              });

              // Chart dimensions
              const W = 340, H = 160, PAD = { t: 20, r: 16, b: 28, l: 42 };
              const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
              const minBal = Math.min(...points.map(p => p.bal)) * 0.98;
              const maxBal = Math.max(...points.map(p => p.bal)) * 1.02;
              const range = maxBal - minBal || 1;

              const x = (i) => PAD.l + (i / (points.length - 1)) * cW;
              const y = (val) => PAD.t + cH - ((val - minBal) / range) * cH;

              // Build SVG path
              const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.bal).toFixed(1)}`).join(" ");
              const areaPath = linePath + ` L${x(points.length-1).toFixed(1)},${(PAD.t+cH).toFixed(1)} L${PAD.l},${(PAD.t+cH).toFixed(1)} Z`;

              // Peak & trough for annotations
              let peakIdx = 0, troughIdx = 0, peakVal = 0, troughVal = Infinity;
              let maxDD = 0, maxDDIdx = 0, runPeak = 0;
              points.forEach((p, i) => {
                if (p.bal > peakVal) { peakVal = p.bal; peakIdx = i; }
                if (p.bal < troughVal) { troughVal = p.bal; troughIdx = i; }
                if (p.bal > runPeak) runPeak = p.bal;
                const dd = runPeak > 0 ? ((runPeak - p.bal) / runPeak) * 100 : 0;
                if (dd > maxDD) { maxDD = dd; maxDDIdx = i; }
              });

              // Y-axis labels (5 steps)
              const yLabels = [];
              for (let i = 0; i <= 4; i++) {
                const val = minBal + (range * i / 4);
                yLabels.push({ val, y: y(val) });
              }

              // Baseline ($100)
              const baseY = y(INITIAL_BALANCE);
              const finalBal = points[points.length - 1].bal;
              const totalReturn = ((finalBal - INITIAL_BALANCE) / INITIAL_BALANCE * 100);
              const isProfit = finalBal >= INITIAL_BALANCE;

              // Color scheme
              const curveColor = isProfit ? K.up : K.dn;

              return <div style={{ background: K.s2, borderRadius: 10, padding: "14px 10px 10px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 4px" }}>
                  <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, fontWeight: 700 }}>📈 EQUITY CURVE</div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ fontSize: 9, color: K.txM }}>Peak: <span style={{ color: K.up, fontWeight: 700 }}>${fx(peakVal)}</span></div>
                    <div style={{ fontSize: 9, color: K.txM }}>DD: <span style={{ color: K.dn, fontWeight: 700 }}>{fx(maxDD,1)}%</span></div>
                    <div style={{ fontSize: 9, color: K.txM }}>Return: <span style={{ color: curveColor, fontWeight: 700 }}>{totalReturn >= 0 ? "+" : ""}{fx(totalReturn,1)}%</span></div>
                  </div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={curveColor} stopOpacity="0.25"/>
                      <stop offset="100%" stopColor={curveColor} stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {yLabels.map((lb, i) => <g key={i}>
                    <line x1={PAD.l} y1={lb.y} x2={W-PAD.r} y2={lb.y} stroke={K.bd} strokeWidth="0.5" strokeDasharray="3,3"/>
                    <text x={PAD.l-4} y={lb.y+3} textAnchor="end" fill={K.txD} fontSize="7" fontFamily="'SF Mono',monospace">${fx(lb.val,0)}</text>
                  </g>)}
                  {/* Baseline $100 */}
                  {baseY >= PAD.t && baseY <= PAD.t+cH && <line x1={PAD.l} y1={baseY} x2={W-PAD.r} y2={baseY} stroke={K.txD} strokeWidth="0.7" strokeDasharray="5,3" opacity="0.5"/>}
                  {/* Area fill */}
                  <path d={areaPath} fill="url(#eqGrad)"/>
                  {/* Main line */}
                  <path d={linePath} fill="none" stroke={curveColor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
                  {/* Trade dots */}
                  {points.slice(1).map((p, i) => <circle key={i} cx={x(i+1)} cy={y(p.bal)} r={p.net >= 0 ? 2.5 : 2} fill={p.net >= 0 ? K.up : K.dn} opacity="0.8" stroke={K.s1} strokeWidth="0.5"/>)}
                  {/* Peak marker */}
                  <circle cx={x(peakIdx)} cy={y(peakVal)} r="3.5" fill="none" stroke={K.up} strokeWidth="1.2"/>
                  <text x={x(peakIdx)} y={y(peakVal)-6} textAnchor="middle" fill={K.up} fontSize="7" fontWeight="700" fontFamily="'SF Mono',monospace">ATH</text>
                  {/* Max drawdown marker */}
                  {maxDD > 2 && <g>
                    <circle cx={x(maxDDIdx)} cy={y(points[maxDDIdx].bal)} r="3.5" fill="none" stroke={K.dn} strokeWidth="1.2"/>
                    <text x={x(maxDDIdx)} y={y(points[maxDDIdx].bal)+11} textAnchor="middle" fill={K.dn} fontSize="6" fontWeight="700" fontFamily="'SF Mono',monospace">-{fx(maxDD,1)}%</text>
                  </g>}
                  {/* X-axis: first and last date */}
                  <text x={PAD.l} y={H-4} fill={K.txD} fontSize="6.5" fontFamily="'SF Mono',monospace">{new Date(points[0].time).toLocaleDateString("en",{month:"short",day:"numeric"})}</text>
                  <text x={W-PAD.r} y={H-4} textAnchor="end" fill={K.txD} fontSize="6.5" fontFamily="'SF Mono',monospace">{new Date(points[points.length-1].time).toLocaleDateString("en",{month:"short",day:"numeric"})}</text>
                  {/* Current equity endpoint */}
                  <circle cx={x(points.length-1)} cy={y(finalBal)} r="3" fill={curveColor}/>
                  <text x={x(points.length-1)-4} y={y(finalBal)-6} textAnchor="end" fill={curveColor} fontSize="7" fontWeight="700" fontFamily="'SF Mono',monospace">${fx(finalBal)}</text>
                </svg>
                {/* Legend */}
                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: K.txD }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: K.up }}/>Win
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: K.txD }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: K.dn }}/>Loss
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: K.txD }}>
                    <div style={{ width: 8, height: 1, background: K.txD }}/>$100 baseline
                  </div>
                </div>
              </div>;
            } catch { return null; }
          })()}

          {/* ═══ P&L DISTRIBUTION ═══ */}
          {(() => {
            try {
              if (history.length < 3) return null;
              // Bucket P&L into ranges
              const nets = history.map(h => h.net);
              const maxAbs = Math.max(...nets.map(Math.abs), 1);
              const bucketSize = maxAbs > 20 ? 5 : maxAbs > 10 ? 2 : maxAbs > 5 ? 1 : 0.5;
              const buckets = {};
              nets.forEach(n => {
                const key = Math.floor(n / bucketSize) * bucketSize;
                buckets[key] = (buckets[key] || 0) + 1;
              });
              const sorted = Object.entries(buckets).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
              const maxCount = Math.max(...sorted.map(([,c]) => c), 1);
              return <div style={{ background: K.s2, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, fontWeight: 700, marginBottom: 10 }}>📊 P&L DISTRIBUTION</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
                  {sorted.map(([bucket, count], i) => {
                    const bVal = parseFloat(bucket);
                    const pct = (count / maxCount) * 100;
                    const col = bVal >= 0 ? K.up : K.dn;
                    return <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ fontSize: 7, color: K.txD, marginBottom: 2 }}>{count}</div>
                      <div style={{ width: "100%", height: `${Math.max(pct, 8)}%`, background: col, borderRadius: "3px 3px 0 0", opacity: 0.7, minHeight: 3 }}/>
                      <div style={{ fontSize: 6, color: K.txD, marginTop: 2 }}>${bVal >= 0 ? "+" : ""}{fx(bVal,0)}</div>
                    </div>;
                  })}
                </div>
              </div>;
            } catch { return null; }
          })()}

        </div>}


        {/* BRAIN */}
        {tab === "brain" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>SELF-LEARNING BRAIN | {brainStats.brainSize} PATTERNS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 14 }}>
            {[["Losses Rec", brainStats.totalLosses, K.dn], ["Wins Rec", brainStats.totalWins, K.up], ["This Week", brainStats.weekLosses + " losses", K.warn], ["Loss Blocked", "$"+fx(brainStats.totalLossPrevented), K.dn], ["Win Value", "$"+fx(brainStats.totalWinValue), K.up]].map(([label, val, col]) => (
              <div key={label} style={S.metric}><div style={{ fontSize: 8, color: K.txM }}>{label}</div><div style={{ fontSize: 13, fontWeight: 700, color: col }}>{val}</div></div>
            ))}
          </div>
          {brainStats.topBlocked.length > 0 && <div style={{ padding: 10, background: K.s2, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 8, color: K.txM, marginBottom: 4 }}>TOP BLOCKED PATTERNS</div>
            {brainStats.topBlocked.slice(0, 5).map(([fp, count], i) => <div key={i} style={{ fontSize: 9, color: K.dn, padding: "3px 0", borderBottom: `1px solid ${K.bd}`, wordBreak: "break-all" }}>{fp.split("|").slice(0, 6).join(" | ")} - <span style={{ fontWeight: 700 }}>{count}x</span></div>)}
          </div>}
          <div style={{ padding: 10, background: K.s2, borderRadius: 8, fontSize: 9, color: K.txM, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: K.purple }}>HOW THE BRAIN WORKS</div>
            <div>Every trade creates a 12-dimension fingerprint</div>
            <div>Losing patterns blocked after 2 exact matches in 7 days</div>
            <div>Session-aware: learns which patterns fail per session</div>
            <div>Confidence boost for proven winners, penalty for losers</div>
            <div>Brain persists across page refreshes - never forgets</div>
          </div>
          {/* ML Engine Status */}
          <div style={{ padding: 10, background: "#e040fb" + "08", borderRadius: 8, fontSize: 9, color: K.txM, marginBottom: 12, border: `1px solid ${"#e040fb"}15` }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#e040fb" }}>ML NEURAL NETWORK</div>
            <div>Status: <span style={{ color: MLEngine._trained ? K.up : K.warn, fontWeight: 700 }}>{MLEngine._trained ? `TRAINED (${(mlStats?.accuracy || 0)}% accuracy)` : `COLLECTING DATA (${mlStats?.totalSamples || 0}/${mlStats?.minSamples || 30})`}</span></div>
            <div>Architecture: 20 inputs → 16 hidden → 8 hidden → 1 output</div>
            <div>Auto-retrains every {MLEngine.RETRAIN_EVERY} new trades</div>
            <div>Predicts win probability, adjusts confidence ±10 pts</div>
            <div>See ML tab for training controls and CSV export</div>
          </div>
          <button onClick={() => { Brain.reset(); setBrainStats(Brain.getStats()); addLog("AI", "Brain reset"); }} style={{ ...S.btn(false, K.dn), fontSize: 9 }}>Reset Brain</button>
          <button onClick={() => { const purged = Brain.purgeDemo(); setBrainStats(Brain.getStats()); addLog("AI", purged > 0 ? `Purged ${purged} unverified demo entries from Brain` : "No demo entries found \u2014 Brain is clean"); }} style={{ ...S.btn(false, K.warn), fontSize: 9 }}>Purge Demo Data</button>
          <button disabled={BacktestEngine.isRunning()} onClick={async () => {
            setBacktestProgress("Starting...");
            addLog("AI", "Pre-training Brain with historical BTC data...");
            const result = await BacktestEngine.run("BTCUSDT", (p) => setBacktestProgress(p));
            setBrainStats(Brain.getStats());
            if (result && !result.error) {
              addLog("AI", `Pre-train complete: ${result.total} patterns (${result.wins}W/${result.losses}L = ${result.winRate.toFixed(1)}% WR) from ${result.batches} batches`);
            } else {
              addLog("ERR", "Pre-train failed: " + (result?.error || "unknown"));
            }
            setTimeout(() => setBacktestProgress(""), 10000);
          }} style={{ ...S.btn(false, "#1565c0"), fontSize: 9, opacity: BacktestEngine.isRunning() ? 0.5 : 1 }}>
            {BacktestEngine.isRunning() ? "\u23F3 Training..." : "\uD83E\uDDE0 Pre-Train Brain (Historical)"}
          </button>
          {BacktestEngine.countBacktestPatterns() > 0 && <button onClick={() => {
            const purged = BacktestEngine.purge();
            setBrainStats(Brain.getStats());
            addLog("AI", `Purged ${purged} backtest patterns from Brain`);
          }} style={{ ...S.btn(false, "#6a1b9a"), fontSize: 9 }}>Purge Backtest ({BacktestEngine.countBacktestPatterns()})</button>}
          {backtestProgress && <div style={{ fontSize: 8, color: "#42a5f5", marginTop: 2 }}>{backtestProgress}</div>}
        </div>}

        {/* JOURNAL */}
        {tab === "journal" && <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2 }}>AI TRADE JOURNAL — LLM COACHING</div>
            <button onClick={async () => {
              try {
                setJournalLoading(true);
                const report = await TradeJournal.generateReport(history, stats, balance, INITIAL_BALANCE, brainStats, geminiKey, groqKey);
                setJournalReports(TradeJournal.getReports());
                if (report.error) addLog("WARN", "Journal: " + report.error);
                else addLog("AI", `Journal report generated: Grade ${report.grade}`);
              } catch(e) { addLog("ERR", "Journal failed"); }
              finally { setJournalLoading(false); }
            }} disabled={journalLoading} style={{ padding: "6px 16px", borderRadius: 6, background: (geminiKey || groqKey) ? K.cyan + "20" : K.s3, border: `1px solid ${(geminiKey || groqKey) ? K.cyan + "40" : K.bd}`, color: (geminiKey || groqKey) ? K.cyan : K.txD, fontSize: 9, fontWeight: 700, cursor: (geminiKey || groqKey) ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              {journalLoading ? "ANALYZING..." : "GENERATE REPORT"}
            </button>
          </div>

          {!(geminiKey || groqKey) && <div style={{ padding: 16, background: K.s2, borderRadius: 8, color: K.txD, fontSize: 11 }}>
            Add your Groq or Gemini API key in Settings to enable AI trade coaching.
            <div style={{ marginTop: 6, color: K.cyan, fontSize: 10 }}>Get free Groq key: console.groq.com | Gemini: aistudio.google.com/apikey</div>
          </div>}

          {journalReports.length === 0 && (geminiKey || groqKey) && <div style={{ padding: 16, background: K.s2, borderRadius: 8, color: K.txD, fontSize: 11 }}>
            No reports yet. Click "Generate Report" after making some trades to get AI coaching on your performance.
          </div>}

          {journalReports.map((r, i) => (
            <div key={i} style={{ marginBottom: 12, padding: 12, background: K.s2, borderRadius: 8, border: `1px solid ${K.bd}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: r.grade === "A" ? K.up : r.grade === "B" ? K.cyan : r.grade === "C" ? K.gold : r.grade === "D" ? K.warn : K.dn }}>{r.grade}</div>
                  <div>
                    <div style={{ fontSize: 10, color: K.tx, fontWeight: 600 }}>{r.tradesAnalyzed} trades analyzed</div>
                    <div style={{ fontSize: 8, color: K.txD }}>{r.timestamp ? new Date(r.timestamp).toLocaleString() : ""} | ${fx(r.balance || 0, 2)}</div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: K.txD, marginBottom: 10, lineHeight: 1.5 }}>{r.summary}</div>

              {r.strengths?.length > 0 && <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, color: K.up, letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>STRENGTHS</div>
                {r.strengths.map((s, j) => <div key={j} style={{ fontSize: 10, color: K.txD, padding: "2px 0" }}>{s}</div>)}
              </div>}

              {r.weaknesses?.length > 0 && <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, color: K.warn, letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>WEAKNESSES</div>
                {r.weaknesses.map((s, j) => <div key={j} style={{ fontSize: 10, color: K.txD, padding: "2px 0" }}>{s}</div>)}
              </div>}

              {r.recommendations?.length > 0 && <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, color: K.cyan, letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>RECOMMENDATIONS</div>
                {r.recommendations.map((s, j) => <div key={j} style={{ fontSize: 10, color: K.txD, padding: "2px 0" }}>{s}</div>)}
              </div>}

              {r.riskAssessment && <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 8, color: K.gold, letterSpacing: 1, fontWeight: 700, marginBottom: 4 }}>RISK ASSESSMENT</div>
                <div style={{ fontSize: 10, color: K.txD }}>{r.riskAssessment}</div>
              </div>}

              {r.focusArea && <div style={{ padding: 8, background: K.cyan + "08", borderRadius: 6, border: `1px solid ${K.cyan}20` }}>
                <div style={{ fontSize: 8, color: K.cyan, letterSpacing: 1, fontWeight: 700, marginBottom: 2 }}>FOCUS AREA</div>
                <div style={{ fontSize: 11, color: K.cyan, fontWeight: 600 }}>{r.focusArea}</div>
              </div>}
            </div>
          ))}
        </div>}

        {/* ML ENGINE */}
        {tab === "ml" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>MACHINE LEARNING ENGINE</div>

          {/* Status Bar */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ ...S.metric, background: MLEngine._trained ? K.up + "15" : K.s3 }}>
              <div style={{ fontSize: 7, color: K.txD }}>STATUS</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: MLEngine._trained ? K.up : K.txD }}>{MLEngine._trained ? "TRAINED" : "UNTRAINED"}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 7, color: K.txD }}>ACCURACY</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: (mlStats?.accuracy || 0) > 60 ? K.up : (mlStats?.accuracy || 0) > 50 ? K.warn : K.dn }}>{mlStats?.accuracy || 0}%</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 7, color: K.txD }}>SAMPLES</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: K.tx }}>{mlStats?.totalSamples || 0}<span style={{ fontSize: 8, color: K.txD }}>/{mlStats?.minSamples || 30} min</span></div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 7, color: K.txD }}>EPOCHS</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: K.tx }}>{mlStats?.epoch || 0}</div>
            </div>
            <div style={S.metric}>
              <div style={{ fontSize: 7, color: K.txD }}>TRAIN RUNS</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: K.tx }}>{mlStats?.trainCount || 0}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button disabled={mlTraining || (mlStats?.totalSamples || 0) < (mlStats?.minSamples || 30)} onClick={async () => {
              setMlTraining(true);
              try {
                await new Promise(r => setTimeout(r, 50));
                const result = MLEngine.train(200);
                if (result.success) {
                  addLog("ML", `Training complete: ${result.accuracy.toFixed(1)}% accuracy, val: ${result.valAccuracy.toFixed(1)}%, ${result.samples} samples, ${result.epochs} epochs`);
                } else {
                  addLog("ML", `Training failed: ${result.reason}`);
                }
                setMlStats(MLEngine.getStats());
              } catch(e) { addLog("ML", "Training error: " + (e?.message || "unknown")); } finally { setMlTraining(false); }
            }} style={{ padding: "8px 20px", borderRadius: 6, background: (mlStats?.totalSamples || 0) >= (mlStats?.minSamples || 30) ? K.cyan + "20" : K.s3, border: `1px solid ${(mlStats?.totalSamples || 0) >= (mlStats?.minSamples || 30) ? K.cyan + "40" : K.bd}`, color: (mlStats?.totalSamples || 0) >= (mlStats?.minSamples || 30) ? K.cyan : K.txD, fontSize: 9, fontWeight: 700, cursor: (mlStats?.totalSamples || 0) >= (mlStats?.minSamples || 30) ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
              {mlTraining ? "TRAINING..." : "TRAIN MODEL"}
            </button>
            <button onClick={() => {
              const csv = MLEngine.exportCSV();
              if (!csv) { addLog("ML", "No data to export"); return; }
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `nexus-ml-data-${new Date().toISOString().slice(0,10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
              addLog("ML", `Exported ${mlStats?.totalSamples || 0} samples as CSV`);
            }} disabled={(mlStats?.totalSamples || 0) === 0} style={{ padding: "8px 16px", borderRadius: 6, background: K.s3, border: `1px solid ${K.bd}`, color: K.tx, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              EXPORT CSV (COLAB)
            </button>
            <button onClick={() => { if (window.confirm("Reset ML model? Training data preserved.")) { MLEngine.reset(); setMlStats(MLEngine.getStats()); addLog("ML", "Model reset"); }}} style={{ padding: "8px 16px", borderRadius: 6, background: K.s3, border: `1px solid ${K.dn}30`, color: K.dn, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              RESET MODEL
            </button>
          </div>

          {/* Progress to min samples */}
          {(mlStats?.totalSamples || 0) < (mlStats?.minSamples || 30) && <div style={{ padding: 12, background: K.s2, borderRadius: 8, marginBottom: 16, border: `1px solid ${K.bd}` }}>
            <div style={{ fontSize: 10, color: K.warn, fontWeight: 700, marginBottom: 6 }}>COLLECTING TRAINING DATA</div>
            <div style={{ fontSize: 10, color: K.txM, marginBottom: 8 }}>Need {(mlStats?.minSamples || 30) - (mlStats?.totalSamples || 0)} more trades before ML can train. The AI is actively trading and collecting data.</div>
            <div style={{ height: 6, background: K.s3, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, ((mlStats?.totalSamples || 0) / (mlStats?.minSamples || 30)) * 100)}%`, background: K.cyan, borderRadius: 3, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 8, color: K.txD, marginTop: 4, textAlign: "right" }}>{mlStats?.totalSamples || 0} / {mlStats?.minSamples || 30} samples</div>
          </div>}

          {/* Feature Importance */}
          {mlStats?.featureImportance && <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 8 }}>FEATURE IMPORTANCE (TOP 10)</div>
            {mlStats.featureImportance.slice(0, 10).map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 100, fontSize: 9, color: K.txM, fontFamily: "monospace", textAlign: "right" }}>{f.name}</div>
                <div style={{ flex: 1, height: 10, background: K.s3, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${f.importance}%`, background: i < 3 ? K.cyan : i < 6 ? K.up : K.txM, borderRadius: 3, transition: "width 0.5s" }} />
                </div>
                <div style={{ width: 36, fontSize: 8, color: K.txD, textAlign: "right" }}>{f.importance}%</div>
              </div>
            ))}
          </div>}

          {/* Training Log */}
          {mlStats?.trainingLog?.length > 0 && <div>
            <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 8 }}>TRAINING HISTORY</div>
            {mlStats.trainingLog.slice().reverse().slice(0, 10).map((log, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: `1px solid ${K.bd}`, fontSize: 9 }}>
                <span style={{ color: K.txD }}>{new Date(log.ts).toLocaleString().slice(0, -3)}</span>
                <span style={{ color: log.accuracy > 60 ? K.up : log.accuracy > 50 ? K.warn : K.dn, fontWeight: 700 }}>{log.accuracy}%</span>
                <span style={{ color: K.txM }}>val:{log.valAccuracy}%</span>
                <span style={{ color: K.txD }}>{log.samples} samples</span>
                <span style={{ color: K.txD }}>({log.wins}W/{log.losses}L)</span>
                <span style={{ color: K.txD }}>loss:{log.loss}</span>
              </div>
            ))}
          </div>}

          {/* Colab Instructions */}
          <div style={{ marginTop: 16, padding: 12, background: K.s2, borderRadius: 8, border: `1px solid ${K.bd}` }}>
            <div style={{ fontSize: 9, color: K.cyan, fontWeight: 700, marginBottom: 6 }}>ADVANCED: GOOGLE COLAB TRAINING</div>
            <div style={{ fontSize: 9, color: K.txD, lineHeight: 1.6 }}>
              1. Export CSV above with your trade data<br/>
              2. Upload to Google Colab notebook<br/>
              3. Train XGBoost/RandomForest with: <span style={{ fontFamily: "monospace", color: K.txM }}>pip install xgboost scikit-learn</span><br/>
              4. Export model as ONNX: <span style={{ fontFamily: "monospace", color: K.txM }}>pip install skl2onnx onnxruntime</span><br/>
              5. The in-browser neural net auto-trains and improves as you collect more data
            </div>
          </div>
        </div>}

        {/* SESSIONS */}
        {tab === "sessions" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>TRADING SESSION INTELLIGENCE</div>
          {Sessions.zones.map(z => {
            const isA = session?.active?.some(a => a.name === z.name);
            const perf = Brain.getSessionPerformance()[z.name] || { wins: 0, losses: 0, total: 0, winRate: 0 };
            return (
              <div key={z.name} style={{ padding: 12, background: isA ? z.color + "08" : K.s2, borderRadius: 8, marginBottom: 8, border: `1px solid ${isA ? z.color + "30" : K.bd}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isA ? z.color : K.txD }}>{z.emoji} {z.name} {isA && <span style={{ fontSize: 9, animation: "pulse 2s infinite" }}>{"●"} ACTIVE</span>}</div>
                  <div style={{ fontSize: 9, color: K.txM }}>UTC {z.utcOpen}:00 - {z.utcClose}:00</div>
                </div>
                <div style={{ fontSize: 10, color: K.txD, marginBottom: 6 }}>{z.traits}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 9 }}>
                  <span style={{ color: K.up }}>W: {perf.wins}</span><span style={{ color: K.dn }}>L: {perf.losses}</span>
                  <span style={{ color: perf.winRate > 50 ? K.up : K.dn }}>WR: {fx(perf.winRate,0)}%</span>
                  <span style={{ color: K.gold }}>Vol: {z.volProfile}</span><span style={{ color: K.txM }}>Bias: {z.bias}</span>
                </div>
              </div>
            );
          })}
        </div>}

        {/* SETTINGS — API PLUGIN */}
        {tab === "settings" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 14 }}>SETTINGS & BINANCE API CONNECTION</div>

          <div style={{ padding: 14, background: K.s2, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: K.gold, marginBottom: 8 }}>Trading Mode</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => { setTradingMode("paper"); DB.set("api_settings", { apiKey, tradingMode: "paper", geminiKey, groqKey }); addLog("AI", "Training mode active - realistic simulation with fees + slippage"); }} style={{ ...S.btn(tradingMode === "paper", K.gold), padding: "10px 20px", fontSize: 12 }}>TRAINING ($100 realistic)</button>
              <button onClick={() => { if (!apiKey) { addLog("WARN", "Enter API key first"); return; } setTradingMode("live"); DB.set("api_settings", { apiKey, tradingMode: "live", geminiKey, groqKey }); addLog("AI", "LIVE TRADING ACTIVATED - REAL MONEY"); }} style={{ ...S.btn(tradingMode === "live", K.up), padding: "10px 20px", fontSize: 12 }}>LIVE (Real Money)</button>
            </div>
            <div style={{ fontSize: 8, color: K.cyan, padding: 8, background: K.cyan + "08", borderRadius: 6, marginBottom: 8 }}>
              REALISTIC MODE: Training includes real Binance fees (0.2%), market slippage, and execution delays. What you see here is what you get with real money.
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: K.cyan, marginBottom: 8, marginTop: 16 }}>LLM Brain (Groq AI — Recommended)</div>
            <div style={{ fontSize: 9, color: K.txD, marginBottom: 8 }}>Primary AI provider. 30 req/min, 14,400/day free. Get key from <span style={{ color: K.cyan }}>console.groq.com</span></div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Groq API Key</div><input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value.trim())} placeholder="Enter Groq API Key (free — recommended)" style={S.input}/></div>

            <div style={{ fontSize: 12, fontWeight: 700, color: K.txM, marginBottom: 8, marginTop: 12 }}>LLM Fallback (Gemini AI)</div>
            <div style={{ fontSize: 9, color: K.txD, marginBottom: 8 }}>Backup provider if Groq hits limits. 15 req/min, 1,500/day. Get key from <span style={{ color: K.cyan }}>aistudio.google.com/apikey</span></div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Gemini API Key</div><input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value.trim())} placeholder="Enter Gemini API Key (free — fallback)" style={S.input}/></div>
            <button onClick={() => { const gk = groqKey.trim(); const gmk = geminiKey.trim(); if (gk && !gk.startsWith("gsk_")) { addLog("WARN", "Groq key should start with gsk_ - check your key"); } DB.set("api_settings", { apiKey, tradingMode, geminiKey: gmk, groqKey: gk }); setGroqKey(gk); setGeminiKey(gmk); LLMEngine._consecutiveErrors = 0; LLMEngine._lastError = ""; LLMEngine._backoffUntil = 0; LLMEngine._lastCall = 0; LLMEngine._quotaHits = { groq: 0, gemini: 0 }; LLMEngine._keyInvalid = { groq: false, gemini: false }; setLlmRefresh(r => r + 1); console.log("LLM Keys saved - Groq:", gk ? gk.substring(0,8) + "..." + gk.substring(gk.length-4) : "none", "Gemini:", gmk ? gmk.substring(0,8) + "..." : "none"); addLog("AI", (gk ? "Groq" : "") + (gk && gmk ? " + " : "") + (gmk ? "Gemini" : "") + (gk || gmk ? " key(s) saved" : "LLM Brain disconnected")); }} style={{ ...S.btn(true, K.cyan), marginBottom: 10, fontSize: 10 }}>Save LLM Keys</button>
            {(groqKey || geminiKey) && <div style={{ fontSize: 8, color: K.cyan, padding: 8, background: K.cyan + "08", borderRadius: 6, marginBottom: 8 }}>
              LLM ACTIVE: {groqKey ? "Groq (primary)" : ""}{groqKey && geminiKey ? " + " : ""}{geminiKey ? "Gemini (fallback)" : ""} — Smart change detection saves 60-80% of API calls. Adaptive intervals: 45s volatile → 180s ranging. {LLMEngine._callCount} analyses this session.
            </div>}
          </div>

          {/* CLOUD SYNC — SUPABASE */}
          <div style={{ padding: 14, background: K.s2, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4caf50", marginBottom: 8 }}>☁ Cloud Sync (Supabase — Free)</div>
            <div style={{ fontSize: 9, color: K.txD, marginBottom: 10 }}>
              Backup brain data, trades, and settings to the cloud. Survives browser clears and works across devices. Free 500MB on <span style={{ color: K.cyan }}>supabase.com</span>
            </div>

            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Supabase Project URL</div><input type="text" value={cloudUrl} onChange={e => setCloudUrl(e.target.value)} placeholder="https://your-project.supabase.co" style={S.input}/></div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Supabase Anon Key</div><input type="password" value={cloudKey} onChange={e => setCloudKey(e.target.value)} placeholder="eyJhbGciOi... (from Project Settings → API)" style={S.input}/></div>
            <div style={{ marginBottom: 10 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>Your Sync ID (any unique name — same across devices)</div><input type="text" value={cloudUserId} onChange={e => setCloudUserId(e.target.value)} placeholder="e.g. mohammed-nexus or any-unique-id" style={S.input}/></div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button onClick={() => {
                CloudSync.init(cloudUrl, cloudKey, cloudUserId);
                DB.set("cloud_settings", { url: cloudUrl, key: cloudKey, userId: cloudUserId });
                setCloudStatus(CloudSync.isConnected() ? "idle" : "disconnected");
                addLog("AI", CloudSync.isConnected() ? "Cloud Sync connected — ID: " + cloudUserId : "Cloud settings cleared");
              }} style={{ ...S.btn(true, "#4caf50"), fontSize: 10 }}>Save & Connect</button>

              <button onClick={async () => {
                if (!CloudSync.isConnected()) { addLog("WARN", "Connect to cloud first"); return; }
                setCloudStatus("syncing");
                addLog("AI", "Backing up all data to cloud...");
                const result = await CloudSync.backupAll();
                setCloudStatus(result.success ? "synced" : "error");
                setLastCloudSync(Date.now());
                addLog(result.success ? "AI" : "ERR", result.success ? `Cloud backup complete: ${result.pushed} items saved` : `Backup failed: ${result.failed} errors`);
              }} style={{ ...S.btn(CloudSync.isConnected(), K.cyan), fontSize: 10, opacity: CloudSync.isConnected() ? 1 : 0.4 }}>⬆ Backup Now</button>

              <button onClick={async () => {
                if (!CloudSync.isConnected()) { addLog("WARN", "Connect to cloud first"); return; }
                if (!window.confirm("Restore from cloud? This will OVERWRITE your local data with cloud data. Continue?")) return;
                setCloudStatus("syncing");
                addLog("AI", "Restoring data from cloud...");
                const result = await CloudSync.restoreFromCloud();
                if (result.success) {
                  setCloudStatus("restored");
                  setLastCloudSync(Date.now());
                  addLog("AI", `Cloud restore complete: ${result.restored} items restored. Reloading...`);
                  setTimeout(() => window.location.reload(), 1500);
                } else {
                  setCloudStatus("error");
                  addLog("ERR", `Cloud restore failed: ${result.error}`);
                }
              }} style={{ ...S.btn(CloudSync.isConnected(), K.warn), fontSize: 10, opacity: CloudSync.isConnected() ? 1 : 0.4 }}>⬇ Restore from Cloud</button>
            </div>

            {CloudSync.isConnected() && <div style={{ fontSize: 8, color: "#4caf50", padding: 8, background: "#4caf5010", borderRadius: 6, marginBottom: 8 }}>
              CLOUD CONNECTED: Syncing as "{cloudUserId}" — Auto-backup every 60s when data changes. {lastCloudSync > 0 ? `Last sync: ${timeAgo(lastCloudSync)} ago` : "No sync yet"} | {CloudSync._syncCount} items synced this session
            </div>}

            {!CloudSync.isConnected() && <div style={{ fontSize: 8, color: K.txD, padding: 8, background: K.s3 + "40", borderRadius: 6, marginBottom: 8 }}>
              SETUP: 1) Create free project at supabase.com 2) Go to SQL Editor, run the setup query below 3) Copy URL + anon key from Project Settings → API 4) Choose a unique Sync ID (use same ID on all devices)
            </div>}

            <details style={{ marginTop: 4 }}>
              <summary style={{ fontSize: 9, color: K.cyan, cursor: "pointer", marginBottom: 6 }}>📋 Supabase Setup SQL (click to expand)</summary>
              <pre style={{ fontSize: 8, color: K.txD, background: K.bg, padding: 10, borderRadius: 6, overflow: "auto", whiteSpace: "pre-wrap", border: `1px solid ${K.bd}` }}>{`-- Run this in Supabase SQL Editor (one time only)
CREATE TABLE IF NOT EXISTS nexus_data (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL,
  data_key text NOT NULL,
  data_value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, data_key)
);

-- Enable public access (anon key)
ALTER TABLE nexus_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON nexus_data
  FOR ALL USING (true) WITH CHECK (true);`}</pre>
            </details>
          </div>

          <div style={{ padding: 14, background: K.s2, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: K.warn, marginBottom: 8, marginTop: 0 }}>Binance API Keys</div>
            <div style={{ fontSize: 9, color: K.txD, marginBottom: 8 }}>Connect your Binance account for live trading. Only enable when AI is profitable over 50+ trades.</div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>API Key</div><input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter Binance API Key" style={S.input}/></div>
            <div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, color: K.txD, marginBottom: 4 }}>API Secret</div><input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="Enter Binance API Secret" style={S.input}/></div>
            <button onClick={() => { DB.set("api_settings", { apiKey, tradingMode, geminiKey, groqKey }); LLMEngine._consecutiveErrors = 0; LLMEngine._lastError = ""; LLMEngine._backoffUntil = 0; LLMEngine._lastCall = 0; setLlmRefresh(r => r + 1); addLog("AI", "API settings saved"); }} style={{ ...S.btn(true, K.up), marginBottom: 10, fontSize: 10 }}>Save API Keys</button>
            <div style={{ fontSize: 8, color: K.dn, padding: 8, background: K.dn + "08", borderRadius: 6 }}>
              WARNING: Live trading uses real money. Only enable when your AI brain has 50+ patterns and win rate above 55%.
              Current brain: {brainStats.brainSize} patterns | Win rate: {brainStats.totalWins + brainStats.totalLosses > 0 ? fx(brainStats.totalWins / (brainStats.totalWins + brainStats.totalLosses) * 100, 1) : "0"}%
            </div>
          </div>

          <div style={{ padding: 14, background: K.s2, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: K.warn, marginBottom: 8 }}>Account</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => { if (window.confirm("Reset balance to $100?")) { setBalance(INITIAL_BALANCE); setPositions([]); setHistory([]); setSessionPnl(0); setSessionTradeCount(0); setSessionProfit(0); addLog("AI", "Account reset to $100"); }}} style={{ ...S.btn(false, K.warn), fontSize: 10 }}>Reset Balance to $100</button>
              <button onClick={() => { if (window.confirm("Delete ALL data including brain?")) { Brain.reset(); setBrainStats(Brain.getStats()); MLEngine.reset(); setMlStats(MLEngine.getStats()); setBalance(INITIAL_BALANCE); setPositions([]); setHistory([]); setSessionPnl(0); setSessionTradeCount(0); setSessionProfit(0); DB.remove("state7"); addLog("AI", "Full reset complete"); }}} style={{ ...S.btn(false, K.dn), fontSize: 10 }}>Full Reset (Delete Everything)</button>
            </div>
          </div>
        </div>}

        {/* LOG */}
        {tab === "log" && <div style={S.card}>
          <div style={{ fontSize: 9, color: K.txM, letterSpacing: 2, marginBottom: 10 }}>ACTIVITY LOG | 24/7 | {logs.length} ENTRIES</div>
          <div style={{ maxHeight: 500, overflowY: "auto" }}>
            {logs.map((l, i) => (
              <div key={l.id} style={{ display: "flex", gap: 8, padding: "4px 0", borderBottom: `1px solid ${K.bd}`, fontSize: 10, animation: `slideIn .1s ${i*.01}s both` }}>
                <span style={{ color: K.txM, fontSize: 8, minWidth: 60 }}>{l.time}</span>
                <span style={{ minWidth: 38, fontWeight: 700, fontSize: 8, color: l.type === "WIN" ? K.up : l.type === "LOSS" ? K.dn : l.type === "AI" ? K.cyan : l.type === "LLM" ? K.purple : l.type === "CHAIN" ? K.gold : l.type === "CLOUD" ? "#4caf50" : l.type === "TRADE" ? K.gold : l.type === "WARN" ? K.warn : l.type === "ERR" ? K.dn : K.txD }}>{l.type}</span>
                <span style={{ color: K.txD }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>}

      </div>
    </div>
  );
}
