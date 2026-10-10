import { handleCorsPreflight } from '../../lib/cors';
import {
  createMockTestRequest,
  createMockTestSessionRequest,
  getMockTestsRequest,
  getMyMocktestAttemptsRequest,
  getMockTestRequest,
  linkGuestMocktestSessionsRequest,
  submitMockTestAttemptRequest,
} from './mocktests.controller';

export async function handleMocktestsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (url.pathname === '/api/mocktests' && request.method === 'POST') {
    return await createMockTestRequest(request);
  }

  if (url.pathname === '/api/mocktests' && request.method === 'GET') {
    return await getMockTestsRequest(url);
  }

  if (url.pathname === '/api/mocktests/sessions' && request.method === 'POST') {
    return await createMockTestSessionRequest(request);
  }

  if (url.pathname === '/api/mocktests/attempts' && request.method === 'POST') {
    return await submitMockTestAttemptRequest(request);
  }

  if (url.pathname === '/api/mocktests/my-attempts' && request.method === 'GET') {
    return await getMyMocktestAttemptsRequest(request, url);
  }

  if (url.pathname === '/api/mocktests/guest/link' && request.method === 'POST') {
    return await linkGuestMocktestSessionsRequest(request);
  }

  const testMatch = url.pathname.match(/^\/api\/mocktests\/(\d+)$/);
  if (testMatch && request.method === 'GET') {
    return await getMockTestRequest(testMatch[1]);
  }

  return null;
}