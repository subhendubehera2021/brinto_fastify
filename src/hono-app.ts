import dotenv from 'dotenv';
dotenv.config();
import { Hono } from 'hono';
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
import { handleStoreOwnersRoute } from './modules/store-owners/store-owners.router';

const publicDir = path.resolve(process.cwd(), 'public');

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

export function buildHonoApp() {
  const app = new Hono();

  // Middleware for CORS, timing, and DB connection
  app.use('*', async (c, next) => {
    const startTime = performance.now();
    const origin = c.req.header('origin') || null;
    const pathname = new URL(c.req.url).pathname;

    // Handle OPTIONS preflight
    if (c.req.method === 'OPTIONS') {
      const cors = getCorsHeaders(origin);
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    }

    const contextId = crypto.randomUUID();
    let cfCache: Cache | null = null;

    // Check Cloudflare Edge Cache for read requests
    if (
      typeof caches !== 'undefined' &&
      (caches as any)?.default &&
      c.req.method === 'GET' &&
      pathname.startsWith('/api/') &&
      pathname !== '/api/health' &&
      pathname !== '/api/openapi.json'
    ) {
      try {
        cfCache = (caches as any).default as Cache;
        const cachedMatch = await cfCache.match(c.req.raw);
        if (cachedMatch) {
          const respHeaders = new Headers(cachedMatch.headers);
          respHeaders.set('X-Cache', 'HIT');
          respHeaders.set('X-Response-Time', '1ms');
          return new Response(cachedMatch.body, {
            status: cachedMatch.status,
            headers: respHeaders,
          });
        }
      } catch {
        cfCache = null;
      }
    }

    // Connect to database for API routes
    try {
      if (
        pathname.startsWith('/api/') &&
        pathname !== '/api/openapi.json' &&
        pathname !== '/api/health' &&
        pathname !== '/api/get-blog-upload-url'
      ) {
        await connectToDatabase(process.env.MONGODB_URI);
      }
      await next();
    } catch (pipelineErr: any) {
      console.error('Request pipeline error:', pipelineErr);
      const cors = getCorsHeaders(origin);
      c.res = new Response(
        JSON.stringify({
          success: false,
          error: pipelineErr?.message || 'Internal Server Error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...cors,
          },
        }
      );
      return;
    }

    const durationMs = Math.round(performance.now() - startTime);
    const timeStr = `${durationMs}ms`;

    // Attach headers
    const cors = getCorsHeaders(origin);
    for (const [key, val] of Object.entries(cors)) {
      c.header(key, val);
    }
    if (!c.res.headers.has('cache-control')) {
      if (c.req.method === 'GET' && pathname.startsWith('/api/') && pathname !== '/api/health') {
        c.header('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
      } else {
        c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      }
    }
    c.header('X-Response-Time', timeStr);
    c.header('Server-Timing', `total;dur=${durationMs}`);
    if (!c.res.headers.has('x-cache')) {
      c.header('X-Cache', 'BYPASS');
    }

    // JSON timing injection and DB offline fallback
    const contentType = c.res.headers.get('content-type') || '';
    if (contentType.includes('application/json') && c.res && !c.res.bodyUsed) {
      try {
        const text = await c.res.text();
        const json = JSON.parse(text);

        if (c.res.status >= 400 && json && typeof json === 'object') {
          const errMsg = String(json.message || json.error || '');
          if (isDatabaseOfflineError(errMsg)) {
            if (c.req.method === 'GET') {
              const isPlural = pathname.endsWith('s') || pathname.endsWith('s/');
              c.header('X-Cache', 'MOCK');
              c.res = new Response(
                JSON.stringify({
                  success: true,
                  count: 0,
                  total: 0,
                  data: isPlural ? [] : {},
                  execution_time: timeStr,
                }),
                { status: 200, headers: c.res.headers }
              );
              return;
            }
            c.res = new Response(
              JSON.stringify({
                success: false,
                error: 'Service temporarily unavailable (database offline)',
                execution_time: timeStr,
              }),
              { status: 503, headers: c.res.headers }
            );
            return;
          }
        }

        if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
          json.execution_time = timeStr;
          c.res = new Response(JSON.stringify(json), {
            status: c.res.status,
            headers: c.res.headers,
          });
        } else {
          c.res = new Response(text, {
            status: c.res.status,
            headers: c.res.headers,
          });
        }

        if (cfCache && c.res.status === 200) {
          try {
            const cacheHeaders = new Headers(c.res.headers);
            cacheHeaders.set('Cache-Control', 'public, max-age=15, s-maxage=15');
            const toCache = new Response(c.res.clone().body, {
              status: c.res.status,
              headers: cacheHeaders,
            });
            if ((c.executionCtx as any)?.waitUntil) {
              (c.executionCtx as any).waitUntil(cfCache.put(c.req.raw, toCache));
            } else {
              cfCache.put(c.req.raw, toCache).catch(() => {});
            }
          } catch {
            // Ignore cache write error
          }
        }
      } catch {
        // Fallback
      }
    }
  });

  // Favicons
  app.get('/favicon.ico', async () => {
    try {
      const data = await fs.readFile(path.join(publicDir, 'favicon.ico'));
      return new Response(data, { headers: { 'Content-Type': 'image/x-icon' } });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  app.get('/favicon.svg', async () => {
    try {
      const data = await fs.readFile(path.join(publicDir, 'favicon.svg'), 'utf-8');
      return new Response(data, { headers: { 'Content-Type': 'image/svg+xml' } });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  // Root status
  const rootHandler = () => {
    return new Response(
      JSON.stringify({
        service: 'brinto-api',
        runtime: 'node-ts-hono',
        version: '0.0.1',
        status: 'online',
        documentation: '/docs',
        openapi: '/api/openapi.json',
        endpoints: {
          health: '/api/health',
          users: '/api/users',
          forms: '/api/forms',
          orders: '/api/orders',
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
  };

  app.get('/', rootHandler);
  app.get('/api', rootHandler);
  app.get('/api/index', rootHandler);

  // Docs
  app.get('/docs', () => {
    return new Response(DOCS_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });

  // OpenAPI spec
  app.get('/api/openapi.json', () => {
    return new Response(JSON.stringify(openApiSpec, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  });

  // Health
  app.get('/api/health', async () => {
    await connectToDatabase(process.env.MONGODB_URI);
    const isConnected = mongoose.connection.readyState === 1;
    const environment = process.env.VERCEL ? 'vercel-serverless' : 'node-hono';

    return new Response(
      JSON.stringify({
        status: isConnected ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        engine: 'hono',
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
  });

  // Helper for domain routers
  const dispatch = (handler: (req: Request, url: URL) => Promise<Response | null>, notFoundMsg: string) => {
    return async (c: any) => {
      const url = new URL(c.req.url);
      try {
        const res = await handler(c.req.raw, url);
        if (res) return res;
        return new Response(JSON.stringify({ success: false, message: notFoundMsg }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: err?.message || 'Internal Error' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    };
  };

  // Modules routes
  app.all('/api/users', dispatch(handleUsersRoute, 'User route not found'));
  app.all('/api/users/*', dispatch(handleUsersRoute, 'User route not found'));

  app.all('/api/forms', dispatch(handleFormsRoute, 'Form route not found'));
  app.all('/api/forms/*', dispatch(handleFormsRoute, 'Form route not found'));

  app.all('/api/documents', dispatch(handleDocumentsRoute, 'Document route not found'));
  app.all('/api/documents/*', dispatch(handleDocumentsRoute, 'Document route not found'));
  app.all('/api/get-blog-upload-url', dispatch(handleDocumentsRoute, 'Document route not found'));
  app.all('/api/get-user-upload-url', dispatch(handleDocumentsRoute, 'Document route not found'));

  app.all('/api/orders', dispatch(handleOrdersRoute, 'Order route not found'));
  app.all('/api/orders/*', dispatch(handleOrdersRoute, 'Order route not found'));

  app.all('/api/payments', dispatch(handlePaymentsRoute, 'Payment route not found'));
  app.all('/api/payments/*', dispatch(handlePaymentsRoute, 'Payment route not found'));

  app.all('/api/order-additional-docs', dispatch(handleOrderAdditionalDocsRoute, 'Order additional docs route not found'));
  app.all('/api/order-additional-docs/*', dispatch(handleOrderAdditionalDocsRoute, 'Order additional docs route not found'));

  app.all('/api/store-owners', dispatch(handleStoreOwnersRoute, 'Store owner route not found'));
  app.all('/api/store-owners/*', dispatch(handleStoreOwnersRoute, 'Store owner route not found'));

  app.onError((err, c) => {
    console.error('Unhandled API Error:', err);
    const origin = c.req.header('origin') || '*';
    const cors = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...cors,
        },
      }
    );
  });

  return app;
}

let cachedHono: ReturnType<typeof buildHonoApp> | null = null;

export async function getHonoApp() {
  if (!cachedHono) {
    cachedHono = buildHonoApp();
    await connectToDatabase(process.env.MONGODB_URI);
  }
  return cachedHono;
}
