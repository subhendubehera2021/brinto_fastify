import { handleCorsPreflight } from '../../lib/cors';
import { createPassageRequest, getRandomPassageRequest } from './mocktest_passage.controller';

export async function handleMocktestPassageRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (url.pathname === '/api/mocktest-passages' && request.method === 'POST') {
    return await createPassageRequest(request);
  }

  if (url.pathname === '/api/mocktest-passages' && request.method === 'GET') {
    return await getRandomPassageRequest(url);
  }

  return null;
}