import usersService from './users.service';
import type { LoginPlatform } from '../../models/users.model';

function jsonResponse(status: number, body: Record<string, any>, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
}

export class UsersController {
  async listUsers(url: URL): Promise<Response> {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const users = await usersService.getAllUsers(limit);
    return jsonResponse(200, { success: true, count: users.length, data: users });
  }

  async createUser(request: Request): Promise<Response> {
    const body = await request.json().catch(() => ({}));
    const user = await usersService.createUser(body);
    return jsonResponse(201, { success: true, message: 'User created successfully', data: user });
  }

  async authMobile(request: Request): Promise<Response> {
    const body = await request.json().catch(() => ({}));
    const mobile: string = body.mobile || body.phone;
    const isInputMobile: boolean = Boolean(body.isInputMobile);
    const loginPlatform: LoginPlatform = body.login_platform || 'web';

    if (!mobile) {
      return jsonResponse(400, { success: false, message: 'mobile is required' });
    }

    const result = await usersService.authenticateMobile(mobile, isInputMobile, loginPlatform);

    return jsonResponse(
      200,
      {
        success: true,
        data: result.data,
      },
      {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'X-Cache': 'BYPASS',
      }
    );
  }

  async login(request: Request): Promise<Response> {
    const body = await request.json().catch(() => ({}));
    const userName = body.user_name || body.userName || body.username;
    const password = body.password;

    if (!userName || !password) {
      return jsonResponse(400, { success: false, message: 'user_name and password are required' });
    }

    try {
      const result = await usersService.loginWithUsername(userName, password);
      return jsonResponse(200, {
        success: true,
        data: result,
      });
    } catch (error: any) {
      return jsonResponse(400, { success: false, message: error.message || 'Login failed' });
    }
  }
}

export default new UsersController();
