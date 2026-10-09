import { getTursoClient, TursoDatabaseConfigurationError } from '../../lib/turso';
import type { MocktestOwner } from '../mocktests/mocktests.dao';

export { TursoDatabaseConfigurationError };

export interface CreatePassageInput {
  passage_text: string;
  test_name: string;
}

export interface CreatePassageTypingResultInput {
  session_id: string;
  passage_id: number;
  owner: MocktestOwner;
  keystrokes_count: number;
  error_count: number;
  backspace_count: number;
  typed_word_count: number;
}

export interface PassageTypingResult {
  id: number;
  session_id: string;
  passage_id: number;
  keystrokes_count: number;
  error_count: number;
  backspace_count: number;
  total_word_count: number;
  typed_word_count: number;
  pending_word_count: number;
  created_at: string;
  updated_at: string;
}

export class PassageNotFoundError extends Error {}
export class InvalidPassageTypingResultError extends Error {}
export class PassageTypingResultOwnershipError extends Error {}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
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

export async function getRandomPassage(testName?: string, excludedIds: number[] = []) {
  const conditions: string[] = [];
  const args: Array<string | number> = [];
  if (testName) {
    conditions.push('test_name = ?');
    args.push(testName);
  }
  if (excludedIds.length > 0) {
    conditions.push(`id NOT IN (${excludedIds.map(() => '?').join(', ')})`);
    args.push(...excludedIds);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await getTursoClient().execute({
    sql: `SELECT id, passage_text, test_name, created_at
      FROM mocktest_passages
      ${whereClause}
      ORDER BY RANDOM()
      LIMIT 1`,
    args,
  });

  const passage = result.rows[0];
  if (!passage) return null;
  return {
    id: Number(passage.id),
    passage_text: String(passage.passage_text),
    test_name: String(passage.test_name),
    created_at: passage.created_at,
  };
}

export async function savePassageTypingResult(input: CreatePassageTypingResultInput): Promise<PassageTypingResult> {
  if (Boolean(input.owner.mobile) === Boolean(input.owner.guestIdHash)) {
    throw new InvalidPassageTypingResultError('Exactly one user identity is required');
  }

  const passageResult = await getTursoClient().execute({
    sql: 'SELECT id, passage_text FROM mocktest_passages WHERE id = ?',
    args: [input.passage_id],
  });
  const passage = passageResult.rows[0];
  if (!passage) {
    throw new PassageNotFoundError('Passage not found');
  }

  const totalWordCount = countWords(String(passage.passage_text));
  if (input.typed_word_count > totalWordCount) {
    throw new InvalidPassageTypingResultError('typed_word_count cannot exceed total_word_count');
  }

  const result = await getTursoClient().execute({
    sql: `INSERT INTO mocktest_passage_typing_results
      (session_id, passage_id, mobile, guest_id_hash, keystrokes_count, error_count, backspace_count, total_word_count, typed_word_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, passage_id)
      DO UPDATE SET
        keystrokes_count = excluded.keystrokes_count,
        error_count = excluded.error_count,
        backspace_count = excluded.backspace_count,
        total_word_count = excluded.total_word_count,
        typed_word_count = excluded.typed_word_count,
        updated_at = CURRENT_TIMESTAMP
      WHERE mocktest_passage_typing_results.mobile IS excluded.mobile
        AND mocktest_passage_typing_results.guest_id_hash IS excluded.guest_id_hash
      RETURNING id, session_id, passage_id, keystrokes_count, error_count, backspace_count, total_word_count, typed_word_count, created_at, updated_at`,
    args: [
      input.session_id,
      input.passage_id,
      input.owner.mobile,
      input.owner.guestIdHash,
      input.keystrokes_count,
      input.error_count,
      input.backspace_count,
      totalWordCount,
      input.typed_word_count,
    ],
  });

  const row = result.rows[0];
  if (!row) {
    throw new PassageTypingResultOwnershipError('This session and passage result belongs to another user');
  }
  const total = Number(row.total_word_count);
  const typed = Number(row.typed_word_count);

  return {
    id: Number(row.id),
    session_id: String(row.session_id),
    passage_id: Number(row.passage_id),
    keystrokes_count: Number(row.keystrokes_count),
    error_count: Number(row.error_count),
    backspace_count: Number(row.backspace_count),
    total_word_count: total,
    typed_word_count: typed,
    pending_word_count: Math.max(0, total - typed),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getPassageTypingResultsBySession(
  sessionId: string,
  owner: MocktestOwner,
  passageId?: number
): Promise<PassageTypingResult[]> {
  if (Boolean(owner.mobile) === Boolean(owner.guestIdHash)) {
    throw new InvalidPassageTypingResultError('Exactly one user identity is required');
  }

  const ownerCondition = owner.mobile
    ? 'mobile = ? AND guest_id_hash IS NULL'
    : 'guest_id_hash = ? AND mobile IS NULL';
  const ownerValue = owner.mobile || owner.guestIdHash!;
  const sql = passageId
    ? `SELECT id, session_id, passage_id, keystrokes_count, error_count, backspace_count, total_word_count, typed_word_count, created_at, updated_at
       FROM mocktest_passage_typing_results
       WHERE session_id = ? AND passage_id = ? AND ${ownerCondition}
       ORDER BY created_at DESC, id DESC`
    : `SELECT id, session_id, passage_id, keystrokes_count, error_count, backspace_count, total_word_count, typed_word_count, created_at, updated_at
       FROM mocktest_passage_typing_results
       WHERE session_id = ? AND ${ownerCondition}
       ORDER BY created_at DESC, id DESC`;

  const args = passageId ? [sessionId, passageId, ownerValue] : [sessionId, ownerValue];
  const result = await getTursoClient().execute({ sql, args });

  return result.rows.map((row) => {
    const total = Number(row.total_word_count);
    const typed = Number(row.typed_word_count);
    return {
      id: Number(row.id),
      session_id: String(row.session_id),
      passage_id: Number(row.passage_id),
      keystrokes_count: Number(row.keystrokes_count),
      error_count: Number(row.error_count),
      backspace_count: Number(row.backspace_count),
      total_word_count: total,
      typed_word_count: typed,
      pending_word_count: Math.max(0, total - typed),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  });
}