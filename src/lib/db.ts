import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to your .env.local file.');
}

// Neon serverless SQL client — works perfectly with Next.js Edge + Node
export const sql = neon(process.env.DATABASE_URL);

// Helper: run a query and return rows
export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const result = await sql(strings, ...values);
  return result as T[];
}
