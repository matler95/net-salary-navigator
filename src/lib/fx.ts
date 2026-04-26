import { useEffect, useState } from "react";

export type InvestmentCurrency = "PLN" | "EUR" | "USD";

export type FxRates = {
  PLN: number;
  EUR: number;
  USD: number;
  asOf: string;
};

const FX_CACHE_KEY = "placa-netto-fx-v1";
const FALLBACK_RATES: FxRates = {
  PLN: 1,
  EUR: 1,
  USD: 1,
  asOf: "",
};

let memoryRates: FxRates | null = null;
let inFlight: Promise<FxRates> | null = null;

export function convertToPLN(amount: number, currency: InvestmentCurrency, rates: FxRates): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return safeAmount * rates[currency];
}

export function formatCurrencyAmount(amount: number, currency: InvestmentCurrency): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function useDailyFxRates() {
  const [rates, setRates] = useState<FxRates>(memoryRates ?? FALLBACK_RATES);
  const [loading, setLoading] = useState(memoryRates == null);

  useEffect(() => {
    let active = true;
    loadDailyFxRates()
      .then((nextRates) => {
        if (!active) return;
        setRates(nextRates);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { rates, loading };
}

async function loadDailyFxRates(): Promise<FxRates> {
  if (memoryRates && memoryRates.asOf === todayIsoDate()) return memoryRates;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const cached = readCachedRates();
    if (cached && cached.asOf === todayIsoDate()) {
      memoryRates = cached;
      return cached;
    }

    try {
      const [eur, usd] = await Promise.all([fetchNbpRate("eur"), fetchNbpRate("usd")]);
      const fresh: FxRates = {
        PLN: 1,
        EUR: eur.mid,
        USD: usd.mid,
        asOf: todayIsoDate(),
      };
      memoryRates = fresh;
      writeCachedRates(fresh);
      return fresh;
    } catch {
      if (cached) {
        memoryRates = cached;
        return cached;
      }
      memoryRates = FALLBACK_RATES;
      return FALLBACK_RATES;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function fetchNbpRate(code: "eur" | "usd"): Promise<{ mid: number }> {
  const response = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`);
  if (!response.ok) throw new Error("FX fetch failed");
  const data = (await response.json()) as { rates?: Array<{ mid?: number }> };
  const mid = data.rates?.[0]?.mid;
  if (typeof mid !== "number" || !Number.isFinite(mid)) throw new Error("Invalid FX response");
  return { mid };
}

function readCachedRates(): FxRates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FxRates>;
    if (
      typeof parsed.asOf !== "string" ||
      typeof parsed.PLN !== "number" ||
      typeof parsed.EUR !== "number" ||
      typeof parsed.USD !== "number"
    ) {
      return null;
    }
    return {
      PLN: parsed.PLN,
      EUR: parsed.EUR,
      USD: parsed.USD,
      asOf: parsed.asOf,
    };
  } catch {
    return null;
  }
}

function writeCachedRates(rates: FxRates) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
  } catch {
    // Ignore storage errors.
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
