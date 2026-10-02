import { buildHonoApp } from './hono-app';

const app = buildHonoApp();

export default {
  async fetch(request: Request, env: Record<string, any>, ctx: any): Promise<Response> {
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string') {
          process.env[key] = value;
        }
      }
    }
    return app.fetch(request, env, ctx);
  },
};
