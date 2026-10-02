import usersController from './users.controller';
import { handleCorsPreflight } from '../../lib/cors';

export async function handleUsersRoute(request: Request, url: URL): Promise<Response | null> {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const pathname = url.pathname;
  const method = request.method;

  // GET /api/users
  if (pathname === '/api/users' && method === 'GET') {
    return await usersController.listUsers(url);
  }

  // POST /api/users
  if (pathname === '/api/users' && method === 'POST') {
    return await usersController.createUser(request);
  }

  // POST /api/users/auth-mobile
  if (pathname === '/api/users/auth-mobile' && method === 'POST') {
    return await usersController.authMobile(request);
  }

  // POST /api/users/login
  if ((pathname === '/api/users/login' || pathname === '/api/users/auth-username') && method === 'POST') {
    return await usersController.login(request);
  }

  return null;
}
