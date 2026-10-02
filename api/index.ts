import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from '../src/app';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url === '/api/index' || req.url === '/api') {
    req.url = '/';
  } else if (req.url?.startsWith('/api/index?')) {
    req.url = '/?' + req.url.slice('/api/index?'.length);
  }

  const app = await getApp();
  app.server.emit('request', req, res);
}
