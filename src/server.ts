import { buildApp } from './app';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
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
