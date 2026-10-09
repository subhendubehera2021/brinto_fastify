import { getTursoClient, TursoDatabaseConfigurationError } from '../../lib/turso';

export { TursoDatabaseConfigurationError };

export interface CreatePassageInput {
  passage_text: string;
  test_name: string;
}

export async function createPassage(input: CreatePassageInput) {
  const result = await getTursoClient().execute({
    sql: `INSERT INTO mocktest_passages (passage_text, test_name)
      VALUES (?, ?)
      RETURNING id, passage_text, test_name, created_at`,
    args: [input.passage_text, input.test_name],
  });
  const passage = result.rows[0];
  return {
    id: Number(passage.id),
    passage_text: String(passage.passage_text),
    test_name: String(passage.test_name),
    created_at: passage.created_at,
  };
}

export async function getRandomPassage(testName?: string) {
  const result = testName
    ? await getTursoClient().execute({
        sql: `SELECT id, passage_text, test_name, created_at
          FROM mocktest_passages
          WHERE test_name = ?
          ORDER BY RANDOM()
          LIMIT 1`,
        args: [testName],
      })
    : await getTursoClient().execute(`SELECT id, passage_text, test_name, created_at
        FROM mocktest_passages
        ORDER BY RANDOM()
        LIMIT 1`);

  const passage = result.rows[0];
  if (!passage) return null;
  return {
    id: Number(passage.id),
    passage_text: String(passage.passage_text),
    test_name: String(passage.test_name),
    created_at: passage.created_at,
  };
}