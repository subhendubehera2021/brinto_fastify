import fieldValuesController from './field-values.controller';
import { handleCorsPreflight } from '../../lib/cors';

export async function handleFieldValuesRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const pathname = (url.pathname || '/').replace(/\/+$/, '') || '/';
  const method = request.method;

  // POST /api/field-values
  if (pathname === '/api/field-values' && method === 'POST') {
    return await fieldValuesController.create(request);
  }

  // GET /api/field-values/order/:orderId
  const orderMatch = pathname.match(/^\/api\/field-values\/order\/([^/]+)$/);
  if (orderMatch && method === 'GET') {
    return await fieldValuesController.getByOrderId(request, orderMatch[1]);
  }

  // PUT /api/field-values/:id
  const fieldValueMatch = pathname.match(/^\/api\/field-values\/([^/]+)$/);
  if (fieldValueMatch && method === 'PUT') {
    return await fieldValuesController.update(request, fieldValueMatch[1]);
  }

  // DELETE /api/field-values/:id
  if (fieldValueMatch && method === 'DELETE') {
    return await fieldValuesController.delete(request, fieldValueMatch[1]);
  }

  return null;
}
