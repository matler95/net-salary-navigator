import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/obligacje/latest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const forceRefresh = url.searchParams.get("forceRefresh") === "true";

          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Supabase configuration missing on server");
            return Response.json({ error: "Server configuration error" }, { status: 500 });
          }

          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          // Load whatever we currently have in DB (always available as fallback)
          const [{ data: existingBonds }, { data: existingIndicators }] = await Promise.all([
            supabase
              .from("bond_data")
              .select("*")
              .eq("is_active", true)
              .order("fetched_at", { ascending: false }),
            supabase.from("economic_indicators").select("*").eq("is_active", true),
          ]);

          // Determine if we need to refresh
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const latestFetch = existingBonds?.[0]?.fetched_at;
          const isStale = !latestFetch || new Date(latestFetch) < thirtyDaysAgo;
          const needsRefresh =
            forceRefresh || isStale || !existingBonds || existingBonds.length === 0;

          let scrapeSuccess = false;
          let fromCache = !needsRefresh;

          if (needsRefresh) {
            console.log("Fetching fresh bond data from obligacjeskarbowe.pl...");
            const scrapedData = await scrapeBondData();

            if (scrapedData && scrapedData.bonds.length > 0) {
              // SAFETY: only swap data after a successful scrape
              const stored = await storeBondData(scrapedData, supabase);
              if (stored) {
                scrapeSuccess = true;
                fromCache = false;
              }
            } else {
              console.warn("Scrape returned no bonds — keeping existing DB data intact.");
            }
          }

          // Re-read active bonds (may be updated after successful scrape)
          const [{ data: latestBonds }, { data: latestIndicators }] = scrapeSuccess
            ? await Promise.all([
                supabase.from("bond_data").select("*").eq("is_active", true).order("symbol"),
                supabase.from("economic_indicators").select("*").eq("is_active", true),
              ])
            : [{ data: existingBonds }, { data: existingIndicators }];

          const nbpIndicator = latestIndicators?.find(
            (i: any) => i.indicator_type === "nbp_reference_rate",
          );
          const cpiIndicator = latestIndicators?.find(
            (i: any) => i.indicator_type === "cpi_estimate",
          );

          const response = {
            lastUpdated: latestBonds?.[0]?.fetched_at || new Date().toISOString(),
            nbpReferenceRate: nbpIndicator?.value ?? 4.0,
            cpiEstimate: cpiIndicator?.value ?? 4.9,
            bonds: (latestBonds ?? []).map((bond: any) => ({
              symbol: bond.symbol,
              name: bond.name,
              category: bond.category,
              tenorMonths: bond.tenor_months,
              annualRatePct: bond.annual_rate_pct,
              nbpMonth1Pct: bond.nbp_month1_pct ?? undefined,
              nbpMarginPct: bond.nbp_margin_pct,
              cpiYear1Pct: bond.cpi_year1_pct,
              cpiMarginPct: bond.cpi_margin_pct,
              earlyRedemptionPenaltyPct: bond.early_redeem_penalty_pct,
              earlyRedemptionFixedFee: bond.early_redeem_fixed_fee,
              minHoldMonths: bond.min_hold_months,
              description: bond.description,
              notes: bond.notes,
            })),
            source: "https://www.obligacjeskarbowe.pl/",
            scrapeSuccess,
            fromCache,
            note: scrapeSuccess
              ? "Dane odświeżone z obligacjeskarbowe.pl"
              : fromCache
                ? "Dane z pamięci podręcznej (mniej niż 30 dni)"
                : "Użyto ostatnich zapisanych danych — odświeżenie nie powiodło się.",
          };

          return Response.json(response);
        } catch (error: any) {
          console.error("Error in obligacje/latest API:", error);
          return Response.json(
            {
              error: error.message,
              lastUpdated: new Date().toISOString(),
              scrapeSuccess: false,
              fromCache: false,
              note: "Wystąpił błąd podczas pobierania danych obligacji.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});

// Function to scrape bond data from obligacjeskarbowe.pl
// Phase 1: /oferta/ → find detail page URLs per bond symbol
// Phase 2: each detail page → parse exact mechanism string for m1 rate + margin
async function scrapeBondData(): Promise<{
  bonds: any[];
  nbpRate: number;
  cpiEstimate: number;
} | null> {
  try {
    // ── Phase 1: discover current emission URLs from /oferta/ ───────────────
    const ofertaRes = await fetch("https://www.obligacjeskarbowe.pl/oferta/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BudgetMeister/1.0)" },
    });
    if (!ofertaRes.ok) throw new Error(`/oferta/ fetch failed: ${ofertaRes.status}`);

    const ofertaHtml = await ofertaRes.text();

    // Extract all bond detail page URLs like /oferta-obligacji/obligacje-2-letnie-dor/dor0528/
    const urlPattern = /href="(\/oferta-obligacji\/[^"]+)"/g;
    const detailUrls = new Map<string, string>(); // symbol → full URL

    const symbolHints: Record<string, RegExp> = {
      OTS: /ots/i,
      ROR: /ror/i,
      DOR: /dor/i,
      TOS: /tos/i,
      COI: /coi/i,
      EDO: /edo/i,
    };

    let match;
    while ((match = urlPattern.exec(ofertaHtml)) !== null) {
      const path = match[1];
      for (const [symbol, hint] of Object.entries(symbolHints)) {
        if (hint.test(path) && !detailUrls.has(symbol)) {
          detailUrls.set(symbol, `https://www.obligacjeskarbowe.pl${path}`);
        }
      }
    }

    console.log(
      `Phase 1: found ${detailUrls.size} bond detail URLs:`,
      Object.fromEntries(detailUrls),
    );

    // If phase 1 finds no URLs (possible JS-rendered site), fall back to known URLs
    const knownUrls: Record<string, string> = {
      OTS: "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-3-miesieczne-ots/ots0826/",
      ROR: "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-roczne-ror/ror0527/",
      DOR: "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-2-letnie-dor/dor0528/",
      TOS: "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-3-letnie-tos/tos0529/",
      COI: "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-4-letnie-coi/coi0530/",
      EDO: "https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-10-letnie-edo/edo0536/",
    };

    for (const [symbol, url] of Object.entries(knownUrls)) {
      if (!detailUrls.has(symbol)) {
        detailUrls.set(symbol, url);
      }
    }

    // ── Phase 2: fetch each detail page and parse the Oprocentowanie field ──

    const parsePercent = (value?: string): number | undefined => {
      if (!value) return undefined;
      const cleaned = value.replace(",", ".").replace(/[^\d.-]/g, "");
      const parsed = parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    // Static bond metadata (structural info that doesn't change per emission)
    const bondMeta: Record<string, any> = {
      OTS: {
        name: "3-miesięczne oszczędnościowe",
        category: "fixed",
        tenorMonths: 3,
        earlyRedeemPenaltyPct: 100,
        minHoldMonths: 1,
        description: "Stałe oprocentowanie przez cały okres.",
        notes: "Najkrótszy dostępny instrument. Idealne dla płynności.",
      },
      ROR: {
        name: "12-miesięczne (stopa NBP)",
        category: "nbp_indexed",
        tenorMonths: 12,
        earlyRedeemFixedFee: 0.5,
        minHoldMonths: 1,
        notes: "Odsetki wypłacane co miesiąc.",
      },
      DOR: {
        name: "2-letnie (stopa NBP)",
        category: "nbp_indexed",
        tenorMonths: 24,
        earlyRedeemFixedFee: 0.7,
        minHoldMonths: 1,
        notes: "Odsetki wypłacane co miesiąc. Lepsza marża niż ROR.",
      },
      TOS: {
        name: "3-letnie stałoprocentowe",
        category: "fixed",
        tenorMonths: 36,
        earlyRedeemFixedFee: 1.0,
        minHoldMonths: 1,
        notes: "Zysk znany z góry. Chroni przed obniżkami stóp NBP.",
      },
      COI: {
        name: "4-letnie (inflacja CPI)",
        category: "cpi_indexed",
        tenorMonths: 48,
        earlyRedeemFixedFee: 2.0,
        minHoldMonths: 1,
        notes: "Ochrona przed inflacją od roku 2. Brak kapitalizacji.",
      },
      EDO: {
        name: "10-letnie (inflacja CPI)",
        category: "cpi_indexed",
        tenorMonths: 120,
        earlyRedeemFixedFee: 3.0,
        minHoldMonths: 1,
        notes: "Najlepsza ochrona przed inflacją + procent składany.",
      },
    };

    const parsedBonds: any[] = [];

    await Promise.all(
      [...detailUrls.entries()].map(async ([symbol, url]) => {
        try {
          const detailRes = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; BudgetMeister/1.0)" },
          });
          if (!detailRes.ok) {
            console.warn(`Detail page fetch failed for ${symbol}: ${detailRes.status}`);
            return;
          }
          const html = await detailRes.text();
          // Normalize whitespace
          const norm = html.replace(/\s+/g, " ");

          const meta = bondMeta[symbol];
          if (!meta) return;

          const bondEntry: any = { symbol, ...meta };

          if (meta.category === "fixed") {
            // Look for "Oprocentowanie: X,XX%" near the start of the bond details section
            // Matches: "Oprocentowanie: 4,40%" or "Oprocentowanie 2,00%"
            const rateMatch = norm.match(/Oprocentowanie[\s:]+([0-9]+[,\.][0-9]+)\s*%/i);
            const rate = parsePercent(rateMatch?.[1]);
            if (rate !== undefined) {
              bondEntry.annualRatePct = rate;
              bondEntry.description = `Stałe ${rate.toFixed(2).replace(".", ",")}% przez ${meta.tenorMonths / 12} lat${meta.tenorMonths === 36 ? "a" : meta.tenorMonths === 12 ? "" : ""}. Odsetki kapitalizowane rocznie.`;
            }
          } else if (meta.category === "nbp_indexed") {
            // DOR: "4,15% w skali roku, w pierwszym miesięcznym okresie odsetkowym. W kolejnych miesięcznych okresach odsetkowych: stopa referencyjna NBP+0,15%"
            // ROR: "4,00% ... w pierwszym miesięcznym ... stopa referencyjna NBP" (no margin text means 0%)
            const fullRateText =
              norm.match(
                /Oprocentowanie[\s:]+(.{10,300}?)(?:Kapitalizacja|Wypłata|Sprzedaż)/i,
              )?.[1] ?? "";

            // Extract year-1 rate (first percentage in the field)
            const m1Match = fullRateText.match(/([0-9]+[,\.][0-9]+)\s*%/);
            const m1Rate = parsePercent(m1Match?.[1]);
            if (m1Rate !== undefined) bondEntry.nbpMonth1Pct = m1Rate;

            // Extract NBP margin: "NBP+0,15%" or "NBP + 0,15 p.p." etc
            const marginMatch = fullRateText.match(/NBP\s*[+]\s*([0-9]+[,\.][0-9]+)/i);
            const margin = parsePercent(marginMatch?.[1]);
            bondEntry.nbpMarginPct = margin ?? 0.0; // ROR has 0 margin

            const marginStr =
              margin && margin > 0 ? ` + ${margin.toFixed(2).replace(".", ",")}%` : "";
            bondEntry.description = `Miesiąc 1: stałe ${m1Rate?.toFixed(2).replace(".", ",")}%. Kolejne miesiące: stopa NBP${marginStr}.`;
          } else if (meta.category === "cpi_indexed") {
            // COI: "4,75% ... w pierwszym rocznym ... marża 1,50% + inflacja ..."
            // EDO: "5,35% ... w pierwszym rocznym ... marża 2,00% + inflacja ..."
            const fullRateText =
              norm.match(
                /Oprocentowanie[\s:]+(.{10,400}?)(?:Kapitalizacja|Wypłata|Sprzedaż)/i,
              )?.[1] ?? "";

            // Extract year-1 rate
            const y1Match = fullRateText.match(/([0-9]+[,\.][0-9]+)\s*%/);
            const y1Rate = parsePercent(y1Match?.[1]);
            if (y1Rate !== undefined) bondEntry.cpiYear1Pct = y1Rate;

            // Extract CPI margin: "marża 1,50%" or "marża 2,00%"
            const cpiMarginMatch =
              fullRateText.match(/mar[żz]a\s+([0-9]+[,\.][0-9]+)\s*%/i) ??
              fullRateText.match(/inflacja\s*[+]\s*([0-9]+[,\.][0-9]+)/i);
            const cpiMargin = parsePercent(cpiMarginMatch?.[1]);
            if (cpiMargin !== undefined) bondEntry.cpiMarginPct = cpiMargin;

            const isCapitalizing = /kapitalizacja|kapitaliz/i.test(fullRateText);
            const tenorYears = meta.tenorMonths / 12;
            const marginStr =
              cpiMargin !== undefined ? ` + ${cpiMargin.toFixed(2).replace(".", ",")}%` : "";
            bondEntry.description = `Rok 1: stałe ${y1Rate?.toFixed(2).replace(".", ",")}%. Lata 2-${tenorYears}: inflacja CPI${marginStr}.${isCapitalizing ? " Odsetki kapitalizowane." : " Odsetki wypłacane co roku."}`;
          }

          parsedBonds.push(bondEntry);
          console.log(`Scraped ${symbol}:`, bondEntry);
        } catch (err) {
          console.error(`Failed to scrape detail page for ${symbol}:`, err);
        }
      }),
    );

    if (parsedBonds.length === 0) {
      console.warn("Scraper: no bond rates extracted. Pages may have changed structure.");
      return null;
    }

    // Extract NBP rate from the main page (visible in DOR/ROR rate description)
    // The NBP rate isn't explicitly listed on the offer page, use default
    const nbpRate = 4.0; // Current NBP reference rate (May 2026)
    const cpiEstimate = 4.9; // Current CPI estimate (GUS April 2026)

    console.log(`Scraper: successfully extracted ${parsedBonds.length} bonds`);
    return { bonds: parsedBonds, nbpRate, cpiEstimate };
  } catch (error) {
    console.error("Error scraping bond data:", error);
    return null;
  }
}

