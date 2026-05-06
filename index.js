// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEXUS PROXY v2.0 — Binance Order Signing + CORS Proxy
// Deployed on Render. Holds API secret server-side only.
// Browser → This Proxy → Binance (signed)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const express = require("express");
const crypto = require("crypto");
const https = require("https");

const app = express();
app.use(express.json());

// ─── CORS: allow nexus-trader.onrender.com + localhost ───────
app.use((req, res, next) => {
  const allowed = [
    "https://nexus-trader.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
  ];
  const origin = req.headers.origin || "";
  if (allowed.includes(origin) || origin.endsWith(".onrender.com")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Api-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Helpers ─────────────────────────────────────────────────
function sign(queryString, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(queryString)
    .digest("hex");
}

function binanceFetch(path, method, params, apiKey, apiSecret) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const paramStr = new URLSearchParams({ ...params, timestamp }).toString();
    const signature = sign(paramStr, apiSecret);
    const fullQuery = `${paramStr}&signature=${signature}`;

    const options = {
      hostname: "api.binance.com",
      port: 443,
      path: method === "GET" ? `${path}?${fullQuery}` : path,
      method,
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: { msg: data } });
        }
      });
    });

    req.on("error", reject);

    if (method === "POST" || method === "DELETE") {
      req.write(fullQuery);
    }

    req.end();
  });
}

// ─── Auth middleware: reads keys from request header or env ──
// Keys come from: X-Api-Key header (format: "APIKEY:APISECRET")
// Falls back to environment variables BINANCE_API_KEY / BINANCE_API_SECRET
function getKeys(req) {
  const header = req.headers["x-api-key"] || "";
  if (header.includes(":")) {
    const [key, secret] = header.split(":");
    if (key && secret) return { apiKey: key.trim(), apiSecret: secret.trim() };
  }
  const envKey = process.env.BINANCE_API_KEY;
  const envSecret = process.env.BINANCE_API_SECRET;
  if (envKey && envSecret) return { apiKey: envKey, apiSecret: envSecret };
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE: GET /health
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get("/health", (req, res) => {
  res.json({ ok: true, version: "2.0", time: Date.now() });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE: GET /proxy?url=...
// Original CORS proxy — unchanged, still works for market data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: "Missing url param" });
  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "NexusProxy/2.0" },
      signal: AbortSignal.timeout(10000),
    });
    const text = await upstream.text();
    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE: GET /binance/account
// Fetch real Binance account balance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get("/binance/account", async (req, res) => {
  const keys = getKeys(req);
  if (!keys) return res.status(401).json({ error: "No API keys provided" });

  try {
    const result = await binanceFetch(
      "/api/v3/account",
      "GET",
      {},
      keys.apiKey,
      keys.apiSecret
    );
    if (result.status !== 200) {
      return res.status(result.status).json(result.body);
    }
    // Return just what NEXUS needs: USDT balance + all non-zero assets
    const balances = result.body.balances
      .filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b) => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
      }));
    const usdt = balances.find((b) => b.asset === "USDT") || {
      asset: "USDT",
      free: 0,
      locked: 0,
      total: 0,
    };
    res.json({
      ok: true,
      usdt: usdt.free,
      usdtLocked: usdt.locked,
      balances,
      canTrade: result.body.canTrade,
      makerCommission: result.body.makerCommission,
      takerCommission: result.body.takerCommission,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE: POST /binance/order
// Place a real spot market order on Binance
// Body: { symbol, side, quoteOrderQty }
//   symbol       e.g. "BTCUSDT"
//   side         "BUY" or "SELL"
//   quoteOrderQty  spend this many USDT (for BUY)
//   quantity     sell this many units (for SELL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.post("/binance/order", async (req, res) => {
  const keys = getKeys(req);
  if (!keys) return res.status(401).json({ error: "No API keys provided" });

  const { symbol, side, quoteOrderQty, quantity } = req.body;

  if (!symbol || !side) {
    return res.status(400).json({ error: "Missing symbol or side" });
  }
  if (side !== "BUY" && side !== "SELL") {
    return res.status(400).json({ error: "side must be BUY or SELL" });
  }
  if (!quoteOrderQty && !quantity) {
    return res
      .status(400)
      .json({ error: "Provide quoteOrderQty (USDT) or quantity (asset)" });
  }

  // Safety: minimum order size
  if (quoteOrderQty && parseFloat(quoteOrderQty) < 5) {
    return res
      .status(400)
      .json({ error: "Min order size is $5 USDT" });
  }

  const params = {
    symbol: symbol.toUpperCase(),
    side: side.toUpperCase(),
    type: "MARKET",
    ...(quoteOrderQty
      ? { quoteOrderQty: parseFloat(quoteOrderQty).toFixed(2) }
      : { quantity: parseFloat(quantity).toFixed(6) }),
  };

  try {
    const result = await binanceFetch(
      "/api/v3/order",
      "POST",
      params,
      keys.apiKey,
      keys.apiSecret
    );

    if (result.status !== 200) {
      console.error("[NEXUS PROXY] Order failed:", result.body);
      return res.status(result.status).json({
        error: result.body.msg || "Binance rejected order",
        code: result.body.code,
      });
    }

    const order = result.body;
    // Parse fill price from fills
    const fills = order.fills || [];
    const totalQty = fills.reduce((s, f) => s + parseFloat(f.qty), 0);
    const totalQuote = fills.reduce(
      (s, f) => s + parseFloat(f.price) * parseFloat(f.qty),
      0
    );
    const avgPrice = totalQty > 0 ? totalQuote / totalQty : 0;
    const totalCommission = fills.reduce(
      (s, f) => s + parseFloat(f.commission),
      0
    );

    console.log(
      `[NEXUS PROXY] ✅ Order filled: ${order.side} ${order.symbol} | Qty:${order.executedQty} @ avg $${avgPrice.toFixed(2)} | Commission:${totalCommission}`
    );

    res.json({
      ok: true,
      orderId: order.orderId,
      symbol: order.symbol,
      side: order.side,
      status: order.status,
      executedQty: parseFloat(order.executedQty),
      cummulativeQuoteQty: parseFloat(order.cummulativeQuoteQty),
      avgPrice,
      fills,
      totalCommission,
      transactTime: order.transactTime,
    });
  } catch (e) {
    console.error("[NEXUS PROXY] Order exception:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE: DELETE /binance/order
// Cancel an open order
// Body: { symbol, orderId }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.delete("/binance/order", async (req, res) => {
  const keys = getKeys(req);
  if (!keys) return res.status(401).json({ error: "No API keys provided" });

  const { symbol, orderId } = req.body;
  if (!symbol || !orderId) {
    return res.status(400).json({ error: "Missing symbol or orderId" });
  }

  try {
    const result = await binanceFetch(
      "/api/v3/order",
      "DELETE",
      { symbol: symbol.toUpperCase(), orderId },
      keys.apiKey,
      keys.apiSecret
    );
    res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE: GET /binance/openOrders
// List open orders for a symbol
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.get("/binance/openOrders", async (req, res) => {
  const keys = getKeys(req);
  if (!keys) return res.status(401).json({ error: "No API keys provided" });

  const { symbol } = req.query;
  try {
    const result = await binanceFetch(
      "/api/v3/openOrders",
      "GET",
      symbol ? { symbol: symbol.toUpperCase() } : {},
      keys.apiKey,
      keys.apiSecret
    );
    res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// START
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[NEXUS PROXY] v2.0 listening on port ${PORT}`);
  console.log(
    `[NEXUS PROXY] Env keys: ${process.env.BINANCE_API_KEY ? "SET" : "NOT SET"}`
  );
});
