import { getTursoClient, TursoDatabaseConfigurationError } from '../../lib/turso';

export { TursoDatabaseConfigurationError };

export interface CreatePassageInput {
  passage_text: string;
  test_name: string;
}

export async function createPassage(inputs: CreatePassageInput | CreatePassageInput[]) {
  const passages = Array.isArray(inputs) ? inputs : [inputs];
  const transaction = await getTursoClient().transaction('write');

  try {
    const createdPassages = [];
    for (const input of passages) {
      const result = await transaction.execute({
        sql: `INSERT INTO mocktest_passages (passage_text, test_name)
          VALUES (?, ?)
          RETURNING id, passage_text, test_name, created_at`,
        args: [input.passage_text, input.test_name],
      });
      const passage = result.rows[0];
      createdPassages.push({
        id: Number(passage.id),
        passage_text: String(passage.passage_text),
        test_name: String(passage.test_name),
        created_at: passage.created_at,
      });
    }
    await transaction.commit();
    return Array.isArray(inputs) ? createdPassages : createdPassages[0];
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
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