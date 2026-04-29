// @ts-ignore
import server from "../dist/server/server.js";

export default async function handler(req: any, res?: any) {
  // If res is present, it's a Node.js (req, res) handler
  if (res) {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `${protocol}://${host}`);

    console.log(`SSR handling (Node.js): ${url.href}`);

    const webRequest = new Request(url, {
      method: req.method,
      headers: req.headers as any,
      // For Node.js, we need to handle the body if it's not a GET/HEAD
      body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
      // @ts-ignore
      duplex: "half",
    });

    try {
      const response = await server.fetch(webRequest);
      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });

      const arrayBuffer = await response.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
      return;
    } catch (error: any) {
      console.error("SSR Error (Node.js):", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end(process.env.NODE_ENV === "development" ? error.stack : "Internal Server Error");
      return;
    }
  }

  // Otherwise, it's a Web Request handler (e.g. Edge runtime or newer Vercel Node)
  const url = new URL(req.url, `http://${req.headers.get("host") || "localhost"}`);
  console.log(`SSR handling (Web): ${url.href}`);

  const normalizedRequest = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-ignore
    duplex: "half",
  });

  try {
    const response = await server.fetch(normalizedRequest);
    console.log(`SSR response status: ${response.status}`);
    return response;
  } catch (error: any) {
    console.error("SSR Error (Web):", error);
    return new Response(
      process.env.NODE_ENV === "development" ? error.stack : "Internal Server Error",
      { status: 500, headers: { "Content-Type": "text/plain" } },
    );
  }
}
