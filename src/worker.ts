import { buildHonoApp } from './hono-app';

const app = buildHonoApp();

export default {
  async fetch(request: Request, env: Record<string, any>, ctx: any): Promise<Response> {
    try {
      if (env) {
        for (const [key, value] of Object.entries(env)) {
          if (typeof value === 'string') {
            process.env[key] = value;
          }
        }
      }
      return await app.fetch(request, env, ctx);
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: err?.message || 'Worker Uncaught Exception',
          type: 'worker_exception',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
