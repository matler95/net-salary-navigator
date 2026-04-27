// @ts-ignore
import server from '../dist/server/server.js';

export default async function handler(request: Request) {
  const url = new URL(request.url, `http://${request.headers.get('host') || 'localhost'}`);
  console.log(`SSR handling request: ${url.href}`);
  
  // Clone the request with the new full URL
  const normalizedRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-ignore - duplex is needed for streaming bodies in Node.js
    duplex: 'half'
  });

  try {
    const response = await server.fetch(normalizedRequest);
    console.log(`SSR response status: ${response.status}`);
    return response;
  } catch (error: any) {
    console.error('SSR Error:', error);
    return new Response(
      process.env.NODE_ENV === 'development' 
        ? `SSR Error: ${error.message}\n${error.stack}` 
        : 'Internal Server Error',
      { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      }
    );
  }
}
