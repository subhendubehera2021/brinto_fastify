import { createClient, type Client } from '@libsql/client';

export class TursoDatabaseConfigurationError extends Error {}

let client: Client | null = null;

export function getTursoClient(): Client {
  if (client) return client;

  const url = process.env.MOCKTEST_TURSO_DATABASE_URL;
  if (!url) {
    throw new TursoDatabaseConfigurationError('MOCKTEST_TURSO_DATABASE_URL is not configured');
  }

  client = createClient({
    url,
    authToken: process.env.MOCKTEST_TURSO_AUTH_TOKEN,
  });

  return client;
}