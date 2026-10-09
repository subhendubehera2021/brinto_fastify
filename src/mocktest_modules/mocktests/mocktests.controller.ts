import {
  createMockTest,
  createMockTestSession,
  getMockTestById,
  getUserMocktestAttempts,
  guestIdentityExists,
  linkGuestMocktestSessions,
  MocktestsDatabaseConfigurationError,
  MocktestNotFoundError,
  MocktestSubmissionError,
  submitMockTestAttempt,
  type CreateMockTestInput,
  type MocktestOwner,
  type SubmitMockTestAttemptInput,
} from './mocktests.dao';
import { getVerifiedAuthUser, hasRole, type AuthUser } from '../../lib/auth';
import { createGuestId, hashGuestId, isValidGuestId } from './guest-id';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCreateMockTestInput(value: unknown): string | null {
  if (!isRecord(value)) return 'Request body must be a JSON object';

  for (const field of ['title', 'exam']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) {
      return `${field} is required and must be a non-empty string`;
    }
  }

  if (!Array.isArray(value.questions)) return 'questions must be an array';

  for (const [questionIndex, question] of value.questions.entries()) {
    if (!isRecord(question)) return `questions[${questionIndex}] must be an object`;
    if (typeof question.section !== 'string' || !question.section.trim()) {
      return `questions[${questionIndex}].section is required`;
    }
    if (typeof question.text !== 'string' || !question.text.trim()) {
      return `questions[${questionIndex}].text is required`;
    }
    if (question.explanation !== undefined && question.explanation !== null && typeof question.explanation !== 'string') {
      return `questions[${questionIndex}].explanation must be a string or null`;
    }
    if (!Array.isArray(question.options)) return `questions[${questionIndex}].options must be an array`;

    for (const [optionIndex, option] of question.options.entries()) {
      if (!isRecord(option) || typeof option.text !== 'string' || !option.text.trim()) {
        return `questions[${questionIndex}].options[${optionIndex}].text is required`;
      }
      if (option.is_correct !== undefined && typeof option.is_correct !== 'boolean') {
        return `questions[${questionIndex}].options[${optionIndex}].is_correct must be a boolean`;
      }
    }
  }

  for (const field of ['duration', 'attempts']) {
    if (value[field] !== undefined && (!Number.isInteger(value[field]) || Number(value[field]) < 0)) {
      return `${field} must be a non-negative integer`;
    }
  }
  if (value.rating !== undefined && (typeof value.rating !== 'number' || !Number.isFinite(value.rating) || value.rating < 0)) {
    return 'rating must be a non-negative number';
  }
  if (value.difficulty !== undefined && typeof value.difficulty !== 'string') return 'difficulty must be a string';
  for (const field of ['is_new', 'is_free']) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean') return `${field} must be a boolean`;
  }

  return null;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authorizeMocktestUser(request: Request): AuthUser | Response {
  const user = getVerifiedAuthUser(request);
  if (!user) return jsonResponse({ success: false, error: 'Unauthorized. Token missing or invalid.' }, 401);
  if (!['USER', 'STUDENT', 'ADMIN'].some((role) => hasRole(user, role))) {
    return jsonResponse({ success: false, error: 'Forbidden. Student role required.' }, 403);
  }
  return user;
}

function isResponse<T>(value: T | Response): value is Response {
  return value instanceof Response;
}

interface MocktestIdentity {
  owner: MocktestOwner;
  displayName: string;
  guestId?: string;
  isNewGuest: boolean;
}

type IdentityResult = MocktestIdentity | Response;

