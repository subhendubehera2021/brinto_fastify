import { getTursoClient } from '../lib/turso';

export { TursoDatabaseConfigurationError as MocktestsDatabaseConfigurationError } from '../lib/turso';

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