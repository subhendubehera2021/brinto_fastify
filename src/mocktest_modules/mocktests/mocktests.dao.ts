import { getTursoClient } from '../../lib/turso';

export { TursoDatabaseConfigurationError as MocktestsDatabaseConfigurationError } from '../../lib/turso';

export interface CreateMockTestInput {
  title: string;
  exam: string;
  duration?: number;
  difficulty?: string;
  attempts?: number;
  rating?: number;
  href: string;
  slug: string;
  is_new?: boolean;
  is_free?: boolean;
  questions: Array<{
    section: string;
    text: string;
    explanation?: string | null;
    options: Array<{
      text: string;
      is_correct?: boolean;
    }>;
  }>;
}

export interface SubmitMockTestAttemptInput {
  sessionId: string;
  mobile: string;
  timeTaken: number;
  answers: Array<{
    questionId: number;
    selectedOptionId: number | null;
    isMarked?: boolean;
  }>;
}

export class MocktestNotFoundError extends Error {}
export class MocktestSubmissionError extends Error {}

export async function createMockTest(input: CreateMockTestInput) {
  const client = getTursoClient();
  const transaction = await client.transaction('write');

  try {
    const testResult = await transaction.execute({
      sql: `INSERT INTO tests
        (title, exam, questions, duration, difficulty, attempts, rating, href, slug, is_new, is_free)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id`,
      args: [
        input.title,
        input.exam,
        input.questions.length,
        input.duration ?? 0,
        input.difficulty ?? 'Medium',
        input.attempts ?? 0,
        input.rating ?? 0,
        input.href,
        input.slug,
        input.is_new ? 1 : 0,
        input.is_free === false ? 0 : 1,
      ],
    });
    const testId = Number(testResult.rows[0]?.id);

    for (const question of input.questions) {
      const questionResult = await transaction.execute({
        sql: 'INSERT INTO questions (test_id, section, text, explanation) VALUES (?, ?, ?, ?) RETURNING id',
        args: [testId, question.section, question.text, question.explanation ?? null],
      });
      const questionId = Number(questionResult.rows[0]?.id);

      for (const option of question.options) {
        await transaction.execute({
          sql: 'INSERT INTO options (question_id, text, is_correct) VALUES (?, ?, ?)',
          args: [questionId, option.text, option.is_correct ? 1 : 0],
        });
      }
    }

    await transaction.commit();
    return { id: testId, ...input, questions: input.questions.length };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

export async function getMockTestById(testId: number) {
  const client = getTursoClient();
  const testResult = await client.execute({
    sql: `SELECT id, title, exam, questions, duration, difficulty, href, slug, is_new, is_free
      FROM tests WHERE id = ?`,
    args: [testId],
  });
  const test = testResult.rows[0];
  if (!test) return null;

  const questionResult = await client.execute({
    sql: `SELECT q.id AS question_id, q.section, q.text AS question_text,
        o.id AS option_id, o.text AS option_text
      FROM questions q
      LEFT JOIN options o ON o.question_id = q.id
      WHERE q.test_id = ?
      ORDER BY q.id, o.id`,
    args: [testId],
  });
  const questions = new Map<number, {
    id: number;
    section: string;
    text: string;
    options: Array<{ id: number; text: string }>;
  }>();

  for (const row of questionResult.rows) {
    const questionId = Number(row.question_id);
    let question = questions.get(questionId);
    if (!question) {
      question = {
        id: questionId,
        section: String(row.section),
        text: String(row.question_text),
        options: [],
      };
      questions.set(questionId, question);
    }
    if (row.option_id !== null) {
      question.options.push({ id: Number(row.option_id), text: String(row.option_text) });
    }
  }

  return {
    id: Number(test.id),
    title: String(test.title),
    exam: String(test.exam),
    questions: [...questions.values()],
    duration: Number(test.duration),
    difficulty: String(test.difficulty),
    href: String(test.href),
    slug: String(test.slug),
    is_new: Boolean(Number(test.is_new)),
    is_free: Boolean(Number(test.is_free)),
  };
}

export async function createMockTestSession(displayName: string, mobile: string, testId: number) {
  const testResult = await getTursoClient().execute({
    sql: 'SELECT id FROM tests WHERE id = ?',
    args: [testId],
  });
  if (!testResult.rows[0]) throw new MocktestNotFoundError('Mock test not found');

  const sessionId = crypto.randomUUID();
  const result = await getTursoClient().execute({
    sql: 'INSERT INTO sessions (id, display_name, mobile, test_id) VALUES (?, ?, ?, ?) RETURNING id, display_name, test_id, created_at, last_seen',
    args: [sessionId, displayName, mobile, testId],
  });
  const session = result.rows[0];
  return {
    id: String(session.id),
    displayName: session.display_name === null ? null : String(session.display_name),
    testId: Number(session.test_id),
    createdAt: session.created_at,
    lastSeen: session.last_seen,
  };
}

export async function submitMockTestAttempt(input: SubmitMockTestAttemptInput) {
  const client = getTursoClient();
  const transaction = await client.transaction('write');

  try {
    const sessionResult = await transaction.execute({
      sql: 'SELECT test_id FROM sessions WHERE id = ? AND mobile = ?',
      args: [input.sessionId, input.mobile],
    });
    if (!sessionResult.rows[0]) throw new MocktestSubmissionError('Session not found for this user');
    const testId = Number(sessionResult.rows[0].test_id);
    if (!Number.isSafeInteger(testId) || testId < 1) {
      throw new MocktestSubmissionError('Session is not associated with a mock test');
    }

    const testResult = await transaction.execute({
      sql: 'SELECT id FROM tests WHERE id = ?',
      args: [testId],
    });
    if (!testResult.rows[0]) throw new MocktestNotFoundError('Mock test not found');

    const questionResult = await transaction.execute({
      sql: `SELECT q.id AS question_id, q.section, o.id AS option_id, o.is_correct
        FROM questions q
        LEFT JOIN options o ON o.question_id = q.id
        WHERE q.test_id = ?
        ORDER BY q.id, o.id`,
      args: [testId],
    });
    const questions = new Map<number, {
      section: string;
      options: Map<number, boolean>;
    }>();

    for (const row of questionResult.rows) {
      const questionId = Number(row.question_id);
      let question = questions.get(questionId);
      if (!question) {
        question = { section: String(row.section), options: new Map() };
        questions.set(questionId, question);
      }
      if (row.option_id !== null) {
        question.options.set(Number(row.option_id), Boolean(Number(row.is_correct)));
      }
    }
    if (questions.size === 0) throw new MocktestSubmissionError('Mock test has no questions');

    const answersByQuestion = new Map<number, SubmitMockTestAttemptInput['answers'][number]>();
    for (const answer of input.answers) {
      if (answersByQuestion.has(answer.questionId)) {
        throw new MocktestSubmissionError(`Duplicate answer for question ${answer.questionId}`);
      }
      const question = questions.get(answer.questionId);
      if (!question) throw new MocktestSubmissionError(`Question ${answer.questionId} does not belong to this test`);
      if (answer.selectedOptionId !== null && !question.options.has(answer.selectedOptionId)) {
        throw new MocktestSubmissionError(`Option does not belong to question ${answer.questionId}`);
      }
      answersByQuestion.set(answer.questionId, answer);
    }

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let marked = 0;
    const sectionStats = new Map<string, { correct: number; wrong: number; skipped: number; total: number }>();
    for (const question of questions.values()) {
      const stats = sectionStats.get(question.section) ?? { correct: 0, wrong: 0, skipped: 0, total: 0 };
      stats.total += 1;
      sectionStats.set(question.section, stats);
    }

    for (const [questionId, question] of questions) {
      const answer = answersByQuestion.get(questionId);
      const stats = sectionStats.get(question.section)!;
      if (answer?.isMarked) marked += 1;

      if (!answer || answer.selectedOptionId === null) {
        skipped += 1;
        stats.skipped += 1;
      } else if (question.options.get(answer.selectedOptionId)) {
        correct += 1;
        stats.correct += 1;
      } else {
        wrong += 1;
        stats.wrong += 1;
      }
    }

    const attemptResult = await transaction.execute({
      sql: `INSERT INTO attempts
        (test_id, session_id, score, correct, wrong, skipped, marked, time_taken, total_questions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id, submitted_at`,
      args: [testId, input.sessionId, correct, correct, wrong, skipped, marked, input.timeTaken, questions.size],
    });
    const attempt = attemptResult.rows[0];
    const attemptId = Number(attempt.id);

    for (const [questionId, question] of questions) {
      const answer = answersByQuestion.get(questionId);
      const selectedOptionId = answer?.selectedOptionId ?? null;
      const isCorrect = selectedOptionId !== null && question.options.get(selectedOptionId) === true;
      await transaction.execute({
        sql: 'INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, is_correct) VALUES (?, ?, ?, ?)',
        args: [attemptId, questionId, selectedOptionId, isCorrect ? 1 : 0],
      });
    }

    for (const [sectionName, stats] of sectionStats) {
      await transaction.execute({
        sql: `INSERT INTO attempt_sections
          (attempt_id, section_name, correct, wrong, skipped, total)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [attemptId, sectionName, stats.correct, stats.wrong, stats.skipped, stats.total],
      });
    }

    await transaction.execute({
      sql: 'UPDATE tests SET attempts = attempts + 1 WHERE id = ?',
      args: [testId],
    });
    await transaction.execute({
      sql: 'UPDATE sessions SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      args: [input.sessionId],
    });
    await transaction.commit();

    return {
      id: attemptId,
      testId,
      score: correct,
      correct,
      wrong,
      skipped,
      marked,
      timeTaken: input.timeTaken,
      totalQuestions: questions.size,
      submittedAt: attempt.submitted_at,
      sections: [...sectionStats].map(([sectionName, stats]) => ({ sectionName, ...stats })),
    };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

export async function getUserMocktestAttempts(mobile: string, page: number, limit: number) {
  const client = getTursoClient();
  const offset = (page - 1) * limit;
  const [countResult, attemptsResult] = await Promise.all([
    client.execute({
      sql: `SELECT COUNT(*) AS total
        FROM attempts a
        INNER JOIN sessions s ON s.id = a.session_id
        WHERE s.mobile = ?`,
      args: [mobile],
    }),
    client.execute({
      sql: `SELECT a.id AS attempt_id, a.test_id, t.title, t.exam, t.slug, t.href,
          a.score, a.correct, a.wrong, a.skipped, a.marked, a.time_taken,
          a.total_questions, a.submitted_at
        FROM attempts a
        INNER JOIN sessions s ON s.id = a.session_id
        INNER JOIN tests t ON t.id = a.test_id
        WHERE s.mobile = ?
        ORDER BY a.submitted_at DESC, a.id DESC
        LIMIT ? OFFSET ?`,
      args: [mobile, limit, offset],
    }),
  ]);

  return {
    attempts: attemptsResult.rows.map((row) => ({
      attemptId: Number(row.attempt_id),
      testId: Number(row.test_id),
      title: String(row.title),
      exam: String(row.exam),
      slug: String(row.slug),
      href: String(row.href),
      score: Number(row.score),
      correct: Number(row.correct),
      wrong: Number(row.wrong),
      skipped: Number(row.skipped),
      marked: Number(row.marked),
      timeTaken: Number(row.time_taken),
      totalQuestions: Number(row.total_questions),
      submittedAt: row.submitted_at,
    })),
    total: Number(countResult.rows[0]?.total ?? 0),
    page,
    limit,
  };
}