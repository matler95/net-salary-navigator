// @ts-ignore
import server from '../dist/server/server.js';

export default async function handler(request: Request) {
  console.log(`SSR handling request: ${request.url}`);
  try {
    const response = await server.fetch(request);
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
