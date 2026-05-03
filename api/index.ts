// @ts-ignore
import server from "../dist/server/server.js";
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['host'];
  const url = new URL(req.url || '/', `${protocol}://${host}`);

  // Construct a Fetch Request from the Node.js request
  const request = new Request(url.toString(), {
    method: req.method || 'GET',
    headers: req.headers as any,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
    // Use duplex: 'half' for Node.js compatibility with streaming bodies
    duplex: 'half',
  } as any);

  try {
    const response = await server.fetch(request);

    // Forward the status and headers
    res.statusCode = response.status;
    response.headers.forEach((value: string, key: string) => {
      // Handle set-cookie specifically as it can have multiple values
      if (key.toLowerCase() === 'set-cookie') {
        const cookies = (response.headers as any).getSetCookie?.() || [value];
        res.setHeader(key, cookies);
      } else {
        res.setHeader(key, value);
      }
    });

    // Stream the body
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (error) {
    console.error('Bridge error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
