import documentsService, { DocumentUploadError, R2ConfigurationError } from './documents.service';
import { getAuthUser } from '../../lib/auth';
import { Types } from 'mongoose';

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

  async getDocById(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (!Types.ObjectId.isValid(id)) {
      return jsonResponse(400, { success: false, message: 'Invalid document ID.' });
    }

    const doc = await documentsService.getDocById(user.id, id);
    if (!doc) return jsonResponse(404, { success: false, message: 'Document not found.' });

    return jsonResponse(200, { success: true, data: doc });
  }

  async updateDocUploadStatus(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !Types.ObjectId.isValid(user.id)) return unauthorizedResponse();
    if (!Types.ObjectId.isValid(id)) {
      return jsonResponse(400, { success: false, message: 'Invalid document ID.' });
    }

    const parsedBody: unknown = await request.json().catch(() => ({}));
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return jsonResponse(400, { success: false, message: 'Request body must be a JSON object.' });
    }
    const uploaded = (parsedBody as Record<string, unknown>).uploaded;
    if (typeof uploaded !== 'boolean') {
      return jsonResponse(400, { success: false, message: 'uploaded must be a boolean.' });
    }

    try {
      const document = await documentsService.updateUserDocumentUploaded(user.id, id, uploaded);
      return jsonResponse(200, { success: true, message: 'Document upload status updated.', data: document });
    } catch (error: unknown) {
      if (error instanceof DocumentUploadError || error instanceof R2ConfigurationError) {
        const status = error instanceof DocumentUploadError ? error.status : 500;
        return jsonResponse(status, { success: false, message: error.message });
      }
      console.error('Error updating document upload status:', error);
      return jsonResponse(500, { success: false, message: 'Failed to update document upload status.' });
    }
  }

  async getBlogUploadUrl(request: Request): Promise<Response> {
    return this.createUploadUrl(request);
  }

  async getUserUploadUrl(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !Types.ObjectId.isValid(user.id)) return unauthorizedResponse();
    return this.createUploadUrl(request, new Types.ObjectId(user.id).toHexString());
  }

  private async createUploadUrl(request: Request, userId?: string): Promise<Response> {
    const parsedBody: unknown = await request.json().catch(() => ({}));
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return jsonResponse(400, { success: false, message: 'Request body must be a JSON object.' });
    }
    const body = parsedBody as Record<string, unknown>;
    const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
    if (!fileName) {
      return jsonResponse(400, { success: false, message: 'fileName is required.' });
    }

    if (body.contentType !== undefined && typeof body.contentType !== 'string') {
      return jsonResponse(400, { success: false, message: 'contentType must be a string.' });
    }

    const contentType = typeof body.contentType === 'string' && body.contentType.trim()
      ? body.contentType.trim()
      : 'application/pdf';
    const uploadType = userId ? 'user' : 'blog';

    try {
      const result = userId
        ? await documentsService.getUserUploadUrl(userId, fileName, contentType)
        : await documentsService.getBlogUploadUrl(fileName, contentType);
      return jsonResponse(200, { success: true, ...result });
    } catch (error: unknown) {
      if (error instanceof R2ConfigurationError) {
        return jsonResponse(500, { success: false, message: error.message });
      }
      console.error(
        `Error generating ${uploadType} R2 upload URL:`,
        error instanceof Error ? error.message : error
      );
      return jsonResponse(500, { success: false, message: `Failed to generate ${uploadType} upload URL.` });
    }
  }
}

export default new DocumentsController();
