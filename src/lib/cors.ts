/**
 * Shared CORS configuration and preflight handler for the application.
 */

export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin && requestOrigin !== 'null' ? requestOrigin : '*';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, brinto_token, x-access-token, X-Guest-Id, X-Requested-With, Accept, Origin',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (origin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function handleCorsPreflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get('Origin')),
    });
  }
  return null;
}
