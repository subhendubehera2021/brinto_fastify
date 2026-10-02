import formsController from './forms.controller';
import { handleCorsPreflight } from '../../lib/cors';
import { withCloudflareCache } from '../../lib/cache';

export async function handleFormsRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const pathname = url.pathname;
  const method = request.method;

  // 1. GET /api/forms/list
  if (pathname === '/api/forms/list' && method === 'GET') {
    return await formsController.getAllForms();
  }

  // 2. GET /api/forms/homeForm/latest
  if (pathname === '/api/forms/homeForm/latest' && method === 'GET') {
    return await formsController.getLatestHomeForms();
  }

  // 3. GET /api/forms/state/latest
  if (pathname === '/api/forms/state/latest' && method === 'GET') {
    return await formsController.getLatestFormsByState(url);
  }

  // 4. GET /api/forms/state/:state/latest
  const stateLatestMatch = pathname.match(/^\/api\/forms\/state\/([^\/]+)\/latest$/);
  if (stateLatestMatch && method === 'GET') {
    return await formsController.getLatestFormsByState(url, stateLatestMatch[1]);
  }

  // 5. GET /api/forms/central/latest
  if (pathname === '/api/forms/central/latest' && method === 'GET') {
    return await withCloudflareCache(request, () => formsController.getCentralForms(url));
  }

  // 6. GET /api/forms/admin/list
  if (pathname === '/api/forms/admin/list' && method === 'GET') {
    return await formsController.getAdminFormsPaginated(request, url);
  }

  // 7. GET /api/forms/so/list
  if (pathname === '/api/forms/so/list' && method === 'GET') {
    return await formsController.getAdminFormsPaginated(request, url);
  }

  // 8. POST /api/forms/create/step-1
  if (pathname === '/api/forms/create/step-1' && method === 'POST') {
    return await formsController.createStep1(request);
  }

  // 9. PUT /api/forms/:id/step-1
  const updateStep1Match = pathname.match(/^\/api\/forms\/([^\/]+)\/step-1$/);
  if (updateStep1Match && method === 'PUT') {
    return await formsController.updateStep1(request, updateStep1Match[1]);
  }

  // 10. POST /api/forms/:formId/step-2
  const step2Match = pathname.match(/^\/api\/forms\/([^\/]+)\/step-2$/);
  if (step2Match && method === 'POST') {
    return await formsController.createStep2(request, step2Match[1]);
  }

  // 11. POST /api/forms/:id/step-3
  const step3Match = pathname.match(/^\/api\/forms\/([^\/]+)\/step-3$/);
  if (step3Match && method === 'POST') {
    return await formsController.createStep3(request, step3Match[1]);
  }

  // 12. PUT /api/forms/formId/:formId/require-documents
  const reqDocsByFormIdMatch = pathname.match(/^\/api\/forms\/formId\/([^\/]+)\/require-documents$/);
  if (reqDocsByFormIdMatch && method === 'PUT') {
    return await formsController.updateRequireDocumentsByFormId(request, reqDocsByFormIdMatch[1]);
  }

  // 13. PUT /api/forms/:id/require-documents
  const reqDocsMatch = pathname.match(/^\/api\/forms\/([^\/]+)\/require-documents$/);
  if (reqDocsMatch && method === 'PUT') {
    return await formsController.updateRequireDocuments(request, reqDocsMatch[1]);
  }

  // 14. GET /api/forms/:formId/inputs
  const inputsMatch = pathname.match(/^\/api\/forms\/([^\/]+)\/inputs$/);
  if (inputsMatch && method === 'GET') {
    return await formsController.getFormInputs(request, url, inputsMatch[1]);
  }

  // 15. GET /api/forms/:formId/questions
  const questionsMatch = pathname.match(/^\/api\/forms\/([^\/]+)\/questions$/);
  if (questionsMatch && method === 'GET') {
    return await formsController.getFormQuestions(request, questionsMatch[1]);
  }

  // 16. GET /api/forms/:id/minimal
  const minimalMatch = pathname.match(/^\/api\/forms\/([^\/]+)\/minimal$/);
  if (minimalMatch && method === 'GET') {
    return await formsController.getMinimalFormDetails(minimalMatch[1]);
  }

  // 17. GET /api/forms/details/:slugOrId
  const detailsMatch = pathname.match(/^\/api\/forms\/details\/([^\/]+)$/);
  if (detailsMatch && method === 'GET') {
    return await formsController.getFormDetails(detailsMatch[1], url);
  }

  // 18. GET /api/forms/:slug
  const slugMatch = pathname.match(/^\/api\/forms\/([^\/]+)$/);
  if (slugMatch && method === 'GET') {
    return await formsController.getFormBySlug(slugMatch[1]);
  }

  return null;
}