async function resolveMocktestIdentity(request: Request, allowNewGuest = false): Promise<IdentityResult> {
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
      return {
        owner: { mobile: user.mobile, guestIdHash: null },
        displayName: user.user_name || user.user_id || user.id,
        isNewGuest: false,
      };
    }
  }

  const guestId = request.headers.get('x-guest-id')?.trim();
  if (guestId) {
    if (!isValidGuestId(guestId)) {
      return jsonResponse({ success: false, error: 'Invalid guest ID.' }, 401);
    }
    return {
      owner: { mobile: null, guestIdHash: await hashGuestId(guestId) },
      displayName: 'Guest',
      guestId,
      isNewGuest: false,
    };
  }

  if (invalidAuthorization) {
    return jsonResponse({ success: false, error: 'Unauthorized. Token missing or invalid.' }, 401);
  }

  if (!allowNewGuest) {
    return jsonResponse({ success: false, error: 'Authentication or X-Guest-Id is required.' }, 401);
  }

  const newGuestId = createGuestId();
  return {
    owner: { mobile: null, guestIdHash: await hashGuestId(newGuestId) },
    displayName: 'Guest',
    guestId: newGuestId,
    isNewGuest: true,
  };
}

function validateTestId(value: string): number | null {
  const testId = Number(value);
  return Number.isSafeInteger(testId) && testId > 0 ? testId : null;
}

function validateAttemptInput(value: unknown): string | null {
  if (!isRecord(value)) return 'Request body must be a JSON object';
  if (typeof value.sessionId !== 'string' || !value.sessionId.trim()) return 'sessionId is required';
  if (typeof value.timeTaken !== 'number' || !Number.isSafeInteger(value.timeTaken) || value.timeTaken < 0) {
    return 'timeTaken must be a non-negative integer';
  }
  if (!Array.isArray(value.answers)) return 'answers must be an array';

  for (const [index, answer] of value.answers.entries()) {
    if (!isRecord(answer)) return `answers[${index}] must be an object`;
    if (typeof answer.questionId !== 'number' || !Number.isSafeInteger(answer.questionId) || answer.questionId < 1) {
      return `answers[${index}].questionId must be a positive integer`;
    }
    if (
      answer.selectedOptionId !== null &&
      (typeof answer.selectedOptionId !== 'number' || !Number.isSafeInteger(answer.selectedOptionId) || answer.selectedOptionId < 1)
    ) {
      return `answers[${index}].selectedOptionId must be a positive integer or null`;
    }
    if (answer.isMarked !== undefined && typeof answer.isMarked !== 'boolean') {
      return `answers[${index}].isMarked must be a boolean`;
    }
  }
  return null;
}

function respondToAttemptError(error: unknown): Response {
  if (error instanceof MocktestsDatabaseConfigurationError) {
    return jsonResponse({ success: false, error: error.message }, 503);
  }
  if (error instanceof MocktestNotFoundError) {
    return jsonResponse({ success: false, error: error.message }, 404);
  }
  if (error instanceof MocktestSubmissionError) {
    return jsonResponse({ success: false, error: error.message }, 400);
  }
  console.error('Mocktest request failed:', error);
  return jsonResponse({ success: false, error: 'Mocktest request failed' }, 500);
}

export async function createMockTestRequest(request: Request): Promise<Response> {
  const user = getVerifiedAuthUser(request);
  if (!user) return jsonResponse({ success: false, error: 'Unauthorized. Token missing or invalid.' }, 401);
  if (!hasRole(user, 'ADMIN')) return jsonResponse({ success: false, error: 'Forbidden. Admin role required.' }, 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Request body must be valid JSON' }, 400);
  }

  const validationError = validateCreateMockTestInput(input);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);

  try {
    const data = await createMockTest(input as CreateMockTestInput);
    return jsonResponse({ success: true, message: 'Mock test created successfully', data }, 201);
  } catch (error) {
    if (error instanceof MocktestsDatabaseConfigurationError) {
      return jsonResponse({ success: false, error: error.message }, 503);
    }
    console.error('Failed to create mock test:', error);
    return jsonResponse({ success: false, error: 'Failed to create mock test' }, 500);
  }
}

export async function getMockTestRequest(rawTestId: string): Promise<Response> {
  const testId = validateTestId(rawTestId);
  if (testId === null) return jsonResponse({ success: false, error: 'testId must be a positive integer' }, 400);

  try {
    const test = await getMockTestById(testId);
    if (!test) return jsonResponse({ success: false, error: 'Mock test not found' }, 404);
    return jsonResponse({ success: true, data: test }, 200);
  } catch (error) {
    return respondToAttemptError(error);
  }
}