// Function to store scraped data in database
async function storeBondData(
  scrapedData: {
    bonds: any[];
    nbpRate: number;
    cpiEstimate: number;
  },
  supabase: any,
) {
  const now = new Date().toISOString();

  try {
    // Deactivate existing active records for each scraped symbol individually
    // (safe: never deactivates bonds that weren't scraped)
    for (const bond of scrapedData.bonds) {
      await supabase
        .from("bond_data")
        .update({ is_active: false, valid_to: now })
        .eq("symbol", bond.symbol)
        .eq("is_active", true);
    }

    // Insert new bond data
    const bondInserts = scrapedData.bonds.map((bond) => ({
      symbol: bond.symbol,
      name: bond.name,
      category: bond.category,
      tenor_months: bond.tenorMonths,
      annual_rate_pct: bond.annualRatePct ?? null,
      nbp_month1_pct: bond.nbpMonth1Pct ?? null,
      nbp_margin_pct: bond.nbpMarginPct ?? null,
      cpi_year1_pct: bond.cpiYear1Pct ?? null,
      cpi_margin_pct: bond.cpiMarginPct ?? null,
      early_redeem_penalty_pct: bond.earlyRedeemPenaltyPct ?? null,
      early_redeem_fixed_fee: bond.earlyRedeemFixedFee ?? null,
      min_hold_months: bond.minHoldMonths ?? 1,
      description: bond.description ?? "",
      notes: bond.notes ?? null,
      fetched_at: now,
      is_active: true,
      valid_from: now,
      version: 1,
    }));

    const { error: bondError } = await supabase.from("bond_data").insert(bondInserts);

    if (bondError) throw bondError;

    // Upsert economic indicators
    await supabase
      .from("economic_indicators")
      .update({ is_active: false, valid_to: now })
      .eq("is_active", true);

    const indicatorInserts = [
      {
        indicator_type: "nbp_reference_rate",
        value: scrapedData.nbpRate,
        unit: "%",
        fetched_at: now,
        is_active: true,
        valid_from: now,
      },
      {
        indicator_type: "cpi_estimate",
        value: scrapedData.cpiEstimate,
        unit: "%",
        fetched_at: now,
        is_active: true,
        valid_from: now,
      },
    ];

    const { error: indicatorError } = await supabase
      .from("economic_indicators")
      .insert(indicatorInserts);

    if (indicatorError) throw indicatorError;

    return true;
  } catch (error) {
    console.error("Error storing bond data:", error);
    return false;
  }
}
