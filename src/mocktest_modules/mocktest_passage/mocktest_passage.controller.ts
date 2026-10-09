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

  const entries: unknown[] = Array.isArray(input) ? input : [input];
  const isBatch = Array.isArray(input);
  if (entries.length === 0) {
    return jsonResponse({ success: false, error: 'Request array must contain at least one passage' }, 400);
  }

  const passages: Array<{ passage_text: string; test_name: string }> = [];
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return jsonResponse({
        success: false,
        error: isBatch ? `passages[${index}] must be a JSON object` : 'Request body must be a JSON object',
      }, 400);
    }

    const body = entry as Record<string, unknown>;
    if (typeof body.passage_text !== 'string' || !body.passage_text.trim()) {
      return jsonResponse({
        success: false,
        error: isBatch
          ? `passages[${index}].passage_text is required and must be non-empty`
          : 'passage_text is required and must be non-empty',
      }, 400);
    }
    if (typeof body.test_name !== 'string' || !body.test_name.trim()) {
      return jsonResponse({
        success: false,
        error: isBatch
          ? `passages[${index}].test_name is required and must be non-empty`
          : 'test_name is required and must be non-empty',
      }, 400);
    }

    passages.push({
      passage_text: body.passage_text,
      test_name: body.test_name.trim(),
    });
  }

  try {
    const data = await createPassage(isBatch ? passages : passages[0]);
    return jsonResponse({
      success: true,
      message: isBatch ? 'Passages created successfully' : 'Passage created successfully',
      data,
    }, 201);
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