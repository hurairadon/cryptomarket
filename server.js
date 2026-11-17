
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.COINGECKO_API_KEY;
const BASE_URL = "https://api.coingecko.com/api/v3";
const COINS_PER_PAGE = 20;
const CACHE_SECONDS = 30;

if (!API_KEY || API_KEY === "your_demo_api_key_here") {
  console.error("Missing API key. Check your .env file.");
  process.exit(1);
}

const cache = new Map();

async function coingeckoGet(endpoint, params) {
  const url = new URL(BASE_URL + endpoint);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_SECONDS * 1000) {
    return cached.data;
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-cg-demo-api-key": API_KEY,
    },
  });

  if (!response.ok) {
    const error = new Error(`CoinGecko error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  cache.set(cacheKey, { time: Date.now(), data });

  return data;
}

function friendlyMessage(status) {
  if (status === 429) return "Too many requests. Please wait.";
  if (status === 401 || status === 403) return "Invalid API key.";
  return "Could not load crypto market data.";
}

app.get("/api/coins", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim().slice(0, 50);
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 50);

    let params = {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: COINS_PER_PAGE,
      page,
      sparkline: "false",
      price_change_percentage: "24h",
    };

    if (query) {
      const search = await coingeckoGet("/search", { query });
      const ids = search.coins.slice(0, COINS_PER_PAGE).map(coin => coin.id);

      if (ids.length === 0) return res.json([]);

      params = {
        vs_currency: "usd",
        ids: ids.join(","),
        order: "market_cap_desc",
        per_page: COINS_PER_PAGE,
        page: 1,
        sparkline: "false",
        price_change_percentage: "24h",
      };
    }

    const coins = await coingeckoGet("/coins/markets", params);
    res.json(coins);

  } catch (error) {
    console.error(error.message);
    const status = error.status || 500;
    res.status(status).json({ error: friendlyMessage(status) });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.get("/style.css", (req, res) =>
  res.sendFile(path.join(__dirname, "style.css"))
);

app.get("/script.js", (req, res) =>
  res.sendFile(path.join(__dirname, "script.js"))
);

app.listen(PORT, () => {
  console.log(`CryptoMarket is running at http://localhost:${PORT}`);
});
