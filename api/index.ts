import type { IncomingMessage, ServerResponse } from 'node:http';
import { getApp } from '../src/app';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
