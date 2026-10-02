import orderAdditionalDocsService from './order-additional-docs.service';
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

export class OrderAdditionalDocsController {
  async createAdditionalDoc(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const payload = await request.json().catch(() => ({}));

    try {
      const result = await orderAdditionalDocsService.createAdditionalDocs(user.id, payload);
      return jsonResponse(201, {
        success: true,
        message: 'Order additional document record(s) created successfully',
        data: result,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Failed to create additional document record',
      });
    }
  }

  async getDocsForOrder(orderId: string): Promise<Response> {
    try {
      const docs = await orderAdditionalDocsService.getDocsForOrder(orderId);
      return jsonResponse(200, {
        success: true,
        data: docs,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Failed to fetch additional documents',
      });
    }
  }

  async deleteAdditionalDoc(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    try {
      const deleted = await orderAdditionalDocsService.deleteAdditionalDoc(id);
      return jsonResponse(200, {
        success: true,
        message: 'Additional document record deleted successfully',
        data: deleted,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Failed to delete additional document record',
      });
    }
  }
}

export default new OrderAdditionalDocsController();
