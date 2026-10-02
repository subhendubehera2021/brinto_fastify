import documentsService from './documents.service';
import { getAuthUser } from '../../lib/auth';

function jsonResponse(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorizedResponse(): Response {
  return jsonResponse(401, { success: false, message: 'Unauthorized. Token missing or invalid.' });
}

export class DocumentsController {
  async getAllDocs(request: Request, url: URL): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const result = await documentsService.getAllDocs(user.id, page, limit);

    return jsonResponse(200, {
      success: true,
      data: result.docs,
      total: result.total,
      page,
      limit,
    });
  }
}

export default new DocumentsController();
