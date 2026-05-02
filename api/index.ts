// @ts-ignore
import server from '../dist/server/server.js';

async function handleYahooAPI(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Strip the /api/yahoo prefix to get the true Yahoo Finance path
  const targetPath = url.pathname.replace(/^\/api\/yahoo/, "");
  const targetUrl = `https://query1.finance.yahoo.com${targetPath}${url.search}`;

  try {
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        "Accept": "application/json",
        "User-Agent": "BudgetMeister-App/1.0"
      }
    });
    
    const response = await fetch(proxyRequest);
    
    // Return a new response to modify headers if necessary (CORS)
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    
    return newResponse;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleStooqAPI(request: Request): Promise<Response> {
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

export default async function handler(req: any, res?: any) {
  // If res is present, it's a Node.js (req, res) handler
  if (res) {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `${protocol}://${host}`);
    
    // Handle API routes for Node.js
    if (url.pathname.startsWith('/api/yahoo/')) {
      const request = new Request(url.href, {
        method: req.method,
        headers: req.headers as any,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      });
      const response = await handleYahooAPI(request);
      
      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });
      const arrayBuffer = await response.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
      return;
    }
    
    if (url.pathname.startsWith('/api/stooq/')) {
      const request = new Request(url.href, {
        method: req.method,
        headers: req.headers as any,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      });
      const response = await handleStooqAPI(request);
      
      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });
      const arrayBuffer = await response.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
      return;
    }

    console.log(`SSR handling (Node.js): ${url.href}`);

    const webRequest = new Request(url, {
      method: req.method,
      headers: req.headers as any,
      // For Node.js, we need to handle the body if it's not a GET/HEAD
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
      // @ts-ignore
      duplex: 'half'
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
      console.error('SSR Error (Node.js):', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end(process.env.NODE_ENV === 'development' ? error.stack : 'Internal Server Error');
      return;
    }
  }

  // Otherwise, it's a Web Request handler (e.g. Edge runtime or newer Vercel Node)
  const url = new URL(req.url, `http://${req.headers.get('host') || 'localhost'}`);
  
  // Handle API routes for Web API
  if (url.pathname.startsWith('/api/yahoo/')) {
    const response = await handleYahooAPI(req);
    return response;
  }
  
  if (url.pathname.startsWith('/api/stooq/')) {
    const response = await handleStooqAPI(req);
    return response;
  }

  console.log(`SSR handling (Web): ${url.href}`);
  
  const normalizedRequest = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-ignore
    duplex: 'half'
  });

  try {
    const response = await server.fetch(normalizedRequest);
    console.log(`SSR response status: ${response.status}`);
    return response;
  } catch (error: any) {
    console.error('SSR Error (Web):', error);
    return new Response(
      process.env.NODE_ENV === 'development' ? error.stack : 'Internal Server Error',
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}
