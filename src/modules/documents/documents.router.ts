import documentsController from './documents.controller';
import { handleCorsPreflight } from '../../lib/cors';

export async function handleDocumentsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const pathname = url.pathname;
  const method = request.method;

  // GET /api/documents or GET /api/documents/list
  if ((pathname === '/api/documents' || pathname === '/api/documents/list') && method === 'GET') {
    return await documentsController.getAllDocs(request, url);
  }

  return null;
}
