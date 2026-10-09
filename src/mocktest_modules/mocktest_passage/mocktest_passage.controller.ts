import { getVerifiedAuthUser, hasRole } from '../../lib/auth';
import { createPassage, getRandomPassage, TursoDatabaseConfigurationError } from './mocktest_passage.dao';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function createPassageRequest(request: Request): Promise<Response> {
  const user = getVerifiedAuthUser(request);
  if (!user) return jsonResponse({ success: false, error: 'Unauthorized. Token missing or invalid.' }, 401);
  if (!hasRole(user, 'ADMIN')) return jsonResponse({ success: false, error: 'Forbidden. Admin role required.' }, 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Request body must be valid JSON' }, 400);
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return jsonResponse({ success: false, error: 'Request body must be a JSON object' }, 400);
  }

  const body = input as Record<string, unknown>;
  if (typeof body.passage_text !== 'string' || !body.passage_text.trim()) {
    return jsonResponse({ success: false, error: 'passage_text is required and must be non-empty' }, 400);
  }
  if (typeof body.test_name !== 'string' || !body.test_name.trim()) {
    return jsonResponse({ success: false, error: 'test_name is required and must be non-empty' }, 400);
  }

  try {
    const data = await createPassage({
      passage_text: body.passage_text,
      test_name: body.test_name.trim(),
    });
    return jsonResponse({ success: true, message: 'Passage created successfully', data }, 201);
  } catch (error) {
    if (error instanceof TursoDatabaseConfigurationError) {
      return jsonResponse({ success: false, error: error.message }, 503);
    }
    console.error('Failed to create mocktest passage:', error);
    return jsonResponse({ success: false, error: 'Failed to create passage' }, 500);
  }
}

export async function getRandomPassageRequest(url: URL): Promise<Response> {
  const rawTestName = url.searchParams.get('test_name');
  if (rawTestName !== null && !rawTestName.trim()) {
    return jsonResponse({ success: false, error: 'test_name cannot be empty' }, 400);
  }

  try {
    const data = await getRandomPassage(rawTestName?.trim());
    if (!data) return jsonResponse({ success: false, error: 'No passage found' }, 404);
    return jsonResponse({ success: true, data }, 200);
  } catch (error) {
    if (error instanceof TursoDatabaseConfigurationError) {
      return jsonResponse({ success: false, error: error.message }, 503);
    }
    console.error('Failed to get mocktest passage:', error);
    return jsonResponse({ success: false, error: 'Failed to get passage' }, 500);
  }
}