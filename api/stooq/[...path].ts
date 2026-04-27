export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  
  // Strip the /api/stooq prefix to get the true Stooq path
  const targetPath = url.pathname.replace(/^\/api\/stooq/, "");
  const targetUrl = `https://stooq.com${targetPath}${url.search}`;

  try {
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" // Stooq sometimes blocks bots without standard UA
      }
    });
    
    const response = await fetch(proxyRequest);
    
    // Return a new response to modify headers if necessary (CORS)
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    
    return newResponse;
  } catch (error: any) {
    return new Response(error.message, {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }
}
