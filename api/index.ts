import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from '../src/app';
import { getHonoApp } from '../src/hono-app';

const FRAMEWORK = (process.env.FRAMEWORK || 'fastify').toLowerCase();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url === '/api/index' || req.url === '/api') {
    req.url = '/';
  } else if (req.url?.startsWith('/api/index?')) {
    req.url = '/?' + req.url.slice('/api/index?'.length);
  }

  if (FRAMEWORK === 'hono') {
    const { getRequestListener } = await import('@hono/node-server');
    const honoApp = await getHonoApp();
    const listener = getRequestListener(honoApp.fetch);
    return listener(req, res);
  }

  const app = await getApp();
  app.server.emit('request', req, res);
}
