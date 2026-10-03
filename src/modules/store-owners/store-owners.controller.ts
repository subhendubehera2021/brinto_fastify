import { getAuthUser, hasRole } from '../../lib/auth';
import storeOwnersService, { StoreOwnersError } from './store-owners.service';

const jsonResponse = (status: number, body: Record<string, any>) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const pageParam = (url: URL, key: string, fallback: number, max: number) => {
  const parsed = Number.parseInt(url.searchParams.get(key) || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};

const readBody = async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new StoreOwnersError('Request body must be a JSON object.');
  return body as Record<string, any>;
};

const requireUser = (request: Request, roles?: string[]) => {
  const user = getAuthUser(request);
  if (!user) throw new StoreOwnersError('Unauthorized. Token missing or invalid.', 401);
  if (roles && !roles.some((role) => hasRole(user, role))) {
    throw new StoreOwnersError(`Forbidden. ${roles.join(' or ')} role required.`, 403);
  }
  return user;
};

const result = async (status: number, message: string, action: () => Promise<unknown>) => {
  const data = await action();
  return jsonResponse(status, { success: true, message, data });
};

const storeOwnersController = {
  async dispatch(request: Request, url: URL): Promise<Response | null> {
    const { pathname, searchParams } = url;
    const method = request.method;
    const storeOwnerRoles = ['STORE_OWNER', 'ADMIN'];
    const page = pageParam(url, 'page', 1, 1_000_000);
    const limit = pageParam(url, 'limit', 20, 100);

    if (pathname === '/api/store-owners/search' && method === 'GET') {
      return result(200, 'Stores fetched successfully', () => storeOwnersService.searchSubscribedStores(
        searchParams.get('formId') || '', searchParams.get('search') || undefined, page, limit
      ));
    }
    if (pathname === '/api/store-owners/my-stores' && method === 'GET') {
      const user = requireUser(request, storeOwnerRoles);
      return result(200, 'Stores fetched successfully', () => storeOwnersService.getMyStores(user.id));
    }
    if (pathname === '/api/store-owners/my-stores' && method === 'POST') {
      const user = requireUser(request);
      return result(201, 'Store created successfully', async () => storeOwnersService.createStore(user, await readBody(request)));
    }

    let match = pathname.match(/^\/api\/store-owners\/my-stores\/([^/]+)$/);
    if (match && method === 'GET') {
      const user = requireUser(request, storeOwnerRoles);
      return result(200, 'Store fetched successfully', () => storeOwnersService.getMyStoreById(match![1], user.id));
    }
    if (match && method === 'PATCH') {
      const user = requireUser(request, storeOwnerRoles);
      return result(200, 'Store updated successfully', async () => storeOwnersService.updateStore(match![1], user.id, await readBody(request)));
    }
    if (match && method === 'DELETE') {
      const user = requireUser(request, storeOwnerRoles);
      return result(200, 'Store deactivated successfully', () => storeOwnersService.deactivateStore(match![1], user.id));
    }

    if (pathname === '/api/store-owners/admin/stores' && method === 'GET') {
      requireUser(request, ['ADMIN']);
      return result(200, 'Stores fetched successfully', () => storeOwnersService.adminGetAllStores(
        searchParams.get('status') || undefined,
        page,
        pageParam(url, 'limit', 20, 100)
      ));
    }
    match = pathname.match(/^\/api\/store-owners\/admin\/stores\/([^/]+)$/);
    if (match && method === 'GET') {
      requireUser(request, ['ADMIN']);
      return result(200, 'Store fetched successfully', () => storeOwnersService.adminGetStoreById(match![1]));
    }

    if (pathname === '/api/store-owners/store-forms' && method === 'POST') {
      const user = requireUser(request, storeOwnerRoles);
      const body = await readBody(request);
      return result(201, 'Form associated with store successfully', () => storeOwnersService.addFormToStore(
        user.id, hasRole(user, 'ADMIN'), String(body.storeId || ''), String(body.formId || '')
      ));
    }
    match = pathname.match(/^\/api\/store-owners\/store-forms\/store\/([^/]+)$/);
    if (match && method === 'GET') {
      return result(200, 'Forms fetched successfully', () => storeOwnersService.getFormsForStore(
        match![1], page, pageParam(url, 'limit', 10, 100),
        searchParams.get('status') || undefined, searchParams.get('search') || undefined
      ));
    }
    match = pathname.match(/^\/api\/store-owners\/store-forms\/([^/]+)\/toggle$/);
    if (match && method === 'PATCH') {
      requireUser(request, ['ADMIN']);
      const body = await readBody(request);
      return result(200, 'Store-form status updated successfully', () => storeOwnersService.toggleFormStatus(match![1], body.isActive));
    }
    match = pathname.match(/^\/api\/store-owners\/store-forms\/([^/]+)$/);
    if (match && method === 'DELETE') {
      requireUser(request, ['ADMIN']);
      return result(200, 'Form successfully removed from store.', () => storeOwnersService.removeFormFromStore(match![1]));
    }

    if (pathname === '/api/store-owners/store-subscriptions/plans' && method === 'GET') {
      return result(200, 'Subscription plans fetched successfully', () => storeOwnersService.listPlans());
    }
    match = pathname.match(/^\/api\/store-owners\/store-subscriptions\/my-subscription\/([^/]+)$/);
    if (match && method === 'GET') {
      const user = requireUser(request, storeOwnerRoles);
      return result(200, 'Subscription fetched successfully', () => storeOwnersService.getStoreSubscription(match![1], user.id));
    }
    if (pathname === '/api/store-owners/store-subscriptions/subscribe' && method === 'POST') {
      const user = requireUser(request, storeOwnerRoles);
      const body = await readBody(request);
      return result(201, 'Subscription created successfully', () => storeOwnersService.subscribeStore(
        String(body.storeId || ''), String(body.planId || ''), user.id
      ));
    }

    return null;
  },
};

export default storeOwnersController;