export async function getMyMocktestAttemptsRequest(request: Request, url: URL): Promise<Response> {
  const identity = await resolveMocktestIdentity(request);
  if (isResponse(identity)) return identity;

  const requestedPage = Number(url.searchParams.get('page') || 1);
  const requestedLimit = Number(url.searchParams.get('limit') || 10);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    return jsonResponse({ success: false, error: 'page must be a positive integer' }, 400);
  }
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    return jsonResponse({ success: false, error: 'limit must be a positive integer' }, 400);
  }

  const limit = Math.min(requestedLimit, 50);
  try {
    const result = await getUserMocktestAttempts(identity.owner, requestedPage, limit, identity.guestId);
    return jsonResponse({
      success: true,
      data: result.attempts,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    }, 200);
  } catch (error) {
    return respondToAttemptError(error);
  }
}

export async function createMockTestSessionRequest(request: Request): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Request body must be valid JSON' }, 400);
  }
  if (!isRecord(input) || typeof input.testId !== 'number' || !Number.isSafeInteger(input.testId) || input.testId < 1) {
    return jsonResponse({ success: false, error: 'testId must be a positive integer' }, 400);
  }

  const identity = await resolveMocktestIdentity(request, true);
  if (isResponse(identity)) return identity;

  try {
    if (!identity.isNewGuest && identity.owner.guestIdHash && !(await guestIdentityExists(identity.owner.guestIdHash))) {
      return jsonResponse({ success: false, error: 'Guest identity not found.' }, 401);
    }
    const session = await createMockTestSession(identity.displayName, identity.owner, input.testId);
    return jsonResponse({
      success: true,
      data: { ...session, ...(identity.isNewGuest ? { guestId: identity.guestId } : {}) },
    }, 201);
  } catch (error) {
    return respondToAttemptError(error);
  }
}

export async function submitMockTestAttemptRequest(request: Request): Promise<Response> {
  const identity = await resolveMocktestIdentity(request);
  if (isResponse(identity)) return identity;

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Request body must be valid JSON' }, 400);
  }

  const validationError = validateAttemptInput(input);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);

  try {
    const { sessionId, timeTaken, answers } = input as Omit<SubmitMockTestAttemptInput, 'mobile' | 'guestIdHash'>;
    const result = await submitMockTestAttempt({
      sessionId,
      timeTaken,
      answers,
      ...identity.owner,
    });
    return jsonResponse({ success: true, message: 'Mock test attempt submitted successfully', data: result }, 201);
  } catch (error) {
    return respondToAttemptError(error);
  }
}

export async function linkGuestMocktestSessionsRequest(request: Request): Promise<Response> {
  const user = getVerifiedAuthUser(request);
  if (!user) return jsonResponse({ success: false, error: 'Unauthorized. Token missing or invalid.' }, 401);
  if (!['USER', 'STUDENT', 'ADMIN'].some((role) => hasRole(user, role))) {
    return jsonResponse({ success: false, error: 'Forbidden. Student role required.' }, 403);
  }
  if (!user.mobile) {
    return jsonResponse({ success: false, error: 'A verified mobile number is required in the authentication token.' }, 403);
  }

  const guestId = request.headers.get('x-guest-id')?.trim();
  if (!guestId || !isValidGuestId(guestId)) {
    return jsonResponse({ success: false, error: 'A valid X-Guest-Id header is required.' }, 400);
  }

  try {
    const sessionsLinked = await linkGuestMocktestSessions(
      await hashGuestId(guestId),
      user.mobile,
      user.user_name || user.user_id || user.id
    );
    if (sessionsLinked === 0) return jsonResponse({ success: false, error: 'Guest sessions not found.' }, 404);
    return jsonResponse({ success: true, data: { sessionsLinked } }, 200);
  } catch (error) {
    return respondToAttemptError(error);
  }
}