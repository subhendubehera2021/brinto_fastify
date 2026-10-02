import dotenv from 'dotenv';
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const FRAMEWORK = (process.env.FRAMEWORK || 'fastify').toLowerCase();

async function startServer() {
  if (FRAMEWORK === 'hono') {
    const { serve } = await import('@hono/node-server');
    const { buildHonoApp } = await import('./hono-app');
    const app = buildHonoApp();

    serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
      console.log(`[Brinto Hono API] Server listening at http://${HOST}:${PORT}`);
      console.log(`[Brinto Hono API] Documentation available at http://${HOST}:${PORT}/docs`);
    });
    return;
  }

  const { buildApp } = await import('./app');
  const app = buildApp();

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`[Brinto Fastify API] Server listening at ${address}`);
    console.log(`[Brinto Fastify API] Documentation available at ${address}/docs`);
  } catch (err) {
    console.error('[Brinto Fastify API] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
