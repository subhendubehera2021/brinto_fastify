import { handleCorsPreflight } from '../../lib/cors';
import {
  createPassageRequest,
  getPassageTypingResultsRequest,
  getRandomPassageRequest,
  submitPassageTypingResultRequest,
} from './mocktest_passage.controller';

export async function handleMocktestPassageRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (url.pathname === '/api/mocktest-passages' && request.method === 'POST') {
    return await createPassageRequest(request);
  }

  if (url.pathname === '/api/mocktest-passages' && request.method === 'GET') {
    return await getRandomPassageRequest(url);
  }

  if (url.pathname === '/api/mocktest-passages/results' && request.method === 'POST') {
    return await submitPassageTypingResultRequest(request);
  }

  if (url.pathname === '/api/mocktest-passages/results' && request.method === 'GET') {
    return await getPassageTypingResultsRequest(url);
  }

  return null;
}