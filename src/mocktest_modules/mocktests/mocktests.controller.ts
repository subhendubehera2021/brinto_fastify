import {
  createMockTest,
  createMockTestSession,
  getMockTestById,
  MocktestsDatabaseConfigurationError,
  MocktestNotFoundError,
  MocktestSubmissionError,
  submitMockTestAttempt,
  type CreateMockTestInput,
  type SubmitMockTestAttemptInput,
} from './mocktests.dao';
import { getVerifiedAuthUser, hasRole, type AuthUser } from '../../lib/auth';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCreateMockTestInput(value: unknown): string | null {
  if (!isRecord(value)) return 'Request body must be a JSON object';

  for (const field of ['title', 'exam', 'href', 'slug']) {
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

function isResponse(value: AuthUser | Response): value is Response {
  return value instanceof Response;
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

export async function getMockTestRequest(request: Request, rawTestId: string): Promise<Response> {
  const user = authorizeMocktestUser(request);
  if (isResponse(user)) return user;

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

export async function createMockTestSessionRequest(request: Request): Promise<Response> {
  const user = authorizeMocktestUser(request);
  if (isResponse(user)) return user;
  if (!user.mobile) {
    return jsonResponse({ success: false, error: 'A verified mobile number is required in the authentication token.' }, 403);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Request body must be valid JSON' }, 400);
  }
  if (!isRecord(input) || typeof input.testId !== 'number' || !Number.isSafeInteger(input.testId) || input.testId < 1) {
    return jsonResponse({ success: false, error: 'testId must be a positive integer' }, 400);
  }

  try {
    const session = await createMockTestSession(user.user_name || user.user_id || user.id, user.mobile, input.testId);
    return jsonResponse({ success: true, data: session }, 201);
  } catch (error) {
    return respondToAttemptError(error);
  }
}

export async function submitMockTestAttemptRequest(request: Request): Promise<Response> {
  const user = authorizeMocktestUser(request);
  if (isResponse(user)) return user;
  if (!user.mobile) {
    return jsonResponse({ success: false, error: 'A verified mobile number is required in the authentication token.' }, 403);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Request body must be valid JSON' }, 400);
  }

  const validationError = validateAttemptInput(input);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);

  try {
    const result = await submitMockTestAttempt({ ...(input as Omit<SubmitMockTestAttemptInput, 'mobile'>), mobile: user.mobile });
    return jsonResponse({ success: true, message: 'Mock test attempt submitted successfully', data: result }, 201);
  } catch (error) {
    return respondToAttemptError(error);
  }
}