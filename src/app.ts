import dotenv from 'dotenv';
dotenv.config();
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';

import './models/index';
import { connectToDatabase } from './lib/db';
import { getCorsHeaders } from './lib/cors';
import { openApiSpec } from './lib/openapi';

import { handleUsersRoute } from './modules/users/users.router';
import { handleFormsRoute } from './modules/forms/forms.router';
import { handleDocumentsRoute } from './modules/documents/documents.router';
import { handleOrdersRoute } from './modules/orders/orders.router';
import { handlePaymentsRoute } from './modules/payments/payments.router';
import { handleOrderAdditionalDocsRoute } from './modules/order-additional-docs/order-additional-docs.router';
import { handleFieldValuesRoute } from './modules/field-values/field-values.router';
import { handleStoreOwnersRoute } from './modules/store-owners/store-owners.router';
import { handleMocktestsRoute } from './mocktest_modules/mocktests/mocktests.router';
import { handleMocktestPassageRoute } from './mocktest_modules/mocktest_passage/mocktest_passage.router';

const publicDir = path.resolve(process.cwd(), 'public');

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

function isDatabaseOfflineError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('before initial connection is complete') ||
    lower.includes('buffering timed out') ||
    lower.includes('mongonetworkerror') ||
    lower.includes('mongooseserverselectionerror') ||
    lower.includes('mongooseerror') ||
    lower.includes('econnrefused') ||
    lower.includes('topology is closed')
  );
}

