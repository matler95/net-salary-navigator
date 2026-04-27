import { createAPIFileRoute } from "@tanstack/react-start/api";

export const Route = createAPIFileRoute("/api/stooq")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("s");

    if (!symbol) {
      return new Response("Missing symbol", { status: 400 });
    }

    try {
      const targetUrl = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&i=d`;
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error("Stooq API error");
      const text = await res.text();
      
      return new Response(text, {
        headers: { "Content-Type": "text/csv" },
      });
    } catch (error: any) {
      return new Response(error.message, { status: 500 });
    }
  },
});
