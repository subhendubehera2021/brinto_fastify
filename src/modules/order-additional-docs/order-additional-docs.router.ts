import orderAdditionalDocsController from './order-additional-docs.controller';
import { handleCorsPreflight } from '../../lib/cors';

export async function handleOrderAdditionalDocsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const rawPath = url.pathname;
  const pathname = rawPath.length > 1 && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  const method = request.method;

  // POST /api/order-additional-docs or POST /api/order-additional-docs/create
  if ((pathname === '/api/order-additional-docs' || pathname === '/api/order-additional-docs/create') && method === 'POST') {
    return await orderAdditionalDocsController.createAdditionalDoc(request);
  }

  // GET /api/order-additional-docs/order/:orderId
  const orderDocsMatch = pathname.match(/^\/api\/order-additional-docs\/order\/([^\/]+)$/);
  if (orderDocsMatch && method === 'GET') {
    return await orderAdditionalDocsController.getDocsForOrder(orderDocsMatch[1]);
  }

  // DELETE /api/order-additional-docs/:id
  const deleteMatch = pathname.match(/^\/api\/order-additional-docs\/([^\/]+)$/);
  if (deleteMatch && method === 'DELETE' && deleteMatch[1] !== 'create') {
    return await orderAdditionalDocsController.deleteAdditionalDoc(request, deleteMatch[1]);
  }

  return null;
}
