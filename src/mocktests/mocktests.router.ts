import { handleCorsPreflight } from '../lib/cors';
import { createMockTestRequest } from './mocktests.controller';

export async function handleMocktestsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (url.pathname === '/api/mocktests' && request.method === 'POST') {
    return await createMockTestRequest(request);
  }

  return null;
}