import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";

export const Route = createAPIFileRoute("/api/yahoo")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const action = searchParams.get("action");
    const query = searchParams.get("q");
    const symbol = searchParams.get("symbol");

    try {
      if (action === "search" && query) {
        const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false`;
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error("Yahoo API error");
        const data = await res.json();
        return json(data);
      }

      if (action === "chart" && symbol) {
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(targetUrl);
        if (!res.ok) throw new Error("Yahoo API error");
        const data = await res.json();
        return json(data);
      }

      return json({ error: "Invalid parameters" }, { status: 400 });
    } catch (error: any) {
      return json({ error: error.message }, { status: 500 });
    }
  },
});
