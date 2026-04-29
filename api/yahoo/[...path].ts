export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  const url = new URL(request.url);

  // Strip the /api/yahoo prefix to get the true Yahoo Finance path
  const targetPath = url.pathname.replace(/^\/api\/yahoo/, "");
  const targetUrl = `https://query1.finance.yahoo.com${targetPath}${url.search}`;

  try {
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        Accept: "application/json",
        "User-Agent": "BudgetMeister-App/1.0",
      },
    });

    const response = await fetch(proxyRequest);

    // Return a new response to modify headers if necessary (CORS)
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");

    return newResponse;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
