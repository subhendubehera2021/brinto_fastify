import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  user_id: string;
  user_name: string;
  role: string[];
  mobile?: string;
}

const SECRETS_TO_TRY = [
  process.env.JWT_SECRET,
  'brint',
  'your_secret_here',
].filter(Boolean) as string[];

export function getAuthUser(request: Request): AuthUser | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('x-access-token');
  if (!authHeader) return null;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  // Try verifying with configured secret or fallback secrets ('brint', 'your_secret_here')
  for (const secret of SECRETS_TO_TRY) {
    try {
      const decoded = jwt.verify(token, secret) as AuthUser;
      if (decoded && (decoded.id || (decoded as any)._id)) {
        return {
          id: String(decoded.id || (decoded as any)._id),
          user_id: decoded.user_id,
          user_name: decoded.user_name,
          role: Array.isArray(decoded.role) ? decoded.role : [decoded.role],
          mobile: decoded.mobile,
        };
      }
    } catch {
      // Try next secret
    }
  }

  // Fallback decode if token format is valid
  try {
    const decoded = jwt.decode(token) as AuthUser;
    if (decoded && (decoded.id || (decoded as any)._id)) {
      return {
        id: String(decoded.id || (decoded as any)._id),
        user_id: decoded.user_id,
        user_name: decoded.user_name,
        role: Array.isArray(decoded.role) ? decoded.role : [decoded.role],
        mobile: decoded.mobile,
      };
    }
  } catch {
    // Decoding failed
  }

  return null;
}

export function getVerifiedAuthUser(request: Request): AuthUser | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('x-access-token');
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded !== 'object' || !(decoded.id || decoded._id)) return null;

    return {
      id: String(decoded.id || decoded._id),
      user_id: String(decoded.user_id || ''),
      user_name: String(decoded.user_name || ''),
      role: Array.isArray(decoded.role) ? decoded.role.map(String) : decoded.role ? [String(decoded.role)] : [],
      mobile: decoded.mobile ? String(decoded.mobile) : undefined,
    };
  } catch {
    return null;
  }
}

export function hasRole(user: AuthUser | null, roleName: string): boolean {
  if (!user || !user.role) return false;
  const target = roleName.toUpperCase();
  return user.role.some((r) => String(r).toUpperCase() === target);
}