function toWebRequest(req: FastifyRequest): { request: Request; url: URL } {
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = req.headers.host || 'localhost:3000';
  const rawUrl = req.raw.url || req.url || '/';
  const url = new URL(rawUrl, `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, String(value));
      }
    }
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && req.body !== undefined && req.body !== null;
  let bodyInit: BodyInit | undefined;

  if (hasBody) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      bodyInit = req.body as any;
    } else {
      bodyInit = JSON.stringify(req.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }
  }

  const request = new Request(url.toString(), {
    method,
    headers,
    body: bodyInit,
  });

  return { request, url };
}

async function sendWebResponse(
  req: FastifyRequest,
  reply: FastifyReply,
  webResponse: Response
): Promise<FastifyReply> {
  const startTime = req.startTime ?? performance.now();
  const durationMs = Math.round(performance.now() - startTime);
  const timeStr = `${durationMs}ms`;
  const origin = (req.headers.origin as string) || null;
  const pathname = (req.raw.url || req.url || '/').split('?')[0];

  // Apply headers from the Web Response
  webResponse.headers.forEach((val, key) => {
    reply.header(key, val);
  });

  // Attach CORS headers
  const cors = getCorsHeaders(origin);
  for (const [key, val] of Object.entries(cors)) {
    reply.header(key, val);
  }

  if (!webResponse.headers.has('cache-control')) {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  }
  reply.header('X-Response-Time', timeStr);
  reply.header('Server-Timing', `total;dur=${durationMs}`);

  const existingXCache = webResponse.headers.get('x-cache');
  reply.header('X-Cache', existingXCache || 'BYPASS');

  const contentType = webResponse.headers.get('content-type') || '';
  const text = await webResponse.text();

  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(text);

      // Check for database offline error to return graceful fallback
      if (webResponse.status >= 400 && json && typeof json === 'object') {
        const errMsg = String(json.message || json.error || '');
        if (isDatabaseOfflineError(errMsg)) {
          console.warn('[Fastify] Database offline — returning fallback response');
          if (req.method === 'GET') {
            const isPlural = pathname.endsWith('s') || pathname.endsWith('s/');
            reply.header('X-Cache', 'MOCK');
            return reply.code(200).type('application/json').send(
              JSON.stringify({
                success: true,
                count: 0,
                total: 0,
                data: isPlural ? [] : {},
                execution_time: timeStr,
              })
            );
          }
          return reply.code(503).type('application/json').send(
            JSON.stringify({
              success: false,
              error: 'Service temporarily unavailable (database offline)',
              execution_time: timeStr,
            })
          );
        }
      }

      if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
        json.execution_time = timeStr;
        return reply.code(webResponse.status).type('application/json').send(JSON.stringify(json));
      }
    } catch {
      // Fallback to raw text
    }
  }

  return reply.code(webResponse.status).send(text);
}

async function dispatchModuleRouter(
  req: FastifyRequest,
  reply: FastifyReply,
  handler: (request: Request, url: URL) => Promise<Response | null>,
  notFoundMessage: string,
  errorMessage: string
) {
  const { request, url } = toWebRequest(req);
  try {
    const response = await handler(request, url);
    if (response) {
      return await sendWebResponse(req, reply, response);
    }
    const notFoundResp = new Response(
      JSON.stringify({ success: false, message: notFoundMessage }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return await sendWebResponse(req, reply, notFoundResp);
  } catch (error: any) {
    const errResp = new Response(
      JSON.stringify({ success: false, message: error?.message || errorMessage }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return await sendWebResponse(req, reply, errResp);
  }
}

const DOCS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light">
    <title>Brinto API - Developer Documentation</title>
    <style>
      :root,
      body,
      .dark,
      .dark-mode,
      [data-theme='dark'] {
        --scalar-background-1: #ffffff !important;
        --scalar-background-2: #f8fafc !important;
        --scalar-background-3: #f1f5f9 !important;
        --scalar-background-accent: #eff6ff !important;
        --scalar-color-1: #0f172a !important;
        --scalar-color-2: #334155 !important;
        --scalar-color-3: #64748b !important;
        --scalar-color-accent: #2563eb !important;
        --scalar-border-color: #e2e8f0 !important;
        --scalar-sidebar-background-1: #ffffff !important;
        --scalar-sidebar-color-1: #0f172a !important;
        --scalar-sidebar-color-2: #475569 !important;
        --scalar-sidebar-border-color: #e2e8f0 !important;
        --scalar-button-1: #2563eb !important;
        --scalar-button-1-color: #ffffff !important;
        --scalar-button-1-hover: #1d4ed8 !important;
        --scalar-code-background-1: #f8fafc !important;
        --scalar-code-color-1: #0f172a !important;
      }
      body {
        margin: 0;
        padding: 0;
        background-color: #ffffff !important;
        color: #0f172a !important;
      }
      /* Force light background on code snippet cards */
      .cm-editor,
      .cm-gutters,
      .cm-content,
      .scalar-card-content,
      .scalar-card,
      .section-code {
        background-color: #f8fafc !important;
        color: #0f172a !important;
        border-color: #e2e8f0 !important;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/openapi.json"
      data-configuration='{
        "theme": "none",
        "darkMode": false,
        "showSidebar": true,
        "persistAuthorization": true
      }'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: false,
    ignoreTrailingSlash: true,
  });

  // Allow empty JSON bodies without throwing FST_ERR_CTP_EMPTY_JSON_BODY
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      return done(null, {});
    }
    try {
      const parsed = JSON.parse(body as string);
      return done(null, parsed);
    } catch (err: any) {
      return done(null, {});
    }
  });

  // Global onRequest hook: timing, CORS preflight, and MongoDB connection
  app.addHook('onRequest', async (req, reply) => {
    req.startTime = performance.now();
    const origin = (req.headers.origin as string) || null;
    const pathname = (req.raw.url || req.url || '/').split('?')[0];

    if (req.method === 'OPTIONS') {
      const cors = getCorsHeaders(origin);
      for (const [key, val] of Object.entries(cors)) {
        reply.header(key, val);
      }
      return reply.code(204).send();
    }

    if (
      pathname.startsWith('/api/') &&
      pathname !== '/api/openapi.json' &&
      pathname !== '/api/health' &&
      pathname !== '/api/mocktests' &&
      !pathname.startsWith('/api/mocktests/') &&
      !pathname.startsWith('/api/mocktest-passages') &&
      pathname !== '/api/get-blog-upload-url'
    ) {
      await connectToDatabase(process.env.MONGODB_URI);
    }
  });

  // Static favicons
  app.get('/favicon.ico', async (_req, reply) => {
    try {
      const data = await fs.readFile(path.join(publicDir, 'favicon.ico'));
      return reply.type('image/x-icon').send(data);
    } catch {
      return reply.code(404).send();
    }
  });

  app.get('/favicon.svg', async (_req, reply) => {
    try {
      const data = await fs.readFile(path.join(publicDir, 'favicon.svg'), 'utf-8');
      return reply.type('image/svg+xml').send(data);
    } catch {
      return reply.code(404).send();
    }
  });

  // Root status route
  app.get('/', async (req, reply) => {
    const response = new Response(
      JSON.stringify({
        service: 'brinto-fastify-api',
        runtime: 'node-ts-fastify',
        version: '0.0.1',
        status: 'online',
        documentation: '/docs',
        openapi: '/api/openapi.json',
        endpoints: {
          health: '/api/health',
          users: '/api/users',
          forms: '/api/forms',
          orders: '/api/orders',
          fieldValues: '/api/field-values',
          documents: '/api/documents',
          orderAdditionalDocs: '/api/order-additional-docs',
          payments: '/api/payments',
          storeOwners: '/api/store-owners',
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return await sendWebResponse(req, reply, response);
  });

  // Interactive Scalar API Reference UI
  app.get('/docs', async (_req, reply) => {
    return reply
      .code(200)
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(DOCS_HTML);
  });

  // OpenAPI JSON spec
  app.get('/api/openapi.json', async (req, reply) => {
    const response = new Response(JSON.stringify(openApiSpec, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
    return await sendWebResponse(req, reply, response);
  });

  // Health Check endpoint
  app.get('/api/health', async (req, reply) => {
    await connectToDatabase(process.env.MONGODB_URI);
    const isConnected = mongoose.connection.readyState === 1;
    const environment = process.env.VERCEL ? 'vercel-serverless' : 'node-fastify';

    const response = new Response(
      JSON.stringify({
        status: isConnected ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        engine: 'fastify',
        database: {
          connected: isConnected,
          name: mongoose.connection.name || null,
          host: mongoose.connection.host || null,
        },
        environment,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return await sendWebResponse(req, reply, response);
  });

  // Users module routes
  app.all('/api/users', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleUsersRoute, 'User route not found', 'Internal User Error');
  });
  app.all('/api/users/*', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleUsersRoute, 'User route not found', 'Internal User Error');
  });

  // Forms module routes
  app.all('/api/forms', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleFormsRoute, 'Form route not found', 'Internal Form Error');
  });
  app.all('/api/forms/*', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleFormsRoute, 'Form route not found', 'Internal Form Error');
  });

  // Documents module routes
  app.all('/api/documents', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleDocumentsRoute,
      'Document route not found',
      'Internal Document Error'
    );
  });
  app.all('/api/documents/*', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleDocumentsRoute,
      'Document route not found',
      'Internal Document Error'
    );
  });
  app.all('/api/get-blog-upload-url', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleDocumentsRoute,
      'Document route not found',
      'Internal Document Error'
    );
  });
  app.all('/api/get-user-upload-url', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleDocumentsRoute,
      'Document route not found',
      'Internal Document Error'
    );
  });

  // Orders module routes
  app.all('/api/orders', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleOrdersRoute, 'Order route not found', 'Internal Order Error');
  });
  app.all('/api/orders/*', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleOrdersRoute, 'Order route not found', 'Internal Order Error');
  });

  // Field Values module routes (legacy migration)
  app.all('/api/field-values', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleFieldValuesRoute,
      'Field value route not found',
      'Internal Field Value Error'
    );
  });
  app.all('/api/field-values/*', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleFieldValuesRoute,
      'Field value route not found',
      'Internal Field Value Error'
    );
  });

  // Payments module routes
  app.all('/api/payments', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handlePaymentsRoute,
      'Payment route not found',
      'Internal Payment Error'
    );
  });
  app.all('/api/payments/*', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handlePaymentsRoute,
      'Payment route not found',
      'Internal Payment Error'
    );
  });

  // Order Additional Docs module routes
  app.all('/api/order-additional-docs', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleOrderAdditionalDocsRoute,
      'Order additional docs route not found',
      'Internal Order Additional Docs Error'
    );
  });
  app.all('/api/order-additional-docs/*', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleOrderAdditionalDocsRoute,
      'Order additional docs route not found',
      'Internal Order Additional Docs Error'
    );
  });

  app.all('/api/store-owners', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleStoreOwnersRoute,
      'Store owner route not found',
      'Internal Store Owner Error'
    );
  });
  app.all('/api/store-owners/*', async (req, reply) => {
    return await dispatchModuleRouter(
      req,
      reply,
      handleStoreOwnersRoute,
      'Store owner route not found',
      'Internal Store Owner Error'
    );
  });

  app.all('/api/mocktests', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleMocktestsRoute, 'Mocktests route not found', 'Internal Mocktests Error');
  });
  app.all('/api/mocktests/*', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleMocktestsRoute, 'Mocktests route not found', 'Internal Mocktests Error');
  });
  app.all('/api/mocktest-passages', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleMocktestPassageRoute, 'Mocktest passage route not found', 'Internal Mocktest Passage Error');
  });
  app.all('/api/mocktest-passages/*', async (req, reply) => {
    return await dispatchModuleRouter(req, reply, handleMocktestPassageRoute, 'Mocktest passage route not found', 'Internal Mocktest Passage Error');
  });

  return app;
}

let cachedApp: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!cachedApp) {
    cachedApp = buildApp();
    await Promise.all([
      cachedApp.ready(),
      connectToDatabase(process.env.MONGODB_URI),
    ]);
  }
  return cachedApp;
}
