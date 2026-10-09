import { getVerifiedAuthUser, hasRole } from '../../lib/auth';
import {
  createPassage,
  getPassageTypingResultsBySession,
  getRandomPassage,
  InvalidPassageTypingResultError,
  PassageNotFoundError,
  PassageTypingResultOwnershipError,
  savePassageTypingResult,
  TursoDatabaseConfigurationError,
} from './mocktest_passage.dao';
import type { MocktestOwner } from '../mocktests/mocktests.dao';
import { hashGuestId, isValidGuestId } from '../mocktests/guest-id';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function resolveTypingResultOwner(request: Request): Promise<MocktestOwner | Response> {
  const authorization = request.headers.get('authorization') || request.headers.get('x-access-token');
  let invalidAuthorization = false;
  if (authorization) {
    const user = getVerifiedAuthUser(request);
    if (!user) {
      invalidAuthorization = true;
    } else {
      if (!['USER', 'STUDENT', 'ADMIN'].some((role) => hasRole(user, role))) {
        return jsonResponse({ success: false, error: 'Forbidden. Student role required.' }, 403);
      }
      if (!user.mobile) {
        return jsonResponse({ success: false, error: 'A verified mobile number is required in the authentication token.' }, 403);
      }
      return { mobile: user.mobile, guestIdHash: null };
    }
  }

  const guestId = request.headers.get('x-guest-id')?.trim();
  if (guestId) {
    if (!isValidGuestId(guestId)) {
      return jsonResponse({ success: false, error: 'Invalid guest ID.' }, 401);
    }
    return { mobile: null, guestIdHash: await hashGuestId(guestId) };
  }

  if (invalidAuthorization) {
    return jsonResponse({ success: false, error: 'Unauthorized. Token missing or invalid.' }, 401);
  }
  return jsonResponse({ success: false, error: 'Authentication or X-Guest-Id is required.' }, 401);
}

function isResponse(value: MocktestOwner | Response): value is Response {
  return value instanceof Response;
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

  const rawExcludedIds = url.searchParams.getAll('exclude_ids').flatMap((value) => value.split(','));
  const excludedIds: number[] = [];
  for (const rawId of rawExcludedIds) {
    const value = rawId.trim();
    const id = Number(value);
    if (!value || !Number.isSafeInteger(id) || id < 1) {
      return jsonResponse({ success: false, error: 'exclude_ids must contain positive integer passage IDs' }, 400);
    }
    excludedIds.push(id);
  }

  try {
    const data = await getRandomPassage(rawTestName?.trim(), [...new Set(excludedIds)]);
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

export async function submitPassageTypingResultRequest(request: Request): Promise<Response> {
  const owner = await resolveTypingResultOwner(request);
  if (isResponse(owner)) return owner;

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
  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  const passageId = body.passage_id;
  const keystrokesCount = body.keystrokes_count;
  const errorCount = body.error_count;
  const backspaceCount = body.backspace_count;
  const typedWordCount = body.typed_word_count;

  if (!sessionId) return jsonResponse({ success: false, error: 'session_id is required' }, 400);
  if (typeof passageId !== 'number' || !Number.isSafeInteger(passageId) || passageId < 1) return jsonResponse({ success: false, error: 'passage_id must be a positive integer' }, 400);
  if (typeof keystrokesCount !== 'number' || !Number.isSafeInteger(keystrokesCount) || keystrokesCount < 0) return jsonResponse({ success: false, error: 'keystrokes_count must be a non-negative integer' }, 400);
  if (typeof errorCount !== 'number' || !Number.isSafeInteger(errorCount) || errorCount < 0) return jsonResponse({ success: false, error: 'error_count must be a non-negative integer' }, 400);
  if (typeof backspaceCount !== 'number' || !Number.isSafeInteger(backspaceCount) || backspaceCount < 0) return jsonResponse({ success: false, error: 'backspace_count must be a non-negative integer' }, 400);
  if (typeof typedWordCount !== 'number' || !Number.isSafeInteger(typedWordCount) || typedWordCount < 0) return jsonResponse({ success: false, error: 'typed_word_count must be a non-negative integer' }, 400);

  try {
    const data = await savePassageTypingResult({
      session_id: sessionId,
      passage_id: passageId,
      owner,
      keystrokes_count: keystrokesCount,
      error_count: errorCount,
      backspace_count: backspaceCount,
      typed_word_count: typedWordCount,
    });
    return jsonResponse({ success: true, message: 'Passage typing result saved successfully', data }, 201);
  } catch (error) {
    if (error instanceof TursoDatabaseConfigurationError) {
      return jsonResponse({ success: false, error: error.message }, 503);
    }
    if (error instanceof PassageNotFoundError) {
      return jsonResponse({ success: false, error: error.message }, 404);
    }
    if (error instanceof PassageTypingResultOwnershipError) {
      return jsonResponse({ success: false, error: error.message }, 409);
    }
    if (error instanceof InvalidPassageTypingResultError) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
    console.error('Failed to save passage typing result:', error);
    return jsonResponse({ success: false, error: 'Failed to save passage typing result' }, 500);
  }
}

export async function getPassageTypingResultsRequest(request: Request, url: URL): Promise<Response> {
  const owner = await resolveTypingResultOwner(request);
  if (isResponse(owner)) return owner;

  const sessionId = url.searchParams.get('session_id')?.trim();
  if (!sessionId) {
    return jsonResponse({ success: false, error: 'session_id query parameter is required' }, 400);
  }

  const passageIdParam = url.searchParams.get('passage_id');
  const passageId = passageIdParam !== null ? Number(passageIdParam) : undefined;
  if (passageIdParam !== null && (!Number.isSafeInteger(passageId) || passageId! < 1)) {
    return jsonResponse({ success: false, error: 'passage_id must be a positive integer' }, 400);
  }

  try {
    const data = await getPassageTypingResultsBySession(sessionId, owner, passageId);
    return jsonResponse({ success: true, data }, 200);
  } catch (error) {
    if (error instanceof TursoDatabaseConfigurationError) {
      return jsonResponse({ success: false, error: error.message }, 503);
    }
    if (error instanceof InvalidPassageTypingResultError) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
    console.error('Failed to get passage typing results:', error);
    return jsonResponse({ success: false, error: 'Failed to get passage typing results' }, 500);
  }
}