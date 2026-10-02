import formsService from './forms.service';
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

function forbiddenResponse(msg: string): Response {
  return jsonResponse(403, { success: false, message: `Forbidden. ${msg}` });
}

export class FormsController {
  async getAllForms(): Promise<Response> {
    const forms = await formsService.getFormsList();
    return jsonResponse(200, { success: true, data: forms });
  }

  async getLatestHomeForms(): Promise<Response> {
    const forms = await formsService.getLatestHomeForms();
    return jsonResponse(200, { success: true, data: forms });
  }

  async getLatestFormsByState(url: URL, stateParam?: string): Promise<Response> {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '8');
    const result = await formsService.getLatestFormsByState(stateParam, page, limit);

    return jsonResponse(200, {
      success: true,
      data: result.forms,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit,
      },
    });
  }

  async getCentralForms(url: URL): Promise<Response> {
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '8');
    const result = await formsService.getCentralForms(page, limit);

    return jsonResponse(200, {
      success: true,
      data: result.forms,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit,
      },
    });
  }

  async getMinimalFormDetails(id: string): Promise<Response> {
    const form = await formsService.getMinimalFormDetails(id);
    return jsonResponse(200, { success: true, data: form });
  }

  async getFormBySlug(slug: string): Promise<Response> {
    const form = await formsService.getFormDetails(slug);
    return jsonResponse(200, { success: true, data: form });
  }

  async getFormDetails(slugOrId: string, url: URL): Promise<Response> {
    const queryOptions = {
      includeInputs: url.searchParams.get('includeInputs') !== 'false',
      includePricing: url.searchParams.get('includePricing') !== 'false',
      includeCapabilities: url.searchParams.get('includeCapabilities') !== 'false',
      includeDocs: url.searchParams.get('includeDocs') !== 'false',
      docsFields: url.searchParams.get('docsFields') || 'name',
    };

    const form = await formsService.getFormDetailsNew(slugOrId, queryOptions);
    return jsonResponse(200, { success: true, data: form });
  }

  async getFormInputs(request: Request, url: URL, formId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const isNormal = url.searchParams.get('isNormal');
    const ai = url.searchParams.get('ai');

    const result = await formsService.getFormInputs(formId, { isNormal, ai });
    return jsonResponse(200, { success: true, data: result });
  }

  async getAdminFormsPaginated(request: Request, url: URL): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || (!user.role.includes('ADMIN') && !user.role.includes('STORE_OWNER'))) {
      return forbiddenResponse('Admin or Store Owner role required.');
    }

    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';

    const result = await formsService.getAdminFormsPaginated(page, limit, search, status);
    return jsonResponse(200, { success: true, data: result });
  }

  async createStep1(request: Request): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !user.role.includes('ADMIN')) return forbiddenResponse('Admin role required.');

    const body = await request.json().catch(() => ({}));
    const result = await formsService.processStep1(body);

    return jsonResponse(201, {
      success: true,
      message: 'Step 1 complete. Form draft created.',
      data: {
        _id: result._id,
        formId: result.formId,
      },
    });
  }

  async updateStep1(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !user.role.includes('ADMIN')) return forbiddenResponse('Admin role required.');

    const body = await request.json().catch(() => ({}));
    const result = await formsService.updateStep1(id, body);

    return jsonResponse(200, {
      success: true,
      message: 'Step 1 updated successfully.',
      data: {
        _id: result._id,
        formId: result.formId,
      },
    });
  }

  async createStep2(request: Request, formId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !user.role.includes('ADMIN')) return forbiddenResponse('Admin role required.');

    const body = await request.json().catch(() => ({}));
    const inputs = body.inputs || [];
    const result = await formsService.processStep2(formId, inputs);

    return jsonResponse(200, { success: true, data: result });
  }

  async createStep3(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !user.role.includes('ADMIN')) return forbiddenResponse('Admin role required.');

    const body = await request.json().catch(() => ({}));
    const result = await formsService.processStep3(id, body);

    return jsonResponse(200, {
      success: true,
      message: 'Form successfully published!',
      data: result,
    });
  }

  async updateRequireDocuments(request: Request, id: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !user.role.includes('ADMIN')) return forbiddenResponse('Admin role required.');

    const { requireDocuments } = await request.json().catch(() => ({}));
    const result = await formsService.updateRequireDocuments(id, requireDocuments || []);

    return jsonResponse(200, {
      success: true,
      message: 'Required documents updated successfully!',
      data: result,
    });
  }

  async updateRequireDocumentsByFormId(request: Request, formId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user || !user.role.includes('ADMIN')) return forbiddenResponse('Admin role required.');

    const { requireDocuments } = await request.json().catch(() => ({}));
    const result = await formsService.updateRequireDocumentsByFormId(formId, requireDocuments || []);

    if (!result) {
      return jsonResponse(404, { success: false, message: 'Form not found.' });
    }

    return jsonResponse(200, {
      success: true,
      message: 'Required documents updated successfully!',
      data: result,
    });
  }

  async getFormQuestions(request: Request, formId: string): Promise<Response> {
    const user = getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const questions = await formsService.getFormQuestions(formId);
    return jsonResponse(200, { success: true, data: questions });
  }
}

export default new FormsController();
