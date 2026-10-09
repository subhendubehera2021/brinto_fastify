import {
  createMockTest,
  MocktestsDatabaseConfigurationError,
  type CreateMockTestInput,
} from './mocktests.dao';

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

export async function createMockTestRequest(request: Request): Promise<Response> {
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