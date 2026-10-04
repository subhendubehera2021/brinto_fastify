import { getAuthUser, hasRole } from '../../lib/auth';
import fieldValuesService from './field-values.service';

function jsonResponse(status: number, body: Record<string, any>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorizedResponse(): Response {
  return jsonResponse(401, { success: false, message: 'Unauthorized. Token missing or invalid.' });
}

function forbiddenResponse(message: string): Response {
  return jsonResponse(403, { success: false, message: `Forbidden. ${message}` });
}

export class FieldValuesController {
  async create(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (!hasRole(user, 'ADMIN') && !hasRole(user, 'USER')) {
      return forbiddenResponse('Admin or User role required.');
    }

    try {
      const payload = await request.json().catch(() => ({}));
      const result = Array.isArray(payload)
        ? await fieldValuesService.createManyFieldValues(payload)
        : await fieldValuesService.createFieldValue(payload);

      return jsonResponse(201, {
        success: true,
        message: 'Field value(s) created successfully',
        data: result,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Failed to create field value(s)',
      });
    }
  }

  async getByOrderId(request: Request, orderId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (!hasRole(user, 'ADMIN') && !hasRole(user, 'USER')) {
      return forbiddenResponse('Admin or User role required.');
    }

    try {
      const result = await fieldValuesService.getFieldValuesByOrderId(orderId);
      return jsonResponse(200, { success: true, data: result });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Failed to fetch field values',
      });
    }
  }

  async update(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (!hasRole(user, 'ADMIN') && !hasRole(user, 'USER')) {
      return forbiddenResponse('Admin or User role required.');
    }

    try {
      const payload = await request.json().catch(() => ({}));
      const result = await fieldValuesService.updateFieldValue(id, payload);

      if (!result) {
        return jsonResponse(404, { success: false, message: 'Field value not found' });
      }

      return jsonResponse(200, {
        success: true,
        message: 'Field value updated successfully',
        data: result,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Failed to update field value',
      });
    }
  }

  async delete(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (!hasRole(user, 'ADMIN')) {
      return forbiddenResponse('Admin role required.');
    }

    try {
      const result = await fieldValuesService.deleteFieldValue(id);
      if (!result) {
        return jsonResponse(404, { success: false, message: 'Field value not found' });
      }

      return jsonResponse(200, {
        success: true,
        message: 'Field value deleted successfully',
        data: result,
      });
    } catch (error: any) {
      return jsonResponse(400, {
        success: false,
        message: error.message || 'Failed to delete field value',
      });
    }
  }
}

export default new FieldValuesController();
