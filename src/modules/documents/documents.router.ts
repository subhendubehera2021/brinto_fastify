import documentsController from './documents.controller';
import { handleCorsPreflight } from '../../lib/cors';

export async function handleDocumentsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const pathname = url.pathname;
  const method = request.method;

  if (pathname === '/api/get-blog-upload-url' && method === 'POST') {
    return await documentsController.getBlogUploadUrl(request);
  }
  if (pathname === '/api/get-user-upload-url' && method === 'POST') {
    return await documentsController.getUserUploadUrl(request);
  }

  // GET /api/documents or GET /api/documents/list
  if ((pathname === '/api/documents' || pathname === '/api/documents/list') && method === 'GET') {
    return await documentsController.getAllDocs(request, url);
  }

  const detailsMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (detailsMatch && method === 'GET') {
    return await documentsController.getDocById(request, detailsMatch[1]);
  }

  return null;
}
