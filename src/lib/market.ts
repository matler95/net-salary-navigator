import { useEffect, useMemo, useState } from "react";
import type { Investment } from "./store";

export type DailyTickerPrices = {
  asOf: string;
  byTicker: Record<string, number>;         // price in ticker's native currency
  currencyByTicker: Record<string, string>; // e.g. "USD", "EUR", "GBP"
};

const TICKER_CACHE_KEY = "placa-netto-tickers-v5";

let memoryPrices: DailyTickerPrices | null = null;
let inFlight: Promise<DailyTickerPrices> | null = null;

export function useDailyTickerPrices(tickers: string[]) {
  const normalizedTickersStr = Array.from(
    new Set(tickers.map((t) => t.trim().toLowerCase()).filter(Boolean))
  ).sort().join(',');

  const normalizedTickers = useMemo(
    () => (normalizedTickersStr ? normalizedTickersStr.split(',') : []),
    [normalizedTickersStr]
  );

  const [prices, setPrices] = useState<DailyTickerPrices>(
    memoryPrices ?? { asOf: "", byTicker: {}, currencyByTicker: {} },
  );
  const [loading, setLoading] = useState(memoryPrices == null);

  useEffect(() => {
    let active = true;
    loadDailyTickerPrices(normalizedTickers)
      .then((nextPrices) => {
        if (!active) return;
        setPrices(nextPrices);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [normalizedTickers]);

  return { prices, loading };
}

export type TickerSearchResult = {
  symbol: string;   // Yahoo Finance ticker (e.g. ISAC.L)
  name: string;     // Full instrument name
  exchange: string; // Exchange display name (e.g. London)
  type: string;     // ETF, EQUITY, CRYPTOCURRENCY...
  currency: string; // Instrument currency (e.g. USD, EUR, GBP)
};

export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  if (!query.trim() || query.length < 2) return [];
  try {
    const url = `/api/yahoo/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    const ALLOWED = new Set(["ETF", "EQUITY", "CRYPTOCURRENCY", "FUND", "MUTUALFUND"]);
    return (json?.quotes ?? [])
      .filter((q: any) => q.symbol && ALLOWED.has(q.quoteType))
      .map((q: any) => ({
        symbol: q.symbol as string,
        name: (q.longname || q.shortname || q.symbol) as string,
        exchange: (q.exchDisp || q.exchange || "") as string,
        type: (q.typeDisp || q.quoteType || "") as string,
        currency: (q.currency || "") as string,
      }));
  } catch {
    return [];
  }
}

export function getTickerCurrency(ticker: string, prices: DailyTickerPrices): string | undefined {
  return ticker ? prices.currencyByTicker?.[ticker.trim().toLowerCase()] : undefined;
}

export function getInvestmentCurrentValue(
  investment: Investment,
  tickerPrices: DailyTickerPrices,
): number {
  const volume = Math.max(0, investment.volume ?? 0);
  const baseValue = Math.max(0, investment.value);
  const ticker = (investment.ticker ?? "").trim().toLowerCase();
  const priceNow = ticker ? tickerPrices.byTicker[ticker] : undefined;
  const priceAtAdd = investment.tickerPriceAtAdd ?? 0;
  if (ticker && priceNow && priceNow > 0 && volume > 0) return volume * priceNow;
  if (volume > 0 && priceAtAdd > 0) return volume * priceAtAdd;
  if (!ticker || !priceNow || priceAtAdd <= 0) return baseValue;
  return baseValue * (priceNow / priceAtAdd);
}

async function loadDailyTickerPrices(tickers: string[]): Promise<DailyTickerPrices> {
  const today = todayIsoDate();
  const validTickers = tickers.filter(Boolean);

  const EMPTY: DailyTickerPrices = { asOf: today, byTicker: {}, currencyByTicker: {} };

  // Fast path: all tickers already in memory with valid prices
  if (memoryPrices && memoryPrices.asOf === today) {
    const missing = validTickers.filter((t) => !(t in memoryPrices!.byTicker));
    if (missing.length === 0) return { ...memoryPrices, byTicker: { ...memoryPrices.byTicker }, currencyByTicker: { ...memoryPrices.currencyByTicker } };
    // Some new tickers need fetching — fall through using memoryPrices as base
  }

  // Determine base: either today's memory, today's localStorage, or fresh empty
  const fromCache = readCachedPrices();
  const base: DailyTickerPrices =
    (memoryPrices && memoryPrices.asOf === today)
      ? memoryPrices
      : (fromCache && fromCache.asOf === today ? fromCache : EMPTY);

  // Only fetch tickers not already in the base
  const toFetch = validTickers.filter((t) => !(t in base.byTicker));

  if (toFetch.length === 0) {
    memoryPrices = base;
    return { ...base, byTicker: { ...base.byTicker }, currencyByTicker: { ...base.currencyByTicker } };
  }

  // If an existing fetch is running for a different set, wait then retry
  if (inFlight) {
    const shared = await inFlight;
    const stillMissing = validTickers.filter((t) => !(t in shared.byTicker));
    if (stillMissing.length === 0) return { ...shared, byTicker: { ...shared.byTicker }, currencyByTicker: { ...shared.currencyByTicker } };
  }

  inFlight = (async () => {
    const next: DailyTickerPrices = {
      asOf: today,
      byTicker: { ...base.byTicker },
      currencyByTicker: { ...(base.currencyByTicker ?? {}) },
    };
    await Promise.all(
      toFetch.map(async (ticker) => {
        const result = await fetchPrice(ticker);
        if (result) {
          next.byTicker[ticker] = result.price;
          next.currencyByTicker[ticker] = result.currency;
        }
      }),
    );
    memoryPrices = next;
    writeCachedPrices(next);
    return next;
  })();

  try {
    const result = await inFlight;
    return { ...result, byTicker: { ...result.byTicker }, currencyByTicker: { ...result.currencyByTicker } };
  } finally {
    inFlight = null;
  }
}

/**
 * Normalize a ticker to Yahoo Finance format.
 *
 * Stooq uses:  .uk (London), .us (US), .pl (Warsaw), .de (XETRA)
 * Yahoo uses:  .L  (London), none (US),  .WA (Warsaw),  .DE (XETRA)
 */
function toYahooSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith(".UK")) return t.slice(0, -3) + ".L";   // London
  if (t.endsWith(".US")) return t.slice(0, -3);           // US — no suffix on Yahoo
  if (t.endsWith(".PL")) return t.slice(0, -3) + ".WA";  // Warsaw
  return t; // .DE, .FR, BTC-USD, etc. work as-is
}

async function fetchPrice(ticker: string): Promise<{ price: number; currency: string } | null> {
  // Try Yahoo Finance first (proper CORS support)
  const normalized = toYahooSymbol(ticker);
  const yahooResult = await fetchYahooDetails(normalized);
  if (yahooResult) return yahooResult;
  // Try raw ticker as-is (already Yahoo format)
  const yahooRaw = await fetchYahooDetails(ticker.toUpperCase());
  if (yahooRaw) return yahooRaw;
  // Fallback: Stooq via Vite dev proxy
  const stooqPrice = await fetchStooqPrice(ticker);
  return stooqPrice ? { price: stooqPrice, currency: "PLN" } : null;
}

/** Fetch price + currency from Yahoo Finance via proxy → direct fallback. */
async function fetchYahooDetails(symbol: string): Promise<{ price: number; currency: string } | null> {
  if (!symbol) return null;
  const proxyUrl = `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  for (const url of [proxyUrl, directUrl]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      let price: number = meta?.regularMarketPrice;
      let currency: string = meta?.currency ?? "";
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
      // Normalize GBp (pence) → GBP: divide price by 100
      if (currency === "GBp") {
        price = price / 100;
        currency = "GBP";
      }
      return { price, currency };
    } catch {
      // try next
    }
  }
  return null;
}

async function fetchStooqPrice(ticker: string): Promise<number | null> {
  if (!ticker) return null;
  try {
    const res = await fetch(`/api/stooq/q/l/?s=${encodeURIComponent(ticker)}&i=d`);
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const cols = lines[1].split(",");
    const close = parseFloat(cols[6] ?? "");
    return Number.isFinite(close) && close > 0 ? close : null;
  } catch {
    return null;
  }
}

function mergePrices(source: DailyTickerPrices, tickers: string[]): DailyTickerPrices {
  const merged: DailyTickerPrices = {
    asOf: source.asOf,
    byTicker: { ...source.byTicker },
    currencyByTicker: { ...(source.currencyByTicker ?? {}) },
  };
  tickers.forEach((ticker) => {
    if (!(ticker in merged.byTicker)) merged.byTicker[ticker] = 0;
  });
  return merged;
}

function readCachedPrices(): DailyTickerPrices | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TICKER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyTickerPrices>;
    if (
      typeof parsed.asOf !== "string" ||
      typeof parsed.byTicker !== "object" ||
      !parsed.byTicker
    ) {
      return null;
    }
    const byTicker: Record<string, number> = {};
    Object.entries(parsed.byTicker).forEach(([k, v]) => {
      if (typeof v === "number" && Number.isFinite(v)) byTicker[k] = v;
    });
    return {
      asOf: parsed.asOf,
      byTicker,
      currencyByTicker: (parsed.currencyByTicker as Record<string, string>) ?? {},
    };
  } catch {
    return null;
  }
}

function writeCachedPrices(prices: DailyTickerPrices) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TICKER_CACHE_KEY, JSON.stringify(prices));
  } catch {
    // Ignore cache write issues.
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
