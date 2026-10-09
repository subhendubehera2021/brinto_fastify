import { handleCorsPreflight } from '../../lib/cors';
import {
  createMockTestRequest,
  createMockTestSessionRequest,
  getMockTestRequest,
  submitMockTestAttemptRequest,
} from './mocktests.controller';

export async function handleMocktestsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (url.pathname === '/api/mocktests' && request.method === 'POST') {
    return await createMockTestRequest(request);
  }

  if (url.pathname === '/api/mocktests/sessions' && request.method === 'POST') {
    return await createMockTestSessionRequest(request);
  }

  const attemptMatch = url.pathname.match(/^\/api\/mocktests\/(\d+)\/attempts$/);
  if (attemptMatch && request.method === 'POST') {
    return await submitMockTestAttemptRequest(request, attemptMatch[1]);
  }

  const testMatch = url.pathname.match(/^\/api\/mocktests\/(\d+)$/);
  if (testMatch && request.method === 'GET') {
    return await getMockTestRequest(request, testMatch[1]);
  }

  return null;
}